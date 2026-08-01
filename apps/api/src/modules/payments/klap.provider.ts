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
  type KlapCreateOrderRequestBody,
  type KlapCreateOrderValidatedResponse,
  type KlapEmbeddedCheckoutResult,
} from "./klap.types.js";

// Endpoints confirmados textualmente en la documentación entregada por el usuario.
// Ya incluyen "/orders" — el provider NUNCA concatena un sufijo adicional, evitando
// el riesgo de duplicar la ruta.
const KLAP_SANDBOX_ORDERS_URL_DEFAULT =
  "https://api-pasarela-sandbox.mcdesaqa.cl/payment-gateway/v1/orders";
const KLAP_PRODUCTION_ORDERS_URL_DEFAULT =
  "https://api.pasarela.multicaja.cl/payment-gateway/v1/orders";

const DEFAULT_TIMEOUT_MS = 10_000;

// Techo de seguridad propio de Rapa Go (NO documentado por Klap) — evita enviar un
// monto absurdo por un bug de cálculo aguas arriba. Ajustable si el negocio lo requiere.
const MAX_SANE_AMOUNT_CLP = 50_000_000;

function getKlapConfig(): KlapConfig {
  const environment = (process.env["KLAP_ENVIRONMENT"] ?? "sandbox").trim();

  // Esta fase es Sandbox-only por instrucción explícita: el provider se niega a operar
  // en producción incluso si alguien configura KLAP_ENVIRONMENT=production por error.
  if (environment !== "sandbox") {
    throw new KlapProviderError(
      "config",
      `KlapProvider solo admite Sandbox en esta fase (recibido KLAP_ENVIRONMENT="${environment}"). ` +
        "Producción se implementará en una fase posterior, tras certificación.",
    );
  }

  const ordersUrl = process.env["KLAP_SANDBOX_ORDERS_URL"] ?? KLAP_SANDBOX_ORDERS_URL_DEFAULT;
  const apiKey = process.env["KLAP_API_KEY"] ?? "";
  const requestTimeoutMs = Number(process.env["KLAP_REQUEST_TIMEOUT_MS"] ?? DEFAULT_TIMEOUT_MS);

  if (!apiKey) {
    throw new KlapProviderError("config", "KLAP_API_KEY is not configured.");
  }
  if (!ordersUrl) {
    throw new KlapProviderError("config", "Klap orders URL is not configured.");
  }

  return {
    environment: "sandbox",
    ordersUrl,
    apiKey,
    requestTimeoutMs: Number.isFinite(requestTimeoutMs) && requestTimeoutMs > 0
      ? requestTimeoutMs
      : DEFAULT_TIMEOUT_MS,
  };
}

function validateAmountClp(amountClp: number): void {
  if (!Number.isInteger(amountClp)) {
    throw new KlapProviderError(
      "config",
      "amountClp must be an integer (CLP has no decimal subunit).",
    );
  }
  if (amountClp <= 0) {
    throw new KlapProviderError("config", "amountClp must be greater than zero.");
  }
  if (amountClp > MAX_SANE_AMOUNT_CLP) {
    throw new KlapProviderError(
      "config",
      `amountClp exceeds the configured safety ceiling (${MAX_SANE_AMOUNT_CLP} CLP).`,
    );
  }
}

/**
 * Idempotency-Key server-side, determinística a partir del pago interno.
 * Nunca se acepta desde el móvil — `params.orderId` es el UUID interno de Rapa Go,
 * generado por el backend antes de llegar aquí (ver payments.service.ts).
 * Ser determinística permite que un reintento del mismo intento de creación de
 * orden reutilice la misma clave en vez de generar una orden duplicada.
 */
function buildIdempotencyKey(internalPaymentId: string): string {
  return crypto.createHash("sha256").update(`klap-create-order:${internalPaymentId}`).digest("hex");
}

/** Valida el `unknown` devuelto por `response.json()` antes de confiar en él. */
function parseKlapOrderResponse(raw: unknown): KlapCreateOrderValidatedResponse {
  if (typeof raw !== "object" || raw === null) {
    throw new KlapProviderError("invalid_response", "Klap response is not a JSON object.");
  }

  const orderId = (raw as Record<string, unknown>)["order_id"];
  if (typeof orderId !== "string" || orderId.trim().length === 0) {
    throw new KlapProviderError("invalid_response", "Klap response is missing a valid order_id.");
  }

  return { order_id: orderId };
}

