import {
  IonBadge, IonButton, IonCard, IonCardContent, IonChip, IonContent, IonHeader,
IonInfiniteScroll, IonInfiniteScrollContent, IonLabel, IonPage,
  IonRefresher, IonRefresherContent, IonSpinner, IonText, IonTextarea, IonTitle,
  IonToolbar, IonItem, IonToast,
} from "@ionic/react";
import { useState, useCallback, useEffect, useRef, type CSSProperties } from "react";
import { useHistory } from "react-router-dom";
import { carOutline } from "ionicons/icons";
import { EmptyState } from "../../../components/EmptyState.js";
import { TripTimeline } from "../../../components/TripTimeline.js";
import { SkeletonList } from "../../../components/SkeletonCard.js";
import { WhatsAppButton } from "../../../components/WhatsAppButton.js";
import { loadRapaGoGoogleMaps } from "../../../components/MapFallback.js";
import { useAuth } from "../../../features/auth/index.js";
import { ridesService, type RideRequestData } from "../../../features/rides/rides.service.js";
import { ROUTES } from "../../../navigation/routes.js";
import { RAPAGO_CONTACT, WA_MESSAGES } from "@rapa-go/shared";
import { RIDE_STATUS_LABEL, RIDE_STATUS_COLOR } from "../shared.js";

const PAGE_SIZE = 20;
// Los viajes cancelados solo viven 24 horas en Mis Viajes.
// Así no se acumulan indefinidamente en Todos/Cancelados durante las pruebas o uso real.
const CANCELLED_RIDE_EXPIRATION_MS = 24 * 60 * 60 * 1000;
// v26: mapa pasajero igual que RequestRidePage: azul ubicación real, verde punto accesible en calle.
const ACTIVE_STATUSES = [
  "scheduled",
  "driver_scheduled",
  "requested",
  "accepted",
  "driver_en_route",
  "driver_arrived",
  "in_progress",
];

const LOCAL_PASSENGER_RIDES_KEY = "rapago_local_passenger_rides";

type PassengerNotificationPayload = {
  id: string;
  rideId: string;
  type: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
};

const RAPAGO_PASSENGER_NOTIFICATIONS_KEY = "rapago_passenger_notifications_v1";
const RAPAGO_REQUEUED_RIDES_KEY = "rapago_requeued_available_rides_v1";
const RAPAGO_REQUEUED_PASSENGER_FORCE_KEY = "rapago_requeued_passenger_visible_rides_v1";
const RAPAGO_REQUEUED_RIDES_EVENT = "rapago:ride-requeued-after-driver-cancel";

