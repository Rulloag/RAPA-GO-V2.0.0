import { pgTable, uuid, varchar, text, timestamp, unique } from "drizzle-orm/pg-core";
import { users } from "./users.schema.js";

export const userBankAccounts = pgTable("user_bank_accounts", {
  id:                     uuid("id").primaryKey().defaultRandom(),
  userId:                 uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accountHolderName:      varchar("account_holder_name", { length: 150 }).notNull(),
  bankName:               varchar("bank_name",           { length: 100 }).notNull(),
  accountType:            varchar("account_type",        { length: 50  }).notNull(),
  accountNumberLast4:     varchar("account_number_last4",{ length: 4   }).notNull(),
  // AES-256-GCM aplicado en backend. Nunca se expone al cliente.
  accountNumberEncrypted: text("account_number_encrypted"),
  status:                 varchar("status", { length: 20 }).notNull().default("pending"),
  createdAt:              timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:              timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique("uq_user_bank_account").on(t.userId)]);

export type UserBankAccount    = typeof userBankAccounts.$inferSelect;
export type NewUserBankAccount = typeof userBankAccounts.$inferInsert;
