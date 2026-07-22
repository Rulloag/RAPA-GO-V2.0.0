import { pgTable, uuid, varchar, jsonb, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users.schema.js";
import { rideRequests } from "./rides.schema.js";

export const whatsappMessages = pgTable("whatsapp_messages", {
  id:                uuid("id").primaryKey().defaultRandom(),
  userId:            uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  rideId:            uuid("ride_id").references(() => rideRequests.id, { onDelete: "set null" }),
  phoneE164:         varchar("phone_e164",          { length: 20  }).notNull(),
  direction:         varchar("direction",            { length: 10  }).notNull(),
  messageType:       varchar("message_type",         { length: 20  }).notNull(),
  providerMessageId: varchar("provider_message_id",  { length: 255 }),
  templateName:      varchar("template_name",        { length: 100 }),
  bodyPreview:       varchar("body_preview",         { length: 300 }),
  status:            varchar("status",               { length: 20  }).notNull().default("queued"),
  payloadJson:       jsonb("payload_json"),
  errorCode:         varchar("error_code",           { length: 50  }),
  errorMessage:      varchar("error_message",        { length: 500 }),
  createdAt:         timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:         timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type WhatsappMessage    = typeof whatsappMessages.$inferSelect;
export type NewWhatsappMessage = typeof whatsappMessages.$inferInsert;
