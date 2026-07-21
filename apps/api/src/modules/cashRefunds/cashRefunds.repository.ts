import { and, asc, desc, eq } from "drizzle-orm";

import { db } from "../../db/client.js";
import {
  cashOverpaymentBenefits,
  cashOverpaymentRefundRequests,
  users,
} from "../../db/schema/index.js";
import { AppError } from "../../shared/errors/AppError.js";
import type {
  CashOverpaymentRefundRequest,
  NewCashOverpaymentRefundRequest,
} from "../../db/schema/index.js";

export interface CashOverpaymentRefundWithOwner
  extends CashOverpaymentRefundRequest {
  ownerName: string | null;
  ownerEmail: string | null;
}

export class CashRefundsRepository {
  async findById(id: string): Promise<CashOverpaymentRefundRequest | null> {
    try {
      const [row] = await db
        .select()
        .from(cashOverpaymentRefundRequests)
        .where(eq(cashOverpaymentRefundRequests.id, id))
        .limit(1);
      return row ?? null;
    } catch (error) {
      throw AppError.internal(`Failed to query cash refund: ${String(error)}`);
    }
  }

  async findByRideId(
    sourceRideId: string,
  ): Promise<CashOverpaymentRefundRequest | null> {
    try {
      const [row] = await db
        .select()
        .from(cashOverpaymentRefundRequests)
        .where(eq(cashOverpaymentRefundRequests.sourceRideId, sourceRideId))
        .limit(1);
      return row ?? null;
    } catch (error) {
      throw AppError.internal(
        `Failed to query cash refund by ride: ${String(error)}`,
      );
    }
  }

  async findBenefitByRideId(sourceRideId: string): Promise<{ id: string } | null> {
    try {
      const [row] = await db
        .select({ id: cashOverpaymentBenefits.id })
        .from(cashOverpaymentBenefits)
        .where(eq(cashOverpaymentBenefits.sourceRideId, sourceRideId))
        .limit(1);
      return row ?? null;
    } catch (error) {
      throw AppError.internal(
        `Failed to query benefit before cash refund: ${String(error)}`,
      );
    }
  }

  async create(
    data: NewCashOverpaymentRefundRequest,
  ): Promise<CashOverpaymentRefundRequest> {
    try {
      const inserted = await db
        .insert(cashOverpaymentRefundRequests)
        .values(data)
        .onConflictDoNothing({
          target: cashOverpaymentRefundRequests.sourceRideId,
        })
        .returning();

      const row = inserted[0] ?? (await this.findByRideId(data.sourceRideId));
      if (!row) {
        throw AppError.internal("Cash refund insert returned no rows.");
      }
      return row;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.internal(`Failed to create cash refund: ${String(error)}`);
    }
  }

  async listByOwner(ownerUserId: string): Promise<CashOverpaymentRefundRequest[]> {
    try {
      return await db
        .select()
        .from(cashOverpaymentRefundRequests)
        .where(eq(cashOverpaymentRefundRequests.ownerUserId, ownerUserId))
        .orderBy(desc(cashOverpaymentRefundRequests.createdAt));
    } catch (error) {
      throw AppError.internal(`Failed to list cash refunds: ${String(error)}`);
    }
  }

