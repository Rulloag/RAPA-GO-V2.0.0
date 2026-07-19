import { registerPlugin } from "@capacitor/core";

export interface NativeBackgroundLocationState {
  running: boolean;
  rideId: string | null;
  lastSentAt: string | null;
  lastError: string | null;
}

export interface NativeBackgroundPermissionState {
  foreground: "granted" | "denied" | "prompt" | "prompt-with-rationale";
  background: "granted" | "denied" | "unknown";
  notifications: "granted" | "denied" | "unknown";
  locationServicesEnabled: boolean;
}

export interface StartNativeTrackingOptions {
  rideId: string;
  accessToken: string;
  apiBaseUrl: string;
  minUpdateIntervalMs?: number;
  minDistanceMeters?: number;
}

interface RapaGoBackgroundLocationPlugin {
  getPermissionState(): Promise<NativeBackgroundPermissionState>;
  requestForegroundPermission(): Promise<NativeBackgroundPermissionState>;
  requestBackgroundPermission(): Promise<NativeBackgroundPermissionState>;
  requestNotificationPermission(): Promise<NativeBackgroundPermissionState>;
  openAppSettings(): Promise<void>;
  startTracking(options: StartNativeTrackingOptions): Promise<NativeBackgroundLocationState>;
  stopTracking(): Promise<NativeBackgroundLocationState>;
  getState(): Promise<NativeBackgroundLocationState>;
}

export const NativeBackgroundLocation =
  registerPlugin<RapaGoBackgroundLocationPlugin>("RapaGoBackgroundLocation");
