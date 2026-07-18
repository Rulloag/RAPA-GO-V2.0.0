import { TokenService } from "../auth/token.service.js";
import { SessionService } from "../auth/session.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { RidesRepository, type RideWithDriverName } from "./rides.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import type {
  RideRequestResponse,
  RidesListResult,
  RideResult,
  AvailableRideResponse,
  AvailableRidesResult,
  DriverRideResponse,
  DriverRidesListResult,
  RidePolicyChargeResponse,
  PolicyChargesResult,
  AdminPolicyChargesResult,
} from "./rides.types.js";
import type { RideRequest } from "../../db/schema/index.js";
import type { RidePolicyCharge } from "../../db/schema/ridePolicyCharges.schema.js";
import type {
  CreateRideRequestInput,
  CancelAcceptedInput,
  AdminPolicyChargeReviewInput,
  AdminUpsertApprovePolicyChargeInput,
} from "./rides.schemas.js";

const tokenService = new TokenService();
const sessionService = new SessionService();
const usersRepo = new UsersRepository();
const ridesRepo = new RidesRepository();

const SCHEDULE_ACTIVATION_MINUTES = 30;
const PASSENGER_FREE_CANCELLATION_MS = 2 * 60 * 1000;
const SCHEDULED_CANCELLATION_CHARGE_WINDOW_MS = 15 * 60 * 1000;
const DRIVER_NO_SHOW_WAIT_MS = 5 * 60 * 1000;
const LATE_CANCELLATION_PERCENT = 30;
const LATE_CANCELLATION_CAP_CLP = 3000;
const NO_SHOW_PERCENT = 50;
const NO_SHOW_CAP_CLP = 5000;

async function estimateFare(
  originText: string,
  destinationText: string,
): Promise<number> {
  let perKmCentavos = 230000;
  let minFareCentavos = 300000;

  try {
    const fareRepo = new (
      await import("../fareSettings/fareSettings.repository.js")
    ).FareSettingsRepository();

    const [perKmSetting, minSetting, zoneFare] = await Promise.all([
      fareRepo.findByType("mobility_per_km"),
      fareRepo.findByType("minimum_fare"),
      fareRepo.findZoneFareByRoute(originText, destinationText),
    ]);

    if (perKmSetting) perKmCentavos = perKmSetting.value;
    if (minSetting) minFareCentavos = minSetting.value;
    if (zoneFare) return zoneFare.fare;
  } catch {
    // Usa cálculo local si tarifas falla.
  }

  const estimatedKm = Math.max(
    1,
    (originText.length + destinationText.length) / 10,
  );

  const minFareCLP = Math.round(minFareCentavos / 100);
  const raw = minFareCLP + Math.round((estimatedKm * perKmCentavos) / 10000);

  return Math.min(Math.max(raw, minFareCLP), 50000);
}

type ScheduleMeta = {
  isScheduled: boolean;
  rideMode: "now" | "scheduled";
  tripFareMode: "one_way" | "round_trip";
  scheduledAt: string | null;
  scheduledPickupAt: string | null;
  scheduledReturnAt: string | null;
  scheduledActivationAt: string | null;
  scheduledReturnActivationAt: string | null;
  requestedByRole: "passenger" | "driver" | "admin" | string;
  requesterRoleLabel: string;
  adminScheduleStatus:
    | "pending_admin"
    | "active_admin"
    | "completed"
    | "cancelled";
};

function normalizeRideRole(
  value: unknown,
): "passenger" | "driver" | "admin" | string {
  const raw = String(value ?? "").trim().toLowerCase();

  if (!raw) return "passenger";
  if (raw.includes("admin")) return "admin";
  if (raw.includes("driver") || raw.includes("conductor")) return "driver";
  if (raw.includes("passenger") || raw.includes("pasajero")) return "passenger";

  return raw;
}

function toIsoOrNull(value: unknown): string | null {
  if (value == null || value === "") return null;

  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString();
  }

  const text = String(value).trim();
  if (!text) return null;

  const parsed = new Date(text);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function addMinutesIso(iso: string | null, minutes: number): string | null {
  const parsed = toIsoOrNull(iso);
  if (!parsed) return null;

  return new Date(new Date(parsed).getTime() + minutes * 60_000).toISOString();
}

function getNoteField(
  notes: string | null | undefined,
  label: string,
): string | null {
  if (!notes) return null;

  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = notes.match(new RegExp(`${escaped}\\s*:\\s*([^\\n]+)`, "i"));

  return match?.[1]?.trim() ?? null;
}

function extractScheduleMetaFromNotes(
  notes: string | null | undefined,
): Partial<ScheduleMeta> {
  if (!notes) return {};

  const pickup =
    toIsoOrNull(getNoteField(notes, "Fecha y hora de recogida agendada")) ??
    toIsoOrNull(getNoteField(notes, "Viaje programado para")) ??
    toIsoOrNull(getNoteField(notes, "Recogida"));

  const scheduledReturnAt =
    toIsoOrNull(getNoteField(notes, "Fecha y hora de regreso agendada")) ??
    toIsoOrNull(getNoteField(notes, "Regreso"));

  const scheduledActivationAt =
    toIsoOrNull(getNoteField(notes, "Activación automática recogida")) ??
    toIsoOrNull(getNoteField(notes, "Se activa")) ??
    addMinutesIso(pickup, -SCHEDULE_ACTIVATION_MINUTES);

  const scheduledReturnActivationAt =
    toIsoOrNull(getNoteField(notes, "Activación automática regreso")) ??
    toIsoOrNull(getNoteField(notes, "Regreso se activa")) ??
    addMinutesIso(scheduledReturnAt, -SCHEDULE_ACTIVATION_MINUTES);

  const isScheduled =
    Boolean(pickup || scheduledReturnAt) ||
    /tipo de solicitud\s*:\s*viaje agendado/i.test(notes) ||
    /viaje programado/i.test(notes) ||
    /agendad[oa]/i.test(notes);

  return {
    isScheduled,
    rideMode: isScheduled ? "scheduled" : "now",
    tripFareMode:
      scheduledReturnAt || /ida y vuelta|round_trip/i.test(notes)
        ? "round_trip"
        : "one_way",
    scheduledAt: pickup,
    scheduledPickupAt: pickup,
    scheduledReturnAt,
    scheduledActivationAt,
    scheduledReturnActivationAt,
    requestedByRole: normalizeRideRole(
      getNoteField(notes, "Solicitado por rol"),
    ),
  };
}

