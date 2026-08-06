import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { users } from "../../db/schema/index.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { User, CreateUserInput, UpdateProfileInput, UserStatus } from "./users.types.js";

/**
 * UsersRepository — all PostgreSQL access for the users table.
 * No business logic here; that belongs in UsersService.
 */
export class UsersRepository {
  async findById(id: string): Promise<User | null> {
    try {
      const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(`Failed to query user by id: ${String(err)}`);
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    try {
      const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(`Failed to query user by email: ${String(err)}`);
    }
  }

  async createUser(input: CreateUserInput): Promise<User> {
    try {
      const rows = await db
        .insert(users)
        .values({
          email:     input.email,
          name:      input.name,
          role:      input.role,
          status:    input.status ?? "pending",
          avatarUrl: input.avatarUrl ?? null,
        })
        .returning();

      const created = rows[0];
      if (!created) throw AppError.internal("Insert returned no rows.");
      return created;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to create user: ${String(err)}`);
    }
  }

  async updateUserStatus(userId: string, status: UserStatus): Promise<User> {
    try {
      const rows = await db
        .update(users)
        .set({ status, updatedAt: new Date() })
        .where(eq(users.id, userId))
        .returning();

      const updated = rows[0];
      if (!updated) throw AppError.notFound(`User ${userId} not found.`);
      return updated;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to update user status: ${String(err)}`);
    }
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<User> {
    try {
      // Build update set only with provided fields to avoid overwriting with undefined
      const set: Record<string, unknown> = { updatedAt: new Date() };
      if ("avatarUrl" in input) set["avatarUrl"] = input.avatarUrl;

      const rows = await db
        .update(users)
        .set(set)
        .where(eq(users.id, userId))
        .returning();

      const updated = rows[0];
      if (!updated) throw AppError.notFound(`User ${userId} not found.`);
      return updated;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to update profile: ${String(err)}`);
    }
  }

  async markUserVerified(userId: string): Promise<User> {
    try {
      const rows = await db
        .update(users)
        .set({ isVerified: true, updatedAt: new Date() })
        .where(eq(users.id, userId))
        .returning();

      const updated = rows[0];
      if (!updated) throw AppError.notFound(`User ${userId} not found.`);
      return updated;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to mark user verified: ${String(err)}`);
    }
  }
}
