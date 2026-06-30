import { z } from "zod";

export const createPaymentSchema = z.object({
  rideRequestId: z.string().uuid("rideRequestId must be a valid UUID."),
});

export const prontoPagaWebhookSchema = z
  .object({
    // ProntoPaga documentation uses "order" as the primary field name.
    // Some environments also send "order_id". We accept both and normalise below.
    order:       z.string().optional(),
    order_id:    z.string().optional(),
    status:      z.string(),
    amount:      z.union([z.string(), z.number()]).optional(),
    external_id: z.string().optional(),
    transaction_id: z.string().optional(),
    signature:   z.string(),
  })
  .passthrough()
  .refine(
    (d) => Boolean(d.order ?? d.order_id),
    { message: "Webhook payload must include 'order' or 'order_id'." },
  );

export type CreatePaymentInput    = z.infer<typeof createPaymentSchema>;
export type ProntoPagaWebhookBody = z.infer<typeof prontoPagaWebhookSchema>;

/** Normalises the payment ID from the webhook payload regardless of field name. */
export function extractOrderId(payload: Record<string, unknown>): string {
  return String(payload["order"] ?? payload["order_id"] ?? "");
}
