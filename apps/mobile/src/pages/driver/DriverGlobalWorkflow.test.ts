/// <reference types="vite/client" />

import { describe, expect, it } from "vitest";

import driverSource from "./index.tsx?raw";
import layoutSource from "../../layouts/DriverLayout.tsx?raw";
import routesSource from "../../navigation/routes.ts?raw";
import locationRuntimeSource from "../../features/location/DriverLocationRuntime.tsx?raw";
describe("flujo global y mapa grande del conductor", () => {
  it("mantiene una alerta global sin boton X y exige aceptar o rechazar", () => {
    expect(layoutSource.match(/<DriverGlobalRideAlert \/>/g) ?? []).toHaveLength(1);
    expect(driverSource).toContain("Este aviso permanece hasta que aceptes, rechaces o la solicitud expire.");
    expect(driverSource).not.toContain('aria-label="Cerrar alerta de viaje"');
    expect(driverSource).not.toContain('aria-label="Cerrar solicitud"');
    expect(driverSource).toContain("Rechazar");
    expect(driverSource).toContain("Aceptar viaje");
  });

  it("separa solicitudes, viaje activo e historial", () => {
    expect(routesSource).toContain('ACTIVE_RIDE: "/driver/active-ride"');
    expect(layoutSource).toContain("DriverActiveRidePage");
    expect(layoutSource).toContain("ROUTES.DRIVER.ACTIVE_RIDE");
    expect(driverSource).toContain('mode?: "requests" | "active"');
    expect(driverSource).toContain("Tienes un viaje activo");
    expect(driverSource).toContain("Abrir mapa");
  });

  it("abre el mapa grande al aceptar", () => {
    expect((driverSource.match(/ROUTES\.DRIVER\.ACTIVE_RIDE/g) ?? []).length).toBeGreaterThanOrEqual(6);
    expect(driverSource.match(/history\.replace\(ROUTES\.DRIVER\.ACTIVE_RIDE\)/g) ?? [])
      .toHaveLength(3);
    expect(driverSource).toContain("history.replace(activeAccepted ? ROUTES.DRIVER.ACTIVE_RIDE");
    expect(driverSource).toContain('<UberDriverNavigationMap');
    expect(driverSource).toContain('height="100%"');
  });

  it("permite aceptar sin GPS y solicita ubicacion solo con viaje activo", () => {
    expect(driverSource).not.toContain('setError("Activa tu ubicación real para tomar este viaje.")');
    expect(driverSource).toContain("const acceptedLocation = driverLocationRef.current ?? driverLocation;");
    expect(locationRuntimeSource).toContain("Boolean(activeRide)");
    expect(locationRuntimeSource).toContain("!isDriver || !activeRide || !foregroundGranted(permissions)");
    expect(locationRuntimeSource).toContain("Aceptaste un viaje. Activa el GPS");
  });

  it("muestra el estado de red completo y con tono visible", () => {
    expect(driverSource).toContain('? "Activo"');
    expect(driverSource).toContain('? "Reconectando"');
    expect(driverSource).toContain(': "Sin conexión"');
    expect(driverSource).toContain("driver-home-metric--network is-${driverConnection.status}");
    expect(driverSource).toContain('driverConnection.status === "online"');
    expect(driverSource).toContain('driverConnection.status === "checking"');
    expect(driverSource).toContain('driverConnection.status === "poor"');
  });
});
