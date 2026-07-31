import {
  pgTable,
  uuid,
  varchar,
  boolean,
  text,
  timestamp,
  unique,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users.schema.js";

/**
 * oauth_identities — links a Rapa Go user to an external identity provider
 * (Apple, and any future provider).
 *
 * SECURITY:
 *  - provider_user_id (the provider's stable subject/`sub`) is the permanent
 *    identifier for linking — never the provider's email, which can change
 *    or be a private relay address.
 *  - encrypted_refresh_token stores the provider's refresh token (when one is
 *    issued) as AES-256-GCM ciphertext via OAuthTokenCrypto — never plaintext.
 *  - unique(provider, provider_user_id) is the concurrency guard against a
 *    duplicate-identity race: a second concurrent insert for the same
 *    provider identity fails at the database level.
 */
export const oauthIdentities = pgTable(
  "oauth_identities",
  {
    id:                     uuid("id").primaryKey().defaultRandom(),
    userId:                 uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

    provider:               varchar("provider", { length: 30 }).notNull(),
    providerUserId:         varchar("provider_user_id", { length: 255 }).notNull(),

    providerEmail:               varchar("provider_email", { length: 255 }),
    providerEmailVerified:       boolean("provider_email_verified").notNull().default(false),
    providerIsPrivateEmail:      boolean("provider_is_private_email").notNull().default(false),
    providerClientId:            varchar("provider_client_id", { length: 255 }),

    encryptedRefreshToken:  text("encrypted_refresh_token"),

    createdAt:              timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:              timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uqProviderUser:   unique("uq_oauth_identities_provider_user").on(t.provider, t.providerUserId),
    idxUserId:        index("idx_oauth_identities_user_id").on(t.userId),
    chkProviderValue: check("chk_oauth_identities_provider", sql`${t.provider} IN ('apple', 'facebook', 'google')`),
  }),
);

export type OAuthIdentity    = typeof oauthIdentities.$inferSelect;
export type NewOAuthIdentity = typeof oauthIdentities.$inferInsert;
