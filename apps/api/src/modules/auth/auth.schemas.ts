import { z } from "zod";
import {
  authSessionSchema,
  legalAcceptanceInputSchema,
  loginRequestSchema,
  registerRequestSchema,
  residenceAccreditationSchema,
  chileanRutSchema,
  validateRut,
  normalizeRut,
} from "@rapa-go/shared";

export { loginRequestSchema, registerRequestSchema, authSessionSchema };

/** Placeholder response body shape for unimplemented endpoints. */
export const AUTH_NOT_IMPLEMENTED = {
  ok: false,
  code: "AUTH_NOT_IMPLEMENTED",
  message: "Authentication provider integration is pending.",
} as const;


export const refreshSessionSchema = z.object({
  refreshToken: z
    .string()
    .trim()
    .regex(
      /^[a-f0-9]{96}$/i,
      "El token de renovación no es válido.",
    ),
});

export type RefreshSessionInput = z.infer<typeof refreshSessionSchema>;


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


export const createPasswordRequestSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, "La contraseña debe tener al menos 8 caracteres.")
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

export type CreatePasswordRequestInput = z.infer<
  typeof createPasswordRequestSchema
>;

const FACEBOOK_RESIDENT_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

const facebookResidentEmailSchema = z
  .string()
  .trim()
  .email("Ingresa un correo electrónico válido.")
  .max(255)
  .transform((value) => value.toLowerCase());

const facebookResidentRutSchema = chileanRutSchema;

export const facebookResidentPrecheckSchema = z.object({
  provider: z.enum(["facebook", "email"]).optional(),
  email: facebookResidentEmailSchema,
  phone: z
    .string()
    .trim()
    .min(8, "Ingresa un celular válido.")
    .max(24, "El celular es demasiado largo."),
  rut: facebookResidentRutSchema,
  documentName: z
    .string()
    .trim()
    .min(1, "El documento debe tener nombre.")
    .max(240),
  documentType: z.enum(FACEBOOK_RESIDENT_DOCUMENT_MIME_TYPES),
  documentSize: z
    .number()
    .int()
    .positive()
    .max(
      Math.floor(1.5 * 1024 * 1024),
      "El documento supera el máximo de 1.5 MB.",
    ),
  documentDataUrl: z
    .string()
    .trim()
    .min(32, "El documento está vacío.")
    .max(
      2_300_000,
      "El documento codificado supera el máximo permitido.",
    )
    .refine(
      (value) =>
        /^data:(application\/pdf|image\/jpeg|image\/png|image\/webp);base64,/i.test(
          value,
        ),
      "El documento debe ser PDF, JPG, PNG o WEBP.",
    ),
});

export const facebookResidentStatusSchema = z.object({
  email: facebookResidentEmailSchema,
  rut: facebookResidentRutSchema,
});


export const facebookAccountSetupSchema = z
  .object({
    setupCode: z
      .string()
      .trim()
      .min(32, "El código de Facebook no es válido.")
      .max(128, "El código de Facebook no es válido.")
      .regex(
        /^[A-Za-z0-9_-]+$/,
        "El código de Facebook no es válido.",
      ),
    passengerFareType: z.enum([
      "resident",
      "chilean",
      "foreigner",
    ]),
    phone: z
      .string()
      .trim()
      .regex(
        /^\+?[0-9]{8,15}$/,
        "Ingresa un celular válido.",
      ),
    rut: z.string().trim().max(20).optional(),
    passport: z.string().trim().max(30).optional(),
    legalAcceptances: z
      .array(legalAcceptanceInputSchema)
      .min(
        3,
        "Debes aceptar todos los documentos legales obligatorios.",
      )
      .max(12),
  })
  .superRefine((value, context) => {
    if (
      (value.passengerFareType === "resident" ||
        value.passengerFareType === "chilean") &&
      !validateRut(value.rut)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rut"],
        message: "Ingresa un RUT chileno válido.",
      });
    }

    if (
      value.passengerFareType === "foreigner" &&
      !value.passport?.trim()
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["passport"],
        message: "Ingresa tu pasaporte para continuar.",
      });
    }
  });

