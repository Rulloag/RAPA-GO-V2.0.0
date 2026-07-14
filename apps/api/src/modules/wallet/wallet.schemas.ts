import { z } from "zod";

export const createPaymentOrderSchema = z.object({
  rideId: z.string().uuid(),

  // NOTA DE SEGURIDAD: compatibilidad temporal con el cliente móvil. WalletService.
  // createPaymentOrder NUNCA usa este valor como monto autoritativo — el monto real
  // siempre se recalcula desde ride_requests.estimated_fare_clp en el servidor.
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
  paymentId: z.string().trim().optional(),
  amountClp: z.number().int().positive().max(10_000_000),
  description: z.string().trim().min(3).max(300).optional(),
  reason: z.string().trim().max(200).optional(),
  externalReference: z.string().trim().max(120).optional(),
});

export type CreatePaymentOrderInput      = z.infer<typeof createPaymentOrderSchema>;
export type WebhookPayload               = z.infer<typeof webhookPayloadSchema>;
export type ListTransactionsQuery        = z.infer<typeof listTransactionsQuerySchema>;
export type AdminCreateWalletCreditInput = z.infer<typeof adminCreateWalletCreditSchema>;
