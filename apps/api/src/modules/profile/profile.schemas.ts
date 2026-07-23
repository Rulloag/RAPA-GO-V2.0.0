import { z } from "zod";

export const updateProfileSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters.")
      .max(100)
      .optional(),
    avatarUrl: z
      .string()
      .url("avatarUrl must be a valid URL.")
      .nullable()
      .optional(),
    phone: z
      .string()
      .trim()
      .transform((value) => value.replace(/[^+\d]/g, ""))
      .refine(
        (value) => /^\+?[0-9]{8,15}$/.test(value),
        "Ingresa un teléfono válido de 8 a 15 dígitos.",
      )
      .optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      "avatarUrl" in data ||
      data.phone !== undefined,
    {
      message:
        "At least one field (name, avatarUrl or phone) must be provided.",
    },
  );

export type UpdateProfileBody = z.infer<typeof updateProfileSchema>;
