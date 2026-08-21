import { describe, it, expect } from "vitest";
import {
  evaluateQueueEligibility,
  cheapGeoFilter,
  haversineDistanceKm,
  estimateEtaMinutes,
  QUEUE_MATCH_CONFIG,
  type EvaluateQueueEligibilityInput,
} from "../rideQueueMatch.js";

const NOW = 1_700_000_000_000;

// Santiago-ish coordinates, ~1km apart (destination A) and (origin B).
const DESTINATION_A = { lat: -33.4489, lng: -70.6693 };
const ORIGIN_B_NEAR = { lat: -33.4550, lng: -70.6650 }; // ~1km away
const ORIGIN_B_FAR = { lat: -33.6000, lng: -70.9000 }; // ~30km away

function baseInput(overrides: Partial<EvaluateQueueEligibilityInput> = {}): EvaluateQueueEligibilityInput {
  return {
    currentRide: {
      status: "in_progress",
      destinationLat: DESTINATION_A.lat,
      destinationLng: DESTINATION_A.lng,
    },
    newRideRequest: {
      id: "ride-b-1",
      originLat: ORIGIN_B_NEAR.lat,
      originLng: ORIGIN_B_NEAR.lng,
      vehicleCategory: null,
    },
    driverStatus: {
      availability: "busy",
      currentRideId: "ride-a-1",
      queuedRideId: null,
      currentLat: DESTINATION_A.lat,
      currentLng: DESTINATION_A.lng,
      locationUpdatedAtMs: NOW - 10_000,
      vehicleCategory: null,
    },
    currentTripRemainingMin: 5,
    nowMs: NOW,
    ...overrides,
  };
}

describe("rideQueueMatch — filtro barato (Haversine)", () => {
  it("calcula una distancia consistente y simétrica", () => {
    const d1 = haversineDistanceKm(DESTINATION_A.lat, DESTINATION_A.lng, ORIGIN_B_NEAR.lat, ORIGIN_B_NEAR.lng);
    const d2 = haversineDistanceKm(ORIGIN_B_NEAR.lat, ORIGIN_B_NEAR.lng, DESTINATION_A.lat, DESTINATION_A.lng);
    expect(d1).toBeCloseTo(d2, 9);
    expect(d1).toBeGreaterThan(0);
  });

  it("cheapGeoFilter pasa para puntos cercanos y rechaza puntos lejanos", () => {
    const near = cheapGeoFilter(DESTINATION_A, ORIGIN_B_NEAR);
    const far = cheapGeoFilter(DESTINATION_A, ORIGIN_B_FAR);
    expect(near.passes).toBe(true);
    expect(far.passes).toBe(false);
    expect(far.distanceKm).toBeGreaterThan(near.distanceKm);
  });

  it("estimateEtaMinutes NO es igual a la distancia Haversine (fórmulas distintas)", () => {
    const distanceKm = 3;
    const eta = estimateEtaMinutes(distanceKm, QUEUE_MATCH_CONFIG);
    expect(eta).not.toBe(distanceKm);
    expect(eta).toBeGreaterThan(distanceKm); // a esta velocidad, ETA en minutos > km
  });
});

