import { z } from "zod";

export const upsertPassengerProfileSchema = z
  .object({
    preferredLanguage:     z.enum(["es", "en", "rapa_nui"]).optional(),
    notificationEnabled:   z.boolean().optional(),
    emailNotifications:    z.boolean().optional(),
    smsNotifications:      z.boolean().optional(),
    emergencyContactName:  z.string().trim().max(100).optional(),
    emergencyContactPhone: z.string().trim().max(20).optional(),
  })
  .strict("Teléfono, RUT y datos de identidad solo pueden modificarse mediante soporte y administración.");

export type UpsertPassengerProfileInput = z.infer<typeof upsertPassengerProfileSchema>;
