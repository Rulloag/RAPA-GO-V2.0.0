// ── Shared param / result types ────────────────────────────────────────────────

export interface CreatePaymentParams {
  orderId:        string;   // Our internal payment UUID (passed as external_reference to provider)
  amountClp:      number;
  description:    string;
  passengerEmail: string;
  passengerName:  string;
  returnUrl:      string;
  webhookUrl:     string;
  /** Solo RapaGo más veloz ($800) usa venta inmediata. El viaje sigue en authorization. */
  transactionType?: "authorization" | "sale";
}

export interface CreatePaymentResult {
  providerOrderId: string;  // Provider's own order / preference ID
  urlPay:          string;
}

// ── Checkout result contract ──────────────────────────────────────────────────
//
// Los proveedores pueden devolver un checkout alojado (redirect) o embebido.
// Klap V108 usa exclusivamente `redirect`, tomando el `redirect_url` oficial
// entregado por POST /payment-gateway/v1/orders. La variante embedded se
// conserva por compatibilidad tipada con otros módulos históricos.

export type CheckoutType = "redirect" | "embedded";

export interface RedirectCheckoutResult {
  checkoutType: "redirect";
  providerOrderId: string;
  urlPay: string;
}

export interface EmbeddedCheckoutResult {
  checkoutType: "embedded";
  providerOrderId: string;
  publicCheckoutData: {
    orderId: string;
  };
}

export type CheckoutResult = RedirectCheckoutResult | EmbeddedCheckoutResult;

export type NormalizedStatus = "success" | "rejected" | "pending" | "unknown";

export interface NormalizedWebhook {
  orderId:     string;   // Our internal payment UUID (from external_reference or body field)
  status:      NormalizedStatus;
  externalId:  string;   // Provider's transaction / payment ID
  rawPayload:  Record<string, unknown>;
}

// ── Provider contract ──────────────────────────────────────────────────────────

export interface PaymentProvider {
  readonly name: string;

  /** Initiate a payment and return the URL the passenger should visit. */
  createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult>;

  /**
   * Verify the webhook came from the real provider.
   * @param payload  Parsed JSON body
   * @param headers  Relevant HTTP headers (e.g. x-signature for MercadoPago)
   */
  verifyWebhookSignature(
    payload: Record<string, unknown>,
    headers: Record<string, string>,
  ): boolean;

  /**
   * Normalise a raw webhook into provider-agnostic fields.
   * May make an additional API call (e.g. MercadoPago requires a GET to retrieve status).
   */
  normalizeWebhook(
    payload: Record<string, unknown>,
    headers: Record<string, string>,
  ): Promise<NormalizedWebhook>;
}
