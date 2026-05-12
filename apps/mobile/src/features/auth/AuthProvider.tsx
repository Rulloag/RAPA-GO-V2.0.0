import { createContext, useState, useCallback, type ReactNode } from "react";
import { authService } from "./auth.service.js";
import type { AuthContextValue, AuthUser, AuthSession, AuthStatus, LoginRequest, RegisterRequest, AuthResponse } from "./auth.types.js";

export const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * AuthProvider — manages authentication state for the entire app.
 *
 * Session is held in React state (memory) only.
 * TODO(phase-auth-persistence): add secure token persistence via
 * Capacitor Secure Storage — never localStorage or sessionStorage.
 *
 * The provider does not connect to Supabase or any external auth service
 * directly. All auth operations go through the backend API.
 */
export function AuthProvider({ children }: AuthProviderProps): JSX.Element {
  const [status, setStatus] = useState<AuthStatus>("unauthenticated");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);

  const login = useCallback(async (payload: LoginRequest): Promise<AuthResponse> => {
    setStatus("loading");
    const response = await authService.login(payload);
    if (response.ok) {
      setSession(response.session);
      setUser(response.session.user);
      setStatus("authenticated");
    } else {
      setStatus("unauthenticated");
    }
    return response;
  }, []);

  const register = useCallback(async (payload: RegisterRequest): Promise<AuthResponse> => {
    setStatus("loading");
    const response = await authService.register(payload);
    if (response.ok) {
      setSession(response.session);
      setUser(response.session.user);
      setStatus("authenticated");
    } else {
      setStatus("unauthenticated");
    }
    return response;
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    if (session?.accessToken) {
      await authService.logout(session.accessToken);
    }
    setSession(null);
    setUser(null);
    setStatus("unauthenticated");
  }, [session]);

  return (
    <AuthContext.Provider value={{ status, user, session, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
