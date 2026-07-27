import { z } from "zod";

const optionalPublicUrl = z.string().url().optional();

const personalFields = {
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  email: z.string().trim().email(),
  phone: z.string().trim().min(8),
  rut: z.string().trim().optional(),
  birthDate: z.string().trim().optional(),
  city: z.string().trim().optional(),
  emergencyContactName: z.string().trim().optional(),
  emergencyContactPhone: z.string().trim().optional(),
  idFrontUrl: optionalPublicUrl,
  idBackUrl: optionalPublicUrl,
  profilePhotoUrl: optionalPublicUrl,
};

export const applicationVehicleSchema = z.object({
  id: z.string().trim().max(120).optional(),
  order: z.number().int().positive().optional(),
  primary: z.boolean().optional(),
  ownership: z.enum(["own", "optional"]).optional(),
  brand: z.string().trim().max(60).optional(),
  model: z.string().trim().max(60).optional(),
  year: z.union([
    z.string().trim().max(4),
    z.number().int().min(1900).max(2100),
  ]).optional(),
  plate: z.string().trim().max(20).optional(),
  color: z.string().trim().max(40).optional(),
  label: z.string().trim().max(180).optional(),
  expiresAt: z.string().trim().nullable().optional(),
  photoFileName: z.string().trim().max(180).nullable().optional(),
}).strict();

export const createDriverApplicationSchema = z.object({
  type: z.literal("driver"),
  ...personalFields,
  vehicleBrand: z.string().trim().optional(),
  vehicleModel: z.string().trim().optional(),
  vehicleYear: z.number().int().optional(),
  vehiclePlate: z.string().trim().optional(),
  vehicleColor: z.string().trim().optional(),
  licenseNumber: z.string().trim().optional(),
  licenseExpiry: z.string().trim().optional(),
  hasOwnVehicle: z.boolean().optional(),
  licenseFrontUrl: optionalPublicUrl,
  licenseBackUrl: optionalPublicUrl,
  vehiclePhotoUrl: optionalPublicUrl,
  vehicles: z.array(applicationVehicleSchema).max(8).optional(),
});

export const createGuideApplicationSchema = z.object({
  type: z.literal("guide"),
  ...personalFields,
  experienceYears: z.number().int().nonnegative().optional(),
  specialties: z.array(z.string()).optional(),
  offeredTours: z.array(z.string()).optional(),
  hasVehicle: z.boolean().optional(),
  vehicleDescription: z.string().optional(),
  maxGroupSize: z.number().int().positive().optional(),
  languages: z.array(z.string()).optional(),
  certificateUrl: optionalPublicUrl,
});

export const createRentalApplicationSchema = z.object({
  type: z.literal("rental_operator"),
  ...personalFields,
  companyName: z.string().optional(),
  companyRut: z.string().optional(),
});

export const createApplicationSchema = z.discriminatedUnion("type", [
  createDriverApplicationSchema,
  createGuideApplicationSchema,
  createRentalApplicationSchema,
]);

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;

export const reviewApplicationSchema = z.object({
  status: z.enum(["pending", "under_review", "approved", "rejected", "on_hold"]),
  rejectionReason: z.string().optional(),
  notes: z.string().optional(),
});

export type ReviewApplicationInput = z.infer<typeof reviewApplicationSchema>;

export const APPLICATION_FILE_KINDS = [
  "id_front",
  "id_back",
  "license_front",
  "license_back",
  "profile_photo",
  "vehicle_photo",
] as const;

export const uploadApplicationFileSchema = z.object({
  kind: z.enum(APPLICATION_FILE_KINDS),
  fileName: z.string().trim().min(1).max(180),
  mimeType: z.enum([
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
  ]),
});

export type UploadApplicationFileInput = z.infer<typeof uploadApplicationFileSchema>;
export type ApplicationFileKind = typeof APPLICATION_FILE_KINDS[number];