function readPassengerNotifications(): PassengerNotificationPayload[] {
  try {
    const raw = localStorage.getItem(RAPAGO_PASSENGER_NOTIFICATIONS_KEY);
    const parsed = raw ? (JSON.parse(raw) as PassengerNotificationPayload[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function markPassengerNotificationsRead(): void {
  try {
    const current = readPassengerNotifications();
    localStorage.setItem(
      RAPAGO_PASSENGER_NOTIFICATIONS_KEY,
      JSON.stringify(current.map((item) => ({ ...item, read: true }))),
    );
  } catch {
    // No bloquea Mis Viajes.
  }
}

const RAPAGO_ADMIN_SCHEDULED_RIDES_KEY = "rapago_admin_scheduled_rides_v1";
const RAPAGO_ADMIN_SCHEDULED_RIDES_EVENT = "rapago:admin-scheduled-rides-updated";

const RAPAGO_ADMIN_SCHEDULED_EXTRA_KEYS = [
  RAPAGO_ADMIN_SCHEDULED_RIDES_KEY,
  // Key used by RequestRidePage/admin v3. Without this, the passenger screen
  // shows Activos > 0 but the scheduled card can stay invisible.
  "rapago_admin_scheduled_rides",
  "rapago_admin_scheduled_rides_v2",
  "rapago_admin_scheduled_rides_force_v1",
  "rapago_bridge_scheduled_rides_v1",
] as const;

function isStoredScheduledRide(ride: RideRequestData & Record<string, unknown>): boolean {
  const notes = String(ride.notes ?? "");
  return (
    ride.isScheduled === true ||
    ride.rideMode === "scheduled" ||
    Boolean(ride.scheduledAt) ||
    Boolean(ride.scheduledPickupAt) ||
    Boolean(ride.scheduledReturnAt) ||
    /Tipo de solicitud:\s*viaje agendado/i.test(notes) ||
    /Viaje programado para/i.test(notes) ||
    /Fecha y hora de recogida agendada/i.test(notes) ||
    /Fecha y hora de regreso agendada/i.test(notes) ||
    /Activación automática recogida/i.test(notes) ||
    /Activación automática regreso/i.test(notes)
  );
}

function getRideDedupeKey(ride: RideRequestData & Record<string, unknown>): string {
  const email = String(ride.passengerEmail ?? "").trim().toLowerCase();
  const origin = String(ride.originText ?? "").trim().toLowerCase();
  const destination = String(ride.destinationText ?? "").trim().toLowerCase();
  const pickup = String(ride.scheduledPickupAt ?? ride.scheduledAt ?? ride.requestedAt ?? "").trim();
  const ret = String(ride.scheduledReturnAt ?? "").trim();
  return [email, origin, destination, pickup, ret].join("|");
}

function getCancelledRideAgeTimestampMs(ride: Partial<RideRequestData> & Record<string, unknown>): number | null {
  const candidates = [
    ride.cancelledAt,
    ride.canceledAt,
    ride.updatedAt,
    ride.completedAt,
    ride.requestedAt,
    ride.createdAt,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const parsed = new Date(String(candidate)).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

function isRawCancelledRideRecord(ride: Partial<RideRequestData> & Record<string, unknown>): boolean {
  const status = String(ride.status ?? "").toLowerCase().trim();
  const cancelledBy = String(ride.cancelledByRole ?? ride.cancelledBy ?? "").toLowerCase();
  const reason = String(ride.cancellationReason ?? ride.cancelReason ?? ride.requeuedReason ?? "").toLowerCase();

  return (
    status === "cancelled" ||
    status === "canceled" ||
    status === "passenger_cancelled" ||
    status === "driver_cancelled" ||
    Boolean(ride.cancelledAt) ||
    Boolean(ride.canceledAt) ||
    cancelledBy.includes("passenger") ||
    cancelledBy.includes("pasajero") ||
    cancelledBy.includes("driver") ||
    cancelledBy.includes("conductor") ||
    reason.includes("cancel")
  );
}

function isExpiredCancelledRideRecord(
  ride: Partial<RideRequestData> & Record<string, unknown>,
  nowMs = Date.now(),
): boolean {
  if (!isRawCancelledRideRecord(ride)) return false;

  const cancelledMs = getCancelledRideAgeTimestampMs(ride);

  // Si no tiene fecha real, lo dejamos visible para no borrar algo recién creado
  // por una versión antigua. Al volver a cancelar se guarda cancelledAt y expirará.
  if (cancelledMs == null) return false;

  return nowMs - cancelledMs >= CANCELLED_RIDE_EXPIRATION_MS;
}

function purgeExpiredCancelledRideRecords<T extends Partial<RideRequestData> & Record<string, unknown>>(
  rides: T[],
  nowMs = Date.now(),
): T[] {
  return rides.filter((ride) => !isExpiredCancelledRideRecord(ride, nowMs));
}


function isDriverCancelledRequeuedRide(ride: RideRequestData & Record<string, unknown>): boolean {
  const status = String(ride.status ?? "").toLowerCase();
  const cancelledBy = String(ride.cancelledByRole ?? ride.cancelledBy ?? "").toLowerCase();
  const reason = String(ride.requeuedReason ?? ride.requeueReason ?? ride.cancellationReason ?? "").toLowerCase();
  const notice = String(ride.passengerNotice ?? ride.passengerNotification ?? ride.notes ?? "").toLowerCase();

  if (cancelledBy.includes("passenger") || cancelledBy.includes("pasajero")) return false;
  if (hasPassengerCancelledRideMarker(ride)) return false;

  return (
    (status === "requested" || status === "cancelled") &&
    (
      (ride as Record<string, unknown>).forceActiveAfterDriverCancel === true ||
      reason.includes("driver_cancelled") ||
      reason.includes("conductor_cancel") ||
      notice.includes("tu conductor cancel") ||
      notice.includes("estamos buscando uno nuevo") ||
      cancelledBy.includes("driver") ||
      cancelledBy.includes("conductor") ||
      reason.includes("driver") ||
      reason.includes("conductor")
    )
  );
}

function shouldUseNextRideForDedupe(
  previous: RideRequestData & Record<string, unknown>,
  next: RideRequestData & Record<string, unknown>,
): boolean {
  // Si el conductor canceló, el viaje queda re-encolado como requested.
  // El backend puede seguir devolviendo el mismo viaje como cancelled; no debe ganar
  // sobre la copia re-encolada, porque el pasajero debe volver a ver "Buscando conductor".
  if (isDriverCancelledRequeuedRide(next)) return true;
  if (isDriverCancelledRequeuedRide(previous) && String(next.status ?? "") === "cancelled") return false;

  return true;
}

function dedupeRideList<T extends RideRequestData & Record<string, unknown>>(rides: T[]): T[] {
  const byKey = new Map<string, T>();

  for (const ride of rides) {
    const id = String(ride.id ?? "").trim();
    const key = getRideDedupeKey(ride) || id;
    if (!key) continue;

    const previous = byKey.get(key);

    if (!previous) {
      byKey.set(key, ride);
      continue;
    }

    const useNext = shouldUseNextRideForDedupe(previous, ride);

    byKey.set(key, {
      ...(useNext ? previous : ride),
      ...(useNext ? ride : previous),
      id: String(previous.id ?? ride.id ?? `local-${Date.now()}`),
    } as T);
  }

  return purgeExpiredCancelledRideRecords(Array.from(byKey.values()));
}

function readAdminScheduledRideBridge(): Array<RideRequestData & Record<string, unknown>> {
  const all: Array<RideRequestData & Record<string, unknown>> = [];

  try {
    for (const key of RAPAGO_ADMIN_SCHEDULED_EXTRA_KEYS) {
      const raw = localStorage.getItem(key);
      const parsed = raw ? (JSON.parse(raw) as Array<RideRequestData & Record<string, unknown>>) : [];
      if (Array.isArray(parsed)) all.push(...parsed);
    }
  } catch {
    return [];
  }

  return purgeExpiredCancelledRideRecords(dedupeRideList(all));
}

function saveAdminScheduledRideBridge(rides: Array<RideRequestData & Record<string, unknown>>): void {
  try {
    const deduped = purgeExpiredCancelledRideRecords(dedupeRideList(rides)).slice(0, 200);

    for (const key of RAPAGO_ADMIN_SCHEDULED_EXTRA_KEYS) {
      localStorage.setItem(key, JSON.stringify(deduped));
    }

    if (deduped[0]) {
      localStorage.setItem("rapago_last_scheduled_ride_for_admin", JSON.stringify(deduped[0]));
    }

    window.dispatchEvent(new CustomEvent(RAPAGO_ADMIN_SCHEDULED_RIDES_EVENT, { detail: { rides: deduped } }));
  } catch {
    // No bloquea Mis Viajes.
  }
}

function getRideAnyField(ride: RideRequestData, key: string): unknown {
  return (ride as RideRequestData & Record<string, unknown>)[key];
}

function normalizePassengerEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function getPassengerSessionEmail(user: unknown): string {
  if (!user || typeof user !== "object") return "";
  return normalizePassengerEmail((user as Record<string, unknown>).email);
}

function readPassengerVisibleScheduledBridgeRides(user: unknown): RideRequestData[] {
  const sessionEmail = getPassengerSessionEmail(user);
  const bridge = readAdminScheduledRideBridge();

  return bridge.filter((ride) => {
    const passengerEmail = normalizePassengerEmail(ride.passengerEmail);

    // En producción debe venir el correo del pasajero. En desarrollo dejamos pasar
    // los registros sin correo para no perder la reserva local recién creada.
    return !sessionEmail || !passengerEmail || passengerEmail === sessionEmail;
  }) as RideRequestData[];
}

function readPassengerVisibleRequeuedRides(user: unknown): RideRequestData[] {
  try {
    const sessionEmail = getPassengerSessionEmail(user);
    const all: Array<RideRequestData & Record<string, unknown>> = [];

    for (const key of [RAPAGO_REQUEUED_RIDES_KEY, RAPAGO_REQUEUED_PASSENGER_FORCE_KEY]) {
      const raw = localStorage.getItem(key);
      const parsed = raw ? (JSON.parse(raw) as Array<RideRequestData & Record<string, unknown>>) : [];
      if (Array.isArray(parsed)) all.push(...parsed);
    }

    const rides = purgeExpiredCancelledRideRecords(dedupeRideList(all));

    return rides
      .filter((ride) => {
        const passengerEmail = normalizePassengerEmail(ride.passengerEmail);
        return !sessionEmail || !passengerEmail || passengerEmail === sessionEmail;
      })
      .map((ride) => ({
        ...(ride as RideRequestData & Record<string, unknown>),
        status: "requested",
        cancelledAt: null,
        cancelledByRole: null,
        cancellationReason: null,
        forceActiveAfterDriverCancel: true,
        driverName: null,
        driverPhone: null,
        driverVehicleBrand: null,
        driverVehicleModel: null,
        driverVehicleColor: null,
        driverVehiclePlate: null,
        driverVehicleYear: null,
        driverVehicleImageDataUrl: null,
        acceptedAt: null,
        enRouteAt: null,
        arrivedAt: null,
        startedAt: null,
        passengerNotice:
          (ride as RideRequestData & Record<string, unknown>).passengerNotice ??
          "Tu conductor canceló el viaje, estamos buscando uno nuevo.",
        passengerNotification:
          (ride as RideRequestData & Record<string, unknown>).passengerNotification ??
          "Tu conductor canceló el viaje, estamos buscando uno nuevo.",
        requeuedReason: "driver_cancelled",
      })) as RideRequestData[];
  } catch {
    return [];
  }
}

function upsertRequeuedRideIntoPassengerLocalStorage(ride: RideRequestData): void {
  try {
    const current = readLocalPassengerRides();
    const key = getRideDedupeKey(ride as RideRequestData & Record<string, unknown>);
    const next = [
      ride,
      ...current.filter((item) => getRideDedupeKey(item as RideRequestData & Record<string, unknown>) !== key && item.id !== ride.id),
    ].slice(0, 200);

    // Importante: esta función se ejecuta dentro de loadRides().
    // Si vuelve a disparar rapago:passenger-rides-updated de forma síncrona,
    // TripsPage entra en bucle: loadRides -> upsert -> save -> event -> loadRides.
    const currentJson = JSON.stringify(current.slice(0, 200));
    const nextJson = JSON.stringify(next);
    if (currentJson === nextJson) return;

    saveLocalPassengerRides(next, { notify: false });
  } catch {
    // No bloquea Mis Viajes.
  }
}

function getRideDateForSort(ride: RideRequestData & Record<string, unknown>): number {
  const candidates = [
    ride.scheduledPickupAt,
    ride.scheduledAt,
    ride.requestedAt,
    ride.createdAt,
    ride.acceptedAt,
    ride.startedAt,
    ride.completedAt,
    ride.cancelledAt,
  ];

  for (const candidate of candidates) {
    const time = new Date(String(candidate ?? "")).getTime();
    if (Number.isFinite(time)) return time;
  }

  return 0;
}


function syncScheduledRidesToAdminBridge(rides: RideRequestData[]): void {
  const scheduled = rides
    .filter((ride) => isStoredScheduledRide(ride as RideRequestData & Record<string, unknown>))
    .map((ride) => ({
      ...(ride as RideRequestData & Record<string, unknown>),
      isScheduled: true,
      adminScheduleStatus:
        (ride as RideRequestData & Record<string, unknown>).adminScheduleStatus ?? "pending_admin",
      adminBridgeSource:
        (ride as RideRequestData & Record<string, unknown>).adminBridgeSource ?? "passenger_trips",
      adminBridgeUpdatedAt: new Date().toISOString(),
    }));

  if (scheduled.length === 0) return;

  saveAdminScheduledRideBridge([...scheduled, ...readAdminScheduledRideBridge()]);
}

const PASSENGER_CANCEL_STORAGE_KEYS = [
  LOCAL_PASSENGER_RIDES_KEY,
  RAPAGO_REQUEUED_RIDES_KEY,
  RAPAGO_REQUEUED_PASSENGER_FORCE_KEY,
  "rapago_admin_scheduled_rides",
  "rapago_admin_scheduled_rides_v1",
  "rapago_admin_scheduled_rides_v2",
  "rapago_admin_scheduled_rides_force_v1",
  "rapago_bridge_scheduled_rides_v1",
  "rapago_last_scheduled_ride_for_admin",
  "rapago_driver_available_rides_v1",
  "rapago_bridge_available_rides_v1",
] as const;

function normalizePassengerCancelText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getPassengerCancelIds(ride: Partial<RideRequestData> & Record<string, unknown>): Set<string> {
  return new Set(
    [ride.id, ride.originalRideId, ride.rideId, ride.serverRideId]
      .map((value) => String(value ?? "").trim())
      .filter(Boolean),
  );
}

function getPassengerCancelRouteKey(ride: Partial<RideRequestData> & Record<string, unknown>): string {
  return [
    normalizePassengerCancelText(ride.originText),
    normalizePassengerCancelText(ride.destinationText),
    String(ride.estimatedFareClp ?? ride.fareClp ?? ride.priceClp ?? "").trim(),
  ].join("|");
}

function getPassengerCancelScheduleKey(ride: Partial<RideRequestData> & Record<string, unknown>): string {
  return String(
    ride.scheduledAt ??
      ride.scheduledPickupAt ??
      ride.pickupScheduledAt ??
      ride.returnScheduledAt ??
      ride.requestedAt ??
      ride.createdAt ??
      "",
  ).trim();
}

function isSamePassengerRideCancelTarget(
  candidate: Partial<RideRequestData> & Record<string, unknown>,
  target: Partial<RideRequestData> & Record<string, unknown>,
): boolean {
  const candidateIds = getPassengerCancelIds(candidate);
  const targetIds = getPassengerCancelIds(target);

  for (const id of candidateIds) {
    if (targetIds.has(id)) return true;
  }

  const candidateRoute = getPassengerCancelRouteKey(candidate);
  const targetRoute = getPassengerCancelRouteKey(target);
  if (!candidateRoute || !targetRoute || candidateRoute !== targetRoute) return false;

  const candidateEmail = normalizePassengerCancelText(candidate.passengerEmail);
  const targetEmail = normalizePassengerCancelText(target.passengerEmail);
  if (candidateEmail && targetEmail && candidateEmail !== targetEmail) return false;

  const candidateSchedule = getPassengerCancelScheduleKey(candidate);
  const targetSchedule = getPassengerCancelScheduleKey(target);
  if (candidateSchedule && targetSchedule && candidateSchedule !== targetSchedule) return false;

  // En desarrollo local los viajes reencolados pueden cambiar de id al pasar por
  // backend/localStorage. Si el origen, destino y precio coinciden, es el mismo viaje.
  return true;
}

function isPassengerRideCancelledByPassenger(ride: Partial<RideRequestData> & Record<string, unknown>): boolean {
  const status = String(ride.status ?? "").toLowerCase();
  const cancelledBy = normalizePassengerCancelText(ride.cancelledByRole ?? ride.cancelledBy);
  const reason = normalizePassengerCancelText(ride.cancellationReason ?? ride.cancelReason ?? ride.notes);

  return (
    status === "cancelled" &&
    (
      cancelledBy.includes("passenger") ||
      cancelledBy.includes("pasajero") ||
      reason.includes("cancelado por pasajero") ||
      reason.includes("cancelado por usuario") ||
      reason.includes("usuario cancelo") ||
      reason.includes("pasajero cancelo")
    )
  );
}

function hasPassengerCancelledRideMarker(target: Partial<RideRequestData> & Record<string, unknown>): boolean {
  try {
    return readLocalPassengerRides().some((ride) =>
      isPassengerRideCancelledByPassenger(ride as RideRequestData & Record<string, unknown>) &&
      isSamePassengerRideCancelTarget(ride as RideRequestData & Record<string, unknown>, target),
    );
  } catch {
    return false;
  }
}

function buildPassengerCancelledRide(ride: RideRequestData): RideRequestData {
  const now = new Date().toISOString();

  return {
    ...(ride as RideRequestData & Record<string, unknown>),
    status: "cancelled",
    cancelledAt: now,
    cancelledByRole: "passenger",
    cancelledBy: "passenger",
    cancellationReason: "Cancelado por pasajero.",
    requeuedReason: null,
    forceActiveAfterDriverCancel: false,
    passengerNotice: null,
    passengerNotification: null,
    driverName: null,
    driverPhone: null,
    driverVehicleBrand: null,
    driverVehicleModel: null,
    driverVehicleColor: null,
    driverVehiclePlate: null,
    driverVehicleYear: null,
  } as RideRequestData;
}

function readRideArrayStorage(key: string): Array<RideRequestData & Record<string, unknown>> {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as Array<RideRequestData & Record<string, unknown>>) : [];
    if (!Array.isArray(parsed)) return [];

    const cleaned = purgeExpiredCancelledRideRecords(parsed);

    if (cleaned.length !== parsed.length) {
      localStorage.setItem(key, JSON.stringify(cleaned));
    }

    return cleaned;
  } catch {
    return [];
  }
}

function writeRideArrayStorage(key: string, rides: Array<RideRequestData & Record<string, unknown>>): void {
  try {
    localStorage.setItem(key, JSON.stringify(purgeExpiredCancelledRideRecords(rides)));
  } catch {
    // No bloquea la cancelación local.
  }
}

function cleanupExpiredCancelledRidesEverywhere(): void {
  try {
    for (const key of PASSENGER_CANCEL_STORAGE_KEYS) {
      if (key === "rapago_last_scheduled_ride_for_admin") {
        const raw = localStorage.getItem(key);
        const parsed = raw ? (JSON.parse(raw) as RideRequestData & Record<string, unknown>) : null;
        if (parsed && isExpiredCancelledRideRecord(parsed)) localStorage.removeItem(key);
        continue;
      }

      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as Array<RideRequestData & Record<string, unknown>>;
      if (!Array.isArray(parsed)) continue;

      const cleaned = purgeExpiredCancelledRideRecords(parsed);
      if (cleaned.length !== parsed.length) {
        localStorage.setItem(key, JSON.stringify(cleaned));
      }
    }
  } catch {
    // No bloquea Mis Viajes si algún registro antiguo está corrupto.
  }
}

function removePassengerRideFromArrayStorage(
  key: string,
  target: Partial<RideRequestData> & Record<string, unknown>,
): void {
  if (key === "rapago_last_scheduled_ride_for_admin") {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? (JSON.parse(raw) as RideRequestData & Record<string, unknown>) : null;
      if (parsed && isSamePassengerRideCancelTarget(parsed, target)) localStorage.removeItem(key);
    } catch {
      // No bloquea la cancelación local.
    }
    return;
  }

  const parsed = readRideArrayStorage(key);
  if (parsed.length === 0) return;
  writeRideArrayStorage(key, parsed.filter((ride) => !isSamePassengerRideCancelTarget(ride, target)));
}

function cancelPassengerRideEverywhere(target: RideRequestData): RideRequestData {
  const cancelled = buildPassengerCancelledRide(target);

  // Quita la solicitud de todas las colas donde aparece como reencolada/activa,
  // para que no vuelva a mostrarse como "Buscando conductor" al actualizar.
  for (const key of PASSENGER_CANCEL_STORAGE_KEYS) {
    if (key !== LOCAL_PASSENGER_RIDES_KEY) {
      removePassengerRideFromArrayStorage(key, cancelled as RideRequestData & Record<string, unknown>);
    }
  }

  const local = readLocalPassengerRides();
  let found = false;

  const nextLocal = local.map((ride) => {
    if (!isSamePassengerRideCancelTarget(ride as RideRequestData & Record<string, unknown>, cancelled as RideRequestData & Record<string, unknown>)) {
      return ride;
    }

    found = true;
    return {
      ...ride,
      ...cancelled,
      id: ride.id || cancelled.id,
      originalRideId:
        (ride as RideRequestData & Record<string, unknown>).originalRideId ??
        (cancelled as RideRequestData & Record<string, unknown>).originalRideId ??
        cancelled.id,
    } as RideRequestData;
  });

  if (!found) nextLocal.unshift(cancelled);

  saveLocalPassengerRides(purgeExpiredCancelledRideRecords(dedupeRideList(nextLocal as Array<RideRequestData & Record<string, unknown>>)).slice(0, 200) as RideRequestData[]);

  window.dispatchEvent(new CustomEvent("rapago:driver-available-rides-updated", { detail: { cancelled } }));
  window.dispatchEvent(new CustomEvent(RAPAGO_REQUEUED_RIDES_EVENT, { detail: { cancelled } }));

  return cancelled;
}

function applyPassengerCancelledRideToList(
  rides: RideRequestData[],
  target: RideRequestData,
  cancelled: RideRequestData,
): RideRequestData[] {
  let found = false;

  const next = rides.map((ride) => {
    if (!isSamePassengerRideCancelTarget(ride as RideRequestData & Record<string, unknown>, target as RideRequestData & Record<string, unknown>)) {
      return ride;
    }

    found = true;
    return {
      ...ride,
      ...cancelled,
      id: ride.id || cancelled.id,
      originalRideId:
        (ride as RideRequestData & Record<string, unknown>).originalRideId ??
        (cancelled as RideRequestData & Record<string, unknown>).originalRideId ??
        cancelled.id,
    } as RideRequestData;
  });

  if (!found) next.unshift(cancelled);

  return mergeRides(next, []);
}

function applyPassengerCancelInView(ride: RideRequestData, reason = "Cancelado por pasajero."): RideRequestData {
  return {
    ...ride,
    status: "cancelled",
    cancelledAt: new Date().toISOString(),
    cancelledByRole: "passenger",
    cancelledBy: "passenger",
    cancellationReason: reason,
    requeuedReason: null,
    forceActiveAfterDriverCancel: false,
    passengerNotice: null,
    passengerNotification: null,
  } as RideRequestData;
}

function isPassengerPermissionMessage(message: unknown): boolean {
  const text = String(message ?? "").toLowerCase();

  return (
    text.includes("403") ||
    text.includes("forbidden") ||
    text.includes("only passengers can access ride requests") ||
    text.includes("only passengers") ||
    text.includes("solo pasajeros") ||
    text.includes("unauthorized") ||
    text.includes("401") ||
    text.includes("token") ||
    text.includes("sesión") ||
    text.includes("session")
  );
}

function safeTripsErrorMessage(message: string | null): string | null {
  if (!message) return null;

  if (isPassengerPermissionMessage(message)) {
    // No mostramos el error técnico cuando el usuario conductor cambió a vista pasajero.
    // El backend debe permitir driver/admin en rutas de pasajero para operación real.
    return null;
  }

  return message;
}

function readLocalPassengerRides(): RideRequestData[] {
  try {
    const raw = localStorage.getItem(LOCAL_PASSENGER_RIDES_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as RideRequestData[];
    if (!Array.isArray(parsed)) return [];

    const cleaned = purgeExpiredCancelledRideRecords(
      parsed.map((ride) => ride as RideRequestData & Record<string, unknown>),
    ) as RideRequestData[];

    if (cleaned.length !== parsed.length) {
      localStorage.setItem(LOCAL_PASSENGER_RIDES_KEY, JSON.stringify(cleaned.slice(0, 200)));
    }

    return cleaned;
  } catch {
    return [];
  }
}

function saveLocalPassengerRides(
  rides: RideRequestData[],
  options: { notify?: boolean } = {},
): void {
  try {
    const cleaned = purgeExpiredCancelledRideRecords(
      rides.map((ride) => ride as RideRequestData & Record<string, unknown>),
    ) as RideRequestData[];
    const nextJson = JSON.stringify(cleaned.slice(0, 200));
    const previousJson = localStorage.getItem(LOCAL_PASSENGER_RIDES_KEY) ?? "";

    if (previousJson === nextJson) return;

    localStorage.setItem(LOCAL_PASSENGER_RIDES_KEY, nextJson);

    // Dispara el evento fuera del stack actual para evitar recursión inmediata
    // cuando TripsPage se refresca después de una cancelación del conductor.
    if (options.notify !== false) {
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent("rapago:passenger-rides-updated"));
      }, 0);
    }
  } catch {
    // No bloquea la pantalla si localStorage no está disponible.
  }
}


type PassengerAcceptedDriverBridgeRecord = RideRequestData & Record<string, unknown>;

const PASSENGER_ACCEPTED_DRIVER_BRIDGE_MAP_KEY = "rapago_driver_accepted_vehicle_by_ride_v1";
const PASSENGER_LAST_ACCEPTED_DRIVER_RIDE_KEY = "rapago_last_accepted_ride";

function passengerBridgeClean(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function passengerBridgeIds(ride: Partial<RideRequestData> & Record<string, unknown>): Set<string> {
  return new Set(
    [ride.id, ride.rideId, ride.originalRideId, ride.serverRideId]
      .map((value) => String(value ?? "").trim())
      .filter(Boolean),
  );
}

function isSamePassengerDriverBridgeRide(
  candidate: Partial<RideRequestData> & Record<string, unknown>,
  target: Partial<RideRequestData> & Record<string, unknown>,
): boolean {
  const candidateIds = passengerBridgeIds(candidate);
  const targetIds = passengerBridgeIds(target);

  for (const id of candidateIds) {
    if (targetIds.has(id)) return true;
  }

  const candidateOrigin = passengerBridgeClean(candidate.originText);
  const targetOrigin = passengerBridgeClean(target.originText);
  const candidateDestination = passengerBridgeClean(candidate.destinationText);
  const targetDestination = passengerBridgeClean(target.destinationText);

  if (!candidateOrigin || !targetOrigin || candidateOrigin !== targetOrigin) return false;
  if (!candidateDestination || !targetDestination || candidateDestination !== targetDestination) return false;

  const candidateEmail = passengerBridgeClean(candidate.passengerEmail);
  const targetEmail = passengerBridgeClean(target.passengerEmail);
  if (candidateEmail && targetEmail && candidateEmail !== targetEmail) return false;

  const candidateSchedule = passengerBridgeClean(
    candidate.scheduledAt ?? candidate.scheduledPickupAt ?? candidate.pickupScheduledAt ?? candidate.requestedAt ?? candidate.createdAt,
  );
  const targetSchedule = passengerBridgeClean(
    target.scheduledAt ?? target.scheduledPickupAt ?? target.pickupScheduledAt ?? target.requestedAt ?? target.createdAt,
  );

  return !candidateSchedule || !targetSchedule || candidateSchedule === targetSchedule;
}

function readPassengerAcceptedDriverBridgeRecords(): PassengerAcceptedDriverBridgeRecord[] {
  const records: PassengerAcceptedDriverBridgeRecord[] = [];

  try {
    const rawMap = localStorage.getItem(PASSENGER_ACCEPTED_DRIVER_BRIDGE_MAP_KEY);
    const parsedMap = rawMap ? (JSON.parse(rawMap) as Record<string, PassengerAcceptedDriverBridgeRecord>) : {};
    if (parsedMap && typeof parsedMap === "object" && !Array.isArray(parsedMap)) {
      records.push(...Object.values(parsedMap).filter(Boolean));
    }
  } catch {
    // No bloquea Mis Viajes.
  }

  try {
    const rawLast = localStorage.getItem(PASSENGER_LAST_ACCEPTED_DRIVER_RIDE_KEY);
    const parsedLast = rawLast ? (JSON.parse(rawLast) as { ride?: PassengerAcceptedDriverBridgeRecord } & PassengerAcceptedDriverBridgeRecord) : null;
    const ride = parsedLast?.ride ?? parsedLast;
    if (ride && typeof ride === "object") records.push(ride as PassengerAcceptedDriverBridgeRecord);
  } catch {
    // No bloquea Mis Viajes.
  }

  try {
    const rawLiveMap = localStorage.getItem(RAPAGO_DRIVER_LIVE_LOCATION_KEY);
    const liveMap = rawLiveMap ? (JSON.parse(rawLiveMap) as Record<string, PassengerAcceptedDriverBridgeRecord>) : {};
    if (liveMap && typeof liveMap === "object" && !Array.isArray(liveMap)) {
      records.push(...Object.values(liveMap).filter(Boolean));
    }

    const rawCurrent = localStorage.getItem("rapago_current_driver_location");
    const current = rawCurrent ? (JSON.parse(rawCurrent) as PassengerAcceptedDriverBridgeRecord) : null;
    if (current && typeof current === "object") records.push(current);
  } catch {
    // No bloquea Mis Viajes.
  }

  const seen = new Set<string>();
  return records.filter((item) => {
    const key =
      String(item.id ?? item.rideId ?? item.originalRideId ?? "").trim() ||
      [
        passengerBridgeClean(item.originText),
        passengerBridgeClean(item.destinationText),
        passengerBridgeClean(item.passengerEmail),
        passengerBridgeClean(item.scheduledAt ?? item.scheduledPickupAt ?? item.requestedAt),
        passengerBridgeClean(item.driverEmail ?? item.driverName),
      ].join("|");

    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getPassengerDriverBridgeScore(ride: PassengerAcceptedDriverBridgeRecord): number {
  let score = 0;
  const status = passengerBridgeClean(ride.status);
  if (status === "driver_en_route") score += 80;
  if (status === "accepted") score += 60;
  if (ride.scheduledReservationNavigationStarted === true || ride.driverStartedScheduledReservation === true) score += 100;
  if (ride.driverName || ride.driverFullName) score += 20;
  if (ride.driverPhone) score += 10;
  if (ride.driverVehicleBrand || ride.vehicleBrand) score += 20;
  if (ride.driverVehicleModel || ride.vehicleModel) score += 20;
  if (ride.driverVehiclePlate || ride.vehiclePlate) score += 20;
  if (ride.driverVehicleImageDataUrl || ride.vehicleImageDataUrl || ride.vehiclePhotoDataUrl) score += 25;
  const updatedMs = new Date(String(ride.navigationStartedAt ?? ride.driverStartedScheduledReservationAt ?? ride.driverAcceptedScheduleAt ?? ride.updatedAt ?? ride.acceptedAt ?? ride.createdAt ?? "")).getTime();
  if (Number.isFinite(updatedMs)) score += Math.min(30, Math.max(0, (updatedMs - Date.now() + 24 * 60 * 60 * 1000) / (60 * 60 * 1000)));
  return score;
}

function findPassengerAcceptedDriverBridgeForRide(
  ride: RideRequestData & Record<string, unknown>,
): PassengerAcceptedDriverBridgeRecord | null {
  const records = readPassengerAcceptedDriverBridgeRecords()
    .filter((candidate) => isSamePassengerDriverBridgeRide(candidate, ride))
    .sort((a, b) => getPassengerDriverBridgeScore(b) - getPassengerDriverBridgeScore(a));

  return records[0] ?? null;
}

function bridgeHasDriverData(bridge: PassengerAcceptedDriverBridgeRecord | null): boolean {
  if (!bridge) return false;
  return Boolean(
    bridge.driverName ||
      bridge.driverFullName ||
      bridge.driverPhone ||
      bridge.driverVehicleBrand ||
      bridge.vehicleBrand ||
      bridge.driverVehicleModel ||
      bridge.vehicleModel ||
      bridge.driverVehiclePlate ||
      bridge.vehiclePlate ||
      bridge.driverVehicleImageDataUrl ||
      bridge.vehicleImageDataUrl ||
      bridge.driverProfileImageDataUrl ||
      bridge.driverProfilePhotoUrl,
  );
}

function enrichPassengerRideWithAcceptedDriverBridge<T extends RideRequestData & Record<string, unknown>>(ride: T): T {
  const bridge = findPassengerAcceptedDriverBridgeForRide(ride);
  if (!bridge || !bridgeHasDriverData(bridge)) return ride;

  const bridgeStatus = passengerBridgeClean(bridge.status);
  const started =
    bridge.scheduledReservationNavigationStarted === true ||
    bridge.driverStartedScheduledReservation === true ||
    bridge.driverAssignmentStatus === "assigned_driver_started_route" ||
    bridgeStatus === "driver_en_route" ||
    Boolean(bridge.enRouteAt) ||
    Boolean(bridge.navigationStartedAt);

  const confirmed =
    started ||
    bridgeStatus === "accepted" ||
    bridge.driverScheduleResponse === "accepted" ||
    bridge.scheduledDriverResponse === "accepted" ||
    Boolean(bridge.driverAcceptedScheduleAt) ||
    Boolean(bridge.acceptedAt);

  const nextStatus = started
    ? "driver_en_route"
    : confirmed
      ? "driver_scheduled"
      : String(ride.status ?? bridge.status ?? "requested");

  return {
    ...ride,
    ...bridge,
    id: ride.id ?? bridge.id,
    originalRideId:
      (ride as Record<string, unknown>).originalRideId ??
      bridge.originalRideId ??
      bridge.id ??
      ride.id,
    status: nextStatus,
    driverName: bridge.driverName ?? bridge.driverFullName ?? ride.driverName,
    driverFullName: bridge.driverFullName ?? bridge.driverName ?? (ride as Record<string, unknown>).driverFullName,
    driverPhone: bridge.driverPhone ?? (ride as Record<string, unknown>).driverPhone,
    driverEmail: bridge.driverEmail ?? (ride as Record<string, unknown>).driverEmail,
    driverProfileImageDataUrl:
      bridge.driverProfileImageDataUrl ??
      bridge.driverProfilePhotoUrl ??
      (ride as Record<string, unknown>).driverProfileImageDataUrl,
    driverProfilePhotoUrl:
      bridge.driverProfilePhotoUrl ??
      bridge.driverProfileImageDataUrl ??
      (ride as Record<string, unknown>).driverProfilePhotoUrl,
    driverVehicleBrand:
      bridge.driverVehicleBrand ?? bridge.vehicleBrand ?? (ride as Record<string, unknown>).driverVehicleBrand,
    driverVehicleModel:
      bridge.driverVehicleModel ?? bridge.vehicleModel ?? (ride as Record<string, unknown>).driverVehicleModel,
    driverVehicleColor:
      bridge.driverVehicleColor ?? bridge.vehicleColor ?? (ride as Record<string, unknown>).driverVehicleColor,
    driverVehiclePlate:
      bridge.driverVehiclePlate ?? bridge.vehiclePlate ?? (ride as Record<string, unknown>).driverVehiclePlate,
    driverVehicleImageDataUrl:
      bridge.driverVehicleImageDataUrl ??
      bridge.driverVehiclePhotoDataUrl ??
      bridge.vehicleImageDataUrl ??
      bridge.vehiclePhotoDataUrl ??
      (ride as Record<string, unknown>).driverVehicleImageDataUrl,
    driverVehiclePhotoDataUrl:
      bridge.driverVehiclePhotoDataUrl ??
      bridge.driverVehicleImageDataUrl ??
      bridge.vehiclePhotoDataUrl ??
      bridge.vehicleImageDataUrl ??
      (ride as Record<string, unknown>).driverVehiclePhotoDataUrl,
    passengerNotice: started
      ? "Tu conductor ya va en camino al punto de recogida."
      : "Tu conductor fue asignado. Revisa sus datos y vehículo.",
    passengerNotification: started
      ? "Tu conductor ya va en camino al punto de recogida."
      : "Tu conductor fue asignado. Revisa sus datos y vehículo.",
  } as T;
}

function mergeRides(localRides: RideRequestData[], serverRides: RideRequestData[]): RideRequestData[] {
  const merged = dedupeRideList([
    ...localRides.map((ride) => ride as RideRequestData & Record<string, unknown>),
    ...serverRides.map((ride) => ride as RideRequestData & Record<string, unknown>),
  ]).map((ride) => enrichPassengerRideWithAcceptedDriverBridge(ride)) as RideRequestData[];

  const sorted = [...merged].sort((a, b) => {
    const aActive = ACTIVE_STATUSES.includes(getEffectivePassengerRideStatus(a)) ? 1 : 0;
    const bActive = ACTIVE_STATUSES.includes(getEffectivePassengerRideStatus(b)) ? 1 : 0;

    if (aActive !== bActive) return bActive - aActive;

    return getRideDateForSort(b as RideRequestData & Record<string, unknown>) - getRideDateForSort(a as RideRequestData & Record<string, unknown>);
  });

  syncScheduledRidesToAdminBridge(sorted);

  return sorted;
}


function StarRatingInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: "flex", gap: "4px", margin: "8px 0" }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} onClick={() => onChange(s)}
          style={{ fontSize: "1.6rem", cursor: "pointer", color: s <= value ? "#f4c430" : "#ccc" }}>
          ★
        </span>
      ))}
    </div>
  );
}


type PassengerRideNavPoints = {
  pickupLat: number | null;
  pickupLng: number | null;
  destinationLat: number | null;
  destinationLng: number | null;
  passengerOriginalLat: number | null;
  passengerOriginalLng: number | null;
  pickupWalkMeters: number | null;
};

function extractRideNumber(notes: string | null | undefined, regex: RegExp): number | null {
  if (!notes) return null;
  const match = notes.match(regex);
  if (!match?.[1]) return null;
  const parsed = Number(match[1].replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function formatClp(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return "$0 CLP";
  return `$${Math.round(Number(value)).toLocaleString("es-CL")} CLP`;
}

function extractMoneyAmount(value: string | null | undefined): number | null {
  if (!value) return null;
  const cleaned = value.replace(/\./g, "").replace(/,/g, ".");
  const match = cleaned.match(/\$?\s*(\d{3,7})(?:\s*CLP)?/i);
  if (!match?.[1]) return null;
  const amount = Number(match[1]);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount) : null;
}

function extractFareFromNotes(notes: string | null | undefined): number | null {
  if (!notes) return null;

  const patterns = [
    /Tarifa RAPA GO calculada:\s*\$?\s*([\d.,]+)\s*CLP/i,
    /Precio del viaje:\s*\$?\s*([\d.,]+)\s*CLP/i,
    /Forma de pago seleccionada:\s*[^.]*?\$\s*([\d.,]+)\s*CLP/i,
    /Forma de pago:\s*[^.]*?\$\s*([\d.,]+)\s*CLP/i,
  ];

  for (const pattern of patterns) {
    const match = notes.match(pattern);
    if (match?.[1]) {
      const amount = extractMoneyAmount(match[1]);
      if (amount != null) return amount;
    }
  }

  return null;
}

function getRideDisplayFareClp(ride: RideRequestData): number | null {
  const noteFare = extractFareFromNotes(ride.notes);
  if (noteFare != null) return noteFare;

  if (ride.estimatedFareClp != null && Number.isFinite(Number(ride.estimatedFareClp))) {
    // Este valor viene guardado al crear el viaje usando las tarifas activas del admin.
    // No lo recalculamos aquí para que pasajero, conductor y admin vean exactamente lo mismo.
    return Math.round(Number(ride.estimatedFareClp));
  }

  return null;
}

function getRidePaymentMethodLabel(notes: string | null | undefined): string {
  const text = String(notes ?? "").toLowerCase();
  if (text.includes("tarjeta") || text.includes("prontopaga")) return "Tarjeta / ProntoPaga";
  if (text.includes("efectivo")) return "Efectivo";
  return "Pendiente";
}


type PassengerFareType = "resident" | "chilean" | "foreigner";

function normalizeRidePassengerFareType(value: unknown): PassengerFareType | null {
  const raw = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!raw) return null;

  if (
    raw.includes("turista chileno") ||
    raw.includes("chileno turista") ||
    raw.includes("chilena") ||
    raw.includes("chileno") ||
    raw.includes("chilean") ||
    raw.includes("no residente") ||
    raw.includes("no resident") ||
    raw.includes("non resident") ||
    raw === "cl" ||
    raw === "chile"
  ) {
    return "chilean";
  }

  if (
    raw.includes("turista extranjero") ||
    raw.includes("extranj") ||
    raw.includes("foreigner") ||
    raw.includes("foreign") ||
    raw.includes("ingles") ||
    raw.includes("english")
  ) {
    return "foreigner";
  }

  if (
    raw.includes("residente rapa nui") ||
    raw.includes("rapa nui") ||
    raw.includes("rapanui") ||
    raw.includes("resident") ||
    raw.includes("residente") ||
    raw.includes("local") ||
    raw === "true" ||
    raw === "1"
  ) {
    return "resident";
  }

  if (raw.includes("turista") || raw.includes("tourist") || raw.includes("visitor")) {
    return "foreigner";
  }

  return null;
}

