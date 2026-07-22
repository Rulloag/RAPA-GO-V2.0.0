import {
  pgTable,
  uuid,
  text,
  integer,
  doublePrecision,
  timestamp,
  unique,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { rideRequests } from "./rides.schema.js";

export const rideStops = pgTable(
  "ride_stops",
  {
    id:                     uuid("id").primaryKey().defaultRandom(),
    rideRequestId:          uuid("ride_request_id").notNull().references(() => rideRequests.id, { onDelete: "cascade" }),
    stopOrder:              integer("stop_order").notNull(),
    label:                  text("label").notNull(),
    lat:                    doublePrecision("lat").notNull(),
    lng:                    doublePrecision("lng").notNull(),
    segmentDistanceMeters:  integer("segment_distance_meters"),
    segmentDurationSeconds: integer("segment_duration_seconds"),
    segmentFareClp:         integer("segment_fare_clp"),
    arrivedAt:              timestamp("arrived_at",   { withTimezone: true }),
    completedAt:            timestamp("completed_at", { withTimezone: true }),
    createdAt:              timestamp("created_at",   { withTimezone: true }).notNull().defaultNow(),
    updatedAt:              timestamp("updated_at",   { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uqRideOrder: unique("uq_ride_stops_ride_order").on(t.rideRequestId, t.stopOrder),
    chkStopOrderPositive:  check("chk_ride_stops_stop_order_positive",  sql`${t.stopOrder} >= 1`),
    chkSegmentDistance:    check("chk_ride_stops_segment_distance",     sql`${t.segmentDistanceMeters} IS NULL OR ${t.segmentDistanceMeters} >= 0`),
    chkSegmentDuration:    check("chk_ride_stops_segment_duration",     sql`${t.segmentDurationSeconds} IS NULL OR ${t.segmentDurationSeconds} >= 0`),
    chkSegmentFare:        check("chk_ride_stops_segment_fare",         sql`${t.segmentFareClp} IS NULL OR ${t.segmentFareClp} >= 0`),
  }),
);

export type RideStop    = typeof rideStops.$inferSelect;
export type NewRideStop = typeof rideStops.$inferInsert;
