import { pgTable, uuid, varchar, text, timestamp, integer, boolean, doublePrecision } from "drizzle-orm/pg-core";
import { users } from "./users.schema.js";

export const rideRequests = pgTable("ride_requests", {
  id:                uuid("id").primaryKey().defaultRandom(),
  passengerUserId:   uuid("passenger_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  originText:        varchar("origin_text",      { length: 150 }).notNull(),
  destinationText:   varchar("destination_text", { length: 150 }).notNull(),
  originLat:         doublePrecision("origin_lat"),
  originLng:         doublePrecision("origin_lng"),
  destinationLat:    doublePrecision("destination_lat"),
  destinationLng:    doublePrecision("destination_lng"),
  distanceMeters:    integer("distance_meters"),
  durationSeconds:   integer("duration_seconds"),
  fareCalculationSource: varchar("fare_calculation_source", { length: 30 }).notNull().default("text"),
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
  // Categoría solicitada por el pasajero (standard | xl | extra_luggage).
  // Informa/advierte; NUNCA filtra visibilidad ni bloquea accept.
  requestedVehicleCategory: varchar("requested_vehicle_category", { length: 30 })
    .notNull()
    .default("standard"),
  // Snapshot de la categoría del vehículo del conductor al aceptar.
  assignedVehicleCategory: varchar("assigned_vehicle_category", { length: 30 }),
  createdAt:            timestamp("created_at",    { withTimezone: true }).notNull().defaultNow(),
  updatedAt:            timestamp("updated_at",    { withTimezone: true }).notNull().defaultNow(),
});

export type RideRequest    = typeof rideRequests.$inferSelect;
export type NewRideRequest = typeof rideRequests.$inferInsert;
