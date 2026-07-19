import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit tests for AuthService hardening rules.
 *
 * These tests mock all I/O dependencies so they run without a DB or JWT_SECRET.
 */

// ── Mocks must be declared before the import under test ──────────────────────

const mockCreateUser         = vi.fn();
const mockCreateForUser      = vi.fn();
const mockFindByEmail        = vi.fn();
const mockFindUserById       = vi.fn();
const mockFindByUserId       = vi.fn();
const mockHashPassword       = vi.fn();
const mockVerifyPassword     = vi.fn().mockResolvedValue(false);
const mockIssueAccessToken   = vi.fn();
const mockIssueRefreshToken  = vi.fn();
const mockCreateSession      = vi.fn();
const mockCreateRefreshToken = vi.fn();
const mockRecordSafe         = vi.fn();
const mockIncrementFailed    = vi.fn().mockResolvedValue({ failedLoginAttempts: 1 });
const mockCreateFacebookExchange = vi.fn();
const mockConsumeFacebookExchange = vi.fn();

vi.mock("../../../modules/users/users.service.js", () => ({
  UsersService: vi.fn().mockImplementation(() => ({ createUser: mockCreateUser })),
}));
vi.mock("../../../modules/users/users.repository.js", () => ({
  UsersRepository: vi.fn().mockImplementation(() => ({ findByEmail: mockFindByEmail, findById: mockFindUserById })),
}));
vi.mock("../password.service.js", () => ({
  PasswordService: vi.fn().mockImplementation(() => ({ hashPassword: mockHashPassword, verifyPassword: mockVerifyPassword })),
}));
vi.mock("../token.service.js", () => ({
  TokenService: vi.fn().mockImplementation(() => ({
    issueAccessToken: mockIssueAccessToken,
    issueRefreshToken: mockIssueRefreshToken,
    hashToken: vi.fn().mockReturnValue("hash"),
    verifyAccessToken: vi.fn(),
  })),
}));
vi.mock("../session.service.js", () => ({
  SessionService: vi.fn().mockImplementation(() => ({
    createSession: mockCreateSession,
    createRefreshToken: mockCreateRefreshToken,
    revokeSessionByTokenHash: vi.fn(),
    isSessionValid: vi.fn(),
  })),
}));
vi.mock("../authCredentials.repository.js", () => ({
  AuthCredentialsRepository: vi.fn().mockImplementation(() => ({
    createForUser:           mockCreateForUser,
    findByUserId:            mockFindByUserId,
    incrementFailedAttempts: mockIncrementFailed,
    resetFailedAttempts:     vi.fn(),
    lockUntil:               vi.fn(),
    updatePassword:          vi.fn(),
  })),
}));
vi.mock("../facebookLoginExchange.repository.js", () => ({
  FacebookLoginExchangeRepository: vi.fn().mockImplementation(() => ({
    create: mockCreateFacebookExchange,
    consume: mockConsumeFacebookExchange,
  })),
}));
vi.mock("../../../modules/audit/audit.service.js", () => ({
  AuditService: vi.fn().mockImplementation(() => ({ recordSafe: mockRecordSafe })),
}));

