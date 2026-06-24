import { loginRequestSchema, registerRequestSchema, authSessionSchema } from "@rapa-go/shared";
import { z } from "zod";

export { loginRequestSchema, registerRequestSchema, authSessionSchema };

export const googleLoginSchema = z.object({
  idToken: z.string().min(1).max(4096),
});

/** Placeholder response body shape for unimplemented endpoints. */
export const AUTH_NOT_IMPLEMENTED = {
  ok: false,
  code: "AUTH_NOT_IMPLEMENTED",
  message: "Authentication provider integration is pending.",
} as const;
