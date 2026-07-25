import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";

const mockSignInWithApple = vi.fn();
const mockSaveSession = vi.fn();
const mockLoadSession = vi.fn().mockResolvedValue(null);

vi.mock("../auth.service.js", () => ({
  authService: {
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    me: vi.fn(),
    refresh: vi.fn(),
    signInWithApple: mockSignInWithApple,
  },
}));

vi.mock("../sessionStorage.service.js", () => ({
  sessionStorageService: {
    saveSession: mockSaveSession,
    loadSession: mockLoadSession,
    loadRefreshToken: vi.fn().mockResolvedValue(null),
    clearSession: vi.fn(),
  },
}));

const { AuthProvider } = await import("../AuthProvider.js");
const { useAuth } = await import("../useAuth.js");

function wrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter>
      <AuthProvider>{children}</AuthProvider>
    </MemoryRouter>
  );
}

describe("AuthProvider.signInWithApple", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadSession.mockResolvedValue(null);
  });

  it("persists the Rapa Go session via the existing sessionStorageService flow on success", async () => {
    const session = { accessToken: "rapago-access", expiresAt: "2099-01-01T00:00:00.000Z", user: { id: "u1", email: "a@b.com", name: "A", role: "passenger", avatarUrl: null, isVerified: true } };
    mockSignInWithApple.mockResolvedValue({ ok: true, session, refreshToken: "rapago-refresh" });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => { await Promise.resolve(); }); // let initial session-restore effect settle

    await act(async () => {
      await result.current.signInWithApple({ identityToken: "x", authorizationCode: "y", nonce: "z" });
    });

    expect(mockSaveSession).toHaveBeenCalledWith(session, "rapago-refresh");
    expect(result.current.status).toBe("authenticated");
    expect(result.current.user?.id).toBe("u1");
  });

  it("never persists anything Apple-specific — only the standard AuthSession shape reaches storage", async () => {
    const session = { accessToken: "rapago-access", expiresAt: "2099-01-01T00:00:00.000Z", user: { id: "u1", email: "a@b.com", name: "A", role: "passenger", avatarUrl: null, isVerified: true } };
    mockSignInWithApple.mockResolvedValue({ ok: true, session, refreshToken: "rapago-refresh" });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => { await Promise.resolve(); });

    await act(async () => {
      await result.current.signInWithApple({ identityToken: "apple-identity-token", authorizationCode: "apple-auth-code", nonce: "z" });
    });

    const persisted = mockSaveSession.mock.calls[0]?.[0] as Record<string, unknown>;
    const serialized = JSON.stringify(persisted);
    expect(serialized).not.toContain("apple-identity-token");
    expect(serialized).not.toContain("apple-auth-code");
    expect(Object.keys(persisted).sort()).toEqual(["accessToken", "expiresAt", "user"]);
  });

  it("does not persist a session when the backend rejects the sign-in", async () => {
    mockSignInWithApple.mockResolvedValue({ ok: false, code: "AUTH_APPLE_TOKEN_INVALID", message: "invalid" });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => { await Promise.resolve(); });

    await act(async () => {
      await result.current.signInWithApple({ identityToken: "x", authorizationCode: "y", nonce: "z" });
    });

    expect(mockSaveSession).not.toHaveBeenCalled();
    expect(result.current.status).toBe("unauthenticated");
  });
});
