import { z } from "zod";

export const upsertDriverRestScheduleSchema = z.object({
  startTime: z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "La hora debe tener formato HH:mm."),
});

export type UpsertDriverRestScheduleInput = z.infer<
  typeof upsertDriverRestScheduleSchema
>;

export const complianceLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracyMeters: z.number().nonnegative().max(100000).optional(),
  capturedAt: z.string().datetime({ offset: true }).optional(),
});

export type ComplianceLocationInput = z.infer<
  typeof complianceLocationSchema
>;
