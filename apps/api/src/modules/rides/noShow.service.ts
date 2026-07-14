import { TokenService } from "../auth/token.service.js";
import { SessionService } from "../auth/session.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { RidesRepository } from "./rides.repository.js";
import { WalletRepository } from "../wallet/wallet.repository.js";
import { WalletTransactionsRepository } from "../wallet/walletTransactions.repository.js";
import { CURRENT_LEDGER_POLICY_VERSION } from "../wallet/walletPolicy.constants.js";
import { AppError } from "../../shared/errors/AppError.js";
import { db } from "../../db/client.js";
import type { WalletTransactionLedgerRow } from "../../db/schema/index.js";
import type { ConfirmNoShowInput } from "./noShow.schemas.js";

const tokenService   = new TokenService();
const sessionService = new SessionService();
const usersRepo      = new UsersRepository();
const ridesRepo      = new RidesRepository();
const walletRepo     = new WalletRepository();
const ledgerRepo     = new WalletTransactionsRepository();

// Política aprobada (Fase 4B): 5 minutos de espera mínima antes de poder confirmar no-show.
// Coincide con el valor ya usado (solo en cliente, hasta ahora) en driver/index.tsx.
const NO_SHOW_MIN_WAIT_MS = 5 * 60_000;

type AuthResult =
  | { ok: true; userId: string; role: string }
  | { ok: false; code: string; message: string; statusCode: number };

async function authenticate(accessToken: string): Promise<AuthResult> {
  let payload;
  try {
    payload = tokenService.verifyAccessToken(accessToken);
  } catch (err) {
    if (err instanceof AppError) {
      return { ok: false, code: err.code, message: err.message, statusCode: err.statusCode };
    }
    return { ok: false, code: "UNAUTHORIZED", message: "Invalid access token.", statusCode: 401 };
  }

  const hash = tokenService.hashToken(accessToken);
  const valid = await sessionService.isSessionValid(hash);
  if (!valid) {
    return { ok: false, code: "AUTH_SESSION_REVOKED", message: "Session has been revoked.", statusCode: 401 };
  }

  const user = await usersRepo.findById(payload.sub);
  if (!user) {
    return { ok: false, code: "NOT_FOUND", message: "User not found.", statusCode: 404 };
  }

  return { ok: true, userId: user.id, role: user.role };
}

type NoShowFailure = { code: string; message: string; statusCode: number };
type NoShowTxResult =
  | { kind: "failure"; failure: NoShowFailure }
  | { kind: "idempotent"; transaction: WalletTransactionLedgerRow }
  | { kind: "success"; transaction: WalletTransactionLedgerRow; passengerUserId: string; amountClp: number; rideId: string };

/**
 * Marcador interno: se lanza SOLO cuando el débito ya fue insertado dentro de la transacción
 * pero la cancelación del viaje no pudo completarse (carrera bajo el lock FOR UPDATE, caso
 * extremadamente improbable pero cubierto). Lanzar aquí fuerza el ROLLBACK completo —
 * Postgres deshace el INSERT del débito junto con todo lo demás, así que nunca queda un
 * débito huérfano sin transición de viaje (Fase 4A.1, Paso 2).
 */
class NoShowRideTransitionFailedError extends Error {}

/**
 * Flujo autoritativo de no-show del pasajero (Fase 4B, regla C de la política aprobada;
 * atomicidad reforzada en Fase 4A.1).
 *
 * El cliente (app del conductor) NUNCA envía como autoritativo: noShowFee, amount, percentage,
 * minimumFare, waitingMinutes ni walletDebit — ConfirmNoShowInput solo acepta `notes`
 * (evidencia descriptiva no financiera, opcional). Todo el cálculo del cargo ocurre aquí,
 * a partir de datos ya persistidos en el servidor (ride.estimatedFareClp, ride.arrivedAt).
 *
 * TODA la operación (lock del viaje, validaciones, creación del débito, transición del viaje)
 * ocurre dentro de una única db.transaction — o se confirma completa, o se revierte completa.
 */
export class NoShowService {
  async confirmNoShow(accessToken: string, rideId: string, input: ConfirmNoShowInput) {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "driver") {
      return { ok: false as const, code: "AUTH_FORBIDDEN", message: "Solo un conductor puede confirmar un no-show.", statusCode: 403 };
    }

