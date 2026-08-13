import { describe, expect, it } from "vitest";
import requestRideSource from "../../../pages/passenger/pages/RequestRidePage.tsx?raw";

describe("Reserva Mataveri + collares", () => {
  it("usa una única ubicación fija de Mataveri para la reserva", () => {
    expect(requestRideSource).toContain('text: "Aeropuerto Internacional Mataveri"');
    expect(requestRideSource).toContain("lat: -27.16472");
    expect(requestRideSource).toContain("lng: -109.42167");
    expect(requestRideSource).toContain("applyRapaNuiAirportOrigin()");
  });

  it("permite indicar la cantidad de collares y multiplica el precio unitario", () => {
    expect(requestRideSource).toContain("flowerLeiQuantity");
    expect(requestRideSource).toContain("¿Para cuántas personas?");
    expect(requestRideSource).toContain(
      "AIRPORT_FLOWER_LEI_SURCHARGE_CLP * normalizedFlowerLeiQuantity",
    );
    expect(requestRideSource).toMatch(
      /flowerLeiQuantity:\s*hasAirportFlowerLei\s*\?\s*normalizedFlowerLeiQuantity\s*:\s*null/,
    );
  });

  it("mantiene el collar desactivado fuera de la selección flower_lei", () => {
    expect(requestRideSource).toContain(
      'airportWelcomeOption === "flower_lei"',
    );
    expect(requestRideSource).toContain('setAirportWelcomeOption("none")');
    expect(requestRideSource).toContain("setFlowerLeiQuantity(1)");
  });
});
