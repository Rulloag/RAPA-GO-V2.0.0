import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import { applications } from "../../db/schema/index.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { Application } from "../../db/schema/index.js";

type ApplicationAssetChanges = Partial<Pick<
  typeof applications.$inferInsert,
  | "idFrontUrl"
  | "idBackUrl"
  | "licenseFrontUrl"
  | "licenseBackUrl"
  | "profilePhotoUrl"
  | "vehiclePhotoUrl"
>>;

export class ApplicationsRepository {
  async create(data: typeof applications.$inferInsert): Promise<Application> {
    try {
      const rows = await db.insert(applications).values(data).returning();
      if (!rows[0]) throw AppError.internal("Insert returned no rows.");
      return rows[0];
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to create application: ${String(err)}`);
    }
  }

  async findById(id: string): Promise<Application | null> {
    const rows = await db.select().from(applications).where(eq(applications.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async findByUserId(userId: string): Promise<Application[]> {
    return db.select().from(applications)
      .where(eq(applications.userId, userId))
      .orderBy(desc(applications.createdAt));
  }

  async list(filters: {
    type?: string;
    status?: string;
    page: number;
    limit: number;
  }): Promise<{ items: Application[]; total: number }> {
    const conditions: ReturnType<typeof eq>[] = [];

    if (filters.type) conditions.push(eq(applications.type, filters.type));
    if (filters.status) conditions.push(eq(applications.status, filters.status));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult, items] = await Promise.all([
      whereClause
        ? db.select({ count: sql<number>`count(*)::int` }).from(applications).where(whereClause)
        : db.select({ count: sql<number>`count(*)::int` }).from(applications),
      whereClause
        ? db.select().from(applications).where(whereClause)
          .orderBy(desc(applications.createdAt))
          .limit(filters.limit)
          .offset((filters.page - 1) * filters.limit)
        : db.select().from(applications)
          .orderBy(desc(applications.createdAt))
          .limit(filters.limit)
          .offset((filters.page - 1) * filters.limit),
    ]);

    return {
      items,
      total: countResult[0]?.count ?? 0,
    };
  }

  async updateStatus(
    id: string,
    reviewedBy: string,
    input: {
      status: string;
      rejectionReason?: string | null;
      notes?: string | null;
      documentReviewStatus?: string;
      trainingStatus?: string;
      reviewChecklist?: Record<string, boolean>;
    },
  ): Promise<Application | null> {
    const rows = await db.update(applications).set({
      status: input.status,
      reviewedBy,
      reviewedAt: new Date(),
      ...(input.rejectionReason !== undefined
        ? { rejectionReason: input.rejectionReason }
        : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.documentReviewStatus !== undefined
        ? { documentReviewStatus: input.documentReviewStatus }
        : {}),
      ...(input.trainingStatus !== undefined
        ? { trainingStatus: input.trainingStatus }
        : {}),
      ...(input.reviewChecklist !== undefined
        ? { reviewChecklist: input.reviewChecklist }
        : {}),
      updatedAt: new Date(),
    }).where(eq(applications.id, id)).returning();

    return rows[0] ?? null;
  }

  async updateContractDelivery(
    id: string,
    input: {
      status: "pending" | "sent" | "failed";
      deliveredAt?: Date | null;
      error?: string | null;
    },
  ): Promise<Application | null> {
    const rows = await db.update(applications).set({
      contractDeliveryStatus: input.status,
      contractDeliveredAt: input.deliveredAt ?? null,
      contractDeliveryError: input.error ?? null,
      updatedAt: new Date(),
    }).where(eq(applications.id, id)).returning();

    return rows[0] ?? null;
  }

  async updateApprovalDelivery(
    id: string,
    input: {
      status: "pending" | "sent" | "failed";
      deliveredAt?: Date | null;
      error?: string | null;
    },
  ): Promise<Application | null> {
    const rows = await db.update(applications).set({
      approvalDeliveryStatus: input.status,
      approvalDeliveredAt: input.deliveredAt ?? null,
      approvalDeliveryError: input.error ?? null,
      updatedAt: new Date(),
    }).where(eq(applications.id, id)).returning();

    return rows[0] ?? null;
  }

  async attachUser(id: string, userId: string): Promise<Application | null> {
    const rows = await db.update(applications).set({
      userId,
      updatedAt: new Date(),
    }).where(eq(applications.id, id)).returning();

    return rows[0] ?? null;
  }

  async updateAssets(
    id: string,
    changes: ApplicationAssetChanges,
  ): Promise<Application | null> {
    const rows = await db.update(applications).set({
      ...changes,
      updatedAt: new Date(),
    }).where(eq(applications.id, id)).returning();

    return rows[0] ?? null;
  }
}
