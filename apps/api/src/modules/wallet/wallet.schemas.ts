import { z } from "zod";

export const createPaymentOrderSchema = z.object({
  rideId: z.string().uuid(),

  // Compatibilidad temporal: el frontend puede enviarlo, pero el backend lo ignora.
  // La fuente de verdad del monto es ride_requests.estimated_fare_clp.
  amount: z.number().int().positive().optional(),
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

export const adminCreateWalletCreditSchema = z.object({
  userId: z.string().uuid(),
  rideId: z.string().uuid().optional(),
  amountClp: z.number().int().positive().max(10_000_000),
  description: z.string().trim().min(3).max(300).optional(),
  reason: z.string().trim().max(200).optional(),
  externalReference: z.string().trim().max(120).optional(),
});

export type CreatePaymentOrderInput      = z.infer<typeof createPaymentOrderSchema>;
export type WebhookPayload               = z.infer<typeof webhookPayloadSchema>;
export type ListTransactionsQuery        = z.infer<typeof listTransactionsQuerySchema>;
export type AdminCreateWalletCreditInput = z.infer<typeof adminCreateWalletCreditSchema>;
