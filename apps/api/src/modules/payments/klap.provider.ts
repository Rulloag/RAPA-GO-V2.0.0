import crypto from "node:crypto";
import type {
  PaymentProvider,
  CreatePaymentParams,
  CreatePaymentResult,
  NormalizedWebhook,
} from "./payment.provider.js";
import {
  KlapProviderError,
  type KlapConfig,
  type KlapOrderRequest,
  type KlapCreateOrderValidatedResponse,
  type KlapHostedCheckoutResult,
  type KlapOrderStatusValidatedResponse,
} from "./klap.types.js";

const KLAP_SANDBOX_ORDERS_URL_DEFAULT =
  "https://api-pasarela-sandbox.mcdesaqa.cl/payment-gateway/v1/orders";

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_ORDER_EXPIRATION_MINUTES = 30;
const MIN_AMOUNT_CLP = 50;
const MAX_AMOUNT_CLP = 99_999_999;
const MAX_REFERENCE_ID_LENGTH = 100;
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

const ALLOWED_SANDBOX_CHECKOUT_HOSTS = new Set([
  "pagos-pasarela-sandbox.mcdesaqa.cl",
]);

export function verifyKlapWebhookApikey(
  orderId: unknown,
  referenceId: unknown,
  headerApikey: unknown,
): boolean {
  try {
    if (typeof headerApikey !== "string" || !SHA256_HEX_PATTERN.test(headerApikey)) {
      return false;
    }
    if (typeof orderId !== "string" || orderId.length === 0) return false;
    if (typeof referenceId !== "string" || referenceId.length === 0) return false;

    const apiKey = process.env["KLAP_API_KEY"];
    if (!apiKey) return false;

    const expected = crypto
      .createHash("sha256")
      .update(referenceId + orderId + apiKey, "utf8")
      .digest("hex");

    const expectedBuffer = Buffer.from(expected, "hex");
    const receivedBuffer = Buffer.from(headerApikey, "hex");
    if (expectedBuffer.length !== receivedBuffer.length) return false;

    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
  } catch {
    return false;
  }
}

function parseBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (normalized === "false" || normalized === "0") return false;
  if (normalized === "true" || normalized === "1") return true;
  return defaultValue;
}

function assertValidHttpUrl(value: string, fieldName: string): void {
  if (!value) {
    throw new KlapProviderError("config", `${fieldName} is not configured.`);
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new KlapProviderError("config", `${fieldName} is not a valid URL.`);
  }

  if (parsed.protocol !== "https:") {
    throw new KlapProviderError("config", `${fieldName} must use HTTPS.`);
  }
}

function buildDefaultCallbackUrl(path: string): string {
  const base = String(process.env["PAYMENT_WEBHOOK_BASE_URL"] ?? "")
    .trim()
    .replace(/\/+$/, "");

  return base ? `${base}${path}` : "";
}

function getKlapConfig(): KlapConfig {
  const environment = (process.env["KLAP_ENVIRONMENT"] ?? "sandbox").trim();

  if (environment !== "sandbox") {
    throw new KlapProviderError(
      "config",
      `KlapProvider solo admite Sandbox en esta fase (recibido KLAP_ENVIRONMENT="${environment}").`,
    );
  }

  const ordersUrl =
    process.env["KLAP_SANDBOX_ORDERS_URL"] ??
    KLAP_SANDBOX_ORDERS_URL_DEFAULT;
  const apiKey = process.env["KLAP_API_KEY"] ?? "";
  const requestTimeoutMs = Number(
    process.env["KLAP_REQUEST_TIMEOUT_MS"] ?? DEFAULT_TIMEOUT_MS,
  );
  const returnUrl =
    process.env["KLAP_RETURN_URL"] ??
    buildDefaultCallbackUrl("/api/payments/return/klap");
  const cancelUrl =
    process.env["KLAP_CANCEL_URL"] ??
    buildDefaultCallbackUrl("/api/payments/cancel/klap");
  const webhookConfirmUrl =
    process.env["KLAP_WEBHOOK_CONFIRM_URL"] ??
    buildDefaultCallbackUrl("/api/webhooks/klap/confirm");
  const webhookRejectUrl =
    process.env["KLAP_WEBHOOK_REJECT_URL"] ??
    buildDefaultCallbackUrl("/api/webhooks/klap/reject");
  const orderExpirationMinutes = Number(
    process.env["KLAP_ORDER_EXPIRATION_MINUTES"] ??
      DEFAULT_ORDER_EXPIRATION_MINUTES,
  );

  // No aparece en el Swagger entregado. V108 lo desactiva por defecto.
  const sendIdempotencyHeader = parseBooleanEnv(
    process.env["KLAP_SEND_IDEMPOTENCY_HEADER"],
    false,
  );

  if (!apiKey) {
    throw new KlapProviderError("config", "KLAP_API_KEY is not configured.");
  }

  assertValidHttpUrl(ordersUrl, "KLAP_SANDBOX_ORDERS_URL");
  assertValidHttpUrl(returnUrl, "KLAP_RETURN_URL");
  assertValidHttpUrl(cancelUrl, "KLAP_CANCEL_URL");
  assertValidHttpUrl(webhookConfirmUrl, "KLAP_WEBHOOK_CONFIRM_URL");
  assertValidHttpUrl(webhookRejectUrl, "KLAP_WEBHOOK_REJECT_URL");

  if (
    !Number.isInteger(orderExpirationMinutes) ||
    orderExpirationMinutes <= 0
  ) {
    throw new KlapProviderError(
      "config",
      "KLAP_ORDER_EXPIRATION_MINUTES must be a positive integer.",
    );
  }

  return {
    environment: "sandbox",
    ordersUrl,
    apiKey,
    requestTimeoutMs:
      Number.isFinite(requestTimeoutMs) && requestTimeoutMs > 0
        ? requestTimeoutMs
        : DEFAULT_TIMEOUT_MS,
    returnUrl,
    cancelUrl,
    webhookConfirmUrl,
    webhookRejectUrl,
    orderExpirationMinutes,
    sendIdempotencyHeader,
  };
}