function passengerFareTypeLabel(type: PassengerFareType): string {
  if (type === "resident") return "Residente Rapa Nui";
  if (type === "chilean") return "Turista chileno";
  return "Turista extranjero";
}

function getRidePassengerFareType(ride: RideRequestData): PassengerFareType | null {
  const record = ride as RideRequestData & Record<string, unknown>;
  const notes = String(ride.notes ?? "");
  const fromNotes =
    notes.match(/Tipo de pasajero tarifario:\s*([^.]*)\./i)?.[1] ??
    notes.match(/Tarifa pasajero:\s*([^.]*)\./i)?.[1] ??
    notes.match(/Nacionalidad:\s*([^.]*)\./i)?.[1];

  return (
    normalizeRidePassengerFareType(record.passengerFareType) ??
    normalizeRidePassengerFareType(record.farePassengerType) ??
    normalizeRidePassengerFareType(record.passengerType) ??
    normalizeRidePassengerFareType(record.passengerFareLabel) ??
    normalizeRidePassengerFareType(record.nationality) ??
    normalizeRidePassengerFareType(record.isResident) ??
    normalizeRidePassengerFareType(fromNotes)
  );
}

type RideFareBreakdown = {
  calculationType: string | null;
  urbanKm: number | null;
  ruralKm: number | null;
  urbanKmFareClp: number | null;
  ruralKmFareClp: number | null;
  ruralDiscountPercent: number | null;
};

function extractRideFareBreakdown(notes: string | null | undefined): RideFareBreakdown {
  const text = String(notes ?? "");

  return {
    calculationType:
      text.match(/Tipo de cálculo tarifario:\s*([^.]*)\./i)?.[1]?.trim() ?? null,
    urbanKm: extractRideNumber(text, /Tramo urbano calculado:\s*(\d+(?:[.,]\d+)?)\s*km/i),
    ruralKm: extractRideNumber(text, /Tramo rural calculado:\s*(\d+(?:[.,]\d+)?)\s*km/i),
    urbanKmFareClp: extractMoneyAmount(text.match(/KM urbano ajustado:\s*(\$?\s*[\d.,]+\s*CLP)/i)?.[1]),
    ruralKmFareClp: extractMoneyAmount(text.match(/KM rural corregido:\s*(\$?\s*[\d.,]+\s*CLP)/i)?.[1]),
    ruralDiscountPercent: extractRideNumber(text, /descuento rural\s*(\d+(?:[.,]\d+)?)%/i),
  };
}

function extractPassengerRideNav(notes: string | null | undefined): PassengerRideNavPoints {
  return {
    pickupLat:
      extractRideNumber(notes, /Coordenadas recogida accesible:\s*(-?\d+(?:[.,]\d+)?)/i) ??
      extractRideNumber(notes, /RAPAGO_PICKUP_LAT:\s*(-?\d+(?:[.,]\d+)?)/i),
    pickupLng:
      extractRideNumber(notes, /Coordenadas recogida accesible:\s*-?\d+(?:[.,]\d+)?,\s*(-?\d+(?:[.,]\d+)?)/i) ??
      extractRideNumber(notes, /RAPAGO_PICKUP_LNG:\s*(-?\d+(?:[.,]\d+)?)/i),
    destinationLat:
      extractRideNumber(notes, /Coordenadas destino accesible:\s*(-?\d+(?:[.,]\d+)?)/i) ??
      extractRideNumber(notes, /RAPAGO_DEST_LAT:\s*(-?\d+(?:[.,]\d+)?)/i),
    destinationLng:
      extractRideNumber(notes, /Coordenadas destino accesible:\s*-?\d+(?:[.,]\d+)?,\s*(-?\d+(?:[.,]\d+)?)/i) ??
      extractRideNumber(notes, /RAPAGO_DEST_LNG:\s*(-?\d+(?:[.,]\d+)?)/i),
    passengerOriginalLat:
      extractRideNumber(notes, /Ubicación real del pasajero:\s*(-?\d+(?:[.,]\d+)?)/i) ??
      extractRideNumber(notes, /RAPAGO_PASSENGER_LAT:\s*(-?\d+(?:[.,]\d+)?)/i),
    passengerOriginalLng:
      extractRideNumber(notes, /Ubicación real del pasajero:\s*-?\d+(?:[.,]\d+)?,\s*(-?\d+(?:[.,]\d+)?)/i) ??
      extractRideNumber(notes, /RAPAGO_PASSENGER_LNG:\s*(-?\d+(?:[.,]\d+)?)/i),
    pickupWalkMeters:
      extractRideNumber(notes, /camina(?:r)?\s+aprox\.?\s*(\d+(?:[.,]\d+)?)\s*m/i) ??
      extractRideNumber(notes, /RAPAGO_WALK_METERS:\s*(\d+(?:[.,]\d+)?)/i),
  };
}

function cleanRideNotes(notes: string | null | undefined): string | null {
  if (!notes) return null;

  return notes
    .replace(/Dirección origen confirmada:.*?(?=Dirección destino confirmada:|$)/i, "")
    .replace(/Dirección destino confirmada:.*?(?=Ubicación real del pasajero:|Coordenadas recogida accesible:|$)/i, "")
    .replace(/Ubicación real del pasajero:.*?(?=Punto accesible de recogida|Coordenadas recogida accesible:|$)/i, "")
    .replace(/Punto accesible de recogida ajustado a calle\..*?(?=Coordenadas recogida accesible:|$)/i, "")
    .replace(/Coordenadas recogida accesible:.*?(?=Coordenadas destino accesible:|$)/i, "")
    .replace(/Coordenadas destino accesible:.*?(?=Tarifa RAPA GO calculada:|Kilómetros calculados:|Ganancia aprox\. conductor:|Forma de pago|$)/i, "")
    .replace(/Tarifa RAPA GO calculada:.*?(?=Kilómetros calculados:|Ganancia aprox\. conductor:|Forma de pago|$)/i, "")
    .replace(/Kilómetros calculados:.*?(?=Ganancia aprox\. conductor:|Forma de pago|$)/i, "")
    .replace(/Tipo de cálculo tarifario:.*?(?=Tramo urbano calculado:|Ganancia estimada conductor:|Ganancia aprox\. conductor:|Forma de pago|$)/i, "")
    .replace(/Tipo de pasajero tarifario:.*?(?=Tipo de viaje tarifario:|Tramo urbano calculado:|Ganancia estimada conductor:|Ganancia aprox\. conductor:|Forma de pago|$)/i, "")
    .replace(/Tipo de viaje tarifario:.*?(?=Tramo urbano calculado:|Ganancia estimada conductor:|Ganancia aprox\. conductor:|Forma de pago|$)/i, "")
    .replace(/Tarifa estimada pasajero:.*?(?=Distancia estimada:|Duración estimada:|Tipo de cálculo tarifario:|Forma de pago|$)/i, "")
    .replace(/Tramo urbano calculado:.*?(?=Tramo rural calculado:|KM urbano ajustado:|Ganancia estimada conductor:|Ganancia aprox\. conductor:|Forma de pago|$)/i, "")
    .replace(/Tramo rural calculado:.*?(?=KM urbano ajustado:|Ganancia estimada conductor:|Ganancia aprox\. conductor:|Forma de pago|$)/i, "")
    .replace(/KM urbano ajustado:.*?(?=Ganancia estimada conductor:|Ganancia aprox\. conductor:|Forma de pago|$)/i, "")
    .replace(/Ganancia estimada conductor:.*?(?=Forma de pago|$)/i, "")
    .replace(/Ganancia aprox\. conductor:.*?(?=Forma de pago|$)/i, "")
    .replace(/Forma de pago seleccionada:.*$/i, "")
    .replace(/Forma de pago:.*$/i, "")
    .trim() || null;
}

type DriverLivePoint = {
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  accuracy: number | null;
  updatedAt: string | null;
};

const RAPAGO_DRIVER_LIVE_LOCATION_KEY = "rapago_driver_live_locations_v1";
const RAPAGO_DRIVER_LIVE_LOCATION_EVENT = "rapago:driver-live-location-updated";

type PassengerLocalDriverLivePayload = {
  rideId?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  heading?: number | string | null;
  speed?: number | string | null;
  accuracy?: number | string | null;
  updatedAt?: string | null;
  driverName?: string | null;
  driverFullName?: string | null;
  driverEmail?: string | null;
  driverPhone?: string | null;
  driverPhoneNumber?: string | null;
  driverMobile?: string | null;
  driverProfileImageDataUrl?: string | null;
  driverProfilePhotoUrl?: string | null;
  driverPhotoUrl?: string | null;
  profilePhotoUrl?: string | null;
  driverVehicleBrand?: string | null;
  driverVehicleModel?: string | null;
  driverVehicleColor?: string | null;
  driverVehiclePlate?: string | null;
  driverVehicleYear?: string | number | null;
  driverVehicleImageDataUrl?: string | null;
  driverVehicleImageName?: string | null;
  // Aliases usados por distintas versiones del driver/perfil.
  vehicleBrand?: string | null;
  vehicleModel?: string | null;
  vehicleColor?: string | null;
  vehiclePlate?: string | null;
  vehicleImageDataUrl?: string | null;
  vehiclePhotoDataUrl?: string | null;
  driverVehiclePhotoDataUrl?: string | null;
};

function toPassengerLiveNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizePassengerLocalDriverLivePoint(value: unknown): DriverLivePoint | null {
  if (!value || typeof value !== "object") return null;

  const data = value as PassengerLocalDriverLivePayload;
  const lat = toPassengerLiveNumber(data.lat);
  const lng = toPassengerLiveNumber(data.lng);

  if (lat == null || lng == null) return null;

  return {
    lat,
    lng,
    heading: toPassengerLiveNumber(data.heading),
    speed: toPassengerLiveNumber(data.speed),
    accuracy: toPassengerLiveNumber(data.accuracy),
    updatedAt: data.updatedAt ?? new Date().toISOString(),
  };
}


const PASSENGER_DRIVER_VEHICLES_STORAGE_KEY = "rapago_driver_vehicles_v1";
const PASSENGER_DRIVER_SELECTED_VEHICLE_STORAGE_KEY = "rapago_driver_selected_vehicle_v1";

type PassengerStoredDriverVehicle = {
  id?: string | null;
  ownerKey?: string | null;
  ownership?: string | null;
  brand?: string | null;
  model?: string | null;
  plate?: string | null;
  color?: string | null;
  label?: string | null;
  imageDataUrl?: string | null;
  imageName?: string | null;
  createdAt?: string | null;
  expiresAt?: string | null;
};

function passengerCleanString(value: unknown): string {
  return String(value ?? "").trim();
}

