/// <reference types="vite/client" />

import { describe, expect, it } from "vitest";

import tripsSource from "./TripsPage.tsx?raw";
import sharedSource from "../shared.ts?raw";

// Fase 5 — UI del pasajero B durante la preasignación encadenada. Mismo
// patrón que el resto de tests de esta página (aserciones sobre el código
// fuente vía `?raw`): el archivo es demasiado grande para montarlo completo.

describe("UI del pasajero — preasignación encadenada (Fase 5)", () => {
  it("TEST_1/TEST_2: sólo muestra el aviso de 'finalizando un viaje cercano' cuando assignmentMode === 'queued_offer', nunca en un accepted normal", () => {
    expect(tripsSource).toContain("isQueuedOfferAwaitingActivation");
    expect(tripsSource).toContain(
      'effectiveStatus === "accepted" &&\n    (ride as RideRequestData & Record<string, unknown>).assignmentMode === "queued_offer"',
    );
    expect(tripsSource).toContain("Tu conductor está finalizando un viaje cercano.");
  });

  it("TEST_3: muestra el tiempo estimado para recogerte cuando estimatedWaitMinutes está presente", () => {
    expect(tripsSource).toContain("ride.estimatedWaitMinutes != null");
    expect(tripsSource).toContain("Tiempo estimado para recogerte: ~");
  });

  it("TEST_4: nunca renderiza datos del viaje A — sólo usa campos agregados de B (estimatedWaitMinutes)", () => {
    expect(tripsSource).not.toContain("driverQueuedOffer.ride.passengerName");
    expect(tripsSource).not.toContain("currentRide.originText");
    expect(tripsSource).not.toContain("currentRide.destinationText");
  });

  it("TEST_5: mientras queued_offer, no muestra el mapa en vivo (evita insinuar que el conductor ya viene) — la transición a driver_en_route restaura el flujo normal automáticamente", () => {
    expect(tripsSource).toContain("!isQueuedOfferAwaitingActivation &&\n    passengerCanTrackDriver &&");
    // El label normal para driver_en_route sigue intacto y sin condicionar:
    expect(sharedSource).toContain('driver_en_route: "Tu conductor va en camino"');
  });

  it("el texto secundario deja explícito que el conductor aún no se dirige hacia el pasajero", () => {
    expect(tripsSource).toContain(
      "Tu conductor comenzará a dirigirse hacia ti cuando termine el viaje actual.",
    );
  });

  it("no declara un hook de polling adicional junto al cálculo del estado 'queued'", () => {
    const queuedBlockIndex = tripsSource.indexOf("isQueuedOfferAwaitingActivation =");
    const nearbySlice = tripsSource.slice(Math.max(0, queuedBlockIndex - 200), queuedBlockIndex);
    expect(nearbySlice).not.toContain("useEffect");
  });
});
