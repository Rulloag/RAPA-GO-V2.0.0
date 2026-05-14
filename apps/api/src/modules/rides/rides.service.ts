import { TokenService } from "../auth/token.service.js";
import { SessionService } from "../auth/session.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { RidesRepository } from "./rides.repository.js";
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

function toResponse(r: RideRequest): RideRequestResponse {
  return {
    id:              r.id,
    passengerUserId: r.passengerUserId,
    driverUserId:    r.driverUserId ?? null,
    originText:      r.originText,
    destinationText: r.destinationText,
    notes:           r.notes,
    status:          r.status,
    requestedAt:     r.requestedAt.toISOString(),
    acceptedAt:      r.acceptedAt?.toISOString() ?? null,
    cancelledAt:        r.cancelledAt?.toISOString() ?? null,
    cancellationReason: r.cancellationReason ?? null,
    cancelledByRole:    r.cancelledByRole ?? null,
    createdAt:          r.createdAt.toISOString(),
    updatedAt:       r.updatedAt.toISOString(),
  };
}

function toDriverRideResponse(r: RideRequest): DriverRideResponse {
  return {
    id:              r.id,
    originText:      r.originText,
    destinationText: r.destinationText,
    notes:           r.notes,
    status:          r.status,
    requestedAt:     r.requestedAt.toISOString(),
    acceptedAt:      r.acceptedAt?.toISOString() ?? null,
    createdAt:       r.createdAt.toISOString(),
  };
}

function toAvailableResponse(r: RideRequest): AvailableRideResponse {
  return {
    id:              r.id,
    originText:      r.originText,
    destinationText: r.destinationText,
    notes:           r.notes,
    status:          r.status,
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

    const rows = await ridesRepo.findByPassengerId(auth.userId);
    return { ok: true, rides: rows.map(toResponse) };
  }

  async createRideRequest(accessToken: string, input: CreateRideRequestInput): Promise<RideResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "passenger") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Only passengers can create ride requests.", statusCode: 403 };
    }

    const row = await ridesRepo.create(
      auth.userId,
      input.originText,
      input.destinationText,
      input.notes ?? null,
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

    return { ok: true, ride: toResponse(accepted) };
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
