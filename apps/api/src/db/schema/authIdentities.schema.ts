import {
  boolean,
  index,
  text,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./users.schema.js";

/**
 * auth_identities — persistent external authentication identities.
 *
 * SECURITY:
 * - provider_subject is the stable identifier returned by the provider.
 * - an identity can belong to only one RAPA GO user.
 * - matching emails never merge accounts automatically.
 */
export const authIdentities = pgTable(
  "auth_identities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 30 }).notNull(),
    providerSubject: varchar("provider_subject", { length: 255 }).notNull(),
    providerEmail: varchar("provider_email", { length: 255 }),
    emailVerified: boolean("email_verified").notNull().default(false),
    providerIsPrivateEmail: boolean("provider_is_private_email")
      .notNull()
      .default(false),
    encryptedRefreshToken: text("encrypted_refresh_token"),
    linkedAt: timestamp("linked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("auth_identities_provider_subject_uidx").on(
      table.provider,
      table.providerSubject,
    ),
    uniqueIndex("auth_identities_user_provider_uidx").on(
      table.userId,
      table.provider,
    ),
    index("auth_identities_user_idx").on(table.userId),
  ],
);

export type AuthIdentity = typeof authIdentities.$inferSelect;
export type NewAuthIdentity = typeof authIdentities.$inferInsert;
