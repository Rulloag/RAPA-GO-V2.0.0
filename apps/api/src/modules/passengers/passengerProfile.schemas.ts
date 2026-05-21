import { z } from "zod";

export const upsertPassengerProfileSchema = z.object({
  phone:                 z.string().trim().max(20).optional(),
  preferredLanguage:     z.enum(["es", "en", "rapa_nui"]).optional(),
  notificationEnabled:   z.boolean().optional(),
  emailNotifications:    z.boolean().optional(),
  smsNotifications:      z.boolean().optional(),
  emergencyContactName:  z.string().trim().max(100).optional(),
  emergencyContactPhone: z.string().trim().max(20).optional(),
});
export type UpsertPassengerProfileInput = z.infer<typeof upsertPassengerProfileSchema>;
