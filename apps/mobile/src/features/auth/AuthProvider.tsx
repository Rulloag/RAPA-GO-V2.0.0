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
  AppleSignInRequest,
  AppleWebAuthResponse,
  AppleWebCompleteRequest,
  AuthResponse,
} from "./auth.types.js";

export const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

const SESSION_RESTORE_TIMEOUT_MS = 12000;

async function verifySessionWithTimeout(accessToken: string): Promise<AuthResponse> {
  return Promise.race([
    authService.me(accessToken),
    new Promise<AuthResponse>((resolve) => {
      window.setTimeout(() => {
        resolve({
          ok: false,
          code: "AUTH_RESTORE_TIMEOUT",
          message: "No se pudo restaurar la sesión a tiempo.",
        });
      }, SESSION_RESTORE_TIMEOUT_MS);
    }),
  ]);
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

      const verified = await verifySessionWithTimeout(persisted.accessToken);
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
        await sessionStorageService.saveSession(response.session, response.refreshToken);
        setSession(response.session);
        setUser(response.session.user);
        setStatus("authenticated");

        /**
         * Protocolo de sesión: notifica el login exitoso para que la UI
         * muestre el mensaje correspondiente (AuthFeedbackToast).
         */
        window.dispatchEvent(new CustomEvent("auth:login-result"));
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
        await sessionStorageService.saveSession(response.session, response.refreshToken);
        setSession(response.session);
        setUser(response.session.user);
        setStatus("authenticated");

        /**
         * Protocolo de sesión: notifica el registro exitoso para que la UI
         * muestre el mensaje correspondiente (AuthFeedbackToast).
         */
        window.dispatchEvent(new CustomEvent("auth:register-result"));
      } else {
        setStatus("unauthenticated");
      }

      return response;
    },
    [],
  );

  const signInWithApple = useCallback(
    async (payload: AppleSignInRequest): Promise<AuthResponse> => {
      setStatus("loading");
      clientStoragePolicy.prepareClientStorageForAuthentication();
      const response = await authService.signInWithApple(payload);

      if (response.ok) {
        await sessionStorageService.saveSession(response.session, response.refreshToken);
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

  const signInWithAppleWeb = useCallback(
    async (
      payload: AppleWebCompleteRequest,
    ): Promise<AppleWebAuthResponse> => {
      setStatus("loading");
      clientStoragePolicy.prepareClientStorageForAuthentication();
      const response = await authService.signInWithAppleWeb(payload);

      if (response.ok) {
        await sessionStorageService.saveSession(
          response.session,
          response.refreshToken,
        );
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
     * muestre el mensaje correspondiente (AuthFeedbackToast).
     */
    window.dispatchEvent(
      new CustomEvent("auth:logout-result", { detail: { ok } }),
    );

    history.replace(ROUTES.AUTH.LOGIN);
  }, [session, clearLocalSession, history]);

  return (
    <AuthContext.Provider
      value={{
        status,
        user,
        session,
        login,
        register,
        signInWithApple,
        signInWithAppleWeb,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
