import { describe, expect, it } from "vitest";
import tripsSource from "./TripsPage.tsx?raw";

describe("RapaGo más veloz — pasajero efectivo y Klap", () => {
  it("tarjeta retiene $800 en Klap y efectivo activa el recargo sin checkout", () => {
    expect(tripsSource).toContain('createKlapHostedOrder(');
    expect(tripsSource).toContain('"fast_search"');
    expect(tripsSource).toContain("openKlapHostedCheckout(redirectUrl)");
    expect(tripsSource).toContain("requestPassengerFastSearch(ride, accessToken)");
    expect(tripsSource).toContain('applyPassengerFastSearchApprovedLocally(ride, "cash")');
    expect(tripsSource).toContain("Pagar {formatClp(RAPAGO_FAST_SEARCH_FEE_CLP)} con Klap");
    expect(tripsSource).toContain("Sí, activar por {formatClp(RAPAGO_FAST_SEARCH_FEE_CLP)}");
    expect(tripsSource).not.toContain("No disponible para Klap");
  });
});
