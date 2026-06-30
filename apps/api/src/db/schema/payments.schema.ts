import { pgTable, uuid, varchar, integer, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { users } from "./users.schema.js";
import { rideRequests } from "./rides.schema.js";

export const payments = pgTable("payments", {
  id:               uuid("id").primaryKey().defaultRandom(),
  rideRequestId:    uuid("ride_request_id").notNull().references(() => rideRequests.id, { onDelete: "cascade" }),
  passengerUserId:  uuid("passenger_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

  provider:         varchar("provider", { length: 30 }).notNull().default("prontopaga"),
  providerOrderId:  varchar("provider_order_id", { length: 100 }),
  externalId:       varchar("external_id", { length: 100 }),

  amountClp:        integer("amount_clp").notNull(),

  // pending | processing | success | rejected | failed | refunded
  status:           varchar("status", { length: 30 }).notNull().default("pending"),

  failedAt:         timestamp("failed_at", { withTimezone: true }),

  urlPay:           text("url_pay"),
  webhookPayload:   jsonb("webhook_payload"),

  paidAt:           timestamp("paid_at",    { withTimezone: true }),
  rejectedAt:       timestamp("rejected_at", { withTimezone: true }),
  createdAt:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Payment    = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