function removeScheduleLines(notes: string | null | undefined): string | null {
  if (!notes) return null;

  const cleaned = notes
    .replace(/\n?Tipo de solicitud:\s*viaje agendado\.?/gi, "")
    .replace(/\n?Fecha y hora de recogida agendada:\s*[^\n]+/gi, "")
    .replace(/\n?Viaje programado para:\s*[^\n]+/gi, "")
    .replace(/\n?Activación automática recogida:\s*[^\n]+/gi, "")
    .replace(/\n?Fecha y hora de regreso agendada:\s*[^\n]+/gi, "")
    .replace(/\n?Activación automática regreso:\s*[^\n]+/gi, "")
    .replace(/\n?Solicitado por rol:\s*[^\n]+/gi, "")
    .replace(/\n?Estado de agenda admin:\s*[^\n]+/gi, "")
    .trim();

  return cleaned || null;
}

function buildScheduleMeta(
  input: CreateRideRequestInput,
  requesterRole: string,
): ScheduleMeta | null {
  const record = input as CreateRideRequestInput & Record<string, unknown>;
  const fromNotes = extractScheduleMetaFromNotes(input.notes);

  const scheduledPickupAt =
    toIsoOrNull(record.scheduledPickupAt) ??
    toIsoOrNull(record.scheduledAt) ??
    toIsoOrNull(fromNotes.scheduledPickupAt) ??
    toIsoOrNull(fromNotes.scheduledAt);

  const scheduledReturnAt =
    toIsoOrNull(record.scheduledReturnAt) ??
    toIsoOrNull(fromNotes.scheduledReturnAt);

  const isScheduled =
    record.isScheduled === true ||
    record.rideMode === "scheduled" ||
    Boolean(scheduledPickupAt || scheduledReturnAt || fromNotes.isScheduled);

  if (!isScheduled) return null;

  const scheduledActivationAt =
    toIsoOrNull(record.scheduledActivationAt) ??
    toIsoOrNull(fromNotes.scheduledActivationAt) ??
    addMinutesIso(scheduledPickupAt, -SCHEDULE_ACTIVATION_MINUTES);

  const scheduledReturnActivationAt =
    toIsoOrNull(record.scheduledReturnActivationAt) ??
    toIsoOrNull(fromNotes.scheduledReturnActivationAt) ??
    addMinutesIso(scheduledReturnAt, -SCHEDULE_ACTIVATION_MINUTES);

  const tripFareMode =
    record.tripFareMode === "round_trip" ||
    fromNotes.tripFareMode === "round_trip" ||
    Boolean(scheduledReturnAt)
      ? "round_trip"
      : "one_way";

  const role = normalizeRideRole(requesterRole);

  return {
    isScheduled: true,
    rideMode: "scheduled",
    tripFareMode,
    scheduledAt: scheduledPickupAt,
    scheduledPickupAt,
    scheduledReturnAt,
    scheduledActivationAt,
    scheduledReturnActivationAt,
    requestedByRole: role,
    requesterRoleLabel:
      role === "driver"
        ? "Conductor viajando como usuario"
        : role === "admin"
          ? "Administrador"
          : "Pasajero",
    adminScheduleStatus: "pending_admin",
  };
}

function appendScheduleMetaToNotes(
  notes: string | null | undefined,
  meta: ScheduleMeta | null,
): string | null {
  const base = removeScheduleLines(notes);
  if (!meta?.isScheduled) return base;

  const lines = [
    "Tipo de solicitud: viaje agendado.",
    meta.scheduledPickupAt
      ? `Fecha y hora de recogida agendada: ${meta.scheduledPickupAt}`
      : null,
    meta.scheduledActivationAt
      ? `Activación automática recogida: ${meta.scheduledActivationAt}`
      : null,
    meta.scheduledReturnAt
      ? `Fecha y hora de regreso agendada: ${meta.scheduledReturnAt}`
      : null,
    meta.scheduledReturnActivationAt
      ? `Activación automática regreso: ${meta.scheduledReturnActivationAt}`
      : null,
    `Solicitado por rol: ${meta.requestedByRole}`,
    `Estado de agenda admin: ${meta.adminScheduleStatus}`,
  ].filter(Boolean);

  return [base, lines.join("\n")].filter(Boolean).join("\n\n");
}

function getScheduleMetaFromRide(
  r: RideRequest | RideWithDriverName,
): ScheduleMeta | null {
  const meta = extractScheduleMetaFromNotes(r.notes);
  if (!meta.isScheduled) return null;

  const role = normalizeRideRole(meta.requestedByRole ?? "passenger");

  return {
    isScheduled: true,
    rideMode: "scheduled",
    tripFareMode: meta.tripFareMode === "round_trip" ? "round_trip" : "one_way",
    scheduledAt: meta.scheduledAt ?? meta.scheduledPickupAt ?? null,
    scheduledPickupAt: meta.scheduledPickupAt ?? meta.scheduledAt ?? null,
    scheduledReturnAt: meta.scheduledReturnAt ?? null,
    scheduledActivationAt:
      meta.scheduledActivationAt ??
      addMinutesIso(
        meta.scheduledPickupAt ?? meta.scheduledAt ?? null,
        -SCHEDULE_ACTIVATION_MINUTES,
      ),
    scheduledReturnActivationAt:
      meta.scheduledReturnActivationAt ??
      addMinutesIso(meta.scheduledReturnAt ?? null, -SCHEDULE_ACTIVATION_MINUTES),
    requestedByRole: role,
    requesterRoleLabel:
      role === "driver"
        ? "Conductor viajando como usuario"
        : role === "admin"
          ? "Administrador"
          : "Pasajero",
    adminScheduleStatus:
      r.status === "cancelled" ? "cancelled" : "pending_admin",
  };
}

function isReadyForDriverSearch(r: RideRequest): boolean {
  const meta = getScheduleMetaFromRide(r);

  if (!meta?.isScheduled) return true;

  const activation =
    toIsoOrNull(meta.scheduledActivationAt) ??
    addMinutesIso(meta.scheduledPickupAt, -SCHEDULE_ACTIVATION_MINUTES);

  if (!activation) return false;

  return new Date(activation).getTime() <= Date.now();
}


