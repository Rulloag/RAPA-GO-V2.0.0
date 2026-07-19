import { SecureStorage } from "@aparajita/capacitor-secure-storage";
import type { UserRole } from "@rapa-go/shared";
import type { AuthSession } from "./auth.types.js";

const SESSION_KEY = "rapa_go_session";
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
  async saveSession(session: AuthSession): Promise<void> {
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

  async clearSession(): Promise<void> {
    try {
      await SecureStorage.remove(SESSION_KEY);
    } catch {
      // No bloquea el cierre local.
    }
  }
}

export const sessionStorageService = new SessionStorageService();
