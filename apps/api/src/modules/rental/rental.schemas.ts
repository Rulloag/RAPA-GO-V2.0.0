import { z } from "zod";

export const createVehicleSchema = z.object({
  brand:        z.string().min(1),
  model:        z.string().min(1),
  year:         z.number().int().optional(),
  plate:        z.string().min(1),
  color:        z.string().optional(),
  type:         z.enum(["car", "suv", "van", "motorcycle", "bicycle", "quad"]),
  seats:        z.number().int().positive().optional(),
  transmission: z.enum(["manual", "automatic"]).optional(),
  fuelType:     z.enum(["gasoline", "diesel", "electric", "hybrid"]).optional(),
  dailyPrice:   z.number().int().positive(),
  description:  z.string().optional(),
  features:     z.array(z.string()).optional(),
  photos:       z.array(z.string()).optional(),
});
export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;

export const updateVehicleSchema = createVehicleSchema.partial();
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;

export const updateVehicleStatusSchema = z.object({
  status: z.enum(["available", "rented", "maintenance", "inactive"]),
});
export type UpdateVehicleStatusInput = z.infer<typeof updateVehicleStatusSchema>;

export const createRentalBookingSchema = z.object({
  vehicleId:      z.string().uuid(),
  startDate:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pickupTime:     z.string().optional(),
  returnTime:     z.string().optional(),
  pickupLocation: z.string().optional(),
  returnLocation: z.string().optional(),
  notes:          z.string().optional(),
});
export type CreateRentalBookingInput = z.infer<typeof createRentalBookingSchema>;

export const cancelRentalSchema = z.object({ reason: z.string().optional() });
export type CancelRentalInput = z.infer<typeof cancelRentalSchema>;
