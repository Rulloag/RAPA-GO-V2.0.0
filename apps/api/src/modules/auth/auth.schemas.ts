import { loginRequestSchema, registerRequestSchema, authSessionSchema } from "@rapa-go/shared";

export { loginRequestSchema, registerRequestSchema, authSessionSchema };

/** Placeholder response body shape for unimplemented endpoints. */
export const AUTH_NOT_IMPLEMENTED = {
  ok: false,
  code: "AUTH_NOT_IMPLEMENTED",
  message: "Authentication provider integration is pending.",
} as const;
