import { TokenService } from "../auth/token.service.js";
import { SessionService } from "../auth/session.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { RidesRepository, type RideWithDriverName } from "./rides.repository.js";
import { DriverStatusRepository } from "../drivers/driverStatus.repository.js";
import { FareSettingsRepository } from "../fareSettings/fareSettings.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import type {
  RideRequestResponse, RidesListResult, RideResult,
  AvailableRideResponse, AvailableRidesResult,
  DriverRideResponse, DriverRidesListResult,
} from "./rides.types.js";
import type { RideRequest } from "../../db/schema/index.js";
import type { CreateRideRequestInput, CancelAcceptedInput } from "./rides.schemas.js";

const tokenService      = new TokenService();
const sessionService    = new SessionService();
const usersRepo         = new UsersRepository();
const ridesRepo         = new RidesRepository();
const driverStatusRepo  = new DriverStatusRepository();
const fareSettingsRepo  = new FareSettingsRepository();

const DEFAULT_PRIORITY_SURCHARGE_CLP = 2000;

// ── Auto-assignment parameters ────────────────────────────────────────────────
const MAX_DRIVER_LOCATION_AGE_MINUTES = 10;
const MAX_DRIVER_LAST_SEEN_AGE_MINUTES = 60;
const MAX_PICKUP_DISTANCE_KM = 15;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type FareResult = { fareClp: number; source: "google_maps" | "zone_fare" };

function estimateFare(distanceMeters: number): FareResult {
  const perKmCentavos   = 230_000;  // centavos CLP per km → 2 300 CLP/km
  const minFareCentavos = 300_000;  // centavos CLP minimum  → 3 000 CLP
  const km     = distanceMeters / 1000;
  const minCLP = Math.round(minFareCentavos / 100);
  const rawCLP = Math.round(km * (perKmCentavos / 100));
  return { fareClp: Math.max(rawCLP, minCLP), source: "google_maps" };
}

function toResponse(
  r: RideRequest | RideWithDriverName,
  discountInfo?: { discountPercent: number; originalFare: number },
): RideRequestResponse {
  return {
    id:              r.id,
    passengerUserId: r.passengerUserId,
    driverUserId:    r.driverUserId ?? null,
    driverName:      ("driverName"  in r ? r.driverName  : null) ?? null,
    driverPhone:     ("driverPhone" in r ? r.driverPhone : null) ?? null,
    originText:      r.originText,
    destinationText: r.destinationText,
    notes:           r.notes,
    estimatedFareClp:      r.estimatedFareClp ?? null,
    originLat:             r.originLat ?? null,
    originLng:             r.originLng ?? null,
    destinationLat:        r.destinationLat ?? null,
    destinationLng:        r.destinationLng ?? null,
    distanceMeters:        r.distanceMeters ?? null,
    durationSeconds:       r.durationSeconds ?? null,
    fareCalculationSource: r.fareCalculationSource,
    status:          r.status,
    requestedAt:     r.requestedAt.toISOString(),
    acceptedAt:      r.acceptedAt?.toISOString() ?? null,
    enRouteAt:       r.enRouteAt?.toISOString() ?? null,
    arrivedAt:       r.arrivedAt?.toISOString() ?? null,
    startedAt:       r.startedAt?.toISOString() ?? null,
    completedAt:     r.completedAt?.toISOString() ?? null,
    cancelledAt:        r.cancelledAt?.toISOString() ?? null,
    cancellationReason: r.cancellationReason ?? null,
    cancelledByRole:    r.cancelledByRole ?? null,
    createdAt:          r.createdAt.toISOString(),
    updatedAt:          r.updatedAt.toISOString(),
    driverRatingAverage: ("driverRatingAverage" in r ? r.driverRatingAverage : null) ?? null,
    driverRatingCount:   ("driverRatingCount"   in r ? r.driverRatingCount   : 0) ?? 0,
    driverVehicleBrand:  ("driverVehicleBrand"  in r ? r.driverVehicleBrand  : null) ?? null,
    driverVehicleModel:  ("driverVehicleModel"  in r ? r.driverVehicleModel  : null) ?? null,
    driverVehicleYear:   ("driverVehicleYear"   in r ? r.driverVehicleYear   : null) ?? null,
    driverVehiclePlate:  ("driverVehiclePlate"  in r ? r.driverVehiclePlate  : null) ?? null,
    driverVehicleColor:  ("driverVehicleColor"  in r ? r.driverVehicleColor  : null) ?? null,
    discountApplied:  discountInfo != null,
    discountPercent:  discountInfo?.discountPercent ?? null,
    originalFareClp:  discountInfo?.originalFare ?? null,
    rideType:         r.rideType ?? "immediate",
    scheduledPickupAt: r.scheduledPickupAt?.toISOString() ?? null,
    priorityFeeClp:   r.priorityFeeClp ?? null,
    flightNumber:     r.flightNumber ?? null,
  };
}

