import { pgTable, uuid, varchar, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users.schema.js";

/**
 * audit_events — immutable event log for all significant platform actions.
 * Records must never be updated or deleted (append-only).
 *
 * actor_user_id is nullable to support system events and unauthenticated actions
 * (e.g. failed login attempts from unknown IPs).
 */
export const auditEvents = pgTable("audit_events", {
  id:           uuid("id").primaryKey().defaultRandom(),
  actorUserId:  uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  eventType:    varchar("event_type", { length: 100 }).notNull(),
  entityType:   varchar("entity_type", { length: 100 }),
  entityId:     varchar("entity_id", { length: 255 }),
  metadata:     jsonb("metadata"),
  ipAddress:    varchar("ip_address", { length: 45 }),
  userAgent:    text("user_agent"),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AuditEvent    = typeof auditEvents.$inferSelect;
export type NewAuditEvent = typeof auditEvents.$inferInsert;
