import { db } from "../../db/client.js";
import { users, userDocuments } from "../../db/schema/index.js";
import { eq, and, or, ilike, type SQL } from "drizzle-orm";
import { AppError } from "../../shared/errors/AppError.js";
import type { User } from "../users/users.types.js";
import type { UserDocument } from "../../db/schema/index.js";

export interface AdminDocumentRow extends UserDocument {
  userName:  string;
  userEmail: string;
  userRole:  string;
}

export interface ListDocumentsFilter {
  status?:       string | undefined;
  documentType?: string | undefined;
  userId?:       string | undefined;
}

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

  async listDocuments(filter: ListDocumentsFilter): Promise<AdminDocumentRow[]> {
    try {
      const conditions: SQL[] = [];
      if (filter.status)       conditions.push(eq(userDocuments.status,       filter.status));
      if (filter.documentType) conditions.push(eq(userDocuments.documentType, filter.documentType));
      if (filter.userId)       conditions.push(eq(userDocuments.userId,       filter.userId));

      const query = db
        .select({
          id:              userDocuments.id,
          userId:          userDocuments.userId,
          documentType:    userDocuments.documentType,
          status:          userDocuments.status,
          fileUrl:         userDocuments.fileUrl,
          rejectionReason: userDocuments.rejectionReason,
          uploadedAt:      userDocuments.uploadedAt,
          reviewedAt:      userDocuments.reviewedAt,
          createdAt:       userDocuments.createdAt,
          updatedAt:       userDocuments.updatedAt,
          userName:        users.name,
          userEmail:       users.email,
          userRole:        users.role,
        })
        .from(userDocuments)
        .innerJoin(users, eq(userDocuments.userId, users.id));

      const rows = conditions.length > 0
        ? await query.where(and(...conditions))
        : await query;

      return rows;
    } catch (err) {
      throw AppError.internal(`Failed to list documents: ${String(err)}`);
    }
  }

  async findDocumentById(id: string): Promise<AdminDocumentRow | null> {
    try {
      const rows = await db
        .select({
          id:              userDocuments.id,
          userId:          userDocuments.userId,
          documentType:    userDocuments.documentType,
          status:          userDocuments.status,
          fileUrl:         userDocuments.fileUrl,
          rejectionReason: userDocuments.rejectionReason,
          uploadedAt:      userDocuments.uploadedAt,
          reviewedAt:      userDocuments.reviewedAt,
          createdAt:       userDocuments.createdAt,
          updatedAt:       userDocuments.updatedAt,
          userName:        users.name,
          userEmail:       users.email,
          userRole:        users.role,
        })
        .from(userDocuments)
        .innerJoin(users, eq(userDocuments.userId, users.id))
        .where(eq(userDocuments.id, id))
        .limit(1);
      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(`Failed to find document: ${String(err)}`);
    }
  }

  async reviewDocument(
    id: string,
    status: string,
    rejectionReason: string | null,
  ): Promise<AdminDocumentRow | null> {
    try {
      await db
        .update(userDocuments)
        .set({ status, rejectionReason, reviewedAt: new Date(), updatedAt: new Date() })
        .where(eq(userDocuments.id, id));
      return this.findDocumentById(id);
    } catch (err) {
      throw AppError.internal(`Failed to review document: ${String(err)}`);
    }
  }
}
