import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { legalDocuments, userAcceptances } from "../../db/schema/index.js";
import type { LegalDocument, UserAcceptance } from "../../db/schema/index.js";

export class LegalRepository {
  async findAll(filters: { type?: string; isActive?: boolean }): Promise<LegalDocument[]> {
    const conditions = [];
    if (filters.type !== undefined)     conditions.push(eq(legalDocuments.type,     filters.type));
    if (filters.isActive !== undefined) conditions.push(eq(legalDocuments.isActive, filters.isActive));
    const query = db.select().from(legalDocuments);
    const result = conditions.length > 0
      ? await query.where(and(...conditions)).orderBy(desc(legalDocuments.createdAt))
      : await query.orderBy(desc(legalDocuments.createdAt));
    return result;
  }

  async findById(id: string): Promise<LegalDocument | null> {
    const rows = await db.select().from(legalDocuments).where(eq(legalDocuments.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async findActive(): Promise<LegalDocument[]> {
    return db.select().from(legalDocuments)
      .where(eq(legalDocuments.isActive, true))
      .orderBy(legalDocuments.type);
  }

  async create(data: {
    type: string; version: string; title: string; content: string;
    effectiveDate: string; createdBy?: string;
  }): Promise<LegalDocument> {
    await db.update(legalDocuments)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(legalDocuments.type, data.type), eq(legalDocuments.isActive, true)));

    const rows = await db.insert(legalDocuments).values({
      type: data.type, version: data.version, title: data.title,
      content: data.content, effectiveDate: data.effectiveDate,
      ...(data.createdBy ? { createdBy: data.createdBy } : {}),
    }).returning();
    if (!rows[0]) throw new Error("Insert returned no rows.");
    return rows[0];
  }

  async update(id: string, data: { title?: string; content?: string; effectiveDate?: string; isActive?: boolean }): Promise<LegalDocument | null> {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (data.title         !== undefined) set["title"]         = data.title;
    if (data.content       !== undefined) set["content"]       = data.content;
    if (data.effectiveDate !== undefined) set["effectiveDate"] = data.effectiveDate;
    if (data.isActive      !== undefined) set["isActive"]      = data.isActive;
    const rows = await db.update(legalDocuments).set(set).where(eq(legalDocuments.id, id)).returning();
    return rows[0] ?? null;
  }

  async createAcceptance(data: {
    userId: string; legalDocumentId: string; versionAccepted: string;
    ipAddress?: string; userAgent?: string;
  }): Promise<UserAcceptance> {
    const rows = await db.insert(userAcceptances).values({
      userId: data.userId, legalDocumentId: data.legalDocumentId,
      versionAccepted: data.versionAccepted,
      ...(data.ipAddress ? { ipAddress: data.ipAddress } : {}),
      ...(data.userAgent ? { userAgent: data.userAgent } : {}),
    })
    .onConflictDoUpdate({
      target: [userAcceptances.userId, userAcceptances.legalDocumentId],
      set: { versionAccepted: data.versionAccepted, acceptedAt: new Date() },
    })
    .returning();
    if (!rows[0]) throw new Error("Insert returned no rows.");
    return rows[0];
  }

  async findAcceptancesByUser(userId: string): Promise<UserAcceptance[]> {
    return db.select().from(userAcceptances)
      .where(eq(userAcceptances.userId, userId))
      .orderBy(desc(userAcceptances.acceptedAt));
  }

  async hasAccepted(userId: string, documentType: string): Promise<boolean> {
    const rows = await db
      .select({ id: userAcceptances.id })
      .from(userAcceptances)
      .innerJoin(legalDocuments, eq(userAcceptances.legalDocumentId, legalDocuments.id))
      .where(and(
        eq(userAcceptances.userId, userId),
        eq(legalDocuments.type, documentType),
        eq(legalDocuments.isActive, true),
      ))
      .limit(1);
    return rows.length > 0;
  }

  async checkMissingAcceptances(userId: string, documentTypes: string[]): Promise<string[]> {
    const missing: string[] = [];
    for (const type of documentTypes) {
      const accepted = await this.hasAccepted(userId, type);
      if (!accepted) missing.push(type);
    }
    return missing;
  }

  async listAcceptances(filters: { userId?: string; page: number; limit: number }): Promise<{ items: UserAcceptance[]; total: number }> {
    const conditions = [];
    if (filters.userId) conditions.push(eq(userAcceptances.userId, filters.userId));

    const baseItems = db.select().from(userAcceptances);
    const items = conditions.length > 0
      ? await baseItems.where(and(...conditions)).orderBy(desc(userAcceptances.acceptedAt)).limit(filters.limit).offset((filters.page - 1) * filters.limit)
      : await baseItems.orderBy(desc(userAcceptances.acceptedAt)).limit(filters.limit).offset((filters.page - 1) * filters.limit);

    return { items, total: items.length };
  }
}
