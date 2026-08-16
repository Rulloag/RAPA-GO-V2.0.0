/// <reference types="vite/client" />

import { describe, expect, it } from "vitest";

import tripsSource from "./TripsPage.tsx?raw";

describe("experiencia del pasajero tipo Uber", () => {
  it("abre la calificación al finalizar y permite omitir por ahora", () => {
    expect(tripsSource).toContain(
      "RAPAGO_PASSENGER_AUTO_RATING_MAX_AGE_MS",
    );
    expect(tripsSource).toContain(
      'getEffectivePassengerRideStatus(ride) !== "completed"',
    );
    expect(tripsSource).toContain("openPassengerRating(candidate.id)");
    expect(tripsSource).toContain("Omitir por ahora");
    expect(tripsSource).toContain("rememberPassengerDismissedRatingRide");
  });

  it("identifica tipo, color, foto, modelo y patente del vehículo", () => {
    expect(tripsSource).toContain("getPassengerVehicleHumanDescription");
    expect(tripsSource).toContain('if (type === "pickup") return "Camioneta"');
    expect(tripsSource).toContain('plata: ["plateado", "plateada"]');
    expect(tripsSource).toContain("hasRealVehicleImage");
    expect(tripsSource).toContain("Foto del vehículo");
    expect(tripsSource).toContain("plateText");
  });

  it("protege y mejora el seguimiento GPS del vehículo", () => {
    expect(tripsSource).toContain("PASSENGER_RAPA_NUI_LIVE_BOUNDS");
    expect(tripsSource).toContain("accuracy > 250");
    expect(tripsSource).toContain("setFollowDriver(false)");
    expect(tripsSource).toContain("Centrar vehículo");
    expect(tripsSource).toContain("Actualizado hace");
    expect(tripsSource).toContain("SEÑAL ANTIGUA");
    expect(tripsSource).toContain("now - lastRouteRequestAtRef.current < 12_000");
  });

  it("no abre el diálogo de devolución al cancelar y no llama Cancelar/devolución al botón activo", () => {
    expect(tripsSource).toContain("AUTO_SHOW_CARD_REFUND_ALERT = false");
    expect(tripsSource).toContain("openRapaGoCardCancelRefundWhatsApp(ride)");
    expect(tripsSource).toContain("shouldShowRapaGoCardCancelRefundButton");
    expect(tripsSource).toContain('if (provider.includes("klap")) return false');
    expect(tripsSource).not.toMatch(
      /\? "Cancelar\/devolución" : "Cancelar viaje"/,
    );
  });
});
