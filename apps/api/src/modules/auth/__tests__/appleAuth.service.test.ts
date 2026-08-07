import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { AppleAuthService } from "../appleAuth.service.js";
import { AppError } from "../../../shared/errors/AppError.js";


vi.mock("../../../db/client.js", () => {
  const activeLegalDocuments = [
    {
      id: "legal-terms",
      type: "terms_and_conditions",
      version: "2.0",
      isActive: true,
    },
    {
      id: "legal-privacy",
      type: "privacy_policy",
      version: "2.0",
      isActive: true,
    },
    {
      id: "legal-users",
      type: "user_conditions",
      version: "2.0",
      isActive: true,
    },
  ];

  const makeSelectChain = () => {
    const chain: Record<string, unknown> = {};
    chain["from"] = vi.fn(() => chain);
    chain["where"] = vi.fn(() => chain);
    chain["then"] = (
      resolve: (value: unknown) => unknown,
      reject: (reason: unknown) => unknown,
    ) => Promise.resolve(activeLegalDocuments).then(resolve, reject);
    return chain;
  };

  const transaction = vi.fn(
    async (
      callback: (tx: {
        insert: () => {
          values: (value: unknown) => Promise<void>;
        };
      }) => Promise<unknown>,
    ) =>
      callback({
        insert: () => ({
          values: vi.fn(async (_value: unknown) => undefined),
        }),
      }),
  );

  return {
    db: {
      select: vi.fn(() => makeSelectChain()),
      transaction,
      delete: vi.fn(() => ({
        where: vi.fn(async () => undefined),
      })),
    },
  };
});


const VALID_SUB = "001234.abcdef1234567890.1234";

function baseClaims(overrides: Record<string, unknown> = {}) {
  return {
    sub: VALID_SUB,
    aud: "cl.rapago.app",
    email: "newuser@example.com",
    emailVerified: true,
    isPrivateEmail: false,
    ...overrides,
  };
}

function buildFakes(opts: {
  existingIdentity?: { id: string; userId: string } | null;
  userById?: Record<string, unknown> | null;
  userByEmail?: Record<string, unknown> | null;
  createUserWithIdentityResult?: { user: Record<string, unknown>; identity: { id: string } } | null;
  identityClaims?: Record<string, unknown>;
  exchangedClaims?: Record<string, unknown>;
  exchangeResult?: Record<string, unknown>;
}) {
  const mockFindByProviderAndSub = vi.fn().mockResolvedValue(opts.existingIdentity ?? null);
  const mockFindById             = vi.fn().mockResolvedValue(opts.userById ?? null);
  const mockFindByEmail          = vi.fn().mockResolvedValue(opts.userByEmail ?? null);
  const mockUpdateRefreshToken   = vi.fn().mockResolvedValue(undefined);
  const mockCreateUserWithIdentity = vi.fn().mockResolvedValue(opts.createUserWithIdentityResult ?? null);
  const mockRecordSafe           = vi.fn();

  const identityClaims  = baseClaims(opts.identityClaims);
  const exchangedClaims = baseClaims({ ...opts.identityClaims, ...opts.exchangedClaims });

  const mockVerify = vi.fn()
    .mockResolvedValueOnce(identityClaims)
    .mockResolvedValueOnce(exchangedClaims);

  const mockExchange = vi.fn().mockResolvedValue({
    accessToken:  "apple-access-token",
    refreshToken: "apple-refresh-token-raw",
    idToken:      "apple-exchanged-id-token",
    expiresIn:    3600,
    ...opts.exchangeResult,
  });

  const usersRepository = { findById: mockFindById, findByEmail: mockFindByEmail } as never;
  const identitiesRepository = {
    findByProviderAndSub:  mockFindByProviderAndSub,
    updateProviderCredentials: mockUpdateRefreshToken,
    createUserWithIdentity: mockCreateUserWithIdentity,
  } as never;
  const auditService = { recordSafe: mockRecordSafe } as never;
  const identityTokenVerifier = { verify: mockVerify } as never;
  const tokenExchangeClient = { exchange: mockExchange } as never;

  const mockIssueAccessToken  = vi.fn().mockReturnValue({ token: "rapago-access-token", hash: "access-hash", expiresAt: new Date(Date.now() + 3600_000) });
  const mockIssueRefreshToken = vi.fn().mockReturnValue({ token: "rapago-refresh-token", hash: "refresh-hash", expiresAt: new Date(Date.now() + 604_800_000) });
  const mockCreateSession        = vi.fn().mockResolvedValue(undefined);
  const mockCreateRefreshTokenDb = vi.fn().mockResolvedValue(undefined);
  const tokenService   = { issueAccessToken: mockIssueAccessToken, issueRefreshToken: mockIssueRefreshToken } as never;
  const sessionService = { createSession: mockCreateSession, createRefreshToken: mockCreateRefreshTokenDb } as never;

  const service = new AppleAuthService(
    usersRepository,
    identitiesRepository,
    auditService,
    identityTokenVerifier,
    tokenExchangeClient,
    tokenService,
    sessionService,
  );

  return {
    service,
    mockFindByProviderAndSub,
    mockFindById,
    mockFindByEmail,
    mockUpdateRefreshToken,
    mockCreateUserWithIdentity,
    mockRecordSafe,
    mockVerify,
    mockExchange,
  };
}

