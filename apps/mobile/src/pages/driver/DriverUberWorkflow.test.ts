/// <reference types="vite/client" />

import { describe, expect, it } from "vitest";

import driverSource from "./index.tsx?raw";

describe("flujo del conductor tipo Uber", () => {
  it("permite activar y probar avisos de nuevas solicitudes", () => {
    expect(driverSource).toContain("handleEnableDriverRideAlerts");
    expect(driverSource).toContain("Avisos de nuevos traslados");
    expect(driverSource).toContain("Notification.requestPermission()");
    expect(driverSource).toContain("primeDriverAlertAudio()");
    expect(driverSource).toContain("Probar sonido y avisos");
  });

  it("usa Solicitudes para aceptar, Viaje activo para operar y Viajes para historial", () => {
    const redirects =
      driverSource.match(/history\.replace\(ROUTES\.DRIVER\.ACTIVE_RIDE\)/g) ?? [];

    expect(redirects.length).toBeGreaterThanOrEqual(3);
    expect(driverSource).toContain('return <AssignedRidesPage mode="requests" />');
    expect(driverSource).toContain('return <AssignedRidesPage mode="active" />');
    expect(driverSource).toContain("El mapa y los controles están en una pantalla separada.");
    expect(driverSource).toContain(
      'new CustomEvent("rapago:driver-rides-updated"',
    );
  });
});
