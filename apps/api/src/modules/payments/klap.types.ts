// Klap Checkout alojado — contrato interno basado en el Swagger oficial
// entregado por Klap (Order API 1.0.1 y Order Tarjetas 1.2.0).
//
// Flujo:
//   1. POST /payment-gateway/v1/orders
//   2. Validar order_id + redirect_url
//   3. Abrir redirect_url alojado por Klap
//   4. Confirmar por webhook y, como respaldo, GET /orders/{order_id}
//
// RAPA GO nunca recibe PAN ni CVV en este flujo.

import type { RedirectCheckoutResult } from "./payment.provider.js";

export type KlapEnvironment = "sandbox" | "production";

export interface KlapHostedCheckoutResult extends RedirectCheckoutResult {
  checkoutType: "redirect";
  publicCheckoutData: {
    orderId: string;
    redirectUrl: string;
    initialStatus: string | null;
  };
}

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
  /** Header no documentado por Swagger; por seguridad se desactiva por defecto. */
  sendIdempotencyHeader: boolean;
}

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

export type KlapCreateOrderRawResponse = unknown;

export interface KlapCreateOrderValidatedResponse {
  order_id: string;
  redirect_url: string;
  status: string | null;
}

export interface KlapOrderStatusValidatedResponse {
  order_id: string;
  reference_id: string | null;
  status: string;
  redirect_url: string | null;
  amount: {
    currency: string | null;
    total: number | null;
  } | null;
  transaction_id: string | null;
  mc_code: string | null;
}

export type KlapProviderErrorKind =
  | "config"
  | "timeout"
  | "network"
  | "http_rejected"
  | "invalid_response"
  | "unsafe_redirect";

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
