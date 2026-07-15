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
  IonTitle,
  IonToast,
  IonToolbar,
  useIonViewWillEnter,
} from "@ionic/react";
import { useEffect, useState, useCallback, type CSSProperties } from "react";
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
import { MapFallback } from "../../components/MapFallback";

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
  rideId?: string | null;
  rideKey?: string | null;
  passengerEmail?: string | null;
  passengerName?: string | null;
  originText?: string | null;
  destinationText?: string | null;
  amountClp: number;
  minimumFareClp?: number | null;
  type?: "late_cancel" | "no_show" | string | null;
  paymentMethod?: string | null;
  status: "pending_next_ride" | "applied_to_next_ride" | "paid" | "waived" | string;
  adminReviewStatus?: string | null;
  title?: string | null;
  description?: string | null;
  createdAt?: string | null;
  appliedRideId?: string | null;
  appliedAt?: string | null;
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


type RapagoAccountDeletionRequestStatus = "pending_admin" | "approved" | "rejected" | "cancelled";

type RapagoAccountDeletionRequest = {
  id: string;
  ownerKey: string;
  userId?: string | null;
  userEmail?: string | null;
  userName?: string | null;
  userRole?: string | null;
  reason: string;
  comment?: string | null;
  status: RapagoAccountDeletionRequestStatus;
  createdAt: string;
  updatedAt: string;
  adminReviewedAt?: string | null;
  adminReviewedBy?: string | null;
  adminNote?: string | null;
  source?: string | null;
};

const RAPAGO_ACCOUNT_DELETION_REQUESTS_KEY_ADMIN = "rapago_account_deletion_requests_v1";
const RAPAGO_ACCOUNT_DELETION_EVENT_ADMIN = "rapago:account-deletion-requests-updated";

