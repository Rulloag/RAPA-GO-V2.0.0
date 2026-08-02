/// <reference types="vite/client" />

import { describe, expect, it } from "vitest";

import locationSource from "../../../features/location/rideLocation.service.ts?raw";
import ridesSource from "../../../features/rides/rides.service.ts?raw";
import tripsSource from "./TripsPage.tsx?raw";

describe("errores de producción del mapa", () => {
  it("sanea precisión, rumbo y velocidad antes de publicar", () => {
    expect(locationSource).toContain("sanitizeLocationPoint");
    expect(locationSource).toContain("LOCATION_LIMITS");
    expect(locationSource).toContain("const safePoint = sanitizeLocationPoint(point)");
  });

  it("conserva statusCode y code en los errores de cancelación", () => {
    expect(ridesSource).toContain("createRideServiceError");
    expect(ridesSource).toContain("error.statusCode = failure.statusCode");
    expect(ridesSource).toContain("error.code = failure.code");
  });

  it("reintenta el endpoint alternativo solamente ante conflicto 409", () => {
    expect(tripsSource).toContain("cancelPassengerRideUsingBackendState");
    expect(tripsSource).toContain("details?.statusCode === 409");
    expect(tripsSource).toContain('details?.code === "RIDE_CANNOT_CANCEL"');
  });
});