export type FacebookAccountSetupInput = z.infer<
  typeof facebookAccountSetupSchema
>;

export const facebookLoginExchangeSchema = z.object({
  exchangeCode: z
    .string()
    .trim()
    .min(32, "El código de Facebook no es válido.")
    .max(128, "El código de Facebook no es válido.")
    .regex(/^[A-Za-z0-9_-]+$/, "El código de Facebook no es válido."),
});

export type FacebookLoginExchangeInput = z.infer<
  typeof facebookLoginExchangeSchema
>;

export const facebookExistingAccountLinkSchema = z.object({
  linkToken: z
    .string()
    .trim()
    .min(64, "La vinculación con Facebook no es válida.")
    .max(4096, "La vinculación con Facebook no es válida."),
  password: z
    .string()
    .min(8, "Ingresa la contraseña de tu cuenta RAPA GO.")
    .max(128, "La contraseña es demasiado larga."),
});

export type FacebookExistingAccountLinkInput = z.infer<
  typeof facebookExistingAccountLinkSchema
>;

export type FacebookResidentPrecheckInput = z.infer<
  typeof facebookResidentPrecheckSchema
>;

export type FacebookResidentStatusInput = z.infer<
  typeof facebookResidentStatusSchema
>;



export const appleAuthRequestSchema = z.object({
  identityToken: z.string().trim().min(100).max(12000),
  authorizationCode: z.string().trim().min(8).max(4096),
  nonce: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{64}$/i, "El nonce de Apple no es válido."),
  name: z
    .object({
      givenName: z.string().trim().max(50).optional(),
      familyName: z.string().trim().max(50).optional(),
    })
    .optional(),
  role: z
    .enum(["passenger", "driver", "guide", "rental_operator"])
    .optional(),
  displayName: z.string().trim().min(2).max(100).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{8,15}$/, "El teléfono de Apple no es válido.")
    .optional(),
  rut: z.string().trim().max(20).optional(),
  passport: z.string().trim().max(30).optional(),
  // Formato validado en preparePassengerSetup (no aquí): un .email() fallido
  // a nivel de schema devolvería VALIDATION_ERROR, código que el cliente
  // interpreta como "falta elegir rol" y lo devolvería a esa pantalla.
  contactEmail: z.string().trim().max(254).optional(),
  passengerFareType: z
    .enum(["resident", "chilean", "foreigner"])
    .optional(),
  legalAcceptances: z
    .array(
      z.object({
        legalDocumentId: z.string().uuid(),
        version: z.string().trim().min(1).max(30),
      }),
    )
    .max(12)
    .optional(),
  residenceAccreditation: residenceAccreditationSchema.optional(),
});

export type AppleAuthRequestInput = z.infer<
  typeof appleAuthRequestSchema
>;

export const googleAuthRequestSchema = z
  .object({
    idToken: z.string().trim().min(100).max(16000),
    linkPassword: z.string().min(8).max(128).optional(),
    displayName: z.string().trim().min(2).max(100).optional(),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9]{8,15}$/, "El teléfono de Google no es válido.")
      .optional(),
    rut: z.string().trim().max(20).optional(),
    passport: z.string().trim().max(30).optional(),
    passengerFareType: z
      .enum(["resident", "chilean", "foreigner"])
      .optional(),
    legalAcceptances: z
      .array(legalAcceptanceInputSchema)
      .max(12)
      .optional(),
    residenceAccreditation: residenceAccreditationSchema.optional(),
  })
  .superRefine((value, context) => {
    if (value.rut && value.passport) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rut"],
        message: "No debes enviar RUT y pasaporte al mismo tiempo.",
      });
    }

    if (value.rut && !validateRut(value.rut)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rut"],
        message: "Ingresa un RUT chileno válido.",
      });
    }
  });

export type GoogleAuthRequestInput = z.infer<
  typeof googleAuthRequestSchema
>;

