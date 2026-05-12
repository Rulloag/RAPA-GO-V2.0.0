import { eq, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import { authCredentials } from "../../db/schema/index.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { AuthCredentials } from "../../db/schema/index.js";

/**
 * AuthCredentialsRepository — all DB access for auth_credentials.
 *
 * SECURITY: this repository must never be imported outside the auth module.
 * Hashes must not appear in any HTTP response or log output.
 */
export class AuthCredentialsRepository {
  async findByUserId(userId: string): Promise<AuthCredentials | null> {
    try {
      const rows = await db
        .select()
        .from(authCredentials)
        .where(eq(authCredentials.userId, userId))
        .limit(1);
      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(`Failed to query auth credentials: ${String(err)}`);
    }
  }

  async createForUser(userId: string, passwordHash: string): Promise<AuthCredentials> {
    try {
      const rows = await db
        .insert(authCredentials)
        .values({ userId, passwordHash })
        .returning();

      const created = rows[0];
      if (!created) throw AppError.internal("Credentials insert returned no rows.");
      return created;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to create auth credentials: ${String(err)}`);
    }
  }

  async updatePassword(userId: string, passwordHash: string): Promise<AuthCredentials> {
    try {
      const rows = await db
        .update(authCredentials)
        .set({
          passwordHash,
          passwordUpdatedAt: new Date(),
          failedLoginAttempts: 0,
          updatedAt: new Date(),
        })
        .where(eq(authCredentials.userId, userId))
        .returning();

      const updated = rows[0];
      if (!updated) throw AppError.notFound(`Credentials for user ${userId} not found.`);
      return updated;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to update password: ${String(err)}`);
    }
  }

  async incrementFailedAttempts(userId: string): Promise<AuthCredentials> {
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
      if (!updated) throw AppError.notFound(`Credentials for user ${userId} not found.`);
      return updated;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to increment failed attempts: ${String(err)}`);
    }
  }

  async resetFailedAttempts(userId: string): Promise<AuthCredentials> {
    try {
      const rows = await db
        .update(authCredentials)
        .set({
          failedLoginAttempts: 0,
          lockedUntil: null,
          updatedAt: new Date(),
        })
        .where(eq(authCredentials.userId, userId))
        .returning();

      const updated = rows[0];
      if (!updated) throw AppError.notFound(`Credentials for user ${userId} not found.`);
      return updated;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to reset failed attempts: ${String(err)}`);
    }
  }

  async lockUntil(userId: string, until: Date): Promise<AuthCredentials> {
    try {
      const rows = await db
        .update(authCredentials)
        .set({ lockedUntil: until, updatedAt: new Date() })
        .where(eq(authCredentials.userId, userId))
        .returning();

      const updated = rows[0];
      if (!updated) throw AppError.notFound(`Credentials for user ${userId} not found.`);
      return updated;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to lock account: ${String(err)}`);
    }
  }
}
