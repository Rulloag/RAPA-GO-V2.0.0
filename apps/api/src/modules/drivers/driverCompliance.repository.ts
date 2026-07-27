import {
  and,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  or,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "../../db/client.js";
import {
  driverRestPeriods,
  driverRestSchedules,
  rideDriverAssignments,
  rideRequests,
  users,
  type DriverRestPeriod,
  type DriverRestSchedule,
  type RideDriverAssignment,
} from "../../db/schema/index.js";
import { AppError } from "../../shared/errors/AppError.js";

export type AssignmentClosureInput = {
  rideRequestId: string;
  driverUserId: string;
  endedAt: Date;
  outcome: "cancelled" | "completed" | "no_show";
  cancellationReason?: string | null;
  cancelledByUserId?: string | null;
  cancelledByRole?: string | null;
  cancellationEvent?: string | null;
  location?: {
    lat: number;
    lng: number;
    accuracyMeters?: number | null;
    capturedAt?: Date | null;
  } | null;
};

export type RideDriverAssignmentReportRow = RideDriverAssignment & {
  driverName: string | null;
  driverEmail: string | null;
  originText: string | null;
  destinationText: string | null;
};

export type DriverRestPeriodReportRow = DriverRestPeriod & {
  driverName: string | null;
  driverEmail: string | null;
  serviceStartMinuteLocal: number;
  startMinuteLocal: number;
  timezone: string;
};

export type DriverServiceScheduleReportRow = DriverRestSchedule & {
  driverName: string | null;
  driverEmail: string | null;
};

export class DriverComplianceRepository {
  async findScheduleForDate(
    driverUserId: string,
    localDate: string,
  ): Promise<DriverRestSchedule | null> {
    try {
      const rows = await db
        .select()
        .from(driverRestSchedules)
        .where(
          and(
            eq(driverRestSchedules.driverUserId, driverUserId),
            lte(driverRestSchedules.effectiveFrom, localDate),
            or(
              isNull(driverRestSchedules.effectiveTo),
              gte(driverRestSchedules.effectiveTo, localDate),
            ),
          ),
        )
        .orderBy(desc(driverRestSchedules.effectiveFrom))
        .limit(1);

      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(
        `Failed to query driver rest schedule: ${String(err)}`,
      );
    }
  }

  async findLatestSchedule(
    driverUserId: string,
  ): Promise<DriverRestSchedule | null> {
    try {
      const rows = await db
        .select()
        .from(driverRestSchedules)
        .where(eq(driverRestSchedules.driverUserId, driverUserId))
        .orderBy(desc(driverRestSchedules.effectiveFrom))
        .limit(1);

      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(
        `Failed to query latest driver rest schedule: ${String(err)}`,
      );
    }
  }

  async replaceSchedule(input: {
    driverUserId: string;
    serviceStartMinuteLocal: number;
    startMinuteLocal: number;
    durationMinutes: number;
    timezone: string;
    effectiveFrom: string;
    createdByUserId: string;
  }): Promise<DriverRestSchedule> {
    try {
      return await db.transaction(async (tx) => {
        const previousDay = new Date(`${input.effectiveFrom}T00:00:00.000Z`);
        previousDay.setUTCDate(previousDay.getUTCDate() - 1);
        const previousDayKey = previousDay.toISOString().slice(0, 10);
        const now = new Date();

        await tx
          .update(driverRestSchedules)
          .set({
            effectiveTo: previousDayKey,
            updatedAt: now,
          })
          .where(
            and(
              eq(driverRestSchedules.driverUserId, input.driverUserId),
              isNull(driverRestSchedules.effectiveTo),
              lte(driverRestSchedules.effectiveFrom, previousDayKey),
            ),
          );

        const rows = await tx
          .insert(driverRestSchedules)
          .values({
            driverUserId: input.driverUserId,
            serviceStartMinuteLocal: input.serviceStartMinuteLocal,
            startMinuteLocal: input.startMinuteLocal,
            durationMinutes: input.durationMinutes,
            timezone: input.timezone,
            effectiveFrom: input.effectiveFrom,
            effectiveTo: null,
            createdByUserId: input.createdByUserId,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [
              driverRestSchedules.driverUserId,
              driverRestSchedules.effectiveFrom,
            ],
            set: {
              serviceStartMinuteLocal: input.serviceStartMinuteLocal,
              startMinuteLocal: input.startMinuteLocal,
              durationMinutes: input.durationMinutes,
              timezone: input.timezone,
              effectiveTo: null,
              createdByUserId: input.createdByUserId,
              updatedAt: now,
            },
          })
          .returning();

        const row = rows[0];
        if (!row) throw AppError.internal("Rest schedule upsert returned no rows.");
        return row;
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(
        `Failed to replace driver rest schedule: ${String(err)}`,
      );
    }
  }

  async findPeriodByScheduledStart(
    driverUserId: string,
    scheduledStartAt: Date,
  ): Promise<DriverRestPeriod | null> {
    try {
      const rows = await db
        .select()
        .from(driverRestPeriods)
        .where(
          and(
            eq(driverRestPeriods.driverUserId, driverUserId),
            eq(driverRestPeriods.scheduledStartAt, scheduledStartAt),
          ),
        )
        .limit(1);
      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(
        `Failed to query driver rest period: ${String(err)}`,
      );
    }
  }

  async findActiveRideIdForDriver(
    driverUserId: string,
  ): Promise<string | null> {
    try {
      const rows = await db
        .select({ id: rideRequests.id })
        .from(rideRequests)
        .where(
          and(
            eq(rideRequests.driverUserId, driverUserId),
            inArray(rideRequests.status, [
              "accepted",
              "driver_en_route",
              "driver_arrived",
              "in_progress",
            ]),
          ),
        )
        .orderBy(desc(rideRequests.acceptedAt))
        .limit(1);
      return rows[0]?.id ?? null;
    } catch (err) {
      throw AppError.internal(
        `Failed to query active driver ride: ${String(err)}`,
      );
    }
  }

  async findLatestOpenPeriod(
    driverUserId: string,
  ): Promise<DriverRestPeriod | null> {
    try {
      const rows = await db
        .select()
        .from(driverRestPeriods)
        .where(
          and(
            eq(driverRestPeriods.driverUserId, driverUserId),
            eq(driverRestPeriods.status, "active"),
          ),
        )
        .orderBy(desc(driverRestPeriods.scheduledStartAt))
        .limit(1);
      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(
        `Failed to query open driver rest period: ${String(err)}`,
      );
    }
  }

  async createPeriod(input: {
    driverUserId: string;
    scheduleId: string;
    scheduledStartAt: Date;
    durationMinutes: number;
  }): Promise<DriverRestPeriod> {
    try {
      const rows = await db
        .insert(driverRestPeriods)
        .values({
          driverUserId: input.driverUserId,
          scheduleId: input.scheduleId,
          scheduledStartAt: input.scheduledStartAt,
          durationMinutes: input.durationMinutes,
          status: "reminder_due",
        })
        .onConflictDoNothing()
        .returning();

      if (rows[0]) return rows[0];

      const existing = await this.findPeriodByScheduledStart(
        input.driverUserId,
        input.scheduledStartAt,
      );
      if (!existing) {
        throw AppError.internal("Rest period insert returned no rows.");
      }
      return existing;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(
        `Failed to create driver rest period: ${String(err)}`,
      );
    }
  }

  async markPeriodReminderDue(
    periodId: string,
  ): Promise<DriverRestPeriod | null> {
    try {
      const rows = await db
        .update(driverRestPeriods)
        .set({
          status: "reminder_due",
          decision: null,
          decisionAt: null,
          delayedByRideId: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(driverRestPeriods.id, periodId),
            inArray(driverRestPeriods.status, [
              "scheduled",
              "pending_trip_completion",
              "reminder_due",
            ]),
          ),
        )
        .returning();
      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(
        `Failed to mark rest reminder due: ${String(err)}`,
      );
    }
  }

  async markPeriodWorking(
    periodId: string,
    decisionAt: Date,
  ): Promise<DriverRestPeriod | null> {
    try {
      const rows = await db
        .update(driverRestPeriods)
        .set({
          status: "working",
          decision: "work",
          decisionAt,
          actualStartAt: null,
          requiredEndAt: null,
          completedAt: null,
          delayedByRideId: null,
          updatedAt: decisionAt,
        })
        .where(
          and(
            eq(driverRestPeriods.id, periodId),
            inArray(driverRestPeriods.status, [
              "scheduled",
              "pending_trip_completion",
              "reminder_due",
              "working",
            ]),
          ),
        )
        .returning();
      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(
        `Failed to mark driver as continuing work: ${String(err)}`,
      );
    }
  }

  async markPeriodPending(
    periodId: string,
    rideId: string,
  ): Promise<DriverRestPeriod | null> {
    try {
      const rows = await db
        .update(driverRestPeriods)
        .set({
          status: "pending_trip_completion",
          delayedByRideId: rideId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(driverRestPeriods.id, periodId),
            inArray(driverRestPeriods.status, ["scheduled", "pending_trip_completion"]),
          ),
        )
        .returning();
      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(
        `Failed to mark rest period pending: ${String(err)}`,
      );
    }
  }

  async activatePeriod(
    periodId: string,
    actualStartAt: Date,
    durationMinutes: number,
  ): Promise<DriverRestPeriod | null> {
    try {
      const requiredEndAt = new Date(
        actualStartAt.getTime() + durationMinutes * 60_000,
      );
      const rows = await db
        .update(driverRestPeriods)
        .set({
          status: "active",
          decision: "rest",
          decisionAt: actualStartAt,
          actualStartAt,
          requiredEndAt,
          completedAt: null,
          delayedByRideId: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(driverRestPeriods.id, periodId),
            inArray(driverRestPeriods.status, [
              "scheduled",
              "pending_trip_completion",
              "reminder_due",
              "active",
            ]),
          ),
        )
        .returning();
      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(
        `Failed to activate driver rest period: ${String(err)}`,
      );
    }
  }

  async completePeriod(
    periodId: string,
    completedAt: Date,
  ): Promise<DriverRestPeriod | null> {
    try {
      const rows = await db
        .update(driverRestPeriods)
        .set({
          status: "completed",
          completedAt,
          updatedAt: completedAt,
        })
        .where(eq(driverRestPeriods.id, periodId))
        .returning();
      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(
        `Failed to complete driver rest period: ${String(err)}`,
      );
    }
  }

  async recordAcceptance(input: {
    rideRequestId: string;
    driverUserId: string;
    acceptedAt: Date;
  }): Promise<void> {
    try {
      await db
        .insert(rideDriverAssignments)
        .values({
          rideRequestId: input.rideRequestId,
          driverUserId: input.driverUserId,
          acceptedAt: input.acceptedAt,
          outcome: "active",
        })
        .onConflictDoNothing();
    } catch (err) {
      throw AppError.internal(
        `Failed to record driver acceptance: ${String(err)}`,
      );
    }
  }

  async closeActiveAssignment(input: AssignmentClosureInput): Promise<void> {
    try {
      const rows = await db
        .select()
        .from(rideDriverAssignments)
        .where(
          and(
            eq(rideDriverAssignments.rideRequestId, input.rideRequestId),
            eq(rideDriverAssignments.driverUserId, input.driverUserId),
            eq(rideDriverAssignments.outcome, "active"),
            isNull(rideDriverAssignments.endedAt),
          ),
        )
        .orderBy(desc(rideDriverAssignments.acceptedAt))
        .limit(1);

      const active = rows[0];
      if (!active) return;

      const elapsedSeconds = Math.max(
        0,
        Math.floor(
          (input.endedAt.getTime() - active.acceptedAt.getTime()) / 1000,
        ),
      );

      await db
        .update(rideDriverAssignments)
        .set({
          endedAt: input.endedAt,
          elapsedSeconds,
          outcome: input.outcome,
          cancellationReason: input.cancellationReason ?? null,
          cancelledByUserId: input.cancelledByUserId ?? null,
          cancelledByRole: input.cancelledByRole ?? null,
          cancellationEvent: input.cancellationEvent ?? null,
          locationLat: input.location?.lat ?? null,
          locationLng: input.location?.lng ?? null,
          locationAccuracyMeters: input.location?.accuracyMeters ?? null,
          locationCapturedAt:
            input.location?.capturedAt ??
            (input.location ? input.endedAt : null),
          updatedAt: input.endedAt,
        })
        .where(eq(rideDriverAssignments.id, active.id));
    } catch (err) {
      throw AppError.internal(
        `Failed to close driver assignment history: ${String(err)}`,
      );
    }
  }

  async listAssignmentReport(filter: {
    driverUserId?: string;
    rideRequestId?: string;
    from?: Date;
    to?: Date;
  }): Promise<RideDriverAssignmentReportRow[]> {
    try {
      const driver = alias(users, "compliance_driver");
      const conditions: SQL[] = [];
      if (filter.driverUserId) {
        conditions.push(eq(rideDriverAssignments.driverUserId, filter.driverUserId));
      }
      if (filter.rideRequestId) {
        conditions.push(eq(rideDriverAssignments.rideRequestId, filter.rideRequestId));
      }
      if (filter.from) conditions.push(gte(rideDriverAssignments.acceptedAt, filter.from));
      if (filter.to) conditions.push(lte(rideDriverAssignments.acceptedAt, filter.to));

      const query = db
        .select({
          id: rideDriverAssignments.id,
          rideRequestId: rideDriverAssignments.rideRequestId,
          driverUserId: rideDriverAssignments.driverUserId,
          acceptedAt: rideDriverAssignments.acceptedAt,
          endedAt: rideDriverAssignments.endedAt,
          elapsedSeconds: rideDriverAssignments.elapsedSeconds,
          outcome: rideDriverAssignments.outcome,
          cancellationReason: rideDriverAssignments.cancellationReason,
          cancelledByUserId: rideDriverAssignments.cancelledByUserId,
          cancelledByRole: rideDriverAssignments.cancelledByRole,
          cancellationEvent: rideDriverAssignments.cancellationEvent,
          locationLat: rideDriverAssignments.locationLat,
          locationLng: rideDriverAssignments.locationLng,
          locationAccuracyMeters: rideDriverAssignments.locationAccuracyMeters,
          locationCapturedAt: rideDriverAssignments.locationCapturedAt,
          createdAt: rideDriverAssignments.createdAt,
          updatedAt: rideDriverAssignments.updatedAt,
          driverName: driver.name,
          driverEmail: driver.email,
          originText: rideRequests.originText,
          destinationText: rideRequests.destinationText,
        })
        .from(rideDriverAssignments)
        .innerJoin(driver, eq(rideDriverAssignments.driverUserId, driver.id))
        .innerJoin(
          rideRequests,
          eq(rideDriverAssignments.rideRequestId, rideRequests.id),
        )
        .orderBy(desc(rideDriverAssignments.acceptedAt));

      const rows = conditions.length > 0
        ? await query.where(and(...conditions))
        : await query;
      return rows as RideDriverAssignmentReportRow[];
    } catch (err) {
      throw AppError.internal(
        `Failed to list driver assignment report: ${String(err)}`,
      );
    }
  }

  async listRestPeriodReport(filter: {
    driverUserId?: string;
    from?: Date;
    to?: Date;
  }): Promise<DriverRestPeriodReportRow[]> {
    try {
      const driver = alias(users, "rest_report_driver");
      const conditions: SQL[] = [];
      if (filter.driverUserId) {
        conditions.push(eq(driverRestPeriods.driverUserId, filter.driverUserId));
      }
      if (filter.from) conditions.push(gte(driverRestPeriods.scheduledStartAt, filter.from));
      if (filter.to) conditions.push(lte(driverRestPeriods.scheduledStartAt, filter.to));

      const query = db
        .select({
          id: driverRestPeriods.id,
          driverUserId: driverRestPeriods.driverUserId,
          scheduleId: driverRestPeriods.scheduleId,
          scheduledStartAt: driverRestPeriods.scheduledStartAt,
          actualStartAt: driverRestPeriods.actualStartAt,
          requiredEndAt: driverRestPeriods.requiredEndAt,
          completedAt: driverRestPeriods.completedAt,
          status: driverRestPeriods.status,
          decision: driverRestPeriods.decision,
          decisionAt: driverRestPeriods.decisionAt,
          delayedByRideId: driverRestPeriods.delayedByRideId,
          durationMinutes: driverRestPeriods.durationMinutes,
          createdAt: driverRestPeriods.createdAt,
          updatedAt: driverRestPeriods.updatedAt,
          driverName: driver.name,
          driverEmail: driver.email,
          serviceStartMinuteLocal:
            driverRestSchedules.serviceStartMinuteLocal,
          startMinuteLocal: driverRestSchedules.startMinuteLocal,
          timezone: driverRestSchedules.timezone,
        })
        .from(driverRestPeriods)
        .innerJoin(driver, eq(driverRestPeriods.driverUserId, driver.id))
        .innerJoin(
          driverRestSchedules,
          eq(driverRestPeriods.scheduleId, driverRestSchedules.id),
        )
        .orderBy(desc(driverRestPeriods.scheduledStartAt));

      const rows = conditions.length > 0
        ? await query.where(and(...conditions))
        : await query;
      return rows as DriverRestPeriodReportRow[];
    } catch (err) {
      throw AppError.internal(
        `Failed to list driver rest report: ${String(err)}`,
      );
    }
  }
  async listServiceScheduleReport(filter: {
    driverUserId?: string;
  }): Promise<DriverServiceScheduleReportRow[]> {
    try {
      const driver = alias(users, "service_schedule_driver");
      const conditions: SQL[] = [isNull(driverRestSchedules.effectiveTo)];

      if (filter.driverUserId) {
        conditions.push(
          eq(driverRestSchedules.driverUserId, filter.driverUserId),
        );
      }

      const rows = await db
        .select({
          id: driverRestSchedules.id,
          driverUserId: driverRestSchedules.driverUserId,
          serviceStartMinuteLocal:
            driverRestSchedules.serviceStartMinuteLocal,
          startMinuteLocal: driverRestSchedules.startMinuteLocal,
          durationMinutes: driverRestSchedules.durationMinutes,
          timezone: driverRestSchedules.timezone,
          effectiveFrom: driverRestSchedules.effectiveFrom,
          effectiveTo: driverRestSchedules.effectiveTo,
          createdByUserId: driverRestSchedules.createdByUserId,
          createdAt: driverRestSchedules.createdAt,
          updatedAt: driverRestSchedules.updatedAt,
          driverName: driver.name,
          driverEmail: driver.email,
        })
        .from(driverRestSchedules)
        .innerJoin(
          driver,
          eq(driverRestSchedules.driverUserId, driver.id),
        )
        .where(and(...conditions))
        .orderBy(desc(driverRestSchedules.updatedAt));

      return rows as DriverServiceScheduleReportRow[];
    } catch (err) {
      throw AppError.internal(
        `Failed to list driver service schedules: ${String(err)}`,
      );
    }
  }

}
