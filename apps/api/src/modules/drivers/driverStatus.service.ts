import { TokenService } from "../auth/token.service.js";
import { SessionService } from "../auth/session.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { DriverStatusRepository } from "./driverStatus.repository.js";
import { RidesRepository } from "../rides/rides.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import { DriverComplianceService } from "./driverCompliance.service.js";
import { DriverComplianceRepository } from "./driverCompliance.repository.js";
import { RideAssignmentOffersRepository } from "../rides/rideAssignmentOffers.repository.js";
import { attemptQueuedOffer } from "../rides/rideQueueOfferProducer.service.js";

const tokenService     = new TokenService();
const sessionService   = new SessionService();
const usersRepo        = new UsersRepository();
const driverStatusRepo = new DriverStatusRepository();
const ridesRepo        = new RidesRepository();
const complianceService = new DriverComplianceService();
const offersRepo        = new RideAssignmentOffersRepository();

/**
 * Fase 5.2 — resuelve cualquier B en cola antes de dejar que
 * clearStaleCurrentRide() limpie current_ride_id, para que nunca quede
 * current_ride_id=NULL con queued_ride_id todavía apuntando a una B
 * accepted/queued_offer. Best-effort en la parte externa (oferta/matching);
 * la parte de BD es atómica dentro de resolveQueuedRideOnAbnormalEnd().
 */