    let txResult: NoShowTxResult;
    try {
      txResult = await db.transaction(async (tx) => {
        // 1. Cargar el viaje CON BLOQUEO — ninguna otra transacción de no-show sobre el
        //    mismo viaje puede leerlo hasta que esta termine (commit o rollback).
        const ride = await ridesRepo.findByIdForUpdate(rideId, tx);
        if (!ride) {
          return { kind: "failure", failure: { code: "NOT_FOUND", message: "Ride not found.", statusCode: 404 } };
        }

        // 2. Conductor asignado.
        if (ride.driverUserId !== auth.userId) {
          return { kind: "failure", failure: { code: "AUTH_FORBIDDEN", message: "Este viaje no está asignado a ti.", statusCode: 403 } };
        }

        // 3. Estado permitido (implica: no cancelado previamente, no ya marcado no-show —
        //    ambos dejan el viaje fuera de 'driver_arrived').
        if (ride.status !== "driver_arrived") {
          return {
            kind: "failure",
            failure: {
              code: "RIDE_STATUS_NOT_ARRIVED",
              message: `No se puede confirmar no-show: el viaje debe estar en 'driver_arrived' (estado actual: '${ride.status}').`,
              statusCode: 409,
            },
          };
        }

        // 4. Llegada previa registrada.
        if (!ride.arrivedAt) {
          return { kind: "failure", failure: { code: "RIDE_ARRIVAL_NOT_REGISTERED", message: "El viaje no tiene registro de llegada.", statusCode: 409 } };
        }

        // 5. Tiempo mínimo de espera cumplido.
        const waitedMs = Date.now() - ride.arrivedAt.getTime();
        if (waitedMs < NO_SHOW_MIN_WAIT_MS) {
          return {
            kind: "failure",
            failure: {
              code: "NO_SHOW_WAIT_NOT_ELAPSED",
              message: `Debes esperar ${Math.ceil((NO_SHOW_MIN_WAIT_MS - waitedMs) / 60_000)} minuto(s) más antes de confirmar no-show.`,
              statusCode: 409,
            },
          };
        }

        // 6. Monto calculado exclusivamente en servidor.
        const amountClp = ride.estimatedFareClp;
        if (!Number.isFinite(amountClp) || amountClp === null || amountClp <= 0) {
          return { kind: "failure", failure: { code: "INVALID_RIDE_FARE", message: "Ride has no valid fare.", statusCode: 409 } };
        }

        // 7. Idempotencia — clave determinista por viaje, consultada DENTRO de la misma
        //    transacción que hizo el lock (ninguna solicitud concurrente puede colarse
        //    entre el check y el insert: el lock FOR UPDATE ya serializa el acceso).
        const idempotencyKey = `no_show:${rideId}`;
        const existingDebit = await ledgerRepo.findByIdempotencyKey(idempotencyKey, tx);
        if (existingDebit) {
          return { kind: "idempotent", transaction: existingDebit };
        }

        const wallet = await walletRepo.getOrCreate(ride.passengerUserId);

        // 8. Crear débito pendiente.
        const debit = await ledgerRepo.create(
          {
            walletId: wallet.id,
            userId: ride.passengerUserId,
            rideId,
            type: "debit",
            source: "no_show",
            amountClp,
            currency: "CLP",
            status: "pending",
            approvalStatus: "not_required",
            idempotencyKey,
            policyVersion: CURRENT_LEDGER_POLICY_VERSION,
            actorRole: "system",
            collectionMethod: null,
            createdBy: auth.userId,
            metadata: {
              confirmedByDriverId: auth.userId,
              waitedMs,
              driverNotes: input.notes ?? null,
            },
          },
          tx,
        );

        // 9. Transición del viaje a no-show/cancelado, EN LA MISMA TRANSACCIÓN.
        const cancelled = await ridesRepo.cancelNoShow(rideId, auth.userId, tx);
        if (!cancelled) {
          // Bajo el lock FOR UPDATE esto no debería ocurrir, pero si pasa, forzamos
          // rollback del débito recién insertado — nunca debe quedar un débito sin
          // transición de viaje.
          throw new NoShowRideTransitionFailedError();
        }

        // 10. Auditoría: createdBy/createdAt/metadata ya quedan en la fila del ledger.
        return { kind: "success", transaction: debit, passengerUserId: ride.passengerUserId, amountClp, rideId };
      });
    } catch (err) {
      if (err instanceof NoShowRideTransitionFailedError) {
        return {
          ok: false as const,
          code: "RIDE_CANNOT_CANCEL",
          message: "El viaje cambió de estado durante la confirmación de no-show; no se aplicó ningún cargo (rollback completo).",
          statusCode: 409,
        };
      }
      throw err;
    }

    if (txResult.kind === "failure") {
      return { ok: false as const, ...txResult.failure };
    }

    if (txResult.kind === "idempotent") {
      return { ok: true as const, transaction: txResult.transaction, idempotentReplay: true };
    }

    notifyPassengerOfNoShowCharge(txResult.passengerUserId, txResult.rideId, txResult.amountClp);

    return { ok: true as const, transaction: txResult.transaction, idempotentReplay: false };
  }
}

function notifyPassengerOfNoShowCharge(passengerUserId: string, rideId: string, amountClp: number): void {
  import("../notifications/notifications.helpers.js")
    .then(({ notifyAsync }) => {
      notifyAsync({
        userId: passengerUserId,
        type: "ride_no_show_charged",
        title: "Cargo por no presentarse",
        message: `Se registró un cargo de $${amountClp.toLocaleString("es-CL")} CLP por no show en tu viaje.`,
        entityType: "ride_request",
        entityId: rideId,
      });
    })
    .catch(() => {
      // No bloquea el flujo de no-show si la notificación falla.
    });
}
