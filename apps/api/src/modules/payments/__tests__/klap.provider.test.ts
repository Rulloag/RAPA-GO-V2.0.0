import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { KlapProvider, verifyKlapWebhookApikey } from "../klap.provider.js";
import type { CreatePaymentParams } from "../payment.provider.js";

const SANDBOX_ORDERS_URL =
  "https://api-pasarela-sandbox.mcdesaqa.cl/payment-gateway/v1/orders";
const CHECKOUT_URL =
  "https://pagos-pasarela-sandbox.mcdesaqa.cl/order/test-order-123";

function params(
  overrides: Partial<CreatePaymentParams> = {},
): CreatePaymentParams {
  return {
    orderId: "00000000-0000-4000-8000-000000000123",
    amountClp: 5000,
    description: "Viaje Rapa Go",
    passengerEmail: "pasajero@example.com",
    passengerName: "Pasajero",
    returnUrl: "https://backend.rapago.cl/api/payments/return/klap",
    webhookUrl: "https://backend.rapago.cl/api/webhooks/klap/confirm",
    ...overrides,
  };
}

function mockJson(
  status: number,
  payload: unknown,
  ok = status >= 200 && status < 300,
): void {
  global.fetch = vi.fn().mockResolvedValueOnce({
    ok,
    status,
    json: vi.fn().mockResolvedValue(payload),
  } as unknown as Response);
}

