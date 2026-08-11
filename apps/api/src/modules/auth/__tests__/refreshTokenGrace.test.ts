import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Ventana de gracia y detección de reutilización en la rotación de refresh
 * tokens.
 *
 * La rotación es de un solo uso: el servidor revoca el token en el mismo UPDATE
 * con el que lo lee. Eso está bien contra el robo, pero convertía en definitiva
 * cualquier respuesta perdida — y perder la respuesta es exactamente lo que
 * pasa al pasar la app a segundo plano (la WebView se congela, la radio se
 * corta). El cliente se quedaba con un token ya revocado y sin forma de
 * renovar: había que iniciar sesión a mano.
 *
 * Ahora se distingue por el tiempo transcurrido desde la revocación:
 *  - dentro de la ventana → reintento legítimo, se emite un par nuevo.
 *  - fuera de la ventana → reutilización sospechosa, se cierra todo.
 */

const mockConsumeRefreshToken = vi.fn();
const mockRevokeAllForUser = vi.fn();
const mockCreateSession = vi.fn();
const mockCreateRefreshToken = vi.fn();
const mockFindUserById = vi.fn();
const mockRecordSafe = vi.fn();
const mockIssueAccessToken = vi.fn();
const mockIssueRefreshToken = vi.fn();

vi.mock("../session.service.js", () => ({
  SessionService: vi.fn().mockImplementation(() => ({
    consumeRefreshToken: mockConsumeRefreshToken,
    revokeAllForUser: mockRevokeAllForUser,
    createSession: mockCreateSession,
    createRefreshToken: mockCreateRefreshToken,
    revokeSessionByTokenHash: vi.fn(),
    isSessionValid: vi.fn(),
  })),
}));

vi.mock("../token.service.js", () => ({
  TokenService: vi.fn().mockImplementation(() => ({
    hashToken: vi.fn().mockReturnValue("hash-del-token"),
    issueAccessToken: mockIssueAccessToken,
    issueRefreshToken: mockIssueRefreshToken,
    verifyAccessToken: vi.fn(),
  })),
}));

vi.mock("../../../modules/users/users.repository.js", () => ({
  UsersRepository: vi.fn().mockImplementation(() => ({
    findById: mockFindUserById,
    findByEmail: vi.fn(),
  })),
}));

vi.mock("../../../modules/audit/audit.service.js", () => ({
  AuditService: vi.fn().mockImplementation(() => ({
    recordSafe: mockRecordSafe,
  })),
}));

/**
 * `buildAuthUser` consulta credenciales, proveedores externos y el perfil de
 * pasajero. Nada de eso interviene en la rotación, pero sin mock las pruebas
 * intentan abrir una conexión real a la base de datos.
 */
vi.mock("../authCredentials.repository.js", () => ({
  AuthCredentialsRepository: vi.fn().mockImplementation(() => ({
    findByUserId: vi.fn().mockResolvedValue({ userId: "user-1" }),
    createForUser: vi.fn(),
    incrementFailedAttempts: vi.fn(),
    resetFailedAttempts: vi.fn(),
    lockUntil: vi.fn(),
    updatePassword: vi.fn(),
  })),
}));

vi.mock("../authIdentities.repository.js", () => ({
  AuthIdentitiesRepository: vi.fn().mockImplementation(() => ({
    listActiveProviders: vi.fn().mockResolvedValue([]),
    findBySubject: vi.fn(),
    findByUserAndProvider: vi.fn(),
    linkIdentity: vi.fn(),
    touchLogin: vi.fn(),
  })),
}));

vi.mock("../oauthIdentities.repository.js", () => ({
  OAuthIdentitiesRepository: vi.fn().mockImplementation(() => ({
    listProviders: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock("../../../db/client.js", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve([]) }),
      }),
    }),
  },
}));

const { AuthService } = await import("../auth.service.js");

/** 96 caracteres hex: el formato que valida `refreshSession`. */
const VALID_RAW_TOKEN = "a".repeat(96);

describe("rotación de refresh token", () => {
  let service: InstanceType<typeof AuthService>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService();

    mockFindUserById.mockResolvedValue({
      id: "user-1",
      email: "tere@rapanui.cl",
      name: "Tere Haoa",
      role: "passenger",
      status: "active",
      avatarUrl: null,
      isVerified: true,
    });

    mockIssueAccessToken.mockReturnValue({
      token: "nuevo-access",
      hash: "hash-access",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    mockIssueRefreshToken.mockReturnValue({
      token: "nuevo-refresh",
      hash: "hash-refresh",
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    mockCreateSession.mockResolvedValue(undefined);
    mockCreateRefreshToken.mockResolvedValue(undefined);
    mockRevokeAllForUser.mockResolvedValue(undefined);
  });

  it("rota normalmente cuando el token está sin usar", async () => {
    mockConsumeRefreshToken.mockResolvedValue({
      outcome: "consumed",
      id: "token-1",
      userId: "user-1",
    });

    const result = await service.refreshSession(VALID_RAW_TOKEN);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.refreshToken).toBe("nuevo-refresh");
    expect(mockRevokeAllForUser).not.toHaveBeenCalled();
  });

  it("RENUEVA dentro de la ventana de gracia (respuesta perdida en segundo plano)", async () => {
    mockConsumeRefreshToken.mockResolvedValue({
      outcome: "grace",
      id: "token-1",
      userId: "user-1",
    });

    const result = await service.refreshSession(VALID_RAW_TOKEN);

    // Este es el caso que antes dejaba al usuario fuera para siempre.
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.refreshToken).toBe("nuevo-refresh");
    expect(mockRevokeAllForUser).not.toHaveBeenCalled();
  });

  it("deja rastro de que la renovación vino de la ventana de gracia", async () => {
    mockConsumeRefreshToken.mockResolvedValue({
      outcome: "grace",
      id: "token-1",
      userId: "user-1",
    });

    await service.refreshSession(VALID_RAW_TOKEN);

    expect(mockRecordSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "auth.session.refresh.success",
        metadata: expect.objectContaining({ viaReuseGrace: true }),
      }),
    );
  });

  it("cierra TODA la sesión ante una reutilización fuera de la ventana", async () => {
    mockConsumeRefreshToken.mockResolvedValue({
      outcome: "reuse",
      id: "token-1",
      userId: "user-1",
    });

    const result = await service.refreshSession(VALID_RAW_TOKEN);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("AUTH_SESSION_REVOKED");
    expect(result.statusCode).toBe(401);
    // Señal clásica de token robado: no basta con rechazar esta petición.
    expect(mockRevokeAllForUser).toHaveBeenCalledWith("user-1");
    expect(mockRecordSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "auth.session.refresh.reuse_detected",
      }),
    );
  });

  it("rechaza un token desconocido o caducado sin cerrar otras sesiones", async () => {
    mockConsumeRefreshToken.mockResolvedValue({ outcome: "unknown" });

    const result = await service.refreshSession(VALID_RAW_TOKEN);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("AUTH_REFRESH_TOKEN_INVALID");
    expect(mockRevokeAllForUser).not.toHaveBeenCalled();
  });

  it("rechaza un token con formato inválido sin tocar la base de datos", async () => {
    const result = await service.refreshSession("no-es-hex");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("AUTH_REFRESH_TOKEN_INVALID");
    expect(mockConsumeRefreshToken).not.toHaveBeenCalled();
  });
});
