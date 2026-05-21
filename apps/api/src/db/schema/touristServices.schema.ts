import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users.schema.js";

export const touristServices = pgTable("tourist_services", {
  id:              uuid("id").primaryKey().defaultRandom(),
  guideId:         uuid("guide_id").references(() => users.id).notNull(),
  title:           text("title").notNull(),
  description:     text("description"),
  type:            text("type").notNull(),
  durationMinutes: integer("duration_minutes"),
  maxPeople:       integer("max_people"),
  price:           integer("price"),
  includes:        text("includes").array(),
  languages:       text("languages").array(),
  meetingPoint:    text("meeting_point"),
  status:          text("status").default("active").notNull(),
  createdAt:       timestamp("created_at").defaultNow().notNull(),
  updatedAt:       timestamp("updated_at").defaultNow().notNull(),
});

export const serviceBookings = pgTable("service_bookings", {
  id:             uuid("id").primaryKey().defaultRandom(),
  serviceId:      uuid("service_id").references(() => touristServices.id).notNull(),
  passengerId:    uuid("passenger_id").references(() => users.id).notNull(),
  guideId:        uuid("guide_id").references(() => users.id).notNull(),
  bookingDate:    text("booking_date").notNull(),
  bookingTime:    text("booking_time"),
  numberOfPeople: integer("number_of_people").default(1).notNull(),
  status:         text("status").default("pending").notNull(),
  notes:          text("notes"),
  totalPrice:     integer("total_price"),
  cancellationReason: text("cancellation_reason"),
  createdAt:      timestamp("created_at").defaultNow().notNull(),
  updatedAt:      timestamp("updated_at").defaultNow().notNull(),
});

export type TouristService = typeof touristServices.$inferSelect;
export type ServiceBooking = typeof serviceBookings.$inferSelect;
