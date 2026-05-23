import { pgTable, uuid, integer, unique } from "drizzle-orm/pg-core";
import { touristServices } from "./touristServices.schema.js";

export const servicePricingTiers = pgTable("service_pricing_tiers", {
  id:        uuid("id").primaryKey().defaultRandom(),
  serviceId: uuid("service_id").references(() => touristServices.id).notNull(),
  minPeople: integer("min_people").notNull(),
  maxPeople: integer("max_people").notNull(),
  price:     integer("price").notNull(),
}, (t) => ({
  uniqueServiceMin: unique().on(t.serviceId, t.minPeople),
}));

export type ServicePricingTier = typeof servicePricingTiers.$inferSelect;
