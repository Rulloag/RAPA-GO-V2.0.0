import { z } from "zod";

export const ACCOUNT_DELETION_STATUSES = [
  "pending",
  "approved",
  "processing",
  "completed",
  "deferred",
  "rejected",
  "failed",
  "cancelled",
] as const;

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Ingresa un correo electrónico válido.")
  .max(255, "El correo no puede superar 255 caracteres.");

const reasonSchema = z
  .string()
  .trim()
  .min(10, "Debes escribir un motivo de al menos 10 caracteres.")
  .max(500, "El motivo no puede superar 500 caracteres.");

const commentSchema = z
  .string()
  .trim()
  .max(1000, "La observación no puede superar 1000 caracteres.")
  .optional();

export const accountDeletionClientSnapshotSchema = z.object({
  phone: z.string().trim().max(40).nullable().optional(),
  rut: z.string().trim().max(40).nullable().optional(),
  passengerType: z.string().trim().max(80).nullable().optional(),
  vehicleBrand: z.string().trim().max(80).nullable().optional(),
  vehicleModel: z.string().trim().max(80).nullable().optional(),
  vehicleYear: z.number().int().min(1900).max(2200).nullable().optional(),
  vehiclePlate: z.string().trim().max(30).nullable().optional(),
  vehicleColor: z.string().trim().max(60).nullable().optional(),
  licenseNumber: z.string().trim().max(80).nullable().optional(),
  sourceView: z.enum(["passenger", "driver"]).nullable().optional(),
});

export const createAccountDeletionRequestSchema = z.object({
  verificationCode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "El código de verificación debe tener 6 números."),
  reason: reasonSchema,
  comment: commentSchema,
  requesterSnapshot: accountDeletionClientSnapshotSchema.optional(),
});

export type CreateAccountDeletionRequestInput =
  z.infer<typeof createAccountDeletionRequestSchema>;

export const publicAccountDeletionCodeRequestSchema = z.object({
  email: emailSchema,
});

export type PublicAccountDeletionCodeRequestInput =
  z.infer<typeof publicAccountDeletionCodeRequestSchema>;

export const publicAccountDeletionSubmitSchema = z.object({
  email: emailSchema,
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "El código debe tener 6 números."),
  reason: reasonSchema,
  comment: commentSchema,
  accepted: z.literal(true, {
    errorMap: () => ({
      message: "Debes confirmar que deseas solicitar la eliminación.",
    }),
  }),
});

export type PublicAccountDeletionSubmitInput =
  z.infer<typeof publicAccountDeletionSubmitSchema>;

export const publicAccountDeletionStatusQuerySchema = z.object({
  email: emailSchema,
  trackingCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      /^RAD-[A-Z0-9]{12,20}$/,
      "El número de seguimiento no es válido.",
    ),
});

export type PublicAccountDeletionStatusQuery =
  z.infer<typeof publicAccountDeletionStatusQuerySchema>;

export const listAccountDeletionRequestsQuerySchema = z.object({
  status: z.enum(ACCOUNT_DELETION_STATUSES).optional(),
});

export type ListAccountDeletionRequestsQuery =
  z.infer<typeof listAccountDeletionRequestsQuerySchema>;

export const reviewAccountDeletionRequestSchema = z.object({
  note: z
    .string()
    .trim()
    .min(3, "Debes escribir una observación de al menos 3 caracteres.")
    .max(1000, "La observación no puede superar 1000 caracteres."),
});

export type ReviewAccountDeletionRequestInput =
  z.infer<typeof reviewAccountDeletionRequestSchema>;


export const deferAccountDeletionRequestSchema = z.object({
  reasonCode: z.enum([
    "active_ride",
    "pending_payment",
    "wallet_balance",
    "open_claim",
    "chargeback_or_fraud",
    "identity_unverified",
    "legal_retention",
  ]),
  note: z
    .string()
    .trim()
    .min(3, "Debes explicar la causa objetiva del aplazamiento.")
    .max(1000, "La observación no puede superar 1000 caracteres."),
  deferUntil: z.string().datetime().optional(),
});

export type DeferAccountDeletionRequestInput =
  z.infer<typeof deferAccountDeletionRequestSchema>;
