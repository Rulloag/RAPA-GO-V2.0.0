import { pgTable, uuid, text, integer, boolean, timestamp, unique } from "drizzle-orm/pg-core";
import { users } from "./users.schema.js";

export const fareSettings = pgTable("fare_settings", {
  id:             uuid("id").primaryKey().defaultRandom(),
  type:           text("type").notNull(),
  name:           text("name").notNull(),
  value:          integer("value").notNull(),
  currency:       text("currency").default("CLP").notNull(),
  description:    text("description"),
  isActive:       boolean("is_active").default(true).notNull(),
  effectiveFrom:  text("effective_from").notNull(),
  effectiveUntil: text("effective_until"),
  createdBy:      uuid("created_by").references(() => users.id),
  createdAt:      timestamp("created_at").defaultNow().notNull(),
  updatedAt:      timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  uniqTypeFrom: unique().on(t.type, t.effectiveFrom),
}));

export const zoneFares = pgTable("zone_fares", {
  id:        uuid("id").primaryKey().defaultRandom(),
  zoneFrom:  text("zone_from").notNull(),
  zoneTo:    text("zone_to").notNull(),
  fare:      integer("fare").notNull(),
  isActive:  boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  uniqZones: unique().on(t.zoneFrom, t.zoneTo),
}));

export type FareSetting = typeof fareSettings.$inferSelect;
export type ZoneFare    = typeof zoneFares.$inferSelect;
