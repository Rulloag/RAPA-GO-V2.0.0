import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./users.schema.js";

/**
 * password_reset_tokens — one-time password recovery tokens.
 *
 * SECURITY:
 * - tokenHash stores SHA-256(token); the raw token is sent only by email.
 * - usedAt prevents replay.
 * - revokedAt allows invalidating undelivered or superseded tokens.
 * - deleting a user deletes their recovery tokens.
 */
export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    requestIp: varchar("request_ip", { length: 64 }),
    requestUserAgent: text("request_user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("password_reset_tokens_token_hash_uidx").on(
      table.tokenHash,
    ),
    index("password_reset_tokens_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
    index("password_reset_tokens_expires_idx").on(table.expiresAt),
  ],
);

export type PasswordResetToken =
  typeof passwordResetTokens.$inferSelect;
export type NewPasswordResetToken =
  typeof passwordResetTokens.$inferInsert;