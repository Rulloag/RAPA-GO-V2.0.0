export type RapaGoLocationSource =
  | "foreground_native"
  | "background_native"
  | "web";

export type RapaGoLocationAppState = "foreground" | "background";

export interface RapaGoLocationPoint {
  lat: number;
  lng: number;
  accuracyMeters: number | null;
  headingDegrees: number | null;
  speedMetersPerSecond: number | null;
  altitudeMeters: number | null;
  capturedAt: string;
  source: RapaGoLocationSource;
  appState: RapaGoLocationAppState;
  sequenceNumber: number | null;
  isMocked: boolean;
}

export interface RideLocationPointResponse extends RapaGoLocationPoint {
  id: string;
  rideId: string;
  driverUserId: string;
  receivedAt: string;
}

export interface RapaGoPermissionSnapshot {
  platform: "android" | "ios" | "web";
  foreground: "granted" | "denied" | "prompt" | "prompt-with-rationale";
  coarse: "granted" | "denied" | "prompt" | "prompt-with-rationale";
  background: "granted" | "denied" | "not-applicable" | "unknown";
  notifications: "granted" | "denied" | "not-applicable" | "unknown";
  locationServicesEnabled: boolean | null;
}
