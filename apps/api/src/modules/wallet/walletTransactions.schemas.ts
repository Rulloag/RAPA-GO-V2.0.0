import { z } from "zod";

export const WALLET_TX_SOURCES = [
  "cancellation",
  "no_show",
  "admin",
  "payment_refund",
  "ride_payment",
  "promotion",
] as const;

export const adminCreateCreditSchema = z.object({
  userId: z.string().uuid(),
  rideId: z.string().uuid().nullable().optional(),
  amountClp: z.number().int().positive(),
  source: z.enum(WALLET_TX_SOURCES),
  // Motivo obligatorio (regla de auditoría, Paso 6): nunca se crea un crédito sin justificación.
  reason: z.string().trim().min(5, "El motivo debe tener al menos 5 caracteres.").max(500),
  expiresAt: z.string().trim().nullable().optional(),
  idempotencyKey: z.string().trim().min(8).max(200),
});

export const adminModerateCreditSchema = z.object({
  // Motivo obligatorio solo para rechazo; opcional para aprobación.
  reason: z.string().trim().max(500).nullable().optional(),
});

export const applyCreditSchema = z.object({
  walletTransactionId: z.string().uuid(),
  rideId: z.string().uuid(),
  idempotencyKey: z.string().trim().min(8).max(200),
});

export const listMyCreditsQuerySchema = z.object({
  status: z.enum(["pending", "available", "applied", "paid", "rejected", "expired", "reversed", "cancelled"]).optional(),
  type: z.enum(["credit", "debit", "refund", "payment", "adjustment", "reversal"]).optional(),
});

// Fase 4B — débitos (obligaciones del pasajero). Método de cobro: solo 'admin_review' está
// habilitado hoy (§5 del diseño); los demás quedan reservados para cuando exista un flujo de
// cobro automático aprobado.
export const markDebitPaidSchema = z.object({
  collectionMethod: z.enum(["admin_review"]),
});

export const cancelDebitSchema = z.object({
  reason: z.string().trim().min(5, "El motivo debe tener al menos 5 caracteres.").max(500),
});

export const reverseTransactionSchema = z.object({
  reason: z.string().trim().min(5, "El motivo debe tener al menos 5 caracteres.").max(500),
});

export type AdminCreateCreditInput    = z.infer<typeof adminCreateCreditSchema>;
export type AdminModerateCreditInput  = z.infer<typeof adminModerateCreditSchema>;
export type ApplyCreditInput          = z.infer<typeof applyCreditSchema>;
export type ListMyCreditsQuery        = z.infer<typeof listMyCreditsQuerySchema>;
export type MarkDebitPaidInput        = z.infer<typeof markDebitPaidSchema>;
export type CancelDebitInput          = z.infer<typeof cancelDebitSchema>;
export type ReverseTransactionInput   = z.infer<typeof reverseTransactionSchema>;
