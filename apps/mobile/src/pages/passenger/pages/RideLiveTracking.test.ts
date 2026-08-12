/// <reference types="vite/client" />

import { describe, expect, it } from "vitest";

import coordinatorSource from "../../../features/location/rideTrackingCoordinator.ts?raw";
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

  it("muestra un vehículo SVG reconocible y orientado", () => {
    expect(passengerSource).toContain("function makeDriverVehicleIcon");
    expect(passengerSource).toContain("data:image/svg+xml");
    expect(passengerSource).toContain('class="rapago-driver-car"');
    expect(passengerSource).toContain('fill="#111827"');
    expect(passengerSource).toContain('fill="#fde047"');
    expect(passengerSource).not.toContain(
      "path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW",
    );
  });

  it("muestra el estado del conductor con contraste legible", () => {
    expect(passengerSource).toContain(
      'data-rapago-driver-map-status="true"',
    );
    expect(passengerSource).toContain(
      'background: "rgba(255,255,255,.97)"',
    );
    expect(passengerSource).toContain(
      'WebkitTextFillColor: "#111827"',
    );
    expect(passengerSource).toContain("GPS EN VIVO");
  });

  it("cambia el objetivo desde la recogida hacia el destino al iniciar el viaje", () => {
    expect(passengerSource).toContain(
      'const routeDestination = effectiveMapStatus === "in_progress" ? destination : pickup;',
    );
  });
});

/**
 * El dueño del GPS dejó de ser la página del conductor.
 *
 * Antes estas comprobaciones miraban `driver/index.tsx`, porque allí vivía el
 * ciclo de vida del seguimiento. Eso era justamente el bug: la página se
 * desmontaba al cambiar de pestaña y mataba el servicio nativo. Ahora el dueño
 * es `rideTrackingCoordinator`, un módulo sin `unmount`, y es ahí donde hay que
 * garantizar que el GPS se arranca y se publica de verdad.
 *
 * Que la página YA NO lo haga lo cubre `singleOwner.arch.test.ts`.
 */
describe("publicación real del GPS del conductor", () => {
  it("inicia GPS foreground y publica cada punto en el backend", () => {
    expect(coordinatorSource).toContain("rideLocationService.watch(");
    // El coordinador extrae rideId/accessToken a variables locales antes de
    // llamar a publish, para que la cola offline pueda capturarlos en el
    // closure del .catch() sin arrastrar todo el objeto `current`.
    expect(coordinatorSource).toContain(
      ".publish(accessToken, rideId, point)",
    );
  });

  it("activa y detiene el seguimiento nativo en segundo plano", () => {
    expect(coordinatorSource).toContain(
      "rideLocationService.startNativeBackground(",
    );
    expect(coordinatorSource).toContain(
      "rideLocationService.stopNativeBackground()",
    );
  });
});
