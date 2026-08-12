import { registerPlugin } from "@capacitor/core";

export interface NativeBackgroundLocationState {
  running: boolean;
  rideId: string | null;
  lastSentAt: string | null;
  lastError: string | null;
  /**
   * El nativo recibió un 401 `AUTH_TOKEN_EXPIRED`: sigue capturando y
   * encolando puntos, solo dejó de poder ENTREGARLOS hasta que llegue un
   * token nuevo. No confundir con `running: false` — el GPS sigue vivo.
   */
  authPaused: boolean;
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
  /**
   * Empuja un token nuevo al servicio nativo YA corriendo.
   *
   * Es un no-op seguro si nada está corriendo: el nativo no necesita el token
   * si no tiene nada que enviar. Nunca se le da el refresh token — solo el
   * access token, que ya expira en minutos si se filtra.
   */
  updateAccessToken(options: { accessToken: string }): Promise<void>;
}

export const NativeBackgroundLocation =
  registerPlugin<RapaGoBackgroundLocationPlugin>("RapaGoBackgroundLocation");
