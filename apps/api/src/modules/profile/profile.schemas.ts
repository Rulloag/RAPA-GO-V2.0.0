import { z } from "zod";

export const updateProfileSchema = z
  .object({
    avatarUrl: z
      .string()
      .url("avatarUrl must be a valid URL.")
      .nullable()
      .optional(),
  })
  .strict("Los datos de identidad solo pueden modificarse mediante soporte y administración.")
  .refine((data) => "avatarUrl" in data, {
    message: "Solo se permite actualizar la foto de perfil.",
  });

export type UpdateProfileBody = z.infer<typeof updateProfileSchema>;
