import { TokenService } from "../auth/token.service.js";
import { SessionService } from "../auth/session.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { RideAssignmentOffersRepository } from "../rides/rideAssignmentOffers.repository.js";
import { RidesRepository } from "../rides/rides.repository.js";
import { DriverStatusRepository } from "./driverStatus.repository.js";
import { toResponse } from "../rides/rides.responseMapper.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { RideAssignmentOfferResponse } from "../rides/rideAssignmentOffers.types.js";
import type { RideRequestResponse } from "../rides/rides.types.js";

const tokenService     = new TokenService();
const sessionService   = new SessionService();
const usersRepo        = new UsersRepository();
const offersRepo       = new RideAssignmentOffersRepository();
const ridesRepo        = new RidesRepository();
const driverStatusRepo = new DriverStatusRepository();

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

function toOfferResponse(o: import("../../db/schema/index.js").RideAssignmentOffer): RideAssignmentOfferResponse {
  return {
    id:             o.id,
    rideRequestId:  o.rideRequestId,
    driverUserId:   o.driverUserId,
    status:         o.status as RideAssignmentOfferResponse["status"],
    offeredAt:      o.offeredAt.toISOString(),
    expiresAt:      o.expiresAt.toISOString(),
    respondedAt:    o.respondedAt?.toISOString() ?? null,
    responseSource: o.responseSource as RideAssignmentOfferResponse["responseSource"],
    attemptOrder:   o.attemptOrder,
  };
}

export interface ActiveOfferPayload {
  offer: RideAssignmentOfferResponse;
  ride: {
    id:               string;
    originText:       string;
    destinationText:  string;
    estimatedFareClp: number | null;
    distanceMeters:   number | null;
    durationSeconds:  number | null;
    rideType:         string;
    scheduledPickupAt: string | null;
    priorityFeeClp:   number | null;
    flightNumber:     string | null;
  };
}

type GetActiveOfferResult =
  | { ok: true;  offer: ActiveOfferPayload | null }
  | { ok: false; code: string; message: string; statusCode: number };

type AcceptOfferResult =
  | { ok: true;  ride: RideRequestResponse }
  | { ok: false; code: string; message: string; statusCode: number };

type RejectOfferResult =
  | { ok: true }
  | { ok: false; code: string; message: string; statusCode: number };

export class DriverOffersService {
  async getActiveOffer(accessToken: string): Promise<GetActiveOfferResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "driver") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Only drivers can access offers.", statusCode: 403 };
    }

    const offer = await offersRepo.findPendingByDriverId(auth.userId);
    if (!offer) return { ok: true, offer: null };

    // Lazy expiry check
    if (offer.expiresAt <= new Date()) {
      await offersRepo.markExpired(offer.id);
      return { ok: true, offer: null };
    }

    const ride = await ridesRepo.findById(offer.rideRequestId);
    if (!ride) {
      await offersRepo.markExpired(offer.id);
      return { ok: true, offer: null };
    }

    return {
      ok: true,
      offer: {
        offer: toOfferResponse(offer),
        ride: {
          id:               ride.id,
          originText:       ride.originText,
          destinationText:  ride.destinationText,
          estimatedFareClp: ride.estimatedFareClp ?? null,
          distanceMeters:   ride.distanceMeters ?? null,
          durationSeconds:  ride.durationSeconds ?? null,
          rideType:         ride.rideType ?? "immediate",
          scheduledPickupAt: ride.scheduledPickupAt?.toISOString() ?? null,
          priorityFeeClp:   ride.priorityFeeClp ?? null,
          flightNumber:     ride.flightNumber ?? null,
        },
      },
    };
  }

  async acceptOffer(accessToken: string, offerId: string): Promise<AcceptOfferResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "driver") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Only drivers can accept offers.", statusCode: 403 };
    }

    // Atomic accept — fails if expired or already resolved
    const accepted = await offersRepo.markAccepted(offerId, auth.userId);
    if (!accepted) {
      return { ok: false, code: "OFFER_EXPIRED_OR_UNAVAILABLE", message: "Offer has expired or is no longer available.", statusCode: 409 };
    }

    // Accept the ride atomically — only if still requested
    const assignedRide = await ridesRepo.acceptAsQueued(accepted.rideRequestId, auth.userId);
    if (!assignedRide) {
      // Race: admin or another driver already took the ride — cancel the offer
      await offersRepo.markCancelledByRideId(accepted.rideRequestId);
      return { ok: false, code: "RIDE_ALREADY_ASSIGNED", message: "Ride was assigned by another party before you accepted.", statusCode: 409 };
    }

    // Record queued ride on driver_statuses — do NOT call setBusy (driver is still on current ride)
    await driverStatusRepo.setQueuedRide(auth.userId, assignedRide.id);

    return { ok: true, ride: toResponse(assignedRide) };
  }

  async rejectOffer(accessToken: string, offerId: string): Promise<RejectOfferResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;
    if (auth.role !== "driver") {
      return { ok: false, code: "AUTH_FORBIDDEN", message: "Only drivers can reject offers.", statusCode: 403 };
    }

    await offersRepo.markRejected(offerId, auth.userId);
    // Ride stays 'requested' — admin can assign manually.
    return { ok: true };
  }
}
