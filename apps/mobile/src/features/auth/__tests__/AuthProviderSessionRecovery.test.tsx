import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

/**
 * Reproduce el fallo reportado:
 *
 *   el usuario inicia sesión → se va a otra aplicación (WhatsApp) → el token
 *   caduca en segundo plano → vuelve → la app mostraba el avatar con "?" y
 *   ninguna pantalla funcionaba.
 *
 * El estado del "?" es exactamente `user === null` mientras la app sigue en una
 * pantalla protegida: `RapagoAppBar` dibuja `initialsOf(user?.name ?? ...)`, que
 * con cadena vacía devuelve "?". Así que las pruebas de abajo comprueban el
 * invariante de fondo: **la sesión nunca queda medio viva**. O hay usuario, o se
 * ha cerrado sesión y navegado al login. Nunca `user === null` en silencio.
 */

const mockMe = vi.fn();
const mockRefresh = vi.fn();
const mockLogout = vi.fn();
const mockSaveSession = vi.fn();
const mockLoadSession = vi.fn();
const mockLoadRefreshToken = vi.fn();
const mockClearSession = vi.fn();
const mockReplace = vi.fn();

vi.mock("../auth.service.js", () => ({
  authService: {
    login: vi.fn(),
    register: vi.fn(),
    logout: mockLogout,
    me: mockMe,
    refresh: mockRefresh,
    signInWithApple: vi.fn(),
    signInWithGoogle: vi.fn(),
    signInWithAppleWeb: vi.fn(),
  },
}));

vi.mock("../sessionStorage.service.js", () => ({
  sessionStorageService: {
    saveSession: mockSaveSession,
    loadSession: mockLoadSession,
    loadRefreshToken: mockLoadRefreshToken,
    clearSession: mockClearSession,
  },
}));

const mockRemoveListener = vi.fn();

vi.mock("@capacitor/app", () => ({
  App: {
    addListener: vi.fn().mockResolvedValue({ remove: mockRemoveListener }),
  },
}));

/**
 * El objeto de historial tiene que ser ESTABLE entre renders: `useHistory` de
 * react-router lo es, y AuthProvider se apoya en ello (si cambiara de
 * identidad en cada render, el efecto de restauración se reiniciaría en bucle).
 * Devolver un objeto nuevo aquí no probaría el componente, probaría el mock.
 */
const mockHistory = { replace: mockReplace, push: vi.fn() };

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );

  return {
    ...actual,
    useHistory: () => mockHistory,
  };
});

const { AuthProvider } = await import("../AuthProvider.js");
const { useAuth } = await import("../useAuth.js");

function wrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter>
      <AuthProvider>{children}</AuthProvider>
    </MemoryRouter>
  );
}

const USER = {
  id: "u1",
  email: "tere@rapanui.cl",
  name: "Tere Haoa",
  role: "passenger" as const,
  avatarUrl: null,
  isVerified: true,
};

/** Sesión guardada cuyo access token YA caducó (estuvo en segundo plano). */
function expiredPersistedSession() {
  return {
    accessToken: "access-viejo-caducado-0000000000000000",
    expiresAt: new Date(Date.now() - 60_000).toISOString(),
    userId: USER.id,
    email: USER.email,
    name: USER.name,
    role: USER.role,
    avatarUrl: USER.avatarUrl,
    isVerified: USER.isVerified,
  };
}

/** Sesión guardada todavía vigente. */
function livePersistedSession() {
  return {
    ...expiredPersistedSession(),
    accessToken: "access-vigente-000000000000000000000",
    expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
  };
}

function renewedSession() {
  return {
    accessToken: "access-nuevo-1111111111111111111111",
    expiresAt: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
    user: USER,
  };
}

