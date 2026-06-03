import { pgTable, uuid, varchar, timestamp, doublePrecision } from "drizzle-orm/pg-core";
import { users } from "./users.schema.js";
import { rideRequests } from "./rides.schema.js";

export const driverStatuses = pgTable("driver_statuses", {
  id:             uuid("id").primaryKey().defaultRandom(),
  driverUserId:   uuid("driver_user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  availability:   varchar("availability", { length: 20 }).notNull().default("unavailable"),
  currentZone:    varchar("current_zone", { length: 50 }),
  lastSeenAt:     timestamp("last_seen_at", { withTimezone: true }),
  currentRideId:  uuid("current_ride_id").references(() => rideRequests.id, { onDelete: "set null" }),
  currentLat:     doublePrecision("current_lat"),
  currentLng:     doublePrecision("current_lng"),
  locationUpdatedAt: timestamp("location_updated_at", { withTimezone: true }),
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:      timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DriverStatus    = typeof driverStatuses.$inferSelect;
export type NewDriverStatus = typeof driverStatuses.$inferInsert;
