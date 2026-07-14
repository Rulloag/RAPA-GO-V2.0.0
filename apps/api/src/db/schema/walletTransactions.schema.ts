import { pgTable, uuid, integer, text, timestamp, jsonb, check, index, type AnyPgColumn } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users.schema.js";
import { wallets } from "./wallets.schema.js";
import { rideRequests } from "./rides.schema.js";
import { payments } from "./payments.schema.js";

/**
 * Ledger autoritativo de créditos Y débitos de Wallet (Fase 4 + Fase 4B — reemplaza el sistema
 * de créditos "CRÉDITOS PARA PRÓXIMO VIAJE" y de cargos pendientes por no-show/cancelación que
 * hoy viven únicamente en localStorage del cliente móvil: rapago_wallet_benefits_v1 y
 * RAPAGO_PASSENGER_PENDING_CHARGES_KEY).
 *
 * NOTA (Fase 4B): esta tabla fue editada in-place (no vía ALTER TABLE incremental) porque la
 * migración 0028 nunca fue aplicada a ninguna base de datos real — confirmado: sin registro en
 * meta/_journal.json, sin migraciones posteriores dependientes, rama sin pushear. No existen
 * bases de datos que dependan de la versión anterior de este esquema.
 *
 * type: credit | debit | refund | payment | adjustment | reversal
 * source: cancellation | no_show | admin | payment_refund | ride_payment | promotion
 * status: pending | available | applied | paid | rejected | expired | reversed | cancelled
 *   — la semántica de cada status DEPENDE del type; 'available' es EXCLUSIVO de credit,
 *     nunca se usa para una deuda (debit) pendiente.
 *
 * Las reversas se registran como nuevos movimientos (type=reversal, con reversalOfTransactionId
 * apuntando al movimiento original) — nunca se edita destructivamente un movimiento ya creado.
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

    // Trazabilidad (Fase 4B).
    policyVersion: text("policy_version").notNull(),
    actorRole:     text("actor_role").notNull(),

    // Solo relevante para type=debit: método de cobro. NULL mientras no exista un flujo de
    // cobro automático aprobado (Fase 4B §5) — solo 'admin_review' está habilitado hoy.
    collectionMethod: text("collection_method"),

    // Solo type=reversal: a qué movimiento anula.
    reversalOfTransactionId: uuid("reversal_of_transaction_id").references((): AnyPgColumn => walletTransactionsLedger.id),
    // Liga una fila 'paid' con la obligación 'pending' que salda.
    settlesTransactionId: uuid("settles_transaction_id").references((): AnyPgColumn => walletTransactionsLedger.id),

    createdBy: uuid("created_by").references(() => users.id),
    approvedBy: uuid("approved_by").references(() => users.id),

    createdAt:  timestamp("created_at",  { withTimezone: true }).notNull().defaultNow(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    appliedAt:  timestamp("applied_at",  { withTimezone: true }),
    paidAt:     timestamp("paid_at",     { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    expiresAt:  timestamp("expires_at",  { withTimezone: true }),
    reversedAt: timestamp("reversed_at", { withTimezone: true }),

    metadata: jsonb("metadata"),
  },
  (table) => ({
    amountPositive: check("wallet_transactions_ledger_amount_positive", sql`${table.amountClp} > 0`),
    userIdIdx: index("idx_wallet_tx_ledger_user_id").on(table.userId),
    walletIdIdx: index("idx_wallet_tx_ledger_wallet_id").on(table.walletId),
    statusIdx: index("idx_wallet_tx_ledger_status").on(table.status),
    rideIdIdx: index("idx_wallet_tx_ledger_ride_id").on(table.rideId),
    typeStatusIdx: index("idx_wallet_tx_ledger_type_status").on(table.type, table.status),
  }),
);

export type WalletTransactionLedgerRow    = typeof walletTransactionsLedger.$inferSelect;
export type NewWalletTransactionLedgerRow = typeof walletTransactionsLedger.$inferInsert;
