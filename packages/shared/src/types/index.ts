/**
 * Shared domain types.
 * Types for Trip, Wallet, Payment, Guide, Rental, etc. will be added here
 * as each module enters the implementation phase.
 *
 * Current state: foundational utility types + auth types (Phase 6) + API response types (Phase 7).
 */

import type { UserRole } from "../constants/index.js";

export type { UserRole };

/** Standard error shape returned by the API. */
export type ApiError = {
  error: {
    code: string;
    message: string;
    statusCode: number;
  };
};

/** Standard paginated response wrapper from the API. */
export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
};

// ─── API response envelope (Phase 7) ─────────────────────────────────────────

/**
 * Canonical error codes used across mobile and backend.
 * Client-side codes (NETWORK_ERROR, TIMEOUT, INVALID_RESPONSE) are
 * produced by the API client before reaching the backend.
 */
export type ApiErrorCode =
  // Client-side transport errors
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "INVALID_RESPONSE"
  // Generic server errors
  | "INTERNAL_SERVER_ERROR"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  // Auth-specific
  | "AUTH_NOT_IMPLEMENTED"
  | "AUTH_INVALID_CREDENTIALS"
  | "AUTH_EMAIL_TAKEN"
  | "AUTH_TOKEN_EXPIRED"
  | (string & Record<never, never>); // allow module-specific codes without losing autocomplete

/** Successful API response envelope. */
export type ApiSuccessResponse<T> = {
  ok: true;
  data: T;
  statusCode: number;
};

/** Error API response envelope. */
export type ApiErrorResponse = {
  ok: false;
  code: ApiErrorCode;
  message: string;
  statusCode: number;
};

/** Union of all possible API responses. */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// ─── Auth types ───────────────────────────────────────────────────────────────

/** Authenticated user as returned by the backend. */
export type PassengerFareType = "resident" | "chilean" | "foreigner";
export type AuthProvider = "password" | "facebook" | "apple";

export type ResidenceVerificationStatus =
  | "not_required"
  | "pending"
  | "approved"
  | "rejected";

/** Authenticated user as returned by the backend. */
export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl: string | null;
  isVerified: boolean;
  /** Contact phone stored in the passenger/driver profile when available. */
  phone?: string | null;
  /** Categoría solicitada por la persona. */
  requestedPassengerFareType?: PassengerFareType;
  /** Categoría que realmente se usa para calcular el precio. */
  passengerFareType?: PassengerFareType;
  residenceVerificationStatus?: ResidenceVerificationStatus;
  /** Authentication methods currently linked to the account. */
  authProviders?: AuthProvider[];
  /** True when the account can sign in with email and password. */
  hasPassword?: boolean;
};

/**
 * Active session managed by the backend.
 * Tokens are never stored in localStorage or sessionStorage.
 * Secure persistence strategy will be defined in a future phase.
 */
export type AuthSession = {
  accessToken: string;
  /** ISO-8601 expiry timestamp */
  expiresAt: string;
  user: AuthUser;
};

/** Possible auth states in the client. */
export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

/** Payload sent to POST /api/auth/login */
export type LoginRequest = {
  email: string;
  password: string;
};

export type LegalAcceptanceInput = {
  legalDocumentId: string;
  version: string;
};

/** Payload sent to POST /api/auth/register */
export type RegisterRequest = {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  phone?: string | undefined;
  passengerFareType?: PassengerFareType | undefined;
  legalAcceptances: LegalAcceptanceInput[];
};

/** Standard auth response envelope from the backend. */
export type AuthResponse =
  | { ok: true; session: AuthSession }
  | { ok: false; code: string; message: string };