// ── Import after mocks ────────────────────────────────────────────────────────
const { AuthService } = await import("../auth.service.js");

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockSuccessfulRegistration() {
  mockHashPassword.mockResolvedValue("hashed_pw");
  mockCreateUser.mockResolvedValue({
    id: "user-1", email: "user@test.com", name: "Test", role: "passenger",
    status: "active", avatarUrl: null, isVerified: false,
  });
  mockCreateForUser.mockResolvedValue({});
  mockIssueAccessToken.mockReturnValue({ token: "jwt", hash: "access-hash", expiresAt: new Date(Date.now() + 900_000) });
  mockIssueRefreshToken.mockReturnValue({ token: "rt", hash: "rt-hash", expiresAt: new Date(Date.now() + 604_800_000) });
  mockCreateSession.mockResolvedValue(undefined);
  mockCreateRefreshToken.mockResolvedValue(undefined);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("AuthService.register", () => {
  let service: InstanceType<typeof AuthService>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService();
  });

  it("blocks admin registration with AUTH_FORBIDDEN and statusCode 403", async () => {
    const result = await service.register({
      email: "admin@test.com",
      password: "Password1!",
      name: "Hacker",
      role: "admin",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("AUTH_FORBIDDEN");
      expect(result.statusCode).toBe(403);
    }
    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(mockHashPassword).not.toHaveBeenCalled();
  });

  it("assigns passenger role the 'active' status", async () => {
    mockSuccessfulRegistration();

    const result = await service.register({
      email: "passenger@test.com",
      password: "Password1!",
      name: "Passenger",
      role: "passenger",
    });

    expect(result.ok).toBe(true);
    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({ status: "active", role: "passenger" }),
    );
  });

  it("blocks public driver registration and requires the application flow", async () => {
    const result = await service.register({
      email: "driver@test.com",
      password: "Password1!",
      name: "Driver",
      role: "driver",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("AUTH_FORBIDDEN");
      expect(result.statusCode).toBe(403);
    }
    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it("normalises email to lowercase", async () => {
    mockSuccessfulRegistration();

    await service.register({
      email: "UPPER@TEST.COM",
      password: "Password1!",
      name: "Test",
      role: "passenger",
    });

    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: "upper@test.com" }),
    );
  });

  it("returns AUTH_EMAIL_TAKEN when email is already registered", async () => {
    const { AppError } = await import("../../../shared/errors/AppError.js");
    mockHashPassword.mockResolvedValue("hashed_pw");
    mockCreateUser.mockRejectedValue(
      new AppError({ code: "AUTH_EMAIL_TAKEN", message: "Email taken.", statusCode: 409 }),
    );

    const result = await service.register({
      email: "taken@test.com",
      password: "Password1!",
      name: "Test",
      role: "passenger",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("AUTH_EMAIL_TAKEN");
  });

  it("does not include password or hash in the returned session", async () => {
    mockSuccessfulRegistration();

    const result = await service.register({
      email: "clean@test.com",
      password: "Password1!",
      name: "Clean",
      role: "passenger",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const serialised = JSON.stringify(result.session);
      expect(serialised).not.toContain("password");
      expect(serialised).not.toContain("hash");
    }
  });
});

describe("AuthService.login", () => {
  let service: InstanceType<typeof AuthService>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService();
  });

  it("returns generic error when user not found (no email enumeration)", async () => {
    mockFindByEmail.mockResolvedValue(null);

    const result = await service.login({ email: "ghost@test.com", password: "password" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("AUTH_INVALID_CREDENTIALS");
      expect(result.message).toBe("Invalid email or password.");
    }
  });

  it("returns generic error when password is wrong (no email enumeration)", async () => {
    mockFindByEmail.mockResolvedValue({
      id: "user-1", email: "real@test.com", name: "Real", role: "passenger",
      status: "active", avatarUrl: null, isVerified: false,
    });
    mockFindByUserId.mockResolvedValue({
      userId: "user-1", passwordHash: "argon2hash",
      failedLoginAttempts: 0, lockedUntil: null,
    });
    // mockVerifyPassword defaults to false — wrong password

    const result = await service.login({ email: "real@test.com", password: "wrong" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("AUTH_INVALID_CREDENTIALS");
      expect(result.message).toBe("Invalid email or password.");
    }
  });

  it("blocks pending accounts before password verification", async () => {
    mockFindByEmail.mockResolvedValue({
      id: "pending-1",
      email: "pending@test.com",
      name: "Pending",
      role: "driver",
      status: "pending",
      avatarUrl: null,
      isVerified: false,
    });

    const result = await service.login({
      email: "pending@test.com",
      password: "Password1!",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("AUTH_ACCOUNT_PENDING");
      expect(result.statusCode).toBe(403);
    }
    expect(mockVerifyPassword).not.toHaveBeenCalled();
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it("blocks suspended accounts before password verification", async () => {
    mockFindByEmail.mockResolvedValue({
      id: "suspended-1",
      email: "blocked@test.com",
      name: "Blocked",
      role: "passenger",
      status: "suspended",
      avatarUrl: null,
      isVerified: false,
    });

    const result = await service.login({
      email: "blocked@test.com",
      password: "Password1!",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("AUTH_ACCOUNT_SUSPENDED");
      expect(result.statusCode).toBe(403);
    }
    expect(mockVerifyPassword).not.toHaveBeenCalled();
  });

  it("never accepts a plaintext password for the historical admin test email", async () => {
    mockFindByEmail.mockResolvedValue({
      id: "admin-1",
      email: "admin_test@rapago.cl",
      name: "Admin",
      role: "admin",
      status: "active",
      avatarUrl: null,
      isVerified: true,
    });
    mockFindByUserId.mockResolvedValue({
      userId: "admin-1",
      passwordHash: "Password1!",
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
    mockVerifyPassword.mockResolvedValueOnce(false);

    const result = await service.login({
      email: "admin_test@rapago.cl",
      password: "Password1!",
    });

    expect(result.ok).toBe(false);
    expect(mockVerifyPassword).toHaveBeenCalledWith(
      "Password1!",
      "Password1!",
    );
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

});

describe("AuthService.exchangeFacebookLogin", () => {
  let service: InstanceType<typeof AuthService>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService();
  });

  it("rejects an expired or already-used exchange code", async () => {
    mockConsumeFacebookExchange.mockResolvedValue(null);

    const result = await service.exchangeFacebookLogin("expired-code");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("AUTH_FACEBOOK_EXCHANGE_INVALID");
      expect(result.statusCode).toBe(401);
    }
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it("creates a session only after consuming a valid one-time code", async () => {
    mockConsumeFacebookExchange.mockResolvedValue("facebook-user-1");
    mockFindUserById.mockResolvedValue({
      id: "facebook-user-1",
      email: "facebook@test.com",
      name: "Facebook Passenger",
      role: "passenger",
      status: "active",
      avatarUrl: null,
      isVerified: true,
    });
    mockIssueAccessToken.mockReturnValue({
      token: "a".repeat(64),
      hash: "access-hash",
      expiresAt: new Date(Date.now() + 900_000),
    });
    mockIssueRefreshToken.mockReturnValue({
      token: "r".repeat(96),
      hash: "refresh-hash",
      expiresAt: new Date(Date.now() + 604_800_000),
    });
    mockCreateSession.mockResolvedValue(undefined);
    mockCreateRefreshToken.mockResolvedValue(undefined);

    const result = await service.exchangeFacebookLogin("valid-code");

    expect(result.ok).toBe(true);
    expect(mockConsumeFacebookExchange).toHaveBeenCalledWith("valid-code");
    expect(mockCreateSession).toHaveBeenCalledOnce();
    expect(mockCreateRefreshToken).toHaveBeenCalledOnce();
  });
});