function toDriverRideResponse(r: RideRequest): DriverRideResponse {
  return {
    id:                    r.id,
    originText:            r.originText,
    destinationText:       r.destinationText,
    notes:                 r.notes,
    estimatedFareClp:      r.estimatedFareClp ?? null,
    originLat:             r.originLat ?? null,
    originLng:             r.originLng ?? null,
    destinationLat:        r.destinationLat ?? null,
    destinationLng:        r.destinationLng ?? null,
    distanceMeters:        r.distanceMeters ?? null,
    durationSeconds:       r.durationSeconds ?? null,
    fareCalculationSource: r.fareCalculationSource,
    status:                r.status,
    requestedAt:           r.requestedAt.toISOString(),
    acceptedAt:            r.acceptedAt?.toISOString() ?? null,
    enRouteAt:             r.enRouteAt?.toISOString() ?? null,
    arrivedAt:             r.arrivedAt?.toISOString() ?? null,
    startedAt:             r.startedAt?.toISOString() ?? null,
    completedAt:           r.completedAt?.toISOString() ?? null,
    cancelledAt:           r.cancelledAt?.toISOString() ?? null,
    cancellationReason:    r.cancellationReason ?? null,
    cancelledByRole:       r.cancelledByRole ?? null,
    createdAt:             r.createdAt.toISOString(),
    rideType:              r.rideType ?? "immediate",
    scheduledPickupAt:     r.scheduledPickupAt?.toISOString() ?? null,
    priorityFeeClp:        r.priorityFeeClp ?? null,
    flightNumber:          r.flightNumber ?? null,
  };
}

function toAvailableResponse(r: RideRequest): AvailableRideResponse {
  return {
    id:                    r.id,
    originText:            r.originText,
    destinationText:       r.destinationText,
    notes:                 r.notes,
    estimatedFareClp:      r.estimatedFareClp ?? null,
    distanceMeters:        r.distanceMeters ?? null,
    durationSeconds:       r.durationSeconds ?? null,
    fareCalculationSource: r.fareCalculationSource,
    status:                r.status,
    requestedAt:           r.requestedAt.toISOString(),
    createdAt:             r.createdAt.toISOString(),
  };
}

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

  const hash  = tokenService.hashToken(accessToken);
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

async function autoAssignNearestDriver(
  rideId: string,
  originLat: number,
  originLng: number,
): Promise<(import("../../db/schema/index.js").RideRequest) | null> {
  const now = new Date();
  const locationCutoff = new Date(now.getTime() - MAX_DRIVER_LOCATION_AGE_MINUTES * 60 * 1000);
  const lastSeenCutoff  = new Date(now.getTime() - MAX_DRIVER_LAST_SEEN_AGE_MINUTES * 60 * 1000);

  const candidates = await driverStatusRepo.findAvailableWithLocation({ locationCutoff, lastSeenCutoff });

  const ranked = candidates
    .map(c => ({ ...c, distanceKm: haversineKm(originLat, originLng, c.currentLat, c.currentLng) }))
    .filter(c => c.distanceKm <= MAX_PICKUP_DISTANCE_KM)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  for (const candidate of ranked) {
    const assigned = await ridesRepo.accept(rideId, candidate.driverUserId);
    if (assigned) {
      await driverStatusRepo.setBusy(candidate.driverUserId, rideId);
      return assigned;
    }
    // Race condition — another request grabbed this driver; try next
  }

  return null;
}

