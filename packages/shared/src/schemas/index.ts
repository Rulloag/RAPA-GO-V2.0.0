/**
 * Shared Zod schemas.
 * Schemas for Trip, Wallet, Payment, etc. will be added here
 * as each module enters the implementation phase.
 *
 * Current state: foundational schemas + auth schemas (Phase 6).
 */

import { z } from "zod";
import { USER_ROLES } from "../constants/index.js";

export { z };

/** Reusable UUID schema. */
export const uuidSchema = z.string().uuid();

/** Reusable positive integer amount in cents (CLP). */
export const amountInCentsSchema = z
  .number()
  .int()
  .positive({ message: "Amount must be a positive integer in cents." });

/** Reusable pagination query params schema. */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── Auth schemas ─────────────────────────────────────────────────────────────

export const loginRequestSchema = z.object({
  email: z.string().email({ message: "Valid email is required." }),
  password: z.string().min(8, { message: "Password must be at least 8 characters." }),
});

export const legalAcceptanceInputSchema = z.object({
  legalDocumentId: z.string().uuid({ message: "Valid legal document id is required." }),
  version: z.string().trim().min(1).max(30),
});

export const residenceAccreditationSchema = z.object({
  documentName: z.string().trim().min(1).max(240),
  documentType: z.enum([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
  ]),
  documentSize: z.number().int().positive().max(Math.floor(1.5 * 1024 * 1024)),
  documentDataUrl: z
    .string()
    .trim()
    .min(32)
    .max(2_300_000)
    .refine(
      (value) =>
        /^data:(application\/pdf|image\/jpeg|image\/png|image\/webp);base64,/i.test(
          value,
        ),
      "La acreditación debe ser PDF, JPG, PNG o WEBP.",
    ),
});

export const registerRequestSchema = z
  .object({
    email: z.string().email({ message: "Valid email is required." }),
    password: z.string().min(8, { message: "Password must be at least 8 characters." }),
    name: z.string().min(2, { message: "Name must be at least 2 characters." }).max(100),
    role: z.enum(USER_ROLES, { errorMap: () => ({ message: "Invalid role." }) }),
    phone: z.string().trim().min(8).max(24).optional(),
    rut: z.string().trim().max(20).optional(),
    passport: z.string().trim().max(30).optional(),
    passengerFareType: z
      .enum(["resident", "chilean", "foreigner"])
      .optional(),
    residenceAccreditation: residenceAccreditationSchema.optional(),
    legalAcceptances: z
      .array(legalAcceptanceInputSchema)
      .min(3, { message: "All required legal documents must be accepted." })
      .max(12),
  })
  .superRefine((value, context) => {
    if (
      value.passengerFareType === "resident" &&
      !value.residenceAccreditation
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["residenceAccreditation"],
        message: "Debes adjuntar tu acreditación de residencia para continuar.",
      });
    }
  });

export const authUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  role: z.enum(USER_ROLES),
  avatarUrl: z.string().url().nullable(),
  isVerified: z.boolean(),
  requestedPassengerFareType: z
    .enum(["resident", "chilean", "foreigner"])
    .optional(),
  passengerFareType: z
    .enum(["resident", "chilean", "foreigner"])
    .optional(),
  residenceVerificationStatus: z
    .enum(["not_required", "pending", "approved", "rejected"])
    .optional(),
  authProviders: z
    .array(z.enum(["password", "facebook", "google", "apple"]))
    .optional(),
  hasPassword: z.boolean().optional(),
});

export const authSessionSchema = z.object({
  accessToken: z.string().min(1),
  expiresAt: z.string().datetime(),
  user: authUserSchema,
});
