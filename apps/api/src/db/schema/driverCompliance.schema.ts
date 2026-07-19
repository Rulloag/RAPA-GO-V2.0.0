import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  date,
  doublePrecision,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { users } from "./users.schema.js";
import { rideRequests } from "./rides.schema.js";

/**
 * Versiones históricas de la franja diaria de desconexión elegida por cada
 * conductor. Una modificación nunca altera el día en curso: comienza en una
 * fecha futura y la versión anterior queda cerrada con effectiveTo.
 */
export const driverRestSchedules = pgTable(
  "driver_rest_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    driverUserId: uuid("driver_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startMinuteLocal: integer("start_minute_local").notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(720),
    timezone: varchar("timezone", { length: 64 })
      .notNull()
      .default("Pacific/Easter"),
    effectiveFrom: date("effective_from").notNull(),
    effectiveTo: date("effective_to"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    driverEffectiveUnique: uniqueIndex(
      "driver_rest_schedules_driver_effective_unique",
    ).on(table.driverUserId, table.effectiveFrom),
    driverEffectiveIdx: index(
      "driver_rest_schedules_driver_effective_idx",
    ).on(table.driverUserId, table.effectiveFrom, table.effectiveTo),
  }),
);

/**
 * Evidencia verificable de cada período diario. Si el conductor estaba en un
 * viaje al comenzar su franja, queda pending_trip_completion y las doce horas
 * se cuentan desde el cierre real de ese servicio.
 */
export const driverRestPeriods = pgTable(
  "driver_rest_periods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    driverUserId: uuid("driver_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    scheduleId: uuid("schedule_id")
      .notNull()
      .references(() => driverRestSchedules.id, { onDelete: "restrict" }),
    scheduledStartAt: timestamp("scheduled_start_at", { withTimezone: true })
      .notNull(),
    actualStartAt: timestamp("actual_start_at", { withTimezone: true }),
    requiredEndAt: timestamp("required_end_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    status: varchar("status", { length: 40 })
      .notNull()
      .default("scheduled"),
    delayedByRideId: uuid("delayed_by_ride_id").references(
      () => rideRequests.id,
      { onDelete: "set null" },
    ),
    durationMinutes: integer("duration_minutes").notNull().default(720),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    driverScheduledUnique: uniqueIndex(
      "driver_rest_periods_driver_scheduled_unique",
    ).on(table.driverUserId, table.scheduledStartAt),
    driverStatusIdx: index("driver_rest_periods_driver_status_idx").on(
      table.driverUserId,
      table.status,
      table.requiredEndAt,
    ),
  }),
);

/**
 * Historial inmutable de cada aceptación de conductor. Evita perder al
 * conductor anterior cuando el viaje se reasigna y permite calcular de forma
 * automática el tiempo entre aceptación y cancelación.
 */
export const rideDriverAssignments = pgTable(
  "ride_driver_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rideRequestId: uuid("ride_request_id")
      .notNull()
      .references(() => rideRequests.id, { onDelete: "cascade" }),
    driverUserId: uuid("driver_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    elapsedSeconds: integer("elapsed_seconds"),
    outcome: varchar("outcome", { length: 40 })
      .notNull()
      .default("active"),
    cancellationReason: text("cancellation_reason"),
    cancelledByUserId: uuid("cancelled_by_user_id").references(
      () => users.id,
      { onDelete: "set null" },
    ),
    cancelledByRole: varchar("cancelled_by_role", { length: 30 }),
    cancellationEvent: varchar("cancellation_event", { length: 80 }),
    locationLat: doublePrecision("location_lat"),
    locationLng: doublePrecision("location_lng"),
    locationAccuracyMeters: doublePrecision("location_accuracy_meters"),
    locationCapturedAt: timestamp("location_captured_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    rideDriverAcceptedUnique: uniqueIndex(
      "ride_driver_assignments_ride_driver_accepted_unique",
    ).on(table.rideRequestId, table.driverUserId, table.acceptedAt),
    rideOutcomeIdx: index("ride_driver_assignments_ride_outcome_idx").on(
      table.rideRequestId,
      table.outcome,
    ),
    driverAcceptedIdx: index(
      "ride_driver_assignments_driver_accepted_idx",
    ).on(table.driverUserId, table.acceptedAt),
  }),
);

export type DriverRestSchedule = typeof driverRestSchedules.$inferSelect;
export type NewDriverRestSchedule = typeof driverRestSchedules.$inferInsert;
export type DriverRestPeriod = typeof driverRestPeriods.$inferSelect;
export type NewDriverRestPeriod = typeof driverRestPeriods.$inferInsert;
export type RideDriverAssignment = typeof rideDriverAssignments.$inferSelect;
export type NewRideDriverAssignment = typeof rideDriverAssignments.$inferInsert;
