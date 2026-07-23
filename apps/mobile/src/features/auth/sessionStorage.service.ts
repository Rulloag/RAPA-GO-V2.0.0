import { SecureStorage } from "@aparajita/capacitor-secure-storage";
import type { UserRole } from "@rapa-go/shared";
import type { AuthSession } from "./auth.types.js";

const SESSION_KEY = "rapa_go_session";
const REFRESH_KEY = "rapa_go_refresh_token";
const VALID_ROLES = new Set<UserRole>([
  "passenger",
  "driver",
  "guide",
  "rental_operator",
  "admin",
]);

export interface PersistedSession {
  accessToken: string;
  expiresAt: string;
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl: string | null;
  isVerified: boolean;
}

function isPersistedSession(value: unknown): value is PersistedSession {
  if (!value || typeof value !== "object") return false;

  const record = value as Record<string, unknown>;
  const expiresAtMs = Date.parse(String(record.expiresAt ?? ""));

  return (
    typeof record.accessToken === "string" &&
    record.accessToken.length >= 32 &&
    typeof record.userId === "string" &&
    record.userId.length > 0 &&
    typeof record.email === "string" &&
    record.email.includes("@") &&
    typeof record.name === "string" &&
    record.name.length > 0 &&
    typeof record.role === "string" &&
    VALID_ROLES.has(record.role as UserRole) &&
    typeof record.isVerified === "boolean" &&
    Number.isFinite(expiresAtMs)
  );
}

class SessionStorageService {
  async saveSession(session: AuthSession, refreshToken?: string): Promise<void> {
    const persisted: PersistedSession = {
      accessToken: session.accessToken,
      expiresAt: session.expiresAt,
      userId: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
      avatarUrl: session.user.avatarUrl,
      isVerified: session.user.isVerified,
    };

    await SecureStorage.set(SESSION_KEY, JSON.stringify(persisted));
    if (refreshToken) {
      await SecureStorage.set(REFRESH_KEY, refreshToken);
    }
  }

  async loadSession(): Promise<PersistedSession | null> {
    try {
      const raw = await SecureStorage.get(SESSION_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(String(raw)) as unknown;

      if (!isPersistedSession(parsed)) {
        await this.clearSession();
        return null;
      }

      if (Date.parse(parsed.expiresAt) <= Date.now()) {
        await this.clearSession();
        return null;
      }

      return parsed;
    } catch {
      await this.clearSession();
      return null;
    }
  }

  async loadRefreshToken(): Promise<string | null> {
    try {
      const raw = await SecureStorage.get(REFRESH_KEY);
      return raw ? (raw as string) : null;
    } catch {
      return null;
    }
  }

  async clearSession(): Promise<void> {
    await Promise.allSettled([
      SecureStorage.remove(SESSION_KEY),
      SecureStorage.remove(REFRESH_KEY),
    ]);
  }
}

export const sessionStorageService = new SessionStorageService();