function validateAmountClp(amountClp: number): void {
  if (!Number.isInteger(amountClp)) {
    throw new KlapProviderError(
      "config",
      "amountClp must be an integer (CLP has no decimal subunit).",
    );
  }

  if (amountClp < MIN_AMOUNT_CLP || amountClp > MAX_AMOUNT_CLP) {
    throw new KlapProviderError(
      "config",
      `amountClp must be between ${MIN_AMOUNT_CLP} and ${MAX_AMOUNT_CLP} CLP.`,
    );
  }
}

function validateReferenceId(referenceId: string): void {
  if (!referenceId || referenceId.trim().length === 0) {
    throw new KlapProviderError("config", "reference_id must not be empty.");
  }

  if (referenceId.length > MAX_REFERENCE_ID_LENGTH) {
    throw new KlapProviderError(
      "config",
      `reference_id must be at most ${MAX_REFERENCE_ID_LENGTH} characters.`,
    );
  }
}

function sanitizeDescription(description: string): string {
  const controlChars = /[\u0000-\u001F\u007F]/g;
  return description
    .replace(controlChars, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 255);
}

function buildIdempotencyKey(internalPaymentId: string): string {
  return crypto
    .createHash("sha256")
    .update(`klap-create-order:${internalPaymentId}`)
    .digest("hex");
}

function asRecord(raw: unknown): Record<string, unknown> {
  if (typeof raw !== "object" || raw === null) {
    throw new KlapProviderError(
      "invalid_response",
      "Klap response is not a JSON object.",
    );
  }

  const record = raw as Record<string, unknown>;
  const data = record["data"];

  if (typeof data === "object" && data !== null && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }

  return record;
}

function readString(
  record: Record<string, unknown>,
  ...keys: string[]
): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return null;
}

function validateKlapRedirectUrl(value: string): string {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new KlapProviderError(
      "invalid_response",
      "Klap response contains an invalid redirect_url.",
    );
  }

  const hostname = parsed.hostname.toLowerCase();

  if (
    parsed.protocol !== "https:" ||
    !ALLOWED_SANDBOX_CHECKOUT_HOSTS.has(hostname)
  ) {
    throw new KlapProviderError(
      "unsafe_redirect",
      "Klap redirect_url does not belong to the approved Sandbox checkout host.",
    );
  }

  return parsed.toString();
}

function parseCreateOrderResponse(
  raw: unknown,
): KlapCreateOrderValidatedResponse {
  const record = asRecord(raw);
  const orderId = readString(record, "order_id", "orderId");
  const redirectUrl = readString(record, "redirect_url", "redirectUrl");
  const status = readString(record, "status");

  if (!orderId) {
    throw new KlapProviderError(
      "invalid_response",
      "Klap response is missing a valid order_id.",
    );
  }

  if (!redirectUrl) {
    throw new KlapProviderError(
      "invalid_response",
      "Klap response is missing the official redirect_url.",
    );
  }

  return {
    order_id: orderId,
    redirect_url: validateKlapRedirectUrl(redirectUrl),
    status,
  };
}

function readAmount(
  record: Record<string, unknown>,
): KlapOrderStatusValidatedResponse["amount"] {
  const rawAmount = record["amount"];

  if (typeof rawAmount !== "object" || rawAmount === null) {
    return null;
  }

  const amountRecord = rawAmount as Record<string, unknown>;
  const currency = readString(amountRecord, "currency");
  const rawTotal = amountRecord["total"];
  const total =
    typeof rawTotal === "number"
      ? rawTotal
      : typeof rawTotal === "string" && rawTotal.trim()
        ? Number(rawTotal)
        : null;

  return {
    currency,
    total: total !== null && Number.isFinite(total) ? total : null,
  };
}

