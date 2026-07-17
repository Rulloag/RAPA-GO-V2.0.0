import { z } from "zod";
import { loginRequestSchema, registerRequestSchema, authSessionSchema } from "@rapa-go/shared";

export { loginRequestSchema, registerRequestSchema, authSessionSchema };

/** Placeholder response body shape for unimplemented endpoints. */
export const AUTH_NOT_IMPLEMENTED = {
  ok: false,
  code: "AUTH_NOT_IMPLEMENTED",
  message: "Authentication provider integration is pending.",
} as const;


export const forgotPasswordRequestSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Ingresa un correo electrónico válido.")
    .max(255),
});

export const resetPasswordRequestSchema = z
  .object({
    token: z
      .string()
      .trim()
      .regex(
        /^[a-f0-9]{64}$/i,
        "El enlace de recuperación no es válido.",
      ),
    newPassword: z
      .string()
      .min(
        8,
        "La contraseña debe tener al menos 8 caracteres.",
      )
      .max(128, "La contraseña es demasiado larga."),
    confirmPassword: z.string(),
  })
  .superRefine((value, context) => {
    if (value.newPassword !== value.confirmPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Las contraseñas no coinciden.",
      });
    }
  });