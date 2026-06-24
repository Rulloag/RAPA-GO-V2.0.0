import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit tests for GoogleAuthService.
 * All I/O (Google OAuth, DB, JWT) is mocked — no real credentials needed.
 */

// ── Mocks must be declared before imports ────────────────────────────────────

const mockVerifyIdToken      = vi.fn();
const mockGetPayload         = vi.fn();
const mockFindByEmail        = vi.fn();
const mockCreateUser         = vi.fn();
const mockIssueAccessToken   = vi.fn();
const mockIssueRefreshToken  = vi.fn();
const mockCreateSession      = vi.fn();
const mockCreateRefreshToken = vi.fn();
const mockRecordSafe         = vi.fn();

vi.mock("google-auth-library", () => ({
  OAuth2Client: vi.fn().mockImplementation(() => ({
    verifyIdToken: mockVerifyIdToken,
  })),
}));
vi.mock("../token.service.js", () => ({
  TokenService: vi.fn().mockImplementation(() => ({
    issueAccessToken:  mockIssueAccessToken,
    issueRefreshToken: mockIssueRefreshToken,
  })),
}));
vi.mock("../session.service.js", () => ({
  SessionService: vi.fn().mockImplementation(() => ({
    createSession:      mockCreateSession,
    createRefreshToken: mockCreateRefreshToken,
  })),
}));
vi.mock("../../../modules/users/users.repository.js", () => ({
  UsersRepository: vi.fn().mockImplementation(() => ({ findByEmail: mockFindByEmail })),
}));
vi.mock("../../../modules/users/users.service.js", () => ({
  UsersService: vi.fn().mockImplementation(() => ({ createUser: mockCreateUser })),
}));
vi.mock("../../../modules/audit/audit.service.js", () => ({
  AuditService: vi.fn().mockImplementation(() => ({ recordSafe: mockRecordSafe })),
}));

// ── Import after mocks ────────────────────────────────────────────────────────
const { GoogleAuthService } = await import("../googleAuth.service.js");

// ── Fixtures ──────────────────────────────────────────────────────────────────

const EXISTING_USER = {
  id: "user-1", email: "user@example.com", name: "Test User",
  role: "passenger" as const, status: "active" as const,
  avatarUrl: null, isVerified: false,
};

const GOOGLE_PAYLOAD = {
  email: "user@example.com",
  email_verified: true,
  name: "Test User",
};

function mockValidGoogleToken(payload = GOOGLE_PAYLOAD) {
  mockGetPayload.mockReturnValue(payload);
  mockVerifyIdToken.mockResolvedValue({ getPayload: mockGetPayload });
}

