import { db } from "../../db/client.js";
import { users } from "../../db/schema/index.js";
import { eq, and, or, ilike, type SQL } from "drizzle-orm";
import { AppError } from "../../shared/errors/AppError.js";
import type { User } from "../users/users.types.js";

export interface ListUsersFilter {
  role?:   string | undefined;
  status?: string | undefined;
  search?: string | undefined;
}

export class AdminRepository {
  async listUsers(filter: ListUsersFilter): Promise<User[]> {
    try {
      const conditions: SQL[] = [];

      if (filter.role)   conditions.push(eq(users.role,   filter.role));
      if (filter.status) conditions.push(eq(users.status, filter.status));
      if (filter.search) {
        const term = `%${filter.search}%`;
        conditions.push(or(ilike(users.name, term), ilike(users.email, term))!);
      }

      const query = db.select().from(users);
      const rows = conditions.length > 0
        ? await query.where(and(...conditions))
        : await query;

      return rows;
    } catch (err) {
      throw AppError.internal(`Failed to list users: ${String(err)}`);
    }
  }

  async findById(id: string): Promise<User | null> {
    try {
      const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(`Failed to find user: ${String(err)}`);
    }
  }

  async updateStatus(id: string, status: string): Promise<User | null> {
    try {
      const rows = await db
        .update(users)
        .set({ status, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();
      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(`Failed to update user status: ${String(err)}`);
    }
  }
}
