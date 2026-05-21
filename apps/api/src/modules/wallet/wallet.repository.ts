import { eq, desc, count } from "drizzle-orm";
import { db } from "../../db/client.js";
import { wallets, transactions, paymentOrders } from "../../db/schema/index.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { Wallet, Transaction, PaymentOrder, NewTransaction, NewPaymentOrder } from "../../db/schema/index.js";

export class WalletRepository {
  async findByUserId(userId: string): Promise<Wallet | null> {
    try {
      const rows = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(`Failed to query wallet: ${String(err)}`);
    }
  }

  async createWallet(userId: string): Promise<Wallet> {
    try {
      const rows = await db.insert(wallets).values({ userId }).returning();
      const row = rows[0];
      if (!row) throw AppError.internal("Wallet insert returned no rows.");
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
      const rows = await db
        .update(wallets)
        .set({ balance: newBalance, updatedAt: new Date() })
        .where(eq(wallets.id, walletId))
        .returning();
      const row = rows[0];
      if (!row) throw AppError.internal("Wallet not found during balance update.");
      return row;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to update wallet balance: ${String(err)}`);
    }
  }

  async listTransactions(
    userId: string,
    offset: number,
    limit: number,
  ): Promise<{ items: Transaction[]; total: number }> {
    try {
      const [items, totalRows] = await Promise.all([
        db.select().from(transactions)
          .where(eq(transactions.userId, userId))
          .orderBy(desc(transactions.createdAt))
          .offset(offset)
          .limit(limit),
        db.select({ value: count() }).from(transactions).where(eq(transactions.userId, userId)),
      ]);
      const total = totalRows[0]?.value ?? 0;
      return { items, total };
    } catch (err) {
      throw AppError.internal(`Failed to list transactions: ${String(err)}`);
    }
  }

  async createTransaction(data: NewTransaction): Promise<Transaction> {
    try {
      const rows = await db.insert(transactions).values(data).returning();
      const row = rows[0];
      if (!row) throw AppError.internal("Transaction insert returned no rows.");
      return row;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to create transaction: ${String(err)}`);
    }
  }

  async createPaymentOrder(data: NewPaymentOrder): Promise<PaymentOrder> {
    try {
      const rows = await db.insert(paymentOrders).values(data).returning();
      const row = rows[0];
      if (!row) throw AppError.internal("PaymentOrder insert returned no rows.");
      return row;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to create payment order: ${String(err)}`);
    }
  }

  async findPaymentOrderByProviderOrderId(providerOrderId: string): Promise<PaymentOrder | null> {
    try {
      const rows = await db.select().from(paymentOrders)
        .where(eq(paymentOrders.providerOrderId, providerOrderId)).limit(1);
      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(`Failed to query payment order: ${String(err)}`);
    }
  }

  async updatePaymentOrderStatus(
    id: string,
    status: string,
    completedAt?: Date,
  ): Promise<PaymentOrder | null> {
    try {
      const set: Partial<typeof paymentOrders.$inferInsert> = { status };
      if (completedAt !== undefined) set.completedAt = completedAt;
      const rows = await db.update(paymentOrders).set(set).where(eq(paymentOrders.id, id)).returning();
      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(`Failed to update payment order status: ${String(err)}`);
    }
  }
}
