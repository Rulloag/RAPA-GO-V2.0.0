import { db } from "../../db/client.js";
import { walletTransactionsLedger } from "../../db/schema/index.js";
import type { NewWalletTransactionLedgerRow, WalletTransactionLedgerRow } from "../../db/schema/index.js";
import { and, eq, sql } from "drizzle-orm";
import { AppError } from "../../shared/errors/AppError.js";
import { CURRENT_LEDGER_POLICY_VERSION } from "./walletPolicy.constants.js";
import type { DbExecutor } from "../rides/rides.repository.js";

export class WalletTransactionsRepository {
  async findByIdempotencyKey(idempotencyKey: string, executor: DbExecutor = db): Promise<WalletTransactionLedgerRow | null> {
    const rows = await executor
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

  async listByUser(userId: string, status?: string, type?: string): Promise<WalletTransactionLedgerRow[]> {
    const filters = [eq(walletTransactionsLedger.userId, userId)];
    if (status) filters.push(eq(walletTransactionsLedger.status, status));
    if (type) filters.push(eq(walletTransactionsLedger.type, type));

    return db
      .select()
      .from(walletTransactionsLedger)
      .where(and(...filters))
      .orderBy(sql`${walletTransactionsLedger.createdAt} DESC`);
  }

  async getAvailableBalance(userId: string): Promise<number> {
    const rows = await db
      .select({ total: sql<string>`COALESCE(SUM(${walletTransactionsLedger.amountClp}), 0)` })
      .from(walletTransactionsLedger)
      .where(and(eq(walletTransactionsLedger.userId, userId), eq(walletTransactionsLedger.status, "available")));

    return Number(rows[0]?.total ?? 0);
  }

  /**
   * Proyección de saldo derivada 100% del ledger (nunca un número mutable almacenado).
   * Cada total corresponde a una combinación type+status semánticamente distinta —
   * ver walletTransactions.schema.ts para la matriz de transiciones válidas.
   */
  async getWalletBalanceSummary(userId: string): Promise<{
    availableCreditClp: number;
    pendingCreditClp: number;
    pendingDebitClp: number;
    paidAmountClp: number;
    refundedAmountClp: number;
    reversedAmountClp: number;
  }> {
    async function sumWhere(condition: ReturnType<typeof and>): Promise<number> {
      const rows = await db
        .select({ total: sql<string>`COALESCE(SUM(${walletTransactionsLedger.amountClp}), 0)` })
        .from(walletTransactionsLedger)
        .where(condition);
      return Number(rows[0]?.total ?? 0);
    }

    const [availableCreditClp, pendingCreditClp, pendingDebitClp, paidAmountClp, refundedAmountClp, reversedAmountClp] =
      await Promise.all([
        sumWhere(and(eq(walletTransactionsLedger.userId, userId), eq(walletTransactionsLedger.type, "credit"), eq(walletTransactionsLedger.status, "available"))),
        sumWhere(and(eq(walletTransactionsLedger.userId, userId), eq(walletTransactionsLedger.type, "credit"), eq(walletTransactionsLedger.status, "pending"))),
        sumWhere(and(eq(walletTransactionsLedger.userId, userId), eq(walletTransactionsLedger.type, "debit"), eq(walletTransactionsLedger.status, "pending"))),
        sumWhere(and(eq(walletTransactionsLedger.userId, userId), eq(walletTransactionsLedger.status, "paid"))),
        sumWhere(and(eq(walletTransactionsLedger.userId, userId), eq(walletTransactionsLedger.type, "refund"), eq(walletTransactionsLedger.status, "paid"))),
        sumWhere(and(eq(walletTransactionsLedger.userId, userId), eq(walletTransactionsLedger.status, "reversed"))),
      ]);

    return { availableCreditClp, pendingCreditClp, pendingDebitClp, paidAmountClp, refundedAmountClp, reversedAmountClp };
  }

  async create(data: NewWalletTransactionLedgerRow, executor: DbExecutor = db): Promise<WalletTransactionLedgerRow> {
    try {
      const rows = await executor.insert(walletTransactionsLedger).values(data).returning();
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
   * Marca una obligación (debit) pendiente como pagada. Solo transiciona desde 'pending'
   * (nunca desde 'available', que no existe para debit — regla explícita de Fase 4B).
   */
  async markDebitPaid(id: string, resolvedBy: string, collectionMethod: string): Promise<WalletTransactionLedgerRow | null> {
    const rows = await db
      .update(walletTransactionsLedger)
      .set({
        status: "paid",
        paidAt: new Date(),
        approvedBy: resolvedBy,
        collectionMethod,
      })
      .where(
        and(
          eq(walletTransactionsLedger.id, id),
          eq(walletTransactionsLedger.type, "debit"),
          eq(walletTransactionsLedger.status, "pending"),
        ),
      )
      .returning();
    return rows[0] ?? null;
  }

  /** Condona (cancela) una obligación pendiente sin cobrarla. Requiere motivo (validado en Zod). */
  async cancelDebit(id: string, resolvedBy: string, reason: string): Promise<WalletTransactionLedgerRow | null> {
    const rows = await db
      .update(walletTransactionsLedger)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        approvedBy: resolvedBy,
        metadata: { cancellationReason: reason },
      })
      .where(
        and(
          eq(walletTransactionsLedger.id, id),
          eq(walletTransactionsLedger.type, "debit"),
          eq(walletTransactionsLedger.status, "pending"),
        ),
      )
      .returning();
    return rows[0] ?? null;
  }

  /**
   * Crea un movimiento type=reversal que anula un movimiento anterior — nunca edita el
   * original. El movimiento original se marca reversed en la MISMA transacción.
   */
  async reverseTransaction(input: {
    originalTransactionId: string;
    resolvedBy: string;
    reason: string;
  }): Promise<{ original: WalletTransactionLedgerRow; reversal: WalletTransactionLedgerRow } | null> {
    return db.transaction(async (tx) => {
      const originalRows = await tx
        .select()
        .from(walletTransactionsLedger)
        .where(eq(walletTransactionsLedger.id, input.originalTransactionId))
        .limit(1);

      const original = originalRows[0];
      if (!original) return null;
      if (original.status === "reversed") return null;

      const updatedRows = await tx
        .update(walletTransactionsLedger)
        .set({ status: "reversed", reversedAt: new Date() })
        .where(and(eq(walletTransactionsLedger.id, original.id), sql`${walletTransactionsLedger.status} <> 'reversed'`))
        .returning();

      const updatedOriginal = updatedRows[0];
      if (!updatedOriginal) return null;

      const reversalRows = await tx
        .insert(walletTransactionsLedger)
        .values({
          walletId: original.walletId,
          userId: original.userId,
          rideId: original.rideId,
          appliedToRideId: original.appliedToRideId,
          type: "reversal",
          source: original.source,
          amountClp: original.amountClp,
          currency: original.currency,
          status: "reversed",
          approvalStatus: "not_required",
          idempotencyKey: `reversal:${original.id}`,
          policyVersion: CURRENT_LEDGER_POLICY_VERSION,
          actorRole: "admin",
          createdBy: input.resolvedBy,
          reversalOfTransactionId: original.id,
          reversedAt: new Date(),
          metadata: { reversalReason: input.reason },
        })
        .returning();

      const reversal = reversalRows[0];
      if (!reversal) throw AppError.internal("Reversal insert returned no rows.");

      return { original: updatedOriginal, reversal };
    });
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
  }): Promise<{ credit: WalletTransactionLedgerRow; consumptionRecord: WalletTransactionLedgerRow } | null> {
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

      const consumptionRows = await tx
        .insert(walletTransactionsLedger)
        .values({
          walletId: credit.walletId,
          userId: input.userId,
          rideId: credit.rideId,
          appliedToRideId: input.rideId,
          type: "credit",
          source: credit.source,
          amountClp: credit.amountClp,
          currency: credit.currency,
          // Fila de bookkeeping que registra el CONSUMO del crédito (no es una obligación del
          // pasajero — 'debit' en el sentido de Fase 4B es exclusivamente una deuda pendiente,
          // nunca el registro de que un crédito se gastó).
          status: "applied",
          approvalStatus: "not_required",
          idempotencyKey: input.debitIdempotencyKey,
          policyVersion: CURRENT_LEDGER_POLICY_VERSION,
          actorRole: "passenger",
          createdBy: input.userId,
          appliedAt: new Date(),
          settlesTransactionId: credit.id,
          metadata: { originalTransactionId: credit.id, kind: "credit_consumption_record" },
        })
        .returning();

      const consumptionRecord = consumptionRows[0];
      if (!consumptionRecord) throw AppError.internal("Credit consumption record insert returned no rows.");

      return { credit, consumptionRecord };
    });
  }
}