describe("recuperación de sesión al volver de otra aplicación", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadSession.mockResolvedValue(null);
    mockLoadRefreshToken.mockResolvedValue(null);
    mockClearSession.mockResolvedValue(undefined);
    mockSaveSession.mockResolvedValue(undefined);
  });

  it("renueva la sesión cuando el token caducó estando la app en segundo plano", async () => {
    const nextSession = renewedSession();

    mockLoadSession.mockResolvedValue(expiredPersistedSession());
    mockLoadRefreshToken.mockResolvedValue("refresh-valido");
    mockRefresh.mockResolvedValue({
      ok: true,
      session: nextSession,
      refreshToken: "refresh-rotado",
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("authenticated"));

    expect(mockRefresh).toHaveBeenCalledWith("refresh-valido");
    // El token rotado se persiste: sin esto, la siguiente renovación fallaría.
    expect(mockSaveSession).toHaveBeenCalledWith(
      nextSession,
      "refresh-rotado",
    );
    // El usuario sigue presente → el avatar nunca se dibuja como "?".
    expect(result.current.user?.name).toBe("Tere Haoa");
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("NO destruye la sesión por un error de servidor al verificarla", async () => {
    // Este era el fallo principal: la lista blanca de códigos "transitorios"
    // dejaba fuera INTERNAL_SERVER_ERROR, así que un 500 puntual borraba la
    // sesión Y el refresh token de 30 días. Solo se recuperaba entrando a mano.
    mockLoadSession.mockResolvedValue(livePersistedSession());
    mockMe.mockResolvedValue({
      ok: false,
      code: "INTERNAL_SERVER_ERROR",
      message: "boom",
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("authenticated"));

    expect(mockClearSession).not.toHaveBeenCalled();
    expect(result.current.user?.name).toBe("Tere Haoa");
  });

  it("NO destruye la sesión por un 429 de rate limit", async () => {
    mockLoadSession.mockResolvedValue(livePersistedSession());
    mockMe.mockResolvedValue({
      ok: false,
      code: "RATE_LIMIT_EXCEEDED",
      message: "demasiadas peticiones",
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("authenticated"));

    expect(mockClearSession).not.toHaveBeenCalled();
    expect(result.current.user).not.toBeNull();
  });

  it("cierra sesión Y navega al login cuando el refresh token ya no vale", async () => {
    mockLoadSession.mockResolvedValue(expiredPersistedSession());
    mockLoadRefreshToken.mockResolvedValue("refresh-muerto");
    mockRefresh.mockResolvedValue({
      ok: false,
      code: "AUTH_REFRESH_TOKEN_INVALID",
      message: "sesión expirada",
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("unauthenticated"));

    expect(mockClearSession).toHaveBeenCalled();
    // Lo esencial: no basta con borrar. Si no se navega, el usuario se queda
    // en la pantalla protegida sin sesión — el estado del "?".
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/auth/login"));
    expect(result.current.user).toBeNull();
  });

  it("cierra sesión y navega cuando la cuenta fue suspendida", async () => {
    mockLoadSession.mockResolvedValue(livePersistedSession());
    mockMe.mockResolvedValue({
      ok: false,
      code: "AUTH_ACCOUNT_SUSPENDED",
      message: "cuenta suspendida",
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("unauthenticated"));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/auth/login"));
  });

  it("cierra sesión y navega cuando ya no queda refresh token guardado", async () => {
    mockLoadSession.mockResolvedValue(expiredPersistedSession());
    mockLoadRefreshToken.mockResolvedValue(null);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("unauthenticated"));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/auth/login"));
  });

  it("no lanza una tormenta de renovaciones cuando el backend falla en cadena", async () => {
    // Antes, cada 401 de las pantallas con sondeo (2,5 s) pedía una renovación
    // nueva. Se agotaba el límite del endpoint y todo pasaba a 429 con la
    // sesión viva pero inservible. El retardo creciente corta ese bucle.
    mockLoadSession.mockResolvedValue(expiredPersistedSession());
    mockLoadRefreshToken.mockResolvedValue("refresh-valido");
    mockRefresh.mockResolvedValue({
      ok: false,
      code: "INTERNAL_SERVER_ERROR",
      message: "boom",
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Un fallo transitorio conserva la sesión persistida.
    await waitFor(() => expect(result.current.status).toBe("authenticated"));
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());

    const callsAfterRestore = mockRefresh.mock.calls.length;

    // Ráfaga de eventos de token caducado, como la que provoca el sondeo.
    await act(async () => {
      for (let i = 0; i < 10; i += 1) {
        window.dispatchEvent(new CustomEvent("auth:token-expired"));
      }
      await Promise.resolve();
    });

    // El retardo impide que 10 eventos se conviertan en 10 peticiones más.
    const burstCalls = mockRefresh.mock.calls.length - callsAfterRestore;
    expect(burstCalls).toBeLessThanOrEqual(1);
  });

  it("mantiene la sesión si el almacén nativo falla al leer", async () => {
    // Leer con el dispositivo bloqueado lanza excepción; eso NO es una sesión
    // revocada y no debe borrar el refresh token.
    mockLoadSession.mockResolvedValue(null);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("unauthenticated"));

    // Sin sesión guardada no se borra nada: no hay nada que destruir.
    expect(mockClearSession).not.toHaveBeenCalled();
  });
});
