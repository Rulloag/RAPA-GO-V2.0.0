import { apiClient } from "../../services/api/index.js";
import type { AuthResponse } from "./auth.types.js";
import type { LoginRequest, RegisterRequest } from "./auth.types.js";


export type FacebookResidentVerificationStatus =
  | "missing"
  | "pending"
  | "approved"
  | "rejected";

export type FacebookResidentStatusResponse = {
  ok: true;
  status: FacebookResidentVerificationStatus;
  message: string;
  userId?: string;
  documentId?: string;
  rejectionReason?: string | null;
};

export type FacebookResidentPrecheckPayload = {
  provider?: "facebook" | "email";
  email: string;
  phone: string;
  rut: string;
  documentName: string;
  documentType:
    | "application/pdf"
    | "image/jpeg"
    | "image/png"
    | "image/webp";
  documentSize: number;
  documentDataUrl: string;
};

export type FacebookResidentPrecheckResponse = {
  ok: true;
  status: "pending" | "approved";
  message: string;
  userId: string;
  documentId: string;
  rejectionReason?: string | null;
};

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

  async exchangeFacebookLogin(
    exchangeCode: string,
  ): Promise<AuthResponse> {
    const result = await apiClient.post<AuthResponse>(
      "/auth/facebook/exchange",
      { exchangeCode },
      undefined,
      0,
    );

    if (result.ok === false) {
      return {
        ok: false,
        code: result.code,
        message: result.message,
      };
    }

    return result.data;
  },

  async getFacebookResidentStatus(
    payload: { email: string; rut: string },
  ): Promise<FacebookResidentStatusResponse> {
    const result =
      await apiClient.post<FacebookResidentStatusResponse>(
        "/auth/facebook/resident-status",
        payload,
      );

    if (result.ok === false) {
      throw new Error(
        result.message ??
          "No se pudo consultar el estado de residencia.",
      );
    }

    return result.data;
  },

  async submitFacebookResidentPrecheck(
    payload: FacebookResidentPrecheckPayload,
  ): Promise<FacebookResidentPrecheckResponse> {
    const result =
      await apiClient.post<FacebookResidentPrecheckResponse>(
        "/auth/facebook/resident-precheck",
        payload,
      );

    if (result.ok === false) {
      throw new Error(
        result.message ??
          "No se pudo enviar el documento de residencia.",
      );
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