describe("rideQueueMatch — evaluateQueueEligibility", () => {
  it("1. conductor sin viaje activo nunca es elegible", () => {
    const result = evaluateQueueEligibility(
      baseInput({ driverStatus: { ...baseInput().driverStatus, currentRideId: null } }),
    );
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("NO_ACTIVE_RIDE");
  });

  it("2. candidato cercano y dentro de todos los límites es elegible", () => {
    const result = evaluateQueueEligibility(baseInput());
    expect(result.eligible).toBe(true);
    expect(result.reasons).toEqual([]);
    expect(result.score).not.toBeNull();
  });

  it("3. candidato lejano (fuera del filtro de distancia) es rechazado", () => {
    const result = evaluateQueueEligibility(
      baseInput({
        newRideRequest: { id: "ride-b-far", originLat: ORIGIN_B_FAR.lat, originLng: ORIGIN_B_FAR.lng, vehicleCategory: null },
      }),
    );
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("PICKUP_DISTANCE_TOO_FAR");
    expect(result.score).toBeNull();
  });

  it("4. conductor con ride ya en cola es rechazado", () => {
    const result = evaluateQueueEligibility(
      baseInput({ driverStatus: { ...baseInput().driverStatus, queuedRideId: "already-queued" } }),
    );
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("ALREADY_HAS_QUEUED_RIDE");
  });

  it("5. conductor unavailable es rechazado", () => {
    const result = evaluateQueueEligibility(
      baseInput({ driverStatus: { ...baseInput().driverStatus, availability: "unavailable" } }),
    );
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("DRIVER_UNAVAILABLE");
  });

  it("6. categoría de vehículo incompatible SÍ bloquea ofertas en cola", () => {
    const result = evaluateQueueEligibility(
      baseInput({
        newRideRequest: { id: "ride-b-1", originLat: ORIGIN_B_NEAR.lat, originLng: ORIGIN_B_NEAR.lng, vehicleCategory: "xl" },
        driverStatus: { ...baseInput().driverStatus, vehicleCategory: "standard" },
      }),
    );
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("VEHICLE_CATEGORY_INELIGIBLE");
  });

  it("6b. multi-capability XL+Confort puede recibir XL en cola", () => {
    const result = evaluateQueueEligibility(
      baseInput({
        newRideRequest: {
          id: "ride-b-xl",
          originLat: ORIGIN_B_NEAR.lat,
          originLng: ORIGIN_B_NEAR.lng,
          vehicleCategory: "xl",
        },
        driverStatus: {
          ...baseInput().driverStatus,
          vehicleCategory: "standard",
          capabilities: {
            xl: true,
            extraLuggage: false,
            comfort: true,
            vehicleYear: 2024,
          },
        },
      }),
    );
    expect(result.eligible).toBe(true);
  });

  it("7. ubicación desactualizada (stale) es rechazada", () => {
    const result = evaluateQueueEligibility(
      baseInput({ driverStatus: { ...baseInput().driverStatus, locationUpdatedAtMs: NOW - 10 * 60 * 1000 } }),
    );
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("STALE_OR_MISSING_LOCATION");
  });

  it("8. tiempo restante del viaje A fuera de límite es rechazado", () => {
    const result = evaluateQueueEligibility(baseInput({ currentTripRemainingMin: 30 }));
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("CURRENT_TRIP_REMAINING_TOO_LONG");
  });

  it("9. estado de viaje A no elegible (p. ej. 'accepted') es rechazado", () => {
    const result = evaluateQueueEligibility(
      baseInput({ currentRide: { ...baseInput().currentRide, status: "accepted" } }),
    );
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("CURRENT_RIDE_STATUS_NOT_ELIGIBLE");
  });

  it("9b. estados 'driver_en_route', 'cancelled' y 'completed' tampoco son elegibles", () => {
    for (const status of ["driver_en_route", "cancelled", "completed"]) {
      const result = evaluateQueueEligibility(baseInput({ currentRide: { ...baseInput().currentRide, status } }));
      expect(result.eligible).toBe(false);
      expect(result.reasons).toContain("CURRENT_RIDE_STATUS_NOT_ELIGIBLE");
    }
  });

  it("9c. estados 'driver_arrived' e 'in_progress' SÍ son elegibles para el motor", () => {
    for (const status of ["driver_arrived", "in_progress"]) {
      const result = evaluateQueueEligibility(baseInput({ currentRide: { ...baseInput().currentRide, status } }));
      expect(result.reasons).not.toContain("CURRENT_RIDE_STATUS_NOT_ELIGIBLE");
    }
  });

  it("10. determinismo: mismas entradas producen siempre el mismo score", () => {
    const input = baseInput();
    const r1 = evaluateQueueEligibility(input);
    const r2 = evaluateQueueEligibility(input);
    expect(r1).toEqual(r2);
  });

  it("la fórmula de score es remaining_trip_minutes + eta_pickup (aditiva simple)", () => {
    const input = baseInput({ currentTripRemainingMin: 4 });
    const result = evaluateQueueEligibility(input);
    expect(result.eligible).toBe(true);
    expect(result.score).toBeCloseTo(4 + result.metrics.pickupEtaMin, 9);
  });

  it("config es sobreescribible sin mutar el default exportado", () => {
    const strict = baseInput({ config: { maxPickupDistanceKm: 0.1 } });
    const result = evaluateQueueEligibility(strict);
    expect(result.eligible).toBe(false);
    expect(QUEUE_MATCH_CONFIG.maxPickupDistanceKm).toBe(3);
  });
});
