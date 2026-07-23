import {
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./users.schema.js";

/**
 * auth_credentials — local password authentication state.
 *
 * Password hashes are never returned by public API serializers. Login
 * throttling is stored per user so it remains effective across instances.
 */
export const authCredentials = pgTable("auth_credentials", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  passwordHash: text("password_hash").notNull(),
  passwordUpdatedAt: timestamp("password_updated_at", {
    withTimezone: true,
  })
    .notNull()
    .defaultNow(),
  failedLoginAttempts: integer("failed_login_attempts")
    .notNull()
    .default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type AuthCredential = typeof authCredentials.$inferSelect;
export type NewAuthCredential = typeof authCredentials.$inferInsert;