function request(): [string, RequestInit] {
  return (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [
    string,
    RequestInit,
  ];
}

beforeEach(() => {
  vi.restoreAllMocks();
  process.env["KLAP_ENVIRONMENT"] = "sandbox";
  process.env["KLAP_API_KEY"] = "sandbox-secret";
  process.env["KLAP_RETURN_URL"] =
    "https://backend.rapago.cl/api/payments/return/klap";
  process.env["KLAP_CANCEL_URL"] =
    "https://backend.rapago.cl/api/payments/cancel/klap";
  process.env["KLAP_WEBHOOK_CONFIRM_URL"] =
    "https://backend.rapago.cl/api/webhooks/klap/confirm";
  process.env["KLAP_WEBHOOK_REJECT_URL"] =
    "https://backend.rapago.cl/api/webhooks/klap/reject";
  process.env["KLAP_ORDER_EXPIRATION_MINUTES"] = "30";
  process.env["KLAP_SEND_IDEMPOTENCY_HEADER"] = "false";
  delete process.env["KLAP_SANDBOX_ORDERS_URL"];
  delete process.env["KLAP_REQUEST_TIMEOUT_MS"];
});

describe("KlapProvider V108 — checkout alojado oficial", () => {
  it("crea la orden en el endpoint oficial y devuelve redirect_url", async () => {
    mockJson(201, {
      order_id: "test-order-123",
      status: "pending",
      redirect_url: CHECKOUT_URL,
    });

    const result = await new KlapProvider().createHostedOrder(params());

    expect(result).toEqual({
      checkoutType: "redirect",
      providerOrderId: "test-order-123",
      urlPay: CHECKOUT_URL,
      publicCheckoutData: {
        orderId: "test-order-123",
        redirectUrl: CHECKOUT_URL,
        initialStatus: "pending",
      },
    });

    const [url, init] = request();
    expect(url).toBe(SANDBOX_ORDERS_URL);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["apikey"]).toBe(
      "sandbox-secret",
    );
  });

  it("envía el contrato de orden sin PAN, CVV ni /cards/receipt", async () => {
    mockJson(201, {
      order_id: "test-order-123",
      status: "pending",
      redirect_url: CHECKOUT_URL,
    });

    await new KlapProvider().createHostedOrder(
      params({ description: "Viaje\nAeropuerto" }),
    );

    const [, init] = request();
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    const raw = JSON.stringify(body);

    expect(body["reference_id"]).toBe(params().orderId);
    expect(body["methods"]).toEqual(["tarjetas"]);
    expect(body["amount"]).toEqual({ currency: "CLP", total: 5000 });
    expect(body["urls"]).toEqual({
      return_url: process.env["KLAP_RETURN_URL"],
      cancel_url: process.env["KLAP_CANCEL_URL"],
    });
    expect(body["webhooks"]).toEqual({
      webhook_confirm: process.env["KLAP_WEBHOOK_CONFIRM_URL"],
      webhook_reject: process.env["KLAP_WEBHOOK_REJECT_URL"],
    });
    expect(body["customs"]).toEqual(
      expect.arrayContaining([
        { key: "tarjetas_expiration_minutes", value: "30" },
        { key: "tarjetas_payment_indicator", value: "typed" },
        { key: "transaction_type", value: "authorization" },
      ]),
    );
    expect(raw).not.toMatch(/pan|cvv|card_number|security_code|cards\/receipt/i);
  });

  it("la orden siempre declara transaction_type=authorization (captura diferida, nunca controlada por el cliente)", async () => {
    mockJson(201, {
      order_id: "test-order-123",
      redirect_url: CHECKOUT_URL,
    });

    await new KlapProvider().createHostedOrder(params());

    const [, init] = request();
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    const customs = body["customs"] as Array<{ key: string; value: string }>;

    expect(customs.find((c) => c.key === "transaction_type")).toEqual({
      key: "transaction_type",
      value: "authorization",
    });
  });

  it("no envía Idempotency-Key por defecto porque no aparece en el Swagger entregado", async () => {
    delete process.env["KLAP_SEND_IDEMPOTENCY_HEADER"];
    mockJson(201, {
      order_id: "test-order-123",
      redirect_url: CHECKOUT_URL,
    });

    await new KlapProvider().createHostedOrder(params());

    expect(request()[1].headers).not.toHaveProperty("Idempotency-Key");
  });

  it("permite habilitar Idempotency-Key de forma explícita", async () => {
    process.env["KLAP_SEND_IDEMPOTENCY_HEADER"] = "true";
    mockJson(201, {
      order_id: "test-order-123",
      redirect_url: CHECKOUT_URL,
    });

    await new KlapProvider().createHostedOrder(params());

    expect(
      (request()[1].headers as Record<string, string>)["Idempotency-Key"],
    ).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rechaza redirect_url fuera del host oficial de sandbox", async () => {
    mockJson(201, {
      order_id: "test-order-123",
      redirect_url: "https://evil.example/checkout",
    });

    await expect(
      new KlapProvider().createHostedOrder(params()),
    ).rejects.toMatchObject({ kind: "unsafe_redirect" });
  });

  it("rechaza respuestas sin order_id o redirect_url", async () => {
    mockJson(201, { status: "pending" });

    await expect(
      new KlapProvider().createHostedOrder(params()),
    ).rejects.toMatchObject({ kind: "invalid_response" });

    mockJson(201, { order_id: "test-order-123" });

    await expect(
      new KlapProvider().createHostedOrder(params()),
    ).rejects.toMatchObject({ kind: "invalid_response" });
  });

  it("consulta GET /orders/{order_id} y normaliza estado", async () => {
    mockJson(200, {
      order_id: "test-order-123",
      reference_id: params().orderId,
      status: "approved",
      amount: { currency: "CLP", total: 5000 },
      transaction_id: "transaction-789",
      mc_code: "91856202",
      redirect_url: CHECKOUT_URL,
    });

    const order = await new KlapProvider().getOrder("test-order-123");

    expect(request()[0]).toBe(`${SANDBOX_ORDERS_URL}/test-order-123`);
    expect(request()[1].method).toBe("GET");
    expect(order).toMatchObject({
      order_id: "test-order-123",
      reference_id: params().orderId,
      status: "approved",
      transaction_id: "transaction-789",
      amount: { currency: "CLP", total: 5000 },
    });
  });

  it("mapea timeout, red y HTTP sin filtrar la ApiKey", async () => {
    const abort = new Error("aborted");
    abort.name = "AbortError";
    global.fetch = vi.fn().mockRejectedValueOnce(abort);

    await expect(
      new KlapProvider().createHostedOrder(params()),
    ).rejects.toMatchObject({ kind: "timeout" });

    global.fetch = vi.fn().mockRejectedValueOnce(new Error("ECONNRESET"));

    await expect(
      new KlapProvider().createHostedOrder(params()),
    ).rejects.toMatchObject({ kind: "network" });

    mockJson(500, { error: "sandbox down" }, false);

    try {
      await new KlapProvider().createHostedOrder(params());
      throw new Error("expected rejection");
    } catch (error) {
      expect(error).toMatchObject({ kind: "http_rejected", httpStatus: 500 });
      expect(String((error as Error).message)).not.toContain("sandbox-secret");
    }
  });

  it("mantiene alias createEmbeddedOrder solo para transición, con resultado redirect", async () => {
    mockJson(201, {
      order_id: "test-order-123",
      redirect_url: CHECKOUT_URL,
    });

    const result = await new KlapProvider().createEmbeddedOrder(params());
    expect(result.checkoutType).toBe("redirect");
    expect(result.publicCheckoutData.redirectUrl).toBe(CHECKOUT_URL);
  });

  it("createPayment conserva el contrato redirect genérico", async () => {
    mockJson(201, {
      order_id: "test-order-123",
      redirect_url: CHECKOUT_URL,
    });

    await expect(new KlapProvider().createPayment(params())).resolves.toEqual({
      providerOrderId: "test-order-123",
      urlPay: CHECKOUT_URL,
    });
  });

  it("valida montos CLP y no opera en producción todavía", async () => {
    await expect(
      new KlapProvider().createHostedOrder(params({ amountClp: 49 })),
    ).rejects.toMatchObject({ kind: "config" });

    process.env["KLAP_ENVIRONMENT"] = "production";

    await expect(
      new KlapProvider().createHostedOrder(params()),
    ).rejects.toMatchObject({ kind: "config" });
  });
});

