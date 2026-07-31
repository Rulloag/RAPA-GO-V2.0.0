import { apiClient } from "../../services/api/index.js";
import type {
  AppleSignInRequest,
  AppleWebAuthResponse,
  AppleWebCompleteRequest,
  AuthResponse,
  GoogleAuthResponse,
  GoogleSignInRequest,
  LoginRequest,
  RegisterRequest,
} from "./auth.types.js";


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

export type FacebookAccountSetupPayload = {
  setupCode: string;
  passengerFareType: "resident" | "chilean" | "foreigner";
  phone: string;
  rut?: string;
  passport?: string;
  legalAcceptances: Array<{
    legalDocumentId: string;
    version: string;
  }>;
};

export type FacebookAccountSetupResponse =
  | {
      ok: true;
      exchangeCode: string;
    }
  | {
      ok: false;
      code: string;
      message: string;
    };

type MessageResponse = {
  ok: true;
  message: string;
};

type FacebookLinkStartResponse = {
  ok: true;
  authorizationUrl: string;
};

/**
 * AuthService (mobile) — communicates with the backend auth endpoints.
 * Uses the centralized apiClient — never calls fetch, Supabase, or any
 * external auth provider directly.
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

  async completeFacebookSetup(
    payload: FacebookAccountSetupPayload,
  ): Promise<FacebookAccountSetupResponse> {
    const result =
      await apiClient.post<{ ok: true; exchangeCode: string }>(
        "/auth/facebook/setup",
        payload,
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

  async refresh(refreshToken: string): Promise<AuthResponse> {
    const result = await apiClient.post<AuthResponse>("/auth/refresh", { refreshToken }, undefined, 0);
    if (result.ok === false) {
      return { ok: false, code: result.code, message: result.message };
    }
    return result.data;
  },


  async signInWithGoogle(
    payload: GoogleSignInRequest,
  ): Promise<GoogleAuthResponse> {
    const result = await apiClient.post<GoogleAuthResponse>(
      "/auth/google",
      payload,
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

  /**
   * Exchanges a verified Apple identity for a Rapa Go session.
   * Never sent: client-reported email, Apple's `sub`, isPrivateEmail, or any
   * of Apple's own tokens (access/refresh) — only what auth.types.ts's
   * AppleSignInRequest declares. retries=0: this call is not safe to
   * silently retry (a retried authorizationCode exchange would fail on
   * Apple's side, since codes are single-use).
   */
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

  getAppleWebStartUrl(): string {
    const configuredBase = String(
      import.meta.env.VITE_API_BASE_URL ??
        import.meta.env.VITE_API_URL ??
        "",
    ).trim();
    const baseUrl = configuredBase || window.location.origin;
    const backendOrigin = new URL(baseUrl, window.location.origin).origin;

    return `${backendOrigin}/auth/apple/web/start`;
  },

  async signInWithAppleWeb(
    payload: AppleWebCompleteRequest,
  ): Promise<AppleWebAuthResponse> {
    const result = await apiClient.post<AppleWebAuthResponse>(
      "/auth/apple/web/complete",
      payload,
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

  async linkApple(
    accessToken: string,
    payload: AppleSignInRequest,
  ): Promise<MessageResponse> {
    const result = await apiClient.post<MessageResponse>(
      "/auth/apple/link",
      payload,
      { token: accessToken },
      0,
    );
    if (result.ok === false) {
      throw new Error(result.message ?? "No se pudo vincular Apple.");
    }
    return result.data;
  },

  async createPassword(
    accessToken: string,
    payload: { newPassword: string; confirmPassword: string },
  ): Promise<MessageResponse> {
    const result = await apiClient.post<MessageResponse>(
      "/auth/password/create",
      payload,
      { token: accessToken },
      0,
    );
    if (result.ok === false) {
      throw new Error(result.message ?? "No se pudo crear la contraseña.");
    }
    return result.data;
  },

  async startFacebookLink(accessToken: string): Promise<string> {
    const result = await apiClient.post<FacebookLinkStartResponse>(
      "/auth/facebook/link/start",
      {},
      { token: accessToken },
      0,
    );
    if (result.ok === false) {
      throw new Error(
        result.message ?? "No se pudo iniciar la vinculación con Facebook.",
      );
    }
    return result.data.authorizationUrl;
  },
};
