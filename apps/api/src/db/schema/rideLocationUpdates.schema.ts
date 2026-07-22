import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  real,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { rideRequests } from "./rides.schema.js";
import { users } from "./users.schema.js";

/**
 * ride_location_updates — server-side source of truth for live driver tracking.
 *
 * Privacy rules:
 * - Only the assigned driver can write points.
 * - Only the ride passenger, assigned driver, or an admin can read them.
 * - Points expire automatically and can be purged after the retention window.
 */
export const rideLocationUpdates = pgTable(
  "ride_location_updates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rideId: uuid("ride_id")
      .notNull()
      .references(() => rideRequests.id, { onDelete: "cascade" }),
    driverUserId: uuid("driver_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    accuracyMeters: real("accuracy_meters"),
    headingDegrees: real("heading_degrees"),
    speedMetersPerSecond: real("speed_meters_per_second"),
    altitudeMeters: real("altitude_meters"),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    source: varchar("source", { length: 30 }).notNull().default("foreground_native"),
    appState: varchar("app_state", { length: 20 }).notNull().default("foreground"),
    sequenceNumber: integer("sequence_number"),
    isMocked: boolean("is_mocked").notNull().default(false),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    rideCapturedIdx: index("ride_location_updates_ride_captured_idx").on(
      table.rideId,
      table.capturedAt,
    ),
    driverCapturedIdx: index("ride_location_updates_driver_captured_idx").on(
      table.driverUserId,
      table.capturedAt,
    ),
    expiresIdx: index("ride_location_updates_expires_idx").on(table.expiresAt),
    dedupeUid: uniqueIndex("ride_location_updates_dedupe_uidx").on(
      table.rideId,
      table.driverUserId,
      table.capturedAt,
    ),
  }),
);

export type RideLocationUpdate = typeof rideLocationUpdates.$inferSelect;
export type NewRideLocationUpdate = typeof rideLocationUpdates.$inferInsert;
