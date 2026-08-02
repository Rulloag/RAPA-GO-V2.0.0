import { z } from "zod";

const nullableFinite = z.number().finite().nullable().optional();

function nullableBoundedMetric(min: number, max: number) {
  return z.preprocess(
    (value) => {
      if (value === null || value === undefined) return value;
      if (typeof value !== "number" || !Number.isFinite(value)) return null;
      return value >= min && value <= max ? value : null;
    },
    z.number().finite().min(min).max(max).nullable().optional(),
  );
}

export const rideLocationUpdateSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
  accuracyMeters: nullableBoundedMetric(0, 10000),
  headingDegrees: nullableBoundedMetric(0, 360),
  speedMetersPerSecond: nullableBoundedMetric(0, 150),
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
