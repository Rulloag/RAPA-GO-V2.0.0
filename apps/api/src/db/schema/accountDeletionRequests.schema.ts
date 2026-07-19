import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
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

    requesterRole: varchar("requester_role", { length: 30 }).notNull(),

    reason: varchar("reason", { length: 500 }).notNull(),

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

    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),

    processingAt: timestamp("processing_at", { withTimezone: true }),

    completedAt: timestamp("completed_at", { withTimezone: true }),

    failedAt: timestamp("failed_at", { withTimezone: true }),

    failureReason: text("failure_reason"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userRequestedIdx: index(
      "account_deletion_requests_user_requested_idx",
    ).on(table.userId, table.requestedAt),

    statusRequestedIdx: index(
      "account_deletion_requests_status_requested_idx",
    ).on(table.status, table.requestedAt),
  }),
);

export type AccountDeletionRequest =
  typeof accountDeletionRequests.$inferSelect;

export type NewAccountDeletionRequest =
  typeof accountDeletionRequests.$inferInsert;
