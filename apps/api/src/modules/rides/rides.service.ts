import { TokenService } from "../auth/token.service.js";
import { SessionService } from "../auth/session.service.js";
import { UsersRepository } from "../users/users.repository.js";
import { RidesRepository } from "./rides.repository.js";
import type { RideWithDriverName } from "./rides.repository.js";
import { RideStopsRepository } from "./rideStops.repository.js";
import { RideAssignmentOffersRepository } from "./rideAssignmentOffers.repository.js";
import { DriverStatusRepository } from "../drivers/driverStatus.repository.js";
import { FareSettingsRepository } from "../fareSettings/fareSettings.repository.js";
import { WalletRepository } from "../wallet/wallet.repository.js";
import { AppError } from "../../shared/errors/AppError.js";
import { DriverComplianceService } from "../drivers/driverCompliance.service.js";
import { rideReceiptsService } from "../rideReceipts/rideReceipts.service.js";
import { attemptQueuedOffer } from "./rideQueueOfferProducer.service.js";
import { haversineDistanceKm, estimateEtaMinutes, QUEUE_MATCH_CONFIG } from "./rideQueueMatch.js";
import { filterGpsTrack } from "@rapa-go/shared";
import { resolveRequestedVehicleCategory } from "@rapa-go/shared";
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
  RideRouteHistoryResult,
} from "./rides.types.js";
import type { RideRequest } from "../../db/schema/index.js";
import type { RidePolicyCharge } from "../../db/schema/ridePolicyCharges.schema.js";
import type {
  CreateRideRequestInput,
  CancelAcceptedInput,
  AdminPolicyChargeReviewInput,
  AdminUpsertApprovePolicyChargeInput,
} from "./rides.schemas.js";
import {
  DRIVER_NO_SHOW_WAIT_MS,
  LATE_CANCELLATION_CAP_CLP,
  LATE_CANCELLATION_PERCENT,
  NO_SHOW_CAP_CLP,
  NO_SHOW_PERCENT,
  calculateRidePolicyAmount,
  splitNoShowAmount,
  isPassengerCancellationChargeable,
  roundFareUpTo500,
} from "./ridePolicy.js";
import {
  AIRPORT_FLOWER_LEI_UNIT_PRICE_CLP,
  buildFlowerLeiNotesLines,
  evaluateAirportFlowerLei,
  type FlowerLeiEvaluation,
} from "./airportFlowerLei.js";
import { notifyFlowerLeiReservation } from "../whatsapp/flowerLeiNotify.service.js";

const tokenService = new TokenService();
const sessionService = new SessionService();
const usersRepo = new UsersRepository();
const ridesRepo = new RidesRepository();
const driverComplianceService = new DriverComplianceService();
const driverStatusRepo = new DriverStatusRepository();
const offersRepo = new RideAssignmentOffersRepository();

const SCHEDULE_ACTIVATION_MINUTES = 30;

function queueReceiptWithoutBlocking(
  task: Promise<unknown>,
  context: string,
): void {
  void task.catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : String(error);

    console.error(`[RAPA GO] ${context}: ${message.slice(0, 500)}`);
  });
}

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
    if (zoneFare) return roundFareUpTo500(zoneFare.fare);
  } catch {
    // Usa cálculo local si tarifas falla.
  }

  const estimatedKm = Math.max(
    1,
    (originText.length + destinationText.length) / 10,
  );

  const minFareCLP = Math.round(minFareCentavos / 100);
  const raw = minFareCLP + Math.round((estimatedKm * perKmCentavos) / 10000);

  return roundFareUpTo500(
    Math.min(Math.max(raw, minFareCLP), 50000),
  );
}

/**
 * Espera estimada (min) para el pasajero de un ride B en
 * accepted+queued_offer: cuánto falta para que su conductor termine el
 * viaje actual (A) y llegue hasta el origen de B. Misma estimación de
 * Fase 1 (Haversine + velocidad promedio) — nunca expone nada del viaje A
 * más allá de este número agregado. best-effort: null si falta información
 * de ubicación.
 */
