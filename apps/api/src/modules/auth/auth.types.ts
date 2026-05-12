import type { AuthUser, AuthSession, LoginRequest, RegisterRequest, AuthResponse } from "@rapa-go/shared";

export type { AuthUser, AuthSession, LoginRequest, RegisterRequest, AuthResponse };

/** Internal service result before mapping to HTTP response. */
export type AuthServiceResult =
  | { ok: true; session: AuthSession }
  | { ok: false; code: string; message: string; statusCode?: number };
