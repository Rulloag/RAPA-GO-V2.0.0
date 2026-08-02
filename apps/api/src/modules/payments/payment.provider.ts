// ── Shared param / result types ────────────────────────────────────────────────

export interface CreatePaymentParams {
  orderId:        string;   // Our internal payment UUID (passed as external_reference to provider)
  amountClp:      number;
  description:    string;
  passengerEmail: string;
  passengerName:  string;
  returnUrl:      string;
  webhookUrl:     string;
}

export interface CreatePaymentResult {
  providerOrderId: string;  // Provider's own order / preference ID
  urlPay:          string;
}

// ── Checkout result contract (proposed extension, NOT wired in yet) ───────────
//
// `CreatePaymentResult` above assumes every provider redirects the passenger to a
// hosted checkout URL (Mercado Pago, ProntoPaga). Klap Checkout Transparente does
// not redirect — it hands the frontend an `order_id` to initialize an embedded
// script on the same screen. Forcing that into `urlPay` means either an empty
// string used as a control signal, or the order_id disguised as a fake URL — both
// explicitly rejected for this integration.
//
// The types below describe the CORRECT long-term contract: a discriminated union
// so a redirect result can never be mistaken for an embedded one at compile time.
// They are intentionally NOT used yet by `PaymentProvider.createPayment` or by
// `CreatePaymentResult` — adopting them there requires updating every call site
// that destructures `result.urlPay` directly (payments.service.ts:1274-1349), which
// is out of scope for this change and requires separate authorization (Fase D).
// Until then, Klap exposes its own `createEmbeddedOrder()` method (see
// klap.provider.ts) returning `EmbeddedCheckoutResult` directly, instead of lying
// through the legacy `createPayment()`/`CreatePaymentResult` shape.

export type CheckoutType = "redirect" | "embedded";

export interface RedirectCheckoutResult {
  checkoutType: "redirect";
  providerOrderId: string;
  urlPay: string;
}

export interface EmbeddedCheckoutResult {
  checkoutType: "embedded";
  providerOrderId: string;
  /** Only public, non-secret data the frontend needs to initialize the provider's script. */
  publicCheckoutData: {
    orderId: string;
  };
}

/** Proposed future return type of `PaymentProvider.createPayment` — see note above. */
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
