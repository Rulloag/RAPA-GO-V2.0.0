import { db } from "../../db/client.js";
import { walletTransactionsLedger } from "../../db/schema/index.js";
import type { NewWalletTransactionLedgerRow, WalletTransactionLedgerRow } from "../../db/schema/index.js";
import { and, eq, sql } from "drizzle-orm";
import { AppError } from "../../shared/errors/AppError.js";

export class WalletTransactionsRepository {
  async findByIdempotencyKey(idempotencyKey: string): Promise<WalletTransactionLedgerRow | null> {
    const rows = await db
      .select()
      .from(walletTransactionsLedger)
      .where(eq(walletTransactionsLedger.idempotencyKey, idempotencyKey))
      .limit(1);
    return rows[0] ?? null;
  }

  async findById(id: string): Promise<WalletTransactionLedgerRow | null> {
    const rows = await db
      .select()
      .from(walletTransactionsLedger)
      .where(eq(walletTransactionsLedger.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async listByUser(userId: string, status?: string): Promise<WalletTransactionLedgerRow[]> {
    const conditions = status
      ? and(eq(walletTransactionsLedger.userId, userId), eq(walletTransactionsLedger.status, status))
      : eq(walletTransactionsLedger.userId, userId);

    return db
      .select()
      .from(walletTransactionsLedger)
      .where(conditions)
      .orderBy(sql`${walletTransactionsLedger.createdAt} DESC`);
  }

  async getAvailableBalance(userId: string): Promise<number> {
    const rows = await db
      .select({ total: sql<string>`COALESCE(SUM(${walletTransactionsLedger.amountClp}), 0)` })
      .from(walletTransactionsLedger)
      .where(and(eq(walletTransactionsLedger.userId, userId), eq(walletTransactionsLedger.status, "available")));

    return Number(rows[0]?.total ?? 0);
  }

  async create(data: NewWalletTransactionLedgerRow): Promise<WalletTransactionLedgerRow> {
    try {
      const rows = await db.insert(walletTransactionsLedger).values(data).returning();
      const row = rows[0];
      if (!row) throw AppError.internal("Wallet transaction insert returned no rows.");
      return row;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to create wallet transaction: ${String(err)}`);
    }
  }

  /**
   * Aprueba un crédito pendiente. Solo transiciona si el estado actual es 'pending' —
   * la condición WHERE en el UPDATE es atómica a nivel de fila en Postgres, por lo que
   * dos aprobaciones concurrentes del mismo id no pueden ambas tener éxito.
   */
  async approvePending(id: string, approvedBy: string): Promise<WalletTransactionLedgerRow | null> {
    const rows = await db
      .update(walletTransactionsLedger)
      .set({
        status: "available",
        approvalStatus: "admin_approved",
        approvedBy,
        approvedAt: new Date(),
      })
      .where(and(eq(walletTransactionsLedger.id, id), eq(walletTransactionsLedger.status, "pending")))
      .returning();
    return rows[0] ?? null;
  }

  async rejectPending(id: string, rejectedBy: string, reason: string | null): Promise<WalletTransactionLedgerRow | null> {
    const rows = await db
      .update(walletTransactionsLedger)
      .set({
        status: "rejected",
        approvalStatus: "admin_rejected",
        approvedBy: rejectedBy,
        approvedAt: new Date(),
        metadata: reason ? { rejectionReason: reason } : null,
      })
      .where(and(eq(walletTransactionsLedger.id, id), eq(walletTransactionsLedger.status, "pending")))
      .returning();
    return rows[0] ?? null;
  }

  /**
   * Aplica (debita) un crédito disponible dentro de una transacción SQL: la condición
   * WHERE status='available' en el UPDATE garantiza que dos solicitudes concurrentes no
   * puedan aplicar el mismo crédito dos veces (la segunda encuentra 0 filas afectadas).
   */
  async applyAvailableCredit(input: {
    walletTransactionId: string;
    userId: string;
    rideId: string;
    debitIdempotencyKey: string;
  }): Promise<{ credit: WalletTransactionLedgerRow; debit: WalletTransactionLedgerRow } | null> {
    return db.transaction(async (tx) => {
      const updatedRows = await tx
        .update(walletTransactionsLedger)
        .set({
          status: "applied",
          appliedAt: new Date(),
          appliedToRideId: input.rideId,
        })
        .where(
          and(
            eq(walletTransactionsLedger.id, input.walletTransactionId),
            eq(walletTransactionsLedger.userId, input.userId),
            eq(walletTransactionsLedger.status, "available"),
          ),
        )
        .returning();

      const credit = updatedRows[0];
      if (!credit) return null;

      const debitRows = await tx
        .insert(walletTransactionsLedger)
        .values({
          walletId: credit.walletId,
          userId: input.userId,
          rideId: credit.rideId,
          appliedToRideId: input.rideId,
          type: "debit",
          source: credit.source,
          amountClp: credit.amountClp,
          currency: credit.currency,
          status: "applied",
          approvalStatus: "not_required",
          idempotencyKey: input.debitIdempotencyKey,
          createdBy: input.userId,
          appliedAt: new Date(),
          metadata: { originalTransactionId: credit.id },
        })
        .returning();

      const debit = debitRows[0];
      if (!debit) throw AppError.internal("Debit insert returned no rows.");

      return { credit, debit };
    });
  }
}