  async listForAdmin(status?: string): Promise<CashOverpaymentRefundWithOwner[]> {
    try {
      const condition =
        status && status !== "all"
          ? eq(cashOverpaymentRefundRequests.status, status)
          : undefined;

      const query = db
        .select({
          id: cashOverpaymentRefundRequests.id,
          sourceRideId: cashOverpaymentRefundRequests.sourceRideId,
          ownerUserId: cashOverpaymentRefundRequests.ownerUserId,
          requestedByUserId: cashOverpaymentRefundRequests.requestedByUserId,
          bankAccountId: cashOverpaymentRefundRequests.bankAccountId,
          status: cashOverpaymentRefundRequests.status,
          fareClp: cashOverpaymentRefundRequests.fareClp,
          paidClp: cashOverpaymentRefundRequests.paidClp,
          requestedAmountClp: cashOverpaymentRefundRequests.requestedAmountClp,
          approvedAmountClp: cashOverpaymentRefundRequests.approvedAmountClp,
          requestReason: cashOverpaymentRefundRequests.requestReason,
          adminDecisionReason: cashOverpaymentRefundRequests.adminDecisionReason,
          bankAccountHolderName:
            cashOverpaymentRefundRequests.bankAccountHolderName,
          bankName: cashOverpaymentRefundRequests.bankName,
          bankAccountType: cashOverpaymentRefundRequests.bankAccountType,
          bankAccountNumberLast4:
            cashOverpaymentRefundRequests.bankAccountNumberLast4,
          bankAccountNumberEncrypted:
            cashOverpaymentRefundRequests.bankAccountNumberEncrypted,
          transferReference: cashOverpaymentRefundRequests.transferReference,
          transferProofUrl: cashOverpaymentRefundRequests.transferProofUrl,
          reviewedByUserId: cashOverpaymentRefundRequests.reviewedByUserId,
          reviewedAt: cashOverpaymentRefundRequests.reviewedAt,
          completedAt: cashOverpaymentRefundRequests.completedAt,
          requestedAt: cashOverpaymentRefundRequests.requestedAt,
          createdAt: cashOverpaymentRefundRequests.createdAt,
          updatedAt: cashOverpaymentRefundRequests.updatedAt,
          ownerName: users.name,
          ownerEmail: users.email,
        })
        .from(cashOverpaymentRefundRequests)
        .leftJoin(users, eq(cashOverpaymentRefundRequests.ownerUserId, users.id));

      const rows = condition
        ? await query
            .where(condition)
            .orderBy(asc(cashOverpaymentRefundRequests.createdAt))
        : await query.orderBy(asc(cashOverpaymentRefundRequests.createdAt));

      return rows as CashOverpaymentRefundWithOwner[];
    } catch (error) {
      throw AppError.internal(
        `Failed to list admin cash refunds: ${String(error)}`,
      );
    }
  }

  async approve(input: {
    id: string;
    reviewedByUserId: string;
    approvedAmountClp: number;
    adminDecisionReason?: string | null;
  }): Promise<CashOverpaymentRefundRequest | null> {
    const now = new Date();
    try {
      const [row] = await db
        .update(cashOverpaymentRefundRequests)
        .set({
          status: "approved_for_transfer",
          approvedAmountClp: input.approvedAmountClp,
          reviewedByUserId: input.reviewedByUserId,
          reviewedAt: now,
          adminDecisionReason: input.adminDecisionReason?.trim() || null,
          updatedAt: now,
        })
        .where(
          and(
            eq(cashOverpaymentRefundRequests.id, input.id),
            eq(
              cashOverpaymentRefundRequests.status,
              "pending_admin_review",
            ),
          ),
        )
        .returning();
      return row ?? null;
    } catch (error) {
      throw AppError.internal(`Failed to approve cash refund: ${String(error)}`);
    }
  }

  async reject(input: {
    id: string;
    reviewedByUserId: string;
    adminDecisionReason: string;
  }): Promise<CashOverpaymentRefundRequest | null> {
    const now = new Date();
    try {
      const [row] = await db
        .update(cashOverpaymentRefundRequests)
        .set({
          status: "rejected",
          approvedAmountClp: null,
          reviewedByUserId: input.reviewedByUserId,
          reviewedAt: now,
          adminDecisionReason: input.adminDecisionReason,
          updatedAt: now,
        })
        .where(
          and(
            eq(cashOverpaymentRefundRequests.id, input.id),
            eq(
              cashOverpaymentRefundRequests.status,
              "pending_admin_review",
            ),
          ),
        )
        .returning();
      return row ?? null;
    } catch (error) {
      throw AppError.internal(`Failed to reject cash refund: ${String(error)}`);
    }
  }

  async complete(input: {
    id: string;
    reviewedByUserId: string;
    transferReference: string;
    transferProofUrl?: string | null;
    adminDecisionReason?: string | null;
  }): Promise<CashOverpaymentRefundRequest | null> {
    const now = new Date();
    try {
      const [row] = await db
        .update(cashOverpaymentRefundRequests)
        .set({
          status: "completed",
          transferReference: input.transferReference,
          transferProofUrl: input.transferProofUrl?.trim() || null,
          reviewedByUserId: input.reviewedByUserId,
          completedAt: now,
          adminDecisionReason: input.adminDecisionReason?.trim() || null,
          updatedAt: now,
        })
        .where(
          and(
            eq(cashOverpaymentRefundRequests.id, input.id),
            eq(
              cashOverpaymentRefundRequests.status,
              "approved_for_transfer",
            ),
          ),
        )
        .returning();
      return row ?? null;
    } catch (error) {
      throw AppError.internal(`Failed to complete cash refund: ${String(error)}`);
    }
  }
}