function sanitizeAdminAccountDeletionText(value: unknown, maxLength = 240): string {
  return String(value ?? "")
    .replace(/[<>`{}$\\]/g, "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function readAdminAccountDeletionRequests(): RapagoAccountDeletionRequest[] {
  try {
    const raw = localStorage.getItem(RAPAGO_ACCOUNT_DELETION_REQUESTS_KEY_ADMIN);
    const parsed = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item, index): RapagoAccountDeletionRequest => ({
        id: sanitizeAdminAccountDeletionText(item.id, 90) || `account-delete-${index}`,
        ownerKey: sanitizeAdminAccountDeletionText(item.ownerKey, 180),
        userId: sanitizeAdminAccountDeletionText(item.userId, 120) || null,
        userEmail: sanitizeAdminAccountDeletionText(item.userEmail, 160).toLowerCase() || null,
        userName: sanitizeAdminAccountDeletionText(item.userName, 120) || null,
        userRole: sanitizeAdminAccountDeletionText(item.userRole, 60) || null,
        reason: sanitizeAdminAccountDeletionText(item.reason, 120) || "No informado",
        comment: sanitizeAdminAccountDeletionText(item.comment, 260) || null,
        status: String(item.status ?? "pending_admin") as RapagoAccountDeletionRequestStatus,
        createdAt: sanitizeAdminAccountDeletionText(item.createdAt, 40) || new Date().toISOString(),
        updatedAt: sanitizeAdminAccountDeletionText(item.updatedAt, 40) || new Date().toISOString(),
        adminReviewedAt: sanitizeAdminAccountDeletionText(item.adminReviewedAt, 40) || null,
        adminReviewedBy: sanitizeAdminAccountDeletionText(item.adminReviewedBy, 80) || null,
        adminNote: sanitizeAdminAccountDeletionText(item.adminNote, 260) || null,
        source: sanitizeAdminAccountDeletionText(item.source, 80) || null,
      }))
      .filter((item) => Boolean(item.id))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch {
    return [];
  }
}

function writeAdminAccountDeletionRequests(requests: RapagoAccountDeletionRequest[]): void {
  try {
    localStorage.setItem(RAPAGO_ACCOUNT_DELETION_REQUESTS_KEY_ADMIN, JSON.stringify(requests.slice(0, 250)));
    window.dispatchEvent(new CustomEvent(RAPAGO_ACCOUNT_DELETION_EVENT_ADMIN, { detail: { requests } }));
    window.dispatchEvent(new CustomEvent(RAPAGO_ADMIN_RIDES_EVENT, { detail: { requests } }));
  } catch {
    // No bloquea el panel admin.
  }
}

function updateAdminAccountDeletionRequestStatus(
  id: string,
  status: Exclude<RapagoAccountDeletionRequestStatus, "pending_admin">,
  adminNote: string,
): RapagoAccountDeletionRequest[] {
  const now = new Date().toISOString();
  const next = readAdminAccountDeletionRequests().map((item) => {
    if (String(item.id) !== String(id)) return item;

    return {
      ...item,
      status,
      updatedAt: now,
      adminReviewedAt: now,
      adminReviewedBy: "admin",
      adminNote: sanitizeAdminAccountDeletionText(adminNote, 260),
    };
  });

  writeAdminAccountDeletionRequests(next);
  return next;
}

function adminAccountDeletionStatusLabel(status: RapagoAccountDeletionRequestStatus): string {
  if (status === "approved") return "Aprobada";
  if (status === "rejected") return "Rechazada";
  if (status === "cancelled") return "Cancelada";
  return "Pendiente";
}

function adminAccountDeletionStatusColor(status: RapagoAccountDeletionRequestStatus): string {
  if (status === "approved") return "success";
  if (status === "rejected") return "danger";
  if (status === "cancelled") return "medium";
  return "warning";
}

function formatAdminAccountDeletionDate(value: unknown): string {
  const date = new Date(String(value ?? ""));
  if (!Number.isFinite(date.getTime())) return "Sin fecha";

  return date.toLocaleString("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
  });
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
      };

      current.rideId = current.rideId || rideId || rideKey;
      current.originText = current.originText || adminCashString(item.originText, "Origen");
      current.destinationText = current.destinationText || adminCashString(item.destinationText, "Destino");
      current.fareClp = Math.max(current.fareClp || 0, fareClp || 0);
      current.passengerEmail = current.passengerEmail || adminCashString(item.passengerEmail, item.email) || null;
      current.passengerName = current.passengerName || adminCashString(item.passengerName, item.userName, item.name) || null;
      current.createdAt = new Date(createdAt).getTime() > new Date(current.createdAt).getTime() ? createdAt : current.createdAt;

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

      return {
        ...review,
        paidClp: passengerPaid || driverPaid || review.paidClp || 0,
        overpaidClp: Math.max(passengerOverpaid, driverOverpaid, review.overpaidClp || 0),
        decision,
        status: decision === "wallet_credit" ? "wallet_available" : decision === "refund_whatsapp" ? "pending_refund" : decision === "driver_overpaid" ? "pending_driver_review" : "completed",
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
  if (isAdminWalletCreditAvailable(benefit)) return "Disponible en wallet";
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

async function markAdminWalletCreditAvailable(
  accessToken: string,
  benefit: AdminWalletBenefit,
  targetUserId: string,
): Promise<void> {
  if (!accessToken) {
    throw new Error("Sesion admin no disponible.");
  }

  if (!targetUserId) {
    throw new Error("No se encontro el usuario del pasajero para aprobar el credito real.");
  }

  const amountClp = Math.max(0, Math.round(Number(benefit.amountClp ?? 0)));
  if (amountClp <= 0) {
    throw new Error("El credito no tiene un monto valido.");
  }

  const { walletService } = await import("../../features/wallet/wallet.service.js");

  const rideId = adminWalletCreditUuidOrUndefined(benefit.rideId);
  const paymentId = (benefit as AdminWalletBenefit & { paymentId?: string | null }).paymentId;
  const externalReference = normalizeAdminWalletCreditExternalReference(paymentId || benefit.rideId || benefit.id);

  await walletService.adminCreateWalletCredit(accessToken, {
    userId: targetUserId,
    ...(rideId ? { rideId } : {}),
    amountClp,
    description:
      benefit.description ||
      `Credito aprobado por admin: ${benefit.originText || "Origen"} -> ${benefit.destinationText || "Destino"}.`,
    reason: "admin_approved_wallet_credit",
    ...(externalReference ? { externalReference } : {}),
  });

  const now = new Date().toISOString();
  const next = readAdminWalletBenefits().map((item) => {
    if (item.id !== benefit.id) return item;

    return {
      ...item,
      status: "available",
      adminReviewStatus: "backend_credit_created",
      approvedAt: item.approvedAt ?? now,
      approvedBy: item.approvedBy ?? "admin",
      title: "CREDITOS PARA PROXIMO VIAJE",
    };
  });

  writeAdminWalletBenefits(next);
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
      title: "CRÉDITOS PARA PRÓXIMO VIAJE",
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
    "Soporte RAPA GO: solicitud de revision de credito/devolucion.",
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
        rideId: typeof item.rideId === "string" ? item.rideId : null,
        rideKey: typeof item.rideKey === "string" ? item.rideKey : null,
        passengerEmail: typeof item.passengerEmail === "string" ? item.passengerEmail : null,
        passengerName: typeof item.passengerName === "string" ? item.passengerName : null,
        originText: typeof item.originText === "string" ? item.originText : null,
        destinationText: typeof item.destinationText === "string" ? item.destinationText : null,
        amountClp: Math.max(0, Math.round(Number(item.amountClp ?? item.amount ?? 0))),
        minimumFareClp: Number.isFinite(Number(item.minimumFareClp)) ? Math.round(Number(item.minimumFareClp)) : null,
        type: typeof item.type === "string" ? item.type : null,
        paymentMethod: typeof item.paymentMethod === "string" ? item.paymentMethod : null,
        status: String(item.status ?? "pending_next_ride"),
        adminReviewStatus: typeof item.adminReviewStatus === "string" ? item.adminReviewStatus : null,
        title: typeof item.title === "string" ? item.title : null,
        description: typeof item.description === "string" ? item.description : null,
        createdAt: typeof item.createdAt === "string" ? item.createdAt : null,
        appliedRideId: typeof item.appliedRideId === "string" ? item.appliedRideId : null,
        appliedAt: typeof item.appliedAt === "string" ? item.appliedAt : null,
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

function isAdminPassengerChargePending(charge: AdminPassengerPendingCharge): boolean {
  if (isAdminNoShowPendingReview(charge)) return true;

  const status = String(charge.status ?? "").toLowerCase();
  const adminStatus = String(charge.adminReviewStatus ?? "").toLowerCase();

  return (
    status === "pending_next_ride" ||
    status === "backend_review_required" ||
    status === "pending_admin_review" ||
    adminStatus === "backend_review_required" ||
    adminStatus === "pending_admin_review" ||
    adminStatus === "charge_pending_next_ride"
  );
}

function adminPassengerChargeStatusLabel(charge: AdminPassengerPendingCharge): string {
  const status = String(charge.status ?? "").toLowerCase();
  const adminStatus = String(charge.adminReviewStatus ?? "").toLowerCase();

  if (isAdminNoShowPendingReview(charge)) return "No show por revisar";
  if (isAdminNoShowCharge(charge) && adminStatus === "charge_pending_next_ride") return "Aprobado pr?ximo viaje";

  if (status === "charged_from_card_or_paid_amount" || adminStatus === "no_show_total_service_charged") {
    return "Cobrado desde tarjeta/pago";
  }
  if (status === "pending_next_ride") return "Pendiente pr?ximo viaje";
  if (status === "applied_to_next_ride") return "Agregado a pr?ximo viaje";
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
  const method = String(charge.paymentMethod ?? "").toLowerCase();

  return (
    status === "charged_from_card_or_paid_amount" ||
    adminStatus === "no_show_total_service_charged" ||
    method.includes("tarjeta") ||
    method.includes("mercado") ||
    method.includes("card")
  );
}

function adminPassengerChargeTypeLabel(charge: AdminPassengerPendingCharge): string {
  if (String(charge.type ?? "").toLowerCase() === "no_show") return "No show · total servicio";
  return "Cancelación fuera de plazo";
}

function adminPassengerChargeBillingLabel(charge: AdminPassengerPendingCharge): string {
  const status = String(charge.status ?? "").toLowerCase();

  if (isAdminPassengerChargePaidFromCard(charge)) return "Cobrado desde tarjeta/pago";
  if (status === "applied_to_next_ride") return "Ya fue sumado";
  if (status === "paid") return "Pagado";
  if (status === "waived") return "Anulado";
  return "Próximo viaje";
}

function markAdminPassengerChargeStatus(charge: AdminPassengerPendingCharge, status: "paid" | "waived"): void {
  const now = new Date().toISOString();
  const next = readAdminPassengerPendingCharges().map((item) => {
    if (item.id !== charge.id) return item;
    return {
      ...item,
      status,
      adminReviewStatus: status,
      appliedAt: status === "paid" ? (item.appliedAt ?? now) : item.appliedAt,
    };
  });

  writeAdminPassengerPendingCharges(next);
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
  const now = new Date().toISOString();
  const chargeRecord = charge as AdminPassengerPendingCharge & Record<string, unknown>;

  const originalServiceAmountClp = Math.max(
    0,
    Math.round(
      Number(
        chargeRecord.originalNoShowServiceAmountClp ??
        chargeRecord.originalServiceAmountClp ??
        chargeRecord.totalServiceAmountClp ??
        chargeRecord.serviceAmountClp ??
        chargeRecord.fareClp ??
        chargeRecord.originalAmountClp ??
        charge.amountClp ??
        0,
      ),
    ),
  );

  const approvedNoShowChargeClp = Math.min(
    3000,
    Math.max(0, Math.round(originalServiceAmountClp * 0.3)),
  );

  const next = readAdminPassengerPendingCharges().map((item) => {
    if (String(item.id ?? "") !== String(charge.id ?? "")) return item;

    const itemRecord = item as AdminPassengerPendingCharge & Record<string, unknown>;
    const ownerEmail = String(itemRecord.passengerEmail ?? itemRecord.ownerKey ?? "").trim().toLowerCase();

    return {
      ...item,
      passengerEmail: ownerEmail || item.passengerEmail || null,
      ownerKey: ownerEmail || itemRecord.ownerKey || null,
      type: "no_show",
      amountClp: approvedNoShowChargeClp,
      originalAmountClp: Math.max(0, Math.round(Number(item.amountClp ?? (item as AdminPassengerPendingCharge & Record<string, unknown>).amount ?? originalServiceAmountClp))),
      originalNoShowServiceAmountClp: originalServiceAmountClp,
      noShowPenaltyPercent: 30,
      noShowPenaltyCapClp: 3000,
      status: "pending_next_ride",
      adminReviewStatus: "charge_pending_next_ride",
      appliedRideId: null,
      appliedAt: null,
      approvedAt: now,
      approvedBy: "admin",
      rejectedAt: null,
      rejectedBy: null,
      source: "admin_approved_no_show",
      backendAuthorityRequired: true,
      localStorageFinancialAuthority: false,
      title: "No show aprobado",
      description:
        "No Show aprobado por administrador. Se cobrara 30% con tope $3.000 en el proximo viaje del pasajero. Cargo aprobado: $" +
        approvedNoShowChargeClp.toLocaleString("es-CL") +
        " CLP.",
    } as AdminPassengerPendingCharge;
  });

  writeAdminPassengerPendingCharges(next);

  window.dispatchEvent(new CustomEvent("rapago:admin-passenger-pending-charge-updated", { detail: { charges: next } }));
  window.dispatchEvent(new CustomEvent("rapago:passenger-pending-charge-updated", { detail: { charges: next } }));
  window.dispatchEvent(new CustomEvent("rapago:wallet-updated", { detail: { charges: next } }));
}

function rejectAdminNoShowCharge(charge: AdminPassengerPendingCharge): void {
  const now = new Date().toISOString();

  const next = readAdminPassengerPendingCharges().map((item) => {
    if (String(item.id ?? "") !== String(charge.id ?? "")) return item;

    return {
      ...item,
      status: "waived",
      adminReviewStatus: "waived",
      rejectedAt: now,
      rejectedBy: "admin",
      approvedAt: null,
      approvedBy: null,
      source: "admin_rejected_no_show",
      title: item.title || "No show rechazado",
      description:
        item.description ||
        "No show rechazado por administrador. No se cobrar? al pasajero.",
    } as AdminPassengerPendingCharge;
  });

  writeAdminPassengerPendingCharges(next);
}


function isAdminCashWalletApproved(review: AdminCashPaymentReview): boolean {
  const status = String(review.adminReviewStatus ?? review.status ?? "").toLowerCase();
  return status === "admin_approved" || status === "approved" || status === "available";
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
    return isAdminCashWalletApproved(review) ? "Saldo aprobado" : "Pendiente aprobar saldo";
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
  if (review.decision === "wallet_credit") return isAdminCashWalletApproved(review) ? "success" : "warning";
  if (review.decision === "refund_whatsapp") return isAdminCashRefundCompleted(review) ? "success" : "danger";
  if (review.decision === "driver_overpaid") return isAdminCashWalletApproved(review) ? "success" : "tertiary";
  return "medium";
}

function approveAdminCashWalletCredit(review: AdminCashPaymentReview): void {
  const now = new Date().toISOString();
  const creditAmount = Math.max(0, Math.round(Number(review.passengerOverpaidClp ?? review.overpaidClp ?? 0)));
  if (creditAmount <= 0) return;

  const updatedReviews = readAdminCashPaymentReviews().map((item) => {
    if ((item.rideKey || item.rideId || item.id) !== (review.rideKey || review.rideId || review.id)) return item;
    return {
      ...item,
      adminReviewStatus: "admin_approved",
      status: "wallet_available",
    };
  });

  writeAdminCashPaymentReviews(updatedReviews);

  const benefits = readAdminWalletBenefits();
  const benefitId = `cash-overpayment-${review.rideId || review.rideKey}`;
  const nextBenefit: AdminWalletBenefit = {
    id: benefitId,
    rideId: review.rideId || null,
    passengerEmail: review.passengerEmail ?? null,
    ownerKey: review.passengerEmail ?? null,
    amountClp: creditAmount,
    status: "available",
    source: "cash_overpayment",
    title: "CRÉDITOS PARA PRÓXIMO VIAJE",
    description: `CRÉDITOS PARA PRÓXIMO VIAJE aprobados por admin. Usuario declaró ${formatAdminCashClp(review.passengerPaidClp ?? review.paidClp)} y conductor declaró ${formatAdminCashClp(review.driverPaidClp ?? 0)}. Viaje ${review.originText} → ${review.destinationText}.`,
    createdAt: review.createdAt,
    approvedAt: now,
    approvedBy: "admin",
    adminReviewStatus: "admin_approved",
    fareClp: review.fareClp,
    paidClp: review.paidClp,
    driverPaidClp: review.driverPaidClp ?? null,
    passengerPaidClp: review.passengerPaidClp ?? review.paidClp,
  };

  writeAdminWalletBenefits([
    nextBenefit,
    ...benefits.filter((item) => String(item.id ?? "") !== benefitId),
  ]);
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
  const [accountDeletionRequests, setAccountDeletionRequests] = useState<RapagoAccountDeletionRequest[]>(() => readAdminAccountDeletionRequests());


  useEffect(() => {
    const refreshAccountDeletionRequests = () => {
      setAccountDeletionRequests(readAdminAccountDeletionRequests());
    };

    window.addEventListener("storage", refreshAccountDeletionRequests);
    window.addEventListener(RAPAGO_ACCOUNT_DELETION_EVENT_ADMIN, refreshAccountDeletionRequests as EventListener);

    return () => {
      window.removeEventListener("storage", refreshAccountDeletionRequests);
      window.removeEventListener(RAPAGO_ACCOUNT_DELETION_EVENT_ADMIN, refreshAccountDeletionRequests as EventListener);
    };
  }, []);

  const load = useCallback(
    async (silent = false) => {
      if (!session?.accessToken) return;

      if (!silent) setLoading(true);
      setError(null);

      try {
        const token = session.accessToken;

        const [dash, acts, ridesResult, driversResult, usersResult] =
          await Promise.all([
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
          ]);

        setData(dash);
        setActivity(acts);
        setAdminRides(ridesResult);
        setAdminDrivers(driversResult);
        setAdminUsers(usersResult);
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
    if (review.decision === "wallet_credit") return !isAdminCashWalletApproved(review);
    if (review.decision === "refund_whatsapp") return !isAdminCashRefundCompleted(review);
    if (review.decision === "driver_overpaid") return !isAdminCashWalletApproved(review);
    return false;
  });
  const pendingCashAmountClp = pendingCashPaymentReviews.reduce((sum, review) => sum + Math.max(0, review.overpaidClp), 0);
  const passengerPendingCharges = cashReviewsRevision >= 0 ? readAdminPassengerPendingCharges() : [];
  const passengerChargesPendingNextRide = passengerPendingCharges.filter(isAdminPassengerChargePending);
  const adminNoShowCharges = passengerPendingCharges.filter(isAdminNoShowCharge);
  const adminNoShowPendingReview = adminNoShowCharges.filter(isAdminNoShowPendingReview);
  const pendingPassengerChargeAmountClp = passengerChargesPendingNextRide.reduce((sum, charge) => sum + Math.max(0, charge.amountClp), 0);
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

  const pendingAccountDeletionRequests = accountDeletionRequests.filter(
    (request) => request.status === "pending_admin",
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
      description: `${pendingAccountDeletionRequests.length} solicitud${pendingAccountDeletionRequests.length !== 1 ? "es" : ""}`,
      icon: warningOutline,
      route: "__account_deletion__",
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
                          action.route === "__account_deletion__"
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
                            setAccountDeletionRequests(readAdminAccountDeletionRequests());
                            setShowAccountDeletionModal(true);
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
                  <IonCard style={{ margin: "0 0 12px" }}>
                    <IonCardHeader>
                      <div className="admin-section-title-row">
                        <div>
                          <IonCardTitle>Borrar cuenta</IonCardTitle>
                          <IonCardSubtitle>
                            Solicitudes enviadas desde Perfil. Aprobar deja la cuenta marcada para desactivación administrativa.
                          </IonCardSubtitle>
                        </div>

                        <IonBadge color={pendingAccountDeletionRequests.length > 0 ? "warning" : "medium"}>
                          {pendingAccountDeletionRequests.length} pendiente{pendingAccountDeletionRequests.length !== 1 ? "s" : ""}
                        </IonBadge>
                      </div>
                    </IonCardHeader>

                    <IonCardContent>
                      {accountDeletionRequests.length === 0 ? (
                        <IonText color="medium">
                          <p style={{ margin: 0, fontWeight: 850 }}>
                            No hay solicitudes de eliminación de cuenta.
                          </p>
                        </IonText>
                      ) : (
                        <div style={{ display: "grid", gap: 10 }}>
                          {accountDeletionRequests.map((request) => (
                            <IonCard key={request.id} style={{ margin: 0 }}>
                              <IonCardContent style={{ padding: 14 }}>
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "flex-start",
                                    gap: 10,
                                    marginBottom: 8,
                                  }}
                                >
                                  <div>
                                    <h3 style={{ margin: 0, fontWeight: 950 }}>
                                      {request.userName || request.userEmail || "Usuario"}
                                    </h3>
                                    <p style={{ margin: "4px 0 0", color: "#4b5563", fontWeight: 800 }}>
                                      {request.userEmail || "Correo no informado"} · {request.userRole || "Rol no informado"}
                                    </p>
                                  </div>

                                  <IonBadge color={adminAccountDeletionStatusColor(request.status)}>
                                    {adminAccountDeletionStatusLabel(request.status)}
                                  </IonBadge>
                                </div>

                                <div
                                  style={{
                                    padding: "10px 12px",
                                    borderRadius: 14,
                                    background: "#f8fafc",
                                    border: "1px solid rgba(148, 163, 184, .32)",
                                    color: "#111827",
                                    fontWeight: 800,
                                  }}
                                >
                                  <p style={{ margin: 0 }}>
                                    <strong>Motivo:</strong> {request.reason}
                                  </p>

                                  {request.comment && (
                                    <p style={{ margin: "6px 0 0" }}>
                                      <strong>Comentario:</strong> {request.comment}
                                    </p>
                                  )}

                                  <p style={{ margin: "6px 0 0", color: "#64748b" }}>
                                    Enviada: {formatAdminAccountDeletionDate(request.createdAt)}
                                  </p>

                                  {request.adminNote && (
                                    <p style={{ margin: "6px 0 0", color: "#64748b" }}>
                                      <strong>Nota admin:</strong> {request.adminNote}
                                    </p>
                                  )}
                                </div>

                                {request.status === "pending_admin" && (
                                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                                    <IonButton
                                      size="small"
                                      color="danger"
                                      onClick={() => {
                                        const next = updateAdminAccountDeletionRequestStatus(
                                          request.id,
                                          "approved",
                                          "Solicitud aprobada. Cuenta marcada para desactivación administrativa.",
                                        );
                                        setAccountDeletionRequests(next);
                                        setAdminCashToast("Solicitud de borrar cuenta aprobada.");
                                      }}
                                    >
                                      Aprobar eliminación
                                    </IonButton>

                                    <IonButton
                                      size="small"
                                      color="medium"
                                      fill="outline"
                                      onClick={() => {
                                        const next = updateAdminAccountDeletionRequestStatus(
                                          request.id,
                                          "rejected",
                                          "Solicitud rechazada por administrador.",
                                        );
                                        setAccountDeletionRequests(next);
                                        setAdminCashToast("Solicitud de borrar cuenta rechazada.");
                                      }}
                                    >
                                      Rechazar
                                    </IonButton>
                                  </div>
                                )}
                              </IonCardContent>
                            </IonCard>
                          ))}
                        </div>
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
                            Aqu? se almacenan los No Show informados por conductores.
                            Aprueba para cobrar en el pr?ximo viaje o rechaza para anular.
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
                                  <p style={{ margin: "4px 0 0", color: "#4b5563", fontWeight: 800 }}>
                                    {charge.passengerName || charge.passengerEmail || "Pasajero"} ? {charge.originText || "Origen"} ? {charge.destinationText || "Destino"}
                                  </p>
                                </div>

                                <IonBadge color={adminPassengerChargeStatusColor(charge)}>
                                  {adminPassengerChargeStatusLabel(charge)}
                                </IonBadge>
                              </div>

                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                <div style={{ background: "#fff7e6", borderRadius: 14, padding: 10 }}>
                                  <strong>Cargo</strong>
                                  <div style={{ fontWeight: 950 }}>
                                    {formatAdminCashClp(charge.amountClp)}
                                  </div>
                                </div>

                                <div style={{ background: "#fff7e6", borderRadius: 14, padding: 10 }}>
                                  <strong>Cobro</strong>
                                  <div style={{ fontWeight: 950 }}>Pr?ximo viaje</div>
                                </div>
                              </div>

                              <p style={{ margin: 0, fontWeight: 800, lineHeight: 1.35 }}>
                                {charge.description || "No Show informado por conductor. El admin debe aprobar o rechazar."}
                              </p>

                              {isAdminNoShowPendingReview(charge) && (
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                  <IonButton
                                    size="small"
                                    color="success"
                                    onClick={() => {
                                      approveAdminNoShowChargeForNextRide(charge);
                                      setCashReviewsRevision((current) => current + 1);
                                      setAdminCashToast("No Show aprobado. Se cobrar? en el pr?ximo viaje del pasajero.");
                                    }}
                                  >
                                    Aprobar No Show
                                  </IonButton>

                                  <IonButton
                                    size="small"
                                    color="danger"
                                    fill="outline"
                                    onClick={() => {
                                      rejectAdminNoShowCharge(charge);
                                      setCashReviewsRevision((current) => current + 1);
                                      setAdminCashToast("No Show rechazado.");
                                    }}
                                  >
                                    Rechazar
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
                            Revisa cargos por cancelación, no show, pagos en efectivo, saldos a favor y devoluciones.
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
                            Créditos tarjeta
                          </div>
                          <div style={{ fontWeight: 950, color: "#111", fontSize: "1rem" }}>
                            {formatAdminCashClp(cardCancellationCreditsAmountClp)}
                          </div>
                        </div>
                      </div>
                    </IonCardContent>
                  </IonCard>

                  {passengerPendingCharges.length === 0 && cashPaymentReviews.length === 0 && cardCancellationCredits.length === 0 && (
                    <IonCard className="admin-section-card" style={{ borderRadius: 22 }}>
                      <IonCardContent>
                        <h2 style={{ margin: "0 0 6px", fontWeight: 950 }}>Sin cobranzas pendientes</h2>
                        <p style={{ margin: 0, color: "var(--ion-color-medium)", fontSize: ".86rem" }}>
                          Cuando existan cancelaciones fuera de plazo, no show, pagos en efectivo con diferencia o devoluciones, aparecerán aquí para validarlas.
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
                        <IonCardTitle>CRÉDITOS PARA PRÓXIMO VIAJE</IonCardTitle>
                        <IonCardSubtitle>
                          Saldo neto por cancelaciones de tarjeta/reserva. Penalización descontada del pago realizado.
                        </IonCardSubtitle>
                      </div>
                      <IonBadge color={cardRefundRequestsPending.length > 0 ? "warning" : "success"}>
                        {cardRefundRequestsPending.length > 0
                          ? `${cardRefundRequestsPending.length} devolución${cardRefundRequestsPending.length !== 1 ? "es" : ""}`
                          : "Disponible"}
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
                      Total consignado en wallet: <strong>{formatAdminCashClp(cardCancellationCreditsAmountClp)}</strong>.
                      Si el pasajero solicita devolución, se gestiona por WhatsApp con Gerencia de Soporte RAPA GO.
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
                                  CRÉDITOS PARA PRÓXIMO VIAJE · {formatAdminCashClp(credit.amountClp)}
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
                                <div style={{ fontSize: ".66rem", color: "#166534", fontWeight: 900 }}>Crédito neto</div>
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
                                    void (async () => {
                                      try {
                                        const ownerEmail = String(credit.passengerEmail || credit.ownerKey || "")
                                          .trim()
                                          .toLowerCase();

                                        const targetUser = adminUsers.find((user) =>
                                          String((user as { email?: string | null }).email ?? "")
                                            .trim()
                                            .toLowerCase() === ownerEmail,
                                        );

                                        const targetUserId = String((targetUser as { id?: string } | undefined)?.id ?? "");

                                        if (!targetUserId) {
                                          throw new Error("No se encontro el pasajero en Usuarios para crear el credito real.");
                                        }

                                        await markAdminWalletCreditAvailable(session?.accessToken ?? "", credit, targetUserId);
                                        setCashReviewsRevision((current) => current + 1);
                                        setAdminCashToast("Credito creado en backend y disponible en wallet.");
                                      } catch (err) {
                                        setAdminCashToast(err instanceof Error ? err.message : "No se pudo aprobar el credito real.");
                                      }
                                    })();
                                  }}
                                >
                                  Dejar disponible
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

              {passengerPendingCharges.length > 0 && (
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
                        <IonCardTitle>Cargos por cancelación / no show</IonCardTitle>
                        <IonCardSubtitle>
                          Efectivo se suma al próximo viaje; tarjeta/MercadoPago se cobra desde el pago realizado.
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
                        Hay {formatAdminCashClp(pendingPassengerChargeAmountClp)} pendiente por efectivo/sin pago. En tarjeta/MercadoPago la penalización se descuenta del pago realizado y el saldo va a CRÉDITOS PARA PRÓXIMO VIAJE.
                      </div>
                    )}

                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {passengerPendingCharges.slice(0, 8).map((charge) => {
                        const passengerLabel = charge.passengerName || charge.passengerEmail || "Pasajero";
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
                                <div style={{ marginTop: 2, fontSize: ".76rem", color: "#555", fontWeight: 750, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {passengerLabel} · {charge.originText || "Origen"} → {charge.destinationText || "Destino"}
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
                                  <><br />💳 Tarjeta/MercadoPago: penalización cobrada desde el pago realizado.</>
                                ) : (
                                  <><br />💵 Efectivo/sin pago: queda pendiente para el próximo viaje.</>
                                )}
                              </div>
                            )}

                            {charge.description && (
                              <p style={{ margin: "8px 0 0", fontSize: ".76rem", color: "#7c2d12", lineHeight: 1.35, fontWeight: 800 }}>
                                {charge.description}
                              </p>
                            )}

                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                              {isAdminPassengerChargePending(charge) && (
                                <IonButton
                                  size="small"
                                  color="medium"
                                  fill="outline"
                                  onClick={() => {
                                    markAdminPassengerChargeStatus(charge, "waived");
                                    setCashReviewsRevision((current) => current + 1);
                                    setAdminCashToast("Cargo anulado por administración.");
                                  }}
                                >
                                  Anular cargo
                                </IonButton>
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
                          Saldos a favor y devoluciones solicitadas por pasajeros
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
                        const passengerLabel = review.passengerName || review.passengerEmail || "Pasajero";
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
                                <div
                                  style={{
                                    marginTop: 2,
                                    fontSize: ".76rem",
                                    color: "#555",
                                    fontWeight: 750,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {passengerLabel} · {review.originText || "Origen"} → {review.destinationText || "Destino"}
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
                                <><br />Si apruebas, {formatAdminCashClp(passengerOverpaidClp)} quedará disponible en la billetera del usuario para su próximo viaje.</>
                              )}
                            </div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                              {isWallet && !isAdminCashWalletApproved(review) && (
                                <IonButton
                                  size="small"
                                  color="success"
                                  onClick={() => {
                                    approveAdminCashWalletCredit(review);
                                    setCashReviewsRevision((current) => current + 1);
                                    setAdminCashToast("Saldo a favor aprobado. Ya queda disponible en la billetera del pasajero.");
                                  }}
                                >
                                  Aprobar saldo
                                </IonButton>
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
  "Tu documento de Rapa Nui normal fue rechazado. Por favor elige otro tipo de usuario, como Turista chileno o Turista extranjero, o vuelve a adjuntar un documento de residencia válido.";

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

function isRapaNuiResidentUser(user: AdminUserData): boolean {
  const text = normalizeAdminText(getPassengerConditionText(user));
  const belongs = getUserMetaBoolean(user, [
    "belongsToRapaNuiEthnicity",
    "isRapaNui",
    "rapaNuiResident",
  ]);

  return (
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

  if (isRapaNuiResidentUser(user)) return "Rapa Nui normal";
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
  return docs.filter((doc) => isResidenceDocument(doc) && sameUserForDocument(user, doc));
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
  if (!isRapaNuiResidentUser(user)) return "not_required";

  const extended = user as ExtendedAdminUserData;
  const backendStatus = normalizeAdminText(
    extended.residenceVerificationStatus ??
      extended.residenceDocumentStatus ??
      getUserMetaValue(user, ["residenceVerificationStatus", "residenceDocumentStatus"]),
  );

  if (backendStatus.includes("approved") || backendStatus.includes("aprobado")) return "approved";
  if (backendStatus.includes("rejected") || backendStatus.includes("rechazado")) return "rejected";
  if (backendStatus.includes("pending") || backendStatus.includes("uploaded") || backendStatus.includes("pendiente")) return "pending";

  const doc = getBestResidenceDocForUser(user, docs);

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
  return extended.fileName ?? extended.originalName ?? extended.fileUrl ?? "Documento";
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

    if (
      user &&
      normalizedNewStatus === "active" &&
      isRapaNuiResidentUser(user) &&
      residenceStatus !== "approved"
    ) {
      setUpdateError(
        "No puedes activar este usuario como Rapa Nui normal hasta aprobar su documento de residencia.",
      );
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

    if (
      (action === "unblock" || action === "restore") &&
      isRapaNuiResidentUser(user) &&
      getResidenceVerificationStatus(user, docs) !== "approved"
    ) {
      setUpdateError(
        "No puedes restaurar/activar este usuario como Rapa Nui normal hasta aprobar su documento.",
      );
      setConfirmAccountAction(null);
      return;
    }

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
    setToastMessage("Residencia Rapa Nui aprobada. El pasajero podrá continuar cuando vuelva a abrir Facebook.");
  }

  function rejectLocalResidentRequest(requestId: string): void {
    setResidentRequests(
      reviewLocalResidentVerificationRequestForAdmin(
        requestId,
        "rejected",
        RAPANUI_RESIDENCE_REJECTION_USER_MESSAGE,
      ),
    );
    setToastMessage("Documento Rapa Nui rechazado. El pasajero verá el aviso para corregir su registro.");
  }

  async function approveRapaNuiUser(user: AdminUserData) {
    if (!session?.accessToken) return;

    const doc = getBestResidenceDocForUser(user, docs);

    if (!doc) {
      setUpdateError(
        "Este residente Rapa Nui todavía no tiene documento adjunto para revisar.",
      );
      return;
    }

    if (!isResidenceDocument(doc)) {
      setUpdateError("El documento encontrado no corresponde a residencia Rapa Nui.");
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
        "Residencia Rapa Nui aprobada. La cuenta quedó habilitada.",
      );
    } catch (err) {
      setUpdateError(
        err instanceof Error
          ? err.message
          : "No se pudo aprobar la residencia y activar la cuenta.",
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

    setUpdatingId(user.id);
    setUpdateError(null);

    try {
      const rejectedDoc = await adminService.reviewDocument(
        session.accessToken,
        doc.id,
        "rejected",
        RAPANUI_RESIDENCE_REJECTION_USER_MESSAGE,
      );

      const updatedUser = await adminService.updateUserStatus(
        session.accessToken,
        user.id,
        "pending",
      );

      setDocs((prev) =>
        prev.map((item) => (item.id === rejectedDoc.id ? rejectedDoc : item)),
      );
      setUsers((prev) =>
        prev.map((item) => (item.id === user.id ? updatedUser : item)),
      );

      setToastMessage(
        "Documento rechazado. El pasajero verá el aviso para elegir otro tipo de usuario o subir otro documento.",
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
      return isRapaNuiResidentUser(user) && status !== "approved";
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
          style={{
            margin: "0 0 12px",
            borderRadius: 18,
            background: "linear-gradient(135deg, #2b120f, #8f1d18)",
            color: "#fff",
          }}
        >
          <IonCardContent style={{ padding: "14px 16px" }}>
            <div style={{ fontWeight: 950, fontSize: "1rem" }}>
              Validación Rapa Nui
            </div>
            <p style={{ margin: "6px 0 0", fontSize: ".84rem", lineHeight: 1.35 }}>
              El admin revisa registros normales y registros con Facebook. Si el
              pasajero seleccionó Rapa Nui normal, debe tener documento
              aprobado para activar la cuenta.
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
                        Documento Rapa Nui normal
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
              const passengerLabel = getPassengerLabel(user);
              const providerLabel = getRegistrationProviderLabel(user);
              const passengerPhone = getPassengerPhone(user);
              const passengerRut = getPassengerRut(user);
              const residenceStatus = getResidenceVerificationStatus(user, docs);
              const residenceDoc = getBestResidenceDocForUser(user, docs);
              const residenceFilePreview =
                residenceDoc?.fileUrl ?? getLocalResidenceDocumentPreview(user);
              const isResident = isRapaNuiResidentUser(user);
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
                              Documento Rapa Nui normal
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
                            {isProcessing ? <IonSpinner name="dots" /> : "Aprobar y activar"}
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

  useEffect(() => {
    void loadDrivers();
  }, [loadDrivers]);

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
      const localScheduled = readLocalAdminScheduledRides();
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
              onClick={() => void loadDrivers()}
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
            await loadDrivers();
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
                  style={{
                    margin: 0,
                    borderRadius: "18px",
                    background: "#111",
                    color: "#f6f2ec",
                  }}
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
    notes.includes("promocion regreso")
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
  if (!isAdminReturnOnlyPromotionRide(ride)) return null;

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
    notes: `${String(ride.notes ?? "").trim()} Gestión admin: regreso promocional. El admin debe asignar conductor para el regreso ${originText} → ${destinationText}.`.trim(),
    localAdminOverride: true,
    reservationRequiresCard: true,
    paymentRequiredProvider: "mercadopago",
    cardCancellationCreditToWallet: true,
    cardCancellationCreditName: "CRÉDITOS PARA PRÓXIMO VIAJE",
    reservationCancellationWindowMinutes: 15,
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

function getEffectiveAdminRideStatus(ride: AdminRideData): string {
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
    : "Tu reserva sigue agendada. El admin gestionará/asignará conductor 30 minutos antes. Todas las reservas son con tarjeta; si cancelas dentro de los últimos 15 minutos se descuenta la penalización y el saldo queda como CRÉDITOS PARA PRÓXIMO VIAJE.";

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
      cardCancellationCreditToWallet: true,
      cardCancellationCreditName: "CRÉDITOS PARA PRÓXIMO VIAJE",
      reservationCancellationWindowMinutes: 15,
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
  if (hasAdminAssignedDriver(ride)) return false;

  const effectiveStatus = getEffectiveAdminRideStatus(ride);
  if (["completed", "cancelled", "accepted", "driver_en_route", "driver_arrived", "in_progress"].includes(effectiveStatus)) {
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

function cleanAdminRideNotes(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const cleaned = notes
    .replace(/\bRAPAGO_[A-Z_]+:\s*[^.]+\.?/gi, "")
    .replace(/Fecha y hora de recogida agendada:\s*[^.]+\.?/gi, "")
    .replace(/Fecha y hora de regreso agendada:\s*[^.]+\.?/gi, "")
    .replace(/Activaci[oó]n autom[aá]tica recogida:\s*[^.]+\.?/gi, "")
    .replace(/Activaci[oó]n autom[aá]tica regreso:\s*[^.]+\.?/gi, "")
    .replace(/Estado de agenda admin:\s*[^.]+\.?/gi, "")
    .replace(/Solicitado por rol:\s*[^.]+\.?/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return cleaned || null;
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
  if (status === "cancelled") return 7;
  return 8;
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

export function AdminTripsPage(): JSX.Element {
  const { session } = useAuth();
  const history = useHistory();

  const [rides, setRides] = useState<AdminRideData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [autoRefreshing, setAutoRefreshing] = useState(false);

  // Cancel state per-ride
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelAlertId, setCancelAlertId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [autoAssignToast, setAutoAssignToast] = useState<string | null>(null);

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
        if (filterStatus && filterStatus !== "scheduled") params.status = filterStatus;

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
        const visible = filterStatus
          ? merged.filter((ride) => getEffectiveAdminRideStatus(ride) === filterStatus)
          : merged;

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
    [session?.accessToken, filterStatus],
  );

  useEffect(() => {
    void loadData(false);
  }, [loadData]);

  useEffect(() => {
    const refreshScheduled = () => void loadData(true);
    const interval = window.setInterval(refreshScheduled, 3000);

    window.addEventListener("storage", refreshScheduled);
    window.addEventListener("rapago:admin-scheduled-rides-updated", refreshScheduled);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", refreshScheduled);
      window.removeEventListener("rapago:admin-scheduled-rides-updated", refreshScheduled);
    };
  }, [loadData]);

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
        const localScheduled = readLocalAdminScheduledRides();
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

    const timerId = window.setInterval(() => {
      void runAutoReservationAssignment();
    }, 5000);

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
      window.clearInterval(timerId);
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

        {/* Filter */}
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
            {rides.map((ride) => {
              const scheduleInfo = getAdminRideScheduleInfo(ride);
              const effectiveStatus = getEffectiveAdminRideStatus(ride);
              const statusColor =
                RIDE_STATUS_COLOR_ADMIN[effectiveStatus] ?? "medium";
              const statusLabel =
                RIDE_STATUS_LABEL_ADMIN[effectiveStatus] ?? effectiveStatus;
              const adminCleanNotes = cleanAdminRideNotes(ride.notes);
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
              const wasAutoAssignedBySystem = Boolean(
                adminAutoAssignedAt ||
                  String(getRideUnknownField(ride, "autoAssignedBy") ?? getRideUnknownField(ride, "autoReassignedBy") ?? "")
                    .toLowerCase()
                    .includes("admin_auto"),
              );
              return (
                <IonCard key={ride.id} style={{ margin: 0 }}>
                  <IonCardContent style={{ padding: "12px 14px" }}>
                    <MapFallback
                      origin={{ text: ride.originText }}
                      destination={{ text: ride.destinationText }}
                      height={110}
                      showRoute={false}
                    />

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
                        <strong>{scheduleInfo.isReturnOnlyPromotion ? "🔁 Regreso promocional" : "📅 Reserva agendada"}</strong>
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
                              : "se buscarán conductores 10 min antes."}
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
                    {adminCleanNotes && (
                      <div
                        style={{
                          fontSize: "0.78rem",
                          color: "var(--ion-color-medium)",
                          marginBottom: "4px",
                        }}
                      >
                        Notas: {adminCleanNotes}
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
          <IonTitle>Pagos</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        {/* Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "10px",
            marginBottom: "16px",
          }}
        >
          {[
            { label: "Total órdenes", value: "—", color: "primary" },
            { label: "Pendientes", value: "—", color: "warning" },
            { label: "Pagadas", value: "—", color: "success" },
          ].map((stat) => (
            <IonCard key={stat.label} style={{ margin: 0 }}>
              <IonCardContent
                style={{ padding: "12px 10px", textAlign: "center" }}
              >
                <div
                  style={{
                    fontSize: "1.4rem",
                    fontWeight: 700,
                    color: `var(--ion-color-${stat.color})`,
                  }}
                >
                  {stat.value}
                </div>
                <div
                  style={{
                    fontSize: "0.7rem",
                    color: "var(--ion-color-medium)",
                    marginTop: "2px",
                  }}
                >
                  {stat.label}
                </div>
              </IonCardContent>
            </IonCard>
          ))}
        </div>

        <IonCard>
          <IonCardContent style={{ padding: "16px" }}>
            <div style={{ fontWeight: 600, marginBottom: "8px" }}>
              Estado de integración de pagos
            </div>
            <IonText color="medium">
              <p style={{ margin: 0, fontSize: "0.85rem" }}>
                Los pagos se procesarán cuando se integre el proveedor de pagos.
                Esta sección mostrará órdenes, estados y detalles de
                transacciones una vez habilitada la integración.
              </p>
            </IonText>
            <div
              style={{
                marginTop: "12px",
                display: "flex",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              {["pending", "paid", "failed", "cancelled"].map((s) => {
                const color =
                  s === "pending"
                    ? "warning"
                    : s === "paid"
                      ? "success"
                      : s === "failed"
                        ? "danger"
                        : "medium";
                return (
                  <IonBadge
                    key={s}
                    color={color}
                    style={{ fontSize: "0.72rem" }}
                  >
                    {s}
                  </IonBadge>
                );
              })}
            </div>
          </IonCardContent>
        </IonCard>
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

        <div style={{ marginTop: "24px" }}>
          <IonCard style={{ background: "var(--ion-color-light)" }}>
            <IonCardContent
              style={{ fontSize: "0.78rem", color: "var(--ion-color-medium)" }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "6px",
                }}
              >
                <IonIcon icon={settingsOutline} />
                <strong>Próximamente</strong>
              </div>
              Parámetros del sistema · Integraciones de pago · Notificaciones
              globales · Comisiones de plataforma
            </IonCardContent>
          </IonCard>
        </div>
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
  return (import.meta.env["VITE_API_BASE_URL"] as string | undefined) ?? "/api";
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
    passengerFareType: "resident",
    farePassengerType: "resident",
    passengerType: "resident",
    passengerFareLabel: "Rapa Nui normal",
    passengerTypeLabel: "Rapa Nui normal",
    nationality: "Rapa Nui normal",
    isResident: true,
    is_resident: true,
    residenceVerificationStatus: "approved",
    driverPassengerFareType: "resident",
    driverNationality: "Rapa Nui normal",
    driverIsResident: true,
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
    driverProfileResidentStatus: "approved",
    passengerFareType: "resident",
    farePassengerType: "resident",
    passengerType: "resident",
    passengerFareLabel: "Rapa Nui normal",
    passengerTypeLabel: "Rapa Nui normal",
    nationality: "Rapa Nui normal",
    isResident: true,
    is_resident: true,
    residenceVerificationStatus: "approved",
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

function markApprovedDriverApplicationAsRapaNuiResident(item: AdminDriverApplicationRecord): void {
  try {
    const label = "Rapa Nui normal";
    const email = String(item.email ?? "").trim().toLowerCase();
    const ownerKey = String(item.email ?? item.id ?? "driver-global").trim().toLowerCase();

    const patchResidentFields = (record: Record<string, unknown>): Record<string, unknown> => ({
      ...record,
      ownerKey: String(record.ownerKey ?? ownerKey),
      driverOwnerKey: String(record.driverOwnerKey ?? ownerKey),
      email: String(record.email ?? item.email ?? ""),
      driverEmail: String(record.driverEmail ?? item.email ?? ""),
      role: "driver",
      status: "active",
      isVerified: true,
      is_verified: true,
      passengerFareType: "resident",
      farePassengerType: "resident",
      passengerType: "resident",
      driverPassengerFareType: "resident",
      driverFarePassengerType: "resident",
      passengerFareLabel: label,
      passengerTypeLabel: label,
      nationality: label,
      driverNationality: label,
      isResident: true,
      is_resident: true,
      driverIsResident: true,
      residenceVerificationStatus: "approved",
      residentVerificationStatus: "approved",
      rapaNuiResidentApprovedByAdmin: true,
      rapaNuiResidentApprovedAt: new Date().toISOString(),
    });

    const shouldPatchRecord = (record: Record<string, unknown>): boolean => {
      const recordEmail = String(
        record.email ??
        record.userEmail ??
        record.passengerEmail ??
        record.driverEmail ??
        record.profileEmail ??
        ""
      ).trim().toLowerCase();

      const recordOwnerKey = String(record.ownerKey ?? record.driverOwnerKey ?? "").trim().toLowerCase();

      return (
        Boolean(email && recordEmail === email) ||
        Boolean(ownerKey && recordOwnerKey === ownerKey) ||
        Boolean(email && JSON.stringify(record).toLowerCase().includes(email))
      );
    };

    const patchValue = (value: unknown): unknown => {
      if (Array.isArray(value)) {
        return value.map((entry) => patchValue(entry));
      }

      if (value && typeof value === "object") {
        const source = value as Record<string, unknown>;
        const next: Record<string, unknown> = {};

        for (const [key, entry] of Object.entries(source)) {
          next[key] = patchValue(entry);
        }

        if (shouldPatchRecord(next)) {
          return patchResidentFields(next);
        }

        return next;
      }

      if (typeof value === "string") {
        const raw = value.trim().toLowerCase();
        if (raw === "foreigner" || raw === "tourist_foreigner" || raw.includes("turista extranjero")) {
          return label;
        }
      }

      return value;
    };

    const localKeysToPatch: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.includes("rapago")) localKeysToPatch.push(key);
    }

    localKeysToPatch.forEach((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return;

      try {
        const parsed = JSON.parse(raw) as unknown;
        localStorage.setItem(key, JSON.stringify(patchValue(parsed)));
      } catch {
        // No todos los valores rapago son JSON.
      }
    });

    const residentProfile = patchResidentFields({
      ownerKey,
      driverOwnerKey: ownerKey,
      email: item.email ?? "",
      driverEmail: item.email ?? "",
      name: getDriverApplicationFullName(item),
      firstName: item.firstName ?? "",
      lastName: item.lastName ?? "",
      phone: item.phone ?? "",
      rut: item.rut ?? "",
      driverApplicationStatus: "approved",
      updatedAt: new Date().toISOString(),
    });

    localStorage.setItem("rapago_registration_profile", JSON.stringify(residentProfile));
    localStorage.setItem("rapago_driver_registration_profile", JSON.stringify(residentProfile));
    localStorage.setItem("rapago_profile_nationality", label);
    localStorage.setItem("rapago_nationality", label);
    localStorage.setItem("rapago_driver_nationality", label);
    localStorage.setItem("rapago_passenger_fare_type", "resident");
    localStorage.setItem("rapago_profile_passenger_type", "resident");
    localStorage.setItem("rapago_fare_passenger_type", "resident");
    localStorage.setItem("rapago_driver_passenger_fare_type", "resident");
    localStorage.setItem("rapago_driver_fare_passenger_type", "resident");
    localStorage.setItem("rapago_is_resident", "true");
    localStorage.setItem("rapago_driver_is_resident", "true");
    localStorage.setItem("rapago_residence_verification_status", "approved");

    window.dispatchEvent(new CustomEvent("rapago:passenger-profile-updated", {
      detail: {
        email,
        role: "driver",
        status: "active",
        passengerFareType: "resident",
        farePassengerType: "resident",
        nationality: label,
        isResident: true,
        isVerified: true,
      },
    }));

    window.dispatchEvent(new CustomEvent("rapago:driver-application-approved-resident", {
      detail: {
        email,
        ownerKey,
        passengerFareType: "resident",
        nationality: label,
        isResident: true,
      },
    }));
  } catch {
    // No bloquea la aprobación del conductor.
  }
}

async function trySyncApprovedDriverResidentToApi(
  token: string | null | undefined,
  userId: string | null | undefined,
  item: AdminDriverApplicationRecord,
): Promise<void> {
  if (!token || !userId) return;

  const apiBase =
    (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_API_BASE_URL ??
    (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_API_URL ??
    "";

  const base = String(apiBase || "").replace(/\/$/, "");
  if (!base) return;

  const payload = {
    role: "driver",
    status: "active",
    isVerified: true,
    is_verified: true,
    passengerFareType: "resident",
    farePassengerType: "resident",
    passengerType: "resident",
    nationality: "Rapa Nui normal",
    isResident: true,
    is_resident: true,
    driverApplicationId: item.id,
    driverApplicationStatus: "approved",
    driverApprovedAt: new Date().toISOString(),
  };

  const endpoints = [
    `${base}/admin/users/${userId}/approve-driver-resident`,
    `${base}/admin/users/${userId}/driver-resident`,
    `${base}/admin/users/${userId}`,
    `${base}/admin/users/${userId}/status`,
  ];

  for (const url of endpoints) {
    try {
      const response = await fetch(url, {
        method: url.endsWith("/status") ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) return;
    } catch {
      // Prueba el siguiente endpoint.
    }
  }
}

const DOC_STATUS_COLOR: Record<string, string> = {
  pending: "warning",
  uploaded: "primary",
  approved: "success",
  rejected: "danger",
};

const DOC_STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  uploaded: "Subido",
  approved: "Aprobado",
  rejected: "Rechazado",
};

const DOC_TYPE_LABEL: Record<string, string> = {
  residence_document: "Residencia Rapa Nui",
  rapa_nui_residence: "Residencia Rapa Nui",
  rapanui_residence: "Residencia Rapa Nui",
  resident_certificate: "Certificado de residencia",
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
        "Documento aprobado, pero no encontré el usuario para activar la cuenta.",
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

  async function keepUserPendingIfResidenceRejected(doc: AdminDocumentData) {
    if (!session?.accessToken || !isResidenceDocument(doc)) return null;

    const user = findDocumentUser(doc);
    if (!user) return null;

    const updatedUser = await adminService.updateUserStatus(
      session.accessToken,
      user.id,
      "pending",
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
          "Documento Rapa Nui aprobado. La cuenta del pasajero quedó activa.",
        );
      } else {
        setToastMessage("Documento aprobado.");
      }
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Error al aprobar documento y activar cuenta.",
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

    setActioning(true);
    setActionError(null);

    try {
      const passengerRejectMessage = `${RAPANUI_RESIDENCE_REJECTION_USER_MESSAGE} Motivo: ${rejectReason.trim()}`;

      const updated = await adminService.reviewDocument(
        session.accessToken,
        actionId,
        "rejected",
        isResidenceDocument(doc) ? passengerRejectMessage : rejectReason.trim(),
      );

      setDocs((prev) => prev.map((d) => (d.id === actionId ? updated : d)));

      if (isResidenceDocument(updated)) {
        await keepUserPendingIfResidenceRejected(updated);
        setToastMessage(
          "Documento Rapa Nui rechazado. El pasajero verá el aviso para elegir otro tipo de usuario o subir otro documento.",
        );
      } else {
        setToastMessage("Documento rechazado.");
      }

      setRejectReason("");
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
        markApprovedDriverApplicationAsRapaNuiResident(reviewed);

        const matchedUser = users.find(
          (user) => normalizeAdminText(user.email) === normalizeAdminText(reviewed.email),
        );

        if (matchedUser && session?.accessToken) {
          try {
            const updatedUser = await adminService.updateUserStatus(
              session.accessToken,
              matchedUser.id,
              "active",
            );

            await trySyncApprovedDriverResidentToApi(session.accessToken, matchedUser.id, reviewed);

            const residentDriverUser = {
              ...updatedUser,
              role: "driver",
              status: "active",
              isVerified: true,
              passengerFareType: "resident",
              farePassengerType: "resident",
              passengerType: "resident",
              passengerFareLabel: "Rapa Nui normal",
              nationality: "Rapa Nui normal",
              isResident: true,
            } as AdminUserData;

            setUsers((prev) =>
              prev.map((user) => (user.id === updatedUser.id ? residentDriverUser : user)),
            );
          } catch {
            await trySyncApprovedDriverResidentToApi(session?.accessToken, matchedUser.id, reviewed);
            // Si el backend no permite activar desde aquí, igual queda aprobada localmente.
          }
        }

        setToastMessage("Postulación de conductor aprobada. El perfil, vehículo y tarifa Rapa Nui normal quedaron habilitados.");
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
          style={{
            margin: "0 0 12px",
            borderRadius: 18,
            background: "linear-gradient(135deg, #2b120f, #8f1d18)",
            color: "#fff",
          }}
        >
          <IonCardContent style={{ padding: "14px 16px" }}>
            <div style={{ fontWeight: 950, fontSize: "1rem" }}>
              Documentos Rapa Nui
            </div>
            <p style={{ margin: "6px 0 0", fontSize: ".84rem", lineHeight: 1.35 }}>
              Al aprobar un documento de residencia Rapa Nui, la cuenta del
              pasajero queda automáticamente habilitada.
            </p>
            <IonBadge color={pendingResidenceDocs > 0 ? "warning" : "success"} style={{ marginTop: 10 }}>
              {pendingResidenceDocs} residencia{pendingResidenceDocs !== 1 ? "s" : ""} pendiente{pendingResidenceDocs !== 1 ? "s" : ""}
            </IonBadge>
          </IonCardContent>
        </IonCard>


        <IonCard
          style={{
            margin: "0 0 12px",
            borderRadius: 18,
            background: "linear-gradient(135deg,#0f172a,#173f39)",
            color: "#fff",
          }}
        >
          <IonCardContent style={{ padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 950, fontSize: "1rem" }}>
                  Postulaciones de conductores
                </div>
                <p style={{ margin: "6px 0 0", fontSize: ".84rem", lineHeight: 1.35 }}>
                  Revisa cédula, licencia, vehículos, fotos y datos enviados desde inscripción. Al aprobar, queda como Rapa Nui normal y usa tarifa Rapa Nui normal.
                </p>
              </div>
              <IonBadge color={pendingDriverApplications > 0 ? "warning" : "success"}>
                {pendingDriverApplications} pendiente{pendingDriverApplications !== 1 ? "s" : ""}
              </IonBadge>
            </div>

            <IonItem
              lines="none"
              style={{
                marginTop: 12,
                borderRadius: 14,
                "--background": "rgba(255,255,255,.08)",
                "--color": "#fff",
              } as CSSProperties}
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
                              Activa cuenta al aprobar
                            </IonBadge>
                          )}
                        </div>

                        {linkedUser && (
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
                                {getPassengerPhone(linkedUser) || "No informado"}
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
                                {getPassengerRut(linkedUser) || "No informado"}
                              </div>
                            </div>
                          </div>
                        )}

                        {extendedDoc.fileUrl && (
                          <IonButton
                            size="small"
                            fill="clear"
                            color="primary"
                            onClick={() => window.open(String(extendedDoc.fileUrl), "_blank")}
                            style={{ marginTop: 6 }}
                          >
                            Ver documento
                          </IonButton>
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
                          "Aprobar y activar"
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

        <IonAlert
          isOpen={actionType === "reject" && actionId !== null}
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
