import {
  and,
  eq,
  gt,
  isNull,
} from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  authCredentials,
  authSessions,
  passwordResetTokens,
  refreshTokens,
} from "../../db/schema/index.js";
import { AppError } from "../../shared/errors/AppError.js";

export class PasswordResetRepository {
  async hasRecentActiveRequest(
    userId: string,
    since: Date,
  ): Promise<boolean> {
    try {
      const rows = await db
        .select({ id: passwordResetTokens.id })
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.userId, userId),
            isNull(passwordResetTokens.usedAt),
            isNull(passwordResetTokens.revokedAt),
            gt(passwordResetTokens.expiresAt, new Date()),
            gt(passwordResetTokens.createdAt, since),
          ),
        )
        .limit(1);

      return rows.length > 0;
    } catch (error) {
      throw AppError.internal(
        `Failed to check password reset requests: ${String(error)}`,
      );
    }
  }

  async create(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    requestIp?: string | null;
    requestUserAgent?: string | null;
  }): Promise<void> {
    try {
      await db.insert(passwordResetTokens).values({
        userId: input.userId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        requestIp: input.requestIp ?? null,
        requestUserAgent: input.requestUserAgent ?? null,
      });
    } catch (error) {
      throw AppError.internal(
        `Failed to create password reset token: ${String(error)}`,
      );
    }
  }

  async revokeByTokenHash(tokenHash: string): Promise<void> {
    try {
      await db
        .update(passwordResetTokens)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(passwordResetTokens.tokenHash, tokenHash),
            isNull(passwordResetTokens.usedAt),
            isNull(passwordResetTokens.revokedAt),
          ),
        );
    } catch (error) {
      throw AppError.internal(
        `Failed to revoke password reset token: ${String(error)}`,
      );
    }
  }

  /**
   * Atomically consumes a valid token, updates the password and revokes
   * every existing access/refresh session for the account.
   *
   * Returning null means the token is invalid, expired, used or revoked.
   */
  async consumeAndResetPassword(input: {
    tokenHash: string;
    passwordHash: string;
  }): Promise<string | null> {
    try {
      return await db.transaction(async (tx) => {
        const now = new Date();

        const consumedRows = await tx
          .update(passwordResetTokens)
          .set({ usedAt: now })
          .where(
            and(
              eq(passwordResetTokens.tokenHash, input.tokenHash),
              isNull(passwordResetTokens.usedAt),
              isNull(passwordResetTokens.revokedAt),
              gt(passwordResetTokens.expiresAt, now),
            ),
          )
          .returning({
            userId: passwordResetTokens.userId,
          });

        const consumed = consumedRows[0];

        if (!consumed) {
          return null;
        }

        const credentialsRows = await tx
          .update(authCredentials)
          .set({
            passwordHash: input.passwordHash,
            passwordUpdatedAt: now,
            failedLoginAttempts: 0,
            lockedUntil: null,
            updatedAt: now,
          })
          .where(eq(authCredentials.userId, consumed.userId))
          .returning({
            userId: authCredentials.userId,
          });

        if (!credentialsRows[0]) {
          throw AppError.internal(
            "Password reset token belongs to an account without password credentials.",
          );
        }

        await tx
          .update(authSessions)
          .set({ revokedAt: now })
          .where(
            and(
              eq(authSessions.userId, consumed.userId),
              isNull(authSessions.revokedAt),
            ),
          );

        await tx
          .update(refreshTokens)
          .set({ revokedAt: now })
          .where(
            and(
              eq(refreshTokens.userId, consumed.userId),
              isNull(refreshTokens.revokedAt),
            ),
          );

        // After one successful reset, every other outstanding link is invalid.
        await tx
          .update(passwordResetTokens)
          .set({ revokedAt: now })
          .where(
            and(
              eq(passwordResetTokens.userId, consumed.userId),
              isNull(passwordResetTokens.usedAt),
              isNull(passwordResetTokens.revokedAt),
            ),
          );

        return consumed.userId;
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw AppError.internal(
        `Failed to reset password transactionally: ${String(error)}`,
      );
    }
  }
}
