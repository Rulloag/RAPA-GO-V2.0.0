import { describe, it, expect, beforeEach, vi } from "vitest";

beforeEach(() => {
  process.env["MERCADOPAGO_ACCESS_TOKEN"]  = "TEST-access-token";
  process.env["MERCADOPAGO_WEBHOOK_SECRET"] = "test-webhook-secret";
  process.env["MERCADOPAGO_ENVIRONMENT"]   = "sandbox";
});

import crypto from "node:crypto";
import { MercadoPagoProvider } from "../mercadopago.provider.js";

function buildMPSignature(dataId: string, requestId: string, ts: string, secret: string): string {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  return crypto.createHmac("sha256", secret).update(manifest).digest("hex");
}

describe("MercadoPagoProvider.verifyWebhookSignature", () => {
  const secret    = "test-webhook-secret";
  const dataId    = "1234567";
  const requestId = "req-uuid-001";
  const ts        = "1704067200";
  let provider: MercadoPagoProvider;

  beforeEach(() => {
    provider = new MercadoPagoProvider();
  });

  it("returns true for a valid x-signature", () => {
    const v1  = buildMPSignature(dataId, requestId, ts, secret);
    const sig = `ts=${ts},v1=${v1}`;

    expect(provider.verifyWebhookSignature(
      { type: "payment", data: { id: dataId } },
      { "x-signature": sig, "x-request-id": requestId },
    )).toBe(true);
  });

  it("uses the official data.id query value when it is not duplicated in the body", () => {
    const v1 = buildMPSignature(dataId, requestId, ts, secret);
    const sig = `ts=${ts},v1=${v1}`;

    expect(provider.verifyWebhookSignature(
      { type: "payment" },
      {
        "x-signature": sig,
        "x-request-id": requestId,
        "x-data-id": dataId,
      },
    )).toBe(true);
  });

  it("returns false when v1 does not match", () => {
    const sig = `ts=${ts},v1=badhash000000000000000000000000000000000000000000000000000000000000`;

    expect(provider.verifyWebhookSignature(
      { type: "payment", data: { id: dataId } },
      { "x-signature": sig, "x-request-id": requestId },
    )).toBe(false);
  });

  it("returns false when x-signature header is missing", () => {
    expect(provider.verifyWebhookSignature(
      { type: "payment", data: { id: dataId } },
      { "x-request-id": requestId },
    )).toBe(false);
  });

  it("returns false when MERCADOPAGO_WEBHOOK_SECRET is not set (fails closed)", () => {
    delete process.env["MERCADOPAGO_WEBHOOK_SECRET"];

    expect(provider.verifyWebhookSignature(
      { type: "payment", data: { id: dataId } },
      {},
    )).toBe(false);
  });

  it("returns false when MERCADOPAGO_ACCESS_TOKEN is missing", () => {
    delete process.env["MERCADOPAGO_ACCESS_TOKEN"];
    const v1  = buildMPSignature(dataId, requestId, ts, secret);
    const sig = `ts=${ts},v1=${v1}`;

    // Without access token, config throws → caught → false
    expect(provider.verifyWebhookSignature(
      { type: "payment", data: { id: dataId } },
      { "x-signature": sig, "x-request-id": requestId },
    )).toBe(false);
  });
});