export class RidesService {
  async listMyRides(accessToken: string): Promise<RidesListResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "passenger") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Only passengers can access ride requests.", statusCode: 403 };
    }

    const rows = await ridesRepo.findByPassengerIdWithDriver(auth.userId);
    return { ok: true, rides: rows.map(r => toResponse(r)) };
  }

  async createRideRequest(accessToken: string, input: CreateRideRequestInput): Promise<RideResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "passenger") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Only passengers can create ride requests.", statusCode: 403 };
    }

    const { fareClp: baseFare, source: fareSource } = estimateFare(input.distanceMeters);
    const rideType = input.rideType ?? "immediate";

    // ── Priority surcharge for scheduled rides ──────────────────────────────
    let priorityFeeClp: number | null = null;
    if (rideType === "scheduled") {
      try {
        const setting = await fareSettingsRepo.findByType("priority_surcharge");
        priorityFeeClp = (setting?.isActive ? setting.value : null) ?? DEFAULT_PRIORITY_SURCHARGE_CLP;
      } catch {
        priorityFeeClp = DEFAULT_PRIORITY_SURCHARGE_CLP;
      }
    }

    let finalFare    = baseFare + (priorityFeeClp ?? 0);
    let finalSource  = rideType === "scheduled" ? `${fareSource}_scheduled` : (fareSource as string);
    let discountInfo: { discountPercent: number; originalFare: number } | undefined;

    // ── Referral discount (immediate rides only — not stacked with priority) ─
    if (rideType === "immediate") {
      try {
        const { ReferralsRepository } = await import("../referrals/referrals.repository.js");
        const referralsRepo = new ReferralsRepository();
        const referralUse = await referralsRepo.findUseByReferredUserId(auth.userId);
        if (referralUse && !referralUse.convertedAt) {
          const { referralCodes } = await import("../../db/schema/index.js");
          const { db } = await import("../../db/client.js");
          const { eq } = await import("drizzle-orm");
          const codeRows = await db.select().from(referralCodes).where(eq(referralCodes.id, referralUse.referralCodeId)).limit(1);
          const refCode = codeRows[0] ?? null;
          if (refCode?.isActive && refCode.discountType === "percentage" && refCode.discountAmount) {
            const discountPercent = refCode.discountAmount;
            finalFare   = Math.max(Math.round(baseFare * (1 - discountPercent / 100)), 0);
            finalSource = `${fareSource}_with_referral`;
            discountInfo = { discountPercent, originalFare: baseFare };
          }
        }
      } catch { }
    }

    const scheduledPickupAt = input.scheduledPickupAt ? new Date(input.scheduledPickupAt) : null;

    const row = await ridesRepo.create({
      passengerUserId:       auth.userId,
      originText:            input.originText,
      destinationText:       input.destinationText,
      originLat:             input.originLat,
      originLng:             input.originLng,
      destinationLat:        input.destinationLat,
      destinationLng:        input.destinationLng,
      distanceMeters:        input.distanceMeters,
      durationSeconds:       input.durationSeconds,
      notes:                 input.notes ?? null,
      estimatedFareClp:      finalFare,
      fareCalculationSource: finalSource,
      rideType,
      scheduledPickupAt,
      priorityFeeClp,
      flightNumber:          input.flightNumber ?? null,
    });

    // ── Auto-assignment: only for immediate rides ───────────────────────────
    if (rideType === "immediate" && input.originLat != null && input.originLng != null) {
      try {
        const assigned = await autoAssignNearestDriver(row.id, input.originLat, input.originLng);
        if (assigned) {
          return { ok: true, ride: { ...toResponse(assigned, discountInfo), autoAssigned: true } };
        }
      } catch {
        // Auto-assignment failure is non-fatal — ride stays in requested for admin
      }
    }

    return { ok: true, ride: toResponse(row, discountInfo) };
  }

  async cancelRideRequest(accessToken: string, rideId: string): Promise<RideResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "passenger") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Only passengers can cancel ride requests.", statusCode: 403 };
    }

    const existing = await ridesRepo.findByIdAndPassenger(rideId, auth.userId);
    if (!existing) {
      return { ok: false, code: "NOT_FOUND", message: "Ride request not found.", statusCode: 404 };
    }

    if (existing.status !== "requested") {
      return {
        ok: false,
        code: "RIDE_CANNOT_CANCEL",
        message: `Ride request cannot be cancelled — current status is '${existing.status}'.`,
        statusCode: 409,
      };
    }

    const cancelled = await ridesRepo.cancel(existing.id);
    return { ok: true, ride: toResponse(cancelled) };
  }

  async listAvailableRides(accessToken: string): Promise<AvailableRidesResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "driver") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Only drivers can view available rides.", statusCode: 403 };
    }

    const rows = await ridesRepo.findAvailable();
    return { ok: true, rides: rows.map(toAvailableResponse) };
  }

  async acceptRideRequest(accessToken: string, rideId: string): Promise<RideResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "driver") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Only drivers can accept ride requests.", statusCode: 403 };
    }

    const accepted = await ridesRepo.accept(rideId, auth.userId);
    if (!accepted) {
      const existing = await ridesRepo.findById(rideId);
      if (!existing) {
        return { ok: false, code: "NOT_FOUND", message: "Ride request not found.", statusCode: 404 };
      }
      if (existing.status === "accepted") {
        return { ok: false, code: "RIDE_ALREADY_ACCEPTED", message: "This ride has already been accepted by another driver.", statusCode: 409 };
      }
      return {
        ok: false,
        code: "RIDE_CANNOT_ACCEPT",
        message: `Ride request cannot be accepted — current status is '${existing.status}'.`,
        statusCode: 409,
      };
    }

    return { ok: true, ride: toResponse(accepted) };
  }

  async completeRide(accessToken: string, rideId: string): Promise<RideResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "driver") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Only drivers can complete rides.", statusCode: 403 };
    }

    const completed = await ridesRepo.complete(rideId, auth.userId);
    if (!completed) {
      const existing = await ridesRepo.findById(rideId);
      if (!existing) {
        return { ok: false, code: "NOT_FOUND", message: "Ride request not found.", statusCode: 404 };
      }
      if (existing.status !== "in_progress") {
        return {
          ok: false,
          code: "RIDE_CANNOT_COMPLETE",
          message: `Ride cannot be completed — current status is '${existing.status}'.`,
          statusCode: 409,
        };
      }
      return { ok: false, code: "AUTH_FORBIDDEN", message: "You can only complete rides assigned to you.", statusCode: 403 };
    }

    // Free the driver so they can accept new rides
    await driverStatusRepo.setAvailable(auth.userId);

    return { ok: true, ride: toResponse(completed) };
  }

  async markEnRoute(accessToken: string, rideId: string): Promise<RideResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "driver") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Only drivers can mark rides en-route.", statusCode: 403 };
    }

    const updated = await ridesRepo.markEnRoute(rideId, auth.userId);
    if (!updated) {
      const existing = await ridesRepo.findById(rideId);
      if (!existing) {
        return { ok: false, code: "NOT_FOUND", message: "Ride request not found.", statusCode: 404 };
      }
      if (existing.driverUserId !== auth.userId) {
        return { ok: false, code: "AUTH_FORBIDDEN", message: "You can only update rides assigned to you.", statusCode: 403 };
      }
      return {
        ok: false,
        code: "RIDE_CANNOT_MARK_EN_ROUTE",
        message: `Ride cannot be marked en-route — current status is '${existing.status}'.`,
        statusCode: 409,
      };
    }

    return { ok: true, ride: toResponse(updated) };
  }

  async markArrived(accessToken: string, rideId: string): Promise<RideResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "driver") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Only drivers can mark rides arrived.", statusCode: 403 };
    }

    const updated = await ridesRepo.markArrived(rideId, auth.userId);
    if (!updated) {
      const existing = await ridesRepo.findById(rideId);
      if (!existing) {
        return { ok: false, code: "NOT_FOUND", message: "Ride request not found.", statusCode: 404 };
      }
      if (existing.driverUserId !== auth.userId) {
        return { ok: false, code: "AUTH_FORBIDDEN", message: "You can only update rides assigned to you.", statusCode: 403 };
      }
      return {
        ok: false,
        code: "RIDE_CANNOT_MARK_ARRIVED",
        message: `Ride cannot be marked arrived — current status is '${existing.status}'.`,
        statusCode: 409,
      };
    }

    return { ok: true, ride: toResponse(updated) };
  }

  async startRide(accessToken: string, rideId: string): Promise<RideResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "driver") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Only drivers can start rides.", statusCode: 403 };
    }

    const started = await ridesRepo.start(rideId, auth.userId);
    if (!started) {
      const existing = await ridesRepo.findById(rideId);
      if (!existing) {
        return { ok: false, code: "NOT_FOUND", message: "Ride request not found.", statusCode: 404 };
      }
      if (existing.status !== "driver_arrived") {
        return {
          ok: false,
          code: "RIDE_CANNOT_START",
          message: `Ride cannot be started — current status is '${existing.status}'.`,
          statusCode: 409,
        };
      }
      return { ok: false, code: "AUTH_FORBIDDEN", message: "You can only start rides assigned to you.", statusCode: 403 };
    }

    return { ok: true, ride: toResponse(started) };
  }

  async cancelAcceptedRide(
    accessToken: string,
    rideId: string,
    input: CancelAcceptedInput,
  ): Promise<RideResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "passenger" && auth.role !== "driver") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Only passengers or drivers can cancel rides.", statusCode: 403 };
    }

    const existing = await ridesRepo.findById(rideId);
    if (!existing) {
      return { ok: false, code: "NOT_FOUND", message: "Ride request not found.", statusCode: 404 };
    }

    if (auth.role === "passenger" && existing.passengerUserId !== auth.userId) {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "You can only cancel your own rides.", statusCode: 403 };
    }
    if (auth.role === "driver" && existing.driverUserId !== auth.userId) {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "You can only cancel rides assigned to you.", statusCode: 403 };
    }

    const cancelled = await ridesRepo.cancelAccepted(
      rideId,
      auth.userId,
      auth.role,
      input.reason ?? null,
    );
    if (!cancelled) {
      const refetch = await ridesRepo.findById(rideId);
      if (!refetch) {
        return { ok: false, code: "NOT_FOUND", message: "Ride request not found.", statusCode: 404 };
      }
      return {
        ok: false,
        code: "RIDE_CANNOT_CANCEL",
        message: `Ride request cannot be cancelled — current status is '${refetch.status}'.`,
        statusCode: 409,
      };
    }

    // Free the driver if the cancellation came from their side or from passenger
    if (cancelled.driverUserId) {
      await driverStatusRepo.setAvailable(cancelled.driverUserId);
    }

    return { ok: true, ride: toResponse(cancelled) };
  }

  async listDriverRides(accessToken: string): Promise<DriverRidesListResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "driver") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Only drivers can access their ride list.", statusCode: 403 };
    }

    const rows = await ridesRepo.findByDriverId(auth.userId);
    return { ok: true, rides: rows.map(toDriverRideResponse) };
  }

  async getDriverLocation(accessToken: string, rideId: string) {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (!["passenger", "admin"].includes(auth.role)) {
      return { ok: false as const, code: "AUTH_FORBIDDEN", message: "Acceso no autorizado.", statusCode: 403 };
    }

    const ride = await ridesRepo.findById(rideId);
    if (!ride) return { ok: false as const, code: "NOT_FOUND", message: "Viaje no encontrado.", statusCode: 404 };

    if (auth.role === "passenger" && ride.passengerUserId !== auth.userId) {
      return { ok: false as const, code: "AUTH_FORBIDDEN", message: "No puedes ver la ubicación de este viaje.", statusCode: 403 };
    }

    if (!ride.driverUserId) {
      return { ok: true as const, location: null };
    }

    const status = await driverStatusRepo.findByDriverId(ride.driverUserId);
    if (!status?.currentLat || !status?.currentLng) {
      return { ok: true as const, location: null };
    }

    return {
      ok: true as const,
      location: {
        driverUserId: ride.driverUserId,
        lat:          status.currentLat,
        lng:          status.currentLng,
        updatedAt:    status.locationUpdatedAt?.toISOString() ?? null,
      },
    };
  }
}
