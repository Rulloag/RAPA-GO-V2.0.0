import {
  IonAlert,
  IonBadge, IonButton, IonIcon, IonCard, IonCardContent, IonChip, IonContent, IonHeader,
IonInfiniteScroll, IonInfiniteScrollContent, IonLabel, IonModal, IonPage,
  IonRefresher, IonRefresherContent, IonSpinner, IonText, IonTextarea, IonTitle,
  IonToolbar, IonItem, IonToast, IonInput, IonToggle,
} from "@ionic/react";
import { useState, useCallback, useEffect, useRef, type CSSProperties } from "react";
import { useHistory } from "react-router-dom";
import {
  carOutline, refreshOutline, locationOutline, warningOutline, cashOutline,
  cardOutline, calendarOutline, flashOutline, carSportOutline, ticketOutline,
  alertCircleOutline, star, starOutline, notificationsOutline, hourglassOutline,
  checkmarkCircle, closeCircle, businessOutline, walletOutline,
} from "ionicons/icons";
import { MapView } from "../../../features/maps/MapView.js";
import { useDirectionsRoute } from "../../../features/maps/useDirectionsRoute.js";
import type { GoogleMapInstance } from "../../../features/maps/maps.types.js";
import { EmptyState } from "../../../components/EmptyState.js";
import { TripTimeline } from "../../../components/TripTimeline.js";
import { SkeletonList } from "../../../components/SkeletonCard.js";
import { WhatsAppButton } from "../../../components/WhatsAppButton.js";
import { loadRapaGoGoogleMaps } from "../../../components/MapFallback.js";
import { useAuth } from "../../../features/auth/index.js";
import { ridesService, type RideRequestData } from "../../../features/rides/rides.service.js";
import { rideLocationService } from "../../../features/location/rideLocation.service.js";
import { walletService } from "../../../features/wallet/wallet.service.js";
import {
  cancelPendingKlapRide,
  openKlapHostedCheckout,
  type PendingKlapPaymentRecord,
} from "../../../features/payments/klapCheckout.service.js";
import { cashRefundsService } from "../../../features/cashRefunds/cashRefunds.service.js";

import { RapagoSectionHeader } from "../../../components/RapagoSectionHeader.js";
import { useRapagoSectionTheme } from "../../../theme/rapagoTheme.js";

import { ROUTES } from "../../../navigation/routes.js";
import { RAPAGO_CONTACT, WA_MESSAGES } from "@rapa-go/shared";
import { RIDE_STATUS_LABEL, RIDE_STATUS_COLOR } from "../shared.js";
import { getApiOrigin as getConfiguredApiOrigin } from "../../../services/api/apiBaseUrl.js";

const PAGE_SIZE = 20;
const RAPAGO_SUPPORT_WHATSAPP_PHONE = "56947964171";
// Los viajes finalizados se conservan en Mis Viajes como historial del pasajero.
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

const PASSENGER_ACTIVE_POLL_INTERVAL_MS = 2500;
const PASSENGER_IDLE_POLL_INTERVAL_MS = 15000;

const LOCAL_PASSENGER_RIDES_KEY = "rapago_local_passenger_rides";

const RAPAGO_PENDING_CARD_PAYMENT_KEY = "rapago_pending_card_payment_v1";
const RAPAGO_PAID_SCHEDULE_MIRROR_KEYS = [
  "rapago_admin_scheduled_rides",
  "rapago_admin_scheduled_rides_v1",
  "rapago_admin_scheduled_rides_v2",
  "rapago_admin_scheduled_rides_force_v1",
  "rapago_bridge_scheduled_rides_v1",
] as const;

type PendingCardPaymentRecord = {
  rideRequestId: string;
  paymentId?: string | null;
  orderId?: string | null;
  redirectUrl?: string | null;
  amountClp?: number | null;
  provider?: string | null;
  createdAt?: string | null;
  checkoutStartedAt?: string | null;
  originText?: string | null;
  destinationText?: string | null;
  scheduledRideMirror?: Record<string, unknown> | null;
  returnPickupRideMirror?: Record<string, unknown> | null;
};

type PaymentReturnMessage = {
  tone: "checking" | "approved" | "pending" | "rejected";
  title: string;
  body: string;
};

const RAPAGO_PENDING_FAST_SEARCH_PAYMENT_KEY = "rapago_pending_fast_search_payment_v1";

type PendingFastSearchPaymentRecord = {
  rideRequestId: string;
  paymentId: string;
  amountClp: number;
  createdAt: string;
  rideMirror: Record<string, unknown>;
};

function readPendingFastSearchPayment(): PendingFastSearchPaymentRecord | null {
  try {
    const raw = localStorage.getItem(RAPAGO_PENDING_FAST_SEARCH_PAYMENT_KEY);
    const parsed = raw ? (JSON.parse(raw) as PendingFastSearchPaymentRecord) : null;
    if (!parsed || typeof parsed !== "object") return null;
    if (!String(parsed.rideRequestId ?? "").trim()) return null;
    if (!String(parsed.paymentId ?? "").trim()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function savePendingFastSearchPayment(record: PendingFastSearchPaymentRecord): void {
  try {
    localStorage.setItem(RAPAGO_PENDING_FAST_SEARCH_PAYMENT_KEY, JSON.stringify(record));
  } catch {
    // El backend sigue siendo la autoridad del pago.
  }
}

function clearPendingFastSearchPayment(): void {
  try {
    localStorage.removeItem(RAPAGO_PENDING_FAST_SEARCH_PAYMENT_KEY);
  } catch {
    // No bloquea Mis Viajes.
  }
}

function getTripsApiBaseUrl(): string {
  return getConfiguredApiOrigin();
}

function unwrapTripsApiPayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  const record = value as Record<string, unknown>;
  const data = record.data;
  return data && typeof data === "object" ? (data as Record<string, unknown>) : record;
}

function readPendingCardPayment(): PendingCardPaymentRecord | null {
  try {
    const raw = localStorage.getItem(RAPAGO_PENDING_CARD_PAYMENT_KEY);
    const parsed = raw ? (JSON.parse(raw) as PendingCardPaymentRecord) : null;
    if (!parsed || typeof parsed !== "object") return null;

    const rideRequestId = String(parsed.rideRequestId ?? "").trim();
    if (!rideRequestId) return null;

    return { ...parsed, rideRequestId };
  } catch {
    return null;
  }
}

function getPaidMirrorKey(item: Record<string, unknown>): string {
  const directId = String(
    item.serverRideId ?? item.originalRideId ?? item.id ?? "",
  ).trim();
  if (directId) return `id:${directId}`;

  return [
    item.scheduledAt ?? item.scheduledPickupAt ?? "",
    item.originText ?? "",
    item.destinationText ?? "",
    item.passengerEmail ?? "",
  ]
    .map((value) => String(value).trim().toLowerCase())
    .join("|");
}

function upsertPaidMirrorIntoStorage(
  storageKey: string,
  mirror: Record<string, unknown>,
  limit: number,
): void {
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    const current = Array.isArray(parsed)
      ? parsed.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
      : [];
    const targetKey = getPaidMirrorKey(mirror);
    const next = [
      mirror,
      ...current.filter((item) => getPaidMirrorKey(item) !== targetKey),
    ].slice(0, limit);
    localStorage.setItem(storageKey, JSON.stringify(next));
  } catch {
    // La API sigue siendo la autoridad aunque no exista almacenamiento local.
  }
}

// "authorized" es el estado final de payments.status para pagos Klap con
// captura diferida (KLAP_DEFERRED_CAPTURE_ENABLED): el backend ya confirmó
// el webhook y activó el ride, igual que con "success" — solo cambia si el
// monto está capturado o solo retenido, no si el pago quedó confirmado. Sin
// reconocer este estado aquí, el aviso "Confirmando tu pago Klap" queda
// huérfano en pantalla aunque el viaje ya esté en búsqueda de conductor.
const KLAP_PAYMENT_CONFIRMED_STATUSES = new Set(["success", "authorized"]);
const KLAP_PAYMENT_REJECTED_STATUSES = new Set(["rejected", "failed", "refunded"]);

export function isKlapPaymentConfirmedStatus(status: string): boolean {
  return KLAP_PAYMENT_CONFIRMED_STATUSES.has(status);
}

export function isKlapPaymentRejectedStatus(status: string): boolean {
  return KLAP_PAYMENT_REJECTED_STATUSES.has(status);
}

function activatePaidCardPaymentMirrors(pending: PendingCardPaymentRecord): void {
  const approvedAt = new Date().toISOString();
  const provider =
    String(pending.provider ?? "").trim().toLowerCase() === "klap"
      ? "klap"
      : "mercadopago";
  const scheduledMirror = pending.scheduledRideMirror;
  const returnMirror = pending.returnPickupRideMirror;

  if (scheduledMirror && typeof scheduledMirror === "object") {
    const approvedMirror: Record<string, unknown> = {
      ...scheduledMirror,
      serverRideId: pending.rideRequestId,
      originalRideId: pending.rideRequestId,
      paymentStatus: "approved",
      paymentApproved: true,
      paymentApprovedAt: approvedAt,
      paymentProvider: provider,
    };

    for (const key of RAPAGO_PAID_SCHEDULE_MIRROR_KEYS) {
      upsertPaidMirrorIntoStorage(key, approvedMirror, 80);
    }

    try {
      localStorage.setItem("rapago_last_scheduled_ride_for_admin", JSON.stringify(approvedMirror));
    } catch {
      // No bloquea la confirmación real del backend.
    }
  }

  if (returnMirror && typeof returnMirror === "object") {
    const approvedReturnMirror: Record<string, unknown> = {
      ...returnMirror,
      relatedOutboundRideId: pending.rideRequestId,
      paymentStatus: "approved",
      paymentApproved: true,
      paymentApprovedAt: approvedAt,
      paymentProvider: provider,
    };

    upsertPaidMirrorIntoStorage(LOCAL_PASSENGER_RIDES_KEY, approvedReturnMirror, 40);
    for (const key of RAPAGO_PAID_SCHEDULE_MIRROR_KEYS) {
      upsertPaidMirrorIntoStorage(key, approvedReturnMirror, 80);
    }
  }

  window.dispatchEvent(new CustomEvent("rapago:passenger-rides-updated", { detail: { rideId: pending.rideRequestId } }));
  window.dispatchEvent(new CustomEvent(RAPAGO_ADMIN_SCHEDULED_RIDES_EVENT, { detail: { rideId: pending.rideRequestId } }));
}

function clearPendingCardPayment(): void {
  try {
    localStorage.removeItem(RAPAGO_PENDING_CARD_PAYMENT_KEY);
  } catch {
    // No bloquea Mis Viajes.
  }
}

function cleanPaymentReturnQuery(): void {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("payment");
    url.searchParams.delete("collection_id");
    url.searchParams.delete("collection_status");
    url.searchParams.delete("payment_id");
    url.searchParams.delete("status");
    url.searchParams.delete("external_reference");
    url.searchParams.delete("merchant_order_id");
    url.searchParams.delete("preference_id");
    url.searchParams.delete("backend_reconciled");
    url.searchParams.delete("reconcile_result");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // No bloquea la verificación.
  }
}


const RAPAGO_FAST_SEARCH_STORAGE_KEY = "rapago_passenger_fast_search_rides_v1";
const RAPAGO_FAST_SEARCH_EVENT = "rapago:passenger-fast-search-updated";
const RAPAGO_FAST_SEARCH_FEE_CLP = 800;
const RAPAGO_FAST_SEARCH_PROMPT_AFTER_MS = 2 * 60 * 1000;
// Política comercial RAPA GO:
// - Sin conductor asignado: cancelación gratuita en cualquier momento.
// - Con conductor asignado: cancelación gratuita durante 1 minuto desde acceptedAt.
// - Desde 1 minuto cumplido: 30% de la tarifa aplicable, con tope de $3.000.
// - No show después de 5 minutos desde arrivedAt: 50% de la tarifa, tope $5.000.
// - Si el conductor cancela, el viaje se reasigna y el reloj comienza de nuevo
//   cuando el nuevo conductor queda efectivamente asignado.
// El frontend es informativo; backend conserva la autoridad financiera.
const RAPAGO_FREE_CANCEL_AFTER_ACCEPTANCE_MS = 1 * 60 * 1000;
const RAPAGO_NO_SHOW_AFTER_ARRIVAL_MS = 5 * 60 * 1000;
const RAPAGO_CANCEL_FEE_CAP_CLP = 3000;
const RAPAGO_NO_SHOW_FEE_CAP_CLP = 5000;
const RAPAGO_LATE_CANCEL_PERCENT = 30;
const RAPAGO_NO_SHOW_PERCENT = 50;

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

const RAPAGO_PASSENGER_NO_SHOW_COMPLETED_RIDES_KEY = "rapago_passenger_no_show_completed_rides_v1";

function normalizePassengerNoShowCompletedValue(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getPassengerNoShowCompletedIds(ride: Record<string, unknown>): string[] {
  return [
    ride.id,
    ride.rideId,
    ride.originalRideId,
    ride.serverRideId,
    ride.requestId,
  ]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
}

function getPassengerNoShowCompletedRouteKey(ride: Record<string, unknown>): string {
  return [
    ride.passengerEmail,
    ride.email,
    ride.originText,
    ride.destinationText,
    ride.scheduledAt,
    ride.scheduledPickupAt,
    ride.requestedAt,
    ride.createdAt,
  ]
    .map(normalizePassengerNoShowCompletedValue)
    .filter(Boolean)
    .join("|");
}

function passengerNoShowCompletedRideMatches(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): boolean {
  const aIds = getPassengerNoShowCompletedIds(a);
  const bIds = new Set(getPassengerNoShowCompletedIds(b));

  if (aIds.length > 0 && aIds.some((id) => bIds.has(id))) return true;

  const aRoute = getPassengerNoShowCompletedRouteKey(a);
  const bRoute = getPassengerNoShowCompletedRouteKey(b);

  return Boolean(aRoute && bRoute && aRoute === bRoute);
}

function readPassengerNoShowCompletedRides(): Array<Record<string, unknown>> {
  try {
    const raw = localStorage.getItem(RAPAGO_PASSENGER_NO_SHOW_COMPLETED_RIDES_KEY);
    const parsed = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === "object") : [];
  } catch {
    return [];
  }
}

function isPassengerNoShowCompletedRide(ride: RideRequestData | Record<string, unknown>): boolean {
  const record = ride as Record<string, unknown>;

  if (
    record.driverNoShowClosed === true ||
    record.noShowCompleted === true ||
    record.noShowConfirmedByDriver === true ||
    String(record.driverFinalState ?? "") === "no_show_completed" ||
    String(record.cancelledByRole ?? record.cancelledBy ?? "").toLowerCase().includes("driver_no_show")
  ) {
    return true;
  }

  return readPassengerNoShowCompletedRides().some((item) =>
    passengerNoShowCompletedRideMatches(item, record),
  );
}

function getPassengerNoShowCompletedEffectiveStatus(ride: RideRequestData): string {
  const effectiveStatus = getEffectivePassengerRideStatus(ride);

  // Un viaje que todavía está buscando conductor, aceptado, en camino, esperando
  // al pasajero o en curso NUNCA debe contabilizarse como completado por un
  // registro No Show antiguo que coincida por ruta. Esto evita que una solicitud
  // nueva aparezca dentro de "Completados" antes de finalizar realmente.
  if (effectiveStatus === "pending_payment" || ACTIVE_STATUSES.includes(effectiveStatus)) return effectiveStatus;

  if (isPassengerNoShowCompletedRide(ride)) return "completed";
  return effectiveStatus;
}



type RapaGoDriverRatingRecord = {
  id: string;
  rideId: string;
  rideKey: string;
  driverKey: string;
  driverId?: string | null;
  driverUserId?: string | null;
  driverEmail?: string | null;
  driverPhone?: string | null;
  driverName?: string | null;
  passengerKey: string;
  passengerEmail?: string | null;
  passengerName?: string | null;
  stars: number;
  comment?: string | null;
  extras?: string[];
  commentVisibility?: "participants_and_admin" | "admin_only";
  originText?: string | null;
  destinationText?: string | null;
  createdAt: string;
};

const RAPAGO_DRIVER_RATINGS_KEY = "rapago_driver_ratings_v1";
const RAPAGO_DRIVER_RATINGS_EVENT = "rapago:driver-ratings-updated";

function normalizeRatingIdentity(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function ratingStringValue(value: unknown): string {
  return String(value ?? "").trim();
}

function getRatingObjectString(source: unknown, keys: string[]): string {
  if (!source || typeof source !== "object") return "";
  const record = source as Record<string, unknown>;

  for (const key of keys) {
    const value = ratingStringValue(record[key]);
    if (value) return value;
  }

  return "";
}

function getPassengerRatingKey(user: unknown, ride?: Partial<RideRequestData> & Record<string, unknown>): string {
  const email = getRatingObjectString(user, ["email", "mail"])
    || ratingStringValue(ride?.passengerEmail)
    || ratingStringValue(ride?.email);
  if (email) return `email:${normalizeRatingIdentity(email)}`;

  const id = getRatingObjectString(user, ["id", "userId", "uid"])
    || ratingStringValue(ride?.passengerId)
    || ratingStringValue(ride?.userId);
  if (id) return `id:${normalizeRatingIdentity(id)}`;

  const name = getRatingObjectString(user, ["name", "fullName", "displayName"])
    || ratingStringValue(ride?.passengerName)
    || ratingStringValue(ride?.userName);
  if (name) return `name:${normalizeRatingIdentity(name)}`;

  return "passenger:local";
}

function getPassengerRatingRideKey(ride: Partial<RideRequestData> & Record<string, unknown>): string {
  const id = ratingStringValue(ride.id ?? ride.rideId ?? ride.originalRideId ?? ride.serverRideId);
  if (id) return `ride:${id}`;

  return `route:${getRideDedupeKey(ride as RideRequestData & Record<string, unknown>)}`;
}

function getRideDriverRatingKey(ride: Partial<RideRequestData> & Record<string, unknown>): string {
  const driverId = ratingStringValue(ride.driverId ?? ride.driverUserId ?? ride.driverOwnerKey ?? ride.ownerKey);
  if (driverId) return `id:${normalizeRatingIdentity(driverId)}`;

  const email = ratingStringValue(ride.driverEmail ?? ride.driverMail);
  if (email) return `email:${normalizeRatingIdentity(email)}`;

  const phone = ratingStringValue(ride.driverPhone ?? ride.driverPhoneNumber ?? ride.driverMobile);
  if (phone) return `phone:${normalizeRatingIdentity(phone)}`;

  const name = ratingStringValue(ride.driverName ?? ride.driverFullName);
  if (name) return `name:${normalizeRatingIdentity(name)}`;

  const vehicle = ratingStringValue(ride.driverVehiclePlate ?? ride.vehiclePlate);
  if (vehicle) return `plate:${normalizeRatingIdentity(vehicle)}`;

  return "driver:unknown";
}

function parseRapaGoDriverRatings(raw: string | null): RapaGoDriverRatingRecord[] {
  try {
    const parsed = raw ? (JSON.parse(raw) as RapaGoDriverRatingRecord[]) : [];
    return Array.isArray(parsed)
      ? parsed.filter((item) => item && typeof item === "object" && Number.isFinite(Number(item.stars)))
      : [];
  } catch { return []; }
}

function readRapaGoDriverRatings(): RapaGoDriverRatingRecord[] {
  const sessionItems = parseRapaGoDriverRatings(sessionStorage.getItem(RAPAGO_DRIVER_RATINGS_KEY));
  return sessionItems.length > 0 ? sessionItems : parseRapaGoDriverRatings(localStorage.getItem(RAPAGO_DRIVER_RATINGS_KEY));
}

function writeRapaGoDriverRatings(records: RapaGoDriverRatingRecord[]): void {
  try {
    const limited = records.slice(0, 600);
    sessionStorage.setItem(RAPAGO_DRIVER_RATINGS_KEY, JSON.stringify(limited));
    localStorage.setItem(RAPAGO_DRIVER_RATINGS_KEY, JSON.stringify(limited.map((item) => ({ ...item, comment: null }))));
    window.dispatchEvent(new CustomEvent(RAPAGO_DRIVER_RATINGS_EVENT, { detail: { ratings: limited } }));
    window.dispatchEvent(new CustomEvent("rapago:driver-profile-updated", { detail: { ratings: limited } }));
  } catch { /* No bloquea la calificación. */ }
}

function upsertPassengerDriverRating(
  ride: RideRequestData,
  stars: number,
  comment: string,
  user: unknown,
  extras: string[] = [],
  commentVisibility: "participants_and_admin" | "admin_only" = "participants_and_admin",
): RapaGoDriverRatingRecord {
  const rideRecord = ride as RideRequestData & Record<string, unknown>;
  const rideKey = getPassengerRatingRideKey(rideRecord);
  const passengerKey = getPassengerRatingKey(user, rideRecord);
  const driverKey = getRideDriverRatingKey(rideRecord);
  const now = new Date().toISOString();
  const safeStars = Math.min(5, Math.max(1, Math.round(Number(stars) || 5)));
  const current = readRapaGoDriverRatings();

  const nextRecord: RapaGoDriverRatingRecord = {
    id: `rating-${rideKey}-${passengerKey}`,
    rideId: ratingStringValue(rideRecord.id ?? rideRecord.rideId ?? rideRecord.originalRideId ?? rideKey),
    rideKey,
    driverKey,
    driverId: ratingStringValue(rideRecord.driverId ?? rideRecord.driverUserId) || null,
    driverUserId: ratingStringValue(rideRecord.driverUserId) || null,
    driverEmail: ratingStringValue(rideRecord.driverEmail) || null,
    driverPhone: ratingStringValue(rideRecord.driverPhone ?? rideRecord.driverPhoneNumber ?? rideRecord.driverMobile) || null,
    driverName: ratingStringValue(rideRecord.driverName ?? rideRecord.driverFullName) || null,
    passengerKey,
    passengerEmail: ratingStringValue((user as Record<string, unknown> | null)?.email ?? rideRecord.passengerEmail) || null,
    passengerName: ratingStringValue((user as Record<string, unknown> | null)?.name ?? rideRecord.passengerName ?? rideRecord.userName) || null,
    stars: safeStars,
    comment: comment.trim() || null,
    extras: Array.from(new Set(extras.map((item) => item.trim()).filter(Boolean))).slice(0, 12),
    originText: ratingStringValue(rideRecord.originText) || null,
    destinationText: ratingStringValue(rideRecord.destinationText) || null,
    createdAt: now,
  };

  const next = [
    nextRecord,
    ...current.filter((item) => !(item.rideKey === rideKey && item.passengerKey === passengerKey)),
  ];

  writeRapaGoDriverRatings(next);
  return nextRecord;
}

function passengerHasRatedRide(ride: RideRequestData, user: unknown): boolean {
  const record = ride as RideRequestData & Record<string, unknown>;
  const rideKey = getPassengerRatingRideKey(record);
  const passengerKey = getPassengerRatingKey(user, record);

  return readRapaGoDriverRatings().some((item) =>
    item.rideKey === rideKey && (!item.passengerKey || item.passengerKey === passengerKey),
  );
}

function readPassengerRatedRideIds(rides: RideRequestData[], user: unknown): Set<string> {
  const ids = new Set<string>();

  for (const ride of rides) {
    if (passengerHasRatedRide(ride, user)) ids.add(ride.id);
  }

  return ids;
}


const RAPAGO_PASSENGER_RATING_DISMISSED_KEY =
  "rapago_passenger_rating_dismissed_v1";
const RAPAGO_PASSENGER_AUTO_RATING_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function readPassengerDismissedRatingRideIds(): Set<string> {
  try {
    const raw = localStorage.getItem(RAPAGO_PASSENGER_RATING_DISMISSED_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(
      Array.isArray(parsed)
        ? parsed.map((value) => String(value ?? "").trim()).filter(Boolean)
        : [],
    );
  } catch {
    return new Set();
  }
}

function writePassengerDismissedRatingRideIds(ids: Set<string>): void {
  try {
    localStorage.setItem(
      RAPAGO_PASSENGER_RATING_DISMISSED_KEY,
      JSON.stringify(Array.from(ids).slice(-300)),
    );
  } catch {
    // Omitir la calificación no debe bloquear el viaje.
  }
}

function rememberPassengerDismissedRatingRide(rideId: string): void {
  const cleanRideId = String(rideId ?? "").trim();
  if (!cleanRideId) return;

  const ids = readPassengerDismissedRatingRideIds();
  ids.add(cleanRideId);
  writePassengerDismissedRatingRideIds(ids);
}

function getPassengerRideCompletedTimestampMs(
  ride: RideRequestData & Record<string, unknown>,
): number | null {
  const explicit = [
    ride.completedAt,
    ride.closedAt,
    ride.closedByDriverAt,
    ride.updatedAt,
  ]
    .map((value) => Date.parse(String(value ?? "")))
    .find((value) => Number.isFinite(value));

  return explicit != null ? explicit : null;
}

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

const RAPAGO_PASSENGER_DRIVER_ARRIVED_TIMER_KEY = "rapago_passenger_driver_arrived_timer_v1";

function getPassengerDriverArrivedRideKey(
  ride: Partial<RideRequestData> & Record<string, unknown>,
): string {
  const id = String(ride.id ?? ride.rideId ?? ride.originalRideId ?? ride.serverRideId ?? "").trim();
  if (id) return `ride:${id}`;

  return [
    String(ride.passengerEmail ?? ride.email ?? "").trim().toLowerCase(),
    String(ride.originText ?? "").trim().toLowerCase(),
    String(ride.destinationText ?? "").trim().toLowerCase(),
    String(ride.scheduledAt ?? ride.scheduledPickupAt ?? ride.requestedAt ?? ride.createdAt ?? "").trim(),
  ].filter(Boolean).join("|");
}

function readPassengerDriverArrivedTimerMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(RAPAGO_PASSENGER_DRIVER_ARRIVED_TIMER_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed)
        .map(([key, value]) => [key, Number(value)] as const)
        .filter((entry): entry is readonly [string, number] => Number.isFinite(entry[1]) && entry[1] > 0),
    );
  } catch {
    return {};
  }
}

function writePassengerDriverArrivedTimerMap(map: Record<string, number>): void {
  try {
    localStorage.setItem(RAPAGO_PASSENGER_DRIVER_ARRIVED_TIMER_KEY, JSON.stringify(map));
  } catch {
    // No bloquea Mis Viajes.
  }
}

