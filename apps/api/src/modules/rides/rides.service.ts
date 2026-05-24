import { TokenService } from "../auth/token.service.js";
import { SessionService } from "../auth/session.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { RidesRepository, type RideWithDriverName } from "./rides.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import type {
  RideRequestResponse, RidesListResult, RideResult,
  AvailableRideResponse, AvailableRidesResult,
  DriverRideResponse, DriverRidesListResult,
} from "./rides.types.js";
import type { RideRequest } from "../../db/schema/index.js";
import type { CreateRideRequestInput, CancelAcceptedInput } from "./rides.schemas.js";

const tokenService   = new TokenService();
const sessionService = new SessionService();
const usersRepo      = new UsersRepository();
const ridesRepo      = new RidesRepository();

async function estimateFare(originText: string, destinationText: string): Promise<number> {
  let perKmCentavos = 230000;
  let minFareCentavos = 300000;

  try {
    const fareRepo = new (await import("../fareSettings/fareSettings.repository.js")).FareSettingsRepository();
    const [perKmSetting, minSetting, zoneFare] = await Promise.all([
      fareRepo.findByType("mobility_per_km"),
      fareRepo.findByType("minimum_fare"),
      fareRepo.findZoneFareByRoute(originText, destinationText),
    ]);
    if (perKmSetting) perKmCentavos = perKmSetting.value;
    if (minSetting)   minFareCentavos = minSetting.value;
    if (zoneFare)     return zoneFare.fare;
  } catch { }

  const estimatedKm = Math.max(1, (originText.length + destinationText.length) / 10);
  const minFareCLP = Math.round(minFareCentavos / 100);
  const raw = minFareCLP + Math.round(estimatedKm * perKmCentavos / 10000);
  return Math.min(Math.max(raw, minFareCLP), 50000);
}

function toResponse(r: RideRequest | RideWithDriverName): RideRequestResponse {
  return {
    id:              r.id,
    passengerUserId: r.passengerUserId,
    driverUserId:    r.driverUserId ?? null,
    driverName:      ("driverName"  in r ? r.driverName  : null) ?? null,
    driverPhone:     ("driverPhone" in r ? r.driverPhone : null) ?? null,
    originText:      r.originText,
    destinationText: r.destinationText,
    notes:           r.notes,
    estimatedFareClp: r.estimatedFareClp ?? null,
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
  };
}

function toDriverRideResponse(r: RideRequest): DriverRideResponse {
  return {
    id:                 r.id,
    originText:         r.originText,
    destinationText:    r.destinationText,
    notes:              r.notes,
    estimatedFareClp:   r.estimatedFareClp ?? null,
    status:             r.status,
    requestedAt:        r.requestedAt.toISOString(),
    acceptedAt:         r.acceptedAt?.toISOString() ?? null,
    enRouteAt:          r.enRouteAt?.toISOString() ?? null,
    arrivedAt:          r.arrivedAt?.toISOString() ?? null,
    startedAt:          r.startedAt?.toISOString() ?? null,
    completedAt:        r.completedAt?.toISOString() ?? null,
    cancelledAt:        r.cancelledAt?.toISOString() ?? null,
    cancellationReason: r.cancellationReason ?? null,
    cancelledByRole:    r.cancelledByRole ?? null,
    createdAt:          r.createdAt.toISOString(),
  };
}

