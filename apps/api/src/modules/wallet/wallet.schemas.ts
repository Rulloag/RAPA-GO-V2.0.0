import { z } from "zod";

export const createPaymentOrderSchema = z.object({
  rideId: z.string().uuid(),

  // Compatibilidad temporal: el frontend puede enviarlo, pero el backend lo ignora.
  // La fuente de verdad del monto es ride_requests.estimated_fare_clp.
  amount: z.number().int().positive().optional(),
});

export const webhookPayloadSchema = z.object({
  provider: z.string(),
  orderId: z.string(),
  status: z.enum(["success", "failed", "cancelled"]),
  transactionId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const listTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const requestCashOverpaymentBenefitSchema = z.object({
  rideId: z.string().uuid(),
  paidClp: z.number().int().positive().max(50_000_000).optional(),
  reason: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
});

export const listCashOverpaymentBenefitsQuerySchema = z.object({
  status: z
    .enum([
      "pending_admin_review",
      "approved",
      "rejected",
      "all",
    ])
    .default("all"),
});

export const adminReviewCashOverpaymentBenefitSchema = z.object({
  approvedAmountClp: z
    .number()
    .int()
    .positive()
    .max(50_000_000)
    .optional(),
  adminDecisionReason: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
});

/**
 * Endpoint antiguo conservado para no romper Admin mientras se termina la
 * migración visual. El backend ya no acepta créditos arbitrarios: rideId es
 * obligatorio y debe existir una solicitud pendiente para ese viaje.
 */
export const adminCreateWalletCreditSchema = z.object({
  userId: z.string().uuid(),
  rideId: z.string().uuid(),
  amountClp: z.number().int().positive().max(50_000_000),
  description: z.string().trim().min(3).max(300).optional(),
  reason: z.string().trim().max(200).optional(),
  externalReference: z.string().trim().max(120).optional(),
});

/** Beneficio manual otorgado por Admin para futuros viajes del propietario. */
export const adminCreateManualWalletBenefitSchema = z.object({
  userId: z.string().uuid(),
  amountClp: z.number().int().positive().max(50_000_000),
  reason: z.string().trim().min(3).max(300),
  externalReference: z.string().trim().min(8).max(160),
});

export type CreatePaymentOrderInput = z.infer<
  typeof createPaymentOrderSchema
>;
export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;
export type ListTransactionsQuery = z.infer<
  typeof listTransactionsQuerySchema
>;
export type RequestCashOverpaymentBenefitInput = z.infer<
  typeof requestCashOverpaymentBenefitSchema
>;
export type ListCashOverpaymentBenefitsQuery = z.infer<
  typeof listCashOverpaymentBenefitsQuerySchema
>;
export type AdminReviewCashOverpaymentBenefitInput = z.infer<
  typeof adminReviewCashOverpaymentBenefitSchema
>;
export type AdminCreateWalletCreditInput = z.infer<
  typeof adminCreateWalletCreditSchema
>;
export type AdminCreateManualWalletBenefitInput = z.infer<
  typeof adminCreateManualWalletBenefitSchema
>;
