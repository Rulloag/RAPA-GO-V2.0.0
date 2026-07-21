import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { rideRequests } from "./rides.schema.js";
import { users } from "./users.schema.js";

/**
 * Cierre de pago en efectivo informado por el conductor.
 * Es la fuente de verdad para beneficios y devoluciones por pago de más.
 */
export const cashPaymentClosures = pgTable(
  "cash_payment_closures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rideRequestId: uuid("ride_request_id")
      .notNull()
      .references(() => rideRequests.id, { onDelete: "restrict" }),
    passengerUserId: uuid("passenger_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    driverUserId: uuid("driver_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    fareClp: integer("fare_clp").notNull(),
    paidClp: integer("paid_clp").notNull(),
    overpaidClp: integer("overpaid_clp").notNull().default(0),
    decision: varchar("decision", { length: 24 }).notNull(),
    status: varchar("status", { length: 40 }).notNull(),
    resolutionType: varchar("resolution_type", { length: 24 }),
    resolutionReferenceId: uuid("resolution_reference_id"),
    driverNote: text("driver_note"),
    closedAt: timestamp("closed_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    rideUnique: uniqueIndex("cash_payment_closures_ride_uidx").on(table.rideRequestId),
    passengerIdx: index("cash_payment_closures_passenger_idx").on(table.passengerUserId, table.closedAt),
    driverIdx: index("cash_payment_closures_driver_idx").on(table.driverUserId, table.closedAt),
    statusIdx: index("cash_payment_closures_status_idx").on(table.status, table.closedAt),
  }),
);

export type CashPaymentClosure = typeof cashPaymentClosures.$inferSelect;
export type NewCashPaymentClosure = typeof cashPaymentClosures.$inferInsert;
