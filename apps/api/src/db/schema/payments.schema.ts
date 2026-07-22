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

    // "ride" = pago principal del viaje.
    // "fast_search" = recargo independiente de RapaGo más veloz ($800).
    paymentPurpose: varchar("payment_purpose", { length: 32 })
      .notNull()
      .default("ride"),

    status: varchar("status", { length: 32 })
      .notNull()
      .default("pending"),

    provider: varchar("provider", { length: 32 }).notNull(),

    providerOrderId: varchar("provider_order_id", { length: 160 }),
    providerPaymentId: varchar("provider_payment_id", { length: 160 }),
    urlPay: text("url_pay"),
    rawProviderPayload: jsonb("raw_provider_payload"),

    /** Estado persistido de la devolución al medio original. */
    refundStatus: varchar("refund_status", { length: 32 }),
    refundProviderId: varchar("refund_provider_id", { length: 160 }),
    refundIdempotencyKey: varchar("refund_idempotency_key", { length: 160 }),
    refundRequestedAt: timestamp("refund_requested_at", {
      withTimezone: true,
    }),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
    refundFailedAt: timestamp("refund_failed_at", { withTimezone: true }),
    refundFailureReason: text("refund_failure_reason"),

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
    rideRequestIdx: index("payments_ride_request_id_idx").on(
      table.rideRequestId,
    ),
    passengerUserIdx: index("payments_passenger_user_id_idx").on(
      table.passengerUserId,
    ),
    statusIdx: index("payments_status_idx").on(table.status),
    providerOrderIdx: index("payments_provider_order_id_idx").on(
      table.providerOrderId,
    ),
    ridePurposeStatusIdx: index("payments_ride_purpose_status_idx").on(
      table.rideRequestId,
      table.paymentPurpose,
      table.status,
    ),
    refundStatusIdx: index("payments_refund_status_idx").on(
      table.refundStatus,
    ),
    refundIdempotencyUnique: uniqueIndex(
      "payments_refund_idempotency_key_uidx",
    ).on(table.refundIdempotencyKey),
  }),
);

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