function passengerNormalizeKey(value: unknown): string {
  return passengerCleanString(value)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function readPassengerStoredDriverVehicles(): PassengerStoredDriverVehicle[] {
  try {
    const raw = localStorage.getItem(PASSENGER_DRIVER_VEHICLES_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as PassengerStoredDriverVehicle[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readPassengerSelectedDriverVehicleIds(): string[] {
  try {
    const raw = localStorage.getItem(PASSENGER_DRIVER_SELECTED_VEHICLE_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, string | null>) : {};
    if (!parsed || typeof parsed !== "object") return [];
    return Object.values(parsed)
      .map((value) => passengerCleanString(value))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function isPassengerStoredVehicleExpired(vehicle: PassengerStoredDriverVehicle): boolean {
  if (vehicle.ownership !== "borrowed" || !vehicle.expiresAt) return false;
  const expires = new Date(vehicle.expiresAt).getTime();
  return Number.isFinite(expires) && expires <= Date.now();
}

function getPassengerStoredDriverVehicle(live?: PassengerLocalDriverLivePayload | null): PassengerStoredDriverVehicle | null {
  const vehicles = readPassengerStoredDriverVehicles().filter((vehicle) => !isPassengerStoredVehicleExpired(vehicle));
  if (vehicles.length === 0) return null;

  const selectedIds = new Set(readPassengerSelectedDriverVehicleIds());
  const selectedVehicles = vehicles.filter((vehicle) => vehicle.id && selectedIds.has(String(vehicle.id)));

  const liveKeys = [live?.driverEmail, live?.driverName, live?.driverFullName]
    .map(passengerNormalizeKey)
    .filter(Boolean);

  const byOwner = selectedVehicles.find((vehicle) => {
    const owner = passengerNormalizeKey(vehicle.ownerKey);
    return Boolean(owner && liveKeys.includes(owner));
  });
  if (byOwner) return byOwner;

  if (selectedVehicles.length === 1) return selectedVehicles[0];

  const anyByOwner = vehicles.find((vehicle) => {
    const owner = passengerNormalizeKey(vehicle.ownerKey);
    return Boolean(owner && liveKeys.includes(owner));
  });
  if (anyByOwner) return anyByOwner;

  if (selectedVehicles.length > 0) return selectedVehicles[0];

  // Fallback de desarrollo: si existe un solo vehículo registrado en este navegador,
  // se usa para que el pasajero no vea "modelo/patente no informado".
  if (vehicles.length === 1) return vehicles[0];

  return [...vehicles].sort((a, b) => {
    const at = new Date(String(a.createdAt ?? "")).getTime() || 0;
    const bt = new Date(String(b.createdAt ?? "")).getTime() || 0;
    return bt - at;
  })[0] ?? null;
}

function getPassengerLivePayloadScore(payload: PassengerLocalDriverLivePayload | null | undefined): number {
  if (!payload) return 0;
  let score = 0;
  if (payload.lat != null && payload.lng != null) score += 2;
  if (passengerCleanString(payload.driverName || payload.driverFullName)) score += 3;
  if (passengerCleanString(payload.driverProfileImageDataUrl || payload.driverProfilePhotoUrl || payload.driverPhotoUrl || payload.profilePhotoUrl)) score += 4;
  if (passengerCleanString(payload.driverVehicleBrand || payload.vehicleBrand)) score += 5;
  if (passengerCleanString(payload.driverVehicleModel || payload.vehicleModel)) score += 5;
  if (passengerCleanString(payload.driverVehiclePlate || payload.vehiclePlate)) score += 6;
  if (passengerCleanString(payload.driverVehicleColor || payload.vehicleColor)) score += 4;
  if (passengerCleanString(payload.driverVehicleImageDataUrl || payload.driverVehiclePhotoDataUrl || payload.vehicleImageDataUrl || payload.vehiclePhotoDataUrl)) score += 8;
  return score;
}

function mergePassengerLivePayloads(
  primary: PassengerLocalDriverLivePayload | null | undefined,
  secondary: PassengerLocalDriverLivePayload | null | undefined,
): PassengerLocalDriverLivePayload | null {
  if (!primary && !secondary) return null;
  return {
    ...(secondary ?? {}),
    ...(primary ?? {}),
    driverName: primary?.driverName ?? primary?.driverFullName ?? secondary?.driverName ?? secondary?.driverFullName ?? null,
    driverFullName: primary?.driverFullName ?? primary?.driverName ?? secondary?.driverFullName ?? secondary?.driverName ?? null,
    driverProfileImageDataUrl:
      primary?.driverProfileImageDataUrl ??
      primary?.driverProfilePhotoUrl ??
      primary?.driverPhotoUrl ??
      primary?.profilePhotoUrl ??
      secondary?.driverProfileImageDataUrl ??
      secondary?.driverProfilePhotoUrl ??
      secondary?.driverPhotoUrl ??
      secondary?.profilePhotoUrl ??
      null,
    driverProfilePhotoUrl:
      primary?.driverProfilePhotoUrl ??
      primary?.driverProfileImageDataUrl ??
      secondary?.driverProfilePhotoUrl ??
      secondary?.driverProfileImageDataUrl ??
      null,
    driverVehicleBrand:
      primary?.driverVehicleBrand ?? primary?.vehicleBrand ?? secondary?.driverVehicleBrand ?? secondary?.vehicleBrand ?? null,
    driverVehicleModel:
      primary?.driverVehicleModel ?? primary?.vehicleModel ?? secondary?.driverVehicleModel ?? secondary?.vehicleModel ?? null,
    driverVehicleColor:
      primary?.driverVehicleColor ?? primary?.vehicleColor ?? secondary?.driverVehicleColor ?? secondary?.vehicleColor ?? null,
    driverVehiclePlate:
      primary?.driverVehiclePlate ?? primary?.vehiclePlate ?? secondary?.driverVehiclePlate ?? secondary?.vehiclePlate ?? null,
    driverVehicleImageDataUrl:
      primary?.driverVehicleImageDataUrl ??
      primary?.driverVehiclePhotoDataUrl ??
      primary?.vehicleImageDataUrl ??
      primary?.vehiclePhotoDataUrl ??
      secondary?.driverVehicleImageDataUrl ??
      secondary?.driverVehiclePhotoDataUrl ??
      secondary?.vehicleImageDataUrl ??
      secondary?.vehiclePhotoDataUrl ??
      null,
  };
}

function readPassengerLocalDriverLivePoint(rideId: string): DriverLivePoint | null {
  try {
    const rawMap = localStorage.getItem(RAPAGO_DRIVER_LIVE_LOCATION_KEY);
    const map = rawMap ? (JSON.parse(rawMap) as Record<string, PassengerLocalDriverLivePayload>) : {};
    const fromMap = normalizePassengerLocalDriverLivePoint(map?.[rideId]);
    if (fromMap) return fromMap;

    // Fallback de desarrollo: cuando el backend/local mirror usa otro ID,
    // pero existe un solo GPS de conductor activo, lo usamos para que el pasajero vea el mapa.
    const candidates = Object.values(map ?? {}).filter(Boolean);
    if (candidates.length === 1) {
      const onlyPoint = normalizePassengerLocalDriverLivePoint(candidates[0]);
      if (onlyPoint) return onlyPoint;
    }

    const currentRaw = localStorage.getItem("rapago_current_driver_location");
    const current = currentRaw ? (JSON.parse(currentRaw) as PassengerLocalDriverLivePayload) : null;

    if (String(current?.rideId ?? "") === rideId || !current?.rideId) {
      const currentPoint = normalizePassengerLocalDriverLivePoint(current);
      if (currentPoint) return currentPoint;
    }

    // Último recurso en desarrollo: si hay una ubicación actual reciente, se muestra.
    const fallbackCurrent = normalizePassengerLocalDriverLivePoint(current);
    if (fallbackCurrent) return fallbackCurrent;
  } catch {
    return null;
  }

  return null;
}

function readPassengerLiveVehiclePayload(rideId: string): PassengerLocalDriverLivePayload | null {
  try {
    const rawMap = localStorage.getItem(RAPAGO_DRIVER_LIVE_LOCATION_KEY);
    const map = rawMap ? (JSON.parse(rawMap) as Record<string, PassengerLocalDriverLivePayload>) : {};
    const fromMap = map?.[rideId] ?? null;

    const candidates = Object.values(map ?? {}).filter(Boolean);

    const currentRaw = localStorage.getItem("rapago_current_driver_location");
    const current = currentRaw ? (JSON.parse(currentRaw) as PassengerLocalDriverLivePayload) : null;

    const sameRideCurrent = String(current?.rideId ?? "") === rideId || !current?.rideId ? current : null;
    const bestCandidate = [...candidates, current].filter(Boolean).sort(
      (a, b) => getPassengerLivePayloadScore(b) - getPassengerLivePayloadScore(a),
    )[0] ?? null;

    // Si el payload exacto del viaje trae GPS pero no trae vehículo, se fusiona con el
    // payload más completo del conductor. Esto evita que la ficha quede con "no informado".
    const merged = mergePassengerLivePayloads(fromMap ?? sameRideCurrent ?? bestCandidate, bestCandidate);
    return merged;
  } catch {
    return null;
  }
}




type PassengerVehicleDisplayData = {
  brand: string;
  model: string;
  color: string;
  plate: string;
  imageDataUrl: string | null;
  score: number;
};

function passengerStringValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") {
    const text = String(value).trim();
    const lower = text.toLowerCase();
    if (!text || lower === "null" || lower === "undefined" || lower === "modelo no informado" || lower === "patente no informada" || lower === "color no informado") return "";
    return text;
  }
  return "";
}

function passengerImageValue(...values: unknown[]): string | null {
  for (const value of values) {
    const text = passengerStringValue(value);
    if (
      text &&
      (text.startsWith("data:image/") ||
        text.startsWith("blob:") ||
        text.startsWith("http://") ||
        text.startsWith("https://"))
    ) {
      return text;
    }
  }
  return null;
}

function passengerFirstValue(...values: unknown[]): string {
  for (const value of values) {
    const text = passengerStringValue(value);
    if (text) return text;
  }
  return "";
}

function passengerReadJsonStorageValue(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return raw;
    }
  } catch {
    return null;
  }
}

function passengerReadStringStorageValue(...keys: string[]): string {
  try {
    for (const key of keys) {
      const value = localStorage.getItem(key);
      if (value && value.trim()) return value.trim();
    }
  } catch {
    // No bloquea Mis Viajes.
  }

  try {
    for (const key of keys) {
      const value = sessionStorage.getItem(key);
      if (value && value.trim()) return value.trim();
    }
  } catch {
    // No bloquea Mis Viajes.
  }

  return "";
}

function passengerReadCanonicalVehicleImageDataUrl(): string | null {
  return passengerImageValue(
    passengerReadStringStorageValue(
      "rapago_driver_vehicle_image_data_url",
      "rapago_driver_vehicle_photo",
      "rapago_vehicle_photo_data_url",
      "rapago_vehicle_image_data_url",
      "rapago_public_vehicle_image_data_url",
    ),
  );
}

function passengerReadCanonicalDriverProfileImageDataUrl(): string | null {
  return passengerImageValue(
    passengerReadStringStorageValue(
      "rapago_driver_profile_photo",
      "rapago_driver_profile_image_data_url",
      "rapago_driver_profile_photo_url",
      "rapago_driver_profile_image",
      "rapago_public_driver_profile_photo",
      "rapago_driver_photo",
      "rapago_profile_photo",
      "rapago_user_profile_photo",
      "rapago_driver_avatar_data_url",
      "rapago_driver_avatar_photo",
      "rapago_profile_image_data_url",
      "rapago_profile_photo_url",
      "rapago_public_driver_profile_image_data_url",
    ),
  );
}

function passengerReadStorageRawValue(key: string): unknown {
  try {
    const local = localStorage.getItem(key);
    if (local && local.trim()) {
      try {
        return JSON.parse(local) as unknown;
      } catch {
        return local;
      }
    }
  } catch {
    // No bloquea Mis Viajes.
  }

  try {
    const session = sessionStorage.getItem(key);
    if (session && session.trim()) {
      try {
        return JSON.parse(session) as unknown;
      } catch {
        return session;
      }
    }
  } catch {
    // No bloquea Mis Viajes.
  }

  return null;
}

function passengerLooksLikeVehiclePhotoKey(key: string): boolean {
  const lower = key.toLowerCase();
  return (
    lower.includes("vehicle") ||
    lower.includes("vehiculo") ||
    lower.includes("vehículo") ||
    lower.includes("car_") ||
    lower.includes("auto") ||
    lower.includes("patente") ||
    lower.includes("plate")
  );
}

function passengerLooksLikeProfilePhotoKey(key: string): boolean {
  const lower = key.toLowerCase();
  return (
    lower.includes("profile") ||
    lower.includes("perfil") ||
    lower.includes("avatar") ||
    lower.includes("photo") ||
    lower.includes("foto") ||
    lower.includes("image") ||
    lower.includes("driver") ||
    lower.includes("conductor") ||
    lower.includes("user")
  );
}

function passengerGetProfilePhotoFromObject(obj: Record<string, unknown>): string | null {
  // Primero campos explícitos de FOTO DE PERFIL.
  const explicitProfile = passengerImageValue(
    obj.driverProfileImageDataUrl,
    obj.driverProfilePhotoUrl,
    obj.driverProfilePhoto,
    obj.driverProfileImage,
    obj.driverPhotoDataUrl,
    obj.driverPhotoUrl,
    obj.driverPhoto,
    obj.profileImageDataUrl,
    obj.profilePhotoDataUrl,
    obj.profilePhotoUrl,
    obj.profileImageUrl,
    obj.profilePhoto,
    obj.profileImage,
    obj.avatarDataUrl,
    obj.avatarUrl,
    obj.avatar,
    obj.userPhotoDataUrl,
    obj.userPhotoUrl,
    obj.userImageDataUrl,
    obj.userImageUrl,
    obj.photoDataUrl,
    obj.photoUrl,
    obj.fotoPerfil,
    obj.foto_perfil,
    obj.perfilFoto,
    obj.perfilImagen,
  );

  if (explicitProfile) return explicitProfile;

  // Evita confundir imageDataUrl del vehículo con foto de perfil.
  const hasVehicleData = Boolean(
    passengerStringValue(obj.driverVehicleBrand) ||
      passengerStringValue(obj.vehicleBrand) ||
      passengerStringValue(obj.brand) ||
      passengerStringValue(obj.driverVehiclePlate) ||
      passengerStringValue(obj.vehiclePlate) ||
      passengerStringValue(obj.plate) ||
      passengerStringValue(obj.patente) ||
      passengerStringValue(obj.vehicleImageDataUrl) ||
      passengerStringValue(obj.driverVehicleImageDataUrl),
  );

  if (hasVehicleData) return null;

  return passengerImageValue(
    obj.imageDataUrl,
    obj.imageUrl,
    obj.image,
    obj.url,
    obj.src,
  );
}

function passengerTimeValue(value: unknown): number {
  if (value == null) return 0;

  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1_000_000_000 ? value : 0;
  }

  const text = passengerStringValue(value);
  if (!text) return 0;

  const asNumber = Number(text);
  if (Number.isFinite(asNumber) && asNumber > 1_000_000_000) {
    return asNumber;
  }

  const asDate = new Date(text).getTime();
  return Number.isFinite(asDate) ? asDate : 0;
}

function passengerStorageTimeForKey(key: string): number {
  try {
    const candidates = [
      `${key}_updated_at`,
      `${key}_updatedAt`,
      `${key}_updated`,
      `${key}:updatedAt`,
      "rapago_driver_profile_photo_updated_at",
      "rapago_driver_profile_photo_updatedAt",
      "rapago_driver_vehicle_image_updated_at",
      "rapago_driver_vehicle_image_updatedAt",
      "rapago_driver_public_profile_updated_at",
      "rapago_driver_public_profile_updatedAt",
      "rapago_driver_public_snapshot_updated_at",
      "rapago_driver_public_snapshot_updatedAt",
    ];

    for (const candidate of candidates) {
      const value = localStorage.getItem(candidate) ?? sessionStorage.getItem(candidate);
      const time = passengerTimeValue(value);
      if (time > 0) return time;
    }
  } catch {
    // No bloquea Mis Viajes.
  }

  return 0;
}

function passengerObjectTime(obj: Record<string, unknown>, sourceKey = ""): number {
  const values = [
    obj.vehiclePhotoUpdatedAt,
    obj.driverVehiclePhotoUpdatedAt,
    obj.vehicleImageUpdatedAt,
    obj.driverVehicleImageUpdatedAt,
    obj.profilePhotoUpdatedAt,
    obj.driverProfilePhotoUpdatedAt,
    obj.driverProfileUpdatedAt,
    obj.photoUpdatedAt,
    obj.imageUpdatedAt,
    obj.photosUpdatedAt,
    obj.selectedAt,
    obj.syncedAt,
    obj.driverVehicleSyncedAt,
    obj.updatedAt,
    obj.createdAt,
  ];

  for (const value of values) {
    const time = passengerTimeValue(value);
    if (time > 0) return time;
  }

  return sourceKey ? passengerStorageTimeForKey(sourceKey) : 0;
}

function passengerImageWithVersion(image: string | null, version?: unknown): string | null {
  const clean = passengerImageValue(image);
  if (!clean) return null;

  if (clean.startsWith("data:image/") || clean.startsWith("blob:")) {
    return clean;
  }

  const time = passengerTimeValue(version);
  if (time <= 0) return clean;

  const separator = clean.includes("?") ? "&" : "?";
  return `${clean}${separator}v=${encodeURIComponent(String(time))}`;
}

function passengerProfileCandidateScore(input: {
  sourceKey: string;
  obj?: Record<string, unknown>;
  image: string;
  isDirect?: boolean;
}): number {
  const lowerKey = input.sourceKey.toLowerCase();
  const time = input.obj ? passengerObjectTime(input.obj, input.sourceKey) : passengerStorageTimeForKey(input.sourceKey);

  let score = 0;
  if (input.isDirect) score += 40;
  if (lowerKey.includes("public_profile") || lowerKey.includes("public_snapshot")) score += 220;
  if (lowerKey.includes("profile") || lowerKey.includes("perfil")) score += 160;
  if (lowerKey.includes("avatar")) score += 120;
  if (lowerKey.includes("driver") || lowerKey.includes("conductor")) score += 70;
  if (lowerKey.includes("active") || lowerKey.includes("current") || lowerKey.includes("live")) score += 35;
  if (passengerLooksLikeVehiclePhotoKey(input.sourceKey)) score -= 250;

  if (input.obj) {
    if (passengerStringValue(input.obj.driverProfileImageDataUrl || input.obj.driverProfilePhotoUrl || input.obj.profilePhotoUrl || input.obj.avatarDataUrl)) score += 280;
    if (passengerStringValue(input.obj.vehicleImageDataUrl || input.obj.driverVehicleImageDataUrl || input.obj.vehiclePhotoDataUrl)) score -= 160;
  }

  // La fecha pesa fuerte para que siempre gane la foto más reciente.
  if (time > 0) score += Math.min(5000, Math.floor(time / 1_000_000_000));

  return score;
}

function passengerReadBestProfilePhotoFromEverywhere(): string | null {
  try {
    const keys = new Set<string>([
      "rapago_driver_public_snapshot_v1",
      "rapago_driver_public_profile_v1",
      "rapago_driver_profile_v1",
      "rapago_driver_profile",
      "rapago_driver_registration_profile",
      "rapago_registration_profile",
      "rapago_driver_active_vehicle_v1",
      "rapago_last_accepted_ride",
      "rapago_current_driver_location",
      "rapago_driver_live_locations_v1",
      "rapago_driver_accepted_vehicle_by_ride_v1",
      "rapago_driver_profile_photo",
      "rapago_driver_profile_image_data_url",
      "rapago_driver_profile_photo_url",
      "rapago_public_driver_profile_photo",
      "rapago_driver_photo",
      "rapago_profile_photo",
      "rapago_user_profile_photo",
      "rapago_driver_avatar_data_url",
    ]);

    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key) continue;
      if (passengerLooksLikeProfilePhotoKey(key)) keys.add(key);
    }

    try {
      for (let index = 0; index < sessionStorage.length; index += 1) {
        const key = sessionStorage.key(index);
        if (!key) continue;
        if (passengerLooksLikeProfilePhotoKey(key)) keys.add(key);
      }
    } catch {
      // No bloquea Mis Viajes.
    }

    const candidates: Array<{ image: string; score: number; time: number }> = [];

    for (const key of keys) {
      const rawDirect = passengerReadStringStorageValue(key);
      const directImage = passengerImageValue(rawDirect);
      if (directImage) {
        const time = passengerStorageTimeForKey(key);
        candidates.push({
          image: passengerImageWithVersion(directImage, time) ?? directImage,
          score: passengerProfileCandidateScore({
            sourceKey: key,
            image: directImage,
            isDirect: true,
          }),
          time,
        });
      }

      const value = passengerReadStorageRawValue(key);
      for (const obj of passengerFlattenAnyObjects(value)) {
        const image = passengerGetProfilePhotoFromObject(obj);
        if (!image) continue;

        const time = passengerObjectTime(obj, key);
        candidates.push({
          image: passengerImageWithVersion(image, time) ?? image,
          score: passengerProfileCandidateScore({
            sourceKey: key,
            obj,
            image,
          }),
          time,
        });
      }
    }

    const best = candidates.sort((a, b) => {
      if (b.time !== a.time) return b.time - a.time;
      return b.score - a.score;
    })[0];

    if (best?.image) return best.image;
  } catch {
    // No bloquea Mis Viajes.
  }

  return null;
}

function passengerFlattenAnyObjects(value: unknown, depth = 0): Array<Record<string, unknown>> {
  if (!value || depth > 6) return [];
  if (Array.isArray(value)) return value.flatMap((item) => passengerFlattenAnyObjects(item, depth + 1));
  if (typeof value !== "object") return [];

  const obj = value as Record<string, unknown>;
  const output: Array<Record<string, unknown>> = [obj];

  for (const nested of Object.values(obj)) {
    if (nested && typeof nested === "object") {
      output.push(...passengerFlattenAnyObjects(nested, depth + 1));
    }
  }

  return output;
}

function passengerParseVehicleLabel(label: string): Partial<PassengerVehicleDisplayData> {
  const clean = passengerStringValue(label);
  if (!clean) return {};

  const parts = clean
    .split(/\s*[·•|,-]\s*/g)
    .map((part) => part.trim())
    .filter(Boolean);

  const result: Partial<PassengerVehicleDisplayData> = {};

  if (parts.length > 0) {
    const main = parts[0];
    const tokens = main.split(/\s+/).filter(Boolean);
    if (tokens.length >= 2) {
      result.brand = tokens[0];
      result.model = tokens.slice(1).join(" ");
    } else {
      result.brand = main;
    }
  }

  const platePart = parts.find((part) => /[A-Z0-9]{3,}/i.test(part) && !/propio|prestado|color/i.test(part));
  if (platePart) result.plate = platePart;

  const colorPart = parts.find((part) => /^color\s*:/i.test(part));
  if (colorPart) result.color = colorPart.replace(/^color\s*:/i, "").trim();

  return result;
}

function passengerBuildVehicleCandidate(obj: Record<string, unknown>, sourceKey = ""): PassengerVehicleDisplayData | null {
  const label = passengerFirstValue(
    obj.label,
    obj.vehicleLabel,
    obj.driverVehicleLabel,
    obj.name,
    obj.title,
    obj.displayName,
  );
  const parsed = passengerParseVehicleLabel(label);

  const brand = passengerFirstValue(
    obj.driverVehicleBrand,
    obj.vehicleBrand,
    obj.brand,
    obj.make,
    obj.marca,
    obj.vehicleMake,
    parsed.brand,
  );
  const model = passengerFirstValue(
    obj.driverVehicleModel,
    obj.vehicleModel,
    obj.model,
    obj.modelo,
    parsed.model,
  );
  const plate = passengerFirstValue(
    obj.driverVehiclePlate,
    obj.vehiclePlate,
    obj.plate,
    obj.patente,
    obj.matricula,
    obj["matrícula"],
    obj.licensePlate,
    obj.registrationPlate,
    parsed.plate,
  );
  const color = passengerFirstValue(
    obj.driverVehicleColor,
    obj.vehicleColor,
    obj.color,
    obj.colour,
    obj.vehicleColour,
    parsed.color,
  );
  const imageDataUrl = passengerImageValue(
    obj.driverVehicleImageDataUrl,
    obj.driverVehiclePhotoDataUrl,
    obj.vehicleImageDataUrl,
    obj.vehiclePhotoDataUrl,
    obj.imageDataUrl,
    obj.photoDataUrl,
    obj.imageUrl,
    obj.photoUrl,
    obj.url,
    obj.src,
    passengerReadCanonicalVehicleImageDataUrl(),
  );

  if (!brand && !model && !plate && !color && !imageDataUrl) return null;

  const lowerKey = sourceKey.toLowerCase();
  let score = 0;
  if (brand) score += 8;
  if (model) score += 8;
  if (plate) score += 12;
  if (color) score += 6;
  if (imageDataUrl) score += 25;
  if (lowerKey.includes("active") || lowerKey.includes("selected")) score += 30;
  if (lowerKey.includes("driver_active_vehicle")) score += 40;
  if (lowerKey.includes("current_driver") || lowerKey.includes("live")) score += 10;

  const updatedTime = passengerObjectTime(obj, sourceKey);
  if (updatedTime > 0) {
    const ageDays = Math.max(0, (Date.now() - updatedTime) / (1000 * 60 * 60 * 24));
    score += ageDays < 7 ? 60 : 15;
    // La fecha pesa fuerte para que el pasajero tome la versión más reciente.
    score += Math.min(5000, Math.floor(updatedTime / 1_000_000_000));
  }

  return { brand, model, color, plate, imageDataUrl: passengerImageWithVersion(imageDataUrl, updatedTime), score };
}

function passengerReadSelectedVehicleIdsAny(): Set<string> {
  const ids = new Set<string>();
  try {
    for (const key of [
      "rapago_driver_selected_vehicle_v1",
      "rapago_driver_selected_vehicle",
      "rapago_selected_driver_vehicle_v1",
      "rapago_selected_vehicle_v1",
      "rapago_driver_active_vehicle_v1",
    ]) {
      const value = passengerReadJsonStorageValue(key);
      if (typeof value === "string") {
        const id = passengerStringValue(value);
        if (id) ids.add(id);
      }
      for (const obj of passengerFlattenAnyObjects(value)) {
        for (const idValue of [obj.id, obj.vehicleId, obj.selectedVehicleId, ...Object.values(obj)]) {
          const id = passengerStringValue(idValue);
          if (id && id.length < 120) ids.add(id);
        }
      }
    }
  } catch {
    // No bloquea Mis Viajes.
  }
  return ids;
}

function passengerReadBestVehicleFromEverywhere(): PassengerVehicleDisplayData | null {
  const candidates: PassengerVehicleDisplayData[] = [];
  const selectedIds = passengerReadSelectedVehicleIdsAny();

  const priorityKeys = [
    "rapago_driver_public_snapshot_v1",
    "rapago_driver_active_vehicle_v1",
    "rapago_driver_public_profile_v1",
    "rapago_driver_vehicle_image_data_url",
    "rapago_driver_profile_photo",
    "rapago_current_driver_location",
    "rapago_driver_vehicles_v1",
    "rapago_driver_selected_vehicle_v1",
    "rapago_last_accepted_ride",
    "rapago_driver_live_locations_v1",
  ];

  try {
    const keys = new Set<string>(priorityKeys);
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key) continue;
      const lower = key.toLowerCase();
      if (
        lower.includes("vehicle") ||
        lower.includes("vehiculo") ||
        lower.includes("driver") ||
        lower.includes("conductor") ||
        lower.includes("ride")
      ) {
        keys.add(key);
      }
    }

    for (const key of keys) {
      const value = passengerReadJsonStorageValue(key);
      for (const obj of passengerFlattenAnyObjects(value)) {
        const candidate = passengerBuildVehicleCandidate(obj, key);
        if (!candidate) continue;

        const id = passengerFirstValue(obj.id, obj.vehicleId, obj.selectedVehicleId);
        if (id && selectedIds.has(id)) candidate.score += 80;

        const ownership = passengerFirstValue(obj.ownership, obj.driverVehicleOwnership).toLowerCase();
        if (ownership.includes("borrow") || ownership.includes("prestado")) {
          const expires = new Date(String(obj.expiresAt ?? "")).getTime();
          if (Number.isFinite(expires) && expires <= Date.now()) continue;
        }

        candidates.push(candidate);
      }
    }
  } catch {
    // No bloquea Mis Viajes.
  }

  if (candidates.length === 0) return null;

  return candidates.sort((a, b) => b.score - a.score)[0] ?? null;
}

function passengerMergeVehicleData(
  base: Partial<PassengerVehicleDisplayData>,
  fallback: PassengerVehicleDisplayData | null,
): PassengerVehicleDisplayData {
  return {
    brand: passengerFirstValue(base.brand, fallback?.brand),
    model: passengerFirstValue(base.model, fallback?.model),
    color: passengerFirstValue(base.color, fallback?.color),
    plate: passengerFirstValue(base.plate, fallback?.plate),
    imageDataUrl: passengerImageValue(base.imageDataUrl, fallback?.imageDataUrl),
    score: Number(base.score ?? 0) + Number(fallback?.score ?? 0),
  };
}

function getPassengerDriverVehicleImageDataUrl(ride: RideRequestData & Record<string, unknown>): string | null {
  const live = readPassengerLiveVehiclePayload(String(ride.id ?? ""));
  const storedVehicle = getPassengerStoredDriverVehicle(live);
  const anyVehicle = passengerReadBestVehicleFromEverywhere();

  const latestPublicImage = passengerImageWithVersion(
    anyVehicle?.imageDataUrl ?? passengerReadCanonicalVehicleImageDataUrl(),
    anyVehicle?.score,
  );

  return passengerImageValue(
    latestPublicImage,
    anyVehicle?.imageDataUrl,
    live?.driverVehicleImageDataUrl,
    live?.driverVehiclePhotoDataUrl,
    live?.vehicleImageDataUrl,
    live?.vehiclePhotoDataUrl,
    storedVehicle?.imageDataUrl,
    passengerReadCanonicalVehicleImageDataUrl(),
    // Últimos respaldos: datos antiguos pegados al viaje aceptado.
    ride.driverVehicleImageDataUrl,
    ride.driverVehiclePhotoDataUrl,
    ride.vehicleImageDataUrl,
    ride.vehiclePhotoDataUrl,
  );
}


function getPassengerDriverVehicleLine(ride: RideRequestData & Record<string, unknown>): string {
  const vehicle = getPassengerDriverVehiclePublicData(ride);
  const name = [vehicle.brand, vehicle.model].filter(Boolean).join(" ").trim() || "Vehículo asignado";
  const details = [vehicle.color, vehicle.plate].filter(Boolean).join(" · ").trim();

  return details ? `${name} · ${details}` : name;
}


