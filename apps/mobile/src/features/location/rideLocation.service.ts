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

function finiteOrNull(value: unknown): number | null {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function toPoint(position: Position, appState: "foreground" | "background"): RapaGoLocationPoint {
  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracyMeters: finiteOrNull(position.coords.accuracy),
    headingDegrees: finiteOrNull(position.coords.heading),
    speedMetersPerSecond: finiteOrNull(position.coords.speed),
    altitudeMeters: finiteOrNull(position.coords.altitude),
    capturedAt: new Date(position.timestamp || Date.now()).toISOString(),
    source: Capacitor.isNativePlatform() ? "foreground_native" : "web",
    appState,
    sequenceNumber: null,
    isMocked: false,
  };
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
    const result = await apiClient.post<PointEnvelope>(
      `/rides/${encodeURIComponent(rideId)}/location`,
      point,
      { token: accessToken, timeoutMs: 10000 },
      0,
    );

    if (result.ok === false) {
      throw new Error(result.message ?? "No se pudo publicar la ubicación.");
    }

    return (result.data as PointEnvelope).data as RideLocationPointResponse;
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
