import {
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./users.schema.js";

/**
 * facebook_login_exchanges — one-time, short-lived exchange codes.
 *
 * SECURITY:
 * - Browser redirects never receive an access token in the URL.
 * - Only a SHA-256 hash of the exchange code is stored.
 * - A code expires quickly and can be consumed only once.
 */
export const facebookLoginExchanges = pgTable(
  "facebook_login_exchanges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    codeHash: varchar("code_hash", { length: 64 }).notNull(),
    purpose: varchar("purpose", { length: 20 }).notNull().default("login"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_fb_login_exchange_code_hash").on(table.codeHash),
    index("idx_fb_login_exchange_user").on(table.userId),
    index("idx_fb_login_exchange_expires").on(table.expiresAt),
  ],
);

export type FacebookLoginExchange =
  typeof facebookLoginExchanges.$inferSelect;
