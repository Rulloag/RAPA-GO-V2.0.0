import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { AppleAuthService } from "../appleAuth.service.js";
import { AppError } from "../../../shared/errors/AppError.js";

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
    updateEncryptedRefreshToken: mockUpdateRefreshToken,
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

const basePayload = {
  identityToken: "fake-identity-token",
  authorizationCode: "fake-authorization-code",
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

  it("uses the provided name on first login", async () => {
    const newUser = { id: "user-new2", email: "newuser@example.com", name: "Jane Appleseed", role: "passenger", status: "active", avatarUrl: null, isVerified: true };
    const fakes = buildFakes({
      existingIdentity: null,
      userByEmail: null,
      createUserWithIdentityResult: { user: newUser, identity: { id: "identity-2" } },
    });

    await fakes.service.signIn({ ...basePayload, role: "passenger", name: { givenName: "Jane", familyName: "Appleseed" } });

    expect(fakes.mockCreateUserWithIdentity).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Jane Appleseed" }),
    );
  });

  it("falls back to the email local part when name is absent on a later/first login without name", async () => {
    const newUser = { id: "user-new3", email: "newuser@example.com", name: "newuser", role: "passenger", status: "active", avatarUrl: null, isVerified: true };
    const fakes = buildFakes({
      existingIdentity: null,
      userByEmail: null,
      createUserWithIdentityResult: { user: newUser, identity: { id: "identity-3" } },
    });

    await fakes.service.signIn({ ...basePayload, role: "passenger" });

    expect(fakes.mockCreateUserWithIdentity).toHaveBeenCalledWith(
      expect.objectContaining({ name: "newuser" }),
    );
  });

  it("caps the email-local-part name fallback at 50 characters, same as the given/family name path", async () => {
    const longLocalPart = "a".repeat(80);
    const longEmail = `${longLocalPart}@example.com`;
    const newUser = { id: "user-longname", email: longEmail, name: longLocalPart.slice(0, 50), role: "passenger", status: "active", avatarUrl: null, isVerified: true };
    const fakes = buildFakes({
      existingIdentity: null,
      userByEmail: null,
      identityClaims: { email: longEmail },
      exchangedClaims: { email: longEmail },
      createUserWithIdentityResult: { user: newUser, identity: { id: "identity-longname" } },
    });

    await fakes.service.signIn({ ...basePayload, role: "passenger" });

    const call = fakes.mockCreateUserWithIdentity.mock.calls[0]?.[0] as { name: string };
    expect(call.name.length).toBeLessThanOrEqual(50);
    expect(call.name).toBe(longLocalPart.slice(0, 50));
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
      exchangedClaims: { sub: "a-completely-different-sub" },
    });

    const result = await fakes.service.signIn(basePayload);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("AUTH_APPLE_TOKEN_INCOHERENT");
      expect(result.statusCode).toBe(401);
    }
    expect(fakes.mockFindByProviderAndSub).not.toHaveBeenCalled();
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

  it("rejects when Apple provides no email for a first-time sign-in", async () => {
    const fakes = buildFakes({
      existingIdentity: null,
      userByEmail: null,
      identityClaims: { email: undefined },
      exchangedClaims: { email: undefined },
    });

    const result = await fakes.service.signIn({ ...basePayload, role: "passenger" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("AUTH_APPLE_EMAIL_MISSING");
  });
});
