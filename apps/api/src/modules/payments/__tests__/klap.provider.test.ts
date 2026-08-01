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
import type { CreatePaymentParams, CreatePaymentResult, PaymentProvider } from "../payment.provider.js";
import { MercadoPagoProvider } from "../mercadopago.provider.js";
import { ProntoPagaProvider } from "../prontopaga.provider.js";

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

describe("KlapProvider.createEmbeddedOrder", () => {
  let provider: KlapProvider;

  beforeEach(() => {
    provider = new KlapProvider();
  });

  it("1. creates an order successfully and maps order_id to providerOrderId", async () => {
    mockFetchOnce(200, { order_id: "klap-order-abc123" });

    const result = await provider.createEmbeddedOrder(baseParams());

    expect(result.providerOrderId).toBe("klap-order-abc123");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("3. returns a checkoutType='embedded' result with publicCheckoutData.orderId, never a redirect shape", async () => {
    mockFetchOnce(200, { order_id: "klap-order-abc123" });

    const result = await provider.createEmbeddedOrder(baseParams());

    expect(result.checkoutType).toBe("embedded");
    expect(result.publicCheckoutData).toEqual({ orderId: "klap-order-abc123" });
    // A redirect-shaped consumer would look for `.urlPay` — it must not exist here.
    expect((result as unknown as { urlPay?: unknown }).urlPay).toBeUndefined();
  });

  it("5. urlPay is never present anywhere in the result (no empty-string control signal)", async () => {
    mockFetchOnce(200, { order_id: "klap-order-abc123" });

    const result = await provider.createEmbeddedOrder(baseParams());

    expect(Object.prototype.hasOwnProperty.call(result, "urlPay")).toBe(false);
  });

  it("2. sends the Api-Key header without asserting its concrete secret value", async () => {
    mockFetchOnce(200, { order_id: "klap-order-abc123" });

    await provider.createEmbeddedOrder(baseParams());

    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["Api-Key"]).toBeTypeOf("string");
    expect(headers["Api-Key"].length).toBeGreaterThan(0);
  });

  it("sends an Idempotency-Key header", async () => {
    mockFetchOnce(200, { order_id: "klap-order-abc123" });

    await provider.createEmbeddedOrder(baseParams());

    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["Idempotency-Key"]).toBeTypeOf("string");
    expect(headers["Idempotency-Key"].length).toBeGreaterThan(0);
  });

  it("sends amount as an integer CLP value in the request body", async () => {
    mockFetchOnce(200, { order_id: "klap-order-abc123" });

    await provider.createEmbeddedOrder(baseParams({ amountClp: 12345 }));

    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.amount).toBe(12345);
    expect(body.currency).toBe("CLP");
    expect(Number.isInteger(body.amount)).toBe(true);
  });

  it("rejects a zero amount without calling fetch", async () => {
    await expect(provider.createEmbeddedOrder(baseParams({ amountClp: 0 }))).rejects.toThrow(KlapProviderError);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("rejects a negative amount without calling fetch", async () => {
    await expect(provider.createEmbeddedOrder(baseParams({ amountClp: -500 }))).rejects.toThrow(KlapProviderError);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("rejects a decimal amount without calling fetch", async () => {
    await expect(provider.createEmbeddedOrder(baseParams({ amountClp: 1500.5 }))).rejects.toThrow(KlapProviderError);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("rejects an amount above the internal safety ceiling", async () => {
    await expect(
      provider.createEmbeddedOrder(baseParams({ amountClp: 999_999_999 })),
    ).rejects.toThrow(KlapProviderError);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("throws a config error when KLAP_API_KEY is missing", async () => {
    delete process.env["KLAP_API_KEY"];

    await expect(provider.createEmbeddedOrder(baseParams())).rejects.toMatchObject({
      kind: "config",
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("throws a config error when the orders URL is explicitly set to empty", async () => {
    // Nullish coalescing (??) only falls back on null/undefined, not on an empty
    // string — so an operator setting this to "" must still be rejected explicitly.
    process.env["KLAP_SANDBOX_ORDERS_URL"] = "";

    await expect(provider.createEmbeddedOrder(baseParams())).rejects.toMatchObject({ kind: "config" });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("maps an AbortError to a timeout KlapProviderError", async () => {
    const abortError = new Error("aborted");
    abortError.name = "AbortError";
    global.fetch = vi.fn().mockRejectedValueOnce(abortError);

    await expect(provider.createEmbeddedOrder(baseParams())).rejects.toMatchObject({ kind: "timeout" });
  });

  it("maps a generic fetch rejection to a network KlapProviderError", async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error("ECONNRESET"));

    await expect(provider.createEmbeddedOrder(baseParams())).rejects.toMatchObject({ kind: "network" });
  });

  it("maps an HTTP 400 response to an http_rejected KlapProviderError", async () => {
    mockFetchOnce(400, { error: "bad_request" });

    await expect(provider.createEmbeddedOrder(baseParams())).rejects.toMatchObject({
      kind: "http_rejected",
      httpStatus: 400,
    });
  });

  it("maps an HTTP 401 response to an http_rejected KlapProviderError", async () => {
    mockFetchOnce(401, { error: "unauthorized" });

    await expect(provider.createEmbeddedOrder(baseParams())).rejects.toMatchObject({
      kind: "http_rejected",
      httpStatus: 401,
    });
  });

  it("maps an HTTP 409 response to http_rejected (no undocumented special-casing)", async () => {
    mockFetchOnce(409, { error: "conflict" });

    await expect(provider.createEmbeddedOrder(baseParams())).rejects.toMatchObject({
      kind: "http_rejected",
      httpStatus: 409,
    });
  });

  it("maps an HTTP 500 response to an http_rejected KlapProviderError", async () => {
    mockFetchOnce(500, { error: "internal_error" });

    await expect(provider.createEmbeddedOrder(baseParams())).rejects.toMatchObject({
      kind: "http_rejected",
      httpStatus: 500,
    });
  });

  it("maps invalid JSON in the response to invalid_response", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.reject(new Error("Unexpected token")),
      text: () => Promise.resolve("not json"),
    } as unknown as Response);

    await expect(provider.createEmbeddedOrder(baseParams())).rejects.toMatchObject({
      kind: "invalid_response",
    });
  });

  it("maps a response missing order_id to invalid_response", async () => {
    mockFetchOnce(200, { status: "created" });

    await expect(provider.createEmbeddedOrder(baseParams())).rejects.toMatchObject({
      kind: "invalid_response",
    });
  });

  it("4. delivers order_id as the minimal public data needed to init Checkout Transparente", async () => {
    mockFetchOnce(200, { order_id: "klap-order-abc123" });

    const result = await provider.createEmbeddedOrder(baseParams());

    expect(Object.keys(result.publicCheckoutData)).toEqual(["orderId"]);
  });

  it("8. never includes PAN/CVV fields anywhere in the request body", async () => {
    mockFetchOnce(200, { order_id: "klap-order-abc123" });

    await provider.createEmbeddedOrder(baseParams());

    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const rawBody = String(init.body);
    expect(rawBody).not.toMatch(/pan|cvv|card_number|cardNumber|security_code/i);
  });

  it("7. never includes the ApiKey value inside a thrown error message", async () => {
    mockFetchOnce(401, { error: "unauthorized" });
    process.env["KLAP_API_KEY"] = "super-secret-sandbox-key-xyz";

    try {
      await provider.createEmbeddedOrder(baseParams());
      throw new Error("expected createEmbeddedOrder to reject");
    } catch (err) {
      expect(String((err as Error).message)).not.toContain("super-secret-sandbox-key-xyz");
    }
  });

  it("calls the confirmed Sandbox URL, never a production-looking URL", async () => {
    mockFetchOnce(200, { order_id: "klap-order-abc123" });

    await provider.createEmbeddedOrder(baseParams());

    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(SANDBOX_URL);
    expect(url).not.toContain("api.pasarela.multicaja.cl");
  });

  it("refuses to operate when KLAP_ENVIRONMENT=production, even without other changes", async () => {
    process.env["KLAP_ENVIRONMENT"] = "production";

    await expect(provider.createEmbeddedOrder(baseParams())).rejects.toMatchObject({ kind: "config" });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("does not retry automatically after a timeout", async () => {
    const abortError = new Error("aborted");
    abortError.name = "AbortError";
    global.fetch = vi.fn().mockRejectedValueOnce(abortError);

    await expect(provider.createEmbeddedOrder(baseParams())).rejects.toThrow();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

describe("KlapProvider.createPayment (legacy redirect contract — must refuse, not fake)", () => {
  let provider: KlapProvider;

  beforeEach(() => {
    provider = new KlapProvider();
  });

  it("6. rejects immediately with 'unsupported_checkout_type' instead of returning urlPay=''", async () => {
    await expect(provider.createPayment(baseParams())).rejects.toMatchObject({
      kind: "unsupported_checkout_type",
    });
    // It must never even attempt the network call — this is a compile/contract-time
    // refusal, not a failed order.
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("does not leak the ApiKey in the refusal message", async () => {
    process.env["KLAP_API_KEY"] = "super-secret-sandbox-key-xyz";

    try {
      await provider.createPayment(baseParams());
      throw new Error("expected createPayment to reject");
    } catch (err) {
      expect(String((err as Error).message)).not.toContain("super-secret-sandbox-key-xyz");
    }
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

describe("Regresión: Mercado Pago y ProntoPaga conservan el contrato redirect sin cambios", () => {
  // `CreatePaymentResult`/`PaymentProvider.createPayment` no se tocaron en esta fase
  // (ver payment.provider.ts). Esta función identidad solo compila si el resultado
  // real de cada provider sigue siendo exactamente `{ providerOrderId, urlPay }` —
  // es una prueba de tipos en tiempo de compilación, no solo en runtime.
  function assertRedirectShape(result: CreatePaymentResult): { providerOrderId: string; urlPay: string } {
    return result;
  }

  it("MercadoPagoProvider still implements PaymentProvider with the unchanged redirect result", () => {
    const provider: PaymentProvider = new MercadoPagoProvider();
    expect(provider.name).toBe("mercadopago");
    // Prueba de tipos: si `createPayment` alguna vez dejara de devolver
    // `CreatePaymentResult`, esta línea no compilaría.
    const typeCheck: (p: CreatePaymentParams) => Promise<CreatePaymentResult> = provider.createPayment.bind(provider);
    expect(typeCheck).toBeTypeOf("function");
    void assertRedirectShape;
  });

  it("ProntoPagaProvider still implements PaymentProvider with the unchanged redirect result", () => {
    const provider: PaymentProvider = new ProntoPagaProvider();
    expect(provider.name).toBe("prontopaga");
    const typeCheck: (p: CreatePaymentParams) => Promise<CreatePaymentResult> = provider.createPayment.bind(provider);
    expect(typeCheck).toBeTypeOf("function");
    void assertRedirectShape;
  });
});
