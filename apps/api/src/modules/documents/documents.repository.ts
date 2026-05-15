import { and, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { userDocuments } from "../../db/schema/index.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { UserDocument } from "../../db/schema/index.js";

export class DocumentsRepository {
  async findByUserId(userId: string): Promise<UserDocument[]> {
    try {
      return await db
        .select()
        .from(userDocuments)
        .where(eq(userDocuments.userId, userId))
        .orderBy(userDocuments.createdAt);
    } catch (err) {
      throw AppError.internal(`Failed to query documents: ${String(err)}`);
    }
  }

  async findByUserIdAndType(userId: string, documentType: string): Promise<UserDocument | null> {
    try {
      const rows = await db
        .select()
        .from(userDocuments)
        .where(and(eq(userDocuments.userId, userId), eq(userDocuments.documentType, documentType)))
        .limit(1);
      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(`Failed to query document by type: ${String(err)}`);
    }
  }

  async create(userId: string, documentType: string): Promise<UserDocument> {
    try {
      const rows = await db
        .insert(userDocuments)
        .values({ userId, documentType, status: "pending" })
        .returning();
      const created = rows[0];
      if (!created) throw AppError.internal("Insert returned no rows.");
      return created;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to create document record: ${String(err)}`);
    }
  }

  async findById(id: string): Promise<UserDocument | null> {
    try {
      const rows = await db.select().from(userDocuments).where(eq(userDocuments.id, id)).limit(1);
      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(`Failed to query document by id: ${String(err)}`);
    }
  }

  async setUploadMetadata(id: string, fileUrl: string): Promise<UserDocument | null> {
    try {
      const rows = await db
        .update(userDocuments)
        .set({
          status:          "uploaded",
          fileUrl,
          rejectionReason: null,
          uploadedAt:      new Date(),
          updatedAt:       new Date(),
        })
        .where(eq(userDocuments.id, id))
        .returning();
      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(`Failed to update document metadata: ${String(err)}`);
    }
  }
}
