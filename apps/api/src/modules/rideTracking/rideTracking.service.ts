import { TokenService } from "../auth/token.service.js";
import { SessionService } from "../auth/session.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import { RideTrackingRepository } from "./rideTracking.repository.js";
import type { RideLocationUpdateInput } from "./rideTracking.schemas.js";
import type {
  RideLocationBatchRejection,
  RideLocationBatchResult,
  RideLocationPointResponse,
  RideTrackingResult,
} from "./rideTracking.types.js";
import type {
  NewRideLocationUpdate,
  RideLocationUpdate,
  RideRequest,
} from "../../db/schema/index.js";

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

/**
 * El lote acepta además viajes ya terminados.
 *
 * Un backlog que se drena cuando vuelve la señal casi siempre contiene los
 * últimos minutos del viaje, que es justo cuando el conductor ya lo cerró. Con
 * las reglas del endpoint en vivo esos puntos darían 409 y se perderían
 * exactamente los que importan para una disputa de tarifa. Los estados que
 * nunca tuvieron rastreo (`requested`) siguen rechazando el lote entero.
 */
const BATCH_TRACKING_STATUSES = new Set([
  ...ACTIVE_TRACKING_STATUSES,
  "completed",
  "cancelled",
]);

const LOCATION_RETENTION_DAYS = 90;
const MAX_CLOCK_SKEW_MS = 10 * 60 * 1000;
const MIN_POINT_INTERVAL_MS = 1500;
const MIN_DISTANCE_METERS = 2;

/** Margen antes de aceptar el viaje: el GPS ya venía capturando. */
const RIDE_WINDOW_LEAD_MS = 5 * 60 * 1000;
/** Margen tras cerrarlo: la cola puede tardar en drenarse. */
const RIDE_WINDOW_TRAIL_MS = 10 * 60 * 1000;
/** Solo si el viaje llegara sin ninguna marca de tiempo (no debería pasar). */
const RIDE_WINDOW_FALLBACK_MS = 24 * 60 * 60 * 1000;

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

type DriverRideAuth =
  | { ok: true; userId: string; ride: RideRequest }
  | { ok: false; code: string; message: string; statusCode: number };

/**
 * Autorización compartida por el punto en vivo y el lote: mismo token, mismo
 * rol, misma asignación de viaje. Lo único que cambia entre ambos es qué
 * estados de viaje admiten escritura, y por eso se recibe como parámetro.
 */
async function authorizeDriverForRide(
  accessToken: string,
  rideId: string,
  allowedStatuses: ReadonlySet<string>,
): Promise<DriverRideAuth> {
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

  if (!allowedStatuses.has(ride.status)) {
    return {
      ok: false,
      code: "RIDE_TRACKING_INACTIVE",
      message: `Location tracking is not active for ride status '${ride.status}'.`,
      statusCode: 409,
    };
  }

  return { ok: true, userId: auth.userId, ride };
}

/**
 * Ventana temporal plausible para los puntos de un viaje.
 *
 * Sustituye al `MAX_CLOCK_SKEW_MS` simétrico en el camino del lote: ese
 * rechazaría un backlog de 40 minutos, que es exactamente el caso de uso. Aquí
 * el pasado se acota contra la vida real del viaje en vez de contra el reloj.
 */
function rideTrackingWindow(
  ride: RideRequest,
  now: Date,
): { start: number; end: number } {
  // `requestedAt` es NOT NULL en el esquema, así que la cadena siempre resuelve
  // con datos reales. El último tramo solo evita un 500 si llegara un registro
  // incompleto: un día atrás sigue siendo un límite plausible para un backlog.
  const startAnchor = ride.acceptedAt ?? ride.requestedAt ?? ride.createdAt;
  const start = startAnchor
    ? startAnchor.getTime() - RIDE_WINDOW_LEAD_MS
    : now.getTime() - RIDE_WINDOW_FALLBACK_MS;

  const endAnchor = ride.completedAt ?? ride.cancelledAt;

  return {
    start,
    end:
      (endAnchor ? endAnchor.getTime() : now.getTime()) + RIDE_WINDOW_TRAIL_MS,
  };
}

