/// <reference types="vite/client" />

import { describe, expect, it } from "vitest";

import requestSource from "./RequestRidePage.tsx?raw";
import tripsSource from "./TripsPage.tsx?raw";

describe("redirección y sincronización automática de viajes", () => {
  it("reemplaza la pantalla de solicitud por Mis Viajes al crear un viaje", () => {
    expect(requestSource).toContain("goToTripsAfterRequest");
    expect(requestSource).toContain(
      "history.replace(ROUTES.PASSENGER.TRIPS)",
    );
    expect(requestSource).toContain(
      'source: "request-ride-created"',
    );
    expect(requestSource).not.toContain(
      'history.push("/passenger/trips")',
    );
  });

  it("actualiza viajes activos cada 2,5 segundos sin bloquear la pantalla", () => {
    expect(tripsSource).toContain(
      "const PASSENGER_ACTIVE_POLL_INTERVAL_MS = 2500",
    );
    expect(tripsSource).toContain(
      "void loadRides({ silent: true })",
    );
    expect(tripsSource).toContain(
      "document.visibilityState !== \"visible\"",
    );
    expect(tripsSource).toContain(
      'window.addEventListener("focus", refreshSilently)',
    );
  });

  it("evita solicitudes de actualización superpuestas", () => {
    expect(tripsSource).toContain("loadRidesInFlightRef");
    expect(tripsSource).toContain(
      "if (loadRidesInFlightRef.current) return",
    );
  });

  it("elimina únicamente el polling anterior de diez minutos", () => {
    expect(tripsSource).not.toMatch(
      /const interval = window\.setInterval\(\(\) => \{\s*cleanupExpiredCancelledRidesEverywhere\(\);\s*void loadRides\(\);\s*\}, 10 \* 60 \* 1000\);/,
    );
    expect(tripsSource).toContain(
      "PASSENGER_ACTIVE_POLL_INTERVAL_MS = 2500",
    );
    expect(tripsSource).toContain(
      "PASSENGER_IDLE_POLL_INTERVAL_MS",
    );
  });
});
