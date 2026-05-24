import { pgTable, uuid, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users.schema.js";

export const referralCodes = pgTable("referral_codes", {
  id:             uuid("id").primaryKey().defaultRandom(),
  userId:         uuid("user_id").references(() => users.id, { onDelete: "cascade" }).unique(),
  code:           text("code").notNull().unique(),
  type:           text("type").notNull().default("user"),
  discountAmount: integer("discount_amount"),
  discountType:   text("discount_type").notNull().default("percentage"),
  maxUses:        integer("max_uses"),
  usedCount:      integer("used_count").notNull().default(0),
  expiresAt:      timestamp("expires_at", { withTimezone: true }),
  isActive:       boolean("is_active").notNull().default(true),
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const referralUses = pgTable("referral_uses", {
  id:              uuid("id").primaryKey().defaultRandom(),
  referralCodeId:  uuid("referral_code_id").notNull().references(() => referralCodes.id),
  referredUserId:  uuid("referred_user_id").references(() => users.id, { onDelete: "set null" }).unique(),
  referredAt:      timestamp("referred_at", { withTimezone: true }).notNull().defaultNow(),
  convertedAt:     timestamp("converted_at", { withTimezone: true }),
  conversionValue: integer("conversion_value"),
  rewardApplied:   boolean("reward_applied").notNull().default(false),
  rewardAmount:    integer("reward_amount"),
  createdAt:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ReferralCode    = typeof referralCodes.$inferSelect;
export type NewReferralCode = typeof referralCodes.$inferInsert;
export type ReferralUse     = typeof referralUses.$inferSelect;
export type NewReferralUse  = typeof referralUses.$inferInsert;