export class KlapProvider implements PaymentProvider {
  readonly name = "klap";

  /**
   * Real, correctly-typed entry point for Klap Checkout Transparente. Returns a
   * discriminated `checkoutType: "embedded"` result — the frontend uses
   * `publicCheckoutData.orderId` to initialize Klap's official script on the same
   * screen. There is no `urlPay`/redirect here because Transparente does not
   * redirect. This is what Fase D (Payments Service) and the Fase E frontend must
   * call once wired — not `createPayment()` below.
   */
  async createEmbeddedOrder(params: CreatePaymentParams): Promise<KlapEmbeddedCheckoutResult> {
    validateAmountClp(params.amountClp);
    const config = getKlapConfig();

    const idempotencyKey = buildIdempotencyKey(params.orderId);

    const body: KlapCreateOrderRequestBody = {
      consumer_transaction_id: params.orderId,
      amount: params.amountClp,
      currency: "CLP",
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);

    let response: Response;
    try {
      response = await fetch(config.ordersUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Api-Key": config.apiKey,
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new KlapProviderError(
          "timeout",
          `Klap order creation timed out after ${config.requestTimeoutMs}ms.`,
        );
      }
      throw new KlapProviderError("network", "Klap order creation failed due to a network error.");
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      // Nunca se registran headers ni el body completo — solo el status HTTP.
      throw new KlapProviderError(
        "http_rejected",
        `Klap order creation was rejected with HTTP ${response.status}.`,
        response.status,
      );
    }

    let raw: unknown;
    try {
      raw = await response.json();
    } catch {
      throw new KlapProviderError("invalid_response", "Klap response body is not valid JSON.");
    }

    const validated = parseKlapOrderResponse(raw);

    return {
      checkoutType: "embedded",
      providerOrderId: validated.order_id,
      publicCheckoutData: {
        orderId: validated.order_id,
      },
    };
  }

  /**
   * Present only for structural compliance with the legacy `PaymentProvider`
   * interface (required so `KlapProvider implements PaymentProvider` compiles).
   * KlapProvider is NOT registered in `provider.registry.ts` yet, so this is
   * unreachable from real traffic today.
   *
   * It deliberately REFUSES to run rather than silently returning `urlPay: ""` —
   * an empty string is a control-signal hack, and Checkout Transparente has no
   * real redirect URL to give honestly. Treating an embedded checkout as a
   * redirect one must fail loudly, not fake a value. Real callers must use
   * `createEmbeddedOrder()` above; wiring this into `PaymentsService` requires
   * Fase D to update `PaymentProvider`/`CreatePaymentResult` (or branch by
   * provider name) — explicitly out of scope for this change.
   */
  async createPayment(_params: CreatePaymentParams): Promise<CreatePaymentResult> {
    throw new KlapProviderError(
      "unsupported_checkout_type",
      "KlapProvider does not support the redirect PaymentProvider.createPayment() contract. " +
        "Klap Checkout Transparente is embedded, not redirect-based — call createEmbeddedOrder() " +
        "instead. Wiring this into PaymentsService is Fase D scope.",
    );
  }

  /**
   * NO IMPLEMENTADO EN ESTA FASE (Fase C — Webhook).
   * Devuelve `false` por diseño (deny-by-default) para que ningún código que
   * llame a este provider fuera de esta fase pueda confiar accidentalmente en un
   * webhook de Klap como válido antes de que el mecanismo real esté confirmado
   * contra la documentación oficial.
   */
  verifyWebhookSignature(_payload: Record<string, unknown>, _headers: Record<string, string>): boolean {
    return false;
  }

  /**
   * NO IMPLEMENTADO EN ESTA FASE (Fase C — Webhook).
   */
  async normalizeWebhook(
    _payload: Record<string, unknown>,
    _headers: Record<string, string>,
  ): Promise<NormalizedWebhook> {
    throw new KlapProviderError(
      "config",
      "KlapProvider.normalizeWebhook is not implemented yet (scheduled for Fase C).",
    );
  }
}
