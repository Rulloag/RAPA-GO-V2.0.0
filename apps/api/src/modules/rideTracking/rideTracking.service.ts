import { TokenService } from "../auth/token.service.js";
import { SessionService } from "../auth/session.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import { RideTrackingRepository } from "./rideTracking.repository.js";
import type { RideLocationUpdateInput } from "./rideTracking.schemas.js";
import type {
  RideLocationPointResponse,
  RideTrackingResult,
} from "./rideTracking.types.js";
import type { RideLocationUpdate, RideRequest } from "../../db/schema/index.js";

const tokenService = new TokenService();
const sessionService = new SessionService();
const usersRepo = new UsersRepository();
const trackingRepo = new RideTrackingRepository();

const ACTIVE_TRACKING_STATUSES = new Set([
  "accepted",
  "driver_en_route",
  "driver_arrived",
  "in_progress",
]);

const LOCATION_RETENTION_DAYS = 90;
const MAX_CLOCK_SKEW_MS = 10 * 60 * 1000;
const MIN_POINT_INTERVAL_MS = 1500;
const MIN_DISTANCE_METERS = 2;

type AuthResult =
  | { ok: true; userId: string; role: string }
  | { ok: false; code: string; message: string; statusCode: number };

async function authenticate(accessToken: string): Promise<AuthResult> {
  let payload: { sub: string };

  try {
    payload = tokenService.verifyAccessToken(accessToken);
  } catch (error) {
    if (error instanceof AppError) {
      return {
        ok: false,
        code: error.code,
        message: error.message,
        statusCode: error.statusCode,
      };
    }

    return {
      ok: false,
      code: "UNAUTHORIZED",
      message: "Invalid access token.",
      statusCode: 401,
    };
  }

  const hash = tokenService.hashToken(accessToken);
  if (!(await sessionService.isSessionValid(hash))) {
    return {
      ok: false,
      code: "AUTH_SESSION_REVOKED",
      message: "Session has been revoked.",
      statusCode: 401,
    };
  }

  const user = await usersRepo.findById(payload.sub);
  if (!user) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "User not found.",
      statusCode: 404,
    };
  }

  if (user.status === "deleted") {
    return {
      ok: false,
      code: "AUTH_ACCOUNT_DELETED",
      message: "Account has been deleted.",
      statusCode: 401,
    };
  }

  return { ok: true, userId: user.id, role: user.role };
}

function toResponse(point: RideLocationUpdate): RideLocationPointResponse {
  return {
    id: point.id,
    rideId: point.rideId,
    driverUserId: point.driverUserId,
    lat: point.latitude,
    lng: point.longitude,
    accuracyMeters: point.accuracyMeters ?? null,
    headingDegrees: point.headingDegrees ?? null,
    speedMetersPerSecond: point.speedMetersPerSecond ?? null,
    altitudeMeters: point.altitudeMeters ?? null,
    capturedAt: point.capturedAt.toISOString(),
    receivedAt: point.receivedAt.toISOString(),
    source: point.source as RideLocationPointResponse["source"],
    appState: point.appState as RideLocationPointResponse["appState"],
    sequenceNumber: point.sequenceNumber ?? null,
  };
}

function canReadRide(ride: RideRequest, userId: string, role: string): boolean {
  if (role === "admin") return true;
  if (role === "driver") return ride.driverUserId === userId;
  return ride.passengerUserId === userId;
}

function distanceMeters(
  first: { lat: number; lng: number },
  second: { lat: number; lng: number },
): number {
  const radius = 6371000;
  const toRad = (value: number): number => (value * Math.PI) / 180;
  const dLat = toRad(second.lat - first.lat);
  const dLng = toRad(second.lng - first.lng);
  const lat1 = toRad(first.lat);
  const lat2 = toRad(second.lat);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export class RideTrackingService {
  async publish(
    accessToken: string,
    rideId: string,
    input: RideLocationUpdateInput,
  ): Promise<RideTrackingResult<RideLocationPointResponse>> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "driver") {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message: "Only drivers can publish ride location.",
        statusCode: 403,
      };
    }

    const ride = await trackingRepo.findRideById(rideId);
    if (!ride) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "Ride not found.",
        statusCode: 404,
      };
    }

    if (ride.driverUserId !== auth.userId) {
      return {
        ok: false,
        code: "RIDE_TRACKING_NOT_ASSIGNED",
        message: "This ride is not assigned to the authenticated driver.",
        statusCode: 403,
      };
    }

    if (!ACTIVE_TRACKING_STATUSES.has(ride.status)) {
      return {
        ok: false,
        code: "RIDE_TRACKING_INACTIVE",
        message: `Location tracking is not active for ride status '${ride.status}'.`,
        statusCode: 409,
      };
    }

    const capturedAt = new Date(input.capturedAt);
    const now = new Date();
    if (Math.abs(now.getTime() - capturedAt.getTime()) > MAX_CLOCK_SKEW_MS) {
      return {
        ok: false,
        code: "RIDE_TRACKING_STALE_POINT",
        message: "The location timestamp is outside the accepted time window.",
        statusCode: 400,
      };
    }

    const latest = await trackingRepo.findLatest(rideId);
    if (latest) {
      const elapsed = capturedAt.getTime() - latest.capturedAt.getTime();
      const moved = distanceMeters(
        { lat: latest.latitude, lng: latest.longitude },
        { lat: input.lat, lng: input.lng },
      );

      if (elapsed >= 0 && elapsed < MIN_POINT_INTERVAL_MS && moved < MIN_DISTANCE_METERS) {
        return { ok: true, data: toResponse(latest) };
      }
    }

    const expiresAt = new Date(
      now.getTime() + LOCATION_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );

    const saved = await trackingRepo.insert({
      rideId,
      driverUserId: auth.userId,
      latitude: input.lat,
      longitude: input.lng,
      accuracyMeters: input.accuracyMeters ?? null,
      headingDegrees: input.headingDegrees ?? null,
      speedMetersPerSecond: input.speedMetersPerSecond ?? null,
      altitudeMeters: input.altitudeMeters ?? null,
      capturedAt,
      source: input.source,
      appState: input.appState,
      sequenceNumber: input.sequenceNumber ?? null,
      isMocked: input.isMocked,
      expiresAt,
    });

    return { ok: true, data: toResponse(saved) };
  }

  async latest(
    accessToken: string,
    rideId: string,
  ): Promise<RideTrackingResult<RideLocationPointResponse | null>> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    const ride = await trackingRepo.findRideById(rideId);
    if (!ride) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "Ride not found.",
        statusCode: 404,
      };
    }

    if (!canReadRide(ride, auth.userId, auth.role)) {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message: "You cannot view this ride location.",
        statusCode: 403,
      };
    }

    const point = await trackingRepo.findLatest(rideId);
    return { ok: true, data: point ? toResponse(point) : null };
  }

  async route(
    accessToken: string,
    rideId: string,
    limit: number,
  ): Promise<RideTrackingResult<RideLocationPointResponse[]>> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    const ride = await trackingRepo.findRideById(rideId);
    if (!ride) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "Ride not found.",
        statusCode: 404,
      };
    }

    if (!canReadRide(ride, auth.userId, auth.role)) {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message: "You cannot view this ride route.",
        statusCode: 403,
      };
    }

    const points = await trackingRepo.listRoute(rideId, limit);
    return { ok: true, data: points.map(toResponse) };
  }
}
