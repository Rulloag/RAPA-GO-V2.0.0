// Klap Checkout Transparente — tipos internos.
//
// Alcance de esta fase (Fase B.2): corrección del contrato HTTP de creación de
// orden contra el OAS oficial 1.2.0
// (https://api.pasarela.multicaja.cl/docs/swagger/ecommerce_api_payments_tarjetas.yml).
// El webhook (Fase C) y su lógica financiera siguen sin implementarse aquí.
//
// CAMPOS CONFIRMADOS por el Swagger oficial (OAS 1.2.0):
//   - Endpoint: POST /payment-gateway/v1/orders.
//   - Header de autenticación: "apikey" (minúscula, sin guion — reemplaza el
//     "Api-Key" usado antes de confirmar el schema real).
//   - Cuerpo (OrderModel): reference_id, generate_token, amount{currency,total},
//     methods, description, customs[]{key,value}, urls{return_url,cancel_url},
//     webhooks{webhook_confirm,webhook_reject} (más user/ship_to/webhook_validation
//     y otros customs opcionales, deliberadamente NO enviados en esta fase — ver
//     nota de alcance mínimo más abajo).
//   - Respuesta (OrderModelResponse): al menos "order_id"; "status" y
//     "redirect_url" existen en el schema pero no se usan por Checkout
//     Transparente (redirect_url es del flujo de Checkout Pro/redirect, no del
//     embebido) — nunca se convierte redirect_url en urlPay.
//
// CAMPOS DELIBERADAMENTE NO ENVIADOS en esta fase (requieren decisión de negocio
// + documentación específica antes de agregarse): user, ship_to,
// webhook_validation, tarjetas_payment_indicator, notify_payment_user,
// notify_payment_merchant, notify_payment_email_merchant, transaction_type,
// tarjetas_card_type_allowed, tarjetas_quotas_allowed, recurring_amount_type.
//
// NO CONFIRMADO POR EL OAS 1.2.0 REVISADO: el header "Idempotency-Key" (heredado
// de la fase anterior, antes de tener el Swagger real). Se mantiene como
// extensión propia de Rapa Go, no como parte confirmada del contrato oficial —
// ver `KlapConfig.sendIdempotencyHeader` y su env var. Puede desactivarse si Klap
// rechaza headers no documentados. No se implementan reintentos automáticos.

import type { EmbeddedCheckoutResult } from "./payment.provider.js";

export type KlapEnvironment = "sandbox" | "production";

/**
 * Klap Checkout Transparente is embedded, never a redirect — this is the real
 * result shape `KlapProvider.createEmbeddedOrder()` returns. See the discriminated
 * union proposal in `payment.provider.ts` for why this is a separate method from
 * the legacy `PaymentProvider.createPayment()`.
 */
export type KlapEmbeddedCheckoutResult = EmbeddedCheckoutResult;

/** Config resuelta desde variables de entorno. Nunca se expone tal cual al frontend. */
export interface KlapConfig {
  environment: KlapEnvironment;
  ordersUrl: string;
  apiKey: string;
  requestTimeoutMs: number;
  returnUrl: string;
  cancelUrl: string;
  webhookConfirmUrl: string;
  webhookRejectUrl: string;
  orderExpirationMinutes: number;
  /** Extensión no confirmada por el OAS — ver nota de cabecera. */
  sendIdempotencyHeader: boolean;
}

// ── OrderModel (request) — OAS 1.2.0 ───────────────────────────────────────────

export interface KlapAmount {
  currency: "CLP";
  total: number;
}

export interface KlapCustom {
  key: string;
  value: string;
}

export interface KlapUrls {
  return_url: string;
  cancel_url: string;
}

export interface KlapWebhooks {
  webhook_confirm: string;
  webhook_reject: string;
}

/**
 * Cuerpo exacto enviado a POST {ordersUrl}. Contiene ÚNICAMENTE los campos del
 * alcance mínimo confirmado para Rapa Go — ver nota de cabecera para lo que se
 * omite a propósito.
 */
export interface KlapOrderRequest {
  reference_id: string;
  generate_token: "none";
  amount: KlapAmount;
  methods: ["tarjetas"];
  description: string;
  customs: KlapCustom[];
  urls: KlapUrls;
  webhooks: KlapWebhooks;
}

// ── OrderModelResponse — OAS 1.2.0 (subconjunto confirmado que se usa) ────────

/** Respuesta cruda de Klap, sin validar. Nunca se persiste ni se reenvía tal cual. */
export type KlapCreateOrderRawResponse = unknown;

/**
 * Subconjunto validado y mínimo de la respuesta que este provider efectivamente
 * usa. `status`/`redirect_url` existen en el OAS pero no se leen aquí —
 * Checkout Transparente no es un flujo de redirección.
 */
export interface KlapCreateOrderValidatedResponse {
  order_id: string;
}

export type KlapProviderErrorKind =
  | "config" // credenciales/URL/monto/reference_id inválidos o entorno no soportado en esta fase
  | "timeout" // AbortController disparado
  | "network" // fetch rechazó por un error de red (no timeout)
  | "http_rejected" // Klap respondió con un status HTTP no-2xx
  | "invalid_response" // 2xx pero el body no es JSON válido o no trae order_id
  | "unsupported_checkout_type"; // se llamó al método redirect-only sobre un provider embebido

/**
 * Error normalizado y saneado. `message` nunca debe contener la ApiKey ni el body
 * completo de la respuesta — solo lo mínimo para diagnosticar el fallo.
 */
export class KlapProviderError extends Error {
  readonly kind: KlapProviderErrorKind;
  readonly httpStatus: number | undefined;

  constructor(kind: KlapProviderErrorKind, message: string, httpStatus?: number) {
    super(message);
    this.name = "KlapProviderError";
    this.kind = kind;
    this.httpStatus = httpStatus;
  }
}