function inferRidePaymentMethod(
  notes: string | null | undefined,
): string | null {
  const text = String(notes ?? "").toLowerCase();

  if (
    text.includes("mercadopago") ||
    text.includes("tarjeta") ||
    text.includes("paymentmethod: card")
  ) {
    return "card";
  }

  if (
    text.includes("efectivo") ||
    text.includes("paymentmethod: cash")
  ) {
    return "cash";
  }

  return null;
}

async function rideHasApprovedCardPayment(ride: RideRequest): Promise<boolean> {
  if (inferRidePaymentMethod(ride.notes) !== "card") return true;

  try {
    const { PaymentsRepository } = await import(
      "../payments/payments.repository.js"
    );
    const payment = await new PaymentsRepository().findSuccessfulByRideId(ride.id);
    return Boolean(payment);
  } catch {
    // Ante una falla de base de datos, cerramos el acceso por seguridad.
    return false;
  }
}

function paymentNotApprovedResult(): {
  ok: false;
  code: string;
  message: string;
  statusCode: number;
} {
  return {
    ok: false,
    code: "PAYMENT_NOT_APPROVED",
    message: "El servicio con tarjeta todavía no tiene un pago aprobado por Mercado Pago.",
    statusCode: 409,
  };
}

function calculatePolicyAmount(
  applicableFareClp: number,
  percent: number,
  capClp: number,
): number {
  return Math.min(
    Math.max(0, Math.round(capClp)),
    Math.max(
      0,
      Math.round(
        Math.max(0, Math.round(applicableFareClp)) *
          (Math.max(0, percent) / 100),
      ),
    ),
  );
}

function toPolicyChargeResponse(
  charge: RidePolicyCharge,
  owner?: { name?: string | null; email?: string | null },
): RidePolicyChargeResponse {
  return {
    id: charge.id,
    sourceRideId: charge.sourceRideId,
    ownerUserId: charge.ownerUserId,
    ownerName: owner?.name ?? null,
    ownerEmail: owner?.email ?? null,
    type:
      charge.type === "no_show"
        ? "no_show"
        : "late_cancellation",
    status: charge.status,
    paymentMethod: charge.paymentMethod ?? null,
    applicableFareClp: charge.applicableFareClp,
    feePercent: charge.feePercent,
    feeCapClp: charge.feeCapClp,
    calculatedAmountClp: charge.calculatedAmountClp,
    approvedAmountClp: charge.approvedAmountClp ?? null,
    amountClp: Math.max(
      0,
      Math.round(
        Number(
          charge.approvedAmountClp ??
            charge.calculatedAmountClp ??
            0,
        ),
      ),
    ),
    reason: charge.reason ?? null,
    adminDecisionReason: charge.adminDecisionReason ?? null,
    reviewedByUserId: charge.reviewedByUserId ?? null,
    reviewedAt: charge.reviewedAt?.toISOString() ?? null,
    appliedToRideId: charge.appliedToRideId ?? null,
    appliedAt: charge.appliedAt?.toISOString() ?? null,
    settledAt: charge.settledAt?.toISOString() ?? null,
    createdAt: charge.createdAt.toISOString(),
    updatedAt: charge.updatedAt.toISOString(),
  };
}

function shouldCreatePassengerCancellationCharge(
  ride: RideRequest,
): boolean {
  const nowMs = Date.now();
  const scheduleMeta = getScheduleMetaFromRide(ride);

  if (scheduleMeta?.isScheduled && scheduleMeta.scheduledPickupAt) {
    const pickupMs = new Date(scheduleMeta.scheduledPickupAt).getTime();

    if (Number.isFinite(pickupMs)) {
      const timeUntilPickupMs = pickupMs - nowMs;
      return (
        timeUntilPickupMs <= SCHEDULED_CANCELLATION_CHARGE_WINDOW_MS
      );
    }
  }

  if (!ride.acceptedAt) return false;

  return (
    nowMs - ride.acceptedAt.getTime() >=
    PASSENGER_FREE_CANCELLATION_MS
  );
}

function buildPolicyChargeData(input: {
  ride: RideRequest;
  type: "late_cancellation" | "no_show";
  reason: string | null;
}) {
  const applicableFareClp = Math.max(
    0,
    Math.round(Number(input.ride.estimatedFareClp ?? 0)),
  );

  const isNoShow = input.type === "no_show";
  const feePercent = isNoShow
    ? NO_SHOW_PERCENT
    : LATE_CANCELLATION_PERCENT;
  const feeCapClp = isNoShow
    ? NO_SHOW_CAP_CLP
    : LATE_CANCELLATION_CAP_CLP;

  return {
    sourceRideId: input.ride.id,
    ownerUserId: input.ride.passengerUserId,
    type: input.type,
    status: "pending_admin_review",
    paymentMethod: inferRidePaymentMethod(input.ride.notes),
    applicableFareClp,
    feePercent,
    feeCapClp,
    calculatedAmountClp: calculatePolicyAmount(
      applicableFareClp,
      feePercent,
      feeCapClp,
    ),
    reason: input.reason,
    updatedAt: new Date(),
  } as const;
}

