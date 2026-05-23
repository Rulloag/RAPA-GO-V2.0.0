import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users.schema.js";

export const notifications = pgTable("notifications", {
  id:         uuid("id").primaryKey().defaultRandom(),
  userId:     uuid("user_id").references(() => users.id).notNull(),
  type:       text("type").notNull(),
  title:      text("title").notNull(),
  message:    text("message"),
  entityType: text("entity_type"),
  entityId:   uuid("entity_id"),
  read:       boolean("read").default(false).notNull(),
  actionUrl:  text("action_url"),
  waMeUrl:    text("wa_me_url"),
  createdAt:  timestamp("created_at").defaultNow().notNull(),
  expiresAt:  timestamp("expires_at"),
});

export type Notification = typeof notifications.$inferSelect;
