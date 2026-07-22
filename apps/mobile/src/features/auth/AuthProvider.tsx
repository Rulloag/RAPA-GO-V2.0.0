import {
  createContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { useHistory } from "react-router-dom";
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
  AppleSignInRequest,
  AuthResponse,
} from "./auth.types.js";

export const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps): JSX.Element {
  const history = useHistory();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);

  const clearLocalSession = useCallback(async (): Promise<void> => {
    await sessionStorageService.clearSession();
    setSession(null);
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function restore(): Promise<void> {
      const persisted = await sessionStorageService.loadSession();
      if (cancelled) return;

      if (!persisted) {
        setStatus("unauthenticated");
        return;
      }

      const verified = await authService.me(persisted.accessToken);
      if (cancelled) return;

      if (!verified.ok) {
        await sessionStorageService.clearSession();
        if (!cancelled) {
          setSession(null);
          setUser(null);
          setStatus("unauthenticated");
        }
        return;
      }

      await sessionStorageService.saveSession(verified.session);
      if (cancelled) return;

      setSession(verified.session);
      setUser(verified.session.user);
      setStatus("authenticated");
    }

    void restore().catch(async () => {
      await sessionStorageService.clearSession();
      if (!cancelled) {
        setSession(null);
        setUser(null);
        setStatus("unauthenticated");
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const forceLogout = () => {
      void clearLocalSession().finally(() => {
        history.replace(ROUTES.AUTH.LOGIN);
      });
    };

    window.addEventListener("auth:force-logout", forceLogout);

    return () => {
      window.removeEventListener("auth:force-logout", forceLogout);
    };
  }, [clearLocalSession, history]);

  const login = useCallback(
    async (payload: LoginRequest): Promise<AuthResponse> => {
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
    },
    [],
  );

  const register = useCallback(
    async (payload: RegisterRequest): Promise<AuthResponse> => {
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
    },
    [],
  );

  const logout = useCallback(async (): Promise<void> => {
    let ok = true;

    if (session?.accessToken) {
      try {
        await authService.logout(session.accessToken);
      } catch {
        ok = false;
      }
    }

    try {
      await clearLocalSession();
    } catch {
      ok = false;
    }

    /**
     * Protocolo de sesión: notifica el resultado del cierre para que la UI
     * muestre el mensaje correspondiente (SessionLogoutToast).
     */
    window.dispatchEvent(
      new CustomEvent("auth:logout-result", { detail: { ok } }),
    );

    history.replace(ROUTES.AUTH.LOGIN);
  }, [session, clearLocalSession, history]);

  return (
    <AuthContext.Provider
      value={{ status, user, session, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
