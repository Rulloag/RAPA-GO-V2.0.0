import { and, count, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "../../db/client.js";
import { referralCodes, referralUses, users } from "../../db/schema/index.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { ReferralCode, ReferralUse } from "../../db/schema/index.js";

export interface ReferralCodeWithStats extends ReferralCode {
  ownerName: string | null;
  ownerEmail: string | null;
  conversionCount: number;
  totalReward: number;
}

export interface ReferralUseDetail extends ReferralUse {
  referredUserName: string | null;
  referredUserEmail: string | null;
}

export class ReferralsRepository {
  async findCodeByUserId(userId: string): Promise<ReferralCode | null> {
    try {
      const rows = await db.select().from(referralCodes)
        .where(eq(referralCodes.userId, userId)).limit(1);
      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(`Failed to find referral code: ${String(err)}`);
    }
  }

  async findCodeByCode(code: string): Promise<ReferralCode | null> {
    try {
      const rows = await db.select().from(referralCodes)
        .where(eq(referralCodes.code, code)).limit(1);
      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(`Failed to find referral code: ${String(err)}`);
    }
  }

  async createCode(data: {
    userId: string | null;
    code: string;
    type: string;
    discountAmount: number | null;
    discountType: string;
    maxUses: number | null;
    expiresAt: Date | null;
  }): Promise<ReferralCode> {
    try {
      const rows = await db.insert(referralCodes).values({
        ...(data.userId !== null ? { userId: data.userId } : {}),
        code:           data.code,
        type:           data.type,
        discountAmount: data.discountAmount ?? undefined,
        discountType:   data.discountType,
        ...(data.maxUses !== null ? { maxUses: data.maxUses } : {}),
        ...(data.expiresAt !== null ? { expiresAt: data.expiresAt } : {}),
      }).returning();
      const row = rows[0];
      if (!row) throw AppError.internal("Insert returned no rows.");
      return row;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to create referral code: ${String(err)}`);
    }
  }

  async findUseByReferredUserId(referredUserId: string): Promise<ReferralUse | null> {
    try {
      const rows = await db.select().from(referralUses)
        .where(eq(referralUses.referredUserId, referredUserId)).limit(1);
      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(`Failed to find referral use: ${String(err)}`);
    }
  }

  async createUse(referralCodeId: string, referredUserId: string): Promise<ReferralUse> {
    try {
      const rows = await db.insert(referralUses).values({ referralCodeId, referredUserId }).returning();
      const row = rows[0];
      if (!row) throw AppError.internal("Insert returned no rows.");
      return row;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to create referral use: ${String(err)}`);
    }
  }

  async incrementUsedCount(referralCodeId: string): Promise<void> {
    try {
      await db.update(referralCodes)
        .set({ usedCount: sql`${referralCodes.usedCount} + 1` })
        .where(eq(referralCodes.id, referralCodeId));
    } catch (err) {
      throw AppError.internal(`Failed to increment used count: ${String(err)}`);
    }
  }

  async markConverted(useId: string, conversionValue: number, rewardAmount: number): Promise<ReferralUse | null> {
    try {
      const rows = await db.update(referralUses)
        .set({ convertedAt: new Date(), conversionValue, rewardAmount, rewardApplied: true })
        .where(eq(referralUses.id, useId))
        .returning();
      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(`Failed to mark conversion: ${String(err)}`);
    }
  }

  async getSummaryForUser(userId: string): Promise<{ usedCount: number; totalReward: number; pendingReward: number }> {
    try {
      const code = await this.findCodeByUserId(userId);
      if (!code) return { usedCount: 0, totalReward: 0, pendingReward: 0 };

      const uses = await db.select().from(referralUses)
        .where(eq(referralUses.referralCodeId, code.id));

      const totalReward  = uses.filter(u => u.rewardApplied).reduce((s, u) => s + (u.rewardAmount ?? 0), 0);
      const pendingReward = uses.filter(u => !u.rewardApplied && u.convertedAt == null).reduce((s, u) => s + (u.rewardAmount ?? 0), 0);

      return { usedCount: code.usedCount, totalReward, pendingReward };
    } catch (err) {
      throw AppError.internal(`Failed to get referral summary: ${String(err)}`);
    }
  }

  async listAllCodes(offset: number, limit: number): Promise<{ items: ReferralCodeWithStats[]; total: number }> {
    try {
      const [rows, totalRows] = await Promise.all([
        db.select({
          id:             referralCodes.id,
          userId:         referralCodes.userId,
          code:           referralCodes.code,
          type:           referralCodes.type,
          discountAmount: referralCodes.discountAmount,
          discountType:   referralCodes.discountType,
          maxUses:        referralCodes.maxUses,
          usedCount:      referralCodes.usedCount,
          expiresAt:      referralCodes.expiresAt,
          isActive:       referralCodes.isActive,
          createdAt:      referralCodes.createdAt,
          ownerName:      users.name,
          ownerEmail:     users.email,
        })
          .from(referralCodes)
          .leftJoin(users, eq(referralCodes.userId, users.id))
          .orderBy(desc(referralCodes.createdAt))
          .offset(offset)
          .limit(limit),
        db.select({ value: count() }).from(referralCodes),
      ]);

      const codeIds = rows.map(r => r.id);
      const convMap = new Map<string, { conversionCount: number; totalReward: number }>();

      if (codeIds.length > 0) {
        for (const id of codeIds) {
          const uses = await db.select().from(referralUses)
            .where(and(eq(referralUses.referralCodeId, id), isNotNull(referralUses.convertedAt)));
          convMap.set(id, {
            conversionCount: uses.length,
            totalReward: uses.reduce((s, u) => s + (u.rewardAmount ?? 0), 0),
          });
        }
      }

      const total = totalRows[0]?.value ?? 0;
      const items: ReferralCodeWithStats[] = rows.map(r => ({
        ...r,
        conversionCount: convMap.get(r.id)?.conversionCount ?? 0,
        totalReward:     convMap.get(r.id)?.totalReward ?? 0,
      }));

      return { items, total };
    } catch (err) {
      throw AppError.internal(`Failed to list referral codes: ${String(err)}`);
    }
  }

  async listUsesByCodeId(codeId: string): Promise<ReferralUseDetail[]> {
    try {
      const rows = await db.select({
        id:              referralUses.id,
        referralCodeId:  referralUses.referralCodeId,
        referredUserId:  referralUses.referredUserId,
        referredAt:      referralUses.referredAt,
        convertedAt:     referralUses.convertedAt,
        conversionValue: referralUses.conversionValue,
        rewardApplied:   referralUses.rewardApplied,
        rewardAmount:    referralUses.rewardAmount,
        createdAt:       referralUses.createdAt,
        referredUserName:  users.name,
        referredUserEmail: users.email,
      })
        .from(referralUses)
        .leftJoin(users, eq(referralUses.referredUserId, users.id))
        .where(eq(referralUses.referralCodeId, codeId))
        .orderBy(desc(referralUses.referredAt));

      return rows;
    } catch (err) {
      throw AppError.internal(`Failed to list referral uses: ${String(err)}`);
    }
  }

  async findUseById(useId: string): Promise<ReferralUse | null> {
    try {
      const rows = await db.select().from(referralUses)
        .where(eq(referralUses.id, useId)).limit(1);
      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(`Failed to find referral use: ${String(err)}`);
    }
  }
}