const PASSENGER_LEGAL_ACCEPTANCES = [
  { legalDocumentId: "legal-terms", version: "2.0" },
  { legalDocumentId: "legal-privacy", version: "2.0" },
  { legalDocumentId: "legal-users", version: "2.0" },
];

const basePayload = {
  identityToken: "fake-identity-token",
  authorizationCode: "fake-authorization-code",
  displayName: "Pasajero Apple",
  phone: "+56912345678",
  passengerFareType: "chilean" as const,
  // RUT obligatorio para la categoría "chilean" (ver preparePassengerSetup).
  rut: "12345678-5",
  legalAcceptances: PASSENGER_LEGAL_ACCEPTANCES,
};

describe("AppleAuthService.signIn", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env["OAUTH_TOKEN_ENCRYPTION_KEY"] = randomBytes(32).toString("hex");
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("creates a new user and identity when no matching oauth_identity exists (usuario nuevo)", async () => {
    const newUser = { id: "user-new", email: "newuser@example.com", name: "New User", role: "passenger", status: "active", avatarUrl: null, isVerified: true };
    const fakes = buildFakes({
      existingIdentity: null,
      userByEmail: null,
      createUserWithIdentityResult: { user: newUser, identity: { id: "identity-1" } },
    });

    const result = await fakes.service.signIn({ ...basePayload, role: "passenger", name: { givenName: "New", familyName: "User" } });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.session.user.id).toBe("user-new");
      expect(result.session.accessToken).toBeTruthy();
      expect(result.refreshToken).toBeTruthy();
    }
    expect(fakes.mockCreateUserWithIdentity).toHaveBeenCalledWith(
      expect.objectContaining({ email: "newuser@example.com", providerUserId: VALID_SUB, role: "passenger" }),
    );
  });

  it("logs in an existing Apple identity without creating a new user (usuario Apple existente)", async () => {
    const existingUser = { id: "user-existing", email: "returning@example.com", name: "Returning", role: "driver", status: "active", avatarUrl: null, isVerified: true };
    const fakes = buildFakes({
      existingIdentity: { id: "identity-existing", userId: "user-existing" },
      userById: existingUser,
    });

    const result = await fakes.service.signIn(basePayload);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.session.user.id).toBe("user-existing");
    expect(fakes.mockCreateUserWithIdentity).not.toHaveBeenCalled();
  });

  it("rejects a suspended existing user with 403", async () => {
    const suspendedUser = { id: "user-susp", email: "susp@example.com", name: "Susp", role: "passenger", status: "suspended", avatarUrl: null, isVerified: true };
    const fakes = buildFakes({
      existingIdentity: { id: "identity-susp", userId: "user-susp" },
      userById: suspendedUser,
    });

    const result = await fakes.service.signIn(basePayload);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("AUTH_ACCOUNT_SUSPENDED");
      expect(result.statusCode).toBe(403);
    }
  });

  it("rejects a banned existing user with 403", async () => {
    const bannedUser = { id: "user-ban", email: "ban@example.com", name: "Ban", role: "passenger", status: "banned", avatarUrl: null, isVerified: true };
    const fakes = buildFakes({
      existingIdentity: { id: "identity-ban", userId: "user-ban" },
      userById: bannedUser,
    });

    const result = await fakes.service.signIn(basePayload);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.statusCode).toBe(403);
  });

  it("returns a controlled conflict, without auto-linking, when the email already belongs to another account", async () => {
    const otherAccount = { id: "user-other", email: "newuser@example.com", name: "Other", role: "passenger", status: "active", avatarUrl: null, isVerified: true };
    const fakes = buildFakes({
      existingIdentity: null,
      userByEmail: otherAccount,
    });

    const result = await fakes.service.signIn({ ...basePayload, role: "passenger" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("AUTH_APPLE_ACCOUNT_LINKING_REQUIRED");
      expect(result.statusCode).toBe(409);
    }
    expect(fakes.mockCreateUserWithIdentity).not.toHaveBeenCalled();
  });

  it("handles Apple's private relay email correctly for a new user", async () => {
    const relayUser = { id: "user-relay", email: "abc123@privaterelay.appleid.com", name: "Relay User", role: "passenger", status: "active", avatarUrl: null, isVerified: true };
    const fakes = buildFakes({
      existingIdentity: null,
      userByEmail: null,
      identityClaims: { email: "abc123@privaterelay.appleid.com", isPrivateEmail: true },
      createUserWithIdentityResult: { user: relayUser, identity: { id: "identity-relay" } },
    });

    const result = await fakes.service.signIn({ ...basePayload, role: "passenger", name: { givenName: "Relay", familyName: "User" } });

    expect(result.ok).toBe(true);
    expect(fakes.mockCreateUserWithIdentity).toHaveBeenCalledWith(
      expect.objectContaining({ email: "abc123@privaterelay.appleid.com", providerIsPrivateEmail: true }),
    );
  });

  it("uses the displayName confirmed in the passenger setup instead of trusting Apple's optional name", async () => {
    const newUser = { id: "user-new2", email: "newuser@example.com", name: "Nombre Confirmado", role: "passenger", status: "active", avatarUrl: null, isVerified: true };
    const fakes = buildFakes({
      existingIdentity: null,
      userByEmail: null,
      createUserWithIdentityResult: { user: newUser, identity: { id: "identity-2" } },
    });

    await fakes.service.signIn({
      ...basePayload,
      role: "passenger",
      displayName: "Nombre Confirmado",
      name: { givenName: "Jane", familyName: "Appleseed" },
    });

    expect(fakes.mockCreateUserWithIdentity).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Nombre Confirmado" }),
    );
  });

  it("uses the required passenger displayName even when Apple does not send a name", async () => {
    const newUser = { id: "user-new3", email: "newuser@example.com", name: "Nombre Manual", role: "passenger", status: "active", avatarUrl: null, isVerified: true };
    const fakes = buildFakes({
      existingIdentity: null,
      userByEmail: null,
      createUserWithIdentityResult: { user: newUser, identity: { id: "identity-3" } },
    });

    await fakes.service.signIn({
      ...basePayload,
      role: "passenger",
      displayName: "Nombre Manual",
    });

    expect(fakes.mockCreateUserWithIdentity).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Nombre Manual" }),
    );
  });

  it("caps a direct-service passenger displayName at 100 characters", async () => {
    const longLocalPart = "a".repeat(80);
    const longEmail = `${longLocalPart}@example.com`;
    const longDisplayName = "N".repeat(120);
    const newUser = { id: "user-longname", email: longEmail, name: longDisplayName.slice(0, 100), role: "passenger", status: "active", avatarUrl: null, isVerified: true };
    const fakes = buildFakes({
      existingIdentity: null,
      userByEmail: null,
      identityClaims: { email: longEmail },
      exchangedClaims: { email: longEmail },
      createUserWithIdentityResult: { user: newUser, identity: { id: "identity-longname" } },
    });

    await fakes.service.signIn({
      ...basePayload,
      role: "passenger",
      displayName: longDisplayName,
    });

    const call = fakes.mockCreateUserWithIdentity.mock.calls[0]?.[0] as { name: string };
    expect(call.name.length).toBeLessThanOrEqual(100);
    expect(call.name).toBe(longDisplayName.slice(0, 100));
  });

  it("resolves a duplicate-creation race by falling back to the existing identity", async () => {
    const raceUser = { id: "user-race", email: "newuser@example.com", name: "Race Winner", role: "passenger", status: "active", avatarUrl: null, isVerified: true };
    const fakes = buildFakes({
      existingIdentity: null, // first lookup: not found
      userByEmail: null,
      createUserWithIdentityResult: null, // simulates unique-violation race loss
      userById: raceUser,
    });
    // Second findByProviderAndSub call (post-race re-check) must return the winner's identity.
    fakes.mockFindByProviderAndSub
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "identity-race", userId: "user-race" });

    const result = await fakes.service.signIn({ ...basePayload, role: "passenger" });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.session.user.id).toBe("user-race");
  });

  it("rejects when Apple's token-exchange response describes a different account than the identityToken (respuesta incoherente)", async () => {
    const fakes = buildFakes({
      existingIdentity: null,
      userByEmail: null,
      exchangedClaims: { sub: "a-completely-different-sub" },
    });

    const result = await fakes.service.signIn({ ...basePayload, role: "passenger" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("AUTH_APPLE_TOKEN_INCOHERENT");
      expect(result.statusCode).toBe(401);
    }
    // The identity lookup by sub runs before the code-consuming exchange —
    // confirmed once here (not "never called").
    expect(fakes.mockFindByProviderAndSub).toHaveBeenCalledTimes(1);
  });

  it("does not consume the authorizationCode (never calls exchange) when a new user is missing role — the code stays valid for an immediate retry with role", async () => {
    const fakes = buildFakes({ existingIdentity: null, userByEmail: null });

    const result = await fakes.service.signIn(basePayload); // no role

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("VALIDATION_ERROR");
    expect(fakes.mockExchange).not.toHaveBeenCalled();
  });

  it("does not consume the authorizationCode when the email already belongs to another account", async () => {
    const otherAccount = { id: "user-other2", email: "newuser@example.com", name: "Other2", role: "passenger", status: "active", avatarUrl: null, isVerified: true };
    const fakes = buildFakes({ existingIdentity: null, userByEmail: otherAccount });

    const result = await fakes.service.signIn({ ...basePayload, role: "passenger" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("AUTH_APPLE_ACCOUNT_LINKING_REQUIRED");
    expect(fakes.mockExchange).not.toHaveBeenCalled();
  });

  it("succeeds when the client retries immediately with role using the same (still-valid) authorizationCode", async () => {
    const newUser = { id: "user-retry", email: "newuser@example.com", name: "Retry User", role: "passenger", status: "active", avatarUrl: null, isVerified: true };
    const fakes = buildFakes({
      existingIdentity: null,
      userByEmail: null,
      createUserWithIdentityResult: { user: newUser, identity: { id: "identity-retry" } },
    });

    // First attempt: no role — must be rejected without touching Apple's token
    // endpoint. buildFakes queues exactly the 2 verify() results a single
    // successful signIn() needs; this attempt only consumes 1 (identityToken).
    const firstAttempt = await fakes.service.signIn(basePayload);
    expect(firstAttempt.ok).toBe(false);
    expect(fakes.mockExchange).not.toHaveBeenCalled();

    // Retry with role, same identityToken/authorizationCode. Re-queue verify()
    // results for this second attempt (identityToken, then the exchanged
    // token) since the first attempt already consumed one of the originals.
    fakes.mockVerify.mockReset();
    fakes.mockVerify
      .mockResolvedValueOnce(baseClaims())
      .mockResolvedValueOnce(baseClaims());

    const retry = await fakes.service.signIn({ ...basePayload, role: "passenger" });
    expect(retry.ok).toBe(true);
    expect(fakes.mockExchange).toHaveBeenCalledTimes(1);
  });

  it("propagates AUTH_CONFIGURATION_ERROR when Apple config is incomplete", async () => {
    const fakes = buildFakes({});
    fakes.mockVerify.mockReset();
    fakes.mockVerify.mockRejectedValueOnce(
      new AppError({ code: "AUTH_CONFIGURATION_ERROR", message: "Apple Sign In is not configured.", statusCode: 503 }),
    );

    await expect(fakes.service.signIn(basePayload)).rejects.toMatchObject({ code: "AUTH_CONFIGURATION_ERROR" });
  });

  it("encrypts Apple's refresh token before persisting it — never stores it in plaintext", async () => {
    const newUser = { id: "user-enc", email: "newuser@example.com", name: "Enc User", role: "passenger", status: "active", avatarUrl: null, isVerified: true };
    const fakes = buildFakes({
      existingIdentity: null,
      userByEmail: null,
      createUserWithIdentityResult: { user: newUser, identity: { id: "identity-enc" } },
    });

    await fakes.service.signIn({ ...basePayload, role: "passenger" });

    const call = fakes.mockCreateUserWithIdentity.mock.calls[0]?.[0] as { encryptedRefreshToken?: string };
    expect(call.encryptedRefreshToken).toBeDefined();
    expect(call.encryptedRefreshToken).not.toBe("apple-refresh-token-raw");
    expect(call.encryptedRefreshToken).not.toContain("apple-refresh-token-raw");
  });

  it("updates the encrypted refresh token on repeat sign-in for an existing identity", async () => {
    const existingUser = { id: "user-existing2", email: "returning2@example.com", name: "Returning2", role: "passenger", status: "active", avatarUrl: null, isVerified: true };
    const fakes = buildFakes({
      existingIdentity: { id: "identity-existing2", userId: "user-existing2" },
      userById: existingUser,
    });

    await fakes.service.signIn(basePayload);

    expect(fakes.mockUpdateRefreshToken).toHaveBeenCalledWith(
      "identity-existing2",
      "cl.rapago.app",
      expect.not.stringContaining("apple-refresh-token-raw"),
    );
  });

  it("returns Rapa Go's own access token, refresh token, and user session shape unchanged from the standard login contract", async () => {
    const newUser = { id: "user-shape", email: "newuser@example.com", name: "Shape User", role: "passenger", status: "active", avatarUrl: null, isVerified: true };
    const fakes = buildFakes({
      existingIdentity: null,
      userByEmail: null,
      createUserWithIdentityResult: { user: newUser, identity: { id: "identity-shape" } },
    });

    const result = await fakes.service.signIn({ ...basePayload, role: "passenger" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(typeof result.session.accessToken).toBe("string");
      expect(typeof result.session.expiresAt).toBe("string");
      expect(result.session.user).toMatchObject({ id: "user-shape", email: "newuser@example.com" });
      expect(typeof result.refreshToken).toBe("string");
      // Never expose Apple's own tokens to the client.
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain("apple-access-token");
      expect(serialized).not.toContain("apple-refresh-token-raw");
      expect(serialized).not.toContain("apple-exchanged-id-token");
    }
  });

  it("never logs the identityToken, authorizationCode, Apple tokens, or encryption key", async () => {
    const logSpy  = vi.spyOn(console, "log").mockImplementation(() => {});
    const errSpy  = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const newUser = { id: "user-log", email: "newuser@example.com", name: "Log User", role: "passenger", status: "active", avatarUrl: null, isVerified: true };
    const fakes = buildFakes({
      existingIdentity: null,
      userByEmail: null,
      createUserWithIdentityResult: { user: newUser, identity: { id: "identity-log" } },
    });

    await fakes.service.signIn({ ...basePayload, role: "passenger" });

    const allLoggedText = [...logSpy.mock.calls, ...errSpy.mock.calls, ...warnSpy.mock.calls]
      .flat()
      .map((v) => (typeof v === "string" ? v : JSON.stringify(v)))
      .join(" ");

    expect(allLoggedText).not.toContain("fake-identity-token");
    expect(allLoggedText).not.toContain("fake-authorization-code");
    expect(allLoggedText).not.toContain("apple-access-token");
    expect(allLoggedText).not.toContain("apple-refresh-token-raw");
    expect(allLoggedText).not.toContain(process.env["OAUTH_TOKEN_ENCRYPTION_KEY"]);

    logSpy.mockRestore();
    errSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("rejects a new-user sign-in with no role and no existing account (role required)", async () => {
    const fakes = buildFakes({ existingIdentity: null, userByEmail: null });

    const result = await fakes.service.signIn(basePayload);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("VALIDATION_ERROR");
    expect(fakes.mockCreateUserWithIdentity).not.toHaveBeenCalled();
  });

  it("blocks public creation of admin accounts via Apple sign-in", async () => {
    const fakes = buildFakes({ existingIdentity: null, userByEmail: null });

    const result = await fakes.service.signIn({ ...basePayload, role: "admin" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("AUTH_FORBIDDEN");
      expect(result.statusCode).toBe(403);
    }
    expect(fakes.mockCreateUserWithIdentity).not.toHaveBeenCalled();
  });

  it("rejects a non-passenger role (driver) when Apple provides no email — no form to collect a fallback contact email", async () => {
    const fakes = buildFakes({
      existingIdentity: null,
      userByEmail: null,
      identityClaims: { email: undefined },
      exchangedClaims: { email: undefined },
    });

    const result = await fakes.service.signIn({ ...basePayload, role: "driver" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("AUTH_APPLE_EMAIL_MISSING");
  });

  it("defers the email requirement for passenger role to the setup form instead of hard-blocking immediately", async () => {
    const fakes = buildFakes({
      existingIdentity: null,
      userByEmail: null,
      identityClaims: { email: undefined },
      exchangedClaims: { email: undefined },
    });

    // Role-selection style call: no phone/fareType/contactEmail yet.
    const result = await fakes.service.signIn({
      identityToken: "fake-identity-token",
      authorizationCode: "fake-authorization-code",
      role: "passenger",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("AUTH_APPLE_SETUP_REQUIRED");
    expect(fakes.mockCreateUserWithIdentity).not.toHaveBeenCalled();
  });

  it("requires a valid contactEmail for passenger role when Apple provides no email", async () => {
    const fakes = buildFakes({
      existingIdentity: null,
      userByEmail: null,
      identityClaims: { email: undefined },
      exchangedClaims: { email: undefined },
    });

    const result = await fakes.service.signIn({
      ...basePayload,
      role: "passenger",
      contactEmail: "not-an-email",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("AUTH_APPLE_SETUP_REQUIRED");
      expect(result.message).toBe("Ingresa un correo electrónico válido.");
    }
    expect(fakes.mockCreateUserWithIdentity).not.toHaveBeenCalled();
  });

  it("creates a passenger account using contactEmail as the account email when Apple provides no email — Apple subject remains the identity", async () => {
    const newUser = {
      id: "user-contact-email",
      email: "contact@example.com",
      name: "New User",
      role: "passenger",
      status: "active",
      avatarUrl: null,
      isVerified: true,
    };
    const fakes = buildFakes({
      existingIdentity: null,
      userByEmail: null,
      identityClaims: { email: undefined },
      exchangedClaims: { email: undefined },
      createUserWithIdentityResult: { user: newUser, identity: { id: "identity-contact" } },
    });

    const result = await fakes.service.signIn({
      ...basePayload,
      role: "passenger",
      contactEmail: "contact@example.com",
    });

    expect(result.ok).toBe(true);
    expect(fakes.mockCreateUserWithIdentity).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "contact@example.com",
        providerUserId: VALID_SUB,
      }),
    );
  });
});

describe("AppleAuthService.signIn passenger fare validation rules", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env["OAUTH_TOKEN_ENCRYPTION_KEY"] = randomBytes(32).toString("hex");
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  const VALID_RUT = "12345678-5";
  const VALID_PASSPORT = "A1234567";
  const VALID_ACCREDITATION = {
    documentName: "cedula.pdf",
    documentType: "application/pdf" as const,
    documentSize: 60,
    documentDataUrl:
      "data:application/pdf;base64,JVBERi0xLjQgbWluaW1hbCB0ZXN0IGZpbGUgY29udGVudCBwYWRkaW5nIHBhZGRpbmc=",
  };

  function newUserFakes() {
    const newUser = {
      id: "user-new",
      email: "newuser@example.com",
      name: "New User",
      role: "passenger",
      status: "active",
      avatarUrl: null,
      isVerified: true,
    };
    return buildFakes({
      existingIdentity: null,
      userByEmail: null,
      createUserWithIdentityResult: { user: newUser, identity: { id: "identity-1" } },
    });
  }

  it("requires a valid RUT for passengerFareType=chilean", async () => {
    const fakes = newUserFakes();
    const result = await fakes.service.signIn({
      ...basePayload,
      role: "passenger",
      passengerFareType: "chilean",
      rut: undefined,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("AUTH_APPLE_SETUP_REQUIRED");
    expect(fakes.mockCreateUserWithIdentity).not.toHaveBeenCalled();
  });

  it("rejects an invalid RUT for passengerFareType=chilean", async () => {
    const fakes = newUserFakes();
    const result = await fakes.service.signIn({
      ...basePayload,
      role: "passenger",
      passengerFareType: "chilean",
      rut: "11111111-9",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("AUTH_APPLE_SETUP_REQUIRED");
  });

  it("accepts a valid RUT for passengerFareType=chilean and creates the account", async () => {
    const fakes = newUserFakes();
    const result = await fakes.service.signIn({
      ...basePayload,
      role: "passenger",
      passengerFareType: "chilean",
      rut: VALID_RUT,
    });

    expect(result.ok).toBe(true);
    expect(fakes.mockCreateUserWithIdentity).toHaveBeenCalled();
  });

  it("rejects passengerFareType=chilean when a passport is sent instead of a RUT", async () => {
    const fakes = newUserFakes();
    const result = await fakes.service.signIn({
      ...basePayload,
      role: "passenger",
      passengerFareType: "chilean",
      rut: undefined,
      passport: VALID_PASSPORT,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("AUTH_APPLE_SETUP_REQUIRED");
    expect(fakes.mockCreateUserWithIdentity).not.toHaveBeenCalled();
  });

  it("requires a valid passport for passengerFareType=foreigner", async () => {
    const fakes = newUserFakes();
    const result = await fakes.service.signIn({
      ...basePayload,
      role: "passenger",
      passengerFareType: "foreigner",
      rut: undefined,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("AUTH_APPLE_SETUP_REQUIRED");
    expect(fakes.mockCreateUserWithIdentity).not.toHaveBeenCalled();
  });

  it("accepts a valid passport for passengerFareType=foreigner and creates the account", async () => {
    const fakes = newUserFakes();
    const result = await fakes.service.signIn({
      ...basePayload,
      role: "passenger",
      passengerFareType: "foreigner",
      rut: undefined,
      passport: VALID_PASSPORT,
    });

    expect(result.ok).toBe(true);
    expect(fakes.mockCreateUserWithIdentity).toHaveBeenCalled();
  });

  it("rejects passengerFareType=foreigner when a RUT is sent instead of a passport", async () => {
    const fakes = newUserFakes();
    const result = await fakes.service.signIn({
      ...basePayload,
      role: "passenger",
      passengerFareType: "foreigner",
      rut: VALID_RUT,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("AUTH_APPLE_SETUP_REQUIRED");
    expect(fakes.mockCreateUserWithIdentity).not.toHaveBeenCalled();
  });

  it("requires a valid RUT and a residence accreditation for passengerFareType=resident", async () => {
    const fakes = newUserFakes();
    const result = await fakes.service.signIn({
      ...basePayload,
      role: "passenger",
      passengerFareType: "resident",
      rut: undefined,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("AUTH_APPLE_SETUP_REQUIRED");
    expect(fakes.mockCreateUserWithIdentity).not.toHaveBeenCalled();
  });

  it("rejects passengerFareType=resident without a residence accreditation even with a valid RUT", async () => {
    const fakes = newUserFakes();
    const result = await fakes.service.signIn({
      ...basePayload,
      role: "passenger",
      passengerFareType: "resident",
      rut: VALID_RUT,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("AUTH_RESIDENCE_ACCREDITATION_REQUIRED");
    expect(fakes.mockCreateUserWithIdentity).not.toHaveBeenCalled();
  });

  it("accepts passengerFareType=resident with a valid RUT and residence accreditation", async () => {
    const fakes = newUserFakes();
    const result = await fakes.service.signIn({
      ...basePayload,
      role: "passenger",
      passengerFareType: "resident",
      rut: VALID_RUT,
      residenceAccreditation: VALID_ACCREDITATION,
    });

    expect(result.ok).toBe(true);
    expect(fakes.mockCreateUserWithIdentity).toHaveBeenCalled();
  });

  it("rejects passengerFareType=resident when a passport is sent instead of a RUT", async () => {
    const fakes = newUserFakes();
    const result = await fakes.service.signIn({
      ...basePayload,
      role: "passenger",
      passengerFareType: "resident",
      rut: undefined,
      passport: VALID_PASSPORT,
      residenceAccreditation: VALID_ACCREDITATION,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("AUTH_APPLE_SETUP_REQUIRED");
    expect(fakes.mockCreateUserWithIdentity).not.toHaveBeenCalled();
  });

  it("never accepts RUT and passport at the same time, regardless of fare type", async () => {
    const fakes = newUserFakes();
    const result = await fakes.service.signIn({
      ...basePayload,
      role: "passenger",
      passengerFareType: "chilean",
      rut: VALID_RUT,
      passport: VALID_PASSPORT,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("AUTH_APPLE_SETUP_REQUIRED");
    expect(fakes.mockCreateUserWithIdentity).not.toHaveBeenCalled();
  });
});
