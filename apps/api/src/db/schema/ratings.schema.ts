import { pgTable, uuid, varchar, text, integer, timestamp, unique, index } from "drizzle-orm/pg-core";
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
  commentVisibility: varchar("comment_visibility", { length: 32 }).notNull().default("participants_and_admin"),
  moderationStatus: varchar("moderation_status", { length: 24 }).notNull().default("visible"),
  moderationReason: text("moderation_reason"),
  moderatedByUserId: uuid("moderated_by_user_id").references(() => users.id, { onDelete: "set null" }),
  moderatedAt: timestamp("moderated_at", { withTimezone: true }),
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:      timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uqRideRater: unique("uq_ride_rater").on(t.rideRequestId, t.raterUserId),
  moderationIdx: index("ride_ratings_moderation_idx").on(t.moderationStatus, t.createdAt),
}));

export type RideRating    = typeof rideRatings.$inferSelect;
export type NewRideRating = typeof rideRatings.$inferInsert;