describe("MercadoPagoProvider.normalizeWebhook", () => {
  let provider: MercadoPagoProvider;

  beforeEach(() => {
    provider  = new MercadoPagoProvider();
    vi.restoreAllMocks();
  });

  it("returns empty orderId and unknown status for non-payment event type", async () => {
    const result = await provider.normalizeWebhook(
      { type: "subscription_preapproval", data: { id: "123" } },
      {},
    );
    expect(result.orderId).toBe("");
    expect(result.status).toBe("unknown");
  });

  it("returns empty orderId when data.id is missing", async () => {
    const result = await provider.normalizeWebhook({ type: "payment" }, {});
    expect(result.orderId).toBe("");
    expect(result.status).toBe("unknown");
  });

  it("fetches payment details from MP API and maps approved → success", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok:   true,
      json: async () => ({
        id:                 9999,
        status:             "approved",
        external_reference: "our-internal-payment-uuid",
      }),
    } as unknown as Response);

    const result = await provider.normalizeWebhook(
      { type: "payment", data: { id: "9999" } },
      {},
    );

    expect(result.orderId).toBe("our-internal-payment-uuid");
    expect(result.status).toBe("success");
    expect(result.externalId).toBe("9999");
  });

  it("maps rejected → rejected", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok:   true,
      json: async () => ({ id: 1, status: "rejected", external_reference: "pay-id" }),
    } as unknown as Response);

    const result = await provider.normalizeWebhook({ type: "payment", data: { id: "1" } }, {});
    expect(result.status).toBe("rejected");
  });

  it("maps in_process → pending", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok:   true,
      json: async () => ({ id: 2, status: "in_process", external_reference: "pay-id" }),
    } as unknown as Response);

    const result = await provider.normalizeWebhook({ type: "payment", data: { id: "2" } }, {});
    expect(result.status).toBe("pending");
  });

  it("throws when MP API returns non-OK status", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok:     false,
      status: 500,
    } as unknown as Response);

    await expect(
      provider.normalizeWebhook({ type: "payment", data: { id: "3" } }, {}),
    ).rejects.toThrow("MercadoPago API error 500");
  });

  it("throws ProviderTimeoutError when the confirmation call times out", async () => {
    const timeoutError = new DOMException("The operation was aborted due to timeout", "TimeoutError");
    global.fetch = vi.fn().mockRejectedValueOnce(timeoutError);

    await expect(
      provider.normalizeWebhook({ type: "payment", data: { id: "4" } }, {}),
    ).rejects.toMatchObject({ name: "ProviderTimeoutError" });
  });

  it("throws ProviderNetworkError on a generic network failure during confirmation", async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new TypeError("fetch failed"));

    await expect(
      provider.normalizeWebhook({ type: "payment", data: { id: "5" } }, {}),
    ).rejects.toMatchObject({ name: "ProviderNetworkError" });
  });
});

describe("MercadoPagoProvider.createPayment (timeout behavior)", () => {
  let provider: MercadoPagoProvider;

  const baseParams = {
    orderId:        "order-uuid-1",
    amountClp:      1000,
    description:    "Viaje de prueba",
    passengerEmail: "pasajero@example.com",
    passengerName:  "Pasajero de Prueba",
    returnUrl:      "https://rapago.cl/return",
    webhookUrl:     "https://rapago.cl/api/payments/webhooks/mercadopago",
  };

  beforeEach(() => {
    provider = new MercadoPagoProvider();
    vi.restoreAllMocks();
  });

  it("creates the payment normally when MercadoPago responds in time", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok:   true,
      status: 201,
      text: async () => JSON.stringify({ id: "pref-1", init_point: "https://mp.cl/checkout/pref-1" }),
    } as unknown as Response);

    const result = await provider.createPayment(baseParams);

    expect(result.providerOrderId).toBe("pref-1");
    expect(result.urlPay).toBe("https://mp.cl/checkout/pref-1");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("aborts immediately (no retry of other payloads) when the first attempt times out", async () => {
    const timeoutError = new DOMException("The operation was aborted due to timeout", "TimeoutError");
    const fetchMock = vi.fn().mockRejectedValueOnce(timeoutError);
    global.fetch = fetchMock;

    await expect(provider.createPayment(baseParams)).rejects.toMatchObject({
      name: "ProviderTimeoutError",
    });
    // Same behavior as before this change: a thrown fetch error aborts the
    // attempts loop immediately instead of trying the other payload variants.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("propagates a generic network error distinctly from a timeout", async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new TypeError("fetch failed"));

    await expect(provider.createPayment(baseParams)).rejects.toMatchObject({
      name: "ProviderNetworkError",
    });
  });

  it("still throws a business error (not a timeout) when MercadoPago returns a non-OK response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ message: "invalid preference" }),
    } as unknown as Response);

    await expect(provider.createPayment(baseParams)).rejects.toThrow("MercadoPago API error");
  });
});
