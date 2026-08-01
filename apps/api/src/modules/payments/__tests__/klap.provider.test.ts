import { describe, it, expect, beforeEach, vi } from "vitest";

beforeEach(() => {
  process.env["KLAP_ENVIRONMENT"] = "sandbox";
  process.env["KLAP_API_KEY"] = "test-sandbox-api-key";
  delete process.env["KLAP_SANDBOX_ORDERS_URL"];
  delete process.env["KLAP_REQUEST_TIMEOUT_MS"];
  vi.restoreAllMocks();
});

import { KlapProvider } from "../klap.provider.js";
import { KlapProviderError } from "../klap.types.js";
import type { CreatePaymentParams } from "../payment.provider.js";

const SANDBOX_URL = "https://api-pasarela-sandbox.mcdesaqa.cl/payment-gateway/v1/orders";

function baseParams(overrides: Partial<CreatePaymentParams> = {}): CreatePaymentParams {
  return {
    orderId: "pay-uuid-0001",
    amountClp: 5000,
    description: "Viaje Rapa Go",
    passengerEmail: "pasajero@example.com",
    passengerName: "Pasajero de Prueba",
    returnUrl: "https://backend.rapago.cl/payments/return",
    webhookUrl: "https://backend.rapago.cl/webhooks/klap",
    ...overrides,
  };
}

function mockFetchOnce(status: number, jsonBody: unknown, ok = status >= 200 && status < 300): void {
  global.fetch = vi.fn().mockResolvedValueOnce({
    ok,
    status,
    json: () => Promise.resolve(jsonBody),
    text: () => Promise.resolve(JSON.stringify(jsonBody)),
  } as unknown as Response);
}

