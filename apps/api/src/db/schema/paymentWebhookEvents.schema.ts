import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { payments } from "./payments.schema.js";

/** Registro idempotente y auditable de webhooks de proveedores de pago. */
export const paymentWebhookEvents = pgTable(
  "payment_webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: varchar("provider", { length: 32 }).notNull(),
    eventKey: varchar("event_key", { length: 128 }).notNull(),
    paymentId: uuid("payment_id").references(() => payments.id, { onDelete: "set null" }),
    providerPaymentId: varchar("provider_payment_id", { length: 160 }),
    requestId: varchar("request_id", { length: 160 }),
    action: varchar("action", { length: 100 }),
    payloadHash: varchar("payload_hash", { length: 64 }).notNull(),
    payload: jsonb("payload").notNull(),
    status: varchar("status", { length: 24 }).notNull().default("processing"),
    errorMessage: text("error_message"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    providerEventUnique: uniqueIndex("payment_webhook_events_provider_key_uidx").on(table.provider, table.eventKey),
    paymentIdx: index("payment_webhook_events_payment_idx").on(table.paymentId, table.receivedAt),
    statusIdx: index("payment_webhook_events_status_idx").on(table.status, table.receivedAt),
  }),
);

export type PaymentWebhookEvent = typeof paymentWebhookEvents.$inferSelect;
export type NewPaymentWebhookEvent = typeof paymentWebhookEvents.$inferInsert;
