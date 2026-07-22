export type RideLocationSource =
  | "foreground_native"
  | "background_native"
  | "web";

export type RideLocationAppState = "foreground" | "background";

export interface RideLocationPointResponse {
  id: string;
  rideId: string;
  driverUserId: string;
  lat: number;
  lng: number;
  accuracyMeters: number | null;
  headingDegrees: number | null;
  speedMetersPerSecond: number | null;
  altitudeMeters: number | null;
  capturedAt: string;
  receivedAt: string;
  source: RideLocationSource;
  appState: RideLocationAppState;
  sequenceNumber: number | null;
}

export type RideTrackingResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string; statusCode: number };
