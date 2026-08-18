import { z } from "zod";

export const driverVehicleCategorySchema = z
  .enum(["standard", "xl", "extra_luggage", "luggage"])
  .transform((v) => (v === "luggage" ? "extra_luggage" : v));

export function resolveProvisionDriverVehicleCategory(
  vehicleCategory: string | null | undefined,
): "standard" | "xl" | "extra_luggage" {
  const parsed = driverVehicleCategorySchema.safeParse(vehicleCategory);
  if (parsed.success) return parsed.data;
  return "standard";
}

export const upsertDriverProfileSchema = z
  .object({
    vehicleBrand:    z.string().trim().max(50).optional(),
    vehicleModel:    z.string().trim().max(50).optional(),
    vehicleYear:     z.number().int().min(1990).max(2030).optional(),
    vehiclePlate:    z.string().trim().max(10).optional(),
    vehicleColor:    z.string().trim().max(30).optional(),
    profilePhotoUrl: z.string().url().optional(),
    vehiclePhotoUrl: z.string().url().optional(),
    bio:             z.string().trim().max(500).optional(),
    languages:       z.array(z.enum(["es", "en", "rapa_nui", "fr"])).optional(),
  })
  .strict(
    "Teléfono, licencia de conducir y categoría del vehículo están bloqueados. Solicita cualquier corrección mediante soporte y administración.",
  );

export type UpsertDriverProfileInput = z.infer<typeof upsertDriverProfileSchema>;
