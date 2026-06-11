import { pgTable, uuid, varchar, text, timestamp, integer, boolean, doublePrecision } from "drizzle-orm/pg-core";
import { users } from "./users.schema.js";

export const rideRequests = pgTable("ride_requests", {
  id:                uuid("id").primaryKey().defaultRandom(),
  passengerUserId:   uuid("passenger_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  originText:        varchar("origin_text",      { length: 150 }).notNull(),
  destinationText:   varchar("destination_text", { length: 150 }).notNull(),
  notes:               text("notes"),
  estimatedFareClp:    integer("estimated_fare_clp"),
  originLat:           doublePrecision("origin_lat"),
  originLng:           doublePrecision("origin_lng"),
  destinationLat:      doublePrecision("destination_lat"),
  destinationLng:      doublePrecision("destination_lng"),
  distanceMeters:      integer("distance_meters"),
  durationSeconds:     integer("duration_seconds"),
  fareCalculationSource: varchar("fare_calculation_source", { length: 30 }).notNull().default("text"),
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
  isOfflineBooking:     boolean("is_offline_booking").notNull().default(false),
  offlinePassengerName:  varchar("offline_passenger_name",  { length: 120 }),
  offlinePassengerPhone: varchar("offline_passenger_phone", { length: 30 }),
  offlinePassengerEmail: varchar("offline_passenger_email", { length: 200 }),
  rideType:             varchar("ride_type", { length: 20 }).notNull().default("immediate"),
  scheduledPickupAt:    timestamp("scheduled_pickup_at",  { withTimezone: true }),
  priorityFeeClp:       integer("priority_fee_clp"),
  flightNumber:         varchar("flight_number", { length: 20 }),
  // Multi-destination: tracks which stop the ride is currently heading to (1-indexed)
  currentStopOrder:     integer("current_stop_order").notNull().default(1),
  // Queued offer: driver who accepted an offer for this ride before being assigned
  queuedOfferDriverId:  uuid("queued_offer_driver_id").references(() => users.id, { onDelete: "set null" }),
  // How this ride was assigned: automatic | manual | queued_offer
  assignmentMode:       varchar("assignment_mode", { length: 20 }).notNull().default("automatic"),
  // Passenger preference: "female" requests a female driver; null means no preference
  preferredDriverGender: varchar("preferred_driver_gender", { length: 10 }),
  createdAt:            timestamp("created_at",    { withTimezone: true }).notNull().defaultNow(),
  updatedAt:            timestamp("updated_at",    { withTimezone: true }).notNull().defaultNow(),
});

export type RideRequest    = typeof rideRequests.$inferSelect;
export type NewRideRequest = typeof rideRequests.$inferInsert;
