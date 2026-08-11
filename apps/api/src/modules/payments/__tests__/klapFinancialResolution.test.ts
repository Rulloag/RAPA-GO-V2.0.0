import { describe, expect, it } from "vitest";
import {
  buildKlapFinancialResolutionKey,
  resolveKlapFinancialOutcome,
} from "../klapFinancialResolution.js";

const BASE = {
  paymentId: "payment-1",
  tripId: "trip-1",
  authorizedAmountClp: 20_000,
  authorizationExpired: false,
} as const;

describe("resolveKlapFinancialOutcome", () => {
  it("CASO 1: viaje completado captura el monto final backend", () => {
    const result = resolveKlapFinancialOutcome({
      ...BASE,
      outcome: "completed",
      finalRideAmountClp: 20_000,
    });

    expect(result.action).toBe("capture");
    expect(result.amountClp).toBe(20_000);
    expect(result.remainingAuthorizedAmountClp).toBe(0);
    expect(result.requiresRemainderRelease).toBe(false);
  });

  it("CASO 1B: si monto final es menor, decide captura parcial y exige liberar saldo", () => {
    const result = resolveKlapFinancialOutcome({
      ...BASE,
      outcome: "completed",
      finalRideAmountClp: 18_000,
    });

    expect(result.action).toBe("capture_partial");
    expect(result.amountClp).toBe(18_000);
    expect(result.remainingAuthorizedAmountClp).toBe(2_000);
    expect(result.requiresRemainderRelease).toBe(true);
  });

  it("CASO 2: cancelación gratis nunca captura y exige VOID/liberación", () => {
    const result = resolveKlapFinancialOutcome({
      ...BASE,
      outcome: "cancelled",
      cancellationFeeClp: 0,
    });

    expect(result.action).toBe("void");
    expect(result.amountClp).toBe(0);
    expect(result.remainingAuthorizedAmountClp).toBe(20_000);
    expect(result.requiresRemainderRelease).toBe(true);
  });

  it("CASO 3: cancelación con multa captura solo la multa, nunca el total", () => {
    const result = resolveKlapFinancialOutcome({
      ...BASE,
      outcome: "cancelled",
      cancellationFeeClp: 3_000,
    });

    expect(result.action).toBe("capture_partial");
    expect(result.reason).toBe("cancelled_with_fee");
    expect(result.amountClp).toBe(3_000);
    expect(result.remainingAuthorizedAmountClp).toBe(17_000);
    expect(result.requiresRemainderRelease).toBe(true);
  });

  it("CASO 4: NO SHOW captura solo 50% con tope calculado por backend", () => {
    const result = resolveKlapFinancialOutcome({
      ...BASE,
      outcome: "no_show",
      noShowFeeClp: 5_000,
    });

    expect(result.action).toBe("capture_partial");
    expect(result.reason).toBe("no_show_fee");
    expect(result.amountClp).toBe(5_000);
    expect(result.remainingAuthorizedAmountClp).toBe(15_000);
    expect(result.requiresRemainderRelease).toBe(true);
  });

  it("fail-closed: NO SHOW superior a la autorización nunca captura", () => {
    const result = resolveKlapFinancialOutcome({
      ...BASE,
      authorizedAmountClp: 4_000,
      outcome: "no_show",
      noShowFeeClp: 5_000,
    });

    expect(result.action).toBe("manual_review");
    expect(result.reason).toBe("no_show_fee_exceeds_authorization");
    expect(result.amountClp).toBe(0);
  });

  it("CASO 5: autorización expirada nunca intenta captura", () => {
    const result = resolveKlapFinancialOutcome({
      ...BASE,
      outcome: "completed",
      finalRideAmountClp: 20_000,
      authorizationExpired: true,
    });

    expect(result.action).toBe("expired");
    expect(result.amountClp).toBe(0);
  });

  it("fail-closed: monto final superior a la autorización va a revisión manual", () => {
    const result = resolveKlapFinancialOutcome({
      ...BASE,
      outcome: "completed",
      finalRideAmountClp: 21_000,
    });

    expect(result.action).toBe("manual_review");
    expect(result.reason).toBe("final_amount_exceeds_authorization");
    expect(result.amountClp).toBe(0);
  });

  it("fail-closed: multa superior a la autorización nunca captura", () => {
    const result = resolveKlapFinancialOutcome({
      ...BASE,
      outcome: "cancelled",
      cancellationFeeClp: 25_000,
    });

    expect(result.action).toBe("manual_review");
    expect(result.reason).toBe("cancellation_fee_exceeds_authorization");
    expect(result.amountClp).toBe(0);
  });

  it("genera una clave de resolución estable para idempotencia interna", () => {
    const first = buildKlapFinancialResolutionKey({
      paymentId: "payment-1",
      tripId: "trip-1",
      action: "capture_partial",
      amountClp: 3_000,
    });
    const second = buildKlapFinancialResolutionKey({
      paymentId: "payment-1",
      tripId: "trip-1",
      action: "capture_partial",
      amountClp: 3_000,
    });
    const different = buildKlapFinancialResolutionKey({
      paymentId: "payment-1",
      tripId: "trip-1",
      action: "capture_partial",
      amountClp: 3_500,
    });

    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(second).toBe(first);
    expect(different).not.toBe(first);
  });
});
