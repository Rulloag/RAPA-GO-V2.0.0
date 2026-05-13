import { TokenService } from "../auth/token.service.js";
import { SessionService } from "../auth/session.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { RidesRepository } from "./rides.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { RideRequestResponse, RidesListResult, RideResult } from "./rides.types.js";
import type { RideRequest } from "../../db/schema/index.js";
import type { CreateRideRequestInput } from "./rides.schemas.js";

const tokenService   = new TokenService();
const sessionService = new SessionService();
const usersRepo      = new UsersRepository();
const ridesRepo      = new RidesRepository();

function toResponse(r: RideRequest): RideRequestResponse {
  return {
    id:              r.id,
    passengerUserId: r.passengerUserId,
    originText:      r.originText,
    destinationText: r.destinationText,
    notes:           r.notes,
    status:          r.status,
    requestedAt:     r.requestedAt.toISOString(),
    cancelledAt:     r.cancelledAt?.toISOString() ?? null,
    createdAt:       r.createdAt.toISOString(),
    updatedAt:       r.updatedAt.toISOString(),
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
}