function toAvailableResponse(r: RideRequest): AvailableRideResponse {
  return {
    id:               r.id,
    originText:       r.originText,
    destinationText:  r.destinationText,
    notes:            r.notes,
    estimatedFareClp: r.estimatedFareClp ?? null,
    status:           r.status,
    requestedAt:     r.requestedAt.toISOString(),
    createdAt:       r.createdAt.toISOString(),
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

export class RidesService {
  async listMyRides(accessToken: string): Promise<RidesListResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "passenger") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Only passengers can access ride requests.", statusCode: 403 };
    }

    const rows = await ridesRepo.findByPassengerIdWithDriver(auth.userId);
    return { ok: true, rides: rows.map(toResponse) };
  }

  async createRideRequest(accessToken: string, input: CreateRideRequestInput): Promise<RideResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "passenger") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Only passengers can create ride requests.", statusCode: 403 };
    }

    const fare = await estimateFare(input.originText, input.destinationText);
    const row = await ridesRepo.create(
      auth.userId,
      input.originText,
      input.destinationText,
      input.notes ?? null,
      fare,
    );
    return { ok: true, ride: toResponse(row) };
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

    // Atomic accept: UPDATE WHERE id=? AND status='requested'
    // If 0 rows updated, determine whether the ride doesn't exist or was already taken.
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

    const acceptedResp = toResponse(accepted);
    import("../notifications/notifications.helpers.js").then(({ notifyPassengerDriverAssigned }) => {
      notifyPassengerDriverAssigned({
        passengerUserId: acceptedResp.passengerUserId,
        driverName: acceptedResp.driverName ?? "Tu conductor",
        driverPhone: acceptedResp.driverPhone ?? null,
        rideId: acceptedResp.id,
        origin: acceptedResp.originText,
        destination: acceptedResp.destinationText,
      });
    }).catch(() => {});

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

    if (completed.driverUserId) {
      const { DriverStatusRepository } = await import("../drivers/driverStatus.repository.js");
      await new DriverStatusRepository().setAvailable(completed.driverUserId);
    }

    import("../notifications/notifications.helpers.js").then(({ notifyPassengerRideCompleted }) => {
      notifyPassengerRideCompleted({
        passengerUserId: completed.passengerUserId,
        rideId: completed.id,
        origin: completed.originText,
        destination: completed.destinationText,
      });
    }).catch(() => {});

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

    void ridesRepo.findById(rideId); // no-op; audit below is fire-and-forget
    const auditService = new (await import("../audit/audit.service.js")).AuditService();
    auditService.recordSafe({ eventType: "ride.driver_en_route", metadata: { driverUserId: auth.userId, rideId } });

    const enRouteResp = toResponse(updated);
    import("../notifications/notifications.helpers.js").then(({ notifyPassengerDriverEnRoute }) => {
      notifyPassengerDriverEnRoute({
        passengerUserId: enRouteResp.passengerUserId,
        driverName: enRouteResp.driverName ?? "Tu conductor",
        rideId: enRouteResp.id,
      });
    }).catch(() => {});

    return { ok: true, ride: toResponse(updated) };
  }

  async markArrived(accessToken: string, rideId: string): Promise<RideResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "driver") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Only drivers can mark arrival.", statusCode: 403 };
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

    const auditService = new (await import("../audit/audit.service.js")).AuditService();
    auditService.recordSafe({ eventType: "ride.driver_arrived", metadata: { driverUserId: auth.userId, rideId } });

    const arrivedResp = toResponse(updated);
    import("../notifications/notifications.helpers.js").then(({ notifyPassengerDriverArrived }) => {
      notifyPassengerDriverArrived({
        passengerUserId: arrivedResp.passengerUserId,
        driverName: arrivedResp.driverName ?? "Tu conductor",
        rideId: arrivedResp.id,
      });
    }).catch(() => {});

    return { ok: true, ride: toResponse(updated) };
  }

  async startRide(accessToken: string, rideId: string): Promise<RideResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "driver") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Only drivers can start rides.", statusCode: 403 };
    }

    // Atomic: UPDATE WHERE id=? AND status='driver_arrived' AND driver_user_id=?
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
          message: "Driver must mark arrival before starting the ride.",
          statusCode: 409,
        };
      }
      // Status is 'driver_arrived' but this driver is not the assigned one
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

    if (cancelled.driverUserId) {
      const { DriverStatusRepository } = await import("../drivers/driverStatus.repository.js");
      await new DriverStatusRepository().setAvailable(cancelled.driverUserId);
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
}