async function resolveQueuedRideBeforeClearingStale(
  driverUserId: string,
  staleCurrentRideId: string,
): Promise<void> {
  const resolution = await driverStatusRepo.resolveQueuedRideOnAbnormalEnd(
    driverUserId,
    staleCurrentRideId,
  );

  if (resolution.decision === "RESOLVED") {
    await offersRepo.markCancelledByRideId(resolution.releasedRideId);
    void attemptQueuedOffer(resolution.releasedRideId).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[RAPA GO] No se pudo reasignar B ${resolution.releasedRideId} tras reconciliación de estado stale: ${message.slice(0, 300)}`);
    });
  }
}
const complianceRepo = new DriverComplianceRepository();

type AuthResult =
  | { ok: true; userId: string; role: string }
  | { ok: false; code: string; message: string; statusCode: number };

async function authenticate(accessToken: string): Promise<AuthResult> {
  let payload;
  try { payload = tokenService.verifyAccessToken(accessToken); }
  catch (err) {
    if (err instanceof AppError) return { ok: false, code: err.code, message: err.message, statusCode: err.statusCode };
    return { ok: false, code: "UNAUTHORIZED", message: "Invalid access token.", statusCode: 401 };
  }
  const hash  = tokenService.hashToken(accessToken);
  const valid = await sessionService.isSessionValid(hash);
  if (!valid) return { ok: false, code: "AUTH_SESSION_REVOKED", message: "Session has been revoked.", statusCode: 401 };
  const user = await usersRepo.findById(payload.sub);
  if (!user) return { ok: false, code: "NOT_FOUND", message: "User not found.", statusCode: 404 };
  return { ok: true, userId: user.id, role: user.role };
}

export class DriverStatusService {
  async getMyStatus(accessToken: string) {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "driver") return { ok: false, code: "AUTH_FORBIDDEN", message: "Only drivers can access driver status.", statusCode: 403 };

    let status = await driverStatusRepo.findByDriverId(auth.userId);
    if (!status) {
      status = await driverStatusRepo.upsert(auth.userId, "unavailable");
    }

    const activeRideId = await complianceRepo.findActiveRideIdForDriver(
      auth.userId,
    );

    if (status.currentRideId && !activeRideId) {
      await resolveQueuedRideBeforeClearingStale(auth.userId, status.currentRideId);
      await driverStatusRepo.clearStaleCurrentRide(auth.userId);
      status =
        (await driverStatusRepo.findByDriverId(auth.userId)) ??
        (await driverStatusRepo.upsert(auth.userId, "unavailable"));
    }

    return {
      ok: true,
      status: {
        availability:  status.availability,
        currentZone:   status.currentZone ?? null,
        lastSeenAt:    status.lastSeenAt?.toISOString() ?? null,
        currentRideId: status.currentRideId ?? null,
        // Preasignación encadenada (Fase 4.1): expone el estado real de BD
        // para que la UI reconstruya "Próximo viaje reservado" al reabrir la
        // app, en vez de depender únicamente de un flag en memoria que se
        // pierde al cerrar/reabrir.
        queuedRideId:  status.queuedRideId ?? null,
      },
    };
  }

  async updateMyStatus(accessToken: string, availability: string, currentZone?: string | null) {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "driver") return { ok: false, code: "AUTH_FORBIDDEN", message: "Only drivers can update driver status.", statusCode: 403 };

    if (!["available", "unavailable"].includes(availability)) {
      return { ok: false, code: "VALIDATION_ERROR", message: "availability must be 'available' or 'unavailable'.", statusCode: 400 };
    }

    const VALID_ZONES = ["hanga_roa", "mataveri", "anakena", "rano_raraku", "tongariki", "rano_kau_orongo", "vaihu_sur", "interior", "desconocida"];
    if (currentZone !== undefined && currentZone !== null && !VALID_ZONES.includes(currentZone)) {
      return { ok: false, code: "VALIDATION_ERROR", message: "currentZone inválida.", statusCode: 400 };
    }

    if (availability === "available") {
      const [current, activeRideId] = await Promise.all([
        driverStatusRepo.findByDriverId(auth.userId),
        complianceRepo.findActiveRideIdForDriver(auth.userId),
      ]);

      if (activeRideId) {
        if (current?.currentRideId !== activeRideId) {
          await driverStatusRepo.setBusy(auth.userId, activeRideId);
        }

        return {
          ok: false as const,
          code: "DRIVER_HAS_ACTIVE_RIDE",
          message:
            "No puedes marcarte Disponible mientras tienes un viaje activo real.",
          statusCode: 409,
        };
      }

      if (current?.currentRideId) {
        await resolveQueuedRideBeforeClearingStale(auth.userId, current.currentRideId);
        await driverStatusRepo.clearStaleCurrentRide(auth.userId);
      }

      const rest = await complianceService.canReceiveNewOffers(auth.userId);
      if (!rest.allowed) {
        await driverStatusRepo.setUnavailableForRest(auth.userId);
        return {
          ok: false as const,
          code: "DRIVER_REST_ACTIVE",
          message: rest.state.message,
          statusCode: 409,
          restState: rest.state,
        };
      }

      await driverStatusRepo.setAvailable(auth.userId);
    }

    const updated = await driverStatusRepo.upsert(
      auth.userId,
      availability,
      currentZone,
    );
    return {
      ok: true,
      status: {
        availability:  updated.availability,
        currentZone:   updated.currentZone ?? null,
        lastSeenAt:    updated.lastSeenAt?.toISOString() ?? null,
        currentRideId: updated.currentRideId ?? null,
      },
    };
  }

  async getTodayEarnings(accessToken: string) {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "driver") return { ok: false as const, code: "AUTH_FORBIDDEN", message: "Solo conductores pueden consultar sus ganancias.", statusCode: 403 };

    const today = new Date();
    const rides = await ridesRepo.findCompletedByDriverIdOnDate(auth.userId, today);

    // Rides with null estimatedFareClp are excluded (no fare to sum).
    const grossFareClp = rides.reduce((sum, r) => sum + (r.estimatedFareClp ?? 0), 0);
    // Comisión fija 23% / 77% — independiente de la categoría (incl. Confort).
    const { splitPlatformCommission } = await import("@rapa-go/shared");
    const split = splitPlatformCommission(grossFareClp);
    const appCommissionClp = split.platformFeeClp;
    const netEarningsClp = split.driverAmountClp;

    const dateStr = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}-${String(today.getUTCDate()).padStart(2, "0")}`;

    return {
      ok: true as const,
      earnings: {
        date:                 dateStr,
        grossFareClp,
        appCommissionPercent: 23,
        appCommissionClp,
        netEarningsClp,
        completedRides:       rides.length,
      },
    };
  }

  async updateMyLocation(accessToken: string, lat: number, lng: number) {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "driver") return { ok: false as const, code: "AUTH_FORBIDDEN", message: "Solo conductores pueden actualizar su ubicación.", statusCode: 403 };

    if (!isFinite(lat) || lat < -90  || lat > 90)  return { ok: false as const, code: "VALIDATION_ERROR", message: "lat inválida.", statusCode: 400 };
    if (!isFinite(lng) || lng < -180 || lng > 180) return { ok: false as const, code: "VALIDATION_ERROR", message: "lng inválida.", statusCode: 400 };

    await driverStatusRepo.updateLocation(auth.userId, lat, lng);
    return { ok: true as const, updatedAt: new Date().toISOString() };
  }
}
