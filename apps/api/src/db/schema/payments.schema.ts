import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { rideRequests } from "./rides.schema.js";
import { users } from "./users.schema.js";

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    rideRequestId: uuid("ride_request_id")
      .notNull()
      .references(() => rideRequests.id, { onDelete: "cascade" }),

    passengerUserId: uuid("passenger_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    amountClp: integer("amount_clp").notNull(),

    status: varchar("status", { length: 32 })
      .notNull()
      .default("pending"),

    provider: varchar("provider", { length: 32 }).notNull(),

    providerOrderId: varchar("provider_order_id", { length: 160 }),

    providerPaymentId: varchar("provider_payment_id", { length: 160 }),

    urlPay: text("url_pay"),

    rawProviderPayload: jsonb("raw_provider_payload"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    paidAt: timestamp("paid_at", { withTimezone: true }),

    rejectedAt: timestamp("rejected_at", { withTimezone: true }),

    failedAt: timestamp("failed_at", { withTimezone: true }),
  },
  (table) => ({
    rideRequestIdx: index("payments_ride_request_id_idx").on(table.rideRequestId),
    passengerUserIdx: index("payments_passenger_user_id_idx").on(table.passengerUserId),
    statusIdx: index("payments_status_idx").on(table.status),
    providerOrderIdx: index("payments_provider_order_id_idx").on(table.providerOrderId),
  }),
);

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