function parseOrderStatusResponse(
  raw: unknown,
): KlapOrderStatusValidatedResponse {
  const record = asRecord(raw);
  const orderId = readString(record, "order_id", "orderId");
  const status = readString(record, "status");

  if (!orderId || !status) {
    throw new KlapProviderError(
      "invalid_response",
      "Klap order status response is missing order_id or status.",
    );
  }

  const redirectUrl = readString(record, "redirect_url", "redirectUrl");

  return {
    order_id: orderId,
    reference_id: readString(record, "reference_id", "referenceId"),
    status,
    redirect_url: redirectUrl
      ? validateKlapRedirectUrl(redirectUrl)
      : null,
    amount: readAmount(record),
    transaction_id: readString(
      record,
      "transaction_id",
      "transactionId",
      "cybs_reference_id",
    ),
    mc_code: readString(record, "mc_code", "mcCode"),
  };
}

async function fetchJson(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  operationName: string,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;

  try {
    response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new KlapProviderError(
        "timeout",
        `${operationName} timed out after ${timeoutMs}ms.`,
      );
    }

    throw new KlapProviderError(
      "network",
      `${operationName} failed due to a network error.`,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new KlapProviderError(
      "http_rejected",
      `${operationName} was rejected with HTTP ${response.status}.`,
      response.status,
    );
  }

  try {
    return await response.json();
  } catch {
    throw new KlapProviderError(
      "invalid_response",
      `${operationName} response body is not valid JSON.`,
    );
  }
}

export class KlapProvider implements PaymentProvider {
  readonly name = "klap";

  async createHostedOrder(
    params: CreatePaymentParams,
  ): Promise<KlapHostedCheckoutResult> {
    validateAmountClp(params.amountClp);
    validateReferenceId(params.orderId);

    const config = getKlapConfig();
    const expirationMinutes = String(config.orderExpirationMinutes);

    const body: KlapOrderRequest = {
      reference_id: params.orderId,
      generate_token: "none",
      amount: {
        currency: "CLP",
        total: params.amountClp,
      },
      methods: ["tarjetas"],
      description: sanitizeDescription(params.description),
      customs: [
        {
          key: "tarjetas_expiration_minutes",
          value: expirationMinutes,
        },
        {
          key: "tarjetas_payment_indicator",
          value: "typed",
        },
      ],
      urls: {
        return_url: config.returnUrl,
        cancel_url: config.cancelUrl,
      },
      webhooks: {
        webhook_confirm: config.webhookConfirmUrl,
        webhook_reject: config.webhookRejectUrl,
      },
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      apikey: config.apiKey,
    };

    if (config.sendIdempotencyHeader) {
      headers["Idempotency-Key"] = buildIdempotencyKey(params.orderId);
    }

    const raw = await fetchJson(
      config.ordersUrl,
      {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      },
      config.requestTimeoutMs,
      "Klap order creation",
    );

    const validated = parseCreateOrderResponse(raw);

    return {
      checkoutType: "redirect",
      providerOrderId: validated.order_id,
      urlPay: validated.redirect_url,
      publicCheckoutData: {
        orderId: validated.order_id,
        redirectUrl: validated.redirect_url,
        initialStatus: validated.status,
      },
    };
  }

  /**
   * Alias de transición V107 -> V108. Los clientes antiguos pueden conservar
   * el nombre del método, pero el resultado ya es un checkout redirect oficial.
   */
  async createEmbeddedOrder(
    params: CreatePaymentParams,
  ): Promise<KlapHostedCheckoutResult> {
    return this.createHostedOrder(params);
  }

  async createPayment(
    params: CreatePaymentParams,
  ): Promise<CreatePaymentResult> {
    const result = await this.createHostedOrder(params);

    return {
      providerOrderId: result.providerOrderId,
      urlPay: result.urlPay,
    };
  }

  async getOrder(
    orderId: string,
  ): Promise<KlapOrderStatusValidatedResponse> {
    validateReferenceId(orderId);

    const config = getKlapConfig();
    const url = `${config.ordersUrl.replace(/\/+$/, "")}/${encodeURIComponent(
      orderId,
    )}`;

    const raw = await fetchJson(
      url,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          apikey: config.apiKey,
        },
      },
      config.requestTimeoutMs,
      "Klap order status query",
    );

    return parseOrderStatusResponse(raw);
  }

  verifyWebhookSignature(
    payload: Record<string, unknown>,
    headers: Record<string, string>,
  ): boolean {
    return verifyKlapWebhookApikey(
      payload["order_id"],
      payload["reference_id"],
      headers["apikey"],
    );
  }

  async normalizeWebhook(
    _payload: Record<string, unknown>,
    _headers: Record<string, string>,
  ): Promise<NormalizedWebhook> {
    throw new KlapProviderError(
      "config",
      "Klap confirm/reject use dedicated signed handlers.",
    );
  }
}
