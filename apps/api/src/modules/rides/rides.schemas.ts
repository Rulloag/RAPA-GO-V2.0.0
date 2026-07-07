import { z } from "zod";

export const createRideRequestSchema = z.object({
  originText: z
    .string()
    .trim()
    .min(3, "Origin must be at least 3 characters.")
    .max(150),

  destinationText: z
    .string()
    .trim()
    .min(3, "Destination must be at least 3 characters.")
    .max(150),

  notes: z
    .string()
    .trim()
    .max(5000, "Notes must not exceed 5000 characters.")
    .optional()
    .nullable()
    .transform((v) => {
      if (v == null) return undefined;
      const clean = v.trim();
      return clean === "" ? undefined : clean;
    }),

  estimatedFareClp: z.number().int().positive().nullable().optional(),

  // Agendamiento / programación
  rideMode: z.enum(["now", "scheduled"]).optional(),
  isScheduled: z.boolean().optional(),
  tripFareMode: z.enum(["one_way", "round_trip"]).optional(),

  scheduledAt: z.string().trim().nullable().optional(),
  scheduledPickupAt: z.string().trim().nullable().optional(),
  scheduledReturnAt: z.string().trim().nullable().optional(),
  scheduledActivationAt: z.string().trim().nullable().optional(),
  scheduledReturnActivationAt: z.string().trim().nullable().optional(),
});

export type CreateRideRequestInput = z.infer<typeof createRideRequestSchema>;

export const cancelAcceptedSchema = z.object({
  reason: z
    .string()
    .trim()
    .max(500, "Reason must not exceed 500 characters.")
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
});

export type CancelAcceptedInput = z.infer<typeof cancelAcceptedSchema>;