import { pgTable, uuid, integer, text, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { users } from "./users.schema.js";
import { rideRequests } from "./rides.schema.js";

export const wallets = pgTable("wallets", {
  id:        uuid("id").primaryKey().defaultRandom(),
  userId:    uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  balance:   integer("balance").notNull().default(0),
  currency:  text("currency").notNull().default("CLP"),
  status:    text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const paymentMethods = pgTable("payment_methods", {
  id:            uuid("id").primaryKey().defaultRandom(),
  userId:        uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type:          text("type").notNull(),
  provider:      text("provider"),
  providerToken: text("provider_token"),
  lastFour:      text("last_four"),
  expiryMonth:   integer("expiry_month"),
  expiryYear:    integer("expiry_year"),
  isDefault:     boolean("is_default").notNull().default(false),
  status:        text("status").notNull().default("active"),
  createdAt:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:     timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const transactions = pgTable("transactions", {
  id:                    uuid("id").primaryKey().defaultRandom(),
  walletId:              uuid("wallet_id").notNull().references(() => wallets.id),
  userId:                uuid("user_id").notNull().references(() => users.id),
  rideId:                uuid("ride_id").references(() => rideRequests.id),
  type:                  text("type").notNull(),
  amount:                integer("amount").notNull(),
  currency:              text("currency").notNull().default("CLP"),
  status:                text("status").notNull().default("pending"),
  provider:              text("provider"),
  providerTransactionId: text("provider_transaction_id"),
  description:           text("description"),
  metadata:              jsonb("metadata"),
  createdAt:             timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:             timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const paymentOrders = pgTable("payment_orders", {
  id:              uuid("id").primaryKey().defaultRandom(),
  userId:          uuid("user_id").notNull().references(() => users.id),
  rideId:          uuid("ride_id").references(() => rideRequests.id),
  amount:          integer("amount").notNull(),
  currency:        text("currency").notNull().default("CLP"),
  status:          text("status").notNull().default("pending"),
  provider:        text("provider"),
  providerOrderId: text("provider_order_id"),
  paymentUrl:      text("payment_url"),
  expiresAt:       timestamp("expires_at",   { withTimezone: true }),
  completedAt:     timestamp("completed_at", { withTimezone: true }),
  metadata:        jsonb("metadata"),
  createdAt:       timestamp("created_at",   { withTimezone: true }).notNull().defaultNow(),
});

export type Wallet        = typeof wallets.$inferSelect;
export type Transaction   = typeof transactions.$inferSelect;
export type PaymentOrder  = typeof paymentOrders.$inferSelect;
export type PaymentMethod = typeof paymentMethods.$inferSelect;

export type NewWallet       = typeof wallets.$inferInsert;
export type NewTransaction  = typeof transactions.$inferInsert;
export type NewPaymentOrder = typeof paymentOrders.$inferInsert;
