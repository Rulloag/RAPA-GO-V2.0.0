import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { userBankAccounts } from "./bankAccounts.schema.js";
import { rideRequests } from "./rides.schema.js";
import { users } from "./users.schema.js";

/**
 * Devolución solicitada por dinero pagado de más en un viaje en efectivo.
 *
 * La cuenta bancaria se copia como snapshot cifrado al momento de solicitar la
 * devolución. Así una modificación posterior del perfil no cambia el destino
 * ya revisado por administración.
 */
export const cashOverpaymentRefundRequests = pgTable(
  "cash_overpayment_refund_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    sourceRideId: uuid("source_ride_id")
      .notNull()
      .references(() => rideRequests.id, { onDelete: "restrict" }),

    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),

    requestedByUserId: uuid("requested_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),

    bankAccountId: uuid("bank_account_id")
      .notNull()
      .references(() => userBankAccounts.id, { onDelete: "restrict" }),

    status: varchar("status", { length: 40 })
      .notNull()
      .default("pending_admin_review"),

    fareClp: integer("fare_clp").notNull(),
    paidClp: integer("paid_clp").notNull(),
    requestedAmountClp: integer("requested_amount_clp").notNull(),
    approvedAmountClp: integer("approved_amount_clp"),

    requestReason: text("request_reason"),
    adminDecisionReason: text("admin_decision_reason"),

    bankAccountHolderName: varchar("bank_account_holder_name", {
      length: 150,
    }).notNull(),
    bankName: varchar("bank_name", { length: 100 }).notNull(),
    bankAccountType: varchar("bank_account_type", { length: 50 }).notNull(),
    bankAccountNumberLast4: varchar("bank_account_number_last4", {
      length: 4,
    }).notNull(),
    bankAccountNumberEncrypted: text("bank_account_number_encrypted"),

    transferReference: varchar("transfer_reference", { length: 180 }),
    transferProofUrl: text("transfer_proof_url"),

    reviewedByUserId: uuid("reviewed_by_user_id").references(
      () => users.id,
      { onDelete: "set null" },
    ),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    sensitiveDataPurgedAt: timestamp("sensitive_data_purged_at", {
      withTimezone: true,
    }),

    requestedAt: timestamp("requested_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    sourceRideUnique: uniqueIndex(
      "cash_overpayment_refunds_source_ride_uidx",
    ).on(table.sourceRideId),
    ownerStatusIdx: index("cash_overpayment_refunds_owner_status_idx").on(
      table.ownerUserId,
      table.status,
    ),
    statusCreatedIdx: index("cash_overpayment_refunds_status_created_idx").on(
      table.status,
      table.createdAt,
    ),
  }),
);

export type CashOverpaymentRefundRequest =
  typeof cashOverpaymentRefundRequests.$inferSelect;
export type NewCashOverpaymentRefundRequest =
  typeof cashOverpaymentRefundRequests.$inferInsert;
