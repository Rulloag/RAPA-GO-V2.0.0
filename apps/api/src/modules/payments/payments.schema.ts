import { z } from "zod";

// ── Create payment ─────────────────────────────────────────────────────────────

export const createPaymentSchema = z.object({
  rideRequestId: z.string().uuid("rideRequestId must be a valid UUID."),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

// ── ProntoPaga webhook ─────────────────────────────────────────────────────────

export const prontoPagaWebhookSchema = z
  .object({
    // ProntoPaga documentation uses "order" as the primary field name.
    // Some environments also send "order_id". We accept both and normalise in the provider.
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
