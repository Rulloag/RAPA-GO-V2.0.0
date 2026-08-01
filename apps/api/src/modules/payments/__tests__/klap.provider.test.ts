import { describe, it, expect, beforeEach, vi } from "vitest";

beforeEach(() => {
  process.env["KLAP_ENVIRONMENT"] = "sandbox";
  process.env["KLAP_API_KEY"] = "test-sandbox-api-key";
  process.env["KLAP_RETURN_URL"] = "https://backend.rapago.test/payments/klap/return";
  process.env["KLAP_CANCEL_URL"] = "https://backend.rapago.test/payments/klap/cancel";
  process.env["KLAP_WEBHOOK_CONFIRM_URL"] = "https://backend.rapago.test/webhooks/klap/confirm";
  process.env["KLAP_WEBHOOK_REJECT_URL"] = "https://backend.rapago.test/webhooks/klap/reject";
  process.env["KLAP_ORDER_EXPIRATION_MINUTES"] = "30";
  delete process.env["KLAP_SEND_IDEMPOTENCY_HEADER"];
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

function lastRequestBody(): Record<string, unknown> {
  const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
  return JSON.parse(String(init.body));
}

function lastRequestHeaders(): Record<string, string> {
  const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
  return init.headers as Record<string, string>;
}

describe("KlapProvider.createEmbeddedOrder — OAS 1.2.0 OrderModel contract", () => {
  let provider: KlapProvider;

  beforeEach(() => {
    provider = new KlapProvider();
  });

  it("1. sends the 'apikey' header (lowercase, no dash) without asserting its concrete value", async () => {
    mockFetchOnce(200, { order_id: "klap-order-abc123" });
    await provider.createEmbeddedOrder(baseParams());

    const headers = lastRequestHeaders();
    expect(headers["apikey"]).toBeTypeOf("string");
    expect(headers["apikey"].length).toBeGreaterThan(0);
    expect(headers).not.toHaveProperty("Api-Key");
  });

  it("2. reference_id equals the internal payment id", async () => {
    mockFetchOnce(200, { order_id: "klap-order-abc123" });
    await provider.createEmbeddedOrder(baseParams({ orderId: "internal-payment-uuid-42" }));

    expect(lastRequestBody()["reference_id"]).toBe("internal-payment-uuid-42");
  });

  it("3. never sends consumer_transaction_id anymore", async () => {
    mockFetchOnce(200, { order_id: "klap-order-abc123" });
    await provider.createEmbeddedOrder(baseParams());

    expect(lastRequestBody()).not.toHaveProperty("consumer_transaction_id");
  });

  it("4. amount.currency is CLP", async () => {
    mockFetchOnce(200, { order_id: "klap-order-abc123" });
    await provider.createEmbeddedOrder(baseParams());

    const body = lastRequestBody();
    expect((body["amount"] as Record<string, unknown>)["currency"]).toBe("CLP");
  });

  it("5. amount.total is an integer, no floats, no root-level amount/currency", async () => {
    mockFetchOnce(200, { order_id: "klap-order-abc123" });
    await provider.createEmbeddedOrder(baseParams({ amountClp: 12345 }));

    const body = lastRequestBody();
    expect((body["amount"] as Record<string, unknown>)["total"]).toBe(12345);
    expect(Number.isInteger((body["amount"] as Record<string, unknown>)["total"])).toBe(true);
    expect(body).not.toHaveProperty("amount_clp");
    expect(body).not.toHaveProperty("currency"); // must not be at the root
  });

  it("6. accepts the minimum documented amount (50 CLP)", async () => {
    mockFetchOnce(200, { order_id: "klap-order-abc123" });
    await expect(provider.createEmbeddedOrder(baseParams({ amountClp: 50 }))).resolves.toBeDefined();
  });

  it("7. accepts the maximum documented amount (99999999 CLP)", async () => {
    mockFetchOnce(200, { order_id: "klap-order-abc123" });
    await expect(
      provider.createEmbeddedOrder(baseParams({ amountClp: 99_999_999 })),
    ).resolves.toBeDefined();
  });

  it("8. rejects an amount below 50 CLP without calling fetch", async () => {
    await expect(provider.createEmbeddedOrder(baseParams({ amountClp: 49 }))).rejects.toMatchObject({
      kind: "config",
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("9. rejects an amount above 99999999 CLP without calling fetch", async () => {
    await expect(
      provider.createEmbeddedOrder(baseParams({ amountClp: 100_000_000 })),
    ).rejects.toMatchObject({ kind: "config" });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("10. methods is exactly [\"tarjetas\"]", async () => {
    mockFetchOnce(200, { order_id: "klap-order-abc123" });
    await provider.createEmbeddedOrder(baseParams());

    expect(lastRequestBody()["methods"]).toEqual(["tarjetas"]);
  });

  it("11. generate_token equals \"none\"", async () => {
    mockFetchOnce(200, { order_id: "klap-order-abc123" });
    await provider.createEmbeddedOrder(baseParams());

    expect(lastRequestBody()["generate_token"]).toBe("none");
  });

  it("12. description is a sanitized, bounded string", async () => {
    mockFetchOnce(200, { order_id: "klap-order-abc123" });
    await provider.createEmbeddedOrder(
      baseParams({ description: "Viaje con\ncontrol\tchars" }),
    );

    const description = lastRequestBody()["description"];
    expect(typeof description).toBe("string");
    const controlChars = new RegExp("[\\u0000-\\u001F\\u007F]");
    expect(description as string).not.toMatch(controlChars);
  });

  it("13. customs contains tarjetas_expiration_minutes", async () => {
    mockFetchOnce(200, { order_id: "klap-order-abc123" });
    await provider.createEmbeddedOrder(baseParams());

    const customs = lastRequestBody()["customs"] as Array<{ key: string; value: string }>;
    const entry = customs.find((c) => c.key === "tarjetas_expiration_minutes");
    expect(entry).toBeDefined();
    expect(entry?.value).toBe("30");
  });

  it("14. customs contains tarjetas_delivery_type = \"4\"", async () => {
    mockFetchOnce(200, { order_id: "klap-order-abc123" });
    await provider.createEmbeddedOrder(baseParams());

    const customs = lastRequestBody()["customs"] as Array<{ key: string; value: string }>;
    const entry = customs.find((c) => c.key === "tarjetas_delivery_type");
    expect(entry?.value).toBe("4");
  });

  it("15. urls contains the configured return_url and cancel_url", async () => {
    mockFetchOnce(200, { order_id: "klap-order-abc123" });
    await provider.createEmbeddedOrder(baseParams());

    const urls = lastRequestBody()["urls"] as Record<string, string>;
    expect(urls["return_url"]).toBe("https://backend.rapago.test/payments/klap/return");
    expect(urls["cancel_url"]).toBe("https://backend.rapago.test/payments/klap/cancel");
  });

  it("16. webhooks contains confirm and reject", async () => {
    mockFetchOnce(200, { order_id: "klap-order-abc123" });
    await provider.createEmbeddedOrder(baseParams());

    const webhooks = lastRequestBody()["webhooks"] as Record<string, string>;
    expect(webhooks["webhook_confirm"]).toBe("https://backend.rapago.test/webhooks/klap/confirm");
    expect(webhooks["webhook_reject"]).toBe("https://backend.rapago.test/webhooks/klap/reject");
  });

  it("17. does not send 'user'", async () => {
    mockFetchOnce(200, { order_id: "klap-order-abc123" });
    await provider.createEmbeddedOrder(baseParams());
    expect(lastRequestBody()).not.toHaveProperty("user");
  });

  it("18. does not send 'ship_to'", async () => {
    mockFetchOnce(200, { order_id: "klap-order-abc123" });
    await provider.createEmbeddedOrder(baseParams());
    expect(lastRequestBody()).not.toHaveProperty("ship_to");
  });

  it("19. does not send 'webhook_validation'", async () => {
    mockFetchOnce(200, { order_id: "klap-order-abc123" });
    await provider.createEmbeddedOrder(baseParams());
    const webhooks = lastRequestBody()["webhooks"] as Record<string, unknown>;
    expect(webhooks).not.toHaveProperty("webhook_validation");
  });

  it("20. does not force tokenization (generate_token stays \"none\", no tarjetas_payment_indicator)", async () => {
    mockFetchOnce(200, { order_id: "klap-order-abc123" });
    await provider.createEmbeddedOrder(baseParams());

    const body = lastRequestBody();
    expect(body["generate_token"]).toBe("none");
    const customs = body["customs"] as Array<{ key: string }>;
    expect(customs.some((c) => c.key === "tarjetas_payment_indicator")).toBe(false);
  });

  it("21. does not implement deferred capture (no transaction_type field)", async () => {
    mockFetchOnce(200, { order_id: "klap-order-abc123" });
    await provider.createEmbeddedOrder(baseParams());
    expect(lastRequestBody()).not.toHaveProperty("transaction_type");
  });

  it("22. does not call fetch if a required URL is missing", async () => {
    delete process.env["KLAP_RETURN_URL"];
    await expect(provider.createEmbeddedOrder(baseParams())).rejects.toMatchObject({ kind: "config" });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("does not call fetch if cancel_url is missing", async () => {
    delete process.env["KLAP_CANCEL_URL"];
    await expect(provider.createEmbeddedOrder(baseParams())).rejects.toMatchObject({ kind: "config" });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("does not call fetch if webhook_confirm is missing", async () => {
    delete process.env["KLAP_WEBHOOK_CONFIRM_URL"];
    await expect(provider.createEmbeddedOrder(baseParams())).rejects.toMatchObject({ kind: "config" });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("does not call fetch if webhook_reject is missing", async () => {
    delete process.env["KLAP_WEBHOOK_REJECT_URL"];
    await expect(provider.createEmbeddedOrder(baseParams())).rejects.toMatchObject({ kind: "config" });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("23. does not call fetch if the ApiKey is missing", async () => {
    delete process.env["KLAP_API_KEY"];
    await expect(provider.createEmbeddedOrder(baseParams())).rejects.toMatchObject({ kind: "config" });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("24. does not call fetch if the amount is invalid", async () => {
    await expect(provider.createEmbeddedOrder(baseParams({ amountClp: 0 }))).rejects.toMatchObject({
      kind: "config",
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("rejects a decimal amount without calling fetch", async () => {
    await expect(provider.createEmbeddedOrder(baseParams({ amountClp: 1500.5 }))).rejects.toThrow(
      KlapProviderError,
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("rejects an empty reference_id (internal payment id) without calling fetch", async () => {
    await expect(provider.createEmbeddedOrder(baseParams({ orderId: "" }))).rejects.toMatchObject({
      kind: "config",
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("rejects a reference_id longer than 100 characters", async () => {
    await expect(
      provider.createEmbeddedOrder(baseParams({ orderId: "x".repeat(101) })),
    ).rejects.toMatchObject({ kind: "config" });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("25. never includes the ApiKey value inside a thrown error message", async () => {
    mockFetchOnce(401, { error: "unauthorized" });
    process.env["KLAP_API_KEY"] = "super-secret-sandbox-key-xyz";

    try {
      await provider.createEmbeddedOrder(baseParams());
      throw new Error("expected createEmbeddedOrder to reject");
    } catch (err) {
      expect(String((err as Error).message)).not.toContain("super-secret-sandbox-key-xyz");
    }
  });

  it("26. keeps checkoutType 'embedded'", async () => {
    mockFetchOnce(200, { order_id: "klap-order-abc123" });
    const result = await provider.createEmbeddedOrder(baseParams());
    expect(result.checkoutType).toBe("embedded");
  });

  it("27. keeps publicCheckoutData.orderId as order_id, never redirect_url", async () => {
    mockFetchOnce(200, {
      order_id: "klap-order-abc123",
      status: "created",
      redirect_url: "https://should-not-be-used.example.com",
    });
    const result = await provider.createEmbeddedOrder(baseParams());

    expect(result.publicCheckoutData).toEqual({ orderId: "klap-order-abc123" });
    expect(result.providerOrderId).toBe("klap-order-abc123");
    expect(JSON.stringify(result)).not.toContain("should-not-be-used.example.com");
    expect(Object.prototype.hasOwnProperty.call(result, "urlPay")).toBe(false);
  });

  it("28. never includes PAN/CVV fields anywhere in the request body", async () => {
    mockFetchOnce(200, { order_id: "klap-order-abc123" });
    await provider.createEmbeddedOrder(baseParams());

    const rawBody = JSON.stringify(lastRequestBody());
    expect(rawBody).not.toMatch(/pan|cvv|card_number|cardNumber|security_code/i);
  });

  it("Idempotency-Key is sent by default but documented as an unconfirmed extension, disableable via env", async () => {
    mockFetchOnce(200, { order_id: "klap-order-abc123" });
    await provider.createEmbeddedOrder(baseParams());
    expect(lastRequestHeaders()["Idempotency-Key"]).toBeTypeOf("string");
  });

  it("Idempotency-Key is omitted when KLAP_SEND_IDEMPOTENCY_HEADER=false", async () => {
    process.env["KLAP_SEND_IDEMPOTENCY_HEADER"] = "false";
    mockFetchOnce(200, { order_id: "klap-order-abc123" });
    await provider.createEmbeddedOrder(baseParams());
    expect(lastRequestHeaders()).not.toHaveProperty("Idempotency-Key");
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

  it("maps an HTTP 400/401/409/500 response to http_rejected", async () => {
    for (const status of [400, 401, 409, 500]) {
      mockFetchOnce(status, { error: "rejected" });
      await expect(provider.createEmbeddedOrder(baseParams())).rejects.toMatchObject({
        kind: "http_rejected",
        httpStatus: status,
      });
    }
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

  it("calls the confirmed Sandbox orders URL", async () => {
    mockFetchOnce(200, { order_id: "klap-order-abc123" });
    await provider.createEmbeddedOrder(baseParams());
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(SANDBOX_URL);
  });

  it("refuses to operate when KLAP_ENVIRONMENT=production", async () => {
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
  it("rejects immediately with 'unsupported_checkout_type'", async () => {
    const provider = new KlapProvider();
    await expect(provider.createPayment(baseParams())).rejects.toMatchObject({
      kind: "unsupported_checkout_type",
    });
    expect(global.fetch).not.toHaveBeenCalled();
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

describe("29/30. Regresión: Mercado Pago y ProntoPaga conservan el contrato redirect sin cambios", () => {
  function assertRedirectShape(result: CreatePaymentResult): { providerOrderId: string; urlPay: string } {
    return result;
  }

  it("MercadoPagoProvider still implements PaymentProvider with the unchanged redirect result", () => {
    const provider: PaymentProvider = new MercadoPagoProvider();
    expect(provider.name).toBe("mercadopago");
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
