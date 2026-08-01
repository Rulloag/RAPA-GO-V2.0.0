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