import { describe, it, expect, beforeEach, vi } from "vitest";

beforeEach(() => {
  process.env["PRONTOPAGA_ENVIRONMENT"]  = "sandbox";
  process.env["PRONTOPAGA_API_KEY"]      = "test-api-key";
  process.env["PRONTOPAGA_SECRET_KEY"]   = "test-secret";
  process.env["PRONTOPAGA_COMMERCE_ID"]  = "COMMERCE123";
});

import crypto from "node:crypto";
import { ProntoPagaProvider } from "../prontopaga.provider.js";

function buildSignature(params: Record<string, string | number>, secret: string): string {
  const keys = Object.keys(params).sort();
  const raw  = keys.map(k => `${k}=${params[k]}`).join("&");
  return crypto.createHmac("sha256", secret).update(raw).digest("hex");
}

describe("ProntoPagaProvider.verifyWebhookSignature", () => {
  const secret   = "test-secret";
  let provider: ProntoPagaProvider;

  beforeEach(() => {
    provider = new ProntoPagaProvider();
  });

  it("returns true for a valid signature", () => {
    const payload = { order: "pay-uuid-123", status: "success", amount: 5000 };
    const sig     = buildSignature(payload, secret);

    expect(provider.verifyWebhookSignature(
      { ...payload, signature: sig } as Record<string, unknown>,
      {},
    )).toBe(true);
  });

  it("returns false when the signature does not match", () => {
    const payload    = { order: "pay-uuid-123", status: "success", amount: 5000 };
    const validSig   = buildSignature(payload, secret);
    const tamperedSig = validSig.slice(0, -4) + "0000";

    expect(provider.verifyWebhookSignature(
      { ...payload, signature: validSig } as Record<string, unknown>,
      {},
    )).toBe(
      // We're passing validSig in body but comparing against tamperedSig — this should be false.
      // Actually we need to pass tamperedSig as the "received" value.
      // The provider reads signature from body, so this is always true unless tampered.
      // Re-test: tamper the body signature field.
      true, // valid body sig → always true regardless of headers
    );

    // Correct test: tamper the signature field IN the body
    expect(provider.verifyWebhookSignature(
      { ...payload, signature: tamperedSig } as Record<string, unknown>,
      {},
    )).toBe(false);
  });

  it("returns false when a payload field has been tampered after signing", () => {
    const payload  = { order: "pay-uuid-123", status: "success", amount: 5000 };
    const sig      = buildSignature(payload, secret);
    const tampered = { ...payload, amount: 1, signature: sig };

    expect(provider.verifyWebhookSignature(tampered as Record<string, unknown>, {})).toBe(false);
  });

  it("excludes the 'signature' field when rebuilding the expected hash", () => {
    const payload = { order: "pay-uuid-123", status: "success" };
    const sig     = buildSignature(payload, secret);

    expect(provider.verifyWebhookSignature(
      { ...payload, signature: sig } as Record<string, unknown>,
      {},
    )).toBe(true);
  });

  it("returns false when PRONTOPAGA_SECRET_KEY is missing", () => {
    delete process.env["PRONTOPAGA_SECRET_KEY"];
    const payload = { order: "pay-uuid-123", status: "success" };
    const sig     = buildSignature(payload, secret);

    expect(provider.verifyWebhookSignature(
      { ...payload, signature: sig } as Record<string, unknown>,
      {},
    )).toBe(false);
  });
});

describe("ProntoPagaProvider.normalizeWebhook", () => {
  let provider: ProntoPagaProvider;

  beforeEach(() => {
    provider = new ProntoPagaProvider();
  });

  it("maps 'order' field to orderId", async () => {
    const result = await provider.normalizeWebhook(
      { order: "pay-123", status: "success", external_id: "ext-456" },
      {},
    );
    expect(result.orderId).toBe("pay-123");
    expect(result.status).toBe("success");
    expect(result.externalId).toBe("ext-456");
  });

  it("maps 'order_id' field to orderId as fallback", async () => {
    const result = await provider.normalizeWebhook(
      { order_id: "pay-789", status: "rejected" },
      {},
    );
    expect(result.orderId).toBe("pay-789");
    expect(result.status).toBe("rejected");
  });

  it("maps 'approved' and 'paid' to success status", async () => {
    for (const ppStatus of ["approved", "paid"]) {
      const r = await provider.normalizeWebhook({ order: "id", status: ppStatus }, {});
      expect(r.status).toBe("success");
    }
  });

  it("maps 'failed' and 'cancelled' to rejected status", async () => {
    for (const ppStatus of ["failed", "cancelled"]) {
      const r = await provider.normalizeWebhook({ order: "id", status: ppStatus }, {});
      expect(r.status).toBe("rejected");
    }
  });

  it("returns 'unknown' for unrecognised statuses", async () => {
    const r = await provider.normalizeWebhook({ order: "id", status: "chargeback" }, {});
    expect(r.status).toBe("unknown");
  });
});

describe("ProntoPagaProvider.createPayment (timeout behavior)", () => {
  let provider: ProntoPagaProvider;

  const baseParams = {
    orderId:        "order-uuid-1",
    amountClp:      1000,
    description:    "Viaje de prueba",
    passengerEmail: "pasajero@example.com",
    passengerName:  "Pasajero de Prueba",
    returnUrl:      "https://rapago.cl/return",
    webhookUrl:     "https://rapago.cl/api/payments/webhooks/prontopaga",
  };

  beforeEach(() => {
    provider = new ProntoPagaProvider();
    vi.restoreAllMocks();
  });

  it("creates the payment normally when ProntoPaga responds in time", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok:   true,
      status: 200,
      json: async () => ({ order_id: "pp-order-1", url_pay: "https://sandbox.prontopaga.cl/pay/1" }),
    } as unknown as Response);

    const result = await provider.createPayment(baseParams);

    expect(result.providerOrderId).toBe("pp-order-1");
    expect(result.urlPay).toBe("https://sandbox.prontopaga.cl/pay/1");
  });

  it("throws ProviderTimeoutError when ProntoPaga exceeds the timeout", async () => {
    const timeoutError = new DOMException("The operation was aborted due to timeout", "TimeoutError");
    global.fetch = vi.fn().mockRejectedValueOnce(timeoutError);

    await expect(provider.createPayment(baseParams)).rejects.toMatchObject({
      name: "ProviderTimeoutError",
    });
  });

  it("throws ProviderNetworkError on a generic network failure", async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new TypeError("fetch failed"));

    await expect(provider.createPayment(baseParams)).rejects.toMatchObject({
      name: "ProviderNetworkError",
    });
  });

  it("still throws a business error (not a timeout) when ProntoPaga returns a non-OK HTTP response", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => "invalid request",
    } as unknown as Response);

    await expect(provider.createPayment(baseParams)).rejects.toThrow("ProntoPaga API error 400");
  });
});
