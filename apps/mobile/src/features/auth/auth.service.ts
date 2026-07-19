import { apiClient } from "../../services/api/index.js";
import type { AuthResponse } from "./auth.types.js";
import type { LoginRequest, RegisterRequest, AppleSignInRequest } from "./auth.types.js";

/**
 * AuthService (mobile) — communicates with the backend auth endpoints.
 * Uses the centralized apiClient — never calls fetch, Supabase, or any
 * external auth provider directly.
 */
export const authService = {
  async login(payload: LoginRequest): Promise<AuthResponse> {
    const result = await apiClient.post<AuthResponse>("/auth/login", payload);
    if (!result.ok) {
      return { ok: false, code: result.code, message: result.message };
    }
    // Backend returns the AuthResponse shape directly (not nested under data)
    return result.data;
  },

  async register(payload: RegisterRequest): Promise<AuthResponse> {
    const result = await apiClient.post<AuthResponse>("/auth/register", payload);
    if (!result.ok) {
      return { ok: false, code: result.code, message: result.message };
    }
    return result.data;
  },

  async logout(accessToken: string): Promise<void> {
    await apiClient.post("/auth/logout", undefined, { token: accessToken });
  },

  async me(accessToken: string): Promise<AuthResponse> {
    const result = await apiClient.get<AuthResponse>("/auth/me", { token: accessToken });
    if (!result.ok) {
      return { ok: false, code: result.code, message: result.message };
    }
    return result.data;
  },

  async refresh(refreshToken: string): Promise<AuthResponse> {
    const result = await apiClient.post<AuthResponse>("/auth/refresh", { refreshToken }, undefined, 0);
    if (!result.ok) {
      return { ok: false, code: result.code, message: result.message };
    }
    return result.data;
  },

  /**
   * Exchanges a verified Apple identity for a Rapa Go session.
   * Never sent: client-reported email, Apple's `sub`, isPrivateEmail, or any
   * of Apple's own tokens (access/refresh) — only what auth.types.ts's
   * AppleSignInRequest declares. retries=0: this call is not safe to
   * silently retry (a retried authorizationCode exchange would fail on
   * Apple's side, since codes are single-use).
   */
  async signInWithApple(payload: AppleSignInRequest): Promise<AuthResponse> {
    const result = await apiClient.post<AuthResponse>("/auth/apple", payload, undefined, 0);
    if (!result.ok) {
      return { ok: false, code: result.code, message: result.message };
    }
    return result.data;
  },
};
