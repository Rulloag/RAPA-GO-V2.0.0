import { TokenService } from "../auth/token.service.js";
import { SessionService } from "../auth/session.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import { DriverStatusRepository } from "./driverStatus.repository.js";
import {
  DriverComplianceRepository,
  type DriverRestPeriodReportRow,
  type DriverServiceScheduleReportRow,
  type RideDriverAssignmentReportRow,
} from "./driverCompliance.repository.js";
import type {
  DriverRestPeriod,
  DriverRestSchedule,
} from "../../db/schema/index.js";
import type { UpsertDriverRestScheduleInput } from "./driverCompliance.schemas.js";
import { RideAssignmentOffersRepository } from "../rides/rideAssignmentOffers.repository.js";
import { attemptQueuedOffer } from "../rides/rideQueueOfferProducer.service.js";

const tokenService = new TokenService();
const sessionService = new SessionService();
const usersRepo = new UsersRepository();
const complianceRepo = new DriverComplianceRepository();
const driverStatusRepo = new DriverStatusRepository();
const offersRepo = new RideAssignmentOffersRepository();

/**
 * Fase 5.2 — mismo tratamiento que en driverStatus.service.ts: resolver
 * cualquier B en cola antes de dejar que clearStaleCurrentRide() limpie
 * current_ride_id, para nunca dejar queued_ride_id apuntando a una B
 * huérfana.
 */
