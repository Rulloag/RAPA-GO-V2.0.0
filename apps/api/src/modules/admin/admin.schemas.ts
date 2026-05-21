import { z } from "zod";
import { RIDE_STATUSES } from "@rapa-go/shared";

const VALID_ROLES   = ["passenger", "driver", "guide", "rental", "rental_operator", "admin"] as const;
const VALID_STATUSES = ["pending", "active", "suspended", "banned"] as const;

export const listUsersQuerySchema = z.object({
  role:   z.enum(VALID_ROLES).optional(),
  status: z.enum(VALID_STATUSES).optional(),
  search: z.string().trim().max(100).optional(),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

export const updateUserStatusSchema = z.object({
  status: z.enum(VALID_STATUSES),
});

export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;

const VALID_DOC_STATUSES = ["pending", "uploaded", "approved", "rejected"] as const;
const VALID_DOC_TYPES = [
  "identity_document",
  "driver_license",
  "vehicle_registration",
  "vehicle_insurance",
  "guide_certification",
  "business_registration",
  "vehicle_ownership",
] as const;

export const listDocumentsQuerySchema = z.object({
  status:       z.enum(VALID_DOC_STATUSES).optional(),
  documentType: z.enum(VALID_DOC_TYPES).optional(),
  userId:       z.string().uuid().optional(),
});

export type ListDocumentsQuery = z.infer<typeof listDocumentsQuerySchema>;

export const reviewDocumentSchema = z.object({
  status:          z.enum(["approved", "rejected"]),
  rejectionReason: z.string().trim().max(500).optional(),
}).superRefine((val, ctx) => {
  if (val.status === "rejected" && !val.rejectionReason) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["rejectionReason"], message: "rejectionReason is required when status is rejected." });
  }
});

export type ReviewDocumentInput = z.infer<typeof reviewDocumentSchema>;

// GET /admin/rides query
export const adminListRidesQuerySchema = z.object({
  status:          z.enum(RIDE_STATUSES).optional(),
  driverUserId:    z.string().uuid().optional(),
  passengerUserId: z.string().uuid().optional(),
});

export type AdminListRidesQuery = z.infer<typeof adminListRidesQuerySchema>;

// POST /admin/rides/:id/assign body
export const adminAssignDriverSchema = z.object({
  driverUserId: z.string().uuid({ message: "driverUserId must be a valid UUID." }),
});

export type AdminAssignDriverInput = z.infer<typeof adminAssignDriverSchema>;

// POST /admin/rides/:id/cancel body
export const adminCancelRideSchema = z.object({
  reason: z.string().trim().min(3, "Reason must be at least 3 characters.").max(500, "Reason cannot exceed 500 characters."),
});

export type AdminCancelRideInput = z.infer<typeof adminCancelRideSchema>;
