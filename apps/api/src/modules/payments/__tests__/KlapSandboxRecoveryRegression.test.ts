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

describe("Klap Sandbox recovery regressions", () => {
  it("accepts canonical and legacy-compatible webhook routes", () => {
    expect(routesSource).toContain('"/webhooks/klap/confirm"');
    expect(routesSource).toContain('"/webhooks/klap/reject"');
    expect(routesSource).toContain('"/payments/webhook/klap"');
    expect(controllerSource).toContain("klapUnifiedWebhook");
  });

  it("keeps the deterministic fallback sandbox-only and PAN-free", () => {
    expect(schemaSource).toContain("klapSandboxTestProfileSchema");
    expect(serviceSource).toContain('process.env["KLAP_ENVIRONMENT"]');
    expect(serviceSource).toContain('"klap_sandbox_test_matrix"');
    expect(serviceSource).toContain("markSuccessAndActivateRide");
    expect(serviceSource).toContain("markRejected");
    expect(serviceSource).not.toContain("4000000000001091");
    expect(serviceSource).not.toContain("5200000000001096");
  });
});
