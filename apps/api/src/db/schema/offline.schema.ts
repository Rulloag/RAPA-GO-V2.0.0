import { pgTable, uuid, text, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";
import { users } from "./users.schema.js";
import { rideRequests } from "./rides.schema.js";

export const syncQueue = pgTable("sync_queue", {
  id:           uuid("id").primaryKey().defaultRandom(),
  userId:       uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  entityType:   text("entity_type").notNull(),
  entityId:     uuid("entity_id"),
  action:       text("action").notNull(),
  payload:      jsonb("payload").notNull(),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  syncedAt:     timestamp("synced_at",  { withTimezone: true }),
  syncError:    text("sync_error"),
  retryCount:   integer("retry_count").notNull().default(0),
});

export const offlineBookings = pgTable("offline_bookings", {
  id:               uuid("id").primaryKey().defaultRandom(),
  adminId:          uuid("admin_id").references(() => users.id, { onDelete: "set null" }),
  passengerName:    text("passenger_name").notNull(),
  passengerPhone:   text("passenger_phone").notNull(),
  originText:       text("origin_text").notNull(),
  destinationText:  text("destination_text").notNull(),
  assignedDriverId: uuid("assigned_driver_id").references(() => users.id, { onDelete: "set null" }),
  status:           text("status").notNull().default("pending_sync"),
  notes:            text("notes"),
  createdAt:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  syncedToRideId:   uuid("synced_to_ride_id").references(() => rideRequests.id, { onDelete: "set null" }),
});

export const connectivityLogs = pgTable("connectivity_logs", {
  id:               uuid("id").primaryKey().defaultRandom(),
  userId:           uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  role:             text("role"),
  hadConnectivity:  boolean("had_connectivity").notNull(),
  checkedAt:        timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
  locationZone:     text("location_zone"),
});

export type SyncQueueItem     = typeof syncQueue.$inferSelect;
export type OfflineBooking    = typeof offlineBookings.$inferSelect;
export type ConnectivityLog   = typeof connectivityLogs.$inferSelect;
export type NewOfflineBooking = typeof offlineBookings.$inferInsert;