function toResponse(
  r: RideRequest | RideWithDriverName,
  discountInfo?: { discountPercent: number; originalFare: number },
  policyInfo?: {
    baseFareClp: number;
    appliedChargesTotalClp: number;
    appliedCharges: RidePolicyCharge[];
  },
): RideRequestResponse {
  const scheduleMeta = getScheduleMetaFromRide(r);

  const response: RideRequestResponse & Record<string, unknown> = {
    id: r.id,
    passengerUserId: r.passengerUserId,
    driverUserId: r.driverUserId ?? null,
    driverName: ("driverName" in r ? r.driverName : null) ?? null,
    driverPhone: ("driverPhone" in r ? r.driverPhone : null) ?? null,
    originText: r.originText,
    destinationText: r.destinationText,
    notes: r.notes,
    estimatedFareClp: r.estimatedFareClp ?? null,
    status: r.status,
    requestedAt: r.requestedAt.toISOString(),
    acceptedAt: r.acceptedAt?.toISOString() ?? null,
    enRouteAt: r.enRouteAt?.toISOString() ?? null,
    arrivedAt: r.arrivedAt?.toISOString() ?? null,
    startedAt: r.startedAt?.toISOString() ?? null,
    completedAt: r.completedAt?.toISOString() ?? null,
    cancelledAt: r.cancelledAt?.toISOString() ?? null,
    cancellationReason: r.cancellationReason ?? null,
    cancelledByRole: r.cancelledByRole ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    driverRatingAverage:
      ("driverRatingAverage" in r ? r.driverRatingAverage : null) ?? null,
    driverRatingCount:
      ("driverRatingCount" in r ? r.driverRatingCount : 0) ?? 0,
    driverVehicleBrand:
      ("driverVehicleBrand" in r ? r.driverVehicleBrand : null) ?? null,
    driverVehicleModel:
      ("driverVehicleModel" in r ? r.driverVehicleModel : null) ?? null,
    driverVehicleYear:
      ("driverVehicleYear" in r ? r.driverVehicleYear : null) ?? null,
    driverVehiclePlate:
      ("driverVehiclePlate" in r ? r.driverVehiclePlate : null) ?? null,
    driverVehicleColor:
      ("driverVehicleColor" in r ? r.driverVehicleColor : null) ?? null,
    discountApplied: discountInfo != null,
    discountPercent: discountInfo?.discountPercent ?? null,
    originalFareClp: discountInfo?.originalFare ?? null,
    baseFareClp:
      policyInfo?.baseFareClp ??
      r.estimatedFareClp ??
      null,
    policyChargesAppliedClp:
      policyInfo?.appliedChargesTotalClp ?? 0,
    policyChargesApplied:
      policyInfo?.appliedCharges.map((charge) =>
        toPolicyChargeResponse(charge),
      ) ?? [],
  };

  if (scheduleMeta?.isScheduled) {
    response["isScheduled"] = true;
    response["rideMode"] = "scheduled";
    response["tripFareMode"] = scheduleMeta.tripFareMode;
    response["scheduledAt"] = scheduleMeta.scheduledAt;
    response["scheduledPickupAt"] = scheduleMeta.scheduledPickupAt;
    response["scheduledReturnAt"] = scheduleMeta.scheduledReturnAt;
    response["scheduledActivationAt"] = scheduleMeta.scheduledActivationAt;
    response["scheduledReturnActivationAt"] = scheduleMeta.scheduledReturnActivationAt;
    response["requestedByRole"] = scheduleMeta.requestedByRole;
    response["requesterRoleLabel"] = scheduleMeta.requesterRoleLabel;
    response["adminScheduleStatus"] = scheduleMeta.adminScheduleStatus;
  }

  return response as RideRequestResponse;
}

