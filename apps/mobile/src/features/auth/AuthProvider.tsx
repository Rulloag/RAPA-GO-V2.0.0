import {
  createContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { useHistory } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { authService } from "./auth.service.js";
import {
  sessionStorageService,
  type PersistedSession,
} from "./sessionStorage.service.js";
import { GoogleNativeAuth } from "./googleNative.js";
import { disableGoogleAutoSelect } from "./googleIdentityServices.js";
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
  GoogleAuthResponse,
  GoogleSignInRequest,
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


const ACCESS_TOKEN_REFRESH_SKEW_MS = 60_000;
const ACCESS_TOKEN_FOCUS_REFRESH_WINDOW_MS = 2 * 60_000;

const TRANSIENT_AUTH_CODES = new Set([
  "NETWORK_ERROR",
  "TIMEOUT",
  "INVALID_RESPONSE",
  "AUTH_RESTORE_TIMEOUT",
]);

const TERMINAL_REFRESH_CODES = new Set([
  "AUTH_REFRESH_TOKEN_INVALID",
  "AUTH_SESSION_REVOKED",
  "AUTH_ACCOUNT_DELETED",
  "AUTH_ACCOUNT_SUSPENDED",
  "UNAUTHORIZED",
]);

type SessionRefreshOutcome =
  | { kind: "success"; session: AuthSession }
  | { kind: "missing" }
  | { kind: "transient"; code: string }
  | { kind: "terminal"; code: string };

function getAuthFailureCode(response: AuthResponse): string | null {
  return "code" in response ? response.code : null;
}

function persistedToAuthSession(
  persisted: PersistedSession,
): AuthSession {
  return {
    accessToken: persisted.accessToken,
    expiresAt: persisted.expiresAt,
    user: {
      id: persisted.userId,
      email: persisted.email,
      name: persisted.name,
      role: persisted.role,
      avatarUrl: persisted.avatarUrl,
      isVerified: persisted.isVerified,
    },
  };
}

function expiresWithin(expiresAt: string, windowMs: number): boolean {
  const expiresAtMs = Date.parse(expiresAt);

  return (
    !Number.isFinite(expiresAtMs) ||
    expiresAtMs <= Date.now() + windowMs
  );
}

export function AuthProvider({ children }: AuthProviderProps): JSX.Element {
  const history = useHistory();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const sessionRef = useRef<AuthSession | null>(null);
  const refreshInFlightRef =
    useRef<Promise<SessionRefreshOutcome> | null>(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const clearLocalSession = useCallback(async (): Promise<void> => {
    await sessionStorageService.clearSession();
    clientStoragePolicy.clearSensitiveClientStorage();
    sessionRef.current = null;
    setSession(null);
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const applyAuthenticatedSession = useCallback(
    async (
      nextSession: AuthSession,
      refreshToken?: string,
    ): Promise<void> => {
      await sessionStorageService.saveSession(
        nextSession,
        refreshToken,
      );
      sessionRef.current = nextSession;
      setSession(nextSession);
      setUser(nextSession.user);
      setStatus("authenticated");
    },
    [],
  );

  const renewSession = useCallback(
    async (): Promise<SessionRefreshOutcome> => {
      const existing = refreshInFlightRef.current;
      if (existing) return existing;

      const operation = (async (): Promise<SessionRefreshOutcome> => {
        const refreshToken =
          await sessionStorageService.loadRefreshToken();

        if (!refreshToken) {
          return { kind: "missing" };
        }

        const response = await authService.refresh(refreshToken);

        if (response.ok) {
          await applyAuthenticatedSession(
            response.session,
            response.refreshToken,
          );

          return {
            kind: "success",
            session: response.session,
          };
        }

        const responseCode =
          getAuthFailureCode(response) ?? "INVALID_RESPONSE";

        if (TERMINAL_REFRESH_CODES.has(responseCode)) {
          await clearLocalSession();

          return {
            kind: "terminal",
            code: responseCode,
          };
        }

        return {
          kind: "transient",
          code: responseCode,
        };
      })();

      refreshInFlightRef.current = operation;

      try {
        return await operation;
      } finally {
        if (refreshInFlightRef.current === operation) {
          refreshInFlightRef.current = null;
        }
      }
    },
    [applyAuthenticatedSession, clearLocalSession],
  );

  useEffect(() => {
    let cancelled = false;

    async function restore(): Promise<void> {
      const persisted = await sessionStorageService.loadSession();
      if (cancelled) return;

      if (!persisted) {
        setStatus("unauthenticated");
        return;
      }

      const persistedSession = persistedToAuthSession(persisted);

      const keepPersistedSessionDuringTransientFailure = (): void => {
        if (cancelled) return;

        sessionRef.current = persistedSession;
        setSession(persistedSession);
        setUser(persistedSession.user);
        setStatus("authenticated");
      };

      if (
        expiresWithin(
          persisted.expiresAt,
          ACCESS_TOKEN_REFRESH_SKEW_MS,
        )
      ) {
        const refreshOutcome = await renewSession();
        if (cancelled || refreshOutcome.kind === "success") return;

        if (
          refreshOutcome.kind === "terminal" ||
          refreshOutcome.kind === "missing"
        ) {
          await clearLocalSession();
          return;
        }

        keepPersistedSessionDuringTransientFailure();
        return;
      }

      const verified = await verifySessionWithTimeout(
        persisted.accessToken,
      );
      if (cancelled) return;

      if (verified.ok) {
        await applyAuthenticatedSession(verified.session);
        return;
      }

      const verifiedCode =
        getAuthFailureCode(verified) ?? "INVALID_RESPONSE";

      if (verifiedCode === "AUTH_TOKEN_EXPIRED") {
        const refreshOutcome = await renewSession();
        if (cancelled || refreshOutcome.kind === "success") return;

        if (
          refreshOutcome.kind === "terminal" ||
          refreshOutcome.kind === "missing"
        ) {
          await clearLocalSession();
          return;
        }

        keepPersistedSessionDuringTransientFailure();
        return;
      }

      if (TRANSIENT_AUTH_CODES.has(verifiedCode)) {
        keepPersistedSessionDuringTransientFailure();
        return;
      }

      await clearLocalSession();
    }

    void restore().catch(() => {
      if (!cancelled) {
        setStatus("unauthenticated");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    applyAuthenticatedSession,
    clearLocalSession,
    renewSession,
  ]);

  useEffect(() => {
    if (
      status !== "authenticated" ||
      !session?.accessToken ||
      !session.expiresAt
    ) {
      return;
    }

    let cancelled = false;
    let checking = false;

    const redirectToLogin = (): void => {
      if (!cancelled) {
        history.replace(ROUTES.AUTH.LOGIN);
      }
    };

    const recoverAccessToken = async (): Promise<void> => {
      const outcome = await renewSession();

      if (
        outcome.kind === "terminal" ||
        outcome.kind === "missing"
      ) {
        redirectToLogin();
      }
    };

    const refreshSessionUser = async (): Promise<void> => {
      if (checking || cancelled) return;
      checking = true;

      try {
        const currentSession = sessionRef.current;
        if (!currentSession?.accessToken) return;

        if (
          expiresWithin(
            currentSession.expiresAt,
            ACCESS_TOKEN_FOCUS_REFRESH_WINDOW_MS,
          )
        ) {
          await recoverAccessToken();
          return;
        }

        const verified = await authService.me(
          currentSession.accessToken,
        );
        if (cancelled) return;

        if (verified.ok) {
          await applyAuthenticatedSession(verified.session);
          return;
        }

        const verifiedCode =
          getAuthFailureCode(verified) ?? "INVALID_RESPONSE";

        if (verifiedCode === "AUTH_TOKEN_EXPIRED") {
          await recoverAccessToken();
          return;
        }

        if (TERMINAL_REFRESH_CODES.has(verifiedCode)) {
          await clearLocalSession();
          redirectToLogin();
        }
      } finally {
        checking = false;
      }
    };

    const handleVisibilityChange = (): void => {
      if (document.visibilityState === "visible") {
        void refreshSessionUser();
      }
    };

    const handleTokenExpired = (): void => {
      void recoverAccessToken();
    };

    const expiresAtMs = Date.parse(session.expiresAt);
    const proactiveRefreshDelay = Number.isFinite(expiresAtMs)
      ? Math.max(
          1_000,
          expiresAtMs -
            Date.now() -
            ACCESS_TOKEN_REFRESH_SKEW_MS,
        )
      : 1_000;

    const proactiveRefreshTimer = window.setTimeout(
      () => void recoverAccessToken(),
      proactiveRefreshDelay,
    );

    window.addEventListener("focus", refreshSessionUser);
    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );
    window.addEventListener(
      "rapago:resident-verification-updated",
      refreshSessionUser,
    );
    window.addEventListener(
      "auth:token-expired",
      handleTokenExpired,
    );

    return () => {
      cancelled = true;
      window.clearTimeout(proactiveRefreshTimer);
      window.removeEventListener("focus", refreshSessionUser);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
      window.removeEventListener(
        "rapago:resident-verification-updated",
        refreshSessionUser,
      );
      window.removeEventListener(
        "auth:token-expired",
        handleTokenExpired,
      );
    };
  }, [
    applyAuthenticatedSession,
    clearLocalSession,
    history,
    renewSession,
    session?.accessToken,
    session?.expiresAt,
    status,
  ]);

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
        sessionRef.current = response.session;
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
        sessionRef.current = response.session;
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


  const signInWithGoogle = useCallback(
    async (payload: GoogleSignInRequest): Promise<GoogleAuthResponse> => {
      setStatus("loading");
      clientStoragePolicy.prepareClientStorageForAuthentication();
      const response = await authService.signInWithGoogle(payload);

      if (response.ok) {
        await sessionStorageService.saveSession(
          response.session,
          response.refreshToken,
        );
        sessionRef.current = response.session;
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

  const signInWithApple = useCallback(
    async (payload: AppleSignInRequest): Promise<AuthResponse> => {
      setStatus("loading");
      clientStoragePolicy.prepareClientStorageForAuthentication();
      const response = await authService.signInWithApple(payload);

      if (response.ok) {
        await sessionStorageService.saveSession(response.session, response.refreshToken);
        sessionRef.current = response.session;
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
        sessionRef.current = response.session;
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
    const currentSession = sessionRef.current;
    if (!currentSession?.accessToken) return;

    if (
      expiresWithin(
        currentSession.expiresAt,
        ACCESS_TOKEN_FOCUS_REFRESH_WINDOW_MS,
      )
    ) {
      const outcome = await renewSession();

      if (
        outcome.kind === "terminal" ||
        outcome.kind === "missing"
      ) {
        history.replace(ROUTES.AUTH.LOGIN);
      }

      return;
    }

    const verified = await authService.me(
      currentSession.accessToken,
    );

    if (verified.ok) {
      await applyAuthenticatedSession(verified.session);
      return;
    }

    const verifiedCode =
      getAuthFailureCode(verified) ?? "INVALID_RESPONSE";

    if (verifiedCode === "AUTH_TOKEN_EXPIRED") {
      const outcome = await renewSession();

      if (
        outcome.kind === "terminal" ||
        outcome.kind === "missing"
      ) {
        history.replace(ROUTES.AUTH.LOGIN);
      }
    }
  }, [applyAuthenticatedSession, history, renewSession]);

  /**
   * Cierra una sesión sin el ritual de logout: sin el toast de "cerraste
   * sesión" ni la redirección a /auth/login. Existe para el registro público:
   * la cuenta se crea autenticada (así lo devuelve el backend), pero se pide
   * que la persona inicie sesión ella misma en vez de quedar logueada de
   * arranque, así que el llamador decide a dónde navegar después.
   *
   * Recibe el accessToken en vez de leerlo de `session`: se llama justo
   * después de `register()`, y `session` del closure capturado por el
   * componente que llama a esta función todavía sería el de antes de
   * registrarse — el `setSession` de `register()` no llega a tiempo por ser
   * un estado de React distinto (AuthProvider), no algo que se pueda leer de
   * vuelta en el mismo tick desde quien lo invoca.
   */
  const endSessionSilently = useCallback(
    async (accessToken?: string | null): Promise<void> => {
      const token = accessToken ?? session?.accessToken ?? null;

      if (token) {
        try {
          await authService.logout(token);
        } catch {
          // Best effort: si el backend no alcanza a revocar el token, igual
          // limpiamos el estado local para que la cuenta no quede logueada.
        }
      }

      await clearLocalSession();
    },
    [session, clearLocalSession],
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

    try {
      if (Capacitor.isNativePlatform()) {
        await GoogleNativeAuth.signOut();
      } else {
        disableGoogleAutoSelect();
      }
    } catch {
      // El cierre de la sesión propia ya se completó. Esta limpieza solo
      // evita que Google priorice la cuenta anterior en el próximo intento.
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
        signInWithGoogle,
        signInWithAppleWeb,
        logout,
        endSessionSilently,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
