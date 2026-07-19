import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { rideRequests } from "./rides.schema.js";
import { users } from "./users.schema.js";

/**
 * Saldo de Beneficios de una cuenta RAPA GO.
 *
 * No es una billetera recargable: el backend solo puede aumentar el saldo al
 * aprobar un pago de más en efectivo y solo puede disminuirlo cuando la misma
 * cuenta decide usarlo en un viaje pagado en efectivo.
 */
export const wallets = pgTable("wallets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  balance: integer("balance").notNull().default(0),
  currency: text("currency").notNull().default("CLP"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const paymentMethods = pgTable("payment_methods", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider"),
  providerToken: text("provider_token"),
  lastFour: text("last_four"),
  expiryMonth: integer("expiry_month"),
  expiryYear: integer("expiry_year"),
  isDefault: boolean("is_default").notNull().default(false),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Libro mayor de Beneficios.
 *
 * benefit_credit: aprobación de dinero pagado de más en efectivo.
 * benefit_use: descuento consumido en un viaje en efectivo.
 * benefit_reversal: restitución del descuento si el viaje se cancela o termina No Show.
 * payment: registro histórico de una orden de pago antigua.
 */
export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    walletId: uuid("wallet_id")
      .notNull()
      .references(() => wallets.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    rideId: uuid("ride_id").references(() => rideRequests.id),
    type: text("type").notNull(),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull().default("CLP"),
    status: text("status").notNull().default("pending"),
    provider: text("provider"),
    providerTransactionId: text("provider_transaction_id"),
    description: text("description"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userCreatedIdx: index("transactions_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
    rideIdx: index("transactions_ride_id_idx").on(table.rideId),
    providerTransactionIdx: index(
      "transactions_provider_transaction_id_idx",
    ).on(table.providerTransactionId),
  }),
);

/**
 * Solicitud verificable de Beneficio por pago de más en efectivo.
 *
 * El monto solicitado se calcula en servidor usando la tarifa persistida del
 * viaje y el total declarado por la cuenta propietaria. El administrador puede
 * aprobar como máximo ese monto o rechazarlo. source_ride_id es único para que
 * el mismo viaje nunca genere dos beneficios.
 */
export const cashOverpaymentBenefits = pgTable(
  "cash_overpayment_benefits",
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

    status: varchar("status", { length: 40 })
      .notNull()
      .default("pending_admin_review"),

    fareClp: integer("fare_clp").notNull(),
    paidClp: integer("paid_clp").notNull(),
    requestedAmountClp: integer("requested_amount_clp").notNull(),
    approvedAmountClp: integer("approved_amount_clp"),

    requestReason: text("request_reason"),
    adminDecisionReason: text("admin_decision_reason"),

    reviewedByUserId: uuid("reviewed_by_user_id").references(
      () => users.id,
      { onDelete: "set null" },
    ),

    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),

    walletTransactionId: uuid("wallet_transaction_id").references(
      () => transactions.id,
      { onDelete: "set null" },
    ),

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
      "cash_overpayment_benefits_source_ride_uidx",
    ).on(table.sourceRideId),

    walletTransactionUnique: uniqueIndex(
      "cash_overpayment_benefits_wallet_transaction_uidx",
    ).on(table.walletTransactionId),

    ownerStatusIdx: index("cash_overpayment_benefits_owner_status_idx").on(
      table.ownerUserId,
      table.status,
    ),

    statusCreatedIdx: index(
      "cash_overpayment_benefits_status_created_idx",
    ).on(table.status, table.createdAt),
  }),
);

export const paymentOrders = pgTable("payment_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  rideId: uuid("ride_id").references(() => rideRequests.id),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("CLP"),
  status: text("status").notNull().default("pending"),
  provider: text("provider"),
  providerOrderId: text("provider_order_id"),
  paymentUrl: text("payment_url"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Wallet = typeof wallets.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type CashOverpaymentBenefit = typeof cashOverpaymentBenefits.$inferSelect;
export type PaymentOrder = typeof paymentOrders.$inferSelect;
export type PaymentMethod = typeof paymentMethods.$inferSelect;

export type NewWallet = typeof wallets.$inferInsert;
export type NewTransaction = typeof transactions.$inferInsert;
export type NewCashOverpaymentBenefit =
  typeof cashOverpaymentBenefits.$inferInsert;
export type NewPaymentOrder = typeof paymentOrders.$inferInsert;
