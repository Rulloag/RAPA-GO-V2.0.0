import { z } from "zod";

const nullableFinite = z.number().finite().nullable().optional();

export const rideLocationUpdateSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
  accuracyMeters: z.number().finite().min(0).max(10000).nullable().optional(),
  headingDegrees: z.number().finite().min(0).max(360).nullable().optional(),
  speedMetersPerSecond: z.number().finite().min(0).max(150).nullable().optional(),
  altitudeMeters: nullableFinite,
  capturedAt: z.string().datetime({ offset: true }),
  source: z
    .enum(["foreground_native", "background_native", "web"])
    .default("foreground_native"),
  appState: z.enum(["foreground", "background"]).default("foreground"),
  sequenceNumber: z.number().int().min(0).max(2147483647).nullable().optional(),
  isMocked: z.boolean().default(false),
});

export const rideLocationRouteQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(500),
});

export type RideLocationUpdateInput = z.infer<typeof rideLocationUpdateSchema>;
