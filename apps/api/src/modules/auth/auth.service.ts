import type { LoginRequest, RegisterRequest, AuthServiceResult } from "./auth.types.js";

/**
 * AuthService — business logic layer for authentication.
 *
 * Current state: all methods return AUTH_NOT_IMPLEMENTED.
 *
 * TODO(phase-auth-provider): wire real JWT issuance, password hashing,
 * and database user lookup when the auth provider is selected and configured.
 * The provider (Supabase Auth, custom JWT, etc.) must be injected here,
 * never referenced from the mobile client.
 */
export class AuthService {
  async login(_payload: LoginRequest): Promise<AuthServiceResult> {
    return {
      ok: false,
      code: "AUTH_NOT_IMPLEMENTED",
      message: "Authentication provider integration is pending.",
    };
  }

  async register(_payload: RegisterRequest): Promise<AuthServiceResult> {
    return {
      ok: false,
      code: "AUTH_NOT_IMPLEMENTED",
      message: "Authentication provider integration is pending.",
    };
  }

  async logout(_accessToken: string): Promise<{ ok: boolean }> {
    // TODO(phase-auth-provider): invalidate token / refresh token
    return { ok: true };
  }

  /**
   * Verify a token and return the associated user.
   * TODO(phase-auth-provider): implement real token verification.
   */
  async getMe(_accessToken: string): Promise<AuthServiceResult> {
    return {
      ok: false,
      code: "AUTH_NOT_IMPLEMENTED",
      message: "Authentication provider integration is pending.",
    };
  }
}
