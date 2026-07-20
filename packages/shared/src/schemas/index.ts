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

export const registerRequestSchema = z.object({
  email: z.string().email({ message: "Valid email is required." }),
  password: z.string().min(8, { message: "Password must be at least 8 characters." }),
  name: z.string().min(2, { message: "Name must be at least 2 characters." }).max(100),
  role: z.enum(USER_ROLES, { errorMap: () => ({ message: "Invalid role." }) }),
  phone: z.string().trim().min(8).max(24).optional(),
  passengerFareType: z
    .enum(["resident", "chilean", "foreigner"])
    .optional(),
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
});

export const authSessionSchema = z.object({
  accessToken: z.string().min(1),
  expiresAt: z.string().datetime(),
  user: authUserSchema,
});
