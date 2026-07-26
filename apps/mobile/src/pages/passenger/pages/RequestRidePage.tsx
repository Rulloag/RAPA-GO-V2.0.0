import {
  IonAlert,
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonModal,
  IonNote,
  IonPage,
  IonSpinner,
  IonText,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import {
  arrowBackOutline,
  calendarOutline,
  checkmarkCircleOutline,
  createOutline,
  flagOutline,
  locationOutline,
  locateOutline,
  navigateOutline,
  searchOutline,
  timeOutline,
} from "ionicons/icons";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useHistory } from "react-router-dom";
import { ROUTES } from "../../../navigation/routes.js";
import { MapFallback, loadRapaGoGoogleMaps } from "../../../components/MapFallback.js";
import { useAuth } from "../../../features/auth/index.js";
import {
  ridesService,
  type CreateRideInput,
} from "../../../features/rides/rides.service.js";
import { walletService } from "../../../features/wallet/wallet.service.js";
import { RIDE_STATUS_LABEL } from "../shared.js";
import { getApiOrigin as getConfiguredApiOrigin } from "../../../services/api/apiBaseUrl.js";
import { preSearchLocationService } from "../../../features/location/preSearchLocation.service.js";

import { RapagoSectionHeader } from "../../../components/RapagoSectionHeader.js";
import { useRapagoSectionTheme } from "../../../theme/rapagoTheme.js";



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
const RAPAGO_REQUEUED_PASSENGER_FORCE_KEY = "rapago_requeued_passenger_visible_rides_v1";
const RAPAGO_REQUEUED_RIDES_EVENT = "rapago:ride-requeued-after-driver-cancel";
const RAPAGO_PASSENGER_PENDING_CHARGES_KEY = "rapago_passenger_pending_charges_v1";
const RAPAGO_PASSENGER_PENDING_CHARGE_EVENT = "rapago:passenger-pending-charge-updated";

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
  return String(value ?? "").trim().toLowerCase();
}