export class RideTrackingService {
  async publish(
    accessToken: string,
    rideId: string,
    input: RideLocationUpdateInput,
  ): Promise<RideTrackingResult<RideLocationPointResponse>> {
    const auth = await authorizeDriverForRide(
      accessToken,
      rideId,
      ACTIVE_TRACKING_STATUSES,
    );
    if (!auth.ok) return auth;

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

  /**
   * Guarda un lote de puntos acumulados sin señal.
   *
   * El antispam del punto en vivo compara contra `findLatest()`. Aplicado tal
   * cual a un histórico descartaría el lote entero, porque todos sus puntos son
   * anteriores al último guardado. En su lugar se usa un CURSOR que avanza
   * dentro del propio lote: cada punto se compara con el anterior ACEPTADO, no
   * con el estado de la base. Así la forma del recorrido se conserva, con una
   * sola consulta y en O(n).
   */
  async publishBatch(
    accessToken: string,
    rideId: string,
    inputs: RideLocationUpdateInput[],
  ): Promise<RideTrackingResult<RideLocationBatchResult>> {
    const auth = await authorizeDriverForRide(
      accessToken,
      rideId,
      BATCH_TRACKING_STATUSES,
    );
    if (!auth.ok) return auth;

    const now = new Date();
    const nowMs = now.getTime();
    const window = rideTrackingWindow(auth.ride, now);

    // Se ordena por captura, pero conservando el índice original: el cliente
    // necesita saber CUÁL de sus puntos se rechazó, no cuál de los ordenados.
    const ordered = inputs
      .map((input, index) => ({
        input,
        index,
        at: new Date(input.capturedAt).getTime(),
      }))
      .sort((a, b) => a.at - b.at);

    const stored = await trackingRepo.findLatest(rideId);
    let cursor: { at: number; lat: number; lng: number } | null = stored
      ? {
          at: stored.capturedAt.getTime(),
          lat: stored.latitude,
          lng: stored.longitude,
        }
      : null;

    // Si lo guardado es más nuevo que todo el lote, este es un backlog
    // histórico: arrancar el cursor ahí compararía peras con manzanas.
    const earliest = ordered[0];
    if (cursor && earliest && cursor.at > earliest.at) {
      cursor = null;
    }

    const expiresAt = new Date(
      nowMs + LOCATION_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );

    const rejected: RideLocationBatchRejection[] = [];
    const rows: NewRideLocationUpdate[] = [];

    for (const entry of ordered) {
      if (!Number.isFinite(entry.at)) {
        rejected.push({ index: entry.index, code: "OUT_OF_RIDE_WINDOW" });
        continue;
      }

      // Un reloj adelantado envenenaría el orden del recorrido.
      if (entry.at > nowMs + MAX_CLOCK_SKEW_MS) {
        rejected.push({ index: entry.index, code: "FUTURE_TIMESTAMP" });
        continue;
      }

      if (entry.at < window.start || entry.at > window.end) {
        rejected.push({ index: entry.index, code: "OUT_OF_RIDE_WINDOW" });
        continue;
      }

      if (cursor) {
        const elapsed = entry.at - cursor.at;
        const moved = distanceMeters(
          { lat: cursor.lat, lng: cursor.lng },
          { lat: entry.input.lat, lng: entry.input.lng },
        );

        if (
          elapsed >= 0 &&
          elapsed < MIN_POINT_INTERVAL_MS &&
          moved < MIN_DISTANCE_METERS
        ) {
          rejected.push({ index: entry.index, code: "TOO_CLOSE" });
          continue;
        }
      }

      cursor = { at: entry.at, lat: entry.input.lat, lng: entry.input.lng };

      rows.push({
        rideId,
        driverUserId: auth.userId,
        latitude: entry.input.lat,
        longitude: entry.input.lng,
        accuracyMeters: entry.input.accuracyMeters ?? null,
        headingDegrees: entry.input.headingDegrees ?? null,
        speedMetersPerSecond: entry.input.speedMetersPerSecond ?? null,
        altitudeMeters: entry.input.altitudeMeters ?? null,
        capturedAt: new Date(entry.at),
        source: entry.input.source,
        appState: entry.input.appState,
        sequenceNumber: entry.input.sequenceNumber ?? null,
        isMocked: entry.input.isMocked,
        expiresAt,
      });
    }

    const inserted = await trackingRepo.insertMany(rows);
    const accepted = inserted.length;

    // Lo enviado menos lo insertado son puntos que ya estaban: un reintento
    // tras perder la respuesta. No es un fallo.
    const duplicates = rows.length - accepted;

    // Solo se relee si algo cambió; si no, `stored` ya es lo más reciente.
    const latest = accepted > 0 ? await trackingRepo.findLatest(rideId) : stored;

    return {
      ok: true,
      data: {
        received: inputs.length,
        accepted,
        duplicates,
        rejected,
        latest: latest ? toResponse(latest) : null,
      },
    };
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
