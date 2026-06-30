import { describe, it, expect, beforeEach, vi } from "vitest";

// ── verifyProntoPagaWebhookSignature requires credentials at runtime.
// We set them before any import of the module under test.
beforeEach(() => {
  process.env["PRONTOPAGA_ENVIRONMENT"]  = "sandbox";
  process.env["PRONTOPAGA_API_KEY"]      = "test-api-key";
  process.env["PRONTOPAGA_SECRET_KEY"]   = "test-secret";
  process.env["PRONTOPAGA_COMMERCE_ID"]  = "COMMERCE123";
});

import crypto from "node:crypto";
import { verifyProntoPagaWebhookSignature } from "../prontopaga.service.js";

function buildSignature(params: Record<string, string | number>, secret: string): string {
  const keys = Object.keys(params).sort();
  const raw  = keys.map(k => `${k}=${params[k]}`).join("&");
  return crypto.createHmac("sha256", secret).update(raw).digest("hex");
}

describe("verifyProntoPagaWebhookSignature", () => {
  const secret = "test-secret";

  it("returns true for a valid signature", () => {
    const payload = { order: "pay-uuid-123", status: "success", amount: 5000 };
    const sig = buildSignature(payload, secret);

    const result = verifyProntoPagaWebhookSignature(
      { ...payload, signature: sig } as Record<string, unknown>,
      sig,
    );
    expect(result).toBe(true);
  });

  it("returns false when the signature does not match", () => {
    const payload = { order: "pay-uuid-123", status: "success", amount: 5000 };
    const validSig   = buildSignature(payload, secret);
    const tamperedSig = validSig.slice(0, -4) + "0000";

    const result = verifyProntoPagaWebhookSignature(
      { ...payload, signature: validSig } as Record<string, unknown>,
      tamperedSig,
    );
    expect(result).toBe(false);
  });

  it("returns false when a payload field has been tampered", () => {
    const payload = { order: "pay-uuid-123", status: "success", amount: 5000 };
    const sig = buildSignature(payload, secret);

    // Attacker changes amount after signing
    const tampered = { ...payload, amount: 1, signature: sig };
    const result = verifyProntoPagaWebhookSignature(tampered as Record<string, unknown>, sig);
    expect(result).toBe(false);
  });

  it("ignores the 'signature' field when building the expected hash", () => {
    const payload = { order: "pay-uuid-123", status: "success" };
    const sig = buildSignature(payload, secret);

    // The 'signature' key must be excluded from hashing, otherwise the result
    // would differ because 'signature' appears in both sides.
    const result = verifyProntoPagaWebhookSignature(
      { ...payload, signature: sig } as Record<string, unknown>,
      sig,
    );
    expect(result).toBe(true);
  });

  it("returns false when secret key env var is missing", () => {
    delete process.env["PRONTOPAGA_SECRET_KEY"];
    const payload = { order: "pay-uuid-123", status: "success" };
    const sig = buildSignature(payload, secret);

    const result = verifyProntoPagaWebhookSignature(
      { ...payload, signature: sig } as Record<string, unknown>,
      sig,
    );
    expect(result).toBe(false);
  });
});