function getPassengerDriverArrivedTimestampMs(
  ride: Partial<RideRequestData> & Record<string, unknown>,
): number | null {
  const candidates = [
    ride.driverArrivedAt,
    ride.arrivedAt,
    ride.driverReachedPickupAt,
    ride.noShowCountdownStartedAt,
    ride.updatedAt,
  ];

  for (const candidate of candidates) {
    const parsed = new Date(String(candidate ?? "")).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

function ensurePassengerDriverArrivedTimerStartMs(
  ride: Partial<RideRequestData> & Record<string, unknown>,
  nowMs = Date.now(),
): number {
  const key = getPassengerDriverArrivedRideKey(ride);
  const current = readPassengerDriverArrivedTimerMap();
  const stored = Number(current[key]);

  if (Number.isFinite(stored) && stored > 0) return stored;

  const fromRide = getPassengerDriverArrivedTimestampMs(ride);
  const startAt = fromRide ?? nowMs;

  writePassengerDriverArrivedTimerMap({
    ...current,
    [key]: startAt,
  });

  return startAt;
}

function getPassengerDriverArrivedCountdownState(
  ride: Partial<RideRequestData> & Record<string, unknown>,
  nowMs = Date.now(),
): {
  remainingMs: number;
  elapsedMs: number;
  finished: boolean;
} {
  const startAt = ensurePassengerDriverArrivedTimerStartMs(ride, nowMs);
  const elapsedMs = Math.max(0, nowMs - startAt);
  const remainingMs = Math.max(0, RAPAGO_NO_SHOW_AFTER_ARRIVAL_MS - elapsedMs);

  return {
    remainingMs,
    elapsedMs,
    finished: remainingMs <= 0,
  };
}

function passengerNotificationBelongsToRide(
  item: PassengerNotificationPayload,
  ride: Partial<RideRequestData> & Record<string, unknown>,
): boolean {
  const notificationRideId = String(item.rideId ?? "").trim();
  const rideIds = [
    ride.id,
    ride.rideId,
    ride.originalRideId,
    ride.serverRideId,
  ].map((value) => String(value ?? "").trim()).filter(Boolean);

  return Boolean(notificationRideId && rideIds.includes(notificationRideId));
}

function addPassengerDriverArrivedNotification(ride: RideRequestData): void {
  const record = ride as RideRequestData & Record<string, unknown>;
  const rideId = String(record.id ?? record.rideId ?? getPassengerDriverArrivedRideKey(record));
  const id = `driver-arrived-${rideId}`;

  try {
    const current = readPassengerNotifications();
    if (current.some((item) => item.id === id)) return;

    const notification: PassengerNotificationPayload = {
      id,
      rideId,
      type: "driver_arrived",
      title: "Tu conductor llegó",
      body: `Sal ahora al punto de recogida: ${String(ride.originText ?? "punto indicado")}. Tienes 5 minutos antes de que pueda aplicar No show.`,
      createdAt: new Date().toISOString(),
      read: false,
    };

    localStorage.setItem(
      RAPAGO_PASSENGER_NOTIFICATIONS_KEY,
      JSON.stringify([notification, ...current].slice(0, 100)),
    );

    window.dispatchEvent(new CustomEvent("rapago:passenger-notifications-updated", { detail: { notification } }));
    window.dispatchEvent(new CustomEvent("rapago:passenger-rides-updated", { detail: { ride, notification } }));
  } catch {
    // No bloquea Mis Viajes.
  }
}

function getLatestPassengerNoShowNotificationForRide(ride: RideRequestData): PassengerNotificationPayload | null {
  const record = ride as RideRequestData & Record<string, unknown>;
  const notices = readPassengerNotifications()
    .filter((item) =>
      (
        item.type === "no_show_warning" ||
        item.type === "driver_arrived" ||
        String(item.title ?? "").toLowerCase().includes("conductor llegó")
      ) &&
      (
        passengerNotificationBelongsToRide(item, record) ||
        !String(item.rideId ?? "").trim()
      ),
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return notices[0] ?? null;
}

const RAPAGO_PASSENGER_DRIVER_ACCEPTED_TIMER_KEY = "rapago_passenger_driver_accepted_timer_v1";

function passengerAcceptedTimerStatus(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function passengerStatusStartsAcceptedTimer(status: string): boolean {
  return ["accepted", "driver_en_route", "driver_arrived", "in_progress"].includes(status);
}

function getPassengerDriverAcceptedTimerRideKey(
  ride: Partial<RideRequestData> & Record<string, unknown>,
): string {
  const id = String(ride.id ?? ride.rideId ?? ride.originalRideId ?? ride.serverRideId ?? "").trim();
  if (id) return `ride:${id}`;

  return [
    String(ride.passengerEmail ?? ride.email ?? "").trim().toLowerCase(),
    String(ride.originText ?? "").trim().toLowerCase(),
    String(ride.destinationText ?? "").trim().toLowerCase(),
    String(ride.scheduledAt ?? ride.scheduledPickupAt ?? ride.requestedAt ?? ride.createdAt ?? "").trim(),
  ].filter(Boolean).join("|");
}

function readPassengerDriverAcceptedTimerMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(RAPAGO_PASSENGER_DRIVER_ACCEPTED_TIMER_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed)
        .map(([key, value]) => [key, Number(value)] as const)
        .filter((entry): entry is readonly [string, number] => Number.isFinite(entry[1]) && entry[1] > 0),
    );
  } catch {
    return {};
  }
}

function writePassengerDriverAcceptedTimerMap(map: Record<string, number>): void {
  try {
    localStorage.setItem(RAPAGO_PASSENGER_DRIVER_ACCEPTED_TIMER_KEY, JSON.stringify(map));
  } catch {
    // No bloquea Mis Viajes.
  }
}

function getPassengerDriverAcceptedExplicitTimestampMs(
  ride: Partial<RideRequestData> & Record<string, unknown>,
): number | null {
  const candidates = [
    ride.acceptedAt,
    ride.driverAcceptedAt,
    ride.driverAcceptedScheduleAt,
    ride.driverScheduleAcceptedAt,
    ride.scheduledDriverAcceptedAt,
    ride.driverConfirmedAt,
    ride.enRouteAt,
  ];

  for (const candidate of candidates) {
    const parsed = new Date(String(candidate ?? "")).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

function ensurePassengerDriverAcceptedTimerStartMs(
  ride: Partial<RideRequestData> & Record<string, unknown>,
  nowMs = Date.now(),
): number {
  const key = getPassengerDriverAcceptedTimerRideKey(ride);
  const current = readPassengerDriverAcceptedTimerMap();
  const stored = Number(current[key]);

  if (Number.isFinite(stored) && stored > 0) return stored;

  const fromRide = getPassengerDriverAcceptedExplicitTimestampMs(ride);
  const startAt = fromRide ?? nowMs;

  writePassengerDriverAcceptedTimerMap({
    ...current,
    [key]: startAt,
  });

  return startAt;
}

function getPassengerDriverAcceptedPolicyTimestampMs(
  ride: Partial<RideRequestData> & Record<string, unknown>,
  nowMs = Date.now(),
): number | null {
  const explicit = getPassengerDriverAcceptedExplicitTimestampMs(ride);
  if (explicit != null) return explicit;

  const status = passengerAcceptedTimerStatus(ride.status);
  if (!passengerStatusStartsAcceptedTimer(status)) return null;

  return ensurePassengerDriverAcceptedTimerStartMs(ride, nowMs);
}

function getPassengerDriverAcceptedCountdownState(
  ride: Partial<RideRequestData> & Record<string, unknown>,
  nowMs = Date.now(),
): {
  elapsedMs: number;
  remainingFreeMs: number;
  isFree: boolean;
} {
  const acceptedAtMs = getPassengerDriverAcceptedPolicyTimestampMs(ride, nowMs);
  const elapsedMs = acceptedAtMs == null ? 0 : Math.max(0, nowMs - acceptedAtMs);
  const remainingFreeMs = Math.max(0, RAPAGO_FREE_CANCEL_AFTER_ACCEPTANCE_MS - elapsedMs);

  return {
    elapsedMs,
    remainingFreeMs,
    isFree: remainingFreeMs > 0,
  };
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

type PassengerFastSearchRecord = {
  rideKey: string;
  rideId?: string | null;
  accepted: boolean;
  dismissed: boolean;
  feeClp: number;
  offeredAt: string;
  respondedAt: string;
  paymentMethod?: "cash" | "card" | null;
  paymentStatus?: "approved" | "pending" | "rejected" | null;
};

type PassengerCancellationReasonCode =
  | "passenger_change"
  | "driver_vehicle_mismatch"
  | "safety_risk"
  | "platform_duplicate"
  | "operator_driver_fault"
  | "other";

type PassengerCancellationReason = {
  code: PassengerCancellationReasonCode;
  label: string;
  exemptFromFee: boolean;
};

const PASSENGER_CANCELLATION_REASONS: PassengerCancellationReason[] = [
  {
    code: "passenger_change",
    label: "Cambio de planes u otro motivo personal",
    exemptFromFee: false,
  },
  {
    code: "driver_vehicle_mismatch",
    label: "El conductor o vehículo no coincide con la información de la App",
    exemptFromFee: true,
  },
  {
    code: "safety_risk",
    label: "Riesgo o preocupación de seguridad",
    exemptFromFee: true,
  },
  {
    code: "platform_duplicate",
    label: "Solicitud duplicada atribuible a la Plataforma",
    exemptFromFee: true,
  },
  {
    code: "operator_driver_fault",
    label: "Problema atribuible al Operador o al conductor",
    exemptFromFee: true,
  },
  {
    code: "other",
    label: "Otro motivo",
    exemptFromFee: false,
  },
];

function getPassengerCancellationReason(
  value: unknown,
): PassengerCancellationReason {
  const code = String(value ?? "") as PassengerCancellationReasonCode;
  return (
    PASSENGER_CANCELLATION_REASONS.find((item) => item.code === code) ??
    PASSENGER_CANCELLATION_REASONS[0]!
  );
}

type PassengerCancellationPolicy = {
  type: "free" | "late_cancel" | "no_show";
  feeClp: number;
  candidateFeeClp: number;
  applicableFareClp: number;
  feePercent: number;
  feeCapClp: number;
  title: string;
  message: string;
  detail: string;
  acceptedElapsedMs: number | null;
  arrivedElapsedMs: number | null;
  requiresAdminReview: boolean;
  exemptionRequested: boolean;
  cancellationReasonCode?: PassengerCancellationReasonCode | null;
  cancellationReasonLabel?: string | null;
};

function applyPassengerCancellationReasonToPolicy(
  policy: PassengerCancellationPolicy,
  reasonCode: unknown,
): PassengerCancellationPolicy {
  const reason = getPassengerCancellationReason(reasonCode);
  const exemptionRequested =
    reason.exemptFromFee && policy.candidateFeeClp > 0;

  return {
    ...policy,
    feeClp: exemptionRequested ? 0 : policy.candidateFeeClp,
    requiresAdminReview: policy.candidateFeeClp > 0,
    exemptionRequested,
    cancellationReasonCode: reason.code,
    cancellationReasonLabel: reason.label,
    title: exemptionRequested
      ? "Cancelación con solicitud de exención"
      : policy.title,
    message: exemptionRequested
      ? "La cancelación se realizará sin aplicar un cargo automático. Administración revisará la causa informada."
      : policy.message,
    detail: exemptionRequested
      ? `Motivo informado: ${reason.label}. El cargo referencial de ${formatClp(policy.candidateFeeClp)} queda suspendido hasta revisión del administrador.`
      : policy.detail,
  };
}

function getPassengerRideStableKey(ride: Partial<RideRequestData> & Record<string, unknown>): string {
  const id = String(ride.id ?? ride.rideId ?? ride.originalRideId ?? ride.serverRideId ?? "").trim();
  if (id) return `id:${id}`;

  const routeKey = getRideDedupeKey(ride as RideRequestData & Record<string, unknown>);
  return routeKey ? `route:${routeKey}` : `fallback:${Date.now()}`;
}

function readPassengerFastSearchMap(): Record<string, PassengerFastSearchRecord> {
  try {
    const raw = localStorage.getItem(RAPAGO_FAST_SEARCH_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, PassengerFastSearchRecord>) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writePassengerFastSearchMap(map: Record<string, PassengerFastSearchRecord>): void {
  try {
    localStorage.setItem(RAPAGO_FAST_SEARCH_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // No bloquea Mis Viajes si el navegador no permite guardar.
  }
}

function getPassengerFastSearchRecord(ride: Partial<RideRequestData> & Record<string, unknown>): PassengerFastSearchRecord | null {
  const key = getPassengerRideStableKey(ride);
  const id = String(ride.id ?? ride.rideId ?? ride.originalRideId ?? ride.serverRideId ?? "").trim();
  const notes = String(ride.notes ?? "");
  const backendActive =
    /RAPAGO_FAST_SEARCH_ACTIVE:\s*true/i.test(notes) ||
    ride.rapagoFastSearchAccepted === true ||
    ride.fastSearchRequested === true;

  if (backendActive) {
    const feeFromNotes = Number(
      notes.match(/RAPAGO_FAST_SEARCH_FEE_CLP:\s*(\d+)/i)?.[1] ??
        ride.rapagoFastSearchFeeClp ??
        ride.fastSearchFeeClp ??
        RAPAGO_FAST_SEARCH_FEE_CLP,
    );
    const methodText = String(
      notes.match(/RAPAGO_FAST_SEARCH_PAYMENT_METHOD:\s*(cash|card)/i)?.[1] ??
        ride.rapagoFastSearchPaymentMethod ??
        ride.fastSearchPaymentMethod ??
        "",
    ).toLowerCase();

    return {
      rideKey: key,
      rideId: id || null,
      accepted: true,
      dismissed: false,
      feeClp: Number.isFinite(feeFromNotes) && feeFromNotes > 0
        ? Math.round(feeFromNotes)
        : RAPAGO_FAST_SEARCH_FEE_CLP,
      offeredAt: String(ride.rapagoFastSearchOfferedAt ?? ride.fastSearchOfferedAt ?? ride.updatedAt ?? new Date().toISOString()),
      respondedAt: String(ride.rapagoFastSearchRespondedAt ?? ride.fastSearchRespondedAt ?? ride.updatedAt ?? new Date().toISOString()),
      paymentMethod: methodText === "card" ? "card" : methodText === "cash" ? "cash" : null,
      paymentStatus: "approved",
    };
  }

  const map = readPassengerFastSearchMap();
  const byKey = map[key];
  if (byKey) return byKey;

  if (id) {
    const found = Object.values(map).find((record) => record.rideId === id);
    if (found) return found;
  }

  if (ride.rapagoFastSearchDismissed === true) {
    return {
      rideKey: key,
      rideId: id || null,
      accepted: false,
      dismissed: true,
      feeClp: 0,
      offeredAt: String(ride.rapagoFastSearchOfferedAt ?? new Date().toISOString()),
      respondedAt: String(ride.rapagoFastSearchRespondedAt ?? new Date().toISOString()),
      paymentMethod: null,
      paymentStatus: null,
    };
  }

  return null;
}

function getPassengerFastSearchFeeClp(ride: Partial<RideRequestData> & Record<string, unknown>): number {
  const record = getPassengerFastSearchRecord(ride);
  if (!record?.accepted) return 0;

  const fee = Number(record.feeClp || RAPAGO_FAST_SEARCH_FEE_CLP);
  return Number.isFinite(fee) && fee > 0 ? Math.round(fee) : RAPAGO_FAST_SEARCH_FEE_CLP;
}

function getPassengerRideBaseFareClp(ride: RideRequestData): number | null {
  const notes = String(ride.notes ?? "");
  const backendFastSearchActive = /RAPAGO_FAST_SEARCH_ACTIVE:\s*true/i.test(notes);

  if (
    backendFastSearchActive &&
    ride.estimatedFareClp != null &&
    Number.isFinite(Number(ride.estimatedFareClp))
  ) {
    return Math.round(Number(ride.estimatedFareClp));
  }

  const noteFare = extractFareFromNotes(ride.notes);
  if (noteFare != null) return noteFare;

  if (ride.estimatedFareClp != null && Number.isFinite(Number(ride.estimatedFareClp))) {
    return Math.round(Number(ride.estimatedFareClp));
  }

  const record = ride as RideRequestData & Record<string, unknown>;
  const candidates = [
    record.fareClp,
    record.priceClp,
    record.totalFareClp,
    record.passengerFareClp,
  ];

  for (const candidate of candidates) {
    const parsed = Number(candidate);
    if (Number.isFinite(parsed) && parsed > 0) return Math.round(parsed);
  }

  return null;
}

function addFastSearchFeeToBaseFare(ride: RideRequestData, baseFare: number | null): number | null {
  if (baseFare == null) return null;

  const record = ride as RideRequestData & Record<string, unknown>;
  const alreadyIncluded =
    record.rapagoFastSearchFareIncluded === true ||
    /RapaGo m[aá]s veloz:\s*incluido/i.test(String(ride.notes ?? ""));

  return Math.round(baseFare + (alreadyIncluded ? 0 : getPassengerFastSearchFeeClp(record)));
}

function getPassengerRideStartedAtMs(ride: RideRequestData & Record<string, unknown>): number | null {
  const schedule = getPassengerRideScheduleInfo(ride);
  const effectiveStatus = getEffectivePassengerRideStatus(ride);
  const requeueMirror = isDriverCancelledRequeuedRide(ride)
    ? ride
    : findPassengerDriverCancelledRequeueMirror(ride);

  if (requeueMirror) {
    const requeueMs = getPassengerDriverRequeueTimestampMs(requeueMirror);
    if (requeueMs != null) return requeueMs;
  }

  if (schedule.isScheduled && effectiveStatus === "requested" && schedule.pickupActivationAt) {
    const activationMs = new Date(schedule.pickupActivationAt).getTime();
    if (Number.isFinite(activationMs)) return activationMs;
  }

  const isRequestedCardRide =
    effectiveStatus === "requested" &&
    getRidePaymentMethodLabel(ride).startsWith("Tarjeta /");

  const candidates = [
    ride.searchStartedAt,
    ride.requeuedAt,
    ...(isRequestedCardRide ? [ride.updatedAt] : []),
    ride.requestedAt,
    ride.createdAt,
    ride.adminBridgeUpdatedAt,
    ...(isRequestedCardRide ? [] : [ride.updatedAt]),
  ];

  for (const candidate of candidates) {
    const parsed = new Date(String(candidate ?? "")).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

function formatPassengerElapsedTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function shouldShowPassengerFastSearchPrompt(ride: RideRequestData & Record<string, unknown>, nowMs: number): boolean {
  if (getEffectivePassengerRideStatus(ride) !== "requested") return false;
  if (getPassengerFastSearchRecord(ride)) return false;

  const startedAtMs = getPassengerRideStartedAtMs(ride);
  if (startedAtMs == null) return false;

  return nowMs - startedAtMs >= RAPAGO_FAST_SEARCH_PROMPT_AFTER_MS;
}

function appendPassengerRideNoteOnce(notes: string | null | undefined, line: string): string {
  const current = String(notes ?? "").trim();
  if (current.toLowerCase().includes(line.toLowerCase())) return current;
  return `${current}${current ? " " : ""}${line}`.trim();
}

function buildPassengerFastSearchRidePatch(
  ride: Partial<RideRequestData> & Record<string, unknown>,
  record: PassengerFastSearchRecord,
): Record<string, unknown> {
  const accepted = record.accepted;
  const fee = accepted ? record.feeClp : 0;
  const notesBefore = String(ride.notes ?? "");
  const alreadyIncluded =
    /RAPAGO_FAST_SEARCH_ACTIVE:\s*true/i.test(notesBefore) ||
    ride.rapagoFastSearchFareIncluded === true;
  const directFare = Number(ride.estimatedFareClp);
  const updatedFare =
    accepted && !alreadyIncluded && Number.isFinite(directFare) && directFare > 0
      ? Math.round(directFare + fee)
      : Number.isFinite(directFare) && directFare > 0
        ? Math.round(directFare)
        : ride.estimatedFareClp;

  let notes = notesBefore;
  if (accepted) {
    notes = appendPassengerRideNoteOnce(notes, "RAPAGO_FAST_SEARCH_ACTIVE: true");
    notes = appendPassengerRideNoteOnce(notes, `RAPAGO_FAST_SEARCH_FEE_CLP: ${fee}`);
    notes = appendPassengerRideNoteOnce(notes, `RAPAGO_FAST_SEARCH_PAYMENT_METHOD: ${record.paymentMethod ?? "cash"}`);
    notes = appendPassengerRideNoteOnce(notes, "RAPAGO_FAST_SEARCH_PAYMENT_STATUS: approved");
    notes = appendPassengerRideNoteOnce(notes, `RapaGo más veloz: incluido en el total. Recargo: ${formatClp(fee)}.`);
  } else {
    notes = appendPassengerRideNoteOnce(notes, "RapaGo más veloz: el pasajero lo rechazó.");
  }

  return {
    rapagoFastSearchOfferedAt: record.offeredAt,
    rapagoFastSearchRespondedAt: record.respondedAt,
    rapagoFastSearchAccepted: accepted,
    rapagoFastSearchDismissed: record.dismissed,
    rapagoFastSearchFeeClp: fee,
    rapagoFastSearchPaymentMethod: record.paymentMethod ?? null,
    rapagoFastSearchPaymentStatus: record.paymentStatus ?? null,
    rapagoFastSearchFareIncluded: accepted,
    fastSearchRequested: accepted,
    fastSearchFeeClp: fee,
    fastSearchPaymentMethod: record.paymentMethod ?? null,
    fastSearchPaymentStatus: record.paymentStatus ?? null,
    passengerPrioritySearch: accepted,
    estimatedFareClp: updatedFare,
    passengerNotice: accepted
      ? `Activaste RapaGo más veloz. Se agregan ${formatClp(fee)} a la tarifa.`
      : ride.passengerNotice ?? null,
    passengerNotification: accepted
      ? `RapaGo más veloz activo: ${formatClp(fee)} se agregan al monto final.`
      : ride.passengerNotification ?? null,
    notes,
  };
}

function updatePassengerFastSearchRideStorage(
  target: RideRequestData & Record<string, unknown>,
  record: PassengerFastSearchRecord,
): void {
  const patch = buildPassengerFastSearchRidePatch(target, record);
  const keys = [
    LOCAL_PASSENGER_RIDES_KEY,
    RAPAGO_REQUEUED_RIDES_KEY,
    RAPAGO_REQUEUED_PASSENGER_FORCE_KEY,
    RAPAGO_ADMIN_SCHEDULED_RIDES_KEY,
    "rapago_admin_scheduled_rides",
    "rapago_admin_scheduled_rides_v2",
    "rapago_admin_scheduled_rides_force_v1",
    "rapago_bridge_scheduled_rides_v1",
    "rapago_driver_available_rides_v1",
    "rapago_bridge_available_rides_v1",
  ];

  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) continue;

      let changed = false;
      const next = parsed.map((item) => {
        if (!item || typeof item !== "object") return item;
        const ride = item as RideRequestData & Record<string, unknown>;
        if (!isSamePassengerRideCancelTarget(ride, target)) return item;
        changed = true;
        return { ...ride, ...patch };
      });

      if (changed) localStorage.setItem(key, JSON.stringify(next.slice(0, 200)));
    } catch {
      // No bloquea la mejora rápida si algún storage antiguo está corrupto.
    }
  }

  try {
    const rawLast = localStorage.getItem("rapago_last_scheduled_ride_for_admin");
    const parsedLast = rawLast ? (JSON.parse(rawLast) as RideRequestData & Record<string, unknown>) : null;
    if (parsedLast && isSamePassengerRideCancelTarget(parsedLast, target)) {
      localStorage.setItem("rapago_last_scheduled_ride_for_admin", JSON.stringify({ ...parsedLast, ...patch }));
    }
  } catch {
    // No bloquea la mejora rápida.
  }
}

function addPassengerFastSearchNotification(record: PassengerFastSearchRecord): void {
  if (!record.accepted) return;

  try {
    const current = readPassengerNotifications();
    const exists = current.some((item) => item.rideId === String(record.rideId ?? record.rideKey) && item.type === "fast_search_enabled");
    if (exists) return;

    localStorage.setItem(
      RAPAGO_PASSENGER_NOTIFICATIONS_KEY,
      JSON.stringify([
        {
          id: `fast-${record.rideId ?? record.rideKey}-${Date.now()}`,
          rideId: String(record.rideId ?? record.rideKey),
          type: "fast_search_enabled",
          title: "RapaGo más veloz activo",
          body: `Se agregan ${formatClp(record.feeClp)} a la tarifa para priorizar tu búsqueda.`,
          createdAt: new Date().toISOString(),
          read: false,
        },
        ...current,
      ].slice(0, 80)),
    );
  } catch {
    // Notificación opcional.
  }
}

function applyPassengerFastSearchApprovedLocally(
  ride: RideRequestData,
  paymentMethod: "cash" | "card",
): PassengerFastSearchRecord {
  const target = ride as RideRequestData & Record<string, unknown>;
  const now = new Date().toISOString();
  const key = getPassengerRideStableKey(target);
  const record: PassengerFastSearchRecord = {
    rideKey: key,
    rideId: String(target.id ?? "") || null,
    accepted: true,
    dismissed: false,
    feeClp: RAPAGO_FAST_SEARCH_FEE_CLP,
    offeredAt: String(target.rapagoFastSearchOfferedAt ?? now),
    respondedAt: now,
    paymentMethod,
    paymentStatus: "approved",
  };

  const map = readPassengerFastSearchMap();
  map[key] = record;
  writePassengerFastSearchMap(map);
  updatePassengerFastSearchRideStorage(target, record);
  addPassengerFastSearchNotification(record);

  window.dispatchEvent(new CustomEvent(RAPAGO_FAST_SEARCH_EVENT, { detail: { ride, record } }));
  window.dispatchEvent(new CustomEvent("rapago:passenger-rides-updated", { detail: { ride, record } }));
  window.dispatchEvent(new CustomEvent("rapago:driver-available-rides-updated", { detail: { ride, record } }));
  return record;
}

function dismissPassengerFastSearchLocally(ride: RideRequestData): void {
  const target = ride as RideRequestData & Record<string, unknown>;
  const now = new Date().toISOString();
  const key = getPassengerRideStableKey(target);
  const record: PassengerFastSearchRecord = {
    rideKey: key,
    rideId: String(target.id ?? "") || null,
    accepted: false,
    dismissed: true,
    feeClp: 0,
    offeredAt: String(target.rapagoFastSearchOfferedAt ?? now),
    respondedAt: now,
    paymentMethod: null,
    paymentStatus: null,
  };

  const map = readPassengerFastSearchMap();
  map[key] = record;
  writePassengerFastSearchMap(map);
  updatePassengerFastSearchRideStorage(target, record);
  window.dispatchEvent(new CustomEvent(RAPAGO_FAST_SEARCH_EVENT, { detail: { ride, record } }));
  window.dispatchEvent(new CustomEvent("rapago:passenger-rides-updated", { detail: { ride, record } }));
}

async function requestPassengerFastSearch(
  ride: RideRequestData,
  accessToken: string,
): Promise<{
  paymentId: string;
  urlPay: string;
  activated: boolean;
}> {
  const response = await fetch(`${getTripsApiBaseUrl()}/api/payments/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      rideRequestId: ride.id,
      paymentPurpose: "fast_search",
    }),
  });

  const raw = await response.json().catch(() => ({}));
  const payload = unwrapTripsApiPayload(raw);

  if (!response.ok) {
    throw new Error(
      String(payload.message ?? payload.error ?? "No se pudo activar RapaGo más veloz."),
    );
  }

  return {
    paymentId: String(payload.paymentId ?? ""),
    urlPay: String(payload.urlPay ?? ""),
    activated: payload.activated === true,
  };
}

async function fetchPassengerFastSearchPaymentStatus(
  accessToken: string,
  paymentId: string,
): Promise<string> {
  const response = await fetch(
    `${getTripsApiBaseUrl()}/api/payments/${encodeURIComponent(paymentId)}/status`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    },
  );

  const raw = await response.json().catch(() => ({}));
  const payload = unwrapTripsApiPayload(raw);

  if (!response.ok) {
    throw new Error(String(payload.message ?? "No se pudo verificar el recargo."));
  }

  return String(payload.status ?? "").trim().toLowerCase();
}

type MercadoPagoReconciliationResult = {
  id: string;
  rideRequestId: string;
  status: string;
  paymentPurpose: "ride" | "fast_search";
  providerPaymentId: string | null;
  activated: boolean;
  reconciled: boolean;
};

async function reconcileMercadoPagoReturnWithBackend(
  accessToken: string,
  paymentId: string,
  providerPaymentId?: string,
): Promise<MercadoPagoReconciliationResult> {
  const response = await fetch(
    `${getTripsApiBaseUrl()}/api/payments/${encodeURIComponent(paymentId)}/reconcile/mercadopago`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        ...(providerPaymentId ? { providerPaymentId } : {}),
      }),
    },
  );

  const raw = await response.json().catch(() => ({}));
  const payload = unwrapTripsApiPayload(raw);

  if (!response.ok) {
    throw new Error(
      String(
        payload.message ??
          payload.error ??
          "No se pudo conciliar el pago con Mercado Pago.",
      ),
    );
  }

  return {
    id: String(payload.id ?? paymentId),
    rideRequestId: String(payload.rideRequestId ?? ""),
    status: String(payload.status ?? "").trim().toLowerCase(),
    paymentPurpose:
      String(payload.paymentPurpose ?? "").trim().toLowerCase() === "fast_search"
        ? "fast_search"
        : "ride",
    providerPaymentId:
      typeof payload.providerPaymentId === "string" &&
      payload.providerPaymentId.trim()
        ? payload.providerPaymentId.trim()
        : null,
    activated: payload.activated === true,
    reconciled: payload.reconciled === true,
  };
}

async function applyPassengerFastSearchChoice(
  ride: RideRequestData,
  accepted: boolean,
  accessToken: string,
): Promise<void> {
  if (!accepted) {
    dismissPassengerFastSearchLocally(ride);
    return;
  }

  if (!accessToken) {
    throw new Error("Tu sesión expiró. Inicia sesión nuevamente para activar RapaGo más veloz.");
  }

  const paymentLabel = getRidePaymentMethodLabel(ride);
  const isCard = paymentLabel.includes("Mercado Pago");
  const result = await requestPassengerFastSearch(ride, accessToken);

  if (result.activated) {
    applyPassengerFastSearchApprovedLocally(ride, "cash");
    return;
  }

  if (!isCard || !result.paymentId || !result.urlPay) {
    throw new Error("El backend no devolvió el pago de RapaGo más veloz correctamente.");
  }

  savePendingFastSearchPayment({
    rideRequestId: ride.id,
    paymentId: result.paymentId,
    amountClp: RAPAGO_FAST_SEARCH_FEE_CLP,
    createdAt: new Date().toISOString(),
    rideMirror: ride as RideRequestData & Record<string, unknown>,
  });

  window.location.href = result.urlPay;
}

function getPassengerRideMinimumFareClp(ride: RideRequestData): number {
  const record = ride as RideRequestData & Record<string, unknown>;
  const fareType = getRidePassengerFareType(ride);
  const candidates: unknown[] = [];

  if (fareType === "resident") {
    candidates.push(record.residentMinimumFareClp, record.minimumFareResidentClp, record.minFareResidentClp);
  }

  if (fareType === "chilean") {
    candidates.push(record.chileanMinimumFareClp, record.minimumFareChileanClp, record.minFareChileanClp);
  }

  if (fareType === "foreigner") {
    candidates.push(record.foreignerMinimumFareClp, record.minimumFareForeignerClp, record.minFareForeignerClp);
  }

  candidates.push(
    record.minimumFareClp,
    record.minFareClp,
    record.passengerMinimumFareClp,
    record.fareMinimumClp,
    extractMoneyAmount(String(ride.notes ?? "").match(/Tarifa m[ií]nima[^:]*:\s*(\$?\s*[\d.,]+\s*CLP)/i)?.[1]),
    extractMoneyAmount(String(ride.notes ?? "").match(/M[ií]nimo[^:]*:\s*(\$?\s*[\d.,]+\s*CLP)/i)?.[1]),
    getPassengerRideBaseFareClp(ride),
  );

  for (const candidate of candidates) {
    const parsed = Number(candidate);
    if (Number.isFinite(parsed) && parsed > 0) return Math.round(parsed);
  }

  // Último fallback local: evita cobrar 0 si una solicitud antigua no trae tarifa mínima.
  return 3000;
}

function getPassengerCancellationTimeMs(ride: RideRequestData & Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const parsed = new Date(String(ride[key] ?? "")).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

function getPassengerCancellationPolicyForRide(ride: RideRequestData): PassengerCancellationPolicy {
  const record = ride as RideRequestData & Record<string, unknown>;
  const effectiveStatus = getEffectivePassengerRideStatus(ride);
  const nowMs = Date.now();
  const acceptedAtMs = getPassengerDriverAcceptedPolicyTimestampMs(record, nowMs);
  const arrivedAtMs = getPassengerCancellationTimeMs(record, ["arrivedAt", "driverArrivedAt", "driverReachedPickupAt"]);
  const acceptedElapsedMs = acceptedAtMs == null ? null : Math.max(0, nowMs - acceptedAtMs);
  const arrivedElapsedMs = arrivedAtMs == null ? null : Math.max(0, nowMs - arrivedAtMs);
  const minimumFare = getPassengerRideMinimumFareClp(ride);
  const applicableFareClp = Math.max(
    0,
    Math.round(
      getPassengerCardCancellationCreditAmountClp(record) ||
      getPassengerRideBaseFareClp(ride) ||
      minimumFare,
    ),
  );
  const charge30WithCap = () =>
    Math.min(
      RAPAGO_CANCEL_FEE_CAP_CLP,
      Math.max(0, Math.round(applicableFareClp * (RAPAGO_LATE_CANCEL_PERCENT / 100))),
    );
  const charge50WithCap = () =>
    Math.min(
      RAPAGO_NO_SHOW_FEE_CAP_CLP,
      Math.max(0, Math.round(applicableFareClp * (RAPAGO_NO_SHOW_PERCENT / 100))),
    );

  if (
    effectiveStatus === "driver_arrived" &&
    arrivedElapsedMs != null &&
    arrivedElapsedMs >= RAPAGO_NO_SHOW_AFTER_ARRIVAL_MS
  ) {
    const fee = charge50WithCap();
    return {
      type: "no_show",
      feeClp: fee,
      candidateFeeClp: fee,
      applicableFareClp,
      feePercent: RAPAGO_NO_SHOW_PERCENT,
      feeCapClp: RAPAGO_NO_SHOW_FEE_CAP_CLP,
      title: "No presentación / No Show",
      message: `El conductor llegó al punto y esperó 5 minutos. El cargo referencial es ${formatClp(fee)}.`,
      detail: `No Show: ${RAPAGO_NO_SHOW_PERCENT}% de la tarifa aplicable, con tope de ${formatClp(RAPAGO_NO_SHOW_FEE_CAP_CLP)}. Backend solo permite declararlo después de 5 minutos desde la llegada del conductor.`,
      acceptedElapsedMs,
      arrivedElapsedMs,
      requiresAdminReview: true,
      exemptionRequested: false,
    };
  }

  if (
    acceptedAtMs == null ||
    acceptedElapsedMs == null ||
    acceptedElapsedMs < RAPAGO_FREE_CANCEL_AFTER_ACCEPTANCE_MS
  ) {
    return {
      type: "free",
      feeClp: 0,
      candidateFeeClp: 0,
      applicableFareClp,
      feePercent: 0,
      feeCapClp: 0,
      title: "Cancelación gratuita",
      message: "Puedes cancelar gratuitamente durante el primer minuto desde que el conductor queda asignado al viaje. Se libera el 100% de la retención Klap.",
      detail: "No corresponde cargo por cancelación.",
      acceptedElapsedMs,
      arrivedElapsedMs,
      requiresAdminReview: false,
      exemptionRequested: false,
    };
  }

  const fee = charge30WithCap();
  return {
    type: "late_cancel",
    feeClp: fee,
    candidateFeeClp: fee,
    applicableFareClp,
    feePercent: RAPAGO_LATE_CANCEL_PERCENT,
    feeCapClp: RAPAGO_CANCEL_FEE_CAP_CLP,
    title: "Cancelación después de 1 minuto",
    message: `Finalizó el minuto gratuito desde la asignación. El cargo referencial es ${formatClp(fee)}.`,
    detail: `Después de 1 minuto desde la asignación: ${RAPAGO_LATE_CANCEL_PERCENT}% de la tarifa aplicable, con tope de ${formatClp(RAPAGO_CANCEL_FEE_CAP_CLP)}. Se captura solo esa multa y se libera el resto de la retención.`,
    acceptedElapsedMs,
    arrivedElapsedMs,
    requiresAdminReview: true,
    exemptionRequested: false,
  };
}

const PASSENGER_CANCELLED_VISIBILITY_MS = 10 * 60 * 1000;
const PASSENGER_CANCELLED_VISIBILITY_TICK_MS = 15 * 1000;

function isCancelledBeforeKlapPayment(
  ride: Partial<RideRequestData> & Record<string, unknown>,
): boolean {
  const status = String(ride.status ?? "").trim().toLowerCase();
  const reason = String(ride.cancellationReason ?? ride.cancelReason ?? "")
    .trim()
    .toLowerCase();

  return (
    ["cancelled", "canceled", "passenger_cancelled"].includes(status) &&
    reason.includes("pago klap cancelado")
  );
}

function purgeExpiredCancelledRideRecords<T extends Partial<RideRequestData> & Record<string, unknown>>(
  rides: T[],
  _nowMs = Date.now(),
): T[] {
  // El historial permanente sigue guardado en backend/BD para comprobantes,
  // auditoría y soporte. Esta limpieza local solo elimina la solicitud técnica
  // que nunca llegó a convertirse en viaje porque Klap se canceló antes del pago.
  return rides.filter((ride) => !isCancelledBeforeKlapPayment(ride));
}


function isDriverCancelledRequeuedRide(ride: RideRequestData & Record<string, unknown>): boolean {
  const status = String(ride.status ?? "").toLowerCase();
  const cancelledBy = String(ride.cancelledByRole ?? ride.cancelledBy ?? "").toLowerCase();
  const reason = String(ride.requeuedReason ?? ride.requeueReason ?? ride.cancellationReason ?? "").toLowerCase();
  const notice = String(ride.passengerNotice ?? ride.passengerNotification ?? ride.notes ?? "").toLowerCase();

  if (cancelledBy.includes("passenger") || cancelledBy.includes("pasajero")) return false;
  if (hasPassengerCancelledRideMarker(ride)) return false;

  return (
    ["requested", "scheduled", "driver_scheduled", "accepted", "cancelled", "canceled"].includes(status) &&
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


function getPassengerRideTimestampMs(
  ride: Partial<RideRequestData> & Record<string, unknown>,
  keys: string[],
): number | null {
  for (const key of keys) {
    const raw = ride[key];
    if (!raw) continue;

    const parsed = new Date(String(raw)).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

function getPassengerCancelledTimestampMs(
  ride: Partial<RideRequestData> & Record<string, unknown>,
): number | null {
  return getPassengerRideTimestampMs(ride, [
    "cancelledAt",
    "canceledAt",
    "cancelled_at",
    "updatedAt",
    "requestedAt",
    "createdAt",
  ]);
}

function isPassengerCancelledRideVisibleForTenMinutes(
  ride: Partial<RideRequestData> & Record<string, unknown>,
  nowMs = Date.now(),
): boolean {
  const cancelledAtMs = getPassengerCancelledTimestampMs(ride);

  if (cancelledAtMs == null) {
    // Registros antiguos sin fecha no deben llenar indefinidamente el contador.
    return false;
  }

  if (cancelledAtMs > nowMs) {
    // Tolerancia a pequeños desfases del reloj del dispositivo/servidor.
    return true;
  }

  return nowMs - cancelledAtMs < PASSENGER_CANCELLED_VISIBILITY_MS;
}

function getDriverRequeueSearchStartedAtIso(
  ride: Partial<RideRequestData> & Record<string, unknown>,
): string {
  const candidates = [
    "searchStartedAt",
    "requeuedAt",
    "driverCancelledAt",
    "cancelledAt",
    "canceledAt",
    "updatedAt",
    "requestedAt",
    "createdAt",
  ];

  const parsed = getPassengerRideTimestampMs(ride, candidates);
  return new Date(parsed ?? Date.now()).toISOString();
}

function getPassengerDriverRequeueTimestampMs(
  ride: Partial<RideRequestData> & Record<string, unknown>,
): number | null {
  return getPassengerRideTimestampMs(ride, [
    "requeuedAt",
    "searchStartedAt",
    "driverCancelledAt",
    "cancelledAt",
    "canceledAt",
    "updatedAt",
    "requestedAt",
    "createdAt",
  ]);
}

function getPassengerDriverAcceptedTimestampMs(
  ride: Partial<RideRequestData> & Record<string, unknown>,
): number | null {
  return getPassengerRideTimestampMs(ride, [
    "acceptedAt",
    "driverAcceptedAt",
    "driverAcceptedScheduleAt",
    "driverScheduleAcceptedAt",
    "scheduledDriverAcceptedAt",
    "driverConfirmedAt",
    "navigationStartedAt",
    "driverStartedScheduledReservationAt",
    "enRouteAt",
  ]);
}

function passengerRecordLooksAcceptedByDriver(
  ride: Partial<RideRequestData> & Record<string, unknown>,
): boolean {
  const status = passengerBridgeClean(ride.status);
  const response = passengerBridgeClean(
    ride.driverScheduleResponse ??
      ride.scheduledDriverResponse ??
      ride.driverReservationResponse ??
      ride.driverAssignmentStatus,
  );

  return (
    ["accepted", "driver_scheduled", "driver_en_route", "driver_arrived", "in_progress"].includes(status) ||
    response.includes("accepted") ||
    response.includes("confirm") ||
    Boolean(ride.acceptedAt) ||
    Boolean(ride.driverAcceptedAt) ||
    Boolean(ride.driverAcceptedScheduleAt)
  );
}

function passengerAcceptedDriverIsNewerThanRequeue(
  candidate: Partial<RideRequestData> & Record<string, unknown>,
  requeued: Partial<RideRequestData> & Record<string, unknown>,
): boolean {
  if (!passengerRecordLooksAcceptedByDriver(candidate)) return false;

  const requeuedMs = getPassengerDriverRequeueTimestampMs(requeued);
  const acceptedMs = getPassengerDriverAcceptedTimestampMs(candidate);

  // Para evitar que vuelva a aparecer el conductor antiguo, solo aceptamos
  // un puente de conductor si fue confirmado DESPUÉS de la re-encolación.
  if (requeuedMs == null || acceptedMs == null) return false;
  return acceptedMs > requeuedMs + 500;
}

function buildPassengerSearchingAfterDriverCancelRide<T extends RideRequestData & Record<string, unknown>>(ride: T): T {
  const searchStartedAt = getDriverRequeueSearchStartedAtIso(ride);

  return {
    ...ride,
    status: "requested",
    cancelledAt: null,
    canceledAt: null,
    cancelledByRole: null,
    cancelledBy: null,
    cancellationReason: null,
    cancelReason: null,
    forceActiveAfterDriverCancel: true,
    requeuedReason: "driver_cancelled",
    requeueReason: "driver_cancelled",
    requeuedAt: searchStartedAt,
    searchStartedAt,
    passengerNotice: "Tu conductor canceló el viaje. Estamos buscando un nuevo conductor disponible.",
    passengerNotification: "Tu conductor canceló el viaje. Estamos buscando un nuevo conductor disponible.",
    driverName: null,
    driverFullName: null,
    driverPhone: null,
    driverEmail: null,
    driverPhotoUrl: null,
    driverProfileImageDataUrl: null,
    driverProfilePhotoUrl: null,
    driverVehicleBrand: null,
    driverVehicleModel: null,
    driverVehicleColor: null,
    driverVehiclePlate: null,
    driverVehicleYear: null,
    driverVehicleImageDataUrl: null,
    driverVehiclePhotoDataUrl: null,
    vehicleBrand: null,
    vehicleModel: null,
    vehicleColor: null,
    vehiclePlate: null,
    vehicleImageDataUrl: null,
    vehiclePhotoDataUrl: null,
    acceptedAt: null,
    driverAcceptedAt: null,
    driverAcceptedScheduleAt: null,
    driverScheduleAcceptedAt: null,
    scheduledDriverAcceptedAt: null,
    enRouteAt: null,
    arrivedAt: null,
    startedAt: null,
    navigationStartedAt: null,
    driverStartedScheduledReservationAt: null,
    driverStartedScheduledReservation: false,
    scheduledReservationNavigationStarted: false,
    driverScheduleResponse: null,
    scheduledDriverResponse: null,
    driverAssignmentStatus: "searching_next_driver",
    scheduleStatus: "searching_next_driver",
    adminScheduleStatus: "searching_next_driver",
    reservationStatus: "searching_next_driver",
    dispatchStatus: "searching_next_driver",
  } as T;
}

function readPassengerDriverCancelledRequeueMirrors(): Array<RideRequestData & Record<string, unknown>> {
  const all: Array<RideRequestData & Record<string, unknown>> = [];

  for (const key of [
    RAPAGO_REQUEUED_RIDES_KEY,
    RAPAGO_REQUEUED_PASSENGER_FORCE_KEY,
    LOCAL_PASSENGER_RIDES_KEY,
    "rapago_admin_scheduled_rides",
    "rapago_admin_scheduled_rides_v1",
    "rapago_admin_scheduled_rides_v2",
    "rapago_admin_scheduled_rides_force_v1",
    "rapago_bridge_scheduled_rides_v1",
  ]) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        all.push(...parsed.filter((item): item is RideRequestData & Record<string, unknown> =>
          Boolean(item && typeof item === "object"),
        ));
      } else if (parsed && typeof parsed === "object") {
        all.push(parsed as RideRequestData & Record<string, unknown>);
      }
    } catch {
      // No bloquea Mis Viajes si un storage antiguo está corrupto.
    }
  }

  return all.filter((ride) => isDriverCancelledRequeuedRide(ride));
}

function findPassengerDriverCancelledRequeueMirror(
  target: Partial<RideRequestData> & Record<string, unknown>,
): (RideRequestData & Record<string, unknown>) | null {
  const matches = readPassengerDriverCancelledRequeueMirrors()
    .filter((ride) => isSamePassengerRideCancelTarget(ride, target))
    .sort((a, b) => {
      const aMs = getPassengerDriverRequeueTimestampMs(a) ?? 0;
      const bMs = getPassengerDriverRequeueTimestampMs(b) ?? 0;
      return bMs - aMs;
    });

  return matches[0] ?? null;
}

function shouldUseNextRideForDedupe(
  previous: RideRequestData & Record<string, unknown>,
  next: RideRequestData & Record<string, unknown>,
): boolean {
  const previousRequeued = isDriverCancelledRequeuedRide(previous);
  const nextRequeued = isDriverCancelledRequeuedRide(next);

  // Si el conductor canceló, el viaje queda re-encolado como requested.
  // El backend y los puentes locales pueden seguir devolviendo el conductor antiguo.
  // Esa copia antigua NO debe ganar, porque el pasajero debe volver a ver
  // "Buscando conductor" con el contador reiniciado desde la cancelación.
  if (nextRequeued) {
    return !passengerAcceptedDriverIsNewerThanRequeue(previous, next);
  }

  if (previousRequeued) {
    return passengerAcceptedDriverIsNewerThanRequeue(next, previous);
  }

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
      .map((ride) =>
        buildPassengerSearchingAfterDriverCancelRide(
          ride as RideRequestData & Record<string, unknown>,
        ),
      ) as RideRequestData[];
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

const RAPAGO_PASSENGER_CANCELLED_RIDE_EVENT = "rapago:passenger-cancelled-ride-for-driver";

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


function getPassengerPendingChargeRideKey(ride: Partial<RideRequestData> & Record<string, unknown>): string {
  const id = String(ride.id ?? ride.rideId ?? ride.originalRideId ?? "").trim();
  if (id) return `ride:${id}`;

  return [
    String(ride.passengerEmail ?? ride.email ?? "").trim().toLowerCase(),
    String(ride.originText ?? "").trim().toLowerCase(),
    String(ride.destinationText ?? "").trim().toLowerCase(),
    String(ride.acceptedAt ?? ride.requestedAt ?? ride.createdAt ?? "").trim(),
  ].filter(Boolean).join("|");
}

function readPassengerPendingCharges(): PassengerPendingCharge[] {
  try {
    const raw = localStorage.getItem(RAPAGO_PASSENGER_PENDING_CHARGES_KEY);
    const parsed = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item, index): PassengerPendingCharge => ({
        id: String(item.id ?? `pending-charge-${index}`),
        rideId: typeof item.rideId === "string" ? item.rideId : null,
        rideKey: String(item.rideKey ?? item.rideId ?? `pending-charge-${index}`),
        passengerEmail: typeof item.passengerEmail === "string" ? item.passengerEmail : null,
        passengerName: typeof item.passengerName === "string" ? item.passengerName : null,
        originText: String(item.originText ?? ""),
        destinationText: String(item.destinationText ?? ""),
        amountClp: Math.max(0, Math.round(Number(item.amountClp ?? item.amount ?? 0))),
        minimumFareClp: Math.max(0, Math.round(Number(item.minimumFareClp ?? 0))),
        applicableFareClp: Number.isFinite(Number(item.applicableFareClp)) ? Math.round(Number(item.applicableFareClp)) : null,
        feePercent: Number.isFinite(Number(item.feePercent)) ? Number(item.feePercent) : null,
        feeCapClp: Number.isFinite(Number(item.feeCapClp)) ? Math.round(Number(item.feeCapClp)) : null,
        type: String(item.type ?? "late_cancel") === "no_show" ? "no_show" : "late_cancel",
        paymentMethod: typeof item.paymentMethod === "string" ? item.paymentMethod : null,
        status: String(item.status ?? "pending_admin_review") as PassengerPendingCharge["status"],
        adminReviewStatus: String(item.adminReviewStatus ?? "pending_admin_review") as PassengerPendingCharge["adminReviewStatus"],
        createdAt: String(item.createdAt ?? new Date().toISOString()),
        appliedRideId: typeof item.appliedRideId === "string" ? item.appliedRideId : null,
        appliedAt: typeof item.appliedAt === "string" ? item.appliedAt : null,
        title: String(item.title ?? "Revision backend pendiente"),
        description: String(item.description ?? "Revision backend pendiente para el próximo viaje."),
        requestedExemption: Boolean(item.requestedExemption),
        cancellationReasonCode: typeof item.cancellationReasonCode === "string" ? item.cancellationReasonCode : null,
        cancellationReasonLabel: typeof item.cancellationReasonLabel === "string" ? item.cancellationReasonLabel : null,
        adminDecisionReason: typeof item.adminDecisionReason === "string" ? item.adminDecisionReason : null,
        cardRefundRequested: Boolean(item.cardRefundRequested || item.mercadoPagoRefundRequested),
        mercadoPagoRefundRequested: Boolean(item.mercadoPagoRefundRequested || item.cardRefundRequested),
        mercadoPagoRefundStatus: typeof item.mercadoPagoRefundStatus === "string" ? item.mercadoPagoRefundStatus : null,
        cardRefundNotice: typeof item.cardRefundNotice === "string" ? item.cardRefundNotice : null,
      }))
      .filter((charge) => charge.amountClp > 0);
  } catch {
    return [];
  }
}

function writePassengerPendingCharges(charges: PassengerPendingCharge[]): void {
  try {
    localStorage.setItem(RAPAGO_PASSENGER_PENDING_CHARGES_KEY, JSON.stringify(charges.slice(0, 250)));
    window.dispatchEvent(new CustomEvent(RAPAGO_PASSENGER_PENDING_CHARGE_EVENT, { detail: { charges } }));
    window.dispatchEvent(new CustomEvent("rapago:admin-passenger-pending-charge-updated", { detail: { charges } }));
    window.dispatchEvent(new CustomEvent("rapago:admin-rides-updated", { detail: { charges } }));
    window.dispatchEvent(new CustomEvent("rapago:wallet-updated", { detail: { charges } }));
  } catch {
    // No bloquea la cancelación si el navegador no permite guardar.
  }
}

function savePassengerPendingChargeFromCancellation(
  ride: RideRequestData,
  policy: PassengerCancellationPolicy,
): void {
  const candidateAmountClp = Math.max(
    0,
    Math.round(Number(policy.candidateFeeClp ?? policy.feeClp ?? 0)),
  );
  if (candidateAmountClp <= 0) return;

  try {
    const record = ride as RideRequestData & Record<string, unknown>;
    const rideId = String(record.id ?? record.rideId ?? record.originalRideId ?? record.serverRideId ?? "").trim();
    const rideKey = getPassengerPendingChargeRideKey(record);
    const now = new Date().toISOString();
    const paymentMethod = String(
      record.paymentMethod ??
      getRidePaymentMethodLabel(String(record.notes ?? "")) ??
      "",
    ).trim() || null;
    const passengerEmail = String(record.passengerEmail ?? record.email ?? "").trim().toLowerCase() || null;
    const passengerName = String(record.passengerName ?? record.userName ?? record.name ?? "").trim() || null;

    const pendingCharge: PassengerPendingCharge & Record<string, unknown> = {
      id: `cancellation-review-${rideId || rideKey}`,
      rideId: rideId || null,
      rideKey,
      passengerEmail,
      passengerName,
      originText: String(record.originText ?? "Origen"),
      destinationText: String(record.destinationText ?? "Destino"),
      amountClp: candidateAmountClp,
      minimumFareClp: getPassengerRideMinimumFareClp(ride),
      applicableFareClp: policy.applicableFareClp,
      originalServiceAmountClp: policy.applicableFareClp,
      originalNoShowServiceAmountClp:
        policy.type === "no_show" ? policy.applicableFareClp : null,
      feePercent: policy.feePercent,
      feeCapClp: policy.feeCapClp,
      type: policy.type === "no_show" ? "no_show" : "late_cancel",
      paymentMethod,
      status: "pending_admin_review",
      adminReviewStatus: policy.exemptionRequested
        ? "pending_exemption_review"
        : "pending_admin_review",
      createdAt: now,
      appliedRideId: null,
      appliedAt: null,
      title: policy.exemptionRequested
        ? "Solicitud de exención de cargo"
        : policy.type === "no_show"
          ? "No show por validar"
          : "Cancelación fuera de plazo por validar",
      description: policy.exemptionRequested
        ? `${policy.detail} El administrador debe revisar la causa antes de aprobar cualquier cargo.`
        : `${policy.detail} Este monto es referencial y no puede cobrarse hasta aprobación del administrador/backend.`,
      requestedExemption: policy.exemptionRequested,
      cancellationReasonCode: policy.cancellationReasonCode ?? null,
      cancellationReasonLabel: policy.cancellationReasonLabel ?? null,
      backendAuthorityRequired: true,
      localStorageFinancialAuthority: false,
      cardRefundRequested: Boolean(record.cardRefundRequested || record.mercadoPagoRefundRequested),
      mercadoPagoRefundRequested: Boolean(record.mercadoPagoRefundRequested || record.cardRefundRequested),
      mercadoPagoRefundStatus:
        typeof record.mercadoPagoRefundStatus === "string"
          ? record.mercadoPagoRefundStatus
          : null,
      cardRefundNotice:
        typeof record.cardRefundNotice === "string"
          ? record.cardRefundNotice
          : null,
    };

    const current = readPassengerPendingCharges();
    const next = [
      pendingCharge,
      ...current.filter((item) => item.id !== pendingCharge.id),
    ].slice(0, 250);
    writePassengerPendingCharges(next);

    const notification: PassengerNotificationPayload = {
      id: `backend-charge-review-${rideId || rideKey}-${Date.now()}`,
      rideId: rideId || rideKey,
      type: policy.exemptionRequested
        ? "cancellation_exemption_review"
        : "backend_charge_review_required",
      title: policy.exemptionRequested
        ? "Exención enviada a revisión"
        : "Cargo sujeto a revisión",
      body: policy.exemptionRequested
        ? `La cancelación fue registrada. Administración revisará el motivo antes de decidir sobre el cargo referencial de ${formatClp(candidateAmountClp)}.`
        : `La cancelación/no show fue informada. El monto referencial ${formatClp(candidateAmountClp)} no se carga desde este dispositivo; debe confirmarlo el backend/admin.`,
      createdAt: now,
      read: false,
    };

    const currentNotifications = readPassengerNotifications();
    localStorage.setItem(
      RAPAGO_PASSENGER_NOTIFICATIONS_KEY,
      JSON.stringify([notification, ...currentNotifications].slice(0, 100)),
    );

    window.dispatchEvent(new CustomEvent("rapago:passenger-notifications-updated", { detail: { notification, ride } }));
    window.dispatchEvent(new CustomEvent("rapago:passenger-rides-updated", { detail: { ride, notification, policy, pendingCharge } }));
    window.dispatchEvent(new CustomEvent("rapago:admin-rides-updated", { detail: { pendingCharge } }));
  } catch {
    // El frontend no autoriza cargos reales. Backend/admin sigue siendo la autoridad.
  }
}

function isPassengerCancellationCardPayment(ride: Partial<RideRequestData> & Record<string, unknown>): boolean {
  const text = [
    ride.paymentMethod,
    ride.paymentProvider,
    ride.paymentStatus,
    ride.paymentId,
    ride.mercadoPagoPaymentId,
    ride.notes,
  ]
    .map((value) => String(value ?? "").toLowerCase())
    .join(" ");

  return (
    text.includes("tarjeta") ||
    text.includes("card") ||
    text.includes("mercadopago") ||
    text.includes("mercado pago") ||
    text.includes("klap") ||
    text.includes("prontopaga") ||
    text.includes("webpay") ||
    Boolean(ride.paymentId || ride.mercadoPagoPaymentId)
  );
}

function isPassengerCancellationCashPaymentForRefundAction(
  ride: Partial<RideRequestData> & Record<string, unknown>,
): boolean {
  const text = [
    ride.paymentMethod,
    ride.paymentProvider,
    ride.paymentStatus,
    ride.notes,
  ]
    .map((value) => String(value ?? "").toLowerCase())
    .join(" ");

  return (
    text.includes("efectivo") ||
    text.includes("cash") ||
    text.includes("pago: efectivo") ||
    text.includes("pago efectivo") ||
    text.includes("forma de pago seleccionada: efectivo") ||
    text.includes("forma de pago: efectivo")
  );
}

function isPassengerCancellationCardPaymentForRefundAction(
  ride: Partial<RideRequestData> & Record<string, unknown>,
): boolean {
  // Regla RAPA GO:
  // El botón de cancelar en tarjeta/Klap no dice “devolución”: el checkout
  // retiene, no cobra. La liberación o captura parcial la hace el backend.
  // Si el viaje fue efectivo, jamás debe aparecer aunque un registro antiguo
  // haya quedado con flags de refund en localStorage.
  if (isPassengerCancellationCashPaymentForRefundAction(ride)) return false;

  return isPassengerCancellationCardPayment(ride);
}

function buildPassengerCancelledRide(
  ride: RideRequestData,
  resolvedPolicy?: PassengerCancellationPolicy,
): RideRequestData {
  const now = new Date().toISOString();
  const policy = resolvedPolicy ?? getPassengerCancellationPolicyForRide(ride);
  const record = ride as RideRequestData & Record<string, unknown>;
  const isCardPayment = isPassengerCancellationCardPaymentForRefundAction(record);
  const candidateFeeClp = Math.max(0, Math.round(policy.candidateFeeClp));
  const approvedFrontendFeeClp = policy.exemptionRequested ? 0 : Math.max(0, Math.round(policy.feeClp));

  if (candidateFeeClp > 0 && (!isCardPayment || policy.exemptionRequested)) {
    savePassengerPendingChargeFromCancellation(ride, policy);
  }

  return {
    ...record,
    status: "cancelled",
    cancelledAt: now,
    cancelledByRole: "passenger",
    cancelledBy: "passenger",
    cancellationReason:
      policy.cancellationReasonLabel
        ? `${policy.cancellationReasonLabel}. ${policy.title}.`
        : policy.feeClp > 0
          ? `${policy.title}. ${policy.message}`
          : "Cancelado por pasajero.",
    passengerCancellationFeeClp: approvedFrontendFeeClp,
    passengerCancellationCandidateFeeClp: candidateFeeClp,
    passengerCancellationPolicyType: policy.type,
    passengerCancellationPolicyText: policy.detail,
    passengerCancellationFeePercent: policy.feePercent,
    passengerCancellationFeeCapClp: policy.feeCapClp,
    passengerCancellationApplicableFareClp: policy.applicableFareClp,
    passengerCancellationReasonCode: policy.cancellationReasonCode ?? null,
    passengerCancellationReasonLabel: policy.cancellationReasonLabel ?? null,
    cancellationExemptionRequested: policy.exemptionRequested,
    passengerCancellationRequiresAdminReview:
      policy.exemptionRequested || (!isCardPayment && policy.requiresAdminReview),
    passengerCancellationChargedAt: null,
    paymentPendingClp: 0,
    passengerPendingChargeNextRide: false,
    passengerPendingChargeNotice:
      candidateFeeClp > 0
        ? policy.exemptionRequested
          ? `Solicitaste exención por: ${policy.cancellationReasonLabel ?? "causa informada"}. Administración revisará el cargo referencial de ${formatClp(candidateFeeClp)}.`
          : `Existe un cargo referencial de ${formatClp(candidateFeeClp)} pendiente de revisión. Solo backend/admin puede aprobarlo.`
        : null,
    // En tarjeta/Klap, el frontend nunca ejecuta la operación financiera.
    // Backend captura la multa o libera la autorización según la política.
    cardRefundRequested: isCardPayment,
    mercadoPagoRefundRequested: isCardPayment,
    mercadoPagoRefundStatus: isCardPayment ? "pending_backend_refund" : null,
    cardRefundNotice: isCardPayment
      ? candidateFeeClp > 0
        ? `El backend captura con Klap solo ${formatClp(candidateFeeClp)} y libera el resto de la retención. No se agrega al próximo viaje.`
        : "Cancelación gratuita: el backend libera el 100% de la retención Klap. No hubo cobro definitivo."
      : null,
    cardWalletCreditRequested: false,
    cardWalletCreditClp: 0,
    cardWalletCreditStatus: null,
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
        if (parsed && isCancelledBeforeKlapPayment(parsed)) localStorage.removeItem(key);
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


function publishPassengerCancellationToDriver(
  cancelled: RideRequestData,
): void {
  const record = cancelled as RideRequestData & Record<string, unknown>;
  const reason = String(
    record.passengerCancellationReasonLabel ??
      record.cancellationReasonLabel ??
      record.cancellationReason ??
      "Motivo no informado",
  )
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/[<>`{}$\\]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);

  // Retira inmediatamente el viaje de los espejos activos del conductor.
  // Esto evita que el mapa, la reserva o la solicitud continúen visibles
  // mientras el listener del conductor procesa el aviso.
  for (const key of [
    "rapago_local_driver_assigned_rides",
    "rapago_driver_scheduled_queue",
    "rapago_driver_active_rides_v1",
    "rapago_driver_my_rides_v1",
  ]) {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
      if (!Array.isArray(parsed)) continue;

      localStorage.setItem(
        key,
        JSON.stringify(
          parsed
            .filter((item) => !isSamePassengerRideCancelTarget(item, record))
            .slice(0, 200),
        ),
      );
    } catch {
      // No bloquea la cancelación.
    }
  }

  for (const key of [
    "rapago_last_accepted_ride",
    "rapago_driver_active_ride",
    "rapago_driver_active_ride_v1",
    "rapago_current_driver_location",
  ]) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw) as unknown;
      const candidate =
        parsed &&
        typeof parsed === "object" &&
        "ride" in (parsed as Record<string, unknown>)
          ? (parsed as Record<string, unknown>).ride
          : parsed;

      if (
        candidate &&
        typeof candidate === "object" &&
        isSamePassengerRideCancelTarget(
          candidate as Record<string, unknown>,
          record,
        )
      ) {
        localStorage.removeItem(key);
      }
    } catch {
      localStorage.removeItem(key);
    }
  }

  const detail = {
    cancelled: record,
    ride: record,
    rideId: String(record.id ?? record.rideId ?? record.originalRideId ?? ""),
    reason,
    cancelledByRole: "passenger",
  };

  window.dispatchEvent(
    new CustomEvent(RAPAGO_PASSENGER_CANCELLED_RIDE_EVENT, { detail }),
  );
  window.dispatchEvent(
    new CustomEvent("rapago:driver-active-ride-cancelled", { detail }),
  );
  window.dispatchEvent(
    new CustomEvent("rapago:driver-rides-updated", { detail }),
  );
  window.dispatchEvent(
    new CustomEvent("rapago:driver-available-rides-updated", { detail }),
  );
}

function cancelPassengerRideEverywhere(
  target: RideRequestData,
  resolvedPolicy?: PassengerCancellationPolicy,
): RideRequestData {
  const cancelled = buildPassengerCancelledRide(target, resolvedPolicy);
  savePassengerWalletCreditFromCardCancellation(target, cancelled);

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

  publishPassengerCancellationToDriver(cancelled);
  window.dispatchEvent(
    new CustomEvent(RAPAGO_REQUEUED_RIDES_EVENT, {
      detail: { cancelled, ride: cancelled },
    }),
  );
  window.dispatchEvent(
    new CustomEvent("rapago:passenger-rides-updated", {
      detail: { cancelled, ride: cancelled },
    }),
  );

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
  const requeueMirror = isDriverCancelledRequeuedRide(ride)
    ? ride
    : findPassengerDriverCancelledRequeueMirror(ride);

  const bridge = findPassengerAcceptedDriverBridgeForRide(ride);

  if (requeueMirror && !passengerAcceptedDriverIsNewerThanRequeue(bridge ?? {}, requeueMirror)) {
    return buildPassengerSearchingAfterDriverCancelRide({
      ...ride,
      ...requeueMirror,
      id: ride.id ?? requeueMirror.id,
      originalRideId:
        (ride as Record<string, unknown>).originalRideId ??
        requeueMirror.originalRideId ??
        requeueMirror.id ??
        ride.id,
    } as T);
  }

  if (!bridge || !bridgeHasDriverData(bridge)) {
    return requeueMirror
      ? buildPassengerSearchingAfterDriverCancelRide({
          ...ride,
          ...requeueMirror,
          id: ride.id ?? requeueMirror.id,
        } as T)
      : ride;
  }

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
    // Cuando ya aceptó un nuevo conductor, se apagan las marcas de re-encolado.
    cancelledAt: null,
    canceledAt: null,
    cancelledByRole: null,
    cancelledBy: null,
    cancellationReason: null,
    cancelReason: null,
    requeuedReason: null,
    requeueReason: null,
    forceActiveAfterDriverCancel: false,
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


const RATING_EXTRA_OPTIONS = [
  "Llegó rápido",
  "Buen trato",
  "Manejo seguro",
  "Auto limpio",
  "Me ayudó con equipaje",
  "Buena comunicación",
  "Conducción cómoda",
  "Conoce bien la isla",
] as const;

/* Etiqueta del valor elegido. Una calificación sin palabra es ambigua: cuatro
   estrellas puede leerse como "bien" o como "le falta algo" según quién mire.
   Nombrarla hace que el pasajero confirme lo que quiso decir. */
const RATING_VALUE_LABELS: Record<number, string> = {
  1: "Muy malo",
  2: "Malo",
  3: "Regular",
  4: "Bueno",
  5: "Excelente",
};

function StarRatingInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    /* radiogroup y no cinco botones sueltos: es UNA pregunta con cinco
       respuestas excluyentes, y así el lector de pantalla anuncia "3 de 5" en
       vez de leer cinco botones sin relación entre ellos. */
    <div
      className="rapago-star-rating"
      role="radiogroup"
      aria-label="Calificación del conductor"
    >
      <div className="rapago-star-rating__row">
        {[1, 2, 3, 4, 5].map((s) => {
          const active = s <= value;

          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={s === value}
              className={`rapago-star-rating__star${active ? " is-active" : ""}`}
              onClick={() => onChange(s)}
              aria-label={`${s} estrella${s === 1 ? "" : "s"} · ${RATING_VALUE_LABELS[s]}`}
            >
              {/* Rellena vs. contorno. Antes todas usaban el icono sólido y la
                  caja amarilla, así que con el valor por defecto (5) las cinco
                  salían idénticas: parecían una fila de botones, no una nota.
                  El contraste lleno/vacío es lo que hace legible el valor. */}
              <IonIcon icon={active ? star : starOutline} aria-hidden="true" />
            </button>
          );
        })}
      </div>

      <div className="rapago-star-rating__label" aria-live="polite">
        <strong>{value}</strong>
        <span>{RATING_VALUE_LABELS[value] ?? ""}</span>
      </div>
    </div>
  );
}

