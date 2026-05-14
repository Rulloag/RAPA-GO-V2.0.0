import { z } from "zod";

export const createRideRequestSchema = z.object({
  originText:      z.string().trim().min(3,  "Origin must be at least 3 characters.").max(150),
  destinationText: z.string().trim().min(3,  "Destination must be at least 3 characters.").max(150),
  notes:           z.string().trim().max(500, "Notes must not exceed 500 characters.").optional()
                     .transform((v) => (v === "" ? undefined : v)),
});

export type CreateRideRequestInput = z.infer<typeof createRideRequestSchema>;

export const cancelAcceptedSchema = z.object({
  reason: z.string().trim().max(500, "Reason must not exceed 500 characters.").optional()
            .transform((v) => (v === "" ? undefined : v)),
});

export type CancelAcceptedInput = z.infer<typeof cancelAcceptedSchema>;