describe("KlapProvider.createPayment", () => {
  let provider: KlapProvider;

  beforeEach(() => {
    provider = new KlapProvider();
  });

  it("1. creates an order successfully and maps order_id to providerOrderId", async () => {
    mockFetchOnce(200, { order_id: "klap-order-abc123" });

    const result = await provider.createPayment(baseParams());

    expect(result.providerOrderId).toBe("klap-order-abc123");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("2. sends the Api-Key header without asserting its concrete secret value", async () => {
    mockFetchOnce(200, { order_id: "klap-order-abc123" });

    await provider.createPayment(baseParams());

    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["Api-Key"]).toBeTypeOf("string");
    expect(headers["Api-Key"].length).toBeGreaterThan(0);
  });

  it("3. sends an Idempotency-Key header", async () => {
    mockFetchOnce(200, { order_id: "klap-order-abc123" });

    await provider.createPayment(baseParams());

    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toBeTypeOf("string");
    expect(headers["Idempotency-Key"].length).toBeGreaterThan(0);
  });

  it("4. sends amount as an integer CLP value in the request body", async () => {
    mockFetchOnce(200, { order_id: "klap-order-abc123" });

    await provider.createPayment(baseParams({ amountClp: 12345 }));

    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.amount).toBe(12345);
    expect(body.currency).toBe("CLP");
    expect(Number.isInteger(body.amount)).toBe(true);
  });

  it("5. rejects a zero amount without calling fetch", async () => {
    await expect(provider.createPayment(baseParams({ amountClp: 0 }))).rejects.toThrow(KlapProviderError);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("6. rejects a negative amount without calling fetch", async () => {
    await expect(provider.createPayment(baseParams({ amountClp: -500 }))).rejects.toThrow(KlapProviderError);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("7. rejects a decimal amount without calling fetch", async () => {
    await expect(provider.createPayment(baseParams({ amountClp: 1500.5 }))).rejects.toThrow(KlapProviderError);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("rejects an amount above the internal safety ceiling", async () => {
    await expect(
      provider.createPayment(baseParams({ amountClp: 999_999_999 })),
    ).rejects.toThrow(KlapProviderError);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("8. throws a config error when KLAP_API_KEY is missing", async () => {
    delete process.env["KLAP_API_KEY"];

    await expect(provider.createPayment(baseParams())).rejects.toMatchObject({
      kind: "config",
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("9. throws a config error when the orders URL is explicitly set to empty", async () => {
    // Nullish coalescing (??) only falls back on null/undefined, not on an empty
    // string — so an operator setting this to "" must still be rejected explicitly.
    process.env["KLAP_SANDBOX_ORDERS_URL"] = "";

    await expect(provider.createPayment(baseParams())).rejects.toMatchObject({ kind: "config" });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("10. maps an AbortError to a timeout KlapProviderError", async () => {
    const abortError = new Error("aborted");
    abortError.name = "AbortError";
    global.fetch = vi.fn().mockRejectedValueOnce(abortError);

    await expect(provider.createPayment(baseParams())).rejects.toMatchObject({ kind: "timeout" });
  });

  it("11. maps a generic fetch rejection to a network KlapProviderError", async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("ECONNRESET"));

    await expect(provider.createPayment(baseParams())).rejects.toMatchObject({ kind: "network" });
  });

  it("12. maps an HTTP 400 response to an http_rejected KlapProviderError", async () => {
    mockFetchOnce(400, { error: "bad_request" });

    await expect(provider.createPayment(baseParams())).rejects.toMatchObject({
      kind: "http_rejected",
      httpStatus: 400,
    });
  });

  it("13. maps an HTTP 401 response to an http_rejected KlapProviderError", async () => {
    mockFetchOnce(401, { error: "unauthorized" });

    await expect(provider.createPayment(baseParams())).rejects.toMatchObject({
      kind: "http_rejected",
      httpStatus: 401,
    });
  });

  it("14. maps an HTTP 409 response to http_rejected (no undocumented special-casing)", async () => {
    mockFetchOnce(409, { error: "conflict" });

    await expect(provider.createPayment(baseParams())).rejects.toMatchObject({
      kind: "http_rejected",
      httpStatus: 409,
    });
  });

  it("15. maps an HTTP 500 response to an http_rejected KlapProviderError", async () => {
    mockFetchOnce(500, { error: "internal_error" });

    await expect(provider.createPayment(baseParams())).rejects.toMatchObject({
      kind: "http_rejected",
      httpStatus: 500,
    });
  });

  it("16. maps invalid JSON in the response to invalid_response", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.reject(new Error("Unexpected token")),
      text: () => Promise.resolve("not json"),
    } as unknown as Response);

    await expect(provider.createPayment(baseParams())).rejects.toMatchObject({
      kind: "invalid_response",
    });
  });

  it("17. maps a response missing order_id to invalid_response", async () => {
    mockFetchOnce(200, { status: "created" });

    await expect(provider.createPayment(baseParams())).rejects.toMatchObject({
      kind: "invalid_response",
    });
  });

  it("18. never includes PAN/CVV fields anywhere in the request body", async () => {
    mockFetchOnce(200, { order_id: "klap-order-abc123" });

    await provider.createPayment(baseParams());

    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const rawBody = String(init.body);
    expect(rawBody).not.toMatch(/pan|cvv|card_number|cardNumber|security_code/i);
  });

  it("19. never includes the ApiKey value inside a thrown error message", async () => {
    mockFetchOnce(401, { error: "unauthorized" });
    process.env["KLAP_API_KEY"] = "super-secret-sandbox-key-xyz";

    try {
      await provider.createPayment(baseParams());
      throw new Error("expected createPayment to reject");
    } catch (err) {
      expect(String((err as Error).message)).not.toContain("super-secret-sandbox-key-xyz");
    }
  });

  it("20. calls the confirmed Sandbox URL, never a production-looking URL", async () => {
    mockFetchOnce(200, { order_id: "klap-order-abc123" });

    await provider.createPayment(baseParams());

    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(SANDBOX_URL);
    expect(url).not.toContain("api.pasarela.multicaja.cl");
  });

  it("21. refuses to operate when KLAP_ENVIRONMENT=production, even without other changes", async () => {
    process.env["KLAP_ENVIRONMENT"] = "production";

    await expect(provider.createPayment(baseParams())).rejects.toMatchObject({ kind: "config" });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("22. does not retry automatically after a timeout", async () => {
    const abortError = new Error("aborted");
    abortError.name = "AbortError";
    global.fetch = vi.fn().mockRejectedValueOnce(abortError);

    await expect(provider.createPayment(baseParams())).rejects.toThrow();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

describe("KlapProvider — webhook methods (not implemented in this phase)", () => {
  it("verifyWebhookSignature denies by default (deny-by-default, not Fase C yet)", () => {
    const provider = new KlapProvider();
    expect(provider.verifyWebhookSignature({}, {})).toBe(false);
  });

  it("normalizeWebhook rejects, documenting it is scheduled for Fase C", async () => {
    const provider = new KlapProvider();
    await expect(provider.normalizeWebhook({}, {})).rejects.toThrow(/Fase C/);
  });
});
