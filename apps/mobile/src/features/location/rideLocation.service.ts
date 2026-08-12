import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import {
  Geolocation,
  type CallbackID,
  type Position,
} from "@capacitor/geolocation";
import { apiClient } from "../../services/api/index.js";
import { NativeBackgroundLocation } from "./nativeBackgroundLocation.plugin.js";
import type {
  RapaGoLocationPoint,
  RideLocationPointResponse,
} from "./location.types.js";

const API_BASE_URL = (import.meta.env["VITE_API_BASE_URL"] as string | undefined) ?? "";

function nativeApiBaseUrl(): string {
  const trimmed = API_BASE_URL.replace(/\/$/, "");
  if (trimmed.endsWith("/api")) return trimmed.slice(0, -4);
  return trimmed;
}

const LOCATION_LIMITS = {
  accuracyMeters: { min: 0, max: 10000 },
  headingDegrees: { min: 0, max: 360 },
  speedMetersPerSecond: { min: 0, max: 150 },
} as const;

function finiteNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function boundedMetricOrNull(
  value: unknown,
  min: number,
  max: number,
): number | null {
  const numberValue = finiteNumberOrNull(value);
  if (numberValue === null) return null;
  return numberValue >= min && numberValue <= max ? numberValue : null;
}

function sanitizeLocationPoint(
  point: RapaGoLocationPoint,
): RapaGoLocationPoint {
  return {
    ...point,
    accuracyMeters: boundedMetricOrNull(
      point.accuracyMeters,
      LOCATION_LIMITS.accuracyMeters.min,
      LOCATION_LIMITS.accuracyMeters.max,
    ),
    headingDegrees: boundedMetricOrNull(
      point.headingDegrees,
      LOCATION_LIMITS.headingDegrees.min,
      LOCATION_LIMITS.headingDegrees.max,
    ),
    speedMetersPerSecond: boundedMetricOrNull(
      point.speedMetersPerSecond,
      LOCATION_LIMITS.speedMetersPerSecond.min,
      LOCATION_LIMITS.speedMetersPerSecond.max,
    ),
    altitudeMeters: finiteNumberOrNull(point.altitudeMeters),
  };
}

function toPoint(position: Position, appState: "foreground" | "background"): RapaGoLocationPoint {
  return sanitizeLocationPoint({
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracyMeters: position.coords.accuracy,
    headingDegrees: position.coords.heading,
    speedMetersPerSecond: position.coords.speed,
    altitudeMeters: position.coords.altitude,
    capturedAt: new Date(position.timestamp || Date.now()).toISOString(),
    source: Capacitor.isNativePlatform() ? "foreground_native" : "web",
    appState,
    sequenceNumber: null,
    isMocked: false,
  });
}

type PointEnvelope = {
  ok: true;
  data: RideLocationPointResponse | null;
  statusCode: number;
};

type RouteEnvelope = {
  ok: true;
  data: RideLocationPointResponse[];
  statusCode: number;
};

type BatchEnvelope = {
  ok: true;
  data: {
    received: number;
    accepted: number;
    duplicates: number;
    rejected: { index: number; code: string }[];
    latest: RideLocationPointResponse | null;
  };
  statusCode: number;
};

export interface LocationBatchOutcome {
  /**
   * Si el cliente debe BORRAR de su cola los puntos que acaba de enviar.
   *
   * Es la regla más importante del diseño de la cola: se drena con cualquier
   * 2xx (aunque el servidor haya rechazado puntos concretos) y también con los
   * errores permanentes, porque reintentarlos no cambiará nada. Si un punto
   * irrecuperable se conservara, bloquearía la cabeza de la cola para siempre.
   */
  drain: boolean;
  statusCode: number;
  accepted: number;
  duplicates: number;
  rejected: number;
}

/** Errores que no mejoran reintentando: el punto nunca va a entrar. */
const PERMANENT_BATCH_STATUSES = new Set([400, 403, 404, 409]);