function getPassengerDriverFullName(ride: RideRequestData & Record<string, unknown>): string {
  const live = readPassengerLiveVehiclePayload(String(ride.id ?? ""));
  const direct =
    ride.driverFullName ??
    ride.driverName ??
    live?.driverFullName ??
    live?.driverName ??
    null;

  const name = String(direct ?? "").trim();
  if (name) return name;

  try {
    const storedName =
      localStorage.getItem("rapago_driver_availability_name") ??
      localStorage.getItem("rapago_driver_profile_name") ??
      localStorage.getItem("rapago_driver_name");
    if (storedName && storedName.trim()) return storedName.trim();
  } catch {
    // No bloquea Mis Viajes.
  }

  return "Conductor asignado";
}


function getPassengerDriverProfileImageDataUrl(ride: RideRequestData & Record<string, unknown>): string | null {
  const live = readPassengerLiveVehiclePayload(String(ride.id ?? ""));
  const fromEverywhere = passengerReadBestProfilePhotoFromEverywhere();

  if (fromEverywhere) return fromEverywhere;

  return passengerImageValue(
    live?.driverProfileImageDataUrl,
    live?.driverProfilePhotoUrl,
    live?.driverPhotoUrl,
    live?.profilePhotoUrl,
    // Últimos respaldos: datos antiguos pegados al viaje aceptado.
    ride.driverProfileImageDataUrl,
    ride.driverProfilePhotoUrl,
    ride.driverPhotoUrl,
    ride.profilePhotoUrl,
    ride.profileImageDataUrl,
    ride.profilePhotoDataUrl,
  );
}


function getPassengerDriverVehiclePublicData(ride: RideRequestData & Record<string, unknown>): {
  brand: string;
  model: string;
  color: string;
  plate: string;
  imageDataUrl: string | null;
} {
  const live = readPassengerLiveVehiclePayload(String(ride.id ?? ""));
  const storedVehicle = getPassengerStoredDriverVehicle(live);
  const anyVehicle = passengerReadBestVehicleFromEverywhere();

  // Primero se usan los datos públicos más recientes publicados por el conductor.
  // Lo que viene pegado al viaje queda solo como respaldo para no mostrar fotos antiguas.
  const directVehicle = passengerMergeVehicleData(
    {
      brand: passengerFirstValue(
        anyVehicle?.brand,
        live?.driverVehicleBrand,
        live?.vehicleBrand,
        storedVehicle?.brand,
        ride.driverVehicleBrand,
        ride.vehicleBrand,
      ),
      model: passengerFirstValue(
        anyVehicle?.model,
        live?.driverVehicleModel,
        live?.vehicleModel,
        storedVehicle?.model,
        ride.driverVehicleModel,
        ride.vehicleModel,
      ),
      color: passengerFirstValue(
        anyVehicle?.color,
        live?.driverVehicleColor,
        live?.vehicleColor,
        storedVehicle?.color,
        ride.driverVehicleColor,
        ride.vehicleColor,
      ),
      plate: passengerFirstValue(
        anyVehicle?.plate,
        live?.driverVehiclePlate,
        live?.vehiclePlate,
        storedVehicle?.plate,
        ride.driverVehiclePlate,
        ride.vehiclePlate,
        ride.plate,
      ),
      imageDataUrl: getPassengerDriverVehicleImageDataUrl(ride),
    },
    anyVehicle,
  );

  return {
    brand: directVehicle.brand,
    model: directVehicle.model,
    color: directVehicle.color,
    plate: directVehicle.plate,
    imageDataUrl: directVehicle.imageDataUrl,
  };
}


function getPassengerDistanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function formatPassengerDistanceMeters(meters: number | null | undefined): string {
  if (meters == null || !Number.isFinite(Number(meters))) return "Sin distancia";
  const safe = Math.max(0, Number(meters));
  if (safe < 1000) return `${Math.round(safe)} m`;
  return `${(safe / 1000).toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
}

function calculatePassengerBearingDegrees(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const toDeg = (value: number) => (value * 180) / Math.PI;
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const dLng = toRad(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}


function passengerNormalizeVehicleColorName(value: unknown): string {
  return passengerStringValue(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function passengerVehicleColorHex(value: unknown): string {
  const color = passengerNormalizeVehicleColorName(value);

  if (/^#[0-9a-f]{6}$/i.test(color)) return color;
  if (color.includes("rojo")) return "#dc2626";
  if (color.includes("verde")) return "#16a34a";
  if (color.includes("azul")) return "#2563eb";
  if (color.includes("negro") || color.includes("black")) return "#111827";
  if (color.includes("blanco") || color.includes("white")) return "#f8fafc";
  if (color.includes("gris") || color.includes("plata") || color.includes("plateado")) return "#9ca3af";
  if (color.includes("amarillo")) return "#facc15";
  if (color.includes("naranjo") || color.includes("naranja")) return "#f97316";
  if (color.includes("cafe") || color.includes("marron") || color.includes("brown")) return "#92400e";
  if (color.includes("beige")) return "#d6b98c";
  if (color.includes("morado") || color.includes("violeta")) return "#7c3aed";
  return "#64748b";
}

function passengerVehicleTextColor(value: unknown): string {
  const color = passengerNormalizeVehicleColorName(value);
  if (color.includes("blanco") || color.includes("amarillo") || color.includes("beige")) return "#111827";
  return "#ffffff";
}


type PassengerIslandVehicleType = "pickup" | "suv" | "van" | "compact" | "sedan";

function passengerVehicleIslandType(vehicle: { brand: string; model: string }): PassengerIslandVehicleType {
  const text = passengerNormalizeVehicleColorName(`${vehicle.brand} ${vehicle.model}`);

  if (
    /hilux|l200|dmax|d max|ranger|navara|frontier|amarok|silverado|colorado|np300|bt50|bt 50|pickup|camioneta/.test(text)
  ) {
    return "pickup";
  }

  if (/hiace|h1|h 1|staria|urvan|van|minibus|bus|transporter|furgon/.test(text)) {
    return "van";
  }

  if (/rav4|rav 4|prado|land cruiser|cruiser|jimny|vitara|grand nomade|tucson|sportage|santa fe|sorento|xtrail|x trail|terrano|pathfinder|jeep|suv|4x4/.test(text)) {
    return "suv";
  }

  if (/yaris|vitz|swift|march|morning|picanto|fit|demio|mazda 2|i20|accent|rio|sail|spark|hatch/.test(text)) {
    return "compact";
  }

  return "sedan";
}

function passengerEscapeSvgText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getPassengerIslandVehicleSvg(vehicle: {
  brand: string;
  model: string;
  color: string;
  plate: string;
}): string {
  const type = passengerVehicleIslandType(vehicle);
  const fill = passengerVehicleColorHex(vehicle.color);
  const title = [vehicle.brand, vehicle.model].filter(Boolean).join(" ").trim() || "Vehículo Rapa Nui";
  const plate = vehicle.plate ? vehicle.plate.toUpperCase() : "";
  const safeTitle = passengerEscapeSvgText(title).slice(0, 28);
  const safePlate = passengerEscapeSvgText(plate).slice(-8);

  const wheelBack = type === "pickup" ? 170 : type === "van" ? 150 : type === "compact" ? 160 : 165;
  const wheelFront = type === "pickup" ? 405 : type === "van" ? 420 : type === "compact" ? 380 : 395;

  const bodyByType: Record<PassengerIslandVehicleType, string> = {
    pickup: `
      <path d="M92 185 L130 145 C145 128 165 118 190 118 H310 C336 118 357 134 368 158 L382 185 H458 C478 185 492 199 492 218 V238 H64 V214 C64 198 76 185 92 185 Z" fill="${fill}"/>
      <path d="M322 137 H401 C421 137 438 151 444 171 L448 185 H374 L322 137 Z" fill="${fill}" opacity=".92"/>
      <path d="M151 148 C163 134 178 129 198 129 H251 V185 H104 L151 148 Z" fill="#dbeafe" opacity=".95"/>
      <path d="M264 129 H307 C320 129 334 138 344 151 L369 185 H264 V129 Z" fill="#dbeafe" opacity=".95"/>
      <rect x="385" y="151" width="72" height="34" rx="6" fill="${fill}" opacity=".98"/>
    `,
    suv: `
      <path d="M82 188 L123 139 C139 120 161 111 189 111 H335 C367 111 392 129 407 157 L426 188 H462 C481 188 496 202 496 221 V238 H60 V214 C60 199 67 188 82 188 Z" fill="${fill}"/>
      <path d="M144 143 C156 130 174 124 197 124 H255 V188 H104 L144 143 Z" fill="#dbeafe" opacity=".95"/>
      <path d="M269 124 H331 C350 124 367 135 378 153 L398 188 H269 V124 Z" fill="#dbeafe" opacity=".95"/>
      <path d="M419 194 H463 C475 194 484 203 484 215 V224 H419 Z" fill="#111827" opacity=".12"/>
    `,
    van: `
      <path d="M69 177 L90 132 C99 114 117 104 139 104 H397 C430 104 457 131 457 164 V238 H61 V202 C61 188 62 180 69 177 Z" fill="${fill}"/>
      <path d="M105 130 H196 V181 H79 L105 130 Z" fill="#dbeafe" opacity=".95"/>
      <rect x="211" y="130" width="87" height="51" rx="7" fill="#dbeafe" opacity=".95"/>
      <rect x="314" y="130" width="86" height="51" rx="7" fill="#dbeafe" opacity=".95"/>
      <rect x="420" y="132" width="22" height="98" rx="8" fill="#111827" opacity=".10"/>
    `,
    compact: `
      <path d="M91 190 L128 148 C145 129 168 119 196 119 H315 C342 119 364 133 378 157 L399 190 H457 C475 190 489 204 489 222 V238 H61 V215 C61 201 73 190 91 190 Z" fill="${fill}"/>
      <path d="M149 150 C161 137 178 132 199 132 H255 V190 H107 L149 150 Z" fill="#dbeafe" opacity=".95"/>
      <path d="M268 132 H315 C333 132 349 142 360 158 L381 190 H268 V132 Z" fill="#dbeafe" opacity=".95"/>
      <path d="M393 190 L433 174 C451 168 470 181 472 200 L473 214 H405 Z" fill="${fill}" opacity=".95"/>
    `,
    sedan: `
      <path d="M82 193 L126 151 C145 133 171 124 202 124 H331 C359 124 381 138 397 162 L416 193 H462 C480 193 493 206 493 224 V238 H61 V216 C61 202 70 193 82 193 Z" fill="${fill}"/>
      <path d="M151 154 C164 142 181 137 205 137 H263 V193 H109 L151 154 Z" fill="#dbeafe" opacity=".95"/>
      <path d="M277 137 H330 C348 137 365 147 377 164 L396 193 H277 V137 Z" fill="#dbeafe" opacity=".95"/>
    `,
  };

  const typeLabel: Record<PassengerIslandVehicleType, string> = {
    pickup: "Camioneta 4x4 local",
    suv: "SUV local",
    van: "Van / transfer local",
    compact: "Auto urbano local",
    sedan: "Auto local",
  };

  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="620" height="340" viewBox="0 0 620 340">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#f8fafc"/>
        <stop offset="48%" stop-color="#e0f2fe"/>
        <stop offset="100%" stop-color="#fde68a"/>
      </linearGradient>
      <linearGradient id="road" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#475569"/>
        <stop offset="100%" stop-color="#1f2937"/>
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="150%">
        <feDropShadow dx="0" dy="14" stdDeviation="12" flood-color="#000000" flood-opacity="0.28"/>
      </filter>
    </defs>
    <rect width="620" height="340" rx="34" fill="url(#sky)"/>
    <path d="M0 245 C90 212 138 252 220 222 C313 188 386 232 474 201 C540 177 584 194 620 212 V340 H0 Z" fill="#164e63" opacity=".20"/>
    <path d="M0 260 C80 238 137 280 224 252 C310 225 384 260 482 228 C546 207 590 221 620 236 V340 H0 Z" fill="#0f766e" opacity=".22"/>
    <path d="M-20 280 C129 248 317 256 640 268 L640 340 L-20 340 Z" fill="url(#road)"/>
    <path d="M105 301 C230 288 368 292 517 303" stroke="#f8fafc" stroke-width="7" stroke-linecap="round" stroke-dasharray="22 24" opacity=".62"/>
    <g opacity=".36">
      <path d="M515 98 C541 98 559 119 559 145 C559 175 540 198 515 198 C490 198 471 175 471 145 C471 119 489 98 515 98 Z" fill="#78350f"/>
      <rect x="501" y="132" width="29" height="76" rx="14" fill="#78350f"/>
    </g>
    <g filter="url(#shadow)">
      ${bodyByType[type]}
      <path d="M74 238 H500 C497 251 486 260 470 260 H96 C82 260 72 251 74 238 Z" fill="#111827" opacity=".20"/>
      <circle cx="${wheelBack}" cy="238" r="35" fill="#111827"/>
      <circle cx="${wheelBack}" cy="238" r="16" fill="#f8fafc"/>
      <circle cx="${wheelBack}" cy="238" r="7" fill="#94a3b8"/>
      <circle cx="${wheelFront}" cy="238" r="35" fill="#111827"/>
      <circle cx="${wheelFront}" cy="238" r="16" fill="#f8fafc"/>
      <circle cx="${wheelFront}" cy="238" r="7" fill="#94a3b8"/>
      <rect x="395" y="201" width="70" height="26" rx="8" fill="#ffffff" opacity=".96"/>
      <text x="430" y="219" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="900" fill="#111827">${safePlate}</text>
    </g>
    <rect x="24" y="24" width="360" height="58" rx="22" fill="#111827" opacity=".88"/>
    <text x="42" y="52" font-family="Arial, sans-serif" font-size="20" font-weight="900" fill="#ffffff">${safeTitle}</text>
    <text x="42" y="72" font-family="Arial, sans-serif" font-size="14" font-weight="800" fill="#fde68a">${typeLabel[type]} · Rapa Nui</text>
  </svg>`;
}

