import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users.schema.js";

export const eventTickets = pgTable("event_tickets", {
  id:                uuid("id").primaryKey().defaultRandom(),
  userId:            uuid("user_id").references(() => users.id).notNull(),
  externalEventId:   text("external_event_id").notNull(),
  externalBookingId: text("external_booking_id").notNull(),
  eventName:         text("event_name").notNull(),
  eventDate:         text("event_date"),
  eventLocation:     text("event_location"),
  ticketCode:        text("ticket_code").notNull().unique(),
  qrData:            text("qr_data").notNull(),
  status:            text("status").default("active").notNull(),
  paymentOrderId:    uuid("payment_order_id"),
  validatedAt:       timestamp("validated_at"),
  validatedBy:       uuid("validated_by").references(() => users.id),
  createdAt:         timestamp("created_at").defaultNow().notNull(),
  updatedAt:         timestamp("updated_at").defaultNow().notNull(),
});

export type EventTicket = typeof eventTickets.$inferSelect;
