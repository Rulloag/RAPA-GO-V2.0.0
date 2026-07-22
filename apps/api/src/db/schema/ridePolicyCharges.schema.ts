import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { users } from "./users.schema.js";
import { rideRequests } from "./rides.schema.js";

/**
 * Cargos administrativos asociados a políticas de viaje.
 *
 * No representan saldo de Wallet ni un débito automático a una tarjeta.
 * Después de la aprobación del administrador quedan pendientes para ser
 * sumados al próximo viaje de la misma cuenta.
 */
export const ridePolicyCharges = pgTable(
  "ride_policy_charges",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    sourceRideId: uuid("source_ride_id")
      .notNull()
      .references(() => rideRequests.id, { onDelete: "restrict" }),

    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),

    type: varchar("type", { length: 40 }).notNull(),

    status: varchar("status", { length: 50 })
      .notNull()
      .default("pending_admin_review"),

    paymentMethod: varchar("payment_method", { length: 30 }),

    applicableFareClp: integer("applicable_fare_clp").notNull(),
    feePercent: integer("fee_percent").notNull(),
    feeCapClp: integer("fee_cap_clp").notNull(),
    calculatedAmountClp: integer("calculated_amount_clp").notNull(),
    approvedAmountClp: integer("approved_amount_clp"),

    reason: text("reason"),
    adminDecisionReason: text("admin_decision_reason"),

    reviewedByUserId: uuid("reviewed_by_user_id").references(
      () => users.id,
      { onDelete: "set null" },
    ),

    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),

    appliedToRideId: uuid("applied_to_ride_id").references(
      () => rideRequests.id,
      { onDelete: "set null" },
    ),

    appliedAt: timestamp("applied_at", { withTimezone: true }),
    settledAt: timestamp("settled_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    sourceRideTypeUnique: uniqueIndex(
      "ride_policy_charges_source_ride_type_unique",
    ).on(table.sourceRideId, table.type),

    ownerStatusIdx: index("ride_policy_charges_owner_status_idx").on(
      table.ownerUserId,
      table.status,
    ),

    appliedRideIdx: index("ride_policy_charges_applied_ride_idx").on(
      table.appliedToRideId,
    ),
  }),
);

export type RidePolicyCharge = typeof ridePolicyCharges.$inferSelect;
export type NewRidePolicyCharge = typeof ridePolicyCharges.$inferInsert;