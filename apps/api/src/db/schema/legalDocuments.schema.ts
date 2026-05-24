import { pgTable, uuid, text, boolean, timestamp, unique } from "drizzle-orm/pg-core";
import { users } from "./users.schema.js";

export const legalDocuments = pgTable("legal_documents", {
  id:            uuid("id").primaryKey().defaultRandom(),
  type:          text("type").notNull(),
  version:       text("version").notNull(),
  title:         text("title").notNull(),
  content:       text("content").notNull(),
  effectiveDate: text("effective_date").notNull(),
  isActive:      boolean("is_active").default(true).notNull(),
  createdBy:     uuid("created_by").references(() => users.id),
  createdAt:     timestamp("created_at").defaultNow().notNull(),
  updatedAt:     timestamp("updated_at").defaultNow().notNull(),
});

export const userAcceptances = pgTable("user_acceptances", {
  id:              uuid("id").primaryKey().defaultRandom(),
  userId:          uuid("user_id").references(() => users.id).notNull(),
  legalDocumentId: uuid("legal_document_id").references(() => legalDocuments.id).notNull(),
  versionAccepted: text("version_accepted").notNull(),
  ipAddress:       text("ip_address"),
  userAgent:       text("user_agent"),
  acceptedAt:      timestamp("accepted_at").defaultNow().notNull(),
}, (t) => ({
  uniqUserDoc: unique().on(t.userId, t.legalDocumentId),
}));

export type LegalDocument  = typeof legalDocuments.$inferSelect;
export type UserAcceptance = typeof userAcceptances.$inferSelect;
