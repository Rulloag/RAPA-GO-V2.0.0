import {
  createContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { useHistory } from "react-router-dom";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { App } from "@capacitor/app";
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

/**
 * Tope de `setTimeout`: por encima de 2^31-1 ms el navegador desborda el valor
 * y ejecuta el callback de inmediato.
 */
const MAX_TIMEOUT_DELAY_MS = 2_147_483_647;

/** Retardo inicial y tope entre reintentos de renovación tras un fallo. */
const REFRESH_BACKOFF_BASE_MS = 5_000;
const REFRESH_BACKOFF_MAX_MS = 5 * 60_000;

/**
 * Códigos que SÍ significan "esta sesión ya no existe".
 *
 * Es deliberadamente una lista de denegación, no de permisos. Antes el flujo
 * inverso (una lista blanca de códigos "transitorios" y borrar la sesión ante
 * cualquier otro) borraba la sesión —y con ella el refresh token de 30 días—
 * por un 500 puntual, un 429 de rate limit o cualquier código nuevo que el
 * backend añadiera. Un fallo pasajero del servidor dejaba al usuario obligado
 * a iniciar sesión a mano.
 *
 * Con la lista de denegación, lo desconocido se trata como transitorio: la
 * sesión se conserva y el siguiente intento decide. Solo estos códigos, que
 * son afirmaciones explícitas del backend, cierran la sesión.
 */
const TERMINAL_REFRESH_CODES = new Set([
  "AUTH_REFRESH_TOKEN_INVALID",
  "AUTH_SESSION_REVOKED",
  "AUTH_ACCOUNT_DELETED",
  "AUTH_ACCOUNT_SUSPENDED",
  "UNAUTHORIZED",
]);

function isTerminalAuthCode(code: string): boolean {
  return TERMINAL_REFRESH_CODES.has(code);
}

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
  /** Fallos transitorios seguidos, para el retardo creciente entre intentos. */
  const refreshFailureStreakRef = useRef(0);
  /** Marca de tiempo hasta la que no se vuelve a intentar renovar. */
  const refreshBackoffUntilRef = useRef(0);

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

  /**
   * Punto ÚNICO de cierre de sesión por pérdida de credenciales.
   *
   * Antes, borrar la sesión y navegar a login eran dos pasos sueltos, y había
   * cuatro caminos en `restore()` que hacían lo primero y no lo segundo. Como
   * el router no tiene ningún guard (RouteGuard es un passthrough), el usuario
   * se quedaba en la pantalla protegida con `user === null`: de ahí el avatar
   * con "?" y que ninguna acción funcionara.
   *
   * Aquí van siempre juntos. `history.replace` en vez de `push` para que el
   * botón atrás no devuelva a una pantalla sin sesión.
   */
  const forceSignOut = useCallback(async (): Promise<void> => {
    await clearLocalSession();
    history.replace(ROUTES.AUTH.LOGIN);
  }, [clearLocalSession, history]);

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

      /**
       * Freno de reintentos.
       *
       * `refreshInFlightRef` solo une las llamadas SIMULTÁNEAS. Las pantallas
       * con sondeo (los viajes del pasajero refrescan cada 2,5 s) generan un
       * 401 por ciclo, y cada 401 pedía una renovación nueva — secuencial, no
       * simultánea, así que el deduplicador no la frenaba. Eso agotaba el
       * límite del endpoint en poco más de un minuto y, a partir de ahí, todo
       * devolvía 429 sin que la sesión llegara a cerrarse: la app se quedaba
       * "conectada" pero sin poder hacer nada.
       *
       * Tras un fallo transitorio se espera un tiempo creciente antes de
       * volver a intentarlo. Un fallo terminal no llega aquí: cierra sesión.
       */
      const now = Date.now();
      if (now < refreshBackoffUntilRef.current) {
        return {
          kind: "transient",
          code: "AUTH_REFRESH_BACKOFF",
        };
      }

      const operation = (async (): Promise<SessionRefreshOutcome> => {
        const refreshToken =
          await sessionStorageService.loadRefreshToken();

        if (!refreshToken) {
          return { kind: "missing" };
        }

        const response = await authService.refresh(refreshToken);

        if (response.ok) {
          refreshFailureStreakRef.current = 0;
          refreshBackoffUntilRef.current = 0;

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

        refreshFailureStreakRef.current += 1;
        refreshBackoffUntilRef.current =
          Date.now() +
          Math.min(
            REFRESH_BACKOFF_MAX_MS,
            REFRESH_BACKOFF_BASE_MS *
              2 ** (refreshFailureStreakRef.current - 1),
          );

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

      /**
       * Un fallo de renovación solo cierra la sesión si el backend lo afirma
       * (terminal) o si ya no queda refresh token con el que reintentar
       * (missing). Cualquier otra cosa —500, 429, timeout, código nuevo— deja
       * la sesión persistida en pie para que el siguiente intento la recupere.
       */
      const settleRefreshFailure = async (
        outcome: SessionRefreshOutcome,
      ): Promise<void> => {
        if (cancelled) return;

        if (outcome.kind === "terminal" || outcome.kind === "missing") {
          await forceSignOut();
          return;
        }

        keepPersistedSessionDuringTransientFailure();
      };

      if (
        expiresWithin(
          persisted.expiresAt,
          ACCESS_TOKEN_REFRESH_SKEW_MS,
        )
      ) {
        const refreshOutcome = await renewSession();
        if (cancelled || refreshOutcome.kind === "success") return;

        await settleRefreshFailure(refreshOutcome);
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

        await settleRefreshFailure(refreshOutcome);
        return;
      }

      /**
       * Aquí estaba el fallo principal: el código llegaba con una lista blanca
       * de errores "transitorios" y borraba la sesión ante CUALQUIER otro. Un
       * 500 del servidor o un 429 de rate limit bastaban para destruir el
       * refresh token de 30 días y dejar al usuario sin forma de volver.
       *
       * Ahora solo cierran la sesión los códigos que el backend usa para decir
       * explícitamente "esta sesión ya no vale". Lo desconocido se conserva.
       */
      if (isTerminalAuthCode(verifiedCode)) {
        await forceSignOut();
        return;
      }

      keepPersistedSessionDuringTransientFailure();
    }

    /**
     * Si la restauración se rompe de forma inesperada no basta con marcar
     * "unauthenticated": sin navegar, el usuario se queda en la pantalla
     * protegida sin sesión, que es justo el estado con el avatar "?".
     */
    void restore().catch(() => {
      if (!cancelled) {
        void forceSignOut();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    applyAuthenticatedSession,
    forceSignOut,
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

    /**
     * El cierre de sesión NO se condiciona a `cancelled`.
     *
     * Antes sí: `if (!cancelled) history.replace(...)`. El problema es que
     * `renewSession()` llama internamente a `clearLocalSession()`, que cambia
     * `status` y `session` — las dependencias de este efecto. React limpia el
     * efecto anterior y ese cleanup pone `cancelled = true`, así que la
     * redirección que venía justo después podía quedarse en nada. Resultado:
     * sesión borrada, usuario en la pantalla protegida, avatar "?".
     *
     * `forceSignOut` es idempotente (limpia y navega), así que ejecutarlo de
     * más es inofensivo; no ejecutarlo es exactamente el bug.
     */
    const recoverAccessToken = async (): Promise<void> => {
      const outcome = await renewSession();

      if (
        outcome.kind === "terminal" ||
        outcome.kind === "missing"
      ) {
        await forceSignOut();
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

        /**
         * Igual que en `restore()`: solo los códigos terminales cierran la
         * sesión. Un 500 o un 429 aquí no deben tocarla.
         */
        if (isTerminalAuthCode(verifiedCode)) {
          await forceSignOut();
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

    /**
     * El temporizador sigue existiendo para la app en primer plano, pero ya no
     * es el mecanismo principal: en un móvil, `setTimeout` se congela mientras
     * la app está en segundo plano, así que un temporizador a horas vista no
     * dispara al volver. Quien cubre ese caso es `appStateChange` de abajo.
     *
     * `Math.min` contra el máximo de un entero de 32 bits: por encima de eso
     * `setTimeout` desborda y dispara de inmediato, convirtiendo una espera
     * larga en un bucle de renovaciones.
     */
    const proactiveRefreshTimer = window.setTimeout(
      () => void recoverAccessToken(),
      Math.min(proactiveRefreshDelay, MAX_TIMEOUT_DELAY_MS),
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

    /**
     * Reanudación nativa.
     *
     * `focus` y `visibilitychange` son la opinión de la WebView, no la del
     * sistema operativo: en Android en particular no se puede contar con que
     * lleguen al restaurar la Activity desde segundo plano. Sin esto, volver
     * de WhatsApp podía no revalidar nada y la app se quedaba con un token
     * muerto creyendo que seguía autenticada.
     *
     * `App.addListener` devuelve una promesa; se guarda para poder quitar el
     * listener aunque el efecto se limpie antes de que resuelva.
     */
    let appStateListener: PluginListenerHandle | null = null;
    let listenerDetached = false;

    try {
      void Promise.resolve(
        App.addListener("appStateChange", ({ isActive }) => {
          if (isActive) void refreshSessionUser();
        }),
      )
        .then((handle) => {
          if (listenerDetached) {
            void handle.remove();
            return;
          }
          appStateListener = handle;
        })
        .catch(() => {
          // En web el plugin no está disponible: `focus`/`visibilitychange` ya
          // cubren ese caso.
        });
    } catch {
      // Algunas versiones del puente lanzan de forma síncrona si el plugin no
      // está registrado. No debe impedir el registro del resto de listeners.
    }

    return () => {
      cancelled = true;
      listenerDetached = true;
      void appStateListener?.remove();
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
    forceSignOut,
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