function RatingExtrasSelector({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (value: string) => void;
}): JSX.Element {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
      {RATING_EXTRA_OPTIONS.map((option) => {
        const active = selected.includes(option);

        return (
          <IonChip
            key={option}
            outline={!active}
            color={active ? "warning" : "medium"}
            onClick={() => onToggle(option)}
            style={{
              margin: 0,
              borderRadius: 999,
              fontWeight: 900,
              "--background": active ? "rgba(250,204,21,.22)" : "#ffffff",
            } as CSSProperties}
          >
            <IonLabel>{active ? "✓ " : "+ "}{option}</IonLabel>
          </IonChip>
        );
      })}
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
  // Base real guardada al crear el viaje + recargo opcional de RapaGo más veloz.
  // No recalculamos la ruta aquí para que pasajero, conductor y admin vean el mismo valor.
  return addFastSearchFeeToBaseFare(ride, getPassengerRideBaseFareClp(ride));
}

function getRidePaymentMethodLabel(
  source: RideRequestData | string | null | undefined,
): string {
  const ride =
    source && typeof source === "object"
      ? source
      : null;
  const notes = ride ? ride.notes : source;
  const provider = String(ride?.paymentProvider ?? "").trim().toLowerCase();
  const method = String(ride?.paymentMethod ?? "").trim().toLowerCase();
  const text = String(notes ?? "").toLowerCase();

  if (provider === "klap" || text.includes("klap")) {
    return "Tarjeta / Klap";
  }
  if (
    provider === "mercadopago" ||
    provider === "prontopaga" ||
    text.includes("prontopaga") ||
    text.includes("mercadopago") ||
    text.includes("mercado pago")
  ) {
    return "Tarjeta / Mercado Pago";
  }
  if (method === "card" || text.includes("tarjeta")) return "Tarjeta";
  if (method === "cash" || text.includes("efectivo")) return "Efectivo";
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
    raw === "rapanui" ||
    raw === "rapanui normal" ||
    raw === "rapa nui normal"
  ) {
    return "chilean";
  }

  if (
    raw.includes("residente rapa nui") ||
    raw === "resident" ||
    raw === "residente" ||
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
  if (type === "resident") return "RAPA NUI / RESIDENTE RAPA NUI";
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
  const raw = String(notes ?? "").trim();
  if (!raw) return null;

  // No mostramos textos técnicos largos generados por RAPA GO en la tarjeta del pasajero.
  // La información importante ya se muestra arriba como origen, destino, monto, pago y estado.
  const isSystemNote = /Forma de pago seleccionada:|Categor[ií]a de veh[ií]culo seleccionada:|Tipo de viaje seleccionado:|Promoci[oó]n con regreso seleccionado:|Experiencia con reserva seleccionada:|Destino promocional:|Destino reservado:|Experiencia reservada:|Destino de la experiencia:|Tarifa RAPA GO calculada:|Tarifa estimada pasajero:|RAPAGO_|Coordenadas recogida accesible:|Coordenadas destino accesible:|Fecha y hora de recogida agendada:|Fecha y hora de regreso agendada:|Tipo de solicitud:|Tipo de reserva:|Tipo de servicio:|Recogida de regreso elegida por el pasajero:/i.test(raw);

  if (isSystemNote) return null;

  return raw
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
  id?: string | null;
  rideId?: string | null;
  originalRideId?: string | null;
  serverRideId?: string | null;
  ownerKey?: string | null;
  driverOwnerKey?: string | null;
  vehicleOwnerKey?: string | null;
  driverId?: string | null;
  driverUserId?: string | null;
  selectedVehicleId?: string | null;
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

function passengerLivePayloadRideMatches(
  payload: (PassengerLocalDriverLivePayload & Record<string, unknown>) | null | undefined,
  rideId: string,
): boolean {
  const cleanRideId = passengerCleanString(rideId);
  if (!payload || !cleanRideId) return false;

  return [payload.rideId, payload.id, payload.originalRideId, payload.serverRideId]
    .map((value) => passengerCleanString(value))
    .filter(Boolean)
    .includes(cleanRideId);
}

function passengerLiveIdentityKeys(payload: PassengerLocalDriverLivePayload | null | undefined): string[] {
  return [
    payload?.ownerKey,
    payload?.driverOwnerKey,
    payload?.vehicleOwnerKey,
    payload?.driverEmail,
    payload?.driverId,
    payload?.driverUserId,
    payload?.driverName,
    payload?.driverFullName,
  ]
    .map(passengerNormalizeKey)
    .filter(Boolean);
}

function passengerLivePayloadMatchesDriver(
  candidate: PassengerLocalDriverLivePayload | null | undefined,
  target: PassengerLocalDriverLivePayload | null | undefined,
): boolean {
  if (!candidate || !target) return false;

  const candidateRideId = passengerCleanString(candidate.rideId);
  const targetRideId = passengerCleanString(target.rideId);
  if (candidateRideId && targetRideId && candidateRideId === targetRideId) return true;

  const candidateKeys = new Set(passengerLiveIdentityKeys(candidate));
  if (candidateKeys.size === 0) return false;

  return passengerLiveIdentityKeys(target).some((key) => candidateKeys.has(key));
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

  const anyByOwner = vehicles.find((vehicle) => {
    const owner = passengerNormalizeKey(vehicle.ownerKey);
    return Boolean(owner && liveKeys.includes(owner));
  });
  if (anyByOwner) return anyByOwner;

  if (liveKeys.length > 0) return null;

  if (selectedVehicles.length === 1) return selectedVehicles[0];

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

function readPassengerAcceptedDriverLivePayload(rideId: string): PassengerLocalDriverLivePayload | null {
  const cleanRideId = passengerCleanString(rideId);
  if (!cleanRideId) return null;

  const bridge = readPassengerAcceptedDriverBridgeRecords()
    .find((record) => passengerLivePayloadRideMatches(record as PassengerLocalDriverLivePayload & Record<string, unknown>, cleanRideId));

  return bridge ? (bridge as PassengerLocalDriverLivePayload) : null;
}

function mergePassengerLivePayloads(
  primary: PassengerLocalDriverLivePayload | null | undefined,
  secondary: PassengerLocalDriverLivePayload | null | undefined,
): PassengerLocalDriverLivePayload | null {
  if (!primary && !secondary) return null;
  return {
    ...(secondary ?? {}),
    ...(primary ?? {}),
    ownerKey: primary?.ownerKey ?? secondary?.ownerKey ?? null,
    driverOwnerKey: primary?.driverOwnerKey ?? secondary?.driverOwnerKey ?? null,
    vehicleOwnerKey: primary?.vehicleOwnerKey ?? secondary?.vehicleOwnerKey ?? null,
    driverId: primary?.driverId ?? secondary?.driverId ?? null,
    driverUserId: primary?.driverUserId ?? secondary?.driverUserId ?? null,
    selectedVehicleId: primary?.selectedVehicleId ?? secondary?.selectedVehicleId ?? null,
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
    const cleanRideId = passengerCleanString(rideId);
    if (!cleanRideId) return null;

    const rawMap = localStorage.getItem(RAPAGO_DRIVER_LIVE_LOCATION_KEY);
    const map = rawMap ? (JSON.parse(rawMap) as Record<string, PassengerLocalDriverLivePayload>) : {};
    const candidates = Object.values(map ?? {}).filter(Boolean);
    const fromMap =
      map?.[cleanRideId] ??
      candidates
        .filter((candidate) => passengerLivePayloadRideMatches(candidate as PassengerLocalDriverLivePayload & Record<string, unknown>, cleanRideId))
        .sort((a, b) => getPassengerLivePayloadScore(b) - getPassengerLivePayloadScore(a))[0] ??
      null;

    const currentRaw = localStorage.getItem("rapago_current_driver_location");
    const current = currentRaw ? (JSON.parse(currentRaw) as PassengerLocalDriverLivePayload) : null;

    const acceptedBridge = readPassengerAcceptedDriverLivePayload(cleanRideId);
    const sameRideCurrent = passengerLivePayloadRideMatches(current as PassengerLocalDriverLivePayload & Record<string, unknown>, cleanRideId)
      ? current
      : null;
    const primary = acceptedBridge ?? fromMap ?? sameRideCurrent;
    const sameDriverCandidate = primary
      ? [...candidates, current]
          .filter((candidate): candidate is PassengerLocalDriverLivePayload => Boolean(candidate))
          .filter((candidate) => candidate !== primary && passengerLivePayloadMatchesDriver(candidate, primary))
          .sort((a, b) => getPassengerLivePayloadScore(b) - getPassengerLivePayloadScore(a))[0] ?? null
      : null;

    if (primary) return mergePassengerLivePayloads(primary, sameDriverCandidate);

    // Fallback de desarrollo: si solo hay un conductor publicado en este navegador,
    // se permite usarlo. Con varios conductores, no se mezcla información ajena.
    if (candidates.length === 1 && !current) return candidates[0] ?? null;

    return null;
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

function passengerRideHasAssignedDriver(
  ride: RideRequestData & Record<string, unknown>,
  live?: PassengerLocalDriverLivePayload | null,
): boolean {
  return Boolean(
    passengerFirstValue(
      ride.driverUserId,
      ride.driverId,
      ride.assignedDriverId,
      live?.driverUserId,
      live?.driverId,
      ride.driverEmail,
      ride.driverName,
      ride.driverFullName,
      ride.driverPhone,
      ride.driverPhoneNumber,
      live?.driverEmail,
      live?.driverName,
      live?.driverFullName,
      live?.driverPhone,
      live?.driverPhoneNumber,
    ),
  );
}

function passengerRideIsAssignedOrActive(ride: RideRequestData & Record<string, unknown>): boolean {
  return [
    "accepted",
    "driver_scheduled",
    "driver_en_route",
    "driver_arrived",
    "in_progress",
    "completed",
  ].includes(String(ride.status ?? "").toLowerCase());
}

function getPassengerDriverVehicleImageDataUrl(ride: RideRequestData & Record<string, unknown>): string | null {
  const live = readPassengerLiveVehiclePayload(String(ride.id ?? ""));
  const storedVehicle = getPassengerStoredDriverVehicle(live);
  const useGlobalFallback = !passengerRideHasAssignedDriver(ride, live) && !passengerRideIsAssignedOrActive(ride);
  const anyVehicle = useGlobalFallback ? passengerReadBestVehicleFromEverywhere() : null;
  const canonicalVehicleImage = useGlobalFallback ? passengerReadCanonicalVehicleImageDataUrl() : null;

  const latestPublicImage = passengerImageWithVersion(
    anyVehicle?.imageDataUrl ?? canonicalVehicleImage,
    anyVehicle?.score,
  );

  return passengerImageValue(
    live?.driverVehicleImageDataUrl,
    live?.driverVehiclePhotoDataUrl,
    live?.vehicleImageDataUrl,
    live?.vehiclePhotoDataUrl,
    storedVehicle?.imageDataUrl,
    // Últimos respaldos: datos antiguos pegados al viaje aceptado.
    ride.driverVehicleImageDataUrl,
    ride.driverVehiclePhotoDataUrl,
    ride.vehicleImageDataUrl,
    ride.vehiclePhotoDataUrl,
    latestPublicImage,
    anyVehicle?.imageDataUrl,
    canonicalVehicleImage,
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

  if (passengerRideHasAssignedDriver(ride, live) || passengerRideIsAssignedOrActive(ride)) return "Conductor asignado";

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


const PASSENGER_DRIVER_PROFILE_SCOPED_BASE_KEYS = [
  "rapago_driver_profile_photo",
  "rapago_driver_profile_image_data_url",
  "rapago_driver_profile_photo_url",
  "rapago_public_driver_profile_photo",
  "rapago_driver_photo",
  "rapago_profile_photo",
  "rapago_user_profile_photo",
  "rapago_driver_avatar_data_url",
] as const;

function passengerDriverOwnerCandidates(
  ride: RideRequestData & Record<string, unknown>,
  live: PassengerLocalDriverLivePayload | null,
): string[] {
  return Array.from(
    new Set(
      [
        live?.ownerKey,
        live?.driverOwnerKey,
        live?.vehicleOwnerKey,
        live?.driverEmail,
        live?.driverId,
        live?.driverUserId,
        live?.driverName,
        live?.driverFullName,
        ride.ownerKey,
        ride.driverOwnerKey,
        ride.vehicleOwnerKey,
        ride.driverEmail,
        ride.driverId,
        ride.driverUserId,
        ride.driverName,
        ride.driverFullName,
      ]
        .map((value) => String(value ?? "").trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

function passengerReadScopedDriverProfilePhoto(ownerKey: string): string | null {
  const cleanOwner = String(ownerKey ?? "").trim().toLowerCase();
  if (!cleanOwner) return null;

  for (const baseKey of PASSENGER_DRIVER_PROFILE_SCOPED_BASE_KEYS) {
    const scopedKey = `${baseKey}__${encodeURIComponent(cleanOwner)}`;
    const image = passengerImageValue(
      passengerReadStringStorageValue(scopedKey),
    );
    if (image) return image;
  }

  return null;
}

function passengerReadDriverProfilePhotoForRide(
  ride: RideRequestData & Record<string, unknown>,
  live: PassengerLocalDriverLivePayload | null,
): string | null {
  const ownerCandidates = passengerDriverOwnerCandidates(ride, live);

  // La foto se guarda por conductor con una llave aislada. Primero buscamos
  // exclusivamente las llaves que pertenecen al conductor asignado al viaje.
  for (const owner of ownerCandidates) {
    const image = passengerReadScopedDriverProfilePhoto(owner);
    if (image) return image;
  }

  try {
    const raw = localStorage.getItem("rapago_driver_public_profiles_v1");
    const map = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    const profiles = Object.entries(map)
      .filter((entry): entry is [string, Record<string, unknown>] =>
        Boolean(entry[1] && typeof entry[1] === "object"),
      );

    const target = {
      ...(live ?? {}),
      ownerKey: passengerFirstValue(live?.ownerKey, ride.ownerKey) || null,
      driverOwnerKey:
        passengerFirstValue(live?.driverOwnerKey, ride.driverOwnerKey) || null,
      driverId: passengerFirstValue(live?.driverId, ride.driverId) || null,
      driverUserId:
        passengerFirstValue(live?.driverUserId, ride.driverUserId) || null,
      driverEmail:
        passengerFirstValue(live?.driverEmail, ride.driverEmail) || null,
      driverName: passengerFirstValue(live?.driverName, ride.driverName) || null,
      driverFullName:
        passengerFirstValue(live?.driverFullName, ride.driverFullName) || null,
    } as PassengerLocalDriverLivePayload;

    const matched = profiles.find(([mapOwner, profile]) => {
      if (ownerCandidates.includes(mapOwner.trim().toLowerCase())) return true;
      return passengerLivePayloadMatchesDriver(
        profile as PassengerLocalDriverLivePayload,
        target,
      );
    });

    if (matched) {
      const [mapOwner, profile] = matched;
      const direct = passengerGetProfilePhotoFromObject(profile);
      if (direct) {
        return passengerImageWithVersion(
          direct,
          passengerObjectTime(profile, "rapago_driver_public_profiles_v1"),
        );
      }

      const matchedOwner = passengerFirstValue(
        profile.ownerKey,
        profile.driverOwnerKey,
        profile.driverEmail,
        mapOwner,
      ).toLowerCase();
      const scoped = passengerReadScopedDriverProfilePhoto(matchedOwner);
      if (scoped) return scoped;
    }

    // Nunca usar el único perfil global como sustituto si este viaje ya tiene
    // conductor identificado. Ese fallback podía mostrar la foto de otro
    // conductor (por ejemplo, el último perfil guardado en este navegador).
    if (profiles.length === 1 && ownerCandidates.length === 0) {
      const [mapOwner, profile] = profiles[0]!;
      const direct = passengerGetProfilePhotoFromObject(profile);
      if (direct) return direct;

      const onlyOwner = passengerFirstValue(
        profile.ownerKey,
        profile.driverOwnerKey,
        profile.driverEmail,
        mapOwner,
      ).toLowerCase();
      const scoped = passengerReadScopedDriverProfilePhoto(onlyOwner);
      if (scoped) return scoped;
    }
  } catch {
    // No bloquea Mis Viajes si un perfil local antiguo está dañado.
  }

  return null;
}

function getPassengerDriverProfileImageDataUrl(ride: RideRequestData & Record<string, unknown>): string | null {
  const live = readPassengerLiveVehiclePayload(String(ride.id ?? ""));
  const specificImage = passengerImageValue(
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

  if (specificImage) return specificImage;

  const assignedDriverImage = passengerReadDriverProfilePhotoForRide(ride, live);
  if (assignedDriverImage) return assignedDriverImage;

  // Solo usamos un respaldo global cuando no existe conductor asignado. Si el
  // viaje ya tiene conductor, la búsqueda anterior fue aislada por identidad.
  if (passengerRideHasAssignedDriver(ride, live) || passengerRideIsAssignedOrActive(ride)) return null;

  return passengerReadBestProfilePhotoFromEverywhere();
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
  const useGlobalFallback = !passengerRideHasAssignedDriver(ride, live) && !passengerRideIsAssignedOrActive(ride);
  const anyVehicle = useGlobalFallback ? passengerReadBestVehicleFromEverywhere() : null;

  // Primero se usan datos del viaje aceptado/live. Los respaldos globales quedan al final
  // para no mostrar la foto o vehículo de otro conductor guardado en este navegador.
  const directVehicle = passengerMergeVehicleData(
    {
      brand: passengerFirstValue(
        live?.driverVehicleBrand,
        live?.vehicleBrand,
        storedVehicle?.brand,
        ride.driverVehicleBrand,
        ride.vehicleBrand,
        anyVehicle?.brand,
      ),
      model: passengerFirstValue(
        live?.driverVehicleModel,
        live?.vehicleModel,
        storedVehicle?.model,
        ride.driverVehicleModel,
        ride.vehicleModel,
        anyVehicle?.model,
      ),
      color: passengerFirstValue(
        live?.driverVehicleColor,
        live?.vehicleColor,
        storedVehicle?.color,
        ride.driverVehicleColor,
        ride.vehicleColor,
        anyVehicle?.color,
      ),
      plate: passengerFirstValue(
        live?.driverVehiclePlate,
        live?.vehiclePlate,
        storedVehicle?.plate,
        ride.driverVehiclePlate,
        ride.vehiclePlate,
        ride.plate,
        anyVehicle?.plate,
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


function passengerVehicleTypeDisplayName(
  type: PassengerIslandVehicleType,
): string {
  if (type === "pickup") return "Camioneta";
  if (type === "suv") return "SUV";
  if (type === "van") return "Van";
  if (type === "compact") return "Auto compacto";
  return "Automóvil";
}

function passengerVehicleDisplayColor(
  colorValue: unknown,
  type: PassengerIslandVehicleType,
): string {
  const color = passengerNormalizeVehicleColorName(colorValue);
  if (!color) return "";

  const feminine = type === "pickup" || type === "van";
  const aliases: Record<string, [string, string]> = {
    plata: ["plateado", "plateada"],
    plateado: ["plateado", "plateada"],
    plateada: ["plateado", "plateada"],
    gris: ["gris", "gris"],
    blanco: ["blanco", "blanca"],
    blanca: ["blanco", "blanca"],
    negro: ["negro", "negra"],
    negra: ["negro", "negra"],
    rojo: ["rojo", "roja"],
    roja: ["rojo", "roja"],
    azul: ["azul", "azul"],
    verde: ["verde", "verde"],
    amarillo: ["amarillo", "amarilla"],
    amarilla: ["amarillo", "amarilla"],
    naranjo: ["naranjo", "naranjada"],
    naranja: ["naranjo", "naranjada"],
    beige: ["beige", "beige"],
  };

  const pair = aliases[color] ?? [color, color];
  return feminine ? pair[1] : pair[0];
}

function getPassengerVehicleHumanDescription(vehicle: {
  brand: string;
  model: string;
  color: string;
}): string {
  const type = passengerVehicleIslandType(vehicle);
  const typeLabel = passengerVehicleTypeDisplayName(type);
  const colorLabel = passengerVehicleDisplayColor(vehicle.color, type);

  return [typeLabel, colorLabel].filter(Boolean).join(" ").trim();
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
  const initial = driverName.trim().charAt(0).toUpperCase() || "C";
  const modelLine = [vehicle.brand, vehicle.model].filter(Boolean).join(" ").trim() || "Vehículo asignado";
  const plateText = vehicle.plate ? vehicle.plate.toUpperCase() : "SIN PATENTE";
  const vehicleDescription =
    getPassengerVehicleHumanDescription(vehicle) || "Vehículo asignado";
  const colorLine = vehicle.color ? `Color registrado: ${vehicle.color}` : "Color no informado";
  const statusText = getPassengerUberStatusText(effectiveStatus);

  return (
    /* global.css:3175 fuerza color:#111111 !important en TODO descendiente de
       ion-card, sin importar el tema — pensado para la tarjeta clara "legacy"
       de esta misma sección. Este panel sí declara su propio fondo con
       --rp-surface (oscuro en modo noche), así que ese texto quedaba negro
       sobre negro. sections.css libera .rapago-trip-theme-panel y sus tonos
       (.rp-tone-*) con la misma !important, así que el color que cada
       elemento ya declaraba inline vuelve a ganar. */
    <div
      className="rapago-trip-theme-panel"
      style={{
        marginBottom: 14,
        background: "var(--rp-surface)",
        borderRadius: 26,
        padding: "14px",
        border: "1px solid rgba(0,0,0,.07)",
        boxShadow: "0 14px 34px rgba(0,0,0,.12)",
        color: "var(--rp-text)",
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
          background: "var(--rp-surface)",
        }}
      >
        <div>
          {/* El contenedor usa var(--rp-surface), que en modo noche es casi
              negro: este texto iba en rgba(17,17,17,.62) y quedaba en 1,06:1,
              es decir invisible, justo mientras el conductor viene en camino. */}
          <div className="rp-tone-muted" style={{ color: "var(--rp-muted)", fontSize: ".74rem", fontWeight: 850 }}>
            Detalles del viaje
          </div>
          <div style={{ fontWeight: 950, fontSize: ".92rem", marginTop: 1, lineHeight: 1.25 }}>
            {effectiveStatus === "driver_arrived"
              ? `Espera en ${String(ride.originText ?? "el punto de partida")}`
              : `Recogida: ${String(ride.originText ?? "punto de partida")}`}
            <br />
            <span className="rp-tone-muted" style={{ fontSize: ".78rem", color: "var(--rp-muted)", fontWeight: 850 }}>
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
            background: "var(--rp-surface-soft)",
            fontSize: "1.25rem",
            fontWeight: 950,
            color: "var(--rp-text)",
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
            className="rp-tone-btn-primary-fg"
            style={{
              width: 58,
              height: 58,
              borderRadius: 999,
              overflow: "hidden",
              background: "var(--rp-accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              /* La inicial iba en var(--rp-text) sobre var(--rp-accent): en
                 noche, marfil sobre oro claro = 1,43:1. El contraste del oro
                 es el mismo par que ya usa el botón principal. */
              color: "var(--rp-btn-primary-fg)",
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
          <div className="rp-tone-ok" style={{ fontWeight: 950, fontSize: ".86rem", color: "var(--rp-ok-fg)", letterSpacing: ".02em" }}>
            {driverName}
          </div>
          <div
            style={{
              marginTop: 4,
              fontWeight: 950,
              fontSize: ".88rem",
              color: "var(--rp-text)",
              lineHeight: 1.2,
            }}
          >
            {vehicleDescription}
          </div>
          <div className="rp-tone-muted" style={{ marginTop: 3, fontWeight: 850, fontSize: ".72rem", color: "var(--rp-muted)", lineHeight: 1.25 }}>
            {modelLine}
            <br />{colorLine}
          </div>
        </div>

        <div style={{ textAlign: "right", minWidth: 0 }}>
          <div
            style={{
              fontWeight: 950,
              fontSize: ".96rem",
              letterSpacing: ".04em",
              whiteSpace: "nowrap",
              overflowWrap: "normal",
            }}
            aria-label={`Patente completa ${plateText}`}
          >
            {plateText}
          </div>
          <div className="rp-tone-muted" style={{ fontSize: ".78rem", color: "var(--rp-muted)", fontWeight: 850, marginTop: 2 }}>
            {modelLine}
          </div>
          <div
            style={{
              marginLeft: "auto",
              marginTop: 6,
              width: 108,
              height: 64,
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
          <div
            className="rp-tone-muted"
            style={{
              marginTop: 4,
              fontSize: ".62rem",
              color: "var(--rp-muted)",
              fontWeight: 850,
              textAlign: "right",
            }}
          >
            {hasRealVehicleImage ? "Foto del vehículo" : "Ilustración referencial"}
          </div>
        </div>
      </div>

    </div>
  );
}

const PASSENGER_RAPA_NUI_LIVE_BOUNDS = {
  north: -27.01,
  south: -27.25,
  west: -109.54,
  east: -109.17,
} as const;

function isPassengerRapaNuiLivePoint(
  lat: number,
  lng: number,
): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat <= PASSENGER_RAPA_NUI_LIVE_BOUNDS.north &&
    lat >= PASSENGER_RAPA_NUI_LIVE_BOUNDS.south &&
    lng >= PASSENGER_RAPA_NUI_LIVE_BOUNDS.west &&
    lng <= PASSENGER_RAPA_NUI_LIVE_BOUNDS.east
  );
}

async function fetchRideLiveDriverPoint(
  token: string,
  rideId: string,
): Promise<DriverLivePoint | null> {
  const point = await rideLocationService.latest(token, rideId);
  if (!point) return null;

  const lat = Number(point.lat);
  const lng = Number(point.lng);

  const accuracy =
    point.accuracyMeters != null && Number.isFinite(Number(point.accuracyMeters))
      ? Number(point.accuracyMeters)
      : null;

  if (
    !isPassengerRapaNuiLivePoint(lat, lng) ||
    (accuracy != null && accuracy > 250)
  ) {
    return null;
  }

  return {
    lat,
    lng,
    heading:
      point.headingDegrees != null && Number.isFinite(Number(point.headingDegrees))
        ? Number(point.headingDegrees)
        : null,
    speed:
      point.speedMetersPerSecond != null &&
      Number.isFinite(Number(point.speedMetersPerSecond))
        ? Number(point.speedMetersPerSecond)
        : null,
    accuracy,
    updatedAt: point.capturedAt || point.receivedAt || null,
  };
}

function isValidDriverPoint(point: DriverLivePoint | null): point is DriverLivePoint {
  return Boolean(
    point &&
      isPassengerRapaNuiLivePoint(Number(point.lat), Number(point.lng)) &&
      (point.accuracy == null || Number(point.accuracy) <= 250),
  );
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

  if (import.meta.env.DEV) {
    const localLivePoint = readPassengerLocalDriverLivePoint(ride.id);
    if (isValidDriverPoint(localLivePoint)) {
      return {
        lat: localLivePoint.lat,
        lng: localLivePoint.lng,
      };
    }
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

function isRoundTripReturnPickupRide(ride: Partial<RideRequestData> & Record<string, unknown>): boolean {
  const notes = String(ride.notes ?? "").toLowerCase();
  const text = [
    ride.bookingPurpose,
    ride.serviceType,
    ride.reservationStatus,
    ride.adminScheduleStatus,
    ride.requestKind,
    ride.dispatchStatus,
  ]
    .map((value) => String(value ?? "").toLowerCase())
    .join(" ");

  return (
    ride.roundTripReturnOnly === true ||
    ride.roundTripReturnPickup === true ||
    ride.includedInRoundTripFare === true ||
    text.includes("round_trip_return") ||
    text.includes("return_pickup") ||
    notes.includes("agendamiento de recogida de regreso") ||
    notes.includes("ida_mas_agendamiento_recogida")
  );
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

  const requeueMirror = isDriverCancelledRequeuedRide(rideRecord)
    ? rideRecord
    : findPassengerDriverCancelledRequeueMirror(rideRecord);
  if (requeueMirror && !passengerAcceptedDriverIsNewerThanRequeue(rideRecord, requeueMirror)) return "requested";

  if (rawStatus === "cancelled" || rawStatus === "completed") return rawStatus;
  if (rawStatus === "pending_payment") return "pending_payment";

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
  if (status === "pending_payment") return "En aprobación del pago con tarjeta";
  if (status === "scheduled") return "Agendado";
  if (status === "driver_scheduled") return "Tu conductor fue asignado";
  return RIDE_STATUS_LABEL[status] ?? status;
}

function getPassengerRideStatusColor(status: string): string {
  if (status === "pending_payment") return "warning";
  if (status === "scheduled") return "warning";
  if (status === "driver_scheduled") return "success";
  return RIDE_STATUS_COLOR[status] ?? "medium";
}

function rideStatusTitle(status: string, ride?: RideRequestData): string {
  if (status === "pending_payment") return "Esperando aprobación del pago";
  if (status === "driver_scheduled") return "Tu conductor fue asignado";
  if (status === "scheduled" && ride && isRoundTripReturnPickupRide(ride as RideRequestData & Record<string, unknown>)) return "Agendamiento de recogida";
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

  if (effectiveStatus === "pending_payment") {
    return "El proveedor de tarjeta está verificando el cobro. Apenas figure como aprobado, la solicitud se enviará automáticamente a los conductores.";
  }

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
  if (effectiveStatus === "driver_arrived") return "Tu conductor llegó al punto. Sal ahora para evitar No show.";
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
  const lastRouteRequestAtRef = useRef(0);
  const didFitBoundsRef = useRef(false);
  const lastDriverPointRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastPassengerMapFollowAtRef = useRef(0);

  const [mapReady, setMapReady] = useState(false);
  const [liveDriverPoint, setLiveDriverPoint] = useState<DriverLivePoint | null>(null);
  const [liveDriverError, setLiveDriverError] = useState<string | null>(null);
  const [lastLiveUpdate, setLastLiveUpdate] = useState<Date | null>(null);
  const [followDriver, setFollowDriver] = useState(true);
  const [routeInfo, setRouteInfo] = useState<{ distanceText: string; durationText: string; meters: number | null } | null>(null);

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
  const lastLiveUpdateAgeSeconds = lastLiveUpdate
    ? Math.max(0, Math.floor((Date.now() - lastLiveUpdate.getTime()) / 1000))
    : null;
  const liveSignalIsStale =
    lastLiveUpdateAgeSeconds != null && lastLiveUpdateAgeSeconds > 15;

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

  function makeDriverVehicleIcon(rotation: number): google.maps.Icon {
    const safeRotation = ((rotation % 360) + 360) % 360;
    const vehicleSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 72 72">
        <defs>
          <filter id="shadow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#020617" flood-opacity=".46"/>
          </filter>
        </defs>
        <g transform="rotate(${safeRotation} 36 36)" filter="url(#shadow)">
          <circle cx="36" cy="36" r="29" fill="#ffffff" fill-opacity=".96" stroke="#c89b3c" stroke-width="3"/>
          <g class="rapago-driver-car">
            <rect x="22" y="9" width="28" height="54" rx="12" fill="#2382ff" stroke="#ffffff" stroke-width="3"/>
            <path d="M27 21 Q36 15 45 21 L47 31 H25 Z" fill="#dbeafe" stroke="#0f172a" stroke-width="1.7"/>
            <path d="M25 39 H47 L44 53 Q36 57 28 53 Z" fill="#bfdbfe" stroke="#0f172a" stroke-width="1.7"/>
            <rect x="18" y="19" width="6" height="13" rx="3" fill="#111827"/>
            <rect x="48" y="19" width="6" height="13" rx="3" fill="#111827"/>
            <rect x="18" y="42" width="6" height="13" rx="3" fill="#111827"/>
            <rect x="48" y="42" width="6" height="13" rx="3" fill="#111827"/>
            <circle cx="28" cy="14" r="2.5" fill="#fde047"/>
            <circle cx="44" cy="14" r="2.5" fill="#fde047"/>
            <circle cx="28" cy="58" r="2.3" fill="#ef4444"/>
            <circle cx="44" cy="58" r="2.3" fill="#ef4444"/>
            <path d="M36 4 L31 12 H41 Z" fill="#c89b3c" stroke="#ffffff" stroke-width="1.5"/>
          </g>
        </g>
      </svg>
    `;

    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(vehicleSvg)}`,
      scaledSize: new google.maps.Size(58, 58),
      anchor: new google.maps.Point(29, 29),
    };
  }

  function createOrMoveMarker(
    ref: React.MutableRefObject<google.maps.Marker | null>,
    map: google.maps.Map,
    point: { lat: number; lng: number } | null,
    options: {
      title: string;
      icon: google.maps.Symbol | google.maps.Icon;
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

    if (driverPoint && ["driver_scheduled", "accepted", "driver_en_route", "driver_arrived", "in_progress"].includes(effectiveMapStatus)) {
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
    // El puente local solo existe para pruebas en un mismo navegador.
    // En producción nunca se toma la ubicación de otro conductor desde localStorage.
    if (!import.meta.env.DEV) return;

    const shouldTrackDriver = [
      "driver_scheduled",
      "accepted",
      "driver_en_route",
      "driver_arrived",
      "in_progress",
    ].includes(effectiveMapStatus);

    function loadLocalLivePoint(): void {
      const point = readPassengerLocalDriverLivePoint(ride.id);

      if (point) {
        setLiveDriverPoint(point);
        setLastLiveUpdate(
          point.updatedAt ? new Date(point.updatedAt) : new Date(),
        );
        setLiveDriverError(null);
      }
    }

    loadLocalLivePoint();

    if (!shouldTrackDriver) return;

    const handleLocalLiveUpdate = (event: Event): void => {
      const detail = (
        event as CustomEvent<PassengerLocalDriverLivePayload>
      ).detail;

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

    window.addEventListener(
      RAPAGO_DRIVER_LIVE_LOCATION_EVENT,
      handleLocalLiveUpdate as EventListener,
    );
    window.addEventListener("storage", handleStorageUpdate);

    const timerId = window.setInterval(loadLocalLivePoint, 2500);

    return () => {
      window.removeEventListener(
        RAPAGO_DRIVER_LIVE_LOCATION_EVENT,
        handleLocalLiveUpdate as EventListener,
      );
      window.removeEventListener("storage", handleStorageUpdate);
      window.clearInterval(timerId);
    };
  }, [ride.id, effectiveMapStatus]);

  useEffect(() => {
    const shouldTrackDriver = [
      "driver_scheduled",
      "accepted",
      "driver_en_route",
      "driver_arrived",
      "in_progress",
    ].includes(effectiveMapStatus);

    if (!shouldTrackDriver) {
      setLiveDriverPoint(null);
      setLiveDriverError(null);
      setLastLiveUpdate(null);
      return;
    }

    const developmentFallback = import.meta.env.DEV
      ? readPassengerLocalDriverLivePoint(ride.id)
      : null;

    if (!token) {
      if (developmentFallback) {
        setLiveDriverPoint(developmentFallback);
        setLastLiveUpdate(
          developmentFallback.updatedAt
            ? new Date(developmentFallback.updatedAt)
            : new Date(),
        );
        setLiveDriverError(null);
      } else {
        setLiveDriverError("Esperando una sesión válida para ver el GPS.");
      }
      return;
    }

    let stopped = false;

    async function loadLiveDriver(): Promise<void> {
      try {
        const point = await fetchRideLiveDriverPoint(token, ride.id);
        if (stopped) return;

        if (point) {
          setLiveDriverPoint(point);
          setLastLiveUpdate(
            point.updatedAt ? new Date(point.updatedAt) : new Date(),
          );
          setLiveDriverError(null);
          return;
        }

        if (developmentFallback) {
          setLiveDriverPoint(developmentFallback);
          setLastLiveUpdate(
            developmentFallback.updatedAt
              ? new Date(developmentFallback.updatedAt)
              : new Date(),
          );
          setLiveDriverError(null);
          return;
        }

        setLiveDriverError("Esperando señal GPS real del conductor.");
      } catch {
        if (stopped) return;

        if (developmentFallback) {
          setLiveDriverPoint(developmentFallback);
          setLastLiveUpdate(
            developmentFallback.updatedAt
              ? new Date(developmentFallback.updatedAt)
              : new Date(),
          );
          setLiveDriverError(null);
          return;
        }

        // Conservamos el último punto real para evitar que el vehículo desaparezca
        // durante una pérdida breve de señal móvil en Rapa Nui.
        setLiveDriverError("Señal GPS temporalmente interrumpida.");
      }
    }

    void loadLiveDriver();

    const timerId = window.setInterval(() => {
      void loadLiveDriver();
    }, 2000);

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
          zoom: 16,
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

        map.addListener("dragstart", () => {
          setFollowDriver(false);
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

  function followPassengerDriverCamera(
    point: { lat: number; lng: number },
    force = false,
  ): void {
    const map = mapRef.current;
    if (!map) return;
    if (!force && !followDriver) return;

    const now = Date.now();
    if (!force && now - lastPassengerMapFollowAtRef.current < 900) return;
    lastPassengerMapFollowAtRef.current = now;

    map.panTo(point);
    if (force || (map.getZoom() ?? 0) < 17) {
      map.setZoom(18);
      try {
        map.setTilt(45);
      } catch {
        // Tilt opcional según navegador.
      }
    }
  }

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !window.google?.maps) return;

    const shouldShowDriver =
      driverPoint && ["driver_scheduled", "accepted", "driver_en_route", "driver_arrived", "in_progress"].includes(effectiveMapStatus);

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

    const icon = makeDriverVehicleIcon(rotation);

    if (!driverMarkerRef.current) {
      driverMarkerRef.current = new google.maps.Marker({
        map,
        position: driverPoint,
        title: "Conductor en tiempo real",
        icon,
        zIndex: 40,
      });

      lastDriverPointRef.current = driverPoint;
      followPassengerDriverCamera(driverPoint, true);
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

    followPassengerDriverCamera(driverPoint);
    lastDriverPointRef.current = driverPoint;
  }, [
    mapReady,
    effectiveMapStatus,
    driverPoint?.lat,
    driverPoint?.lng,
    liveDriverPoint?.heading,
    followDriver,
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

    const now = Date.now();
    if (
      routeKeyRef.current &&
      now - lastRouteRequestAtRef.current < 12_000
    ) {
      return;
    }

    routeKeyRef.current = routeKey;
    lastRouteRequestAtRef.current = now;

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

        // Si Google no entrega ruta por calle, no dibujamos una línea ficticia.
        // El pasajero igual ve conductor/punto de recogida/destino reales.
        setRouteInfo({
          distanceText: distanceLabel,
          durationText: "Esperando ruta de Google",
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

      {driverPoint && !followDriver && (
        <button
          type="button"
          onClick={() => {
            setFollowDriver(true);
            followPassengerDriverCamera(driverPoint, true);
          }}
          aria-label="Volver a centrar el vehículo"
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            zIndex: 70,
            border: "1px solid rgba(200,155,60,.72)",
            borderRadius: 999,
            minHeight: 42,
            padding: "0 13px",
            background: "rgba(255,255,255,.96)",
            color: "#111827",
            fontWeight: 950,
            boxShadow: "0 10px 28px rgba(2,6,23,.32)",
            display: "flex",
            alignItems: "center",
            gap: 7,
          }}
        >
          <IonIcon icon={locationOutline} aria-hidden="true" />
          Centrar vehículo
        </button>
      )}

      {/* Panel inferior: el pasajero ve la flecha del conductor y el avance con GPS real. */}
      {driverPoint && ["driver_scheduled", "accepted", "driver_en_route", "driver_arrived", "in_progress"].includes(effectiveMapStatus) && (
        <div
          data-rapago-driver-map-status="true"
          style={{
            position: "absolute",
            left: 12,
            right: 12,
            bottom: 38,
            zIndex: 50,
            minHeight: 68,
            borderRadius: 18,
            padding: "11px 13px",
            background: "rgba(255,255,255,.97)",
            color: "#111827",
            WebkitTextFillColor: "#111827",
            boxShadow: "0 16px 38px rgba(2,6,23,.36)",
            border: "2px solid rgba(200,155,60,.88)",
            backdropFilter: "blur(10px)",
            pointerEvents: "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 14,
                background: "#f4c453",
                color: "#111827",
                WebkitTextFillColor: "#111827",
                display: "grid",
                placeItems: "center",
                flex: "0 0 auto",
                boxShadow: "0 7px 16px rgba(146,100,18,.24)",
                border: "1px solid rgba(17,24,39,.14)",
              }}
            >
              <IonIcon
                icon={carOutline}
                aria-hidden="true"
                style={{
                  fontSize: 24,
                  color: "#111827",
                  WebkitTextFillColor: "#111827",
                }}
              />
            </div>

            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  color: "#111827",
                  WebkitTextFillColor: "#111827",
                  fontWeight: 950,
                  fontSize: ".92rem",
                  lineHeight: 1.2,
                  textShadow: "none",
                }}
              >
                {effectiveMapStatus === "driver_arrived"
                  ? "Tu conductor llegó al punto"
                  : effectiveMapStatus === "in_progress"
                    ? "Viaje en curso"
                    : "Tu conductor viene en camino"}
              </div>

              <div
                style={{
                  marginTop: 4,
                  fontSize: ".76rem",
                  lineHeight: 1.35,
                  color: "#334155",
                  WebkitTextFillColor: "#334155",
                  fontWeight: 800,
                  whiteSpace: "normal",
                  overflow: "visible",
                  textOverflow: "clip",
                  textShadow: "none",
                }}
              >
                {effectiveMapStatus === "driver_arrived"
                  ? "Sal ahora al punto de recogida."
                  : routeInfo?.durationText
                    ? `${routeInfo.durationText}`
                    : "GPS real activo"}
                {effectiveMapStatus !== "driver_arrived" &&
                routeInfo?.distanceText
                  ? ` · ${routeInfo.distanceText}`
                  : ""}
                {effectiveMapStatus !== "driver_arrived"
                  ? effectiveMapStatus === "in_progress"
                    ? " hasta tu destino."
                    : " hasta el punto de recogida."
                  : ""}
                {lastLiveUpdateAgeSeconds != null
                  ? ` · Actualizado hace ${lastLiveUpdateAgeSeconds} s`
                  : ""}
                {liveDriverError ? ` · ${liveDriverError}` : ""}
              </div>
            </div>

            <div
              style={{
                alignSelf: "flex-start",
                padding: "4px 7px",
                borderRadius: 999,
                background: liveSignalIsStale ? "#fef3c7" : "#dcfce7",
                color: liveSignalIsStale ? "#92400e" : "#166534",
                WebkitTextFillColor: liveSignalIsStale ? "#92400e" : "#166534",
                border: liveSignalIsStale
                  ? "1px solid #f59e0b"
                  : "1px solid #86efac",
                fontSize: ".62rem",
                lineHeight: 1,
                fontWeight: 950,
                whiteSpace: "nowrap",
              }}
            >
              {liveSignalIsStale ? "SEÑAL ANTIGUA" : "GPS EN VIVO"}
            </div>
          </div>
        </div>
      )}

      {/* Marcadores limpios: sin textos encima del mapa para no tapar la ruta. */}
    </div>
  );
}


function getHistoricalRidePoint(
  lat: number | null | undefined,
  lng: number | null | undefined,
): { lat: number; lng: number } | null {
  const latitude = Number(lat);
  const longitude = Number(lng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;

  return { lat: latitude, lng: longitude };
}

function historicalRideMarkerIcon(
  fillColor: string,
  scale: number,
): google.maps.Symbol {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale,
    fillColor,
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: 4,
  };
}

function PassengerHistoricalRouteMap({
  ride,
  token,
  height = 270,
}: {
  ride: RideRequestData;
  token: string;
  height?: number;
}): JSX.Element {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const [routeState, setRouteState] = useState<
    "loading" | "recorded" | "no_trace" | "error"
  >("loading");
  const [routePointCount, setRoutePointCount] = useState(0);
  const [actualDistanceMeters, setActualDistanceMeters] = useState<number | null>(null);
  const [actualDurationSeconds, setActualDurationSeconds] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let originMarker: google.maps.Marker | null = null;
    let destinationMarker: google.maps.Marker | null = null;
    let routePolyline: google.maps.Polyline | null = null;
    let map: google.maps.Map | null = null;

    async function renderHistoricalRoute(): Promise<void> {
      setRouteState("loading");
      setRoutePointCount(0);
      setActualDistanceMeters(null);
      setActualDurationSeconds(null);

      try {
        const [points] = await Promise.all([
          ridesService.getRideRouteHistory(token, ride.id),
          loadRapaGoGoogleMaps(),
        ]);

        if (cancelled || !mapElementRef.current || !window.google?.maps) return;

        const validRecordedPoints = points
          .map((point) => ({
            point: getHistoricalRidePoint(point.lat, point.lng),
            capturedAt: point.capturedAt,
          }))
          .filter(
            (entry): entry is { point: { lat: number; lng: number }; capturedAt: string } =>
              entry.point !== null,
          );
        const recordedPoints = validRecordedPoints.map((entry) => entry.point);
        const origin = getHistoricalRidePoint(ride.originLat, ride.originLng);
        const destination = getHistoricalRidePoint(
          ride.destinationLat,
          ride.destinationLng,
        );
        const center = recordedPoints[0] ?? origin ?? destination ?? {
          lat: -27.1505,
          lng: -109.4325,
        };

        map = new google.maps.Map(mapElementRef.current, {
          center,
          zoom: 13,
          disableDefaultUI: true,
          zoomControl: true,
          fullscreenControl: true,
          gestureHandling: "cooperative",
        });

        if (origin) {
          originMarker = new google.maps.Marker({
            map,
            position: origin,
            title: `Origen: ${ride.originText}`,
            icon: historicalRideMarkerIcon("#16a34a", 10),
            label: {
              text: "O",
              color: "#ffffff",
              fontSize: "10px",
              fontWeight: "900",
            },
            zIndex: 20,
          });
        }

        if (destination) {
          destinationMarker = new google.maps.Marker({
            map,
            position: destination,
            title: `Destino: ${ride.destinationText}`,
            icon: historicalRideMarkerIcon("#dc2626", 10),
            label: {
              text: "D",
              color: "#ffffff",
              fontSize: "10px",
              fontWeight: "900",
            },
            zIndex: 20,
          });
        }

        if (recordedPoints.length >= 2) {
          routePolyline = new google.maps.Polyline({
            map,
            path: recordedPoints,
            geodesic: true,
            strokeColor: "#2563eb",
            strokeOpacity: 0.95,
            strokeWeight: 6,
          });
        }

        const bounds = new google.maps.LatLngBounds();
        recordedPoints.forEach((point) => bounds.extend(point));
        if (origin) bounds.extend(origin);
        if (destination) bounds.extend(destination);

        if (!bounds.isEmpty()) {
          map.fitBounds(bounds, 56);
        }

        const routeDistance =
          recordedPoints.length >= 2
            ? Math.round(
                recordedPoints.reduce((total, point, index) => {
                  const previous = recordedPoints[index - 1];
                  return previous
                    ? total + getPassengerDistanceMeters(previous, point)
                    : total;
                }, 0),
              )
            : null;
        const firstCapturedAt = validRecordedPoints[0]?.capturedAt;
        const lastCapturedAt = validRecordedPoints[validRecordedPoints.length - 1]?.capturedAt;
        const routeDuration =
          firstCapturedAt && lastCapturedAt
            ? Math.max(
                0,
                Math.round(
                  (new Date(lastCapturedAt).getTime() -
                    new Date(firstCapturedAt).getTime()) /
                    1000,
                ),
              )
            : null;

        setRoutePointCount(recordedPoints.length);
        setActualDistanceMeters(routeDistance);
        setActualDurationSeconds(
          routeDuration != null && Number.isFinite(routeDuration)
            ? routeDuration
            : null,
        );
        setRouteState(recordedPoints.length >= 2 ? "recorded" : "no_trace");
      } catch {
        if (!cancelled) {
          setRouteState("error");
          setRoutePointCount(0);
        }
      }
    }

    void renderHistoricalRoute();

    return () => {
      cancelled = true;
      originMarker?.setMap(null);
      destinationMarker?.setMap(null);
      routePolyline?.setMap(null);
      if (map && window.google?.maps) {
        google.maps.event.clearInstanceListeners(map);
      }
    };
  }, [ride.id, ride.originLat, ride.originLng, ride.destinationLat, ride.destinationLng, ride.originText, ride.destinationText, token]);

  const distanceLabel = formatPassengerDistanceMeters(
    actualDistanceMeters ?? ride.distanceMeters,
  );
  const resolvedDurationSeconds = actualDurationSeconds ?? ride.durationSeconds;
  const durationMinutes =
    resolvedDurationSeconds != null && Number.isFinite(Number(resolvedDurationSeconds))
      ? Math.max(1, Math.round(Number(resolvedDurationSeconds) / 60))
      : null;

  return (
    <div
      className="rapago-historical-route-map"
      style={{
        position: "relative",
        width: "100%",
        minHeight: height,
        background: "#dcecf3",
        overflow: "hidden",
      }}
    >
      <div ref={mapElementRef} style={{ width: "100%", height }} />

      <div
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          right: 10,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 8,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            padding: "7px 10px",
            borderRadius: 999,
            background: "rgba(17,24,39,.88)",
            color: "#ffffff",
            fontSize: ".68rem",
            fontWeight: 950,
            boxShadow: "0 6px 18px rgba(0,0,0,.20)",
          }}
        >
          {routeState === "loading"
            ? "Cargando ruta del servicio..."
            : routeState === "recorded"
              ? `Ruta GPS real registrada · ${routePointCount} puntos`
              : routeState === "no_trace"
                ? "Sin trazado GPS guardado"
                : "No se pudo cargar la ruta registrada"}
        </div>

        {(distanceLabel || durationMinutes != null) && (
          <div
            style={{
              padding: "7px 10px",
              borderRadius: 999,
              background: "rgba(255,255,255,.94)",
              color: "#111827",
              fontSize: ".68rem",
              fontWeight: 950,
              boxShadow: "0 6px 18px rgba(0,0,0,.16)",
              textAlign: "right",
            }}
          >
            {[distanceLabel, durationMinutes != null ? `${durationMinutes} min` : null]
              .filter(Boolean)
              .join(" · ")}
          </div>
        )}
      </div>

      {routeState === "no_trace" && (
        <div
          style={{
            position: "absolute",
            left: 12,
            right: 12,
            bottom: 12,
            borderRadius: 14,
            padding: "9px 11px",
            background: "rgba(255,255,255,.95)",
            color: "#334155",
            fontSize: ".72rem",
            fontWeight: 850,
            lineHeight: 1.3,
            boxShadow: "0 8px 20px rgba(0,0,0,.16)",
            pointerEvents: "none",
          }}
        >
          Se muestran origen y destino. RAPA GO no inventa una ruta cuando el GPS histórico no fue registrado.
        </div>
      )}
    </div>
  );
}

function formatPassengerReceiptDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Pacific/Easter",
  }).format(date);
}

function PassengerFinalRideSummary({
  ride,
  effectiveStatus,
}: {
  ride: RideRequestData;
  effectiveStatus: string;
}): JSX.Element {
  const noShow = isPassengerNoShowCompletedRide(ride);
  const statusLabel = noShow
    ? "NO SHOW"
    : effectiveStatus === "completed"
      ? "COMPLETADO"
      : "CANCELADO";
  const statusTone = noShow || effectiveStatus === "cancelled" ? "danger" : "success";
  const distanceLabel = formatPassengerDistanceMeters(ride.distanceMeters);
  const durationLabel =
    ride.durationSeconds != null && Number.isFinite(Number(ride.durationSeconds))
      ? `${Math.max(1, Math.round(Number(ride.durationSeconds) / 60))} min`
      : "No informada";
  const vehicle = [
    ride.driverVehicleBrand,
    ride.driverVehicleModel,
    ride.driverVehicleYear,
    ride.driverVehicleColor,
    ride.driverVehiclePlate ? `Patente ${ride.driverVehiclePlate}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const timeline = [
    ["Solicitado", ride.requestedAt],
    ["Asignado", ride.acceptedAt],
    ["En camino", ride.enRouteAt],
    ["Llegó", ride.arrivedAt],
    ["Iniciado", ride.startedAt],
    [noShow ? "No show" : effectiveStatus === "cancelled" ? "Cancelado" : "Completado", noShow || effectiveStatus === "cancelled" ? ride.cancelledAt : ride.completedAt],
  ]
    .map(([label, value]) => [label, formatPassengerReceiptDate(value)] as const)
    .filter(([, value]) => value !== null);

  return (
    <div
      className="rapago-trip-theme-panel rapago-passenger-trip-receipt"
      data-final-trip-record="true"
      style={{
        marginBottom: 14,
        borderRadius: 18,
        padding: "13px 14px",
        background: "var(--rp-surface)",
        border: "1px solid var(--rp-border-c)",
        color: "var(--rp-text)",
        boxShadow: "0 8px 22px rgba(0,0,0,.08)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 950, fontSize: ".96rem", lineHeight: 1.25 }}>
            {ride.originText} → {ride.destinationText}
          </div>
          <div style={{ marginTop: 4, color: "var(--rp-muted)", fontSize: ".73rem", fontWeight: 800 }}>
            {distanceLabel} · {durationLabel}
          </div>
        </div>
        <IonBadge color={statusTone}>{statusLabel}</IonBadge>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2,minmax(0,1fr))",
          gap: 8,
          marginTop: 12,
        }}
      >
        <div style={{ padding: 10, borderRadius: 14, background: "var(--rp-surface-soft)" }}>
          <div style={{ color: "var(--rp-muted)", fontSize: ".66rem", fontWeight: 950 }}>TARIFA FINAL</div>
          <div style={{ marginTop: 2, fontWeight: 950 }}>{formatClp(getRideDisplayFareClp(ride))}</div>
        </div>
        <div style={{ padding: 10, borderRadius: 14, background: "var(--rp-surface-soft)" }}>
          <div style={{ color: "var(--rp-muted)", fontSize: ".66rem", fontWeight: 950 }}>PAGO</div>
          <div style={{ marginTop: 2, fontWeight: 950 }}>{getRidePaymentMethodLabel(ride)}</div>
        </div>
      </div>

      <div style={{ marginTop: 12, fontSize: ".78rem", lineHeight: 1.45 }}>
        <div><strong>Conductor:</strong> {ride.driverName ?? "No informado"}</div>
        <div><strong>Vehículo:</strong> {vehicle || "No informado"}</div>
        {effectiveStatus === "cancelled" && ride.cancellationReason && (
          <div><strong>Motivo:</strong> {ride.cancellationReason}</div>
        )}
      </div>

      {timeline.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(92px,.7fr) minmax(0,1.3fr)",
            gap: "5px 10px",
            marginTop: 12,
            paddingTop: 10,
            borderTop: "1px solid var(--rp-border-c)",
            fontSize: ".72rem",
          }}
        >
          {timeline.map(([timelineLabel, timelineValue]) => (
            <div key={`${timelineLabel}-${timelineValue}`} style={{ display: "contents" }}>
              <strong style={{ color: "var(--rp-muted)" }}>{timelineLabel}</strong>
              <span>{timelineValue}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


type PassengerCashPaymentDecision = "exact" | "wallet_credit" | "bank_refund" | "refund_whatsapp";

type PassengerCashPaymentReview = {
  id: string;
  rideId: string;
  rideKey: string;
  originText: string;
  destinationText: string;
  fareClp: number;
  paidClp: number;
  overpaidClp: number;
  decision: PassengerCashPaymentDecision;
  status: "completed" | "pending_refund" | "wallet_available" | "pending_wallet_admin";
  adminReviewStatus: "not_required" | "pending_admin" | "admin_approved" | "refund_requested" | "refund_completed";
  createdAt: string;
  passengerEmail?: string | null;
  passengerName?: string | null;
  source?: "passenger_cash_overpayment" | "passenger_cash_exact" | string | null;
  passengerPaidClp?: number | null;
  passengerOverpaidClp?: number | null;
  passengerDecision?: PassengerCashPaymentDecision | string | null;
  passengerWantsWalletCredit?: boolean | null;
  passengerWantsRefund?: boolean | null;
};

const RAPAGO_CASH_PAYMENT_REVIEWS_KEY = "rapago_cash_payment_reviews_v1";
const RAPAGO_WALLET_BENEFITS_KEY = "rapago_wallet_benefits_v1";
const RAPAGO_WALLET_BENEFIT_EVENT = "rapago:wallet-benefit-updated";
const RAPAGO_PASSENGER_PENDING_CHARGES_KEY = "rapago_passenger_pending_charges_v1";
const RAPAGO_PASSENGER_PENDING_CHARGE_EVENT = "rapago:passenger-pending-charge-updated";

type PassengerPendingCharge = {
  id: string;
  rideId?: string | null;
  rideKey: string;
  passengerEmail?: string | null;
  passengerName?: string | null;
  originText: string;
  destinationText: string;
  amountClp: number;
  minimumFareClp: number;
  applicableFareClp?: number | null;
  feePercent?: number | null;
  feeCapClp?: number | null;
  type: "late_cancel" | "no_show";
  paymentMethod?: string | null;
  status: string;
  adminReviewStatus: string;
  createdAt: string;
  appliedRideId?: string | null;
  appliedAt?: string | null;
  title: string;
  description: string;
  requestedExemption?: boolean | null;
  cancellationReasonCode?: string | null;
  cancellationReasonLabel?: string | null;
  adminDecisionReason?: string | null;
  cardRefundRequested?: boolean | null;
  mercadoPagoRefundRequested?: boolean | null;
  mercadoPagoRefundStatus?: string | null;
  cardRefundNotice?: string | null;
};

function sanitizePassengerMoneyInput(value: unknown): number {
  const clean = String(value ?? "")
    .replace(/[^\d]/g, "")
    .slice(0, 8);

  const amount = Number(clean);

  if (!Number.isFinite(amount) || amount <= 0) return 0;

  return Math.min(Math.round(amount), 50_000_000);
}

function getPassengerCashPaymentRideKey(ride: Partial<RideRequestData> & Record<string, unknown>): string {
  const id = String(ride.id ?? ride.rideId ?? ride.originalRideId ?? "").trim();
  if (id) return `ride:${id}`;

  return [
    String(ride.passengerEmail ?? "").trim().toLowerCase(),
    String(ride.originText ?? "").trim().toLowerCase(),
    String(ride.destinationText ?? "").trim().toLowerCase(),
    String(ride.completedAt ?? ride.requestedAt ?? ride.createdAt ?? "").trim(),
  ].join("|");
}

function isPassengerCashPaymentRide(ride: RideRequestData): boolean {
  const text = String(ride.notes ?? "").toLowerCase();
  const label = getRidePaymentMethodLabel(ride).toLowerCase();

  return (
    label.includes("efectivo") ||
    text.includes("efectivo") ||
    text.includes("cash") ||
    text.includes("pago en efectivo")
  );
}

function readPassengerCashPaymentReviews(): Record<string, PassengerCashPaymentReview> {
  try {
    const raw = localStorage.getItem(RAPAGO_CASH_PAYMENT_REVIEWS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};

    if (Array.isArray(parsed)) {
      return parsed.reduce<Record<string, PassengerCashPaymentReview>>((acc, item, index) => {
        if (!item || typeof item !== "object") return acc;
        const record = item as PassengerCashPaymentReview & Record<string, unknown>;
        const prefix = String(record.id ?? "").startsWith("driver-cash-close") ? "driver" : "passenger";
        const key = `${prefix}:${String(record.rideKey ?? record.rideId ?? `cash-${index}`)}`;
        acc[key] = record;
        return acc;
      }, {});
    }

    return parsed && typeof parsed === "object" ? (parsed as Record<string, PassengerCashPaymentReview>) : {};
  } catch {
    return {};
  }
}

function writePassengerCashPaymentReviews(reviews: Record<string, PassengerCashPaymentReview>): void {
  try {
    localStorage.setItem(RAPAGO_CASH_PAYMENT_REVIEWS_KEY, JSON.stringify(reviews));
  } catch {
    // No bloquea Mis Viajes.
  }
}

function getPassengerCashPaymentReview(ride: RideRequestData): PassengerCashPaymentReview | null {
  const key = getPassengerCashPaymentRideKey(ride as RideRequestData & Record<string, unknown>);
  const reviews = readPassengerCashPaymentReviews();
  return reviews[`passenger:${key}`] ?? reviews[key] ?? null;
}

function savePassengerCashPaymentReview(
  ride: RideRequestData,
  input: Omit<PassengerCashPaymentReview, "id" | "rideId" | "rideKey" | "originText" | "destinationText" | "createdAt" | "passengerEmail" | "passengerName">,
): PassengerCashPaymentReview {
  const record = ride as RideRequestData & Record<string, unknown>;
  const key = getPassengerCashPaymentRideKey(record);
  const now = new Date().toISOString();

  const review: PassengerCashPaymentReview = {
    id: `passenger-cash-review-${String(record.id ?? "local")}-${Date.now()}`,
    rideId: String(record.id ?? record.rideId ?? record.originalRideId ?? ""),
    rideKey: key,
    originText: String(ride.originText ?? ""),
    destinationText: String(ride.destinationText ?? ""),
    fareClp: input.fareClp,
    paidClp: input.paidClp,
    overpaidClp: input.overpaidClp,
    decision: input.decision,
    status: input.status,
    adminReviewStatus: input.adminReviewStatus,
    createdAt: now,
    passengerEmail: String(record.passengerEmail ?? record.email ?? "").trim() || null,
    passengerName: String(record.passengerName ?? record.userName ?? record.name ?? "").trim() || null,
    source: input.decision === "exact" ? "passenger_cash_exact" : "passenger_cash_overpayment",
    passengerPaidClp: input.paidClp,
    passengerOverpaidClp: input.overpaidClp,
    passengerDecision: input.decision,
    passengerWantsWalletCredit: input.decision === "wallet_credit",
    passengerWantsRefund: input.decision === "bank_refund" || input.decision === "refund_whatsapp",
  };

  const reviews = readPassengerCashPaymentReviews();
  // Importante: se guarda separado como passenger:<rideKey> para no pisar
  // el cierre del conductor. Así admin puede comparar conductor vs usuario.
  reviews[`passenger:${key}`] = review;
  writePassengerCashPaymentReviews(reviews);

  try {
    window.dispatchEvent(new CustomEvent("rapago:cash-payment-review-updated", { detail: { review, ride } }));
    window.dispatchEvent(new CustomEvent("rapago:admin-cash-closures-updated", { detail: { review, ride } }));
    window.dispatchEvent(new CustomEvent("rapago:admin-rides-updated", { detail: { review, ride } }));
  } catch {
    // No bloquea Mis Viajes.
  }

  return review;
}

function savePassengerWalletBenefitFromCashOverpayment(
  ride: RideRequestData,
  review: PassengerCashPaymentReview,
): void {
  if (review.overpaidClp <= 0) return;

  const record = ride as RideRequestData & Record<string, unknown>;

  const nextBenefit = {
    id: `cash-overpayment-${review.rideId || review.rideKey}`,
    rideId: review.rideId || null,
    passengerEmail: review.passengerEmail,
    ownerKey: review.passengerEmail,
    amountClp: review.overpaidClp,
    status: "backend_review_required",
    source: "cash_overpayment_backend_review",
    title: "Pago de mas pendiente backend/admin",
    description:
      `Pago de mas informado por pasajero: ${formatClp(review.overpaidClp)}. ` +
      "No se guarda como saldo local ni se auto-aplica. El admin debe aprobarlo en backend wallet credit.",
    createdAt: review.createdAt,
    approvedBy: null,
    fareClp: review.fareClp,
    paidClp: review.paidClp,
    passengerPaidClp: review.paidClp,
    passengerOverpaidClp: review.overpaidClp,
    passengerWantsWalletCredit: true,
    driverId: record.assignedDriverId ?? record.driverId ?? null,
    adminReviewStatus: "backend_review_required",
    localStorageFinancialAuthority: false,
  };

  try {
    window.dispatchEvent(new CustomEvent(RAPAGO_WALLET_BENEFIT_EVENT, { detail: { benefit: nextBenefit, ride } }));
    window.dispatchEvent(new CustomEvent("rapago:wallet-updated", { detail: { benefit: nextBenefit, ride } }));
    window.dispatchEvent(new CustomEvent("rapago:admin-wallet-benefit-updated", { detail: { benefit: nextBenefit, review, ride } }));
    window.dispatchEvent(new CustomEvent("rapago:admin-cash-closures-updated", { detail: { benefit: nextBenefit, review, ride } }));
    window.dispatchEvent(new CustomEvent("rapago:cash-payment-review-updated", { detail: { benefit: nextBenefit, review, ride } }));
  } catch {
    // No bloquea Mis Viajes.
  }
}

function getPassengerCardCancellationCreditAmountClp(
  ride: Partial<RideRequestData> & Record<string, unknown>,
): number {
  const candidates = [
    ride.cardPaidClp,
    ride.mercadoPagoPaidClp,
    ride.paymentAmountClp,
    ride.paidClp,
    ride.totalPaidClp,
    ride.finalFareAfterWalletBenefitClp,
    ride.fareAfterWalletClp,
    ride.finalFareWithExtrasClp,
    ride.estimatedFareClp,
    ride.fareClp,
    ride.priceClp,
    ride.totalFareClp,
    extractFareFromNotes(String(ride.notes ?? "")),
  ];

  for (const candidate of candidates) {
    const parsed = Number(candidate);
    if (Number.isFinite(parsed) && parsed > 0) return Math.round(parsed);
  }

  return 0;
}

function getPassengerCardCancellationCreditNetClp(
  ride: Partial<RideRequestData> & Record<string, unknown>,
  cancellationFeeClp: number,
): number {
  const paidAmount = getPassengerCardCancellationCreditAmountClp(ride);
  const fee = Math.max(0, Math.round(Number(cancellationFeeClp ?? 0)));
  return Math.max(0, paidAmount - fee);
}

function savePassengerWalletCreditFromCardCancellation(
  ride: RideRequestData,
  cancelled: RideRequestData,
): void {
  // Phase 2 security:
  // Card/MercadoPago cancellation credits must not be created from localStorage/frontend.
  // Real refund/credit state must come from backend payment refund or admin wallet credit.
  return;
}


function normalizeRapaGoSupportWhatsAppPhone(phone: string): string {
  const digits = String(phone ?? "").replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15 ? digits : "56947964171";
}

function buildRapaGoSupportFolio(parts: unknown[]): string {
  const raw = parts.map((value) => String(value ?? "").trim()).filter(Boolean).join("|");
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 31 + raw.charCodeAt(i)) | 0;
  }
  return `RPG-${Math.abs(hash).toString(36).toUpperCase().padStart(6, "0").slice(0, 6)}`;
}

function formatRapaGoSupportDate(value: unknown): string | null {
  const time = new Date(String(value ?? "")).getTime();
  if (!Number.isFinite(time)) return null;
  return new Date(time).toLocaleDateString("es-CL");
}

function buildRapaGoRefundWhatsAppUrl(ride: RideRequestData, review: PassengerCashPaymentReview): string {
  const phone = normalizeRapaGoSupportWhatsAppPhone(RAPAGO_SUPPORT_WHATSAPP_PHONE);
  const rideRecord = ride as RideRequestData & Record<string, unknown>;
  const reviewRecord = review as PassengerCashPaymentReview & Record<string, unknown>;
  const folio = buildRapaGoSupportFolio([
    rideRecord["id"],
    rideRecord["rideId"],
    reviewRecord["id"],
    reviewRecord["rideId"],
    reviewRecord["createdAt"],
  ]);
  const supportDate = formatRapaGoSupportDate(reviewRecord["createdAt"] ?? rideRecord["completedAt"] ?? rideRecord["createdAt"]);

  const message = [
    "Soporte RAPA GO: solicitud de revision por pago en efectivo.",
    `Folio: ${folio}`,
    supportDate ? `Fecha solicitud: ${supportDate}` : null,
    "Revisar detalle en panel admin autenticado.",
  ].filter(Boolean);

  return `https://wa.me/${phone}?text=${encodeURIComponent(message.join("\n"))}`;
}

function openPassengerRefundWhatsApp(ride: RideRequestData, review: PassengerCashPaymentReview): void {
  const url = buildRapaGoRefundWhatsAppUrl(ride, review);

  try {
    window.open(url, "_blank", "noopener,noreferrer");
  } catch {
    window.location.href = url;
  }
}

function buildRapaGoCardCancelRefundWhatsAppUrl(ride: RideRequestData): string {
  const phone = normalizeRapaGoSupportWhatsAppPhone(RAPAGO_SUPPORT_WHATSAPP_PHONE);
  const record = ride as RideRequestData & Record<string, unknown>;
  const folio = buildRapaGoSupportFolio([
    record["id"],
    record["rideId"],
    record["paymentId"],
    record["mercadoPagoPaymentId"],
    record["cancelledAt"],
    record["createdAt"],
  ]);
  const supportDate = formatRapaGoSupportDate(record["cancelledAt"] ?? record["createdAt"]);

  const message = [
    "Soporte RAPA GO: solicitud de revision de devolucion por cancelacion con tarjeta.",
    `Folio: ${folio}`,
    supportDate ? `Fecha solicitud: ${supportDate}` : null,
    "Revisar detalle en panel admin autenticado.",
  ].filter(Boolean);

  return `https://wa.me/${phone}?text=${encodeURIComponent(message.join("\n"))}`;
}

function openRapaGoCardCancelRefundWhatsApp(ride: RideRequestData): void {
  if (!isPassengerCancellationCardPaymentForRefundAction(ride as RideRequestData & Record<string, unknown>)) {
    return;
  }

  const url = buildRapaGoCardCancelRefundWhatsAppUrl(ride);

  try {
    window.open(url, "_blank", "noopener,noreferrer");
  } catch {
    window.location.href = url;
  }
}

/* El diálogo largo de Cancelar/devolución se conserva (WhatsApp + texto
   legal), pero ya no salta solo al cancelar: tapa Mis Viajes y el pasajero
   no lo pidió. La devolución sigue en el botón del viaje cancelado. */
const AUTO_SHOW_CARD_REFUND_ALERT = false;

function shouldShowRapaGoCardCancelRefundButton(
  ride: RideRequestData,
  effectiveStatus?: string | null,
): boolean {
  const status = String(effectiveStatus ?? getEffectivePassengerRideStatus(ride)).toLowerCase();
  if (status !== "cancelled") return false;

  const record = ride as RideRequestData & Record<string, unknown>;

  if (!isPassengerCancellationCardPaymentForRefundAction(record)) return false;

  const provider = [
    record.paymentProvider,
    record.paymentMethod,
    record.notes,
  ]
    .map((value) => String(value ?? "").toLowerCase())
    .join(" ");

  // Klap retiene y el backend libera o captura la multa solo. No mostrar un
  // diálogo de "devolución" como si el cobro ya hubiera sido definitivo.
  if (provider.includes("klap")) return false;

  return (
    Boolean(record.cardRefundRequested) ||
    Boolean(record.mercadoPagoRefundRequested) ||
    Boolean(record.mercadoPagoRefundStatus)
  );
}

function PassengerCashPaymentAfterRideCard({
  ride,
  displayFareClp,
}: {
  ride: RideRequestData;
  displayFareClp: number;
}): JSX.Element | null {
  const { session } = useAuth();
  const [showOverpaidForm, setShowOverpaidForm] = useState(false);
  const [paidAmountText, setPaidAmountText] = useState("");
  const [submittingBenefit, setSubmittingBenefit] = useState(false);
  const [submittingRefund, setSubmittingRefund] = useState(false);
  const [benefitError, setBenefitError] = useState<string | null>(null);
  const [review, setReview] = useState<PassengerCashPaymentReview | null>(() =>
    getPassengerCashPaymentReview(ride),
  );

  useEffect(() => {
    setReview(getPassengerCashPaymentReview(ride));
    setShowOverpaidForm(false);
    setPaidAmountText("");
    setSubmittingBenefit(false);
    setSubmittingRefund(false);
    setBenefitError(null);
  }, [ride.id]);

  if (getEffectivePassengerRideStatus(ride) !== "completed") return null;
  if (!isPassengerCashPaymentRide(ride)) return null;
  if (!Number.isFinite(displayFareClp) || displayFareClp <= 0) return null;

  const paidAmountClp = sanitizePassengerMoneyInput(paidAmountText);
  const overpaidClp = Math.max(0, paidAmountClp - displayFareClp);
  const canConfirmOverpay = paidAmountClp > displayFareClp && overpaidClp > 0;

  function markPaidExact(): void {
    const saved = savePassengerCashPaymentReview(ride, {
      fareClp: displayFareClp,
      paidClp: displayFareClp,
      overpaidClp: 0,
      decision: "exact",
      status: "completed",
      adminReviewStatus: "not_required",
    });

    setReview(saved);
    setShowOverpaidForm(false);
    setPaidAmountText("");
  }

  async function saveAsWalletCredit(): Promise<void> {
    if (!canConfirmOverpay || submittingBenefit) return;

    if (!session?.accessToken) {
      setBenefitError("Tu sesión terminó. Vuelve a iniciar sesión para solicitar el Beneficio.");
      return;
    }

    setSubmittingBenefit(true);
    setBenefitError(null);

    try {
      const benefit = await walletService.requestCashOverpaymentBenefit(
        session.accessToken,
        {
          rideId: ride.id,
          paidClp: paidAmountClp,
          reason: "El usuario solicita conservar como Beneficio el dinero pagado de más en efectivo.",
        },
      );

      const saved = savePassengerCashPaymentReview(ride, {
        fareClp: benefit.fareClp,
        paidClp: benefit.paidClp,
        overpaidClp: benefit.requestedAmountClp,
        decision: "wallet_credit",
        status:
          benefit.status === "approved"
            ? "wallet_available"
            : "pending_wallet_admin",
        adminReviewStatus:
          benefit.status === "approved"
            ? "admin_approved"
            : "pending_admin",
      });

      // LocalStorage conserva solo una copia visual para compatibilidad. La
      // solicitud y el monto financiero real ya fueron creados por el backend.
      savePassengerWalletBenefitFromCashOverpayment(ride, saved);
      setReview(saved);
      setShowOverpaidForm(false);
      setPaidAmountText("");

      window.dispatchEvent(
        new CustomEvent(RAPAGO_WALLET_BENEFIT_EVENT, {
          detail: { benefit, ride },
        }),
      );
    } catch (err) {
      setBenefitError(
        err instanceof Error
          ? err.message
          : "No se pudo enviar la solicitud de Beneficio.",
      );
    } finally {
      setSubmittingBenefit(false);
    }
  }

  async function requestRefund(): Promise<void> {
    if (!canConfirmOverpay || submittingRefund) return;

    if (!session?.accessToken) {
      setBenefitError(
        "Tu sesión terminó. Vuelve a iniciar sesión para solicitar la devolución.",
      );
      return;
    }

    setSubmittingRefund(true);
    setBenefitError(null);

    try {
      const refund = await cashRefundsService.request(
        session.accessToken,
        {
          rideId: ride.id,
          paidClp: paidAmountClp,
          reason:
            "El usuario solicita devolución bancaria del dinero pagado de más en efectivo.",
        },
      );

      const saved = savePassengerCashPaymentReview(ride, {
        fareClp: refund.fareClp,
        paidClp: refund.paidClp,
        overpaidClp: refund.requestedAmountClp,
        decision: "bank_refund",
        status: "pending_refund",
        adminReviewStatus:
          refund.status === "completed"
            ? "refund_completed"
            : "refund_requested",
      });

      setReview(saved);
      setShowOverpaidForm(false);
      setPaidAmountText("");
    } catch (err) {
      setBenefitError(
        err instanceof Error
          ? err.message
          : "No se pudo solicitar la devolución bancaria.",
      );
    } finally {
      setSubmittingRefund(false);
    }
  }

  if (review) {
    const isWallet = review.decision === "wallet_credit";
    const isRefund =
      review.decision === "bank_refund" ||
      review.decision === "refund_whatsapp";

    return (
      <div
        style={{
          marginTop: 12,
          borderRadius: 20,
          padding: "13px 14px",
          /* Antes background/color iban en hex fijo (#fff7db/#5f3f00,
             #ecfdf3/#14532d): en modo noche esta tarjeta se quedaba clara
             y desentonaba de golpe con el resto de la lista oscura. Se pasa
             a los tokens semánticos warn/ok, que ya tienen contraparte de
             noche y de día calculada. */
          background: isRefund ? "var(--rp-warn-bg)" : "var(--rp-ok-bg)",
          border: isRefund ? "1px solid var(--rp-warn-bd)" : "1px solid var(--rp-ok-bd)",
          color: isRefund ? "var(--rp-warn-fg)" : "var(--rp-ok-fg)",
          boxShadow: "0 8px 22px rgba(0,0,0,.08)",
        }}
      >
        <div style={{ fontWeight: 950, fontSize: ".9rem", display: "flex", alignItems: "center", gap: 7 }}>
          {review.decision === "exact" && (
            <>
              <IonIcon icon={checkmarkCircle} aria-hidden="true" style={{ fontSize: "1.1rem", flexShrink: 0 }} />
              Pago en efectivo confirmado
            </>
          )}
          {isWallet && (
            <>
              <IonIcon icon={walletOutline} aria-hidden="true" style={{ fontSize: "1.1rem", flexShrink: 0 }} />
              Saldo para próximo viaje enviado a revisión
            </>
          )}
          {isRefund && (
            <>
              <IonIcon icon={businessOutline} aria-hidden="true" style={{ fontSize: "1.1rem", flexShrink: 0 }} />
              Devolución bancaria enviada a revisión
            </>
          )}
        </div>

        <div style={{ marginTop: 5, fontSize: ".78rem", lineHeight: 1.35, fontWeight: 800 }}>
          {review.decision === "exact" && "Registramos que pagaste el monto justo de tu viaje."}
          {isWallet && (
            <>
              Tienes <strong>{formatClp(review.overpaidClp)}</strong> como saldo a favor pendiente de aprobación del administrador. Cuando se apruebe, aparecerá en tu billetera y en tu próximo viaje te descontamos ese monto.
            </>
          )}
          {isRefund && (
            <>
              La devolución por <strong>{formatClp(review.overpaidClp)}</strong> quedó registrada en el backend y pendiente de revisión administrativa. El depósito se realizará en la cuenta bancaria registrada en tu Perfil.
            </>
          )}
        </div>

        {review.decision === "refund_whatsapp" && (
          <IonButton
            size="small"
            color="warning"
            style={{ "--border-radius": "999px", marginTop: 8, fontWeight: 950 } as React.CSSProperties}
            onClick={() => openPassengerRefundWhatsApp(ride, review)}
          >
            Abrir WhatsApp de devolución anterior
          </IonButton>
        )}
      </div>
    );
  }

  return (
    /* global.css:3170 fuerza `color:#111111 !important` en TODO descendiente
       de un ion-card, y este bloque vive dentro del recibo del viaje. Con el
       fondo oscuro fijo que tenía antes, el título y el detalle quedaban negro
       sobre negro: ilegible en modo día Y en modo noche. La clase
       `rapago-trip-theme-panel` lo saca de esa regla —el mismo recurso que ya
       usan los paneles hermanos de esta página— y el fondo pasa a tokens para
       que siga el tema en vez de ser siempre oscuro. */
    <div
      className="rapago-trip-theme-panel"
      style={{
        marginTop: 12,
        borderRadius: 22,
        padding: "14px",
        /* Opaco a propósito, no var(--rp-warn-bg): ese token es un tinte al
           13% y la tarjeta que hay detrás la pinta global.css de color crema
           fijo, así que en modo noche el marfil de var(--rp-text) habría
           quedado sobre crema. var(--rp-surface) trae su propio fondo del
           tema —igual que el recibo hermano— y el borde cálido conserva el
           carácter de aviso. */
        background: "var(--rp-surface)",
        color: "var(--rp-text)",
        border: "1px solid var(--rp-warn-bd)",
        boxShadow: "var(--rp-shadow)",
      }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <IonIcon icon={cashOutline} aria-hidden="true" style={{ fontSize: "1.35rem", flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 950, fontSize: ".95rem" }}>
            ¿Pagaste de más en efectivo?
          </div>
          <div className="rp-tone-muted" style={{ marginTop: 4, color: "var(--rp-muted)", fontSize: ".78rem", lineHeight: 1.35, fontWeight: 800 }}>
            Precio del viaje: <strong>{formatClp(displayFareClp)}</strong>. Si pagaste de más, te diremos cuánto es la diferencia.
          </div>
        </div>
      </div>

      {!showOverpaidForm && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
          {/* color="success"/"warning" de Ionic son fijos: no siguen
              data-rapago-theme, así que en modo día quedaban con el mismo tono
              que en noche. Se pasan a tokens --rp-*. `rp-tone-*` es necesario
              porque el panel fuerza color:var(--rp-text) !important sobre todo
              descendiente (sections.css:269) y taparía el color del botón. */}
          <IonButton
            size="small"
            fill="outline"
            className="rp-tone-ok"
            style={{
              "--border-radius": "999px",
              "--background": "var(--rp-surface)",
              "--color": "var(--rp-ok-fg)",
              "--border-color": "var(--rp-ok-bd)",
              "--border-width": "1.5px",
              fontWeight: 950,
            } as React.CSSProperties}
            onClick={markPaidExact}
          >
            No, pagué justo
          </IonButton>
          <IonButton
            size="small"
            className="rp-tone-btn-primary-fg"
            style={{
              "--border-radius": "999px",
              "--background": "var(--rp-btn-primary)",
              "--color": "var(--rp-btn-primary-fg)",
              fontWeight: 950,
            } as React.CSSProperties}
            onClick={() => setShowOverpaidForm(true)}
          >
            Sí, pagué de más
          </IonButton>
        </div>
      )}

      {showOverpaidForm && (
        <div style={{ marginTop: 12 }}>
          <IonItem
            lines="none"
            style={{
              "--background": "var(--rp-surface)",
              "--border-radius": "16px",
              "--padding-start": "12px",
              "--inner-padding-end": "12px",
              borderRadius: 16,
              overflow: "hidden",
              marginBottom: 8,
            } as React.CSSProperties}
          >
            <IonInput
              type="number"
              inputmode="numeric"
              min="0"
              value={paidAmountText}
              placeholder="Ej: 10000"
              label="¿Cuánto pagaste en total?"
              labelPlacement="stacked"
              onIonInput={(event) => setPaidAmountText(String(event.detail.value ?? ""))}
            />
          </IonItem>

          <div style={{ color: "var(--rp-muted)", fontSize: ".76rem", lineHeight: 1.35, fontWeight: 800 }}>
            {canConfirmOverpay ? (
              <>
                Has pagado de más: <strong>{formatClp(overpaidClp)}</strong>. ¿Quieres usar ese dinero como saldo a favor o solicitar una devolución a tu cuenta bancaria registrada?
              </>
            ) : (
              <>
                Ingresa un monto mayor a <strong>{formatClp(displayFareClp)}</strong> para calcular el saldo a favor.
              </>
            )}
          </div>

          {benefitError && (
            <div
              style={{
                marginTop: 10,
                borderRadius: 14,
                padding: "9px 11px",
                background: "var(--rp-err-bg)",
                color: "var(--rp-err-fg)",
                fontWeight: 850,
                fontSize: ".78rem",
                lineHeight: 1.35,
              }}
            >
              {benefitError}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8, marginTop: 10 }}>
            <IonButton
              size="small"
              color="success"
              disabled={!canConfirmOverpay || submittingBenefit}
              style={{ "--border-radius": "999px", fontWeight: 950 } as React.CSSProperties}
              onClick={() => void saveAsWalletCredit()}
            >
              {submittingBenefit ? "Enviando al administrador…" : "Sí, guardar como Beneficio"}
            </IonButton>

            <IonButton
              size="small"
              color="warning"
              disabled={!canConfirmOverpay || submittingRefund}
              style={{ "--border-radius": "999px", fontWeight: 950 } as React.CSSProperties}
              onClick={() => void requestRefund()}
            >
              {submittingRefund
                ? "Enviando devolución…"
                : "Solicitar devolución bancaria"}
            </IonButton>

            <IonButton
              size="small"
              fill="clear"
              color="medium"
              style={{ "--border-radius": "999px", fontWeight: 900 } as React.CSSProperties}
              onClick={() => {
                setShowOverpaidForm(false);
                setPaidAmountText("");
              }}
            >
              Volver
            </IonButton>
          </div>
        </div>
      )}
    </div>
  );
}


type PendingPassengerCancelAction = {
  rideId: string;
  mode: "requested" | "accepted";
  ride: RideRequestData;
  policy: PassengerCancellationPolicy;
};


type RapagoTripSafetyReportStatus = "arrived_well" | "problem_reported" | "driver_accident_reported";

type RapagoTripSafetyReport = {
  id: string;
  rideId: string;
  rideKey: string;
  reporterRole: "passenger" | "driver";
  status: RapagoTripSafetyReportStatus;
  title: string;
  description: string;
  passengerEmail?: string | null;
  passengerName?: string | null;
  driverEmail?: string | null;
  driverName?: string | null;
  originText?: string | null;
  destinationText?: string | null;
  createdAt: string;
  updatedAt: string;
  source: "passenger_trips" | "driver_app";
  whatsappOpened?: boolean;
  adminStatus?: "pending_admin" | "resolved" | "not_required";
};

const RAPAGO_TRIP_SAFETY_REPORTS_KEY = "rapago_trip_safety_reports_v1";
const RAPAGO_TRIP_SAFETY_REPORT_EVENT = "rapago:trip-safety-reports-updated";

function sanitizeTripSafetyText(value: unknown, maxLength = 220): string {
  return String(value ?? "")
    .replace(/[<>`{}$\\]/g, "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function getTripSafetyRideKey(ride: Partial<RideRequestData> & Record<string, unknown>): string {
  const id = String(ride.id ?? ride.rideId ?? ride.originalRideId ?? ride.serverRideId ?? "").trim();
  if (id) return `ride:${id}`;

  return [
    String(ride.passengerEmail ?? ride.email ?? "").trim().toLowerCase(),
    String(ride.originText ?? "").trim().toLowerCase(),
    String(ride.destinationText ?? "").trim().toLowerCase(),
    String(ride.completedAt ?? ride.requestedAt ?? ride.createdAt ?? "").trim(),
  ].filter(Boolean).join("|") || `local:${Date.now()}`;
}

function getTripSafetyUserKey(user: unknown, ride?: Partial<RideRequestData> & Record<string, unknown>): string {
  const record = user && typeof user === "object" ? (user as Record<string, unknown>) : {};
  const email = String(record.email ?? ride?.passengerEmail ?? ride?.email ?? "").trim().toLowerCase();
  if (email) return `email:${email}`;

  const id = String(record.id ?? ride?.passengerId ?? ride?.userId ?? "").trim();
  if (id) return `id:${id}`;

  return "passenger:local";
}

function readRapagoTripSafetyReports(): RapagoTripSafetyReport[] {
  try {
    const raw = localStorage.getItem(RAPAGO_TRIP_SAFETY_REPORTS_KEY);
    const parsed = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item) => item && typeof item === "object")
      .map((item, index): RapagoTripSafetyReport => ({
        id: sanitizeTripSafetyText(item.id, 120) || `trip-safety-${index}`,
        rideId: sanitizeTripSafetyText(item.rideId, 120),
        rideKey: sanitizeTripSafetyText(item.rideKey, 180),
        reporterRole: String(item.reporterRole ?? "passenger") === "driver" ? "driver" : "passenger",
        status: String(item.status ?? "problem_reported") as RapagoTripSafetyReportStatus,
        title: sanitizeTripSafetyText(item.title, 120) || "Reporte de viaje",
        description: sanitizeTripSafetyText(item.description, 260) || "Reporte registrado en la app.",
        passengerEmail: sanitizeTripSafetyText(item.passengerEmail, 160).toLowerCase() || null,
        passengerName: sanitizeTripSafetyText(item.passengerName, 120) || null,
        driverEmail: sanitizeTripSafetyText(item.driverEmail, 160).toLowerCase() || null,
        driverName: sanitizeTripSafetyText(item.driverName, 120) || null,
        originText: sanitizeTripSafetyText(item.originText, 160) || null,
        destinationText: sanitizeTripSafetyText(item.destinationText, 160) || null,
        createdAt: sanitizeTripSafetyText(item.createdAt, 60) || new Date().toISOString(),
        updatedAt: sanitizeTripSafetyText(item.updatedAt, 60) || new Date().toISOString(),
        source: String(item.source ?? "passenger_trips") === "driver_app" ? "driver_app" : "passenger_trips",
        whatsappOpened: Boolean(item.whatsappOpened),
        adminStatus: String(item.adminStatus ?? "pending_admin") as RapagoTripSafetyReport["adminStatus"],
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch {
    return [];
  }
}

function writeRapagoTripSafetyReports(reports: RapagoTripSafetyReport[]): void {
  try {
    localStorage.setItem(RAPAGO_TRIP_SAFETY_REPORTS_KEY, JSON.stringify(reports.slice(0, 300)));
    window.dispatchEvent(new CustomEvent(RAPAGO_TRIP_SAFETY_REPORT_EVENT, { detail: { reports } }));
    window.dispatchEvent(new CustomEvent("rapago:admin-rides-updated", { detail: { tripSafetyReports: reports } }));
  } catch {
    // No bloquea Mis Viajes.
  }
}

function savePassengerTripSafetyReport(
  ride: RideRequestData,
  user: unknown,
  status: "arrived_well" | "problem_reported",
): RapagoTripSafetyReport {
  const record = ride as RideRequestData & Record<string, unknown>;
  const rideKey = getTripSafetyRideKey(record);
  const userRecord = user && typeof user === "object" ? (user as Record<string, unknown>) : {};
  const now = new Date().toISOString();
  const passengerEmail = sanitizeTripSafetyText(userRecord.email ?? record.passengerEmail ?? record.email, 160).toLowerCase() || null;
  const passengerName = sanitizeTripSafetyText(userRecord.name ?? record.passengerName ?? record.userName, 120) || null;
  const driverName = sanitizeTripSafetyText(record.driverName ?? record.driverFullName, 120) || null;

  const nextReport: RapagoTripSafetyReport = {
    id: `trip-safety-${rideKey}-${passengerEmail || "local"}`,
    rideId: sanitizeTripSafetyText(record.id ?? record.rideId ?? record.originalRideId ?? rideKey, 120),
    rideKey,
    reporterRole: "passenger",
    status,
    title: status === "arrived_well" ? "Pasajero llegó bien" : "Pasajero reportó problema",
    description:
      status === "arrived_well"
        ? "El pasajero confirmó desde Mis Viajes que llegó bien a destino."
        : "El pasajero marcó Llegué mal / Reportar problema y fue derivado a WhatsApp soporte.",
    passengerEmail,
    passengerName,
    driverEmail: sanitizeTripSafetyText(record.driverEmail, 160).toLowerCase() || null,
    driverName,
    originText: sanitizeTripSafetyText(record.originText, 160) || null,
    destinationText: sanitizeTripSafetyText(record.destinationText, 160) || null,
    createdAt: now,
    updatedAt: now,
    source: "passenger_trips",
    whatsappOpened: status === "problem_reported",
    adminStatus: status === "arrived_well" ? "not_required" : "pending_admin",
  };

  const current = readRapagoTripSafetyReports();
  const next = [
    nextReport,
    ...current.filter((item) => !(item.rideKey === rideKey && item.reporterRole === "passenger" && item.passengerEmail === passengerEmail)),
  ];

  writeRapagoTripSafetyReports(next);
  return nextReport;
}

function buildPassengerTripProblemWhatsAppUrl(ride: RideRequestData, user: unknown): string {
  const record = ride as RideRequestData & Record<string, unknown>;
  const userRecord = user && typeof user === "object" ? (user as Record<string, unknown>) : {};
  const lines = [
    "Soporte RAPA GO: pasajero reporta problema al finalizar viaje.",
    `Pasajero: ${sanitizeTripSafetyText(userRecord.name ?? record.passengerName ?? "Pasajero", 80)}`,
    `Correo: ${sanitizeTripSafetyText(userRecord.email ?? record.passengerEmail ?? record.email ?? "No informado", 120)}`,
    `Viaje: ${sanitizeTripSafetyText(record.originText, 90) || "Origen"} -> ${sanitizeTripSafetyText(record.destinationText, 90) || "Destino"}`,
    record.driverName || record.driverFullName ? `Conductor: ${sanitizeTripSafetyText(record.driverName ?? record.driverFullName, 90)}` : null,
    "Motivo: Llegué mal / necesito reportar un problema.",
    "Revisar registro en panel Admin RAPA GO.",
  ].filter(Boolean);

  return `https://wa.me/${RAPAGO_SUPPORT_WHATSAPP_PHONE}?text=${encodeURIComponent(lines.join("\n"))}`;
}

function openPassengerTripProblemWhatsApp(ride: RideRequestData, user: unknown): void {
  const url = buildPassengerTripProblemWhatsAppUrl(ride, user);
  try {
    window.open(url, "_blank", "noopener,noreferrer");
  } catch {
    window.location.href = url;
  }
}


function savePassengerEmergencyTripSafetyReport(
  ride: RideRequestData,
  user: unknown,
): RapagoTripSafetyReport {
  const record = ride as RideRequestData & Record<string, unknown>;
  const rideKey = getTripSafetyRideKey(record);
  const userRecord = user && typeof user === "object" ? (user as Record<string, unknown>) : {};
  const now = new Date().toISOString();
  const passengerEmail = sanitizeTripSafetyText(userRecord.email ?? record.passengerEmail ?? record.email, 160).toLowerCase() || null;
  const passengerName = sanitizeTripSafetyText(userRecord.name ?? record.passengerName ?? record.userName, 120) || null;

  const nextReport: RapagoTripSafetyReport = {
    id: `trip-emergency-${rideKey}-${passengerEmail || "local"}`,
    rideId: sanitizeTripSafetyText(record.id ?? record.rideId ?? record.originalRideId ?? rideKey, 120),
    rideKey,
    reporterRole: "passenger",
    status: "problem_reported",
    title: "Emergencia pasajero durante viaje",
    description: "El pasajero presionó Emergencia durante el viaje y fue derivado inmediatamente a WhatsApp soporte RAPA GO.",
    passengerEmail,
    passengerName,
    driverEmail: sanitizeTripSafetyText(record.driverEmail, 160).toLowerCase() || null,
    driverName: sanitizeTripSafetyText(record.driverName ?? record.driverFullName, 120) || null,
    originText: sanitizeTripSafetyText(record.originText, 160) || null,
    destinationText: sanitizeTripSafetyText(record.destinationText, 160) || null,
    createdAt: now,
    updatedAt: now,
    source: "passenger_trips",
    whatsappOpened: true,
    adminStatus: "pending_admin",
  };

  const current = readRapagoTripSafetyReports();
  const next = [
    nextReport,
    ...current.filter((item) => !(item.id === nextReport.id || (item.rideKey === rideKey && item.title === nextReport.title && item.passengerEmail === passengerEmail))),
  ];

  writeRapagoTripSafetyReports(next);
  return nextReport;
}

function buildPassengerEmergencyWhatsAppUrl(ride: RideRequestData, user: unknown): string {
  const record = ride as RideRequestData & Record<string, unknown>;
  const userRecord = user && typeof user === "object" ? (user as Record<string, unknown>) : {};
  const lines = [
    "EMERGENCIA RAPA GO: pasajero necesita ayuda inmediata durante un viaje.",
    `Pasajero: ${sanitizeTripSafetyText(userRecord.name ?? record.passengerName ?? "Pasajero", 80)}`,
    `Correo: ${sanitizeTripSafetyText(userRecord.email ?? record.passengerEmail ?? record.email ?? "No informado", 120)}`,
    `Viaje: ${sanitizeTripSafetyText(record.originText, 90) || "Origen"} -> ${sanitizeTripSafetyText(record.destinationText, 90) || "Destino"}`,
    record.driverName || record.driverFullName ? `Conductor: ${sanitizeTripSafetyText(record.driverName ?? record.driverFullName, 90)}` : null,
    record.driverPhone ? `Teléfono conductor: ${sanitizeTripSafetyText(record.driverPhone, 40)}` : null,
    `Estado viaje: ${sanitizeTripSafetyText(record.status ?? "activo", 60)}`,
    "Acción: necesito contacto inmediato de soporte RAPA GO.",
    "Este aviso quedó registrado en el panel Admin.",
  ].filter(Boolean);

  return `https://wa.me/${RAPAGO_SUPPORT_WHATSAPP_PHONE}?text=${encodeURIComponent(lines.join("\n"))}`;
}

function openPassengerEmergencyWhatsApp(ride: RideRequestData, user: unknown): void {
  savePassengerEmergencyTripSafetyReport(ride, user);

  const url = buildPassengerEmergencyWhatsAppUrl(ride, user);
  try {
    window.open(url, "_blank", "noopener,noreferrer");
  } catch {
    window.location.href = url;
  }
}

function buildPassengerCancellationAlertMessage(
  policy: PassengerCancellationPolicy,
  ride?: RideRequestData | null,
): string {
  const isCardPayment = ride
    ? isPassengerCancellationCardPaymentForRefundAction(ride as RideRequestData & Record<string, unknown>)
    : false;

  const paymentNotice = isCardPayment
    ? " La devolución de tarjeta será procesada únicamente por backend/admin y el proveedor original."
    : "";

  if (policy.candidateFeeClp <= 0) {
    return `${policy.message} Selecciona el motivo y confirma la cancelación.${paymentNotice}`;
  }

  return `${policy.message} ${policy.detail} Selecciona el motivo. Si corresponde a discrepancia de conductor/vehículo, seguridad, duplicidad de la Plataforma o causa imputable al Operador/conductor, el cargo quedará suspendido para revisión del administrador.${paymentNotice}`;
}

function PassengerRideCard({
  ride,
  token,
  cancelling,
  rated,
  onCancel,
  onCancelAccepted,
  onRate,
  safetyReportStatus,
  onArrivedWell,
  onReportProblem,
  onEmergency,
}: {
  ride: RideRequestData;
  token: string;
  cancelling: boolean;
  rated: boolean;
  safetyReportStatus: RapagoTripSafetyReportStatus | null;
  onCancel: (rideId: string) => void;
  onCancelAccepted: (rideId: string) => void;
  onRate: (rideId: string) => void;
  onArrivedWell: (ride: RideRequestData) => void;
  onReportProblem: (ride: RideRequestData) => void;
  onEmergency: (ride: RideRequestData) => void;
}): JSX.Element {
  const nav = extractPassengerRideNav(ride.notes);
  const effectiveStatus = getEffectivePassengerRideStatus(ride);
  const driverRequeueMirror = findPassengerDriverCancelledRequeueMirror(ride as RideRequestData & Record<string, unknown>);
  const isDriverRequeuedSearch =
    isDriverCancelledRequeuedRide(ride as RideRequestData & Record<string, unknown>) ||
    Boolean(
      driverRequeueMirror &&
        !passengerAcceptedDriverIsNewerThanRequeue(
          ride as RideRequestData & Record<string, unknown>,
          driverRequeueMirror,
        ),
    );
  const hasDriver = !["pending_payment", "requested", "scheduled"].includes(effectiveStatus) || (!!ride.driverName && !isDriverRequeuedSearch);
  const navHasMapPoints =
    (nav.pickupLat != null && nav.pickupLng != null) ||
    (nav.destinationLat != null && nav.destinationLng != null) ||
    getDriverPointForPassengerMap(ride, null) !== null;
  const passengerCanTrackDriver = ["driver_scheduled", "accepted", "driver_en_route", "driver_arrived", "in_progress"].includes(effectiveStatus);

  // En viajes activos se mantiene el mapa en vivo. En estados finales se muestra
  // la ruta GPS histórica realmente registrada por el conductor.
  const showLiveMap = passengerCanTrackDriver && (hasDriver || navHasMapPoints || effectiveStatus === "driver_scheduled");
  const showHistoricalMap = ["completed", "cancelled"].includes(effectiveStatus);
  const showMap = showLiveMap || showHistoricalMap;
  const label = isPassengerNoShowCompletedRide(ride)
    ? "No show"
    : getPassengerRideStatusLabel(effectiveStatus);
  const displayFareClp = getRideDisplayFareClp(ride);
  const paymentLabel = getRidePaymentMethodLabel(ride);
  const ridePassengerFareType = getRidePassengerFareType(ride);
  const fareBreakdown = extractRideFareBreakdown(ride.notes);
  const scheduleInfo = getPassengerRideScheduleInfo(ride as RideRequestData & Record<string, unknown>);
  const isScheduledPending = scheduleInfo.isScheduled && effectiveStatus === "scheduled" && !isDriverRequeuedSearch;
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [fastSearchBusy, setFastSearchBusy] = useState(false);
  const [fastSearchActionError, setFastSearchActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!ACTIVE_STATUSES.includes(effectiveStatus)) return;

    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, [effectiveStatus, ride.id]);

  useEffect(() => {
    if (passengerStatusStartsAcceptedTimer(effectiveStatus)) {
      ensurePassengerDriverAcceptedTimerStartMs(ride as RideRequestData & Record<string, unknown>);
    }
  }, [effectiveStatus, ride.id]);

  useEffect(() => {
    if (effectiveStatus !== "driver_arrived") return;

    ensurePassengerDriverArrivedTimerStartMs(ride as RideRequestData & Record<string, unknown>);
    addPassengerDriverArrivedNotification(ride);
  }, [effectiveStatus, ride.id]);

  const passengerDriverAcceptedState = passengerStatusStartsAcceptedTimer(effectiveStatus)
    ? getPassengerDriverAcceptedCountdownState(ride as RideRequestData & Record<string, unknown>, nowMs)
    : null;
  const passengerDriverArrivedState =
    effectiveStatus === "driver_arrived"
      ? getPassengerDriverArrivedCountdownState(ride as RideRequestData & Record<string, unknown>, nowMs)
      : null;
  const passengerNoShowNotice = getLatestPassengerNoShowNotificationForRide(ride);

  const searchStartedAtMs = getPassengerRideStartedAtMs(
    (isDriverRequeuedSearch && driverRequeueMirror
      ? buildPassengerSearchingAfterDriverCancelRide({
          ...(ride as RideRequestData & Record<string, unknown>),
          ...driverRequeueMirror,
        })
      : ride) as RideRequestData & Record<string, unknown>,
  );
  const searchingElapsedMs = searchStartedAtMs == null ? 0 : Math.max(0, nowMs - searchStartedAtMs);
  const searchingElapsedLabel = formatPassengerElapsedTime(searchingElapsedMs);
  const fastSearchRecord = getPassengerFastSearchRecord(ride as RideRequestData & Record<string, unknown>);
  const fastSearchFeeClp = getPassengerFastSearchFeeClp(ride as RideRequestData & Record<string, unknown>);
  const showFastSearchPrompt = shouldShowPassengerFastSearchPrompt(ride as RideRequestData & Record<string, unknown>, nowMs);
  const fastSearchUsesMercadoPago = paymentLabel.includes("Mercado Pago");
  const fastSearchUsesKlap = paymentLabel.includes("Klap");
  const cancellationPolicy = getPassengerCancellationPolicyForRide(ride);
  const passengerCancelledChargeClp = Math.max(
    0,
    Math.round(Number((ride as RideRequestData & Record<string, unknown>).passengerCancellationFeeClp ?? (ride as RideRequestData & Record<string, unknown>).paymentPendingClp ?? 0)),
  );
  const passengerCancelledPolicyText = String((ride as RideRequestData & Record<string, unknown>).passengerCancellationPolicyText ?? "").trim();
  const passengerCancelledCardRefundNotice = String((ride as RideRequestData & Record<string, unknown>).cardRefundNotice ?? "").trim();
  const cancelledRideRecord = ride as RideRequestData & Record<string, unknown>;
  const isCancelledCardPayment = isPassengerCancellationCardPaymentForRefundAction(cancelledRideRecord);
  const passengerCancellationRequiresAdminReview = Boolean(
    cancelledRideRecord.passengerCancellationRequiresAdminReview,
  );

  return (
    <IonCard
      aria-label={`Viaje ${label} de ${ride.originText} a ${ride.destinationText}`}
      style={{
        margin: 0,
        borderRadius: "22px",
        overflow: "hidden",
        background: "var(--rp-surface)",
        border: "2px solid rgba(210,164,58,.65)",
        boxShadow: "0 12px 32px rgba(0,0,0,.16)",
      }}
    >
      <IonCardContent style={{ padding: 0 }}>
        <div style={{ position: "relative", background: "#111827" }}>
          {showHistoricalMap ? (
            <PassengerHistoricalRouteMap ride={ride} token={token} height={300} />
          ) : showLiveMap ? (
            <PassengerLiveRouteMap ride={ride} token={token} height={330} />
          ) : null}

        </div>

        <div style={{ padding: showMap ? "16px" : "12px 16px", color: "var(--rp-text)" }}>
          {showHistoricalMap && (
            <PassengerFinalRideSummary ride={ride} effectiveStatus={effectiveStatus} />
          )}

          {effectiveStatus === "pending_payment" && (
            <div
              style={{
                marginBottom: 12,
                background: "var(--rp-warn-bg)",
                borderRadius: 18,
                padding: "12px",
                border: "1px solid rgba(210,164,58,.62)",
                color: "var(--rp-warn-fg)",
                fontWeight: 900,
                lineHeight: 1.35,
              }}
            >
              <IonIcon icon={hourglassOutline} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: 4 }} />
              <strong>En espera de aprobación del pago.</strong>
              <br />El proveedor de tarjeta está verificando el cobro. Apenas lo apruebe, RAPA GO enviará automáticamente la solicitud a los conductores disponibles.
            </div>
          )}

          {isDriverRequeuedSearch && (
            <div
              style={{
                marginBottom: 12,
                background: "var(--rp-err-bg)",
                borderRadius: 18,
                padding: "12px",
                border: "1px solid rgba(220,38,38,.32)",
                color: "var(--rp-err-fg)",
                fontWeight: 900,
                lineHeight: 1.35,
              }}
            >
              <IonIcon icon={warningOutline} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: 4 }} />
              Tu conductor canceló el viaje. Estamos buscando un nuevo conductor disponible.
              <br />Tiempo buscando nuevamente: <strong>{searchingElapsedLabel}</strong>
            </div>
          )}

          {effectiveStatus === "driver_arrived" && passengerDriverArrivedState && (
            <div
              style={{
                marginBottom: 12,
                /* Antes background/color iban en hex fijo (#fff7db/#7c2d12,
                   #ecfdf5/#064e3b): en modo noche la tarjeta se quedaba clara
                   sobre una pantalla oscura, texto oscuro sobre fondo claro
                   se lee bien pero desentona del resto. Se pasa a los mismos
                   tokens warn/ok que usa el resto de avisos de esta tarjeta. */
                background: passengerDriverArrivedState.finished ? "var(--rp-warn-bg)" : "var(--rp-ok-bg)",
                borderRadius: 18,
                padding: "12px",
                border: passengerDriverArrivedState.finished
                  ? "1px solid var(--rp-warn-bd)"
                  : "1px solid var(--rp-ok-bd)",
                color: passengerDriverArrivedState.finished ? "var(--rp-warn-fg)" : "var(--rp-ok-fg)",
                fontWeight: 900,
                lineHeight: 1.35,
              }}
            >
              <IonIcon icon={carOutline} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: 4 }} />
              <strong>Tu conductor llegó.</strong>
              <br />
              Sal ahora al punto de recogida.
              <br />
              {passengerDriverArrivedState.finished ? (
                <>Tiempo cumplido. El conductor puede marcar <strong>No show</strong>.</>
              ) : (
                <>Tiempo para presentarte: <strong>{formatPassengerElapsedTime(passengerDriverArrivedState.remainingMs)}</strong>.</>
              )}
            </div>
          )}

          {passengerNoShowNotice && passengerNoShowNotice.type === "no_show_warning" && effectiveStatus !== "cancelled" && (
            <div
              style={{
                marginBottom: 12,
                background: "var(--rp-err-bg)",
                borderRadius: 18,
                padding: "12px",
                border: "1px solid rgba(220,38,38,.30)",
                color: "var(--rp-err-fg)",
                fontWeight: 900,
                lineHeight: 1.35,
              }}
            >
              <IonIcon icon={warningOutline} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: 4 }} />
              <strong>{passengerNoShowNotice.title}</strong>
              <br />
              {passengerNoShowNotice.body}
            </div>
          )}

          {effectiveStatus === "cancelled" && passengerCancelledChargeClp > 0 && (
            <div
              style={{
                marginBottom: 12,
                background: "var(--rp-warn-bg)",
                borderRadius: 18,
                padding: "12px",
                border: "1px solid rgba(210,164,58,.62)",
                color: "var(--rp-warn-fg)",
                fontWeight: 900,
                lineHeight: 1.35,
              }}
            >
              {isCancelledCardPayment && !passengerCancellationRequiresAdminReview ? (
                <>
                  <IonIcon icon={cardOutline} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: 4 }} />
                  Cargo por cancelación: <strong>{formatClp(passengerCancelledChargeClp)}</strong>.
                  <br />El backend procesa automáticamente el monto aplicable con Klap. Este cargo no se vuelve a sumar al próximo viaje.
                  {passengerCancelledCardRefundNotice && (
                    <>
                      <br /><span style={{ fontSize: ".76rem" }}>{passengerCancelledCardRefundNotice}</span>
                    </>
                  )}
                </>
              ) : (
                <>
                  <IonIcon icon={warningOutline} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: 4 }} />
                  Revisión backend pendiente: <strong>{formatClp(passengerCancelledChargeClp)}</strong>.
                  <br />El backend/admin debe confirmar cualquier excepción o cargo no resuelto automáticamente.
                </>
              )}
              {passengerCancelledPolicyText && (
                <>
                  <br /><span style={{ fontSize: ".76rem" }}>{passengerCancelledPolicyText}</span>
                </>
              )}
            </div>
          )}

          {effectiveStatus === "cancelled" && isCancelledCardPayment && passengerCancelledChargeClp <= 0 && !passengerCancellationRequiresAdminReview && (
            <div
              style={{
                marginBottom: 12,
                background: "var(--rp-warn-bg)",
                borderRadius: 18,
                padding: "12px",
                border: "1px solid var(--rp-warn-bd)",
                color: "var(--rp-warn-fg)",
                fontWeight: 900,
                lineHeight: 1.35,
              }}
            >
              <IonIcon icon={cardOutline} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: 4 }} />
              <strong>Cancelación gratuita.</strong>
              <br />El backend libera automáticamente con Klap el 100% de la retención. No hubo cobro definitivo.
            </div>
          )}

          {effectiveStatus === "cancelled" && isCancelledCardPayment && passengerCancelledChargeClp <= 0 && passengerCancellationRequiresAdminReview && (
            <div
              style={{
                marginBottom: 12,
                background: "var(--rp-warn-bg)",
                borderRadius: 18,
                padding: "12px",
                border: "1px solid var(--rp-warn-bd)",
                color: "var(--rp-warn-fg)",
                fontWeight: 900,
                lineHeight: 1.35,
              }}
            >
              <IonIcon icon={warningOutline} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: 4 }} />
              <strong>Solicitud de exención en revisión.</strong>
              <br />El backend/admin revisará el motivo informado antes de resolver el cargo.
            </div>
          )}

          {["requested", "scheduled"].includes(effectiveStatus) && (
            isScheduledPending ? (
              <div
                className="rapago-trip-theme-panel"
                style={{
                  background: "var(--rp-warn-bg)",
                  borderRadius: 18,
                  padding: "12px",
                  border: "1px solid rgba(210,164,58,.55)",
                  boxShadow: "0 6px 18px rgba(0,0,0,.06)",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <IonIcon icon={calendarOutline} aria-hidden="true" className="rp-tone-warn" style={{ fontSize: "1.25rem", color: "var(--rp-warn-fg)", flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontWeight: 950, fontSize: ".92rem" }}>
                      {isRoundTripReturnPickupRide(ride as RideRequestData & Record<string, unknown>)
                        ? "Agendamiento de recogida creado"
                        : "Viaje agendado correctamente"}
                    </div>
                    <div className="rp-tone-warn" style={{ color: "var(--rp-warn-fg)", fontSize: ".78rem", marginTop: 3, lineHeight: 1.35 }}>
                      {isRoundTripReturnPickupRide(ride as RideRequestData & Record<string, unknown>)
                        ? "Tu recogida de regreso quedó agendada para "
                        : "Has agendado tu viaje para "}<strong>{formatPassengerScheduleDate(scheduleInfo.pickupAt)}</strong>.
                      <br />Se activará para gestión a las <strong>{formatPassengerScheduleDate(scheduleInfo.pickupActivationAt)}</strong>.
                      {scheduleInfo.isRoundTrip && scheduleInfo.returnAt && (
                        <>
                          <br />Regreso: <strong>{formatPassengerScheduleDate(scheduleInfo.returnAt)}</strong>.
                          <br />La vuelta se activará a las <strong>{formatPassengerScheduleDate(scheduleInfo.returnActivationAt)}</strong>.
                        </>
                      )}
                      <br />Aún no estamos buscando conductor. La reserva está congelada para conductores y el administrador la gestiona antes de la hora indicada.
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div
                style={{
                  background: "var(--rp-surface)",
                  borderRadius: 18,
                  padding: "12px",
                  border: "1px solid rgba(0,0,0,.06)",
                  boxShadow: "0 6px 18px rgba(0,0,0,.06)",
                }}
              >
                {/* Solo esta fila (y el aviso de abajo) se marcan como panel de
                    tema: el card dorado de "Búsqueda prioritaria" más abajo es
                    hermano dentro de este mismo contenedor y su superficie es
                    fija a propósito (ver su propio comentario) — envolver TODO
                    el contenedor le habría forzado el texto a var(--rp-text),
                    rompiendo su paleta oro/legacy fija. */}
                <div className="rapago-trip-theme-panel" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <IonSpinner name="crescent" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 950, fontSize: ".9rem" }}>Buscando conductor</div>
                    <div className="rp-tone-muted" style={{ color: "var(--rp-muted)", fontSize: ".78rem", marginTop: 2, lineHeight: 1.35 }}>
                      Tu solicitud ya fue enviada a conductores cercanos.
                      <br />Tiempo buscando: <strong>{searchingElapsedLabel}</strong>
                    </div>
                  </div>
                </div>

                {!showFastSearchPrompt && !fastSearchRecord && (
                  <div className="rapago-trip-theme-panel">
                    <div
                      className="rp-tone-warn"
                      style={{
                        marginTop: 12,
                        padding: "10px 12px",
                        borderRadius: 14,
                        background: "var(--rp-warn-bg)",
                        border: "1px solid var(--rp-warn-bd)",
                        color: "var(--rp-warn-fg)",
                        fontSize: ".76rem",
                        fontWeight: 900,
                        lineHeight: 1.4,
                        boxShadow: "0 4px 12px rgba(95,63,0,.08)",
                      }}
                    >
                      <IonIcon icon={flashOutline} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: 2 }} />
                      Si pasan 2 minutos sin conductor, podrás activar
                      <strong> RapaGo más veloz</strong> por
                      <strong> +{formatClp(RAPAGO_FAST_SEARCH_FEE_CLP)}</strong>.
                    </div>
                  </div>
                )}

                {showFastSearchPrompt && (
                  <div
                    className="rapago-fast-search-panel"
                    role="region"
                    aria-label="Activar RapaGo más veloz"
                    style={{
                      marginTop: 14,
                      width: "100%",
                      overflow: "hidden",
                      borderRadius: 22,
                      padding: "16px",
                      background: "var(--rp-fast-bg)",
                      border: "2px solid var(--rp-fast-border)",
                      color: "var(--rp-fast-fg)",
                      boxShadow: "0 14px 30px rgba(92,62,0,.22)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                      }}
                    >
                      <div
                        className="rapago-fast-search-panel__icon"
                        aria-hidden="true"
                        style={{
                          flex: "0 0 44px",
                          width: 44,
                          height: 44,
                          display: "grid",
                          placeItems: "center",
                          borderRadius: 14,
                          background: "var(--rp-fast-icon-bg)",
                          color: "var(--rp-fast-icon-fg)",
                          fontSize: "1.35rem",
                          boxShadow: "0 7px 16px rgba(17,24,39,.24)",
                        }}
                      >
                        <IonIcon icon={flashOutline} aria-hidden="true" />
                      </div>

                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          className="rapago-fast-search-panel__eyebrow"
                          style={{
                            color: "var(--rp-fast-fg)",
                            fontSize: ".68rem",
                            fontWeight: 950,
                            letterSpacing: ".08em",
                            textTransform: "uppercase",
                          }}
                        >
                          Búsqueda prioritaria
                        </div>

                        <div
                          className="rapago-fast-search-panel__title"
                          style={{
                            marginTop: 3,
                            color: "var(--rp-fast-fg)",
                            fontWeight: 950,
                            fontSize: "1rem",
                            lineHeight: 1.2,
                          }}
                        >
                          ¿Quieres un RapaGo más veloz?
                        </div>
                      </div>
                    </div>

                    <div
                      className="rapago-fast-search-panel__detail"
                      style={{
                        marginTop: 12,
                        padding: "11px 12px",
                        borderRadius: 14,
                        background: "var(--rp-fast-detail-bg)",
                        border: "1px solid var(--rp-fast-detail-border)",
                        color: "var(--rp-fast-fg)",
                        fontSize: ".8rem",
                        lineHeight: 1.45,
                        fontWeight: 800,
                      }}
                    >
                      Ya llevas <strong className="rapago-fast-search-panel__value">{searchingElapsedLabel}</strong> buscando conductor.
                      Al activarlo, priorizaremos tu solicitud y se agregarán
                      <strong className="rapago-fast-search-panel__value"> {formatClp(RAPAGO_FAST_SEARCH_FEE_CLP)}</strong> al monto final.
                    </div>

                    <div
                      style={{
                        marginTop: 12,
                        display: "grid",
                        gridTemplateColumns: "1fr",
                        gap: 9,
                      }}
                    >
                      <button
                        type="button"
                        className="rapago-fast-search-panel__primary"
                        onClick={() => {
                          if (fastSearchUsesKlap) {
                            setFastSearchActionError(
                              "RapaGo más veloz todavía no está habilitado para pagos Klap. El viaje principal continúa normalmente.",
                            );
                            return;
                          }

                          setFastSearchBusy(true);
                          setFastSearchActionError(null);
                          void applyPassengerFastSearchChoice(ride, true, token)
                            .catch((err) => {
                              setFastSearchActionError(
                                err instanceof Error ? err.message : "No se pudo activar RapaGo más veloz.",
                              );
                            })
                            .finally(() => setFastSearchBusy(false));
                        }}
                        disabled={fastSearchBusy}
                        style={{
                          width: "100%",
                          minHeight: 46,
                          border: "none",
                          borderRadius: 14,
                          padding: "11px 14px",
                          background: "var(--rp-fast-primary-bg)",
                          color: "var(--rp-fast-primary-fg)",
                          fontSize: ".88rem",
                          fontWeight: 950,
                          lineHeight: 1.2,
                          cursor: "pointer",
                          boxShadow: "0 8px 18px rgba(17,24,39,.22)",
                        }}
                      >
                        {fastSearchBusy ? (
                          "Procesando…"
                        ) : fastSearchUsesKlap ? (
                          "No disponible para Klap"
                        ) : fastSearchUsesMercadoPago ? (
                          <>
                            <IonIcon icon={cardOutline} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: 4 }} />
                            Pagar {formatClp(RAPAGO_FAST_SEARCH_FEE_CLP)} con Mercado Pago
                          </>
                        ) : (
                          <>
                            <IonIcon icon={flashOutline} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: 4 }} />
                            Sí, activar por {formatClp(RAPAGO_FAST_SEARCH_FEE_CLP)}
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        className="rapago-fast-search-panel__secondary"
                        onClick={() => {
                          setFastSearchActionError(null);
                          void applyPassengerFastSearchChoice(ride, false, token);
                        }}
                        disabled={fastSearchBusy}
                        style={{
                          width: "100%",
                          minHeight: 43,
                          border: "2px solid var(--rp-fast-secondary-border)",
                          borderRadius: 14,
                          padding: "9px 14px",
                          background: "var(--rp-fast-secondary-bg)",
                          color: "var(--rp-fast-secondary-fg)",
                          fontSize: ".82rem",
                          fontWeight: 950,
                          lineHeight: 1.2,
                          cursor: "pointer",
                        }}
                      >
                        No, seguir esperando
                      </button>
                    </div>

                    {fastSearchActionError && (
                      <div
                        role="alert"
                        style={{
                          marginTop: 10,
                          padding: "10px 12px",
                          borderRadius: 12,
                          background: "var(--rp-err-bg)",
                          border: "1px solid var(--rp-err-bd)",
                          color: "var(--rp-err-fg)",
                          fontSize: ".75rem",
                          fontWeight: 900,
                          lineHeight: 1.35,
                        }}
                      >
                        {fastSearchActionError}
                      </div>
                    )}

                    <div
                      className="rapago-fast-search-panel__note"
                      style={{
                        marginTop: 10,
                        color: "var(--rp-fast-muted)",
                        fontSize: ".68rem",
                        fontWeight: 800,
                        lineHeight: 1.35,
                        textAlign: "center",
                      }}
                    >
                      {fastSearchUsesKlap
                        ? "El backend Klap actual solo procesa el pago principal del viaje; no se generará un cobro adicional de Mercado Pago."
                        : fastSearchUsesMercadoPago
                          ? "La prioridad se activará solamente cuando Mercado Pago confirme realmente el pago de $800."
                          : "Los $800 se sumarán al total en efectivo y el conductor verá el monto actualizado."}
                    </div>
                  </div>
                )}

                {fastSearchRecord?.accepted && (
                  <div className="rapago-trip-theme-panel">
                  <div
                    className="rp-tone-ok"
                    style={{
                      marginTop: 12,
                      borderRadius: 18,
                      padding: "12px 14px",
                      /* Iba en gradiente hex fijo (#ecfdf3→#c9f7da) emparejado
                         con color: var(--rp-ok-fg): en modo noche ese verde se
                         aclara y queda verde claro sobre verde claro. Se pasa
                         el fondo también al token var(--rp-ok-bg), que sí
                         cambia junto con --rp-ok-fg en cada tema. */
                      background: "var(--rp-ok-bg)",
                      color: "var(--rp-ok-fg)",
                      border: "2px solid var(--rp-ok-bd)",
                      fontSize: ".8rem",
                      fontWeight: 900,
                      lineHeight: 1.4,
                      boxShadow: "0 8px 18px rgba(20,83,45,.12)",
                    }}
                  >
                    <div style={{ fontSize: ".9rem", fontWeight: 950 }}>
                      <IonIcon icon={flashOutline} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: 4 }} />
                      RapaGo más veloz activado
                    </div>
                    <div style={{ marginTop: 3 }}>
                      Tu solicitud tiene prioridad. Se agregan
                      <strong> {formatClp(fastSearchFeeClp)}</strong> al monto final.
                    </div>
                  </div>
                  </div>
                )}
              </div>
            )
          )}

          {effectiveStatus === "driver_scheduled" && (
            <div
              style={{
                marginBottom: 14,
                background: "var(--rp-surface)",
                borderRadius: 18,
                padding: "12px",
                border: "1px solid rgba(34,197,94,.30)",
                boxShadow: "0 6px 18px rgba(0,0,0,.06)",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <IonIcon icon={carSportOutline} aria-hidden="true" style={{ fontSize: "1.25rem", color: "var(--rp-ok-fg)", flexShrink: 0, marginTop: 2 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 950, fontSize: ".92rem", color: "var(--rp-ok-fg)" }}>
                    Tu conductor fue asignado
                  </div>
                  <div style={{ color: "var(--rp-ok-fg)", fontSize: ".78rem", marginTop: 3, lineHeight: 1.35 }}>
                    {ride.driverName ?? "Tu conductor"} aceptó tu viaje.
                    <br />Sigue su GPS real en tiempo real en el mapa.
                  </div>
                </div>
              </div>

              {!showMap && (
                <div
                  style={{
                    marginTop: 10,
                    background: "var(--rp-ok-bg)",
                    color: "var(--rp-ok-fg)",
                    borderRadius: 14,
                    padding: "9px 10px",
                    fontSize: ".76rem",
                    fontWeight: 900,
                    lineHeight: 1.35,
                    border: "1px solid rgba(34,197,94,.24)",
                  }}
                >
                  Cargando mapa y señal GPS del conductor asignado...
                </div>
              )}
            </div>
          )}

          {hasDriver && !showHistoricalMap && !["pending_payment", "requested", "scheduled", "cancelled"].includes(effectiveStatus) && (
            <PassengerDriverAndVehicleDetails ride={ride as RideRequestData & Record<string, unknown>} />
          )}

          {/* Mismo escape del wildcard ion-card * que PassengerDriverAndVehicleDetails
              (ver el comentario largo ahí): este panel también declara su propio
              fondo con --rp-surface, así que necesita rapago-trip-theme-panel. */}
          {!showHistoricalMap && (
            <div
              className="rapago-trip-theme-panel"
              style={{
                background: "var(--rp-surface)",
                borderRadius: 18,
                padding: "12px",
                color: "var(--rp-text)",
                border: "1px solid rgba(0,0,0,.06)",
              }}
            >
              <div style={{ fontWeight: 950, fontSize: ".86rem", marginBottom: 10 }}>
                Detalle del viaje
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "20px 1fr", gap: 9, fontSize: ".84rem", lineHeight: 1.35 }}>
              {nav.passengerOriginalLat != null && nav.passengerOriginalLng != null && (
                <>
                  <span className="rp-tone-info" style={{ color: "var(--rp-info-fg)", fontSize: "1rem" }}>●</span>
                  <div>
                    <strong>Tu ubicación:</strong> punto donde estás ahora
                    <div className="rp-tone-muted" style={{ color: "var(--rp-muted)", fontSize: ".76rem", marginTop: 2 }}>
                      En el mapa aparece en azul. Camina hacia el punto verde recomendado.
                    </div>
                  </div>
                </>
              )}

              <span className="rp-tone-ok" style={{ color: "var(--rp-ok-fg)", fontSize: "1rem" }}>●</span>
              <div>
                <strong>Recogida accesible en calle:</strong> {ride.originText}
                {nav.pickupWalkMeters != null && nav.pickupWalkMeters > 8 && (
                  <div className="rp-tone-muted" style={{ color: "var(--rp-muted)", fontSize: ".76rem", marginTop: 2 }}>
                    Camina aprox. {Math.round(nav.pickupWalkMeters)} m hasta este punto para que el conductor te encuentre.
                  </div>
                )}
              </div>

              <span className="rp-tone-err" style={{ color: "var(--rp-err-fg)", fontSize: "1rem" }}>●</span>
              <div>
                <strong>Destino:</strong> {ride.destinationText}
              </div>

              {isRoundTripReturnPickupRide(ride as RideRequestData & Record<string, unknown>) && (
                <>
                  <span className="rp-tone-warn" style={{ color: "var(--rp-warn-fg)", fontSize: "1rem" }}>●</span>
                  <div>
                    <strong>Incluido en la reserva:</strong> este tramo de regreso no se cobra nuevamente.
                  </div>
                </>
              )}
              </div>
            </div>
          )}

          {!showHistoricalMap && displayFareClp != null && (
            <div
              style={{
                marginTop: 14,
                borderRadius: 20,
                padding: "13px 14px",
                background: "linear-gradient(135deg,#fff9e8 0%,#f1d58a 100%)",
                border: "1px solid rgba(210,164,58,.70)",
                boxShadow: "0 8px 22px rgba(0,0,0,.10)",
                /* Superficie dorada fija (igual que la promo de arriba): el
                   color usaba var(--rp-text), que en modo noche es casi
                   blanco y quedaba ilegible sobre este fondo claro. Se pasa
                   a --rp-text-legacy, pensado para texto oscuro fijo sobre
                   superficies claras que no cambian con el tema. */
                color: "var(--rp-text-legacy)",
              }}
            >
              <div style={{ fontSize: ".72rem", fontWeight: 950, color: "var(--rp-accent-legacy)", letterSpacing: ".04em" }}>
                MONTO A PAGAR
              </div>
              <div style={{ fontSize: "1.35rem", fontWeight: 950, lineHeight: 1.1, marginTop: 3 }}>
                {formatClp(displayFareClp)}
              </div>
              <div style={{ marginTop: 6, fontSize: ".78rem", color: "rgba(17,17,17,.72)", fontWeight: 800 }}>
                <IonIcon icon={cashOutline} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: 3 }} />
                Pago: {paymentLabel}
              </div>
              {fastSearchFeeClp > 0 && (
                /* Verde fijo (no var(--rp-ok-fg)) a propósito: esta tarjeta es
                   una superficie clara fija en ambos temas, así que el texto
                   necesita el valor de contraste calculado para día, no el
                   que --rp-ok-fg toma en modo noche (más claro, ilegible aquí). */
                <div style={{ marginTop: 4, fontSize: ".76rem", color: "#1f6347", fontWeight: 900 }}>
                  <IonIcon icon={flashOutline} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: 3 }} />
                  RapaGo más veloz: +{formatClp(fastSearchFeeClp)} incluido en este monto.
                </div>
              )}
              {ridePassengerFareType && (
                <div style={{ marginTop: 4, fontSize: ".76rem", color: "rgba(17,17,17,.72)", fontWeight: 800 }}>
                  <IonIcon icon={ticketOutline} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: 3 }} />
                  Tarifa aplicada: {passengerFareTypeLabel(ridePassengerFareType)}
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
                {paymentLabel.includes("Klap")
                  ? effectiveStatus === "pending_payment"
                    ? "Pago en proceso de aprobación por Klap. No vuelvas a pagar; la solicitud se habilitará automáticamente."
                    : "Pago con tarjeta validado por Klap y el backend de RAPA GO."
                  : paymentLabel.includes("Mercado Pago")
                    ? effectiveStatus === "pending_payment"
                      ? "Pago histórico en proceso de aprobación por Mercado Pago."
                      : "Pago histórico validado por Mercado Pago y el backend de RAPA GO."
                    : "Este es el valor que pagarás al finalizar el viaje."}
              </div>
            </div>
          )}

          {effectiveStatus === "completed" && displayFareClp != null && (
            <PassengerCashPaymentAfterRideCard
              ride={ride}
              displayFareClp={displayFareClp}
            />
          )}


          {effectiveStatus === "completed" && (
            <div
              style={{
                marginTop: 12,
                borderRadius: 20,
                padding: "12px",
                /* Antes en hex fijo: quedaba clara aunque el resto del viaje
                   estuviera en modo noche. Se pasa a los tokens err/ok, que
                   ya tienen la pareja bg+fg correcta para cada tema. */
                background: safetyReportStatus === "problem_reported" ? "var(--rp-err-bg)" : "var(--rp-ok-bg)",
                border: safetyReportStatus === "problem_reported"
                  ? "1px solid var(--rp-err-bd)"
                  : "1px solid var(--rp-ok-bd)",
                color: safetyReportStatus === "problem_reported" ? "var(--rp-err-fg)" : "var(--rp-ok-fg)",
                fontWeight: 900,
                lineHeight: 1.35,
              }}
            >
              <div style={{ fontWeight: 950, fontSize: ".9rem" }}>
                ¿Llegaste bien a destino?
              </div>
              <div style={{ marginTop: 4, fontSize: ".76rem", opacity: .86 }}>
                Esto queda registrado en la app. Si reportas problema, se abre WhatsApp soporte y Admin lo verá.
              </div>

              {safetyReportStatus && (
                <IonBadge
                  color={safetyReportStatus === "problem_reported" ? "danger" : "success"}
                  style={{ marginTop: 8, width: "fit-content" }}
                >
                  {safetyReportStatus === "problem_reported" ? "Problema reportado" : "Llegada confirmada"}
                </IonBadge>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
                <IonButton
                  size="small"
                  color="success"
                  disabled={safetyReportStatus === "arrived_well"}
                  onClick={() => onArrivedWell(ride)}
                  style={{ "--border-radius": "999px", fontWeight: 950 } as CSSProperties}
                >
                  Llegué bien
                </IonButton>

                <IonButton
                  size="small"
                  color="danger"
                  fill={safetyReportStatus === "problem_reported" ? "solid" : "outline"}
                  onClick={() => onReportProblem(ride)}
                  style={{ "--border-radius": "999px", fontWeight: 950 } as CSSProperties}
                >
                  Llegué mal / Reportar
                </IonButton>
              </div>
            </div>
          )}

          {passengerDriverAcceptedState && ["accepted", "driver_en_route"].includes(effectiveStatus) && (
            <div
              style={{
                marginTop: 12,
                borderRadius: 18,
                padding: "11px 12px",
                /* Igual que el resto: hex fijo -> tokens ok/err adaptables. */
                background: passengerDriverAcceptedState.isFree ? "var(--rp-ok-bg)" : "var(--rp-err-bg)",
                border: passengerDriverAcceptedState.isFree ? "1px solid var(--rp-ok-bd)" : "1px solid var(--rp-err-bd)",
                color: passengerDriverAcceptedState.isFree ? "var(--rp-ok-fg)" : "var(--rp-err-fg)",
                fontSize: ".78rem",
                lineHeight: 1.35,
                fontWeight: 900,
              }}
            >
              <IonIcon icon={carOutline} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: 4 }} />
              Conductor aceptó hace <strong>{formatPassengerElapsedTime(passengerDriverAcceptedState.elapsedMs)}</strong>.
              <br />
              {passengerDriverAcceptedState.isFree ? (
                <>Cancelación gratis: <strong>{formatPassengerElapsedTime(passengerDriverAcceptedState.remainingFreeMs)}</strong> restantes.</>
              ) : (
                <>Si cancelas ahora: <strong>{formatClp(cancellationPolicy.feeClp)}</strong>.</>
              )}
            </div>
          )}

          {["scheduled", "driver_scheduled"].includes(effectiveStatus) && cancellationPolicy.feeClp > 0 && (
            <div
              style={{
                marginTop: 12,
                borderRadius: 18,
                padding: "11px 12px",
                background: "var(--rp-err-bg)",
                border: "1px solid rgba(220,38,38,.28)",
                color: "var(--rp-err-fg)",
                fontSize: ".78rem",
                lineHeight: 1.35,
                fontWeight: 900,
              }}
            >
              Conductor asignado: finalizó el minuto gratuito.
              <br />
              Cargo por cancelar: <strong>{formatClp(cancellationPolicy.feeClp)}</strong>.
            </div>
          )}

          {cleanRideNotes(ride.notes) && (
            <div style={{ marginTop: 8, color: "var(--rp-muted)", fontSize: ".78rem" }}>
              {cleanRideNotes(ride.notes)}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            {["pending_payment", "requested", "scheduled", "driver_scheduled"].includes(effectiveStatus) && (
              <IonButton
                size="small"
                fill="outline"
                color="danger"
                disabled={cancelling}
                onClick={() => onCancel(ride.id)}
              >
                {cancelling ? <IonSpinner name="dots" /> : isRoundTripReturnPickupRide(ride as RideRequestData & Record<string, unknown>) ? "Cancelar recogida" : scheduleInfo.isScheduled ? "Cancelar reserva" : "Cancelar"}
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

            {["accepted", "driver_en_route", "driver_arrived", "in_progress"].includes(effectiveStatus) && (
              <IonButton
                size="small"
                color="danger"
                onClick={() => onEmergency(ride)}
                style={{ "--border-radius": "999px", fontWeight: 950 } as CSSProperties}
              >
                <IonIcon icon={alertCircleOutline} slot="start" aria-hidden="true" />
                Emergencia / WhatsApp
              </IonButton>
            )}

            {effectiveStatus === "cancelled" && shouldShowRapaGoCardCancelRefundButton(ride, effectiveStatus) && (
              <IonButton
                size="small"
                fill="outline"
                color="warning"
                onClick={() => openRapaGoCardCancelRefundWhatsApp(ride)}
              >
                Devolución
              </IonButton>
            )}

            {effectiveStatus === "completed" && !rated && (
              <IonButton
                size="small"
                fill="outline"
                color="warning"
                onClick={() => onRate(ride.id)}
              >
                <IonIcon icon={star} slot="start" aria-hidden="true" />
                Clasificar conductor
              </IonButton>
            )}

            {effectiveStatus === "completed" && rated && (
              <IonBadge color="success" style={{ fontSize: "0.72rem", padding: "4px 8px", display: "inline-flex", alignItems: "center", gap: 4 }}>
                <IonIcon icon={checkmarkCircle} aria-hidden="true" style={{ fontSize: "0.9rem" }} />
                Calificado
              </IonBadge>
            )}

            {ride.driverName && ACTIVE_STATUSES.includes(effectiveStatus) && !ride.driverPhone && (
              <WhatsAppButton
                phone={RAPAGO_SUPPORT_WHATSAPP_PHONE}
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
  // Solo se lee: el interruptor único vive en el encabezado de Inicio.
  const { theme } = useRapagoSectionTheme("trips");

  const [allRides,    setAllRides]    = useState<RideRequestData[]>([]);
  const [page,        setPage]        = useState(1);
  const [loading,     setLoading]     = useState(true);
  const [loadError,   setLoadError]   = useState<string | null>(null);
  const [cancelling,  setCancelling]  = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [ratingRideId,     setRatingRideId]     = useState<string | null>(null);
  const [ratingStars,      setRatingStars]      = useState(5);
  const [ratingComment,    setRatingComment]    = useState("");
  const [ratingExtras,     setRatingExtras]     = useState<string[]>([]);
  const [ratingPrivateComment, setRatingPrivateComment] = useState(false);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [ratingError,      setRatingError]      = useState<string | null>(null);
  const [ratedIds,         setRatedIds]         = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "completed" | "cancelled">("active");
  const [cancelledVisibilityNowMs, setCancelledVisibilityNowMs] = useState(() => Date.now());
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);
  const [passengerNotice, setPassengerNotice] = useState<PassengerNotificationPayload | null>(() =>
    readPassengerNotifications().find((item) => !item.read) ?? null,
  );
  const [pendingCancelAction, setPendingCancelAction] = useState<PendingPassengerCancelAction | null>(null);
  const [refundMercadoPagoAlert, setRefundMercadoPagoAlert] = useState<{ header: string; message: string; ride: RideRequestData | null } | null>(null);
  const [, setKnownAssignedRideIds] = useState<Set<string>>(new Set());
  const [tripSafetyReportsRevision, setTripSafetyReportsRevision] = useState(0);
  const [paymentReturnMessage, setPaymentReturnMessage] = useState<PaymentReturnMessage | null>(null);
  const [canResumeKlapPayment, setCanResumeKlapPayment] = useState(false);
  const [cancellingPendingKlap, setCancellingPendingKlap] = useState(false);
  const loadRidesInFlightRef = useRef(false);
  const autoRatingPromptedRideIdsRef = useRef<Set<string>>(new Set());

  const openPassengerRating = useCallback((rideId: string): void => {
    setRatingRideId(rideId);
    setRatingStars(5);
    setRatingComment("");
    setRatingExtras([]);
    setRatingPrivateComment(false);
    setRatingError(null);
  }, []);

  const dismissPassengerRatingForNow = useCallback((): void => {
    if (ratingRideId) {
      rememberPassengerDismissedRatingRide(ratingRideId);
    }

    setRatingRideId(null);
    setRatingExtras([]);
    setRatingComment("");
    setRatingPrivateComment(false);
    setRatingError(null);
  }, [ratingRideId]);

  const loadRides = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;

    if (loadRidesInFlightRef.current) return;
    loadRidesInFlightRef.current = true;

    if (!silent) {
      setLoading(true);
      setLoadError(null);
    }

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
        setRatedIds(readPassengerRatedRideIds(merged, session?.user));
        setKnownAssignedRideIds(new Set());
        if (!silent) setPage(1);
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
      setRatedIds(readPassengerRatedRideIds(mergedRides, session?.user));
      if (!silent) setPage(1);
      setLastRefreshAt(new Date());
      if (!silent) setLoadError(null);
    } catch (err) {
      if (!silent) {
        const localRides = readLocalPassengerRides();
        const bridgeRides = readPassengerVisibleScheduledBridgeRides(session?.user);
        const requeuedRides = readPassengerVisibleRequeuedRides(session?.user);
        requeuedRides.forEach(upsertRequeuedRideIntoPassengerLocalStorage);
        const merged = mergeRides([...localRides, ...bridgeRides, ...requeuedRides], requeuedRides);
        setAllRides(merged);
        setRatedIds(readPassengerRatedRideIds(merged, session?.user));
        setKnownAssignedRideIds(new Set());
        setPage(1);
        setLastRefreshAt(new Date());

        const message = err instanceof Error ? err.message : "Error al cargar tus viajes.";
        setLoadError(safeTripsErrorMessage(message));
      }
    } finally {
      loadRidesInFlightRef.current = false;
      if (!silent) setLoading(false);
    }
  }, [session?.accessToken, session?.user]);


  useEffect(() => {
    const refreshPassengerNotice = () => {
      setPassengerNotice(readPassengerNotifications().find((item) => !item.read) ?? null);
    };

    window.addEventListener("rapago:passenger-notification", refreshPassengerNotice as EventListener);
    window.addEventListener("rapago:passenger-notifications-updated", refreshPassengerNotice as EventListener);
    window.addEventListener(RAPAGO_REQUEUED_RIDES_EVENT, refreshPassengerNotice as EventListener);
    window.addEventListener("rapago:passenger-rides-updated", refreshPassengerNotice as EventListener);
    window.addEventListener(RAPAGO_FAST_SEARCH_EVENT, refreshPassengerNotice as EventListener);
    window.addEventListener("storage", refreshPassengerNotice);

    refreshPassengerNotice();

    return () => {
      window.removeEventListener("rapago:passenger-notification", refreshPassengerNotice as EventListener);
      window.removeEventListener("rapago:passenger-notifications-updated", refreshPassengerNotice as EventListener);
      window.removeEventListener(RAPAGO_REQUEUED_RIDES_EVENT, refreshPassengerNotice as EventListener);
      window.removeEventListener("rapago:passenger-rides-updated", refreshPassengerNotice as EventListener);
      window.removeEventListener(RAPAGO_FAST_SEARCH_EVENT, refreshPassengerNotice as EventListener);
      window.removeEventListener("storage", refreshPassengerNotice);
    };
  }, []);

  useEffect(() => {
    if (loading || submittingRating || ratingRideId) return;

    const dismissed = readPassengerDismissedRatingRideIds();
    const now = Date.now();

    const candidate = [...allRides]
      .filter((ride) => {
        if (getEffectivePassengerRideStatus(ride) !== "completed") return false;
        if (ratedIds.has(ride.id) || dismissed.has(ride.id)) return false;
        if (autoRatingPromptedRideIdsRef.current.has(ride.id)) return false;

        const completedAt = getPassengerRideCompletedTimestampMs(
          ride as RideRequestData & Record<string, unknown>,
        );

        return (
          completedAt != null &&
          now - completedAt >= 0 &&
          now - completedAt <= RAPAGO_PASSENGER_AUTO_RATING_MAX_AGE_MS
        );
      })
      .sort((a, b) => {
        const aTime =
          getPassengerRideCompletedTimestampMs(
            a as RideRequestData & Record<string, unknown>,
          ) ?? 0;
        const bTime =
          getPassengerRideCompletedTimestampMs(
            b as RideRequestData & Record<string, unknown>,
          ) ?? 0;
        return bTime - aTime;
      })[0];

    if (!candidate) return;

    autoRatingPromptedRideIdsRef.current.add(candidate.id);
    openPassengerRating(candidate.id);
  }, [
    allRides,
    loading,
    openPassengerRating,
    ratedIds,
    ratingRideId,
    submittingRating,
  ]);

  const cancelUnstartedKlapRequest = useCallback(async (): Promise<void> => {
    const pending = readPendingCardPayment();
    const accessToken = session?.accessToken;

    if (!pending || String(pending.provider ?? "").toLowerCase() !== "klap") {
      setCanResumeKlapPayment(false);
      return;
    }

    if (pending.checkoutStartedAt) {
      setPaymentReturnMessage({
        tone: "pending",
        title: "Pago Klap en verificación",
        body: "Este intento ya fue enviado a Klap. Primero debemos confirmar si hubo cobro; no crees otro pago todavía.",
      });
      return;
    }

    if (!accessToken) {
      setPaymentReturnMessage({
        tone: "rejected",
        title: "Sesión expirada",
        body: "Inicia sesión nuevamente para cancelar esta solicitud.",
      });
      return;
    }

    const paymentId = String(pending.paymentId ?? "").trim();
    const orderId = String(pending.orderId ?? "").trim();
    if (!paymentId || !orderId) {
      setPaymentReturnMessage({
        tone: "rejected",
        title: "Solicitud incompleta",
        body: "No encontramos los datos suficientes para cancelarla de forma segura.",
      });
      return;
    }

    if (!window.confirm("¿Cancelar esta solicitud pendiente? Podrás crear otro viaje inmediatamente.")) {
      return;
    }

    setCancellingPendingKlap(true);
    try {
      await cancelPendingKlapRide(accessToken, {
        ...pending,
        paymentId,
        orderId,
        provider: "klap",
        createdAt: String(pending.createdAt ?? "").trim() || new Date().toISOString(),
      } as PendingKlapPaymentRecord);
      clearPendingCardPayment();
      setCanResumeKlapPayment(false);
      setPaymentReturnMessage({
        tone: "approved",
        title: "Solicitud cancelada",
        body: "La solicitud sin pago se quitó de tus viajes. Ya puedes crear otra inmediatamente.",
      });
      await loadRides();
    } catch (error) {
      setPaymentReturnMessage({
        tone: "rejected",
        title: "No pudimos cancelar",
        body: error instanceof Error ? error.message : "Inténtalo nuevamente.",
      });
    } finally {
      setCancellingPendingKlap(false);
    }
  }, [loadRides, session?.accessToken]);

  useEffect(() => {
    void loadRides();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.accessToken]);

  useEffect(() => {
    let returnMarker = "";
    let returnProviderPaymentId = "";
    let returnExternalReference = "";

    try {
      const params = new URLSearchParams(window.location.search);
      returnMarker = params.get("payment") ?? "";
      returnProviderPaymentId =
        params.get("payment_id") ??
        params.get("collection_id") ??
        "";
      returnExternalReference = params.get("external_reference") ?? "";
    } catch {
      returnMarker = "";
      returnProviderPaymentId = "";
      returnExternalReference = "";
    }

    const supportedMarkers = new Set([
      "return",
      "success", // compatibilidad con enlaces antiguos; nunca se confía en este texto.
      "approved_return",
      "failure_return",
      "pending_return",
    ]);
    const hasPendingLocalPayment = Boolean(
      readPendingCardPayment() ?? readPendingFastSearchPayment(),
    );

    // También reintenta al abrir Mis Viajes si el navegador conservó una
    // conciliación pendiente aunque Mercado Pago ya haya limpiado la query.
    if (!supportedMarkers.has(returnMarker) && !hasPendingLocalPayment) return;

    let disposed = false;
    let waitTimer: number | null = null;

    const wait = (milliseconds: number): Promise<void> =>
      new Promise((resolve) => {
        waitTimer = window.setTimeout(resolve, milliseconds);
      });

    const verifyPaymentWithBackend = async (): Promise<void> => {
      const pending = readPendingCardPayment();
      setPaymentReturnMessage({
        tone: "checking",
        title:
          String(pending?.provider ?? "").trim().toLowerCase() === "klap"
            ? "Verificando pago con Klap"
            : "Verificando pago con Mercado Pago",
        body:
          String(pending?.provider ?? "").trim().toLowerCase() === "klap"
            ? "RAPA GO está esperando la confirmación segura de Klap y del backend."
            : "RAPA GO está verificando directamente con Mercado Pago. Apenas el cobro figure aprobado, la solicitud se publicará automáticamente.",
      });
      const pendingFastSearch = readPendingFastSearchPayment();
      const accessToken = session?.accessToken;
      const internalPaymentId = String(
        returnExternalReference ??
          pendingFastSearch?.paymentId ??
          pending?.paymentId ??
          "",
      ).trim();

      if (
        accessToken &&
        pending &&
        String(pending.provider ?? "").trim().toLowerCase() === "klap"
      ) {
        const paymentId = String(pending.paymentId ?? "").trim();
        setCanResumeKlapPayment(true);
        setPaymentReturnMessage({
          tone: "checking",
          title: "Verificando pago con Klap",
          body: "RAPA GO está esperando la confirmación segura del backend. No vuelvas a pagar.",
        });

        if (!paymentId) {
          setPaymentReturnMessage({
            tone: "rejected",
            title: "Pago Klap incompleto",
            body: "No encontramos el identificador del pago. Comunícate con soporte antes de crear otra solicitud.",
          });
          return;
        }

        for (let attempt = 0; attempt < 8 && !disposed; attempt += 1) {
          try {
            // La URL de retorno no es autoridad. El backend consulta la orden
            // oficial de Klap por order_id y valida referencia, monto y moneda.
            if (attempt === 0 || attempt === 3 || attempt === 6) {
              await walletService.reconcileKlapPayment(accessToken, paymentId);
            }

            const statusData = await walletService.getPaymentStatus(
              accessToken,
              paymentId,
            );
            const status = String(statusData.status ?? "")
              .trim()
              .toLowerCase();

            if (isKlapPaymentConfirmedStatus(status)) {
              activatePaidCardPaymentMirrors(pending);
              clearPendingCardPayment();
              cleanPaymentReturnQuery();
              setCanResumeKlapPayment(false);
              setPaymentReturnMessage({
                tone: "approved",
                title: "Pago Klap aprobado",
                body: "El backend confirmó el cobro y la solicitud quedó habilitada para continuar.",
              });
              await loadRides();
              return;
            }

            if (isKlapPaymentRejectedStatus(status)) {
              clearPendingCardPayment();
              cleanPaymentReturnQuery();
              setCanResumeKlapPayment(false);
              setPaymentReturnMessage({
                tone: "rejected",
                title: "Pago Klap no aprobado",
                body: "Klap informó que el pago fue rechazado, cancelado o no pudo completarse.",
              });
              await loadRides();
              return;
            }

            setPaymentReturnMessage({
              tone: attempt < 5 ? "checking" : "pending",
              title: attempt < 5 ? "Confirmando tu pago Klap" : "Pago Klap pendiente",
              body: "La solicitud seguirá bloqueada hasta que el webhook de Klap confirme el pago.",
            });
          } catch {
            setPaymentReturnMessage({
              tone: "pending",
              title: "No pudimos confirmar Klap todavía",
              body: "Puedes volver al checkout alojado por Klap o revisar más tarde. No crees otro pago.",
            });
          }

          if (attempt < 7 && !disposed) await wait(attempt < 5 ? 5000 : 15000);
        }

        if (!disposed) {
          setPaymentReturnMessage({
            tone: "pending",
            title: "Pago Klap aún pendiente",
            body: "Vuelve al checkout seguro de Klap o revisa Mis Viajes más tarde.",
          });
          setCanResumeKlapPayment(true);
        }
        return;
      }

      setCanResumeKlapPayment(false);

      // La URL de retorno no es autoridad. Se envía el payment_id al backend,
      // que consulta directamente la API de Mercado Pago y verifica:
      // external_reference, monto, moneda y estado.
      if (accessToken && internalPaymentId && !pending && !pendingFastSearch) {
        try {
          const reconciled = await reconcileMercadoPagoReturnWithBackend(
            accessToken,
            internalPaymentId,
            returnProviderPaymentId || undefined,
          );

          cleanPaymentReturnQuery();

          if (reconciled.status === "success") {
            setPaymentReturnMessage({
              tone: "approved",
              title: "Pago aprobado",
              body: "Mercado Pago aprobó el cobro y RAPA GO envió inmediatamente la solicitud a los conductores disponibles.",
            });
          } else if (
            ["rejected", "failed", "refunded"].includes(reconciled.status)
          ) {
            setPaymentReturnMessage({
              tone: "rejected",
              title: "Pago no aprobado",
              body: "Mercado Pago informó que el pago fue rechazado o cancelado.",
            });
          } else {
            setPaymentReturnMessage({
              tone: "pending",
              title: "Pago pendiente de confirmación",
              body: "Mercado Pago todavía no informa una aprobación definitiva. No vuelvas a pagar; RAPA GO seguirá verificando automáticamente.",
            });
          }

          await loadRides();
          return;
        } catch (err) {
          console.warn("[MercadoPago] No se pudo recuperar el regreso sin almacenamiento local:", err);
        }
      }

      if (accessToken && pendingFastSearch) {
        setPaymentReturnMessage({
          tone: "checking",
          title: "Verificando RapaGo más veloz",
          body: "La prioridad no se activa por volver desde Mercado Pago. Estamos esperando la aprobación real de los $800.",
        });

        for (let attempt = 0; attempt < 15 && !disposed; attempt += 1) {
          try {
            await reconcileMercadoPagoReturnWithBackend(
              accessToken,
              pendingFastSearch.paymentId,
              attempt === 0
                ? returnProviderPaymentId || undefined
                : undefined,
            );

            const status = await fetchPassengerFastSearchPaymentStatus(
              accessToken,
              pendingFastSearch.paymentId,
            );

            if (status === "success") {
              const serverRides = await ridesService.listMyRides(accessToken);
              const serverRide = serverRides.find(
                (item) => item.id === pendingFastSearch.rideRequestId,
              );
              const rideForMirror =
                serverRide ??
                (pendingFastSearch.rideMirror as unknown as RideRequestData);

              applyPassengerFastSearchApprovedLocally(rideForMirror, "card");
              clearPendingFastSearchPayment();
              cleanPaymentReturnQuery();
              setPaymentReturnMessage({
                tone: "approved",
                title: "RapaGo más veloz activado",
                body: "Mercado Pago confirmó los $800. Tu solicitud tiene prioridad y el conductor verá el recargo como pagado.",
              });
              await loadRides();
              return;
            }

            if (["rejected", "failed", "refunded"].includes(status)) {
              clearPendingFastSearchPayment();
              cleanPaymentReturnQuery();
              setPaymentReturnMessage({
                tone: "rejected",
                title: "Recargo no aprobado",
                body: "Los $800 no fueron confirmados. El viaje principal continúa normalmente, sin RapaGo más veloz.",
              });
              await loadRides();
              return;
            }

            setPaymentReturnMessage({
              tone: attempt < 5 ? "checking" : "pending",
              title: attempt < 5 ? "Confirmando los $800" : "Pago de prioridad pendiente",
              body: "El viaje continúa normal, pero la prioridad seguirá apagada hasta que Mercado Pago confirme el recargo.",
            });
          } catch {
            setPaymentReturnMessage({
              tone: "pending",
              title: "No pudimos confirmar el recargo todavía",
              body: "Por seguridad, RapaGo más veloz sigue apagado. El viaje principal no se cancela.",
            });
          }

          if (attempt < 14 && !disposed) await wait(attempt < 5 ? 5000 : 15000);
        }

        cleanPaymentReturnQuery();
        if (!disposed) {
          setPaymentReturnMessage({
            tone: "pending",
            title: "Pago de prioridad aún pendiente",
            body: "RapaGo más veloz se activará únicamente cuando el backend reciba la aprobación real de Mercado Pago.",
          });
          void loadRides();
        }
        return;
      }

      if (!accessToken || !pending) {
        cleanPaymentReturnQuery();
        if (!disposed) {
          setPaymentReturnMessage({
            tone: "pending",
            title: "Pago todavía no confirmado",
            body: accessToken
              ? "No pudimos relacionar este regreso con una solicitud local. Revisa nuevamente Mis Viajes; el backend seguirá siendo la autoridad."
              : "Tu sesión expiró. Inicia sesión nuevamente para consultar el pago sin volver a pagar.",
          });
          void loadRides();
        }
        return;
      }

      for (let attempt = 0; attempt < 15 && !disposed; attempt += 1) {
        try {
          const paymentId = String(
            returnExternalReference ?? pending.paymentId ?? "",
          ).trim();

          if (paymentId) {
            await reconcileMercadoPagoReturnWithBackend(
              accessToken,
              paymentId,
              attempt === 0
                ? returnProviderPaymentId || undefined
                : undefined,
            );
          }

          const serverRides = await ridesService.listMyRides(accessToken);
          const serverRide = serverRides.find((ride) => ride.id === pending.rideRequestId);
          const status = String(serverRide?.status ?? "").trim().toLowerCase();

          if (status === "cancelled") {
            clearPendingCardPayment();
            cleanPaymentReturnQuery();
            setPaymentReturnMessage({
              tone: "rejected",
              title: "Pago no aprobado",
              body: "Mercado Pago no confirmó el cobro. La solicitud fue cancelada y no se envió a ningún conductor.",
            });
            await loadRides();
            return;
          }

          if (status && status !== "pending_payment") {
            activatePaidCardPaymentMirrors(pending);
            clearPendingCardPayment();
            cleanPaymentReturnQuery();
            setPaymentReturnMessage({
              tone: "approved",
              title: "Pago aprobado",
              body: "Mercado Pago aprobó el cobro. La solicitud fue enviada inmediatamente a los conductores disponibles.",
            });
            await loadRides();
            return;
          }

          if (!disposed) {
            setPaymentReturnMessage({
              tone: attempt < 5 ? "checking" : "pending",
              title: attempt < 5 ? "Confirmando tu pago" : "Pago pendiente de confirmación",
              body: "Mercado Pago aún está procesando el cobro. La solicitud se enviará automáticamente apenas figure como aprobada.",
            });
          }
        } catch {
          if (!disposed) {
            setPaymentReturnMessage({
              tone: "pending",
              title: "No pudimos confirmar el pago todavía",
              body: "Por seguridad, el servicio permanece bloqueado. Actualiza nuevamente cuando tengas conexión.",
            });
          }
        }

        if (attempt < 14 && !disposed) await wait(attempt < 5 ? 5000 : 15000);
      }

      cleanPaymentReturnQuery();
      if (!disposed) {
        setPaymentReturnMessage({
          tone: "pending",
          title: "Pago aún no confirmado",
          body: "Mercado Pago todavía no entrega una aprobación final. La solicitud se publicará automáticamente cuando la entregue.",
        });
        void loadRides();
      }
    };

    void verifyPaymentWithBackend();

    return () => {
      disposed = true;
      if (waitTimer != null) window.clearTimeout(waitTimer);
    };
  }, [loadRides, session?.accessToken]);

  const hasActiveRide = allRides.some((ride) =>
    ACTIVE_STATUSES.includes(getPassengerNoShowCompletedEffectiveStatus(ride)),
  );

  useEffect(() => {
    cleanupExpiredCancelledRidesEverywhere();

    const refreshSilently = (): void => {
      if (document.visibilityState !== "visible") return;
      void loadRides({ silent: true });
    };

    const interval = window.setInterval(
      refreshSilently,
      hasActiveRide
        ? PASSENGER_ACTIVE_POLL_INTERVAL_MS
        : PASSENGER_IDLE_POLL_INTERVAL_MS,
    );

    const handleVisibilityChange = (): void => {
      if (document.visibilityState === "visible") refreshSilently();
    };

    window.addEventListener("focus", refreshSilently);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshSilently);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [hasActiveRide, loadRides]);

  useEffect(() => {
    const refresh = () => {
      void loadRides({ silent: true });
    };

    window.addEventListener(RAPAGO_ADMIN_SCHEDULED_RIDES_EVENT, refresh as EventListener);
    window.addEventListener(RAPAGO_REQUEUED_RIDES_EVENT, refresh as EventListener);
    window.addEventListener("rapago:passenger-rides-updated", refresh as EventListener);
    window.addEventListener("rapago:passenger-notifications-updated", refresh as EventListener);
    window.addEventListener(RAPAGO_FAST_SEARCH_EVENT, refresh as EventListener);
    window.addEventListener("storage", refresh);

    return () => {
      window.removeEventListener(RAPAGO_ADMIN_SCHEDULED_RIDES_EVENT, refresh as EventListener);
      window.removeEventListener(RAPAGO_REQUEUED_RIDES_EVENT, refresh as EventListener);
      window.removeEventListener("rapago:passenger-rides-updated", refresh as EventListener);
      window.removeEventListener("rapago:passenger-notifications-updated", refresh as EventListener);
      window.removeEventListener(RAPAGO_FAST_SEARCH_EVENT, refresh as EventListener);
      window.removeEventListener("storage", refresh);
    };
  }, [loadRides]);



  // RAPA GO: no abrimos la calificación automáticamente al completar un viaje.
  // El pasajero decide cuándo clasificar usando el botón de la tarjeta.

  useEffect(() => {
    const refreshTripSafetyReports = () => {
      setTripSafetyReportsRevision((current) => current + 1);
    };

    window.addEventListener("storage", refreshTripSafetyReports);
    window.addEventListener(RAPAGO_TRIP_SAFETY_REPORT_EVENT, refreshTripSafetyReports as EventListener);

    return () => {
      window.removeEventListener("storage", refreshTripSafetyReports);
      window.removeEventListener(RAPAGO_TRIP_SAFETY_REPORT_EVENT, refreshTripSafetyReports as EventListener);
    };
  }, []);

  useEffect(() => {
    // Regla operativa: una cancelación queda visible solo 10 minutos.
    // No borramos el viaje del backend ni de la BD; únicamente se limpia
    // automáticamente de "Mis Viajes" y de sus contadores operativos.
    const updateClock = (): void => {
      setCancelledVisibilityNowMs(Date.now());
    };

    updateClock();
    const interval = window.setInterval(
      updateClock,
      PASSENGER_CANCELLED_VISIBILITY_TICK_MS,
    );

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const ridesVisibleInTrips = allRides.filter((ride) => {
    const effectiveStatus =
      getPassengerNoShowCompletedEffectiveStatus(ride);

    return (
      effectiveStatus !== "cancelled" ||
      isPassengerCancelledRideVisibleForTenMinutes(
        ride as RideRequestData & Record<string, unknown>,
        cancelledVisibilityNowMs,
      )
    );
  });

  const filteredBeforePagination = ridesVisibleInTrips.filter((r) => {
    const effectiveStatus = getPassengerNoShowCompletedEffectiveStatus(r);

    if (statusFilter === "all")       return true;
    if (statusFilter === "active")    return ACTIVE_STATUSES.includes(effectiveStatus);
    if (statusFilter === "completed") return effectiveStatus === "completed";
    if (statusFilter === "cancelled") return effectiveStatus === "cancelled";
    return true;
  });

  const filtered = filteredBeforePagination.slice(0, page * PAGE_SIZE);

  function showMercadoPagoRefundAlert(ride: RideRequestData): void {
    const record = ride as RideRequestData & Record<string, unknown>;
    if (!isPassengerCancellationCardPaymentForRefundAction(record)) return;

    setRefundMercadoPagoAlert({
      header: "Cancelar/devolución",
      ride,
      message: [
        "Tu viaje fue cancelado correctamente.",
        "",
        "El pago con tarjeta fue una retención, no un cobro definitivo. El backend libera o captura la multa según la política. No se convierte en Beneficios.",
        "",
        "No debes ingresar tarjeta, claves ni códigos bancarios.",
        "",
        "Presiona Cancelar/devolución para abrir WhatsApp y dejar la devolución registrada con nosotros.",
      ].join("\n"),
    });
  }

  function isRideCancellationStateConflict(error: unknown): boolean {
    const details = error as {
      statusCode?: number;
      code?: string;
      message?: string;
    };
    const message =
      error instanceof Error
        ? error.message
        : String(details?.message ?? error ?? "");

    return (
      details?.statusCode === 409 ||
      details?.code === "RIDE_CANNOT_CANCEL" ||
      /cannot be cancelled|current status/i.test(message)
    );
  }

  async function cancelPassengerRideUsingBackendState(
    accessToken: string,
    rideId: string,
    mode: "requested" | "accepted",
    cancellationReason: string,
  ): Promise<void> {
    const cancelRequested = () =>
      ridesService.cancelRideRequest(
        accessToken,
        rideId,
        cancellationReason,
      );
    const cancelAccepted = () =>
      ridesService.cancelAcceptedRide(
        accessToken,
        rideId,
        cancellationReason,
      );

    try {
      if (mode === "accepted") {
        await cancelAccepted();
      } else {
        await cancelRequested();
      }
    } catch (error) {
      if (!isRideCancellationStateConflict(error)) throw error;

      // El estado visual puede quedar atrás respecto al backend. Ante un 409,
      // reintentamos una sola vez con el endpoint correspondiente al otro
      // grupo de estados para no dejar al pasajero atrapado.
      if (mode === "accepted") {
        await cancelRequested();
      } else {
        await cancelAccepted();
      }
    }
  }

  async function performPassengerCancel(
    targetRide: RideRequestData,
    rideId: string,
    mode: "requested" | "accepted",
    resolvedPolicy: PassengerCancellationPolicy,
  ): Promise<void> {
    setCancelling(rideId);
    setCancelError(null);

    const cancelledLocal = cancelPassengerRideEverywhere(targetRide, resolvedPolicy);
    setAllRides((prev) => applyPassengerCancelledRideToList(prev, targetRide, cancelledLocal));

    try {
      // Toda reserva real debe cancelarse también en el backend.
      // "scheduled" es un estado visual del frontend; en la base de datos
      // normalmente continúa como requested hasta su activación.
      const shouldTryBackend =
        Boolean(session?.accessToken) &&
        !rideId.startsWith("local-") &&
        !rideId.startsWith("admin-local-") &&
        !isDriverCancelledRequeuedRide(
          targetRide as RideRequestData & Record<string, unknown>,
        );

      if (shouldTryBackend) {
        const cancellationReason =
          resolvedPolicy.cancellationReasonLabel ??
          resolvedPolicy.title ??
          "Cancelado por pasajero.";

        await cancelPassengerRideUsingBackendState(
          session!.accessToken,
          rideId,
          mode,
          cancellationReason,
        );
      }

      if (AUTO_SHOW_CARD_REFUND_ALERT) {
        showMercadoPagoRefundAlert(targetRide);
      }
      setCancelError(null);
    } catch {
      // Aunque el backend responda 404/409/500, ya cancelamos en localStorage
      // para que el pasajero no quede atrapado con el viaje reencolado activo.
      if (AUTO_SHOW_CARD_REFUND_ALERT) {
        showMercadoPagoRefundAlert(targetRide);
      }
      setCancelError(null);
    } finally {
      setCancelling(null);
      setPendingCancelAction(null);
      void loadRides();
    }
  }

  function requestPassengerCancel(rideId: string, mode: "requested" | "accepted"): void {
    const targetRide =
      allRides.find((ride) => ride.id === rideId) ??
      readLocalPassengerRides().find((ride) => ride.id === rideId) ??
      readPassengerVisibleRequeuedRides(session?.user).find((ride) => ride.id === rideId);

    if (!targetRide) return;

    const policy = getPassengerCancellationPolicyForRide(targetRide);

    // Siempre pedimos el motivo dentro de la app. Las causas de discrepancia,
    // seguridad, duplicidad o responsabilidad del Operador/conductor quedan
    // suspendidas para revisión del administrador; nunca se eximen por confiar
    // únicamente en el frontend.
    setPendingCancelAction({ rideId, mode, ride: targetRide, policy });
  }

  async function handleCancel(rideId: string) {
    requestPassengerCancel(rideId, "requested");
  }

  async function handleCancelAccepted(rideId: string) {
    requestPassengerCancel(rideId, "accepted");
  }

  function handlePassengerArrivedWell(ride: RideRequestData): void {
    savePassengerTripSafetyReport(ride, session?.user, "arrived_well");
    setTripSafetyReportsRevision((current) => current + 1);
  }

  function handlePassengerReportProblem(ride: RideRequestData): void {
    savePassengerTripSafetyReport(ride, session?.user, "problem_reported");
    setTripSafetyReportsRevision((current) => current + 1);
    openPassengerTripProblemWhatsApp(ride, session?.user);
  }

  function handlePassengerEmergency(ride: RideRequestData): void {
    openPassengerEmergencyWhatsApp(ride, session?.user);
    setTripSafetyReportsRevision((current) => current + 1);
  }

  async function handleSubmitRating() {
    if (!ratingRideId) return;

    const targetRide =
      allRides.find((ride) => ride.id === ratingRideId) ??
      readLocalPassengerRides().find((ride) => ride.id === ratingRideId);

    if (!targetRide) {
      setRatingError("No encontramos el viaje para calificar.");
      return;
    }

    setSubmittingRating(true);
    setRatingError(null);

    try {
      const ratingCommentWithExtras = [
        ratingComment.trim(),
        ratingExtras.length > 0 ? `Extras: ${ratingExtras.join(", ")}` : "",
      ].filter(Boolean).join("\n");

      // Primero guardamos localmente para que el conductor vea sus estrellas al instante.
      const commentVisibility = ratingPrivateComment ? "admin_only" : "participants_and_admin";
      upsertPassengerDriverRating(targetRide, ratingStars, ratingCommentWithExtras, session?.user, ratingExtras, commentVisibility);

      if (
        session?.accessToken &&
        !ratingRideId.startsWith("local-") &&
        !ratingRideId.startsWith("admin-local-")
      ) {
        try {
          await ridesService.rateRide(
            session.accessToken,
            ratingRideId,
            ratingStars,
            ratingCommentWithExtras || undefined,
          );
        } catch {
          // Si el backend todavía no guarda rating, el respaldo local mantiene la experiencia tipo Uber.
        }
      }

      setRatedIds((prev) => new Set([...prev, ratingRideId]));
      setAllRides((prev) =>
        prev.map((ride) =>
          ride.id === ratingRideId
            ? ({
                ...(ride as RideRequestData & Record<string, unknown>),
                passengerRatedDriver: true,
                passengerDriverRatingStars: ratingStars,
                passengerDriverRatingComment: ratingCommentWithExtras || null,
                passengerDriverRatingExtras: ratingExtras,
              } as RideRequestData)
            : ride,
        ),
      );
      setRatingRideId(null);
      setRatingStars(5);
      setRatingComment("");
      setRatingExtras([]);
      setRatingPrivateComment(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al calificar el viaje.";
      setRatingError(safeTripsErrorMessage(message) ?? "No se pudo guardar la calificación.");
    } finally {
      setSubmittingRating(false);
    }
  }

  const counts = {
    all:       ridesVisibleInTrips.length,
    active:    ridesVisibleInTrips.filter((r) => ACTIVE_STATUSES.includes(getPassengerNoShowCompletedEffectiveStatus(r))).length,
    completed: ridesVisibleInTrips.filter((r) => getPassengerNoShowCompletedEffectiveStatus(r) === "completed").length,
    cancelled: ridesVisibleInTrips.filter((r) => getPassengerNoShowCompletedEffectiveStatus(r) === "cancelled").length,
  };

  const hasMore = page * PAGE_SIZE < filteredBeforePagination.length;
  const tripSafetyReports = tripSafetyReportsRevision >= 0 ? readRapagoTripSafetyReports() : [];
  const ratingRide = ratingRideId ? allRides.find((ride) => ride.id === ratingRideId) ?? null : null;
  const ratingDriverName =
    ratingStringValue((ratingRide as RideRequestData & Record<string, unknown> | null)?.driverName) ||
    ratingStringValue((ratingRide as RideRequestData & Record<string, unknown> | null)?.driverFullName) ||
    "tu conductor";

  function toggleRatingExtra(extra: string): void {
    setRatingExtras((current) =>
      current.includes(extra)
        ? current.filter((item) => item !== extra)
        : [...current, extra],
    );
  }

  return (
    <IonPage
      className="rapago-section-page rapago-trips-page"
      data-rapago-theme={theme}
    >
      <style>{`
        /* ==========================================================
           RAPA GO — Alerta de cancelación / No Show
           Alto contraste para evitar fondo negro con texto invisible.
           El cssClass del IonAlert es rapago-cancellation-policy-alert.
           ========================================================== */
        ion-alert.rapago-cancellation-policy-alert {
          --background: #fffaf0;
          --color: #17130d;
          --backdrop-opacity: 0.72;
          --max-width: 620px;
        }

        ion-alert.rapago-cancellation-policy-alert .alert-wrapper {
          width: min(92vw, 620px) !important;
          max-width: 620px !important;
          max-height: min(88vh, 760px) !important;
          border-radius: 24px !important;
          background: #fffaf0 !important;
          color: #17130d !important;
          border: 2px solid rgba(200, 155, 60, 0.72) !important;
          box-shadow: 0 28px 80px rgba(0, 0, 0, 0.48) !important;
          overflow: hidden !important;
        }

        ion-alert.rapago-cancellation-policy-alert .alert-head {
          padding: 22px 24px 10px !important;
          text-align: left !important;
          background: linear-gradient(135deg, #fff8e7 0%, #f1dfb8 100%) !important;
          border-bottom: 1px solid rgba(139, 99, 25, 0.22) !important;
        }

        ion-alert.rapago-cancellation-policy-alert .alert-title {
          margin: 0 !important;
          color: #17130d !important;
          font-size: clamp(1.12rem, 2.5vw, 1.35rem) !important;
          font-weight: 950 !important;
          line-height: 1.2 !important;
          letter-spacing: -0.01em !important;
        }

        ion-alert.rapago-cancellation-policy-alert .alert-message {
          margin: 14px 18px 10px !important;
          padding: 14px 16px !important;
          max-height: 185px !important;
          overflow-y: auto !important;
          white-space: pre-line !important;
          color: #2b2419 !important;
          background: #fff3cf !important;
          border: 1px solid rgba(200, 155, 60, 0.42) !important;
          border-radius: 16px !important;
          font-size: 0.92rem !important;
          font-weight: 750 !important;
          line-height: 1.55 !important;
          opacity: 1 !important;
          scrollbar-width: thin;
          scrollbar-color: #c89b3c #fff3cf;
        }

        ion-alert.rapago-cancellation-policy-alert .alert-input-group,
        ion-alert.rapago-cancellation-policy-alert .alert-radio-group {
          margin: 0 18px 12px !important;
          padding: 6px !important;
          max-height: 310px !important;
          overflow-y: auto !important;
          background: #ffffff !important;
          border: 1px solid rgba(65, 50, 28, 0.16) !important;
          border-radius: 16px !important;
          scrollbar-width: thin;
          scrollbar-color: #c89b3c #f6f2ec;
        }

        ion-alert.rapago-cancellation-policy-alert .alert-radio-button {
          min-height: 58px !important;
          margin: 0 0 6px !important;
          border-radius: 13px !important;
          background: #ffffff !important;
          border: 1px solid #e7dcc7 !important;
          color: #17130d !important;
          transition: background 150ms ease, border-color 150ms ease, transform 150ms ease !important;
        }

        ion-alert.rapago-cancellation-policy-alert .alert-radio-button:last-child {
          margin-bottom: 0 !important;
        }

        ion-alert.rapago-cancellation-policy-alert .alert-radio-button:hover {
          background: #fff8e7 !important;
          border-color: #c89b3c !important;
        }

        ion-alert.rapago-cancellation-policy-alert .alert-radio-button[aria-checked="true"] {
          background: #fff0bd !important;
          border-color: #a87920 !important;
          box-shadow: inset 0 0 0 1px rgba(168, 121, 32, 0.3) !important;
        }

        ion-alert.rapago-cancellation-policy-alert .alert-radio-label {
          padding-top: 14px !important;
          padding-bottom: 14px !important;
          white-space: normal !important;
          overflow: visible !important;
          text-overflow: clip !important;
          color: #201a12 !important;
          font-size: 0.9rem !important;
          font-weight: 800 !important;
          line-height: 1.35 !important;
          opacity: 1 !important;
        }

        ion-alert.rapago-cancellation-policy-alert .alert-radio-icon {
          border-color: #6b6255 !important;
          opacity: 1 !important;
        }

        ion-alert.rapago-cancellation-policy-alert .alert-radio-button[aria-checked="true"] .alert-radio-icon {
          border-color: #a87920 !important;
        }

        ion-alert.rapago-cancellation-policy-alert .alert-radio-inner {
          background: #a87920 !important;
        }

        ion-alert.rapago-cancellation-policy-alert .alert-button-group {
          display: grid !important;
          grid-template-columns: 1fr 1fr !important;
          gap: 10px !important;
          padding: 12px 18px 18px !important;
          background: #fffaf0 !important;
          border-top: 1px solid rgba(65, 50, 28, 0.14) !important;
        }

        ion-alert.rapago-cancellation-policy-alert .alert-button {
          width: 100% !important;
          min-width: 0 !important;
          min-height: 48px !important;
          margin: 0 !important;
          border-radius: 14px !important;
          justify-content: center !important;
          text-transform: none !important;
          font-size: 0.9rem !important;
          font-weight: 950 !important;
          letter-spacing: 0 !important;
          opacity: 1 !important;
        }

        ion-alert.rapago-cancellation-policy-alert .alert-button[role="cancel"] {
          color: #17130d !important;
          background: #f6f2ec !important;
          border: 1px solid #b9aa91 !important;
        }

        ion-alert.rapago-cancellation-policy-alert .alert-button[role="destructive"] {
          color: #ffffff !important;
          background: linear-gradient(135deg, #b42318, #dc2626) !important;
          border: 1px solid #991b1b !important;
          box-shadow: 0 10px 22px rgba(185, 28, 28, 0.24) !important;
        }

        ion-alert.rapago-cancellation-policy-alert .alert-button:focus-visible {
          outline: 3px solid rgba(200, 155, 60, 0.48) !important;
          outline-offset: 2px !important;
        }

        @media (max-width: 520px) {
          ion-alert.rapago-cancellation-policy-alert .alert-wrapper {
            width: calc(100vw - 24px) !important;
            max-height: calc(100vh - 34px) !important;
            border-radius: 20px !important;
          }

          ion-alert.rapago-cancellation-policy-alert .alert-head {
            padding: 18px 18px 9px !important;
          }

          ion-alert.rapago-cancellation-policy-alert .alert-message {
            margin: 10px 12px 8px !important;
            padding: 12px 13px !important;
            max-height: 155px !important;
            font-size: 0.84rem !important;
          }

          ion-alert.rapago-cancellation-policy-alert .alert-input-group,
          ion-alert.rapago-cancellation-policy-alert .alert-radio-group {
            margin: 0 12px 9px !important;
            max-height: 270px !important;
          }

          ion-alert.rapago-cancellation-policy-alert .alert-radio-label {
            font-size: 0.83rem !important;
          }

          ion-alert.rapago-cancellation-policy-alert .alert-button-group {
            padding: 10px 12px 14px !important;
          }
        }
      `}</style>
      <RapagoSectionHeader
        title="Mis Viajes"
        actionIcon={refreshOutline}
        actionLabel="Actualizar"
        actionLoading={loading}
        onAction={() => void loadRides()}
      />
      <IonHeader className="rapago-section-subheader">
        <IonToolbar>
          <div
            role="radiogroup"
            aria-label="Filtrar viajes por estado"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "8px",
              padding: "0 12px 10px",
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            {(["all", "active", "completed", "cancelled"] as const).map((f) => {
              const labels = { all: "Todos", active: "Activos", completed: "Completados", cancelled: "Cancelados" };
              const active = statusFilter === f;
              return (
                /* IonChip no es focalizable ni accionable por teclado por sí
                   solo, y el estado activo se comunicaba únicamente por color.
                   Con role="radio" + aria-checked el lector anuncia cuál está
                   seleccionado, y tabIndex + onKeyDown permiten usarlo sin
                   ratón ni pantalla táctil. */
                <IonChip key={f}
                  role="radio"
                  aria-checked={active}
                  aria-label={`Filtrar por ${labels[f]}`}
                  tabIndex={0}
                  className={active ? "rapago-filter-chip is-active" : "rapago-filter-chip"}
                  style={{
                    width: "100%",
                    minWidth: 0,
                    margin: 0,
                    justifyContent: "center",
                  }}
                  onClick={() => setStatusFilter(f)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setStatusFilter(f);
                    }
                  }}
                >
                  {labels[f]}{counts[f] > 0 ? ` (${counts[f]})` : ""}
                </IonChip>
              );
            })}
          </div>
        </IonToolbar>

        <IonToolbar style={{ "--background": "transparent", "--border-width": "0" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              padding: "8px 14px 10px",
              color: "var(--rp-text)",
              fontSize: ".78rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <IonIcon icon={notificationsOutline} aria-hidden="true" style={{ color: "var(--rp-accent)", fontSize: 18, lineHeight: 1 }} />
              <span>
                {counts.active > 0
                  ? "Tienes viajes o reservas activas. Revisa el detalle y el mapa cuando el conductor esté en camino."
                  : "Sin conductor activo por ahora."}
              </span>
            </div>
          </div>

          {lastRefreshAt && (
            <div
              style={{
                color: "var(--rp-muted)",
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
        {paymentReturnMessage && (
          <IonCard
            className="rapago-trips-notice-card"
            style={{
              margin: "12px 14px 0",
              borderRadius: 18,
              /* Antes en hex fijo por tono: se quedaba clara aunque la
                 pantalla estuviera en modo noche. Se pasa a los tokens
                 semánticos ok/err/warn, ya calculados para ambos temas. */
              background:
                paymentReturnMessage.tone === "approved"
                  ? "var(--rp-ok-bg)"
                  : paymentReturnMessage.tone === "rejected"
                    ? "var(--rp-err-bg)"
                    : "var(--rp-warn-bg)",
              color:
                paymentReturnMessage.tone === "approved"
                  ? "var(--rp-ok-fg)"
                  : paymentReturnMessage.tone === "rejected"
                    ? "var(--rp-err-fg)"
                    : "var(--rp-warn-fg)",
              border:
                paymentReturnMessage.tone === "approved"
                  ? "1px solid var(--rp-ok-bd)"
                  : paymentReturnMessage.tone === "rejected"
                    ? "1px solid var(--rp-err-bd)"
                    : "1px solid var(--rp-warn-bd)",
              boxShadow: "0 10px 24px rgba(0,0,0,.12)",
            }}
          >
            <IonCardContent style={{ padding: "12px 14px" }}>
              <div style={{ fontWeight: 950, fontSize: ".92rem", display: "flex", alignItems: "center", gap: 6 }}>
                <IonIcon
                  aria-hidden="true"
                  style={{ fontSize: "1.05rem", flexShrink: 0 }}
                  icon={
                    paymentReturnMessage.tone === "checking"
                      ? hourglassOutline
                      : paymentReturnMessage.tone === "approved"
                        ? checkmarkCircle
                        : paymentReturnMessage.tone === "rejected"
                          ? closeCircle
                          : warningOutline
                  }
                />
                {paymentReturnMessage.title}
              </div>
              <div style={{ marginTop: 4, fontSize: ".8rem", lineHeight: 1.4 }}>
                {paymentReturnMessage.body}
              </div>
              {canResumeKlapPayment && (
                <IonButton
                  size="small"
                  color="warning"
                  style={{ "--border-radius": "999px", marginTop: 8, fontWeight: 950 } as CSSProperties}
                  onClick={() => {
                    const pendingPayment = readPendingCardPayment();
                    const redirectUrl = String(pendingPayment?.redirectUrl ?? "").trim();
                    if (redirectUrl) {
                      openKlapHostedCheckout(redirectUrl);
                      return;
                    }
                    history.push(ROUTES.PASSENGER.REQUEST_RIDE);
                  }}
                >
                  Abrir checkout seguro de Klap
                </IonButton>
              )}
              {canResumeKlapPayment && !readPendingCardPayment()?.checkoutStartedAt && (
                <IonButton
                  size="small"
                  fill="outline"
                  color="danger"
                  disabled={cancellingPendingKlap}
                  style={{ "--border-radius": "999px", marginTop: 8, fontWeight: 900 } as CSSProperties}
                  onClick={() => void cancelUnstartedKlapRequest()}
                >
                  {cancellingPendingKlap ? <IonSpinner name="dots" /> : "Cancelar solicitud"}
                </IonButton>
              )}
              {paymentReturnMessage.tone !== "checking" && (
                <IonButton
                  size="small"
                  fill="outline"
                  color={paymentReturnMessage.tone === "rejected" ? "danger" : paymentReturnMessage.tone === "approved" ? "success" : "warning"}
                  style={{ "--border-radius": "999px", marginTop: 8, fontWeight: 900 } as CSSProperties}
                  onClick={() => setPaymentReturnMessage(null)}
                >
                  Entendido
                </IonButton>
              )}
            </IonCardContent>
          </IonCard>
        )}

        {passengerNotice && (
          <IonCard className="rapago-trips-notice-card" style={{ margin: "12px 14px 0", borderRadius: 18, background: "var(--rp-warn-bg)", color: "var(--rp-text)", border: "1px solid rgba(210,164,58,.65)", boxShadow: "0 10px 24px rgba(0,0,0,.16)" }}>
            <IonCardContent style={{ padding: "12px 14px" }}>
              <div style={{ fontWeight: 950, fontSize: ".92rem" }}>{passengerNotice.title}</div>
              {/* La tarjeta usa var(--rp-warn-bg) + var(--rp-text): en noche el
                  fondo es oscuro y este texto quedaba invisible. */}
              <div style={{ marginTop: 4, color: "var(--rp-muted)", fontSize: ".8rem", lineHeight: 1.35 }}>{passengerNotice.body}</div>
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
          <div style={{ padding: "16px" }} role="alert">
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
          <div className="rapago-trips-list" style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "12px 14px 18px" }}>
            {filtered.map((ride) => (
              <PassengerRideCard
                key={ride.id}
                ride={ride}
                token={session?.accessToken ?? ""}
                cancelling={cancelling === ride.id}
                rated={ratedIds.has(ride.id)}
                safetyReportStatus={
                  tripSafetyReports.find((item) => item.rideKey === getTripSafetyRideKey(ride as RideRequestData & Record<string, unknown>) && item.reporterRole === "passenger")?.status ?? null
                }
                onCancel={(rideId) => void handleCancel(rideId)}
                onCancelAccepted={(rideId) => void handleCancelAccepted(rideId)}
                onArrivedWell={handlePassengerArrivedWell}
                onReportProblem={handlePassengerReportProblem}
                onEmergency={handlePassengerEmergency}
                onRate={openPassengerRating}
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
          <div style={{ padding: "0 16px" }} role="alert">
            <IonText color="danger"><p style={{ fontSize: "0.85rem" }}>{cancelError}</p></IonText>
          </div>
        )}

        <IonModal
          isOpen={ratingRideId !== null}
          onDidDismiss={() => {
            if (!submittingRating && ratingRideId) {
              dismissPassengerRatingForNow();
            }
          }}
          className="rapago-rating-modal"
          keepContentsMounted={false}
        >
          <IonContent
            className="ion-padding"
            style={{ "--background": "rgba(17,24,39,.56)" } as CSSProperties}
          >
            <div
              style={{
                minHeight: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "18px 0",
              }}
            >
              <IonCard
                style={{
                  width: "100%",
                  maxWidth: 560,
                  margin: 0,
                  borderRadius: 28,
                  overflow: "hidden",
                  background: "linear-gradient(180deg,#fffaf0,#f8ead0)",
                  color: "var(--rp-text-legacy)",
                  boxShadow: "0 28px 80px rgba(0,0,0,.45)",
                  border: "1px solid rgba(214,168,62,.34)",
                }}
              >
                <IonCardContent style={{ padding: "18px 18px 16px" }}>
                  <div
                    style={{
                      display: "flex",
                      gap: 12,
                      alignItems: "flex-start",
                      marginBottom: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 18,
                        background: "linear-gradient(135deg,#fff7d6,#facc15)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 28,
                        color: "#7a5715",
                        boxShadow: "0 12px 30px rgba(245,158,11,.26)",
                        flexShrink: 0,
                      }}
                    >
                      <IonIcon icon={star} aria-hidden="true" />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 950, fontSize: "1.16rem", lineHeight: 1.16 }}>
                        ¿Quieres calificar al conductor que te recogió?
                      </div>
                      <div style={{ marginTop: 5, color: "var(--rp-muted-legacy)", fontSize: ".84rem", fontWeight: 800, lineHeight: 1.35 }}>
                        Evalúa a <strong>{ratingDriverName}</strong> y agrega extras del servicio para mejorar la experiencia RAPA GO.
                      </div>
                    </div>
                  </div>

                  {ratingRide && (
                    <div
                      style={{
                        marginBottom: 12,
                        padding: 11,
                        borderRadius: 18,
                        background: "rgba(255,255,255,.70)",
                        border: "1px solid rgba(214,168,62,.24)",
                        color: "var(--rp-muted-legacy)",
                        fontSize: ".78rem",
                        fontWeight: 850,
                        lineHeight: 1.35,
                      }}
                    >
                      {ratingRide.originText} → {ratingRide.destinationText}
                    </div>
                  )}

                  <div style={{ fontWeight: 950, fontSize: ".86rem", marginBottom: 3 }}>
                    Calificación
                  </div>
                  <StarRatingInput value={ratingStars} onChange={setRatingStars} />

                  <div style={{ fontWeight: 950, fontSize: ".86rem", marginTop: 12 }}>
                    Extras del conductor
                  </div>
                  <div style={{ color: "var(--rp-muted-legacy)", fontSize: ".76rem", fontWeight: 800, marginTop: 2 }}>
                    Toca una o varias opciones.
                  </div>
                  <RatingExtrasSelector selected={ratingExtras} onToggle={toggleRatingExtra} />

                  <IonItem
                    lines="none"
                    style={{
                      "--padding-start": "0",
                      "--inner-padding-end": "0",
                      marginTop: "13px",
                      "--background": "transparent",
                    } as CSSProperties}
                  >
                    <IonTextarea
                      value={ratingComment}
                      onIonInput={(e) => setRatingComment(String(e.detail.value ?? ""))}
                      placeholder="Comentario opcional: cuéntanos cómo fue el viaje"
                      maxlength={500}
                      rows={3}
                      style={{
                        background: "var(--rp-surface-legacy)",
                        borderRadius: 18,
                        border: "1px solid rgba(214,168,62,.34)",
                        padding: "10px 12px",
                        color: "var(--rp-text-legacy)",
                        fontWeight: 800,
                      } as CSSProperties}
                    />
                  </IonItem>

                  <IonItem lines="none" style={{ "--background": "transparent", "--padding-start": "0" } as CSSProperties}>
                    <IonLabel>
                      <div style={{ fontWeight: 900 }}>Comentario solo para RAPA GO</div>
                      <div style={{ fontSize: ".74rem", color: "var(--rp-muted-legacy)" }}>
                        Al activarlo, el conductor no verá el texto. La calificación numérica sí cuenta para su promedio.
                      </div>
                    </IonLabel>
                    <IonToggle
                      checked={ratingPrivateComment}
                      onIonChange={(event) => setRatingPrivateComment(event.detail.checked)}
                    />
                  </IonItem>

                  {ratingError && (
                    <IonText color="danger">
                      <p style={{ fontSize: "0.82rem", margin: "8px 0 0", fontWeight: 850 }}>
                        {ratingError}
                      </p>
                    </IonText>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
                    <IonButton
                      expand="block"
                      fill="outline"
                      color="medium"
                      onClick={dismissPassengerRatingForNow}
                      disabled={submittingRating}
                      style={{ "--border-radius": "16px", fontWeight: 950 } as CSSProperties}
                    >
                      Omitir por ahora
                    </IonButton>

                    <IonButton
                      expand="block"
                      color="warning"
                      onClick={() => void handleSubmitRating()}
                      disabled={submittingRating}
                      style={{ "--border-radius": "16px", "--color": "var(--rp-text-legacy)", fontWeight: 950 } as CSSProperties}
                    >
                      {submittingRating ? <IonSpinner name="dots" /> : "Enviar calificación"}
                    </IonButton>
                  </div>
                </IonCardContent>
              </IonCard>
            </div>
          </IonContent>
        </IonModal>

        <IonAlert
          isOpen={pendingCancelAction !== null}
          cssClass="rapago-cancellation-policy-alert"
          backdropDismiss={false}
          header={pendingCancelAction?.policy.title ?? "Cancelar viaje"}
          message={
            pendingCancelAction
              ? buildPassengerCancellationAlertMessage(pendingCancelAction.policy, pendingCancelAction.ride)
              : ""
          }
          inputs={PASSENGER_CANCELLATION_REASONS.map((reason, index) => ({
            type: "radio" as const,
            label: reason.label,
            value: reason.code,
            checked: index === 0,
          }))}
          buttons={[
            {
              text: "Volver",
              role: "cancel",
              handler: () => setPendingCancelAction(null),
            },
            {
              text: "Sí, cancelar",
              role: "destructive",
              handler: (reasonCode) => {
                if (!pendingCancelAction) return false;
                const resolvedPolicy = applyPassengerCancellationReasonToPolicy(
                  pendingCancelAction.policy,
                  reasonCode,
                );
                void performPassengerCancel(
                  pendingCancelAction.ride,
                  pendingCancelAction.rideId,
                  pendingCancelAction.mode,
                  resolvedPolicy,
                );
                return true;
              },
            },
          ]}
          onDidDismiss={() => setPendingCancelAction(null)}
        />

        <IonAlert
          isOpen={refundMercadoPagoAlert !== null}
          header={refundMercadoPagoAlert?.header ?? "Cancelar/devolución"}
          message={refundMercadoPagoAlert?.message ?? ""}
          buttons={[
            {
              text: "Cerrar",
              role: "cancel",
              handler: () => setRefundMercadoPagoAlert(null),
            },
            {
              text: "Cancelar/devolución",
              handler: () => {
                const ride = refundMercadoPagoAlert?.ride;
                setRefundMercadoPagoAlert(null);
                if (ride) openRapaGoCardCancelRefundWhatsApp(ride);
              },
            },
          ]}
          onDidDismiss={() => setRefundMercadoPagoAlert(null)}
        />
</IonContent>
    </IonPage>
  );
}
