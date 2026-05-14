import { TokenService } from "../auth/token.service.js";
import { SessionService } from "../auth/session.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { RidesRepository } from "../rides/rides.repository.js";
import { RatingsRepository } from "./ratings.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { RateRideInput } from "./ratings.schemas.js";
import type { RatingResult, RatingsListResult, RatingResponse } from "./ratings.types.js";
import type { RideRating } from "../../db/schema/ratings.schema.js";

const tokenService   = new TokenService();
const sessionService = new SessionService();
const usersRepo      = new UsersRepository();
const ridesRepo      = new RidesRepository();
const ratingsRepo    = new RatingsRepository();

function toResponse(r: RideRating): RatingResponse {
  return {
    id:            r.id,
    rideRequestId: r.rideRequestId,
    raterUserId:   r.raterUserId,
    ratedUserId:   r.ratedUserId,
    raterRole:     r.raterRole,
    rating:        r.rating,
    comment:       r.comment ?? null,
    createdAt:     r.createdAt.toISOString(),
    updatedAt:     r.updatedAt.toISOString(),
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

export class RatingsService {
  async rateRide(accessToken: string, rideId: string, input: RateRideInput): Promise<RatingResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "passenger" && auth.role !== "driver") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Only passengers or drivers can rate rides.", statusCode: 403 };
    }

    const ride = await ridesRepo.findById(rideId);
    if (!ride) {
      return { ok: false, code: "NOT_FOUND", message: "Ride request not found.", statusCode: 404 };
    }

    if (ride.status !== "completed") {
      return { ok: false, code: "RIDE_NOT_COMPLETED", message: "You can only rate completed rides.", statusCode: 409 };
    }

    if (auth.role === "passenger" && ride.passengerUserId !== auth.userId) {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "You can only rate your own rides.", statusCode: 403 };
    }
    if (auth.role === "driver" && ride.driverUserId !== auth.userId) {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "You can only rate rides assigned to you.", statusCode: 403 };
    }

    const existing = await ratingsRepo.findByRideAndRater(rideId, auth.userId);
    if (existing) {
      return { ok: false, code: "RATING_ALREADY_EXISTS", message: "You have already rated this ride.", statusCode: 409 };
    }

    const ratedUserId = auth.role === "passenger"
      ? ride.driverUserId!
      : ride.passengerUserId;

    const row = await ratingsRepo.create({
      rideRequestId: rideId,
      raterUserId:   auth.userId,
      ratedUserId,
      raterRole:     auth.role,
      rating:        input.rating,
      comment:       input.comment ?? null,
    });

    return { ok: true, rating: toResponse(row) };
  }

  async getRideRatings(accessToken: string, rideId: string): Promise<RatingsListResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    const ride = await ridesRepo.findById(rideId);
    if (!ride) {
      return { ok: false, code: "NOT_FOUND", message: "Ride request not found.", statusCode: 404 };
    }

    if (auth.role === "passenger" && ride.passengerUserId !== auth.userId) {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "You can only view ratings for your own rides.", statusCode: 403 };
    }
    if (auth.role === "driver" && ride.driverUserId !== auth.userId) {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "You can only view ratings for rides assigned to you.", statusCode: 403 };
    }

    const rows = await ratingsRepo.findByRideId(rideId);
    return { ok: true, ratings: rows.map(toResponse) };
  }
}
