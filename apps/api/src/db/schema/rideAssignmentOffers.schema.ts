import { pgTable, uuid, varchar, timestamp, integer } from "drizzle-orm/pg-core";
import { users } from "./users.schema.js";
import { rideRequests } from "./rides.schema.js";

export const rideAssignmentOffers = pgTable("ride_assignment_offers", {
  id:              uuid("id").primaryKey().defaultRandom(),
  rideRequestId:   uuid("ride_request_id").notNull().references(() => rideRequests.id, { onDelete: "cascade" }),
  driverUserId:    uuid("driver_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status:          varchar("status", { length: 20 }).notNull().default("pending"),
  offeredAt:       timestamp("offered_at",    { withTimezone: true }).notNull().defaultNow(),
  expiresAt:       timestamp("expires_at",    { withTimezone: true }).notNull(),
  respondedAt:     timestamp("responded_at",  { withTimezone: true }),
  responseSource:  varchar("response_source", { length: 20 }),
  attemptOrder:    integer("attempt_order").notNull().default(1),
  createdAt:       timestamp("created_at",    { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp("updated_at",    { withTimezone: true }).notNull().defaultNow(),
});

export type RideAssignmentOffer    = typeof rideAssignmentOffers.$inferSelect;
export type NewRideAssignmentOffer = typeof rideAssignmentOffers.$inferInsert;
