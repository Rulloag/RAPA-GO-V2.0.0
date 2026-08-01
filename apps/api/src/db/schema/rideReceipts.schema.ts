import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { ridePolicyCharges } from "./ridePolicyCharges.schema.js";
import { rideRequests } from "./rides.schema.js";
import { users } from "./users.schema.js";

/**
 * Comprobantes PDF asociados a viajes y cargos de política.
 *
 * El backend es la fuente de verdad: el cliente solo lista o descarga
 * documentos que ya fueron generados y registrados aquí.
 */
export const rideReceipts = pgTable(
  "ride_receipts",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    rideId: uuid("ride_id")
      .notNull()
      .references(() => rideRequests.id, { onDelete: "cascade" }),

    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),

    policyChargeId: uuid("policy_charge_id").references(
      () => ridePolicyCharges.id,
      { onDelete: "set null" },
    ),

    type: varchar("type", { length: 40 }).notNull(),
    status: varchar("status", { length: 32 })
      .notNull()
      .default("pending"),

    documentNumber: varchar("document_number", { length: 90 }).notNull(),
    emailTo: varchar("email_to", { length: 255 }).notNull(),

    storageBucket: varchar("storage_bucket", { length: 120 }),
    storagePath: text("storage_path"),
    pdfSha256: varchar("pdf_sha256", { length: 64 }),

    mapProvider: varchar("map_provider", { length: 32 }),
    routePointCount: integer("route_point_count").notNull().default(0),

    legalDocumentType: varchar("legal_document_type", { length: 80 }),
    legalDocumentVersion: varchar("legal_document_version", { length: 40 }),
    legalAcceptedAt: timestamp("legal_accepted_at", { withTimezone: true }),

    snapshot: jsonb("snapshot")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),

    deliveryAttempts: integer("delivery_attempts").notNull().default(0),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    generatedAt: timestamp("generated_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    failureReason: text("failure_reason"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    rideTypeUnique: uniqueIndex("ride_receipts_ride_type_uidx").on(
      table.rideId,
      table.type,
    ),
    documentNumberUnique: uniqueIndex(
      "ride_receipts_document_number_uidx",
    ).on(table.documentNumber),
    ownerCreatedIdx: index("ride_receipts_owner_created_idx").on(
      table.ownerUserId,
      table.createdAt,
    ),
    statusUpdatedIdx: index("ride_receipts_status_updated_idx").on(
      table.status,
      table.updatedAt,
    ),
    policyChargeIdx: index("ride_receipts_policy_charge_idx").on(
      table.policyChargeId,
    ),
  }),
);

export type RideReceipt = typeof rideReceipts.$inferSelect;
export type NewRideReceipt = typeof rideReceipts.$inferInsert;
