import { describe, expect, it } from "vitest";

import {
  MAX_LOCATION_BATCH_POINTS,
  rideLocationBatchSchema,
  rideLocationUpdateSchema,
} from "../rideTracking.schemas.js";

const basePoint = {
  lat: -33.49,
  lng: -71.15,
  capturedAt: "2026-08-02T15:24:25.530Z",
  source: "web" as const,
  appState: "foreground" as const,
  isMocked: false,
};

describe("rideLocationUpdateSchema", () => {
  it("acepta GPS web impreciso sin rechazar la ubicación", () => {
    const parsed = rideLocationUpdateSchema.parse({
      ...basePoint,
      accuracyMeters: 50000,
    });

    expect(parsed.accuracyMeters).toBeNull();
  });

  it("normaliza rumbo y velocidad inválidos a null", () => {
    const parsed = rideLocationUpdateSchema.parse({
      ...basePoint,
      headingDegrees: -1,
      speedMetersPerSecond: -1,
    });

    expect(parsed.headingDegrees).toBeNull();
    expect(parsed.speedMetersPerSecond).toBeNull();
  });

  it("mantiene estrictas las coordenadas principales", () => {
    expect(() =>
      rideLocationUpdateSchema.parse({
        ...basePoint,
        lat: 120,
      }),
    ).toThrow();
  });
});

describe("rideLocationBatchSchema", () => {
  it("acepta un lote en el tope exacto", () => {
    const parsed = rideLocationBatchSchema.parse({
      points: Array.from({ length: MAX_LOCATION_BATCH_POINTS }, () => basePoint),
    });

    expect(parsed.points).toHaveLength(MAX_LOCATION_BATCH_POINTS);
  });

  it("rechaza un lote por encima del tope", () => {
    // Sin esto, un cliente roto podría mandar su cola entera en una petición.
    expect(() =>
      rideLocationBatchSchema.parse({
        points: Array.from(
          { length: MAX_LOCATION_BATCH_POINTS + 1 },
          () => basePoint,
        ),
      }),
    ).toThrow();
  });

  it("rechaza un lote vacío", () => {
    expect(() => rideLocationBatchSchema.parse({ points: [] })).toThrow();
  });

  it("aplica la misma sanitización a cada punto del lote", () => {
    const parsed = rideLocationBatchSchema.parse({
      points: [{ ...basePoint, accuracyMeters: 50000, headingDegrees: -1 }],
    });

    expect(parsed.points[0]?.accuracyMeters).toBeNull();
    expect(parsed.points[0]?.headingDegrees).toBeNull();
  });
});
