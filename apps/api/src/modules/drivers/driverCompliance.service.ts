import { TokenService } from "../auth/token.service.js";
import { SessionService } from "../auth/session.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import { DriverStatusRepository } from "./driverStatus.repository.js";
import {
  DriverComplianceRepository,
  type DriverRestPeriodReportRow,
  type RideDriverAssignmentReportRow,
} from "./driverCompliance.repository.js";
import type {
  DriverRestPeriod,
  DriverRestSchedule,
} from "../../db/schema/index.js";
import type { UpsertDriverRestScheduleInput } from "./driverCompliance.schemas.js";

const tokenService = new TokenService();
const sessionService = new SessionService();
const usersRepo = new UsersRepository();
const complianceRepo = new DriverComplianceRepository();
const driverStatusRepo = new DriverStatusRepository();

export const DRIVER_REST_TIMEZONE = "Pacific/Easter";
export const DRIVER_REST_DURATION_MINUTES = 12 * 60;

const ACTIVE_REST_STATUSES = new Set([
  "scheduled",
  "pending_trip_completion",
  "active",
]);

type AuthResult =
  | { ok: true; userId: string; role: string }
  | { ok: false; code: string; message: string; statusCode: number };

export type DriverRestState = {
  blockedForNewOffers: boolean;
  status:
    | "not_configured"
    | "outside_rest_window"
    | "pending_trip_completion"
    | "active"
    | "completed";
  message: string;
  activePeriod: ReturnType<typeof serializePeriod>;
  nextScheduledStartAt: string | null;
};

async function authenticate(accessToken: string): Promise<AuthResult> {
  let payload;
  try {
    payload = tokenService.verifyAccessToken(accessToken);
  } catch (err) {
    if (err instanceof AppError) {
      return {
        ok: false,
        code: err.code,
        message: err.message,
        statusCode: err.statusCode,
      };
    }
    return {
      ok: false,
      code: "UNAUTHORIZED",
      message: "Invalid access token.",
      statusCode: 401,
    };
  }

  const hash = tokenService.hashToken(accessToken);
  const valid = await sessionService.isSessionValid(hash);
  if (!valid) {
    return {
      ok: false,
      code: "AUTH_SESSION_REVOKED",
      message: "Session has been revoked.",
      statusCode: 401,
    };
  }

  const user = await usersRepo.findById(payload.sub);
  if (!user) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "User not found.",
      statusCode: 404,
    };
  }

  return { ok: true, userId: user.id, role: user.role };
}

function parseStartTime(value: string): number {
  const [hoursText, minutesText] = value.split(":");
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  return hours * 60 + minutes;
}