function normalizePendingChargeUserId(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
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
    : "Cargo por cancelación desde el minuto 3 aprobado por administración para sumarlo al próximo viaje.";
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
    item.passengerEmail ??
      item.ownerKey ??
      item.userEmail ??
      item.email,
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
      ? decoded.filter(
          (item): item is Record<string, unknown> =>
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
          ownerKey:
            typeof item.ownerKey === "string"
              ? item.ownerKey
              : null,
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
          createdAt:
            typeof item.createdAt === "string"
              ? item.createdAt
              : null,
          appliedRideId:
            typeof item.appliedRideId === "string"
              ? item.appliedRideId
              : null,
          appliedAt:
            typeof item.appliedAt === "string"
              ? item.appliedAt
              : null,
        };
      })
      .filter((charge) => {
        const rawCharge = parsed.find(
          (item) => String(item.id ?? "") === String(charge.id),
        ) ?? (charge as unknown as Record<string, unknown>);

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

  const payload = (await response
    .json()
    .catch(() => ({}))) as Record<string, unknown>;

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
    .filter(
      (item): item is BackendRidePolicyChargeForRequest =>
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
      feeCapClp: Math.max(
        0,
        Math.round(Number(item.feeCapClp ?? 0)),
      ),
      type:
        item.type === "no_show"
          ? "no_show"
          : "late_cancellation",
      status: "pending_next_ride",
      adminReviewStatus: "charge_pending_next_ride",
      title:
        item.type === "no_show"
          ? "No Show aprobado"
          : "Cancelación aprobada",
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
        charge.amountClp > 0 &&
        !charge.appliedRideId &&
        !charge.appliedAt,
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
      const adminStatus = String(
        item.adminReviewStatus ?? "",
      ).toLowerCase();

      const approvedAmountClp =
        calculateApprovedPassengerChargeForRequest(item);

      const shouldApply =
        pendingChargeBelongsToCurrentUser(item, user) &&
        isPassengerPendingChargeSupportedType(type) &&
        approvedAmountClp > 0 &&
        (
          status === "pending_next_ride" ||
          adminStatus === "charge_pending_next_ride"
        ) &&
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
          Number.isFinite(Number(item.feeCapClp)) &&
          Number(item.feeCapClp) > 0
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
      new CustomEvent(
        "rapago:admin-passenger-pending-charge-updated",
        { detail: { charges: next } },
      ),
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
  return String(value ?? "").trim().toLowerCase();
}

function getWalletBenefitSessionEmailForRequest(user: unknown): string {
  if (!user || typeof user !== "object") return "";
  return normalizeWalletBenefitEmailForRequest((user as Record<string, unknown>).email);
}

function isPassengerWalletBenefitAvailableForRequest(benefit: PassengerWalletBenefitForRequest): boolean {
  const status = String(benefit.status ?? "").toLowerCase();
  const adminStatus = String(benefit.adminReviewStatus ?? "").toLowerCase();

  return (status === "available" || status === "approved" || adminStatus === "admin_approved") && benefit.amountClp > 0;
}

function readPassengerWalletBenefitsForRequest(user: unknown): PassengerWalletBenefitForRequest[] {
  try {
    const sessionEmail = getWalletBenefitSessionEmailForRequest(user);
    const raw = localStorage.getItem(RAPAGO_WALLET_BENEFITS_KEY_REQUEST);
    const parsed = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item, index): PassengerWalletBenefitForRequest => ({
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
        appliedRideId: typeof item.appliedRideId === "string" ? item.appliedRideId : null,
        appliedAt: typeof item.appliedAt === "string" ? item.appliedAt : null,
        usedAmountClp: Number.isFinite(Number(item.usedAmountClp)) ? Math.round(Number(item.usedAmountClp)) : null,
      }))
      .filter((benefit) => {
        if (!isPassengerWalletBenefitAvailableForRequest(benefit)) return false;
        const owner = normalizeWalletBenefitEmailForRequest(benefit.passengerEmail || benefit.ownerKey);
        return Boolean(sessionEmail && owner && owner === sessionEmail);
      })
      .sort((a, b) => new Date(String(a.createdAt ?? 0)).getTime() - new Date(String(b.createdAt ?? 0)).getTime());
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
    const parsed = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
    if (!Array.isArray(parsed)) return;

    let remaining = amountToUse;
    const now = new Date().toISOString();
    const rideId = input.rideId || `local-${Date.now()}`;
    const extraAvailableBenefits: Array<Record<string, unknown>> = [];

    const next = parsed.map((item, index) => {
      const benefit: PassengerWalletBenefitForRequest = {
        id: String(item.id ?? `wallet-benefit-${index}`),
        passengerEmail: typeof item.passengerEmail === "string" ? item.passengerEmail : null,
        ownerKey: typeof item.ownerKey === "string" ? item.ownerKey : null,
        amountClp: Math.max(0, Math.round(Number(item.amountClp ?? item.amount ?? 0))),
        status: String(item.status ?? "pending_admin"),
        adminReviewStatus: typeof item.adminReviewStatus === "string" ? item.adminReviewStatus : null,
      };
      const owner = normalizeWalletBenefitEmailForRequest(benefit.passengerEmail || benefit.ownerKey);
      const belongsToUser = Boolean(sessionEmail && owner && owner === sessionEmail);

      if (!belongsToUser || remaining <= 0 || !isPassengerWalletBenefitAvailableForRequest(benefit)) {
        return item;
      }

      const benefitAmount = Math.max(0, Math.round(Number(benefit.amountClp ?? 0)));
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

function compactRideForLocalStorage(ride: LocalPassengerRideData): LocalPassengerRideData {
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

    if (typeof value === "string" && value.startsWith("data:") && value.length > 1500) {
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

function readRideDateMs(ride: LocalPassengerRideData, keys: string[]): number | null {
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

function rideBelongsToSessionPassenger(ride: LocalPassengerRideData, user?: unknown): boolean {
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

    for (const key of [RAPAGO_REQUEUED_RIDES_KEY, RAPAGO_REQUEUED_PASSENGER_FORCE_KEY]) {
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
      requeuedAt: ride.requeuedAt ?? ride.cancelledAt ?? ride.updatedAt ?? ride.requestedAt ?? ride.createdAt ?? null,
      requeuedReason: "driver_cancelled",
      forceActiveAfterDriverCancel: true,
      passengerNotice: "Tu conductor canceló el viaje, estamos buscando uno nuevo.",
    }));
  } catch {
    return [];
  }
}

function isRequestDriverCancelledRequeuedRide(ride: LocalPassengerRideData): boolean {
  const status = normalizeRideStatus(ride.status);
  const cancelledBy = normalizeRideStatus(ride.cancelledByRole ?? ride.cancelledBy);
  const reason = normalizeRideStatus(ride.requeuedReason ?? ride.requeueReason ?? ride.cancellationReason);
  const notice = normalizeRideStatus(ride.passengerNotice ?? ride.passengerNotification ?? ride.notes);

  if (cancelledBy.includes("passenger") || cancelledBy.includes("pasajero")) return false;

  return (
    ride.forceActiveAfterDriverCancel === true ||
    reason.includes("driver_cancelled") ||
    reason.includes("conductor_cancel") ||
    notice.includes("tu conductor cancel") ||
    notice.includes("estamos buscando uno nuevo") ||
    (status === "cancelled" && (
      cancelledBy.includes("driver") ||
      cancelledBy.includes("conductor") ||
      reason.includes("driver") ||
      reason.includes("conductor")
    ))
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

  return activityMs >= nowMs - activeWindow && activityMs <= nowMs + 5 * 60 * 1000;
}

function hasPassengerActiveRideForRequest(user?: unknown): boolean {
  const rides = [...readLocalPassengerRides(), ...readRequeuedPassengerRidesForRequest()];
  const nowMs = Date.now();

  return rides.some((ride) => isPassengerRideActiveForNewRequest(ride, user, nowMs));
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
    passengerFareLabel: input.passengerFareLabel ?? (input.passengerFareType ? passengerFareTypeLabel(input.passengerFareType) : null),
    nationality: input.passengerFareLabel ?? (input.passengerFareType ? passengerFareTypeLabel(input.passengerFareType) : null),
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
      localStorage.setItem("rapago_last_scheduled_ride_for_admin", JSON.stringify(compacted[0]));
    }

    window.dispatchEvent(new CustomEvent("rapago:admin-scheduled-rides-updated", { detail: { rides: compacted } }));
  } catch {
    // No bloquea la pantalla si el navegador no permite guardar localmente.
  }
}

function upsertLocalAdminScheduledRide(ride: LocalPassengerRideData): void {
  if (ride.isScheduled !== true) return;
  const current = readLocalAdminScheduledRides();
  const key = getLocalAdminScheduledRideKey(ride);
  const withoutDuplicate = current.filter((item) => getLocalAdminScheduledRideKey(item) !== key);
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
    bookingPurpose: isRoundTripPromotion ? "round_trip_promotion" : "airport_pickup",
    serviceType: isRoundTripPromotion ? "round_trip_promotion" : "airport_pickup",
    localOnly: true,
  };
}

function createRoundTripReturnPickupRide(input: {
  returnOriginText: string;
  returnOriginAddress: string;
  returnOriginLat: number;
  returnOriginLng: number;
  returnDestinationText: string;
  returnDestinationAddress: string;
  returnDestinationLat: number;
  returnDestinationLng: number;
  returnScheduledAt: string;
  promotionTitle: string;
  promotionDestinationName: string;
  relatedOutboundRideId?: string | null;
  passengerNote?: string | null;
  passengerName?: string | null;
  passengerEmail?: string | null;
  passengerFareType?: PassengerFareType | null;
  passengerFareLabel?: string | null;
}): LocalPassengerRideData {
  const scheduleFields = buildRideScheduleFields({
    rideMode: "scheduled",
    tripFareMode: "one_way",
    scheduledAt: input.returnScheduledAt,
    returnScheduledAt: "",
    scheduleKind: "round_trip_promotion",
  });
  const scheduledAtIso = String(scheduleFields.scheduledAt ?? "");
  const activationAtIso = String(
    scheduleFields.scheduleActivationAt ??
      scheduleFields.scheduledActivationAt ??
      scheduleFields.dispatchAt ??
      "",
  );
  const returnPassengerNote = sanitizePassengerRideNote(input.passengerNote);
  const notes: string[] = [];
  appendPassengerRideNote(notes, returnPassengerNote);
  notes.push(
    "Tipo de solicitud: agendamiento de recogida de regreso.",
    "IDA_MAS_AGENDAMIENTO_RECOGIDA: true.",
    `Promoción asociada: ${input.promotionTitle}.`,
    `Recogida de regreso en: ${input.promotionDestinationName}.`,
    "Este regreso está incluido en la promoción ida y vuelta. No cobrar nuevamente al pasajero.",
    input.relatedOutboundRideId ? `Viaje de ida relacionado: ${input.relatedOutboundRideId}.` : "Viaje de ida relacionado: solicitud principal.",
    `RAPAGO_SCHEDULED_AT: ${scheduledAtIso}.`,
    `RAPAGO_ACTIVATION_AT: ${activationAtIso}.`,
    `Fecha y hora de recogida agendada: ${scheduledAtIso}.`,
    `Viaje agendado para: ${formatScheduleDateTime(scheduledAtIso || input.returnScheduledAt)}.`,
    `La solicitud se activa automáticamente ${SCHEDULE_ACTIVATION_MINUTES} minutos antes: ${formatScheduleDateTime(activationAtIso)}.`,
    `Reserva congelada para conductores hasta: ${activationAtIso}.`,
    `Dirección origen confirmada: ${input.returnOriginAddress}.`,
    `Dirección destino confirmada: ${input.returnDestinationAddress}.`,
    `Coordenadas recogida accesible: ${input.returnOriginLat.toFixed(6)}, ${input.returnOriginLng.toFixed(6)}.`,
    `Coordenadas destino accesible: ${input.returnDestinationLat.toFixed(6)}, ${input.returnDestinationLng.toFixed(6)}.`,
  );

  const base = createLocalPassengerRide({
    originText: input.returnOriginText,
    destinationText: input.returnDestinationText,
    notes: limitRideNotes(notes.join(" ")),
    passengerNote: returnPassengerNote || null,
    estimatedFareClp: null,
    rideMode: "scheduled",
    tripFareMode: "one_way",
    scheduledAt: input.returnScheduledAt,
    returnScheduledAt: "",
    scheduleKind: "round_trip_promotion",
    passengerName: input.passengerName,
    passengerEmail: input.passengerEmail,
    passengerFareType: input.passengerFareType,
    passengerFareLabel: input.passengerFareLabel,
  });

  return {
    ...base,
    ...scheduleFields,
    id: `return-pickup-${Date.now()}`,
    status: "scheduled",
    estimatedFareClp: null,
    originalFareClp: null,
    scheduleStatus: "frozen_until_activation",
    adminScheduleStatus: "pending_admin_round_trip_return_pickup",
    reservationStatus: "round_trip_return_pickup_reserved",
    bookingPurpose: "round_trip_return_pickup",
    serviceType: "round_trip_return_pickup",
    roundTripPromotionBooking: true,
    roundTripReturnOnly: true,
    roundTripReturnPickup: true,
    includedInRoundTripFare: true,
    fareIncludedInOutboundRide: true,
    relatedOutboundRideId: input.relatedOutboundRideId ?? null,
    adminVisibleNow: true,
    adminRequiresReview: true,
    availableForDrivers: false,
    visibleToDrivers: false,
    driverQueueBlocked: true,
    frozenForDrivers: true,
    driverFrozenUntil: scheduleFields.driverFrozenUntil ?? scheduleFields.dispatchAt ?? null,
    localOnly: true,
  };
}

function upsertRoundTripReturnPickupRide(ride: LocalPassengerRideData): void {
  const key = getLocalAdminScheduledRideKey(ride);
  const currentPassengerRides = readLocalPassengerRides().filter(
    (item) => getLocalAdminScheduledRideKey(item) !== key,
  );

  saveLocalPassengerRides([ride, ...currentPassengerRides]);
  upsertLocalAdminScheduledRide(ride);

  window.dispatchEvent(new CustomEvent("rapago:passenger-rides-updated", { detail: { ride } }));
  window.dispatchEvent(new CustomEvent("rapago:admin-scheduled-rides-updated", { detail: { rides: readLocalAdminScheduledRides() } }));
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
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }

  return null;
}

async function createMercadoPagoCheckout(input: {
  accessToken: string;
  rideRequestId: string;
}): Promise<{ urlPay: string; paymentId: string | null }> {
  const response = await fetch(`${getRapaGoApiBaseUrl()}/api/payments/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.accessToken}`,
    },
    body: JSON.stringify({
      rideRequestId: input.rideRequestId,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    const message =
      typeof payload.message === "string"
        ? payload.message
        : typeof payload.error === "string"
          ? payload.error
          : "No se pudo iniciar el pago con Mercado Pago.";
    throw new Error(message);
  }

  const urlPay =
    (typeof payload.urlPay === "string" && payload.urlPay.trim()) ||
    (typeof getNestedUnknown(payload, ["data", "urlPay"]) === "string" &&
      String(getNestedUnknown(payload, ["data", "urlPay"])).trim()) ||
    (typeof getNestedUnknown(payload, ["result", "urlPay"]) === "string" &&
      String(getNestedUnknown(payload, ["result", "urlPay"])).trim()) ||
    "";

  if (!urlPay) {
    throw new Error("Mercado Pago no devolvió URL de pago.");
  }

  const paymentIdValue =
    payload.paymentId ??
    getNestedUnknown(payload, ["data", "paymentId"]) ??
    getNestedUnknown(payload, ["result", "paymentId"]);

  return {
    urlPay,
    paymentId:
      typeof paymentIdValue === "string" && paymentIdValue.trim()
        ? paymentIdValue.trim()
        : null,
  };
}

type RideMode = "now" | "scheduled";
type TripFareMode = "one_way" | "round_trip";
type PickerTarget = "origin" | "destination";

type Coords = {
  lat: number;
  lng: number;
  placeId?: string | null;
};

type ConfirmedPoint = Coords & {
  text: string;
  address: string;
  originalLat?: number | null;
  originalLng?: number | null;
  walkMeters?: number;
  isAccessiblePickup?: boolean;
};

type GoogleSuggestion = {
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

function sectionLabelStyle(): CSSProperties {
  return {
    color: "var(--rp-label)",
    fontSize: "var(--rp-fs-label)",
    fontWeight: 800,
    letterSpacing: "0.06em",
    margin: "0 0 8px 2px",
    textTransform: "uppercase",
  };
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

  const value = normalizePlaceStreetText(component?.long_name ?? component?.short_name ?? "");
  return value || null;
}

function getGeocodePlaceName(result: google.maps.GeocoderResult | null | undefined): string | null {
  const value =
    getAddressComponentValue(result, ["premise"]) ??
    getAddressComponentValue(result, ["establishment"]) ??
    getAddressComponentValue(result, ["point_of_interest"]) ??
    getAddressComponentValue(result, ["tourist_attraction"]);

  return value || null;
}

function getGeocodeStreetName(result: google.maps.GeocoderResult | null | undefined): string | null {
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

function buildPlaceStreetTitle(placeName: unknown, streetName: unknown): string | null {
  const place = isUsefulPlaceStreetValue(placeName) ? normalizePlaceStreetText(placeName) : "";
  const street = isUsefulPlaceStreetValue(streetName) ? normalizePlaceStreetText(streetName) : "";

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
  const seen = new Set<string>();

  return references
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .filter((reference) => {
      const key = normalizePlaceStreetCompare(reference.name);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
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

    const PlaceApi = placesNamespace.Place;
    if (!PlaceApi?.searchNearby) return [];

    const response = await PlaceApi.searchNearby({
      fields: [
        "id",
        "displayName",
        "location",
        "formattedAddress",
        "primaryType",
        "businessStatus",
      ],
      locationRestriction: {
        center: new google.maps.LatLng(point.lat, point.lng),
        radius: radiusMeters,
      },
      maxResultCount: 15,
      rankPreference:
        placesNamespace.SearchNearbyRankPreference?.DISTANCE ?? "DISTANCE",
      language: "es",
      region: "CL",
    });

    return dedupeGoogleReferences(
      (response.places ?? [])
        .map((place): GoogleNearbyReference | null => {
          const name = normalizePlaceStreetText(place.displayName ?? "");
          const location = readGoogleLatLng(place.location);

          if (
            !location ||
            !isUsefulGoogleReference(name) ||
            String(place.businessStatus ?? "").toUpperCase() ===
              "CLOSED_PERMANENTLY"
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
            primaryType: place.primaryType ? String(place.primaryType) : null,
            distanceMeters: Math.round(distanceMeters(point, location)),
          };
        })
        .filter(
          (reference): reference is GoogleNearbyReference =>
            reference !== null &&
            reference.distanceMeters <= radiusMeters,
        ),
    );
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

    return await new Promise((resolve) => {
      service.nearbySearch(
        {
          location: new google.maps.LatLng(point.lat, point.lng),
          radius: radiusMeters,
          type: "point_of_interest",
        } as google.maps.places.PlaceSearchRequest,
        (results, status) => {
          if (
            status !== google.maps.places.PlacesServiceStatus.OK ||
            !results?.length
          ) {
            resolve([]);
            return;
          }

          resolve(
            dedupeGoogleReferences(
              results
                .map((place): GoogleNearbyReference | null => {
                  const name = normalizePlaceStreetText(place.name ?? "");
                  const location = readGoogleLatLng(
                    place.geometry?.location ?? null,
                  );

                  if (!location || !isUsefulGoogleReference(name)) {
                    return null;
                  }

                  return {
                    name,
                    placeId: place.place_id ?? null,
                    lat: location.lat,
                    lng: location.lng,
                    formattedAddress: place.vicinity ?? null,
                    primaryType: place.types?.[0] ?? null,
                    distanceMeters: Math.round(
                      distanceMeters(point, location),
                    ),
                  };
                })
                .filter(
                  (reference): reference is GoogleNearbyReference =>
                    reference !== null &&
                    reference.distanceMeters <= radiusMeters,
                ),
            ),
          );
        },
      );
    });
  } catch {
    return [];
  }
}

async function getNearbyGoogleReferences(
  point: { lat: number; lng: number },
  radiusMeters = 180,
): Promise<GoogleNearbyReference[]> {
  const newPlaces = await getNearbyGoogleReferencesNew(point, radiusMeters);
  if (newPlaces.length > 0) return newPlaces;

  return getNearbyGoogleReferencesLegacy(point, radiusMeters);
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
  const fallback = normalizePlaceStreetText(result.formatted_address.split(",")[0]);
  const title = buildPlaceStreetTitle(premise, route) ?? fallback ?? "Punto seleccionado";

  return {
    title,
    subtitle: result.formatted_address,
  };
}

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const earth = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) *
      Math.sin(dLng / 2) *
      Math.cos(lat1) *
      Math.cos(lat2);

  return earth * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}


type PassengerFareType = "resident" | "chilean" | "foreigner";
type VehicleCategory = "standard" | "xl" | "luggage";

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

const ROUND_TRIP_DESTINATION_SEARCH: Record<string, string> = {
  anakena: "Anakena, Rapa Nui, Chile",
  terevaka: "Maunga Terevaka, Rapa Nui, Chile",
};

// Puntos fijos usados solo para promociones ida y vuelta.
// No dependemos de Google geocode porque a veces Anakena cae en Ahu Ature Huki
// o en una etiqueta cercana y el pin queda corrido en el mapa.
const ROUND_TRIP_DESTINATION_FIXED_POINTS: Record<string, Omit<PickerResult, "originalLat" | "originalLng" | "walkMeters" | "isAccessiblePickup">> = {
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
  address: "Zona de llegada / terminal Mataveri, Hanga Roa, Rapa Nui, Chile",
  // Punto de recogida del pasajero en la zona pública/terminal del aeropuerto.
  // No usamos el centroide oficial del aeródromo porque Google lo muestra corrido
  // hacia la pista/camino interior, lejos del punto real de espera del pasajero.
  lat: -27.16395,
  lng: -109.42465,
  placeId: "rapago-fixed-mataveri-airport-terminal",
  originalLat: null,
  originalLng: null,
  walkMeters: 0,
  isAccessiblePickup: false,
};

function isRapaNuiAirportPoint(point: ConfirmedPoint | PickerResult | null | undefined): boolean {
  if (!point) return false;

  const placeId = String(point.placeId ?? "").toLowerCase();
  const text = normalizeAdminDestinationId(`${point.text ?? ""} ${point.address ?? ""}`);

  return (
    placeId === RAPA_NUI_AIRPORT_DESTINATION.placeId ||
    text.includes("aeropuerto") ||
    text.includes("mataveri") ||
    text.includes("airport")
  );
}

function normalizeAdminDestinationId(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "destino";
}

function getRoundTripDestinationKey(destination: FixedDestinationRule): string {
  const normalized = normalizeAdminDestinationId(`${destination.id ?? ""} ${destination.title ?? ""}`);

  if (normalized.includes("anakena")) return "anakena";
  if (normalized.includes("terevaka") || normalized.includes("tere_vaka")) return "terevaka";

  return normalizeAdminDestinationId(destination.id || destination.title);
}

function getRoundTripDestinationSearch(destination: FixedDestinationRule): string {
  const id = getRoundTripDestinationKey(destination);
  return ROUND_TRIP_DESTINATION_SEARCH[id] ?? `${destination.title} Rapa Nui Chile`;
}

function getRoundTripDestinationFixedPoint(destination: FixedDestinationRule): PickerResult | null {
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
      const rawFare = Math.max(0, Number(destination.baseResidentClp || 0) * multiplier);
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
    resident: 1,
    chilean: 1.13,
    foreigner: 1.2,
  },
  vehicleMultipliers: {
    standard: 1,
    xl: 1.4,
    luggage: 1.25,
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
        parsed.isResident ??
        localStorage.getItem("rapago_is_resident") ??
        null,
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
  if (raw.includes("turista") || raw.includes("tourist") || raw.includes("visitor")) {
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
    normalizePassengerFareType(getUserStringField(user, "passengerCondition")) ??
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
        normalizePassengerFareType(localStorage.getItem("rapago_passenger_fare_type")) ??
        normalizePassengerFareType(localStorage.getItem("rapago_passenger_condition")) ??
        normalizePassengerFareType(localStorage.getItem("rapago_fare_passenger_type")) ??
        normalizePassengerFareType(localStorage.getItem("rapago_profile_passenger_type")) ??
        normalizePassengerFareType(localStorage.getItem("rapago_profile_nationality")) ??
        normalizePassengerFareType(localStorage.getItem("rapago_nationality"));

      if (stored) return stored;
    }
  } catch {
    // Si no existe dato guardado, se usa Turista chileno como valor seguro.
  }

  return "chilean";
}

function vehicleCategoryLabel(category: VehicleCategory): string {
  if (category === "xl") return "XL";
  if (category === "luggage") return "Extra maletas";
  return "Estándar";
}

function vehicleCategoryTitle(category: VehicleCategory): string {
  if (category === "xl") return "Vehículo XL";
  if (category === "luggage") return "Extra maletas";
  return "Estándar";
}

function vehicleCategoryDescription(category: VehicleCategory): string {
  if (category === "xl") return "Más espacio y comodidad";
  if (category === "luggage") return "Ideal si llevas equipaje";
  return "Viaje normal urbano";
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
    const parsed = raw ? (JSON.parse(raw) as Array<{ id?: string; minimumClp?: number | null; kmClp?: number | null; fixedClp?: number | null; active?: boolean }>) : [];

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
        generalMinimum != null
          ? Number(generalMinimum)
          : undefined,
      baseKmClp:
        generalKm != null
          ? Number(generalKm)
          : undefined,
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
      vehicleMultipliers?: Partial<Record<VehicleCategory, number>>;
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
        parseStoredNumber(parsed.rural?.urbanLimitKm, fallback.ruralUrbanLimitKm),
      ),
      ruralDiscountPercent: Math.max(
        0,
        Math.min(
          99,
          parseStoredNumber(parsed.rural?.ruralDiscountPercent, fallback.ruralDiscountPercent),
        ),
      ),
      ruralFactor: Math.max(
        0.01,
        parseStoredNumber(
          parsed.rural?.ruralFactor ??
            (1 -
              parseStoredNumber(parsed.rural?.ruralDiscountPercent, fallback.ruralDiscountPercent) /
                100),
          fallback.ruralFactor,
        ),
      ),
      passengerMultipliers: {
        resident: parseStoredNumber(
          parsed.passengerMultipliers?.resident,
          fallback.passengerMultipliers.resident,
        ),
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
        standard: parseStoredNumber(
          parsed.vehicleMultipliers?.standard,
          fallback.vehicleMultipliers.standard,
        ),
        xl: parseStoredNumber(
          parsed.vehicleMultipliers?.xl,
          fallback.vehicleMultipliers.xl,
        ),
        luggage: parseStoredNumber(
          parsed.vehicleMultipliers?.luggage,
          fallback.vehicleMultipliers.luggage,
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
          : legacy.fixedDestinations ?? fallback.fixedDestinations,
      // Redondeo final obligatorio.
      // Se ignora cualquier configuración antigua "none" o "nearest" guardada en localStorage.
      roundingMode: "ceil",
      roundingUnitClp: Math.max(
        500,
        Math.round(parseStoredNumber(parsed.rounding?.unitClp, fallback.roundingUnitClp)),
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
      const parsed = JSON.parse(engineRaw) as { usdRate?: number | string | null };
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
  const discount = Math.max(0, Math.min(99, Number(rules.ruralDiscountPercent ?? 25)));
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
  const adjustedMinimum = rules.baseMinimumClp * passengerMultiplier * vehicleMultiplier;
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
    ruralDiscountPercent: Math.max(0, Math.min(99, Number(rules.ruralDiscountPercent ?? 25))),
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
    calculationType: isFixedFare
      ? "fixed"
      : ruralBreakdown.calculationType,
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

        void getBestVisiblePlaceNameForPoint(point, getGeocodePlaceName(first)).then((placeName) => {
          const title = buildPlaceStreetTitle(placeName, streetName) ?? label.title;

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

        void getBestVisiblePlaceNameForPoint(point, getGeocodePlaceName(first)).then((placeName) => {
          const label = {
            title: buildPlaceStreetTitle(placeName, roadName) ?? roadLabel.title,
            subtitle: roadLabel.subtitle,
          };

          resolve({
            text: adjustedToRoad
              ? `Recogida en ${label.title}`
              : label.title,
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
        const label = getShortAddress(result);

        resolve({
          text: text.trim() || label.title,
          address: result.formatted_address,
          lat: result.geometry.location.lat(),
          lng: result.geometry.location.lng(),
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

        void reverseGeocode({
          lat: result.geometry.location.lat(),
          lng: result.geometry.location.lng(),
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

async function getGooglePredictions(input: string): Promise<GoogleSuggestion[]> {
  if (input.trim().length < 3) return [];

  await loadRapaGoGoogleMaps();

  const service = new google.maps.places.AutocompleteService();

  return new Promise((resolve) => {
    service.getPlacePredictions(
      {
        input,
        componentRestrictions: {
          country: "cl",
        },
        location: new google.maps.LatLng(RAPA_NUI_CENTER.lat, RAPA_NUI_CENTER.lng),
        radius: 15000,
        types: ["establishment", "geocode"],
      },
      (predictions, status) => {
        if (
          status !== google.maps.places.PlacesServiceStatus.OK ||
          !predictions
        ) {
          resolve([]);
          return;
        }

        resolve(
          predictions.slice(0, 6).map((prediction) => ({
            placeId: prediction.place_id,
            description: prediction.description,
            mainText: prediction.structured_formatting.main_text,
            secondaryText: prediction.structured_formatting.secondary_text,
          })),
        );
      },
    );
  });
}

async function getPlaceDetailsExact(placeId: string): Promise<PickerResult | null> {
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

        resolve({
          text: place.name ?? place.formatted_address ?? "Destino seleccionado",
          address: place.formatted_address ?? "Rapa Nui, Chile",
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
          placeId: place.place_id ?? placeId,
          originalLat: null,
          originalLng: null,
          walkMeters: 0,
          isAccessiblePickup: false,
        });
      },
    );
  });
}

async function getPlaceDetails(placeId: string): Promise<PickerResult | null> {
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

        void reverseGeocode({
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
          placeId: place.place_id ?? placeId,
        }).then((snapped) => {
          const placeName = normalizePlaceStreetText(place.name ?? place.formatted_address ?? "");
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
};

type WalkingMetrics = {
  meters: number;
  minutes: number;
};

const GOOGLE_PICKUP_CACHE = new Map<string, Promise<PickerResult[]>>();
const MAX_GOOGLE_PICKUP_CACHE_ENTRIES = 60;

function createPickupCacheKey(point: { lat: number; lng: number }): string {
  return `${point.lat.toFixed(4)}:${point.lng.toFixed(4)}`;
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
      Math.sin(bearing) *
        Math.sin(angularDistance) *
        Math.cos(lat1),
      Math.cos(angularDistance) -
        Math.sin(lat1) * Math.sin(lat2),
    );

  return {
    lat: (lat2 * 180) / Math.PI,
    lng: (lng2 * 180) / Math.PI,
  };
}

function buildPickupProbePoints(
  point: { lat: number; lng: number },
): Array<{ lat: number; lng: number }> {
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
        if (
          status !== google.maps.GeocoderStatus.OK ||
          !results?.length
        ) {
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

  for (const probe of probes) {
    const streetKey = normalizePlaceStreetCompare(probe.streetName);
    if (!streetKey) continue;

    const candidate = {
      ...probe,
      straightMeters: distanceMeters(origin, probe),
    };

    const previous = bestByStreet.get(streetKey);

    if (!previous || candidate.straightMeters < previous.straightMeters) {
      bestByStreet.set(streetKey, candidate);
    }
  }

  return Array.from(bestByStreet.values())
    .sort((a, b) => a.straightMeters - b.straightMeters)
    .slice(0, 5)
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
        computeRoutes?: (
          request: Record<string, unknown>,
        ) => Promise<{
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

  const routeClass = await getWalkingMetricsWithRouteClass(
    origin,
    destination,
  );

  if (routeClass) return routeClass;

  const legacyRoute = await getWalkingMetricsLegacy(origin, destination);
  if (legacyRoute) return legacyRoute;

  const estimatedMeters = Math.round(directMeters * 1.18);

  return {
    meters: estimatedMeters,
    minutes: Math.max(1, Math.ceil(estimatedMeters / 75)),
  };
}

function getReferenceForRoadCandidate(
  references: GoogleNearbyReference[],
  road: RoadPickupProbe,
): GoogleNearbyReference | null {
  const useful = references
    .filter((reference) =>
      isUsefulGoogleReference(reference.name, road.streetName),
    )
    .map((reference) => ({
      ...reference,
      distanceFromRoad: distanceMeters(reference, road),
    }))
    .filter((reference) => reference.distanceFromRoad <= 180)
    .sort((a, b) => a.distanceFromRoad - b.distanceFromRoad)[0];

  if (!useful) return null;

  return {
    name: useful.name,
    placeId: useful.placeId,
    lat: useful.lat,
    lng: useful.lng,
    formattedAddress: useful.formattedAddress,
    primaryType: useful.primaryType,
    distanceMeters: Math.round(useful.distanceFromRoad),
  };
}

function buildAutomaticPickupText(
  streetName: string,
  reference: GoogleNearbyReference | null,
): string {
  if (!reference) return `Recogida en ${streetName}`;

  const relation =
    reference.distanceMeters <= 35 ? "frente a" : "cerca de";

  return `Recogida en ${streetName}, ${relation} ${reference.name}`;
}

async function computeGooglePickupCandidates(
  point: { lat: number; lng: number },
): Promise<PickerResult[]> {
  await loadRapaGoGoogleMaps();

  const geocoder = new google.maps.Geocoder();
  const probes = buildPickupProbePoints(point);

  const roadResults = await mapWithConcurrency(
    probes,
    4,
    async (probe) => geocodeRoadProbe(geocoder, probe),
  );

  const roads = dedupeRoadPickupProbes(
    roadResults.filter(
      (road): road is RoadPickupProbe => road !== null,
    ),
    point,
  );

  if (roads.length === 0) {
    const exact = await reverseGeocodeExact(point);

    return [
      {
        ...exact,
        originalLat: point.lat,
        originalLng: point.lng,
        walkMeters: 0,
        walkMinutes: 1,
        isAccessiblePickup: false,
        referenceName: null,
        referenceDistanceMeters: null,
        streetName: null,
        candidateId: `exact:${point.lat.toFixed(5)}:${point.lng.toFixed(5)}`,
      },
    ];
  }

  const references = await getNearbyGoogleReferences(point, 200);

  const enriched = await mapWithConcurrency(
    roads,
    3,
    async (road): Promise<PickerResult & { score: number }> => {
      const walking = await getGoogleWalkingMetrics(point, road);
      const reference = getReferenceForRoadCandidate(references, road);
      const text = buildAutomaticPickupText(
        road.streetName,
        reference,
      );

      const score =
        walking.meters +
        (reference ? Math.min(reference.distanceMeters, 150) * 0.08 : 28);

      return {
        text,
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
        referenceName: reference?.name ?? null,
        referenceDistanceMeters: reference?.distanceMeters ?? null,
        candidateId: `${normalizePlaceStreetCompare(
          road.streetName,
        )}:${road.lat.toFixed(5)}:${road.lng.toFixed(5)}`,
        score,
      };
    },
  );

  const withinRecommendedWalk = enriched.filter(
    (candidate) => (candidate.walkMeters ?? 0) <= 220,
  );

  const pool =
    withinRecommendedWalk.length > 0
      ? withinRecommendedWalk
      : enriched;

  return pool
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map(({ score: _score, ...candidate }) => candidate);
}

async function getGooglePickupCandidates(
  point: { lat: number; lng: number },
): Promise<PickerResult[]> {
  const key = createPickupCacheKey(point);
  const cached = GOOGLE_PICKUP_CACHE.get(key);

  if (cached) return cached;

  const pending = computeGooglePickupCandidates(point).catch(async () => {
    const fallback = await reverseGeocode(point);

    return [
      {
        ...fallback,
        walkMinutes: Math.max(
          1,
          Math.ceil(Number(fallback.walkMeters ?? 0) / 75),
        ),
        candidateId: `fallback:${point.lat.toFixed(5)}:${point.lng.toFixed(5)}`,
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
          }}
        >
          <div style={{ fontWeight: 800, fontSize: ".84rem", lineHeight: 1.25, color: "var(--rp-text)" }}>
            {suggestion.mainText}
          </div>
          <div
            style={{
              marginTop: "3px",
              color: "var(--rp-muted)",
              fontSize: ".72rem",
              fontWeight: 650,
              lineHeight: 1.25,
            }}
          >
            {suggestion.secondaryText}
          </div>
        </button>
      ))}
    </div>
  );
}

function MapPointPicker({
  isOpen,
  title,
  mode,
  initialPoint,
  onCancel,
  onConfirm,
}: {
  isOpen: boolean;
  title: string;
  mode: PickerTarget;
  initialPoint?: Coords | null;
  onCancel: () => void;
  onConfirm: (point: PickerResult) => void;
}): JSX.Element {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const geocodeTimerRef = useRef<number | null>(null);
  const requestSequenceRef = useRef(0);
  const lastResolvedCenterRef = useRef<{ lat: number; lng: number } | null>(
    null,
  );
  const realPointMarkerRef = useRef<google.maps.Marker | null>(null);
  const pickupPointMarkerRef = useRef<google.maps.Marker | null>(null);
  const candidateMarkersRef = useRef<google.maps.Marker[]>([]);
  const realPointCircleRef = useRef<google.maps.Circle | null>(null);
  const walkingDotsRef = useRef<google.maps.Polyline | null>(null);
  const walkingDotsShadowRef = useRef<google.maps.Polyline | null>(null);
  const sheetDragRef = useRef<{
    pointerId: number;
    startY: number;
    startedExpanded: boolean;
  } | null>(null);
  const suppressSheetClickRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<PickerResult | null>(null);
  const [pickupCandidates, setPickupCandidates] = useState<PickerResult[]>([]);
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [pickerSuggestions, setPickerSuggestions] = useState<GoogleSuggestion[]>(
    [],
  );
  const [modalReady, setModalReady] = useState(false);
  const [sheetExpanded, setSheetExpanded] = useState(true);
  const [sheetDragY, setSheetDragY] = useState(0);
  const [sheetDragging, setSheetDragging] = useState(false);

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
      title: "Tu ubicación o punto indicado",
      draggable: true,
      cursor: "grab",
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 14,
        fillColor: "#2563eb",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 4,
      },
      zIndex: 40,
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
      void resolveOriginPoint(movedPoint);
    });

    for (const candidate of candidates) {
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
        title: candidate.text.replace(/^Recogida en\s+/i, ""),
        cursor: "pointer",
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: "#ffffff",
          fillOpacity: 1,
          strokeColor: "#22c55e",
          strokeWeight: 4,
        },
        zIndex: 25,
      });

      marker.addListener("click", () => {
        setSelected(candidate);
        drawAccessiblePickupPreview(candidate, candidates);
        setSheetExpanded(true);
      });

      candidateMarkersRef.current.push(marker);
    }

    pickupPointMarkerRef.current = new google.maps.Marker({
      map,
      position: pickupPoint,
      title: "Punto accesible recomendado",
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

  async function resolveOriginPoint(point: {
    lat: number;
    lng: number;
  }): Promise<void> {
    const sequence = ++requestSequenceRef.current;
    setLoadingAddress(true);

    try {
      const candidates = await getGooglePickupCandidates(point);

      if (sequence !== requestSequenceRef.current) return;

      const next = candidates[0] ?? null;
      setPickupCandidates(candidates);
      setSelected(next);
      drawAccessiblePickupPreview(next, candidates);
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
    const sequence = ++requestSequenceRef.current;
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

    if (
      !force &&
      previous &&
      distanceMeters(previous, point) < 18
    ) {
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
      mapRef.current = null;
      return;
    }

    setSheetExpanded(true);
    setSheetDragY(0);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !modalReady) return;

    setReady(false);
    setSelected(null);
    setPickupCandidates([]);
    setSearchText("");
    setPickerSuggestions([]);

    let cancelled = false;

    void loadRapaGoGoogleMaps()
      .then(async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 200));

        if (
          cancelled ||
          !mapElementRef.current ||
          !window.google?.maps
        ) {
          return;
        }

        const center = initialPoint ?? RAPA_NUI_CENTER;

        const map = new google.maps.Map(mapElementRef.current, {
          center,
          zoom: 17,
          mapTypeControl: false,
          fullscreenControl: false,
          streetViewControl: false,
          clickableIcons: true,
          gestureHandling: "greedy",
          disableDefaultUI: true,
          zoomControl: true,
          mapTypeId: google.maps.MapTypeId.ROADMAP,
        });

        mapRef.current = map;

        window.setTimeout(() => {
          if (cancelled) return;
          google.maps.event.trigger(map, "resize");
          map.setCenter(center);
          map.setZoom(17);
          setReady(true);
        }, 120);

        await resolveMapPoint(
          {
            lat: center.lat,
            lng: center.lng,
          },
          true,
        );

        map.addListener("idle", () => {
          if (geocodeTimerRef.current) {
            window.clearTimeout(geocodeTimerRef.current);
          }

          geocodeTimerRef.current = window.setTimeout(() => {
            const currentCenter = map.getCenter();
            if (!currentCenter || cancelled) return;

            void resolveMapPoint({
              lat: currentCenter.lat(),
              lng: currentCenter.lng(),
            });
          }, 650);
        });
      })
      .catch(() => {
        setReady(true);
        setSelected({
          text: "No se pudo cargar el mapa",
          address:
            "Revisa la configuración de Google Maps y vuelve a intentar.",
          lat: RAPA_NUI_CENTER.lat,
          lng: RAPA_NUI_CENTER.lng,
          placeId: null,
        });
      });

    return () => {
      cancelled = true;
      requestSequenceRef.current += 1;

      if (geocodeTimerRef.current) {
        window.clearTimeout(geocodeTimerRef.current);
      }

      clearMapPreview();
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
    if (!isOpen || searchText.trim().length < 3) {
      setPickerSuggestions([]);
      return;
    }

    const timeout = window.setTimeout(() => {
      void getGooglePredictions(searchText.trim()).then(
        setPickerSuggestions,
      );
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [isOpen, searchText]);

  async function pickSuggestion(
    suggestion: GoogleSuggestion,
  ): Promise<void> {
    setLoadingAddress(true);

    try {
      const exact = await getPlaceDetailsExact(suggestion.placeId);
      if (!exact || !mapRef.current) return;

      setSearchText(exact.text);
      setPickerSuggestions([]);
      mapRef.current.setCenter({
        lat: exact.lat,
        lng: exact.lng,
      });
      mapRef.current.setZoom(18);

      await resolveMapPoint(
        {
          lat: exact.lat,
          lng: exact.lng,
        },
        true,
      );
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

  function beginSheetDrag(
    event: ReactPointerEvent<HTMLButtonElement>,
  ): void {
    sheetDragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startedExpanded: sheetExpanded,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
    suppressSheetClickRef.current = false;
    setSheetDragging(true);
    setSheetDragY(0);
  }

  function moveSheetDrag(
    event: ReactPointerEvent<HTMLButtonElement>,
  ): void {
    const drag = sheetDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const delta = event.clientY - drag.startY;

    if (Math.abs(delta) > 8) {
      suppressSheetClickRef.current = true;
    }

    const bounded = drag.startedExpanded
      ? Math.max(0, Math.min(360, delta))
      : Math.min(0, Math.max(-360, delta));

    setSheetDragY(bounded);
  }

  function endSheetDrag(
    event: ReactPointerEvent<HTMLButtonElement>,
  ): void {
    const drag = sheetDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const delta = event.clientY - drag.startY;

    if (drag.startedExpanded && delta > 55) {
      setSheetExpanded(false);
    } else if (!drag.startedExpanded && delta < -55) {
      setSheetExpanded(true);
    }

    sheetDragRef.current = null;
    setSheetDragging(false);
    setSheetDragY(0);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  const selectedStreet =
    selected?.streetName ??
    selected?.text.replace(/^Recogida en\s+/i, "").split(",")[0] ??
    (mode === "origin" ? "Vía accesible" : "Destino seleccionado");

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

  return (
    <IonModal
      isOpen={isOpen}
      className="request-map-modal"
      onDidPresent={() => setModalReady(true)}
      onDidDismiss={() => {
        setModalReady(false);
        onCancel();
      }}
    >
      <IonPage className="rapago-section-page rapago-request-page request-map-page">
        <IonHeader className="request-map-header">
          <IonToolbar>
            <IonButtons slot="start">
              <IonButton
                fill="clear"
                onClick={onCancel}
                aria-label="Volver"
                className="request-map-back"
              >
                <IonIcon slot="start" icon={arrowBackOutline} />
                Volver
              </IonButton>
            </IonButtons>

            <IonTitle aria-label={title}>
              {mode === "origin"
                ? "Confirmar recogida"
                : "Confirmar destino"}
            </IonTitle>
          </IonToolbar>
        </IonHeader>

        <IonContent
          fullscreen
          className="request-map-content"
          scrollY={false}
        >
          <div className="request-map-shell">
            <div
              ref={mapElementRef}
              className="request-map-canvas"
              aria-label="Mapa para elegir el punto"
            />

            <div className="request-map-search">
              <IonItem lines="none" className="request-map-search__field">
                <IonIcon icon={searchOutline} slot="start" />
                <IonInput
                  value={searchText}
                  placeholder="Buscar dirección o lugar en Google Maps"
                  onIonInput={(event) =>
                    setSearchText(String(event.detail.value ?? ""))
                  }
                />
              </IonItem>

              {pickerSuggestions.length > 0 && (
                <div className="request-map-suggestions">
                  {pickerSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.placeId}
                      type="button"
                      className="request-map-suggestion"
                      onClick={() => void pickSuggestion(suggestion)}
                    >
                      <strong>{suggestion.mainText}</strong>
                      <span>{suggestion.secondaryText}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {mode === "origin" && selected && (
              <div className="request-map-start-label">
                Inicio del viaje en {selectedStreet}
              </div>
            )}

            <button
              type="button"
              onClick={useCurrentLocation}
              className="request-map-location-button"
              aria-label="Usar mi ubicación actual"
            >
              <IonIcon icon={locateOutline} />
            </button>

            {modalReady && (!ready || loadingAddress) && (
              <div
                className="request-map-loading"
                aria-live="polite"
              >
                <IonSpinner name="crescent" />
                <span>
                  {mode === "origin"
                    ? "Buscando calles accesibles y referencias..."
                    : "Buscando el destino..."}
                </span>
              </div>
            )}

            <section
              className={`request-map-sheet ${
                sheetExpanded
                  ? "request-map-sheet--expanded"
                  : "request-map-sheet--collapsed"
              } ${
                sheetDragging ? "request-map-sheet--dragging" : ""
              }`}
              style={
                {
                  "--request-sheet-drag-y": `${sheetDragY}px`,
                } as CSSProperties
              }
              aria-label="Información del punto seleccionado"
            >
              <button
                type="button"
                className="request-map-sheet__drag"
                onPointerDown={beginSheetDrag}
                onPointerMove={moveSheetDrag}
                onPointerUp={endSheetDrag}
                onPointerCancel={endSheetDrag}
                onClick={() => {
                  if (suppressSheetClickRef.current) {
                    suppressSheetClickRef.current = false;
                    return;
                  }

                  setSheetExpanded((current) => !current);
                }}
                aria-expanded={sheetExpanded}
                aria-label={
                  sheetExpanded
                    ? "Bajar la tarjeta del mapa"
                    : "Subir la tarjeta del mapa"
                }
              >
                <span className="request-map-sheet__grip" />
                <span>
                  {sheetExpanded
                    ? "Desliza hacia abajo para ver más mapa"
                    : "Desliza hacia arriba para ver los detalles"}
                </span>
              </button>

              <div className="request-map-sheet__body">
                <div className="request-map-sheet__heading">
                  <span className="request-map-sheet__heading-mark" />
                  <div>
                    <strong>
                      {mode === "origin"
                        ? "Punto accesible recomendado"
                        : "Destino seleccionado"}
                    </strong>
                    <span>
                      {mode === "origin"
                        ? "Google Maps combina una vía cercana con un punto de referencia real."
                        : "Mueve el mapa o busca el lugar exacto."}
                    </span>
                  </div>
                </div>

                {mode === "destination" && (
                  <section
                    className="request-map-frequent"
                    aria-label="Destinos frecuentes de Rapa Nui"
                  >
                    <div className="request-map-frequent__heading">
                      <div>
                        <strong>Destinos frecuentes</strong>
                        <span>
                          Toca uno y Google Maps buscará su acceso exacto.
                        </span>
                      </div>
                    </div>

                    <div className="request-map-frequent__list">
                      {TOURIST_DESTINATION_SUGGESTIONS.map(
                        (destination) => {
                          const active =
                            normalizePlaceStreetCompare(
                              selected?.text ?? "",
                            ) ===
                            normalizePlaceStreetCompare(
                              destination.name,
                            );

                          return (
                            <button
                              key={destination.name}
                              type="button"
                              className={`request-map-frequent__item ${
                                active
                                  ? "request-map-frequent__item--active"
                                  : ""
                              }`}
                              onClick={() =>
                                void pickFrequentDestination(destination)
                              }
                              disabled={loadingAddress}
                              aria-pressed={active}
                            >
                              <IonIcon icon={locationOutline} />

                              <span>
                                <strong>{destination.name}</strong>
                                <small>{destination.subtitle}</small>
                              </span>
                            </button>
                          );
                        },
                      )}
                    </div>
                  </section>
                )}

                {mode === "origin" && pickupCandidates.length > 0 && (
                  <div className="request-map-candidates">
                    {pickupCandidates.map((candidate, index) => {
                      const active =
                        candidate.candidateId === selected?.candidateId;

                      return (
                        <button
                          key={
                            candidate.candidateId ??
                            `${candidate.lat}:${candidate.lng}`
                          }
                          type="button"
                          className={`request-map-candidate ${
                            active
                              ? "request-map-candidate--active"
                              : ""
                          }`}
                          onClick={() => selectPickupCandidate(candidate)}
                        >
                          <span className="request-map-candidate__number">
                            {index + 1}
                          </span>

                          <span className="request-map-candidate__content">
                            <strong>
                              {candidate.streetName ??
                                candidate.text.replace(
                                  /^Recogida en\s+/i,
                                  "",
                                )}
                            </strong>

                            <span>
                              {candidate.referenceName
                                ? `Referencia de Google Maps: ${
                                    (candidate.referenceDistanceMeters ?? 999) <=
                                    35
                                      ? "frente a"
                                      : "cerca de"
                                  } ${candidate.referenceName}`
                                : "Vía detectada por Google Maps, sin local cercano visible."}
                            </span>
                          </span>

                          <span className="request-map-candidate__walk">
                            {Math.round(candidate.walkMeters ?? 0)} m
                            <small>
                              {Math.max(
                                1,
                                candidate.walkMinutes ??
                                  Math.ceil(
                                    Number(candidate.walkMeters ?? 0) /
                                      75,
                                  ),
                              )}{" "}
                              min
                            </small>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="request-map-selected">
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
                        : selected?.text ??
                          (mode === "origin"
                            ? "Punto de recogida"
                            : "Destino")}
                    </strong>

                    <span>
                      {selected?.address ??
                        "Mueve el mapa para elegir la ubicación."}
                    </span>
                  </div>

                  <IonIcon icon={createOutline} />
                </div>

                {mode === "origin" && selected && (
                  <div className="request-map-walk">
                    <div className="request-map-walk__icon">🚶</div>

                    <div className="request-map-walk__text">
                      <strong>
                        {selectedWalkMeters <= 8
                          ? "El vehículo puede llegar a tu punto"
                          : "Camina hasta la vía accesible"}
                      </strong>

                      <span>
                        {selected.referenceName
                          ? `Usa ${selected.referenceName} como referencia para encontrar al conductor.`
                          : "El punto verde facilita que el conductor pueda encontrarte."}
                      </span>
                    </div>

                    <div className="request-map-walk__metrics">
                      {selectedWalkMeters} m
                      <small>{selectedWalkMinutes} min</small>
                    </div>
                  </div>
                )}

                {mode === "origin" && (
                  <p className="request-map-walking-warning">
                    La ruta a pie es una estimación de Google Maps. Revisa
                    que el camino sea seguro antes de confirmar.
                  </p>
                )}

                <IonButton
                  expand="block"
                  disabled={!selected || loadingAddress}
                  onClick={() => {
                    if (selected) onConfirm(selected);
                  }}
                  className="request-map-confirm"
                >
                  {mode === "origin"
                    ? "Confirmar punto de partida"
                    : "Confirmar destino"}
                </IonButton>
              </div>
            </section>
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
  notes.push(`${RAPAGO_PASSENGER_NOTE_START} ${passengerNote} ${RAPAGO_PASSENGER_NOTE_END}.`);
}

function limitRideNotes(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

// MODO PRUEBA:
 // Permite agendar reservas más cerca para testear rápido.
 // Producción: reservas mínimo 30 minutos y gestión/asignación admin 30 minutos antes.
const SCHEDULE_MIN_MINUTES = 30;
const SCHEDULE_MAX_DAYS = 30;
const SCHEDULE_ACTIVATION_MINUTES = 30;

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

  if (input.tripFareMode === "round_trip" && input.requireReturnScheduledAt !== false) {
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
  const pickup = input.rideMode === "scheduled" ? parseScheduleInput(input.scheduledAt) : null;
  const back = input.tripFareMode === "round_trip" ? parseScheduleInput(input.returnScheduledAt) : null;
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
  const isReturnOnlyPromotion = isRoundTripPromotion && !!back && input.rideMode !== "scheduled";

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
    roundTripPromotionBooking: (isScheduled || isReturnOnlyPromotion) && isRoundTripPromotion,
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

const HANGA_ROA          = { lat: -27.15, lng: -109.4333 };
const MIN_SCHEDULED_MINUTES = 30;
const MAX_SCHEDULED_DAYS    = 30;
const MAX_DESTINATIONS      = 3;

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
  const { theme, isDark, toggleTheme } = useRapagoSectionTheme("request-ride");

  useEffect(() => {
    preSearchLocationService.read();
    return () => preSearchLocationService.clear();
  }, []);

  useEffect(() => {
    preSearchLocationService.read();
    return () => preSearchLocationService.clear();
  }, []);

  const [originPoint, setOriginPoint] = useState<ConfirmedPoint | null>(null);
  const [destinationPoint, setDestinationPoint] =
    useState<ConfirmedPoint | null>(null);

  const [originInput, setOriginInput] = useState("");
  const [destInput, setDestInput] = useState("");

  const [originSuggestions, setOriginSuggestions] = useState<GoogleSuggestion[]>([]);
  const [destSuggestions, setDestSuggestions] = useState<GoogleSuggestion[]>([]);
  const [searchingOrigin, setSearchingOrigin] = useState(false);
  const [searchingDest, setSearchingDest] = useState(false);

  const originSearchSeq = useRef(0);
  const destSearchSeq = useRef(0);
  const suppressPickerOpenRef = useRef(false);

  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);

  const [notesInput, setNotesInput] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
  const [showPaymentBox, setShowPaymentBox] = useState(false);
  const [useWalletBenefit, setUseWalletBenefit] = useState<boolean | null>(null);
  const [walletBenefitRevision, setWalletBenefitRevision] = useState(0);
  const [backendWalletBenefitClp, setBackendWalletBenefitClp] = useState(0);
  const [walletBenefitLoading, setWalletBenefitLoading] = useState(false);
  const [pendingChargeRevision, setPendingChargeRevision] = useState(0);
  const [
    backendPendingPassengerCharges,
    setBackendPendingPassengerCharges,
  ] = useState<PassengerPendingChargeForRequest[]>([]);
  const [rideMode, setRideMode] = useState<RideMode>("now");
  const [tripFareMode, setTripFareMode] = useState<TripFareMode>("one_way");
  const [selectedRoundTripPromotionId, setSelectedRoundTripPromotionId] = useState<string | null>(null);
  const [pendingRoundTripPromotion, setPendingRoundTripPromotion] = useState<RoundTripPromotion | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");
  const [returnScheduledAt, setReturnScheduledAt] = useState("");
  const [flightNumber, setFlightNumber] = useState("");
  const [airportWelcomeOption, setAirportWelcomeOption] = useState<AirportWelcomeOption>("none");
  const [locating, setLocating] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fareQuote, setFareQuote] = useState<FareQuote | null>(null);
  const [fareLoading, setFareLoading] = useState(false);
  const [fareRules, setFareRules] = useState<RapaGoFareRules>(DEFAULT_RAPAGO_FARE_RULES);
  const [vehicleCategory, setVehicleCategory] = useState<VehicleCategory>("standard");
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
  const effectivePassengerFareType = selectedRoundTripPromotion?.passengerFareType ?? passengerFareType;
  const effectiveTripFareMode: TripFareMode = selectedRoundTripPromotion ? "round_trip" : tripFareMode;
  const isRoundTripPromotionSelected = Boolean(selectedRoundTripPromotion);
  const isAirportScheduledRide = rideMode === "scheduled" && !isRoundTripPromotionSelected;
  const reservationRequiresCard = rideMode === "scheduled" || Boolean(selectedRoundTripPromotion);
  const airportScheduledRequiresCard = isAirportScheduledRide;
  const canChooseOrigin = rideMode !== "scheduled" || isRoundTripPromotionSelected;
  const requireReturnScheduledAt = effectiveTripFareMode === "round_trip";
  const roundTripPromotionReturnOnly = Boolean(selectedRoundTripPromotion);

  useEffect(() => {
    if (!reservationRequiresCard) return;
    if (paymentMethod !== "card") setPaymentMethod("card");
    setShowPaymentBox(false);
  }, [reservationRequiresCard, paymentMethod]);

  useEffect(() => {
    let cancelled = false;

    void fetchRapaGoFareRules().then((rules) => {
      if (!cancelled) setFareRules(rules);
    });

    return () => {
      cancelled = true;
    };
  }, []);


  useEffect(() => {
    const refreshWalletBenefits = () => setWalletBenefitRevision((current) => current + 1);

    window.addEventListener("storage", refreshWalletBenefits);
    window.addEventListener("rapago:wallet-updated", refreshWalletBenefits as EventListener);
    window.addEventListener(RAPAGO_WALLET_BENEFIT_EVENT_REQUEST, refreshWalletBenefits as EventListener);

    return () => {
      window.removeEventListener("storage", refreshWalletBenefits);
      window.removeEventListener("rapago:wallet-updated", refreshWalletBenefits as EventListener);
      window.removeEventListener(RAPAGO_WALLET_BENEFIT_EVENT_REQUEST, refreshWalletBenefits as EventListener);
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
    const destination = { lat: destinationPoint.lat, lng: destinationPoint.lng };

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
              const minutes = (leg.duration?.value ?? fallback.minutes * 60) / 60;
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

  useEffect(() => {
    const value = originInput.trim();

    if (isAirportScheduledRide || value.length < 3 || originPoint?.text === value) {
      setOriginSuggestions([]);
      setSearchingOrigin(false);
      return;
    }

    const seq = ++originSearchSeq.current;
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
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [isAirportScheduledRide, originInput, originPoint?.text]);

  useEffect(() => {
    const value = destInput.trim();

    if (value.length < 3 || destinationPoint?.text === value) {
      setDestSuggestions([]);
      setSearchingDest(false);
      return;
    }

    const seq = ++destSearchSeq.current;
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
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [destInput, destinationPoint?.text]);

  function applyOrigin(point: PickerResult): void {
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
  }

  async function applyMovedOriginFromMap(payload: MapPointMovedPayload): Promise<void> {
    if (payload.point !== "origin") return;

    setSubmitError(null);

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

  function applyDestination(point: PickerResult, options?: { keepRoundTripPromotion?: boolean }): void {
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


  async function handleSelectRoundTripPromotion(promotion: RoundTripPromotion): Promise<void> {
    setSubmitError(null);
    // La promo sale ahora. Solo se agenda la hora de regreso.
    setRideMode("now");
    setScheduledAt("");
    setAirportWelcomeOption("none");
    setFlightNumber("");
    setSelectedRoundTripPromotionId(promotion.id);
    setTripFareMode("round_trip");
    setReturnScheduledAt("");
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
    setReturnScheduledAt("");
    setSubmitError(null);
  }

  function handleUseCurrentLocation(): void {
    if (!navigator.geolocation) {
      setSubmitError("Tu navegador no permite obtener ubicación.");
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
          text: "Mi ubicación actual",
          address: "Ubicación GPS detectada",
          lat: gpsPoint.lat,
          lng: gpsPoint.lng,
          placeId: null,
          originalLat: gpsPoint.lat,
          originalLng: gpsPoint.lng,
          walkMeters: 0,
          isAccessiblePickup: false,
        });

        setOriginInput("Mi ubicación actual");
        setOriginSuggestions([]);
            setPickerTarget("origin");
        setLocating(false);
      },
      () => {
        setLocating(false);
        setSubmitError(
          "No se pudo obtener tu ubicación. Activa el GPS y vuelve a intentar.",
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

      void fetchMyApprovedPolicyChargesForRequest(
        session.accessToken,
      )
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
      if (
        !event.key ||
        event.key === RAPAGO_PASSENGER_PENDING_CHARGES_KEY
      ) {
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

  const airportWelcomeSurchargeClp =
    isAirportScheduledRide && airportWelcomeOption === "flower_lei"
      ? AIRPORT_FLOWER_LEI_SURCHARGE_CLP
      : 0;
  const hasAirportFlowerLei = airportWelcomeSurchargeClp > 0;
  const localPendingPassengerCharges =
    pendingChargeRevision >= 0
      ? readPassengerPendingChargesForRequest(session?.user)
      : [];
  const pendingPassengerCharges =
    mergePassengerPendingChargesForRequest(
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
    pendingNoShowChargeTotalClp +
    pendingCancellationChargeTotalClp;
  // El backend es la única autoridad del saldo disponible. Los registros
  // antiguos de LocalStorage no se suman ni se descuentan financieramente.
  const availableWalletBenefitTotalClp = backendWalletBenefitClp;
  const hasAvailableWalletBenefit = availableWalletBenefitTotalClp > 0;

  function getBaseSelectedFareAmount(method: PaymentMethod = paymentMethod): number | null {
    if (!method) return null;
    if (selectedRoundTripPromotion) return selectedRoundTripPromotion.fareClp;
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
    if (amount == null || useWalletBenefit !== true || availableWalletBenefitTotalClp <= 0) return 0;
    return Math.min(Math.max(0, Math.round(amount)), availableWalletBenefitTotalClp);
  }

  function getSelectedFareAmountBeforeWallet(method: PaymentMethod = paymentMethod): number | null {
    return addPendingPassengerCharges(addAirportWelcomeExtras(getBaseSelectedFareAmount(method)));
  }

  function getSelectedWalletBenefitDiscount(method: PaymentMethod = paymentMethod): number {
    if (method !== "cash") return 0;
    return getWalletBenefitDiscountForAmount(
      getSelectedFareAmountBeforeWallet(method),
    );
  }

  const cashPaymentAmountBeforeWallet = addPendingPassengerCharges(addAirportWelcomeExtras(
    selectedRoundTripPromotion
      ? selectedRoundTripPromotion.fareClp
      : fareQuote
        ? fareQuote.cashFare
        : null,
  ));
  const cardPaymentAmountBeforeWallet = addPendingPassengerCharges(addAirportWelcomeExtras(
    selectedRoundTripPromotion
      ? selectedRoundTripPromotion.fareClp
      : fareQuote
        ? fareQuote.cardFare
        : null,
  ));
  const cashWalletBenefitDiscountClp = getWalletBenefitDiscountForAmount(
    cashPaymentAmountBeforeWallet,
  );
  const cardWalletBenefitDiscountClp = 0;
  const cashPaymentAmount = applyWalletBenefitDiscount(
    cashPaymentAmountBeforeWallet,
  );
  // Beneficios jamás modifica un cobro con tarjeta.
  const cardPaymentAmount = cardPaymentAmountBeforeWallet;

  function getPaymentLabel(method: PaymentMethod): string {
    if (method === "cash") {
      return cashPaymentAmount != null
        ? `Efectivo · ${formatCLP(cashPaymentAmount)}`
        : "Efectivo";
    }
    if (method === "card") {
      return cardPaymentAmount != null
        ? `Tarjeta · ${formatCLP(cardPaymentAmount)}`
        : "Tarjeta · Mercado Pago";
    }
    return "Pendiente";
  }

  const cashPaymentLabel = cashPaymentAmount != null
    ? formatCLP(cashPaymentAmount)
    : "Calculando";
  const cashPaymentUsdLabel = cashPaymentAmount != null
    ? formatUSDFromCLP(
        cashPaymentAmount,
        selectedRoundTripPromotion?.usdLabel ? fareRules.usdRate : fareQuote?.usdRate,
      )
    : "Calculando";

  const cardPaymentLabel = cardPaymentAmount != null
    ? formatCLP(cardPaymentAmount)
    : "Calculando";
  const cardPaymentUsdLabel = cardPaymentAmount != null
    ? formatUSDFromCLP(
        cardPaymentAmount,
        selectedRoundTripPromotion?.usdLabel ? fareRules.usdRate : fareQuote?.usdRate,
      )
    : "Calculando";

  const activePaymentAmountBeforeWallet = paymentMethod === "card"
    ? cardPaymentAmountBeforeWallet
    : paymentMethod === "cash"
      ? cashPaymentAmountBeforeWallet
      : null;
  const activeWalletBenefitDiscountClp = paymentMethod === "card"
    ? cardWalletBenefitDiscountClp
    : paymentMethod === "cash"
      ? cashWalletBenefitDiscountClp
      : 0;
  const activePaymentAmountAfterWallet = paymentMethod === "card"
    ? cardPaymentAmount
    : paymentMethod === "cash"
      ? cashPaymentAmount
      : null;

  function getSelectedFareAmount(method: PaymentMethod = paymentMethod): number | null {
    const beforeBenefit = getSelectedFareAmountBeforeWallet(method);
    return method === "cash"
      ? applyWalletBenefitDiscount(beforeBenefit)
      : beforeBenefit;
  }

  function getSelectedDriverEarning(method: PaymentMethod = paymentMethod): number | null {
    // La ganancia del conductor se calcula sobre el viaje actual, no sobre deudas anteriores ni descuentos de billetera.
    const fare = addAirportWelcomeExtras(getBaseSelectedFareAmount(method));
    if (fare == null) return null;
    return Math.round((fare * fareRules.driverPercent) / 100);
  }

  function handleOpenPaymentBox(): void {
    setSubmitError(null);
    setShowPaymentBox(true);
  }

  function handleSelectPayment(method: Exclude<PaymentMethod, null>): void {
    if (reservationRequiresCard && method === "cash") {
      setPaymentMethod("card");
      setShowPaymentBox(false);
      setSubmitError("Todas las reservas se pagan obligatoriamente con tarjeta/Mercado Pago. Si cancelas dentro de los últimos 30 minutos, se descuenta 30% con tope $3.000. El saldo restante se gestiona como devolución al medio de pago original y no se convierte en Beneficios.");
      return;
    }

    setPaymentMethod(method);
    setShowPaymentBox(false);
    setSubmitError(null);
  }

  async function handleRequest(): Promise<void> {
    if (!session?.accessToken) return;

    if (hasPassengerActiveRideForRequest(session.user)) {
      setSubmitError("Ya tienes un viaje o una reserva activa reciente. Revisa Mis Viajes antes de solicitar otra.");
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

    if (activePaymentMethod !== "cash" && String(activePaymentMethod) !== "card") {
      setShowPaymentBox(true);
      setSubmitError("Antes de solicitar el viaje debes elegir forma de pago.");
      return;
    }

    if (reservationRequiresCard && String(activePaymentMethod) !== "card") {
      setPaymentMethod("card");
      setShowPaymentBox(true);
      setSubmitError("Todas las reservas deben pagarse obligatoriamente con tarjeta/Mercado Pago. Si cancelas dentro de los últimos 30 minutos, se descuenta 30% con tope $3.000. El saldo restante se gestiona como devolución al medio de pago original y no se convierte en Beneficios.");
      return;
    }

    if (hasAvailableWalletBenefit && useWalletBenefit === null) {
      setSubmitError(`Tienes ${formatCLP(availableWalletBenefitTotalClp)} a favor. Elige si quieres usar tu beneficio en este viaje.`);
      return;
    }

    const selectedFareAmountBeforeWallet = getSelectedFareAmountBeforeWallet(activePaymentMethod);
    const selectedWalletBenefitDiscountClp = getSelectedWalletBenefitDiscount(activePaymentMethod);
    const selectedFareAmount = getSelectedFareAmount(activePaymentMethod);
    const selectedBaseFareAmount = getBaseSelectedFareAmount(activePaymentMethod);
    const selectedDriverEarning = getSelectedDriverEarning(activePaymentMethod);

    if (selectedFareAmount == null || selectedFareAmount < 0 || selectedFareAmountBeforeWallet == null) {
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

      notes.push(`Forma de pago seleccionada: ${getPaymentLabel(activePaymentMethod)}.`);
      if (reservationRequiresCard) {
        notes.push("Pago obligatorio para reservas: tarjeta/Mercado Pago.");
        notes.push("Gestión reserva: el administrador designa conductor 30 minutos antes del inicio del servicio.");
        notes.push("Política cancelación reserva: desde los últimos 30 minutos previos al inicio se cobra 30% con tope $3.000.");
        notes.push("Si se cancela con tarjeta, la penalización aprobada se descuenta del pago y el saldo restante se gestiona como devolución al medio de pago original. No se convierte en Beneficios ni en saldo transferible.");
      }
      if (pendingPassengerChargeTotalClp > 0) {
        notes.push(`Cargo pendiente anterior por cancelación/no show aplicado al próximo viaje: ${formatCLP(pendingPassengerChargeTotalClp)}.`);
        notes.push(`Total antes de beneficio billetera incluyendo cargo pendiente anterior: ${formatCLP(selectedFareAmountBeforeWallet)}.`);
      }
      if (selectedWalletBenefitDiscountClp > 0) {
        notes.push(`Beneficio billetera usado en este viaje: ${formatCLP(selectedWalletBenefitDiscountClp)}.`);
        notes.push(`Tarifa antes de beneficio billetera: ${formatCLP(selectedFareAmountBeforeWallet)}.`);
        notes.push(`Total final con descuento beneficio: ${formatCLP(selectedFareAmount)}.`);
      } else if (hasAvailableWalletBenefit && useWalletBenefit === false) {
        notes.push(`Beneficio billetera disponible no usado por el pasajero en este viaje: ${formatCLP(availableWalletBenefitTotalClp)}.`);
      }
      notes.push(`Categoría de vehículo seleccionada: ${vehicleCategoryLabel(vehicleCategory)}.`);
      notes.push(`Tipo de viaje seleccionado: ${tripFareModeLabel(effectiveTripFareMode)}.`);
      if (selectedRoundTripPromotion) {
        notes.push(`Promoción con regreso seleccionado: ${selectedRoundTripPromotion.title}.`);
        notes.push(`Destino promocional: ${selectedRoundTripPromotion.destinationName}.`);
        notes.push(`Tarifa fija base promoción: ${formatCLP(selectedRoundTripPromotion.baseFareClp)} (${selectedRoundTripPromotion.usdLabel}).`);
        if (selectedBaseFareAmount != null) {
          notes.push(`Tarifa base antes de servicios opcionales: ${formatCLP(selectedBaseFareAmount)}.`);
        }
        notes.push(`Tarifa RAPA GO calculada: ${formatCLP(selectedFareAmount)}.`);
        notes.push(`Tarifa estimada pasajero: ${formatCLP(selectedFareAmount)}.`);
        if (selectedRoundTripPromotion.chargeLabel && airportWelcomeSurchargeClp === 0) notes.push(selectedRoundTripPromotion.chargeLabel + ".");
        notes.push(selectedRoundTripPromotion.detail);
      }

      const scheduleFields = buildRideScheduleFields({
        // En promociones ida + agendamiento de recogida, la solicitud principal
        // sale ahora y la recogida de regreso se crea como una segunda reserva.
        rideMode: selectedRoundTripPromotion ? "now" : rideMode,
        tripFareMode: selectedRoundTripPromotion ? "one_way" : effectiveTripFareMode,
        scheduledAt: selectedRoundTripPromotion ? "" : scheduledAt,
        returnScheduledAt: selectedRoundTripPromotion ? "" : returnScheduledAt,
        scheduleKind: selectedRoundTripPromotion ? "airport_pickup" : "airport_pickup",
      });

      if (selectedRoundTripPromotion && returnScheduledAt) {
        notes.push("Tipo de servicio: ida ahora + agendamiento de recogida de regreso.");
        notes.push(`Recogida de regreso elegida por el pasajero: ${formatScheduleDateTime(returnScheduledAt)}.`);
        notes.push(`Promoción regreso: ${selectedRoundTripPromotion.destinationName}.`);
      }

      if (rideMode === "scheduled") {
        notes.push(`RAPAGO_SCHEDULED_AT: ${String(scheduleFields.scheduledAt ?? "")}.`);
        notes.push(`RAPAGO_ACTIVATION_AT: ${String(scheduleFields.scheduleActivationAt ?? "")}.`);
        notes.push(`Fecha y hora de recogida agendada: ${String(scheduleFields.scheduledAt ?? "")}.`);
        notes.push(`Viaje agendado para: ${formatScheduleDateTime(String(scheduleFields.scheduledAt ?? scheduledAt))}.`);
        notes.push(`La solicitud se activa automáticamente ${SCHEDULE_ACTIVATION_MINUTES} minutos antes: ${formatScheduleDateTime(String(scheduleFields.scheduleActivationAt ?? ""))}.`);
        notes.push(`Reserva congelada para conductores hasta: ${String(scheduleFields.scheduleActivationAt ?? "")}.`);
        if (selectedRoundTripPromotion) {
          notes.push("Tipo de reserva: promoción con regreso agendado.");
          notes.push(`Promoción regreso: ${selectedRoundTripPromotion.destinationName}.`);
          notes.push("Recogida a elección del pasajero.");
        } else {
          notes.push(`Tipo de reserva: recogida aeropuerto.`);
          notes.push("Pago obligatorio para reservas: tarjeta/Mercado Pago.");
          notes.push("Política cancelación reserva: dentro de los últimos 30 minutos se cobra 30% con tope $3.000; el saldo restante se gestiona como devolución al medio de pago original por backend/Mercado Pago.");
          notes.push(`Origen automático aeropuerto: ${RAPA_NUI_AIRPORT_DESTINATION.text}.`);
          notes.push(`RAPAGO_AIRPORT_ORIGIN_LAT: ${RAPA_NUI_AIRPORT_DESTINATION.lat}.`);
          notes.push(`RAPAGO_AIRPORT_ORIGIN_LNG: ${RAPA_NUI_AIRPORT_DESTINATION.lng}.`);
        }

        if (effectiveTripFareMode === "round_trip" && returnScheduledAt) {
          notes.push(`RAPAGO_RETURN_SCHEDULED_AT: ${String(scheduleFields.returnScheduledAt ?? "")}.`);
          notes.push(`Fecha y hora de regreso agendada: ${String(scheduleFields.returnScheduledAt ?? "")}.`);
          notes.push(`Regreso agendado para: ${formatScheduleDateTime(String(scheduleFields.returnScheduledAt ?? returnScheduledAt))}.`);
        }

        if (!selectedRoundTripPromotion && flightNumber.trim()) {
          notes.push(`Número de vuelo: ${flightNumber.trim()}.`);
        }

        if (selectedRoundTripPromotion) {
          notes.push("Servicio de aeropuerto: no aplica para esta promoción.");
        } else if (airportWelcomeOption === "flower_lei") {
          notes.push(`Recibimiento aeropuerto: ${AIRPORT_FLOWER_LEI_LABEL} solicitado.`);
          notes.push(`Admin debe gestionar el collar de flores para la llegada del pasajero en Mataveri.`);
          notes.push(`Recargo recibimiento ${AIRPORT_FLOWER_LEI_LABEL}: ${formatCLP(AIRPORT_FLOWER_LEI_SURCHARGE_CLP)}.`);
          notes.push(`Total final con recibimiento: ${formatCLP(selectedFareAmount)}.`);
        } else {
          notes.push("Recibimiento aeropuerto: solo recogida.");
        }
      }

      notes.push(`Nombre origen visible para conductor: ${resolved.origin.text}.`);
      notes.push(`Nombre destino visible para conductor: ${resolved.destination.text}.`);
      notes.push(`RAPAGO_ORIGIN_DISPLAY: ${resolved.origin.text}.`);
      notes.push(`RAPAGO_DESTINATION_DISPLAY: ${resolved.destination.text}.`);
      notes.push(`Dirección origen confirmada: ${resolved.origin.address}.`);
      notes.push(`Dirección destino confirmada: ${resolved.destination.address}.`);

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

      if (!selectedRoundTripPromotion && fareQuote && selectedFareAmount != null) {
        if (selectedBaseFareAmount != null && airportWelcomeSurchargeClp > 0) {
          notes.push(`Tarifa base antes de servicios opcionales: ${formatCLP(selectedBaseFareAmount)}.`);
        }
        notes.push(`Tarifa RAPA GO calculada: ${formatCLP(selectedFareAmount)}.`);
        notes.push(`Tarifa estimada pasajero: ${formatCLP(selectedFareAmount)}.`);
        notes.push(`Distancia estimada: ${fareQuote.km.toFixed(1)} km.`);
        notes.push(`Duración estimada: ${fareQuote.minutes} min.`);
        notes.push(`Tipo de cálculo tarifario: ${fareQuote.calculationType === "fixed" ? "tarifa fija" : fareQuote.ruralKm > 0 ? "urbano/rural" : "urbano"}.`);
        notes.push(`Tipo de viaje tarifario: ${tripFareModeLabel(effectiveTripFareMode)}.`);
        notes.push(`Tipo de pasajero tarifario: ${passengerFareTypeLabel(fareQuote.passengerFareType)}.`);
        if (fareQuote.tripMultiplier > 1) {
          notes.push(`Ida y vuelta variable: tarifa ida ${formatCLP(fareQuote.oneWayFare)} x ${fareQuote.tripMultiplier}.`);
        }
        notes.push(`Tramo urbano calculado: ${fareQuote.urbanKm.toFixed(1)} km hasta límite ${fareQuote.urbanLimitKm.toFixed(1)} km.`);
        if (fareQuote.ruralKm > 0) {
          notes.push(`Tramo rural calculado: ${fareQuote.ruralKm.toFixed(1)} km con descuento rural ${fareQuote.ruralDiscountPercent}%.`);
          notes.push(`KM urbano ajustado: ${formatCLP(fareQuote.urbanKmFare)}. KM rural corregido: ${formatCLP(fareQuote.ruralKmFare)}.`);
        }
        if (selectedDriverEarning != null) {
          notes.push(`Ganancia estimada conductor: ${formatCLP(selectedDriverEarning)}.`);
        }
      }

      const input: CreateRideInput = {
        originText: resolved.origin.text,
        destinationText: resolved.destination.text,
      };

      if (selectedFareAmount != null) {
        (input as CreateRideInput & {
          estimatedFareClp?: number;
          passengerFareType?: PassengerFareType;
          farePassengerType?: PassengerFareType;
          fareVehicleCategory?: VehicleCategory;
          vehicleCategory?: VehicleCategory;
          paymentMethod?: string;
          tripFareMode?: TripFareMode;
          tripType?: string;
          isRoundTrip?: boolean;
        }).estimatedFareClp = Math.max(
          0,
          Math.round(
            (selectedFareAmountBeforeWallet ?? 0) -
              pendingPassengerChargeTotalClp,
          ),
        );
        (input as CreateRideInput & {
          passengerFareType?: PassengerFareType;
          farePassengerType?: PassengerFareType;
        }).passengerFareType = effectivePassengerFareType;
        (input as CreateRideInput & {
          passengerFareType?: PassengerFareType;
          farePassengerType?: PassengerFareType;
        }).farePassengerType = effectivePassengerFareType;
        (input as CreateRideInput & {
          passengerFareLabel?: string;
          nationality?: string;
          isResident?: boolean;
          requestedByRole?: string;
          requesterRole?: string;
        }).passengerFareLabel = passengerFareTypeLabel(effectivePassengerFareType);
        (input as CreateRideInput & {
          passengerFareLabel?: string;
          nationality?: string;
          isResident?: boolean;
          requestedByRole?: string;
          requesterRole?: string;
        }).nationality = passengerFareTypeLabel(effectivePassengerFareType);
        (input as CreateRideInput & {
          passengerFareLabel?: string;
          nationality?: string;
          isResident?: boolean;
          requestedByRole?: string;
          requesterRole?: string;
        }).isResident = effectivePassengerFareType === "resident";
        (input as CreateRideInput & { requestedByRole?: string; requesterRole?: string }).requestedByRole = "passenger";
        (input as CreateRideInput & { requestedByRole?: string; requesterRole?: string }).requesterRole = "passenger";
        (input as CreateRideInput & {
          fareVehicleCategory?: VehicleCategory;
          vehicleCategory?: VehicleCategory;
        }).fareVehicleCategory = vehicleCategory;
        (input as CreateRideInput & {
          fareVehicleCategory?: VehicleCategory;
          vehicleCategory?: VehicleCategory;
        }).vehicleCategory = vehicleCategory;
        (input as CreateRideInput & { paymentMethod?: string }).paymentMethod = activePaymentMethod;
        // Phase 3 security:
        // Cancellation/no-show charges are backend/admin authority only.
        // Do not send passengerPendingChargeClp or finalFareWithPendingChargesClp from frontend.
        // El frontend solo expresa la decisión. El backend bloquea la cuenta,
        // verifica el saldo y calcula el monto real a consumir.
        input.useWalletBenefit =
          activePaymentMethod === "cash" && useWalletBenefit === true;
        (input as CreateRideInput & { tripFareMode?: TripFareMode }).tripFareMode = effectiveTripFareMode;
        (input as CreateRideInput & { tripType?: string }).tripType = effectiveTripFareMode;
        (input as CreateRideInput & { isRoundTrip?: boolean }).isRoundTrip = effectiveTripFareMode === "round_trip";
      }

      // Conservador: no enviamos un campo nuevo que el backend todavía podría
      // rechazar. La nota viaja dentro de `notes` con marcadores explícitos.
      Object.assign(input as CreateRideInput & Record<string, unknown>, scheduleFields);
      if (isAirportScheduledRide) {
        Object.assign(input as CreateRideInput & Record<string, unknown>, {
          airportWelcomeOption,
          airportWelcomeLabel: hasAirportFlowerLei ? AIRPORT_FLOWER_LEI_LABEL : "Solo recogida",
          flowerLeiRequested: hasAirportFlowerLei,
          flowerLeiSurchargeClp: airportWelcomeSurchargeClp,
          airportWelcomeSurchargeClp,
          optionalServicesTotalClp: airportWelcomeSurchargeClp,
          baseFareBeforeExtrasClp: selectedBaseFareAmount,
          finalFareWithExtrasClp: selectedFareAmount,
          airportReservationRequiresCard: isAirportScheduledRide,
          reservationRequiresCard: reservationRequiresCard,
          paymentRequiredProvider: "mercadopago",
          cardCancellationCreditToWallet: false,
          cardCancellationAdminReviewRequired: reservationRequiresCard && String(activePaymentMethod) === "card",
          cardCancellationCreditName: null,
        });
      } else if (selectedRoundTripPromotion) {
        Object.assign(input as CreateRideInput & Record<string, unknown>, {
          roundTripPromotionId: selectedRoundTripPromotion.id,
          roundTripPromotionTitle: selectedRoundTripPromotion.title,
          roundTripPromotionDestination: selectedRoundTripPromotion.destinationName,
          roundTripPromotionBooking: true,
          roundTripOutboundNow: true,
          roundTripReturnOnly: false,
          roundTripReturnPickupRequested: true,
          roundTripReturnPickupAt: returnScheduledAt,
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

      const createdRideId = extractRideRequestIdFromResponse(createdRideResponse);
      const appliedBenefitClp = Math.max(
        0,
        Math.round(
          Number(createdRideResponse.walletBenefitAppliedClp ?? 0),
        ),
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
      const pendingReturnPickupRide = selectedRoundTripPromotion && returnScheduledAt
        ? createRoundTripReturnPickupRide({
            returnOriginText: selectedRoundTripPromotion.destinationName,
            returnOriginAddress: resolved.destination.address,
            returnOriginLat: resolved.destination.lat,
            returnOriginLng: resolved.destination.lng,
            returnDestinationText: resolved.origin.text,
            returnDestinationAddress: resolved.origin.address,
            returnDestinationLat: resolved.origin.lat,
            returnDestinationLng: resolved.origin.lng,
            returnScheduledAt,
            promotionTitle: selectedRoundTripPromotion.title,
            promotionDestinationName: selectedRoundTripPromotion.destinationName,
            relatedOutboundRideId: createdRideId,
            passengerNote: passengerNote || null,
            passengerName: getSessionDisplayName(session.user),
            passengerEmail: getSessionEmail(session.user),
            passengerFareType: effectivePassengerFareType,
            passengerFareLabel: passengerFareTypeLabel(effectivePassengerFareType),
          })
        : null;

      const pendingScheduledRide = rideMode === "scheduled"
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
            scheduleKind: selectedRoundTripPromotion ? "round_trip_promotion" : "airport_pickup",
            passengerName: getSessionDisplayName(session.user),
            passengerEmail: getSessionEmail(session.user),
            passengerFareType: effectivePassengerFareType,
            passengerFareLabel: passengerFareTypeLabel(effectivePassengerFareType),
            airportWelcomeOption: rideMode === "scheduled" ? airportWelcomeOption : null,
            airportWelcomeLabel: hasAirportFlowerLei ? AIRPORT_FLOWER_LEI_LABEL : "Solo recogida",
            flowerLeiRequested: hasAirportFlowerLei,
            airportWelcomeSurchargeClp,
            optionalServicesTotalClp: airportWelcomeSurchargeClp,
            baseFareBeforeExtrasClp: selectedBaseFareAmount,
            backendCancellationReviewRequired: pendingPassengerChargeTotalClp > 0,
            localStorageFinancialAuthority: false,
            walletBenefitRequested: selectedWalletBenefitDiscountClp > 0,
            walletBenefitApplied: selectedWalletBenefitDiscountClp > 0,
            walletBenefitAppliedClp: selectedWalletBenefitDiscountClp,
            walletBenefitDiscountClp: selectedWalletBenefitDiscountClp,
            walletBenefitOriginalFareClp: selectedFareAmountBeforeWallet,
            originalFareBeforeWalletBenefitClp: selectedFareAmountBeforeWallet,
            finalFareAfterWalletBenefitClp: selectedFareAmount,
            walletBenefitAvailableButNotUsedClp: hasAvailableWalletBenefit && useWalletBenefit === false ? availableWalletBenefitTotalClp : 0,
          } as Parameters<typeof createLocalAdminScheduledRide>[0] & Record<string, unknown>)
        : null;

      if (String(activePaymentMethod) === "card" && selectedFareAmount > 0) {
        if (!createdRideId) {
          throw new Error("El viaje se creó, pero no se pudo obtener el ID para iniciar Mercado Pago.");
        }

        const payment = await createMercadoPagoCheckout({
          accessToken: session.accessToken,
          rideRequestId: createdRideId,
        });

        if (pendingPassengerChargeTotalClp > 0) {
          markPassengerPendingChargesAppliedToRide(
            session.user,
            createdRideId,
          );
        }

        try {
          localStorage.setItem(
            "rapago_pending_card_payment_v1",
            JSON.stringify({
              rideRequestId: createdRideId,
              paymentId: payment.paymentId,
              amountClp: selectedFareAmount,
              provider: "mercadopago",
              createdAt: new Date().toISOString(),
              originText: resolved.origin.text,
              destinationText: resolved.destination.text,
              scheduledRideMirror: pendingScheduledRide
                ? {
                    ...pendingScheduledRide,
                    serverRideId: createdRideId,
                    originalRideId: createdRideId,
                    paymentStatus: "pending",
                  }
                : null,
              returnPickupRideMirror: pendingReturnPickupRide
                ? {
                    ...pendingReturnPickupRide,
                    relatedOutboundRideId: createdRideId,
                    paymentStatus: "pending",
                  }
                : null,
            }),
          );
        } catch {
          // No bloquea la redirección a Mercado Pago.
        }

        window.location.href = payment.urlPay;
        return;
      }

      if (pendingReturnPickupRide) {
        upsertRoundTripReturnPickupRide(pendingReturnPickupRide);
      }

      if (pendingScheduledRide) {
        upsertLocalAdminScheduledRide(pendingScheduledRide);
      }

      if (pendingPassengerChargeTotalClp > 0) {
        markPassengerPendingChargesAppliedToRide(
          session.user,
          createdRideId,
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
      setOriginSuggestions([]);
      setDestSuggestions([]);
      setRideMode("now");
      setTripFareMode("one_way");
      setSelectedRoundTripPromotionId(null);
      setPaymentMethod(null);
      setShowPaymentBox(false);
      setVehicleCategory("standard");
      setUseWalletBenefit(null);

      history.push("/passenger/trips");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al solicitar el viaje.";
      const normalizedMessage = message.toLowerCase();

      if (
        normalizedMessage.includes("legal_acceptance_required") ||
        normalizedMessage.includes("documentos legales requeridos") ||
        normalizedMessage.includes("debes aceptar los documentos legales")
      ) {
        setSubmitError(
          "Debes aceptar los documentos legales vigentes antes de solicitar un viaje. Te llevaremos a Perfil > Documentos.",
        );
        window.setTimeout(() => {
          history.push(ROUTES.PROFILE.DOCUMENTS);
        }, 500);
        return;
      }

      if (isPassengerRolePermissionMessage(message)) {
        if (String(activePaymentMethod) === "card") {
          setSubmitError("Para pagar con tarjeta debes estar conectado como pasajero real en la API. Inicia sesión de nuevo y vuelve a intentar.");
          return;
        }

        const localNotes: string[] = [];
        appendPassengerRideNote(localNotes, passengerNote);

        localNotes.push(`Forma de pago seleccionada: ${getPaymentLabel(activePaymentMethod)}.`);
        if (reservationRequiresCard) {
          localNotes.push("Pago obligatorio para reservas: tarjeta/Mercado Pago.");
          localNotes.push("Gestión reserva: el administrador designa conductor 30 minutos antes del inicio del servicio.");
          localNotes.push("Política cancelación reserva: desde los últimos 30 minutos previos al inicio se cobra 30% con tope $3.000.");
          localNotes.push("Si se cancela con tarjeta, la penalización aprobada se descuenta del pago y el saldo restante se gestiona como devolución al medio de pago original. No se convierte en Beneficios ni en saldo transferible.");
        }
        if (pendingPassengerChargeTotalClp > 0) {
          localNotes.push(`Cargo pendiente anterior por cancelación/no show aplicado al próximo viaje: ${formatCLP(pendingPassengerChargeTotalClp)}.`);
          localNotes.push(`Total antes de beneficio billetera incluyendo cargo pendiente anterior: ${formatCLP(selectedFareAmountBeforeWallet)}.`);
        }
        if (selectedWalletBenefitDiscountClp > 0) {
          localNotes.push(`Beneficio billetera usado en este viaje: ${formatCLP(selectedWalletBenefitDiscountClp)}.`);
          localNotes.push(`Tarifa antes de beneficio billetera: ${formatCLP(selectedFareAmountBeforeWallet)}.`);
          localNotes.push(`Total final con descuento beneficio: ${formatCLP(selectedFareAmount)}.`);
        } else if (hasAvailableWalletBenefit && useWalletBenefit === false) {
          localNotes.push(`Beneficio billetera disponible no usado por el pasajero en este viaje: ${formatCLP(availableWalletBenefitTotalClp)}.`);
        }
        localNotes.push(`Categoría de vehículo seleccionada: ${vehicleCategoryLabel(vehicleCategory)}.`);
        localNotes.push(`Tipo de viaje seleccionado: ${tripFareModeLabel(effectiveTripFareMode)}.`);
        if (selectedRoundTripPromotion) {
          localNotes.push(`Promoción con regreso seleccionado: ${selectedRoundTripPromotion.title}.`);
          localNotes.push(`Destino promocional: ${selectedRoundTripPromotion.destinationName}.`);
          localNotes.push(`Tarifa fija base promoción: ${formatCLP(selectedRoundTripPromotion.baseFareClp)} (${selectedRoundTripPromotion.usdLabel}).`);
          localNotes.push(`Tarifa RAPA GO calculada: ${formatCLP(selectedFareAmount)}.`);
          localNotes.push(`Tarifa estimada pasajero: ${formatCLP(selectedFareAmount)}.`);
          if (selectedRoundTripPromotion.chargeLabel) localNotes.push(selectedRoundTripPromotion.chargeLabel + ".");
          localNotes.push(selectedRoundTripPromotion.detail);
        }

        const localScheduleFields = buildRideScheduleFields({
          rideMode: selectedRoundTripPromotion ? "now" : rideMode,
          tripFareMode: selectedRoundTripPromotion ? "one_way" : effectiveTripFareMode,
          scheduledAt: selectedRoundTripPromotion ? "" : scheduledAt,
          returnScheduledAt: selectedRoundTripPromotion ? "" : returnScheduledAt,
          scheduleKind: selectedRoundTripPromotion ? "airport_pickup" : "airport_pickup",
        });

        if (selectedRoundTripPromotion && returnScheduledAt) {
          localNotes.push("Tipo de servicio: ida ahora + agendamiento de recogida de regreso.");
          localNotes.push(`Recogida de regreso elegida por el pasajero: ${formatScheduleDateTime(returnScheduledAt)}.`);
          localNotes.push(`Promoción regreso: ${selectedRoundTripPromotion.destinationName}.`);
        }

        if (rideMode === "scheduled") {
          localNotes.push(`RAPAGO_SCHEDULED_AT: ${String(localScheduleFields.scheduledAt ?? "")}.`);
          localNotes.push(`RAPAGO_ACTIVATION_AT: ${String(localScheduleFields.scheduleActivationAt ?? "")}.`);
          localNotes.push(`Fecha y hora de recogida agendada: ${String(localScheduleFields.scheduledAt ?? "")}.`);
          localNotes.push(`Viaje agendado para: ${formatScheduleDateTime(String(localScheduleFields.scheduledAt ?? scheduledAt))}.`);
          localNotes.push(`La solicitud se activa automáticamente ${SCHEDULE_ACTIVATION_MINUTES} minutos antes: ${formatScheduleDateTime(String(localScheduleFields.scheduleActivationAt ?? ""))}.`);
          localNotes.push(`Reserva congelada para conductores hasta: ${String(localScheduleFields.scheduleActivationAt ?? "")}.`);
          if (selectedRoundTripPromotion) {
            localNotes.push("Tipo de reserva: promoción con regreso agendado.");
            localNotes.push(`Promoción regreso: ${selectedRoundTripPromotion.destinationName}.`);
            localNotes.push("Recogida a elección del pasajero.");
          } else {
            localNotes.push(`Tipo de reserva: recogida aeropuerto.`);
            localNotes.push("Pago obligatorio para reservas: tarjeta/Mercado Pago.");
            localNotes.push("Política cancelación reserva: dentro de los últimos 30 minutos se cobra 30% con tope $3.000; el saldo restante se gestiona como devolución al medio de pago original por backend/Mercado Pago.");
            localNotes.push(`Origen automático aeropuerto: ${RAPA_NUI_AIRPORT_DESTINATION.text}.`);
            localNotes.push(`RAPAGO_AIRPORT_ORIGIN_LAT: ${RAPA_NUI_AIRPORT_DESTINATION.lat}.`);
            localNotes.push(`RAPAGO_AIRPORT_ORIGIN_LNG: ${RAPA_NUI_AIRPORT_DESTINATION.lng}.`);
          }

          if (effectiveTripFareMode === "round_trip" && returnScheduledAt) {
            localNotes.push(`RAPAGO_RETURN_SCHEDULED_AT: ${String(localScheduleFields.returnScheduledAt ?? "")}.`);
            localNotes.push(`Fecha y hora de regreso agendada: ${String(localScheduleFields.returnScheduledAt ?? "")}.`);
            localNotes.push(`Regreso agendado para: ${formatScheduleDateTime(String(localScheduleFields.returnScheduledAt ?? returnScheduledAt))}.`);
          }

          if (!selectedRoundTripPromotion && flightNumber.trim()) {
            localNotes.push(`Número de vuelo: ${flightNumber.trim()}.`);
          }

          if (selectedRoundTripPromotion) {
            localNotes.push("Servicio de aeropuerto: no aplica para esta promoción.");
          } else if (airportWelcomeOption === "flower_lei") {
            localNotes.push(`Recibimiento aeropuerto: ${AIRPORT_FLOWER_LEI_LABEL} solicitado.`);
            localNotes.push(`Admin debe gestionar el collar de flores para la llegada del pasajero en Mataveri.`);
            localNotes.push(`Recargo recibimiento ${AIRPORT_FLOWER_LEI_LABEL}: ${formatCLP(AIRPORT_FLOWER_LEI_SURCHARGE_CLP)}.`);
            localNotes.push(`Total final con recibimiento: ${formatCLP(selectedFareAmount)}.`);
          } else {
            localNotes.push("Recibimiento aeropuerto: solo recogida.");
          }
        }

        localNotes.push(`Dirección origen confirmada: ${resolved.origin.address}.`);
        localNotes.push(`Dirección destino confirmada: ${resolved.destination.address}.`);

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

        if (!selectedRoundTripPromotion && fareQuote && selectedFareAmount != null) {
          if (selectedBaseFareAmount != null && airportWelcomeSurchargeClp > 0) {
            localNotes.push(`Tarifa base antes de servicios opcionales: ${formatCLP(selectedBaseFareAmount)}.`);
          }
          localNotes.push(`Tarifa RAPA GO calculada: ${formatCLP(selectedFareAmount)}.`);
          localNotes.push(`Tarifa estimada pasajero: ${formatCLP(selectedFareAmount)}.`);
          localNotes.push(`Distancia estimada: ${fareQuote.km.toFixed(1)} km.`);
          localNotes.push(`Duración estimada: ${fareQuote.minutes} min.`);
          localNotes.push(`Tipo de viaje tarifario: ${tripFareModeLabel(effectiveTripFareMode)}.`);
          localNotes.push(`Tipo de pasajero tarifario: ${passengerFareTypeLabel(fareQuote.passengerFareType)}.`);
          if (fareQuote.tripMultiplier > 1) {
            localNotes.push(`Ida y vuelta variable: tarifa ida ${formatCLP(fareQuote.oneWayFare)} x ${fareQuote.tripMultiplier}.`);
          }

          if (selectedDriverEarning != null) {
            localNotes.push(`Ganancia estimada conductor: ${formatCLP(selectedDriverEarning)}.`);
          }
        }

        const localRide = {
          ...createLocalPassengerRide({
            originText: resolved.origin.text,
            destinationText: resolved.destination.text,
            notes: limitRideNotes(localNotes.join(" ")),
            passengerNote: passengerNote || null,
            estimatedFareClp: selectedFareAmount ?? null,
            rideMode: selectedRoundTripPromotion ? "now" : rideMode,
            tripFareMode: selectedRoundTripPromotion ? "one_way" : effectiveTripFareMode,
            scheduledAt: selectedRoundTripPromotion ? "" : scheduledAt,
            returnScheduledAt: selectedRoundTripPromotion ? "" : returnScheduledAt,
            scheduleKind: selectedRoundTripPromotion ? null : "airport_pickup",
            passengerName: getSessionDisplayName(session.user),
            passengerEmail: getSessionEmail(session.user),
            passengerFareType: effectivePassengerFareType,
            passengerFareLabel: passengerFareTypeLabel(effectivePassengerFareType),
            airportWelcomeOption: rideMode === "scheduled" ? airportWelcomeOption : null,
            airportWelcomeLabel: hasAirportFlowerLei ? AIRPORT_FLOWER_LEI_LABEL : "Solo recogida",
            flowerLeiRequested: hasAirportFlowerLei,
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
          walletBenefitAvailableButNotUsedClp: hasAvailableWalletBenefit && useWalletBenefit === false ? availableWalletBenefitTotalClp : 0,
          tripFareMode: effectiveTripFareMode,
          tripType: effectiveTripFareMode,
          isRoundTrip: effectiveTripFareMode === "round_trip",
          roundTripPromotionBooking: Boolean(selectedRoundTripPromotion),
          roundTripOutboundNow: Boolean(selectedRoundTripPromotion),
          roundTripReturnPickupRequested: Boolean(selectedRoundTripPromotion && returnScheduledAt),
          roundTripReturnPickupAt: selectedRoundTripPromotion ? returnScheduledAt : null,
          airportReservationRequiresCard: isAirportScheduledRide,
          reservationRequiresCard: reservationRequiresCard,
          paymentRequiredProvider: isAirportScheduledRide ? "mercadopago" : null,
          cardCancellationCreditToWallet: false,
          cardCancellationAdminReviewRequired: reservationRequiresCard && String(activePaymentMethod) === "card",
          cardCancellationCreditName: null,
        } as LocalPassengerRideData;

        const localReturnPickupRide = selectedRoundTripPromotion && returnScheduledAt
          ? createRoundTripReturnPickupRide({
              returnOriginText: selectedRoundTripPromotion.destinationName,
              returnOriginAddress: resolved.destination.address,
              returnOriginLat: resolved.destination.lat,
              returnOriginLng: resolved.destination.lng,
              returnDestinationText: resolved.origin.text,
              returnDestinationAddress: resolved.origin.address,
              returnDestinationLat: resolved.origin.lat,
              returnDestinationLng: resolved.origin.lng,
              returnScheduledAt,
              promotionTitle: selectedRoundTripPromotion.title,
              promotionDestinationName: selectedRoundTripPromotion.destinationName,
              relatedOutboundRideId: String(localRide.id ?? ""),
              passengerNote: passengerNote || null,
              passengerName: getSessionDisplayName(session.user),
              passengerEmail: getSessionEmail(session.user),
              passengerFareType: effectivePassengerFareType,
              passengerFareLabel: passengerFareTypeLabel(effectivePassengerFareType),
            })
          : null;

        saveLocalPassengerRides([
          ...(localReturnPickupRide ? [localReturnPickupRide] : []),
          localRide,
          ...readLocalPassengerRides(),
        ]);

        if (pendingPassengerChargeTotalClp > 0) {
          markPassengerPendingChargesAppliedToRide(
            session.user,
            String(localRide.id ?? `local-${Date.now()}`),
          );
        }

        if (localReturnPickupRide) {
          upsertLocalAdminScheduledRide(localReturnPickupRide);
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
          upsertLocalAdminScheduledRide(createLocalAdminScheduledRide({
            originText: resolved.origin.text,
            destinationText: resolved.destination.text,
            notes: limitRideNotes(localNotes.join(" ")),
            passengerNote: passengerNote || null,
            estimatedFareClp: selectedFareAmount ?? null,
            rideMode,
            tripFareMode: effectiveTripFareMode,
            scheduledAt,
            returnScheduledAt,
            scheduleKind: selectedRoundTripPromotion ? "round_trip_promotion" : "airport_pickup",
            passengerName: getSessionDisplayName(session.user),
            passengerEmail: getSessionEmail(session.user),
            passengerFareType: effectivePassengerFareType,
            passengerFareLabel: passengerFareTypeLabel(effectivePassengerFareType),
            airportWelcomeOption: rideMode === "scheduled" ? airportWelcomeOption : null,
            airportWelcomeLabel: hasAirportFlowerLei ? AIRPORT_FLOWER_LEI_LABEL : "Solo recogida",
            flowerLeiRequested: hasAirportFlowerLei,
            airportWelcomeSurchargeClp,
            optionalServicesTotalClp: airportWelcomeSurchargeClp,
            baseFareBeforeExtrasClp: selectedBaseFareAmount,
          }));
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
        setOriginSuggestions([]);
        setDestSuggestions([]);
        setRideMode("now");
        setTripFareMode("one_way");
        setSelectedRoundTripPromotionId(null);
        setPaymentMethod(null);
        setShowPaymentBox(false);
        setVehicleCategory("standard");
        setUseWalletBenefit(null);

        history.push("/passenger/trips");
        return;
      }

      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }

  const canRequest = ((!!originPoint || !!originInput.trim()) &&
    (!!destinationPoint || !!destInput.trim()) &&
    (
      roundTripPromotionReturnOnly
        ? !!returnScheduledAt
        : rideMode === "now" || (!!scheduledAt && (!requireReturnScheduledAt || !!returnScheduledAt))
    ) &&
    !submitting) && paymentMethod !== null;

  const mapOrigin = useMemo(
    () => {
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
    },
    [isAirportScheduledRide, originInput, originPoint],
  );

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
      data-rapago-theme={theme}
    >
      <RapagoSectionHeader
        title="Solicitar Viaje"
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onBack={() => history.replace(ROUTES.PASSENGER.HOME)}
        backLabel="Volver al inicio"
      />

      <IonContent fullscreen style={{ "--background": "transparent" } as CSSProperties}>
        <div className="rp-request-scroll">
          <MapFallback
            origin={mapOrigin}
            destination={mapDestination}
            height={320}
            showRoute
            originDraggable={canChooseOrigin}
            onOriginChange={(payload) => {
              void applyMovedOriginFromMap(payload);
            }}
          />

          <div
            style={{
              padding: "18px 16px 20px",
              borderTop: "1px solid rgba(210,164,58,.18)",
            }}
          >
            <div style={sectionLabelStyle()}>Origen</div>

            <IonItem lines="none" style={inputItemStyle()}>
              <IonIcon icon={locationOutline} slot="start" color="medium" />
              <IonInput
                value={originInput}
                placeholder="¿Dónde te recogemos?"
                onIonFocus={() => {
                  if (!canChooseOrigin) return;
                  if (suppressPickerOpenRef.current) return;
                  setPickerTarget("origin");
                }}
                onIonInput={(event) => {
                  if (!canChooseOrigin) {
                    applyRapaNuiAirportOrigin();
                    return;
                  }

                  setOriginInput(String(event.detail.value ?? ""));
                  setOriginPoint(null);
                }}
                readonly={!canChooseOrigin}
                clearInput={canChooseOrigin}
              />
              {searchingOrigin && <IonSpinner name="dots" slot="end" />}
            </IonItem>

            <SuggestionList
              suggestions={originSuggestions}
              onPick={(suggestion) => void pickOrigin(suggestion)}
            />

            {originPoint?.walkMeters != null && originPoint.walkMeters > 8 && (
              <div
                className="rp-request-note"
                style={{
                  margin: "-6px 0 14px",
                  padding: "10px 12px",
                  fontSize: ".78rem",
                  lineHeight: 1.35,
                }}
              >
                <strong>Punto accesible recomendado:</strong>{" "}
                el conductor te recoge en {originPoint.text}. Camina aprox.{" "}
                {originPoint.walkMeters} m hasta la calle. En el mapa verás tu punto real
                en azul y la recogida accesible como 🚗.
              </div>
            )}

            {!canChooseOrigin ? (
              <div
                style={{
                  margin: "-4px 0 22px",
                  color: "var(--rp-accent)",
                  fontSize: ".78rem",
                  fontWeight: 900,
                  lineHeight: 1.35,
                }}
              >
                ✈️ Origen fijo: Aeropuerto Rapa Nui. El pasajero elige el destino.
              </div>
            ) : (
              <>
                <IonButton
                  fill="clear"
                  size="small"
                  onClick={() => {
                    if (suppressPickerOpenRef.current) return;
                    setPickerTarget("origin");
                  }}
                  style={
                    {
                      margin: "-4px 0 10px",
                      "--color": "var(--rp-accent)",
                      fontWeight: 900,
                      letterSpacing: ".02em",
                    } as CSSProperties
                  }
                >
                  <IonIcon icon={navigateOutline} slot="start" />
                  Elegir punto en el mapa
                </IonButton>

                <IonButton
                  fill="clear"
                  size="small"
                  onClick={handleUseCurrentLocation}
                  disabled={locating}
                  style={
                    {
                      margin: "-4px 0 22px",
                      "--color": "var(--rp-accent)",
                      fontWeight: 900,
                      letterSpacing: ".02em",
                    } as CSSProperties
                  }
                >
                  {locating ? (
                    <IonSpinner name="dots" />
                  ) : (
                    <>
                      <IonIcon icon={locateOutline} slot="start" />
                      Usar mi ubicación actual
                    </>
                  )}
                </IonButton>
              </>
            )}

            <div style={sectionLabelStyle()}>Destino</div>

            <IonItem lines="none" style={inputItemStyle({ marginBottom: "14px" })}>
              <IonIcon icon={flagOutline} slot="start" color="medium" />
              <IonInput
                value={destInput}
                placeholder="¿A dónde vas?"
                onIonFocus={() => {
                  if (selectedRoundTripPromotion) return;
                  if (suppressPickerOpenRef.current) return;
                  setPickerTarget("destination");
                }}
                onIonInput={(event) => {
                  if (selectedRoundTripPromotion) return;
                  setDestInput(String(event.detail.value ?? ""));
                  setDestinationPoint(null);
                }}
                readonly={Boolean(selectedRoundTripPromotion)}
                clearInput={!selectedRoundTripPromotion}
              />
              {searchingDest && <IonSpinner name="dots" slot="end" />}
            </IonItem>

            <SuggestionList
              suggestions={destSuggestions}
              onPick={(suggestion) => void pickDestination(suggestion)}
            />

            <IonButton
              fill="clear"
              size="small"
              onClick={() => {
                if (selectedRoundTripPromotion) return;
                if (suppressPickerOpenRef.current) return;
                setPickerTarget("destination");
              }}
              disabled={Boolean(selectedRoundTripPromotion)}
              style={
                {
                  margin: "-4px 0 22px",
                  "--color": "#EF4444",
                  fontWeight: 900,
                  letterSpacing: ".02em",
                } as CSSProperties
              }
            >
              <IonIcon icon={flagOutline} slot="start" />
              {selectedRoundTripPromotion
                ? `Destino fijo: ${selectedRoundTripPromotion.destinationName}`
                : rideMode === "scheduled"
                  ? "Elegir destino desde el aeropuerto"
                  : "Elegir destino en el mapa"}
            </IonButton>

            <div style={sectionLabelStyle()}>Cuándo viajas</div>

            <div
              role="tablist"
              aria-label="Cuándo viajas"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: "8px",
                marginBottom: "18px",
              }}
            >
              <button
                type="button"
                role="tab"
                aria-selected={rideMode === "now"}
                onClick={() => {
                  setRideMode("now");
                  clearRoundTripPromotion();
                  setScheduledAt("");
                  setReturnScheduledAt("");
                  setAirportWelcomeOption("none");
                  setSubmitError(null);
                }}
                style={{
                  minHeight: "48px",
                  padding: "12px",
                  borderRadius: "14px",
                  background:
                    rideMode === "now"
                      ? "linear-gradient(135deg,#D2A43A 0%,#F8D879 100%)"
                      : "linear-gradient(180deg,#FFFDF7 0%,#F2E5C9 100%)",
                  color: "#111111",
                  border:
                    rideMode === "now"
                      ? "2px solid #B98517"
                      : "1.5px solid rgba(138,100,28,.42)",
                  boxShadow:
                    rideMode === "now"
                      ? "0 10px 22px rgba(210,164,58,.28)"
                      : "0 6px 14px rgba(17,24,39,.08)",
                  fontWeight: 950,
                  letterSpacing: ".03em",
                  textShadow: "none",
                  opacity: 1,
                }}
              >
                AHORA
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={rideMode === "scheduled"}
                onClick={() => {
                  setRideMode("scheduled");
                  clearRoundTripPromotion();
                  setTripFareMode("one_way");
                  setPaymentMethod("card");
                  setShowPaymentBox(false);
                  applyRapaNuiAirportOrigin();
                  setDestinationPoint(null);
                  setDestInput("");
                  setDestSuggestions([]);
                  setSubmitError(null);
                }}
                style={{
                  minHeight: "48px",
                  padding: "12px",
                  borderRadius: "14px",
                  background:
                    rideMode === "scheduled"
                      ? "linear-gradient(135deg,#D2A43A 0%,#F8D879 100%)"
                      : "linear-gradient(180deg,#FFFDF7 0%,#F2E5C9 100%)",
                  color: "#111111",
                  border:
                    rideMode === "scheduled"
                      ? "2px solid #B98517"
                      : "1.5px solid rgba(138,100,28,.42)",
                  boxShadow:
                    rideMode === "scheduled"
                      ? "0 10px 22px rgba(210,164,58,.28)"
                      : "0 6px 14px rgba(17,24,39,.08)",
                  fontWeight: 950,
                  letterSpacing: ".03em",
                  textShadow: "none",
                  opacity: 1,
                }}
              >
                AGENDAR
              </button>
            </div>

            <div style={sectionLabelStyle()}>Tipo de viaje opcional</div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: "8px",
                marginBottom: "18px",
              }}
            >
              <button
                type="button"
                aria-pressed={!selectedRoundTripPromotion}
                onClick={() => {
                  clearRoundTripPromotion();
                }}
                style={{
                  border: !selectedRoundTripPromotion
                    ? "2.5px solid #F8D879"
                    : "1.5px solid rgba(210,164,58,.28)",
                  borderRadius: "16px",
                  minHeight: "72px",
                  padding: "10px 12px",
                  background: !selectedRoundTripPromotion
                    ? "linear-gradient(135deg,#D2A43A 0%,#F8D879 100%)"
                    : "linear-gradient(135deg,#242424 0%,#171717 100%)",
                  color: !selectedRoundTripPromotion ? "#111111" : "#F6F2EC",
                  boxShadow: !selectedRoundTripPromotion
                    ? "0 12px 24px rgba(210,164,58,.28)"
                    : "0 8px 16px rgba(0,0,0,.18)",
                  fontWeight: 950,
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "1.25rem", lineHeight: 1 }}>➡️</div>
                <div style={{ marginTop: 6, fontSize: ".86rem", lineHeight: 1.15 }}>
                  Solo ida
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontSize: ".68rem",
                    lineHeight: 1.18,
                    opacity: !selectedRoundTripPromotion ? 0.82 : 0.62,
                    fontWeight: 800,
                  }}
                >
                  Viaje normal. Las promociones con regreso están abajo.
                </div>
              </button>
            </div>

            <div style={sectionLabelStyle()}>Vehículo</div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: "8px",
                marginBottom: "18px",
              }}
            >
              {(["standard", "xl", "luggage"] as VehicleCategory[]).map((category) => {
                const active = vehicleCategory === category;

                return (
                  <button
                    key={category}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setVehicleCategory(category);
                      setSubmitError(null);
                    }}
                    style={{
                      border: active
                        ? "2.5px solid #F8D879"
                        : "1.5px solid rgba(210,164,58,.28)",
                      borderRadius: "16px",
                      minHeight: "86px",
                      padding: "10px 8px",
                      background: active
                        ? "linear-gradient(135deg,#D2A43A 0%,#F8D879 100%)"
                        : "linear-gradient(135deg,#242424 0%,#171717 100%)",
                      color: active ? "#111111" : "#F6F2EC",
                      boxShadow: active
                        ? "0 12px 24px rgba(210,164,58,.28)"
                        : "0 8px 16px rgba(0,0,0,.18)",
                      fontWeight: 950,
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "1.25rem", lineHeight: 1 }}>
                      {category === "standard" ? "🚗" : category === "xl" ? "🚙" : "🧳"}
                    </div>
                    <div style={{ marginTop: 6, fontSize: ".76rem", lineHeight: 1.15 }}>
                      {vehicleCategoryTitle(category)}
                    </div>
                    <div
                      style={{
                        marginTop: 4,
                        fontSize: ".64rem",
                        lineHeight: 1.18,
                        opacity: active ? 0.82 : 0.62,
                        fontWeight: 800,
                      }}
                    >
                      {vehicleCategoryDescription(category)}
                    </div>
                  </button>
                );
              })}
            </div>

            {(rideMode === "now" || selectedRoundTripPromotion) && (
              <>
            <div style={sectionLabelStyle()}>Promociones con regreso</div>

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
              }}
            >
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
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      color: "#F8D879",
                      fontSize: ".72rem",
                      fontWeight: 950,
                      letterSpacing: ".06em",
                      textTransform: "uppercase",
                    }}
                  >
                    Ofertas destacadas
                  </div>
                  <div
                    style={{
                      color: "#F6F2EC",
                      fontSize: "1.08rem",
                      fontWeight: 950,
                      lineHeight: 1.1,
                      marginTop: 4,
                    }}
                  >
                    Ida y vuelta con precio cerrado
                  </div>
                  <div
                    style={{
                      color: "rgba(246,242,236,.70)",
                      fontSize: ".73rem",
                      lineHeight: 1.35,
                      fontWeight: 800,
                      marginTop: 6,
                    }}
                  >
                    Promociones disponibles para {passengerFareTypeLabel(passengerFareType)}. El destino se completa solo y tú eliges el punto de recogida.
                  </div>
                </div>

                <span
                  style={{
                    flex: "0 0 auto",
                    borderRadius: 999,
                    padding: "6px 10px",
                    background: "linear-gradient(135deg,#F8D879 0%,#D2A43A 100%)",
                    color: "#111111",
                    fontSize: ".66rem",
                    fontWeight: 950,
                    boxShadow: "0 8px 18px rgba(210,164,58,.28)",
                    whiteSpace: "nowrap",
                  }}
                >
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
                  }}
                >
                  Por ahora no hay promociones con regreso activo para tu perfil.
                </div>
              ) : (
                <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr", gap: 11 }}>
                  {roundTripPromotions.map((promotion) => {
                    const active = selectedRoundTripPromotion?.id === promotion.id;
                    const destinationKey = String(promotion.destinationName ?? "").toLowerCase();
                    const promoIcon = destinationKey.includes("anakena")
                      ? "🏝️"
                      : destinationKey.includes("terevaka")
                        ? "⛰️"
                        : "🚗";
                    const promoTitle = destinationKey.includes("anakena")
                      ? "Escapada a Anakena"
                      : destinationKey.includes("terevaka")
                        ? "Subida a Terevaka"
                        : promotion.destinationName;
                    const priceChanged = Number(promotion.baseFareClp) !== Number(promotion.fareClp);

                    return (
                      <button
                        key={promotion.id}
                        type="button"
                        onClick={() => setPendingRoundTripPromotion(promotion)}
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
                        }}
                      >
                        <div
                          style={{
                            position: "absolute",
                            right: -18,
                            bottom: -24,
                            fontSize: "4.8rem",
                            opacity: active ? .16 : .10,
                            transform: "rotate(-8deg)",
                            pointerEvents: "none",
                          }}
                        >
                          {promoIcon}
                        </div>

                        <div
                          style={{
                            position: "relative",
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 12,
                            alignItems: "flex-start",
                          }}
                        >
                          <div style={{ display: "flex", gap: 10, minWidth: 0 }}>
                            <div
                              style={{
                                width: 42,
                                height: 42,
                                borderRadius: 16,
                                background: active ? "rgba(17,17,17,.12)" : "rgba(248,216,121,.12)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "1.35rem",
                                flex: "0 0 auto",
                              }}
                            >
                              {promoIcon}
                            </div>

                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: "1.02rem", lineHeight: 1.05, fontWeight: 950 }}>
                                {promoTitle}
                              </div>
                              <div
                                style={{
                                  marginTop: 5,
                                  fontSize: ".72rem",
                                  lineHeight: 1.25,
                                  fontWeight: 850,
                                  opacity: active ? .82 : .70,
                                }}
                              >
                                {promotion.destinationName} · Ida y vuelta
                              </div>
                              <div
                                style={{
                                  marginTop: 4,
                                  fontSize: ".68rem",
                                  lineHeight: 1.2,
                                  fontWeight: 850,
                                  opacity: active ? .76 : .58,
                                }}
                              >
                                Especial para {promotion.passengerLabel}
                              </div>
                            </div>
                          </div>

                          <div
                            style={{
                              textAlign: "right",
                              flex: "0 0 auto",
                              padding: "4px 0 0",
                            }}
                          >
                            <div style={{ fontSize: "1.15rem", fontWeight: 950, lineHeight: 1 }}>
                              {formatCLP(promotion.fareClp)}
                            </div>
                            <div style={{ fontSize: ".70rem", fontWeight: 900, opacity: .78, marginTop: 3 }}>
                              {promotion.usdLabel}
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
                          }}
                        >
                          <span
                            style={{
                              borderRadius: 999,
                              padding: "5px 8px",
                              fontSize: ".63rem",
                              background: active ? "rgba(17,17,17,.14)" : "rgba(34,197,94,.14)",
                              color: active ? "#111111" : "#86efac",
                              fontWeight: 950,
                            }}
                          >
                            Destino automático
                          </span>
                          <span
                            style={{
                              borderRadius: 999,
                              padding: "5px 8px",
                              fontSize: ".63rem",
                              background: active ? "rgba(17,17,17,.12)" : "rgba(248,216,121,.12)",
                              color: active ? "#111111" : "#F8D879",
                              fontWeight: 950,
                            }}
                          >
                            Recogida a elección
                          </span>
                          {priceChanged && (
                            <span
                              style={{
                                borderRadius: 999,
                                padding: "5px 8px",
                                fontSize: ".63rem",
                                background: active ? "rgba(17,17,17,.10)" : "rgba(255,255,255,.06)",
                                color: active ? "#111111" : "rgba(246,242,236,.75)",
                                fontWeight: 950,
                              }}
                            >
                              Precio final aplicado
                            </span>
                          )}
                        </div>

                        <div
                          style={{
                            position: "relative",
                            marginTop: 12,
                            borderTop: active ? "1px solid rgba(17,17,17,.16)" : "1px solid rgba(255,255,255,.08)",
                            paddingTop: 10,
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 10,
                            alignItems: "center",
                            fontSize: ".72rem",
                            fontWeight: 950,
                            opacity: active ? .86 : .72,
                          }}
                        >
                          <span>
                            {active ? "Promoción seleccionada" : "Toca para elegir esta promo"}
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
                      "--color": "#F8D879",
                      marginTop: "12px",
                      fontWeight: 950,
                    } as CSSProperties
                  }
                >
                  Quitar promoción y volver a solo ida
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
                    ? "Agenda tu recogida de regreso"
                    : "Agenda tu recogida para aeropuerto"}
                </div>

                {!selectedRoundTripPromotion && (
                  <>
                    <IonItem
                      lines="none"
                      style={
                        {
                          "--background": "#ffffff",
                          "--border-radius": "14px",
                          "--padding-start": "14px",
                          "--inner-padding-end": "12px",
                          "--min-height": "50px",
                          "--highlight-color-focused": "var(--rp-gold)",
                          border: "1.5px solid rgba(210,164,58,.30)",
                          marginBottom: "10px",
                          overflow: "hidden",
                        } as CSSProperties
                      }
                    >
                      <IonIcon icon={calendarOutline} slot="end" style={{ color: "var(--rp-icon-fg)" }} />
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
                      }}
                    >
                      Al agendar, el origen queda automático en Aeropuerto Internacional Mataveri de Rapa Nui. El pasajero elige el destino final. La reserva queda congelada para conductores y se libera {SCHEDULE_ACTIVATION_MINUTES} min antes.
                      <br />
                      <strong>Pago obligatorio con tarjeta:</strong> todas las reservas son con tarjeta. Si cancelas dentro de los últimos 30 minutos, se descuenta 30% con tope $3.000. El saldo restante se devuelve al medio de pago original; no se convierte en Beneficios.
                    </IonNote>
                  </>
                )}

                {selectedRoundTripPromotion && (
                  <IonNote
                    style={{
                      fontSize: "0.72rem",
                      display: "block",
                      marginBottom: "14px",
                      color: "var(--rp-label)",
                      lineHeight: 1.45,
                    }}
                  >
                    El viaje de ida sale ahora. La hora que elijas quedará como recogida de regreso para que admin la gestione.
                  </IonNote>
                )}

                {requireReturnScheduledAt && (
                  <>
                    <div
                      style={{
                        color: "var(--rp-label)",
                        fontSize: "0.72rem",
                        fontWeight: 900,
                        marginBottom: "8px",
                        textTransform: "uppercase",
                        letterSpacing: ".04em",
                      }}
                    >
                      Hora de regreso
                    </div>

                    <IonItem
                      lines="none"
                      style={
                        {
                          "--background": "#ffffff",
                          "--border-radius": "14px",
                          "--padding-start": "14px",
                          "--inner-padding-end": "12px",
                          "--min-height": "50px",
                          "--highlight-color-focused": "var(--rp-gold)",
                          border: "1.5px solid rgba(210,164,58,.30)",
                          marginBottom: "14px",
                          overflow: "hidden",
                        } as CSSProperties
                      }
                    >
                      <IonIcon icon={calendarOutline} slot="end" style={{ color: "var(--rp-icon-fg)" }} />
                      <IonInput
                        type="datetime-local"
                        value={returnScheduledAt}
                        min={selectedRoundTripPromotion ? scheduleMinInput : (scheduledAt || scheduleMinInput)}
                        max={scheduleMaxInput}
                        onIonInput={(event) =>
                          setReturnScheduledAt(String(event.detail.value ?? ""))
                        }
                      />
                    </IonItem>
                  </>
                )}

                {!selectedRoundTripPromotion && (
                  <>
                <div
                  style={{
                    color: "var(--rp-label)",
                    fontSize: "0.72rem",
                    fontWeight: 900,
                    marginBottom: "8px",
                    textTransform: "uppercase",
                    letterSpacing: ".04em",
                  }}
                >
                  Número de vuelo opcional
                </div>

                <IonItem
                  lines="none"
                  style={
                    {
                      "--background": "#ffffff",
                      "--border-radius": "14px",
                      "--padding-start": "14px",
                      "--inner-padding-end": "12px",
                      "--min-height": "50px",
                      "--highlight-color-focused": "var(--rp-gold)",
                      border: "1.5px solid rgba(210,164,58,.30)",
                      marginBottom: "12px",
                      overflow: "hidden",
                    } as CSSProperties
                  }
                >
                  <IonIcon icon={timeOutline} slot="start" style={{ color: "var(--rp-icon-fg)" }} />
                  <IonInput
                    value={flightNumber}
                    placeholder="Ej: LA800"
                    onIonInput={(event) =>
                      setFlightNumber(String(event.detail.value ?? ""))
                    }
                  />
                </IonItem>


                <div
                  style={{
                    color: "var(--rp-label)",
                    fontSize: "0.72rem",
                    fontWeight: 900,
                    marginBottom: "8px",
                    textTransform: "uppercase",
                    letterSpacing: ".04em",
                  }}
                >
                  Recibimiento opcional
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: "8px",
                    marginBottom: "12px",
                  }}
                >
                  {([
                    {
                      id: "none" as AirportWelcomeOption,
                      emoji: "🚕",
                      title: "Solo recogida",
                      text: "El conductor te espera y te lleva directo.",
                    },
                    {
                      id: "flower_lei" as AirportWelcomeOption,
                      emoji: "🌺",
                      title: "Collar de flores",
                      text: `Bienvenida Rapa Nui al llegar · +${formatCLP(AIRPORT_FLOWER_LEI_SURCHARGE_CLP)}`,
                    },
                  ]).map((option) => {
                    const active = airportWelcomeOption === option.id;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setAirportWelcomeOption(option.id)}
                        style={{
                          border: active
                            ? "2px solid #D2A43A"
                            : "1px solid rgba(210,164,58,.32)",
                          borderRadius: "14px",
                          minHeight: "82px",
                          padding: "10px 8px",
                          background: active
                            ? "linear-gradient(135deg,#D2A43A 0%,#F8D879 100%)"
                            : "#ffffff",
                          color: "#111111",
                          boxShadow: active
                            ? "0 10px 22px rgba(210,164,58,.28)"
                            : "0 6px 14px rgba(0,0,0,.08)",
                          textAlign: "left",
                          fontWeight: 950,
                        }}
                      >
                        <div style={{ fontSize: "1.35rem", lineHeight: 1 }}>
                          {option.emoji}
                        </div>
                        <div style={{ marginTop: 5, fontSize: ".78rem", lineHeight: 1.15 }}>
                          {option.title}
                        </div>
                        <div
                          style={{
                            marginTop: 4,
                            color: "rgba(17,17,17,.62)",
                            fontSize: ".64rem",
                            lineHeight: 1.22,
                            fontWeight: 850,
                          }}
                        >
                          {option.text}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {airportWelcomeOption === "flower_lei" && (
                  <div
                    style={{
                      background: "linear-gradient(135deg,rgba(255,246,214,.98),rgba(255,232,166,.98))",
                      border: "1px solid rgba(210,164,58,.42)",
                      color: "#4F350D",
                      borderRadius: "14px",
                      padding: "10px 12px",
                      fontSize: "0.74rem",
                      lineHeight: 1.35,
                      fontWeight: 900,
                      marginBottom: "12px",
                      boxShadow: "0 10px 22px rgba(210,164,58,.14)",
                    }}
                  >
                    🌺 <strong>Collar de flores agregado.</strong> Sumamos {formatCLP(AIRPORT_FLOWER_LEI_SURCHARGE_CLP)} al total para preparar tu bienvenida Rapa Nui al llegar.
                  </div>
                )}
                  </>
                )}

                <div
                  style={{
                    background: "linear-gradient(135deg,#fff7d6 0%,#ffe39a 100%)",
                    color: "#111",
                    borderRadius: "14px",
                    padding: "13px 14px",
                    fontSize: "0.8rem",
                    lineHeight: 1.45,
                    border: "1px solid rgba(210,164,58,.36)",
                    boxShadow: "0 12px 24px rgba(210,164,58,.16)",
                  }}
                >
                  {selectedRoundTripPromotion ? (
                    <>
                      🔁 <strong>Ida + agendamiento de recogida.</strong> Ida ahora y recogida de regreso agendada.
                    </>
                  ) : (
                    <>
                      ✈️ <strong>Recogida programada desde Mataveri.</strong> Tú eliges el destino, la hora y el recibimiento. Prepararemos tu viaje y te avisaremos cuando tu RapaGo esté listo para ir por ti.
                    </>
                  )}
                </div>
              </div>
            )}

            <div style={sectionLabelStyle()}>Notas opcional</div>

            <IonItem
              lines="none"
              style={inputItemStyle({ marginBottom: "18px" })}
            >
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

            <div
              style={{
                margin: "12px 0 20px",
                borderRadius: "28px",
                border: "1.5px solid rgba(248,216,121,.46)",
                background: "linear-gradient(145deg,#101010 0%,#1E1608 58%,#D2A43A 155%)",
                boxShadow: "0 22px 48px rgba(0,0,0,.32), 0 0 0 1px rgba(255,255,255,.04) inset",
                overflow: "hidden",
                color: "#F6F2EC",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  right: -46,
                  top: -52,
                  width: 160,
                  height: 160,
                  borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(248,216,121,.42), rgba(248,216,121,0) 68%)",
                  pointerEvents: "none",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: -42,
                  bottom: -56,
                  width: 140,
                  height: 140,
                  borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(210,164,58,.28), rgba(210,164,58,0) 70%)",
                  pointerEvents: "none",
                }}
              />

              <div style={{ position: "relative", padding: "18px 16px 16px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 14,
                    alignItems: "flex-start",
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        color: "#F8D879",
                        fontSize: ".7rem",
                        fontWeight: 950,
                        letterSpacing: ".08em",
                        textTransform: "uppercase",
                      }}
                    >
                      {selectedRoundTripPromotion ? "Oferta especial RAPA GO" : "Tu viaje RAPA GO"}
                    </div>
                    <div
                      style={{
                        marginTop: 5,
                        color: "#FFFFFF",
                        fontSize: "1.22rem",
                        lineHeight: 1.05,
                        fontWeight: 950,
                      }}
                    >
                      {selectedRoundTripPromotion
                        ? `${selectedRoundTripPromotion.destinationName} · regreso agendado`
                        : paymentMethod === "cash"
                          ? "Listo para solicitar"
                          : "Elige tu forma de pago"}
                    </div>
                    <div
                      style={{
                        marginTop: 7,
                        color: "rgba(246,242,236,.76)",
                        fontSize: ".76rem",
                        lineHeight: 1.35,
                        fontWeight: 800,
                      }}
                    >
                      {selectedRoundTripPromotion
                        ? "Precio cerrado, destino cargado automáticamente y recogida a elección."
                        : fareQuote
                          ? "Precio estimado transparente para moverte por Rapa Nui."
                          : "El precio aparecerá cuando selecciones origen y destino."}
                    </div>
                  </div>

                  <div
                    style={{
                      flex: "0 0 auto",
                      minWidth: 118,
                      borderRadius: "22px",
                      padding: "11px 12px",
                      background: "linear-gradient(180deg,#FFF3B0 0%,#D2A43A 100%)",
                      color: "#111111",
                      textAlign: "right",
                      boxShadow: "0 16px 30px rgba(210,164,58,.32)",
                    }}
                  >
                    <div style={{ fontSize: ".62rem", fontWeight: 950, letterSpacing: ".06em", textTransform: "uppercase", color: "#6E4B12" }}>
                      Total
                    </div>
                    <div style={{ marginTop: 2, fontSize: "1.02rem", lineHeight: 1.05, fontWeight: 950 }}>
                      {cashPaymentLabel}
                    </div>
                    <div style={{ marginTop: 2, fontSize: ".72rem", fontWeight: 950, color: "#4F350D" }}>
                      {cashPaymentUsdLabel}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 7,
                    marginTop: 14,
                  }}
                >
                  <span style={{ borderRadius: 999, padding: "6px 9px", background: "rgba(248,216,121,.16)", border: "1px solid rgba(248,216,121,.24)", color: "#F8D879", fontSize: ".66rem", fontWeight: 950 }}>
                    {selectedRoundTripPromotion ? "Precio cerrado" : "Precio claro"}
                  </span>
                  <span style={{ borderRadius: 999, padding: "6px 9px", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.10)", color: "#F6F2EC", fontSize: ".66rem", fontWeight: 900 }}>
                    {fareQuote ? `${fareQuote.km.toFixed(1)} km · ${fareQuote.minutes} min` : "Calculando ruta"}
                  </span>
                  <span style={{ borderRadius: 999, padding: "6px 9px", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.10)", color: "#F6F2EC", fontSize: ".66rem", fontWeight: 900 }}>
                    {vehicleCategoryTitle(vehicleCategory)}
                  </span>
                  {hasAirportFlowerLei && (
                    <span style={{ borderRadius: 999, padding: "6px 9px", background: "rgba(248,216,121,.16)", border: "1px solid rgba(248,216,121,.28)", color: "#F8D879", fontSize: ".66rem", fontWeight: 950 }}>
                      🌺 Collar +{formatCLP(AIRPORT_FLOWER_LEI_SURCHARGE_CLP)}
                    </span>
                  )}
                </div>

                <div
                  style={{
                    marginTop: 14,
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: 8,
                  }}
                >
                  <div style={{ borderRadius: 18, padding: "10px 9px", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.08)" }}>
                    <div style={{ color: "rgba(246,242,236,.58)", fontSize: ".62rem", fontWeight: 950, textTransform: "uppercase" }}>
                      Pasajero
                    </div>
                    <div style={{ marginTop: 4, color: "#FFFFFF", fontSize: ".72rem", fontWeight: 950, lineHeight: 1.15 }}>
                      {passengerFareTypeLabel(effectivePassengerFareType)}
                    </div>
                  </div>
                  <div style={{ borderRadius: 18, padding: "10px 9px", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.08)" }}>
                    <div style={{ color: "rgba(246,242,236,.58)", fontSize: ".62rem", fontWeight: 950, textTransform: "uppercase" }}>
                      Viaje
                    </div>
                    <div style={{ marginTop: 4, color: "#FFFFFF", fontSize: ".72rem", fontWeight: 950, lineHeight: 1.15 }}>
                      {selectedRoundTripPromotion ? "Promo con regreso" : tripFareModeLabel(tripFareMode)}
                    </div>
                  </div>
                  <div style={{ borderRadius: 18, padding: "10px 9px", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.08)" }}>
                    <div style={{ color: "rgba(246,242,236,.58)", fontSize: ".62rem", fontWeight: 950, textTransform: "uppercase" }}>
                      Pago
                    </div>
                    <div style={{ marginTop: 4, color: "#FFFFFF", fontSize: ".72rem", fontWeight: 950, lineHeight: 1.15 }}>
                      {paymentMethod === "cash" ? "Efectivo listo" : paymentMethod === "card" ? "Tarjeta lista" : "Pendiente"}
                    </div>
                  </div>
                </div>

                {selectedRoundTripPromotion && returnScheduledAt ? (
                  <div
                    style={{
                      marginTop: 12,
                      borderRadius: 18,
                      padding: "10px 12px",
                      background: "rgba(248,216,121,.12)",
                      border: "1px solid rgba(248,216,121,.20)",
                      color: "#F8D879",
                      fontSize: ".73rem",
                      lineHeight: 1.35,
                      fontWeight: 900,
                    }}
                  >
                    📅 Regreso agendado para {formatScheduleDateTime(returnScheduledAt)}
                  </div>
                ) : rideMode === "scheduled" && scheduledAt ? (
                  <div
                    style={{
                      marginTop: 12,
                      borderRadius: 18,
                      padding: "10px 12px",
                      background: "rgba(248,216,121,.12)",
                      border: "1px solid rgba(248,216,121,.20)",
                      color: "#F8D879",
                      fontSize: ".73rem",
                      lineHeight: 1.35,
                      fontWeight: 900,
                    }}
                  >
                    📅 Agendado para {formatScheduleDateTime(scheduledAt)}{requireReturnScheduledAt && returnScheduledAt ? ` · regreso ${formatScheduleDateTime(returnScheduledAt)}` : ""}
                  </div>
                ) : null}

                {pendingPassengerChargeTotalClp > 0 && (
                  <div
                    style={{
                      marginTop: 12,
                      borderRadius: 18,
                      padding: "11px 12px",
                      background: "rgba(255,196,9,.16)",
                      border: "1px solid rgba(255,196,9,.34)",
                      color: "#F8D879",
                      fontSize: ".75rem",
                      lineHeight: 1.35,
                      fontWeight: 900,
                    }}
                  >
                    ⚠️ Cargos aprobados que se sumarán a este viaje: <strong>{formatCLP(pendingPassengerChargeTotalClp)}</strong>.
                    {pendingCancellationChargeTotalClp > 0 && (
                      <>
                        <br />Cancelación desde el minuto 3: <strong>{formatCLP(pendingCancellationChargeTotalClp)}</strong>.
                      </>
                    )}
                    {pendingNoShowChargeTotalClp > 0 && (
                      <>
                        <br />No Show aprobado: <strong>{formatCLP(pendingNoShowChargeTotalClp)}</strong>.
                      </>
                    )}
                    <br />Se aplican exclusivamente a esta cuenta y quedarán asociados a este nuevo viaje.
                  </div>
                )}

                {fareQuote && (
                  <div
                    style={{
                      marginTop: 13,
                      borderRadius: "20px",
                      padding: "12px",
                      background: "rgba(255,255,255,.96)",
                      color: "#111111",
                      boxShadow: "0 10px 24px rgba(0,0,0,.16)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: "#7A5417", fontSize: ".68rem", fontWeight: 950, letterSpacing: ".06em", textTransform: "uppercase" }}>
                          Resumen de tarifa
                        </div>
                        <div style={{ marginTop: 4, fontSize: ".86rem", lineHeight: 1.28, fontWeight: 950 }}>
                          {selectedRoundTripPromotion
                            ? `${selectedRoundTripPromotion.destinationName} · ida ahora + regreso agendado`
                            : fareQuote.calculationType === "fixed"
                              ? "Destino con tarifa fija"
                              : fareQuote.ruralKm > 0
                                ? `${fareQuote.urbanKm.toFixed(1)} km urbanos + ${fareQuote.ruralKm.toFixed(1)} km rurales`
                                : `${fareQuote.urbanKm.toFixed(1)} km urbanos`}
                        </div>
                        <div style={{ marginTop: 5, color: "rgba(17,17,17,.64)", fontSize: ".72rem", lineHeight: 1.35, fontWeight: 800 }}>
                          {selectedRoundTripPromotion
                            ? "Promoción activa para tu perfil. Solo elige dónde pasamos a buscarte."
                            : fareQuote.ruralKm > 0
                              ? "El sistema combina tramo urbano y rural según la ruta seleccionada."
                              : "Tarifa calculada con las reglas activas de RAPA GO."}
                        </div>
                      </div>
                      <div style={{ flex: "0 0 auto", textAlign: "right" }}>
                        <div style={{ color: "#111111", fontSize: ".94rem", fontWeight: 950 }}>
                          {cashPaymentLabel}
                        </div>
                        <div style={{ color: "#7A5417", fontSize: ".72rem", fontWeight: 950 }}>
                          {cashPaymentUsdLabel}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <IonButton
                  expand="block"
                  onClick={handleOpenPaymentBox}
                  style={
                    {
                      marginTop: "14px",
                      "--background": paymentMethod === "cash"
                        ? "linear-gradient(135deg,#F8D879 0%,#D2A43A 100%)"
                        : "linear-gradient(135deg,#FFFFFF 0%,#F8D879 100%)",
                      "--background-activated": "#D2A43A",
                      "--color": "#111111",
                      "--border-radius": "18px",
                      height: "48px",
                      fontWeight: 950,
                      letterSpacing: ".02em",
                      boxShadow: "0 16px 30px rgba(210,164,58,.26)",
                    } as CSSProperties
                  }
                >
                  {paymentMethod === "cash" ? "Efectivo seleccionado · continuar" : paymentMethod === "card" ? "Tarjeta seleccionada · Mercado Pago" : "Elegir forma de pago"}
                </IonButton>
              </div>

              {showPaymentBox && (
                <div
                  style={{
                    margin: "0 12px 14px",
                    padding: "14px",
                    borderRadius: "22px",
                    background: "linear-gradient(180deg,#FFFDF7 0%,#F7E7B6 100%)",
                    border: "1.5px solid rgba(248,216,121,.54)",
                    color: "#111111",
                    boxShadow: "0 18px 35px rgba(0,0,0,.22)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                    <div>
                      <div style={{ color: "#7A5417", fontSize: ".7rem", fontWeight: 950, letterSpacing: ".06em", textTransform: "uppercase" }}>
                        Pago seguro
                      </div>
                      <div style={{ marginTop: 3, fontWeight: 950, fontSize: "1.08rem", lineHeight: 1.05 }}>
                        ¿Cómo quieres pagar?
                      </div>
                      <div style={{ marginTop: 6, color: "rgba(17,17,17,.66)", fontSize: ".74rem", lineHeight: 1.35, fontWeight: 800 }}>
                        {reservationRequiresCard ? "Todas las reservas se pagan obligatoriamente con tarjeta. Si cancelas dentro de los últimos 30 minutos, se descuenta 30% con tope $3.000. El saldo restante se devuelve al medio de pago original y no se convierte en Beneficios." : "Elige efectivo al conductor o paga con tarjeta mediante Mercado Pago Checkout Pro."}
                      </div>
                    </div>
                    <span style={{ borderRadius: 999, padding: "6px 9px", background: "#fff7e8", color: "#9A6A10", fontSize: ".66rem", fontWeight: 950, whiteSpace: "nowrap" }}>
                      Mercado Pago activo
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10, marginTop: 13 }}>
                    <button
                      type="button"
                      onClick={() => handleSelectPayment("cash")}
                      style={{
                        border: paymentMethod === "cash" ? "3px solid #111111" : "2px solid rgba(17,17,17,.10)",
                        borderRadius: "20px",
                        padding: "14px 13px",
                        minHeight: "92px",
                        background: "linear-gradient(135deg,#21C55D 0%,#F8D879 42%,#D2A43A 100%)",
                        color: "#111111",
                        boxShadow: paymentMethod === "cash" ? "0 16px 30px rgba(34,197,94,.26)" : "0 10px 22px rgba(0,0,0,.10)",
                        transform: paymentMethod === "cash" ? "scale(1.015)" : "scale(1)",
                        transition: "all .18s ease",
                        fontWeight: 950,
                        textAlign: "left",
                        width: "100%",
                        opacity: reservationRequiresCard ? .48 : 1,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                        <div>
                          <div style={{ fontSize: "1.35rem", lineHeight: 1 }}>💵</div>
                          <div style={{ marginTop: 5, fontSize: ".94rem" }}>{reservationRequiresCard ? "Efectivo no disponible" : "Efectivo al conductor"}</div>
                          <div style={{ marginTop: 3, fontSize: ".72rem", fontWeight: 850, opacity: .78 }}>
                            {reservationRequiresCard ? "Reservas: solo tarjeta" : "Confirmación inmediata"}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: "1.04rem", lineHeight: 1.05, fontWeight: 950 }}>
                            {cashPaymentLabel}
                          </div>
                          <div style={{ marginTop: 2, fontSize: ".74rem", fontWeight: 950, color: "#4F350D" }}>
                            {cashPaymentUsdLabel}
                          </div>
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectPayment("card")}
                      style={{
                        border: paymentMethod === "card" ? "3px solid #111111" : "2px solid rgba(17,17,17,.12)",
                        borderRadius: "20px",
                        padding: "14px 13px",
                        minHeight: "82px",
                        background: "linear-gradient(135deg,#FFFFFF 0%,#E8F2FF 50%,#DDEBFF 100%)",
                        color: "#111111",
                        boxShadow: paymentMethod === "card" ? "0 12px 24px rgba(0,0,0,.18)" : "0 8px 18px rgba(0,0,0,.06)",
                        transform: paymentMethod === "card" ? "scale(1.015)" : "scale(1)",
                        transition: "all .18s ease",
                        fontWeight: 950,
                        textAlign: "left",
                        width: "100%",
                        opacity: 1,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                        <div>
                          <div style={{ fontSize: "1.25rem", lineHeight: 1 }}>💳</div>
                          <div style={{ marginTop: 5, fontSize: ".9rem" }}>Tarjeta</div>
                          <div style={{ marginTop: 3, fontSize: ".72rem", fontWeight: 850, opacity: .72 }}>
                            Mercado Pago seguro
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: ".92rem", lineHeight: 1.05, fontWeight: 950 }}>
                            {cardPaymentLabel}
                          </div>
                          <div style={{ marginTop: 2, fontSize: ".72rem", fontWeight: 850, opacity: .72 }}>
                            {cardPaymentUsdLabel}
                          </div>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {hasAvailableWalletBenefit && paymentMethod === "cash" && activePaymentAmountBeforeWallet != null && (
              <IonCard
                style={{
                  margin: "0 0 14px",
                  borderRadius: 24,
                  background: "linear-gradient(135deg,#EAFBF0 0%,#FFF7D6 100%)",
                  border: "1.5px solid rgba(34,197,94,.28)",
                  boxShadow: "0 16px 34px rgba(0,0,0,.18)",
                  color: "#111111",
                }}
              >
                <IonCardContent style={{ padding: "15px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: "#15803D", fontSize: ".72rem", fontWeight: 950, textTransform: "uppercase", letterSpacing: ".05em" }}>
                        Beneficio disponible
                      </div>
                      <div style={{ marginTop: 4, fontSize: "1rem", fontWeight: 950, lineHeight: 1.22 }}>
                        ¿Quieres usar tu saldo a favor en este viaje?
                      </div>
                      <div style={{ marginTop: 5, color: "#36543B", fontSize: ".78rem", fontWeight: 820, lineHeight: 1.35 }}>
                        {walletBenefitLoading
                          ? "Sincronizando tu saldo aprobado…"
                          : `Tienes ${formatCLP(availableWalletBenefitTotalClp)} aprobado por admin. Si lo usas, el backend descuenta el monto real del total de este viaje en efectivo.`}
                      </div>
                    </div>
                    <IonBadge color="success" style={{ fontWeight: 950, flexShrink: 0 }}>
                      A favor
                    </IonBadge>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginTop: 13 }}>
                    <IonButton
                      expand="block"
                      color="success"
                      fill={useWalletBenefit === true ? "solid" : "outline"}
                      onClick={() => {
                        setUseWalletBenefit(true);
                        setSubmitError(null);
                      }}
                      style={{
                        "--border-radius": "16px",
                        height: "44px",
                        fontWeight: 950,
                      } as CSSProperties}
                    >
                      Sí, usar
                    </IonButton>
                    <IonButton
                      expand="block"
                      color="medium"
                      fill={useWalletBenefit === false ? "solid" : "outline"}
                      onClick={() => {
                        setUseWalletBenefit(false);
                        setSubmitError(null);
                      }}
                      style={{
                        "--border-radius": "16px",
                        height: "44px",
                        fontWeight: 950,
                      } as CSSProperties}
                    >
                      No usar
                    </IonButton>
                  </div>

                  {useWalletBenefit === true && activeWalletBenefitDiscountClp > 0 && activePaymentAmountAfterWallet != null && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: 12,
                        borderRadius: 18,
                        background: "rgba(34,197,94,.13)",
                        border: "1px solid rgba(34,197,94,.24)",
                        color: "#14532D",
                        fontSize: ".82rem",
                        fontWeight: 900,
                        lineHeight: 1.4,
                      }}
                    >
                      Total original: {formatCLP(activePaymentAmountBeforeWallet)}
                      <br />Descuento beneficio: -{formatCLP(activeWalletBenefitDiscountClp)}
                      <br />Total a pagar ahora: {formatCLP(activePaymentAmountAfterWallet)}
                    </div>
                  )}

                  {useWalletBenefit === false && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: 11,
                        borderRadius: 18,
                        background: "rgba(255,255,255,.58)",
                        color: "#4B3B28",
                        fontSize: ".78rem",
                        fontWeight: 830,
                        lineHeight: 1.35,
                      }}
                    >
                      No se aplicará descuento. Tu saldo seguirá disponible para otro viaje.
                    </div>
                  )}
                </IonCardContent>
              </IonCard>
            )}

            {submitError && (
              <IonText color="danger">
                <p style={{ fontWeight: 700, fontSize: ".84rem" }}>
                  {submitError}
                </p>
              </IonText>
            )}

<IonButton
              expand="block"
              onClick={() => void handleRequest()}
              disabled={!canRequest || submitting}
              style={
                {
                  "--background": "var(--rp-btn-primary)",
                  "--background-activated": "linear-gradient(135deg,#c89b3c,#b84f2e)",
                  "--color": "var(--rp-btn-primary-fg)",
                  "--border-radius": "var(--rp-radius-sm)",
                  height: "48px",
                  fontWeight: 850,
                  letterSpacing: ".03em",
                  boxShadow: "var(--rp-shadow-accent)",
                } as CSSProperties
              }
            >
              {submitting ? (
                  <IonSpinner name="dots" />
                ) : paymentMethod === null ? (
                  "ELIGE FORMA DE PAGO"
                ) : selectedRoundTripPromotion ? (
                  "IDA + AGENDAMIENTO DE RECOGIDA"
                ) : rideMode === "scheduled" ? (
                  reservationRequiresCard ? "RESERVAR Y PAGAR CON TARJETA" : paymentMethod === "card" ? "AGENDAR Y PAGAR CON TARJETA" : "AGENDA TU VIAJE"
                ) : paymentMethod === "card" ? (
                  "PAGAR CON TARJETA"
                ) : (
                  "SOLICITAR VIAJE"
                )}
            </IonButton>
          </div>
        </div>

        <IonAlert
          isOpen={pendingRoundTripPromotion !== null}
          header="¿Quieres esta oferta?"
          message={
            pendingRoundTripPromotion
              ? `${pendingRoundTripPromotion.title}: ${pendingRoundTripPromotion.destinationName}, ida y vuelta por ${formatCLP(pendingRoundTripPromotion.fareClp)}. ¿Deseas aplicarla al viaje?`
              : ""
          }
          buttons={[
            {
              text: "No",
              role: "cancel",
              handler: () => setPendingRoundTripPromotion(null),
            },
            {
              text: "Sí, usar oferta",
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
            title={pickerTarget === "origin" ? "Confirma el punto de partida" : "Confirma el destino"}
            mode={pickerTarget}
            initialPoint={pickerInitialPoint}
            onCancel={() => setPickerTarget(null)}
            onConfirm={(point) => {
              suppressPickerOpenRef.current = true;

              if (pickerTarget === "origin") {
                applyOrigin(point);
              } else {
                applyDestination(point);
              }

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
