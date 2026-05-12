import type { LoginRequest, RegisterRequest, AuthResponse } from "./auth.types.js";

const API_BASE = import.meta.env["VITE_API_BASE_URL"] as string;

/**
 * AuthService (mobile) — communicates with the backend auth endpoints.
 * Never calls Supabase, Firebase, or any auth provider directly.
 * All auth logic is delegated to the backend.
 *
 * TODO(phase-auth-provider): replace placeholder 501 responses with real
 * backend integration once the auth provider is configured server-side.
 */
export const authService = {
  async login(payload: LoginRequest): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.json() as Promise<AuthResponse>;
  },

  async register(payload: RegisterRequest): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.json() as Promise<AuthResponse>;
  },

  async logout(accessToken: string): Promise<void> {
    await fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },

  async me(accessToken: string): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.json() as Promise<AuthResponse>;
  },
};
