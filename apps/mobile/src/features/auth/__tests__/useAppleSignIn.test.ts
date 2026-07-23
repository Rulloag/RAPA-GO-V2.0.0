import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mockSignInWithApple = vi.fn();
const mockPluginSignIn = vi.fn();
let mockPlatform = "ios";

vi.mock("../useAuth.js", () => ({
  useAuth: () => ({ signInWithApple: mockSignInWithApple }),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    getPlatform: () => mockPlatform,
    isNativePlatform: () => mockPlatform !== "web",
  },
}));

vi.mock("@capawesome/capacitor-apple-sign-in", () => ({
  AppleSignIn: { signIn: mockPluginSignIn },
  SignInScope: { Email: "EMAIL", FullName: "FULL_NAME" },
  ErrorCode: { SignInCanceled: "SIGN_IN_CANCELED" },
}));

const { useAppleSignIn } = await import("../useAppleSignIn.js");
import type { AppleSignInOutcome } from "../useAppleSignIn.js";

function validPluginResult(overrides: Record<string, unknown> = {}) {
  return {
    authorizationCode: "auth-code-123",
    idToken: "id-token-abc",
    user: "001234.sub.1234",
    email: "user@example.com",
    givenName: "Jane",
    familyName: "Appleseed",
    ...overrides,
  };
}

