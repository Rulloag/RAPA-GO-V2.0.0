import { and, asc, count, desc, eq, sql } from "drizzle-orm";

import { db } from "../../db/client.js";
import {
  cashOverpaymentBenefits,
  cashPaymentClosures,
  cashOverpaymentRefundRequests,
  paymentOrders,
  transactions,
  users,
  wallets,
} from "../../db/schema/index.js";
import { AppError } from "../../shared/errors/AppError.js";
import type {
  CashOverpaymentBenefit,
  NewCashOverpaymentBenefit,
  NewPaymentOrder,
  NewTransaction,
  PaymentOrder,
  Transaction,
  Wallet,
} from "../../db/schema/index.js";

export interface CashOverpaymentBenefitWithOwner
  extends CashOverpaymentBenefit {
  ownerName: string | null;
  ownerEmail: string | null;
}

export type CashOverpaymentApprovalResult =
  | {
      outcome: "approved" | "already_approved";
      benefit: CashOverpaymentBenefit;
      wallet: Wallet;
      transaction: Transaction;
    }
  | {
      outcome: "not_found" | "not_pending";
      benefit: CashOverpaymentBenefit | null;
    };

export class WalletRepository {
  async findByUserId(userId: string): Promise<Wallet | null> {
    try {
      const rows = await db
        .select()
        .from(wallets)
        .where(eq(wallets.userId, userId))
        .limit(1);

      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(`Failed to query wallet: ${String(err)}`);
    }
  }

