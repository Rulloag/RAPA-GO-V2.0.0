import { pgTable, uuid, varchar, text, boolean, timestamp } from "drizzle-orm/pg-core";

/**
 * users — core identity record for every platform participant.
 * Role values must match UserRole in @rapa-go/shared.
 * Status lifecycle: pending → active → suspended | banned | deleted
 */
export const users = pgTable("users", {
  id:          uuid("id").primaryKey().defaultRandom(),
  email:       varchar("email", { length: 255 }).unique().notNull(),
  name:        varchar("name", { length: 100 }).notNull(),
  role:        varchar("role", { length: 30 }).notNull(),
  status:      varchar("status", { length: 20 }).notNull().default("pending"),
  avatarUrl:   text("avatar_url"),
  isVerified:  boolean("is_verified").notNull().default(false),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User    = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
