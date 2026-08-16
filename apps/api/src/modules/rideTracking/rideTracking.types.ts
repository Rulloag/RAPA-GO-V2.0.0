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

/** Motivo por el que un punto concreto del lote no se guardó. */
export type RideLocationRejectionCode =
  | "TOO_CLOSE"
  | "FUTURE_TIMESTAMP"
  | "OUT_OF_RIDE_WINDOW"
  | "INVALID_POINT"
  | "GPS_OUTLIER";

export interface RideLocationBatchRejection {
  /** Posición en el array `points` tal como lo mandó el cliente. */
  index: number;
  code: RideLocationRejectionCode;
}

/**
 * El éxito parcial es de diseño: un lote puede traer puntos perfectamente
 * válidos junto a otros irrecuperables (reloj desfasado, ruido de GPS). Se
 * responde 200 y el cliente borra de su cola TODO lo enviado, porque un punto
 * rechazable para siempre bloquearía la cabeza de la cola indefinidamente.
 */
export interface RideLocationBatchResult {
  received: number;
  accepted: number;
  /** Ya estaban en la base: reenvío tras un 2xx perdido. No son un error. */
  duplicates: number;
  rejected: RideLocationBatchRejection[];
  latest: RideLocationPointResponse | null;
}

export type RideTrackingResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string; statusCode: number };
