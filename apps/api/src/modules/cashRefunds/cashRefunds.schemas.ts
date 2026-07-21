import { z } from "zod";

export const requestCashOverpaymentRefundSchema = z.object({
  rideId: z.string().uuid(),
  paidClp: z.number().int().positive().max(50_000_000).optional(),
  reason: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
});

export const listCashOverpaymentRefundsQuerySchema = z.object({
  status: z
    .enum([
      "pending_admin_review",
      "approved_for_transfer",
      "completed",
      "rejected",
      "all",
    ])
    .default("all"),
});

export const approveCashOverpaymentRefundSchema = z.object({
  approvedAmountClp: z.number().int().positive().max(50_000_000).optional(),
  adminDecisionReason: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
});

export const rejectCashOverpaymentRefundSchema = z.object({
  adminDecisionReason: z.string().trim().min(3).max(500),
});

export const completeCashOverpaymentRefundSchema = z.object({
  transferReference: z.string().trim().min(3).max(180),
  transferProofUrl: z
    .string()
    .trim()
    .url()
    .max(2_000)
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
  adminDecisionReason: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
});

export type RequestCashOverpaymentRefundInput = z.infer<
  typeof requestCashOverpaymentRefundSchema
>;
export type ApproveCashOverpaymentRefundInput = z.infer<
  typeof approveCashOverpaymentRefundSchema
>;
export type RejectCashOverpaymentRefundInput = z.infer<
  typeof rejectCashOverpaymentRefundSchema
>;
export type CompleteCashOverpaymentRefundInput = z.infer<
  typeof completeCashOverpaymentRefundSchema
>;