function mockTokensAndSession() {
  mockIssueAccessToken.mockReturnValue({
    token: "access-jwt", hash: "access-hash",
    expiresAt: new Date(Date.now() + 28_800_000),
  });
  mockIssueRefreshToken.mockReturnValue({
    token: "refresh-raw", hash: "refresh-hash",
    expiresAt: new Date(Date.now() + 604_800_000),
  });
  mockCreateSession.mockResolvedValue(undefined);
  mockCreateRefreshToken.mockResolvedValue(undefined);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GoogleAuthService.loginWithGoogle", () => {
  let service: InstanceType<typeof GoogleAuthService>;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env["GOOGLE_CLIENT_ID"] = "test-client-id";
    service = new GoogleAuthService();
  });

  // ── Configuration ──────────────────────────────────────────────────────────

  it("returns 503 AUTH_CONFIGURATION_ERROR when GOOGLE_CLIENT_ID is not set", async () => {
    delete process.env["GOOGLE_CLIENT_ID"];

    const result = await service.loginWithGoogle("any-token");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("AUTH_CONFIGURATION_ERROR");
      expect(result.statusCode).toBe(503);
    }
    expect(mockVerifyIdToken).not.toHaveBeenCalled();
  });

  // ── Token validation ───────────────────────────────────────────────────────

  it("returns 401 AUTH_INVALID_GOOGLE_TOKEN when verifyIdToken throws", async () => {
    mockVerifyIdToken.mockRejectedValue(new Error("invalid signature"));

    const result = await service.loginWithGoogle("bad-token");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("AUTH_INVALID_GOOGLE_TOKEN");
      expect(result.statusCode).toBe(401);
    }
  });

  it("returns 503 AUTH_GOOGLE_UNREACHABLE when ECONNRESET network error", async () => {
    const netErr = Object.assign(new Error("connect ECONNRESET"), { code: "ECONNRESET" });
    mockVerifyIdToken.mockRejectedValue(netErr);

    const result = await service.loginWithGoogle("valid-token");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("AUTH_GOOGLE_UNREACHABLE");
      expect(result.statusCode).toBe(503);
    }
  });

  it("returns 503 AUTH_GOOGLE_UNREACHABLE when ETIMEDOUT network error", async () => {
    const netErr = Object.assign(new Error("Timeout"), { code: "ETIMEDOUT" });
    mockVerifyIdToken.mockRejectedValue(netErr);

    const result = await service.loginWithGoogle("valid-token");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("AUTH_GOOGLE_UNREACHABLE");
      expect(result.statusCode).toBe(503);
    }
  });

  it("returns 503 AUTH_GOOGLE_UNREACHABLE for FetchError", async () => {
    const fetchErr = Object.assign(new Error("fetch failed"), { name: "FetchError" });
    mockVerifyIdToken.mockRejectedValue(fetchErr);

    const result = await service.loginWithGoogle("valid-token");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("AUTH_GOOGLE_UNREACHABLE");
      expect(result.statusCode).toBe(503);
    }
  });

  it("returns 401 AUTH_EMAIL_NOT_VERIFIED when email_verified is false", async () => {
    mockValidGoogleToken({ email: "user@example.com", email_verified: false, name: "Test" });

    const result = await service.loginWithGoogle("token");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("AUTH_EMAIL_NOT_VERIFIED");
      expect(result.statusCode).toBe(401);
    }
  });

  it("returns 401 AUTH_INVALID_GOOGLE_TOKEN when payload has no email", async () => {
    mockGetPayload.mockReturnValue({ email_verified: true, name: "No Email" });
    mockVerifyIdToken.mockResolvedValue({ getPayload: mockGetPayload });

    const result = await service.loginWithGoogle("token");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("AUTH_INVALID_GOOGLE_TOKEN");
  });

  // ── Account status ─────────────────────────────────────────────────────────

  it("returns 403 AUTH_ACCOUNT_SUSPENDED for suspended user", async () => {
    mockValidGoogleToken();
    mockFindByEmail.mockResolvedValue({ ...EXISTING_USER, status: "suspended" });

    const result = await service.loginWithGoogle("token");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("AUTH_ACCOUNT_SUSPENDED");
      expect(result.statusCode).toBe(403);
    }
  });

  it("returns 403 AUTH_ACCOUNT_SUSPENDED for banned user", async () => {
    mockValidGoogleToken();
    mockFindByEmail.mockResolvedValue({ ...EXISTING_USER, status: "banned" });

    const result = await service.loginWithGoogle("token");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("AUTH_ACCOUNT_SUSPENDED");
      expect(result.statusCode).toBe(403);
    }
  });

  // ── Successful login ───────────────────────────────────────────────────────

  it("returns session for existing active Google user", async () => {
    mockValidGoogleToken();
    mockFindByEmail.mockResolvedValue(EXISTING_USER);
    mockTokensAndSession();

    const result = await service.loginWithGoogle("token");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.session.accessToken).toBe("access-jwt");
      expect(result.session.user.email).toBe("user@example.com");
    }
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it("creates new user with isVerified=true for first-time Google login", async () => {
    mockValidGoogleToken();
    mockFindByEmail.mockResolvedValue(null);
    mockCreateUser.mockResolvedValue({ ...EXISTING_USER, isVerified: true });
    mockTokensAndSession();

    await service.loginWithGoogle("token");

    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email:      "user@example.com",
        role:       "passenger",
        status:     "active",
        isVerified: true,
      }),
    );
  });

  it("normalises email to lowercase for new user creation", async () => {
    mockValidGoogleToken({ email: "UPPER@EXAMPLE.COM", email_verified: true, name: "Test" });
    mockFindByEmail.mockResolvedValue(null);
    mockCreateUser.mockResolvedValue({ ...EXISTING_USER, email: "upper@example.com", isVerified: true });
    mockTokensAndSession();

    await service.loginWithGoogle("token");

    expect(mockFindByEmail).toHaveBeenCalledWith("upper@example.com");
    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: "upper@example.com" }),
    );
  });

  it("uses email local-part as display name when Google name is missing", async () => {
    mockValidGoogleToken({ email: "user@example.com", email_verified: true, name: "" });
    mockFindByEmail.mockResolvedValue(null);
    mockCreateUser.mockResolvedValue({ ...EXISTING_USER, name: "user", isVerified: true });
    mockTokensAndSession();

    await service.loginWithGoogle("token");

    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({ name: "user" }),
    );
  });

  // ── Race condition ─────────────────────────────────────────────────────────

  it("handles concurrent first-time login race by recovering with findByEmail", async () => {
    const { AppError } = await import("../../../shared/errors/AppError.js");
    mockValidGoogleToken();
    // First findByEmail: user doesn't exist yet
    mockFindByEmail.mockResolvedValueOnce(null);
    // createUser fails — concurrent request already created the user
    mockCreateUser.mockRejectedValue(
      new AppError({ code: "AUTH_EMAIL_TAKEN", message: "Email taken.", statusCode: 409 }),
    );
    // Recovery findByEmail: now the user exists
    mockFindByEmail.mockResolvedValueOnce({ ...EXISTING_USER, isVerified: true });
    mockTokensAndSession();

    const result = await service.loginWithGoogle("token");

    expect(result.ok).toBe(true);
    expect(mockFindByEmail).toHaveBeenCalledTimes(2);
  });

  it("does not expose password or token hash in the session response", async () => {
    mockValidGoogleToken();
    mockFindByEmail.mockResolvedValue(EXISTING_USER);
    mockTokensAndSession();

    const result = await service.loginWithGoogle("token");

    const serialised = JSON.stringify(result);
    expect(serialised).not.toContain("hash");
    expect(serialised).not.toContain("password");
    expect(serialised).not.toContain("refresh-raw"); // raw refresh token not in response
  });
});