function getPassengerVehicleFallbackImageDataUrl(vehicle: {
  brand: string;
  model: string;
  color: string;
  plate: string;
}): string {
  const svg = getPassengerIslandVehicleSvg(vehicle);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function getPassengerDriverPhone(ride: RideRequestData & Record<string, unknown>): string {
  const live = readPassengerLiveVehiclePayload(String(ride.id ?? ""));
  const fromRide = passengerFirstValue(
    ride.driverPhone,
    ride.driverPhoneNumber,
    ride.driverMobile,
    ride.phone,
    live?.driverPhone,
    live?.driverPhoneNumber,
    live?.driverMobile,
  );

  if (fromRide) return fromRide;

  try {
    return passengerFirstValue(
      localStorage.getItem("rapago_driver_phone"),
      localStorage.getItem("rapago_driver_public_phone"),
      localStorage.getItem("rapago_profile_phone"),
    );
  } catch {
    return "";
  }
}

function getPassengerUberStatusText(status: string): string {
  if (status === "driver_arrived") return "Tu conductor llegó";
  if (status === "in_progress") return "Viaje en curso";
  if (status === "driver_scheduled") return "Tu conductor fue asignado";
  return "Conductor en camino";
}

function PassengerDriverAndVehicleDetails({
  ride,
}: {
  ride: RideRequestData & Record<string, unknown>;
}): JSX.Element {
  const effectiveStatus = getEffectivePassengerRideStatus(ride);
  const driverName = getPassengerDriverFullName(ride);
  const profileImage = getPassengerDriverProfileImageDataUrl(ride);
  const vehicle = getPassengerDriverVehiclePublicData(ride);
  const hasRealVehicleImage = Boolean(vehicle.imageDataUrl);
  const vehicleVisual = vehicle.imageDataUrl ?? getPassengerVehicleFallbackImageDataUrl(vehicle);
  const driverPhone = getPassengerDriverPhone(ride);
  const initial = driverName.trim().charAt(0).toUpperCase() || "C";
  const modelLine = [vehicle.brand, vehicle.model].filter(Boolean).join(" ").trim() || "Vehículo asignado";
  const plateText = vehicle.plate ? vehicle.plate.toUpperCase() : "SIN PATENTE";
  const maskedPlate = vehicle.plate ? `****${plateText.slice(-4)}` : "****";
  const colorLine = vehicle.color ? `Color: ${vehicle.color}` : "Color no informado";
  const statusText = getPassengerUberStatusText(effectiveStatus);
  const cleanFirstName = driverName.split(/\s+/)[0]?.trim() || driverName;
  const whatsappText = encodeURIComponent(`Hola ${cleanFirstName}, soy tu pasajero de RAPA GO.`);
  const safePhone = driverPhone.replace(/[^0-9+]/g, "");

  return (
    <div
      style={{
        marginBottom: 14,
        background: "#ffffff",
        borderRadius: 26,
        padding: "14px",
        border: "1px solid rgba(0,0,0,.07)",
        boxShadow: "0 14px 34px rgba(0,0,0,.12)",
        color: "#111111",
      }}
    >
      <div style={{ fontWeight: 950, fontSize: "1rem", textAlign: "center", marginBottom: 12 }}>
        {statusText}
      </div>

      <div
        style={{
          border: "1px solid rgba(0,0,0,.08)",
          borderRadius: 16,
          padding: "10px 12px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          marginBottom: 14,
          background: "#ffffff",
        }}
      >
        <div>
          <div style={{ color: "rgba(17,17,17,.62)", fontSize: ".74rem", fontWeight: 850 }}>
            Detalles del viaje
          </div>
          <div style={{ fontWeight: 950, fontSize: ".92rem", marginTop: 1, lineHeight: 1.25 }}>
            {effectiveStatus === "driver_arrived"
              ? `Espera en ${String(ride.originText ?? "el punto de partida")}`
              : `Recogida: ${String(ride.originText ?? "punto de partida")}`}
            <br />
            <span style={{ fontSize: ".78rem", color: "rgba(17,17,17,.62)", fontWeight: 850 }}>
              Destino: {String(ride.destinationText ?? "destino del viaje")}
            </span>
          </div>
        </div>
        <button
          type="button"
          style={{
            border: 0,
            width: 42,
            height: 42,
            borderRadius: 12,
            background: "#f3f4f6",
            fontSize: "1.25rem",
            fontWeight: 950,
            color: "#111111",
          }}
          aria-label="Más detalles del viaje"
        >
          ⋯
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "88px 1fr 116px",
          gap: 10,
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <div style={{ position: "relative", width: 78 }}>
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: 999,
              overflow: "hidden",
              background: "#D8A83E",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#111",
              fontWeight: 950,
              fontSize: "1.25rem",
              border: "3px solid #ffffff",
              boxShadow: "0 10px 22px rgba(0,0,0,.18)",
            }}
          >
            {profileImage ? (
              <img
                key={profileImage}
                src={profileImage}
                loading="lazy"
                decoding="async"
                alt={`Foto de perfil de ${driverName}`}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <span>{initial}</span>
            )}
          </div>
        </div>

        <div style={{ minWidth: 0, textAlign: "center" }}>
          <div style={{ fontWeight: 950, fontSize: ".86rem", color: "#007f69", letterSpacing: ".02em" }}>
            {driverName}
          </div>
          <div style={{ marginTop: 4, fontWeight: 850, fontSize: ".74rem", color: "rgba(17,17,17,.62)", lineHeight: 1.25 }}>
            {modelLine}
            <br />{colorLine}
          </div>
        </div>

        <div style={{ textAlign: "right", minWidth: 0 }}>
          <div style={{ fontWeight: 950, fontSize: ".96rem", letterSpacing: ".02em" }}>
            {maskedPlate}
          </div>
          <div style={{ fontSize: ".78rem", color: "rgba(17,17,17,.66)", fontWeight: 850, marginTop: 2 }}>
            {modelLine}
          </div>
          <div
            style={{
              marginLeft: "auto",
              marginTop: 6,
              width: 88,
              height: 48,
              borderRadius: 14,
              background: hasRealVehicleImage ? "#f3f4f6" : "linear-gradient(135deg,#f8fafc,#e2e8f0)",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 8px 18px rgba(0,0,0,.12)",
            }}
          >
            <img
              key={vehicleVisual}
              src={vehicleVisual}
              loading="lazy"
              decoding="async"
              alt={`Imagen del vehículo ${modelLine}`}
              style={{ width: "100%", height: "100%", objectFit: hasRealVehicleImage ? "cover" : "contain" }}
            />
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 48px 48px", gap: 8, alignItems: "center" }}>
        <a
          href={safePhone ? `https://wa.me/${safePhone.replace(/^\+/, "")}?text=${whatsappText}` : `https://wa.me/${RAPAGO_CONTACT.adminPhone.replace(/[^0-9]/g, "")}`}
          target="_blank"
          rel="noreferrer"
          style={{
            height: 42,
            borderRadius: 999,
            background: "#eef0f2",
            color: "rgba(17,17,17,.70)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textDecoration: "none",
            fontWeight: 850,
            fontSize: ".78rem",
            padding: "0 12px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          Enviar mensaje a {cleanFirstName}
        </a>
        <a
          href={safePhone ? `tel:${safePhone}` : `tel:${RAPAGO_CONTACT.adminPhone.replace(/[^0-9+]/g, "")}`}
          style={{
            width: 42,
            height: 42,
            borderRadius: 999,
            background: "#f3f4f6",
            color: "#111111",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textDecoration: "none",
            fontWeight: 950,
            fontSize: "1rem",
          }}
          aria-label="Llamar al conductor"
        >
          📞
        </a>
        <button
          type="button"
          style={{
            width: 42,
            height: 42,
            borderRadius: 999,
            border: 0,
            background: "#111111",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 950,
            fontSize: "1rem",
          }}
          aria-label="Seguridad del viaje"
        >
          🛡️
        </button>
      </div>
    </div>
  );
}

type RideLiveResponse = {
  rideId: string;
  status: string;
  driver: DriverLivePoint | null;
};

function getApiBaseUrl(): string {
  return (import.meta.env["VITE_API_BASE_URL"] as string | undefined) ?? "/api";
}

function buildApiUrl(path: string): string {
  const baseUrl = getApiBaseUrl().replace(/\/$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  if (baseUrl.endsWith("/api") && cleanPath.startsWith("/api/")) {
    return `${baseUrl}${cleanPath.slice(4)}`;
  }

  return `${baseUrl}${cleanPath}`;
}

function isPassengerLiveDriverEndpointEnabled(): boolean {
  // En desarrollo tu backend todavía no tiene /api/rides/:id/live.
  // Si lo llamamos igual, Vite muestra 404 muchas veces y puede romper la vista.
  // Cuando tengas ese endpoint listo, agrega en .env: VITE_RAPAGO_LIVE_DRIVER=true
  return String(import.meta.env["VITE_RAPAGO_LIVE_DRIVER"] ?? "").toLowerCase() === "true";
}

async function fetchRideLiveDriverPoint(
  token: string,
  rideId: string,
): Promise<DriverLivePoint | null> {
  const response = await fetch(buildApiUrl(`/api/rides/${encodeURIComponent(rideId)}/live`), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 404 || response.status === 204) return null;

  if (!response.ok) {
    throw new Error("No se pudo obtener la ubicación real del conductor.");
  }

  const data = (await response.json()) as RideLiveResponse;

  if (!data.driver) return null;

  const lat = Number(data.driver.lat);
  const lng = Number(data.driver.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return {
    lat,
    lng,
    heading: data.driver.heading ?? null,
    speed: data.driver.speed ?? null,
    accuracy: data.driver.accuracy ?? null,
    updatedAt: data.driver.updatedAt ?? null,
  };
}

function isValidDriverPoint(point: DriverLivePoint | null): point is DriverLivePoint {
  return Boolean(point && Number.isFinite(point.lat) && Number.isFinite(point.lng));
}


function getDriverPointForPassengerMap(
  ride: RideRequestData,
  liveDriverPoint: DriverLivePoint | null,
): { lat: number; lng: number } | null {
  if (isValidDriverPoint(liveDriverPoint)) {
    return {
      lat: liveDriverPoint.lat,
      lng: liveDriverPoint.lng,
    };
  }

  const localLivePoint = readPassengerLocalDriverLivePoint(ride.id);
  if (isValidDriverPoint(localLivePoint)) {
    return {
      lat: localLivePoint.lat,
      lng: localLivePoint.lng,
    };
  }

  const withLocation = ride as RideRequestData & {
    driverLat?: number | null;
    driverLng?: number | null;
    driverLatitude?: number | null;
    driverLongitude?: number | null;
  };

  const lat = withLocation.driverLat ?? withLocation.driverLatitude ?? null;
  const lng = withLocation.driverLng ?? withLocation.driverLongitude ?? null;

  if (lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
    return {
      lat: Number(lat),
      lng: Number(lng),
    };
  }

  return null;
}


function cleanPassengerMapSearchText(value: unknown): string {
  return String(value ?? "")
    .replace(/^recogida\s+en\s+/i, "")
    .replace(/^recogida\s+accesible\s*:?\s*/i, "")
    .replace(/^destino\s*:?\s*/i, "")
    .replace(/\s+·\s+.*$/g, "")
    .trim();
}

async function geocodePassengerMapPoint(value: unknown): Promise<{ lat: number; lng: number } | null> {
  const query = cleanPassengerMapSearchText(value);
  if (!query || query.toLowerCase() === "mi ubicación actual") return null;

  await loadRapaGoGoogleMaps();
  const geocoder = new google.maps.Geocoder();

  return new Promise((resolve) => {
    geocoder.geocode(
      {
        address: `${query}, Hanga Roa, Rapa Nui, Chile`,
        region: "CL",
        componentRestrictions: { country: "CL" },
      },
      (results, status) => {
        if (status !== google.maps.GeocoderStatus.OK || !results?.[0]?.geometry?.location) {
          resolve(null);
          return;
        }

        resolve({
          lat: results[0].geometry.location.lat(),
          lng: results[0].geometry.location.lng(),
        });
      },
    );
  });
}

function getDirectRidePoint(ride: RideRequestData & Record<string, unknown>, keys: string[]): { lat: number; lng: number } | null {
  for (let index = 0; index < keys.length; index += 2) {
    const lat = Number(ride[keys[index]]);
    const lng = Number(ride[keys[index + 1]]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  return null;
}

function parsePassengerScheduleDateTime(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const direct = new Date(raw);
  if (Number.isFinite(direct.getTime())) return direct.toISOString();

  const normalized = raw
    .replace(/\ba\.\s*m\./gi, "AM")
    .replace(/\bp\.\s*m\./gi, "PM")
    .replace(/\ba\.m\./gi, "AM")
    .replace(/\bp\.m\./gi, "PM");

  const parsed = new Date(normalized);
  if (Number.isFinite(parsed.getTime())) return parsed.toISOString();

  const parts = normalized.match(/(\d{2})[-/](\d{2})[-/](\d{4}),?\s*(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (parts) {
    let hour = Number(parts[4]);
    const minute = Number(parts[5]);
    const ampm = parts[6]?.toUpperCase();
    if (ampm === "PM" && hour < 12) hour += 12;
    if (ampm === "AM" && hour === 12) hour = 0;
    const date = new Date(Number(parts[3]), Number(parts[2]) - 1, Number(parts[1]), hour, minute);
    if (Number.isFinite(date.getTime())) return date.toISOString();
  }

  return null;
}

function readPassengerScheduleFromNotes(notes: unknown, patterns: RegExp[]): string | null {
  const text = String(notes ?? "");
  for (const pattern of patterns) {
    const raw = text.match(pattern)?.[1]?.trim();
    const parsed = parsePassengerScheduleDateTime(raw);
    if (parsed) return parsed;
  }
  return null;
}

function formatPassengerScheduleDate(value: unknown): string {
  const iso = parsePassengerScheduleDateTime(value);
  if (!iso) return String(value ?? "No informada");
  return new Date(iso).toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getPassengerRideScheduleInfo(ride: RideRequestData & Record<string, unknown>): {
  isScheduled: boolean;
  isRoundTrip: boolean;
  pickupAt: string | null;
  returnAt: string | null;
  pickupActivationAt: string | null;
  returnActivationAt: string | null;
  requesterRole: string;
} {
  const notes = String(ride.notes ?? "");
  const pickupAt =
    parsePassengerScheduleDateTime(ride.scheduledPickupAt ?? ride.scheduledAt) ??
    readPassengerScheduleFromNotes(notes, [
      /Fecha y hora de recogida agendada:\s*([^.]*)\./i,
      /Viaje programado para:\s*([^.]*)\./i,
      /Recogida:\s*([^.]*)\./i,
    ]);

  const returnAt =
    parsePassengerScheduleDateTime(ride.scheduledReturnAt) ??
    readPassengerScheduleFromNotes(notes, [
      /Fecha y hora de regreso agendada:\s*([^.]*)\./i,
      /Regreso:\s*([^.]*)\./i,
      /Vuelta:\s*([^.]*)\./i,
    ]);

  const pickupActivationAt =
    parsePassengerScheduleDateTime(
      ride.scheduledActivationAt ??
        ride.scheduledPickupActivationAt ??
        ride.scheduleActivationAt ??
        ride.dispatchAt ??
        ride.autoAssignAt ??
        ride.driverVisibleAt ??
        ride.driverFrozenUntil ??
        ride.frozenUntil,
    ) ??
    readPassengerScheduleFromNotes(notes, [
      /RAPAGO_ACTIVATION_AT:\s*([^.]*)\./i,
      /Reserva congelada para conductores hasta:\s*([^.]*)\./i,
      /Activación automática recogida:\s*([^.]*)\./i,
      /Se activa(?: para gestión)?:\s*([^.]*)\./i,
    ]) ??
    (pickupAt ? new Date(new Date(pickupAt).getTime() - 10 * 60 * 1000).toISOString() : null);

  const returnActivationAt =
    parsePassengerScheduleDateTime(ride.scheduledReturnActivationAt) ??
    readPassengerScheduleFromNotes(notes, [
      /Activación automática regreso:\s*([^.]*)\./i,
      /Regreso se activa:\s*([^.]*)\./i,
      /Gestión del regreso:\s*([^.]*)\./i,
    ]) ??
    (returnAt ? new Date(new Date(returnAt).getTime() - 10 * 60 * 1000).toISOString() : null);

  const isScheduled =
    ride.isScheduled === true ||
    ride.rideMode === "scheduled" ||
    Boolean(pickupAt) ||
    Boolean(returnAt) ||
    /Tipo de solicitud:\s*viaje agendado/i.test(notes) ||
    /Fecha y hora de recogida agendada/i.test(notes) ||
    /Fecha y hora de regreso agendada/i.test(notes);

  const isRoundTrip =
    ride.isRoundTrip === true ||
    ride.tripFareMode === "round_trip" ||
    ride.tripType === "round_trip" ||
    Boolean(returnAt) ||
    /Ida y vuelta/i.test(notes);

  return {
    isScheduled,
    isRoundTrip,
    pickupAt,
    returnAt,
    pickupActivationAt,
    returnActivationAt,
    requesterRole: String(ride.requestedByRole ?? ride.requesterRole ?? "passenger").toLowerCase(),
  };
}

function isPassengerRideDriverScheduled(ride: RideRequestData): boolean {
  const status = String(
    getRideAnyField(ride, "scheduleStatus") ??
      getRideAnyField(ride, "adminScheduleStatus") ??
      getRideAnyField(ride, "reservationStatus") ??
      getRideAnyField(ride, "dispatchStatus") ??
      "",
  )
    .toLowerCase()
    .trim();

  return [
    "driver_scheduled",
    "assigned_driver",
    "driver_assigned",
    "scheduled_driver",
  ].includes(status);
}

function getEffectivePassengerRideStatus(ride: RideRequestData): string {
  const rideRecord = ride as RideRequestData & Record<string, unknown>;
  const schedule = getPassengerRideScheduleInfo(rideRecord);
  const rawStatus = String(ride.status ?? "requested");

  if (isPassengerRideCancelledByPassenger(rideRecord) || hasPassengerCancelledRideMarker(rideRecord)) return "cancelled";
  if (isDriverCancelledRequeuedRide(rideRecord)) return "requested";

  if (rawStatus === "cancelled" || rawStatus === "completed") return rawStatus;

  if (
    schedule.isScheduled &&
    (
      isPassengerRideDriverScheduled(ride) ||
      Boolean((rideRecord as Record<string, unknown>).driverStartedScheduledReservation) ||
      Boolean((rideRecord as Record<string, unknown>).scheduledReservationNavigationStarted) ||
      Boolean(ride.driverName)
    ) &&
    ride.driverName
  ) {
    if (
      (rideRecord as Record<string, unknown>).driverStartedScheduledReservation === true ||
      (rideRecord as Record<string, unknown>).scheduledReservationNavigationStarted === true ||
      String((rideRecord as Record<string, unknown>).driverAssignmentStatus ?? "").toLowerCase() === "assigned_driver_started_route"
    ) {
      return "driver_en_route";
    }

    return "driver_scheduled";
  }

  if (schedule.isScheduled && ["requested", "scheduled"].includes(rawStatus)) {
    const activationTime = schedule.pickupActivationAt
      ? new Date(schedule.pickupActivationAt).getTime()
      : Number.NaN;

    if (Number.isFinite(activationTime)) {
      // Antes de la activación: reserva congelada.
      // Desde la activación: deja de verse congelada y pasa a "Buscando conductor".
      return Date.now() < activationTime ? "scheduled" : "requested";
    }

    if (rawStatus === "scheduled") return "scheduled";
  }

  if (rawStatus === "scheduled") return "scheduled";

  return rawStatus;
}

function getPassengerRideStatusLabel(status: string): string {
  if (status === "scheduled") return "Agendado";
  if (status === "driver_scheduled") return "Tu conductor fue asignado";
  return RIDE_STATUS_LABEL[status] ?? status;
}

function getPassengerRideStatusColor(status: string): string {
  if (status === "scheduled") return "warning";
  if (status === "driver_scheduled") return "success";
  return RIDE_STATUS_COLOR[status] ?? "medium";
}

function rideStatusTitle(status: string, ride?: RideRequestData): string {
  if (status === "driver_scheduled") return "Tu conductor fue asignado";
  if (status === "scheduled") return "Viaje agendado";
  if (ride && getPassengerRideScheduleInfo(ride as RideRequestData & Record<string, unknown>).isScheduled && status === "requested") return "Buscando conductor";
  if (status === "requested") return "Buscando conductor";
  if (status === "accepted" || status === "driver_en_route") return "Tu conductor va en camino";
  if (status === "driver_arrived") return "Tu conductor llegó";
  if (status === "in_progress") return "Viaje en curso";
  if (status === "completed") return "Viaje completado";
  if (status === "cancelled") return "Viaje cancelado";
  return "Estado del viaje";
}

function rideStatusSubtitle(ride: RideRequestData): string {
  const effectiveStatus = getEffectivePassengerRideStatus(ride);

  if (effectiveStatus === "driver_scheduled") {
    return `${ride.driverName ?? "Tu conductor"} quedó agendado para tu reserva. Te avisaremos cuando se active el viaje.`;
  }

  if (getPassengerRideScheduleInfo(ride as RideRequestData & Record<string, unknown>).isScheduled && effectiveStatus === "scheduled") {
    return "Tu recogida agendada quedó congelada para conductores. El administrador la ve desde ahora y se liberará 10 minutos antes.";
  }
  if (getPassengerRideScheduleInfo(ride as RideRequestData & Record<string, unknown>).isScheduled && effectiveStatus === "requested") {
    return "Tu reserva se activó. Estamos avisando al conductor asignado para iniciar tu viaje.";
  }
  if (effectiveStatus === "requested") return "Enviamos tu solicitud a conductores disponibles.";
  if (effectiveStatus === "accepted" || effectiveStatus === "driver_en_route") {
    return `${ride.driverName ?? "El conductor"} se está acercando al punto de recogida.`;
  }
  if (effectiveStatus === "driver_arrived") return "Mira la ruta en el mapa y espera en el punto accesible.";
  if (effectiveStatus === "in_progress") return `Vas hacia ${ride.destinationText}.`;
  if (effectiveStatus === "completed") return "Gracias por viajar con Rapa Go.";
  if (effectiveStatus === "cancelled") return "Este viaje fue cancelado.";
  return "";
}


function PassengerLiveRouteMap({
  ride,
  token,
  height = 300,
}: {
  ride: RideRequestData;
  token: string;
  height?: number;
}): JSX.Element {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const rendererRef = useRef<google.maps.DirectionsRenderer | null>(null);

  const driverMarkerRef = useRef<google.maps.Marker | null>(null);
  const passengerMarkerRef = useRef<google.maps.Marker | null>(null);
  const pickupMarkerRef = useRef<google.maps.Marker | null>(null);
  const destinationMarkerRef = useRef<google.maps.Marker | null>(null);
  const fallbackRouteLineRef = useRef<google.maps.Polyline | null>(null);
  const walkLineRef = useRef<google.maps.Polyline | null>(null);
  const walkLineShadowRef = useRef<google.maps.Polyline | null>(null);

  const routeKeyRef = useRef<string>("");
  const didFitBoundsRef = useRef(false);
  const lastDriverPointRef = useRef<{ lat: number; lng: number } | null>(null);

  const [mapReady, setMapReady] = useState(false);
  const [liveDriverPoint, setLiveDriverPoint] = useState<DriverLivePoint | null>(null);
  const [, setLiveDriverError] = useState<string | null>(null);
  const [, setLastLiveUpdate] = useState<Date | null>(null);
  const [, setRouteInfo] = useState<{ distanceText: string; durationText: string; meters: number | null } | null>(null);

  const nav = extractPassengerRideNav(ride.notes);
  const effectiveMapStatus = getEffectivePassengerRideStatus(ride);
  const rideRecord = ride as RideRequestData & Record<string, unknown>;

  const [resolvedPickupPoint, setResolvedPickupPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [resolvedDestinationPoint, setResolvedDestinationPoint] = useState<{ lat: number; lng: number } | null>(null);

  const pickupFromNotes =
    nav.pickupLat != null && nav.pickupLng != null
      ? { lat: nav.pickupLat, lng: nav.pickupLng }
      : getDirectRidePoint(rideRecord, [
          "pickupLat",
          "pickupLng",
          "pickupLatitude",
          "pickupLongitude",
          "originLat",
          "originLng",
          "originLatitude",
          "originLongitude",
        ]);

  const pickup = pickupFromNotes ?? resolvedPickupPoint;

  const rawPassengerFromNotes =
    nav.passengerOriginalLat != null && nav.passengerOriginalLng != null
      ? { lat: nav.passengerOriginalLat, lng: nav.passengerOriginalLng }
      : getDirectRidePoint(rideRecord, [
          "passengerOriginalLat",
          "passengerOriginalLng",
          "passengerLat",
          "passengerLng",
          "userLat",
          "userLng",
          "realOriginLat",
          "realOriginLng",
        ]);

  const rawPassenger =
    rawPassengerFromNotes && pickup && getPassengerDistanceMeters(rawPassengerFromNotes, pickup) <= 5 && Number(nav.pickupWalkMeters ?? 0) > 8
      ? null
      : rawPassengerFromNotes;

  // Igual que en RequestRidePage: si tenemos la distancia a la calle, pero no llegó
  // la coordenada exacta de la casa, dibujamos un punto azul estimado para que el
  // usuario siempre vea los puntitos hasta el punto verde de recogida.
  const passenger =
    rawPassenger ??
    (pickup && nav.pickupWalkMeters != null && nav.pickupWalkMeters > 8
      ? offsetPointByMeters(pickup, nav.pickupWalkMeters)
      : null);

  const destinationFromNotes =
    nav.destinationLat != null && nav.destinationLng != null
      ? { lat: nav.destinationLat, lng: nav.destinationLng }
      : getDirectRidePoint(rideRecord, [
          "destinationLat",
          "destinationLng",
          "destinationLatitude",
          "destinationLongitude",
          "destLat",
          "destLng",
        ]);

  const destination = destinationFromNotes ?? resolvedDestinationPoint;

  const driverPoint = getDriverPointForPassengerMap(ride, liveDriverPoint);

  const routeOrigin = effectiveMapStatus === "in_progress" ? (driverPoint ?? pickup) : driverPoint;
  const routeDestination = effectiveMapStatus === "in_progress" ? destination : pickup;
  const liveTargetPoint = effectiveMapStatus === "in_progress" ? destination : pickup;
  const directDriverMeters = driverPoint && liveTargetPoint
    ? getPassengerDistanceMeters(driverPoint, liveTargetPoint)
    : null;
  const distanceLabel = formatPassengerDistanceMeters(directDriverMeters);

  useEffect(() => {
    let cancelled = false;

    async function resolveMissingMapPoints(): Promise<void> {
      try {
        if (!pickupFromNotes) {
          const point = await geocodePassengerMapPoint(ride.originText);
          if (!cancelled) setResolvedPickupPoint(point);
        } else if (!cancelled) {
          setResolvedPickupPoint(null);
        }

        if (!destinationFromNotes) {
          const point = await geocodePassengerMapPoint(ride.destinationText);
          if (!cancelled) setResolvedDestinationPoint(point);
        } else if (!cancelled) {
          setResolvedDestinationPoint(null);
        }
      } catch {
        if (!cancelled) {
          if (!pickupFromNotes) setResolvedPickupPoint(null);
          if (!destinationFromNotes) setResolvedDestinationPoint(null);
        }
      }
    }

    void resolveMissingMapPoints();

    return () => {
      cancelled = true;
    };
  }, [
    ride.originText,
    ride.destinationText,
    pickupFromNotes?.lat,
    pickupFromNotes?.lng,
    destinationFromNotes?.lat,
    destinationFromNotes?.lng,
  ]);

  function offsetPointByMeters(
    point: { lat: number; lng: number },
    meters: number,
    bearingDegrees = 225,
  ): { lat: number; lng: number } {
    const safeMeters = Math.max(12, Math.min(250, Math.round(meters)));
    const earthRadius = 6378137;
    const bearing = (bearingDegrees * Math.PI) / 180;
    const lat1 = (point.lat * Math.PI) / 180;
    const lng1 = (point.lng * Math.PI) / 180;
    const angularDistance = safeMeters / earthRadius;

    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(angularDistance) +
        Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing),
    );
    const lng2 =
      lng1 +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
        Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2),
      );

    return {
      lat: (lat2 * 180) / Math.PI,
      lng: (lng2 * 180) / Math.PI,
    };
  }

  function makeMarkerIcon(
    color: string,
    scale: number,
    strokeColor = "#ffffff",
    strokeWeight = 3,
  ): google.maps.Symbol {
    return {
      path: google.maps.SymbolPath.CIRCLE,
      scale,
      fillColor: color,
      fillOpacity: 1,
      strokeColor,
      strokeWeight,
    };
  }

  function createOrMoveMarker(
    ref: React.MutableRefObject<google.maps.Marker | null>,
    map: google.maps.Map,
    point: { lat: number; lng: number } | null,
    options: {
      title: string;
      icon: google.maps.Symbol;
      label?: google.maps.MarkerLabel;
      zIndex: number;
      visible?: boolean;
    },
  ): void {
    if (!point || options.visible === false) {
      ref.current?.setMap(null);
      ref.current = null;
      return;
    }

    if (ref.current) {
      ref.current.setPosition(point);
      ref.current.setTitle(options.title);
      ref.current.setIcon(options.icon);
      ref.current.setLabel(options.label ?? null);
      ref.current.setZIndex(options.zIndex);
      ref.current.setMap(map);
      return;
    }

    ref.current = new google.maps.Marker({
      map,
      position: point,
      title: options.title,
      icon: options.icon,
      label: options.label,
      zIndex: options.zIndex,
    });
  }

  function smoothMoveDriverMarker(
    marker: google.maps.Marker,
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
  ): void {
    const distance =
      Math.abs(from.lat - to.lat) + Math.abs(from.lng - to.lng);

    if (distance < 0.000001) {
      marker.setPosition(to);
      return;
    }

    const startedAt = performance.now();
    const duration = 850;

    function frame(now: number) {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);

      marker.setPosition({
        lat: from.lat + (to.lat - from.lat) * eased,
        lng: from.lng + (to.lng - from.lng) * eased,
      });

      if (progress < 1) {
        window.requestAnimationFrame(frame);
      }
    }

    window.requestAnimationFrame(frame);
  }

  function fitMapOnce(map: google.maps.Map): void {
    if (didFitBoundsRef.current || !window.google?.maps) return;

    const bounds = new google.maps.LatLngBounds();

    if (driverPoint && ["accepted", "driver_en_route", "driver_arrived", "in_progress"].includes(effectiveMapStatus)) {
      bounds.extend(driverPoint);
    }

    // Igual que en RequestRidePage: mostramos el punto real del usuario (azul)
    // y el punto accesible en calle (verde), pero la ruta del conductor va al verde.
    if (passenger) bounds.extend(passenger);
    if (pickup) bounds.extend(pickup);
    if (destination) bounds.extend(destination);
    if (routeOrigin) bounds.extend(routeOrigin);
    if (routeDestination) bounds.extend(routeDestination);

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, 72);
      didFitBoundsRef.current = true;
    }
  }


  useEffect(() => {
    const shouldTrackDriver = ["accepted", "driver_en_route", "driver_arrived", "in_progress"].includes(effectiveMapStatus);

    function loadLocalLivePoint(): void {
      const point = readPassengerLocalDriverLivePoint(ride.id);

      if (point) {
        setLiveDriverPoint(point);
        setLastLiveUpdate(point.updatedAt ? new Date(point.updatedAt) : new Date());
        setLiveDriverError(null);
      }
    }

    loadLocalLivePoint();

    if (!shouldTrackDriver) return;

    const handleLocalLiveUpdate = (event: Event): void => {
      const detail = (event as CustomEvent<PassengerLocalDriverLivePayload>).detail;

      if (detail && String(detail.rideId ?? "") !== ride.id) return;
      loadLocalLivePoint();
    };

    const handleStorageUpdate = (event: StorageEvent): void => {
      if (
        event.key === RAPAGO_DRIVER_LIVE_LOCATION_KEY ||
        event.key === "rapago_current_driver_location"
      ) {
        loadLocalLivePoint();
      }
    };

    window.addEventListener(RAPAGO_DRIVER_LIVE_LOCATION_EVENT, handleLocalLiveUpdate as EventListener);
    window.addEventListener("storage", handleStorageUpdate);

    const timerId = window.setInterval(loadLocalLivePoint, 2500);

    return () => {
      window.removeEventListener(RAPAGO_DRIVER_LIVE_LOCATION_EVENT, handleLocalLiveUpdate as EventListener);
      window.removeEventListener("storage", handleStorageUpdate);
      window.clearInterval(timerId);
    };
  }, [ride.id, effectiveMapStatus]);

  useEffect(() => {
    const shouldTrackDriver = ["accepted", "driver_en_route", "driver_arrived", "in_progress"].includes(effectiveMapStatus);
    const liveEndpointEnabled = isPassengerLiveDriverEndpointEnabled();
    const localLivePoint = readPassengerLocalDriverLivePoint(ride.id);

    if (!shouldTrackDriver) {
      setLiveDriverPoint(null);
      setLiveDriverError(null);
      setLastLiveUpdate(null);
      return;
    }

    if (!token || !liveEndpointEnabled) {
      // No llamamos /api/rides/:id/live si el backend aún no lo tiene.
      // Mientras tanto usamos el puente local que publica la pantalla del conductor.
      if (localLivePoint) {
        setLiveDriverPoint(localLivePoint);
        setLastLiveUpdate(localLivePoint.updatedAt ? new Date(localLivePoint.updatedAt) : new Date());
        setLiveDriverError(null);
      } else {
        setLiveDriverError("Esperando señal GPS del conductor.");
      }
      return;
    }

    let stopped = false;

    async function loadLiveDriver() {
      try {
        const point = await fetchRideLiveDriverPoint(token, ride.id);

        if (stopped) return;

        setLiveDriverPoint(point);
        setLastLiveUpdate(point ? new Date() : null);
        setLiveDriverError(point ? null : "Esperando señal GPS real del conductor.");
      } catch {
        if (stopped) return;

        // No reventamos la pantalla si el live falla; solo dejamos el mapa sin GPS.
        setLiveDriverPoint(null);
        setLastLiveUpdate(null);
        setLiveDriverError("Esperando señal GPS real del conductor.");
      }
    }

    void loadLiveDriver();

    const timerId = window.setInterval(() => {
      void loadLiveDriver();
    }, 6000);

    return () => {
      stopped = true;
      window.clearInterval(timerId);
    };
  }, [token, ride.id, effectiveMapStatus]);

  useEffect(() => {
    let cancelled = false;

    void loadRapaGoGoogleMaps()
      .then(() => {
        if (cancelled || !mapElementRef.current || !window.google?.maps) return;

        const center =
          pickup ??
          driverPoint ??
          destination ??
          { lat: -27.1505, lng: -109.4325 };

        const map = new google.maps.Map(mapElementRef.current, {
          center,
          zoom: 15,
          disableDefaultUI: true,
          zoomControl: true,
          fullscreenControl: true,
          gestureHandling: "greedy",
          styles: [
            { elementType: "geometry", stylers: [{ color: "#1d2633" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#1d2633" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#d7dde8" }] },
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#334155" }] },
            { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#ffffff" }] },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f172a" }] },
          ],
        });

        mapRef.current = map;

        rendererRef.current = new google.maps.DirectionsRenderer({
          map,
          suppressMarkers: true,
          preserveViewport: true,
          polylineOptions: {
            strokeColor: "#2382ff",
            strokeOpacity: 1,
            strokeWeight: 7,
          },
        });

        setMapReady(true);
      })
      .catch(() => {
        setMapReady(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !window.google?.maps) return;

    const shouldShowPassengerRealPoint =
      passenger &&
      pickup &&
      (getPassengerDistanceMeters(passenger, pickup) > 8 ||
        Number(nav.pickupWalkMeters ?? 0) > 8);

    // Igual que en RequestRidePage:
    // azul = ubicación real/casa del usuario, verde = punto accesible de recogida en calle.
    createOrMoveMarker(passengerMarkerRef, map, shouldShowPassengerRealPoint ? passenger : null, {
      title: "Tu ubicación real",
      label: { text: "•", color: "#ffffff", fontSize: "20px", fontWeight: "900" },
      icon: makeMarkerIcon("#2563eb", 18, "#ffffff", 5),
      zIndex: 32,
    });

    createOrMoveMarker(pickupMarkerRef, map, pickup, {
      title: "Punto accesible de recogida en calle",
      label: { text: "●", color: "#ffffff", fontSize: "18px", fontWeight: "900" },
      icon: makeMarkerIcon("#22c55e", 22, "#0b3d16", 6),
      zIndex: 34,
    });

    createOrMoveMarker(destinationMarkerRef, map, destination, {
      title: "Destino",
      label: { text: "●", color: "#ffffff", fontSize: "18px", fontWeight: "900" },
      icon: makeMarkerIcon("#ef4444", 16),
      zIndex: 33,
    });

    walkLineRef.current?.setMap(null);
    walkLineRef.current = null;
    walkLineShadowRef.current?.setMap(null);
    walkLineShadowRef.current = null;

    if (shouldShowPassengerRealPoint && passenger && pickup) {
      walkLineShadowRef.current = new google.maps.Polyline({
        map,
        path: [passenger, pickup],
        strokeColor: "#111827",
        strokeOpacity: 0,
        strokeWeight: 0,
        zIndex: 30,
        icons: [
          {
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              fillColor: "#111827",
              fillOpacity: 1,
              strokeColor: "#111827",
              strokeOpacity: 1,
              strokeWeight: 1,
              scale: 7,
            },
            offset: "0",
            repeat: "16px",
          },
        ],
      });

      walkLineRef.current = new google.maps.Polyline({
        map,
        path: [passenger, pickup],
        strokeColor: "#ffffff",
        strokeOpacity: 0,
        strokeWeight: 0,
        zIndex: 31,
        icons: [
          {
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              fillColor: "#ffffff",
              fillOpacity: 1,
              strokeColor: "#facc15",
              strokeOpacity: 1,
              strokeWeight: 1.6,
              scale: 4.8,
            },
            offset: "0",
            repeat: "16px",
          },
        ],
      });
    }

    didFitBoundsRef.current = false;
    fitMapOnce(map);
  }, [
    mapReady,
    passenger?.lat,
    passenger?.lng,
    pickup?.lat,
    pickup?.lng,
    destination?.lat,
    destination?.lng,
    nav.pickupWalkMeters,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !window.google?.maps) return;

    const shouldShowDriver =
      driverPoint && ["accepted", "driver_en_route", "driver_arrived", "in_progress"].includes(effectiveMapStatus);

    if (!shouldShowDriver || !driverPoint) {
      driverMarkerRef.current?.setMap(null);
      driverMarkerRef.current = null;
      lastDriverPointRef.current = null;
      return;
    }

    const previous = lastDriverPointRef.current;
    const rotation =
      typeof liveDriverPoint?.heading === "number" && Number.isFinite(liveDriverPoint.heading)
        ? liveDriverPoint.heading
        : previous
          ? calculatePassengerBearingDegrees(previous, driverPoint)
          : 0;

    const icon = {
      path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
      scale: 10,
      fillColor: "#FACC15",
      fillOpacity: 1,
      strokeColor: "#111827",
      strokeWeight: 5,
      rotation,
    };

    if (!driverMarkerRef.current) {
      driverMarkerRef.current = new google.maps.Marker({
        map,
        position: driverPoint,
        title: "Conductor en tiempo real",
        icon,
        zIndex: 40,
      });

      lastDriverPointRef.current = driverPoint;
      fitMapOnce(map);
      return;
    }

    driverMarkerRef.current.setMap(map);
    driverMarkerRef.current.setTitle("Conductor en tiempo real");
    driverMarkerRef.current.setIcon(icon);
    driverMarkerRef.current.setLabel(null);

    if (previous) {
      smoothMoveDriverMarker(driverMarkerRef.current, previous, driverPoint);
    } else {
      driverMarkerRef.current.setPosition(driverPoint);
    }

    lastDriverPointRef.current = driverPoint;
  }, [
    mapReady,
    effectiveMapStatus,
    driverPoint?.lat,
    driverPoint?.lng,
    liveDriverPoint?.heading,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    const renderer = rendererRef.current;

    if (!mapReady || !map || !renderer || !window.google?.maps) return;

    const routeKey = JSON.stringify({
      status: effectiveMapStatus,
      // Recalculamos también con el GPS del conductor para mostrar metros reales
      // cuando el conductor cambia de ruta o toma otro camino.
      originLat: routeOrigin?.lat != null ? Number(routeOrigin.lat).toFixed(5) : null,
      originLng: routeOrigin?.lng != null ? Number(routeOrigin.lng).toFixed(5) : null,
      destinationLat: routeDestination?.lat ?? null,
      destinationLng: routeDestination?.lng ?? null,
    });

    if (routeKeyRef.current === routeKey) {
      return;
    }

    routeKeyRef.current = routeKey;

    renderer.set("directions", null);
    fallbackRouteLineRef.current?.setMap(null);
    fallbackRouteLineRef.current = null;

    if (!routeOrigin || !routeDestination) {
      setRouteInfo(null);
      return;
    }

    const service = new google.maps.DirectionsService();

    service.route(
      {
        origin: routeOrigin,
        destination: routeDestination,
        travelMode: google.maps.TravelMode.DRIVING,
        region: "CL",
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result && rendererRef.current) {
          rendererRef.current.setDirections(result);
          const leg = result.routes[0]?.legs[0];
          setRouteInfo({
            distanceText: leg?.distance?.text ?? distanceLabel,
            durationText: leg?.duration?.text ?? "Calculando",
            meters: leg?.distance?.value ?? directDriverMeters,
          });
          fitMapOnce(map);
          return;
        }

        rendererRef.current?.set("directions", null);

        fallbackRouteLineRef.current = new google.maps.Polyline({
          map,
          path: [routeOrigin, routeDestination],
          strokeColor: "#2382ff",
          strokeOpacity: 1,
          strokeWeight: 7,
          icons: [
            {
              icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 4 },
              offset: "0",
              repeat: "16px",
            },
          ],
          zIndex: 25,
        });

        setRouteInfo({
          distanceText: distanceLabel,
          durationText: "Ruta referencial",
          meters: directDriverMeters,
        });

        fitMapOnce(map);
      },
    );
  }, [
    mapReady,
    effectiveMapStatus,
    routeOrigin?.lat,
    routeOrigin?.lng,
    routeDestination?.lat,
    routeDestination?.lng,
  ]);

  return (
    <div
      style={{
        position: "relative",
        height,
        width: "100%",
        background: "#111827",
        overflow: "hidden",
      }}
    >
      <div
        ref={(el) => {
          mapElementRef.current = el;
        }}
        style={{ width: "100%", height: "100%" }}
      />

      {/* Marcadores limpios: sin textos encima del mapa para no tapar la ruta. */}
    </div>
  );
}

function PassengerRideCard({
  ride,
  token,
  cancelling,
  rated,
  onCancel,
  onCancelAccepted,
  onRate,
}: {
  ride: RideRequestData;
  token: string;
  cancelling: boolean;
  rated: boolean;
  onCancel: (rideId: string) => void;
  onCancelAccepted: (rideId: string) => void;
  onRate: (rideId: string) => void;
}): JSX.Element {
  const nav = extractPassengerRideNav(ride.notes);
  const effectiveStatus = getEffectivePassengerRideStatus(ride);
  const hasDriver = !["requested", "scheduled"].includes(effectiveStatus) || !!ride.driverName;
  const navHasMapPoints =
    (nav.pickupLat != null && nav.pickupLng != null) ||
    (nav.destinationLat != null && nav.destinationLng != null) ||
    getDriverPointForPassengerMap(ride, null) !== null;
  const passengerCanTrackDriver = ["accepted", "driver_en_route", "driver_arrived", "in_progress"].includes(effectiveStatus);

  // Importante: el mapa debe aparecer apenas el conductor toma/acepta el viaje.
  // Si todavía no llega el GPS, se muestra el mapa igual con el aviso
  // "Esperando señal GPS del conductor" para que el usuario no vea una pantalla vacía.
  const showMap = passengerCanTrackDriver && (hasDriver || navHasMapPoints);
  const label = getPassengerRideStatusLabel(effectiveStatus);
  const displayFareClp = getRideDisplayFareClp(ride);
  const paymentLabel = getRidePaymentMethodLabel(ride.notes);
  const ridePassengerFareType = getRidePassengerFareType(ride);
  const fareBreakdown = extractRideFareBreakdown(ride.notes);
  const scheduleInfo = getPassengerRideScheduleInfo(ride as RideRequestData & Record<string, unknown>);
  const vehicleImageDataUrl = getPassengerDriverVehicleImageDataUrl(ride as RideRequestData & Record<string, unknown>);
  const vehicleLine = getPassengerDriverVehicleLine(ride as RideRequestData & Record<string, unknown>);
  const isScheduledPending = scheduleInfo.isScheduled && effectiveStatus === "scheduled";

  return (
    <IonCard
      aria-label={`Viaje ${label} de ${ride.originText} a ${ride.destinationText}`}
      style={{
        margin: 0,
        borderRadius: "22px",
        overflow: "hidden",
        background: "#F6F2EC",
        border: "2px solid rgba(210,164,58,.65)",
        boxShadow: "0 12px 32px rgba(0,0,0,.16)",
      }}
    >
      <IonCardContent style={{ padding: 0 }}>
        <div style={{ position: "relative", background: "#111827" }}>
          {showMap && (
            <PassengerLiveRouteMap ride={ride} token={token} height={330} />
          )}

        </div>

        <div style={{ padding: showMap ? "16px" : "12px 16px", color: "#111111" }}>
          {String((ride as RideRequestData & Record<string, unknown>).requeuedReason ?? "") === "driver_cancelled" && (
            <div
              style={{
                marginBottom: 12,
                background: "#fff1f2",
                borderRadius: 18,
                padding: "12px",
                border: "1px solid rgba(220,38,38,.32)",
                color: "#7f1d1d",
                fontWeight: 900,
                lineHeight: 1.35,
              }}
            >
              ⚠️ Tu conductor canceló el viaje. Estamos buscando un nuevo conductor disponible.
            </div>
          )}

          {["requested", "scheduled"].includes(effectiveStatus) && (
            isScheduledPending ? (
              <div
                style={{
                  background: "#fff7db",
                  borderRadius: 18,
                  padding: "12px",
                  border: "1px solid rgba(210,164,58,.55)",
                  boxShadow: "0 6px 18px rgba(0,0,0,.06)",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span style={{ fontSize: "1.25rem" }}>📅</span>
                  <div>
                    <div style={{ fontWeight: 950, fontSize: ".92rem" }}>Viaje agendado correctamente</div>
                    <div style={{ color: "#5f4a18", fontSize: ".78rem", marginTop: 3, lineHeight: 1.35 }}>
                      Has agendado tu viaje para <strong>{formatPassengerScheduleDate(scheduleInfo.pickupAt)}</strong>.
                      <br />Se activará para gestión a las <strong>{formatPassengerScheduleDate(scheduleInfo.pickupActivationAt)}</strong>.
                      {scheduleInfo.isRoundTrip && scheduleInfo.returnAt && (
                        <>
                          <br />Regreso: <strong>{formatPassengerScheduleDate(scheduleInfo.returnAt)}</strong>.
                          <br />La vuelta se activará a las <strong>{formatPassengerScheduleDate(scheduleInfo.returnActivationAt)}</strong>.
                        </>
                      )}
                      <br />Aún no estamos buscando conductor. La reserva está congelada para conductores y el administrador la gestiona 10 minutos antes.
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: 18,
                  padding: "12px",
                  border: "1px solid rgba(0,0,0,.06)",
                  boxShadow: "0 6px 18px rgba(0,0,0,.06)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <IonSpinner name="crescent" />
                  <div>
                    <div style={{ fontWeight: 950, fontSize: ".9rem" }}>Buscando conductor</div>
                    <div style={{ color: "#666", fontSize: ".78rem", marginTop: 2 }}>
                      Tu solicitud ya fue enviada a conductores cercanos.
                    </div>
                  </div>
                </div>
              </div>
            )
          )}

          {effectiveStatus === "driver_scheduled" && (
            <div
              style={{
                marginBottom: 14,
                background: "#eafff1",
                borderRadius: 18,
                padding: "12px",
                border: "1px solid rgba(34,197,94,.45)",
                boxShadow: "0 6px 18px rgba(0,0,0,.06)",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span style={{ fontSize: "1.25rem" }}>✅</span>
                <div>
                  <div style={{ fontWeight: 950, fontSize: ".92rem", color: "#14532d" }}>
                    Conductor agendado correctamente
                  </div>
                  <div style={{ color: "#166534", fontSize: ".78rem", marginTop: 3, lineHeight: 1.35 }}>
                    {ride.driverName ?? "Tu conductor"} quedó reservado para tu viaje.
                    {scheduleInfo.pickupAt && (
                      <>
                        <br />Recogida: <strong>{formatPassengerScheduleDate(scheduleInfo.pickupAt)}</strong>.
                      </>
                    )}
                    {scheduleInfo.returnAt && (
                      <>
                        <br />Regreso: <strong>{formatPassengerScheduleDate(scheduleInfo.returnAt)}</strong>.
                      </>
                    )}
                    <br />Cuando falten 10 minutos se activará el seguimiento en el mapa.
                  </div>
                </div>
              </div>
              {vehicleImageDataUrl && (
                <div style={{ marginTop: 12 }}>
                  <img
                    key={vehicleImageDataUrl}
                    src={vehicleImageDataUrl}
                    loading="lazy"
                    decoding="async"
                    alt="Foto del vehículo asignado"
                    style={{ width: "100%", height: 165, objectFit: "cover", borderRadius: 16, border: "1px solid rgba(22,101,52,.20)" }}
                  />
                  <div style={{ marginTop: 6, color: "#166534", fontSize: ".76rem", fontWeight: 900 }}>
                    {vehicleLine}
                  </div>
                </div>
              )}
            </div>
          )}

          {hasDriver && !["requested", "scheduled", "cancelled"].includes(effectiveStatus) && (
            <PassengerDriverAndVehicleDetails ride={ride as RideRequestData & Record<string, unknown>} />
          )}

          <div
            style={{
              background: "#ffffff",
              borderRadius: 18,
              padding: "12px",
              border: "1px solid rgba(0,0,0,.06)",
            }}
          >
            <div style={{ fontWeight: 950, fontSize: ".86rem", marginBottom: 10 }}>
              Detalle del viaje
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "20px 1fr", gap: 9, fontSize: ".84rem", lineHeight: 1.35 }}>
              {nav.passengerOriginalLat != null && nav.passengerOriginalLng != null && (
                <>
                  <span style={{ color: "#2563eb", fontSize: "1rem" }}>●</span>
                  <div>
                    <strong>Tu ubicación:</strong> punto donde estás ahora
                    <div style={{ color: "#666", fontSize: ".76rem", marginTop: 2 }}>
                      En el mapa aparece en azul. Camina hacia el punto verde recomendado.
                    </div>
                  </div>
                </>
              )}

              <span style={{ color: "#22c55e", fontSize: "1rem" }}>●</span>
              <div>
                <strong>Recogida accesible en calle:</strong> {ride.originText}
                {nav.pickupWalkMeters != null && nav.pickupWalkMeters > 8 && (
                  <div style={{ color: "#666", fontSize: ".76rem", marginTop: 2 }}>
                    Camina aprox. {Math.round(nav.pickupWalkMeters)} m hasta este punto para que el conductor te encuentre.
                  </div>
                )}
              </div>

              <span style={{ color: "#ef4444", fontSize: "1rem" }}>●</span>
              <div>
                <strong>Destino:</strong> {ride.destinationText}
              </div>
            </div>
          </div>

          {displayFareClp != null && (
            <div
              style={{
                marginTop: 14,
                borderRadius: 20,
                padding: "13px 14px",
                background: "linear-gradient(135deg,#fff9e8 0%,#f1d58a 100%)",
                border: "1px solid rgba(210,164,58,.70)",
                boxShadow: "0 8px 22px rgba(0,0,0,.10)",
                color: "#111111",
              }}
            >
              <div style={{ fontSize: ".72rem", fontWeight: 950, color: "#8a6418", letterSpacing: ".04em" }}>
                MONTO A PAGAR
              </div>
              <div style={{ fontSize: "1.35rem", fontWeight: 950, lineHeight: 1.1, marginTop: 3 }}>
                {formatClp(displayFareClp)}
              </div>
              <div style={{ marginTop: 6, fontSize: ".78rem", color: "rgba(17,17,17,.72)", fontWeight: 800 }}>
                💵 Pago: {paymentLabel}
              </div>
              {ridePassengerFareType && (
                <div style={{ marginTop: 4, fontSize: ".76rem", color: "rgba(17,17,17,.72)", fontWeight: 800 }}>
                  🎫 Tarifa aplicada: {passengerFareTypeLabel(ridePassengerFareType)}
                </div>
              )}
              {fareBreakdown.ruralKm != null && fareBreakdown.ruralKm > 0 && (
                <div style={{ marginTop: 6, fontSize: ".72rem", color: "rgba(17,17,17,.70)", lineHeight: 1.3, fontWeight: 800 }}>
                  {fareBreakdown.urbanKm != null ? `${fareBreakdown.urbanKm.toFixed(1)} km urbanos + ` : ""}
                  {fareBreakdown.ruralKm.toFixed(1)} km rurales
                  {fareBreakdown.ruralKmFareClp != null
                    ? ` · KM rural ${formatClp(fareBreakdown.ruralKmFareClp)}`
                    : ""}
                  {fareBreakdown.ruralDiscountPercent != null
                    ? ` (${fareBreakdown.ruralDiscountPercent}% desc.)`
                    : ""}
                </div>
              )}
              <div style={{ marginTop: 3, fontSize: ".72rem", color: "rgba(17,17,17,.60)", lineHeight: 1.25 }}>
                Este es el valor que pagarás al finalizar el viaje.
              </div>
            </div>
          )}

          {cleanRideNotes(ride.notes) && (
            <div style={{ marginTop: 8, color: "#666", fontSize: ".78rem" }}>
              {cleanRideNotes(ride.notes)}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            {["requested", "scheduled", "driver_scheduled"].includes(effectiveStatus) && (
              <IonButton
                size="small"
                fill="outline"
                color="danger"
                disabled={cancelling}
                onClick={() => onCancel(ride.id)}
              >
                {cancelling ? <IonSpinner name="dots" /> : scheduleInfo.isScheduled ? "Cancelar reserva" : "Cancelar"}
              </IonButton>
            )}

            {["accepted", "driver_en_route", "driver_arrived"].includes(effectiveStatus) && (
              <IonButton
                size="small"
                fill="outline"
                color="danger"
                disabled={cancelling}
                onClick={() => onCancelAccepted(ride.id)}
              >
                {cancelling ? <IonSpinner name="dots" /> : "Cancelar viaje"}
              </IonButton>
            )}

            {effectiveStatus === "completed" && !rated && (
              <IonButton
                size="small"
                fill="outline"
                color="warning"
                onClick={() => onRate(ride.id)}
              >
                ⭐ Calificar
              </IonButton>
            )}

            {effectiveStatus === "completed" && rated && (
              <IonBadge color="success" style={{ fontSize: "0.72rem", padding: "4px 8px" }}>
                ✓ Calificado
              </IonBadge>
            )}

            {ride.driverName && ACTIVE_STATUSES.includes(effectiveStatus) && !ride.driverPhone && (
              <WhatsAppButton
                phone={RAPAGO_CONTACT.adminPhone}
                message={WA_MESSAGES.passengerToAdmin({
                  origin: ride.originText,
                  destination: ride.destinationText,
                  name: "pasajero",
                })}
                label="Operador"
                size="small"
              />
            )}
          </div>
        </div>
      </IonCardContent>
    </IonCard>
  );
}

export default function TripsPage(): JSX.Element {
  const history = useHistory();
  const { session } = useAuth();

  const [allRides,    setAllRides]    = useState<RideRequestData[]>([]);
  const [page,        setPage]        = useState(1);
  const [loading,     setLoading]     = useState(true);
  const [loadError,   setLoadError]   = useState<string | null>(null);
  const [cancelling,  setCancelling]  = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [ratingRideId,     setRatingRideId]     = useState<string | null>(null);
  const [ratingStars,      setRatingStars]      = useState(5);
  const [ratingComment,    setRatingComment]    = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);
  const [ratingError,      setRatingError]      = useState<string | null>(null);
  const [ratedIds,         setRatedIds]         = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "completed" | "cancelled">("active");
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);
  const [passengerNotice, setPassengerNotice] = useState<PassengerNotificationPayload | null>(() =>
    readPassengerNotifications().find((item) => !item.read) ?? null,
  );
  const [, setKnownAssignedRideIds] = useState<Set<string>>(new Set());

  const loadRides = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      cleanupExpiredCancelledRidesEverywhere();
      const localRides = readLocalPassengerRides();
      const bridgeRides = readPassengerVisibleScheduledBridgeRides(session?.user);
      const requeuedRides = readPassengerVisibleRequeuedRides(session?.user);
      requeuedRides.forEach(upsertRequeuedRideIntoPassengerLocalStorage);
      const passengerLocalRides = [...localRides, ...bridgeRides, ...requeuedRides];

      if (!session?.accessToken) {
        const merged = mergeRides(passengerLocalRides, requeuedRides);
        setAllRides(merged);
        setKnownAssignedRideIds(new Set());
        setPage(1);
        setLastRefreshAt(new Date());
        return;
      }

      const data = await ridesService.listMyRides(session.accessToken);

      const mergedRides = mergeRides(passengerLocalRides, [...data, ...requeuedRides]);
      const assignedActiveRides = mergedRides.filter((ride) =>
        ["accepted", "driver_en_route", "driver_arrived", "in_progress", "driver_scheduled"].includes(getEffectivePassengerRideStatus(ride)),
      );

      const assignedIds = new Set(assignedActiveRides.map((ride) => ride.id));
      setKnownAssignedRideIds(assignedIds);
      setAllRides(mergedRides);
      setPage(1);
      setLastRefreshAt(new Date());
    } catch (err) {
      const localRides = readLocalPassengerRides();
      const bridgeRides = readPassengerVisibleScheduledBridgeRides(session?.user);
      const requeuedRides = readPassengerVisibleRequeuedRides(session?.user);
      requeuedRides.forEach(upsertRequeuedRideIntoPassengerLocalStorage);
      const merged = mergeRides([...localRides, ...bridgeRides, ...requeuedRides], requeuedRides);
      setAllRides(merged);
      setKnownAssignedRideIds(new Set());
      setPage(1);
      setLastRefreshAt(new Date());

      const message = err instanceof Error ? err.message : "Error al cargar tus viajes.";
      setLoadError(safeTripsErrorMessage(message));
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    const refreshPassengerNotice = () => {
      setPassengerNotice(readPassengerNotifications().find((item) => !item.read) ?? null);
    };

    window.addEventListener("rapago:passenger-notification", refreshPassengerNotice as EventListener);
    window.addEventListener(RAPAGO_REQUEUED_RIDES_EVENT, refreshPassengerNotice as EventListener);
    window.addEventListener("rapago:passenger-rides-updated", refreshPassengerNotice as EventListener);
    window.addEventListener("storage", refreshPassengerNotice);

    refreshPassengerNotice();

    return () => {
      window.removeEventListener("rapago:passenger-notification", refreshPassengerNotice as EventListener);
      window.removeEventListener(RAPAGO_REQUEUED_RIDES_EVENT, refreshPassengerNotice as EventListener);
      window.removeEventListener("rapago:passenger-rides-updated", refreshPassengerNotice as EventListener);
      window.removeEventListener("storage", refreshPassengerNotice);
    };
  }, []);

  useEffect(() => {
    void loadRides();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.accessToken]);

  useEffect(() => {
    cleanupExpiredCancelledRidesEverywhere();

    const interval = window.setInterval(() => {
      cleanupExpiredCancelledRidesEverywhere();
      void loadRides();
    }, 10 * 60 * 1000);

    return () => window.clearInterval(interval);
  }, [loadRides]);

  useEffect(() => {
    const refresh = () => {
      void loadRides();
    };

    window.addEventListener(RAPAGO_ADMIN_SCHEDULED_RIDES_EVENT, refresh as EventListener);
    window.addEventListener(RAPAGO_REQUEUED_RIDES_EVENT, refresh as EventListener);
    window.addEventListener("rapago:passenger-rides-updated", refresh as EventListener);
    window.addEventListener("storage", refresh);

    return () => {
      window.removeEventListener(RAPAGO_ADMIN_SCHEDULED_RIDES_EVENT, refresh as EventListener);
      window.removeEventListener(RAPAGO_REQUEUED_RIDES_EVENT, refresh as EventListener);
      window.removeEventListener("rapago:passenger-rides-updated", refresh as EventListener);
      window.removeEventListener("storage", refresh);
    };
  }, [loadRides]);

  const filteredBeforePagination = allRides.filter((r) => {
    const effectiveStatus = getEffectivePassengerRideStatus(r);

    if (statusFilter === "all")       return true;
    if (statusFilter === "active")    return ACTIVE_STATUSES.includes(effectiveStatus);
    if (statusFilter === "completed") return effectiveStatus === "completed";
    if (statusFilter === "cancelled") return effectiveStatus === "cancelled";
    return true;
  });

  const filtered = filteredBeforePagination.slice(0, page * PAGE_SIZE);

  async function handleCancel(rideId: string) {
    const targetRide =
      allRides.find((ride) => ride.id === rideId) ??
      readLocalPassengerRides().find((ride) => ride.id === rideId) ??
      readPassengerVisibleRequeuedRides(session?.user).find((ride) => ride.id === rideId);

    if (!targetRide) return;

    setCancelling(rideId);
    setCancelError(null);

    const cancelledLocal = cancelPassengerRideEverywhere(targetRide);
    setAllRides((prev) => applyPassengerCancelledRideToList(prev, targetRide, cancelledLocal));

    try {
      const effectiveStatus = getEffectivePassengerRideStatus(targetRide);
      const shouldTryBackend =
        Boolean(session?.accessToken) &&
        !rideId.startsWith("local-") &&
        !rideId.startsWith("admin-local-") &&
        !isDriverCancelledRequeuedRide(targetRide as RideRequestData & Record<string, unknown>) &&
        !["scheduled", "driver_scheduled"].includes(effectiveStatus);

      if (shouldTryBackend) {
        await ridesService.cancelRideRequest(session!.accessToken, rideId);
      }

      setCancelError(null);
    } catch {
      // Aunque el backend responda 404/409/500, ya cancelamos en localStorage
      // para que el pasajero no quede atrapado con el viaje reencolado activo.
      setCancelError(null);
    } finally {
      setCancelling(null);
      void loadRides();
    }
  }

  async function handleCancelAccepted(rideId: string) {
    const targetRide =
      allRides.find((ride) => ride.id === rideId) ??
      readLocalPassengerRides().find((ride) => ride.id === rideId) ??
      readPassengerVisibleRequeuedRides(session?.user).find((ride) => ride.id === rideId);

    if (!targetRide) return;

    setCancelling(rideId);
    setCancelError(null);

    const cancelledLocal = cancelPassengerRideEverywhere(targetRide);
    setAllRides((prev) => applyPassengerCancelledRideToList(prev, targetRide, cancelledLocal));

    try {
      const shouldTryBackend =
        Boolean(session?.accessToken) &&
        !rideId.startsWith("local-") &&
        !rideId.startsWith("admin-local-") &&
        !isDriverCancelledRequeuedRide(targetRide as RideRequestData & Record<string, unknown>);

      if (shouldTryBackend) {
        await ridesService.cancelAcceptedRide(session!.accessToken, rideId);
      }

      setCancelError(null);
    } catch {
      // Aunque el backend responda error, ya se canceló localmente.
      setCancelError(null);
    } finally {
      setCancelling(null);
      void loadRides();
    }
  }

  async function handleSubmitRating() {
    if (!session?.accessToken || !ratingRideId) return;
    setSubmittingRating(true);
    setRatingError(null);
    try {
      await ridesService.rateRide(session.accessToken, ratingRideId, ratingStars, ratingComment.trim() || undefined);
      setRatedIds((prev) => new Set([...prev, ratingRideId]));
      setRatingRideId(null);
      setRatingStars(5);
      setRatingComment("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al calificar el viaje.";
      setRatingError(safeTripsErrorMessage(message));
    } finally {
      setSubmittingRating(false);
    }
  }

  const counts = {
    all:       allRides.length,
    active:    allRides.filter((r) => ACTIVE_STATUSES.includes(getEffectivePassengerRideStatus(r))).length,
    completed: allRides.filter((r) => getEffectivePassengerRideStatus(r) === "completed").length,
    cancelled: allRides.filter((r) => getEffectivePassengerRideStatus(r) === "cancelled").length,
  };

  const hasMore = page * PAGE_SIZE < filteredBeforePagination.length;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Mis Viajes</IonTitle>
        </IonToolbar>
        <IonToolbar style={{ "--background": "var(--ion-color-primary)", "--border-width": "0" }}>
          <div style={{ display: "flex", gap: "8px", padding: "0 12px 10px", overflowX: "auto" }}>
            {(["all", "active", "completed", "cancelled"] as const).map((f) => {
              const labels = { all: "Todos", active: "Activos", completed: "Completados", cancelled: "Cancelados" };
              const active = statusFilter === f;
              return (
                <IonChip key={f}
                  aria-label={`Filtrar por ${labels[f]}`}
                  style={{
                    flexShrink: 0,
                    "--background": active ? "#fff" : "rgba(255,255,255,0.2)",
                    "--color": active ? "var(--ion-color-primary)" : "#fff",
                    fontSize: "0.78rem", height: "36px",
                    fontWeight: active ? 700 : 400,
                  }}
                  onClick={() => setStatusFilter(f)}
                >
                  {labels[f]}{counts[f] > 0 ? ` (${counts[f]})` : ""}
                </IonChip>
              );
            })}
          </div>
        </IonToolbar>

        <IonToolbar style={{ "--background": "#111111", "--border-width": "0" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              padding: "8px 14px 10px",
              color: "#F6F2EC",
              fontSize: ".78rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ color: "#C89B3C", fontSize: 18, lineHeight: 1 }}>🔔</span>
              <span>
                {counts.active > 0
                  ? "Tienes viajes o reservas activas. Revisa el detalle y el mapa cuando el conductor esté en camino."
                  : "Sin conductor activo por ahora."}
              </span>
            </div>

            <IonButton
              size="small"
              color="warning"
              disabled={loading}
              onClick={() => void loadRides()}
              style={{ "--border-radius": "999px", fontWeight: 900 } as React.CSSProperties}
            >
              {loading ? <IonSpinner name="dots" /> : "Actualizar"}
            </IonButton>
          </div>

          {lastRefreshAt && (
            <div
              style={{
                color: "rgba(246,242,236,.64)",
                fontSize: ".68rem",
                padding: "0 14px 8px",
              }}
            >
              Última actualización: {lastRefreshAt.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
            </div>
          )}
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {passengerNotice && (
          <IonCard style={{ margin: "12px 14px 0", borderRadius: 18, background: "#fff7db", color: "#111", border: "1px solid rgba(210,164,58,.65)", boxShadow: "0 10px 24px rgba(0,0,0,.16)" }}>
            <IonCardContent style={{ padding: "12px 14px" }}>
              <div style={{ fontWeight: 950, fontSize: ".92rem" }}>{passengerNotice.title}</div>
              <div style={{ marginTop: 4, color: "rgba(17,17,17,.70)", fontSize: ".8rem", lineHeight: 1.35 }}>{passengerNotice.body}</div>
              <IonButton
                size="small"
                color="warning"
                style={{ "--border-radius": "999px", marginTop: 8, fontWeight: 900 } as React.CSSProperties}
                onClick={() => {
                  markPassengerNotificationsRead();
                  setPassengerNotice(null);
                  void loadRides();
                }}
              >
                Entendido
              </IonButton>
            </IonCardContent>
          </IonCard>
        )}

        <IonToast
          isOpen={Boolean(passengerNotice)}
          message={passengerNotice ? `${passengerNotice.title}: ${passengerNotice.body}` : ""}
          duration={5200}
          color="warning"
          position="top"
          onDidDismiss={() => {}}
        />

        <IonRefresher slot="fixed" onIonRefresh={(e) => { void loadRides().then(() => e.detail.complete()); }}>
          <IonRefresherContent />
        </IonRefresher>

        {loading && <SkeletonList count={3} height="140px" />}

        {loadError && (
          <div style={{ padding: "16px" }}>
            <IonText color="danger"><p>{loadError}</p></IonText>
          </div>
        )}

        {!loading && allRides.length === 0 && (
          <EmptyState icon={carOutline} title="Sin viajes todavía"
            subtitle="Solicita tu primer traslado en Rapa Nui"
            actionLabel="Solicitar viaje"
            onAction={() => history.push(ROUTES.PASSENGER.REQUEST_RIDE)}
          />
        )}

        {!loading && allRides.length > 0 && filtered.length === 0 && (
          <EmptyState icon={carOutline} title="Sin resultados" subtitle="No hay viajes en esta categoría" />
        )}

        {!loading && filtered.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "12px 14px 18px" }}>
            {filtered.map((ride) => (
              <PassengerRideCard
                key={ride.id}
                ride={ride}
                token={session?.accessToken ?? ""}
                cancelling={cancelling === ride.id}
                rated={ratedIds.has(ride.id)}
                onCancel={(rideId) => void handleCancel(rideId)}
                onCancelAccepted={(rideId) => void handleCancelAccepted(rideId)}
                onRate={(rideId) => {
                  setRatingRideId(rideId);
                  setRatingStars(5);
                  setRatingComment("");
                  setRatingError(null);
                }}
              />
            ))}
          </div>
        )}

        <IonInfiniteScroll threshold="100px" disabled={!hasMore || loading}
          onIonInfinite={(ev) => {
            setPage((p) => p + 1);
            void (ev.target as HTMLIonInfiniteScrollElement).complete();
          }}>
          <IonInfiniteScrollContent loadingText="Cargando más viajes..." />
        </IonInfiniteScroll>

        {cancelError && (
          <div style={{ padding: "0 16px" }}>
            <IonText color="danger"><p style={{ fontSize: "0.85rem" }}>{cancelError}</p></IonText>
          </div>
        )}

        {ratingRideId && (
          <IonCard style={{ margin: "12px 16px" }}>
            <IonCardContent style={{ padding: "14px 16px" }}>
              <div style={{ fontWeight: 600, marginBottom: "8px" }}>⭐ Calificar conductor</div>
              <StarRatingInput value={ratingStars} onChange={setRatingStars} />
              <IonItem lines="none" style={{ "--padding-start": "0", marginTop: "8px" }}>
                <IonTextarea value={ratingComment} onIonInput={(e) => setRatingComment(String(e.detail.value ?? ""))}
                  placeholder="Comentario opcional" maxlength={500} rows={2} />
              </IonItem>
              {ratingError && <IonText color="danger"><p style={{ fontSize: "0.82rem", margin: "4px 0" }}>{ratingError}</p></IonText>}
              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                <IonButton size="small" onClick={() => void handleSubmitRating()} disabled={submittingRating}>
                  {submittingRating ? <IonSpinner name="dots" /> : "Enviar"}
                </IonButton>
                <IonButton size="small" fill="outline" color="medium" onClick={() => setRatingRideId(null)}>Cancelar</IonButton>
              </div>
            </IonCardContent>
          </IonCard>
        )}
</IonContent>
    </IonPage>
  );
}
