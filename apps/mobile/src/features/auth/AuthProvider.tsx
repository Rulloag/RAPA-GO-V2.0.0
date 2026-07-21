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
import { clientStoragePolicy } from "../../services/storage/clientStoragePolicy.js";
import type {
  AuthContextValue,
  AuthUser,
  AuthSession,
  AuthStatus,
  LoginRequest,
  RegisterRequest,
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
    clientStoragePolicy.clearSensitiveClientStorage();
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
        clientStoragePolicy.clearSensitiveClientStorage();
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
      clientStoragePolicy.clearSensitiveClientStorage();
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
    if (status !== "authenticated" || !session?.accessToken) return;

    let cancelled = false;
    let refreshing = false;

    const refreshSessionUser = async (): Promise<void> => {
      if (refreshing || cancelled) return;
      refreshing = true;

      try {
        const verified = await authService.me(session.accessToken);
        if (cancelled || !verified.ok) return;

        await sessionStorageService.saveSession(verified.session);
        if (cancelled) return;

        setSession(verified.session);
        setUser(verified.session.user);
      } finally {
        refreshing = false;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshSessionUser();
      }
    };

    window.addEventListener("focus", refreshSessionUser);
    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );
    window.addEventListener(
      "rapago:resident-verification-updated",
      refreshSessionUser,
    );

    return () => {
      cancelled = true;
      window.removeEventListener("focus", refreshSessionUser);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
      window.removeEventListener(
        "rapago:resident-verification-updated",
        refreshSessionUser,
      );
    };
  }, [session?.accessToken, status]);

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
      clientStoragePolicy.prepareClientStorageForAuthentication();
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
      clientStoragePolicy.prepareClientStorageForAuthentication();
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

  const refreshSession = useCallback(async (): Promise<void> => {
    if (!session?.accessToken) return;

    const verified = await authService.me(session.accessToken);
    if (!verified.ok) return;

    await sessionStorageService.saveSession(verified.session);
    setSession(verified.session);
    setUser(verified.session.user);
    setStatus("authenticated");
  }, [session?.accessToken]);

  const logout = useCallback(async (): Promise<void> => {
    if (session?.accessToken) {
      await authService.logout(session.accessToken).catch(() => {});
    }

    await clearLocalSession();
    history.replace(ROUTES.AUTH.LOGIN);
  }, [session, clearLocalSession, history]);

  return (
    <AuthContext.Provider
      value={{ status, user, session, login, register, logout, refreshSession }}
    >
      {children}
    </AuthContext.Provider>
  );
}
