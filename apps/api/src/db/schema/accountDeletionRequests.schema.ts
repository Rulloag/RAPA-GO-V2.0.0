import { sql } from "drizzle-orm";
import {
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

import { users } from "./users.schema.js";

export const accountDeletionRequests = pgTable(
  "account_deletion_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "set null" }),

    trackingCode: varchar("tracking_code", { length: 32 }).notNull(),

    requestChannel: varchar("request_channel", { length: 20 })
      .notNull()
      .default("app"),

    contactEmailHash: varchar("contact_email_hash", { length: 64 }),

    requesterRole: varchar("requester_role", { length: 30 }).notNull(),

    reason: varchar("reason", { length: 500 }),

    comment: text("comment"),

    requesterSnapshot: jsonb("requester_snapshot"),

    status: varchar("status", { length: 30 })
      .notNull()
      .default("pending"),

    reviewedByUserId: uuid("reviewed_by_user_id")
      .references(() => users.id, { onDelete: "set null" }),

    adminNote: text("admin_note"),

    requestedAt: timestamp("requested_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    verifiedAt: timestamp("verified_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    deadlineAt: timestamp("deadline_at", { withTimezone: true })
      .notNull()
      .default(sql`now() + interval '30 days'`),

    deferredUntil: timestamp("deferred_until", { withTimezone: true }),

    decisionReasonCode: varchar("decision_reason_code", { length: 60 }),

    retentionSummary: text("retention_summary"),

    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),

    processingAt: timestamp("processing_at", { withTimezone: true }),

    completedAt: timestamp("completed_at", { withTimezone: true }),

    failedAt: timestamp("failed_at", { withTimezone: true }),

    failureReason: text("failure_reason"),

    appleRevocationStatus: varchar("apple_revocation_status", {
      length: 30,
    })
      .notNull()
      .default("not_applicable"),

    appleRevocationAttemptedAt: timestamp(
      "apple_revocation_attempted_at",
      { withTimezone: true },
    ),

    appleRevokedAt: timestamp("apple_revoked_at", {
      withTimezone: true,
    }),

    appleRevocationError: text("apple_revocation_error"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    trackingCodeUidx: uniqueIndex(
      "account_deletion_requests_tracking_code_uidx",
    ).on(table.trackingCode),

    userRequestedIdx: index(
      "account_deletion_requests_user_requested_idx",
    ).on(table.userId, table.requestedAt),

    statusRequestedIdx: index(
      "account_deletion_requests_status_requested_idx",
    ).on(table.status, table.requestedAt),

    channelRequestedIdx: index(
      "account_deletion_requests_channel_requested_idx",
    ).on(table.requestChannel, table.requestedAt),
  }),
);

export const accountDeletionVerifications = pgTable(
  "account_deletion_verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "set null" }),

    emailHash: varchar("email_hash", { length: 64 }).notNull(),

    codeHash: varchar("code_hash", { length: 64 }).notNull(),

    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

    consumedAt: timestamp("consumed_at", { withTimezone: true }),

    revokedAt: timestamp("revoked_at", { withTimezone: true }),

    attempts: integer("attempts").notNull().default(0),

    requestIp: varchar("request_ip", { length: 64 }),

    requestUserAgent: varchar("request_user_agent", { length: 500 }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    emailCreatedIdx: index(
      "account_deletion_verifications_email_created_idx",
    ).on(table.emailHash, table.createdAt),

    expiresIdx: index(
      "account_deletion_verifications_expires_idx",
    ).on(table.expiresAt),
  }),
);

export type AccountDeletionRequest =
  typeof accountDeletionRequests.$inferSelect;

export type NewAccountDeletionRequest =
  typeof accountDeletionRequests.$inferInsert;

export type AccountDeletionVerification =
  typeof accountDeletionVerifications.$inferSelect;

export type NewAccountDeletionVerification =
  typeof accountDeletionVerifications.$inferInsert;
