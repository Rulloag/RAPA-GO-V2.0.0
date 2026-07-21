import { eq, sql } from "drizzle-orm";

import { db } from "../../db/client.js";
import { authCredentials } from "../../db/schema/index.js";
import { AppError } from "../../shared/errors/AppError.js";

export class AuthCredentialsRepository {
  async findByUserId(
    userId: string,
  ): Promise<typeof authCredentials.$inferSelect | null> {
    try {
      const rows = await db
        .select()
        .from(authCredentials)
        .where(eq(authCredentials.userId, userId))
        .limit(1);

      return rows[0] ?? null;
    } catch (error) {
      throw AppError.internal(
        `Failed to load auth credentials: ${String(error)}`,
      );
    }
  }

  async createForUser(
    userId: string,
    passwordHash: string,
  ): Promise<typeof authCredentials.$inferSelect> {
    try {
      const now = new Date();
      const rows = await db
        .insert(authCredentials)
        .values({
          userId,
          passwordHash,
          passwordUpdatedAt: now,
          failedLoginAttempts: 0,
          lockedUntil: null,
          updatedAt: now,
        })
        .returning();

      const created = rows[0];
      if (!created) {
        throw AppError.internal(
          "Auth credential insert returned no rows.",
        );
      }

      return created;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.internal(
        `Failed to create auth credentials: ${String(error)}`,
      );
    }
  }

  async incrementFailedAttempts(
    userId: string,
  ): Promise<typeof authCredentials.$inferSelect> {
    try {
      const rows = await db
        .update(authCredentials)
        .set({
          failedLoginAttempts: sql`${authCredentials.failedLoginAttempts} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(authCredentials.userId, userId))
        .returning();

      const updated = rows[0];
      if (!updated) {
        throw AppError.internal(
          "Auth credentials were not found while recording a failed login.",
        );
      }

      return updated;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.internal(
        `Failed to update login attempts: ${String(error)}`,
      );
    }
  }

  async resetFailedAttempts(userId: string): Promise<void> {
    try {
      await db
        .update(authCredentials)
        .set({
          failedLoginAttempts: 0,
          lockedUntil: null,
          updatedAt: new Date(),
        })
        .where(eq(authCredentials.userId, userId));
    } catch (error) {
      throw AppError.internal(
        `Failed to reset login attempts: ${String(error)}`,
      );
    }
  }

  async lockUntil(userId: string, until: Date): Promise<void> {
    try {
      await db
        .update(authCredentials)
        .set({
          lockedUntil: until,
          updatedAt: new Date(),
        })
        .where(eq(authCredentials.userId, userId));
    } catch (error) {
      throw AppError.internal(
        `Failed to lock auth credentials: ${String(error)}`,
      );
    }
  }

  async updatePassword(
    userId: string,
    passwordHash: string,
  ): Promise<void> {
    try {
      const now = new Date();
      const rows = await db
        .update(authCredentials)
        .set({
          passwordHash,
          passwordUpdatedAt: now,
          failedLoginAttempts: 0,
          lockedUntil: null,
          updatedAt: now,
        })
        .where(eq(authCredentials.userId, userId))
        .returning({ id: authCredentials.id });

      if (!rows[0]) {
        throw AppError.internal(
          "Auth credentials were not found while updating the password.",
        );
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.internal(
        `Failed to update auth password: ${String(error)}`,
      );
    }
  }
}