function toDriverRideResponse(r: RideRequest): DriverRideResponse {
  return {
    id: r.id,
    originText: r.originText,
    destinationText: r.destinationText,
    notes: r.notes,
    estimatedFareClp: r.estimatedFareClp ?? null,
    status: r.status,
    requestedAt: r.requestedAt.toISOString(),
    acceptedAt: r.acceptedAt?.toISOString() ?? null,
    enRouteAt: r.enRouteAt?.toISOString() ?? null,
    arrivedAt: r.arrivedAt?.toISOString() ?? null,
    startedAt: r.startedAt?.toISOString() ?? null,
    completedAt: r.completedAt?.toISOString() ?? null,
    cancelledAt: r.cancelledAt?.toISOString() ?? null,
    cancellationReason: r.cancellationReason ?? null,
    cancelledByRole: r.cancelledByRole ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

function toAvailableResponse(r: RideRequest): AvailableRideResponse {
  return {
    id: r.id,
    originText: r.originText,
    destinationText: r.destinationText,
    notes: r.notes,
    estimatedFareClp: r.estimatedFareClp ?? null,
    status: r.status,
    requestedAt: r.requestedAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
  };
}

type AuthResult =
  | { ok: true; userId: string; role: string }
  | { ok: false; code: string; message: string; statusCode: number };

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

  return {
    ok: true,
    userId: user.id,
    role: user.role,
  };
}

export class RidesService {
  async listMyRides(accessToken: string): Promise<RidesListResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "passenger" && auth.role !== "driver") {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message:
          "Only passengers or drivers can access their own ride requests.",
        statusCode: 403,
      };
    }

    const rows = await ridesRepo.findByPassengerIdWithDriver(auth.userId);
    const responses = await Promise.all(
      rows.map(async (ride) => {
        const response = toResponse(ride);

        // Compatibilidad con solicitudes antiguas creadas antes de que existiera
        // pending_payment. Aunque su fila diga requested, el pasajero nunca debe
        // verla activa si el backend no encuentra un pago aprobado.
        if (
          ride.status === "requested" &&
          inferRidePaymentMethod(ride.notes) === "card" &&
          !(await rideHasApprovedCardPayment(ride))
        ) {
          return { ...response, status: "pending_payment" };
        }

        return response;
      }),
    );

    return { ok: true, rides: responses };
  }

  async createRideRequest(
    accessToken: string,
    input: CreateRideRequestInput,
  ): Promise<RideResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "passenger" && auth.role !== "driver") {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message:
          "Only passengers or drivers can create ride requests as users.",
        statusCode: 403,
      };
    }

    const scheduleMeta = buildScheduleMeta(input, auth.role);

    const isScheduledRide =
      scheduleMeta?.rideMode === "scheduled" ||
      input.rideMode === "scheduled" ||
      input.isScheduled === true ||
      Boolean(input.scheduledAt || input.scheduledPickupAt || input.scheduledReturnAt);

    if (isScheduledRide && input.paymentMethod !== "card") {
      return {
        ok: false,
        code: "SCHEDULED_RIDE_REQUIRES_CARD",
        message: "Las reservas y viajes agendados deben pagarse con tarjeta.",
        statusCode: 400,
      };
    }

    if (
      isScheduledRide &&
      input.paymentMethod === "card" &&
      input.paymentProvider &&
      !["mercadopago", "prontopaga", "transbank"].includes(input.paymentProvider)
    ) {
      return {
        ok: false,
        code: "INVALID_PAYMENT_PROVIDER",
        message: "Proveedor de pago no permitido para reservas.",
        statusCode: 400,
      };
    }

    const notesForStorage = appendScheduleMetaToNotes(
      input.notes ?? null,
      scheduleMeta,
    );

    const fareFromClient = Number(input.estimatedFareClp);
    const serverEstimatedFare = await estimateFare(input.originText, input.destinationText);
    const clientFare =
      Number.isFinite(fareFromClient) && fareFromClient > 0
        ? Math.round(fareFromClient)
        : null;

    // Seguridad financiera:
    // estimatedFareClp viene del cliente y no puede bajar el monto calculado por backend.
    // Esto evita descuentos manipulados desde localStorage/frontend mientras se migra pricing completo al backend.
    const baseFare = clientFare == null
      ? serverEstimatedFare
      : Math.max(clientFare, serverEstimatedFare);

    let finalFare = baseFare;
    let discountInfo:
      | { discountPercent: number; originalFare: number }
      | undefined;

    try {
      const { ReferralsRepository } = await import(
        "../referrals/referrals.repository.js"
      );

      const referralsRepo = new ReferralsRepository();
      const referralUse = await referralsRepo.findUseByReferredUserId(
        auth.userId,
      );

      if (referralUse && !referralUse.convertedAt) {
        const { referralCodes } = await import("../../db/schema/index.js");
        const { db } = await import("../../db/client.js");
        const { eq } = await import("drizzle-orm");

        const codeRows = await db
          .select()
          .from(referralCodes)
          .where(eq(referralCodes.id, referralUse.referralCodeId))
          .limit(1);

        const refCode = codeRows[0] ?? null;

        if (
          refCode?.isActive &&
          refCode.discountType === "percentage" &&
          refCode.discountAmount
        ) {
          const discountPercent = refCode.discountAmount;
          finalFare = Math.round(baseFare * (1 - discountPercent / 100));
          discountInfo = { discountPercent, originalFare: baseFare };
        }
      }
    } catch {
      // No bloquea crear el viaje.
    }

    const created = await ridesRepo.createWithApprovedPolicyCharges(
      auth.userId,
      input.originText,
      input.destinationText,
      notesForStorage,
      finalFare,
      input.paymentMethod === "card" ? "pending_payment" : "requested",
    );

    return {
      ok: true,
      ride: toResponse(
        created.ride,
        discountInfo,
        {
          baseFareClp: finalFare,
          appliedChargesTotalClp:
            created.appliedChargesTotalClp,
          appliedCharges: created.appliedCharges,
        },
      ),
    };
  }

  async cancelRideRequest(
    accessToken: string,
    rideId: string,
    input: CancelAcceptedInput = {},
  ): Promise<RideResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "passenger" && auth.role !== "driver") {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message:
          "Only passengers or drivers can cancel their own ride requests.",
        statusCode: 403,
      };
    }

    const existing = await ridesRepo.findByIdAndPassenger(
      rideId,
      auth.userId,
    );

    if (!existing) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "Ride request not found.",
        statusCode: 404,
      };
    }

    if (!["requested", "pending_payment"].includes(existing.status)) {
      return {
        ok: false,
        code: "RIDE_CANNOT_CANCEL",
        message: `Ride request cannot be cancelled — current status is '${existing.status}'.`,
        statusCode: 409,
      };
    }

    const cancelled = await ridesRepo.cancel(
      existing.id,
      auth.userId,
      auth.role,
      input.reason ?? "Cancelado por pasajero.",
    );
    return { ok: true, ride: toResponse(cancelled) };
  }

  async listAvailableRides(
    accessToken: string,
  ): Promise<AvailableRidesResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "driver") {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message: "Only drivers can view available rides.",
        statusCode: 403,
      };
    }

    const rows = await ridesRepo.findAvailable();
    const readyRows = rows.filter(isReadyForDriverSearch);
    const paymentChecks = await Promise.all(
      readyRows.map(async (ride) => ({
        ride,
        approved: await rideHasApprovedCardPayment(ride),
      })),
    );
    const payableRows = paymentChecks
      .filter((item) => item.approved)
      .map((item) => item.ride);

    return { ok: true, rides: payableRows.map(toAvailableResponse) };
  }

  async acceptRideRequest(
    accessToken: string,
    rideId: string,
  ): Promise<RideResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "driver") {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message: "Only drivers can accept ride requests.",
        statusCode: 403,
      };
    }

    const rideBeforeAccept = await ridesRepo.findById(rideId);

    if (!rideBeforeAccept) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "Ride request not found.",
        statusCode: 404,
      };
    }

    if (!(await rideHasApprovedCardPayment(rideBeforeAccept))) {
      return paymentNotApprovedResult();
    }

    const accepted = await ridesRepo.accept(rideId, auth.userId);

    if (!accepted) {
      const existing = await ridesRepo.findById(rideId);

      if (!existing) {
        return {
          ok: false,
          code: "NOT_FOUND",
          message: "Ride request not found.",
          statusCode: 404,
        };
      }

      if (existing.status === "accepted") {
        return {
          ok: false,
          code: "RIDE_ALREADY_ACCEPTED",
          message:
            "This ride has already been accepted by another driver.",
          statusCode: 409,
        };
      }

      return {
        ok: false,
        code: "RIDE_CANNOT_ACCEPT",
        message: `Ride request cannot be accepted — current status is '${existing.status}'.`,
        statusCode: 409,
      };
    }

    const acceptedResp = toResponse(accepted);

    import("../notifications/notifications.helpers.js")
      .then(({ notifyPassengerDriverAssigned }) => {
        notifyPassengerDriverAssigned({
          passengerUserId: acceptedResp.passengerUserId,
          driverName: acceptedResp.driverName ?? "Tu conductor",
          driverPhone: acceptedResp.driverPhone ?? null,
          rideId: acceptedResp.id,
          origin: acceptedResp.originText,
          destination: acceptedResp.destinationText,
        });
      })
      .catch(() => {});

    return { ok: true, ride: toResponse(accepted) };
  }

  async completeRide(
    accessToken: string,
    rideId: string,
  ): Promise<RideResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "driver") {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message: "Only drivers can complete rides.",
        statusCode: 403,
      };
    }

    const rideBeforeComplete = await ridesRepo.findById(rideId);
    if (!rideBeforeComplete) {
      return { ok: false, code: "NOT_FOUND", message: "Ride request not found.", statusCode: 404 };
    }
    if (!(await rideHasApprovedCardPayment(rideBeforeComplete))) {
      return paymentNotApprovedResult();
    }

    const completed = await ridesRepo.complete(rideId, auth.userId);

    if (!completed) {
      const existing = await ridesRepo.findById(rideId);

      if (!existing) {
        return {
          ok: false,
          code: "NOT_FOUND",
          message: "Ride request not found.",
          statusCode: 404,
        };
      }

      if (existing.status !== "in_progress") {
        return {
          ok: false,
          code: "RIDE_CANNOT_COMPLETE",
          message: `Ride cannot be completed — current status is '${existing.status}'.`,
          statusCode: 409,
        };
      }

      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message: "You can only complete rides assigned to you.",
        statusCode: 403,
      };
    }

    if (completed.driverUserId) {
      const { DriverStatusRepository } = await import(
        "../drivers/driverStatus.repository.js"
      );
      await new DriverStatusRepository().setAvailable(completed.driverUserId);
    }

    import("../notifications/notifications.helpers.js")
      .then(({ notifyPassengerRideCompleted }) => {
        notifyPassengerRideCompleted({
          passengerUserId: completed.passengerUserId,
          rideId: completed.id,
          origin: completed.originText,
          destination: completed.destinationText,
        });
      })
      .catch(() => {});

    return { ok: true, ride: toResponse(completed) };
  }

  async markEnRoute(
    accessToken: string,
    rideId: string,
  ): Promise<RideResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "driver") {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message: "Only drivers can mark rides en-route.",
        statusCode: 403,
      };
    }

    const rideBeforeEnRoute = await ridesRepo.findById(rideId);
    if (!rideBeforeEnRoute) {
      return { ok: false, code: "NOT_FOUND", message: "Ride request not found.", statusCode: 404 };
    }
    if (!(await rideHasApprovedCardPayment(rideBeforeEnRoute))) {
      return paymentNotApprovedResult();
    }

    const updated = await ridesRepo.markEnRoute(rideId, auth.userId);

    if (!updated) {
      const existing = await ridesRepo.findById(rideId);

      if (!existing) {
        return {
          ok: false,
          code: "NOT_FOUND",
          message: "Ride request not found.",
          statusCode: 404,
        };
      }

      if (existing.driverUserId !== auth.userId) {
        return {
          ok: false,
          code: "AUTH_FORBIDDEN",
          message: "You can only update rides assigned to you.",
          statusCode: 403,
        };
      }

      return {
        ok: false,
        code: "RIDE_CANNOT_MARK_EN_ROUTE",
        message: `Ride cannot be marked en-route — current status is '${existing.status}'.`,
        statusCode: 409,
      };
    }

    const auditService = new (
      await import("../audit/audit.service.js")
    ).AuditService();

    auditService.recordSafe({
      eventType: "ride.driver_en_route",
      metadata: {
        driverUserId: auth.userId,
        rideId,
      },
    });

    const enRouteResp = toResponse(updated);

    import("../notifications/notifications.helpers.js")
      .then(({ notifyPassengerDriverEnRoute }) => {
        notifyPassengerDriverEnRoute({
          passengerUserId: enRouteResp.passengerUserId,
          driverName: enRouteResp.driverName ?? "Tu conductor",
          rideId: enRouteResp.id,
        });
      })
      .catch(() => {});

    return { ok: true, ride: toResponse(updated) };
  }

  async markArrived(
    accessToken: string,
    rideId: string,
  ): Promise<RideResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "driver") {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message: "Only drivers can mark arrival.",
        statusCode: 403,
      };
    }

    const rideBeforeArrived = await ridesRepo.findById(rideId);
    if (!rideBeforeArrived) {
      return { ok: false, code: "NOT_FOUND", message: "Ride request not found.", statusCode: 404 };
    }
    if (!(await rideHasApprovedCardPayment(rideBeforeArrived))) {
      return paymentNotApprovedResult();
    }

    const updated = await ridesRepo.markArrived(rideId, auth.userId);

    if (!updated) {
      const existing = await ridesRepo.findById(rideId);

      if (!existing) {
        return {
          ok: false,
          code: "NOT_FOUND",
          message: "Ride request not found.",
          statusCode: 404,
        };
      }

      if (existing.driverUserId !== auth.userId) {
        return {
          ok: false,
          code: "AUTH_FORBIDDEN",
          message: "You can only update rides assigned to you.",
          statusCode: 403,
        };
      }

      return {
        ok: false,
        code: "RIDE_CANNOT_MARK_ARRIVED",
        message: `Ride cannot be marked arrived — current status is '${existing.status}'.`,
        statusCode: 409,
      };
    }

    const auditService = new (
      await import("../audit/audit.service.js")
    ).AuditService();

    auditService.recordSafe({
      eventType: "ride.driver_arrived",
      metadata: {
        driverUserId: auth.userId,
        rideId,
      },
    });

    const arrivedResp = toResponse(updated);

    import("../notifications/notifications.helpers.js")
      .then(({ notifyPassengerDriverArrived }) => {
        notifyPassengerDriverArrived({
          passengerUserId: arrivedResp.passengerUserId,
          driverName: arrivedResp.driverName ?? "Tu conductor",
          rideId: arrivedResp.id,
        });
      })
      .catch(() => {});

    return { ok: true, ride: toResponse(updated) };
  }

  async startRide(
    accessToken: string,
    rideId: string,
  ): Promise<RideResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "driver") {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message: "Only drivers can start rides.",
        statusCode: 403,
      };
    }

    const rideBeforeStart = await ridesRepo.findById(rideId);
    if (!rideBeforeStart) {
      return { ok: false, code: "NOT_FOUND", message: "Ride request not found.", statusCode: 404 };
    }
    if (!(await rideHasApprovedCardPayment(rideBeforeStart))) {
      return paymentNotApprovedResult();
    }

    const started = await ridesRepo.start(rideId, auth.userId);

    if (!started) {
      const existing = await ridesRepo.findById(rideId);

      if (!existing) {
        return {
          ok: false,
          code: "NOT_FOUND",
          message: "Ride request not found.",
          statusCode: 404,
        };
      }

      if (existing.status !== "driver_arrived") {
        return {
          ok: false,
          code: "RIDE_CANNOT_START",
          message: "Driver must mark arrival before starting the ride.",
          statusCode: 409,
        };
      }

      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message: "You can only start rides assigned to you.",
        statusCode: 403,
      };
    }

    return { ok: true, ride: toResponse(started) };
  }

  async cancelAcceptedRide(
    accessToken: string,
    rideId: string,
    input: CancelAcceptedInput,
  ): Promise<RideResult> {
    const auth = await authenticate(accessToken);

    if (!auth.ok) return auth;

    if (auth.role !== "passenger" && auth.role !== "driver") {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message: "Only passengers or drivers can cancel rides.",
        statusCode: 403,
      };
    }

    const existing = await ridesRepo.findById(rideId);

    if (!existing) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "Ride request not found.",
        statusCode: 404,
      };
    }

    if (auth.role === "passenger" && existing.passengerUserId !== auth.userId) {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message: "You can only cancel your own rides.",
        statusCode: 403,
      };
    }

    if (auth.role === "driver" && existing.driverUserId !== auth.userId) {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message: "You can only cancel rides assigned to you.",
        statusCode: 403,
      };
    }

    const cancelled = await ridesRepo.cancelAccepted(
      rideId,
      auth.userId,
      auth.role,
      input.reason ?? null,
    );

    if (!cancelled) {
      const refetch = await ridesRepo.findById(rideId);

      if (!refetch) {
        return {
          ok: false,
          code: "NOT_FOUND",
          message: "Ride request not found.",
          statusCode: 404,
        };
      }

      return {
        ok: false,
        code: "RIDE_CANNOT_CANCEL",
        message: `Ride request cannot be cancelled — current status is '${refetch.status}'.`,
        statusCode: 409,
      };
    }

    if (cancelled.driverUserId) {
      const { DriverStatusRepository } = await import(
        "../drivers/driverStatus.repository.js"
      );

      await new DriverStatusRepository().setAvailable(cancelled.driverUserId);
    }

    let policyCharge: RidePolicyCharge | null = null;

    if (
      auth.role === "passenger" &&
      shouldCreatePassengerCancellationCharge(existing)
    ) {
      const chargeData = buildPolicyChargeData({
        ride: existing,
        type: "late_cancellation",
        reason: input.reason ?? null,
      });

      if (chargeData.calculatedAmountClp > 0) {
        policyCharge = await ridesRepo.createPolicyCharge(chargeData);
      }
    }

    let paymentRefund: Record<string, unknown> | null = null;

    try {
      const { PaymentsService } = await import(
        "../payments/payments.service.js"
      );

      const refundResult =
        await new PaymentsService().refundCardPaymentForCancelledRide({
          rideRequestId: rideId,
          cancelledByUserId: auth.userId,
          cancelledByRole: auth.role,
          reason: input.reason ?? null,
        });

      if (refundResult.ok) {
        paymentRefund = {
          processed: refundResult.processed,
          refunded: refundResult.refunded,
          skippedReason: refundResult.skippedReason ?? null,
          paymentId: refundResult.paymentId ?? null,
          mercadoPagoPaymentId: refundResult.mercadoPagoPaymentId ?? null,
        };
      } else {
        paymentRefund = {
          processed: true,
          refunded: false,
          failed: true,
          code: refundResult.code,
          message: refundResult.message,
        };
      }
    } catch (err) {
      paymentRefund = {
        processed: true,
        refunded: false,
        failed: true,
        message:
          err instanceof Error
            ? err.message
            : "Error interno al devolver el pago con tarjeta.",
      };
    }

    const responseRide = toResponse(cancelled) as RideRequestResponse &
      Record<string, unknown>;

    responseRide["paymentRefund"] = paymentRefund;
    responseRide["policyCharge"] = policyCharge
      ? toPolicyChargeResponse(policyCharge)
      : null;

    return {
      ok: true,
      ride: responseRide,
    };
  }


  async listMyApprovedPolicyCharges(
    accessToken: string,
  ): Promise<PolicyChargesResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "passenger" && auth.role !== "driver") {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message:
          "Only passenger or driver accounts can access their charges.",
        statusCode: 403,
      };
    }

    const rows =
      await ridesRepo.listApprovedPolicyChargesForOwner(auth.userId);

    return {
      ok: true,
      charges: rows.map((charge) =>
        toPolicyChargeResponse(charge),
      ),
    };
  }

  async adminListPolicyCharges(
    accessToken: string,
  ): Promise<AdminPolicyChargesResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "admin") {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message: "Only admins can list policy charges.",
        statusCode: 403,
      };
    }

    const rows = await ridesRepo.listAllPolicyCharges();

    return {
      ok: true,
      charges: rows.map((charge) =>
        toPolicyChargeResponse(charge, {
          name: charge.ownerName,
          email: charge.ownerEmail,
        }),
      ),
    };
  }

  async adminApprovePolicyCharge(
    accessToken: string,
    chargeId: string,
    input: AdminPolicyChargeReviewInput,
  ): Promise<
    | { ok: true; charge: RidePolicyChargeResponse }
    | {
        ok: false;
        code: string;
        message: string;
        statusCode: number;
      }
  > {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "admin") {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message: "Only admins can approve policy charges.",
        statusCode: 403,
      };
    }

    const existing = await ridesRepo.findPolicyChargeById(chargeId);

    if (!existing) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "Policy charge not found.",
        statusCode: 404,
      };
    }

    if (
      existing.status !== "pending_admin_review" &&
      existing.status !== "approved_pending_next_ride"
    ) {
      return {
        ok: false,
        code: "POLICY_CHARGE_CANNOT_APPROVE",
        message: `Charge cannot be approved from status '${existing.status}'.`,
        statusCode: 409,
      };
    }

    const maximumAllowed = Math.min(
      existing.feeCapClp,
      existing.calculatedAmountClp,
    );

    const approvedAmountClp =
      input.approvedAmountClp == null
        ? maximumAllowed
        : Math.min(
            maximumAllowed,
            Math.max(0, Math.round(input.approvedAmountClp)),
          );

    if (approvedAmountClp <= 0) {
      return {
        ok: false,
        code: "POLICY_CHARGE_INVALID_AMOUNT",
        message: "Approved charge amount must be greater than zero.",
        statusCode: 422,
      };
    }

    const updated = await ridesRepo.approvePolicyCharge({
      id: existing.id,
      reviewedByUserId: auth.userId,
      approvedAmountClp,
      adminDecisionReason:
        input.adminDecisionReason?.trim() ||
        "Cargo aprobado por administración.",
    });

    if (!updated) {
      return {
        ok: false,
        code: "POLICY_CHARGE_CANNOT_APPROVE",
        message: "Policy charge could not be approved.",
        statusCode: 409,
      };
    }

    return {
      ok: true,
      charge: toPolicyChargeResponse(updated),
    };
  }

  async adminUpsertAndApprovePolicyCharge(
    accessToken: string,
    input: AdminUpsertApprovePolicyChargeInput,
  ): Promise<
    | { ok: true; charge: RidePolicyChargeResponse }
    | {
        ok: false;
        code: string;
        message: string;
        statusCode: number;
      }
  > {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "admin") {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message: "Only admins can import and approve policy charges.",
        statusCode: 403,
      };
    }

    const ride = await ridesRepo.findById(input.rideId);

    if (!ride) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "Ride request not found.",
        statusCode: 404,
      };
    }

    const type =
      input.type === "no_show"
        ? "no_show"
        : "late_cancellation";

    const isNoShow = type === "no_show";
    const feePercent = isNoShow
      ? NO_SHOW_PERCENT
      : LATE_CANCELLATION_PERCENT;
    const feeCapClp = isNoShow
      ? NO_SHOW_CAP_CLP
      : LATE_CANCELLATION_CAP_CLP;

    const applicableFareClp = Math.max(
      0,
      Math.round(
        Number(
          input.applicableFareClp ??
            ride.estimatedFareClp ??
            0,
        ),
      ),
    );

    const calculatedAmountClp = calculatePolicyAmount(
      applicableFareClp,
      feePercent,
      feeCapClp,
    );

    const requestedApprovedAmount = Math.max(
      0,
      Math.round(input.amountClp),
    );

    const approvedAmountClp = Math.min(
      feeCapClp,
      calculatedAmountClp > 0
        ? calculatedAmountClp
        : requestedApprovedAmount,
      requestedApprovedAmount,
    );

    if (approvedAmountClp <= 0) {
      return {
        ok: false,
        code: "POLICY_CHARGE_INVALID_AMOUNT",
        message: "There is no valid charge amount to approve.",
        statusCode: 422,
      };
    }

    const created = await ridesRepo.createPolicyCharge({
      sourceRideId: ride.id,
      ownerUserId: ride.passengerUserId,
      type,
      status: "pending_admin_review",
      paymentMethod:
        input.paymentMethod ??
        inferRidePaymentMethod(ride.notes),
      applicableFareClp:
        applicableFareClp > 0
          ? applicableFareClp
          : Math.ceil(
              approvedAmountClp / (feePercent / 100),
            ),
      feePercent,
      feeCapClp,
      calculatedAmountClp:
        calculatedAmountClp > 0
          ? calculatedAmountClp
          : approvedAmountClp,
      reason:
        input.reason?.trim() ||
        ride.cancellationReason ||
        null,
      updatedAt: new Date(),
    });

    const updated = await ridesRepo.approvePolicyCharge({
      id: created.id,
      reviewedByUserId: auth.userId,
      approvedAmountClp,
      adminDecisionReason:
        input.adminDecisionReason?.trim() ||
        "Cargo aprobado por administración.",
    });

    if (!updated) {
      return {
        ok: false,
        code: "POLICY_CHARGE_CANNOT_APPROVE",
        message: "Policy charge could not be approved.",
        statusCode: 409,
      };
    }

    return {
      ok: true,
      charge: toPolicyChargeResponse(updated),
    };
  }

  async adminWaivePolicyCharge(
    accessToken: string,
    chargeId: string,
    input: AdminPolicyChargeReviewInput,
  ): Promise<
    | { ok: true; charge: RidePolicyChargeResponse }
    | {
        ok: false;
        code: string;
        message: string;
        statusCode: number;
      }
  > {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "admin") {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message: "Only admins can waive policy charges.",
        statusCode: 403,
      };
    }

    const reason = input.adminDecisionReason?.trim();

    if (!reason || reason.length < 8) {
      return {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "A waiver reason of at least 8 characters is required.",
        statusCode: 400,
      };
    }

    const updated = await ridesRepo.waivePolicyCharge({
      id: chargeId,
      reviewedByUserId: auth.userId,
      adminDecisionReason: reason,
    });

    if (!updated) {
      return {
        ok: false,
        code: "POLICY_CHARGE_CANNOT_WAIVE",
        message: "Policy charge could not be waived.",
        statusCode: 409,
      };
    }

    return {
      ok: true,
      charge: toPolicyChargeResponse(updated),
    };
  }

  async declareNoShow(
    accessToken: string,
    rideId: string,
  ): Promise<RideResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "driver") {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message: "Only drivers can declare a no show.",
        statusCode: 403,
      };
    }

    const existing = await ridesRepo.findById(rideId);

    if (!existing) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "Ride request not found.",
        statusCode: 404,
      };
    }

    if (existing.driverUserId !== auth.userId) {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message: "You can only declare no show on rides assigned to you.",
        statusCode: 403,
      };
    }

    if (existing.status !== "driver_arrived" || !existing.arrivedAt) {
      return {
        ok: false,
        code: "RIDE_NO_SHOW_NOT_ALLOWED",
        message: "The driver must mark arrival before declaring no show.",
        statusCode: 409,
      };
    }

    const waitedMs = Date.now() - existing.arrivedAt.getTime();

    if (waitedMs < DRIVER_NO_SHOW_WAIT_MS) {
      return {
        ok: false,
        code: "RIDE_NO_SHOW_WAIT_REQUIRED",
        message: "You must wait 5 minutes after arrival.",
        statusCode: 409,
      };
    }

    const closed = await ridesRepo.markNoShow(
      rideId,
      auth.userId,
    );

    if (!closed) {
      return {
        ok: false,
        code: "RIDE_NO_SHOW_CANNOT_CLOSE",
        message: "Ride could not be closed as no show.",
        statusCode: 409,
      };
    }

    const chargeData = buildPolicyChargeData({
      ride: existing,
      type: "no_show",
      reason:
        "Pasajero no se presentó después de 5 minutos.",
    });

    const charge =
      chargeData.calculatedAmountClp > 0
        ? await ridesRepo.createPolicyCharge(chargeData)
        : null;

    const response = toResponse(closed) as RideRequestResponse &
      Record<string, unknown>;

    response["policyCharge"] = charge
      ? toPolicyChargeResponse(charge)
      : null;

    return {
      ok: true,
      ride: response,
    };
  }

  async listDriverRides(accessToken: string): Promise<DriverRidesListResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    if (auth.role !== "driver") {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message: "Only drivers can access their ride list.",
        statusCode: 403,
      };
    }

    const rows = await ridesRepo.findByDriverId(auth.userId);
    const paymentChecks = await Promise.all(
      rows.map(async (ride) => ({
        ride,
        approved:
          ride.status === "cancelled" ||
          (await rideHasApprovedCardPayment(ride)),
      })),
    );

    return {
      ok: true,
      rides: paymentChecks
        .filter((item) => item.approved)
        .map((item) => toDriverRideResponse(item.ride)),
    };
  }
}