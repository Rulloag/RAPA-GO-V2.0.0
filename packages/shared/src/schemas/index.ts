/**
 * Shared Zod schemas.
 * Schemas for Trip, Wallet, Payment, etc. will be added here
 * as each module enters the implementation phase.
 *
 * Current state: foundational schemas only.
 */

import { z } from "zod";

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
