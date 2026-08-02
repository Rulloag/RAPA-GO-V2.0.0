/// <reference types="vite/client" />

import { describe, expect, it } from "vitest";

import driverSource from "../../driver/index.tsx?raw";
import passengerSource from "./TripsPage.tsx?raw";

describe("seguimiento real del vehículo para el pasajero", () => {
  it("consulta el endpoint real location/latest mediante rideLocationService", () => {
    expect(passengerSource).toContain(
      "rideLocationService.latest(token, rideId)",
    );
    expect(passengerSource).not.toContain(
      "/api/rides/${encodeURIComponent(rideId)}/live",
    );
    expect(passengerSource).not.toContain("VITE_RAPAGO_LIVE_DRIVER");
  });

  it("limita el puente local al modo de desarrollo", () => {
    expect(passengerSource).toContain("if (!import.meta.env.DEV) return;");
    expect(passengerSource).toContain(
      "const developmentFallback = import.meta.env.DEV",
    );
  });

  it("muestra un vehículo orientado en vez de una flecha genérica", () => {
    expect(passengerSource).toContain("function makeDriverVehicleIcon");
    expect(passengerSource).toContain("M -8 -14 C -6 -18");
    expect(passengerSource).not.toContain(
      "path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW",
    );
  });

  it("cambia el objetivo desde la recogida hacia el destino al iniciar el viaje", () => {
    expect(passengerSource).toContain(
      'const routeDestination = effectiveMapStatus === "in_progress" ? destination : pickup;',
    );
  });
});

describe("publicación real del GPS del conductor", () => {
  it("inicia GPS foreground y publica cada punto en el backend", () => {
    expect(driverSource).toContain("rideLocationService.watch(");
    expect(driverSource).toContain(
      "await rideLocationService.publish(accessToken, rideId, point)",
    );
  });

  it("activa y detiene el seguimiento nativo en segundo plano", () => {
    expect(driverSource).toContain(
      "rideLocationService.startNativeBackground(",
    );
    expect(driverSource).toContain(
      "rideLocationService.stopNativeBackground()",
    );
  });
});
