/// <reference types="vite/client" />

import { describe, expect, it } from "vitest";

import {
  isKlapPaymentConfirmedStatus,
  isKlapPaymentRejectedStatus,
} from "./TripsPage.tsx";
import tripsSource from "./TripsPage.tsx?raw";

// Cubre el defecto visual real reportado (pago Klap real $500, 13/08/2026):
// con KLAP_DEFERRED_CAPTURE_ENABLED activo, payments.status queda en
// "authorized" tras el webhook, y el polling post-checkout de TripsPage no
// lo reconocía como confirmado — el aviso "Confirmando tu pago Klap" quedaba
// huérfano en pantalla aunque el backend ya había activado el ride.
describe("clasificación de status en el polling post-checkout de Klap", () => {
  it("trata success como confirmado (comportamiento previo, sin cambios)", () => {
    expect(isKlapPaymentConfirmedStatus("success")).toBe(true);
  });

  it("trata authorized como confirmado (captura diferida — el fix)", () => {
    expect(isKlapPaymentConfirmedStatus("authorized")).toBe(true);
  });

  it("no trata pending como confirmado", () => {
    expect(isKlapPaymentConfirmedStatus("pending")).toBe(false);
  });

  it("no trata processing como confirmado", () => {
    expect(isKlapPaymentConfirmedStatus("processing")).toBe(false);
  });

  it("sigue tratando rejected como rechazo", () => {
    expect(isKlapPaymentRejectedStatus("rejected")).toBe(true);
  });

  it("sigue tratando failed como rechazo", () => {
    expect(isKlapPaymentRejectedStatus("failed")).toBe(true);
  });

  it("sigue tratando refunded como rechazo", () => {
    expect(isKlapPaymentRejectedStatus("refunded")).toBe(true);
  });

  it("authorized nunca cae también en la clasificación de rechazo", () => {
    expect(isKlapPaymentRejectedStatus("authorized")).toBe(false);
  });

  it("success nunca cae en la clasificación de rechazo", () => {
    expect(isKlapPaymentRejectedStatus("success")).toBe(false);
  });

  it("pending no es ni confirmado ni rechazado — sigue pendiente", () => {
    expect(isKlapPaymentConfirmedStatus("pending")).toBe(false);
    expect(isKlapPaymentRejectedStatus("pending")).toBe(false);
  });
});

describe("efectos del polling de Klap al confirmar el pago (fuente real de TripsPage)", () => {
  it("la rama isKlapPaymentConfirmedStatus limpia el aviso pendiente y refresca los viajes", () => {
    const confirmedBranch = tripsSource.slice(
      tripsSource.indexOf("if (isKlapPaymentConfirmedStatus(status)) {"),
      tripsSource.indexOf("if (isKlapPaymentRejectedStatus(status)) {"),
    );

    expect(confirmedBranch).toContain("activatePaidCardPaymentMirrors(pending)");
    expect(confirmedBranch).toContain("clearPendingCardPayment()");
    expect(confirmedBranch).toContain("cleanPaymentReturnQuery()");
    expect(confirmedBranch).toContain("setCanResumeKlapPayment(false)");
    expect(confirmedBranch).toContain("await loadRides()");
    // No debe existir ninguna llamada a crear/solicitar un viaje nuevo en esta
    // rama — solo se refresca el estado del viaje ya existente.
    expect(confirmedBranch).not.toMatch(/requestRide|createRide|ridesService\.request/i);
  });

  it("el helper se usa exactamente una vez en cada rama — no se duplicó ni se extendió a Mercado Pago", () => {
    const countOccurrences = (needle: string): number =>
      tripsSource.split(needle).length - 1;

    expect(countOccurrences("isKlapPaymentConfirmedStatus(status)")).toBe(1);
    expect(countOccurrences("isKlapPaymentRejectedStatus(status)")).toBe(1);
    // Los flujos de Mercado Pago siguen con su propia comparación literal,
    // sin tocar (reconciled.status/status de fast search).
    expect(tripsSource).toContain('reconciled.status === "success"');
    expect(tripsSource).toContain(
      '["rejected", "failed", "refunded"].includes(reconciled.status)',
    );
  });
});
