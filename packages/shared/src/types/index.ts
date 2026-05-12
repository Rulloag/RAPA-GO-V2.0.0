/**
 * Shared domain types.
 * Types for Trip, Wallet, Payment, Guide, Rental, etc. will be added here
 * as each module enters the implementation phase.
 *
 * Current state: foundational utility types + auth types (Phase 6).
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

// ─── Auth types ───────────────────────────────────────────────────────────────

/** Authenticated user as returned by the backend. */
export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl: string | null;
  isVerified: boolean;
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

/** Payload sent to POST /api/auth/register */
export type RegisterRequest = {
  email: string;
  password: string;
  name: string;
  role: UserRole;
};

/** Standard auth response envelope from the backend. */
export type AuthResponse =
  | { ok: true; session: AuthSession }
  | { ok: false; code: string; message: string };
