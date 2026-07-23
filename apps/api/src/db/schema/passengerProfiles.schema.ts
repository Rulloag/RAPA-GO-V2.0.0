import { pgTable, uuid, text, varchar, boolean, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users.schema.js";

export const passengerProfiles = pgTable("passenger_profiles", {
  id:                    uuid("id").primaryKey().defaultRandom(),
  userId:                uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  phone:                 text("phone"),
  phoneE164:             varchar("phone_e164", { length: 20 }),
  requestedFareType:     text("requested_fare_type").notNull().default("chilean"),
  effectiveFareType:     text("effective_fare_type").notNull().default("chilean"),
  residenceVerificationStatus: text("residence_verification_status").notNull().default("not_required"),
  residenceRequestedAt:  timestamp("residence_requested_at", { withTimezone: true }),
  residenceReviewedAt:   timestamp("residence_reviewed_at", { withTimezone: true }),
  residenceReviewedBy:   uuid("residence_reviewed_by").references(() => users.id, { onDelete: "set null" }),
  residenceRejectionReason: text("residence_rejection_reason"),
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
