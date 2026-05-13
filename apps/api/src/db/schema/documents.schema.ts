import { pgTable, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users.schema.js";

/**
 * user_documents — tracks document requirements and upload status per user.
 *
 * Status lifecycle: pending → uploaded → approved | rejected
 * File storage integration is deferred — file_url will be populated
 * in a future phase when Supabase Storage or equivalent is connected.
 */
export const userDocuments = pgTable("user_documents", {
  id:               uuid("id").primaryKey().defaultRandom(),
  userId:           uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  documentType:     varchar("document_type", { length: 50 }).notNull(),
  status:           varchar("status", { length: 20 }).notNull().default("pending"),
  fileUrl:          text("file_url"),
  rejectionReason:  text("rejection_reason"),
  uploadedAt:       timestamp("uploaded_at",  { withTimezone: true }),
  reviewedAt:       timestamp("reviewed_at",  { withTimezone: true }),
  createdAt:        timestamp("created_at",   { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp("updated_at",   { withTimezone: true }).notNull().defaultNow(),
});

export type UserDocument    = typeof userDocuments.$inferSelect;
export type NewUserDocument = typeof userDocuments.$inferInsert;
