import { apiClient } from "../../services/api/index.js";
import type { AuthResponse } from "./auth.types.js";
import type { LoginRequest, RegisterRequest } from "./auth.types.js";

/**
 * AuthService (mobile) — communicates with the backend auth endpoints.
 * Uses the centralized apiClient — never calls fetch, Supabase, or any
 * external auth provider directly.
 *
 * TODO(phase-auth-provider): endpoints currently return AUTH_NOT_IMPLEMENTED
 * from the backend until the auth provider is configured server-side.
 */
export const authService = {
  async login(payload: LoginRequest): Promise<AuthResponse> {
    const result = await apiClient.post<AuthResponse>("/auth/login", payload);
    if (result.ok === false) {
      return { ok: false, code: result.code, message: result.message };
    }
    // Backend returns the AuthResponse shape directly (not nested under data)
    return result.data;
  },

  async register(payload: RegisterRequest): Promise<AuthResponse> {
    const result = await apiClient.post<AuthResponse>("/auth/register", payload);
    if (result.ok === false) {
      return { ok: false, code: result.code, message: result.message };
    }
    return result.data;
  },

  async logout(accessToken: string): Promise<void> {
    await apiClient.post("/auth/logout", undefined, { token: accessToken });
  },

  async me(accessToken: string): Promise<AuthResponse> {
    const result = await apiClient.get<AuthResponse>("/auth/me", { token: accessToken });
    if (result.ok === false) {
      return { ok: false, code: result.code, message: result.message };
    }
    return result.data;
  },
};
