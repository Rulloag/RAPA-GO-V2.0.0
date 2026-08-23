import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function source(relativeUrl: string): string {
  return readFileSync(
    fileURLToPath(new URL(relativeUrl, import.meta.url)),
    "utf8",
  );
}

const paymentsService = source("../payments.service.ts");
const ridesRepository = source("../../rides/rides.repository.ts");

describe("RapaGo más veloz — efectivo y Klap", () => {
  it("efectivo activa el recargo de $800 sin checkout y lo deja cobrado al finalizar", () => {
    const cashStart = paymentsService.indexOf(
      'if (paymentPurpose === "fast_search" && ridePaymentMethod === "cash")',
    );
    const cardStart = paymentsService.indexOf(
      'if (paymentPurpose === "fast_search" && ridePaymentMethod === "card")',
    );
    expect(cashStart).toBeGreaterThan(0);
    expect(cardStart).toBeGreaterThan(cashStart);
    const cashBlock = paymentsService.slice(cashStart, cardStart);
    expect(cashBlock).toContain("RAPAGO_FAST_SEARCH_FEE_CLP");
    expect(cashBlock).toContain('activateFastSearchAfterPayment(ride.id, "cash")');
    expect(cashBlock).toContain("paymentsRepo.markSuccess(");
    expect(cashBlock).toContain("activated: true");
  });

  it("tarjeta retiene $800 en Klap (authorization), no cobra al confirmar", () => {
    expect(paymentsService).toContain('paymentPurpose: "fast_search"');
    expect(paymentsService).toContain("KLAP_TRANSACTION_TYPE_AUTHORIZATION");
    expect(paymentsService).not.toContain("KLAP_TRANSACTION_TYPE_SALE");
    expect(paymentsService).toContain("FAST_SEARCH_CASH_NOT_KLAP");
    expect(paymentsService).toContain("payment.klap_fast_search_authorized");
    expect(ridesRepository).toContain("priorityFeeClp: safeFeeClp");
  });

  it("reconoce el medio desde payment_method del viaje o desde las notas", () => {
    const start = paymentsService.indexOf("function inferRidePaymentMethod(");
    const end = paymentsService.indexOf("function rideHasFastSearchActive(");
    const fn = paymentsService.slice(start, end);
    expect(fn).toContain("paymentMethod");
    expect(fn).toContain('direct === "card"');
    expect(fn).toContain('direct === "cash"');
    expect(fn).toContain("klap");
    expect(fn).toContain("efectivo");
  });
});
