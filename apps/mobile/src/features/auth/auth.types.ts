import type { AuthUser, AuthSession, AuthStatus, LoginRequest, RegisterRequest, AuthResponse } from "@rapa-go/shared";

export type { AuthUser, AuthSession, AuthStatus, LoginRequest, RegisterRequest, AuthResponse };

/** Shape exposed by the AuthContext to the rest of the app. */
export interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  /**
   * Session is held in memory only.
   * TODO(phase-auth-persistence): implement secure token storage via
   * Capacitor Secure Storage or equivalent — never localStorage.
   */
  session: AuthSession | null;
  login: (payload: LoginRequest) => Promise<AuthResponse>;
  register: (payload: RegisterRequest) => Promise<AuthResponse>;
  logout: () => Promise<void>;
}
