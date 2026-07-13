import { pgTable, uuid, integer, text, timestamp, jsonb, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users.schema.js";
import { wallets } from "./wallets.schema.js";
import { rideRequests } from "./rides.schema.js";
import { payments } from "./payments.schema.js";

/**
 * Ledger autoritativo de créditos/movimientos de Wallet (Fase 4 — reemplaza el sistema
 * de créditos "CRÉDITOS PARA PRÓXIMO VIAJE" que hoy vive únicamente en localStorage del
 * cliente móvil bajo la clave rapago_wallet_benefits_v1).
 *
 * type: credit | debit | refund | adjustment | reversal
 * source: cancellation | no_show | admin | payment_refund | ride_payment | promotion
 * status: pending | available | applied | rejected | expired | reversed
 *
 * Las reversas se registran como nuevos movimientos (type=reversal) referenciando el
 * movimiento original vía metadata.originalTransactionId — nunca se edita destructivamente
 * un movimiento ya creado.
 */
export const walletTransactionsLedger = pgTable(
  "wallet_transactions_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    walletId: uuid("wallet_id").notNull().references(() => wallets.id, { onDelete: "cascade" }),
    userId:   uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

    rideId:    uuid("ride_id").references(() => rideRequests.id),
    paymentId: uuid("payment_id").references(() => payments.id),

    // Viaje donde el crédito fue efectivamente aplicado como descuento (distinto de rideId,
    // que es el viaje de origen que generó el crédito).
    appliedToRideId: uuid("applied_to_ride_id").references(() => rideRequests.id),

    type:   text("type").notNull(),
    source: text("source").notNull(),

    amountClp: integer("amount_clp").notNull(),
    currency:  text("currency").notNull().default("CLP"),

    status:         text("status").notNull().default("pending"),
    approvalStatus: text("approval_status").notNull().default("not_required"),

    idempotencyKey: text("idempotency_key").notNull().unique(),

    createdBy: uuid("created_by").references(() => users.id),
    approvedBy: uuid("approved_by").references(() => users.id),

    createdAt:  timestamp("created_at",  { withTimezone: true }).notNull().defaultNow(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    appliedAt:  timestamp("applied_at",  { withTimezone: true }),
    expiresAt:  timestamp("expires_at",  { withTimezone: true }),
    reversedAt: timestamp("reversed_at", { withTimezone: true }),

    metadata: jsonb("metadata"),
  },
  (table) => ({
    amountPositive: check("wallet_transactions_ledger_amount_positive", sql`${table.amountClp} > 0`),
  }),
);

export type WalletTransactionLedgerRow    = typeof walletTransactionsLedger.$inferSelect;
export type NewWalletTransactionLedgerRow = typeof walletTransactionsLedger.$inferInsert;
