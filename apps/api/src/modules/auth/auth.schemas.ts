import { z } from "zod";
import { loginRequestSchema, registerRequestSchema, authSessionSchema, USER_ROLES } from "@rapa-go/shared";

export { loginRequestSchema, registerRequestSchema, authSessionSchema };

/** Placeholder response body shape for unimplemented endpoints. */
export const AUTH_NOT_IMPLEMENTED = {
  ok: false,
  code: "AUTH_NOT_IMPLEMENTED",
  message: "Authentication provider integration is pending.",
} as const;

/**
 * Request body for POST /api/auth/apple.
 *
 * email, sub, and isPrivateEmail are intentionally NOT part of this schema —
 * those are only ever taken from the verified identityToken server-side.
 */
export const appleAuthRequestSchema = z.object({
  identityToken:     z.string().min(1, { message: "identityToken is required." }),
  authorizationCode: z.string().min(1, { message: "authorizationCode is required." }),
  nonce:             z.string().min(1).optional(),
  name: z.object({
    givenName:  z.string().max(100).optional(),
    familyName: z.string().max(100).optional(),
  }).optional(),
  role: z.enum(USER_ROLES, { errorMap: () => ({ message: "Invalid role." }) }).optional(),
});
