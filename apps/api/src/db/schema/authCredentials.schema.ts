import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users.schema.js";

/**
 * auth_credentials — stores hashed passwords for local authentication.
 *
 * SECURITY rules:
 *  - password_hash stores only the argon2id output. Never the raw password.
 *  - failed_login_attempts enables account lockout after repeated failures.
 *  - locked_until holds the timestamp until which login is denied.
 *  - This record must never be exposed outside the auth module.
 */
export const authCredentials = pgTable("auth_credentials", {
  id:                   uuid("id").primaryKey().defaultRandom(),
  userId:               uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  passwordHash:         text("password_hash").notNull(),
  passwordUpdatedAt:    timestamp("password_updated_at", { withTimezone: true }).notNull().defaultNow(),
  failedLoginAttempts:  integer("failed_login_attempts").notNull().default(0),
  lockedUntil:          timestamp("locked_until", { withTimezone: true }),
  createdAt:            timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:            timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AuthCredentials    = typeof authCredentials.$inferSelect;
export type NewAuthCredentials = typeof authCredentials.$inferInsert;
