import { z } from "zod";

// Rapa Nui is ~25 km long. 100 km is a generous upper bound for any route on the island.
const MAX_DISTANCE_METERS = 100_000;

// ~55 m — prevents trivially same origin/destination
const MIN_COORD_DIFF = 0.0005;

export const createRideRequestSchema = z
  .object({
    originText:      z.string().trim().min(3,  "Origin must be at least 3 characters.").max(150),
    destinationText: z.string().trim().min(3,  "Destination must be at least 3 characters.").max(150),
    originLat:       z.number().min(-90,   "originLat must be ≥ -90.")   .max(90,   "originLat must be ≤ 90."),
    originLng:       z.number().min(-180,  "originLng must be ≥ -180.")  .max(180,  "originLng must be ≤ 180."),
    destinationLat:  z.number().min(-90,   "destinationLat must be ≥ -90.").max(90,   "destinationLat must be ≤ 90."),
    destinationLng:  z.number().min(-180,  "destinationLng must be ≥ -180.").max(180,  "destinationLng must be ≤ 180."),
    distanceMeters:  z
      .number()
      .int("distanceMeters must be an integer.")
      .min(1,                  "distanceMeters must be greater than 0.")
      .max(MAX_DISTANCE_METERS, `distanceMeters exceeds the maximum allowed for Rapa Nui (${MAX_DISTANCE_METERS} m).`),
    durationSeconds: z
      .number()
      .int("durationSeconds must be an integer.")
      .min(1, "durationSeconds must be greater than 0."),
    notes: z
      .string()
      .trim()
      .max(500, "Notes must not exceed 500 characters.")
      .optional()
      .transform((v) => (v === "" ? undefined : v)),
  })
  .refine(
    (data) => {
      const latDiff = Math.abs(data.originLat - data.destinationLat);
      const lngDiff = Math.abs(data.originLng - data.destinationLng);
      return latDiff > MIN_COORD_DIFF || lngDiff > MIN_COORD_DIFF;
    },
    {
      message: "Origin and destination are too close — please choose different locations.",
      path:    ["destinationLat"],
    },
  );

export type CreateRideRequestInput = z.infer<typeof createRideRequestSchema>;

export const cancelAcceptedSchema = z.object({
  reason: z.string().trim().max(500, "Reason must not exceed 500 characters.").optional()
            .transform((v) => (v === "" ? undefined : v)),
});

export type CancelAcceptedInput = z.infer<typeof cancelAcceptedSchema>;
