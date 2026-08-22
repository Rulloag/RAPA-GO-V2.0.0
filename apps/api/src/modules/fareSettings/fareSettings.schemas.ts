import { z } from "zod";

const VALID_TYPES = [
  "mobility_base",
  "mobility_per_km",
  "tour_base",
  "rental_base",
  "discount_percentage",
  "minimum_fare",
  "comfort_fare_multiplier_bps",
  "comfort_min_vehicle_year",
] as const;

export const createFareSettingSchema = z.object({
  type:           z.enum(VALID_TYPES),
  name:           z.string().min(1),
  value:          z.number().int().nonnegative(),
  currency:       z.string().optional(),
  description:    z.string().optional(),
  effectiveFrom:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  effectiveUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export type CreateFareSettingInput = z.infer<typeof createFareSettingSchema>;

export const updateFareSettingSchema = z.object({
  name:           z.string().optional(),
  value:          z.number().int().nonnegative().optional(),
  isActive:       z.boolean().optional(),
  effectiveUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  description:    z.string().optional(),
});
export type UpdateFareSettingInput = z.infer<typeof updateFareSettingSchema>;

export const createZoneFareSchema = z.object({
  zoneFrom: z.string().min(1),
  zoneTo:   z.string().min(1),
  fare:     z.number().int().positive(),
});
export type CreateZoneFareInput = z.infer<typeof createZoneFareSchema>;

export const updateZoneFareSchema = z.object({
  fare:     z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateZoneFareInput = z.infer<typeof updateZoneFareSchema>;
