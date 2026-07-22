import { apiClient } from "../../services/api/index.js";
import type { AuthResponse } from "./auth.types.js";
import type { AppleSignInRequest, LoginRequest, RegisterRequest } from "./auth.types.js";


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


export type FacebookAccountSetupPayload = {
  setupCode: string;
  passengerFareType: "resident" | "chilean" | "foreigner";
  phone: string;
  rut?: string;
  passport?: string;
};

export type FacebookAccountSetupResponse = {
  ok: true;
  exchangeCode: string;
};

export type FacebookExistingAccountLinkPayload = {
  linkToken: string;
  password: string;
};

export type FacebookExistingAccountLinkResponse = {
  ok: true;
  exchangeCode: string;
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

  async signInWithApple(payload: AppleSignInRequest): Promise<AuthResponse> {
    const result = await apiClient.post<AuthResponse>(
      "/auth/apple",
      payload,
      undefined,
      0,
    );

    if (result.ok === false) {
      return { ok: false, code: result.code, message: result.message };
    }

    return result.data;
  },

  async linkApple(
    accessToken: string,
    payload: AppleSignInRequest,
  ): Promise<{ message: string }> {
    const result = await apiClient.post<{ ok: true; message: string }>(
      "/auth/apple/link",
      payload,
      { token: accessToken },
      0,
    );

    if (result.ok === false) {
      throw new Error(result.message);
    }

    return { message: result.data.message };
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


  async completeFacebookExistingAccountLink(
    payload: FacebookExistingAccountLinkPayload,
  ): Promise<FacebookExistingAccountLinkResponse> {
    const result =
      await apiClient.post<FacebookExistingAccountLinkResponse>(
        "/auth/facebook/link-existing",
        payload,
        undefined,
        0,
      );

    if (result.ok === false) {
      throw new Error(
        result.message ??
          "No se pudo vincular Facebook con tu cuenta RAPA GO.",
      );
    }

    return result.data;
  },

  async completeFacebookAccountSetup(
    payload: FacebookAccountSetupPayload,
  ): Promise<FacebookAccountSetupResponse> {
    const result =
      await apiClient.post<FacebookAccountSetupResponse>(
        "/auth/facebook/setup",
        payload,
        undefined,
        0,
      );

    if (result.ok === false) {
      throw new Error(
        result.message ??
          "No se pudo completar el registro con Facebook.",
      );
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


  async createPassword(
    accessToken: string,
    payload: { newPassword: string; confirmPassword: string },
  ): Promise<{ message: string }> {
    const result = await apiClient.post<{
      ok: true;
      message: string;
    }>(
      "/auth/password/create",
      payload,
      { token: accessToken },
    );

    if (result.ok === false) {
      throw new Error(result.message);
    }

    return { message: result.data.message };
  },

  async startFacebookLink(
    accessToken: string,
  ): Promise<string> {
    const result = await apiClient.post<{
      ok: true;
      authorizationUrl: string;
    }>(
      "/auth/facebook/link/start",
      undefined,
      { token: accessToken },
    );

    if (result.ok === false) {
      throw new Error(result.message);
    }

    return result.data.authorizationUrl;
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
