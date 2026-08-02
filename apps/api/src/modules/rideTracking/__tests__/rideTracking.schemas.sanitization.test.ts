import { describe, expect, it } from "vitest";

import { rideLocationUpdateSchema } from "../rideTracking.schemas.js";

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