async function resolveQueuedRideBeforeClearingStale(
  driverUserId: string,
  staleCurrentRideId: string,
): Promise<void> {
  const resolution = await driverStatusRepo.resolveQueuedRideOnAbnormalEnd(
    driverUserId,
    staleCurrentRideId,
  );

  if (resolution.decision === "RESOLVED") {
    await offersRepo.markCancelledByRideId(resolution.releasedRideId);
    void attemptQueuedOffer(resolution.releasedRideId).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[RAPA GO] No se pudo reasignar B ${resolution.releasedRideId} tras reconciliación de estado stale: ${message.slice(0, 300)}`);
    });
  }
}

export const DRIVER_REST_TIMEZONE = "Pacific/Easter";
export const DRIVER_REST_DURATION_MINUTES = 12 * 60;


type AuthResult =
  | { ok: true; userId: string; role: string }
  | { ok: false; code: string; message: string; statusCode: number };

export type DriverRestState = {
  blockedForNewOffers: boolean;
  status:
    | "not_configured"
    | "scheduled"
    | "reminder_due"
    | "working"
    | "active"
    | "completed";
  message: string;
  activePeriod: ReturnType<typeof serializePeriod>;
  nextScheduledStartAt: string | null;
  reminderDue: boolean;
  workingSelected: boolean;
  canStartRest: boolean;
  canContinueWorking: boolean;
  hasActiveRide: boolean;
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
    // startTime se conserva para clientes antiguos.
    startTime: formatStartTime(schedule.startMinuteLocal),
    serviceStartTime: formatStartTime(
      schedule.serviceStartMinuteLocal ?? 600,
    ),
    serviceEndTime: formatStartTime(schedule.startMinuteLocal),
    serviceStartMinuteLocal:
      schedule.serviceStartMinuteLocal ?? 600,
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
    decision:
      period.decision === "rest" || period.decision === "work"
        ? period.decision
        : null,
    decisionAt: period.decisionAt?.toISOString() ?? null,
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
    // Compatibilidad con el Excel anterior.
    startTime: formatStartTime(row.startMinuteLocal),
    serviceStartTime: formatStartTime(
      row.serviceStartMinuteLocal ?? 600,
    ),
    serviceEndTime: formatStartTime(row.startMinuteLocal),
    timezone: row.timezone,
  };
}

function serializeServiceScheduleReport(
  row: DriverServiceScheduleReportRow,
  nextScheduledEndAt: Date | null,
) {
  return {
    ...serializeSchedule(row),
    driverName: row.driverName ?? null,
    driverEmail: row.driverEmail ?? null,
    nextScheduledEndAt: nextScheduledEndAt?.toISOString() ?? null,
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
      // La hora guardada es el término del horario de servicios. Al llegar,
      // solo se muestra el aviso: no se activa el descanso automáticamente.
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
    next: {
      schedule: DriverRestSchedule;
      scheduledStartAt: Date;
    } | null;
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

    const current =
      [yesterdayCandidate, todayCandidate]
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

    const next =
      [todayCandidate, tomorrowCandidate]
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
        )[0] ?? null;

    return { current, next };
  }

  private async createManualScheduleIfMissing(
    driverUserId: string,
    now: Date,
  ): Promise<DriverRestSchedule> {
    const today = getLocalDateKey(now);
    const serviceEndMinute = getLocalMinute(now);
    const serviceStartMinute =
      (serviceEndMinute - DRIVER_REST_DURATION_MINUTES + 1440) % 1440;

    return complianceRepo.replaceSchedule({
      driverUserId,
      serviceStartMinuteLocal: serviceStartMinute,
      startMinuteLocal: serviceEndMinute,
      durationMinutes: DRIVER_REST_DURATION_MINUTES,
      timezone: DRIVER_REST_TIMEZONE,
      effectiveFrom: today,
      createdByUserId: driverUserId,
    });
  }

  private async getActionCandidate(
    driverUserId: string,
    now: Date,
  ): Promise<{
    schedule: DriverRestSchedule;
    scheduledStartAt: Date;
  }> {
    let candidates = await this.findCurrentAndNextCandidate(
      driverUserId,
      now,
    );

    const existing = candidates.current ?? candidates.next;
    if (existing) return existing;

    const schedule = await this.createManualScheduleIfMissing(
      driverUserId,
      now,
    );
    const localDateKey = getLocalDateKey(now, schedule.timezone);

    return {
      schedule,
      scheduledStartAt: zonedLocalToUtc(
        localDateKey,
        schedule.startMinuteLocal,
        schedule.timezone,
      ),
    };
  }

  /**
   * ride_requests es la fuente de verdad para saber si existe un viaje activo.
   * driver_statuses.currentRideId puede quedar obsoleto después de cierres,
   * cancelaciones antiguas o despliegues incompletos.
   */
  private async resolveRealActiveRideId(
    driverUserId: string,
  ): Promise<string | null> {
    const [driverStatus, activeRideId] = await Promise.all([
      driverStatusRepo.findByDriverId(driverUserId),
      complianceRepo.findActiveRideIdForDriver(driverUserId),
    ]);

    if (activeRideId) {
      if (driverStatus?.currentRideId !== activeRideId) {
        await driverStatusRepo.setBusy(driverUserId, activeRideId);
      }
      return activeRideId;
    }

    if (driverStatus?.currentRideId) {
      await resolveQueuedRideBeforeClearingStale(driverUserId, driverStatus.currentRideId);
      await driverStatusRepo.clearStaleCurrentRide(driverUserId);
    }

    return null;
  }

  private buildState(input: {
    blockedForNewOffers: boolean;
    status: DriverRestState["status"];
    message: string;
    activePeriod?: DriverRestPeriod | null;
    nextScheduledStartAt?: Date | null;
    reminderDue?: boolean;
    workingSelected?: boolean;
    canStartRest?: boolean;
    canContinueWorking?: boolean;
    hasActiveRide?: boolean;
  }): DriverRestState {
    return {
      blockedForNewOffers: input.blockedForNewOffers,
      status: input.status,
      message: input.message,
      activePeriod: serializePeriod(input.activePeriod ?? null),
      nextScheduledStartAt:
        input.nextScheduledStartAt?.toISOString() ?? null,
      reminderDue: Boolean(input.reminderDue),
      workingSelected: Boolean(input.workingSelected),
      canStartRest: Boolean(input.canStartRest),
      canContinueWorking: Boolean(input.canContinueWorking),
      hasActiveRide: Boolean(input.hasActiveRide),
    };
  }

  async evaluateDriverRest(
    driverUserId: string,
    now = new Date(),
  ): Promise<DriverRestState> {
    const [activePeriod, activeRideId] = await Promise.all([
      complianceRepo.findLatestOpenPeriod(driverUserId),
      this.resolveRealActiveRideId(driverUserId),
    ]);

    const hasActiveRide = Boolean(activeRideId);

    // Solo un descanso iniciado manualmente puede bloquear al conductor.
    if (activePeriod?.status === "active") {
      const requiredEndAt = activePeriod.requiredEndAt;

      if (requiredEndAt && requiredEndAt.getTime() <= now.getTime()) {
        const completed =
          (await complianceRepo.completePeriod(activePeriod.id, now)) ??
          activePeriod;
        const candidates = await this.findCurrentAndNextCandidate(
          driverUserId,
          now,
        );

        return this.buildState({
          blockedForNewOffers: false,
          status: "completed",
          message:
            "Completaste tus 12 horas continuas. Puedes trabajar cuando tú decidas marcarte Disponible.",
          activePeriod: completed,
          nextScheduledStartAt: candidates.next?.scheduledStartAt ?? null,
          canStartRest: false,
          canContinueWorking: false,
          hasActiveRide,
        });
      }

      await driverStatusRepo.setUnavailableForRest(driverUserId);

      return this.buildState({
        blockedForNewOffers: true,
        status: "active",
        message:
          "Tu descanso continuo está activo. El botón Trabajar permanecerá deshabilitado hasta completar las 12 horas.",
        activePeriod,
        reminderDue: false,
        workingSelected: false,
        canStartRest: false,
        canContinueWorking: false,
        hasActiveRide,
      });
    }

    const candidates = await this.findCurrentAndNextCandidate(
      driverUserId,
      now,
    );

    if (!candidates.current) {
      if (!candidates.next) {
        return this.buildState({
          blockedForNewOffers: false,
          status: "not_configured",
          message:
            "Configura tu horario de servicios. El horario solo sirve para organizarte y nunca cambia tu disponibilidad automáticamente.",
          canStartRest: !hasActiveRide,
          canContinueWorking: true,
          hasActiveRide,
        });
      }

      const upcomingPeriod =
        await complianceRepo.findPeriodByScheduledStart(
          driverUserId,
          candidates.next.scheduledStartAt,
        );

      if (
        upcomingPeriod?.status === "working" ||
        upcomingPeriod?.decision === "work"
      ) {
        return this.buildState({
          blockedForNewOffers: false,
          status: "working",
          message:
            "Elegiste Trabajar para el próximo ciclo. Tomar descanso permanecerá deshabilitado hasta el siguiente horario.",
          activePeriod: upcomingPeriod,
          nextScheduledStartAt: candidates.next.scheduledStartAt,
          workingSelected: true,
          canStartRest: false,
          canContinueWorking: true,
          hasActiveRide,
        });
      }

      return this.buildState({
        blockedForNewOffers: false,
        status: "scheduled",
        message:
          "Tu horario de servicios está programado. Cuando llegue la hora de término podrás elegir Tomar descanso o Trabajar.",
        nextScheduledStartAt: candidates.next.scheduledStartAt,
        canStartRest: !hasActiveRide,
        canContinueWorking: true,
        hasActiveRide,
      });
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

    if (
      period.status === "scheduled" ||
      period.status === "pending_trip_completion"
    ) {
      period =
        (await complianceRepo.markPeriodReminderDue(period.id)) ??
        period;
    }

    if (period.status === "working" || period.decision === "work") {
      return this.buildState({
        blockedForNewOffers: false,
        status: "working",
        message:
          "Elegiste Trabajar para este ciclo. El descanso quedó deshabilitado hasta el próximo término de tu horario de servicios.",
        activePeriod: period,
        nextScheduledStartAt: candidates.next?.scheduledStartAt ?? null,
        workingSelected: true,
        canStartRest: false,
        canContinueWorking: true,
        hasActiveRide,
      });
    }

    if (period.status === "completed") {
      return this.buildState({
        blockedForNewOffers: false,
        status: "completed",
        message:
          "El descanso de este ciclo ya fue completado. Tu disponibilidad sigue bajo tu control.",
        activePeriod: period,
        nextScheduledStartAt: candidates.next?.scheduledStartAt ?? null,
        canStartRest: false,
        canContinueWorking: false,
        hasActiveRide,
      });
    }

    // Llegó la hora de término del servicio: solo se genera un aviso. No se
    // cambia Disponible/No disponible y no se bloquean nuevas ofertas.
    return this.buildState({
      blockedForNewOffers: false,
      status: "reminder_due",
      message: hasActiveRide
        ? "Terminó tu horario de servicios. Finaliza el viaje actual y luego podrás iniciar tus 12 horas, o elige Trabajar para continuar."
        : "Terminó tu horario de servicios. Elige Tomar descanso para iniciar las 12 horas o Trabajar para continuar.",
      activePeriod: period,
      nextScheduledStartAt: candidates.next?.scheduledStartAt ?? null,
      reminderDue: true,
      canStartRest: !hasActiveRide,
      canContinueWorking: true,
      hasActiveRide,
    });
  }

  async canReceiveNewOffers(driverUserId: string): Promise<{
    allowed: boolean;
    state: DriverRestState;
  }> {
    const state = await this.evaluateDriverRest(driverUserId);
    return { allowed: !state.blockedForNewOffers, state };
  }

  async releaseDriverAfterRide(
    driverUserId: string,
  ): Promise<DriverRestState> {
    const state = await this.evaluateDriverRest(driverUserId);

    if (state.blockedForNewOffers) {
      await driverStatusRepo.setUnavailableForRest(driverUserId);
    } else {
      // El horario de servicios no modifica la disponibilidad. Se conserva el
      // comportamiento normal de cierre de viaje de la aplicación.
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
        message: "Only drivers can access service schedules.",
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
        message: "Only drivers can update service schedules.",
        statusCode: 403,
      };
    }

    const now = new Date();
    const today = getLocalDateKey(now);
    const latest = await complianceRepo.findLatestSchedule(auth.userId);
    const serviceEndTime = input.serviceEndTime ?? input.startTime;

    if (!serviceEndTime) {
      return {
        ok: false as const,
        code: "VALIDATION_ERROR",
        message: "Debes indicar la hora de término del servicio.",
        statusCode: 400,
      };
    }

    const serviceStartTime =
      input.serviceStartTime ??
      (latest
        ? formatStartTime(latest.serviceStartMinuteLocal ?? 600)
        : "10:00");

    const serviceStartMinuteLocal = parseStartTime(serviceStartTime);
    const serviceEndMinuteLocal = parseStartTime(serviceEndTime);

    if (
      latest &&
      (latest.serviceStartMinuteLocal ?? 600) ===
        serviceStartMinuteLocal &&
      latest.startMinuteLocal === serviceEndMinuteLocal &&
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

    // El horario elegido por el conductor comienza a regir hoy. Es
    // planificación, por lo que modificarlo no inicia ni cancela un descanso.
    const schedule = await complianceRepo.replaceSchedule({
      driverUserId: auth.userId,
      serviceStartMinuteLocal,
      startMinuteLocal: serviceEndMinuteLocal,
      durationMinutes: DRIVER_REST_DURATION_MINUTES,
      timezone: DRIVER_REST_TIMEZONE,
      effectiveFrom: today,
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

  async startMyRest(accessToken: string) {
    const auth = await authenticate(accessToken);
    if (auth.ok === false) return auth;

    if (auth.role !== "driver") {
      return {
        ok: false as const,
        code: "AUTH_FORBIDDEN",
        message: "Only drivers can start a rest period.",
        statusCode: 403,
      };
    }

    const now = new Date();
    const [activeRideId, activeRest] = await Promise.all([
      this.resolveRealActiveRideId(auth.userId),
      complianceRepo.findLatestOpenPeriod(auth.userId),
    ]);

    if (activeRideId) {
      return {
        ok: false as const,
        code: "DRIVER_HAS_ACTIVE_RIDE",
        message:
          "Finaliza el viaje actual antes de comenzar las 12 horas de descanso. El viaje no será interrumpido.",
        statusCode: 409,
      };
    }

    if (activeRest?.status === "active") {
      const state = await this.evaluateDriverRest(auth.userId, now);
      const today = getLocalDateKey(now);
      return {
        ok: true as const,
        compliance: {
          effectiveSchedule: serializeSchedule(
            await complianceRepo.findScheduleForDate(auth.userId, today),
          ),
          latestSchedule: serializeSchedule(
            await complianceRepo.findLatestSchedule(auth.userId),
          ),
          state,
        },
      };
    }

    const candidate = await this.getActionCandidate(auth.userId, now);
    let period = await complianceRepo.findPeriodByScheduledStart(
      auth.userId,
      candidate.scheduledStartAt,
    );

    if (!period) {
      period = await complianceRepo.createPeriod({
        driverUserId: auth.userId,
        scheduleId: candidate.schedule.id,
        scheduledStartAt: candidate.scheduledStartAt,
        durationMinutes: candidate.schedule.durationMinutes,
      });
    }

    if (period.status === "working" || period.decision === "work") {
      return {
        ok: false as const,
        code: "DRIVER_REST_DISABLED_FOR_CYCLE",
        message:
          "Elegiste Trabajar para este ciclo. Podrás tomar descanso cuando comience el siguiente ciclo de tu horario.",
        statusCode: 409,
      };
    }

    if (period.status === "completed") {
      return {
        ok: false as const,
        code: "DRIVER_REST_ALREADY_COMPLETED",
        message: "El descanso de este ciclo ya fue completado.",
        statusCode: 409,
      };
    }

    const active =
      (await complianceRepo.activatePeriod(
        period.id,
        now,
        candidate.schedule.durationMinutes,
      )) ?? period;

    await driverStatusRepo.setUnavailableForRest(auth.userId);

    const today = getLocalDateKey(now);
    return {
      ok: true as const,
      compliance: {
        effectiveSchedule: serializeSchedule(
          await complianceRepo.findScheduleForDate(auth.userId, today),
        ),
        latestSchedule: serializeSchedule(
          await complianceRepo.findLatestSchedule(auth.userId),
        ),
        state: this.buildState({
          blockedForNewOffers: true,
          status: "active",
          message:
            "Comenzaste tu descanso continuo. Trabajar queda deshabilitado hasta completar las 12 horas.",
          activePeriod: active,
          canStartRest: false,
          canContinueWorking: false,
          hasActiveRide: false,
        }),
      },
    };
  }

  async continueWorking(accessToken: string) {
    const auth = await authenticate(accessToken);
    if (auth.ok === false) return auth;

    if (auth.role !== "driver") {
      return {
        ok: false as const,
        code: "AUTH_FORBIDDEN",
        message: "Only drivers can continue working.",
        statusCode: 403,
      };
    }

    const now = new Date();
    const [activeRest, activeRideId] = await Promise.all([
      complianceRepo.findLatestOpenPeriod(auth.userId),
      this.resolveRealActiveRideId(auth.userId),
    ]);
    const hasActiveRide = Boolean(activeRideId);

    if (activeRest?.status === "active") {
      return {
        ok: false as const,
        code: "DRIVER_REST_ACTIVE",
        message:
          "No puedes elegir Trabajar mientras el descanso de 12 horas está activo.",
        statusCode: 409,
      };
    }

    const candidatesBeforeDecision =
      await this.findCurrentAndNextCandidate(auth.userId, now);

    let candidate =
      candidatesBeforeDecision.current ??
      candidatesBeforeDecision.next ??
      (await this.getActionCandidate(auth.userId, now));

    let period = await complianceRepo.findPeriodByScheduledStart(
      auth.userId,
      candidate.scheduledStartAt,
    );

    // Si el ciclo anterior ya terminó o ya fue descartado y existe un ciclo
    // próximo, el botón Trabajar se aplica a ese próximo aviso.
    if (
      period &&
      (period.status === "completed" ||
        period.status === "working" ||
        period.decision === "work") &&
      candidatesBeforeDecision.next
    ) {
      candidate = candidatesBeforeDecision.next;
      period = await complianceRepo.findPeriodByScheduledStart(
        auth.userId,
        candidate.scheduledStartAt,
      );
    }

    if (!period) {
      period = await complianceRepo.createPeriod({
        driverUserId: auth.userId,
        scheduleId: candidate.schedule.id,
        scheduledStartAt: candidate.scheduledStartAt,
        durationMinutes: candidate.schedule.durationMinutes,
      });
    }

    const working =
      (await complianceRepo.markPeriodWorking(period.id, now)) ??
      period;

    const today = getLocalDateKey(now);
    const candidates = await this.findCurrentAndNextCandidate(
      auth.userId,
      now,
    );

    return {
      ok: true as const,
      compliance: {
        effectiveSchedule: serializeSchedule(
          await complianceRepo.findScheduleForDate(auth.userId, today),
        ),
        latestSchedule: serializeSchedule(
          await complianceRepo.findLatestSchedule(auth.userId),
        ),
        state: this.buildState({
          blockedForNewOffers: false,
          status: "working",
          message:
            "Elegiste Trabajar. El descanso quedó deshabilitado para este ciclo y tu disponibilidad continúa bajo tu control.",
          activePeriod: working,
          nextScheduledStartAt:
            candidates.next?.scheduledStartAt ?? null,
          workingSelected: true,
          canStartRest: false,
          canContinueWorking: true,
          hasActiveRide,
        }),
      },
    };
  }

  async adminListServiceScheduleReport(
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

    const driverUserId = String(query["driverUserId"] ?? "").trim();
    const rows = await complianceRepo.listServiceScheduleReport(
      driverUserId ? { driverUserId } : {},
    );
    const now = new Date();

    return {
      ok: true as const,
      schedules: rows.map((row) => {
        const today = getLocalDateKey(now, row.timezone);
        const todayEnd = zonedLocalToUtc(
          today,
          row.startMinuteLocal,
          row.timezone,
        );
        const nextEnd =
          todayEnd.getTime() > now.getTime()
            ? todayEnd
            : zonedLocalToUtc(
                addLocalDays(today, 1),
                row.startMinuteLocal,
                row.timezone,
              );

        return serializeServiceScheduleReport(row, nextEnd);
      }),
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
