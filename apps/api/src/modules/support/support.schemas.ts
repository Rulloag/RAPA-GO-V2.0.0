import { z } from "zod";

export const supportCategorySchema = z.enum([
  "support",
  "complaint",
  "lost_item",
  "safety",
  "payment",
  "other",
]);

export const supportPrioritySchema = z.enum([
  "low",
  "normal",
  "high",
  "urgent",
]);

export const supportStatusSchema = z.enum([
  "open",
  "in_review",
  "waiting_user",
  "resolved",
  "closed",
  "rejected",
]);

export const createSupportCaseSchema = z
  .object({
    category: supportCategorySchema,
    subject: z.string().trim().min(5).max(140),
    description: z.string().trim().min(10).max(4000),
    priority: supportPrioritySchema.optional().default("normal"),
    rideRequestId: z.string().uuid().nullable().optional(),
    contactPhone: z.string().trim().min(8).max(30).nullable().optional(),
    contactEmail: z.string().trim().email().max(255).nullable().optional(),
    lostItemDescription: z.string().trim().min(3).max(1500).nullable().optional(),
    lostItemLastSeenAt: z.string().datetime().nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.category === "lost_item" && !value.rideRequestId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rideRequestId"],
        message: "Los objetos perdidos deben asociarse a un viaje completado.",
      });
    }
    if (value.category === "lost_item" && !value.lostItemDescription) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lostItemDescription"],
        message: "Describe el objeto perdido.",
      });
    }
  });

export const addSupportMessageSchema = z.object({
  message: z.string().trim().min(2).max(3000),
});

export const adminSupportUpdateSchema = z
  .object({
    status: supportStatusSchema.optional(),
    priority: supportPrioritySchema.optional(),
    publicMessage: z.string().trim().min(2).max(3000).optional(),
    internalNote: z.string().trim().min(2).max(3000).optional(),
    resolution: z.string().trim().min(3).max(3000).optional(),
    assignToMe: z.boolean().optional(),
  })
  .refine(
    (value) => Object.values(value).some((item) => item !== undefined),
    { message: "Debes enviar al menos un cambio." },
  );

export const adminSupportListQuerySchema = z.object({
  status: supportStatusSchema.optional(),
  category: supportCategorySchema.optional(),
  priority: supportPrioritySchema.optional(),
  search: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export type SupportCategory = z.infer<typeof supportCategorySchema>;
export type SupportPriority = z.infer<typeof supportPrioritySchema>;
export type SupportStatus = z.infer<typeof supportStatusSchema>;
export type CreateSupportCaseInput = z.infer<typeof createSupportCaseSchema>;
export type AddSupportMessageInput = z.infer<typeof addSupportMessageSchema>;
export type AdminSupportUpdateInput = z.infer<typeof adminSupportUpdateSchema>;
export type AdminSupportListQuery = z.infer<typeof adminSupportListQuerySchema>;