  async createWallet(userId: string): Promise<Wallet> {
    try {
      const rows = await db
        .insert(wallets)
        .values({ userId })
        .onConflictDoNothing({ target: wallets.userId })
        .returning();

      const row = rows[0] ?? (await this.findByUserId(userId));

      if (!row) {
        throw AppError.internal("Wallet insert returned no rows.");
      }

      return row;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to create wallet: ${String(err)}`);
    }
  }

  async getOrCreate(userId: string): Promise<Wallet> {
    const existing = await this.findByUserId(userId);
    if (existing) return existing;
    return this.createWallet(userId);
  }

  async updateBalance(walletId: string, newBalance: number): Promise<Wallet> {
    try {
      const safeBalance = Math.max(0, Math.round(newBalance));

      const rows = await db
        .update(wallets)
        .set({
          balance: safeBalance,
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, walletId))
        .returning();

      const row = rows[0];

      if (!row) {
        throw AppError.internal("Wallet not found during balance update.");
      }

      return row;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(
        `Failed to update wallet balance: ${String(err)}`,
      );
    }
  }

  async listTransactions(
    userId: string,
    offset: number,
    limit: number,
  ): Promise<{ items: Transaction[]; total: number }> {
    try {
      const [items, totalRows] = await Promise.all([
        db
          .select()
          .from(transactions)
          .where(eq(transactions.userId, userId))
          .orderBy(desc(transactions.createdAt))
          .offset(offset)
          .limit(limit),
        db
          .select({ value: count() })
          .from(transactions)
          .where(eq(transactions.userId, userId)),
      ]);

      const total = totalRows[0]?.value ?? 0;
      return { items, total };
    } catch (err) {
      throw AppError.internal(
        `Failed to list transactions: ${String(err)}`,
      );
    }
  }

  async createTransaction(data: NewTransaction): Promise<Transaction> {
    try {
      const rows = await db.insert(transactions).values(data).returning();
      const row = rows[0];

      if (!row) {
        throw AppError.internal("Transaction insert returned no rows.");
      }

      return row;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(
        `Failed to create transaction: ${String(err)}`,
      );
    }
  }

  async findTransactionByProviderTransactionId(
    providerTransactionId: string,
  ): Promise<Transaction | null> {
    try {
      const rows = await db
        .select()
        .from(transactions)
        .where(
          eq(
            transactions.providerTransactionId,
            providerTransactionId,
          ),
        )
        .limit(1);

      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(
        `Failed to query transaction by provider id: ${String(err)}`,
      );
    }
  }

  /**
   * Compatibilidad con procesos administrativos antiguos. Los nuevos beneficios
   * deben aprobarse mediante approveCashOverpaymentBenefit para que solicitud,
   * saldo y transacción cambien dentro de una sola transacción SQL.
   */
  async creditUserWallet(input: {
    userId: string;
    amountClp: number;
    rideId?: string | null;
    description: string;
    metadata?: Record<string, unknown>;
    providerTransactionId: string;
  }): Promise<{ wallet: Wallet; transaction: Transaction }> {
    const amountClp = Math.round(Number(input.amountClp));

    if (!Number.isFinite(amountClp) || amountClp <= 0) {
      throw AppError.internal("Wallet benefit amount must be greater than zero.");
    }

    try {
      return await db.transaction(async (tx) => {
        const existingTransactionRows = await tx
          .select()
          .from(transactions)
          .where(
            eq(
              transactions.providerTransactionId,
              input.providerTransactionId,
            ),
          )
          .limit(1);

        const existingTransaction = existingTransactionRows[0] ?? null;

        if (existingTransaction) {
          if (existingTransaction.userId !== input.userId) {
            throw AppError.internal(
              "Wallet benefit ownership conflict for existing transaction.",
            );
          }

          const existingWalletRows = await tx
            .select()
            .from(wallets)
            .where(eq(wallets.id, existingTransaction.walletId))
            .limit(1);

          const existingWallet = existingWalletRows[0];

          if (!existingWallet) {
            throw AppError.internal(
              "Existing benefit transaction has no wallet.",
            );
          }

          return {
            wallet: existingWallet,
            transaction: existingTransaction,
          };
        }

        await tx
          .insert(wallets)
          .values({ userId: input.userId })
          .onConflictDoNothing({ target: wallets.userId });

        await tx.execute(
          sql`select id from wallets where user_id = ${input.userId} for update`,
        );

        const wallet = (
          await tx
            .select()
            .from(wallets)
            .where(eq(wallets.userId, input.userId))
            .limit(1)
        )[0];

        if (!wallet) {
          throw AppError.internal("Wallet insert returned no rows.");
        }

        const previousBalance = Math.max(0, wallet.balance);
        const nextBalance = previousBalance + amountClp;

        const updatedWallet = (
          await tx
            .update(wallets)
            .set({
              balance: nextBalance,
              updatedAt: new Date(),
            })
            .where(eq(wallets.id, wallet.id))
            .returning()
        )[0];

        if (!updatedWallet) {
          throw AppError.internal(
            "Wallet not found during benefit credit update.",
          );
        }

        const transaction = (
          await tx
            .insert(transactions)
            .values({
              walletId: wallet.id,
              userId: input.userId,
              rideId: input.rideId ?? null,
              type: "benefit_credit",
              amount: amountClp,
              currency: "CLP",
              status: "completed",
              provider: "admin",
              providerTransactionId: input.providerTransactionId,
              description: input.description,
              metadata: {
                ...(input.metadata ?? {}),
                balanceBeforeClp: previousBalance,
                balanceAfterClp: nextBalance,
              },
            })
            .returning()
        )[0];

        if (!transaction) {
          throw AppError.internal(
            "Benefit transaction insert returned no rows.",
          );
        }

        return {
          wallet: updatedWallet,
          transaction,
        };
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(
        `Failed to credit wallet benefit: ${String(err)}`,
      );
    }
  }

async findCashPaymentClosureByRideId(rideId: string) {
  const [row] = await db.select().from(cashPaymentClosures)
    .where(eq(cashPaymentClosures.rideRequestId, rideId)).limit(1);
  return row ?? null;
}

  async findCashOverpaymentRefundByRideId(
    sourceRideId: string,
  ): Promise<{ id: string; ownerUserId: string; status: string } | null> {
    try {
      const [row] = await db
        .select({
          id: cashOverpaymentRefundRequests.id,
          ownerUserId: cashOverpaymentRefundRequests.ownerUserId,
          status: cashOverpaymentRefundRequests.status,
        })
        .from(cashOverpaymentRefundRequests)
        .where(eq(cashOverpaymentRefundRequests.sourceRideId, sourceRideId))
        .limit(1);

      return row ?? null;
    } catch (err) {
      throw AppError.internal(
        `Failed to query cash overpayment refund by ride: ${String(err)}`,
      );
    }
  }

  async findCashOverpaymentBenefitById(
    id: string,
  ): Promise<CashOverpaymentBenefit | null> {
    try {
      const [row] = await db
        .select()
        .from(cashOverpaymentBenefits)
        .where(eq(cashOverpaymentBenefits.id, id))
        .limit(1);

      return row ?? null;
    } catch (err) {
      throw AppError.internal(
        `Failed to query cash overpayment benefit: ${String(err)}`,
      );
    }
  }

  async findCashOverpaymentBenefitByRideId(
    sourceRideId: string,
  ): Promise<CashOverpaymentBenefit | null> {
    try {
      const [row] = await db
        .select()
        .from(cashOverpaymentBenefits)
        .where(eq(cashOverpaymentBenefits.sourceRideId, sourceRideId))
        .limit(1);

      return row ?? null;
    } catch (err) {
      throw AppError.internal(
        `Failed to query cash overpayment benefit by ride: ${String(err)}`,
      );
    }
  }

  async createCashOverpaymentBenefitRequest(
    data: NewCashOverpaymentBenefit,
  ): Promise<CashOverpaymentBenefit> {
    try {
      const inserted = await db
        .insert(cashOverpaymentBenefits)
        .values(data)
        .onConflictDoNothing({
          target: cashOverpaymentBenefits.sourceRideId,
        })
        .returning();

      const row =
        inserted[0] ??
        (await this.findCashOverpaymentBenefitByRideId(data.sourceRideId));

      if (!row) {
        throw AppError.internal(
          "Cash overpayment request insert returned no rows.",
        );
      }

      return row;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(
        `Failed to create cash overpayment benefit request: ${String(err)}`,
      );
    }
  }

  async listCashOverpaymentBenefitsByOwner(
    ownerUserId: string,
  ): Promise<CashOverpaymentBenefit[]> {
    try {
      return await db
        .select()
        .from(cashOverpaymentBenefits)
        .where(eq(cashOverpaymentBenefits.ownerUserId, ownerUserId))
        .orderBy(desc(cashOverpaymentBenefits.createdAt));
    } catch (err) {
      throw AppError.internal(
        `Failed to list cash overpayment benefits: ${String(err)}`,
      );
    }
  }

  async adminListCashOverpaymentBenefits(
    status?: string,
  ): Promise<CashOverpaymentBenefitWithOwner[]> {
    try {
      const condition =
        status && status !== "all"
          ? eq(cashOverpaymentBenefits.status, status)
          : undefined;

      const query = db
        .select({
          id: cashOverpaymentBenefits.id,
          sourceRideId: cashOverpaymentBenefits.sourceRideId,
          ownerUserId: cashOverpaymentBenefits.ownerUserId,
          requestedByUserId: cashOverpaymentBenefits.requestedByUserId,
          status: cashOverpaymentBenefits.status,
          fareClp: cashOverpaymentBenefits.fareClp,
          paidClp: cashOverpaymentBenefits.paidClp,
          requestedAmountClp:
            cashOverpaymentBenefits.requestedAmountClp,
          approvedAmountClp:
            cashOverpaymentBenefits.approvedAmountClp,
          requestReason: cashOverpaymentBenefits.requestReason,
          adminDecisionReason:
            cashOverpaymentBenefits.adminDecisionReason,
          reviewedByUserId:
            cashOverpaymentBenefits.reviewedByUserId,
          reviewedAt: cashOverpaymentBenefits.reviewedAt,
          walletTransactionId:
            cashOverpaymentBenefits.walletTransactionId,
          requestedAt: cashOverpaymentBenefits.requestedAt,
          createdAt: cashOverpaymentBenefits.createdAt,
          updatedAt: cashOverpaymentBenefits.updatedAt,
          ownerName: users.name,
          ownerEmail: users.email,
        })
        .from(cashOverpaymentBenefits)
        .leftJoin(users, eq(cashOverpaymentBenefits.ownerUserId, users.id));

      const rows = condition
        ? await query
            .where(condition)
            .orderBy(asc(cashOverpaymentBenefits.createdAt))
        : await query.orderBy(asc(cashOverpaymentBenefits.createdAt));

      return rows as CashOverpaymentBenefitWithOwner[];
    } catch (err) {
      throw AppError.internal(
        `Failed to list admin cash overpayment benefits: ${String(err)}`,
      );
    }
  }

  async approveCashOverpaymentBenefit(input: {
    id: string;
    reviewedByUserId: string;
    approvedAmountClp?: number;
    adminDecisionReason?: string | null;
  }): Promise<CashOverpaymentApprovalResult> {
    try {
      return await db.transaction(async (tx) => {
        await tx.execute(
          sql`select id from cash_overpayment_benefits where id = ${input.id} for update`,
        );

        const benefit = (
          await tx
            .select()
            .from(cashOverpaymentBenefits)
            .where(eq(cashOverpaymentBenefits.id, input.id))
            .limit(1)
        )[0];

        if (!benefit) {
          return { outcome: "not_found", benefit: null } as const;
        }

        if (benefit.status === "approved" && benefit.walletTransactionId) {
          const transaction = (
            await tx
              .select()
              .from(transactions)
              .where(eq(transactions.id, benefit.walletTransactionId))
              .limit(1)
          )[0];

          const wallet = transaction
            ? (
                await tx
                  .select()
                  .from(wallets)
                  .where(eq(wallets.id, transaction.walletId))
                  .limit(1)
              )[0]
            : null;

          if (transaction && wallet) {
            return {
              outcome: "already_approved",
              benefit,
              wallet,
              transaction,
            } as const;
          }
        }

        if (benefit.status !== "pending_admin_review") {
          return { outcome: "not_pending", benefit } as const;
        }

        const requestedAmountClp = Math.max(
          0,
          Math.round(benefit.requestedAmountClp),
        );
        const approvedAmountClp = Math.min(
          requestedAmountClp,
          Math.max(
            0,
            Math.round(
              input.approvedAmountClp ?? requestedAmountClp,
            ),
          ),
        );

        if (approvedAmountClp <= 0) {
          return { outcome: "not_pending", benefit } as const;
        }

        await tx
          .insert(wallets)
          .values({ userId: benefit.ownerUserId })
          .onConflictDoNothing({ target: wallets.userId });

        await tx.execute(
          sql`select id from wallets where user_id = ${benefit.ownerUserId} for update`,
        );

        const wallet = (
          await tx
            .select()
            .from(wallets)
            .where(eq(wallets.userId, benefit.ownerUserId))
            .limit(1)
        )[0];

        if (!wallet) {
          throw AppError.internal(
            "Wallet not found while approving cash overpayment benefit.",
          );
        }

        const previousBalance = Math.max(0, wallet.balance);
        const nextBalance = previousBalance + approvedAmountClp;
        const now = new Date();

        const updatedWallet = (
          await tx
            .update(wallets)
            .set({ balance: nextBalance, updatedAt: now })
            .where(eq(wallets.id, wallet.id))
            .returning()
        )[0];

        if (!updatedWallet) {
          throw AppError.internal(
            "Wallet update returned no rows while approving benefit.",
          );
        }

        const transaction = (
          await tx
            .insert(transactions)
            .values({
              walletId: wallet.id,
              userId: benefit.ownerUserId,
              rideId: benefit.sourceRideId,
              type: "benefit_credit",
              amount: approvedAmountClp,
              currency: "CLP",
              status: "completed",
              provider: "admin",
              providerTransactionId:
                `cash-overpayment-benefit:${benefit.sourceRideId}`,
              description:
                "Beneficio aprobado por dinero pagado de más en efectivo",
              metadata: {
                source: "cash_overpayment_benefit",
                sourceRideId: benefit.sourceRideId,
                requestedAmountClp,
                approvedAmountClp,
                fareClp: benefit.fareClp,
                paidClp: benefit.paidClp,
                approvedByUserId: input.reviewedByUserId,
                exclusiveToOwner: true,
                balanceBeforeClp: previousBalance,
                balanceAfterClp: nextBalance,
              },
            })
            .returning()
        )[0];

        if (!transaction) {
          throw AppError.internal(
            "Benefit transaction insert returned no rows.",
          );
        }

        const approvedBenefit = (
          await tx
            .update(cashOverpaymentBenefits)
            .set({
              status: "approved",
              approvedAmountClp,
              reviewedByUserId: input.reviewedByUserId,
              reviewedAt: now,
              adminDecisionReason:
                input.adminDecisionReason?.trim() || null,
              walletTransactionId: transaction.id,
              updatedAt: now,
            })
            .where(
              and(
                eq(cashOverpaymentBenefits.id, benefit.id),
                eq(
                  cashOverpaymentBenefits.status,
                  "pending_admin_review",
                ),
              ),
            )
            .returning()
        )[0];

        if (!approvedBenefit) {
          throw AppError.internal(
            "Benefit approval update returned no rows.",
          );
        }

        return {
          outcome: "approved",
          benefit: approvedBenefit,
          wallet: updatedWallet,
          transaction,
        } as const;
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(
        `Failed to approve cash overpayment benefit: ${String(err)}`,
      );
    }
  }

  async rejectCashOverpaymentBenefit(input: {
    id: string;
    reviewedByUserId: string;
    adminDecisionReason: string;
  }): Promise<CashOverpaymentBenefit | null> {
    try {
      const now = new Date();
      const [row] = await db
        .update(cashOverpaymentBenefits)
        .set({
          status: "rejected",
          approvedAmountClp: 0,
          reviewedByUserId: input.reviewedByUserId,
          reviewedAt: now,
          adminDecisionReason: input.adminDecisionReason,
          updatedAt: now,
        })
        .where(
          and(
            eq(cashOverpaymentBenefits.id, input.id),
            eq(
              cashOverpaymentBenefits.status,
              "pending_admin_review",
            ),
          ),
        )
        .returning();

      return row ?? null;
    } catch (err) {
      throw AppError.internal(
        `Failed to reject cash overpayment benefit: ${String(err)}`,
      );
    }
  }

  async createPaymentOrder(data: NewPaymentOrder): Promise<PaymentOrder> {
    try {
      const rows = await db
        .insert(paymentOrders)
        .values(data)
        .returning();

      const row = rows[0];

      if (!row) {
        throw AppError.internal("PaymentOrder insert returned no rows.");
      }

      return row;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(
        `Failed to create payment order: ${String(err)}`,
      );
    }
  }

  async findPaymentOrderByProviderOrderId(
    providerOrderId: string,
  ): Promise<PaymentOrder | null> {
    try {
      const rows = await db
        .select()
        .from(paymentOrders)
        .where(eq(paymentOrders.providerOrderId, providerOrderId))
        .limit(1);

      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(
        `Failed to query payment order: ${String(err)}`,
      );
    }
  }

  async updatePaymentOrderStatus(
    id: string,
    status: string,
    completedAt?: Date,
  ): Promise<PaymentOrder | null> {
    try {
      const set: Partial<typeof paymentOrders.$inferInsert> = { status };

      if (completedAt !== undefined) {
        set.completedAt = completedAt;
      }

      const rows = await db
        .update(paymentOrders)
        .set(set)
        .where(eq(paymentOrders.id, id))
        .returning();

      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(
        `Failed to update payment order status: ${String(err)}`,
      );
    }
  }
}
