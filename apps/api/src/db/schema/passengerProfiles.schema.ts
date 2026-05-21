import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users.schema.js";

export const passengerProfiles = pgTable("passenger_profiles", {
  id:                    uuid("id").primaryKey().defaultRandom(),
  userId:                uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  phone:                 text("phone"),
  preferredLanguage:     text("preferred_language").notNull().default("es"),
  notificationEnabled:   boolean("notification_enabled").notNull().default(true),
  emailNotifications:    boolean("email_notifications").notNull().default(true),
  smsNotifications:      boolean("sms_notifications").notNull().default(false),
  emergencyContactName:  text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  createdAt:             timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:             timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PassengerProfile    = typeof passengerProfiles.$inferSelect;
export type NewPassengerProfile = typeof passengerProfiles.$inferInsert;