describe("KlapProvider.captureOrder", () => {
  it("hace POST a {ordersUrl}/{orderId}/capture con body {amount} y header apikey, sin Idempotency-Key", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(JSON.stringify({ status: "captured" })),
    } as unknown as Response);

    const result = await new KlapProvider().captureOrder({
      orderId: "test-order-123",
      amountClp: 5000,
    });

    const [url, init] = request();
    expect(url).toBe(`${SANDBOX_ORDERS_URL}/test-order-123/capture`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ amount: 5000 });
    expect((init.headers as Record<string, string>)["apikey"]).toBe(
      "sandbox-secret",
    );
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/json",
    );
    expect(init.headers).not.toHaveProperty("Idempotency-Key");
    expect(result).toEqual({
      httpStatus: 200,
      sanitizedResponse: { status: "captured" },
    });
  });

  it("trata cualquier 2xx como aceptado y lee el body de forma defensiva (incluyendo vacío)", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 204,
      text: vi.fn().mockResolvedValue(""),
    } as unknown as Response);

    const result = await new KlapProvider().captureOrder({
      orderId: "test-order-123",
      amountClp: 5000,
    });

    expect(result).toEqual({ httpStatus: 204, sanitizedResponse: null });
  });

  it("nunca filtra la ApiKey ni datos sensibles al leer el body de captura", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: vi
        .fn()
        .mockResolvedValue(
          JSON.stringify({
            status: "captured",
            nested: { card_number: "4111111111111111" },
            amount: 5000,
          }),
        ),
    } as unknown as Response);

    const result = await new KlapProvider().captureOrder({
      orderId: "test-order-123",
      amountClp: 5000,
    });

    expect(result.sanitizedResponse).toEqual({
      status: "captured",
      amount: 5000,
    });
    expect(JSON.stringify(result.sanitizedResponse)).not.toContain(
      "4111111111111111",
    );
  });

  it("lanza KlapProviderError con httpStatus en respuestas no-2xx (rechazo definitivo de Klap)", async () => {
    mockJson(400, { error: "invalid amount" }, false);

    try {
      await new KlapProvider().captureOrder({
        orderId: "test-order-123",
        amountClp: 5000,
      });
      throw new Error("expected rejection");
    } catch (error) {
      expect(error).toMatchObject({ kind: "http_rejected", httpStatus: 400 });
      expect(String((error as Error).message)).not.toContain("sandbox-secret");
    }
  });

  it("mapea timeout y errores de red sin reintentar automáticamente", async () => {
    const abort = new Error("aborted");
    abort.name = "AbortError";
    global.fetch = vi.fn().mockRejectedValueOnce(abort);

    await expect(
      new KlapProvider().captureOrder({ orderId: "test-order-123", amountClp: 5000 }),
    ).rejects.toMatchObject({ kind: "timeout" });

    global.fetch = vi.fn().mockRejectedValueOnce(new Error("ECONNRESET"));

    await expect(
      new KlapProvider().captureOrder({ orderId: "test-order-123", amountClp: 5000 }),
    ).rejects.toMatchObject({ kind: "network" });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("rechaza montos inválidos antes de llamar a Klap", async () => {
    global.fetch = vi.fn();

    await expect(
      new KlapProvider().captureOrder({ orderId: "test-order-123", amountClp: 0 }),
    ).rejects.toMatchObject({ kind: "config" });

    await expect(
      new KlapProvider().captureOrder({ orderId: "", amountClp: 5000 }),
    ).rejects.toMatchObject({ kind: "config" });

    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe("Klap webhook apikey", () => {
  it("verifica SHA-256(reference_id + order_id + apiKey)", () => {
    const orderId = "test-order-123";
    const referenceId = params().orderId;
    const apikey = crypto
      .createHash("sha256")
      .update(referenceId + orderId + "sandbox-secret", "utf8")
      .digest("hex");

    expect(verifyKlapWebhookApikey(orderId, referenceId, apikey)).toBe(true);
    expect(verifyKlapWebhookApikey(orderId, referenceId, "bad")).toBe(false);
  });
});
