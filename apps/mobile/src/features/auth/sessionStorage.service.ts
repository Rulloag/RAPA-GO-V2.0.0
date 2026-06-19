import { SecureStorage } from "@aparajita/capacitor-secure-storage";
import type { AuthSession } from "./auth.types.js";

const SESSION_KEY = "rapa_go_session";

export interface PersistedSession {
  accessToken: string;
  expiresAt: string;
  userId: string;
  email: string;
  name: string;
  role: string;
  avatarUrl: string | null;
  isVerified: boolean;
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

      const persisted = JSON.parse(raw as string) as PersistedSession;

      // No cerrar sesión automáticamente por expiresAt.
      return persisted;
    } catch {
      return null;
    }
  }

  async clearSession(): Promise<void> {
    try {
      await SecureStorage.remove(SESSION_KEY);
    } catch {
      // ignore
    }
  }
}

export const sessionStorageService = new SessionStorageService();