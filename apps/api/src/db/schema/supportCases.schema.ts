import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./users.schema.js";
import { rideRequests } from "./rides.schema.js";

export const supportCases = pgTable(
  "support_cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    trackingCode: varchar("tracking_code", { length: 40 }).notNull(),
    requesterUserId: uuid("requester_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    requesterRole: varchar("requester_role", { length: 30 }).notNull(),
    rideRequestId: uuid("ride_request_id").references(() => rideRequests.id, {
      onDelete: "set null",
    }),
    category: varchar("category", { length: 40 }).notNull(),
    subject: varchar("subject", { length: 140 }).notNull(),
    description: text("description").notNull(),
    priority: varchar("priority", { length: 20 }).notNull().default("normal"),
    status: varchar("status", { length: 30 }).notNull().default("open"),
    contactPhone: varchar("contact_phone", { length: 30 }),
    contactEmail: varchar("contact_email", { length: 255 }),
    lostItemDescription: text("lost_item_description"),
    lostItemLastSeenAt: timestamp("lost_item_last_seen_at", {
      withTimezone: true,
    }),
    assignedAdminUserId: uuid("assigned_admin_user_id").references(
      () => users.id,
      { onDelete: "set null" },
    ),
    adminResolution: text("admin_resolution"),
    firstResponseAt: timestamp("first_response_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    trackingCodeUidx: uniqueIndex("support_cases_tracking_code_uidx").on(
      table.trackingCode,
    ),
    requesterCreatedIdx: index("support_cases_requester_created_idx").on(
      table.requesterUserId,
      table.createdAt,
    ),
    statusPriorityIdx: index("support_cases_status_priority_idx").on(
      table.status,
      table.priority,
      table.updatedAt,
    ),
    categoryCreatedIdx: index("support_cases_category_created_idx").on(
      table.category,
      table.createdAt,
    ),
    rideIdx: index("support_cases_ride_idx").on(table.rideRequestId),
  }),
);

export const supportCaseEvents = pgTable(
  "support_case_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    supportCaseId: uuid("support_case_id")
      .notNull()
      .references(() => supportCases.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    actorRole: varchar("actor_role", { length: 30 }).notNull(),
    eventType: varchar("event_type", { length: 50 }).notNull(),
    fromStatus: varchar("from_status", { length: 30 }),
    toStatus: varchar("to_status", { length: 30 }),
    publicMessage: text("public_message"),
    internalNote: text("internal_note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    caseCreatedIdx: index("support_case_events_case_created_idx").on(
      table.supportCaseId,
      table.createdAt,
    ),
    actorCreatedIdx: index("support_case_events_actor_created_idx").on(
      table.actorUserId,
      table.createdAt,
    ),
  }),
);

export type SupportCase = typeof supportCases.$inferSelect;
export type NewSupportCase = typeof supportCases.$inferInsert;
export type SupportCaseEvent = typeof supportCaseEvents.$inferSelect;
export type NewSupportCaseEvent = typeof supportCaseEvents.$inferInsert;
