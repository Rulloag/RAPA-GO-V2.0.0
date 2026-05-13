import { pgTable, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users.schema.js";

export const rideRequests = pgTable("ride_requests", {
  id:                uuid("id").primaryKey().defaultRandom(),
  passengerUserId:   uuid("passenger_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  originText:        varchar("origin_text",      { length: 150 }).notNull(),
  destinationText:   varchar("destination_text", { length: 150 }).notNull(),
  notes:             text("notes"),
  status:            varchar("status", { length: 30 }).notNull().default("requested"),
  requestedAt:       timestamp("requested_at",  { withTimezone: true }).notNull().defaultNow(),
  cancelledAt:       timestamp("cancelled_at",  { withTimezone: true }),
  createdAt:         timestamp("created_at",    { withTimezone: true }).notNull().defaultNow(),
  updatedAt:         timestamp("updated_at",    { withTimezone: true }).notNull().defaultNow(),
});

export type RideRequest    = typeof rideRequests.$inferSelect;
export type NewRideRequest = typeof rideRequests.$inferInsert;
