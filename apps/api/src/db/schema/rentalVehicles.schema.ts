import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users.schema.js";

export const rentalVehicles = pgTable("rental_vehicles", {
  id:           uuid("id").primaryKey().defaultRandom(),
  operatorId:   uuid("operator_id").references(() => users.id).notNull(),
  brand:        text("brand").notNull(),
  model:        text("model").notNull(),
  year:         integer("year"),
  plate:        text("plate").notNull().unique(),
  color:        text("color"),
  type:         text("type").notNull(),
  seats:        integer("seats"),
  transmission: text("transmission"),
  fuelType:     text("fuel_type"),
  dailyPrice:   integer("daily_price").notNull(),
  description:  text("description"),
  features:     text("features").array(),
  photos:       text("photos").array(),
  status:       text("status").default("available").notNull(),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
  updatedAt:    timestamp("updated_at").defaultNow().notNull(),
});

export const rentalBookings = pgTable("rental_bookings", {
  id:                 uuid("id").primaryKey().defaultRandom(),
  vehicleId:          uuid("vehicle_id").references(() => rentalVehicles.id).notNull(),
  passengerId:        uuid("passenger_id").references(() => users.id).notNull(),
  operatorId:         uuid("operator_id").references(() => users.id).notNull(),
  startDate:          text("start_date").notNull(),
  endDate:            text("end_date").notNull(),
  pickupTime:         text("pickup_time"),
  returnTime:         text("return_time"),
  pickupLocation:     text("pickup_location"),
  returnLocation:     text("return_location"),
  status:             text("status").default("pending").notNull(),
  totalPrice:         integer("total_price"),
  notes:              text("notes"),
  cancellationReason: text("cancellation_reason"),
  createdAt:          timestamp("created_at").defaultNow().notNull(),
  updatedAt:          timestamp("updated_at").defaultNow().notNull(),
});

export type RentalVehicle = typeof rentalVehicles.$inferSelect;
export type RentalBooking = typeof rentalBookings.$inferSelect;
