import { z } from "zod";

// ── Create payment ─────────────────────────────────────────────────────────────

export const createPaymentSchema = z.object({
  rideRequestId: z.string().uuid("rideRequestId must be a valid UUID."),
  paymentPurpose: z.enum(["ride", "fast_search"]).optional().default("ride"),
});

export type CreatePaymentInput = z.input<typeof createPaymentSchema>;

// ── Create Klap embedded order (Sandbox only, Fase D) ────────────────────────
//
// Deliberately minimal: only the ride the passenger owns. No amount, no
// provider, no paymentPurpose — the server always computes the authoritative
// fare from the ride record itself (see PaymentsService.createKlapEmbeddedOrder).

export const createKlapEmbeddedOrderSchema = z.object({
  rideRequestId: z.string().uuid("rideRequestId must be a valid UUID."),
});

export type CreateKlapEmbeddedOrderInput = z.input<typeof createKlapEmbeddedOrderSchema>;



// ── Conciliación segura del regreso de Mercado Pago ───────────────────────────

export const reconcileMercadoPagoPaymentSchema = z.object({
  providerPaymentId: z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => value == null ? undefined : String(value).trim())
    .refine((value) => value == null || /^\d+$/.test(value), {
      message: "providerPaymentId must contain only digits.",
    }),
});

export type ReconcileMercadoPagoPaymentInput = z.infer<
  typeof reconcileMercadoPagoPaymentSchema
>;

// ── ProntoPaga webhook ─────────────────────────────────────────────────────────

export const prontoPagaWebhookSchema = z
  .object({
    order:          z.string().optional(),
    order_id:       z.string().optional(),
    status:         z.string(),
    amount:         z.union([z.string(), z.number()]).optional(),
    external_id:    z.string().optional(),
    transaction_id: z.string().optional(),
    signature:      z.string(),
  })
  .passthrough()
  .refine(
    (d) => Boolean(d.order ?? d.order_id),
    { message: "Webhook payload must include 'order' or 'order_id'." },
  );

export type ProntoPagaWebhookBody = z.infer<typeof prontoPagaWebhookSchema>;

// ── MercadoPago webhook ────────────────────────────────────────────────────────

export const mercadoPagoWebhookSchema = z
  .object({
    id:           z.union([z.string(), z.number()]).optional(),
    live_mode:    z.boolean().optional(),
    type:         z.string(),
    date_created: z.string().optional(),
    action:       z.string().optional(),
    data:         z.object({ id: z.union([z.string(), z.number()]) }).optional(),
  })
  .passthrough();

export type MercadoPagoWebhookBody = z.infer<typeof mercadoPagoWebhookSchema>;

// ── Klap webhooks (Fase C) ─────────────────────────────────────────────────────
//
// Two separate, minimally-permissive schemas — not one shared "anything goes"
// shape — matching the two distinct payloads Klap documents for confirm/reject.
// `unknown`/explicit bounds throughout; never `.passthrough()` here, since
// unlike ProntoPaga/MercadoPago (whose extra fields are read defensively via
// helper lookups) Klap's confirm payload can carry token_id/bin, which this
// integration must never even parse into a named field it might accidentally
// log or persist.

const KLAP_ID_MAX_LENGTH = 100;
const KLAP_SHORT_FIELD_MAX_LENGTH = 64;
// Generous defensive input cap only (rejects grossly oversized payloads).
// The actual persisted/logged length is truncated separately and more
// tightly by the service layer (sanitizeKlapWebhookText) — this schema must
// not reject a merely-long-but-legitimate message from Klap outright.
const KLAP_MESSAGE_INPUT_MAX_LENGTH = 2000;

const klapNonEmptyId = z.string().trim().min(1).max(KLAP_ID_MAX_LENGTH);
const klapOptionalShortField = z.string().trim().max(KLAP_SHORT_FIELD_MAX_LENGTH).optional();

export const klapConfirmWebhookSchema = z.object({
  order_id: klapNonEmptyId,
  reference_id: klapNonEmptyId,
  payment_method: z.string().trim().min(1).max(KLAP_SHORT_FIELD_MAX_LENGTH),
  amount: z.union([z.string(), z.number()]),
  transaction_type: z.string().trim().min(1).max(KLAP_SHORT_FIELD_MAX_LENGTH),
  // Optional fields per the confirmed payload — bounded, never used to decide
  // success, never logged verbatim. token_id is intentionally NOT declared
  // here at all: this integration does not use it in this phase.
  mc_code: klapOptionalShortField,
  card_type: klapOptionalShortField,
  brand: klapOptionalShortField,
  bin: z.string().trim().max(8).optional(),
  last_digits: z.string().trim().regex(/^\d{1,4}$/, "last_digits must be up to 4 digits.").optional(),
  quotas_number: klapOptionalShortField,
  quotas_type: klapOptionalShortField,
  wallet: klapOptionalShortField,
});

export type KlapConfirmWebhookBody = z.infer<typeof klapConfirmWebhookSchema>;

export const klapRejectWebhookSchema = z.object({
  order_id: klapNonEmptyId,
  reference_id: klapNonEmptyId,
  code: z.string().trim().max(KLAP_SHORT_FIELD_MAX_LENGTH).optional(),
  message: z.string().trim().max(KLAP_MESSAGE_INPUT_MAX_LENGTH).optional(),
});

export type KlapRejectWebhookBody = z.infer<typeof klapRejectWebhookSchema>;