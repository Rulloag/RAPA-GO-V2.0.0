import { z } from "zod";

export const createServiceSchema = z.object({
  title:              z.string().min(1),
  description:        z.string().optional(),
  type:               z.enum(["tour", "transfer", "workshop", "custom"]),
  durationMinutes:    z.number().int().positive().optional(),
  maxPeople:          z.number().int().positive().optional(),
  price:              z.number().int().nonnegative().optional(),
  includes:           z.array(z.string()).optional(),
  languages:          z.array(z.string()).optional(),
  meetingPoint:       z.string().optional(),
  includesVehicle:    z.boolean().optional(),
  conditions:         z.string().optional(),
  cancellationPolicy: z.string().optional(),
  pricingTiers:       z.array(z.object({
    minPeople: z.number().int().positive(),
    maxPeople: z.number().int().positive(),
    price:     z.number().int().nonnegative(),
  })).optional(),
});
export type CreateServiceInput = z.infer<typeof createServiceSchema>;

export const updateServiceSchema = createServiceSchema.partial();
export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;

export const createBookingSchema = z.object({
  serviceId:      z.string().uuid(),
  bookingDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  bookingTime:    z.string().optional(),
  numberOfPeople: z.number().int().positive().default(1),
  notes:          z.string().optional(),
});
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const cancelBookingSchema = z.object({ reason: z.string().optional() });
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;

export const setServiceStatusSchema = z.object({
  status: z.enum(["active", "inactive", "archived"]),
});
export type SetServiceStatusInput = z.infer<typeof setServiceStatusSchema>;
