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
const schemaSource = source("../payments.schema.ts");
const providerSource = source("../klap.provider.ts");

describe("Klap automatic card recognition regressions", () => {
  it("keeps canonical and legacy-compatible signed webhook routes", () => {
    expect(routesSource).toContain('"/webhooks/klap/confirm"');
    expect(routesSource).toContain('"/webhooks/klap/reject"');
    expect(routesSource).toContain('"/payments/webhook/klap"');
    expect(controllerSource).toContain("klapUnifiedWebhook");
  });

  it("does not approve or reject payments from a hard-coded card matrix", () => {
    expect(routesSource).not.toContain("/reconcile/klap-sandbox");
    expect(controllerSource).not.toContain("reconcileKlapSandboxPayment");
    expect(serviceSource).not.toContain("KLAP_SANDBOX_TEST_OUTCOME");
    expect(serviceSource).not.toContain("klap_sandbox_test_matrix");
    expect(schemaSource).not.toContain("klapSandboxTestProfileSchema");
  });

  it("creates Klap orders without restricting the card product", () => {
    expect(providerSource).toContain('methods: ["tarjetas"]');
    expect(providerSource).not.toContain("tarjetas_card_type_allowed");
    expect(providerSource).not.toContain("tarjetas_quotas_allowed");
  });
});
