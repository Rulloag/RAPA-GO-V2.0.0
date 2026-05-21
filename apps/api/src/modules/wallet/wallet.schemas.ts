import { z } from "zod";

export const createPaymentOrderSchema = z.object({
  rideId: z.string().uuid(),
  amount: z.number().int().positive(),
});

export const webhookPayloadSchema = z.object({
  provider:      z.string(),
  orderId:       z.string(),
  status:        z.enum(["success", "failed", "cancelled"]),
  transactionId: z.string().optional(),
  metadata:      z.record(z.unknown()).optional(),
});

export const listTransactionsQuerySchema = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreatePaymentOrderInput = z.infer<typeof createPaymentOrderSchema>;
export type WebhookPayload          = z.infer<typeof webhookPayloadSchema>;
export type ListTransactionsQuery   = z.infer<typeof listTransactionsQuerySchema>;
