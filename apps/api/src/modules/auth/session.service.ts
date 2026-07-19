import { eq, and, isNull, gt } from "drizzle-orm";
import { db } from "../../db/client.js";
import { authSessions, refreshTokens } from "../../db/schema/index.js";
import { AppError } from "../../shared/errors/AppError.js";

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
        .where(
          and(
            eq(authSessions.accessTokenHash, accessTokenHash),
            isNull(authSessions.revokedAt),
            gt(authSessions.expiresAt, new Date()),
          ),
        )
        .limit(1);
      return rows.length > 0;
    } catch (err) {
      throw AppError.internal(`Failed to validate session: ${String(err)}`);
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
