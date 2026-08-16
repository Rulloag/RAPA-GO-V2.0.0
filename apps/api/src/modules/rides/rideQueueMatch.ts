/**
 * Motor de elegibilidad puro para la Preasignación Encadenada de Viajes.
 *
 * Módulo puro: sin acceso a BD, red ni reloj del sistema (recibe `nowMs`
 * explícito) para que sea 100% testeable de forma determinista.
 *
 * Diseño en dos pasos, tal como fue pedido:
 *   1. FILTRO BARATO (`cheapGeoFilter`): distancia Haversine entre el
 *      destino del viaje A y el origen del viaje B. Sirve para descartar
 *      candidatos lejanos sin llamar a ningún proveedor externo.
 *   2. EVALUACIÓN DE FINALISTA (`evaluateQueueEligibility`): sólo se corre
 *      sobre candidatos que ya pasaron el filtro barato. Hoy el proyecto NO
 *      tiene integrado ningún proveedor de ETA de ruta real (Directions /
 *      Distance Matrix) — `estimateFare()` en rides.service.ts NUNCA calculó
 *      distancia real, sólo un heurístico de longitud de texto. Por lo tanto
 *      esta fase estima el ETA con distancia Haversine + velocidad promedio
 *      configurable, documentando la limitación explícitamente en vez de
 *      simular precisión que no existe. Cuando el proyecto integre un
 *      proveedor de rutas real, sólo debe reemplazarse `estimateEtaMinutes`.
 *
 * No confía en la UI: este motor es sólo scoring/elegibilidad. La invariante
 * dura (1 viaje activo + 1 en cola máximo) vive en driverStatus.repository.ts
 * (Fase 0) y no depende de nada de este archivo.
 */

export const QUEUE_MATCH_CONFIG = {
  /** Minutos máximos restantes del viaje A para considerar ofrecer B. */
  maxCurrentTripRemainingMin: 8,
  /** Distancia máxima (km) entre destino de A y origen de B, filtro barato. */
  maxPickupDistanceKm: 3,
  /** ETA máximo (min) estimado entre destino de A y origen de B. */
  maxPickupEtaMin: 10,
  /** Velocidad promedio urbana asumida (km/h) para estimar ETA sin proveedor real. */
  assumedAvgSpeedKmh: 22,
  /** Minutos fijos de margen (maniobras, semáforos) sumados a la estimación de ETA. */
  etaFixedOverheadMin: 2,
  /** Antigüedad máxima (segundos) de la última ubicación conocida del conductor. */
  maxLocationAgeSeconds: 120,
} as const;

export type QueueMatchConfig = typeof QUEUE_MATCH_CONFIG;

/** Estados de la ride A en los que SÍ tiene sentido ofrecer una ride B en cola. */
const ELIGIBLE_CURRENT_RIDE_STATUSES = ["driver_arrived", "in_progress"] as const;

export type DriverAvailabilityForMatch = "available" | "unavailable" | "busy";

export interface QueueMatchCurrentRide {
  status: string;
  destinationLat: number;
  destinationLng: number;
}

export interface QueueMatchNewRideRequest {
  id: string;
  originLat: number;
  originLng: number;
  vehicleCategory: string | null;
}

export interface QueueMatchDriverStatus {
  availability: DriverAvailabilityForMatch;
  currentRideId: string | null;
  queuedRideId: string | null;
  currentLat: number | null;
  currentLng: number | null;
  locationUpdatedAtMs: number | null;
  vehicleCategory: string | null;
}

export interface EvaluateQueueEligibilityInput {
  currentRide: QueueMatchCurrentRide;
  newRideRequest: QueueMatchNewRideRequest;
  driverStatus: QueueMatchDriverStatus;
  /** Minutos restantes estimados del viaje A (calculado fuera de este módulo, p. ej. por hora de llegada esperada). */
  currentTripRemainingMin: number;
  nowMs: number;
  config?: Partial<QueueMatchConfig>;
}

export interface QueueMatchMetrics {
  pickupDistanceKm: number;
  pickupEtaMin: number;
  currentTripRemainingMin: number;
  score: number | null;
}

export interface EvaluateQueueEligibilityResult {
  eligible: boolean;
  score: number | null;
  reasons: string[];
  metrics: QueueMatchMetrics;
}

/** Distancia Haversine en kilómetros. Filtro barato: sin red, sin BD. */
export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Estima el ETA (minutos) entre dos puntos sin proveedor de rutas real.
 * NO equivale a un ETA de ruta real (tráfico, calles, sentido único).
 * Documentado como limitación conocida de la V1.
 */
