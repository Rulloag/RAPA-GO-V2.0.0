import type { AuthSession } from "./auth.types.js";

/**
 * SessionStorageService — abstraction layer for auth session persistence.
 *
 * CURRENT IMPLEMENTATION: memory-only.
 * Tokens are NOT persisted across app restarts.
 *
 * WHY NOT PERSISTED YET:
 *  - @capacitor/preferences uses NSUserDefaults (iOS) / SharedPreferences (Android),
 *    both store data in plain text — NOT safe for JWT access tokens.
 *  - A secure implementation requires Keychain (iOS) / Keystore (Android) access
 *    via a native Capacitor plugin.
 *
 * TODO(phase-secure-storage): Install one of the following when native build is ready:
 *  Option A — Community plugin (free):
 *    npm install @capacitor-community/secure-storage
 *    npx cap sync
 *    Replace this implementation with SecureStoragePlugin.get/set/remove
 *
 *  Option B — Ionic Enterprise (paid, most complete):
 *    @ionic-enterprise/identity-vault
 *    Provides biometric auth, auto-lock, secure enclave integration.
 *
 *  Whichever is chosen: store ONLY the access token and its expiry.
 *  NEVER store the raw refresh token in client storage.
 *
 * SECURITY INVARIANTS (must hold for any future implementation):
 *  1. Never use localStorage or sessionStorage.
 *  2. Never store tokens in @capacitor/preferences (plain text).
 *  3. Only store the minimum needed: accessToken + expiresAt + user metadata.
 *  4. Clear immediately on logout.
 *  5. Validate expiry on load — discard if expired.
 */

export interface PersistedSession {
  accessToken: string;
  expiresAt:   string;    // ISO 8601
  userId:      string;
  email:       string;
  name:        string;
  role:        string;
  avatarUrl:   string | null;
  isVerified:  boolean;
}

class SessionStorageService {
  /** In-memory slot — cleared on page reload or app restart. */
  private memorySlot: PersistedSession | null = null;

  async saveSession(session: AuthSession): Promise<void> {
    const persisted: PersistedSession = {
      accessToken: session.accessToken,
      expiresAt:   session.expiresAt,
      userId:      session.user.id,
      email:       session.user.email,
      name:        session.user.name,
      role:        session.user.role,
      avatarUrl:   session.user.avatarUrl,
      isVerified:  session.user.isVerified,
    };
    this.memorySlot = persisted;
    // TODO(phase-secure-storage): await SecureStoragePlugin.set({ key: "session", value: JSON.stringify(persisted) });
  }

  async loadSession(): Promise<PersistedSession | null> {
    // TODO(phase-secure-storage):
    //   const raw = await SecureStoragePlugin.get({ key: "session" });
    //   if (!raw.value) return null;
    //   const persisted: PersistedSession = JSON.parse(raw.value);
    //   if (new Date(persisted.expiresAt) <= new Date()) {
    //     await this.clearSession();
    //     return null;
    //   }
    //   return persisted;

    if (!this.memorySlot) return null;
    // Discard if token already expired
    if (new Date(this.memorySlot.expiresAt) <= new Date()) {
      this.memorySlot = null;
      return null;
    }
    return this.memorySlot;
  }

  async clearSession(): Promise<void> {
    this.memorySlot = null;
    // TODO(phase-secure-storage): await SecureStoragePlugin.remove({ key: "session" });
  }
}

export const sessionStorageService = new SessionStorageService();
