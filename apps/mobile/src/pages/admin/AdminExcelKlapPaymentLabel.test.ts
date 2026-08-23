import { describe, expect, it } from "vitest";
import source from "./index.tsx?raw";

describe("Admin Excel — método de pago Klap", () => {
  it("etiqueta tarjeta como Klap, no Mercado Pago ni ProntoPaga", () => {
    const start = source.indexOf("function getAdminRideExcelPaymentLabel");
    const end = source.indexOf("function getAdminRideExcelCancellationReason");
    const fn = source.slice(start, end);

    expect(fn).toContain('return "Klap"');
    expect(fn).toContain('raw.includes("tarjeta")');
    expect(fn).toContain('raw.includes("klap")');
    expect(fn).not.toContain('return "Mercado Pago"');
  });

  it("el detalle de admin también muestra Klap para tarjeta", () => {
    const start = source.indexOf("function getAdminPaymentMethod");
    const end = source.indexOf("function formatAdminFare");
    const fn = source.slice(start, end);

    expect(fn).toContain('return "Klap"');
    expect(fn).not.toContain('return "ProntoPaga"');
  });
});
