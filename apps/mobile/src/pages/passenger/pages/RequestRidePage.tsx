import {
  IonAlert,
  IonButton,
  IonContent,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonModal,
  IonNote,
  IonPage,
  IonSpinner,
  IonTextarea,
} from "@ionic/react";
import {
  addOutline,
  airplaneOutline,
  arrowBackOutline,
  arrowForwardOutline,
  flashOutline,
  briefcaseOutline,
  busOutline,
  calendarOutline,
  carOutline,
  cardOutline,
  cashOutline,
  checkmarkCircleOutline,
  closeOutline,
  compassOutline,
  createOutline,
  flowerOutline,
  leafOutline,
  locationOutline,
  locateOutline,
  mapOutline,
  removeOutline,
  searchOutline,
  sunnyOutline,
  sparklesOutline,
  timeOutline,
  alertCircleOutline,
  walkOutline,
  walletOutline,
} from "ionicons/icons";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useHistory } from "react-router-dom";
import { ROUTES } from "../../../navigation/routes.js";
import {
  MapFallback,
  loadRapaGoGoogleMaps,
  type MapGooglePoi,
  type MapPlaceMarker,
} from "../../../components/MapFallback.js";
import { useAuth } from "../../../features/auth/index.js";
import { useKeyboardInset } from "../../../hooks/useKeyboardInset.js";
import {
  ridesService,
  type CreateRideInput,
} from "../../../features/rides/rides.service.js";
import { walletService } from "../../../features/wallet/wallet.service.js";
import {
  createKlapHostedOrder,
  markPendingKlapPaymentStarted,
  openKlapHostedCheckout,
  readPendingKlapPayment,
  clearPendingKlapPayment,
  resetKlapCheckoutForNextOrder,
  savePendingKlapPayment,
  cancelPendingKlapRide,
  type PendingKlapPaymentRecord,
} from "../../../features/payments/klapCheckout.service.js";
import { RIDE_STATUS_LABEL } from "../shared.js";
import { getApiOrigin as getConfiguredApiOrigin } from "../../../services/api/apiBaseUrl.js";
import { preSearchLocationService } from "../../../features/location/preSearchLocation.service.js";
import { RapagoSectionHeader } from "../../../components/RapagoSectionHeader.js";
import "../../../theme/request-ride.css";
import { useRapagoSectionTheme } from "../../../theme/rapagoTheme.js";
import {
  VEHICLE_CATEGORIES,
  vehicleCategoryLabel,
  type VehicleCategory,
} from "@rapa-go/shared";

const LOCAL_PASSENGER_RIDES_KEY = "rapago_local_passenger_rides";
const LOCAL_ADMIN_SCHEDULED_RIDES_KEY = "rapago_admin_scheduled_rides";
const LOCAL_ADMIN_SCHEDULED_RIDE_MIRROR_KEYS = [
  LOCAL_ADMIN_SCHEDULED_RIDES_KEY,
  "rapago_admin_scheduled_rides_v1",
  "rapago_admin_scheduled_rides_v2",
  "rapago_admin_scheduled_rides_force_v1",
  "rapago_bridge_scheduled_rides_v1",
] as const;
const LOCAL_PASSENGER_RIDE_LIMIT = 40;
const LOCAL_ADMIN_SCHEDULED_RIDE_LIMIT = 80;
const RAPAGO_REQUEUED_RIDES_KEY = "rapago_requeued_available_rides_v1";
const RAPAGO_REQUEUED_PASSENGER_FORCE_KEY =
  "rapago_requeued_passenger_visible_rides_v1";
const RAPAGO_REQUEUED_RIDES_EVENT = "rapago:ride-requeued-after-driver-cancel";
const RAPAGO_PASSENGER_PENDING_CHARGES_KEY =
  "rapago_passenger_pending_charges_v1";
const RAPAGO_PASSENGER_PENDING_CHARGE_EVENT =
  "rapago:passenger-pending-charge-updated";

type LocalPassengerRideData = Record<string, unknown>;

type PassengerPendingChargeForRequest = {
  id: string;
  rideId?: string | null;
  rideKey?: string | null;
  passengerEmail?: string | null;
  ownerKey?: string | null;
  ownerUserId?: string | null;
  passengerUserId?: string | null;
  amountClp: number;
  applicableFareClp?: number | null;
  feePercent?: number | null;
  feeCapClp?: number | null;
  type?: string | null;
  status: string;
  adminReviewStatus?: string | null;
  title?: string | null;
  description?: string | null;
  createdAt?: string | null;
  appliedRideId?: string | null;
  appliedAt?: string | null;
};

function normalizePendingChargeEmail(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function normalizePendingChargeUserId(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function getPendingChargeSessionEmail(user: unknown): string {
  if (!user || typeof user !== "object") return "";
  return normalizePendingChargeEmail((user as Record<string, unknown>).email);
}

function getPendingChargeSessionUserId(user: unknown): string {
  if (!user || typeof user !== "object") return "";
  const record = user as Record<string, unknown>;

  return normalizePendingChargeUserId(
    record.id ??
      record.userId ??
      record.uid ??
      record.sub ??
      record.accountId ??
      record.authUserId,
  );
}

function normalizePassengerPendingChargeType(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isPassengerPendingChargeSupportedType(value: unknown): boolean {
  const type = normalizePassengerPendingChargeType(value);

  return (
    type === "no_show" ||
    type === "late_cancel" ||
    type === "late_cancellation" ||
    type === "cancellation" ||
    type === "cancel_after_free_window" ||
    type === "cancel_after_two_minutes"
  );
}

function isPassengerPendingChargeNoShow(value: unknown): boolean {
  return normalizePassengerPendingChargeType(value) === "no_show";
}

function getPassengerPendingChargeDefaultTitle(type: unknown): string {
  return isPassengerPendingChargeNoShow(type)
    ? "No Show aprobado"
    : "Cancelación aprobada";
}

function getPassengerPendingChargeDefaultDescription(type: unknown): string {
  return isPassengerPendingChargeNoShow(type)
    ? "No Show aprobado por administración para sumarlo al próximo viaje."
    : "Cargo por cancelación después de 1 minuto desde la asignación aprobado por administración.";
}

function calculateApprovedPassengerChargeForRequest(
  item: Record<string, unknown>,
): number {
  const type = normalizePassengerPendingChargeType(item.type);
  const isNoShow = isPassengerPendingChargeNoShow(type);

  const configuredPercent = Number(item.feePercent);
  const percent =
    Number.isFinite(configuredPercent) && configuredPercent > 0
      ? Math.min(100, configuredPercent)
      : 30;

  const configuredCap = Number(item.feeCapClp);
  const capClp =
    Number.isFinite(configuredCap) && configuredCap > 0
      ? Math.round(configuredCap)
      : isNoShow
        ? 5000
        : 3000;

  const explicitlyApprovedCandidates = [
    item.approvedFeeClp,
    item.approvedAmountClp,
    item.calculatedFeeClp,
  ];

  const explicitlyApprovedAmount =
    explicitlyApprovedCandidates
      .map((value) => Math.max(0, Math.round(Number(value ?? 0))))
      .find((value) => value > 0) ?? 0;

  if (explicitlyApprovedAmount > 0) {
    return Math.min(capClp, explicitlyApprovedAmount);
  }

  const originalCandidates = [
    item.applicableFareClp,
    item.originalNoShowServiceAmountClp,
    item.originalServiceAmountClp,
    item.totalServiceAmountClp,
    item.serviceAmountClp,
    item.fareClp,
    item.originalAmountClp,
  ];

  const originalAmount =
    originalCandidates
      .map((value) => Math.max(0, Math.round(Number(value ?? 0))))
      .find((value) => value > 0) ?? 0;

  if (originalAmount > 0) {
    return Math.min(
      capClp,
      Math.max(0, Math.round(originalAmount * (percent / 100))),
    );
  }

  // Registros nuevos guardan `amountClp` como penalización ya aprobada.
  // En registros antiguos, el tope impide que se cobre más de lo permitido.
  const rawAmount = Math.max(
    0,
    Math.round(Number(item.amountClp ?? item.amount ?? 0)),
  );

  return Math.min(capClp, rawAmount);
}

function pendingChargeBelongsToCurrentUser(
  item: Record<string, unknown>,
  user: unknown,
): boolean {
  const sessionUserId = getPendingChargeSessionUserId(user);
  const sessionEmail = getPendingChargeSessionEmail(user);

  const ownerUserId = normalizePendingChargeUserId(
    item.ownerUserId ??
      item.passengerUserId ??
      item.userId ??
      item.requesterUserId,
  );

  if (sessionUserId && ownerUserId) {
    return sessionUserId === ownerUserId;
  }

  const ownerEmail = normalizePendingChargeEmail(
    item.passengerEmail ?? item.ownerKey ?? item.userEmail ?? item.email,
  );

  return Boolean(sessionEmail && ownerEmail && sessionEmail === ownerEmail);
}

function readPassengerPendingChargesForRequest(
  user: unknown,
): PassengerPendingChargeForRequest[] {
  try {
    const raw = localStorage.getItem(RAPAGO_PASSENGER_PENDING_CHARGES_KEY);
    const decoded = raw ? (JSON.parse(raw) as unknown) : [];
    const parsed: Array<Record<string, unknown>> = Array.isArray(decoded)
      ? decoded.filter((item): item is Record<string, unknown> =>
          Boolean(item && typeof item === "object"),
        )
      : decoded && typeof decoded === "object"
        ? Object.values(decoded as Record<string, unknown>).filter(
            (item): item is Record<string, unknown> =>
              Boolean(item && typeof item === "object"),
          )
        : [];

    return parsed
      .map((item, index): PassengerPendingChargeForRequest => {
        const type = normalizePassengerPendingChargeType(item.type);
        const amountClp = calculateApprovedPassengerChargeForRequest(item);

        return {
          id: String(item.id ?? `pending-charge-${index}`),
          rideId: typeof item.rideId === "string" ? item.rideId : null,
          rideKey: typeof item.rideKey === "string" ? item.rideKey : null,
          passengerEmail:
            typeof item.passengerEmail === "string"
              ? item.passengerEmail
              : null,
          ownerKey: typeof item.ownerKey === "string" ? item.ownerKey : null,
          ownerUserId:
            typeof item.ownerUserId === "string"
              ? item.ownerUserId
              : typeof item.userId === "string"
                ? item.userId
                : null,
          passengerUserId:
            typeof item.passengerUserId === "string"
              ? item.passengerUserId
              : null,
          amountClp,
          applicableFareClp: Number.isFinite(Number(item.applicableFareClp))
            ? Math.round(Number(item.applicableFareClp))
            : null,
          feePercent: Number.isFinite(Number(item.feePercent))
            ? Number(item.feePercent)
            : 30,
          feeCapClp: Number.isFinite(Number(item.feeCapClp))
            ? Math.round(Number(item.feeCapClp))
            : isPassengerPendingChargeNoShow(type)
              ? 5000
              : 3000,
          type,
          status: String(item.status ?? ""),
          adminReviewStatus:
            typeof item.adminReviewStatus === "string"
              ? item.adminReviewStatus
              : null,
          title:
            typeof item.title === "string"
              ? item.title
              : getPassengerPendingChargeDefaultTitle(type),
          description:
            typeof item.description === "string"
              ? item.description
              : getPassengerPendingChargeDefaultDescription(type),
          createdAt: typeof item.createdAt === "string" ? item.createdAt : null,
          appliedRideId:
            typeof item.appliedRideId === "string" ? item.appliedRideId : null,
          appliedAt: typeof item.appliedAt === "string" ? item.appliedAt : null,
        };
      })
      .filter((charge) => {
        const rawCharge =
          parsed.find((item) => String(item.id ?? "") === String(charge.id)) ??
          (charge as unknown as Record<string, unknown>);

        const belongsToUser = pendingChargeBelongsToCurrentUser(
          rawCharge,
          user,
        );

        const status = String(charge.status ?? "").toLowerCase();
        const adminStatus = String(
          charge.adminReviewStatus ?? "",
        ).toLowerCase();

        const approvedByAdmin =
          status === "pending_next_ride" ||
          adminStatus === "charge_pending_next_ride";

        const notApplied =
          !charge.appliedRideId &&
          !charge.appliedAt &&
          status !== "applied_to_next_ride" &&
          adminStatus !== "applied_to_next_ride";

        return (
          belongsToUser &&
          isPassengerPendingChargeSupportedType(charge.type) &&
          charge.amountClp > 0 &&
          approvedByAdmin &&
          notApplied
        );
      })
      .sort(
        (a, b) =>
          new Date(String(a.createdAt ?? 0)).getTime() -
          new Date(String(b.createdAt ?? 0)).getTime(),
      );
  } catch {
    return [];
  }
}

type BackendRidePolicyChargeForRequest = {
  id: string;
  sourceRideId: string;
  ownerUserId: string;
  type: "late_cancellation" | "no_show";
  status: string;
  paymentMethod: string | null;
  applicableFareClp: number;
  feePercent: number;
  feeCapClp: number;
  calculatedAmountClp: number;
  approvedAmountClp: number | null;
  amountClp: number;
  reason: string | null;
  adminDecisionReason: string | null;
  appliedToRideId: string | null;
  appliedAt: string | null;
  createdAt: string;
};

async function fetchMyApprovedPolicyChargesForRequest(
  accessToken: string,
): Promise<PassengerPendingChargeForRequest[]> {
  const response = await fetch(
    `${getRapaGoApiBaseUrl()}/api/rides/policy-charges/me`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    },
  );

  const payload = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  if (!response.ok) {
    const message =
      typeof payload.message === "string"
        ? payload.message
        : "No se pudieron cargar los cargos aprobados.";
    throw new Error(message);
  }

  const data = Array.isArray(payload.data)
    ? payload.data
    : Array.isArray(payload.charges)
      ? payload.charges
      : [];

  return data
    .filter((item): item is BackendRidePolicyChargeForRequest =>
      Boolean(item && typeof item === "object"),
    )
    .map((item) => ({
      id: String(item.id),
      rideId: String(item.sourceRideId),
      rideKey: `ride:${String(item.sourceRideId)}`,
      ownerUserId: String(item.ownerUserId),
      passengerUserId: String(item.ownerUserId),
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
      applicableFareClp: Math.max(
        0,
        Math.round(Number(item.applicableFareClp ?? 0)),
      ),
      feePercent: Number(item.feePercent ?? 0),
      feeCapClp: Math.max(0, Math.round(Number(item.feeCapClp ?? 0))),
      type: item.type === "no_show" ? "no_show" : "late_cancellation",
      status: "pending_next_ride",
      adminReviewStatus: "charge_pending_next_ride",
      title:
        item.type === "no_show" ? "No Show aprobado" : "Cancelación aprobada",
      description:
        item.adminDecisionReason ??
        (item.type === "no_show"
          ? "No Show aprobado por administración para sumarlo al próximo viaje."
          : "Cargo por cancelación aprobado por administración para sumarlo al próximo viaje."),
      createdAt: item.createdAt,
      appliedRideId: item.appliedToRideId,
      appliedAt: item.appliedAt,
    }))
    .filter(
      (charge) =>
        charge.amountClp > 0 && !charge.appliedRideId && !charge.appliedAt,
    );
}

function mergePassengerPendingChargesForRequest(
  backendCharges: PassengerPendingChargeForRequest[],
  localCharges: PassengerPendingChargeForRequest[],
): PassengerPendingChargeForRequest[] {
  const byKey = new Map<string, PassengerPendingChargeForRequest>();

  for (const charge of localCharges) {
    const key = `${String(charge.rideId ?? charge.rideKey ?? charge.id)}:${String(charge.type ?? "")}`;
    byKey.set(key, charge);
  }

  // Backend gana sobre cualquier espejo local.
  for (const charge of backendCharges) {
    const key = `${String(charge.rideId ?? charge.rideKey ?? charge.id)}:${String(charge.type ?? "")}`;
    byKey.set(key, charge);
  }

  return [...byKey.values()].sort(
    (a, b) =>
      new Date(String(a.createdAt ?? 0)).getTime() -
      new Date(String(b.createdAt ?? 0)).getTime(),
  );
}

function writePassengerPendingChargesForRequest(
  charges: PassengerPendingChargeForRequest[],
): void {
  try {
    localStorage.setItem(
      RAPAGO_PASSENGER_PENDING_CHARGES_KEY,
      JSON.stringify(charges.slice(0, 250)),
    );

    window.dispatchEvent(
      new CustomEvent(RAPAGO_PASSENGER_PENDING_CHARGE_EVENT, {
        detail: { charges },
      }),
    );

    window.dispatchEvent(
      new CustomEvent("rapago:wallet-updated", {
        detail: { charges },
      }),
    );
  } catch {
    // No bloquea la solicitud.
  }
}

function markPassengerPendingChargesAppliedToRide(
  user: unknown,
  rideId: string | null,
): void {
  try {
    const raw = localStorage.getItem(RAPAGO_PASSENGER_PENDING_CHARGES_KEY);
    const parsed = raw
      ? (JSON.parse(raw) as Array<Record<string, unknown>>)
      : [];

    if (!Array.isArray(parsed)) return;

    const now = new Date().toISOString();
    const safeRideId = rideId || `local-${Date.now()}`;
    let changed = false;

    const next = parsed.map((item) => {
      const type = normalizePassengerPendingChargeType(item.type);
      const status = String(item.status ?? "").toLowerCase();
      const adminStatus = String(item.adminReviewStatus ?? "").toLowerCase();

      const approvedAmountClp =
        calculateApprovedPassengerChargeForRequest(item);

      const shouldApply =
        pendingChargeBelongsToCurrentUser(item, user) &&
        isPassengerPendingChargeSupportedType(type) &&
        approvedAmountClp > 0 &&
        (status === "pending_next_ride" ||
          adminStatus === "charge_pending_next_ride") &&
        !item.appliedRideId &&
        !item.appliedAt;

      if (!shouldApply) return item;

      changed = true;

      return {
        ...item,
        amountClp: approvedAmountClp,
        feePercent:
          Number.isFinite(Number(item.feePercent)) &&
          Number(item.feePercent) > 0
            ? Number(item.feePercent)
            : 30,
        feeCapClp:
          Number.isFinite(Number(item.feeCapClp)) && Number(item.feeCapClp) > 0
            ? Math.round(Number(item.feeCapClp))
            : isPassengerPendingChargeNoShow(type)
              ? 5000
              : 3000,
        status: "applied_to_next_ride",
        adminReviewStatus: "applied_to_next_ride",
        appliedRideId: safeRideId,
        appliedAt: now,
      };
    });

    if (!changed) return;

    localStorage.setItem(
      RAPAGO_PASSENGER_PENDING_CHARGES_KEY,
      JSON.stringify(next.slice(0, 250)),
    );

    window.dispatchEvent(
      new CustomEvent(RAPAGO_PASSENGER_PENDING_CHARGE_EVENT, {
        detail: { charges: next },
      }),
    );

    window.dispatchEvent(
      new CustomEvent("rapago:admin-passenger-pending-charge-updated", {
        detail: { charges: next },
      }),
    );

    window.dispatchEvent(
      new CustomEvent("rapago:wallet-updated", {
        detail: { charges: next },
      }),
    );
  } catch {
    // No bloquea la solicitud.
  }
}

const RAPAGO_WALLET_BENEFITS_KEY_REQUEST = "rapago_wallet_benefits_v1";
const RAPAGO_WALLET_BENEFIT_EVENT_REQUEST = "rapago:wallet-benefit-updated";

type PassengerWalletBenefitForRequest = {
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
  appliedRideId?: string | null;
  appliedAt?: string | null;
  usedAmountClp?: number | null;
};

function normalizeWalletBenefitEmailForRequest(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function getWalletBenefitSessionEmailForRequest(user: unknown): string {
  if (!user || typeof user !== "object") return "";
  return normalizeWalletBenefitEmailForRequest(
    (user as Record<string, unknown>).email,
  );
}

function isPassengerWalletBenefitAvailableForRequest(
  benefit: PassengerWalletBenefitForRequest,
): boolean {
  const status = String(benefit.status ?? "").toLowerCase();
  const adminStatus = String(benefit.adminReviewStatus ?? "").toLowerCase();

  return (
    (status === "available" ||
      status === "approved" ||
      adminStatus === "admin_approved") &&
    benefit.amountClp > 0
  );
}

function readPassengerWalletBenefitsForRequest(
  user: unknown,
): PassengerWalletBenefitForRequest[] {
  try {
    const sessionEmail = getWalletBenefitSessionEmailForRequest(user);
    const raw = localStorage.getItem(RAPAGO_WALLET_BENEFITS_KEY_REQUEST);
    const parsed = raw
      ? (JSON.parse(raw) as Array<Record<string, unknown>>)
      : [];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map(
        (item, index): PassengerWalletBenefitForRequest => ({
          id: String(item.id ?? `wallet-benefit-${index}`),
          rideId: typeof item.rideId === "string" ? item.rideId : null,
          passengerEmail:
            typeof item.passengerEmail === "string"
              ? item.passengerEmail
              : null,
          ownerKey: typeof item.ownerKey === "string" ? item.ownerKey : null,
          amountClp: Math.max(
            0,
            Math.round(Number(item.amountClp ?? item.amount ?? 0)),
          ),
          status: String(item.status ?? "pending_admin"),
          source: typeof item.source === "string" ? item.source : null,
          title: typeof item.title === "string" ? item.title : null,
          description:
            typeof item.description === "string" ? item.description : null,
          createdAt: typeof item.createdAt === "string" ? item.createdAt : null,
          approvedAt:
            typeof item.approvedAt === "string" ? item.approvedAt : null,
          approvedBy:
            typeof item.approvedBy === "string" ? item.approvedBy : null,
          adminReviewStatus:
            typeof item.adminReviewStatus === "string"
              ? item.adminReviewStatus
              : null,
          fareClp: Number.isFinite(Number(item.fareClp))
            ? Math.round(Number(item.fareClp))
            : null,
          paidClp: Number.isFinite(Number(item.paidClp))
            ? Math.round(Number(item.paidClp))
            : null,
          appliedRideId:
            typeof item.appliedRideId === "string" ? item.appliedRideId : null,
          appliedAt: typeof item.appliedAt === "string" ? item.appliedAt : null,
          usedAmountClp: Number.isFinite(Number(item.usedAmountClp))
            ? Math.round(Number(item.usedAmountClp))
            : null,
        }),
      )
      .filter((benefit) => {
        if (!isPassengerWalletBenefitAvailableForRequest(benefit)) return false;
        const owner = normalizeWalletBenefitEmailForRequest(
          benefit.passengerEmail || benefit.ownerKey,
        );
        return Boolean(sessionEmail && owner && owner === sessionEmail);
      })
      .sort(
        (a, b) =>
          new Date(String(a.createdAt ?? 0)).getTime() -
          new Date(String(b.createdAt ?? 0)).getTime(),
      );
  } catch {
    return [];
  }
}

function getPassengerWalletBenefitTotalForRequest(_user: unknown): number {
  // Phase 2 security:
  // Legacy localStorage wallet benefits are visual/cache only.
  // They must not reduce ride fares or payment amounts.
  // Authoritative credits must come from backend wallet transactions.
  return 0;
}

function markPassengerWalletBenefitsUsedForRide(input: {
  user: unknown;
  rideId: string | null;
  amountToUseClp: number;
  originText: string;
  destinationText: string;
  fareBeforeWalletClp: number;
  fareAfterWalletClp: number;
}): void {
  // Phase 2 security:
  // Do not mutate legacy localStorage as if money was applied.
  // Backend must approve/apply credits before any financial discount is valid.
  const amountToUse = 0;
  if (amountToUse <= 0) return;

  try {
    const sessionEmail = getWalletBenefitSessionEmailForRequest(input.user);
    const raw = localStorage.getItem(RAPAGO_WALLET_BENEFITS_KEY_REQUEST);
    const parsed = raw
      ? (JSON.parse(raw) as Array<Record<string, unknown>>)
      : [];
    if (!Array.isArray(parsed)) return;

    let remaining = amountToUse;
    const now = new Date().toISOString();
    const rideId = input.rideId || `local-${Date.now()}`;
    const extraAvailableBenefits: Array<Record<string, unknown>> = [];

    const next = parsed.map((item, index) => {
      const benefit: PassengerWalletBenefitForRequest = {
        id: String(item.id ?? `wallet-benefit-${index}`),
        passengerEmail:
          typeof item.passengerEmail === "string" ? item.passengerEmail : null,
        ownerKey: typeof item.ownerKey === "string" ? item.ownerKey : null,
        amountClp: Math.max(
          0,
          Math.round(Number(item.amountClp ?? item.amount ?? 0)),
        ),
        status: String(item.status ?? "pending_admin"),
        adminReviewStatus:
          typeof item.adminReviewStatus === "string"
            ? item.adminReviewStatus
            : null,
      };
      const owner = normalizeWalletBenefitEmailForRequest(
        benefit.passengerEmail || benefit.ownerKey,
      );
      const belongsToUser = Boolean(
        sessionEmail && owner && owner === sessionEmail,
      );

      if (
        !belongsToUser ||
        remaining <= 0 ||
        !isPassengerWalletBenefitAvailableForRequest(benefit)
      ) {
        return item;
      }

      const benefitAmount = Math.max(
        0,
        Math.round(Number(benefit.amountClp ?? 0)),
      );
      const usedAmount = Math.min(benefitAmount, remaining);
      remaining -= usedAmount;

      if (benefitAmount > usedAmount) {
        extraAvailableBenefits.push({
          ...item,
          id: `${String(item.id ?? benefit.id)}-saldo-${Date.now()}`,
          amountClp: benefitAmount - usedAmount,
          status: "available",
          adminReviewStatus: "admin_approved",
          title: item.title ?? "Saldo a favor",
          description: `Saldo restante disponible después de usar ${formatCLP(usedAmount)} en un viaje.`,
          createdAt: now,
          appliedRideId: null,
          appliedAt: null,
          usedAmountClp: null,
        });
      }

      return {
        ...item,
        amountClp: usedAmount,
        status: "used",
        adminReviewStatus: "used_in_ride",
        appliedRideId: rideId,
        appliedAt: now,
        usedAt: now,
        usedAmountClp: usedAmount,
        originText: input.originText,
        destinationText: input.destinationText,
        fareBeforeWalletClp: input.fareBeforeWalletClp,
        fareAfterWalletClp: input.fareAfterWalletClp,
        title: item.title ?? "Beneficio usado",
        description: `Usaste ${formatCLP(usedAmount)} como descuento en ${input.originText} → ${input.destinationText}.`,
      };
    });

    localStorage.setItem(
      RAPAGO_WALLET_BENEFITS_KEY_REQUEST,
      JSON.stringify([...extraAvailableBenefits, ...next].slice(0, 250)),
    );
    window.dispatchEvent(new CustomEvent(RAPAGO_WALLET_BENEFIT_EVENT_REQUEST));
    window.dispatchEvent(new CustomEvent("rapago:wallet-updated"));
  } catch {
    // No bloquea la solicitud si localStorage falla.
  }
}

function isPassengerRolePermissionMessage(message: unknown): boolean {
  const text = String(message ?? "").toLowerCase();

  return (
    text.includes("403") ||
    text.includes("forbidden") ||
    text.includes("only passengers can create ride requests") ||
    text.includes("only passengers can access ride requests") ||
    text.includes("only passengers") ||
    text.includes("solo pasajeros") ||
    text.includes("no autorizado") ||
    text.includes("unauthorized")
  );
}

function readLocalPassengerRides(): LocalPassengerRideData[] {
  try {
    const raw = localStorage.getItem(LOCAL_PASSENGER_RIDES_KEY);
    const parsed = raw ? (JSON.parse(raw) as LocalPassengerRideData[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function compactRideForLocalStorage(
  ride: LocalPassengerRideData,
): LocalPassengerRideData {
  const copy: LocalPassengerRideData = { ...ride };

  // Las fotos grandes no deben repetirse dentro de cada viaje.
  // Se consultan desde el perfil público del conductor para evitar lentitud en celular.
  delete copy.driverVehicleImageDataUrl;
  delete copy.driverVehiclePhotoDataUrl;
  delete copy.vehicleImageDataUrl;
  delete copy.vehiclePhotoDataUrl;
  delete copy.driverProfileImageDataUrl;
  delete copy.profileImageDataUrl;
  delete copy.driverPhotoBase64;
  delete copy.vehiclePhotoBase64;
  delete copy.profilePhotoBase64;
  delete copy.carPhotoBase64;

  for (const key of [
    "driverProfilePhotoUrl",
    "profilePhotoUrl",
    "vehiclePhotoUrl",
    "driverVehiclePhotoUrl",
  ]) {
    const value = copy[key];

    if (
      typeof value === "string" &&
      value.startsWith("data:") &&
      value.length > 1500
    ) {
      delete copy[key];
    }
  }

  return copy;
}

function saveLocalPassengerRides(rides: LocalPassengerRideData[]): void {
  try {
    const compacted = rides
      .map(compactRideForLocalStorage)
      .slice(0, LOCAL_PASSENGER_RIDE_LIMIT);

    localStorage.setItem(LOCAL_PASSENGER_RIDES_KEY, JSON.stringify(compacted));
    window.dispatchEvent(new CustomEvent("rapago:passenger-rides-updated"));
  } catch {
    // No bloquea la pantalla si el navegador no permite guardar localmente.
  }
}

const REQUEST_ACTIVE_STATUSES = [
  "scheduled",
  "driver_scheduled",
  "accepted",
  "driver_en_route",
  "driver_arrived",
  "in_progress",
];

const REQUEST_TERMINAL_STATUSES = [
  "completed",
  "complete",
  "finished",
  "done",
  "cancelled",
  "canceled",
  "driver_cancelled",
  "passenger_cancelled",
  "rejected",
  "expired",
  "no_driver",
  "no_driver_available",
];

const IMMEDIATE_RIDE_ACTIVE_WINDOW_MS = 12 * 60 * 60 * 1000;
const REQUEUED_RIDE_ACTIVE_WINDOW_MS = 6 * 60 * 60 * 1000;
const SCHEDULED_RIDE_GRACE_AFTER_PICKUP_MS = 4 * 60 * 60 * 1000;
const SCHEDULED_RIDE_MAX_FUTURE_MS = 31 * 24 * 60 * 60 * 1000;

function normalizeRideStatus(status: unknown): string {
  return String(status ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function readRideDateMs(
  ride: LocalPassengerRideData,
  keys: string[],
): number | null {
  for (const key of keys) {
    const value = ride[key];
    if (!value) continue;

    const parsed = new Date(String(value)).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

function readRideScheduledMs(ride: LocalPassengerRideData): number | null {
  return readRideDateMs(ride, [
    "scheduledAt",
    "scheduledPickupAt",
    "pickupScheduledAt",
    "scheduleActivationAt",
    "dispatchAt",
    "autoAssignAt",
  ]);
}

function readRideActivityMs(ride: LocalPassengerRideData): number | null {
  return readRideDateMs(ride, [
    "updatedAt",
    "acceptedAt",
    "enRouteAt",
    "arrivedAt",
    "startedAt",
    "requestedAt",
    "createdAt",
    "requeuedAt",
    "cancelledAt",
  ]);
}

function getNestedString(source: unknown, path: string[]): string | null {
  let current: unknown = source;

  for (const key of path) {
    if (!current || typeof current !== "object") return null;
    current = (current as Record<string, unknown>)[key];
  }

  return typeof current === "string" && current.trim() ? current.trim() : null;
}

function rideBelongsToSessionPassenger(
  ride: LocalPassengerRideData,
  user?: unknown,
): boolean {
  const currentEmail = getSessionEmail(user)?.toLowerCase();
  if (!currentEmail) return true;

  const rideEmail =
    getNestedString(ride, ["passengerEmail"]) ??
    getNestedString(ride, ["userEmail"]) ??
    getNestedString(ride, ["email"]) ??
    getNestedString(ride, ["passenger", "email"]) ??
    getNestedString(ride, ["user", "email"]);

  if (!rideEmail) return true;

  return rideEmail.toLowerCase() === currentEmail;
}

function readRequeuedPassengerRidesForRequest(): LocalPassengerRideData[] {
  try {
    const all: LocalPassengerRideData[] = [];

    for (const key of [
      RAPAGO_REQUEUED_RIDES_KEY,
      RAPAGO_REQUEUED_PASSENGER_FORCE_KEY,
    ]) {
      const raw = localStorage.getItem(key);
      const parsed = raw ? (JSON.parse(raw) as LocalPassengerRideData[]) : [];
      if (Array.isArray(parsed)) all.push(...parsed);
    }

    return all.map((ride) => ({
      ...ride,
      status: "requested",
      cancelledAt: null,
      cancelledByRole: null,
      cancellationReason: null,
      driverName: null,
      driverPhone: null,
      requeuedAt:
        ride.requeuedAt ??
        ride.cancelledAt ??
        ride.updatedAt ??
        ride.requestedAt ??
        ride.createdAt ??
        null,
      requeuedReason: "driver_cancelled",
      forceActiveAfterDriverCancel: true,
      passengerNotice:
        "Tu conductor canceló el viaje, estamos buscando uno nuevo.",
    }));
  } catch {
    return [];
  }
}

function isRequestDriverCancelledRequeuedRide(
  ride: LocalPassengerRideData,
): boolean {
  const status = normalizeRideStatus(ride.status);
  const cancelledBy = normalizeRideStatus(
    ride.cancelledByRole ?? ride.cancelledBy,
  );
  const reason = normalizeRideStatus(
    ride.requeuedReason ?? ride.requeueReason ?? ride.cancellationReason,
  );
  const notice = normalizeRideStatus(
    ride.passengerNotice ?? ride.passengerNotification ?? ride.notes,
  );

  if (cancelledBy.includes("passenger") || cancelledBy.includes("pasajero"))
    return false;

  return (
    ride.forceActiveAfterDriverCancel === true ||
    reason.includes("driver_cancelled") ||
    reason.includes("conductor_cancel") ||
    notice.includes("tu conductor cancel") ||
    notice.includes("estamos buscando uno nuevo") ||
    (status === "cancelled" &&
      (cancelledBy.includes("driver") ||
        cancelledBy.includes("conductor") ||
        reason.includes("driver") ||
        reason.includes("conductor")))
  );
}

function isPassengerRideActiveForNewRequest(
  ride: LocalPassengerRideData,
  user?: unknown,
  nowMs = Date.now(),
): boolean {
  if (!rideBelongsToSessionPassenger(ride, user)) return false;

  const status = normalizeRideStatus(ride.status);

  if (!status || REQUEST_TERMINAL_STATUSES.includes(status)) return false;

  const isRequeued = isRequestDriverCancelledRequeuedRide(ride);

  // No bloqueamos por solicitudes "requested" guardadas localmente.
  // Esas son las que más se quedan pegadas cuando se prueba la app o falla el navegador.
  // Si realmente existe una solicitud activa, el backend la validará al crear el viaje.
  if (status === "requested" && !isRequeued) return false;

  const isKnownActiveStatus = REQUEST_ACTIVE_STATUSES.includes(status);

  if (!isRequeued && !isKnownActiveStatus) return false;

  if (status === "scheduled" || status === "driver_scheduled") {
    const scheduledMs = readRideScheduledMs(ride);

    // Si una reserva antigua quedó pegada sin fecha válida, no debe bloquear nuevas solicitudes.
    if (scheduledMs == null) return false;

    return (
      scheduledMs >= nowMs - SCHEDULED_RIDE_GRACE_AFTER_PICKUP_MS &&
      scheduledMs <= nowMs + SCHEDULED_RIDE_MAX_FUTURE_MS
    );
  }

  const activityMs = readRideActivityMs(ride);

  // Evita el error permanente: viajes viejos/pegados sin fecha no bloquean el botón.
  if (activityMs == null) return false;

  const activeWindow = isRequeued
    ? REQUEUED_RIDE_ACTIVE_WINDOW_MS
    : IMMEDIATE_RIDE_ACTIVE_WINDOW_MS;

  return (
    activityMs >= nowMs - activeWindow && activityMs <= nowMs + 5 * 60 * 1000
  );
}

function hasPassengerActiveRideForRequest(user?: unknown): boolean {
  const rides = [
    ...readLocalPassengerRides(),
    ...readRequeuedPassengerRidesForRequest(),
  ];
  const nowMs = Date.now();

  return rides.some((ride) =>
    isPassengerRideActiveForNewRequest(ride, user, nowMs),
  );
}

function createLocalPassengerRide(input: {
  originText: string;
  destinationText: string;
  notes?: string | null;
  passengerNote?: string | null;
  estimatedFareClp?: number | null;
  rideMode?: RideMode | null;
  tripFareMode?: TripFareMode | null;
  scheduledAt?: string | null;
  returnScheduledAt?: string | null;
  scheduleKind?: "airport_pickup" | "round_trip_promotion" | null;
  passengerName?: string | null;
  passengerEmail?: string | null;
  passengerFareType?: PassengerFareType | null;
  passengerFareLabel?: string | null;
  airportWelcomeOption?: AirportWelcomeOption | null;
  flowerLeiRequested?: boolean | null;
  flowerLeiQuantity?: number | null;
  airportWelcomeSurchargeClp?: number | null;
  optionalServicesTotalClp?: number | null;
  baseFareBeforeExtrasClp?: number | null;
  airportWelcomeLabel?: string | null;
}): LocalPassengerRideData {
  const now = new Date().toISOString();
  const scheduleFields = buildRideScheduleFields({
    rideMode: input.rideMode ?? "now",
    tripFareMode: input.tripFareMode ?? "one_way",
    scheduledAt: input.scheduledAt ?? "",
    returnScheduledAt: input.returnScheduledAt ?? "",
    scheduleKind: input.scheduleKind ?? "airport_pickup",
  });
  const isScheduled = scheduleFields.isScheduled === true;

  return {
    id: `local-${Date.now()}`,
    originText: input.originText,
    destinationText: input.destinationText,
    notes: input.notes ?? null,
    passengerNote: sanitizePassengerRideNote(input.passengerNote) || null,
    passengerName: input.passengerName ?? null,
    passengerEmail: input.passengerEmail ?? null,
    passengerFareType: input.passengerFareType ?? null,
    farePassengerType: input.passengerFareType ?? null,
    passengerType: input.passengerFareType ?? null,
    passengerFareLabel:
      input.passengerFareLabel ??
      (input.passengerFareType
        ? passengerFareTypeLabel(input.passengerFareType)
        : null),
    nationality:
      input.passengerFareLabel ??
      (input.passengerFareType
        ? passengerFareTypeLabel(input.passengerFareType)
        : null),
    isResident: input.passengerFareType === "resident",
    status: isScheduled ? "scheduled" : "requested",
    requestedAt: now,
    acceptedAt: null,
    enRouteAt: null,
    arrivedAt: null,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    cancellationReason: null,
    cancelledByRole: null,
    estimatedFareClp: input.estimatedFareClp ?? null,
    originalFareClp: null,
    discountApplied: false,
    discountPercent: null,
    driverName: null,
    driverPhone: null,
    driverRatingAverage: null,
    driverRatingCount: null,
    driverVehicleBrand: null,
    driverVehicleModel: null,
    driverVehicleColor: null,
    driverVehiclePlate: null,
    driverVehicleYear: null,
    driverVehicleImageDataUrl: null,
    driverVehiclePhotoDataUrl: null,
    driverProfileImageDataUrl: null,
    driverProfilePhotoUrl: null,
    isOfflineBooking: false,
    airportWelcomeOption: input.airportWelcomeOption ?? null,
    airportWelcomeLabel:
      input.airportWelcomeLabel ??
      (input.airportWelcomeOption === "flower_lei"
        ? "Collar de flores Rapa Nui"
        : input.airportWelcomeOption === "none"
          ? "Solo recogida"
          : null),
    flowerLeiRequested: input.flowerLeiRequested ?? false,
    flowerLeiQuantity:
      input.flowerLeiQuantity ?? (input.flowerLeiRequested ? 1 : 0),
    flowerLeiSurchargeClp: input.airportWelcomeSurchargeClp ?? 0,
    airportWelcomeSurchargeClp: input.airportWelcomeSurchargeClp ?? 0,
    optionalServicesTotalClp:
      input.optionalServicesTotalClp ?? input.airportWelcomeSurchargeClp ?? 0,
    baseFareBeforeExtrasClp:
      input.baseFareBeforeExtrasClp ?? input.estimatedFareClp ?? null,
    ...scheduleFields,
  };
}

function readLocalAdminScheduledRides(): LocalPassengerRideData[] {
  try {
    const all: LocalPassengerRideData[] = [];

    for (const key of LOCAL_ADMIN_SCHEDULED_RIDE_MIRROR_KEYS) {
      const raw = localStorage.getItem(key);
      const parsed = raw ? (JSON.parse(raw) as LocalPassengerRideData[]) : [];
      if (Array.isArray(parsed)) all.push(...parsed);
    }

    const seen = new Set<string>();

    return all.filter((ride) => {
      const key = getLocalAdminScheduledRideKey(ride);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } catch {
    return [];
  }
}

function saveLocalAdminScheduledRides(rides: LocalPassengerRideData[]): void {
  try {
    const compacted = rides
      .map(compactRideForLocalStorage)
      .slice(0, LOCAL_ADMIN_SCHEDULED_RIDE_LIMIT);

    for (const key of LOCAL_ADMIN_SCHEDULED_RIDE_MIRROR_KEYS) {
      localStorage.setItem(key, JSON.stringify(compacted));
    }

    if (compacted[0]) {
      localStorage.setItem(
        "rapago_last_scheduled_ride_for_admin",
        JSON.stringify(compacted[0]),
      );
    }

    window.dispatchEvent(
      new CustomEvent("rapago:admin-scheduled-rides-updated", {
        detail: { rides: compacted },
      }),
    );
  } catch {
    // No bloquea la pantalla si el navegador no permite guardar localmente.
  }
}

function upsertLocalAdminScheduledRide(ride: LocalPassengerRideData): void {
  if (ride.isScheduled !== true) return;
  const current = readLocalAdminScheduledRides();
  const key = getLocalAdminScheduledRideKey(ride);
  const withoutDuplicate = current.filter(
    (item) => getLocalAdminScheduledRideKey(item) !== key,
  );
  saveLocalAdminScheduledRides([ride, ...withoutDuplicate]);
}

function getLocalAdminScheduledRideKey(ride: LocalPassengerRideData): string {
  return [
    ride.scheduledAt ?? ride.scheduledPickupAt ?? "",
    ride.originText ?? "",
    ride.destinationText ?? "",
    ride.passengerEmail ?? "",
  ]
    .map((value) => String(value).trim().toLowerCase())
    .join("|");
}

function createLocalAdminScheduledRide(input: {
  originText: string;
  destinationText: string;
  notes?: string | null;
  passengerNote?: string | null;
  estimatedFareClp?: number | null;
  rideMode: RideMode;
  tripFareMode: TripFareMode;
  scheduledAt: string;
  returnScheduledAt: string;
  scheduleKind?: "airport_pickup" | "round_trip_promotion" | null;
  passengerName?: string | null;
  passengerEmail?: string | null;
  passengerFareType?: PassengerFareType | null;
  passengerFareLabel?: string | null;
  airportWelcomeOption?: AirportWelcomeOption | null;
  flowerLeiRequested?: boolean | null;
  flowerLeiQuantity?: number | null;
  airportWelcomeSurchargeClp?: number | null;
  optionalServicesTotalClp?: number | null;
  baseFareBeforeExtrasClp?: number | null;
  airportWelcomeLabel?: string | null;
}): LocalPassengerRideData {
  const base = createLocalPassengerRide(input);
  const isRoundTripPromotion = input.scheduleKind === "round_trip_promotion";

  return {
    ...base,
    id: `admin-local-${Date.now()}`,
    createdAt: new Date().toISOString(),
    status: "scheduled",
    scheduleStatus: "frozen_until_activation",
    adminScheduleStatus: isRoundTripPromotion
      ? "pending_admin_round_trip_promotion"
      : "pending_admin_airport_pickup",
    reservationStatus: isRoundTripPromotion
      ? "round_trip_promotion_reserved"
      : "airport_pickup_reserved",
    passengerName: input.passengerName || "Pasajero agendado",
    passengerEmail: input.passengerEmail || "sin-correo-local",
    passengerPhone: null,
    driverUserId: null,
    availableForDrivers: false,
    visibleToDrivers: false,
    driverQueueBlocked: true,
    frozenForDrivers: true,
    driverFrozenUntil: base.scheduleActivationAt ?? base.dispatchAt ?? null,
    adminVisibleNow: true,
    adminRequiresReview: true,
    airportPickupBooking: !isRoundTripPromotion,
    roundTripPromotionBooking: isRoundTripPromotion,
    bookingPurpose: isRoundTripPromotion
      ? "round_trip_promotion"
      : "airport_pickup",
    serviceType: isRoundTripPromotion
      ? "round_trip_promotion"
      : "airport_pickup",
    localOnly: true,
  };
}

function getSessionDisplayName(user: unknown): string | null {
  if (!user || typeof user !== "object") return null;
  const data = user as Record<string, unknown>;
  const name = data.name ?? data.fullName ?? data.firstName;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

function getSessionEmail(user: unknown): string | null {
  if (!user || typeof user !== "object") return null;
  const email = (user as Record<string, unknown>).email;
  return typeof email === "string" && email.trim() ? email.trim() : null;
}

function saveLocalPassengerRide(input: {
  originText: string;
  destinationText: string;
  notes?: string | null;
  estimatedFareClp?: number | null;
  rideMode?: RideMode | null;
  tripFareMode?: TripFareMode | null;
  scheduledAt?: string | null;
  returnScheduledAt?: string | null;
  passengerName?: string | null;
  passengerEmail?: string | null;
  passengerFareType?: PassengerFareType | null;
  passengerFareLabel?: string | null;
  airportWelcomeOption?: AirportWelcomeOption | null;
  flowerLeiRequested?: boolean | null;
  flowerLeiQuantity?: number | null;
  airportWelcomeSurchargeClp?: number | null;
  optionalServicesTotalClp?: number | null;
  baseFareBeforeExtrasClp?: number | null;
  airportWelcomeLabel?: string | null;
}): void {
  const localRide = createLocalPassengerRide(input);
  saveLocalPassengerRides([localRide, ...readLocalPassengerRides()]);
}

function getRapaGoApiBaseUrl(): string {
  return getConfiguredApiOrigin();
}

function getNestedUnknown(source: unknown, path: string[]): unknown {
  let current = source;

  for (const key of path) {
    if (!current || typeof current !== "object") return null;
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

function extractRideRequestIdFromResponse(response: unknown): string | null {
  const directCandidates = [
    getNestedUnknown(response, ["id"]),
    getNestedUnknown(response, ["rideRequestId"]),
    getNestedUnknown(response, ["rideId"]),
    getNestedUnknown(response, ["data", "id"]),
    getNestedUnknown(response, ["data", "rideRequestId"]),
    getNestedUnknown(response, ["data", "rideId"]),
    getNestedUnknown(response, ["ride", "id"]),
    getNestedUnknown(response, ["rideRequest", "id"]),
    getNestedUnknown(response, ["request", "id"]),
  ];

  for (const value of directCandidates) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value))
      return String(value);
  }

  return null;
}

type RideMode = "now" | "scheduled";
type TripFareMode = "one_way" | "round_trip";
type PickerTarget = "origin" | "destination";

type Coords = {
  lat: number;
  lng: number;
  placeId?: string | null;
};

type PickupRecommendationKind = "reference" | "main_road" | "road" | "exact";

type ConfirmedPoint = Coords & {
  text: string;
  address: string;
  originalLat?: number | null;
  originalLng?: number | null;
  walkMeters?: number;
  walkMinutes?: number;
  isAccessiblePickup?: boolean;
  streetName?: string | null;
  referenceName?: string | null;
  referenceDistanceMeters?: number | null;
  candidateId?: string;
  recommendationKind?: PickupRecommendationKind;
  isRecommended?: boolean;
  recommendationReason?: string | null;
  roadProbeHits?: number;
};

export type GoogleSuggestion = {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
};

type PickerResult = {
  text: string;
  address: string;
  lat: number;
  lng: number;
  placeId?: string | null;
  placeTypes?: string[];

  // Punto real donde estaba el usuario/pin antes de ajustar a una vía accesible.
  originalLat?: number | null;
  originalLng?: number | null;

  // Datos calculados automáticamente con Google Maps.
  walkMeters?: number;
  walkMinutes?: number;
  isAccessiblePickup?: boolean;
  streetName?: string | null;
  referenceName?: string | null;
  referenceDistanceMeters?: number | null;
  candidateId?: string;
  recommendationKind?: PickupRecommendationKind;
  isRecommended?: boolean;
  recommendationReason?: string | null;
  roadProbeHits?: number;
};

type MapPointMovedPayload = {
  point: "origin" | "destination";
  lat: number;
  lng: number;
  text: string;
  address?: string;
};

type PaymentMethod = "cash" | "card" | null;
type AirportWelcomeOption = "none" | "flower_lei";

const AIRPORT_FLOWER_LEI_SURCHARGE_CLP = 4000;
const AIRPORT_FLOWER_LEI_MAX_QUANTITY = 20;
const AIRPORT_FLOWER_LEI_LABEL = "Collar de flores Rapa Nui";

declare global {
  interface Window {
    google?: typeof google;
  }

  interface WindowEventMap {
    "rapago:origin-point-moved": CustomEvent<MapPointMovedPayload>;
  }
}

const RAPA_NUI_CENTER = {
  lat: -27.1505,
  lng: -109.4325,
};

/**
 * Área operativa exclusiva de RAPA GO.
 *
 * El rectángulo incluye toda Isla de Pascua y un margen pequeño de costa,
 * pero excluye por completo Chile continental y cualquier otro territorio.
 * Se usa en cuatro capas: mapa, GPS, búsqueda y validación final del Place ID.
 */
const RAPA_NUI_SERVICE_BOUNDS = {
  north: -27.01,
  south: -27.25,
  west: -109.54,
  east: -109.17,
} as const;

const RAPA_NUI_PICKUP_IDEAL_WALK_METERS = 100;
const RAPA_NUI_PICKUP_MAX_RECOMMENDED_WALK_METERS = 180;

// Solo se ofrecen comercios o referencias realmente cercanas al punto azul.
// Si no existe una referencia válida dentro de este radio, la aplicación
// deja de mostrar locales y usa directamente una calle accesible.
const RAPA_NUI_NEARBY_REFERENCE_RADIUS_METERS = 380;
const RAPA_NUI_REFERENCE_MAX_WALK_METERS = 320;
const RAPA_NUI_REFERENCE_MAX_DISTANCE_FROM_ROAD_METERS = 190;
const RAPA_NUI_REFERENCE_MAX_DRIVING_ACCESS_METERS = 230;

// Tipos de Google Places que sirven como referencias fáciles de reconocer
// en Rapa Nui. Se incluyen explícitamente para que un local pequeño y cercano
// (por ejemplo, una barbería) no quede oculto detrás de un alojamiento más
// popular pero bastante más lejano.
const RAPA_NUI_REFERENCE_PLACE_TYPES = [
  "barber_shop",
  "hair_care",
  "hair_salon",
  "beauty_salon",
  "cafe",
  "restaurant",
  "bakery",
  "convenience_store",
  "grocery_store",
  "food_store",
  "market",
  "store",
  "supermarket",
  "pharmacy",
  "hotel",
  "hostel",
  "guest_house",
  "lodging",
  "bed_and_breakfast",
  "cottage",
  "private_guest_room",
  "tour_agency",
  "tourist_information_center",
  "travel_agency",
  "tourist_attraction",
  "museum",
  "church",
] as const;

// Google devuelve como máximo 20 resultados por Nearby Search. Si todos los
// tipos se consultan juntos, los alojamientos populares pueden desplazar a una
// barbería, una cabaña o un negocio pequeño. Las búsquedas separadas evitan
// ese recorte y después se unifican por Place ID/nombre.
const RAPA_NUI_REFERENCE_PLACE_TYPE_GROUPS = [
  ["barber_shop", "hair_care", "hair_salon", "beauty_salon"],
  [
    "hotel",
    "hostel",
    "guest_house",
    "lodging",
    "bed_and_breakfast",
    "cottage",
    "private_guest_room",
  ],
  [
    "tour_agency",
    "tourist_information_center",
    "travel_agency",
    "tourist_attraction",
    "museum",
  ],
  [
    "cafe",
    "restaurant",
    "bakery",
    "convenience_store",
    "grocery_store",
    "food_store",
    "market",
    "store",
    "supermarket",
    "pharmacy",
  ],
] as const;

const RAPA_NUI_HIGH_VALUE_REFERENCE_TYPES = new Set<string>([
  "barber_shop",
  "hair_care",
  "hair_salon",
  "beauty_salon",
  "cafe",
  "restaurant",
  "bakery",
  "convenience_store",
  "grocery_store",
  "food_store",
  "market",
  "store",
  "supermarket",
  "pharmacy",
]);

// Respaldo de Text Search para negocios pequeños que aparecen dibujados en
// Google Maps, pero cuyo tipo principal puede ser genérico (por ejemplo,
// `establishment`). Se usa solo como complemento de Nearby Search.
const RAPA_NUI_PRIORITY_REFERENCE_TEXT_QUERIES = [
  "barber",
  "barbería",
  "peluquería",
] as const;

const RAPA_NUI_GENERAL_REFERENCE_TEXT_QUERIES = [
  "cabañas",
  "alojamiento",
  "agencia de turismo",
  "tienda",
] as const;

const RAPA_NUI_REFERENCE_EXCLUDED_PRIMARY_TYPES = new Set<string>([
  "country",
  "locality",
  "postal_code",
  "route",
  "street_address",
  "intersection",
  "neighborhood",
  "administrative_area_level_1",
  "administrative_area_level_2",
]);

function isPointInsideRapaNuiServiceArea(point: {
  lat: number;
  lng: number;
}): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    point.lat <= RAPA_NUI_SERVICE_BOUNDS.north &&
    point.lat >= RAPA_NUI_SERVICE_BOUNDS.south &&
    point.lng >= RAPA_NUI_SERVICE_BOUNDS.west &&
    point.lng <= RAPA_NUI_SERVICE_BOUNDS.east
  );
}

function getRapaNuiMapBounds(): google.maps.LatLngBounds {
  return new google.maps.LatLngBounds(
    {
      lat: RAPA_NUI_SERVICE_BOUNDS.south,
      lng: RAPA_NUI_SERVICE_BOUNDS.west,
    },
    {
      lat: RAPA_NUI_SERVICE_BOUNDS.north,
      lng: RAPA_NUI_SERVICE_BOUNDS.east,
    },
  );
}

function isSuggestionTextClearlyFromRapaNui(value: unknown): boolean {
  const key = normalizePlaceStreetCompare(value);

  return [
    "rapa nui",
    "isla de pascua",
    "easter island",
    "hanga roa",
    "mataveri",
    "anakena",
    "orongo",
    "rano raraku",
    "poike",
    "tere vaka",
    "terevaka",
  ].some((token) => key.includes(token));
}

function getPickupRecommendationLabel(
  candidate: PickerResult | null | undefined,
): string {
  switch (candidate?.recommendationKind) {
    case "reference":
      return "Local cercano";
    case "main_road":
      return "Calle accesible";
    case "road":
      return "Calle accesible";
    case "exact":
      return "Punto exacto";
    default:
      return "Punto de recogida";
  }
}

function getPickupWalkLabel(meters: number): string {
  if (meters <= 15) return "Sin caminata";
  if (meters <= 60) return "Muy cerca";
  if (meters <= RAPA_NUI_PICKUP_IDEAL_WALK_METERS) return "Caminata corta";
  if (meters <= RAPA_NUI_PICKUP_MAX_RECOMMENDED_WALK_METERS) {
    return "Caminata moderada";
  }

  return "Más alejado";
}

const TOURIST_DESTINATION_SUGGESTIONS = [
  {
    name: "Ahu Tahai",
    subtitle: "Cultura y atardecer",
    search: "Ahu Tahai Hanga Roa Rapa Nui",
  },
  {
    name: "Playa Pea",
    subtitle: "Playa y zona céntrica",
    search: "Playa Pea Hanga Roa Rapa Nui",
  },
  {
    name: "Playa Poko Poko",
    subtitle: "Costa y paseo familiar",
    search: "Playa Poko Poko Hanga Roa Rapa Nui",
  },
  {
    name: "Mercado Artesanal Rapa Nui",
    subtitle: "Artesanía local",
    search: "Mercado Artesanal Rapa Nui Hanga Roa",
  },
  {
    name: "Feria Artesanal Hare Umanga",
    subtitle: "Feria y recuerdos",
    search: "Feria Artesanal Hare Umanga Hanga Roa Rapa Nui",
  },
  {
    name: "Caleta Hanga Roa",
    subtitle: "Puerto y restaurantes",
    search: "Caleta Hanga Roa Rapa Nui",
  },
  {
    name: "Comisaría Rapa Nui",
    subtitle: "Seguridad pública",
    search: "Comisaría Rapa Nui Hanga Roa",
  },
  {
    name: "Iglesia de la Santa Cruz Rapa Nui",
    subtitle: "Iglesia principal",
    search: "Iglesia de la Santa Cruz Rapa Nui Hanga Roa",
  },
  {
    name: "Ahu Huri A Urenga",
    subtitle: "Moai de 4 manos",
    search: "Ahu Huri A Urenga Moai de 4 manos Rapa Nui",
  },
  {
    name: "Hospital de Hanga Roa",
    subtitle: "Salud y urgencias",
    search: "Hospital de Hanga Roa Rapa Nui",
  },
  {
    name: "Jardín Botánico TauKiani",
    subtitle: "Naturaleza y visita",
    search: "Jardín Botánico TauKiani Hanga Roa Rapa Nui",
  },
];

type RapaNuiLocalAutocompletePlace = {
  id: string;
  name: string;
  subtitle: string;
  address: string;
  lat: number;
  lng: number;
  aliases: readonly string[];
  placeTypes: readonly string[];
};

const RAPA_NUI_LOCAL_AUTOCOMPLETE_PREFIX = "rapago-local:";

/* ── Nombres conocidos que había que escribir enteros ───────────────────────

   Lugares de Rapa Nui que Google sí conoce, pero a los que no se llegaba sin
   teclear el nombre completo: la consulta que sale de aquí es el texto tal
   cual más "Rapa Nui", así que escribir "haka" pedía «haka Rapa Nui», que no
   basta para que Google devuelva "Haka Piri Mana". Con estas pistas, esas
   mismas cuatro letras piden ya el nombre entero.

   ESTAS ENTRADAS NO LLEVAN COORDENADAS, Y ES A PROPÓSITO. Las de verdad las
   resuelve Google al seleccionar el lugar (getPlaceDetailsExact), que además
   valida que caiga dentro de la isla. Escribir aquí a mano un lat/lng que no
   he podido verificar sería mandar al conductor a donde yo supongo que está
   el sitio, y cobrar el viaje sobre esa distancia inventada: para eso es
   preferible que el lugar no salga. Si algún día se quieren en el catálogo
   local —que responde sin red— hay que añadirlos a
   RAPA_NUI_LOCAL_AUTOCOMPLETE_PLACES con sus coordenadas reales. */
type RapaNuiPlaceHint = {
  /* Lo que se le pide a Google cuando alguna clave encaja. */
  query: string;
  /* Lo que basta teclear. Se comparan normalizadas, así que no importan
     tildes ni mayúsculas. */
  keywords: readonly string[];
};

const RAPA_NUI_PLACE_HINTS: readonly RapaNuiPlaceHint[] = [
  {
    query: "O Te Ahi",
    keywords: ["o te ahi", "ote ahi", "oteahi", "te ahi"],
  },
  {
    query: "Hotel Maea Hare Repa",
    keywords: [
      "maea",
      "maea hare",
      "maea hare repa",
      "hare repa",
      "hotel maea",
    ],
  },
  {
    query: "Omotohi",
    keywords: ["omotohi", "omoto", "omotoi"],
  },
  {
    query: "Marae Hanga Piko",
    keywords: ["marae", "marae hanga", "marae hanga piko", "hanga piko"],
  },
  {
    query: "Planetario Rapa Nui",
    keywords: ["planetario", "planeta", "planetari"],
  },
  {
    query: "Pou Vae Tea",
    keywords: ["pou vae", "pou vae tea", "pouvae", "vae tea"],
  },
  {
    query: "DGAC Dirección General de Aeronáutica Civil",
    keywords: ["dgac", "aeronautica", "aeronautica civil"],
  },
  {
    query: "Haka Piri Mana",
    keywords: ["haka piri", "haka piri mana", "piri mana", "haka"],
  },
  {
    query: "Cabañas Tahonga",
    keywords: [
      "tahonga",
      "cabanas tahonga",
      "cabana tahonga",
      "tahonga rapa nui",
    ],
  },
  {
    query: "Casa Silvio",
    keywords: ["silvio", "casa silvio"],
  },
];

/** Nombre completo que pedirle a Google, o null si nada encaja con confianza.
 *
 *  Se exige que lo escrito sea PREFIJO de una clave (o la clave entera) y que
 *  tenga al menos tres letras. Con menos, o emparejando por cualquier trozo
 *  interior, una consulta se reescribiría hacia un lugar que el pasajero no
 *  estaba buscando —y eso es peor que obligarle a teclear de más, porque le
 *  esconde lo que sí quería. */
/* Longitud a partir de la cual una clave puede absorber texto escrito DE MÁS.
   Cuatro letras es demasiado poco: con ese tope, buscar "haka pei" —un lugar
   distinto de la isla— acabaría reescrito a "Haka Piri Mana" solo porque
   comparten las primeras cuatro. */
const HINT_MIN_ABSORB_LEN = 5;

export function matchRapaNuiPlaceHint(input: string): string | null {
  const query = normalizeRapaNuiAutocompleteText(input);
  if (query.length < 3) return null;

  /* El nombre completo entra como una clave más: si no, escribirlo entero no
     encajaría con ninguna de las claves cortas, que son más breves que él. */
  const candidatesFor = (hint: RapaNuiPlaceHint): string[] => [
    normalizeRapaNuiAutocompleteText(hint.query),
    ...hint.keywords.map(normalizeRapaNuiAutocompleteText),
  ];

  for (const hint of RAPA_NUI_PLACE_HINTS) {
    for (const candidate of candidatesFor(hint)) {
      if (!candidate) continue;

      /* Va escribiendo el principio del nombre. Con tres letras, una clave
         larga ("tahonga") también empieza por "tah", que es el alias de Ahu
         Tahai: reescribir ahí escondería el sitio que el pasajero ya tenía.
         Las claves cortas (haka, maea, dgac) sí pueden resolverse enteras
         desde tres o cuatro letras. */
      if (candidate.startsWith(query)) {
        const shortKeyword = candidate.length <= 4;
        if (shortKeyword || query.length >= 4) return hint.query;
      }

      /* Ya escribió la clave entera y sigue: "hotel maea" + " hare repa". */
      if (
        candidate.length >= HINT_MIN_ABSORB_LEN &&
        query.startsWith(candidate)
      ) {
        return hint.query;
      }
    }
  }

  /* Nada literal: se acepta una errata sobre la clave completa, con el mismo
     tope que el resto de la búsqueda. Así "planetraio" o "omotoi" siguen
     llegando. */
  const max = allowedTypos(query.length);
  if (max === 0) return null;

  for (const hint of RAPA_NUI_PLACE_HINTS) {
    for (const candidate of candidatesFor(hint)) {
      if (!candidate) continue;

      if (boundedEditDistance(candidate, query, max) <= max) {
        return hint.query;
      }
    }
  }

  return null;
}

const RAPA_NUI_LOCAL_AUTOCOMPLETE_PLACES: readonly RapaNuiLocalAutocompletePlace[] =
  [
    {
      id: "hospital-hanga-roa",
      name: "Hospital de Hanga Roa",
      subtitle: "Salud y urgencias",
      address: "Hospital Hanga Roa, Rapa Nui, Chile",
      lat: -27.1502,
      lng: -109.4216,
      aliases: [
        "hospital",
        "hosp",
        "urgencia",
        "urgencias",
        "salud",
        "hanga roa hospital",
      ],
      placeTypes: ["hospital", "health", "point_of_interest", "establishment"],
    },
    {
      id: "aeropuerto-mataveri",
      name: "Aeropuerto Internacional Mataveri",
      subtitle: "Terminal de pasajeros",
      address:
        "Zona de llegada / terminal Mataveri, Hanga Roa, Rapa Nui, Chile",
      lat: -27.16395,
      lng: -109.42465,
      /* La DGAC (Dirección General de Aeronáutica Civil) no tiene oficina
         propia en otra dirección: administra el aeropuerto y opera desde ahí
         mismo, en Calle Hotu Matúa s/n. Antes "dgac" solo reescribía la
         búsqueda hacia Google con el nombre oficial completo, y Google no lo
         reconoce como establecimiento, así que la lista quedaba vacía. Con el
         alias aquí, responde al instante y con las coordenadas ya
         verificadas del aeropuerto, sin depender de la red. */
      aliases: [
        "aero",
        "aeropuerto",
        "airport",
        "mataveri",
        "terminal",
        "dgac",
        "aeronautica",
        "aeronautica civil",
      ],
      placeTypes: ["airport", "point_of_interest", "establishment"],
    },
    {
      id: "ahu-tahai",
      name: "Ahu Tahai",
      subtitle: "Cultura y atardecer",
      address: "Ahu Tahai, Hanga Roa, Rapa Nui, Chile",
      lat: -27.1398,
      lng: -109.4298,
      aliases: ["tah", "tahai", "ahu tahai", "atardecer"],
      placeTypes: ["tourist_attraction", "point_of_interest", "establishment"],
    },
    {
      id: "playa-pea",
      name: "Playa Pea",
      subtitle: "Playa y zona céntrica",
      address: "Playa Pea, Hanga Roa, Rapa Nui, Chile",
      lat: -27.1482,
      lng: -109.4336,
      aliases: ["pea", "playa pea", "playa", "centro"],
      placeTypes: ["tourist_attraction", "point_of_interest", "establishment"],
    },
    {
      id: "playa-poko-poko",
      name: "Playa Poko Poko",
      subtitle: "Costa y paseo familiar",
      address: "Playa Poko Poko, Hanga Roa, Rapa Nui, Chile",
      lat: -27.149,
      lng: -109.4319,
      aliases: ["poko", "poko poko", "playa poko", "playa poko poko"],
      placeTypes: ["tourist_attraction", "point_of_interest", "establishment"],
    },
    {
      id: "mercado-artesanal",
      name: "Mercado Artesanal Rapa Nui",
      subtitle: "Artesanía local",
      address: "Mercado Artesanal, Hanga Roa, Rapa Nui, Chile",
      lat: -27.1508,
      lng: -109.4289,
      aliases: [
        "mercado",
        "artesania",
        "artesanía",
        "mercado artesanal",
        "souvenir",
      ],
      placeTypes: ["market", "store", "point_of_interest", "establishment"],
    },
    {
      id: "feria-hare-umanga",
      name: "Feria Artesanal Hare Umanga",
      subtitle: "Feria y recuerdos",
      address: "Feria Artesanal Hare Umanga, Hanga Roa, Rapa Nui, Chile",
      lat: -27.1503,
      lng: -109.4277,
      aliases: ["feria", "hare", "hare umanga", "feria artesanal"],
      placeTypes: ["market", "store", "point_of_interest", "establishment"],
    },
    {
      id: "caleta-hanga-roa",
      name: "Caleta Hanga Roa",
      subtitle: "Puerto y restaurantes",
      address: "Caleta Hanga Roa, Rapa Nui, Chile",
      lat: -27.1478,
      lng: -109.4356,
      aliases: ["caleta", "puerto", "caleta hanga roa", "restaurantes"],
      placeTypes: ["point_of_interest", "establishment"],
    },
    {
      id: "comisaria-rapa-nui",
      name: "Comisaría Rapa Nui",
      subtitle: "Carabineros y seguridad",
      address: "Comisaría Rapa Nui, Hanga Roa, Chile",
      lat: -27.1497,
      lng: -109.4268,
      aliases: [
        "comisaria",
        "comisaría",
        "carabineros",
        "policia",
        "policía",
        "seguridad",
      ],
      placeTypes: ["police", "point_of_interest", "establishment"],
    },
    {
      id: "iglesia-santa-cruz",
      name: "Iglesia de la Santa Cruz Rapa Nui",
      subtitle: "Iglesia principal",
      address: "Iglesia de la Santa Cruz, Hanga Roa, Rapa Nui, Chile",
      lat: -27.1506,
      lng: -109.4271,
      aliases: ["iglesia", "santa cruz", "iglesia santa cruz", "misa"],
      placeTypes: [
        "church",
        "place_of_worship",
        "point_of_interest",
        "establishment",
      ],
    },
    {
      id: "jardin-taukiani",
      name: "Jardín Botánico TauKiani",
      subtitle: "Naturaleza y visita",
      address: "Jardín Botánico TauKiani, Hanga Roa, Rapa Nui, Chile",
      lat: -27.1482,
      lng: -109.4069,
      aliases: [
        "jardin",
        "jardín",
        "botanico",
        "botánico",
        "taukiani",
        "jardin botanico",
      ],
      placeTypes: [
        "park",
        "tourist_attraction",
        "point_of_interest",
        "establishment",
      ],
    },
    {
      id: "anakena",
      name: "Anakena",
      subtitle: "Playa y experiencia",
      address: "Playa Anakena, Rapa Nui, Chile",
      lat: -27.0732,
      lng: -109.3233,
      aliases: ["anakena", "playa anakena"],
      placeTypes: ["tourist_attraction", "point_of_interest", "establishment"],
    },
    {
      id: "terevaka",
      name: "Terevaka",
      subtitle: "Cerro y excursión",
      address: "Maunga Terevaka, Rapa Nui, Chile",
      lat: -27.0917,
      lng: -109.382,
      aliases: ["terevaka", "tere vaka", "cerro", "maunga terevaka"],
      placeTypes: ["tourist_attraction", "point_of_interest", "establishment"],
    },
    {
      id: "cabanas-tahonga",
      name: "Cabañas Tahonga",
      subtitle: "Alojamiento",
      address: "Cabañas Tahonga, Rapa Nui, Chile",
      lat: -27.1647,
      lng: -109.4218,
      aliases: ["tahonga", "cabanas tahonga", "cabana tahonga"],
      placeTypes: ["lodging", "point_of_interest", "establishment"],
    },
    {
      id: "casa-silvio",
      name: "Casa Silvio",
      subtitle: "Punto de recogida",
      address: "Casa Silvio, Hanga Roa, Rapa Nui, Chile",
      lat: -27.1478,
      lng: -109.4296,
      aliases: ["silvio", "casa silvio"],
      placeTypes: ["point_of_interest", "establishment"],
    },
  ] as const;

/* Fuente ÚNICA de lugares tocables del mapa: los mismos POIs locales que
   alimentan los buscadores de origen y destino. Identidad estable a nivel de
   módulo para no reconstruir los marcadores en cada render. */
const REQUEST_MAP_PLACES: MapPlaceMarker[] =
  RAPA_NUI_LOCAL_AUTOCOMPLETE_PLACES.map((place) => ({
    id: place.id,
    name: place.name,
    lat: place.lat,
    lng: place.lng,
  }));

function normalizeRapaNuiAutocompleteText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/* \u2500\u2500 Tolerancia a erratas en el cat\u00e1logo local \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

   Todo lo de abajo emparejaba por subcadena exacta (`startsWith`/`includes`),
   as\u00ed que una letra de m\u00e1s o de menos dejaba la lista vac\u00eda: "anakna",
   "hopital", "matavery" o "hangaroa" no devolv\u00edan nada. Google s\u00ed tolera
   erratas por su cuenta, pero el cat\u00e1logo local es el que responde al instante
   y el que sostiene la b\u00fasqueda cuando Google falla o a\u00fan no carg\u00f3.

   Se resuelve con distancia de edici\u00f3n, no con comparaciones sueltas por
   letra: es la medida que corresponde a "cu\u00e1ntas pulsaciones separan lo que
   escribi\u00f3 de lo que quiso escribir". */

/* Longitud m\u00e1xima que se compara. Los nombres del cat\u00e1logo son cortos; esto
   solo acota un pegado enorme, que disparar\u00eda el coste sin ganar nada. */
const FUZZY_MAX_LEN = 64;

/* Erratas permitidas seg\u00fan lo escrito. Por debajo de 5 letras no se aplica
   nada: "pea", "tah", "aero" o "tere" son ya alias literales del cat\u00e1logo y
   los tramos exactos los resuelven solos, mientras que permitir una errata
   con cuatro letras es una red lo bastante ancha como para enganchar casi
   cualquier nombre de la isla. */
function allowedTypos(queryLength: number): number {
  if (queryLength < 5) return 0;
  if (queryLength < 8) return 1;
  return 2;
}

/** Distancia de Damerau-Levenshtein restringida (OSA), cortada en `max`.
 *
 *  Cuenta como UNA edici\u00f3n el intercambio de dos letras contiguas ("tahia" por
 *  "tahai"), que es de las erratas m\u00e1s frecuentes al teclear y que la
 *  Levenshtein cl\u00e1sica cobrar\u00eda como dos.
 *
 *  Devuelve `max + 1` en cuanto se sabe que se pasa del tope, sin terminar el
 *  c\u00e1lculo: esto corre por cada lugar y cada alias en cada pulsaci\u00f3n. */
export function boundedEditDistance(
  a: string,
  b: string,
  max: number,
): number {
  if (a === b) return 0;
  if (max <= 0) return 1;

  const lenA = Math.min(a.length, FUZZY_MAX_LEN);
  const lenB = Math.min(b.length, FUZZY_MAX_LEN);

  /* Solo la diferencia de longitudes ya supera el tope: no hay nada que
     calcular. */
  if (Math.abs(lenA - lenB) > max) return max + 1;
  if (lenA === 0) return lenB;
  if (lenB === 0) return lenA;

  let prev2: number[] = [];
  let prev: number[] = new Array<number>(lenB + 1);
  let current: number[] = new Array<number>(lenB + 1);

  for (let j = 0; j <= lenB; j += 1) prev[j] = j;

  for (let i = 1; i <= lenA; i += 1) {
    current[0] = i;
    let rowBest = current[0];

    for (let j = 1; j <= lenB; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      let value = Math.min(
        prev[j] + 1, // borrar
        current[j - 1] + 1, // insertar
        prev[j - 1] + cost, // sustituir
      );

      /* Intercambio de dos letras contiguas. */
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        value = Math.min(value, prev2[j - 2] + 1);
      }

      current[j] = value;
      if (value < rowBest) rowBest = value;
    }

    /* Ninguna casilla de la fila baja del tope: lo que quede solo puede
       crecer, as\u00ed que se corta aqu\u00ed. */
    if (rowBest > max) return max + 1;

    prev2 = prev;
    prev = current;
    current = new Array<number>(lenB + 1);
  }

  const distance = prev[lenB];
  return distance > max ? max + 1 : distance;
}

/** Punt\u00faa lo escrito contra UN texto del cat\u00e1logo tolerando erratas.
 *
 *  Devuelve -1 si no se parece lo bastante. Los valores van siempre por DEBAJO
 *  del tramo de subcadena exacta (720) para que una coincidencia literal nunca
 *  quede desplazada por una aproximada. */
export function fuzzyAutocompleteScore(value: string, query: string): number {
  if (!value || !query) return -1;

  const max = allowedTypos(query.length);
  if (max === 0) return -1;

  /* Sin espacios a los dos lados: es lo que rescata "hangaroa" contra
     "hanga roa", que no es una errata sino otra forma de escribir lo mismo. */
  const tightValue = value.replace(/ /g, "");
  const tightQuery = query.replace(/ /g, "");

  /* Escrito todo junto y sin ninguna errata. Se comprueba ANTES que la
     distancia de edición porque esta no llega a mirarlo: "hangaroa" contra
     "caleta hanga roa" son 14 y 8 caracteres, y esa diferencia de longitud ya
     supera cualquier tope de erratas razonable. Puntúa alto dentro de lo
     difuso —es una coincidencia exacta, solo que ignorando espacios— pero
     sigue por debajo del tramo literal. */
  if (tightValue.includes(tightQuery)) return 700;

  const whole = boundedEditDistance(tightValue, tightQuery, max);
  if (whole <= max) return 600 - whole * 60;

  /* Palabra suelta dentro del nombre: "mercdo" contra "mercado artesanal". */
  const queryWords = query.split(" ").filter(Boolean);
  const valueWords = value.split(" ").filter(Boolean);

  if (queryWords.length === 1) {
    let best = -1;

    for (const word of valueWords) {
      /* Solo contra palabras de largo parecido: comparar "mercdo" con "de"
         nunca va a ser una errata, y s\u00ed puede dar un falso positivo. */
      if (Math.abs(word.length - tightQuery.length) > max) continue;

      const distance = boundedEditDistance(word, tightQuery, max);
      if (distance <= max) best = Math.max(best, 540 - distance * 60);
    }

    return best;
  }

  /* Varias palabras: todas tienen que encontrar la suya, exacta o con
     errata. As\u00ed "jardin botaniko" sigue llegando a "Jard\u00edn Bot\u00e1nico". */
  const everyWordMatches = queryWords.every((queryWord) => {
    const wordMax = allowedTypos(queryWord.length);

    return valueWords.some((valueWord) => {
      if (valueWord.includes(queryWord)) return true;
      if (wordMax === 0) return false;
      return boundedEditDistance(valueWord, queryWord, wordMax) <= wordMax;
    });
  });

  return everyWordMatches ? 500 : -1;
}

function getRapaNuiLocalAutocompletePlace(
  placeId: string,
): RapaNuiLocalAutocompletePlace | null {
  if (!placeId.startsWith(RAPA_NUI_LOCAL_AUTOCOMPLETE_PREFIX)) return null;

  const id = placeId.slice(RAPA_NUI_LOCAL_AUTOCOMPLETE_PREFIX.length);
  return (
    RAPA_NUI_LOCAL_AUTOCOMPLETE_PLACES.find((place) => place.id === id) ?? null
  );
}

/* Cuánto baja una coincidencia que ocurre fuera del nombre del lugar. Está
   calibrado para que el tramo más alto que se alcanza por dirección sin
   escribirla entera —principio de una de sus palabras, 900— caiga por debajo
   del corte de abajo. */
const NON_NAME_FIELD_PENALTY = 250;

/* De aquí para arriba, una coincidencia local ES lo que el pasajero quiso
   decir: el nombre exacto (1200), su principio (1000), el principio de una de
   sus palabras (900), todas las palabras escritas presentes (820), o el nombre
   escrito todo junto sin erratas (700 por la vía difusa). Esas van por delante
   de Google.

   Por debajo quedan las correcciones de erratas y lo que solo encajó con la
   dirección: son corazonadas útiles —rescatan búsquedas que si no volverían
   vacías— pero no pueden desplazar a un resultado exacto que Google sí tiene. */
const LOCAL_STRONG_AUTOCOMPLETE_SCORE = 700;

export interface LocalAutocompleteMatch {
  suggestion: GoogleSuggestion;
  score: number;
}

/** Igual que `getRapaNuiLocalAutocompletePredictions`, pero conservando la
 *  puntuación de cada resultado.
 *
 *  El mezclado con Google la necesita: antes metía SIEMPRE todo el catálogo por
 *  delante, así que una coincidencia difusa flojita —de esas que solo existen
 *  para rescatar erratas— desplazaba al resultado exacto que Google sí tenía. */
export function getRapaNuiLocalAutocompleteMatches(
  input: string,
): LocalAutocompleteMatch[] {
  const query = normalizeRapaNuiAutocompleteText(input);
  if (query.length < 2) return [];

  const queryWords = query.split(" ").filter(Boolean);

  return RAPA_NUI_LOCAL_AUTOCOMPLETE_PLACES.map((place) => {
    const values = [
      place.name,
      place.subtitle,
      place.address,
      ...place.aliases,
    ].map(normalizeRapaNuiAutocompleteText);

    let score = -1;

    for (let index = 0; index < values.length; index += 1) {
      const value = values[index];

      if (!value) continue;

      /* El subtítulo (1) y la dirección (2) dicen de qué tipo es el lugar y
         DÓNDE está, no cómo se llama.

         Casi todas las fichas del catálogo llevan "Hanga Roa" en la dirección,
         así que sin penalizar este campo la palabra "hanga" sacaba el
         aeropuerto, la comisaría y Ahu Tahai al mismo nivel que el Hospital de
         Hanga Roa y la Caleta Hanga Roa —los dos únicos que se llaman así—.
         Buscar el nombre de un barrio no puede devolver todo lo que hay dentro
         del barrio.

         La penalización estaba solo en el tramo difuso, que es donde se detectó
         el problema, pero la causa no tenía nada que ver con las erratas: era
         el campo. Así que se aplica también a los tramos literales, y con
         margen suficiente para que una coincidencia con la dirección quede por
         debajo del corte de "esto es lo que buscaba" (ver
         LOCAL_STRONG_AUTOCOMPLETE_SCORE). Lo que sí sobrevive es escribir la
         dirección entera o su principio: ahí la intención está clara. */
      const isLocationField = index === 1 || index === 2;

      let literal = -1;
      if (value === query) literal = Math.max(literal, 1200);
      if (value.startsWith(query)) literal = Math.max(literal, 1000);

      const words = value.split(" ").filter(Boolean);
      const tightValue = value.replace(/ /g, "");
      const tightQuery = query.replace(/ /g, "");

      if (words.some((word) => word.startsWith(query))) {
        literal = Math.max(literal, 900);
      }

      /* Cada palabra escrita como principio de una del nombre: "caba tahon"
         encuentra Cabañas Tahonga sin el nombre oficial completo. */
      if (
        queryWords.length > 0 &&
        queryWords.every(
          (word) =>
            word.length >= 2 &&
            words.some((valueWord) => valueWord.startsWith(word)),
        )
      ) {
        literal = Math.max(literal, queryWords.length > 1 ? 860 : 900);
      }

      if (
        queryWords.length > 1 &&
        queryWords.every((word) => value.includes(word))
      ) {
        literal = Math.max(literal, 820);
      }

      if (value.includes(query) || tightValue.includes(tightQuery)) {
        literal = Math.max(literal, 720);
      }

      if (literal >= 0) {
        score = Math.max(
          score,
          isLocationField ? literal - NON_NAME_FIELD_PENALTY : literal,
        );
      }

      /* Último recurso, y solo si nada literal encajó. Va por debajo de 720,
         así que no puede adelantar a una coincidencia exacta: únicamente
         rescata lo que antes se iba con la lista vacía. */
      if (score < 720) {
        const fuzzy = fuzzyAutocompleteScore(value, query);

        if (fuzzy >= 0) {
          score = Math.max(score, isLocationField ? fuzzy - 80 : fuzzy);
        }
      }
    }

    return { place, score };
  })
    .filter((item) => item.score >= 0)
    .sort(
      (a, b) =>
        b.score - a.score || a.place.name.localeCompare(b.place.name, "es"),
    )
    .slice(0, 8)
    .map(({ place, score }) => ({
      score,
      suggestion: {
        placeId: `${RAPA_NUI_LOCAL_AUTOCOMPLETE_PREFIX}${place.id}`,
        description: `${place.name}, ${place.address}`,
        mainText: place.name,
        secondaryText: `${place.subtitle} · Sugerencia RAPA GO`,
      },
    }));
}

export function getRapaNuiLocalAutocompletePredictions(
  input: string,
): GoogleSuggestion[] {
  return getRapaNuiLocalAutocompleteMatches(input).map(
    ({ suggestion }) => suggestion,
  );
}

export function mergeRapaNuiAutocompletePredictions(
  localMatches: LocalAutocompleteMatch[],
  googleSuggestions: GoogleSuggestion[],
): GoogleSuggestion[] {
  /* Lo fuerte del catálogo primero: son lugares con coordenadas curadas, así
     que al tocarlos el viaje queda listo sin pedirle a Google los detalles.
     Después Google. Y al final las corazonadas del catálogo, que están para
     rescatar erratas, no para encabezar la lista. */
  const strong = localMatches
    .filter((match) => match.score >= LOCAL_STRONG_AUTOCOMPLETE_SCORE)
    .map((match) => match.suggestion);
  const weak = localMatches
    .filter((match) => match.score < LOCAL_STRONG_AUTOCOMPLETE_SCORE)
    .map((match) => match.suggestion);

  const seen = new Set<string>();
  const merged: GoogleSuggestion[] = [];

  for (const suggestion of [...strong, ...googleSuggestions, ...weak]) {
    /* La clave es solo el nombre. Antes incluía el subtítulo, y como el del
       catálogo termina en "· Sugerencia RAPA GO" y el de Google es la
       dirección, el MISMO lugar aparecía dos veces seguidas: una versión
       nuestra y otra de Google. Con el nombre a secas se colapsan, y gana el
       del catálogo por llegar antes en el recorrido. */
    const key = normalizeRapaNuiAutocompleteText(suggestion.mainText);

    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(suggestion);

    if (merged.length >= 8) break;
  }

  return merged;
}

function localRapaNuiPlaceToPickerResult(
  place: RapaNuiLocalAutocompletePlace,
): PickerResult {
  return {
    text: place.name,
    address: place.address,
    lat: place.lat,
    lng: place.lng,
    placeId: `${RAPA_NUI_LOCAL_AUTOCOMPLETE_PREFIX}${place.id}`,
    placeTypes: [...place.placeTypes],
    originalLat: null,
    originalLng: null,
    walkMeters: 0,
    isAccessiblePickup: false,
  };
}

function inputItemStyle(extra?: CSSProperties): CSSProperties {
  return {
    "--background": "var(--rp-field-bg)",
    "--border-radius": "var(--rp-radius-sm)",
    "--padding-start": "14px",
    "--inner-padding-end": "12px",
    "--min-height": "56px",
    "--color": "var(--rp-field-fg)",
    "--placeholder-color": "var(--rp-field-ph)",
    "--highlight-color-focused": "var(--rp-gold)",
    color: "var(--rp-field-fg)",
    marginBottom: "14px",
    border: "var(--rp-border-w) solid var(--rp-border-c)",
    boxShadow: "var(--rp-shadow)",
    overflow: "hidden",
    ...extra,
  } as CSSProperties;
}

function suggestionBoxStyle(): CSSProperties {
  return {
    margin: "-8px 0 14px",
    border: "var(--rp-border-w) solid var(--rp-border-c)",
    borderRadius: "var(--rp-radius-sm)",
    overflow: "hidden",
    background: "var(--rp-surface)",
    boxShadow: "var(--rp-shadow)",
  };
}

function normalizePlaceStreetText(value: unknown): string {
  return String(value ?? "")
    .replace(/^Recogida\s+en\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePlaceStreetCompare(value: unknown): string {
  return normalizePlaceStreetText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getAddressComponentValue(
  result: google.maps.GeocoderResult | null | undefined,
  types: string[],
): string | null {
  if (!result) return null;

  const component = result.address_components.find((item) =>
    types.some((type) => item.types.includes(type)),
  );

  const value = normalizePlaceStreetText(
    component?.long_name ?? component?.short_name ?? "",
  );
  return value || null;
}

function getGeocodePlaceName(
  result: google.maps.GeocoderResult | null | undefined,
): string | null {
  const value =
    getAddressComponentValue(result, ["premise"]) ??
    getAddressComponentValue(result, ["establishment"]) ??
    getAddressComponentValue(result, ["point_of_interest"]) ??
    getAddressComponentValue(result, ["tourist_attraction"]);

  return value || null;
}

function getGeocodeStreetName(
  result: google.maps.GeocoderResult | null | undefined,
): string | null {
  return getAddressComponentValue(result, ["route"]);
}

function isGooglePlusCodeLike(value: unknown): boolean {
  const raw = normalizePlaceStreetText(value).toUpperCase().replace(/\s+/g, "");
  return /^[23456789CFGHJMPQRVWX]{4,}\+[23456789CFGHJMPQRVWX]{2,}/.test(raw);
}

function isUsefulPlaceStreetValue(value: unknown): boolean {
  const text = normalizePlaceStreetText(value);
  const key = normalizePlaceStreetCompare(text);

  if (!text || key.length < 3) return false;
  if (isGooglePlusCodeLike(text)) return false;

  return ![
    "hanga roa",
    "rapa nui",
    "isla de pascua",
    "easter island",
    "valparaiso",
    "valparaiso chile",
    "chile",
  ].includes(key);
}

function buildPlaceStreetTitle(
  placeName: unknown,
  streetName: unknown,
): string | null {
  const place = isUsefulPlaceStreetValue(placeName)
    ? normalizePlaceStreetText(placeName)
    : "";
  const street = isUsefulPlaceStreetValue(streetName)
    ? normalizePlaceStreetText(streetName)
    : "";

  const placeKey = normalizePlaceStreetCompare(place);
  const streetKey = normalizePlaceStreetCompare(street);

  if (place && street) {
    if (placeKey === streetKey) return place;
    if (placeKey.includes(streetKey) && streetKey.length >= 3) return place;
    if (streetKey.includes(placeKey) && placeKey.length >= 3) return street;

    return `${place} · ${street}`;
  }

  return place || street || null;
}

type GoogleNearbyReference = {
  name: string;
  placeId: string | null;
  lat: number;
  lng: number;
  formattedAddress: string | null;
  primaryType: string | null;
  distanceMeters: number;
};

type GooglePlaceNewLike = {
  id?: string | null;
  displayName?: string | null;
  location?: google.maps.LatLng | google.maps.LatLngLiteral | null;
  formattedAddress?: string | null;
  primaryType?: string | null;
  types?: string[] | null;
  businessStatus?: string | null;
};

function readGoogleLatLng(
  value: google.maps.LatLng | google.maps.LatLngLiteral | null | undefined,
): { lat: number; lng: number } | null {
  if (!value) return null;

  if (
    typeof (value as google.maps.LatLng).lat === "function" &&
    typeof (value as google.maps.LatLng).lng === "function"
  ) {
    return {
      lat: (value as google.maps.LatLng).lat(),
      lng: (value as google.maps.LatLng).lng(),
    };
  }

  const literal = value as google.maps.LatLngLiteral;

  if (!Number.isFinite(literal.lat) || !Number.isFinite(literal.lng)) {
    return null;
  }

  return {
    lat: Number(literal.lat),
    lng: Number(literal.lng),
  };
}

function isUsefulGoogleReference(
  name: unknown,
  streetName?: string | null,
): boolean {
  if (!isUsefulPlaceStreetValue(name)) return false;

  const referenceKey = normalizePlaceStreetCompare(name);
  const streetKey = normalizePlaceStreetCompare(streetName);

  if (streetKey && referenceKey === streetKey) return false;

  return ![
    "unnamed road",
    "calle sin nombre",
    "ruta sin nombre",
    "rapa nui chile",
    "hanga roa chile",
  ].includes(referenceKey);
}

function dedupeGoogleReferences(
  references: GoogleNearbyReference[],
): GoogleNearbyReference[] {
  const seenPlaceIds = new Set<string>();
  const seenNames = new Set<string>();

  return references
    .filter((reference) =>
      isPointInsideRapaNuiServiceArea({
        lat: reference.lat,
        lng: reference.lng,
      }),
    )
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .filter((reference) => {
      const placeId = String(reference.placeId ?? "").trim();
      const nameKey = normalizePlaceStreetCompare(reference.name);

      if (!nameKey) return false;
      if (placeId && seenPlaceIds.has(placeId)) return false;
      if (seenNames.has(nameKey)) return false;

      if (placeId) seenPlaceIds.add(placeId);
      seenNames.add(nameKey);
      return true;
    });
}

function getReferenceTypePriorityBonus(
  reference: GoogleNearbyReference,
): number {
  const type = normalizePlaceStreetCompare(reference.primaryType).replace(
    / /g,
    "_",
  );

  if (RAPA_NUI_HIGH_VALUE_REFERENCE_TYPES.has(type)) return 18;
  if (
    ["tour_agency", "tourist_information_center", "travel_agency"].includes(
      type,
    )
  ) {
    return 10;
  }
  if (["hotel", "hostel", "guest_house", "lodging"].includes(type)) {
    return 4;
  }

  return 0;
}

function getReferenceDiscoveryPriority(
  reference: GoogleNearbyReference,
): number {
  const type = normalizePlaceStreetCompare(reference.primaryType).replace(
    / /g,
    "_",
  );
  const name = normalizePlaceStreetCompare(reference.name);

  if (/barber|peluquer|hair salon|salon de belleza/.test(name)) return 100;
  if (
    ["barber_shop", "hair_care", "hair_salon", "beauty_salon"].includes(type)
  ) {
    return 100;
  }
  if (RAPA_NUI_HIGH_VALUE_REFERENCE_TYPES.has(type)) return 60;
  if (/caf[eé]|restaurant|tienda|market|farmacia|supermercado/.test(name)) {
    return 55;
  }
  if (
    ["tour_agency", "tourist_information_center", "travel_agency"].includes(
      type,
    )
  ) {
    return 20;
  }
  if (["hotel", "hostel", "guest_house", "lodging"].includes(type)) {
    return 8;
  }

  return 0;
}

function isPracticalPickupReference(candidate: PickerResult): boolean {
  const name = normalizePlaceStreetCompare(candidate.referenceName);

  return /barber|peluquer|hair salon|salon de belleza|caf[eé]|restaurant|tienda|market|farmacia|supermercado/.test(
    name,
  );
}

async function getNearbyGoogleReferencesNew(
  point: { lat: number; lng: number },
  radiusMeters: number,
): Promise<GoogleNearbyReference[]> {
  try {
    await loadRapaGoGoogleMaps();

    const placesNamespace = google.maps.places as unknown as {
      Place?: {
        searchNearby?: (
          request: Record<string, unknown>,
        ) => Promise<{ places?: GooglePlaceNewLike[] }>;
      };
      SearchNearbyRankPreference?: {
        DISTANCE?: unknown;
      };
    };
    const importedPlaces = (await google.maps.importLibrary(
      "places",
    )) as unknown as typeof placesNamespace;

    const PlaceApi = importedPlaces.Place ?? placesNamespace.Place;
    const rankPreference =
      importedPlaces.SearchNearbyRankPreference?.DISTANCE ??
      placesNamespace.SearchNearbyRankPreference?.DISTANCE ??
      "DISTANCE";

    if (!PlaceApi?.searchNearby) return [];

    const fields = [
      "id",
      "displayName",
      "location",
      "formattedAddress",
      "primaryType",
      "types",
      "businessStatus",
    ];

    const convertPlaces = (
      places: GooglePlaceNewLike[] | undefined,
    ): GoogleNearbyReference[] =>
      (places ?? [])
        .map((place): GoogleNearbyReference | null => {
          const name = normalizePlaceStreetText(place.displayName ?? "");
          const location = readGoogleLatLng(place.location);
          const primaryType = normalizePlaceStreetCompare(
            place.primaryType ?? place.types?.[0] ?? "",
          ).replace(/ /g, "_");

          if (
            !location ||
            !isUsefulGoogleReference(name) ||
            RAPA_NUI_REFERENCE_EXCLUDED_PRIMARY_TYPES.has(primaryType) ||
            String(place.businessStatus ?? "").toUpperCase() ===
              "CLOSED_PERMANENTLY"
          ) {
            return null;
          }

          const directDistance = Math.round(distanceMeters(point, location));
          if (
            directDistance > radiusMeters ||
            !isPointInsideRapaNuiServiceArea(location)
          ) {
            return null;
          }

          return {
            name,
            placeId: place.id ? String(place.id) : null,
            lat: location.lat,
            lng: location.lng,
            formattedAddress: place.formattedAddress
              ? String(place.formattedAddress)
              : null,
            primaryType: primaryType || null,
            distanceMeters: directDistance,
          };
        })
        .filter(
          (reference): reference is GoogleNearbyReference => reference !== null,
        );

    const baseRequest = {
      fields,
      locationRestriction: {
        center: new google.maps.LatLng(point.lat, point.lng),
        radius: radiusMeters,
      },
      maxResultCount: 20,
      rankPreference,
      language: "es",
      region: "CL",
    };

    // 1) Sin filtro: trae POI genéricos que Google dibuja en el mapa.
    // 2) Por grupos con includedTypes: considera tipos primarios y secundarios
    //    y evita que 20 alojamientos oculten barberías/cabañas cercanas.
    const responses = await Promise.all([
      PlaceApi.searchNearby(baseRequest).catch(() => ({ places: [] })),
      ...RAPA_NUI_REFERENCE_PLACE_TYPE_GROUPS.map((includedTypes) =>
        PlaceApi.searchNearby({
          ...baseRequest,
          includedTypes: [...includedTypes],
        }).catch(() => ({ places: [] })),
      ),
    ]);

    return dedupeGoogleReferences(
      responses.flatMap((response) => convertPlaces(response.places)),
    );
  } catch {
    return [];
  }
}

async function getNearbyGoogleReferencesTextSearchNew(
  point: { lat: number; lng: number },
  radiusMeters: number,
  textQueries: readonly string[],
): Promise<GoogleNearbyReference[]> {
  try {
    await loadRapaGoGoogleMaps();

    const placesNamespace = google.maps.places as unknown as {
      Place?: {
        searchByText?: (
          request: Record<string, unknown>,
        ) => Promise<{ places?: GooglePlaceNewLike[] }>;
      };
    };
    const importedPlaces = (await google.maps.importLibrary(
      "places",
    )) as unknown as typeof placesNamespace;
    const PlaceApi = importedPlaces.Place ?? placesNamespace.Place;

    if (!PlaceApi?.searchByText) return [];

    const groups = await Promise.all(
      textQueries.map(async (textQuery) => {
        try {
          const response = await PlaceApi.searchByText?.({
            // Agregar la ubicación al texto evita que Google interprete
            // "barber" como una búsqueda mundial y deja la isla como centro.
            textQuery: `${textQuery} en Hanga Roa, Rapa Nui`,
            fields: [
              "id",
              "displayName",
              "location",
              "formattedAddress",
              "primaryType",
              "types",
              "businessStatus",
            ],
            locationBias: {
              center: { lat: point.lat, lng: point.lng },
              radius: radiusMeters,
            },
            language: "es",
            region: "CL",
            maxResultCount: 12,
          });

          return (response?.places ?? [])
            .map((place): GoogleNearbyReference | null => {
              const name = normalizePlaceStreetText(place.displayName ?? "");
              const location = readGoogleLatLng(place.location);
              const primaryType = normalizePlaceStreetCompare(
                place.primaryType ?? place.types?.[0] ?? "",
              ).replace(/ /g, "_");

              if (
                !location ||
                !isUsefulGoogleReference(name) ||
                RAPA_NUI_REFERENCE_EXCLUDED_PRIMARY_TYPES.has(primaryType) ||
                String(place.businessStatus ?? "").toUpperCase() ===
                  "CLOSED_PERMANENTLY"
              ) {
                return null;
              }

              const directDistance = Math.round(
                distanceMeters(point, location),
              );

              if (
                directDistance > radiusMeters ||
                !isPointInsideRapaNuiServiceArea(location)
              ) {
                return null;
              }

              return {
                name,
                placeId: place.id ? String(place.id) : null,
                lat: location.lat,
                lng: location.lng,
                formattedAddress: place.formattedAddress
                  ? String(place.formattedAddress)
                  : null,
                primaryType: primaryType || null,
                distanceMeters: directDistance,
              };
            })
            .filter(
              (reference): reference is GoogleNearbyReference =>
                reference !== null,
            );
        } catch {
          return [];
        }
      }),
    );

    return dedupeGoogleReferences(groups.flat());
  } catch {
    return [];
  }
}

async function getNearbyGoogleReferencesLegacy(
  point: { lat: number; lng: number },
  radiusMeters: number,
): Promise<GoogleNearbyReference[]> {
  try {
    await loadRapaGoGoogleMaps();
    if (!window.google?.maps?.places?.PlacesService) return [];

    const container = document.createElement("div");
    const service = new google.maps.places.PlacesService(container);

    const runNearbySearch = (type?: string): Promise<GoogleNearbyReference[]> =>
      new Promise((resolve) => {
        const request: google.maps.places.PlaceSearchRequest = {
          location: new google.maps.LatLng(point.lat, point.lng),
          rankBy: google.maps.places.RankBy.DISTANCE,
        };

        if (type) request.type = type;

        service.nearbySearch(request, (results, status) => {
          if (
            status !== google.maps.places.PlacesServiceStatus.OK ||
            !results?.length
          ) {
            resolve([]);
            return;
          }

          resolve(
            results
              .map((place): GoogleNearbyReference | null => {
                const name = normalizePlaceStreetText(place.name ?? "");
                const location = readGoogleLatLng(
                  place.geometry?.location ?? null,
                );

                if (!location || !isUsefulGoogleReference(name)) {
                  return null;
                }

                const distance = Math.round(distanceMeters(point, location));
                if (distance > radiusMeters) return null;

                return {
                  name,
                  placeId: place.place_id ?? null,
                  lat: location.lat,
                  lng: location.lng,
                  formattedAddress: place.vicinity ?? null,
                  primaryType:
                    place.types?.find((placeType) =>
                      RAPA_NUI_HIGH_VALUE_REFERENCE_TYPES.has(placeType),
                    ) ??
                    place.types?.[0] ??
                    type ??
                    null,
                  distanceMeters: distance,
                };
              })
              .filter(
                (reference): reference is GoogleNearbyReference =>
                  reference !== null,
              ),
          );
        });
      });

    // En cuentas antiguas seguimos usando Nearby Search Legacy como respaldo.
    // Se consultan varias categorías por separado porque un negocio pequeño
    // puede estar registrado como barbería, salón, tienda o POI genérico.
    const legacyGroups = await Promise.all([
      runNearbySearch("point_of_interest"),
      runNearbySearch("hair_care"),
      runNearbySearch("store"),
      runNearbySearch("lodging"),
      runNearbySearch("restaurant"),
      runNearbySearch("tourist_attraction"),
    ]);

    return dedupeGoogleReferences(legacyGroups.flat());
  } catch {
    return [];
  }
}

async function getNearbyGoogleReferencesTextSearchLegacy(
  point: { lat: number; lng: number },
  radiusMeters: number,
  textQueries: readonly string[],
): Promise<GoogleNearbyReference[]> {
  try {
    await loadRapaGoGoogleMaps();
    if (!window.google?.maps?.places?.PlacesService) return [];

    const container = document.createElement("div");
    const service = new google.maps.places.PlacesService(container);

    const groups = await Promise.all(
      textQueries.map(
        (textQuery): Promise<GoogleNearbyReference[]> =>
          new Promise((resolve) => {
            service.textSearch(
              {
                query: `${textQuery} en Hanga Roa, Rapa Nui`,
                location: new google.maps.LatLng(point.lat, point.lng),
                radius: radiusMeters,
              },
              (results, status) => {
                if (
                  status !== google.maps.places.PlacesServiceStatus.OK ||
                  !results?.length
                ) {
                  resolve([]);
                  return;
                }

                resolve(
                  results
                    .map((place): GoogleNearbyReference | null => {
                      const name = normalizePlaceStreetText(place.name ?? "");
                      const location = readGoogleLatLng(
                        place.geometry?.location ?? null,
                      );

                      if (!location || !isUsefulGoogleReference(name)) {
                        return null;
                      }

                      const directDistance = Math.round(
                        distanceMeters(point, location),
                      );

                      if (
                        directDistance > radiusMeters ||
                        !isPointInsideRapaNuiServiceArea(location)
                      ) {
                        return null;
                      }

                      return {
                        name,
                        placeId: place.place_id ?? null,
                        lat: location.lat,
                        lng: location.lng,
                        formattedAddress:
                          place.formatted_address ?? place.vicinity ?? null,
                        primaryType:
                          place.types?.find((placeType) =>
                            RAPA_NUI_HIGH_VALUE_REFERENCE_TYPES.has(placeType),
                          ) ??
                          place.types?.[0] ??
                          null,
                        distanceMeters: directDistance,
                      };
                    })
                    .filter(
                      (reference): reference is GoogleNearbyReference =>
                        reference !== null,
                    ),
                );
              },
            );
          }),
      ),
    );

    return dedupeGoogleReferences(groups.flat());
  } catch {
    return [];
  }
}

async function getNearbyGoogleReferences(
  point: { lat: number; lng: number },
  radiusMeters = 180,
): Promise<GoogleNearbyReference[]> {
  // Nearby Search por grupos entrega la cobertura principal. Text Search se
  // usa como respaldo específico para negocios que Google dibuja en el mapa
  // pero no devuelve dentro de los 20 resultados de una categoría.
  const [newPlaces, legacyPlaces, priorityTextNew] = await Promise.all([
    getNearbyGoogleReferencesNew(point, radiusMeters),
    getNearbyGoogleReferencesLegacy(point, radiusMeters),
    getNearbyGoogleReferencesTextSearchNew(
      point,
      radiusMeters,
      RAPA_NUI_PRIORITY_REFERENCE_TEXT_QUERIES,
    ),
  ]);

  const hasPriorityBusiness = priorityTextNew.some(
    (reference) => getReferenceDiscoveryPriority(reference) >= 100,
  );

  const priorityTextLegacy = hasPriorityBusiness
    ? []
    : await getNearbyGoogleReferencesTextSearchLegacy(
        point,
        radiusMeters,
        RAPA_NUI_PRIORITY_REFERENCE_TEXT_QUERIES,
      );

  const priorityAndNearby = dedupeGoogleReferences([
    ...priorityTextNew,
    ...priorityTextLegacy,
    ...newPlaces,
    ...legacyPlaces,
  ]);

  const generalTextNew =
    priorityAndNearby.length < 24
      ? await getNearbyGoogleReferencesTextSearchNew(
          point,
          radiusMeters,
          RAPA_NUI_GENERAL_REFERENCE_TEXT_QUERIES,
        )
      : [];

  return dedupeGoogleReferences([
    ...priorityTextNew,
    ...priorityTextLegacy,
    ...priorityAndNearby,
    ...generalTextNew,
  ]).slice(0, 80);
}

async function getBestVisiblePlaceNameForPoint(
  point: { lat: number; lng: number },
  geocodePlaceName?: string | null,
): Promise<string | null> {
  const references = await getNearbyGoogleReferences(point);
  const googlePlace = references[0]?.name ?? null;
  const geocodePlace = isUsefulPlaceStreetValue(geocodePlaceName)
    ? normalizePlaceStreetText(geocodePlaceName)
    : null;

  return googlePlace ?? geocodePlace;
}

function getShortAddress(result: google.maps.GeocoderResult | null): {
  title: string;
  subtitle: string;
} {
  if (!result) {
    return {
      title: "Punto seleccionado",
      subtitle: "Rapa Nui, Chile",
    };
  }

  const route = getGeocodeStreetName(result);
  const premise = getGeocodePlaceName(result);
  const fallback = normalizePlaceStreetText(
    result.formatted_address.split(",")[0],
  );
  const title =
    buildPlaceStreetTitle(premise, route) ?? fallback ?? "Punto seleccionado";

  return {
    title,
    subtitle: result.formatted_address,
  };
}

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const earth = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);

  return earth * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

type PassengerFareType = "resident" | "chilean" | "foreigner";

type FareQuote = {
  km: number;
  minutes: number;
  cashFare: number;
  cardFare: number;
  driverEarning: number;
  platformFee: number;
  source: "google" | "estimated";
  passengerFareType: PassengerFareType;
  vehicleCategory: VehicleCategory;
  isFixedFare: boolean;
  usdRate: number;

  // Nuevo motor urbano/rural:
  // Primero se aplica pasajero + vehículo al KM urbano.
  // Luego se aplica descuento rural sobre ese KM urbano ya ajustado.
  urbanKm: number;
  ruralKm: number;
  urbanLimitKm: number;
  urbanKmFare: number;
  ruralKmFare: number;
  ruralDiscountPercent: number;
  ruralFactor: number;
  calculationType: "fixed" | "urban" | "urban_rural";

  // Tipo de viaje elegido por el pasajero.
  // one_way: solo ida. round_trip: ida y vuelta.
  tripFareMode: TripFareMode;
  tripMultiplier: number;
  oneWayFare: number;
};

type FixedDestinationRule = {
  id: string;
  title: string;
  tripType: string;
  baseResidentClp: number;
  active: boolean;
};

type RoundTripPromotion = {
  id: string;
  destinationId: string;
  destinationName: string;
  search: string;
  fixedPoint: PickerResult | null;
  passengerFareType: PassengerFareType;
  passengerLabel: string;
  title: string;
  baseFareClp: number;
  fareClp: number;
  usdLabel: string;
  chargeLabel?: string;
  detail: string;
};

function calculateRoundTripExperienceFare(
  promotion: RoundTripPromotion,
  vehicleCategory: VehicleCategory,
  rules: RapaGoFareRules,
): number {
  const vehicleMultiplier = rules.vehicleMultipliers[vehicleCategory] ?? 1;

  return roundByAdminRule(
    Math.max(0, promotion.fareClp * vehicleMultiplier),
    rules,
  );
}

const ROUND_TRIP_DESTINATION_SEARCH: Record<string, string> = {
  anakena: "Anakena, Rapa Nui, Chile",
  terevaka: "Maunga Terevaka, Rapa Nui, Chile",
};

// Puntos fijos usados solo para promociones ida y vuelta.
// No dependemos de Google geocode porque a veces Anakena cae en Ahu Ature Huki
// o en una etiqueta cercana y el pin queda corrido en el mapa.
const ROUND_TRIP_DESTINATION_FIXED_POINTS: Record<
  string,
  Omit<
    PickerResult,
    "originalLat" | "originalLng" | "walkMeters" | "isAccessiblePickup"
  >
> = {
  anakena: {
    text: "Anakena",
    address: "Playa Anakena, Rapa Nui, Chile",
    lat: -27.0732,
    lng: -109.3233,
    placeId: "rapago-fixed-anakena",
  },
  terevaka: {
    text: "Terevaka",
    address: "Maunga Terevaka, Rapa Nui, Chile",
    lat: -27.0917,
    lng: -109.382,
    placeId: "rapago-fixed-terevaka",
  },
};

const RAPA_NUI_AIRPORT_DESTINATION: PickerResult = {
  text: "Aeropuerto Internacional Mataveri",
  address:
    "Aeropuerto Internacional Mataveri (IPC), Hanga Roa, Rapa Nui, Chile",
  // Referencia fija del Aeropuerto Internacional Mataveri (IPC/SCIP).
  // Se usa una sola coordenada canónica para Reserva para evitar que el origen
  // quede desplazado por un punto antiguo guardado localmente.
  lat: -27.16472,
  lng: -109.42167,
  placeId: "rapago-fixed-mataveri-airport-terminal",
  originalLat: null,
  originalLng: null,
  walkMeters: 0,
  isAccessiblePickup: false,
};

function isRapaNuiAirportPoint(
  point: ConfirmedPoint | PickerResult | null | undefined,
): boolean {
  if (!point) return false;

  const placeId = String(point.placeId ?? "").toLowerCase();
  const text = normalizeAdminDestinationId(
    `${point.text ?? ""} ${point.address ?? ""}`,
  );

  return (
    placeId === RAPA_NUI_AIRPORT_DESTINATION.placeId ||
    text.includes("aeropuerto") ||
    text.includes("mataveri") ||
    text.includes("airport")
  );
}

function normalizeAdminDestinationId(value: unknown): string {
  return (
    String(value ?? "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "destino"
  );
}

function getRoundTripDestinationKey(destination: FixedDestinationRule): string {
  const normalized = normalizeAdminDestinationId(
    `${destination.id ?? ""} ${destination.title ?? ""}`,
  );

  if (normalized.includes("anakena")) return "anakena";
  if (normalized.includes("terevaka") || normalized.includes("tere_vaka"))
    return "terevaka";

  return normalizeAdminDestinationId(destination.id || destination.title);
}

function getRoundTripDestinationSearch(
  destination: FixedDestinationRule,
): string {
  const id = getRoundTripDestinationKey(destination);
  return (
    ROUND_TRIP_DESTINATION_SEARCH[id] ?? `${destination.title} Rapa Nui Chile`
  );
}

function getRoundTripDestinationFixedPoint(
  destination: FixedDestinationRule,
): PickerResult | null {
  const id = getRoundTripDestinationKey(destination);
  const fixed = ROUND_TRIP_DESTINATION_FIXED_POINTS[id];

  if (!fixed) return null;

  return {
    ...fixed,
    text: destination.title || fixed.text,
    originalLat: null,
    originalLng: null,
    walkMeters: 0,
    isAccessiblePickup: false,
  };
}

function buildAdminRoundTripPromotions(
  rules: RapaGoFareRules,
  passengerFareType: PassengerFareType,
): RoundTripPromotion[] {
  if (rules.passengerActive?.[passengerFareType] === false) return [];

  const passengerLabel = passengerFareTypeLabel(passengerFareType);
  const multiplier = rules.passengerMultipliers[passengerFareType] ?? 1;

  return rules.fixedDestinations
    .filter((destination) => destination.active !== false)
    .filter((destination) =>
      String(destination.tripType ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .includes("vuelta"),
    )
    .map((destination) => {
      const destinationId = getRoundTripDestinationKey(destination);
      const rawFare = Math.max(
        0,
        Number(destination.baseResidentClp || 0) * multiplier,
      );
      const fareClp = roundByAdminRule(rawFare, rules);
      const roundedChanged = Math.round(rawFare) !== fareClp;

      return {
        id: `${destinationId}_${passengerFareType}_roundtrip`,
        destinationId,
        destinationName: destination.title,
        search: getRoundTripDestinationSearch(destination),
        fixedPoint: getRoundTripDestinationFixedPoint(destination),
        passengerFareType,
        passengerLabel,
        title: `${destination.title} · Ida y vuelta`,
        baseFareClp: Math.round(rawFare),
        fareClp,
        usdLabel: formatUSDFromCLP(fareClp, rules.usdRate),
        chargeLabel: roundedChanged
          ? `Cobra ${formatCLP(fareClp)} · ${formatUSDFromCLP(fareClp, rules.usdRate)}`
          : undefined,
        detail: `${destination.title} · ${passengerLabel} · ida y vuelta con precio cerrado.`,
      };
    });
}

type RoundingMode = "ceil" | "nearest" | "none";

type RapaGoFareRules = {
  includedKm: number;
  baseMinimumClp: number;
  baseKmClp: number;

  // Zona urbana/rural configurable desde Admin Tarifas.
  ruralUrbanLimitKm: number;
  ruralDiscountPercent: number;
  ruralFactor: number;

  passengerMultipliers: Record<PassengerFareType, number>;
  vehicleMultipliers: Record<VehicleCategory, number>;
  passengerActive: Record<PassengerFareType, boolean>;
  fixedDestinations: FixedDestinationRule[];
  roundingMode: RoundingMode;
  roundingUnitClp: number;
  usdRate: number;
  cardPaymentPercent: number;
  driverPercent: number;
};

type StoredRegistrationProfile = {
  email?: string | null;
  phone?: string | null;
  rut?: string | null;
  passengerFareType?: PassengerFareType | string | null;
  farePassengerType?: PassengerFareType | string | null;
  passengerType?: PassengerFareType | string | null;
  passengerCondition?: string | null;
  condition?: string | null;
  nationality?: string | null;
  passengerFareLabel?: string | null;
  directPassengerFareType?: string | null;
  directNationality?: string | null;
  isResident?: boolean | string | null;
};

const ADMIN_FARE_ENGINE_STORAGE_KEY = "rapago_admin_fare_engine_v1";
const ADMIN_FARE_CARDS_STORAGE_KEY = "rapago_admin_fare_cards_rules_v1";
const USD_RATE_STORAGE_KEY = "rapago_admin_fare_cards_usd_rate_v1";
const ADMIN_FARE_ENGINE_UPDATED_EVENT = "rapago:fare-engine-updated";
const ADMIN_FARE_ENGINE_SCHEMA_VERSION = 2;

const DEFAULT_RAPAGO_FARE_RULES: RapaGoFareRules = {
  // Tarifa mínima urbana: $5.000 incluye de 0 a 2 km, según tabla tarifaria.
  includedKm: 2,
  baseMinimumClp: 5000,
  baseKmClp: 1000,

  // Nuevo anexo técnico rural:
  // desde 6,01 km, el excedente se cobra como tramo rural con descuento sobre
  // el KM urbano ya ajustado por pasajero y vehículo.
  ruralUrbanLimitKm: 6,
  ruralDiscountPercent: 25,
  ruralFactor: 0.75,
  passengerMultipliers: {
    // RAPA NUI / RESIDENTE RAPA NUI: 10% de descuento sobre la tarifa base.
    resident: 0.9,
    chilean: 1.13,
    foreigner: 1.2,
  },
  vehicleMultipliers: {
    standard: 1,
    xl: 1.4,
    extra_luggage: 1.25,
    comfort: 1.35,
  },
  passengerActive: {
    resident: true,
    chilean: true,
    foreigner: true,
  },
  fixedDestinations: [
    {
      id: "anakena",
      title: "Anakena",
      tripType: "Ida y vuelta",
      baseResidentClp: 38000,
      active: true,
    },
    {
      id: "terevaka",
      title: "Terevaka",
      tripType: "Ida y vuelta",
      baseResidentClp: 20000,
      active: true,
    },
  ],
  roundingMode: "ceil",
  roundingUnitClp: 500,
  usdRate: 1000,
  cardPaymentPercent: 0,
  driverPercent: 85,
};

function readStoredRegistrationProfile(): StoredRegistrationProfile {
  try {
    const raw = localStorage.getItem("rapago_registration_profile");
    const parsed = raw ? (JSON.parse(raw) as StoredRegistrationProfile) : {};

    const directFareType =
      localStorage.getItem("rapago_passenger_fare_type") ??
      localStorage.getItem("rapago_passenger_condition") ??
      localStorage.getItem("rapago_profile_passenger_type") ??
      localStorage.getItem("rapago_fare_passenger_type") ??
      localStorage.getItem("rapago_passenger_type") ??
      localStorage.getItem("farePassengerType") ??
      localStorage.getItem("passengerType") ??
      localStorage.getItem("condition");

    const directNationality =
      localStorage.getItem("rapago_profile_nationality") ??
      localStorage.getItem("rapago_nationality") ??
      localStorage.getItem("nationality");

    return {
      ...parsed,
      phone: parsed.phone ?? localStorage.getItem("rapago_profile_phone"),
      rut: parsed.rut ?? localStorage.getItem("rapago_profile_rut"),
      passengerFareType:
        parsed.passengerFareType ??
        parsed.farePassengerType ??
        parsed.passengerType ??
        directFareType ??
        null,
      farePassengerType:
        parsed.farePassengerType ??
        parsed.passengerFareType ??
        parsed.passengerType ??
        directFareType ??
        null,
      passengerType:
        parsed.passengerType ??
        parsed.farePassengerType ??
        parsed.passengerFareType ??
        directFareType ??
        null,
      nationality:
        parsed.nationality ??
        parsed.passengerFareLabel ??
        directNationality ??
        null,
      passengerFareLabel:
        parsed.passengerFareLabel ??
        parsed.nationality ??
        directNationality ??
        null,
      directPassengerFareType: parsed.directPassengerFareType ?? directFareType,
      directNationality: parsed.directNationality ?? directNationality,
      isResident:
        parsed.isResident ?? localStorage.getItem("rapago_is_resident") ?? null,
    };
  } catch {
    return {};
  }
}

function normalizePassengerFareType(value: unknown): PassengerFareType | null {
  const raw = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!raw) return null;

  // Orden seguro:
  // 1) Turista chileno / chileno no residente.
  // 2) Turista extranjero / extranjero.
  // 3) RAPA NUI / RESIDENTE RAPA NUI.
  // "Turista chileno" contiene la palabra "turista", por eso debe ir antes
  // de la detección genérica de turista/extranjero.
  if (
    raw.includes("turista chileno") ||
    raw.includes("chileno turista") ||
    raw.includes("chilena turista") ||
    raw.includes("chilena") ||
    raw.includes("chileno") ||
    raw.includes("chilean") ||
    raw.includes("chilean non resident") ||
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
    raw.includes("extranjero turista") ||
    raw.includes("extranjera turista") ||
    raw.includes("extranj") ||
    raw.includes("foreigner") ||
    raw.includes("foreign") ||
    raw.includes("visitor foreign") ||
    raw.includes("tourist foreign") ||
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
    // Valor legado eliminado: nunca debe otorgar tarifa residente.
    return "chilean";
  }

  if (
    raw.includes("residente rapa nui") ||
    raw === "resident" ||
    raw === "residente" ||
    raw === "resident approved" ||
    raw === "residente aprobado" ||
    raw === "true" ||
    raw === "1"
  ) {
    return "resident";
  }

  // Si solo dice "turista" y no especifica chileno, se cobra como extranjero.
  if (
    raw.includes("turista") ||
    raw.includes("tourist") ||
    raw.includes("visitor")
  ) {
    return "foreigner";
  }

  return null;
}

function sameEmail(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function getUserStringField(user: unknown, key: string): string | null {
  if (!user || typeof user !== "object") return null;
  const value = (user as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getUserBooleanField(user: unknown, key: string): boolean | null {
  if (!user || typeof user !== "object") return null;
  const value = (user as Record<string, unknown>)[key];
  return typeof value === "boolean" ? value : null;
}

function readPassengerFareType(user?: unknown): PassengerFareType {
  const sessionEmail = getUserStringField(user, "email");

  const fromUser =
    normalizePassengerFareType(getUserStringField(user, "farePassengerType")) ??
    normalizePassengerFareType(getUserStringField(user, "passengerFareType")) ??
    normalizePassengerFareType(getUserStringField(user, "passengerType")) ??
    normalizePassengerFareType(
      getUserStringField(user, "passengerCondition"),
    ) ??
    normalizePassengerFareType(getUserStringField(user, "condition")) ??
    normalizePassengerFareType(getUserStringField(user, "nationality"));

  if (fromUser) return fromUser;
  if (getUserBooleanField(user, "isResident") === true) return "resident";

  try {
    const storedProfile = readStoredRegistrationProfile();
    const storedBelongsToThisUser =
      !storedProfile.email ||
      !sessionEmail ||
      sameEmail(storedProfile.email, sessionEmail);

    if (storedBelongsToThisUser) {
      const stored =
        normalizePassengerFareType(storedProfile.farePassengerType) ??
        normalizePassengerFareType(storedProfile.passengerFareType) ??
        normalizePassengerFareType(storedProfile.passengerType) ??
        normalizePassengerFareType(storedProfile.passengerCondition) ??
        normalizePassengerFareType(storedProfile.condition) ??
        normalizePassengerFareType(storedProfile.directPassengerFareType) ??
        normalizePassengerFareType(storedProfile.directNationality) ??
        normalizePassengerFareType(storedProfile.nationality) ??
        normalizePassengerFareType(storedProfile.passengerFareLabel) ??
        normalizePassengerFareType(storedProfile.isResident) ??
        normalizePassengerFareType(
          localStorage.getItem("rapago_passenger_fare_type"),
        ) ??
        normalizePassengerFareType(
          localStorage.getItem("rapago_passenger_condition"),
        ) ??
        normalizePassengerFareType(
          localStorage.getItem("rapago_fare_passenger_type"),
        ) ??
        normalizePassengerFareType(
          localStorage.getItem("rapago_profile_passenger_type"),
        ) ??
        normalizePassengerFareType(
          localStorage.getItem("rapago_profile_nationality"),
        ) ??
        normalizePassengerFareType(localStorage.getItem("rapago_nationality"));

      if (stored) return stored;
    }
  } catch {
    // Si no existe dato guardado, se usa Turista chileno como valor seguro.
  }

  return "chilean";
}

function readStoredVehicleCategoryMultiplier(
  stored: Partial<Record<string, number>> | undefined,
  category: VehicleCategory,
  fallback: number,
): number {
  if (category === "extra_luggage") {
    return parseStoredNumber(
      stored?.extra_luggage ?? stored?.luggage,
      fallback,
    );
  }

  return parseStoredNumber(stored?.[category], fallback);
}

function vehicleCategoryTitle(category: VehicleCategory): string {
  if (category === "xl") return "Vehículo XL";
  return vehicleCategoryLabel(category);
}

function vehicleCategoryDescription(category: VehicleCategory): string {
  if (category === "xl") return "Mayor capacidad para pasajeros";
  if (category === "extra_luggage") {
    return "Vehículo con capacidad adicional para equipaje";
  }
  if (category === "comfort") {
    return "Vehículos más nuevos y aprobados para una experiencia superior";
  }
  return "Viaje estándar";
}

function vehicleCategoryIcon(category: VehicleCategory): string {
  if (category === "xl") return busOutline;
  if (category === "extra_luggage") return briefcaseOutline;
  if (category === "comfort") return sparklesOutline;
  return carOutline;
}

function tripFareModeLabel(mode: TripFareMode): string {
  return mode === "round_trip" ? "Ida y vuelta" : "Solo ida";
}

function tripFareModeDescription(mode: TripFareMode): string {
  if (mode === "round_trip") {
    return "Regreso incluido en el precio";
  }

  return "Un solo tramo";
}

function passengerFareTypeLabel(type: PassengerFareType): string {
  if (type === "resident") return "RAPA NUI / RESIDENTE RAPA NUI";
  if (type === "chilean") return "Turista chileno";
  return "Turista extranjero";
}

function fareSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function parseStoredNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readLegacyCardsFallback(): Partial<RapaGoFareRules> {
  try {
    const raw = localStorage.getItem(ADMIN_FARE_CARDS_STORAGE_KEY);
    const parsed = raw
      ? (JSON.parse(raw) as Array<{
          id?: string;
          minimumClp?: number | null;
          kmClp?: number | null;
          fixedClp?: number | null;
          active?: boolean;
        }>)
      : [];

    if (!Array.isArray(parsed) || parsed.length === 0) return {};

    const find = (id: string) =>
      parsed.find((rule) => rule.id === id && rule.active !== false) ??
      parsed.find((rule) => rule.id === id);

    const generalMinimum = find("general_minimum")?.minimumClp;
    const generalKm = find("general_km")?.kmClp;
    const anakena = find("anakena_resident_roundtrip")?.fixedClp;
    const terevaka = find("terevaka_resident_roundtrip")?.fixedClp;

    return {
      baseMinimumClp:
        generalMinimum != null ? Number(generalMinimum) : undefined,
      baseKmClp: generalKm != null ? Number(generalKm) : undefined,
      fixedDestinations: [
        {
          id: "anakena",
          title: "Anakena",
          tripType: "Ida y vuelta",
          baseResidentClp: Number(anakena ?? 38000),
          active: true,
        },
        {
          id: "terevaka",
          title: "Terevaka",
          tripType: "Ida y vuelta",
          baseResidentClp: Number(terevaka ?? 20000),
          active: true,
        },
      ],
    };
  } catch {
    return {};
  }
}

async function fetchRapaGoFareRules(): Promise<RapaGoFareRules> {
  const fallback = DEFAULT_RAPAGO_FARE_RULES;

  try {
    const raw = localStorage.getItem(ADMIN_FARE_ENGINE_STORAGE_KEY);
    const legacy = readLegacyCardsFallback();

    if (!raw) {
      return {
        ...fallback,
        ...legacy,
        usdRate: parseStoredNumber(
          localStorage.getItem(USD_RATE_STORAGE_KEY),
          fallback.usdRate,
        ),
      };
    }

    const parsed = JSON.parse(raw) as {
      schemaVersion?: number;
      urban?: {
        includedKm?: number;
        baseMinimumClp?: number;
        baseKmClp?: number;
      };
      rural?: {
        urbanLimitKm?: number;
        ruralDiscountPercent?: number;
        ruralFactor?: number;
      };
      passengerMultipliers?: Partial<Record<PassengerFareType, number>>;
      vehicleMultipliers?: Partial<Record<string, number>>;
      passengerActive?: Partial<Record<PassengerFareType, boolean>>;
      fixedDestinations?: FixedDestinationRule[];
      rounding?: {
        mode?: RoundingMode;
        unitClp?: number;
      };
      usdRate?: number;
      cardPaymentPercent?: number;
      driverPercent?: number;
    };

    const storedSchemaVersion = Math.max(
      0,
      Math.floor(parseStoredNumber(parsed.schemaVersion, 1)),
    );
    const shouldMigrateResidentMultiplier =
      storedSchemaVersion < ADMIN_FARE_ENGINE_SCHEMA_VERSION;
    const residentMultiplier = shouldMigrateResidentMultiplier
      ? 0.9
      : parseStoredNumber(
          parsed.passengerMultipliers?.resident,
          fallback.passengerMultipliers.resident,
        );

    if (shouldMigrateResidentMultiplier) {
      try {
        localStorage.setItem(
          ADMIN_FARE_ENGINE_STORAGE_KEY,
          JSON.stringify({
            ...parsed,
            schemaVersion: ADMIN_FARE_ENGINE_SCHEMA_VERSION,
            passengerMultipliers: {
              ...parsed.passengerMultipliers,
              resident: 0.9,
            },
          }),
        );
      } catch {
        // El cálculo usa 0.90 aunque el navegador no permita actualizar storage.
      }
    }

    return {
      includedKm: parseStoredNumber(
        parsed.urban?.includedKm,
        fallback.includedKm,
      ),
      baseMinimumClp: parseStoredNumber(
        parsed.urban?.baseMinimumClp ?? legacy.baseMinimumClp,
        fallback.baseMinimumClp,
      ),
      baseKmClp: parseStoredNumber(
        parsed.urban?.baseKmClp ?? legacy.baseKmClp,
        fallback.baseKmClp,
      ),
      ruralUrbanLimitKm: Math.max(
        fallback.includedKm,
        parseStoredNumber(
          parsed.rural?.urbanLimitKm,
          fallback.ruralUrbanLimitKm,
        ),
      ),
      ruralDiscountPercent: Math.max(
        0,
        Math.min(
          99,
          parseStoredNumber(
            parsed.rural?.ruralDiscountPercent,
            fallback.ruralDiscountPercent,
          ),
        ),
      ),
      ruralFactor: Math.max(
        0.01,
        parseStoredNumber(
          parsed.rural?.ruralFactor ??
            1 -
              parseStoredNumber(
                parsed.rural?.ruralDiscountPercent,
                fallback.ruralDiscountPercent,
              ) /
                100,
          fallback.ruralFactor,
        ),
      ),
      passengerMultipliers: {
        resident: residentMultiplier,
        chilean: parseStoredNumber(
          parsed.passengerMultipliers?.chilean,
          fallback.passengerMultipliers.chilean,
        ),
        foreigner: parseStoredNumber(
          parsed.passengerMultipliers?.foreigner,
          fallback.passengerMultipliers.foreigner,
        ),
      },
      vehicleMultipliers: {
        standard: readStoredVehicleCategoryMultiplier(
          parsed.vehicleMultipliers,
          "standard",
          fallback.vehicleMultipliers.standard,
        ),
        xl: readStoredVehicleCategoryMultiplier(
          parsed.vehicleMultipliers,
          "xl",
          fallback.vehicleMultipliers.xl,
        ),
        extra_luggage: readStoredVehicleCategoryMultiplier(
          parsed.vehicleMultipliers,
          "extra_luggage",
          fallback.vehicleMultipliers.extra_luggage,
        ),
        comfort: readStoredVehicleCategoryMultiplier(
          parsed.vehicleMultipliers,
          "comfort",
          fallback.vehicleMultipliers.comfort,
        ),
      },
      passengerActive: {
        resident: parsed.passengerActive?.resident !== false,
        chilean: parsed.passengerActive?.chilean !== false,
        foreigner: parsed.passengerActive?.foreigner !== false,
      },
      fixedDestinations:
        Array.isArray(parsed.fixedDestinations) &&
        parsed.fixedDestinations.length > 0
          ? parsed.fixedDestinations.map((item, index) => ({
              id: item.id || `destino_${index + 1}`,
              title: item.title || `Destino ${index + 1}`,
              tripType: item.tripType || "Ida y vuelta",
              baseResidentClp: parseStoredNumber(item.baseResidentClp, 0),
              active: item.active !== false,
            }))
          : (legacy.fixedDestinations ?? fallback.fixedDestinations),
      // Redondeo final obligatorio.
      // Se ignora cualquier configuración antigua "none" o "nearest" guardada en localStorage.
      roundingMode: "ceil",
      roundingUnitClp: Math.max(
        500,
        Math.round(
          parseStoredNumber(parsed.rounding?.unitClp, fallback.roundingUnitClp),
        ),
      ),
      usdRate: Math.max(
        1,
        Math.round(parseStoredNumber(parsed.usdRate, fallback.usdRate)),
      ),
      cardPaymentPercent: parseStoredNumber(
        parsed.cardPaymentPercent,
        fallback.cardPaymentPercent,
      ),
      driverPercent: parseStoredNumber(
        parsed.driverPercent,
        fallback.driverPercent,
      ),
    };
  } catch {
    return fallback;
  }
}

function roundByAdminRule(value: number, rules: RapaGoFareRules): number {
  const safe = Number.isFinite(value) ? Math.max(0, value) : 0;

  // REDONDEO FINAL OBLIGATORIO
  // Se aplica solo al total final del viaje.
  // No se aplica por km, ni por tramo urbano, ni por tramo rural.
  const unit = Math.max(500, Math.round(rules.roundingUnitClp || 500));

  return Math.ceil(safe / unit) * unit;
}

function formatCLP(value: number): string {
  return `$${Math.round(value).toLocaleString("es-CL")} CLP`;
}

function getSafeUsdRate(value?: number | null): number {
  const direct = Number(value);
  if (Number.isFinite(direct) && direct > 0) return direct;

  try {
    const engineRaw = localStorage.getItem(ADMIN_FARE_ENGINE_STORAGE_KEY);
    if (engineRaw) {
      const parsed = JSON.parse(engineRaw) as {
        usdRate?: number | string | null;
      };
      const fromEngine = Number(parsed.usdRate);
      if (Number.isFinite(fromEngine) && fromEngine > 0) return fromEngine;
    }

    const fromCards = Number(localStorage.getItem(USD_RATE_STORAGE_KEY));
    if (Number.isFinite(fromCards) && fromCards > 0) return fromCards;
  } catch {
    // Usa valor seguro por defecto.
  }

  return DEFAULT_RAPAGO_FARE_RULES.usdRate;
}

function formatUSDFromCLP(value: number, usdRate?: number | null): string {
  const safeValue = Number(value);
  const safeRate = getSafeUsdRate(usdRate);

  if (!Number.isFinite(safeValue) || safeValue <= 0) {
    return "USD 0";
  }

  const usd = Math.max(0, safeValue) / safeRate;

  return `USD ${usd.toLocaleString("es-CL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })}`;
}

function detectFixedDestination(
  destinationText: string,
  rules: RapaGoFareRules,
): FixedDestinationRule | null {
  const normalized = fareSearchText(destinationText);

  return (
    rules.fixedDestinations.find((destination) => {
      if (destination.active === false) return false;

      const id = fareSearchText(destination.id);
      const title = fareSearchText(destination.title);

      return normalized.includes(id) || normalized.includes(title);
    }) ?? null
  );
}

function getRuralFactor(rules: RapaGoFareRules): number {
  const discount = Math.max(
    0,
    Math.min(99, Number(rules.ruralDiscountPercent ?? 25)),
  );
  const factorFromDiscount = 1 - discount / 100;
  const configuredFactor = Number(rules.ruralFactor ?? factorFromDiscount);

  return Number.isFinite(configuredFactor) && configuredFactor > 0
    ? configuredFactor
    : factorFromDiscount;
}

function calculateUrbanRuralRawFare(input: {
  km: number;
  rules: RapaGoFareRules;
  passengerMultiplier: number;
  vehicleMultiplier: number;
}): {
  rawCash: number;
  urbanKm: number;
  ruralKm: number;
  urbanLimitKm: number;
  urbanKmFare: number;
  ruralKmFare: number;
  ruralFactor: number;
  ruralDiscountPercent: number;
  calculationType: "urban" | "urban_rural";
} {
  const { km, rules, passengerMultiplier, vehicleMultiplier } = input;

  const urbanLimitKm = Math.max(
    rules.includedKm,
    Number.isFinite(Number(rules.ruralUrbanLimitKm))
      ? Number(rules.ruralUrbanLimitKm)
      : 6,
  );

  const urbanKm = Math.min(km, urbanLimitKm);
  const ruralKm = Math.max(0, km - urbanLimitKm);
  const urbanKmFare = rules.baseKmClp * passengerMultiplier * vehicleMultiplier;
  const ruralFactor = getRuralFactor(rules);

  // Regla corregida:
  // 1) KM urbano base
  // 2) multiplicador pasajero
  // 3) multiplicador vehículo
  // 4) descuento rural del 25% sobre el KM ya ajustado
  const ruralKmFare = urbanKmFare * ruralFactor;
  const adjustedMinimum =
    rules.baseMinimumClp * passengerMultiplier * vehicleMultiplier;
  const urbanAdditionalKm = Math.max(0, urbanKm - rules.includedKm);
  const urbanFare = adjustedMinimum + urbanAdditionalKm * urbanKmFare;

  return {
    rawCash: urbanFare + ruralKm * ruralKmFare,
    urbanKm,
    ruralKm,
    urbanLimitKm,
    urbanKmFare,
    ruralKmFare,
    ruralFactor,
    ruralDiscountPercent: Math.max(
      0,
      Math.min(99, Number(rules.ruralDiscountPercent ?? 25)),
    ),
    calculationType: ruralKm > 0 ? "urban_rural" : "urban",
  };
}

function calculateRapaGoFare(
  km: number,
  minutes: number,
  rules: RapaGoFareRules = DEFAULT_RAPAGO_FARE_RULES,
  passengerType: PassengerFareType = "chilean",
  vehicleCategory: VehicleCategory = "standard",
  destinationText = "",
  tripFareMode: TripFareMode = "one_way",
): FareQuote {
  const safeKm = Math.max(0.1, Number.isFinite(km) ? km : 0.1);
  const safeMinutes = Math.max(1, Number.isFinite(minutes) ? minutes : 1);
  const passengerMultiplier = rules.passengerMultipliers[passengerType] ?? 1;
  const vehicleMultiplier = rules.vehicleMultipliers[vehicleCategory] ?? 1;
  const fixedDestination = detectFixedDestination(destinationText, rules);

  let rawCash: number;
  let isFixedFare = false;

  const ruralBreakdown = calculateUrbanRuralRawFare({
    km: safeKm,
    rules,
    passengerMultiplier,
    vehicleMultiplier,
  });

  if (fixedDestination && tripFareMode === "round_trip") {
    // Las tarifas fijas de destinos como Anakena/Terevaka están definidas
    // como IDA Y VUELTA en el admin. Se aplica multiplicador de pasajero,
    // pero no se vuelve a multiplicar por 2.
    rawCash = fixedDestination.baseResidentClp * passengerMultiplier;
    isFixedFare = true;
  } else {
    // Viaje variable. Para ida y vuelta se cobra el tramo de ida x2.
    rawCash = ruralBreakdown.rawCash * (tripFareMode === "round_trip" ? 2 : 1);
  }

  // Primero calculamos todo exacto: mínimo, pasajero, vehículo, urbano/rural.
  // Recién aquí se redondea el total final.
  const cashFare = roundByAdminRule(rawCash, rules);

  const rawCardFare = rawCash * (1 + rules.cardPaymentPercent / 100);
  const cardFare = roundByAdminRule(rawCardFare, rules);

  const driverEarning = Math.round((cashFare * rules.driverPercent) / 100);
  const platformFee = cashFare - driverEarning;

  return {
    km: Number(safeKm.toFixed(1)),
    minutes: Math.max(1, Math.round(safeMinutes)),
    cashFare,
    cardFare,
    driverEarning,
    platformFee,
    source: "estimated",
    passengerFareType: passengerType,
    vehicleCategory,
    isFixedFare,
    usdRate: rules.usdRate,
    urbanKm: Number(ruralBreakdown.urbanKm.toFixed(2)),
    ruralKm: Number(ruralBreakdown.ruralKm.toFixed(2)),
    urbanLimitKm: ruralBreakdown.urbanLimitKm,
    urbanKmFare: ruralBreakdown.urbanKmFare,
    ruralKmFare: ruralBreakdown.ruralKmFare,
    ruralDiscountPercent: ruralBreakdown.ruralDiscountPercent,
    ruralFactor: ruralBreakdown.ruralFactor,
    calculationType: isFixedFare ? "fixed" : ruralBreakdown.calculationType,
    tripFareMode,
    tripMultiplier: tripFareMode === "round_trip" && !isFixedFare ? 2 : 1,
    oneWayFare: roundByAdminRule(ruralBreakdown.rawCash, rules),
  };
}

function calculateEstimatedFareFromPoints(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  rules: RapaGoFareRules = DEFAULT_RAPAGO_FARE_RULES,
  passengerType: PassengerFareType = "chilean",
  vehicleCategory: VehicleCategory = "standard",
  destinationText = "",
  tripFareMode: TripFareMode = "one_way",
): FareQuote {
  const straightKm = distanceMeters(origin, destination) / 1000;
  const roadKm = straightKm * 1.28;
  const minutes = Math.max(4, Math.round((roadKm / 28) * 60));

  return calculateRapaGoFare(
    roadKm,
    minutes,
    rules,
    passengerType,
    vehicleCategory,
    destinationText,
    tripFareMode,
  );
}

function findNearestRoadResult(
  results: google.maps.GeocoderResult[] | null | undefined,
): google.maps.GeocoderResult | null {
  if (!results?.length) return null;

  return (
    results.find((result) => result.types.includes("route")) ??
    results.find((result) =>
      result.address_components.some((component) =>
        component.types.includes("route"),
      ),
    ) ??
    null
  );
}

async function reverseGeocodeExact(point: Coords): Promise<PickerResult> {
  await loadRapaGoGoogleMaps();

  const geocoder = new google.maps.Geocoder();

  return new Promise((resolve) => {
    geocoder.geocode(
      {
        location: {
          lat: point.lat,
          lng: point.lng,
        },
      },
      (results, status) => {
        const first =
          status === google.maps.GeocoderStatus.OK && results?.[0]
            ? results[0]
            : null;

        const label = getShortAddress(first);
        const streetName = getGeocodeStreetName(first);

        void getBestVisiblePlaceNameForPoint(
          point,
          getGeocodePlaceName(first),
        ).then((placeName) => {
          const title =
            buildPlaceStreetTitle(placeName, streetName) ?? label.title;

          resolve({
            text: title,
            address: label.subtitle,
            lat: point.lat,
            lng: point.lng,
            placeId: first?.place_id ?? point.placeId ?? null,
            originalLat: null,
            originalLng: null,
            walkMeters: 0,
            isAccessiblePickup: false,
          });
        });
      },
    );
  });
}

async function resolveMovedOriginPoint(point: {
  lat: number;
  lng: number;
  text?: string;
  address?: string;
}): Promise<PickerResult> {
  const resolved = await reverseGeocode({
    lat: point.lat,
    lng: point.lng,
    placeId: null,
  });

  return {
    ...resolved,
    originalLat: point.lat,
    originalLng: point.lng,
  };
}

async function reverseGeocode(point: Coords): Promise<PickerResult> {
  await loadRapaGoGoogleMaps();

  const geocoder = new google.maps.Geocoder();

  return new Promise((resolve) => {
    geocoder.geocode(
      {
        location: {
          lat: point.lat,
          lng: point.lng,
        },
      },
      (results, status) => {
        const first =
          status === google.maps.GeocoderStatus.OK && results?.[0]
            ? results[0]
            : null;

        const roadResult = findNearestRoadResult(results);
        const best = roadResult ?? first;
        const roadLabel = getShortAddress(roadResult ?? best);
        const roadName = getGeocodeStreetName(roadResult ?? best);

        const roadLocation = roadResult?.geometry?.location ?? null;
        const pickupPoint = roadLocation
          ? {
              lat: roadLocation.lat(),
              lng: roadLocation.lng(),
            }
          : {
              lat: point.lat,
              lng: point.lng,
            };

        const meters = Math.round(distanceMeters(point, pickupPoint));
        const adjustedToRoad = Boolean(roadResult && meters >= 8);

        void getBestVisiblePlaceNameForPoint(
          point,
          getGeocodePlaceName(first),
        ).then((placeName) => {
          const label = {
            title:
              buildPlaceStreetTitle(placeName, roadName) ?? roadLabel.title,
            subtitle: roadLabel.subtitle,
          };

          resolve({
            text: adjustedToRoad ? `Recogida en ${label.title}` : label.title,
            address: adjustedToRoad
              ? `${label.subtitle} · Camina aprox. ${meters} m hasta la calle accesible`
              : label.subtitle,
            lat: pickupPoint.lat,
            lng: pickupPoint.lng,
            placeId: best?.place_id ?? point.placeId ?? null,
            originalLat: point.lat,
            originalLng: point.lng,
            walkMeters: meters,
            isAccessiblePickup: Boolean(roadResult),
          });
        });
      },
    );
  });
}

async function geocodeTextExact(text: string): Promise<PickerResult | null> {
  await loadRapaGoGoogleMaps();

  const geocoder = new google.maps.Geocoder();

  return new Promise((resolve) => {
    geocoder.geocode(
      {
        address: `${text}, Hanga Roa, Rapa Nui, Chile`,
        region: "CL",
        componentRestrictions: {
          country: "CL",
        },
      },
      (results, status) => {
        if (status !== google.maps.GeocoderStatus.OK || !results?.[0]) {
          resolve(null);
          return;
        }

        const result = results[0];
        const resultPoint = {
          lat: result.geometry.location.lat(),
          lng: result.geometry.location.lng(),
        };

        if (!isPointInsideRapaNuiServiceArea(resultPoint)) {
          resolve(null);
          return;
        }

        const label = getShortAddress(result);

        resolve({
          text: text.trim() || label.title,
          address: result.formatted_address,
          lat: resultPoint.lat,
          lng: resultPoint.lng,
          placeId: result.place_id,
          originalLat: null,
          originalLng: null,
          walkMeters: 0,
          isAccessiblePickup: false,
        });
      },
    );
  });
}

async function geocodeText(text: string): Promise<PickerResult | null> {
  await loadRapaGoGoogleMaps();

  const geocoder = new google.maps.Geocoder();

  return new Promise((resolve) => {
    geocoder.geocode(
      {
        address: `${text}, Hanga Roa, Rapa Nui, Chile`,
        region: "CL",
        componentRestrictions: {
          country: "CL",
        },
      },
      (results, status) => {
        if (status !== google.maps.GeocoderStatus.OK || !results?.[0]) {
          resolve(null);
          return;
        }

        const result = results[0];
        const resultPoint = {
          lat: result.geometry.location.lat(),
          lng: result.geometry.location.lng(),
        };

        if (!isPointInsideRapaNuiServiceArea(resultPoint)) {
          resolve(null);
          return;
        }

        void reverseGeocode({
          lat: resultPoint.lat,
          lng: resultPoint.lng,
          placeId: result.place_id,
        }).then((snapped) => {
          const searchedPlace = normalizePlaceStreetText(text.trim());
          const snappedStreet = normalizePlaceStreetText(snapped.text);
          const combinedTitle =
            buildPlaceStreetTitle(searchedPlace, snappedStreet) ??
            (searchedPlace || snappedStreet || snapped.text);

          resolve({
            ...snapped,
            text: snapped.isAccessiblePickup
              ? `Recogida en ${combinedTitle}`
              : combinedTitle,
          });
        });
      },
    );
  });
}

const RAPA_NUI_PLACE_SCOPE_CACHE = new Map<string, boolean>();
const MAX_RAPA_NUI_PLACE_SCOPE_CACHE_ENTRIES = 240;
// Pertenecer o no a Rapa Nui es un hecho geográfico del placeId, no cambia
// durante la sesión — por eso el cache no necesita TTL, solo el límite de
// tamaño de arriba. Este segundo mapa solo deduplica llamadas EN VUELO: sin
// él, origen y destino pidiendo el mismo placeId sin cache todavía disparan
// dos getDetails() en paralelo en vez de compartir la misma respuesta.
const RAPA_NUI_PLACE_SCOPE_IN_FLIGHT = new Map<string, Promise<boolean | null>>();

export async function isGooglePlaceInsideRapaNui(
  placeId: string,
): Promise<boolean | null> {
  const cached = RAPA_NUI_PLACE_SCOPE_CACHE.get(placeId);
  if (typeof cached === "boolean") return cached;

  const inFlight = RAPA_NUI_PLACE_SCOPE_IN_FLIGHT.get(placeId);
  if (inFlight) return inFlight;

  const request = (async (): Promise<boolean | null> => {
    await loadRapaGoGoogleMaps();

    const container = document.createElement("div");
    const service = new google.maps.places.PlacesService(container);

    const inside = await new Promise<boolean | null>((resolve) => {
      service.getDetails(
        {
          placeId,
          fields: ["geometry", "formatted_address", "name"],
        },
        (place, status) => {
          if (
            status !== google.maps.places.PlacesServiceStatus.OK ||
            !place?.geometry?.location
          ) {
            resolve(null);
            return;
          }

          resolve(
            isPointInsideRapaNuiServiceArea({
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
            }),
          );
        },
      );
    });

    if (typeof inside === "boolean") {
      RAPA_NUI_PLACE_SCOPE_CACHE.set(placeId, inside);
    }

    if (
      RAPA_NUI_PLACE_SCOPE_CACHE.size > MAX_RAPA_NUI_PLACE_SCOPE_CACHE_ENTRIES
    ) {
      const firstKey = RAPA_NUI_PLACE_SCOPE_CACHE.keys().next().value as
        | string
        | undefined;
      if (firstKey) RAPA_NUI_PLACE_SCOPE_CACHE.delete(firstKey);
    }

    return inside;
  })();

  RAPA_NUI_PLACE_SCOPE_IN_FLIGHT.set(placeId, request);

  try {
    return await request;
  } finally {
    if (RAPA_NUI_PLACE_SCOPE_IN_FLIGHT.get(placeId) === request) {
      RAPA_NUI_PLACE_SCOPE_IN_FLIGHT.delete(placeId);
    }
  }
}

async function filterGoogleSuggestionsToRapaNui(
  suggestions: GoogleSuggestion[],
): Promise<GoogleSuggestion[]> {
  const checked = await mapWithConcurrency(
    suggestions.slice(0, 6),
    3,
    async (suggestion) => {
      try {
        const placeScope = await isGooglePlaceInsideRapaNui(suggestion.placeId);

        return {
          suggestion,
          inside:
            placeScope ??
            isSuggestionTextClearlyFromRapaNui(
              `${suggestion.description} ${suggestion.secondaryText}`,
            ),
        };
      } catch {
        return {
          suggestion,
          // Respaldo conservador: solo se muestra si el texto dice claramente
          // que pertenece a la isla. Nunca se aceptan resultados ambiguos.
          inside: isSuggestionTextClearlyFromRapaNui(
            `${suggestion.description} ${suggestion.secondaryText}`,
          ),
        };
      }
    },
  );

  return checked
    .filter((item) => item.inside)
    .map((item) => item.suggestion)
    .slice(0, 6);
}

/* ── Coste de red del autocompletado ──────────────────────────────────────

   Escribir "anakena" son siete pulsaciones, y cada una disparaba su propia
   llamada a Google. Borrar una letra disparaba otra más, para una respuesta
   que ya habíamos tenido hace medio segundo. Con la conexión de la isla eso
   es medio minuto de lista en blanco a lo largo de una búsqueda.

   Tres piezas lo arreglan y las tres viven a nivel de módulo, así que origen
   y destino las comparten:

   - CACHÉ por texto normalizado. "Anakena", "anakena " y "ANAKENA" son la
     misma consulta, así que cambiar mayúsculas o dejar un espacio ya no
     vuelve a pedir nada.
   - EN VUELO: si la misma consulta ya está pedida, se espera a esa en vez de
     abrir una segunda.
   - SERVICIO reutilizado, en lugar de construir uno nuevo por pulsación. */

const MAX_AUTOCOMPLETE_CACHE_ENTRIES = 80;
const AUTOCOMPLETE_CACHE = new Map<string, GoogleSuggestion[]>();
const AUTOCOMPLETE_IN_FLIGHT = new Map<string, Promise<GoogleSuggestion[]>>();

let autocompleteService: google.maps.places.AutocompleteService | null = null;
let autocompleteSessionToken: google.maps.places.AutocompleteSessionToken | null =
  null;

/* De qué constructor salió el servicio guardado. `loadRapaGoGoogleMaps` retira
   y vuelve a inyectar el script cuando cambia la clave de API, y entonces
   `google.maps` es otro objeto: seguir usando el servicio anterior sería
   hablarle a un SDK que ya no existe, y las peticiones se quedarían colgadas
   sin resolver nunca. Se compara la identidad y, si cambió, se reconstruye. */
let autocompleteServiceCtor: unknown = null;

function getAutocompleteService(): google.maps.places.AutocompleteService {
  const ctor = google.maps.places.AutocompleteService;

  if (!autocompleteService || autocompleteServiceCtor !== ctor) {
    autocompleteService = new ctor();
    autocompleteServiceCtor = ctor;
    /* SDK nuevo, sesión nueva: el token viejo pertenece al que se fue. */
    autocompleteSessionToken = null;
  }

  return autocompleteService;
}

/** Vacía lo recordado entre búsquedas.
 *
 *  Existe para las pruebas: sin esto, una prueba que repite la consulta de otra
 *  recibe la respuesta guardada y no llega a llamar al SDK simulado, y el fallo
 *  aparece lejos de su causa. */
export function resetRapaNuiAutocompleteCaches(): void {
  AUTOCOMPLETE_CACHE.clear();
  AUTOCOMPLETE_IN_FLIGHT.clear();
  autocompleteService = null;
  autocompleteServiceCtor = null;
  autocompleteSessionToken = null;
}

function rememberAutocompleteResult(
  key: string,
  suggestions: GoogleSuggestion[],
): void {
  /* Se reinserta para que el uso lo mueva al final: el primer elemento de un
     Map es el menos reciente, que es justo el que conviene tirar. */
  AUTOCOMPLETE_CACHE.delete(key);
  AUTOCOMPLETE_CACHE.set(key, suggestions);

  while (AUTOCOMPLETE_CACHE.size > MAX_AUTOCOMPLETE_CACHE_ENTRIES) {
    const oldest = AUTOCOMPLETE_CACHE.keys().next().value as string | undefined;
    if (!oldest) break;
    AUTOCOMPLETE_CACHE.delete(oldest);
  }
}

/** Token de sesión de Google Places.
 *
 *  Sin él, cada pulsación es una búsqueda suelta: Google no sabe que las
 *  siete de "anakena" son una sola persona buscando una sola cosa, así que ni
 *  aprovecha lo tecleado antes para afinar la predicción ni agrupa el cobro.
 *  Con él, las pulsaciones y el `getDetails` final cuentan como UNA sesión.
 *
 *  El token se consume al pedir los detalles del lugar elegido —esa llamada es
 *  la que cierra la sesión— y la siguiente búsqueda abre uno nuevo. */
function getAutocompleteSessionToken(): google.maps.places.AutocompleteSessionToken | null {
  try {
    if (!autocompleteSessionToken) {
      autocompleteSessionToken =
        new google.maps.places.AutocompleteSessionToken();
    }

    return autocompleteSessionToken;
  } catch {
    /* Versión del SDK sin sesiones: se sigue sin token, que es exactamente el
       comportamiento anterior. */
    return null;
  }
}

function consumeAutocompleteSessionToken(): google.maps.places.AutocompleteSessionToken | null {
  const token = autocompleteSessionToken;
  autocompleteSessionToken = null;
  return token;
}

/** Espera antes de preguntarle a Google, según lo escrito.
 *
 *  No es un número fijo porque las pulsaciones no valen lo mismo. Con dos o
 *  tres letras el pasajero casi seguro sigue escribiendo y la consulta es la
 *  más cara —devuelve medio mapa—, así que conviene dejarle terminar. A partir
 *  de la cuarta ya está cerca del nombre que quiere y lo que toca es
 *  responderle cuanto antes.
 *
 *  Esperar no deja la pantalla vacía: los resultados del catálogo local ya se
 *  pintaron sin esperar a nadie. */
export function autocompleteDebounceMs(query: string): number {
  const normalized = normalizeRapaNuiAutocompleteText(query);
  if (normalized.length <= 3) return 180;
  return 90;
}

/** Carga el SDK de Google por adelantado, sin bloquear a nadie.
 *
 *  La primera búsqueda tenía que esperar a que el script entero se
 *  descargara, y eso es lo más lento de todo el recorrido. Llamando aquí en
 *  cuanto la pantalla existe, para cuando el pasajero toca el campo el SDK ya
 *  está listo. Es idempotente: si ya se cargó, no hace nada. */
export function prewarmRapaNuiAutocomplete(): void {
  void loadRapaGoGoogleMaps()
    .then(() => {
      /* Construir el servicio también cuesta la primera vez. */
      getAutocompleteService();
    })
    .catch(() => {
      /* Sin red o sin clave no hay nada que precalentar: la búsqueda seguirá
         funcionando con el catálogo local. */
    });
}

export async function getGooglePredictions(
  input: string,
): Promise<GoogleSuggestion[]> {
  const cleanInput = input.trim();
  const cacheKey = normalizeRapaNuiAutocompleteText(cleanInput);

  if (cacheKey.length < 2) {
    return [];
  }

  const cached = AUTOCOMPLETE_CACHE.get(cacheKey);
  if (cached) {
    rememberAutocompleteResult(cacheKey, cached);
    return cached;
  }

  const inFlight = AUTOCOMPLETE_IN_FLIGHT.get(cacheKey);
  if (inFlight) return inFlight;

  const request = resolveGooglePredictions(cleanInput, cacheKey);
  AUTOCOMPLETE_IN_FLIGHT.set(cacheKey, request);

  try {
    return await request;
  } finally {
    if (AUTOCOMPLETE_IN_FLIGHT.get(cacheKey) === request) {
      AUTOCOMPLETE_IN_FLIGHT.delete(cacheKey);
    }
  }
}

async function resolveGooglePredictions(
  cleanInput: string,
  cacheKey: string,
): Promise<GoogleSuggestion[]> {
  const localMatches = getRapaNuiLocalAutocompleteMatches(cleanInput);

  try {
    await loadRapaGoGoogleMaps();

    const service = getAutocompleteService();

    // locationRestriction (a diferencia de bounds/location/radius, deprecados
    // desde mayo 2023 y solo un sesgo blando) es una restricción dura del
    // lado de Google: los resultados quedan acotados a estos límites, no
    // solo "preferidos". Por eso ya no hace falta verificar cada sugerencia
    // con getDetails() antes de mostrarla — esa verificación sigue existiendo
    // igual de estricta en getPlaceDetailsExact(), en el momento en que el
    // usuario selecciona un resultado, que es donde de verdad importa.
    /* Si lo escrito es el principio de un nombre conocido, se le pide a Google
       ese nombre entero en vez del fragmento. Sigue siendo UNA sola llamada:
       no se añade red, solo se aprovecha mejor la que ya se hacía. */
    const hintedQuery = matchRapaNuiPlaceHint(cleanInput);
    const sessionToken = getAutocompleteSessionToken();

    /* "No hay nada" y "no pude preguntar" llegan por el mismo sitio pero no se
       guardan igual, así que la respuesta viene etiquetada. ZERO_RESULTS es un
       dato firme y merece recordarse; OVER_QUERY_LIMIT o un corte de red son
       pasajeros, y guardarlos dejaría la búsqueda congelada hasta que el
       pasajero cambiara lo escrito. */
    const answer = await new Promise<{
      usable: boolean;
      suggestions: GoogleSuggestion[];
    }>((resolve) => {
      service.getPlacePredictions(
        {
          input: `${hintedQuery ?? cleanInput} Rapa Nui`,
          componentRestrictions: {
            country: "cl",
          },
          locationRestriction: getRapaNuiMapBounds(),
          types: ["establishment", "geocode"],
          ...(sessionToken ? { sessionToken } : {}),
        },
        (predictions, status) => {
          const { OK, ZERO_RESULTS } = google.maps.places.PlacesServiceStatus;

          if (status === ZERO_RESULTS) {
            resolve({ usable: true, suggestions: [] });
            return;
          }

          if (status !== OK || !predictions) {
            resolve({ usable: false, suggestions: [] });
            return;
          }

          resolve({
            usable: true,
            suggestions: predictions.slice(0, 8).map((prediction) => ({
              placeId: prediction.place_id,
              description: prediction.description,
              mainText: prediction.structured_formatting.main_text,
              secondaryText:
                prediction.structured_formatting.secondary_text ??
                "Rapa Nui, Chile",
            })),
          });
        },
      );
    });

    const merged = mergeRapaNuiAutocompletePredictions(
      localMatches,
      answer.suggestions,
    );

    if (answer.usable) rememberAutocompleteResult(cacheKey, merged);
    return merged;
  } catch {
    /* Sin SDK —sin red, sin clave— queda el catálogo local, que es lo que
       sostiene la pantalla. Tampoco se guarda: en cuanto vuelva la red, la
       misma búsqueda tiene que poder llegar a Google. */
    return mergeRapaNuiAutocompletePredictions(localMatches, []);
  }
}

export async function getPlaceDetailsExact(
  placeId: string,
): Promise<PickerResult | null> {
  const localPlace = getRapaNuiLocalAutocompletePlace(placeId);
  if (localPlace) {
    return localRapaNuiPlaceToPickerResult(localPlace);
  }

  await loadRapaGoGoogleMaps();

  const container = document.createElement("div");
  const service = new google.maps.places.PlacesService(container);

  /* Cierra la sesión abierta por el autocompletado: estas son las coordenadas
     que el pasajero estaba buscando desde la primera letra. */
  const sessionToken = consumeAutocompleteSessionToken();

  return new Promise((resolve) => {
    service.getDetails(
      {
        placeId,
        fields: [
          "name",
          "formatted_address",
          "geometry",
          "place_id",
          "types",
          "business_status",
        ],
        ...(sessionToken ? { sessionToken } : {}),
      },
      (place, status) => {
        if (
          status !== google.maps.places.PlacesServiceStatus.OK ||
          !place?.geometry?.location
        ) {
          resolve(null);
          return;
        }

        const placePoint = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        };

        if (!isPointInsideRapaNuiServiceArea(placePoint)) {
          resolve(null);
          return;
        }

        resolve({
          text: place.name ?? place.formatted_address ?? "Destino seleccionado",
          address: place.formatted_address ?? "Rapa Nui, Chile",
          lat: placePoint.lat,
          lng: placePoint.lng,
          placeId: place.place_id ?? placeId,
          placeTypes: Array.isArray(place.types) ? [...place.types] : [],
          originalLat: null,
          originalLng: null,
          walkMeters: 0,
          isAccessiblePickup: false,
        });
      },
    );
  });
}

function createPreferredReferenceFromExactPlace(
  exact: PickerResult,
  origin: { lat: number; lng: number },
): GoogleNearbyReference | null {
  const name = normalizePlaceStreetText(exact.text);
  const placeTypes = Array.isArray(exact.placeTypes)
    ? exact.placeTypes.map((type) => String(type))
    : [];
  const normalizedTypes = placeTypes.map((type) =>
    normalizePlaceStreetCompare(type).replace(/ /g, "_"),
  );
  const isAddressOnly = normalizedTypes.some((type) =>
    RAPA_NUI_REFERENCE_EXCLUDED_PRIMARY_TYPES.has(type),
  );
  const isRecognizablePlace = normalizedTypes.some((type) =>
    [
      "point_of_interest",
      "establishment",
      ...RAPA_NUI_REFERENCE_PLACE_TYPES,
    ].includes(type),
  );

  if (
    !exact.placeId ||
    !isUsefulGoogleReference(name) ||
    (isAddressOnly && !isRecognizablePlace)
  ) {
    return null;
  }

  const preferredType =
    normalizedTypes.find((type) =>
      RAPA_NUI_HIGH_VALUE_REFERENCE_TYPES.has(type),
    ) ??
    normalizedTypes.find((type) =>
      RAPA_NUI_REFERENCE_PLACE_TYPES.includes(
        type as (typeof RAPA_NUI_REFERENCE_PLACE_TYPES)[number],
      ),
    ) ??
    normalizedTypes[0] ??
    null;

  return {
    name,
    placeId: exact.placeId,
    lat: exact.lat,
    lng: exact.lng,
    formattedAddress: exact.address || null,
    primaryType: preferredType,
    distanceMeters: Math.round(distanceMeters(origin, exact)),
  };
}

async function getPlaceDetails(placeId: string): Promise<PickerResult | null> {
  const localPlace = getRapaNuiLocalAutocompletePlace(placeId);

  if (localPlace) {
    await loadRapaGoGoogleMaps();
    const localPoint = localRapaNuiPlaceToPickerResult(localPlace);

    try {
      const snapped = await reverseGeocode({
        lat: localPoint.lat,
        lng: localPoint.lng,
        placeId: localPoint.placeId ?? placeId,
      });

      return {
        ...snapped,
        text: snapped.isAccessiblePickup
          ? `Recogida en ${localPlace.name}`
          : localPlace.name,
        address: localPlace.address,
        placeId: localPoint.placeId,
        placeTypes: [...localPlace.placeTypes],
      };
    } catch {
      return localPoint;
    }
  }

  await loadRapaGoGoogleMaps();

  const container = document.createElement("div");
  const service = new google.maps.places.PlacesService(container);

  return new Promise((resolve) => {
    service.getDetails(
      {
        placeId,
        fields: ["name", "formatted_address", "geometry", "place_id"],
      },
      (place, status) => {
        if (
          status !== google.maps.places.PlacesServiceStatus.OK ||
          !place?.geometry?.location
        ) {
          resolve(null);
          return;
        }

        const placePoint = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        };

        if (!isPointInsideRapaNuiServiceArea(placePoint)) {
          resolve(null);
          return;
        }

        void reverseGeocode({
          lat: placePoint.lat,
          lng: placePoint.lng,
          placeId: place.place_id ?? placeId,
        }).then((snapped) => {
          const placeName = normalizePlaceStreetText(
            place.name ?? place.formatted_address ?? "",
          );
          const snappedStreet = normalizePlaceStreetText(snapped.text);
          const combinedTitle =
            buildPlaceStreetTitle(placeName, snappedStreet) ??
            (placeName || snappedStreet || snapped.text);

          resolve({
            ...snapped,
            text: snapped.isAccessiblePickup
              ? `Recogida en ${combinedTitle}`
              : combinedTitle,
            address: snapped.address,
          });
        });
      },
    );
  });
}

type RoadPickupProbe = {
  lat: number;
  lng: number;
  placeId: string | null;
  streetName: string;
  formattedAddress: string;
  probeHits: number;
};

type WalkingMetrics = {
  meters: number;
  minutes: number;
};

const GOOGLE_PICKUP_CACHE = new Map<string, Promise<PickerResult[]>>();
const MAX_GOOGLE_PICKUP_CACHE_ENTRIES = 60;

function createPickupCacheKey(point: { lat: number; lng: number }): string {
  // Cinco decimales evita reutilizar recomendaciones de un punto azul que fue
  // movido varios metros. El prefijo invalida cachés de versiones anteriores.
  return `references-v9:${point.lat.toFixed(5)}:${point.lng.toFixed(5)}`;
}

function offsetPointByMeters(
  point: { lat: number; lng: number },
  meters: number,
  bearingDegrees: number,
): { lat: number; lng: number } {
  const earthRadius = 6371000;
  const angularDistance = meters / earthRadius;
  const bearing = toRad(bearingDegrees);
  const lat1 = toRad(point.lat);
  const lng1 = toRad(point.lng);

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

function buildPickupProbePoints(point: {
  lat: number;
  lng: number;
}): Array<{ lat: number; lng: number }> {
  const probes: Array<{ lat: number; lng: number }> = [point];

  for (const bearing of [0, 45, 90, 135, 180, 225, 270, 315]) {
    probes.push(offsetPointByMeters(point, 45, bearing));
  }

  for (const bearing of [0, 90, 180, 270]) {
    probes.push(offsetPointByMeters(point, 110, bearing));
  }

  return probes;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(
        items[currentIndex] as T,
        currentIndex,
      );
    }
  }

  const workers = Array.from(
    {
      length: Math.max(1, Math.min(concurrency, items.length)),
    },
    () => worker(),
  );

  await Promise.all(workers);
  return results;
}

async function geocodeRoadProbe(
  geocoder: google.maps.Geocoder,
  point: { lat: number; lng: number },
): Promise<RoadPickupProbe | null> {
  return new Promise((resolve) => {
    geocoder.geocode(
      {
        location: point,
      },
      (results, status) => {
        if (status !== google.maps.GeocoderStatus.OK || !results?.length) {
          resolve(null);
          return;
        }

        const roadResult = findNearestRoadResult(results);
        const streetName = getGeocodeStreetName(roadResult);

        if (!roadResult || !streetName) {
          resolve(null);
          return;
        }

        const roadLocation = readGoogleLatLng(
          roadResult.geometry?.location ?? null,
        );

        if (!roadLocation) {
          resolve(null);
          return;
        }

        if (distanceMeters(point, roadLocation) > 100) {
          resolve(null);
          return;
        }

        resolve({
          lat: roadLocation.lat,
          lng: roadLocation.lng,
          placeId: roadResult.place_id ?? null,
          streetName,
          formattedAddress: roadResult.formatted_address,
          probeHits: 1,
        });
      },
    );
  });
}

function dedupeRoadPickupProbes(
  probes: RoadPickupProbe[],
  origin: { lat: number; lng: number },
): RoadPickupProbe[] {
  const bestByStreet = new Map<
    string,
    RoadPickupProbe & { straightMeters: number }
  >();
  const hitsByStreet = new Map<string, number>();

  for (const probe of probes) {
    const streetKey = normalizePlaceStreetCompare(probe.streetName);
    if (!streetKey) continue;

    hitsByStreet.set(streetKey, (hitsByStreet.get(streetKey) ?? 0) + 1);

    const candidate = {
      ...probe,
      straightMeters: distanceMeters(origin, probe),
    };

    const previous = bestByStreet.get(streetKey);

    if (!previous || candidate.straightMeters < previous.straightMeters) {
      bestByStreet.set(streetKey, candidate);
    }
  }

  return Array.from(bestByStreet.entries())
    .map(([streetKey, candidate]) => ({
      ...candidate,
      probeHits: hitsByStreet.get(streetKey) ?? 1,
    }))
    .sort((a, b) => a.straightMeters - b.straightMeters)
    .slice(0, 6)
    .map(({ straightMeters: _straightMeters, ...probe }) => probe);
}

async function getWalkingMetricsWithRouteClass(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
): Promise<WalkingMetrics | null> {
  try {
    const routesNamespace = (await google.maps.importLibrary(
      "routes",
    )) as unknown as {
      Route?: {
        computeRoutes?: (request: Record<string, unknown>) => Promise<{
          routes?: Array<{
            distanceMeters?: number | null;
            durationMillis?: number | null;
          }>;
        }>;
      };
    };

    const computeRoutes = routesNamespace.Route?.computeRoutes;
    if (!computeRoutes) return null;

    const response = await computeRoutes({
      origin,
      destination,
      travelMode: "WALKING",
      fields: ["distanceMeters", "durationMillis"],
      language: "es",
      region: "CL",
    });

    const route = response.routes?.[0];
    const meters = Number(route?.distanceMeters);
    const durationMillis = Number(route?.durationMillis);

    if (!Number.isFinite(meters) || meters < 0) return null;

    return {
      meters: Math.round(meters),
      minutes:
        Number.isFinite(durationMillis) && durationMillis > 0
          ? Math.max(1, Math.ceil(durationMillis / 60000))
          : Math.max(1, Math.ceil(meters / 75)),
    };
  } catch {
    return null;
  }
}

async function getWalkingMetricsLegacy(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
): Promise<WalkingMetrics | null> {
  try {
    const service = new google.maps.DirectionsService();

    const result = await service.route({
      origin,
      destination,
      travelMode: google.maps.TravelMode.WALKING,
      provideRouteAlternatives: false,
    });

    const leg = result.routes[0]?.legs[0];
    const meters = leg?.distance?.value;
    const seconds = leg?.duration?.value;

    if (!Number.isFinite(meters) || Number(meters) < 0) return null;

    return {
      meters: Math.round(Number(meters)),
      minutes:
        Number.isFinite(seconds) && Number(seconds) > 0
          ? Math.max(1, Math.ceil(Number(seconds) / 60))
          : Math.max(1, Math.ceil(Number(meters) / 75)),
    };
  } catch {
    return null;
  }
}

async function getGoogleWalkingMetrics(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
): Promise<WalkingMetrics> {
  const directMeters = distanceMeters(origin, destination);

  if (directMeters <= 8) {
    return {
      meters: Math.round(directMeters),
      minutes: 1,
    };
  }

  const routeClass = await getWalkingMetricsWithRouteClass(origin, destination);

  if (routeClass) return routeClass;

  const legacyRoute = await getWalkingMetricsLegacy(origin, destination);
  if (legacyRoute) return legacyRoute;

  const estimatedMeters = Math.round(directMeters * 1.18);

  return {
    meters: estimatedMeters,
    minutes: Math.max(1, Math.ceil(estimatedMeters / 75)),
  };
}

/**
 * Google no siempre tiene conectados todos los senderos peatonales de Rapa
 * Nui. En esos casos puede devolver una vuelta artificial de varios cientos
 * de metros aunque el local esté visible y muy cerca del punto azul.
 *
 * Para una referencia comercial usamos la ruta de Google cuando es coherente;
 * si la ruta es desproporcionada, usamos la distancia directa conservadora.
 * La accesibilidad vehicular se valida por separado con `findReferenceAccessRoad`.
 */
async function getReferenceWalkingMetrics(
  origin: { lat: number; lng: number },
  reference: GoogleNearbyReference,
): Promise<WalkingMetrics> {
  const directMeters = Math.max(
    0,
    Math.round(distanceMeters(origin, reference)),
  );
  const routed = await getGoogleWalkingMetrics(origin, reference);
  const maximumCoherentRoute = Math.max(
    directMeters + 120,
    Math.round(directMeters * 2.2),
  );

  if (
    routed.meters > maximumCoherentRoute &&
    directMeters <= RAPA_NUI_REFERENCE_MAX_WALK_METERS
  ) {
    return {
      meters: directMeters,
      minutes: Math.max(1, Math.ceil(directMeters / 75)),
    };
  }

  return routed;
}

function buildAutomaticPickupText(
  streetName: string,
  reference: GoogleNearbyReference | null,
): string {
  if (!reference) return `Recogida en ${streetName}`;

  const relation = reference.distanceMeters <= 35 ? "frente a" : "cerca de";

  return `Recogida en ${streetName}, ${relation} ${reference.name}`;
}

function getVehicleAccessLabel(
  result: google.maps.GeocoderResult | null | undefined,
): string {
  const routeName = getGeocodeStreetName(result);
  if (routeName) return routeName;

  const firstPart = normalizePlaceStreetText(
    result?.formatted_address?.split(",")[0] ?? "",
  );

  return isUsefulPlaceStreetValue(firstPart)
    ? firstPart
    : "Acceso vehicular cercano";
}

async function geocodeAccessLocation(
  geocoder: google.maps.Geocoder,
  point: { lat: number; lng: number },
): Promise<google.maps.GeocoderResult[]> {
  return new Promise((resolve) => {
    geocoder.geocode({ location: point }, (results, status) => {
      resolve(
        status === google.maps.GeocoderStatus.OK && results ? [...results] : [],
      );
    });
  });
}

async function findReferenceDrivingAccessRoad(
  reference: GoogleNearbyReference,
  geocoder: google.maps.Geocoder,
  roadsNearUser: RoadPickupProbe[],
): Promise<{
  road: RoadPickupProbe;
  referenceToRoadMeters: number;
} | null> {
  try {
    const directions = new google.maps.DirectionsService();

    const roadOrigins = [...roadsNearUser]
      .sort(
        (a, b) => distanceMeters(reference, a) - distanceMeters(reference, b),
      )
      .slice(0, 3)
      .map((road) => ({ lat: road.lat, lng: road.lng }));

    // Cuando todavía no hay una calle detectada junto al usuario, Google
    // igualmente puede ajustar estos orígenes a la red vehicular más próxima.
    const fallbackOrigins = [
      RAPA_NUI_CENTER,
      offsetPointByMeters(reference, 280, 0),
      offsetPointByMeters(reference, 280, 90),
      offsetPointByMeters(reference, 280, 180),
      offsetPointByMeters(reference, 280, 270),
    ];

    const origins = [...roadOrigins, ...fallbackOrigins].slice(0, 6);

    for (const origin of origins) {
      try {
        const result = await directions.route({
          origin,
          destination: { lat: reference.lat, lng: reference.lng },
          travelMode: google.maps.TravelMode.DRIVING,
          provideRouteAlternatives: false,
        });

        const leg = result.routes[0]?.legs[0];
        const endLocation = readGoogleLatLng(leg?.end_location ?? null);
        if (!endLocation) continue;

        const referenceToRoadMeters = Math.round(
          distanceMeters(reference, endLocation),
        );

        if (
          referenceToRoadMeters > RAPA_NUI_REFERENCE_MAX_DRIVING_ACCESS_METERS
        ) {
          continue;
        }

        const geocodeResults = await geocodeAccessLocation(
          geocoder,
          endLocation,
        );
        const roadResult =
          findNearestRoadResult(geocodeResults) ?? geocodeResults[0] ?? null;
        const streetName = getVehicleAccessLabel(roadResult);
        const formattedAddress =
          roadResult?.formatted_address ??
          reference.formattedAddress ??
          `${streetName}, Rapa Nui`;

        return {
          road: {
            lat: endLocation.lat,
            lng: endLocation.lng,
            placeId: roadResult?.place_id ?? null,
            streetName,
            formattedAddress,
            probeHits: 2,
          },
          referenceToRoadMeters,
        };
      } catch {
        // Probamos el siguiente origen; algunas calles privadas o pasajes
        // todavía no están conectados desde todos los sectores en Google.
      }
    }
  } catch {
    // Se mantiene el filtro de seguridad: sin ruta vehicular no se inventa.
  }

  return null;
}

async function findReferenceAccessRoad(
  reference: GoogleNearbyReference,
  geocoder: google.maps.Geocoder,
  roadsNearUser: RoadPickupProbe[],
): Promise<{
  road: RoadPickupProbe;
  referenceToRoadMeters: number;
} | null> {
  const directRoad = await geocodeRoadProbe(geocoder, {
    lat: reference.lat,
    lng: reference.lng,
  });

  const namedRoadCandidate = dedupeRoadPickupProbes(
    [...(directRoad ? [directRoad] : []), ...roadsNearUser],
    reference,
  )
    .map((road) => ({
      road,
      referenceToRoadMeters: Math.round(distanceMeters(reference, road)),
    }))
    .filter(
      ({ referenceToRoadMeters }) =>
        referenceToRoadMeters <=
        RAPA_NUI_REFERENCE_MAX_DISTANCE_FROM_ROAD_METERS,
    )
    .sort(
      (a, b) =>
        a.referenceToRoadMeters - b.referenceToRoadMeters ||
        b.road.probeHits - a.road.probeHits,
    )[0];

  if (namedRoadCandidate) return namedRoadCandidate;

  // Muchos accesos de Rapa Nui están dibujados en Google pero no tienen un
  // nombre de calle en Geocoder. Antes esos locales se descartaban aunque
  // Directions sí permitiera llegar en vehículo. Validamos la ruta vehicular
  // y usamos el final de la ruta como acceso, manteniendo el pin verde sobre
  // las coordenadas exactas del local.
  const drivingAccess = await findReferenceDrivingAccessRoad(
    reference,
    geocoder,
    roadsNearUser,
  );

  if (drivingAccess) return drivingAccess;

  // Último respaldo: cuatro puntos alrededor del POI para encontrar una calle
  // que Geocoder no devolvió desde el centro del negocio.
  const ringPoints = [0, 90, 180, 270].map((bearing) =>
    offsetPointByMeters(reference, 80, bearing),
  );
  const ringRoads = await mapWithConcurrency(ringPoints, 2, async (probe) =>
    geocodeRoadProbe(geocoder, probe),
  );

  return (
    dedupeRoadPickupProbes(
      ringRoads.filter((road): road is RoadPickupProbe => road !== null),
      reference,
    )
      .map((road) => ({
        road,
        referenceToRoadMeters: Math.round(distanceMeters(reference, road)),
      }))
      .filter(
        ({ referenceToRoadMeters }) =>
          referenceToRoadMeters <=
          RAPA_NUI_REFERENCE_MAX_DISTANCE_FROM_ROAD_METERS,
      )
      .sort((a, b) => a.referenceToRoadMeters - b.referenceToRoadMeters)[0] ??
    null
  );
}

async function buildNearbyReferencePickupCandidates(
  point: { lat: number; lng: number },
  references: GoogleNearbyReference[],
  geocoder: google.maps.Geocoder,
  roadsNearUser: RoadPickupProbe[],
): Promise<Array<PickerResult & { score: number }>> {
  const referencesInsideRadius = references.filter(
    (reference) =>
      reference.distanceMeters <= RAPA_NUI_NEARBY_REFERENCE_RADIUS_METERS,
  );

  // Conservamos los puntos más cercanos y, además, los comercios de alto
  // valor como barberías. Antes se cortaba la lista en los primeros 12 por
  // distancia y Mamoe barber podía quedar fuera antes de validar su acceso.
  const priorityReferences = [...referencesInsideRadius]
    .filter((reference) => getReferenceDiscoveryPriority(reference) > 0)
    .sort(
      (a, b) =>
        getReferenceDiscoveryPriority(b) - getReferenceDiscoveryPriority(a) ||
        a.distanceMeters - b.distanceMeters,
    )
    .slice(0, 16);

  const nearestReferences = [...referencesInsideRadius]
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, 24);

  const nearbyReferences = dedupeGoogleReferences([
    ...priorityReferences,
    ...nearestReferences,
  ]).slice(0, 32);

  const resolved = await mapWithConcurrency(
    nearbyReferences,
    3,
    async (reference): Promise<(PickerResult & { score: number }) | null> => {
      const access = await findReferenceAccessRoad(
        reference,
        geocoder,
        roadsNearUser,
      );

      // Un local solo se recomienda cuando Google también detecta una vía
      // cercana para que el conductor pueda llegar al sector.
      if (!access) return null;

      // La distancia de caminata se calcula hasta el POI exacto de Google.
      // Por eso el marcador verde queda sobre la barbería/local y no sobre
      // una calle distinta situada más lejos.
      const walking = await getReferenceWalkingMetrics(point, reference);

      if (walking.meters > RAPA_NUI_REFERENCE_MAX_WALK_METERS) {
        return null;
      }

      const score =
        walking.meters +
        access.referenceToRoadMeters * 0.12 -
        getReferenceTypePriorityBonus(reference) * 1.5;

      return {
        text: `Recogida en ${reference.name}`,
        address:
          reference.formattedAddress ??
          `${access.road.formattedAddress} · Acceso cercano al local`,
        // IMPORTANTE: el punto verde se coloca en el negocio/referencia.
        lat: reference.lat,
        lng: reference.lng,
        placeId: reference.placeId,
        originalLat: point.lat,
        originalLng: point.lng,
        walkMeters: walking.meters,
        walkMinutes: walking.minutes,
        isAccessiblePickup: true,
        streetName: access.road.streetName,
        referenceName: reference.name,
        referenceDistanceMeters: access.referenceToRoadMeters,
        candidateId: `reference:${
          reference.placeId ?? normalizePlaceStreetCompare(reference.name)
        }:${reference.lat.toFixed(5)}:${reference.lng.toFixed(5)}`,
        recommendationKind: "reference",
        isRecommended: false,
        recommendationReason: null,
        roadProbeHits: access.road.probeHits,
        score,
      };
    },
  );

  const seenReferences = new Set<string>();

  return resolved
    .filter(
      (candidate): candidate is PickerResult & { score: number } =>
        candidate !== null,
    )
    .sort(
      (a, b) =>
        Number(a.walkMeters ?? Number.POSITIVE_INFINITY) -
          Number(b.walkMeters ?? Number.POSITIVE_INFINITY) || a.score - b.score,
    )
    .filter((candidate) => {
      const key = normalizePlaceStreetCompare(candidate.referenceName);
      if (!key || seenReferences.has(key)) return false;
      seenReferences.add(key);
      return true;
    });
}

async function computeGooglePickupCandidates(
  point: { lat: number; lng: number },
  preferredReference: GoogleNearbyReference | null = null,
): Promise<PickerResult[]> {
  await loadRapaGoGoogleMaps();

  const geocoder = new google.maps.Geocoder();
  const probes = buildPickupProbePoints(point);

  const roadResults = await mapWithConcurrency(probes, 4, async (probe) =>
    geocodeRoadProbe(geocoder, probe),
  );

  const roads = dedupeRoadPickupProbes(
    roadResults.filter((road): road is RoadPickupProbe => road !== null),
    point,
  );

  // Primero buscamos negocios, locales o referencias alrededor del punto azul.
  // Cuando Google encuentra uno válido, el punto verde se coloca directamente
  // sobre el POI (por ejemplo Mamo'e barber) y se conserva la calle de acceso
  // como información adicional para el conductor.
  const automaticReferences = await getNearbyGoogleReferences(
    point,
    RAPA_NUI_NEARBY_REFERENCE_RADIUS_METERS,
  );
  const references = dedupeGoogleReferences([
    ...(preferredReference ? [preferredReference] : []),
    ...automaticReferences,
  ]);
  const referenceCandidates = await buildNearbyReferencePickupCandidates(
    point,
    references,
    geocoder,
    roads,
  );

  if (referenceCandidates.length > 0) {
    const preferredPlaceId = String(preferredReference?.placeId ?? "");
    const preferredName = normalizePlaceStreetCompare(preferredReference?.name);
    const walkOrderedCandidates = [...referenceCandidates].sort(
      (a, b) =>
        Number(a.walkMeters ?? Number.POSITIVE_INFINITY) -
          Number(b.walkMeters ?? Number.POSITIVE_INFINITY) || a.score - b.score,
    );

    const preferredCandidate = walkOrderedCandidates.find(
      (candidate) =>
        preferredReference &&
        ((preferredPlaceId &&
          String(candidate.placeId ?? "") === preferredPlaceId) ||
          (preferredName &&
            normalizePlaceStreetCompare(candidate.referenceName) ===
              preferredName)),
    );

    const nearestWalkMeters = Number(
      walkOrderedCandidates[0]?.walkMeters ?? Number.POSITIVE_INFINITY,
    );

    // Una barbería, cafetería, tienda u otro comercio reconocible es una
    // mejor referencia que un alojamiento cuando la caminata es parecida.
    // Nunca se elige si obliga a caminar demasiado: debe estar dentro del
    // rango recomendado y como máximo 70 m por sobre el punto más cercano.
    const practicalCandidate = walkOrderedCandidates.find(
      (candidate) =>
        isPracticalPickupReference(candidate) &&
        Number(candidate.walkMeters ?? Number.POSITIVE_INFINITY) <=
          RAPA_NUI_PICKUP_MAX_RECOMMENDED_WALK_METERS &&
        Number(candidate.walkMeters ?? Number.POSITIVE_INFINITY) <=
          nearestWalkMeters + 70,
    );

    const recommendedCandidate =
      preferredCandidate ?? practicalCandidate ?? walkOrderedCandidates[0];

    const visibleCandidates = [
      recommendedCandidate,
      ...walkOrderedCandidates.filter(
        (candidate) =>
          candidate.candidateId !== recommendedCandidate?.candidateId,
      ),
    ]
      .filter((candidate): candidate is PickerResult & { score: number } =>
        Boolean(candidate),
      )
      .slice(0, 10);

    return visibleCandidates.map(({ score: _score, ...candidate }, index) => ({
      ...candidate,
      isRecommended: index === 0,
      recommendationReason:
        index === 0
          ? preferredReference
            ? `${candidate.referenceName ?? "Este lugar"} fue elegido en Google Maps y tiene acceso vehicular cercano.`
            : `${candidate.referenceName ?? "Sitio cercano"} es una referencia próxima, reconocible y accesible para vehículos. Caminata estimada: ${Math.round(
                Number(candidate.walkMeters ?? 0),
              )} m.`
          : "Otro local cercano detectado automáticamente por Google Maps.",
    }));
  }

  // No se detectó ningún local adecuado dentro del radio permitido.
  // En ese caso no se inventan referencias: se usa directamente una calle.
  if (roads.length === 0) {
    const fallback = await reverseGeocode(point);

    if (
      !fallback.isAccessiblePickup ||
      !isPointInsideRapaNuiServiceArea({
        lat: fallback.lat,
        lng: fallback.lng,
      })
    ) {
      return [];
    }

    return [
      {
        ...fallback,
        walkMinutes: Math.max(
          1,
          Math.ceil(Number(fallback.walkMeters ?? 0) / 75),
        ),
        referenceName: null,
        referenceDistanceMeters: null,
        streetName:
          fallback.streetName ??
          fallback.text.replace(/^Recogida en\s+/i, "").split(",")[0],
        candidateId: `road-fallback:${fallback.lat.toFixed(5)}:${fallback.lng.toFixed(5)}`,
        recommendationKind: "road",
        isRecommended: true,
        recommendationReason:
          "No se detectaron locales cercanos; se usa la calle accesible más próxima.",
        roadProbeHits: 1,
      },
    ];
  }

  const roadCandidates = await mapWithConcurrency(
    roads,
    3,
    async (road): Promise<PickerResult & { score: number }> => {
      const walking = await getGoogleWalkingMetrics(point, road);
      const roadImportanceBonus = Math.min(4, road.probeHits) * 7;
      const score = walking.meters - roadImportanceBonus;

      return {
        text: buildAutomaticPickupText(road.streetName, null),
        address: road.formattedAddress,
        lat: road.lat,
        lng: road.lng,
        placeId: road.placeId,
        originalLat: point.lat,
        originalLng: point.lng,
        walkMeters: walking.meters,
        walkMinutes: walking.minutes,
        isAccessiblePickup: true,
        streetName: road.streetName,
        referenceName: null,
        referenceDistanceMeters: null,
        candidateId: `${normalizePlaceStreetCompare(
          road.streetName,
        )}:${road.lat.toFixed(5)}:${road.lng.toFixed(5)}`,
        recommendationKind: road.probeHits >= 2 ? "main_road" : "road",
        isRecommended: false,
        recommendationReason: null,
        roadProbeHits: road.probeHits,
        score,
      };
    },
  );

  const orderedByWalk = [...roadCandidates].sort(
    (a, b) =>
      Number(a.walkMeters ?? Number.POSITIVE_INFINITY) -
      Number(b.walkMeters ?? Number.POSITIVE_INFINITY),
  );
  const nearestRoad = orderedByWalk[0] ?? null;
  const nearestWalkMeters = Number(
    nearestRoad?.walkMeters ?? Number.POSITIVE_INFINITY,
  );

  const bestMainRoad = roadCandidates
    .filter(
      (candidate) =>
        Number(candidate.roadProbeHits ?? 0) >= 2 &&
        Number(candidate.walkMeters ?? Number.POSITIVE_INFINITY) <=
          RAPA_NUI_PICKUP_MAX_RECOMMENDED_WALK_METERS &&
        Number(candidate.walkMeters ?? Number.POSITIVE_INFINITY) <=
          nearestWalkMeters + 70,
    )
    .sort((a, b) => a.score - b.score)[0];

  const recommended = bestMainRoad ?? nearestRoad;
  if (!recommended) return [];

  const { score: _score, ...candidate } = recommended;

  return [
    {
      ...candidate,
      isRecommended: true,
      recommendationReason:
        "No se detectaron locales cercanos; se usa la calle accesible más próxima.",
    },
  ];
}

async function getGooglePickupCandidates(
  point: { lat: number; lng: number },
  preferredReference: GoogleNearbyReference | null = null,
): Promise<PickerResult[]> {
  const preferredKey = preferredReference
    ? String(
        preferredReference.placeId ??
          normalizePlaceStreetCompare(preferredReference.name),
      )
    : "automatic";
  const key = `${createPickupCacheKey(point)}:${preferredKey}`;
  const cached = GOOGLE_PICKUP_CACHE.get(key);

  if (cached) return cached;

  const pending: Promise<PickerResult[]> = computeGooglePickupCandidates(
    point,
    preferredReference,
  ).catch(async (): Promise<PickerResult[]> => {
    const fallback = await reverseGeocode(point);

    if (!fallback.isAccessiblePickup) return [];

    return [
      {
        ...fallback,
        walkMinutes: Math.max(
          1,
          Math.ceil(Number(fallback.walkMeters ?? 0) / 75),
        ),
        streetName:
          fallback.streetName ??
          fallback.text.replace(/^Recogida en\s+/i, "").split(",")[0],
        candidateId: `fallback:${point.lat.toFixed(5)}:${point.lng.toFixed(5)}`,
        recommendationKind: "road",
        isRecommended: true,
        recommendationReason: "Se usa la vía accesible más cercana disponible.",
        roadProbeHits: 1,
      },
    ];
  });

  GOOGLE_PICKUP_CACHE.set(key, pending);

  if (GOOGLE_PICKUP_CACHE.size > MAX_GOOGLE_PICKUP_CACHE_ENTRIES) {
    const firstKey = GOOGLE_PICKUP_CACHE.keys().next().value as
      | string
      | undefined;

    if (firstKey) GOOGLE_PICKUP_CACHE.delete(firstKey);
  }

  return pending;
}

function SuggestionList({
  suggestions,
  onPick,
}: {
  suggestions: GoogleSuggestion[];
  onPick: (suggestion: GoogleSuggestion) => void;
}): JSX.Element | null {
  if (suggestions.length === 0) return null;

  return (
    <div style={suggestionBoxStyle()}>
      {suggestions.map((suggestion, index) => (
        <button
          key={suggestion.placeId}
          type="button"
          className="rapago-suggestion-item"
          onClick={() => onPick(suggestion)}
          style={{
            width: "100%",
            border: 0,
            borderBottom:
              index < suggestions.length - 1
                ? "1px solid var(--rp-divider)"
                : 0,
            background: "transparent",
            color: "var(--rp-text)",
            padding: "12px 14px",
            textAlign: "left",
            cursor: "pointer",
          }}>
          <div
            style={{
              fontWeight: 800,
              fontSize: ".84rem",
              lineHeight: 1.25,
              color: "var(--rp-text)",
            }}>
            {suggestion.mainText}
          </div>
          <div
            style={{
              marginTop: "3px",
              color: "var(--rp-muted)",
              fontSize: ".72rem",
              fontWeight: 650,
              lineHeight: 1.25,
            }}>
            {suggestion.secondaryText}
          </div>
        </button>
      ))}
    </div>
  );
}

function getBlueMarkerVisualAnchor(
  pointsOverlap: boolean,
): google.maps.Point | undefined {
  if (!pointsOverlap || !window.google?.maps) return undefined;

  // Mantiene las coordenadas reales intactas, pero desplaza solo el dibujo
  // del marcador azul unos píxeles. Así el verde sigue visible y el usuario
  // puede volver a arrastrar el azul aunque ambos puntos estén a pocos metros.
  return new google.maps.Point(1.9, 0);
}

/* Reparto de alto entre mapa y hoja, en % del contenedor, expresado como cuánto
   se lleva el MAPA. El panel es de colocación LIBRE: se queda exactamente donde
   se suelte, sin posiciones de encaje. Las hubo —tres reposos con salto por
   impulso— y eran la causa de que el panel "no obedeciera": el usuario lo
   dejaba a su gusto y medio segundo después se recolocaba solo en el reposo más
   cercano, deshaciéndole el gesto. Un control cuyo resultado no coincide con
   donde lo dejaste se siente roto, por bien calibrado que esté el salto.

   Los valores de referencia NO son porcentajes fijos. El contenido de la hoja mide
   siempre lo mismo en píxeles —la tarjeta de dirección, la de caminata y el
   botón no encogen con la pantalla—, así que un reparto fijo da resultados
   distintos en cada aparato: un 50% son 390px de hoja en un teléfono alto,
   donde sobra sitio, y 252px en uno bajo, donde el mismo contenido no entra.
   El porcentaje escala a ciegas; lo que hay que repartir es el alto REAL. */

/* Alto de la hoja en reposo. Con este valor el panel queda a media pantalla:
   se leen la dirección y la caminata, y el mapa se lleva algo más de la mitad,
   que es el reparto de referencia pedido. */
const SHEET_CONTENT_PX = 295;

/* Márgenes del reparto calculado. Por debajo del mínimo el mapa deja de servir
   para reconocer dónde cae el punto; por encima del máximo la hoja no da ni
   para la dirección. Entre ambos manda el contenido. */
const MAP_SHARE_FIT_MIN = 30;
const MAP_SHARE_FIT_MAX = 66;

/* Solo se usa antes de la primera medición, mientras no se sabe el alto real. */
const MAP_SHARE_DEFAULT = 50;

/* Extremos del recorrido. El máximo deja la hoja reducida a su cabecera —barra
   y título, sin ninguna tarjeta—, que es hasta donde puede crecer el mapa sin
   que quede un panel sin nada dentro.

   No hace falta que sea exacto: quien manda de verdad es el suelo en CSS
   (request-ride.css, `.rp-request-map-sheet`), que varía con el área segura de
   cada aparato vía `env(safe-area-inset-bottom)` — algo que un solo número de
   JS no puede replicar, porque ese margen cambia de un iPhone con muesca a uno
   sin ella. Aquí basta con un techo GENEROSO: en aparatos con poca área segura
   el suelo real de CSS permite más que este valor y manda él; en los que
   necesitan más margen abajo, el mismo suelo se ocupa de frenar antes. El mapa
   cede sin pelear porque es `flex: 0 1`. */
/* ── Bottom sheet arrastrable de "Solicitar viaje" ──────────────────────────
   La hoja es un OVERLAY absoluto sobre el mapa (no reparte alto con él): el
   mapa queda quieto detrás y la hoja se sube o baja con `transform:
   translateY(px)`, siguiendo al dedo 1:1. El recorrido va de 0 (hoja arriba,
   tapa casi todo el mapa) a `maxShift` (hoja abajo, solo asa + AHORA/RESERVAR).
   `maxShift` se MIDE del DOM en vivo, así que no hay número mágico de alto. */
/* Fracción del recorrido a la que abre la hoja: ni tapando el mapa ni pegada
   abajo. Es solo la posición inicial; a partir de ahí manda el dedo. */
const REQUEST_SHEET_REST_FRACTION = 0.5;
/* Franja mínima visible con la hoja abajo del todo (asa + selector). Se usa
   solo como respaldo mientras el navegador aún no ha medido la cabecera real. */
const REQUEST_SHEET_HANDLE_FALLBACK = 116;
/* Paso del teclado (px por flecha): equivalente accesible del arrastre. */
const REQUEST_SHEET_KEY_STEP = 40;

const MAP_SHARE_MIN = 22;
const MAP_SHARE_MAX = 90;

/* Margen para distinguir un toque de un arrastre. 10px y no 4: un dedo real se
   desplaza varios píxeles mientras toca, y con el listón tan bajo el toque se
   leía como arrastre — el interruptor no llegaba a dispararse nunca y pulsar la
   barra parecía no hacer nada. Es el margen que usan iOS y Android. */
const TAP_SLOP_PX = 10;

/* Reparto de reposo para un alto disponible concreto: a la hoja se le da lo que
   su contenido pide y el mapa se queda con el resto, acotado. En una pantalla
   alta sobra sitio y el mapa crece; en una baja el mapa cede para que la
   información siga entrando. Es lo que hace que el equilibrio se sienta igual
   en cualquier dispositivo en vez de escalar a ciegas. */
function fitMapShare(shellHeight: number): number {
  if (shellHeight <= 0) return MAP_SHARE_DEFAULT;

  const sheetShare = (SHEET_CONTENT_PX / shellHeight) * 100;

  return Math.min(
    MAP_SHARE_FIT_MAX,
    Math.max(MAP_SHARE_FIT_MIN, 100 - sheetShare),
  );
}

/* Tope superior del panel (= mínimo del mapa) para un alto dado: un poco más de
   hoja que el reposo. El contenido ya se enseña entero en el reposo, así que
   subir más allá de este margen solo añadiría panel vacío. Cuelga del reparto
   ajustado, no de un número absoluto, para significar lo mismo en cualquier
   pantalla. */
function minMapShare(shellHeight: number): number {
  return Math.max(MAP_SHARE_MIN, fitMapShare(shellHeight) - 18);
}

/* Resistencia elástica fuera del recorrido útil. Un tope seco se siente como
   que algo se rompió; que el panel ceda cada vez menos y vuelva solo al soltar
   se siente deliberado.

   Los límites se pasan explícitos y no se sacan de las posiciones de reposo: el
   recorrido real llega desde la posición más abierta hasta la hoja CERRADA, que
   no es un reposo pero sí un extremo legítimo. Tomando el último reposo como
   techo, tirar de una hoja cerrada la hacía saltar hacia arriba en el primer
   píxel del gesto, porque ya arrancaba fuera de la banda. */
function rubberBandShare(value: number, min: number, max: number): number {
  if (value < min) return min - (min - value) * 0.35;
  if (value > max) return max + (value - max) * 0.35;

  return value;
}

function MapPointPicker({
  isOpen,
  title,
  mode,
  initialPoint,
  autoFocusSearch = false,
  onCancel,
  onConfirm,
}: {
  isOpen: boolean;
  title: string;
  mode: PickerTarget;
  initialPoint?: Coords | null;
  autoFocusSearch?: boolean;
  onCancel: () => void;
  onConfirm: (point: PickerResult) => void;
}): JSX.Element {
  const { theme: pickerTheme } = useRapagoSectionTheme("request-ride");
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const geocodeTimerRef = useRef<number | null>(null);
  const requestSequenceRef = useRef(0);
  const pickerSearchSequenceRef = useRef(0);
  /* El listener de iconos de Google se registra al crear el mapa, así que lee
     el manejador desde un ref para no trabajar con estado viejo. */
  const pickPlaceIdRef = useRef<(placeId: string) => void>(() => {});
  const lastResolvedCenterRef = useRef<{ lat: number; lng: number } | null>(
    null,
  );
  const realPointMarkerRef = useRef<google.maps.Marker | null>(null);
  const pickupPointMarkerRef = useRef<google.maps.Marker | null>(null);
  const candidateMarkersRef = useRef<google.maps.Marker[]>([]);
  const realPointCircleRef = useRef<google.maps.Circle | null>(null);
  const walkingDotsRef = useRef<google.maps.Polyline | null>(null);
  const walkingDotsShadowRef = useRef<google.maps.Polyline | null>(null);
  const mapResizeObserverRef = useRef<ResizeObserver | null>(null);
  const searchInputRef = useRef<HTMLIonInputElement | null>(null);

  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<PickerResult | null>(null);
  const [pickupCandidates, setPickupCandidates] = useState<PickerResult[]>([]);
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [pickerSuggestions, setPickerSuggestions] = useState<
    GoogleSuggestion[]
  >([]);
  const [searchingPicker, setSearchingPicker] = useState(false);
  const [scopeMessage, setScopeMessage] = useState<string | null>(null);
  const [modalReady, setModalReady] = useState(false);
  /* Fallo al cargar Google Maps. Se mantiene APARTE de `selected`: un error no
     es un lugar válido, así que el botón de confirmar debe seguir inhabilitado. */
  const [mapError, setMapError] = useState<string | null>(null);

  /* Panel arrastrable. El reparto mapa/hoja es estado, no un número fijo en
     CSS, porque ahora lo decide el usuario: hay quien quiere ver bien el mapa
     antes de confirmar y quien quiere leer la dirección entera. */
  const [mapShare, setMapShare] = useState<number>(MAP_SHARE_MAX);
  const [draggingSheet, setDraggingSheet] = useState(false);
  const shellRef = useRef<HTMLDivElement | null>(null);

  /* Alto realmente disponible. No se sabe hasta que el modal está montado, y
     cambia al girar el aparato o cuando la barra del navegador se encoge, así
     que se mide en vivo en lugar de suponerlo. */
  const [shellHeight, setShellHeight] = useState(0);
  const minShare = useMemo(() => minMapShare(shellHeight), [shellHeight]);

  /* Tope inferior REAL del panel, leído del CSS en vez de supuesto.

     Antes esto era la constante MAP_SHARE_MAX y no cuadraba con la realidad:
     quien frena el panel es su `min-height`, que se compone con
     `env(safe-area-inset-bottom)` y por tanto vale distinto en cada aparato.
     Al pedir el JS más de lo que el CSS concede quedaba una zona muerta al
     final del recorrido —entre 2% y 5% según el teléfono— donde el dedo seguía
     bajando y el panel ya no se movía. Se siente exactamente como "no baja
     más", que es lo que se estaba reportando: el gesto corría en vacío justo
     donde uno empuja para llegar al fondo.

     Midiéndolo, el arrastre termina justo donde el panel deja de moverse. */
  const [maxShare, setMaxShare] = useState(MAP_SHARE_MAX);
  const sheetRef = useRef<HTMLDivElement | null>(null);

  /* NO hay un estado "cerrado" aparte, y es a propósito. Lo hubo: desvanecía el
     contenido con `opacity` pero seguía reservándole su espacio, así que el
     panel se quedaba como una caja negra vacía con el título encima. Ese hueco
     era precisamente el que debía ser mapa.

     Ahora hay una sola magnitud —cuánto se lleva el mapa— y la hoja es siempre
     el resto. Al encogerla, el contenido se recorta solo porque su caja mengua;
     no hay nada que ocultar por separado y por tanto no puede quedar espacio
     reservado y vacío. Subir la barra encoge el mapa y bajarla lo agranda, de
     forma continua. */

  /* En cuanto el usuario coloca el panel a mano, manda él: recolocárselo por
     debajo al recalcular sería deshacerle el gesto. */
  const sheetAdjustedByUserRef = useRef(false);
  /* Última posición abierta conocida. El toque que reabre vuelve aquí: a donde
     el usuario lo tenía, no a un sitio decidido por la app. */
  const lastOpenShareRef = useRef<number | null>(null);
  const sheetDragRef = useRef<{
    startY: number;
    startShare: number;
    shellHeight: number;
    /* Última posición aplicada. Se guarda aquí y no se lee del estado porque al
       soltar hay que decidir con el valor real del gesto, y el de React podría
       ir un render por detrás. */
    share: number;
  } | null>(null);
  /* Espejo de `draggingSheet` en ref: el ResizeObserver del mapa se crea una
     sola vez y no vería los cambios de estado, pero necesita saber si hay un
     arrastre en curso. */
  const draggingSheetRef = useRef(false);
  /* Distingue un arrastre de una pulsación: en táctil, al soltar tras arrastrar
     también llega un `click`, y sin esto el panel saltaría de posición justo
     después de que el usuario acabara de colocarlo a mano. */
  const sheetDraggedRef = useRef(false);
  /* Marca que el toque ya se atendió en `pointerup`, para que el `click` que
     llega después no lo repita y deje el panel como estaba. */
  const tapHandledRef = useRef(false);

  /* Mide el hueco disponible y lo mantiene al día. El ResizeObserver cubre el
     giro de pantalla y el encogido de la barra del navegador, que en iOS pasa
     constantemente al desplazarse. */
  useEffect(() => {
    const shell = shellRef.current;

    if (!isOpen || !shell || typeof ResizeObserver === "undefined") return;

    const measure = (): void => {
      const height = shell.getBoundingClientRect().height;
      setShellHeight(height);

      const sheet = sheetRef.current;
      if (!sheet || height <= 0) return;

      /* `min-height` resuelto por el navegador: ya trae aplicados el `min()`,
         el `calc()` y el área segura concreta de este aparato. */
      const floorPx = parseFloat(window.getComputedStyle(sheet).minHeight);
      if (!Number.isFinite(floorPx) || floorPx <= 0) return;

      setMaxShare(Math.min(95, Math.max(50, 100 - (floorPx / height) * 100)));
    };

    const observer = new ResizeObserver(measure);
    observer.observe(shell);
    measure();

    return () => observer.disconnect();
  }, [isOpen, modalReady]);

  /* La hoja comienza guardada abajo para que el pasajero pueda usar el mapa y
     la búsqueda sin que las tarjetas tapen la pantalla. Conservamos una
     posición abierta cómoda para recuperarla al tocar o deslizar el tirador. */
  useEffect(() => {
    if (sheetAdjustedByUserRef.current || shellHeight <= 0) return;

    lastOpenShareRef.current = fitMapShare(shellHeight);
    setMapShare(maxShare);
  }, [shellHeight, maxShare]);

  function handleGripPointerDown(event: ReactPointerEvent<HTMLElement>): void {
    const shellHeight = shellRef.current?.getBoundingClientRect().height ?? 0;
    if (shellHeight <= 0) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    sheetDragRef.current = {
      startY: event.clientY,
      startShare: mapShare,
      shellHeight,
      share: mapShare,
    };
    sheetDraggedRef.current = false;
    draggingSheetRef.current = true;
    setDraggingSheet(true);
  }

  function handleGripPointerMove(event: ReactPointerEvent<HTMLElement>): void {
    const drag = sheetDragRef.current;
    if (!drag) return;

    const deltaPx = event.clientY - drag.startY;

    if (Math.abs(deltaPx) > TAP_SLOP_PX) sheetDraggedRef.current = true;

    /* clientY crece hacia abajo, así que arrastrar hacia abajo encoge la hoja y
       agranda el mapa: el delta se suma tal cual a la parte del mapa. */
    const raw = drag.startShare + (deltaPx / drag.shellHeight) * 100;

    /* Entre los dos extremos el panel sigue al dedo sin resistencia; fuera cede
       cada vez menos. El tope duro deja un margen para que se note la
       elasticidad antes de frenar del todo. */
    const next = Math.min(
      maxShare + 5,
      Math.max(MAP_SHARE_MIN, rubberBandShare(raw, minShare, maxShare)),
    );

    drag.share = next;
    setMapShare(next);
  }

  function handleGripPointerUp(event: ReactPointerEvent<HTMLElement>): void {
    const drag = sheetDragRef.current;
    if (!drag) return;

    const { share } = drag;

    sheetDragRef.current = null;
    draggingSheetRef.current = false;
    sheetAdjustedByUserRef.current = true;
    setDraggingSheet(false);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    /* El dedo no llegó a arrastrar: es un toque, y se resuelve AQUÍ.

       Antes esto vivía en el `onClick`, y era un error: con `setPointerCapture`
       activo el navegador redirige los eventos al elemento que captura, y el
       `click` posterior no llega de forma fiable en todos los motores. El
       interruptor dependía de un evento que a veces no existía. `pointerup`
       siempre llega. */
    if (!sheetDraggedRef.current) {
      tapHandledRef.current = true;
      toggleSheet();
      return;
    }

    /* SIN encaje: el panel se queda EXACTAMENTE donde se soltó. Lo único que
       ocurre al soltar es deshacer el estiramiento elástico si el gesto terminó
       fuera del recorrido. Colocarlo es del usuario; recolocarlo no es nuestro. */
    const resolved = Math.min(maxShare, Math.max(minShare, share));

    /* Si quedó abierta, esta pasa a ser la posición a la que volverá el toque
       que reabra: se respeta dónde la dejó el usuario, venga de donde venga. */
    if (resolved < maxShare - 4) lastOpenShareRef.current = resolved;

    setMapShare(resolved);
  }

  /* Pulsar la barra es un INTERRUPTOR: un toque pliega el panel hasta dejar
     solo la barra y el título —mapa entero a la vista— y el siguiente lo
     reabre.

     Hubo un intento anterior de esto que confundía, y conviene recordar por
     qué antes de "mejorarlo": aquel cierre ocultaba el contenido con `opacity`
     pero le reservaba el sitio, así que quedaba una caja negra vacía y parecía
     que la información se había perdido. Ahora cerrar es solo llevar el
     reparto a su extremo: el panel se pliega de verdad (el suelo en CSS lo
     detiene justo en la cabecera), la barra y el título quedan siempre a la
     vista como asa para volver, y el movimiento es una animación continua que
     enseña adónde se fue.

     La reapertura vuelve a la última posición abierta, no a una fija: si el
     usuario había colocado el panel a su gusto, eso es suyo. Sin posición
     previa, vuelve al reparto ajustado a la pantalla. */
  function toggleSheet(): void {
    sheetAdjustedByUserRef.current = true;

    const closed = mapShare >= maxShare - 4;

    if (closed) {
      setMapShare(lastOpenShareRef.current ?? fitMapShare(shellHeight));
      return;
    }

    lastOpenShareRef.current = mapShare;
    setMapShare(maxShare);
  }

  /* Solo cubre el `click` que NO viene del dedo: Enter o Espacio sobre el botón
     con el foco puesto. El táctil ya se atendió en `pointerup`. */
  function handleGripClick(): void {
    if (tapHandledRef.current) {
      tapHandledRef.current = false;
      return;
    }

    if (sheetDraggedRef.current) return;

    toggleSheet();
  }

  function handleGripKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ): void {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;

    event.preventDefault();
    sheetAdjustedByUserRef.current = true;

    /* Pasos fijos, espejo del arrastre libre: sin posiciones privilegiadas,
       solo un recorrido acotado. Arriba agranda la hoja (menos mapa); abajo,
       al revés. */
    const delta = event.key === "ArrowUp" ? -8 : 8;

    setMapShare((current) =>
      Math.min(maxShare, Math.max(minShare, current + delta)),
    );
  }

  function openSheetDetails(): void {
    sheetAdjustedByUserRef.current = true;
    const next = Math.min(
      maxShare,
      Math.max(minShare, lastOpenShareRef.current ?? fitMapShare(shellHeight)),
    );
    lastOpenShareRef.current = next;
    setMapShare(next);
  }

  function closeSheetForSearch(): void {
    sheetAdjustedByUserRef.current = true;
    if (mapShare < maxShare - 4) {
      lastOpenShareRef.current = mapShare;
    }
    setMapShare(maxShare);
  }

  function clearMapPreview(): void {
    realPointMarkerRef.current?.setMap(null);
    pickupPointMarkerRef.current?.setMap(null);
    candidateMarkersRef.current.forEach((marker) => marker.setMap(null));
    candidateMarkersRef.current = [];
    realPointCircleRef.current?.setMap(null);
    walkingDotsRef.current?.setMap(null);
    walkingDotsShadowRef.current?.setMap(null);
  }

  function selectPickupCandidate(candidate: PickerResult): void {
    setSelected(candidate);
    drawAccessiblePickupPreview(candidate, pickupCandidates);
  }

  function drawAccessiblePickupPreview(
    point: PickerResult | null,
    candidates: PickerResult[] = pickupCandidates,
  ): void {
    const map = mapRef.current;

    if (!map || !window.google?.maps) return;

    clearMapPreview();

    if (!point) return;

    const realPoint = {
      lat: point.originalLat ?? point.lat,
      lng: point.originalLng ?? point.lng,
    };

    const pickupPoint = {
      lat: point.lat,
      lng: point.lng,
    };

    const pickupDistanceFromUser = distanceMeters(realPoint, pickupPoint);
    const pointsOverlap = mode === "origin" && pickupDistanceFromUser <= 18;

    if (mode === "destination") {
      realPointCircleRef.current = new google.maps.Circle({
        map,
        center: pickupPoint,
        radius: 36,
        fillColor: "#ef4444",
        fillOpacity: 0.18,
        strokeColor: "#ef4444",
        strokeOpacity: 0,
        strokeWeight: 0,
        zIndex: 10,
      });

      realPointMarkerRef.current = new google.maps.Marker({
        map,
        position: pickupPoint,
        title: "Mantén presionado y mueve el destino",
        draggable: true,
        cursor: "grab",
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 20,
          fillColor: "#ef4444",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 5,
        },
        label: {
          text: "•",
          color: "#ffffff",
          fontSize: "22px",
          fontWeight: "900",
        },
        zIndex: 60,
      });

      realPointMarkerRef.current.addListener("dragstart", () => {
        map.setOptions({ draggableCursor: "grabbing" });
      });

      realPointMarkerRef.current.addListener("drag", () => {
        const position = realPointMarkerRef.current?.getPosition();
        if (!position) return;

        realPointCircleRef.current?.setCenter({
          lat: position.lat(),
          lng: position.lng(),
        });
      });

      realPointMarkerRef.current.addListener("dragend", () => {
        const position = realPointMarkerRef.current?.getPosition();
        map.setOptions({ draggableCursor: undefined });

        if (!position) return;

        void resolveDestinationPoint({
          lat: position.lat(),
          lng: position.lng(),
        });
      });

      return;
    }

    realPointCircleRef.current = new google.maps.Circle({
      map,
      center: realPoint,
      radius: 44,
      fillColor: "#2563eb",
      fillOpacity: 0.2,
      strokeColor: "#2563eb",
      strokeOpacity: 0,
      strokeWeight: 0,
      zIndex: 10,
    });

    realPointMarkerRef.current = new google.maps.Marker({
      map,
      position: realPoint,
      title: "Mantén presionado y mueve tu ubicación",
      draggable: true,
      clickable: true,
      optimized: false,
      cursor: "grab",
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 14,
        fillColor: "#2563eb",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 4,
        anchor: getBlueMarkerVisualAnchor(pointsOverlap),
      },
      // Debe quedar por encima del verde para recibir siempre el gesto.
      zIndex: 90,
    });

    realPointMarkerRef.current.addListener("dragstart", () => {
      map.setOptions({ draggableCursor: "grabbing" });
    });

    realPointMarkerRef.current.addListener("drag", () => {
      const position = realPointMarkerRef.current?.getPosition();
      if (!position) return;

      const movedPoint = {
        lat: position.lat(),
        lng: position.lng(),
      };

      realPointCircleRef.current?.setCenter(movedPoint);

      walkingDotsRef.current?.setPath([movedPoint, pickupPoint]);
      walkingDotsShadowRef.current?.setPath([movedPoint, pickupPoint]);
    });

    realPointMarkerRef.current.addListener("dragend", () => {
      const position = realPointMarkerRef.current?.getPosition();
      map.setOptions({ draggableCursor: undefined });

      if (!position) return;

      const movedPoint = {
        lat: position.lat(),
        lng: position.lng(),
      };

      map.setCenter(movedPoint);
      lastResolvedCenterRef.current = null;
      void resolveMapPoint(movedPoint, true);
    });

    for (const [candidateIndex, candidate] of candidates.entries()) {
      if (
        candidate.candidateId === point.candidateId ||
        (Math.abs(candidate.lat - point.lat) < 0.000001 &&
          Math.abs(candidate.lng - point.lng) < 0.000001)
      ) {
        continue;
      }

      const marker = new google.maps.Marker({
        map,
        position: {
          lat: candidate.lat,
          lng: candidate.lng,
        },
        title: `${candidateIndex + 1}. ${candidate.text.replace(
          /^Recogida en\s+/i,
          "",
        )} · ${Math.round(Number(candidate.walkMeters ?? 0))} m`,
        cursor: "pointer",
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: "#ffffff",
          fillOpacity: 1,
          strokeColor: "#22c55e",
          strokeWeight: 4,
        },
        label: {
          text: String(candidateIndex + 1),
          color: "#15803d",
          fontSize: "11px",
          fontWeight: "900",
        },
        zIndex: 25,
      });

      marker.addListener("click", () => {
        setSelected(candidate);
        drawAccessiblePickupPreview(candidate, candidates);
        openSheetDetails();
      });

      candidateMarkersRef.current.push(marker);
    }

    pickupPointMarkerRef.current = new google.maps.Marker({
      map,
      position: pickupPoint,
      clickable: false,
      optimized: false,
      title: point.referenceName
        ? `Recogida en ${point.referenceName}`
        : "Punto accesible recomendado",
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 18,
        fillColor: "#22c55e",
        fillOpacity: 1,
        strokeColor: "#0b3d16",
        strokeWeight: 5,
      },
      label: {
        text: "✓",
        color: "#ffffff",
        fontSize: "14px",
        fontWeight: "900",
      },
      zIndex: 55,
    });

    if ((point.walkMeters ?? 0) > 8) {
      walkingDotsShadowRef.current = new google.maps.Polyline({
        map,
        path: [realPoint, pickupPoint],
        strokeOpacity: 0,
        zIndex: 20,
        icons: [
          {
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              fillColor: "#111111",
              fillOpacity: 0.72,
              strokeColor: "#111111",
              strokeOpacity: 0.72,
              scale: 6,
            },
            offset: "0",
            repeat: "18px",
          },
        ],
      });

      walkingDotsRef.current = new google.maps.Polyline({
        map,
        path: [realPoint, pickupPoint],
        strokeOpacity: 0,
        zIndex: 21,
        icons: [
          {
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              fillColor: "#ffffff",
              fillOpacity: 1,
              strokeColor: "#ffffff",
              strokeOpacity: 1,
              scale: 3.8,
            },
            offset: "0",
            repeat: "18px",
          },
        ],
      });
    }
  }

  async function resolveOriginPoint(
    point: {
      lat: number;
      lng: number;
    },
    preferredReference: GoogleNearbyReference | null = null,
  ): Promise<void> {
    if (!isPointInsideRapaNuiServiceArea(point)) {
      setScopeMessage(
        "Ese punto está fuera de Rapa Nui. Mueve el punto azul dentro de la isla.",
      );
      return;
    }

    const sequence = ++requestSequenceRef.current;
    setScopeMessage(null);
    setLoadingAddress(true);

    try {
      const candidates = await getGooglePickupCandidates(
        point,
        preferredReference,
      );

      if (sequence !== requestSequenceRef.current) return;

      const next =
        candidates.find(
          (candidate) =>
            candidate.recommendationKind === "reference" &&
            candidate.isRecommended,
        ) ??
        candidates.find(
          (candidate) => candidate.recommendationKind === "reference",
        ) ??
        candidates[0] ??
        null;
      setPickupCandidates(candidates);
      setSelected(next);
      drawAccessiblePickupPreview(next, candidates);

      if (!next) {
        setScopeMessage(
          "No encontramos una vía donde pueda llegar el vehículo. Mueve el punto azul hacia una calle dentro de Rapa Nui.",
        );
      }
    } finally {
      if (sequence === requestSequenceRef.current) {
        setLoadingAddress(false);
      }
    }
  }

  async function resolveDestinationPoint(point: {
    lat: number;
    lng: number;
  }): Promise<void> {
    if (!isPointInsideRapaNuiServiceArea(point)) {
      setScopeMessage(
        "Ese destino está fuera de Rapa Nui. Solo puedes elegir lugares dentro de la isla.",
      );
      return;
    }

    const sequence = ++requestSequenceRef.current;
    setScopeMessage(null);
    setLoadingAddress(true);

    try {
      const result = await reverseGeocodeExact(point);

      if (sequence !== requestSequenceRef.current) return;

      setPickupCandidates([]);
      setSelected(result);
      drawAccessiblePickupPreview(result, []);
    } finally {
      if (sequence === requestSequenceRef.current) {
        setLoadingAddress(false);
      }
    }
  }

  function resolveMapPoint(
    point: {
      lat: number;
      lng: number;
    },
    force = false,
  ): Promise<void> {
    const previous = lastResolvedCenterRef.current;

    if (!force && previous && distanceMeters(previous, point) < 18) {
      return Promise.resolve();
    }

    lastResolvedCenterRef.current = point;

    return mode === "origin"
      ? resolveOriginPoint(point)
      : resolveDestinationPoint(point);
  }

  useEffect(() => {
    if (!isOpen) {
      setModalReady(false);
      clearMapPreview();
      lastResolvedCenterRef.current = null;
      mapResizeObserverRef.current?.disconnect();
      mapResizeObserverRef.current = null;
      mapRef.current = null;
      return;
    }

    sheetAdjustedByUserRef.current = false;
    lastOpenShareRef.current = null;
    setMapShare(MAP_SHARE_MAX);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !modalReady) return;

    setReady(false);
    setSelected(null);
    setPickupCandidates([]);
    setSearchText("");
    setPickerSuggestions([]);
    setSearchingPicker(false);
    setScopeMessage(null);
    setMapError(null);

    let cancelled = false;

    void loadRapaGoGoogleMaps()
      .then(async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 200));

        if (cancelled || !mapElementRef.current || !window.google?.maps) {
          return;
        }

        const initialPointIsInside = Boolean(
          initialPoint && isPointInsideRapaNuiServiceArea(initialPoint),
        );
        const center = initialPointIsInside
          ? (initialPoint as Coords)
          : RAPA_NUI_CENTER;

        if (initialPoint && !initialPointIsInside) {
          setScopeMessage(
            "Tu GPS está fuera de Rapa Nui. El mapa se mantuvo dentro de la isla para que elijas el punto correcto.",
          );
        }

        const map = new google.maps.Map(mapElementRef.current, {
          center,
          /* 15 y no 17: a 17 se ven un par de calles y en Rapa Nui, con los
             caminos separados, la pantalla queda casi vacía y sin referencias
             para ubicarse. A 15 entra el barrio y se entiende dónde estás
             respecto del pueblo, que es lo que hace falta para elegir el punto
             de partida. Acercarse es un gesto; alejarse cuando ya te perdiste
             de contexto, no tanto. */
          zoom: 15,
          mapTypeControl: false,
          fullscreenControl: false,
          streetViewControl: false,
          clickableIcons: true,
          gestureHandling: "greedy",
          disableDefaultUI: true,
          zoomControl: false,
          minZoom: 11,
          restriction: {
            latLngBounds: getRapaNuiMapBounds(),
            strictBounds: true,
          },
          mapTypeId: google.maps.MapTypeId.ROADMAP,
        });

        /* Icono propio de Google tocado (restaurante, hotel, moái…). Google
           abriría su globo con el enlace a Google Maps, que saca al pasajero
           de la app en mitad de la elección: `event.stop()` lo cancela y el
           lugar se toma como el punto que se está eligiendo —origen o
           destino según el modo del selector. */
        map.addListener("click", (event: google.maps.MapMouseEvent) => {
          const placeId = (event as google.maps.IconMouseEvent).placeId;
          if (!placeId) return;

          event.stop();
          pickPlaceIdRef.current(placeId);
        });

        mapRef.current = map;

        if (typeof ResizeObserver !== "undefined" && mapElementRef.current) {
          const observer = new ResizeObserver(() => {
            if (cancelled || draggingSheetRef.current) return;

            const currentCenter = map.getCenter();
            google.maps.event.trigger(map, "resize");
            if (currentCenter) map.setCenter(currentCenter);
          });

          observer.observe(mapElementRef.current);
          mapResizeObserverRef.current = observer;
        }

        window.setTimeout(() => {
          if (cancelled) return;
          google.maps.event.trigger(map, "resize");
          map.setCenter(center);
          // Debe coincidir con el zoom inicial de arriba: este reajuste tras el
          // resize lo reimponía en 17 y deshacía el valor de apertura.
          map.setZoom(15);
          setReady(true);
        }, 120);

        await resolveMapPoint(
          {
            lat: center.lat,
            lng: center.lng,
          },
          true,
        );

        if (initialPoint && !initialPointIsInside) {
          setScopeMessage(
            "Tu GPS está fuera de Rapa Nui. Elige manualmente un punto dentro de la isla.",
          );
        }

        // El mapa se puede explorar libremente, pero el punto del pasajero
        // solo cambia al arrastrar el círculo azul, usar GPS o elegir una
        // búsqueda. Así el usuario no pierde su ubicación por mover el mapa.
      })
      .catch(() => {
        setReady(true);
        setSelected(null);
        setPickupCandidates([]);
        setMapError(
          "No se pudo cargar el mapa. Revisa tu conexión e inténtalo de nuevo.",
        );
      });

    return () => {
      cancelled = true;
      requestSequenceRef.current += 1;

      if (geocodeTimerRef.current) {
        window.clearTimeout(geocodeTimerRef.current);
      }

      clearMapPreview();
      mapResizeObserverRef.current?.disconnect();
      mapResizeObserverRef.current = null;
      mapRef.current = null;
    };
  }, [
    isOpen,
    modalReady,
    mode,
    initialPoint?.lat,
    initialPoint?.lng,
    initialPoint?.placeId,
  ]);

  useEffect(() => {
    const value = searchText.trim();
    const sequence = ++pickerSearchSequenceRef.current;

    if (!isOpen || normalizeRapaNuiAutocompleteText(value).length < 2) {
      setPickerSuggestions([]);
      setSearchingPicker(false);
      if (value.length === 0) setScopeMessage(null);
      return;
    }

    setSearchingPicker(true);
    setScopeMessage(null);

    const timeout = window.setTimeout(() => {
      void getGooglePredictions(value)
        .then((suggestions) => {
          if (sequence !== pickerSearchSequenceRef.current) return;

          setPickerSuggestions(suggestions);
          setScopeMessage(
            suggestions.length === 0
              ? "No encontramos ese lugar dentro de Rapa Nui. Prueba con otro nombre o mueve el punto azul."
              : null,
          );
        })
        .finally(() => {
          if (sequence === pickerSearchSequenceRef.current) {
            setSearchingPicker(false);
          }
        });
    }, 240);

    return () => window.clearTimeout(timeout);
  }, [isOpen, searchText]);

  async function pickSuggestion(suggestion: GoogleSuggestion): Promise<void> {
    await pickPlaceId(suggestion.placeId);
  }

  pickPlaceIdRef.current = (placeId: string): void => {
    void pickPlaceId(placeId);
  };

  /* Un lugar de Google elegido dentro del selector, venga del buscador o de un
     icono tocado sobre el mapa: en ambos casos lo único que hay es un
     place_id, así que comparten el mismo camino. */
  async function pickPlaceId(placeId: string): Promise<void> {
    setLoadingAddress(true);

    try {
      const exact = await getPlaceDetailsExact(placeId);
      if (!exact || !mapRef.current) {
        setPickerSuggestions([]);
        setScopeMessage(
          "Ese resultado no pertenece a Rapa Nui y fue bloqueado.",
        );
        return;
      }

      setScopeMessage(null);
      setSearchText(exact.text);
      setPickerSuggestions([]);
      mapRef.current.setCenter({
        lat: exact.lat,
        lng: exact.lng,
      });
      mapRef.current.setZoom(18);

      const exactPoint = {
        lat: exact.lat,
        lng: exact.lng,
      };

      if (mode === "origin") {
        const preferredReference = createPreferredReferenceFromExactPlace(
          exact,
          exactPoint,
        );

        await resolveOriginPoint(exactPoint, preferredReference);
      } else {
        await resolveMapPoint(exactPoint, true);
      }

      openSheetDetails();
    } finally {
      setLoadingAddress(false);
    }
  }

  async function pickFrequentDestination(
    destination: (typeof TOURIST_DESTINATION_SUGGESTIONS)[number],
  ): Promise<void> {
    const map = mapRef.current;
    if (!map) return;

    const sequence = ++requestSequenceRef.current;
    setLoadingAddress(true);
    setSearchText(destination.name);
    setPickerSuggestions([]);

    try {
      const predictions = await getGooglePredictions(destination.search);

      if (sequence !== requestSequenceRef.current) return;

      const targetKey = normalizePlaceStreetCompare(destination.name);
      const preferred =
        predictions.find((prediction) => {
          const predictionKey = normalizePlaceStreetCompare(
            prediction.mainText,
          );

          return (
            predictionKey === targetKey ||
            predictionKey.includes(targetKey) ||
            targetKey.includes(predictionKey)
          );
        }) ??
        predictions[0] ??
        null;

      const details = preferred
        ? await getPlaceDetailsExact(preferred.placeId)
        : await geocodeTextExact(destination.search);

      if (
        sequence !== requestSequenceRef.current ||
        !details ||
        !mapRef.current
      ) {
        return;
      }

      const nextPoint: PickerResult = {
        ...details,
        text: destination.name,
      };

      const point = {
        lat: nextPoint.lat,
        lng: nextPoint.lng,
      };

      // Evita que el evento idle reemplace el nombre frecuente por un
      // comercio o dirección cercana después de centrar el mapa.
      lastResolvedCenterRef.current = point;
      setPickupCandidates([]);
      setSelected(nextPoint);
      drawAccessiblePickupPreview(nextPoint, []);

      mapRef.current.setCenter(point);
      mapRef.current.setZoom(18);
    } finally {
      if (sequence === requestSequenceRef.current) {
        setLoadingAddress(false);
      }
    }
  }

  function useCurrentLocation(): void {
    if (!navigator.geolocation || !mapRef.current) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        if (!isPointInsideRapaNuiServiceArea(point)) {
          setScopeMessage(
            "Tu ubicación GPS está fuera de Rapa Nui. Solo se permiten puntos dentro de la isla.",
          );
          mapRef.current?.setCenter(RAPA_NUI_CENTER);
          mapRef.current?.setZoom(13);
          return;
        }

        setScopeMessage(null);
        mapRef.current?.setCenter(point);
        mapRef.current?.setZoom(18);
        void resolveMapPoint(point, true);
      },
      () => {},
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 30000,
      },
    );
  }

  const selectedWalkMeters = Math.max(
    0,
    Math.round(Number(selected?.walkMeters ?? 0)),
  );

  const selectedWalkMinutes = Math.max(
    1,
    Math.round(
      Number(
        selected?.walkMinutes ??
          Math.max(1, Math.ceil(selectedWalkMeters / 75)),
      ),
    ),
  );

  const selectedRecommendationLabel = getPickupRecommendationLabel(selected);
  const selectedWalkLabel = getPickupWalkLabel(selectedWalkMeters);
  const nearbyReferenceCandidates = pickupCandidates.filter(
    (candidate) => candidate.recommendationKind === "reference",
  );
  const hasNearbyReferenceCandidates = nearbyReferenceCandidates.length > 0;
  const recommendedReferenceCandidate =
    nearbyReferenceCandidates.find((candidate) => candidate.isRecommended) ??
    nearbyReferenceCandidates[0] ??
    null;
  const roadPickupCandidates = pickupCandidates.filter(
    (candidate) => candidate.recommendationKind !== "reference",
  );

  function renderPickupCandidate(candidate: PickerResult, index: number) {
    const active = candidate.candidateId === selected?.candidateId;
    const walkMeters = Math.round(Number(candidate.walkMeters ?? 0));
    const walkMinutes = Math.max(
      1,
      candidate.walkMinutes ?? Math.ceil(walkMeters / 75),
    );

    return (
      <button
        key={candidate.candidateId ?? `${candidate.lat}:${candidate.lng}`}
        type="button"
        className={`request-map-candidate ${
          active ? "request-map-candidate--active" : ""
        } ${
          candidate.isRecommended ? "request-map-candidate--recommended" : ""
        }`}
        onClick={() => selectPickupCandidate(candidate)}>
        <span className="request-map-candidate__number">{index + 1}</span>

        <span className="request-map-candidate__content">
          <span className="request-map-candidate__badges">
            <small className="request-map-candidate__badge">
              {getPickupRecommendationLabel(candidate)}
            </small>
            <small className="request-map-candidate__badge">
              {getPickupWalkLabel(walkMeters)}
            </small>
            {candidate.referenceName && (
              <small className="request-map-candidate__badge request-map-candidate__badge--vehicle">
                Accesible para vehículos
              </small>
            )}
          </span>

          <strong>
            {candidate.referenceName ??
              candidate.streetName ??
              candidate.text.replace(/^Recogida en\s+/i, "")}
          </strong>

          <span className="request-map-candidate__description">
            {candidate.referenceName
              ? `El punto verde quedará en ${candidate.referenceName}. El conductor llegará al acceso del local${
                  candidate.streetName ? ` por ${candidate.streetName}` : ""
                }.`
              : `No encontramos locales cercanos. El vehículo te recogerá en ${
                  candidate.streetName ?? "la calle accesible más próxima"
                }.`}
          </span>
        </span>

        <span className="request-map-candidate__walk">
          {walkMeters} m<small>{walkMinutes} min</small>
        </span>
      </button>
    );
  }

  return (
    <IonModal
      isOpen={isOpen}
      className="request-map-modal"
      onDidPresent={() => {
        setModalReady(true);

        if (autoFocusSearch) {
          window.setTimeout(() => {
            void searchInputRef.current?.setFocus();
          }, 280);
        }
      }}
      onDidDismiss={() => {
        setModalReady(false);
        sheetAdjustedByUserRef.current = false;
        lastOpenShareRef.current = null;
        onCancel();
      }}>
      <IonPage
        className="rapago-section-page rapago-request-page request-map-page"
        data-rapago-theme={pickerTheme}
        style={{ colorScheme: pickerTheme === "dark" ? "dark" : "light" }}>
        <RapagoSectionHeader
          title={
            title ||
            (mode === "origin" ? "Confirmar recogida" : "Confirmar destino")
          }
          onBack={onCancel}
          backLabel="Volver"
        />

        <IonContent
          scrollY={false}
          className="request-map-content"
          style={{ "--background": "transparent" } as CSSProperties}>
          <div
            ref={shellRef}
            className={[
              "rp-request-map-shell",
              draggingSheet ? "is-dragging" : "",
              mapShare <= minShare + 4 ? "is-sheet-tall" : "",
              mapShare >= maxShare - 4 ? "is-sheet-collapsed" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{ "--rp-map-share": `${mapShare}%` } as CSSProperties}
            aria-label={title}>
            <div
              className="rp-request-map-canvas"
              onPointerDown={() => {
                if (mapShare < maxShare - 4) {
                  closeSheetForSearch();
                }
              }}>
              <div
                ref={mapElementRef}
                className="request-map-canvas"
                aria-label="Mapa para elegir el punto"
                style={{
                  width: "100%",
                  height: "100%",
                  background: "#e8eef4",
                }}
              />

              <div
                className="request-map-search"
                style={{
                  top: 14,
                  zIndex: 20,
                }}>
                <IonItem lines="none" className="rp-request-search-field">
                  <IonIcon
                    icon={searchOutline}
                    slot="start"
                    style={{ color: "var(--rp-icon-fg)" }}
                  />
                  <IonInput
                    ref={searchInputRef}
                    value={searchText}
                    placeholder={
                      mode === "origin"
                        ? "Busca origen: hospital, aeropuerto, hotel..."
                        : "Busca destino: hospital, playa, mercado..."
                    }
                    onIonFocus={closeSheetForSearch}
                    onIonInput={(event) => {
                      const value = String(event.detail.value ?? "");
                      setSearchText(value);

                      if (value.trim()) {
                        closeSheetForSearch();
                      }
                    }}
                  />
                </IonItem>

                {scopeMessage && (
                  <span
                    className="request-map-visually-hidden"
                    aria-live="polite">
                    {scopeMessage}
                  </span>
                )}

                {pickerSuggestions.length > 0 && (
                  <div className="request-map-suggestions">
                    {pickerSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.placeId}
                        type="button"
                        className="request-map-suggestion"
                        onClick={() => void pickSuggestion(suggestion)}>
                        <strong>{suggestion.mainText}</strong>
                        <span>{suggestion.secondaryText}</span>
                      </button>
                    ))}
                  </div>
                )}

                {mode === "origin" &&
                  pickerSuggestions.length === 0 &&
                  selected?.walkMeters != null &&
                  selected.walkMeters > 8 && (
                    <div
                      style={{
                        marginTop: 8,
                        background: "rgba(17,17,17,.94)",
                        color: "#ffffff",
                        border: "1px solid rgba(34,197,94,.65)",
                        borderRadius: "16px",
                        padding: "8px 14px",
                        textAlign: "center",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        fontWeight: 800,
                        fontSize: ".72rem",
                        boxShadow: "0 5px 14px rgba(0,0,0,.35)",
                        whiteSpace: "nowrap",
                        pointerEvents: "none",
                      }}>
                      Inicio de viaje en{" "}
                      {selected.text.replace("Recogida en ", "")}
                    </div>
                  )}
              </div>

              <div className="rp-map-controls">
                <button
                  type="button"
                  className="rp-map-control"
                  aria-label="Acercar el mapa"
                  onClick={() => {
                    const map = mapRef.current;
                    if (map) map.setZoom((map.getZoom() ?? 17) + 1);
                  }}>
                  <IonIcon icon={addOutline} />
                </button>

                <button
                  type="button"
                  className="rp-map-control"
                  aria-label="Alejar el mapa"
                  onClick={() => {
                    const map = mapRef.current;
                    if (map) map.setZoom((map.getZoom() ?? 17) - 1);
                  }}>
                  <IonIcon icon={removeOutline} />
                </button>

                <button
                  type="button"
                  className="rp-map-control"
                  aria-label="Usar mi ubicación"
                  onClick={useCurrentLocation}>
                  <IonIcon icon={locateOutline} />
                </button>
              </div>

              {modalReady && (!ready || loadingAddress || searchingPicker) && (
                <div className="request-map-loading" aria-live="polite">
                  <IonSpinner name="crescent" />
                  <span>
                    {searchingPicker
                      ? "Buscando solo dentro de Rapa Nui..."
                      : mode === "origin"
                        ? "Buscando calles accesibles y referencias..."
                        : "Buscando el destino..."}
                  </span>
                </div>
              )}
            </div>

            <div ref={sheetRef} className="rp-request-map-sheet">
              <div
                className="rp-request-map-sheet-head"
                onPointerDown={handleGripPointerDown}
                onPointerMove={handleGripPointerMove}
                onPointerUp={handleGripPointerUp}
                onPointerCancel={handleGripPointerUp}
                onClick={handleGripClick}>
                <button
                  type="button"
                  className="rp-request-map-grip"
                  aria-expanded={mapShare < maxShare - 4}
                  aria-label={
                    mapShare >= maxShare - 4
                      ? "Mostrar los detalles del punto. También puedes arrastrar esta barra."
                      : "Plegar el panel y ver el mapa completo. También puedes arrastrar esta barra."
                  }
                  onKeyDown={handleGripKeyDown}>
                  <span className="rp-request-map-grip__bar" aria-hidden />
                </button>

                <div className="rp-request-map-sheet-headline">
                  <h2 className="rp-request-map-sheet-title">
                    <span
                      className="rp-request-map-sheet-title__tick"
                      aria-hidden
                    />
                    <span className="rp-request-map-sheet-title__text">
                      {mode === "origin"
                        ? hasNearbyReferenceCandidates
                          ? "Puntos de recogida cercanos"
                          : "Punto accesible recomendado"
                        : "Destino seleccionado"}
                    </span>
                  </h2>

                  <button
                    type="button"
                    className="rp-request-map-head-confirm"
                    disabled={!selected || loadingAddress || Boolean(mapError)}
                    aria-label={
                      mode === "origin"
                        ? "Confirmar recogida"
                        : "Confirmar destino"
                    }
                    onPointerDown={(event) => event.stopPropagation()}
                    onPointerUp={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (selected && !mapError) onConfirm(selected);
                    }}>
                    <IonIcon icon={checkmarkCircleOutline} aria-hidden />
                    <span>Confirmar</span>
                  </button>
                </div>
              </div>

              <div className="rp-request-map-sheet-scroll">
                {mode === "destination" && (
                  <section
                    className="request-map-frequent"
                    aria-label="Destinos frecuentes de Rapa Nui">
                    <div className="request-map-frequent__heading">
                      <div>
                        <strong>Destinos frecuentes</strong>
                        <span>
                          Toca uno y Google Maps buscará su acceso exacto.
                        </span>
                      </div>
                    </div>

                    <div className="request-map-frequent__list">
                      {TOURIST_DESTINATION_SUGGESTIONS.map((destination) => {
                        const active =
                          normalizePlaceStreetCompare(selected?.text ?? "") ===
                          normalizePlaceStreetCompare(destination.name);

                        return (
                          <button
                            key={destination.name}
                            type="button"
                            className={`request-map-frequent__item ${
                              active ? "request-map-frequent__item--active" : ""
                            }`}
                            onClick={() =>
                              void pickFrequentDestination(destination)
                            }
                            disabled={loadingAddress}
                            aria-pressed={active}>
                            <IonIcon icon={locationOutline} />

                            <span>
                              <strong>{destination.name}</strong>
                              <small>{destination.subtitle}</small>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                )}

                {mode === "origin" && hasNearbyReferenceCandidates && (
                  <section
                    className="request-map-nearby-places"
                    aria-label="Puntos de recogida cercanos">
                    <div className="request-map-candidates">
                      {nearbyReferenceCandidates.map((candidate, index) =>
                        renderPickupCandidate(candidate, index),
                      )}
                    </div>
                  </section>
                )}

                {mode === "origin" &&
                  !hasNearbyReferenceCandidates &&
                  roadPickupCandidates.length > 0 && (
                    <div className="request-map-candidates">
                      {roadPickupCandidates.map((candidate, index) =>
                        renderPickupCandidate(candidate, index),
                      )}
                    </div>
                  )}

                {mapError && (
                  <div
                    className="rp-request-note"
                    role="alert"
                    style={{
                      padding: "14px 16px",
                      marginBottom: 12,
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      borderColor: "var(--rp-danger-bd)",
                    }}>
                    <IonIcon
                      icon={alertCircleOutline}
                      style={{
                        color: "var(--rp-danger-fg)",
                        fontSize: 24,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          color: "var(--rp-danger-fg)",
                          fontWeight: 850,
                          fontSize: ".9rem",
                          marginBottom: 4,
                        }}>
                        No se pudo cargar el mapa
                      </div>
                      <div
                        style={{
                          color: "var(--rp-muted)",
                          fontSize: ".82rem",
                          lineHeight: 1.35,
                        }}>
                        {mapError}
                      </div>
                    </div>
                  </div>
                )}

                {!mapError && (
                  <div className="request-map-selected rp-request-note">
                    <span
                      className={`request-map-selected__dot ${
                        mode === "origin"
                          ? "request-map-selected__dot--pickup"
                          : "request-map-selected__dot--destination"
                      }`}
                    />

                    <div>
                      <strong>
                        {loadingAddress
                          ? "Actualizando el punto..."
                          : (selected?.text ??
                            (mode === "origin"
                              ? "Punto de recogida"
                              : "Destino"))}
                      </strong>

                      <span>
                        {selected?.address ??
                          "Mueve el mapa para elegir la ubicación."}
                      </span>
                    </div>

                    <IonIcon icon={createOutline} />
                  </div>
                )}

                {mode === "origin" && selected && !mapError && (
                  <div className="request-map-walk rp-request-note">
                    <div className="request-map-walk__icon">
                      <IonIcon icon={walkOutline} />
                    </div>

                    <div className="request-map-walk__text">
                      <strong>
                        {selectedWalkMeters <= 8
                          ? "Recogida en tu ubicación"
                          : selected.referenceName
                            ? `${selectedWalkLabel}: ve a ${selected.referenceName}`
                            : `${selectedWalkLabel}: ve a la calle`}
                      </strong>

                      <span>
                        {selectedWalkMeters <= 8
                          ? "El vehículo puede llegar directamente."
                          : selected.referenceName
                            ? `El punto verde está en ${selected.referenceName}. El conductor llegará al acceso del local${
                                selected.streetName
                                  ? ` por ${selected.streetName}`
                                  : ""
                              }.`
                            : `${selectedRecommendationLabel}: ${
                                selected.streetName ??
                                "calle accesible más próxima"
                              }.`}
                      </span>
                    </div>

                    <div className="request-map-walk__metrics">
                      {selectedWalkMeters} m
                      <small>{selectedWalkMinutes} min</small>
                    </div>
                  </div>
                )}

                {mode === "origin" && !mapError && (
                  <p className="request-map-walking-warning">
                    La ruta a pie es una estimación de Google Maps. Revisa que
                    el camino sea seguro antes de confirmar.
                  </p>
                )}
              </div>
            </div>
          </div>
        </IonContent>
      </IonPage>
    </IonModal>
  );
}

const RAPAGO_PASSENGER_NOTE_MAX_LENGTH = 180;
const RAPAGO_PASSENGER_NOTE_START = "RAPAGO_PASSENGER_NOTE_START";
const RAPAGO_PASSENGER_NOTE_END = "RAPAGO_PASSENGER_NOTE_END";

function sanitizePassengerRideNote(value: unknown): string {
  return String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/[<>`{}$\\]/g, "")
    .replace(/RAPAGO_PASSENGER_NOTE_(?:START|END)/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, RAPAGO_PASSENGER_NOTE_MAX_LENGTH);
}

function appendPassengerRideNote(notes: string[], passengerNote: string): void {
  if (!passengerNote) return;
  notes.push(
    `${RAPAGO_PASSENGER_NOTE_START} ${passengerNote} ${RAPAGO_PASSENGER_NOTE_END}.`,
  );
}

function limitRideNotes(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 500);
}

// MODO PRUEBA:
// Permite agendar reservas más cerca para testear rápido.
// Producción: reservas mínimo 30 minutos y gestión/asignación admin 30 minutos antes.
const SCHEDULE_MIN_MINUTES = 30;
const SCHEDULE_MAX_DAYS = 30;
const SCHEDULE_ACTIVATION_MINUTES = 30;

export function computeAutoSheetShift({
  currentShift,
  sheetMaxShift,
  markerY,
  sheetTop = currentShift,
  safetyMargin = 22,
}: {
  currentShift: number;
  sheetMaxShift: number;
  markerY: number;
  sheetTop?: number;
  safetyMargin?: number;
}): number {
  const maxShift = Math.max(0, sheetMaxShift);
  const current = Math.max(0, Math.min(maxShift, currentShift));
  const top = Math.max(0, Math.min(maxShift, sheetTop));

  /* El punto está visible cuando queda por encima del tope del panel con un
     margen de seguridad. Si cae detrás del panel, la hoja debe bajar para
     dejarlo al descubierto. */
  if (markerY <= top + safetyMargin) {
    return current;
  }

  return Math.min(maxShift, Math.max(0, markerY + safetyMargin));
}

/* Desplazamiento que deja el campo que se está escribiendo pegado al borde
   superior del cuerpo de la hoja, con un respiro por encima.

   Se sube el campo arriba del todo a propósito y no se centra: lo que hay que
   ver mientras se teclea no es solo el campo, sino la lista de resultados que
   sale justo debajo. Centrarlo dejaría los resultados fuera de pantalla, que
   es el fallo que se está corrigiendo. */
/* Baja el teclado soltando el foco del campo.

   Elegir un resultado deja de ocultar la lista, pero el campo sigue enfocado y
   el teclado puesto: el pasajero se quedaría mirando media pantalla tapada por
   un teclado que ya no necesita, y tendría que cerrarlo a mano para ver el mapa
   con su punto puesto. `ion-input` guarda el <input> real en su shadow DOM, y
   es a ese al que hay que soltarle el foco: hacerlo sobre el envoltorio no baja
   el teclado. */
function dismissSoftKeyboard(): void {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return;

  const inner = active.shadowRoot?.querySelector<HTMLElement>(
    "input, textarea",
  );
  (inner ?? active).blur();
}

export function computeFieldScrollTop({
  currentScrollTop,
  fieldTop,
  bodyTop,
  gap = 12,
}: {
  currentScrollTop: number;
  fieldTop: number;
  bodyTop: number;
  gap?: number;
}): number {
  return Math.max(0, currentScrollTop + (fieldTop - bodyTop) - gap);
}

function parseScheduleInput(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function toDateTimeLocalValue(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatScheduleDateTime(value: string | null | undefined): string {
  const parsed = parseScheduleInput(value);
  if (!parsed) return "Sin hora";
  return parsed.toLocaleString("es-CL", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getScheduleValidationError(input: {
  rideMode: RideMode;
  tripFareMode: TripFareMode;
  scheduledAt: string;
  returnScheduledAt: string;
  requireReturnScheduledAt?: boolean;
  roundTripPromotionReturnOnly?: boolean;
}): string | null {
  const now = new Date();
  const min = new Date(now.getTime() + SCHEDULE_MIN_MINUTES * 60_000);
  const max = new Date(now.getTime() + SCHEDULE_MAX_DAYS * 24 * 60 * 60_000);

  // Promos Anakena/Terevaka: el viaje de ida se solicita ahora.
  // Solo se agenda el regreso, por eso no pedimos hora de ida.
  if (input.roundTripPromotionReturnOnly) {
    const back = parseScheduleInput(input.returnScheduledAt);
    if (!back) return "Debes seleccionar la hora de regreso.";
    if (back.getTime() < min.getTime()) {
      return `El regreso debe ser mínimo ${SCHEDULE_MIN_MINUTES} minutos desde ahora.`;
    }
    if (back.getTime() > max.getTime()) {
      return `La hora de regreso no puede superar ${SCHEDULE_MAX_DAYS} días.`;
    }
    return null;
  }

  if (input.rideMode !== "scheduled") return null;

  const pickup = parseScheduleInput(input.scheduledAt);
  if (!pickup) return "Debes seleccionar fecha y hora de recogida.";

  if (pickup.getTime() < min.getTime()) {
    return `La reserva debe ser mínimo ${SCHEDULE_MIN_MINUTES} minutos desde ahora.`;
  }

  if (pickup.getTime() > max.getTime()) {
    return `La reserva no puede superar ${SCHEDULE_MAX_DAYS} días.`;
  }

  if (
    input.tripFareMode === "round_trip" &&
    input.requireReturnScheduledAt !== false
  ) {
    const back = parseScheduleInput(input.returnScheduledAt);
    if (!back) return "Para ida y vuelta debes seleccionar la hora de regreso.";
    if (back.getTime() <= pickup.getTime()) {
      return "La hora de regreso debe ser posterior a la hora de recogida.";
    }
    if (back.getTime() > max.getTime()) {
      return `La hora de regreso no puede superar ${SCHEDULE_MAX_DAYS} días.`;
    }
  }

  return null;
}

function buildRideScheduleFields(input: {
  rideMode: RideMode;
  tripFareMode: TripFareMode;
  scheduledAt: string;
  returnScheduledAt: string;
  scheduleKind?: "airport_pickup" | "round_trip_promotion";
}): Record<string, unknown> {
  const pickup =
    input.rideMode === "scheduled"
      ? parseScheduleInput(input.scheduledAt)
      : null;
  const back =
    input.tripFareMode === "round_trip"
      ? parseScheduleInput(input.returnScheduledAt)
      : null;
  const activation = pickup
    ? new Date(pickup.getTime() - SCHEDULE_ACTIVATION_MINUTES * 60_000)
    : null;
  const returnActivation = back
    ? new Date(back.getTime() - SCHEDULE_ACTIVATION_MINUTES * 60_000)
    : null;

  const isScheduled = input.rideMode === "scheduled" && !!pickup;
  const activationIso = activation?.toISOString() ?? null;
  const returnActivationIso = returnActivation?.toISOString() ?? null;
  const isRoundTripPromotion = input.scheduleKind === "round_trip_promotion";
  const isReturnOnlyPromotion =
    isRoundTripPromotion && !!back && input.rideMode !== "scheduled";

  return {
    rideMode: input.rideMode,
    requestMode: input.rideMode,
    isScheduled,
    status: isScheduled ? "scheduled" : "requested",
    scheduleStatus: isScheduled ? "frozen_until_activation" : "immediate",
    adminScheduleStatus: isScheduled
      ? isRoundTripPromotion
        ? "pending_admin_round_trip_promotion"
        : "pending_admin_airport_pickup"
      : isReturnOnlyPromotion
        ? "return_pending_admin_round_trip_promotion"
        : null,
    reservationStatus: isScheduled
      ? isRoundTripPromotion
        ? "round_trip_promotion_reserved"
        : "airport_pickup_reserved"
      : isReturnOnlyPromotion
        ? "round_trip_return_reserved"
        : null,
    scheduledAt: pickup?.toISOString() ?? null,
    scheduledPickupAt: pickup?.toISOString() ?? null,
    pickupScheduledAt: pickup?.toISOString() ?? null,
    returnScheduledAt: back?.toISOString() ?? null,
    scheduledReturnAt: back?.toISOString() ?? null,
    scheduledReturnActivationAt: returnActivationIso,
    returnActivationAt: returnActivationIso,
    returnDispatchAt: returnActivationIso,
    scheduleActivationAt: activationIso,
    scheduledActivationAt: activationIso,
    scheduledPickupActivationAt: activationIso,
    dispatchAt: activationIso,
    autoAssignAt: activationIso,
    driverVisibleAt: activationIso,
    driverFrozenUntil: activationIso,
    frozenUntil: activationIso,
    autoDispatchMinutesBefore: SCHEDULE_ACTIVATION_MINUTES,
    availableForDrivers: !isScheduled,
    visibleToDrivers: !isScheduled,
    driverQueueBlocked: isScheduled,
    frozenForDrivers: isScheduled,
    adminVisibleNow: isScheduled || isReturnOnlyPromotion,
    adminRequiresReview: isScheduled || isReturnOnlyPromotion,
    airportPickupBooking: isScheduled && !isRoundTripPromotion,
    roundTripPromotionBooking:
      (isScheduled || isReturnOnlyPromotion) && isRoundTripPromotion,
    roundTripReturnOnly: isReturnOnlyPromotion,
    bookingPurpose: isScheduled
      ? isRoundTripPromotion
        ? "round_trip_promotion"
        : "airport_pickup"
      : isReturnOnlyPromotion
        ? "round_trip_return_only"
        : "standard_ride",
    serviceType: isScheduled
      ? isRoundTripPromotion
        ? "round_trip_promotion"
        : "airport_pickup"
      : isReturnOnlyPromotion
        ? "round_trip_return_only"
        : "standard_ride",
    tripFareMode: input.tripFareMode,
    tripType: input.tripFareMode,
    isRoundTrip: input.tripFareMode === "round_trip",
  };
}

// ── Constants ─────────────────────────────────────────────────────────────────

const HANGA_ROA = { lat: -27.15, lng: -109.4333 };
const MIN_SCHEDULED_MINUTES = 30;
const MAX_SCHEDULED_DAYS = 30;
const MAX_DESTINATIONS = 3;

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function minScheduledDate(): Date {
  return new Date(Date.now() + MIN_SCHEDULED_MINUTES * 60 * 1000);
}

function maxScheduledDate(): Date {
  return new Date(Date.now() + MAX_SCHEDULED_DAYS * 24 * 60 * 60 * 1000);
}

function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${meters} m`;
}

function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h} h ${m} min` : `${h} h`;
  }
  return `${mins} min`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type PageStatus =
  | "idle"
  | "calculating_route"
  | "ready_to_submit"
  | "submitting"
  | "success"
  | "error";

// ── Component ─────────────────────────────────────────────────────────────────

export default function RequestRidePage(): JSX.Element {
  const { session } = useAuth();
  const history = useHistory();
  // Solo se lee: el interruptor único vive en el encabezado de Inicio.
  const { theme, isDark } = useRapagoSectionTheme("request-ride");
  const tripsRedirectStartedRef = useRef(false);

  const goToTripsAfterRequest = useCallback(
    (rideId?: string | null): void => {
      if (tripsRedirectStartedRef.current) return;
      tripsRedirectStartedRef.current = true;

      window.dispatchEvent(
        new CustomEvent("rapago:passenger-rides-updated", {
          detail: {
            rideId: rideId ?? null,
            source: "request-ride-created",
          },
        }),
      );

      // replace evita que Ionic conserve la pantalla de solicitud encima de
      // Mis Viajes y garantiza que Atrás no vuelva a un formulario ya enviado.
      history.replace(ROUTES.PASSENGER.TRIPS);
    },
    [history],
  );

  const [flowerLeiQuantity, setFlowerLeiQuantity] = useState(1);

  const sheetDragRef = useRef<{
    startY: number;
    /* Posición al empezar el gesto y última posición aplicada: al soltar se
       decide con el valor real del arrastre, no con el de React (un render por
       detrás). */
    startShift: number;
    shift: number;
  } | null>(null);

  const requestShellRef = useRef<HTMLDivElement | null>(null);

  const requestSheetHeadRef = useRef<HTMLDivElement | null>(null);

  const [sheetShift, setSheetShift] = useState<number | null>(null);

  const [sheetMaxShift, setSheetMaxShift] = useState(0);

  const [requestSheetDragging, setRequestSheetDragging] = useState(false);

  /* Franja que tapa el teclado. El CSS la usa como relleno al final del scroll
     de la hoja, de modo que la hoja conserva su alto —y su fondo sigue tapando
     la pantalla entera— mientras el contenido se aparta del teclado. */
  const keyboardInset = useKeyboardInset(requestShellRef);

  /* Desplazamiento al que volver cuando se cierra el teclado. Se guarda en una
     ref y no en estado porque solo se lee al restaurar: en estado provocaría un
     render por cada foco sin cambiar nada de lo que se ve. */
  const shiftBeforeKeyboardRef = useRef<number | null>(null);

  /* Mide el recorrido REAL: alto del shell menos el alto de la cabecera (asa +
     AHORA/RESERVAR), que es lo único que queda visible con la hoja abajo del
     todo. El ResizeObserver lo mantiene al día al girar el aparato o al
     encogerse la barra del navegador; sin números mágicos de alto.

     Sin este efecto `sheetMaxShift` se queda para siempre en su valor inicial
     (0) y el arrastre no arranca nunca: `handleRequestGripPointerDown` corta
     con `if (sheetMaxShift <= 0) return`. Es la causa de que subir/bajar la
     hoja no respondiera en producción. */
  useEffect(() => {
    const shell = requestShellRef.current;
    if (!shell || typeof ResizeObserver === "undefined") return;

    const measure = (): void => {
      const shellHeight = shell.getBoundingClientRect().height;
      if (shellHeight <= 0) return;

      const headHeight =
        requestSheetHeadRef.current?.getBoundingClientRect().height ??
        REQUEST_SHEET_HANDLE_FALLBACK;
      const max = Math.max(0, shellHeight - headHeight);

      setSheetMaxShift(max);
      setSheetShift((prev) =>
        prev == null
          ? Math.round(max * REQUEST_SHEET_REST_FRACTION)
          : Math.min(prev, max),
      );
    };

    const observer = new ResizeObserver(measure);
    observer.observe(shell);
    measure();

    return () => observer.disconnect();
  }, []);

  function handleRequestGripPointerDown(
    event: ReactPointerEvent<HTMLElement>,
  ): void {
    if (sheetMaxShift <= 0) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    const startShift =
      sheetShift ?? Math.round(sheetMaxShift * REQUEST_SHEET_REST_FRACTION);
    sheetDragRef.current = {
      startY: event.clientY,
      startShift,
      shift: startShift,
    };
    setRequestSheetDragging(true);
  }

  function handleRequestGripPointerMove(
    event: ReactPointerEvent<HTMLElement>,
  ): void {
    const drag = sheetDragRef.current;
    if (!drag) return;

    const deltaPx = event.clientY - drag.startY;

    /* clientY crece hacia abajo: bajar el dedo baja la hoja (shift crece) y
       subirlo la sube, siempre 1:1. Fuera de los límites cede elásticamente. */
    const raw = drag.startShift + deltaPx;
    const next = rubberBandShare(raw, 0, sheetMaxShift);

    drag.shift = next;
    setSheetShift(next);
  }

  function handleRequestGripPointerUp(
    event: ReactPointerEvent<HTMLElement>,
  ): void {
    const drag = sheetDragRef.current;
    if (!drag) return;

    sheetDragRef.current = null;
    setRequestSheetDragging(false);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    /* La hoja se queda EXACTAMENTE donde se soltó, solo acotada a los límites:
       movimiento libre, sin posiciones fijas ni encaje. Lo único que se
       deshace es el estiramiento elástico si el gesto terminó fuera de banda. */
    setSheetShift(Math.min(sheetMaxShift, Math.max(0, drag.shift)));
  }

  function handleRequestGripKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ): void {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;

    event.preventDefault();
    const delta =
      event.key === "ArrowUp"
        ? -REQUEST_SHEET_KEY_STEP
        : REQUEST_SHEET_KEY_STEP;

    setSheetShift((current) => {
      const base =
        current ?? Math.round(sheetMaxShift * REQUEST_SHEET_REST_FRACTION);
      return Math.min(sheetMaxShift, Math.max(0, base + delta));
    });
  }

  function stopSheetDragPropagation(
    event: ReactPointerEvent<HTMLElement>,
  ): void {
    event.stopPropagation();
  }

  const [klapPayment, setKlapPayment] =
    useState<PendingKlapPaymentRecord | null>(null);

  const restorePendingKlapPayment = useCallback((): void => {
    if (!session?.accessToken) return;
    const pending = readPendingKlapPayment();
    if (pending) setKlapPayment(pending);
  }, [session?.accessToken]);

  useEffect(() => {
    restorePendingKlapPayment();
    window.addEventListener(
      "rapago:resume-klap-payment",
      restorePendingKlapPayment,
    );

    return () => {
      window.removeEventListener(
        "rapago:resume-klap-payment",
        restorePendingKlapPayment,
      );
    };
  }, [restorePendingKlapPayment]);

  const handleKlapApproved = useCallback(
    (pending: PendingKlapPaymentRecord): void => {
      const approvedAt = new Date().toISOString();

      if (pending.scheduledRideMirror) {
        upsertLocalAdminScheduledRide({
          ...pending.scheduledRideMirror,
          serverRideId: pending.rideRequestId,
          originalRideId: pending.rideRequestId,
          paymentStatus: "approved",
          paymentApproved: true,
          paymentApprovedAt: approvedAt,
          paymentProvider: "klap",
        });
      }

      clearPendingKlapPayment();
      setKlapPayment(null);
      window.dispatchEvent(
        new CustomEvent("rapago:passenger-rides-updated", {
          detail: {
            rideId: pending.rideRequestId,
            source: "klap-payment-approved",
          },
        }),
      );
      goToTripsAfterRequest(pending.rideRequestId);
    },
    [goToTripsAfterRequest],
  );

  const handleKlapRejected = useCallback(
    (_pending: PendingKlapPaymentRecord, message: string): void => {
      // El modal permanece abierto para que el pasajero vea el motivo y pueda
      // probar otra tarjeta. Solo limpiamos la orden terminal del almacenamiento.
      clearPendingKlapPayment();
      setSubmitError(message);
    },
    [],
  );

  const handleRetryKlapPayment = useCallback(
    async (
      pending: PendingKlapPaymentRecord,
    ): Promise<PendingKlapPaymentRecord> => {
      if (!session?.accessToken) {
        throw new Error("Tu sesión expiró. Inicia sesión nuevamente.");
      }

      // Conserva el registro anterior hasta que el backend entregue una orden
      // nueva o recupere de forma segura la existente. Así no perdemos la
      // referencia local si Klap está temporalmente inaccesible.
      resetKlapCheckoutForNextOrder();

      const order = await createKlapHostedOrder(
        session.accessToken,
        pending.rideRequestId,
      );

      const nextPayment: PendingKlapPaymentRecord = {
        ...pending,
        paymentId: order.paymentId,
        orderId: order.publicCheckoutData.orderId,
        redirectUrl: order.publicCheckoutData.redirectUrl,
        provider: "klap",
        createdAt: new Date().toISOString(),
        checkoutStartedAt: null,
      };

      savePendingKlapPayment(nextPayment);
      setSubmitError(null);
      setKlapPayment(nextPayment);
      return nextPayment;
    },
    [session?.accessToken],
  );

  const handleCloseKlapCheckout = useCallback(
    (pending: PendingKlapPaymentRecord): void => {
      setKlapPayment(null);
      goToTripsAfterRequest(pending.rideRequestId);
    },
    [goToTripsAfterRequest],
  );

  const handleCancelKlapRequest = useCallback(
    async (pending: PendingKlapPaymentRecord): Promise<void> => {
      if (!session?.accessToken) {
        throw new Error("Tu sesión expiró. Inicia sesión nuevamente.");
      }

      await cancelPendingKlapRide(session.accessToken, pending);
      setKlapPayment(null);
      tripsRedirectStartedRef.current = false;
      window.dispatchEvent(
        new CustomEvent("rapago:passenger-rides-updated", {
          detail: {
            rideId: pending.rideRequestId,
            source: "klap-request-cancelled-before-payment",
          },
        }),
      );
    },
    [session?.accessToken],
  );

  useEffect(() => {
    preSearchLocationService.read();
    return () => preSearchLocationService.clear();
  }, []);

  const [originPoint, setOriginPoint] = useState<ConfirmedPoint | null>(null);
  const [destinationPoint, setDestinationPoint] =
    useState<ConfirmedPoint | null>(null);

  const [originInput, setOriginInput] = useState("");
  const [destInput, setDestInput] = useState("");

  const [originSuggestions, setOriginSuggestions] = useState<
    GoogleSuggestion[]
  >([]);
  const [destSuggestions, setDestSuggestions] = useState<GoogleSuggestion[]>(
    [],
  );
  const [searchingOrigin, setSearchingOrigin] = useState(false);
  const [searchingDest, setSearchingDest] = useState(false);
  /* Un icono de Google tocado en el mapa se está resolviendo con Places. Sin
     este aviso el toque parecería no haber hecho nada durante el segundo que
     tarda la ficha del lugar. */
  const [mapPoiLoading, setMapPoiLoading] = useState(false);

  const originSearchSeq = useRef(0);
  const destSearchSeq = useRef(0);
  const mapPoiSequenceRef = useRef(0);
  /* Evita que el mapa se reabra solo al devolver el foco al input justo
     después de confirmar un punto (decisión de producto: tocar el campo abre
     el mapa al instante, así que hace falta este freno de 900ms). */
  const suppressPickerOpenRef = useRef(false);

  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
  /* Qué campo tiene abierto el buscador inline (reemplaza al modal en el flujo
     principal). */
  const [activeSearchField, setActiveSearchField] =
    useState<PickerTarget | null>(null);
  /* Aviso de orden en el riel: el destino no se puede elegir antes que el
     origen. No es una validación nueva —el viaje siempre necesitó los dos
     puntos— sino decirlo en el momento en que el pasajero lo intenta, en vez
     de dejarle rellenar el destino y descubrir al final que faltaba lo otro.
     La razón es del mapa: la búsqueda y la ruta se calculan desde el origen,
     así que empezar por el destino deja media pantalla sin referencia. */
  const [routeOrderHint, setRouteOrderHint] = useState(false);
  const [pickerAutoFocusSearch, setPickerAutoFocusSearch] = useState(false);

  const [notesInput, setNotesInput] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
  /* Ya nadie LEE este estado: el panel plegable de formas de pago desapareció
     cuando el pago pasó a tener su propio paso con las dos tarjetas siempre a
     la vista. El setter sigue porque el flujo de Klap lo llama desde nueve
     sitios para cerrar el panel al terminar un cobro; se conservan intactas
     esas llamadas —ahora inocuas— en vez de tocar el flujo de pago, que no es
     lo que se está arreglando aquí. */
  const [, setShowPaymentBox] = useState(false);
  const [useWalletBenefit, setUseWalletBenefit] = useState<boolean | null>(
    null,
  );
  const [walletBenefitRevision, setWalletBenefitRevision] = useState(0);
  const [backendWalletBenefitClp, setBackendWalletBenefitClp] = useState(0);
  const [walletBenefitLoading, setWalletBenefitLoading] = useState(false);
  const [pendingChargeRevision, setPendingChargeRevision] = useState(0);
  const [backendPendingPassengerCharges, setBackendPendingPassengerCharges] =
    useState<PassengerPendingChargeForRequest[]>([]);
  const [rideMode, setRideMode] = useState<RideMode>("now");
  const [tripFareMode, setTripFareMode] = useState<TripFareMode>("one_way");
  const [selectedRoundTripPromotionId, setSelectedRoundTripPromotionId] =
    useState<string | null>(null);
  const [pendingRoundTripPromotion, setPendingRoundTripPromotion] =
    useState<RoundTripPromotion | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");
  const [returnScheduledAt, setReturnScheduledAt] = useState("");
  const [flightNumber, setFlightNumber] = useState("");
  const [airportWelcomeOption, setAirportWelcomeOption] =
    useState<AirportWelcomeOption>("none");
  const [locating, setLocating] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fareQuote, setFareQuote] = useState<FareQuote | null>(null);
  const [fareLoading, setFareLoading] = useState(false);
  const [fareRules, setFareRules] = useState<RapaGoFareRules>(
    DEFAULT_RAPAGO_FARE_RULES,
  );
  const [vehicleCategory, setVehicleCategory] =
    useState<VehicleCategory>("standard");
  const passengerFareType = useMemo(
    () => readPassengerFareType(session?.user),
    [session?.user],
  );
  const roundTripPromotions = useMemo(
    () => buildAdminRoundTripPromotions(fareRules, passengerFareType),
    [fareRules, passengerFareType],
  );
  const selectedRoundTripPromotion = useMemo(
    () =>
      roundTripPromotions.find(
        (promotion) => promotion.id === selectedRoundTripPromotionId,
      ) ?? null,
    [roundTripPromotions, selectedRoundTripPromotionId],
  );
  const selectedRoundTripExperienceFareClp = useMemo(
    () =>
      selectedRoundTripPromotion
        ? calculateRoundTripExperienceFare(
            selectedRoundTripPromotion,
            vehicleCategory,
            fareRules,
          )
        : null,
    [selectedRoundTripPromotion, vehicleCategory, fareRules],
  );
  const effectivePassengerFareType =
    selectedRoundTripPromotion?.passengerFareType ?? passengerFareType;
  const effectiveTripFareMode: TripFareMode = selectedRoundTripPromotion
    ? "round_trip"
    : tripFareMode;
  const isRoundTripPromotionSelected = Boolean(selectedRoundTripPromotion);
  const isAirportScheduledRide =
    rideMode === "scheduled" && !isRoundTripPromotionSelected;
  const reservationRequiresCard =
    rideMode === "scheduled" || Boolean(selectedRoundTripPromotion);
  const airportScheduledRequiresCard = isAirportScheduledRide;
  const canChooseOrigin =
    rideMode !== "scheduled" || isRoundTripPromotionSelected;
  const requireReturnScheduledAt = effectiveTripFareMode === "round_trip";
  const roundTripPromotionReturnOnly = false;

  useEffect(() => {
    if (!reservationRequiresCard) return;
    if (paymentMethod !== "card") setPaymentMethod("card");
    setShowPaymentBox(false);
  }, [reservationRequiresCard, paymentMethod]);

  useEffect(() => {
    let cancelled = false;

    const refreshFareRules = (): void => {
      void fetchRapaGoFareRules().then((rules) => {
        if (!cancelled) setFareRules(rules);
      });
    };

    const handleStorage = (event: StorageEvent): void => {
      if (event.key && event.key !== ADMIN_FARE_ENGINE_STORAGE_KEY) return;
      refreshFareRules();
    };

    refreshFareRules();
    window.addEventListener("storage", handleStorage);
    window.addEventListener(
      ADMIN_FARE_ENGINE_UPDATED_EVENT,
      refreshFareRules as EventListener,
    );

    return () => {
      cancelled = true;
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(
        ADMIN_FARE_ENGINE_UPDATED_EVENT,
        refreshFareRules as EventListener,
      );
    };
  }, []);

  useEffect(() => {
    const refreshWalletBenefits = () =>
      setWalletBenefitRevision((current) => current + 1);

    window.addEventListener("storage", refreshWalletBenefits);
    window.addEventListener(
      "rapago:wallet-updated",
      refreshWalletBenefits as EventListener,
    );
    window.addEventListener(
      RAPAGO_WALLET_BENEFIT_EVENT_REQUEST,
      refreshWalletBenefits as EventListener,
    );

    return () => {
      window.removeEventListener("storage", refreshWalletBenefits);
      window.removeEventListener(
        "rapago:wallet-updated",
        refreshWalletBenefits as EventListener,
      );
      window.removeEventListener(
        RAPAGO_WALLET_BENEFIT_EVENT_REQUEST,
        refreshWalletBenefits as EventListener,
      );
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!session?.accessToken) {
      setBackendWalletBenefitClp(0);
      setWalletBenefitLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setWalletBenefitLoading(true);

    void walletService
      .getMyWallet(session.accessToken)
      .then((wallet) => {
        if (cancelled) return;
        setBackendWalletBenefitClp(
          Math.max(
            0,
            Math.round(
              Number(wallet.availableBenefitClp ?? wallet.balance ?? 0),
            ),
          ),
        );
      })
      .catch(() => {
        if (!cancelled) setBackendWalletBenefitClp(0);
      })
      .finally(() => {
        if (!cancelled) setWalletBenefitLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session?.accessToken, walletBenefitRevision]);

  useEffect(() => {
    if (!originPoint || !destinationPoint) {
      setFareQuote(null);
      setFareLoading(false);
      return;
    }

    let cancelled = false;
    const origin = { lat: originPoint.lat, lng: originPoint.lng };
    const destination = {
      lat: destinationPoint.lat,
      lng: destinationPoint.lng,
    };

    const fallback = calculateEstimatedFareFromPoints(
      origin,
      destination,
      fareRules,
      effectivePassengerFareType,
      vehicleCategory,
      destinationPoint.text,
      effectiveTripFareMode,
    );
    setFareQuote(fallback);
    setFareLoading(true);

    void loadRapaGoGoogleMaps()
      .then(() => {
        if (cancelled || !window.google?.maps) return;

        const service = new google.maps.DirectionsService();

        service.route(
          {
            origin,
            destination,
            travelMode: google.maps.TravelMode.DRIVING,
            provideRouteAlternatives: false,
          },
          (result, status) => {
            if (cancelled) return;

            const leg = result?.routes?.[0]?.legs?.[0];

            if (status === google.maps.DirectionsStatus.OK && leg) {
              const km = (leg.distance?.value ?? fallback.km * 1000) / 1000;
              const minutes =
                (leg.duration?.value ?? fallback.minutes * 60) / 60;
              setFareQuote({
                ...calculateRapaGoFare(
                  km,
                  minutes,
                  fareRules,
                  effectivePassengerFareType,
                  vehicleCategory,
                  destinationPoint.text,
                  effectiveTripFareMode,
                ),
                source: "google",
              });
            } else {
              setFareQuote(fallback);
            }
          },
        );
      })
      .catch(() => {
        if (!cancelled) setFareQuote(fallback);
      })
      .finally(() => {
        if (!cancelled) setFareLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    originPoint?.lat,
    originPoint?.lng,
    destinationPoint?.lat,
    destinationPoint?.lng,
    destinationPoint?.text,
    fareRules,
    effectivePassengerFareType,
    vehicleCategory,
    effectiveTripFareMode,
  ]);

  useEffect(() => {
    const handler = (event: CustomEvent<MapPointMovedPayload>) => {
      void applyMovedOriginFromMap(event.detail);
    };

    window.addEventListener("rapago:origin-point-moved", handler);

    return () => {
      window.removeEventListener("rapago:origin-point-moved", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handler = (
      event: CustomEvent<{ lat: number; lng: number; screenY: number }>,
    ) => {
      if (requestSheetDragging) return;

      const currentShift = sheetShift ?? 0;
      const nextShift = computeAutoSheetShift({
        currentShift,
        sheetMaxShift,
        markerY: event.detail.screenY,
        sheetTop: currentShift,
        safetyMargin: 26,
      });

      if (Math.abs(nextShift - currentShift) > 0.5) {
        setSheetShift(nextShift);
      }
    };

    window.addEventListener(
      "rapago:origin-point-visibility",
      handler as EventListener,
    );

    return () => {
      window.removeEventListener(
        "rapago:origin-point-visibility",
        handler as EventListener,
      );
    };
  }, [requestSheetDragging, sheetMaxShift, sheetShift]);

  useEffect(() => {
    if (rideMode !== "scheduled") return;

    if (selectedRoundTripPromotionId) {
      setOriginSuggestions([]);
      setDestSuggestions([]);
      return;
    }

    setSelectedRoundTripPromotionId(null);
    setTripFareMode("one_way");
    setReturnScheduledAt("");

    // Agendar aeropuerto = el viaje parte desde el Aeropuerto Mataveri.
    // Siempre forzamos el origen exacto de la terminal, aunque haya quedado
    // guardado un punto anterior del aeropuerto con coordenadas corridas.
    applyRapaNuiAirportOrigin();

    if (isRapaNuiAirportPoint(destinationPoint)) {
      setDestinationPoint(null);
      setDestInput("");
    }

    setOriginSuggestions([]);
    setDestSuggestions([]);
  }, [rideMode, selectedRoundTripPromotionId]);

  /* El SDK de Google se descarga mientras el pasajero mira la pantalla, no
     cuando ya está escribiendo. Es lo más lento del recorrido y no depende de
     lo que teclee, así que no tiene por qué estar en el camino crítico de la
     primera búsqueda. */
  useEffect(() => {
    prewarmRapaNuiAutocomplete();
  }, []);

  useEffect(() => {
    const value = originInput.trim();

    if (
      isAirportScheduledRide ||
      normalizeRapaNuiAutocompleteText(value).length < 2 ||
      originPoint?.text === value
    ) {
      setOriginSuggestions([]);
      setSearchingOrigin(false);
      return;
    }

    const seq = ++originSearchSeq.current;

    /* Respuesta inmediata, en esta misma pulsación: el catálogo local está en
       memoria y no necesita ni espera ni red. Antes se calculaba igual, pero
       se quedaba retenido dentro de getGooglePredictions hasta que Google
       contestaba, así que el pasajero miraba una lista vacía esperando por
       algo que ya teníamos. Google llega después y afina la lista. */
    const instant = getRapaNuiLocalAutocompletePredictions(value);
    if (instant.length > 0) setOriginSuggestions(instant);
    setSearchingOrigin(true);

    const timeout = window.setTimeout(() => {
      void getGooglePredictions(value)
        .then((results) => {
          if (seq !== originSearchSeq.current) return;
          setOriginSuggestions(results);
        })
        .finally(() => {
          if (seq === originSearchSeq.current) setSearchingOrigin(false);
        });
    }, autocompleteDebounceMs(value));

    return () => window.clearTimeout(timeout);
  }, [isAirportScheduledRide, originInput, originPoint?.text]);

  useEffect(() => {
    const value = destInput.trim();

    if (
      normalizeRapaNuiAutocompleteText(value).length < 2 ||
      destinationPoint?.text === value
    ) {
      setDestSuggestions([]);
      setSearchingDest(false);
      return;
    }

    const seq = ++destSearchSeq.current;

    // Mismo trato que el origen: lo que ya sabemos se pinta ya.
    const instant = getRapaNuiLocalAutocompletePredictions(value);
    if (instant.length > 0) setDestSuggestions(instant);
    setSearchingDest(true);

    const timeout = window.setTimeout(() => {
      void getGooglePredictions(value)
        .then((results) => {
          if (seq !== destSearchSeq.current) return;
          setDestSuggestions(results);
        })
        .finally(() => {
          if (seq === destSearchSeq.current) setSearchingDest(false);
        });
    }, autocompleteDebounceMs(value));

    return () => window.clearTimeout(timeout);
  }, [destInput, destinationPoint?.text]);

  function applyOrigin(point: PickerResult): void {
    /* No se puede elegir el mismo origen y destino: un viaje de un punto a
       sí mismo no tiene sentido. Si son iguales (por placeId o por lat/lng),
       se rechaza y se muestra el motivo. */
    if (destinationPoint) {
      const isSamePlaceId =
        point.placeId && point.placeId === destinationPoint.placeId;
      const isSameCoords =
        !isSamePlaceId &&
        point.lat === destinationPoint.lat &&
        point.lng === destinationPoint.lng;

      if (isSamePlaceId || isSameCoords) {
        setSubmitError("No puedes elegir el mismo origen y destino.");
        return;
      }
    }

    const confirmed = {
      text: point.text,
      address: point.address,
      lat: point.lat,
      lng: point.lng,
      placeId: point.placeId ?? null,
      originalLat: point.originalLat ?? null,
      originalLng: point.originalLng ?? null,
      walkMeters: point.walkMeters,
      isAccessiblePickup: point.isAccessiblePickup,
    };

    setOriginPoint(confirmed);
    setOriginInput(confirmed.text);
    setOriginSuggestions([]);
    /* Ya hay origen: el aviso de orden pierde sentido y se retira solo. */
    setRouteOrderHint(false);
    setSubmitError(null);
    /* Baja la hoja al reposo para que el pin quede visible en el mapa. */
  }

  async function applyMovedOriginFromMap(
    payload: MapPointMovedPayload,
  ): Promise<void> {
    if (payload.point !== "origin") return;

    setSubmitError(null);

    /* El punto verde se puede soltar en cualquier parte del mapa, también en
       el mar o fuera de la isla: ahí no hay viaje posible, así que se avisa y
       el origen anterior se conserva. */
    if (!isPointInsideRapaNuiServiceArea({ lat: payload.lat, lng: payload.lng })) {
      setSubmitError(
        "Ese punto está fuera de Rapa Nui. Mueve el punto verde dentro de la isla.",
      );
      return;
    }

    try {
      const moved = await resolveMovedOriginPoint({
        lat: payload.lat,
        lng: payload.lng,
        text: payload.text,
        address: payload.address,
      });

      applyOrigin(moved);
    } catch {
      const fallbackPoint: PickerResult = {
        text: payload.text || "Punto elegido en el mapa",
        address: payload.address || "Ubicación seleccionada manualmente",
        lat: payload.lat,
        lng: payload.lng,
        placeId: null,
        originalLat: payload.lat,
        originalLng: payload.lng,
        walkMeters: 0,
        isAccessiblePickup: false,
      };

      applyOrigin(fallbackPoint);
    }
  }

  /* El punto dorado soltado en el mapa. No todo destino tiene nombre —una
     casa, una parcela, un tramo de costa—, así que aquí no se busca ningún
     lugar: se toma la coordenada tal cual y solo se le pone la dirección más
     cercana como etiqueta. */
  async function applyMovedDestinationFromMap(
    payload: MapPointMovedPayload,
  ): Promise<void> {
    if (payload.point !== "destination") return;

    setSubmitError(null);

    const point = { lat: payload.lat, lng: payload.lng };

    if (!isPointInsideRapaNuiServiceArea(point)) {
      setSubmitError(
        "Ese punto está fuera de Rapa Nui. Mueve el punto dorado dentro de la isla.",
      );
      return;
    }

    const fallback: PickerResult = {
      text: payload.text || "Punto elegido en el mapa",
      address: payload.address || "Ubicación seleccionada manualmente",
      lat: payload.lat,
      lng: payload.lng,
      placeId: null,
      originalLat: null,
      originalLng: null,
      walkMeters: 0,
      isAccessiblePickup: false,
    };

    try {
      const resolved = await reverseGeocodeExact({
        ...point,
        placeId: null,
      });

      applyDestination(resolved);
    } catch {
      applyDestination(fallback);
    }
  }

  function applyDestination(
    point: PickerResult,
    options?: { keepRoundTripPromotion?: boolean },
  ): void {
    /* No se puede elegir el mismo origen y destino: un viaje de un punto a
       sí mismo no tiene sentido. Si son iguales (por placeId o por lat/lng),
       se rechaza y se muestra el motivo. */
    if (originPoint) {
      const isSamePlaceId =
        point.placeId && point.placeId === originPoint.placeId;
      const isSameCoords =
        !isSamePlaceId &&
        point.lat === originPoint.lat &&
        point.lng === originPoint.lng;

      if (isSamePlaceId || isSameCoords) {
        setSubmitError("No puedes elegir el mismo origen y destino.");
        return;
      }
    }

    if (!options?.keepRoundTripPromotion) {
      setSelectedRoundTripPromotionId(null);
      setTripFareMode("one_way");
      setReturnScheduledAt("");
    }

    const confirmed = {
      text: point.text.replace("Recogida en ", ""),
      address: point.address,
      lat: point.lat,
      lng: point.lng,
      placeId: point.placeId ?? null,
      originalLat: null,
      originalLng: null,
      walkMeters: 0,
      isAccessiblePickup: false,
    };

    setDestinationPoint(confirmed);
    setDestInput(confirmed.text);
    setDestSuggestions([]);
    setSubmitError(null);
    /* Baja la hoja al reposo para que el pin quede visible en el mapa. */
    setSheetShift(Math.round(sheetMaxShift * REQUEST_SHEET_REST_FRACTION));
  }

  function applyRapaNuiAirportOrigin(): void {
    setSelectedRoundTripPromotionId(null);
    setTripFareMode("one_way");
    setReturnScheduledAt("");
    setOriginPoint({
      text: RAPA_NUI_AIRPORT_DESTINATION.text,
      address: RAPA_NUI_AIRPORT_DESTINATION.address,
      lat: RAPA_NUI_AIRPORT_DESTINATION.lat,
      lng: RAPA_NUI_AIRPORT_DESTINATION.lng,
      placeId: RAPA_NUI_AIRPORT_DESTINATION.placeId ?? null,
      originalLat: null,
      originalLng: null,
      walkMeters: 0,
      isAccessiblePickup: false,
    });
    setOriginInput(RAPA_NUI_AIRPORT_DESTINATION.text);
    setOriginSuggestions([]);
  }

  async function pickOrigin(suggestion: GoogleSuggestion): Promise<void> {
    const details = await getPlaceDetails(suggestion.placeId);
    if (!details) return;

    applyOrigin(details);
  }

  async function pickDestination(suggestion: GoogleSuggestion): Promise<void> {
    const details = await getPlaceDetailsExact(suggestion.placeId);
    if (!details) return;

    applyDestination(details);
  }

  function clearOriginSelection(): void {
    setOriginPoint(null);
    setOriginInput("");
    setOriginSuggestions([]);
    setSearchingOrigin(false);
    setSubmitError(null);
  }

  function clearDestinationSelection(): void {
    setDestinationPoint(null);
    setDestInput("");
    setDestSuggestions([]);
    setSearchingDest(false);
    setSubmitError(null);
  }

  /* Selección de un POI tocado en el mapa. Secuencial estilo Uber: primer toque
     = origen, segundo = destino. Se usa un ref para exponer un callback estable
     a MapFallback (evita redibujar los marcadores en cada render) mientras se
     ejecuta siempre la lógica con el estado más reciente. */
  const selectMapPlaceRef = useRef<(place: MapPlaceMarker) => void>(() => {});
  selectMapPlaceRef.current = (place: MapPlaceMarker): void => {
    const full = RAPA_NUI_LOCAL_AUTOCOMPLETE_PLACES.find(
      (item) => item.id === place.id,
    );
    if (!full) return;

    const picker = localRapaNuiPlaceToPickerResult(full);
    setSubmitError(null);
    setActiveSearchField(null);

    if (canChooseOrigin && !originPoint) {
      applyOrigin(picker);
      return;
    }

    applyDestination(picker);
  };
  const handleSelectMapPlace = useCallback((place: MapPlaceMarker): void => {
    selectMapPlaceRef.current(place);
  }, []);

  /* Iconos propios de Google (restaurantes, hoteles, moáis…). MapFallback ya
     canceló el globo nativo que ofrecía abrir Google Maps: ese aviso sacaba al
     pasajero de la app justo cuando estaba eligiendo su viaje. Ahora el toque
     entra a la MISMA regla secuencial que los POIs propios —primer toque
     origen, segundo destino— resolviendo el lugar con Places Details, que es
     lo único que Google entrega en el evento (place_id y coordenada). */
  async function applyGooglePoiFromMap(poi: MapGooglePoi): Promise<void> {
    const asOrigin = canChooseOrigin && !originPoint;
    const sequence = ++mapPoiSequenceRef.current;

    setSubmitError(null);
    setActiveSearchField(null);
    setMapPoiLoading(true);

    try {
      /* Origen usa getPlaceDetails (acerca el punto a una vía por la que
         pueda entrar el vehículo); destino usa la coordenada exacta del
         lugar, igual que al elegirlo desde el buscador. */
      const details = asOrigin
        ? await getPlaceDetails(poi.placeId)
        : await getPlaceDetailsExact(poi.placeId);

      if (sequence !== mapPoiSequenceRef.current) return;

      if (details) {
        if (asOrigin) applyOrigin(details);
        else applyDestination(details);
        return;
      }

      /* Sin ficha de Google: si el toque cayó dentro de la isla todavía sirve
         la coordenada, así que se resuelve por dirección en vez de perder la
         selección. Fuera de la isla se avisa y no se toca nada. */
      if (!isPointInsideRapaNuiServiceArea(poi)) {
        setSubmitError(
          "Ese lugar está fuera de Rapa Nui. Elige un punto dentro de la isla.",
        );
        return;
      }

      const point: Coords = {
        lat: poi.lat,
        lng: poi.lng,
        placeId: poi.placeId,
      };
      const fallback = asOrigin
        ? await reverseGeocode(point)
        : await reverseGeocodeExact(point);

      if (sequence !== mapPoiSequenceRef.current) return;

      if (asOrigin) applyOrigin(fallback);
      else applyDestination(fallback);
    } catch {
      if (sequence !== mapPoiSequenceRef.current) return;

      setSubmitError(
        "No pudimos leer ese lugar del mapa. Inténtalo de nuevo o búscalo por su nombre.",
      );
    } finally {
      if (sequence === mapPoiSequenceRef.current) setMapPoiLoading(false);
    }
  }

  const selectGooglePoiRef = useRef<(poi: MapGooglePoi) => void>(() => {});
  selectGooglePoiRef.current = (poi: MapGooglePoi): void => {
    void applyGooglePoiFromMap(poi);
  };
  const handleSelectGooglePoi = useCallback((poi: MapGooglePoi): void => {
    selectGooglePoiRef.current(poi);
  }, []);

  /* Resultados de origen/destino. Usa la MISMA fuente de lugares y los MISMOS
     handlers de selección de siempre — sólo cambia dónde vive el campo de
     texto: antes este bloque traía su propia caja y el pasajero escribía ahí,
     separado de la fila; ahora el campo real es el de arriba (rq-field) y
     esto es sólo la respuesta que aparece debajo mientras se escribe, como en
     Uber. Sin texto, lista los lugares disponibles; desde 2 caracteres,
     muestra los resultados (locales + Google) que ya calculan los efectos
     existentes. */
  function renderRouteResults(target: PickerTarget): JSX.Element {
    const isOrigin = target === "origin";
    const value = isOrigin ? originInput : destInput;
    const suggestions = isOrigin ? originSuggestions : destSuggestions;
    const searching = isOrigin ? searchingOrigin : searchingDest;
    const showBaseList = normalizeRapaNuiAutocompleteText(value).length < 2;

    return (
      <div
        className="rq-results"
        role="group"
        aria-label={isOrigin ? "Resultados de origen" : "Resultados de destino"}>
        <div className="rq-results__hint">
          {showBaseList ? "Lugares disponibles" : "Resultados"}
        </div>

        <ul className="rq-results__list">
          {showBaseList ? (
            RAPA_NUI_LOCAL_AUTOCOMPLETE_PLACES.map((place) => (
              <li key={place.id}>
                <button
                  type="button"
                  className="rq-results__item"
                  onClick={() => {
                    const picker = localRapaNuiPlaceToPickerResult(place);
                    if (isOrigin) applyOrigin(picker);
                    else applyDestination(picker);
                    setActiveSearchField(null);
                    dismissSoftKeyboard();
                  }}>
                  <span className="rq-results__pin" aria-hidden="true">
                    <IonIcon icon={locationOutline} />
                  </span>
                  <span className="rq-results__copy">
                    <strong>{place.name}</strong>
                    <small>{place.subtitle}</small>
                  </span>
                </button>
              </li>
            ))
          ) : suggestions.length > 0 ? (
            suggestions.map((suggestion) => (
              <li key={suggestion.placeId}>
                <button
                  type="button"
                  className="rq-results__item"
                  onClick={() => {
                    if (isOrigin) void pickOrigin(suggestion);
                    else void pickDestination(suggestion);
                    setActiveSearchField(null);
                    dismissSoftKeyboard();
                  }}>
                  <span className="rq-results__pin" aria-hidden="true">
                    <IonIcon icon={locationOutline} />
                  </span>
                  <span className="rq-results__copy">
                    <strong>{suggestion.mainText}</strong>
                    <small>{suggestion.secondaryText}</small>
                  </span>
                </button>
              </li>
            ))
          ) : searching ? (
            /* Antes aquí no se pintaba nada: quedaba el título "Resultados"
               encabezando un hueco, que se lee igual que "no hay nada" y hace
               abandonar la búsqueda justo cuando estaba a punto de responder. */
            <li className="rq-results__loading">
              <IonSpinner name="dots" />
              Buscando lugares…
            </li>
          ) : (
            <li className="rq-results__empty">
              Sin resultados. Prueba otro nombre o toca un punto del mapa.
            </li>
          )}
        </ul>
      </div>
    );
  }

  async function handleSelectRoundTripPromotion(
    promotion: RoundTripPromotion,
  ): Promise<void> {
    setSubmitError(null);

    // Anakena y Terevaka son experiencias con reserva. Nunca salen como viaje
    // inmediato: se programan la ida y el regreso y se pagan con tarjeta.
    setRideMode("scheduled");
    setScheduledAt("");
    setReturnScheduledAt("");
    setPaymentMethod("card");
    setShowPaymentBox(false);
    setAirportWelcomeOption("none");
    setFlowerLeiQuantity(1);
    setFlightNumber("");
    setSelectedRoundTripPromotionId(promotion.id);
    setTripFareMode("round_trip");
    setOriginPoint(null);
    setOriginInput("");
    setOriginSuggestions([]);
    setDestInput(promotion.destinationName);
    setDestSuggestions([]);

    if (promotion.fixedPoint) {
      applyDestination(
        {
          ...promotion.fixedPoint,
          text: promotion.destinationName,
        },
        { keepRoundTripPromotion: true },
      );
      return;
    }

    try {
      const details = await geocodeTextExact(promotion.search);
      if (!details) {
        setDestinationPoint(null);
        return;
      }

      applyDestination(
        {
          ...details,
          text: promotion.destinationName,
        },
        { keepRoundTripPromotion: true },
      );
    } catch {
      setDestinationPoint(null);
    }
  }

  function clearRoundTripPromotion(): void {
    setSelectedRoundTripPromotionId(null);
    setTripFareMode("one_way");
    setScheduledAt("");
    setReturnScheduledAt("");
    setSubmitError(null);

    if (rideMode === "scheduled") {
      setOriginPoint({
        text: RAPA_NUI_AIRPORT_DESTINATION.text,
        address: RAPA_NUI_AIRPORT_DESTINATION.address,
        lat: RAPA_NUI_AIRPORT_DESTINATION.lat,
        lng: RAPA_NUI_AIRPORT_DESTINATION.lng,
        placeId: RAPA_NUI_AIRPORT_DESTINATION.placeId ?? null,
        originalLat: null,
        originalLng: null,
        walkMeters: 0,
        isAccessiblePickup: false,
      });
      setOriginInput(RAPA_NUI_AIRPORT_DESTINATION.text);
      setDestinationPoint(null);
      setDestInput("");
      setOriginSuggestions([]);
      setDestSuggestions([]);
    }
  }

  function selectRideModeNow(): void {
    setRideMode("now");
    setSelectedRoundTripPromotionId(null);
    setTripFareMode("one_way");
    setScheduledAt("");
    setReturnScheduledAt("");
    setAirportWelcomeOption("none");
    setFlowerLeiQuantity(1);
    setPaymentMethod(null);
    setShowPaymentBox(false);
    setOriginPoint(null);
    setDestinationPoint(null);
    setOriginInput("");
    setDestInput("");
    setOriginSuggestions([]);
    setDestSuggestions([]);
    setSubmitError(null);
  }

  function selectRideModeScheduled(): void {
    setRideMode("scheduled");
    setSelectedRoundTripPromotionId(null);
    setTripFareMode("one_way");
    setScheduledAt("");
    setReturnScheduledAt("");
    setPaymentMethod("card");
    setShowPaymentBox(false);
    setAirportWelcomeOption("none");
    setFlowerLeiQuantity(1);
    setFlightNumber("");
    applyRapaNuiAirportOrigin();
    setDestinationPoint(null);
    setDestInput("");
    setDestSuggestions([]);
    setSubmitError(null);
  }

  function handleUseCurrentLocation(): void {
    if (!navigator.geolocation) {
      setSubmitError(
        "Tu navegador no permite obtener ubicación. Puedes escribir el origen o elegirlo manualmente en el mapa.",
      );
      return;
    }

    setLocating(true);
    setSubmitError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        preSearchLocationService.remember(position);
        const gpsPoint = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          placeId: null,
        };

        /*
         * No confirmamos automáticamente.
         * Abrimos el mismo selector tipo Uber centrado en la ubicación real,
         * para que Rapa Go busque la calle accesible y el usuario confirme.
         */
        setOriginPoint({
          text: "Mi ubicación",
          address: "Ubicación GPS detectada",
          lat: gpsPoint.lat,
          lng: gpsPoint.lng,
          placeId: null,
          originalLat: gpsPoint.lat,
          originalLng: gpsPoint.lng,
          walkMeters: 0,
          isAccessiblePickup: false,
        });

        setOriginInput("Mi ubicación");
        setOriginSuggestions([]);
        setPickerAutoFocusSearch(false);
        setPickerTarget("origin");
        setLocating(false);
      },
      () => {
        setLocating(false);
        setSubmitError(
          "No se pudo obtener tu ubicación. Puedes activar el GPS, escribir una dirección o elegir otro punto en el mapa.",
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 30000,
      },
    );
  }

  async function resolveTypedPoints(): Promise<{
    origin: ConfirmedPoint | null;
    destination: ConfirmedPoint | null;
  }> {
    let resolvedOrigin = originPoint;
    let resolvedDestination = destinationPoint;

    if (isAirportScheduledRide) {
      resolvedOrigin = {
        text: RAPA_NUI_AIRPORT_DESTINATION.text,
        address: RAPA_NUI_AIRPORT_DESTINATION.address,
        lat: RAPA_NUI_AIRPORT_DESTINATION.lat,
        lng: RAPA_NUI_AIRPORT_DESTINATION.lng,
        placeId: RAPA_NUI_AIRPORT_DESTINATION.placeId ?? null,
        originalLat: null,
        originalLng: null,
        walkMeters: 0,
        isAccessiblePickup: false,
      };
      setOriginPoint(resolvedOrigin);
      setOriginInput(RAPA_NUI_AIRPORT_DESTINATION.text);
    }

    if (!resolvedOrigin && originInput.trim()) {
      const geocoded = await geocodeText(originInput.trim());

      if (geocoded) {
        resolvedOrigin = {
          text: geocoded.text,
          address: geocoded.address,
          lat: geocoded.lat,
          lng: geocoded.lng,
          placeId: geocoded.placeId ?? null,
          originalLat: geocoded.originalLat ?? null,
          originalLng: geocoded.originalLng ?? null,
          walkMeters: geocoded.walkMeters,
          isAccessiblePickup: geocoded.isAccessiblePickup,
        };
        setOriginPoint(resolvedOrigin);
      }
    }

    if (!resolvedDestination && destInput.trim()) {
      const geocoded = await geocodeTextExact(destInput.trim());

      if (geocoded) {
        resolvedDestination = {
          text: geocoded.text,
          address: geocoded.address,
          lat: geocoded.lat,
          lng: geocoded.lng,
          placeId: geocoded.placeId ?? null,
          originalLat: geocoded.originalLat ?? null,
          originalLng: geocoded.originalLng ?? null,
          walkMeters: geocoded.walkMeters,
          isAccessiblePickup: geocoded.isAccessiblePickup,
        };
        setDestinationPoint(resolvedDestination);
      }
    }

    return {
      origin: resolvedOrigin,
      destination: resolvedDestination,
    };
  }

  useEffect(() => {
    let cancelled = false;

    const refreshPendingCharges = () => {
      setPendingChargeRevision((current) => current + 1);

      if (!session?.accessToken) return;

      void fetchMyApprovedPolicyChargesForRequest(session.accessToken)
        .then((charges) => {
          if (!cancelled) {
            setBackendPendingPassengerCharges(charges);
          }
        })
        .catch(() => {
          // Conserva el respaldo local si el backend no está disponible.
        });
    };

    const handlePendingChargeStorage = (event: StorageEvent) => {
      if (!event.key || event.key === RAPAGO_PASSENGER_PENDING_CHARGES_KEY) {
        refreshPendingCharges();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshPendingCharges();
      }
    };

    refreshPendingCharges();

    window.addEventListener("storage", handlePendingChargeStorage);
    window.addEventListener(
      RAPAGO_PASSENGER_PENDING_CHARGE_EVENT,
      refreshPendingCharges as EventListener,
    );
    window.addEventListener(
      "rapago:admin-passenger-pending-charge-updated",
      refreshPendingCharges as EventListener,
    );
    window.addEventListener(
      "rapago:wallet-updated",
      refreshPendingCharges as EventListener,
    );
    window.addEventListener("focus", refreshPendingCharges);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.removeEventListener("storage", handlePendingChargeStorage);
      window.removeEventListener(
        RAPAGO_PASSENGER_PENDING_CHARGE_EVENT,
        refreshPendingCharges as EventListener,
      );
      window.removeEventListener(
        "rapago:admin-passenger-pending-charge-updated",
        refreshPendingCharges as EventListener,
      );
      window.removeEventListener(
        "rapago:wallet-updated",
        refreshPendingCharges as EventListener,
      );
      window.removeEventListener("focus", refreshPendingCharges);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [session?.user]);

  const normalizedFlowerLeiQuantity = Math.min(
    AIRPORT_FLOWER_LEI_MAX_QUANTITY,
    Math.max(1, Math.round(Number(flowerLeiQuantity) || 1)),
  );
  const airportWelcomeSurchargeClp =
    isAirportScheduledRide && airportWelcomeOption === "flower_lei"
      ? AIRPORT_FLOWER_LEI_SURCHARGE_CLP * normalizedFlowerLeiQuantity
      : 0;
  const hasAirportFlowerLei = airportWelcomeSurchargeClp > 0;
  const localPendingPassengerCharges =
    pendingChargeRevision >= 0
      ? readPassengerPendingChargesForRequest(session?.user)
      : [];
  const pendingPassengerCharges = mergePassengerPendingChargesForRequest(
    backendPendingPassengerCharges,
    localPendingPassengerCharges,
  );
  const pendingNoShowChargeTotalClp = pendingPassengerCharges
    .filter((charge) => isPassengerPendingChargeNoShow(charge.type))
    .reduce(
      (sum, charge) =>
        sum + Math.max(0, Math.round(Number(charge.amountClp ?? 0))),
      0,
    );
  const pendingCancellationChargeTotalClp = pendingPassengerCharges
    .filter((charge) => !isPassengerPendingChargeNoShow(charge.type))
    .reduce(
      (sum, charge) =>
        sum + Math.max(0, Math.round(Number(charge.amountClp ?? 0))),
      0,
    );
  const pendingPassengerChargeTotalClp =
    pendingNoShowChargeTotalClp + pendingCancellationChargeTotalClp;
  // El backend es la única autoridad del saldo disponible. Los registros
  // antiguos de LocalStorage no se suman ni se descuentan financieramente.
  const availableWalletBenefitTotalClp = backendWalletBenefitClp;
  const hasAvailableWalletBenefit = availableWalletBenefitTotalClp > 0;

  function getBaseSelectedFareAmount(
    method: PaymentMethod = paymentMethod,
  ): number | null {
    if (!method) return null;
    if (selectedRoundTripPromotion) return selectedRoundTripExperienceFareClp;
    if (!fareQuote) return null;
    return method === "card" ? fareQuote.cardFare : fareQuote.cashFare;
  }

  function addAirportWelcomeExtras(amount: number | null): number | null {
    if (amount == null) return null;
    return Math.max(0, Math.round(amount + airportWelcomeSurchargeClp));
  }

  function addPendingPassengerCharges(amount: number | null): number | null {
    if (amount == null) return null;
    return Math.max(0, Math.round(amount + pendingPassengerChargeTotalClp));
  }

  function applyWalletBenefitDiscount(amount: number | null): number | null {
    if (amount == null) return null;
    const discount = getWalletBenefitDiscountForAmount(amount);
    return Math.max(0, Math.round(amount - discount));
  }

  function getWalletBenefitDiscountForAmount(amount: number | null): number {
    if (
      amount == null ||
      useWalletBenefit !== true ||
      availableWalletBenefitTotalClp <= 0
    )
      return 0;
    return Math.min(
      Math.max(0, Math.round(amount)),
      availableWalletBenefitTotalClp,
    );
  }

  function getSelectedFareAmountBeforeWallet(
    method: PaymentMethod = paymentMethod,
  ): number | null {
    return addPendingPassengerCharges(
      addAirportWelcomeExtras(getBaseSelectedFareAmount(method)),
    );
  }

  function getSelectedWalletBenefitDiscount(
    method: PaymentMethod = paymentMethod,
  ): number {
    if (!method) return 0;
    return getWalletBenefitDiscountForAmount(
      getSelectedFareAmountBeforeWallet(method),
    );
  }

  const cashPaymentAmountBeforeWallet = addPendingPassengerCharges(
    addAirportWelcomeExtras(
      selectedRoundTripPromotion
        ? selectedRoundTripExperienceFareClp
        : fareQuote
          ? fareQuote.cashFare
          : null,
    ),
  );
  const cardPaymentAmountBeforeWallet = addPendingPassengerCharges(
    addAirportWelcomeExtras(
      selectedRoundTripPromotion
        ? selectedRoundTripExperienceFareClp
        : fareQuote
          ? fareQuote.cardFare
          : null,
    ),
  );
  const cashWalletBenefitDiscountClp = getWalletBenefitDiscountForAmount(
    cashPaymentAmountBeforeWallet,
  );
  const cardWalletBenefitDiscountClp = getWalletBenefitDiscountForAmount(
    cardPaymentAmountBeforeWallet,
  );
  const cashPaymentAmount = applyWalletBenefitDiscount(
    cashPaymentAmountBeforeWallet,
  );
  // El Beneficio se descuenta antes de enviar cualquier saldo restante a Klap.
  const cardPaymentAmount = applyWalletBenefitDiscount(
    cardPaymentAmountBeforeWallet,
  );

  function getPaymentLabel(method: PaymentMethod): string {
    if (method === "cash") {
      return cashPaymentAmount != null
        ? `Efectivo · ${formatCLP(cashPaymentAmount)}`
        : "Efectivo";
    }
    if (method === "card") {
      return cardPaymentAmount != null
        ? `Tarjeta · ${formatCLP(cardPaymentAmount)}`
        : "Tarjeta · Klap";
    }
    return "Pendiente";
  }

  const cashPaymentLabel =
    cashPaymentAmount != null ? formatCLP(cashPaymentAmount) : "Calculando";
  const cashPaymentUsdLabel =
    cashPaymentAmount != null
      ? formatUSDFromCLP(
          cashPaymentAmount,
          selectedRoundTripPromotion?.usdLabel
            ? fareRules.usdRate
            : fareQuote?.usdRate,
        )
      : "Calculando";

  const cardPaymentLabel =
    cardPaymentAmount != null ? formatCLP(cardPaymentAmount) : "Calculando";
  const cardPaymentUsdLabel =
    cardPaymentAmount != null
      ? formatUSDFromCLP(
          cardPaymentAmount,
          selectedRoundTripPromotion?.usdLabel
            ? fareRules.usdRate
            : fareQuote?.usdRate,
        )
      : "Calculando";

  const activePaymentAmountBeforeWallet =
    paymentMethod === "card"
      ? cardPaymentAmountBeforeWallet
      : paymentMethod === "cash"
        ? cashPaymentAmountBeforeWallet
        : null;
  const activeWalletBenefitDiscountClp =
    paymentMethod === "card"
      ? cardWalletBenefitDiscountClp
      : paymentMethod === "cash"
        ? cashWalletBenefitDiscountClp
        : 0;
  const activePaymentAmountAfterWallet =
    paymentMethod === "card"
      ? cardPaymentAmount
      : paymentMethod === "cash"
        ? cashPaymentAmount
        : null;

  function getSelectedFareAmount(
    method: PaymentMethod = paymentMethod,
  ): number | null {
    const beforeBenefit = getSelectedFareAmountBeforeWallet(method);
    return applyWalletBenefitDiscount(beforeBenefit);
  }

  function getSelectedDriverEarning(
    method: PaymentMethod = paymentMethod,
  ): number | null {
    // La ganancia del conductor se calcula sobre el viaje actual, no sobre deudas anteriores ni descuentos de billetera.
    const fare = addAirportWelcomeExtras(getBaseSelectedFareAmount(method));
    if (fare == null) return null;
    return Math.round((fare * fareRules.driverPercent) / 100);
  }

  const vehicleFareDisplayMethod: Exclude<PaymentMethod, null> =
    reservationRequiresCard || paymentMethod === "card" ? "card" : "cash";

  function getVehicleCategoryDisplayFare(
    category: VehicleCategory,
  ): number | null {
    if (selectedRoundTripPromotion) {
      return addPendingPassengerCharges(
        addAirportWelcomeExtras(
          calculateRoundTripExperienceFare(
            selectedRoundTripPromotion,
            category,
            fareRules,
          ),
        ),
      );
    }

    if (!fareQuote) return null;

    const categoryQuote = calculateRapaGoFare(
      fareQuote.km,
      fareQuote.minutes,
      fareRules,
      effectivePassengerFareType,
      category,
      destinationPoint?.text ?? destInput,
      effectiveTripFareMode,
    );

    return addPendingPassengerCharges(
      addAirportWelcomeExtras(
        vehicleFareDisplayMethod === "card"
          ? categoryQuote.cardFare
          : categoryQuote.cashFare,
      ),
    );
  }

  function getVehicleCategoryEtaLabel(category: VehicleCategory): string {
    const routeMinutes = selectedRoundTripPromotion ? 10 : fareQuote?.minutes;
    if (routeMinutes == null)
      return fareLoading ? "Calculando llegada" : "Llega pronto";

    const baseMinutes = Math.max(
      3,
      Math.min(9, Math.round(routeMinutes * 0.38)),
    );
    const categoryOffset =
      category === "xl"
        ? 2
        : category === "extra_luggage"
          ? 1
          : category === "comfort"
            ? 2
            : 0;

    return `Llega en ${baseMinutes + categoryOffset} min`;
  }

  /* Ya no hay panel que abrir ni cerrar: las dos formas de pago están siempre
     a la vista en su propio paso, así que sobra el estado que las plegaba. La
     regla de negocio —en reservas solo tarjeta— se queda igual. */
  function handleSelectPayment(method: Exclude<PaymentMethod, null>): void {
    if (reservationRequiresCard && method === "cash") {
      setPaymentMethod("card");
      setSubmitError(
        "Todas las reservas se pagan obligatoriamente con tarjeta/Klap. Sin conductor asignado la cancelación es gratuita; con conductor asignado tienes 1 minuto gratis y luego corresponde 30% con tope $3.000.",
      );
      return;
    }

    setPaymentMethod(method);
    setSubmitError(null);
  }

  async function handleRequest(): Promise<void> {
    if (!session?.accessToken) return;

    if (hasPassengerActiveRideForRequest(session.user)) {
      setSubmitError(
        "Ya tienes un viaje o una reserva activa reciente. Revisa Mis Viajes antes de solicitar otra.",
      );
      return;
    }

    const activePaymentMethod: PaymentMethod = paymentMethod;

    const resolved = await resolveTypedPoints();

    if (!resolved.origin || !resolved.destination) {
      setSubmitError("Origen y destino son requeridos.");
      return;
    }

    const scheduleError = getScheduleValidationError({
      rideMode,
      tripFareMode: effectiveTripFareMode,
      scheduledAt,
      returnScheduledAt,
      requireReturnScheduledAt,
      roundTripPromotionReturnOnly,
    });

    if (scheduleError) {
      setSubmitError(scheduleError);
      return;
    }

    if (
      activePaymentMethod !== "cash" &&
      String(activePaymentMethod) !== "card"
    ) {
      setShowPaymentBox(true);
      setSubmitError("Antes de solicitar el viaje debes elegir forma de pago.");
      return;
    }

    if (reservationRequiresCard && String(activePaymentMethod) !== "card") {
      setPaymentMethod("card");
      setShowPaymentBox(true);
      setSubmitError(
        "Todas las reservas deben pagarse obligatoriamente con tarjeta/Klap. Sin conductor asignado la cancelación es gratuita; con conductor asignado tienes 1 minuto gratis y luego corresponde 30% con tope $3.000.",
      );
      return;
    }

    if (hasAvailableWalletBenefit && useWalletBenefit === null) {
      setSubmitError(
        `Tienes ${formatCLP(availableWalletBenefitTotalClp)} a favor. Elige si quieres usar tu beneficio en este viaje.`,
      );
      return;
    }

    const selectedFareAmountBeforeWallet =
      getSelectedFareAmountBeforeWallet(activePaymentMethod);
    const selectedWalletBenefitDiscountClp =
      getSelectedWalletBenefitDiscount(activePaymentMethod);
    const selectedFareAmount = getSelectedFareAmount(activePaymentMethod);
    const selectedBaseFareAmount =
      getBaseSelectedFareAmount(activePaymentMethod);
    const selectedDriverEarning = getSelectedDriverEarning(activePaymentMethod);

    if (
      selectedFareAmount == null ||
      selectedFareAmount < 0 ||
      selectedFareAmountBeforeWallet == null
    ) {
      setSubmitError("No se pudo calcular el monto del viaje.");
      return;
    }

    const passengerNote = sanitizePassengerRideNote(notesInput);

    setPaymentMethod(activePaymentMethod);
    setShowPaymentBox(false);
    setSubmitting(true);
    setSubmitError(null);

    try {
      const notes: string[] = [];
      appendPassengerRideNote(notes, passengerNote);

      notes.push(
        `Forma de pago seleccionada: ${getPaymentLabel(activePaymentMethod)}.`,
      );
      if (reservationRequiresCard) {
        notes.push("Pago obligatorio para reservas: tarjeta/Klap.");
        notes.push(
          "Gestión reserva: el administrador designa conductor 30 minutos antes del inicio del servicio.",
        );
        notes.push(
          "Política cancelación: sin conductor asignado es gratis; desde 1 minuto después de la asignación se cobra 30% con tope $3.000.",
        );
        notes.push(
          "Si se cancela con tarjeta, Klap retiene el 100% al pedir el viaje. Sin conductor o dentro de 1 minuto se libera toda la retención. Después se captura min(30% tarifa, $3.000) y se libera el resto. No es un cobro inmediato ni un reembolso de Beneficios.",
        );
      }
      if (pendingPassengerChargeTotalClp > 0) {
        notes.push(
          `Cargo pendiente anterior por cancelación/no show aplicado al próximo viaje: ${formatCLP(pendingPassengerChargeTotalClp)}.`,
        );
        notes.push(
          `Total antes de beneficio billetera incluyendo cargo pendiente anterior: ${formatCLP(selectedFareAmountBeforeWallet)}.`,
        );
      }
      if (selectedWalletBenefitDiscountClp > 0) {
        notes.push(
          `Beneficio billetera usado en este viaje: ${formatCLP(selectedWalletBenefitDiscountClp)}.`,
        );
        notes.push(
          `Tarifa antes de beneficio billetera: ${formatCLP(selectedFareAmountBeforeWallet)}.`,
        );
        notes.push(
          `Total final con descuento beneficio: ${formatCLP(selectedFareAmount)}.`,
        );
      } else if (hasAvailableWalletBenefit && useWalletBenefit === false) {
        notes.push(
          `Beneficio billetera disponible no usado por el pasajero en este viaje: ${formatCLP(availableWalletBenefitTotalClp)}.`,
        );
      }
      notes.push(
        `Categoría de vehículo seleccionada: ${vehicleCategoryLabel(vehicleCategory)}.`,
      );
      notes.push(
        `Tipo de viaje seleccionado: ${tripFareModeLabel(effectiveTripFareMode)}.`,
      );
      if (selectedRoundTripPromotion) {
        notes.push(
          `Experiencia con reserva seleccionada: ${selectedRoundTripPromotion.destinationName}.`,
        );
        notes.push(
          `Destino reservado: ${selectedRoundTripPromotion.destinationName}.`,
        );
        notes.push(
          `Tarifa fija base de la experiencia: ${formatCLP(selectedRoundTripPromotion.baseFareClp)} (${selectedRoundTripPromotion.usdLabel}).`,
        );
        if (selectedBaseFareAmount != null) {
          notes.push(
            `Tarifa base antes de servicios opcionales: ${formatCLP(selectedBaseFareAmount)}.`,
          );
        }
        notes.push(
          `Tarifa RAPA GO calculada: ${formatCLP(selectedFareAmount)}.`,
        );
        notes.push(
          `Tarifa estimada pasajero: ${formatCLP(selectedFareAmount)}.`,
        );
        notes.push(
          `Ajuste de vehículo aplicado: ${vehicleCategoryLabel(vehicleCategory)} x ${(fareRules.vehicleMultipliers[vehicleCategory] ?? 1).toFixed(2)}.`,
        );
        notes.push(selectedRoundTripPromotion.detail);
      }

      const scheduleFields = buildRideScheduleFields({
        rideMode,
        tripFareMode: effectiveTripFareMode,
        scheduledAt,
        returnScheduledAt,
        scheduleKind: selectedRoundTripPromotion
          ? "round_trip_promotion"
          : "airport_pickup",
      });

      if (selectedRoundTripPromotion) {
        notes.push("Tipo de servicio: experiencia con reserva ida y vuelta.");
        notes.push("RAPAGO_RESERVATION_KIND: round_trip_experience.");
        notes.push(
          `Fecha y hora de ida reservada: ${formatScheduleDateTime(scheduledAt)}.`,
        );
        notes.push(
          `Fecha y hora de regreso reservada: ${formatScheduleDateTime(returnScheduledAt)}.`,
        );
        notes.push(
          `Destino de la experiencia: ${selectedRoundTripPromotion.destinationName}.`,
        );
        notes.push("La ida y el regreso pertenecen a la misma reserva.");
      }

      if (rideMode === "scheduled") {
        notes.push(
          `RAPAGO_SCHEDULED_AT: ${String(scheduleFields.scheduledAt ?? "")}.`,
        );
        notes.push(
          `RAPAGO_ACTIVATION_AT: ${String(scheduleFields.scheduleActivationAt ?? "")}.`,
        );
        notes.push(
          `Fecha y hora de recogida agendada: ${String(scheduleFields.scheduledAt ?? "")}.`,
        );
        notes.push(
          `Viaje agendado para: ${formatScheduleDateTime(String(scheduleFields.scheduledAt ?? scheduledAt))}.`,
        );
        notes.push(
          `La solicitud se activa automáticamente ${SCHEDULE_ACTIVATION_MINUTES} minutos antes: ${formatScheduleDateTime(String(scheduleFields.scheduleActivationAt ?? ""))}.`,
        );
        notes.push(
          `Reserva congelada para conductores hasta: ${String(scheduleFields.scheduleActivationAt ?? "")}.`,
        );
        if (selectedRoundTripPromotion) {
          notes.push("Tipo de reserva: experiencia ida y vuelta programada.");
          notes.push(
            `Experiencia reservada: ${selectedRoundTripPromotion.destinationName}.`,
          );
          notes.push("Recogida a elección del pasajero.");
          notes.push(
            "Gestión: administrador o asignación automática a conductor activo.",
          );
        } else {
          notes.push(`Tipo de reserva: recogida aeropuerto.`);
          notes.push("Pago obligatorio para reservas: tarjeta/Klap.");
          notes.push(
            "Política cancelación: sin conductor asignado es gratis; desde 1 minuto después de la asignación se cobra 30% con tope $3.000 y el saldo retenido restante debe liberarse por backend/Klap.",
          );
          notes.push(
            `Origen automático aeropuerto: ${RAPA_NUI_AIRPORT_DESTINATION.text}.`,
          );
          notes.push(
            `RAPAGO_AIRPORT_ORIGIN_LAT: ${RAPA_NUI_AIRPORT_DESTINATION.lat}.`,
          );
          notes.push(
            `RAPAGO_AIRPORT_ORIGIN_LNG: ${RAPA_NUI_AIRPORT_DESTINATION.lng}.`,
          );
        }

        if (effectiveTripFareMode === "round_trip" && returnScheduledAt) {
          notes.push(
            `RAPAGO_RETURN_SCHEDULED_AT: ${String(scheduleFields.returnScheduledAt ?? "")}.`,
          );
          notes.push(
            `Fecha y hora de regreso agendada: ${String(scheduleFields.returnScheduledAt ?? "")}.`,
          );
          notes.push(
            `Regreso agendado para: ${formatScheduleDateTime(String(scheduleFields.returnScheduledAt ?? returnScheduledAt))}.`,
          );
        }

        if (!selectedRoundTripPromotion && flightNumber.trim()) {
          notes.push(`Número de vuelo: ${flightNumber.trim()}.`);
        }

        if (selectedRoundTripPromotion) {
          notes.push(
            "Servicio de aeropuerto: no aplica para esta experiencia.",
          );
        } else if (airportWelcomeOption === "flower_lei") {
          notes.push(
            `Recibimiento aeropuerto: ${AIRPORT_FLOWER_LEI_LABEL} solicitado.`,
          );
          notes.push(
            `Admin debe gestionar el collar de flores para la llegada del pasajero en Mataveri.`,
          );
          notes.push(
            `Recargo recibimiento ${AIRPORT_FLOWER_LEI_LABEL}: ${formatCLP(AIRPORT_FLOWER_LEI_SURCHARGE_CLP)}.`,
          );
          notes.push(
            `Total final con recibimiento: ${formatCLP(selectedFareAmount)}.`,
          );
        } else {
          notes.push("Recibimiento aeropuerto: solo recogida.");
        }
      }

      notes.push(
        `Nombre origen visible para conductor: ${resolved.origin.text}.`,
      );
      notes.push(
        `Nombre destino visible para conductor: ${resolved.destination.text}.`,
      );
      notes.push(`RAPAGO_ORIGIN_DISPLAY: ${resolved.origin.text}.`);
      notes.push(`RAPAGO_DESTINATION_DISPLAY: ${resolved.destination.text}.`);
      notes.push(`Dirección origen confirmada: ${resolved.origin.address}.`);
      notes.push(
        `Dirección destino confirmada: ${resolved.destination.address}.`,
      );

      if (
        resolved.origin.originalLat != null &&
        resolved.origin.originalLng != null &&
        resolved.origin.walkMeters != null &&
        resolved.origin.walkMeters > 8
      ) {
        notes.push(
          `Punto accesible de recogida ajustado a calle. El pasajero debe caminar aprox. ${resolved.origin.walkMeters} m.`,
        );
      }

      notes.push(
        `Coordenadas recogida accesible: ${resolved.origin.lat.toFixed(6)}, ${resolved.origin.lng.toFixed(6)}.`,
      );
      notes.push(
        `Coordenadas destino accesible: ${resolved.destination.lat.toFixed(6)}, ${resolved.destination.lng.toFixed(6)}.`,
      );

      if (
        !selectedRoundTripPromotion &&
        fareQuote &&
        selectedFareAmount != null
      ) {
        if (selectedBaseFareAmount != null && airportWelcomeSurchargeClp > 0) {
          notes.push(
            `Tarifa base antes de servicios opcionales: ${formatCLP(selectedBaseFareAmount)}.`,
          );
        }
        notes.push(
          `Tarifa RAPA GO calculada: ${formatCLP(selectedFareAmount)}.`,
        );
        notes.push(
          `Tarifa estimada pasajero: ${formatCLP(selectedFareAmount)}.`,
        );
        notes.push(
          `Ajuste de vehículo aplicado: ${vehicleCategoryLabel(vehicleCategory)} x ${(fareRules.vehicleMultipliers[vehicleCategory] ?? 1).toFixed(2)}.`,
        );
        notes.push(`Distancia estimada: ${fareQuote.km.toFixed(1)} km.`);
        notes.push(`Duración estimada: ${fareQuote.minutes} min.`);
        notes.push(
          `Tipo de cálculo tarifario: ${fareQuote.calculationType === "fixed" ? "tarifa fija" : fareQuote.ruralKm > 0 ? "urbano/rural" : "urbano"}.`,
        );
        notes.push(
          `Tipo de viaje tarifario: ${tripFareModeLabel(effectiveTripFareMode)}.`,
        );
        notes.push(
          `Tipo de pasajero tarifario: ${passengerFareTypeLabel(fareQuote.passengerFareType)}.`,
        );
        if (fareQuote.tripMultiplier > 1) {
          notes.push(
            `Ida y vuelta variable: tarifa ida ${formatCLP(fareQuote.oneWayFare)} x ${fareQuote.tripMultiplier}.`,
          );
        }
        notes.push(
          `Tramo urbano calculado: ${fareQuote.urbanKm.toFixed(1)} km hasta límite ${fareQuote.urbanLimitKm.toFixed(1)} km.`,
        );
        if (fareQuote.ruralKm > 0) {
          notes.push(
            `Tramo rural calculado: ${fareQuote.ruralKm.toFixed(1)} km con descuento rural ${fareQuote.ruralDiscountPercent}%.`,
          );
          notes.push(
            `KM urbano ajustado: ${formatCLP(fareQuote.urbanKmFare)}. KM rural corregido: ${formatCLP(fareQuote.ruralKmFare)}.`,
          );
        }
        if (selectedDriverEarning != null) {
          notes.push(
            `Ganancia estimada conductor: ${formatCLP(selectedDriverEarning)}.`,
          );
        }
      }

      const input: CreateRideInput = {
        originText: resolved.origin.text,
        destinationText: resolved.destination.text,
      };

      if (selectedFareAmount != null) {
        (
          input as CreateRideInput & {
            estimatedFareClp?: number;
            passengerFareType?: PassengerFareType;
            farePassengerType?: PassengerFareType;
            fareVehicleCategory?: VehicleCategory;
            vehicleCategory?: VehicleCategory;
            paymentMethod?: string;
            tripFareMode?: TripFareMode;
            tripType?: string;
            isRoundTrip?: boolean;
          }
        ).estimatedFareClp = Math.max(
          0,
          Math.round(
            (selectedFareAmountBeforeWallet ?? 0) -
              pendingPassengerChargeTotalClp -
              airportWelcomeSurchargeClp,
          ),
        );
        (
          input as CreateRideInput & {
            passengerFareType?: PassengerFareType;
            farePassengerType?: PassengerFareType;
          }
        ).passengerFareType = effectivePassengerFareType;
        (
          input as CreateRideInput & {
            passengerFareType?: PassengerFareType;
            farePassengerType?: PassengerFareType;
          }
        ).farePassengerType = effectivePassengerFareType;
        (
          input as CreateRideInput & {
            passengerFareLabel?: string;
            nationality?: string;
            isResident?: boolean;
            requestedByRole?: string;
            requesterRole?: string;
          }
        ).passengerFareLabel = passengerFareTypeLabel(
          effectivePassengerFareType,
        );
        (
          input as CreateRideInput & {
            passengerFareLabel?: string;
            nationality?: string;
            isResident?: boolean;
            requestedByRole?: string;
            requesterRole?: string;
          }
        ).nationality = passengerFareTypeLabel(effectivePassengerFareType);
        (
          input as CreateRideInput & {
            passengerFareLabel?: string;
            nationality?: string;
            isResident?: boolean;
            requestedByRole?: string;
            requesterRole?: string;
          }
        ).isResident = effectivePassengerFareType === "resident";
        (
          input as CreateRideInput & {
            requestedByRole?: string;
            requesterRole?: string;
          }
        ).requestedByRole = "passenger";
        (
          input as CreateRideInput & {
            requestedByRole?: string;
            requesterRole?: string;
          }
        ).requesterRole = "passenger";
        (
          input as CreateRideInput & {
            fareVehicleCategory?: VehicleCategory;
            vehicleCategory?: VehicleCategory;
            requestedVehicleCategory?: string;
          }
        ).fareVehicleCategory = vehicleCategory;
        (
          input as CreateRideInput & {
            fareVehicleCategory?: VehicleCategory;
            vehicleCategory?: VehicleCategory;
            requestedVehicleCategory?: string;
          }
        ).vehicleCategory = vehicleCategory;
        (
          input as CreateRideInput & {
            requestedVehicleCategory?: string;
          }
        ).requestedVehicleCategory = vehicleCategory;
        (input as CreateRideInput & { paymentMethod?: string }).paymentMethod =
          activePaymentMethod;
        (
          input as CreateRideInput & { paymentProvider?: string | null }
        ).paymentProvider = activePaymentMethod === "card" ? "klap" : null;
        // Klap deferred capture:
        // Cancellation/no-show amounts are calculated and settled by backend.
        // Do not send passengerPendingChargeClp or finalFareWithPendingChargesClp from frontend.
        // El frontend solo expresa la decisión. El backend bloquea la cuenta,
        // verifica el saldo y calcula el monto real a consumir.
        input.useWalletBenefit = useWalletBenefit === true;
        (
          input as CreateRideInput & { tripFareMode?: TripFareMode }
        ).tripFareMode = effectiveTripFareMode;
        (input as CreateRideInput & { tripType?: string }).tripType =
          effectiveTripFareMode;
        (input as CreateRideInput & { isRoundTrip?: boolean }).isRoundTrip =
          effectiveTripFareMode === "round_trip";
      }

      // Conservador: no enviamos un campo nuevo que el backend todavía podría
      // rechazar. La nota viaja dentro de `notes` con marcadores explícitos.
      Object.assign(
        input as CreateRideInput & Record<string, unknown>,
        scheduleFields,
      );
      if (isAirportScheduledRide) {
        Object.assign(input as CreateRideInput & Record<string, unknown>, {
          airportWelcomeOption,
          airportWelcomeLabel: hasAirportFlowerLei
            ? AIRPORT_FLOWER_LEI_LABEL
            : "Solo recogida",
          flowerLeiRequested: hasAirportFlowerLei,
          flowerLeiQuantity: hasAirportFlowerLei
            ? normalizedFlowerLeiQuantity
            : null,
          flowerLeiSurchargeClp: airportWelcomeSurchargeClp,
          airportWelcomeSurchargeClp,
          optionalServicesTotalClp: airportWelcomeSurchargeClp,
          baseFareBeforeExtrasClp: selectedBaseFareAmount,
          finalFareWithExtrasClp: selectedFareAmount,
          airportReservationRequiresCard: isAirportScheduledRide,
          reservationRequiresCard: reservationRequiresCard,
          paymentRequiredProvider: "klap",
          cardCancellationCreditToWallet: false,
          cardCancellationAdminReviewRequired: false,
          cardCancellationCreditName: null,
        });
      } else if (selectedRoundTripPromotion) {
        Object.assign(input as CreateRideInput & Record<string, unknown>, {
          roundTripPromotionId: selectedRoundTripPromotion.id,
          roundTripPromotionTitle: selectedRoundTripPromotion.title,
          roundTripPromotionDestination:
            selectedRoundTripPromotion.destinationName,
          roundTripPromotionBooking: true,
          roundTripExperienceBooking: true,
          reservationKind: "round_trip_experience",
          roundTripOutboundNow: false,
          roundTripReturnOnly: false,
          roundTripReturnPickupRequested: true,
          roundTripReturnPickupAt: returnScheduledAt,
          reservationRequiresCard: true,
          paymentRequiredProvider: "klap",
          adminAssignmentMode: "manual_or_automatic_active_driver",
          frozenForDrivers: true,
          baseFareBeforeExtrasClp: selectedBaseFareAmount,
          finalFareWithExtrasClp: selectedFareAmount,
        });
      }

      if (notes.length > 0) {
        input.notes = limitRideNotes(notes.join(" "));
      }

      const createdRideResponse = await ridesService.createRideRequest(
        session.accessToken,
        input,
      );
      preSearchLocationService.clear();

      const createdRideId =
        extractRideRequestIdFromResponse(createdRideResponse);
      const appliedBenefitClp = Math.max(
        0,
        Math.round(Number(createdRideResponse.walletBenefitAppliedClp ?? 0)),
      );

      if (appliedBenefitClp > 0) {
        setBackendWalletBenefitClp(
          Math.max(
            0,
            Math.round(
              Number(createdRideResponse.walletBenefitRemainingClp ?? 0),
            ),
          ),
        );
        setWalletBenefitRevision((current) => current + 1);
        window.dispatchEvent(
          new CustomEvent("rapago:wallet-updated", {
            detail: {
              rideId: createdRideId,
              appliedBenefitClp,
              remainingBenefitClp:
                createdRideResponse.walletBenefitRemainingClp ?? 0,
            },
          }),
        );
      }

      // Los espejos locales de reservas quedan diferidos. Con tarjeta no se
      // publican en admin/conductor hasta que el webhook apruebe el pago.
      // Las experiencias de ida y vuelta se guardan como una sola reserva,
      // vinculando scheduledAt y scheduledReturnAt.
      const pendingScheduledRide =
        rideMode === "scheduled"
          ? createLocalAdminScheduledRide({
              originText: resolved.origin.text,
              destinationText: resolved.destination.text,
              notes: input.notes ?? null,
              passengerNote: passengerNote || null,
              estimatedFareClp: selectedFareAmount ?? null,
              rideMode,
              tripFareMode: effectiveTripFareMode,
              scheduledAt,
              returnScheduledAt,
              scheduleKind: selectedRoundTripPromotion
                ? "round_trip_promotion"
                : "airport_pickup",
              passengerName: getSessionDisplayName(session.user),
              passengerEmail: getSessionEmail(session.user),
              passengerFareType: effectivePassengerFareType,
              passengerFareLabel: passengerFareTypeLabel(
                effectivePassengerFareType,
              ),
              airportWelcomeOption:
                rideMode === "scheduled" ? airportWelcomeOption : null,
              airportWelcomeLabel: hasAirportFlowerLei
                ? AIRPORT_FLOWER_LEI_LABEL
                : "Solo recogida",
              flowerLeiRequested: hasAirportFlowerLei,
              airportWelcomeSurchargeClp,
              optionalServicesTotalClp: airportWelcomeSurchargeClp,
              baseFareBeforeExtrasClp: selectedBaseFareAmount,
              backendCancellationReviewRequired:
                pendingPassengerChargeTotalClp > 0,
              localStorageFinancialAuthority: false,
              walletBenefitRequested: selectedWalletBenefitDiscountClp > 0,
              walletBenefitApplied: selectedWalletBenefitDiscountClp > 0,
              walletBenefitAppliedClp: selectedWalletBenefitDiscountClp,
              walletBenefitDiscountClp: selectedWalletBenefitDiscountClp,
              walletBenefitOriginalFareClp: selectedFareAmountBeforeWallet,
              originalFareBeforeWalletBenefitClp:
                selectedFareAmountBeforeWallet,
              finalFareAfterWalletBenefitClp: selectedFareAmount,
              walletBenefitAvailableButNotUsedClp:
                hasAvailableWalletBenefit && useWalletBenefit === false
                  ? availableWalletBenefitTotalClp
                  : 0,
            } as Parameters<typeof createLocalAdminScheduledRide>[0] &
              Record<string, unknown>)
          : null;

      if (String(activePaymentMethod) === "card" && selectedFareAmount > 0) {
        if (!createdRideId) {
          throw new Error(
            "El viaje se creó, pero no se pudo obtener el ID para iniciar Klap.",
          );
        }

        const order = await createKlapHostedOrder(
          session.accessToken,
          createdRideId,
        );

        if (pendingPassengerChargeTotalClp > 0) {
          markPassengerPendingChargesAppliedToRide(session.user, createdRideId);
        }

        const pendingKlapPayment: PendingKlapPaymentRecord = {
          rideRequestId: createdRideId,
          paymentId: order.paymentId,
          orderId: order.publicCheckoutData.orderId,
          redirectUrl: order.publicCheckoutData.redirectUrl,
          amountClp: selectedFareAmount,
          provider: "klap",
          createdAt: new Date().toISOString(),
          originText: resolved.origin.text,
          destinationText: resolved.destination.text,
          scheduledRideMirror: pendingScheduledRide
            ? {
                ...pendingScheduledRide,
                serverRideId: createdRideId,
                originalRideId: createdRideId,
                paymentStatus: "pending",
                paymentProvider: "klap",
              }
            : null,
        };

        const redirectUrl = String(pendingKlapPayment.redirectUrl ?? "").trim();
        if (!redirectUrl) {
          throw new Error(
            "Klap no entregó el enlace seguro de pago para esta orden.",
          );
        }

        // Flujo directo: el botón de pago abre inmediatamente el Checkout
        // oficial alojado por Klap. No mostramos un modal intermedio de RAPA GO.
        const startedPayment =
          markPendingKlapPaymentStarted(pendingKlapPayment);
        openKlapHostedCheckout(
          String(startedPayment.redirectUrl ?? redirectUrl),
        );
        return;
      }

      if (pendingScheduledRide) {
        upsertLocalAdminScheduledRide(pendingScheduledRide);
      }

      if (pendingPassengerChargeTotalClp > 0) {
        markPassengerPendingChargesAppliedToRide(session.user, createdRideId);
      }

      setOriginPoint(null);
      setDestinationPoint(null);
      setOriginInput("");
      setDestInput("");
      setNotesInput("");
      setScheduledAt("");
      setReturnScheduledAt("");
      setFlightNumber("");
      setAirportWelcomeOption("none");
      setFlowerLeiQuantity(1);
      setOriginSuggestions([]);
      setDestSuggestions([]);
      setRideMode("now");
      setTripFareMode("one_way");
      setSelectedRoundTripPromotionId(null);
      setPaymentMethod(null);
      setShowPaymentBox(false);
      setVehicleCategory("standard");
      setUseWalletBenefit(null);

      goToTripsAfterRequest(createdRideId);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Error al solicitar el viaje.";
      const normalizedMessage = message.toLowerCase();

      if (
        normalizedMessage.includes("legal_acceptance_required") ||
        normalizedMessage.includes("documentos legales requeridos") ||
        normalizedMessage.includes("debes aceptar los documentos legales")
      ) {
        setSubmitError(
          "Debes aceptar los documentos legales vigentes antes de solicitar un viaje. Te llevaremos a tu Perfil.",
        );
        window.setTimeout(() => {
          history.push(`${ROUTES.PASSENGER.PROFILE}?legal=required`);
        }, 500);
        return;
      }

      if (isPassengerRolePermissionMessage(message)) {
        if (String(activePaymentMethod) === "card") {
          setSubmitError(
            "Para pagar con tarjeta debes estar conectado como pasajero real en la API. Inicia sesión de nuevo y vuelve a intentar.",
          );
          return;
        }

        const localNotes: string[] = [];
        appendPassengerRideNote(localNotes, passengerNote);

        localNotes.push(
          `Forma de pago seleccionada: ${getPaymentLabel(activePaymentMethod)}.`,
        );
        if (reservationRequiresCard) {
          localNotes.push("Pago obligatorio para reservas: tarjeta/Klap.");
          localNotes.push(
            "Gestión reserva: el administrador designa conductor 30 minutos antes del inicio del servicio.",
          );
          localNotes.push(
            "Política cancelación: sin conductor asignado es gratis; desde 1 minuto después de la asignación se cobra 30% con tope $3.000.",
          );
          localNotes.push(
            "Si se cancela con tarjeta, Klap retiene el 100% al pedir el viaje. Sin conductor o dentro de 1 minuto se libera toda la retención. Después se captura min(30% tarifa, $3.000) y se libera el resto. No es un cobro inmediato ni un reembolso de Beneficios.",
          );
        }
        if (pendingPassengerChargeTotalClp > 0) {
          localNotes.push(
            `Cargo pendiente anterior por cancelación/no show aplicado al próximo viaje: ${formatCLP(pendingPassengerChargeTotalClp)}.`,
          );
          localNotes.push(
            `Total antes de beneficio billetera incluyendo cargo pendiente anterior: ${formatCLP(selectedFareAmountBeforeWallet)}.`,
          );
        }
        if (selectedWalletBenefitDiscountClp > 0) {
          localNotes.push(
            `Beneficio billetera usado en este viaje: ${formatCLP(selectedWalletBenefitDiscountClp)}.`,
          );
          localNotes.push(
            `Tarifa antes de beneficio billetera: ${formatCLP(selectedFareAmountBeforeWallet)}.`,
          );
          localNotes.push(
            `Total final con descuento beneficio: ${formatCLP(selectedFareAmount)}.`,
          );
        } else if (hasAvailableWalletBenefit && useWalletBenefit === false) {
          localNotes.push(
            `Beneficio billetera disponible no usado por el pasajero en este viaje: ${formatCLP(availableWalletBenefitTotalClp)}.`,
          );
        }
        localNotes.push(
          `Categoría de vehículo seleccionada: ${vehicleCategoryLabel(vehicleCategory)}.`,
        );
        localNotes.push(
          `Tipo de viaje seleccionado: ${tripFareModeLabel(effectiveTripFareMode)}.`,
        );
        if (selectedRoundTripPromotion) {
          localNotes.push(
            `Experiencia con reserva seleccionada: ${selectedRoundTripPromotion.destinationName}.`,
          );
          localNotes.push(
            `Destino reservado: ${selectedRoundTripPromotion.destinationName}.`,
          );
          localNotes.push(
            `Tarifa fija base de la experiencia: ${formatCLP(selectedRoundTripPromotion.baseFareClp)} (${selectedRoundTripPromotion.usdLabel}).`,
          );
          localNotes.push(
            `Tarifa RAPA GO calculada: ${formatCLP(selectedFareAmount)}.`,
          );
          localNotes.push(
            `Tarifa estimada pasajero: ${formatCLP(selectedFareAmount)}.`,
          );
          localNotes.push(
            `Ajuste de vehículo aplicado: ${vehicleCategoryLabel(vehicleCategory)} x ${(fareRules.vehicleMultipliers[vehicleCategory] ?? 1).toFixed(2)}.`,
          );
          localNotes.push(selectedRoundTripPromotion.detail);
        }

        const localScheduleFields = buildRideScheduleFields({
          rideMode,
          tripFareMode: effectiveTripFareMode,
          scheduledAt,
          returnScheduledAt,
          scheduleKind: selectedRoundTripPromotion
            ? "round_trip_promotion"
            : "airport_pickup",
        });

        if (selectedRoundTripPromotion) {
          localNotes.push(
            "Tipo de servicio: experiencia con reserva ida y vuelta.",
          );
          localNotes.push("RAPAGO_RESERVATION_KIND: round_trip_experience.");
          localNotes.push(
            `Fecha y hora de ida reservada: ${formatScheduleDateTime(scheduledAt)}.`,
          );
          localNotes.push(
            `Fecha y hora de regreso reservada: ${formatScheduleDateTime(returnScheduledAt)}.`,
          );
          localNotes.push(
            `Destino de la experiencia: ${selectedRoundTripPromotion.destinationName}.`,
          );
          localNotes.push("La ida y el regreso pertenecen a la misma reserva.");
        }

        if (rideMode === "scheduled") {
          localNotes.push(
            `RAPAGO_SCHEDULED_AT: ${String(localScheduleFields.scheduledAt ?? "")}.`,
          );
          localNotes.push(
            `RAPAGO_ACTIVATION_AT: ${String(localScheduleFields.scheduleActivationAt ?? "")}.`,
          );
          localNotes.push(
            `Fecha y hora de recogida agendada: ${String(localScheduleFields.scheduledAt ?? "")}.`,
          );
          localNotes.push(
            `Viaje agendado para: ${formatScheduleDateTime(String(localScheduleFields.scheduledAt ?? scheduledAt))}.`,
          );
          localNotes.push(
            `La solicitud se activa automáticamente ${SCHEDULE_ACTIVATION_MINUTES} minutos antes: ${formatScheduleDateTime(String(localScheduleFields.scheduleActivationAt ?? ""))}.`,
          );
          localNotes.push(
            `Reserva congelada para conductores hasta: ${String(localScheduleFields.scheduleActivationAt ?? "")}.`,
          );
          if (selectedRoundTripPromotion) {
            localNotes.push(
              "Tipo de reserva: experiencia ida y vuelta programada.",
            );
            localNotes.push(
              `Experiencia reservada: ${selectedRoundTripPromotion.destinationName}.`,
            );
            localNotes.push("Recogida a elección del pasajero.");
            localNotes.push(
              "Gestión: administrador o asignación automática a conductor activo.",
            );
          } else {
            localNotes.push(`Tipo de reserva: recogida aeropuerto.`);
            localNotes.push("Pago obligatorio para reservas: tarjeta/Klap.");
            localNotes.push(
              "Política cancelación: sin conductor asignado es gratis; desde 1 minuto después de la asignación se cobra 30% con tope $3.000 y el saldo retenido restante debe liberarse por backend/Klap.",
            );
            localNotes.push(
              `Origen automático aeropuerto: ${RAPA_NUI_AIRPORT_DESTINATION.text}.`,
            );
            localNotes.push(
              `RAPAGO_AIRPORT_ORIGIN_LAT: ${RAPA_NUI_AIRPORT_DESTINATION.lat}.`,
            );
            localNotes.push(
              `RAPAGO_AIRPORT_ORIGIN_LNG: ${RAPA_NUI_AIRPORT_DESTINATION.lng}.`,
            );
          }

          if (effectiveTripFareMode === "round_trip" && returnScheduledAt) {
            localNotes.push(
              `RAPAGO_RETURN_SCHEDULED_AT: ${String(localScheduleFields.returnScheduledAt ?? "")}.`,
            );
            localNotes.push(
              `Fecha y hora de regreso agendada: ${String(localScheduleFields.returnScheduledAt ?? "")}.`,
            );
            localNotes.push(
              `Regreso agendado para: ${formatScheduleDateTime(String(localScheduleFields.returnScheduledAt ?? returnScheduledAt))}.`,
            );
          }

          if (!selectedRoundTripPromotion && flightNumber.trim()) {
            localNotes.push(`Número de vuelo: ${flightNumber.trim()}.`);
          }

          if (selectedRoundTripPromotion) {
            localNotes.push(
              "Servicio de aeropuerto: no aplica para esta experiencia.",
            );
          } else if (airportWelcomeOption === "flower_lei") {
            localNotes.push(
              `Recibimiento aeropuerto: ${AIRPORT_FLOWER_LEI_LABEL} solicitado.`,
            );
            localNotes.push(
              `Admin debe gestionar el collar de flores para la llegada del pasajero en Mataveri.`,
            );
            localNotes.push(
              `Recargo recibimiento ${AIRPORT_FLOWER_LEI_LABEL}: ${formatCLP(AIRPORT_FLOWER_LEI_SURCHARGE_CLP)}.`,
            );
            localNotes.push(
              `Total final con recibimiento: ${formatCLP(selectedFareAmount)}.`,
            );
          } else {
            localNotes.push("Recibimiento aeropuerto: solo recogida.");
          }
        }

        localNotes.push(
          `Dirección origen confirmada: ${resolved.origin.address}.`,
        );
        localNotes.push(
          `Dirección destino confirmada: ${resolved.destination.address}.`,
        );

        if (
          resolved.origin.originalLat != null &&
          resolved.origin.originalLng != null &&
          resolved.origin.walkMeters != null &&
          resolved.origin.walkMeters > 8
        ) {
          localNotes.push(
            `Punto accesible de recogida ajustado a calle. El pasajero debe caminar aprox. ${resolved.origin.walkMeters} m.`,
          );
        }

        localNotes.push(
          `Coordenadas recogida accesible: ${resolved.origin.lat.toFixed(6)}, ${resolved.origin.lng.toFixed(6)}.`,
        );
        localNotes.push(
          `Coordenadas destino accesible: ${resolved.destination.lat.toFixed(6)}, ${resolved.destination.lng.toFixed(6)}.`,
        );

        if (
          !selectedRoundTripPromotion &&
          fareQuote &&
          selectedFareAmount != null
        ) {
          if (
            selectedBaseFareAmount != null &&
            airportWelcomeSurchargeClp > 0
          ) {
            localNotes.push(
              `Tarifa base antes de servicios opcionales: ${formatCLP(selectedBaseFareAmount)}.`,
            );
          }
          localNotes.push(
            `Tarifa RAPA GO calculada: ${formatCLP(selectedFareAmount)}.`,
          );
          localNotes.push(
            `Tarifa estimada pasajero: ${formatCLP(selectedFareAmount)}.`,
          );
          localNotes.push(`Distancia estimada: ${fareQuote.km.toFixed(1)} km.`);
          localNotes.push(`Duración estimada: ${fareQuote.minutes} min.`);
          localNotes.push(
            `Tipo de viaje tarifario: ${tripFareModeLabel(effectiveTripFareMode)}.`,
          );
          localNotes.push(
            `Tipo de pasajero tarifario: ${passengerFareTypeLabel(fareQuote.passengerFareType)}.`,
          );
          if (fareQuote.tripMultiplier > 1) {
            localNotes.push(
              `Ida y vuelta variable: tarifa ida ${formatCLP(fareQuote.oneWayFare)} x ${fareQuote.tripMultiplier}.`,
            );
          }

          if (selectedDriverEarning != null) {
            localNotes.push(
              `Ganancia estimada conductor: ${formatCLP(selectedDriverEarning)}.`,
            );
          }
        }

        const localRide = {
          ...createLocalPassengerRide({
            originText: resolved.origin.text,
            destinationText: resolved.destination.text,
            notes: limitRideNotes(localNotes.join(" ")),
            passengerNote: passengerNote || null,
            estimatedFareClp: selectedFareAmount ?? null,
            rideMode,
            tripFareMode: effectiveTripFareMode,
            scheduledAt,
            returnScheduledAt,
            scheduleKind: selectedRoundTripPromotion
              ? "round_trip_promotion"
              : "airport_pickup",
            passengerName: getSessionDisplayName(session.user),
            passengerEmail: getSessionEmail(session.user),
            passengerFareType: effectivePassengerFareType,
            passengerFareLabel: passengerFareTypeLabel(
              effectivePassengerFareType,
            ),
            airportWelcomeOption:
              rideMode === "scheduled" ? airportWelcomeOption : null,
            airportWelcomeLabel: hasAirportFlowerLei
              ? AIRPORT_FLOWER_LEI_LABEL
              : "Solo recogida",
            flowerLeiRequested: hasAirportFlowerLei,
            flowerLeiQuantity: hasAirportFlowerLei
              ? normalizedFlowerLeiQuantity
              : null,
            airportWelcomeSurchargeClp,
            optionalServicesTotalClp: airportWelcomeSurchargeClp,
            baseFareBeforeExtrasClp: selectedBaseFareAmount,
          }),
          backendCancellationReviewRequired: pendingPassengerChargeTotalClp > 0,
          localStorageFinancialAuthority: false,
          walletBenefitRequested: selectedWalletBenefitDiscountClp > 0,
          walletBenefitApplied: selectedWalletBenefitDiscountClp > 0,
          walletBenefitAppliedClp: selectedWalletBenefitDiscountClp,
          walletBenefitDiscountClp: selectedWalletBenefitDiscountClp,
          walletBenefitOriginalFareClp: selectedFareAmountBeforeWallet,
          originalFareBeforeWalletBenefitClp: selectedFareAmountBeforeWallet,
          finalFareAfterWalletBenefitClp: selectedFareAmount,
          walletBenefitAvailableButNotUsedClp:
            hasAvailableWalletBenefit && useWalletBenefit === false
              ? availableWalletBenefitTotalClp
              : 0,
          tripFareMode: effectiveTripFareMode,
          tripType: effectiveTripFareMode,
          isRoundTrip: effectiveTripFareMode === "round_trip",
          roundTripPromotionBooking: Boolean(selectedRoundTripPromotion),
          roundTripOutboundNow: false,
          roundTripReturnPickupRequested: Boolean(
            selectedRoundTripPromotion && returnScheduledAt,
          ),
          roundTripReturnPickupAt: selectedRoundTripPromotion
            ? returnScheduledAt
            : null,
          airportReservationRequiresCard: isAirportScheduledRide,
          reservationRequiresCard: reservationRequiresCard,
          paymentRequiredProvider: reservationRequiresCard ? "klap" : null,
          cardCancellationCreditToWallet: false,
          cardCancellationAdminReviewRequired: false,
          cardCancellationCreditName: null,
        } as LocalPassengerRideData;

        saveLocalPassengerRides([localRide, ...readLocalPassengerRides()]);

        if (pendingPassengerChargeTotalClp > 0) {
          markPassengerPendingChargesAppliedToRide(
            session.user,
            String(localRide.id ?? `local-${Date.now()}`),
          );
        }

        if (selectedWalletBenefitDiscountClp > 0) {
          markPassengerWalletBenefitsUsedForRide({
            user: session.user,
            rideId: String(localRide.id ?? `local-${Date.now()}`),
            amountToUseClp: selectedWalletBenefitDiscountClp,
            originText: resolved.origin.text,
            destinationText: resolved.destination.text,
            fareBeforeWalletClp: selectedFareAmountBeforeWallet,
            fareAfterWalletClp: selectedFareAmount,
          });
          setWalletBenefitRevision((current) => current + 1);
        }

        if (rideMode === "scheduled") {
          upsertLocalAdminScheduledRide(
            createLocalAdminScheduledRide({
              originText: resolved.origin.text,
              destinationText: resolved.destination.text,
              notes: limitRideNotes(localNotes.join(" ")),
              passengerNote: passengerNote || null,
              estimatedFareClp: selectedFareAmount ?? null,
              rideMode,
              tripFareMode: effectiveTripFareMode,
              scheduledAt,
              returnScheduledAt,
              scheduleKind: selectedRoundTripPromotion
                ? "round_trip_promotion"
                : "airport_pickup",
              passengerName: getSessionDisplayName(session.user),
              passengerEmail: getSessionEmail(session.user),
              passengerFareType: effectivePassengerFareType,
              passengerFareLabel: passengerFareTypeLabel(
                effectivePassengerFareType,
              ),
              airportWelcomeOption:
                rideMode === "scheduled" ? airportWelcomeOption : null,
              airportWelcomeLabel: hasAirportFlowerLei
                ? AIRPORT_FLOWER_LEI_LABEL
                : "Solo recogida",
              flowerLeiRequested: hasAirportFlowerLei,
              airportWelcomeSurchargeClp,
              optionalServicesTotalClp: airportWelcomeSurchargeClp,
              baseFareBeforeExtrasClp: selectedBaseFareAmount,
            }),
          );
        }

        setOriginPoint(null);
        setDestinationPoint(null);
        setOriginInput("");
        setDestInput("");
        setNotesInput("");
        setScheduledAt("");
        setReturnScheduledAt("");
        setFlightNumber("");
        setAirportWelcomeOption("none");
        setFlowerLeiQuantity(1);
        setOriginSuggestions([]);
        setDestSuggestions([]);
        setRideMode("now");
        setTripFareMode("one_way");
        setSelectedRoundTripPromotionId(null);
        setPaymentMethod(null);
        setShowPaymentBox(false);
        setVehicleCategory("standard");
        setUseWalletBenefit(null);

        goToTripsAfterRequest(String(localRide.id ?? ""));
        return;
      }

      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }

  const canRequest =
    (!!originPoint || !!originInput.trim()) &&
    (!!destinationPoint || !!destInput.trim()) &&
    (rideMode === "now" ||
      (!!scheduledAt && (!requireReturnScheduledAt || !!returnScheduledAt))) &&
    !submitting &&
    paymentMethod !== null;

  /* ── Flujo por pasos ──────────────────────────────────────────────────────
     El formulario no cambia: se reparte. Antes vivía entero en un solo scroll
     y había que recorrerlo de arriba abajo para saber qué faltaba; ahora cada
     grupo de secciones que YA existía se muestra por turnos y el pie dice
     siempre cuál es el único paso siguiente.

     Es estado de presentación y nada más: no valida de forma nueva, no toca
     coordenadas, tarifas ni el envío. Las dos condiciones de abajo son
     literalmente los sumandos de `canRequest` de aquí arriba, partidos por el
     paso donde el pasajero puede resolverlos; `canRequest` sigue siendo quien
     manda en el botón final, intacto y con la misma expresión completa. */
  const [wizardStep, setWizardStep] = useState(0);
  const wizardBodyRef = useRef<HTMLDivElement | null>(null);

  /* Origen y destino: mismos sumandos que en `canRequest`. */
  const wizardRouteReady =
    (!!originPoint || !!originInput.trim()) &&
    (!!destinationPoint || !!destInput.trim());

  /* Cuándo se viaja. En "ahora" no hay nada que rellenar, así que el paso
     queda resuelto de entrada; al reservar hacen falta la fecha de ida y,
     si es ida y vuelta, también la de regreso. */
  const wizardDetailsReady =
    rideMode === "now" ||
    (!!scheduledAt && (!requireReturnScheduledAt || !!returnScheduledAt));

  /* Mismo sumando final de `canRequest`, aislado en el paso donde el
     pasajero lo resuelve: elegir forma de pago ya tiene su propio paso y no
     comparte pantalla con el resumen. */
  const wizardPaymentReady = paymentMethod !== null;

  const WIZARD_STEPS = [
    { label: "Ruta", ready: wizardRouteReady },
    { label: "Vehículo", ready: wizardDetailsReady },
    { label: "Pago", ready: wizardPaymentReady },
    { label: "Confirmar", ready: canRequest },
  ];

  const wizardCanAdvance = WIZARD_STEPS[wizardStep]?.ready ?? false;
  const wizardIsLastStep = wizardStep === WIZARD_STEPS.length - 1;

  /* Al cambiar de paso el cuerpo vuelve arriba: el scroll del paso anterior
     no significa nada en el nuevo y dejarlo a media altura hace que el
     contenido parezca empezar por el medio. `smooth` sólo si el usuario no ha
     pedido reducir el movimiento. */
  function goToWizardStep(next: number): void {
    const target = Math.min(WIZARD_STEPS.length - 1, Math.max(0, next));
    setWizardStep(target);

    /* Al llegar al paso 2 (Vehículo) origen y destino ya están decididos: el
       mapa detrás deja de ser lo que hay que mirar. La hoja sube del todo para
       enseñar de entrada el paso completo, sin arrastrar nada a mano.

       Es un empujón al llegar, no una posición fija: el arrastre normal —
       handleRequestGripPointerMove y el resto— sigue funcionando exactamente
       igual después, así que el pasajero puede volver a bajarla si quiere ver
       el mapa. Por eso va aquí, en la navegación, y no como un límite que le
       impida moverla. */
    if (target === 1) setSheetShift(0);

    const body = wizardBodyRef.current;
    if (!body) return;

    const reduceMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    body.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  /* Escribir una dirección con el teclado abierto.

     Al enfocar un extremo del viaje la hoja sube del todo (shift 0) para dar
     todo el alto disponible a la búsqueda, y el campo se lleva al borde
     superior del scroll: los resultados salen debajo, ocupando entero el hueco
     que queda libre sobre el teclado. Lo que no entra sigue estando ahí, a un
     dedo de distancia, porque la hoja conserva su alto y solo se le añade
     relleno al final.

     Solo toca presentación —posición de la hoja y scrollTop—. No cambia el
     foco, ni el texto, ni la búsqueda, ni la selección del lugar. */
  useEffect(() => {
    const editing = wizardStep === 0 && activeSearchField != null;
    const previous = shiftBeforeKeyboardRef.current;

    /* Teclado abajo: la hoja vuelve donde estaba y el mapa reaparece solo, sin
       que haya que arrastrarla de vuelta.

       La condición mira el teclado y no el foco a propósito, porque son cosas
       distintas: cerrar el teclado con el botón del sistema —lo normal en
       Android— deja el campo enfocado, y atarlo al foco dejaría la hoja
       desplegada tapando el mapa sin teclado que lo justificara. Y al revés,
       soltar el foco tocando un resultado no restaura hasta que el teclado ha
       terminado de bajar, para no dejarla medio segundo en su posición de
       reposo dentro de un shell todavía recortado.

       `previous` solo tiene valor si llegamos a desplegarla, así que el paso
       por aquí mientras el teclado aún no ha subido no toca nada. */
    if (keyboardInset <= 0) {
      if (previous != null) {
        shiftBeforeKeyboardRef.current = null;
        setSheetShift(previous);
      }
      return;
    }

    /* Teclado arriba por otro campo (las notas del paso 3, por ejemplo): el
       shell ya se ha recortado por CSS, que es lo que hacía falta, y la
       posición de la hoja no es asunto de este efecto. */
    if (!editing) return;

    if (previous == null) {
      shiftBeforeKeyboardRef.current =
        sheetShift ?? Math.round(sheetMaxShift * REQUEST_SHEET_REST_FRACTION);
    }

    setSheetShift(0);

    /* Un frame de margen: la cabecera se compacta y el relleno del scroll se
       aplica con la medida de este mismo render, así que medir antes daría la
       posición vieja del campo. */
    const frame = window.requestAnimationFrame(() => {
      const body = wizardBodyRef.current;
      const field = body?.querySelector<HTMLElement>(
        `.rq-field[data-active="true"]`,
      );
      if (!body || !field) return;

      const reduceMotion =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      body.scrollTo({
        top: computeFieldScrollTop({
          currentScrollTop: body.scrollTop,
          fieldTop: field.getBoundingClientRect().top,
          bodyTop: body.getBoundingClientRect().top,
        }),
        behavior: reduceMotion ? "auto" : "smooth",
      });
    });

    return () => window.cancelAnimationFrame(frame);
    /* `sheetShift` queda fuera a propósito: lo escribe este mismo efecto y
       reaccionar a él lo volvería a disparar en bucle. Se lee por ref al
       guardar el valor previo, que es la única vez que hace falta. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSearchField, keyboardInset, wizardStep, sheetMaxShift]);

  const mapOrigin = useMemo(() => {
    if (isAirportScheduledRide) {
      return {
        text: RAPA_NUI_AIRPORT_DESTINATION.text,
        lat: RAPA_NUI_AIRPORT_DESTINATION.lat,
        lng: RAPA_NUI_AIRPORT_DESTINATION.lng,
        placeId: RAPA_NUI_AIRPORT_DESTINATION.placeId ?? null,
        originalLat: null,
        originalLng: null,
        walkMeters: 0,
        isAccessiblePickup: false,
      };
    }

    return {
      text: originPoint?.text ?? originInput.trim() ?? "Origen",
      lat: originPoint?.lat ?? null,
      lng: originPoint?.lng ?? null,
      placeId: originPoint?.placeId ?? null,
      originalLat: originPoint?.originalLat ?? null,
      originalLng: originPoint?.originalLng ?? null,
      walkMeters: originPoint?.walkMeters ?? null,
      isAccessiblePickup: originPoint?.isAccessiblePickup ?? null,
    };
  }, [isAirportScheduledRide, originInput, originPoint]);

  const mapDestination = useMemo(
    () => ({
      text: destinationPoint?.text ?? destInput.trim() ?? "Destino",
      lat: destinationPoint?.lat ?? null,
      lng: destinationPoint?.lng ?? null,
      placeId: destinationPoint?.placeId ?? null,
    }),
    [destInput, destinationPoint],
  );

  const pickerInitialPoint =
    pickerTarget === "origin"
      ? originPoint
      : pickerTarget === "destination"
        ? destinationPoint
        : null;

  const scheduleMinInput = toDateTimeLocalValue(
    new Date(Date.now() + SCHEDULE_MIN_MINUTES * 60_000),
  );
  const scheduleMaxInput = toDateTimeLocalValue(
    new Date(Date.now() + SCHEDULE_MAX_DAYS * 24 * 60 * 60_000),
  );

  return (
    <IonPage
      className="rapago-section-page rapago-request-page"
      data-rapago-theme={theme}>
      <RapagoSectionHeader
        title="Solicitar Viaje"
        onBack={() => history.replace(ROUTES.PASSENGER.HOME)}
        backLabel="Volver al inicio"
      />

      {/* SIN `fullscreen` a propósito.

          Con `fullscreen`, ion-content abarca TODA la página —incluido el área
          que hay debajo del header— y Ionic lo compensa metiendo un padding
          variable (--offset-top / --offset-bottom) dentro de su shadow DOM. Es
          decir: la altura del contenedor y la altura realmente utilizable
          dejaban de coincidir, y esa diferencia es la franja por la que
          asomaba el fondo de la página.

          Sin `fullscreen`, ion-content ocupa exactamente el hueco que queda
          tras el header, los offsets valen 0 y la columna interior puede
          repartir el alto sin compensar nada. */}
      <IonContent
        className="rp-request-main-content"
        style={{ "--background": "transparent" } as CSSProperties}>
        <div
          ref={requestShellRef}
          className={`rp-request-uber-shell${
            requestSheetDragging ? " is-dragging" : ""
          }`}
          /* Desplazamiento en px de la hoja respecto a su tope superior. El CSS
             lo aplica como translateY sobre el overlay, sin tocar el layout del
             mapa. Mientras no hay medida usa el translateY de respaldo del CSS. */
          /* `data-keyboard` para lo que es un cambio de disposición (apretar
             cabecera, quitar el área segura de abajo) y no un simple desplazar:
             con un solo píxel de --rq-kb ya hay teclado, y el CSS no sabe
             comparar. */
          data-keyboard={keyboardInset > 0 ? "open" : "closed"}
          style={
            {
              "--rq-sheet-shift":
                sheetShift != null ? `${sheetShift}px` : undefined,
              "--rq-kb": `${keyboardInset}px`,
            } as CSSProperties
          }>
          <div
            className="rp-request-main-map"
            aria-label="Mapa del viaje solicitado">
            <MapFallback
              origin={mapOrigin}
              destination={mapDestination}
              height={320}
              showRoute
              originDraggable={canChooseOrigin}
              onOriginChange={(payload) => {
                void applyMovedOriginFromMap(payload);
              }}
              /* El destino solo queda fijo cuando lo impone una experiencia de
                 ida y regreso; en cualquier otro caso se puede mover. */
              destinationDraggable={!selectedRoundTripPromotion}
              onDestinationChange={(payload) => {
                void applyMovedDestinationFromMap(payload);
              }}
              /* Los puntos se pueden soltar en cualquier parte, también en el
                 mar o fuera de la isla. Ahí no hay viaje posible: el mapa
                 devuelve el punto a su sitio y explica por qué, en vez de
                 aceptar una recogida a la que nadie puede llegar. */
              rejectDroppedPoint={(point, kind) =>
                isPointInsideRapaNuiServiceArea(point)
                  ? null
                  : kind === "origin"
                    ? "Ese punto está fuera de Rapa Nui. Mueve el punto verde dentro de la isla."
                    : "Ese punto está fuera de Rapa Nui. Mueve el punto dorado dentro de la isla."
              }
              places={REQUEST_MAP_PLACES}
              onSelectPlace={handleSelectMapPlace}
              onSelectGooglePoi={handleSelectGooglePoi}
            />

            {mapPoiLoading && (
              <div className="rq-map-poi-loading" aria-live="polite">
                <IonSpinner name="crescent" />
                <span>
                  {canChooseOrigin && !originPoint
                    ? "Tomando ese lugar como origen..."
                    : "Tomando ese lugar como destino..."}
                </span>
              </div>
            )}
          </div>


          {/* Sin padding inline: el del CSS reserva además la altura del dock
              fijo, y un padding aquí lo pisaba y dejaba la última tarjeta
              debajo del botón. */}
          <div className="rp-request-bottom-sheet">
            {/* Cabecera fija y zona de arrastre, igual que la de "Confirmar
                recogida": los manejadores del puntero van en TODA la cabecera,
                no solo en la barrita, así que se puede agarrar en cualquier
                punto para subir y bajar la ventana. El asa es solo la señal
                visual de que se puede arrastrar. */}
            <div
              ref={requestSheetHeadRef}
              className="rq-sheet-head"
              onPointerDown={handleRequestGripPointerDown}
              onPointerMove={handleRequestGripPointerMove}
              onPointerUp={handleRequestGripPointerUp}
              onPointerCancel={handleRequestGripPointerUp}>
              <button
                type="button"
                className="rq-grip"
                aria-expanded={
                  sheetShift != null && sheetShift < sheetMaxShift * 0.5
                }
                aria-label={
                  sheetShift != null && sheetShift > sheetMaxShift * 0.5
                    ? "Mostrar el formulario del viaje. También puedes arrastrar esta barra."
                    : "Plegar el formulario y ver el mapa completo. También puedes arrastrar esta barra."
                }
                onKeyDown={handleRequestGripKeyDown}>
                <span className="rq-grip__bar" aria-hidden="true" />
              </button>

              {/* El selector "cuándo" vive DENTRO de la hoja, no flotando sobre
                  el mapa: allí tapaba parte del mapa justo cuando el pasajero
                  lo agranda para ubicarse. */}
              {wizardStep === 0 && (
                <div
                  className="rq-seg"
                  role="tablist"
                  aria-label="Cuándo quieres viajar">
                  <button
                    type="button"
                    role="tab"
                    className="rq-seg__option"
                    aria-selected={rideMode === "now"}
                    onPointerDown={stopSheetDragPropagation}
                    onPointerUp={stopSheetDragPropagation}
                    onClick={selectRideModeNow}>
                    <IonIcon icon={flashOutline} aria-hidden="true" />
                    AHORA
                  </button>

                  <button
                    type="button"
                    role="tab"
                    className="rq-seg__option"
                    aria-selected={rideMode === "scheduled"}
                    onPointerDown={stopSheetDragPropagation}
                    onPointerUp={stopSheetDragPropagation}
                    onClick={selectRideModeScheduled}>
                    <IonIcon icon={calendarOutline} aria-hidden="true" />
                    RESERVAR
                  </button>
                </div>
              )}

              {/* Indicador de progreso. Va en la cabecera fija y no en el
                  cuerpo porque su utilidad es justamente no perderse: dentro
                  del scroll se iría de vista en cuanto el pasajero empieza a
                  rellenar, que es cuando hace falta.

                  No es interactivo a propósito. Saltar a un paso suelto
                  llevaría a pantallas cuyos requisitos previos aún no están
                  resueltos; además la cabecera entera es zona de arrastre y un
                  control pulsable aquí competiría con el gesto de la hoja. */}
              <ol className="rq-steps" aria-label="Progreso de la solicitud">
                {WIZARD_STEPS.map((paso, indice) => {
                  const estado =
                    indice < wizardStep
                      ? "done"
                      : indice === wizardStep
                        ? "current"
                        : "todo";

                  return (
                    <li
                      key={paso.label}
                      className="rq-steps__item"
                      data-state={estado}
                      aria-current={estado === "current" ? "step" : undefined}>
                      <span className="rq-steps__dot" aria-hidden="true">
                        {estado === "done" ? (
                          <IonIcon icon={checkmarkCircleOutline} />
                        ) : (
                          indice + 1
                        )}
                      </span>
                      <span className="rq-steps__label">{paso.label}</span>
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* Cuerpo desplazable. Es el ÚNICO elemento con scroll de la hoja:
                el asa y AHORA/RESERVAR quedan fuera de él, así que no se
                mueven al desplazar y arrastrar el asa nunca se confunde con un
                scroll. Antes la cabecera iba con position:sticky dentro del
                propio scroll, que es más frágil: cualquier ancestro con
                overflow o transform la despega. */}
            <div className="rq-sheet-body" ref={wizardBodyRef}>
              {/* Los tres envoltorios `rq-step` agrupan secciones que YA
                  estaban aquí, en el mismo orden y sin tocar su contenido: el
                  CSS oculta las que no son del paso actual. Se dejan sin
                  reindentar a propósito —el diff cambia 6 líneas en vez de
                  1800— porque este archivo lo estamos editando varias
                  personas a la vez y una sangría masiva provocaría conflictos
                  en todo el formulario. */}
              {/* ── Paso 1 · Ruta ── */}
              <div className="rq-step" data-active={wizardStep === 0}>
                {/* Origen y destino viven en un mismo bloque "riel": punto, línea
                punteada y cuadrado, como en cualquier app de movilidad. Antes
                eran dos tarjetas sueltas separadas por notas y por dos botones
                de 66px, así que no se leían como los dos extremos de un mismo
                viaje. data-state permite al CSS distinguir vacío de confirmado
                sin depender solo del color. */}
                {/* Los dos extremos del viaje SON los campos de texto: se
                    escribe directamente en ellos y la lista de resultados sale
                    debajo, como en Uber. Antes eran botones que abrían un
                    buscador aparte con su propia caja de texto, así que había
                    dos sitios donde escribir la misma dirección y el campo que
                    se estaba rellenando desaparecía al abrirse el buscador
                    encima.

                    El riel —punto, línea punteada y cuadrado— se conserva: es
                    lo que hace que las dos filas se lean como los extremos de
                    un mismo viaje y no como dos formularios sueltos. */}
                <div className="rq-route" data-focus={activeSearchField ?? ""}>
                  <div
                    className="rq-field rq-field--origin"
                    data-state={originPoint ? "set" : "empty"}
                    data-active={activeSearchField === "origin"}>
                    <span className="rq-field__marker" aria-hidden="true" />

                    <IonInput
                      className="rq-field__input"
                      value={originInput}
                      disabled={!canChooseOrigin}
                      placeholder={
                        canChooseOrigin
                          ? "¿Dónde te recogemos?"
                          : "Aeropuerto Internacional Mataveri"
                      }
                      aria-label="Origen del viaje"
                      onIonFocus={() => {
                        if (!canChooseOrigin) return;
                        setRouteOrderHint(false);
                        setActiveSearchField("origin");
                      }}
                      /* El toque en un resultado dispara blur ANTES que su
                         propio click, así que cerrar de inmediato se comería
                         la selección. El margen deja que el click del
                         resultado corra primero; si en cambio se tocó fuera de
                         la lista, cierra igual. */
                      onIonBlur={() => {
                        window.setTimeout(() => {
                          setActiveSearchField((current) =>
                            current === "origin" ? null : current,
                          );
                        }, 180);
                      }}
                      onIonInput={(event) =>
                        setOriginInput(String(event.detail.value ?? ""))
                      }
                    />

                    <span className="rq-field__action">
                      {searchingOrigin ? (
                        <IonSpinner name="dots" />
                      ) : originPoint ? (
                        <IonIcon
                          className="rq-field__ok"
                          icon={checkmarkCircleOutline}
                          aria-hidden="true"
                        />
                      ) : null}

                      {originInput.trim() ? (
                        <button
                          type="button"
                          className="rq-field__clear"
                          aria-label="Borrar origen"
                          onClick={() => {
                            clearOriginSelection();
                            setActiveSearchField("origin");
                          }}>
                          <IonIcon icon={closeOutline} aria-hidden="true" />
                        </button>
                      ) : null}
                    </span>
                  </div>

                  <div
                    className="rq-field rq-field--destination"
                    data-state={destinationPoint ? "set" : "empty"}
                    data-active={activeSearchField === "destination"}>
                    <span className="rq-field__marker" aria-hidden="true" />

                    <IonInput
                      className="rq-field__input"
                      value={destInput}
                      disabled={Boolean(selectedRoundTripPromotion)}
                      placeholder={
                        selectedRoundTripPromotion
                          ? selectedRoundTripPromotion.destinationName
                          : "¿A dónde vas?"
                      }
                      aria-label="Destino del viaje"
                      onIonFocus={() => {
                        if (selectedRoundTripPromotion) return;

                        /* Sin origen no se escribe el destino: la búsqueda y
                           la ruta se calculan desde el origen, así que
                           empezar por el otro extremo deja media pantalla sin
                           referencia. Se avisa y el foco vuelve al que falta. */
                        if (canChooseOrigin && !originPoint) {
                          setRouteOrderHint(true);
                          setActiveSearchField("origin");
                          return;
                        }

                        setRouteOrderHint(false);
                        setActiveSearchField("destination");
                      }}
                      onIonBlur={() => {
                        window.setTimeout(() => {
                          setActiveSearchField((current) =>
                            current === "destination" ? null : current,
                          );
                        }, 180);
                      }}
                      onIonInput={(event) =>
                        setDestInput(String(event.detail.value ?? ""))
                      }
                    />

                    <span className="rq-field__action">
                      {searchingDest ? (
                        <IonSpinner name="dots" />
                      ) : destinationPoint ? (
                        <IonIcon
                          className="rq-field__ok"
                          icon={checkmarkCircleOutline}
                          aria-hidden="true"
                        />
                      ) : null}

                      {destInput.trim() ? (
                        <button
                          type="button"
                          className="rq-field__clear"
                          aria-label="Borrar destino"
                          onClick={() => {
                            clearDestinationSelection();
                            setActiveSearchField("destination");
                          }}>
                          <IonIcon icon={closeOutline} aria-hidden="true" />
                        </button>
                      ) : null}
                    </span>
                  </div>
                </div>

                {/* Aviso de orden. Sale sólo cuando el pasajero intenta
                    empezar por el destino; se apaga solo en cuanto confirma el
                    origen, así que no hay que cerrarlo a mano. */}
                {routeOrderHint && canChooseOrigin && !originPoint && (
                  <div className="rq-order-hint" role="alert">
                    <IonIcon icon={alertCircleOutline} aria-hidden="true" />
                    <span>
                      <strong>Debes seleccionar el origen primero</strong>
                      para empezar tu viaje.
                    </span>
                  </div>
                )}

                {/* Los dos atajos van ENCIMA de la lista de lugares.

                    Debajo quedaban al final de una lista que crece con lo que
                    se escribe, así que había que desplazarse hasta el fondo
                    para encontrarlos —y con el teclado abierto, ni eso—. Aquí
                    se ven siempre, pegados a los campos a los que pertenecen.

                    Los dos abren el mismo selector de mapa, cada uno para su
                    extremo del viaje: el de ubicación centra el mapa en el GPS
                    para confirmar la recogida, y el de destino lo abre para
                    elegir a dónde ir. El componente ya distinguía ambos modos;
                    lo único que faltaba era la puerta de entrada al de
                    destino. */}
                {(canChooseOrigin && !originPoint) ||
                !selectedRoundTripPromotion ? (
                  <div className="rq-quick">
                    {canChooseOrigin && !originPoint ? (
                      <button
                        type="button"
                        className="rq-quick__btn rq-quick__btn--primary"
                        onClick={handleUseCurrentLocation}
                        disabled={locating}
                        aria-label="Usar mi ubicación actual como origen">
                        {locating ? (
                          <IonSpinner name="dots" />
                        ) : (
                          <>
                            <IonIcon icon={locateOutline} aria-hidden="true" />
                            Usar mi ubicación actual
                          </>
                        )}
                      </button>
                    ) : null}

                    {!selectedRoundTripPromotion && !destinationPoint ? (
                      <button
                        type="button"
                        className="rq-quick__btn"
                        aria-label="Elegir el destino en el mapa"
                        onClick={() => {
                          /* Mismo guardia que el campo de destino: sin origen
                             no se elige el otro extremo, porque la ruta y la
                             búsqueda se calculan desde él. Se reutiliza tal
                             cual para no abrir por aquí un camino que se
                             saltara la regla. */
                          if (canChooseOrigin && !originPoint) {
                            setRouteOrderHint(true);
                            setActiveSearchField("origin");
                            return;
                          }

                          setRouteOrderHint(false);
                          /* El modal se abre sobre el teclado si venía de
                             escribir en un campo; bajarlo antes deja el mapa
                             entero a la vista. */
                          dismissSoftKeyboard();
                          setActiveSearchField(null);
                          setPickerAutoFocusSearch(false);
                          setPickerTarget("destination");
                        }}>
                        <IonIcon icon={mapOutline} aria-hidden="true" />
                        Elegir en el mapa
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {/* Resultados justo debajo de los campos y en la misma columna:
                    lo que se escribe arriba se responde abajo, sin tapar el
                    campo que se está rellenando. Misma fuente de lugares y
                    mismos handlers de selección que ya existían. */}
                {wizardStep === 0 && activeSearchField
                  ? renderRouteResults(activeSearchField)
                  : null}

                {/* Navegación del paso 1. Va pegada a los campos de ruta, no
                    al fondo de las notas: en cuanto origen y destino están
                    listos, el botón para avanzar tiene que verse sin
                    desplazarse por avisos informativos. */}
                {wizardStep === 0 && (
                  <div className="rq-nav" style={{ marginTop: "16px" }}>
                    <button
                      type="button"
                      className="rq-nav__next"
                      disabled={!wizardCanAdvance}
                      onClick={() => goToWizardStep(wizardStep + 1)}>
                      Siguiente
                      <IonIcon icon={arrowForwardOutline} aria-hidden="true" />
                    </button>
                  </div>
                )}

                {originPoint?.walkMeters != null &&
                  originPoint.walkMeters > 8 && (
                    <div className="rp-request-note">
                      <strong>Punto accesible recomendado:</strong> el conductor
                      te recoge en {originPoint.text}. Camina aprox.{" "}
                      {originPoint.walkMeters} m hasta la calle. En el mapa
                      verás tu punto real en azul y la recogida accesible con el
                      icono de coche.
                    </div>
                  )}

                {!canChooseOrigin && (
                  <div className="rq-hint">
                    <IonIcon icon={airplaneOutline} aria-hidden="true" />
                    Origen fijo: Aeropuerto Rapa Nui. El pasajero elige el
                    destino.
                  </div>
                )}
              </div>

              {/* ── Paso 2 · Vehículo ── */}
              <div className="rq-step" data-active={wizardStep === 1}>
                {/* Navegación del paso 2 */}
                {wizardStep === 1 && (
                  <div className="rq-nav" style={{ marginBottom: "16px" }}>
                    <button
                      type="button"
                      className="rq-nav__back"
                      onClick={() => goToWizardStep(wizardStep - 1)}>
                      <IonIcon icon={arrowBackOutline} aria-hidden="true" />
                      Anterior
                    </button>

                    <button
                      type="button"
                      className="rq-nav__next"
                      disabled={!wizardCanAdvance}
                      onClick={() => goToWizardStep(wizardStep + 1)}>
                      Siguiente
                      <IonIcon icon={arrowForwardOutline} aria-hidden="true" />
                    </button>
                  </div>
                )}
                {/* El producto en "ahora" es siempre solo ida (tripFareMode
                queda en one_way). La tarjeta "Solo ida" y su texto de viaje
                inmediato se ocultaron: no elegían nada y tapaban el selector
                de vehículo. Volver desde una experiencia de ida y vuelta sigue
                en el botón de Mataveri, más abajo. */}

                <div className="rp-request-vehicle-heading">
                  <div>
                    <strong>Elige tu vehículo</strong>
                    <span>Precio final, sin sorpresas</span>
                  </div>
                  <span className="rp-request-route-metric">
                    {fareQuote
                      ? `${fareQuote.km.toFixed(1)} km · ${fareQuote.minutes} min`
                      : fareLoading
                        ? "Calculando ruta"
                        : "Ruta pendiente"}
                  </span>
                </div>

                <div className="rp-request-vehicle-list">
                  {VEHICLE_CATEGORIES.map(
                    (category) => {
                      const active = vehicleCategory === category;
                      const categoryFareAmount =
                        getVehicleCategoryDisplayFare(category);
                      const categoryUsdLabel =
                        categoryFareAmount != null
                          ? formatUSDFromCLP(
                              categoryFareAmount,
                              selectedRoundTripPromotion?.usdLabel
                                ? fareRules.usdRate
                                : fareQuote?.usdRate,
                            )
                          : "USD --";
                      const capacityLabel = category === "xl" ? "6" : "4";

                      return (
                        <button
                          key={category}
                          type="button"
                          className={`rp-request-vehicle-card ${active ? "is-active" : ""}`}
                          aria-pressed={active}
                          onClick={() => {
                            setVehicleCategory(category);
                            setSubmitError(null);
                          }}>
                          <span
                            className="rp-request-vehicle-icon"
                            aria-hidden="true">
                            <IonIcon icon={vehicleCategoryIcon(category)} />
                          </span>

                          <span className="rp-request-vehicle-copy">
                            <span className="rp-request-vehicle-title">
                              {vehicleCategoryTitle(category)}
                              <small>{capacityLabel}</small>
                            </span>
                            <span className="rp-request-vehicle-description">
                              {vehicleCategoryDescription(category)}
                            </span>
                            <span className="rp-request-vehicle-eta">
                              <IonIcon icon={timeOutline} aria-hidden="true" />
                              {getVehicleCategoryEtaLabel(category)}
                            </span>
                          </span>

                          <span className="rp-request-vehicle-price">
                            <strong>
                              {categoryFareAmount != null
                                ? formatCLP(categoryFareAmount)
                                : "Calculando"}
                            </strong>
                            <small>{categoryUsdLabel}</small>
                          </span>
                        </button>
                      );
                    },
                  )}
                </div>

                {rideMode === "scheduled" && (
                  <>
                    <div
                      style={{
                        margin: "0 0 18px",
                        border: "1.5px solid rgba(248,216,121,.32)",
                        borderRadius: "24px",
                        background:
                          "radial-gradient(circle at top left, rgba(248,216,121,.20), transparent 34%), linear-gradient(145deg,#191919 0%,#0d0d0d 72%)",
                        padding: "14px",
                        boxShadow: "0 18px 42px rgba(0,0,0,.34)",
                        overflow: "hidden",
                        position: "relative",
                      }}>
                      <div
                        style={{
                          position: "absolute",
                          right: -28,
                          top: -34,
                          width: 120,
                          height: 120,
                          borderRadius: "50%",
                          background: "rgba(248,216,121,.12)",
                          filter: "blur(2px)",
                          pointerEvents: "none",
                        }}
                      />

                      <div
                        style={{
                          position: "relative",
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          alignItems: "flex-start",
                          marginBottom: 12,
                        }}>
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              color: "#F8D879",
                              fontSize: ".72rem",
                              fontWeight: 950,
                              letterSpacing: ".06em",
                              textTransform: "uppercase",
                            }}>
                            Descubre Rapa Nui
                          </div>
                          <div
                            style={{
                              color: "#F6F2EC",
                              fontSize: "1.08rem",
                              fontWeight: 950,
                              lineHeight: 1.1,
                              marginTop: 4,
                            }}>
                            Experiencias con ida y regreso
                          </div>
                          <div
                            style={{
                              color: "rgba(246,242,236,.70)",
                              fontSize: ".73rem",
                              lineHeight: 1.35,
                              fontWeight: 800,
                              marginTop: 6,
                            }}>
                            Reserva con anticipación para{" "}
                            {passengerFareTypeLabel(passengerFareType)}. El
                            destino queda confirmado y tú eliges dónde pasamos a
                            buscarte.
                          </div>
                        </div>

                        <span
                          style={{
                            flex: "0 0 auto",
                            borderRadius: 999,
                            padding: "6px 10px",
                            background:
                              "linear-gradient(135deg,#F8D879 0%,#D2A43A 100%)",
                            color: "#111111",
                            fontSize: ".66rem",
                            fontWeight: 950,
                            boxShadow: "0 8px 18px rgba(210,164,58,.28)",
                            whiteSpace: "nowrap",
                          }}>
                          Tarifa fija
                        </span>
                      </div>

                      {roundTripPromotions.length === 0 ? (
                        <div
                          style={{
                            position: "relative",
                            border: "1px dashed rgba(248,216,121,.28)",
                            borderRadius: "18px",
                            padding: "14px",
                            color: "rgba(246,242,236,.72)",
                            fontSize: ".76rem",
                            lineHeight: 1.35,
                            fontWeight: 850,
                            background: "rgba(255,255,255,.035)",
                          }}>
                          Por ahora no hay experiencias con reserva disponibles
                          para tu perfil.
                        </div>
                      ) : (
                        <div
                          style={{
                            position: "relative",
                            display: "grid",
                            gridTemplateColumns: "1fr",
                            gap: 11,
                          }}>
                          {roundTripPromotions.map((promotion) => {
                            const active =
                              selectedRoundTripPromotion?.id === promotion.id;
                            const destinationKey = String(
                              promotion.destinationName ?? "",
                            ).toLowerCase();
                            const promoIconRef = destinationKey.includes(
                              "anakena",
                            )
                              ? sunnyOutline
                              : destinationKey.includes("terevaka")
                                ? compassOutline
                                : carOutline;
                            const promoTitle = destinationKey.includes(
                              "anakena",
                            )
                              ? "Escapada a Anakena"
                              : destinationKey.includes("terevaka")
                                ? "Subida a Terevaka"
                                : promotion.destinationName;
                            const experienceFareClp =
                              calculateRoundTripExperienceFare(
                                promotion,
                                vehicleCategory,
                                fareRules,
                              );
                            const experienceUsdLabel = formatUSDFromCLP(
                              experienceFareClp,
                              fareRules.usdRate,
                            );
                            const priceChanged = vehicleCategory !== "standard";

                            return (
                              <button
                                key={promotion.id}
                                type="button"
                                onClick={() =>
                                  setPendingRoundTripPromotion(promotion)
                                }
                                style={{
                                  width: "100%",
                                  border: active
                                    ? "2.5px solid #F8D879"
                                    : "1.5px solid rgba(248,216,121,.28)",
                                  borderRadius: "22px",
                                  background: active
                                    ? "linear-gradient(135deg,#F8D879 0%,#E7BC50 55%,#C99320 100%)"
                                    : "linear-gradient(135deg,rgba(255,255,255,.08) 0%,rgba(255,255,255,.035) 100%)",
                                  color: active ? "#111111" : "#F6F2EC",
                                  padding: "14px",
                                  textAlign: "left",
                                  boxShadow: active
                                    ? "0 18px 34px rgba(210,164,58,.36)"
                                    : "0 10px 24px rgba(0,0,0,.24)",
                                  fontWeight: 900,
                                  overflow: "hidden",
                                  position: "relative",
                                }}>
                                <div
                                  style={{
                                    position: "absolute",
                                    right: -18,
                                    bottom: -24,
                                    fontSize: "4.8rem",
                                    opacity: active ? 0.16 : 0.1,
                                    transform: "rotate(-8deg)",
                                    pointerEvents: "none",
                                  }}>
                                  <IonIcon icon={promoIconRef} />
                                </div>

                                <div
                                  style={{
                                    position: "relative",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    gap: 12,
                                    alignItems: "flex-start",
                                  }}>
                                  <div
                                    style={{
                                      display: "flex",
                                      gap: 10,
                                      minWidth: 0,
                                    }}>
                                    <div
                                      style={{
                                        width: 42,
                                        height: 42,
                                        borderRadius: 16,
                                        background: active
                                          ? "rgba(17,17,17,.12)"
                                          : "rgba(248,216,121,.12)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: "1.35rem",
                                        flex: "0 0 auto",
                                      }}>
                                      <IonIcon icon={promoIconRef} />
                                    </div>

                                    <div style={{ minWidth: 0 }}>
                                      <div
                                        style={{
                                          fontSize: "1.02rem",
                                          lineHeight: 1.05,
                                          fontWeight: 950,
                                        }}>
                                        {promoTitle}
                                      </div>
                                      <div
                                        style={{
                                          marginTop: 5,
                                          fontSize: ".72rem",
                                          lineHeight: 1.25,
                                          fontWeight: 850,
                                          opacity: active ? 0.82 : 0.7,
                                        }}>
                                        {promotion.destinationName} · Ida y
                                        vuelta
                                      </div>
                                      <div
                                        style={{
                                          marginTop: 4,
                                          fontSize: ".68rem",
                                          lineHeight: 1.2,
                                          fontWeight: 850,
                                          opacity: active ? 0.76 : 0.58,
                                        }}>
                                        Especial para {promotion.passengerLabel}
                                      </div>
                                    </div>
                                  </div>

                                  <div
                                    style={{
                                      textAlign: "right",
                                      flex: "0 0 auto",
                                      padding: "4px 0 0",
                                    }}>
                                    <div
                                      style={{
                                        fontSize: "1.15rem",
                                        fontWeight: 950,
                                        lineHeight: 1,
                                      }}>
                                      {formatCLP(experienceFareClp)}
                                    </div>
                                    <div
                                      style={{
                                        fontSize: ".70rem",
                                        fontWeight: 900,
                                        opacity: 0.78,
                                        marginTop: 3,
                                      }}>
                                      {experienceUsdLabel}
                                    </div>
                                  </div>
                                </div>

                                <div
                                  style={{
                                    position: "relative",
                                    marginTop: 12,
                                    display: "flex",
                                    gap: 7,
                                    flexWrap: "wrap",
                                    alignItems: "center",
                                  }}>
                                  <span
                                    style={{
                                      borderRadius: 999,
                                      padding: "5px 8px",
                                      fontSize: ".63rem",
                                      background: active
                                        ? "rgba(17,17,17,.14)"
                                        : "rgba(34,197,94,.14)",
                                      color: active ? "#111111" : "#86efac",
                                      fontWeight: 950,
                                    }}>
                                    Destino automático
                                  </span>
                                  <span
                                    style={{
                                      borderRadius: 999,
                                      padding: "5px 8px",
                                      fontSize: ".63rem",
                                      background: active
                                        ? "rgba(17,17,17,.12)"
                                        : "rgba(248,216,121,.12)",
                                      color: active ? "#111111" : "#F8D879",
                                      fontWeight: 950,
                                    }}>
                                    Recogida a elección · ida y regreso
                                    programados
                                  </span>
                                  {priceChanged && (
                                    <span
                                      style={{
                                        borderRadius: 999,
                                        padding: "5px 8px",
                                        fontSize: ".63rem",
                                        background: active
                                          ? "rgba(17,17,17,.10)"
                                          : "rgba(255,255,255,.06)",
                                        color: active
                                          ? "#111111"
                                          : "rgba(246,242,236,.75)",
                                        fontWeight: 950,
                                      }}>
                                      Tarifa ajustada por vehículo
                                    </span>
                                  )}
                                </div>

                                <div
                                  style={{
                                    position: "relative",
                                    marginTop: 12,
                                    borderTop: active
                                      ? "1px solid rgba(17,17,17,.16)"
                                      : "1px solid rgba(255,255,255,.08)",
                                    paddingTop: 10,
                                    display: "flex",
                                    justifyContent: "space-between",
                                    gap: 10,
                                    alignItems: "center",
                                    fontSize: ".72rem",
                                    fontWeight: 950,
                                    opacity: active ? 0.86 : 0.72,
                                  }}>
                                  <span>
                                    {active
                                      ? "Experiencia seleccionada"
                                      : "Toca para reservar esta experiencia"}
                                  </span>
                                  <span aria-hidden="true">→</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {selectedRoundTripPromotion && (
                        <IonButton
                          expand="block"
                          fill="clear"
                          onClick={clearRoundTripPromotion}
                          style={
                            {
                              /* Este botón vive DENTRO del panel de experiencias, que
                         es oscuro en los dos temas por su degradado literal.
                         Por eso no toma el oro de icono (de día sería #7d5a17
                         sobre #191919: 2,80:1) sino la constante de marca, que
                         vale igual en día y en noche. */
                              "--rp-clear-fg": "var(--rp-gold-light)",
                              marginTop: "12px",
                              fontWeight: 950,
                            } as CSSProperties
                          }>
                          Volver a recogida reservada en Mataveri
                        </IonButton>
                      )}
                    </div>
                  </>
                )}

                {(rideMode === "scheduled" || selectedRoundTripPromotion) && (
                  <div className="rp-request-panel">
                    <div className="rp-request-label">
                      <span aria-hidden className="rp-request-label__tick" />
                      {selectedRoundTripPromotion
                        ? "Programa la ida y el regreso"
                        : "Reserva tu recogida en Mataveri"}
                    </div>

                    <div className="rq-eyebrow">
                      {selectedRoundTripPromotion
                        ? "Fecha y hora de ida"
                        : "Fecha y hora de recogida"}
                    </div>

                    <IonItem
                      lines="none"
                      style={inputItemStyle({ marginBottom: "10px" })}>
                      <IonIcon
                        icon={calendarOutline}
                        slot="end"
                        style={{ color: "var(--rp-icon-fg)" }}
                      />
                      <IonInput
                        type="datetime-local"
                        value={scheduledAt}
                        min={scheduleMinInput}
                        max={scheduleMaxInput}
                        onIonInput={(event) =>
                          setScheduledAt(String(event.detail.value ?? ""))
                        }
                      />
                    </IonItem>

                    <IonNote
                      style={{
                        fontSize: "0.72rem",
                        display: "block",
                        marginBottom: "14px",
                        color: "var(--rp-label)",
                        lineHeight: 1.45,
                      }}>
                      {selectedRoundTripPromotion ? (
                        <>
                          Elige dónde pasamos a buscarte y programa ambos
                          horarios. La reserva queda congelada para conductores
                          y se habilita {SCHEDULE_ACTIVATION_MINUTES} minutos
                          antes de la ida.
                          <br />
                          <strong>Pago obligatorio con tarjeta:</strong> la
                          tarifa incluye ida y regreso. Sin conductor asignado
                          la cancelación es gratuita; con conductor asignado
                          tienes 1 minuto gratis y luego corresponde 30% con
                          tope $3.000.
                        </>
                      ) : (
                        <>
                          El origen queda automático en Aeropuerto Internacional
                          Mataveri de Rapa Nui. Tú eliges el destino final y el
                          tipo de recibimiento. La reserva se habilita{" "}
                          {SCHEDULE_ACTIVATION_MINUTES} minutos antes.
                          <br />
                          <strong>Pago obligatorio con tarjeta:</strong> sin
                          conductor asignado la cancelación es gratuita; con
                          conductor asignado tienes 1 minuto gratis y luego
                          corresponde 30% con tope $3.000.
                        </>
                      )}
                    </IonNote>

                    {requireReturnScheduledAt && (
                      <>
                        <div className="rq-eyebrow">Hora de regreso</div>

                        <IonItem
                          lines="none"
                          style={inputItemStyle({ marginBottom: "14px" })}>
                          <IonIcon
                            icon={calendarOutline}
                            slot="end"
                            style={{ color: "var(--rp-icon-fg)" }}
                          />
                          <IonInput
                            type="datetime-local"
                            value={returnScheduledAt}
                            min={scheduledAt || scheduleMinInput}
                            max={scheduleMaxInput}
                            onIonInput={(event) =>
                              setReturnScheduledAt(
                                String(event.detail.value ?? ""),
                              )
                            }
                          />
                        </IonItem>
                      </>
                    )}

                    {!selectedRoundTripPromotion && (
                      <>
                        <div className="rq-eyebrow">
                          Número de vuelo (opcional)
                        </div>

                        <IonItem
                          lines="none"
                          style={inputItemStyle({ marginBottom: "12px" })}>
                          <IonIcon
                            icon={timeOutline}
                            slot="start"
                            style={{ color: "var(--rp-icon-fg)" }}
                          />
                          <IonInput
                            value={flightNumber}
                            placeholder="Ej: LA800"
                            onIonInput={(event) =>
                              setFlightNumber(String(event.detail.value ?? ""))
                            }
                          />
                        </IonItem>

                        <div className="rq-eyebrow">
                          Recibimiento (opcional)
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                            gap: "8px",
                            marginBottom: "12px",
                          }}>
                          {[
                            {
                              id: "none" as AirportWelcomeOption,
                              icon: carOutline,
                              title: "Solo recogida",
                              text: "El conductor te espera y te lleva directo.",
                            },
                            {
                              id: "flower_lei" as AirportWelcomeOption,
                              icon: flowerOutline,
                              title: "Collar de flores",
                              text: `Bienvenida Rapa Nui al llegar · +${formatCLP(AIRPORT_FLOWER_LEI_SURCHARGE_CLP)}`,
                            },
                          ].map((option) => {
                            const active = airportWelcomeOption === option.id;

                            return (
                              <button
                                key={option.id}
                                type="button"
                                onClick={() =>
                                  setAirportWelcomeOption(option.id)
                                }
                                style={{
                                  border: active
                                    ? "2px solid #D2A43A"
                                    : isDark
                                      ? "1px solid rgba(214,166,64,.34)"
                                      : "1px solid rgba(210,164,58,.32)",
                                  borderRadius: "14px",
                                  minHeight: "82px",
                                  padding: "10px 8px",
                                  background: active
                                    ? "linear-gradient(135deg,#D2A43A 0%,#F8D879 100%)"
                                    : isDark
                                      ? "rgba(255,255,255,.055)"
                                      : "#ffffff",
                                  color: active
                                    ? "#111111"
                                    : isDark
                                      ? "#f6f2ec"
                                      : "#111111",
                                  boxShadow: active
                                    ? "0 10px 22px rgba(210,164,58,.28)"
                                    : isDark
                                      ? "0 6px 14px rgba(0,0,0,.34)"
                                      : "0 6px 14px rgba(0,0,0,.08)",
                                  textAlign: "left",
                                  fontWeight: 950,
                                }}>
                                <div
                                  style={{ fontSize: "1.5rem", lineHeight: 1 }}>
                                  <IonIcon icon={option.icon} />
                                </div>
                                <div
                                  style={{
                                    marginTop: 5,
                                    fontSize: ".78rem",
                                    lineHeight: 1.15,
                                  }}>
                                  {option.title}
                                </div>
                                <div
                                  style={{
                                    marginTop: 4,
                                    color: active
                                      ? "rgba(17,17,17,.62)"
                                      : isDark
                                        ? "rgba(246,242,236,.62)"
                                        : "rgba(17,17,17,.62)",
                                    fontSize: ".64rem",
                                    lineHeight: 1.22,
                                    fontWeight: 850,
                                  }}>
                                  {option.text}
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        {airportWelcomeOption === "flower_lei" && (
                          <div
                            style={{
                              background: isDark
                                ? "linear-gradient(135deg,rgba(214,166,64,.16),rgba(214,166,64,.10))"
                                : "linear-gradient(135deg,rgba(255,246,214,.98),rgba(255,232,166,.98))",
                              border: isDark
                                ? "1px solid rgba(214,166,64,.42)"
                                : "1px solid rgba(210,164,58,.42)",
                              color: isDark ? "#f1c864" : "#4F350D",
                              borderRadius: "14px",
                              padding: "10px 12px",
                              fontSize: "0.74rem",
                              lineHeight: 1.35,
                              fontWeight: 900,
                              marginBottom: "12px",
                              boxShadow: isDark
                                ? "0 10px 22px rgba(0,0,0,.30)"
                                : "0 10px 22px rgba(210,164,58,.14)",
                            }}>
                            <div
                              style={{
                                background: isDark
                                  ? "linear-gradient(135deg,rgba(214,166,64,.16),rgba(214,166,64,.10))"
                                  : "linear-gradient(135deg,rgba(255,246,214,.98),rgba(255,232,166,.98))",
                                border: isDark
                                  ? "1px solid rgba(214,166,64,.42)"
                                  : "1px solid rgba(210,164,58,.42)",
                                color: isDark ? "#f1c864" : "#4F350D",
                                borderRadius: "14px",
                                padding: "12px",
                                fontSize: "0.74rem",
                                lineHeight: 1.35,
                                fontWeight: 900,
                                marginBottom: "12px",
                                boxShadow: isDark
                                  ? "0 10px 22px rgba(0,0,0,.30)"
                                  : "0 10px 22px rgba(210,164,58,.14)",
                              }}>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 6,
                                }}>
                                <IonIcon
                                  icon={flowerOutline}
                                  style={{ fontSize: "1rem" }}
                                />
                                <strong>¿Para cuántas personas?</strong>
                              </div>
                              <div
                                style={{
                                  marginTop: 10,
                                  display: "grid",
                                  gridTemplateColumns:
                                    "44px minmax(72px,1fr) 44px",
                                  gap: 8,
                                  alignItems: "center",
                                }}>
                                <button
                                  type="button"
                                  aria-label="Quitar un collar de flores"
                                  disabled={normalizedFlowerLeiQuantity <= 1}
                                  onClick={() =>
                                    setFlowerLeiQuantity((current) =>
                                      Math.max(
                                        1,
                                        Math.round(Number(current) || 1) - 1,
                                      ),
                                    )
                                  }
                                  style={{
                                    height: 40,
                                    borderRadius: 12,
                                    border: "1px solid rgba(210,164,58,.55)",
                                    background: isDark
                                      ? "rgba(255,255,255,.08)"
                                      : "#fff",
                                    color: isDark ? "#F8D879" : "#4F350D",
                                    fontWeight: 950,
                                    opacity:
                                      normalizedFlowerLeiQuantity <= 1
                                        ? 0.45
                                        : 1,
                                  }}>
                                  <IonIcon icon={removeOutline} />
                                </button>
                                <div
                                  aria-live="polite"
                                  style={{
                                    minHeight: 40,
                                    display: "grid",
                                    placeItems: "center",
                                    borderRadius: 12,
                                    background: isDark
                                      ? "rgba(0,0,0,.22)"
                                      : "rgba(255,255,255,.72)",
                                    border: "1px solid rgba(210,164,58,.35)",
                                    fontSize: "1rem",
                                    fontWeight: 950,
                                  }}>
                                  {normalizedFlowerLeiQuantity}
                                </div>
                                <button
                                  type="button"
                                  aria-label="Agregar un collar de flores"
                                  disabled={
                                    normalizedFlowerLeiQuantity >=
                                    AIRPORT_FLOWER_LEI_MAX_QUANTITY
                                  }
                                  onClick={() =>
                                    setFlowerLeiQuantity((current) =>
                                      Math.min(
                                        AIRPORT_FLOWER_LEI_MAX_QUANTITY,
                                        Math.max(
                                          1,
                                          Math.round(Number(current) || 1) + 1,
                                        ),
                                      ),
                                    )
                                  }
                                  style={{
                                    height: 40,
                                    borderRadius: 12,
                                    border: "1px solid rgba(210,164,58,.55)",
                                    background:
                                      "linear-gradient(135deg,#D2A43A,#F8D879)",
                                    color: "#111",
                                    fontWeight: 950,
                                    opacity:
                                      normalizedFlowerLeiQuantity >=
                                      AIRPORT_FLOWER_LEI_MAX_QUANTITY
                                        ? 0.5
                                        : 1,
                                  }}>
                                  <IonIcon icon={addOutline} />
                                </button>
                              </div>
                              <div style={{ marginTop: 9 }}>
                                {normalizedFlowerLeiQuantity}{" "}
                                {normalizedFlowerLeiQuantity === 1
                                  ? "collar"
                                  : "collares"}{" "}
                                · {formatCLP(airportWelcomeSurchargeClp)} en
                                total
                              </div>
                              <div
                                style={{
                                  marginTop: 3,
                                  opacity: 0.78,
                                  fontSize: ".66rem",
                                }}>
                                {formatCLP(AIRPORT_FLOWER_LEI_SURCHARGE_CLP)}{" "}
                                por persona.
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    <div
                      style={{
                        background: isDark
                          ? "linear-gradient(135deg,rgba(214,166,64,.14) 0%,rgba(214,166,64,.08) 100%)"
                          : "linear-gradient(135deg,#fff7d6 0%,#ffe39a 100%)",
                        color: isDark ? "#f0e6d4" : "#111",
                        borderRadius: "14px",
                        padding: "13px 14px",
                        fontSize: "0.8rem",
                        lineHeight: 1.45,
                        border: isDark
                          ? "1px solid rgba(214,166,64,.34)"
                          : "1px solid rgba(210,164,58,.36)",
                        boxShadow: isDark
                          ? "0 12px 24px rgba(0,0,0,.32)"
                          : "0 12px 24px rgba(210,164,58,.16)",
                      }}>
                      {selectedRoundTripPromotion ? (
                        <>
                          <>
                            <IonIcon
                              icon={leafOutline}
                              style={{
                                verticalAlign: "middle",
                                marginRight: 4,
                                fontSize: "1rem",
                              }}
                            />{" "}
                            <strong>Experiencia ida y vuelta reservada.</strong>{" "}
                            Ambos horarios quedarán programados y vinculados a
                            la misma reserva.
                          </>
                        </>
                      ) : (
                        <>
                          <>
                            <IonIcon
                              icon={airplaneOutline}
                              style={{
                                verticalAlign: "middle",
                                marginRight: 4,
                                fontSize: "1rem",
                              }}
                            />{" "}
                            <strong>Recogida programada desde Mataveri.</strong>{" "}
                            Tú eliges el destino, la hora y el recibimiento.
                            Prepararemos tu viaje y te avisaremos cuando tu
                            RapaGo esté listo para ir por ti.
                          </>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <div className="rq-eyebrow">Notas (opcional)</div>

                <IonItem
                  lines="none"
                  style={inputItemStyle({ marginBottom: "18px" })}>
                  <IonTextarea
                    value={notesInput}
                    placeholder="Ej: Maletas grandes"
                    rows={3}
                    maxlength={RAPAGO_PASSENGER_NOTE_MAX_LENGTH}
                    onIonInput={(event) =>
                      setNotesInput(String(event.detail.value ?? ""))
                    }
                  />
                </IonItem>
              </div>

              {/* ── Paso 3 · Pago ── */}
              <div className="rq-step" data-active={wizardStep === 2}>
                {/* Navegación del paso 3 */}
                {wizardStep === 2 && (
                  <div className="rq-nav" style={{ marginBottom: "16px" }}>
                    <button
                      type="button"
                      className="rq-nav__back"
                      onClick={() => goToWizardStep(wizardStep - 1)}>
                      <IonIcon icon={arrowBackOutline} aria-hidden="true" />
                      Anterior
                    </button>

                    <button
                      type="button"
                      className="rq-nav__next"
                      disabled={!wizardCanAdvance}
                      onClick={() => goToWizardStep(wizardStep + 1)}>
                      Siguiente
                      <IonIcon icon={arrowForwardOutline} aria-hidden="true" />
                    </button>
                  </div>
                )}

                {/* Sin píldora de total al lado: cada tarjeta trae su propio
                    importe —que no tiene por qué coincidir entre efectivo y
                    tarjeta—, así que un único "Total" aquí repetía el dato y
                    además se cortaba con puntos suspensivos. */}
                <div className="rp-request-vehicle-heading">
                  <div>
                    <strong>Elige cómo pagar</strong>
                    <span>Precio final, sin sorpresas</span>
                  </div>
                </div>

                {/* Las dos formas de pago están siempre a la vista y con la
                    misma forma que las tarjetas de vehículo del paso anterior:
                    icono, nombre, detalle y precio a la derecha. Antes vivían
                    detrás de un botón que las plegaba en cuanto se elegía una,
                    lo que en un paso dedicado solo a esto dejaba la pantalla
                    prácticamente vacía y obligaba a un toque de más para ver o
                    cambiar la elección.

                    El estado elegido no se apoya solo en el color: la tarjeta
                    seleccionada añade una fila "Seleccionado" con su check, que
                    es lo que la hace distinguible sin percibir el dorado. */}
                <div
                  className="rp-request-pay-list"
                  role="radiogroup"
                  aria-label="Forma de pago">
                  {/* Tarjeta va PRIMERA. Es el medio que la app puede
                      confirmar por sí sola (Klap) y el único admitido en las
                      reservas: ponerlo de segundo hacía que el pasajero
                      eligiera efectivo por inercia y luego se topara con el
                      bloqueo. */}
                  <button
                    type="button"
                    className="rp-request-pay-card"
                    role="radio"
                    aria-checked={paymentMethod === "card"}
                    onClick={() => handleSelectPayment("card")}>
                    <span className="rp-request-pay-icon" aria-hidden="true">
                      <IonIcon icon={cardOutline} />
                    </span>

                    <span className="rp-request-pay-copy">
                      <span className="rp-request-pay-title">Tarjeta</span>
                      <span className="rp-request-pay-desc">
                        Pago seguro con Klap
                      </span>
                      <span className="rp-request-pay-state">
                        <IonIcon
                          icon={checkmarkCircleOutline}
                          aria-hidden="true"
                        />
                        Seleccionado
                      </span>
                    </span>

                    <span className="rp-request-pay-price">
                      <strong>{cardPaymentLabel}</strong>
                      <small>{cardPaymentUsdLabel}</small>
                    </span>
                  </button>

                  {/* En reservas el efectivo no se admite. El botón se queda
                      pulsable a propósito —solo atenuado y con aria-disabled—
                      porque su manejador es quien explica el porqué y cambia a
                      tarjeta; deshabilitarlo de verdad dejaría al pasajero
                      tocando algo que no responde y sin saber la razón. */}
                  <button
                    type="button"
                    className="rp-request-pay-card"
                    role="radio"
                    aria-checked={paymentMethod === "cash"}
                    aria-disabled={reservationRequiresCard}
                    data-unavailable={reservationRequiresCard}
                    onClick={() => handleSelectPayment("cash")}>
                    <span className="rp-request-pay-icon" aria-hidden="true">
                      <IonIcon icon={cashOutline} />
                    </span>

                    <span className="rp-request-pay-copy">
                      <span className="rp-request-pay-title">Efectivo</span>
                      <span className="rp-request-pay-desc">
                        {reservationRequiresCard
                          ? "No disponible al reservar"
                          : "Le pagas al conductor al llegar"}
                      </span>
                      <span className="rp-request-pay-state">
                        <IonIcon
                          icon={checkmarkCircleOutline}
                          aria-hidden="true"
                        />
                        Seleccionado
                      </span>
                    </span>

                    <span className="rp-request-pay-price">
                      <strong>{cashPaymentLabel}</strong>
                      <small>{cashPaymentUsdLabel}</small>
                    </span>
                  </button>
                </div>

                {reservationRequiresCard && (
                  <div className="rq-hint">
                    <IonIcon icon={cardOutline} aria-hidden="true" />
                    Las reservas se pagan con tarjeta. Sin conductor asignado
                    cancelar es gratis.
                  </div>
                )}

                {paymentMethod === null && (
                  <div className="rq-hint rq-hint--pending">
                    <IonIcon icon={alertCircleOutline} aria-hidden="true" />
                    Elige una forma de pago para continuar.
                  </div>
                )}

                {/* Beneficio del saldo. Antes era una IonCard con degradados y
                    colores escritos a mano (#EAFBF0, #111111…), así que en modo
                    noche seguía siendo un recuadro blanco pegado en medio de
                    una pantalla oscura. Ahora usa los tokens del tema y se
                    adapta solo. */}
                {hasAvailableWalletBenefit &&
                  paymentMethod !== null &&
                  activePaymentAmountBeforeWallet != null && (
                    <section
                      className="rp-request-benefit"
                      aria-label="Saldo a favor">
                      <div className="rp-request-benefit__head">
                        <span
                          className="rp-request-benefit__icon"
                          aria-hidden="true">
                          <IonIcon icon={walletOutline} />
                        </span>

                        <div className="rp-request-benefit__copy">
                          <strong>¿Usar tu saldo a favor?</strong>
                          <span>
                            {walletBenefitLoading
                              ? "Sincronizando tu saldo…"
                              : `Tienes ${formatCLP(availableWalletBenefitTotalClp)} disponible.`}
                          </span>
                        </div>
                      </div>

                      <div
                        className="rp-request-benefit__choice"
                        role="radiogroup"
                        aria-label="Usar saldo a favor">
                        <button
                          type="button"
                          className="rp-request-benefit__btn"
                          role="radio"
                          aria-checked={useWalletBenefit === true}
                          onClick={() => {
                            setUseWalletBenefit(true);
                            setSubmitError(null);
                          }}>
                          <IonIcon
                            icon={checkmarkCircleOutline}
                            aria-hidden="true"
                          />
                          Sí, usar
                        </button>

                        <button
                          type="button"
                          className="rp-request-benefit__btn"
                          role="radio"
                          aria-checked={useWalletBenefit === false}
                          onClick={() => {
                            setUseWalletBenefit(false);
                            setSubmitError(null);
                          }}>
                          <IonIcon icon={closeOutline} aria-hidden="true" />
                          No usar
                        </button>
                      </div>

                      {useWalletBenefit === true &&
                        activeWalletBenefitDiscountClp > 0 &&
                        activePaymentAmountAfterWallet != null && (
                          <dl className="rp-request-benefit__breakdown">
                            <div>
                              <dt>Total original</dt>
                              <dd>
                                {formatCLP(activePaymentAmountBeforeWallet)}
                              </dd>
                            </div>
                            <div>
                              <dt>Descuento</dt>
                              <dd data-kind="discount">
                                -{formatCLP(activeWalletBenefitDiscountClp)}
                              </dd>
                            </div>
                            <div data-total="true">
                              <dt>A pagar ahora</dt>
                              <dd>
                                {formatCLP(activePaymentAmountAfterWallet)}
                              </dd>
                            </div>
                          </dl>
                        )}

                      {useWalletBenefit === false && (
                        <p className="rp-request-benefit__note">
                          Tu saldo seguirá disponible para otro viaje.
                        </p>
                      )}
                    </section>
                  )}
              </div>

              {/* ── Paso 4 · Confirmar ── */}
              <div className="rq-step" data-active={wizardStep === 3}>
                {/* Navegación del paso 4 */}
                {wizardStep === 3 && (
                  <div
                    className="rq-nav rq-nav--last"
                    style={{
                      marginBottom: "16px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "12px",
                    }}>
                    <button
                      type="button"
                      className="rq-nav__back"
                      onClick={() => goToWizardStep(wizardStep - 1)}>
                      <IonIcon icon={arrowBackOutline} aria-hidden="true" />
                      Anterior
                    </button>

                    {/* Botón de pago movido a la navegación, arriba y al
                        costado derecho del "Anterior". Solo dice el nombre de
                        la acción sin condiciones: las decisiones ya están
                        todas tomadas antes de llegar aquí. */}
                    <IonButton
                      className="rp-request-confirm-sticky"
                      onClick={() => void handleRequest()}
                      disabled={!canRequest || submitting}
                      style={
                        {
                          "--background": "var(--rp-btn-primary)",
                          "--background-activated":
                            "linear-gradient(135deg,#c89b3c,#b84f2e)",
                          "--color": "var(--rp-btn-primary-fg)",
                          flexShrink: 0,
                        } as CSSProperties
                      }>
                      {submitting ? (
                        <IonSpinner name="dots" />
                      ) : paymentMethod === "cash" ? (
                        "SOLICITAR VIAJE"
                      ) : (
                        "PAGAR CON TARJETA"
                      )}
                    </IonButton>
                  </div>
                )}
                {/* Resumen del viaje.

                    Antes esta pantalla repetía el mismo dato hasta tres veces
                    —el total salía en la cabecera, otra vez dentro de la caja
                    "Resumen de tarifa" y otra en el chip de pago; los km, el
                    tipo de pasajero y la forma de pago iban duplicados igual—
                    y, a cambio, NO enseñaba lo único que de verdad hay que
                    revisar antes de confirmar: a dónde se va. Todo ese bulto
                    sobrante era lo que obligaba a recorrer la hoja entera con
                    el dedo para alcanzar el botón.

                    Ahora cada dato aparece UNA vez y en el orden en que se fue
                    decidiendo: ruta, vehículo, pago, total. El desglose de la
                    tarifa baja a un desplegable porque es la explicación del
                    precio, no el precio.

                    Los colores salen de tokens. La caja del desglose llevaba
                    fondo blanco y texto #111111 escritos a mano, así que en
                    modo noche era una losa blanca en mitad de la pantalla. */}
                <section
                  className="rp-request-review"
                  aria-label="Resumen de tu viaje">
                  <h3 className="rp-request-review__title">
                    Resumen de tu viaje
                  </h3>

                  {/* Ruta: mismo riel de punto y cuadrado que el paso 1, para
                      que los dos extremos se lean como un viaje y no como dos
                      filas sueltas. */}
                  <div className="rp-request-review__route">
                    <div className="rp-request-review__stop" data-kind="origin">
                      <span
                        className="rp-request-review__marker"
                        aria-hidden="true"
                      />
                      <div className="rp-request-review__stop-copy">
                        <span className="rp-request-review__label">Origen</span>
                        <strong>
                          {originPoint?.text || originInput || "Sin definir"}
                        </strong>
                      </div>
                    </div>

                    <div
                      className="rp-request-review__stop"
                      data-kind="destination">
                      <span
                        className="rp-request-review__marker"
                        aria-hidden="true"
                      />
                      <div className="rp-request-review__stop-copy">
                        <span className="rp-request-review__label">
                          Destino
                        </span>
                        <strong>
                          {selectedRoundTripPromotion?.destinationName ||
                            destinationPoint?.text ||
                            destInput ||
                            "Sin definir"}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <ul className="rp-request-review__rows">
                    <li className="rp-request-review__row">
                      <span
                        className="rp-request-review__icon"
                        aria-hidden="true">
                        <IonIcon icon={vehicleCategoryIcon(vehicleCategory)} />
                      </span>
                      <div className="rp-request-review__cell">
                        <span className="rp-request-review__label">
                          Vehículo
                        </span>
                        <strong>{vehicleCategoryTitle(vehicleCategory)}</strong>
                      </div>
                      <span className="rp-request-review__aside">
                        {fareQuote
                          ? `${fareQuote.km.toFixed(1)} km · ${fareQuote.minutes} min`
                          : "Calculando ruta"}
                      </span>
                    </li>

                    <li className="rp-request-review__row">
                      <span
                        className="rp-request-review__icon"
                        aria-hidden="true">
                        <IonIcon
                          icon={
                            paymentMethod === "card" ? cardOutline : cashOutline
                          }
                        />
                      </span>
                      <div className="rp-request-review__cell">
                        <span className="rp-request-review__label">Pago</span>
                        <strong>
                          {paymentMethod === null
                            ? "Sin elegir"
                            : getPaymentLabel(paymentMethod)}
                        </strong>
                      </div>
                      {/* Vuelve al paso donde se elige, en vez de abrir aquí un
                          panel: el pago tiene su propio paso desde que el flujo
                          se partió en cuatro. */}
                      <button
                        type="button"
                        className="rp-request-review__change"
                        onClick={() => goToWizardStep(2)}>
                        Cambiar
                      </button>
                    </li>

                    <li className="rp-request-review__row">
                      <span
                        className="rp-request-review__icon"
                        aria-hidden="true">
                        <IonIcon icon={checkmarkCircleOutline} />
                      </span>
                      <div className="rp-request-review__cell">
                        <span className="rp-request-review__label">
                          Pasajero
                        </span>
                        <strong>
                          {passengerFareTypeLabel(effectivePassengerFareType)}
                        </strong>
                      </div>
                      <span className="rp-request-review__aside">
                        {selectedRoundTripPromotion
                          ? "Ida y vuelta"
                          : tripFareModeLabel(tripFareMode)}
                      </span>
                    </li>
                  </ul>

                  {selectedRoundTripPromotion && returnScheduledAt ? (
                    <p className="rp-request-review__note">
                      <IonIcon icon={calendarOutline} aria-hidden="true" />
                      Regreso agendado para{" "}
                      {formatScheduleDateTime(returnScheduledAt)}
                    </p>
                  ) : rideMode === "scheduled" && scheduledAt ? (
                    <p className="rp-request-review__note">
                      <IonIcon icon={calendarOutline} aria-hidden="true" />
                      Agendado para {formatScheduleDateTime(scheduledAt)}
                      {requireReturnScheduledAt && returnScheduledAt
                        ? ` · regreso ${formatScheduleDateTime(returnScheduledAt)}`
                        : ""}
                    </p>
                  ) : null}

                  {hasAirportFlowerLei && (
                    <p className="rp-request-review__note">
                      <IonIcon icon={flowerOutline} aria-hidden="true" />
                      Incluye collar de flores +
                      {formatCLP(AIRPORT_FLOWER_LEI_SURCHARGE_CLP)}
                    </p>
                  )}

                  {/* El total va solo y en grande: es el dato por el que existe
                      esta pantalla, así que nada compite a su lado. */}
                  <div className="rp-request-review__total">
                    <div className="rp-request-review__cell">
                      <span className="rp-request-review__label">Total</span>
                      <small>Precio final · sin sorpresas</small>
                    </div>
                    <div className="rp-request-review__amount">
                      <strong>{cashPaymentLabel}</strong>
                      <small>{cashPaymentUsdLabel}</small>
                    </div>
                  </div>


                  {pendingPassengerChargeTotalClp > 0 && (
                    <div className="rp-request-review__warn" role="note">
                      <IonIcon icon={alertCircleOutline} aria-hidden="true" />
                      <span>
                        A este viaje se le suman cargos aprobados por{" "}
                        <strong>
                          {formatCLP(pendingPassengerChargeTotalClp)}
                        </strong>
                        .
                        {pendingCancellationChargeTotalClp > 0 && (
                          <>
                            {" "}
                            Cancelación:{" "}
                            <strong>
                              {formatCLP(pendingCancellationChargeTotalClp)}
                            </strong>
                            .
                          </>
                        )}
                        {pendingNoShowChargeTotalClp > 0 && (
                          <>
                            {" "}
                            No Show:{" "}
                            <strong>
                              {formatCLP(pendingNoShowChargeTotalClp)}
                            </strong>
                            .
                          </>
                        )}
                      </span>
                    </div>
                  )}

                  {/* Plegado por defecto y con <details>, que ya trae el
                      comportamiento y la semántica de "abrir para saber más"
                      sin estado propio ni JS. Quien solo quiere pedir el viaje
                      no lo abre; quien duda del precio, sí. */}
                  {fareQuote && (
                    <details className="rp-request-review__detail">
                      <summary>¿Cómo calculamos tu tarifa?</summary>
                      <p>
                        {fareQuote.calculationType === "fixed"
                          ? "Destino con tarifa fija."
                          : fareQuote.ruralKm > 0
                            ? `${fareQuote.urbanKm.toFixed(1)} km urbanos + ${fareQuote.ruralKm.toFixed(1)} km rurales.`
                            : `${fareQuote.urbanKm.toFixed(1)} km urbanos.`}{" "}
                        {selectedRoundTripPromotion
                          ? "Experiencia con ida y regreso programados."
                          : fareQuote.ruralKm > 0
                            ? "Se combina el tramo urbano y el rural según la ruta."
                            : "Tarifa calculada con las reglas activas de RAPA GO."}
                      </p>
                    </details>
                  )}
                </section>
              </div>
            </div>
          </div>

          <div
            className="rp-request-action-dock"
            role="group"
            aria-label="Confirmación del viaje"
            data-last={wizardIsLastStep}>
            {submitError && (
              <p className="rq-dock-error" role="alert">
                {submitError}
              </p>
            )}
          </div>
        </div>

        <IonAlert
          isOpen={pendingRoundTripPromotion !== null}
          header="¿Reservar esta experiencia?"
          message={
            pendingRoundTripPromotion
              ? `${pendingRoundTripPromotion.destinationName}, ida y vuelta por ${formatCLP(calculateRoundTripExperienceFare(pendingRoundTripPromotion, vehicleCategory, fareRules))}. Podrás elegir la recogida y programar ida y regreso. ¿Deseas reservarla?`
              : ""
          }
          buttons={[
            {
              text: "No",
              role: "cancel",
              handler: () => setPendingRoundTripPromotion(null),
            },
            {
              text: "Sí, reservar",
              handler: () => {
                const promotion = pendingRoundTripPromotion;
                setPendingRoundTripPromotion(null);
                if (promotion) void handleSelectRoundTripPromotion(promotion);
              },
            },
          ]}
          onDidDismiss={() => setPendingRoundTripPromotion(null)}
        />

        {pickerTarget && (
          <MapPointPicker
            isOpen={pickerTarget !== null}
            title={
              pickerTarget === "origin"
                ? "Confirmar recogida"
                : "Confirmar destino"
            }
            mode={pickerTarget}
            initialPoint={pickerInitialPoint}
            autoFocusSearch={pickerAutoFocusSearch}
            onCancel={() => {
              setPickerAutoFocusSearch(false);
              setPickerTarget(null);
            }}
            onConfirm={(point) => {
              suppressPickerOpenRef.current = true;

              if (pickerTarget === "origin") {
                applyOrigin(point);
              } else {
                applyDestination(point);
              }

              setPickerAutoFocusSearch(false);
              setPickerTarget(null);

              window.setTimeout(() => {
                suppressPickerOpenRef.current = false;
              }, 900);
            }}
          />
        )}
      </IonContent>
    </IonPage>
  );
}