describe("useAppleSignIn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlatform = "ios";
  });

  it("isAvailable is true on iOS", () => {
    mockPlatform = "ios";
    const { result } = renderHook(() => useAppleSignIn());
    expect(result.current.isAvailable).toBe(true);
  });

  it("isAvailable is false on android", () => {
    mockPlatform = "android";
    const { result } = renderHook(() => useAppleSignIn());
    expect(result.current.isAvailable).toBe(false);
  });

  it("isAvailable is false on web", () => {
    mockPlatform = "web";
    const { result } = renderHook(() => useAppleSignIn());
    expect(result.current.isAvailable).toBe(false);
  });

  it("returns 'unavailable' and never calls the plugin when not on iOS", async () => {
    mockPlatform = "android";
    const { result } = renderHook(() => useAppleSignIn());

    let outcome: AppleSignInOutcome | undefined;
    await act(async () => { outcome = await result.current.signIn(); });

    expect(outcome).toEqual({ kind: "unavailable" });
    expect(mockPluginSignIn).not.toHaveBeenCalled();
  });

  it("passes a hashed nonce to the plugin, distinct from what is sent to the backend (no double hash, raw != hashed)", async () => {
    mockPluginSignIn.mockResolvedValue(validPluginResult());
    mockSignInWithApple.mockResolvedValue({ ok: true, session: { accessToken: "t", expiresAt: "x", user: { role: "passenger" } } });

    const { result } = renderHook(() => useAppleSignIn());
    await act(async () => { await result.current.signIn(); });

    const pluginNonce = mockPluginSignIn.mock.calls[0]?.[0]?.nonce as string;
    const backendNonce = mockSignInWithApple.mock.calls[0]?.[0]?.nonce as string;

    expect(pluginNonce).toBeTruthy();
    expect(backendNonce).toBeTruthy();
    expect(pluginNonce).not.toBe(backendNonce);
    expect(pluginNonce).toMatch(/^[0-9a-f]{64}$/);
    expect(backendNonce).toMatch(/^[0-9a-f]{64}$/);
  });

  it("requests email and full name scopes from the plugin", async () => {
    mockPluginSignIn.mockResolvedValue(validPluginResult());
    mockSignInWithApple.mockResolvedValue({ ok: true, session: { accessToken: "t", expiresAt: "x", user: { role: "passenger" } } });

    const { result } = renderHook(() => useAppleSignIn());
    await act(async () => { await result.current.signIn(); });

    expect(mockPluginSignIn.mock.calls[0]?.[0]?.scopes).toEqual(["EMAIL", "FULL_NAME"]);
  });

  it("calls the backend with a valid credential", async () => {
    mockPluginSignIn.mockResolvedValue(validPluginResult());
    mockSignInWithApple.mockResolvedValue({ ok: true, session: { accessToken: "t", expiresAt: "x", user: { role: "passenger" } } });

    const { result } = renderHook(() => useAppleSignIn());
    await act(async () => { await result.current.signIn(); });

    expect(mockSignInWithApple).toHaveBeenCalledTimes(1);
  });

  it("never calls the backend when authorizationCode is missing", async () => {
    mockPluginSignIn.mockResolvedValue(validPluginResult({ authorizationCode: "" }));

    const { result } = renderHook(() => useAppleSignIn());
    let outcome: AppleSignInOutcome | undefined;
    await act(async () => { outcome = await result.current.signIn(); });

    expect(mockSignInWithApple).not.toHaveBeenCalled();
    expect((outcome as { kind: string }).kind).toBe("internal_error");
  });

  it("never calls the backend when idToken is missing", async () => {
    mockPluginSignIn.mockResolvedValue(validPluginResult({ idToken: "" }));

    const { result } = renderHook(() => useAppleSignIn());
    let outcome: AppleSignInOutcome | undefined;
    await act(async () => { outcome = await result.current.signIn(); });

    expect(mockSignInWithApple).not.toHaveBeenCalled();
    expect((outcome as { kind: string }).kind).toBe("internal_error");
  });

  it("sends name when the plugin provides it", async () => {
    mockPluginSignIn.mockResolvedValue(validPluginResult({ givenName: "Jane", familyName: "Appleseed" }));
    mockSignInWithApple.mockResolvedValue({ ok: true, session: { accessToken: "t", expiresAt: "x", user: { role: "passenger" } } });

    const { result } = renderHook(() => useAppleSignIn());
    await act(async () => { await result.current.signIn(); });

    expect(mockSignInWithApple.mock.calls[0]?.[0]?.name).toEqual({ givenName: "Jane", familyName: "Appleseed" });
  });

  it("does not invent a name when the plugin returns none (returning user)", async () => {
    mockPluginSignIn.mockResolvedValue(validPluginResult({ givenName: null, familyName: null }));
    mockSignInWithApple.mockResolvedValue({ ok: true, session: { accessToken: "t", expiresAt: "x", user: { role: "passenger" } } });

    const { result } = renderHook(() => useAppleSignIn());
    await act(async () => { await result.current.signIn(); });

    expect(mockSignInWithApple.mock.calls[0]?.[0]).not.toHaveProperty("name");
  });

  it("never sends email, sub, isPrivateEmail, or any Apple token other than identityToken/authorizationCode", async () => {
    mockPluginSignIn.mockResolvedValue(validPluginResult());
    mockSignInWithApple.mockResolvedValue({ ok: true, session: { accessToken: "t", expiresAt: "x", user: { role: "passenger" } } });

    const { result } = renderHook(() => useAppleSignIn());
    await act(async () => { await result.current.signIn(); });

    const sentPayload = mockSignInWithApple.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(sentPayload).not.toHaveProperty("email");
    expect(sentPayload).not.toHaveProperty("sub");
    expect(sentPayload).not.toHaveProperty("isPrivateEmail");
    expect(sentPayload).not.toHaveProperty("accessToken");
    expect(sentPayload).not.toHaveProperty("refreshToken");
    expect(sentPayload).not.toHaveProperty("clientSecret");
    expect(sentPayload).not.toHaveProperty("privateKey");
    expect(Object.keys(sentPayload).sort()).toEqual(["authorizationCode", "identityToken", "name", "nonce"]);
  });

  it("logs in an existing user without a role in the payload", async () => {
    mockPluginSignIn.mockResolvedValue(validPluginResult({ givenName: null, familyName: null }));
    mockSignInWithApple.mockResolvedValue({ ok: true, session: { accessToken: "t", expiresAt: "x", user: { role: "driver" } } });

    const { result } = renderHook(() => useAppleSignIn());
    let outcome: AppleSignInOutcome | undefined;
    await act(async () => { outcome = await result.current.signIn(); });

    expect(mockSignInWithApple.mock.calls[0]?.[0]).not.toHaveProperty("role");
    expect(outcome).toEqual({ kind: "success", role: "driver" });
  });

  it("enters role_required and keeps credentials in memory when the backend needs a role", async () => {
    mockPluginSignIn.mockResolvedValue(validPluginResult());
    mockSignInWithApple.mockResolvedValue({ ok: false, code: "VALIDATION_ERROR", message: "role is required to create a new account." });

    const { result } = renderHook(() => useAppleSignIn());
    let outcome: AppleSignInOutcome | undefined;
    await act(async () => { outcome = await result.current.signIn(); });

    expect(outcome).toEqual({ kind: "role_required" });
    expect(result.current.awaitingRole).toBe(true);
  });

  it("selecting an allowed role retries and sends exactly that role", async () => {
    mockPluginSignIn.mockResolvedValue(validPluginResult());
    mockSignInWithApple
      .mockResolvedValueOnce({ ok: false, code: "VALIDATION_ERROR", message: "role required" })
      .mockResolvedValueOnce({ ok: true, session: { accessToken: "t", expiresAt: "x", user: { role: "passenger" } } });

    const { result } = renderHook(() => useAppleSignIn());
    await act(async () => { await result.current.signIn(); });

    let outcome: AppleSignInOutcome | undefined;
    await act(async () => { outcome = await result.current.submitRole("passenger"); });

    expect(mockSignInWithApple).toHaveBeenCalledTimes(2);
    expect(mockSignInWithApple.mock.calls[1]?.[0]?.role).toBe("passenger");
    expect(outcome).toEqual({ kind: "success", role: "passenger" });
  });

  it("never allows admin to be sent, even if the UI is manipulated into calling submitRole('admin') — enforced at runtime, not just by the PublicRole type", async () => {
    mockPluginSignIn.mockResolvedValue(validPluginResult());
    mockSignInWithApple.mockResolvedValueOnce({ ok: false, code: "VALIDATION_ERROR", message: "role required" });

    const { result } = renderHook(() => useAppleSignIn());
    await act(async () => { await result.current.signIn(); });
    expect(mockSignInWithApple).toHaveBeenCalledTimes(1);

    let outcome: AppleSignInOutcome | undefined;
    const submitManipulatedRole = result.current.submitRole as unknown as (
      role: string,
    ) => Promise<AppleSignInOutcome>;
    await act(async () => {
      outcome = await submitManipulatedRole("admin");
    });

    // The runtime guard rejects it before ever calling the backend again.
    expect(mockSignInWithApple).toHaveBeenCalledTimes(1);
    expect((outcome as { kind: string }).kind).toBe("internal_error");
  });

  it("clears pending credentials after a successful retry", async () => {
    mockPluginSignIn.mockResolvedValue(validPluginResult());
    mockSignInWithApple
      .mockResolvedValueOnce({ ok: false, code: "VALIDATION_ERROR", message: "role required" })
      .mockResolvedValueOnce({ ok: true, session: { accessToken: "t", expiresAt: "x", user: { role: "passenger" } } });

    const { result } = renderHook(() => useAppleSignIn());
    await act(async () => { await result.current.signIn(); });
    expect(result.current.awaitingRole).toBe(true);

    await act(async () => { await result.current.submitRole("passenger"); });
    expect(result.current.awaitingRole).toBe(false);
  });

  it("cancelRoleSelection discards pending credentials without calling the backend again", async () => {
    mockPluginSignIn.mockResolvedValue(validPluginResult());
    mockSignInWithApple.mockResolvedValueOnce({ ok: false, code: "VALIDATION_ERROR", message: "role required" });

    const { result } = renderHook(() => useAppleSignIn());
    await act(async () => { await result.current.signIn(); });
    expect(result.current.awaitingRole).toBe(true);

    act(() => { result.current.cancelRoleSelection(); });
    expect(result.current.awaitingRole).toBe(false);

    let outcome: AppleSignInOutcome | undefined;
    await act(async () => { outcome = await result.current.submitRole("passenger"); });
    expect(mockSignInWithApple).toHaveBeenCalledTimes(1); // no second call — nothing pending
    expect((outcome as { kind: string }).kind).toBe("internal_error");
  });

  it("treats voluntary cancellation as non-error and clears credentials", async () => {
    mockPluginSignIn.mockRejectedValue({ code: "SIGN_IN_CANCELED" });

    const { result } = renderHook(() => useAppleSignIn());
    let outcome: AppleSignInOutcome | undefined;
    await act(async () => { outcome = await result.current.signIn(); });

    expect(outcome).toEqual({ kind: "cancelled" });
    expect(mockSignInWithApple).not.toHaveBeenCalled();
    expect(result.current.awaitingRole).toBe(false);
  });

  it("maps a network/timeout backend error", async () => {
    mockPluginSignIn.mockResolvedValue(validPluginResult());
    mockSignInWithApple.mockResolvedValue({ ok: false, code: "NETWORK_ERROR", message: "Network request failed." });

    const { result } = renderHook(() => useAppleSignIn());
    let outcome: AppleSignInOutcome | undefined;
    await act(async () => { outcome = await result.current.signIn(); });

    expect((outcome as { kind: string }).kind).toBe("network_error");
  });

  it("maps an invalid-credential (401-class) backend error", async () => {
    mockPluginSignIn.mockResolvedValue(validPluginResult());
    mockSignInWithApple.mockResolvedValue({ ok: false, code: "AUTH_APPLE_TOKEN_INVALID", message: "Apple identity token failed verification." });

    const { result } = renderHook(() => useAppleSignIn());
    let outcome: AppleSignInOutcome | undefined;
    await act(async () => { outcome = await result.current.signIn(); });

    expect((outcome as { kind: string }).kind).toBe("invalid_credential");
  });

  it("maps a suspended-account (403) backend error", async () => {
    mockPluginSignIn.mockResolvedValue(validPluginResult());
    mockSignInWithApple.mockResolvedValue({ ok: false, code: "AUTH_ACCOUNT_SUSPENDED", message: "Account is suspended." });

    const { result } = renderHook(() => useAppleSignIn());
    let outcome: AppleSignInOutcome | undefined;
    await act(async () => { outcome = await result.current.signIn(); });

    expect((outcome as { kind: string }).kind).toBe("suspended");
  });

  it("maps AUTH_APPLE_ACCOUNT_LINKING_REQUIRED (409) without retry credentials", async () => {
    mockPluginSignIn.mockResolvedValue(validPluginResult());
    mockSignInWithApple.mockResolvedValue({ ok: false, code: "AUTH_APPLE_ACCOUNT_LINKING_REQUIRED", message: "An account with this email already exists." });

    const { result } = renderHook(() => useAppleSignIn());
    let outcome: AppleSignInOutcome | undefined;
    await act(async () => { outcome = await result.current.signIn(); });

    expect((outcome as { kind: string }).kind).toBe("linking_required");
    expect(result.current.awaitingRole).toBe(false);
  });

  it("does not double-submit while a sign-in is already loading", async () => {
    let resolveSignIn: (v: unknown) => void = () => {};
    mockPluginSignIn.mockReturnValue(new Promise((resolve) => { resolveSignIn = resolve; }));
    mockSignInWithApple.mockResolvedValue({ ok: true, session: { accessToken: "t", expiresAt: "x", user: { role: "passenger" } } });

    const { result } = renderHook(() => useAppleSignIn());

    let firstCallPromise!: Promise<{ kind: string }>;
    act(() => { firstCallPromise = result.current.signIn(); });

    // Let the first call's synchronous state update (setLoading(true)) commit
    // before attempting the second call.
    await act(async () => { await Promise.resolve(); });
    expect(result.current.loading).toBe(true);

    const secondOutcome = await result.current.signIn();
    expect(secondOutcome.kind).toBe("internal_error");

    resolveSignIn(validPluginResult());
    const firstOutcome = await act(async () => firstCallPromise);
    expect(firstOutcome.kind).toBe("success");
    // Exactly one real attempt reached the native plugin — the second call
    // was rejected before ever touching it.
    expect(mockPluginSignIn).toHaveBeenCalledTimes(1);
  });

  it("never logs the nonce or tokens to the console", async () => {
    const logSpy  = vi.spyOn(console, "log").mockImplementation(() => {});
    const errSpy  = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    mockPluginSignIn.mockResolvedValue(validPluginResult({ idToken: "super-secret-id-token", authorizationCode: "super-secret-auth-code" }));
    mockSignInWithApple.mockResolvedValue({ ok: true, session: { accessToken: "t", expiresAt: "x", user: { role: "passenger" } } });

    const { result } = renderHook(() => useAppleSignIn());
    await act(async () => { await result.current.signIn(); });

    const allLoggedText = [...logSpy.mock.calls, ...errSpy.mock.calls, ...warnSpy.mock.calls]
      .flat()
      .map((v) => (typeof v === "string" ? v : JSON.stringify(v)))
      .join(" ");

    expect(allLoggedText).not.toContain("super-secret-id-token");
    expect(allLoggedText).not.toContain("super-secret-auth-code");

    logSpy.mockRestore();
    errSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
