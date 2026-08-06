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

  it("usa Solicitudes para aceptar y Viajes para operar", () => {
    const redirects =
      driverSource.match(/history\.replace\(ROUTES\.DRIVER\.TRIPS\)/g) ?? [];

    expect(redirects.length).toBeGreaterThanOrEqual(3);
    expect(driverSource).toContain(
      "Solicitudes solo recibe y acepta ofertas.",
    );
    expect(driverSource).toContain(
      'new CustomEvent("rapago:driver-rides-updated"',
    );
  });
});
