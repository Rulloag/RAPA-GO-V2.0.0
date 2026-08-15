import { describe, expect, it } from "vitest";
import { validateKlapRedirectUrl } from "./klapCheckout.service.js";

describe("Klap production checkout host regression", () => {
  it("acepta el host productivo exacto de Klap", () => {
    const url =
      "https://pagos.pasarela.multicaja.cl/order/test-production-order";

    expect(validateKlapRedirectUrl(url)).toBe(url);
  });

  it("acepta el host productivo real www.klap.cl", () => {
    const url =
      "https://www.klap.cl/order/test-production-order";

    expect(validateKlapRedirectUrl(url)).toBe(url);
  });
  it("conserva el host Sandbox únicamente durante pruebas/desarrollo", () => {
    const url =
      "https://pagos-pasarela-sandbox.mcdesaqa.cl/order/test-sandbox-order";

    expect(validateKlapRedirectUrl(url)).toBe(url);
  });

  it("rechaza subdominios productivos no autorizados", () => {
    expect(() =>
      validateKlapRedirectUrl(
        "https://evil.pasarela.multicaja.cl/order/test-order",
      ),
    ).toThrow();
  });

  it("rechaza dominios que intenten imitar al host productivo", () => {
    expect(() =>
      validateKlapRedirectUrl(
        "https://pagos.pasarela.multicaja.cl.evil.example/order/test-order",
      ),
    ).toThrow();
  });

  it("rechaza HTTP aunque el hostname sea correcto", () => {
    expect(() =>
      validateKlapRedirectUrl(
        "http://pagos.pasarela.multicaja.cl/order/test-order",
      ),
    ).toThrow();
  });
});
