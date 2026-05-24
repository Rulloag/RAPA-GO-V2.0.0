import { z } from "zod";

const personalFields = {
  firstName: z.string().min(1),
  lastName:  z.string().min(1),
  email:     z.string().email(),
  phone:     z.string().min(8),
  rut:       z.string().optional(),
  birthDate: z.string().optional(),
  city:      z.string().optional(),
  emergencyContactName:  z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  idFrontUrl:      z.string().url().optional(),
  idBackUrl:       z.string().url().optional(),
  profilePhotoUrl: z.string().url().optional(),
};

export const createDriverApplicationSchema = z.object({
  type: z.literal("driver"),
  ...personalFields,
  vehicleBrand:    z.string().optional(),
  vehicleModel:    z.string().optional(),
  vehicleYear:     z.number().int().optional(),
  vehiclePlate:    z.string().optional(),
  vehicleColor:    z.string().optional(),
  licenseNumber:   z.string().optional(),
  licenseExpiry:   z.string().optional(),
  hasOwnVehicle:   z.boolean().optional(),
  licenseFrontUrl: z.string().url().optional(),
  licenseBackUrl:  z.string().url().optional(),
});

export const createGuideApplicationSchema = z.object({
  type: z.literal("guide"),
  ...personalFields,
  experienceYears:    z.number().int().nonnegative().optional(),
  specialties:        z.array(z.string()).optional(),
  offeredTours:       z.array(z.string()).optional(),
  hasVehicle:         z.boolean().optional(),
  vehicleDescription: z.string().optional(),
  maxGroupSize:       z.number().int().positive().optional(),
  languages:          z.array(z.string()).optional(),
  certificateUrl:     z.string().url().optional(),
});

export const createRentalApplicationSchema = z.object({
  type: z.literal("rental_operator"),
  ...personalFields,
  companyName: z.string().optional(),
  companyRut:  z.string().optional(),
});

export const createApplicationSchema = z.discriminatedUnion("type", [
  createDriverApplicationSchema,
  createGuideApplicationSchema,
  createRentalApplicationSchema,
]);
export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;

export const reviewApplicationSchema = z.object({
  status: z.enum(["under_review", "approved", "rejected", "on_hold"]),
  rejectionReason: z.string().optional(),
  notes: z.string().optional(),
});
export type ReviewApplicationInput = z.infer<typeof reviewApplicationSchema>;
