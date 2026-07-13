import { TokenService } from "../auth/token.service.js";
import { SessionService } from "../auth/session.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { RidesRepository } from "./rides.repository.js";
import { WalletRepository } from "../wallet/wallet.repository.js";
import { WalletTransactionsRepository } from "../wallet/walletTransactions.repository.js";
import { CURRENT_LEDGER_POLICY_VERSION } from "../wallet/walletPolicy.constants.js";
import { AppError } from "../../shared/errors/AppError.js";
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

/**
 * Flujo autoritativo de no-show del pasajero (Fase 4B, regla C de la política aprobada).
 *
 * El cliente (app del conductor) NUNCA envía como autoritativo: noShowFee, amount, percentage,
 * minimumFare, waitingMinutes ni walletDebit — ConfirmNoShowInput solo acepta `notes`
 * (evidencia descriptiva no financiera, opcional). Todo el cálculo del cargo ocurre aquí,
 * a partir de datos ya persistidos en el servidor (ride.estimatedFareClp, ride.arrivedAt).
 */
export class NoShowService {
  async confirmNoShow(accessToken: string, rideId: string, input: ConfirmNoShowInput) {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "driver") {
      return { ok: false as const, code: "AUTH_FORBIDDEN", message: "Solo un conductor puede confirmar un no-show.", statusCode: 403 };
    }

    const ride = await ridesRepo.findById(rideId);
    if (!ride) {
      return { ok: false as const, code: "NOT_FOUND", message: "Ride not found.", statusCode: 404 };
    }

    if (ride.driverUserId !== auth.userId) {
      return { ok: false as const, code: "AUTH_FORBIDDEN", message: "Este viaje no está asignado a ti.", statusCode: 403 };
    }

    if (ride.status !== "driver_arrived") {
      return {
        ok: false as const,
        code: "RIDE_STATUS_NOT_ARRIVED",
        message: `No se puede confirmar no-show: el viaje debe estar en 'driver_arrived' (estado actual: '${ride.status}').`,
        statusCode: 409,
      };
    }

    if (!ride.arrivedAt) {
      return { ok: false as const, code: "RIDE_ARRIVAL_NOT_REGISTERED", message: "El viaje no tiene registro de llegada.", statusCode: 409 };
    }

    const waitedMs = Date.now() - ride.arrivedAt.getTime();
    if (waitedMs < NO_SHOW_MIN_WAIT_MS) {
      return {
        ok: false as const,
        code: "NO_SHOW_WAIT_NOT_ELAPSED",
        message: `Debes esperar ${Math.ceil((NO_SHOW_MIN_WAIT_MS - waitedMs) / 60_000)} minuto(s) más antes de confirmar no-show.`,
        statusCode: 409,
      };
    }

    const amountClp = ride.estimatedFareClp;
    if (!Number.isFinite(amountClp) || amountClp === null || amountClp <= 0) {
      return { ok: false as const, code: "INVALID_RIDE_FARE", message: "Ride has no valid fare.", statusCode: 409 };
    }

    // Idempotencia determinista: una sola clave por viaje — una segunda confirmación
    // (doble clic, reintento de red, dos conductores simultáneos si hubiera bug de
    // asignación) jamás puede generar un segundo cargo, porque idempotency_key es UNIQUE
    // a nivel de base de datos.
    const idempotencyKey = `no_show:${rideId}`;

    const existingDebit = await ledgerRepo.findByIdempotencyKey(idempotencyKey);
    if (existingDebit) {
      return { ok: true as const, transaction: existingDebit, idempotentReplay: true };
    }

    const wallet = await walletRepo.getOrCreate(ride.passengerUserId);

    const debit = await ledgerRepo.create({
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
    });

    const cancelled = await ridesRepo.cancelNoShow(rideId, auth.userId);
    if (!cancelled) {
      // El viaje ya no estaba en driver_arrived (carrera concurrente) — el débito ya quedó
      // registrado de forma idempotente arriba, así que no se pierde ni se duplica el cargo.
      // Se reporta el conflicto de estado del viaje, no un error del cargo.
      return {
        ok: false as const,
        code: "RIDE_CANNOT_CANCEL",
        message: "El viaje cambió de estado antes de poder cancelarlo como no-show, pero el cargo ya quedó registrado.",
        statusCode: 409,
      };
    }

    notifyPassengerOfNoShowCharge(ride.passengerUserId, rideId, amountClp);

    return { ok: true as const, transaction: debit, idempotentReplay: false };
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
