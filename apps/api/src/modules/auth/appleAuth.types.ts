import type { UserRole } from "@rapa-go/shared";
import type { AuthServiceResult } from "./auth.types.js";

export interface AppleAuthName {
  givenName?: string | undefined;
  familyName?: string | undefined;
}

/**
 * Request body for POST /api/auth/apple.
 *
 * SECURITY: email, sub, and isPrivateEmail are deliberately NOT accepted
 * here — those properties are only ever taken from the verified
 * identityToken, never trusted from client-supplied fields.
 */
export interface AppleAuthRequest {
  identityToken: string;
  authorizationCode: string;
  nonce?: string | undefined;
  name?: AppleAuthName | undefined;
  /** Only used when creating a brand-new account; ignored for an existing one. */
  role?: UserRole | undefined;
}

export type AppleAuthResult = AuthServiceResult;