export function estimateEtaMinutes(
  distanceKm: number,
  config: QueueMatchConfig,
): number {
  const travelMin = (distanceKm / config.assumedAvgSpeedKmh) * 60;
  return travelMin + config.etaFixedOverheadMin;
}

/**
 * Filtro barato de geografía: ¿el origen de B está lo bastante cerca del
 * destino de A como para siquiera considerarlo candidato? Pensado para
 * correr sobre TODOS los conductores candidatos antes de cualquier cálculo
 * más caro.
 */
export function cheapGeoFilter(
  destinationA: { lat: number; lng: number },
  originB: { lat: number; lng: number },
  config: QueueMatchConfig = QUEUE_MATCH_CONFIG,
): { passes: boolean; distanceKm: number } {
  const distanceKm = haversineDistanceKm(
    destinationA.lat,
    destinationA.lng,
    originB.lat,
    originB.lng,
  );
  return { passes: distanceKm <= config.maxPickupDistanceKm, distanceKm };
}

/**
 * Evalúa si un conductor con un viaje activo (A) es elegible para recibir
 * una oferta en cola del viaje B, y calcula su score.
 *
 * Fórmula V1 (deliberadamente simple, pedida así explícitamente):
 *   score = remaining_trip_minutes + eta_destination_to_pickup
 * Menor score = mejor candidato (termina antes y/o queda más cerca).
 * La distancia es una CONDICIÓN de elegibilidad (filtro), no un tercer peso.
 */
export function evaluateQueueEligibility(
  input: EvaluateQueueEligibilityInput,
): EvaluateQueueEligibilityResult {
  const config: QueueMatchConfig = { ...QUEUE_MATCH_CONFIG, ...input.config };
  const reasons: string[] = [];

  const { currentRide, newRideRequest, driverStatus, currentTripRemainingMin, nowMs } = input;

  if (driverStatus.currentRideId == null) {
    reasons.push("NO_ACTIVE_RIDE");
  }

  if (driverStatus.queuedRideId != null) {
    reasons.push("ALREADY_HAS_QUEUED_RIDE");
  }

  if (driverStatus.availability === "unavailable") {
    reasons.push("DRIVER_UNAVAILABLE");
  }

  if (!ELIGIBLE_CURRENT_RIDE_STATUSES.includes(currentRide.status as (typeof ELIGIBLE_CURRENT_RIDE_STATUSES)[number])) {
    reasons.push("CURRENT_RIDE_STATUS_NOT_ELIGIBLE");
  }

  if (
    newRideRequest.vehicleCategory != null &&
    driverStatus.vehicleCategory != null &&
    newRideRequest.vehicleCategory !== driverStatus.vehicleCategory
  ) {
    // Informativo: NO bloquea elegibilidad. Las categorías advierten en UI,
    // nunca restringen ofertas en cola.
  }

  const locationAgeSeconds =
    driverStatus.locationUpdatedAtMs != null
      ? (nowMs - driverStatus.locationUpdatedAtMs) / 1000
      : Number.POSITIVE_INFINITY;

  if (
    driverStatus.currentLat == null ||
    driverStatus.currentLng == null ||
    locationAgeSeconds > config.maxLocationAgeSeconds
  ) {
    reasons.push("STALE_OR_MISSING_LOCATION");
  }

  if (currentTripRemainingMin > config.maxCurrentTripRemainingMin) {
    reasons.push("CURRENT_TRIP_REMAINING_TOO_LONG");
  }

  const { distanceKm: pickupDistanceKm } = cheapGeoFilter(
    { lat: currentRide.destinationLat, lng: currentRide.destinationLng },
    { lat: newRideRequest.originLat, lng: newRideRequest.originLng },
    config,
  );

  if (pickupDistanceKm > config.maxPickupDistanceKm) {
    reasons.push("PICKUP_DISTANCE_TOO_FAR");
  }

  const pickupEtaMin = estimateEtaMinutes(pickupDistanceKm, config);

  if (pickupEtaMin > config.maxPickupEtaMin) {
    reasons.push("PICKUP_ETA_TOO_LONG");
  }

  const eligible = reasons.length === 0;
  const score = eligible ? currentTripRemainingMin + pickupEtaMin : null;

  return {
    eligible,
    score,
    reasons,
    metrics: {
      pickupDistanceKm,
      pickupEtaMin,
      currentTripRemainingMin,
      score,
    },
  };
}
