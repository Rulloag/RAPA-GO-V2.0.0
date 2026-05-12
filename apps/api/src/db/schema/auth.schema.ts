import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users.schema.js";

/**
 * auth_sessions — tracks active access token sessions.
 *
 * SECURITY: only the bcrypt/argon2 hash of the access token is stored.
 * The raw token is never persisted in the database.
 */
export const authSessions = pgTable("auth_sessions", {
  id:              uuid("id").primaryKey().defaultRandom(),
  userId:          uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accessTokenHash: text("access_token_hash").notNull(),
  expiresAt:       timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt:       timestamp("revoked_at", { withTimezone: true }),
  createdAt:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * refresh_tokens — long-lived tokens for session renewal.
 *
 * SECURITY: only the hash of the refresh token is stored.
 * Rotation: when a refresh token is used, it is revoked and a new one is issued.
 * rotatedFromTokenId links the chain for audit purposes.
 */
export const refreshTokens = pgTable("refresh_tokens", {
  id:                  uuid("id").primaryKey().defaultRandom(),
  userId:              uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash:           text("token_hash").notNull(),
  expiresAt:           timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt:           timestamp("revoked_at", { withTimezone: true }),
  rotatedFromTokenId:  uuid("rotated_from_token_id"),
  createdAt:           timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AuthSession    = typeof authSessions.$inferSelect;
export type NewAuthSession = typeof authSessions.$inferInsert;
export type RefreshToken    = typeof refreshTokens.$inferSelect;
export type NewRefreshToken = typeof refreshTokens.$inferInsert;