function formatStartTime(startMinuteLocal: number): string {
  const safe = Math.min(1439, Math.max(0, Math.round(startMinuteLocal)));
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function addLocalDays(dateKey: string, days: number): string {
  const value = new Date(`${dateKey}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function getZonedParts(
  value: Date,
  timezone: string,
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(value)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<string, number>;

  return {
    year: parts["year"] ?? 0,
    month: parts["month"] ?? 0,
    day: parts["day"] ?? 0,
    hour: parts["hour"] ?? 0,
    minute: parts["minute"] ?? 0,
    second: parts["second"] ?? 0,
  };
}

function getLocalDateKey(value: Date, timezone = DRIVER_REST_TIMEZONE): string {
  const parts = getZonedParts(value, timezone);
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function getLocalMinute(value: Date, timezone = DRIVER_REST_TIMEZONE): number {
  const parts = getZonedParts(value, timezone);
  return parts.hour * 60 + parts.minute;
}

/**
 * Convierte una fecha/hora civil de Rapa Nui a un instante UTC sin depender de
 * que la zona mantenga siempre el mismo offset. La iteración también respeta
 * cambios de horario de verano del identificador IANA.
 */
function zonedLocalToUtc(
  localDateKey: string,
  startMinuteLocal: number,
  timezone: string,
): Date {
  const [yearText, monthText, dayText] = localDateKey.split("-");
  const targetYear = Number(yearText);
  const targetMonth = Number(monthText);
  const targetDay = Number(dayText);
  const targetHour = Math.floor(startMinuteLocal / 60);
  const targetMinute = startMinuteLocal % 60;

  const targetAsUtc = Date.UTC(
    targetYear,
    targetMonth - 1,
    targetDay,
    targetHour,
    targetMinute,
    0,
    0,
  );

  let guess = targetAsUtc;
  for (let index = 0; index < 5; index += 1) {
    const parts = getZonedParts(new Date(guess), timezone);
    const representedAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      0,
    );
    const difference = targetAsUtc - representedAsUtc;
    guess += difference;
    if (Math.abs(difference) < 1000) break;
  }

  return new Date(guess);
}

function serializeSchedule(schedule: DriverRestSchedule | null) {
  if (!schedule) return null;
  return {
    id: schedule.id,
    driverUserId: schedule.driverUserId,
    startTime: formatStartTime(schedule.startMinuteLocal),
    startMinuteLocal: schedule.startMinuteLocal,
    durationMinutes: schedule.durationMinutes,
    durationHours: schedule.durationMinutes / 60,
    timezone: schedule.timezone,
    effectiveFrom: schedule.effectiveFrom,
    effectiveTo: schedule.effectiveTo ?? null,
    createdAt: schedule.createdAt.toISOString(),
    updatedAt: schedule.updatedAt.toISOString(),
  };
}

function serializePeriod(period: DriverRestPeriod | null) {
  if (!period) return null;
  return {
    id: period.id,
    driverUserId: period.driverUserId,
    scheduleId: period.scheduleId,
    scheduledStartAt: period.scheduledStartAt.toISOString(),
    actualStartAt: period.actualStartAt?.toISOString() ?? null,
    requiredEndAt: period.requiredEndAt?.toISOString() ?? null,
    completedAt: period.completedAt?.toISOString() ?? null,
    status: period.status,
    delayedByRideId: period.delayedByRideId ?? null,
    durationMinutes: period.durationMinutes,
    durationHours: period.durationMinutes / 60,
  };
}

function serializeAssignmentReport(row: RideDriverAssignmentReportRow) {
  return {
    id: row.id,
    rideRequestId: row.rideRequestId,
    driverUserId: row.driverUserId,
    driverName: row.driverName ?? null,
    driverEmail: row.driverEmail ?? null,
    originText: row.originText ?? null,
    destinationText: row.destinationText ?? null,
    acceptedAt: row.acceptedAt.toISOString(),
    endedAt: row.endedAt?.toISOString() ?? null,
    elapsedSeconds: row.elapsedSeconds ?? null,
    outcome: row.outcome,
    cancellationReason: row.cancellationReason ?? null,
    cancelledByUserId: row.cancelledByUserId ?? null,
    cancelledByRole: row.cancelledByRole ?? null,
    cancellationEvent: row.cancellationEvent ?? null,
    locationLat: row.locationLat ?? null,
    locationLng: row.locationLng ?? null,
    locationAccuracyMeters: row.locationAccuracyMeters ?? null,
    locationCapturedAt: row.locationCapturedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeRestReport(row: DriverRestPeriodReportRow) {
  const period = serializePeriod(row)!;
  return {
    ...period,
    driverName: row.driverName ?? null,
    driverEmail: row.driverEmail ?? null,
    startTime: formatStartTime(row.startMinuteLocal),
    timezone: row.timezone,
  };
}

function parseOptionalDate(value: unknown): Date | undefined {
  const text = String(value ?? "").trim();
  if (!text) return undefined;
  const parsed = new Date(text);
  return Number.isFinite(parsed.getTime()) ? parsed : undefined;
}

export class DriverComplianceService {
  private async findCandidateForDate(
    driverUserId: string,
    localDateKey: string,
  ): Promise<{
    schedule: DriverRestSchedule;
    scheduledStartAt: Date;
  } | null> {
    const schedule = await complianceRepo.findScheduleForDate(
      driverUserId,
      localDateKey,
    );
    if (!schedule) return null;

    return {
      schedule,
      scheduledStartAt: zonedLocalToUtc(
        localDateKey,
        schedule.startMinuteLocal,
        schedule.timezone,
      ),
    };
  }

  private async findCurrentAndNextCandidate(
    driverUserId: string,
    now: Date,
  ): Promise<{
    current: {
      schedule: DriverRestSchedule;
      scheduledStartAt: Date;
    } | null;
    nextScheduledStartAt: Date | null;
  }> {
    const today = getLocalDateKey(now);
    const yesterday = addLocalDays(today, -1);
    const tomorrow = addLocalDays(today, 1);

    const [yesterdayCandidate, todayCandidate, tomorrowCandidate] =
      await Promise.all([
        this.findCandidateForDate(driverUserId, yesterday),
        this.findCandidateForDate(driverUserId, today),
        this.findCandidateForDate(driverUserId, tomorrow),
      ]);

    const current = [yesterdayCandidate, todayCandidate]
      .filter(
        (
          item,
        ): item is {
          schedule: DriverRestSchedule;
          scheduledStartAt: Date;
        } => Boolean(item && item.scheduledStartAt.getTime() <= now.getTime()),
      )
      .sort(
        (a, b) =>
          b.scheduledStartAt.getTime() - a.scheduledStartAt.getTime(),
      )[0] ?? null;

    const nextScheduledStartAt = [todayCandidate, tomorrowCandidate]
      .filter(
        (
          item,
        ): item is {
          schedule: DriverRestSchedule;
          scheduledStartAt: Date;
        } => Boolean(item && item.scheduledStartAt.getTime() > now.getTime()),
      )
      .sort(
        (a, b) =>
          a.scheduledStartAt.getTime() - b.scheduledStartAt.getTime(),
      )[0]?.scheduledStartAt ?? null;

    return { current, nextScheduledStartAt };
  }

  async evaluateDriverRest(
    driverUserId: string,
    now = new Date(),
  ): Promise<DriverRestState> {
    let openPeriod = await complianceRepo.findLatestOpenPeriod(driverUserId);
    const [driverStatus, activeRideFromDatabase] = await Promise.all([
      driverStatusRepo.findByDriverId(driverUserId),
      complianceRepo.findActiveRideIdForDriver(driverUserId),
    ]);
    const activeRideId =
      driverStatus?.currentRideId ?? activeRideFromDatabase ?? null;

    // Un período pendiente o activo prevalece aunque ya haya comenzado la
    // franja del día siguiente. Así se resguardan doce horas continuas reales.
    if (openPeriod && ACTIVE_REST_STATUSES.has(openPeriod.status)) {
      if (openPeriod.status === "pending_trip_completion") {
        if (activeRideId) {
          return {
            blockedForNewOffers: true,
            status: "pending_trip_completion",
            message:
              "Tu descanso de 12 horas ya comenzó. Puedes finalizar el viaje actual, pero no recibirás nuevas ofertas.",
            activePeriod: serializePeriod(openPeriod),
            nextScheduledStartAt: null,
          };
        }

        openPeriod =
          (await complianceRepo.activatePeriod(
            openPeriod.id,
            now,
            openPeriod.durationMinutes,
          )) ?? openPeriod;
      }

      if (openPeriod.status === "active" || openPeriod.actualStartAt) {
        const requiredEndAt = openPeriod.requiredEndAt;
        if (requiredEndAt && requiredEndAt.getTime() <= now.getTime()) {
          const completed =
            (await complianceRepo.completePeriod(openPeriod.id, now)) ??
            openPeriod;
          const candidates = await this.findCurrentAndNextCandidate(
            driverUserId,
            now,
          );
          return {
            blockedForNewOffers: false,
            status: "completed",
            message:
              "Completaste tus 12 horas continuas. Activa Disponible cuando quieras volver a trabajar.",
            activePeriod: serializePeriod(completed),
            nextScheduledStartAt:
              candidates.nextScheduledStartAt?.toISOString() ?? null,
          };
        }

        await driverStatusRepo.setUnavailableForRest(driverUserId);
        return {
          blockedForNewOffers: true,
          status: "active",
          message:
            "Estás en tu período continuo de 12 horas. El backend mantiene bloqueadas las nuevas ofertas.",
          activePeriod: serializePeriod(openPeriod),
          nextScheduledStartAt: null,
        };
      }
    }

    const candidates = await this.findCurrentAndNextCandidate(driverUserId, now);
    if (!candidates.current) {
      const hasFutureSchedule = Boolean(candidates.nextScheduledStartAt);
      if (!hasFutureSchedule) {
        await driverStatusRepo.setUnavailableForRest(driverUserId);
      }

      return {
        blockedForNewOffers: !hasFutureSchedule,
        status: "not_configured",
        message: hasFutureSchedule
          ? "Tu franja de descanso quedó programada y todavía no comienza."
          : "Debes elegir una franja diaria de 12 horas antes de recibir nuevas ofertas.",
        activePeriod: null,
        nextScheduledStartAt:
          candidates.nextScheduledStartAt?.toISOString() ?? null,
      };
    }

    const { schedule, scheduledStartAt } = candidates.current;
    let period = await complianceRepo.findPeriodByScheduledStart(
      driverUserId,
      scheduledStartAt,
    );
    if (!period) {
      period = await complianceRepo.createPeriod({
        driverUserId,
        scheduleId: schedule.id,
        scheduledStartAt,
        durationMinutes: schedule.durationMinutes,
      });
    }

    if (activeRideId) {
      const pending =
        (await complianceRepo.markPeriodPending(period.id, activeRideId)) ??
        period;
      return {
        blockedForNewOffers: true,
        status: "pending_trip_completion",
        message:
          "Tu franja de descanso comenzó durante un viaje. Finalízalo y luego se contarán 12 horas continuas completas.",
        activePeriod: serializePeriod(pending),
        nextScheduledStartAt: null,
      };
    }

    const actualStartAt = scheduledStartAt;
    const scheduledEndAt = new Date(
      actualStartAt.getTime() + schedule.durationMinutes * 60_000,
    );

    if (scheduledEndAt.getTime() <= now.getTime()) {
      const activated =
        (await complianceRepo.activatePeriod(
          period.id,
          actualStartAt,
          schedule.durationMinutes,
        )) ?? period;
      const completed =
        (await complianceRepo.completePeriod(activated.id, scheduledEndAt)) ??
        activated;
      return {
        blockedForNewOffers: false,
        status: "completed",
        message:
          "La franja diaria anterior ya fue completada. Activa Disponible cuando corresponda.",
        activePeriod: serializePeriod(completed),
        nextScheduledStartAt:
          candidates.nextScheduledStartAt?.toISOString() ?? null,
      };
    }

    const active =
      (await complianceRepo.activatePeriod(
        period.id,
        actualStartAt,
        schedule.durationMinutes,
      )) ?? period;
    await driverStatusRepo.setUnavailableForRest(driverUserId);

    return {
      blockedForNewOffers: true,
      status: "active",
      message:
        "Estás en tu período continuo de 12 horas. No recibirás nuevas ofertas hasta completarlo.",
      activePeriod: serializePeriod(active),
      nextScheduledStartAt: null,
    };
  }

  async canReceiveNewOffers(driverUserId: string): Promise<{
    allowed: boolean;
    state: DriverRestState;
  }> {
    const state = await this.evaluateDriverRest(driverUserId);
    return { allowed: !state.blockedForNewOffers, state };
  }

  async releaseDriverAfterRide(driverUserId: string): Promise<DriverRestState> {
    const state = await this.evaluateDriverRest(driverUserId);
    if (state.blockedForNewOffers) {
      await driverStatusRepo.setUnavailableForRest(driverUserId);
    } else {
      await driverStatusRepo.setAvailable(driverUserId);
    }
    return state;
  }

  async getMyRestSchedule(accessToken: string) {
    const auth = await authenticate(accessToken);
    if (auth.ok === false) return auth;
    if (auth.role !== "driver") {
      return {
        ok: false as const,
        code: "AUTH_FORBIDDEN",
        message: "Only drivers can access rest schedules.",
        statusCode: 403,
      };
    }

    const today = getLocalDateKey(new Date());
    const [effectiveSchedule, latestSchedule, state] = await Promise.all([
      complianceRepo.findScheduleForDate(auth.userId, today),
      complianceRepo.findLatestSchedule(auth.userId),
      this.evaluateDriverRest(auth.userId),
    ]);

    return {
      ok: true as const,
      compliance: {
        effectiveSchedule: serializeSchedule(effectiveSchedule),
        latestSchedule: serializeSchedule(latestSchedule),
        state,
      },
    };
  }

  async upsertMyRestSchedule(
    accessToken: string,
    input: UpsertDriverRestScheduleInput,
  ) {
    const auth = await authenticate(accessToken);
    if (auth.ok === false) return auth;
    if (auth.role !== "driver") {
      return {
        ok: false as const,
        code: "AUTH_FORBIDDEN",
        message: "Only drivers can update rest schedules.",
        statusCode: 403,
      };
    }

    const now = new Date();
    const today = getLocalDateKey(now);
    const tomorrow = addLocalDays(today, 1);
    const startMinuteLocal = parseStartTime(input.startTime);
    const latest = await complianceRepo.findLatestSchedule(auth.userId);

    // Primera configuración: puede comenzar hoy solo si la franja aún no ha
    // iniciado. Toda modificación posterior rige desde el día siguiente.
    const effectiveFrom =
      !latest && startMinuteLocal > getLocalMinute(now)
        ? today
        : tomorrow;

    if (
      latest &&
      latest.startMinuteLocal === startMinuteLocal &&
      latest.durationMinutes === DRIVER_REST_DURATION_MINUTES &&
      latest.timezone === DRIVER_REST_TIMEZONE
    ) {
      const state = await this.evaluateDriverRest(auth.userId);
      return {
        ok: true as const,
        compliance: {
          effectiveSchedule: serializeSchedule(
            await complianceRepo.findScheduleForDate(auth.userId, today),
          ),
          latestSchedule: serializeSchedule(latest),
          state,
        },
      };
    }

    const schedule = await complianceRepo.replaceSchedule({
      driverUserId: auth.userId,
      startMinuteLocal,
      durationMinutes: DRIVER_REST_DURATION_MINUTES,
      timezone: DRIVER_REST_TIMEZONE,
      effectiveFrom,
      createdByUserId: auth.userId,
    });

    const state = await this.evaluateDriverRest(auth.userId);
    return {
      ok: true as const,
      compliance: {
        effectiveSchedule: serializeSchedule(
          await complianceRepo.findScheduleForDate(auth.userId, today),
        ),
        latestSchedule: serializeSchedule(schedule),
        state,
      },
    };
  }

  async adminListAssignmentReport(
    accessToken: string,
    query: Record<string, unknown>,
  ) {
    const auth = await authenticate(accessToken);
    if (auth.ok === false) return auth;
    if (auth.role !== "admin") {
      return {
        ok: false as const,
        code: "AUTH_FORBIDDEN",
        message: "Admin access required.",
        statusCode: 403,
      };
    }

    const assignmentFilters: {
      driverUserId?: string;
      rideRequestId?: string;
      from?: Date;
      to?: Date;
    } = {};

    const driverUserId = String(query["driverUserId"] ?? "").trim();
    const rideRequestId = String(query["rideRequestId"] ?? "").trim();
    const from = parseOptionalDate(query["from"]);
    const to = parseOptionalDate(query["to"]);

    if (driverUserId) {
      assignmentFilters.driverUserId = driverUserId;
    }

    if (rideRequestId) {
      assignmentFilters.rideRequestId = rideRequestId;
    }

    if (from) {
      assignmentFilters.from = from;
    }

    if (to) {
      assignmentFilters.to = to;
    }

    const rows =
      await complianceRepo.listAssignmentReport(assignmentFilters);

    return {
      ok: true as const,
      assignments: rows.map(serializeAssignmentReport),
    };
  }

  async adminListRestPeriodReport(
    accessToken: string,
    query: Record<string, unknown>,
  ) {
    const auth = await authenticate(accessToken);
    if (auth.ok === false) return auth;
    if (auth.role !== "admin") {
      return {
        ok: false as const,
        code: "AUTH_FORBIDDEN",
        message: "Admin access required.",
        statusCode: 403,
      };
    }

    const restFilters: {
      driverUserId?: string;
      from?: Date;
      to?: Date;
    } = {};

    const driverUserId = String(query["driverUserId"] ?? "").trim();
    const from = parseOptionalDate(query["from"]);
    const to = parseOptionalDate(query["to"]);

    if (driverUserId) {
      restFilters.driverUserId = driverUserId;
    }

    if (from) {
      restFilters.from = from;
    }

    if (to) {
      restFilters.to = to;
    }

    const rows =
      await complianceRepo.listRestPeriodReport(restFilters);

    return {
      ok: true as const,
      periods: rows.map(serializeRestReport),
    };
  }
}
