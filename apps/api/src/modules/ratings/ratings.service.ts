import { TokenService } from "../auth/token.service.js";
import { SessionService } from "../auth/session.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { RidesRepository } from "../rides/rides.repository.js";
import { RatingsRepository, type ReceivedRatingRow } from "./ratings.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { ModerateRatingInput, RateRideInput } from "./ratings.schemas.js";
import type { RatingResult, RatingsListResult, RatingResponse, RatingSummaryResult } from "./ratings.types.js";
import type { RideRating } from "../../db/schema/ratings.schema.js";

const tokenService = new TokenService();
const sessionService = new SessionService();
const usersRepo = new UsersRepository();
const ridesRepo = new RidesRepository();
const ratingsRepo = new RatingsRepository();

type AuthResult =
  | { ok: true; userId: string; role: string }
  | { ok: false; code: string; message: string; statusCode: number };

type Viewer = { userId: string; role: string };

async function authenticate(accessToken: string): Promise<AuthResult> {
  let payload: { sub: string };
  try {
    payload = tokenService.verifyAccessToken(accessToken);
  } catch (error) {
    if (error instanceof AppError) {
      return { ok: false, code: error.code, message: error.message, statusCode: error.statusCode };
    }
    return { ok: false, code: "UNAUTHORIZED", message: "Invalid access token.", statusCode: 401 };
  }
  if (!await sessionService.isSessionValid(tokenService.hashToken(accessToken))) {
    return { ok: false, code: "AUTH_SESSION_REVOKED", message: "Session has been revoked.", statusCode: 401 };
  }
  const user = await usersRepo.findById(payload.sub);
  if (!user) return { ok: false, code: "NOT_FOUND", message: "User not found.", statusCode: 404 };
  if (user.status !== "active") {
    return { ok: false, code: "AUTH_ACCOUNT_SUSPENDED", message: "La cuenta no está activa.", statusCode: 401 };
  }
  return { ok: true, userId: user.id, role: user.role };
}

function toResponse(rating: RideRating, viewer: Viewer): RatingResponse {
  const isAdmin = viewer.role === "admin";
  const isRater = viewer.userId === rating.raterUserId;
  const canSeePrivate = isAdmin || isRater || rating.commentVisibility === "participants_and_admin";
  const canSeeModerated = isAdmin || rating.moderationStatus !== "hidden";
  return {
    id: rating.id,
    rideRequestId: rating.rideRequestId,
    raterUserId: rating.raterUserId,
    ratedUserId: rating.ratedUserId,
    raterRole: rating.raterRole,
    rating: rating.rating,
    comment: canSeePrivate && canSeeModerated ? rating.comment ?? null : null,
    commentVisibility: rating.commentVisibility as RatingResponse["commentVisibility"],
    moderationStatus: rating.moderationStatus as RatingResponse["moderationStatus"],
    moderationReason: isAdmin || isRater ? rating.moderationReason ?? null : null,
    moderatedByUserId: isAdmin ? rating.moderatedByUserId ?? null : null,
    moderatedAt: rating.moderatedAt?.toISOString() ?? null,
    createdAt: rating.createdAt.toISOString(),
    updatedAt: rating.updatedAt.toISOString(),
  };
}

function withContext(row: ReceivedRatingRow, viewer: Viewer) {
  return {
    ...toResponse(row, viewer),
    raterName: row.raterName ?? null,
    originText: row.originText ?? null,
    destinationText: row.destinationText ?? null,
  };
}

export class RatingsService {
  async rateRide(accessToken: string, rideId: string, input: RateRideInput): Promise<RatingResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "passenger" && auth.role !== "driver") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Only passengers or drivers can rate rides.", statusCode: 403 };
    }
    const ride = await ridesRepo.findById(rideId);
    if (!ride) return { ok: false, code: "NOT_FOUND", message: "Ride request not found.", statusCode: 404 };
    if (ride.status !== "completed") return { ok: false, code: "RIDE_NOT_COMPLETED", message: "You can only rate completed rides.", statusCode: 409 };
    if (auth.role === "passenger" && ride.passengerUserId !== auth.userId) {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "You can only rate your own rides.", statusCode: 403 };
    }
    if (auth.role === "driver" && ride.driverUserId !== auth.userId) {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "You can only rate rides assigned to you.", statusCode: 403 };
    }
    const ratedUserId = auth.role === "passenger" ? ride.driverUserId : ride.passengerUserId;
    if (!ratedUserId) return { ok: false, code: "RATING_TARGET_MISSING", message: "The ride does not have a user available to rate.", statusCode: 409 };
    if (await ratingsRepo.findByRideAndRater(rideId, auth.userId)) {
      return { ok: false, code: "RATING_ALREADY_EXISTS", message: "You have already rated this ride.", statusCode: 409 };
    }
    const row = await ratingsRepo.create({
      rideRequestId: rideId,
      raterUserId: auth.userId,
      ratedUserId,
      raterRole: auth.role,
      rating: input.rating,
      comment: input.comment?.trim() || null,
      commentVisibility: input.commentVisibility,
    });
    return { ok: true, rating: toResponse(row, auth) };
  }

  async getRideRatings(accessToken: string, rideId: string): Promise<RatingsListResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    const ride = await ridesRepo.findById(rideId);
    if (!ride) return { ok: false, code: "NOT_FOUND", message: "Ride request not found.", statusCode: 404 };
    const isParticipant = ride.passengerUserId === auth.userId || ride.driverUserId === auth.userId || auth.role === "admin";
    if (!isParticipant) return { ok: false, code: "AUTH_FORBIDDEN", message: "You cannot view ratings for this ride.", statusCode: 403 };
    const rows = await ratingsRepo.findByRideId(rideId);
    return { ok: true, ratings: rows.map((row) => toResponse(row, auth)) };
  }

  async getMyReceivedSummary(accessToken: string): Promise<RatingSummaryResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "driver") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Only drivers can view the driver rating summary.", statusCode: 403 };
    }
    const summary = await ratingsRepo.getReceivedSummary(auth.userId);
    return { ok: true, summary: { average: summary.average, count: summary.count, latest: summary.latest.map((row) => withContext(row, auth)) } };
  }

  async listForAdmin(accessToken: string): Promise<{ ok: true; ratings: ReturnType<typeof withContext>[] } | Exclude<AuthResult, { ok: true }>> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "admin") return { ok: false, code: "AUTH_FORBIDDEN", message: "Admin only.", statusCode: 403 };
    const rows = await ratingsRepo.listForAdmin();
    return { ok: true, ratings: rows.map((row) => withContext(row, auth)) };
  }

  async moderate(accessToken: string, id: string, input: ModerateRatingInput): Promise<RatingResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "admin") return { ok: false, code: "AUTH_FORBIDDEN", message: "Admin only.", statusCode: 403 };
    const update: {
      id: string;
      moderationStatus: "visible" | "hidden";
      moderationReason?: string;
      moderatedByUserId: string;
    } = { id, moderationStatus: input.moderationStatus, moderatedByUserId: auth.userId };
    if (input.moderationReason !== undefined) update.moderationReason = input.moderationReason;
    const row = await ratingsRepo.moderate(update);
    if (!row) return { ok: false, code: "NOT_FOUND", message: "Rating not found.", statusCode: 404 };
    return { ok: true, rating: toResponse(row, auth) };
  }
}
