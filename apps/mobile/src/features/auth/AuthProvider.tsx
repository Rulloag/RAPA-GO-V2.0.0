import { createContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { useHistory } from "react-router-dom";
import { authService } from "./auth.service.js";
import { sessionStorageService } from "./sessionStorage.service.js";
import { ROUTES } from "../../navigation/routes";
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

export function AuthProvider({ children }: AuthProviderProps): JSX.Element {
  const history = useHistory();

  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      try {
        const persisted = await sessionStorageService.loadSession();
        if (cancelled) return;

        if (persisted) {
          const restoredUser: AuthUser = {
            id: persisted.userId,
            email: persisted.email,
            name: persisted.name,
            role: persisted.role as UserRole,
            avatarUrl: persisted.avatarUrl,
            isVerified: persisted.isVerified,
          };

          const restoredSession: AuthSession = {
            accessToken: persisted.accessToken,
            expiresAt: persisted.expiresAt,
            user: restoredUser,
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

    return () => {
      cancelled = true;
    };
  }, []);

  // IMPORTANTE:
  // Ya no cerramos sesión automáticamente cuando el token expira.
  // La sesión solo se cerrará cuando el usuario presione "Cerrar sesión".
  useEffect(() => {
    const handler = () => {
      console.warn("Token expirado, pero se mantiene la sesión abierta.");
    };

    window.addEventListener("auth:expired", handler);

    return () => {
      window.removeEventListener("auth:expired", handler);
    };
  }, []);

  useEffect(() => {
    const forceLogout = () => {
      void sessionStorageService.clearSession().finally(() => {
        setSession(null);
        setUser(null);
        setStatus("unauthenticated");
        history.replace(ROUTES.AUTH.LOGIN);
      });
    };

    window.addEventListener("auth:force-logout", forceLogout);

    return () => {
      window.removeEventListener("auth:force-logout", forceLogout);
    };
  }, [history]);

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

  const logout = useCallback(async (): Promise<void> => {
    if (session?.accessToken) {
      await authService.logout(session.accessToken).catch(() => {});
    }

    await sessionStorageService.clearSession();

    setSession(null);
    setUser(null);
    setStatus("unauthenticated");

    history.replace(ROUTES.AUTH.LOGIN);
  }, [session, history]);

  return (
    <AuthContext.Provider value={{ status, user, session, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
