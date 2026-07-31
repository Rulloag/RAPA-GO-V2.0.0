import {
  IonAlert,
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonChip,
  IonCol,
  IonContent,
  IonGrid,
  IonHeader,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonRow,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonText,
  IonTextarea,
  IonTitle,
  IonToast,
  IonToolbar,
  useIonViewWillEnter,
} from "@ionic/react";
import { useEffect, useState, useCallback, useRef, type CSSProperties } from "react";
import {
  alertCircleOutline,
  bicycleOutline,
  bookOutline,
  carOutline as carIcon,
  warningOutline,
  cashOutline,
  giftOutline,
  shieldCheckmarkOutline,
  chevronForwardOutline as chevronForward,
} from "ionicons/icons";
import { useHistory } from "react-router-dom";
import {
  dashboardService,
  type DashboardData,
  type ActivityItem as DashActivityItem,
} from "../../features/admin/dashboard.service.js";
import {
  touristService,
  type TouristServiceData,
  type ServiceBookingData,
} from "../../features/tourist/tourist.service.js";
import {
  rentalService,
  type RentalVehicleData,
  type RentalBookingData,
} from "../../features/rental/rental.service.js";
import {
  cardOutline,
  carOutline,
  cloudOfflineOutline,
  compassOutline,
  documentTextOutline,
  keyOutline,
  peopleOutline,
  personOutline,
  settingsOutline,
} from "ionicons/icons";
import { HomeHeader } from "../../components/HomeHeader";
import { ActionCard } from "../../components/ActionCard";
import { ROUTES } from "../../navigation/routes";
import { useAuth } from "../../features/auth";
import {
  walletService,
  type CashOverpaymentBenefitData,
} from "../../features/wallet/wallet.service.js";
import {
  adminService,
  type AdminUserData,
  type AdminDocumentData,
  type AdminRideData,
  type ActiveDriverData,
} from "../../features/admin/admin.service";
import {
  offlineService,
  type OfflineBooking,
} from "../../features/offline/offline.service";
import { RAPAGO_CONTACT, WA_MESSAGES } from "@rapa-go/shared";
import { WhatsAppButton } from "../../components/WhatsAppButton";
import { loadRapaGoGoogleMaps } from "../../components/MapFallback";
import { AccountDeletionAdminPanel } from "../../components/accountDeletion/AccountDeletionAdminPanel.js";
import { CashOverpaymentRefundAdminPanel } from "../../components/payments/CashOverpaymentRefundAdminPanel.js";
import { getApiOrigin as getConfiguredApiOrigin } from "../../services/api/apiBaseUrl.js";

const ADMIN_DRIVERS_ROUTE = "/admin/drivers";
const ADMIN_DRIVERS_REFRESH_EVENT = "rapago:admin-refresh-drivers";
const LOCAL_ADMIN_SCHEDULED_RIDES_KEY = "rapago_admin_scheduled_rides";
const LOCAL_PASSENGER_RIDES_KEY_ADMIN = "rapago_local_passenger_rides";
const LOCAL_DRIVER_ASSIGNED_RIDES_KEY = "rapago_local_driver_assigned_rides";
const LOCAL_DRIVER_SCHEDULED_QUEUE_KEY = "rapago_driver_scheduled_queue";
const LOCAL_DRIVER_RESERVATION_INBOX_KEY = "rapago_driver_reservation_inbox_v1";
const LOCAL_DRIVER_RESERVATION_INBOX_BY_DRIVER_KEY = "rapago_driver_reservation_inbox_by_driver_v1";
const ADMIN_DRIVER_ASSIGNMENT_SELECTION_KEY = "rapago_admin_selected_ride_for_driver_assignment";
const ADMIN_DRIVER_ASSIGNMENT_EVENT = "rapago:admin-driver-assignment-updated";
const DRIVER_ASSIGNED_RIDE_EVENT = "rapago:driver-assigned-scheduled-ride";
const ADMIN_RESERVATION_AUTO_REASSIGN_EVENT = "rapago:admin-reservation-reassign-needed";
const ADMIN_RESERVATION_AUTO_ASSIGN_EVENT = "rapago:admin-reservation-auto-assigned";
const SCHEDULE_ACTIVATION_MINUTES_ADMIN = 30;
const SCHEDULED_CANCELLATION_CHARGE_MINUTES_ADMIN = 30;
const RAPAGO_SUPPORT_WHATSAPP_PHONE = "56947964171";

function cleanPath(path: string): string {
  return path.replace(/\/+$/, "") || "/";
}

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Ahora";
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours}h`;
  return `Hace ${Math.floor(hours / 24)}d`;
}


type AdminCashPaymentDecision = "exact" | "wallet_credit" | "refund_whatsapp" | "driver_overpaid";

type AdminCashPaymentReview = {
  id: string;
  rideId: string;
  rideKey: string;
  originText: string;
  destinationText: string;
  fareClp: number;
  paidClp: number;
  overpaidClp: number;
  decision: AdminCashPaymentDecision;
  status: "completed" | "pending_refund" | "wallet_available" | "pending_driver_review" | string;
  adminReviewStatus?: "not_required" | "pending_admin" | "admin_approved" | "refund_requested" | "refund_completed" | string;
  createdAt: string;
  passengerEmail?: string | null;
  passengerName?: string | null;
  ownerUserId?: string | null;
  driverPaidClp?: number | null;
  driverOverpaidClp?: number | null;
  driverDecision?: "exact" | "overpaid" | string | null;
  driverReportedAt?: string | null;
  driverName?: string | null;
  driverEmail?: string | null;
  passengerPaidClp?: number | null;
  passengerOverpaidClp?: number | null;
  passengerDecision?: AdminCashPaymentDecision | string | null;
  passengerReportedAt?: string | null;
  passengerWantsWalletCredit?: boolean | null;
  passengerWantsRefund?: boolean | null;
  versionDifferenceClp?: number | null;
};

type AdminWalletBenefit = {
  id: string;
  rideId?: string | null;
  passengerEmail?: string | null;
  ownerKey?: string | null;
  ownerUserId?: string | null;
  amountClp: number;
  status: "pending_admin" | "available" | "used" | "rejected" | string;
  source?: string | null;
  title?: string | null;
  description?: string | null;
  createdAt?: string | null;
  approvedAt?: string | null;
  approvedBy?: string | null;
  adminReviewStatus?: string | null;
  fareClp?: number | null;
  paidClp?: number | null;
  driverPaidClp?: number | null;
  passengerPaidClp?: number | null;
  refundWhatsappAvailable?: boolean | null;
  cardRefundRequested?: boolean | null;
  mercadoPagoRefundRequested?: boolean | null;
  mercadoPagoRefundStatus?: string | null;
  cancellationFeeClp?: number | null;
  originText?: string | null;
  destinationText?: string | null;
  paymentId?: string | null;
  paymentMethod?: string | null;
  paymentProvider?: string | null;
};

type AdminPassengerPendingCharge = {
  id: string;
  backendChargeId?: string | null;
  rideId?: string | null;
  rideKey?: string | null;
  passengerEmail?: string | null;
  passengerName?: string | null;
  passengerUserId?: string | null;
  ownerUserId?: string | null;
  originText?: string | null;
  destinationText?: string | null;
  amountClp: number;
  minimumFareClp?: number | null;
  applicableFareClp?: number | null;
  originalServiceAmountClp?: number | null;
  originalNoShowServiceAmountClp?: number | null;
  feePercent?: number | null;
  feeCapClp?: number | null;
  driverSharePercent?: number | null;
  platformSharePercent?: number | null;
  driverShareClp?: number | null;
  platformShareClp?: number | null;
  type?: "late_cancel" | "no_show" | string | null;
  paymentMethod?: string | null;
  status: "pending_admin_review" | "pending_next_ride" | "applied_to_next_ride" | "paid" | "waived" | string;
  adminReviewStatus?: string | null;
  title?: string | null;
  description?: string | null;
  createdAt?: string | null;
  appliedRideId?: string | null;
  appliedAt?: string | null;
  requestedExemption?: boolean | null;
  cancellationReasonCode?: string | null;
  cancellationReasonLabel?: string | null;
  adminDecisionReason?: string | null;
  approvedAt?: string | null;
  approvedBy?: string | null;
  rejectedAt?: string | null;
  rejectedBy?: string | null;
  cardRefundRequested?: boolean | null;
  mercadoPagoRefundStatus?: string | null;
  cardRefundNotice?: string | null;
};

type AdminReservationAutoAssignLogStatus = "assigned" | "waiting_driver" | "skipped" | "error";

type AdminReservationAutoAssignLog = {
  id: string;
  rideId: string;
  rideKey: string;
  status: AdminReservationAutoAssignLogStatus;
  driverId?: string | null;
  driverName?: string | null;
  driverEmail?: string | null;
  message: string;
  createdAt: string;
  updatedAt: string;
};

const RAPAGO_CASH_PAYMENT_REVIEWS_KEY_ADMIN = "rapago_cash_payment_reviews_v1";
const RAPAGO_WALLET_BENEFITS_KEY_ADMIN = "rapago_wallet_benefits_v1";
const RAPAGO_PASSENGER_PENDING_CHARGES_KEY_ADMIN = "rapago_passenger_pending_charges_v1";
const RAPAGO_PASSENGER_PENDING_CHARGE_EVENT_ADMIN = "rapago:passenger-pending-charge-updated";
const RAPAGO_ADMIN_CASH_CLOSURES_EVENT = "rapago:admin-cash-closures-updated";
const RAPAGO_DRIVER_CASH_CLOSURE_EVENT = "rapago:driver-cash-closure-updated";
const RAPAGO_ADMIN_WALLET_BENEFIT_EVENT = "rapago:admin-wallet-benefit-updated";
const RAPAGO_ADMIN_RIDES_EVENT = "rapago:admin-rides-updated";
const RAPAGO_ADMIN_RESERVATION_AUTO_ASSIGN_LOG_KEY = "rapago_admin_reservation_auto_assign_log_v1";


type AdminTripSafetyReportStatus = "arrived_well" | "problem_reported" | "driver_accident_reported";

type AdminTripSafetyReport = {
  id: string;
  rideId: string;
  rideKey: string;
  reporterRole: "passenger" | "driver";
  status: AdminTripSafetyReportStatus;
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

const RAPAGO_TRIP_SAFETY_REPORTS_KEY_ADMIN = "rapago_trip_safety_reports_v1";
const RAPAGO_TRIP_SAFETY_REPORT_EVENT_ADMIN = "rapago:trip-safety-reports-updated";

function sanitizeAdminTripSafetyText(value: unknown, maxLength = 220): string {
  return String(value ?? "")
    .replace(/[<>`{}$\\]/g, "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function readAdminTripSafetyReports(): AdminTripSafetyReport[] {
  try {
    const raw = localStorage.getItem(RAPAGO_TRIP_SAFETY_REPORTS_KEY_ADMIN);
    const parsed = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item) => item && typeof item === "object")
      .map((item, index): AdminTripSafetyReport => ({
        id: sanitizeAdminTripSafetyText(item.id, 120) || `trip-safety-${index}`,
        rideId: sanitizeAdminTripSafetyText(item.rideId, 120),
        rideKey: sanitizeAdminTripSafetyText(item.rideKey, 180),
        reporterRole: String(item.reporterRole ?? "passenger") === "driver" ? "driver" : "passenger",
        status: String(item.status ?? "problem_reported") as AdminTripSafetyReportStatus,
        title: sanitizeAdminTripSafetyText(item.title, 120) || "Reporte de viaje",
        description: sanitizeAdminTripSafetyText(item.description, 280) || "Reporte registrado en la app.",
        passengerEmail: sanitizeAdminTripSafetyText(item.passengerEmail, 160).toLowerCase() || null,
        passengerName: sanitizeAdminTripSafetyText(item.passengerName, 120) || null,
        driverEmail: sanitizeAdminTripSafetyText(item.driverEmail, 160).toLowerCase() || null,
        driverName: sanitizeAdminTripSafetyText(item.driverName, 120) || null,
        originText: sanitizeAdminTripSafetyText(item.originText, 160) || null,
        destinationText: sanitizeAdminTripSafetyText(item.destinationText, 160) || null,
        createdAt: sanitizeAdminTripSafetyText(item.createdAt, 60) || new Date().toISOString(),
        updatedAt: sanitizeAdminTripSafetyText(item.updatedAt, 60) || new Date().toISOString(),
        source: String(item.source ?? "passenger_trips") === "driver_app" ? "driver_app" : "passenger_trips",
        whatsappOpened: Boolean(item.whatsappOpened),
        adminStatus: String(item.adminStatus ?? "pending_admin") as AdminTripSafetyReport["adminStatus"],
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch {
    return [];
  }
}

function writeAdminTripSafetyReports(reports: AdminTripSafetyReport[]): void {
  try {
    localStorage.setItem(RAPAGO_TRIP_SAFETY_REPORTS_KEY_ADMIN, JSON.stringify(reports.slice(0, 300)));
    window.dispatchEvent(new CustomEvent(RAPAGO_TRIP_SAFETY_REPORT_EVENT_ADMIN, { detail: { reports } }));
    window.dispatchEvent(new CustomEvent(RAPAGO_ADMIN_RIDES_EVENT, { detail: { reports } }));
  } catch {
    // No bloquea el panel admin.
  }
}

function markAdminTripSafetyReportResolved(reportId: string): AdminTripSafetyReport[] {
  const now = new Date().toISOString();
  const next = readAdminTripSafetyReports().map((item) => {
    if (String(item.id) !== String(reportId)) return item;
    return {
      ...item,
      adminStatus: "resolved" as const,
      updatedAt: now,
    };
  });

  writeAdminTripSafetyReports(next);
  return next;
}

function adminTripSafetyStatusLabel(report: AdminTripSafetyReport): string {
  if (report.adminStatus === "resolved") return "Resuelto";
  if (report.status === "arrived_well") return "Llegó bien";
  if (report.status === "driver_accident_reported") return "Accidente/emergencia";
  return "Problema pasajero";
}

function adminTripSafetyStatusColor(report: AdminTripSafetyReport): string {
  if (report.adminStatus === "resolved") return "success";
  if (report.status === "arrived_well") return "medium";
  if (report.status === "driver_accident_reported") return "danger";
  return "warning";
}

function formatAdminTripSafetyDate(value: unknown): string {
  const date = new Date(String(value ?? ""));
  if (!Number.isFinite(date.getTime())) return "Sin fecha";
  return date.toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
}


const RAPAGO_ADMIN_CASH_REVIEW_SOURCE_KEYS = [
  RAPAGO_CASH_PAYMENT_REVIEWS_KEY_ADMIN,
  "rapago_driver_cash_closures_v1",
  "rapago_admin_cash_closures_v1",
  "rapago_admin_cash_payment_closures_v1",
  "rapago_last_driver_cash_closure_for_admin",
] as const;

function formatAdminCashClp(value: number | null | undefined): string {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return "$0 CLP";
  return `$${Math.max(0, Math.round(amount)).toLocaleString("es-CL")} CLP`;
}

function readAdminCashStorageRows(key: string): Array<Record<string, unknown>> {
  try {
    const raw = localStorage.getItem(key) || sessionStorage.getItem(key);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
    if (parsed && typeof parsed === "object") {
      const record = parsed as Record<string, unknown>;
      const looksLikeSingle = Boolean(record.rideId || record.rideKey || record.paidClp || record.cashPaidClp || record.paymentReceivedByDriverClp);
      if (looksLikeSingle) return [record];
      return Object.values(record).filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
    }
  } catch {
    return [];
  }

  return [];
}

function adminCashNumber(...values: unknown[]): number {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return Math.round(parsed);
  }
  return 0;
}

function adminCashString(...values: unknown[]): string {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function getAdminCashRideMergeKey(item: Record<string, unknown>): string {
  const rideId = adminCashString(item.rideId, item.idRide, item.originalRideId, item.serverRideId);
  const rideKey = adminCashString(item.rideKey);
  if (rideKey) return rideKey;
  if (rideId) return `ride:${rideId}`;

  return [
    adminCashString(item.passengerEmail).toLowerCase(),
    adminCashString(item.originText).toLowerCase(),
    adminCashString(item.destinationText).toLowerCase(),
    adminCashString(item.completedAt, item.closedByDriverAt, item.createdAt),
  ].join("|");
}

function cashReviewSourceIsDriver(key: string, item: Record<string, unknown>): boolean {
  const decision = String(item.decision ?? item.cashPaymentDecision ?? "").toLowerCase();
  return (
    key.includes("driver_cash") ||
    key.includes("admin_cash_closures") ||
    String(item.id ?? "").startsWith("driver-cash-close") ||
    item.cashPaymentConfirmedByDriver === true ||
    item.driverCashClosure != null ||
    decision === "overpaid"
  );
}

function normalizeAdminCashDecision(value: unknown): AdminCashPaymentDecision {
  const raw = String(value ?? "").toLowerCase().trim();
  if (raw === "wallet_credit") return "wallet_credit";
  if (raw === "refund_whatsapp") return "refund_whatsapp";
  if (raw === "overpaid" || raw === "driver_overpaid") return "driver_overpaid";
  return "exact";
}

function adminCashReviewStatePriority(value: unknown): number {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (!normalized || normalized === "not_required") return 0;

  if (
    normalized === "backend_credit_created" ||
    normalized === "wallet_available" ||
    normalized === "available" ||
    normalized === "approved" ||
    normalized === "admin_approved" ||
    normalized === "refund_completed"
  ) {
    return 100;
  }

  if (
    normalized === "completed" ||
    normalized === "refund_requested"
  ) {
    return 70;
  }

  if (
    normalized === "pending_wallet_admin" ||
    normalized === "pending_admin" ||
    normalized === "pending_refund" ||
    normalized === "pending_driver_review"
  ) {
    return 40;
  }

  return 10;
}

function keepMostAdvancedAdminCashState(
  currentValue: unknown,
  incomingValue: unknown,
): string {
  const current = String(currentValue ?? "").trim();
  const incoming = String(incomingValue ?? "").trim();

  if (!incoming) return current;
  if (!current) return incoming;

  return adminCashReviewStatePriority(incoming) >
    adminCashReviewStatePriority(current)
    ? incoming
    : current;
}

function readAdminCashPaymentReviews(): AdminCashPaymentReview[] {
  const byRideKey: Record<string, AdminCashPaymentReview> = {};

  for (const storageKey of RAPAGO_ADMIN_CASH_REVIEW_SOURCE_KEYS) {
    for (const item of readAdminCashStorageRows(storageKey)) {
      const rideKey = getAdminCashRideMergeKey(item);
      if (!rideKey) continue;

      const rideId = adminCashString(item.rideId, item.originalRideId, rideKey);
      const fareClp = adminCashNumber(item.fareClp, item.cashFareClp, item.priceClp, item.estimatedFareClp);
      const paidClp = adminCashNumber(item.paidClp, item.cashPaidClp, item.paymentReceivedByDriverClp);
      const explicitOverpaid = adminCashNumber(item.overpaidClp, item.cashOverpaidClp, item.paymentDifferenceClp);
      const calculatedOverpaid = paidClp > 0 && fareClp > 0 ? Math.max(0, paidClp - fareClp) : 0;
      const overpaidClp = Math.max(explicitOverpaid, calculatedOverpaid);
      const isDriverSource = cashReviewSourceIsDriver(storageKey, item);
      const decision = normalizeAdminCashDecision(item.decision ?? item.cashPaymentDecision);
      const createdAt = adminCashString(item.createdAt, item.closedByDriverAt, item.completedAt, new Date().toISOString());

      const current = byRideKey[rideKey] ?? {
        id: `cash-review-${rideKey}`,
        rideId: rideId || rideKey,
        rideKey,
        originText: adminCashString(item.originText, "Origen"),
        destinationText: adminCashString(item.destinationText, "Destino"),
        fareClp,
        paidClp,
        overpaidClp,
        decision: "exact" as AdminCashPaymentDecision,
        status: "completed",
        adminReviewStatus: "not_required",
        createdAt,
        passengerEmail: adminCashString(item.passengerEmail, item.email) || null,
        passengerName: adminCashString(item.passengerName, item.userName, item.name) || null,
        ownerUserId:
          adminCashString(
            item.ownerUserId,
            item.passengerUserId,
            item.userId,
            item.requesterUserId,
          ) || null,
      };

      current.rideId = current.rideId || rideId || rideKey;
      current.originText = current.originText || adminCashString(item.originText, "Origen");
      current.destinationText = current.destinationText || adminCashString(item.destinationText, "Destino");
      current.fareClp = Math.max(current.fareClp || 0, fareClp || 0);
      current.passengerEmail = current.passengerEmail || adminCashString(item.passengerEmail, item.email) || null;
      current.passengerName = current.passengerName || adminCashString(item.passengerName, item.userName, item.name) || null;
      current.ownerUserId =
        current.ownerUserId ||
        adminCashString(
          item.ownerUserId,
          item.passengerUserId,
          item.userId,
          item.requesterUserId,
        ) ||
        null;
      current.createdAt = new Date(createdAt).getTime() > new Date(current.createdAt).getTime() ? createdAt : current.createdAt;

      // Conserva el estado administrativo más avanzado. Sin esto, al volver a
      // leer las fuentes locales antiguas, "pending_admin" reemplazaba la
      // confirmación "backend_credit_created" y la tarjeta seguía figurando
      // como pendiente aunque el saldo ya existiera en la cuenta del usuario.
      current.adminReviewStatus = keepMostAdvancedAdminCashState(
        current.adminReviewStatus,
        item.adminReviewStatus,
      );
      current.status = keepMostAdvancedAdminCashState(
        current.status,
        item.status,
      );

      if (isDriverSource) {
        current.driverPaidClp = paidClp || current.driverPaidClp || null;
        current.driverOverpaidClp = overpaidClp || current.driverOverpaidClp || 0;
        current.driverDecision = overpaidClp > 0 || decision === "driver_overpaid" ? "overpaid" : "exact";
        current.driverReportedAt = adminCashString(item.closedByDriverAt, item.createdAt, item.completedAt) || current.driverReportedAt || null;
        current.driverName = adminCashString(item.driverName, item.driverFullName) || current.driverName || null;
        current.driverEmail = adminCashString(item.driverEmail) || current.driverEmail || null;
      } else {
        current.passengerPaidClp = paidClp || current.passengerPaidClp || null;
        current.passengerOverpaidClp = overpaidClp || current.passengerOverpaidClp || 0;
        current.passengerDecision = decision;
        current.passengerReportedAt = adminCashString(item.createdAt, item.updatedAt) || current.passengerReportedAt || null;
        current.passengerWantsWalletCredit = decision === "wallet_credit" || current.passengerWantsWalletCredit || false;
        current.passengerWantsRefund = decision === "refund_whatsapp" || current.passengerWantsRefund || false;
      }

      byRideKey[rideKey] = current;
    }
  }

  return Object.values(byRideKey)
    .map((review) => {
      const driverPaid = Number(review.driverPaidClp ?? 0);
      const passengerPaid = Number(review.passengerPaidClp ?? 0);
      const driverOverpaid = Number(review.driverOverpaidClp ?? 0);
      const passengerOverpaid = Number(review.passengerOverpaidClp ?? 0);
      const versionDifferenceClp = driverPaid > 0 && passengerPaid > 0 ? Math.abs(passengerPaid - driverPaid) : 0;

      const decision: AdminCashPaymentDecision = review.passengerWantsWalletCredit
        ? "wallet_credit"
        : review.passengerWantsRefund
          ? "refund_whatsapp"
          : driverOverpaid > 0 || passengerOverpaid > 0
            ? "driver_overpaid"
            : "exact";

      const adminReviewStatus = review.adminReviewStatus && review.adminReviewStatus !== "not_required"
        ? review.adminReviewStatus
        : decision === "wallet_credit"
          ? "pending_admin"
          : decision === "refund_whatsapp"
            ? "refund_requested"
            : decision === "driver_overpaid"
              ? "pending_admin"
              : "not_required";

      const walletCreditApproved =
        decision === "wallet_credit" &&
        String(adminReviewStatus ?? "").toLowerCase() ===
          "backend_credit_created";

      return {
        ...review,
        paidClp: passengerPaid || driverPaid || review.paidClp || 0,
        overpaidClp: Math.max(passengerOverpaid, driverOverpaid, review.overpaidClp || 0),
        decision,
        status:
          decision === "wallet_credit"
            ? walletCreditApproved
              ? "wallet_available"
              : "pending_wallet_admin"
            : decision === "refund_whatsapp"
              ? isAdminCashRefundCompleted(review)
                ? "completed"
                : "pending_refund"
              : decision === "driver_overpaid"
                ? isAdminCashWalletApproved(review)
                  ? "completed"
                  : "pending_driver_review"
                : "completed",
        adminReviewStatus,
        versionDifferenceClp,
      };
    })
    .filter((review) => review.rideKey || review.rideId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function writeAdminCashPaymentReviews(reviews: AdminCashPaymentReview[]): void {
  try {
    const map = reviews.reduce<Record<string, AdminCashPaymentReview>>((acc, review) => {
      acc[review.rideKey || review.rideId || review.id] = review;
      return acc;
    }, {});
    localStorage.setItem(RAPAGO_CASH_PAYMENT_REVIEWS_KEY_ADMIN, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent("rapago:cash-payment-review-updated", { detail: { reviews } }));
    window.dispatchEvent(new CustomEvent(RAPAGO_ADMIN_CASH_CLOSURES_EVENT, { detail: { reviews } }));
    window.dispatchEvent(new CustomEvent(RAPAGO_ADMIN_RIDES_EVENT, { detail: { reviews } }));
  } catch {
    // No bloquea el panel admin.
  }
}

function readAdminWalletBenefits(): AdminWalletBenefit[] {
  try {
    const raw = localStorage.getItem(RAPAGO_WALLET_BENEFITS_KEY_ADMIN);
    const parsed = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
    if (!Array.isArray(parsed)) return [];

    return parsed.map((item, index) => ({
      id: String(item.id ?? `wallet-benefit-${index}`),
      rideId: typeof item.rideId === "string" ? item.rideId : null,
      passengerEmail: typeof item.passengerEmail === "string" ? item.passengerEmail : null,
      ownerKey: typeof item.ownerKey === "string" ? item.ownerKey : null,
      ownerUserId:
        typeof item.ownerUserId === "string"
          ? item.ownerUserId
          : typeof item.passengerUserId === "string"
            ? item.passengerUserId
            : typeof item.userId === "string"
              ? item.userId
              : null,
      amountClp: Math.max(0, Math.round(Number(item.amountClp ?? item.amount ?? 0))),
      status: String(item.status ?? "pending_admin"),
      source: typeof item.source === "string" ? item.source : null,
      title: typeof item.title === "string" ? item.title : null,
      description: typeof item.description === "string" ? item.description : null,
      createdAt: typeof item.createdAt === "string" ? item.createdAt : null,
      approvedAt: typeof item.approvedAt === "string" ? item.approvedAt : null,
      approvedBy: typeof item.approvedBy === "string" ? item.approvedBy : null,
      adminReviewStatus: typeof item.adminReviewStatus === "string" ? item.adminReviewStatus : null,
      fareClp: Number.isFinite(Number(item.fareClp)) ? Math.round(Number(item.fareClp)) : null,
      paidClp: Number.isFinite(Number(item.paidClp)) ? Math.round(Number(item.paidClp)) : null,
      refundWhatsappAvailable: Boolean(item.refundWhatsappAvailable),
      cardRefundRequested: Boolean(item.cardRefundRequested || item.mercadoPagoRefundRequested),
      mercadoPagoRefundRequested: Boolean(item.mercadoPagoRefundRequested || item.cardRefundRequested),
      mercadoPagoRefundStatus: typeof item.mercadoPagoRefundStatus === "string" ? item.mercadoPagoRefundStatus : null,
      cancellationFeeClp: Number.isFinite(Number(item.cancellationFeeClp)) ? Math.round(Number(item.cancellationFeeClp)) : null,
      originText: typeof item.originText === "string" ? item.originText : null,
      destinationText: typeof item.destinationText === "string" ? item.destinationText : null,
      paymentId: typeof item.paymentId === "string" ? item.paymentId : null,
      paymentMethod: typeof item.paymentMethod === "string" ? item.paymentMethod : null,
      paymentProvider: typeof item.paymentProvider === "string" ? item.paymentProvider : null,
    }));
  } catch {
    return [];
  }
}

function writeAdminWalletBenefits(benefits: AdminWalletBenefit[]): void {
  try {
    localStorage.setItem(RAPAGO_WALLET_BENEFITS_KEY_ADMIN, JSON.stringify(benefits.slice(0, 250)));
    window.dispatchEvent(new CustomEvent("rapago:wallet-benefit-updated", { detail: { benefits } }));
    window.dispatchEvent(new CustomEvent(RAPAGO_ADMIN_WALLET_BENEFIT_EVENT, { detail: { benefits } }));
    window.dispatchEvent(new CustomEvent("rapago:wallet-updated", { detail: { benefits } }));
    window.dispatchEvent(new CustomEvent(RAPAGO_ADMIN_RIDES_EVENT, { detail: { benefits } }));
  } catch {
    // No bloquea el panel admin.
  }
}

function isAdminWalletCardCancellationCredit(benefit: AdminWalletBenefit): boolean {
  const text = [
    benefit.source,
    benefit.title,
    benefit.description,
    benefit.paymentMethod,
    benefit.paymentProvider,
    benefit.mercadoPagoRefundStatus,
  ]
    .map((value) => String(value ?? "").toLowerCase())
    .join(" ");

  return (
    text.includes("card_cancellation_credit") ||
    text.includes("cancelación con tarjeta") ||
    text.includes("cancelacion con tarjeta") ||
    text.includes("mercadopago") ||
    text.includes("tarjeta") ||
    benefit.refundWhatsappAvailable === true ||
    benefit.cardRefundRequested === true ||
    benefit.mercadoPagoRefundRequested === true
  );
}

function isAdminWalletCreditAvailable(benefit: AdminWalletBenefit): boolean {
  const status = String(benefit.status ?? "").toLowerCase();
  const adminStatus = String(benefit.adminReviewStatus ?? "").toLowerCase();

  return (
    status === "available" ||
    status === "approved" ||
    adminStatus === "admin_approved" ||
    adminStatus === "card_credit_available" ||
    adminStatus === "available"
  );
}

function isAdminWalletCreditPending(benefit: AdminWalletBenefit): boolean {
  const status = String(benefit.status ?? "").toLowerCase();
  const adminStatus = String(benefit.adminReviewStatus ?? "").toLowerCase();

  return status === "pending_admin" || adminStatus === "pending_admin";
}

function isAdminWalletCreditRefundCompleted(benefit: AdminWalletBenefit): boolean {
  const status = String(benefit.status ?? "").toLowerCase();
  const adminStatus = String(benefit.adminReviewStatus ?? "").toLowerCase();

  return status === "refund_completed" || adminStatus === "refund_completed";
}

function adminWalletCreditStatusLabel(benefit: AdminWalletBenefit): string {
  if (isAdminWalletCreditRefundCompleted(benefit)) return "Devolución gestionada";
  if (isAdminWalletCreditPending(benefit)) return "Pendiente admin";
  if (isAdminWalletCreditAvailable(benefit)) {
    return isAdminWalletCardCancellationCredit(benefit)
      ? "Aprobado por admin"
      : "Disponible en wallet";
  }
  if (String(benefit.status ?? "").toLowerCase() === "used") return "Usado";
  return benefit.status || "Crédito";
}

function adminWalletCreditStatusColor(benefit: AdminWalletBenefit): string {
  if (isAdminWalletCreditRefundCompleted(benefit)) return "success";
  if (isAdminWalletCreditPending(benefit)) return "warning";
  if (isAdminWalletCreditAvailable(benefit)) return "success";
  if (String(benefit.status ?? "").toLowerCase() === "used") return "medium";
  return "tertiary";
}

function normalizeAdminWalletCreditExternalReference(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9:_-]/g, "-")
    .slice(0, 80);
}

function adminWalletCreditUuidOrUndefined(value: unknown): string | undefined {
  const text = String(value ?? "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
    ? text
    : undefined;
}

function markAdminWalletCreditRefundCompleted(benefit: AdminWalletBenefit): void {
  const now = new Date().toISOString();
  const next = readAdminWalletBenefits().map((item) => {
    if (item.id !== benefit.id) return item;

    return {
      ...item,
      status: "refund_completed",
      adminReviewStatus: "refund_completed",
      approvedAt: item.approvedAt ?? now,
      approvedBy: item.approvedBy ?? "admin",
      refundCompletedAt: now,
      title: "DEVOLUCIÓN DE TARJETA",
    } as AdminWalletBenefit & Record<string, unknown>;
  });

  writeAdminWalletBenefits(next);
}

function normalizeAdminSupportWhatsAppPhone(phone: string): string {
  const digits = String(phone ?? "").replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15 ? digits : "56947964171";
}

function sanitizeAdminSupportText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s._-]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 80);
}

function buildAdminSupportFolio(parts: unknown[]): string {
  const raw = parts.map((value) => String(value ?? "").trim()).filter(Boolean).join("|");
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 31 + raw.charCodeAt(i)) | 0;
  }
  return `RPG-${Math.abs(hash).toString(36).toUpperCase().padStart(6, "0").slice(0, 6)}`;
}

function formatAdminSupportDate(value: unknown): string | null {
  const time = new Date(String(value ?? "")).getTime();
  if (!Number.isFinite(time)) return null;
  return new Date(time).toLocaleDateString("es-CL");
}

function buildAdminWalletCreditRefundWhatsAppUrl(benefit: AdminWalletBenefit): string {
  const record = benefit as AdminWalletBenefit & Record<string, unknown>;
  const phone = normalizeAdminSupportWhatsAppPhone(RAPAGO_SUPPORT_WHATSAPP_PHONE);
  const folio = buildAdminSupportFolio([
    record["id"],
    record["rideId"],
    record["paymentId"],
    record["createdAt"],
    record["source"],
  ]);
  const provider = sanitizeAdminSupportText(record["paymentProvider"]);
  const method = sanitizeAdminSupportText(record["paymentMethod"]);
  const supportDate = formatAdminSupportDate(record["createdAt"]);

  const lines = [
    "Soporte RAPA GO: solicitud de revisión de devolución de tarjeta.",
    `Folio: ${folio}`,
    provider ? `Proveedor: ${provider}` : null,
    method ? `Medio de pago: ${method}` : null,
    supportDate ? `Fecha solicitud: ${supportDate}` : null,
    "Revisar detalle en panel admin autenticado.",
  ].filter(Boolean);

  return `https://wa.me/${phone}?text=${encodeURIComponent(lines.join("\n"))}`;
}

function openAdminWalletCreditRefundWhatsApp(benefit: AdminWalletBenefit): void {
  const url = buildAdminWalletCreditRefundWhatsAppUrl(benefit);

  try {
    window.open(url, "_blank", "noopener,noreferrer");
  } catch {
    window.location.href = url;
  }
}


function readAdminPassengerPendingCharges(): AdminPassengerPendingCharge[] {
  try {
    const raw = localStorage.getItem(RAPAGO_PASSENGER_PENDING_CHARGES_KEY_ADMIN);
    const parsed = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item, index): AdminPassengerPendingCharge => ({
        id: String(item.id ?? `pending-charge-${index}`),
        backendChargeId:
          typeof item.backendChargeId === "string"
            ? item.backendChargeId
            : typeof item.id === "string" &&
                /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(item.id)
              ? item.id
              : null,
        rideId: typeof item.rideId === "string" ? item.rideId : null,
        rideKey: typeof item.rideKey === "string" ? item.rideKey : null,
        passengerEmail: typeof item.passengerEmail === "string" ? item.passengerEmail : null,
        passengerName: typeof item.passengerName === "string" ? item.passengerName : null,
        passengerUserId:
          typeof item.passengerUserId === "string"
            ? item.passengerUserId
            : typeof item.userId === "string"
              ? item.userId
              : null,
        ownerUserId:
          typeof item.ownerUserId === "string"
            ? item.ownerUserId
            : typeof item.passengerUserId === "string"
              ? item.passengerUserId
              : typeof item.userId === "string"
                ? item.userId
                : null,
        originText: typeof item.originText === "string" ? item.originText : null,
        destinationText: typeof item.destinationText === "string" ? item.destinationText : null,
        amountClp: Math.max(0, Math.round(Number(item.amountClp ?? item.amount ?? 0))),
        minimumFareClp: Number.isFinite(Number(item.minimumFareClp)) ? Math.round(Number(item.minimumFareClp)) : null,
        applicableFareClp: Number.isFinite(Number(item.applicableFareClp)) ? Math.round(Number(item.applicableFareClp)) : null,
        originalServiceAmountClp: Number.isFinite(Number(item.originalServiceAmountClp)) ? Math.round(Number(item.originalServiceAmountClp)) : null,
        originalNoShowServiceAmountClp: Number.isFinite(Number(item.originalNoShowServiceAmountClp)) ? Math.round(Number(item.originalNoShowServiceAmountClp)) : null,
        feePercent: Number.isFinite(Number(item.feePercent)) ? Number(item.feePercent) : null,
        feeCapClp: Number.isFinite(Number(item.feeCapClp)) ? Math.round(Number(item.feeCapClp)) : null,
        driverSharePercent: item.driverSharePercent != null && Number.isFinite(Number(item.driverSharePercent)) ? Number(item.driverSharePercent) : null,
        platformSharePercent: item.platformSharePercent != null && Number.isFinite(Number(item.platformSharePercent)) ? Number(item.platformSharePercent) : null,
        driverShareClp: item.driverShareClp != null && Number.isFinite(Number(item.driverShareClp)) ? Math.round(Number(item.driverShareClp)) : null,
        platformShareClp: item.platformShareClp != null && Number.isFinite(Number(item.platformShareClp)) ? Math.round(Number(item.platformShareClp)) : null,
        type: typeof item.type === "string" ? item.type : null,
        paymentMethod: typeof item.paymentMethod === "string" ? item.paymentMethod : null,
        status: String(item.status ?? "pending_admin_review"),
        adminReviewStatus: typeof item.adminReviewStatus === "string" ? item.adminReviewStatus : null,
        title: typeof item.title === "string" ? item.title : null,
        description: typeof item.description === "string" ? item.description : null,
        createdAt: typeof item.createdAt === "string" ? item.createdAt : null,
        appliedRideId: typeof item.appliedRideId === "string" ? item.appliedRideId : null,
        appliedAt: typeof item.appliedAt === "string" ? item.appliedAt : null,
        requestedExemption: Boolean(item.requestedExemption),
        cancellationReasonCode: typeof item.cancellationReasonCode === "string" ? item.cancellationReasonCode : null,
        cancellationReasonLabel: typeof item.cancellationReasonLabel === "string" ? item.cancellationReasonLabel : null,
        adminDecisionReason: typeof item.adminDecisionReason === "string" ? item.adminDecisionReason : null,
        approvedAt: typeof item.approvedAt === "string" ? item.approvedAt : null,
        approvedBy: typeof item.approvedBy === "string" ? item.approvedBy : null,
        rejectedAt: typeof item.rejectedAt === "string" ? item.rejectedAt : null,
        rejectedBy: typeof item.rejectedBy === "string" ? item.rejectedBy : null,
        cardRefundRequested: Boolean(item.cardRefundRequested || item.mercadoPagoRefundRequested),
        mercadoPagoRefundStatus: typeof item.mercadoPagoRefundStatus === "string" ? item.mercadoPagoRefundStatus : null,
        cardRefundNotice: typeof item.cardRefundNotice === "string" ? item.cardRefundNotice : null,
      }))
      .filter((charge) => charge.amountClp > 0)
      .sort((a, b) => new Date(String(b.createdAt ?? 0)).getTime() - new Date(String(a.createdAt ?? 0)).getTime());
  } catch {
    return [];
  }
}

function writeAdminPassengerPendingCharges(charges: AdminPassengerPendingCharge[]): void {
  try {
    localStorage.setItem(RAPAGO_PASSENGER_PENDING_CHARGES_KEY_ADMIN, JSON.stringify(charges.slice(0, 250)));
    window.dispatchEvent(new CustomEvent(RAPAGO_PASSENGER_PENDING_CHARGE_EVENT_ADMIN, { detail: { charges } }));
    window.dispatchEvent(new CustomEvent(RAPAGO_ADMIN_RIDES_EVENT, { detail: { charges } }));
    window.dispatchEvent(new CustomEvent("rapago:wallet-updated", { detail: { charges } }));
  } catch {
    // No bloquea el panel admin.
  }
}


type BackendAdminPolicyCharge = {
  id: string;
  sourceRideId: string;
  ownerUserId: string;
  ownerName: string | null;
  ownerEmail: string | null;
  type: "late_cancellation" | "no_show";
  status: string;
  paymentMethod: string | null;
  applicableFareClp: number;
  feePercent: number;
  feeCapClp: number;
  calculatedAmountClp: number;
  approvedAmountClp: number | null;
  amountClp: number;
  driverSharePercent: number | null;
  platformSharePercent: number | null;
  driverShareClp: number | null;
  platformShareClp: number | null;
  reason: string | null;
  adminDecisionReason: string | null;
  appliedToRideId: string | null;
  appliedAt: string | null;
  createdAt: string;
};

function getAdminPolicyChargeApiBaseUrl(): string {
  return getConfiguredApiOrigin();
}

function adminPolicyChargeIsUuid(value: unknown): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value ?? "").trim(),
  );
}

function mapBackendPolicyChargeToAdmin(
  item: BackendAdminPolicyCharge,
): AdminPassengerPendingCharge {
  const backendStatus = String(item.status ?? "").toLowerCase();

  const status =
    backendStatus === "approved_pending_next_ride"
      ? "pending_next_ride"
      : backendStatus === "attached_to_next_ride"
        ? "applied_to_next_ride"
        : backendStatus === "waived"
          ? "waived"
          : "pending_admin_review";

  const adminReviewStatus =
    backendStatus === "approved_pending_next_ride"
      ? "charge_pending_next_ride"
      : backendStatus === "attached_to_next_ride"
        ? "applied_to_next_ride"
        : backendStatus === "waived"
          ? "waived"
          : "pending_admin_review";

  return {
    id: item.id,
    backendChargeId: item.id,
    rideId: item.sourceRideId,
    rideKey: `ride:${item.sourceRideId}`,
    passengerUserId: item.ownerUserId,
    ownerUserId: item.ownerUserId,
    passengerName: item.ownerName,
    passengerEmail: item.ownerEmail,
    amountClp: Math.max(
      0,
      Math.round(
        Number(
          item.approvedAmountClp ??
            item.amountClp ??
            item.calculatedAmountClp ??
            0,
        ),
      ),
    ),
    applicableFareClp: item.applicableFareClp,
    originalServiceAmountClp: item.applicableFareClp,
    originalNoShowServiceAmountClp:
      item.type === "no_show"
        ? item.applicableFareClp
        : null,
    feePercent: item.feePercent,
    feeCapClp: item.feeCapClp,
    driverSharePercent: item.driverSharePercent,
    platformSharePercent: item.platformSharePercent,
    driverShareClp: item.driverShareClp,
    platformShareClp: item.platformShareClp,
    type:
      item.type === "no_show"
        ? "no_show"
        : "late_cancel",
    paymentMethod: item.paymentMethod,
    status,
    adminReviewStatus,
    title:
      item.type === "no_show"
        ? "No show"
        : "Cargo por cancelación",
    description:
      item.adminDecisionReason ??
      item.reason ??
      (item.type === "no_show"
        ? "No Show pendiente de revisión administrativa."
        : "Cancelación desde el tercer minuto pendiente de revisión administrativa."),
    createdAt: item.createdAt,
    appliedRideId: item.appliedToRideId,
    appliedAt: item.appliedAt,
    cancellationReasonLabel: item.reason,
    adminDecisionReason: item.adminDecisionReason,
    approvedAt:
      backendStatus === "approved_pending_next_ride"
        ? item.createdAt
        : null,
    approvedBy:
      backendStatus === "approved_pending_next_ride"
        ? "admin"
        : null,
  };
}

function mergeAdminBackendPolicyCharges(
  backendCharges: AdminPassengerPendingCharge[],
): AdminPassengerPendingCharge[] {
  const current = readAdminPassengerPendingCharges();
  const byKey = new Map<string, AdminPassengerPendingCharge>();

  for (const charge of current) {
    const key = `${String(charge.rideId ?? charge.rideKey ?? charge.id)}:${String(charge.type ?? "")}`;
    byKey.set(key, charge);
  }

  for (const charge of backendCharges) {
    const key = `${String(charge.rideId ?? charge.rideKey ?? charge.id)}:${String(charge.type ?? "")}`;
    byKey.set(key, {
      ...byKey.get(key),
      ...charge,
    });
  }

  const merged = [...byKey.values()].sort(
    (a, b) =>
      new Date(String(b.createdAt ?? 0)).getTime() -
      new Date(String(a.createdAt ?? 0)).getTime(),
  );

  writeAdminPassengerPendingCharges(merged);
  return merged;
}

async function fetchAdminBackendPolicyCharges(
  accessToken: string,
): Promise<AdminPassengerPendingCharge[]> {
  const response = await fetch(
    `${getAdminPolicyChargeApiBaseUrl()}/api/rides/admin/policy-charges`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    },
  );

  const payload = (await response
    .json()
    .catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    throw new Error(
      typeof payload.message === "string"
        ? payload.message
        : "No se pudieron cargar los cargos del backend.",
    );
  }

  const rows = Array.isArray(payload.data)
    ? payload.data
    : [];

  return rows
    .filter(
      (item): item is BackendAdminPolicyCharge =>
        Boolean(item && typeof item === "object"),
    )
    .map(mapBackendPolicyChargeToAdmin);
}

async function approveAdminPassengerChargeInBackend(
  accessToken: string,
  charge: AdminPassengerPendingCharge,
): Promise<AdminPassengerPendingCharge> {
  const calculation = calculateAdminPassengerChargeAmount(charge);
  const backendId =
    charge.backendChargeId ??
    (adminPolicyChargeIsUuid(charge.id)
      ? charge.id
      : null);

  const canApproveExisting =
    Boolean(backendId) &&
    adminPolicyChargeIsUuid(backendId);

  const endpoint = canApproveExisting
    ? `${getAdminPolicyChargeApiBaseUrl()}/api/rides/admin/policy-charges/${backendId}/approve`
    : `${getAdminPolicyChargeApiBaseUrl()}/api/rides/admin/policy-charges/upsert-approve`;

  if (
    !canApproveExisting &&
    !adminPolicyChargeIsUuid(charge.rideId)
  ) {
    throw new Error(
      "El cargo no tiene un ID de viaje válido para guardarlo en el backend.",
    );
  }

  const body = canApproveExisting
    ? {
        approvedAmountClp: calculation.amountClp,
        adminDecisionReason:
          "Cargo aprobado por administración tras validar la política.",
      }
    : {
        rideId: charge.rideId,
        type: isAdminNoShowCharge(charge)
          ? "no_show"
          : "late_cancellation",
        amountClp: calculation.amountClp,
        applicableFareClp: calculation.applicableFareClp,
        paymentMethod: charge.paymentMethod ?? undefined,
        reason:
          charge.cancellationReasonLabel ??
          charge.description ??
          undefined,
        adminDecisionReason:
          "Cargo aprobado por administración tras validar la política.",
      };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  const payload = (await response
    .json()
    .catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    throw new Error(
      typeof payload.message === "string"
        ? payload.message
        : "No se pudo aprobar el cargo en el backend.",
    );
  }

  const data =
    payload.data && typeof payload.data === "object"
      ? (payload.data as BackendAdminPolicyCharge)
      : (payload as unknown as BackendAdminPolicyCharge);

  const mapped = mapBackendPolicyChargeToAdmin(data);
  mergeAdminBackendPolicyCharges([mapped]);
  return mapped;
}



type AdminPassengerIdentitySource = {
  rideId?: string | null;
  rideKey?: string | null;
  passengerUserId?: string | null;
  ownerUserId?: string | null;
  passengerName?: string | null;
  passengerEmail?: string | null;
  originText?: string | null;
  destinationText?: string | null;
};

function normalizeAdminIdentityText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function adminIdentityValue(
  record: Record<string, unknown> | null | undefined,
  keys: string[],
): string {
  if (!record) return "";

  for (const key of keys) {
    const value = String(record[key] ?? "").trim();
    if (value) return value;
  }

  return "";
}

function getAdminUserCompleteName(user: AdminUserData | undefined): string {
  if (!user) return "";

  const record = user as unknown as Record<string, unknown>;
  const direct = adminIdentityValue(record, [
    "fullName",
    "name",
    "displayName",
    "userName",
    "legalName",
  ]);

  if (direct) return direct;

  const firstName = adminIdentityValue(record, [
    "firstName",
    "givenName",
    "names",
  ]);
  const lastName = adminIdentityValue(record, [
    "lastName",
    "familyName",
    "surname",
    "lastNames",
  ]);

  return [firstName, lastName].filter(Boolean).join(" ").trim();
}

function getAdminRideIdentityIds(
  ride: AdminRideData | undefined,
): string[] {
  if (!ride) return [];

  const record = ride as unknown as Record<string, unknown>;
  return [
    record.id,
    record.rideId,
    record.originalRideId,
    record.serverRideId,
    record.requestId,
  ]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
}

function findAdminRideForPassengerIdentity(
  source: AdminPassengerIdentitySource,
  rides: AdminRideData[],
): AdminRideData | undefined {
  const sourceIds = new Set(
    [source.rideId, source.rideKey]
      .map((value) => String(value ?? "").trim().replace(/^ride:/i, ""))
      .filter(Boolean),
  );

  if (sourceIds.size > 0) {
    const byId = rides.find((ride) =>
      getAdminRideIdentityIds(ride).some((id) => sourceIds.has(id)),
    );

    if (byId) return byId;
  }

  const origin = normalizeAdminIdentityText(source.originText);
  const destination = normalizeAdminIdentityText(source.destinationText);
  const email = normalizeAdminIdentityText(source.passengerEmail);

  if (!origin || !destination) return undefined;

  return rides.find((ride) => {
    const record = ride as unknown as Record<string, unknown>;
    const rideOrigin = normalizeAdminIdentityText(record.originText);
    const rideDestination = normalizeAdminIdentityText(record.destinationText);

    if (rideOrigin !== origin || rideDestination !== destination) return false;
    if (!email) return true;

    const rideEmail = normalizeAdminIdentityText(
      adminIdentityValue(record, [
        "passengerEmail",
        "userEmail",
        "email",
      ]),
    );

    return !rideEmail || rideEmail === email;
  });
}

function resolveAdminPassengerIdentity(
  source: AdminPassengerIdentitySource,
  users: AdminUserData[],
  rides: AdminRideData[],
): {
  userId: string;
  fullName: string;
  email: string;
} {
  const matchedRide = findAdminRideForPassengerIdentity(source, rides);
  const rideRecord = matchedRide
    ? (matchedRide as unknown as Record<string, unknown>)
    : undefined;

  const userId =
    String(source.ownerUserId ?? source.passengerUserId ?? "").trim() ||
    adminIdentityValue(rideRecord, [
      "passengerUserId",
      "ownerUserId",
      "userId",
      "requesterUserId",
    ]);

  const sourceEmail = String(source.passengerEmail ?? "").trim().toLowerCase();
  const rideEmail = adminIdentityValue(rideRecord, [
    "passengerEmail",
    "userEmail",
    "email",
  ]).toLowerCase();
  const email = sourceEmail || rideEmail;

  const matchedUser = users.find((user) => {
    const record = user as unknown as Record<string, unknown>;
    const candidateId = adminIdentityValue(record, ["id", "userId", "uid"]);
    const candidateEmail = adminIdentityValue(record, ["email", "mail"])
      .toLowerCase();

    if (userId && candidateId === userId) return true;
    return Boolean(email && candidateEmail === email);
  });

  const rideName = adminIdentityValue(rideRecord, [
    "passengerFullName",
    "passengerName",
    "userFullName",
    "userName",
    "customerName",
  ]);

  const fullName =
    getAdminUserCompleteName(matchedUser) ||
    rideName ||
    String(source.passengerName ?? "").trim() ||
    email ||
    "Usuario sin nombre informado";

  return {
    userId:
      userId ||
      adminIdentityValue(
        matchedUser as unknown as Record<string, unknown> | undefined,
        ["id", "userId", "uid"],
      ),
    fullName,
    email:
      email ||
      adminIdentityValue(
        matchedUser as unknown as Record<string, unknown> | undefined,
        ["email", "mail"],
      ).toLowerCase(),
  };
}

function AdminPassengerIdentityBlock({
  source,
  users,
  rides,
  compact = false,
}: {
  source: AdminPassengerIdentitySource;
  users: AdminUserData[];
  rides: AdminRideData[];
  compact?: boolean;
}): JSX.Element {
  const identity = resolveAdminPassengerIdentity(source, users, rides);

  return (
    <div
      style={{
        marginTop: compact ? 3 : 6,
        color: "#374151",
        fontWeight: 800,
        lineHeight: 1.35,
        minWidth: 0,
      }}
    >
      <div
        style={{
          color: "#111827",
          fontWeight: 950,
          fontSize: compact ? ".78rem" : ".88rem",
          overflowWrap: "anywhere",
        }}
      >
        Usuario: {identity.fullName}
      </div>

      {identity.email && (
        <div
          style={{
            marginTop: 2,
            fontSize: compact ? ".68rem" : ".74rem",
            overflowWrap: "anywhere",
          }}
        >
          Correo: {identity.email}
        </div>
      )}

      {identity.userId && (
        <div
          style={{
            marginTop: 1,
            color: "#6b7280",
            fontSize: ".64rem",
            overflowWrap: "anywhere",
          }}
        >
          Cuenta: {identity.userId}
        </div>
      )}
    </div>
  );
}

function isAdminPassengerChargePending(charge: AdminPassengerPendingCharge): boolean {
  if (isAdminNoShowPendingReview(charge)) return true;

  const status = String(charge.status ?? "").toLowerCase();
  const adminStatus = String(charge.adminReviewStatus ?? "").toLowerCase();

  return (
    status === "pending_next_ride" ||
    status === "pending_admin_review" ||
    status === "backend_review_required" ||
    status === "pending_admin_review" ||
    adminStatus === "backend_review_required" ||
    adminStatus === "pending_admin_review" ||
    adminStatus === "pending_exemption_review" ||
    adminStatus === "charge_pending_next_ride"
  );
}

function isAdminPassengerChargeAwaitingDecision(
  charge: AdminPassengerPendingCharge,
): boolean {
  const status = String(charge.status ?? "").toLowerCase();
  const adminStatus = String(charge.adminReviewStatus ?? "").toLowerCase();

  return (
    status === "pending_admin_review" ||
    status === "backend_review_required" ||
    status === "pending_admin_review" ||
    adminStatus === "pending_admin_review" ||
    adminStatus === "pending_exemption_review" ||
    adminStatus === "backend_review_required"
  );
}

function adminPassengerChargeStatusLabel(charge: AdminPassengerPendingCharge): string {
  const status = String(charge.status ?? "").toLowerCase();
  const adminStatus = String(charge.adminReviewStatus ?? "").toLowerCase();

  if (isAdminNoShowPendingReview(charge)) return "No show por revisar";
  if (adminStatus === "pending_exemption_review") return "Exención por revisar";
  if (status === "pending_admin_review" || adminStatus === "pending_admin_review") return "Cargo por revisar";
  if (isAdminNoShowCharge(charge) && adminStatus === "charge_pending_next_ride") return "Aprobado próximo viaje";

  if (status === "charged_from_card_or_paid_amount" || adminStatus === "no_show_total_service_charged") {
    return "Cobrado desde tarjeta/pago";
  }
  if (status === "pending_next_ride") return "Pendiente próximo viaje";
  if (status === "applied_to_next_ride") return "Agregado a próximo viaje";
  if (status === "paid") return "Pagado";
  if (status === "waived") return "Rechazado";
  return charge.status || "Pendiente";
}

function adminPassengerChargeStatusColor(charge: AdminPassengerPendingCharge): string {
  const status = String(charge.status ?? "").toLowerCase();
  const adminStatus = String(charge.adminReviewStatus ?? "").toLowerCase();

  if (isAdminNoShowPendingReview(charge)) return "warning";
  if (isAdminNoShowCharge(charge) && adminStatus === "charge_pending_next_ride") return "success";

  if (status === "charged_from_card_or_paid_amount" || adminStatus === "no_show_total_service_charged") return "success";
  if (status === "pending_next_ride") return "danger";
  if (status === "applied_to_next_ride" || status === "paid") return "success";
  if (status === "waived") return "medium";
  return "warning";
}

function isAdminPassengerChargePaidFromCard(charge: AdminPassengerPendingCharge): boolean {
  const status = String(charge.status ?? "").toLowerCase();
  const adminStatus = String(charge.adminReviewStatus ?? "").toLowerCase();

  // El medio de pago por sí solo no demuestra que el cargo fue cobrado.
  // Solo estados confirmados por backend/admin se consideran pagados.
  return (
    status === "charged_from_card_or_paid_amount" ||
    status === "paid" ||
    adminStatus === "charged_from_card_or_paid_amount" ||
    adminStatus === "no_show_charge_paid" ||
    adminStatus === "late_cancel_charge_paid"
  );
}

function adminPassengerChargeTypeLabel(charge: AdminPassengerPendingCharge): string {
  if (String(charge.type ?? "").toLowerCase() === "no_show") {
    return "No show · 50% (tope $5.000)";
  }

  return "Cancelación · 30% (tope $3.000)";
}

function adminPassengerChargeBillingLabel(charge: AdminPassengerPendingCharge): string {
  const status = String(charge.status ?? "").toLowerCase();
  const adminStatus = String(charge.adminReviewStatus ?? "").toLowerCase();

  if (status === "applied_to_next_ride") return "Ya fue sumado";
  if (status === "paid") return "Pagado";
  if (status === "waived") return "Anulado";

  if (
    status === "pending_admin_review" ||
    status === "backend_review_required" ||
    adminStatus === "pending_admin_review" ||
    adminStatus === "backend_review_required"
  ) {
    return "Pendiente aprobación";
  }

  return "Próximo viaje";
}

function markAdminPassengerChargeStatus(
  charge: AdminPassengerPendingCharge,
  status: "paid" | "waived",
  adminDecisionReason = "",
): void {
  const now = new Date().toISOString();
  const safeReason = sanitizeAdminTripSafetyText(adminDecisionReason, 260);
  const next = readAdminPassengerPendingCharges().map((item) => {
    if (item.id !== charge.id) return item;
    return {
      ...item,
      status,
      adminReviewStatus: status,
      appliedAt: status === "paid" ? (item.appliedAt ?? now) : item.appliedAt,
      adminDecisionReason:
        safeReason ||
        item.adminDecisionReason ||
        (status === "waived"
          ? "Cargo eximido por administración tras revisión."
          : "Pago confirmado por administración."),
      rejectedAt: status === "waived" ? now : item.rejectedAt,
      rejectedBy: status === "waived" ? "admin" : item.rejectedBy,
      approvedAt: status === "paid" ? (item.approvedAt ?? now) : item.approvedAt,
      approvedBy: status === "paid" ? (item.approvedBy ?? "admin") : item.approvedBy,
    };
  });

  writeAdminPassengerPendingCharges(next);
}

function calculateAdminPassengerChargeAmount(
  charge: AdminPassengerPendingCharge,
): {
  amountClp: number;
  applicableFareClp: number;
  percent: number;
  capClp: number;
} {
  const isNoShow = isAdminNoShowCharge(charge);
  const chargeRecord = charge as AdminPassengerPendingCharge & Record<string, unknown>;
  const applicableFareClp = Math.max(
    0,
    Math.round(
      Number(
        charge.applicableFareClp ??
        charge.originalNoShowServiceAmountClp ??
        charge.originalServiceAmountClp ??
        chargeRecord.totalServiceAmountClp ??
        chargeRecord.serviceAmountClp ??
        chargeRecord.fareClp ??
        chargeRecord.originalAmountClp ??
        charge.amountClp ??
        0,
      ),
    ),
  );
  const percent = isNoShow ? 50 : 30;
  const capClp = isNoShow ? 5000 : 3000;
  const amountClp = Math.min(
    capClp,
    Math.max(0, Math.round(applicableFareClp * (percent / 100))),
  );

  return { amountClp, applicableFareClp, percent, capClp };
}

function getAdminNoShowDistribution(
  charge: AdminPassengerPendingCharge,
): {
  driverShareClp: number;
  platformShareClp: number;
} {
  const amountClp = Math.max(
    0,
    Math.round(Number(charge.amountClp ?? 0)),
  );

  const driverShareClp =
    charge.driverShareClp != null &&
    Number.isFinite(Number(charge.driverShareClp))
      ? Math.max(0, Math.round(Number(charge.driverShareClp)))
      : Math.floor(amountClp / 2);

  const platformShareClp =
    charge.platformShareClp != null &&
    Number.isFinite(Number(charge.platformShareClp))
      ? Math.max(0, Math.round(Number(charge.platformShareClp)))
      : Math.max(0, amountClp - driverShareClp);

  return {
    driverShareClp,
    platformShareClp,
  };
}

function approveAdminPassengerChargeForNextRide(
  charge: AdminPassengerPendingCharge,
): void {
  const now = new Date().toISOString();
  const calculation = calculateAdminPassengerChargeAmount(charge);
  if (calculation.amountClp <= 0) {
    throw new Error("No existe una tarifa aplicable válida para aprobar el cargo.");
  }

  const next = readAdminPassengerPendingCharges().map((item) => {
    if (String(item.id ?? "") !== String(charge.id ?? "")) return item;

    return {
      ...item,
      amountClp: calculation.amountClp,
      applicableFareClp: calculation.applicableFareClp,
      feePercent: calculation.percent,
      feeCapClp: calculation.capClp,
      driverSharePercent: isAdminNoShowCharge(item) ? 50 : null,
      platformSharePercent: isAdminNoShowCharge(item) ? 50 : null,
      driverShareClp: isAdminNoShowCharge(item)
        ? Math.floor(calculation.amountClp / 2)
        : null,
      platformShareClp: isAdminNoShowCharge(item)
        ? calculation.amountClp - Math.floor(calculation.amountClp / 2)
        : null,
      status: "pending_next_ride",
      adminReviewStatus: "charge_pending_next_ride",
      requestedExemption: Boolean(item.requestedExemption),
      appliedRideId: null,
      appliedAt: null,
      approvedAt: now,
      approvedBy: "admin",
      rejectedAt: null,
      rejectedBy: null,
      adminDecisionReason: item.requestedExemption
        ? "Administrador revisó la solicitud de exención y aprobó el cargo."
        : "Cargo aprobado por administración tras validar la política.",
      backendAuthorityRequired: true,
      localStorageFinancialAuthority: false,
      title: isAdminNoShowCharge(item)
        ? "No show aprobado"
        : "Cargo por cancelación aprobado",
      description: isAdminNoShowCharge(item)
        ? `No show aprobado: ${calculation.percent}% de la tarifa aplicable, con tope de $${calculation.capClp.toLocaleString("es-CL")}. Cargo aprobado: $${calculation.amountClp.toLocaleString("es-CL")} CLP. Distribución: 50% conductor y 50% Rapa Go.`
        : `Cancelación aprobada: ${calculation.percent}% de la tarifa aplicable, con tope de $${calculation.capClp.toLocaleString("es-CL")}. Cargo aprobado: $${calculation.amountClp.toLocaleString("es-CL")} CLP.`,
    } as AdminPassengerPendingCharge;
  });

  writeAdminPassengerPendingCharges(next);
  window.dispatchEvent(new CustomEvent("rapago:admin-passenger-pending-charge-updated", { detail: { charges: next } }));
  window.dispatchEvent(new CustomEvent("rapago:passenger-pending-charge-updated", { detail: { charges: next } }));
  window.dispatchEvent(new CustomEvent("rapago:wallet-updated", { detail: { charges: next } }));
}

function isAdminNoShowCharge(charge: AdminPassengerPendingCharge): boolean {
  const type = String(charge.type ?? "").toLowerCase();
  const title = String(charge.title ?? "").toLowerCase();
  const description = String(charge.description ?? "").toLowerCase();
  const source = String((charge as Record<string, unknown>).source ?? "").toLowerCase();

  return (
    type === "no_show" ||
    source.includes("no_show") ||
    source.includes("driver_no_show") ||
    title.includes("no show") ||
    description.includes("no show")
  );
}

function isAdminNoShowPendingReview(charge: AdminPassengerPendingCharge): boolean {
  if (!isAdminNoShowCharge(charge)) return false;

  const status = String(charge.status ?? "").toLowerCase();
  const adminStatus = String(charge.adminReviewStatus ?? "").toLowerCase();

  if (
    status === "waived" ||
    status === "paid" ||
    status === "applied_to_next_ride" ||
    adminStatus === "waived" ||
    adminStatus === "rejected" ||
    adminStatus === "admin_rejected" ||
    adminStatus === "applied_to_next_ride" ||
    adminStatus === "charge_pending_next_ride"
  ) {
    return false;
  }

  return true;
}

function approveAdminNoShowChargeForNextRide(charge: AdminPassengerPendingCharge): void {
  approveAdminPassengerChargeForNextRide(charge);
}

function rejectAdminNoShowCharge(
  charge: AdminPassengerPendingCharge,
  adminDecisionReason = "No show rechazado por administración tras revisión.",
): void {
  markAdminPassengerChargeStatus(charge, "waived", adminDecisionReason);
}

function mergeAdminBackendCashOverpaymentBenefits(
  benefits: CashOverpaymentBenefitData[],
  rides: AdminRideData[],
): void {
  if (benefits.length === 0) return;

  const current = readAdminCashPaymentReviews();

  for (const benefit of benefits) {
    const ride = rides.find(
      (item) => String(item.id ?? "") === benefit.sourceRideId,
    ) as (AdminRideData & Record<string, unknown>) | undefined;
    const rideKey = `ride:${benefit.sourceRideId}`;
    const storageKey = `passenger:${rideKey}`;
    const existing = current[storageKey] ?? current[rideKey];

    const adminReviewStatus =
      benefit.status === "approved"
        ? "backend_credit_created"
        : benefit.status === "rejected"
          ? "admin_rejected"
          : "pending_admin";

    current[storageKey] = {
      id: benefit.id,
      rideId: benefit.sourceRideId,
      rideKey,
      originText: String(
        ride?.originText ?? existing?.originText ?? "Origen del viaje",
      ),
      destinationText: String(
        ride?.destinationText ??
          existing?.destinationText ??
          "Destino del viaje",
      ),
      fareClp: benefit.fareClp,
      paidClp: benefit.paidClp,
      overpaidClp:
        benefit.approvedAmountClp ?? benefit.requestedAmountClp,
      decision: "wallet_credit",
      status:
        benefit.status === "approved"
          ? "wallet_available"
          : benefit.status === "rejected"
            ? "completed"
            : "pending_wallet_admin",
      adminReviewStatus,
      createdAt: benefit.createdAt,
      passengerEmail:
        benefit.ownerEmail ?? existing?.passengerEmail ?? null,
      passengerName:
        benefit.ownerName ?? existing?.passengerName ?? null,
      ownerUserId: benefit.ownerUserId,
      passengerPaidClp: benefit.paidClp,
      passengerOverpaidClp:
        benefit.approvedAmountClp ?? benefit.requestedAmountClp,
      passengerDecision: "wallet_credit",
      passengerWantsWalletCredit: true,
      passengerWantsRefund: false,
      source: "backend_cash_overpayment_benefit",
    };
  }

  writeAdminCashPaymentReviews(current);
}

function isAdminCashWalletRejected(
  review: AdminCashPaymentReview,
): boolean {
  const status = String(review.adminReviewStatus ?? "").toLowerCase();
  return status === "admin_rejected" || status === "rejected";
}

function isAdminCashWalletApproved(review: AdminCashPaymentReview): boolean {
  const status = String(review.status ?? "").toLowerCase();
  const adminStatus = String(review.adminReviewStatus ?? "").toLowerCase();

  // Para saldos a favor no basta una marca local: debe existir confirmación
  // de que el crédito fue creado en el backend para la cuenta propietaria.
  if (review.decision === "wallet_credit") {
    return adminStatus === "backend_credit_created";
  }

  return (
    adminStatus === "admin_approved" ||
    adminStatus === "approved" ||
    status === "approved" ||
    status === "available" ||
    status === "completed"
  );
}

function isAdminCashRefundCompleted(review: AdminCashPaymentReview): boolean {
  const status = String(review.adminReviewStatus ?? review.status ?? "").toLowerCase();
  return status === "refund_completed" || status === "completed";
}

function adminCashReviewDecisionLabel(review: AdminCashPaymentReview): string {
  if (review.decision === "wallet_credit") return "Saldo a favor solicitado";
  if (review.decision === "refund_whatsapp") return "Devolución por WhatsApp";
  if (review.decision === "driver_overpaid") return "Pago de más informado";
  return "Pagó justo";
}

function adminCashReviewStatusLabel(review: AdminCashPaymentReview): string {
  if (review.decision === "wallet_credit") {
    if (isAdminCashWalletRejected(review)) return "Beneficio rechazado";
    return isAdminCashWalletApproved(review)
      ? "Beneficio aprobado"
      : "Pendiente aprobar Beneficio";
  }
  if (review.decision === "refund_whatsapp") {
    return isAdminCashRefundCompleted(review) ? "Devolución gestionada" : "Pendiente devolución";
  }
  if (review.decision === "driver_overpaid") {
    return isAdminCashWalletApproved(review) ? "Diferencia revisada" : "Revisar conductor/usuario";
  }
  return "Sin diferencia";
}

function adminCashReviewStatusColor(review: AdminCashPaymentReview): string {
  if (review.decision === "wallet_credit") {
    if (isAdminCashWalletRejected(review)) return "danger";
    return isAdminCashWalletApproved(review) ? "success" : "warning";
  }
  if (review.decision === "refund_whatsapp") return isAdminCashRefundCompleted(review) ? "success" : "danger";
  if (review.decision === "driver_overpaid") return isAdminCashWalletApproved(review) ? "success" : "tertiary";
  return "medium";
}

function resolveAdminCashReviewOwnerUserId(
  review: AdminCashPaymentReview,
  users: AdminUserData[],
): string {
  const directUserId = String(review.ownerUserId ?? "").trim();
  if (directUserId) return directUserId;

  const ownerEmail = String(review.passengerEmail ?? "")
    .trim()
    .toLowerCase();

  if (!ownerEmail) return "";

  const targetUser = users.find(
    (user) =>
      String((user as { email?: string | null }).email ?? "")
        .trim()
        .toLowerCase() === ownerEmail,
  );

  return String((targetUser as { id?: string } | undefined)?.id ?? "").trim();
}

async function approveAdminCashWalletCredit(
  accessToken: string,
  review: AdminCashPaymentReview,
  users: AdminUserData[],
): Promise<void> {
  if (!accessToken) {
    throw new Error("Sesión de administrador no disponible.");
  }

  const creditAmount = Math.max(
    0,
    Math.round(
      Number(review.passengerOverpaidClp ?? review.overpaidClp ?? 0),
    ),
  );

  if (creditAmount <= 0) {
    throw new Error("El saldo a favor no tiene un monto válido.");
  }

  const rideId = adminWalletCreditUuidOrUndefined(review.rideId);
  if (!rideId) {
    throw new Error(
      "El viaje no tiene un ID válido para aprobar el Beneficio.",
    );
  }

  const { walletService } = await import(
    "../../features/wallet/wallet.service.js"
  );

  // La cuenta propietaria y el monto máximo provienen de la solicitud backend.
  // Admin ya no puede crear créditos arbitrarios desde LocalStorage.
  const approval =
    await walletService.adminApproveCashOverpaymentBenefitByRide(
      accessToken,
      rideId,
      {
        approvedAmountClp: creditAmount,
        adminDecisionReason:
          "Beneficio aprobado por dinero pagado de más en efectivo.",
      },
    );

  const targetUserId =
    approval.benefit.ownerUserId ||
    resolveAdminCashReviewOwnerUserId(review, users);
  const approvedAmountClp = Math.max(
    0,
    Math.round(
      approval.benefit.approvedAmountClp ??
        approval.benefit.requestedAmountClp,
    ),
  );
  const now = new Date().toISOString();

  const updatedReviews = readAdminCashPaymentReviews().map((item) => {
    if (
      (item.rideKey || item.rideId || item.id) !==
      (review.rideKey || review.rideId || review.id)
    ) {
      return item;
    }

    return {
      ...item,
      ownerUserId: targetUserId,
      overpaidClp: approvedAmountClp,
      passengerOverpaidClp: approvedAmountClp,
      adminReviewStatus: "backend_credit_created",
      status: "wallet_available",
    };
  });

  writeAdminCashPaymentReviews(updatedReviews);

  const benefits = readAdminWalletBenefits();
  const benefitId = approval.benefit.id;

  const nextBenefit: AdminWalletBenefit = {
    id: benefitId,
    rideId: approval.benefit.sourceRideId,
    passengerEmail:
      approval.benefit.ownerEmail ?? review.passengerEmail ?? null,
    ownerKey:
      approval.benefit.ownerEmail ?? review.passengerEmail ?? null,
    ownerUserId: targetUserId,
    amountClp: approvedAmountClp,
    status: "available",
    source: "cash_overpayment_backend",
    title: "BENEFICIO APROBADO PARA PRÓXIMO VIAJE EN EFECTIVO",
    description:
      "Beneficio aprobado en backend y asociado exclusivamente a la cuenta que pagó el viaje.",
    createdAt: approval.benefit.createdAt,
    approvedAt: approval.benefit.reviewedAt ?? now,
    approvedBy: "admin",
    adminReviewStatus: "backend_credit_created",
    fareClp: approval.benefit.fareClp,
    paidClp: approval.benefit.paidClp,
    passengerPaidClp: approval.benefit.paidClp,
  };

  writeAdminWalletBenefits([
    nextBenefit,
    ...benefits.filter((item) => String(item.id ?? "") !== benefitId),
  ]);
}

async function rejectAdminCashWalletCredit(
  accessToken: string,
  review: AdminCashPaymentReview,
  reason: string,
): Promise<void> {
  if (!accessToken) {
    throw new Error("Sesión de administrador no disponible.");
  }

  const cleanReason = String(reason ?? "").trim();
  if (!cleanReason) {
    throw new Error("Debes escribir el motivo del rechazo.");
  }

  const rideId = adminWalletCreditUuidOrUndefined(review.rideId);
  if (!rideId) {
    throw new Error(
      "El viaje no tiene un ID válido para rechazar el Beneficio.",
    );
  }

  const { walletService } = await import(
    "../../features/wallet/wallet.service.js"
  );

  await walletService.adminRejectCashOverpaymentBenefitByRide(
    accessToken,
    rideId,
    cleanReason,
  );

  const updatedReviews = readAdminCashPaymentReviews().map((item) => {
    if (
      (item.rideKey || item.rideId || item.id) !==
      (review.rideKey || review.rideId || review.id)
    ) {
      return item;
    }

    return {
      ...item,
      adminReviewStatus: "admin_rejected",
      status: "completed",
    };
  });

  writeAdminCashPaymentReviews(updatedReviews);
}

function markAdminCashRefundCompleted(review: AdminCashPaymentReview): void {
  const updatedReviews = readAdminCashPaymentReviews().map((item) => {
    if ((item.rideKey || item.rideId || item.id) !== (review.rideKey || review.rideId || review.id)) return item;
    return {
      ...item,
      adminReviewStatus: "refund_completed",
      status: "completed",
    };
  });

  writeAdminCashPaymentReviews(updatedReviews);
}

function markAdminCashDriverReviewCompleted(review: AdminCashPaymentReview): void {
  const updatedReviews = readAdminCashPaymentReviews().map((item) => {
    if ((item.rideKey || item.rideId || item.id) !== (review.rideKey || review.rideId || review.id)) return item;
    return {
      ...item,
      adminReviewStatus: "admin_approved",
      status: "completed",
    };
  });

  writeAdminCashPaymentReviews(updatedReviews);
}

export function AdminHomePage(): JSX.Element {
  const { session } = useAuth();
  const history = useHistory();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [activity, setActivity] = useState<DashActivityItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedKpi, setSelectedKpi] = useState<
    "rides" | "drivers" | "users" | null
  >(null);

  // Datos reales para las tarjetas principales del admin.
  const [adminRides, setAdminRides] = useState<AdminRideData[]>([]);
  const [adminDrivers, setAdminDrivers] = useState<ActiveDriverData[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUserData[]>([]);
  const [, setAdminAvailabilityRevision] = useState(0);
  const [cashReviewsRevision, setCashReviewsRevision] = useState(0);
  const [adminCashToast, setAdminCashToast] = useState<string | null>(null);
  const [showAdminChargesModal, setShowAdminChargesModal] = useState(false);
  const [showAdminNoShowModal, setShowAdminNoShowModal] = useState(false);
  const [showAccountDeletionModal, setShowAccountDeletionModal] = useState(false);
  const [showTripSafetyReportsModal, setShowTripSafetyReportsModal] = useState(false);
  const [tripSafetyReports, setTripSafetyReports] = useState<AdminTripSafetyReport[]>(() => readAdminTripSafetyReports());
  const [pendingChargeWaiver, setPendingChargeWaiver] = useState<AdminPassengerPendingCharge | null>(null);


  useEffect(() => {
    const refreshTripSafetyReports = () => {
      setTripSafetyReports(readAdminTripSafetyReports());
    };

    window.addEventListener("storage", refreshTripSafetyReports);
    window.addEventListener(RAPAGO_TRIP_SAFETY_REPORT_EVENT_ADMIN, refreshTripSafetyReports as EventListener);
    window.addEventListener(RAPAGO_ADMIN_RIDES_EVENT, refreshTripSafetyReports as EventListener);

    return () => {
      window.removeEventListener("storage", refreshTripSafetyReports);
      window.removeEventListener(RAPAGO_TRIP_SAFETY_REPORT_EVENT_ADMIN, refreshTripSafetyReports as EventListener);
      window.removeEventListener(RAPAGO_ADMIN_RIDES_EVENT, refreshTripSafetyReports as EventListener);
    };
  }, []);

  const load = useCallback(
    async (silent = false) => {
      if (!session?.accessToken) return;

      if (!silent) setLoading(true);
      setError(null);

      try {
        const token = session.accessToken;

        const [
          dash,
          acts,
          ridesResult,
          driversResult,
          usersResult,
          policyChargesResult,
          cashBenefitsResult,
        ] = await Promise.all([
            dashboardService.getDashboard(token),
            dashboardService.getActivity(token, 5),
            adminService
              .listRides(token, {})
              .catch(() => [] as AdminRideData[]),
            adminService
              .listActiveDrivers(token)
              .catch(() => [] as ActiveDriverData[]),
            adminService
              .listUsers(token, {})
              .catch(() => [] as AdminUserData[]),
            fetchAdminBackendPolicyCharges(token)
              .catch(() => [] as AdminPassengerPendingCharge[]),
            walletService
              .adminListCashOverpaymentBenefits(token, "all")
              .catch(() => [] as CashOverpaymentBenefitData[]),
          ]);

        setData(dash);
        setActivity(acts);
        setAdminRides(ridesResult);
        setAdminDrivers(driversResult);
        setAdminUsers(usersResult);
        if (cashBenefitsResult.length > 0) {
          mergeAdminBackendCashOverpaymentBenefits(
            cashBenefitsResult,
            ridesResult,
          );
          setCashReviewsRevision((current) => current + 1);
        }
        if (policyChargesResult.length > 0) {
          mergeAdminBackendPolicyCharges(policyChargesResult);
          setCashReviewsRevision((current) => current + 1);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Error al cargar dashboard.",
        );
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [session?.accessToken],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (selectedKpi !== "drivers") return;

    setAdminAvailabilityRevision((current) => current + 1);
    void load(true);
  }, [selectedKpi, load]);

  useEffect(() => {
    const refreshAvailability = () => {
      setAdminAvailabilityRevision((current) => current + 1);
      void load(true);
    };

    window.addEventListener("storage", refreshAvailability);
    window.addEventListener(
      DRIVER_AVAILABILITY_EVENT,
      refreshAvailability as EventListener,
    );

    const timerId = window.setInterval(refreshAvailability, 3000);

    return () => {
      window.removeEventListener("storage", refreshAvailability);
      window.removeEventListener(
        DRIVER_AVAILABILITY_EVENT,
        refreshAvailability as EventListener,
      );
      window.clearInterval(timerId);
    };
  }, [load]);

  useEffect(() => {
    const refreshCashReviews = () => setCashReviewsRevision((current) => current + 1);

    window.addEventListener("storage", refreshCashReviews);
    window.addEventListener("rapago:cash-payment-review-updated", refreshCashReviews as EventListener);
    window.addEventListener(RAPAGO_ADMIN_CASH_CLOSURES_EVENT, refreshCashReviews as EventListener);
    window.addEventListener(RAPAGO_DRIVER_CASH_CLOSURE_EVENT, refreshCashReviews as EventListener);
    window.addEventListener("rapago:wallet-benefit-updated", refreshCashReviews as EventListener);
    window.addEventListener(RAPAGO_ADMIN_WALLET_BENEFIT_EVENT, refreshCashReviews as EventListener);
    window.addEventListener("rapago:wallet-updated", refreshCashReviews as EventListener);
    window.addEventListener(RAPAGO_ADMIN_RIDES_EVENT, refreshCashReviews as EventListener);
    window.addEventListener(RAPAGO_PASSENGER_PENDING_CHARGE_EVENT_ADMIN, refreshCashReviews as EventListener);

    return () => {
      window.removeEventListener("storage", refreshCashReviews);
      window.removeEventListener("rapago:cash-payment-review-updated", refreshCashReviews as EventListener);
      window.removeEventListener(RAPAGO_ADMIN_CASH_CLOSURES_EVENT, refreshCashReviews as EventListener);
      window.removeEventListener(RAPAGO_DRIVER_CASH_CLOSURE_EVENT, refreshCashReviews as EventListener);
      window.removeEventListener("rapago:wallet-benefit-updated", refreshCashReviews as EventListener);
      window.removeEventListener(RAPAGO_ADMIN_WALLET_BENEFIT_EVENT, refreshCashReviews as EventListener);
      window.removeEventListener("rapago:wallet-updated", refreshCashReviews as EventListener);
      window.removeEventListener(RAPAGO_ADMIN_RIDES_EVENT, refreshCashReviews as EventListener);
      window.removeEventListener(RAPAGO_PASSENGER_PENDING_CHARGE_EVENT_ADMIN, refreshCashReviews as EventListener);
    };
  }, []);

  function goToAdminDrivers(): void {
    setSelectedKpi(null);

    try {
      window.dispatchEvent(new CustomEvent(DRIVER_AVAILABILITY_EVENT));
      window.dispatchEvent(new CustomEvent(ADMIN_DRIVERS_REFRESH_EVENT));
    } catch {
      // No bloquea navegación.
    }

    void load(true);

    const targetPath = ADMIN_DRIVERS_ROUTE;
    const currentPath = cleanPath(window.location.pathname);

    if (currentPath !== targetPath) {
      history.push(targetPath);
    }

    // Ionic a veces deja la vista anterior cacheada aunque cambie la URL.
    // Este evento fuerza que el outlet vuelva a pintar Conductores.
    window.setTimeout(() => {
      if (cleanPath(window.location.pathname) !== targetPath) {
        window.location.assign(targetPath);
        return;
      }

      window.dispatchEvent(new Event("popstate"));
      window.dispatchEvent(new CustomEvent(ADMIN_DRIVERS_REFRESH_EVENT));
    }, 80);
  }

  // Seguridad visual: si el router dejó montado AdminHomePage en /admin/drivers,
  // renderizamos la pantalla correcta igualmente.
  if (
    typeof window !== "undefined" &&
    cleanPath(window.location.pathname) === ADMIN_DRIVERS_ROUTE
  ) {
    return <AdminDriversPage />;
  }

  const dateStr = new Date().toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const alerts = data?.alerts ?? [];

  const today = data?.today ?? {
    rides: {
      total: 0,
      completed: 0,
      inProgress: 0,
      pending: 0,
    },
    revenue: 0,
    newUsers: 0,
  };

  const thisWeek = data?.thisWeek ?? {
    revenue: 0,
    topDrivers: [],
  };

  const operational = data?.operational ?? {
    activeDrivers: 0,
    busyDrivers: 0,
    unavailableDrivers: 0,
    pendingDocuments: 0,
    pendingOfflineBookings: 0,
    pendingServiceBookings: 0,
    pendingRentalBookings: 0,
  };

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  function isTodayDate(value: string | null | undefined): boolean {
    if (!value) return false;
    const time = new Date(value).getTime();
    return (
      Number.isFinite(time) &&
      time >= startOfToday.getTime() &&
      time <= endOfToday.getTime()
    );
  }

  function isRideFromToday(ride: AdminRideData): boolean {
    return (
      isTodayDate(ride.createdAt) ||
      isTodayDate(ride.requestedAt) ||
      isTodayDate(ride.acceptedAt) ||
      isTodayDate(ride.startedAt) ||
      isTodayDate(ride.completedAt) ||
      isTodayDate(ride.cancelledAt)
    );
  }

  const ridesToday = adminRides.filter(isRideFromToday);
  const ridesTodayTotal = ridesToday.length || today.rides.total;
  const ridesTodayCompleted =
    ridesToday.filter((ride) => ride.status === "completed").length ||
    today.rides.completed;
  const ridesTodayInProgress =
    ridesToday.filter((ride) => ride.status === "in_progress").length ||
    today.rides.inProgress;
  const ridesTodayPending =
    ridesToday.filter((ride) => ride.status === "requested").length ||
    today.rides.pending;
  const ridesTodayCancelled = ridesToday.filter(
    (ride) => ride.status === "cancelled",
  ).length;

  const normalizedDriverAvailabilities = adminDrivers.map(
    getNormalizedDriverAvailability,
  );
  const driversTotal = adminDrivers.length || operational.activeDrivers;
  const driversBusy = normalizedDriverAvailabilities.length
    ? normalizedDriverAvailabilities.filter(
        (availability) => availability === "busy",
      ).length
    : operational.busyDrivers;
  const driversUnavailable = normalizedDriverAvailabilities.length
    ? normalizedDriverAvailabilities.filter(
        (availability) => availability === "unavailable",
      ).length
    : operational.unavailableDrivers;
  const driversAvailable = normalizedDriverAvailabilities.length
    ? normalizedDriverAvailabilities.filter(
        (availability) => availability === "available",
      ).length
    : Math.max(
        0,
        operational.activeDrivers -
          operational.busyDrivers -
          operational.unavailableDrivers,
      );

  const newUsersToday =
    adminUsers.filter((user) => isTodayDate(user.createdAt)).length ||
    today.newUsers;

  const pendingTotal =
    operational.pendingDocuments +
    operational.pendingOfflineBookings +
    operational.pendingServiceBookings +
    operational.pendingRentalBookings;

  const cashPaymentReviews = cashReviewsRevision >= 0 ? readAdminCashPaymentReviews() : [];
  const pendingCashPaymentReviews = cashPaymentReviews.filter((review) => {
    if (review.decision === "wallet_credit") {
      return (
        !isAdminCashWalletApproved(review) &&
        !isAdminCashWalletRejected(review)
      );
    }
    if (review.decision === "refund_whatsapp") return !isAdminCashRefundCompleted(review);
    if (review.decision === "driver_overpaid") return !isAdminCashWalletApproved(review);
    return false;
  });
  const pendingCashAmountClp = pendingCashPaymentReviews.reduce((sum, review) => sum + Math.max(0, review.overpaidClp), 0);
  const passengerPendingCharges =
    cashReviewsRevision >= 0 ? readAdminPassengerPendingCharges() : [];

  // Los No Show tienen su módulo exclusivo. No deben repetirse en Cobranza.
  const adminNoShowCharges = passengerPendingCharges
    .filter(isAdminNoShowCharge)
    .map((charge) => {
      if (!isAdminNoShowPendingReview(charge)) return charge;

      const calculation = calculateAdminPassengerChargeAmount(charge);
      return {
        ...charge,
        amountClp: calculation.amountClp,
        applicableFareClp: calculation.applicableFareClp,
        feePercent: calculation.percent,
        feeCapClp: calculation.capClp,
      };
    });

  const adminNoShowPendingReview =
    adminNoShowCharges.filter(isAdminNoShowPendingReview);

  const adminCancellationCharges =
    passengerPendingCharges.filter((charge) => !isAdminNoShowCharge(charge));

  const passengerChargesPendingNextRide =
    adminCancellationCharges.filter(isAdminPassengerChargePending);

  const pendingPassengerChargeAmountClp =
    passengerChargesPendingNextRide.reduce(
      (sum, charge) => sum + Math.max(0, charge.amountClp),
      0,
    );
  const adminWalletBenefits = cashReviewsRevision >= 0 ? readAdminWalletBenefits() : [];
  const cardCancellationCredits = adminWalletBenefits.filter(isAdminWalletCardCancellationCredit);
  const cardCancellationCreditsAmountClp = cardCancellationCredits.reduce((sum, credit) => sum + Math.max(0, credit.amountClp), 0);
  const cardCancellationCreditsPending = cardCancellationCredits.filter(isAdminWalletCreditPending);
  const cardRefundRequestsPending = cardCancellationCredits.filter((credit) =>
    credit.refundWhatsappAvailable && !isAdminWalletCreditRefundCompleted(credit),
  );
  const adminChargesTotalCount =
    passengerChargesPendingNextRide.length +
    pendingCashPaymentReviews.length +
    cardCancellationCreditsPending.length +
    cardRefundRequestsPending.length;

  const kpis: Array<{
    id: "rides" | "revenue" | "drivers" | "users";
    label: string;
    value: string;
    helper: string;
    icon: string;
    tone: string;
    route?: string;
    clickable: boolean;
  }> = [
    {
      id: "rides",
      label: "Viajes hoy",
      value: ridesTodayTotal.toString(),
      helper: `${ridesTodayCompleted} completados · ${ridesTodayInProgress} en curso · ${ridesTodayPending} pendientes · ${ridesTodayCancelled} cancelados`,
      icon: carOutline,
      tone: "gold",
      route: ROUTES.ADMIN.TRIPS,
      clickable: true,
    },
    {
      id: "revenue",
      label: "Ingresos hoy",
      value: `$${Math.round(today.revenue / 100).toLocaleString("es-CL")}`,
      helper: `Semana: $${Math.round(thisWeek.revenue / 100).toLocaleString("es-CL")}`,
      icon: cashOutline,
      tone: "sand",
      clickable: false,
    },
    {
      id: "drivers",
      label: "Conductores",
      value: driversTotal.toString(),
      helper: `${driversAvailable} disponibles · ${driversBusy} ocupados · ${driversUnavailable} no disponibles`,
      icon: peopleOutline,
      tone: "gold",
      route: ROUTES.ADMIN.DRIVERS,
      clickable: true,
    },
    {
      id: "users",
      label: "Nuevos usuarios",
      value: newUsersToday.toString(),
      helper: "Usuarios registrados hoy",
      icon: personOutline,
      tone: "sand",
      route: ROUTES.ADMIN.DRIVERS,
      clickable: true,
    },
  ];

  const pendingTripSafetyReports = tripSafetyReports.filter(
    (report) => report.adminStatus !== "resolved" && report.status !== "arrived_well",
  );

  const primaryActions = [
    {
      label: "Usuarios",
      description: "Cuentas y estados",
      icon: peopleOutline,
      route: ROUTES.ADMIN.DRIVERS,
    },
    {
      label: "Viajes",
      description: "Monitorear operaci?n",
      icon: carOutline,
      route: ROUTES.ADMIN.TRIPS,
    },
    {
      label: "Docs",
      description: "Revisi?n pendiente",
      icon: documentTextOutline,
      route: ROUTES.ADMIN.DOCUMENTS,
    },
    {
      label: "Cobranza",
      description: `${adminChargesTotalCount} pendiente${adminChargesTotalCount !== 1 ? "s" : ""}`,
      icon: cardOutline,
      route: "__admin_charges__",
    },
    {
      label: "No Show",
      description: `${adminNoShowPendingReview.length} por revisar`,
      icon: alertCircleOutline,
      route: "__admin_no_show__",
    },
    {
      label: "Borrar cuenta",
      description: "Pasajeros y conductores",
      icon: warningOutline,
      route: "__account_deletion__",
    },
    {
      label: "Reportes",
      description: `${pendingTripSafetyReports.length} pendiente${pendingTripSafetyReports.length !== 1 ? "s" : ""}`,
      icon: alertCircleOutline,
      route: "__trip_safety_reports__",
    },
    {
      label: "Efectivo",
      description: `${cashPaymentReviews.length} revisi?n${cashPaymentReviews.length !== 1 ? "es" : ""}`,
      icon: cashOutline,
      route: "__admin_charges__",
    },
    {
      label: "Config",
      description: "Ajustes del sistema",
      icon: settingsOutline,
      route: ROUTES.ADMIN.SETTINGS,
    },
  ];

  const secondaryActions = [
    {
      label: "Offline",
      description: "Solicitudes sin conexión",
      icon: cloudOfflineOutline,
      route: ROUTES.ADMIN.OFFLINE_BOOKINGS,
    },
    {
      label: "Tarifas",
      description: "Precios y tarifas",
      icon: cashOutline,
      route: ROUTES.ADMIN.FARE_SETTINGS,
    },
    {
      label: "Legales",
      description: "Políticas y términos",
      icon: shieldCheckmarkOutline,
      route: ROUTES.ADMIN.LEGAL_DOCUMENTS,
    },
    {
      label: "Referidos",
      description: "Invitaciones y premios",
      icon: giftOutline,
      route: ROUTES.ADMIN.REFERRALS,
    },
    {
      label: "Pagos",
      description: "Ingresos y cobros",
      icon: cardOutline,
      route: ROUTES.ADMIN.PAYMENTS,
    },
  ];

  return (
    <IonPage>
      <IonHeader className="admin-header">
        <IonToolbar className="admin-toolbar">
          <IonTitle>RAPA GO Admin</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="admin-dashboard-content">
        <IonRefresher
          slot="fixed"
          onIonRefresh={(event) => {
            void load().then(() => event.detail.complete());
          }}
        >
          <IonRefresherContent />
        </IonRefresher>

        <div className="admin-dashboard-shell">
          <section className="admin-hero-card">
            <div>
              <p className="admin-eyebrow">Panel de Control</p>
              <h1 className="admin-hero-title">Operación Rapa Go</h1>
              <p className="admin-hero-date">{dateStr}</p>
            </div>

            <div className="admin-status-pill">
              <span className="admin-status-dot" />
              Sistema online
            </div>
          </section>

          {loading && (
            <div className="admin-loading-card">
              <IonSpinner name="crescent" />
              <span>Cargando información...</span>
            </div>
          )}

          {error && (
            <IonCard className="admin-error-card">
              <IonCardContent>{error}</IonCardContent>
            </IonCard>
          )}

          {!loading && data && (
            <>
              {alerts.length > 0 && (
                <section className="admin-alerts">
                  {alerts.slice(0, 3).map((alert, index) => (
                    <IonCard
                      key={`${alert.message}-${index}`}
                      className={
                        alert.type === "critical"
                          ? "admin-alert-card critical"
                          : "admin-alert-card warning"
                      }
                    >
                      <IonCardContent>
                        <div className="admin-alert-row">
                          <IonIcon
                            icon={
                              alert.type === "critical"
                                ? alertCircleOutline
                                : warningOutline
                            }
                          />
                          <span>{alert.message}</span>
                        </div>
                      </IonCardContent>
                    </IonCard>
                  ))}
                </section>
              )}

              <section
                className="admin-kpi-grid"
                style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
              >
                {kpis.map((kpi) => (
                  <IonCard
                    key={kpi.id}
                    button={kpi.clickable}
                    onClick={() => {
                      if (!kpi.clickable || kpi.id === "revenue") return;

                      if (kpi.id === "drivers") {
                        goToAdminDrivers();
                        return;
                      }

                      setSelectedKpi(kpi.id);
                    }}
                    className={`admin-kpi-card ${kpi.tone}`}
                    style={{
                      cursor: kpi.clickable ? "pointer" : "default",
                      opacity: kpi.clickable ? 1 : 0.98,
                    }}
                  >
                    <IonCardContent>
                      <div className="admin-kpi-top">
                        <div className="admin-kpi-icon">
                          <IonIcon icon={kpi.icon} />
                        </div>
                        {kpi.clickable && (
                          <IonIcon
                            icon={chevronForward}
                            style={{ opacity: 0.62, fontSize: 18 }}
                          />
                        )}
                      </div>

                      <div className="admin-kpi-value">{kpi.value}</div>
                      <div className="admin-kpi-label">{kpi.label}</div>
                      <div className="admin-kpi-helper">{kpi.helper}</div>

                      {kpi.id === "rides" && (
                        <div className="admin-kpi-badges">
                          <IonBadge color="success">
                            {ridesTodayCompleted} completados
                          </IonBadge>
                          <IonBadge color="warning">
                            {ridesTodayInProgress} en curso
                          </IonBadge>
                          <IonBadge color="medium">
                            {ridesTodayPending} pendientes
                          </IonBadge>
                          <IonBadge color="danger">
                            {ridesTodayCancelled} cancelados
                          </IonBadge>
                        </div>
                      )}
                    </IonCardContent>
                  </IonCard>
                ))}
              </section>

              <IonModal
                isOpen={selectedKpi !== null}
                onDidDismiss={() => setSelectedKpi(null)}
                breakpoints={[0, 0.55, 0.88]}
                initialBreakpoint={0.55}
              >
                <IonHeader>
                  <IonToolbar color="dark">
                    <IonTitle>
                      {selectedKpi === "rides" && "Viajes de hoy"}
                      {selectedKpi === "drivers" && "Conductores"}
                      {selectedKpi === "users" && "Nuevos usuarios"}
                    </IonTitle>
                    <div slot="end" style={{ paddingRight: 8 }}>
                      <IonButton
                        fill="clear"
                        color="light"
                        onClick={() => setSelectedKpi(null)}
                      >
                        Cerrar
                      </IonButton>
                    </div>
                  </IonToolbar>
                </IonHeader>

                <IonContent className="ion-padding">
                  {selectedKpi === "rides" && (
                    <>
                      <IonCard style={{ margin: "0 0 12px", borderRadius: 18 }}>
                        <IonCardContent>
                          <h2 style={{ margin: "0 0 4px", fontWeight: 950 }}>
                            Resumen de viajes
                          </h2>
                          <p
                            style={{
                              margin: 0,
                              color: "var(--ion-color-medium)",
                              fontSize: ".86rem",
                            }}
                          >
                            Operación del día actual.
                          </p>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr",
                              gap: 10,
                              marginTop: 14,
                            }}
                          >
                            <div>
                              <strong>{ridesTodayTotal}</strong>
                              <br />
                              <span>Total</span>
                            </div>
                            <div>
                              <strong>{ridesTodayCompleted}</strong>
                              <br />
                              <span>Completados</span>
                            </div>
                            <div>
                              <strong>{ridesTodayInProgress}</strong>
                              <br />
                              <span>En curso</span>
                            </div>
                            <div>
                              <strong>{ridesTodayPending}</strong>
                              <br />
                              <span>Pendientes</span>
                            </div>
                            <div>
                              <strong>{ridesTodayCancelled}</strong>
                              <br />
                              <span>Cancelados</span>
                            </div>
                          </div>
                        </IonCardContent>
                      </IonCard>
                      <IonList>
                        <IonItem
                          routerLink={ROUTES.ADMIN.TRIPS}
                          detail
                          onClick={() => setSelectedKpi(null)}
                        >
                          <IonIcon icon={carOutline} slot="start" />
                          <IonLabel>Ver todos los viajes</IonLabel>
                        </IonItem>
                      </IonList>
                    </>
                  )}

                  {selectedKpi === "drivers" && (
                    <>
                      <IonCard style={{ margin: "0 0 12px", borderRadius: 18 }}>
                        <IonCardContent>
                          <h2 style={{ margin: "0 0 4px", fontWeight: 950 }}>
                            Estado de conductores
                          </h2>
                          <p
                            style={{
                              margin: 0,
                              color: "var(--ion-color-medium)",
                              fontSize: ".86rem",
                            }}
                          >
                            Disponibilidad operacional en tiempo real.
                          </p>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr",
                              gap: 10,
                              marginTop: 14,
                            }}
                          >
                            <div>
                              <strong>{driversTotal}</strong>
                              <br />
                              <span>Total conductores</span>
                            </div>
                            <div>
                              <strong>{driversAvailable}</strong>
                              <br />
                              <span>Disponibles</span>
                            </div>
                            <div>
                              <strong>{driversBusy}</strong>
                              <br />
                              <span>Ocupados</span>
                            </div>
                            <div>
                              <strong>{driversUnavailable}</strong>
                              <br />
                              <span>No disponibles</span>
                            </div>
                          </div>
                        </IonCardContent>
                      </IonCard>
                      <IonList>
                        <IonItem
                          button
                          detail
                          onClick={() => {
                            goToAdminDrivers();
                          }}
                        >
                          <IonIcon icon={peopleOutline} slot="start" />
                          <IonLabel>Ver conductores</IonLabel>
                        </IonItem>
                      </IonList>
                    </>
                  )}

                  {selectedKpi === "users" && (
                    <>
                      <IonCard style={{ margin: "0 0 12px", borderRadius: 18 }}>
                        <IonCardContent>
                          <h2 style={{ margin: "0 0 4px", fontWeight: 950 }}>
                            Usuarios nuevos
                          </h2>
                          <p
                            style={{
                              margin: 0,
                              color: "var(--ion-color-medium)",
                              fontSize: ".86rem",
                            }}
                          >
                            Registros creados durante el día.
                          </p>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr",
                              gap: 10,
                              marginTop: 14,
                            }}
                          >
                            <div>
                              <strong>{newUsersToday}</strong>
                              <br />
                              <span>Nuevos usuarios registrados hoy</span>
                            </div>
                          </div>
                        </IonCardContent>
                      </IonCard>
                      <IonList>
                        <IonItem
                          routerLink={ROUTES.ADMIN.DRIVERS}
                          detail
                          onClick={() => setSelectedKpi(null)}
                        >
                          <IonIcon icon={personOutline} slot="start" />
                          <IonLabel>Ver usuarios</IonLabel>
                        </IonItem>
                      </IonList>
                    </>
                  )}
                </IonContent>
              </IonModal>

              <IonCard className="admin-section-card admin-quick-card">
                <IonCardHeader>
                  <IonCardTitle>Accesos principales</IonCardTitle>
                  <IonCardSubtitle>Lo más usado en celular</IonCardSubtitle>
                </IonCardHeader>

                <IonCardContent>
                  <div className="admin-quick-grid">
                    {primaryActions.map((action) => (
                      <IonButton
                        key={action.label}
                        routerLink={
                          action.route === ROUTES.ADMIN.DRIVERS ||
                          action.route === "__admin_charges__" ||
                          action.route === "__admin_no_show__" ||
                          action.route === "__account_deletion__" ||
                          action.route === "__trip_safety_reports__"
                            ? undefined
                            : action.route
                        }
                        onClick={() => {
                          if (action.route === ROUTES.ADMIN.DRIVERS) {
                            goToAdminDrivers();
                            return;
                          }

                          if (action.route === "__admin_no_show__") {
                            setShowAdminNoShowModal(true);
                            return;
                          }

                          if (action.route === "__account_deletion__") {
                            setShowAccountDeletionModal(true);
                            return;
                          }

                          if (action.route === "__trip_safety_reports__") {
                            setTripSafetyReports(readAdminTripSafetyReports());
                            setShowTripSafetyReportsModal(true);
                            return;
                          }

                          if (action.route === "__admin_charges__") {
                            setShowAdminChargesModal(true);
                            return;
                          }
                        }}
                        fill="clear"
                        className="admin-quick-action"
                      >
                        <div className="admin-quick-action-inner">
                          <div className="admin-quick-icon">
                            <IonIcon icon={action.icon} />
                          </div>

                          <div>
                            <strong>{action.label}</strong>
                            <span>{action.description}</span>
                          </div>

                          <IonIcon
                            icon={chevronForward}
                            className="admin-quick-arrow"
                          />
                        </div>
                      </IonButton>
                    ))}
                  </div>
                </IonCardContent>
              </IonCard>

              {pendingTotal > 0 && (
                <IonCard className="admin-section-card">
                  <IonCardHeader>
                    <div className="admin-section-title-row">
                      <div>
                        <IonCardTitle>Pendientes operacionales</IonCardTitle>
                        <IonCardSubtitle>
                          Requieren revisión del administrador
                        </IonCardSubtitle>
                      </div>
                      <IonBadge color="warning">{pendingTotal}</IonBadge>
                    </div>
                  </IonCardHeader>

                  <IonList className="admin-clean-list">
                    {operational.pendingDocuments > 0 && (
                      <IonItem routerLink={ROUTES.ADMIN.DOCUMENTS} detail>
                        <IonIcon icon={documentTextOutline} slot="start" />
                        <IonLabel>Documentos pendientes</IonLabel>
                        <IonBadge slot="end" color="warning">
                          {operational.pendingDocuments}
                        </IonBadge>
                      </IonItem>
                    )}

                    {operational.pendingOfflineBookings > 0 && (
                      <IonItem
                        routerLink={ROUTES.ADMIN.OFFLINE_BOOKINGS}
                        detail
                      >
                        <IonIcon icon={cloudOfflineOutline} slot="start" />
                        <IonLabel>Reservas offline sin sincronizar</IonLabel>
                        <IonBadge slot="end" color="warning">
                          {operational.pendingOfflineBookings}
                        </IonBadge>
                      </IonItem>
                    )}

                    {operational.pendingServiceBookings > 0 && (
                      <IonItem detail>
                        <IonIcon icon={compassOutline} slot="start" />
                        <IonLabel>Reservas de servicios</IonLabel>
                        <IonBadge slot="end" color="medium">
                          {operational.pendingServiceBookings}
                        </IonBadge>
                      </IonItem>
                    )}

                    {operational.pendingRentalBookings > 0 && (
                      <IonItem detail>
                        <IonIcon icon={keyOutline} slot="start" />
                        <IonLabel>Reservas de arriendo</IonLabel>
                        <IonBadge slot="end" color="medium">
                          {operational.pendingRentalBookings}
                        </IonBadge>
                      </IonItem>
                    )}
                  </IonList>
                </IonCard>
              )}


              <IonModal
                isOpen={showAccountDeletionModal}
                onDidDismiss={() => setShowAccountDeletionModal(false)}
                breakpoints={[0, 0.72, 0.95]}
                initialBreakpoint={0.95}
              >
                <IonHeader>
                  <IonToolbar color="dark">
                    <IonTitle>Solicitudes borrar cuenta</IonTitle>
                    <div slot="end" style={{ paddingRight: 8 }}>
                      <IonButton
                        fill="clear"
                        color="light"
                        onClick={() => setShowAccountDeletionModal(false)}
                      >
                        Cerrar
                      </IonButton>
                    </div>
                  </IonToolbar>
                </IonHeader>

                <IonContent className="ion-padding">
                  <AccountDeletionAdminPanel />
                </IonContent>
              </IonModal>

              <IonModal
                isOpen={showTripSafetyReportsModal}
                onDidDismiss={() => setShowTripSafetyReportsModal(false)}
                breakpoints={[0, 0.72, 0.95]}
                initialBreakpoint={0.95}
              >
                <IonHeader>
                  <IonToolbar color="dark">
                    <IonTitle>Reportes de viaje</IonTitle>
                    <div slot="end" style={{ paddingRight: 8 }}>
                      <IonButton
                        fill="clear"
                        color="light"
                        onClick={() => setShowTripSafetyReportsModal(false)}
                      >
                        Cerrar
                      </IonButton>
                    </div>
                  </IonToolbar>
                </IonHeader>

                <IonContent className="ion-padding">
                  <IonCard style={{ margin: "0 0 12px" }}>
                    <IonCardHeader>
                      <div className="admin-section-title-row">
                        <div>
                          <IonCardTitle>Problemas, llegada y accidentes</IonCardTitle>
                          <IonCardSubtitle>
                            Llegué bien / Llegué mal del pasajero y Reportar accidente del conductor.
                          </IonCardSubtitle>
                        </div>

                        <IonBadge color={pendingTripSafetyReports.length > 0 ? "warning" : "success"}>
                          {pendingTripSafetyReports.length} pendiente{pendingTripSafetyReports.length !== 1 ? "s" : ""}
                        </IonBadge>
                      </div>
                    </IonCardHeader>

                    <IonCardContent style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {tripSafetyReports.length === 0 ? (
                        <IonText color="medium">
                          <p style={{ margin: 0, fontWeight: 850 }}>
                            No hay reportes de viaje registrados.
                          </p>
                        </IonText>
                      ) : (
                        tripSafetyReports.map((report) => (
                          <IonCard key={report.id} style={{ margin: 0 }}>
                            <IonCardContent style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                                <div>
                                  <h3 style={{ margin: 0, fontWeight: 950 }}>
                                    {report.title}
                                  </h3>
                                  <p style={{ margin: "4px 0 0", color: "#4b5563", fontWeight: 800 }}>
                                    {report.originText || "Origen"} → {report.destinationText || "Destino"}
                                  </p>
                                </div>

                                <IonBadge color={adminTripSafetyStatusColor(report)}>
                                  {adminTripSafetyStatusLabel(report)}
                                </IonBadge>
                              </div>

                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                <div style={{ background: "#fff7e6", borderRadius: 14, padding: 10 }}>
                                  <strong>Reporta</strong>
                                  <div style={{ fontWeight: 950 }}>
                                    {report.reporterRole === "driver" ? "Conductor" : "Pasajero"}
                                  </div>
                                </div>

                                <div style={{ background: "#fff7e6", borderRadius: 14, padding: 10 }}>
                                  <strong>Fecha</strong>
                                  <div style={{ fontWeight: 950 }}>
                                    {formatAdminTripSafetyDate(report.createdAt)}
                                  </div>
                                </div>
                              </div>

                              <p style={{ margin: 0, fontWeight: 800, lineHeight: 1.35 }}>
                                {report.description}
                              </p>

                              <div style={{ fontSize: ".78rem", color: "#374151", fontWeight: 800, lineHeight: 1.35 }}>
                                {report.passengerName || report.passengerEmail ? (
                                  <div>Pasajero: {report.passengerName || report.passengerEmail}</div>
                                ) : null}
                                {report.driverName || report.driverEmail ? (
                                  <div>Conductor: {report.driverName || report.driverEmail}</div>
                                ) : null}
                                {report.whatsappOpened ? <div>WhatsApp soporte fue abierto desde la app.</div> : null}
                              </div>

                              {report.adminStatus !== "resolved" && report.status !== "arrived_well" && (
                                <IonButton
                                  size="small"
                                  color="success"
                                  onClick={() => {
                                    const next = markAdminTripSafetyReportResolved(report.id);
                                    setTripSafetyReports(next);
                                    setAdminCashToast("Reporte marcado como resuelto.");
                                  }}
                                >
                                  Marcar resuelto
                                </IonButton>
                              )}
                            </IonCardContent>
                          </IonCard>
                        ))
                      )}
                    </IonCardContent>
                  </IonCard>
                </IonContent>
              </IonModal>

              {/* rapago-admin-no-show-modal */}
              <IonModal
                className="rapago-admin-no-show-modal"
                isOpen={showAdminNoShowModal}
                onDidDismiss={() => setShowAdminNoShowModal(false)}
                breakpoints={[0, 0.72, 0.95]}
                initialBreakpoint={0.95}
              >
                <IonHeader>
                  <IonToolbar color="dark" className="rapago-no-show-toolbar">
                    <IonTitle>No Show</IonTitle>
                    <div slot="end" style={{ paddingRight: 8 }}>
                      <IonButton
                        fill="clear"
                        color="light"
                        onClick={() => setShowAdminNoShowModal(false)}
                      >
                        Cerrar
                      </IonButton>
                    </div>
                  </IonToolbar>
                </IonHeader>

                <IonContent className="ion-padding rapago-admin-no-show-content">
                  <IonCard className="admin-section-card">
                    <IonCardHeader>
                      <div className="admin-section-title-row">
                        <div>
                          <IonCardTitle>No Show</IonCardTitle>
                          <IonCardSubtitle>
                            Aquí se almacenan todos los No Show informados por conductores, tanto de efectivo como de tarjeta.
                            Aprueba para sumarlo al próximo viaje de la misma cuenta o rechaza para anular.
                          </IonCardSubtitle>
                        </div>

                        <IonBadge color={adminNoShowPendingReview.length > 0 ? "warning" : "success"}>
                          {adminNoShowPendingReview.length} por revisar
                        </IonBadge>
                      </div>
                    </IonCardHeader>

                    <IonCardContent style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {adminNoShowCharges.length === 0 ? (
                        <IonText color="medium">
                          <p style={{ margin: 0, fontWeight: 850 }}>
                            No hay No Show registrados.
                          </p>
                        </IonText>
                      ) : (
                        adminNoShowCharges.map((charge) => (
                          <IonCard key={charge.id} style={{ margin: 0 }}>
                            <IonCardContent style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                                <div>
                                  <h3 style={{ margin: 0, fontWeight: 950 }}>
                                    {charge.title || "No Show"}
                                  </h3>
                                  <AdminPassengerIdentityBlock
                                    source={charge}
                                    users={adminUsers}
                                    rides={adminRides}
                                  />
                                  <p style={{ margin: "5px 0 0", color: "#4b5563", fontWeight: 800 }}>
                                    Ruta: {charge.originText || "Origen"} → {charge.destinationText || "Destino"}
                                  </p>
                                </div>

                                <IonBadge color={adminPassengerChargeStatusColor(charge)}>
                                  {adminPassengerChargeStatusLabel(charge)}
                                </IonBadge>
                              </div>

                              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                                <div style={{ background: "#fff7e6", borderRadius: 14, padding: 10 }}>
                                  <strong>Cargo total</strong>
                                  <div style={{ fontWeight: 950 }}>
                                    {formatAdminCashClp(charge.amountClp)}
                                  </div>
                                </div>

                                <div style={{ background: "#fff7e6", borderRadius: 14, padding: 10 }}>
                                  <strong>Cobro</strong>
                                  <div style={{ fontWeight: 950 }}>
                                    {adminPassengerChargeBillingLabel(charge)}
                                  </div>
                                </div>

                                <div style={{ background: "#eefbf1", borderRadius: 14, padding: 10 }}>
                                  <strong>Conductor · 50%</strong>
                                  <div style={{ fontWeight: 950 }}>
                                    {formatAdminCashClp(getAdminNoShowDistribution(charge).driverShareClp)}
                                  </div>
                                </div>

                                <div style={{ background: "#eef4ff", borderRadius: 14, padding: 10 }}>
                                  <strong>Rapa Go · 50%</strong>
                                  <div style={{ fontWeight: 950 }}>
                                    {formatAdminCashClp(getAdminNoShowDistribution(charge).platformShareClp)}
                                  </div>
                                </div>
                              </div>

                              <div
                                style={{
                                  padding: 10,
                                  borderRadius: 14,
                                  background: "rgba(0,0,0,.04)",
                                  color: "#111",
                                  fontSize: ".78rem",
                                  fontWeight: 850,
                                  lineHeight: 1.35,
                                }}
                              >
                                Método original: <strong>{charge.paymentMethod || "No informado"}</strong>
                                <br />
                                El No Show no se descuenta automáticamente de una tarjeta. Primero debe aprobarlo el administrador y luego se suma al próximo viaje de la misma cuenta.
                              </div>

                              <p style={{ margin: 0, fontWeight: 800, lineHeight: 1.35 }}>
                                {charge.description || "No Show informado por conductor. El administrador debe aprobar o rechazar."}
                              </p>

                              {isAdminNoShowPendingReview(charge) && (
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                  <IonButton
                                    size="small"
                                    color="success"
                                    onClick={() => {
                                      if (!session?.accessToken) {
                                        setAdminCashToast("La sesión de administrador no está disponible.");
                                        return;
                                      }

                                      void approveAdminPassengerChargeInBackend(
                                        session.accessToken,
                                        charge,
                                      )
                                        .then(() => {
                                          setCashReviewsRevision((current) => current + 1);
                                          setAdminCashToast("No Show aprobado: 50% de la tarifa aplicable, tope $5.000. Al recaudarse se distribuirá 50% al conductor y 50% a Rapa Go.");
                                        })
                                        .catch((err) => {
                                          setAdminCashToast(
                                            err instanceof Error
                                              ? err.message
                                              : "No se pudo aprobar el No Show.",
                                          );
                                        });
                                    }}
                                  >
                                    Aprobar No Show
                                  </IonButton>

                                  <IonButton
                                    size="small"
                                    color="danger"
                                    fill="outline"
                                    onClick={() => setPendingChargeWaiver(charge)}
                                  >
                                    Eximir / rechazar
                                  </IonButton>
                                </div>
                              )}
                            </IonCardContent>
                          </IonCard>
                        ))
                      )}
                    </IonCardContent>
                  </IonCard>
                </IonContent>
              </IonModal>

<IonModal
                isOpen={showAdminChargesModal}
                onDidDismiss={() => setShowAdminChargesModal(false)}
                breakpoints={[0, 0.72, 0.95]}
                initialBreakpoint={0.95}
              >
                <IonHeader>
                  <IonToolbar color="dark">
                    <IonTitle>Cobranza y validación</IonTitle>
                    <div slot="end" style={{ paddingRight: 8 }}>
                      <IonButton
                        fill="clear"
                        color="light"
                        onClick={() => setShowAdminChargesModal(false)}
                      >
                        Cerrar
                      </IonButton>
                    </div>
                  </IonToolbar>
                </IonHeader>

                <IonContent className="ion-padding">
                  <IonCard
                    className="admin-section-card"
                    style={{
                      borderRadius: 22,
                      border: "1px solid rgba(218,170,65,.32)",
                      boxShadow: "0 16px 36px rgba(0,0,0,.10)",
                    }}
                  >
                    <IonCardHeader>
                      <div className="admin-section-title-row">
                        <div>
                          <IonCardTitle>Validación de cobranza</IonCardTitle>
                          <IonCardSubtitle>
                            Revisa cancelaciones, pagos en efectivo, saldos a favor y devoluciones. Los No Show se revisan en su botón exclusivo.
                          </IonCardSubtitle>
                        </div>
                        <IonBadge color={adminChargesTotalCount > 0 ? "warning" : "success"}>
                          {adminChargesTotalCount > 0
                            ? `${adminChargesTotalCount} pendiente${adminChargesTotalCount !== 1 ? "s" : ""}`
                            : "Al día"}
                        </IonBadge>
                      </div>
                    </IonCardHeader>
                    <IonCardContent>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 10,
                        }}
                      >
                        <div style={{ background: "#fff7ed", borderRadius: 16, padding: 12 }}>
                          <div style={{ fontSize: ".72rem", color: "#666", fontWeight: 900 }}>
                            Pendiente por cobrar
                          </div>
                          <div style={{ fontWeight: 950, color: "#111", fontSize: "1rem" }}>
                            {formatAdminCashClp(pendingPassengerChargeAmountClp)}
                          </div>
                        </div>
                        <div style={{ background: "#fffaf1", borderRadius: 16, padding: 12 }}>
                          <div style={{ fontSize: ".72rem", color: "#666", fontWeight: 900 }}>
                            Efectivo por revisar
                          </div>
                          <div style={{ fontWeight: 950, color: "#111", fontSize: "1rem" }}>
                            {formatAdminCashClp(pendingCashAmountClp)}
                          </div>
                        </div>
                        <div style={{ background: "#ecfdf5", borderRadius: 16, padding: 12 }}>
                          <div style={{ fontSize: ".72rem", color: "#166534", fontWeight: 900 }}>
                            Registros tarjeta
                          </div>
                          <div style={{ fontWeight: 950, color: "#111", fontSize: "1rem" }}>
                            {formatAdminCashClp(cardCancellationCreditsAmountClp)}
                          </div>
                        </div>
                      </div>
                    </IonCardContent>
                  </IonCard>

                  {adminCancellationCharges.length === 0 && cashPaymentReviews.length === 0 && cardCancellationCredits.length === 0 && (
                    <IonCard className="admin-section-card" style={{ borderRadius: 22 }}>
                      <IonCardContent>
                        <h2 style={{ margin: "0 0 6px", fontWeight: 950 }}>Sin cobranzas pendientes</h2>
                        <p style={{ margin: 0, color: "var(--ion-color-medium)", fontSize: ".86rem" }}>
                          Cuando existan cancelaciones fuera de plazo, pagos en efectivo con diferencia o devoluciones, aparecerán aquí. Los No Show se revisan en su módulo exclusivo.
                        </p>
                      </IonCardContent>
                    </IonCard>
                  )}

              {cardCancellationCredits.length > 0 && (
                <IonCard
                  className="admin-section-card"
                  style={{
                    borderRadius: 22,
                    border: "1px solid rgba(34,197,94,.30)",
                    boxShadow: "0 16px 36px rgba(0,0,0,.10)",
                  }}
                >
                  <IonCardHeader>
                    <div className="admin-section-title-row">
                      <div>
                        <IonCardTitle>DEVOLUCIONES DE TARJETA</IonCardTitle>
                        <IonCardSubtitle>
                          Cancelaciones con tarjeta pendientes de revisión o devolución. No forman parte de Beneficios por pago de más en efectivo.
                        </IonCardSubtitle>
                      </div>
                      <IonBadge color={cardRefundRequestsPending.length > 0 ? "warning" : "success"}>
                        {cardRefundRequestsPending.length > 0
                          ? `${cardRefundRequestsPending.length} devolución${cardRefundRequestsPending.length !== 1 ? "es" : ""}`
                          : "Sin pendientes"}
                      </IonBadge>
                    </div>
                  </IonCardHeader>

                  <IonCardContent>
                    <div
                      style={{
                        marginBottom: 12,
                        padding: 12,
                        borderRadius: 16,
                        background: "rgba(34,197,94,.10)",
                        border: "1px solid rgba(34,197,94,.28)",
                        color: "#14532d",
                        fontWeight: 850,
                        fontSize: ".82rem",
                        lineHeight: 1.35,
                      }}
                    >
                      Total registrado: <strong>{formatAdminCashClp(cardCancellationCreditsAmountClp)}</strong>.
                      Estos registros se validan administrativamente; no se acreditan como beneficio de efectivo.
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {cardCancellationCredits.slice(0, 10).map((credit) => {
                        const passengerLabel = credit.passengerEmail || credit.ownerKey || "Pasajero";
                        const cancellationFee = Math.max(0, Math.round(Number(credit.cancellationFeeClp ?? 0)));

                        return (
                          <div
                            key={credit.id}
                            style={{
                              padding: 12,
                              borderRadius: 18,
                              background: "#f0fdf4",
                              border: "1px solid rgba(20,83,45,.14)",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 950, color: "#111", fontSize: ".92rem" }}>
                                  REGISTRO DE TARJETA · {formatAdminCashClp(credit.amountClp)}
                                </div>
                                <div style={{ marginTop: 2, fontSize: ".76rem", color: "#14532d", fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {passengerLabel} · {credit.originText || "Origen"} → {credit.destinationText || "Destino"}
                                </div>
                              </div>
                              <IonBadge color={adminWalletCreditStatusColor(credit)}>
                                {adminWalletCreditStatusLabel(credit)}
                              </IonBadge>
                            </div>

                            <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(112px, 1fr))", gap: 8 }}>
                              <div style={{ background: "rgba(255,255,255,.75)", borderRadius: 12, padding: 8 }}>
                                <div style={{ fontSize: ".66rem", color: "#166534", fontWeight: 900 }}>Pago original</div>
                                <div style={{ fontWeight: 950, color: "#111", fontSize: ".82rem" }}>
                                  {credit.paidClp != null ? formatAdminCashClp(credit.paidClp) : "No informado"}
                                </div>
                              </div>
                              <div style={{ background: "rgba(255,255,255,.75)", borderRadius: 12, padding: 8 }}>
                                <div style={{ fontSize: ".66rem", color: "#166534", fontWeight: 900 }}>Penalización</div>
                                <div style={{ fontWeight: 950, color: "#111", fontSize: ".82rem" }}>
                                  {formatAdminCashClp(cancellationFee)}
                                </div>
                              </div>
                              <div style={{ background: "rgba(255,255,255,.75)", borderRadius: 12, padding: 8 }}>
                                <div style={{ fontSize: ".66rem", color: "#166534", fontWeight: 900 }}>Monto a devolver</div>
                                <div style={{ fontWeight: 950, color: "#111", fontSize: ".82rem" }}>
                                  {formatAdminCashClp(credit.amountClp)}
                                </div>
                              </div>
                            </div>

                            {credit.paymentId && (
                              <div style={{ marginTop: 8, padding: 9, borderRadius: 12, background: "rgba(255,255,255,.72)", color: "#111", fontSize: ".75rem", fontWeight: 850 }}>
                                ID pago: <strong>{credit.paymentId}</strong>
                              </div>
                            )}

                            {credit.description && (
                              <p style={{ margin: "8px 0 0", fontSize: ".76rem", color: "#14532d", lineHeight: 1.35, fontWeight: 800 }}>
                                {credit.description}
                              </p>
                            )}

                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                              {isAdminWalletCreditPending(credit) && (
                                <IonButton
                                  size="small"
                                  color="success"
                                  onClick={() => {
                                    const now = new Date().toISOString();
                                    const next = readAdminWalletBenefits().map((item) => {
                                      if (item.id !== credit.id) return item;

                                      return {
                                        ...item,
                                        status: "approved",
                                        adminReviewStatus: "admin_approved",
                                        approvedAt: item.approvedAt ?? now,
                                        approvedBy: item.approvedBy ?? "admin",
                                      };
                                    });

                                    writeAdminWalletBenefits(next);
                                    setCashReviewsRevision((current) => current + 1);
                                    setAdminCashToast(
                                      "Registro de tarjeta aprobado por el administrador.",
                                    );
                                  }}
                                >
                                  Aprobar registro
                                </IonButton>
                              )}

                              {credit.refundWhatsappAvailable && !isAdminWalletCreditRefundCompleted(credit) && (
                                <IonButton
                                  size="small"
                                  color="success"
                                  fill="outline"
                                  onClick={() => openAdminWalletCreditRefundWhatsApp(credit)}
                                >
                                  WhatsApp devolución
                                </IonButton>
                              )}

                              {credit.refundWhatsappAvailable && !isAdminWalletCreditRefundCompleted(credit) && (
                                <IonButton
                                  size="small"
                                  color="medium"
                                  fill="outline"
                                  onClick={() => {
                                    markAdminWalletCreditRefundCompleted(credit);
                                    setCashReviewsRevision((current) => current + 1);
                                    setAdminCashToast("Devolución marcada como gestionada.");
                                  }}
                                >
                                  Marcar devolución gestionada
                                </IonButton>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </IonCardContent>
                </IonCard>
              )}

              {adminCancellationCharges.length > 0 && (
                <IonCard
                  className="admin-section-card"
                  style={{
                    borderRadius: 22,
                    border: "1px solid rgba(220,38,38,.28)",
                    boxShadow: "0 16px 36px rgba(0,0,0,.10)",
                  }}
                >
                  <IonCardHeader>
                    <div className="admin-section-title-row">
                      <div>
                        <IonCardTitle>Cargos por cancelación</IonCardTitle>
                        <IonCardSubtitle>
                          Tanto efectivo como tarjeta quedan sujetos a aprobación del administrador y se suman al próximo viaje. Los No Show están en su botón exclusivo.
                        </IonCardSubtitle>
                      </div>
                      <IonBadge color={passengerChargesPendingNextRide.length > 0 ? "danger" : "success"}>
                        {passengerChargesPendingNextRide.length > 0
                          ? `${passengerChargesPendingNextRide.length} por cobrar`
                          : "Al día"}
                      </IonBadge>
                    </div>
                  </IonCardHeader>

                  <IonCardContent>
                    {pendingPassengerChargeAmountClp > 0 && (
                      <div
                        style={{
                          marginBottom: 12,
                          padding: 12,
                          borderRadius: 16,
                          background: "rgba(220,38,38,.10)",
                          border: "1px solid rgba(220,38,38,.26)",
                          color: "#7f1d1d",
                          fontWeight: 850,
                          fontSize: ".82rem",
                          lineHeight: 1.35,
                        }}
                      >
                        Hay {formatAdminCashClp(pendingPassengerChargeAmountClp)} en cancelaciones pendientes. No se descuenta automáticamente de la tarjeta: primero debe aprobarlo el administrador y luego se suma al próximo viaje de la misma cuenta.
                      </div>
                    )}

                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {adminCancellationCharges.slice(0, 8).map((charge) => {
                        const typeLabel = adminPassengerChargeTypeLabel(charge);

                        return (
                          <div
                            key={charge.id}
                            style={{
                              padding: 12,
                              borderRadius: 18,
                              background: "#fff7ed",
                              border: "1px solid rgba(0,0,0,.07)",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 950, color: "#111", fontSize: ".92rem" }}>
                                  {typeLabel} · {formatAdminCashClp(charge.amountClp)}
                                </div>
                                <AdminPassengerIdentityBlock
                                  source={charge}
                                  users={adminUsers}
                                  rides={adminRides}
                                  compact
                                />
                                <div style={{ marginTop: 4, fontSize: ".72rem", color: "#555", fontWeight: 750, overflowWrap: "anywhere" }}>
                                  Ruta: {charge.originText || "Origen"} → {charge.destinationText || "Destino"}
                                </div>
                              </div>
                              <IonBadge color={adminPassengerChargeStatusColor(charge)}>
                                {adminPassengerChargeStatusLabel(charge)}
                              </IonBadge>
                            </div>

                            <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                              <div style={{ background: "rgba(0,0,0,.035)", borderRadius: 12, padding: 8 }}>
                                <div style={{ fontSize: ".66rem", color: "#666", fontWeight: 900 }}>Cargo</div>
                                <div style={{ fontWeight: 950, color: "#111", fontSize: ".82rem" }}>{formatAdminCashClp(charge.amountClp)}</div>
                              </div>
                              <div style={{ background: "rgba(0,0,0,.035)", borderRadius: 12, padding: 8 }}>
                                <div style={{ fontSize: ".66rem", color: "#666", fontWeight: 900 }}>Cobro</div>
                                <div style={{ fontWeight: 950, color: "#111", fontSize: ".82rem" }}>
                                  {adminPassengerChargeBillingLabel(charge)}
                                </div>
                              </div>
                            </div>

                            {charge.paymentMethod && (
                              <div style={{ marginTop: 8, padding: 9, borderRadius: 12, background: "rgba(255,255,255,.68)", color: "#111", fontSize: ".76rem", fontWeight: 850 }}>
                                Método original: <strong>{charge.paymentMethod}</strong>
                                {String(charge.paymentMethod).toLowerCase().includes("tarjeta") || String(charge.paymentMethod).toLowerCase().includes("mercado") || String(charge.paymentMethod).toLowerCase().includes("pronto") ? (
                                  <><br />💳 Tarjeta/MercadoPago: no se descuenta automáticamente. Tras aprobación se suma al próximo viaje.</>
                                ) : (
                                  <><br />💵 Efectivo/sin pago: tras aprobación queda pendiente para el próximo viaje.</>
                                )}
                              </div>
                            )}

                            {charge.description && (
                              <p style={{ margin: "8px 0 0", fontSize: ".76rem", color: "#7c2d12", lineHeight: 1.35, fontWeight: 800 }}>
                                {charge.description}
                              </p>
                            )}

                            {charge.cancellationReasonLabel && (
                              <div style={{ marginTop: 8, padding: 9, borderRadius: 12, background: charge.requestedExemption ? "rgba(245,158,11,.14)" : "rgba(0,0,0,.04)", color: "#111", fontSize: ".76rem", fontWeight: 850 }}>
                                Motivo informado: <strong>{charge.cancellationReasonLabel}</strong>
                                {charge.requestedExemption && (
                                  <><br />⚠ Solicitud de exención: el administrador debe revisar antes de cobrar.</>
                                )}
                              </div>
                            )}

                            {charge.adminDecisionReason && (
                              <div style={{ marginTop: 8, padding: 9, borderRadius: 12, background: "rgba(22,163,74,.10)", color: "#14532d", fontSize: ".76rem", fontWeight: 850 }}>
                                Decisión admin: {charge.adminDecisionReason}
                              </div>
                            )}

                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                              {isAdminPassengerChargeAwaitingDecision(charge) && (
                                <>
                                  <IonButton
                                    size="small"
                                    color="success"
                                    onClick={() => {
                                      if (!session?.accessToken) {
                                        setAdminCashToast("La sesión de administrador no está disponible.");
                                        return;
                                      }

                                      void approveAdminPassengerChargeInBackend(
                                        session.accessToken,
                                        charge,
                                      )
                                        .then(() => {
                                          setCashReviewsRevision((current) => current + 1);
                                          setAdminCashToast(
                                            "Cancelación aprobada: 30% con tope de $3.000. Quedó guardada en backend y se sumará al próximo viaje.",
                                          );
                                        })
                                        .catch((err) => {
                                          setAdminCashToast(
                                            err instanceof Error
                                              ? err.message
                                              : "No se pudo aprobar el cargo.",
                                          );
                                        });
                                    }}
                                  >
                                    Aprobar cargo
                                  </IonButton>

                                  <IonButton
                                    size="small"
                                    color="medium"
                                    fill="outline"
                                    onClick={() => setPendingChargeWaiver(charge)}
                                  >
                                    Eximir / anular
                                  </IonButton>
                                </>
                              )}
                              {String(charge.status).toLowerCase() === "applied_to_next_ride" && (
                                <IonButton
                                  size="small"
                                  color="success"
                                  onClick={() => {
                                    markAdminPassengerChargeStatus(charge, "paid");
                                    setCashReviewsRevision((current) => current + 1);
                                    setAdminCashToast("Cargo marcado como pagado.");
                                  }}
                                >
                                  Marcar pagado
                                </IonButton>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </IonCardContent>
                </IonCard>
              )}

              {cashPaymentReviews.length > 0 && (
                <IonCard
                  className="admin-section-card"
                  style={{
                    borderRadius: 22,
                    border: "1px solid rgba(218,170,65,.32)",
                    boxShadow: "0 16px 36px rgba(0,0,0,.10)",
                  }}
                >
                  <IonCardHeader>
                    <div className="admin-section-title-row">
                      <div>
                        <IonCardTitle>Pagos en efectivo</IonCardTitle>
                        <IonCardSubtitle>
                          Saldos a favor y devoluciones solicitadas por usuarios
                        </IonCardSubtitle>
                      </div>
                      <IonBadge color={pendingCashPaymentReviews.length > 0 ? "warning" : "success"}>
                        {pendingCashPaymentReviews.length > 0
                          ? `${pendingCashPaymentReviews.length} pendiente${pendingCashPaymentReviews.length !== 1 ? "s" : ""}`
                          : "Al día"}
                      </IonBadge>
                    </div>
                  </IonCardHeader>

                  <IonCardContent>
                    {pendingCashPaymentReviews.length > 0 && (
                      <div
                        style={{
                          marginBottom: 12,
                          padding: 12,
                          borderRadius: 16,
                          background: "rgba(255,196,9,.14)",
                          border: "1px solid rgba(255,196,9,.35)",
                          fontWeight: 850,
                          fontSize: ".82rem",
                          lineHeight: 1.35,
                        }}
                      >
                        Hay {formatAdminCashClp(pendingCashAmountClp)} por revisar entre saldos a favor y devoluciones.
                      </div>
                    )}

                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {cashPaymentReviews.slice(0, 8).map((review) => {
                        const isWallet = review.decision === "wallet_credit";
                        const isRefund = review.decision === "refund_whatsapp";
                        const isDriverReview = review.decision === "driver_overpaid";
                        const driverPaidClp = Number(review.driverPaidClp ?? 0);
                        const passengerPaidClp = Number(review.passengerPaidClp ?? 0);
                        const driverOverpaidClp = Number(review.driverOverpaidClp ?? 0);
                        const passengerOverpaidClp = Number(review.passengerOverpaidClp ?? 0);
                        const versionDifferenceClp = Number(review.versionDifferenceClp ?? 0);
                        const passengerChoice = review.passengerWantsWalletCredit
                          ? "Quiere saldo para próximo viaje"
                          : review.passengerWantsRefund
                            ? "Pidió devolución"
                            : passengerPaidClp > 0
                              ? "Declaró pago"
                              : "Sin declaración de usuario";

                        return (
                          <div
                            key={review.rideKey || review.rideId || review.id}
                            style={{
                              padding: 12,
                              borderRadius: 18,
                              background: "#fffaf1",
                              border: "1px solid rgba(0,0,0,.07)",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: 8,
                                alignItems: "flex-start",
                              }}
                            >
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 950, color: "#111", fontSize: ".92rem" }}>
                                  {adminCashReviewDecisionLabel(review)} · {formatAdminCashClp(review.overpaidClp)}
                                </div>
                                <AdminPassengerIdentityBlock
                                  source={review}
                                  users={adminUsers}
                                  rides={adminRides}
                                  compact
                                />
                                <div
                                  style={{
                                    marginTop: 4,
                                    fontSize: ".72rem",
                                    color: "#555",
                                    fontWeight: 750,
                                    overflowWrap: "anywhere",
                                  }}
                                >
                                  Ruta: {review.originText || "Origen"} → {review.destinationText || "Destino"}
                                </div>
                              </div>

                              <IonBadge color={adminCashReviewStatusColor(review)}>
                                {adminCashReviewStatusLabel(review)}
                              </IonBadge>
                            </div>

                            <div
                              style={{
                                marginTop: 10,
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(112px, 1fr))",
                                gap: 8,
                              }}
                            >
                              <div style={{ background: "rgba(0,0,0,.035)", borderRadius: 12, padding: 8 }}>
                                <div style={{ fontSize: ".66rem", color: "#666", fontWeight: 900 }}>Precio app</div>
                                <div style={{ fontWeight: 950, color: "#111", fontSize: ".82rem" }}>{formatAdminCashClp(review.fareClp)}</div>
                              </div>
                              <div style={{ background: "rgba(22,101,52,.08)", borderRadius: 12, padding: 8 }}>
                                <div style={{ fontSize: ".66rem", color: "#166534", fontWeight: 900 }}>Conductor declaró</div>
                                <div style={{ fontWeight: 950, color: "#111", fontSize: ".82rem" }}>{driverPaidClp > 0 ? formatAdminCashClp(driverPaidClp) : "No informado"}</div>
                                {driverOverpaidClp > 0 && <div style={{ marginTop: 2, fontSize: ".66rem", color: "#166534", fontWeight: 900 }}>Pagó demás: {formatAdminCashClp(driverOverpaidClp)}</div>}
                              </div>
                              <div style={{ background: "rgba(37,99,235,.08)", borderRadius: 12, padding: 8 }}>
                                <div style={{ fontSize: ".66rem", color: "#1d4ed8", fontWeight: 900 }}>Usuario declaró</div>
                                <div style={{ fontWeight: 950, color: "#111", fontSize: ".82rem" }}>{passengerPaidClp > 0 ? formatAdminCashClp(passengerPaidClp) : "No informado"}</div>
                                {passengerOverpaidClp > 0 && <div style={{ marginTop: 2, fontSize: ".66rem", color: "#1d4ed8", fontWeight: 900 }}>Pagó demás: {formatAdminCashClp(passengerOverpaidClp)}</div>}
                              </div>
                              <div style={{ background: versionDifferenceClp > 0 ? "rgba(245,158,11,.16)" : "rgba(0,0,0,.035)", borderRadius: 12, padding: 8 }}>
                                <div style={{ fontSize: ".66rem", color: "#92400e", fontWeight: 900 }}>Diferencia versiones</div>
                                <div style={{ fontWeight: 950, color: "#111", fontSize: ".82rem" }}>{versionDifferenceClp > 0 ? formatAdminCashClp(versionDifferenceClp) : "Sin diferencia"}</div>
                              </div>
                            </div>

                            <div
                              style={{
                                marginTop: 10,
                                padding: 10,
                                borderRadius: 14,
                                background: "rgba(255,255,255,.76)",
                                border: "1px solid rgba(0,0,0,.06)",
                                color: "#111",
                                fontSize: ".76rem",
                                fontWeight: 850,
                                lineHeight: 1.36,
                              }}
                            >
                              <strong>Revisión separada:</strong><br />
                              Conductor: {driverPaidClp > 0 ? formatAdminCashClp(driverPaidClp) : "sin monto"} · Usuario: {passengerPaidClp > 0 ? formatAdminCashClp(passengerPaidClp) : "sin monto"}.
                              <br />Decisión usuario: <strong>{passengerChoice}</strong>.
                              {review.passengerWantsWalletCredit && passengerOverpaidClp > 0 && (
                                <><br />Si apruebas, {formatAdminCashClp(passengerOverpaidClp)} quedará disponible exclusivamente para la cuenta que realizó el viaje.</>
                              )}
                            </div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                              {isWallet && !isAdminCashWalletApproved(review) && !isAdminCashWalletRejected(review) && (
                                <IonButton
                                  size="small"
                                  color="success"
                                  onClick={() => {
                                    void (async () => {
                                      try {
                                        await approveAdminCashWalletCredit(
                                          session?.accessToken ?? "",
                                          review,
                                          adminUsers,
                                        );
                                        setCashReviewsRevision((current) => current + 1);
                                        setAdminCashToast(
                                          "Saldo a favor aprobado en backend y disponible únicamente para la cuenta propietaria.",
                                        );
                                      } catch (err) {
                                        setAdminCashToast(
                                          err instanceof Error
                                            ? err.message
                                            : "No se pudo aprobar el saldo a favor.",
                                        );
                                      }
                                    })();
                                  }}
                                >
                                  Aprobar saldo
                                </IonButton>
                              )}

                              {isWallet && !isAdminCashWalletApproved(review) && !isAdminCashWalletRejected(review) && (
                                <IonButton
                                  size="small"
                                  color="danger"
                                  fill="outline"
                                  onClick={() => {
                                    const reason = window.prompt(
                                      "Motivo del rechazo del Beneficio:",
                                      "El monto informado no coincide con la revisión del viaje.",
                                    );
                                    if (reason == null) return;

                                    void (async () => {
                                      try {
                                        await rejectAdminCashWalletCredit(
                                          session?.accessToken ?? "",
                                          review,
                                          reason,
                                        );
                                        setCashReviewsRevision((current) => current + 1);
                                        setAdminCashToast(
                                          "Solicitud de Beneficio rechazada. El usuario verá el motivo.",
                                        );
                                      } catch (err) {
                                        setAdminCashToast(
                                          err instanceof Error
                                            ? err.message
                                            : "No se pudo rechazar el Beneficio.",
                                        );
                                      }
                                    })();
                                  }}
                                >
                                  Rechazar
                                </IonButton>
                              )}

                              {isWallet && isAdminCashWalletApproved(review) && (
                                <IonChip
                                  color="success"
                                  style={{
                                    margin: 0,
                                    fontWeight: 950,
                                    "--background": "rgba(34,197,94,.16)",
                                    "--color": "#166534",
                                  } as CSSProperties}
                                >
                                  <IonIcon icon={shieldCheckmarkOutline} />
                                  <IonLabel>Saldo aprobado</IonLabel>
                                </IonChip>
                              )}

                              {isRefund && !isAdminCashRefundCompleted(review) && (
                                <IonButton
                                  size="small"
                                  color="warning"
                                  onClick={() => {
                                    markAdminCashRefundCompleted(review);
                                    setCashReviewsRevision((current) => current + 1);
                                    setAdminCashToast("Devolución marcada como gestionada.");
                                  }}
                                >
                                  Marcar devolución gestionada
                                </IonButton>
                              )}

                              {isDriverReview && !isAdminCashWalletApproved(review) && (
                                <IonButton
                                  size="small"
                                  color="tertiary"
                                  onClick={() => {
                                    markAdminCashDriverReviewCompleted(review);
                                    setCashReviewsRevision((current) => current + 1);
                                    setAdminCashToast("Diferencia de efectivo marcada como revisada.");
                                  }}
                                >
                                  Marcar revisado
                                </IonButton>
                              )}

                              {review.rideId && (
                                <IonButton size="small" fill="clear" color="medium" routerLink={ROUTES.ADMIN.TRIPS}>
                                  Ver viajes
                                </IonButton>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </IonCardContent>
                </IonCard>
              )}
                </IonContent>
              </IonModal>

              {thisWeek.topDrivers.length > 0 && (
                <IonCard className="admin-section-card">
                  <IonCardHeader>
                    <IonCardTitle>Top conductores</IonCardTitle>
                    <IonCardSubtitle>Mejor rendimiento semanal</IonCardSubtitle>
                  </IonCardHeader>

                  <IonList className="admin-clean-list">
                    {thisWeek.topDrivers.map((driver, index) => (
                      <IonItem key={driver.driverId}>
                        <div slot="start" className="admin-rank-badge">
                          {index + 1}
                        </div>
                        <IonLabel>
                          <h3>{driver.name}</h3>
                          <p>
                            {driver.trips} viajes · $
                            {(driver.revenue / 100).toLocaleString("es-CL")}
                          </p>
                        </IonLabel>
                      </IonItem>
                    ))}
                  </IonList>
                </IonCard>
              )}

              {activity.length > 0 && (
                <IonCard className="admin-section-card">
                  <IonCardHeader>
                    <div className="admin-section-title-row">
                      <div>
                        <IonCardTitle>Actividad reciente</IonCardTitle>
                        <IonCardSubtitle>Últimos movimientos</IonCardSubtitle>
                      </div>
                      <IonButton
                        fill="clear"
                        size="small"
                        routerLink="/admin/activity"
                      >
                        Ver todo
                      </IonButton>
                    </div>
                  </IonCardHeader>

                  <IonList className="admin-clean-list">
                    {activity.map((item, index) => (
                      <IonItem key={`${item.timestamp}-${index}`}>
                        <div slot="start" className="admin-activity-icon">
                          <IonIcon
                            icon={item.type === "ride" ? carIcon : bookOutline}
                          />
                        </div>
                        <IonLabel>
                          <h3>{item.description}</h3>
                          <p>
                            {item.userName} · {timeAgo(item.timestamp)}
                          </p>
                        </IonLabel>
                      </IonItem>
                    ))}
                  </IonList>
                </IonCard>
              )}

              <IonCard className="admin-section-card admin-quick-card">
                <IonCardHeader>
                  <IonCardTitle>Más herramientas</IonCardTitle>
                  <IonCardSubtitle>
                    Opciones que no necesitan estar abajo
                  </IonCardSubtitle>
                </IonCardHeader>

                <IonCardContent>
                  <div className="admin-quick-grid">
                    {secondaryActions.map((action) => (
                      <IonButton
                        key={action.label}
                        routerLink={action.route}
                        fill="clear"
                        className="admin-quick-action"
                      >
                        <div className="admin-quick-action-inner">
                          <div className="admin-quick-icon">
                            <IonIcon icon={action.icon} />
                          </div>

                          <div>
                            <strong>{action.label}</strong>
                            <span>{action.description}</span>
                          </div>

                          <IonIcon
                            icon={chevronForward}
                            className="admin-quick-arrow"
                          />
                        </div>
                      </IonButton>
                    ))}
                  </div>
                </IonCardContent>
              </IonCard>
            </>
          )}
        </div>
      </IonContent>

      <IonAlert
        isOpen={pendingChargeWaiver !== null}
        header="Eximir o anular cargo"
        message={
          pendingChargeWaiver
            ? `Debes registrar una razón de auditoría para eximir el cargo de ${formatAdminCashClp(pendingChargeWaiver.amountClp)}.`
            : ""
        }
        inputs={[
          {
            name: "reason",
            type: "textarea",
            placeholder: "Ej.: discrepancia de conductor/vehículo, riesgo de seguridad, duplicidad de Plataforma o causa atribuible al Operador.",
            attributes: {
              maxlength: 260,
            },
          },
        ]}
        buttons={[
          {
            text: "Volver",
            role: "cancel",
            handler: () => setPendingChargeWaiver(null),
          },
          {
            text: "Confirmar exención",
            role: "destructive",
            handler: (data) => {
              if (!pendingChargeWaiver) return false;
              const reason = String(
                typeof data === "string" ? data : data?.reason ?? "",
              ).trim();
              if (reason.length < 8) {
                setAdminCashToast("Escribe una razón de al menos 8 caracteres.");
                return false;
              }

              if (isAdminNoShowCharge(pendingChargeWaiver)) {
                rejectAdminNoShowCharge(pendingChargeWaiver, reason);
              } else {
                markAdminPassengerChargeStatus(
                  pendingChargeWaiver,
                  "waived",
                  reason,
                );
              }
              setCashReviewsRevision((current) => current + 1);
              setAdminCashToast("Cargo eximido con razón de auditoría.");
              setPendingChargeWaiver(null);
              return true;
            },
          },
        ]}
        onDidDismiss={() => setPendingChargeWaiver(null)}
      />

      <IonToast
        isOpen={Boolean(adminCashToast)}
        message={adminCashToast ?? ""}
        duration={2200}
        color="success"
        onDidDismiss={() => setAdminCashToast(null)}
      />
    </IonPage>
  );
}
const ROLE_LABEL: Record<string, string> = {
  passenger: "Pasajero",
  driver: "Conductor",
  guide: "Guía",
  rental: "Arriendo",
  admin: "Admin",
};

const STATUS_COLOR: Record<string, string> = {
  pending: "warning",
  active: "success",
  suspended: "medium",
  banned: "danger",
  deleted: "dark",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  active: "Activo",
  suspended: "Suspendido",
  banned: "Bloqueado",
  deleted: "Eliminado/desactivado",
};

type AdminUserAccountStatus = "pending" | "active" | "suspended" | "banned" | "deleted";

type AdminUserAccountControl = {
  userId: string;
  status: AdminUserAccountStatus;
  reason?: string | null;
  updatedAt: string;
  blockedAt?: string | null;
  deletedAt?: string | null;
  restoredAt?: string | null;
};

type AdminUserAccountAction = "block" | "unblock" | "suspend" | "delete" | "restore";

type AdminUserAccountActionState = {
  user: AdminUserData;
  action: AdminUserAccountAction;
};

const ADMIN_USER_ACCOUNT_CONTROLS_KEY = "rapago_admin_user_account_controls_v1";
const ADMIN_USER_ACCOUNT_CONTROL_EVENT = "rapago:admin-user-account-control-updated";

function normalizeAdminUserAccountStatus(value: unknown): AdminUserAccountStatus {
  const raw = String(value ?? "").toLowerCase().trim();

  if (raw === "deleted" || raw === "removed" || raw === "inactive" || raw === "eliminado") {
    return "deleted";
  }

  if (raw === "banned" || raw === "blocked" || raw === "bloqueado") {
    return "banned";
  }

  if (raw === "suspended" || raw === "suspendido") {
    return "suspended";
  }

  if (raw === "pending" || raw === "pendiente") {
    return "pending";
  }

  return "active";
}

function readAdminUserAccountControls(): Record<string, AdminUserAccountControl> {
  try {
    const raw = localStorage.getItem(ADMIN_USER_ACCOUNT_CONTROLS_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, Partial<AdminUserAccountControl>>) : {};

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    return Object.entries(parsed).reduce<Record<string, AdminUserAccountControl>>((acc, [userId, value]) => {
      if (!userId || !value || typeof value !== "object") return acc;

      acc[userId] = {
        userId,
        status: normalizeAdminUserAccountStatus(value.status),
        reason: typeof value.reason === "string" ? value.reason : null,
        updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(),
        blockedAt: typeof value.blockedAt === "string" ? value.blockedAt : null,
        deletedAt: typeof value.deletedAt === "string" ? value.deletedAt : null,
        restoredAt: typeof value.restoredAt === "string" ? value.restoredAt : null,
      };

      return acc;
    }, {});
  } catch {
    return {};
  }
}

function writeAdminUserAccountControls(controls: Record<string, AdminUserAccountControl>): void {
  try {
    localStorage.setItem(ADMIN_USER_ACCOUNT_CONTROLS_KEY, JSON.stringify(controls));
    window.dispatchEvent(new CustomEvent(ADMIN_USER_ACCOUNT_CONTROL_EVENT, { detail: { controls } }));
  } catch {
    // No bloquea el panel admin si el navegador no permite localStorage.
  }
}

function getEffectiveAdminUserStatus(
  user: AdminUserData,
  controls: Record<string, AdminUserAccountControl>,
): AdminUserAccountStatus {
  const controlledStatus = controls[user.id]?.status;
  if (controlledStatus) return controlledStatus;

  return normalizeAdminUserAccountStatus(user.status);
}

function adminUserAccountActionLabel(action: AdminUserAccountAction): string {
  if (action === "block") return "Bloquear cuenta";
  if (action === "unblock") return "Desbloquear cuenta";
  if (action === "suspend") return "Suspender cuenta";
  if (action === "delete") return "Eliminar/desactivar cuenta";
  return "Restaurar cuenta";
}

function adminUserAccountActionMessage(action: AdminUserAccountAction, user: AdminUserData): string {
  const name = user.name || user.email || "este usuario";

  if (action === "delete") {
    return `¿Seguro que quieres eliminar/desactivar la cuenta de ${name}? No se borran viajes ni pagos; queda bloqueada y marcada como eliminada.`;
  }

  if (action === "block") {
    return `¿Seguro que quieres bloquear la cuenta de ${name}? No podrá usar la app hasta que el admin la desbloquee.`;
  }

  if (action === "suspend") {
    return `¿Suspender la cuenta de ${name}? Quedará pausada hasta que la actives nuevamente.`;
  }

  if (action === "unblock") {
    return `¿Desbloquear y activar la cuenta de ${name}?`;
  }

  return `¿Restaurar y activar la cuenta de ${name}?`;
}

type PassengerVerificationStatus =
  | "not_required"
  | "missing_document"
  | "pending"
  | "approved"
  | "rejected";

type ExtendedAdminUserData = AdminUserData & {
  phone?: string | null;
  cellphone?: string | null;
  mobile?: string | null;
  rut?: string | null;
  nationalId?: string | null;
  passengerCondition?: string | null;
  passengerConditionLegacy?: string | null;
  passengerFareType?: string | null;
  farePassengerType?: string | null;
  passengerType?: string | null;
  passengerFareLabel?: string | null;
  nationality?: string | null;
  registrationProvider?: string | null;
  authProvider?: string | null;
  provider?: string | null;
  isFacebookUser?: boolean | null;
  belongsToRapaNuiEthnicity?: boolean | null;
  residenceDocumentRequired?: boolean | null;
  residenceDocumentUploaded?: boolean | null;
  residenceVerificationStatus?: string | null;
  residenceDocumentStatus?: string | null;
  residenceDocumentUrl?: string | null;
  residenceDocumentName?: string | null;
  metadata?: Record<string, unknown> | null;
  profile?: Record<string, unknown> | null;
};

type ExtendedAdminDocumentData = AdminDocumentData & {
  userId?: string | null;
  userEmail?: string | null;
  userName?: string | null;
  documentType?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  originalName?: string | null;
  status?: string | null;
  reviewedAt?: string | null;
};

const RESIDENCE_DOCUMENT_TYPES = new Set([
  "residence_document",
  "rapa_nui_residence",
  "rapanui_residence",
  "resident_certificate",
  "rapa_nui_resident_certificate",
  "residente_rapa_nui_document",
]);

const RAPANUI_RESIDENCE_REJECTION_USER_MESSAGE =
  "Tu acreditación RAPA NUI / RESIDENTE RAPA NUI fue rechazada. El administrador actualizará tu categoría a Turista chileno o Turista extranjero según los antecedentes revisados.";

function valueFromRecord(
  source: Record<string, unknown> | null | undefined,
  keys: string[],
): string {
  if (!source) return "";

  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "boolean") return value ? "true" : "false";
  }

  return "";
}

function boolFromRecord(
  source: Record<string, unknown> | null | undefined,
  keys: string[],
): boolean | null {
  if (!source) return null;

  for (const key of keys) {
    const value = source[key];

    if (typeof value === "boolean") return value;

    if (typeof value === "string") {
      const normalized = value.toLowerCase().trim();
      if (["true", "si", "sí", "yes", "1"].includes(normalized)) return true;
      if (["false", "no", "0"].includes(normalized)) return false;
    }
  }

  return null;
}

function getUserMetaValue(user: AdminUserData, keys: string[]): string {
  const extended = user as ExtendedAdminUserData;

  return (
    valueFromRecord(extended as unknown as Record<string, unknown>, keys) ||
    valueFromRecord(extended.profile, keys) ||
    valueFromRecord(extended.metadata, keys)
  );
}

function getUserMetaBoolean(user: AdminUserData, keys: string[]): boolean | null {
  const extended = user as ExtendedAdminUserData;

  return (
    boolFromRecord(extended as unknown as Record<string, unknown>, keys) ??
    boolFromRecord(extended.profile, keys) ??
    boolFromRecord(extended.metadata, keys)
  );
}

function normalizeAdminText(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function getPassengerConditionText(user: AdminUserData): string {
  return getUserMetaValue(user, [
    "passengerCondition",
    "passengerConditionLegacy",
    "nationality",
    "passengerFareLabel",
    "passengerFareType",
    "farePassengerType",
    "passengerType",
  ]);
}

function isRapaNuiResidentUser(
  user: AdminUserData,
  docs: AdminDocumentData[] = [],
): boolean {
  const text = normalizeAdminText(getPassengerConditionText(user));
  const belongs = getUserMetaBoolean(user, [
    "belongsToRapaNuiEthnicity",
    "isRapaNui",
    "rapaNuiResident",
  ]);
  const hasResidenceDocument = docs.some(
    (doc) =>
      isActiveResidenceDocument(doc) &&
      sameUserForDocument(user, doc),
  );

  return (
    hasResidenceDocument ||
    belongs === true ||
    text.includes("residente_rapa_nui") ||
    text.includes("residente rapa nui") ||
    text.includes("rapa nui") ||
    text === "resident" ||
    text === "residente"
  );
}

function getPassengerLabel(user: AdminUserData): string {
  const text = normalizeAdminText(getPassengerConditionText(user));

  if (isRapaNuiResidentUser(user)) return "RAPA NUI / RESIDENTE RAPA NUI";
  if (text.includes("turista_chileno") || text.includes("chileno")) return "Turista chileno";
  if (text.includes("turista_extranjero") || text.includes("extranjero") || text.includes("foreigner")) return "Turista extranjero";

  return "Pasajero sin tipo";
}

function getRegistrationProviderLabel(user: AdminUserData): string {
  const extended = user as ExtendedAdminUserData;
  const raw =
    extended.registrationProvider ??
    extended.authProvider ??
    extended.provider ??
    getUserMetaValue(user, ["registrationProvider", "authProvider", "provider"]);

  if (extended.isFacebookUser || normalizeAdminText(raw).includes("facebook")) {
    return "Facebook";
  }

  return raw ? raw : "Registro normal";
}

function getPassengerPhone(user: AdminUserData): string {
  return getUserMetaValue(user, ["phone", "cellphone", "mobile", "celular"]);
}

function getPassengerRut(user: AdminUserData): string {
  return getUserMetaValue(user, ["rut", "nationalId", "documentNumber"]);
}

function isResidenceDocument(doc: AdminDocumentData): boolean {
  const extended = doc as ExtendedAdminDocumentData;
  const type = normalizeAdminText(extended.documentType);
  return RESIDENCE_DOCUMENT_TYPES.has(type) || type.includes("residence") || type.includes("residencia") || type.includes("rapa");
}

function isActiveResidenceDocument(
  doc: AdminDocumentData,
): boolean {
  if (!isResidenceDocument(doc)) return false;

  const status = normalizeAdminText(doc.status);

  return ![
    "withdrawn",
    "cancelled",
    "canceled",
    "abandoned",
    "retirado",
  ].includes(status);
}

type ResidentDocumentMetadata = {
  phone?: string | undefined;
  rut?: string | undefined;
  provider?: string | undefined;
  documentName?: string | undefined;
  documentType?: string | undefined;
  uploadedAt?: string | undefined;
};

const RESIDENT_DOCUMENT_META_MARKER = "#rapagoMeta=";

function getResidentDocumentMetadata(
  doc: AdminDocumentData | null | undefined,
): ResidentDocumentMetadata | null {
  const raw = String(
    (doc as ExtendedAdminDocumentData | null | undefined)
      ?.fileUrl ?? "",
  );
  const markerIndex = raw.indexOf(
    RESIDENT_DOCUMENT_META_MARKER,
  );

  if (markerIndex < 0) return null;

  try {
    const encoded = raw.slice(
      markerIndex + RESIDENT_DOCUMENT_META_MARKER.length,
    );
    const parsed = JSON.parse(
      decodeURIComponent(encoded),
    ) as Record<string, unknown>;

    return {
      phone:
        typeof parsed["phone"] === "string"
          ? parsed["phone"]
          : undefined,
      rut:
        typeof parsed["rut"] === "string"
          ? parsed["rut"]
          : undefined,
      provider:
        typeof parsed["provider"] === "string"
          ? parsed["provider"]
          : undefined,
      documentName:
        typeof parsed["documentName"] === "string"
          ? parsed["documentName"]
          : undefined,
      documentType:
        typeof parsed["documentType"] === "string"
          ? parsed["documentType"]
          : undefined,
      uploadedAt:
        typeof parsed["uploadedAt"] === "string"
          ? parsed["uploadedAt"]
          : undefined,
    };
  } catch {
    return null;
  }
}

function getResidentDocumentPreviewUrl(
  doc: AdminDocumentData | null | undefined,
): string {
  const raw = String(
    (doc as ExtendedAdminDocumentData | null | undefined)
      ?.fileUrl ?? "",
  );
  const markerIndex = raw.indexOf(
    RESIDENT_DOCUMENT_META_MARKER,
  );

  return markerIndex >= 0
    ? raw.slice(0, markerIndex)
    : raw;
}

function sameUserForDocument(user: AdminUserData, doc: AdminDocumentData): boolean {
  const extendedDoc = doc as ExtendedAdminDocumentData;
  const userEmail = normalizeAdminText(user.email);
  const docEmail = normalizeAdminText(extendedDoc.userEmail);
  const docUserId = String(extendedDoc.userId ?? "").trim();

  return Boolean(
    (docUserId && docUserId === user.id) ||
      (userEmail && docEmail && userEmail === docEmail),
  );
}

function getResidenceDocsForUser(
  user: AdminUserData,
  docs: AdminDocumentData[],
): AdminDocumentData[] {
  return docs.filter(
    (doc) =>
      isActiveResidenceDocument(doc) &&
      sameUserForDocument(user, doc),
  );
}

function getBestResidenceDocForUser(
  user: AdminUserData,
  docs: AdminDocumentData[],
): AdminDocumentData | null {
  const userDocs = getResidenceDocsForUser(user, docs);

  return (
    userDocs.find((doc) => ["pending", "uploaded"].includes(String(doc.status))) ??
    userDocs.find((doc) => String(doc.status) === "approved") ??
    userDocs.find((doc) => String(doc.status) === "rejected") ??
    null
  );
}

function getResidenceVerificationStatus(
  user: AdminUserData,
  docs: AdminDocumentData[],
): PassengerVerificationStatus {
  const doc = getBestResidenceDocForUser(user, docs);

  if (!isRapaNuiResidentUser(user, docs) && !doc) {
    return "not_required";
  }

  const extended = user as ExtendedAdminUserData;
  const backendStatus = normalizeAdminText(
    extended.residenceVerificationStatus ??
      extended.residenceDocumentStatus ??
      getUserMetaValue(user, ["residenceVerificationStatus", "residenceDocumentStatus"]),
  );

  if (backendStatus.includes("approved") || backendStatus.includes("aprobado")) return "approved";
  if (backendStatus.includes("rejected") || backendStatus.includes("rechazado")) return "rejected";
  if (backendStatus.includes("pending") || backendStatus.includes("uploaded") || backendStatus.includes("pendiente")) return "pending";

  if (!doc) {
    const uploaded = getUserMetaBoolean(user, ["residenceDocumentUploaded"]);
    return uploaded ? "pending" : "missing_document";
  }

  if (String(doc.status) === "approved") return "approved";
  if (String(doc.status) === "rejected") return "rejected";
  return "pending";
}

function residenceStatusLabel(status: PassengerVerificationStatus): string {
  if (status === "approved") return "Residencia aprobada";
  if (status === "rejected") return "Residencia rechazada";
  if (status === "pending") return "Documento pendiente";
  if (status === "missing_document") return "Falta documento";
  return "No requiere validación";
}

function residenceStatusColor(status: PassengerVerificationStatus): string {
  if (status === "approved") return "success";
  if (status === "rejected") return "danger";
  if (status === "pending") return "warning";
  if (status === "missing_document") return "danger";
  return "medium";
}

function getDocumentFileName(doc: AdminDocumentData): string {
  const extended = doc as ExtendedAdminDocumentData;
  const metadata = getResidentDocumentMetadata(doc);

  return (
    extended.fileName ??
    extended.originalName ??
    metadata?.documentName ??
    "Documento"
  );
}

function getLocalResidenceDocumentPreview(user: AdminUserData): string {
  const extended = user as ExtendedAdminUserData;

  return (
    extended.residenceDocumentUrl ||
    valueFromRecord(extended.profile, ["residenceDocumentUrl", "residenceDocumentDataUrl"]) ||
    valueFromRecord(extended.metadata, ["residenceDocumentUrl", "residenceDocumentDataUrl"])
  );
}


const RESIDENT_VERIFICATION_REQUESTS_KEY_ADMIN = "rapago_resident_verification_requests_v1";

type LocalResidentVerificationRequest = {
  id: string;
  userId?: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt?: string | null;
  updatedAt?: string | null;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  rut?: string | null;
  phone?: string | null;
  email?: string | null;
  passengerFareType?: string | null;
  passengerFareLabel?: string | null;
  nationality?: string | null;
  registrationProvider?: string | null;
  authProvider?: string | null;
  documentName?: string | null;
  documentType?: string | null;
  documentSizeBytes?: number | null;
  documentUploadedAt?: string | null;
  documentDataUrl?: string | null;
  reason?: string | null;
  userMessage?: string | null;
  adminMessage?: string | null;
  rejectionReason?: string | null;
};

function normalizeLocalResidentStatus(value: unknown): LocalResidentVerificationRequest["status"] {
  const raw = normalizeAdminText(value);
  if (raw.includes("approved") || raw.includes("aprobado")) return "approved";
  if (raw.includes("rejected") || raw.includes("rechazado")) return "rejected";
  return "pending";
}

function readLocalResidentVerificationRequestsForAdmin(): LocalResidentVerificationRequest[] {
  try {
    const raw = localStorage.getItem(RESIDENT_VERIFICATION_REQUESTS_KEY_ADMIN);
    const parsed = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];

    if (!Array.isArray(parsed)) return [];

    return parsed.map((item, index) => ({
      id: String(item.id ?? `resident-validation-${index}`),
      userId: typeof item.userId === "string" ? item.userId : null,
      status: normalizeLocalResidentStatus(item.status),
      createdAt: typeof item.createdAt === "string" ? item.createdAt : null,
      updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : null,
      name: typeof item.name === "string" ? item.name : null,
      firstName: typeof item.firstName === "string" ? item.firstName : null,
      lastName: typeof item.lastName === "string" ? item.lastName : null,
      rut: typeof item.rut === "string" ? item.rut : null,
      phone: typeof item.phone === "string" ? item.phone : null,
      email: typeof item.email === "string" ? item.email : null,
      passengerFareType: typeof item.passengerFareType === "string" ? item.passengerFareType : null,
      passengerFareLabel: typeof item.passengerFareLabel === "string" ? item.passengerFareLabel : null,
      nationality: typeof item.nationality === "string" ? item.nationality : null,
      registrationProvider: typeof item.registrationProvider === "string" ? item.registrationProvider : null,
      authProvider: typeof item.authProvider === "string" ? item.authProvider : null,
      documentName: typeof item.documentName === "string" ? item.documentName : null,
      documentType: typeof item.documentType === "string" ? item.documentType : null,
      documentSizeBytes:
        typeof item.documentSizeBytes === "number" && Number.isFinite(item.documentSizeBytes)
          ? item.documentSizeBytes
          : null,
      documentUploadedAt: typeof item.documentUploadedAt === "string" ? item.documentUploadedAt : null,
      documentDataUrl: typeof item.documentDataUrl === "string" ? item.documentDataUrl : null,
      reason: typeof item.reason === "string" ? item.reason : null,
      userMessage: typeof item.userMessage === "string" ? item.userMessage : null,
      adminMessage: typeof item.adminMessage === "string" ? item.adminMessage : null,
      rejectionReason: typeof item.rejectionReason === "string" ? item.rejectionReason : null,
    }));
  } catch {
    return [];
  }
}

function saveLocalResidentVerificationRequestsForAdmin(
  requests: LocalResidentVerificationRequest[],
): void {
  try {
    localStorage.setItem(
      RESIDENT_VERIFICATION_REQUESTS_KEY_ADMIN,
      JSON.stringify(requests),
    );
    window.dispatchEvent(new CustomEvent("rapago:resident-verification-updated"));
  } catch {
    // No bloquea el panel admin.
  }
}

function reviewLocalResidentVerificationRequestForAdmin(
  requestId: string,
  status: "approved" | "rejected",
  rejectionReason?: string,
): LocalResidentVerificationRequest[] {
  const updated = readLocalResidentVerificationRequestsForAdmin().map((request) => {
    if (request.id !== requestId) return request;

    return {
      ...request,
      status,
      updatedAt: new Date().toISOString(),
      rejectionReason: status === "rejected"
        ? rejectionReason || RAPANUI_RESIDENCE_REJECTION_USER_MESSAGE
        : "",
      adminMessage: status === "approved"
        ? "Residencia Rapa Nui aprobada por el administrador."
        : rejectionReason || RAPANUI_RESIDENCE_REJECTION_USER_MESSAGE,
      userMessage: status === "approved"
        ? "Tu residencia Rapa Nui fue aprobada. Ya puedes continuar con Rapa Go."
        : rejectionReason || RAPANUI_RESIDENCE_REJECTION_USER_MESSAGE,
    };
  });

  saveLocalResidentVerificationRequestsForAdmin(updated);
  return updated;
}


export function AdminUsersPage(): JSX.Element {
  const { session } = useAuth();

  const [users, setUsers] = useState<AdminUserData[]>([]);
  const [docs, setDocs] = useState<AdminDocumentData[]>([]);
  const [residentRequests, setResidentRequests] = useState<LocalResidentVerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [filterRole, setFilterRole] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSearch, setFilterSearch] = useState("");

  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [accountControls, setAccountControls] = useState<Record<string, AdminUserAccountControl>>(
    () => readAdminUserAccountControls(),
  );
  const [confirmAccountAction, setConfirmAccountAction] =
    useState<AdminUserAccountActionState | null>(null);

  const loadUsers = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setLoadError(null);

    try {
      const params: { role?: string; status?: string; search?: string } = {};

      if (filterRole) params.role = filterRole;
      if (filterStatus && filterStatus !== "deleted") params.status = filterStatus;
      if (filterSearch.trim()) params.search = filterSearch.trim();

      const [userData, documentData] = await Promise.all([
        adminService.listUsers(session.accessToken, params),
        adminService
          .listDocuments(session.accessToken, {})
          .catch(() => [] as AdminDocumentData[]),
      ]);

      const controls = readAdminUserAccountControls();

      setUsers(
        filterStatus === "deleted"
          ? userData.filter((user) => getEffectiveAdminUserStatus(user, controls) === "deleted")
          : userData,
      );
      setDocs(documentData);
      setResidentRequests(readLocalResidentVerificationRequestsForAdmin());
      setAccountControls(controls);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Error al cargar usuarios.",
      );
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, filterRole, filterStatus, filterSearch]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    const refreshLocalResidentRequests = () => {
      setResidentRequests(readLocalResidentVerificationRequestsForAdmin());
    };

    refreshLocalResidentRequests();

    window.addEventListener("storage", refreshLocalResidentRequests);
    window.addEventListener(
      "rapago:resident-verification-updated",
      refreshLocalResidentRequests as EventListener,
    );

    return () => {
      window.removeEventListener("storage", refreshLocalResidentRequests);
      window.removeEventListener(
        "rapago:resident-verification-updated",
        refreshLocalResidentRequests as EventListener,
      );
    };
  }, []);

  useEffect(() => {
    const refreshAccountControls = () => {
      setAccountControls(readAdminUserAccountControls());
    };

    window.addEventListener("storage", refreshAccountControls);
    window.addEventListener(
      ADMIN_USER_ACCOUNT_CONTROL_EVENT,
      refreshAccountControls as EventListener,
    );

    return () => {
      window.removeEventListener("storage", refreshAccountControls);
      window.removeEventListener(
        ADMIN_USER_ACCOUNT_CONTROL_EVENT,
        refreshAccountControls as EventListener,
      );
    };
  }, []);

  async function handleStatusChange(userId: string, newStatus: string) {
    if (!session?.accessToken) return;

    const user = users.find((item) => item.id === userId);
    const normalizedNewStatus = normalizeAdminUserAccountStatus(newStatus);
    const residenceStatus = user
      ? getResidenceVerificationStatus(user, docs)
      : "not_required";

    if (user && normalizedNewStatus === "deleted") {
      setConfirmAccountAction({ user, action: "delete" });
      return;
    }


    setUpdatingId(userId);
    setUpdateError(null);

    try {
      const updated = await adminService.updateUserStatus(
        session.accessToken,
        userId,
        normalizedNewStatus === "deleted" ? "banned" : normalizedNewStatus,
      );

      const now = new Date().toISOString();

      setAccountControls((current) => {
        const next = { ...current };

        if (normalizedNewStatus === "active") {
          delete next[userId];
        } else {
          next[userId] = {
            userId,
            status: normalizedNewStatus,
            reason:
              normalizedNewStatus === "banned"
                ? "Cuenta bloqueada por administración."
                : normalizedNewStatus === "suspended"
                  ? "Cuenta suspendida por administración."
                  : "Estado actualizado por administración.",
            updatedAt: now,
            blockedAt: normalizedNewStatus === "banned" ? now : current[userId]?.blockedAt ?? null,
            deletedAt: current[userId]?.deletedAt ?? null,
            restoredAt: current[userId]?.restoredAt ?? null,
          };
        }

        writeAdminUserAccountControls(next);
        return next;
      });

      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
      setToastMessage("Estado del usuario actualizado.");
    } catch (err) {
      setUpdateError(
        err instanceof Error ? err.message : "Error al actualizar estado.",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleConfirmedAccountAction(): Promise<void> {
    if (!session?.accessToken || !confirmAccountAction) return;

    const { user, action } = confirmAccountAction;
    const now = new Date().toISOString();

    const backendStatus =
      action === "delete" || action === "block"
        ? "banned"
        : action === "suspend"
          ? "suspended"
          : "active";


    setUpdatingId(user.id);
    setUpdateError(null);

    try {
      const updated = await adminService.updateUserStatus(
        session.accessToken,
        user.id,
        backendStatus,
      );

      setAccountControls((current) => {
        const next = { ...current };

        if (action === "unblock" || action === "restore") {
          delete next[user.id];
        } else {
          next[user.id] = {
            userId: user.id,
            status:
              action === "delete"
                ? "deleted"
                : action === "block"
                  ? "banned"
                  : "suspended",
            reason:
              action === "delete"
                ? "Cuenta eliminada/desactivada por administración."
                : action === "block"
                  ? "Cuenta bloqueada por administración."
                  : "Cuenta suspendida por administración.",
            updatedAt: now,
            blockedAt: action === "delete" || action === "block" ? now : current[user.id]?.blockedAt ?? null,
            deletedAt: action === "delete" ? now : current[user.id]?.deletedAt ?? null,
            restoredAt: null,
          };
        }

        writeAdminUserAccountControls(next);
        return next;
      });

      setUsers((prev) => prev.map((item) => (item.id === user.id ? updated : item)));

      setToastMessage(
        action === "delete"
          ? "Cuenta eliminada/desactivada. Quedó bloqueada y no se borró su historial."
          : action === "block"
            ? "Cuenta bloqueada."
            : action === "suspend"
              ? "Cuenta suspendida."
              : "Cuenta restaurada y activa.",
      );
    } catch (err) {
      setUpdateError(
        err instanceof Error ? err.message : "No se pudo actualizar la cuenta.",
      );
    } finally {
      setUpdatingId(null);
      setConfirmAccountAction(null);
    }
  }

  function approveLocalResidentRequest(requestId: string): void {
    setResidentRequests(
      reviewLocalResidentVerificationRequestForAdmin(requestId, "approved"),
    );
    setToastMessage("Acreditación aprobada. La categoría RAPA NUI / RESIDENTE RAPA NUI se mantiene activa.");
  }

  function rejectLocalResidentRequest(requestId: string): void {
    setResidentRequests(
      reviewLocalResidentVerificationRequestForAdmin(
        requestId,
        "rejected",
        RAPANUI_RESIDENCE_REJECTION_USER_MESSAGE,
      ),
    );
    setToastMessage("Acreditación rechazada. Debes confirmar la categoría correcta del usuario desde Documentos.");
  }

  async function approveRapaNuiUser(user: AdminUserData) {
    if (!session?.accessToken) return;

    const doc = getBestResidenceDocForUser(user, docs);

    if (!doc) {
      setUpdateError(
        "Este usuario todavía no tiene una acreditación adjunta para revisar.",
      );
      return;
    }

    if (!isResidenceDocument(doc)) {
      setUpdateError("El archivo encontrado no corresponde a una acreditación de residencia.");
      return;
    }

    setUpdatingId(user.id);
    setUpdateError(null);

    try {
      const approvedDoc =
        String(doc.status) === "approved"
          ? doc
          : await adminService.reviewDocument(
              session.accessToken,
              doc.id,
              "approved",
            );

      const updatedUser = await adminService.updateUserStatus(
        session.accessToken,
        user.id,
        "active",
      );

      setDocs((prev) =>
        prev.map((item) => (item.id === approvedDoc.id ? approvedDoc : item)),
      );
      setUsers((prev) =>
        prev.map((item) => (item.id === user.id ? updatedUser : item)),
      );

      setToastMessage(
        "Acreditación aprobada. La cuenta permanece activa como RAPA NUI / RESIDENTE RAPA NUI.",
      );
    } catch (err) {
      setUpdateError(
        err instanceof Error
          ? err.message
          : "No se pudo aprobar la residencia.",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  async function rejectRapaNuiUser(user: AdminUserData) {
    if (!session?.accessToken) return;

    const doc = getBestResidenceDocForUser(user, docs);

    if (!doc) {
      setUpdateError("No hay documento de residencia para rechazar.");
      return;
    }

    const classificationInput = window.prompt(
      "Clasificación correcta: escribe CHILENO o EXTRANJERO.",
      "CHILENO",
    );
    const normalizedClassification = String(
      classificationInput ?? "",
    )
      .trim()
      .toLowerCase();
    const reclassifiedFareType = normalizedClassification.startsWith("e")
      ? "foreigner"
      : normalizedClassification.startsWith("c")
        ? "chilean"
        : null;

    if (!reclassifiedFareType) {
      setUpdateError(
        "Debes elegir Turista chileno o Turista extranjero.",
      );
      return;
    }

    const reason = window.prompt(
      "Escribe el motivo de la reclasificación (obligatorio).",
      RAPANUI_RESIDENCE_REJECTION_USER_MESSAGE,
    );

    if (!reason?.trim()) {
      setUpdateError("El motivo de rechazo es obligatorio.");
      return;
    }

    setUpdatingId(user.id);
    setUpdateError(null);

    try {
      const rejectedDoc = await adminService.reviewDocument(
        session.accessToken,
        doc.id,
        "rejected",
        reason.trim(),
        reclassifiedFareType,
      );

      const updatedUser = await adminService.updateUserStatus(
        session.accessToken,
        user.id,
        "active",
      );

      setDocs((prev) =>
        prev.map((item) => (item.id === rejectedDoc.id ? rejectedDoc : item)),
      );
      setUsers((prev) =>
        prev.map((item) => (item.id === user.id ? updatedUser : item)),
      );

      setToastMessage(
        `Acreditación rechazada. La categoría cambió a ${
          reclassifiedFareType === "foreigner"
            ? "Turista extranjero"
            : "Turista chileno"
        }.`,
      );
    } catch (err) {
      setUpdateError(
        err instanceof Error
          ? err.message
          : "No se pudo rechazar el documento.",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  const pendingRapaNuiCount =
    users.filter((user) => {
      const status = getResidenceVerificationStatus(user, docs);
      return isRapaNuiResidentUser(user, docs) && status !== "approved";
    }).length +
    residentRequests.filter((request) => request.status === "pending").length;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="danger">
          <IonTitle>Usuarios</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <IonCard
          className="rapago-accent-card"
          style={{ margin: "0 0 12px", borderRadius: 18 }}
        >
          <IonCardContent style={{ padding: "14px 16px" }}>
            <div style={{ fontWeight: 950, fontSize: "1rem" }}>
              Validación Rapa Nui
            </div>
            <p style={{ margin: "6px 0 0", fontSize: ".84rem", lineHeight: 1.35 }}>
              El admin revisa registros normales y registros con Facebook. La categoría RAPA NUI / RESIDENTE RAPA NUI permanece activa mientras la acreditación está pendiente. Si se rechaza, el administrador la cambia a Turista chileno o Turista extranjero.
            </p>
            <IonBadge color={pendingRapaNuiCount > 0 ? "warning" : "success"} style={{ marginTop: 10 }}>
              {pendingRapaNuiCount} pendiente{pendingRapaNuiCount !== 1 ? "s" : ""}
            </IonBadge>
          </IonCardContent>
        </IonCard>

        {residentRequests.length > 0 && (
          <IonCard
            style={{
              margin: "0 0 12px",
              borderRadius: 18,
              border: "1px solid rgba(200,155,60,.40)",
              background: "#fff8ed",
            }}
          >
            <IonCardHeader>
              <IonCardTitle style={{ color: "#111", fontWeight: 950 }}>
                Registros Rapa Nui por Facebook
              </IonCardTitle>
              <IonCardSubtitle>
                Documentos enviados antes de iniciar sesión con Facebook.
              </IonCardSubtitle>
            </IonCardHeader>

            <IonCardContent>
              {residentRequests.map((request) => {
                const status = request.status;
                const statusAsPassenger = status as PassengerVerificationStatus;
                const provider = request.authProvider || request.registrationProvider || "facebook";

                return (
                  <div
                    key={request.id}
                    style={{
                      marginBottom: 10,
                      padding: 12,
                      borderRadius: 16,
                      background: "#ffffff",
                      border:
                        status === "approved"
                          ? "1px solid rgba(45,211,111,.45)"
                          : status === "rejected"
                            ? "1px solid rgba(235,68,90,.45)"
                            : "1px solid rgba(255,196,9,.55)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 8,
                        alignItems: "flex-start",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 950, color: "#111" }}>
                          {request.name || `${request.firstName ?? ""} ${request.lastName ?? ""}`.trim() || "Pasajero Facebook"}
                        </div>
                        <div style={{ fontSize: ".78rem", color: "#555", fontWeight: 750 }}>
                          {request.email || "Sin correo"} · {request.phone || "Sin celular"}
                        </div>
                      </div>

                      <IonBadge color={residenceStatusColor(statusAsPassenger)}>
                        {residenceStatusLabel(statusAsPassenger)}
                      </IonBadge>
                    </div>

                    <div
                      style={{
                        marginTop: 8,
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 8,
                      }}
                    >
                      <div style={{ background: "#f6f2ec", borderRadius: 12, padding: 9 }}>
                        <div style={{ fontSize: ".68rem", color: "#666", fontWeight: 800 }}>
                          RUT
                        </div>
                        <div style={{ fontSize: ".82rem", fontWeight: 900, color: "#111" }}>
                          {request.rut || "No informado"}
                        </div>
                      </div>

                      <div style={{ background: "#f6f2ec", borderRadius: 12, padding: 9 }}>
                        <div style={{ fontSize: ".68rem", color: "#666", fontWeight: 800 }}>
                          Origen
                        </div>
                        <div style={{ fontSize: ".82rem", fontWeight: 900, color: "#111" }}>
                          {String(provider).toLowerCase().includes("facebook") ? "Facebook" : provider}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: 8,
                        padding: 10,
                        borderRadius: 14,
                        background: "rgba(0,0,0,.035)",
                      }}
                    >
                      <strong style={{ fontSize: ".82rem", color: "#111" }}>
                        Documento de RAPA NUI / RESIDENTE RAPA NUI
                      </strong>
                      <p style={{ margin: "4px 0 0", color: "#555", fontSize: ".76rem" }}>
                        {request.documentName || "Documento adjunto"}
                      </p>

                      {request.documentDataUrl && (
                        <IonButton
                          size="small"
                          fill="clear"
                          color="primary"
                          onClick={() => window.open(request.documentDataUrl ?? "", "_blank")}
                          style={{ marginTop: 4 }}
                        >
                          Ver documento
                        </IonButton>
                      )}
                    </div>

                    {status === "rejected" && request.rejectionReason && (
                      <IonText color="danger">
                        <p style={{ margin: "8px 0 0", fontSize: ".78rem", fontWeight: 850 }}>
                          {request.rejectionReason}
                        </p>
                      </IonText>
                    )}

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                      <IonButton
                        size="small"
                        color="success"
                        disabled={status === "approved"}
                        onClick={() => approveLocalResidentRequest(request.id)}
                      >
                        Aprobar residencia
                      </IonButton>

                      <IonButton
                        size="small"
                        color="danger"
                        fill="outline"
                        disabled={status === "rejected"}
                        onClick={() => rejectLocalResidentRequest(request.id)}
                      >
                        Rechazar documento
                      </IonButton>
                    </div>
                  </div>
                );
              })}
            </IonCardContent>
          </IonCard>
        )}

        <IonCard style={{ margin: "0 0 12px" }}>
          <IonCardContent style={{ padding: "10px 12px" }}>
            <IonItem lines="full">
              <IonLabel position="stacked" style={{ fontSize: "0.78rem" }}>
                Buscar
              </IonLabel>
              <IonInput
                value={filterSearch}
                onIonInput={(e) =>
                  setFilterSearch(String(e.detail.value ?? ""))
                }
                placeholder="Nombre, email, celular o RUT..."
                clearInput
              />
            </IonItem>

            <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
              <IonItem lines="none" style={{ flex: 1 }}>
                <IonLabel position="stacked" style={{ fontSize: "0.78rem" }}>
                  Rol
                </IonLabel>
                <IonSelect
                  value={filterRole}
                  onIonChange={(e) =>
                    setFilterRole(String(e.detail.value ?? ""))
                  }
                  placeholder="Todos"
                  interface="popover"
                >
                  <IonSelectOption value="">Todos</IonSelectOption>
                  <IonSelectOption value="passenger">Pasajero</IonSelectOption>
                  <IonSelectOption value="driver">Conductor</IonSelectOption>
                  <IonSelectOption value="guide">Guía</IonSelectOption>
                  <IonSelectOption value="rental">Arriendo</IonSelectOption>
                  <IonSelectOption value="admin">Admin</IonSelectOption>
                </IonSelect>
              </IonItem>

              <IonItem lines="none" style={{ flex: 1 }}>
                <IonLabel position="stacked" style={{ fontSize: "0.78rem" }}>
                  Estado
                </IonLabel>
                <IonSelect
                  value={filterStatus}
                  onIonChange={(e) =>
                    setFilterStatus(String(e.detail.value ?? ""))
                  }
                  placeholder="Todos"
                  interface="popover"
                >
                  <IonSelectOption value="">Todos</IonSelectOption>
                  <IonSelectOption value="pending">Pendiente</IonSelectOption>
                  <IonSelectOption value="active">Activo</IonSelectOption>
                  <IonSelectOption value="suspended">
                    Suspendido
                  </IonSelectOption>
                  <IonSelectOption value="banned">Bloqueado</IonSelectOption>
                  <IonSelectOption value="deleted">Eliminado/desactivado</IonSelectOption>
                </IonSelect>
              </IonItem>
            </div>

            <IonButton
              expand="block"
              size="small"
              fill="outline"
              color="danger"
              style={{ marginTop: "8px" }}
              onClick={() => void loadUsers()}
              disabled={loading}
            >
              {loading ? <IonSpinner name="dots" /> : "Aplicar filtros"}
            </IonButton>
          </IonCardContent>
        </IonCard>

        {!loading && !loadError && (
          <IonText color="medium">
            <p style={{ fontSize: "0.78rem", margin: "0 0 10px" }}>
              {users.length} usuario{users.length !== 1 ? "s" : ""} encontrado
              {users.length !== 1 ? "s" : ""}
            </p>
          </IonText>
        )}

        {loading && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              paddingTop: "40px",
            }}
          >
            <IonSpinner name="crescent" />
          </div>
        )}

        {loadError && (
          <IonText color="danger">
            <p>{loadError}</p>
          </IonText>
        )}

        {!loading && !loadError && users.length === 0 && (
          <IonText color="medium">
            <p>No se encontraron usuarios.</p>
          </IonText>
        )}

        {!loading && users.length > 0 && (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "10px" }}
          >
            {users.map((user) => {
              const accountControl = accountControls[user.id];
              const effectiveStatus = getEffectiveAdminUserStatus(user, accountControls);
              const statusColor = STATUS_COLOR[effectiveStatus] ?? "medium";
              const statusLabel = STATUS_LABEL[effectiveStatus] ?? effectiveStatus;
              const roleLabel = ROLE_LABEL[user.role] ?? user.role;
              const residenceDoc = getBestResidenceDocForUser(user, docs);
              const residenceMetadata =
                getResidentDocumentMetadata(residenceDoc);
              const residenceStatus =
                getResidenceVerificationStatus(user, docs);
              const isResident =
                isRapaNuiResidentUser(user, docs);
              const passengerLabel = isResident
                ? "RAPA NUI / RESIDENTE RAPA NUI"
                : getPassengerLabel(user);
              const providerLabel =
                residenceMetadata?.provider === "facebook"
                  ? "Facebook"
                  : getRegistrationProviderLabel(user);
              const passengerPhone =
                getPassengerPhone(user) ||
                residenceMetadata?.phone ||
                "";
              const passengerRut =
                getPassengerRut(user) ||
                residenceMetadata?.rut ||
                "";
              const residenceFilePreview =
                getResidentDocumentPreviewUrl(residenceDoc) ||
                getLocalResidenceDocumentPreview(user);
              const isProcessing = updatingId === user.id;

              return (
                <IonCard
                  key={user.id}
                  style={{
                    margin: 0,
                    borderRadius: 18,
                    border:
                      isResident && residenceStatus !== "approved"
                        ? "1px solid rgba(235, 68, 90, .45)"
                        : "1px solid rgba(0,0,0,.07)",
                  }}
                >
                  <IonCardContent style={{ padding: "12px 14px" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: "8px",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 850,
                            fontSize: "0.94rem",
                            marginBottom: "4px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {user.name}
                        </div>

                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--ion-color-medium)",
                            marginBottom: "6px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {user.email}
                        </div>

                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "4px",
                          }}
                        >
                          <IonBadge color="primary" style={{ fontSize: "0.68rem" }}>
                            {roleLabel}
                          </IonBadge>

                          <IonBadge color={statusColor} style={{ fontSize: "0.68rem" }}>
                            {statusLabel}
                          </IonBadge>

                          <IonBadge
                            color={isResident ? "warning" : "medium"}
                            style={{ fontSize: "0.68rem" }}
                          >
                            {passengerLabel}
                          </IonBadge>

                          <IonBadge color="tertiary" style={{ fontSize: "0.68rem" }}>
                            {providerLabel}
                          </IonBadge>

                          {user.isVerified && (
                            <IonBadge color="success" style={{ fontSize: "0.68rem" }}>
                              Verificado
                            </IonBadge>
                          )}
                        </div>
                      </div>

                      <div
                        style={{
                          fontSize: "0.68rem",
                          color: "var(--ion-color-medium)",
                          flexShrink: 0,
                          textAlign: "right",
                        }}
                      >
                        {new Date(user.createdAt).toLocaleDateString("es-CL")}
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: 10,
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          background: "#f6f2ec",
                          borderRadius: 12,
                          padding: 10,
                        }}
                      >
                        <div style={{ fontSize: ".68rem", color: "#666", fontWeight: 800 }}>
                          Celular
                        </div>
                        <div style={{ fontSize: ".82rem", fontWeight: 900, color: "#111" }}>
                          {passengerPhone || "No informado"}
                        </div>
                      </div>

                      <div
                        style={{
                          background: "#f6f2ec",
                          borderRadius: 12,
                          padding: 10,
                        }}
                      >
                        <div style={{ fontSize: ".68rem", color: "#666", fontWeight: 800 }}>
                          RUT
                        </div>
                        <div style={{ fontSize: ".82rem", fontWeight: 900, color: "#111" }}>
                          {passengerRut || "No informado"}
                        </div>
                      </div>
                    </div>

                    {isResident && (
                      <div
                        style={{
                          marginTop: 10,
                          border: "1px solid rgba(0,0,0,.08)",
                          borderRadius: 14,
                          padding: 10,
                          background:
                            residenceStatus === "approved"
                              ? "rgba(45, 211, 111, .10)"
                              : "rgba(255, 196, 9, .12)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 8,
                            alignItems: "center",
                          }}
                        >
                          <div>
                            <strong style={{ fontSize: ".86rem" }}>
                              Documento de RAPA NUI / RESIDENTE RAPA NUI
                            </strong>
                            <p
                              style={{
                                margin: "2px 0 0",
                                color: "var(--ion-color-medium)",
                                fontSize: ".76rem",
                              }}
                            >
                              {residenceDoc
                                ? getDocumentFileName(residenceDoc)
                                : "Documento no adjuntado"}
                            </p>
                          </div>

                          <IonBadge color={residenceStatusColor(residenceStatus)}>
                            {residenceStatusLabel(residenceStatus)}
                          </IonBadge>
                        </div>

                        {residenceFilePreview && (
                          <IonButton
                            size="small"
                            fill="clear"
                            color="primary"
                            onClick={() => window.open(residenceFilePreview, "_blank")}
                            style={{ marginTop: 6 }}
                          >
                            Ver documento
                          </IonButton>
                        )}

                        {residenceStatus === "rejected" && (
                          <IonText color="danger">
                            <p
                              style={{
                                margin: "8px 0 0",
                                fontSize: ".78rem",
                                lineHeight: 1.35,
                                fontWeight: 800,
                              }}
                            >
                              {RAPANUI_RESIDENCE_REJECTION_USER_MESSAGE}
                            </p>
                          </IonText>
                        )}

                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            marginTop: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          <IonButton
                            size="small"
                            color="success"
                            disabled={
                              isProcessing ||
                              residenceStatus === "approved" ||
                              !residenceDoc
                            }
                            onClick={() => void approveRapaNuiUser(user)}
                          >
                            {isProcessing ? <IonSpinner name="dots" /> : "Aprobar residencia"}
                          </IonButton>

                          <IonButton
                            size="small"
                            color="danger"
                            fill="outline"
                            disabled={
                              isProcessing ||
                              residenceStatus === "rejected" ||
                              !residenceDoc
                            }
                            onClick={() => void rejectRapaNuiUser(user)}
                          >
                            Rechazar documento
                          </IonButton>
                        </div>
                      </div>
                    )}

                    <div
                      style={{
                        marginTop: "10px",
                        borderTop: "1px solid var(--ion-color-light-shade)",
                        paddingTop: "8px",
                      }}
                    >
                      <IonItem
                        lines="none"
                        style={{
                          "--padding-start": "0",
                          "--inner-padding-end": "0",
                          "--min-height": "36px",
                        }}
                      >
                        <IonLabel
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--ion-color-medium)",
                            flexShrink: 0,
                            marginRight: "8px",
                          }}
                        >
                          Estado:
                        </IonLabel>

                        {isProcessing ? (
                          <IonSpinner
                            name="dots"
                            style={{ width: "20px", height: "20px" }}
                          />
                        ) : (
                          <IonSelect
                            value={effectiveStatus}
                            interface="popover"
                            style={{ fontSize: "0.8rem" }}
                            onIonChange={(e) => {
                              const val = String(e.detail.value ?? "");
                              if (val && val !== effectiveStatus) {
                                void handleStatusChange(user.id, val);
                              }
                            }}
                          >
                            <IonSelectOption value="pending">
                              Pendiente
                            </IonSelectOption>
                            <IonSelectOption value="active">
                              Activo
                            </IonSelectOption>
                            <IonSelectOption value="suspended">
                              Suspendido
                            </IonSelectOption>
                            <IonSelectOption value="banned">
                              Bloqueado
                            </IonSelectOption>
                            <IonSelectOption value="deleted">
                              Eliminado/desactivado
                            </IonSelectOption>
                          </IonSelect>
                        )}
                      </IonItem>
                    </div>

                    {accountControl && (
                      <div
                        style={{
                          marginTop: 8,
                          padding: 10,
                          borderRadius: 14,
                          background:
                            effectiveStatus === "deleted"
                              ? "rgba(17,24,39,.10)"
                              : effectiveStatus === "banned"
                                ? "rgba(235,68,90,.12)"
                                : "rgba(255,196,9,.14)",
                          border: "1px solid rgba(0,0,0,.08)",
                          fontSize: ".75rem",
                          lineHeight: 1.35,
                          color: "#111",
                          fontWeight: 800,
                        }}
                      >
                        {accountControl.reason ?? "Cuenta modificada por administración."}
                        {accountControl.deletedAt && (
                          <><br />Eliminada/desactivada: {new Date(accountControl.deletedAt).toLocaleString("es-CL")}</>
                        )}
                        {accountControl.blockedAt && !accountControl.deletedAt && (
                          <><br />Bloqueada: {new Date(accountControl.blockedAt).toLocaleString("es-CL")}</>
                        )}
                      </div>
                    )}

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                        gap: 8,
                        marginTop: 10,
                      }}
                    >
                      {effectiveStatus !== "banned" && effectiveStatus !== "deleted" && (
                        <IonButton
                          size="small"
                          color="danger"
                          fill="outline"
                          disabled={isProcessing}
                          onClick={() => setConfirmAccountAction({ user, action: "block" })}
                        >
                          Bloquear
                        </IonButton>
                      )}

                      {effectiveStatus === "banned" && (
                        <IonButton
                          size="small"
                          color="success"
                          disabled={isProcessing}
                          onClick={() => setConfirmAccountAction({ user, action: "unblock" })}
                        >
                          Desbloquear
                        </IonButton>
                      )}

                      {effectiveStatus !== "suspended" && effectiveStatus !== "deleted" && (
                        <IonButton
                          size="small"
                          color="medium"
                          fill="outline"
                          disabled={isProcessing}
                          onClick={() => setConfirmAccountAction({ user, action: "suspend" })}
                        >
                          Suspender
                        </IonButton>
                      )}

                      {(effectiveStatus === "suspended" || effectiveStatus === "deleted") && (
                        <IonButton
                          size="small"
                          color="success"
                          disabled={isProcessing}
                          onClick={() => setConfirmAccountAction({ user, action: "restore" })}
                        >
                          Restaurar
                        </IonButton>
                      )}

                      {effectiveStatus !== "deleted" && (
                        <IonButton
                          size="small"
                          color="danger"
                          disabled={isProcessing}
                          onClick={() => setConfirmAccountAction({ user, action: "delete" })}
                          style={{ gridColumn: "1 / -1" }}
                        >
                          Eliminar/desactivar cuenta
                        </IonButton>
                      )}
                    </div>
                  </IonCardContent>
                </IonCard>
              );
            })}
          </div>
        )}

        {updateError && (
          <IonText color="danger">
            <p style={{ fontSize: "0.85rem", marginTop: "10px" }}>
              {updateError}
            </p>
          </IonText>
        )}

        <IonAlert
          isOpen={confirmAccountAction !== null}
          header={confirmAccountAction ? adminUserAccountActionLabel(confirmAccountAction.action) : "Confirmar acción"}
          message={
            confirmAccountAction
              ? adminUserAccountActionMessage(confirmAccountAction.action, confirmAccountAction.user)
              : ""
          }
          buttons={[
            {
              text: "Cancelar",
              role: "cancel",
              handler: () => setConfirmAccountAction(null),
            },
            {
              text: confirmAccountAction?.action === "delete" ? "Sí, desactivar" : "Confirmar",
              role: "destructive",
              handler: () => {
                void handleConfirmedAccountAction();
              },
            },
          ]}
          onDidDismiss={() => {
            if (updatingId === null) setConfirmAccountAction(null);
          }}
        />

        <IonToast
          isOpen={toastMessage !== null}
          message={toastMessage ?? ""}
          duration={2800}
          color="success"
          onDidDismiss={() => setToastMessage(null)}
        />
      </IonContent>
    </IonPage>
  );
}

type NormalizedDriverAvailability = "available" | "busy" | "unavailable";

const DRIVER_AVAILABILITY_STORAGE_KEY = "rapago_driver_availability";
const DRIVER_AVAILABILITY_MAP_KEY = "rapago_driver_availability_by_driver";
const DRIVER_AVAILABILITY_EMAIL_KEY = "rapago_driver_availability_email";
const DRIVER_AVAILABILITY_NAME_KEY = "rapago_driver_availability_name";
const DRIVER_AVAILABILITY_SNAPSHOT_KEY = "rapago_driver_availability_snapshot";
const DRIVER_AVAILABILITY_EVENT = "rapago:driver-availability-changed";
const DRIVER_AVAILABILITY_REFRESH_EVENTS = [
  DRIVER_AVAILABILITY_EVENT,
  "rapago:availability-changed",
  "rapago:driver-status-changed",
  ADMIN_DRIVERS_REFRESH_EVENT,
  "focus",
  "visibilitychange",
] as const;

function normalizeAvailabilityValue(
  value: unknown,
): NormalizedDriverAvailability | null {
  const raw = String(value ?? "")
    .toLowerCase()
    .trim();

  if (
    raw === "busy" ||
    raw === "occupied" ||
    raw === "in_ride" ||
    raw === "ocupado"
  )
    return "busy";
  if (raw === "available" || raw === "online" || raw === "disponible")
    return "available";

  if (
    raw === "unavailable" ||
    raw === "offline" ||
    raw === "not_available" ||
    raw === "no_disponible" ||
    raw === "no disponible"
  ) {
    return "unavailable";
  }

  return null;
}

function readAdminDriverAvailabilityOverride(
  driverId?: string | null,
  email?: string | null,
  name?: string | null,
): NormalizedDriverAvailability | null {
  try {
    const rawMap = localStorage.getItem(DRIVER_AVAILABILITY_MAP_KEY);
    const map = rawMap ? (JSON.parse(rawMap) as Record<string, string>) : {};

    const keys = [
      driverId,
      email,
      email?.toLowerCase(),
      name,
      name?.toLowerCase(),
    ]
      .filter((value): value is string => Boolean(value && value.trim()))
      .map((value) => value.trim());

    for (const key of keys) {
      const normalized = normalizeAvailabilityValue(map[key]);
      if (normalized) return normalized;
    }

    // También lee el snapshot que guarda la app del conductor con email/nombre/id.
    // Esto permite que el panel admin refleje Disponible / No disponible automáticamente
    // aunque el backend todavía devuelva availability antiguo.
    const rawSnapshot = localStorage.getItem(DRIVER_AVAILABILITY_SNAPSHOT_KEY);
    const snapshot = rawSnapshot
      ? (JSON.parse(rawSnapshot) as Record<string, { value?: string | null }>)
      : {};

    for (const key of keys) {
      const normalized = normalizeAvailabilityValue(snapshot[key]?.value);
      if (normalized) return normalized;
    }

    // Compatibilidad con el estado global guardado por la app del conductor.
    // Solo se usa cuando el correo/nombre del conductor coincide, para no aplicar
    // el mismo estado a todos los conductores del panel admin.
    const globalValue = normalizeAvailabilityValue(
      localStorage.getItem(DRIVER_AVAILABILITY_STORAGE_KEY),
    );
    const globalEmail = localStorage
      .getItem(DRIVER_AVAILABILITY_EMAIL_KEY)
      ?.toLowerCase()
      .trim();
    const globalName = localStorage
      .getItem(DRIVER_AVAILABILITY_NAME_KEY)
      ?.toLowerCase()
      .trim();
    const driverEmail = email?.toLowerCase().trim();
    const driverName = name?.toLowerCase().trim();

    if (
      globalValue &&
      driverEmail &&
      globalEmail &&
      driverEmail === globalEmail
    )
      return globalValue;
    if (globalValue && driverName && globalName && driverName === globalName)
      return globalValue;
  } catch {
    // No bloquea el panel admin.
  }

  return null;
}

function getNormalizedDriverAvailability(
  driver: ActiveDriverData | null | undefined,
): NormalizedDriverAvailability {
  const valueSource = driver as
    | (ActiveDriverData & {
        availability?: string | null;
        driverAvailability?: string | null;
        status?: string | null;
        isAvailable?: boolean | null;
        isOnline?: boolean | null;
      })
    | null
    | undefined;

  if (driver?.currentRideId) return "busy";

  // CORRECCIÓN FINAL: la disponibilidad local del conductor tiene prioridad sobre availability del backend.
  // Primero se respeta lo que el conductor marcó en su app.
  // Este era el problema: antes el backend seguía mostrando available y pisaba el localStorage.
  const stored = readAdminDriverAvailabilityOverride(
    driver?.id,
    driver?.email,
    driver?.name,
  );
  if (stored) return stored;

  const rawAvailability =
    normalizeAvailabilityValue(valueSource?.availability) ??
    normalizeAvailabilityValue(valueSource?.driverAvailability) ??
    normalizeAvailabilityValue(valueSource?.status);

  if (rawAvailability) return rawAvailability;

  if (valueSource?.isAvailable === true || valueSource?.isOnline === true)
    return "available";
  if (valueSource?.isAvailable === false || valueSource?.isOnline === false)
    return "unavailable";

  return "unavailable";
}

function availabilityLabel(a: string): string {
  const normalized = a as NormalizedDriverAvailability;
  if (normalized === "available") return "Disponible";
  if (normalized === "busy") return "Ocupado";
  return "No disponible";
}

function availabilityColor(a: string): string {
  const normalized = a as NormalizedDriverAvailability;
  if (normalized === "available") return "success";
  if (normalized === "busy") return "warning";
  return "medium";
}

function availabilityDescription(a: string): string {
  const normalized = a as NormalizedDriverAvailability;
  if (normalized === "available") return "Puede recibir solicitudes de viaje.";
  if (normalized === "busy") return "Tiene un viaje activo en curso.";
  return "No recibe solicitudes hasta volver a Disponible.";
}

function fmtDate(iso: string | null): string {
  if (!iso) return "Sin actividad reciente";
  return new Date(iso).toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function adminRestStatusLabel(status: string | null | undefined): string {
  switch (String(status ?? "").toLowerCase()) {
    case "active":
      return "Descanso activo";
    case "reminder_due":
    case "scheduled":
    case "pending_trip_completion":
      return "Aviso pendiente";
    case "working":
      return "Eligió trabajar";
    case "completed":
      return "Descanso completado";
    default:
      return "Programado";
  }
}

function adminRestStatusStyle(
  status: string | null | undefined,
): CSSProperties {
  const normalized = String(status ?? "").toLowerCase();

  if (normalized === "active") {
    return {
      background: "rgba(79,70,229,.14)",
      color: "#3730a3",
      border: "1px solid rgba(79,70,229,.28)",
    };
  }

  if (
    normalized === "reminder_due" ||
    normalized === "scheduled" ||
    normalized === "pending_trip_completion"
  ) {
    return {
      background: "rgba(245,158,11,.14)",
      color: "#92400e",
      border: "1px solid rgba(245,158,11,.30)",
    };
  }

  if (normalized === "working") {
    return {
      background: "rgba(34,197,94,.13)",
      color: "#166534",
      border: "1px solid rgba(34,197,94,.28)",
    };
  }

  return {
    background: "rgba(100,116,139,.12)",
    color: "#334155",
    border: "1px solid rgba(100,116,139,.24)",
  };
}

export function AdminDriversPage(): JSX.Element {
  const { session } = useAuth();
  const token = session?.accessToken;

  const [drivers, setDrivers] = useState<ActiveDriverData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filterAvailability, setFilterAvailability] = useState<string>("all");
  const [selectedDriver, setSelectedDriver] = useState<ActiveDriverData | null>(
    null,
  );
  const [assignmentRide, setAssignmentRide] = useState<AdminRideData | null>(null);
  const [assignmentToast, setAssignmentToast] = useState<string | null>(null);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [driverRides, setDriverRides] = useState<AdminRideData[]>([]);
  const [driverServiceSchedules, setDriverServiceSchedules] = useState<
    AdminDriverServiceScheduleRow[]
  >([]);
  const [driverRestPeriods, setDriverRestPeriods] = useState<
    AdminDriverRestComplianceRow[]
  >([]);
  const [restOverviewLoading, setRestOverviewLoading] = useState(false);
  const [restOverviewError, setRestOverviewError] = useState<string | null>(
    null,
  );
  const [, setAvailabilityRevision] = useState(0);

  const loadDrivers = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (!silent) setLoading(true);
      setLoadError(null);
      try {
        const [driverData, rideData] = await Promise.all([
          adminService.listActiveDrivers(token),
          adminService.listRides(token, {}).catch(() => [] as AdminRideData[]),
        ]);

        setDrivers(driverData);
        setDriverRides(rideData);
      } catch (err) {
        setLoadError(
          err instanceof Error ? err.message : "Error al cargar conductores.",
        );
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [token],
  );

  const loadDriverRestOverview = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (!silent) setRestOverviewLoading(true);
      setRestOverviewError(null);

      try {
        const report = await fetchAdminDriverComplianceReport(token);
        setDriverServiceSchedules(report.serviceSchedules);
        setDriverRestPeriods(report.restPeriods);
      } catch (err) {
        setRestOverviewError(
          err instanceof Error
            ? err.message
            : "No se pudieron cargar los horarios y descansos.",
        );
      } finally {
        if (!silent) setRestOverviewLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    void loadDrivers();
    void loadDriverRestOverview();

    const restTimerId = window.setInterval(() => {
      void loadDriverRestOverview(true);
    }, 60_000);

    return () => window.clearInterval(restTimerId);
  }, [loadDriverRestOverview, loadDrivers]);

  useEffect(() => {
    const refreshPendingAssignment = () => {
      setAssignmentRide(readPendingAdminDriverAssignmentRide());
    };

    refreshPendingAssignment();
    window.addEventListener("storage", refreshPendingAssignment);
    window.addEventListener(ADMIN_DRIVER_ASSIGNMENT_EVENT, refreshPendingAssignment as EventListener);

    return () => {
      window.removeEventListener("storage", refreshPendingAssignment);
      window.removeEventListener(ADMIN_DRIVER_ASSIGNMENT_EVENT, refreshPendingAssignment as EventListener);
    };
  }, []);

  useIonViewWillEnter(() => {
    setAssignmentRide(readPendingAdminDriverAssignmentRide());
    setAvailabilityRevision((current) => current + 1);
    void loadDrivers(false);
    void loadDriverRestOverview(false);
  });

  useEffect(() => {
    const refreshAvailability = () => {
      setAvailabilityRevision((current) => current + 1);
      void loadDrivers(true);
    };

    window.addEventListener("storage", refreshAvailability);
    DRIVER_AVAILABILITY_REFRESH_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, refreshAvailability as EventListener);
    });

    const timerId = window.setInterval(refreshAvailability, 2500);

    return () => {
      window.removeEventListener("storage", refreshAvailability);
      DRIVER_AVAILABILITY_REFRESH_EVENTS.forEach((eventName) => {
        window.removeEventListener(
          eventName,
          refreshAvailability as EventListener,
        );
      });
      window.clearInterval(timerId);
    };
  }, [loadDrivers]);

  useEffect(() => {
    if (drivers.length === 0) return;

    const runAutoReassign = () => {
      const localScheduled = includeGeneratedRoundTripReturnLegs(
        readLocalAdminScheduledRides(),
      );
      const assignedAutomatically: AdminRideData[] = [];
      const reassigned: AdminRideData[] = [];

      for (const ride of localScheduled) {
        const directAssignment = autoAssignReservationToAvailableDriverFromAdmin(ride, drivers);
        if (directAssignment) {
          assignedAutomatically.push(directAssignment);
          continue;
        }

        const next = autoAssignReservationToNextAvailableDriverFromAdmin(ride, drivers);
        if (next) reassigned.push(next);
      }

      const processed = [...assignedAutomatically, ...reassigned];

      if (processed.length > 0) {
        setDriverRides((prev) => mergeAdminRides([...processed, ...prev]));
        setAssignmentRide((current) => {
          if (!current) return current;
          return processed.some((ride) => getAdminRideMergeKey(ride) === getAdminRideMergeKey(current))
            ? null
            : current;
        });
        setAssignmentToast(
          processed.length === 1
            ? "Sistema asignó automáticamente la reserva a un conductor disponible."
            : `${processed.length} reservas asignadas automáticamente a conductores disponibles.`,
        );
      }
    };

    runAutoReassign();

    const onReassignNeeded = () => window.setTimeout(runAutoReassign, 80);

    window.addEventListener("storage", onReassignNeeded);
    window.addEventListener(ADMIN_RESERVATION_AUTO_REASSIGN_EVENT, onReassignNeeded as EventListener);
    window.addEventListener("rapago:admin-scheduled-rides-updated", onReassignNeeded as EventListener);
    window.addEventListener("rapago:driver-scheduled-reservation-updated", onReassignNeeded as EventListener);

    return () => {
      window.removeEventListener("storage", onReassignNeeded);
      window.removeEventListener(ADMIN_RESERVATION_AUTO_REASSIGN_EVENT, onReassignNeeded as EventListener);
      window.removeEventListener("rapago:admin-scheduled-rides-updated", onReassignNeeded as EventListener);
      window.removeEventListener("rapago:driver-scheduled-reservation-updated", onReassignNeeded as EventListener);
    };
  }, [drivers]);

  useEffect(() => {
    if (!selectedDriver) return;

    const refreshedDriver = drivers.find(
      (driver) =>
        driver.id === selectedDriver.id ||
        (driver.email &&
          selectedDriver.email &&
          driver.email.toLowerCase() === selectedDriver.email.toLowerCase()),
    );

    if (refreshedDriver) {
      setSelectedDriver(refreshedDriver);
    }
  }, [drivers, selectedDriver?.id, selectedDriver?.email]);

  const filtered = drivers.filter((d) => {
    const availability = getNormalizedDriverAvailability(d);
    if (filterAvailability !== "all" && availability !== filterAvailability)
      return false;
    return true;
  });

  const selectedDriverRide = selectedDriver
    ? (driverRides.find(
        (ride) =>
          ride.id === selectedDriver.currentRideId ||
          (ride.driverUserId === selectedDriver.id &&
            [
              "accepted",
              "driver_en_route",
              "driver_arrived",
              "in_progress",
            ].includes(ride.status)),
      ) ?? null)
    : null;

  const latestRestPeriodByDriver = new Map<
    string,
    AdminDriverRestComplianceRow
  >();

  for (const period of [...driverRestPeriods].sort(
    (a, b) =>
      new Date(b.scheduledStartAt).getTime() -
      new Date(a.scheduledStartAt).getTime(),
  )) {
    if (!latestRestPeriodByDriver.has(period.driverUserId)) {
      latestRestPeriodByDriver.set(period.driverUserId, period);
    }
  }

  function getAdminPaymentMethod(notes: string | null | undefined): string {
    const text = String(notes ?? "").toLowerCase();
    if (text.includes("prontopaga") || text.includes("tarjeta"))
      return "ProntoPaga";
    if (text.includes("efectivo")) return "Efectivo";
    return "No informado";
  }

  function formatAdminFare(value: number | null | undefined): string {
    if (value == null || !Number.isFinite(Number(value))) return "No informado";
    return `$${Math.round(Number(value)).toLocaleString("es-CL")} CLP`;
  }

  function handleAssignDriverToPendingRide(driver: ActiveDriverData): void {
    if (!assignmentRide) return;

    const availability = getNormalizedDriverAvailability(driver);
    if (availability !== "available") {
      setAssignmentError("Ese conductor no está disponible. Selecciona uno con estado Disponible.");
      return;
    }

    try {
      const assigned = assignScheduledRideToDriverLocally(assignmentRide, driver);
      setDriverRides((prev) => mergeAdminRides([assigned, ...prev]));
      setAssignmentRide(null);
      setAssignmentError(null);
      setAssignmentToast(
        getAdminRideScheduleInfo(assignmentRide).isReturnOnlyPromotion
          ? `Conductor ${driver.name} asignado al regreso. Solo ese conductor recibirá la reserva de vuelta.`
          : `Conductor ${driver.name} agendado correctamente. Solo ese conductor recibirá la reserva. Si rechaza o cancela, pasará automáticamente al siguiente conductor disponible.`,
      );
    } catch (err) {
      setAssignmentError(err instanceof Error ? err.message : "No se pudo agendar el conductor.");
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="danger">
          <IonTitle>Conductores</IonTitle>
          <div slot="end" style={{ paddingRight: "8px" }}>
            <IonButton
              fill="clear"
              color="light"
              onClick={() => {
                void loadDrivers();
                void loadDriverRestOverview();
              }}
              disabled={loading || restOverviewLoading}
            >
              Actualizar
            </IonButton>
          </div>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonRefresher
          slot="fixed"
          onIonRefresh={async (e) => {
            await Promise.all([
              loadDrivers(),
              loadDriverRestOverview(),
            ]);
            e.detail.complete();
          }}
        >
          <IonRefresherContent />
        </IonRefresher>

        {assignmentRide && (
          <IonCard style={{ margin: "0 0 12px", borderRadius: 18, border: "1px solid rgba(255,201,40,.60)", background: "rgba(255,201,40,.16)" }}>
            <IonCardContent style={{ padding: "12px 14px" }}>
              <div style={{ fontWeight: 950, fontSize: "0.96rem", color: "#111" }}>
                {getAdminRideScheduleInfo(assignmentRide).isReturnOnlyPromotion
                  ? "Gestionar conductor para regreso"
                  : "Agendar conductor para esta reserva"}
              </div>
              <div style={{ marginTop: 4, fontSize: "0.82rem", color: "#222", lineHeight: 1.35 }}>
                {assignmentRide.originText} → {assignmentRide.destinationText}
              </div>
              <div style={{ marginTop: 4, fontSize: "0.78rem", color: "#333" }}>
                {getAdminRideScheduleInfo(assignmentRide).isReturnOnlyPromotion
                  ? `Regreso: ${formatAdminScheduleDate(getAdminRideScheduleInfo(assignmentRide).returnScheduledAt ?? getAdminRideScheduleInfo(assignmentRide).displayScheduledAt)}`
                  : `Recogida: ${formatAdminScheduleDate(getAdminRideScheduleInfo(assignmentRide).scheduledAt)}`}
              </div>
              {getAdminRideAirportWelcomeInfo(assignmentRide) && (
                <div
                  style={{
                    marginTop: 8,
                    padding: "9px 10px",
                    borderRadius: 14,
                    background: "rgba(236,72,153,.12)",
                    border: "1px solid rgba(236,72,153,.28)",
                    color: "#831843",
                    fontSize: "0.78rem",
                    lineHeight: 1.35,
                    fontWeight: 900,
                  }}
                >
                  🌺 Collar de flores solicitado · {formatAdminCashClp(getAdminRideAirportWelcomeInfo(assignmentRide)?.amountClp ?? 4000)} incluido en la tarifa. Admin debe gestionarlo para la llegada en Mataveri.
                </div>
              )}
              <IonNote style={{ display: "block", marginTop: 6, color: "#333" }}>
                {getAdminRideScheduleInfo(assignmentRide).isReturnOnlyPromotion
                  ? "Elige un conductor Disponible. Solo ese conductor recibirá el regreso en Reservas."
                  : "Elige un conductor Disponible. Se guardará como conductor agendado y el viaje se activará 10 minutos antes."}
              </IonNote>
              <IonButton
                size="small"
                fill="outline"
                color="medium"
                style={{ marginTop: 8 }}
                onClick={() => {
                  clearPendingAdminDriverAssignmentRide();
                  setAssignmentRide(null);
                }}
              >
                Cerrar selección
              </IonButton>
            </IonCardContent>
          </IonCard>
        )}

        {assignmentError && (
          <IonText color="danger">
            <p style={{ fontSize: "0.85rem" }}>{assignmentError}</p>
          </IonText>
        )}

        <IonCard
          style={{
            margin: "0 0 12px",
            borderRadius: 18,
            border: "1px solid rgba(200,155,60,.32)",
            background: "linear-gradient(145deg,#fffaf0,#fff4d6)",
          }}
        >
          <IonCardContent style={{ padding: "14px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "flex-start",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: ".68rem",
                    fontWeight: 950,
                    letterSpacing: ".06em",
                    color: "#8a6418",
                    textTransform: "uppercase",
                  }}
                >
                  Gestión administrativa
                </div>
                <div
                  style={{
                    marginTop: 2,
                    fontSize: "1rem",
                    fontWeight: 950,
                    color: "#111827",
                  }}
                >
                  Horarios y descansos de conductores
                </div>
              </div>

              <IonButton
                size="small"
                fill="outline"
                color="dark"
                disabled={restOverviewLoading}
                onClick={() => void loadDriverRestOverview()}
                style={{ margin: 0 }}
              >
                {restOverviewLoading ? (
                  <IonSpinner name="dots" />
                ) : (
                  "Actualizar"
                )}
              </IonButton>
            </div>

            <IonNote
              style={{
                display: "block",
                marginTop: 7,
                color: "#4b5563",
                fontSize: ".75rem",
                lineHeight: 1.4,
                fontWeight: 760,
              }}
            >
              El horario es planificación y aviso. Solo “Tomar descanso”
              inicia el bloqueo continuo de 12 horas.
            </IonNote>

            {restOverviewError && (
              <div
                role="alert"
                style={{
                  marginTop: 10,
                  padding: "9px 10px",
                  borderRadius: 12,
                  background: "rgba(239,68,68,.10)",
                  border: "1px solid rgba(239,68,68,.24)",
                  color: "#991b1b",
                  fontSize: ".74rem",
                  fontWeight: 850,
                }}
              >
                {restOverviewError}
              </div>
            )}

            {!restOverviewLoading &&
              !restOverviewError &&
              driverServiceSchedules.length === 0 && (
                <div
                  style={{
                    marginTop: 12,
                    padding: "12px",
                    borderRadius: 14,
                    background: "#fff",
                    border: "1px solid rgba(15,23,42,.10)",
                    color: "#475569",
                    fontSize: ".78rem",
                    fontWeight: 800,
                  }}
                >
                  Ningún conductor ha configurado todavía su horario de
                  servicios.
                </div>
              )}

            <div
              style={{
                display: "grid",
                gap: 9,
                marginTop: driverServiceSchedules.length > 0 ? 12 : 0,
              }}
            >
              {driverServiceSchedules.slice(0, 30).map((schedule) => {
                const period = latestRestPeriodByDriver.get(
                  schedule.driverUserId,
                );
                const status = period?.status ?? "scheduled";

                return (
                  <div
                    key={schedule.id}
                    style={{
                      padding: "11px 12px",
                      borderRadius: 15,
                      background: "#fff",
                      border: "1px solid rgba(15,23,42,.10)",
                      boxShadow: "0 7px 18px rgba(15,23,42,.06)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 10,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            color: "#111827",
                            fontSize: ".84rem",
                            fontWeight: 950,
                            overflowWrap: "anywhere",
                          }}
                        >
                          {schedule.driverName ||
                            schedule.driverEmail ||
                            "Conductor"}
                        </div>
                        {schedule.driverEmail && (
                          <div
                            style={{
                              marginTop: 2,
                              color: "#64748b",
                              fontSize: ".68rem",
                              fontWeight: 760,
                              overflowWrap: "anywhere",
                            }}
                          >
                            {schedule.driverEmail}
                          </div>
                        )}
                      </div>

                      <span
                        style={{
                          ...adminRestStatusStyle(status),
                          padding: "5px 8px",
                          borderRadius: 999,
                          fontSize: ".65rem",
                          fontWeight: 950,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {adminRestStatusLabel(status)}
                      </span>
                    </div>

                    <div
                      style={{
                        marginTop: 8,
                        color: "#1f2937",
                        fontSize: ".75rem",
                        lineHeight: 1.45,
                        fontWeight: 820,
                      }}
                    >
                      Servicios: {schedule.serviceStartTime} a{" "}
                      {schedule.serviceEndTime}
                      <br />
                      Próximo aviso:{" "}
                      {fmtDate(schedule.nextScheduledEndAt)}
                    </div>

                    {period && (
                      <div
                        style={{
                          marginTop: 7,
                          paddingTop: 7,
                          borderTop: "1px solid rgba(15,23,42,.08)",
                          color: "#475569",
                          fontSize: ".7rem",
                          lineHeight: 1.45,
                          fontWeight: 760,
                        }}
                      >
                        Decisión:{" "}
                        {period.decision === "rest"
                          ? "Tomar descanso"
                          : period.decision === "work"
                            ? "Trabajar"
                            : "Pendiente"}
                        {period.decisionAt
                          ? ` · ${fmtDate(period.decisionAt)}`
                          : ""}
                        {period.actualStartAt
                          ? ` · Inicio real: ${fmtDate(period.actualStartAt)}`
                          : ""}
                        {period.requiredEndAt
                          ? ` · Fin: ${fmtDate(period.requiredEndAt)}`
                          : ""}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </IonCardContent>
        </IonCard>

        {/* Filters */}
        <IonCard style={{ margin: "0 0 12px", borderRadius: "18px" }}>
          <IonCardContent style={{ padding: "10px 12px" }}>
            <IonItem lines="none">
              <IonLabel>Disponibilidad</IonLabel>
              <IonSelect
                interface="action-sheet"
                value={filterAvailability}
                onIonChange={(e) =>
                  setFilterAvailability(String(e.detail.value ?? "all"))
                }
              >
                <IonSelectOption value="all">Todas</IonSelectOption>
                <IonSelectOption value="available">Disponibles</IonSelectOption>
                <IonSelectOption value="unavailable">
                  No disponibles
                </IonSelectOption>
                <IonSelectOption value="busy">Ocupados</IonSelectOption>
              </IonSelect>
            </IonItem>
            <IonNote
              style={{
                display: "block",
                marginTop: 8,
                fontSize: ".76rem",
                fontWeight: 800,
              }}
            >
              La disponibilidad se toma desde el estado seleccionado por el
              conductor. Si está No disponible, no debe recibir solicitudes
              nuevas.
            </IonNote>
          </IonCardContent>
        </IonCard>

        {!loading && !loadError && (
          <IonText color="medium">
            <p style={{ fontSize: "0.78rem", margin: "0 0 10px" }}>
              {filtered.length} conductor{filtered.length !== 1 ? "es" : ""}{" "}
              encontrado{filtered.length !== 1 ? "s" : ""}
            </p>
          </IonText>
        )}

        {loading && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              paddingTop: "40px",
            }}
          >
            <IonSpinner name="crescent" />
          </div>
        )}

        {loadError && (
          <IonText color="danger">
            <p>{loadError}</p>
          </IonText>
        )}

        {filtered.length === 0 && !loading && !loadError && (
          <IonItem lines="none">
            <IonLabel color="medium" className="ion-text-center">
              No hay conductores que coincidan con el filtro.
            </IonLabel>
          </IonItem>
        )}

        {!loading && filtered.length > 0 && (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "10px" }}
          >
            {filtered.map((driver) => {
              const availability = getNormalizedDriverAvailability(driver);

              return (
                <IonCard
                  key={driver.id}
                  style={{ margin: 0, borderRadius: "18px" }}
                >
                  <IonCardContent style={{ padding: "12px 14px" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 8,
                      }}
                    >
                      <strong style={{ fontSize: "1rem" }}>
                        {driver.name}
                      </strong>
                      <IonBadge color={availabilityColor(availability)}>
                        {availabilityLabel(availability)}
                      </IonBadge>
                    </div>
                    <IonNote style={{ display: "block", marginBottom: 4 }}>
                      {driver.email}
                    </IonNote>
                    <IonNote
                      style={{
                        display: "block",
                        marginBottom: 4,
                        fontWeight: 800,
                      }}
                    >
                      Estado: {availabilityDescription(availability)}
                    </IonNote>
                    {availability === "busy" && driver.currentRideId && (
                      <IonNote
                        color="warning"
                        style={{
                          display: "block",
                          marginBottom: 4,
                          fontWeight: 900,
                        }}
                      >
                        En viaje activo
                      </IonNote>
                    )}
                    <IonNote style={{ display: "block", fontSize: "0.75rem" }}>
                      Última actividad: {fmtDate(driver.lastSeenAt)}
                    </IonNote>
                    <div style={{ marginTop: "8px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {assignmentRide && (
                        <IonButton
                          size="small"
                          color="success"
                          disabled={availability !== "available"}
                          onClick={() => handleAssignDriverToPendingRide(driver)}
                        >
                          Agendar este conductor
                        </IonButton>
                      )}
                      <IonButton
                        size="small"
                        fill="outline"
                        color="primary"
                        onClick={() => setSelectedDriver(driver)}
                      >
                        Monitorear
                      </IonButton>
                    </div>
                  </IonCardContent>
                </IonCard>
              );
            })}
          </div>
        )}

        <IonItem lines="none" style={{ marginTop: "16px" }}>
          <IonLabel
            color="medium"
            style={{ fontSize: "0.8rem", whiteSpace: "normal" }}
          >
            Los viajes se toman automáticamente desde la app del conductor. El
            admin solo monitorea.
          </IonLabel>
        </IonItem>

        {/* Admin monitor modal */}
        <IonModal
          isOpen={selectedDriver !== null}
          onDidDismiss={() => setSelectedDriver(null)}
        >
          <IonHeader>
            <IonToolbar color="danger">
              <IonTitle>
                {selectedDriver?.name ?? "Monitoreo conductor"}
              </IonTitle>
              <div slot="end" style={{ paddingRight: "8px" }}>
                <IonButton
                  fill="clear"
                  color="light"
                  onClick={() => setSelectedDriver(null)}
                >
                  Cerrar
                </IonButton>
              </div>
            </IonToolbar>
          </IonHeader>

          <IonContent className="ion-padding">
            {selectedDriver && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <IonCard style={{ margin: 0, borderRadius: "18px" }}>
                  <IonCardContent>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: "10px",
                      }}
                    >
                      <div>
                        <h2 style={{ margin: "0 0 4px", fontWeight: 900 }}>
                          {selectedDriver.name}
                        </h2>
                        <IonNote>{selectedDriver.email}</IonNote>
                      </div>
                      <IonBadge
                        color={availabilityColor(
                          getNormalizedDriverAvailability(selectedDriver),
                        )}
                      >
                        {availabilityLabel(
                          getNormalizedDriverAvailability(selectedDriver),
                        )}
                      </IonBadge>
                    </div>

                    <div
                      style={{ marginTop: "12px", display: "grid", gap: "8px" }}
                    >
                      <IonItem
                        lines="none"
                        style={
                          {
                            "--background": "#f6f2ec",
                            "--border-radius": "12px",
                          } as CSSProperties
                        }
                      >
                        <IonLabel>
                          <b>Disponibilidad actual</b>
                          <p>
                            {availabilityDescription(
                              getNormalizedDriverAvailability(selectedDriver),
                            )}
                          </p>
                        </IonLabel>
                      </IonItem>

                      <IonItem
                        lines="none"
                        style={
                          {
                            "--background": "#f6f2ec",
                            "--border-radius": "12px",
                          } as CSSProperties
                        }
                      >
                        <IonLabel>
                          <b>Última actividad</b>
                          <p>{fmtDate(selectedDriver.lastSeenAt)}</p>
                        </IonLabel>
                      </IonItem>
                    </div>
                  </IonCardContent>
                </IonCard>

                <IonCard
                  style={{
                    margin: 0,
                    borderRadius: "18px",
                    border: selectedDriverRide
                      ? "2px solid rgba(45,211,111,.45)"
                      : "1px solid rgba(0,0,0,.08)",
                  }}
                >
                  <IonCardContent>
                    <h2 style={{ margin: "0 0 6px", fontWeight: 950 }}>
                      {selectedDriverRide ? "Viaje activo" : "Sin viaje activo"}
                    </h2>

                    {!selectedDriverRide && (
                      <p
                        style={{
                          margin: 0,
                          color: "var(--ion-color-medium)",
                          fontSize: ".88rem",
                        }}
                      >
                        Este conductor no tiene un viaje tomado actualmente. El
                        administrador solo monitorea la operación.
                      </p>
                    )}

                    {selectedDriverRide && (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "10px",
                        }}
                      >
                        <IonBadge
                          color="success"
                          style={{ alignSelf: "flex-start" }}
                        >
                          {selectedDriverRide.status}
                        </IonBadge>

                        <IonItem
                          lines="none"
                          style={
                            {
                              "--background": "#f6f2ec",
                              "--border-radius": "12px",
                            } as CSSProperties
                          }
                        >
                          <IonLabel>
                            <b>Pasajero</b>
                            <p>
                              {selectedDriverRide.passengerName ??
                                selectedDriverRide.passengerEmail ??
                                "Pasajero no informado"}
                            </p>
                          </IonLabel>
                        </IonItem>

                        <IonItem
                          lines="none"
                          style={
                            {
                              "--background": "#f6f2ec",
                              "--border-radius": "12px",
                            } as CSSProperties
                          }
                        >
                          <IonLabel>
                            <b>Origen</b>
                            <p>{selectedDriverRide.originText}</p>
                          </IonLabel>
                        </IonItem>

                        <IonItem
                          lines="none"
                          style={
                            {
                              "--background": "#f6f2ec",
                              "--border-radius": "12px",
                            } as CSSProperties
                          }
                        >
                          <IonLabel>
                            <b>Destino</b>
                            <p>{selectedDriverRide.destinationText}</p>
                          </IonLabel>
                        </IonItem>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: "10px",
                          }}
                        >
                          <div
                            style={{
                              background: "#f6f2ec",
                              borderRadius: "14px",
                              padding: "12px",
                            }}
                          >
                            <div
                              style={{
                                fontSize: ".72rem",
                                color: "#666",
                                fontWeight: 800,
                              }}
                            >
                              Pago
                            </div>
                            <div
                              style={{
                                fontWeight: 950,
                                color: "#111",
                                marginTop: "4px",
                              }}
                            >
                              {getAdminPaymentMethod(selectedDriverRide.notes)}
                            </div>
                          </div>

                          <div
                            style={{
                              background: "#f6f2ec",
                              borderRadius: "14px",
                              padding: "12px",
                            }}
                          >
                            <div
                              style={{
                                fontSize: ".72rem",
                                color: "#666",
                                fontWeight: 800,
                              }}
                            >
                              Monto
                            </div>
                            <div
                              style={{
                                fontWeight: 950,
                                color: "#111",
                                marginTop: "4px",
                              }}
                            >
                              {formatAdminFare(
                                selectedDriverRide.estimatedFareClp,
                              )}
                            </div>
                          </div>
                        </div>

                        <IonButton
                          expand="block"
                          color="warning"
                          routerLink={ROUTES.ADMIN.TRIPS}
                          onClick={() => setSelectedDriver(null)}
                          style={
                            {
                              "--border-radius": "14px",
                              fontWeight: 900,
                            } as CSSProperties
                          }
                        >
                          Ver viaje en monitoreo
                        </IonButton>
                      </div>
                    )}
                  </IonCardContent>
                </IonCard>

                <IonCard
                  className="rapago-accent-card"
                  style={{ margin: 0, borderRadius: "18px" }}
                >
                  <IonCardContent
                    style={{ fontSize: ".84rem", lineHeight: 1.45 }}
                  >
                    El administrador puede monitorear conductores y también agendar
                    un conductor disponible para una reserva programada.
                  </IonCardContent>
                </IonCard>
              </div>
            )}
          </IonContent>
        </IonModal>
        <IonToast
          isOpen={assignmentToast !== null}
          message={assignmentToast ?? ""}
          duration={3200}
          color="success"
          onDidDismiss={() => setAssignmentToast(null)}
        />
      </IonContent>
    </IonPage>
  );
}

export function AdminGuidesPage(): JSX.Element {
  const { session } = useAuth();
  const token = session?.accessToken ?? "";

  const [mainTab, setMainTab] = useState<"guides" | "services" | "bookings">(
    "guides",
  );

  const [guides, setGuides] = useState<AdminUserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterVerified, setFilterVerified] = useState<string>("all");

  const [allServices, setAllServices] = useState<TouristServiceData[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [allBookings, setAllBookings] = useState<ServiceBookingData[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);

  const loadGuides = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await adminService.listUsers(token, { role: "guide" });
      setGuides(data);
    } catch (_) {
      setGuides([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadGuides();
  }, [loadGuides]);

  useEffect(() => {
    if (mainTab === "services" && token && allServices.length === 0) {
      setServicesLoading(true);
      touristService
        .getMyServices(token)
        .then(setAllServices)
        .catch(() => setAllServices([]))
        .finally(() => setServicesLoading(false));
    }
    if (mainTab === "bookings" && token && allBookings.length === 0) {
      setBookingsLoading(true);
      touristService
        .getGuideBookings(token)
        .then(({ items }) => setAllBookings(items))
        .catch(() => setAllBookings([]))
        .finally(() => setBookingsLoading(false));
    }
  }, [mainTab, token, allServices.length, allBookings.length]);

  const filtered = guides.filter((g) => {
    if (filterStatus !== "all" && g.status !== filterStatus) return false;
    if (filterVerified === "verified" && !g.isVerified) return false;
    if (filterVerified === "unverified" && g.isVerified) return false;
    return true;
  });

  const totalGuides = guides.length;
  const verified = guides.filter((g) => g.isVerified).length;
  const pending = guides.filter((g) => g.status === "pending").length;
  const active = guides.filter((g) => g.status === "active").length;

  function fmtGuideDate(iso: string | null | undefined): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("es-CL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="danger">
          <IonTitle>Guías</IonTitle>
          <div slot="end" style={{ paddingRight: "8px" }}>
            <IonButton
              fill="clear"
              color="light"
              onClick={() => void loadGuides()}
              disabled={loading}
            >
              Actualizar
            </IonButton>
          </div>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonRefresher
          slot="fixed"
          onIonRefresh={async (e) => {
            await loadGuides();
            e.detail.complete();
          }}
        >
          <IonRefresherContent />
        </IonRefresher>

        <IonSegment
          value={mainTab}
          onIonChange={(e) =>
            setMainTab(e.detail.value as "guides" | "services" | "bookings")
          }
          style={{ margin: "8px 16px" }}
        >
          <IonSegmentButton value="guides">
            <IonLabel>Guías</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="services">
            <IonLabel>Servicios</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="bookings">
            <IonLabel>Reservas</IonLabel>
          </IonSegmentButton>
        </IonSegment>

        {mainTab === "services" && (
          <div className="ion-padding">
            {servicesLoading && <IonSpinner name="crescent" />}
            {!servicesLoading && allServices.length === 0 && (
              <IonText color="medium">
                <p>No hay servicios registrados.</p>
              </IonText>
            )}
            {!servicesLoading &&
              allServices.map((svc) => (
                <IonCard key={svc.id} style={{ margin: "0 0 10px" }}>
                  <IonCardContent style={{ padding: "12px 14px" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <strong>{svc.title}</strong>
                      <IonBadge
                        color={svc.status === "active" ? "success" : "medium"}
                        style={{ fontSize: "0.68rem" }}
                      >
                        {svc.status}
                      </IonBadge>
                    </div>
                    <IonNote style={{ display: "block", fontSize: "0.78rem" }}>
                      Tipo: {svc.type}
                    </IonNote>
                    {svc.price !== null && (
                      <IonNote
                        style={{ display: "block", fontSize: "0.78rem" }}
                      >
                        ${(svc.price / 100).toLocaleString("es-CL")} CLP/persona
                      </IonNote>
                    )}
                  </IonCardContent>
                </IonCard>
              ))}
          </div>
        )}

        {mainTab === "bookings" && (
          <div className="ion-padding">
            {bookingsLoading && <IonSpinner name="crescent" />}
            {!bookingsLoading && allBookings.length === 0 && (
              <IonText color="medium">
                <p>No hay reservas de servicios.</p>
              </IonText>
            )}
            {!bookingsLoading &&
              allBookings.map((b) => (
                <IonCard key={b.id} style={{ margin: "0 0 10px" }}>
                  <IonCardContent style={{ padding: "12px 14px" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <strong style={{ fontSize: "0.85rem" }}>
                        #{b.id.slice(0, 8)}
                      </strong>
                      <IonBadge
                        color={
                          b.status === "confirmed"
                            ? "success"
                            : b.status === "pending"
                              ? "warning"
                              : b.status === "completed"
                                ? "medium"
                                : "danger"
                        }
                        style={{ fontSize: "0.68rem" }}
                      >
                        {b.status}
                      </IonBadge>
                    </div>
                    <IonNote style={{ display: "block", fontSize: "0.78rem" }}>
                      {b.bookingDate}
                      {b.bookingTime ? ` ${b.bookingTime}` : ""}
                    </IonNote>
                    <IonNote style={{ display: "block", fontSize: "0.78rem" }}>
                      {b.numberOfPeople} persona
                      {b.numberOfPeople !== 1 ? "s" : ""}
                      {b.totalPrice !== null
                        ? ` · $${(b.totalPrice / 100).toLocaleString("es-CL")} CLP`
                        : ""}
                    </IonNote>
                  </IonCardContent>
                </IonCard>
              ))}
          </div>
        )}

        {mainTab === "guides" && (
          <>
            <div style={{ padding: "12px 16px 4px" }}>
              <p
                style={{
                  color: "var(--ion-color-medium)",
                  margin: 0,
                  fontSize: "0.9rem",
                }}
              >
                Gestión operacional de guías locales y servicios turísticos.
              </p>
            </div>

            {/* Resumen superior */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                padding: "8px 16px",
              }}
            >
              {(
                [
                  { label: "Total", value: totalGuides, color: "primary" },
                  { label: "Verificados", value: verified, color: "success" },
                  { label: "Pendientes", value: pending, color: "warning" },
                  { label: "Activos", value: active, color: "tertiary" },
                ] as { label: string; value: number; color: string }[]
              ).map((stat) => (
                <IonCard
                  key={stat.label}
                  style={{ margin: 0, textAlign: "center" }}
                >
                  <IonCardContent style={{ padding: "8px" }}>
                    <div
                      style={{
                        fontSize: "1.5rem",
                        fontWeight: "bold",
                        color: `var(--ion-color-${stat.color})`,
                      }}
                    >
                      {stat.value}
                    </div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--ion-color-medium)",
                      }}
                    >
                      {stat.label}
                    </div>
                  </IonCardContent>
                </IonCard>
              ))}
            </div>

            {/* Filtros */}
            <IonCard style={{ margin: "0 16px 8px" }}>
              <IonCardContent style={{ padding: "8px 12px" }}>
                <div style={{ display: "flex", gap: "8px" }}>
                  <IonItem lines="none" style={{ flex: 1 }}>
                    <IonLabel
                      position="stacked"
                      style={{ fontSize: "0.78rem" }}
                    >
                      Estado
                    </IonLabel>
                    <IonSelect
                      interface="action-sheet"
                      value={filterStatus}
                      onIonChange={(e) =>
                        setFilterStatus(String(e.detail.value ?? "all"))
                      }
                    >
                      <IonSelectOption value="all">Todos</IonSelectOption>
                      <IonSelectOption value="active">Activos</IonSelectOption>
                      <IonSelectOption value="pending">
                        Pendientes
                      </IonSelectOption>
                      <IonSelectOption value="suspended">
                        Suspendidos
                      </IonSelectOption>
                    </IonSelect>
                  </IonItem>
                  <IonItem lines="none" style={{ flex: 1 }}>
                    <IonLabel
                      position="stacked"
                      style={{ fontSize: "0.78rem" }}
                    >
                      Verificación
                    </IonLabel>
                    <IonSelect
                      interface="action-sheet"
                      value={filterVerified}
                      onIonChange={(e) =>
                        setFilterVerified(String(e.detail.value ?? "all"))
                      }
                    >
                      <IonSelectOption value="all">Todos</IonSelectOption>
                      <IonSelectOption value="verified">
                        Verificados
                      </IonSelectOption>
                      <IonSelectOption value="unverified">
                        No verificados
                      </IonSelectOption>
                    </IonSelect>
                  </IonItem>
                </div>
              </IonCardContent>
            </IonCard>

            {!loading && (
              <IonText color="medium">
                <p style={{ fontSize: "0.78rem", margin: "0 16px 8px" }}>
                  {filtered.length} guía{filtered.length !== 1 ? "s" : ""}{" "}
                  encontrado{filtered.length !== 1 ? "s" : ""}
                </p>
              </IonText>
            )}

            {/* Lista de guías */}
            {loading ? (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  paddingTop: "40px",
                }}
              >
                <IonSpinner name="crescent" />
              </div>
            ) : filtered.length > 0 ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  padding: "0 16px",
                }}
              >
                {filtered.map((guide) => (
                  <IonCard key={guide.id} style={{ margin: 0 }}>
                    <IonCardContent style={{ padding: "12px 14px" }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          marginBottom: 6,
                        }}
                      >
                        <strong style={{ fontSize: "0.95rem" }}>
                          {guide.name}
                        </strong>
                        <div
                          style={{
                            display: "flex",
                            gap: 4,
                            flexWrap: "wrap",
                            justifyContent: "flex-end",
                          }}
                        >
                          <IonBadge
                            color={
                              guide.status === "active"
                                ? "success"
                                : guide.status === "pending"
                                  ? "warning"
                                  : "danger"
                            }
                            style={{ fontSize: "0.68rem" }}
                          >
                            {guide.status === "active"
                              ? "Activo"
                              : guide.status === "pending"
                                ? "Pendiente"
                                : "Suspendido"}
                          </IonBadge>
                          {guide.isVerified && (
                            <IonBadge
                              color="primary"
                              style={{ fontSize: "0.68rem" }}
                            >
                              Verificado
                            </IonBadge>
                          )}
                        </div>
                      </div>
                      <IonNote
                        style={{
                          display: "block",
                          marginBottom: 4,
                          fontSize: "0.8rem",
                        }}
                      >
                        {guide.email}
                      </IonNote>
                      <IonNote
                        style={{
                          display: "block",
                          marginBottom: 4,
                          fontSize: "0.78rem",
                        }}
                      >
                        Especialidad: <em>por definir</em>
                      </IonNote>
                      <IonNote
                        style={{ display: "block", fontSize: "0.78rem" }}
                      >
                        Idiomas: <em>por registrar</em>
                      </IonNote>
                      <IonNote
                        style={{
                          display: "block",
                          fontSize: "0.72rem",
                          marginTop: 6,
                        }}
                      >
                        Registrado: {fmtGuideDate(guide.createdAt)}
                      </IonNote>
                    </IonCardContent>
                  </IonCard>
                ))}
              </div>
            ) : (
              <div style={{ padding: "32px 24px", textAlign: "center" }}>
                <p
                  style={{
                    color: "var(--ion-color-medium)",
                    fontSize: "1rem",
                    fontWeight: 500,
                  }}
                >
                  Aún no hay guías registrados.
                </p>
                <p
                  style={{
                    color: "var(--ion-color-medium)",
                    fontSize: "0.85rem",
                  }}
                >
                  Este módulo permitirá administrar guías locales,
                  especialidades, idiomas y disponibilidad para servicios
                  turísticos.
                </p>
              </div>
            )}

            {/* Próximas fases */}
            <IonCard style={{ margin: "16px" }}>
              <IonCardContent>
                <strong style={{ display: "block", marginBottom: 8 }}>
                  Próximas fases del módulo
                </strong>
                {[
                  "Perfiles de guía con especialidades",
                  "Idiomas y certificaciones",
                  "Zonas y rutas turísticas",
                  "Disponibilidad operacional",
                  "Asignación a servicios y tours",
                ].map((item) => (
                  <IonNote
                    key={item}
                    style={{
                      display: "block",
                      padding: "3px 0",
                      fontSize: "0.85rem",
                    }}
                  >
                    · {item}
                  </IonNote>
                ))}
              </IonCardContent>
            </IonCard>

            <IonItem lines="none">
              <IonLabel
                color="medium"
                style={{ fontSize: "0.8rem", whiteSpace: "normal" }}
              >
                La asignación de guías a servicios se realizará desde el módulo
                Servicios Turísticos.
              </IonLabel>
            </IonItem>
          </>
        )}
      </IonContent>
    </IonPage>
  );
}

export function AdminRentalsPage(): JSX.Element {
  const { session } = useAuth();
  const token = session?.accessToken ?? "";

  const [tab, setTab] = useState<"operators" | "vehicles" | "bookings">(
    "operators",
  );
  const [operators, setOperators] = useState<AdminUserData[]>([]);
  const [vehicles, setVehicles] = useState<RentalVehicleData[]>([]);
  const [allBookings, setAllBookings] = useState<RentalBookingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterVerified, setFilterVerified] = useState<string>("all");

  const loadOperators = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await adminService.listUsers(token, {
        role: "rental_operator",
      });
      setOperators(data);
    } catch (_) {
      setOperators([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadVehicles = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await rentalService.listAvailableVehicles(token, {});
      setVehicles(data.items);
    } catch (_) {
      setVehicles([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadBookings = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await rentalService.getMyRentalBookings(token, 1, 100);
      setAllBookings(data.items);
    } catch (_) {
      setAllBookings([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadOperators();
  }, [loadOperators]);

  useEffect(() => {
    if (tab === "vehicles") void loadVehicles();
    if (tab === "bookings") void loadBookings();
  }, [tab, loadVehicles, loadBookings]);

  const filtered = operators.filter((o) => {
    if (filterStatus !== "all" && o.status !== filterStatus) return false;
    if (filterVerified === "verified" && !o.isVerified) return false;
    if (filterVerified === "unverified" && o.isVerified) return false;
    return true;
  });

  const totalOperators = operators.length;
  const verified = operators.filter((o) => o.isVerified).length;
  const pending = operators.filter((o) => o.status === "pending").length;
  const active = operators.filter((o) => o.status === "active").length;

  function fmtDate(iso: string | null | undefined): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("es-CL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  const VEHICLE_TYPE_LABEL_ADMIN: Record<string, string> = {
    car: "Auto",
    suv: "SUV",
    van: "Van",
    motorcycle: "Moto",
    bicycle: "Bicicleta",
    quad: "Quad",
  };

  const BOOKING_STATUS_COLOR_ADMIN: Record<string, string> = {
    pending: "warning",
    confirmed: "success",
    active: "primary",
    completed: "medium",
    cancelled: "danger",
  };

  const BOOKING_STATUS_LABEL_ADMIN: Record<string, string> = {
    pending: "Pendiente",
    confirmed: "Confirmada",
    active: "Activa",
    completed: "Completada",
    cancelled: "Cancelada",
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="danger">
          <IonTitle>Rent a Car</IonTitle>
          <div slot="end" style={{ paddingRight: "8px" }}>
            <IonButton
              fill="clear"
              color="light"
              onClick={() => {
                if (tab === "operators") void loadOperators();
                if (tab === "vehicles") void loadVehicles();
                if (tab === "bookings") void loadBookings();
              }}
              disabled={loading}
            >
              Actualizar
            </IonButton>
          </div>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonRefresher
          slot="fixed"
          onIonRefresh={async (e) => {
            if (tab === "operators") await loadOperators();
            if (tab === "vehicles") await loadVehicles();
            if (tab === "bookings") await loadBookings();
            e.detail.complete();
          }}
        >
          <IonRefresherContent />
        </IonRefresher>

        <IonSegment
          value={tab}
          onIonChange={(e) => setTab(e.detail.value as typeof tab)}
          style={{ padding: "8px" }}
        >
          <IonSegmentButton value="operators">
            <IonLabel>Operadores</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="vehicles">
            <IonLabel>Vehículos</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="bookings">
            <IonLabel>Reservas</IonLabel>
          </IonSegmentButton>
        </IonSegment>

        {loading && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              paddingTop: "40px",
            }}
          >
            <IonSpinner name="crescent" />
          </div>
        )}

        {!loading && tab === "operators" && (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                padding: "8px 16px",
              }}
            >
              {(
                [
                  { label: "Total", value: operators.length, color: "primary" },
                  {
                    label: "Activos",
                    value: operators.filter((o) => o.status === "active")
                      .length,
                    color: "tertiary",
                  },
                  {
                    label: "Pendientes",
                    value: operators.filter((o) => o.status === "pending")
                      .length,
                    color: "warning",
                  },
                  {
                    label: "Verificados",
                    value: operators.filter((o) => o.isVerified).length,
                    color: "success",
                  },
                ] as { label: string; value: number; color: string }[]
              ).map((stat) => (
                <IonCard
                  key={stat.label}
                  style={{ margin: 0, textAlign: "center" }}
                >
                  <IonCardContent style={{ padding: "8px" }}>
                    <div
                      style={{
                        fontSize: "1.5rem",
                        fontWeight: "bold",
                        color: `var(--ion-color-${stat.color})`,
                      }}
                    >
                      {stat.value}
                    </div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--ion-color-medium)",
                      }}
                    >
                      {stat.label}
                    </div>
                  </IonCardContent>
                </IonCard>
              ))}
            </div>

            <IonCard style={{ margin: "0 16px 8px" }}>
              <IonCardContent style={{ padding: "8px 12px" }}>
                <div style={{ display: "flex", gap: "8px" }}>
                  <IonItem lines="none" style={{ flex: 1 }}>
                    <IonLabel
                      position="stacked"
                      style={{ fontSize: "0.78rem" }}
                    >
                      Estado
                    </IonLabel>
                    <IonSelect
                      interface="action-sheet"
                      value={filterStatus}
                      onIonChange={(e) =>
                        setFilterStatus(String(e.detail.value ?? "all"))
                      }
                    >
                      <IonSelectOption value="all">Todos</IonSelectOption>
                      <IonSelectOption value="active">Activos</IonSelectOption>
                      <IonSelectOption value="pending">
                        Pendientes
                      </IonSelectOption>
                      <IonSelectOption value="suspended">
                        Suspendidos
                      </IonSelectOption>
                    </IonSelect>
                  </IonItem>
                  <IonItem lines="none" style={{ flex: 1 }}>
                    <IonLabel
                      position="stacked"
                      style={{ fontSize: "0.78rem" }}
                    >
                      Verificación
                    </IonLabel>
                    <IonSelect
                      interface="action-sheet"
                      value={filterVerified}
                      onIonChange={(e) =>
                        setFilterVerified(String(e.detail.value ?? "all"))
                      }
                    >
                      <IonSelectOption value="all">Todos</IonSelectOption>
                      <IonSelectOption value="verified">
                        Verificados
                      </IonSelectOption>
                      <IonSelectOption value="unverified">
                        No verificados
                      </IonSelectOption>
                    </IonSelect>
                  </IonItem>
                </div>
              </IonCardContent>
            </IonCard>

            {filtered.length === 0 ? (
              <IonText color="medium">
                <p style={{ padding: "0 16px" }}>Sin operadores registrados.</p>
              </IonText>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  padding: "0 16px 16px",
                }}
              >
                {filtered.map((op) => (
                  <IonCard key={op.id} style={{ margin: 0 }}>
                    <IonCardContent style={{ padding: "12px 14px" }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          marginBottom: 6,
                        }}
                      >
                        <strong style={{ fontSize: "0.95rem" }}>
                          {op.name}
                        </strong>
                        <div style={{ display: "flex", gap: 4 }}>
                          <IonBadge
                            color={
                              op.status === "active"
                                ? "success"
                                : op.status === "pending"
                                  ? "warning"
                                  : "danger"
                            }
                            style={{ fontSize: "0.68rem" }}
                          >
                            {op.status === "active"
                              ? "Activo"
                              : op.status === "pending"
                                ? "Pendiente"
                                : "Suspendido"}
                          </IonBadge>
                          {op.isVerified && (
                            <IonBadge
                              color="primary"
                              style={{ fontSize: "0.68rem" }}
                            >
                              Verificado
                            </IonBadge>
                          )}
                        </div>
                      </div>
                      <IonNote style={{ display: "block", fontSize: "0.8rem" }}>
                        {op.email}
                      </IonNote>
                    </IonCardContent>
                  </IonCard>
                ))}
              </div>
            )}
          </>
        )}

        {!loading && tab === "vehicles" && (
          <div style={{ padding: "8px 16px" }}>
            {vehicles.length === 0 ? (
              <IonText color="medium">
                <p>No hay vehículos disponibles registrados.</p>
              </IonText>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                {vehicles.map((v) => (
                  <IonCard key={v.id} style={{ margin: 0 }}>
                    <IonCardContent style={{ padding: "12px 14px" }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                            {v.brand} {v.model}
                            {v.year ? ` (${v.year})` : ""}
                          </div>
                          <div
                            style={{
                              fontSize: "0.78rem",
                              color: "var(--ion-color-medium)",
                            }}
                          >
                            {v.plate} ·{" "}
                            {VEHICLE_TYPE_LABEL_ADMIN[v.type] ?? v.type}
                          </div>
                          <div
                            style={{
                              fontSize: "0.82rem",
                              fontWeight: 600,
                              color: "var(--ion-color-success)",
                              marginTop: "2px",
                            }}
                          >
                            ${(v.dailyPrice / 100).toLocaleString("es-CL")}/día
                          </div>
                        </div>
                        <IonBadge
                          color="success"
                          style={{ fontSize: "0.68rem" }}
                        >
                          Disponible
                        </IonBadge>
                      </div>
                    </IonCardContent>
                  </IonCard>
                ))}
              </div>
            )}
          </div>
        )}

        {!loading && tab === "bookings" && (
          <div style={{ padding: "8px 16px" }}>
            {allBookings.length === 0 ? (
              <IonText color="medium">
                <p>No hay reservas de arriendo.</p>
              </IonText>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                {allBookings.map((b) => {
                  const days = Math.max(
                    1,
                    Math.round(
                      (new Date(b.endDate).getTime() -
                        new Date(b.startDate).getTime()) /
                        (1000 * 60 * 60 * 24),
                    ),
                  );
                  return (
                    <IonCard key={b.id} style={{ margin: 0 }}>
                      <IonCardContent style={{ padding: "12px 14px" }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                          }}
                        >
                          <div>
                            <div
                              style={{ fontWeight: 600, fontSize: "0.9rem" }}
                            >
                              {b.vehicleBrand ?? ""} {b.vehicleModel ?? ""} (
                              {b.vehiclePlate ?? ""})
                            </div>
                            <div
                              style={{
                                fontSize: "0.78rem",
                                color: "var(--ion-color-medium)",
                              }}
                            >
                              {b.startDate} → {b.endDate} · {days} día
                              {days !== 1 ? "s" : ""}
                            </div>
                            {b.totalPrice !== null && (
                              <div
                                style={{
                                  fontSize: "0.82rem",
                                  fontWeight: 600,
                                  color: "var(--ion-color-success)",
                                }}
                              >
                                ${(b.totalPrice / 100).toLocaleString("es-CL")}
                              </div>
                            )}
                          </div>
                          <IonBadge
                            color={
                              BOOKING_STATUS_COLOR_ADMIN[b.status] ?? "medium"
                            }
                            style={{ fontSize: "0.68rem" }}
                          >
                            {BOOKING_STATUS_LABEL_ADMIN[b.status] ?? b.status}
                          </IonBadge>
                        </div>
                      </IonCardContent>
                    </IonCard>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </IonContent>
    </IonPage>
  );
}

type AdminRideScheduleInfo = {
  isScheduled: boolean;
  scheduledAt: string | null;
  returnScheduledAt: string | null;
  activationAt: string | null;
  isActiveWindow: boolean;
  isReturnOnlyPromotion: boolean;
  displayScheduledAt: string | null;
};

function getRideUnknownField(ride: AdminRideData, key: string): unknown {
  return (ride as unknown as Record<string, unknown>)[key];
}

function getRideStringField(ride: AdminRideData, keys: string[]): string | null {
  for (const key of keys) {
    const value = getRideUnknownField(ride, key);
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function getRideBooleanField(ride: AdminRideData, keys: string[]): boolean {
  return keys.some((key) => getRideUnknownField(ride, key) === true);
}

function getRideNumberField(ride: AdminRideData, keys: string[]): number | null {
  for (const key of keys) {
    const value = getRideUnknownField(ride, key);

    if (typeof value === "number" && Number.isFinite(value)) {
      return Math.max(0, Math.round(value));
    }

    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value.replace(/[^0-9.-]/g, ""));
      if (Number.isFinite(parsed)) return Math.max(0, Math.round(parsed));
    }
  }

  return null;
}

function extractAdminRideFlowerLeiAmountFromNotes(notes: string | null | undefined): number | null {
  if (!notes) return null;

  const match = notes.match(/(?:recargo recibimiento|collar[^.]*\+|collar[^.]*:)[^0-9]*(\$?\s*[0-9]{1,3}(?:\.[0-9]{3})*|[0-9]+)/i);
  if (!match?.[1]) return null;

  const parsed = Number(match[1].replace(/[^0-9]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}

function getAdminRideAirportWelcomeInfo(ride: AdminRideData): { label: string; amountClp: number } | null {
  const rawNotes = typeof ride.notes === "string" ? ride.notes : "";
  const normalizedNotes = normalizeAdminText(rawNotes);
  const option = normalizeAdminText(getRideStringField(ride, ["airportWelcomeOption", "airport_welcome_option"]));
  const label =
    getRideStringField(ride, ["airportWelcomeLabel", "airport_welcome_label", "flowerLeiLabel"]) ??
    "Collar de flores Rapa Nui";

  const requested =
    getRideBooleanField(ride, ["flowerLeiRequested", "airportFlowerLeiRequested", "hasAirportFlowerLei"]) ||
    option === "flower_lei" ||
    normalizedNotes.includes("collar de flores") ||
    normalizedNotes.includes("recibimiento aeropuerto: collar") ||
    normalizedNotes.includes("recargo recibimiento collar");

  if (!requested) return null;

  const amountClp =
    getRideNumberField(ride, [
      "flowerLeiSurchargeClp",
      "airportWelcomeSurchargeClp",
      "optionalServicesTotalClp",
      "airport_welcome_surcharge_clp",
    ]) ??
    extractAdminRideFlowerLeiAmountFromNotes(rawNotes) ??
    4000;

  return {
    label,
    amountClp,
  };
}

function toIsoOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function formatAdminScheduleDate(value: string | null | undefined): string {
  if (!value) return "Sin hora";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return "Sin hora";
  return parsed.toLocaleString("es-CL", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function extractAdminIsoByKeywords(
  notes: string | null | undefined,
  keywords: string[],
): string | null {
  if (!notes) return null;

  const isoPattern =
    "([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(?::[0-9]{2}(?:\\.[0-9]{1,3})?)?(?:Z|[+-][0-9]{2}:?[0-9]{2})?)";

  for (const keyword of keywords) {
    const safeKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = notes.match(new RegExp(`${safeKeyword}\\s*[:=]\\s*${isoPattern}`, "i"));
    const parsed = toIsoOrNull(match?.[1] ?? null);
    if (parsed) return parsed;
  }

  return null;
}

function extractScheduleIsoFromNotes(notes: string | null | undefined): string | null {
  return extractAdminIsoByKeywords(notes, [
    "RAPAGO_SCHEDULED_AT",
    "Fecha y hora de recogida agendada",
    "Fecha recogida agendada",
    "scheduledAt",
    "scheduledPickupAt",
    "pickupScheduledAt",
  ]);
}

function extractReturnIsoFromNotes(notes: string | null | undefined): string | null {
  return extractAdminIsoByKeywords(notes, [
    "RAPAGO_RETURN_SCHEDULED_AT",
    "RAPAGO_RETURN_AT",
    "Fecha y hora de regreso agendada",
    "Fecha regreso agendada",
    "returnScheduledAt",
    "scheduledReturnAt",
  ]);
}

function extractActivationIsoFromNotes(notes: string | null | undefined): string | null {
  return extractAdminIsoByKeywords(notes, [
    "RAPAGO_ACTIVATION_AT",
    "Activación automática recogida",
    "Activacion automatica recogida",
    "scheduleActivationAt",
    "dispatchAt",
    "autoAssignAt",
  ]);
}

function extractReturnActivationIsoFromNotes(notes: string | null | undefined): string | null {
  return extractAdminIsoByKeywords(notes, [
    "RAPAGO_RETURN_ACTIVATION_AT",
    "RAPAGO_RETURN_DISPATCH_AT",
    "scheduledReturnActivationAt",
    "returnActivationAt",
    "returnDispatchAt",
  ]);
}

function getRideLowerTextField(ride: AdminRideData, keys: string[]): string {
  return keys
    .map((key) => String(getRideUnknownField(ride, key) ?? ""))
    .join(" ")
    .toLowerCase()
    .trim();
}

function isAdminReturnOnlyPromotionRide(ride: AdminRideData): boolean {
  const notes = String(ride.notes ?? "").toLowerCase();
  const metaText = getRideLowerTextField(ride, [
    "bookingPurpose",
    "serviceType",
    "reservationStatus",
    "adminScheduleStatus",
    "scheduleStatus",
    "tripType",
    "tripFareMode",
  ]);

  return (
    getRideUnknownField(ride, "roundTripReturnOnly") === true ||
    getRideUnknownField(ride, "returnOnly") === true ||
    getRideUnknownField(ride, "isReturnOnlyPromotion") === true ||
    metaText.includes("round_trip_return_only") ||
    metaText.includes("round_trip_return") ||
    metaText.includes("return_pending_admin_round_trip_promotion") ||
    metaText.includes("round_trip_return_reserved") ||
    notes.includes("solo se agenda el regreso") ||
    notes.includes("promoción con regreso agendado") ||
    notes.includes("promocion con regreso agendado") ||
    notes.includes("promoción regreso") ||
    notes.includes("promocion regreso") ||
    notes.includes("experiencia ida y vuelta") ||
    notes.includes("round_trip_experience") ||
    notes.includes("experiencia reservada")
  );
}

function isAdminRoundTripExperienceRide(ride: AdminRideData): boolean {
  if (isAdminReturnReservationCard(ride)) return false;

  const notes = String(ride.notes ?? "").toLowerCase();
  const metaText = getRideLowerTextField(ride, [
    "bookingPurpose",
    "serviceType",
    "reservationStatus",
    "reservationKind",
    "tripType",
    "tripFareMode",
  ]);

  return (
    getRideUnknownField(ride, "roundTripExperienceBooking") === true ||
    getRideUnknownField(ride, "reservationKind") === "round_trip_experience" ||
    metaText.includes("round_trip_experience") ||
    notes.includes("rapago_reservation_kind: round_trip_experience") ||
    notes.includes("experiencia con reserva ida y vuelta") ||
    notes.includes("experiencia ida y vuelta programada")
  );
}

function isAdminReturnReservationCard(ride: AdminRideData): boolean {
  const id = String(ride.id ?? "").toLowerCase();
  return (
    id.startsWith("admin-return-") ||
    getRideUnknownField(ride, "returnReservationCard") === true ||
    getRideUnknownField(ride, "managedByAdminForReturn") === true
  );
}

function getAdminReturnOriginalRideId(ride: AdminRideData): string {
  return String(
    getRideUnknownField(ride, "returnTripParentRideId") ??
      getRideUnknownField(ride, "originalRideId") ??
      getRideUnknownField(ride, "parentRideId") ??
      getRideUnknownField(ride, "sourceRideId") ??
      ride.id ??
      "",
  ).trim();
}

function getAdminReturnActivationAt(ride: AdminRideData, returnScheduledAt: string | null): string | null {
  return (
    toIsoOrNull(getRideStringField(ride, [
      "scheduledReturnActivationAt",
      "returnActivationAt",
      "returnDispatchAt",
      "returnAutoAssignAt",
    ])) ??
    extractReturnActivationIsoFromNotes(ride.notes) ??
    (returnScheduledAt
      ? new Date(new Date(returnScheduledAt).getTime() - SCHEDULE_ACTIVATION_MINUTES_ADMIN * 60_000).toISOString()
      : null)
  );
}

function buildAdminReturnReservationFromRide(ride: AdminRideData): AdminRideData | null {
  if (isAdminReturnReservationCard(ride)) return null;

  const isLegacyReturnOnly = isAdminReturnOnlyPromotionRide(ride);
  const isRoundTripExperience = isAdminRoundTripExperienceRide(ride);

  if (!isLegacyReturnOnly && !isRoundTripExperience) return null;

  const schedule = getAdminRideScheduleInfo(ride);
  const returnAt = schedule.returnScheduledAt;
  if (!returnAt) return null;

  const originalId = getAdminReturnOriginalRideId(ride);
  const returnId = `admin-return-${originalId || ride.id}`;
  const returnActivationAt = getAdminReturnActivationAt(ride, returnAt);
  const originText = String(ride.destinationText ?? "Punto de regreso").trim() || "Punto de regreso";
  const destinationText = String(ride.originText ?? "Destino regreso").trim() || "Destino regreso";

  return {
    ...(ride as AdminRideData & Record<string, unknown>),
    id: returnId,
    originalRideId: originalId || ride.id,
    returnTripParentRideId: originalId || ride.id,
    originText,
    destinationText,
    status: "scheduled",
    isScheduled: true,
    roundTripReturnOnly: true,
    isReturnOnlyPromotion: true,
    returnReservationCard: true,
    managedByAdminForReturn: true,
    roundTripPromotionBooking: true,
    bookingPurpose: "round_trip_return_only",
    serviceType: "round_trip_return_only",
    adminScheduleStatus:
      String(getRideUnknownField(ride, "returnDriverAssignmentStatus") ?? "") === "pending_driver_acceptance"
        ? "return_pending_driver_confirmation"
        : "return_pending_admin_round_trip_promotion",
    reservationStatus: "round_trip_return_reserved",
    scheduleStatus: "frozen_until_return_activation",
    scheduledAt: returnAt,
    scheduledPickupAt: returnAt,
    pickupScheduledAt: returnAt,
    returnScheduledAt: returnAt,
    scheduledReturnAt: returnAt,
    scheduledReturnActivationAt: returnActivationAt,
    returnActivationAt: returnActivationAt,
    returnDispatchAt: returnActivationAt,
    scheduleActivationAt: returnActivationAt,
    dispatchAt: returnActivationAt,
    autoAssignAt: returnActivationAt,
    driverVisibleAt: returnActivationAt,
    driverFrozenUntil: returnActivationAt,
    frozenUntil: returnActivationAt,
    availableForDrivers: false,
    visibleToDrivers: false,
    driverQueueBlocked: true,
    frozenForDrivers: true,
    adminVisibleNow: true,
    adminRequiresReview: true,
    passengerNotification:
      getRideUnknownField(ride, "returnPassengerNotification") ??
      "Tu regreso está agendado. RAPA GO asignará un conductor para la vuelta.",
    notes: `${String(ride.notes ?? "").trim()} Gestión admin: regreso de experiencia reservada. El admin debe asignar conductor para el regreso ${originText} → ${destinationText}.`.trim(),
    localAdminOverride: true,
    reservationRequiresCard: true,
    paymentRequiredProvider: "mercadopago",
    cardCancellationCreditToWallet: false,
    cardCancellationCreditName: null,
    reservationCancellationWindowMinutes: 30,
    adminAssignmentWindowMinutes: 30,
  } as AdminRideData;
}

function readLocalPassengerReturnReservationsForAdmin(): AdminRideData[] {
  try {
    return readLocalPassengerRidesForAdmin()
      .map((item) => buildAdminReturnReservationFromRide(item as unknown as AdminRideData))
      .filter((ride): ride is AdminRideData => Boolean(ride));
  } catch {
    return [];
  }
}

function buildAdminReturnReservationsFromRides(rides: AdminRideData[]): AdminRideData[] {
  const seen = new Set<string>();
  const result: AdminRideData[] = [];

  rides.forEach((ride) => {
    const returnRide = buildAdminReturnReservationFromRide(ride);
    if (!returnRide) return;
    const key = getAdminRideMergeKey(returnRide);
    if (seen.has(key)) return;
    seen.add(key);
    result.push(returnRide);
  });

  return result;
}

function includeGeneratedRoundTripReturnLegs(rides: AdminRideData[]): AdminRideData[] {
  const existingIds = new Set(
    rides.map((ride) => String(ride.id ?? "").trim()).filter(Boolean),
  );
  const generatedReturns = buildAdminReturnReservationsFromRides(rides).filter(
    (ride) => !existingIds.has(String(ride.id ?? "").trim()),
  );

  return mergeAdminRides([...rides, ...generatedReturns]);
}

function hasAdminAssignedDriver(ride: AdminRideData): boolean {
  return Boolean(
    ride.driverUserId ||
      ride.driverName ||
      getRideUnknownField(ride, "assignedDriverId") ||
      getRideUnknownField(ride, "assignedDriverUserId") ||
      getRideUnknownField(ride, "assignedDriverName"),
  );
}

function isScheduleActivatedByAdmin(ride: AdminRideData): boolean {
  const status = String(
    getRideUnknownField(ride, "scheduleStatus") ??
      getRideUnknownField(ride, "adminScheduleStatus") ??
      getRideUnknownField(ride, "reservationStatus") ??
      "",
  )
    .toLowerCase()
    .trim();

  return [
    "active",
    "activated",
    "enabled",
    "released",
    "dispatching",
    "searching_drivers",
  ].includes(status);
}

function getAdminRideScheduleInfo(ride: AdminRideData): AdminRideScheduleInfo {
  const returnScheduledAt =
    toIsoOrNull(getRideStringField(ride, [
      "returnScheduledAt",
      "scheduledReturnAt",
      "returnAt",
    ])) ?? extractReturnIsoFromNotes(ride.notes);

  const isReturnOnlyPromotion = isAdminReturnReservationCard(ride);

  const scheduledAt =
    toIsoOrNull(getRideStringField(ride, [
      "scheduledAt",
      "scheduledPickupAt",
      "pickupScheduledAt",
      "pickupAt",
      "reservedAt",
    ])) ?? extractScheduleIsoFromNotes(ride.notes);

  const displayScheduledAt = isReturnOnlyPromotion
    ? returnScheduledAt ?? scheduledAt
    : scheduledAt;

  const activationAt =
    (isReturnOnlyPromotion ? getAdminReturnActivationAt(ride, returnScheduledAt ?? scheduledAt) : null) ??
    toIsoOrNull(getRideStringField(ride, [
      "scheduleActivationAt",
      "dispatchAt",
      "autoAssignAt",
      "autoDispatchAt",
    ])) ??
    extractActivationIsoFromNotes(ride.notes) ??
    (displayScheduledAt
      ? new Date(new Date(displayScheduledAt).getTime() - SCHEDULE_ACTIVATION_MINUTES_ADMIN * 60_000).toISOString()
      : null);

  const isScheduled =
    getRideBooleanField(ride, ["isScheduled", "scheduled", "isReservation"]) ||
    ride.status === "scheduled" ||
    !!scheduledAt ||
    (isReturnOnlyPromotion && !!returnScheduledAt) ||
    /Viaje (?:agendado|programado) para:/i.test(ride.notes ?? "");

  const activationTime = activationAt ? new Date(activationAt).getTime() : 0;
  const isActiveWindow =
    isScheduleActivatedByAdmin(ride) ||
    (!!activationAt && Number.isFinite(activationTime) && Date.now() >= activationTime);

  return {
    isScheduled,
    scheduledAt,
    returnScheduledAt,
    activationAt,
    isActiveWindow,
    isReturnOnlyPromotion,
    displayScheduledAt,
  };
}

function isAdminRideNoShow(ride: AdminRideData): boolean {
  const record = ride as AdminRideData & Record<string, unknown>;
  const directStatus = String(record.status ?? "").trim().toLowerCase();
  const finalState = String(record.driverFinalState ?? record.finalState ?? "").trim().toLowerCase();
  const cancelledBy = String(record.cancelledByRole ?? record.cancelledBy ?? "").trim().toLowerCase();
  const reason = String(record.cancellationReason ?? record.cancelReason ?? record.requeuedReason ?? "").trim().toLowerCase();

  return (
    directStatus === "no_show" ||
    directStatus === "no-show" ||
    record.driverNoShowClosed === true ||
    record.noShowCompleted === true ||
    record.noShowConfirmedByDriver === true ||
    record.passengerNoShow === true ||
    Boolean(record.noShowConfirmedAt) ||
    finalState.includes("no_show") ||
    cancelledBy.includes("no_show") ||
    reason.includes("no show") ||
    reason.includes("no-show")
  );
}

function getEffectiveAdminRideStatus(ride: AdminRideData): string {
  if (isAdminRideNoShow(ride)) return "no_show";

  const schedule = getAdminRideScheduleInfo(ride);

  if (
    schedule.isScheduled &&
    !schedule.isActiveWindow &&
    ["requested", "scheduled"].includes(ride.status)
  ) {
    return "scheduled";
  }

  if (ride.status === "scheduled" && schedule.isActiveWindow) return "requested";

  return ride.status;
}

function readLocalAdminScheduledRides(): AdminRideData[] {
  try {
    const raw = localStorage.getItem(LOCAL_ADMIN_SCHEDULED_RIDES_KEY);
    const parsed = raw ? (JSON.parse(raw) as AdminRideData[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalAdminScheduledRidesForAdmin(rides: AdminRideData[]): void {
  try {
    localStorage.setItem(LOCAL_ADMIN_SCHEDULED_RIDES_KEY, JSON.stringify(rides));
    window.dispatchEvent(new CustomEvent("rapago:admin-scheduled-rides-updated"));
  } catch {
    // No bloquea la administración local.
  }
}

function readLocalPassengerRidesForAdmin(): Array<Record<string, unknown>> {
  try {
    const raw = localStorage.getItem(LOCAL_PASSENGER_RIDES_KEY_ADMIN);
    const parsed = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalPassengerRidesForAdmin(rides: Array<Record<string, unknown>>): void {
  try {
    localStorage.setItem(LOCAL_PASSENGER_RIDES_KEY_ADMIN, JSON.stringify(rides));
    window.dispatchEvent(new CustomEvent("rapago:passenger-rides-updated"));
  } catch {
    // No bloquea la administración local.
  }
}

function getAdminRideMergeKey(ride: AdminRideData): string {
  const schedule = getAdminRideScheduleInfo(ride);
  return [
    ride.id?.startsWith("admin-local-") ? "scheduled-shadow" : ride.id,
    schedule.scheduledAt ?? "",
    ride.originText ?? "",
    ride.destinationText ?? "",
    ride.passengerEmail ?? "",
  ]
    .map((value) => String(value ?? "").trim().toLowerCase())
    .join("|");
}

function getScheduledPassengerMirrorKey(ride: Record<string, unknown>): string {
  return [
    ride.scheduledAt ?? ride.scheduledPickupAt ?? ride.pickupScheduledAt ?? "",
    ride.originText ?? "",
    ride.destinationText ?? "",
    ride.passengerEmail ?? "",
  ]
    .map((value) => String(value ?? "").trim().toLowerCase())
    .join("|");
}

function buildActivatedScheduledRide(ride: AdminRideData): AdminRideData {
  const nowIso = new Date().toISOString();
  const schedule = getAdminRideScheduleInfo(ride);

  return {
    ...(ride as AdminRideData & Record<string, unknown>),
    status: "requested",
    requestedAt: ride.requestedAt ?? nowIso,
    scheduledAt: schedule.displayScheduledAt ?? schedule.scheduledAt,
    scheduledPickupAt: schedule.displayScheduledAt ?? schedule.scheduledAt,
    pickupScheduledAt: schedule.displayScheduledAt ?? schedule.scheduledAt,
    scheduleActivationAt: schedule.activationAt ?? nowIso,
    dispatchAt: schedule.activationAt ?? nowIso,
    autoAssignAt: schedule.activationAt ?? nowIso,
    scheduleStatus: schedule.isReturnOnlyPromotion ? "return_active" : "active",
    adminScheduleStatus: schedule.isReturnOnlyPromotion ? "return_active" : "active",
    reservationStatus: schedule.isReturnOnlyPromotion ? "round_trip_return_active" : getRideUnknownField(ride, "reservationStatus"),
    activatedAt: nowIso,
    localAdminOverride: true,
  } as AdminRideData;
}

function mergeAdminRides(rides: AdminRideData[]): AdminRideData[] {
  const byKey = new Map<string, AdminRideData>();

  rides.forEach((ride) => {
    const key = getAdminRideMergeKey(ride);
    const current = byKey.get(key);
    const incomingIsLocalOverride = getRideUnknownField(ride, "localAdminOverride") === true;
    const currentIsLocalOverride = current
      ? getRideUnknownField(current, "localAdminOverride") === true
      : false;

    if (!current || incomingIsLocalOverride || !currentIsLocalOverride) {
      byKey.set(key, ride);
    }
  });

  return Array.from(byKey.values());
}

function getDriverStringField(driver: ActiveDriverData, keys: string[]): string | null {
  const data = driver as unknown as Record<string, unknown>;
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function readPendingAdminDriverAssignmentRide(): AdminRideData | null {
  try {
    const raw = localStorage.getItem(ADMIN_DRIVER_ASSIGNMENT_SELECTION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AdminRideData;
    if (!parsed || typeof parsed !== "object" || !parsed.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

function clearPendingAdminDriverAssignmentRide(): void {
  try {
    localStorage.removeItem(ADMIN_DRIVER_ASSIGNMENT_SELECTION_KEY);
    window.dispatchEvent(new CustomEvent(ADMIN_DRIVER_ASSIGNMENT_EVENT));
  } catch {
    // No bloquea la UI.
  }
}

function normalizeAdminDriverQueueKey(value: unknown): string | null {
  const normalized = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  return normalized || null;
}

function getDriverScheduledQueueKeys(driver: ActiveDriverData): string[] {
  const data = driver as unknown as Record<string, unknown>;

  const values = [
    driver.id,
    data.userId,
    data.driverId,
    data.driverUserId,
    driver.email,
    data.emailAddress,
    data.driverEmail,
    driver.name,
    data.fullName,
    data.displayName,
    data.driverName,
    data.phone,
    data.driverPhone,
    data.mobile,
    data.phoneNumber,
  ];

  const keys = new Set<string>();

  values.forEach((value) => {
    const raw = String(value ?? "").trim();
    const normalized = normalizeAdminDriverQueueKey(value);

    if (raw) keys.add(raw);
    if (normalized) keys.add(normalized);
  });

  return Array.from(keys);
}

function readDriverScheduledQueue(): Record<string, AdminRideData[]> {
  try {
    const raw = localStorage.getItem(LOCAL_DRIVER_SCHEDULED_QUEUE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, AdminRideData[]>) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveDriverScheduledQueue(queue: Record<string, AdminRideData[]>): void {
  try {
    localStorage.setItem(LOCAL_DRIVER_SCHEDULED_QUEUE_KEY, JSON.stringify(queue));
    window.dispatchEvent(new CustomEvent(DRIVER_ASSIGNED_RIDE_EVENT));
  } catch {
    // No bloquea la asignación.
  }
}

function readDriverReservationInbox(): AdminRideData[] {
  try {
    const raw = localStorage.getItem(LOCAL_DRIVER_RESERVATION_INBOX_KEY);
    const parsed = raw ? (JSON.parse(raw) as AdminRideData[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveDriverReservationInbox(rides: AdminRideData[]): void {
  try {
    localStorage.setItem(
      LOCAL_DRIVER_RESERVATION_INBOX_KEY,
      JSON.stringify(rides.slice(0, 160)),
    );
  } catch {
    // No bloquea la asignación.
  }
}

function readDriverReservationInboxByDriver(): Record<string, AdminRideData[]> {
  try {
    const raw = localStorage.getItem(LOCAL_DRIVER_RESERVATION_INBOX_BY_DRIVER_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, AdminRideData[]>) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function saveDriverReservationInboxByDriver(queue: Record<string, AdminRideData[]>): void {
  try {
    localStorage.setItem(LOCAL_DRIVER_RESERVATION_INBOX_BY_DRIVER_KEY, JSON.stringify(queue));
  } catch {
    // No bloquea la asignación.
  }
}

function upsertDriverScheduledRideForNotification(ride: AdminRideData, driver: ActiveDriverData): void {
  try {
    const keys = getDriverScheduledQueueKeys(driver);
    const rideKey = getAdminRideMergeKey(ride);

    const queue = readDriverScheduledQueue();
    const inboxByDriver = readDriverReservationInboxByDriver();

    const inboxRide = {
      ...(ride as AdminRideData & Record<string, unknown>),
      assignedDriverKeys: keys,
      assignedDriverQueueKeys: keys,
      driverReservationInboxOnly: true,
      reservationInboxOnly: true,
      assignedOnlyToDriver: true,
      visibleInDriverReservations: true,
      hiddenFromNormalRequests: true,
      roundTripReturnOnly: isAdminReturnOnlyPromotionRide(ride),
      isReturnOnlyPromotion: isAdminReturnOnlyPromotionRide(ride),
    } as AdminRideData;

    for (const key of keys) {
      const normalizedKey = normalizeAdminDriverQueueKey(key) ?? key;
      const targetKeys = Array.from(new Set([key, normalizedKey].filter(Boolean)));

      for (const targetKey of targetKeys) {
        const current = Array.isArray(queue[targetKey]) ? queue[targetKey] : [];
        queue[targetKey] = [
          inboxRide,
          ...current.filter((item) => getAdminRideMergeKey(item) !== rideKey && item.id !== ride.id),
        ].slice(0, 80);

        const inboxCurrent = Array.isArray(inboxByDriver[targetKey]) ? inboxByDriver[targetKey] : [];
        inboxByDriver[targetKey] = [
          inboxRide,
          ...inboxCurrent.filter((item) => getAdminRideMergeKey(item) !== rideKey && item.id !== ride.id),
        ].slice(0, 80);
      }
    }

    saveDriverScheduledQueue(queue);
    saveDriverReservationInboxByDriver(inboxByDriver);

    const flatCurrentRaw = localStorage.getItem(LOCAL_DRIVER_ASSIGNED_RIDES_KEY);
    const flatCurrent = flatCurrentRaw ? (JSON.parse(flatCurrentRaw) as AdminRideData[]) : [];
    const flat = Array.isArray(flatCurrent) ? flatCurrent : [];
    localStorage.setItem(
      LOCAL_DRIVER_ASSIGNED_RIDES_KEY,
      JSON.stringify([inboxRide, ...flat.filter((item) => getAdminRideMergeKey(item) !== rideKey && item.id !== ride.id)].slice(0, 120)),
    );

    const inbox = readDriverReservationInbox();
    saveDriverReservationInbox([
      inboxRide,
      ...inbox.filter((item) => getAdminRideMergeKey(item) !== rideKey && item.id !== ride.id),
    ]);

    window.dispatchEvent(new CustomEvent(DRIVER_ASSIGNED_RIDE_EVENT, { detail: { rideId: ride.id, driverId: driver.id, keys } }));
    window.dispatchEvent(new CustomEvent("rapago:driver-reservation-inbox-updated", { detail: { rideId: ride.id, driverId: driver.id, keys } }));
  } catch {
    // No bloquea al admin.
  }
}

function buildAssignedScheduledRide(ride: AdminRideData, driver: ActiveDriverData): AdminRideData {
  const nowIso = new Date().toISOString();
  const driverPhone = getDriverStringField(driver, ["phone", "driverPhone", "mobile", "phoneNumber"]);
  const driverVehicleBrand = getDriverStringField(driver, ["vehicleBrand", "driverVehicleBrand", "carBrand"]);
  const driverVehicleModel = getDriverStringField(driver, ["vehicleModel", "driverVehicleModel", "carModel"]);
  const driverVehicleColor = getDriverStringField(driver, ["vehicleColor", "driverVehicleColor", "carColor"]);
  const driverVehiclePlate = getDriverStringField(driver, ["vehiclePlate", "driverVehiclePlate", "plate"]);
  const driverVehicleYear = getDriverStringField(driver, ["vehicleYear", "driverVehicleYear", "carYear"]);
  const schedule = getAdminRideScheduleInfo(ride);
  const isReturnOnlyPromotion = schedule.isReturnOnlyPromotion;
  const scheduleDisplayAt = schedule.displayScheduledAt ?? schedule.scheduledAt ?? schedule.returnScheduledAt;
  const airportWelcomeInfo = getAdminRideAirportWelcomeInfo(ride);
  const driverNotification = isReturnOnlyPromotion
    ? `Tenemos agendado el regreso de este pasajero. Recógelo en ${ride.originText} y llévalo a ${ride.destinationText}.`
    : `Tenemos agendado tu viaje. El admin lo asignó 30 minutos antes. Ve a buscar al usuario en ${ride.originText} y confirma esta reserva.${airportWelcomeInfo ? " Incluye collar de flores solicitado; admin gestiona el recibimiento en Mataveri." : ""}`;
  const passengerNotification = isReturnOnlyPromotion
    ? "Tu regreso quedó agendado. Estamos esperando que el conductor asignado confirme la vuelta."
    : `Tu reserva sigue agendada. El admin gestionará/asignará conductor ${SCHEDULE_ACTIVATION_MINUTES_ADMIN} minutos antes. Todas las reservas son con tarjeta; si cancelas dentro de los últimos ${SCHEDULED_CANCELLATION_CHARGE_MINUTES_ADMIN} minutos se cobra 30% con tope de $3.000 y el saldo restante se devuelve al medio de pago original; no se convierte en Beneficios.`;

  return {
    ...(ride as AdminRideData & Record<string, unknown>),
    status: "scheduled",
    acceptedAt: null,
    driverUserId: null,
    driverName: null,
    driverEmail: null,
    driverPhone: null,
    assignedDriverId: driver.id,
    assignedDriverUserId: driver.id,
    assignedDriverName: driver.name,
    assignedDriverEmail: driver.email,
    assignedDriverPhone: driverPhone,
    assignedDriverKeys: getDriverScheduledQueueKeys(driver),
    assignedDriverQueueKeys: getDriverScheduledQueueKeys(driver),
    driverReservationInboxOnly: true,
    reservationInboxOnly: true,
    visibleInDriverReservations: true,
    hiddenFromNormalRequests: true,
    driverVehicleBrand,
    driverVehicleModel,
    driverVehicleColor,
    driverVehiclePlate,
    driverVehicleYear,
    isScheduled: true,
    scheduledAt: scheduleDisplayAt,
    scheduledPickupAt: scheduleDisplayAt,
    pickupScheduledAt: scheduleDisplayAt,
    returnScheduledAt: schedule.returnScheduledAt,
    scheduledReturnAt: schedule.returnScheduledAt,
    scheduleActivationAt: schedule.activationAt,
    dispatchAt: schedule.activationAt,
    autoAssignAt: schedule.activationAt,
    roundTripReturnOnly: isReturnOnlyPromotion,
    isReturnOnlyPromotion,
    roundTripPromotionBooking: isReturnOnlyPromotion || getRideUnknownField(ride, "roundTripPromotionBooking") === true,
    bookingPurpose: isReturnOnlyPromotion ? "round_trip_return_only" : getRideUnknownField(ride, "bookingPurpose"),
    serviceType: isReturnOnlyPromotion ? "round_trip_return_only" : getRideUnknownField(ride, "serviceType"),
    scheduleStatus: isReturnOnlyPromotion ? "return_pending_driver_confirmation" : "pending_driver_confirmation",
    adminScheduleStatus: isReturnOnlyPromotion ? "return_pending_driver_confirmation" : "pending_driver_confirmation",
    reservationStatus: isReturnOnlyPromotion ? "round_trip_return_assigned_waiting_driver_acceptance" : "assigned_waiting_driver_acceptance",
    driverAssignmentStatus: "pending_driver_acceptance",
    returnDriverAssignmentStatus: isReturnOnlyPromotion ? "pending_driver_acceptance" : getRideUnknownField(ride, "returnDriverAssignmentStatus"),
    assignedByAdminAt: nowIso,
    availableForDrivers: false,
    visibleToDrivers: false,
    driverQueueBlocked: true,
    assignedOnlyToDriver: true,
    passengerNotification,
    driverNotification,
    localAdminOverride: true,
  } as AdminRideData;
}

function syncPassengerRideAssignment(ride: AdminRideData, assigned: AdminRideData): void {
  const passengerKey = getScheduledPassengerMirrorKey(ride as unknown as Record<string, unknown>);
  const assignedRecord = assigned as unknown as Record<string, unknown>;
  const nowIso = new Date().toISOString();
  const current = readLocalPassengerRidesForAdmin();
  const isReturnOnlyPromotion = isAdminReturnOnlyPromotionRide(assigned);
  const originalRideId = getAdminReturnOriginalRideId(assigned);

  const updated = current.map((item) => {
    const itemId = String(item.id ?? item.rideId ?? item.originalRideId ?? "").trim();
    const itemOriginalId = String(item.originalRideId ?? item.returnTripParentRideId ?? "").trim();

    if (isReturnOnlyPromotion) {
      const isSameReturnParent =
        Boolean(originalRideId && (itemId === originalRideId || itemOriginalId === originalRideId)) ||
        getScheduledPassengerMirrorKey(item) === passengerKey;

      if (!isSameReturnParent) return item;

      return {
        ...item,
        returnReservationStatus: "assigned_waiting_driver_acceptance",
        returnDriverAssignmentStatus: "pending_driver_acceptance",
        returnScheduledAt: assignedRecord.returnScheduledAt ?? assignedRecord.scheduledReturnAt ?? item.returnScheduledAt ?? null,
        scheduledReturnAt: assignedRecord.scheduledReturnAt ?? assignedRecord.returnScheduledAt ?? item.scheduledReturnAt ?? null,
        assignedReturnDriverId: assignedRecord.assignedDriverId ?? assignedRecord.driverUserId ?? null,
        assignedReturnDriverUserId: assignedRecord.assignedDriverUserId ?? assignedRecord.driverUserId ?? null,
        assignedReturnDriverName: assignedRecord.assignedDriverName ?? null,
        assignedReturnDriverEmail: assignedRecord.assignedDriverEmail ?? null,
        assignedReturnDriverPhone: assignedRecord.assignedDriverPhone ?? null,
        returnAssignedByAdminAt: nowIso,
        passengerNotification:
          assignedRecord.passengerNotification ??
          "Tu regreso quedó agendado. Estamos esperando confirmación del conductor asignado.",
      };
    }

    if (getScheduledPassengerMirrorKey(item) !== passengerKey && item.id !== ride.id) return item;
    return {
      ...item,
      status: "scheduled",
      acceptedAt: null,
      driverUserId: null,
      driverName: null,
      driverEmail: null,
      driverPhone: null,
      driverVehicleBrand: null,
      driverVehicleModel: null,
      driverVehicleColor: null,
      driverVehiclePlate: null,
      driverVehicleYear: null,
      assignedDriverId: assignedRecord.assignedDriverId ?? assignedRecord.driverUserId ?? null,
      assignedDriverUserId: assignedRecord.assignedDriverUserId ?? assignedRecord.driverUserId ?? null,
      assignedDriverName: assignedRecord.assignedDriverName ?? null,
      assignedDriverEmail: assignedRecord.assignedDriverEmail ?? null,
      assignedDriverPhone: assignedRecord.assignedDriverPhone ?? null,
      scheduleStatus: "pending_driver_confirmation",
      adminScheduleStatus: "pending_driver_confirmation",
      reservationStatus: "assigned_waiting_driver_acceptance",
      driverAssignmentStatus: "pending_driver_acceptance",
      assignedByAdminAt: nowIso,
      passengerNotification: assignedRecord.passengerNotification ?? "Tu reserva sigue agendada. Estamos esperando confirmación del conductor asignado.",
      reservationRequiresCard: true,
      paymentRequiredProvider: "mercadopago",
      cardCancellationCreditToWallet: false,
      cardCancellationCreditName: null,
      reservationCancellationWindowMinutes: 30,
      adminAssignmentWindowMinutes: 30,
    };
  });

  saveLocalPassengerRidesForAdmin(updated);
}


function getAdminRideRejectedDriverKeys(ride: AdminRideData | Record<string, unknown>): string[] {
  const record = ride as Record<string, unknown>;

  const direct = [
    record.rejectedByDriverId,
    record.rejectedByDriverUserId,
    record.rejectedByDriverEmail,
    record.rejectedByDriverName,
    record.lastRejectedByDriverId,
    record.lastRejectedByDriverEmail,
    record.lastRejectedByDriverName,
    record.cancelledByDriverEmail,
    record.cancelledByDriverName,
  ];

  const arrays = [
    record.skippedDriverKeys,
    record.rejectedByDriverKeys,
    record.rejectedDriverKeys,
    record.rejectedDriverIds,
    record.rejectedDriverEmails,
    record.driverRejectionKeys,
    record.driverRejectionEmails,
    record.ignoredDriverKeys,
    record.previousRejectedDriverKeys,
  ];

  return Array.from(
    new Set(
      [...direct, ...arrays.flatMap((value) =>
        Array.isArray(value) ? value : typeof value === "string" ? [value] : [],
      )]
        .map((value) => normalizeAdminDriverQueueKey(value) ?? String(value ?? "").trim())
        .filter(Boolean),
    ),
  );
}

function adminDriverMatchesRejectedRide(ride: AdminRideData, driver: ActiveDriverData): boolean {
  const rejected = new Set(getAdminRideRejectedDriverKeys(ride));
  if (rejected.size === 0) return false;

  return getDriverScheduledQueueKeys(driver)
    .map((key) => normalizeAdminDriverQueueKey(key) ?? key)
    .some((key) => rejected.has(key));
}

function adminRideNeedsNextAvailableDriver(ride: AdminRideData): boolean {
  const record = ride as AdminRideData & Record<string, unknown>;
  const status = String(record.status ?? "").toLowerCase();

  if (["completed", "cancelled", "canceled", "in_progress", "driver_arrived", "driver_en_route"].includes(status)) {
    return false;
  }

  const assignmentStatus = String(
    record.adminScheduleStatus ??
      record.scheduleStatus ??
      record.reservationStatus ??
      record.driverAssignmentStatus ??
      "",
  ).toLowerCase();

  return (
    getAdminRideScheduleInfo(ride).isScheduled &&
    (
      record.reassignmentNeeded === true ||
      record.needsNextAvailableDriver === true ||
      assignmentStatus.includes("pending_next_driver") ||
      assignmentStatus.includes("pending_driver")
    )
  );
}

function findNextAvailableAdminDriverForRide(
  ride: AdminRideData,
  drivers: ActiveDriverData[],
): ActiveDriverData | null {
  return (
    drivers.find((driver) => {
      if (getNormalizedDriverAvailability(driver) !== "available") return false;
      if (adminDriverMatchesRejectedRide(ride, driver)) return false;

      const driverKeys = getDriverScheduledQueueKeys(driver)
        .map((key) => normalizeAdminDriverQueueKey(key) ?? key)
        .filter(Boolean);

      const assignedKeys = [
        (ride as unknown as Record<string, unknown>).assignedDriverId,
        (ride as unknown as Record<string, unknown>).assignedDriverUserId,
        (ride as unknown as Record<string, unknown>).assignedDriverEmail,
        (ride as unknown as Record<string, unknown>).assignedDriverName,
      ]
        .map((key) => normalizeAdminDriverQueueKey(key) ?? String(key ?? "").trim())
        .filter(Boolean);

      if (assignedKeys.length > 0 && driverKeys.some((key) => assignedKeys.includes(key))) return false;
      return true;
    }) ?? null
  );
}

function readAdminReservationAutoAssignLog(): AdminReservationAutoAssignLog[] {
  try {
    const raw = localStorage.getItem(RAPAGO_ADMIN_RESERVATION_AUTO_ASSIGN_LOG_KEY);
    const parsed = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item, index): AdminReservationAutoAssignLog => ({
        id: String(item.id ?? `reservation-auto-assign-${index}`),
        rideId: String(item.rideId ?? ""),
        rideKey: String(item.rideKey ?? item.rideId ?? ""),
        status: String(item.status ?? "skipped") as AdminReservationAutoAssignLogStatus,
        driverId: typeof item.driverId === "string" ? item.driverId : null,
        driverName: typeof item.driverName === "string" ? item.driverName : null,
        driverEmail: typeof item.driverEmail === "string" ? item.driverEmail : null,
        message: String(item.message ?? ""),
        createdAt: String(item.createdAt ?? new Date().toISOString()),
        updatedAt: String(item.updatedAt ?? item.createdAt ?? new Date().toISOString()),
      }))
      .filter((item) => Boolean(item.rideKey || item.rideId));
  } catch {
    return [];
  }
}

function writeAdminReservationAutoAssignLog(logs: AdminReservationAutoAssignLog[]): void {
  try {
    localStorage.setItem(RAPAGO_ADMIN_RESERVATION_AUTO_ASSIGN_LOG_KEY, JSON.stringify(logs.slice(0, 250)));
    window.dispatchEvent(new CustomEvent(ADMIN_RESERVATION_AUTO_ASSIGN_EVENT, { detail: { logs } }));
  } catch {
    // No bloquea el panel admin.
  }
}

function upsertAdminReservationAutoAssignLog(input: Omit<AdminReservationAutoAssignLog, "id" | "createdAt" | "updatedAt">): void {
  const now = new Date().toISOString();
  const id = `reservation-auto-assign-${input.rideKey || input.rideId}`;
  const current = readAdminReservationAutoAssignLog();
  const previous = current.find((item) => item.id === id);
  const nextLog: AdminReservationAutoAssignLog = {
    id,
    ...input,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  };

  writeAdminReservationAutoAssignLog([
    nextLog,
    ...current.filter((item) => item.id !== id),
  ]);
}

function adminRideCanBeAutoAssignedFromReservation(ride: AdminRideData): boolean {
  const schedule = getAdminRideScheduleInfo(ride);
  if (!schedule.isScheduled) return false;

  // La asignación automática se ejecuta únicamente al entrar en la ventana
  // operativa de 30 minutos. El administrador conserva la asignación manual.
  if (!schedule.isActiveWindow) return false;
  if (hasAdminAssignedDriver(ride)) return false;

  const effectiveStatus = getEffectiveAdminRideStatus(ride);
  if (["completed", "cancelled", "no_show", "accepted", "driver_en_route", "driver_arrived", "in_progress"].includes(effectiveStatus)) {
    return false;
  }

  const record = ride as AdminRideData & Record<string, unknown>;
  const rawStatus = String(
    record.adminScheduleStatus ??
      record.scheduleStatus ??
      record.reservationStatus ??
      record.driverAssignmentStatus ??
      "",
  ).toLowerCase();

  if (
    rawStatus.includes("cancel") ||
    rawStatus.includes("accepted") ||
    rawStatus.includes("completed") ||
    rawStatus.includes("in_progress")
  ) {
    return false;
  }

  return true;
}

function autoAssignReservationToAvailableDriverFromAdmin(
  ride: AdminRideData,
  drivers: ActiveDriverData[],
): AdminRideData | null {
  if (!adminRideCanBeAutoAssignedFromReservation(ride)) return null;

  const rideKey = getAdminRideMergeKey(ride);
  const nextDriver = findNextAvailableAdminDriverForRide(ride, drivers);

  if (!nextDriver) {
    upsertAdminReservationAutoAssignLog({
      rideId: ride.id,
      rideKey,
      status: "waiting_driver",
      driverId: null,
      driverName: null,
      driverEmail: null,
      message: "Reserva recibida. El sistema sigue buscando un conductor disponible automáticamente.",
    });
    return null;
  }

  const now = new Date().toISOString();
  const preparedRide = {
    ...(ride as AdminRideData & Record<string, unknown>),
    status: "scheduled",
    adminScheduleStatus: "pending_driver_confirmation",
    scheduleStatus: "pending_driver_confirmation",
    reservationStatus: "assigned_waiting_driver_acceptance",
    driverAssignmentStatus: "pending_driver_acceptance",
    availableForDrivers: false,
    reassignmentNeeded: false,
    needsNextAvailableDriver: false,
    autoAssignedBy: "admin_auto",
    autoAssignedAt: now,
    adminAutoAssignStatus: "assigned",
    adminAutoAssignedDriverId: nextDriver.id,
    adminAutoAssignedDriverName: nextDriver.name,
    adminAutoAssignedDriverEmail: nextDriver.email,
    adminAutoAssignMessage: `Sistema asignó automáticamente esta reserva a ${nextDriver.name}. Esperando confirmación del conductor.`,
    passengerNotification: "Tu reserva fue asignada a un conductor. Estamos esperando su confirmación.",
    driverNotification: "Te llegó una reserva agendada de RAPA GO. Confirma si puedes realizarla.",
  } as AdminRideData;

  const assigned = assignScheduledRideToDriverLocally(preparedRide, nextDriver);

  upsertAdminReservationAutoAssignLog({
    rideId: assigned.id,
    rideKey,
    status: "assigned",
    driverId: nextDriver.id,
    driverName: nextDriver.name,
    driverEmail: nextDriver.email,
    message: `Reserva asignada automáticamente a ${nextDriver.name}.`,
  });

  window.dispatchEvent(
    new CustomEvent(ADMIN_RESERVATION_AUTO_ASSIGN_EVENT, {
      detail: { ride: assigned, driverId: nextDriver.id, driverName: nextDriver.name },
    }),
  );

  return assigned;
}

function autoAssignReservationToNextAvailableDriverFromAdmin(
  ride: AdminRideData,
  drivers: ActiveDriverData[],
): AdminRideData | null {
  if (!adminRideNeedsNextAvailableDriver(ride)) return null;

  const nextDriver = findNextAvailableAdminDriverForRide(ride, drivers);
  if (!nextDriver) return null;

  const reassigned = assignScheduledRideToDriverLocally(
    {
      ...(ride as AdminRideData & Record<string, unknown>),
      status: "scheduled",
      adminScheduleStatus: "pending_driver_confirmation",
      scheduleStatus: "pending_driver_confirmation",
      reservationStatus: "assigned_waiting_driver_acceptance",
      driverAssignmentStatus: "pending_driver_acceptance",
      availableForDrivers: false,
      reassignmentNeeded: false,
      needsNextAvailableDriver: false,
      autoReassignedAt: new Date().toISOString(),
      autoReassignedBy: "admin_auto",
      passengerNotification:
        "El conductor anterior no pudo tomar tu reserva. La enviamos al siguiente conductor disponible.",
      driverNotification:
        "Te reasignamos esta reserva porque otro conductor no pudo tomarla. Confirma si puedes realizarla.",
    } as AdminRideData,
    nextDriver,
  );

  window.dispatchEvent(
    new CustomEvent(ADMIN_RESERVATION_AUTO_REASSIGN_EVENT, {
      detail: { ride: reassigned, nextDriverId: nextDriver.id, nextDriverEmail: nextDriver.email },
    }),
  );

  return reassigned;
}

function assignScheduledRideToDriverLocally(ride: AdminRideData, driver: ActiveDriverData): AdminRideData {
  const assigned = buildAssignedScheduledRide(ride, driver);
  const originalMergeKey = getAdminRideMergeKey(ride);
  const assignedMergeKey = getAdminRideMergeKey(assigned);

  const localAdminRides = readLocalAdminScheduledRides();
  const localAdminWithoutCurrent = localAdminRides.filter((item) => {
    const itemKey = getAdminRideMergeKey(item);
    return itemKey !== originalMergeKey && itemKey !== assignedMergeKey && item.id !== ride.id;
  });

  saveLocalAdminScheduledRidesForAdmin([assigned, ...localAdminWithoutCurrent]);
  syncPassengerRideAssignment(ride, assigned);
  upsertDriverScheduledRideForNotification(assigned, driver);
  clearPendingAdminDriverAssignmentRide();

  return assigned;
}

const RAPAGO_PASSENGER_NOTE_MAX_LENGTH_ADMIN = 180;

function sanitizeAdminPassengerNote(value: unknown): string {
  return String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/[<>`{}$\\]/g, "")
    .replace(/RAPAGO_PASSENGER_NOTE_(?:START|END)/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, RAPAGO_PASSENGER_NOTE_MAX_LENGTH_ADMIN);
}

function extractAdminPassengerNoteFromNotes(notes: string | null | undefined): string | null {
  if (!notes) return null;

  const marked = notes.match(
    /RAPAGO_PASSENGER_NOTE_START\s+([\s\S]*?)\s+RAPAGO_PASSENGER_NOTE_END\.?/i,
  );
  if (marked?.[1]) return sanitizeAdminPassengerNote(marked[1]) || null;

  const labelled = notes.match(
    /(?:Nota del pasajero|Nota pasajero):\s*([\s\S]*?)(?=\s+(?:RAPAGO_[A-Z_]+:|Forma de pago seleccionada:|Categor[ií]a de veh[ií]culo seleccionada:|Tipo de viaje seleccionado:|Direcci[oó]n origen confirmada:|Coordenadas recogida accesible:|Tarifa RAPA GO calculada:|$))/i,
  );
  if (labelled?.[1]) return sanitizeAdminPassengerNote(labelled[1]) || null;

  const legacy = notes.match(
    /Coordenadas destino accesible:\s*-?\d+(?:[.,]\d+)?,\s*-?\d+(?:[.,]\d+)?\.\s*([\s\S]*?)(?=\s+(?:Tarifa RAPA GO calculada:|Tarifa estimada pasajero:|Distancia estimada:|Duraci[oó]n estimada:|Tipo de viaje tarifario:|Ganancia estimada conductor:|$))/i,
  );
  if (legacy?.[1]) return sanitizeAdminPassengerNote(legacy[1]) || null;

  const looksTechnical = /(?:RAPAGO_[A-Z_]+:|Forma de pago seleccionada:|Coordenadas recogida accesible:|Tarifa RAPA GO calculada:|Categor[ií]a de veh[ií]culo seleccionada:)/i.test(notes);
  return looksTechnical ? null : sanitizeAdminPassengerNote(notes) || null;
}

function getAdminPassengerNote(ride: AdminRideData): string | null {
  const record = ride as unknown as Record<string, unknown>;
  const direct = sanitizeAdminPassengerNote(
    record.passengerNote ??
      record.passenger_note ??
      record.passengerInstructions ??
      record.passengerComment,
  );
  if (direct) return direct;

  return extractAdminPassengerNoteFromNotes(ride.notes);
}

const RIDE_STATUS_LABEL_ADMIN: Record<string, string> = {
  scheduled: "Agendado",
  requested: "Solicitado",
  accepted: "Conductor asignado",
  driver_en_route: "Conductor en camino",
  driver_arrived: "Conductor llegó",
  in_progress: "En curso",
  completed: "Completado",
  cancelled: "Cancelado",
  no_show: "No Show",
};

const RIDE_STATUS_COLOR_ADMIN: Record<string, string> = {
  scheduled: "warning",
  requested: "warning",
  accepted: "primary",
  driver_en_route: "tertiary",
  driver_arrived: "secondary",
  in_progress: "success",
  completed: "medium",
  cancelled: "danger",
  no_show: "warning",
};

const CANCELABLE_STATUSES = new Set([
  "scheduled",
  "requested",
  "accepted",
  "driver_en_route",
  "driver_arrived",
]);

function isAdminCancelledRideConflictMessage(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const lower = message.toLowerCase();

  return (
    lower.includes("409") ||
    lower.includes("conflict") ||
    lower.includes("current status is 'cancelled'") ||
    lower.includes('current status is "cancelled"') ||
    lower.includes("status is cancelled") ||
    lower.includes("ride cannot be cancelled") ||
    lower.includes("estado actual es cancel") ||
    lower.includes("estado cancelado")
  );
}

function buildAdminCancelledRide(ride: AdminRideData, reason: string): AdminRideData {
  return {
    ...(ride as AdminRideData & Record<string, unknown>),
    status: "cancelled",
    cancelledAt: ride.cancelledAt ?? new Date().toISOString(),
    cancelledByRole: "admin",
    cancelledBy: "admin",
    cancellationReason: reason.trim() || ride.cancellationReason || "Cancelado por administrador.",
    adminScheduleStatus: "cancelled",
    reservationStatus: "cancelled",
    scheduleStatus: "cancelled",
    localAdminOverride: true,
  } as AdminRideData;
}

function upsertAdminRideArrayStorage(key: string, ride: AdminRideData): void {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as AdminRideData[]) : [];
    const current = Array.isArray(parsed) ? parsed : [];
    const rideKey = getAdminRideMergeKey(ride);

    localStorage.setItem(
      key,
      JSON.stringify([
        ride,
        ...current.filter((item) => getAdminRideMergeKey(item) !== rideKey && item.id !== ride.id),
      ].slice(0, 200)),
    );
  } catch {
    // No bloquea el panel si localStorage no está disponible.
  }
}

function removeAdminRideFromArrayStorage(key: string, ride: AdminRideData): void {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as AdminRideData[]) : [];
    if (!Array.isArray(parsed)) return;

    const rideKey = getAdminRideMergeKey(ride);
    localStorage.setItem(
      key,
      JSON.stringify(parsed.filter((item) => getAdminRideMergeKey(item) !== rideKey && item.id !== ride.id)),
    );
  } catch {
    // No bloquea el panel si localStorage no está disponible.
  }
}

function syncAdminCancelledRideLocally(original: AdminRideData, cancelled: AdminRideData): void {
  const originalKey = getAdminRideMergeKey(original);
  const cancelledKey = getAdminRideMergeKey(cancelled);

  const localAdminRides = readLocalAdminScheduledRides();
  const localWithoutCurrent = localAdminRides.filter((item) => {
    const itemKey = getAdminRideMergeKey(item);
    return itemKey !== originalKey && itemKey !== cancelledKey && item.id !== original.id;
  });

  saveLocalAdminScheduledRidesForAdmin([cancelled, ...localWithoutCurrent].slice(0, 120));

  const passengerKey = getScheduledPassengerMirrorKey(original as unknown as Record<string, unknown>);
  const passengerRides = readLocalPassengerRidesForAdmin();
  const nextPassengerRides = passengerRides.map((item) => {
    const itemKey = getScheduledPassengerMirrorKey(item);
    const sameRide = item.id === original.id || itemKey === passengerKey;
    if (!sameRide) return item;

    return {
      ...item,
      status: "cancelled",
      cancelledAt: cancelled.cancelledAt ?? new Date().toISOString(),
      cancelledByRole: "admin",
      cancelledBy: "admin",
      cancellationReason: cancelled.cancellationReason ?? "Cancelado por administrador.",
      adminScheduleStatus: "cancelled",
      reservationStatus: "cancelled",
      scheduleStatus: "cancelled",
      passengerNotification: "Tu reserva fue cancelada por administración.",
    };
  });

  saveLocalPassengerRidesForAdmin(nextPassengerRides);

  upsertAdminRideArrayStorage(LOCAL_DRIVER_ASSIGNED_RIDES_KEY, cancelled);
  removeAdminRideFromArrayStorage(LOCAL_DRIVER_SCHEDULED_QUEUE_KEY, original);

  window.dispatchEvent(new CustomEvent("rapago:passenger-rides-updated"));
  window.dispatchEvent(new CustomEvent("rapago:admin-scheduled-rides-updated"));
  window.dispatchEvent(new CustomEvent(DRIVER_ASSIGNED_RIDE_EVENT, { detail: { rideId: cancelled.id, cancelled: true } }));
}

function getAdminRideTimeValue(ride: AdminRideData): number {
  const candidates = [
    ride.createdAt,
    ride.requestedAt,
    ride.acceptedAt,
    ride.startedAt,
    ride.completedAt,
    ride.cancelledAt,
  ].filter(Boolean) as string[];

  const value = candidates
    .map((date) => new Date(date).getTime())
    .filter((time) => Number.isFinite(time))
    .sort((a, b) => b - a)[0];

  return value ?? 0;
}

function getAdminRidePriority(status: string): number {
  if (status === "scheduled") return 0;
  if (status === "requested") return 1;
  if (status === "accepted") return 2;
  if (status === "driver_en_route") return 3;
  if (status === "driver_arrived") return 4;
  if (status === "in_progress") return 5;
  if (status === "completed") return 6;
  if (status === "no_show") return 7;
  if (status === "cancelled") return 8;
  return 9;
}

function sortAdminRidesForOperations(rides: AdminRideData[]): AdminRideData[] {
  return [...rides].sort((a, b) => {
    const priorityDiff =
      getAdminRidePriority(getEffectiveAdminRideStatus(a)) -
      getAdminRidePriority(getEffectiveAdminRideStatus(b));
    if (priorityDiff !== 0) return priorityDiff;
    return getAdminRideTimeValue(b) - getAdminRideTimeValue(a);
  });
}


type AdminTripMapPoint = { lat: number; lng: number };

type AdminTripMapResolvedPoints = {
  pickup: AdminTripMapPoint | null;
  destination: AdminTripMapPoint | null;
};

const ADMIN_RAPA_NUI_CENTER: AdminTripMapPoint = { lat: -27.1505, lng: -109.4325 };

const ADMIN_RAPA_NUI_ZONE_POINTS: Array<{ label: string; aliases: string[]; point: AdminTripMapPoint }> = [
  { label: "Hotel Taha Tai", aliases: ["hotel taha tai", "taha tai", "taha-tai"], point: { lat: -27.1469, lng: -109.4325 } },
  { label: "Caleta Hanga Roa", aliases: ["caleta hanga roa", "caleta", "hanga roa"], point: { lat: -27.1488, lng: -109.4336 } },
  { label: "Aeropuerto Mataveri", aliases: ["aeropuerto", "mataveri", "airport"], point: { lat: -27.1648, lng: -109.4210 } },
  { label: "Hospital Hanga Roa", aliases: ["hospital", "hospital de hanga roa"], point: { lat: -27.1502, lng: -109.4216 } },
  { label: "Centro de Hanga Roa", aliases: ["centro", "hanga roa centro", "iglesia", "comisaria", "comisaría", "mercado artesanal", "feria artesanal"], point: { lat: -27.1505, lng: -109.4325 } },
  { label: "Tahai", aliases: ["tahai", "ahu tahai"], point: { lat: -27.1398, lng: -109.4298 } },
  { label: "Hanga Piko", aliases: ["hanga piko", "puerto hanga piko"], point: { lat: -27.1561, lng: -109.4440 } },
  { label: "Puna Pau", aliases: ["puna pau"], point: { lat: -27.1385, lng: -109.3959 } },
  { label: "Ahu Akivi", aliases: ["ahu akivi", "akivi"], point: { lat: -27.1150, lng: -109.3950 } },
  { label: "Anakena", aliases: ["anakena"], point: { lat: -27.0732, lng: -109.3233 } },
  { label: "Terevaka", aliases: ["terevaka", "tere vaka"], point: { lat: -27.0917, lng: -109.3820 } },
  { label: "Orongo / Rano Kau", aliases: ["orongo", "rano kau", "rano kao"], point: { lat: -27.1860, lng: -109.4355 } },
  { label: "Rano Raraku", aliases: ["rano raraku"], point: { lat: -27.1210, lng: -109.2880 } },
  { label: "Tongariki", aliases: ["tongariki", "ahu tongariki"], point: { lat: -27.1251, lng: -109.2761 } },
  { label: "Vaitea", aliases: ["vaitea"], point: { lat: -27.1015, lng: -109.3505 } },
  { label: "Apina", aliases: ["apina", "apiña"], point: { lat: -27.1477, lng: -109.4319 } },
];

function adminTripMapNormalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function adminTripMapString(value: unknown): string {
  return String(value ?? "").trim();
}

function adminTripMapNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function adminTripMapPointFromValues(latValue: unknown, lngValue: unknown): AdminTripMapPoint | null {
  const lat = adminTripMapNumber(latValue);
  const lng = adminTripMapNumber(lngValue);
  if (lat == null || lng == null) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

function adminTripMapPointFromRecord(record: Record<string, unknown>, pairs: Array<[string, string]>): AdminTripMapPoint | null {
  for (const [latKey, lngKey] of pairs) {
    const point = adminTripMapPointFromValues(record[latKey], record[lngKey]);
    if (point) return point;
  }
  return null;
}

function adminTripMapPointFromNotes(notes: unknown, labels: string[]): AdminTripMapPoint | null {
  const text = String(notes ?? "");
  if (!text.trim()) return null;

  for (const label of labels) {
    const pattern = new RegExp(`${label}\\s*:\\s*(-?\\d+(?:[.,]\\d+)?)\\s*,\\s*(-?\\d+(?:[.,]\\d+)?)`, "i");
    const match = text.match(pattern);
    if (!match) continue;

    const point = adminTripMapPointFromValues(match[1], match[2]);
    if (point) return point;
  }

  return null;
}

function adminTripMapResolvePointFromZoneText(...values: unknown[]): AdminTripMapPoint | null {
  const combined = adminTripMapNormalizeText(values.filter(Boolean).join(" "));
  if (!combined) return null;

  const match = ADMIN_RAPA_NUI_ZONE_POINTS.find((zone) =>
    zone.aliases.some((alias) => {
      const cleanAlias = adminTripMapNormalizeText(alias);
      return combined.includes(cleanAlias) || cleanAlias.includes(combined);
    }),
  );

  return match?.point ?? null;
}

async function adminTripMapGeocodeRapaNuiPoint(value: unknown): Promise<AdminTripMapPoint | null> {
  const raw = adminTripMapString(value);
  if (!raw) return null;

  const byZone = adminTripMapResolvePointFromZoneText(raw);
  if (byZone) return byZone;

  try {
    await loadRapaGoGoogleMaps();
    if (!window.google?.maps?.Geocoder) return null;

    const geocoder = new google.maps.Geocoder();
    const normalized = adminTripMapNormalizeText(raw);
    const query = normalized.includes("rapa nui") || normalized.includes("hanga roa") || normalized.includes("isla de pascua")
      ? `${raw}, Chile`
      : `${raw}, Hanga Roa, Rapa Nui, Valparaíso, Chile`;

    return await new Promise<AdminTripMapPoint | null>((resolve) => {
      geocoder.geocode(
        {
          address: query,
          region: "CL",
          componentRestrictions: { country: "CL" },
        },
        (results, status) => {
          if (status !== google.maps.GeocoderStatus.OK || !results?.[0]) {
            resolve(null);
            return;
          }

          const location = results[0].geometry.location;
          resolve({ lat: location.lat(), lng: location.lng() });
        },
      );
    });
  } catch {
    return null;
  }
}

function adminTripMapRideIdentityMatches(ride: AdminRideData, candidate: Record<string, unknown>): boolean {
  const rideRecord = ride as AdminRideData & Record<string, unknown>;
  const rideIds = new Set(
    [ride.id, rideRecord.rideId, rideRecord.originalRideId, rideRecord.serverRideId]
      .map((value) => adminTripMapString(value))
      .filter(Boolean),
  );
  const candidateRideId = adminTripMapString(candidate.rideId ?? candidate.id ?? candidate.originalRideId ?? candidate.serverRideId);
  if (candidateRideId && rideIds.has(candidateRideId)) return true;

  const driverEmail = adminTripMapNormalizeText(getRideUnknownField(ride, "driverEmail") ?? getRideUnknownField(ride, "assignedDriverEmail"));
  const candidateEmail = adminTripMapNormalizeText(candidate.driverEmail ?? candidate.email ?? candidate.assignedDriverEmail);
  if (driverEmail && candidateEmail && driverEmail === candidateEmail) return true;

  const driverName = adminTripMapNormalizeText(ride.driverName ?? getRideUnknownField(ride, "assignedDriverName"));
  const candidateName = adminTripMapNormalizeText(candidate.driverName ?? candidate.name ?? candidate.assignedDriverName);
  if (driverName && candidateName && driverName === candidateName) return true;

  return false;
}

function adminTripMapExtractCandidatePoint(candidate: Record<string, unknown>): AdminTripMapPoint | null {
  return adminTripMapPointFromRecord(candidate, [
    ["lat", "lng"],
    ["latitude", "longitude"],
    ["driverLat", "driverLng"],
    ["currentDriverLat", "currentDriverLng"],
    ["driverLocationLat", "driverLocationLng"],
  ]);
}

function readAdminTripLiveDriverPoint(ride: AdminRideData): AdminTripMapPoint | null {
  const rideRecord = ride as AdminRideData & Record<string, unknown>;

  const direct = adminTripMapPointFromRecord(rideRecord, [
    ["driverLat", "driverLng"],
    ["currentDriverLat", "currentDriverLng"],
    ["driverLocationLat", "driverLocationLng"],
    ["lastDriverLat", "lastDriverLng"],
  ]);
  if (direct) return direct;

  const storageKeys = [
    "rapago_current_driver_location",
    "rapago_driver_current_location",
    "rapago_driver_live_location_v1",
    "rapago_driver_live_locations_v1",
    "rapago_driver_locations_v1",
    "rapago_driver_navigation_location_v1",
  ];

  for (const key of storageKeys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw) as unknown;
      const candidates: Record<string, unknown>[] = [];

      if (Array.isArray(parsed)) {
        candidates.push(...parsed.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")));
      } else if (parsed && typeof parsed === "object") {
        const record = parsed as Record<string, unknown>;
        candidates.push(record);
        candidates.push(...Object.values(record).filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")));
      }

      const matched = candidates.find((candidate) => adminTripMapRideIdentityMatches(ride, candidate));
      const point = matched ? adminTripMapExtractCandidatePoint(matched) : null;
      if (point) return point;

      if (candidates.length === 1) {
        const onlyPoint = adminTripMapExtractCandidatePoint(candidates[0]);
        if (onlyPoint) return onlyPoint;
      }
    } catch {
      // Storage antiguo o corrupto: se ignora.
    }
  }

  return null;
}

async function resolveAdminTripMapPoints(ride: AdminRideData): Promise<AdminTripMapResolvedPoints> {
  const record = ride as AdminRideData & Record<string, unknown>;

  const pickupFromFields = adminTripMapPointFromRecord(record, [
    ["pickupLat", "pickupLng"],
    ["originLat", "originLng"],
    ["startLat", "startLng"],
    ["passengerOriginalLat", "passengerOriginalLng"],
  ]);

  const destinationFromFields = adminTripMapPointFromRecord(record, [
    ["destinationLat", "destinationLng"],
    ["destLat", "destLng"],
    ["endLat", "endLng"],
  ]);

  const pickupFromNotes = adminTripMapPointFromNotes(ride.notes, [
    "Coordenadas recogida accesible",
    "Coordenadas origen accesible",
    "Coordenadas origen",
    "Ubicación real del pasajero",
    "Ubicacion real del pasajero",
  ]);

  const destinationFromNotes = adminTripMapPointFromNotes(ride.notes, [
    "Coordenadas destino accesible",
    "Coordenadas destino",
  ]);

  const pickupText = adminTripMapString(getRideUnknownField(ride, "originAddress") ?? getRideUnknownField(ride, "pickupAddress") ?? ride.originText);
  const destinationText = adminTripMapString(getRideUnknownField(ride, "destinationAddress") ?? ride.destinationText);

  const pickup =
    pickupFromFields ??
    pickupFromNotes ??
    adminTripMapResolvePointFromZoneText(pickupText, ride.notes) ??
    await adminTripMapGeocodeRapaNuiPoint(pickupText);

  const destination =
    destinationFromFields ??
    destinationFromNotes ??
    adminTripMapResolvePointFromZoneText(destinationText, ride.notes) ??
    await adminTripMapGeocodeRapaNuiPoint(destinationText);

  return { pickup, destination };
}

function adminTripMapDistanceMeters(a: AdminTripMapPoint, b: AdminTripMapPoint): number {
  const r = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

function formatAdminTripMapDistance(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "";
  if (value < 1000) return `${Math.max(10, Math.round(value / 10) * 10)} m`;
  return `${(value / 1000).toLocaleString("es-CL", { maximumFractionDigits: 1 })} km`;
}

function adminTripMarkerIcon(color: string, scale = 11): google.maps.Symbol {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: 3,
    scale,
  };
}

function adminTripDriverIcon(): google.maps.Symbol {
  return {
    path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
    fillColor: "#2563eb",
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: 3,
    scale: 6,
    rotation: 0,
  };
}


function adminTripMapTracePointFromUnknown(value: unknown): AdminTripMapPoint | null {
  if (!value) return null;

  if (Array.isArray(value) && value.length >= 2) {
    return adminTripMapPointFromValues(value[0], value[1]);
  }

  if (typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  return adminTripMapPointFromRecord(record, [
    ["lat", "lng"],
    ["latitude", "longitude"],
    ["driverLat", "driverLng"],
    ["currentDriverLat", "currentDriverLng"],
    ["driverLocationLat", "driverLocationLng"],
    ["routeLat", "routeLng"],
  ]);
}

function adminTripMapTraceFromUnknown(value: unknown): AdminTripMapPoint[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map(adminTripMapTracePointFromUnknown)
      .filter((point): point is AdminTripMapPoint => Boolean(point));
  }

  if (typeof value !== "object") return [];

  const record = value as Record<string, unknown>;
  const directPoint = adminTripMapTracePointFromUnknown(record);
  const nestedKeys = [
    "points",
    "path",
    "trace",
    "route",
    "driverPath",
    "driverRoute",
    "driverRoutePath",
    "driverRouteTrace",
    "routeTrace",
    "routeHistory",
    "locationHistory",
    "locations",
    "completedRoutePath",
    "completedDriverPath",
  ];

  for (const key of nestedKeys) {
    const nested = adminTripMapTraceFromUnknown(record[key]);
    if (nested.length >= 2) return nested;
  }

  return directPoint ? [directPoint] : [];
}

function adminTripMapDedupeTrace(points: AdminTripMapPoint[]): AdminTripMapPoint[] {
  const next: AdminTripMapPoint[] = [];

  for (const point of points) {
    const last = next[next.length - 1];
    if (!last || adminTripMapDistanceMeters(last, point) >= 3) {
      next.push(point);
    }
  }

  return next;
}

function readAdminTripCompletedDriverTrace(ride: AdminRideData): AdminTripMapPoint[] {
  const rideRecord = ride as AdminRideData & Record<string, unknown>;
  const direct = adminTripMapTraceFromUnknown(rideRecord);
  if (direct.length >= 2) return adminTripMapDedupeTrace(direct);

  const storageKeys = [
    "rapago_driver_completed_route_traces_v1",
    "rapago_driver_route_traces_v1",
    "rapago_driver_route_history_v1",
    "rapago_driver_location_history_v1",
    "rapago_driver_completed_routes_v1",
  ];

  for (const key of storageKeys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw) as unknown;
      const candidates: unknown[] = [];

      if (Array.isArray(parsed)) {
        candidates.push(parsed, ...parsed);
      } else if (parsed && typeof parsed === "object") {
        const record = parsed as Record<string, unknown>;
        candidates.push(record);

        const rideIds = [ride.id, rideRecord.rideId, rideRecord.originalRideId, rideRecord.serverRideId]
          .map((value) => adminTripMapString(value))
          .filter(Boolean);

        for (const rideId of rideIds) {
          if (record[rideId]) candidates.push(record[rideId]);
          if (record[`ride:${rideId}`]) candidates.push(record[`ride:${rideId}`]);
        }

        candidates.push(...Object.values(record));
      }

      for (const candidate of candidates) {
        const candidateRecord = candidate && typeof candidate === "object" ? candidate as Record<string, unknown> : null;
        const matchesRide = candidateRecord ? adminTripMapRideIdentityMatches(ride, candidateRecord) : false;
        const trace = adminTripMapTraceFromUnknown(candidate);

        if ((matchesRide || candidates.length <= 2) && trace.length >= 2) {
          return adminTripMapDedupeTrace(trace);
        }
      }
    } catch {
      // Storage local antiguo o corrupto: se ignora.
    }
  }

  return [];
}

function AdminTripLiveRouteMap({
  ride,
  height = 190,
}: {
  ride: AdminRideData;
  height?: number;
}): JSX.Element {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const rendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null);
  const driverMarkerRef = useRef<google.maps.Marker | null>(null);
  const pickupMarkerRef = useRef<google.maps.Marker | null>(null);
  const destinationMarkerRef = useRef<google.maps.Marker | null>(null);
  const fallbackLineRef = useRef<google.maps.Polyline | null>(null);
  const completedTraceLineRef = useRef<google.maps.Polyline | null>(null);
  const pointsRef = useRef<AdminTripMapResolvedPoints | null>(null);
  const routeKeyRef = useRef("");

  const [mapMessage, setMapMessage] = useState("Cargando mapa del viaje...");
  const [routeMessage, setRouteMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    pointsRef.current = null;
    routeKeyRef.current = "";

    function setMarker(
      markerRef: { current: google.maps.Marker | null },
      point: AdminTripMapPoint | null,
      options: google.maps.MarkerOptions,
    ): void {
      const map = mapRef.current;
      if (!map || !window.google?.maps || !point) {
        markerRef.current?.setMap(null);
        markerRef.current = null;
        return;
      }

      if (!markerRef.current) {
        markerRef.current = new google.maps.Marker({ ...options, map, position: point });
        return;
      }

      markerRef.current.setMap(map);
      markerRef.current.setPosition(point);
      markerRef.current.setOptions(options);
    }

    async function ensureMap(): Promise<void> {
      await loadRapaGoGoogleMaps();
      if (!mapElementRef.current || mapRef.current || !window.google?.maps) return;

      mapRef.current = new google.maps.Map(mapElementRef.current, {
        center: ADMIN_RAPA_NUI_CENTER,
        zoom: 14,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        clickableIcons: false,
        gestureHandling: "greedy",
      });

      rendererRef.current = new google.maps.DirectionsRenderer({
        map: mapRef.current,
        suppressMarkers: true,
        preserveViewport: true,
        polylineOptions: {
          strokeColor: "#2563eb",
          strokeOpacity: 0.95,
          strokeWeight: 7,
        },
      });
      directionsServiceRef.current = new google.maps.DirectionsService();
    }

    async function ensurePoints(): Promise<AdminTripMapResolvedPoints> {
      if (pointsRef.current) return pointsRef.current;
      const points = await resolveAdminTripMapPoints(ride);
      pointsRef.current = points;
      return points;
    }

    function drawFallbackLine(start: AdminTripMapPoint | null, end: AdminTripMapPoint | null): void {
      const map = mapRef.current;
      if (!map || !window.google?.maps || !start || !end) {
        fallbackLineRef.current?.setMap(null);
        fallbackLineRef.current = null;
        return;
      }

      const path = [start, end];
      if (!fallbackLineRef.current) {
        fallbackLineRef.current = new google.maps.Polyline({
          map,
          path,
          strokeColor: "#0f172a",
          strokeOpacity: 0.55,
          strokeWeight: 5,
          icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 4 }, offset: "0", repeat: "18px" }],
        });
      } else {
        fallbackLineRef.current.setMap(map);
        fallbackLineRef.current.setPath(path);
      }
    }

    function drawCompletedTrace(path: AdminTripMapPoint[]): void {
      const map = mapRef.current;
      if (!map || !window.google?.maps || path.length < 2) {
        completedTraceLineRef.current?.setMap(null);
        completedTraceLineRef.current = null;
        return;
      }

      fallbackLineRef.current?.setMap(null);
      fallbackLineRef.current = null;
      rendererRef.current?.set("directions", null);

      if (!completedTraceLineRef.current) {
        completedTraceLineRef.current = new google.maps.Polyline({
          map,
          path,
          strokeColor: "#7c3aed",
          strokeOpacity: 0.98,
          strokeWeight: 8,
        });
      } else {
        completedTraceLineRef.current.setMap(map);
        completedTraceLineRef.current.setPath(path);
      }
    }

    function fitVisiblePoints(points: Array<AdminTripMapPoint | null>): void {
      const map = mapRef.current;
      if (!map || !window.google?.maps) return;

      const bounds = new google.maps.LatLngBounds();
      points.filter(Boolean).forEach((point) => bounds.extend(point as AdminTripMapPoint));

      if (!bounds.isEmpty()) {
        try {
          map.fitBounds(bounds, 48);
          return;
        } catch {
          // Fallback abajo.
        }
      }

      const fallback = points.find(Boolean) ?? ADMIN_RAPA_NUI_CENTER;
      map.setCenter(fallback as AdminTripMapPoint);
      map.setZoom(14);
    }

    async function refreshMapOnce(): Promise<void> {
      try {
        await ensureMap();
        if (cancelled) return;

        const map = mapRef.current;
        const renderer = rendererRef.current;
        const directionsService = directionsServiceRef.current;
        if (!map || !renderer || !directionsService || !window.google?.maps) return;

        const { pickup, destination } = await ensurePoints();
        if (cancelled) return;

        const effectiveStatus = getEffectiveAdminRideStatus(ride);
        const lowerStatus = String(effectiveStatus ?? "").toLowerCase();
        const isCompletedRide = lowerStatus === "completed" || Boolean(getRideUnknownField(ride, "completedAt"));
        const liveDriverPoint = isCompletedRide ? null : readAdminTripLiveDriverPoint(ride);
        const completedTrace = isCompletedRide ? readAdminTripCompletedDriverTrace(ride) : [];
        const completedEndPoint = completedTrace.length >= 2 ? completedTrace[completedTrace.length - 1] : null;
        const hasDriverStage = ["accepted", "driver_en_route", "driver_arrived", "in_progress"].includes(lowerStatus);
        const goingToPickup = ["accepted", "driver_en_route"].includes(lowerStatus);
        const goingToDestination = ["driver_arrived", "in_progress"].includes(lowerStatus);

        setMarker(pickupMarkerRef, pickup, {
          title: `Recogida: ${ride.originText}`,
          label: { text: "R", color: "#ffffff", fontSize: "12px", fontWeight: "900" },
          icon: adminTripMarkerIcon("#16a34a", 12),
          zIndex: 30,
        });

        setMarker(destinationMarkerRef, destination, {
          title: `Destino: ${ride.destinationText}`,
          label: { text: "D", color: "#ffffff", fontSize: "12px", fontWeight: "900" },
          icon: adminTripMarkerIcon("#dc2626", 11),
          zIndex: 25,
        });

        setMarker(driverMarkerRef, isCompletedRide ? completedEndPoint : liveDriverPoint, {
          title: isCompletedRide
            ? "Fin del recorrido del conductor"
            : `Conductor: ${ride.driverName || String(getRideUnknownField(ride, "assignedDriverName") ?? "Asignado")}`,
          icon: adminTripDriverIcon(),
          zIndex: 60,
        });

        if (isCompletedRide && completedTrace.length >= 2) {
          drawCompletedTrace(completedTrace);
          fitVisiblePoints([pickup, destination, ...completedTrace]);
          const completedDistance = completedTrace.reduce((sum, point, index) => {
            const previous = completedTrace[index - 1];
            return previous ? sum + adminTripMapDistanceMeters(previous, point) : sum;
          }, 0);
          setMapMessage("Viaje completado · recorrido guardado");
          setRouteMessage(`Ruta realizada por el conductor · ${formatAdminTripMapDistance(completedDistance)}`);
          return;
        }

        completedTraceLineRef.current?.setMap(null);
        completedTraceLineRef.current = null;

        const routeStart = isCompletedRide
          ? pickup ?? destination ?? ADMIN_RAPA_NUI_CENTER
          : hasDriverStage && liveDriverPoint
            ? liveDriverPoint
            : pickup ?? destination ?? ADMIN_RAPA_NUI_CENTER;
        const routeEnd = isCompletedRide
          ? destination ?? pickup
          : goingToPickup
            ? pickup ?? destination
            : goingToDestination
              ? destination ?? pickup
              : destination ?? pickup;

        fitVisiblePoints([pickup, destination, liveDriverPoint]);

        if (!routeStart || !routeEnd || adminTripMapDistanceMeters(routeStart, routeEnd) < 15) {
          renderer.set("directions", null);
          drawFallbackLine(null, null);
          setRouteMessage(
            isCompletedRide
              ? "Viaje completado. No hay distancia suficiente para dibujar ruta."
              : liveDriverPoint
                ? "GPS conductor recibido. Esperando avance de ruta."
                : "Esperando GPS del conductor. Mapa del viaje visible.",
          );
          setMapMessage(isCompletedRide ? "Viaje completado" : "Mapa del viaje activo");
          return;
        }

        const routeKey = [
          lowerStatus,
          routeStart.lat.toFixed(5),
          routeStart.lng.toFixed(5),
          routeEnd.lat.toFixed(5),
          routeEnd.lng.toFixed(5),
        ].join("|");

        if (routeKeyRef.current === routeKey) {
          setMapMessage(
            isCompletedRide
              ? "Viaje completado · ruta del servicio"
              : liveDriverPoint
                ? "Ruta del conductor en vivo"
                : "Ruta del viaje visible · esperando GPS conductor",
          );
          return;
        }
        routeKeyRef.current = routeKey;

        const request: google.maps.DirectionsRequest = {
          origin: routeStart,
          destination: routeEnd,
          travelMode: google.maps.TravelMode.DRIVING,
          provideRouteAlternatives: false,
          region: "CL",
        };

        if (!isCompletedRide) {
          request.drivingOptions = {
            departureTime: new Date(),
            trafficModel: google.maps.TrafficModel.BEST_GUESS,
          };
        }

        directionsService.route(request, (result, status) => {
          if (cancelled) return;

          if (status === google.maps.DirectionsStatus.OK && result) {
            fallbackLineRef.current?.setMap(null);
            fallbackLineRef.current = null;
            renderer.setDirections(result);
            const leg = result.routes[0]?.legs[0];
            const distance = leg?.distance?.text || formatAdminTripMapDistance(routeEnd ? adminTripMapDistanceMeters(routeStart, routeEnd) : null);
            const duration = leg?.duration?.text || "";
            setRouteMessage(
              isCompletedRide
                ? `Ruta completada del servicio · ${distance}${duration ? ` · ${duration}` : ""}`
                : liveDriverPoint
                  ? `Conductor en ruta · ${distance}${duration ? ` · ${duration}` : ""}`
                  : `Ruta del servicio · ${distance}${duration ? ` · ${duration}` : ""} · esperando GPS conductor`,
            );
            setMapMessage(
              isCompletedRide
                ? "Viaje completado · ruta del servicio"
                : liveDriverPoint
                  ? "Ruta del conductor en vivo"
                  : "Ruta del viaje visible · esperando GPS conductor",
            );
            return;
          }

          renderer.set("directions", null);
          drawFallbackLine(routeStart, routeEnd);
          setRouteMessage(
            isCompletedRide
              ? "Viaje completado. Google no entregó ruta por calles; mostrando referencia del servicio."
              : liveDriverPoint
                ? "Google no entregó ruta por calles. Mostrando referencia del conductor."
                : "Google no entregó ruta por calles. Mostrando referencia del viaje.",
          );
          setMapMessage(isCompletedRide ? "Viaje completado" : "Mapa del viaje activo");
        });
      } catch {
        if (!cancelled) {
          setMapMessage("No se pudo cargar Google Maps. Revisa la API key/conexión.");
          setRouteMessage(null);
        }
      }
    }

    // El admin NO se actualiza solo. El mapa se calcula una vez al entrar o cuando presiona “Actualizar”.
    void refreshMapOnce();

    return () => {
      cancelled = true;
      driverMarkerRef.current?.setMap(null);
      pickupMarkerRef.current?.setMap(null);
      destinationMarkerRef.current?.setMap(null);
      fallbackLineRef.current?.setMap(null);
      completedTraceLineRef.current?.setMap(null);
      rendererRef.current?.set("directions", null);
    };
  }, [ride.id, ride.originText, ride.destinationText, ride.notes, ride.status, ride.driverName, getRideUnknownField(ride, "driverEmail"), getRideUnknownField(ride, "completedAt"), height]);

  return (
    <div
      style={{
        position: "relative",
        height,
        minHeight: height,
        overflow: "hidden",
        borderRadius: "18px",
        background: "#e8f1fb",
        border: "1px solid rgba(210,164,58,.38)",
        marginBottom: "10px",
      }}
    >
      <div ref={mapElementRef} style={{ width: "100%", height: "100%" }} />
      <div
        style={{
          position: "absolute",
          left: 10,
          right: 10,
          top: 10,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            background: "rgba(17,17,17,.88)",
            color: "#fff",
            borderRadius: "999px",
            padding: "6px 10px",
            fontSize: ".72rem",
            fontWeight: 950,
            boxShadow: "0 10px 22px rgba(0,0,0,.22)",
          }}
        >
          🗺️ {mapMessage}
        </div>
        {routeMessage && (
          <div
            style={{
              background: "rgba(255,255,255,.94)",
              color: "#111",
              borderRadius: "999px",
              padding: "6px 10px",
              fontSize: ".72rem",
              fontWeight: 950,
              boxShadow: "0 10px 22px rgba(0,0,0,.16)",
              maxWidth: "58%",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {routeMessage}
          </div>
        )}
      </div>
    </div>
  );
}



type AdminRideAssignmentComplianceRow = {
  id: string;
  rideRequestId: string;
  driverUserId: string;
  driverName: string | null;
  driverEmail: string | null;
  originText: string | null;
  destinationText: string | null;
  acceptedAt: string;
  endedAt: string | null;
  elapsedSeconds: number | null;
  outcome: string;
  cancellationReason: string | null;
  cancelledByUserId: string | null;
  cancelledByRole: string | null;
  cancellationEvent: string | null;
  locationLat: number | null;
  locationLng: number | null;
  locationAccuracyMeters: number | null;
  locationCapturedAt: string | null;
};

type AdminDriverServiceScheduleRow = {
  id: string;
  driverUserId: string;
  driverName: string | null;
  driverEmail: string | null;
  startTime: string;
  serviceStartTime: string;
  serviceEndTime: string;
  serviceStartMinuteLocal: number;
  startMinuteLocal: number;
  timezone: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  nextScheduledEndAt: string | null;
  updatedAt: string;
};

type AdminDriverRestComplianceRow = {
  id: string;
  driverUserId: string;
  driverName: string | null;
  driverEmail: string | null;
  scheduleId: string;
  startTime: string;
  serviceStartTime: string;
  serviceEndTime: string;
  timezone: string;
  scheduledStartAt: string;
  actualStartAt: string | null;
  requiredEndAt: string | null;
  completedAt: string | null;
  status: string;
  decision: "rest" | "work" | null;
  decisionAt: string | null;
  delayedByRideId: string | null;
  durationMinutes: number;
  durationHours: number;
};

async function fetchAdminDriverComplianceReport(
  accessToken: string,
): Promise<{
  assignments: AdminRideAssignmentComplianceRow[];
  restPeriods: AdminDriverRestComplianceRow[];
  serviceSchedules: AdminDriverServiceScheduleRow[];
}> {
  const baseUrl = getAdminPolicyChargeApiBaseUrl();
  const apiBaseUrl = /\/api$/i.test(baseUrl) ? baseUrl : `${baseUrl}/api`;
  const headers = { Authorization: `Bearer ${accessToken}` };

  const [assignmentResponse, restResponse, scheduleResponse] =
    await Promise.all([
      fetch(`${apiBaseUrl}/admin/compliance/ride-assignments`, {
        method: "GET",
        headers,
        cache: "no-store",
      }),
      fetch(`${apiBaseUrl}/admin/compliance/driver-rest-periods`, {
        method: "GET",
        headers,
        cache: "no-store",
      }),
      fetch(`${apiBaseUrl}/admin/compliance/driver-service-schedules`, {
        method: "GET",
        headers,
        cache: "no-store",
      }),
    ]);

  const [assignmentPayload, restPayload, schedulePayload] =
    await Promise.all([
      assignmentResponse
        .json()
        .catch(() => ({})) as Promise<Record<string, unknown>>,
      restResponse
        .json()
        .catch(() => ({})) as Promise<Record<string, unknown>>,
      scheduleResponse
        .json()
        .catch(() => ({})) as Promise<Record<string, unknown>>,
    ]);

  if (!assignmentResponse.ok) {
    throw new Error(
      typeof assignmentPayload.message === "string"
        ? assignmentPayload.message
        : "No se pudo cargar el informe de aceptación y cancelación.",
    );
  }
  if (!restResponse.ok) {
    throw new Error(
      typeof restPayload.message === "string"
        ? restPayload.message
        : "No se pudo cargar el informe de descansos.",
    );
  }
  if (!scheduleResponse.ok) {
    throw new Error(
      typeof schedulePayload.message === "string"
        ? schedulePayload.message
        : "No se pudieron cargar los horarios de servicios.",
    );
  }

  return {
    assignments: Array.isArray(assignmentPayload.data)
      ? (assignmentPayload.data as AdminRideAssignmentComplianceRow[])
      : [],
    restPeriods: Array.isArray(restPayload.data)
      ? (restPayload.data as AdminDriverRestComplianceRow[])
      : [],
    serviceSchedules: Array.isArray(schedulePayload.data)
      ? (schedulePayload.data as AdminDriverServiceScheduleRow[])
      : [],
  };
}

function formatComplianceDuration(totalSeconds: unknown): string {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

const ADMIN_ASSIGNMENT_COMPLIANCE_HEADERS = [
  "ID registro",
  "ID viaje",
  "ID conductor",
  "Conductor",
  "Email conductor",
  "Origen",
  "Destino",
  "Fecha aceptación",
  "Fecha término",
  "Resultado",
  "Tiempo segundos",
  "Tiempo HH:MM:SS",
  "Motivo cancelación",
  "Cancelado por",
  "Evento",
  "Latitud",
  "Longitud",
  "Precisión metros",
  "Fecha ubicación",
] as const;

const ADMIN_ASSIGNMENT_COMPLIANCE_WIDTHS = [
  22, 22, 22, 24, 28, 28, 28, 20, 20, 18, 16, 18, 42, 20, 28, 14, 14, 16, 20,
];

const ADMIN_REST_COMPLIANCE_HEADERS = [
  "ID período",
  "ID conductor",
  "Conductor",
  "Email conductor",
  "Inicio servicios",
  "Término servicios",
  "Zona horaria",
  "Hora aviso",
  "Decisión",
  "Fecha decisión",
  "Inicio real descanso",
  "Fin exigido",
  "Completado",
  "Estado",
  "Atrasado por viaje (histórico)",
  "Minutos exigidos",
  "Horas exigidas",
] as const;

const ADMIN_REST_COMPLIANCE_WIDTHS = [
  22, 22, 24, 28, 16, 16, 20, 20, 18, 20, 20, 20, 20, 24, 22, 18, 16,
];

function getAdminAssignmentComplianceTableRows(
  rows: AdminRideAssignmentComplianceRow[],
): string[][] {
  return [
    [...ADMIN_ASSIGNMENT_COMPLIANCE_HEADERS],
    ...rows.map((row) => [
      sanitizeAdminExcelText(row.id, 140),
      sanitizeAdminExcelText(row.rideRequestId, 140),
      sanitizeAdminExcelText(row.driverUserId, 140),
      sanitizeAdminExcelText(row.driverName, 160),
      sanitizeAdminExcelText(row.driverEmail, 180),
      sanitizeAdminExcelText(row.originText, 260),
      sanitizeAdminExcelText(row.destinationText, 260),
      formatAdminExcelDate(row.acceptedAt),
      formatAdminExcelDate(row.endedAt),
      sanitizeAdminExcelText(row.outcome, 80),
      String(Math.max(0, Math.floor(Number(row.elapsedSeconds) || 0))),
      formatComplianceDuration(row.elapsedSeconds),
      sanitizeAdminExcelText(row.cancellationReason, 500),
      sanitizeAdminExcelText(row.cancelledByRole, 80),
      sanitizeAdminExcelText(row.cancellationEvent, 120),
      row.locationLat == null ? "" : String(row.locationLat),
      row.locationLng == null ? "" : String(row.locationLng),
      row.locationAccuracyMeters == null
        ? ""
        : String(row.locationAccuracyMeters),
      formatAdminExcelDate(row.locationCapturedAt),
    ]),
  ];
}

function getAdminRestComplianceTableRows(
  rows: AdminDriverRestComplianceRow[],
): string[][] {
  return [
    [...ADMIN_REST_COMPLIANCE_HEADERS],
    ...rows.map((row) => [
      sanitizeAdminExcelText(row.id, 140),
      sanitizeAdminExcelText(row.driverUserId, 140),
      sanitizeAdminExcelText(row.driverName, 160),
      sanitizeAdminExcelText(row.driverEmail, 180),
      sanitizeAdminExcelText(row.serviceStartTime, 20),
      sanitizeAdminExcelText(row.serviceEndTime, 20),
      sanitizeAdminExcelText(row.timezone, 80),
      formatAdminExcelDate(row.scheduledStartAt),
      sanitizeAdminExcelText(
        row.decision === "rest"
          ? "Tomar descanso"
          : row.decision === "work"
            ? "Trabajar"
            : "Pendiente",
        40,
      ),
      formatAdminExcelDate(row.decisionAt),
      formatAdminExcelDate(row.actualStartAt),
      formatAdminExcelDate(row.requiredEndAt),
      formatAdminExcelDate(row.completedAt),
      sanitizeAdminExcelText(row.status, 80),
      sanitizeAdminExcelText(row.delayedByRideId, 140),
      String(Math.max(0, Math.round(Number(row.durationMinutes) || 0))),
      String(Math.max(0, Number(row.durationHours) || 0)),
    ]),
  ];
}

type AdminRideExcelRow = Record<string, string>;
type AdminRideTerminalStatus = "completed" | "cancelled" | "no_show";

const ADMIN_RIDE_EXCEL_HEADERS = [
  "ID viaje",
  "Estado",
  "Fecha solicitud",
  "Fecha programada",
  "Origen",
  "Destino",
  "Pasajero",
  "Email pasajero",
  "Nota del pasajero",
  "Conductor",
  "Email conductor",
  "Vehículo",
  "Patente",
  "Experiencia reservada",
  "Tarifa CLP",
  "Método de pago",
  "Fecha aceptación",
  "Fecha llegada",
  "Fecha inicio",
  "Fecha completado",
  "Fecha cancelado / No Show",
  "Motivo cancelación",
  "Tipo No Show",
] as const;

const ADMIN_RIDE_EXCEL_WIDTHS = [
  22, 14, 19, 19, 30, 30, 22, 28, 38, 24, 28, 24, 14, 24, 14, 18, 19, 19, 19, 19, 23, 38, 22,
];

type AdminXlsxEntry = {
  name: string;
  bytes: Uint8Array;
};

function sanitizeAdminExcelText(value: unknown, maxLength = 32000): string {
  let text = String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

  // Defensa adicional contra Formula Injection al abrir el archivo en Excel.
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return text;
}

function escapeAdminExcelXml(value: unknown): string {
  return sanitizeAdminExcelText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getAdminRidePromotionLabel(ride: AdminRideData): string | null {
  const record = ride as AdminRideData & Record<string, unknown>;
  const direct = sanitizeAdminExcelText(
    record.roundTripPromotionTitle ??
      record.promotionTitle ??
      record.offerTitle ??
      record.selectedOfferTitle,
    180,
  );
  if (direct) return direct;

  const notes = String(ride.notes ?? "");
  const match = notes.match(/(?:Promoción con regreso seleccionado|Promoción asociada|Oferta seleccionada|Experiencia con reserva seleccionada|Experiencia reservada):\s*([^\n.]+)/i);
  return match?.[1] ? sanitizeAdminExcelText(match[1], 180) : null;
}

function getAdminRideVehicleSummary(ride: AdminRideData): string {
  const record = ride as AdminRideData & Record<string, unknown>;
  return [
    record.driverVehicleBrand ?? record.vehicleBrand,
    record.driverVehicleModel ?? record.vehicleModel,
    record.driverVehicleColor ?? record.vehicleColor,
  ]
    .map((value) => sanitizeAdminExcelText(value, 80))
    .filter(Boolean)
    .join(" ");
}

function getAdminRideExcelStatus(ride: AdminRideData): AdminRideTerminalStatus | null {
  // No Show se evalúa primero para que nunca termine mezclado con Cancelados o Completados.
  if (isAdminRideNoShow(ride)) return "no_show";

  const status = String(getEffectiveAdminRideStatus(ride) ?? "").trim().toLowerCase();
  if (["completed", "complete", "finished"].includes(status)) return "completed";
  if (["cancelled", "canceled", "passenger_cancelled", "driver_cancelled"].includes(status)) return "cancelled";
  return null;
}

function formatAdminExcelDate(value: unknown): string {
  const date = new Date(String(value ?? ""));
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
}

function getAdminRideExcelPaymentLabel(ride: AdminRideData): string {
  const record = ride as AdminRideData & Record<string, unknown>;
  const raw = [
    record.paymentMethod,
    record.paymentProvider,
    record.provider,
    record.paymentType,
    ride.notes,
  ]
    .map((value) => String(value ?? "").toLowerCase())
    .join(" ");

  if (raw.includes("mercadopago") || raw.includes("mercado pago") || raw.includes("tarjeta") || raw.includes("card")) {
    return "Mercado Pago";
  }
  if (raw.includes("cash") || raw.includes("efectivo")) return "Efectivo";

  return sanitizeAdminExcelText(record.paymentMethod ?? record.paymentProvider, 80);
}

function getAdminRideExcelCancellationReason(
  ride: AdminRideData,
  exportStatus: AdminRideTerminalStatus,
): string {
  const record = ride as AdminRideData & Record<string, unknown>;
  const direct =
    ride.cancellationReason ??
    record.cancelReason ??
    record.cancelledReason ??
    record.passengerCancellationReason ??
    record.driverCancellationReason ??
    record.adminCancellationReason ??
    record.reason;

  const cleaned = sanitizeAdminExcelText(direct, 500);
  if (cleaned) return cleaned;
  return exportStatus === "no_show" ? "Pasajero no se presentó en el punto de recogida." : "Sin motivo informado";
}

function getAdminRideExcelNoShowType(ride: AdminRideData): string {
  const record = ride as AdminRideData & Record<string, unknown>;
  const direct = sanitizeAdminExcelText(
    record.noShowType ?? record.noShowReason ?? record.noShowCategory,
    120,
  );
  if (direct) return direct;

  const cancelledBy = String(record.cancelledByRole ?? record.cancelledBy ?? "").toLowerCase();
  if (cancelledBy.includes("driver_no_show")) return "Pasajero no se presentó";
  if (cancelledBy.includes("passenger_no_show")) return "Conductor no se presentó";
  return "Pasajero no se presentó";
}

function getAdminRideExcelTerminalTimestampMs(
  ride: AdminRideData,
  status: AdminRideTerminalStatus,
): number {
  const record = ride as AdminRideData & Record<string, unknown>;
  const candidates = status === "completed"
    ? [ride.completedAt, record.closedByDriverAt, record.finishedAt, record.updatedAt]
    : status === "no_show"
      ? [record.noShowConfirmedAt, record.closedByDriverAt, ride.cancelledAt, record.updatedAt]
      : [ride.cancelledAt, record.canceledAt, record.updatedAt];

  for (const candidate of candidates) {
    const parsed = new Date(String(candidate ?? "")).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function getAdminRideExcelDedupeKey(ride: AdminRideData): string {
  const record = ride as AdminRideData & Record<string, unknown>;
  const id = String(ride.id ?? record.rideId ?? record.originalRideId ?? record.serverRideId ?? "").trim();
  if (id) return `id:${id}`;

  const schedule = getAdminRideScheduleInfo(ride);
  return [
    getAdminRideExcelStatus(ride) ?? "unknown",
    ride.passengerEmail ?? record.email ?? "",
    ride.originText ?? "",
    ride.destinationText ?? "",
    schedule.displayScheduledAt ?? schedule.scheduledAt ?? ride.requestedAt ?? ride.createdAt ?? "",
  ]
    .map((value) => String(value ?? "").trim().toLowerCase())
    .join("|");
}

function dedupeAdminRideExcelSource(rides: AdminRideData[]): AdminRideData[] {
  const byKey = new Map<string, AdminRideData>();

  for (const ride of rides) {
    const status = getAdminRideExcelStatus(ride);
    if (!status) continue;

    const key = getAdminRideExcelDedupeKey(ride);
    const current = byKey.get(key);
    if (!current) {
      byKey.set(key, ride);
      continue;
    }

    const currentStatus = getAdminRideExcelStatus(current) ?? status;
    if (getAdminRideExcelTerminalTimestampMs(ride, status) >= getAdminRideExcelTerminalTimestampMs(current, currentStatus)) {
      byKey.set(key, ride);
    }
  }

  return [...byKey.values()];
}

function getAdminRideExcelRows(
  rides: AdminRideData[],
  onlyStatus?: AdminRideTerminalStatus,
): AdminRideExcelRow[] {
  return dedupeAdminRideExcelSource(rides)
    .filter((ride) => !onlyStatus || getAdminRideExcelStatus(ride) === onlyStatus)
    .sort((a, b) => {
      const aStatus = getAdminRideExcelStatus(a) ?? "cancelled";
      const bStatus = getAdminRideExcelStatus(b) ?? "cancelled";
      return getAdminRideExcelTerminalTimestampMs(b, bStatus) - getAdminRideExcelTerminalTimestampMs(a, aStatus);
    })
    .map((ride): AdminRideExcelRow => {
      const exportStatus = getAdminRideExcelStatus(ride) as AdminRideTerminalStatus;
      const record = ride as AdminRideData & Record<string, unknown>;
      const schedule = getAdminRideScheduleInfo(ride);
      const driverName = sanitizeAdminExcelText(
        ride.driverName ?? record.assignedDriverName ?? record.driverFullName,
        140,
      );
      const driverEmail = sanitizeAdminExcelText(record.driverEmail ?? record.assignedDriverEmail, 180);
      const vehiclePlate = sanitizeAdminExcelText(record.driverVehiclePlate ?? record.vehiclePlate, 60);
      const fare = Number(
        ride.estimatedFareClp ??
          record.fareClp ??
          record.priceClp ??
          record.totalFareClp ??
          record.passengerFareClp ??
          0,
      );

      return {
        "ID viaje": sanitizeAdminExcelText(ride.id ?? record.rideId ?? record.originalRideId, 140),
        Estado: exportStatus === "no_show" ? "No Show" : exportStatus === "completed" ? "Completado" : "Cancelado",
        "Fecha solicitud": formatAdminExcelDate(ride.requestedAt ?? ride.createdAt),
        "Fecha programada": formatAdminExcelDate(schedule.displayScheduledAt ?? schedule.scheduledAt),
        Origen: sanitizeAdminExcelText(ride.originText, 260),
        Destino: sanitizeAdminExcelText(ride.destinationText, 260),
        Pasajero: sanitizeAdminExcelText(ride.passengerName ?? record.userName ?? record.passengerFullName, 160),
        "Email pasajero": sanitizeAdminExcelText(ride.passengerEmail ?? record.email ?? record.userEmail, 180),
        "Nota del pasajero": sanitizeAdminExcelText(getAdminPassengerNote(ride), 500),
        Conductor: driverName,
        "Email conductor": driverEmail,
        Vehículo: getAdminRideVehicleSummary(ride),
        Patente: vehiclePlate,
        "Experiencia reservada": sanitizeAdminExcelText(getAdminRidePromotionLabel(ride), 180),
        "Tarifa CLP": Number.isFinite(fare) && fare > 0 ? String(Math.round(fare)) : "",
        "Método de pago": getAdminRideExcelPaymentLabel(ride),
        "Fecha aceptación": formatAdminExcelDate(ride.acceptedAt ?? record.driverAcceptedAt),
        "Fecha llegada": formatAdminExcelDate(ride.arrivedAt ?? record.driverArrivedAt),
        "Fecha inicio": formatAdminExcelDate(ride.startedAt ?? record.startedAt),
        "Fecha completado": exportStatus === "completed"
          ? formatAdminExcelDate(ride.completedAt ?? record.closedByDriverAt ?? record.finishedAt)
          : "",
        "Fecha cancelado / No Show": exportStatus !== "completed"
          ? formatAdminExcelDate(ride.cancelledAt ?? record.canceledAt ?? record.noShowConfirmedAt ?? record.closedByDriverAt)
          : "",
        "Motivo cancelación": exportStatus === "completed" ? "" : getAdminRideExcelCancellationReason(ride, exportStatus),
        "Tipo No Show": exportStatus === "no_show" ? getAdminRideExcelNoShowType(ride) : "",
      };
    });
}

function adminRideExcelTableRows(rows: AdminRideExcelRow[]): string[][] {
  return [
    [...ADMIN_RIDE_EXCEL_HEADERS],
    ...rows.map((row) => ADMIN_RIDE_EXCEL_HEADERS.map((header) => row[header] ?? "")),
  ];
}

function adminXlsxColumnName(index: number): string {
  let result = "";
  let value = index + 1;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function adminXlsxCell(ref: string, value: unknown, style = 0): string {
  const styleAttribute = style > 0 ? ` s="${style}"` : "";
  return `<c r="${ref}" t="inlineStr"${styleAttribute}><is><t xml:space="preserve">${escapeAdminExcelXml(value)}</t></is></c>`;
}

function adminXlsxSheetXml(rows: string[][], widths: number[]): string {
  const rowXml = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, columnIndex) => adminXlsxCell(`${adminXlsxColumnName(columnIndex)}${rowIndex + 1}`, value, rowIndex === 0 ? 1 : 0))
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");

  const lastColumn = adminXlsxColumnName(Math.max(0, (rows[0]?.length ?? 1) - 1));
  const lastRow = Math.max(1, rows.length);
  const cols = widths
    .map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`)
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:${lastColumn}${lastRow}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <cols>${cols}</cols>
  <sheetData>${rowXml}</sheetData>
  <autoFilter ref="A1:${lastColumn}${lastRow}"/>
</worksheet>`;
}

function adminXlsxCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function adminXlsxWrite16(target: Uint8Array, offset: number, value: number): void {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
}

function adminXlsxWrite32(target: Uint8Array, offset: number, value: number): void {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
  target[offset + 2] = (value >>> 16) & 0xff;
  target[offset + 3] = (value >>> 24) & 0xff;
}

function adminXlsxDosDateTime(date = new Date()): { time: number; date: number } {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

function adminXlsxConcat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function adminBuildStoredZip(entries: AdminXlsxEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  const metadata: Array<{ name: Uint8Array; bytes: Uint8Array; crc: number; offset: number }> = [];
  const dos = adminXlsxDosDateTime();
  let localOffset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const crc = adminXlsxCrc32(entry.bytes);
    const local = new Uint8Array(30 + name.length + entry.bytes.length);
    adminXlsxWrite32(local, 0, 0x04034b50);
    adminXlsxWrite16(local, 4, 20);
    adminXlsxWrite16(local, 6, 0x0800);
    adminXlsxWrite16(local, 8, 0);
    adminXlsxWrite16(local, 10, dos.time);
    adminXlsxWrite16(local, 12, dos.date);
    adminXlsxWrite32(local, 14, crc);
    adminXlsxWrite32(local, 18, entry.bytes.length);
    adminXlsxWrite32(local, 22, entry.bytes.length);
    adminXlsxWrite16(local, 26, name.length);
    adminXlsxWrite16(local, 28, 0);
    local.set(name, 30);
    local.set(entry.bytes, 30 + name.length);
    localParts.push(local);
    metadata.push({ name, bytes: entry.bytes, crc, offset: localOffset });
    localOffset += local.length;
  }

  let centralSize = 0;
  for (const item of metadata) {
    const central = new Uint8Array(46 + item.name.length);
    adminXlsxWrite32(central, 0, 0x02014b50);
    adminXlsxWrite16(central, 4, 20);
    adminXlsxWrite16(central, 6, 20);
    adminXlsxWrite16(central, 8, 0x0800);
    adminXlsxWrite16(central, 10, 0);
    adminXlsxWrite16(central, 12, dos.time);
    adminXlsxWrite16(central, 14, dos.date);
    adminXlsxWrite32(central, 16, item.crc);
    adminXlsxWrite32(central, 20, item.bytes.length);
    adminXlsxWrite32(central, 24, item.bytes.length);
    adminXlsxWrite16(central, 28, item.name.length);
    adminXlsxWrite16(central, 30, 0);
    adminXlsxWrite16(central, 32, 0);
    adminXlsxWrite16(central, 34, 0);
    adminXlsxWrite16(central, 36, 0);
    adminXlsxWrite32(central, 38, 0);
    adminXlsxWrite32(central, 42, item.offset);
    central.set(item.name, 46);
    centralParts.push(central);
    centralSize += central.length;
  }

  const end = new Uint8Array(22);
  adminXlsxWrite32(end, 0, 0x06054b50);
  adminXlsxWrite16(end, 4, 0);
  adminXlsxWrite16(end, 6, 0);
  adminXlsxWrite16(end, 8, entries.length);
  adminXlsxWrite16(end, 10, entries.length);
  adminXlsxWrite32(end, 12, centralSize);
  adminXlsxWrite32(end, 16, localOffset);
  adminXlsxWrite16(end, 20, 0);

  return adminXlsxConcat([...localParts, ...centralParts, end]);
}

function buildAdminTerminalRidesXlsx(
  rides: AdminRideData[],
  assignments: AdminRideAssignmentComplianceRow[],
  restPeriods: AdminDriverRestComplianceRow[],
): Uint8Array {
  const encoder = new TextEncoder();
  const completedRows = getAdminRideExcelRows(rides, "completed");
  const cancelledRows = getAdminRideExcelRows(rides, "cancelled");
  const noShowRows = getAdminRideExcelRows(rides, "no_show");
  const totalRows = completedRows.length + cancelledRows.length + noShowRows.length;

  const summaryRows = [
    ["Resumen de viajes RAPA GO", "Cantidad / regla"],
    ["Completados", String(completedRows.length)],
    ["Cancelados", String(cancelledRows.length)],
    ["No Show", String(noShowRows.length)],
    ["Total viajes exportados", String(totalRows)],
    ["Registros aceptación/cancelación", String(assignments.length)],
    ["Períodos de desconexión", String(restPeriods.length)],
    ["Desconexión continua exigida", "12 horas"],
    ["Asignación automática de conductor", `${SCHEDULE_ACTIVATION_MINUTES_ADMIN} minutos antes de la reserva`],
    ["Cancelación programada con cargo", `Dentro de los últimos ${SCHEDULED_CANCELLATION_CHARGE_MINUTES_ADMIN} minutos`],
    ["Cargo cancelación programada", "30% de la tarifa, tope $3.000 CLP"],
    ["Fecha de exportación", new Date().toLocaleString("es-CL")],
  ];

  const sheet1 = adminXlsxSheetXml(summaryRows, [38, 48]);
  const sheet2 = adminXlsxSheetXml(adminRideExcelTableRows(completedRows), ADMIN_RIDE_EXCEL_WIDTHS);
  const sheet3 = adminXlsxSheetXml(adminRideExcelTableRows(cancelledRows), ADMIN_RIDE_EXCEL_WIDTHS);
  const sheet4 = adminXlsxSheetXml(adminRideExcelTableRows(noShowRows), ADMIN_RIDE_EXCEL_WIDTHS);
  const sheet5 = adminXlsxSheetXml(
    getAdminAssignmentComplianceTableRows(assignments),
    ADMIN_ASSIGNMENT_COMPLIANCE_WIDTHS,
  );
  const sheet6 = adminXlsxSheetXml(
    getAdminRestComplianceTableRows(restPeriods),
    ADMIN_REST_COMPLIANCE_WIDTHS,
  );

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet4.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet5.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet6.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;

  const rootRelationships = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Resumen" sheetId="1" r:id="rId1"/>
    <sheet name="Completados" sheetId="2" r:id="rId2"/>
    <sheet name="Cancelados" sheetId="3" r:id="rId3"/>
    <sheet name="No Show" sheetId="4" r:id="rId4"/>
    <sheet name="Aceptación-cancelación" sheetId="5" r:id="rId5"/>
    <sheet name="Descansos 12 horas" sheetId="6" r:id="rId6"/>
  </sheets>
</workbook>`;

  const workbookRelationships = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet4.xml"/>
  <Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet5.xml"/>
  <Relationship Id="rId6" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet6.xml"/>
  <Relationship Id="rId7" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFC89B3C"/><bgColor indexed="64"/></patternFill></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

  return adminBuildStoredZip([
    { name: "[Content_Types].xml", bytes: encoder.encode(contentTypes) },
    { name: "_rels/.rels", bytes: encoder.encode(rootRelationships) },
    { name: "xl/workbook.xml", bytes: encoder.encode(workbook) },
    { name: "xl/_rels/workbook.xml.rels", bytes: encoder.encode(workbookRelationships) },
    { name: "xl/styles.xml", bytes: encoder.encode(styles) },
    { name: "xl/worksheets/sheet1.xml", bytes: encoder.encode(sheet1) },
    { name: "xl/worksheets/sheet2.xml", bytes: encoder.encode(sheet2) },
    { name: "xl/worksheets/sheet3.xml", bytes: encoder.encode(sheet3) },
    { name: "xl/worksheets/sheet4.xml", bytes: encoder.encode(sheet4) },
    { name: "xl/worksheets/sheet5.xml", bytes: encoder.encode(sheet5) },
    { name: "xl/worksheets/sheet6.xml", bytes: encoder.encode(sheet6) },
  ]);
}

type AdminComplianceExportResult = {
  terminalRides: number;
  assignmentRecords: number;
  restPeriods: number;
  totalRecords: number;
};

function downloadAdminTerminalRidesXlsx(
  rides: AdminRideData[],
  assignments: AdminRideAssignmentComplianceRow[],
  restPeriods: AdminDriverRestComplianceRow[],
): AdminComplianceExportResult {
  const terminalRides = dedupeAdminRideExcelSource(rides);
  const totalRecords =
    terminalRides.length + assignments.length + restPeriods.length;

  if (totalRecords === 0) {
    return {
      terminalRides: 0,
      assignmentRecords: 0,
      restPeriods: 0,
      totalRecords: 0,
    };
  }

  const bytes = buildAdminTerminalRidesXlsx(
    terminalRides,
    assignments,
    restPeriods,
  );
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const today = new Date().toISOString().slice(0, 10);
  anchor.href = url;
  anchor.download = `viajes_y_cumplimiento_rapago_${today}.xlsx`;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);

  return {
    terminalRides: terminalRides.length,
    assignmentRecords: assignments.length,
    restPeriods: restPeriods.length,
    totalRecords,
  };
}

export function AdminTripsPage(): JSX.Element {
  const { session } = useAuth();
  const history = useHistory();

  const [rides, setRides] = useState<AdminRideData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [viewMode, setViewMode] = useState<"all" | "scheduled">("all");
  const [autoRefreshing, setAutoRefreshing] = useState(false);

  // Cancel state per-ride
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelAlertId, setCancelAlertId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [autoAssignToast, setAutoAssignToast] = useState<string | null>(null);
  const [exportingTerminalRides, setExportingTerminalRides] = useState(false);
  const [exportToast, setExportToast] = useState<string | null>(null);

  const loadData = useCallback(
    async (silent = false) => {
      if (!session?.accessToken) return;

      if (silent) {
        setAutoRefreshing(true);
      } else {
        setLoading(true);
      }

      setLoadError(null);

      try {
        const params: { status?: string } = {};
        if (filterStatus && filterStatus !== "scheduled" && filterStatus !== "no_show") params.status = filterStatus;

        const ridesData = await adminService.listRides(
          session.accessToken,
          params,
        );

        const localScheduled = readLocalAdminScheduledRides();
        const returnReservations = [
          ...readLocalPassengerReturnReservationsForAdmin(),
          ...buildAdminReturnReservationsFromRides(ridesData),
          ...buildAdminReturnReservationsFromRides(localScheduled),
        ];
        const merged = mergeAdminRides([...localScheduled, ...returnReservations, ...ridesData]);
        const byViewMode = viewMode === "scheduled"
          ? merged.filter((ride) => getAdminRideScheduleInfo(ride).isScheduled)
          : merged;
        const visible = filterStatus
          ? byViewMode.filter((ride) => getEffectiveAdminRideStatus(ride) === filterStatus)
          : byViewMode;

        setRides(sortAdminRidesForOperations(visible));
      } catch (err) {
        setLoadError(
          err instanceof Error ? err.message : "Error al cargar datos.",
        );
      } finally {
        if (silent) {
          setAutoRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [session?.accessToken, filterStatus, viewMode],
  );

  useEffect(() => {
    void loadData(false);
  }, [loadData]);

  // El panel de viajes no hace auto-refresh. El admin usa el botón “Actualizar” para recargar.

  useEffect(() => {
    if (!session?.accessToken) return;

    const accessToken = session.accessToken;
    let cancelled = false;
    let running = false;

    const runAutoReservationAssignment = async (): Promise<void> => {
      if (running) return;
      running = true;

      try {
        const drivers = await adminService.listActiveDrivers(accessToken);
        const localScheduled = includeGeneratedRoundTripReturnLegs(
          readLocalAdminScheduledRides(),
        );
        const processed: AdminRideData[] = [];

        for (const ride of localScheduled) {
          const directAssignment = autoAssignReservationToAvailableDriverFromAdmin(ride, drivers);
          if (directAssignment) {
            processed.push(directAssignment);
            continue;
          }

          const reassigned = autoAssignReservationToNextAvailableDriverFromAdmin(ride, drivers);
          if (reassigned) processed.push(reassigned);
        }

        if (processed.length > 0 && !cancelled) {
          setRides((prev) =>
            sortAdminRidesForOperations(mergeAdminRides([...processed, ...prev])),
          );
          setAutoAssignToast(
            processed.length === 1
              ? "Sistema asignó automáticamente una reserva a un conductor disponible."
              : `Sistema asignó automáticamente ${processed.length} reservas a conductores disponibles.`,
          );
        }
      } catch {
        // No bloquea el panel: si falla, se reintenta en el próximo ciclo.
      } finally {
        running = false;
      }
    };

    void runAutoReservationAssignment();

    const onReservationEvent = () => {
      window.setTimeout(() => {
        void runAutoReservationAssignment();
      }, 120);
    };

    window.addEventListener("storage", onReservationEvent);
    window.addEventListener("rapago:admin-scheduled-rides-updated", onReservationEvent as EventListener);
    window.addEventListener(ADMIN_RESERVATION_AUTO_REASSIGN_EVENT, onReservationEvent as EventListener);
    window.addEventListener(ADMIN_RESERVATION_AUTO_ASSIGN_EVENT, onReservationEvent as EventListener);

    return () => {
      cancelled = true;
      window.removeEventListener("storage", onReservationEvent);
      window.removeEventListener("rapago:admin-scheduled-rides-updated", onReservationEvent as EventListener);
      window.removeEventListener(ADMIN_RESERVATION_AUTO_REASSIGN_EVENT, onReservationEvent as EventListener);
      window.removeEventListener(ADMIN_RESERVATION_AUTO_ASSIGN_EVENT, onReservationEvent as EventListener);
    };
  }, [session?.accessToken]);

  async function handleCancel(rideId: string, reason: string) {
    if (!session?.accessToken) return;

    const target =
      rides.find((ride) => ride.id === rideId) ??
      readLocalAdminScheduledRides().find((ride) => ride.id === rideId);

    const effectiveStatus = target ? getEffectiveAdminRideStatus(target) : "";

    // Evita el error rojo del backend cuando el viaje ya viene cancelado.
    // Si ya está cancelado, no se vuelve a llamar a adminCancelRide.
    if (effectiveStatus === "cancelled") {
      setCancelError(null);
      setCancelAlertId(null);
      setCancellingId(null);
      return;
    }

    const isLocalOnlyRide =
      rideId.startsWith("local-") ||
      rideId.startsWith("admin-local-") ||
      Boolean(target && getRideUnknownField(target, "localOnly") === true);

    setCancellingId(rideId);
    setCancelError(null);

    try {
      const cancelledLocal = target ? buildAdminCancelledRide(target, reason) : null;

      if (cancelledLocal) {
        syncAdminCancelledRideLocally(target!, cancelledLocal);
        setRides((prev) =>
          sortAdminRidesForOperations(
            mergeAdminRides(prev.map((ride) => (ride.id === rideId ? cancelledLocal : ride))),
          ),
        );
      }

      if (!isLocalOnlyRide) {
        const updated = await adminService.adminCancelRide(
          session.accessToken,
          rideId,
          reason,
        );

        const finalUpdated = {
          ...(cancelledLocal ?? {}),
          ...updated,
          status: "cancelled",
          cancellationReason: updated.cancellationReason ?? reason,
        } as AdminRideData;

        setRides((prev) =>
          sortAdminRidesForOperations(
            mergeAdminRides(prev.map((ride) => (ride.id === rideId ? finalUpdated : ride))),
          ),
        );
      }

      setCancelError(null);
      void loadData(true);
    } catch (err) {
      if (isAdminCancelledRideConflictMessage(err)) {
        // El backend dice que ya estaba cancelado: lo tratamos como éxito para no ensuciar el admin.
        if (target) {
          const cancelledLocal = buildAdminCancelledRide(target, reason);
          syncAdminCancelledRideLocally(target, cancelledLocal);
          setRides((prev) =>
            sortAdminRidesForOperations(
              mergeAdminRides(prev.map((ride) => (ride.id === rideId ? cancelledLocal : ride))),
            ),
          );
        }

        setCancelError(null);
        void loadData(true);
        return;
      }

      setCancelError(
        err instanceof Error ? err.message : "Error al cancelar viaje.",
      );
    } finally {
      setCancellingId(null);
      setCancelAlertId(null);
    }
  }

  function handleActivateScheduledRide(ride: AdminRideData): void {
    setActivatingId(ride.id);
    setCancelError(null);

    try {
      const activated = buildActivatedScheduledRide(ride);
      const originalMergeKey = getAdminRideMergeKey(ride);
      const activatedMergeKey = getAdminRideMergeKey(activated);

      const localAdminRides = readLocalAdminScheduledRides();
      const localAdminWithoutCurrent = localAdminRides.filter((item) => {
        const itemKey = getAdminRideMergeKey(item);
        return itemKey !== originalMergeKey && itemKey !== activatedMergeKey && item.id !== ride.id;
      });

      saveLocalAdminScheduledRidesForAdmin([activated, ...localAdminWithoutCurrent]);

      const passengerKey = getScheduledPassengerMirrorKey(ride as unknown as Record<string, unknown>);
      const localPassengerRides = readLocalPassengerRidesForAdmin();
      const updatedPassengerRides = localPassengerRides.map((item) => {
        if (getScheduledPassengerMirrorKey(item) !== passengerKey && item.id !== ride.id) {
          return item;
        }

        return {
          ...item,
          status: "requested",
          requestedAt: String(item.requestedAt ?? new Date().toISOString()),
          scheduleStatus: "active",
          adminScheduleStatus: "active",
          activatedAt: new Date().toISOString(),
        };
      });

      saveLocalPassengerRidesForAdmin(updatedPassengerRides);

      setRides((prev) =>
        sortAdminRidesForOperations(
          prev.map((item) =>
            getAdminRideMergeKey(item) === originalMergeKey || item.id === ride.id
              ? activated
              : item,
          ),
        ),
      );
    } finally {
      window.setTimeout(() => setActivatingId(null), 350);
    }
  }

  function goToAvailableDriversFromRide(ride: AdminRideData): void {
    try {
      localStorage.setItem(
        ADMIN_DRIVER_ASSIGNMENT_SELECTION_KEY,
        JSON.stringify({
          ...(ride as AdminRideData & Record<string, unknown>),
          scheduledAt: getAdminRideScheduleInfo(ride).displayScheduledAt ?? getAdminRideScheduleInfo(ride).scheduledAt,
          scheduledPickupAt: getAdminRideScheduleInfo(ride).displayScheduledAt ?? getAdminRideScheduleInfo(ride).scheduledAt,
          returnScheduledAt: getAdminRideScheduleInfo(ride).returnScheduledAt,
          scheduledReturnAt: getAdminRideScheduleInfo(ride).returnScheduledAt,
          scheduleActivationAt: getAdminRideScheduleInfo(ride).activationAt,
          roundTripReturnOnly: getAdminRideScheduleInfo(ride).isReturnOnlyPromotion,
          isReturnOnlyPromotion: getAdminRideScheduleInfo(ride).isReturnOnlyPromotion,
          bookingPurpose: getAdminRideScheduleInfo(ride).isReturnOnlyPromotion
            ? "round_trip_return_only"
            : getRideUnknownField(ride, "bookingPurpose"),
          serviceType: getAdminRideScheduleInfo(ride).isReturnOnlyPromotion
            ? "round_trip_return_only"
            : getRideUnknownField(ride, "serviceType"),
        }),
      );
      window.dispatchEvent(new CustomEvent(ADMIN_DRIVER_ASSIGNMENT_EVENT));
      window.dispatchEvent(new CustomEvent(ADMIN_DRIVERS_REFRESH_EVENT));
    } catch {
      // No bloquea navegación.
    }

    history.push(ADMIN_DRIVERS_ROUTE);
  }

  async function handleExportTerminalRides(): Promise<void> {
    if (!session?.accessToken || exportingTerminalRides) return;

    setExportingTerminalRides(true);
    setLoadError(null);

    try {
      const [ridesData, complianceReport] = await Promise.all([
        adminService.listRides(session.accessToken, {}),
        fetchAdminDriverComplianceReport(session.accessToken),
      ]);
      const localScheduled = readLocalAdminScheduledRides();
      const returnReservations = [
        ...readLocalPassengerReturnReservationsForAdmin(),
        ...buildAdminReturnReservationsFromRides(ridesData),
        ...buildAdminReturnReservationsFromRides(localScheduled),
      ];
      const merged = mergeAdminRides([...localScheduled, ...returnReservations, ...ridesData]);
      const exported = downloadAdminTerminalRidesXlsx(
        merged,
        complianceReport.assignments,
        complianceReport.restPeriods,
      );

      if (exported.totalRecords === 0) {
        setExportToast("No hay viajes ni registros de cumplimiento para exportar.");
        return;
      }

      setExportToast(
        `Excel generado: ${exported.terminalRides} viajes, ` +
          `${exported.assignmentRecords} registros de aceptación/cancelación y ` +
          `${exported.restPeriods} períodos de descanso.`,
      );
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "No fue posible generar el Excel de viajes.");
    } finally {
      setExportingTerminalRides(false);
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="danger">
          <IonTitle>Viajes</IonTitle>
          <div
            slot="end"
            style={{
              paddingRight: "8px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            {autoRefreshing && (
              <IonSpinner
                name="dots"
                color="light"
                style={{ width: "18px", height: "18px" }}
              />
            )}
            <IonButton
              fill="clear"
              color="light"
              onClick={() => void loadData(false)}
              disabled={loading}
            >
              Actualizar
            </IonButton>
          </div>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonRefresher
          slot="fixed"
          onIonRefresh={async (e) => {
            await loadData(false);
            e.detail.complete();
          }}
        >
          <IonRefresherContent />
        </IonRefresher>

        {/* Segmento Todos / Programados */}
        <IonSegment
          value={viewMode}
          onIonChange={(e) => setViewMode(e.detail.value as "all" | "scheduled")}
          style={{ margin: "0 0 10px" }}
        >
          <IonSegmentButton value="all"><IonLabel>Todos</IonLabel></IonSegmentButton>
          <IonSegmentButton value="scheduled"><IonLabel>⚡ Programados</IonLabel></IonSegmentButton>
        </IonSegment>

        {/* Filter by status */}
        <IonCard style={{ margin: "0 0 12px" }}>
          <IonCardContent style={{ padding: "10px 12px" }}>
            <IonItem lines="none">
              <IonLabel position="stacked" style={{ fontSize: "0.78rem" }}>
                Estado
              </IonLabel>
              <IonSelect
                value={filterStatus}
                onIonChange={(e) =>
                  setFilterStatus(String(e.detail.value ?? ""))
                }
                placeholder="Todos"
                interface="popover"
              >
                <IonSelectOption value="">Todos</IonSelectOption>
                <IonSelectOption value="scheduled">Agendados</IonSelectOption>
                <IonSelectOption value="requested">Solicitado</IonSelectOption>
                <IonSelectOption value="accepted">
                  Conductor asignado
                </IonSelectOption>
                <IonSelectOption value="driver_en_route">
                  Conductor en camino
                </IonSelectOption>
                <IonSelectOption value="driver_arrived">
                  Conductor llegó
                </IonSelectOption>
                <IonSelectOption value="in_progress">En curso</IonSelectOption>
                <IonSelectOption value="completed">Completado</IonSelectOption>
                <IonSelectOption value="cancelled">Cancelado</IonSelectOption>
                <IonSelectOption value="no_show">No Show</IonSelectOption>
              </IonSelect>
            </IonItem>
            <IonButton
              expand="block"
              size="small"
              fill="outline"
              color="danger"
              style={{ marginTop: "8px" }}
              onClick={() => void loadData(false)}
              disabled={loading}
            >
              {loading ? <IonSpinner name="dots" /> : "Aplicar filtro"}
            </IonButton>
            <IonButton
              expand="block"
              size="small"
              color="success"
              style={{ marginTop: "8px", fontWeight: 900 }}
              onClick={() => void handleExportTerminalRides()}
              disabled={loading || exportingTerminalRides}
            >
              {exportingTerminalRides ? <IonSpinner name="dots" /> : "Exportar viajes y cumplimiento laboral a Excel"}
            </IonButton>
          </IonCardContent>
        </IonCard>

        {!loading && !loadError && (
          <IonText color="medium">
            <p style={{ fontSize: "0.78rem", margin: "0 0 10px" }}>
              {rides.length} viaje{rides.length !== 1 ? "s" : ""} encontrado
              {rides.length !== 1 ? "s" : ""}
            </p>
          </IonText>
        )}

        {loading && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              paddingTop: "40px",
            }}
          >
            <IonSpinner name="crescent" />
          </div>
        )}

        {loadError && (
          <IonText color="danger">
            <p>{loadError}</p>
          </IonText>
        )}
        {cancelError && (
          <IonText color="danger">
            <p style={{ fontSize: "0.85rem" }}>{cancelError}</p>
          </IonText>
        )}

        {!loading && !loadError && rides.length === 0 && (
          <IonText color="medium">
            <p>No se encontraron viajes.</p>
          </IonText>
        )}

        {!loading && rides.length > 0 && (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            {rides.map((ride, rideIndex) => {
              const scheduleInfo = getAdminRideScheduleInfo(ride);
              const effectiveStatus = getEffectiveAdminRideStatus(ride);
              const statusColor =
                RIDE_STATUS_COLOR_ADMIN[effectiveStatus] ?? "medium";
              const statusLabel =
                RIDE_STATUS_LABEL_ADMIN[effectiveStatus] ?? effectiveStatus;
              const adminPassengerNote = getAdminPassengerNote(ride);
              const adminPromotionLabel = getAdminRidePromotionLabel(ride);
              const airportWelcomeInfo = getAdminRideAirportWelcomeInfo(ride);
              const assignedDriverName = String(
                getRideUnknownField(ride, "assignedDriverName") ?? ride.driverName ?? "",
              ).trim();
              const adminAutoAssignedAt = String(
                getRideUnknownField(ride, "autoAssignedAt") ?? getRideUnknownField(ride, "autoReassignedAt") ?? "",
              ).trim();
              const adminAutoAssignMessage = String(
                getRideUnknownField(ride, "adminAutoAssignMessage") ?? "",
              ).trim();
              const adminDriverRejectionReason = String(
                getRideUnknownField(ride, "adminLastDriverRejectionReason") ??
                  getRideUnknownField(ride, "adminDriverRejectionReason") ??
                  getRideUnknownField(ride, "driverRejectionReason") ??
                  "",
              ).trim();
              const adminRejectedDriverName = String(
                getRideUnknownField(ride, "adminLastRejectedDriverName") ??
                  getRideUnknownField(ride, "lastRejectedByDriverName") ??
                  "Conductor",
              ).trim();
              const adminDriverRejectedAt = String(
                getRideUnknownField(ride, "lastRejectedByDriverAt") ??
                  getRideUnknownField(ride, "rejectedAt") ??
                  "",
              ).trim();
              const wasAutoAssignedBySystem = Boolean(
                adminAutoAssignedAt ||
                  String(getRideUnknownField(ride, "autoAssignedBy") ?? getRideUnknownField(ride, "autoReassignedBy") ?? "")
                    .toLowerCase()
                    .includes("admin_auto"),
              );
              const scheduledAtMs = scheduleInfo.displayScheduledAt
                ? Date.parse(scheduleInfo.displayScheduledAt)
                : Number.NaN;
              const alertaSoon =
                scheduleInfo.isScheduled &&
                !hasAdminAssignedDriver(ride) &&
                Number.isFinite(scheduledAtMs) &&
                scheduledAtMs >= Date.now() &&
                scheduledAtMs <= Date.now() + 2 * 60 * 60 * 1000;
              return (
                <IonCard
                  key={`${String(ride.id || getRideUnknownField(ride, "rideId") || getRideUnknownField(ride, "originalRideId") || "admin-ride")}::${rideIndex}`}
                  style={{ margin: 0 }}
                >
                  <IonCardContent style={{ padding: "12px 14px" }}>
                    <AdminTripLiveRouteMap ride={ride} height={210} />

                    {/* Alerta reserva próxima sin conductor */}
                    {alertaSoon && (
                      <div style={{
                        display:      "flex",
                        alignItems:   "center",
                        gap:          "6px",
                        padding:      "8px 10px",
                        background:   "var(--ion-color-danger-tint, #fde8e8)",
                        borderRadius: "8px",
                        marginTop:    "8px",
                        fontSize:     "0.8rem",
                        color:        "var(--ion-color-danger)",
                        fontWeight:   600,
                      }}>
                        <IonIcon icon={warningOutline} style={{ fontSize: "1rem", flexShrink: 0 }} />
                        Reserva próxima sin conductor asignado
                      </div>
                    )}

                    {/* Header */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: "8px",
                        marginBottom: "8px",
                        marginTop: "8px",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: "0.88rem",
                            marginBottom: "2px",
                          }}
                        >
                          {ride.originText} → {ride.destinationText}
                        </div>
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--ion-color-medium)",
                            marginBottom: "4px",
                          }}
                        >
                          Pasajero: {ride.passengerName} ({ride.passengerEmail})
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "4px",
                          }}
                        >
                          <IonBadge
                            color={statusColor}
                            style={{ fontSize: "0.68rem" }}
                          >
                            {statusLabel}
                          </IonBadge>
                          {scheduleInfo.isScheduled && (
                            <IonBadge color={scheduleInfo.isActiveWindow ? "success" : "warning"} style={{ fontSize: "0.68rem" }}>
                              {scheduleInfo.isActiveWindow ? "Activar ahora" : "Reserva"}
                            </IonBadge>
                          )}
                        </div>
                      </div>
                      <div
                        style={{
                          fontSize: "0.68rem",
                          color: "var(--ion-color-medium)",
                          flexShrink: 0,
                          textAlign: "right",
                        }}
                      >
                        {formatAdminScheduleDate(scheduleInfo.scheduledAt ?? ride.requestedAt)}
                      </div>
                    </div>

                    {scheduleInfo.isScheduled && (
                      <div
                        style={{
                          background: scheduleInfo.isActiveWindow ? "rgba(42,168,74,.12)" : "rgba(255,201,40,.18)",
                          border: scheduleInfo.isActiveWindow ? "1px solid rgba(42,168,74,.30)" : "1px solid rgba(255,201,40,.45)",
                          borderRadius: "14px",
                          padding: "10px 12px",
                          marginBottom: "8px",
                          fontSize: "0.78rem",
                          lineHeight: 1.35,
                          color: "#111",
                        }}
                      >
                        <strong>{scheduleInfo.isReturnOnlyPromotion ? "🔁 Regreso de experiencia" : "📅 Reserva agendada"}</strong>
                        {scheduleInfo.isReturnOnlyPromotion ? (
                          <div>Regreso: {formatAdminScheduleDate(scheduleInfo.returnScheduledAt ?? scheduleInfo.displayScheduledAt)}</div>
                        ) : (
                          <div>Recogida: {formatAdminScheduleDate(scheduleInfo.scheduledAt)}</div>
                        )}
                        {!scheduleInfo.isReturnOnlyPromotion && scheduleInfo.returnScheduledAt && (
                          <div>Regreso: {formatAdminScheduleDate(scheduleInfo.returnScheduledAt)}</div>
                        )}
                        <div>
                          Activación: {formatAdminScheduleDate(scheduleInfo.activationAt)} · {scheduleInfo.isActiveWindow
                            ? "habilitada para buscar conductores disponibles."
                            : scheduleInfo.isReturnOnlyPromotion
                              ? "el admin debe asignar conductor para el regreso."
                              : `se buscarán conductores ${SCHEDULE_ACTIVATION_MINUTES_ADMIN} min antes.`}
                        </div>
                      </div>
                    )}

                    {scheduleInfo.isScheduled && adminDriverRejectionReason && (
                      <div
                        style={{
                          background: "rgba(220,38,38,.10)",
                          border: "1px solid rgba(220,38,38,.34)",
                          borderRadius: "14px",
                          padding: "10px 12px",
                          marginBottom: "8px",
                          fontSize: "0.78rem",
                          lineHeight: 1.4,
                          color: "#7F1D1D",
                          fontWeight: 850,
                        }}
                      >
                        <strong>🚫 Conductor rechazó la reserva</strong>
                        <div>
                          Conductor: <strong>{adminRejectedDriverName}</strong>
                        </div>
                        <div>
                          Motivo: <strong>{adminDriverRejectionReason}</strong>
                        </div>
                        {adminDriverRejectedAt && (
                          <div>
                            Fecha: {formatAdminScheduleDate(adminDriverRejectedAt)}
                          </div>
                        )}
                        <div>
                          La reserva sigue activa y pasa al siguiente conductor disponible.
                        </div>
                      </div>
                    )}

                    {scheduleInfo.isScheduled && assignedDriverName && wasAutoAssignedBySystem && (
                      <div
                        style={{
                          background: "rgba(34,197,94,.12)",
                          border: "1px solid rgba(34,197,94,.32)",
                          borderRadius: "14px",
                          padding: "10px 12px",
                          marginBottom: "8px",
                          fontSize: "0.78rem",
                          lineHeight: 1.35,
                          color: "#064E3B",
                          fontWeight: 850,
                        }}
                      >
                        <strong>✅ Asignación automática realizada</strong>
                        <div>
                          Conductor asignado: <strong>{assignedDriverName}</strong>
                        </div>
                        {adminAutoAssignedAt && (
                          <div>
                            Fecha: {formatAdminScheduleDate(adminAutoAssignedAt)}
                          </div>
                        )}
                        <div>
                          {adminAutoAssignMessage || "El sistema encontró un conductor disponible y le envió esta reserva para confirmación."}
                        </div>
                      </div>
                    )}

                    {airportWelcomeInfo && (
                      <div
                        style={{
                          background: "linear-gradient(135deg,rgba(255,240,246,.98),rgba(255,228,238,.98))",
                          border: "1px solid rgba(236,72,153,.30)",
                          borderRadius: "14px",
                          padding: "10px 12px",
                          marginBottom: "8px",
                          fontSize: "0.78rem",
                          lineHeight: 1.35,
                          color: "#831843",
                          fontWeight: 850,
                        }}
                      >
                        <strong>🌺 {airportWelcomeInfo.label} solicitado</strong>
                        <div>Admin debe gestionar el recibimiento del pasajero en Mataveri.</div>
                        <div>Recargo incluido en tarifa: <strong>{formatAdminCashClp(airportWelcomeInfo.amountClp)}</strong>.</div>
                      </div>
                    )}

                    {scheduleInfo.isScheduled && !hasAdminAssignedDriver(ride) && (
                      <IonButton
                        expand="block"
                        size="small"
                        color="primary"
                        style={{ marginBottom: "8px", fontWeight: 900 }}
                        onClick={() => goToAvailableDriversFromRide(ride)}
                      >
                        {scheduleInfo.isReturnOnlyPromotion
                          ? "Gestionar regreso con conductor"
                          : "Administrar y agendar conductor disponible"}
                      </IonButton>
                    )}

                    {scheduleInfo.isScheduled && effectiveStatus === "scheduled" && (
                      <IonButton
                        expand="block"
                        size="small"
                        color="warning"
                        style={{ marginBottom: "8px", fontWeight: 900 }}
                        disabled={activatingId === ride.id}
                        onClick={() => handleActivateScheduledRide(ride)}
                      >
                        {activatingId === ride.id ? <IonSpinner name="dots" /> : "Activar solicitud ahora"}
                      </IonButton>
                    )}

                    {scheduleInfo.isScheduled && effectiveStatus === "requested" && !hasAdminAssignedDriver(ride) && (
                      <IonButton
                        expand="block"
                        size="small"
                        color="success"
                        style={{ marginBottom: "8px", fontWeight: 900 }}
                        onClick={() => goToAvailableDriversFromRide(ride)}
                      >
                        {scheduleInfo.isReturnOnlyPromotion
                          ? "Buscar conductor para regreso"
                          : "Buscar conductores disponibles"}
                      </IonButton>
                    )}

                    {/* Details */}
                    {adminPassengerNote && (
                      <div
                        style={{
                          marginBottom: "8px",
                          borderRadius: "14px",
                          border: "1px solid rgba(210,164,58,.46)",
                          background: "linear-gradient(135deg,#fff9e8,#ffe7a6)",
                          color: "#111",
                          padding: "10px 11px",
                          overflowWrap: "anywhere",
                        }}
                        aria-label="Nota del pasajero"
                      >
                        <div
                          style={{
                            color: "#8a6418",
                            fontSize: ".68rem",
                            fontWeight: 950,
                            textTransform: "uppercase",
                            letterSpacing: ".04em",
                          }}
                        >
                          📝 Nota del pasajero
                        </div>
                        <div
                          style={{
                            marginTop: 5,
                            fontSize: ".80rem",
                            lineHeight: 1.4,
                            fontWeight: 800,
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {adminPassengerNote}
                        </div>
                      </div>
                    )}
                    {adminPromotionLabel && (
                      <div
                        style={{
                          marginBottom: "8px",
                          borderRadius: "14px",
                          border: "1px solid rgba(124,58,237,.28)",
                          background: "linear-gradient(135deg,#f5f3ff,#ede9fe)",
                          color: "#3b0764",
                          padding: "10px 11px",
                          fontSize: ".78rem",
                          lineHeight: 1.35,
                          fontWeight: 850,
                        }}
                      >
                        <strong>🗺️ Experiencia con reserva</strong>
                        <div style={{ marginTop: 4 }}>{adminPromotionLabel}</div>
                      </div>
                    )}
                    {ride.estimatedFareClp != null && (
                      <div
                        style={{
                          fontSize: "0.78rem",
                          fontWeight: 500,
                          marginBottom: "4px",
                        }}
                      >
                        Tarifa est.: $
                        {ride.estimatedFareClp.toLocaleString("es-CL")} CLP
                      </div>
                    )}
                    {(ride.driverName || getRideUnknownField(ride, "assignedDriverName")) && (
                      <div style={{ fontSize: "0.78rem", marginBottom: "4px" }}>
                        Conductor: <strong>{ride.driverName || String(getRideUnknownField(ride, "assignedDriverName") ?? "")}</strong>
                      </div>
                    )}

                    {/* Dates */}
                    <div
                      style={{
                        fontSize: "0.72rem",
                        color: "var(--ion-color-medium)",
                        marginBottom: "8px",
                      }}
                    >
                      {ride.acceptedAt && (
                        <div>
                          Asignado:{" "}
                          {new Date(ride.acceptedAt).toLocaleString("es-CL")}
                        </div>
                      )}
                      {ride.enRouteAt && (
                        <div>
                          En camino:{" "}
                          {new Date(ride.enRouteAt).toLocaleString("es-CL")}
                        </div>
                      )}
                      {ride.arrivedAt && (
                        <div>
                          Llegó:{" "}
                          {new Date(ride.arrivedAt).toLocaleString("es-CL")}
                        </div>
                      )}
                      {ride.startedAt && (
                        <div>
                          Iniciado:{" "}
                          {new Date(ride.startedAt).toLocaleString("es-CL")}
                        </div>
                      )}
                      {ride.completedAt && (
                        <div>
                          Completado:{" "}
                          {new Date(ride.completedAt).toLocaleString("es-CL")}
                        </div>
                      )}
                      {ride.cancelledAt && (
                        <div>
                          Cancelado:{" "}
                          {new Date(ride.cancelledAt).toLocaleString("es-CL")}
                        </div>
                      )}
                      {ride.cancellationReason && (
                        <div style={{ color: "var(--ion-color-danger)" }}>
                          Motivo: {ride.cancellationReason}
                        </div>
                      )}
                    </div>

                    {/* WhatsApp contacts */}
                    {ride.driverUserId && ride.driverName && (
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          flexWrap: "wrap",
                          marginTop: "6px",
                        }}
                      >
                        <WhatsAppButton
                          phone={RAPAGO_SUPPORT_WHATSAPP_PHONE}
                          message={WA_MESSAGES.adminToDriver({
                            driverName: ride.driverName,
                            origin: ride.originText,
                            destination: ride.destinationText,
                            passengerName: ride.passengerName,
                            passengerPhone: "",
                          })}
                          label="WhatsApp conductor"
                        />
                        <WhatsAppButton
                          phone={RAPAGO_SUPPORT_WHATSAPP_PHONE}
                          message={WA_MESSAGES.passengerToAdmin({
                            origin: ride.originText,
                            destination: ride.destinationText,
                            name: ride.passengerName,
                          })}
                          label="WhatsApp pasajero"
                        />
                      </div>
                    )}

                    {/* Cancel — for cancelable statuses */}
                    {CANCELABLE_STATUSES.has(effectiveStatus) && (
                      <div style={{ marginTop: "6px" }}>
                        <IonButton
                          expand="block"
                          size="small"
                          fill="outline"
                          color="danger"
                          disabled={cancellingId === ride.id}
                          onClick={() => {
                            setCancelAlertId(ride.id);
                            setCancelError(null);
                          }}
                        >
                          {cancellingId === ride.id ? (
                            <IonSpinner name="dots" />
                          ) : (
                            "Cancelar viaje"
                          )}
                        </IonButton>
                      </div>
                    )}
                  </IonCardContent>
                </IonCard>
              );
            })}
          </div>
        )}

        {/* Cancel alert */}
        <IonAlert
          isOpen={cancelAlertId !== null}
          header="Cancelar viaje"
          message="Ingresa el motivo de cancelación (obligatorio, mín. 3 caracteres)."
          inputs={[
            {
              name: "reason",
              type: "textarea",
              placeholder: "Motivo de cancelación...",
            },
          ]}
          buttons={[
            {
              text: "Volver",
              role: "cancel",
              handler: () => setCancelAlertId(null),
            },
            {
              text: "Cancelar viaje",
              handler: (data: { reason?: string }) => {
                const reason = (data.reason ?? "").trim();
                if (cancelAlertId && reason.length >= 3) {
                  void handleCancel(cancelAlertId, reason);
                } else {
                  setCancelError("El motivo debe tener al menos 3 caracteres.");
                }
              },
            },
          ]}
          onDidDismiss={() => {
            if (cancellingId === null) setCancelAlertId(null);
          }}
        />

        <IonToast
          isOpen={autoAssignToast !== null}
          message={autoAssignToast ?? ""}
          duration={3200}
          color="success"
          onDidDismiss={() => setAutoAssignToast(null)}
        />

        <IonToast
          isOpen={exportToast !== null}
          message={exportToast ?? ""}
          duration={3600}
          color="success"
          onDidDismiss={() => setExportToast(null)}
        />
      </IonContent>
    </IonPage>
  );
}

const OFFLINE_STATUS_LABEL: Record<string, string> = {
  pending_sync: "Pendiente",
  synced: "Sincronizado",
  cancelled: "Cancelado",
};
const OFFLINE_STATUS_COLOR: Record<string, string> = {
  pending_sync: "warning",
  synced: "success",
  cancelled: "medium",
};

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function AdminOfflineBookingsPage(): JSX.Element {
  const { session } = useAuth();
  const token = session?.accessToken ?? "";

  const [bookings, setBookings] = useState<OfflineBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [actionError, setActionError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Create form state
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    passengerName: "",
    passengerPhone: "",
    originText: "",
    destinationText: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadBookings = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setLoadError(null);
    try {
      const status = filterStatus !== "all" ? filterStatus : undefined;
      const data = await offlineService.listOfflineBookings(token, status);
      setBookings(data);
    } catch (err) {
      setLoadError(
        err instanceof Error
          ? err.message
          : "Error al cargar reservas offline.",
      );
    } finally {
      setLoading(false);
    }
  }, [token, filterStatus]);

  useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

  async function handleCreate() {
    if (
      !form.passengerName.trim() ||
      !form.passengerPhone.trim() ||
      !form.originText.trim() ||
      !form.destinationText.trim()
    ) {
      setFormError("Nombre, teléfono, origen y destino son obligatorios.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await offlineService.createOfflineBooking(token, {
        passengerName: form.passengerName.trim(),
        passengerPhone: form.passengerPhone.trim(),
        originText: form.originText.trim(),
        destinationText: form.destinationText.trim(),
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      });
      setToast("Reserva offline creada.");
      setShowForm(false);
      setForm({
        passengerName: "",
        passengerPhone: "",
        originText: "",
        destinationText: "",
        notes: "",
      });
      await loadBookings();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Error al crear reserva.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(id: string) {
    setActionError(null);
    try {
      await offlineService.cancelOfflineBooking(token, id);
      setToast("Reserva cancelada.");
      await loadBookings();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Error al cancelar.");
    }
  }

  const [syncingId, setSyncingId] = useState<string | null>(null);

  async function handleSync(bookingId: string) {
    setSyncingId(bookingId);
    setActionError(null);
    try {
      const ride = await adminService.syncOfflineBookingToRide(
        token,
        bookingId,
      );
      setToast(`Viaje creado: #${ride.id.slice(0, 8)}`);
      await loadBookings();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Error al sincronizar.",
      );
    } finally {
      setSyncingId(null);
    }
  }

  const filtered = bookings.filter(
    (b) => filterStatus === "all" || b.status === filterStatus,
  );

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="warning">
          <IonTitle style={{ color: "#000" }}>Viajes Offline</IonTitle>
          <div
            slot="end"
            style={{ paddingRight: "8px", display: "flex", gap: "4px" }}
          >
            <IonButton
              fill="clear"
              style={{ color: "#000" }}
              onClick={() => setShowForm((v) => !v)}
            >
              {showForm ? "Cerrar" : "+ Nueva"}
            </IonButton>
            <IonButton
              fill="clear"
              style={{ color: "#000" }}
              onClick={() => void loadBookings()}
              disabled={loading}
            >
              Actualizar
            </IonButton>
          </div>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <IonRefresher
          slot="fixed"
          onIonRefresh={async (e) => {
            await loadBookings();
            e.detail.complete();
          }}
        >
          <IonRefresherContent />
        </IonRefresher>

        {/* Info banner */}
        <IonCard
          style={{
            margin: "0 0 12px",
            background: "var(--ion-color-warning-tint)",
          }}
        >
          <IonCardContent style={{ padding: "10px 14px" }}>
            <IonText>
              <p style={{ fontSize: "0.82rem", margin: 0, color: "#6b4700" }}>
                Registra viajes coordinados por teléfono o WhatsApp cuando el
                pasajero no tiene conectividad. Sincroniza cada reserva con un
                viaje real cuando la conectividad se restablezca.
              </p>
            </IonText>
          </IonCardContent>
        </IonCard>

        {/* Create form */}
        {showForm && (
          <IonCard style={{ margin: "0 0 12px" }}>
            <IonCardContent style={{ padding: "12px 14px" }}>
              <strong
                style={{
                  fontSize: "0.95rem",
                  display: "block",
                  marginBottom: 10,
                }}
              >
                Nueva Reserva Offline
              </strong>
              <IonItem lines="full">
                <IonLabel position="stacked">Nombre del pasajero *</IonLabel>
                <IonInput
                  value={form.passengerName}
                  onIonInput={(e) =>
                    setForm((f) => ({
                      ...f,
                      passengerName: String(e.detail.value ?? ""),
                    }))
                  }
                  placeholder="Ej: María González"
                />
              </IonItem>
              <IonItem lines="full">
                <IonLabel position="stacked">Teléfono *</IonLabel>
                <IonInput
                  value={form.passengerPhone}
                  onIonInput={(e) =>
                    setForm((f) => ({
                      ...f,
                      passengerPhone: String(e.detail.value ?? ""),
                    }))
                  }
                  placeholder="+56 9 xxxx xxxx"
                  inputmode="tel"
                />
              </IonItem>
              <IonItem lines="full">
                <IonLabel position="stacked">Origen *</IonLabel>
                <IonInput
                  value={form.originText}
                  onIonInput={(e) =>
                    setForm((f) => ({
                      ...f,
                      originText: String(e.detail.value ?? ""),
                    }))
                  }
                  placeholder="Punto de recogida"
                />
              </IonItem>
              <IonItem lines="full">
                <IonLabel position="stacked">Destino *</IonLabel>
                <IonInput
                  value={form.destinationText}
                  onIonInput={(e) =>
                    setForm((f) => ({
                      ...f,
                      destinationText: String(e.detail.value ?? ""),
                    }))
                  }
                  placeholder="Destino final"
                />
              </IonItem>
              <IonItem lines="none">
                <IonLabel position="stacked">Notas</IonLabel>
                <IonInput
                  value={form.notes}
                  onIonInput={(e) =>
                    setForm((f) => ({
                      ...f,
                      notes: String(e.detail.value ?? ""),
                    }))
                  }
                  placeholder="Opcional"
                />
              </IonItem>
              {formError && (
                <IonText color="danger">
                  <p style={{ fontSize: "0.8rem", margin: "6px 0 0" }}>
                    {formError}
                  </p>
                </IonText>
              )}
              <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                <IonButton
                  expand="block"
                  style={{ flex: 1 }}
                  onClick={() => void handleCreate()}
                  disabled={submitting}
                >
                  {submitting ? (
                    <IonSpinner name="crescent" />
                  ) : (
                    "Crear reserva"
                  )}
                </IonButton>
                <IonButton
                  expand="block"
                  fill="outline"
                  color="medium"
                  style={{ flex: 1 }}
                  onClick={() => {
                    setShowForm(false);
                    setFormError(null);
                  }}
                >
                  Cancelar
                </IonButton>
              </div>
            </IonCardContent>
          </IonCard>
        )}

        {/* Filter */}
        <IonCard style={{ margin: "0 0 12px" }}>
          <IonCardContent style={{ padding: "8px 12px" }}>
            <IonItem lines="none">
              <IonLabel>Estado</IonLabel>
              <IonSelect
                interface="action-sheet"
                value={filterStatus}
                onIonChange={(e) =>
                  setFilterStatus(String(e.detail.value ?? "all"))
                }
              >
                <IonSelectOption value="all">Todos</IonSelectOption>
                <IonSelectOption value="pending_sync">
                  Pendientes
                </IonSelectOption>
                <IonSelectOption value="synced">Sincronizados</IonSelectOption>
                <IonSelectOption value="cancelled">Cancelados</IonSelectOption>
              </IonSelect>
            </IonItem>
          </IonCardContent>
        </IonCard>

        {actionError && (
          <IonText color="danger">
            <p style={{ fontSize: "0.82rem" }}>{actionError}</p>
          </IonText>
        )}

        {!loading && !loadError && (
          <IonText color="medium">
            <p style={{ fontSize: "0.78rem", margin: "0 0 10px" }}>
              {filtered.length} reserva{filtered.length !== 1 ? "s" : ""}{" "}
              encontrada{filtered.length !== 1 ? "s" : ""}
            </p>
          </IonText>
        )}

        {loading && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              paddingTop: "40px",
            }}
          >
            <IonSpinner name="crescent" />
          </div>
        )}
        {loadError && (
          <IonText color="danger">
            <p>{loadError}</p>
          </IonText>
        )}

        {filtered.length === 0 && !loading && !loadError && (
          <IonItem lines="none">
            <IonLabel color="medium" className="ion-text-center">
              No hay reservas offline{" "}
              {filterStatus !== "all"
                ? `con estado "${OFFLINE_STATUS_LABEL[filterStatus] ?? filterStatus}"`
                : ""}
              .
            </IonLabel>
          </IonItem>
        )}

        {!loading && filtered.length > 0 && (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "10px" }}
          >
            {filtered.map((b) => (
              <IonCard key={b.id} style={{ margin: 0 }}>
                <IonCardContent style={{ padding: "12px 14px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: 6,
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: "1rem" }}>
                        {b.passengerName}
                      </strong>
                      <IonNote style={{ display: "block", fontSize: "0.8rem" }}>
                        {b.passengerPhone}
                      </IonNote>
                    </div>
                    <IonBadge
                      color={OFFLINE_STATUS_COLOR[b.status] ?? "medium"}
                    >
                      {OFFLINE_STATUS_LABEL[b.status] ?? b.status}
                    </IonBadge>
                  </div>

                  <IonNote style={{ display: "block", marginBottom: 2 }}>
                    <strong>Origen:</strong> {b.originText}
                  </IonNote>
                  <IonNote style={{ display: "block", marginBottom: 2 }}>
                    <strong>Destino:</strong> {b.destinationText}
                  </IonNote>
                  {b.notes && (
                    <IonNote style={{ display: "block", marginBottom: 2 }}>
                      Notas: {b.notes}
                    </IonNote>
                  )}
                  {b.syncedToRideId && (
                    <IonChip
                      color="success"
                      style={{
                        marginTop: 4,
                        height: "20px",
                        fontSize: "0.72rem",
                      }}
                    >
                      Viaje: {b.syncedToRideId.slice(0, 8)}...
                    </IonChip>
                  )}
                  <IonNote
                    style={{
                      display: "block",
                      fontSize: "0.73rem",
                      marginTop: 6,
                    }}
                  >
                    Creado: {fmtDateTime(b.createdAt)}
                  </IonNote>

                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      marginTop: "10px",
                      flexWrap: "wrap",
                    }}
                  >
                    <WhatsAppButton
                      phone={b.passengerPhone}
                      message={WA_MESSAGES.adminToOfflinePassenger({
                        passengerName: b.passengerName,
                      })}
                      label="WhatsApp pasajero"
                    />
                    {b.status === "pending_sync" && (
                      <>
                        <IonButton
                          size="small"
                          color="success"
                          onClick={() => void handleSync(b.id)}
                          disabled={syncingId === b.id}
                        >
                          {syncingId === b.id ? (
                            <IonSpinner name="dots" />
                          ) : (
                            "Sincronizar a viaje"
                          )}
                        </IonButton>
                        <IonButton
                          size="small"
                          fill="outline"
                          color="danger"
                          onClick={() => void handleCancel(b.id)}
                          disabled={syncingId === b.id}
                        >
                          Cancelar
                        </IonButton>
                      </>
                    )}
                  </div>
                </IonCardContent>
              </IonCard>
            ))}
          </div>
        )}

        <IonToast
          isOpen={toast !== null}
          message={toast ?? ""}
          duration={2500}
          onDidDismiss={() => setToast(null)}
          color="success"
        />
      </IonContent>
    </IonPage>
  );
}

export function AdminPaymentsPage(): JSX.Element {
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="danger">
          <IonTitle>Pagos y devoluciones</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <CashOverpaymentRefundAdminPanel />
      </IonContent>
    </IonPage>
  );
}

export function AdminSettingsPage(): JSX.Element {
  const history = useHistory();

  const sections = [
    {
      title: "Tarifas",
      description: "Precios por km, tarifa mínima y tarifas fijas por ruta.",
      icon: cashOutline,
      route: ROUTES.ADMIN.FARE_SETTINGS,
      color: "primary",
      disabled: false,
    },
    {
      title: "Documentos Legales",
      description: "Términos, política de privacidad y condiciones por rol.",
      icon: shieldCheckmarkOutline,
      route: ROUTES.ADMIN.LEGAL_DOCUMENTS,
      color: "warning",
      disabled: false,
    },
    {
      title: "Pagos y Transacciones",
      description: "Órdenes de pago, wallets y conciliación.",
      icon: cardOutline,
      route: ROUTES.ADMIN.PAYMENTS,
      color: "success",
      disabled: false,
    },
    {
      title: "Referidos y Campañas",
      description: "Códigos de referido, descuentos y campañas promocionales.",
      icon: giftOutline,
      route: ROUTES.ADMIN.REFERRALS,
      color: "tertiary",
      disabled: false,
    },
  ] as const;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Configuración</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <p
          style={{
            fontSize: "0.85rem",
            color: "var(--ion-color-medium)",
            marginBottom: "16px",
          }}
        >
          Ajustes del sistema RAPA GO. Cambios aplicados de forma inmediata.
        </p>

        {sections.map((s) => (
          <IonCard
            key={s.route}
            button={!s.disabled}
            onClick={() => {
              if (!s.disabled) history.push(s.route);
            }}
            style={{ marginBottom: "12px", opacity: s.disabled ? 0.55 : 1 }}
          >
            <IonCardContent>
              <div
                style={{ display: "flex", alignItems: "center", gap: "14px" }}
              >
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "10px",
                    background: `var(--ion-color-${s.color}-tint)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <IonIcon
                    icon={s.icon}
                    style={{
                      fontSize: "22px",
                      color: `var(--ion-color-${s.color})`,
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "600", fontSize: "0.95rem" }}>
                    {s.title}
                  </div>
                  <div
                    style={{
                      fontSize: "0.78rem",
                      color: "var(--ion-color-medium)",
                      marginTop: "2px",
                    }}
                  >
                    {s.description}
                  </div>
                </div>
                <IonIcon
                  icon={chevronForward}
                  style={{ color: "var(--ion-color-medium)", fontSize: "18px" }}
                />
              </div>
            </IonCardContent>
          </IonCard>
        ))}
      </IonContent>
    </IonPage>
  );
}

type AdminFareRow = {
  key: string;
  title: string;
  type: string;
  group: "variable" | "fixed";
  minimumClp?: number | null;
  kmClp?: number | null;
  fixedClp?: number | null;
  description: string;
  active: boolean;
};

const CLP_PER_USD_REFERENCE = 1000;
const ADMIN_FARES_STORAGE_KEY = "rapago_admin_fare_rows_v2";

const DEFAULT_ADMIN_FARE_ROWS: AdminFareRow[] = [
  {
    key: "general_minimum",
    title: "Tarifa general mínima (0 a 2 kms)",
    type: "minimum_fare",
    group: "variable",
    minimumClp: 5000,
    kmClp: null,
    description: "Precio mínimo general para viajes de 0 a 2 kilómetros.",
    active: true,
  },
  {
    key: "general_km",
    title: "Tarifa general por km (con mínimo)",
    type: "mobility_per_km",
    group: "variable",
    minimumClp: null,
    kmClp: 1000,
    description: "Precio CLP por kilómetro después del mínimo.",
    active: true,
  },
  {
    key: "resident",
    title: "Tarifa residentes (idéntica a la general)",
    type: "resident_rate",
    group: "variable",
    minimumClp: 5000,
    kmClp: 1000,
    description: "Tarifa base para residentes.",
    active: true,
  },
  {
    key: "chilean",
    title: "Tarifa chilenos (13% adicional)",
    type: "chilean_rate",
    group: "variable",
    minimumClp: 5650,
    kmClp: 1130,
    description: "Tarifa para visitantes chilenos con 13% adicional.",
    active: true,
  },
  {
    key: "foreigner",
    title: "Tarifa extranjeros (20% adicional)",
    type: "foreigner_rate",
    group: "variable",
    minimumClp: 6000,
    kmClp: 1200,
    description: "Tarifa para visitantes extranjeros con 20% adicional.",
    active: true,
  },
  {
    key: "xl_resident",
    title: "Tarifa vehículo XL (residentes) 40% adicional",
    type: "xl_resident_rate",
    group: "variable",
    minimumClp: 7000,
    kmClp: 1400,
    description: "Tarifa XL para residentes.",
    active: true,
  },
  {
    key: "xl_chilean",
    title: "Tarifa vehículo XL (chilenos) 40% + 13%",
    type: "xl_chilean_rate",
    group: "variable",
    minimumClp: 7910,
    kmClp: 1582,
    description: "Tarifa XL para visitantes chilenos.",
    active: true,
  },
  {
    key: "xl_foreigner",
    title: "Tarifa vehículo XL (extranjeros) 40% + 20%",
    type: "xl_foreigner_rate",
    group: "variable",
    minimumClp: 8400,
    kmClp: 1680,
    description: "Tarifa XL para visitantes extranjeros.",
    active: true,
  },
  {
    key: "luggage_resident",
    title: "Tarifa vehículo extra maletas residentes (25% adicional)",
    type: "luggage_resident_rate",
    group: "variable",
    minimumClp: 6250,
    kmClp: 1250,
    description: "Tarifa con espacio extra para maletas de residentes.",
    active: true,
  },
  {
    key: "luggage_chilean",
    title: "Tarifa vehículo extra maletas chilenos (25% + 13%)",
    type: "luggage_chilean_rate",
    group: "variable",
    minimumClp: 7063,
    kmClp: 1413,
    description:
      "Tarifa con espacio extra para maletas de visitantes chilenos.",
    active: true,
  },
  {
    key: "luggage_foreigner",
    title: "Tarifa vehículo extra maletas extranjeros (25% + 20%)",
    type: "luggage_foreigner_rate",
    group: "variable",
    minimumClp: 7500,
    kmClp: 1500,
    description:
      "Tarifa con espacio extra para maletas de visitantes extranjeros.",
    active: true,
  },
  {
    key: "anakena_resident_roundtrip",
    title: "Tarifa destino Anakena residentes ida y vuelta",
    type: "anakena_resident_roundtrip",
    group: "fixed",
    fixedClp: 38000,
    description: "Tarifa fija ida y vuelta a Anakena para residentes.",
    active: true,
  },
  {
    key: "anakena_chilean_roundtrip",
    title: "Tarifa destino Anakena chilenos ida y vuelta",
    type: "anakena_chilean_roundtrip",
    group: "fixed",
    fixedClp: 42940,
    description: "Tarifa fija ida y vuelta a Anakena para visitantes chilenos.",
    active: true,
  },
  {
    key: "anakena_foreigner_roundtrip",
    title: "Tarifa destino Anakena extranjeros ida y vuelta",
    type: "anakena_foreigner_roundtrip",
    group: "fixed",
    fixedClp: 45600,
    description:
      "Tarifa fija ida y vuelta a Anakena para visitantes extranjeros.",
    active: true,
  },
  {
    key: "terevaka_resident_roundtrip",
    title: "Tarifa destino Terevaka residentes ida y vuelta",
    type: "terevaka_resident_roundtrip",
    group: "fixed",
    fixedClp: 20000,
    description: "Tarifa fija ida y vuelta a Terevaka para residentes.",
    active: true,
  },
  {
    key: "terevaka_chilean_roundtrip",
    title: "Tarifa destino Terevaka chilenos ida y vuelta",
    type: "terevaka_chilean_roundtrip",
    group: "fixed",
    fixedClp: 22600,
    description:
      "Tarifa fija ida y vuelta a Terevaka para visitantes chilenos.",
    active: true,
  },
  {
    key: "terevaka_foreigner_roundtrip",
    title: "Tarifa destino Terevaka extranjeros ida y vuelta",
    type: "terevaka_foreigner_roundtrip",
    group: "fixed",
    fixedClp: 24000,
    description:
      "Tarifa fija ida y vuelta a Terevaka para visitantes extranjeros.",
    active: true,
  },
];

function getApiBaseUrl(): string {
  return getConfiguredApiOrigin();
}

function buildAdminApiUrl(path: string): string {
  const baseUrl = getApiBaseUrl().replace(/\/$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  if (baseUrl.endsWith("/api") && cleanPath.startsWith("/api/")) {
    return `${baseUrl}${cleanPath.slice(4)}`;
  }

  return `${baseUrl}${cleanPath}`;
}

function formatFareClp(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  return `$${Math.max(0, Math.round(Number(value))).toLocaleString("es-CL")} CLP`;
}

function formatFareUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  const usd = Math.max(0, Number(value)) / CLP_PER_USD_REFERENCE;
  return `USD ${usd.toLocaleString("es-CL", { maximumFractionDigits: 1, minimumFractionDigits: usd % 1 === 0 ? 0 : 1 })}`;
}

function parseClpText(value: string): number {
  const digits = value.replace(/\D/g, "");
  const parsed = Number(digits || 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

function formatClpInput(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return "";
  return Math.max(0, Math.round(Number(value))).toLocaleString("es-CL");
}

function storedFareValueToClp(value: number | null | undefined): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;

  // El backend antiguo puede guardar CLP en centavos: 230000 = $2.300.
  // En pantalla siempre mostramos $2.300, no el número grande.
  return numeric > 10000 ? Math.round(numeric / 100) : Math.round(numeric);
}

function clpToStoredFareValue(value: number): number {
  // Mantiene compatibilidad con el backend existente que espera centavos CLP.
  return Math.max(0, Math.round(value)) * 100;
}

function readStoredAdminFareRows(): AdminFareRow[] | null {
  try {
    const raw = localStorage.getItem(ADMIN_FARES_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AdminFareRow[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function saveStoredAdminFareRows(rows: AdminFareRow[]): void {
  try {
    localStorage.setItem(ADMIN_FARES_STORAGE_KEY, JSON.stringify(rows));
  } catch {
    // No bloquea la pantalla si localStorage no está disponible.
  }
}

function mergeBackendFareRows(
  defaultRows: AdminFareRow[],
  backendRows: unknown,
): AdminFareRow[] {
  const rows = Array.isArray(backendRows)
    ? backendRows
    : Array.isArray((backendRows as { items?: unknown[] })?.items)
      ? ((backendRows as { items?: unknown[] }).items as unknown[])
      : [];

  if (rows.length === 0) return defaultRows;

  return defaultRows.map((row) => {
    const backend = rows.find((item) => {
      const candidate = item as { type?: string; name?: string; key?: string };
      return (
        candidate.type === row.type ||
        candidate.name === row.title ||
        candidate.key === row.key
      );
    }) as
      { value?: number; isActive?: boolean; description?: string } | undefined;

    if (!backend) return row;

    const clp = storedFareValueToClp(backend.value);

    if (clp == null) {
      return {
        ...row,
        active: backend.isActive ?? row.active,
        description: backend.description ?? row.description,
      };
    }

    if (row.group === "fixed") {
      return {
        ...row,
        fixedClp: clp,
        active: backend.isActive ?? row.active,
        description: backend.description ?? row.description,
      };
    }

    if (row.type === "mobility_per_km" || row.key.includes("km")) {
      return {
        ...row,
        kmClp: clp,
        active: backend.isActive ?? row.active,
        description: backend.description ?? row.description,
      };
    }

    return {
      ...row,
      minimumClp: clp,
      active: backend.isActive ?? row.active,
      description: backend.description ?? row.description,
    };
  });
}

export function AdminFareSettingsPage(): JSX.Element {
  const { session } = useAuth();
  const token = session?.accessToken;

  const [rows, setRows] = useState<AdminFareRow[]>(
    () => readStoredAdminFareRows() ?? DEFAULT_ADMIN_FARE_ROWS,
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<AdminFareRow | null>(null);

  const loadFareRows = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const stored = readStoredAdminFareRows();

      if (!token) {
        setRows(stored ?? DEFAULT_ADMIN_FARE_ROWS);
        return;
      }

      const response = await fetch(
        buildAdminApiUrl("/api/fare-settings/active"),
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        setRows(stored ?? DEFAULT_ADMIN_FARE_ROWS);
        return;
      }

      const data = await response.json();
      const merged = mergeBackendFareRows(
        stored ?? DEFAULT_ADMIN_FARE_ROWS,
        data,
      );
      setRows(merged);
      saveStoredAdminFareRows(merged);
    } catch {
      setRows(readStoredAdminFareRows() ?? DEFAULT_ADMIN_FARE_ROWS);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadFareRows();
  }, [loadFareRows]);

  async function persistRow(row: AdminFareRow): Promise<void> {
    const nextRows = rows.map((item) => (item.key === row.key ? row : item));
    setRows(nextRows);
    saveStoredAdminFareRows(nextRows);

    if (!token) return;

    const rowValue =
      row.group === "fixed" ? row.fixedClp : (row.kmClp ?? row.minimumClp);

    if (rowValue == null) return;

    try {
      await fetch(buildAdminApiUrl("/api/fare-settings"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: row.type,
          name: row.title,
          value: clpToStoredFareValue(rowValue),
          description: row.description,
          isActive: row.active,
          currency: "CLP",
        }),
      });
    } catch {
      // La UI queda guardada localmente aunque el backend no tenga aún este endpoint.
    }
  }

  async function handleSaveEdit(): Promise<void> {
    if (!editingRow) return;

    const cleaned: AdminFareRow = {
      ...editingRow,
      minimumClp:
        editingRow.minimumClp == null
          ? null
          : Math.max(0, Math.round(editingRow.minimumClp)),
      kmClp:
        editingRow.kmClp == null
          ? null
          : Math.max(0, Math.round(editingRow.kmClp)),
      fixedClp:
        editingRow.fixedClp == null
          ? null
          : Math.max(0, Math.round(editingRow.fixedClp)),
    };

    setSaving(true);
    setError(null);

    try {
      await persistRow(cleaned);
      setSuccess("Tarifa actualizada correctamente.");
      setEditingRow(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo guardar la tarifa.",
      );
    } finally {
      setSaving(false);
    }
  }

  function renderFareRow(row: AdminFareRow): JSX.Element {
    return (
      <tr key={row.key}>
        <td
          style={{
            padding: "10px",
            borderBottom: "1px solid rgba(0,0,0,.12)",
            fontWeight: 850,
          }}
        >
          {row.title}
          <div style={{ color: "#666", fontSize: ".72rem", marginTop: 3 }}>
            {row.description}
          </div>
        </td>
        <td
          style={{
            padding: "10px",
            borderBottom: "1px solid rgba(0,0,0,.12)",
            textAlign: "right",
            fontWeight: 900,
          }}
        >
          {formatFareClp(row.group === "fixed" ? row.fixedClp : row.minimumClp)}
        </td>
        <td
          style={{
            padding: "10px",
            borderBottom: "1px solid rgba(0,0,0,.12)",
            textAlign: "right",
          }}
        >
          {formatFareUsd(row.group === "fixed" ? row.fixedClp : row.minimumClp)}
        </td>
        {row.group === "variable" && (
          <>
            <td
              style={{
                padding: "10px",
                borderBottom: "1px solid rgba(0,0,0,.12)",
                textAlign: "right",
                fontWeight: 900,
              }}
            >
              {formatFareClp(row.kmClp)}
            </td>
            <td
              style={{
                padding: "10px",
                borderBottom: "1px solid rgba(0,0,0,.12)",
                textAlign: "right",
              }}
            >
              {formatFareUsd(row.kmClp)}
            </td>
          </>
        )}
        <td
          style={{
            padding: "10px",
            borderBottom: "1px solid rgba(0,0,0,.12)",
            textAlign: "center",
          }}
        >
          <IonBadge color={row.active ? "success" : "medium"}>
            {row.active ? "Activa" : "Inactiva"}
          </IonBadge>
        </td>
        <td
          style={{
            padding: "10px",
            borderBottom: "1px solid rgba(0,0,0,.12)",
            textAlign: "right",
          }}
        >
          <IonButton
            size="small"
            fill="outline"
            color="warning"
            onClick={() => setEditingRow(row)}
          >
            Editar
          </IonButton>
        </td>
      </tr>
    );
  }

  const variableRows = rows.filter((row) => row.group === "variable");
  const fixedRows = rows.filter((row) => row.group === "fixed");

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="danger">
          <IonTitle>Tarifas</IonTitle>
          <div slot="end" style={{ paddingRight: "8px" }}>
            <IonButton
              fill="clear"
              color="light"
              onClick={() => void loadFareRows()}
              disabled={loading}
            >
              Actualizar
            </IonButton>
          </div>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <IonRefresher
          slot="fixed"
          onIonRefresh={async (e) => {
            await loadFareRows();
            e.detail.complete();
          }}
        >
          <IonRefresherContent />
        </IonRefresher>

        <IonCard
          style={{
            margin: "0 0 14px",
            borderRadius: "18px",
            background: "#F6F2EC",
            color: "#111",
          }}
        >
          <IonCardHeader>
            <IonCardTitle style={{ fontWeight: 950 }}>
              Tabla de tarifas Rapa Go
            </IonCardTitle>
            <IonNote style={{ color: "#444", fontWeight: 750 }}>
              El admin escribe valores normales como 2.300 CLP. La pantalla
              calcula el dólar automáticamente y nunca muestra el valor interno
              grande en centavos.
            </IonNote>
          </IonCardHeader>
        </IonCard>

        {loading && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              paddingTop: "30px",
            }}
          >
            <IonSpinner name="crescent" />
          </div>
        )}

        {error && (
          <IonText color="danger">
            <p style={{ fontWeight: 900 }}>{error}</p>
          </IonText>
        )}
        {success && (
          <IonText color="success">
            <p style={{ fontWeight: 900 }}>{success}</p>
          </IonText>
        )}

        {!loading && (
          <>
            <IonCard
              style={{
                margin: "0 0 14px",
                borderRadius: "18px",
                overflow: "hidden",
              }}
            >
              <IonCardHeader>
                <IonCardTitle style={{ fontWeight: 950 }}>
                  Tarifas variables
                </IonCardTitle>
              </IonCardHeader>
              <IonCardContent style={{ overflowX: "auto", padding: 0 }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    minWidth: 860,
                    color: "#111",
                  }}
                >
                  <thead>
                    <tr style={{ background: "#fff8e6" }}>
                      <th
                        style={{
                          padding: "10px",
                          textAlign: "left",
                          borderBottom: "2px solid #d2a43a",
                        }}
                      >
                        Tipo
                      </th>
                      <th
                        style={{
                          padding: "10px",
                          textAlign: "right",
                          borderBottom: "2px solid #d2a43a",
                        }}
                      >
                        Tarifa mínima CLP
                      </th>
                      <th
                        style={{
                          padding: "10px",
                          textAlign: "right",
                          borderBottom: "2px solid #d2a43a",
                        }}
                      >
                        Dólar USD
                      </th>
                      <th
                        style={{
                          padding: "10px",
                          textAlign: "right",
                          borderBottom: "2px solid #d2a43a",
                        }}
                      >
                        Tarifa KM CLP
                      </th>
                      <th
                        style={{
                          padding: "10px",
                          textAlign: "right",
                          borderBottom: "2px solid #d2a43a",
                        }}
                      >
                        Dólar USD
                      </th>
                      <th
                        style={{
                          padding: "10px",
                          textAlign: "center",
                          borderBottom: "2px solid #d2a43a",
                        }}
                      >
                        Estado
                      </th>
                      <th
                        style={{
                          padding: "10px",
                          textAlign: "right",
                          borderBottom: "2px solid #d2a43a",
                        }}
                      >
                        Acción
                      </th>
                    </tr>
                  </thead>
                  <tbody>{variableRows.map(renderFareRow)}</tbody>
                </table>
              </IonCardContent>
            </IonCard>

            <IonCard
              style={{
                margin: "0 0 14px",
                borderRadius: "18px",
                overflow: "hidden",
              }}
            >
              <IonCardHeader>
                <IonCardTitle style={{ fontWeight: 950 }}>
                  Tarifas fijas
                </IonCardTitle>
              </IonCardHeader>
              <IonCardContent style={{ overflowX: "auto", padding: 0 }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    minWidth: 680,
                    color: "#111",
                  }}
                >
                  <thead>
                    <tr style={{ background: "#fff8e6" }}>
                      <th
                        style={{
                          padding: "10px",
                          textAlign: "left",
                          borderBottom: "2px solid #d2a43a",
                        }}
                      >
                        Tipo
                      </th>
                      <th
                        style={{
                          padding: "10px",
                          textAlign: "right",
                          borderBottom: "2px solid #d2a43a",
                        }}
                      >
                        Tarifa fija CLP
                      </th>
                      <th
                        style={{
                          padding: "10px",
                          textAlign: "right",
                          borderBottom: "2px solid #d2a43a",
                        }}
                      >
                        Dólar USD
                      </th>
                      <th
                        style={{
                          padding: "10px",
                          textAlign: "center",
                          borderBottom: "2px solid #d2a43a",
                        }}
                      >
                        Estado
                      </th>
                      <th
                        style={{
                          padding: "10px",
                          textAlign: "right",
                          borderBottom: "2px solid #d2a43a",
                        }}
                      >
                        Acción
                      </th>
                    </tr>
                  </thead>
                  <tbody>{fixedRows.map(renderFareRow)}</tbody>
                </table>
              </IonCardContent>
            </IonCard>
          </>
        )}

        <IonModal
          isOpen={editingRow !== null}
          onDidDismiss={() => setEditingRow(null)}
        >
          <IonHeader>
            <IonToolbar color="dark">
              <IonTitle>Editar tarifa</IonTitle>
              <div slot="end" style={{ paddingRight: 8 }}>
                <IonButton
                  fill="clear"
                  color="light"
                  onClick={() => setEditingRow(null)}
                >
                  Cerrar
                </IonButton>
              </div>
            </IonToolbar>
          </IonHeader>

          <IonContent className="ion-padding">
            {editingRow && (
              <IonCard
                style={{
                  margin: 0,
                  borderRadius: "18px",
                  background: "#F6F2EC",
                  color: "#111",
                }}
              >
                <IonCardHeader>
                  <IonCardTitle style={{ fontWeight: 950 }}>
                    {editingRow.title}
                  </IonCardTitle>
                  <IonNote style={{ color: "#444", fontWeight: 750 }}>
                    Escribe el precio real en CLP, por ejemplo 2.300. El sistema
                    calcula USD automáticamente.
                  </IonNote>
                </IonCardHeader>

                <IonCardContent>
                  {editingRow.group === "variable" && (
                    <>
                      <IonItem
                        lines="full"
                        style={
                          {
                            "--background": "#fff",
                            borderRadius: 14,
                            marginBottom: 12,
                          } as CSSProperties
                        }
                      >
                        <IonLabel position="stacked">
                          Tarifa mínima CLP
                        </IonLabel>
                        <IonInput
                          value={formatClpInput(editingRow.minimumClp)}
                          inputmode="numeric"
                          placeholder="Ej: 5.000"
                          onIonInput={(e) =>
                            setEditingRow({
                              ...editingRow,
                              minimumClp: parseClpText(
                                String(e.detail.value ?? ""),
                              ),
                            })
                          }
                        />
                        <IonNote slot="helper">
                          {formatFareUsd(editingRow.minimumClp)}
                        </IonNote>
                      </IonItem>

                      <IonItem
                        lines="full"
                        style={
                          {
                            "--background": "#fff",
                            borderRadius: 14,
                            marginBottom: 12,
                          } as CSSProperties
                        }
                      >
                        <IonLabel position="stacked">
                          Tarifa por KM CLP
                        </IonLabel>
                        <IonInput
                          value={formatClpInput(editingRow.kmClp)}
                          inputmode="numeric"
                          placeholder="Ej: 1.000"
                          onIonInput={(e) =>
                            setEditingRow({
                              ...editingRow,
                              kmClp: parseClpText(String(e.detail.value ?? "")),
                            })
                          }
                        />
                        <IonNote slot="helper">
                          {formatFareUsd(editingRow.kmClp)}
                        </IonNote>
                      </IonItem>
                    </>
                  )}

                  {editingRow.group === "fixed" && (
                    <IonItem
                      lines="full"
                      style={
                        {
                          "--background": "#fff",
                          borderRadius: 14,
                          marginBottom: 12,
                        } as CSSProperties
                      }
                    >
                      <IonLabel position="stacked">Tarifa fija CLP</IonLabel>
                      <IonInput
                        value={formatClpInput(editingRow.fixedClp)}
                        inputmode="numeric"
                        placeholder="Ej: 38.000"
                        onIonInput={(e) =>
                          setEditingRow({
                            ...editingRow,
                            fixedClp: parseClpText(
                              String(e.detail.value ?? ""),
                            ),
                          })
                        }
                      />
                      <IonNote slot="helper">
                        {formatFareUsd(editingRow.fixedClp)}
                      </IonNote>
                    </IonItem>
                  )}

                  <IonItem
                    lines="full"
                    style={
                      {
                        "--background": "#fff",
                        borderRadius: 14,
                        marginBottom: 12,
                      } as CSSProperties
                    }
                  >
                    <IonLabel position="stacked">Descripción</IonLabel>
                    <IonInput
                      value={editingRow.description}
                      onIonInput={(e) =>
                        setEditingRow({
                          ...editingRow,
                          description: String(e.detail.value ?? ""),
                        })
                      }
                    />
                  </IonItem>

                  <IonItem
                    lines="none"
                    style={
                      {
                        "--background": "#fff",
                        borderRadius: 14,
                        marginBottom: 14,
                      } as CSSProperties
                    }
                  >
                    <IonLabel>Tarifa activa</IonLabel>
                    <IonSelect
                      value={editingRow.active ? "yes" : "no"}
                      interface="action-sheet"
                      onIonChange={(e) =>
                        setEditingRow({
                          ...editingRow,
                          active: String(e.detail.value) === "yes",
                        })
                      }
                    >
                      <IonSelectOption value="yes">Activa</IonSelectOption>
                      <IonSelectOption value="no">Inactiva</IonSelectOption>
                    </IonSelect>
                  </IonItem>

                  <IonButton
                    expand="block"
                    color="warning"
                    onClick={() => void handleSaveEdit()}
                    disabled={saving}
                    style={
                      {
                        "--border-radius": "16px",
                        height: "52px",
                        fontWeight: 950,
                      } as CSSProperties
                    }
                  >
                    {saving ? <IonSpinner name="crescent" /> : "Guardar tarifa"}
                  </IonButton>

                  <IonButton
                    expand="block"
                    fill="outline"
                    color="medium"
                    onClick={() => setEditingRow(null)}
                    style={
                      {
                        marginTop: 8,
                        "--border-radius": "16px",
                      } as CSSProperties
                    }
                  >
                    Cancelar
                  </IonButton>
                </IonCardContent>
              </IonCard>
            )}
          </IonContent>
        </IonModal>
      </IonContent>
    </IonPage>
  );
}


type AdminDriverApplicationReviewStatus =
  | "pending"
  | "under_review"
  | "approved"
  | "rejected"
  | "on_hold";

type AdminDriverApplicationFile = {
  provided?: boolean;
  fileName?: string | null;
  fileType?: string | null;
  fileSize?: number | null;
  dataUrl?: string | null;
};

type AdminDriverApplicationVehicle = {
  id?: string | null;
  order?: number | null;
  primary?: boolean | null;
  ownership?: string | null;
  brand?: string | null;
  model?: string | null;
  year?: string | null;
  plate?: string | null;
  color?: string | null;
  label?: string | null;
  imageDataUrl?: string | null;
  imageName?: string | null;
  expiresAt?: string | null;
  approvedStatus?: string | null;
  photoProvided?: boolean | null;
  photoFileName?: string | null;
  photoFileType?: string | null;
  photoFileSize?: number | null;
};

type AdminDriverApplicationRecord = {
  id: string;
  type: "driver";
  status: AdminDriverApplicationReviewStatus;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  rut?: string | null;
  birthDate?: string | null;
  belongsToRapaNuiEthnicity?: boolean | null;
  ethnicityDeclaration?: string | null;
  submittedAt?: string | null;
  updatedAt?: string | null;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  rejectionReason?: string | null;
  holdReason?: string | null;
  documents?: {
    identityCardFront?: AdminDriverApplicationFile | null;
    identityCardBack?: AdminDriverApplicationFile | null;
    driverLicense?: AdminDriverApplicationFile | null;
    vehiclePhoto?: AdminDriverApplicationFile | null;
    vehiclePhotos?: AdminDriverApplicationFile[] | null;
  } | null;
  vehicle?: {
    hasOwnVehicle?: boolean | null;
    principalVehicleRequired?: boolean | null;
    selectedVehicleId?: string | null;
    description?: string | null;
    brand?: string | null;
    model?: string | null;
    year?: string | null;
    plate?: string | null;
    color?: string | null;
    photoDataUrl?: string | null;
    totalVehicles?: number | null;
    vehicles?: AdminDriverApplicationVehicle[] | null;
  } | null;
  legalAcceptance?: Record<string, unknown> | null;
};

const LOCAL_ADMIN_DRIVER_APPLICATIONS_KEY = "rapago_admin_driver_applications_v1";
const LOCAL_ADMIN_DRIVER_APPLICATION_EVENT = "rapago:admin-driver-application-updated";

const DRIVER_APP_STATUS_LABEL: Record<AdminDriverApplicationReviewStatus, string> = {
  pending: "Pendiente",
  under_review: "En revisión",
  approved: "Aprobada",
  rejected: "Rechazada",
  on_hold: "En espera",
};

const DRIVER_APP_STATUS_COLOR: Record<AdminDriverApplicationReviewStatus, string> = {
  pending: "warning",
  under_review: "tertiary",
  approved: "success",
  rejected: "danger",
  on_hold: "medium",
};

function readAdminDriverApplicationRecords(): AdminDriverApplicationRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_ADMIN_DRIVER_APPLICATIONS_KEY);
    const parsed = raw ? (JSON.parse(raw) as AdminDriverApplicationRecord[]) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => item?.type === "driver") : [];
  } catch {
    return [];
  }
}

function saveAdminDriverApplicationRecords(items: AdminDriverApplicationRecord[]): void {
  try {
    localStorage.setItem(LOCAL_ADMIN_DRIVER_APPLICATIONS_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent(LOCAL_ADMIN_DRIVER_APPLICATION_EVENT));
  } catch {
    // No bloquea el panel admin.
  }
}

function getDriverApplicationFullName(item: AdminDriverApplicationRecord): string {
  const full = String(item.name ?? "").trim();
  if (full) return full;

  return `${String(item.firstName ?? "").trim()} ${String(item.lastName ?? "").trim()}`.trim() || "Conductor sin nombre";
}

function getDriverApplicationVehicles(item: AdminDriverApplicationRecord): AdminDriverApplicationVehicle[] {
  const vehicles = item.vehicle?.vehicles;
  if (Array.isArray(vehicles) && vehicles.length > 0) return vehicles;

  if (!item.vehicle) return [];

  return [
    {
      id: item.vehicle.selectedVehicleId ?? "vehicle-primary",
      order: 1,
      primary: true,
      ownership: "own",
      brand: item.vehicle.brand ?? "",
      model: item.vehicle.model ?? "",
      year: item.vehicle.year ?? "",
      plate: item.vehicle.plate ?? "",
      color: item.vehicle.color ?? "",
      label: item.vehicle.description ?? "",
      imageDataUrl: item.vehicle.photoDataUrl ?? item.documents?.vehiclePhoto?.dataUrl ?? null,
      imageName: item.documents?.vehiclePhoto?.fileName ?? null,
      photoProvided: Boolean(item.vehicle.photoDataUrl ?? item.documents?.vehiclePhoto?.dataUrl),
    },
  ].filter((vehicle) => Boolean(vehicle.brand || vehicle.model || vehicle.plate || vehicle.imageDataUrl));
}

function getDriverApplicationVehicleLabel(vehicle: AdminDriverApplicationVehicle): string {
  return (
    vehicle.label ||
    [vehicle.brand, vehicle.model, vehicle.year, vehicle.color, vehicle.plate]
      .map((value) => String(value ?? "").trim())
      .filter(Boolean)
      .join(" ") ||
    "Vehículo sin datos"
  );
}

function getDriverApplicationFileLabel(file: AdminDriverApplicationFile | null | undefined): string {
  if (!file?.provided && !file?.dataUrl && !file?.fileName) return "No adjuntado";
  return file.fileName || "Archivo adjunto";
}

function openDriverApplicationFile(file: AdminDriverApplicationFile | null | undefined): void {
  const url = file?.dataUrl;
  if (!url) return;

  try {
    const tab = window.open();
    if (tab) {
      tab.document.write(`<iframe src="${url}" style="border:0;width:100%;height:100vh"></iframe>`);
      tab.document.title = file?.fileName || "Documento RAPA GO";
      return;
    }
  } catch {
    // Si el navegador bloquea popup, intenta abrir directo.
  }

  try {
    window.open(url, "_blank");
  } catch {
    // No bloquea el panel admin.
  }
}

function isImageDataUrl(value: string | null | undefined): boolean {
  return String(value ?? "").startsWith("data:image/");
}

function publishApprovedDriverApplicationToProfile(item: AdminDriverApplicationRecord): void {
  const vehicles = getDriverApplicationVehicles(item).map((vehicle, index) => ({
    ...vehicle,
    approvedStatus: "approved",
    primary: index === 0 ? true : Boolean(vehicle.primary),
  }));

  const primaryVehicle = vehicles[0] ?? null;
  const ownerKey = String(item.email ?? item.id ?? "driver-global").toLowerCase().trim();
  const fullName = getDriverApplicationFullName(item);
  const now = new Date().toISOString();

  const profile = {
    ownerKey,
    driverOwnerKey: ownerKey,
    name: fullName,
    firstName: item.firstName ?? "",
    lastName: item.lastName ?? "",
    email: item.email ?? "",
    phone: item.phone ?? "",
    rut: item.rut ?? "",
    birthDate: item.birthDate ?? "",
    driverApplicationStatus: "approved",
    role: "driver",
    status: "active",
    isVerified: true,
    is_verified: true,
    vehicleBrand: primaryVehicle?.brand ?? "",
    vehicleModel: primaryVehicle?.model ?? "",
    vehicleYear: primaryVehicle?.year ?? "",
    vehiclePlate: primaryVehicle?.plate ?? "",
    vehicleColor: primaryVehicle?.color ?? "",
    vehicleImageDataUrl: primaryVehicle?.imageDataUrl ?? item.vehicle?.photoDataUrl ?? "",
    vehicleImageName: primaryVehicle?.imageName ?? "",
    updatedAt: now,
  };

  const publicVehicle = {
    ...(primaryVehicle ?? {}),
    ownerKey,
    driverOwnerKey: ownerKey,
    driverName: fullName,
    driverFullName: fullName,
    driverEmail: item.email ?? "",
    driverPhone: item.phone ?? "",
    driverVehicleBrand: primaryVehicle?.brand ?? null,
    driverVehicleModel: primaryVehicle?.model ?? null,
    driverVehicleYear: primaryVehicle?.year ?? null,
    driverVehicleColor: primaryVehicle?.color ?? null,
    driverVehiclePlate: primaryVehicle?.plate ?? null,
    driverVehicleOwnership: primaryVehicle?.ownership ?? "own",
    driverVehicleImageDataUrl: primaryVehicle?.imageDataUrl ?? item.vehicle?.photoDataUrl ?? null,
    driverVehicleImageName: primaryVehicle?.imageName ?? null,
    vehicleBrand: primaryVehicle?.brand ?? null,
    vehicleModel: primaryVehicle?.model ?? null,
    vehicleYear: primaryVehicle?.year ?? null,
    vehicleColor: primaryVehicle?.color ?? null,
    vehiclePlate: primaryVehicle?.plate ?? null,
    vehicleImageDataUrl: primaryVehicle?.imageDataUrl ?? item.vehicle?.photoDataUrl ?? null,
    vehiclePhotoDataUrl: primaryVehicle?.imageDataUrl ?? item.vehicle?.photoDataUrl ?? null,
    applicationStatus: "approved",
    role: "driver",
    status: "active",
    isVerified: true,
    is_verified: true,
    updatedAt: now,
  };

  try {
    const profileJson = JSON.stringify(profile);
    const vehiclesJson = JSON.stringify(vehicles);
    const publicJson = JSON.stringify(publicVehicle);

    localStorage.setItem("rapago_registration_profile", profileJson);
    localStorage.setItem("rapago_driver_registration_profile", profileJson);
    localStorage.setItem("rapago_driver_vehicles_v1", vehiclesJson);
    localStorage.setItem("rapago_driver_selected_vehicle_v1", primaryVehicle?.id ?? "vehicle-primary");
    localStorage.setItem("rapago_driver_active_vehicle_v1", publicJson);
    localStorage.setItem("rapago_driver_public_vehicle_v1", publicJson);
    localStorage.setItem("rapago_driver_public_profile_v1", publicJson);
    localStorage.setItem("rapago_driver_public_snapshot_v1", publicJson);
    localStorage.setItem("rapago_selected_vehicle_v1", publicJson);
    localStorage.setItem("rapago_selected_driver_vehicle_v1", publicJson);

    if (item.phone) localStorage.setItem("rapago_driver_phone", item.phone);
    if (item.rut) localStorage.setItem("rapago_driver_rut", item.rut);

    const profilesRaw = localStorage.getItem("rapago_driver_public_profiles_v1");
    const profiles = profilesRaw ? (JSON.parse(profilesRaw) as Record<string, unknown>) : {};
    profiles[ownerKey] = publicVehicle;
    localStorage.setItem("rapago_driver_public_profiles_v1", JSON.stringify(profiles));

    window.dispatchEvent(new CustomEvent("rapago:driver-public-profile-updated", { detail: publicVehicle }));
    window.dispatchEvent(new CustomEvent("rapago:driver-selected-vehicle-updated", { detail: publicVehicle }));
    window.dispatchEvent(new CustomEvent("rapago:admin-refresh-drivers"));
  } catch {
    // No bloquea la aprobación si localStorage está lleno.
  }
}

const DOC_STATUS_COLOR: Record<string, string> = {
  pending: "warning",
  uploaded: "primary",
  approved: "success",
  rejected: "danger",
  withdrawn: "medium",
};

const DOC_STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  uploaded: "Subido",
  approved: "Aprobado",
  rejected: "Rechazado",
  withdrawn: "Retirado por el usuario",
};

const DOC_TYPE_LABEL: Record<string, string> = {
  residence_document: "ACREDITACIÓN RESIDENCIA",
  rapa_nui_residence: "ACREDITACIÓN RESIDENCIA",
  rapanui_residence: "ACREDITACIÓN RESIDENCIA",
  resident_certificate: "ACREDITACIÓN RESIDENCIA",
  identity_document: "Cédula de identidad",
  driver_license: "Licencia de conducir",
  vehicle_registration: "Registro de vehículo",
  vehicle_insurance: "Seguro del vehículo",
  guide_certification: "Certificación de guía",
  business_registration: "Registro de empresa",
  vehicle_ownership: "Propiedad del vehículo",
};

export function AdminDocumentsPage(): JSX.Element {
  const { session } = useAuth();

  const [docs, setDocs] = useState<AdminDocumentData[]>([]);
  const [users, setUsers] = useState<AdminUserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");

  const [actionId, setActionId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(
    null,
  );
  const [rejectReason, setRejectReason] = useState("");
  const [rejectFareType, setRejectFareType] = useState<
    "chilean" | "foreigner"
  >("chilean");
  const [actioning, setActioning] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [driverApplications, setDriverApplications] = useState<AdminDriverApplicationRecord[]>([]);
  const [filterApplicationStatus, setFilterApplicationStatus] = useState<AdminDriverApplicationReviewStatus | "all">("all");
  const [selectedDriverApplication, setSelectedDriverApplication] = useState<AdminDriverApplicationRecord | null>(null);
  const [applicationReviewReason, setApplicationReviewReason] = useState("");

  const refreshDriverApplications = useCallback(() => {
    setDriverApplications(readAdminDriverApplicationRecords());
  }, []);

  const loadDocs = useCallback(async () => {
    if (!session?.accessToken) return;

    setLoading(true);
    setLoadError(null);

    try {
      const params: { status?: string; documentType?: string } = {};

      if (filterStatus) params.status = filterStatus;
      if (filterType) params.documentType = filterType;

      const [documentData, userData] = await Promise.all([
        adminService.listDocuments(session.accessToken, params),
        adminService
          .listUsers(session.accessToken, {})
          .catch(() => [] as AdminUserData[]),
      ]);

      setDocs(documentData);
      setUsers(userData);
      setDriverApplications(readAdminDriverApplicationRecords());
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Error al cargar documentos.",
      );
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, filterStatus, filterType]);

  useEffect(() => {
    void loadDocs();
  }, [loadDocs]);

  useEffect(() => {
    refreshDriverApplications();

    window.addEventListener("storage", refreshDriverApplications);
    window.addEventListener(LOCAL_ADMIN_DRIVER_APPLICATION_EVENT, refreshDriverApplications as EventListener);

    return () => {
      window.removeEventListener("storage", refreshDriverApplications);
      window.removeEventListener(LOCAL_ADMIN_DRIVER_APPLICATION_EVENT, refreshDriverApplications as EventListener);
    };
  }, [refreshDriverApplications]);

  function findDocumentUser(doc: AdminDocumentData): AdminUserData | null {
    const extendedDoc = doc as ExtendedAdminDocumentData;
    const docUserId = String(extendedDoc.userId ?? "").trim();
    const docEmail = normalizeAdminText(extendedDoc.userEmail);

    return (
      users.find((user) => user.id === docUserId) ??
      users.find((user) => normalizeAdminText(user.email) === docEmail) ??
      null
    );
  }

  async function activateUserIfResidenceDocument(doc: AdminDocumentData) {
    if (!session?.accessToken || !isResidenceDocument(doc)) return null;

    const user = findDocumentUser(doc);

    if (!user) {
      throw new Error(
        "Documento aprobado, pero no encontré el usuario asociado.",
      );
    }

    const updatedUser = await adminService.updateUserStatus(
      session.accessToken,
      user.id,
      "active",
    );

    setUsers((prev) =>
      prev.map((item) => (item.id === updatedUser.id ? updatedUser : item)),
    );

    return updatedUser;
  }

  async function keepUserActiveIfResidenceRejected(doc: AdminDocumentData) {
    if (!session?.accessToken || !isResidenceDocument(doc)) return null;

    const user = findDocumentUser(doc);
    if (!user) return null;

    const updatedUser = await adminService.updateUserStatus(
      session.accessToken,
      user.id,
      "active",
    );

    setUsers((prev) =>
      prev.map((item) => (item.id === updatedUser.id ? updatedUser : item)),
    );

    return updatedUser;
  }

  async function handleApprove(docId: string) {
    if (!session?.accessToken) return;

    const doc = docs.find((item) => item.id === docId);
    if (!doc) return;

    setActioning(true);
    setActionError(null);

    try {
      const updated = await adminService.reviewDocument(
        session.accessToken,
        docId,
        "approved",
      );

      setDocs((prev) => prev.map((d) => (d.id === docId ? updated : d)));

      if (isResidenceDocument(updated)) {
        await activateUserIfResidenceDocument(updated);
        setToastMessage(
          "Acreditación aprobada. La cuenta permanece activa como RAPA NUI / RESIDENTE RAPA NUI.",
        );
      } else {
        setToastMessage("Documento aprobado.");
      }
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Error al aprobar el documento de residencia.",
      );
    } finally {
      setActioning(false);
      setActionId(null);
      setActionType(null);
    }
  }

  async function handleReject() {
    if (!session?.accessToken || !actionId) return;

    if (!rejectReason.trim()) {
      setActionError("El motivo de rechazo es obligatorio.");
      return;
    }

    const doc = docs.find((item) => item.id === actionId);
    if (!doc) return;

    if (
      isResidenceDocument(doc) &&
      rejectFareType !== "chilean" &&
      rejectFareType !== "foreigner"
    ) {
      setActionError(
        "Debes elegir Turista chileno o Turista extranjero.",
      );
      return;
    }

    setActioning(true);
    setActionError(null);

    try {
      const passengerRejectMessage = `${RAPANUI_RESIDENCE_REJECTION_USER_MESSAGE} Motivo: ${rejectReason.trim()}`;

      const updated = await adminService.reviewDocument(
        session.accessToken,
        actionId,
        "rejected",
        isResidenceDocument(doc) ? passengerRejectMessage : rejectReason.trim(),
        isResidenceDocument(doc) ? rejectFareType : undefined,
      );

      setDocs((prev) => prev.map((d) => (d.id === actionId ? updated : d)));

      if (isResidenceDocument(updated)) {
        await keepUserActiveIfResidenceRejected(updated);
        setToastMessage(
          `Acreditación rechazada. La categoría cambió a ${
            rejectFareType === "foreigner"
              ? "Turista extranjero"
              : "Turista chileno"
          }.`,
        );
      } else {
        setToastMessage("Documento rechazado.");
      }

      setRejectReason("");
      setRejectFareType("chilean");
      setActionId(null);
      setActionType(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Error al rechazar.");
    } finally {
      setActioning(false);
    }
  }

  async function handleDriverApplicationReview(
    applicationId: string,
    status: AdminDriverApplicationReviewStatus,
  ): Promise<void> {
    const now = new Date().toISOString();
    const currentItems = readAdminDriverApplicationRecords();
    const item = currentItems.find((application) => application.id === applicationId);
    if (!item) return;

    if ((status === "rejected" || status === "on_hold") && !applicationReviewReason.trim()) {
      setActionError(
        status === "rejected"
          ? "Debes escribir el motivo de rechazo."
          : "Debes escribir qué falta para dejarla en espera.",
      );
      return;
    }

    setActioning(true);
    setActionError(null);

    try {
      const reviewed: AdminDriverApplicationRecord = {
        ...item,
        status,
        updatedAt: now,
        reviewedAt: now,
        reviewedBy: (() => {
          const currentUser = session?.user && typeof session.user === "object"
            ? (session.user as Record<string, unknown>)
            : {};
          return String(currentUser.email ?? currentUser.name ?? "admin");
        })(),
        rejectionReason: status === "rejected" ? applicationReviewReason.trim() : item.rejectionReason ?? null,
        holdReason: status === "on_hold" ? applicationReviewReason.trim() : item.holdReason ?? null,
        vehicle: item.vehicle
          ? {
              ...item.vehicle,
              vehicles: getDriverApplicationVehicles(item).map((vehicle) => ({
                ...vehicle,
                approvedStatus: status,
              })),
            }
          : item.vehicle,
      };

      const nextItems = currentItems.map((application) =>
        application.id === applicationId ? reviewed : application,
      );

      saveAdminDriverApplicationRecords(nextItems);
      setDriverApplications(nextItems);

      if (status === "approved") {
        publishApprovedDriverApplicationToProfile(reviewed);

        const matchedUser = users.find(
          (user) =>
            normalizeAdminText(user.email) ===
            normalizeAdminText(reviewed.email),
        );

        if (matchedUser && session?.accessToken) {
          try {
            const updatedUser =
              await adminService.updateUserStatus(
                session.accessToken,
                matchedUser.id,
                "active",
              );

            const activeDriverUser = {
              ...updatedUser,
              role: "driver",
              status: "active",
              isVerified: true,
            } as AdminUserData;

            setUsers((prev) =>
              prev.map((user) =>
                user.id === updatedUser.id
                  ? activeDriverUser
                  : user,
              ),
            );
          } catch {
            // Si el backend no permite activar desde aquí,
            // la postulación igualmente queda aprobada localmente.
          }
        }

        setToastMessage(
          "Postulación de conductor aprobada. El perfil y vehículo quedaron habilitados. Su categoría tarifaria como pasajero no cambia automáticamente.",
        );
      } else if (status === "rejected") {
        setToastMessage("Postulación de conductor rechazada.");
      } else if (status === "on_hold") {
        setToastMessage("Postulación de conductor dejada en espera.");
      } else {
        setToastMessage("Postulación actualizada.");
      }

      setSelectedDriverApplication(null);
      setApplicationReviewReason("");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "No se pudo revisar la postulación.");
    } finally {
      setActioning(false);
    }
  }

  const pendingResidenceDocs = docs.filter(
    (doc) =>
      isResidenceDocument(doc) &&
      ["pending", "uploaded"].includes(String(doc.status)),
  ).length;

  const filteredDriverApplications = driverApplications.filter((item) =>
    filterApplicationStatus === "all" ? true : item.status === filterApplicationStatus,
  );

  const pendingDriverApplications = driverApplications.filter((item) =>
    ["pending", "under_review", "on_hold"].includes(item.status),
  ).length;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="danger">
          <IonTitle>Documentos</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <IonCard
          className="rapago-accent-card"
          style={{ margin: "0 0 12px", borderRadius: 18 }}
        >
          <IonCardContent style={{ padding: "14px 16px" }}>
            <div style={{ fontWeight: 950, fontSize: "1rem" }}>
              Documentos Rapa Nui
            </div>
            <p style={{ margin: "6px 0 0", fontSize: ".84rem", lineHeight: 1.35 }}>
              La categoría RAPA NUI / RESIDENTE RAPA NUI permanece activa durante la revisión. Al aprobar, se mantiene; al rechazar, el administrador elige Turista chileno o Turista extranjero.
            </p>
            <IonBadge color={pendingResidenceDocs > 0 ? "warning" : "success"} style={{ marginTop: 10 }}>
              {pendingResidenceDocs} residencia{pendingResidenceDocs !== 1 ? "s" : ""} pendiente{pendingResidenceDocs !== 1 ? "s" : ""}
            </IonBadge>
          </IonCardContent>
        </IonCard>


        <IonCard
          className="rapago-accent-card"
          style={{ margin: "0 0 12px", borderRadius: 18 }}
        >
          <IonCardContent style={{ padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 950, fontSize: "1rem" }}>
                  Postulaciones de conductores
                </div>
                <p style={{ margin: "6px 0 0", fontSize: ".84rem", lineHeight: 1.35 }}>
                  Revisa cédula, licencia, vehículos, fotos y datos enviados desde inscripción. Aprobar la postulación habilita al conductor, pero no cambia automáticamente su categoría tarifaria como pasajero.
                </p>
              </div>
              <IonBadge color={pendingDriverApplications > 0 ? "warning" : "success"}>
                {pendingDriverApplications} pendiente{pendingDriverApplications !== 1 ? "s" : ""}
              </IonBadge>
            </div>

            <IonItem
              lines="none"
              style={{ marginTop: 12, borderRadius: 14 }}
            >
              <IonLabel position="stacked" style={{ fontSize: ".76rem", fontWeight: 850 }}>
                Filtro de postulación
              </IonLabel>
              <IonSelect
                value={filterApplicationStatus}
                interface="popover"
                onIonChange={(e) =>
                  setFilterApplicationStatus(String(e.detail.value ?? "all") as AdminDriverApplicationReviewStatus | "all")
                }
              >
                <IonSelectOption value="all">Todas</IonSelectOption>
                <IonSelectOption value="pending">Pendientes</IonSelectOption>
                <IonSelectOption value="under_review">En revisión</IonSelectOption>
                <IonSelectOption value="on_hold">En espera</IonSelectOption>
                <IonSelectOption value="approved">Aprobadas</IonSelectOption>
                <IonSelectOption value="rejected">Rechazadas</IonSelectOption>
              </IonSelect>
            </IonItem>

            {filteredDriverApplications.length === 0 && (
              <div
                style={{
                  marginTop: 12,
                  background: "rgba(255,255,255,.08)",
                  borderRadius: 14,
                  padding: 12,
                  fontWeight: 850,
                }}
              >
                No hay postulaciones de conductor en este estado.
              </div>
            )}

            {filteredDriverApplications.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
                {filteredDriverApplications.map((application) => {
                  const vehicles = getDriverApplicationVehicles(application);
                  const primaryVehicle = vehicles[0] ?? null;
                  const status = application.status || "pending";

                  return (
                    <IonCard key={application.id} style={{ margin: 0, borderRadius: 16, background: "#F6F2EC", color: "#111" }}>
                      <IonCardContent style={{ padding: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 950, fontSize: ".95rem" }}>
                              {getDriverApplicationFullName(application)}
                            </div>
                            <div style={{ fontSize: ".76rem", color: "#555", fontWeight: 750, marginTop: 2 }}>
                              {application.email || "Email no informado"} · {application.phone || "Teléfono no informado"}
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                              <IonBadge color={DRIVER_APP_STATUS_COLOR[status]}>
                                {DRIVER_APP_STATUS_LABEL[status]}
                              </IonBadge>
                              <IonBadge color="primary">
                                {vehicles.length} vehículo{vehicles.length !== 1 ? "s" : ""}
                              </IonBadge>
                              {application.belongsToRapaNuiEthnicity && (
                                <IonBadge color="warning">Etnia Rapa Nui</IonBadge>
                              )}
                            </div>
                          </div>
                          <div style={{ fontSize: ".68rem", color: "#666", textAlign: "right", flexShrink: 0 }}>
                            {application.submittedAt
                              ? new Date(application.submittedAt).toLocaleDateString("es-CL")
                              : "Sin fecha"}
                          </div>
                        </div>

                        {primaryVehicle && (
                          <div
                            style={{
                              marginTop: 10,
                              display: "grid",
                              gridTemplateColumns: primaryVehicle.imageDataUrl ? "92px 1fr" : "1fr",
                              gap: 10,
                              alignItems: "center",
                              background: "#fff",
                              borderRadius: 14,
                              padding: 10,
                              border: "1px solid rgba(200,155,60,.25)",
                            }}
                          >
                            {primaryVehicle.imageDataUrl && isImageDataUrl(primaryVehicle.imageDataUrl) && (
                              <img
                                src={primaryVehicle.imageDataUrl}
                                alt="Vehículo principal"
                                style={{
                                  width: 92,
                                  height: 68,
                                  objectFit: "cover",
                                  borderRadius: 12,
                                  border: "1px solid rgba(0,0,0,.12)",
                                }}
                              />
                            )}
                            <div>
                              <div style={{ fontSize: ".68rem", color: "#8a6418", fontWeight: 950, textTransform: "uppercase" }}>
                                Vehículo principal
                              </div>
                              <div style={{ fontWeight: 950, marginTop: 2 }}>
                                {getDriverApplicationVehicleLabel(primaryVehicle)}
                              </div>
                              <div style={{ fontSize: ".76rem", color: "#555", fontWeight: 800, marginTop: 2 }}>
                                Patente: {primaryVehicle.plate || "No informada"} · Color: {primaryVehicle.color || "No informado"}
                              </div>
                            </div>
                          </div>
                        )}

                        <IonButton
                          expand="block"
                          color="warning"
                          onClick={() => {
                            setSelectedDriverApplication(application);
                            setApplicationReviewReason(application.rejectionReason ?? application.holdReason ?? "");
                            setActionError(null);
                          }}
                          style={{ marginTop: 10, "--border-radius": "14px", fontWeight: 950 } as CSSProperties}
                        >
                          Revisar postulación completa
                        </IonButton>
                      </IonCardContent>
                    </IonCard>
                  );
                })}
              </div>
            )}
          </IonCardContent>
        </IonCard>
        <IonCard style={{ margin: "0 0 12px" }}>
          <IonCardContent style={{ padding: "10px 12px" }}>
            <div style={{ display: "flex", gap: "8px" }}>
              <IonItem lines="none" style={{ flex: 1 }}>
                <IonLabel position="stacked" style={{ fontSize: "0.78rem" }}>
                  Estado
                </IonLabel>
                <IonSelect
                  value={filterStatus}
                  onIonChange={(e) =>
                    setFilterStatus(String(e.detail.value ?? ""))
                  }
                  placeholder="Todos"
                  interface="popover"
                >
                  <IonSelectOption value="">Todos</IonSelectOption>
                  <IonSelectOption value="pending">Pendiente</IonSelectOption>
                  <IonSelectOption value="uploaded">Subido</IonSelectOption>
                  <IonSelectOption value="approved">Aprobado</IonSelectOption>
                  <IonSelectOption value="rejected">Rechazado</IonSelectOption>
                </IonSelect>
              </IonItem>

              <IonItem lines="none" style={{ flex: 1 }}>
                <IonLabel position="stacked" style={{ fontSize: "0.78rem" }}>
                  Tipo
                </IonLabel>
                <IonSelect
                  value={filterType}
                  onIonChange={(e) =>
                    setFilterType(String(e.detail.value ?? ""))
                  }
                  placeholder="Todos"
                  interface="popover"
                >
                  <IonSelectOption value="">Todos</IonSelectOption>
                  <IonSelectOption value="residence_document">
                    Residencia Rapa Nui
                  </IonSelectOption>
                  <IonSelectOption value="identity_document">
                    Cédula
                  </IonSelectOption>
                  <IonSelectOption value="driver_license">
                    Licencia
                  </IonSelectOption>
                  <IonSelectOption value="vehicle_registration">
                    Reg. Vehículo
                  </IonSelectOption>
                  <IonSelectOption value="vehicle_insurance">
                    Seguro
                  </IonSelectOption>
                  <IonSelectOption value="guide_certification">
                    Cert. Guía
                  </IonSelectOption>
                  <IonSelectOption value="business_registration">
                    Reg. Empresa
                  </IonSelectOption>
                  <IonSelectOption value="vehicle_ownership">
                    Prop. Vehículo
                  </IonSelectOption>
                </IonSelect>
              </IonItem>
            </div>

            <IonButton
              expand="block"
              size="small"
              fill="outline"
              color="danger"
              style={{ marginTop: "8px" }}
              onClick={() => void loadDocs()}
              disabled={loading}
            >
              {loading ? <IonSpinner name="dots" /> : "Aplicar filtros"}
            </IonButton>
          </IonCardContent>
        </IonCard>

        {!loading && !loadError && (
          <IonText color="medium">
            <p style={{ fontSize: "0.78rem", margin: "0 0 10px" }}>
              {docs.length} documento{docs.length !== 1 ? "s" : ""} encontrado
              {docs.length !== 1 ? "s" : ""}
            </p>
          </IonText>
        )}

        {loading && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              paddingTop: "40px",
            }}
          >
            <IonSpinner name="crescent" />
          </div>
        )}

        {loadError && (
          <IonText color="danger">
            <p>{loadError}</p>
          </IonText>
        )}

        {!loading && !loadError && docs.length === 0 && (
          <IonText color="medium">
            <p>No se encontraron documentos.</p>
          </IonText>
        )}

        {!loading && docs.length > 0 && (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "10px" }}
          >
            {docs.map((doc) => {
              const extendedDoc = doc as ExtendedAdminDocumentData;
              const statusColor = DOC_STATUS_COLOR[String(doc.status)] ?? "medium";
              const statusLabel = DOC_STATUS_LABEL[String(doc.status)] ?? doc.status;
              const typeLabel =
                DOC_TYPE_LABEL[String(extendedDoc.documentType)] ??
                extendedDoc.documentType;
              const residentDoc = isResidenceDocument(doc);
              const linkedUser = findDocumentUser(doc);
              const residentMetadata =
                getResidentDocumentMetadata(doc);
              const documentPreviewUrl =
                getResidentDocumentPreviewUrl(doc);
              const documentIsImage = documentPreviewUrl.startsWith("data:image/");
              const documentIsPdf = documentPreviewUrl.startsWith("data:application/pdf");
              const documentDownloadName =
                residentMetadata?.documentName ||
                (documentIsPdf
                  ? "acreditacion-residencia.pdf"
                  : "acreditacion-residencia");
              const actioningThis = actioning && actionId === doc.id;

              return (
                <IonCard
                  key={doc.id}
                  style={{
                    margin: 0,
                    borderRadius: 18,
                    border: residentDoc
                      ? "1px solid rgba(255, 196, 9, .60)"
                      : "1px solid rgba(0,0,0,.07)",
                  }}
                >
                  <IonCardContent style={{ padding: "12px 14px" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: "8px",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 850,
                            fontSize: "0.9rem",
                            marginBottom: "2px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {extendedDoc.userName ?? linkedUser?.name ?? "Usuario no informado"}
                        </div>

                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--ion-color-medium)",
                            marginBottom: "4px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {extendedDoc.userEmail ?? linkedUser?.email ?? "Email no informado"}
                        </div>

                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "4px",
                            marginBottom: "4px",
                          }}
                        >
                          <IonBadge color="primary" style={{ fontSize: "0.68rem" }}>
                            {extendedDoc.userRole ?? linkedUser?.role ?? "usuario"}
                          </IonBadge>

                          <IonBadge color={statusColor} style={{ fontSize: "0.68rem" }}>
                            {statusLabel}
                          </IonBadge>

                          <IonBadge
                            color={residentDoc ? "warning" : "secondary"}
                            style={{ fontSize: "0.68rem" }}
                          >
                            {typeLabel}
                          </IonBadge>

                          {residentDoc && (
                            <IonBadge color="tertiary" style={{ fontSize: "0.68rem" }}>
                              Categoría activa · pendiente de revisión
                            </IonBadge>
                          )}
                        </div>

                        {(linkedUser || residentMetadata) && (
                          <div
                            style={{
                              marginTop: 8,
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr",
                              gap: 8,
                            }}
                          >
                            <div
                              style={{
                                background: "#f6f2ec",
                                borderRadius: 12,
                                padding: 8,
                              }}
                            >
                              <div style={{ fontSize: ".66rem", color: "#666", fontWeight: 800 }}>
                                Celular
                              </div>
                              <div style={{ fontSize: ".78rem", fontWeight: 900, color: "#111" }}>
                                {(linkedUser
                                  ? getPassengerPhone(linkedUser)
                                  : "") ||
                                  residentMetadata?.phone ||
                                  "No informado"}
                              </div>
                            </div>

                            <div
                              style={{
                                background: "#f6f2ec",
                                borderRadius: 12,
                                padding: 8,
                              }}
                            >
                              <div style={{ fontSize: ".66rem", color: "#666", fontWeight: 800 }}>
                                RUT
                              </div>
                              <div style={{ fontSize: ".78rem", fontWeight: 900, color: "#111" }}>
                                {(linkedUser
                                  ? getPassengerRut(linkedUser)
                                  : "") ||
                                  residentMetadata?.rut ||
                                  "No informado"}
                              </div>
                            </div>
                          </div>
                        )}

                        {documentIsImage && (
                          <img
                            src={documentPreviewUrl}
                            alt="Vista previa de la acreditación"
                            loading="lazy"
                            style={{
                              display: "block",
                              width: "100%",
                              maxWidth: 420,
                              maxHeight: 260,
                              objectFit: "contain",
                              marginTop: 10,
                              borderRadius: 14,
                              background: "#f3efe8",
                              border: "1px solid rgba(0,0,0,.10)",
                            }}
                          />
                        )}

                        {documentPreviewUrl && (
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 8,
                              marginTop: 6,
                            }}
                          >
                            <IonButton
                              size="small"
                              fill="clear"
                              color="primary"
                              onClick={() =>
                                window.open(
                                  documentPreviewUrl,
                                  "_blank",
                                  "noopener,noreferrer",
                                )
                              }
                            >
                              {documentIsPdf
                                ? "Abrir PDF"
                                : documentIsImage
                                  ? "Abrir imagen"
                                  : "Ver documento"}
                            </IonButton>

                            <a
                              href={documentPreviewUrl}
                              download={documentDownloadName}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                minHeight: 32,
                                padding: "0 10px",
                                fontSize: ".78rem",
                                fontWeight: 900,
                                textDecoration: "none",
                              }}
                            >
                              Descargar archivo
                            </a>
                          </div>
                        )}

                        {extendedDoc.rejectionReason && (
                          <div
                            style={{
                              fontSize: "0.72rem",
                              color: "var(--ion-color-danger)",
                              marginTop: "4px",
                            }}
                          >
                            Motivo: {extendedDoc.rejectionReason}
                          </div>
                        )}

                        {extendedDoc.reviewedAt && (
                          <div
                            style={{
                              fontSize: "0.68rem",
                              color: "var(--ion-color-medium)",
                              marginTop: "2px",
                            }}
                          >
                            Revisado:{" "}
                            {new Date(extendedDoc.reviewedAt).toLocaleDateString(
                              "es-CL",
                            )}
                          </div>
                        )}
                      </div>

                      <div
                        style={{
                          fontSize: "0.68rem",
                          color: "var(--ion-color-medium)",
                          flexShrink: 0,
                          textAlign: "right",
                        }}
                      >
                        {new Date(doc.createdAt).toLocaleDateString("es-CL")}
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: "10px",
                        borderTop: "1px solid var(--ion-color-light-shade)",
                        paddingTop: "8px",
                        display: "flex",
                        gap: "8px",
                      }}
                    >
                      <IonButton
                        size="small"
                        color="success"
                        fill="outline"
                        disabled={actioning || doc.status === "approved"}
                        onClick={() => void handleApprove(doc.id)}
                        style={{ flex: 1 }}
                      >
                        {actioningThis ? (
                          <IonSpinner name="dots" />
                        ) : residentDoc ? (
                          "Aprobar residencia"
                        ) : (
                          "Aprobar"
                        )}
                      </IonButton>

                      <IonButton
                        size="small"
                        color="danger"
                        fill="outline"
                        disabled={actioning || doc.status === "rejected"}
                        onClick={() => {
                          setActionId(doc.id);
                          setActionType("reject");
                          setRejectReason("");
                          setRejectFareType("chilean");
                          setActionError(null);
                        }}
                        style={{ flex: 1 }}
                      >
                        Rechazar
                      </IonButton>
                    </div>
                  </IonCardContent>
                </IonCard>
              );
            })}
          </div>
        )}


        <IonModal
          isOpen={selectedDriverApplication !== null}
          onDidDismiss={() => {
            setSelectedDriverApplication(null);
            setApplicationReviewReason("");
          }}
          breakpoints={[0, 0.72, 0.96]}
          initialBreakpoint={0.96}
        >
          <IonHeader>
            <IonToolbar color="dark">
              <IonTitle>Revisión conductor</IonTitle>
              <div slot="end" style={{ paddingRight: 8 }}>
                <IonButton
                  fill="clear"
                  color="light"
                  onClick={() => {
                    setSelectedDriverApplication(null);
                    setApplicationReviewReason("");
                  }}
                >
                  Cerrar
                </IonButton>
              </div>
            </IonToolbar>
          </IonHeader>

          <IonContent className="ion-padding">
            {selectedDriverApplication && (() => {
              const application = selectedDriverApplication;
              const vehicles = getDriverApplicationVehicles(application);
              const status = application.status || "pending";
              const docFront = application.documents?.identityCardFront ?? null;
              const docBack = application.documents?.identityCardBack ?? null;
              const license = application.documents?.driverLicense ?? null;

              return (
                <>
                  <IonCard style={{ margin: "0 0 12px", borderRadius: 18 }}>
                    <IonCardContent>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                        <div>
                          <h2 style={{ margin: 0, fontWeight: 950 }}>
                            {getDriverApplicationFullName(application)}
                          </h2>
                          <p style={{ margin: "6px 0 0", color: "var(--ion-color-medium)", fontWeight: 750 }}>
                            {application.email || "Email no informado"} · {application.phone || "Teléfono no informado"}
                          </p>
                        </div>
                        <IonBadge color={DRIVER_APP_STATUS_COLOR[status]}>
                          {DRIVER_APP_STATUS_LABEL[status]}
                        </IonBadge>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
                        <div style={{ background: "#f6f2ec", borderRadius: 12, padding: 10 }}>
                          <div style={{ fontSize: ".68rem", color: "#666", fontWeight: 850 }}>RUT</div>
                          <div style={{ fontWeight: 950, color: "#111" }}>{application.rut || "No informado"}</div>
                        </div>
                        <div style={{ background: "#f6f2ec", borderRadius: 12, padding: 10 }}>
                          <div style={{ fontSize: ".68rem", color: "#666", fontWeight: 850 }}>Nacimiento</div>
                          <div style={{ fontWeight: 950, color: "#111" }}>{application.birthDate || "No informado"}</div>
                        </div>
                      </div>
                    </IonCardContent>
                  </IonCard>

                  <IonCard style={{ margin: "0 0 12px", borderRadius: 18 }}>
                    <IonCardHeader>
                      <IonCardTitle style={{ fontSize: "1rem", fontWeight: 950 }}>
                        Documentación requerida
                      </IonCardTitle>
                      <IonCardSubtitle>Revisa frente, reverso y licencia de conducir.</IonCardSubtitle>
                    </IonCardHeader>
                    <IonCardContent>
                      {[
                        ["Cédula frente", docFront],
                        ["Cédula reverso", docBack],
                        ["Licencia de conducir", license],
                      ].map(([label, file]) => {
                        const typedFile = file as AdminDriverApplicationFile | null;
                        const preview = typedFile?.dataUrl ?? null;

                        return (
                          <div
                            key={String(label)}
                            style={{
                              background: "#fff",
                              borderRadius: 14,
                              border: "1px solid rgba(0,0,0,.08)",
                              padding: 10,
                              marginBottom: 10,
                            }}
                          >
                            <div style={{ fontSize: ".72rem", color: "#8a6418", fontWeight: 950, textTransform: "uppercase" }}>
                              {String(label)}
                            </div>
                            <div style={{ fontWeight: 900, marginTop: 3 }}>
                              {getDriverApplicationFileLabel(typedFile)}
                            </div>

                            {preview && isImageDataUrl(preview) && (
                              <img
                                src={preview}
                                alt={String(label)}
                                style={{
                                  width: "100%",
                                  maxHeight: 220,
                                  objectFit: "cover",
                                  borderRadius: 12,
                                  border: "1px solid rgba(0,0,0,.12)",
                                  marginTop: 8,
                                }}
                              />
                            )}

                            <IonButton
                              size="small"
                              fill="outline"
                              color="primary"
                              disabled={!preview}
                              onClick={() => openDriverApplicationFile(typedFile)}
                              style={{ marginTop: 8 }}
                            >
                              Ver archivo
                            </IonButton>
                          </div>
                        );
                      })}
                    </IonCardContent>
                  </IonCard>

                  <IonCard style={{ margin: "0 0 12px", borderRadius: 18 }}>
                    <IonCardHeader>
                      <IonCardTitle style={{ fontSize: "1rem", fontWeight: 950 }}>
                        Vehículos enviados
                      </IonCardTitle>
                      <IonCardSubtitle>El vehículo principal es obligatorio. Los opcionales pueden quedar aprobados o en revisión.</IonCardSubtitle>
                    </IonCardHeader>
                    <IonCardContent>
                      {vehicles.length === 0 && (
                        <IonText color="danger">
                          <p style={{ fontWeight: 900 }}>No hay vehículos adjuntos.</p>
                        </IonText>
                      )}

                      {vehicles.map((vehicle, index) => (
                        <div
                          key={vehicle.id ?? `${vehicle.plate}-${index}`}
                          style={{
                            background: "#fff",
                            borderRadius: 16,
                            border: "1px solid rgba(200,155,60,.32)",
                            padding: 12,
                            marginBottom: 12,
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                            <div>
                              <div style={{ fontSize: ".72rem", color: "#8a6418", fontWeight: 950, textTransform: "uppercase" }}>
                                {index === 0 || vehicle.primary ? "Vehículo principal" : "Vehículo opcional"}
                              </div>
                              <div style={{ fontWeight: 950, fontSize: "1rem", marginTop: 3 }}>
                                {getDriverApplicationVehicleLabel(vehicle)}
                              </div>
                              <div style={{ color: "#555", fontSize: ".8rem", fontWeight: 800, marginTop: 3 }}>
                                Patente: {vehicle.plate || "No informada"} · Año: {vehicle.year || "No informado"}
                              </div>
                              <div style={{ color: "#555", fontSize: ".8rem", fontWeight: 800, marginTop: 3 }}>
                                Tipo: {vehicle.ownership === "optional" ? "Opcional / temporal" : "Propio principal"}
                                {vehicle.expiresAt ? ` · Expira: ${vehicle.expiresAt}` : ""}
                              </div>
                            </div>
                            <IonBadge color={vehicle.approvedStatus === "approved" ? "success" : "warning"}>
                              {vehicle.approvedStatus === "approved" ? "Aprobado" : "Revisión"}
                            </IonBadge>
                          </div>

                          {vehicle.imageDataUrl && isImageDataUrl(vehicle.imageDataUrl) && (
                            <img
                              src={vehicle.imageDataUrl}
                              alt="Foto vehículo"
                              style={{
                                width: "100%",
                                maxHeight: 230,
                                objectFit: "cover",
                                borderRadius: 14,
                                border: "1px solid rgba(0,0,0,.12)",
                                marginTop: 10,
                              }}
                            />
                          )}
                        </div>
                      ))}
                    </IonCardContent>
                  </IonCard>

                  <IonCard style={{ margin: "0 0 12px", borderRadius: 18 }}>
                    <IonCardHeader>
                      <IonCardTitle style={{ fontSize: "1rem", fontWeight: 950 }}>
                        Decisión del administrador
                      </IonCardTitle>
                    </IonCardHeader>
                    <IonCardContent>
                      <IonItem lines="full" style={{ "--background": "#fff", borderRadius: 14, marginBottom: 12 } as CSSProperties}>
                        <IonLabel position="stacked">Motivo si queda en espera o rechazada</IonLabel>
                        <IonInput
                          value={applicationReviewReason}
                          placeholder="Ej: licencia borrosa, patente no coincide, falta foto clara..."
                          onIonInput={(e) => setApplicationReviewReason(String(e.detail.value ?? ""))}
                        />
                      </IonItem>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
                        <IonButton
                          expand="block"
                          color="success"
                          disabled={actioning || application.status === "approved"}
                          onClick={() => void handleDriverApplicationReview(application.id, "approved")}
                        >
                          {actioning ? <IonSpinner name="dots" /> : "Aprobar conductor"}
                        </IonButton>

                        <IonButton
                          expand="block"
                          color="warning"
                          fill="outline"
                          disabled={actioning}
                          onClick={() => void handleDriverApplicationReview(application.id, "on_hold")}
                        >
                          Dejar en espera
                        </IonButton>

                        <IonButton
                          expand="block"
                          color="danger"
                          fill="outline"
                          disabled={actioning || application.status === "rejected"}
                          onClick={() => void handleDriverApplicationReview(application.id, "rejected")}
                        >
                          Rechazar postulación
                        </IonButton>
                      </div>
                    </IonCardContent>
                  </IonCard>
                </>
              );
            })()}
          </IonContent>
        </IonModal>
        {actionError && (
          <IonText color="danger">
            <p style={{ fontSize: "0.85rem", marginTop: "10px" }}>
              {actionError}
            </p>
          </IonText>
        )}

        <IonModal
          isOpen={
            actionType === "reject" &&
            actionId !== null &&
            isResidenceDocument(
              docs.find((item) => item.id === actionId) ??
                ({} as AdminDocumentData),
            )
          }
          onDidDismiss={() => {
            if (!actioning) {
              setActionId(null);
              setActionType(null);
              setRejectReason("");
              setRejectFareType("chilean");
              setActionError(null);
            }
          }}
          breakpoints={[0, 0.58, 0.86]}
          initialBreakpoint={0.58}
        >
          <IonHeader>
            <IonToolbar color="dark">
              <IonTitle>Reclasificar acreditación</IonTitle>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            <IonText>
              <p style={{ marginTop: 0, fontWeight: 800 }}>
                La acreditación no corresponde. Selecciona la categoría
                tarifaria correcta y escribe el motivo obligatorio.
              </p>
            </IonText>

            <IonItem>
              <IonLabel position="stacked">Categoría correcta *</IonLabel>
              <IonSelect
                value={rejectFareType}
                disabled={actioning}
                onIonChange={(event) =>
                  setRejectFareType(
                    event.detail.value as "chilean" | "foreigner",
                  )
                }
              >
                <IonSelectOption value="chilean">
                  Turista chileno
                </IonSelectOption>
                <IonSelectOption value="foreigner">
                  Turista extranjero
                </IonSelectOption>
              </IonSelect>
            </IonItem>

            <IonItem style={{ marginTop: 12 }}>
              <IonLabel position="stacked">Motivo *</IonLabel>
              <IonTextarea
                value={rejectReason}
                maxlength={500}
                autoGrow
                disabled={actioning}
                placeholder="Ej: La documentación no acredita residencia vigente."
                onIonInput={(event) =>
                  setRejectReason(String(event.detail.value ?? ""))
                }
              />
            </IonItem>

            {actionError && (
              <IonText color="danger">
                <p style={{ fontWeight: 800 }}>{actionError}</p>
              </IonText>
            )}

            <IonButton
              expand="block"
              color="danger"
              disabled={actioning || !rejectReason.trim()}
              onClick={() => void handleReject()}
              style={{ marginTop: 18, fontWeight: 900 }}
            >
              {actioning ? <IonSpinner name="dots" /> : "Rechazar y cambiar categoría"}
            </IonButton>

            <IonButton
              expand="block"
              fill="clear"
              disabled={actioning}
              onClick={() => {
                setActionId(null);
                setActionType(null);
                setRejectReason("");
                setRejectFareType("chilean");
                setActionError(null);
              }}
            >
              Cancelar
            </IonButton>
          </IonContent>
        </IonModal>

        <IonAlert
          isOpen={
            actionType === "reject" &&
            actionId !== null &&
            !isResidenceDocument(
              docs.find((item) => item.id === actionId) ??
                ({} as AdminDocumentData),
            )
          }
          header="Rechazar documento"
          message="Ingresa el motivo de rechazo (obligatorio)."
          inputs={[
            {
              name: "reason",
              type: "textarea",
              placeholder: "Ej: Documento ilegible. El pasajero verá el aviso y deberá elegir otro tipo de usuario o subir otro documento.",
              value: rejectReason,
              handler: (e: { value?: string }) =>
                setRejectReason(e.value ?? ""),
            },
          ]}
          buttons={[
            {
              text: "Cancelar",
              role: "cancel",
              handler: () => {
                setActionId(null);
                setActionType(null);
                setRejectReason("");
              },
            },
            {
              text: "Rechazar",
              handler: () => {
                void handleReject();
              },
            },
          ]}
          onDidDismiss={() => {
            if (!actioning) {
              setActionId(null);
              setActionType(null);
            }
          }}
        />

        <IonToast
          isOpen={toastMessage !== null}
          message={toastMessage ?? ""}
          duration={3000}
          color="success"
          onDidDismiss={() => setToastMessage(null)}
        />
      </IonContent>
    </IonPage>
  );
}

export function AdminActivityPage(): JSX.Element {
  const { session } = useAuth();
  const [items, setItems] = useState<DashActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const load = useCallback(
    async (reset = false) => {
      if (!session?.accessToken) return;
      if (reset) setLoading(true);
      try {
        const limit = PAGE_SIZE * (reset ? 1 : page);
        const data = await dashboardService.getActivity(
          session.accessToken,
          limit,
        );
        setItems(data);
        if (!reset) setPage((p) => p + 1);
      } catch {
        /* noop */
      } finally {
        if (reset) setLoading(false);
      }
    },
    [session?.accessToken, page],
  );

  useEffect(() => {
    void load(true);
  }, [session?.accessToken]);

  const filtered =
    filter === "all" ? items : items.filter((i) => i.type === filter);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Actividad Reciente</IonTitle>
        </IonToolbar>
        <IonToolbar>
          <IonSegment
            value={filter}
            onIonChange={(e) => setFilter(String(e.detail.value ?? "all"))}
          >
            <IonSegmentButton value="all">
              <IonLabel>Todos</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="ride">
              <IonLabel>Viajes</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="booking">
              <IonLabel>Reservas</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="document">
              <IonLabel>Docs</IonLabel>
            </IonSegmentButton>
          </IonSegment>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonRefresher
          slot="fixed"
          onIonRefresh={(e) => {
            void load(true).then(() => e.detail.complete());
          }}
        >
          <IonRefresherContent />
        </IonRefresher>
        {loading && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              padding: "32px",
            }}
          >
            <IonSpinner />
          </div>
        )}
        {!loading && (
          <IonList>
            {filtered.map((item, i) => (
              <IonItem key={i}>
                <IonIcon
                  icon={item.type === "ride" ? carIcon : bookOutline}
                  slot="start"
                  color={item.type === "ride" ? "primary" : "tertiary"}
                />
                <IonLabel>
                  <h3>{item.description}</h3>
                  <p>
                    {item.userName} · {timeAgo(item.timestamp)}
                  </p>
                </IonLabel>
                {item.status && (
                  <IonBadge slot="end" color="medium">
                    {item.status}
                  </IonBadge>
                )}
              </IonItem>
            ))}
          </IonList>
        )}
        <IonInfiniteScroll
          onIonInfinite={(e) => {
            void load().then(() =>
              (e.target as HTMLIonInfiniteScrollElement).complete(),
            );
          }}
        >
          <IonInfiniteScrollContent />
        </IonInfiniteScroll>
      </IonContent>
    </IonPage>
  );
}

export function AdminAlertsPage(): JSX.Element {
  const { session } = useAuth();
  const [alerts, setAlerts] = useState<DashboardData["alerts"]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    try {
      const data = await dashboardService.getDashboard(session.accessToken);
      setAlerts(data.alerts);
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  function dismiss(index: number) {
    setAlerts((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Alertas</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonRefresher
          slot="fixed"
          onIonRefresh={(e) => {
            void load().then(() => e.detail.complete());
          }}
        >
          <IonRefresherContent />
        </IonRefresher>
        {loading && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              padding: "32px",
            }}
          >
            <IonSpinner />
          </div>
        )}
        {!loading && alerts.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 16px" }}>
            <IonText color="medium">No hay alertas activas</IonText>
          </div>
        )}
        {!loading &&
          alerts.map((alert, i) => (
            <IonCard
              key={i}
              color={alert.type === "critical" ? "danger" : "warning"}
            >
              <IonCardContent>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "8px",
                  }}
                >
                  <IonIcon
                    icon={
                      alert.type === "critical"
                        ? alertCircleOutline
                        : warningOutline
                    }
                    style={{ flexShrink: 0, marginTop: "2px" }}
                  />
                  <div style={{ flex: 1 }}>
                    <div>{alert.message}</div>
                    {alert.action && (
                      <div
                        style={{
                          marginTop: "4px",
                          fontSize: "0.85rem",
                          opacity: 0.8,
                        }}
                      >
                        {alert.action}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ marginTop: "8px" }}>
                  <IonButton
                    fill="outline"
                    size="small"
                    onClick={() => dismiss(i)}
                  >
                    Marcar resuelta
                  </IonButton>
                </div>
              </IonCardContent>
            </IonCard>
          ))}
      </IonContent>
    </IonPage>
  );
}

export function AdminEventTicketsPage(): JSX.Element {
  const { session } = useAuth();
  const [code, setCode] = useState("");
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    ok: boolean;
    message: string;
    id?: string;
    validatedAt?: string;
  } | null>(null);
  const [recentValidations, setRecentValidations] = useState<
    import("../../features/eventTickets/eventTickets.service.js").EventTicketData[]
  >([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const loadHistory = async () => {
    if (!session?.accessToken) return;
    setLoadingHistory(true);
    try {
      const items = await (
        await import("../../features/eventTickets/eventTickets.service.js")
      ).eventTicketsService.getRecentValidations(session.accessToken);
      setRecentValidations(items);
    } catch {
      setToast("Error al cargar historial");
    } finally {
      setLoadingHistory(false);
    }
  };

  useIonViewWillEnter(() => {
    void loadHistory();
  });

  const handleValidate = async () => {
    if (!session?.accessToken || !code.trim()) {
      setToast("Ingresa un código");
      return;
    }
    setValidating(true);
    setValidationResult(null);
    try {
      const { eventTicketsService } =
        await import("../../features/eventTickets/eventTickets.service.js");
      const res = await eventTicketsService.validateByCode(
        session.accessToken,
        code.trim().toUpperCase(),
      );
      setValidationResult({
        ok: true,
        message: res.message,
        id: res.id,
        validatedAt: res.validatedAt,
      });
      setCode("");
      void loadHistory();
    } catch (e) {
      setValidationResult({
        ok: false,
        message: e instanceof Error ? e.message : "Error al validar",
      });
    } finally {
      setValidating(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Validar Entradas</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonRefresher
          slot="fixed"
          onIonRefresh={(e) => {
            void loadHistory().then(() => e.detail.complete());
          }}
        >
          <IonRefresherContent />
        </IonRefresher>

        <IonCard>
          <IonCardContent>
            <IonList>
              <IonItem>
                <IonLabel position="stacked">Código de entrada</IonLabel>
                <IonInput
                  value={code}
                  onIonInput={(e) => setCode(e.detail.value ?? "")}
                  placeholder="RAPA-XXXXXXXX"
                  style={{
                    fontFamily: "monospace",
                    textTransform: "uppercase",
                  }}
                />
              </IonItem>
            </IonList>
            <IonButton
              expand="block"
              style={{ marginTop: "1rem" }}
              onClick={handleValidate}
              disabled={validating || !code.trim()}
            >
              {validating ? <IonSpinner name="crescent" /> : "Validar"}
            </IonButton>
          </IonCardContent>
        </IonCard>

        {validationResult && (
          <IonCard color={validationResult.ok ? "success" : "danger"}>
            <IonCardContent>
              <p style={{ color: "white", fontWeight: "bold" }}>
                {validationResult.ok ? "✓" : "✗"} {validationResult.message}
              </p>
              {validationResult.validatedAt && (
                <p
                  style={{
                    color: "rgba(255,255,255,0.85)",
                    fontSize: "0.9rem",
                  }}
                >
                  Validada:{" "}
                  {new Date(validationResult.validatedAt).toLocaleString(
                    "es-CL",
                  )}
                </p>
              )}
            </IonCardContent>
          </IonCard>
        )}

        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Historial de validaciones</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            {loadingHistory && (
              <div style={{ textAlign: "center" }}>
                <IonSpinner />
              </div>
            )}
            {!loadingHistory && recentValidations.length === 0 && (
              <IonNote>No hay validaciones recientes</IonNote>
            )}
            {recentValidations.map((t) => (
              <div
                key={t.id}
                style={{
                  borderBottom: "1px solid var(--ion-color-light)",
                  padding: "0.5rem 0",
                }}
              >
                <strong style={{ fontSize: "0.95rem" }}>{t.eventName}</strong>
                <p
                  style={{
                    margin: "0.15rem 0",
                    fontFamily: "monospace",
                    fontSize: "0.85rem",
                  }}
                >
                  {t.ticketCode}
                </p>
                {t.validatedAt && (
                  <p
                    style={{
                      margin: 0,
                      color: "var(--ion-color-medium)",
                      fontSize: "0.8rem",
                    }}
                  >
                    {new Date(t.validatedAt).toLocaleString("es-CL")}
                  </p>
                )}
              </div>
            ))}
          </IonCardContent>
        </IonCard>

        <IonToast
          isOpen={toast !== null}
          message={toast ?? ""}
          duration={3000}
          onDidDismiss={() => setToast(null)}
        />
      </IonContent>
    </IonPage>
  );
}