export const rideLocationService = {
  async current(): Promise<RapaGoLocationPoint> {
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 5000,
    });

    return toPoint(position, "foreground");
  },

  async watch(
    onPoint: (point: RapaGoLocationPoint) => void,
    onError: (message: string) => void,
  ): Promise<() => Promise<void>> {
    let currentAppState: "foreground" | "background" = "foreground";
    const appListener = await App.addListener("appStateChange", ({ isActive }) => {
      currentAppState = isActive ? "foreground" : "background";
    });

    let watchId: CallbackID | null = null;
    try {
      watchId = await Geolocation.watchPosition(
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 3000,
          minimumUpdateInterval: 2000,
        },
        (position, error) => {
          if (error) {
            onError(error.message || "No se pudo obtener la ubicación.");
            return;
          }
          if (position) onPoint(toPoint(position, currentAppState));
        },
      );
    } catch (error) {
      appListener.remove();
      throw error;
    }

    return async () => {
      appListener.remove();
      if (watchId !== null) {
        await Geolocation.clearWatch({ id: watchId });
      }
    };
  },

  async publish(
    accessToken: string,
    rideId: string,
    point: RapaGoLocationPoint,
  ): Promise<RideLocationPointResponse> {
    const safePoint = sanitizeLocationPoint(point);
    const result = await apiClient.post<PointEnvelope>(
      `/rides/${encodeURIComponent(rideId)}/location`,
      safePoint,
      { token: accessToken, timeoutMs: 10000 },
      0,
    );

    if (result.ok === false) {
      throw new Error(result.message ?? "No se pudo publicar la ubicación.");
    }

    return (result.data as PointEnvelope).data as RideLocationPointResponse;
  },

  /**
   * Envía un lote acumulado sin señal.
   *
   * A diferencia de `publish`, NUNCA lanza: quien drena una cola necesita
   * distinguir "esto ya no sirve, bórralo" de "vuelve a intentarlo luego", y
   * una excepción borra esa distinción. Tampoco reintenta por dentro — el
   * drenador aplica su propio backoff, y reintentar aquí retrasaría el envío
   * del siguiente lote.
   */
  async publishBatch(
    accessToken: string,
    rideId: string,
    points: RapaGoLocationPoint[],
  ): Promise<LocationBatchOutcome> {
    const safePoints = points.map(sanitizeLocationPoint);

    const result = await apiClient.post<BatchEnvelope>(
      `/rides/${encodeURIComponent(rideId)}/location/batch`,
      { points: safePoints },
      { token: accessToken, timeoutMs: 20000 },
      0,
    );

    if (result.ok === false) {
      return {
        drain: PERMANENT_BATCH_STATUSES.has(result.statusCode),
        statusCode: result.statusCode,
        accepted: 0,
        duplicates: 0,
        rejected: 0,
      };
    }

    const data = (result.data as BatchEnvelope).data;

    return {
      drain: true,
      statusCode: result.statusCode,
      accepted: data?.accepted ?? 0,
      duplicates: data?.duplicates ?? 0,
      rejected: data?.rejected?.length ?? 0,
    };
  },

  async latest(
    accessToken: string,
    rideId: string,
  ): Promise<RideLocationPointResponse | null> {
    const result = await apiClient.get<PointEnvelope>(
      `/rides/${encodeURIComponent(rideId)}/location/latest`,
      { token: accessToken, timeoutMs: 10000 },
    );

    if (result.ok === false) {
      throw new Error(result.message ?? "No se pudo consultar la ubicación.");
    }

    return (result.data as PointEnvelope).data;
  },

  async route(
    accessToken: string,
    rideId: string,
    limit = 500,
  ): Promise<RideLocationPointResponse[]> {
    const safeLimit = Math.min(1000, Math.max(1, Math.trunc(limit)));
    const result = await apiClient.get<RouteEnvelope>(
      `/rides/${encodeURIComponent(rideId)}/location/route?limit=${safeLimit}`,
      { token: accessToken, timeoutMs: 15000 },
    );

    if (result.ok === false) {
      throw new Error(result.message ?? "No se pudo consultar la ruta.");
    }

    return (result.data as RouteEnvelope).data;
  },

  async startNativeBackground(
    accessToken: string,
    rideId: string,
  ): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    const baseUrl = nativeApiBaseUrl();
    if (!baseUrl) {
      throw new Error("VITE_API_BASE_URL no está configurada para seguimiento nativo.");
    }

    await NativeBackgroundLocation.startTracking({
      rideId,
      accessToken,
      apiBaseUrl: baseUrl,
      minUpdateIntervalMs: 4000,
      minDistanceMeters: 5,
    });
  },

  async stopNativeBackground(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await NativeBackgroundLocation.stopTracking();
    } catch {
      // No bloquea el cierre del viaje.
    }
  },
};
