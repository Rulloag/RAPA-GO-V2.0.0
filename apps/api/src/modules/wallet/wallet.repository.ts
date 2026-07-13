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

  async findTransactionByProviderTransactionId(
    providerTransactionId: string,
  ): Promise<Transaction | null> {
    try {
      const rows = await db.select().from(transactions)
        .where(eq(transactions.providerTransactionId, providerTransactionId))
        .limit(1);
      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(`Failed to query transaction by provider id: ${String(err)}`);
    }
  }

  async creditUserWallet(input: {
    userId: string;
    amountClp: number;
    rideId?: string | null;
    description: string;
    metadata?: Record<string, unknown>;
    providerTransactionId?: string | null;
  }): Promise<{ wallet: Wallet; transaction: Transaction }> {
    try {
      return await db.transaction(async (tx) => {
        let wallet = (await tx.select().from(wallets).where(eq(wallets.userId, input.userId)).limit(1))[0] ?? null;

        if (!wallet) {
          const walletRows = await tx.insert(wallets).values({ userId: input.userId }).returning();
          wallet = walletRows[0] ?? null;
          if (!wallet) throw AppError.internal("Wallet insert returned no rows.");
        }

        const nextBalance = wallet.balance + input.amountClp;

        const updatedWalletRows = await tx
          .update(wallets)
          .set({ balance: nextBalance, updatedAt: new Date() })
          .where(eq(wallets.id, wallet.id))
          .returning();

        const updatedWallet = updatedWalletRows[0];
        if (!updatedWallet) throw AppError.internal("Wallet not found during credit update.");

        const transactionRows = await tx
          .insert(transactions)
          .values({
            walletId: wallet.id,
            userId: input.userId,
            ...(input.rideId ? { rideId: input.rideId } : {}),
            type: "credit",
            amount: input.amountClp,
            currency: "CLP",
            status: "completed",
            provider: "admin",
            ...(input.providerTransactionId ? { providerTransactionId: input.providerTransactionId } : {}),
            description: input.description,
            ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
          })
          .returning();

        const transaction = transactionRows[0];
        if (!transaction) throw AppError.internal("Transaction insert returned no rows.");

        return { wallet: updatedWallet, transaction };
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal("Failed to credit wallet: " + String(err));
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
