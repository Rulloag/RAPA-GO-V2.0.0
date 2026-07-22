import type { AuthUser, AuthSession, AuthStatus, LoginRequest, RegisterRequest, AuthResponse, UserRole } from "@rapa-go/shared";

export type { AuthUser, AuthSession, AuthStatus, LoginRequest, RegisterRequest, AuthResponse };

/**
 * Payload sent to POST /api/auth/apple.
 *
 * SECURITY: intentionally has no `email`, `sub`, or `isPrivateEmail` field —
 * the backend takes those exclusively from the verified identityToken.
 */
export interface AppleSignInRequest {
  identityToken: string;
  authorizationCode: string;
  /** Raw (unhashed) nonce — the backend hashes it once itself to compare. */
  nonce: string;
  name?: {
    givenName?: string;
    familyName?: string;
  };
  /** Only sent when the backend needs it to create a brand-new account. */
  role?: UserRole;
}

/** Shape exposed by the AuthContext to the rest of the app. */
export interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  /** Session is persisted via SessionStorageService (native Keychain/Keystore). */
  session: AuthSession | null;
  login: (payload: LoginRequest) => Promise<AuthResponse>;
  register: (payload: RegisterRequest) => Promise<AuthResponse>;
  signInWithApple: (payload: AppleSignInRequest) => Promise<AuthResponse>;
  logout: () => Promise<void>;
}
