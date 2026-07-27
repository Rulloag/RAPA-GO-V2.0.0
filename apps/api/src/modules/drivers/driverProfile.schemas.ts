import { z } from "zod";

export const upsertDriverProfileSchema = z.object({
  phone:           z.string().trim().max(20).optional(),
  vehicleBrand:    z.string().trim().max(50).optional(),
  vehicleModel:    z.string().trim().max(50).optional(),
  vehicleYear:     z.number().int().min(1990).max(2030).optional(),
  vehiclePlate:    z.string().trim().max(10).optional(),
  vehicleColor:    z.string().trim().max(30).optional(),
  licenseNumber:   z.string().trim().max(30).optional(),
  licenseExpiry:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  profilePhotoUrl: z.string().url().optional(),
  vehiclePhotoUrl: z.string().url().optional(),
  bio:             z.string().trim().max(500).optional(),
  languages:       z.array(z.enum(["es", "en", "rapa_nui", "fr"])).optional(),
});

export type UpsertDriverProfileInput = z.infer<typeof upsertDriverProfileSchema>;
