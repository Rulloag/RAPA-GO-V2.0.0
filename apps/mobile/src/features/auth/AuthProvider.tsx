import { createContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { useHistory } from "react-router-dom";
import { useIonToast } from "@ionic/react";
import { authService } from "./auth.service.js";
import { sessionStorageService } from "./sessionStorage.service.js";
import { ROUTES } from "../../navigation/routes.js";
import type {
  AuthContextValue,
  AuthUser,
  AuthSession,
  AuthStatus,
  LoginRequest,
  RegisterRequest,
  AuthResponse,
} from "./auth.types.js";
import type { UserRole } from "@rapa-go/shared";

export const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * AuthProvider — manages authentication state for the entire app.
 *
 * Session persistence:
 *  - Currently memory-only via SessionStorageService.
 *  - On app start, attempts to load a non-expired session from the service.
 *  - Starts in "loading" state until the restore attempt completes.
 *
 * TODO(phase-secure-storage): when SessionStorageService is backed by
 * Keychain/Keystore, persistence will survive app restarts automatically —
 * no changes needed in this file.
 *
 * SECURITY invariants:
 *  - Never use localStorage or sessionStorage.
 *  - Password is never stored in state beyond the login call.
 *  - accessToken is in memory only (current implementation).
 */
export function AuthProvider({ children }: AuthProviderProps): JSX.Element {
  const history = useHistory();
  const [presentToast] = useIonToast();
  const [status, setStatus]   = useState<AuthStatus>("loading");
  const [user, setUser]       = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);

  // ── Restore session on mount ────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function restore() {
      try {
        const persisted = await sessionStorageService.loadSession();
        if (cancelled) return;

        if (persisted) {
          const restoredUser: AuthUser = {
            id:         persisted.userId,
            email:      persisted.email,
            name:       persisted.name,
            role:       persisted.role as UserRole,
            avatarUrl:  persisted.avatarUrl,
            isVerified: persisted.isVerified,
          };
          const restoredSession: AuthSession = {
            accessToken: persisted.accessToken,
            expiresAt:   persisted.expiresAt,
            user:        restoredUser,
          };
          setUser(restoredUser);
          setSession(restoredSession);
          setStatus("authenticated");
        } else {
          setStatus("unauthenticated");
        }
      } catch {
        if (!cancelled) setStatus("unauthenticated");
      }
    }

    void restore();
    return () => { cancelled = true; };
  }, []);

  // ── Auth-expired event listener ─────────────────────────────────────────────
  useEffect(() => {
    const handler = () => {
      setSession(null);
      setUser(null);
      setStatus("unauthenticated");
      history.push(ROUTES.AUTH.LOGIN);
      void presentToast({
        message: "Tu sesión expiró. Inicia sesión nuevamente.",
        duration: 3000,
        color: "warning",
        position: "top",
      });
    };
    window.addEventListener("auth:expired", handler);
    return () => window.removeEventListener("auth:expired", handler);
  }, [history, presentToast]);

  // ── Login ────────────────────────────────────────────────────────────────────
  const login = useCallback(async (payload: LoginRequest): Promise<AuthResponse> => {
    setStatus("loading");
    const response = await authService.login(payload);
    if (response.ok) {
      await sessionStorageService.saveSession(response.session);
      setSession(response.session);
      setUser(response.session.user);
      setStatus("authenticated");
    } else {
      setStatus("unauthenticated");
    }
    return response;
  }, []);

  // ── Register ─────────────────────────────────────────────────────────────────
  const register = useCallback(async (payload: RegisterRequest): Promise<AuthResponse> => {
    setStatus("loading");
    const response = await authService.register(payload);
    if (response.ok) {
      await sessionStorageService.saveSession(response.session);
      setSession(response.session);
      setUser(response.session.user);
      setStatus("authenticated");
    } else {
      setStatus("unauthenticated");
    }
    return response;
  }, []);

  // ── Logout ───────────────────────────────────────────────────────────────────
  const logout = useCallback(async (): Promise<void> => {
    if (session?.accessToken) {
      await authService.logout(session.accessToken);
    }
    await sessionStorageService.clearSession();
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
