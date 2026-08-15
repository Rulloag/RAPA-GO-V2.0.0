import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function source(relativeUrl: string): string {
  return readFileSync(
    fileURLToPath(new URL(relativeUrl, import.meta.url)),
    "utf8",
  );
}

const routesSource = source("../payments.routes.ts");
const controllerSource = source("../payments.controller.ts");
const serviceSource = source("../payments.service.ts");
const providerSource = source("../klap.provider.ts");

describe("Klap V108 hosted-checkout regressions", () => {
  it("mantiene rutas firmadas de confirmación y rechazo", () => {
    expect(routesSource).toContain('"/webhooks/klap/confirm"');
    expect(routesSource).toContain('"/webhooks/klap/reject"');
    expect(routesSource).toContain('"/webhooks/klap/validate"');
    expect(routesSource).toContain('"/payments/webhook/klap"');
    expect(controllerSource).toContain("klapUnifiedWebhook");
    expect(controllerSource).toContain("klapWebhookConnectivityCheck");
  });

  it("usa POST/GET oficiales de órdenes y valida redirect_url", () => {
    expect(providerSource).toContain("/payment-gateway/v1/orders");
    expect(providerSource).toContain("redirect_url");
    expect(providerSource).toContain("validateKlapRedirectUrl");
    expect(providerSource).toContain("async getOrder(");
  });

  it("no usa el endpoint interno ni el SDK antiguo", () => {
    for (const sourceText of [providerSource, serviceSource]) {
      expect(sourceText).not.toContain("/cards/receipt");
      expect(sourceText).not.toContain("checkout-frictionless");
      expect(sourceText).not.toContain("KLAP.payOrder");
      expect(sourceText).not.toContain("Cardinal.continue");
    }
  });

  it("no aprueba por matrices de tarjetas de sandbox", () => {
    expect(routesSource).not.toContain("/reconcile/klap-sandbox");
    expect(serviceSource).not.toContain("KLAP_SANDBOX_TEST_OUTCOME");
    expect(serviceSource).not.toContain("klap_sandbox_test_matrix");
  });
});
