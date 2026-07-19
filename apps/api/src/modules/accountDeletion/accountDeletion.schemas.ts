import { z } from "zod";

export const ACCOUNT_DELETION_STATUSES = [
  "pending",
  "approved",
  "processing",
  "completed",
  "rejected",
  "failed",
  "cancelled",
] as const;

const nullableShortText = (max: number) =>
  z.string().trim().max(max).nullable().optional();

export const accountDeletionClientSnapshotSchema = z
  .object({
    phone: nullableShortText(40),
    rut: nullableShortText(30),
    passengerType: nullableShortText(80),
    vehicleBrand: nullableShortText(80),
    vehicleModel: nullableShortText(80),
    vehicleYear: z.number().int().min(1900).max(2200).nullable().optional(),
    vehiclePlate: nullableShortText(30),
    vehicleColor: nullableShortText(60),
    licenseNumber: nullableShortText(80),
    sourceView: z.enum(["passenger", "driver"]).nullable().optional(),
  })
  .strict();

export const createAccountDeletionRequestSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(10, "Explica el motivo con al menos 10 caracteres.")
    .max(500, "El motivo no puede superar 500 caracteres."),

  comment: z
    .string()
    .trim()
    .max(1000, "La observación no puede superar 1000 caracteres.")
    .optional(),

  requesterSnapshot: accountDeletionClientSnapshotSchema.optional(),
});

export type CreateAccountDeletionRequestInput =
  z.infer<typeof createAccountDeletionRequestSchema>;

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
