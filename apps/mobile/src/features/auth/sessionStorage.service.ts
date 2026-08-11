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

    /**
     * El refresh token se guarda ANTES que la sesión, a propósito.
     *
     * Son dos escrituras separadas al almacén nativo y el sistema puede matar
     * el proceso entre ambas — justo lo que pasa al pasar la app a segundo
     * plano. El orden decide cuál de los dos estados a medias queda:
     *
     *  - Sesión primero (como estaba): queda el access token NUEVO junto al
     *    refresh token VIEJO, que el servidor ya revocó al rotarlo. Cuando el
     *    access token caduque no habrá con qué renovar: sesión perdida sin
     *    remedio.
     *  - Refresh primero (ahora): queda el refresh token NUEVO junto al access
     *    token viejo. El viejo falla, se renueva con el nuevo y todo sigue.
     *
     * El estado a medias deja de ser terminal y pasa a ser recuperable.
     */
    if (refreshToken) {
      await SecureStorage.set(REFRESH_KEY, refreshToken);
    }
    await SecureStorage.set(SESSION_KEY, JSON.stringify(persisted));
  }

  async loadSession(): Promise<PersistedSession | null> {
    let raw: unknown;

    try {
      raw = await SecureStorage.get(SESSION_KEY);
    } catch {
      /**
       * Un error AL LEER no es una sesión inválida.
       *
       * Antes este catch borraba las dos claves, y con ellas el refresh token
       * de 30 días. Pero el almacén nativo lanza excepción en situaciones
       * pasajeras y perfectamente normales — por ejemplo, leer con el
       * dispositivo bloqueado (el acceso al llavero es `whenUnlocked`), que es
       * justo lo que ocurre cuando la app despierta en segundo plano. Un fallo
       * de lectura destruía una sesión que era completamente válida.
       *
       * Ahora no se borra nada: se informa de que no se pudo leer y el
       * siguiente intento lo resuelve.
       */
      return null;
    }

    if (!raw) return null;

    try {
      const parsed = JSON.parse(String(raw)) as unknown;

      if (!isPersistedSession(parsed)) {
        // Contenido corrupto o de un formato antiguo: esto sí es irrecuperable.
        await this.clearSession();
        return null;
      }

      // La expiración del access token no elimina el refresh token.
      // AuthProvider decide si renueva la sesión o si realmente debe cerrarla.
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
