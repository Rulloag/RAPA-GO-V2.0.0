import { eq, and, isNull, gt } from "drizzle-orm";
import { db } from "../../db/client.js";
import { authSessions, refreshTokens, users } from "../../db/schema/index.js";
import { AppError } from "../../shared/errors/AppError.js";

/**
 * Cuánto tiempo después de rotarlo se sigue aceptando un refresh token.
 *
 * Cubre el caso en que el servidor completó la rotación pero la respuesta no
 * llegó al cliente (app en segundo plano, red intermitente). Se mantiene corta
 * a propósito: fuera de ella, presentar un token ya rotado se trata como robo.
 */
const REFRESH_TOKEN_REUSE_GRACE_MS = 60_000;

export type ConsumeRefreshTokenResult =
  /** Token válido y sin usar: rotación normal. */
  | { outcome: "consumed"; id: string; userId: string }
  /** Ya rotado hace muy poco: se asume respuesta perdida, se permite. */
  | { outcome: "grace"; id: string; userId: string }
  /** Ya rotado hace rato: reutilización sospechosa, revocar todo. */
  | { outcome: "reuse"; id: string; userId: string }
  /** Desconocido, caducado o nunca emitido. */
  | { outcome: "unknown" };

/**
 * SessionService — manages auth_sessions and refresh_tokens in the database.
 *
 * SECURITY: only hashes of tokens are stored. Raw tokens are never persisted.
 */
export class SessionService {
  async createSession(opts: {
    userId: string;
    accessTokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    try {
      await db.insert(authSessions).values({
        userId:          opts.userId,
        accessTokenHash: opts.accessTokenHash,
        expiresAt:       opts.expiresAt,
      });
    } catch (err) {
      throw AppError.internal(`Failed to create auth session: ${String(err)}`);
    }
  }

  async createRefreshToken(opts: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    rotatedFromTokenId?: string;
  }): Promise<void> {
    try {
      const values: typeof refreshTokens.$inferInsert = {
        userId:    opts.userId,
        tokenHash: opts.tokenHash,
        expiresAt: opts.expiresAt,
      };
      if (opts.rotatedFromTokenId !== undefined) {
        values.rotatedFromTokenId = opts.rotatedFromTokenId;
      }
      await db.insert(refreshTokens).values(values);
    } catch (err) {
      throw AppError.internal(`Failed to create refresh token: ${String(err)}`);
    }
  }

  async revokeSessionByTokenHash(accessTokenHash: string): Promise<void> {
    try {
      await db
        .update(authSessions)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(authSessions.accessTokenHash, accessTokenHash),
            isNull(authSessions.revokedAt),
          ),
        );
    } catch (err) {
      throw AppError.internal(`Failed to revoke session: ${String(err)}`);
    }
  }

  async isSessionValid(accessTokenHash: string): Promise<boolean> {
    try {
      const rows = await db
        .select({ id: authSessions.id })
        .from(authSessions)
        .innerJoin(users, eq(authSessions.userId, users.id))
        .where(
          and(
            eq(authSessions.accessTokenHash, accessTokenHash),
            isNull(authSessions.revokedAt),
            gt(authSessions.expiresAt, new Date()),
            eq(users.status, "active"),
          ),
        )
        .limit(1);
      return rows.length > 0;
    } catch (err) {
      throw AppError.internal(`Failed to validate session: ${String(err)}`);
    }
  }


  async consumeRefreshToken(
    tokenHash: string,
  ): Promise<ConsumeRefreshTokenResult> {
    const now = new Date();

    try {
      return await db.transaction(async (tx) => {
        const [consumed] = await tx
          .update(refreshTokens)
          .set({ revokedAt: now })
          .where(
            and(
              eq(refreshTokens.tokenHash, tokenHash),
              isNull(refreshTokens.revokedAt),
              gt(refreshTokens.expiresAt, now),
            ),
          )
          .returning({
            id: refreshTokens.id,
            userId: refreshTokens.userId,
          });

        if (consumed) {
          return { outcome: "consumed", ...consumed } as const;
        }

        /**
         * VENTANA DE GRACIA — la parte que arreglaba el "me fui a WhatsApp y
         * volví sin sesión".
         *
         * La rotación es de un solo uso: el servidor revoca el token en el
         * mismo UPDATE con el que lo lee. Si la respuesta no llega al teléfono
         * (que es exactamente lo que pasa al pasar la app a segundo plano: la
         * WebView se congela, la radio se corta, el timeout de 25 s se dispara
         * al volver), el servidor ya rotó pero el cliente sigue guardando el
         * token viejo. Sin esta ventana, el siguiente intento devolvía
         * AUTH_REFRESH_TOKEN_INVALID y la sesión moría de forma definitiva:
         * el usuario tenía que volver a iniciar sesión a mano.
         *
         * Aquí se distingue ese caso del robo real por el tiempo transcurrido
         * desde la revocación:
         *  - dentro de la ventana → reintento legítimo de una rotación cuya
         *    respuesta se perdió; se permite emitir un par nuevo.
         *  - fuera de la ventana → reutilización de un token ya rotado, que es
         *    la señal clásica de token robado (OAuth 2.0 BCP): se revoca TODA
         *    la sesión del usuario.
         */
        const [previouslyRotated] = await tx
          .select({
            id: refreshTokens.id,
            userId: refreshTokens.userId,
            revokedAt: refreshTokens.revokedAt,
            expiresAt: refreshTokens.expiresAt,
          })
          .from(refreshTokens)
          .where(eq(refreshTokens.tokenHash, tokenHash))
          .limit(1);

        if (!previouslyRotated?.revokedAt) {
          return { outcome: "unknown" } as const;
        }

        if (previouslyRotated.expiresAt.getTime() <= now.getTime()) {
          return { outcome: "unknown" } as const;
        }

        const revokedAgoMs =
          now.getTime() - previouslyRotated.revokedAt.getTime();

        if (revokedAgoMs <= REFRESH_TOKEN_REUSE_GRACE_MS) {
          return {
            outcome: "grace",
            id: previouslyRotated.id,
            userId: previouslyRotated.userId,
          } as const;
        }

        return {
          outcome: "reuse",
          id: previouslyRotated.id,
          userId: previouslyRotated.userId,
        } as const;
      });
    } catch (err) {
      throw AppError.internal(
        `Failed to consume refresh token: ${String(err)}`,
      );
    }
  }

  async revokeAllForUser(userId: string): Promise<void> {
    const now = new Date();

    try {
      await db.transaction(async (tx) => {
        await tx
          .update(authSessions)
          .set({ revokedAt: now })
          .where(
            and(
              eq(authSessions.userId, userId),
              isNull(authSessions.revokedAt),
            ),
          );

        await tx
          .update(refreshTokens)
          .set({ revokedAt: now })
          .where(
            and(
              eq(refreshTokens.userId, userId),
              isNull(refreshTokens.revokedAt),
            ),
          );
      });
    } catch (err) {
      throw AppError.internal(
        `Failed to revoke all user sessions: ${String(err)}`,
      );
    }
  }

}
