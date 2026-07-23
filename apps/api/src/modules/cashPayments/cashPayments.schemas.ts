import { z } from "zod";

export const closeCashPaymentSchema = z.object({
  paidClp: z.number().int().positive().max(50_000_000),
  decision: z.enum(["exact", "overpaid"]),
  note: z.string().trim().max(500).optional().transform((value) => value || undefined),
});

export const listCashClosuresQuerySchema = z.object({
  status: z.enum(["paid_exact", "overpayment_pending_choice", "benefit_requested", "refund_requested", "resolved", "all"]).default("all"),
});

export type CloseCashPaymentInput = z.infer<typeof closeCashPaymentSchema>;
