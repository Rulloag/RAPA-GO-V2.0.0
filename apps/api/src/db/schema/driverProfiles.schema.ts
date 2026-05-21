import { pgTable, uuid, text, integer, date, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users.schema.js";

export const driverProfiles = pgTable("driver_profiles", {
  id:              uuid("id").primaryKey().defaultRandom(),
  userId:          uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  phone:           text("phone"),
  vehicleBrand:    text("vehicle_brand"),
  vehicleModel:    text("vehicle_model"),
  vehicleYear:     integer("vehicle_year"),
  vehiclePlate:    text("vehicle_plate"),
  vehicleColor:    text("vehicle_color"),
  licenseNumber:   text("license_number"),
  licenseExpiry:   date("license_expiry"),
  profilePhotoUrl: text("profile_photo_url"),
  bio:             text("bio"),
  languages:       text("languages").array(),
  createdAt:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DriverProfile    = typeof driverProfiles.$inferSelect;
export type NewDriverProfile = typeof driverProfiles.$inferInsert;
