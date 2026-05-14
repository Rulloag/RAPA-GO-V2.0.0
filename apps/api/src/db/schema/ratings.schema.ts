import { pgTable, uuid, varchar, text, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { users } from "./users.schema.js";
import { rideRequests } from "./rides.schema.js";

export const rideRatings = pgTable("ride_ratings", {
  id:             uuid("id").primaryKey().defaultRandom(),
  rideRequestId:  uuid("ride_request_id").notNull().references(() => rideRequests.id, { onDelete: "cascade" }),
  raterUserId:    uuid("rater_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  ratedUserId:    uuid("rated_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  raterRole:      varchar("rater_role", { length: 30 }).notNull(),
  rating:         integer("rating").notNull(),
  comment:        text("comment"),
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:      timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uqRideRater: unique("uq_ride_rater").on(t.rideRequestId, t.raterUserId),
}));

export type RideRating    = typeof rideRatings.$inferSelect;
export type NewRideRating = typeof rideRatings.$inferInsert;