async function estimateQueuedPassengerWaitMinutes(
  driverUserId: string,
  rideB: { originLat: number | null; originLng: number | null },
): Promise<number | null> {
  try {
    if (rideB.originLat == null || rideB.originLng == null) return null;

    const driverStatus = await driverStatusRepo.findByDriverId(driverUserId);
    if (
      !driverStatus?.currentRideId ||
      driverStatus.currentLat == null ||
      driverStatus.currentLng == null
    ) {
      return null;
    }

    const currentRide = await ridesRepo.findById(driverStatus.currentRideId);
    if (currentRide?.destinationLat == null || currentRide?.destinationLng == null) {
      return null;
    }

    const remainingTripMin = estimateEtaMinutes(
      haversineDistanceKm(driverStatus.currentLat, driverStatus.currentLng, currentRide.destinationLat, currentRide.destinationLng),
      QUEUE_MATCH_CONFIG,
    );
    const pickupMin = estimateEtaMinutes(
      haversineDistanceKm(currentRide.destinationLat, currentRide.destinationLng, rideB.originLat, rideB.originLng),
      QUEUE_MATCH_CONFIG,
    );

    return Math.round(remainingTripMin + pickupMin);
  } catch {
    return null;
  }
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

type AirportFlowerLeiPricing = {
  quantity: number;
  surchargeClp: number;
  evaluation: FlowerLeiEvaluation;
};

function getAirportFlowerLeiPricing(
  input: CreateRideRequestInput,
  scheduleMeta: ScheduleMeta | null,
): AirportFlowerLeiPricing {
  const evaluation = evaluateAirportFlowerLei({
    ...(input.airportWelcomeOption !== undefined ? { airportWelcomeOption: input.airportWelcomeOption } : {}),
    ...(input.flowerLeiQuantity !== undefined ? { flowerLeiQuantity: input.flowerLeiQuantity } : {}),
    ...(input.originText !== undefined ? { originText: input.originText } : {}),
    isScheduled: Boolean(scheduleMeta?.isScheduled),
    tripFareMode: scheduleMeta?.tripFareMode ?? input.tripFareMode ?? "one_way",
    scheduledAt:
      scheduleMeta?.scheduledPickupAt ??
      scheduleMeta?.scheduledAt ??
      input.scheduledPickupAt ??
      input.scheduledAt ??
      null,
  });

  if (!evaluation.requested || !evaluation.ok) {
    return { quantity: 0, surchargeClp: 0, evaluation };
  }

  return {
    quantity: evaluation.quantity,
    surchargeClp: evaluation.surchargeClp,
    evaluation,
  };
}

function appendAirportWelcomeMetaToNotes(
  notes: string | null | undefined,
  input: CreateRideRequestInput,
  scheduleMeta: ScheduleMeta | null,
): string | null {
  const base = notes?.trim() || null;
  const pricing = getAirportFlowerLeiPricing(input, scheduleMeta);
  if (
    !pricing.evaluation.requested ||
    !pricing.evaluation.ok ||
    pricing.quantity <= 0
  ) {
    return base;
  }

  return [base, buildFlowerLeiNotesLines(pricing.evaluation).join("\n")]
    .filter(Boolean)
    .join("\n\n");
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
): "cash" | "card" | null {
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

function appendPaymentMetaToNotes(
  notes: string | null | undefined,
  paymentMethod: "cash" | "card" | undefined,
  paymentProvider:
    | "klap"
    | "mercadopago"
    | "prontopaga"
    | "transbank"
    | null
    | undefined,
): string | null {
  const cleaned = String(notes ?? "")
    .replace(/\n?PaymentMethod:\s*(?:cash|card)\s*/gi, "")
    .replace(/\n?PaymentProvider:\s*[^\n]+\s*/gi, "")
    .trim();

  if (!paymentMethod) return cleaned || null;

  const lines = [
    `PaymentMethod: ${paymentMethod}`,
    paymentMethod === "card"
      ? `PaymentProvider: ${paymentProvider ?? "mercadopago"}`
      : null,
  ].filter(Boolean);

  return [cleaned, lines.join("\n")].filter(Boolean).join("\n\n");
}

async function refundCardPaymentForCancelledRide(input: {
  rideRequestId: string;
  cancelledByUserId: string;
  cancelledByRole: string;
  reason: string | null;
  cancellationFeeClp?: number | null;
}): Promise<Record<string, unknown> | null> {
  try {
    const { PaymentsService } = await import(
      "../payments/payments.service.js"
    );

    const refundResult =
      await new PaymentsService().refundCardPaymentForCancelledRide({
        rideRequestId: input.rideRequestId,
        cancelledByUserId: input.cancelledByUserId,
        cancelledByRole: input.cancelledByRole,
        reason: input.reason,
        cancellationFeeClp: input.cancellationFeeClp ?? 0,
      });

    if (refundResult.ok) {
      return {
        processed: refundResult.processed,
        refunded: refundResult.refunded,
        skippedReason: refundResult.skippedReason ?? null,
        paymentId: refundResult.paymentId ?? null,
        mercadoPagoPaymentId:
          refundResult.mercadoPagoPaymentId ?? null,
        capturedCancellationFeeClp:
          refundResult.capturedCancellationFeeClp ?? null,
        remainderReleaseRequired:
          refundResult.remainderReleaseRequired ?? false,
      };
    }

    return {
      processed: true,
      refunded: false,
      failed: true,
      code: refundResult.code,
      message: refundResult.message,
    };
  } catch (err) {
    return {
      processed: true,
      refunded: false,
      failed: true,
      message:
        err instanceof Error
          ? err.message
          : "Error interno al devolver el pago con tarjeta.",
    };
  }
}

async function rideHasApprovedCardPayment(ride: RideRequest): Promise<boolean> {
  if (inferRidePaymentMethod(ride.notes) !== "card") return true;

  try {
    const { PaymentsRepository } = await import(
      "../payments/payments.repository.js"
    );
    // Captura diferida (Klap): una tarjeta autorizada ya reservó el dinero —
    // el viaje puede avanzar sin esperar la captura final, que ocurre recién
    // al completar el viaje (ver completeRide más abajo). Mercado Pago no
    // tiene concepto de autorización diferida: para ese proveedor solo
    // "success" cuenta, sin cambios de comportamiento.
    const payment = await new PaymentsRepository().findApprovedByRideId(ride.id);
    return Boolean(payment);
  } catch {
    // Ante una falla de base de datos, cerramos el acceso por seguridad.
    return false;
  }
}

async function settlePolicyChargeAfterConfirmedKlapCapture(
  charge: RidePolicyCharge | null,
  capturedAmountClp: unknown,
): Promise<RidePolicyCharge | null> {
  if (!charge) return null;

  const captured = Math.max(
    0,
    Math.round(Number(capturedAmountClp ?? 0)),
  );

  if (
    !Number.isSafeInteger(captured) ||
    captured <= 0 ||
    captured !== charge.calculatedAmountClp
  ) {
    return charge;
  }

  const paid = await ridesRepo.markPolicyChargePaidByCardCapture({
    id: charge.id,
    capturedAmountClp: captured,
  });

  if (!paid) {
    console.error(
      `[RAPA GO] Klap captured ${captured} CLP but policy charge ${charge.id} could not be settled.`,
    );
    return charge;
  }

  return paid;
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

function toPolicyChargeResponse(
  charge: RidePolicyCharge,
  owner?: { name?: string | null; email?: string | null },
): RidePolicyChargeResponse {
  const amountClp = Math.max(
    0,
    Math.round(
      Number(
        charge.approvedAmountClp ??
          charge.calculatedAmountClp ??
          0,
      ),
    ),
  );

  const noShowDistribution =
    charge.type === "no_show"
      ? splitNoShowAmount(amountClp)
      : null;

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
    amountClp,
    driverSharePercent:
      noShowDistribution?.driverSharePercent ?? null,
    platformSharePercent:
      noShowDistribution?.platformSharePercent ?? null,
    driverShareClp:
      noShowDistribution?.driverShareClp ?? null,
    platformShareClp:
      noShowDistribution?.platformShareClp ?? null,
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
  // Preasignación encadenada (Fase 5.1): mientras B sigue 'accepted' con
  // assignment_mode='queued_offer', el conductor todavía está terminando
  // otro viaje y jamás empezó a desplazarse hacia B — no importa cuántos
  // minutos lleve aceptada la oferta en cola, la cancelación es SIEMPRE
  // gratuita. No reutilizar acceptedAt aquí: ese timestamp se fija en el
  // momento en que el conductor aceptó la oferta (Fase 2), que puede ser
  // muy anterior al inicio real del desplazamiento.
  if (ride.assignmentMode === "queued_offer" && ride.status === "accepted") {
    return false;
  }

  // Una vez que Fase 3 activa B (driver_en_route), el reloj de gracia debe
  // arrancar en ESE momento real — enRouteAt —, no en el acceptedAt de la
  // aceptación en cola, que ya quedó minutos atrás y penalizaría de más.
  const clockStartMs =
    ride.assignmentMode === "queued_offer"
      ? (ride.enRouteAt?.getTime() ?? null)
      : (ride.acceptedAt?.getTime() ?? null);

  // La penalidad comienza únicamente desde la asignación efectiva del
  // conductor. Sin acceptedAt (incluidas reservas aún sin conductor), la
  // cancelación del pasajero es gratuita. Cuando un conductor cancela, el
  // repositorio limpia acceptedAt; la nueva aceptación crea un reloj nuevo.
  return isPassengerCancellationChargeable({
    isScheduled: false,
    scheduledPickupAtMs: null,
    acceptedAtMs: clockStartMs,
  });
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
    calculatedAmountClp: calculateRidePolicyAmount(
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
    fareBeforeWalletBenefitClp?: number;
    walletBenefitRequested?: boolean;
    walletBenefitAppliedClp?: number;
    walletBenefitRemainingClp?: number;
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
    originLat: r.originLat ?? null,
    originLng: r.originLng ?? null,
    destinationLat: r.destinationLat ?? null,
    destinationLng: r.destinationLng ?? null,
    distanceMeters: r.distanceMeters ?? null,
    durationSeconds: r.durationSeconds ?? null,
    fareCalculationSource: r.fareCalculationSource,
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
    driverProfilePhotoUrl:
      ("driverProfilePhotoUrl" in r ? r.driverProfilePhotoUrl : null) ?? null,
    discountApplied: discountInfo != null,
    discountPercent: discountInfo?.discountPercent ?? null,
    originalFareClp: discountInfo?.originalFare ?? null,
    rideType: r.rideType ?? "immediate",
    scheduledPickupAt: r.scheduledPickupAt?.toISOString() ?? null,
    priorityFeeClp: r.priorityFeeClp ?? null,
    flightNumber: r.flightNumber ?? null,
    preferredDriverGender:
      (r.preferredDriverGender as "female" | null | undefined) ?? null,
    paymentMethod:
      r.paymentMethod === "cash" || r.paymentMethod === "card"
        ? r.paymentMethod
        : inferRidePaymentMethod(r.notes),
    paymentProvider: r.paymentProvider ?? null,
    walletBenefitRequested:
      policyInfo?.walletBenefitRequested ??
      r.walletBenefitRequested ??
      false,
    fareBeforeWalletBenefitClp:
      policyInfo?.fareBeforeWalletBenefitClp ??
      r.fareBeforeWalletBenefitClp ??
      r.estimatedFareClp ??
      null,
    walletBenefitAppliedClp:
      policyInfo?.walletBenefitAppliedClp ??
      r.walletBenefitAppliedClp ??
      0,
    walletBenefitRemainingClp:
      policyInfo?.walletBenefitRemainingClp ?? 0,
    walletBenefitReversedClp:
      r.walletBenefitReversedClp ?? 0,
    walletBenefitReversedAt:
      r.walletBenefitReversedAt?.toISOString() ?? null,
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
    assignmentMode: r.assignmentMode,
    requestedVehicleCategory: r.requestedVehicleCategory ?? "standard",
    assignedVehicleCategory: r.assignedVehicleCategory ?? null,
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
    originLat: r.originLat ?? null,
    originLng: r.originLng ?? null,
    destinationLat: r.destinationLat ?? null,
    destinationLng: r.destinationLng ?? null,
    distanceMeters: r.distanceMeters ?? null,
    durationSeconds: r.durationSeconds ?? null,
    fareCalculationSource: r.fareCalculationSource,
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
    rideType: r.rideType ?? "immediate",
    scheduledPickupAt: r.scheduledPickupAt?.toISOString() ?? null,
    priorityFeeClp: r.priorityFeeClp ?? null,
    flightNumber: r.flightNumber ?? null,
  };
}

function toAvailableResponse(r: RideRequest): AvailableRideResponse {
  return {
    id: r.id,
    originText: r.originText,
    destinationText: r.destinationText,
    notes: r.notes,
    estimatedFareClp: r.estimatedFareClp ?? null,
    distanceMeters: r.distanceMeters ?? null,
    durationSeconds: r.durationSeconds ?? null,
    fareCalculationSource: r.fareCalculationSource,
    status: r.status,
    requestedAt: r.requestedAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
    requestedVehicleCategory: r.requestedVehicleCategory ?? "standard",
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
        let response = toResponse(ride);

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

        // Preasignación encadenada (Fase 5): mientras el ride sigue
        // 'accepted' vía assignmentMode='queued_offer', el conductor ya está
        // asignado pero todavía termina otro viaje — nunca se le muestra al
        // pasajero como "en camino" hasta que Fase 3 haga la transición real
        // a driver_en_route. Se agrega sólo una estimación agregada (minutos
        // de espera), nunca datos del otro viaje (A) ni de su pasajero.
        if (
          ride.status === "accepted" &&
          ride.assignmentMode === "queued_offer" &&
          ride.driverUserId
        ) {
          response = {
            ...response,
            estimatedWaitMinutes: await estimateQueuedPassengerWaitMinutes(
              ride.driverUserId,
              ride,
            ),
          };
        }

        return response;
      }),
    );

    return { ok: true, rides: responses };
  }

  async getRideRouteHistory(
    accessToken: string,
    rideId: string,
  ): Promise<RideRouteHistoryResult> {
    const auth = await authenticate(accessToken);
    if (!auth.ok) return auth;

    const ride = await ridesRepo.findById(rideId);
    if (!ride) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "Ride request not found.",
        statusCode: 404,
      };
    }

    const canRead =
      auth.role === "admin" ||
      ride.passengerUserId === auth.userId ||
      ride.driverUserId === auth.userId;

    if (!canRead) {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message: "You cannot access the recorded route for this ride.",
        statusCode: 403,
      };
    }

    const routeFrom = ride.acceptedAt ?? ride.requestedAt;
    const routeTo =
      ride.completedAt ?? ride.cancelledAt ?? ride.updatedAt ?? new Date();
    const points = await ridesRepo.listRouteHistory(
      rideId,
      routeFrom,
      routeTo,
    );
    const filtered = filterGpsTrack(
      points.map((point) => ({
        lat: point.latitude,
        lng: point.longitude,
        capturedAt: point.capturedAt.toISOString(),
        accuracyMeters: point.accuracyMeters ?? null,
      })),
    );

    return {
      ok: true,
      rideId,
      points: filtered.map((point) => ({
        lat: point.lat,
        lng: point.lng,
        accuracyMeters: point.accuracyMeters ?? null,
        capturedAt: point.capturedAt ?? new Date().toISOString(),
      })),
    };
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
      !["klap", "mercadopago", "prontopaga", "transbank"].includes(input.paymentProvider)
    ) {
      return {
        ok: false,
        code: "INVALID_PAYMENT_PROVIDER",
        message: "Proveedor de pago no permitido para reservas.",
        statusCode: 400,
      };
    }

    const airportFlowerLeiPricing = getAirportFlowerLeiPricing(
      input,
      scheduleMeta,
    );

    if (
      airportFlowerLeiPricing.evaluation.requested &&
      !airportFlowerLeiPricing.evaluation.ok
    ) {
      return {
        ok: false,
        code: airportFlowerLeiPricing.evaluation.code,
        message: airportFlowerLeiPricing.evaluation.message,
        statusCode: 400,
      };
    }

    const notesForStorage = appendPaymentMetaToNotes(
      appendAirportWelcomeMetaToNotes(
        appendScheduleMetaToNotes(
          input.notes ?? null,
          scheduleMeta,
        ),
        input,
        scheduleMeta,
      ),
      input.paymentMethod,
      input.paymentProvider,
    );

    const requestedCategory = resolveRequestedVehicleCategory({
      requestedVehicleCategory: input.requestedVehicleCategory,
      vehicleCategory: input.vehicleCategory,
      fareVehicleCategory: input.fareVehicleCategory,
      notes: notesForStorage,
    });

    const serverBaseFare = roundFareUpTo500(
      await estimateFare(
        input.originText,
        input.destinationText,
      ),
    );

    const { computeAuthoritativeCategoryFareClp } = await import(
      "../fares/vehicleCategoryFare.service.js"
    );
    const authoritativeFare = await computeAuthoritativeCategoryFareClp(
      serverBaseFare,
      requestedCategory,
    );

    // Tarifa autoritativa server-side: el cliente no puede reducir el monto
    // manipulando estimatedFareClp ni multiplicadores de categoría.
    const baseFare = authoritativeFare;

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
          finalFare = roundFareUpTo500(
            baseFare * (1 - discountPercent / 100),
          );
          discountInfo = { discountPercent, originalFare: baseFare };
        }
      }
    } catch {
      // No bloquea crear el viaje.
    }

    // El valor del collar nunca viene del cliente: el backend agrega el
    // recargo unitario oficial según la cantidad validada de la reserva.
    finalFare = roundFareUpTo500(
      finalFare + airportFlowerLeiPricing.surchargeClp,
    );

    const created = await ridesRepo.createWithApprovedPolicyCharges(
      auth.userId,
      input.originText,
      input.destinationText,
      notesForStorage,
      finalFare,
      input.paymentMethod === "card" ? "pending_payment" : "requested",
      {
        ...(input.paymentMethod
          ? { paymentMethod: input.paymentMethod }
          : {}),
        paymentProvider: input.paymentProvider ?? null,
        useWalletBenefit: input.useWalletBenefit === true,
        requestedVehicleCategory: resolveRequestedVehicleCategory({
          requestedVehicleCategory: input.requestedVehicleCategory,
          vehicleCategory: input.vehicleCategory,
          fareVehicleCategory: input.fareVehicleCategory,
          notes: notesForStorage,
        }),
      },
    );

    // Disparador de la Fase 2 (preasignación encadenada): sólo para rides
    // inmediatos ya en 'requested' (no scheduled, no pending_payment). Best
    // effort — nunca debe bloquear ni fallar la creación del ride si el
    // productor de ofertas encuentra un problema.
    if (created.ride.status === "requested") {
      queueReceiptWithoutBlocking(
        attemptQueuedOffer(created.ride.id),
        `No se pudo generar oferta de preasignación encadenada para ${created.ride.id}`,
      );
    }

    if (
      airportFlowerLeiPricing.evaluation.requested &&
      airportFlowerLeiPricing.evaluation.ok
    ) {
      const lei = airportFlowerLeiPricing.evaluation;
      console.info(
        `[RESERVATION] created reservationId=${created.ride.id}`,
      );
      console.info(
        `[FLOWER_NECKLACE] requested reservationId=${created.ride.id} quantity=${lei.quantity}`,
      );

      queueReceiptWithoutBlocking(
        (async () => {
          const user = await usersRepo.findById(auth.userId);
          let passengerPhone: string | null = null;
          try {
            const { PassengerProfileRepository } = await import(
              "../passengers/passengerProfile.repository.js"
            );
            const profile = await new PassengerProfileRepository().findByUserId(
              auth.userId,
            );
            passengerPhone =
              profile?.phoneE164 ?? profile?.phone ?? null;
          } catch {
            passengerPhone = null;
          }

          await notifyFlowerLeiReservation({
            reservationId: created.ride.id,
            passengerName: user?.name ?? "Pasajero",
            passengerPhone,
            passengerEmail: user?.email ?? null,
            flowerLeiQuantity: lei.quantity,
            unitPriceClp: AIRPORT_FLOWER_LEI_UNIT_PRICE_CLP,
            surchargeClp: lei.surchargeClp,
            requestedVehicleCategory: requestedCategory,
            scheduledAt: lei.scheduledAt,
            leadMs: lei.leadMs,
            originText: input.originText ?? "",
            destinationText: input.destinationText,
          });
        })(),
        `No se pudo notificar collares para ${created.ride.id}`,
      );
    }

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
          fareBeforeWalletBenefitClp:
            created.fareBeforeWalletBenefitClp,
          walletBenefitRequested:
            created.walletBenefitRequested,
          walletBenefitAppliedClp:
            created.walletBenefitAppliedClp,
          walletBenefitRemainingClp:
            created.walletBenefitRemainingClp,
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

    const cancellationReason =
      input.reason ?? "Cancelado por pasajero.";

    const cancelled = await ridesRepo.cancel(
      existing.id,
      auth.userId,
      "passenger",
      cancellationReason,
    );

    let policyCharge: RidePolicyCharge | null = null;

    // Sin conductor asignado no existe penalidad, aunque sea una reserva.
    // Una solicitud todavía sin pago aprobado también se puede descartar sin
    // multa. El reloj comienza únicamente en acceptedAt de la asignación
    // efectiva y se reinicia cuando un nuevo conductor acepta el viaje.
    if (
      existing.status !== "pending_payment" &&
      shouldCreatePassengerCancellationCharge(existing)
    ) {
      const chargeData = buildPolicyChargeData({
        ride: existing,
        type: "late_cancellation",
        reason: cancellationReason,
      });

      if (chargeData.calculatedAmountClp > 0) {
        policyCharge = await ridesRepo.createPolicyCharge(chargeData);
      }
    }

    const paymentRefund =
      await refundCardPaymentForCancelledRide({
        rideRequestId: rideId,
        cancelledByUserId: auth.userId,
        cancelledByRole: "passenger",
        reason: cancellationReason,
        cancellationFeeClp:
          policyCharge?.calculatedAmountClp ?? 0,
      });

    if (
      policyCharge &&
      paymentRefund?.["capturedCancellationFeeClp"] != null
    ) {
      policyCharge = await settlePolicyChargeAfterConfirmedKlapCapture(
        policyCharge,
        paymentRefund["capturedCancellationFeeClp"],
      );
    }

    const response = toResponse(cancelled) as RideRequestResponse &
      Record<string, unknown>;

    response["policyCharge"] = policyCharge
      ? toPolicyChargeResponse(policyCharge)
      : null;
    response["paymentRefund"] = paymentRefund;

    queueReceiptWithoutBlocking(
      rideReceiptsService.queueCancelledRide(
        cancelled.id,
        policyCharge?.id ?? null,
      ),
      `No se pudo encolar el comprobante de cancelación ${cancelled.id}`,
    );

    return { ok: true, ride: response };
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

    const restAccess = await driverComplianceService.canReceiveNewOffers(
      auth.userId,
    );
    if (!restAccess.allowed) {
      return { ok: true, rides: [] };
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

    const { capabilitiesFromDriverProfile } = await import(
      "./vehicleEligibility.js"
    );
    const {
      isVehicleEligibleForRequestedCategory,
      DEFAULT_COMFORT_MIN_VEHICLE_YEAR,
    } = await import("@rapa-go/shared");

    let comfortMinVehicleYear = DEFAULT_COMFORT_MIN_VEHICLE_YEAR;
    try {
      const { getComfortMinVehicleYear } = await import(
        "../drivers/comfortEligibility.service.js"
      );
      comfortMinVehicleYear = await getComfortMinVehicleYear();
    } catch {
      comfortMinVehicleYear = DEFAULT_COMFORT_MIN_VEHICLE_YEAR;
    }

    let capabilities;
    try {
      const snapshot = await ridesRepo.findDriverVehicleEligibilitySnapshot(
        auth.userId,
      );
      capabilities = capabilitiesFromDriverProfile(
        snapshot
          ? {
              vehicleCategory: snapshot.vehicleCategory ?? "standard",
              vehicleYear: snapshot.vehicleYear,
              capabilityXl: snapshot.capabilityXl,
              capabilityExtraLuggage: snapshot.capabilityExtraLuggage,
              capabilityComfort: snapshot.capabilityComfort,
            }
          : null,
      );
    } catch {
      capabilities = capabilitiesFromDriverProfile(null);
    }

    const eligibleRows = payableRows.filter((ride) =>
      isVehicleEligibleForRequestedCategory(
        capabilities,
        ride.requestedVehicleCategory,
        { comfortMinVehicleYear },
      ),
    );

    return { ok: true, rides: eligibleRows.map(toAvailableResponse) };
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

    const restAccess = await driverComplianceService.canReceiveNewOffers(
      auth.userId,
    );
    if (!restAccess.allowed) {
      return {
        ok: false,
        code: "DRIVER_REST_PERIOD",
        message: restAccess.state.message,
        statusCode: 409,
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

    // Reclama el slot de viaje ACTIVO ANTES de tocar el ride. Nunca se confía
    // en la UI para impedir que un conductor termine con dos viajes activos:
    // la garantía real es este UPDATE condicional en BD (current_ride_id debe
    // estar libre). Si el conductor ya tenía un viaje activo, se rechaza aquí
    // mismo, sin siquiera intentar tomar el ride.
    const claimed = await driverStatusRepo.claimCurrentRide(auth.userId, rideId);

    if (!claimed) {
      return {
        ok: false,
        code: "DRIVER_ALREADY_HAS_ACTIVE_RIDE",
        message: "You already have an active ride and cannot accept another.",
        statusCode: 409,
      };
    }

    let accepted;
    try {
      accepted = await ridesRepo.accept(rideId, auth.userId);
    } catch (err) {
      await driverStatusRepo.releaseCurrentRideClaim(auth.userId, rideId);
      if (err instanceof AppError) {
        return {
          ok: false as const,
          code: err.code,
          message: err.message,
          statusCode: err.statusCode,
        };
      }
      throw err;
    }

    if (!accepted) {
      // El slot se reclamó pero el ride ya no estaba disponible (otro
      // conductor ganó la carrera). Liberar el claim para no dejar al
      // conductor bloqueado por un viaje que nunca tomó.
      await driverStatusRepo.releaseCurrentRideClaim(auth.userId, rideId);

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

    // Preasignación encadenada (Fase 3): si el conductor tenía un viaje B en
    // cola, la transición A→B se intenta en su propia transacción DB antes
    // de decidir el destino normal de disponibilidad del conductor. Nunca
    // dos operaciones sueltas: activar B (o limpiar la referencia stale si
    // ya no es válido) y mover current_ride_id/queued_ride_id ocurren como
    // una sola unidad atómica dentro de activateQueuedRideOrClearStale().
    let queuedTransition: Awaited<ReturnType<typeof driverStatusRepo.activateQueuedRideOrClearStale>> | null = null;
    if (completed.driverUserId) {
      queuedTransition = await driverStatusRepo.activateQueuedRideOrClearStale(
        completed.driverUserId,
        completed.id,
      );

      if (queuedTransition.decision !== "TRANSITIONED") {
        // Sin B válido que activar (no había cola, o quedó stale y ya se
        // limpió dentro de la transacción anterior) — comportamiento actual
        // intacto: el conductor sigue el flujo normal de disponibilidad.
        await driverComplianceService.releaseDriverAfterRide(
          completed.driverUserId,
        );
      }
      // Si TRANSITIONED: el conductor ya quedó busy con current_ride_id=B
      // dentro de la transacción — nunca pasa momentáneamente por
      // "available", evitando la carrera que activaría un nuevo viaje A
      // distinto para el mismo conductor.
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

    // Notificación al pasajero B — SOLO si la transición realmente ocurrió,
    // reutilizando el mismo mecanismo que markEnRoute() usa para el flujo
    // normal. Best-effort, después de que la transacción ya confirmó.
    if (queuedTransition?.decision === "TRANSITIONED") {
      const activatedRideId = queuedTransition.activatedRideId;
      ridesRepo
        .findById(activatedRideId)
        .then((activatedRide) => {
          if (!activatedRide) return;
          const activatedResp = toResponse(activatedRide);
          return import("../notifications/notifications.helpers.js").then(
            ({ notifyPassengerDriverEnRoute }) => {
              notifyPassengerDriverEnRoute({
                passengerUserId: activatedResp.passengerUserId,
                driverName: activatedResp.driverName ?? "Tu conductor",
                rideId: activatedResp.id,
              });
            },
          );
        })
        .catch(() => {});
    }

    queueReceiptWithoutBlocking(
      rideReceiptsService.queueCompletedRide(completed.id),
      `No se pudo encolar el comprobante del viaje ${completed.id}`,
    );

    // Captura diferida (Klap): el cierre del viaje en el backend es la única
    // autoridad financiera que dispara el cobro real. Ni el conductor ni el
    // pasajero controlan el monto — se resuelve enteramente dentro de
    // captureAuthorizedKlapPayment(). Un error de captura NUNCA deshace ni
    // reabre el viaje ya completado: se atrapa y se ignora aquí a propósito,
    // dejando el viaje completed con el pago en
    // capture_pending/capture_unknown/capture_failed para conciliación.
    try {
      const { isKlapCaptureExecutionEnabled } = await import(
        "../payments/klap.provider.js"
      );

      if (isKlapCaptureExecutionEnabled()) {
        const { PaymentsRepository } = await import(
          "../payments/payments.repository.js"
        );
        const payment = await new PaymentsRepository().findByRideId(completed.id);

        if (
          payment &&
          payment.provider === "klap" &&
          payment.status === "authorized"
        ) {
          const { PaymentsService } = await import(
            "../payments/payments.service.js"
          );
          const finalRideAmountClp = Math.max(
            0,
            Math.round(
              Number(
                completed.estimatedFareClp ??
                  payment.authorizedAmountClp ??
                  payment.amountClp ??
                  0,
              ),
            ),
          );

          const captureResult =
            await new PaymentsService().captureAuthorizedKlapPayment(
              payment.id,
              {
                outcome: "completed",
                finalRideAmountClp,
                authorizationExpired: false,
              },
            );

          if (!captureResult.ok) {
            const { AuditService } = await import(
              "../audit/audit.service.js"
            );
            new AuditService().recordSafe({
              actorUserId: completed.passengerUserId,
              eventType: "payment.klap_capture_requires_attention",
              entityType: "payment",
              entityId: payment.id,
              metadata: {
                rideId: completed.id,
                code: captureResult.code,
                paymentStatus: payment.status,
              },
            });
          }
        }
      }
    } catch (error) {
      console.error(
        `[RAPA GO] Falló el disparo de captura Klap del viaje ${completed.id}: ${
          error instanceof Error ? error.message.slice(0, 300) : "unknown"
        }`,
      );
    }

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
          message: `Ride cannot be started — current status is '${existing.status}'.`,
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

    const cancellingAsPassenger =
      existing.passengerUserId === auth.userId;
    const cancellingAsDriver =
      existing.driverUserId === auth.userId;

    if (!cancellingAsPassenger && !cancellingAsDriver) {
      return {
        ok: false,
        code: "AUTH_FORBIDDEN",
        message:
          "You can only cancel a ride requested by you or assigned to you.",
        statusCode: 403,
      };
    }

    // Una cuenta con rol driver también puede estar viajando como usuario.
    // La relación con el viaje, no el rol global de la cuenta, determina la
    // política aplicable.
    const cancellationActorRole = cancellingAsPassenger
      ? "passenger"
      : "driver";

    const cancelled = await ridesRepo.cancelAccepted(
      rideId,
      auth.userId,
      cancellationActorRole,
      input.reason ?? null,
      {
        cancellationEvent:
          input.cancellationEvent ??
          `mobile_cancelled_by_${cancellationActorRole}`,
        location: input.location
          ? {
              lat: input.location.lat,
              lng: input.location.lng,
              accuracyMeters: input.location.accuracyMeters ?? null,
              capturedAt: input.location.capturedAt
                ? new Date(input.location.capturedAt)
                : new Date(),
            }
          : null,
      },
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

    // Preasignación encadenada (Fase 5.1): si B todavía era sólo una oferta
    // en cola (accepted + queued_offer), el conductor sigue con su viaje
    // ACTIVO en curso (current_ride_id=A) — jamás liberarlo con
    // releaseDriverAfterRide() aquí, porque eso lo dejaría erróneamente
    // "available" (o en descanso) en medio de A. Sólo se limpia el slot de
    // cola y se cancela cualquier oferta pendiente asociada a B; A queda
    // intacto.
    const wasQueuedOffer =
      existing.assignmentMode === "queued_offer" &&
      existing.status === "accepted";

    if (wasQueuedOffer && existing.driverUserId) {
      await driverStatusRepo.releaseQueuedRideClaim(
        existing.driverUserId,
        existing.id,
      );
      await offersRepo.markCancelledByRideId(existing.id);

      // Fase 5.2 — Caso 4 (conductor cancela sólo B, A sigue activo):
      // ridesRepo.cancelAccepted() ya devolvió B a 'requested' con
      // driverUserId=null (rama compartida con cancelaciones normales).
      // Sólo falta limpiar el rastro de assignment_mode/queued_offer_driver_id
      // y volver a intentar ofrecerla — nunca releaseDriverAfterRide() aquí,
      // porque A sigue current_ride_id y liberarlo lo dejaría "available" en
      // medio de un viaje en curso.
      if (cancellationActorRole === "driver") {
        await ridesRepo.clearQueuedOfferMetadata(existing.id);
        void attemptQueuedOffer(existing.id).catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`[RAPA GO] No se pudo reintentar oferta para ${existing.id} tras cancelación del conductor: ${message.slice(0, 300)}`);
        });
      }
    } else if (existing.driverUserId) {
      // Fase 5.2 — Casos 1/3 (A termina anormalmente por cancelación o por
      // reconciliación de estado stale detectada aquí): resolver cualquier
      // B en cola ANTES de liberar al conductor, para no dejar
      // current_ride_id=NULL con queued_ride_id todavía apuntando a B.
      const resolution = await driverStatusRepo.resolveQueuedRideOnAbnormalEnd(
        existing.driverUserId,
        existing.id,
      );

      if (resolution.decision === "RESOLVED") {
        await offersRepo.markCancelledByRideId(resolution.releasedRideId);
        void attemptQueuedOffer(resolution.releasedRideId).catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`[RAPA GO] No se pudo reasignar B ${resolution.releasedRideId} tras terminación anormal de A: ${message.slice(0, 300)}`);
        });
      } else if (resolution.decision === "QUEUED_RIDE_ALREADY_INVALID") {
        // Otro proceso ya la había resuelto (carrera) — driver_statuses ya
        // quedó limpio dentro de la misma transacción, nada más que hacer.
      }

      await driverComplianceService.releaseDriverAfterRide(
        existing.driverUserId,
      );
    }

    let policyCharge: RidePolicyCharge | null = null;

    if (
      cancellationActorRole === "passenger" &&
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

    // Cuando cancela el conductor el viaje vuelve a búsqueda; no se devuelve
    // el pago ni se genera cargo al pasajero. La devolución solo corresponde
    // cuando la cuenta pasajera cancela definitivamente.
    const paymentRefund =
      cancellationActorRole === "passenger"
        ? await refundCardPaymentForCancelledRide({
            rideRequestId: rideId,
            cancelledByUserId: auth.userId,
            cancelledByRole: cancellationActorRole,
            reason: input.reason ?? null,
            cancellationFeeClp:
              policyCharge?.calculatedAmountClp ?? 0,
          })
        : null;

    if (
      policyCharge &&
      paymentRefund?.["capturedCancellationFeeClp"] != null
    ) {
      policyCharge = await settlePolicyChargeAfterConfirmedKlapCapture(
        policyCharge,
        paymentRefund["capturedCancellationFeeClp"],
      );
    }

    const responseRide = toResponse(cancelled) as RideRequestResponse &
      Record<string, unknown>;

    responseRide["paymentRefund"] = paymentRefund;
    responseRide["policyCharge"] = policyCharge
      ? toPolicyChargeResponse(policyCharge)
      : null;

    if (cancellationActorRole === "driver") {
      responseRide["requeuedAfterDriverCancellation"] = true;
      responseRide["passengerNotice"] =
        "Tu conductor canceló el viaje. Estamos buscando uno nuevo.";

      // Señal persistente y real, visible aunque el pasajero esté en otro
      // dispositivo — a diferencia del `responseRide` de arriba, que sólo
      // llega al conductor que hizo esta llamada. Reutiliza el mecanismo de
      // notificaciones existente (mismo que notifyPassengerDriverEnRoute),
      // no crea infraestructura nueva.
      import("../notifications/notifications.helpers.js")
        .then(({ notifyPassengerDriverCancelledAndReassigning }) => {
          notifyPassengerDriverCancelledAndReassigning({
            passengerUserId: cancelled.passengerUserId,
            rideId: cancelled.id,
          });
        })
        .catch(() => {});
    } else {
      queueReceiptWithoutBlocking(
        rideReceiptsService.queueCancelledRide(
          cancelled.id,
          policyCharge?.id ?? null,
        ),
        `No se pudo encolar el comprobante de cancelación ${cancelled.id}`,
      );
    }

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

    queueReceiptWithoutBlocking(
      rideReceiptsService.queuePolicyCharge(updated.id),
      `No se pudo encolar el comprobante del cargo ${updated.id}`,
    );

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

    const calculatedAmountClp = calculateRidePolicyAmount(
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

    queueReceiptWithoutBlocking(
      rideReceiptsService.queuePolicyCharge(updated.id),
      `No se pudo encolar el comprobante del cargo ${updated.id}`,
    );

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

    // Fase 5.2 — Caso 2 (A termina anormalmente por no-show): resolver
    // cualquier B en cola antes de liberar al conductor.
    const noShowResolution =
      await driverStatusRepo.resolveQueuedRideOnAbnormalEnd(
        auth.userId,
        rideId,
      );

    if (noShowResolution.decision === "RESOLVED") {
      await offersRepo.markCancelledByRideId(noShowResolution.releasedRideId);
      void attemptQueuedOffer(noShowResolution.releasedRideId).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[RAPA GO] No se pudo reasignar B ${noShowResolution.releasedRideId} tras no-show de A: ${message.slice(0, 300)}`);
      });
    }

    await driverComplianceService.releaseDriverAfterRide(auth.userId);

    const chargeData = buildPolicyChargeData({
      ride: existing,
      type: "no_show",
      reason:
        "Pasajero no se presentó después de 5 minutos.",
    });

    let charge =
      chargeData.calculatedAmountClp > 0
        ? await ridesRepo.createPolicyCharge(chargeData)
        : null;

    // NO SHOW + Klap diferido: el cargo se calcula exclusivamente en backend
    // (50% con tope vigente en buildPolicyChargeData). Si existe una
    // autorización Klap viva, se captura SOLO el cargo NO SHOW. Nunca se usa
    // un monto enviado por la app y cualquier falla financiera no reabre el
    // viaje ya cerrado como no_show.
    let noShowPaymentResolution: Record<string, unknown> | null = null;

    try {
      const { isKlapDeferredCaptureEnabled } = await import(
        "../payments/klap.provider.js"
      );

      if (
        isKlapDeferredCaptureEnabled() &&
        chargeData.calculatedAmountClp > 0
      ) {
        const { PaymentsRepository } = await import(
          "../payments/payments.repository.js"
        );
        const payment = await new PaymentsRepository().findByRideId(closed.id);

        if (
          payment &&
          String(payment.provider ?? "").trim().toLowerCase() === "klap" &&
          payment.status === "authorized"
        ) {
          const { PaymentsService } = await import(
            "../payments/payments.service.js"
          );

          const captureResult =
            await new PaymentsService().captureAuthorizedKlapPayment(
              payment.id,
              {
                outcome: "no_show",
                noShowFeeClp: chargeData.calculatedAmountClp,
                authorizationExpired: false,
              },
            );

          const captureConfirmed =
            captureResult.ok && captureResult.status === "success";

          if (captureConfirmed && charge) {
            charge = await settlePolicyChargeAfterConfirmedKlapCapture(
              charge,
              chargeData.calculatedAmountClp,
            );
          }

          noShowPaymentResolution = captureConfirmed
            ? {
                processed: true,
                paymentId: payment.id,
                status: "success",
                capturedNoShowFeeClp: chargeData.calculatedAmountClp,
              }
            : captureResult.ok
              ? {
                  processed: false,
                  paymentId: payment.id,
                  requiresAttention: true,
                  status: captureResult.status,
                }
              : {
                  processed: false,
                  paymentId: payment.id,
                  requiresAttention: true,
                  code: captureResult.code,
                };

          if (!captureConfirmed) {
            const { AuditService } = await import(
              "../audit/audit.service.js"
            );
            new AuditService().recordSafe({
              actorUserId: closed.passengerUserId,
              eventType: "payment.klap_no_show_capture_requires_attention",
              entityType: "payment",
              entityId: payment.id,
              metadata: {
                rideId: closed.id,
                noShowFeeClp: chargeData.calculatedAmountClp,
                code: captureResult.ok
                  ? `STATUS_${String(captureResult.status).toUpperCase()}`
                  : captureResult.code,
              },
            });
          }
        }
      }
    } catch (error) {
      console.error(
        `[RAPA GO] Falló la resolución financiera Klap NO SHOW ${closed.id}: ${
          error instanceof Error ? error.message.slice(0, 300) : "unknown"
        }`,
      );
    }

    const response = toResponse(closed) as RideRequestResponse &
      Record<string, unknown>;

    response["policyCharge"] = charge
      ? toPolicyChargeResponse(charge)
      : null;
    response["paymentResolution"] = noShowPaymentResolution;

    queueReceiptWithoutBlocking(
      rideReceiptsService.queueNoShowRide(
        closed.id,
        charge?.id ?? null,
      ),
      `No se pudo encolar el comprobante de no-show ${closed.id}`,
    );

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
