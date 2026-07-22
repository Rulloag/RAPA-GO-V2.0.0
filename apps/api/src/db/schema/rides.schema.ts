import { pgTable, uuid, varchar, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { users } from "./users.schema.js";

export const rideRequests = pgTable("ride_requests", {
  id:                uuid("id").primaryKey().defaultRandom(),
  passengerUserId:   uuid("passenger_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  originText:        varchar("origin_text",      { length: 150 }).notNull(),
  destinationText:   varchar("destination_text", { length: 150 }).notNull(),
  notes:               text("notes"),
  estimatedFareClp:    integer("estimated_fare_clp"),
  paymentMethod:      varchar("payment_method", { length: 30 }),
  paymentProvider:    varchar("payment_provider", { length: 40 }),
  walletBenefitRequested: boolean("wallet_benefit_requested").notNull().default(false),
  walletBenefitAppliedClp: integer("wallet_benefit_applied_clp").notNull().default(0),
  walletBenefitReversedClp: integer("wallet_benefit_reversed_clp").notNull().default(0),
  walletBenefitReversedAt: timestamp("wallet_benefit_reversed_at", { withTimezone: true }),
  fareBeforeWalletBenefitClp: integer("fare_before_wallet_benefit_clp"),
  driverUserId:      uuid("driver_user_id").references(() => users.id, { onDelete: "set null" }),
  status:            varchar("status", { length: 30 }).notNull().default("requested"),
  requestedAt:       timestamp("requested_at",  { withTimezone: true }).notNull().defaultNow(),
  acceptedAt:        timestamp("accepted_at",   { withTimezone: true }),
  enRouteAt:         timestamp("en_route_at",   { withTimezone: true }),
  arrivedAt:         timestamp("arrived_at",    { withTimezone: true }),
  startedAt:            timestamp("started_at",          { withTimezone: true }),
  completedAt:          timestamp("completed_at",        { withTimezone: true }),
  cancelledAt:          timestamp("cancelled_at",        { withTimezone: true }),
  cancellationReason:   text("cancellation_reason"),
  cancelledByUserId:    uuid("cancelled_by_user_id").references(() => users.id, { onDelete: "set null" }),
  cancelledByRole:      varchar("cancelled_by_role", { length: 30 }),
  createdAt:            timestamp("created_at",    { withTimezone: true }).notNull().defaultNow(),
  updatedAt:            timestamp("updated_at",    { withTimezone: true }).notNull().defaultNow(),
  isOfflineBooking:     boolean("is_offline_booking").notNull().default(false),
  offlinePassengerName: varchar("offline_passenger_name", { length: 120 }),
  offlinePassengerPhone: varchar("offline_passenger_phone", { length: 30 }),
  offlinePassengerEmail: varchar("offline_passenger_email", { length: 200 }),
});

export type RideRequest    = typeof rideRequests.$inferSelect;
export type NewRideRequest = typeof rideRequests.$inferInsert;
