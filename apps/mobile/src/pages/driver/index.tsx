import {
  IonActionSheet,
  IonAlert,
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonModal,
  IonNote,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  IonText,
  IonTextarea,
  IonTitle,
  IonToolbar,
  useIonViewWillEnter,
} from "@ionic/react";
import {
  useEffect,
  useState,
  useCallback,
  useRef,
  type CSSProperties,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useHistory, useLocation } from "react-router-dom";
import {
  alertCircleOutline,
  closeCircleOutline,
  walletOutline,
  callOutline,
  chatbubbleEllipsesOutline,
  carOutline,
  cashOutline,
  calendarOutline,
  documentTextOutline,
  flashOutline,
  volumeMuteOutline,
  listOutline,
  personOutline,
  refreshOutline,
  navigateOutline,
  locationOutline,
  flagOutline,
  closeOutline,
  checkmarkCircleOutline,
  arrowUpOutline,
  shieldCheckmarkOutline,
  timeOutline,
  walkOutline,
  cardOutline,
  starOutline,
  cameraOutline,
  trashOutline,
  notificationsOutline,
  volumeHighOutline,
  logOutOutline,
  moonOutline,
  sunnyOutline,
} from "ionicons/icons";
import { driverProfileService, type DriverProfileData } from "../../features/drivers/driverProfile.service";
import { driverVehiclePhotoService } from "../../features/drivers/driverVehiclePhoto.service";
import { driverStatusService } from "../../features/drivers/driverStatus.service";
import { ActionCard } from "../../components/ActionCard";
import { RapagoAppBar } from "../../components/RapagoAppBar";
import { setDriverActiveRideFlag } from "../../features/rides/driverActiveRideFlag";
import { ROUTE_METADATA } from "../../navigation/routeConfig";
import { ROUTES } from "../../navigation/routes";
import { useAuth } from "../../features/auth";
import { ridesService } from "../../features/rides/rides.service";
import { cashPaymentsService } from "../../features/cashPayments/cashPayments.service.js";
import { rideLocationService } from "../../features/location/rideLocation.service.js";
import {
  MapFallback,
  loadRapaGoGoogleMaps,
} from "../../components/MapFallback";
import {
  MapView,
  useDirectionsRoute,
  type LatLng,
  type GoogleMapInstance,
} from "../../features/maps/index.js";
import {
  createRouteController,
  formatNavigationDuration,
  formatNavigationMeters as formatRouteMeters,
  hydrateRouteCache,
  type RouteController,
  type RoutePhase,
  type RouteSnapshot,
} from "../../features/navigation/index.js";
import { WhatsAppButton } from "../../components/WhatsAppButton";
import { DriverRestScheduleCard } from "./components/DriverRestScheduleCard";
import { AccountDeletionCard } from "../../components/accountDeletion/AccountDeletionCard.js";
import { getApiOrigin as getConfiguredApiOrigin } from "../../services/api/apiBaseUrl.js";
import { useRapagoSectionTheme } from "../../theme/rapagoTheme.js";
import logoRapago from "../../theme/img/logo-rapago.jpeg";

type AvailableRideData =
  import("../../features/rides/rides.service").AvailableRideData;
type DriverRideData =
  import("../../features/rides/rides.service").DriverRideData;
type ActiveRideOfferData =
  import("../../features/rides/rides.service").ActiveRideOfferData;
type DriverRideLocationPoint = Parameters<
  typeof rideLocationService.publish
>[2];

type RapaGoConnectivityMode = "checking" | "online" | "poor" | "offline";
type RapaGoConnectivityRole = "driver" | "passenger" | "admin";

const RAPAGO_CONNECTIVITY_STATUS_KEY = "rapago_connectivity_status_v1";
const RAPAGO_CONNECTIVITY_EVENT = "rapago:connectivity-status-changed";
const RAPAGO_DRIVER_NO_SHOW_AFTER_ARRIVAL_MS = 5 * 60 * 1000;
const RAPAGO_DRIVER_NO_SHOW_PERCENT = 50;
const RAPAGO_DRIVER_NO_SHOW_CAP_CLP = 5000;
const RAPAGO_DRIVER_NO_SHOW_DRIVER_SHARE_PERCENT = 50;
const RAPAGO_DRIVER_NO_SHOW_PLATFORM_SHARE_PERCENT = 50;
const RAPAGO_PASSENGER_PENDING_CHARGES_KEY_DRIVER = "rapago_passenger_pending_charges_v1";
const RAPAGO_PASSENGER_PENDING_CHARGE_EVENT_DRIVER = "rapago:passenger-pending-charge-updated";
const RAPAGO_SUPPORT_WHATSAPP_PHONE_DRIVER = "56947964171";
const RAPAGO_TRIP_SAFETY_REPORTS_KEY_DRIVER = "rapago_trip_safety_reports_v1";
const RAPAGO_TRIP_SAFETY_REPORT_EVENT_DRIVER = "rapago:trip-safety-reports-updated";

const RAPAGO_DRIVER_NO_SHOW_COMPLETED_RIDES_KEY = "rapago_driver_no_show_completed_rides_v1";

const RAPAGO_CP1252_SPECIAL_BYTES: Readonly<Record<string, number>> = Object.freeze({
  "€": 0x80,
  "‚": 0x82,
  "ƒ": 0x83,
  "„": 0x84,
  "…": 0x85,
  "†": 0x86,
  "‡": 0x87,
  "ˆ": 0x88,
  "‰": 0x89,
  "Š": 0x8a,
  "‹": 0x8b,
  "Œ": 0x8c,
  "Ž": 0x8e,
  "‘": 0x91,
  "’": 0x92,
  "“": 0x93,
  "”": 0x94,
  "•": 0x95,
  "–": 0x96,
  "—": 0x97,
  "˜": 0x98,
  "™": 0x99,
  "š": 0x9a,
  "›": 0x9b,
  "œ": 0x9c,
  "ž": 0x9e,
  "Ÿ": 0x9f,
});

const RAPAGO_CORRECT_SPANISH_ACCENTS = new Set([
  "á", "é", "í", "ó", "ú", "ñ", "ü",
  "Á", "É", "Í", "Ó", "Ú", "Ñ", "Ü",
]);

function getRapagoCp1252Byte(character: string): number | null {
  const codePoint = character.codePointAt(0);
  if (codePoint == null) return null;
  if (codePoint <= 0xff) return codePoint;
  return RAPAGO_CP1252_SPECIAL_BYTES[character] ?? null;
}

function getDriverMojibakeScore(value: string): number {
  let score = 0;

  for (const character of value) {
    if ("ÃÂâðƒÆ".includes(character)) score += 10;

    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint >= 0x80 && codePoint <= 0x9f) score += 15;

    if ("€šž™œŒŽŸ‚„†‡ˆ‰‹‘’“”•˜›".includes(character)) score += 1;
  }

  return score;
}

function decodeDriverUtf8Bytes(bytes: number[]): string | null {
  try {
    if (typeof TextDecoder !== "undefined") {
      return new TextDecoder("utf-8", { fatal: true }).decode(
        Uint8Array.from(bytes),
      );
    }

    const encoded = bytes
      .map((byte) => `%${byte.toString(16).padStart(2, "0")}`)
      .join("");
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
}

function repairDriverMojibakeSegment(value: string): string {
  let current = value;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const currentScore = getDriverMojibakeScore(current);
    if (currentScore === 0) break;

    const bytes: number[] = [];
    let canEncode = true;

    for (const character of current) {
      const byte = getRapagoCp1252Byte(character);
      if (byte == null) {
        canEncode = false;
        break;
      }
      bytes.push(byte);
    }

    if (!canEncode) break;

    const candidate = decodeDriverUtf8Bytes(bytes);
    if (candidate == null || getDriverMojibakeScore(candidate) >= currentScore) {
      break;
    }

    current = candidate;
  }

  return current;
}

function repairDriverDisplayText(value: unknown): string {
  const text = String(value ?? "");
  if (!/[ÃÂâðƒÆ\u0080-\u009F]/.test(text)) return text;

  let result = "";
  let segment = "";

  const flushSegment = () => {
    if (!segment) return;
    result += repairDriverMojibakeSegment(segment);
    segment = "";
  };

  for (const character of text) {
    const isAlreadyCorrectAccent = RAPAGO_CORRECT_SPANISH_ACCENTS.has(character);
    const canEncodeAsCp1252 = getRapagoCp1252Byte(character) != null;

    if (isAlreadyCorrectAccent || !canEncodeAsCp1252) {
      flushSegment();
      result += character;
    } else {
      segment += character;
    }
  }

  flushSegment();
  return result;
}


type DriverTripSafetyReport = {
  id: string;
  rideId: string;
  rideKey: string;
  reporterRole: "passenger" | "driver";
  status: "arrived_well" | "problem_reported" | "driver_accident_reported";
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

function sanitizeDriverTripSafetyText(value: unknown, maxLength = 220): string {
  return repairDriverDisplayText(value)
    .replace(/[<>`{}$\\]/g, "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function getDriverTripSafetyRideKey(ride: Partial<DriverRideData> & Record<string, unknown>): string {
  const id = String(ride.id ?? ride.rideId ?? ride.originalRideId ?? ride.serverRideId ?? "").trim();
  if (id) return `ride:${id}`;

  return [
    String(ride.passengerEmail ?? ride.email ?? "").trim().toLowerCase(),
    String(ride.originText ?? "").trim().toLowerCase(),
    String(ride.destinationText ?? "").trim().toLowerCase(),
    String(ride.acceptedAt ?? ride.requestedAt ?? ride.createdAt ?? "").trim(),
  ].filter(Boolean).join("|") || `driver-local:${Date.now()}`;
}

function readDriverTripSafetyReports(): DriverTripSafetyReport[] {
  try {
    const raw = localStorage.getItem(RAPAGO_TRIP_SAFETY_REPORTS_KEY_DRIVER);
    const parsed = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item): item is DriverTripSafetyReport => Boolean(item && typeof item === "object"));
  } catch {
    return [];
  }
}

function writeDriverTripSafetyReports(reports: DriverTripSafetyReport[]): void {
  try {
    localStorage.setItem(RAPAGO_TRIP_SAFETY_REPORTS_KEY_DRIVER, JSON.stringify(reports.slice(0, 300)));
    window.dispatchEvent(new CustomEvent(RAPAGO_TRIP_SAFETY_REPORT_EVENT_DRIVER, { detail: { reports } }));
    window.dispatchEvent(new CustomEvent("rapago:admin-rides-updated", { detail: { tripSafetyReports: reports } }));
  } catch {
    // No bloquea reporte de emergencia.
  }
}

function saveDriverAccidentTripSafetyReport(ride: DriverRideData, user: unknown): DriverTripSafetyReport {
  const record = ride as DriverRideData & Record<string, unknown>;
  const userRecord = user && typeof user === "object" ? (user as Record<string, unknown>) : {};
  const rideKey = getDriverTripSafetyRideKey(record);
  const now = new Date().toISOString();
  const driverEmail = sanitizeDriverTripSafetyText(userRecord.email ?? record.driverEmail, 160).toLowerCase() || null;
  const driverName = sanitizeDriverTripSafetyText(userRecord.name ?? record.driverName ?? record.driverFullName, 120) || null;

  const report: DriverTripSafetyReport = {
    id: `driver-accident-${rideKey}-${Date.now()}`,
    rideId: sanitizeDriverTripSafetyText(record.id ?? record.rideId ?? rideKey, 120),
    rideKey,
    reporterRole: "driver",
    status: "driver_accident_reported",
    title: "Conductor reportó accidente/emergencia",
    description: "El conductor presionó Reportar accidente / emergencia y fue derivado a WhatsApp soporte.",
    passengerEmail: sanitizeDriverTripSafetyText(record.passengerEmail ?? record.email, 160).toLowerCase() || null,
    passengerName: sanitizeDriverTripSafetyText(record.passengerName ?? record.userName, 120) || null,
    driverEmail,
    driverName,
    originText: sanitizeDriverTripSafetyText(record.originText, 160) || null,
    destinationText: sanitizeDriverTripSafetyText(record.destinationText, 160) || null,
    createdAt: now,
    updatedAt: now,
    source: "driver_app",
    whatsappOpened: true,
    adminStatus: "pending_admin",
  };

  const current = readDriverTripSafetyReports();
  writeDriverTripSafetyReports([report, ...current]);
  return report;
}

function buildDriverAccidentWhatsAppUrl(ride: DriverRideData, user: unknown): string {
  const record = ride as DriverRideData & Record<string, unknown>;
  const userRecord = user && typeof user === "object" ? (user as Record<string, unknown>) : {};
  const lines = [
    "EMERGENCIA RAPA GO: conductor reporta accidente/problema en viaje.",
    `Conductor: ${sanitizeDriverTripSafetyText(userRecord.name ?? record.driverName ?? "Conductor", 80)}`,
    `Correo conductor: ${sanitizeDriverTripSafetyText(userRecord.email ?? record.driverEmail ?? "No informado", 120)}`,
    `Viaje: ${sanitizeDriverTripSafetyText(record.originText, 90) || "Origen"} -> ${sanitizeDriverTripSafetyText(record.destinationText, 90) || "Destino"}`,
    record.passengerName || record.passengerEmail ? `Pasajero: ${sanitizeDriverTripSafetyText(record.passengerName ?? record.passengerEmail, 90)}` : null,
    "Solicito apoyo inmediato. El reporte quedó registrado en Admin.",
  ].filter(Boolean);

  return `https://wa.me/${RAPAGO_SUPPORT_WHATSAPP_PHONE_DRIVER}?text=${encodeURIComponent(lines.join("\n"))}`;
}

function openDriverAccidentWhatsApp(ride: DriverRideData, user: unknown): void {
  const url = buildDriverAccidentWhatsAppUrl(ride, user);
  try {
    window.open(url, "_blank", "noopener,noreferrer");
  } catch {
    window.location.href = url;
  }
}

function readDriverNoShowCompletedRides(): Array<Record<string, unknown>> {
  try {
    const raw = localStorage.getItem(RAPAGO_DRIVER_NO_SHOW_COMPLETED_RIDES_KEY);
    const parsed = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === "object") : [];
  } catch {
    return [];
  }
}

function saveDriverNoShowCompletedRides(records: Array<Record<string, unknown>>): void {
  try {
    localStorage.setItem(
      RAPAGO_DRIVER_NO_SHOW_COMPLETED_RIDES_KEY,
      JSON.stringify(records.slice(0, 200)),
    );
  } catch {
    // No bloquea UI.
  }
}

function normalizeDriverNoShowIdentityValue(value: unknown): string {
  return repairDriverDisplayText(value)
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getDriverNoShowIdentityValues(ride: Record<string, unknown>): string[] {
  return [
    ride.id,
    ride.rideId,
    ride.originalRideId,
    ride.serverRideId,
    ride.requestId,
    ride.paymentId,
  ]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
}

function getDriverNoShowRouteKey(ride: Record<string, unknown>): string {
  return [
    ride.originText,
    ride.destinationText,
    ride.passengerEmail,
    ride.passengerPhone,
    ride.scheduledAt,
    ride.scheduledPickupAt,
    ride.requestedAt,
    ride.createdAt,
  ]
    .map(normalizeDriverNoShowIdentityValue)
    .filter(Boolean)
    .join("|");
}

function driverRideNoShowCompletedIdentityMatches(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): boolean {
  const aIds = getDriverNoShowIdentityValues(a);
  const bIds = new Set(getDriverNoShowIdentityValues(b));

  if (aIds.length > 0 && aIds.some((id) => bIds.has(id))) return true;

  const aRoute = getDriverNoShowRouteKey(a);
  const bRoute = getDriverNoShowRouteKey(b);

  return Boolean(aRoute && bRoute && aRoute === bRoute);
}

function wasDriverRideNoShowCompletedLocally(
  ride: Record<string, unknown>,
  _user?: unknown,
): boolean {
  return readDriverNoShowCompletedRides().some((record) =>
    driverRideNoShowCompletedIdentityMatches(record, ride),
  );
}

function clearDriverNoShowActiveStorageEverywhere(closedRide: Record<string, unknown>): void {
  const objectKeys = [
    "rapago_last_accepted_ride",
    "rapago_driver_active_ride",
    "rapago_driver_active_ride_v1",
    "rapago_current_driver_location",
  ];

  for (const key of objectKeys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        localStorage.removeItem(key);
        continue;
      }

      const parsed = JSON.parse(raw) as unknown;
      const record =
        parsed && typeof parsed === "object" && "ride" in (parsed as Record<string, unknown>)
          ? (parsed as Record<string, unknown>).ride
          : parsed;

      if (
        record &&
        typeof record === "object" &&
        driverRideNoShowCompletedIdentityMatches(record as Record<string, unknown>, closedRide)
      ) {
        localStorage.removeItem(key);
      }
    } catch {
      localStorage.removeItem(key);
    }
  }

  const activeListKeys = [
    "rapago_local_driver_assigned_rides",
    "rapago_driver_scheduled_queue",
    "rapago_driver_active_rides_v1",
  ];

  for (const key of activeListKeys) {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
      if (!Array.isArray(parsed)) continue;

      localStorage.setItem(
        key,
        JSON.stringify(
          parsed
            .filter((item) => !driverRideNoShowCompletedIdentityMatches(item, closedRide))
            .slice(0, 200),
        ),
      );
    } catch {
      // No bloquea UI.
    }
  }

  try {
    const historyKey = "rapago_driver_my_rides_v1";
    const raw = localStorage.getItem(historyKey);
    const parsed = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
    const safeList = Array.isArray(parsed) ? parsed : [];

    const next = [
      closedRide,
      ...safeList.filter((item) => !driverRideNoShowCompletedIdentityMatches(item, closedRide)),
    ].slice(0, 200);

    localStorage.setItem(historyKey, JSON.stringify(next));
  } catch {
    // No bloquea historial local.
  }
}

function markDriverRideNoShowCompletedLocally(
  ride: DriverRideData & Record<string, unknown>,
  user?: unknown,
): DriverRideData & Record<string, unknown> {
  const closedAt = new Date().toISOString();

  const closedRide = {
    ...ride,
    status: "completed",
    completedAt: String(ride.completedAt ?? closedAt),
    closedByDriverAt: String(ride.closedByDriverAt ?? closedAt),
    driverClosedAt: String(ride.driverClosedAt ?? closedAt),
    driverNoShowClosed: true,
    noShowConfirmedByDriver: true,
    noShowConfirmedAt: String(ride.noShowConfirmedAt ?? closedAt),
    cancelledByRole: "driver_no_show",
    cancelledBy: "driver_no_show",
    cancellationReason: "No show: pasajero no se presento tras 5 minutos de espera.",
    driverFinalState: "no_show_completed",
  } as DriverRideData & Record<string, unknown>;

  const previous = readDriverNoShowCompletedRides();
  saveDriverNoShowCompletedRides([
    closedRide as unknown as Record<string, unknown>,
    ...previous.filter(
      (item) =>
        !driverRideNoShowCompletedIdentityMatches(
          item,
          closedRide as unknown as Record<string, unknown>,
        ),
    ),
  ]);

  clearDriverNoShowActiveStorageEverywhere(closedRide as unknown as Record<string, unknown>);

  try {
    markDriverRideCancelledLocally(
      {
        ...(closedRide as unknown as Record<string, unknown>),
        status: "cancelled",
        cancelledByRole: "driver_no_show",
        requeuedReason: "driver_no_show",
      },
      user,
    );
  } catch {
    // Solo se usa como supresion local del activo.
  }

  return closedRide;
}



function getRapaGoConnectivityProbeUrl(): string {
  const env = import.meta.env as Record<string, string | undefined>;
  const raw = String(env.VITE_API_BASE_URL || env.VITE_API_URL || "/api").trim();

  if (!raw || raw === "/" || raw === "/api") return "/health";

  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      const cleanPath = url.pathname.replace(/\/api\/?$/i, "").replace(/\/+$/, "");
      url.pathname = `${cleanPath || ""}/health`;
      url.search = "";
      url.hash = "";
      return url.toString();
    } catch {
      const base = raw.replace(/\/api\/?$/i, "").replace(/\/+$/, "");
      return `${base}/health`;
    }
  }

  const clean = raw.replace(/\/api\/?$/i, "").replace(/\/+$/, "");
  return `${clean || ""}/health`;
}

function getBrowserNetworkInfo(): {
  effectiveType: string;
  downlink: number | null;
  rtt: number | null;
} {
  const nav = navigator as Navigator & {
    connection?: {
      effectiveType?: string;
      downlink?: number;
      rtt?: number;
    };
  };

  return {
    effectiveType: String(nav.connection?.effectiveType ?? "").toLowerCase(),
    downlink: Number.isFinite(Number(nav.connection?.downlink))
      ? Number(nav.connection?.downlink)
      : null,
    rtt: Number.isFinite(Number(nav.connection?.rtt))
      ? Number(nav.connection?.rtt)
      : null,
  };
}

function browserLooksLikePoorConnection(): boolean {
  const info = getBrowserNetworkInfo();

  return (
    info.effectiveType === "slow-2g" ||
    info.effectiveType === "2g" ||
    (info.downlink != null && info.downlink > 0 && info.downlink < 0.45) ||
    (info.rtt != null && info.rtt > 1800)
  );
}

async function detectRapaGoConnectivityMode(): Promise<RapaGoConnectivityMode> {
  if (!Boolean(navigator.onLine)) return "offline";

  const browserPoor = browserLooksLikePoorConnection();
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), browserPoor ? 4500 : 7000);

  try {
    await fetch(getRapaGoConnectivityProbeUrl(), {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });

    return browserPoor ? "poor" : "online";
  } catch {
    return !Boolean(navigator.onLine) ? "offline" : "poor";
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function getRapaGoConnectivityMessage(
  role: RapaGoConnectivityRole,
  status: RapaGoConnectivityMode,
): string {
  if (status === "checking") return "Revisando conexión de Rapa Go...";
  if (status === "online") return "Conexión estable.";

  if (role === "driver") {
    if (status === "offline") {
      return "Sin internet. Para proteger tus viajes quedaste No disponible. Busca una zona con conexión y luego vuelve a activar Disponible.";
    }

    return "Señal baja. Para evitar viajes fallidos quedaste No disponible. Busca una zona con mejor internet y vuelve a activar Disponible.";
  }

  if (role === "admin") {
    return "Modo conexión baja: algunas acciones pueden quedar pendientes hasta recuperar internet.";
  }

  if (status === "offline") {
    return "Sin internet: puedes revisar lo último cargado, pero para solicitar, pagar o cancelar viajes necesitas conexión.";
  }

  return "Modo conexión baja: algunas acciones pueden tardar. Para solicitar viajes usa una zona con mejor señal.";
}

function publishRapaGoConnectivityStatus(status: RapaGoConnectivityMode): void {
  try {
    localStorage.setItem(RAPAGO_CONNECTIVITY_STATUS_KEY, status);
  } catch {
    // No bloquea el flujo.
  }

  window.dispatchEvent(
    new CustomEvent(RAPAGO_CONNECTIVITY_EVENT, {
      detail: {
        status,
        blocked: status === "offline" || status === "poor",
      },
    }),
  );
}

function useRapaGoConnectivityMonitor(role: RapaGoConnectivityRole): {
  status: RapaGoConnectivityMode;
  blocked: boolean;
  message: string;
} {
  const [status, setStatus] = useState<RapaGoConnectivityMode>(() => {
    try {
      const stored = localStorage.getItem(RAPAGO_CONNECTIVITY_STATUS_KEY);
      if (stored === "online" || stored === "offline" || stored === "poor") {
        return stored;
      }
    } catch {
      // Usa checking.
    }

    return navigator.onLine === false ? "offline" : "checking";
  });

  useEffect(() => {
    let cancelled = false;
    let timerId: number | undefined;

    const refresh = async () => {
      const nextStatus = await detectRapaGoConnectivityMode();
      if (cancelled) return;

      setStatus(nextStatus);
      publishRapaGoConnectivityStatus(nextStatus);
    };

    const schedule = () => {
      window.clearInterval(timerId);
      timerId = window.setInterval(() => {
        void refresh();
      }, 8500);
    };

    void refresh();
    schedule();

    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      cancelled = true;
      window.clearInterval(timerId);
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  return {
    status,
    blocked: status === "offline" || status === "poor",
    message: getRapaGoConnectivityMessage(role, status),
  };
}

function RapaGoConnectivityBanner({
  role,
  status,
  style,
}: {
  role: RapaGoConnectivityRole;
  status: RapaGoConnectivityMode;
  style?: CSSProperties;
}): JSX.Element | null {
  if (status === "online") return null;

  const isChecking = status === "checking";
  const isOffline = status === "offline";

  return (
    <div
      className={`rapago-connectivity-banner ${
        isChecking ? "is-checking" : isOffline ? "is-offline" : "is-poor"
      }`}
      style={style}
      role="status"
      aria-live="polite"
    >
      <div className="rapago-connectivity-banner__icon" aria-hidden="true">
        {isChecking ? "…" : isOffline ? "⌁" : "!"}
      </div>

      <div className="rapago-connectivity-banner__copy">
        <div className="rapago-connectivity-banner__title">
          {isChecking
            ? "Revisando conexión"
            : isOffline
              ? "Modo sin internet"
              : "Modo conexión baja"}
        </div>
        <div className="rapago-connectivity-banner__message">
          {getRapaGoConnectivityMessage(role, status)}
        </div>
      </div>
    </div>
  );
}


function StarRatingInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: "flex", gap: "4px", margin: "8px 0" }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <span
          key={s}
          onClick={() => onChange(s)}
          style={{
            fontSize: "1.6rem",
            cursor: "pointer",
            color: s <= value ? "#f4c430" : "#ccc",
          }}
        >
          ★
        </span>
      ))}
    </div>
  );
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
  originText?: string | null;
  destinationText?: string | null;
  createdAt: string;
};

type DriverRatingSummary = {
  average: number;
  count: number;
  latest: RapaGoDriverRatingRecord[];
};

const RAPAGO_DRIVER_RATINGS_KEY = "rapago_driver_ratings_v1";
const RAPAGO_DRIVER_RATINGS_EVENT = "rapago:driver-ratings-updated";

function driverRatingClean(value: unknown): string {
  return repairDriverDisplayText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function driverRatingString(value: unknown): string {
  return String(value ?? "").trim();
}

function getDriverRatingObjectString(user: unknown, keys: string[]): string {
  if (!user || typeof user !== "object") return "";
  const record = user as Record<string, unknown>;

  for (const key of keys) {
    const value = driverRatingString(record[key]);
    if (value) return value;
  }

  return "";
}

function readRapaGoDriverRatings(): RapaGoDriverRatingRecord[] {
  try {
    const raw = localStorage.getItem(RAPAGO_DRIVER_RATINGS_KEY);
    const parsed = raw ? (JSON.parse(raw) as RapaGoDriverRatingRecord[]) : [];
    return Array.isArray(parsed)
      ? parsed.filter((item) => item && typeof item === "object" && Number.isFinite(Number(item.stars)))
      : [];
  } catch {
    return [];
  }
}

function getDriverRatingIdentityKeys(user: unknown, phone?: string | null): Set<string> {
  const keys = new Set<string>();
  const id = getDriverRatingObjectString(user, ["id", "userId", "uid"]);
  const email = getDriverRatingObjectString(user, ["email", "mail"]);
  const name = getDriverRatingObjectString(user, ["name", "fullName", "displayName"]);
  const phoneValue = driverRatingString(phone || getDriverRatingObjectString(user, ["phone", "phoneNumber", "mobile"]));

  if (id) keys.add(`id:${driverRatingClean(id)}`);
  if (email) keys.add(`email:${driverRatingClean(email)}`);
  if (name) keys.add(`name:${driverRatingClean(name)}`);
  if (phoneValue) keys.add(`phone:${driverRatingClean(phoneValue)}`);

  return keys;
}

function driverRatingMatchesCurrentDriver(
  rating: RapaGoDriverRatingRecord,
  user: unknown,
  phone?: string | null,
): boolean {
  const keys = getDriverRatingIdentityKeys(user, phone);
  if (keys.size === 0) return false;

  const candidates = [
    rating.driverKey,
    rating.driverId ? `id:${driverRatingClean(rating.driverId)}` : "",
    rating.driverUserId ? `id:${driverRatingClean(rating.driverUserId)}` : "",
    rating.driverEmail ? `email:${driverRatingClean(rating.driverEmail)}` : "",
    rating.driverPhone ? `phone:${driverRatingClean(rating.driverPhone)}` : "",
    rating.driverName ? `name:${driverRatingClean(rating.driverName)}` : "",
  ].filter(Boolean);

  return candidates.some((candidate) => keys.has(candidate));
}

function readDriverRatingSummary(user: unknown, phone?: string | null): DriverRatingSummary {
  const ratings = readRapaGoDriverRatings()
    .filter((rating) => driverRatingMatchesCurrentDriver(rating, user, phone))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const count = ratings.length;
  const total = ratings.reduce((sum, rating) => sum + Math.min(5, Math.max(1, Number(rating.stars) || 0)), 0);

  return {
    average: count > 0 ? total / count : 0,
    count,
    latest: ratings.slice(0, 3),
  };
}

function DriverRatingStarsDisplay({ summary }: { summary: DriverRatingSummary }): JSX.Element {
  const rounded = summary.count > 0 ? Math.round(summary.average) : 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <div style={{ display: "flex", gap: 1, fontSize: "1rem", lineHeight: 1 }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <span key={star} style={{ color: star <= rounded ? "#f4c430" : "rgba(255,255,255,.42)" }}>
            ★
          </span>
        ))}
      </div>
      <div style={{ fontWeight: 950, fontSize: ".82rem" }}>
        {summary.count > 0
          ? `${summary.average.toFixed(1)} · ${summary.count} calificación${summary.count === 1 ? "" : "es"}`
          : "Sin calificaciones todavía"}
      </div>
    </div>
  );
}

function meta(path: string) {
  return ROUTE_METADATA.find((r) => r.path === path)!;
}

type RideNavigationPoints = {
  pickupLat: number | null;
  pickupLng: number | null;
  destinationLat: number | null;
  destinationLng: number | null;
  passengerOriginalLat: number | null;
  passengerOriginalLng: number | null;
  pickupWalkMeters: number | null;
};

function extractNumberFromNotes(
  notes: string | null | undefined,
  regex: RegExp,
): number | null {
  if (!notes) return null;

  const match = notes.match(regex);
  if (!match?.[1]) return null;

  const parsed = Number(match[1].replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function extractRideNavigationPoints(
  notes: string | null | undefined,
): RideNavigationPoints {
  return {
    pickupLat: extractNumberFromNotes(
      notes,
      /Coordenadas recogida accesible:\s*(-?\d+(?:[.,]\d+)?)/i,
    ),
    pickupLng: extractNumberFromNotes(
      notes,
      /Coordenadas recogida accesible:\s*-?\d+(?:[.,]\d+)?,\s*(-?\d+(?:[.,]\d+)?)/i,
    ),
    destinationLat: extractNumberFromNotes(
      notes,
      /Coordenadas destino accesible:\s*(-?\d+(?:[.,]\d+)?)/i,
    ),
    destinationLng: extractNumberFromNotes(
      notes,
      /Coordenadas destino accesible:\s*-?\d+(?:[.,]\d+)?,\s*(-?\d+(?:[.,]\d+)?)/i,
    ),
    passengerOriginalLat: extractNumberFromNotes(
      notes,
      /Ubicación real del pasajero:\s*(-?\d+(?:[.,]\d+)?)/i,
    ),
    passengerOriginalLng: extractNumberFromNotes(
      notes,
      /Ubicación real del pasajero:\s*-?\d+(?:[.,]\d+)?,\s*(-?\d+(?:[.,]\d+)?)/i,
    ),
    pickupWalkMeters: extractNumberFromNotes(
      notes,
      /caminar aprox\.\s*(\d+(?:[.,]\d+)?)\s*m/i,
    ),
  };
}

const RAPAGO_PASSENGER_NOTE_MAX_LENGTH_DRIVER = 180;
function sanitizePassengerRideNoteForDriver(value: unknown): string {
  return String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/[<>`{}$\\]/g, "")
    .replace(/RAPAGO_PASSENGER_NOTE_(?:START|END)/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, RAPAGO_PASSENGER_NOTE_MAX_LENGTH_DRIVER);
}

function extractPassengerRideNoteFromNotes(notes: string | null | undefined): string | null {
  if (!notes) return null;

  const marked = notes.match(
    /RAPAGO_PASSENGER_NOTE_START\s+([\s\S]*?)\s+RAPAGO_PASSENGER_NOTE_END\.?/i,
  );
  if (marked?.[1]) {
    return sanitizePassengerRideNoteForDriver(marked[1]) || null;
  }

  const labelled = notes.match(
    /(?:Nota del pasajero|Nota pasajero):\s*([\s\S]*?)(?=\s+(?:RAPAGO_[A-Z_]+:|Forma de pago seleccionada:|Categor[ií]a de veh[ií]culo seleccionada:|Tipo de viaje seleccionado:|Direcci[oó]n origen confirmada:|Coordenadas recogida accesible:|Tarifa RAPA GO calculada:|$))/i,
  );
  if (labelled?.[1]) {
    return sanitizePassengerRideNoteForDriver(labelled[1]) || null;
  }

  // Compatibilidad con solicitudes antiguas donde la nota se guardaba
  // entre las coordenadas y la tarifa, sin una etiqueta propia.
  const legacy = notes.match(
    /Coordenadas destino accesible:\s*-?\d+(?:[.,]\d+)?,\s*-?\d+(?:[.,]\d+)?\.\s*([\s\S]*?)(?=\s+(?:Tarifa RAPA GO calculada:|Tarifa estimada pasajero:|Distancia estimada:|Duraci[oó]n estimada:|Tipo de viaje tarifario:|Ganancia estimada conductor:|$))/i,
  );
  if (legacy?.[1]) {
    return sanitizePassengerRideNoteForDriver(legacy[1]) || null;
  }

  const looksTechnical = /(?:RAPAGO_[A-Z_]+:|Forma de pago seleccionada:|Coordenadas recogida accesible:|Tarifa RAPA GO calculada:|Categor[ií]a de veh[ií]culo seleccionada:)/i.test(notes);
  if (!looksTechnical) {
    return sanitizePassengerRideNoteForDriver(notes) || null;
  }

  return null;
}

function getPassengerRideNoteForDriver(rideOrNotes: unknown): string | null {
  if (rideOrNotes && typeof rideOrNotes === "object") {
    const record = rideOrNotes as Record<string, unknown>;
    const direct = sanitizePassengerRideNoteForDriver(
      record.passengerNote ??
        record.passenger_note ??
        record.passengerInstructions ??
        record.passengerComment,
    );
    if (direct) return direct;

    return extractPassengerRideNoteFromNotes(
      typeof record.notes === "string" ? record.notes : null,
    );
  }

  return extractPassengerRideNoteFromNotes(
    typeof rideOrNotes === "string" ? rideOrNotes : null,
  );
}

function PassengerRideNoteCard({
  ride,
  compact = false,
}: {
  ride: unknown;
  compact?: boolean;
}): JSX.Element | null {
  const passengerNote = getPassengerRideNoteForDriver(ride);
  if (!passengerNote) return null;

  return (
    <div
      style={{
        marginTop: compact ? 8 : 12,
        marginBottom: compact ? 8 : 12,
        borderRadius: compact ? 14 : 18,
        border: "1px solid rgba(210,164,58,.48)",
        background: "linear-gradient(135deg,#fff9e8,#ffe7a6)",
        color: "#111",
        padding: compact ? "10px 11px" : "12px 13px",
        boxShadow: "0 8px 20px rgba(0,0,0,.10)",
        overflowWrap: "anywhere",
      }}
      aria-label="Nota del pasajero"
    >
      <div
        style={{
          color: "#8a6418",
          fontSize: ".68rem",
          fontWeight: 950,
          letterSpacing: ".04em",
          textTransform: "uppercase",
        }}
      >
        {/* Decorativo: el texto de al lado ya dice "Nota del pasajero". */}
        <IonIcon icon={documentTextOutline} aria-hidden="true" style={{ fontSize: "1em", verticalAlign: "-0.125em" }} /> Nota del pasajero
      </div>
      <div
        style={{
          marginTop: 5,
          fontSize: compact ? ".78rem" : ".84rem",
          lineHeight: 1.4,
          fontWeight: 850,
          whiteSpace: "pre-wrap",
        }}
      >
        {passengerNote}
      </div>
    </div>
  );
}

function openGoogleNavigation(
  origin: { lat: number; lng: number } | null,
  destination: { lat: number; lng: number },
): void {
  try {
    window.dispatchEvent(
      new CustomEvent("rapago:driver-internal-navigation-requested", {
        detail: {
          origin,
          destination,
          source: "driver_internal_map",
        },
      }),
    );
  } catch {
    // No bloquea la navegaci?n interna.
  }

  console.info("[RAPA GO] Navegaci?n externa bloqueada. Se mantiene mapa interno.", {
    origin,
    destination,
  });
}

function isInsideRapaNui(point: { lat: number; lng: number } | null): boolean {
  if (!point) return false;

  return (
    point.lat <= -27.045 &&
    point.lat >= -27.205 &&
    point.lng <= -109.25 &&
    point.lng >= -109.5
  );
}



type RapaNuiZoneReference = {
  zone: string;
  aliases: string[];
  point?: { lat: number; lng: number };
};

const RAPA_NUI_ZONE_REFERENCES: RapaNuiZoneReference[] = [
  { zone: "Ara Piki", aliases: ["ara piki", "arapiki"], point: { lat: -27.1456, lng: -109.4149 } },
  { zone: "Orito / Camino a Anakena", aliases: ["orito", "camino anakena", "panaquena", "panakena", "inla", "la inla"], point: { lat: -27.1028, lng: -109.3716 } },
  { zone: "Hospital / Centro de Hanga Roa", aliases: ["hospital", "hanga roa hospital", "hospital de hanga roa"], point: { lat: -27.1502, lng: -109.4216 } },
  { zone: "Centro de Hanga Roa", aliases: ["centro", "hanga roa", "caleta", "mercado artesanal", "feria artesanal", "iglesia", "comisaria", "comisaría", "hotel taha tai", "taha tai", "taha-tai", "hanga roa centro"], point: { lat: -27.1505, lng: -109.4325 } },
  { zone: "Tahai", aliases: ["tahai", "ahu tahai"], point: { lat: -27.1398, lng: -109.4298 } },
  { zone: "Mataveri / Aeropuerto", aliases: ["mataveri", "aeropuerto", "airport"], point: { lat: -27.1648, lng: -109.4210 } },
  { zone: "Hanga Piko", aliases: ["hanga piko", "puerto hanga piko"], point: { lat: -27.1561, lng: -109.4440 } },
  { zone: "Puna Pau", aliases: ["puna pau"], point: { lat: -27.1385, lng: -109.3959 } },
  { zone: "Ahu Akivi", aliases: ["ahu akivi", "akivi"], point: { lat: -27.1150, lng: -109.3950 } },
  { zone: "Anakena", aliases: ["anakena"], point: { lat: -27.0732, lng: -109.3233 } },
  { zone: "Terevaka", aliases: ["terevaka", "tere vaka"], point: { lat: -27.0917, lng: -109.3820 } },
  { zone: "Orongo / Rano Kau", aliases: ["orongo", "rano kau", "rano kao"], point: { lat: -27.1860, lng: -109.4355 } },
  { zone: "Rano Raraku", aliases: ["rano raraku"], point: { lat: -27.1210, lng: -109.2880 } },
  { zone: "Tongariki", aliases: ["tongariki", "ahu tongariki"], point: { lat: -27.1251, lng: -109.2761 } },
  { zone: "Vaitea", aliases: ["vaitea"], point: { lat: -27.1015, lng: -109.3505 } },
];

function normalizeRapaNuiZoneText(value: unknown): string {
  return repairDriverDisplayText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function pointDistanceMetersForZone(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
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

function resolveRapaNuiPointFromText(
  textValues: Array<string | null | undefined>,
): { lat: number; lng: number } | null {
  const combinedText = normalizeRapaNuiZoneText(textValues.filter(Boolean).join(" "));
  if (!combinedText) return null;

  const direct = RAPA_NUI_ZONE_REFERENCES.find((reference) =>
    Boolean(reference.point) &&
    reference.aliases.some((alias) => {
      const normalizedAlias = normalizeRapaNuiZoneText(alias);
      return combinedText.includes(normalizedAlias) || normalizedAlias.includes(combinedText);
    }),
  );

  if (direct?.point) return direct.point;

  return null;
}

function getRapaNuiFallbackDriverPointForMap(
  target: { lat: number; lng: number } | null,
): { lat: number; lng: number } {
  const center = { lat: -27.1505, lng: -109.4325 };

  if (!target || !isInsideRapaNui(target)) return center;

  // Si el destino está en el centro, alejamos un poco el punto inicial para
  // que Google dibuje una ruta visible en vez de una línea de 0 metros.
  if (pointDistanceMetersForZone(center, target) <= 260) {
    return { lat: target.lat - 0.0042, lng: target.lng + 0.0042 };
  }

  return center;
}

function getDriverMapPointForRoute(
  realPoint: { lat: number; lng: number } | null,
  _target: { lat: number; lng: number } | null,
): { lat: number; lng: number } | null {
  // Navegación 100% real: nunca inventamos coordenadas del conductor.
  // Si el GPS está fuera de Rapa Nui en pruebas, se muestra esa ubicación real.
  // En producción, al estar en la isla, Google calculará la ruta real desde el GPS real.
  return realPoint;
}

function getRapaNuiZoneName(
  point: { lat: number; lng: number } | null,
  textValues: Array<string | null | undefined>,
): string {
  const combinedText = normalizeRapaNuiZoneText(textValues.filter(Boolean).join(" "));

  if (combinedText) {
    const byText = RAPA_NUI_ZONE_REFERENCES.find((reference) =>
      reference.aliases.some((alias) => {
        const normalizedAlias = normalizeRapaNuiZoneText(alias);
        return combinedText.includes(normalizedAlias) || normalizedAlias.includes(combinedText);
      }),
    );

    if (byText) return byText.zone;
  }

  if (!point) return "Zona no identificada";

  const nearest = RAPA_NUI_ZONE_REFERENCES
    .filter((reference) => reference.point)
    .map((reference) => ({
      zone: reference.zone,
      meters: pointDistanceMetersForZone(point, reference.point!),
    }))
    .sort((a, b) => a.meters - b.meters)[0];

  if (!nearest) return "Rapa Nui";

  if (nearest.meters <= 1200) return nearest.zone;
  if (nearest.meters <= 2800) return `Cerca de ${nearest.zone}`;
  return "Rapa Nui";
}

function cleanPointDisplayName(value: unknown, fallback: string): string {
  const raw = repairDriverDisplayText(value).trim();
  if (!raw) return fallback;

  return raw
    .replace(/,\s*Hanga Roa.*$/i, "")
    .replace(/,\s*Isla de Pascua.*$/i, "")
    .replace(/,\s*Valpara[ií]so.*$/i, "")
    .replace(/,\s*Chile.*$/i, "")
    .trim() || fallback;
}

function extractConfirmedRideAddress(
  notes: string | null | undefined,
  kind: "origin" | "destination",
): string | null {
  const text = repairDriverDisplayText(notes);
  if (!text.trim()) return null;

  const pattern = kind === "origin"
    ? /Direcci[oó]n origen confirmada:\s*(.*?)(?=Direcci[oó]n destino confirmada:|Ubicaci[oó]n real del pasajero:|Coordenadas recogida accesible:|$)/i
    : /Direcci[oó]n destino confirmada:\s*(.*?)(?=Ubicaci[oó]n real del pasajero:|Coordenadas recogida accesible:|Coordenadas destino accesible:|$)/i;

  const value = text.match(pattern)?.[1]?.trim();
  return value ? value.replace(/\s+/g, " ") : null;
}

function normalizeDriverPlaceStreetText(value: unknown): string {
  return repairDriverDisplayText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function removeDriverGenericLocationPrefix(value: string): string {
  return value
    .replace(/^recogida\s+(en|:)?\s*/i, "")
    .replace(/^punto\s+de\s+recogida\s+(en|:)?\s*/i, "")
    .replace(/^inicio\s+de\s+viaje\s+(en|:)?\s*/i, "")
    .replace(/^destino\s+(en|:)?\s*/i, "")
    .trim();
}

function getDriverAddressMainPart(address: string | null | undefined): string {
  const clean = cleanPointDisplayName(address, "");
  if (!clean) return "";

  const ignored = new Set([
    "hanga roa",
    "rapa nui",
    "isla de pascua",
    "easter island",
    "valparaiso",
    "valparaíso",
    "chile",
  ]);

  const firstUseful = clean
    .split(",")
    .map((part) => part.trim())
    .find((part) => {
      const normalized = normalizeDriverPlaceStreetText(part);
      return Boolean(part && normalized && !ignored.has(normalized));
    });

  return removeDriverGenericLocationPrefix(firstUseful ?? clean);
}

function buildDriverPlaceStreetTitle(
  placeValue: string | null | undefined,
  addressValue: string | null | undefined,
  fallback: string,
): string {
  const rawPlace = removeDriverGenericLocationPrefix(cleanPointDisplayName(placeValue, ""));
  const rawStreet = getDriverAddressMainPart(addressValue);
  const fallbackClean = cleanPointDisplayName(fallback, "Punto de ruta");

  const place = rawPlace || "";
  const street = rawStreet || "";

  if (place && street) {
    const placeKey = normalizeDriverPlaceStreetText(place);
    const streetKey = normalizeDriverPlaceStreetText(street);

    if (placeKey === streetKey || placeKey.includes(streetKey) || streetKey.includes(placeKey)) {
      return place;
    }

    return `${place} · ${street}`;
  }

  return place || street || fallbackClean;
}

function buildDriverPointDisplay(input: {
  label: string;
  text: string | null | undefined;
  address?: string | null;
  point: { lat: number; lng: number } | null;
}): { name: string; zone: string; detail: string } {
  const zone = getRapaNuiZoneName(input.point, [input.text, input.address]);
  const name = buildDriverPlaceStreetTitle(input.text, input.address, input.label);
  const addressMain = getDriverAddressMainPart(input.address);
  const addressKey = normalizeDriverPlaceStreetText(addressMain);
  const nameKey = normalizeDriverPlaceStreetText(name);
  const detailParts = [
    addressMain && !nameKey.includes(addressKey) ? addressMain : "",
    zone,
  ].filter((value, index, array) => value && array.indexOf(value) === index);

  return {
    name,
    zone,
    detail: detailParts.join(" · ") || zone,
  };
}

function getDriverRidePointDisplayLabel(
  ride: { originText?: string | null; destinationText?: string | null; notes?: string | null },
  kind: "origin" | "destination",
): string {
  const textValue = kind === "origin" ? ride.originText : ride.destinationText;
  const addressValue = extractConfirmedRideAddress(ride.notes, kind);
  return buildDriverPlaceStreetTitle(
    textValue,
    addressValue,
    kind === "origin" ? "Punto de recogida" : "Destino",
  );
}

function getDriverRideRouteDisplayLabel(
  ride: { originText?: string | null; destinationText?: string | null; notes?: string | null },
): string {
  return `${getDriverRidePointDisplayLabel(ride, "origin")} → ${getDriverRidePointDisplayLabel(ride, "destination")}`;
}

function getDriverLocationMessage(): string {
  if (!navigator.geolocation) {
    return "Tu navegador no permite usar GPS. Activa ubicación para tomar viajes reales.";
  }

  return "Activa el permiso de ubicación para ver rutas reales del conductor.";
}

function getCurrentLocationForNavigation(destination: {
  lat: number;
  lng: number;
}): void {
  if (!navigator.geolocation) {
    openGoogleNavigation(null, destination);
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      openGoogleNavigation(
        {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        },
        destination,
      );
    },
    () => openGoogleNavigation(null, destination),
    {
      enableHighAccuracy: true,
      timeout: 9000,
      maximumAge: 30000,
    },
  );
}

function uberPanelStyle(extra?: CSSProperties): CSSProperties {
  return {
    background: "rgba(15,15,15,.96)",
    color: "#F6F2EC",
    borderRadius: "20px",
    border: "1px solid rgba(255,255,255,.08)",
    boxShadow: "0 18px 40px rgba(0,0,0,.35)",
    ...extra,
  };
}

// ── Capas del mapa de navegación (UberDriverNavigationMap) ─────────────────
// Alto real de la hoja inferior (duración/distancia + soltar cámara/recentrar)
// y separación mínima que deben respetar los controles flotantes por encima
// de ella. Antes cada botón traía su propio "top" o "bottom" mágico y en
// pantallas de conductor reales (iPhone, ~390pt de ancho) el riel derecho
// (recalcular/navegar/silenciar), anclado desde ARRIBA, terminaba invadiendo
// la hoja inferior, anclada desde ABAJO: a partir de cierto alto de mapa
// ambos grupos ocupaban el mismo rectángulo. Anclar TODO desde abajo, con la
// misma referencia, hace que la separación sea siempre la misma sin importar
// el alto del mapa.
const RAPAGO_NAV_SHEET_HEIGHT = 94;
/* Franja que sigue visible con la hoja plegada del todo: el asa y su zona
   táctil. Nunca se pliega entera, porque entonces no quedaría de dónde
   agarrarla para volver a subirla. */
const RAPAGO_NAV_SHEET_GRIP_H = 34;

/* Reposos de la hoja de navegación, como fracción del recorrido total.
   `expanded` = 0 (hoja arriba del todo, se ve todo el contenido);
   `collapsed` = 1 (sólo el asa, máximo mapa);
   `half` deja ETA + estado + acción principal y esconde el cuerpo de avisos.

   Que las alturas sean predecibles importa más que la libertad del gesto: si
   la hoja se queda donde cayó el dedo, el botón principal cambia de sitio en
   cada viaje y el conductor no puede construir memoria muscular de dónde
   tocar sin mirar. */
type NavSheetSnap = "collapsed" | "half" | "expanded";

const RAPAGO_NAV_SHEET_SNAP_RATIO: Record<NavSheetSnap, number> = {
  expanded: 0,
  half: 0.52,
  collapsed: 1,
};

/* De más abierta a más cerrada: el orden define qué es "un paso" al hacer un
   gesto rápido o al pulsar las flechas del teclado. */
const RAPAGO_NAV_SHEET_SNAP_ORDER: NavSheetSnap[] = [
  "expanded",
  "half",
  "collapsed",
];

/* px/ms. Por encima de esto el gesto se lee como intención ("mándala arriba")
   y no como colocación, así que avanza un reposo sin mirar cuánto recorrió. */
const RAPAGO_NAV_SHEET_FLICK_VELOCITY = 0.55;
/* Un gesto que mueve menos que esto es una pulsación, no un arrastre. En
   táctil, al soltar tras arrastrar también llega un `click`: sin distinguirlos
   la hoja saltaría justo después de que el conductor la acabe de colocar. */
const RAPAGO_NAV_SHEET_TAP_SLOP = 6;
const RAPAGO_NAV_RAIL_GAP = 14;
const RAPAGO_NAV_RAIL_BOTTOM = `calc(${RAPAGO_NAV_SHEET_HEIGHT}px + ${RAPAGO_NAV_RAIL_GAP}px)`;

function UberDriverNavigationMap({
  ride,
  height = 360,
  driverUser,
  sheetHeader = null,
  sheetBody = null,
  sheetActions = null,
  sheetPrimaryAction = null,
}: {
  ride: {
    id?: string | null;
    originText: string;
    destinationText: string;
    notes?: string | null;
    status: string;
  };
  // Acepta número (alto fijo en px, usado en previsualizaciones pequeñas) o
  // "100%" (el mapa a pantalla completa de ActiveRideScreen, que reserva su
  // alto real vía flexbox en vez de un cálculo en JS). El cálculo de cámara
  // de más abajo necesita un número en px pase lo que pase, así que usa
  // `heightPx` como aproximación cuando height es un string.
  height?: number | string;
  driverUser?: unknown;
  // Acciones principales del viaje ("Llegué al punto" / "Cancelar", etc.).
  // Viven DENTRO de la hoja inferior del mapa, junto al ETA, en vez de en un
  // panel aparte bajo el mapa: así el conductor no pierde de vista la ruta y
  // el mapa recupera todo el alto que antes ocupaba ese panel. Se ocultan en
  // previsualizaciones chicas, que no son interactivas.
  sheetActions?: JSX.Element | null;
  // Estado del viaje ("Navegando al destino" + dirección). Zona fija, bajo el
  // ETA: es contexto que el conductor debe poder leer de un vistazo.
  sheetHeader?: JSX.Element | null;
  // Avisos y acciones secundarias (próximo servicio, No show). Única zona con
  // scroll propio: si no cabe, se desplaza aquí dentro y nunca empuja a las
  // acciones principales fuera de la pantalla.
  sheetBody?: JSX.Element | null;
  // Acción principal del viaje, flotando en la esquina superior derecha de la
  // hoja (junto al asa), no dentro de sheetActions: así queda siempre a la
  // vista sin importar cuánto se despliegue o se pliegue la hoja.
  sheetPrimaryAction?: JSX.Element | null;
}): JSX.Element {
  // Alto en px para los desplazamientos de cámara (panBy). Cuando `height`
  // es "100%" (mapa a pantalla completa) no hay forma barata de conocer el
  // alto real desde JS sin un ResizeObserver, así que se usa una
  // aproximación fija: el efecto es puramente cosmético (deja al conductor
  // más abajo en el encuadre), no necesita ser exacto.
  const heightPx = typeof height === "number" ? height : 380;
  // Los rieles laterales (recalcular/navegar/silenciar + velocidad/informar)
  // necesitan ~190px de alto libre por encima de la hoja inferior. En el
  // mapa a pantalla completa (height="100%") ese espacio siempre está,
  // porque ActiveRideScreen le cede todo el alto disponible. Pero este mismo
  // componente también se usa como previsualización de alto fijo y chico
  // (la tarjeta "Viaje activo" de Mis viajes, 320px): ahí, en el peor caso
  // (banner de instrucciones expandido + aviso de fuera de Rapa Nui + GPS no
  // listo, todos a la vez), los rieles podían terminar solapando el propio
  // banner. En vez de adivinar ese peor caso con más números mágicos, en
  // previsualizaciones chicas se ocultan los controles secundarios: el mapa
  // sigue mostrando ruta, banner de instrucciones y hoja inferior (que sí
  // caben siempre), que es toda la información que aporta una vista previa.
  const isCompactPreview = typeof height === "number" && height < 360;

  /* ── Hoja inferior plegable ──────────────────────────────────────────────
     Mismo gesto que la hoja de Solicitar viaje (RequestRidePage): se mantiene
     apretada y se baja. Aquí la arquitectura es distinta —allá el mapa y la
     hoja se reparten el alto; aquí la hoja es un overlay absoluto sobre el
     mapa— así que la magnitud no es "cuánto se lleva el mapa" sino cuántos px
     está desplazada la hoja hacia abajo.

     Se mantiene la decisión de allá de NO tener un estado "plegada" aparte:
     una sola magnitud continua y la hoja se recorta sola al bajar. Si hubiera
     un booleano que ocultara el contenido, la hoja seguiría reservando su
     caja y quedaría un hueco vacío justo donde debe verse mapa. */
  const [sheetShift, setSheetShift] = useState(0);
  const [draggingSheet, setDraggingSheet] = useState(false);
  const navSheetRef = useRef<HTMLDivElement | null>(null);

  /* Recorrido real, MEDIDO del elemento en vez de supuesto. La hoja crece con
     su contenido (la distancia puede ocupar una línea o dos) y con
     `env(safe-area-inset-bottom)`, que vale distinto en cada aparato. En la
     hoja del pasajero, suponer este tope dejaba una zona muerta al final del
     recorrido donde el dedo seguía bajando y el panel ya no se movía; se
     siente exactamente como "no baja más". */
  const [sheetMaxShift, setSheetMaxShift] = useState(
    RAPAGO_NAV_SHEET_HEIGHT - RAPAGO_NAV_SHEET_GRIP_H,
  );

  /* La última posición aplicada vive en la ref y no en el estado: al soltar hay
     que decidir con el valor real del gesto, y el de React va un render por
     detrás. */
  const sheetDragRef = useRef<{
    startY: number;
    startShift: number;
    shift: number;
    lastY: number;
    lastT: number;
    velocity: number;
  } | null>(null);
  const sheetDraggedRef = useRef(false);

  /* Reposo actual de la hoja. `sheetShift` sigue siendo la única magnitud que
     se pinta —y de la que cuelgan los rieles—; el reposo sólo decide a qué
     valor vuelve al soltar. Antes había dos posiciones (arriba del todo o
     plegada); el intermedio existe porque en el estado "media" el conductor ve
     ETA, estado y la acción principal sin que los avisos le tapen medio mapa,
     que es donde pasa casi todo el viaje. */
  const [sheetSnap, setSheetSnap] = useState<NavSheetSnap>("half");

  const snapShift = useCallback(
    (snap: NavSheetSnap): number =>
      sheetMaxShift * RAPAGO_NAV_SHEET_SNAP_RATIO[snap],
    [sheetMaxShift],
  );

  const nearestSnap = useCallback(
    (shift: number): NavSheetSnap =>
      RAPAGO_NAV_SHEET_SNAP_ORDER.reduce((mejor, snap) =>
        Math.abs(snapShift(snap) - shift) < Math.abs(snapShift(mejor) - shift)
          ? snap
          : mejor,
      ),
    [snapShift],
  );

  /* Fuera del arrastre manda el reposo; durante el arrastre manda el dedo, así
     que el guard de `draggingSheet` no es cosmético: sin él la hoja pelearía
     contra el gesto en cada frame. */
  useEffect(() => {
    if (draggingSheet) return;

    setSheetShift(snapShift(sheetSnap));
  }, [draggingSheet, sheetSnap, snapShift]);

  /* Al cambiar la fase del viaje, la hoja vuelve al reposo intermedio. Es el
     único momento en que puede moverse sola sin traicionar al conductor: la
     acción principal acaba de cambiar ("Llegué al punto" → "Iniciar viaje") y
     si la hoja quedó plegada, el botón nuevo estaría fuera de vista justo
     cuando se vuelve relevante. Fuera de estas transiciones, plegar o abrir es
     siempre decisión suya. */
  useEffect(() => {
    if (isCompactPreview) return;

    setSheetSnap("half");
  }, [ride.status, isCompactPreview]);

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Mide el recorrido y lo mantiene al día: la hoja cambia de alto cuando
     llega la distancia de la ruta, y al girar el aparato. */
  useEffect(() => {
    const sheet = navSheetRef.current;
    if (isCompactPreview || !sheet || typeof ResizeObserver === "undefined") {
      return;
    }

    function medir(): void {
      const alto = sheet.getBoundingClientRect().height;
      setSheetMaxShift(Math.max(0, alto - RAPAGO_NAV_SHEET_GRIP_H));
      /* Los rieles laterales se anclan a la hoja. Antes usaban la constante
         RAPAGO_NAV_SHEET_HEIGHT (94), que dejó de ser cierta en cuanto la hoja
         empezó a llevar contenido dentro: los rieles quedaban por debajo de su
         borde real, encima de los botones. Se publica el alto MEDIDO para que
         CSS los coloque sin números supuestos. */
      sheet.parentElement?.style.setProperty("--rp-nav-sheet-h", `${alto}px`);
    }

    medir();
    const observer = new ResizeObserver(medir);
    observer.observe(sheet);
    return () => observer.disconnect();
  }, [isCompactPreview]);

  /* Si el recorrido se acorta (llegó la distancia y la hoja encogió), una
     posición vieja podría dejarla más abajo de lo que ahora se puede. */
  useEffect(() => {
    setSheetShift((actual) => Math.min(actual, sheetMaxShift));
  }, [sheetMaxShift]);

  const sheetBodyRef = useRef<HTMLDivElement | null>(null);

  /* Desde el cuerpo, el gesto sólo arrastra la hoja si el cuerpo YA está en su
     tope. Si está desplazado, el gesto es suyo: arrastrar la hoja mientras el
     conductor intenta leer un aviso la cerraría sin que él lo pidiera. Es la
     misma regla que usan las hojas nativas de iOS. */
  function handleSheetBodyPointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
  ): void {
    const body = sheetBodyRef.current;
    if (!body || body.scrollTop > 0) return;

    handleNavSheetPointerDown(event);
  }

  function handleNavSheetPointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
  ): void {
    if (isCompactPreview) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    sheetDragRef.current = {
      startY: event.clientY,
      startShift: sheetShift,
      shift: sheetShift,
      lastY: event.clientY,
      lastT: event.timeStamp,
      velocity: 0,
    };
    sheetDraggedRef.current = false;
    setDraggingSheet(true);
  }

  function handleNavSheetPointerMove(
    event: ReactPointerEvent<HTMLDivElement>,
  ): void {
    const drag = sheetDragRef.current;
    if (!drag) return;

    const delta = event.clientY - drag.startY;
    if (Math.abs(delta) > RAPAGO_NAV_SHEET_TAP_SLOP) {
      sheetDraggedRef.current = true;
    }

    /* Velocidad suavizada. Una sola muestra entre dos frames es muy ruidosa en
       táctil: un microtemblor del dedo justo al levantar dispararía un gesto
       rápido que el conductor no pidió. */
    const dt = Math.max(1, event.timeStamp - drag.lastT);
    const instantanea = (event.clientY - drag.lastY) / dt;
    drag.velocity = drag.velocity * 0.7 + instantanea * 0.3;
    drag.lastY = event.clientY;
    drag.lastT = event.timeStamp;

    const next = Math.min(
      sheetMaxShift,
      Math.max(0, drag.startShift + delta),
    );
    drag.shift = next;
    setSheetShift(next);
  }

  function handleNavSheetPointerUp(): void {
    const drag = sheetDragRef.current;
    sheetDragRef.current = null;
    setDraggingSheet(false);
    if (!drag) return;

    /* Sin arrastre real fue una pulsación: alterna entre ver todo y ver el
       máximo de mapa, que es lo que espera quien toca el asa en vez de
       arrastrarla. El reposo intermedio se alcanza arrastrando, no pulsando:
       un toque debe tener un resultado único y previsible. */
    if (!sheetDraggedRef.current) {
      setSheetSnap((actual) =>
        actual === "expanded" ? "collapsed" : "expanded",
      );
      return;
    }

    /* Gesto rápido: avanza un reposo en la dirección del dedo sin mirar cuánto
       recorrió. Un movimiento corto y veloz tiene una intención clara, y
       obligar a arrastrar hasta la posición exacta se siente pesado. */
    if (Math.abs(drag.velocity) > RAPAGO_NAV_SHEET_FLICK_VELOCITY) {
      const desde = RAPAGO_NAV_SHEET_SNAP_ORDER.indexOf(
        nearestSnap(drag.startShift),
      );
      const paso = drag.velocity > 0 ? 1 : -1;

      setSheetSnap(
        RAPAGO_NAV_SHEET_SNAP_ORDER[
          Math.min(
            RAPAGO_NAV_SHEET_SNAP_ORDER.length - 1,
            Math.max(0, desde + paso),
          )
        ],
      );
      return;
    }

    /* Arrastre lento: el conductor está colocando la hoja, así que se queda en
       el reposo más cercano a donde la dejó. */
    setSheetSnap(nearestSnap(drag.shift));
  }

  function handleNavSheetKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ): void {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;

    event.preventDefault();
    /* Un reposo por pulsación, no 12px sueltos: por teclado no hay forma de
       "colocar" una hoja a ojo, así que saltar entre posiciones nombradas es
       lo único que da un resultado predecible. Arriba abre, abajo pliega. */
    const paso = event.key === "ArrowUp" ? -1 : 1;
    setSheetSnap((actual) => {
      const desde = RAPAGO_NAV_SHEET_SNAP_ORDER.indexOf(actual);
      return RAPAGO_NAV_SHEET_SNAP_ORDER[
        Math.min(
          RAPAGO_NAV_SHEET_SNAP_ORDER.length - 1,
          Math.max(0, desde + paso),
        )
      ];
    });
  }

  const navSheetOpen = sheetSnap !== "collapsed";

  /* Los rieles laterales se anclan sobre la hoja, así que bajan con ella: si se
     quedaran fijos, plegar la hoja no daría mapa útil —solo dejaría un hueco
     entre los controles y el borde—, que es justo lo que el gesto busca. */
  const navRailBottom = isCompactPreview
    ? RAPAGO_NAV_RAIL_BOTTOM
    : `calc(var(--rp-nav-sheet-h, ${RAPAGO_NAV_SHEET_HEIGHT}px) + ${RAPAGO_NAV_RAIL_GAP}px - ${sheetShift}px)`;
  const navRailTransition =
    draggingSheet || prefersReducedMotion ? "none" : "bottom .22s ease";

  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const driverMarkerRef = useRef<google.maps.Marker | null>(null);
  const pickupMarkerRef = useRef<google.maps.Marker | null>(null);
  const destinationMarkerRef = useRef<google.maps.Marker | null>(null);

  const driverPointRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastGpsPointRef = useRef<{ lat: number; lng: number } | null>(null);
  const headingRef = useRef(0);
  const lastCameraAtRef = useRef(0);
  const didInitialCameraRef = useRef(false);
  const mapReadyRef = useRef(false);
  const lastSpokenInstructionRef = useRef("");
  const navigationCameraLockedRef = useRef(true);
  const manualCameraUnlockUntilRef = useRef(0);
  const routePathRef = useRef<Array<{ lat: number; lng: number }>>([]);
  const routeHeadingRef = useRef<number | null>(null);
  // Dueño de la ruta dibujada. La polyline sale siempre de aquí (caché local),
  // así que perder la conexión ya no borra nada de la pantalla.
  const routeControllerRef = useRef<RouteController | null>(null);
  const routeSnapshotHandlerRef = useRef<(snapshot: RouteSnapshot) => void>(() => {});

  const [driverGpsReady, setDriverGpsReady] = useState(false);
  const [driverOutsideRapaNui, setDriverOutsideRapaNui] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{
    duration: string;
    distance: string;
  } | null>(null);
  const [nextInstruction, setNextInstruction] = useState<{
    text: string;
    distance: string;
    maneuver: string | null;
    street?: string | null;
  } | null>(null);
  const [targetDistanceMeters, setTargetDistanceMeters] = useState<number | null>(null);
  // true mientras se navega con la última ruta guardada sin poder revalidarla.
  const [routeOffline, setRouteOffline] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [instructionBannerCollapsed, setInstructionBannerCollapsed] = useState(false);
  const [isNavigationCameraLocked, setIsNavigationCameraLocked] = useState(true);
  const [mapVoiceMuted, setMapVoiceMuted] = useState(true);
  const [speedKmh, setSpeedKmh] = useState<number | null>(null);
  const [googlePickupPoint, setGooglePickupPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [googleDestinationPoint, setGoogleDestinationPoint] = useState<{ lat: number; lng: number } | null>(null);

  const nav = extractRideNavigationPoints(ride.notes);
  const pickupAddress = extractConfirmedRideAddress(ride.notes, "origin");
  const destinationAddress = extractConfirmedRideAddress(ride.notes, "destination");

  const pickup =
    nav.pickupLat != null && nav.pickupLng != null
      ? { lat: nav.pickupLat, lng: nav.pickupLng }
      : googlePickupPoint;

  const destination =
    nav.destinationLat != null && nav.destinationLng != null
      ? { lat: nav.destinationLat, lng: nav.destinationLng }
      : googleDestinationPoint;
  const pickupDisplay = buildDriverPointDisplay({
    label: "Punto de recogida",
    text: ride.originText,
    address: pickupAddress,
    point: pickup,
  });
  const destinationDisplay = buildDriverPointDisplay({
    label: "Destino",
    text: ride.destinationText,
    address: destinationAddress,
    point: destination,
  });

  const rideNavigationRecord = ride as unknown as Record<string, unknown>;
  const rideStatus = String(rideNavigationRecord.status ?? ride.status ?? "").toLowerCase();

  // Estado efectivo para el mapa:
  // - Antes de iniciar viaje: ruta al punto de recogida.
  // - Después de iniciar viaje: ruta SIEMPRE al destino final.
  // Esto evita que el conductor tome la carrera y el mapa siga apuntando a la recogida.
  const tripAlreadyStarted =
    rideStatus === "in_progress" ||
    Boolean(rideNavigationRecord.startedAt) ||
    Boolean(rideNavigationRecord.tripStartedAt) ||
    Boolean(rideNavigationRecord.inProgressAt) ||
    Boolean(rideNavigationRecord.driverStartedTripAt) ||
    rideNavigationRecord.driverStartedTrip === true ||
    rideNavigationRecord.tripStarted === true;

  const goingToPickup = !tripAlreadyStarted && ["accepted", "driver_en_route"].includes(rideStatus);
  const waitingPassenger = !tripAlreadyStarted && rideStatus === "driver_arrived";
  const goingToDestination = tripAlreadyStarted;
  const [driverNoShowNowMs, setDriverNoShowNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!waitingPassenger) {
      return;
    }

    ensureDriverNoShowTimerStartMs(ride as DriverRideData & Record<string, unknown>);
    setDriverNoShowNowMs(Date.now());

    const interval = window.setInterval(() => setDriverNoShowNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [waitingPassenger, ride.id]);

  const driverNoShowState = waitingPassenger
    ? getDriverNoShowState(ride as DriverRideData & Record<string, unknown>, driverNoShowNowMs)
    : {
        allowed: false,
        remainingMs: RAPAGO_DRIVER_NO_SHOW_AFTER_ARRIVAL_MS,
        feeClp: getDriverRideNoShowFeeClp(ride as DriverRideData & Record<string, unknown>),
      };

  const target = goingToDestination
    ? destination
    : goingToPickup
      ? pickup
      : waitingPassenger
        ? pickup
        : destination;
  const currentPointDisplay = goingToDestination
    ? destinationDisplay
    : goingToPickup || waitingPassenger
      ? pickupDisplay
      : destinationDisplay;
  const targetLabel = currentPointDisplay.name;
  const targetZoneLabel = currentPointDisplay.zone;
  const finalDestinationLabel = destinationDisplay.name;
  const finalDestinationZoneLabel = destinationDisplay.zone;

  function updateNavigationCameraLock(next: boolean): void {
    navigationCameraLockedRef.current = next;
    if (next) manualCameraUnlockUntilRef.current = 0;
    setIsNavigationCameraLocked(next);
  }

  function buildGoogleMapsGeocodeQuery(
    textValue: string | null | undefined,
    confirmedAddress: string | null | undefined,
  ): string | null {
    const base = String(confirmedAddress || textValue || "").trim();
    if (!base) return null;

    const normalized = normalizeRapaNuiZoneText(base);
    const alreadyHasIsland =
      normalized.includes("rapa nui") ||
      normalized.includes("isla de pascua") ||
      normalized.includes("easter island") ||
      normalized.includes("hanga roa") ||
      normalized.includes("mataveri");

    return alreadyHasIsland
      ? `${base}, Chile`
      : `${base}, Hanga Roa, Rapa Nui, Valparaíso, Chile`;
  }

  async function resolvePointWithGoogleMaps(
    textValue: string | null | undefined,
    confirmedAddress: string | null | undefined,
  ): Promise<{ lat: number; lng: number } | null> {
    const query = buildGoogleMapsGeocodeQuery(textValue, confirmedAddress);
    if (!query) return null;

    await loadRapaGoGoogleMaps();
    if (!window.google?.maps?.Geocoder) return null;

    const geocoder = new google.maps.Geocoder();

    return new Promise((resolve) => {
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
  }

  function toRad(value: number): number {
    return (value * Math.PI) / 180;
  }

  function distanceMeters(
    a: { lat: number; lng: number },
    b: { lat: number; lng: number },
  ): number {
    const R = 6371000;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function bearingDegrees(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
  ): number {
    const lat1 = toRad(from.lat);
    const lat2 = toRad(to.lat);
    const dLng = toRad(to.lng - from.lng);
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x =
      Math.cos(lat1) * Math.sin(lat2) -
      Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  }

  function formatNavigationMeters(value: number | null): string {
    if (value == null || !Number.isFinite(value)) return "";
    if (value < 1000) return `${Math.max(10, Math.round(value / 10) * 10)} m`;
    return `${(value / 1000).toLocaleString("es-CL", {
      minimumFractionDigits: value < 10_000 ? 1 : 0,
      maximumFractionDigits: value < 10_000 ? 1 : 0,
    })} km`;
  }

  function maneuverArrow(maneuver: string | null | undefined): string {
    const raw = String(maneuver ?? "").toLowerCase();
    if (raw.includes("left")) return "↰";
    if (raw.includes("right")) return "↱";
    if (raw.includes("uturn")) return "↶";
    if (raw.includes("roundabout")) return "↻";
    if (raw.includes("merge")) return "⤴";
    if (raw.includes("fork")) return "⑂";
    if (raw.includes("ramp")) return "⤴";
    return "↑";
  }

  function arrivalInstructionText(distanceMeters: number | null): string | null {
    if (distanceMeters == null || !Number.isFinite(distanceMeters)) return null;

    const destinationName = goingToDestination
      ? `${destinationDisplay.name}, zona ${destinationDisplay.zone}`
      : goingToPickup || waitingPassenger
        ? `${pickupDisplay.name}, zona ${pickupDisplay.zone}`
        : `${destinationDisplay.name}, zona ${destinationDisplay.zone}`;

    if (distanceMeters <= 35) return `Llegaste a ${destinationName}.`;
    if (distanceMeters <= 100) return `En ${formatNavigationMeters(distanceMeters)} llegas a ${destinationName}.`;
    if (distanceMeters <= 200) return `Prepárate, en ${formatNavigationMeters(distanceMeters)} llegas a ${destinationName}.`;
    if (distanceMeters <= 500) return `Continúa, en ${formatNavigationMeters(distanceMeters)} llegas a ${destinationName}.`;

    return null;
  }

  function speakDriverNavigationInstruction(instruction: string): void {
    const text = instruction.trim();
    if (!text || text === lastSpokenInstructionRef.current) return;

    lastSpokenInstructionRef.current = text;

    try {
      if (!("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "es-CL";
      utterance.rate = 0.98;
      utterance.pitch = 1;
      utterance.volume = 0.88;
      window.speechSynthesis.speak(utterance);
    } catch {
      // La voz es opcional. La indicación visual se mantiene aunque el navegador bloquee audio.
    }
  }

  function distancePointToSegmentMeters(
    point: { lat: number; lng: number },
    a: { lat: number; lng: number },
    b: { lat: number; lng: number },
  ): number {
    const latScale = 111_320;
    const lngScale = 111_320 * Math.cos(toRad(point.lat));

    const px = point.lng * lngScale;
    const py = point.lat * latScale;
    const ax = a.lng * lngScale;
    const ay = a.lat * latScale;
    const bx = b.lng * lngScale;
    const by = b.lat * latScale;

    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;

    if (lengthSquared <= 0) return distanceMeters(point, a);

    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
    const closest = {
      lat: (ay + t * dy) / latScale,
      lng: (ax + t * dx) / lngScale,
    };

    return distanceMeters(point, closest);
  }

  function getDistanceToCurrentRouteMeters(point: { lat: number; lng: number }): number | null {
    const path = routePathRef.current;
    if (path.length < 2) return null;

    let best = Number.POSITIVE_INFINITY;
    for (let index = 0; index < path.length - 1; index += 1) {
      best = Math.min(best, distancePointToSegmentMeters(point, path[index], path[index + 1]));
    }

    return Number.isFinite(best) ? best : null;
  }

  function getRouteHeadingForPoint(point: { lat: number; lng: number }): number | null {
    const path = routePathRef.current;
    if (path.length < 2) return null;

    let bestIndex = 0;
    let best = Number.POSITIVE_INFINITY;

    for (let index = 0; index < path.length - 1; index += 1) {
      const meters = distancePointToSegmentMeters(point, path[index], path[index + 1]);
      if (meters < best) {
        best = meters;
        bestIndex = index;
      }
    }

    const from = path[bestIndex];
    const to = path[Math.min(path.length - 1, bestIndex + 1)];
    if (!from || !to || distanceMeters(from, to) < 1) return null;

    return bearingDegrees(from, to);
  }


  function focusNavigationCameraInsideApp(force = true): void {
    const map = mapRef.current;
    if (!map) return;

    const targetPoint = goingToDestination
      ? destination
      : goingToPickup || waitingPassenger
        ? pickup
        : destination;

    const driverPoint = driverPointRef.current;
    const focusPoint = driverPoint ?? targetPoint ?? pickup ?? destination;

    if (!focusPoint) return;

    updateNavigationCameraLock(true);
    didInitialCameraRef.current = true;
    lastCameraAtRef.current = Date.now();

    const cameraHeading =
      driverPoint
        ? routeHeadingRef.current ?? getRouteHeadingForPoint(driverPoint) ?? (targetPoint ? bearingDegrees(driverPoint, targetPoint) : headingRef.current)
        : headingRef.current;

    try {
      map.setZoom(18);
      map.panTo(focusPoint);

      // Efecto Google Maps: deja el conductor más abajo y muestra más ruta hacia adelante.
      window.setTimeout(() => {
        try {
          map.panBy(0, Math.round(heightPx * 0.16));
        } catch {
          // No bloquea la cámara si el navegador no soporta panBy en ese momento.
        }
      }, 90);

      map.setHeading(cameraHeading);
      map.setTilt(45);
    } catch {
      map.setZoom(18);
      map.panTo(focusPoint);
    }

    calculateRouteOnce();
  }

  function openExternalNavigationToTarget(): void {
    // La flecha verde ahora NO abre Google Maps externo.
    // Solo acerca y bloquea la cámara dentro del mapa de RAPA GO.
    focusNavigationCameraInsideApp(true);
  }

  function makeDriverIcon(heading: number): google.maps.Symbol {
    return {
      path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
      scale: 8,
      fillColor: "#2382ff",
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 4,
      rotation: heading,
    };
  }

  function makeCircleIcon(
    color: string,
    strokeColor = "#ffffff",
    scale = 15,
  ): google.maps.Symbol {
    return {
      path: google.maps.SymbolPath.CIRCLE,
      scale,
      fillColor: color,
      fillOpacity: 1,
      strokeColor,
      strokeWeight: 4,
    };
  }

  function setMarker(
    markerRef: { current: google.maps.Marker | null },
    point: { lat: number; lng: number } | null,
    options: google.maps.MarkerOptions,
  ): void {
    const map = mapRef.current;

    if (!map || !window.google?.maps || !point) {
      markerRef.current?.setMap(null);
      markerRef.current = null;
      return;
    }

    if (!markerRef.current) {
      markerRef.current = new google.maps.Marker({
        ...options,
        map,
        position: point,
      });
      return;
    }

    markerRef.current.setMap(map);
    markerRef.current.setPosition(point);
    markerRef.current.setOptions(options);
  }

  function followDriverCamera(
    point: { lat: number; lng: number },
    heading: number,
    force = false,
  ): void {
    const map = mapRef.current;
    if (!map) return;

    const now = Date.now();

    if (!force && !navigationCameraLockedRef.current) {
      // Si el conductor tocó/arrastró el mapa, dejamos revisar unos segundos.
      // Luego se vuelve a centrar solo para que no parezca pegado.
      if (manualCameraUnlockUntilRef.current && now >= manualCameraUnlockUntilRef.current) {
        updateNavigationCameraLock(true);
      } else {
        return;
      }
    }

    if (!force && now - lastCameraAtRef.current < 650) return;
    lastCameraAtRef.current = now;

    const currentZoom = map.getZoom() ?? 18;
    const navigationZoom = force ? 18 : Math.max(17, Math.min(19, currentZoom));

    if (!didInitialCameraRef.current || force || currentZoom < 17) {
      map.setZoom(navigationZoom);
      didInitialCameraRef.current = true;
    }

    map.panTo(point);

    // Igual que Google Maps: la flecha queda más abajo y se ve más camino por delante.
    window.setTimeout(() => {
      try {
        if (navigationCameraLockedRef.current || force) {
          map.panBy(0, Math.round(heightPx * 0.14));
        }
      } catch {
        // No bloquea seguimiento.
      }
    }, 70);

    const roadHeading = routeHeadingRef.current ?? getRouteHeadingForPoint(point) ?? heading;

    try {
      map.setHeading(roadHeading);
      map.setTilt(45);
    } catch {
      // Algunos navegadores no soportan heading/tilt en mapas raster.
    }
  }

  function moveDriverOnly(
    point: { lat: number; lng: number },
    heading: number,
  ): void {
    const map = mapRef.current;
    if (!map || !window.google?.maps) return;

    const roadHeading = routeHeadingRef.current ?? getRouteHeadingForPoint(point) ?? heading;

    setMarker(driverMarkerRef, point, {
      title: "Conductor",
      icon: makeDriverIcon(roadHeading),
      zIndex: 50,
    });

    followDriverCamera(point, roadHeading);
  }

  function drawStaticMarkers(): void {
    if (!mapRef.current || !window.google?.maps) return;

    setMarker(pickupMarkerRef, pickup, {
      title: `Recogida: ${pickupDisplay.name} · Zona ${pickupDisplay.zone}`,
      label: { text: "R", color: "#ffffff", fontSize: "13px", fontWeight: "900" },
      icon: makeCircleIcon("#22c55e", "#ffffff", 17),
      zIndex: 40,
    });

    setMarker(destinationMarkerRef, destination, {
      title: `Destino: ${destinationDisplay.name} · Zona ${destinationDisplay.zone}`,
      label: { text: "D", color: "#ffffff", fontSize: "13px", fontWeight: "900" },
      icon: makeCircleIcon("#ef4444", "#ffffff", 15),
      zIndex: 35,
    });
  }

  /**
   * Vuelca el estado del controlador en la UI.
   *
   * Todo lo que se muestra (distancia, ETA, instrucción) sale del progreso
   * calculado localmente sobre la polyline guardada, así que sigue vivo y
   * actualizándose aunque no haya señal.
   */
  function applyRouteSnapshot(snapshot: RouteSnapshot): void {
    routePathRef.current = routeControllerRef.current?.getPath() ?? [];

    if (snapshot.headingDegrees != null) {
      routeHeadingRef.current = snapshot.headingDegrees;
      headingRef.current = snapshot.headingDegrees;
    }

    setRouteOffline(snapshot.isStale || !snapshot.isOnline);

    if (!snapshot.route) {
      setRouteInfo(null);
      setTargetDistanceMeters(null);
      setNextInstruction(null);
      return;
    }

    const remaining = snapshot.remainingMeters ?? snapshot.route.distanceMeters;
    const driverPoint = driverPointRef.current;

    setTargetDistanceMeters(remaining);
    setRouteInfo({
      duration: formatNavigationDuration(snapshot.etaSeconds ?? snapshot.route.durationSeconds),
      distance: formatRouteMeters(remaining),
    });

    const arrivalText = arrivalInstructionText(remaining);

    if (arrivalText) {
      setNextInstruction({
        text: arrivalText,
        distance: formatRouteMeters(remaining),
        maneuver: "arrive",
        street: null,
      });
      return;
    }

    const step = snapshot.step;

    setNextInstruction(
      step
        ? {
            text: step.text,
            distance: formatRouteMeters(
              driverPoint
                ? distanceMeters(driverPoint, step.endLocation)
                : step.distanceMeters,
            ),
            maneuver: step.maneuver,
            street: step.street,
          }
        : null,
    );
  }

  // El controlador se crea una sola vez, así que su callback capturaría el
  // primer render para siempre. Se llama a través de esta ref para que use
  // siempre los valores actuales de la pantalla.
  routeSnapshotHandlerRef.current = applyRouteSnapshot;

  /**
   * Fija el destino activo. Ya no dispara una petición por sí misma: el
   * controlador dibuja desde la caché al instante y decide si vale la pena
   * ir a la red.
   */
  function calculateRouteOnce(): void {
    const controller = routeControllerRef.current;
    if (!controller) return;

    const currentTarget = goingToDestination
      ? destination
      : goingToPickup
        ? pickup
        : waitingPassenger
          ? destination ?? pickup
          : null;

    const driverPoint = driverPointRef.current;

    if (!currentTarget) {
      controller.setTarget(null, driverPoint);
      return;
    }

    const phase: RoutePhase = goingToDestination ? "to_destination" : "to_pickup";

    controller.setStrokeColor(goingToPickup ? "#06B6D4" : "#4F46E5");
    controller.setTarget(
      { rideId: ride.id, phase, destination: currentTarget },
      driverPoint,
    );
  }

  useEffect(() => {
    let cancelled = false;

    async function resolveMissingRoutePoints(): Promise<void> {
      try {
        const [resolvedPickup, resolvedDestination] = await Promise.all([
          nav.pickupLat != null && nav.pickupLng != null
            ? Promise.resolve(null)
            : resolvePointWithGoogleMaps(ride.originText, pickupAddress),
          nav.destinationLat != null && nav.destinationLng != null
            ? Promise.resolve(null)
            : resolvePointWithGoogleMaps(ride.destinationText, destinationAddress),
        ]);

        if (cancelled) return;

        if (resolvedPickup) setGooglePickupPoint(resolvedPickup);
        if (resolvedDestination) setGoogleDestinationPoint(resolvedDestination);

        if (!resolvedPickup && nav.pickupLat == null && nav.pickupLng == null) {
          setGooglePickupPoint(null);
        }
        if (!resolvedDestination && nav.destinationLat == null && nav.destinationLng == null) {
          setGoogleDestinationPoint(null);
        }
      } catch {
        if (!cancelled) {
          if (nav.pickupLat == null && nav.pickupLng == null) setGooglePickupPoint(null);
          if (nav.destinationLat == null && nav.destinationLng == null) setGoogleDestinationPoint(null);
        }
      }
    }

    void resolveMissingRoutePoints();

    return () => {
      cancelled = true;
    };
    // Geocodifica con Google Maps solo cuando faltan coordenadas en notes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ride.originText,
    ride.destinationText,
    pickupAddress,
    destinationAddress,
    nav.pickupLat,
    nav.pickupLng,
    nav.destinationLat,
    nav.destinationLng,
  ]);

  useEffect(() => {
    let cancelled = false;

    // Sube la ruta guardada a memoria antes de que el mapa exista, para que un
    // arranque en frío sin señal ya tenga qué dibujar.
    void hydrateRouteCache();

    void loadRapaGoGoogleMaps()
      .then(() => {
        if (cancelled || !mapElementRef.current || !window.google?.maps) return;

        const center = driverPointRef.current ??
          pickup ??
          destination ?? { lat: -27.1505, lng: -109.4325 };

        const map = new google.maps.Map(mapElementRef.current, {
          center,
          zoom: driverPointRef.current ? 18 : 14,
          mapTypeId: google.maps.MapTypeId.ROADMAP,
          disableDefaultUI: true,
          zoomControl: true,
          zoomControlOptions: {
            position: google.maps.ControlPosition.RIGHT_CENTER,
          },
          fullscreenControl: false,
          streetViewControl: false,
          mapTypeControl: false,
          clickableIcons: false,
          gestureHandling: "greedy",
          styles: [
            {
              featureType: "poi",
              elementType: "labels",
              stylers: [{ visibility: "on" }],
            },
            {
              featureType: "road",
              elementType: "geometry",
              stylers: [{ color: "#d4dbe7" }],
            },
            {
              featureType: "road",
              elementType: "labels.text.fill",
              stylers: [{ color: "#334155" }],
            },
            {
              featureType: "water",
              elementType: "geometry",
              stylers: [{ color: "#a8d7e8" }],
            },
            {
              featureType: "landscape",
              elementType: "geometry",
              stylers: [{ color: "#f3f4ef" }],
            },
          ],
        });

        mapRef.current = map;
        map.addListener("dragstart", () => {
          manualCameraUnlockUntilRef.current = Date.now() + 7000;
          updateNavigationCameraLock(false);
        });
        mapReadyRef.current = true;

        // Ya no se usa DirectionsRenderer: exige un DirectionsResult vivo y no
        // se puede rehidratar desde disco, así que mientras fuera la fuente de
        // verdad era imposible dibujar la ruta sin red.
        routeControllerRef.current = createRouteController({
          getMap: () => mapRef.current,
          strokeColor: "#4F46E5",
          strokeWeight: 9,
          onChange: (snapshot) => routeSnapshotHandlerRef.current(snapshot),
        });

        drawStaticMarkers();
        setMapReady(true);

        if (driverPointRef.current) {
          moveDriverOnly(driverPointRef.current, headingRef.current);
          calculateRouteOnce();
        } else {
          const bounds = new google.maps.LatLngBounds();
          if (pickup) bounds.extend(pickup);
          if (destination) bounds.extend(destination);
          if (!bounds.isEmpty()) map.fitBounds(bounds, 80);
        }
      })
      .catch(() => setMapError("No se pudo cargar Google Maps."));

    return () => {
      cancelled = true;
      mapReadyRef.current = false;
      routeControllerRef.current?.destroy();
      routeControllerRef.current = null;
    };
    // El mapa se crea una sola vez. No depende del GPS para evitar remounts/parpadeos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    drawStaticMarkers();
    calculateRouteOnce();
    // Solo recalcula cuando cambia el estado o el destino. Nunca en cada punto GPS.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ride.status,
    pickup?.lat,
    pickup?.lng,
    destination?.lat,
    destination?.lng,
  ]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setMapError(getDriverLocationMessage());
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const next = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        const previous = lastGpsPointRef.current;
        const moved = previous
          ? distanceMeters(previous, next)
          : Number.POSITIVE_INFINITY;

        // Filtra solo ruido mínimo del GPS. En Rapa Nui las calles son cortas, por eso seguimos movimientos desde 2 m.
        if (previous && moved < 2) return;

        if (previous && moved >= 2) {
          headingRef.current = bearingDegrees(previous, next);
        } else if (
          typeof position.coords.heading === "number" &&
          Number.isFinite(position.coords.heading)
        ) {
          headingRef.current = position.coords.heading;
        }

        lastGpsPointRef.current = next;
        driverPointRef.current = next;

        const rawSpeed = Number(position.coords.speed);
        setSpeedKmh(Number.isFinite(rawSpeed) && rawSpeed >= 0 ? Math.round(rawSpeed * 3.6) : null);

        publishDriverLiveLocationForPassenger(
          ride,
          {
            lat: next.lat,
            lng: next.lng,
            heading: headingRef.current,
            speed: Number.isFinite(Number(position.coords.speed))
              ? Number(position.coords.speed)
              : null,
            accuracy: Number.isFinite(Number(position.coords.accuracy))
              ? Number(position.coords.accuracy)
              : null,
          },
          headingRef.current,
          driverUser,
        );

        const ready = true;
        if (!driverGpsReady) setDriverGpsReady(ready);

        const outside = !isInsideRapaNui(next);
        if (outside !== driverOutsideRapaNui) setDriverOutsideRapaNui(outside);

        setMapError(null);

        // Punto azul + cámara: siempre usa el GPS real del conductor.
        // No se usa ninguna coordenada ficticia para simular que está en Rapa Nui.
        // Si Google Maps no puede calcular una ruta real, se muestra aviso y queda el botón de Google Maps.
        if (mapReadyRef.current) {
          // Modelo Waze: el GPS se proyecta sobre la polyline local y la
          // política decide si de verdad hace falta ir a la red. Antes esta
          // rama pedía una ruta nueva cada ~1,2 s.
          routeControllerRef.current?.updatePosition(next);

          const roadHeading =
            routeHeadingRef.current ?? getRouteHeadingForPoint(next) ?? headingRef.current;
          moveDriverOnly(next, roadHeading);

          // Si todavía no hay destino fijado (por ejemplo, el GPS llegó antes
          // que los puntos del viaje), se fija ahora sin forzar red.
          if (!routeControllerRef.current?.getPath().length) calculateRouteOnce();
        }
      },
      () => {
        setMapError(getDriverLocationMessage());
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
    // No incluimos driverGpsReady/driverOutsideRapaNui para no reiniciar watchPosition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        position: "relative",
        height,
        overflow: "hidden",
        borderRadius: "22px",
        background: "#f3f4ef",
      }}
    >
      <div
        ref={(el) => {
          mapElementRef.current = el;
        }}
        style={{ width: "100%", height: "100%" }}
      />

      {/* Panel superior estilo Google Maps: instrucción principal + siguiente maniobra */}
      <div
        style={{
          position: "absolute",
          left: "12px",
          right: "12px",
          top: "10px",
          background: "rgba(0, 105, 96, .96)",
          color: "#ffffff",
          borderRadius: "22px",
          boxShadow: "var(--rp-shadow)",
          overflow: "hidden",
          zIndex: "var(--rp-z-map-panel)",
          pointerEvents: "none",
        }}
      >
        <button
          type="button"
          onClick={() => setInstructionBannerCollapsed((prev) => !prev)}
          aria-label={instructionBannerCollapsed ? "Expandir indicaciones" : "Minimizar indicaciones"}
          style={{
            position: "absolute",
            right: 6,
            top: 6,
            width: 26,
            height: 26,
            borderRadius: 999,
            border: "0",
            background: "rgba(255,255,255,.16)",
            color: "#ffffff",
            fontSize: 14,
            lineHeight: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 13,
            pointerEvents: "auto",
          }}
        >
          {instructionBannerCollapsed ? "▾" : "▴"}
        </button>

        <div
          style={{
            minHeight: instructionBannerCollapsed ? 0 : 74,
            maxHeight: instructionBannerCollapsed ? 0 : undefined,
            padding: instructionBannerCollapsed ? "0 16px" : "12px 16px",
            overflow: "hidden",
            display: "grid",
            gridTemplateColumns: "48px 1fr",
            gap: 12,
            alignItems: "center",
            transition: "min-height .2s ease, max-height .2s ease, padding .2s ease",
          }}
        >
          {/* Flecha/bandera de maniobra: puramente visual. La misma información
              (hacia dónde va y por qué calle) ya se lee en el bloque de texto
              de al lado, así que para un lector de pantalla es ruido. */}
          <div
            aria-hidden="true"
            style={{
              fontSize: "2.25rem",
              fontWeight: 950,
              lineHeight: 1,
              textAlign: "center",
            }}
          >
            {nextInstruction?.maneuver === "arrive" ? <IonIcon icon={flagOutline} style={{ fontSize: "1em" }} /> : maneuverArrow(nextInstruction?.maneuver)}
          </div>

          {/* Región viva del estado de navegación: "hacia dónde vamos" y la
              calle cambian solo cuando cambia el tramo, así que avisar por
              aria-live aquí sí aporta. Sin aria-atomic: cada lector anuncia
              el fragmento que cambió (dirección o calle) en vez de repetir
              todo el bloque cada vez. */}
          <div aria-live="polite" style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: ".82rem",
                fontWeight: 850,
                color: "rgba(255,255,255,.82)",
                lineHeight: 1.1,
              }}
            >
              {goingToPickup
                ? "en dirección a la recogida"
                : waitingPassenger
                  ? "esperando en"
                  : "en dirección a"}
            </div>
            <div
              style={{
                marginTop: 2,
                fontSize: "1.38rem",
                lineHeight: 1.05,
                fontWeight: 950,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                letterSpacing: "-.02em",
              }}
            >
              {nextInstruction?.street || targetLabel || "Punto de ruta"}
            </div>
            {/* Duración/distancia se recalculan con cada punto de GPS: puestas
                dentro de la región viva de arriba, el lector anunciaría el
                tiempo restante varias veces por minuto. aria-live="off" las
                saca de esa región sin sacarlas del bloque visual. */}
            <div
              aria-live="off"
              style={{
                marginTop: 4,
                fontSize: ".78rem",
                fontWeight: 850,
                color: "rgba(255,255,255,.78)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {routeInfo?.duration ? `${routeInfo.duration}` : "Calculando ruta"}
              {routeInfo?.distance ? ` · ${routeInfo.distance}` : ""}
              {/* Sin conexión la ruta sigue en pantalla y la distancia sigue
                  bajando; solo se avisa que el tráfico no está actualizado. */}
              {routeOffline && routeInfo ? (
                <span style={{ color: "#fbbf24" }}> · sin conexión</span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Vista previa del siguiente giro ("Luego ..."). El contenedor queda
            SIEMPRE montado (se colapsa a 0 con padding/minHeight cuando no
            aplica) en vez de aparecer y desaparecer del DOM con el `&&`: una
            región aria-live que se crea de cero cada vez que cambia de
            maniobra no llega a anunciarse en varios lectores de pantalla,
            porque nunca la vieron "montada" para poder avisar del cambio. */}
        <div
          aria-live="polite"
          style={{
            background: "rgba(0, 72, 68, .92)",
            padding:
              !instructionBannerCollapsed && nextInstruction && nextInstruction.maneuver !== "arrive"
                ? "10px 16px"
                : 0,
            display: "flex",
            alignItems: "center",
            gap: 12,
            minHeight:
              !instructionBannerCollapsed && nextInstruction && nextInstruction.maneuver !== "arrive"
                ? 48
                : 0,
            overflow: "hidden",
          }}
        >
          {!instructionBannerCollapsed && nextInstruction && nextInstruction.maneuver !== "arrive" && (
            <>
              <span style={{ fontSize: "1.42rem", fontWeight: 950, lineHeight: 1 }}>
                Luego <span aria-hidden="true">{maneuverArrow(nextInstruction.maneuver)}</span>
              </span>
              <span
                style={{
                  minWidth: 0,
                  flex: 1,
                  fontSize: ".86rem",
                  fontWeight: 800,
                  color: "rgba(255,255,255,.84)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {nextInstruction.text}
              </span>
            </>
          )}
        </div>
      </div>

      {driverOutsideRapaNui && (
        <div
          role="status"
          aria-live="polite"
          className="rapago-driver-gps-chip rapago-driver-gps-chip--outside"
          style={{
            position: "absolute",
            left: "14px",
            top: instructionBannerCollapsed ? "56px" : nextInstruction ? "146px" : "96px",
            background: "rgba(239,68,68,.92)",
            color: "#ffffff",
            borderRadius: "999px",
            padding: "5px 9px",
            fontSize: ".64rem",
            fontWeight: 950,
            boxShadow: "0 6px 14px rgba(0,0,0,.20)",
            zIndex: "var(--rp-z-map-panel)",
            pointerEvents: "none",
          }}
        >
          GPS fuera de Rapa Nui
        </div>
      )}

      {!driverGpsReady && (
        <div
          role="status"
          aria-live="polite"
          className="rapago-driver-gps-chip rapago-driver-gps-chip--acquiring"
          style={{
            position: "absolute",
            left: "14px",
            right: "78px",
            top: instructionBannerCollapsed
              ? (driverOutsideRapaNui ? "88px" : "56px")
              : nextInstruction ? (driverOutsideRapaNui ? "178px" : "146px") : (driverOutsideRapaNui ? "128px" : "96px"),
            ...uberPanelStyle({
              background: "rgba(17,17,17,.82)",
              padding: "7px 10px",
              borderRadius: "999px",
              border: "1px solid rgba(239,68,68,.35)",
            }),
            color: "#F6F2EC",
            fontSize: ".70rem",
            fontWeight: 900,
            zIndex: "var(--rp-z-map-panel)",
            pointerEvents: "none",
          }}
        >
          <IonIcon icon={locationOutline} aria-hidden="true" style={{ fontSize: "1em", verticalAlign: "-0.125em" }} /> Activando GPS real...
        </div>
      )}

      {/* Rieles laterales y botón "Centrar": ocultos en previsualizaciones
          chicas (isCompactPreview) porque no tienen alto libre garantizado
          entre el banner de instrucciones y la hoja inferior. Ver el
          comentario de isCompactPreview más arriba. */}
      {!isCompactPreview && (
      <>
      {/* Riel derecho: acciones sobre el mapa. Ancladas desde ABAJO con la
          misma referencia que la hoja inferior (RAPAGO_NAV_RAIL_BOTTOM), no
          desde arriba: así nunca invaden la hoja sin importar el alto real
          del mapa en el teléfono del conductor. El gap del flex reemplaza los
          "top" sueltos de 130/194/264px que antes podían solaparse entre sí
          y con la hoja en pantallas más bajas. También quedan dentro del
          margen seguro lateral (env(safe-area-inset-right)), en vez de un
          "right:14px" fijo que en algunos recortes de viewport quedaba justo
          en el borde. */}
      <div
        style={{
          position: "absolute",
          right: "calc(14px + env(safe-area-inset-right, 0px))",
          bottom: navRailBottom,
          transition: navRailTransition,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          zIndex: "var(--rp-z-map-controls)",
        }}
      >
        <button
          type="button"
          onClick={() => {
            calculateRouteOnce();
            focusNavigationCameraInsideApp(true);
          }}
          style={{
            width: 52,
            height: 52,
            borderRadius: 999,
            border: "1px solid var(--rp-border-c)",
            background: "var(--rp-surface)",
            color: "var(--rp-icon-fg)",
            boxShadow: "var(--rp-shadow)",
            fontSize: 22,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          aria-label="Recalcular ruta"
        >
          <IonIcon icon={refreshOutline} aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={openExternalNavigationToTarget}
          style={{
            width: 58,
            height: 58,
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,.25)",
            background: "#00a884",
            color: "#ffffff",
            boxShadow: "0 12px 28px rgba(0,0,0,.42)",
            fontSize: 25,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          aria-label="Acercar mapa y seguir ruta dentro de Rapa Go"
        >
          <IonIcon icon={navigateOutline} aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => setMapVoiceMuted((current) => !current)}
          style={{
            width: 52,
            height: 52,
            borderRadius: 999,
            border: "1px solid var(--rp-border-c)",
            background: "var(--rp-surface)",
            color: "var(--rp-icon-fg)",
            boxShadow: "var(--rp-shadow)",
            fontSize: 21,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          /* Criterio de nombre para botones interruptor en toda esta pantalla:
             el aria-label describe la ACCIÓN que se ejecuta al tocar (mismo
             criterio que el botón de modo día/noche del encabezado), no el
             estado actual. Antes decía "Voz activada"/"Indicaciones visuales
             sin voz" -describiendo el estado-, inconsistente con el resto. */
          aria-label={mapVoiceMuted ? "Activar voz de las indicaciones" : "Silenciar voz de las indicaciones"}
        >
          {mapVoiceMuted ? <IonIcon icon={volumeMuteOutline} aria-hidden="true" /> : <IonIcon icon={volumeHighOutline} aria-hidden="true" />}
        </button>
      </div>

      {!isNavigationCameraLocked && (
        <button
          type="button"
          onClick={() => focusNavigationCameraInsideApp(true)}
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            bottom: navRailBottom,
            transition: navRailTransition,
            border: "1px solid var(--rp-border-c)",
            borderRadius: 999,
            background: "var(--rp-surface)",
            color: "var(--rp-ok-fg)",
            padding: "10px 16px",
            display: "flex",
            alignItems: "center",
            gap: 6,
            minHeight: 44,
            fontSize: ".78rem",
            fontWeight: 950,
            boxShadow: "var(--rp-shadow)",
            zIndex: "var(--rp-z-map-controls)",
          }}
        >
          <IonIcon icon={navigateOutline} aria-hidden="true" style={{ fontSize: "1.1em" }} /> Centrar
        </button>
      )}

      {/* Riel izquierdo: informaci\u00F3n pasiva (velocidad, aviso). No es
          interactivo (pointerEvents:none), as\u00ED que vive en su propia columna
          con gap real en vez de compartir esquina con los botones de acci\u00F3n
          del riel derecho. Antes "Informar" viv\u00EDa a la DERECHA, en la misma
          esquina que el bot\u00F3n de silenciar, y uno tapaba el final del otro. */}
      <div
        style={{
          position: "absolute",
          left: "calc(14px + env(safe-area-inset-left, 0px))",
          bottom: navRailBottom,
          transition: navRailTransition,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 10,
          zIndex: "var(--rp-z-map-panel)",
        }}
      >
        <div
          style={{
            width: 62,
            height: 62,
            borderRadius: 999,
            background: "var(--rp-surface)",
            border: "1px solid var(--rp-border-c)",
            color: "var(--rp-text)",
            boxShadow: "var(--rp-shadow)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 950,
            pointerEvents: "none",
          }}
        >
          {/* Sube de .64rem a .7rem: ning\u00FAn texto de esta pantalla debe quedar
              por debajo de ese piso, se lee de reojo y a un brazo de distancia. */}
          <div style={{ fontSize: "1.15rem", lineHeight: 1 }}>
            {speedKmh == null ? "--" : speedKmh}
          </div>
          <div style={{ fontSize: ".7rem", lineHeight: 1.1, color: "var(--rp-muted)" }}>km/h</div>
        </div>

        {/* Aqu\u00ED viv\u00EDa una p\u00EDldora "\u26A0 Informar" que NO era un bot\u00F3n: ten\u00EDa
            pointerEvents:none y no ejecutaba nada. Ocupaba una esquina del mapa
            aparentando ser tocable, que es peor que no estar. Informar una
            emergencia real se hace desde el SOS. */}
      </div>
      </>
      )}

      {/* Hoja inferior estilo navegación. Usa tokens --rp-* (no blanco fijo)
          para que siga data-rapago-theme: antes quedaba siempre blanca,
          pegada contra el panel de estado siempre oscuro que va debajo del
          mapa (uberPanelStyle) y contra el resto de la pantalla en modo
          noche, con un corte claro/oscuro muy visible. */}
      <div
        ref={navSheetRef}
        className="rapago-driver-nav-sheet"
        data-snap={sheetSnap}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          background: "var(--rp-surface)",
          color: "var(--rp-text)",
          borderTop: "1px solid var(--rp-border-c)",
          borderRadius: "26px 26px 0 0",
          minHeight: RAPAGO_NAV_SHEET_HEIGHT,
          /* Tope duro: la hoja nunca puede tapar el mapa entero, pase lo que
             pase con su contenido. Es un porcentaje del mapa —no dvh— porque
             el mapa ya está dentro del área útil que Ionic calcula descontando
             cabecera y tab bar; dvh mediría el viewport completo e ignoraría
             ambas, y además se re-resuelve en iOS al colapsar la barra de URL,
             lo que provocaría un reflow del mapa a mitad de arrastre. */
          maxHeight: "62%",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 -12px 34px rgba(0,0,0,.24)",
          zIndex: "var(--rp-z-map-sheet)",
          /* max() y no suma: --rp-driver-tabbar-clearance YA incluye el
             safe-area del aparato. Sumarlo otra vez lo contaría dos veces. */
          padding: "0 12px max(12px, var(--rp-driver-tabbar-clearance))",
          transform: `translateY(${sheetShift}px)`,
          /* Sin transición mientras se arrastra: el dedo ya marca el ritmo y
             animar encima se siente como retraso. */
          transition:
            draggingSheet || prefersReducedMotion
              ? "none"
              : "transform .22s ease",
        }}
      >
        {/* Asa. Los handlers de puntero van en la franja entera y no solo en el
            botón, para que el gesto se agarre con el pulgar sin apuntar. El
            botón de dentro es el que da el nombre accesible y la ruta por
            teclado. `touchAction: none` evita que el navegador interprete el
            arrastre vertical como desplazamiento de la página. */}
        {!isCompactPreview && (
          <div
            onPointerDown={handleNavSheetPointerDown}
            onPointerMove={handleNavSheetPointerMove}
            onPointerUp={handleNavSheetPointerUp}
            onPointerCancel={handleNavSheetPointerUp}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: RAPAGO_NAV_SHEET_GRIP_H,
              touchAction: "none",
              cursor: draggingSheet ? "grabbing" : "grab",
            }}
          >
            <button
              type="button"
              aria-expanded={navSheetOpen}
              aria-label={
                navSheetOpen
                  ? "Plegar el panel de ruta y ver más mapa. También puedes arrastrar esta barra."
                  : "Mostrar el panel de ruta. También puedes arrastrar esta barra."
              }
              onKeyDown={handleNavSheetKeyDown}
              style={{
                /* Se ve como una barrita fina, pero el objetivo táctil ocupa
                   los 34px de alto de la franja: se agranda con padding en vez
                   de engordar la barra. */
                border: "none",
                background: "transparent",
                padding: "12px 22px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "inherit",
              }}
            >
              <span
                aria-hidden="true"
                className="rapago-driver-nav-grip"
              />
            </button>
          </div>
        )}

        {/* Flota con position:absolute (ver CSS): así queda por encima de la
            franja del asa —que captura el gesto de arrastre en todo su
            ancho— sin competir por ese gesto ni depender del orden del DOM. */}
        {!isCompactPreview && sheetPrimaryAction}

        {/* Una sola columna. Antes esta franja llevaba dos botones de 58px a los
            lados del ETA: "soltar cámara" (✕) y "recentrar ruta".
            El ✕ desapareció porque soltar el seguimiento no es una intención
            del conductor sino el efecto de arrastrar el mapa, que ya ocurre
            solo; y su icono se leía como "cerrar la hoja", que no es lo que
            hacía. El de recentrar era el tercer control para la misma
            intención —ya está el botón verde del riel y la píldora Centrar—,
            así que se queda el del riel, donde el pulgar ya lo busca.
            Los 152px que ocupaban se los queda el ETA. */}
        <div
          style={{
            paddingTop: isCompactPreview ? 14 : 0,
          }}
        >
        <div className="rapago-driver-nav-eta" style={{ textAlign: "center", minWidth: 0 }}>
          {/* 2.4rem, no 1.95: con los dos botones de 58px fuera, el ETA deja de
              competir por el ancho y puede ser lo más grande de la hoja, que es
              lo que merece el dato que el conductor mira de reojo. */}
          <div className="rapago-driver-nav-eta__value">
            {routeInfo?.duration || "--"}
          </div>
          {/* Solo duración/distancia: el destino (targetLabel) ya aparece en
              el banner superior y en el panel de estado bajo el mapa.
              Repetirlo una tercera vez aquí solo restaba el poco alto
              vertical disponible en un teléfono. */}
          {/* Distancia con icono: el par «reloj grande + regla pequeña» deja
              claro de un vistazo cuál de los dos números es el tiempo y cuál
              el trayecto, sin tener que leer las unidades. */}
          <div className="rapago-driver-nav-eta__meta">
            <IonIcon icon={navigateOutline} aria-hidden="true" />
            <span>{routeInfo?.distance || "Calculando distancia"}</span>
          </div>
        </div>

        </div>

        {/* Estado del viaje. Zona fija, pegada al ETA: juntos responden las dos
            preguntas del conductor en movimiento ("qué estoy haciendo" y
            "cuánto falta") sin que ninguna se vaya con el scroll. */}
        {!isCompactPreview && sheetHeader && (
          <div style={{ flex: "0 0 auto", marginTop: 8 }}>{sheetHeader}</div>
        )}

        {/* Acciones principales ANTES que los avisos, y no al final. El orden
            del DOM decide qué sobrevive al plegado: la hoja se desplaza hacia
            abajo, así que lo último se oculta primero. Con las acciones al
            fondo, el reposo intermedio escondía justo los botones y dejaba a la
            vista los avisos, que es exactamente al revés de lo que necesita
            quien va conduciendo. */}
        {!isCompactPreview && sheetActions && (
          <div
            style={{
              flex: "0 0 auto",
              marginTop: 10,
              paddingTop: 10,
              borderTop: "1px solid var(--rp-border-c)",
            }}
          >
            {sheetActions}
          </div>
        )}

        {/* Avisos y acciones secundarias. ÚNICA zona con scroll de la hoja, y
            la primera en quedar fuera de vista al plegar — es información de
            consulta, no de conducción.
            `minHeight: 0` es imprescindible: sin él un hijo flex no encoge por
            debajo de su contenido y la hoja crecería sin tope, ignorando el
            maxHeight de arriba. `overscroll-behavior: contain` evita que al
            llegar al final el gesto se propague al mapa, que respondería con
            zoom o desplazamiento. */}
        {!isCompactPreview && sheetBody && (
          <div
            ref={sheetBodyRef}
            onPointerDown={handleSheetBodyPointerDown}
            onPointerMove={handleNavSheetPointerMove}
            onPointerUp={handleNavSheetPointerUp}
            onPointerCancel={handleNavSheetPointerUp}
            style={{
              flex: "1 1 auto",
              minHeight: 0,
              overflowY: "auto",
              overscrollBehavior: "contain",
              WebkitOverflowScrolling: "touch",
              /* pan-y explícito: el navegador se queda el desplazamiento
                 vertical y el código decide cuándo robárselo para arrastrar la
                 hoja (sólo con el cuerpo ya en su tope). */
              touchAction: "pan-y",
              marginTop: 10,
              paddingTop: 10,
              borderTop: "1px solid var(--rp-border-c)",
            }}
          >
            {sheetBody}
          </div>
        )}
      </div>

      {/* Único caso de la pantalla de mapa que corta la navegación de verdad
          (el GPS falló y no hay ruta que seguir): role="alert" -implícito
          aria-live="assertive"- es a propósito el único assertive de este
          componente. El resto de avisos usa "polite"/"status" para no
          interrumpir al conductor a cada rato. */}
      {mapError && (
        <div
          role="alert"
          className="active-ride-map-error"
          style={{
            position: "absolute",
            left: 14,
            right: 84,
            top: instructionBannerCollapsed
              ? (driverOutsideRapaNui ? 88 : 56)
              : nextInstruction ? (driverOutsideRapaNui ? 178 : 146) : (driverOutsideRapaNui ? 128 : 96),
            background: "rgba(17,17,17,.82)",
            color: "#fff",
            borderRadius: 999,
            padding: "7px 10px",
            fontSize: ".68rem",
            fontWeight: 900,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            zIndex: "var(--rp-z-map-alert)",
          }}
        >
          {mapError}
        </div>
      )}
    </div>
  );
}

function DriverRideMap({
  ride,
  height = 190,
}: {
  ride: {
    originText: string;
    destinationText: string;
    notes?: string | null;
    status: string;
  };
  height?: number;
}): JSX.Element {
  return <UberDriverNavigationMap ride={ride} height={height} />;
}

type DriverAvailability = "available" | "unavailable";

type DriverAvailabilityUser = {
  id?: string | null;
  userId?: string | null;
  email?: string | null;
  name?: string | null;
};

const DRIVER_AVAILABILITY_STORAGE_KEY = "rapago_driver_availability";
const DRIVER_AVAILABILITY_MAP_KEY = "rapago_driver_availability_by_driver";
const DRIVER_AVAILABILITY_EMAIL_KEY = "rapago_driver_availability_email";
const DRIVER_AVAILABILITY_NAME_KEY = "rapago_driver_availability_name";
const DRIVER_AVAILABILITY_SNAPSHOT_KEY = "rapago_driver_availability_snapshot";
const DRIVER_AVAILABILITY_EVENT = "rapago:driver-availability-changed";

const RAPAGO_DRIVER_LIVE_LOCATION_KEY = "rapago_driver_live_locations_v1";
const RAPAGO_DRIVER_LIVE_LOCATION_EVENT = "rapago:driver-live-location-updated";

type DriverLiveLocationPayload = {
  rideId: string;
  ownerKey?: string | null;
  driverOwnerKey?: string | null;
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  accuracy: number | null;
  updatedAt: string;
  status?: string | null;
  driverName?: string | null;
  driverFullName?: string | null;
  driverEmail?: string | null;
  driverPhone?: string | null;
  driverProfileImageDataUrl?: string | null;
  driverProfilePhotoUrl?: string | null;
  driverVehicleBrand?: string | null;
  driverVehicleModel?: string | null;
  driverVehicleColor?: string | null;
  driverVehiclePlate?: string | null;
  driverVehicleImageDataUrl?: string | null;
  driverVehicleImageName?: string | null;
  passengerFareType?: DriverPassengerFareType | null;
  farePassengerType?: DriverPassengerFareType | null;
  driverPassengerFareType?: DriverPassengerFareType | null;
  nationality?: string | null;
  driverNationality?: string | null;
  isResident?: boolean | null;
  driverIsResident?: boolean | null;
  // Aliases para que Mis Viajes del pasajero lea datos aunque venga de una versión anterior.
  vehicleBrand?: string | null;
  vehicleModel?: string | null;
  vehicleColor?: string | null;
  vehiclePlate?: string | null;
  vehicleImageDataUrl?: string | null;
  vehiclePhotoDataUrl?: string | null;
  originText?: string | null;
  destinationText?: string | null;
};

type DriverLiveGpsPoint = {
  lat: number;
  lng: number;
};

function distanceMetersForLiveDriverGps(a: DriverLiveGpsPoint, b: DriverLiveGpsPoint): number {
  const earthRadius = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

function bearingDegreesForLiveDriverGps(from: DriverLiveGpsPoint, to: DriverLiveGpsPoint): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const toDeg = (value: number) => (value * 180) / Math.PI;
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const dLng = toRad(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function getDriverLiveUserField(user: unknown, key: string): string | null {
  if (!user || typeof user !== "object") return null;
  const value = (user as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

type DriverPassengerFareType = "resident" | "chilean" | "foreigner";

function getDriverPassengerFareTypeLabel(type: DriverPassengerFareType): string {
  if (type === "resident") return "RAPA NUI / RESIDENTE RAPA NUI";
  if (type === "chilean") return "Turista chileno";
  return "Turista extranjero";
}

function normalizeDriverPassengerFareType(value: unknown): DriverPassengerFareType | null {
  const raw = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  if (!raw) return null;

  if (
    raw.includes("turista extranjero") ||
    raw.includes("extranj") ||
    raw.includes("foreigner") ||
    raw.includes("ingles") ||
    raw.includes("english")
  ) {
    return "foreigner";
  }

  if (
    raw.includes("turista chileno") ||
    raw.includes("chilena") ||
    raw.includes("chileno") ||
    raw.includes("chilean") ||
    raw.includes("no residente") ||
    raw.includes("no resident") ||
    raw === "cl" ||
    raw === "chile"
  ) {
    return "chilean";
  }

  if (
    raw.includes("rapa nui") ||
    raw.includes("resident") ||
    raw.includes("residente") ||
    raw === "true"
  ) {
    return "resident";
  }

  if (raw.includes("turista")) return "foreigner";

  return null;
}

function readStoredDriverPassengerFareType(user?: unknown): DriverPassengerFareType | null {
  const userData = user && typeof user === "object" ? (user as Record<string, unknown>) : {};

  if (userData.isResident === true || userData.driverIsResident === true) return "resident";

  const fromUser =
    normalizeDriverPassengerFareType(userData.farePassengerType) ??
    normalizeDriverPassengerFareType(userData.passengerFareType) ??
    normalizeDriverPassengerFareType(userData.driverPassengerFareType) ??
    normalizeDriverPassengerFareType(userData.passengerType) ??
    normalizeDriverPassengerFareType(userData.nationality) ??
    normalizeDriverPassengerFareType(userData.driverNationality) ??
    normalizeDriverPassengerFareType(userData.isResident) ??
    normalizeDriverPassengerFareType(userData.driverIsResident);

  if (fromUser) return fromUser;

  try {
    const registrationRaw =
      readDriverScopedStorageItem("rapago_driver_registration_profile", user) ??
      readDriverScopedStorageItem("rapago_registration_profile", user);

    const registration = registrationRaw
      ? (JSON.parse(registrationRaw) as Record<string, unknown>)
      : {};

    if (registration.isResident === true || registration.driverIsResident === true) {
      return "resident";
    }

    return (
      normalizeDriverPassengerFareType(registration.farePassengerType) ??
      normalizeDriverPassengerFareType(registration.passengerFareType) ??
      normalizeDriverPassengerFareType(registration.driverPassengerFareType) ??
      normalizeDriverPassengerFareType(registration.passengerType) ??
      normalizeDriverPassengerFareType(registration.nationality) ??
      normalizeDriverPassengerFareType(registration.passengerFareLabel) ??
      normalizeDriverPassengerFareType(registration.isResident) ??
      normalizeDriverPassengerFareType(readDriverScopedStorageItem("rapago_driver_passenger_fare_type", user)) ??
      normalizeDriverPassengerFareType(readDriverScopedStorageItem("rapago_driver_fare_passenger_type", user)) ??
      normalizeDriverPassengerFareType(readDriverScopedStorageItem("rapago_passenger_fare_type", user)) ??
      normalizeDriverPassengerFareType(readDriverScopedStorageItem("rapago_profile_passenger_type", user)) ??
      normalizeDriverPassengerFareType(readDriverScopedStorageItem("rapago_profile_nationality", user)) ??
      normalizeDriverPassengerFareType(readDriverScopedStorageItem("rapago_driver_nationality", user)) ??
      normalizeDriverPassengerFareType(readDriverScopedStorageItem("rapago_driver_is_resident", user))
    );
  } catch {
    return null;
  }
}

function buildDriverResidentFarePayload(user?: unknown): Record<string, unknown> {
  const fareType = readStoredDriverPassengerFareType(user);
  if (!fareType) return {};

  const label = getDriverPassengerFareTypeLabel(fareType);
  const isResident = fareType === "resident";

  return {
    passengerFareType: fareType,
    farePassengerType: fareType,
    driverPassengerFareType: fareType,
    driverFarePassengerType: fareType,
    passengerType: fareType,
    nationality: label,
    driverNationality: label,
    passengerFareLabel: label,
    isResident,
    driverIsResident: isResident,
    residenceVerificationStatus: isResident
      ? localStorage.getItem("rapago_residence_verification_status") ?? "pending"
      : "not_required",
  };
}

function persistDriverResidentFareForDriver(user?: unknown): void {
  const fareType = readStoredDriverPassengerFareType(user);
  if (!fareType) return;

  const label = getDriverPassengerFareTypeLabel(fareType);
  const isResident = fareType === "resident";

  try {
    writeDriverScopedStorageItem("rapago_driver_passenger_fare_type", fareType, user);
    writeDriverScopedStorageItem("rapago_driver_fare_passenger_type", fareType, user);
    writeDriverScopedStorageItem("rapago_driver_nationality", label, user);
    writeDriverScopedStorageItem("rapago_driver_is_resident", String(isResident), user);

    if (isResident) {
      writeDriverScopedStorageItem("rapago_passenger_fare_type", "resident", user);
      writeDriverScopedStorageItem("rapago_profile_passenger_type", "resident", user);
      writeDriverScopedStorageItem("rapago_fare_passenger_type", "resident", user);
      writeDriverScopedStorageItem("rapago_profile_nationality", label, user);
    }

    const raw = readDriverScopedStorageItem("rapago_registration_profile", user);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      writeDriverScopedStorageItem(
        "rapago_registration_profile",
        JSON.stringify({
          ...parsed,
          ownerKey: getDriverScopedOwnerKey(user ?? parsed),
          driverOwnerKey: getDriverScopedOwnerKey(user ?? parsed),
          passengerFareType: fareType,
          farePassengerType: fareType,
          passengerType: fareType,
          nationality: label,
          passengerFareLabel: label,
          isResident,
          driverPassengerFareType: fareType,
          driverNationality: label,
          driverIsResident: isResident,
        }),
        user ?? parsed,
      );
    }
  } catch {
    // No bloquea el perfil del conductor si localStorage falla.
  }
}

function getStoredDriverPublicPhone(user?: unknown): string | null {
  try {
    const keys = [
      "rapago_driver_phone",
      "rapago_profile_phone",
      "rapago_driver_public_phone",
    ];

    for (const key of keys) {
      const value = readDriverScopedStorageItem(key, user);
      if (value && value.trim()) return value.trim();
    }

    return null;
  } catch {
    return null;
  }
}

function readDriverLiveLocationMap(): Record<
  string,
  DriverLiveLocationPayload
> {
  try {
    const raw = localStorage.getItem(RAPAGO_DRIVER_LIVE_LOCATION_KEY);
    const parsed = raw
      ? (JSON.parse(raw) as Record<string, DriverLiveLocationPayload>)
      : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function publishDriverLiveLocationForPassenger(
  ride: {
    id?: string | null;
    status?: string | null;
    originText?: string | null;
    destinationText?: string | null;
  },
  point: {
    lat: number;
    lng: number;
    heading?: number | null;
    speed?: number | null;
    accuracy?: number | null;
  },
  heading: number | null,
  driverUser?: unknown,
): void {
  const rideId = String(ride.id ?? "").trim();
  const lat = Number(point.lat);
  const lng = Number(point.lng);

  if (!rideId || !Number.isFinite(lat) || !Number.isFinite(lng)) return;

  const selectedVehicle = readSelectedDriverVehicle(driverUser);

  const payload: DriverLiveLocationPayload = {
    rideId,
    ownerKey: getDriverVehicleOwnerKey(driverUser),
    driverOwnerKey: getDriverVehicleOwnerKey(driverUser),
    lat,
    lng,
    heading: Number.isFinite(Number(heading))
      ? Number(heading)
      : (point.heading ?? null),
    speed: Number.isFinite(Number(point.speed)) ? Number(point.speed) : null,
    accuracy: Number.isFinite(Number(point.accuracy))
      ? Number(point.accuracy)
      : null,
    updatedAt: new Date().toISOString(),
    status: ride.status ?? null,
    driverName:
      getDriverLiveUserField(driverUser, "name") ??
      getDriverLiveUserField(driverUser, "fullName") ??
      null,
    driverFullName:
      getDriverLiveUserField(driverUser, "fullName") ??
      getDriverLiveUserField(driverUser, "name") ??
      null,
    driverEmail: getDriverLiveUserField(driverUser, "email"),
    driverPhone:
      getDriverLiveUserField(driverUser, "phone") ??
      getDriverLiveUserField(driverUser, "phoneNumber") ??
      getDriverLiveUserField(driverUser, "mobile") ??
      getStoredDriverPublicPhone(driverUser),
    driverProfileImageDataUrl:
      getDriverLiveUserField(driverUser, "profilePhotoUrl") ??
      getDriverLiveUserField(driverUser, "driverProfileImageDataUrl") ??
      getStoredDriverProfilePhotoUrl(driverUser) ??
      null,
    driverProfilePhotoUrl:
      getDriverLiveUserField(driverUser, "profilePhotoUrl") ??
      getStoredDriverProfilePhotoUrl(driverUser) ??
      null,
    driverVehicleBrand: selectedVehicle?.brand ?? null,
    driverVehicleModel: selectedVehicle?.model ?? null,
    driverVehicleColor: selectedVehicle?.color ?? null,
    driverVehiclePlate: selectedVehicle?.plate ?? null,
    driverVehicleImageDataUrl:
      selectedVehicle?.imageDataUrl ?? getStoredDriverVehicleImageDataUrl(driverUser) ?? null,
    driverVehicleImageName: selectedVehicle?.imageName ?? getStoredDriverVehicleImageName(driverUser) ?? null,
    vehicleBrand: selectedVehicle?.brand ?? null,
    vehicleModel: selectedVehicle?.model ?? null,
    vehicleColor: selectedVehicle?.color ?? null,
    vehiclePlate: selectedVehicle?.plate ?? null,
    vehicleImageDataUrl:
      selectedVehicle?.imageDataUrl ?? getStoredDriverVehicleImageDataUrl(driverUser) ?? null,
    vehiclePhotoDataUrl:
      selectedVehicle?.imageDataUrl ?? getStoredDriverVehicleImageDataUrl(driverUser) ?? null,
    originText: ride.originText ?? null,
    destinationText: ride.destinationText ?? null,
    ...buildDriverResidentFarePayload(driverUser),
  };

  try {
    const map = readDriverLiveLocationMap();
    map[rideId] = payload;

    safeSetDriverLocalStorageItem(RAPAGO_DRIVER_LIVE_LOCATION_KEY, JSON.stringify(map));
    safeSetDriverLocalStorageItem(
      "rapago_current_driver_location",
      JSON.stringify(payload),
    );

    if (selectedVehicle) {
      const activeVehicleSnapshot = {
        ...selectedVehicle,
        ...getDriverVehiclePublicPayload(driverUser),
        driverName: payload.driverName,
        driverFullName: payload.driverFullName,
        driverEmail: payload.driverEmail,
        updatedAt: payload.updatedAt,
      };

      publishDriverVehicleSnapshotToStorage(activeVehicleSnapshot as Record<string, unknown>);
    }

    window.dispatchEvent(
      new CustomEvent(RAPAGO_DRIVER_LIVE_LOCATION_EVENT, {
        detail: payload,
      }),
    );
  } catch {
    // No bloquea la navegación del conductor si el navegador no permite guardar.
  }
}

function clearDriverLiveLocationForPassenger(rideId: string): void {
  try {
    const map = readDriverLiveLocationMap();
    delete map[rideId];

    localStorage.setItem(RAPAGO_DRIVER_LIVE_LOCATION_KEY, JSON.stringify(map));

    const currentRaw = localStorage.getItem("rapago_current_driver_location");
    const current = currentRaw
      ? (JSON.parse(currentRaw) as { rideId?: string | null })
      : null;

    if (current?.rideId === rideId) {
      localStorage.removeItem("rapago_current_driver_location");
    }

    window.dispatchEvent(
      new CustomEvent(RAPAGO_DRIVER_LIVE_LOCATION_EVENT, {
        detail: { rideId, cleared: true },
      }),
    );
  } catch {
    // No bloquea cierre/cancelación.
  }
}

function normalizeDriverAvailability(
  value: unknown,
): DriverAvailability | null {
  const raw = String(value ?? "")
    .toLowerCase()
    .trim();
  if (
    raw === "unavailable" ||
    raw === "no_disponible" ||
    raw === "no disponible" ||
    raw === "offline"
  )
    return "unavailable";
  if (raw === "available" || raw === "disponible" || raw === "online")
    return "available";
  return null;
}

function getDriverAvailabilityUser(user: unknown): DriverAvailabilityUser {
  if (!user || typeof user !== "object") return {};
  return user as DriverAvailabilityUser;
}

function getDriverAvailabilityKeys(user: unknown): string[] {
  const data = getDriverAvailabilityUser(user);

  return [
    data.id,
    data.userId,
    data.email,
    data.email?.toLowerCase(),
    data.name,
    data.name?.toLowerCase(),
  ]
    .filter((value): value is string => Boolean(value && value.trim()))
    .map((value) => value.trim());
}

function readDriverAvailability(user?: unknown): DriverAvailability {
  try {
    const rawMap = localStorage.getItem(DRIVER_AVAILABILITY_MAP_KEY);
    const map = rawMap ? (JSON.parse(rawMap) as Record<string, string>) : {};

    for (const key of getDriverAvailabilityKeys(user)) {
      const mapped = normalizeDriverAvailability(map[key]);
      if (mapped) return mapped;
    }

    return (
      normalizeDriverAvailability(
        localStorage.getItem(DRIVER_AVAILABILITY_STORAGE_KEY),
      ) ?? "available"
    );
  } catch {
    return "available";
  }
}

function saveDriverAvailability(
  value: DriverAvailability,
  user?: unknown,
): void {
  const data = getDriverAvailabilityUser(user);
  const keys = getDriverAvailabilityKeys(user);

  try {
    localStorage.setItem(DRIVER_AVAILABILITY_STORAGE_KEY, value);

    if (data.email)
      localStorage.setItem(
        DRIVER_AVAILABILITY_EMAIL_KEY,
        data.email.toLowerCase().trim(),
      );
    if (data.name)
      localStorage.setItem(
        DRIVER_AVAILABILITY_NAME_KEY,
        data.name.toLowerCase().trim(),
      );

    const rawMap = localStorage.getItem(DRIVER_AVAILABILITY_MAP_KEY);
    const map = rawMap ? (JSON.parse(rawMap) as Record<string, string>) : {};

    for (const key of keys) {
      map[key] = value;
    }

    localStorage.setItem(DRIVER_AVAILABILITY_MAP_KEY, JSON.stringify(map));

    const rawSnapshot = localStorage.getItem(DRIVER_AVAILABILITY_SNAPSHOT_KEY);
    const snapshot = rawSnapshot
      ? (JSON.parse(rawSnapshot) as Record<
          string,
          {
            value: DriverAvailability;
            updatedAt: string;
            email?: string | null;
            name?: string | null;
            keys?: string[];
          }
        >)
      : {};

    const snapshotRecord = {
      value,
      updatedAt: new Date().toISOString(),
      email: data.email?.toLowerCase().trim() ?? null,
      name: data.name?.toLowerCase().trim() ?? null,
      keys,
    };

    for (const key of keys) {
      snapshot[key] = snapshotRecord;
    }

    if (data.email) snapshot[data.email.toLowerCase().trim()] = snapshotRecord;
    if (data.name) snapshot[data.name.toLowerCase().trim()] = snapshotRecord;

    localStorage.setItem(
      DRIVER_AVAILABILITY_SNAPSHOT_KEY,
      JSON.stringify(snapshot),
    );
  } catch {
    // No bloquea la app si localStorage no está disponible.
  }

  window.dispatchEvent(
    new CustomEvent(DRIVER_AVAILABILITY_EVENT, {
      detail: {
        value,
        keys,
        email: data.email ?? null,
        name: data.name ?? null,
      },
    }),
  );
}

const DRIVER_HOME_STYLES = String.raw`
  .driver-home-page {
    --driver-ink: #171412;
    --driver-volcanic: #1a1a1a;
    --driver-gold: #c89b3c;
    --driver-gold-soft: #e8c86d;
    --driver-sand: #d9c3a0;
    --driver-ivory: #fffaf0;
    --driver-terracotta: #b84f2e;
    --driver-green: #138a4a;
    --driver-red: #b42318;
  }

  .driver-home-toolbar {
    --background: linear-gradient(115deg, #171412 0%, #2d2119 54%, #a63f25 100%) !important;
    --color: #fffaf0 !important;
    --border-width: 0 !important;
    --min-height: 72px !important;
    border-bottom: 1px solid rgba(232, 200, 109, 0.34) !important;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.24);
  }

  .driver-home-toolbar ion-title {
    color: #fffaf0 !important;
    padding-inline: 18px 110px !important;
  }

  .driver-home-brand {
    display: flex;
    align-items: center;
    gap: 11px;
    min-width: 0;
  }

  .driver-home-brand__mark {
    width: 42px;
    height: 42px;
    border-radius: 15px;
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    background: linear-gradient(145deg, #e8c86d, #c89b3c);
    color: #171412;
    box-shadow: 0 8px 22px rgba(200, 155, 60, 0.32);
    border: 1px solid rgba(255, 250, 240, 0.45);
  }

  .driver-home-brand__mark ion-icon {
    font-size: 23px;
  }

  .driver-home-brand__text {
    min-width: 0;
  }

  .driver-home-brand__title {
    color: #fffaf0 !important;
    font-size: 1.08rem;
    line-height: 1.05;
    font-weight: 950;
    letter-spacing: 0.01em;
  }

  .driver-home-brand__subtitle {
    margin-top: 3px;
    color: rgba(255, 250, 240, 0.76) !important;
    font-size: 0.68rem;
    line-height: 1;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .driver-home-header-actions {
    gap: 4px;
    padding-right: 8px;
  }

  .driver-home-header-action {
    width: 43px;
    height: 43px;
    margin: 0 !important;
    --border-radius: 14px !important;
    --background: rgba(255, 250, 240, 0.11) !important;
    --background-hover: rgba(255, 250, 240, 0.18) !important;
    --background-activated: rgba(255, 250, 240, 0.22) !important;
    --color: #fffaf0 !important;
    --box-shadow: none !important;
    border: 1px solid rgba(255, 250, 240, 0.18);
    border-radius: 14px;
  }

  .driver-home-header-action ion-icon {
    color: #fffaf0 !important;
    font-size: 21px;
  }

  .driver-home-content {
    --background:
      linear-gradient(180deg, rgba(18, 17, 16, 0.82), rgba(18, 17, 16, 0.96)),
      url('/assets/rapa-go-bg.jpg') center / cover no-repeat fixed !important;
  }

  .driver-home-content::part(scroll) {
    padding: 18px 16px calc(108px + env(safe-area-inset-bottom));
  }

  .driver-home-shell {
    width: min(100%, 1040px);
    margin: 0 auto;
  }

  .rapago-connectivity-banner {
    position: relative;
    z-index: 2;
    width: 100%;
    min-height: 96px;
    margin: 4px 0 16px;
    padding: 16px;
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr);
    gap: 12px;
    align-items: start;
    overflow: visible;
    border-radius: 22px;
    color: #ffffff !important;
    border: 1px solid rgba(255, 255, 255, 0.16);
    box-shadow: 0 16px 34px rgba(0, 0, 0, 0.30);
  }

  .rapago-connectivity-banner.is-checking {
    background: linear-gradient(135deg, #1f2937, #334155);
  }

  .rapago-connectivity-banner.is-offline {
    background: linear-gradient(135deg, #321a18, #8d1d1d);
  }

  .rapago-connectivity-banner.is-poor {
    background: linear-gradient(135deg, #352019, #9a4828);
  }

  .rapago-connectivity-banner__icon {
    width: 44px;
    height: 44px;
    border-radius: 15px;
    display: grid;
    place-items: center;
    background: rgba(255, 255, 255, 0.14);
    color: #ffffff !important;
    font-size: 1.2rem;
    font-weight: 950;
  }

  .rapago-connectivity-banner__copy,
  .rapago-connectivity-banner__title,
  .rapago-connectivity-banner__message {
    color: #ffffff !important;
  }

  .rapago-connectivity-banner__title {
    font-size: 0.98rem;
    line-height: 1.2;
    font-weight: 950;
  }

  .rapago-connectivity-banner__message {
    margin-top: 6px;
    font-size: 0.82rem;
    line-height: 1.46;
    font-weight: 800;
    opacity: 1;
    overflow-wrap: anywhere;
  }

  .driver-availability-panel {
    margin-bottom: 15px;
    padding: 15px;
    border-radius: 24px;
    color: #171412;
    background: linear-gradient(145deg, #fffdf7 0%, #f5ead8 100%);
    border: 1px solid rgba(200, 155, 60, 0.35);
    box-shadow: 0 18px 42px rgba(0, 0, 0, 0.24);
  }

  .driver-availability-panel__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }

  .driver-availability-panel__eyebrow {
    color: #775a24;
    font-size: 0.68rem;
    line-height: 1;
    font-weight: 950;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .driver-availability-panel__title {
    margin-top: 4px;
    color: #171412;
    font-size: 1rem;
    line-height: 1.1;
    font-weight: 950;
  }

  .driver-availability-panel__status {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 7px 10px;
    flex: 0 0 auto;
    border-radius: 999px;
    color: #171412;
    background: rgba(255, 255, 255, 0.72);
    border: 1px solid rgba(23, 20, 18, 0.1);
    font-size: 0.7rem;
    font-weight: 950;
  }

  .driver-availability-panel__dot {
    width: 9px;
    height: 9px;
    border-radius: 999px;
  }

  .driver-availability-panel__dot.is-available {
    background: #16a45b;
    box-shadow: 0 0 0 5px rgba(22, 164, 91, 0.14);
  }

  .driver-availability-panel__dot.is-unavailable {
    background: #d13c30;
    box-shadow: 0 0 0 5px rgba(209, 60, 48, 0.14);
  }

  .driver-availability-panel__grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .driver-availability-button {
    min-height: 50px;
    padding: 10px 12px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border-radius: 16px;
    border: 1px solid rgba(23, 20, 18, 0.12);
    font: inherit;
    font-size: 0.88rem;
    font-weight: 950;
    line-height: 1.1;
    cursor: pointer;
    transition: transform 160ms ease, box-shadow 160ms ease, background 160ms ease;
    -webkit-tap-highlight-color: transparent;
  }

  .driver-availability-button:active {
    transform: scale(0.985);
  }

  .driver-availability-button.is-inactive {
    color: #332d28;
    background: #ffffff;
    box-shadow: inset 0 0 0 1px rgba(200, 155, 60, 0.08);
  }

  .driver-availability-button.is-active.is-available {
    color: #ffffff;
    background: linear-gradient(135deg, #149b50, #0c743b);
    border-color: rgba(12, 116, 59, 0.52);
    box-shadow: 0 10px 24px rgba(20, 155, 80, 0.28);
  }

  .driver-availability-button.is-active.is-unavailable {
    color: #ffffff;
    background: linear-gradient(135deg, #cf3d30, #92271f);
    border-color: rgba(146, 39, 31, 0.52);
    box-shadow: 0 10px 24px rgba(180, 35, 24, 0.24);
  }

  .driver-availability-button ion-icon {
    color: inherit !important;
    font-size: 19px;
  }

  .driver-home-hero {
    position: relative;
    isolation: isolate;
    overflow: hidden;
    min-height: 190px;
    padding: 20px;
    border-radius: 28px;
    color: #fffaf0;
    background:
      radial-gradient(circle at 88% 8%, rgba(232, 200, 109, 0.35), transparent 30%),
      linear-gradient(135deg, #171412 0%, #32251c 54%, #a94429 100%);
    border: 1px solid rgba(232, 200, 109, 0.34);
    box-shadow: 0 24px 54px rgba(0, 0, 0, 0.36);
  }

  .driver-home-hero::before,
  .driver-home-hero::after {
    content: '';
    position: absolute;
    z-index: -1;
    border-radius: 999px;
    pointer-events: none;
  }

  .driver-home-hero::before {
    width: 190px;
    height: 190px;
    right: -72px;
    top: -78px;
    background: rgba(255, 250, 240, 0.09);
  }

  .driver-home-hero::after {
    width: 130px;
    height: 130px;
    right: 65px;
    bottom: -88px;
    background: rgba(200, 155, 60, 0.14);
  }

  .driver-home-hero__top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .driver-home-hero__eyebrow {
    color: #e8c86d;
    font-size: 0.7rem;
    line-height: 1;
    font-weight: 950;
    letter-spacing: 0.11em;
    text-transform: uppercase;
  }

  .driver-home-hero__title {
    margin-top: 7px;
    color: #fffaf0;
    font-size: clamp(1.45rem, 4.4vw, 2rem);
    line-height: 1.04;
    font-weight: 950;
    letter-spacing: -0.025em;
  }

  .driver-home-hero__subtitle {
    max-width: 520px;
    margin-top: 7px;
    color: rgba(255, 250, 240, 0.78);
    font-size: 0.82rem;
    line-height: 1.4;
    font-weight: 750;
  }

  .driver-home-hero__car {
    width: 58px;
    height: 58px;
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    border-radius: 19px;
    color: #171412;
    background: linear-gradient(145deg, #f1d77f, #c89b3c);
    border: 1px solid rgba(255, 250, 240, 0.46);
    box-shadow: 0 14px 28px rgba(0, 0, 0, 0.25);
  }

  .driver-home-hero__car ion-icon {
    color: #171412 !important;
    font-size: 30px;
  }

  .driver-home-section {
    margin-top: 22px;
  }

  .driver-home-section__header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }

  .driver-home-section__hint {
    color: rgba(255, 250, 240, 0.62);
    font-size: 0.7rem;
    font-weight: 750;
  }

  .driver-home-cta {
    margin-top: 18px;
    padding: 17px;
    display: grid;
    grid-template-columns: 48px minmax(0, 1fr) auto;
    gap: 13px;
    align-items: center;
    border-radius: 23px;
    color: #fffaf0;
    background: linear-gradient(135deg, #171412 0%, #3b2b20 56%, #a94429 100%);
    border: 1px solid rgba(232, 200, 109, 0.3);
    box-shadow: 0 18px 42px rgba(0, 0, 0, 0.28);
  }

  .driver-home-cta__icon {
    width: 48px;
    height: 48px;
    display: grid;
    place-items: center;
    border-radius: 16px;
    color: #171412;
    background: linear-gradient(145deg, #e8c86d, #c89b3c);
  }

  .driver-home-cta__icon ion-icon {
    color: #171412 !important;
    font-size: 24px;
  }

  .driver-home-cta__title {
    color: #fffaf0;
    font-size: 0.92rem;
    line-height: 1.15;
    font-weight: 950;
  }

  .driver-home-cta__copy {
    margin-top: 4px;
    color: rgba(255, 250, 240, 0.7);
    font-size: 0.73rem;
    line-height: 1.35;
    font-weight: 750;
  }

  .driver-home-cta__button {
    min-height: 42px;
    padding: 9px 15px;
    border: 0;
    border-radius: 999px;
    color: #171412;
    background: #fffaf0;
    font: inherit;
    font-size: 0.78rem;
    font-weight: 950;
    cursor: pointer;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
  }

  @media (hover: hover) {
    .driver-availability-button:hover,
    .driver-home-cta__button:hover {
      transform: translateY(-1px);
    }
  }

  @media (max-width: 620px) {
    .rapago-connectivity-banner {
      min-height: 104px;
      margin-top: 2px;
      padding: 15px 14px;
      grid-template-columns: 42px minmax(0, 1fr);
      gap: 11px;
      border-radius: 20px;
    }

    .rapago-connectivity-banner__icon {
      width: 42px;
      height: 42px;
    }

    .rapago-connectivity-banner__title {
      font-size: 0.94rem;
    }

    .rapago-connectivity-banner__message {
      font-size: 0.8rem;
      line-height: 1.5;
    }

    .driver-home-content::part(scroll) {
      padding: 14px 12px calc(104px + env(safe-area-inset-bottom));
    }

    .driver-home-toolbar ion-title {
      padding-inline: 12px 102px !important;
    }

    .driver-home-brand__mark {
      width: 39px;
      height: 39px;
      border-radius: 14px;
    }

    .driver-home-brand__title {
      font-size: 1rem;
    }

    .driver-home-brand__subtitle {
      font-size: 0.61rem;
    }

    .driver-home-header-action {
      width: 40px;
      height: 40px;
    }

    .driver-home-hero {
      padding: 18px;
      border-radius: 24px;
    }

    .driver-home-cta {
      grid-template-columns: 44px minmax(0, 1fr);
    }

    .driver-home-cta__icon {
      width: 44px;
      height: 44px;
    }

    .driver-home-cta__button {
      grid-column: 1 / -1;
      width: 100%;
    }
  }

  @media (max-width: 370px) {
    .driver-availability-panel {
      padding: 13px;
      border-radius: 21px;
    }

    .driver-availability-panel__status {
      padding: 6px 8px;
      font-size: 0.64rem;
    }

    .driver-availability-button {
      min-height: 48px;
      padding: 8px;
      font-size: 0.78rem;
    }
  }
`;

function DriverHeaderWithoutNotifications({
  driverName,
  isDark,
  onToggleTheme,
}: {
  driverName: string;
  isDark: boolean;
  onToggleTheme: () => void;
}): JSX.Element {
  const auth = useAuth() as ReturnType<typeof useAuth> & {
    logout?: () => void | Promise<void>;
    signOut?: () => void | Promise<void>;
  };
  const history = useHistory();

  async function handleLogout(): Promise<void> {
    try {
      if (typeof auth.logout === "function") {
        await auth.logout();
      } else if (typeof auth.signOut === "function") {
        await auth.signOut();
      } else {
        localStorage.removeItem("rapago_session");
        localStorage.removeItem("rapago_auth_session");
        localStorage.removeItem("auth_session");
        sessionStorage.clear();
      }
    } finally {
      history.replace(ROUTES.AUTH.LOGIN);
    }
  }

  return (
    <IonHeader className="driver-home-header">
      <IonToolbar className="driver-home-toolbar">
        <div slot="start" className="driver-home-brand">
          <div className="driver-home-brand__mark" aria-hidden="true">
            <img
              src={logoRapago}
              alt=""
              width={50}
              height={50}
            />
          </div>
          <div className="driver-home-brand__text">
            <div className="driver-home-brand__title">Hola, {driverName}</div>
            <div className="driver-home-brand__subtitle">Panel conductor</div>
          </div>
        </div>

        <IonButtons slot="end" className="driver-home-header-actions">
          <IonButton
            fill="clear"
            onClick={onToggleTheme}
            aria-label={isDark ? "Activar modo día" : "Activar modo nocturno"}
            title={isDark ? "Modo día" : "Modo nocturno"}
            className="driver-home-header-action"
          >
            <IonIcon
              icon={isDark ? sunnyOutline : moonOutline}
              slot="icon-only"
            />
          </IonButton>

          <IonButton
            fill="clear"
            routerLink={ROUTES.DRIVER.PROFILE}
            aria-label="Abrir perfil del conductor"
            className="driver-home-header-action"
          >
            <IonIcon icon={personOutline} slot="icon-only" />
          </IonButton>

          <IonButton
            fill="clear"
            onClick={() => void handleLogout()}
            aria-label="Cerrar sesión"
            className="driver-home-header-action"
          >
            <IonIcon icon={logOutOutline} slot="icon-only" />
          </IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>
  );
}

function DriverAvailabilityControl({
  value,
  onChange,
  disabled = false,
}: {
  value: DriverAvailability;
  onChange: (value: DriverAvailability) => void | Promise<void>;
  disabled?: boolean;
}): JSX.Element {
  const isAvailable = value === "available";

  return (
    <section className="driver-availability-panel" aria-label="Estado del conductor">
      <div className="driver-availability-panel__header">
        <div>
          <div className="driver-availability-panel__eyebrow">Conexión de trabajo</div>
          <div className="driver-availability-panel__title">Estado del conductor</div>
        </div>

        <div className="driver-availability-panel__status">
          <span
            className={`driver-availability-panel__dot ${
              isAvailable ? "is-available" : "is-unavailable"
            }`}
          />
          {isAvailable ? "Disponible" : "No disponible"}
        </div>
      </div>

      <div className="driver-availability-panel__grid" role="group" aria-label="Cambiar disponibilidad">
        <button
          type="button"
          className={`driver-availability-button ${
            isAvailable ? "is-active is-available" : "is-inactive"
          }`}
          onClick={() => {
            void onChange("available");
          }}
          aria-pressed={isAvailable}
          disabled={disabled}
        >
          <IonIcon icon={checkmarkCircleOutline} aria-hidden="true" />
          Disponible
        </button>

        <button
          type="button"
          className={`driver-availability-button ${
            !isAvailable ? "is-active is-unavailable" : "is-inactive"
          }`}
          onClick={() => {
            void onChange("unavailable");
          }}
          aria-pressed={!isAvailable}
          disabled={disabled}
        >
          <IonIcon icon={closeOutline} aria-hidden="true" />
          No disponible
        </button>
      </div>
    </section>
  );
}

type DriverVehicleOwnership = "own" | "borrowed";

type DriverVehicleRecord = {
  id: string;
  ownerKey: string;
  ownership: DriverVehicleOwnership;
  brand: string;
  model: string;
  plate: string;
  color: string;
  year?: string | null;
  label: string;
  imageDataUrl?: string | null;
  imageName?: string | null;
  createdAt: string;
  expiresAt: string | null;
  primary?: boolean | null;
  applicationStatus?: string | null;
};

const DRIVER_VEHICLES_STORAGE_KEY = "rapago_driver_vehicles_v1";
const DRIVER_SELECTED_VEHICLE_STORAGE_KEY = "rapago_driver_selected_vehicle_v1";
const BORROWED_VEHICLE_DAYS = 5;


const RAPAGO_DRIVER_CANONICAL_VEHICLE_IMAGE_KEY = "rapago_driver_vehicle_image_data_url";
const RAPAGO_DRIVER_CANONICAL_PROFILE_PHOTO_KEY = "rapago_driver_profile_photo";

// Marca por conductor que impide que una foto eliminada vuelva a aparecer
// desde una respuesta antigua del backend o desde un snapshot local.
const RAPAGO_DRIVER_PROFILE_PHOTO_REMOVED_AT_KEY =
  "rapago_driver_profile_photo_removed_at";

const RAPAGO_DRIVER_HEAVY_STORAGE_KEYS = [
  "rapago_driver_vehicle_photo",
  "rapago_vehicle_photo_data_url",
  "rapago_driver_active_vehicle",
  "rapago_driver_public_vehicle_v1",
  "rapago_selected_vehicle_v1",
  "rapago_selected_driver_vehicle_v1",
  "rapago_driver_registered_vehicles_v1",
  "rapago_driver_vehicle_records_v1",
] as const;

const DRIVER_IMAGE_FIELD_NAMES = new Set([
  "imageDataUrl",
  "photoDataUrl",
  "driverVehicleImageDataUrl",
  "driverVehiclePhotoDataUrl",
  "vehicleImageDataUrl",
  "vehiclePhotoDataUrl",
  "driverProfileImageDataUrl",
  "driverProfilePhotoUrl",
  "profilePhotoUrl",
  "driverPhotoUrl",
]);

function isQuotaExceededStorageError(error: unknown): boolean {
  const err = error as { name?: string; code?: number; message?: string };
  return (
    err?.name === "QuotaExceededError" ||
    err?.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    err?.code === 22 ||
    String(err?.message ?? "").toLowerCase().includes("exceeded the quota")
  );
}

function removeLegacyDriverHeavyStorage(exceptKey?: string): void {
  try {
    for (const key of RAPAGO_DRIVER_HEAVY_STORAGE_KEYS) {
      if (key === exceptKey) continue;

      // IMPORTANTE: no borrar la foto de perfil del conductor.
      // Antes esta limpieza eliminaba rapago_driver_profile_photo y por eso
      // el pasajero siempre veía la letra inicial en vez de la foto.
      const keyName = String(key);
      const lower = keyName.toLowerCase();
      if (
        keyName === RAPAGO_DRIVER_CANONICAL_PROFILE_PHOTO_KEY ||
        lower.includes("profile") ||
        lower.includes("perfil") ||
        lower.includes("avatar")
      ) {
        continue;
      }

      localStorage.removeItem(keyName);
    }
  } catch {
    // No bloquea el flujo.
  }
}

function aggressiveDriverImageStorageCleanup(exceptKey?: string): void {
  try {
    const keysToRemove: string[] = [];

    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || key === exceptKey) continue;
      if (key.includes("__")) continue; // No borrar datos privados de otros conductores.
      if (key === RAPAGO_DRIVER_CANONICAL_VEHICLE_IMAGE_KEY || key === RAPAGO_DRIVER_CANONICAL_PROFILE_PHOTO_KEY) continue;
      const lower = key.toLowerCase();

      if (
        lower.includes("vehicle_photo") ||
        lower.includes("vehicle_image")
      ) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) localStorage.removeItem(key);
  } catch {
    // No bloquea el guardado local.
  }
}

function safeSetDriverLocalStorageItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    if (!isQuotaExceededStorageError(error)) return;
    removeLegacyDriverHeavyStorage(key);
    try {
      localStorage.setItem(key, value);
      return;
    } catch {
      // Intenta una limpieza más fuerte de imágenes antiguas duplicadas.
    }

    aggressiveDriverImageStorageCleanup(key);
    try {
      localStorage.setItem(key, value);
    } catch {
      // Si aún falla, no bloqueamos la app. El dato liviano sigue funcionando.
    }
  }
}

function stripDriverLargeImageFields<T>(value: T): T {
  try {
    const clone = JSON.parse(JSON.stringify(value)) as unknown;

    function walk(item: unknown): void {
      if (!item || typeof item !== "object") return;
      if (Array.isArray(item)) {
        item.forEach(walk);
        return;
      }

      const record = item as Record<string, unknown>;
      for (const key of Object.keys(record)) {
        if (DRIVER_IMAGE_FIELD_NAMES.has(key)) {
          record[key] = null;
        } else {
          walk(record[key]);
        }
      }
    }

    walk(clone);
    return clone as T;
  } catch {
    return value;
  }
}

function getDriverSnapshotVehicleImage(snapshot: Record<string, unknown>): string {
  const candidates = [
    snapshot.driverVehicleImageDataUrl,
    snapshot.driverVehiclePhotoDataUrl,
    snapshot.vehicleImageDataUrl,
    snapshot.vehiclePhotoDataUrl,
    snapshot.imageDataUrl,
  ];

  for (const value of candidates) {
    const text = String(value ?? "").trim();
    if (text.startsWith("data:image/") || text.startsWith("blob:") || text.startsWith("http://") || text.startsWith("https://")) {
      return text;
    }
  }

  return "";
}

function getDriverSnapshotProfileImage(snapshot: Record<string, unknown>): string {
  const candidates = [
    snapshot.driverProfileImageDataUrl,
    snapshot.driverProfilePhotoUrl,
    snapshot.profilePhotoUrl,
    snapshot.profileImageDataUrl,
    snapshot.profilePhotoDataUrl,
    snapshot.driverPhotoUrl,
    snapshot.driverPhotoDataUrl,
    snapshot.avatarDataUrl,
  ];

  for (const value of candidates) {
    const text = String(value ?? "").trim();
    if (
      text.startsWith("data:image/") ||
      text.startsWith("blob:") ||
      text.startsWith("http://") ||
      text.startsWith("https://")
    ) {
      return text;
    }
  }

  return getStoredDriverProfilePhotoUrl(snapshot);
}


function publishDriverVehicleSnapshotToStorage(snapshot: Record<string, unknown>): void {
  const ownerKey = getDriverScopedOwnerKey(snapshot);
  const ownerSource = {
    ownerKey,
    driverOwnerKey: ownerKey,
    driverEmail: snapshot.driverEmail,
    email: snapshot.driverEmail,
    driverName: snapshot.driverName,
    name: snapshot.driverName,
  };

  const image = getDriverSnapshotVehicleImage(snapshot);
  const profileImage = getDriverSnapshotProfileImage(snapshot);

  const lightSnapshot = {
    ...stripDriverLargeImageFields(snapshot),
    ownerKey,
    driverOwnerKey: ownerKey,
    hasVehicleImage: Boolean(image),
    vehicleImageStoredIn: image ? RAPAGO_DRIVER_CANONICAL_VEHICLE_IMAGE_KEY : null,
    hasDriverProfileImage: Boolean(profileImage),
    driverProfileImageStoredIn: profileImage ? RAPAGO_DRIVER_CANONICAL_PROFILE_PHOTO_KEY : null,
  };
  const lightPayload = JSON.stringify(lightSnapshot);

  // Limpiamos duplicados antiguos del vehículo, pero NO borramos la foto de perfil.
  removeLegacyDriverHeavyStorage();

  if (profileImage) {
    const profilePhotoUpdatedAt = String(
      snapshot.driverProfilePhotoUpdatedAt ??
        snapshot.profilePhotoUpdatedAt ??
        snapshot.driverProfileUpdatedAt ??
        snapshot.updatedAt ??
        new Date().toISOString(),
    );

    writeDriverScopedStorageItem(RAPAGO_DRIVER_CANONICAL_PROFILE_PHOTO_KEY, profileImage, ownerSource);
    writeDriverScopedStorageItem("rapago_driver_profile_photo_updated_at", profilePhotoUpdatedAt, ownerSource);
    writeDriverScopedStorageItem("rapago_driver_profile_updated_at", profilePhotoUpdatedAt, ownerSource);
    writeDriverScopedStorageItem("rapago_public_driver_profile_photo_updated_at", profilePhotoUpdatedAt, ownerSource);
    writeDriverScopedStorageItem("rapago_public_driver_profile_photo", profileImage, ownerSource);
    writeDriverScopedStorageItem("rapago_driver_profile_image_data_url", profileImage, ownerSource);
    writeDriverScopedStorageItem("rapago_driver_profile_photo_url", profileImage, ownerSource);
    writeDriverScopedStorageItem("rapago_driver_photo", profileImage, ownerSource);
    writeDriverScopedStorageItem("rapago_profile_photo", profileImage, ownerSource);
  }

  if (image) {
    writeDriverScopedStorageItem(RAPAGO_DRIVER_CANONICAL_VEHICLE_IMAGE_KEY, image, ownerSource);
  } else {
    removeDriverScopedStorageItem(RAPAGO_DRIVER_CANONICAL_VEHICLE_IMAGE_KEY, ownerSource);
  }

  const publicKeys = [
    "rapago_driver_public_snapshot_v1",
    "rapago_driver_active_vehicle_v1",
    "rapago_driver_public_profile_v1",
    "rapago_driver_active_vehicle",
    "rapago_driver_public_vehicle_v1",
    "rapago_selected_vehicle_v1",
    "rapago_selected_driver_vehicle_v1",
  ];

  for (const key of publicKeys) {
    writeDriverScopedStorageItem(key, lightPayload, ownerSource);
  }

  try {
    const raw = localStorage.getItem("rapago_driver_public_profiles_v1");
    const map = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    map[ownerKey] = lightSnapshot;
    safeSetDriverLocalStorageItem("rapago_driver_public_profiles_v1", JSON.stringify(map));
  } catch {
    // No bloquea el perfil público.
  }
}

function getDriverScopedOwnerKey(source?: unknown): string {
  if (!source || typeof source !== "object") return "driver-global";

  const data = source as Record<string, unknown>;
  const candidates = [
    data.ownerKey,
    data.driverOwnerKey,
    data.driverEmail,
    data.email,
    data.userEmail,
    data.driverUserEmail,
    data.id,
    data.userId,
    data.driverId,
    data.driverUserId,
    data.driverFullName,
    data.driverName,
    data.fullName,
    data.name,
  ];

  for (const value of candidates) {
    const text = String(value ?? "").trim();
    if (!text) continue;

    return text.includes("@") ? text.toLowerCase() : text.toLowerCase();
  }

  return "driver-global";
}

function getDriverScopedStorageKey(baseKey: string, source?: unknown): string {
  return `${baseKey}__${encodeURIComponent(getDriverScopedOwnerKey(source))}`;
}

function driverLegacyOwnerKey(baseKey: string): string {
  return `${baseKey}_owner_key`;
}

function canUseDriverLegacyStorage(baseKey: string, source?: unknown): boolean {
  if (!source || typeof source !== "object") return true;

  try {
    const expectedOwner = getDriverScopedOwnerKey(source);
    const storedOwner = localStorage.getItem(driverLegacyOwnerKey(baseKey));
    return Boolean(storedOwner && storedOwner === expectedOwner);
  } catch {
    return false;
  }
}

function readDriverScopedStorageItem(baseKey: string, source?: unknown): string | null {
  try {
    const scopedKey = getDriverScopedStorageKey(baseKey, source);
    const scoped =
      localStorage.getItem(scopedKey) ??
      sessionStorage.getItem(scopedKey);

    if (scoped != null && scoped.trim()) return scoped.trim();

    if (!canUseDriverLegacyStorage(baseKey, source)) return null;

    const legacy =
      localStorage.getItem(baseKey) ??
      sessionStorage.getItem(baseKey);

    return legacy != null && legacy.trim() ? legacy.trim() : null;
  } catch {
    return null;
  }
}

function writeDriverScopedStorageItem(baseKey: string, value: string, source?: unknown): void {
  const clean = value.trim();
  const scopedKey = getDriverScopedStorageKey(baseKey, source);
  const ownerKey = getDriverScopedOwnerKey(source);

  if (clean) {
    safeSetDriverLocalStorageItem(scopedKey, clean);
    safeSetDriverLocalStorageItem(driverLegacyOwnerKey(baseKey), ownerKey);

    try {
      sessionStorage.setItem(scopedKey, clean);
      if (!source || ownerKey === "driver-global") {
        safeSetDriverLocalStorageItem(baseKey, clean);
        sessionStorage.setItem(baseKey, clean);
      }
    } catch {
      // No bloquea.
    }
    return;
  }

  removeDriverScopedStorageItem(baseKey, source);
}

function removeDriverScopedStorageItem(baseKey: string, source?: unknown): void {
  const scopedKey = getDriverScopedStorageKey(baseKey, source);

  try {
    localStorage.removeItem(scopedKey);
    sessionStorage.removeItem(scopedKey);

    if (canUseDriverLegacyStorage(baseKey, source)) {
      localStorage.removeItem(baseKey);
      localStorage.removeItem(driverLegacyOwnerKey(baseKey));
      sessionStorage.removeItem(baseKey);
    }
  } catch {
    // No bloquea.
  }
}

function getDriverVehicleOwnerKey(user?: unknown): string {
  return getDriverScopedOwnerKey(user);
}

function sanitizeDriverVehicleValue(value: string, max = 40): string {
  return value.replace(/[<>]/g, "").trim().slice(0, max);
}

function normalizeDriverVehicleOwnership(value: unknown): DriverVehicleOwnership {
  const raw = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  if (
    raw === "borrowed" ||
    raw === "optional" ||
    raw === "opcional" ||
    raw === "prestado" ||
    raw === "temporal"
  ) {
    return "borrowed";
  }

  return "own";
}

function cleanDriverVehiclePlate(value: unknown): string {
  return sanitizeDriverVehicleValue(String(value ?? "").toUpperCase(), 14);
}

function normalizeDriverVehicleRecord(
  value: unknown,
  user?: unknown,
  fallbackIndex = 0,
): DriverVehicleRecord | null {
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const ownerKey = String(
    record.ownerKey ??
      record.driverOwnerKey ??
      record.vehicleOwnerKey ??
      getDriverVehicleOwnerKey(user),
  ).trim() || getDriverVehicleOwnerKey(user);

  const brand = sanitizeDriverVehicleValue(
    String(record.brand ?? record.vehicleBrand ?? record.driverVehicleBrand ?? record.marca ?? ""),
    32,
  );
  const model = sanitizeDriverVehicleValue(
    String(record.model ?? record.vehicleModel ?? record.driverVehicleModel ?? record.modelo ?? ""),
    32,
  );
  const plate = cleanDriverVehiclePlate(
    record.plate ?? record.vehiclePlate ?? record.driverVehiclePlate ?? record.patente ?? "",
  );
  const color = sanitizeDriverVehicleValue(
    String(record.color ?? record.vehicleColor ?? record.driverVehicleColor ?? ""),
    24,
  );
  const year = sanitizeDriverVehicleValue(
    String(record.year ?? record.vehicleYear ?? record.driverVehicleYear ?? ""),
    4,
  );

  if (!brand && !model && !plate) return null;

  const id = String(record.id ?? record.vehicleId ?? record.selectedVehicleId ?? "").trim()
    || `vehicle-imported-${ownerKey}-${plate || fallbackIndex}`;
  const imageDataUrl = String(
    record.imageDataUrl ??
      record.photoDataUrl ??
      record.vehicleImageDataUrl ??
      record.vehiclePhotoDataUrl ??
      record.driverVehicleImageDataUrl ??
      record.driverVehiclePhotoDataUrl ??
      "",
  ).trim() || null;
  const imageName = String(
    record.imageName ?? record.photoFileName ?? record.vehicleImageName ?? record.driverVehicleImageName ?? "",
  ).trim() || null;
  const ownership = normalizeDriverVehicleOwnership(record.ownership ?? record.kind);
  const label = sanitizeDriverVehicleValue(
    String(record.label ?? [brand, model, year, color].filter(Boolean).join(" ")),
    90,
  ) || `${brand} ${model}`.trim() || plate || "Vehículo Rapa Go";

  return {
    id,
    ownerKey,
    ownership,
    brand,
    model,
    plate,
    color,
    year: year || null,
    label,
    imageDataUrl,
    imageName,
    createdAt: String(record.createdAt ?? record.updatedAt ?? new Date().toISOString()),
    expiresAt: ownership === "borrowed" ? String(record.expiresAt ?? "").trim() || null : null,
    primary: Boolean(record.primary),
    applicationStatus: String(record.applicationStatus ?? record.approvedStatus ?? "").trim() || null,
  };
}

function dedupeDriverVehicleRecords(vehicles: DriverVehicleRecord[]): DriverVehicleRecord[] {
  const byKey = new Map<string, DriverVehicleRecord>();

  for (const vehicle of vehicles) {
    const key = `${vehicle.ownerKey}:${vehicle.id || vehicle.plate}`;
    const current = byKey.get(key);
    if (!current) {
      byKey.set(key, vehicle);
      continue;
    }

    byKey.set(key, {
      ...current,
      ...vehicle,
      imageDataUrl: vehicle.imageDataUrl ?? current.imageDataUrl ?? null,
      imageName: vehicle.imageName ?? current.imageName ?? null,
      primary: current.primary || vehicle.primary,
    });
  }

  return Array.from(byKey.values());
}

function parseDriverVehicleArrayFromRaw(raw: string | null, user?: unknown): DriverVehicleRecord[] {
  if (!raw?.trim()) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed
        .map((item, index) => normalizeDriverVehicleRecord(item, user, index))
        .filter((item): item is DriverVehicleRecord => item != null);
    }

    const normalized = normalizeDriverVehicleRecord(parsed, user, 0);
    return normalized ? [normalized] : [];
  } catch {
    return [];
  }
}

function getDefaultBorrowedVehicleExpiry(): string {
  const date = new Date(Date.now() + BORROWED_VEHICLE_DAYS * 24 * 60 * 60_000);
  return date.toISOString().slice(0, 10);
}

function resizeDriverVehicleImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Debes seleccionar una imagen del vehículo."));
      return;
    }

    const reader = new FileReader();

    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.onload = () => {
      const img = new Image();

      img.onerror = () => reject(new Error("No se pudo procesar la imagen."));
      img.onload = () => {
        const maxSide = 280;
        const ratio = Math.min(1, maxSide / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * ratio));
        const height = Math.max(1, Math.round(img.height * ratio));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("No se pudo preparar la imagen."));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.45));
      };

      img.src = String(reader.result ?? "");
    };

    reader.readAsDataURL(file);
  });
}


function resizeDriverProfileImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Debes seleccionar una imagen de perfil."));
      return;
    }

    const reader = new FileReader();

    reader.onerror = () => reject(new Error("No se pudo leer la foto de perfil."));
    reader.onload = () => {
      const img = new Image();

      img.onerror = () => reject(new Error("No se pudo procesar la foto de perfil."));
      img.onload = () => {
        const maxSide = 420;
        const ratio = Math.min(1, maxSide / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * ratio));
        const height = Math.max(1, Math.round(img.height * ratio));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("No se pudo preparar la foto de perfil."));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.5));
      };

      img.src = String(reader.result ?? "");
    };

    reader.readAsDataURL(file);
  });
}

function readAllDriverVehicles(user?: unknown): DriverVehicleRecord[] {
  const ownerKey = getDriverVehicleOwnerKey(user);
  const rawCandidates: Array<string | null> = [];

  try {
    rawCandidates.push(localStorage.getItem(DRIVER_VEHICLES_STORAGE_KEY));
    rawCandidates.push(sessionStorage.getItem(DRIVER_VEHICLES_STORAGE_KEY));
    rawCandidates.push(readDriverScopedStorageItem(DRIVER_VEHICLES_STORAGE_KEY, user));
    rawCandidates.push(readDriverScopedStorageItem("rapago_driver_registered_vehicles_v1", user));
    rawCandidates.push(readDriverScopedStorageItem("rapago_driver_vehicle_records_v1", user));
    rawCandidates.push(readDriverScopedStorageItem("rapago_driver_active_vehicle_v1", user));
    rawCandidates.push(readDriverScopedStorageItem("rapago_driver_public_vehicle_v1", user));
    rawCandidates.push(readDriverScopedStorageItem("rapago_selected_vehicle_v1", user));
    rawCandidates.push(readDriverScopedStorageItem("rapago_selected_driver_vehicle_v1", user));
  } catch {
    // No bloquea lectura local.
  }

  const vehicles = rawCandidates.flatMap((raw) => parseDriverVehicleArrayFromRaw(raw, user));

  // Compatibilidad: si la postulación solo dejó datos sueltos del vehículo, lo reconstruimos.
  const looseVehicle = normalizeDriverVehicleRecord(
    {
      id: "vehicle-from-application-profile",
      ownerKey,
      ownership: "own",
      brand: readDriverScopedStorageItem("rapago_driver_vehicle_brand", user),
      model: readDriverScopedStorageItem("rapago_driver_vehicle_model", user),
      year: readDriverScopedStorageItem("rapago_driver_vehicle_year", user),
      plate: readDriverScopedStorageItem("rapago_driver_vehicle_plate", user),
      color: readDriverScopedStorageItem("rapago_driver_vehicle_color", user),
      imageDataUrl: getStoredDriverVehicleImageDataUrl(user),
      imageName: getStoredDriverVehicleImageName(user),
      primary: true,
      applicationStatus: "pending_admin_review",
    },
    user,
    vehicles.length,
  );

  if (looseVehicle) vehicles.push(looseVehicle);

  return dedupeDriverVehicleRecords(vehicles);
}

function saveAllDriverVehicles(vehicles: DriverVehicleRecord[]): void {
  try {
    const normalized = dedupeDriverVehicleRecords(vehicles);
    const payload = JSON.stringify(normalized);
    const lightPayload = JSON.stringify(stripDriverLargeImageFields(normalized));

    // Guardamos la versión completa solo una vez. Las copias de compatibilidad van sin foto.
    safeSetDriverLocalStorageItem(DRIVER_VEHICLES_STORAGE_KEY, payload);
    safeSetDriverLocalStorageItem("rapago_driver_vehicles", lightPayload);
    safeSetDriverLocalStorageItem("rapago_driver_registered_vehicles_v1", lightPayload);
    safeSetDriverLocalStorageItem("rapago_driver_vehicle_records_v1", lightPayload);

    window.dispatchEvent(new CustomEvent("rapago:driver-vehicles-updated"));
  } catch {
    // No bloquea el flujo del conductor.
  }
}

function isBorrowedVehicleExpired(vehicle: DriverVehicleRecord, now = Date.now()): boolean {
  if (vehicle.ownership !== "borrowed") return false;
  if (!vehicle.expiresAt) return false;
  const expiresAt = new Date(vehicle.expiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt <= now;
}

function purgeExpiredDriverVehicles(user?: unknown): DriverVehicleRecord[] {
  const ownerKey = getDriverVehicleOwnerKey(user);
  const all = readAllDriverVehicles(user);
  const valid = all.filter((vehicle) => !isBorrowedVehicleExpired(vehicle));

  if (valid.length !== all.length) {
    saveAllDriverVehicles(valid);

    const selected = readSelectedDriverVehicleId(user);
    if (selected && !valid.some((vehicle) => vehicle.ownerKey === ownerKey && vehicle.id === selected)) {
      writeSelectedDriverVehicleId(null, user);
      saveDriverAvailability("unavailable", user);
    }
  }

  return valid;
}

function readDriverVehicles(user?: unknown): DriverVehicleRecord[] {
  const ownerKey = getDriverVehicleOwnerKey(user);
  return purgeExpiredDriverVehicles(user).filter((vehicle) => vehicle.ownerKey === ownerKey);
}

function readSelectedDriverVehicleId(user?: unknown): string | null {
  const ownerKey = getDriverVehicleOwnerKey(user);
  const rawCandidates: Array<string | null> = [];

  try {
    rawCandidates.push(readDriverScopedStorageItem(DRIVER_SELECTED_VEHICLE_STORAGE_KEY, user));
    rawCandidates.push(localStorage.getItem(DRIVER_SELECTED_VEHICLE_STORAGE_KEY));
    rawCandidates.push(sessionStorage.getItem(DRIVER_SELECTED_VEHICLE_STORAGE_KEY));
  } catch {
    // No bloquea lectura local.
  }

  for (const raw of rawCandidates) {
    if (!raw?.trim()) continue;

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (typeof parsed === "string" && parsed.trim()) return parsed.trim();
      if (parsed && typeof parsed === "object") {
        const map = parsed as Record<string, unknown>;
        const value = map[ownerKey];
        if (typeof value === "string" && value.trim()) return value.trim();
      }
    } catch {
      const value = raw.trim();
      if (
        value &&
        !value.startsWith("{") &&
        !value.startsWith("[") &&
        canUseDriverLegacyStorage(DRIVER_SELECTED_VEHICLE_STORAGE_KEY, user)
      ) {
        return value;
      }
    }
  }

  // Si viene desde el formulario de inscripción, seleccionamos automáticamente el principal.
  const vehicles = readAllDriverVehicles(user).filter(
    (vehicle) => vehicle.ownerKey === ownerKey && !isBorrowedVehicleExpired(vehicle),
  );
  const inferred = vehicles.find((vehicle) => vehicle.primary) ?? vehicles[0] ?? null;

  if (inferred) {
    try {
      const raw = localStorage.getItem(DRIVER_SELECTED_VEHICLE_STORAGE_KEY);
      const map = raw?.trim().startsWith("{")
        ? (JSON.parse(raw) as Record<string, string | null>)
        : {};
      map[ownerKey] = inferred.id;
      safeSetDriverLocalStorageItem(DRIVER_SELECTED_VEHICLE_STORAGE_KEY, JSON.stringify(map));
      writeDriverScopedStorageItem(DRIVER_SELECTED_VEHICLE_STORAGE_KEY, inferred.id, user);
    } catch {
      // No bloquea.
    }

    return inferred.id;
  }

  return null;
}

function writeSelectedDriverVehicleId(vehicleId: string | null, user?: unknown): void {
  try {
    const ownerKey = getDriverVehicleOwnerKey(user);
    const raw = localStorage.getItem(DRIVER_SELECTED_VEHICLE_STORAGE_KEY);
    const map = raw?.trim().startsWith("{")
      ? (JSON.parse(raw) as Record<string, string | null>)
      : {};

    if (vehicleId) map[ownerKey] = vehicleId;
    else delete map[ownerKey];

    safeSetDriverLocalStorageItem(DRIVER_SELECTED_VEHICLE_STORAGE_KEY, JSON.stringify(map));
    writeDriverScopedStorageItem(DRIVER_SELECTED_VEHICLE_STORAGE_KEY, vehicleId ?? "", user);

    const selectedVehicle = vehicleId
      ? readAllDriverVehicles(user).find((vehicle) => vehicle.id === vehicleId) ?? null
      : null;

    if (selectedVehicle) {
      const publicVehicleSnapshot = {
        ...selectedVehicle,
        ...getDriverVehiclePublicPayload(user),
        selectedVehicleId: selectedVehicle.id,
        updatedAt: new Date().toISOString(),
      };

      publishDriverVehicleSnapshotToStorage(publicVehicleSnapshot as Record<string, unknown>);
    }

    window.dispatchEvent(new CustomEvent("rapago:driver-selected-vehicle-updated"));
  } catch {
    // No bloquea el flujo del conductor.
  }
}

function readSelectedDriverVehicle(user?: unknown): DriverVehicleRecord | null {
  const vehicles = readDriverVehicles(user);
  const selectedId = readSelectedDriverVehicleId(user);
  if (selectedId) {
    const selected = vehicles.find((vehicle) => vehicle.id === selectedId);
    if (selected) return selected;
  }

  return vehicles.find((vehicle) => vehicle.primary) ?? vehicles[0] ?? null;
}

function hydrateApprovedDriverProfileLocally(
  profile: DriverProfileData | null,
  user?: unknown,
): DriverVehicleRecord | null {
  if (!profile) return null;

  const localProfilePhoto = getStoredDriverProfilePhotoUrl(user);
  const localPhotoWasRemoved = hasDriverProfilePhotoRemovalMarker(user);

  // Una foto elegida en este dispositivo (data:image) o una eliminación
  // confirmada por el usuario siempre tienen prioridad sobre la URL antigua
  // que pueda devolver el backend al volver a iniciar sesión.
  if (
    !localPhotoWasRemoved &&
    !localProfilePhoto.startsWith("data:image/") &&
    profile.profilePhotoUrl?.trim()
  ) {
    persistStoredDriverProfilePhotoUrl(profile.profilePhotoUrl, user);
  }

  const brand = profile.vehicleBrand?.trim() ?? "";
  const model = profile.vehicleModel?.trim() ?? "";
  const plate = profile.vehiclePlate?.trim().toUpperCase() ?? "";
  const color = profile.vehicleColor?.trim() ?? "";
  const year =
    profile.vehicleYear != null
      ? String(profile.vehicleYear)
      : "";

  if (!brand && !model && !plate && !color && !year) {
    return null;
  }

  const ownerKey = getDriverVehicleOwnerKey(user);
  const currentVehicles = purgeExpiredDriverVehicles(user);
  const previousSelectedVehicleId = readSelectedDriverVehicleId(user);
  const previousApprovedVehicle =
    currentVehicles.find(
      (entry) =>
        entry.ownerKey === ownerKey &&
        entry.id === "vehicle-from-approved-application",
    ) ?? null;

  const vehicle: DriverVehicleRecord = {
    id: "vehicle-from-approved-application",
    ownerKey,
    ownership: "own",
    brand,
    model,
    plate,
    color,
    year,
    label:
      [brand, model, year].filter(Boolean).join(" ") ||
      plate ||
      "Vehículo principal",
    // La foto local editada tiene prioridad sobre una URL antigua del backend.
    imageDataUrl: previousApprovedVehicle
      ? previousApprovedVehicle.imageDataUrl ?? null
      : profile.vehiclePhotoUrl?.trim() || null,
    imageName: previousApprovedVehicle
      ? previousApprovedVehicle.imageName ?? null
      : profile.vehiclePhotoUrl
        ? "vehiculo-aprobado"
        : null,
    createdAt:
      previousApprovedVehicle?.createdAt ||
      profile.createdAt ||
      new Date().toISOString(),
    expiresAt: null,
    primary: true,
    applicationStatus: "approved",
  };

  const nextVehicles = [
    vehicle,
    ...currentVehicles.filter(
      (entry) =>
        !(
          entry.ownerKey === ownerKey &&
          entry.id === vehicle.id
        ),
    ),
  ];

  saveAllDriverVehicles(nextVehicles);

  // No volvemos a seleccionar por la fuerza el vehículo de la inscripción.
  // Si el conductor tenía activo un opcional, se conserva después del login.
  const selectedVehicle =
    previousSelectedVehicleId
      ? nextVehicles.find(
          (entry) =>
            entry.ownerKey === ownerKey &&
            entry.id === previousSelectedVehicleId,
        ) ?? null
      : null;
  const effectiveSelectedVehicle = selectedVehicle ?? vehicle;

  writeSelectedDriverVehicleId(effectiveSelectedVehicle.id, user);

  persistStoredDriverVehicleImageDataUrl(
    effectiveSelectedVehicle.imageDataUrl ?? "",
    effectiveSelectedVehicle.imageName ?? null,
    user,
  );

  return vehicle;
}

async function hydrateApprovedDriverProfileFromServer(
  accessToken: string,
  user?: unknown,
): Promise<DriverVehicleRecord | null> {
  const profile = await driverProfileService.getMyProfile(accessToken);
  return hydrateApprovedDriverProfileLocally(profile, user);
}

function getDriverVehicleLabel(vehicle: DriverVehicleRecord | null): string {
  if (!vehicle) return "Sin vehículo seleccionado";
  const ownership = vehicle.ownership === "borrowed" ? "Prestado" : "Propio";
  return `${vehicle.label} · ${vehicle.plate} · ${ownership}`;
}

function getDriverVehiclePublicPayload(user?: unknown): Record<string, unknown> {
  const vehicle = readSelectedDriverVehicle(user);
  const ownerKey = getDriverVehicleOwnerKey(user);
  const basePayload = {
    ownerKey,
    driverOwnerKey: ownerKey,
    driverUserId:
      getDriverLiveUserField(user, "id") ??
      getDriverLiveUserField(user, "userId") ??
      null,
    driverId:
      getDriverLiveUserField(user, "id") ??
      getDriverLiveUserField(user, "userId") ??
      null,
    driverName:
      getDriverLiveUserField(user, "name") ??
      getDriverLiveUserField(user, "fullName") ??
      null,
    driverFullName:
      getDriverLiveUserField(user, "fullName") ??
      getDriverLiveUserField(user, "name") ??
      null,
    driverEmail: getDriverLiveUserField(user, "email"),
    driverPhone:
      getDriverLiveUserField(user, "phone") ??
      getDriverLiveUserField(user, "phoneNumber") ??
      getStoredDriverPublicPhone(user),
    driverProfileImageDataUrl: getStoredDriverProfilePhotoUrl(user) || null,
    driverProfilePhotoUrl: getStoredDriverProfilePhotoUrl(user) || null,
    ...buildDriverResidentFarePayload(user),
  };

  if (!vehicle) return basePayload;

  return {
    ...basePayload,
    vehicleOwnerKey: vehicle.ownerKey,
    selectedVehicleId: vehicle.id,
    driverVehicleBrand: vehicle.brand,
    driverVehicleModel: vehicle.model,
    driverVehicleColor: vehicle.color || null,
    driverVehiclePlate: vehicle.plate,
    driverVehicleOwnership: vehicle.ownership,
    driverVehicleImageDataUrl:
      vehicle.imageDataUrl ?? getStoredDriverVehicleImageDataUrl(user) ?? null,
    driverVehicleImageName:
      vehicle.imageName ?? getStoredDriverVehicleImageName(user) ?? null,
    vehicleBrand: vehicle.brand,
    vehicleModel: vehicle.model,
    vehicleColor: vehicle.color || null,
    vehiclePlate: vehicle.plate,
    vehicleImageDataUrl:
      vehicle.imageDataUrl ?? getStoredDriverVehicleImageDataUrl(user) ?? null,
    vehiclePhotoDataUrl:
      vehicle.imageDataUrl ?? getStoredDriverVehicleImageDataUrl(user) ?? null,
  };
}

function enrichRideWithSelectedDriverVehicle<T extends Record<string, unknown>>(ride: T, user?: unknown): T {
  return {
    ...ride,
    ...getDriverVehiclePublicPayload(user),
  };
}


type DriverAcceptedRideBridgeRecord = Record<string, unknown>;

const DRIVER_ACCEPTED_RIDE_BRIDGE_KEYS = [
  "rapago_local_passenger_rides",
  "rapago_admin_scheduled_rides",
  "rapago_admin_scheduled_rides_v1",
  "rapago_admin_scheduled_rides_v2",
  "rapago_admin_scheduled_rides_force_v1",
  "rapago_bridge_scheduled_rides_v1",
  "rapago_requeued_available_rides_v1",
  "rapago_requeued_passenger_visible_rides_v1",
] as const;

function driverBridgeClean(value: unknown): string {
  return repairDriverDisplayText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function driverBridgeIds(ride: DriverAcceptedRideBridgeRecord): Set<string> {
  return new Set(
    [ride.id, ride.rideId, ride.originalRideId, ride.serverRideId]
      .map((value) => String(value ?? "").trim())
      .filter(Boolean),
  );
}

function isSameDriverAcceptedRide(
  candidate: DriverAcceptedRideBridgeRecord,
  accepted: DriverAcceptedRideBridgeRecord,
): boolean {
  const candidateIds = driverBridgeIds(candidate);
  const acceptedIds = driverBridgeIds(accepted);

  for (const id of candidateIds) {
    if (acceptedIds.has(id)) return true;
  }

  const sameRoute =
    driverBridgeClean(candidate.originText) &&
    driverBridgeClean(candidate.destinationText) &&
    driverBridgeClean(candidate.originText) === driverBridgeClean(accepted.originText) &&
    driverBridgeClean(candidate.destinationText) === driverBridgeClean(accepted.destinationText);

  if (!sameRoute) return false;

  const candidateEmail = driverBridgeClean(candidate.passengerEmail);
  const acceptedEmail = driverBridgeClean(accepted.passengerEmail);

  if (candidateEmail && acceptedEmail) return candidateEmail === acceptedEmail;

  const candidateSchedule = driverBridgeClean(
    candidate.scheduledAt ?? candidate.scheduledPickupAt ?? candidate.requestedAt ?? candidate.createdAt,
  );
  const acceptedSchedule = driverBridgeClean(
    accepted.scheduledAt ?? accepted.scheduledPickupAt ?? accepted.requestedAt ?? accepted.createdAt,
  );

  return !candidateSchedule || !acceptedSchedule || candidateSchedule === acceptedSchedule;
}

function buildAcceptedDriverVehicleBridgePayload(
  acceptedRide: DriverAcceptedRideBridgeRecord,
  user?: unknown,
): DriverAcceptedRideBridgeRecord {
  const now = new Date().toISOString();
  const vehiclePayload = getDriverVehiclePublicPayload(user);
  const driverName =
    String(acceptedRide.driverName ?? acceptedRide.driverFullName ?? "").trim() ||
    getDriverLiveUserField(user, "name") ||
    getDriverLiveUserField(user, "fullName") ||
    getDriverLiveUserField(user, "email") ||
    "Conductor Rapa Go";

  const driverPhone =
    String(acceptedRide.driverPhone ?? "").trim() ||
    getDriverLiveUserField(user, "phone") ||
    getDriverLiveUserField(user, "phoneNumber") ||
    getDriverLiveUserField(user, "mobile") ||
    getStoredDriverPublicPhone(user) ||
    null;

  return {
    ...acceptedRide,
    ...vehiclePayload,
    id: String(acceptedRide.id ?? acceptedRide.rideId ?? acceptedRide.originalRideId ?? `accepted-${Date.now()}`),
    originalRideId: acceptedRide.originalRideId ?? acceptedRide.id ?? null,
    status: String(acceptedRide.status ?? "accepted"),
    acceptedAt: acceptedRide.acceptedAt ?? now,
    driverName,
    driverFullName: String(acceptedRide.driverFullName ?? "").trim() || driverName,
    driverEmail: getDriverLiveUserField(user, "email") ?? acceptedRide.driverEmail ?? null,
    driverPhone,
    driverAssignedAt: acceptedRide.driverAssignedAt ?? now,
    driverVehicleSyncedAt: now,
  };
}

function readDriverAcceptedBridgeArray(key: string): DriverAcceptedRideBridgeRecord[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as DriverAcceptedRideBridgeRecord[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeDriverAcceptedBridgeArray(key: string, rides: DriverAcceptedRideBridgeRecord[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(rides.slice(0, 220)));
  } catch {
    // No bloquea la aceptación del viaje.
  }
}

function upsertAcceptedDriverVehicleIntoStorage(
  key: string,
  accepted: DriverAcceptedRideBridgeRecord,
): void {
  const current = readDriverAcceptedBridgeArray(key);
  let found = false;

  const next = current.map((item) => {
    if (!isSameDriverAcceptedRide(item, accepted)) return item;
    found = true;
    return {
      ...item,
      ...accepted,
      id: String(item.id ?? accepted.id),
      originalRideId: item.originalRideId ?? accepted.originalRideId ?? accepted.id ?? null,
      status: String(accepted.status ?? item.status ?? "accepted"),
    };
  });

  if (!found && key === "rapago_local_passenger_rides") {
    next.unshift(accepted);
  }

  writeDriverAcceptedBridgeArray(key, next);
}

function publishAcceptedDriverVehicleToPassenger(
  acceptedRide: DriverAcceptedRideBridgeRecord,
  user?: unknown,
): void {
  const accepted = buildAcceptedDriverVehicleBridgePayload(acceptedRide, user);

  try {
    safeSetDriverLocalStorageItem(
      "rapago_last_accepted_ride",
      JSON.stringify({ ride: accepted, acceptedAt: new Date().toISOString() }),
    );

    const rawMap = localStorage.getItem("rapago_driver_accepted_vehicle_by_ride_v1");
    const map = rawMap ? (JSON.parse(rawMap) as Record<string, DriverAcceptedRideBridgeRecord>) : {};
    const ids = driverBridgeIds(accepted);

    for (const id of ids) {
      map[id] = accepted;
    }

    safeSetDriverLocalStorageItem("rapago_driver_accepted_vehicle_by_ride_v1", JSON.stringify(map));

    for (const key of DRIVER_ACCEPTED_RIDE_BRIDGE_KEYS) {
      upsertAcceptedDriverVehicleIntoStorage(key, accepted);
    }

    window.dispatchEvent(
      new CustomEvent("rapago:driver-accepted-vehicle-updated", {
        detail: { ride: accepted },
      }),
    );
    window.dispatchEvent(new CustomEvent("rapago:passenger-rides-updated"));
  } catch {
    // No bloquea la aceptación del viaje.
  }
}


type DriverScheduledReservationOffer = AvailableRideData & Record<string, unknown>;

const DRIVER_SCHEDULED_RESERVATION_KEYS = [
  "rapago_admin_scheduled_rides",
  "rapago_admin_scheduled_rides_v1",
  "rapago_admin_scheduled_rides_v2",
  "rapago_admin_scheduled_rides_force_v1",
  "rapago_bridge_scheduled_rides_v1",
  "rapago_local_passenger_rides",
  "rapago_local_driver_assigned_rides",
  "rapago_driver_reservation_inbox_v1",
] as const;

const DRIVER_SCHEDULED_RESERVATION_QUEUE_KEY = "rapago_driver_scheduled_queue";
const DRIVER_RESERVATION_INBOX_KEY = "rapago_driver_reservation_inbox_v1";
const DRIVER_RESERVATION_INBOX_BY_DRIVER_KEY = "rapago_driver_reservation_inbox_by_driver_v1";
const DRIVER_ASSIGNED_SCHEDULED_RIDE_EVENT = "rapago:driver-assigned-scheduled-ride";

const DRIVER_SCHEDULED_RESERVATION_EVENT = "rapago:driver-scheduled-reservation-updated";
const DRIVER_RESERVATION_AUTO_REASSIGN_EVENT = "rapago:admin-reservation-reassign-needed";
const DRIVER_ADMIN_RESERVATION_AUTO_ASSIGNED_EVENT = "rapago:admin-reservation-auto-assigned";
const DRIVER_RESERVATIONS_VIEW_ROUTE = `${ROUTES.DRIVER.REQUESTS}?view=reservations`;
const DRIVER_REQUESTS_VIEW_ROUTE = `${ROUTES.DRIVER.REQUESTS}?view=requests`;

function normalizeDriverReservationKey(value: unknown): string | null {
  const normalized = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  return normalized || null;
}

function collectDriverReservationKeys(values: unknown[]): string[] {
  const keys = new Set<string>();

  const addValue = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(addValue);
      return;
    }

    if (value && typeof value === "object") {
      Object.values(value as Record<string, unknown>).forEach(addValue);
      return;
    }

    const raw = repairDriverDisplayText(value).trim();
    const normalized = normalizeDriverReservationKey(value);

    if (raw) keys.add(raw);
    if (normalized) keys.add(normalized);
  };

  values.forEach(addValue);

  return Array.from(keys).filter(Boolean);
}

function getDriverScheduledReservationIdentityKeys(user?: unknown): string[] {
  const data = user && typeof user === "object" ? (user as Record<string, unknown>) : {};

  return collectDriverReservationKeys([
    data.id,
    data.userId,
    data.driverId,
    data.driverUserId,
    data.email,
    data.emailAddress,
    data.driverEmail,
    data.name,
    data.fullName,
    data.displayName,
    data.driverName,
    data.phone,
    data.driverPhone,
    data.mobile,
    data.phoneNumber,
  ]);
}

function getRideSkippedDriverKeys(ride: Record<string, unknown>): string[] {
  return collectDriverReservationKeys([
    ride.rejectedByDriverId,
    ride.rejectedByDriverUserId,
    ride.rejectedByDriverEmail,
    ride.rejectedByDriverName,
    ride.lastRejectedByDriverId,
    ride.lastRejectedByDriverEmail,
    ride.lastRejectedByDriverName,
    ride.cancelledByDriverEmail,
    ride.cancelledByDriverName,
    ride.skippedDriverKeys,
    ride.rejectedByDriverKeys,
    ride.rejectedDriverKeys,
    ride.rejectedDriverIds,
    ride.rejectedDriverEmails,
    ride.driverRejectionKeys,
    ride.driverRejectionEmails,
    ride.ignoredDriverKeys,
  ]);
}

function driverRideWasSkippedByCurrentDriver(
  ride: Record<string, unknown>,
  user?: unknown,
): boolean {
  const currentKeys = getDriverScheduledReservationIdentityKeys(user)
    .map((key) => normalizeDriverReservationKey(key) ?? key)
    .filter(Boolean);

  if (currentKeys.length === 0) return false;

  const skippedKeys = new Set(
    getRideSkippedDriverKeys(ride)
      .map((key) => normalizeDriverReservationKey(key) ?? key)
      .filter(Boolean),
  );

  return currentKeys.some((key) => skippedKeys.has(key));
}

function markRideSkippedByCurrentDriver<T extends Record<string, unknown>>(
  ride: T,
  user: unknown,
  reason: "driver_rejected" | "driver_cancelled",
): T {
  const now = new Date().toISOString();
  const currentKeys = getDriverScheduledReservationIdentityKeys(user);
  const skippedKeys = Array.from(new Set([...getRideSkippedDriverKeys(ride), ...currentKeys].filter(Boolean)));
  const driverEmail = getDriverLiveUserField(user, "email");
  const driverName =
    getDriverLiveUserField(user, "name") ??
    getDriverLiveUserField(user, "fullName") ??
    getDriverLiveUserField(user, "displayName");

  const driverId =
    getDriverLiveUserField(user, "id") ??
    getDriverLiveUserField(user, "userId") ??
    getDriverLiveUserField(user, "driverId");

  return {
    ...ride,
    status: "requested",
    skippedDriverKeys: skippedKeys,
    rejectedByDriverKeys: skippedKeys,
    rejectedDriverKeys: skippedKeys,
    rejectedDriverIds: Array.from(
      new Set([
        ...(Array.isArray(ride.rejectedDriverIds) ? ride.rejectedDriverIds : []),
        driverId,
      ].filter(Boolean)),
    ),
    rejectedDriverEmails: Array.from(
      new Set([
        ...(Array.isArray(ride.rejectedDriverEmails) ? ride.rejectedDriverEmails : []),
        driverEmail,
      ].filter(Boolean)),
    ),
    ignoredDriverKeys: skippedKeys,
    lastRejectedByDriverId: driverId ?? ride.lastRejectedByDriverId ?? null,
    lastRejectedByDriverEmail: driverEmail ?? ride.lastRejectedByDriverEmail ?? null,
    lastRejectedByDriverName: driverName ?? ride.lastRejectedByDriverName ?? null,
    lastRejectedByDriverAt: now,
    lastRejectedReason: reason,
    nextDriverSearchReason: reason,
    availableForDrivers: true,
  } as T;
}

function requeueAvailableRideForNextDriver(
  ride: AvailableRideData | Record<string, unknown>,
  user: unknown,
  reason: "driver_rejected" | "driver_cancelled",
): AvailableRideData {
  const nextRide = markRideSkippedByCurrentDriver(
    {
      ...(ride as unknown as Record<string, unknown>),
      status: "requested",
      driverId: null,
      driverUserId: null,
      driverName: null,
      driverPhone: null,
      acceptedAt: null,
      enRouteAt: null,
      arrivedAt: null,
      startedAt: null,
      requeuedAt: new Date().toISOString(),
      requeuedReason: reason,
      forceActiveAfterDriverCancel:
        reason === "driver_cancelled" ||
        (ride as unknown as Record<string, unknown>).forceActiveAfterDriverCancel === true,
    },
    user,
    reason,
  ) as unknown as AvailableRideData;

  saveRequeuedAvailableRides([nextRide, ...readRequeuedAvailableRides()]);
  window.dispatchEvent(new CustomEvent("rapago:driver-available-rides-updated", { detail: { ride: nextRide } }));
  window.dispatchEvent(new CustomEvent(RAPAGO_REQUEUED_RIDES_EVENT, { detail: { ride: nextRide, rides: readRequeuedAvailableRides() } }));

  return nextRide;
}

function getDriverScheduledReservationDriverKeys(ride: DriverAcceptedRideBridgeRecord): string[] {
  return collectDriverReservationKeys([
    ride.driverId,
    ride.driverUserId,
    ride.assignedDriverId,
    ride.assignedDriverUserId,
    ride.acceptedDriverId,
    ride.acceptedByDriverId,
    ride.driverEmail,
    ride.assignedDriverEmail,
    ride.acceptedDriverEmail,
    ride.driverName,
    ride.assignedDriverName,
    ride.acceptedDriverName,
    ride.driverFullName,
    ride.assignedDriverFullName,
    ride.assignedDriverKeys,
    ride.assignedDriverQueueKeys,
    ride.driverReservationKeys,
    ride.driverQueueKeys,
    // Compatibilidad con el auto-asignador del Admin.
    (ride as Record<string, unknown>).adminAutoAssignedDriverId,
    (ride as Record<string, unknown>).adminAutoAssignedDriverUserId,
    (ride as Record<string, unknown>).adminAutoAssignedDriverEmail,
    (ride as Record<string, unknown>).adminAutoAssignedDriverName,
    (ride as Record<string, unknown>).autoAssignedDriverId,
    (ride as Record<string, unknown>).autoAssignedDriverUserId,
    (ride as Record<string, unknown>).autoAssignedDriverEmail,
    (ride as Record<string, unknown>).autoAssignedDriverName,
    (ride as Record<string, unknown>).nextAssignedDriverId,
    (ride as Record<string, unknown>).nextAssignedDriverEmail,
    (ride as Record<string, unknown>).nextAssignedDriverName,
    ride.ownerKey,
    ride.driverOwnerKey,
  ]);
}

function getDriverScheduledRejectedKeys(ride: DriverAcceptedRideBridgeRecord): string[] {
  const direct = [
    ride.rejectedByDriverId,
    ride.rejectedByDriverUserId,
    ride.rejectedByDriverEmail,
    ride.rejectedByDriverName,
    ride.lastRejectedByDriverId,
    ride.lastRejectedByDriverEmail,
    ride.lastRejectedByDriverName,
  ];

  const arrayValues = [
    ride.rejectedByDriverKeys,
    ride.rejectedDriverKeys,
    ride.rejectedDriverIds,
    ride.rejectedDriverEmails,
    ride.driverRejectionKeys,
    ride.driverRejectionEmails,
  ];

  const fromArrays = arrayValues.flatMap((value) =>
    Array.isArray(value) ? value : typeof value === "string" ? [value] : [],
  );

  return [...direct, ...fromArrays]
    .map((value) => driverBridgeClean(value))
    .filter(Boolean);
}

function isDriverScheduledReservationRide(ride: DriverAcceptedRideBridgeRecord): boolean {
  const status = driverBridgeClean(ride.status);
  const notes = driverBridgeClean(ride.notes);
  const scheduleStatus = driverBridgeClean(
    ride.scheduleStatus ??
      ride.adminScheduleStatus ??
      ride.reservationStatus ??
      ride.driverAssignmentStatus ??
      ride.adminReservationStatus,
  );

  if (["completed", "cancelled", "canceled", "rejected", "expired"].includes(status)) return false;
  if (["driver_en_route", "driver_arrived", "in_progress"].includes(status)) return false;

  const scheduledLike =
    ride.isScheduled === true ||
    ride.rideMode === "scheduled" ||
    Boolean(ride.scheduledAt) ||
    Boolean(ride.scheduledPickupAt) ||
    Boolean(ride.pickupScheduledAt) ||
    Boolean(ride.scheduleActivationAt) ||
    scheduleStatus.includes("driver_scheduled") ||
    scheduleStatus.includes("pending_driver") ||
    scheduleStatus.includes("assigned_waiting") ||
    scheduleStatus.includes("driver_confirmation") ||
    scheduleStatus.includes("reservation") ||
    scheduleStatus.includes("agend") ||
    notes.includes("viaje agendado") ||
    notes.includes("reserva agendada") ||
    notes.includes("recogida agendada") ||
    notes.includes("aeropuerto");

  // Importante: una reserva asignada por admin puede venir con status "accepted"
  // desde versiones antiguas. No debe quedar oculta; si tiene campos de agenda,
  // se muestra en Reservas para que el conductor la acepte o rechace.
  if (status === "accepted" && !scheduledLike) return false;

  return scheduledLike;
}

function driverScheduledReservationIsAccepted(ride: DriverAcceptedRideBridgeRecord): boolean {
  const status = driverBridgeClean(ride.status);
  const response = driverBridgeClean(
    ride.driverScheduleResponse ?? ride.scheduledDriverResponse ?? ride.driverReservationResponse,
  );
  const adminStatus = driverBridgeClean(
    ride.adminScheduleStatus ?? ride.adminReservationStatus ?? ride.scheduleStatus ?? ride.reservationStatus,
  );

  return (
    response === "accepted" ||
    response === "aceptada" ||
    response === "confirmada" ||
    response === "driver_accepted" ||
    adminStatus === "driver_confirmed" ||
    adminStatus === "driver_accepted" ||
    adminStatus === "accepted_by_driver" ||
    adminStatus === "driver_confirmed_waiting_activation" ||
    status === "driver_scheduled_confirmed"
  );
}

function driverScheduledReservationMatchesDriver(
  ride: DriverAcceptedRideBridgeRecord,
  user?: unknown,
): boolean {
  const currentKeys = getDriverScheduledReservationIdentityKeys(user);
  if (currentKeys.length === 0) return false;

  const currentSet = new Set(currentKeys.map((key) => normalizeDriverReservationKey(key) ?? key));
  const assignedKeys = getDriverScheduledReservationDriverKeys(ride);
  const assignedSet = new Set(assignedKeys.map((key) => normalizeDriverReservationKey(key) ?? key));

  for (const key of assignedSet) {
    if (key && currentSet.has(key)) return true;
  }

  const userData = user && typeof user === "object" ? (user as Record<string, unknown>) : {};
  const currentEmail = normalizeDriverReservationKey(
    userData.email ?? userData.emailAddress ?? userData.driverEmail,
  );
  const assignedEmail = normalizeDriverReservationKey(
    ride.assignedDriverEmail ?? ride.driverEmail ?? ride.acceptedDriverEmail,
  );

  if (currentEmail && assignedEmail && currentEmail === assignedEmail) return true;

  const currentName = normalizeDriverReservationKey(
    userData.name ?? userData.fullName ?? userData.displayName ?? userData.driverName,
  );
  const assignedName = normalizeDriverReservationKey(
    ride.assignedDriverName ?? ride.driverName ?? ride.driverFullName ?? ride.acceptedDriverName,
  );

  if (currentName && assignedName) {
    if (currentName === assignedName) return true;
    if (currentName.length >= 5 && assignedName.includes(currentName)) return true;
    if (assignedName.length >= 5 && currentName.includes(assignedName)) return true;
  }

  return false;
}

function driverScheduledReservationRejectedByDriver(
  ride: DriverAcceptedRideBridgeRecord,
  user?: unknown,
): boolean {
  const currentKeys = getDriverScheduledReservationIdentityKeys(user);
  if (currentKeys.length === 0) return false;

  const currentSet = new Set(currentKeys.map((key) => driverBridgeClean(key)).filter(Boolean));
  const rejectedKeys = getDriverScheduledRejectedKeys(ride);
  return rejectedKeys.some((key) => currentSet.has(driverBridgeClean(key)));
}

function driverScheduledReservationOpenForNextAvailableDriver(
  ride: DriverAcceptedRideBridgeRecord,
): boolean {
  const assignmentStatus = driverBridgeClean(
    ride.adminScheduleStatus ?? ride.reservationStatus ?? ride.driverAssignmentStatus,
  );

  return (
    ride.availableForDrivers === true &&
    (
      ride.reassignmentNeeded === true ||
      ride.needsNextAvailableDriver === true ||
      assignmentStatus.includes("pending_next_driver") ||
      assignmentStatus.includes("pending_driver")
    )
  );
}

function driverScheduledReservationCanBeOffered(
  ride: DriverAcceptedRideBridgeRecord,
  user?: unknown,
  isAvailable = true,
): boolean {
  if (!isAvailable) return false;
  if (!isDriverScheduledReservationRide(ride)) return false;
  if (driverScheduledReservationIsAccepted(ride)) return false;
  if (driverScheduledReservationRejectedByDriver(ride, user)) return false;

  // Regla RAPA GO: la primera vez la reserva va al conductor asignado por Admin.
  // Si ese conductor rechaza o cancela, pasa al siguiente conductor disponible
  // que no la haya rechazado antes.
  if (driverScheduledReservationOpenForNextAvailableDriver(ride)) return true;

  const assignedKeys = getDriverScheduledReservationDriverKeys(ride);
  if (assignedKeys.length === 0) return false;

  return driverScheduledReservationMatchesDriver(ride, user);
}

function getDriverScheduledReservationSortMs(ride: DriverAcceptedRideBridgeRecord): number {
  const fields = [
    ride.scheduledAt,
    ride.scheduledPickupAt,
    ride.pickupScheduledAt,
    ride.driverVisibleAt,
    ride.scheduleActivationAt,
    ride.createdAt,
    ride.requestedAt,
  ];

  for (const field of fields) {
    const parsed = new Date(String(field ?? "")).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }

  return Number.MAX_SAFE_INTEGER;
}

function getDriverScheduledReservationDedupeKey(ride: DriverAcceptedRideBridgeRecord): string {
  const id = String(ride.id ?? ride.rideId ?? ride.originalRideId ?? "").trim();
  if (id) return `id:${id}`;

  return [
    driverBridgeClean(ride.passengerEmail),
    driverBridgeClean(ride.originText),
    driverBridgeClean(ride.destinationText),
    driverBridgeClean(ride.scheduledAt ?? ride.scheduledPickupAt ?? ride.pickupScheduledAt),
  ].join("|");
}


function collectDriverReservationRecordsFromStorageKey(
  storageKey: string,
  user?: unknown,
): DriverAcceptedRideBridgeRecord[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as
      | DriverAcceptedRideBridgeRecord[]
      | Record<string, DriverAcceptedRideBridgeRecord[]>
      | null;

    if (Array.isArray(parsed)) {
      return parsed.filter(
        (ride) =>
          driverScheduledReservationMatchesDriver(ride, user) ||
          (
            driverScheduledReservationOpenForNextAvailableDriver(ride) &&
            !driverScheduledReservationRejectedByDriver(ride, user)
          ),
      );
    }

    if (!parsed || typeof parsed !== "object") return [];

    const currentKeys = getDriverScheduledReservationIdentityKeys(user);
    const matches: DriverAcceptedRideBridgeRecord[] = [];

    for (const key of currentKeys) {
      const normalizedKey = normalizeDriverReservationKey(key) ?? key;
      const possibleKeys = Array.from(new Set([key, normalizedKey].filter(Boolean)));
      for (const possibleKey of possibleKeys) {
        const list = (parsed as Record<string, DriverAcceptedRideBridgeRecord[]>)[possibleKey];
        if (Array.isArray(list)) matches.push(...list);
      }
    }

    // Respaldo: si el Admin guardó un objeto con llaves que no coinciden exactamente,
    // revisamos todas las listas y filtramos por assignedDriverKeys/Email/Nombre.
    for (const value of Object.values(parsed as Record<string, unknown>)) {
      if (Array.isArray(value)) {
        matches.push(
          ...(value as DriverAcceptedRideBridgeRecord[]).filter(
            (ride) =>
              driverScheduledReservationMatchesDriver(ride, user) ||
              (
                driverScheduledReservationOpenForNextAvailableDriver(ride) &&
                !driverScheduledReservationRejectedByDriver(ride, user)
              ),
          ),
        );
      }
    }

    return matches;
  } catch {
    return [];
  }
}

function readDriverScheduledReservationQueueOffers(user?: unknown): DriverAcceptedRideBridgeRecord[] {
  const all = [
    ...collectDriverReservationRecordsFromStorageKey(DRIVER_SCHEDULED_RESERVATION_QUEUE_KEY, user),
    ...collectDriverReservationRecordsFromStorageKey(DRIVER_RESERVATION_INBOX_BY_DRIVER_KEY, user),
    ...collectDriverReservationRecordsFromStorageKey(DRIVER_RESERVATION_INBOX_KEY, user),
    ...collectDriverReservationRecordsFromStorageKey("rapago_local_driver_assigned_rides", user),
  ];

  const byKey = new Map<string, DriverAcceptedRideBridgeRecord>();

  for (const ride of all) {
    const key = getDriverScheduledReservationDedupeKey(ride);
    if (!key) continue;
    byKey.set(key, {
      ...(byKey.get(key) ?? ride),
      ...ride,
    });
  }

  return Array.from(byKey.values());
}

function readDriverScheduledReservationOffers(
  user?: unknown,
  isAvailable = true,
): DriverScheduledReservationOffer[] {
  const all: DriverAcceptedRideBridgeRecord[] = [];

  for (const key of DRIVER_SCHEDULED_RESERVATION_KEYS) {
    all.push(...collectDriverReservationRecordsFromStorageKey(key, user));
  }

  all.push(...readDriverScheduledReservationQueueOffers(user));

  const byKey = new Map<string, DriverAcceptedRideBridgeRecord>();
  for (const ride of all) {
    if (!driverScheduledReservationCanBeOffered(ride, user, isAvailable)) continue;
    const key = getDriverScheduledReservationDedupeKey(ride);
    if (!key) continue;

    const previous = byKey.get(key);
    if (!previous) {
      byKey.set(key, ride);
      continue;
    }

    byKey.set(key, {
      ...previous,
      ...ride,
      id: String(previous.id ?? ride.id ?? `scheduled-${Date.now()}`),
    });
  }

  return Array.from(byKey.values())
    .sort((a, b) => getDriverScheduledReservationSortMs(a) - getDriverScheduledReservationSortMs(b))
    .slice(0, 20) as DriverScheduledReservationOffer[];
}

function updateDriverScheduledReservationEverywhere(
  target: DriverAcceptedRideBridgeRecord,
  updater: (ride: DriverAcceptedRideBridgeRecord) => DriverAcceptedRideBridgeRecord,
): void {
  for (const key of DRIVER_SCHEDULED_RESERVATION_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? (JSON.parse(raw) as DriverAcceptedRideBridgeRecord[]) : [];
      const current = Array.isArray(parsed) ? parsed : [];

      let found = false;
      const next = current.map((ride) => {
        if (!isSameDriverAcceptedRide(ride, target)) return ride;
        found = true;
        return updater(ride);
      });

      if (!found && key === "rapago_local_passenger_rides") {
        next.unshift(updater(target));
      }

      localStorage.setItem(key, JSON.stringify(next.slice(0, 220)));
    } catch {
      // No bloquea el flujo local.
    }
  }

  for (const objectStorageKey of [
    DRIVER_SCHEDULED_RESERVATION_QUEUE_KEY,
    DRIVER_RESERVATION_INBOX_BY_DRIVER_KEY,
  ]) {
    try {
      const rawQueue = localStorage.getItem(objectStorageKey);
      const queue = rawQueue ? (JSON.parse(rawQueue) as Record<string, DriverAcceptedRideBridgeRecord[]>) : {};

      if (queue && typeof queue === "object" && !Array.isArray(queue)) {
        let changed = false;

        for (const key of Object.keys(queue)) {
          const list = Array.isArray(queue[key]) ? queue[key] : [];
          const nextList = list.map((ride) => {
            if (!isSameDriverAcceptedRide(ride, target)) return ride;
            changed = true;
            return updater(ride);
          });
          queue[key] = nextList.slice(0, 80);
        }

        if (changed) {
          localStorage.setItem(objectStorageKey, JSON.stringify(queue));
        }
      }
    } catch {
      // No bloquea el flujo local.
    }
  }

  // Los eventos se disparan fuera del stack actual.
  // Esto evita bucles infinitos cuando un listener vuelve a leer/actualizar reservas
  // mientras todavía estamos dentro de updateDriverScheduledReservationEverywhere().
  window.setTimeout(() => {
    window.dispatchEvent(new CustomEvent(DRIVER_SCHEDULED_RESERVATION_EVENT, { detail: { ride: target } }));
    window.dispatchEvent(new CustomEvent(DRIVER_ASSIGNED_SCHEDULED_RIDE_EVENT, { detail: { ride: target } }));
    window.dispatchEvent(new CustomEvent("rapago:admin-scheduled-rides-updated", { detail: { ride: target } }));
    window.dispatchEvent(new CustomEvent("rapago:passenger-rides-updated", { detail: { ride: target } }));
  }, 0);
}


function getDriverScheduledReservationActivationMs(ride: DriverAcceptedRideBridgeRecord): number | null {
  const fields = [
    ride.scheduleActivationAt,
    ride.driverVisibleAt,
    ride.autoAssignAt,
    ride.autoDispatchAt,
    ride.dispatchAt,
  ];

  for (const field of fields) {
    const parsed = new Date(String(field ?? "")).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }

  const scheduled = new Date(
    String(ride.scheduledAt ?? ride.scheduledPickupAt ?? ride.pickupScheduledAt ?? ""),
  ).getTime();

  if (Number.isFinite(scheduled)) return scheduled - 10 * 60_000;

  return null;
}

function driverScheduledReservationIsActiveNow(ride: DriverAcceptedRideBridgeRecord): boolean {
  const status = driverBridgeClean(ride.status);

  // Si ya está en progreso real, no lo escondemos.
  if (status === "in_progress") return true;

  // Importante RAPA GO:
  // Una reserva aceptada por el conductor NO se convierte en viaje activo altiro.
  // Debe quedar como "Reserva aceptada" hasta la hora de activación
  // (normalmente 10 minutos antes de la recogida). Por eso NO usamos
  // status === "accepted", availableForDrivers, pending_driver, driver_en_route
  // ni driver_arrived como activación automática antes de hora.
  if (
    ride.adminActivated === true ||
    ride.activatedByAdmin === true ||
    ride.forceActiveForDrivers === true
  ) {
    return true;
  }

  const activationMs = getDriverScheduledReservationActivationMs(ride);

  if (activationMs != null) {
    return Date.now() >= activationMs;
  }

  // Compatibilidad: si una reserva antigua no trae fecha de activación, recién
  // respetamos estados de ruta reales. Las reservas nuevas sí traen activationMs.
  return ["driver_en_route", "driver_arrived"].includes(status);
}

function driverRideLooksLikeScheduledReservation(ride: Record<string, unknown>): boolean {
  const text = driverBridgeClean([
    ride.status,
    ride.rideMode,
    ride.requestMode,
    ride.scheduleStatus,
    ride.adminScheduleStatus,
    ride.reservationStatus,
    ride.driverAssignmentStatus,
    ride.bookingPurpose,
    ride.serviceType,
    ride.notes,
  ].join(" "));

  return (
    ride.isScheduled === true ||
    Boolean(ride.scheduledAt) ||
    Boolean(ride.scheduledPickupAt) ||
    Boolean(ride.pickupScheduledAt) ||
    Boolean(ride.scheduleActivationAt) ||
    Boolean(ride.driverVisibleAt) ||
    text.includes("scheduled") ||
    text.includes("agendado") ||
    text.includes("reserva") ||
    text.includes("aeropuerto") ||
    text.includes("airport")
  );
}

function shouldHideFromNormalDriverRequestQueue(ride: AvailableRideData | Record<string, unknown>): boolean {
  // Las reservas agendadas NO deben entrar como "Nueva solicitud de viaje".
  // Se muestran solamente en la sección/botón Reservas del conductor asignado.
  return driverRideLooksLikeScheduledReservation(ride as unknown as Record<string, unknown>);
}

function getScheduledReservationAlertKey(ride: DriverAcceptedRideBridgeRecord): string {
  return getDriverScheduledReservationDedupeKey(ride) || String(ride.id ?? ride.rideId ?? "scheduled");
}

function readAllScheduledReservationsForDriver(user?: unknown): DriverAcceptedRideBridgeRecord[] {
  const all: DriverAcceptedRideBridgeRecord[] = [];

  for (const key of DRIVER_SCHEDULED_RESERVATION_KEYS) {
    all.push(...collectDriverReservationRecordsFromStorageKey(key, user));
  }

  all.push(...readDriverScheduledReservationQueueOffers(user));

  const byKey = new Map<string, DriverAcceptedRideBridgeRecord>();

  for (const ride of all) {
    if (!isDriverScheduledReservationRide(ride)) continue;
    if (!driverScheduledReservationMatchesDriver(ride, user)) continue;
    if (driverScheduledReservationRejectedByDriver(ride, user)) continue;

    const key = getDriverScheduledReservationDedupeKey(ride);
    if (!key) continue;

    byKey.set(key, {
      ...(byKey.get(key) ?? ride),
      ...ride,
    });
  }

  return Array.from(byKey.values()).sort(
    (a, b) => getDriverScheduledReservationSortMs(a) - getDriverScheduledReservationSortMs(b),
  );
}


function getDriverReservationRideIdentityKeys(ride: Record<string, unknown>): string[] {
  const composite = [
    ride.originText,
    ride.destinationText,
    ride.passengerEmail,
    ride.scheduledAt ?? ride.scheduledPickupAt ?? ride.pickupScheduledAt,
  ]
    .map((value) => driverBridgeClean(value))
    .filter(Boolean)
    .join("|");

  return collectDriverReservationKeys([
    ride.id,
    ride.rideId,
    ride.originalRideId,
    ride.serverRideId,
    ride.localRideId,
    ride.requestId,
    ride.passengerRideId,
    composite,
  ]);
}

function driverAvailableRideMatchesScheduledReservationForDriver(
  ride: AvailableRideData | Record<string, unknown>,
  user?: unknown,
): boolean {
  const rideKeys = new Set(
    getDriverReservationRideIdentityKeys(ride as unknown as Record<string, unknown>)
      .map((key) => normalizeDriverReservationKey(key) ?? key),
  );

  if (rideKeys.size === 0) return false;

  return readAllScheduledReservationsForDriver(user).some((reservation) => {
    const reservationKeys = getDriverReservationRideIdentityKeys(
      reservation as unknown as Record<string, unknown>,
    ).map((key) => normalizeDriverReservationKey(key) ?? key);

    return reservationKeys.some((key) => key && rideKeys.has(key));
  });
}

function buildScheduledReservationReleasedForPassenger(
  ride: DriverAcceptedRideBridgeRecord,
): DriverAcceptedRideBridgeRecord {
  const now = new Date().toISOString();

  return {
    ...ride,
    status: "requested",
    adminScheduleStatus: "released_to_assigned_driver",
    scheduleStatus: "released_to_assigned_driver",
    reservationStatus: "ready_for_assigned_driver",
    driverAssignmentStatus: "assigned_driver_alerting",
    releasedToAssignedDriverAt: ride.releasedToAssignedDriverAt ?? now,
    releasedForPassengerAt: ride.releasedForPassengerAt ?? now,
    scheduledReservationReleasedForPassenger: true,
    reservationReleasedForPassenger: true,
    passengerSearchReleased: true,
    availableForDrivers: false,
    visibleToDrivers: false,
    passengerNotice:
      "Tu reserva se activó. Estamos avisando al conductor asignado para que vaya a buscarte.",
    passengerNotification:
      "Tu reserva se activó. Estamos avisando al conductor asignado para que vaya a buscarte.",
  };
}

function releaseScheduledReservationForPassengerSearch(
  ride: DriverScheduledReservationOffer,
): DriverScheduledReservationOffer {
  const currentStatus = String(ride.status ?? "").toLowerCase().trim();
  const alreadyReleased =
    ride.scheduledReservationReleasedForPassenger === true ||
    ride.reservationReleasedForPassenger === true ||
    ride.passengerSearchReleased === true ||
    currentStatus === "requested";

  if (alreadyReleased) {
    return ride;
  }

  const released = buildScheduledReservationReleasedForPassenger(
    ride as unknown as DriverAcceptedRideBridgeRecord,
  ) as DriverScheduledReservationOffer;

  updateDriverScheduledReservationEverywhere(
    ride as unknown as DriverAcceptedRideBridgeRecord,
    () => released as unknown as DriverAcceptedRideBridgeRecord,
  );

  pushPassengerNotification({
    rideId: String(released.id ?? ride.id),
    type: "scheduled_reservation_released",
    title: "Tu reserva se activó",
    body: "Estamos avisando al conductor asignado para iniciar tu viaje.",
  });

  return released;
}

function findScheduledReservationReadyForDriver(
  user?: unknown,
  isAvailable = true,
  alreadyAlerted = new Set<string>(),
): DriverScheduledReservationOffer | null {
  if (!isAvailable) return null;

  const ready = readAllScheduledReservationsForDriver(user).find((ride) => {
    const key = getScheduledReservationAlertKey(ride);
    return !alreadyAlerted.has(key) && driverScheduledReservationIsActiveNow(ride);
  });

  if (!ready) return null;

  // Si aún no estaba aceptada, al llegar la hora/activación la soltamos para el pasajero
  // como "Buscando conductor", pero sigue bloqueada solo para el conductor asignado.
  if (!driverScheduledReservationIsAccepted(ready)) {
    return releaseScheduledReservationForPassengerSearch(
      ready as unknown as DriverScheduledReservationOffer,
    );
  }

  return ready as unknown as DriverScheduledReservationOffer;
}

function getScheduledReservationCountdownText(ride: DriverAcceptedRideBridgeRecord): string {
  const activationMs = getDriverScheduledReservationActivationMs(ride);
  if (activationMs == null) return "queda pendiente hasta la hora reservada";

  const diffMs = activationMs - Date.now();
  if (diffMs <= 0) return "ya puedes ir a buscar al pasajero";

  const minutes = Math.max(1, Math.ceil(diffMs / 60_000));
  return `se abrirá en ${minutes} min`;
}

function speakScheduledReservationAlert(): void {
  try {
    if (!("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(
      "Tienes un viaje agendado. Ve a buscar al usuario donde reservó.",
    );

    utterance.lang = "es-CL";
    utterance.rate = 0.96;
    utterance.pitch = 1;
    utterance.volume = 0.9;

    window.speechSynthesis.speak(utterance);
  } catch {
    // No bloquea la alerta si el navegador no permite voz.
  }
}

function showScheduledReservationSystemNotification(): void {
  try {
    if (!("Notification" in window)) return;

    const show = () => {
      if (Notification.permission !== "granted") return;

      const notification = new Notification("📅 Viaje agendado RAPA GO", {
        body: "Tenemos agendado tu viaje. Ve a buscar al usuario donde reservó.",
        tag: "rapago-scheduled-reservation-ready",
        renotify: true,
        silent: false,
        requireInteraction: true,
        badge: "/assets/logo-rapago-MgFpiiP8.jpeg",
        icon: "/assets/logo-rapago-MgFpiiP8.jpeg",
      } as NotificationOptions & { renotify?: boolean; requireInteraction?: boolean });

      notification.onclick = () => {
        try { window.focus(); } catch {}
        try { window.location.href = DRIVER_RESERVATIONS_VIEW_ROUTE; } catch {}
        notification.close();
      };
    };

    if (Notification.permission === "granted") {
      show();
      return;
    }

    if (Notification.permission === "default") {
      void Notification.requestPermission().then((permission) => {
        if (permission === "granted") show();
      });
    }
  } catch {
    // Notificación opcional.
  }
}

function startScheduledReservationAlertSound(): RideRequestAlertController {
  let stopped = false;
  const intervals: number[] = [];
  const audioContext = getAlertAudioContext();

  try {
    void audioContext?.resume();
  } catch {
    // Si el navegador bloquea audio, seguimos con vibración/notificación.
  }

  function playAlarmCycle(): void {
    if (stopped) return;

    try {
      void audioContext?.resume();
      playDriverAlertTone(audioContext, 0.42);
    } catch {
      // Mantiene vibración/notificación si audio no está disponible.
    }

    try {
      if ("vibrate" in navigator) navigator.vibrate([700, 220, 700, 220, 700]);
    } catch {
      // Vibración opcional.
    }
  }

  playAlarmCycle();
  speakScheduledReservationAlert();
  showScheduledReservationSystemNotification();

  intervals.push(window.setInterval(playAlarmCycle, 1200));
  intervals.push(window.setInterval(speakScheduledReservationAlert, 9000));
  intervals.push(window.setInterval(showScheduledReservationSystemNotification, 18000));

  return {
    stop: () => {
      stopped = true;
      intervals.forEach((id) => window.clearInterval(id));
      try { if ("vibrate" in navigator) navigator.vibrate(0); } catch {}
      try { window.speechSynthesis?.cancel(); } catch {}
    },
  };
}

function getAcceptedScheduledReservationStatus(ride: DriverAcceptedRideBridgeRecord): string {
  const status = driverBridgeClean(ride.status);

  if (["driver_en_route", "driver_arrived", "in_progress"].includes(status)) return status;
  if (driverScheduledReservationIsActiveNow(ride)) return "accepted";

  return "driver_scheduled";
}

function driverScheduledReservationNavigationStarted(
  ride: DriverAcceptedRideBridgeRecord | Record<string, unknown>,
): boolean {
  const status = driverBridgeClean((ride as unknown as Record<string, unknown>).status);

  return (
    (ride as unknown as Record<string, unknown>).scheduledReservationNavigationStarted === true ||
    (ride as unknown as Record<string, unknown>).driverStartedScheduledReservation === true ||
    Boolean((ride as unknown as Record<string, unknown>).driverStartedScheduledReservationAt) ||
    Boolean((ride as unknown as Record<string, unknown>).scheduledReservationStartedAt) ||
    ["driver_en_route", "driver_arrived", "in_progress"].includes(status)
  );
}

function buildDriverScheduledReservationNavigationPayload(
  ride: DriverAcceptedRideBridgeRecord,
  user?: unknown,
): DriverAcceptedRideBridgeRecord {
  const now = new Date().toISOString();
  const accepted = buildDriverScheduledReservationAcceptedPayload(ride, user);

  return {
    ...accepted,
    status: "driver_en_route",
    scheduleStatus: "driver_en_route_scheduled",
    adminScheduleStatus: "driver_en_route_scheduled",
    reservationStatus: "driver_en_route_scheduled",
    driverAssignmentStatus: "assigned_driver_started_route",
    scheduledReservationNavigationStarted: true,
    driverStartedScheduledReservation: true,
    driverStartedScheduledReservationAt: now,
    scheduledReservationStartedAt: now,
    navigationStartedAt: now,
    acceptedAt: accepted.acceptedAt ?? now,
    enRouteAt: now,
    passengerNotice: "Tu conductor ya va en camino al punto de recogida.",
    passengerNotification: "Tu conductor ya va en camino al punto de recogida.",
  };
}

function startDriverScheduledReservationNavigationLocally(
  ride: DriverScheduledReservationOffer,
  user?: unknown,
): DriverScheduledReservationOffer {
  const started = buildDriverScheduledReservationNavigationPayload(
    ride as unknown as DriverAcceptedRideBridgeRecord,
    user,
  ) as DriverScheduledReservationOffer;

  updateDriverScheduledReservationEverywhere(
    ride as unknown as DriverAcceptedRideBridgeRecord,
    () => started as unknown as DriverAcceptedRideBridgeRecord,
  );
  publishAcceptedDriverVehicleToPassenger(started, user);
  pushPassengerNotification({
    rideId: String(started.id ?? ride.id),
    type: "scheduled_driver_started_route",
    title: "Tu conductor va en camino",
    body: "Tu conductor inició la ruta hacia tu punto de recogida.",
  });

  return started;
}

function getActiveScheduledReservationRideForDriver(
  ride: DriverAcceptedRideBridgeRecord,
  user?: unknown,
): DriverRideData | null {
  if (!driverScheduledReservationIsAccepted(ride)) return null;
  if (!driverScheduledReservationMatchesDriver(ride, user)) return null;

  const status = getAcceptedScheduledReservationStatus(ride);
  if (!["accepted", "driver_en_route", "driver_arrived", "in_progress"].includes(status)) return null;

  // Aunque la reserva ya esté activa por hora, NO abrimos mapa automático.
  // Solo se convierte en viaje activo cuando el conductor toca "Iniciar viaje"
  // en la alerta especial de reserva.
  if (!driverScheduledReservationNavigationStarted(ride)) return null;

  return enrichRideWithSelectedDriverVehicle(
    {
      ...ride,
      status,
      acceptedAt:
        ride.acceptedAt ??
        ride.driverAcceptedScheduleAt ??
        ride.assignedDriverConfirmedAt ??
        new Date().toISOString(),
      driverAssignedAt:
        ride.driverAssignedAt ??
        ride.assignedDriverConfirmedAt ??
        ride.driverAcceptedScheduleAt ??
        new Date().toISOString(),
      scheduleStatus: "driver_confirmed",
      adminScheduleStatus: "driver_confirmed",
      reservationStatus: "driver_confirmed",
      availableForDrivers: false,
      reassignmentNeeded: false,
      needsNextAvailableDriver: false,
    },
    user,
  ) as unknown as DriverRideData;
}

function readActiveScheduledReservationRidesForDriver(user?: unknown): DriverRideData[] {
  const all: DriverAcceptedRideBridgeRecord[] = [];

  for (const key of DRIVER_SCHEDULED_RESERVATION_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? (JSON.parse(raw) as DriverAcceptedRideBridgeRecord[]) : [];
      if (Array.isArray(parsed)) all.push(...parsed);
    } catch {
      // Ignora datos dañados.
    }
  }

  const byKey = new Map<string, DriverRideData>();

  for (const ride of all) {
    if (wasDriverRideCancelledLocally(ride as unknown as Record<string, unknown>, user)) continue;

    const active = getActiveScheduledReservationRideForDriver(ride, user);
    if (!active) continue;

    const key = getDriverScheduledReservationDedupeKey(active as unknown as DriverAcceptedRideBridgeRecord);
    if (!key) continue;

    byKey.set(key, {
      ...(byKey.get(key) ?? active),
      ...active,
    });
  }

  return Array.from(byKey.values()).sort(
    (a, b) => getDriverScheduledReservationSortMs(a as unknown as DriverAcceptedRideBridgeRecord) - getDriverScheduledReservationSortMs(b as unknown as DriverAcceptedRideBridgeRecord),
  );
}

function getConfirmedWaitingScheduledReservationForDriver(
  ride: DriverAcceptedRideBridgeRecord,
  user?: unknown,
): DriverScheduledReservationOffer | null {
  if (!driverScheduledReservationIsAccepted(ride)) return null;
  if (!driverScheduledReservationMatchesDriver(ride, user)) return null;
  if (driverScheduledReservationIsActiveNow(ride)) return null;

  return enrichRideWithSelectedDriverVehicle(
    {
      ...ride,
      status: "driver_scheduled",
      scheduleStatus: "driver_confirmed_waiting_activation",
      adminScheduleStatus: "driver_confirmed_waiting_activation",
      reservationStatus: "driver_confirmed_waiting_activation",
      driverScheduleResponse: "accepted",
      scheduledDriverResponse: "accepted",
      passengerNotice:
        ride.passengerNotice ??
        "Tu conductor fue asignado. Verás la ruta cuando se active la reserva.",
      passengerNotification:
        ride.passengerNotification ??
        "Tu conductor fue asignado. Verás la ruta cuando se active la reserva.",
    },
    user,
  ) as unknown as DriverScheduledReservationOffer;
}

function readConfirmedWaitingScheduledReservationsForDriver(user?: unknown): DriverScheduledReservationOffer[] {
  const all: DriverAcceptedRideBridgeRecord[] = [];

  for (const key of DRIVER_SCHEDULED_RESERVATION_KEYS) {
    all.push(...collectDriverReservationRecordsFromStorageKey(key, user));
  }

  all.push(...readDriverScheduledReservationQueueOffers(user));

  const byKey = new Map<string, DriverScheduledReservationOffer>();

  for (const ride of all) {
    const waiting = getConfirmedWaitingScheduledReservationForDriver(ride, user);
    if (!waiting) continue;

    const key = getDriverScheduledReservationDedupeKey(waiting as unknown as DriverAcceptedRideBridgeRecord);
    if (!key) continue;

    byKey.set(key, {
      ...(byKey.get(key) ?? waiting),
      ...waiting,
    });
  }

  return Array.from(byKey.values()).sort(
    (a, b) =>
      getDriverScheduledReservationSortMs(a as unknown as DriverAcceptedRideBridgeRecord) -
      getDriverScheduledReservationSortMs(b as unknown as DriverAcceptedRideBridgeRecord),
  );
}

function buildDriverScheduledReservationAcceptedPayload(
  ride: DriverAcceptedRideBridgeRecord,
  user?: unknown,
): DriverAcceptedRideBridgeRecord {
  const now = new Date().toISOString();
  const driverName =
    getDriverLiveUserField(user, "name") ??
    getDriverLiveUserField(user, "fullName") ??
    getDriverLiveUserField(user, "email") ??
    String(ride.driverName ?? ride.assignedDriverName ?? "Conductor Rapa Go");
  const driverEmail = getDriverLiveUserField(user, "email") ?? (String(ride.driverEmail ?? "").trim() || null);
  const driverId = getDriverLiveUserField(user, "id") ?? getDriverLiveUserField(user, "userId") ?? (String(ride.driverId ?? "").trim() || null);

  return enrichRideWithSelectedDriverVehicle(
    {
      ...ride,
      status: getAcceptedScheduledReservationStatus(ride),
      adminScheduleStatus: "driver_confirmed",
      driverScheduleResponse: "accepted",
      scheduledDriverResponse: "accepted",
      driverAcceptedScheduleAt: now,
      driverAssignedAt: ride.driverAssignedAt ?? now,
      assignedDriverConfirmedAt: now,
      driverId,
      driverUserId: driverId,
      assignedDriverId: driverId,
      assignedDriverUserId: driverId,
      driverName,
      assignedDriverName: driverName,
      driverEmail,
      assignedDriverEmail: driverEmail,
      availableForDrivers: false,
      reassignmentNeeded: false,
      needsNextAvailableDriver: false,
      passengerNotice: "Tu conductor fue asignado. Revisa sus datos, foto de perfil y vehículo en Mis Viajes.",
      passengerNotification: "Tu conductor fue asignado. Revisa sus datos, foto de perfil y vehículo en Mis Viajes.",
    },
    user,
  );
}

function buildDriverScheduledReservationRejectedPayload(
  ride: DriverAcceptedRideBridgeRecord,
  user: unknown,
  rejectionReason: string,
): DriverAcceptedRideBridgeRecord {
  const now = new Date().toISOString();
  const cleanRejectionReason = sanitizeDriverTripSafetyText(rejectionReason, 260);

  if (!cleanRejectionReason) {
    throw new Error("Debes escribir el motivo del rechazo.");
  }

  const currentKeys = getDriverScheduledReservationIdentityKeys(user);
  const rejectedKeys = Array.from(new Set([...getDriverScheduledRejectedKeys(ride), ...currentKeys]));
  const driverName =
    getDriverLiveUserField(user, "name") ??
    getDriverLiveUserField(user, "fullName") ??
    getDriverLiveUserField(user, "email") ??
    "Conductor";
  const driverEmail = getDriverLiveUserField(user, "email") ?? null;
  const driverId = getDriverLiveUserField(user, "id") ?? getDriverLiveUserField(user, "userId") ?? null;

  return {
    ...ride,
    status: "scheduled",
    adminScheduleStatus: "pending_next_driver",
    scheduleStatus: "pending_next_driver",
    reservationStatus: "pending_next_driver",
    driverAssignmentStatus: "pending_next_driver",
    lastDriverScheduleResponse: "rejected",
    lastRejectedByDriverId: driverId,
    lastRejectedByDriverEmail: driverEmail,
    lastRejectedByDriverName: driverName,
    lastRejectedByDriverAt: now,
    rejectedByDriverKeys: rejectedKeys,
    rejectedDriverKeys: rejectedKeys,
    skippedDriverKeys: rejectedKeys,
    ignoredDriverKeys: rejectedKeys,
    rejectedDriverIds: Array.from(
      new Set([
        ...(Array.isArray(ride.rejectedDriverIds) ? ride.rejectedDriverIds : []),
        driverId,
      ].filter(Boolean)),
    ),
    rejectedDriverEmails: Array.from(
      new Set([
        ...(Array.isArray(ride.rejectedDriverEmails) ? ride.rejectedDriverEmails : []),
        driverEmail,
      ].filter(Boolean)),
    ),
    rejectedAt: now,
    rejectedReason: cleanRejectionReason,
    driverRejectionReason: cleanRejectionReason,
    adminDriverRejectionReason: cleanRejectionReason,
    adminLastDriverRejectionReason: cleanRejectionReason,
    lastRejectedReason: cleanRejectionReason,
    driverRejectionRequiresAdminVisibility: true,
    adminAutoAssignMessage: `${driverName} rechazó la reserva. Motivo: ${cleanRejectionReason}. Buscando siguiente conductor disponible.`,
    driverId: null,
    driverUserId: null,
    assignedDriverId: null,
    assignedDriverUserId: null,
    driverName: null,
    assignedDriverName: null,
    driverEmail: null,
    assignedDriverEmail: null,
    driverPhone: null,
    availableForDrivers: true,
    reassignmentNeeded: true,
    needsNextAvailableDriver: true,
    passengerNotice: "La reserva sigue activa. Estamos asignando otro conductor disponible.",
    passengerNotification: "La reserva sigue activa. Estamos asignando otro conductor disponible.",
  };
}


type DriverReservationAutoAssignCandidate = {
  id: string | null;
  email: string | null;
  name: string;
  keys: string[];
};

function readDriverReservationAvailabilitySnapshotCandidates(): DriverReservationAutoAssignCandidate[] {
  try {
    const raw = localStorage.getItem(DRIVER_AVAILABILITY_SNAPSHOT_KEY);
    const snapshot = raw
      ? (JSON.parse(raw) as Record<string, { value?: string | null; email?: string | null; name?: string | null; keys?: string[] }>)
      : {};

    const byKey = new Map<string, DriverReservationAutoAssignCandidate>();

    Object.entries(snapshot).forEach(([entryKey, record]) => {
      if (!record || normalizeDriverAvailability(record.value) !== "available") return;

      const keys = collectDriverReservationKeys([
        entryKey,
        record.keys,
        record.email,
        record.name,
      ]);

      if (keys.length === 0) return;

      const email = String(record.email ?? "").trim() || null;
      const name = String(record.name ?? email ?? "Conductor disponible").trim();

      const stableKey =
        normalizeDriverReservationKey(email) ??
        normalizeDriverReservationKey(name) ??
        normalizeDriverReservationKey(keys[0]) ??
        keys[0];

      byKey.set(stableKey, {
        id: stableKey,
        email,
        name,
        keys,
      });
    });

    return Array.from(byKey.values());
  } catch {
    return [];
  }
}

function driverReservationCandidateMatchesRejected(
  candidate: DriverReservationAutoAssignCandidate,
  rejectedKeys: string[],
): boolean {
  const rejected = new Set(
    rejectedKeys.map((key) => normalizeDriverReservationKey(key) ?? key).filter(Boolean),
  );

  return candidate.keys.some((key) => {
    const normalized = normalizeDriverReservationKey(key) ?? key;
    return rejected.has(normalized);
  });
}

function getNextAvailableDriverCandidateForReservation(
  ride: DriverAcceptedRideBridgeRecord,
  user?: unknown,
): DriverReservationAutoAssignCandidate | null {
  const rejectedKeys = Array.from(
    new Set([
      ...getDriverScheduledRejectedKeys(ride),
      ...getRideSkippedDriverKeys(ride),
      ...getDriverScheduledReservationIdentityKeys(user),
    ].filter(Boolean)),
  );

  const currentAssignedKeys = getDriverScheduledReservationDriverKeys(ride)
    .map((key) => normalizeDriverReservationKey(key) ?? key)
    .filter(Boolean);

  const candidates = readDriverReservationAvailabilitySnapshotCandidates();

  return (
    candidates.find((candidate) => {
      if (driverReservationCandidateMatchesRejected(candidate, rejectedKeys)) return false;

      const candidateKeys = candidate.keys
        .map((key) => normalizeDriverReservationKey(key) ?? key)
        .filter(Boolean);

      if (candidateKeys.some((key) => currentAssignedKeys.includes(key))) return false;
      return true;
    }) ?? null
  );
}

function buildReservationAssignedToNextDriverPayload(
  ride: DriverAcceptedRideBridgeRecord,
  candidate: DriverReservationAutoAssignCandidate,
  reason: "driver_rejected" | "driver_cancelled",
): DriverAcceptedRideBridgeRecord {
  const now = new Date().toISOString();
  const rejectedKeys = Array.from(
    new Set([
      ...getDriverScheduledRejectedKeys(ride),
      ...getRideSkippedDriverKeys(ride),
    ].filter(Boolean)),
  );
  const driverRejectionReason = sanitizeDriverTripSafetyText(
    ride.adminLastDriverRejectionReason ??
      ride.adminDriverRejectionReason ??
      ride.driverRejectionReason ??
      ride.rejectedReason,
    260,
  );
  const rejectedDriverName =
    sanitizeDriverTripSafetyText(ride.lastRejectedByDriverName, 120) ||
    "El conductor anterior";

  return {
    ...ride,
    status: "scheduled",
    adminScheduleStatus: "pending_driver_confirmation",
    scheduleStatus: "pending_driver_confirmation",
    reservationStatus: "assigned_waiting_driver_acceptance",
    driverAssignmentStatus: "pending_driver_acceptance",
    driverScheduleResponse: null,
    scheduledDriverResponse: null,
    driverReservationResponse: null,
    assignedDriverId: candidate.id,
    assignedDriverUserId: candidate.id,
    assignedDriverEmail: candidate.email,
    assignedDriverName: candidate.name,
    assignedDriverKeys: candidate.keys,
    assignedDriverQueueKeys: candidate.keys,
    driverId: null,
    driverUserId: null,
    driverEmail: null,
    driverName: null,
    driverPhone: null,
    acceptedAt: null,
    driverAcceptedScheduleAt: null,
    availableForDrivers: false,
    visibleToDrivers: false,
    driverQueueBlocked: true,
    assignedOnlyToDriver: true,
    driverReservationInboxOnly: true,
    reservationInboxOnly: true,
    visibleInDriverReservations: true,
    hiddenFromNormalRequests: true,
    reassignmentNeeded: false,
    needsNextAvailableDriver: false,
    rejectedByDriverKeys: rejectedKeys,
    rejectedDriverKeys: rejectedKeys,
    skippedDriverKeys: rejectedKeys,
    ignoredDriverKeys: rejectedKeys,
    previousRejectedDriverKeys: rejectedKeys,
    autoReassignedAt: now,
    autoReassignedReason: reason,
    autoReassignedBy: "driver_app",
    adminLastDriverRejectionReason: driverRejectionReason || null,
    adminLastRejectedDriverName: rejectedDriverName,
    adminAutoAssignMessage:
      reason === "driver_rejected"
        ? `${rejectedDriverName} rechazó la reserva. Motivo: ${driverRejectionReason || "No informado"}. Se reasignó automáticamente a ${candidate.name}.`
        : `La reserva fue reasignada automáticamente a ${candidate.name}.`,
    driverNotification: "Te reasignamos esta reserva porque otro conductor no pudo tomarla. Confirma si puedes realizarla.",
    passengerNotice: "El conductor anterior no pudo tomar la reserva. Estamos esperando confirmación del siguiente conductor disponible.",
    passengerNotification: "El conductor anterior no pudo tomar la reserva. Estamos esperando confirmación del siguiente conductor disponible.",
  };
}

function removeScheduledReservationFromAllDriverQueues(ride: DriverAcceptedRideBridgeRecord): void {
  for (const objectStorageKey of [
    DRIVER_SCHEDULED_RESERVATION_QUEUE_KEY,
    DRIVER_RESERVATION_INBOX_BY_DRIVER_KEY,
  ]) {
    try {
      const rawQueue = localStorage.getItem(objectStorageKey);
      const queue = rawQueue ? (JSON.parse(rawQueue) as Record<string, DriverAcceptedRideBridgeRecord[]>) : {};
      if (!queue || typeof queue !== "object" || Array.isArray(queue)) continue;

      let changed = false;

      Object.keys(queue).forEach((key) => {
        const list = Array.isArray(queue[key]) ? queue[key] : [];
        const next = list.filter((item) => !isSameDriverAcceptedRide(item, ride));
        if (next.length !== list.length) changed = true;
        queue[key] = next;
      });

      if (changed) localStorage.setItem(objectStorageKey, JSON.stringify(queue));
    } catch {
      // No bloquea la reasignación.
    }
  }

  for (const arrayKey of [
    "rapago_local_driver_assigned_rides",
    DRIVER_RESERVATION_INBOX_KEY,
  ]) {
    try {
      const raw = localStorage.getItem(arrayKey);
      const parsed = raw ? (JSON.parse(raw) as DriverAcceptedRideBridgeRecord[]) : [];
      const current = Array.isArray(parsed) ? parsed : [];
      const next = current.filter((item) => !isSameDriverAcceptedRide(item, ride));
      localStorage.setItem(arrayKey, JSON.stringify(next.slice(0, 160)));
    } catch {
      // No bloquea la reasignación.
    }
  }
}

function upsertScheduledReservationForOnlyNextDriver(
  ride: DriverAcceptedRideBridgeRecord,
  candidate: DriverReservationAutoAssignCandidate,
): void {
  removeScheduledReservationFromAllDriverQueues(ride);

  const rideKey = getDriverScheduledReservationDedupeKey(ride);
  const targetKeys = Array.from(
    new Set(
      candidate.keys
        .flatMap((key) => [key, normalizeDriverReservationKey(key)])
        .filter((key): key is string => Boolean(key)),
    ),
  );

  for (const objectStorageKey of [
    DRIVER_SCHEDULED_RESERVATION_QUEUE_KEY,
    DRIVER_RESERVATION_INBOX_BY_DRIVER_KEY,
  ]) {
    try {
      const rawQueue = localStorage.getItem(objectStorageKey);
      const queue = rawQueue ? (JSON.parse(rawQueue) as Record<string, DriverAcceptedRideBridgeRecord[]>) : {};

      targetKeys.forEach((key) => {
        const current = Array.isArray(queue[key]) ? queue[key] : [];
        queue[key] = [
          ride,
          ...current.filter((item) => {
            const itemKey = getDriverScheduledReservationDedupeKey(item);
            return itemKey !== rideKey && !isSameDriverAcceptedRide(item, ride);
          }),
        ].slice(0, 80);
      });

      localStorage.setItem(objectStorageKey, JSON.stringify(queue));
    } catch {
      // No bloquea la reasignación.
    }
  }

  for (const arrayKey of [
    "rapago_local_driver_assigned_rides",
    DRIVER_RESERVATION_INBOX_KEY,
  ]) {
    try {
      const raw = localStorage.getItem(arrayKey);
      const parsed = raw ? (JSON.parse(raw) as DriverAcceptedRideBridgeRecord[]) : [];
      const current = Array.isArray(parsed) ? parsed : [];

      localStorage.setItem(
        arrayKey,
        JSON.stringify([
          ride,
          ...current.filter((item) => !isSameDriverAcceptedRide(item, ride)),
        ].slice(0, 160)),
      );
    } catch {
      // No bloquea la reasignación.
    }
  }
}

function resolveScheduledReservationNextDriverAssignment(
  rejectedRide: DriverAcceptedRideBridgeRecord,
  user?: unknown,
  reason: "driver_rejected" | "driver_cancelled" = "driver_rejected",
): DriverAcceptedRideBridgeRecord {
  const candidate = getNextAvailableDriverCandidateForReservation(rejectedRide, user);

  if (!candidate) {
    // El conductor que rechazó no debe seguir viendo la reserva.
    // Admin la conserva y podrá asignarla al siguiente disponible.
    removeScheduledReservationFromAllDriverQueues(rejectedRide);

    window.dispatchEvent(
      new CustomEvent(DRIVER_RESERVATION_AUTO_REASSIGN_EVENT, {
        detail: {
          ride: rejectedRide,
          reason,
          rejectionReason:
            rejectedRide.adminLastDriverRejectionReason ??
            rejectedRide.driverRejectionReason ??
            rejectedRide.rejectedReason,
          mode: "need_admin_or_next_available_driver",
        },
      }),
    );
    window.dispatchEvent(
      new CustomEvent("rapago:admin-scheduled-rides-updated", {
        detail: { ride: rejectedRide, driverRejected: true },
      }),
    );
    return rejectedRide;
  }

  const nextRide = buildReservationAssignedToNextDriverPayload(rejectedRide, candidate, reason);
  upsertScheduledReservationForOnlyNextDriver(nextRide, candidate);

  pushPassengerNotification({
    rideId: String(nextRide.id ?? rejectedRide.id),
    type: "scheduled_driver_reassigned",
    title: "Buscando siguiente conductor",
    body: "El conductor anterior no pudo tomar tu reserva. La enviamos al siguiente conductor disponible.",
  });

  window.dispatchEvent(
    new CustomEvent(DRIVER_RESERVATION_AUTO_REASSIGN_EVENT, {
      detail: { ride: nextRide, reason, nextDriverKeys: candidate.keys, nextDriverEmail: candidate.email },
    }),
  );
  window.dispatchEvent(new CustomEvent("rapago:driver-reservation-inbox-updated", { detail: { ride: nextRide } }));
  window.dispatchEvent(new CustomEvent("rapago:admin-scheduled-rides-updated", { detail: { ride: nextRide } }));
  window.dispatchEvent(new CustomEvent("rapago:passenger-rides-updated", { detail: { ride: nextRide } }));

  return nextRide;
}

function acceptDriverScheduledReservationLocally(
  ride: DriverScheduledReservationOffer,
  user?: unknown,
): DriverScheduledReservationOffer {
  const accepted = buildDriverScheduledReservationAcceptedPayload(ride, user) as DriverScheduledReservationOffer;

  updateDriverScheduledReservationEverywhere(ride, () => accepted);
  publishAcceptedDriverVehicleToPassenger(accepted, user);
  pushPassengerNotification({
    rideId: String(accepted.id ?? ride.id),
    type: "scheduled_driver_assigned",
    title: "Conductor confirmó tu reserva",
    body: "Tu reserva agendada fue confirmada por el conductor asignado.",
  });

  return accepted;
}

function rejectDriverScheduledReservationLocally(
  ride: DriverScheduledReservationOffer,
  user: unknown,
  rejectionReason: string,
): DriverAcceptedRideBridgeRecord {
  const rejected = buildDriverScheduledReservationRejectedPayload(
    ride,
    user,
    rejectionReason,
  );
  const nextAssignment = resolveScheduledReservationNextDriverAssignment(
    rejected,
    user,
    "driver_rejected",
  );

  updateDriverScheduledReservationEverywhere(ride, () => nextAssignment);
  return nextAssignment;
}

function formatDriverScheduledReservationDate(value: unknown): string {
  const date = new Date(String(value ?? ""));
  if (Number.isNaN(date.getTime())) return "Hora por confirmar";

  return date.toLocaleString("es-CL", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDriverScheduledReservationDateText(ride: DriverAcceptedRideBridgeRecord): string {
  return formatDriverScheduledReservationDate(
    ride.scheduledAt ?? ride.scheduledPickupAt ?? ride.pickupScheduledAt,
  );
}

function addDriverVehicle(input: {
  user?: unknown;
  vehicleId?: string | null;
  createdAt?: string | null;
  primary?: boolean | null;
  ownership: DriverVehicleOwnership;
  brand: string;
  model: string;
  plate: string;
  color: string;
  year?: string | null;
  expiresAt?: string | null;
  imageDataUrl?: string | null;
  imageName?: string | null;
}): DriverVehicleRecord | null {
  const ownerKey = getDriverVehicleOwnerKey(input.user);
  const brand = sanitizeDriverVehicleValue(input.brand, 32);
  const model = sanitizeDriverVehicleValue(input.model, 32);
  const plate = sanitizeDriverVehicleValue(input.plate.toUpperCase(), 14);
  const color = sanitizeDriverVehicleValue(input.color, 24);
  const year = sanitizeDriverVehicleValue(String(input.year ?? ""), 4);

  if (!brand || !model || !plate) return null;

  const now = new Date();
  const currentVehicles = purgeExpiredDriverVehicles(input.user);
  const existingById = input.vehicleId
    ? currentVehicles.find(
        (item) =>
          item.ownerKey === ownerKey &&
          item.id === input.vehicleId,
      ) ?? null
    : null;
  const existingByPlate =
    currentVehicles.find(
      (item) =>
        item.ownerKey === ownerKey &&
        item.plate.toUpperCase() === plate.toUpperCase(),
    ) ?? null;
  const existing = existingById ?? existingByPlate;
  const vehicleId =
    existing?.id ??
    input.vehicleId?.trim() ??
    `vehicle-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const expiresAt =
    input.ownership === "borrowed"
      ? input.expiresAt
        ? new Date(input.expiresAt).toISOString()
        : new Date(now.getTime() + BORROWED_VEHICLE_DAYS * 24 * 60 * 60_000).toISOString()
      : null;

  const hasOtherOwnPrimary = currentVehicles.some(
    (item) =>
      item.ownerKey === ownerKey &&
      item.id !== vehicleId &&
      item.ownership === "own" &&
      Boolean(item.primary),
  );

  const vehicle: DriverVehicleRecord = {
    id: vehicleId,
    ownerKey,
    ownership: input.ownership,
    brand,
    model,
    plate,
    color,
    year: year || null,
    label: [brand, model, year, color].filter(Boolean).join(" ").trim(),
    imageDataUrl: input.imageDataUrl?.trim() || null,
    imageName: input.imageName?.trim() || null,
    createdAt:
      input.createdAt?.trim() ||
      existing?.createdAt ||
      now.toISOString(),
    expiresAt,
    primary:
      input.ownership === "own"
        ? Boolean(input.primary ?? existing?.primary ?? !hasOtherOwnPrimary)
        : false,
    applicationStatus: existing?.applicationStatus ?? null,
  };

  const remaining = currentVehicles.filter(
    (item) =>
      !(
        item.ownerKey === ownerKey &&
        (
          item.id === vehicleId ||
          item.plate.toUpperCase() === plate.toUpperCase()
        )
      ),
  );

  saveAllDriverVehicles([vehicle, ...remaining]);
  writeSelectedDriverVehicleId(vehicle.id, input.user);

  return vehicle;
}

function removeDriverVehicle(vehicleId: string, user?: unknown): void {
  const ownerKey = getDriverVehicleOwnerKey(user);
  const remaining = purgeExpiredDriverVehicles(user).filter(
    (vehicle) => !(vehicle.ownerKey === ownerKey && vehicle.id === vehicleId),
  );

  saveAllDriverVehicles(remaining);

  if (readSelectedDriverVehicleId(user) === vehicleId) {
    writeSelectedDriverVehicleId(null, user);
    saveDriverAvailability("unavailable", user);
  }
}

function getBorrowedVehicleRemainingText(vehicle: DriverVehicleRecord): string | null {
  if (vehicle.ownership !== "borrowed" || !vehicle.expiresAt) return null;
  const diff = new Date(vehicle.expiresAt).getTime() - Date.now();
  if (!Number.isFinite(diff) || diff <= 0) return "Vence hoy";
  const days = Math.ceil(diff / (24 * 60 * 60_000));
  return `Se borrará automáticamente en ${days} día${days === 1 ? "" : "s"}`;
}

export function DriverHomePage(): JSX.Element {
  const { session } = useAuth();
  const { theme, isDark, toggleTheme } = useRapagoSectionTheme("driver-home");
  const history = useHistory();
  const driverAvailabilityUser = session?.user as
    DriverAvailabilityUser | undefined;
  const driverConnection = useRapaGoConnectivityMonitor("driver");
  const [driverAvailability, setDriverAvailability] =
    useState<DriverAvailability>(() =>
      readDriverAvailability(driverAvailabilityUser),
    );
  const [restBlocked, setRestBlocked] = useState(false);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [driverAlertsEnabled, setDriverAlertsEnabled] = useState(() =>
    readDriverAlertsEnabled(),
  );
  const [driverNotificationPermission, setDriverNotificationPermission] =
    useState<NotificationPermission | "unsupported">(() => {
      if (!("Notification" in window)) return "unsupported";
      return Notification.permission;
    });
  const [driverAlertActivationMessage, setDriverAlertActivationMessage] =
    useState<string | null>(null);

  useEffect(() => {
    if (!session?.accessToken) return;
    void syncStoredDriverCashClosuresToBackend(session.accessToken);
  }, [session?.accessToken]);

  useEffect(() => {
    setDriverAvailability(readDriverAvailability(driverAvailabilityUser));
  }, [
    driverAvailabilityUser?.id,
    driverAvailabilityUser?.userId,
    driverAvailabilityUser?.email,
    driverAvailabilityUser?.name,
  ]);

  useEffect(() => {
    if (!session?.accessToken) return;

    let cancelled = false;

    void driverStatusService
      .getMyStatus(session.accessToken)
      .then((status) => {
        if (cancelled) return;

        const next: DriverAvailability =
          status.availability === "available" ? "available" : "unavailable";

        setDriverAvailability(next);
        saveDriverAvailability(next, driverAvailabilityUser);
      })
      .catch(() => {
        // Conserva el estado local si el backend no está disponible.
      });

    return () => {
      cancelled = true;
    };
  }, [
    session?.accessToken,
    driverAvailabilityUser?.id,
    driverAvailabilityUser?.userId,
    driverAvailabilityUser?.email,
    driverAvailabilityUser?.name,
  ]);

  useEffect(() => {
    if (!driverConnection.blocked) return;
    if (driverAvailability !== "available") return;

    setDriverAvailability("unavailable");
    saveDriverAvailability("unavailable", driverAvailabilityUser);
  }, [
    driverAvailability,
    driverAvailabilityUser?.id,
    driverAvailabilityUser?.userId,
    driverAvailabilityUser?.email,
    driverAvailabilityUser?.name,
    driverConnection.blocked,
  ]);

  useEffect(() => {
    if (!restBlocked) return;
    if (driverAvailability !== "available") return;

    setDriverAvailability("unavailable");
    saveDriverAvailability("unavailable", driverAvailabilityUser);
  }, [
    driverAvailability,
    driverAvailabilityUser?.id,
    driverAvailabilityUser?.userId,
    driverAvailabilityUser?.email,
    driverAvailabilityUser?.name,
    restBlocked,
  ]);

  const isDriverAvailable =
    driverAvailability === "available" &&
    !driverConnection.blocked &&
    !restBlocked;
  const [pendingReservationCount, setPendingReservationCount] = useState(() =>
    readDriverScheduledReservationOffers(
      driverAvailabilityUser,
      isDriverAvailable,
    ).length,
  );

  useEffect(() => {
    const refreshReservations = () => {
      setPendingReservationCount(
        readDriverScheduledReservationOffers(
          driverAvailabilityUser,
          isDriverAvailable,
        ).length,
      );
    };

    refreshReservations();
    window.addEventListener(
      DRIVER_SCHEDULED_RESERVATION_EVENT,
      refreshReservations as EventListener,
    );
    window.addEventListener(
      "rapago:admin-scheduled-rides-updated",
      refreshReservations as EventListener,
    );
    window.addEventListener("storage", refreshReservations as EventListener);

    return () => {
      window.removeEventListener(
        DRIVER_SCHEDULED_RESERVATION_EVENT,
        refreshReservations as EventListener,
      );
      window.removeEventListener(
        "rapago:admin-scheduled-rides-updated",
        refreshReservations as EventListener,
      );
      window.removeEventListener(
        "storage",
        refreshReservations as EventListener,
      );
    };
  }, [
    driverAvailabilityUser?.id,
    driverAvailabilityUser?.userId,
    driverAvailabilityUser?.email,
    driverAvailabilityUser?.name,
    isDriverAvailable,
  ]);

  async function handleEnableDriverRideAlerts(): Promise<void> {
    setDriverAlertActivationMessage(null);

    try {
      localStorage.setItem(DRIVER_ALERTS_ENABLED_STORAGE_KEY, "true");
    } catch {
      // El sonido sigue funcionando durante la sesión.
    }

    primeDriverAlertAudio();
    speakRideRequestAlert("Avisos de nuevos traslados activados.");

    let permission: NotificationPermission | "unsupported" = "unsupported";

    try {
      if ("Notification" in window) {
        permission = Notification.permission;

        if (permission === "default") {
          permission = await Notification.requestPermission();
        }
      }
    } catch {
      permission = "unsupported";
    }

    setDriverAlertsEnabled(true);
    setDriverNotificationPermission(permission);

    if (permission === "granted") {
      setDriverAlertActivationMessage(
        "Avisos activos: sonido, voz, vibración y notificación del sistema.",
      );
      return;
    }

    if (permission === "denied") {
      setDriverAlertActivationMessage(
        "Sonido, voz y vibración activos dentro de RAPA GO. El navegador bloqueó la notificación del sistema.",
      );
      return;
    }

    setDriverAlertActivationMessage(
      "Sonido, voz y vibración activos mientras RAPA GO esté abierto.",
    );
  }

  async function handleAvailabilityChange(
    value: DriverAvailability,
  ): Promise<void> {
    if (availabilitySaving) return;

    setAvailabilityError(null);

    if (value === "available" && restBlocked) {
      setDriverAvailability("unavailable");
      saveDriverAvailability("unavailable", driverAvailabilityUser);
      setAvailabilityError(
        "Tu descanso continuo está activo. Podrás marcarte Disponible cuando completes las 12 horas.",
      );
      return;
    }

    if (value === "available" && driverConnection.blocked) {
      setDriverAvailability("unavailable");
      saveDriverAvailability("unavailable", driverAvailabilityUser);
      setAvailabilityError(
        "Necesitas una conexión estable antes de marcarte Disponible.",
      );
      return;
    }

    if (!session?.accessToken) {
      setAvailabilityError(
        "Tu sesión no está disponible. Vuelve a iniciar sesión.",
      );
      return;
    }

    setAvailabilitySaving(true);

    try {
      const updated = await driverStatusService.updateMyStatus(
        session.accessToken,
        value,
      );

      const confirmed: DriverAvailability =
        updated.availability === "available" ? "available" : "unavailable";

      setDriverAvailability(confirmed);
      saveDriverAvailability(confirmed, driverAvailabilityUser);

      if (confirmed === "available") {
        enableDriverRideAlerts();
        setDriverAlertsEnabled(true);
        setDriverNotificationPermission(
          "Notification" in window ? Notification.permission : "unsupported",
        );
        setDriverAlertActivationMessage(
          "Disponible y listo para recibir avisos de nuevos traslados.",
        );
      }
    } catch (caught) {
      setDriverAvailability("unavailable");
      saveDriverAvailability("unavailable", driverAvailabilityUser);
      setAvailabilityError(
        caught instanceof Error
          ? caught.message
          : "No se pudo actualizar tu disponibilidad.",
      );
    } finally {
      setAvailabilitySaving(false);
    }
  }

  const driverName =
    session?.user?.name?.split(" ")[0] ??
    session?.user?.email?.split("@")[0] ??
    "conductor";

  const connectionLabel =
    driverConnection.status === "online"
      ? "Activo"
      : driverConnection.status === "checking"
        ? "Reconectando"
        : driverConnection.status === "poor"
          ? "Señal baja"
          : "Sin conexión";

  const actionCards: Array<{
    key: string;
    title: string;
    description: string;
    route: string;
    icon: string;
    attention?: boolean;
    badge?: number;
  }> = [
    {
      key: "requests",
      title: "Solicitudes",
      description: isDriverAvailable
        ? "Viajes disponibles y servicios activos"
        : "Ponte disponible para recibir viajes",
      route: DRIVER_REQUESTS_VIEW_ROUTE,
      icon: listOutline,
    },
    {
      key: "reservations",
      title: "Reservas",
      description:
        pendingReservationCount > 0
          ? `${pendingReservationCount} agendada${
              pendingReservationCount === 1 ? "" : "s"
            } por confirmar`
          : "Revisa tus viajes asignados para más tarde",
      route: DRIVER_RESERVATIONS_VIEW_ROUTE,
      icon: timeOutline,
      attention: pendingReservationCount > 0,
      badge: pendingReservationCount > 0 ? pendingReservationCount : undefined,
    },
    {
      key: "trips",
      title: "Mis viajes",
      description: "Historial, estados y navegación en ruta",
      route: ROUTES.DRIVER.TRIPS,
      icon: carOutline,
    },
    {
      key: "earnings",
      title: "Ganancias",
      description: "Consulta ingresos y pagos de tus servicios",
      route: ROUTES.DRIVER.EARNINGS,
      icon: cashOutline,
    },
    {
      key: "profile",
      title: "Perfil",
      description: "Datos personales, documentos y vehículo",
      route: ROUTES.DRIVER.PROFILE,
      icon: personOutline,
    },
  ];

  return (
    <>
      <IonPage
        className="rapago-driver-page driver-home-page"
        data-rapago-theme={theme}
      >
      <style>{DRIVER_HOME_STYLES}</style>
      {/* Variante "root": es la única pantalla donde la marca es el sujeto y no
          una firma, y la única donde el saludo es información nueva. El toggle
          de tema y el acceso a perfil que había aquí sueltos se fueron al menú
          de cuenta — eran dos de los tres iconos dorados idénticos separados
          por 6px, con "cerrar sesión" de tercero. */}
      <RapagoAppBar
        sectionId="driver-home"
        variant="root"
        subtitle="Tu panel de conductor"
        roleLabel="Conductor"
        showNotifications
      />

      <IonContent className="driver-home-content">
        <main className="driver-home-shell">
          <RapaGoConnectivityBanner
            role="driver"
            status={driverConnection.status}
          />

          <DriverAvailabilityControl
            value={isDriverAvailable ? "available" : "unavailable"}
            onChange={handleAvailabilityChange}
            disabled={availabilitySaving}
          />

          <section className="driver-home-cta">
            <div className="driver-home-cta__icon" aria-hidden="true">
              <IonIcon
                icon={isDriverAvailable ? notificationsOutline : carOutline}
              />
            </div>

            <div>
              <div className="driver-home-cta__title">
                {isDriverAvailable
                  ? "Revisa tus solicitudes disponibles"
                  : "Actualmente estás fuera de línea"}
              </div>
              <div className="driver-home-cta__copy">
                {isDriverAvailable
                  ? "Las nuevas solicitudes y reservas aparecerán con una alerta clara."
                  : "No recibirás servicios hasta volver a marcarte como disponible."}
              </div>
            </div>

            <button
              type="button"
              className="driver-home-cta__button"
              onClick={() => {
                if (isDriverAvailable) {
                  history.push(ROUTES.DRIVER.REQUESTS);
                } else {
                  void handleAvailabilityChange("available");
                }
              }}
            >
              {isDriverAvailable ? "Ver solicitudes" : "Ponerme disponible"}
            </button>
          </section>

          {availabilityError && (
            <div
              role="alert"
              style={{
                margin: "0 0 12px",
                padding: "11px 13px",
                borderRadius: 14,
                border: "1px solid rgba(220,38,38,.28)",
                background: "rgba(254,226,226,.96)",
                color: "#991b1b",
                fontSize: ".78rem",
                fontWeight: 850,
                lineHeight: 1.4,
              }}
            >
              {availabilityError}
            </div>
          )}

          <section
            aria-label="Avisos de nuevos traslados"
            style={{
              margin: "0 0 14px",
              padding: "14px",
              borderRadius: 20,
              background: driverAlertsEnabled
                ? "linear-gradient(135deg,rgba(220,252,231,.98),rgba(254,249,195,.98))"
                : "linear-gradient(135deg,rgba(255,247,214,.98),rgba(254,226,226,.96))",
              border: driverAlertsEnabled
                ? "1.5px solid rgba(34,197,94,.42)"
                : "1.5px solid rgba(210,164,58,.48)",
              boxShadow: "0 12px 28px rgba(17,24,39,.10)",
              color: "#111827",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 16,
                  background: driverAlertsEnabled ? "#16a34a" : "#d2a43a",
                  color: "#ffffff",
                  display: "grid",
                  placeItems: "center",
                  flex: "0 0 auto",
                  boxShadow: "0 9px 20px rgba(0,0,0,.16)",
                }}
              >
                <IonIcon icon={notificationsOutline} style={{ fontSize: 26 }} />
              </div>

              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 950, fontSize: ".94rem" }}>
                  Avisos de nuevos traslados
                </div>
                <div
                  style={{
                    marginTop: 3,
                    color: "#475569",
                    fontSize: ".76rem",
                    lineHeight: 1.35,
                    fontWeight: 800,
                  }}
                >
                  {driverAlertsEnabled
                    ? driverNotificationPermission === "granted"
                      ? "Activos con sonido, voz, vibración y notificación."
                      : "Activos dentro de RAPA GO. Mantén la aplicación abierta."
                    : "Actívalos una vez para escuchar inmediatamente cada nueva solicitud."}
                </div>
              </div>

              <span
                style={{
                  padding: "5px 8px",
                  borderRadius: 999,
                  background: driverAlertsEnabled ? "#dcfce7" : "#fef3c7",
                  color: driverAlertsEnabled ? "#166534" : "#92400e",
                  border: driverAlertsEnabled
                    ? "1px solid #86efac"
                    : "1px solid #fcd34d",
                  fontSize: ".64rem",
                  fontWeight: 950,
                  whiteSpace: "nowrap",
                }}
              >
                {driverAlertsEnabled ? "ACTIVOS" : "PENDIENTE"}
              </span>
            </div>

            <IonButton
              expand="block"
              color={driverAlertsEnabled ? "success" : "warning"}
              onClick={() => void handleEnableDriverRideAlerts()}
              style={{
                marginTop: 12,
                "--border-radius": "15px",
                "--color": driverAlertsEnabled ? "#ffffff" : "#111111",
                height: "46px",
                fontWeight: 950,
              } as CSSProperties}
            >
              <IonIcon
                icon={driverAlertsEnabled ? volumeHighOutline : notificationsOutline}
                slot="start"
              />
              {driverAlertsEnabled ? "Probar sonido y avisos" : "Activar avisos"}
            </IonButton>

            {driverAlertActivationMessage && (
              <div
                role="status"
                style={{
                  marginTop: 9,
                  fontSize: ".74rem",
                  lineHeight: 1.35,
                  fontWeight: 850,
                  color: "#334155",
                }}
              >
                {driverAlertActivationMessage}
              </div>
            )}
          </section>

          <DriverRestScheduleCard
            onBlockedChange={(blocked) => {
              setRestBlocked(blocked);
              if (!blocked) setAvailabilityError(null);
            }}
          />

          <section className="driver-home-hero">
            <div className="driver-home-hero__top">
              <div>
                <div className="driver-home-hero__eyebrow">
                  Panel de conductor
                </div>
                <div className="driver-home-hero__title">
                  Tu jornada en Rapa Nui
                </div>
                <div className="driver-home-hero__subtitle">
                  {restBlocked
                    ? "Estás cumpliendo tu descanso continuo de 12 horas. No se enviarán nuevas ofertas."
                    : isDriverAvailable
                      ? "Estás listo para recibir solicitudes y reservas asignadas en Rapa Nui."
                      : "Activa tu disponibilidad cuando estés preparado para comenzar a trabajar."}
                </div>
              </div>

              <div className="driver-home-hero__car" aria-hidden="true">
                <img
                  src={logoRapago}
                  alt=""
                  width={50}
                  height={50}
                />
              </div>
            </div>

            <div className="driver-home-hero__metrics">
              <div className="driver-home-metric">
                <div className="driver-home-metric__label">Estado</div>
                <div className="driver-home-metric__value">
                  {isDriverAvailable ? "Disponible" : "No disponible"}
                </div>
              </div>

              <div className="driver-home-metric">
                <div className="driver-home-metric__label">Zona</div>
                <div className="driver-home-metric__value">Rapa Nui</div>
              </div>

              <div
                className={`driver-home-metric driver-home-metric--network is-${driverConnection.status}`}
              >
                <div className="driver-home-metric__label">Red</div>
                <div className="driver-home-metric__value">
                  {connectionLabel}
                </div>
              </div>
            </div>
          </section>

          <section className="driver-home-section">
            <div className="driver-home-section__header">
              <div className="rapago-section-label">Accesos rápidos</div>
              <div className="driver-home-section__hint">
                Todo tu trabajo en un lugar
              </div>
            </div>

            <div className="rapago-home-quick">
              {actionCards.map((card) => (
                <IonCard
                  key={card.key}
                  button
                  routerLink={card.route}
                  className={`rapago-home-quick-card${
                    card.attention ? " rapago-home-quick-card--attention" : ""
                  }`}
                >
                  <IonCardContent>
                    <div className="rapago-driver-quick-top">
                      {/* Decorativo: el título de la tarjeta (card.title, abajo)
                          ya dice de qué acceso se trata. */}
                      <span className="rapago-home-quick-icon" aria-hidden="true">
                        <IonIcon icon={card.icon} />
                      </span>
                      {card.badge != null && (
                        <span
                          className="rapago-driver-quick-badge"
                          aria-label={`${card.badge} reservas pendientes`}
                        >
                          {card.badge}
                        </span>
                      )}
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <span className="rapago-home-quick-title">
                        {card.title}
                      </span>
                      <span className="rapago-home-quick-sub">
                        {card.description}
                      </span>
                    </div>
                  </IonCardContent>
                </IonCard>
              ))}
            </div>
          </section>

        </main>
      </IonContent>
    </IonPage>
    </>
  );
}

type PassengerNotificationPayload = {
  id: string;
  rideId: string;
  type:
    | "driver_cancelled_requeue"
    | "driver_assigned"
    | "scheduled_driver_assigned"
    | "scheduled_reservation_released"
    | "scheduled_driver_started_route"
    | "scheduled_driver_reassigned";
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
};

const RAPAGO_REQUEUED_RIDES_KEY = "rapago_requeued_available_rides_v1";
const RAPAGO_REQUEUED_PASSENGER_FORCE_KEY = "rapago_requeued_passenger_visible_rides_v1";
const RAPAGO_PASSENGER_NOTIFICATIONS_KEY = "rapago_passenger_notifications_v1";
const RAPAGO_REQUEUED_RIDES_EVENT = "rapago:ride-requeued-after-driver-cancel";

const RAPAGO_DRIVER_CANCELLED_ACTIVE_RIDES_KEY = "rapago_driver_cancelled_active_rides_v1";

type DriverCancelledActiveRideRecord = {
  id: string;
  keys: string[];
  originText?: string | null;
  destinationText?: string | null;
  passengerEmail?: string | null;
  driverEmail?: string | null;
  cancelledAt: string;
  reason: string;
};

function normalizeDriverRideIdentityValue(value: unknown): string {
  return repairDriverDisplayText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getDriverRideIdentityKeys(ride: Record<string, unknown>): string[] {
  const directKeys = [
    ride.id,
    ride.rideId,
    ride.originalRideId,
    ride.serverRideId,
    ride.requestId,
  ]
    .map((value) => normalizeDriverRideIdentityValue(value))
    .filter(Boolean);

  const routeKey = [
    ride.originText,
    ride.destinationText,
    ride.passengerEmail,
    ride.scheduledAt ?? ride.scheduledPickupAt ?? ride.requestedAt ?? ride.createdAt,
  ]
    .map((value) => normalizeDriverRideIdentityValue(value))
    .join("|");

  return Array.from(new Set([...directKeys, routeKey].filter(Boolean)));
}

function getDriverRideRecordFromPossibleWrapper(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  if (record.ride && typeof record.ride === "object") {
    return record.ride as Record<string, unknown>;
  }

  return record;
}

function driverRideIdentityMatches(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const aKeys = getDriverRideIdentityKeys(a);
  const bKeys = getDriverRideIdentityKeys(b);
  return aKeys.some((key) => bKeys.includes(key));
}

function getDriverRideDirectIds(ride: Record<string, unknown>): string[] {
  return [
    ride.id,
    ride.rideId,
    ride.originalRideId,
    ride.serverRideId,
    ride.requestId,
  ]
    .map((value) => normalizeDriverRideIdentityValue(value))
    .filter(Boolean);
}

function getDriverRideTimestampMs(
  ride: Record<string, unknown>,
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

function getDriverRideAcceptedTimestampMs(ride: Record<string, unknown>): number | null {
  return getDriverRideTimestampMs(ride, [
    "acceptedAt",
    "driverAcceptedAt",
    "driverAcceptedScheduleAt",
    "driverScheduleAcceptedAt",
    "scheduledDriverAcceptedAt",
    "driverConfirmedAt",
    "enRouteAt",
    "driverArrivedAt",
    "arrivedAt",
    "startedAt",
  ]);
}

function getDriverRideCreationTimestampMs(ride: Record<string, unknown>): number | null {
  return getDriverRideTimestampMs(ride, [
    "requestedAt",
    "createdAt",
    "scheduledAt",
    "scheduledPickupAt",
  ]);
}

function getDriverRideCancellationTimestampMs(ride: Record<string, unknown>): number | null {
  return getDriverRideTimestampMs(ride, [
    "cancelledAt",
    "canceledAt",
    "passengerCancelledAt",
    "updatedAt",
  ]);
}

function cancellationRecordIsOlderThanAcceptedRide(
  activeRide: Record<string, unknown>,
  cancelledRide: Record<string, unknown>,
): boolean {
  const cancelledAt = getDriverRideCancellationTimestampMs(cancelledRide);
  if (cancelledAt == null) return false;

  const acceptedAt = getDriverRideAcceptedTimestampMs(activeRide);
  if (acceptedAt != null && acceptedAt > cancelledAt + 1000) return true;

  const createdAt = getDriverRideCreationTimestampMs(activeRide);
  return createdAt != null && createdAt > cancelledAt + 1000;
}

function readDriverCancelledActiveRides(): DriverCancelledActiveRideRecord[] {
  try {
    const raw = localStorage.getItem(RAPAGO_DRIVER_CANCELLED_ACTIVE_RIDES_KEY);
    const parsed = raw ? (JSON.parse(raw) as DriverCancelledActiveRideRecord[]) : [];
    if (!Array.isArray(parsed)) return [];

    const maxAgeMs = 24 * 60 * 60 * 1000;
    const now = Date.now();

    return parsed.filter((item) => {
      const time = new Date(String(item.cancelledAt ?? "")).getTime();
      return Number.isFinite(time) && now - time <= maxAgeMs;
    });
  } catch {
    return [];
  }
}

function saveDriverCancelledActiveRides(records: DriverCancelledActiveRideRecord[]): void {
  try {
    localStorage.setItem(
      RAPAGO_DRIVER_CANCELLED_ACTIVE_RIDES_KEY,
      JSON.stringify(records.slice(0, 120)),
    );
  } catch {
    // No bloquea la cancelación visual.
  }
}

function markDriverRideCancelledLocally(ride: Record<string, unknown>, driverUser?: unknown): void {
  const now = new Date().toISOString();
  const keys = getDriverRideIdentityKeys(ride);
  const driverEmail = normalizeDriverRideIdentityValue(getDriverLiveUserField(driverUser, "email"));

  const record: DriverCancelledActiveRideRecord = {
    id: normalizeDriverRideIdentityValue(ride.id ?? ride.rideId ?? ride.originalRideId ?? keys[0] ?? `cancelled-${Date.now()}`),
    keys,
    originText: typeof ride.originText === "string" ? ride.originText : null,
    destinationText: typeof ride.destinationText === "string" ? ride.destinationText : null,
    passengerEmail: typeof ride.passengerEmail === "string" ? ride.passengerEmail : null,
    driverEmail: driverEmail || null,
    cancelledAt: now,
    reason: "driver_cancelled",
  };

  const current = readDriverCancelledActiveRides();
  const next = [
    record,
    ...current.filter((item) => !item.keys.some((key) => keys.includes(key))),
  ];

  saveDriverCancelledActiveRides(next);
}

function wasDriverRideCancelledLocally(ride: Record<string, unknown>, driverUser?: unknown): boolean {
  const keys = getDriverRideIdentityKeys(ride);
  if (keys.length === 0) return false;

  const driverEmail = normalizeDriverRideIdentityValue(getDriverLiveUserField(driverUser, "email"));

  return readDriverCancelledActiveRides().some((record) => {
    const sameRide = record.keys.some((key) => keys.includes(key));
    if (!sameRide) return false;

    const recordDriverEmail = normalizeDriverRideIdentityValue(record.driverEmail);
    return !recordDriverEmail || !driverEmail || recordDriverEmail === driverEmail;
  });
}

function updateDriverRideListAfterLocalCancel(list: Array<Record<string, unknown>>, cancelledRide: Record<string, unknown>): Array<Record<string, unknown>> {
  return list
    .map((item) => {
      const same = driverRideIdentityMatches(item, cancelledRide);
      if (!same) return item;

      return {
        ...item,
        status: "cancelled",
        cancelledAt: cancelledRide.cancelledAt ?? new Date().toISOString(),
        cancelledByRole: "driver",
        cancelledBy: "driver",
        cancellationReason: cancelledRide.cancellationReason ?? "Cancelado por conductor.",
        requeuedReason: "driver_cancelled",
        driverId: null,
        driverUserId: null,
        driverName: null,
        driverPhone: null,
      };
    })
    .filter((item) => {
      const same = driverRideIdentityMatches(item, cancelledRide);
      const status = normalizeDriverRideIdentityValue(item.status);

      // En las colas activas del conductor lo sacamos completo. En historial puede quedar cancelado.
      return !same || status === "cancelled";
    });
}

function clearDriverActiveRideLocalMirrors(cancelledRide: Record<string, unknown>): void {
  const activeKeys = [
    "rapago_last_accepted_ride",
    "rapago_driver_active_ride",
    "rapago_driver_active_ride_v1",
    "rapago_current_driver_location",
  ];

  for (const key of activeKeys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        localStorage.removeItem(key);
        continue;
      }

      const parsed = JSON.parse(raw) as unknown;
      const rideRecord = getDriverRideRecordFromPossibleWrapper(parsed);
      if (
        rideRecord &&
        (wasDriverRideCancelledLocally(rideRecord) || driverRideIdentityMatches(rideRecord, cancelledRide))
      ) {
        localStorage.removeItem(key);
      }
    } catch {
      localStorage.removeItem(key);
    }
  }

  const arrayKeys = [
    "rapago_local_driver_assigned_rides",
    "rapago_driver_scheduled_queue",
    "rapago_driver_active_rides_v1",
    "rapago_driver_my_rides_v1",
    ...DRIVER_SCHEDULED_RESERVATION_KEYS,
  ];

  for (const key of arrayKeys) {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
      if (!Array.isArray(parsed)) continue;

      const next = updateDriverRideListAfterLocalCancel(parsed, cancelledRide).filter(
        (item) => !wasDriverRideCancelledLocally(item),
      );

      localStorage.setItem(key, JSON.stringify(next.slice(0, 200)));
    } catch {
      // No bloquea la cancelación visual.
    }
  }

  for (const key of [DRIVER_RESERVATION_INBOX_KEY, DRIVER_RESERVATION_INBOX_BY_DRIVER_KEY]) {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? (JSON.parse(raw) as Record<string, Array<Record<string, unknown>>>) : {};
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) continue;

      let changed = false;
      const next: Record<string, Array<Record<string, unknown>>> = {};

      for (const [driverKey, list] of Object.entries(parsed)) {
        const current = Array.isArray(list) ? list : [];
        const hadMatch = current.some((item) => driverRideIdentityMatches(item, cancelledRide));
        const updated = updateDriverRideListAfterLocalCancel(current, cancelledRide).filter(
          (item) => !wasDriverRideCancelledLocally(item),
        );
        next[driverKey] = updated.slice(0, 80);
        if (hadMatch || updated.length !== current.length) changed = true;
      }

      if (changed) {
        localStorage.setItem(key, JSON.stringify(next));
      }
    } catch {
      // No bloquea la cancelación visual.
    }
  }
}


const RAPAGO_DRIVER_PASSENGER_CANCELLED_RIDES_KEY = "rapago_driver_passenger_cancelled_rides_v1";
const RAPAGO_DRIVER_PASSENGER_CANCEL_NOTICE_SEEN_KEY = "rapago_driver_passenger_cancel_notice_seen_v2";
const RAPAGO_PASSENGER_CANCELLED_RIDE_EVENT = "rapago:passenger-cancelled-ride-for-driver";

type DriverPassengerCancelNoticeSeenRecord = {
  key: string;
  seenAt: string;
};

function buildDriverPassengerCancelNoticeKey(
  ride: Record<string, unknown>,
  user?: unknown,
): string {
  const ownerKey = getDriverScopedOwnerKey(user);
  const identityKeys = getDriverRideIdentityKeys(ride).sort();
  const fallback = [
    ride.id,
    ride.rideId,
    ride.originalRideId,
    ride.originText,
    ride.destinationText,
    ride.passengerEmail,
    ride.scheduledAt,
    ride.createdAt,
  ]
    .map(normalizeDriverRideIdentityValue)
    .filter(Boolean)
    .join("|");

  return `${ownerKey}::${identityKeys.join("|") || fallback || "unknown-ride"}`;
}

function claimDriverPassengerCancelNoticeOnce(
  ride: Record<string, unknown>,
  user?: unknown,
): boolean {
  const key = buildDriverPassengerCancelNoticeKey(ride, user);
  const now = Date.now();
  const maxAgeMs = 7 * 24 * 60 * 60 * 1000;

  try {
    const raw = localStorage.getItem(RAPAGO_DRIVER_PASSENGER_CANCEL_NOTICE_SEEN_KEY);
    const parsed = raw ? (JSON.parse(raw) as DriverPassengerCancelNoticeSeenRecord[]) : [];
    const current = Array.isArray(parsed)
      ? parsed.filter((item) => {
          const seenAtMs = new Date(String(item?.seenAt ?? "")).getTime();
          return Boolean(item?.key) && Number.isFinite(seenAtMs) && now - seenAtMs <= maxAgeMs;
        })
      : [];

    if (current.some((item) => item.key === key)) return false;

    localStorage.setItem(
      RAPAGO_DRIVER_PASSENGER_CANCEL_NOTICE_SEEN_KEY,
      JSON.stringify([{ key, seenAt: new Date(now).toISOString() }, ...current].slice(0, 200)),
    );
    return true;
  } catch {
    return true;
  }
}

const RAPAGO_PASSENGER_CANCEL_STORAGE_KEYS_FOR_DRIVER = [
  "rapago_local_passenger_rides",
  "rapago_admin_scheduled_rides",
  "rapago_admin_scheduled_rides_v1",
  "rapago_admin_scheduled_rides_v2",
  "rapago_admin_scheduled_rides_force_v1",
  "rapago_bridge_scheduled_rides_v1",
  "rapago_requeued_available_rides_v1",
  "rapago_requeued_passenger_visible_rides_v1",
] as const;

type DriverPassengerCancelledRideRecord = {
  id: string;
  keys: string[];
  originText?: string | null;
  destinationText?: string | null;
  passengerEmail?: string | null;
  cancellationReason?: string | null;
  cancellationReasonLabel?: string | null;
  cancellationReasonCode?: string | null;
  cancelledAt: string;
  cancelledByRole: "passenger";
};


function getPassengerCancellationReasonForDriver(
  ride: Record<string, unknown>,
): string {
  const raw = String(
    ride.passengerCancellationReasonLabel ??
      ride.cancellationReasonLabel ??
      ride.cancellationReason ??
      ride.cancelReason ??
      ride.reason ??
      "",
  );

  const clean = sanitizeDriverTripSafetyText(raw, 240)
    .replace(/^cancelado por pasajero[.: -]*/i, "")
    .trim();

  return clean || "Motivo no informado por el pasajero.";
}

function isRidePassengerCancelledForDriver(ride: Record<string, unknown>): boolean {
  const status = normalizeDriverRideIdentityValue(ride.status);
  const cancelledByRole = normalizeDriverRideIdentityValue(ride.cancelledByRole ?? ride.cancelledBy);
  const cancellationReason = normalizeDriverRideIdentityValue(
    ride.cancellationReason ?? ride.cancelReason ?? ride.reason,
  );

  const driverNoShowOrDriverCancel =
    cancelledByRole.includes("driver") ||
    cancelledByRole.includes("conductor") ||
    cancelledByRole.includes("no show") ||
    cancelledByRole.includes("no_show") ||
    cancellationReason.includes("no show") ||
    cancellationReason.includes("no_show") ||
    cancellationReason.includes("conductor") ||
    cancellationReason.includes("driver");

  if (driverNoShowOrDriverCancel) return false;

  return (
    status === "passenger_cancelled" ||
    status === "cancelled_by_passenger" ||
    status === "canceled_by_passenger" ||
    cancelledByRole.includes("passenger") ||
    cancelledByRole.includes("pasajero") ||
    cancellationReason.includes("cancelado por pasajero") ||
    cancellationReason.includes("pasajero cancelo") ||
    cancellationReason.includes("pasajero cancel")
  );
}

function isRecentServerPassengerCancellationForDriver(
  ride: Record<string, unknown>,
  maxAgeMs = 20 * 60 * 1000,
): boolean {
  if (!isRidePassengerCancelledForDriver(ride)) return false;

  const candidates = [ride.cancelledAt, ride.updatedAt, ride.createdAt];
  const now = Date.now();

  for (const candidate of candidates) {
    const timestamp = new Date(String(candidate ?? "")).getTime();
    if (!Number.isFinite(timestamp)) continue;
    return timestamp <= now + 2 * 60 * 1000 && now - timestamp <= maxAgeMs;
  }

  return false;
}

function readDriverPassengerCancelledRideRecords(): DriverPassengerCancelledRideRecord[] {
  try {
    const raw = localStorage.getItem(RAPAGO_DRIVER_PASSENGER_CANCELLED_RIDES_KEY);
    const parsed = raw ? (JSON.parse(raw) as DriverPassengerCancelledRideRecord[]) : [];
    if (!Array.isArray(parsed)) return [];

    const maxAgeMs = 24 * 60 * 60 * 1000;
    const now = Date.now();

    return parsed.filter((item) => {
      const time = new Date(String(item.cancelledAt ?? "")).getTime();
      return Number.isFinite(time) && now - time <= maxAgeMs;
    });
  } catch {
    return [];
  }
}

function saveDriverPassengerCancelledRideRecords(records: DriverPassengerCancelledRideRecord[]): void {
  try {
    localStorage.setItem(
      RAPAGO_DRIVER_PASSENGER_CANCELLED_RIDES_KEY,
      JSON.stringify(records.slice(0, 150)),
    );
  } catch {
    // No bloquea el aviso al conductor.
  }
}

function markDriverRidePassengerCancelledLocally(ride: Record<string, unknown>): void {
  const keys = getDriverRideIdentityKeys(ride);
  const now = new Date().toISOString();

  const record: DriverPassengerCancelledRideRecord = {
    id: normalizeDriverRideIdentityValue(ride.id ?? ride.rideId ?? ride.originalRideId ?? keys[0] ?? `passenger-cancelled-${Date.now()}`),
    keys,
    originText: typeof ride.originText === "string" ? ride.originText : null,
    destinationText: typeof ride.destinationText === "string" ? ride.destinationText : null,
    passengerEmail: typeof ride.passengerEmail === "string" ? ride.passengerEmail : null,
    cancellationReason:
      typeof ride.cancellationReason === "string"
        ? sanitizeDriverTripSafetyText(ride.cancellationReason, 240)
        : null,
    cancellationReasonLabel:
      typeof ride.passengerCancellationReasonLabel === "string"
        ? sanitizeDriverTripSafetyText(ride.passengerCancellationReasonLabel, 180)
        : typeof ride.cancellationReasonLabel === "string"
          ? sanitizeDriverTripSafetyText(ride.cancellationReasonLabel, 180)
          : null,
    cancellationReasonCode:
      typeof ride.passengerCancellationReasonCode === "string"
        ? sanitizeDriverTripSafetyText(ride.passengerCancellationReasonCode, 80)
        : typeof ride.cancellationReasonCode === "string"
          ? sanitizeDriverTripSafetyText(ride.cancellationReasonCode, 80)
          : null,
    cancelledAt:
      typeof ride.cancelledAt === "string" && ride.cancelledAt.trim()
        ? ride.cancelledAt
        : now,
    cancelledByRole: "passenger",
  };

  const current = readDriverPassengerCancelledRideRecords();
  saveDriverPassengerCancelledRideRecords([
    record,
    ...current.filter((item) => !item.keys.some((key) => keys.includes(key))),
  ]);
}

function wasDriverRidePassengerCancelledLocally(ride: Record<string, unknown>): boolean {
  const keys = getDriverRideIdentityKeys(ride);
  if (keys.length === 0) return false;

  return readDriverPassengerCancelledRideRecords().some((record) =>
    record.keys.some((key) => keys.includes(key)),
  );
}

function readPassengerCancelledRideRecordsForDriver(): Array<Record<string, unknown>> {
  const results: Array<Record<string, unknown>> = [];

  for (const key of RAPAGO_PASSENGER_CANCEL_STORAGE_KEYS_FOR_DRIVER) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        results.push(...parsed.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")));
      } else if (parsed && typeof parsed === "object") {
        results.push(parsed as Record<string, unknown>);
      }
    } catch {
      // Ignora storage corrupto.
    }
  }

  try {
    const raw = localStorage.getItem("rapago_last_scheduled_ride_for_admin");
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (parsed && typeof parsed === "object") results.push(parsed as Record<string, unknown>);
  } catch {
    // Ignora storage corrupto.
  }

  return results.filter(isRidePassengerCancelledForDriver);
}

function driverRideMatchesPassengerCancelledRecord(
  activeRide: Record<string, unknown>,
  cancelledRide: Record<string, unknown>,
): boolean {
  // Una cancelación antigua nunca debe borrar un viaje que fue aceptado después.
  // Este era el motivo por el cual el mapa desaparecía al aceptar una solicitud nueva
  // con una ruta parecida a un viaje cancelado anteriormente.
  if (cancellationRecordIsOlderThanAcceptedRide(activeRide, cancelledRide)) {
    return false;
  }

  const activeIds = getDriverRideDirectIds(activeRide);
  const cancelledIds = new Set(getDriverRideDirectIds(cancelledRide));

  if (activeIds.some((id) => cancelledIds.has(id))) return true;

  // Si ambos registros tienen ID y no coinciden, son viajes distintos aunque la ruta sea igual.
  if (activeIds.length > 0 && cancelledIds.size > 0) return false;

  const activeOrigin = normalizeDriverRideIdentityValue(activeRide.originText);
  const activeDestination = normalizeDriverRideIdentityValue(activeRide.destinationText);
  const activePassengerEmail = normalizeDriverRideIdentityValue(
    activeRide.passengerEmail ?? activeRide.userEmail ?? activeRide.email,
  );
  const activeSchedule = normalizeDriverRideIdentityValue(
    activeRide.scheduledAt ?? activeRide.scheduledPickupAt ?? activeRide.requestedAt ?? activeRide.createdAt,
  );

  const cancelledOrigin = normalizeDriverRideIdentityValue(cancelledRide.originText);
  const cancelledDestination = normalizeDriverRideIdentityValue(cancelledRide.destinationText);
  const cancelledPassengerEmail = normalizeDriverRideIdentityValue(
    cancelledRide.passengerEmail ?? cancelledRide.userEmail ?? cancelledRide.email,
  );
  const cancelledSchedule = normalizeDriverRideIdentityValue(
    cancelledRide.scheduledAt ?? cancelledRide.scheduledPickupAt ?? cancelledRide.requestedAt ?? cancelledRide.createdAt,
  );

  // La comparación por ruta es solo un respaldo para registros antiguos sin ID.
  // Exigimos fecha de cancelación real para no confundir dos solicitudes iguales.
  const cancelledAt = getDriverRideCancellationTimestampMs(cancelledRide);
  if (cancelledAt == null) return false;

  return Boolean(
    activeOrigin &&
      activeDestination &&
      cancelledOrigin &&
      cancelledDestination &&
      activeOrigin === cancelledOrigin &&
      activeDestination === cancelledDestination &&
      (!activePassengerEmail || !cancelledPassengerEmail || activePassengerEmail === cancelledPassengerEmail) &&
      (!activeSchedule || !cancelledSchedule || activeSchedule === cancelledSchedule),
  );
}

function findPassengerCancelledRideForDriver(ride: Record<string, unknown>): Record<string, unknown> | null {
  if (isRidePassengerCancelledForDriver(ride)) return ride;

  return (
    readPassengerCancelledRideRecordsForDriver().find((cancelledRide) =>
      driverRideMatchesPassengerCancelledRecord(ride, cancelledRide),
    ) ?? null
  );
}

function removeDriverRideAfterPassengerCancel(cancelledRide: Record<string, unknown>): void {
  const activeKeys = [
    "rapago_last_accepted_ride",
    "rapago_driver_active_ride",
    "rapago_driver_active_ride_v1",
    "rapago_current_driver_location",
  ];

  for (const key of activeKeys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        localStorage.removeItem(key);
        continue;
      }

      const parsed = JSON.parse(raw) as unknown;
      const rideRecord = getDriverRideRecordFromPossibleWrapper(parsed);
      if (rideRecord && driverRideMatchesPassengerCancelledRecord(rideRecord, cancelledRide)) {
        localStorage.removeItem(key);
      }
    } catch {
      localStorage.removeItem(key);
    }
  }

  const arrayKeys = [
    "rapago_local_driver_assigned_rides",
    "rapago_driver_scheduled_queue",
    "rapago_driver_active_rides_v1",
    "rapago_driver_my_rides_v1",
    ...DRIVER_SCHEDULED_RESERVATION_KEYS,
  ];

  for (const key of arrayKeys) {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
      if (!Array.isArray(parsed)) continue;

      const next = parsed.filter((item) => !driverRideMatchesPassengerCancelledRecord(item, cancelledRide));
      localStorage.setItem(key, JSON.stringify(next.slice(0, 200)));
    } catch {
      // No bloquea el retiro visual.
    }
  }

  for (const key of [DRIVER_RESERVATION_INBOX_KEY, DRIVER_RESERVATION_INBOX_BY_DRIVER_KEY]) {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? (JSON.parse(raw) as Record<string, Array<Record<string, unknown>>>) : {};
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) continue;

      const next: Record<string, Array<Record<string, unknown>>> = {};
      for (const [driverKey, list] of Object.entries(parsed)) {
        const current = Array.isArray(list) ? list : [];
        next[driverKey] = current
          .filter((item) => !driverRideMatchesPassengerCancelledRecord(item, cancelledRide))
          .slice(0, 80);
      }

      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // No bloquea el retiro visual.
    }
  }

  try {
    const rideId = String(cancelledRide.id ?? cancelledRide.rideId ?? cancelledRide.originalRideId ?? "").trim();
    if (rideId) clearDriverLiveLocationForPassenger(rideId);
  } catch {
    // No bloquea el retiro visual.
  }
  window.dispatchEvent(
    new CustomEvent("rapago:driver-rides-updated", {
      detail: { removedAfterPassengerCancel: true },
    }),
  );

  window.dispatchEvent(
    new CustomEvent("rapago:driver-available-rides-updated", {
      detail: { removedAfterPassengerCancel: true },
    }),
  );
}



function readRequeuedAvailableRides(): AvailableRideData[] {
  try {
    const raw = localStorage.getItem(RAPAGO_REQUEUED_RIDES_KEY);
    const parsed = raw ? (JSON.parse(raw) as AvailableRideData[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRequeuedAvailableRides(rides: AvailableRideData[]): void {
  try {
    const byId = new Map<string, AvailableRideData>();
    for (const ride of rides) {
      if (!byId.has(ride.id)) byId.set(ride.id, ride);
    }
    const deduped = Array.from(byId.values()).slice(0, 100);
    localStorage.setItem(RAPAGO_REQUEUED_RIDES_KEY, JSON.stringify(deduped));
    localStorage.setItem(RAPAGO_REQUEUED_PASSENGER_FORCE_KEY, JSON.stringify(deduped));
    window.dispatchEvent(new CustomEvent(RAPAGO_REQUEUED_RIDES_EVENT, { detail: { rides: deduped } }));
  } catch {
    // No bloquea el re-encolamiento local.
  }
}

function pushPassengerNotification(notification: Omit<PassengerNotificationPayload, "id" | "createdAt" | "read">): void {
  try {
    const raw = localStorage.getItem(RAPAGO_PASSENGER_NOTIFICATIONS_KEY);
    const parsed = raw ? (JSON.parse(raw) as PassengerNotificationPayload[]) : [];
    const current = Array.isArray(parsed) ? parsed : [];
    const next: PassengerNotificationPayload = {
      ...notification,
      id: `notification-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      createdAt: new Date().toISOString(),
      read: false,
    };

    localStorage.setItem(RAPAGO_PASSENGER_NOTIFICATIONS_KEY, JSON.stringify([next, ...current].slice(0, 80)));
    window.dispatchEvent(new CustomEvent("rapago:passenger-notification", { detail: next }));
  } catch {
    // No bloquea la cancelación.
  }
}

function requeueRideAfterDriverCancel(ride: DriverRideData, driverUser?: unknown): AvailableRideData {
  const now = new Date().toISOString();
  const cancelledDriverEmail = getDriverLiveUserField(driverUser, "email");

  const requeued = markRideSkippedByCurrentDriver(
    {
      ...(ride as unknown as Record<string, unknown>),
      originalRideId: ride.id,
      status: "requested",
      cancelledAt: null,
      cancellationReason: null,
      cancelledByRole: null,
      cancelledBy: null,
      driverId: null,
      driverUserId: null,
      driverName: null,
      driverPhone: null,
      assignedDriverId: null,
      assignedDriverUserId: null,
      assignedDriverEmail: null,
      assignedDriverName: null,
      assignedDriverKeys: [],
      driverRatingAverage: null,
      driverRatingCount: null,
      driverVehicleBrand: null,
      driverVehicleModel: null,
      driverVehicleColor: null,
      driverVehiclePlate: null,
      driverVehicleYear: null,
      driverVehicleImageDataUrl: null,
      driverVehicleImageName: null,
      acceptedAt: null,
      enRouteAt: null,
      arrivedAt: null,
      startedAt: null,
      driverScheduleResponse: null,
      scheduledDriverResponse: null,
      driverReservationResponse: null,
      scheduledReservationNavigationStarted: false,
      driverStartedScheduledReservation: false,
      driverStartedScheduledReservationAt: null,
      scheduledReservationStartedAt: null,
      navigationStartedAt: null,
      scheduleStatus: "pending_driver",
      adminScheduleStatus: "pending_driver",
      reservationStatus: "pending_driver",
      driverAssignmentStatus: "pending_driver",
      availableForDrivers: true,
      reassignmentNeeded: true,
      needsNextAvailableDriver: true,
      requeuedAt: now,
      requeuedReason: "driver_cancelled",
      forceActiveAfterDriverCancel: true,
      cancelledByDriverEmail: cancelledDriverEmail ?? null,
      passengerNotice: "Tu conductor canceló el viaje, estamos buscando uno nuevo.",
      passengerNotification: "Tu conductor canceló el viaje, estamos buscando uno nuevo.",
    },
    driverUser,
    "driver_cancelled",
  ) as unknown as AvailableRideData;

  saveRequeuedAvailableRides([requeued, ...readRequeuedAvailableRides()]);

  try {
    const passengerRideKeys = [
      "rapago_local_passenger_rides",
      "rapago_admin_scheduled_rides",
      "rapago_admin_scheduled_rides_v1",
      "rapago_admin_scheduled_rides_v2",
      "rapago_admin_scheduled_rides_force_v1",
      "rapago_bridge_scheduled_rides_v1",
    ];

    for (const key of passengerRideKeys) {
      const raw = localStorage.getItem(key);
      const parsed = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
      const current = Array.isArray(parsed) ? parsed : [];
      let found = false;

      const next = current.map((item) => {
        const sameId = driverRideIdentityMatches(item, ride as unknown as Record<string, unknown>);
        const sameRoute =
          String(item.originText ?? "").trim().toLowerCase() === String(ride.originText ?? "").trim().toLowerCase() &&
          String(item.destinationText ?? "").trim().toLowerCase() === String(ride.destinationText ?? "").trim().toLowerCase() &&
          String(item.passengerEmail ?? "").trim().toLowerCase() === String((ride as unknown as Record<string, unknown>).passengerEmail ?? "").trim().toLowerCase();

        if (!sameId && !sameRoute) return item;
        found = true;

        return {
          ...item,
          ...requeued,
          id: String(item.id ?? ride.id),
          originalRideId: ride.id,
          status: "requested",
          cancelledAt: null,
          cancellationReason: null,
          cancelledByRole: null,
          cancelledBy: null,
          driverId: null,
          driverUserId: null,
          driverName: null,
          driverPhone: null,
          assignedDriverId: null,
          assignedDriverUserId: null,
          assignedDriverEmail: null,
          assignedDriverName: null,
          assignedDriverKeys: [],
          acceptedAt: null,
          enRouteAt: null,
          arrivedAt: null,
          startedAt: null,
          driverScheduleResponse: null,
          scheduledDriverResponse: null,
          driverReservationResponse: null,
          scheduledReservationNavigationStarted: false,
          driverStartedScheduledReservation: false,
          driverStartedScheduledReservationAt: null,
          scheduledReservationStartedAt: null,
          navigationStartedAt: null,
          scheduleStatus: "pending_driver",
          adminScheduleStatus: "pending_driver",
          reservationStatus: "pending_driver",
          driverAssignmentStatus: "pending_driver",
          availableForDrivers: true,
          reassignmentNeeded: true,
          needsNextAvailableDriver: true,
          requeuedAt: now,
          requeuedReason: "driver_cancelled",
          forceActiveAfterDriverCancel: true,
          passengerNotice: "Tu conductor canceló el viaje, estamos buscando uno nuevo.",
          passengerNotification: "Tu conductor canceló el viaje, estamos buscando uno nuevo.",
        } as Record<string, unknown>;
      });

      // Si el viaje venía solo desde backend y no estaba en localStorage,
      // lo insertamos para que el pasajero lo vea nuevamente como "Buscando conductor".
      if (!found && key === "rapago_local_passenger_rides") {
        next.unshift({
          ...(requeued as unknown as Record<string, unknown>),
          id: ride.id,
          originalRideId: ride.id,
          status: "requested",
          forceActiveAfterDriverCancel: true,
        });
      }

      localStorage.setItem(key, JSON.stringify(next.slice(0, 200)));
    }

    window.dispatchEvent(new CustomEvent("rapago:passenger-rides-updated"));
    window.dispatchEvent(new CustomEvent("rapago:driver-available-rides-updated", { detail: { ride: requeued } }));
    window.dispatchEvent(new CustomEvent(RAPAGO_REQUEUED_RIDES_EVENT, { detail: { ride: requeued, rides: readRequeuedAvailableRides() } }));
  } catch {
    // No bloquea la cancelación.
  }

  pushPassengerNotification({
    rideId: ride.id,
    type: "driver_cancelled_requeue",
    title: "Tu conductor canceló el viaje",
    body: "Estamos buscando un nuevo conductor disponible para tu solicitud.",
  });

  clearDriverLiveLocationForPassenger(ride.id);
  return requeued;
}

function removeRequeuedRide(rideId: string): void {
  saveRequeuedAvailableRides(readRequeuedAvailableRides().filter((ride) => ride.id !== rideId));
}

function isCancelledRideConflictMessage(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const lower = message.toLowerCase();

  return (
    lower.includes("409") ||
    lower.includes("conflict") ||
    lower.includes("current status is 'cancelled'") ||
    lower.includes('current status is "cancelled"') ||
    lower.includes("status is cancelled") ||
    lower.includes("estado actual es cancel") ||
    lower.includes("estado cancelado")
  );
}

function getAvailableRideById(rideId: string, extra: AvailableRideData[] = []): AvailableRideData | null {
  return (
    extra.find((ride) => ride.id === rideId) ??
    readRequeuedAvailableRides().find((ride) => ride.id === rideId) ??
    null
  );
}

function buildLocalAcceptedRideFromAvailable(
  ride: AvailableRideData,
  driverUser: unknown,
): DriverRideData {
  return enrichRideWithSelectedDriverVehicle(
    {
      ...(ride as unknown as Record<string, unknown>),
      status: "accepted",
      acceptedAt: new Date().toISOString(),
      driverName:
        getDriverLiveUserField(driverUser, "name") ??
        getDriverLiveUserField(driverUser, "email") ??
        "Conductor",
      driverPhone:
        getDriverLiveUserField(driverUser, "phone") ??
        getDriverLiveUserField(driverUser, "phoneNumber") ??
        getStoredDriverPublicPhone(driverUser),
      acceptedLocallyAfterRequeue: true,
      localBackendStatusConflictResolved: true,
    },
    driverUser,
  ) as unknown as DriverRideData;
}

function rideCanBeAcceptedLocallyAfterRequeue(ride: AvailableRideData | Record<string, unknown> | null): boolean {
  if (!ride) return false;
  const record = ride as Record<string, unknown>;
  const reason = String(record.requeuedReason ?? record.nextDriverSearchReason ?? "").toLowerCase();

  return (
    record.forceActiveAfterDriverCancel === true ||
    reason.includes("driver_cancelled") ||
    reason.includes("driver_rejected") ||
    Array.isArray(record.skippedDriverKeys) ||
    Array.isArray(record.rejectedByDriverKeys) ||
    Array.isArray(record.rejectedDriverKeys)
  );
}

function activeDriverRideBelongsToCurrentDriver(
  ride: Record<string, unknown>,
  user?: unknown,
): boolean {
  const currentKeys = new Set(
    getDriverScheduledReservationIdentityKeys(user)
      .map((key) => normalizeDriverReservationKey(key) ?? key)
      .filter(Boolean),
  );

  if (currentKeys.size === 0) return true;

  const rideDriverKeys = collectDriverReservationKeys([
    ride.driverId,
    ride.driverUserId,
    ride.assignedDriverId,
    ride.assignedDriverUserId,
    ride.acceptedDriverId,
    ride.acceptedByDriverId,
    ride.driverEmail,
    ride.assignedDriverEmail,
    ride.acceptedDriverEmail,
    ride.driverName,
    ride.assignedDriverName,
    ride.acceptedDriverName,
    ride.driverFullName,
    ride.assignedDriverKeys,
  ]).map((key) => normalizeDriverReservationKey(key) ?? key);

  if (rideDriverKeys.length === 0) return true;
  return rideDriverKeys.some((key) => currentKeys.has(key));
}

function normalizeActiveDriverRideForLocalMirror(
  ride: DriverRideData | Record<string, unknown>,
  user?: unknown,
): DriverRideData {
  const driverId = getDriverLiveUserField(user, "id") ?? getDriverLiveUserField(user, "userId") ?? null;
  const driverEmail = getDriverLiveUserField(user, "email");
  const driverName =
    getDriverLiveUserField(user, "name") ??
    getDriverLiveUserField(user, "fullName") ??
    getDriverLiveUserField(user, "displayName") ??
    driverEmail ??
    "Conductor";
  const driverPhone =
    getDriverLiveUserField(user, "phone") ??
    getDriverLiveUserField(user, "phoneNumber") ??
    getStoredDriverPublicPhone(user);
  const driverKeys = getDriverScheduledReservationIdentityKeys(user);
  const rawStatus = String((ride as unknown as Record<string, unknown>).status ?? "").toLowerCase();
  const activeStatus = ["accepted", "driver_en_route", "driver_arrived", "in_progress"].includes(rawStatus)
    ? rawStatus
    : "accepted";

  return enrichRideWithSelectedDriverVehicle(
    {
      ...(ride as unknown as Record<string, unknown>),
      status: activeStatus,
      acceptedAt: (ride as unknown as Record<string, unknown>).acceptedAt ?? new Date().toISOString(),
      driverId: (ride as unknown as Record<string, unknown>).driverId ?? driverId,
      driverUserId: (ride as unknown as Record<string, unknown>).driverUserId ?? driverId,
      assignedDriverId: (ride as unknown as Record<string, unknown>).assignedDriverId ?? driverId,
      assignedDriverUserId: (ride as unknown as Record<string, unknown>).assignedDriverUserId ?? driverId,
      driverEmail: (ride as unknown as Record<string, unknown>).driverEmail ?? driverEmail,
      assignedDriverEmail: (ride as unknown as Record<string, unknown>).assignedDriverEmail ?? driverEmail,
      driverName: (ride as unknown as Record<string, unknown>).driverName ?? driverName,
      assignedDriverName: (ride as unknown as Record<string, unknown>).assignedDriverName ?? driverName,
      driverPhone: (ride as unknown as Record<string, unknown>).driverPhone ?? driverPhone,
      assignedDriverKeys: Array.from(
        new Set([
          ...collectDriverReservationKeys([(ride as unknown as Record<string, unknown>).assignedDriverKeys]),
          ...driverKeys,
        ]),
      ),
      availableForDrivers: false,
      acceptedLocallyForActiveMap: true,
    },
    user,
  ) as unknown as DriverRideData;
}

function clearOlderDriverCancellationMarkersForAcceptedRide(
  acceptedRide: Record<string, unknown>,
  user?: unknown,
): void {
  const acceptedAt = getDriverRideAcceptedTimestampMs(acceptedRide) ?? Date.now();
  const directIds = new Set(getDriverRideDirectIds(acceptedRide));
  const driverEmail = normalizeDriverRideIdentityValue(getDriverLiveUserField(user, "email"));

  try {
    const current = readDriverCancelledActiveRides();
    const next = current.filter((record) => {
      const sameDriver =
        !record.driverEmail ||
        !driverEmail ||
        normalizeDriverRideIdentityValue(record.driverEmail) === driverEmail;
      if (!sameDriver) return true;

      const recordIds = record.keys.map(normalizeDriverRideIdentityValue).filter(Boolean);
      const exactIdMatch = recordIds.some((id) => directIds.has(id));
      const recordTime = new Date(String(record.cancelledAt ?? "")).getTime();

      return !(exactIdMatch && Number.isFinite(recordTime) && recordTime < acceptedAt);
    });

    if (next.length !== current.length) saveDriverCancelledActiveRides(next);
  } catch {
    // No bloquea la apertura del mapa.
  }

  try {
    const current = readDriverPassengerCancelledRideRecords();
    const next = current.filter((record) => {
      const recordIds = record.keys.map(normalizeDriverRideIdentityValue).filter(Boolean);
      const exactIdMatch = recordIds.some((id) => directIds.has(id));
      const recordTime = new Date(String(record.cancelledAt ?? "")).getTime();

      return !(exactIdMatch && Number.isFinite(recordTime) && recordTime < acceptedAt);
    });

    if (next.length !== current.length) saveDriverPassengerCancelledRideRecords(next);
  } catch {
    // No bloquea la apertura del mapa.
  }
}

function saveDriverActiveRideLocalMirror(
  ride: DriverRideData | Record<string, unknown>,
  user?: unknown,
): DriverRideData {
  const activeRide = normalizeActiveDriverRideForLocalMirror(ride, user);
  clearOlderDriverCancellationMarkersForAcceptedRide(
    activeRide as unknown as Record<string, unknown>,
    user,
  );
  const keys = [
    "rapago_driver_active_rides_v1",
    "rapago_local_driver_assigned_rides",
    "rapago_driver_my_rides_v1",
  ];

  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
      const current = Array.isArray(parsed) ? parsed : [];
      const next = [
        activeRide as unknown as Record<string, unknown>,
        ...current.filter((item) => !driverRideIdentityMatches(item, activeRide as unknown as Record<string, unknown>)),
      ].slice(0, 200);
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // No bloquea la apertura del mapa.
    }
  }

  try {
    localStorage.setItem(
      "rapago_last_accepted_ride",
      JSON.stringify({
        ride: activeRide,
        acceptedAt: new Date().toISOString(),
      }),
    );
  } catch {
    // No bloquea la apertura del mapa.
  }

  window.dispatchEvent(new CustomEvent("rapago:driver-rides-updated", { detail: { rideId: activeRide.id, status: activeRide.status } }));
  return activeRide;
}


const RAPAGO_DRIVER_NEXT_RIDES_KEY = "rapago_driver_next_rides_v1";
const RAPAGO_DRIVER_NEXT_RIDES_EVENT = "rapago:driver-next-rides-updated";

type DriverNextRideQueueRecord = DriverRideData & {
  queuedAfterRideId?: string | null;
  queuedAt?: string | null;
  queuedStatus?: "waiting_current_trip" | "promoted_to_active";
};

function removeDriverActiveRideLocalMirror(
  ride: DriverRideData | Record<string, unknown> | string,
  user?: unknown,
): void {
  const target = typeof ride === "string" ? { id: ride } : ride;
  const keys = [
    "rapago_driver_active_rides_v1",
    "rapago_local_driver_assigned_rides",
    "rapago_driver_my_rides_v1",
  ];

  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
      if (!Array.isArray(parsed)) continue;

      const next = parsed.filter((item) => !driverRideIdentityMatches(item, target as Record<string, unknown>));
      localStorage.setItem(key, JSON.stringify(next.slice(0, 200)));
    } catch {
      // No bloquea el cierre.
    }
  }

  try {
    const raw = localStorage.getItem("rapago_last_accepted_ride");
    const parsed = raw ? (JSON.parse(raw) as { ride?: Record<string, unknown> } | Record<string, unknown>) : null;
    const lastRide = parsed && typeof parsed === "object" && "ride" in parsed ? parsed.ride : parsed;

    if (lastRide && typeof lastRide === "object" && driverRideIdentityMatches(lastRide as Record<string, unknown>, target as Record<string, unknown>)) {
      localStorage.removeItem("rapago_last_accepted_ride");
    }
  } catch {
    // No bloquea el cierre.
  }

  window.dispatchEvent(new CustomEvent("rapago:driver-rides-updated", { detail: { ride, status: "completed" } }));
}

function readDriverNextRideQueue(user?: unknown): DriverNextRideQueueRecord[] {
  try {
    const raw = localStorage.getItem(RAPAGO_DRIVER_NEXT_RIDES_KEY);
    const parsed = raw ? (JSON.parse(raw) as DriverNextRideQueueRecord[]) : [];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((ride) => ride && typeof ride === "object")
      .filter((ride) => activeDriverRideBelongsToCurrentDriver(ride as unknown as Record<string, unknown>, user))
      .sort((a, b) => new Date(String(a.queuedAt ?? a.acceptedAt ?? 0)).getTime() - new Date(String(b.queuedAt ?? b.acceptedAt ?? 0)).getTime());
  } catch {
    return [];
  }
}

function writeDriverNextRideQueue(queue: DriverNextRideQueueRecord[]): void {
  try {
    localStorage.setItem(RAPAGO_DRIVER_NEXT_RIDES_KEY, JSON.stringify(queue.slice(0, 20)));
    window.dispatchEvent(new CustomEvent(RAPAGO_DRIVER_NEXT_RIDES_EVENT, { detail: { queue } }));
    window.dispatchEvent(new CustomEvent("rapago:driver-rides-updated", { detail: { queue } }));
  } catch {
    // No bloquea el viaje en cola.
  }
}

function saveDriverNextRideAfterCurrent(
  ride: DriverRideData | Record<string, unknown>,
  currentRide: DriverRideData | Record<string, unknown>,
  user?: unknown,
): DriverNextRideQueueRecord {
  const now = new Date().toISOString();
  const queuedRide = normalizeActiveDriverRideForLocalMirror(
    {
      ...(ride as unknown as Record<string, unknown>),
      status: "accepted",
      queuedAfterRideId: String((currentRide as Record<string, unknown>).id ?? ""),
      queuedAt: now,
      queuedStatus: "waiting_current_trip",
      driverHasCurrentRide: true,
      passengerNotice: "Tu conductor aceptó tu viaje y lo iniciará cuando termine su viaje actual.",
      passengerNotification: "Tu conductor está terminando un viaje anterior. Te avisaremos cuando vaya en camino.",
    },
    user,
  ) as DriverNextRideQueueRecord;

  const currentQueue = readDriverNextRideQueue(user);
  const nextQueue = [
    queuedRide,
    ...currentQueue.filter((item) => !driverRideIdentityMatches(item as unknown as Record<string, unknown>, queuedRide as unknown as Record<string, unknown>)),
  ];

  writeDriverNextRideQueue(nextQueue);
  return queuedRide;
}

function getDriverNextRideForActiveRide(
  activeRide: DriverRideData | Record<string, unknown> | null,
  user?: unknown,
): DriverNextRideQueueRecord | null {
  if (!activeRide) return readDriverNextRideQueue(user)[0] ?? null;

  const activeId = String((activeRide as Record<string, unknown>).id ?? "").trim();
  const queue = readDriverNextRideQueue(user);

  return queue.find((ride) => String(ride.queuedAfterRideId ?? "") === activeId) ?? queue[0] ?? null;
}

function promoteDriverNextRideAfterCompletion(
  completedRideId: string,
  user?: unknown,
): DriverRideData | null {
  const queue = readDriverNextRideQueue(user);
  if (queue.length === 0) return null;

  const index = queue.findIndex((ride) => String(ride.queuedAfterRideId ?? "") === completedRideId);
  const chosenIndex = index >= 0 ? index : 0;
  const chosen = queue[chosenIndex];
  const remaining = queue.filter((_, itemIndex) => itemIndex !== chosenIndex);
  writeDriverNextRideQueue(remaining);

  return saveDriverActiveRideLocalMirror(
    {
      ...(chosen as unknown as Record<string, unknown>),
      status: "accepted",
      queuedStatus: "promoted_to_active",
      queuedAfterRideId: null,
      previousRideCompletedAt: new Date().toISOString(),
      passengerNotice: "Tu conductor ya terminó su viaje anterior y va en camino.",
      passengerNotification: "Tu conductor va en camino.",
    },
    user,
  );
}

function readActiveDriverLocalRideMirrorsForDriver(user?: unknown): DriverRideData[] {
  const output: DriverRideData[] = [];
  const keys = [
    "rapago_driver_active_rides_v1",
    "rapago_local_driver_assigned_rides",
    "rapago_driver_my_rides_v1",
  ];

  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
      if (Array.isArray(parsed)) output.push(...(parsed as unknown as DriverRideData[]));
    } catch {
      // Ignora espejos locales antiguos.
    }
  }

  try {
    const raw = localStorage.getItem("rapago_last_accepted_ride");
    const parsed = raw ? (JSON.parse(raw) as { ride?: DriverRideData } | DriverRideData) : null;
    const ride = parsed && typeof parsed === "object" && "ride" in parsed ? parsed.ride : parsed;
    if (ride && typeof ride === "object") output.push(ride as DriverRideData);
  } catch {
    // Ignora último aceptado antiguo.
  }

  const byKey = new Map<string, DriverRideData>();
  for (const ride of output) {
    const status = String(ride.status ?? "").toLowerCase();
    if (!["accepted", "driver_en_route", "driver_arrived", "in_progress"].includes(status)) continue;
    if (wasDriverRideCancelledLocally(ride as unknown as Record<string, unknown>, user)) continue;
    if (!activeDriverRideBelongsToCurrentDriver(ride as unknown as Record<string, unknown>, user)) continue;

    const key = getDriverScheduledReservationDedupeKey(ride as unknown as DriverAcceptedRideBridgeRecord) || String(ride.id);
    if (key) byKey.set(key, ride);
  }

  return Array.from(byKey.values());
}

const RAPAGO_DRIVER_HANDLED_RIDE_REQUESTS_KEY = "rapago_driver_handled_ride_requests_v1";
const RAPAGO_DRIVER_RIDE_ALERT_STOP_EVENT = "rapago:driver-ride-alert-stop";

type DriverHandledRideRequestRecord = {
  key: string;
  rideId: string | null;
  driverKey: string;
  reason: "accepted" | "accepted_next" | "rejected" | "dismissed";
  handledAt: string;
  expiresAt: string;
};

function getDriverHandledRequestDriverKey(user?: unknown): string {
  const raw =
    getDriverLiveUserField(user, "id") ??
    getDriverLiveUserField(user, "userId") ??
    getDriverLiveUserField(user, "email") ??
    getDriverLiveUserField(user, "name") ??
    "driver-local";

  return normalizeDriverReservationKey(raw) ?? "driver-local";
}

function getDriverRideRequestStableKeys(ride: Partial<AvailableRideData> & Record<string, unknown>): string[] {
  const keys = new Set<string>();
  const id = String(ride.id ?? ride.rideId ?? ride.originalRideId ?? ride.serverRideId ?? "").trim();
  if (id) {
    keys.add(`id:${id}`);
    keys.add(id);
  }

  const dedupe = getDriverScheduledReservationDedupeKey(ride as unknown as DriverAcceptedRideBridgeRecord);
  if (dedupe) keys.add(`dedupe:${dedupe}`);

  const routeKey = [
    String(ride.passengerEmail ?? ride.email ?? "").trim().toLowerCase(),
    String(ride.originText ?? "").trim().toLowerCase(),
    String(ride.destinationText ?? "").trim().toLowerCase(),
    String(ride.requestedAt ?? ride.createdAt ?? ride.scheduledAt ?? "").trim(),
  ].join("|");
  if (routeKey.replace(/\|/g, "").trim()) keys.add(`route:${routeKey}`);

  return Array.from(keys).filter(Boolean);
}

function readDriverHandledRideRequests(): DriverHandledRideRequestRecord[] {
  try {
    const raw = localStorage.getItem(RAPAGO_DRIVER_HANDLED_RIDE_REQUESTS_KEY);
    const parsed = raw ? (JSON.parse(raw) as DriverHandledRideRequestRecord[]) : [];
    if (!Array.isArray(parsed)) return [];

    const now = Date.now();
    return parsed.filter((item) => {
      const expiresAt = new Date(String(item.expiresAt ?? "")).getTime();
      return item && typeof item === "object" && item.key && (!Number.isFinite(expiresAt) || expiresAt > now);
    });
  } catch {
    return [];
  }
}

function writeDriverHandledRideRequests(records: DriverHandledRideRequestRecord[]): void {
  try {
    const byKey = new Map<string, DriverHandledRideRequestRecord>();
    for (const record of records) {
      if (!record?.key) continue;
      byKey.set(`${record.driverKey}|${record.key}`, record);
    }

    localStorage.setItem(
      RAPAGO_DRIVER_HANDLED_RIDE_REQUESTS_KEY,
      JSON.stringify(Array.from(byKey.values()).slice(0, 260)),
    );
  } catch {
    // No bloquea la app.
  }
}

function markDriverRideRequestHandled(
  ride: Partial<AvailableRideData> & Record<string, unknown> | string,
  user?: unknown,
  reason: DriverHandledRideRequestRecord["reason"] = "accepted",
): void {
  const driverKey = getDriverHandledRequestDriverKey(user);
  const recordRide = typeof ride === "string" ? ({ id: ride } as Record<string, unknown>) : ride;
  const keys = getDriverRideRequestStableKeys(recordRide as Partial<AvailableRideData> & Record<string, unknown>);
  const rideId = String(recordRide.id ?? recordRide.rideId ?? recordRide.originalRideId ?? "").trim() || null;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString();
  const current = readDriverHandledRideRequests();
  const nextRecords = keys.map((key) => ({
    key,
    rideId,
    driverKey,
    reason,
    handledAt: now.toISOString(),
    expiresAt,
  }));

  writeDriverHandledRideRequests([...nextRecords, ...current]);
}

function driverRideRequestIsHandled(
  ride: Partial<AvailableRideData> & Record<string, unknown>,
  user?: unknown,
): boolean {
  const driverKey = getDriverHandledRequestDriverKey(user);
  const rideKeys = new Set(getDriverRideRequestStableKeys(ride));
  if (rideKeys.size === 0) return false;

  const handled = readDriverHandledRideRequests();
  if (handled.some((record) => record.driverKey === driverKey && rideKeys.has(record.key))) return true;

  // Si ya está como próximo servicio aceptado, no puede volver a sonar como solicitud nueva.
  if (readDriverNextRideQueue(user).some((queued) => driverRideIdentityMatches(queued as unknown as Record<string, unknown>, ride))) {
    return true;
  }

  // Si ya está activo para este conductor, tampoco debe volver a entrar a la cola.
  if (readActiveDriverLocalRideMirrorsForDriver(user).some((active) => driverRideIdentityMatches(active as unknown as Record<string, unknown>, ride))) {
    return true;
  }

  return false;
}

function stopAllDriverRideRequestAlerts(rideId?: string): void {
  window.dispatchEvent(
    new CustomEvent(RAPAGO_DRIVER_RIDE_ALERT_STOP_EVENT, {
      detail: { rideId, stoppedAt: new Date().toISOString() },
    }),
  );

  try {
    if ("vibrate" in navigator) navigator.vibrate(0);
  } catch {
    // noop
  }

  try {
    window.speechSynthesis?.cancel();
  } catch {
    // noop
  }
}

function removeHandledRideFromAvailableList<T extends { id?: string }>(
  rides: T[],
  target: Partial<AvailableRideData> & Record<string, unknown> | string,
): T[] {
  const record = typeof target === "string" ? ({ id: target } as Record<string, unknown>) : target;
  return rides.filter((item) => !driverRideIdentityMatches(item as unknown as Record<string, unknown>, record));
}



export function DriverRequestsPage(): JSX.Element {
  return <AssignedRidesPage mode="requests" />;
}

export function DriverActiveRidePage(): JSX.Element {
  return <AssignedRidesPage mode="active" />;
}

function formatClp(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return "$0 CLP";
  return `$${Math.round(Number(value)).toLocaleString("es-CL")} CLP`;
}

function formatCLPDriver(value: unknown): string {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    return "$0 CLP";
  }

  return `$${Math.round(amount).toLocaleString("es-CL")} CLP`;
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
    /Tarifa estimada pasajero:\s*\$?\s*([\d.,]+)\s*CLP/i,
    /Tarifa final(?: del viaje)?:\s*\$?\s*([\d.,]+)\s*CLP/i,
    /Precio final(?: del viaje)?:\s*\$?\s*([\d.,]+)\s*CLP/i,
    /Precio del viaje:\s*\$?\s*([\d.,]+)\s*CLP/i,
    /Total(?: del viaje| a pagar)?:\s*\$?\s*([\d.,]+)\s*CLP/i,
    /Monto(?: del viaje)?:\s*\$?\s*([\d.,]+)\s*CLP/i,
    /Efectivo\s*[•\-:]\s*\$?\s*([\d.,]+)\s*CLP/i,
    /Tarjeta\s*[•\-:]\s*\$?\s*([\d.,]+)\s*CLP/i,
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

type RideVehicleCategoryForDriver = "standard" | "xl" | "luggage";

type RideWithFarePayload = {
  estimatedFareClp?: number | string | null;
  fareClp?: number | string | null;
  priceClp?: number | string | null;
  totalFareClp?: number | string | null;
  totalPriceClp?: number | string | null;
  fareVehicleCategory?: string | null;
  vehicleCategory?: string | null;
  vehicleType?: string | null;
  requestedVehicleType?: string | null;
  requestedVehicleCategory?: string | null;
  notes?: string | null;
};

function readPositiveMoneyValue(value: unknown): number | null {
  const parsed =
    typeof value === "string" ? extractMoneyAmount(value) : Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed);
}

type DriverFastSearchInfo = {
  active: boolean;
  feeClp: number;
  paymentMethod: "cash" | "card" | null;
  paymentStatus: "approved" | "pending" | "rejected" | null;
};

function getDriverFastSearchInfo(
  ride: RideWithFarePayload & Record<string, unknown>,
): DriverFastSearchInfo {
  const notes = String(ride.notes ?? "");
  const active =
    /RAPAGO_FAST_SEARCH_ACTIVE:\s*true/i.test(notes) ||
    ride.rapagoFastSearchAccepted === true ||
    ride.fastSearchRequested === true ||
    ride.passengerPrioritySearch === true;

  const feeValue = Number(
    notes.match(/RAPAGO_FAST_SEARCH_FEE_CLP:\s*(\d+)/i)?.[1] ??
      ride.rapagoFastSearchFeeClp ??
      ride.fastSearchFeeClp ??
      800,
  );
  const feeClp = Number.isFinite(feeValue) && feeValue > 0
    ? Math.round(feeValue)
    : 800;

  const methodText = String(
    notes.match(/RAPAGO_FAST_SEARCH_PAYMENT_METHOD:\s*(cash|card)/i)?.[1] ??
      ride.rapagoFastSearchPaymentMethod ??
      ride.fastSearchPaymentMethod ??
      "",
  ).trim().toLowerCase();
  const statusText = String(
    notes.match(/RAPAGO_FAST_SEARCH_PAYMENT_STATUS:\s*(approved|pending|rejected)/i)?.[1] ??
      ride.rapagoFastSearchPaymentStatus ??
      ride.fastSearchPaymentStatus ??
      (active ? "approved" : ""),
  ).trim().toLowerCase();

  return {
    active,
    feeClp,
    paymentMethod:
      methodText === "card" ? "card" : methodText === "cash" ? "cash" : null,
    paymentStatus:
      statusText === "approved"
        ? "approved"
        : statusText === "pending"
          ? "pending"
          : statusText === "rejected"
            ? "rejected"
            : null,
  };
}

function DriverFastSearchBadge({
  ride,
  compact = false,
}: {
  ride: RideWithFarePayload & Record<string, unknown>;
  compact?: boolean;
}): JSX.Element | null {
  const info = getDriverFastSearchInfo(ride);
  if (!info.active || info.paymentStatus !== "approved") return null;

  const totalClp = getRideDisplayFareClp(ride);
  const isCard = info.paymentMethod === "card";

  return (
    <div
      role="status"
      style={{
        marginTop: compact ? 8 : 12,
        marginBottom: compact ? 8 : 12,
        padding: compact ? "10px 11px" : "13px 14px",
        borderRadius: compact ? 14 : 18,
        background: isCard
          ? "linear-gradient(135deg,#e8f2ff,#cfe2ff)"
          : "linear-gradient(135deg,#fff8dc,#ffe08a)",
        border: isCard ? "2px solid #2563eb" : "2px solid #d49b16",
        color: "#111111",
        boxShadow: "0 8px 20px rgba(0,0,0,.10)",
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
              fontSize: compact ? ".72rem" : ".76rem",
              fontWeight: 950,
              letterSpacing: ".04em",
              textTransform: "uppercase",
              color: isCard ? "#1d4ed8" : "#805900",
            }}
          >
            <IonIcon icon={flashOutline} aria-hidden="true" style={{ fontSize: "1em", verticalAlign: "-0.125em" }} /> RapaGo más veloz
          </div>
          <div
            style={{
              marginTop: 3,
              fontSize: compact ? ".78rem" : ".84rem",
              fontWeight: 900,
              lineHeight: 1.35,
            }}
          >
            El pasajero agregó {formatClp(info.feeClp)} para priorizar esta solicitud.
          </div>
        </div>

        <div
          style={{
            flexShrink: 0,
            padding: "6px 9px",
            borderRadius: 999,
            background: "#111827",
            color: "#ffffff",
            fontWeight: 950,
            fontSize: ".75rem",
          }}
        >
          +{formatClp(info.feeClp)}
        </div>
      </div>

      <div
        style={{
          marginTop: 9,
          paddingTop: 9,
          borderTop: "1px solid rgba(17,17,17,.16)",
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
          fontSize: ".76rem",
          fontWeight: 900,
          lineHeight: 1.35,
        }}
      >
        <span>
          {isCard ? (
            <>
              <IonIcon icon={checkmarkCircleOutline} aria-hidden="true" style={{ fontSize: "1em", verticalAlign: "-0.125em" }} /> Recargo pagado con Mercado Pago. No cobrar efectivo.
            </>
          ) : (
            <>
              <IonIcon icon={cashOutline} aria-hidden="true" style={{ fontSize: "1em", verticalAlign: "-0.125em" }} /> Cobrar el total actualizado en efectivo.
            </>
          )}
        </span>
        {totalClp != null && <strong>Total: {formatClp(totalClp)}</strong>}
      </div>
    </div>
  );
}

function getRideDisplayFareClp(ride: RideWithFarePayload): number | null {
  const record = ride as unknown as RideWithFarePayload & Record<string, unknown>;
  const fastSearch = getDriverFastSearchInfo(record);
  const directCandidates = [
    ride.estimatedFareClp,
    ride.totalFareClp,
    ride.totalPriceClp,
    ride.fareClp,
    ride.priceClp,
  ];

  // El backend guarda estimatedFareClp con los $800 ya incluidos.
  // Cuando la prioridad está activa, ese total real tiene preferencia sobre
  // la tarifa base antigua escrita en notes.
  if (fastSearch.active) {
    for (const value of directCandidates) {
      const parsed = readPositiveMoneyValue(value);
      if (parsed != null) return parsed;
    }

    const noteFare = extractFareFromNotes(ride.notes);
    if (noteFare != null) return noteFare + fastSearch.feeClp;
    return null;
  }

  const noteFare = extractFareFromNotes(ride.notes);
  if (noteFare != null) return noteFare;

  for (const value of directCandidates) {
    const parsed = readPositiveMoneyValue(value);
    if (parsed != null) return parsed;
  }

  return null;
}

function getDriverRideMinimumFareForNoShow(ride: Partial<DriverRideData> & Record<string, unknown>): number {
  const displayFare = getRideDisplayFareClp(ride as RideWithFarePayload);
  if (displayFare != null && displayFare > 0) return displayFare;

  const candidates = [ride.minimumFareClp, ride.minFareClp, ride.fareMinimumClp, ride.estimatedFareClp, ride.fareClp, ride.priceClp];
  for (const candidate of candidates) {
    const parsed = Number(candidate);
    if (Number.isFinite(parsed) && parsed > 0) return Math.round(parsed);
  }

  return 3000;
}

function getDriverRideNoShowFeeClp(ride: Partial<DriverRideData> & Record<string, unknown>): number {
  const applicableFareClp = Math.max(
    0,
    Math.round(getDriverRideMinimumFareForNoShow(ride)),
  );

  return Math.min(
    RAPAGO_DRIVER_NO_SHOW_CAP_CLP,
    Math.max(
      0,
      Math.round(
        applicableFareClp * (RAPAGO_DRIVER_NO_SHOW_PERCENT / 100),
      ),
    ),
  );
}

function getDriverNoShowDistribution(amountClp: number): {
  driverShareClp: number;
  platformShareClp: number;
} {
  const total = Math.max(0, Math.round(Number(amountClp) || 0));
  const driverShareClp = Math.floor(
    total * (RAPAGO_DRIVER_NO_SHOW_DRIVER_SHARE_PERCENT / 100),
  );

  return {
    driverShareClp,
    platformShareClp: total - driverShareClp,
  };
}

function getDriverRideArrivalTimestampMsForNoShow(ride: Partial<DriverRideData> & Record<string, unknown>): number | null {
  const candidates = [ride.arrivedAt, ride.driverArrivedAt, ride.driverReachedPickupAt, ride.updatedAt];
  for (const candidate of candidates) {
    const parsed = new Date(String(candidate ?? "")).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function getDriverNoShowState(ride: Partial<DriverRideData> & Record<string, unknown>, nowMs = Date.now()): {
  allowed: boolean;
  remainingMs: number;
  feeClp: number;
} {
  // Regla RAPA GO:
  // El contador de 5 minutos parte cuando la pantalla entra a "Esperando pasajero".
  // Así no se habilita No show por timestamps antiguos de pruebas/localStorage.
  return getDriverNoShowStateFromTimer(ride, nowMs);
}

function formatDriverNoShowRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

const RAPAGO_DRIVER_NO_SHOW_TIMER_KEY = "rapago_driver_no_show_timer_v1";

function readDriverNoShowTimerMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(RAPAGO_DRIVER_NO_SHOW_TIMER_KEY);
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

function writeDriverNoShowTimerMap(map: Record<string, number>): void {
  try {
    localStorage.setItem(RAPAGO_DRIVER_NO_SHOW_TIMER_KEY, JSON.stringify(map));
  } catch {
    // No bloquea el flujo del conductor.
  }
}

function ensureDriverNoShowTimerStartMs(
  ride: Partial<DriverRideData> & Record<string, unknown>,
  nowMs = Date.now(),
): number {
  const key = getDriverNoShowRideKey(ride);
  const current = readDriverNoShowTimerMap();
  const stored = Number(current[key]);

  if (Number.isFinite(stored) && stored > 0) return stored;

  const next = {
    ...current,
    [key]: nowMs,
  };

  writeDriverNoShowTimerMap(next);
  return nowMs;
}

function clearDriverNoShowTimer(ride: Partial<DriverRideData> & Record<string, unknown>): void {
  const key = getDriverNoShowRideKey(ride);
  const current = readDriverNoShowTimerMap();

  if (!(key in current)) return;

  delete current[key];
  writeDriverNoShowTimerMap(current);
}

function getDriverNoShowProgressPercent(state: { remainingMs: number }): number {
  const elapsed = RAPAGO_DRIVER_NO_SHOW_AFTER_ARRIVAL_MS - Math.max(0, state.remainingMs);
  return Math.max(0, Math.min(100, Math.round((elapsed / RAPAGO_DRIVER_NO_SHOW_AFTER_ARRIVAL_MS) * 100)));
}

function getDriverNoShowStateFromTimer(
  ride: Partial<DriverRideData> & Record<string, unknown>,
  nowMs = Date.now(),
): {
  allowed: boolean;
  remainingMs: number;
  feeClp: number;
} {
  const startAtMs = ensureDriverNoShowTimerStartMs(ride, nowMs);
  const remainingMs = Math.max(0, startAtMs + RAPAGO_DRIVER_NO_SHOW_AFTER_ARRIVAL_MS - nowMs);

  return {
    allowed: remainingMs <= 0,
    remainingMs,
    feeClp: getDriverRideNoShowFeeClp(ride),
  };
}

function getDriverNoShowRideKey(ride: Partial<DriverRideData> & Record<string, unknown>): string {
  const id = String(ride.id ?? ride.rideId ?? ride.originalRideId ?? "").trim();
  if (id) return `ride:${id}`;

  return [
    String(ride.passengerEmail ?? ride.email ?? "").trim().toLowerCase(),
    String(ride.originText ?? "").trim().toLowerCase(),
    String(ride.destinationText ?? "").trim().toLowerCase(),
    String(ride.acceptedAt ?? ride.requestedAt ?? ride.createdAt ?? "").trim(),
  ].filter(Boolean).join("|");
}



type DriverPassengerIdentityForNoShow = {
  userId: string | null;
  fullName: string | null;
  email: string | null;
  phone: string | null;
};

const RAPAGO_DRIVER_PASSENGER_IDENTITY_STORAGE_KEYS = [
  "rapago_local_passenger_rides",
  "rapago_driver_accepted_vehicle_rides_v1",
  "rapago_driver_accepted_rides_v1",
  "rapago_local_driver_assigned_rides",
  "rapago_driver_active_rides_v1",
  "rapago_last_accepted_ride",
  "rapago_admin_scheduled_rides",
  "rapago_admin_scheduled_rides_v1",
  "rapago_admin_scheduled_rides_v2",
  "rapago_admin_scheduled_rides_force_v1",
  "rapago_bridge_scheduled_rides_v1",
] as const;

function driverNoShowIdentityString(
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

function extractDriverNoShowPassengerNameFromNotes(
  notes: unknown,
): string {
  const text = repairDriverDisplayText(notes);
  if (!text.trim()) return "";

  const patterns = [
    /Nombre completo del pasajero\s*:\s*([^\n]+)/i,
    /Nombre del pasajero\s*:\s*([^\n]+)/i,
    /Nombre pasajero\s*:\s*([^\n]+)/i,
    /Pasajero\s*:\s*([^\n]+)/i,
    /Nombre del usuario\s*:\s*([^\n]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = String(match?.[1] ?? "")
      .replace(/\s+/g, " ")
      .trim();

    if (value) return value.slice(0, 120);
  }

  return "";
}

function readDriverPassengerIdentityMirror(
  ride: Record<string, unknown>,
): Record<string, unknown> | null {
  for (const key of RAPAGO_DRIVER_PASSENGER_IDENTITY_STORAGE_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw) as unknown;
      const candidates: Array<Record<string, unknown>> = [];

      if (Array.isArray(parsed)) {
        candidates.push(
          ...parsed.filter(
            (item): item is Record<string, unknown> =>
              Boolean(item && typeof item === "object"),
          ),
        );
      } else if (parsed && typeof parsed === "object") {
        const record = parsed as Record<string, unknown>;
        const nestedRide =
          record.ride && typeof record.ride === "object"
            ? (record.ride as Record<string, unknown>)
            : null;

        candidates.push(nestedRide ?? record);
      }

      const matched = candidates.find((candidate) =>
        driverRideIdentityMatches(candidate, ride),
      );

      if (matched) return matched;
    } catch {
      // Continúa con la siguiente fuente local.
    }
  }

  return null;
}

function getDriverPassengerIdentityForNoShow(
  ride: Record<string, unknown>,
): DriverPassengerIdentityForNoShow {
  const mirror = readDriverPassengerIdentityMirror(ride);
  const source = {
    ...(mirror ?? {}),
    ...ride,
  } as Record<string, unknown>;

  const firstName = driverNoShowIdentityString(source, [
    "passengerFirstName",
    "userFirstName",
    "firstName",
    "givenName",
  ]);
  const lastName = driverNoShowIdentityString(source, [
    "passengerLastName",
    "userLastName",
    "lastName",
    "familyName",
    "surname",
  ]);

  const fullName =
    driverNoShowIdentityString(source, [
      "passengerFullName",
      "passengerName",
      "userFullName",
      "userName",
      "customerName",
      "clientName",
    ]) ||
    [firstName, lastName].filter(Boolean).join(" ").trim() ||
    extractDriverNoShowPassengerNameFromNotes(source.notes);

  const email = driverNoShowIdentityString(source, [
    "passengerEmail",
    "userEmail",
    "customerEmail",
    "email",
  ]).toLowerCase();

  const phone = driverNoShowIdentityString(source, [
    "passengerPhone",
    "userPhone",
    "customerPhone",
    "phone",
    "mobile",
  ]);

  const userId = driverNoShowIdentityString(source, [
    "passengerUserId",
    "ownerUserId",
    "requesterUserId",
    "userId",
  ]);

  return {
    userId: userId || null,
    fullName: fullName || null,
    email: email || null,
    phone: phone || null,
  };
}

function getDriverRidePassengerPhoneForNoShow(ride: Partial<DriverRideData> & Record<string, unknown>): string {
  const identity = getDriverPassengerIdentityForNoShow(
    ride as Record<string, unknown>,
  );

  return String(
    identity.phone ??
      ride.passengerPhone ??
      ride.userPhone ??
      ride.phone ??
      ride.passengerMobile ??
      ride.mobile ??
      "",
  ).replace(/\D/g, "");
}


function getDriverPolicyChargeApiBaseUrl(): string {
  return getConfiguredApiOrigin();
}

async function declareDriverNoShowInBackend(
  accessToken: string,
  rideId: string,
): Promise<Record<string, unknown>> {
  const response = await fetch(
    `${getDriverPolicyChargeApiBaseUrl()}/api/rides/${encodeURIComponent(rideId)}/no-show`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({}),
    },
  );

  const payload = (await response
    .json()
    .catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    throw new Error(
      typeof payload.message === "string"
        ? payload.message
        : "No se pudo registrar el No Show en el backend.",
    );
  }

  return payload;
}

function buildDriverNoShowWhatsappUrl(ride: DriverRideData, feeClp: number): string | null {
  const phone = getDriverRidePassengerPhoneForNoShow(ride as DriverRideData & Record<string, unknown>);
  if (!phone) return null;

  const message = [
    "Hola, soy tu conductor de RAPA GO.",
    "Ya llegué al punto de recogida indicado en la app.",
    "La app registra 5 minutos de espera.",
    `Si no te presentas, se podrá marcar NO SHOW. El cargo referencial es 50% de la tarifa, con tope de $5.000: ${formatClp(feeClp)}.`,
    "El administrador debe revisar y aprobar el cargo antes de sumarlo a un próximo viaje.",
    `Viaje: ${getDriverRideRouteDisplayLabel(ride)}.`,
  ].join("\n");

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function buildDriverArrivedWhatsappUrl(ride: DriverRideData, feeClp: number): string | null {
  const phone = getDriverRidePassengerPhoneForNoShow(ride as DriverRideData & Record<string, unknown>);
  if (!phone) return null;

  const message = [
    "Hola, soy tu conductor de RAPA GO.",
    "Ya llegué al punto de recogida indicado en la app.",
    "Por favor sal ahora para iniciar el viaje.",
    `La app inicia una espera de 5 minutos. Si no te presentas, se puede marcar NO SHOW con un cargo referencial de 50% de la tarifa, tope $5.000: ${formatClp(feeClp)}.`,
    "El cargo queda pendiente de revisión administrativa.",
    `Viaje: ${getDriverRideRouteDisplayLabel(ride)}.`,
  ].join("\n");

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function notifyPassengerDriverArrivedByAppAndWhatsapp(ride: DriverRideData): void {
  const record = ride as DriverRideData & Record<string, unknown>;
  const feeClp = getDriverRideNoShowFeeClp(record);
  const rideId = String(record.id ?? record.rideId ?? "");
  const notification = {
    id: `driver-arrived-${rideId || Date.now()}`,
    rideId,
    type: "driver_arrived",
    title: "Tu conductor llegó",
    body: `Sal ahora al punto de recogida. Tienes 5 minutos antes de que pueda aplicar No show. Monto No show: ${formatClp(feeClp)}.`,
    createdAt: new Date().toISOString(),
    read: false,
  };

  let alreadyNotified = false;

  try {
    const raw = localStorage.getItem("rapago_passenger_notifications_v1");
    const parsed = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
    const current = Array.isArray(parsed) ? parsed : [];
    alreadyNotified = current.some((item) => String(item.id ?? "") === notification.id);

    if (!alreadyNotified) {
      localStorage.setItem(
        "rapago_passenger_notifications_v1",
        JSON.stringify([notification, ...current].slice(0, 100)),
      );
    }

    const arrivedPatch = {
      ...record,
      status: "driver_arrived",
      driverArrivedAt: record.driverArrivedAt ?? new Date().toISOString(),
      arrivedAt: record.arrivedAt ?? new Date().toISOString(),
      passengerNotice: "Tu conductor llegó al punto. Sal ahora para evitar No show.",
      passengerNotification: notification.body,
      noShowCountdownStartedAt: record.noShowCountdownStartedAt ?? new Date().toISOString(),
    };

    // Actualiza los puentes locales para que TripsPage del pasajero muestre mapa + mensaje al instante.
    for (const key of [
      "rapago_local_passenger_rides",
      "rapago_driver_accepted_vehicle_rides_v1",
      "rapago_driver_accepted_rides_v1",
      "rapago_admin_scheduled_rides",
      "rapago_admin_scheduled_rides_v1",
      "rapago_admin_scheduled_rides_v2",
      "rapago_admin_scheduled_rides_force_v1",
      "rapago_bridge_scheduled_rides_v1",
    ]) {
      try {
        const localRaw = localStorage.getItem(key);
        const localParsed = localRaw ? (JSON.parse(localRaw) as Array<Record<string, unknown>>) : [];
        if (!Array.isArray(localParsed)) continue;

        let found = false;
        const next = localParsed.map((item) => {
          if (!driverRideIdentityMatches(item, record)) return item;
          found = true;
          return { ...item, ...arrivedPatch };
        });

        if (!found && key === "rapago_local_passenger_rides") next.unshift(arrivedPatch);

        localStorage.setItem(key, JSON.stringify(next.slice(0, 220)));
      } catch {
        // No bloquea el aviso.
      }
    }

    window.dispatchEvent(new CustomEvent("rapago:passenger-notifications-updated", { detail: { notification } }));
    window.dispatchEvent(new CustomEvent("rapago:passenger-rides-updated", { detail: { ride: arrivedPatch, notification } }));
    window.dispatchEvent(new CustomEvent("rapago:driver-accepted-vehicle-updated", { detail: { ride: arrivedPatch } }));
  } catch {
    // No bloquea la llegada.
  }

  if (!alreadyNotified) {
    const url = buildDriverArrivedWhatsappUrl(ride, feeClp);
    if (url) {
      try {
        localStorage.setItem("rapago_driver_last_arrived_whatsapp_url", url);
      } catch {
        // Queda al menos el aviso por app.
      }
    }
  }
}

function notifyPassengerNoShowByAppAndWhatsapp(ride: DriverRideData, feeClp: number): void {
  const record = ride as DriverRideData & Record<string, unknown>;
  const passengerIdentity = getDriverPassengerIdentityForNoShow(record);
  const now = new Date().toISOString();
  const amountClp = Math.max(0, Math.round(Number(feeClp) || 0));
  const applicableFareClp = getDriverRideMinimumFareForNoShow(record);

  const rideId = String(
    record.id ??
    record.rideId ??
    record.originalRideId ??
    record.serverRideId ??
    "",
  ).trim();

  const rideKey = [
    String(record.passengerEmail ?? record.email ?? "").trim().toLowerCase(),
    String(record.originText ?? "").trim().toLowerCase(),
    String(record.destinationText ?? "").trim().toLowerCase(),
    String(record.scheduledAt ?? record.scheduledPickupAt ?? record.requestedAt ?? record.createdAt ?? "").trim(),
  ].filter(Boolean).join("|");

  const noShowRideId = rideId || rideKey || `no-show-${Date.now()}`;

  const title = "No show registrado";
  const body =
    `Tu conductor te esper? 5 minutos en el punto de recogida y no te presentaste. ` +
    `El viaje fue cerrado como No show. Monto referencial: ${formatClp(amountClp)}. ` +
    `Este cargo queda en revisi?n del administrador; si se aprueba, se cobrar? en tu pr?ximo viaje.`;

  const notification = {
    id: `driver-no-show-confirmed-${noShowRideId}`,
    rideId: noShowRideId,
    type: "driver_no_show_confirmed",
    title,
    body,
    createdAt: now,
    read: false,
  };

  const noShowRide = {
    ...record,
    id: noShowRideId,
    rideId: noShowRideId,
    status: "completed",
    completedAt: now,
    closedByDriverAt: now,
    driverClosedAt: now,
    driverNoShowClosed: true,
    noShowCompleted: true,
    noShowConfirmedByDriver: true,
    noShowConfirmedAt: now,
    noShowChargeClp: amountClp,
    noShowAdminReviewStatus: "pending_admin_review",
    adminReviewStatus: "backend_review_required",
    pendingAdminNoShowReview: true,
    passengerNotice: body,
    passengerNotification: body,
    passengerNoShowMessage: body,
    cancelledByRole: "driver_no_show",
    cancelledBy: "driver_no_show",
    cancellationReason: "No show: pasajero no se present? tras 5 minutos de espera.",
    driverFinalState: "no_show_completed",
    shouldHideActiveMap: true,
    localStorageFinancialAuthority: false,
  };

  const pendingCharge = {
    id: `driver-no-show-${noShowRideId}`,
    rideId: noShowRideId,
    rideKey,
    passengerUserId: passengerIdentity.userId,
    ownerUserId: passengerIdentity.userId,
    passengerEmail: passengerIdentity.email,
    ownerKey: passengerIdentity.userId || passengerIdentity.email,
    passengerName: passengerIdentity.fullName,
    originText: String(record.originText ?? ""),
    destinationText: String(record.destinationText ?? ""),
    amountClp,
    minimumFareClp: applicableFareClp,
    applicableFareClp,
    originalServiceAmountClp: applicableFareClp,
    originalNoShowServiceAmountClp: applicableFareClp,
    feePercent: RAPAGO_DRIVER_NO_SHOW_PERCENT,
    feeCapClp: RAPAGO_DRIVER_NO_SHOW_CAP_CLP,
    driverSharePercent: RAPAGO_DRIVER_NO_SHOW_DRIVER_SHARE_PERCENT,
    platformSharePercent: RAPAGO_DRIVER_NO_SHOW_PLATFORM_SHARE_PERCENT,
    driverShareClp: getDriverNoShowDistribution(amountClp).driverShareClp,
    platformShareClp: getDriverNoShowDistribution(amountClp).platformShareClp,
    type: "no_show",
    paymentMethod:
      String(record.paymentMethod ?? record.paymentType ?? "").trim() ||
      getRidePaymentMethodLabel(String(record.notes ?? "")),
    status: "backend_review_required",
    adminReviewStatus: "pending_admin_review",
    title: "No show pendiente de revisi?n",
    description: body,
    createdAt: now,
    appliedRideId: null,
    appliedAt: null,
    approvedAt: null,
    approvedBy: null,
    rejectedAt: null,
    rejectedBy: null,
    localStorageFinancialAuthority: false,
    backendAuthorityRequired: true,
    source: "driver_no_show",
  };

  try {
    const raw = localStorage.getItem("rapago_passenger_notifications_v1");
    const parsed = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
    const current = Array.isArray(parsed) ? parsed : [];

    const nextNotifications = [
      notification,
      ...current.filter((item) => item.id !== notification.id),
    ].slice(0, 100);

    localStorage.setItem("rapago_passenger_notifications_v1", JSON.stringify(nextNotifications));
  } catch {
    // No bloquea No show.
  }

  try {
    const raw = localStorage.getItem("rapago_passenger_no_show_completed_rides_v1");
    const parsed = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
    const current = Array.isArray(parsed) ? parsed : [];

    const next = [
      noShowRide,
      ...current.filter((item) => !driverRideIdentityMatches(item, record)),
    ].slice(0, 200);

    localStorage.setItem("rapago_passenger_no_show_completed_rides_v1", JSON.stringify(next));
  } catch {
    // No bloquea No show.
  }

  try {
    const raw = localStorage.getItem("rapago_passenger_pending_charges_v1");
    const parsed = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
    const current = Array.isArray(parsed) ? parsed : [];

    const nextCharges = [
      pendingCharge,
      ...current.filter((item) => String(item.id ?? "") !== String(pendingCharge.id)),
    ].slice(0, 250);

    localStorage.setItem("rapago_passenger_pending_charges_v1", JSON.stringify(nextCharges));
  } catch {
    // No bloquea No show.
  }

  const passengerRideKeys = [
    "rapago_local_passenger_rides",
    "rapago_driver_accepted_vehicle_rides_v1",
    "rapago_driver_accepted_rides_v1",
    "rapago_admin_scheduled_rides",
    "rapago_admin_scheduled_rides_v1",
    "rapago_admin_scheduled_rides_v2",
    "rapago_admin_scheduled_rides_force_v1",
    "rapago_bridge_scheduled_rides_v1",
  ];

  for (const key of passengerRideKeys) {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
      const current = Array.isArray(parsed) ? parsed : [];

      let found = false;
      const next = current.map((item) => {
        if (!driverRideIdentityMatches(item, record)) return item;
        found = true;
        return {
          ...item,
          ...noShowRide,
          status: "completed",
          shouldHideActiveMap: true,
        };
      });

      if (!found && key === "rapago_local_passenger_rides") {
        next.unshift(noShowRide);
      }

      localStorage.setItem(key, JSON.stringify(next.slice(0, 220)));
    } catch {
      // No bloquea No show.
    }
  }

  try {
    window.dispatchEvent(new CustomEvent("rapago:passenger-notifications-updated", {
      detail: { notification, ride: noShowRide, pendingCharge, noShowCompleted: true },
    }));

    window.dispatchEvent(new CustomEvent("rapago:passenger-rides-updated", {
      detail: { ride: noShowRide, notification, pendingCharge, noShowCompleted: true },
    }));

    window.dispatchEvent(new CustomEvent("rapago:passenger-pending-charge-updated", {
      detail: { charge: pendingCharge, ride: noShowRide, backendAuthorityRequired: true },
    }));

    window.dispatchEvent(new CustomEvent("rapago:admin-passenger-pending-charge-updated", {
      detail: { charge: pendingCharge, ride: noShowRide, backendAuthorityRequired: true },
    }));

    window.dispatchEvent(new CustomEvent("rapago:admin-rides-updated", {
      detail: { charge: pendingCharge, ride: noShowRide, noShowCompleted: true },
    }));

    window.dispatchEvent(new CustomEvent("rapago:wallet-updated", {
      detail: { charge: pendingCharge, ride: noShowRide, backendAuthorityRequired: true },
    }));
  } catch {
    // No bloquea No show.
  }

  try {
    const url = buildDriverNoShowWhatsappUrl(ride, amountClp);
    if (url) localStorage.setItem("rapago_driver_last_no_show_whatsapp_url", url);
  } catch {
    // WhatsApp queda manual, no se abre autom?tico.
  }
}

function saveDriverNoShowChargeForPassenger(
  ride: DriverRideData,
  user?: unknown,
): Record<string, unknown> {
  const record = ride as DriverRideData & Record<string, unknown>;
  const rideKey = getDriverNoShowRideKey(record);
  const feeClp = getDriverRideNoShowFeeClp(record);
  const applicableFareClp = getDriverRideMinimumFareForNoShow(record);
  const passengerIdentity = getDriverPassengerIdentityForNoShow(record);
  const now = new Date().toISOString();
  const rideId = String(record.id ?? record.rideId ?? record.originalRideId ?? "").trim();

  const charge = {
    id: `driver-no-show-${rideId || rideKey}`,
    rideId: rideId || rideKey,
    rideKey,
    passengerUserId: passengerIdentity.userId,
    ownerUserId: passengerIdentity.userId,
    passengerEmail: passengerIdentity.email,
    passengerName: passengerIdentity.fullName,
    passengerPhone: passengerIdentity.phone,
    originText: String(record.originText ?? ""),
    destinationText: String(record.destinationText ?? ""),
    amountClp: feeClp,
    minimumFareClp: applicableFareClp,
    applicableFareClp,
    originalServiceAmountClp: applicableFareClp,
    originalNoShowServiceAmountClp: applicableFareClp,
    feePercent: RAPAGO_DRIVER_NO_SHOW_PERCENT,
    feeCapClp: RAPAGO_DRIVER_NO_SHOW_CAP_CLP,
    driverSharePercent: RAPAGO_DRIVER_NO_SHOW_DRIVER_SHARE_PERCENT,
    platformSharePercent: RAPAGO_DRIVER_NO_SHOW_PLATFORM_SHARE_PERCENT,
    driverShareClp: getDriverNoShowDistribution(feeClp).driverShareClp,
    platformShareClp: getDriverNoShowDistribution(feeClp).platformShareClp,
    type: "no_show",
    paymentMethod: getRidePaymentMethodLabel(String(record.notes ?? "")),
    status: "pending_admin_review",
    adminReviewStatus: "pending_admin_review",
    createdAt: now,
    appliedRideId: null,
    appliedAt: null,
    title: "No show pendiente de revisión",
    description:
      `No show informado por conductor después de 5 minutos de espera. ` +
      `Cargo referencial: ${RAPAGO_DRIVER_NO_SHOW_PERCENT}% de la tarifa aplicable, ` +
      `con tope de ${formatClp(RAPAGO_DRIVER_NO_SHOW_CAP_CLP)}. ` +
      `Monto por revisar: ${formatClp(feeClp)}. El administrador debe aprobar o rechazar. ` +
      `Si se recauda, ${RAPAGO_DRIVER_NO_SHOW_DRIVER_SHARE_PERCENT}% corresponde al conductor y ` +
      `${RAPAGO_DRIVER_NO_SHOW_PLATFORM_SHARE_PERCENT}% a Rapa Go.`,
    driverId: String((user as Record<string, unknown> | null)?.id ?? record.driverId ?? record.driverUserId ?? "").trim() || null,
    driverEmail: String((user as Record<string, unknown> | null)?.email ?? record.driverEmail ?? "").trim() || null,
    driverName: String((user as Record<string, unknown> | null)?.name ?? record.driverName ?? "").trim() || null,
  };

  try {
    const raw = localStorage.getItem(RAPAGO_PASSENGER_PENDING_CHARGES_KEY_DRIVER);
    const parsed = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
    const current = Array.isArray(parsed) ? parsed : [];

    localStorage.setItem(
      RAPAGO_PASSENGER_PENDING_CHARGES_KEY_DRIVER,
      JSON.stringify([
        charge,
        ...current.filter((item) => String(item.id ?? "") !== String(charge.id) && String(item.rideKey ?? "") !== rideKey),
      ].slice(0, 250)),
    );

    window.dispatchEvent(new CustomEvent(RAPAGO_PASSENGER_PENDING_CHARGE_EVENT_DRIVER, { detail: { charge } }));
    window.dispatchEvent(new CustomEvent("rapago:admin-passenger-pending-charge-updated", { detail: { charge } }));
    window.dispatchEvent(new CustomEvent("rapago:admin-rides-updated", { detail: { charge } }));
    window.dispatchEvent(new CustomEvent("rapago:wallet-updated", { detail: { charge } }));
  } catch {
    // No bloquea el cierre por no show.
  }

  return charge;
}

function markPassengerRideNoShowCancelledFromDriver(
  ride: DriverRideData,
  charge: Record<string, unknown>,
): void {
  const cancelledAt = new Date().toISOString();
  const target = ride as DriverRideData & Record<string, unknown>;
  const cancelled = {
    ...target,
    status: "cancelled",
    cancelledAt,
    cancelledByRole: "driver_no_show",
    cancelledBy: "driver_no_show",
    cancellationReason: `No show confirmado por conductor. Cargo ${formatClp(Number(charge.amountClp ?? 0))} pendiente para el próximo viaje.`,
    passengerCancellationFeeClp: Number(charge.amountClp ?? 0),
    passengerCancellationPolicyType: "no_show",
    passengerCancellationPolicyText:
      "No show: 50% de la tarifa aplicable, con tope de $5.000, después de 5 minutos de espera. Requiere aprobación administrativa y, al recaudarse, se distribuye 50% al conductor y 50% a Rapa Go.",
    paymentPendingClp: Number(charge.amountClp ?? 0),
    passengerPendingChargeNextRide: false,
    passengerPendingChargeNotice:
      `Cargo referencial de ${formatClp(Number(charge.amountClp ?? 0))} por No Show. ` +
      "Queda pendiente de revisión del administrador y solo se sumará a un próximo viaje si se aprueba.",
  };

  const keys = [
    "rapago_local_passenger_rides",
    "rapago_admin_scheduled_rides",
    "rapago_admin_scheduled_rides_v1",
    "rapago_admin_scheduled_rides_v2",
    "rapago_admin_scheduled_rides_force_v1",
    "rapago_bridge_scheduled_rides_v1",
  ];

  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
      const current = Array.isArray(parsed) ? parsed : [];
      let found = false;
      const next = current.map((item) => {
        const same =
          driverRideIdentityMatches(item, target) ||
          (
            String(item.originText ?? "").trim().toLowerCase() === String(target.originText ?? "").trim().toLowerCase() &&
            String(item.destinationText ?? "").trim().toLowerCase() === String(target.destinationText ?? "").trim().toLowerCase()
          );

        if (!same) return item;
        found = true;
        return { ...item, ...cancelled };
      });

      if (!found && key === "rapago_local_passenger_rides") next.unshift(cancelled);
      localStorage.setItem(key, JSON.stringify(next.slice(0, 200)));
    } catch {
      // No bloquea el no show.
    }
  }

  window.dispatchEvent(new CustomEvent("rapago:passenger-rides-updated", { detail: { ride: cancelled, charge } }));
}


function getRidePaymentMethodLabel(notes: string | null | undefined): string {
  const text = String(notes ?? "").toLowerCase();
  if (
    text.includes("tarjeta") ||
    text.includes("mercadopago") ||
    text.includes("mercado pago") ||
    text.includes("prontopaga") ||
    text.includes("webpay")
  )
    return "Mercado Pago";
  if (text.includes("efectivo")) return "Efectivo";
  return "Pendiente";
}

function getRidePaymentIcon(notes: string | null | undefined): string {
  const label = getRidePaymentMethodLabel(notes);
  if (label === "Mercado Pago") return "💳";
  if (label === "Efectivo") return "💵";
  return "⌛";
}


const RAPAGO_DRIVER_CASH_CLOSURES_KEY = "rapago_driver_cash_closures_v1";
const RAPAGO_ADMIN_CASH_CLOSURES_KEY = "rapago_admin_cash_closures_v1";
const RAPAGO_ADMIN_CASH_CLOSURES_EVENT = "rapago:admin-cash-closures-updated";

type DriverCashClosureDecision = "exact" | "overpaid";

type DriverCashClosurePayload = {
  id: string;
  rideId: string;
  rideKey: string;
  originText: string;
  destinationText: string;
  fareClp: number;
  paidClp: number;
  overpaidClp: number;
  decision: DriverCashClosureDecision;
  paymentMethod: "cash";
  status: "completed";
  adminReviewStatus: "not_required" | "pending_admin";
  driverId?: string | null;
  driverUserId?: string | null;
  driverEmail?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  passengerName?: string | null;
  passengerEmail?: string | null;
  closedByDriverAt: string;
  createdAt: string;
  notes?: string | null;
};

function getDriverCashText(source: unknown, keys: string[]): string {
  if (!source || typeof source !== "object") return "";
  const record = source as Record<string, unknown>;

  for (const key of keys) {
    const value = String(record[key] ?? "").trim();
    if (value) return value;
  }

  return "";
}

function normalizeDriverCashText(value: unknown): string {
  return repairDriverDisplayText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isDriverCashRide(ride: Partial<DriverRideData> & Record<string, unknown>): boolean {
  const direct = normalizeDriverCashText(
    ride.paymentMethod ??
    ride.paymentType ??
    ride.payMethod ??
    ride.paymentLabel ??
    ride.methodOfPayment ??
    ride.paymentMethodLabel,
  );

  if (direct.includes("efectivo") || direct.includes("cash")) return true;

  const notes = normalizeDriverCashText(ride.notes);
  return notes.includes("efectivo") || notes.includes("cash");
}

function parseDriverCashAmountText(value: string): number | null {
  const cleaned = value.replace(/\./g, "").replace(/,/g, ".").replace(/[^\d.]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}

function getDriverCashRideKey(ride: Partial<DriverRideData> & Record<string, unknown>): string {
  const id = String(ride.id ?? ride.rideId ?? ride.originalRideId ?? ride.serverRideId ?? "").trim();
  if (id) return `ride:${id}`;

  return [
    String(ride.originText ?? "").trim().toLowerCase(),
    String(ride.destinationText ?? "").trim().toLowerCase(),
    String(ride.acceptedAt ?? ride.requestedAt ?? ride.createdAt ?? "").trim(),
  ].join("|");
}

function appendDriverCashClosureNoteOnce(
  notes: string | null | undefined,
  closure: DriverCashClosurePayload,
): string {
  const current = String(notes ?? "").trim();
  const marker = "Cierre efectivo conductor:";
  const line = closure.decision === "overpaid"
    ? `${marker} tarifa ${formatClp(closure.fareClp)}, cliente pagó ${formatClp(closure.paidClp)}, pagó demás ${formatClp(closure.overpaidClp)}. Revisión admin pendiente.`
    : `${marker} cliente pagó justo ${formatClp(closure.fareClp)}.`;

  if (current.toLowerCase().includes(marker.toLowerCase())) return current;
  return `${current}${current ? " " : ""}${line}`.trim();
}

function buildDriverCashClosurePayload(
  ride: DriverRideData,
  decision: DriverCashClosureDecision,
  paidAmountText: string,
  user?: unknown,
): DriverCashClosurePayload {
  const record = ride as DriverRideData & Record<string, unknown>;
  const fareClp = getRideDisplayFareClp(record as RideWithFarePayload) ?? 0;
  const parsedPaid = parseDriverCashAmountText(paidAmountText);
  const paidClp = decision === "exact"
    ? fareClp
    : Math.max(fareClp, parsedPaid ?? fareClp);
  const overpaidClp = Math.max(0, paidClp - fareClp);
  const now = new Date().toISOString();
  const rideId = String(record.id ?? record.rideId ?? "").trim();
  const rideKey = getDriverCashRideKey(record);

  return {
    id: `driver-cash-close-${rideId || rideKey}`,
    rideId: rideId || rideKey,
    rideKey,
    originText: String(record.originText ?? "Origen no informado"),
    destinationText: String(record.destinationText ?? "Destino no informado"),
    fareClp,
    paidClp,
    overpaidClp,
    decision,
    paymentMethod: "cash",
    status: "completed",
    adminReviewStatus: overpaidClp > 0 ? "pending_admin" : "not_required",
    driverId: getDriverCashText(user, ["id", "userId", "uid"]) || String(record.driverId ?? record.driverUserId ?? "") || null,
    driverUserId: getDriverCashText(user, ["userId", "id", "uid"]) || String(record.driverUserId ?? "") || null,
    driverEmail: getDriverCashText(user, ["email", "mail"]) || String(record.driverEmail ?? "") || null,
    driverName: getDriverCashText(user, ["name", "fullName", "displayName"]) || String(record.driverName ?? record.driverFullName ?? "") || null,
    driverPhone: getDriverCashText(user, ["phone", "phoneNumber", "mobile"]) || String(record.driverPhone ?? "") || null,
    passengerName: String(record.passengerName ?? record.userName ?? "") || null,
    passengerEmail: String(record.passengerEmail ?? record.email ?? "") || null,
    closedByDriverAt: now,
    createdAt: now,
    notes: overpaidClp > 0
      ? `Cliente pagó ${formatClp(paidClp)} en efectivo. Diferencia: ${formatClp(overpaidClp)}.`
      : `Cliente pagó justo ${formatClp(fareClp)} en efectivo.`,
  };
}

function buildDriverCashClosureRidePatch(
  ride: DriverRideData | Record<string, unknown>,
  closure: DriverCashClosurePayload | null | undefined,
): Record<string, unknown> {
  if (!closure) return {};

  return {
    cashClosure: closure,
    cashPaymentClosure: closure,
    driverCashClosure: closure,
    cashPaymentConfirmedByDriver: true,
    cashPaidClp: closure.paidClp,
    cashFareClp: closure.fareClp,
    cashOverpaidClp: closure.overpaidClp,
    cashPaymentDecision: closure.decision,
    cashClosedByDriverAt: closure.closedByDriverAt,
    paymentReceivedByDriverClp: closure.paidClp,
    paymentDifferenceClp: closure.overpaidClp,
    adminCashReviewStatus: closure.adminReviewStatus,
    adminPaymentReviewStatus: closure.adminReviewStatus,
    paymentMethod: "cash",
    paymentStatus: closure.overpaidClp > 0 ? "cash_overpaid_pending_admin" : "cash_paid_exact",
    notes: appendDriverCashClosureNoteOnce(String((ride as unknown as Record<string, unknown>).notes ?? ""), closure),
  };
}

function upsertDriverCashClosureStorage(key: string, closure: DriverCashClosurePayload): void {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as DriverCashClosurePayload[]) : [];
    const current = Array.isArray(parsed) ? parsed : [];
    const next = [
      closure,
      ...current.filter((item) => String(item.id ?? "") !== closure.id && String(item.rideId ?? "") !== closure.rideId),
    ].slice(0, 300);

    localStorage.setItem(key, JSON.stringify(next));
    sessionStorage.setItem(key, JSON.stringify(next));
  } catch {
    // No bloquea el cierre del viaje.
  }
}

function persistDriverCashClosureForAdmin(
  ride: DriverRideData | Record<string, unknown>,
  closure: DriverCashClosurePayload | null | undefined,
  user?: unknown,
): void {
  if (!closure) return;

  const patch = buildDriverCashClosureRidePatch(ride, closure);
  const enrichedRide = {
    ...(ride as unknown as Record<string, unknown>),
    ...patch,
    status: "completed",
    completedAt: closure.closedByDriverAt,
    closedByDriverAt: closure.closedByDriverAt,
  };

  upsertDriverCashClosureStorage(RAPAGO_DRIVER_CASH_CLOSURES_KEY, closure);
  upsertDriverCashClosureStorage(RAPAGO_ADMIN_CASH_CLOSURES_KEY, closure);
  upsertDriverCashClosureStorage("rapago_admin_cash_payment_closures_v1", closure);
  upsertDriverCashClosureStorage("rapago_cash_payment_reviews_v1", closure);

  try {
    localStorage.setItem("rapago_last_driver_cash_closure_for_admin", JSON.stringify(closure));
    sessionStorage.setItem("rapago_last_driver_cash_closure_for_admin", JSON.stringify(closure));
  } catch {
    // No bloquea el cierre.
  }

  const rideKeys = [
    "rapago_driver_my_rides_v1",
    "rapago_driver_active_rides_v1",
    "rapago_local_driver_assigned_rides",
    "rapago_local_passenger_rides",
    "rapago_admin_rides_v1",
    "rapago_admin_driver_rides_v1",
    "rapago_admin_scheduled_rides",
    "rapago_admin_scheduled_rides_v1",
    "rapago_admin_scheduled_rides_v2",
    "rapago_admin_scheduled_rides_force_v1",
    "rapago_bridge_scheduled_rides_v1",
  ];

  for (const key of rideKeys) {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
      if (!Array.isArray(parsed)) continue;

      let found = false;
      const next = parsed.map((item) => {
        if (!item || typeof item !== "object") return item;
        if (!driverRideIdentityMatches(item, ride as Record<string, unknown>)) return item;
        found = true;
        return { ...item, ...patch, status: "completed", completedAt: closure.closedByDriverAt, closedByDriverAt: closure.closedByDriverAt };
      });

      const finalList = found ? next : [enrichedRide, ...parsed];
      localStorage.setItem(key, JSON.stringify(finalList.slice(0, 250)));
    } catch {
      // No bloquea si un storage antiguo está corrupto.
    }
  }

  try {
    window.dispatchEvent(new CustomEvent(RAPAGO_ADMIN_CASH_CLOSURES_EVENT, { detail: { closure, ride: enrichedRide, user } }));
    window.dispatchEvent(new CustomEvent("rapago:driver-cash-closure-updated", { detail: { closure, ride: enrichedRide, user } }));
    window.dispatchEvent(new CustomEvent("rapago:admin-rides-updated", { detail: { closure, ride: enrichedRide, user } }));
    window.dispatchEvent(new CustomEvent("rapago:driver-rides-updated", { detail: { closure, ride: enrichedRide, user } }));
    window.dispatchEvent(new CustomEvent("rapago:passenger-rides-updated", { detail: { closure, ride: enrichedRide } }));
  } catch {
    // Eventos opcionales.
  }
}

async function persistDriverCashClosureInBackend(
  accessToken: string,
  rideId: string,
  closure: DriverCashClosurePayload | null | undefined,
): Promise<void> {
  if (!closure) return;

  await cashPaymentsService.close(accessToken, rideId, {
    paidClp: closure.paidClp,
    decision: closure.decision === "overpaid" ? "overpaid" : "exact",
    ...(closure.notes?.trim() ? { note: closure.notes.trim() } : {}),
  });
}

async function syncStoredDriverCashClosuresToBackend(accessToken: string): Promise<void> {
  try {
    const raw = localStorage.getItem(RAPAGO_DRIVER_CASH_CLOSURES_KEY);
    const parsed = raw ? (JSON.parse(raw) as DriverCashClosurePayload[]) : [];
    if (!Array.isArray(parsed) || parsed.length === 0) return;

    const unique = new Map<string, DriverCashClosurePayload>();
    for (const item of parsed) {
      const rideId = String(item?.rideId ?? "").trim();
      if (!rideId || !Number.isFinite(Number(item?.paidClp))) continue;
      if (!unique.has(rideId)) unique.set(rideId, item);
      if (unique.size >= 20) break;
    }

    for (const [rideId, closure] of unique) {
      try {
        await persistDriverCashClosureInBackend(accessToken, rideId, closure);
      } catch {
        // Se reintentará en la próxima entrada del conductor. El endpoint es
        // idempotente para el mismo viaje/monto y no duplica el cierre.
      }
    }
  } catch {
    // Storage local corrupto o no disponible: no bloquea la app.
  }
}

function DriverCashCloseRideOverlay({
  ride,
  user,
  loading = false,
  onCancel,
  onConfirm,
}: {
  ride: DriverRideData;
  user?: unknown;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: (ride: DriverRideData, cashClosure?: DriverCashClosurePayload | null) => void;
}): JSX.Element {
  const isCash = isDriverCashRide(ride as DriverRideData & Record<string, unknown>);
  const fareClp = getRideDisplayFareClp(ride as RideWithFarePayload) ?? 0;
  const [destinationOk, setDestinationOk] = useState(false);
  const [decision, setDecision] = useState<DriverCashClosureDecision>("exact");
  const [paidAmountText, setPaidAmountText] = useState("");
  const paidAmountClp = parseDriverCashAmountText(paidAmountText);
  const paidForPreview = decision === "exact" ? fareClp : (paidAmountClp ?? 0);
  const overpaidClp = Math.max(0, paidForPreview - fareClp);
  const canConfirm = destinationOk && (
    !isCash ||
    decision === "exact" ||
    (paidAmountClp != null && paidAmountClp > fareClp)
  );

  function confirmClose(): void {
    if (!canConfirm) return;

    const closure = isCash
      ? buildDriverCashClosurePayload(ride, decision, paidAmountText, user)
      : null;

    onConfirm(ride, closure);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: "var(--rp-z-modal)",
        background: "rgba(0,0,0,.62)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        padding: "10px 8px calc(92px + env(safe-area-inset-bottom))",
      }}
    >
      <style>{`
        .rapago-cash-close-input {
          --background: var(--rp-field-bg) !important;
          --color: var(--rp-field-fg) !important;
          --highlight-color-focused: var(--rp-gold) !important;
          background: var(--rp-field-bg) !important;
          border-radius: 18px !important;
          overflow: hidden;
        }
        .rapago-cash-close-input::part(native) {
          background: var(--rp-field-bg) !important;
          color: var(--rp-field-fg) !important;
          border-radius: 18px !important;
          min-height: 76px;
        }
        .rapago-cash-close-input ion-label {
          color: var(--rp-label) !important;
          font-size: .76rem !important;
          letter-spacing: .01em;
        }
        .rapago-cash-close-input ion-input {
          --background: transparent !important;
          --color: var(--rp-field-fg) !important;
          --placeholder-color: var(--rp-field-ph) !important;
          --placeholder-opacity: 1 !important;
          color: var(--rp-field-fg) !important;
          font-weight: 950;
        }
        .rapago-cash-close-input input {
          background: transparent !important;
          color: var(--rp-field-fg) !important;
          font-weight: 950 !important;
        }
      `}</style>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rapago-driver-cash-close-title"
        style={{
          width: "min(560px, calc(100vw - 16px))",
          maxHeight: "calc(100dvh - 108px)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          borderRadius: 24,
          background: "var(--rp-surface)",
          color: "var(--rp-text)",
          boxShadow: "0 22px 60px rgba(0,0,0,.45)",
          border: "1px solid var(--rp-border-c)",
        }}
      >
        {/* El encabezado verde y el scrim oscuro de fondo se mantienen fijos a
            propósito: son color semántico de "éxito" y un velo neutro, ambos
            funcionan igual en los dos temas sin necesitar tokens. Todo lo
            demás en esta tarjeta SÍ variaba: antes era #F6F2EC/#111/#ffffff
            fijos —un "recibo de papel" que no seguía data-rapago-theme— y en
            modo noche quedaba como un recuadro claro flotando sobre una app
            oscura. Es el mismo defecto que tenían el formulario de vehículo y
            el de datos personales antes de corregirlos. */}
        <div
          style={{
            padding: "16px 18px",
            background: "linear-gradient(135deg,#14532d,#22c55e)",
            color: "#fff",
            borderRadius: "24px 24px 0 0",
          }}
        >
          <div id="rapago-driver-cash-close-title" style={{ fontSize: "1.05rem", fontWeight: 950 }}>
            Cierre de carrera
          </div>
          <div style={{ marginTop: 3, fontSize: ".78rem", fontWeight: 800, opacity: .92 }}>
            Antes de tomar otro servicio, confirma destino y pago.
          </div>
        </div>

        {/* Cuerpo con scroll propio: flex:1 + minHeight:0 es lo que permite que
            se encoja dentro del maxHeight del diálogo en vez de empujarlo a
            crecer sin control (Safari/iOS necesita minHeight:0 explícito;
            sin él, un hijo flex nunca baja de su alto de contenido).
            El pie de botones YA NO vive aquí dentro como sticky: ver más abajo
            por qué eso rompía el diseño. */}
        <div
          style={{
            flex: "1 1 auto",
            minHeight: 0,
            padding: 12,
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <div
            style={{
              borderRadius: 18,
              background: "var(--rp-field-bg)",
              border: "1px solid var(--rp-border-c)",
              padding: 13,
              marginBottom: 12,
            }}
          >
            <div style={{ fontSize: ".72rem", fontWeight: 950, color: "var(--rp-ok-fg)", textTransform: "uppercase" }}>
              Viaje
            </div>
            <div style={{ marginTop: 5, fontWeight: 950, lineHeight: 1.3, color: "var(--rp-text)" }}>
              {getDriverRideRouteDisplayLabel(ride)}
            </div>
            <div style={{ marginTop: 7, fontSize: ".82rem", fontWeight: 900, color: "var(--rp-muted)" }}>
              Tarifa: {formatClp(fareClp)} · Pago: {isCash ? "Efectivo" : getRidePaymentMethodLabel(ride.notes)}
            </div>
          </div>

          <div
            style={{
              borderRadius: 18,
              background: destinationOk ? "var(--rp-ok-bg)" : "var(--rp-field-bg)",
              border: destinationOk ? "1px solid var(--rp-ok-bd)" : "1px solid var(--rp-border-c)",
              padding: 13,
              marginBottom: 12,
            }}
          >
            <div style={{ fontWeight: 950, marginBottom: 8, color: "var(--rp-text)" }}>
              ¿Llegaste bien al destino y el pasajero ya bajó?
            </div>
            <IonButton
              expand="block"
              color={destinationOk ? "success" : "warning"}
              onClick={() => setDestinationOk(true)}
              style={{ "--border-radius": "14px", fontWeight: 950 } as CSSProperties}
            >
              Sí, llegué bien al destino
            </IonButton>
          </div>

          {isCash && (
            <div
              style={{
                borderRadius: 20,
                background: "color-mix(in srgb, var(--rp-gold) 12%, var(--rp-surface))",
                border: "1px solid color-mix(in srgb, var(--rp-gold) 34%, transparent)",
                boxShadow: "0 14px 34px rgba(120,82,0,.09)",
                padding: 13,
                marginBottom: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
                <IonIcon icon={cashOutline} aria-hidden="true" style={{ color: "var(--rp-ok-fg)", fontSize: 24 }} />
                <div>
                  <div style={{ fontWeight: 950, color: "var(--rp-text)" }}>Pago en efectivo</div>
                  <div style={{ fontSize: ".74rem", color: "var(--rp-muted)", fontWeight: 800 }}>
                    Esto se enviará al panel Admin para cuadratura.
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                <IonButton
                  expand="block"
                  color={decision === "exact" ? "success" : "medium"}
                  fill={decision === "exact" ? "solid" : "outline"}
                  onClick={() => {
                    setDecision("exact");
                    setPaidAmountText("");
                  }}
                  style={{ "--border-radius": "14px", fontWeight: 950 } as CSSProperties}
                >
                  Pagó justo
                </IonButton>
                <IonButton
                  expand="block"
                  color={decision === "overpaid" ? "warning" : "medium"}
                  fill={decision === "overpaid" ? "solid" : "outline"}
                  onClick={() => setDecision("overpaid")}
                  style={{ "--border-radius": "14px", fontWeight: 950 } as CSSProperties}
                >
                  Pagó demás
                </IonButton>
              </div>

              {decision === "overpaid" && (
                <div style={{ marginTop: 12 }}>
                  <IonItem
                    className="rapago-cash-close-input"
                    lines="none"
                    style={{
                      "--background": "var(--rp-field-bg)",
                      "--color": "var(--rp-field-fg)",
                      "--highlight-color-focused": "var(--rp-gold)",
                      "--padding-start": "12px",
                      "--inner-padding-end": "12px",
                      border: "1px solid color-mix(in srgb, var(--rp-gold) 40%, transparent)",
                      borderRadius: 18,
                      background: "var(--rp-field-bg)",
                      boxShadow: "0 12px 26px rgba(120,82,0,.10)",
                    } as CSSProperties}
                  >
                    <IonLabel position="stacked" style={{ fontWeight: 950 }}>
                      ¿Cuánto pagó el cliente?
                    </IonLabel>
                    <IonInput
                      value={paidAmountText}
                      type="tel"
                      inputmode="numeric"
                      placeholder="Ej: 10000"
                      style={{
                        "--color": "var(--rp-field-fg)",
                        "--placeholder-color": "var(--rp-field-ph)",
                        "--placeholder-opacity": "1",
                        color: "var(--rp-field-fg)",
                        fontWeight: 950,
                        fontSize: "1rem",
                      } as CSSProperties}
                      onIonInput={(event) => setPaidAmountText(String(event.detail.value ?? "").replace(/[^0-9]/g, ""))}
                    />
                  </IonItem>

                  <div
                    style={{
                      marginTop: 10,
                      borderRadius: 14,
                      padding: "10px 12px",
                      background: paidAmountClp != null && paidAmountClp > fareClp ? "var(--rp-ok-bg)" : "var(--rp-warn-bg)",
                      color: paidAmountClp != null && paidAmountClp > fareClp ? "var(--rp-ok-fg)" : "var(--rp-warn-fg)",
                      fontSize: ".78rem",
                      fontWeight: 900,
                      lineHeight: 1.35,
                    }}
                  >
                    {paidAmountClp == null && "Ingresa el monto recibido."}
                    {paidAmountClp != null && paidAmountClp <= fareClp && "Para 'pagó demás', el monto recibido debe ser mayor a la tarifa."}
                    {paidAmountClp != null && paidAmountClp > fareClp && (
                      <>
                        Recibido: {formatClp(paidAmountClp)} · Pagó demás: {formatClp(overpaidClp)}
                        <br />Admin recibirá esta diferencia para revisión/cuadratura.
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {!isCash && (
            <div
              style={{
                borderRadius: 16,
                background: "var(--rp-info-bg)",
                color: "var(--rp-info-fg)",
                padding: "10px 12px",
                fontSize: ".78rem",
                fontWeight: 900,
                lineHeight: 1.35,
                marginBottom: 12,
              }}
            >
              Este viaje no está marcado como efectivo. Se cerrará sin pedir monto recibido.
            </div>
          )}
        </div>

        {/* Pie de botones como hermano flex fuera del scroll, no como
            position:sticky adentro. Con sticky, el alto reservado abajo del
            scroll (paddingBottom) era un número fijo adivinado; en pantallas
            angostas "Cerrar y enviar al admin" se parte en dos líneas, el pie
            crece más de lo reservado y queda montado sobre "Pago justo/Pago
            demás". Como hermano flex (flex:"0 0 auto"), el navegador le da
            exactamente el alto que necesita y el cuerpo de arriba cede ese
            espacio solo, sin importar cuántas líneas ocupe el texto. */}
        <div
          style={{
            flex: "0 0 auto",
            display: "grid",
            gridTemplateColumns: "1fr 1.35fr",
            gap: 8,
            padding: "10px 12px calc(12px + env(safe-area-inset-bottom))",
            background: "var(--rp-surface)",
            borderTop: "1px solid var(--rp-border-c)",
            boxShadow: "0 -12px 28px rgba(0,0,0,.08)",
          }}
        >
          <IonButton
            expand="block"
            color="medium"
            fill="outline"
            disabled={loading}
            onClick={onCancel}
            style={{ "--border-radius": "14px", fontWeight: 950 } as CSSProperties}
          >
            Seguir viaje
          </IonButton>
          <IonButton
            expand="block"
            color="success"
            disabled={!canConfirm || loading}
            onClick={confirmClose}
            style={{ "--border-radius": "14px", fontWeight: 950 } as CSSProperties}
          >
            {loading ? <IonSpinner name="dots" /> : isCash ? "Cerrar y enviar al admin" : "Cerrar carrera"}
          </IonButton>
        </div>
      </div>
    </div>
  );
}

function normalizeTripTypeText(value: unknown): string {
  return repairDriverDisplayText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getRideTripTypeLabel(notes: string | null | undefined): string {
  const text = normalizeTripTypeText(notes);

  if (
    text.includes("ida y vuelta") ||
    text.includes("ida-vuelta") ||
    text.includes("ida_vuelta") ||
    text.includes("roundtrip") ||
    text.includes("round trip") ||
    text.includes("round-trip") ||
    text.includes("return trip") ||
    text.includes("viaje ida vuelta") ||
    text.includes("tipo de viaje: ida")
  ) {
    return "Ida y vuelta";
  }

  if (
    text.includes("solo ida") ||
    text.includes("solo-ida") ||
    text.includes("solo_ida") ||
    text.includes("one way") ||
    text.includes("one-way") ||
    text.includes("ida simple") ||
    text.includes("tipo de viaje: solo")
  ) {
    return "Solo ida";
  }

  return "Solo ida";
}

function getRideTripTypeEmoji(notes: string | null | undefined): string {
  return getRideTripTypeLabel(notes) === "Ida y vuelta" ? "🔁" : "➡️";
}

function normalizeRideVehicleCategory(
  value: unknown,
): RideVehicleCategoryForDriver | null {
  const raw = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  if (!raw) return null;
  if (
    raw.includes("luggage") ||
    raw.includes("maleta") ||
    raw.includes("equipaje")
  )
    return "luggage";
  if (
    raw.includes("xl") ||
    raw.includes("extra grande") ||
    raw.includes("mas espacio")
  )
    return "xl";
  if (
    raw.includes("standard") ||
    raw.includes("estandar") ||
    raw.includes("normal") ||
    raw.includes("general")
  )
    return "standard";

  return null;
}

function extractVehicleCategoryFromNotes(
  notes: string | null | undefined,
): RideVehicleCategoryForDriver | null {
  const text = repairDriverDisplayText(notes);
  if (!text.trim()) return null;

  const patterns = [
    /Veh[ií]culo(?: seleccionado| seleccionada)?\s*:\s*([^\n.]+)/i,
    /Tipo de veh[ií]culo(?: seleccionado| seleccionada)?\s*:\s*([^\n.]+)/i,
    /Categor[ií]a de veh[ií]culo(?: seleccionado| seleccionada)?\s*:\s*([^\n.]+)/i,
    /Categor[ií]a veh[ií]culo(?: seleccionado| seleccionada)?\s*:\s*([^\n.]+)/i,
    /fareVehicleCategory\s*[:=]\s*([^\n.]+)/i,
    /vehicleCategory\s*[:=]\s*([^\n.]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const normalized = normalizeRideVehicleCategory(match?.[1]);
    if (normalized) return normalized;
  }

  return normalizeRideVehicleCategory(text);
}

function getRideVehicleCategory(
  ride: RideWithFarePayload,
): RideVehicleCategoryForDriver {
  const direct =
    normalizeRideVehicleCategory(ride.fareVehicleCategory) ??
    normalizeRideVehicleCategory(ride.vehicleCategory) ??
    normalizeRideVehicleCategory(ride.vehicleType) ??
    normalizeRideVehicleCategory(ride.requestedVehicleType) ??
    normalizeRideVehicleCategory(ride.requestedVehicleCategory) ??
    extractVehicleCategoryFromNotes(ride.notes);

  return direct ?? "standard";
}

function getRideVehicleLabel(category: RideVehicleCategoryForDriver): string {
  if (category === "xl") return "Vehículo XL";
  if (category === "luggage") return "Extra maletas";
  return "Estándar";
}

function getRideVehicleShortLabel(
  category: RideVehicleCategoryForDriver,
): string {
  if (category === "xl") return "XL";
  if (category === "luggage") return "Maletas";
  return "Estándar";
}

function getRideVehicleEmoji(category: RideVehicleCategoryForDriver): string {
  if (category === "xl") return "🚙";
  if (category === "luggage") return "🧳";
  return "🚗";
}

function getDriverEstimatedEarning(fareClp: number | null): number | null {
  if (fareClp == null) return null;
  return Math.round(fareClp * 0.85);
}

type DriverEarningsFilter = "today" | "week" | "month" | "all";
type DriverEarningsRide = DriverRideData & Record<string, unknown>;

function isDriverCompletedRide(ride: DriverEarningsRide): boolean {
  const status = String(ride.status ?? "").toLowerCase().trim();
  return status === "completed" || status === "complete" || status === "finished" || status === "done";
}

function getDriverEarningsRideDateMs(ride: DriverEarningsRide): number {
  const candidates = [
    ride.completedAt,
    ride.finishedAt,
    ride.endedAt,
    ride.updatedAt,
    ride.requestedAt,
    ride.createdAt,
  ];

  for (const candidate of candidates) {
    const parsed = new Date(String(candidate ?? "")).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }

  return 0;
}

function getDriverEarningsAmountClp(ride: DriverEarningsRide): number {
  const direct = [
    ride.driverEarningClp,
    ride.driverNetEarningClp,
    ride.driverPayoutClp,
    ride.earningClp,
    ride.payoutClp,
  ];

  for (const value of direct) {
    const parsed = readPositiveMoneyValue(value);
    if (parsed != null) return parsed;
  }

  return getDriverEstimatedEarning(getRideDisplayFareClp(ride as RideWithFarePayload)) ?? 0;
}

function readDriverEarningsLocalRides(user?: unknown): DriverEarningsRide[] {
  const output: DriverEarningsRide[] = [];
  const keys = [
    "rapago_driver_my_rides_v1",
    "rapago_driver_active_rides_v1",
    "rapago_local_driver_assigned_rides",
    "rapago_driver_scheduled_queue",
  ];

  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? (JSON.parse(raw) as unknown) : null;
      if (Array.isArray(parsed)) {
        output.push(...parsed.filter((item) => item && typeof item === "object") as DriverEarningsRide[]);
      }
    } catch {
      // Ignora storages antiguos o corruptos.
    }
  }

  try {
    const raw = localStorage.getItem("rapago_last_accepted_ride");
    const parsed = raw ? (JSON.parse(raw) as { ride?: DriverEarningsRide } | DriverEarningsRide) : null;
    const ride = parsed && typeof parsed === "object" && "ride" in parsed ? parsed.ride : parsed;
    if (ride && typeof ride === "object") output.push(ride as DriverEarningsRide);
  } catch {
    // No bloquea ganancias.
  }

  const driverEmail = String(getDriverLiveUserField(user, "email") ?? "").trim().toLowerCase();

  return output.filter((ride) => {
    if (!driverEmail) return true;
    const rideDriverEmail = String(ride.driverEmail ?? ride.email ?? "").trim().toLowerCase();
    return !rideDriverEmail || rideDriverEmail === driverEmail;
  });
}

function dedupeDriverEarningsRides(rides: DriverEarningsRide[]): DriverEarningsRide[] {
  const byKey = new Map<string, DriverEarningsRide>();

  for (const ride of rides) {
    const key = String(
      ride.id ??
        ride.rideId ??
        `${ride.originText ?? ""}|${ride.destinationText ?? ""}|${ride.completedAt ?? ride.updatedAt ?? ride.createdAt ?? ""}`,
    );

    const current = byKey.get(key);
    if (!current || getDriverEarningsRideDateMs(ride) >= getDriverEarningsRideDateMs(current)) {
      byKey.set(key, ride);
    }
  }

  return [...byKey.values()]
    .filter(isDriverCompletedRide)
    .sort((a, b) => getDriverEarningsRideDateMs(b) - getDriverEarningsRideDateMs(a));
}

function saveDriverCompletedRideForEarnings(ride: DriverEarningsRide, user?: unknown): void {
  try {
    const now = new Date().toISOString();
    const completedRide: DriverEarningsRide = {
      ...ride,
      status: "completed",
      completedAt: ride.completedAt ?? now,
      updatedAt: now,
      driverEarningClp: getDriverEarningsAmountClp(ride),
    };

    const raw = localStorage.getItem("rapago_driver_my_rides_v1");
    const parsed = raw ? (JSON.parse(raw) as DriverEarningsRide[]) : [];
    const current = Array.isArray(parsed) ? parsed : [];
    const next = dedupeDriverEarningsRides([completedRide, ...current, ...readDriverEarningsLocalRides(user)]);

    localStorage.setItem("rapago_driver_my_rides_v1", JSON.stringify(next.slice(0, 250)));
    window.dispatchEvent(new CustomEvent("rapago:driver-rides-updated", { detail: { ride: completedRide } }));
  } catch {
    // No bloquea la finalización si el navegador no permite guardar.
  }
}

function getDriverEarningsFilterStart(filter: DriverEarningsFilter): number {
  const now = new Date();

  if (filter === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  }

  if (filter === "week") {
    return now.getTime() - 7 * 24 * 60 * 60 * 1000;
  }

  if (filter === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  }

  return 0;
}

function csvEscapeDriverEarnings(value: unknown): string {
  const text = String(value ?? "").replace(/\r?\n/g, " ").trim();
  if (/[;"\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function exportDriverEarningsCsv(rides: DriverEarningsRide[], filter: DriverEarningsFilter): void {
  const headers = [
    "Fecha completado",
    "ID viaje",
    "Origen",
    "Destino",
    "Forma de pago",
    "Tipo viaje",
    "Precio pasajero CLP",
    "Ganancia conductor CLP",
    "Comision Rapa Go CLP",
  ];

  const rows = rides.map((ride) => {
    const fare = getRideDisplayFareClp(ride as RideWithFarePayload) ?? 0;
    const earning = getDriverEarningsAmountClp(ride);
    return [
      getDriverEarningsRideDateMs(ride)
        ? new Date(getDriverEarningsRideDateMs(ride)).toLocaleString("es-CL")
        : "",
      ride.id ?? ride.rideId ?? "",
      ride.originText ?? "",
      ride.destinationText ?? "",
      getRidePaymentMethodLabel(String(ride.notes ?? "")),
      getRideTripTypeLabel(String(ride.notes ?? "")),
      fare,
      earning,
      Math.max(0, fare - earning),
    ];
  });

  const totalFare = rides.reduce((sum, ride) => sum + (getRideDisplayFareClp(ride as RideWithFarePayload) ?? 0), 0);
  const totalEarning = rides.reduce((sum, ride) => sum + getDriverEarningsAmountClp(ride), 0);

  const csv = [
    headers,
    ...rows,
    [],
    ["Totales", "", "", "", "", "", totalFare, totalEarning, Math.max(0, totalFare - totalEarning)],
  ]
    .map((row) => row.map(csvEscapeDriverEarnings).join(";"))
    .join("\r\n");

  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `rapago_ganancias_${filter}_${stamp}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function getRequestCardStyles(): Record<string, CSSProperties> {
  return {
    card: {
      position: "relative",
      margin: 0,
      borderRadius: "28px",
      overflow: "hidden",
      /* Antes era un gradiente crema fijo (#F6F2EC→#EFE6D8) con
         `color: var(--rp-text)`: en modo noche ese token se resuelve a un
         texto claro pensado para fondo oscuro, y quedaba texto claro sobre
         fondo claro — la tarjeta de solicitud entrante, una de las pantallas
         que más mira el conductor, se volvía casi ilegible de noche.
         `--rp-surface` ya ES un gradiente propio por tema (crema de día, casi
         negro de noche), así que va tal cual: envolverlo en OTRO
         linear-gradient() como color-stop es CSS inválido — un gradiente no
         puede ser el color de una parada de otro gradiente. */
      background: "var(--rp-surface)",
      color: "var(--rp-text)",
      border: "1px solid var(--rp-border-c)",
      boxShadow: "0 24px 64px rgba(0,0,0,.34)",
      "--background": "var(--rp-surface)",
      "--color": "var(--rp-text)",
    } as CSSProperties,
    darkLayer: {
      position: "absolute",
      inset: 0,
      background:
        "radial-gradient(circle at 10% 0%, rgba(45,211,111,.16), transparent 34%), radial-gradient(circle at 95% 100%, rgba(210,164,58,.18), transparent 36%)",
      pointerEvents: "none",
    },
    pill: {
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      padding: "7px 10px",
      borderRadius: "999px",
      background: "var(--rp-surface-soft)",
      border: "var(--rp-border-w) solid var(--rp-border-c)",
      color: "var(--rp-text)",
      fontSize: ".72rem",
      fontWeight: 950,
    },
    routeBox: {
      marginTop: "16px",
      padding: "14px",
      borderRadius: "20px",
      background: "var(--rp-surface-soft)",
      border: "var(--rp-border-w) solid var(--rp-border-c)",
      boxShadow: "0 10px 26px rgba(0,0,0,.08)",
      color: "var(--rp-text)",
    },
    routeDot: {
      width: 13,
      height: 13,
      borderRadius: 999,
      marginTop: 5,
      boxShadow: "0 0 0 5px rgba(17,17,17,.05)",
      flexShrink: 0,
    },
    primaryButton: {
      "--border-radius": "17px",
      height: "56px",
      "--background": "linear-gradient(135deg, #D8A83E 0%, #F0D9AA 100%)",
      "--background-activated": "#d2a43a",
      "--color": "#111111",
      fontWeight: 950,
      letterSpacing: ".2px",
      boxShadow: "0 14px 30px rgba(210,164,58,.30)",
    } as CSSProperties,
    secondaryButton: {
      "--border-radius": "17px",
      height: "56px",
      "--background":
        "linear-gradient(135deg, #2A1A18 0%, #8F3F25 52%, #C5532F 100%)",
      "--background-activated": "#6f2f1e",
      "--background-hover":
        "linear-gradient(135deg, #351f1b 0%, #9f472b 52%, #d26037 100%)",
      "--color": "#FFFFFF",
      "--box-shadow": "0 14px 30px rgba(143,63,37,.32)",
      "--border-color": "rgba(255,255,255,.18)",
      fontWeight: 950,
      letterSpacing: ".2px",
    } as CSSProperties,
  };
}

type RideRequestAlertController = {
  stop: () => void;
};

function speakRideRequestAlert(
  message = "Hay una solicitud de viaje nueva disponible.",
): void {
  try {
    if (!("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(message);

    utterance.lang = "es-CL";
    utterance.rate = 0.96;
    utterance.pitch = 1;
    utterance.volume = 0.9;

    window.speechSynthesis.speak(utterance);
  } catch {
    // No bloquea la alerta si el navegador no permite voz.
  }
}

const DRIVER_ALERTS_ENABLED_STORAGE_KEY = "rapago_driver_alerts_enabled_v1";

function readDriverAlertsEnabled(): boolean {
  try {
    return localStorage.getItem(DRIVER_ALERTS_ENABLED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

let preparedAlertAudioContext: AudioContext | null = null;

function getAlertAudioContext(): AudioContext | null {
  try {
    if (preparedAlertAudioContext) return preparedAlertAudioContext;

    const audioWindow = window as typeof window & {
      webkitAudioContext?: typeof AudioContext;
    };

    const AudioContextConstructor =
      audioWindow.AudioContext ?? audioWindow.webkitAudioContext;

    preparedAlertAudioContext = AudioContextConstructor
      ? new AudioContextConstructor()
      : null;

    return preparedAlertAudioContext;
  } catch {
    preparedAlertAudioContext = null;
    return null;
  }
}

function playDriverAlertTone(
  audioContext: AudioContext | null,
  volume = 0.34,
): void {
  if (!audioContext) return;

  const now = audioContext.currentTime;
  const frequencies = [880, 1046, 880];

  frequencies.forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const start = now + index * 0.22;
    const duration = 0.19;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, start);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.02, volume),
      start + 0.025,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.04);
  });
}

function primeDriverAlertAudio(): void {
  try {
    const audioContext = getAlertAudioContext();
    void audioContext?.resume();

    // Tono casi imperceptible para desbloquear audio después de tocar "Disponible".
    playDriverAlertTone(audioContext, 0.02);
  } catch {
    // El audio se intentará nuevamente cuando llegue una solicitud.
  }

  try {
    if ("vibrate" in navigator) {
      navigator.vibrate([80, 40, 80]);
    }
  } catch {
    // Vibración opcional.
  }
}

function ensureDriverNotificationPermission(): void {
  try {
    if (!("Notification" in window)) return;

    if (Notification.permission === "default") {
      void Notification.requestPermission();
    }
  } catch {
    // Permiso opcional para navegador/PWA.
  }
}

function enableDriverRideAlerts(): void {
  try {
    localStorage.setItem(DRIVER_ALERTS_ENABLED_STORAGE_KEY, "true");
  } catch {
    // No bloquea la app.
  }

  ensureDriverNotificationPermission();
  primeDriverAlertAudio();
}

function showRideRequestSystemNotification(): void {
  try {
    if (!("Notification" in window)) return;

    const show = () => {
      if (Notification.permission !== "granted") return;

      const options: NotificationOptions & {
        vibrate?: number[];
        requireInteraction?: boolean;
        renotify?: boolean;
      } = {
        body: "Hay una solicitud de viaje nueva disponible. Toca para abrir RAPA GO.",
        tag: "rapago-new-ride-request",
        renotify: true,
        silent: false,
        requireInteraction: true,
        vibrate: [700, 220, 700, 220, 700],
        badge: "/assets/logo-rapago-MgFpiiP8.jpeg",
        icon: "/assets/logo-rapago-MgFpiiP8.jpeg",
      };

      const notification = new Notification(
        "🚕 Nueva solicitud RAPA GO",
        options,
      );

      notification.onclick = () => {
        try {
          window.focus();
        } catch {
          // noop
        }

        try {
          window.location.href = ROUTES.DRIVER.REQUESTS;
        } catch {
          // noop
        }

        notification.close();
      };
    };

    if (Notification.permission === "granted") {
      show();
      return;
    }

    // Importante:
    // En celular el permiso debe pedirse idealmente al tocar "Disponible".
    // Si el navegador aún permite pedirlo aquí, lo intentamos igual.
    if (Notification.permission === "default") {
      void Notification.requestPermission().then((permission) => {
        if (permission === "granted") show();
      });
    }
  } catch {
    // La notificación del sistema es opcional.
  }
}

function startRideRequestAlertSound(message?: string): RideRequestAlertController {
  let stopped = false;
  const intervals: number[] = [];
  const audioContext = getAlertAudioContext();

  try {
    void audioContext?.resume();
  } catch {
    // Si el navegador bloquea audio, seguimos con vibración/notificación.
  }

  function playAlarmCycle(): void {
    if (stopped) return;

    try {
      void audioContext?.resume();
      playDriverAlertTone(audioContext, 0.42);
    } catch {
      // Si el navegador bloquea audio, mantenemos vibración/voz/notificación.
    }

    try {
      if ("vibrate" in navigator) {
        navigator.vibrate([700, 220, 700, 220, 700]);
      }
    } catch {
      // Vibración opcional.
    }
  }

  const voiceMessage = message || "Hay una solicitud de viaje nueva disponible.";

  playAlarmCycle();
  speakRideRequestAlert(voiceMessage);
  showRideRequestSystemNotification();

  // Alerta persistente mientras la solicitud siga disponible.
  intervals.push(window.setInterval(playAlarmCycle, 1200));
  intervals.push(window.setInterval(() => speakRideRequestAlert(voiceMessage), 9000));
  intervals.push(window.setInterval(showRideRequestSystemNotification, 18000));

  return {
    stop: () => {
      stopped = true;

      intervals.forEach((id) => window.clearInterval(id));

      try {
        if ("vibrate" in navigator) {
          navigator.vibrate(0);
        }
      } catch {
        // noop
      }

      try {
        window.speechSynthesis?.cancel();
      } catch {
        // noop
      }

      // No cerramos preparedAlertAudioContext para mantenerlo desbloqueado
      // mientras el conductor siga usando la app.
    },
  };
}

function formatRideAlertSeconds(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mm = Math.floor(safe / 60)
    .toString()
    .padStart(1, "0");
  const ss = (safe % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

export function DriverGlobalRideAlert(): JSX.Element | null {
  const { session } = useAuth();
  const history = useHistory();
  const driverAvailabilityUser = session?.user as
    DriverAvailabilityUser | undefined;
  const driverConnection = useRapaGoConnectivityMonitor("driver");

  const [driverAvailability, setDriverAvailability] =
    useState<DriverAvailability>(() =>
      readDriverAvailability(driverAvailabilityUser),
    );
  const [rideAlert, setRideAlert] = useState<AvailableRideData | null>(null);
  const [scheduledReservationAlert, setScheduledReservationAlert] =
    useState<DriverScheduledReservationOffer | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [accepting, setAccepting] = useState(false);
  const [alertError, setAlertError] = useState<string | null>(null);
  const rideAlertControllerRef = useRef<RideRequestAlertController | null>(
    null,
  );
  const alertedRideIdsRef = useRef<Set<string>>(new Set());
  const alertedScheduledReservationKeysRef = useRef<Set<string>>(new Set());
  const globalAlertLoadInFlightRef = useRef(false);
  const globalAlertNextLoadAtRef = useRef(0);
  const globalAlertRateLimitedUntilRef = useRef(0);

  const isDriverAvailable = driverAvailability === "available" && !driverConnection.blocked;

  const stopRideAlert = useCallback((clearRide = true): void => {
    rideAlertControllerRef.current?.stop();
    rideAlertControllerRef.current = null;

    if (clearRide) {
      setRideAlert(null);
      setScheduledReservationAlert(null);
      setSecondsLeft(60);
      setAlertError(null);
    }
  }, []);

  const startRideAlert = useCallback(
    (ride: AvailableRideData): void => {
      stopRideAlert(false);
      alertedRideIdsRef.current.add(ride.id);
      setRideAlert(ride);
      setSecondsLeft(60);
      setAlertError(null);
      const hasActiveRide =
        readActiveDriverLocalRideMirrorsForDriver(session?.user).length > 0;
      rideAlertControllerRef.current = startRideRequestAlertSound(
        hasActiveRide
          ? "Nuevo servicio disponible para continuar cuando cierres tu viaje actual."
          : "Hay una solicitud de viaje nueva disponible.",
      );
    },
    [session?.user, stopRideAlert],
  );

  const startScheduledReservationAlert = useCallback(
    (ride: DriverScheduledReservationOffer): void => {
      stopRideAlert(false);
      alertedScheduledReservationKeysRef.current.add(
        getScheduledReservationAlertKey(ride as unknown as DriverAcceptedRideBridgeRecord),
      );
      setRideAlert(null);
      setScheduledReservationAlert(ride);
      setSecondsLeft(60);
      setAlertError(null);
      rideAlertControllerRef.current = startScheduledReservationAlertSound();
    },
    [stopRideAlert],
  );

  useEffect(() => {
    const stopFromAnywhere = (event: Event) => {
      const rideId = String((event as CustomEvent<{ rideId?: string }>).detail?.rideId ?? "").trim();
      if (rideId) alertedRideIdsRef.current.add(rideId);
      stopRideAlert(true);
    };

    window.addEventListener(RAPAGO_DRIVER_RIDE_ALERT_STOP_EVENT, stopFromAnywhere as EventListener);
    return () => window.removeEventListener(RAPAGO_DRIVER_RIDE_ALERT_STOP_EVENT, stopFromAnywhere as EventListener);
  }, [stopRideAlert]);

  const loadAvailableRideForAlert = useCallback(async (): Promise<void> => {
    if (
      !session?.accessToken ||
      !isDriverAvailable ||
      accepting ||
      !readSelectedDriverVehicleId(session?.user) ||
      document.visibilityState !== "visible" ||
      globalAlertLoadInFlightRef.current ||
      Date.now() < globalAlertNextLoadAtRef.current ||
      Date.now() < globalAlertRateLimitedUntilRef.current
    ) {
      return;
    }

    globalAlertLoadInFlightRef.current = true;
    globalAlertNextLoadAtRef.current = Date.now() + 3_000;

    try {
      // Global en toda la app del conductor:
      // si ya va en un viaje activo, igual debe sonar y aparecer el próximo servicio.
      // Al aceptarlo se guarda como "Próximo servicio aceptado", sin reemplazar el viaje actual.

      // PRIORIDAD ABSOLUTA: reservas agendadas asignadas por admin.
      // Esto debe correr también si el conductor está en /driver/requests?view=reservations.
      // Si lo bloqueamos por shouldRunGlobalAlert, la reserva queda aceptada pero nunca suena.
      // Aunque exista una alerta normal activa, al llegar la hora debe sonar
      // la alerta especial de reserva y NO la tarjeta "Nueva solicitud de viaje".
      const readyScheduledReservation = findScheduledReservationReadyForDriver(
        session?.user,
        true,
        alertedScheduledReservationKeysRef.current,
      );

      if (readyScheduledReservation) {
        const nextKey = getScheduledReservationAlertKey(
          readyScheduledReservation as unknown as DriverAcceptedRideBridgeRecord,
        );
        const currentKey = scheduledReservationAlert
          ? getScheduledReservationAlertKey(
              scheduledReservationAlert as unknown as DriverAcceptedRideBridgeRecord,
            )
          : null;

        if (!scheduledReservationAlert || currentKey !== nextKey) {
          startScheduledReservationAlert(readyScheduledReservation);
        }
        return;
      }

      // La alerta normal también es global: permanece visible en Inicio,
      // Solicitudes, Viajes, Ganancias y Perfil hasta responder.
      // Si ya hay cualquier alerta abierta, no montamos otra encima.
      if (rideAlert || scheduledReservationAlert) return;

      const rides = await ridesService.listAvailableRides(session.accessToken);
      const mergedRides = [...rides, ...readRequeuedAvailableRides()];
      const mergedById = new Map<string, AvailableRideData>();
      for (const ride of mergedRides) {
        if (ride.status === "requested") mergedById.set(ride.id, ride);
      }
      const nextRide = Array.from(mergedById.values()).find(
        (ride) =>
          ride.status === "requested" &&
          !driverRideWasSkippedByCurrentDriver(ride as unknown as Record<string, unknown>, session?.user) &&
          !shouldHideFromNormalDriverRequestQueue(ride as unknown as Record<string, unknown>) &&
          !driverRideRequestIsHandled(ride as unknown as Record<string, unknown>, session?.user) &&
          !driverAvailableRideMatchesScheduledReservationForDriver(
            ride as unknown as Record<string, unknown>,
            session?.user,
          ) &&
          !alertedRideIdsRef.current.has(ride.id),
      );

      if (nextRide) {
        startRideAlert(nextRide);
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught ?? "");
      if (/429|too many requests|demasiadas solicitudes/i.test(message)) {
        globalAlertRateLimitedUntilRef.current = Date.now() + 65_000;
      }
      // No mostramos error en Inicio. La pantalla Solicitudes conserva sus propios errores.
    } finally {
      globalAlertLoadInFlightRef.current = false;
    }
  }, [
    accepting,
    isDriverAvailable,
    rideAlert,
    scheduledReservationAlert,
    session?.accessToken,
    session?.user,
    startRideAlert,
    startScheduledReservationAlert,
  ]);

  useEffect(() => {
    setDriverAvailability(readDriverAvailability(driverAvailabilityUser));
  }, [
    driverAvailabilityUser?.id,
    driverAvailabilityUser?.userId,
    driverAvailabilityUser?.email,
    driverAvailabilityUser?.name,
  ]);

  useEffect(() => {
    const handleAvailabilityEvent = (event: Event) => {
      const next = (event as CustomEvent<{ value?: DriverAvailability }>).detail
        ?.value;
      setDriverAvailability(
        next === "unavailable"
          ? "unavailable"
          : readDriverAvailability(driverAvailabilityUser),
      );
    };

    const handleStorageEvent = (event: StorageEvent) => {
      if (
        event.key === DRIVER_AVAILABILITY_STORAGE_KEY ||
        event.key === DRIVER_AVAILABILITY_MAP_KEY ||
        event.key === DRIVER_AVAILABILITY_EMAIL_KEY ||
        event.key === DRIVER_AVAILABILITY_NAME_KEY ||
        event.key === DRIVER_AVAILABILITY_SNAPSHOT_KEY
      ) {
        setDriverAvailability(readDriverAvailability(driverAvailabilityUser));
      }
    };

    window.addEventListener(
      DRIVER_AVAILABILITY_EVENT,
      handleAvailabilityEvent as EventListener,
    );
    window.addEventListener("storage", handleStorageEvent);

    return () => {
      window.removeEventListener(
        DRIVER_AVAILABILITY_EVENT,
        handleAvailabilityEvent as EventListener,
      );
      window.removeEventListener("storage", handleStorageEvent);
    };
  }, [
    driverAvailabilityUser?.id,
    driverAvailabilityUser?.userId,
    driverAvailabilityUser?.email,
    driverAvailabilityUser?.name,
  ]);

  useEffect(() => {
    if (!isDriverAvailable) {
      stopRideAlert(true);
      return;
    }

    const tick = () => {
      if (document.visibilityState === "visible") {
        void loadAvailableRideForAlert();
      }
    };

    tick();
    const interval = window.setInterval(tick, 15_000);
    document.addEventListener("visibilitychange", tick);

    window.addEventListener(DRIVER_SCHEDULED_RESERVATION_EVENT, tick as EventListener);
    window.addEventListener(DRIVER_ASSIGNED_SCHEDULED_RIDE_EVENT, tick as EventListener);
    window.addEventListener("rapago:driver-reservation-inbox-updated", tick as EventListener);
    window.addEventListener("rapago:admin-scheduled-rides-updated", tick as EventListener);
    window.addEventListener(DRIVER_ADMIN_RESERVATION_AUTO_ASSIGNED_EVENT, tick as EventListener);
    window.addEventListener("storage", tick);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener(DRIVER_SCHEDULED_RESERVATION_EVENT, tick as EventListener);
      window.removeEventListener(DRIVER_ASSIGNED_SCHEDULED_RIDE_EVENT, tick as EventListener);
      window.removeEventListener("rapago:driver-reservation-inbox-updated", tick as EventListener);
      window.removeEventListener("rapago:admin-scheduled-rides-updated", tick as EventListener);
      window.removeEventListener(DRIVER_ADMIN_RESERVATION_AUTO_ASSIGNED_EVENT, tick as EventListener);
      window.removeEventListener("storage", tick);
    };
  }, [
    isDriverAvailable,
    loadAvailableRideForAlert,
    stopRideAlert,
  ]);

  useEffect(() => {
    return () => stopRideAlert(true);
  }, [stopRideAlert]);

  useEffect(() => {
    if (!rideAlert) return;

    const interval = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          stopRideAlert(true);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [rideAlert?.id, stopRideAlert]);

  function dismissRideAlert(ride: AvailableRideData | string): void {
    const rideId = typeof ride === "string" ? ride : ride.id;
    alertedRideIdsRef.current.add(rideId);
    markDriverRideRequestHandled(
      typeof ride === "string"
        ? ride
        : (ride as unknown as Partial<AvailableRideData> & Record<string, unknown>),
      session?.user,
      "rejected",
    );
    stopAllDriverRideRequestAlerts(rideId);

    if (typeof ride !== "string") {
      requeueAvailableRideForNextDriver(ride, session?.user, "driver_rejected");
    }

    stopRideAlert(true);
  }

  function goToRequests(): void {
    history.push(DRIVER_REQUESTS_VIEW_ROUTE);
  }

  function dismissScheduledReservationAlert(ride: DriverScheduledReservationOffer): void {
    alertedScheduledReservationKeysRef.current.add(
      getScheduledReservationAlertKey(ride as unknown as DriverAcceptedRideBridgeRecord),
    );
    stopRideAlert(true);
  }

  function goToScheduledReservations(): void {
    stopRideAlert(true);
    history.push(DRIVER_RESERVATIONS_VIEW_ROUTE);
  }

  async function acceptScheduledReservationFromAlert(
    ride: DriverScheduledReservationOffer,
  ): Promise<void> {
    if (!isDriverAvailable) {
      setAlertError("Estás en No disponible. Cambia a Disponible para aceptar esta reserva.");
      return;
    }

    setAccepting(true);
    setAlertError(null);

    const acceptWithLocation = async (
      location: { lat: number; lng: number } | null,
    ): Promise<void> => {
      const accepted = startDriverScheduledReservationNavigationLocally(ride, session?.user);
      const activeAccepted = getActiveScheduledReservationRideForDriver(
        accepted as unknown as DriverAcceptedRideBridgeRecord,
        session?.user,
      );

      if (activeAccepted && location) {
        publishDriverLiveLocationForPassenger(
          activeAccepted,
          {
            lat: location.lat,
            lng: location.lng,
            heading: null,
            speed: null,
            accuracy: null,
          },
          null,
          session?.user,
        );
      }

      stopRideAlert(true);
      history.replace(activeAccepted ? ROUTES.DRIVER.ACTIVE_RIDE : DRIVER_RESERVATIONS_VIEW_ROUTE);
    };

    try {
      if (!navigator.geolocation) {
        await acceptWithLocation(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          void acceptWithLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          })
            .catch((err) => {
              setAlertError(err instanceof Error ? err.message : "No se pudo aceptar la reserva.");
            })
            .finally(() => setAccepting(false));
        },
        () => {
          void acceptWithLocation(null)
            .catch((err) => {
              setAlertError(err instanceof Error ? err.message : "No se pudo aceptar la reserva.");
            })
            .finally(() => setAccepting(false));
        },
        { enableHighAccuracy: true, timeout: 9000, maximumAge: 10000 },
      );
      return;
    } catch (err) {
      setAlertError(err instanceof Error ? err.message : "No se pudo aceptar la reserva.");
    } finally {
      if (!navigator.geolocation) setAccepting(false);
    }
  }

  async function acceptRideFromAlert(ride: AvailableRideData): Promise<void> {
    if (!session?.accessToken) return;

    if (!isDriverAvailable) {
      setAlertError(
        "Estás en No disponible. Cambia a Disponible para aceptar viajes.",
      );
      return;
    }

    setAccepting(true);
    setAlertError(null);

    const acceptWithLocation = async (
      location: { lat: number; lng: number } | null,
    ): Promise<void> => {
      const currentActiveRide =
        readActiveDriverLocalRideMirrorsForDriver(session?.user)[0] ?? null;

      let acceptedPayload: Record<string, unknown>;

      try {
        acceptedPayload = await ridesService.acceptRideRequest(
          session.accessToken!,
          ride.id,
        ) as unknown as Record<string, unknown>;
      } catch (err) {
        const localRequeued = getAvailableRideById(ride.id, [ride]);

        // En desarrollo el backend puede dejar el viaje como cancelled, aunque
        // nosotros lo re-encolamos localmente para que otro conductor lo tome.
        // Si pasa eso, aceptamos el viaje localmente y limpiamos la cola.
        if (
          !localRequeued ||
          (!isCancelledRideConflictMessage(err) && !rideCanBeAcceptedLocallyAfterRequeue(localRequeued))
        ) {
          throw err;
        }

        acceptedPayload = buildLocalAcceptedRideFromAvailable(
          localRequeued,
          session?.user,
        ) as unknown as Record<string, unknown>;
      }

      const accepted = enrichRideWithSelectedDriverVehicle(
        acceptedPayload,
        session?.user,
      );

      const acceptedForDriver = currentActiveRide
        ? saveDriverNextRideAfterCurrent(accepted, currentActiveRide, session?.user)
        : saveDriverActiveRideLocalMirror(accepted, session?.user);

      publishAcceptedDriverVehicleToPassenger(acceptedForDriver as unknown as DriverAcceptedRideBridgeRecord, session?.user);
      markDriverRideRequestHandled(
        acceptedForDriver as unknown as Record<string, unknown>,
        session?.user,
        currentActiveRide ? "accepted_next" : "accepted",
      );
      markDriverRideRequestHandled(
        ride as unknown as Record<string, unknown>,
        session?.user,
        currentActiveRide ? "accepted_next" : "accepted",
      );
      stopAllDriverRideRequestAlerts(ride.id);
      removeRequeuedRide(ride.id);

      if (currentActiveRide) {
        pushPassengerNotification({
          rideId: String(ride.id),
          type: "driver_assigned",
          title: "Tu conductor aceptó tu viaje",
          body: "El conductor está terminando un viaje anterior. Cuando cierre esa carrera iniciará tu servicio.",
        });

        stopRideAlert(true);
        setAccepting(false);
        setAlertError(null);

        // No cambiamos de pantalla: la navegación actual sigue intacta.
        window.dispatchEvent(new CustomEvent(RAPAGO_DRIVER_NEXT_RIDES_EVENT, { detail: { ride: acceptedForDriver } }));
        window.dispatchEvent(new CustomEvent("rapago:driver-rides-updated", { detail: { ride: acceptedForDriver } }));
        return;
      }

      if (location) {
        publishDriverLiveLocationForPassenger(
          acceptedForDriver as DriverRideData,
          {
            lat: location.lat,
            lng: location.lng,
            heading: null,
            speed: null,
            accuracy: null,
          },
          null,
          session?.user,
        );

        try {
          localStorage.setItem(
            "rapago_current_driver_location",
            JSON.stringify({
              rideId: ride.id,
              lat: location.lat,
              lng: location.lng,
              updatedAt: new Date().toISOString(),
              ...getDriverVehiclePublicPayload(session?.user),
            }),
          );
        } catch {
          // No bloquea la aceptación.
        }
      }

      stopRideAlert(true);
      history.replace(ROUTES.DRIVER.ACTIVE_RIDE);
    };

    try {
      if (!navigator.geolocation) {
        await acceptWithLocation(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          void acceptWithLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          })
            .catch((err) => {
              setAlertError(
                err instanceof Error
                  ? err.message
                  : "No se pudo aceptar el viaje.",
              );
            })
            .finally(() => setAccepting(false));
        },
        () => {
          void acceptWithLocation(null)
            .catch((err) => {
              setAlertError(
                err instanceof Error
                  ? err.message
                  : "No se pudo aceptar el viaje.",
              );
            })
            .finally(() => setAccepting(false));
        },
        { enableHighAccuracy: true, timeout: 9000, maximumAge: 10000 },
      );
      return;
    } catch (err) {
      setAlertError(
        err instanceof Error ? err.message : "No se pudo aceptar el viaje.",
      );
    } finally {
      if (!navigator.geolocation) setAccepting(false);
    }
  }

  if (scheduledReservationAlert) {
    const ride = scheduledReservationAlert;
    const fareClp = getRideDisplayFareClp(ride as RideWithFarePayload);
    const paymentLabel = getRidePaymentMethodLabel(String(ride.notes ?? ""));
    const paymentIcon = getRidePaymentIcon(String(ride.notes ?? ""));
    const vehicleCategory = getRideVehicleCategory(ride as RideWithFarePayload);
    const vehicleLabel = getRideVehicleLabel(vehicleCategory);
    const vehicleEmoji = getRideVehicleEmoji(vehicleCategory);

    return (
      <div
        className="rapago-ride-alert-overlay"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 2147482000,
          background: "rgba(0,0,0,.58)",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          padding: "18px 18px calc(18px + env(safe-area-inset-bottom, 0px)) 18px",
          pointerEvents: "auto",
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="rapago-driver-scheduled-alert-title"
          style={{
            width: "100%",
            maxWidth: 460,
            borderRadius: "30px 30px 24px 24px",
            overflow: "hidden",
            background: "linear-gradient(145deg,#fff8e1 0%,#f6d98e 100%)",
            color: "#111",
            border: "2px solid rgba(255,255,255,.65)",
            boxShadow: "0 28px 80px rgba(0,0,0,.55)",
            animation: "rapagoRideAlertIn .22s ease-out",
          }}
        >
          <div
            style={{
              padding: "16px 18px",
              background: "linear-gradient(135deg,#111827,#8F3F25)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                aria-hidden="true"
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 18,
                  background: "rgba(255,255,255,.14)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 0 26px rgba(255,211,61,.45)",
                  fontSize: 26,
                }}
              >
                <IonIcon icon={calendarOutline} style={{ fontSize: "1em" }} />
              </div>

              <div>
                <div id="rapago-driver-scheduled-alert-title" style={{ fontSize: "1.1rem", fontWeight: 950, lineHeight: 1.1 }}>
                  Viaje agendado listo
                </div>
                <div style={{ fontSize: ".78rem", opacity: 0.86, marginTop: 3 }}>
                  Tenemos agendado tu viaje · {getScheduledReservationCountdownText(ride as unknown as DriverAcceptedRideBridgeRecord)}
                </div>
              </div>
            </div>

            <IonButton
              fill="clear"
              color="light"
              onClick={() => dismissScheduledReservationAlert(ride)}
              aria-label="Cerrar aviso de viaje agendado"
              style={{ "--border-radius": "999px" } as CSSProperties}
            >
              <IonIcon icon={closeOutline} slot="icon-only" />
            </IonButton>
          </div>

          <div style={{ padding: "18px" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              <IonChip color="warning" style={{ fontWeight: 950 }}>
                <IonIcon icon={calendarOutline} aria-hidden="true" style={{ fontSize: "1em" }} /> Reserva asignada
              </IonChip>
              <IonChip color="success" style={{ fontWeight: 950 }}>
                {vehicleEmoji} {vehicleLabel}
              </IonChip>
              <IonChip color="medium" style={{ fontWeight: 950 }}>
                {paymentIcon} {paymentLabel}
              </IonChip>
            </div>

            <DriverFastSearchBadge ride={ride as unknown as RideWithFarePayload & Record<string, unknown>} />
            <PassengerRideNoteCard ride={ride} />

            <div
              style={{
                borderRadius: "22px",
                background: "#fff",
                border: "1px solid rgba(210,164,58,.35)",
                padding: "14px",
                boxShadow: "0 10px 24px rgba(0,0,0,.10)",
              }}
            >
              <div style={{ color: "#22c55e", fontSize: ".72rem", fontWeight: 950 }}>
                VE A BUSCAR AL USUARIO
              </div>
              <div style={{ fontWeight: 950, fontSize: "1.02rem", marginTop: 3 }}>
                {getDriverRidePointDisplayLabel(ride as unknown as Record<string, unknown>, "origin")}
              </div>

              <div
                style={{
                  width: 2,
                  height: 28,
                  background: "linear-gradient(180deg,#22c55e,#ef4444)",
                  borderRadius: 999,
                  margin: "10px 0 10px 7px",
                }}
              />

              <div style={{ color: "#ef4444", fontSize: ".72rem", fontWeight: 950 }}>
                DESTINO DEL PASAJERO
              </div>
              <div style={{ fontWeight: 950, fontSize: "1.02rem", marginTop: 3 }}>
                {cleanPointDisplayName(ride.destinationText, "Destino reservado")}
              </div>
            </div>

            <div
              style={{
                marginTop: 14,
                borderRadius: "20px",
                background: "rgba(17,17,17,.94)",
                color: "#fff",
                padding: "14px 15px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontSize: ".72rem", color: "#f6d98e", fontWeight: 950 }}>
                  TARIFA RESERVADA
                </div>
                <div style={{ fontSize: "1.5rem", fontWeight: 950, marginTop: 2 }}>
                  {formatClp(fareClp)}
                </div>
              </div>
              <div style={{ fontSize: ".78rem", fontWeight: 900, textAlign: "right" }}>
                Confirmada por admin
              </div>
            </div>

            {alertError && (
              <IonText color="danger">
                <p style={{ margin: "10px 0 0", fontWeight: 900, fontSize: ".82rem" }}>
                  {alertError}
                </p>
              </IonText>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "0.85fr 1.15fr", gap: 12, marginTop: 16 }}>
              <IonButton
                expand="block"
                color="medium"
                onClick={() => dismissScheduledReservationAlert(ride)}
                style={{ "--border-radius": "17px", height: "54px", fontWeight: 950 } as CSSProperties}
              >
                Ver después
              </IonButton>

              <IonButton
                expand="block"
                color="warning"
                disabled={accepting}
                onClick={() => void acceptScheduledReservationFromAlert(ride)}
                style={{ "--border-radius": "17px", height: "54px", "--color": "#111", fontWeight: 950 } as CSSProperties}
              >
                {accepting ? <IonSpinner name="dots" /> : "Iniciar viaje"}
              </IonButton>
            </div>

            <IonButton
              expand="block"
              fill="clear"
              color="dark"
              onClick={goToScheduledReservations}
              style={{ marginTop: 8, "--border-radius": "16px", fontWeight: 900 } as CSSProperties}
            >
              Ver en Reservas
            </IonButton>
          </div>
        </div>
      </div>
    );
  }

  if (!rideAlert) return null;

  const activeRideForGlobalAlert =
    readActiveDriverLocalRideMirrorsForDriver(session?.user)[0] ?? null;
  const isNextServiceAlert = Boolean(activeRideForGlobalAlert);

  const fareClp = getRideDisplayFareClp(rideAlert as RideWithFarePayload);
  const paymentLabel = getRidePaymentMethodLabel(rideAlert.notes);
  const paymentIcon = getRidePaymentIcon(rideAlert.notes);
  const vehicleCategory = getRideVehicleCategory(
    rideAlert as RideWithFarePayload,
  );
  const vehicleLabel = getRideVehicleLabel(vehicleCategory);
  const vehicleEmoji = getRideVehicleEmoji(vehicleCategory);
  const tripTypeLabel = getRideTripTypeLabel(rideAlert.notes);
  const tripTypeEmoji = getRideTripTypeEmoji(rideAlert.notes);

  return (
    <div
      className="rapago-ride-alert-overlay"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147482000,
        background: "rgba(0,0,0,.58)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: "18px 18px calc(18px + env(safe-area-inset-bottom, 0px)) 18px",
        pointerEvents: "auto",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rapago-driver-ride-alert-title"
        style={{
          width: "100%",
          maxWidth: 440,
          maxHeight: "calc(100vh - 36px - env(safe-area-inset-bottom, 0px))",
          display: "flex",
          flexDirection: "column",
          borderRadius: "30px 30px 24px 24px",
          overflow: "hidden",
          background: "linear-gradient(145deg, #fff8e1 0%, #f6d98e 100%)",
          color: "#111",
          border: "2px solid rgba(255,255,255,.65)",
          boxShadow: "0 28px 80px rgba(0,0,0,.55)",
          animation: "rapagoRideAlertIn .22s ease-out",
        }}
      >
        <div
          style={{
            flex: "0 0 auto",
            padding: "16px 18px",
            background: "linear-gradient(135deg,#111,#8F3F25)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              aria-hidden="true"
              style={{
                width: 48,
                height: 48,
                borderRadius: 18,
                background: "rgba(255,255,255,.14)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 26px rgba(255,211,61,.45)",
              }}
            >
              <IonIcon
                icon={notificationsOutline}
                style={{ fontSize: 28, color: "#ffd33d" }}
              />
            </div>

            <div>
              <div
                id="rapago-driver-ride-alert-title"
                style={{ fontSize: "1.1rem", fontWeight: 950, lineHeight: 1.1 }}
              >
                {isNextServiceAlert ? "Nuevo servicio para continuar" : "Nueva solicitud de viaje"}
              </div>
              <div style={{ fontSize: ".78rem", opacity: 0.84, marginTop: 3 }}>
                {isNextServiceAlert
                  ? `Queda como próximo servicio · responde en ${formatRideAlertSeconds(secondsLeft)}`
                  : `Disponible ahora · responde en ${formatRideAlertSeconds(secondsLeft)}`}
              </div>
            </div>
          </div>

          <span
            role="status"
            style={{
              borderRadius: 999,
              padding: "7px 10px",
              background: "rgba(255,255,255,.14)",
              border: "1px solid rgba(255,255,255,.28)",
              fontSize: ".68rem",
              fontWeight: 950,
              whiteSpace: "nowrap",
            }}
          >
            RESPONDER
          </span>
        </div>

        <div style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", padding: "18px" }}>
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 14,
            }}
          >
            <IonChip color="success" style={{ fontWeight: 950 }}>
              <IonIcon icon={volumeHighOutline} aria-hidden="true" />
              <IonLabel>Alerta activa</IonLabel>
            </IonChip>
            <IonChip color="warning" style={{ fontWeight: 950 }}>
              {vehicleEmoji} {vehicleLabel}
            </IonChip>
            <IonChip color="tertiary" style={{ fontWeight: 950 }}>
              {tripTypeEmoji} {tripTypeLabel}
            </IonChip>
            <IonChip color="medium" style={{ fontWeight: 950 }}>
              {paymentIcon} {paymentLabel}
            </IonChip>
          </div>

          <DriverFastSearchBadge ride={rideAlert as unknown as RideWithFarePayload & Record<string, unknown>} />
          <PassengerRideNoteCard ride={rideAlert} />

          <div
            style={{
              borderRadius: "22px",
              background: "#fff",
              border: "1px solid rgba(210,164,58,.35)",
              padding: "14px",
              boxShadow: "0 10px 24px rgba(0,0,0,.10)",
            }}
          >
            <div
              style={{ color: "#22c55e", fontSize: ".72rem", fontWeight: 950 }}
            >
              RECOGER EN
            </div>
            <div style={{ fontWeight: 950, fontSize: "1.02rem", marginTop: 3 }}>
              {cleanPointDisplayName(rideAlert.originText, "Punto de recogida")}
            </div>

            <div
              style={{
                width: 2,
                height: 28,
                background: "linear-gradient(180deg,#22c55e,#ef4444)",
                borderRadius: 999,
                margin: "10px 0 10px 7px",
              }}
            />

            <div
              style={{ color: "#ef4444", fontSize: ".72rem", fontWeight: 950 }}
            >
              DESTINO
            </div>
            <div style={{ fontWeight: 950, fontSize: "1.02rem", marginTop: 3 }}>
              {cleanPointDisplayName(rideAlert.destinationText, "Destino")}
            </div>
          </div>

          <div
            style={{
              marginTop: 14,
              borderRadius: "20px",
              background: "rgba(17,17,17,.94)",
              color: "#fff",
              padding: "14px 15px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: ".72rem",
                  color: "#f6d98e",
                  fontWeight: 950,
                }}
              >
                PRECIO DEL VIAJE
              </div>
              <div
                style={{ fontSize: "1.5rem", fontWeight: 950, marginTop: 2 }}
              >
                {formatClp(fareClp)}
              </div>
            </div>

            <div
              style={{
                fontSize: ".78rem",
                fontWeight: 900,
                textAlign: "right",
              }}
            ></div>
          </div>

          {alertError && (
            <IonText color="danger">
              <p
                style={{
                  margin: "10px 0 0",
                  fontWeight: 900,
                  fontSize: ".82rem",
                }}
              >
                {alertError}
              </p>
            </IonText>
          )}
        </div>

        <div style={{ flex: "0 0 auto", padding: "0 18px 18px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "0.85fr 1.15fr",
              gap: 12,
              marginTop: 16,
            }}
          >
            <IonButton
              expand="block"
              color="danger"
              onClick={() => dismissRideAlert(rideAlert)}
              style={
                {
                  "--border-radius": "17px",
                  height: "54px",
                  fontWeight: 950,
                } as CSSProperties
              }
            >
              Rechazar
            </IonButton>

            <IonButton
              expand="block"
              color="warning"
              disabled={accepting}
              onClick={() => void acceptRideFromAlert(rideAlert)}
              style={
                {
                  "--border-radius": "17px",
                  height: "54px",
                  "--color": "#111",
                  fontWeight: 950,
                } as CSSProperties
              }
            >
              {accepting ? <IonSpinner name="dots" /> : isNextServiceAlert ? "Aceptar próximo" : "Aceptar viaje"}
            </IonButton>
          </div>

          <button
            type="button"
            onClick={goToRequests}
            style={{
              width: "100%",
              marginTop: 8,
              minHeight: 42,
              border: 0,
              borderRadius: 14,
              background: "transparent",
              color: "#3f2a14",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Ver lista de solicitudes
          </button>
          <div
            style={{
              textAlign: "center",
              fontSize: ".72rem",
              lineHeight: 1.35,
              color: "#5b4630",
              fontWeight: 850,
            }}
          >
            Este aviso permanece hasta que aceptes, rechaces o la solicitud expire.
          </div>
        </div>
      </div>
    </div>
  );
}

function AssignedRidesPage({
  mode = "requests",
}: {
  mode?: "requests" | "active";
}): JSX.Element {
  const { session } = useAuth();
  const { theme } = useRapagoSectionTheme("driver-requests");
  const history = useHistory();
  const location = useLocation();
  const driverAvailabilityUser = session?.user as
    DriverAvailabilityUser | undefined;
  const driverConnection = useRapaGoConnectivityMonitor("driver");

  const requestView = new URLSearchParams(location.search).get("view");
  const showOnlyReservations = requestView === "reservations";
  const showActiveRideOnly = mode === "active";
  const isRequestsPageActive =
    location.pathname === ROUTES.DRIVER.REQUESTS ||
    location.pathname.includes("/driver/requests");
  const isActiveRidePage =
    location.pathname === ROUTES.DRIVER.ACTIVE_RIDE ||
    location.pathname.includes("/driver/active-ride");
  const isDriverOperationPageActive =
    isRequestsPageActive || isActiveRidePage;

  type DriverRideData =
    import("../../features/rides/rides.service").DriverRideData;
  type AvailableRideData =
    import("../../features/rides/rides.service").AvailableRideData;

  const [availableRides, setAvailableRides] = useState<AvailableRideData[]>([]);
  const [reservationOffers, setReservationOffers] = useState<DriverScheduledReservationOffer[]>([]);
  const [confirmedReservationOffers, setConfirmedReservationOffers] = useState<DriverScheduledReservationOffer[]>([]);
  const [assignedRides, setAssignedRides] = useState<DriverRideData[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [pendingReservationReject, setPendingReservationReject] =
    useState<DriverScheduledReservationOffer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [driverLocation, setDriverLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const driverLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastPublishedDriverLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const liveDriverHeadingRef = useRef<number | null>(null);
  const activeRideTrackingPayloadRef = useRef<DriverRideData | null>(null);
  const driverTrackingUserRef = useRef(session?.user);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [driverAvailability, setDriverAvailability] =
    useState<DriverAvailability>(() =>
      readDriverAvailability(driverAvailabilityUser),
    );
  const [rideAlert, setRideAlert] = useState<AvailableRideData | null>(null);
  const [rideAlertSecondsLeft, setRideAlertSecondsLeft] = useState(60);
  const [scheduledReservationReadyAlert, setScheduledReservationReadyAlert] =
    useState<DriverScheduledReservationOffer | null>(null);
  const [scheduledReservationAlertSecondsLeft, setScheduledReservationAlertSecondsLeft] =
    useState(60);
  const [cancelConfirmRide, setCancelConfirmRide] = useState<DriverRideData | null>(null);
  const [completeConfirmRide, setCompleteConfirmRide] = useState<DriverRideData | null>(null);
  const [passengerCancelNotice, setPassengerCancelNotice] = useState<{
    route: string;
    message: string;
  } | null>(null);
  const [nextRideQueueVersion, setNextRideQueueVersion] = useState(0);
  const rideAlertControllerRef = useRef<RideRequestAlertController | null>(
    null,
  );
  const scheduledReservationAlertControllerRef = useRef<RideRequestAlertController | null>(null);
  const alertedRideIdsRef = useRef<Set<string>>(new Set());
  const alertedScheduledReservationKeysRef = useRef<Set<string>>(new Set());
  const requestsLoadInFlightRef = useRef(false);
  const requestsNextLoadAtRef = useRef(0);

  useEffect(() => {
    setDriverAvailability(readDriverAvailability(driverAvailabilityUser));
  }, [
    driverAvailabilityUser?.id,
    driverAvailabilityUser?.userId,
    driverAvailabilityUser?.email,
    driverAvailabilityUser?.name,
  ]);

  useEffect(() => {
    if (!driverConnection.blocked) return;
    if (driverAvailability !== "available") return;

    setDriverAvailability("unavailable");
    saveDriverAvailability("unavailable", driverAvailabilityUser);
    setAvailableRides([]);
  }, [
    driverAvailability,
    driverAvailabilityUser?.id,
    driverAvailabilityUser?.userId,
    driverAvailabilityUser?.email,
    driverAvailabilityUser?.name,
    driverConnection.blocked,
  ]);

  const isDriverAvailable = driverAvailability === "available" && !driverConnection.blocked;
  const activeRide = assignedRides.find((ride) =>
    driverScheduledReservationNavigationStarted(ride as unknown as Record<string, unknown>) ||
    !driverRideLooksLikeScheduledReservation(ride as unknown as Record<string, unknown>),
  ) ?? null;
  const displayedAvailableRides = showOnlyReservations ? [] : availableRides;
  const nextQueuedRide = getDriverNextRideForActiveRide(activeRide, session?.user);

  useEffect(() => {
    if (!showActiveRideOnly || loading || activeRide) return;
    history.replace(ROUTES.DRIVER.TRIPS);
  }, [activeRide, history, loading, showActiveRideOnly]);

  /* Publica si hay viaje en curso, para que la barra pueda deshabilitar
     "Cerrar sesión". Un conductor sin sesión con un pasajero a bordo pierde la
     navegación, el contacto y el cierre de pago: es un incidente operativo, no
     un problema de interfaz. Al desmontar se limpia, para que salir de esta
     pantalla no deje el bloqueo pegado. */
  useEffect(() => {
    setDriverActiveRideFlag(activeRide?.id ?? null);
    return () => setDriverActiveRideFlag(null);
  }, [activeRide?.id]);

  /* Reloj de la espera de No show. Vive AQUÍ, en el componente de página, y no
     dentro de ActiveRideScreen, por una razón que no es de estilo:
     ActiveRideScreen se declara en el cuerpo de este componente, así que en
     cada render es una función NUEVA. React identifica los componentes por la
     identidad de su función, de modo que al usarlo como <ActiveRideScreen/> el
     subárbol entero se DESMONTA y se vuelve a montar en cada render del padre
     — incluido UberDriverNavigationMap, que en cada ciclo destruía y recreaba
     la instancia de google.maps.Map, sus marcadores y la ruta.

     La solución es invocarlo como función normal ({ActiveRideScreen(...)}) para
     que su salida se integre en el árbol del padre sin instancia propia. Pero
     eso sólo es legal si no tiene hooks, porque se llama de forma condicional
     (sólo cuando hay viaje activo) y el orden de hooks debe ser estable. Estos
     dos eran los únicos que tenía. */
  /* Hoja de emergencia. El botón SOS ya no ejecuta: abre estas opciones. Antes
     era un botón rojo grande que disparaba WhatsApp con un solo toque y sin
     confirmación, a un dedo de distancia del pulgar mientras se conduce; para
     una acción que manda un mensaje real a soporte, el toque de más es barato
     y el falso positivo no. */
  const [driverSosOpen, setDriverSosOpen] = useState(false);

  const driverWaitingPassengerAtPoint = activeRide?.status === "driver_arrived";
  const [activeRideNoShowNowMs, setActiveRideNoShowNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!driverWaitingPassengerAtPoint) return;

    const interval = window.setInterval(() => setActiveRideNoShowNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [driverWaitingPassengerAtPoint, activeRide?.id]);
  const reservationsTotal = reservationOffers.length + confirmedReservationOffers.length;
  const activeRideTrackingStatus = String(activeRide?.status ?? "");
  const activeRideTrackingId =
    activeRide &&
    ["accepted", "driver_en_route", "driver_arrived", "in_progress"].includes(
      activeRideTrackingStatus,
    )
      ? String(activeRide.id)
      : null;

  activeRideTrackingPayloadRef.current = activeRide;
  driverTrackingUserRef.current = session?.user;

  useEffect(() => {
    const refreshNextQueue = () => setNextRideQueueVersion((value) => value + 1);
    window.addEventListener(RAPAGO_DRIVER_NEXT_RIDES_EVENT, refreshNextQueue as EventListener);
    window.addEventListener("storage", refreshNextQueue as EventListener);
    return () => {
      window.removeEventListener(RAPAGO_DRIVER_NEXT_RIDES_EVENT, refreshNextQueue as EventListener);
      window.removeEventListener("storage", refreshNextQueue as EventListener);
    };
  }, []);
  void nextRideQueueVersion;

  useEffect(() => {
    const accessToken = session?.accessToken;
    const rideId = activeRideTrackingId;

    if (!accessToken || !rideId) {
      void rideLocationService.stopNativeBackground();
      return;
    }

    let cancelled = false;
    let stopForegroundWatch: (() => Promise<void>) | null = null;
    let publishing = false;
    let pendingPoint: DriverRideLocationPoint | null = null;
    let lastBackendWarningAt = 0;

    const publishLatestPoint = async (
      initialPoint: DriverRideLocationPoint,
    ): Promise<void> => {
      pendingPoint = initialPoint;
      if (publishing) return;

      publishing = true;

      try {
        while (!cancelled && pendingPoint) {
          const point = pendingPoint;
          pendingPoint = null;

          try {
            await rideLocationService.publish(accessToken, rideId, point);
          } catch (caught) {
            const now = Date.now();

            if (now - lastBackendWarningAt >= 15_000) {
              lastBackendWarningAt = now;
              console.warn(
                "[RAPA GO] No se pudo sincronizar una ubicación del conductor",
                caught,
              );
            }
          }
        }
      } finally {
        publishing = false;
      }
    };

    const applyRealDriverPoint = (point: DriverRideLocationPoint): void => {
      if (cancelled) return;

      const lat = Number(point.lat);
      const lng = Number(point.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const nextLocation = { lat, lng };
      const previousLocation = lastPublishedDriverLocationRef.current;
      const movedMeters = previousLocation
        ? distanceMetersForLiveDriverGps(previousLocation, nextLocation)
        : Number.POSITIVE_INFINITY;

      let heading =
        point.headingDegrees != null &&
        Number.isFinite(Number(point.headingDegrees))
          ? Number(point.headingDegrees)
          : liveDriverHeadingRef.current;

      if (previousLocation && movedMeters >= 4) {
        heading = bearingDegreesForLiveDriverGps(
          previousLocation,
          nextLocation,
        );
      }

      liveDriverHeadingRef.current = heading ?? null;
      lastPublishedDriverLocationRef.current = nextLocation;
      driverLocationRef.current = nextLocation;
      setDriverLocation(nextLocation);
      setLocationError(null);

      const trackedRide = activeRideTrackingPayloadRef.current;
      if (trackedRide && String(trackedRide.id) === rideId) {
        publishDriverLiveLocationForPassenger(
          trackedRide,
          {
            lat,
            lng,
            heading: heading ?? null,
            speed: point.speedMetersPerSecond ?? null,
            accuracy: point.accuracyMeters ?? null,
          },
          heading ?? null,
          driverTrackingUserRef.current,
        );
      }

      try {
        localStorage.setItem(
          "rapago_current_driver_location",
          JSON.stringify({
            rideId,
            lat,
            lng,
            heading: heading ?? null,
            speed: point.speedMetersPerSecond ?? null,
            accuracy: point.accuracyMeters ?? null,
            updatedAt: point.capturedAt,
            ...getDriverVehiclePublicPayload(driverTrackingUserRef.current),
          }),
        );
      } catch {
        // El backend sigue siendo la autoridad del GPS.
      }

      void publishLatestPoint({
        ...point,
        headingDegrees: heading ?? point.headingDegrees ?? null,
      });
    };

    async function startTracking(): Promise<void> {
      try {
        const initialPoint = await rideLocationService.current();
        applyRealDriverPoint(initialPoint);
      } catch (caught) {
        if (!cancelled) {
          setLocationError(
            caught instanceof Error
              ? caught.message
              : "No se pudo obtener la ubicación real del conductor.",
          );
        }
      }

      try {
        const stop = await rideLocationService.watch(
          applyRealDriverPoint,
          (message) => {
            if (!cancelled) {
              setLocationError(
                message || "Se interrumpió la señal GPS del conductor.",
              );
            }
          },
        );

        if (cancelled) {
          await stop();
        } else {
          stopForegroundWatch = stop;
        }
      } catch (caught) {
        if (!cancelled) {
          setLocationError(
            caught instanceof Error
              ? caught.message
              : "No se pudo iniciar el seguimiento GPS.",
          );
        }
      }

      try {
        await rideLocationService.startNativeBackground(
          accessToken,
          rideId,
        );
      } catch (caught) {
        // El seguimiento foreground continúa. En Android/iOS se registra el
        // problema para revisarlo sin ocultar el mapa al conductor.
        console.warn(
          "[RAPA GO] Seguimiento nativo en segundo plano no disponible",
          caught,
        );
      }
    }

    void startTracking();

    return () => {
      cancelled = true;
      pendingPoint = null;

      if (stopForegroundWatch) {
        void stopForegroundWatch();
      }

      void rideLocationService.stopNativeBackground();
    };
  }, [
    activeRideTrackingId,
    activeRideTrackingStatus,
    session?.accessToken,
  ]);

  const stopRideRequestAlert = useCallback((clearCurrentRide = true): void => {
    rideAlertControllerRef.current?.stop();
    rideAlertControllerRef.current = null;

    if (clearCurrentRide) {
      setRideAlert(null);
    }
  }, []);

  useEffect(() => {
    const stopFromAnywhere = (event: Event) => {
      const rideId = String((event as CustomEvent<{ rideId?: string }>).detail?.rideId ?? "").trim();
      if (rideId) alertedRideIdsRef.current.add(rideId);
      stopRideRequestAlert(true);
    };

    window.addEventListener(RAPAGO_DRIVER_RIDE_ALERT_STOP_EVENT, stopFromAnywhere as EventListener);
    return () => window.removeEventListener(RAPAGO_DRIVER_RIDE_ALERT_STOP_EVENT, stopFromAnywhere as EventListener);
  }, [stopRideRequestAlert]);

  useEffect(() => {
    if (!isDriverOperationPageActive || document.visibilityState !== "visible") return;

    const notifyPassengerCancelled = (cancelledRide: Record<string, unknown>) => {
      if (!claimDriverPassengerCancelNoticeOnce(cancelledRide, session?.user)) return;
      markDriverRidePassengerCancelledLocally(cancelledRide);
      removeDriverRideAfterPassengerCancel(cancelledRide);

      const cancelledTitle = getDriverRideRouteDisplayLabel(cancelledRide as {
        originText?: string | null;
        destinationText?: string | null;
        notes?: string | null;
      });
      const cancellationReason = getPassengerCancellationReasonForDriver(cancelledRide);

      stopRideRequestAlert(true);
      setRideAlert(null);
      setAssignedRides((prev) =>
        prev.filter((ride) => !driverRideMatchesPassengerCancelledRecord(ride as unknown as Record<string, unknown>, cancelledRide)),
      );
      setAvailableRides((prev) =>
        prev.filter((ride) => !driverRideMatchesPassengerCancelledRecord(ride as unknown as Record<string, unknown>, cancelledRide)),
      );
      setReservationOffers((prev) =>
        prev.filter((ride) => !driverRideMatchesPassengerCancelledRecord(ride as unknown as Record<string, unknown>, cancelledRide)),
      );
      setConfirmedReservationOffers((prev) =>
        prev.filter((ride) => !driverRideMatchesPassengerCancelledRecord(ride as unknown as Record<string, unknown>, cancelledRide)),
      );

      setError(`El pasajero canceló el viaje. Motivo: ${cancellationReason}`);

      try {
        if ("vibrate" in navigator) navigator.vibrate?.([220, 90, 220]);
      } catch {
        // No bloquea el aviso.
      }

      setPassengerCancelNotice({
        route: cancelledTitle,
        message: `Motivo informado: ${cancellationReason}

La solicitud fue retirada de tu pantalla. No debes continuar hacia la recogida.`,
      });
    };

    const checkPassengerCancelled = (event?: Event) => {
      const detail = (event as CustomEvent<{ cancelled?: unknown; ride?: unknown }> | undefined)?.detail;
      const eventRecord =
        detail?.cancelled && typeof detail.cancelled === "object"
          ? detail.cancelled as Record<string, unknown>
          : detail?.ride && typeof detail.ride === "object"
            ? detail.ride as Record<string, unknown>
            : null;

      const candidates: Array<Record<string, unknown>> = [
        ...assignedRides.map((ride) => ride as unknown as Record<string, unknown>),
        ...availableRides.map((ride) => ride as unknown as Record<string, unknown>),
        ...(rideAlert ? [rideAlert as unknown as Record<string, unknown>] : []),
        ...(scheduledReservationReadyAlert ? [scheduledReservationReadyAlert as unknown as Record<string, unknown>] : []),
      ];

      if (eventRecord && isRidePassengerCancelledForDriver(eventRecord)) {
        const matchesVisibleRide =
          candidates.length === 0 ||
          candidates.some((ride) => driverRideMatchesPassengerCancelledRecord(ride, eventRecord));

        if (matchesVisibleRide) {
          notifyPassengerCancelled(eventRecord);
          return;
        }
      }

      for (const ride of candidates) {
        const cancelledMatch = findPassengerCancelledRideForDriver(ride);
        if (cancelledMatch) {
          notifyPassengerCancelled(cancelledMatch);
          return;
        }
      }
    };

    checkPassengerCancelled();

    const timerId = window.setInterval(checkPassengerCancelled, 1200);

    window.addEventListener("rapago:passenger-rides-updated", checkPassengerCancelled as EventListener);
    window.addEventListener("rapago:driver-available-rides-updated", checkPassengerCancelled as EventListener);
    window.addEventListener(RAPAGO_REQUEUED_RIDES_EVENT, checkPassengerCancelled as EventListener);
    window.addEventListener(RAPAGO_PASSENGER_CANCELLED_RIDE_EVENT, checkPassengerCancelled as EventListener);
    window.addEventListener("storage", checkPassengerCancelled as EventListener);

    return () => {
      window.clearInterval(timerId);
      window.removeEventListener("rapago:passenger-rides-updated", checkPassengerCancelled as EventListener);
      window.removeEventListener("rapago:driver-available-rides-updated", checkPassengerCancelled as EventListener);
      window.removeEventListener(RAPAGO_REQUEUED_RIDES_EVENT, checkPassengerCancelled as EventListener);
      window.removeEventListener(RAPAGO_PASSENGER_CANCELLED_RIDE_EVENT, checkPassengerCancelled as EventListener);
      window.removeEventListener("storage", checkPassengerCancelled as EventListener);
    };
  }, [
    assignedRides,
    availableRides,
    rideAlert,
    scheduledReservationReadyAlert,
    stopRideRequestAlert,
    isDriverOperationPageActive,
    session?.user,
  ]);

  const startRideRequestAlert = useCallback(
    (ride: AvailableRideData): void => {
      stopRideRequestAlert(false);

      alertedRideIdsRef.current.add(ride.id);
      setRideAlert(ride);
      setRideAlertSecondsLeft(60);
      rideAlertControllerRef.current = startRideRequestAlertSound(
        activeRide
          ? "Nuevo servicio disponible para continuar cuando cierres tu viaje actual."
          : "Hay una solicitud de viaje nueva disponible.",
      );
    },
    [activeRide, stopRideRequestAlert],
  );

  const stopScheduledReservationReadyAlert = useCallback((clearAlert = true): void => {
    scheduledReservationAlertControllerRef.current?.stop();
    scheduledReservationAlertControllerRef.current = null;

    if (clearAlert) {
      setScheduledReservationReadyAlert(null);
      setScheduledReservationAlertSecondsLeft(60);
    }
  }, []);

  const startScheduledReservationReadyAlert = useCallback(
    (ride: DriverScheduledReservationOffer): void => {
      stopScheduledReservationReadyAlert(false);
      stopRideRequestAlert(true);

      alertedScheduledReservationKeysRef.current.add(
        getScheduledReservationAlertKey(ride as unknown as DriverAcceptedRideBridgeRecord),
      );
      setScheduledReservationReadyAlert(ride);
      setScheduledReservationAlertSecondsLeft(60);
      scheduledReservationAlertControllerRef.current = startScheduledReservationAlertSound();
    },
    [stopRideRequestAlert, stopScheduledReservationReadyAlert],
  );

  function dismissAvailableRide(ride: AvailableRideData | string): void {
    const rideId = typeof ride === "string" ? ride : ride.id;
    alertedRideIdsRef.current.add(rideId);
    markDriverRideRequestHandled(
      typeof ride === "string"
        ? ride
        : (ride as unknown as Partial<AvailableRideData> & Record<string, unknown>),
      session?.user,
      "rejected",
    );
    stopAllDriverRideRequestAlerts(rideId);

    if (rideAlert?.id === rideId) {
      stopRideRequestAlert(true);
    }

    if (typeof ride !== "string") {
      requeueAvailableRideForNextDriver(ride, session?.user, "driver_rejected");
    }

    setAvailableRides((prev) =>
      removeHandledRideFromAvailableList(
        prev,
        typeof ride === "string"
          ? ride
          : (ride as unknown as Partial<AvailableRideData> & Record<string, unknown>),
      ),
    );
  }

  useEffect(() => {
    return () => {
      stopRideRequestAlert(true);
      stopScheduledReservationReadyAlert(true);
    };
  }, [stopRideRequestAlert, stopScheduledReservationReadyAlert]);

  useEffect(() => {
    if (!rideAlert) return;

    const countdown = window.setInterval(() => {
      setRideAlertSecondsLeft((current) => {
        if (current <= 1) {
          stopRideRequestAlert(true);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(countdown);
  }, [rideAlert?.id, stopRideRequestAlert]);

  useEffect(() => {
    if (!scheduledReservationReadyAlert) return;

    const countdown = window.setInterval(() => {
      setScheduledReservationAlertSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(countdown);
  }, [scheduledReservationReadyAlert?.id]);

  useEffect(() => {
    if (!showOnlyReservations || !isDriverAvailable || activeRide) {
      stopScheduledReservationReadyAlert(true);
      return;
    }

    const tick = () => {
      const readyReservation = findScheduledReservationReadyForDriver(
        session?.user,
        true,
        alertedScheduledReservationKeysRef.current,
      );

      if (!readyReservation) return;

      const nextKey = getScheduledReservationAlertKey(
        readyReservation as unknown as DriverAcceptedRideBridgeRecord,
      );
      const currentKey = scheduledReservationReadyAlert
        ? getScheduledReservationAlertKey(
            scheduledReservationReadyAlert as unknown as DriverAcceptedRideBridgeRecord,
          )
        : null;

      if (currentKey !== nextKey) {
        startScheduledReservationReadyAlert(readyReservation);
      }
    };

    tick();

    const timerId = window.setInterval(tick, 15_000);
    window.addEventListener(DRIVER_SCHEDULED_RESERVATION_EVENT, tick as EventListener);
    window.addEventListener(DRIVER_ASSIGNED_SCHEDULED_RIDE_EVENT, tick as EventListener);
    window.addEventListener("rapago:driver-reservation-inbox-updated", tick as EventListener);
    window.addEventListener("rapago:admin-scheduled-rides-updated", tick as EventListener);
    window.addEventListener(DRIVER_ADMIN_RESERVATION_AUTO_ASSIGNED_EVENT, tick as EventListener);
    window.addEventListener("storage", tick as EventListener);

    return () => {
      window.clearInterval(timerId);
      window.removeEventListener(DRIVER_SCHEDULED_RESERVATION_EVENT, tick as EventListener);
      window.removeEventListener(DRIVER_ASSIGNED_SCHEDULED_RIDE_EVENT, tick as EventListener);
      window.removeEventListener("rapago:driver-reservation-inbox-updated", tick as EventListener);
      window.removeEventListener("rapago:admin-scheduled-rides-updated", tick as EventListener);
      window.removeEventListener(DRIVER_ADMIN_RESERVATION_AUTO_ASSIGNED_EVENT, tick as EventListener);
      window.removeEventListener("storage", tick as EventListener);
    };
  }, [
    activeRide?.id,
    isDriverAvailable,
    scheduledReservationReadyAlert,
    session?.user,
    showOnlyReservations,
    startScheduledReservationReadyAlert,
    stopScheduledReservationReadyAlert,
  ]);

  useEffect(() => {
    if (!isDriverAvailable) {
      stopRideRequestAlert(true);
      return;
    }

    if (rideAlert && !availableRides.some((ride) => ride.id === rideAlert.id)) {
      stopRideRequestAlert(true);
      return;
    }

    if (rideAlert) return;

    const nextRide = availableRides.find(
      (ride) =>
        ride.status === "requested" &&
        !alertedRideIdsRef.current.has(ride.id) &&
        !driverRideRequestIsHandled(ride as unknown as Record<string, unknown>, session?.user),
    );

    if (nextRide && activeRide) {
      // Tipo Uber: si el conductor va en un viaje, la nueva solicitud aparece
      // encima del mapa/trayecto como "próximo servicio" y la alerta se apaga al aceptar/rechazar.
      startRideRequestAlert(nextRide);
      return;
    }
  }, [
    activeRide?.id,
    availableRides,
    isDriverAvailable,
    rideAlert,
    startRideRequestAlert,
    stopRideRequestAlert,
  ]);

  useEffect(() => {
    const handleAvailabilityEvent = (event: Event) => {
      const next = (event as CustomEvent<{ value?: DriverAvailability }>).detail
        ?.value;
      setDriverAvailability(
        next === "unavailable"
          ? "unavailable"
          : readDriverAvailability(driverAvailabilityUser),
      );
    };

    const handleStorageEvent = (event: StorageEvent) => {
      if (
        event.key === DRIVER_AVAILABILITY_STORAGE_KEY ||
        event.key === DRIVER_AVAILABILITY_MAP_KEY ||
        event.key === DRIVER_AVAILABILITY_EMAIL_KEY ||
        event.key === DRIVER_AVAILABILITY_NAME_KEY
      ) {
        setDriverAvailability(readDriverAvailability(driverAvailabilityUser));
      }
    };

    window.addEventListener(
      DRIVER_AVAILABILITY_EVENT,
      handleAvailabilityEvent as EventListener,
    );
    window.addEventListener("storage", handleStorageEvent);

    return () => {
      window.removeEventListener(
        DRIVER_AVAILABILITY_EVENT,
        handleAvailabilityEvent as EventListener,
      );
      window.removeEventListener("storage", handleStorageEvent);
    };
  }, [
    driverAvailabilityUser?.id,
    driverAvailabilityUser?.userId,
    driverAvailabilityUser?.email,
    driverAvailabilityUser?.name,
  ]);

  useEffect(() => {
    const applyNativeLocation = (raw: unknown): void => {
      if (!raw || typeof raw !== "object") return;
      const detail = raw as Record<string, unknown>;
      const lat = Number(detail.lat);
      const lng = Number(detail.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const nextLocation = { lat, lng };
      const previousLocation = lastPublishedDriverLocationRef.current;
      const movedMeters = previousLocation
        ? distanceMetersForLiveDriverGps(previousLocation, nextLocation)
        : Number.POSITIVE_INFINITY;
      const eventHeading = Number(detail.heading);

      if (previousLocation && movedMeters >= 4) {
        liveDriverHeadingRef.current = bearingDegreesForLiveDriverGps(
          previousLocation,
          nextLocation,
        );
      } else if (Number.isFinite(eventHeading)) {
        liveDriverHeadingRef.current = eventHeading;
      }

      lastPublishedDriverLocationRef.current = nextLocation;
      driverLocationRef.current = nextLocation;
      setLocationError(null);
      setDriverLocation(nextLocation);
    };

    const handleNativeLocation = (event: Event): void => {
      applyNativeLocation((event as CustomEvent<unknown>).detail);
    };

    window.addEventListener(
      "rapago:driver-native-location",
      handleNativeLocation as EventListener,
    );

    try {
      const currentRaw = localStorage.getItem("rapago_current_driver_location");
      if (currentRaw) applyNativeLocation(JSON.parse(currentRaw) as unknown);
    } catch {
      // Espera el siguiente punto nativo.
    }

    return () => {
      window.removeEventListener(
        "rapago:driver-native-location",
        handleNativeLocation as EventListener,
      );
    };
  }, []);

  const loadRides = useCallback(async (background = false) => {
    if (
      !session?.accessToken ||
      !isDriverOperationPageActive ||
      document.visibilityState !== "visible" ||
      requestsLoadInFlightRef.current ||
      Date.now() < requestsNextLoadAtRef.current
    ) {
      return;
    }

    requestsLoadInFlightRef.current = true;
    requestsNextLoadAtRef.current = Date.now() + 2_000;

    if (!background) {
      setLoading(true);
      setError(null);
    }

    try {
      if (!readSelectedDriverVehicleId(session?.user)) {
        await hydrateApprovedDriverProfileFromServer(
          session.accessToken,
          session?.user,
        ).catch(() => null);
      }

      const mine = await ridesService.listDriverRides(session.accessToken);

      const recentPassengerCancellation = mine
        .map((ride) => ride as unknown as Record<string, unknown>)
        .filter((ride) => isRecentServerPassengerCancellationForDriver(ride))
        .filter((ride) => !wasDriverRidePassengerCancelledLocally(ride))
        .sort((a, b) => {
          const bTime = new Date(String(b.cancelledAt ?? b.updatedAt ?? "")).getTime();
          const aTime = new Date(String(a.cancelledAt ?? a.updatedAt ?? "")).getTime();
          return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
        })[0];

      if (recentPassengerCancellation) {
        const shouldShowPassengerCancelNotice = claimDriverPassengerCancelNoticeOnce(
          recentPassengerCancellation,
          session?.user,
        );
        markDriverRidePassengerCancelledLocally(recentPassengerCancellation);
        removeDriverRideAfterPassengerCancel(recentPassengerCancellation);
        stopRideRequestAlert(true);
        setRideAlert(null);

        const route = getDriverRideRouteDisplayLabel(recentPassengerCancellation as {
          originText?: string | null;
          destinationText?: string | null;
          notes?: string | null;
        });
        const reason = getPassengerCancellationReasonForDriver(recentPassengerCancellation);

        setAssignedRides((current) =>
          current.filter((ride) =>
            !driverRideMatchesPassengerCancelledRecord(
              ride as unknown as Record<string, unknown>,
              recentPassengerCancellation,
            ),
          ),
        );
        setAvailableRides((current) =>
          current.filter((ride) =>
            !driverRideMatchesPassengerCancelledRecord(
              ride as unknown as Record<string, unknown>,
              recentPassengerCancellation,
            ),
          ),
        );
        setReservationOffers((current) =>
          current.filter((ride) =>
            !driverRideMatchesPassengerCancelledRecord(
              ride as unknown as Record<string, unknown>,
              recentPassengerCancellation,
            ),
          ),
        );
        setConfirmedReservationOffers((current) =>
          current.filter((ride) =>
            !driverRideMatchesPassengerCancelledRecord(
              ride as unknown as Record<string, unknown>,
              recentPassengerCancellation,
            ),
          ),
        );

        if (shouldShowPassengerCancelNotice) {
          setPassengerCancelNotice({
            route,
            message: `El pasajero canceló la reserva.

Motivo informado: ${reason}

La reserva fue retirada. No continúes hacia la recogida.`,
          });
          setError(`El pasajero canceló la reserva. Motivo: ${reason}`);

          try {
            if ("vibrate" in navigator) navigator.vibrate?.([240, 90, 240]);
          } catch {
            // No bloquea el aviso.
          }
        }
      }

      // Solo las reservas que el conductor inició desde la alerta especial
      // se convierten en mapa/ruta dentro de Solicitudes.
      const activeLocalScheduledRides = readActiveScheduledReservationRidesForDriver(session?.user);
      const activeLocalRideMirrors = readActiveDriverLocalRideMirrorsForDriver(session?.user);
      const activeServerRides = mine.filter((ride) => {
        if (wasDriverRideCancelledLocally(ride as unknown as Record<string, unknown>, session?.user)) return false;
        if (findPassengerCancelledRideForDriver(ride as unknown as Record<string, unknown>)) return false;

        const isActiveStatus = [
          "accepted",
          "driver_en_route",
          "driver_arrived",
          "in_progress",
        ].includes(ride.status);

        if (!isActiveStatus) return false;

        // Las reservas agendadas solo se muestran como ruta si el conductor tocó
        // "Iniciar viaje" en la alerta especial.
        if (driverRideLooksLikeScheduledReservation(ride as unknown as Record<string, unknown>)) {
          return driverScheduledReservationNavigationStarted(ride as unknown as Record<string, unknown>);
        }

        return true;
      });
      const activeByKey = new Map<string, DriverRideData>();
      for (const ride of [...activeLocalScheduledRides, ...activeLocalRideMirrors, ...activeServerRides]) {
        const key = getDriverScheduledReservationDedupeKey(ride as unknown as DriverAcceptedRideBridgeRecord) || String(ride.id);
        activeByKey.set(key, ride as DriverRideData);
      }
      setAssignedRides(Array.from(activeByKey.values()));

      const hasSelectedVehicleForWork = Boolean(readSelectedDriverVehicleId(session?.user));
      if (!hasSelectedVehicleForWork) {
        setReservationOffers([]);
        setConfirmedReservationOffers([]);
        setAvailableRides([]);
        setError("Debes elegir un vehículo activo en tu perfil para ver solicitudes o reservas.");
        return;
      }

      setReservationOffers(
        readDriverScheduledReservationOffers(session?.user, isDriverAvailable),
      );
      setConfirmedReservationOffers(
        readConfirmedWaitingScheduledReservationsForDriver(session?.user),
      );

      if (!isDriverAvailable) {
        setAvailableRides([]);
        return;
      }

      const available = await ridesService.listAvailableRides(
        session.accessToken,
      );
      const mergedAvailable = [...available, ...readRequeuedAvailableRides()];
      const byId = new Map<string, AvailableRideData>();
      for (const ride of mergedAvailable) {
        if (ride.status === "requested") {
          byId.set(ride.id, ride);
        }
      }
      setAvailableRides(
        Array.from(byId.values()).filter(
          (ride) =>
            !driverRideWasSkippedByCurrentDriver(ride as unknown as Record<string, unknown>, session?.user) &&
            !findPassengerCancelledRideForDriver(ride as unknown as Record<string, unknown>) &&
            !shouldHideFromNormalDriverRequestQueue(ride as unknown as Record<string, unknown>) &&
            !driverRideRequestIsHandled(ride as unknown as Record<string, unknown>, session?.user),
        ),
      );
    } catch (err) {
      // Si falla una consulta secundaria de la API, nunca eliminamos el viaje
      // que el conductor acaba de aceptar. Recuperamos el mapa desde los espejos
      // locales seguros y mantenemos la ruta activa.
      const activeLocalScheduledRides = readActiveScheduledReservationRidesForDriver(session?.user);
      const activeLocalRideMirrors = readActiveDriverLocalRideMirrorsForDriver(session?.user);
      const recoveredByKey = new Map<string, DriverRideData>();

      for (const ride of [...activeLocalScheduledRides, ...activeLocalRideMirrors]) {
        if (findPassengerCancelledRideForDriver(ride as unknown as Record<string, unknown>)) continue;

        const key =
          getDriverScheduledReservationDedupeKey(
            ride as unknown as DriverAcceptedRideBridgeRecord,
          ) || String(ride.id);

        if (key) recoveredByKey.set(key, ride as DriverRideData);
      }

      const recoveredActiveRides = Array.from(recoveredByKey.values());
      setAssignedRides(recoveredActiveRides);
      setReservationOffers(
        readDriverScheduledReservationOffers(session?.user, isDriverAvailable),
      );
      setConfirmedReservationOffers(
        readConfirmedWaitingScheduledReservationsForDriver(session?.user),
      );

      if (isDriverAvailable && !readSelectedDriverVehicleId(session?.user)) {
        setAvailableRides([]);
        setError("Debes elegir un vehículo activo en tu perfil para ver solicitudes o reservas.");
        return;
      }

      if (isDriverAvailable) {
        setAvailableRides(
          readRequeuedAvailableRides().filter(
            (ride) =>
              ride.status === "requested" &&
              !driverRideWasSkippedByCurrentDriver(ride as unknown as Record<string, unknown>, session?.user) &&
              !findPassengerCancelledRideForDriver(ride as unknown as Record<string, unknown>) &&
              !shouldHideFromNormalDriverRequestQueue(ride as unknown as Record<string, unknown>) &&
              !driverRideRequestIsHandled(ride as unknown as Record<string, unknown>, session?.user) &&
              !driverAvailableRideMatchesScheduledReservationForDriver(
                ride as unknown as Record<string, unknown>,
                session?.user,
              ),
          ),
        );
      }
      if (recoveredActiveRides.length > 0) {
        // El viaje ya está aceptado y el mapa puede seguir funcionando aunque
        // haya fallado la carga de nuevas solicitudes disponibles.
        setError(null);
      } else {
        setError(
          err instanceof Error ? err.message : "Error al cargar solicitudes.",
        );
      }
    } finally {
      requestsLoadInFlightRef.current = false;
      if (!background) setLoading(false);
    }
  }, [
    isDriverAvailable,
    isDriverOperationPageActive,
    session?.accessToken,
    session?.user,
    stopRideRequestAlert,
  ]);

  useEffect(() => {
    if (isDriverOperationPageActive) void loadRides();
  }, [isDriverOperationPageActive, loadRides]);

  useEffect(() => {
    if (!isDriverOperationPageActive) return;

    const tick = () => {
      if (document.visibilityState === "visible") void loadRides(true);
    };

    const intervalId = window.setInterval(tick, 15_000);
    document.addEventListener("visibilitychange", tick);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [isDriverOperationPageActive, loadRides]);

  useEffect(() => {
    const refreshAvailableAfterRequeue = () => {
      void loadRides();
    };

    window.addEventListener(RAPAGO_REQUEUED_RIDES_EVENT, refreshAvailableAfterRequeue as EventListener);
    window.addEventListener(DRIVER_SCHEDULED_RESERVATION_EVENT, refreshAvailableAfterRequeue as EventListener);
    window.addEventListener(DRIVER_ASSIGNED_SCHEDULED_RIDE_EVENT, refreshAvailableAfterRequeue as EventListener);
    window.addEventListener("rapago:driver-reservation-inbox-updated", refreshAvailableAfterRequeue as EventListener);
    window.addEventListener("rapago:admin-scheduled-rides-updated", refreshAvailableAfterRequeue as EventListener);
    window.addEventListener(DRIVER_ADMIN_RESERVATION_AUTO_ASSIGNED_EVENT, refreshAvailableAfterRequeue as EventListener);
    window.addEventListener("rapago:driver-available-rides-updated", refreshAvailableAfterRequeue as EventListener);
    window.addEventListener("storage", refreshAvailableAfterRequeue);

    return () => {
      window.removeEventListener(RAPAGO_REQUEUED_RIDES_EVENT, refreshAvailableAfterRequeue as EventListener);
      window.removeEventListener(DRIVER_SCHEDULED_RESERVATION_EVENT, refreshAvailableAfterRequeue as EventListener);
      window.removeEventListener(DRIVER_ASSIGNED_SCHEDULED_RIDE_EVENT, refreshAvailableAfterRequeue as EventListener);
      window.removeEventListener("rapago:driver-reservation-inbox-updated", refreshAvailableAfterRequeue as EventListener);
      window.removeEventListener("rapago:admin-scheduled-rides-updated", refreshAvailableAfterRequeue as EventListener);
      window.removeEventListener(DRIVER_ADMIN_RESERVATION_AUTO_ASSIGNED_EVENT, refreshAvailableAfterRequeue as EventListener);
      window.removeEventListener("rapago:driver-available-rides-updated", refreshAvailableAfterRequeue as EventListener);
      window.removeEventListener("storage", refreshAvailableAfterRequeue);
    };
  }, [loadRides]);

  async function handleAcceptRide(rideId: string): Promise<void> {
    if (!session?.accessToken) return;

    alertedRideIdsRef.current.add(rideId);
    stopAllDriverRideRequestAlerts(rideId);
    if (rideAlert?.id === rideId) {
      stopRideRequestAlert(true);
    }


    if (!isDriverAvailable) {
      setError(
        "Estás en modo no disponible. Cambia a disponible para aceptar viajes.",
      );
      return;
    }

    const acceptedLocation = driverLocationRef.current ?? driverLocation;

    setAcceptingId(rideId);
    setError(null);

    try {
      const accepted = enrichRideWithSelectedDriverVehicle(
        await ridesService.acceptRideRequest(
          session.accessToken,
          rideId,
        ) as unknown as Record<string, unknown>,
        session?.user,
      );
      const activeAccepted = activeRide
        ? saveDriverNextRideAfterCurrent(accepted, activeRide, session?.user)
        : saveDriverActiveRideLocalMirror(accepted, session?.user);

      publishAcceptedDriverVehicleToPassenger(activeAccepted as unknown as DriverAcceptedRideBridgeRecord, session?.user);
      markDriverRideRequestHandled(activeAccepted as unknown as Record<string, unknown>, session?.user, activeRide ? "accepted_next" : "accepted");
      stopAllDriverRideRequestAlerts(rideId);

      if (activeRide) {
        setAvailableRides((prev) => removeHandledRideFromAvailableList(prev, activeAccepted as unknown as Record<string, unknown>));
        setRideAlert(null);
        setError("Próximo servicio aceptado. Se activará cuando cierres el viaje actual.");
        return;
      }

      if (acceptedLocation) {
        publishDriverLiveLocationForPassenger(
          activeAccepted as DriverRideData,
          {
            lat: acceptedLocation.lat,
            lng: acceptedLocation.lng,
            heading: null,
            speed: null,
            accuracy: null,
          },
          null,
          session?.user,
        );

        try {
          localStorage.setItem(
            "rapago_current_driver_location",
            JSON.stringify({
              rideId,
              lat: acceptedLocation.lat,
              lng: acceptedLocation.lng,
              updatedAt: new Date().toISOString(),
              ...getDriverVehiclePublicPayload(session?.user),
            }),
          );
        } catch {
          // No bloquea la aceptación del viaje.
        }
      }

      removeRequeuedRide(rideId);
      setAvailableRides((prev) => removeHandledRideFromAvailableList(prev, activeAccepted as unknown as Record<string, unknown>));
      setAssignedRides([activeAccepted as DriverRideData]);
      setRideAlert(null);
      setError(null);

      // Solicitudes solo recibe y acepta ofertas. Después de aceptar,
      // el conductor opera el servicio en el mapa grande de Viaje activo.
      history.replace(ROUTES.DRIVER.ACTIVE_RIDE);

      window.setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("rapago:driver-rides-updated", {
            detail: { ride: activeAccepted },
          }),
        );
      }, 120);
    } catch (err) {
      const fallbackAvailable = getAvailableRideById(rideId, availableRides);

      if (
        fallbackAvailable &&
        (isCancelledRideConflictMessage(err) || rideCanBeAcceptedLocallyAfterRequeue(fallbackAvailable))
      ) {
        const acceptedLocal = buildLocalAcceptedRideFromAvailable(
          fallbackAvailable,
          session?.user,
        );
        const activeAcceptedLocal = activeRide
          ? saveDriverNextRideAfterCurrent(acceptedLocal, activeRide, session?.user)
          : saveDriverActiveRideLocalMirror(acceptedLocal, session?.user);

        publishAcceptedDriverVehicleToPassenger(activeAcceptedLocal as unknown as Record<string, unknown>, session?.user);
        markDriverRideRequestHandled(activeAcceptedLocal as unknown as Record<string, unknown>, session?.user, activeRide ? "accepted_next" : "accepted");
        stopAllDriverRideRequestAlerts(rideId);

        if (activeRide) {
          removeRequeuedRide(rideId);
          setAvailableRides((prev) => removeHandledRideFromAvailableList(prev, activeAcceptedLocal as unknown as Record<string, unknown>));
          setRideAlert(null);
          setError("Próximo servicio aceptado. Se activará cuando cierres el viaje actual.");
          return;
        }

        if (acceptedLocation) {
          publishDriverLiveLocationForPassenger(
            activeAcceptedLocal,
            {
              lat: acceptedLocation.lat,
              lng: acceptedLocation.lng,
              heading: null,
              speed: null,
              accuracy: null,
            },
            null,
            session?.user,
          );

          try {
            localStorage.setItem(
              "rapago_current_driver_location",
              JSON.stringify({
                rideId,
                lat: acceptedLocation.lat,
                lng: acceptedLocation.lng,
                updatedAt: new Date().toISOString(),
                ...getDriverVehiclePublicPayload(session?.user),
              }),
            );
          } catch {
            // No bloquea la aceptación local.
          }
        }

        removeRequeuedRide(rideId);
        setAvailableRides((prev) => removeHandledRideFromAvailableList(prev, activeAcceptedLocal as unknown as Record<string, unknown>));
        setAssignedRides([activeAcceptedLocal]);
        setRideAlert(null);
        setError(null);

        history.replace(ROUTES.DRIVER.ACTIVE_RIDE);
        window.dispatchEvent(
          new CustomEvent("rapago:driver-rides-updated", {
            detail: { ride: activeAcceptedLocal },
          }),
        );
        return;
      }

      if (isCancelledRideConflictMessage(err)) {
        removeRequeuedRide(rideId);
        setAvailableRides((prev) => prev.filter((ride) => ride.id !== rideId));
        setError("Esta solicitud ya estaba cancelada en el servidor. La quitamos de la lista para que no vuelva a aparecer.");
        void loadRides();
        return;
      }

      setError(
        err instanceof Error
          ? err.message
          : "Este viaje ya fue tomado por otro conductor.",
      );
      void loadRides();
    } finally {
      setAcceptingId(null);
    }
  }

  async function handleArrivedSmart(ride: DriverRideData): Promise<void> {
    if (!session?.accessToken) return;

    try {
      /*
       * Backend exige este orden:
       * accepted -> driver_en_route -> driver_arrived
       *
       * En la pantalla tipo Uber mostramos directamente "Llegué",
       * pero por dentro hacemos los dos pasos para evitar el 409.
       */
      if (ride.status === "accepted") {
        await ridesService.markEnRoute(session.accessToken, ride.id);
      }

      await ridesService.markArrived(session.accessToken, ride.id);

      const arrivedAt = new Date().toISOString();
      const arrivedRide = saveDriverActiveRideLocalMirror(
        {
          ...(ride as DriverRideData & Record<string, unknown>),
          status: "driver_arrived",
          driverArrivedAt: arrivedAt,
          arrivedAt,
          noShowCountdownStartedAt: arrivedAt,
          passengerNotice: "Tu conductor llegó al punto. Sal ahora para evitar No show.",
          passengerNotification: "Tu conductor llegó al punto. Tienes 5 minutos para presentarte antes de No show.",
        },
        session?.user,
      );

      notifyPassengerDriverArrivedByAppAndWhatsapp(arrivedRide);
      await loadRides();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo marcar llegada.",
      );
      await loadRides();
    }
  }

  async function handleStartRide(rideId: string): Promise<void> {
    if (!session?.accessToken) return;
    try {
      await ridesService.startRide(session.accessToken, rideId);
      await loadRides();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo iniciar el viaje.",
      );
    }
  }

  function requestCompleteRide(ride: DriverRideData): void {
    if (ride.status !== "in_progress") return;
    setCompleteConfirmRide(ride);
  }

  async function performCompleteRide(
    ride: DriverRideData,
    cashClosure?: DriverCashClosurePayload | null,
  ): Promise<void> {
    if (!session?.accessToken) return;

    const rideId = String(ride.id ?? "").trim();
    if (!rideId) return;

    try {
      const completed = await ridesService.completeRide(session.accessToken, rideId);
      const currentRide = assignedRides.find((item) => item.id === rideId) ?? ride;
      const completedAt = new Date().toISOString();
      const cashPatch = buildDriverCashClosureRidePatch(currentRide, cashClosure);

      let cashBackendWarning: string | null = null;
      if (cashClosure) {
        try {
          await persistDriverCashClosureInBackend(session.accessToken, rideId, cashClosure);
        } catch (cashError) {
          cashBackendWarning =
            cashError instanceof Error
              ? `Viaje completado, pero el efectivo no llegó al backend: ${cashError.message}`
              : "Viaje completado, pero el efectivo no llegó al backend. Reintenta desde Mis Viajes.";
        }

        persistDriverCashClosureForAdmin(
          { ...(currentRide as unknown as Record<string, unknown>), ...cashPatch, completedAt, closedByDriverAt: completedAt },
          cashClosure,
          session?.user,
        );
      }

      saveDriverCompletedRideForEarnings(
        {
          ...(currentRide as DriverEarningsRide | undefined),
          ...((completed ?? {}) as Record<string, unknown>),
          ...cashPatch,
          id: rideId,
          status: "completed",
          completedAt,
          closedByDriverAt: completedAt,
          destinationConfirmedByDriver: true,
        } as DriverEarningsRide,
        session?.user,
      );

      clearDriverLiveLocationForPassenger(rideId);
      removeDriverActiveRideLocalMirror({ ...(currentRide as unknown as Record<string, unknown>), ...cashPatch }, session?.user);

      const nextActive = promoteDriverNextRideAfterCompletion(rideId, session?.user);
      const currentLocation = driverLocationRef.current ?? driverLocation;

      if (cashBackendWarning) {
        setError(cashBackendWarning);
      }

      if (nextActive && currentLocation) {
        publishAcceptedDriverVehicleToPassenger(nextActive as unknown as Record<string, unknown>, session?.user);
        publishDriverLiveLocationForPassenger(
          nextActive,
          {
            lat: currentLocation.lat,
            lng: currentLocation.lng,
            heading: liveDriverHeadingRef.current,
            speed: null,
            accuracy: null,
          },
          liveDriverHeadingRef.current,
          session?.user,
        );
        setAssignedRides([nextActive]);
        setError(
          cashBackendWarning ??
            "Viaje cerrado correctamente. Se activó tu próximo servicio aceptado.",
        );
      } else {
        setAssignedRides((prev) => prev.filter((item) => item.id !== rideId));
        setError(cashBackendWarning);
      }

      window.dispatchEvent(new CustomEvent("rapago:passenger-rides-updated", { detail: { rideId, status: "completed", cashClosure } }));
      await loadRides();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo finalizar el viaje.",
      );
    } finally {
      setCompleteConfirmRide(null);
    }
  }

  async function handleCompleteRide(rideId: string): Promise<void> {
    const ride = assignedRides.find((item) => item.id === rideId);
    if (!ride) return;
    requestCompleteRide(ride);
  }

  async function handleCancelRide(ride: DriverRideData): Promise<void> {
    const rideId = String(ride?.id ?? "").trim();
    if (!rideId) return;

    const cancelledRide = {
      ...(ride as DriverRideData & Record<string, unknown>),
      status: "cancelled",
      cancelledAt: new Date().toISOString(),
      cancelledByRole: "driver",
      cancelledBy: "driver",
      cancellationReason: "Cancelado por conductor.",
      requeuedReason: "driver_cancelled",
    } as DriverRideData & Record<string, unknown>;

    // Primero lo bloqueamos localmente para que el backend no lo vuelva a pintar
    // como activo si responde tarde o devuelve 500/404 en desarrollo.
    markDriverRideCancelledLocally(cancelledRide, session?.user);
    clearDriverLiveLocationForPassenger(rideId);
    clearDriverActiveRideLocalMirrors(cancelledRide);

    setAssignedRides((prev) =>
      prev.filter((item) => (!wasDriverRideCancelledLocally(item as unknown as Record<string, unknown>, session?.user) && !wasDriverRideNoShowCompletedLocally(item as unknown as Record<string, unknown>, session?.user))),
    );
    setCancelConfirmRide(null);
    setError(null);

    let requeued: AvailableRideData | null = null;

    try {
      requeued = requeueRideAfterDriverCancel(ride, session?.user);

      if (driverRideLooksLikeScheduledReservation(requeued as unknown as Record<string, unknown>)) {
        const nextAssignment = resolveScheduledReservationNextDriverAssignment(
          requeued as unknown as DriverAcceptedRideBridgeRecord,
          session?.user,
          "driver_cancelled",
        );
        updateDriverScheduledReservationEverywhere(
          requeued as unknown as DriverAcceptedRideBridgeRecord,
          () => nextAssignment,
        );
      }
    } catch {
      // No bloquea la limpieza visual del conductor.
    }

    if (isDriverAvailable && requeued) {
      setAvailableRides((prev) =>
        prev.filter(
          (item) =>
            !driverRideIdentityMatches(
              item as unknown as Record<string, unknown>,
              requeued as unknown as Record<string, unknown>,
            ) &&
            (!wasDriverRideCancelledLocally(item as unknown as Record<string, unknown>, session?.user) && !wasDriverRideNoShowCompletedLocally(item as unknown as Record<string, unknown>, session?.user)),
        ),
      );
    }

    if (session?.accessToken) {
      try {
        await ridesService.cancelAcceptedRide(session.accessToken, rideId);
      } catch {
        // Aunque el backend responda 404/500, la app ya limpió el viaje activo localmente.
      }
    }

    window.dispatchEvent(new CustomEvent("rapago:driver-active-ride-cancelled", { detail: { rideId, ride: cancelledRide } }));
    window.dispatchEvent(new CustomEvent("rapago:driver-rides-updated", { detail: { rideId, status: "cancelled" } }));
    window.setTimeout(() => void loadRides(), 450);
  }

  function requestCancelActiveRide(ride: DriverRideData): void {
    setCancelConfirmRide(ride);
  }

  async function handleDriverNoShowRide(ride: DriverRideData): Promise<void> {
    const rideId = String(ride.id ?? "").trim();
    if (!rideId) return;

    const noShowState = getDriverNoShowState(ride as DriverRideData & Record<string, unknown>);
    if (!noShowState.allowed) {
      setError(`Debes esperar 5 minutos desde que llegaste al punto. Falta ${formatDriverNoShowRemaining(noShowState.remainingMs)}.`);
      return;
    }

    setAcceptingId(rideId);
    setError(null);

    try {
      notifyPassengerNoShowByAppAndWhatsapp(ride, noShowState.feeClp);

      const charge = saveDriverNoShowChargeForPassenger(ride, session?.user);
      markPassengerRideNoShowCancelledFromDriver(ride, charge);
      clearDriverNoShowTimer(ride as DriverRideData & Record<string, unknown>);

      const noShowClosedRide = markDriverRideNoShowCompletedLocally(
        {
          ...(ride as unknown as Record<string, unknown>),
          id: rideId,
          noShowChargeClp: Number(charge.amountClp ?? noShowState.feeClp ?? 0),
        } as unknown as DriverRideData & Record<string, unknown>,
        session?.user,
      );

      try {
        clearDriverLiveLocationForPassenger(rideId);
      } catch {
        // No bloquea cierre visual.
      }

      try {
        clearDriverActiveRideLocalMirrors(noShowClosedRide);
      } catch {
        // No bloquea cierre visual.
      }

      try {
        removeDriverActiveRideLocalMirror(noShowClosedRide as unknown as Record<string, unknown>, session?.user);
      } catch {
        // No bloquea cierre visual.
      }


      setAssignedRides((prev) =>
        prev.filter(
          (item) =>
            !driverRideNoShowCompletedIdentityMatches(
              item as unknown as Record<string, unknown>,
              noShowClosedRide as unknown as Record<string, unknown>,
            ),
        ),
      );






      if (session?.accessToken) {
        try {
          await declareDriverNoShowInBackend(
            session.accessToken,
            rideId,
          );
        } catch (backendError) {
          console.error(
            "[RAPA GO] No Show local cerrado, pero backend falló",
            backendError,
          );
        }
      }

      window.dispatchEvent(
        new CustomEvent("rapago:driver-active-ride-cancelled", {
          detail: {
            rideId,
            ride: noShowClosedRide,
            status: "completed",
            reason: "driver_no_show",
            noShowCompleted: true,
          },
        }),
      );

      window.dispatchEvent(
        new CustomEvent("rapago:driver-rides-updated", {
          detail: {
            rideId,
            status: "completed",
            reason: "driver_no_show",
            noShowCompleted: true,
          },
        }),
      );

      window.dispatchEvent(
        new CustomEvent("rapago:driver-available-rides-updated", {
          detail: {
            rideId,
            status: "completed",
            reason: "driver_no_show",
            noShowCompleted: true,
          },
        }),
      );

      setError("No show registrado. El viaje fue cerrado y retirado de tus viajes activos.");
    } catch (err) {
      console.error("[RAPA GO] Error cerrando No show", err);
      setError(err instanceof Error ? err.message : "No se pudo cerrar el No show.");
    } finally {
      setAcceptingId(null);
    }
  }

  async function handleStartReadyScheduledReservation(ride: DriverScheduledReservationOffer): Promise<void> {
    if (!isDriverAvailable) {
      setError("Estás no disponible. Activa disponible para iniciar esta reserva.");
      return;
    }

    setAcceptingId(String(ride.id));
    setError(null);

    const startWithLocation = async (point: { lat: number; lng: number } | null): Promise<void> => {
      const started = startDriverScheduledReservationNavigationLocally(ride, session?.user);
      const activeStarted = getActiveScheduledReservationRideForDriver(
        started as unknown as DriverAcceptedRideBridgeRecord,
        session?.user,
      );

      if (activeStarted) {
        setAssignedRides([activeStarted]);

        if (point) {
          publishDriverLiveLocationForPassenger(
            activeStarted,
            {
              lat: point.lat,
              lng: point.lng,
              heading: null,
              speed: null,
              accuracy: null,
            },
            null,
            session?.user,
          );
        }
      }

      stopScheduledReservationReadyAlert(true);
      window.history.pushState(null, "", DRIVER_REQUESTS_VIEW_ROUTE);
      window.dispatchEvent(new PopStateEvent("popstate"));
      window.setTimeout(() => void loadRides(), 250);
    };

    try {
      const currentPoint = driverLocationRef.current ?? driverLocation;
      if (currentPoint) {
        await startWithLocation(currentPoint);
        return;
      }

      if (!navigator.geolocation) {
        await startWithLocation(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          void startWithLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          }).finally(() => setAcceptingId(null));
        },
        () => {
          void startWithLocation(null).finally(() => setAcceptingId(null));
        },
        { enableHighAccuracy: true, timeout: 9000, maximumAge: 10000 },
      );
      return;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar la reserva.");
    } finally {
      if (!navigator.geolocation || driverLocationRef.current || driverLocation) setAcceptingId(null);
    }
  }

  async function handleAcceptScheduledReservation(ride: DriverScheduledReservationOffer): Promise<void> {
    // Las reservas asignadas por admin se aceptan localmente aunque la sesión
    // de desarrollo no traiga accessToken. No debe quedarse silencioso.
    if (!isDriverAvailable) {
      setError("Estás no disponible. Activa disponible para confirmar esta reserva.");
      return;
    }

    setAcceptingId(String(ride.id));
    setError(null);

    try {
      const accepted = acceptDriverScheduledReservationLocally(ride, session?.user);
      const acceptedRecord = accepted as unknown as DriverAcceptedRideBridgeRecord;

      setReservationOffers((prev) => prev.filter((item) => !isSameDriverAcceptedRide(item, ride)));

      // Si la reserva ya está en hora de activación, al aceptar debe abrirse la ruta
      // de inmediato. Si todavía falta tiempo, queda en "Reservas aceptadas" esperando
      // el aviso especial de salida.
      if (driverScheduledReservationIsActiveNow(acceptedRecord)) {
        setConfirmedReservationOffers(readConfirmedWaitingScheduledReservationsForDriver(session?.user));
        await handleStartReadyScheduledReservation(accepted);
        return;
      }

      const activeAccepted = getActiveScheduledReservationRideForDriver(
        acceptedRecord,
        session?.user,
      );

      setConfirmedReservationOffers(readConfirmedWaitingScheduledReservationsForDriver(session?.user));

      if (activeAccepted) {
        setAssignedRides([activeAccepted]);

        const point = driverLocationRef.current ?? driverLocation;
        if (point) {
          publishDriverLiveLocationForPassenger(
            activeAccepted,
            {
              lat: point.lat,
              lng: point.lng,
              heading: null,
              speed: null,
              accuracy: null,
            },
            null,
            session?.user,
          );
        }
      }

      pushPassengerNotification({
        rideId: String(ride.id),
        type: "scheduled_driver_assigned",
        title: "Tu conductor fue asignado",
        body: "El conductor confirmó tu reserva. Ya puedes ver sus datos, vehículo y contacto en Mis Viajes.",
      });

      window.setTimeout(() => void loadRides(), 300);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo confirmar la reserva.");
    } finally {
      setAcceptingId(null);
    }
  }

  async function handleRejectScheduledReservation(
    ride: DriverScheduledReservationOffer,
    rejectionReason: string,
  ): Promise<void> {
    const cleanReason = sanitizeDriverTripSafetyText(rejectionReason, 260);

    if (!cleanReason) {
      setError("Debes escribir el motivo del rechazo.");
      return;
    }

    setPendingReservationReject(null);
    setAcceptingId(String(ride.id));
    setError(null);

    try {
      const nextAssignment = rejectDriverScheduledReservationLocally(
        ride,
        session?.user,
        cleanReason,
      );

      alertedScheduledReservationKeysRef.current.add(
        getScheduledReservationAlertKey(
          ride as unknown as DriverAcceptedRideBridgeRecord,
        ),
      );
      setReservationOffers((prev) =>
        prev.filter((item) => !isSameDriverAcceptedRide(item, ride)),
      );
      setConfirmedReservationOffers((prev) =>
        prev.filter((item) => !isSameDriverAcceptedRide(item, ride)),
      );

      window.dispatchEvent(
        new CustomEvent("rapago:admin-scheduled-rides-updated", {
          detail: {
            ride: nextAssignment,
            driverRejected: true,
            rejectionReason: cleanReason,
          },
        }),
      );

      window.setTimeout(() => void loadRides(), 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo rechazar la reserva.");
    } finally {
      setAcceptingId(null);
    }
  }

  function DriverRideRequestAlertOverlay({
    ride,
  }: {
    ride: AvailableRideData;
  }): JSX.Element {
    const fareClp = getRideDisplayFareClp(ride as RideWithFarePayload);
    const paymentLabel = getRidePaymentMethodLabel(ride.notes);
    const rideVehicleCategory = getRideVehicleCategory(
      ride as RideWithFarePayload,
    );
    const rideVehicleLabel = getRideVehicleLabel(rideVehicleCategory);
    const rideVehicleEmoji = getRideVehicleEmoji(rideVehicleCategory);
    const tripTypeLabel = getRideTripTypeLabel(ride.notes);
    const tripTypeEmoji = getRideTripTypeEmoji(ride.notes);

    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          // Antes: 9999, el MISMO z-index que la tab bar flotante
          // (global.css:1699, ion-tab-bar, position:fixed). Con z-index
          // empatado, el orden de pintado lo decide el orden en el DOM, y la
          // tab bar se monta DESPUÉS del contenido de la ruta (RoleLayout.tsx
          // pone <IonTabBar> luego de <IonRouterOutlet>), así que podía
          // pintarse encima de esta alerta y tapar sus botones Aceptar/
          // Rechazar — la interacción más crítica de toda la app del
          // conductor. Ver --rp-z-above-tabbar en driver.css.
          zIndex: "var(--rp-z-above-tabbar)",
          background: "rgba(0,0,0,.58)",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          // Antes solo "18px": sin margen para el "home indicator" del
          // iPhone ni para la propia tab bar (que ahora queda por debajo,
          // pero no hace daño reservarle el mismo aire que a las otras dos
          // alertas de pantalla completa de este archivo).
          padding: "18px 18px calc(18px + env(safe-area-inset-bottom, 0px)) 18px",
          pointerEvents: "auto",
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="rapago-driver-request-alert-title"
          style={{
            width: "100%",
            maxWidth: 440,
            borderRadius: "28px",
            overflow: "hidden",
            background: "var(--rp-surface)",
            color: "var(--rp-text)",
            border: "2px solid var(--rp-border-c)",
            boxShadow: "var(--rp-shadow)",
          }}
        >
          <div
            style={{
              padding: "16px 18px",
              background: "linear-gradient(135deg,#2A1A18,#8F3F25)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                aria-hidden="true"
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 18,
                  background: "rgba(255,255,255,.14)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 0 24px rgba(255,211,61,.35)",
                }}
              >
                <IonIcon
                  icon={notificationsOutline}
                  style={{ fontSize: 28, color: "#ffd33d" }}
                />
              </div>

              <div>
                <div
                  id="rapago-driver-request-alert-title"
                  style={{
                    fontSize: "1.08rem",
                    fontWeight: 950,
                    lineHeight: 1.1,
                  }}
                >
                  {activeRide ? "Nuevo servicio para continuar" : "Nueva solicitud de viaje"}
                </div>
                <div
                  style={{ fontSize: ".78rem", opacity: 0.82, marginTop: 3 }}
                >
                  {activeRide ? "Aparece sobre tu trayecto actual · " : "Alerta sonora activa por "}
                  {formatRideAlertSeconds(rideAlertSecondsLeft)}
                </div>
              </div>
            </div>

            <span
              style={{
                borderRadius: 999,
                padding: "7px 10px",
                background: "rgba(255,255,255,.14)",
                border: "1px solid rgba(255,255,255,.28)",
                fontSize: ".68rem",
                fontWeight: 950,
                whiteSpace: "nowrap",
              }}
            >
              RESPONDER
            </span>
          </div>

          <div style={{ padding: "18px" }}>
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                marginBottom: 14,
              }}
            >
              <IonChip color="success" style={{ fontWeight: 950 }}>
                <IonIcon icon={volumeHighOutline} aria-hidden="true" />
                <IonLabel>Sonando</IonLabel>
              </IonChip>
              <IonChip color="warning" style={{ fontWeight: 950 }}>
                {rideVehicleEmoji} {rideVehicleLabel}
              </IonChip>
              <IonChip color="tertiary" style={{ fontWeight: 950 }}>
                {tripTypeEmoji} {tripTypeLabel}
              </IonChip>
              <IonChip color="medium" style={{ fontWeight: 950 }}>
                Pago: {paymentLabel}
              </IonChip>
            </div>

            <DriverFastSearchBadge ride={ride as unknown as RideWithFarePayload & Record<string, unknown>} />
            <PassengerRideNoteCard ride={ride} />

            <div
              style={{
                borderRadius: "20px",
                background: "var(--rp-surface-soft)",
                border: "var(--rp-border-w) solid var(--rp-border-c)",
                padding: "14px",
              }}
            >
              <div style={{ display: "grid", gap: 10 }}>
                <div>
                  <div
                    style={{
                      color: "var(--rp-ok-fg)",
                      fontSize: ".72rem",
                      fontWeight: 950,
                    }}
                  >
                    RECOGER EN
                  </div>
                  <div
                    style={{ fontWeight: 950, fontSize: "1rem", marginTop: 3 }}
                  >
                    {getDriverRidePointDisplayLabel(ride, "origin")}
                  </div>
                </div>

                <div
                  style={{
                    width: 2,
                    height: 28,
                    background: "linear-gradient(180deg,var(--rp-ok-fg),var(--rp-err-fg))",
                    borderRadius: 999,
                    marginLeft: 7,
                  }}
                />

                <div>
                  <div
                    style={{
                      color: "var(--rp-err-fg)",
                      fontSize: ".72rem",
                      fontWeight: 950,
                    }}
                  >
                    DESTINO
                  </div>
                  <div
                    style={{ fontWeight: 950, fontSize: "1rem", marginTop: 3 }}
                  >
                    {getDriverRidePointDisplayLabel(ride, "destination")}
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: 14,
                borderRadius: "20px",
                background: "var(--rp-surface-soft)",
                color: "var(--rp-text)",
                padding: "14px 15px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: ".72rem",
                    color: "var(--rp-label)",
                    fontWeight: 950,
                  }}
                >
                  PRECIO DEL VIAJE
                </div>
                <div
                  style={{ fontSize: "1.5rem", fontWeight: 950, marginTop: 2 }}
                >
                  {formatClp(fareClp)}
                </div>
              </div>

              <div
                style={{
                  fontSize: ".78rem",
                  fontWeight: 900,
                  textAlign: "right",
                }}
              >
                {tripTypeEmoji} {tripTypeLabel}
                <br />
                La alerta se apaga al aceptar o rechazar.
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "0.85fr 1.15fr",
                gap: 12,
                marginTop: 16,
              }}
            >
              <IonButton
                expand="block"
                color="danger"
                onClick={() => dismissAvailableRide(ride)}
                style={
                  {
                    "--border-radius": "17px",
                    height: "54px",
                    fontWeight: 950,
                  } as CSSProperties
                }
              >
                Rechazar
              </IonButton>

              <IonButton
                expand="block"
                color="warning"
                disabled={
                  acceptingId === ride.id ||
                  !driverLocation ||
                  !isDriverAvailable
                }
                onClick={() => void handleAcceptRide(ride.id)}
                style={
                  {
                    "--border-radius": "17px",
                    height: "54px",
                    "--color": "var(--rp-btn-primary-fg)",
                    fontWeight: 950,
                  } as CSSProperties
                }
              >
                {acceptingId === ride.id ? (
                  <IonSpinner name="dots" />
                ) : driverLocation ? (
                  activeRide ? "Aceptar próximo" : "Aceptar viaje"
                ) : (
                  "Activa GPS"
                )}
              </IonButton>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function ScheduledReservationCard({
    ride,
  }: {
    ride: DriverScheduledReservationOffer;
  }): JSX.Element {
    const fareClp = getRideDisplayFareClp(ride as RideWithFarePayload);
    const paymentLabel = getRidePaymentMethodLabel(String(ride.notes ?? ""));
    const paymentIcon = getRidePaymentIcon(String(ride.notes ?? ""));
    const rideVehicleCategory = getRideVehicleCategory(ride as RideWithFarePayload);
    const rideVehicleLabel = getRideVehicleLabel(rideVehicleCategory);
    const rideVehicleEmoji = getRideVehicleEmoji(rideVehicleCategory);
    const scheduledText = getDriverScheduledReservationDateText(ride);
    const activationText = formatDriverScheduledReservationDate(
      ride.scheduleActivationAt ?? ride.driverVisibleAt ?? ride.autoAssignAt,
    );
    const assignedToThisDriver = driverScheduledReservationMatchesDriver(ride, session?.user);

    return (
      <IonCard
        className="rapago-driver-card"
        style={{
          margin: "0",
          borderRadius: "24px",
          overflow: "hidden",
          background: "var(--rp-surface)",
          color: "var(--rp-text)",
          border: "var(--rp-border-w) solid var(--rp-border-c)",
          boxShadow: "var(--rp-shadow)",
        }}
      >
        <IonCardContent style={{ padding: 0 }}>
          <div
            style={{
              padding: "15px 16px",
              background: "var(--rp-surface-soft)",
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "flex-start",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "6px 10px",
                  borderRadius: 999,
                  background: "var(--rp-warn-bg)",
                  border: "1px solid var(--rp-warn-bd)",
                  color: "var(--rp-warn-fg)",
                  fontSize: ".68rem",
                  fontWeight: 950,
                  textTransform: "uppercase",
                  letterSpacing: ".05em",
                  marginBottom: 10,
                }}
              >
                <IonIcon icon={calendarOutline} aria-hidden="true" style={{ fontSize: "1em" }} />Viaje agendado asignado
              </div>

              <div style={{ fontWeight: 950, fontSize: "1.12rem", lineHeight: 1.15 }}>
                {getDriverRideRouteDisplayLabel(ride)}
              </div>
              <div
                style={{
                  marginTop: 6,
                  color: "var(--rp-muted)",
                  fontSize: ".78rem",
                  fontWeight: 800,
                  lineHeight: 1.35,
                }}
              >
                "Tenemos agendado tu viaje. La reserva queda congelada aquí y solo sonará cuando corresponda ir a buscar al usuario."
              </div>
            </div>

            <div
              style={{
                minWidth: 88,
                padding: "9px 10px",
                borderRadius: 18,
                background: "var(--rp-surface-soft)",
                color: "var(--rp-text)",
                textAlign: "right",
                fontWeight: 950,
                boxShadow: "0 10px 26px rgba(0,0,0,.25)",
              }}
            >
              <div style={{ fontSize: ".64rem", color: "var(--rp-label)", textTransform: "uppercase" }}>
                Tarifa
              </div>
              <div style={{ fontSize: "1rem", marginTop: 1 }}>{formatClp(fareClp)}</div>
            </div>
          </div>

          <div style={{ padding: "15px 16px 16px" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  borderRadius: 18,
                  background: "var(--rp-surface-soft)",
                  border: "var(--rp-border-w) solid var(--rp-border-c)",
                  padding: "11px 12px",
                }}
              >
                <div style={{ color: "var(--rp-label)", fontSize: ".68rem", fontWeight: 950 }}>
                  RECOGIDA
                </div>
                <div style={{ marginTop: 4, fontWeight: 950, lineHeight: 1.25 }}>{scheduledText}</div>
              </div>

              <div
                style={{
                  borderRadius: 18,
                  background: "var(--rp-surface-soft)",
                  border: "var(--rp-border-w) solid var(--rp-border-c)",
                  padding: "11px 12px",
                }}
              >
                <div style={{ color: "var(--rp-label)", fontSize: ".68rem", fontWeight: 950 }}>
                  SE ABRE A CONDUCTORES
                </div>
                <div style={{ marginTop: 4, fontWeight: 950, lineHeight: 1.25 }}>{activationText}</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 13 }}>
              <IonChip color="warning" style={{ fontWeight: 950 }}>
                Reserva
              </IonChip>
              <IonChip color="success" style={{ fontWeight: 950 }}>
                {rideVehicleEmoji} {rideVehicleLabel}
              </IonChip>
              <IonChip color="medium" style={{ fontWeight: 950 }}>
                {paymentIcon} {paymentLabel}
              </IonChip>
            </div>

            <DriverFastSearchBadge ride={ride as unknown as RideWithFarePayload & Record<string, unknown>} compact />
          <PassengerRideNoteCard ride={ride} compact />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "0.88fr 1.12fr",
                gap: 10,
              }}
            >
              <IonButton
                expand="block"
                fill="outline"
                color="light"
                disabled={acceptingId === String(ride.id)}
                style={
                  {
                    "--border-radius": "16px",
                    "--border-color": "var(--rp-border-c)",
                    height: "50px",
                    fontWeight: 950,
                  } as CSSProperties
                }
                onClick={() => setPendingReservationReject(ride)}
              >
                Rechazar
              </IonButton>

              <IonButton
                expand="block"
                color="warning"
                disabled={acceptingId === String(ride.id) || !isDriverAvailable}
                style={{ "--border-radius": "16px", height: "50px", fontWeight: 950 } as CSSProperties}
                onClick={() => void handleAcceptScheduledReservation(ride)}
              >
                {acceptingId === String(ride.id) ? (
                  <IonSpinner name="dots" />
                ) : isDriverAvailable ? (
                  "Aceptar reserva"
                ) : (
                  "Activa disponible"
                )}
              </IonButton>
            </div>
          </div>
        </IonCardContent>
      </IonCard>
    );
  }

  function ConfirmedScheduledReservationCard({
    ride,
  }: {
    ride: DriverScheduledReservationOffer;
  }): JSX.Element {
    const fareClp = getRideDisplayFareClp(ride as RideWithFarePayload);
    const scheduledText = getDriverScheduledReservationDateText(ride);
    const activationText = formatDriverScheduledReservationDate(
      ride.scheduleActivationAt ?? ride.driverVisibleAt ?? ride.autoAssignAt,
    );
    const readyToStart = driverScheduledReservationIsActiveNow(ride as unknown as DriverAcceptedRideBridgeRecord);
    const countdownText = getScheduledReservationCountdownText(ride as unknown as DriverAcceptedRideBridgeRecord);

    return (
      <IonCard
        className="rapago-driver-card"
        style={{
          margin: "0",
          borderRadius: "22px",
          background: "var(--rp-surface)",
          color: "var(--rp-text)",
          border: "var(--rp-border-w) solid var(--rp-border-c)",
          boxShadow: "var(--rp-shadow)",
        }}
      >
        <IonCardContent style={{ padding: "15px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
            <div style={{ minWidth: 0 }}>
              <IonBadge color="success" style={{ marginBottom: 8, fontWeight: 950 }}>
                Reserva aceptada
              </IonBadge>
              <div style={{ fontWeight: 950, fontSize: "1.05rem", lineHeight: 1.18 }}>
                {getDriverRideRouteDisplayLabel(ride)}
              </div>
              <div style={{ marginTop: 7, fontSize: ".82rem", fontWeight: 850, color: "var(--rp-muted)", lineHeight: 1.35 }}>
                Ya aceptaste esta reserva. Espera la hora indicada: te llegará una notificación para iniciar el viaje y se abrirá la ruta.
              </div>
            </div>
            <div style={{ minWidth: 82, textAlign: "right", fontWeight: 950 }}>
              <div style={{ color: "var(--rp-label)", fontSize: ".66rem", textTransform: "uppercase" }}>Tarifa</div>
              <div style={{ fontSize: "1rem" }}>{formatClp(fareClp)}</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 13 }}>
            <div style={{ borderRadius: 16, background: "var(--rp-surface-soft)", padding: "10px 11px" }}>
              <div style={{ fontSize: ".66rem", color: "var(--rp-label)", fontWeight: 950 }}>RECOGIDA</div>
              <div style={{ marginTop: 3, fontWeight: 950 }}>{scheduledText}</div>
            </div>
            <div style={{ borderRadius: 16, background: "var(--rp-surface-soft)", padding: "10px 11px" }}>
              <div style={{ fontSize: ".66rem", color: "var(--rp-label)", fontWeight: 950 }}>AVISO PARA SALIR</div>
              <div style={{ marginTop: 3, fontWeight: 950 }}>{activationText}</div>
            </div>
          </div>

          <DriverFastSearchBadge ride={ride as unknown as RideWithFarePayload & Record<string, unknown>} compact />
          <PassengerRideNoteCard ride={ride} compact />

          {readyToStart ? (
            <div style={{ marginTop: 12 }}>
              <div style={{ marginBottom: 10, borderRadius: 16, background: "var(--rp-ok-bg)", border: "1px solid var(--rp-ok-bd)", padding: "10px 12px", fontWeight: 950, fontSize: ".82rem", lineHeight: 1.35, color: "var(--rp-ok-fg)" }}>
                <IonIcon icon={checkmarkCircleOutline} aria-hidden="true" style={{ fontSize: "1em", verticalAlign: "-0.125em" }} /> Reserva lista. Ya puedes iniciar la ruta hacia el pasajero.
              </div>
              <IonButton
                expand="block"
                color="warning"
                disabled={acceptingId === String(ride.id) || !isDriverAvailable}
                onClick={() => void handleStartReadyScheduledReservation(ride)}
                style={{ "--border-radius": "16px", height: "50px", fontWeight: 950, color: "var(--rp-btn-primary-fg)" } as CSSProperties}
              >
                {acceptingId === String(ride.id) ? <IonSpinner name="dots" /> : "Iniciar viaje ahora"}
              </IonButton>
            </div>
          ) : (
            <div style={{ marginTop: 12, borderRadius: 16, background: "var(--rp-ok-bg)", border: "1px solid var(--rp-ok-bd)", padding: "10px 12px", fontWeight: 900, fontSize: ".80rem", lineHeight: 1.35 }}>
              ⏱ {countdownText}. Cuando llegue el momento, te avisaremos: “Tenemos agendado tu viaje, ve a buscar al usuario”.
            </div>
          )}
        </IonCardContent>
      </IonCard>
    );
  }

  function AvailableRideCard({
    ride,
  }: {
    ride: AvailableRideData;
  }): JSX.Element {
    const nav = extractRideNavigationPoints(ride.notes);
    const styles = getRequestCardStyles();
    const displayFareClp = getRideDisplayFareClp(ride as RideWithFarePayload);
    const paymentLabel = getRidePaymentMethodLabel(ride.notes);
    const paymentIcon = getRidePaymentIcon(ride.notes);
    const rideVehicleCategory = getRideVehicleCategory(
      ride as RideWithFarePayload,
    );
    const rideVehicleLabel = getRideVehicleLabel(rideVehicleCategory);
    const rideVehicleShortLabel = getRideVehicleShortLabel(rideVehicleCategory);
    const rideVehicleEmoji = getRideVehicleEmoji(rideVehicleCategory);
    const tripTypeLabel = getRideTripTypeLabel(ride.notes);
    const tripTypeEmoji = getRideTripTypeEmoji(ride.notes);
    const driverEarningClp = getDriverEstimatedEarning(displayFareClp);

    const pickupWalkText =
      nav.pickupWalkMeters != null && nav.pickupWalkMeters > 8
        ? `Pasajero caminando ${Math.round(nav.pickupWalkMeters)} m`
        : "Punto de recogida confirmado";

    return (
      <IonCard className="rapago-driver-card" style={styles.card}>
        <div style={styles.darkLayer} />

        <IonCardContent
          style={{ position: "relative", zIndex: 1, padding: "16px" }}
        >
          {/* Encabezado */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 12,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 11px",
                  borderRadius: "999px",
                  background: "var(--rp-ok-bg)",
                  border: "1px solid var(--rp-ok-bd)",
                  color: "var(--rp-ok-fg)",
                  fontSize: ".72rem",
                  fontWeight: 950,
                  marginBottom: 10,
                  textTransform: "uppercase",
                  letterSpacing: ".45px",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: "var(--rp-ok-fg)",
                    boxShadow: "0 0 18px rgba(34,197,94,.9)",
                  }}
                />
                Nuevo viaje
              </div>

              <div
                style={{
                  fontWeight: 950,
                  fontSize: "1.22rem",
                  lineHeight: 1.08,
                  color: "var(--rp-text)",
                }}
              >
                Solicitud cercana
              </div>
              <div
                style={{
                  marginTop: 5,
                  color: "var(--rp-muted)",
                  fontSize: ".78rem",
                  lineHeight: 1.35,
                }}
              >
                Revisa origen, destino y pago antes de aceptar.
              </div>
            </div>

            <span
              style={{
                flexShrink: 0,
                borderRadius: 999,
                padding: "7px 10px",
                border: "1px solid var(--rp-ok-bd)",
                background: "var(--rp-ok-bg)",
                color: "var(--rp-ok-fg)",
                fontSize: ".68rem",
                fontWeight: 950,
              }}
            >
              PENDIENTE
            </span>
          </div>

          {/* Chips */}
          <div
            style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}
          >
            <div style={styles.pill}>
              <IonIcon
                icon={timeOutline}
                aria-hidden="true"
                style={{ fontSize: 15, color: "var(--rp-accent)" }}
              />
              Ahora
            </div>
            <div style={styles.pill}>
              <IonIcon
                icon={carOutline}
                aria-hidden="true"
                style={{ fontSize: 15, color: "var(--rp-ok-fg)" }}
              />
              {rideVehicleEmoji} {rideVehicleShortLabel}
            </div>
            <div style={styles.pill}>
              {tripTypeEmoji} {tripTypeLabel}
            </div>
            <div style={styles.pill}>
              <IonIcon
                icon={paymentLabel === "Mercado Pago" ? cardOutline : cashOutline}
                aria-hidden="true"
                style={{
                  fontSize: 15,
                  color: paymentLabel === "Mercado Pago" ? "var(--rp-info-fg)" : "var(--rp-ok-fg)",
                }}
              />
              {paymentIcon} {paymentLabel}
            </div>
            <div style={styles.pill}>
              <IonIcon
                icon={starOutline}
                aria-hidden="true"
                style={{ fontSize: 15, color: "var(--rp-accent)" }}
              />
              Verificado
            </div>
          </div>

          {/* Ruta clara */}
          <div style={styles.routeBox}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "24px 1fr",
                gap: "10px",
                alignItems: "start",
              }}
            >
              <div style={{ ...styles.routeDot, background: "var(--rp-ok-fg)" }} />
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    color: "var(--rp-ok-fg)",
                    fontSize: ".72rem",
                    fontWeight: 950,
                    letterSpacing: ".35px",
                  }}
                >
                  RECOGER EN
                </div>
                <div
                  style={{
                    fontWeight: 950,
                    fontSize: "1.02rem",
                    marginTop: 3,
                    lineHeight: 1.25,
                    color: "var(--rp-text)",
                  }}
                >
                  {getDriverRidePointDisplayLabel(ride, "origin")}
                </div>
                <div
                  style={{
                    color: "var(--rp-muted)",
                    fontSize: ".78rem",
                    marginTop: 5,
                    lineHeight: 1.35,
                  }}
                >
                  <IonIcon
                    icon={walkOutline}
                    aria-hidden="true"
                    style={{
                      fontSize: 14,
                      marginRight: 4,
                      verticalAlign: "-2px",
                      color: "var(--rp-accent)",
                    }}
                  />
                  {pickupWalkText}
                </div>
              </div>

              <div
                style={{
                  width: 2,
                  height: 34,
                  background: "linear-gradient(180deg, var(--rp-ok-fg), var(--rp-err-fg))",
                  marginLeft: 6,
                  borderRadius: 999,
                }}
              />
              <div />

              <div style={{ ...styles.routeDot, background: "var(--rp-err-fg)" }} />
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    color: "var(--rp-err-fg)",
                    fontSize: ".72rem",
                    fontWeight: 950,
                    letterSpacing: ".35px",
                  }}
                >
                  DESTINO
                </div>
                <div
                  style={{
                    fontWeight: 950,
                    fontSize: "1.02rem",
                    marginTop: 3,
                    lineHeight: 1.25,
                    color: "var(--rp-text)",
                  }}
                >
                  {getDriverRidePointDisplayLabel(ride, "destination")}
                </div>
              </div>
            </div>
          </div>

          <DriverFastSearchBadge ride={ride as unknown as RideWithFarePayload & Record<string, unknown>} />
            <PassengerRideNoteCard ride={ride} />

          {/* Resumen precio */}
          <div
            style={{
              marginTop: 14,
              padding: "14px 15px",
              borderRadius: "20px",
              background: "var(--rp-ok-bg)",
              border: "1px solid var(--rp-ok-bd)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div>
              <div
                style={{
                  color: "var(--rp-muted)",
                  fontSize: ".72rem",
                  fontWeight: 900,
                }}
              >
                PRECIO DEL VIAJE
              </div>
              <div
                style={{
                  color: "var(--rp-ok-fg)",
                  fontWeight: 950,
                  fontSize: "1.48rem",
                  lineHeight: 1.05,
                  marginTop: 4,
                }}
              >
                {formatClp(displayFareClp)}
              </div>
              <div
                style={{
                  color: "var(--rp-muted)",
                  fontSize: ".74rem",
                  marginTop: 4,
                  fontWeight: 800,
                }}
              >
                {paymentIcon} Método de pago: {paymentLabel}
              </div>
              <div
                style={{
                  color: "var(--rp-muted)",
                  fontSize: ".74rem",
                  marginTop: 3,
                  fontWeight: 900,
                }}
              >
                {rideVehicleEmoji} Vehículo: {rideVehicleLabel}
              </div>
              <div
                style={{
                  color: "var(--rp-muted)",
                  fontSize: ".74rem",
                  marginTop: 3,
                  fontWeight: 900,
                }}
              >
                {tripTypeEmoji} Tipo de viaje: {tripTypeLabel}
              </div>
              {driverEarningClp != null && (
                <div
                  style={{
                    color: "var(--rp-muted)",
                    fontSize: ".72rem",
                    marginTop: 3,
                  }}
                >
                  Tu ganancia aprox.: {formatClp(driverEarningClp)}
                </div>
              )}
            </div>

            <div
              style={{
                width: 50,
                height: 50,
                borderRadius: "17px",
                background: "var(--rp-ok-bg)",
                border: "1px solid var(--rp-ok-bd)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--rp-ok-fg)",
                fontWeight: 950,
                fontSize: "1.22rem",
                flexShrink: 0,
              }}
            >
              $
            </div>
          </div>

          {/* Acciones */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "0.86fr 1.14fr",
              gap: 12,
              marginTop: 16,
            }}
          >
            <IonButton
              expand="block"
              fill="solid"
              style={styles.secondaryButton}
              onClick={() => dismissAvailableRide(ride)}
            >
              Rechazar
            </IonButton>

            <IonButton
              expand="block"
              disabled={
                acceptingId === ride.id ||
                !driverLocation ||
                !isDriverAvailable
              }
              style={styles.primaryButton}
              onClick={() => void handleAcceptRide(ride.id)}
            >
              {acceptingId === ride.id ? (
                <IonSpinner name="dots" />
              ) : !isDriverAvailable ? (
                "No disponible"
              ) : driverLocation ? (
                activeRide ? "Aceptar próximo" : "Aceptar viaje"
              ) : (
                "Activa GPS"
              )}
            </IonButton>
          </div>
        </IonCardContent>
      </IonCard>
    );
  }

  function handleReportDriverAccidentFromHome(ride: DriverRideData): void {
    saveDriverAccidentTripSafetyReport(ride, session?.user);
    openDriverAccidentWhatsApp(ride, session?.user);
    setError("Reporte de accidente guardado. Se abrió WhatsApp soporte.");
  }

  function ActiveRideScreen({ ride }: { ride: DriverRideData }): JSX.Element {
    const nextOfferWhileActive = !nextQueuedRide
      ? availableRides.find(
          (item) =>
            item.status === "requested" &&
            item.id !== ride.id &&
            !driverRideRequestIsHandled(item as unknown as Record<string, unknown>, session?.user),
        ) ?? null
      : null;
    const statusText =
      ride.status === "driver_arrived"
        ? "Esperando pasajero"
        : ride.status === "in_progress"
          ? "Navegando al destino"
          : "Navegando al punto de recogida";

    // El mapa debe quedar visible: los botones de acción van debajo, no
    // encima del mapa. Antes el alto del mapa se adivinaba en JS
    // (`window.innerHeight - 280`), sin restar la barra de pestañas
    // flotante (global.css: ion-tab-bar, position:fixed, 66px + safe-area).
    // En un iPhone real ese cálculo dejaba "Llegué al punto / Cancelar" por
    // debajo de la tab bar, cortados e intocables. Ahora el mapa es un ítem
    // flex que SE ENCOGE (flex:1 1 auto) para ceder todo el espacio que el
    // panel de abajo necesite — el panel nunca pierde espacio, es el mapa el
    // que se ajusta, no al revés.
    // Sin hooks a partir de aquí: esta función se INVOCA, no se monta como
    // componente (ver el comentario del reloj de No show en el cuerpo de la
    // página). Añadir un hook aquí volvería a romper el mapa.
    const driverNoShowState = getDriverNoShowState(
      ride as DriverRideData & Record<string, unknown>,
      activeRideNoShowNowMs,
    );

    // Par de acciones principales del estado actual. Van dentro de la hoja del
    // mapa (prop sheetActions) y NO se repiten en el panel de abajo: ahí sólo
    // quedan las acciones secundarias (No show, emergencia) y los avisos.
    const sheetPrimaryLabel =
      ride.status === "driver_arrived"
        ? "Iniciar viaje"
        : ride.status === "in_progress"
          ? "Finalizar viaje"
          : "Llegué al punto";

    const runSheetPrimary = () => {
      if (ride.status === "driver_arrived") {
        void handleStartRide(ride.id);
        return;
      }

      if (ride.status === "in_progress") {
        requestCompleteRide(ride);
        return;
      }

      void handleArrivedSmart(ride);
    };

    /* Icono de la acción: refuerza el significado antes de leer. Bandera al
       llegar a un punto, coche al arrancar, meta al terminar. */
    const sheetPrimaryIcon =
      ride.status === "driver_arrived"
        ? carOutline
        : ride.status === "in_progress"
          ? checkmarkCircleOutline
          : flagOutline;

    /* La acción principal ("Llegué al punto" / "Iniciar viaje" / "Finalizar
       viaje") se movió a la cabecera de la hoja (sheetHeader, más abajo),
       igual que el atajo "Confirmar" del pasajero: fija en la esquina
       superior derecha del panel, visible aunque el resto de la hoja se
       desplace o quede plegada al mínimo. Aquí sólo queda Cancelar. */
    const sheetActions = (
      <div className="rapago-driver-sheet-actions rapago-driver-sheet-actions--single">
        <IonButton
          expand="block"
          fill="outline"
          className="rapago-driver-sheet-actions__cancel"
          aria-label="Cancelar el viaje"
          onClick={() => requestCancelActiveRide(ride)}
        >
          <IonIcon icon={closeOutline} slot="start" aria-hidden="true" />
          Cancelar
        </IonButton>
      </div>
    );

    /* Estado del viaje. Antes era un disco verde de 46px con un check dentro
       (que no decía de qué estaba "ok") más dos líneas de texto, dentro de un
       panel aparte. Aquí es una línea: punto semántico + estado + dirección.
       El aria-live se conserva tal cual: statusText sólo cambia en transiciones
       reales del viaje, nunca por tick de GPS, así que `atomic` da el anuncio
       completo sin generar ruido. */
    const sheetStatusTone =
      ride.status === "driver_arrived"
        ? "waiting"
        : ride.status === "in_progress"
          ? "riding"
          : "enroute";

    /* Icono por estado, no un check genérico: el conductor distingue la fase
       del viaje por la forma antes que por el texto. Misma rejilla que
       .request-map-walk del pasajero (columna de icono + texto + dato). */
    const sheetStatusIcon =
      ride.status === "driver_arrived"
        ? walkOutline
        : ride.status === "in_progress"
          ? carOutline
          : navigateOutline;

    const sheetHeader = (
      <div
        className={`rapago-driver-sheet-status rapago-driver-sheet-status--${sheetStatusTone}`}
        aria-live="polite"
        aria-atomic="true"
      >
        <span className="rapago-driver-sheet-status__icon" aria-hidden="true">
          <IonIcon icon={sheetStatusIcon} />
        </span>

        <span className="rapago-driver-sheet-status__text">
          <strong>{statusText}</strong>
          <small>
            {ride.status === "in_progress"
              ? getDriverRidePointDisplayLabel(ride, "destination")
              : getDriverRidePointDisplayLabel(ride, "origin")}
          </small>
        </span>
      </div>
    );

    /* Acción principal ("Llegué al punto" / "Iniciar viaje" / "Finalizar
       viaje"), en la esquina superior derecha de la hoja completa —junto al
       asa de arrastre, no dentro de la tarjeta de estado—, igual que el atajo
       "Confirmar" del pasajero (rp-request-map-head-confirm). Se pasa como
       prop aparte (sheetPrimaryAction) porque UberDriverNavigationMap es quien
       controla esa zona absoluta de la hoja. */
    const sheetPrimaryAction = (
      <button
        type="button"
        className="rapago-driver-nav-sheet__confirm"
        // El texto visible puede recortarse con ellipsis en pantallas
        // angostas; aria-label conserva siempre la etiqueta completa.
        aria-label={sheetPrimaryLabel}
        onClick={runSheetPrimary}
      >
        <IonIcon icon={sheetPrimaryIcon} aria-hidden="true" />
        <span>{sheetPrimaryLabel}</span>
      </button>
    );

    /* Cuerpo de la hoja: avisos y acciones secundarias. Todo lo que antes vivía
       en el panel oscuro y ahora se pinta con tokens --rp-*, porque el fondo
       pasó a ser var(--rp-surface) —claro en modo día—: los colores fijos que
       traía (#fff7cc, #dbeafe, #bbf7d0, rgba(255,255,255,.16)) eran texto claro
       sobre fondo claro, es decir invisibles. */
    const sheetBody = (
      <>
        {nextQueuedRide && (
          <div className="rapago-driver-sheet-note rapago-driver-sheet-note--queued">
            <span className="rapago-driver-sheet-note__icon" aria-hidden="true">
              <IonIcon icon={timeOutline} />
            </span>
            <div className="rapago-driver-sheet-note__text">
              <strong>Próximo servicio aceptado</strong>
              <span>{getDriverRideRouteDisplayLabel(nextQueuedRide)}</span>
              <small>Se activará cuando confirmes que llegaste al destino actual.</small>
            </div>
          </div>
        )}

        {!nextQueuedRide && nextOfferWhileActive && (
          <div className="rapago-driver-sheet-note rapago-driver-sheet-note--offer">
            <span className="rapago-driver-sheet-note__icon" aria-hidden="true">
              <IonIcon icon={flashOutline} />
            </span>
            <div className="rapago-driver-sheet-note__text">
              <strong>Nuevo servicio para continuar</strong>
              <span>{getDriverRideRouteDisplayLabel(nextOfferWhileActive)}</span>

              <div className="rapago-driver-sheet-note__actions">
                <IonButton
                  size="small"
                  fill="outline"
                  className="rapago-driver-sheet-ghost"
                  disabled={acceptingId === nextOfferWhileActive.id}
                  onClick={() => dismissAvailableRide(nextOfferWhileActive)}
                >
                  <IonIcon icon={closeOutline} slot="start" aria-hidden="true" />
                  Rechazar
                </IonButton>
                <IonButton
                  size="small"
                  className="rapago-driver-sheet-actions__primary"
                  disabled={acceptingId === nextOfferWhileActive.id || !driverLocation}
                  onClick={() => void handleAcceptRide(nextOfferWhileActive.id)}
                >
                  {acceptingId === nextOfferWhileActive.id ? (
                    <IonSpinner name="dots" />
                  ) : (
                    <>
                      <IonIcon icon={checkmarkCircleOutline} slot="start" aria-hidden="true" />
                      Aceptar
                    </>
                  )}
                </IonButton>
              </div>
            </div>
          </div>
        )}

        {ride.status === "driver_arrived" && (
          /* El botón ES la barra de progreso: su relleno avanza con la espera y
             al completarse cambia de etiqueta y se habilita. Antes esto eran
             cuatro elementos (título, contador, barra de 8px y leyenda) más una
             cinta que pulsaba infinitamente ignorando prefers-reduced-motion,
             para comunicar un dato que cabe en el propio botón. */
          <IonButton
            expand="block"
            className="rapago-driver-noshow"
            disabled={!driverNoShowState.allowed}
            style={
              {
                "--rp-noshow-progress": `${getDriverNoShowProgressPercent(driverNoShowState)}%`,
              } as CSSProperties
            }
            onClick={() => void handleDriverNoShowRide(ride)}
          >
            <IonIcon
              icon={driverNoShowState.allowed ? flagOutline : timeOutline}
              slot="start"
              aria-hidden="true"
            />
            {driverNoShowState.allowed
              ? `No show · Cargo ${formatClp(driverNoShowState.feeClp)}`
              : `No show disponible en ${formatDriverNoShowRemaining(driverNoShowState.remainingMs)}`}
          </IonButton>
        )}
      </>
    );

    return (
      <div className="rapago-driver-active-ride">
        {/* Identidad de marca SIN coste de mapa: la píldora es absoluta, el mapa
            pasa por debajo. Y como esta pantalla ya no lleva IonHeader en el
            flujo, el mapa GANA los 103px que ocupaba la cabecera verde.
            Sin campana (una notificación no debe robarle la vista a quien
            conduce) y sin acción (durante un viaje no hay nada que refrescar). */}
        <RapagoAppBar
          sectionId="driver-requests"
          variant="overlay"
          title="Viaje activo"
        />
        <UberDriverNavigationMap
          ride={ride}
          height="100%"
          driverUser={session?.user}
          sheetHeader={sheetHeader}
          sheetBody={sheetBody}
          sheetActions={sheetActions}
          sheetPrimaryAction={sheetPrimaryAction}
        />

        {/* SOS. Fuera de la hoja a propósito: es el único control que debe
            seguir alcanzable con la hoja plegada del todo. Además antes sólo
            existía en driver_arrived e in_progress — es decir, faltaba
            justamente en driver_en_route, el estado en que el conductor va en
            movimiento y más riesgo corre. Ahora está en los tres. */}
        <button
          type="button"
          className="rapago-driver-sos"
          onClick={() => setDriverSosOpen(true)}
          aria-label="Emergencia y reporte de accidente"
        >
          <IonIcon icon={alertCircleOutline} aria-hidden="true" />
          <span>SOS</span>
        </button>
      </div>
    );
  }

  return (
    <IonPage className="rapago-driver-page" data-rapago-theme={theme}>
      {/* Durante un viaje activo NO hay barra en el flujo: la identidad la
          pone la píldora flotante de ActiveRideScreen, que no le quita un solo
          píxel al mapa. Fuera del viaje, barra estándar con su acción propia.

          El subtoolbar de degradado inline que había aquí desapareció: su texto
          ("Viajes disponibles" + el estado de disponibilidad) es CONTENIDO, no
          cromo, así que baja al principio de la lista. Ganancia: 66px. */}
      {!showActiveRideOnly && (
        <RapagoAppBar
          sectionId="driver-requests"
          title={showOnlyReservations ? "Reservas" : "Solicitudes"}
          actionIcon={refreshOutline}
          actionLabel="Actualizar solicitudes"
          actionLoading={loading}
          onAction={() => void loadRides()}
        />
      )}
      {showActiveRideOnly && !activeRide && (
        <RapagoAppBar
          sectionId="driver-requests"
          title="Viaje activo"
          actionIcon={refreshOutline}
          actionLabel="Actualizar viaje"
          actionLoading={loading}
          onAction={() => void loadRides()}
        />
      )}

      <IonContent
        className={showActiveRideOnly && activeRide ? "" : "ion-padding"}
        style={
          {
            "--background": "transparent",
          } as CSSProperties
        }
      >
        {showActiveRideOnly && activeRide ? (
          // Llamada, no <ActiveRideScreen/>: como se declara en el cuerpo de
          // esta página, su identidad de función cambia en cada render y React
          // remontaría todo el subárbol —recreando el mapa de Google entero— en
          // cada ciclo. Invocada, su salida se integra en este mismo árbol y el
          // mapa conserva su instancia.
          ActiveRideScreen({ ride: activeRide })
        ) : showActiveRideOnly ? (
          <div
            style={{
              minHeight: "55vh",
              display: "grid",
              placeItems: "center",
              textAlign: "center",
              padding: 24,
            }}
          >
            <div>
              {loading ? (
                <IonSpinner name="crescent" />
              ) : (
                <>
                  <IonIcon
                    icon={carOutline}
                    style={{ fontSize: 44, color: "var(--rp-accent)" }}
                  />
                  <h2 style={{ margin: "12px 0 6px" }}>No hay un viaje activo</h2>
                  <p style={{ margin: 0, color: "var(--rp-muted)" }}>
                    Cuando aceptes una solicitud, el mapa grande se abrirá aquí.
                  </p>
                </>
              )}
            </div>
          </div>
        ) : (
          <>
            <IonRefresher
              slot="fixed"
              onIonRefresh={(event) => {
                void loadRides().then(() => event.detail.complete());
              }}
            >
              <IonRefresherContent />
            </IonRefresher>

            <RapaGoConnectivityBanner
              role="driver"
              status={driverConnection.status}
            />

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

            {error && (
              <IonText color="danger">
                <p style={{ fontWeight: 900 }}>{error}</p>
              </IonText>
            )}

            {locationError && (
              <IonCard
                className="rapago-driver-card driver-location-error-card"
                style={{
                  margin: "0 0 14px",
                  borderRadius: "18px",
                  background: "var(--rp-surface)",
                  color: "var(--rp-text)",
                  border: "var(--rp-border-w) solid var(--rp-border-c)",
                }}
              >
                <IonCardContent
                  style={{
                    padding: "12px 14px",
                    fontWeight: 900,
                    fontSize: ".82rem",
                  }}
                >
                  <IonIcon icon={locationOutline} aria-hidden="true" style={{ fontSize: "1em", verticalAlign: "-0.125em" }} /> {locationError}
                </IonCardContent>
              </IonCard>
            )}

            {!loading && !showOnlyReservations && !isDriverAvailable && displayedAvailableRides.length === 0 && (
              <IonCard
                className="rapago-driver-card"
                style={{
                  margin: "10px 0 14px",
                  borderRadius: "22px",
                  background: "var(--rp-surface)",
                  color: "var(--rp-text)",
                  border: "var(--rp-border-w) solid var(--rp-border-c)",
                  boxShadow: "var(--rp-shadow)",
                }}
              >
                <IonCardContent
                  style={{ padding: "18px", textAlign: "center" }}
                >
                  <div style={{ fontSize: "1.05rem", fontWeight: 950 }}>
                    Estás no disponible
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: ".82rem",
                      fontWeight: 750,
                      opacity: 0.84,
                      lineHeight: 1.4,
                    }}
                  >
                    No te aparecerán solicitudes de viaje hasta que cambies tu
                    estado a disponible desde el inicio del conductor.
                  </div>
                </IonCardContent>
              </IonCard>
            )}

            {!loading && showOnlyReservations && reservationsTotal === 0 && (
              <div style={{ textAlign: "center", paddingTop: 40 }}>
                <IonText color="medium">
                  <p>No tienes reservas asignadas por ahora.</p>
                </IonText>
              </div>
            )}

            {!loading && !showOnlyReservations && isDriverAvailable && displayedAvailableRides.length === 0 && (
              <div style={{ textAlign: "center", paddingTop: 40 }}>
                <IonText color="medium">
                  <p>No hay solicitudes disponibles.</p>
                </IonText>
              </div>
            )}

            {!loading && showOnlyReservations && reservationOffers.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  paddingBottom: displayedAvailableRides.length > 0 || confirmedReservationOffers.length > 0 ? 16 : 90,
                  maxWidth: 520,
                  margin: "0 auto 16px",
                }}
              >
                <div
                  style={{
                    color: "var(--rp-text)",
                    fontWeight: 950,
                    fontSize: "1rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <span>Reservas asignadas</span>
                  <IonBadge color="warning">{reservationOffers.length}</IonBadge>
                </div>
                {reservationOffers.map((ride) => (
                  <ScheduledReservationCard key={String(ride.id)} ride={ride} />
                ))}
              </div>
            )}

            {!loading && showOnlyReservations && confirmedReservationOffers.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  paddingBottom: displayedAvailableRides.length > 0 ? 16 : 90,
                  maxWidth: 520,
                  margin: "0 auto 16px",
                }}
              >
                <div
                  style={{
                    color: "var(--rp-text)",
                    fontWeight: 950,
                    fontSize: "1rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <span>Reservas aceptadas</span>
                  <IonBadge color="success">{confirmedReservationOffers.length}</IonBadge>
                </div>
                {confirmedReservationOffers.map((ride) => (
                  <ConfirmedScheduledReservationCard key={String(ride.id)} ride={ride} />
                ))}
              </div>
            )}

            {!loading && !showOnlyReservations && isDriverAvailable && displayedAvailableRides.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                  paddingBottom: "calc(90px + env(safe-area-inset-bottom, 0px))",
                  maxWidth: 520,
                  margin: "0 auto",
                }}
              >
                {displayedAvailableRides.map((ride) => (
                  <AvailableRideCard key={ride.id} ride={ride} />
                ))}
              </div>
            )}

            {scheduledReservationReadyAlert && isDriverAvailable && !activeRide && (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: "var(--rp-z-above-tabbar)",
                  background: "rgba(0,0,0,.58)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 16,
                }}
              >
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="rapago-driver-scheduled-ready-alert-title"
                  style={{
                    width: "min(430px, 100%)",
                    borderRadius: 22,
                    overflow: "hidden",
                    background: "var(--rp-surface)",
                    color: "var(--rp-text)",
                    boxShadow: "var(--rp-shadow)",
                    border: "var(--rp-border-w) solid var(--rp-border-c)",
                  }}
                >
                  <div
                    style={{
                      background: "linear-gradient(135deg,#2A1A18,#8F3F25)",
                      color: "#fff",
                      padding: "16px 18px",
                      display: "flex",
                      gap: 12,
                      alignItems: "center",
                    }}
                  >
                    <div
                      aria-hidden="true"
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: 999,
                        background: "rgba(210,164,58,.22)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "1.35rem",
                      }}
                    >
                      <IonIcon icon={calendarOutline} style={{ fontSize: "1em" }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div id="rapago-driver-scheduled-ready-alert-title" style={{ fontWeight: 950, fontSize: "1.08rem" }}>
                        Viaje agendado listo
                      </div>
                      <div style={{ marginTop: 2, fontSize: ".75rem", opacity: .9 }}>
                        Sonando por 0:{String(scheduledReservationAlertSecondsLeft).padStart(2, "0")} · ve a buscar al pasajero
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => stopScheduledReservationReadyAlert(true)}
                      style={{
                        border: 0,
                        background: "transparent",
                        color: "#fff",
                        fontSize: 22,
                        cursor: "pointer",
                      }}
                      aria-label="Cerrar alerta"
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  </div>

                  <div style={{ padding: 18 }}>
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                        marginBottom: 14,
                      }}
                    >
                      <span style={{ border: "var(--rp-border-w) solid var(--rp-border-c)", borderRadius: 999, padding: "7px 10px", fontWeight: 950, display: "inline-flex", alignItems: "center", gap: 6 }}><IonIcon icon={calendarOutline} aria-hidden="true" style={{ fontSize: "1em" }} />Reserva lista</span>
                      <span style={{ border: "1px solid var(--rp-ok-bd)", borderRadius: 999, padding: "7px 10px", fontWeight: 950, display: "inline-flex", alignItems: "center", gap: 6 }}><IonIcon icon={carOutline} aria-hidden="true" style={{ fontSize: "1em" }} />Estándar</span>
                      <span style={{ border: "var(--rp-border-w) solid var(--rp-border-c)", borderRadius: 999, padding: "7px 10px", fontWeight: 950, display: "inline-flex", alignItems: "center", gap: 6 }}><IonIcon icon={cashOutline} aria-hidden="true" style={{ fontSize: "1em" }} />Efectivo</span>
                    </div>

                    <div
                      style={{
                        background: "var(--rp-surface-soft)",
                        borderRadius: 18,
                        padding: 16,
                        marginBottom: 14,
                        boxShadow: "inset 0 0 0 1px rgba(0,0,0,.04)",
                      }}
                    >
                      <div style={{ color: "var(--rp-ok-fg)", fontSize: ".70rem", fontWeight: 950, textTransform: "uppercase" }}>
                        Ve a buscar al usuario
                      </div>
                      <div style={{ marginTop: 5, fontSize: "1rem", fontWeight: 950 }}>
                        {cleanPointDisplayName(scheduledReservationReadyAlert.originText, "Punto de recogida")}
                      </div>
                      <div style={{ width: 2, height: 28, background: "linear-gradient(var(--rp-ok-fg),var(--rp-err-fg))", margin: "10px 0 10px 10px" }} />
                      <div style={{ color: "var(--rp-err-fg)", fontSize: ".70rem", fontWeight: 950, textTransform: "uppercase" }}>
                        Destino del pasajero
                      </div>
                      <div style={{ marginTop: 5, fontSize: "1rem", fontWeight: 950 }}>
                        {cleanPointDisplayName(scheduledReservationReadyAlert.destinationText, "Destino")}
                      </div>
                    </div>

                    <div
                      style={{
                        background: "var(--rp-surface-soft)",
                        color: "var(--rp-text)",
                        borderRadius: 16,
                        padding: "13px 14px",
                        marginBottom: 14,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <div style={{ fontSize: ".72rem", fontWeight: 950, color: "var(--rp-label)" }}>
                        TARIFA RESERVADA
                      </div>
                      <div style={{ fontSize: "1.25rem", fontWeight: 950 }}>
                        {formatCLPDriver(getRideDisplayFareClp(scheduledReservationReadyAlert as RideWithFarePayload))}
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.15fr", gap: 10 }}>
                      <IonButton
                        expand="block"
                        color="medium"
                        onClick={() => stopScheduledReservationReadyAlert(true)}
                        style={{ "--border-radius": "14px", fontWeight: 950 } as CSSProperties}
                      >
                        Ver después
                      </IonButton>
                      <IonButton
                        expand="block"
                        color="warning"
                        disabled={acceptingId === String(scheduledReservationReadyAlert.id)}
                        onClick={() => void handleStartReadyScheduledReservation(scheduledReservationReadyAlert)}
                        style={{ "--border-radius": "14px", fontWeight: 950, color: "var(--rp-btn-primary-fg)" } as CSSProperties}
                      >
                        Iniciar viaje
                      </IonButton>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* La alerta sonora global está fuera de Solicitudes. Aquí solo quedan las tarjetas normales. */}
            {false && rideAlert && isDriverAvailable && !activeRide && (
              <DriverRideRequestAlertOverlay ride={rideAlert} />
            )}
          </>
        )}
      </IonContent>

      <style>{`.rapago-danger-alert { --background: #2A1A18; --color: #ffffff; --button-color: #ff6467; } .rapago-danger-alert .alert-title { color: #fecaca; font-weight: 950; } .rapago-danger-alert .alert-message { color: rgba(255,255,255,.82); } .rapago-complete-alert { --background: var(--rp-surface); --color: var(--rp-text); } .rapago-complete-alert .alert-title { color: var(--rp-ok-fg); font-weight: 950; } .rapago-passenger-cancel-alert {
  --background: linear-gradient(180deg,#fffaf0,#f8ead0);
  --color: #111827;
  --button-color: #111827;
  --max-width: 360px;
  --width: calc(100vw - 42px);
  --border-radius: 28px;
}
.rapago-passenger-cancel-alert .alert-wrapper {
  border-radius: 28px !important;
  border: 1px solid rgba(220,38,38,.18);
  box-shadow: 0 28px 70px rgba(0,0,0,.36);
  overflow: hidden;
}
.rapago-passenger-cancel-alert .alert-head {
  padding: 22px 22px 8px;
  text-align: left;
}
.rapago-passenger-cancel-alert .alert-title {
  color: #dc2626;
  font-weight: 950;
  font-size: 1.18rem;
  line-height: 1.1;
}
.rapago-passenger-cancel-alert .alert-message {
  color: #111827;
  white-space: pre-line;
  font-weight: 850;
  line-height: 1.42;
  padding: 8px 22px 10px;
}
.rapago-passenger-cancel-alert .alert-message::before {
  content: "\\26A0";
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  margin: 0 0 14px;
  border-radius: 999px;
  background: #fee2e2;
  color: #dc2626;
  font-size: 1.65rem;
  box-shadow: 0 12px 26px rgba(220,38,38,.16);
}
.rapago-passenger-cancel-alert .alert-button-group {
  padding: 8px 18px 18px;
}
.rapago-passenger-cancel-alert .alert-button {
  width: 100%;
  min-height: 48px;
  border-radius: 16px;
  background: linear-gradient(135deg,#facc15,#f59e0b);
  color: #111827 !important;
  font-weight: 950;
  text-transform: none;
  justify-content: center;
  margin: 0;
}`}</style>

      {completeConfirmRide && (
        <DriverCashCloseRideOverlay
          ride={completeConfirmRide}
          user={session?.user}
          onCancel={() => setCompleteConfirmRide(null)}
          onConfirm={(ride, cashClosure) => {
            void performCompleteRide(ride, cashClosure);
          }}
        />
      )}

      <IonAlert
        isOpen={Boolean(passengerCancelNotice)}
        header="Pasajero canceló el viaje"
        message={
          passengerCancelNotice
            ? `${passengerCancelNotice.route}\n\n${passengerCancelNotice.message}`
            : ""
        }
        cssClass="rapago-passenger-cancel-alert"
        onDidDismiss={() => setPassengerCancelNotice(null)}
        buttons={[
          {
            text: "Entendido",
            role: "confirm",
          },
        ]}
      />

      <IonAlert
        isOpen={Boolean(pendingReservationReject)}
        header="¿Por qué rechazas esta reserva?"
        subHeader="La reserva pasará al siguiente conductor disponible."
        message="Debes escribir el motivo. El administrador podrá verlo."
        cssClass="rapago-danger-alert"
        onDidDismiss={() => setPendingReservationReject(null)}
        inputs={[
          {
            name: "reason",
            type: "textarea",
            placeholder: "Ej.: No alcanzo a llegar a la hora programada.",
            attributes: {
              maxlength: 260,
            },
          },
        ]}
        buttons={[
          {
            text: "Volver",
            role: "cancel",
          },
          {
            text: "Rechazar y pasar al siguiente",
            role: "destructive",
            handler: (values) => {
              const reason = sanitizeDriverTripSafetyText(values?.reason, 260);

              if (!reason) {
                setError("Debes escribir el motivo del rechazo.");
                return false;
              }

              if (pendingReservationReject) {
                void handleRejectScheduledReservation(
                  pendingReservationReject,
                  reason,
                );
              }

              return true;
            },
          },
        ]}
      />

      <IonAlert
        isOpen={Boolean(cancelConfirmRide)}
        header="¿Estás seguro de cancelar?"
        message="El viaje volverá a estar disponible y se notificará al pasajero que buscaremos otro conductor."
        cssClass="rapago-danger-alert"
        onDidDismiss={() => setCancelConfirmRide(null)}
        buttons={[
          {
            text: "No",
            role: "cancel",
          },
          {
            text: "Sí, cancelar",
            role: "destructive",
            handler: () => {
              if (cancelConfirmRide) {
                void handleCancelRide(cancelConfirmRide);
              }
            },
          },
        ]}
      />

      {/* Opciones de emergencia. El SOS del mapa abre esto en vez de ejecutar:
          "Reportar accidente" abre WhatsApp soporte y deja registro, así que un
          toque accidental mandaba un mensaje real a soporte. Llamar a
          Carabineros va primero por ser lo urgente de verdad. */}
      <IonActionSheet
        isOpen={driverSosOpen}
        header="Emergencia"
        subHeader="Elige qué necesitas ahora"
        onDidDismiss={() => setDriverSosOpen(false)}
        buttons={[
          {
            text: "Llamar a Carabineros (133)",
            icon: callOutline,
            handler: () => {
              window.location.href = "tel:133";
            },
          },
          {
            text: "Reportar accidente a soporte",
            icon: chatbubbleEllipsesOutline,
            handler: () => {
              if (activeRide) handleReportDriverAccidentFromHome(activeRide);
            },
          },
          {
            text: "Cancelar",
            role: "cancel",
          },
        ]}
      />
    </IonPage>
  );
}

// ── DriverRideRouteMap ────────────────────────────────────────────────────────
// Shows a driving route from the driver's current position to origin (pre-pickup)
// or destination (in_progress). Requires driver position from Geolocation.

const DRIVER_ROUTE_LABEL: Record<string, string> = {
  accepted:        "Ruta hacia el pasajero",
  driver_en_route: "Ruta hacia el pasajero",
  in_progress:     "Ruta hacia el destino",
};

function DriverRideRouteMap({ status, driverPos, originLat, originLng, destinationLat, destinationLng }: {
  status: string;
  driverPos: LatLng | null;
  originLat: number | null; originLng: number | null;
  destinationLat: number | null; destinationLng: number | null;
}): JSX.Element | null {
  const route  = useDirectionsRoute();
  const mapRef = useRef<GoogleMapInstance | null>(null);

  if (!["accepted", "driver_en_route", "driver_arrived", "in_progress"].includes(status)) return null;

  if (status === "driver_arrived") {
    return (
      <div style={{ marginTop: "8px", padding: "8px 10px", background: "var(--ion-color-secondary-tint)", borderRadius: "8px", fontSize: "0.8rem", color: "var(--ion-color-secondary-shade)" }}>
        Ya llegaste al punto de recogida. Inicia el viaje cuando el pasajero esté a bordo.
      </div>
    );
  }

  if (!driverPos) {
    return (
      <div style={{ marginTop: "8px", fontSize: "0.78rem", color: "var(--ion-color-medium)", fontStyle: "italic" }}>
        Actualiza tu ubicación para ver la ruta.
      </div>
    );
  }

  const target: LatLng | null = status === "in_progress"
    ? (destinationLat && destinationLng ? { lat: destinationLat, lng: destinationLng } : null)
    : (originLat && originLng ? { lat: originLat, lng: originLng } : null);

  if (!target) {
    return (
      <div style={{ marginTop: "8px", fontSize: "0.78rem", color: "var(--ion-color-medium)", fontStyle: "italic" }}>
        Sin coordenadas suficientes para mostrar ruta.
      </div>
    );
  }

  function handleMapReady(map: GoogleMapInstance) {
    mapRef.current = map;
    void route.calculate(driverPos!, target!, map);
  }

  return (
    <div style={{ marginTop: "8px" }}>
      <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--ion-color-dark)", marginBottom: "6px" }}>
        {DRIVER_ROUTE_LABEL[status] ?? "Ruta"}
      </div>
      <MapView
        center={driverPos}
        zoom={13}
        height="160px"
        onMapReady={handleMapReady}
      />
      {route.status === "loading" && (
        <div style={{ fontSize: "0.72rem", color: "var(--ion-color-medium)", marginTop: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
          <IonSpinner name="dots" style={{ width: "12px", height: "12px" }} /> Calculando ruta…
        </div>
      )}
      {route.status === "success" && route.summary && (
        <div style={{ fontSize: "0.75rem", color: "var(--ion-color-primary)", marginTop: "4px", fontWeight: 600 }}>
          {route.summary.distanceText} · {route.summary.durationText}
        </div>
      )}
      {route.status === "error" && route.error && (
        <div style={{ fontSize: "0.72rem", color: "var(--ion-color-danger)", marginTop: "4px" }}>{route.error}</div>
      )}
    </div>
  );
}

// ── Scheduled helpers ─────────────────────────────────────────────────────────

function fmtScheduledPickup(iso: string): string {
  return new Date(iso).toLocaleString("es-CL", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function isPickupSoon(iso: string): boolean {
  return new Date(iso).getTime() <= Date.now() + 2 * 60 * 60 * 1000;
}

// ── QueuedOfferModal ──────────────────────────────────────────────────────────

function useCountdown(expiresAt: string | null): number {
  const [seconds, setSeconds] = useState<number>(() =>
    expiresAt ? Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)) : 0,
  );

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const remaining = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setSeconds(remaining);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return seconds;
}

function QueuedOfferModal({ offer, onAccept, onReject, onExpire, loading }: {
  offer: ActiveRideOfferData;
  onAccept: () => void;
  onReject: () => void;
  onExpire: () => void;
  loading: boolean;
}): JSX.Element {
  const countdown = useCountdown(offer.offer.expiresAt);
  const { ride } = offer;

  useEffect(() => {
    if (countdown === 0) onExpire();
  }, [countdown, onExpire]);

  const countdownColor = countdown <= 5 ? "var(--ion-color-danger)" : countdown <= 10 ? "var(--ion-color-warning-shade)" : "var(--ion-color-success-shade)";

  return (
    <div style={{ padding: "16px" }}>
      {/* Header */}
      <div style={{
        background:   "var(--ion-color-success)",
        color:        "white",
        borderRadius: "12px 12px 0 0",
        padding:      "14px 16px",
        margin:       "-16px -16px 0",
      }}>
        <div style={{ fontWeight: 700, fontSize: "1rem" }}>Próximo viaje disponible</div>
        <div style={{ fontSize: "0.8rem", opacity: 0.9, marginTop: "2px" }}>
          Este viaje comenzará después de terminar tu viaje actual.
        </div>
      </div>

      {/* Countdown */}
      <div style={{
        textAlign: "center", padding: "14px 0 8px",
        fontWeight: 800, fontSize: "2.2rem", color: countdownColor,
        letterSpacing: "-1px",
      }}>
        {countdown}s
      </div>

      {/* Ride details */}
      <div style={{
        background: "var(--ion-color-light)", borderRadius: "10px",
        padding: "12px 14px", marginBottom: "12px",
      }}>
        <div style={{ fontWeight: 600, fontSize: "0.92rem", marginBottom: "6px" }}>
          {getDriverRideRouteDisplayLabel(ride)}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", fontSize: "0.8rem", color: "var(--ion-color-medium-shade)" }}>
          {ride.estimatedFareClp != null && (
            <span style={{ fontWeight: 600, color: "var(--ion-color-success-shade)" }}>
              ${ride.estimatedFareClp.toLocaleString("es-CL")} CLP
            </span>
          )}
          {ride.distanceMeters != null && (
            <span>{(ride.distanceMeters / 1000).toFixed(1)} km</span>
          )}
          {ride.durationSeconds != null && (
            <span>~{Math.round(ride.durationSeconds / 60)} min</span>
          )}
        </div>

        {ride.rideType === "scheduled" && ride.scheduledPickupAt && (
          <div style={{
            marginTop: "8px", padding: "6px 10px",
            background: "var(--ion-color-warning-tint)", borderRadius: "6px",
            fontSize: "0.78rem", color: "var(--ion-color-warning-shade)", fontWeight: 600,
          }}>
            Programado: {fmtScheduledPickup(ride.scheduledPickupAt)}
          </div>
        )}

        {ride.priorityFeeClp != null && ride.priorityFeeClp > 0 && (
          <div style={{
            marginTop: "6px", fontSize: "0.78rem",
            color: "var(--ion-color-warning-shade)", fontWeight: 600,
          }}>
            Recargo prioritario: ${ride.priorityFeeClp.toLocaleString("es-CL")} CLP
          </div>
        )}

        {ride.flightNumber && (
          <div style={{ marginTop: "4px", fontSize: "0.78rem", color: "var(--ion-color-medium)" }}>
            Vuelo: {ride.flightNumber}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "8px" }}>
        <IonButton
          expand="block"
          fill="outline"
          color="medium"
          style={{ flex: 1 }}
          disabled={loading}
          onClick={onReject}
        >
          Rechazar
        </IonButton>
        <IonButton
          expand="block"
          color="success"
          style={{ flex: 1 }}
          disabled={loading || countdown === 0}
          onClick={onAccept}
        >
          {loading ? <IonSpinner name="dots" style={{ width: "18px", height: "18px" }} /> : "Aceptar"}
        </IonButton>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function DriverTripsPage(): JSX.Element {
  return (
    <>
      <DriverMyRidesPage />
    </>
  );
}

/* Aquí vivía DriverHistoryRideCard: un componente de tarjeta de historial
   que NUNCA se usó — la lista de "Mis Viajes" siempre se renderizó con JSX
   en línea dentro de DriverMyRidesPage. Tener las dos versiones hacía que
   editar la tarjeta "correcta" no cambiara nada en pantalla, así que se
   elimina la copia muerta y queda una sola fuente de verdad. */

function DriverMyRidesPage(): JSX.Element {
  const { session } = useAuth();
  const { theme } = useRapagoSectionTheme("driver-trips");
  const location = useLocation();
  const isTripsPageActive =
    location.pathname === ROUTES.DRIVER.TRIPS ||
    location.pathname.includes("/driver/trips/");
  type DriverRideData =
    import("../../features/rides/rides.service").DriverRideData;

  const [rides, setRides] = useState<DriverRideData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [completeConfirmRide, setCompleteConfirmRide] = useState<DriverRideData | null>(null);
  const [passengerCancelNotice, setPassengerCancelNotice] = useState<{
    route: string;
    message: string;
  } | null>(null);
  const passengerCancelNoticeKeyRef = useRef("");
  const tripsLoadInFlightRef = useRef(false);
  const tripsNextLoadAtRef = useRef(0);

  const loadRides = useCallback(async (background = false) => {
    if (
      !session?.accessToken ||
      !isTripsPageActive ||
      document.visibilityState !== "visible" ||
      tripsLoadInFlightRef.current ||
      Date.now() < tripsNextLoadAtRef.current
    ) {
      return;
    }

    tripsLoadInFlightRef.current = true;
    tripsNextLoadAtRef.current = Date.now() + 2_000;

    if (!background) {
      setLoading(true);
      setLoadError(null);
    }

    try {
      const data = await ridesService.listDriverRides(session.accessToken);
      const noShowCompleted = readDriverNoShowCompletedRides() as unknown as DriverRideData[];
      const merged = [
        ...noShowCompleted,
        ...data.filter(
          (ride) =>
            !noShowCompleted.some((closedRide) =>
              driverRideNoShowCompletedIdentityMatches(
                closedRide as unknown as Record<string, unknown>,
                ride as unknown as Record<string, unknown>,
              ),
            ),
        ),
      ];
      setRides(merged);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Error al cargar tus viajes.",
      );
    } finally {
      tripsLoadInFlightRef.current = false;
      if (!background) setLoading(false);
    }
  }, [isTripsPageActive, session?.accessToken]);

  useEffect(() => {
    if (isTripsPageActive) void loadRides();
  }, [isTripsPageActive, loadRides]);

  useEffect(() => {
    if (!isTripsPageActive) return;

    const tick = () => {
      if (document.visibilityState === "visible") void loadRides(true);
    };

    const intervalId = window.setInterval(tick, 15_000);
    document.addEventListener("visibilitychange", tick);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [isTripsPageActive, loadRides]);

  useEffect(() => {
    if (!isTripsPageActive || document.visibilityState !== "visible") return;

    const notifyPassengerCancelledInTrips = (
      cancelledRide: Record<string, unknown>,
    ): void => {
      const keys = getDriverRideIdentityKeys(cancelledRide);
      const noticeKey = [
        ...keys,
        String(cancelledRide.cancelledAt ?? ""),
        getPassengerCancellationReasonForDriver(cancelledRide),
      ].join("|");

      if (noticeKey && passengerCancelNoticeKeyRef.current === noticeKey) return;
      if (!claimDriverPassengerCancelNoticeOnce(cancelledRide, session?.user)) return;
      passengerCancelNoticeKeyRef.current = noticeKey;

      markDriverRidePassengerCancelledLocally(cancelledRide);
      removeDriverRideAfterPassengerCancel(cancelledRide);

      const route = getDriverRideRouteDisplayLabel(cancelledRide as {
        originText?: string | null;
        destinationText?: string | null;
        notes?: string | null;
      });
      const reason = getPassengerCancellationReasonForDriver(cancelledRide);

      setRides((current) =>
        current.filter(
          (ride) =>
            !driverRideMatchesPassengerCancelledRecord(
              ride as unknown as Record<string, unknown>,
              cancelledRide,
            ),
        ),
      );

      setCompleteConfirmRide((current) =>
        current &&
        driverRideMatchesPassengerCancelledRecord(
          current as unknown as Record<string, unknown>,
          cancelledRide,
        )
          ? null
          : current,
      );

      setActionLoading(null);
      setLoadError(null);
      setPassengerCancelNotice({
        route,
        message: `Motivo informado: ${reason}\n\nEl viaje fue cancelado y retirado de tus viajes activos. No continúes hacia la recogida.`,
      });

      try {
        if ("vibrate" in navigator) navigator.vibrate?.([240, 90, 240]);
      } catch {
        // No bloquea el aviso.
      }
    };

    const checkPassengerCancelledInTrips = (event?: Event): void => {
      const detail = (
        event as
          | CustomEvent<{ cancelled?: unknown; ride?: unknown }>
          | undefined
      )?.detail;

      const eventRecord =
        detail?.cancelled && typeof detail.cancelled === "object"
          ? (detail.cancelled as Record<string, unknown>)
          : detail?.ride && typeof detail.ride === "object"
            ? (detail.ride as Record<string, unknown>)
            : null;

      if (eventRecord && isRidePassengerCancelledForDriver(eventRecord)) {
        const visibleMatch =
          rides.length === 0 ||
          rides.some((ride) =>
            driverRideMatchesPassengerCancelledRecord(
              ride as unknown as Record<string, unknown>,
              eventRecord,
            ),
          );

        if (visibleMatch) {
          notifyPassengerCancelledInTrips(eventRecord);
          return;
        }
      }

      for (const ride of rides) {
        const cancelledMatch = findPassengerCancelledRideForDriver(
          ride as unknown as Record<string, unknown>,
        );

        if (cancelledMatch) {
          notifyPassengerCancelledInTrips(cancelledMatch);
          return;
        }
      }
    };

    checkPassengerCancelledInTrips();

    const timerId = window.setInterval(
      checkPassengerCancelledInTrips,
      1200,
    );

    window.addEventListener(
      RAPAGO_PASSENGER_CANCELLED_RIDE_EVENT,
      checkPassengerCancelledInTrips as EventListener,
    );
    window.addEventListener(
      "rapago:passenger-rides-updated",
      checkPassengerCancelledInTrips as EventListener,
    );
    window.addEventListener(
      "rapago:driver-rides-updated",
      checkPassengerCancelledInTrips as EventListener,
    );
    window.addEventListener(
      "storage",
      checkPassengerCancelledInTrips as EventListener,
    );

    return () => {
      window.clearInterval(timerId);
      window.removeEventListener(
        RAPAGO_PASSENGER_CANCELLED_RIDE_EVENT,
        checkPassengerCancelledInTrips as EventListener,
      );
      window.removeEventListener(
        "rapago:passenger-rides-updated",
        checkPassengerCancelledInTrips as EventListener,
      );
      window.removeEventListener(
        "rapago:driver-rides-updated",
        checkPassengerCancelledInTrips as EventListener,
      );
      window.removeEventListener(
        "storage",
        checkPassengerCancelledInTrips as EventListener,
      );
    };
  }, [isTripsPageActive, rides, session?.user]);

  const activeRide = rides.find((ride) =>
    ["accepted", "driver_en_route", "driver_arrived", "in_progress"].includes(
      ride.status,
    ) && (!wasDriverRideCancelledLocally(ride as unknown as Record<string, unknown>, session?.user) && !wasDriverRideNoShowCompletedLocally(ride as unknown as Record<string, unknown>, session?.user)),
  );

  const historyRides = rides.filter(
    (ride) =>
      ![
        "accepted",
        "driver_en_route",
        "driver_arrived",
        "in_progress",
      ].includes(ride.status),
  );

  /* Resumen de la lista. Son datos ya cargados: no cuesta una petición más y
     evita que el conductor tenga que sumar de cabeza recorriendo las tarjetas.
     El total cuenta SÓLO los completados — un viaje cancelado puede traer
     tarifa en el registro y sumarla inflaría lo que de verdad ganó. */
  const historyCompletedRides = historyRides.filter(
    (ride) => ride.status === "completed",
  );
  const historyCompletedCount = historyCompletedRides.length;
  const historyCancelledCount = historyRides.filter(
    (ride) => ride.status === "cancelled",
  ).length;
  const historyEarningsClp = historyCompletedRides.reduce((total, ride) => {
    const fare = getRideDisplayFareClp(ride);
    return total + (Number.isFinite(Number(fare)) ? Number(fare) : 0);
  }, 0);

  async function runRideAction(
    rideId: string,
    action: () => Promise<unknown>,
  ): Promise<void> {
    setActionLoading(rideId);

    try {
      await action();
      await loadRides();
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "No se pudo actualizar el viaje.",
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function cancelActiveRideFromMyRides(ride: DriverRideData): Promise<void> {
    if (!ride?.id) return;

    const rideId = ride.id;
    setActionLoading(rideId);
    setLoadError(null);

    try {
      if (session?.accessToken) {
        try {
          await ridesService.cancelAcceptedRide(session.accessToken, rideId);
        } catch {
          // En desarrollo el backend puede devolver 500/404 aunque el viaje exista localmente.
          // La app no debe quedar bloqueada: cancelamos localmente y reencolamos para buscar otro conductor.
        }
      }

      const cancelledRide = {
        ...(ride as DriverRideData & Record<string, unknown>),
        status: "cancelled",
        cancelledAt: new Date().toISOString(),
        cancelledByRole: "driver",
        cancelledBy: "driver",
        cancellationReason: "Cancelado por conductor.",
        requeuedReason: "driver_cancelled",
      } as DriverRideData & Record<string, unknown>;

      markDriverRideCancelledLocally(cancelledRide, session?.user);
      const requeued = requeueRideAfterDriverCancel(ride, session?.user);
      clearDriverLiveLocationForPassenger(rideId);
      clearDriverActiveRideLocalMirrors(cancelledRide);

      try {
        const storageKeys = [
          "rapago_local_driver_assigned_rides",
          "rapago_driver_scheduled_queue",
          "rapago_driver_active_rides_v1",
          "rapago_driver_my_rides_v1",
        ];

        for (const key of storageKeys) {
          const raw = localStorage.getItem(key);
          const parsed = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
          if (!Array.isArray(parsed)) continue;

          localStorage.setItem(
            key,
            JSON.stringify(
              parsed
                .map((item) => String(item.id ?? "") === rideId ? { ...item, ...cancelledRide } : item)
                .filter((item) => {
                  const id = String(item.id ?? "");
                  const status = String(item.status ?? "").toLowerCase();
                  return id !== rideId || status === "cancelled";
                })
                .slice(0, 200),
            ),
          );
        }
      } catch {
        // No bloquea la cancelación visual.
      }

      setRides((prev) => {
        const withoutCurrent = prev.filter((item) => item.id !== rideId);
        return [cancelledRide, ...withoutCurrent];
      });

      window.dispatchEvent(new CustomEvent("rapago:driver-available-rides-updated", { detail: { ride: requeued } }));
      window.dispatchEvent(new CustomEvent("rapago:passenger-rides-updated"));
      setLoadError(null);
    } finally {
      setActionLoading(null);
    }
  }

  async function completeActiveRideFromMyRides(
    ride: DriverRideData,
    cashClosure?: DriverCashClosurePayload | null,
  ): Promise<void> {
    if (!session?.accessToken || !ride?.id) return;

    setActionLoading(ride.id);
    setLoadError(null);

    try {
      const completed = await ridesService.completeRide(session.accessToken, ride.id);
      const completedAt = new Date().toISOString();
      const cashPatch = buildDriverCashClosureRidePatch(ride, cashClosure);

      let cashBackendWarning: string | null = null;
      if (cashClosure) {
        try {
          await persistDriverCashClosureInBackend(
            session.accessToken,
            String(ride.id),
            cashClosure,
          );
        } catch (cashError) {
          cashBackendWarning =
            cashError instanceof Error
              ? `Viaje completado, pero el efectivo no llegó al backend: ${cashError.message}`
              : "Viaje completado, pero el efectivo no llegó al backend.";
        }

        persistDriverCashClosureForAdmin(
          { ...(ride as unknown as Record<string, unknown>), ...cashPatch, completedAt, closedByDriverAt: completedAt },
          cashClosure,
          session?.user,
        );
      }

      saveDriverCompletedRideForEarnings(
        {
          ...(ride as DriverEarningsRide),
          ...((completed ?? {}) as Record<string, unknown>),
          ...cashPatch,
          status: "completed",
          completedAt,
          closedByDriverAt: completedAt,
          destinationConfirmedByDriver: true,
        } as DriverEarningsRide,
        session?.user,
      );

      clearDriverLiveLocationForPassenger(ride.id);
      removeDriverActiveRideLocalMirror({ ...(ride as unknown as Record<string, unknown>), ...cashPatch }, session?.user);

      const nextActive = promoteDriverNextRideAfterCompletion(ride.id, session?.user);
      setRides((prev) => {
        const completedRide = {
          ...ride,
          ...((completed ?? {}) as Record<string, unknown>),
          ...cashPatch,
          status: "completed",
          completedAt,
          closedByDriverAt: completedAt,
        } as DriverRideData;
        const withoutCurrent = prev.filter((item) => item.id !== ride.id);
        return nextActive ? [nextActive, completedRide, ...withoutCurrent] : [completedRide, ...withoutCurrent];
      });

      window.dispatchEvent(new CustomEvent("rapago:passenger-rides-updated", { detail: { rideId: ride.id, status: "completed", cashClosure } }));
      if (cashBackendWarning) setLoadError(cashBackendWarning);
      if (!nextActive) await loadRides();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "No se pudo finalizar el viaje.");
    } finally {
      setActionLoading(null);
      setCompleteConfirmRide(null);
    }
  }

  function handleReportDriverAccidentFromTrips(ride: DriverRideData): void {
    saveDriverAccidentTripSafetyReport(ride, session?.user);
    openDriverAccidentWhatsApp(ride, session?.user);
    setLoadError("Reporte de accidente guardado. Se abrió WhatsApp soporte.");
  }

  function statusLabel(status: string): string {
    if (status === "accepted") return "Aceptado";
    if (status === "driver_en_route") return "En camino";
    if (status === "driver_arrived") return "Esperando pasajero";
    if (status === "in_progress") return "En viaje";
    if (status === "completed") return "Completado";
    if (status === "cancelled") return "Cancelado";
    return status;
  }

  async function handleDriverNoShowRide(ride: DriverRideData): Promise<void> {
    const rideId = String(ride.id ?? "").trim();
    if (!rideId) return;

    const noShowState = getDriverNoShowState(ride as DriverRideData & Record<string, unknown>);
    if (!noShowState.allowed) {
      setLoadError(`Debes esperar 5 minutos desde que llegaste al punto. Falta ${formatDriverNoShowRemaining(noShowState.remainingMs)}.`);
      return;
    }

    setActionLoading(rideId);
    setLoadError(null);

    try {
      notifyPassengerNoShowByAppAndWhatsapp(ride, noShowState.feeClp);

      const charge = saveDriverNoShowChargeForPassenger(ride, session?.user);
      markPassengerRideNoShowCancelledFromDriver(ride, charge);
      clearDriverNoShowTimer(ride as DriverRideData & Record<string, unknown>);

      const noShowClosedRide = markDriverRideNoShowCompletedLocally(
        {
          ...(ride as unknown as Record<string, unknown>),
          id: rideId,
          noShowChargeClp: Number(charge.amountClp ?? noShowState.feeClp ?? 0),
        } as unknown as DriverRideData & Record<string, unknown>,
        session?.user,
      );

      try {
        clearDriverLiveLocationForPassenger(rideId);
      } catch {
        // No bloquea cierre visual.
      }

      try {
        clearDriverActiveRideLocalMirrors(noShowClosedRide);
      } catch {
        // No bloquea cierre visual.
      }

      try {
        removeDriverActiveRideLocalMirror(noShowClosedRide as unknown as Record<string, unknown>, session?.user);
      } catch {
        // No bloquea cierre visual.
      }






      setRides((prev) => [
        noShowClosedRide,
        ...prev.filter(
          (item) =>
            !driverRideNoShowCompletedIdentityMatches(
              item as unknown as Record<string, unknown>,
              noShowClosedRide as unknown as Record<string, unknown>,
            ),
        ),
      ]);


      if (session?.accessToken) {
        try {
          await declareDriverNoShowInBackend(
            session.accessToken,
            rideId,
          );
        } catch (backendError) {
          console.error(
            "[RAPA GO] No Show local cerrado, pero backend falló",
            backendError,
          );
        }
      }

      window.dispatchEvent(
        new CustomEvent("rapago:driver-active-ride-cancelled", {
          detail: {
            rideId,
            ride: noShowClosedRide,
            status: "completed",
            reason: "driver_no_show",
            noShowCompleted: true,
          },
        }),
      );

      window.dispatchEvent(
        new CustomEvent("rapago:driver-rides-updated", {
          detail: {
            rideId,
            status: "completed",
            reason: "driver_no_show",
            noShowCompleted: true,
          },
        }),
      );

      window.dispatchEvent(
        new CustomEvent("rapago:driver-available-rides-updated", {
          detail: {
            rideId,
            status: "completed",
            reason: "driver_no_show",
            noShowCompleted: true,
          },
        }),
      );

      setLoadError("No show registrado. El viaje fue cerrado y retirado de tus viajes activos.");
    } catch (err) {
      console.error("[RAPA GO] Error cerrando No show", err);
      setLoadError(err instanceof Error ? err.message : "No se pudo cerrar el No show.");
    } finally {
      setActionLoading(null);
    }
  }


  const hasInProgressRide = rides.some((ride) => ride.status === "in_progress");
  const hasAcceptedQueuedRide = hasInProgressRide && rides.some((ride) => ride.status === "accepted");

  return (
    <IonPage className="rapago-driver-page" data-rapago-theme={theme}>
      <style>{`
        .rapago-passenger-cancel-alert-trips .alert-wrapper {
          width: min(92vw, 520px);
          max-width: 520px;
          border-radius: 24px;
          background: #fffdf7 !important;
          color: #111827 !important;
          border: 2px solid rgba(220,38,38,.32);
          box-shadow: 0 28px 70px rgba(0,0,0,.34);
        }
        .rapago-passenger-cancel-alert-trips .alert-head {
          padding: 22px 22px 10px;
        }
        .rapago-passenger-cancel-alert-trips .alert-title {
          color: #991b1b !important;
          font-size: 1.2rem;
          font-weight: 950;
        }
        .rapago-passenger-cancel-alert-trips .alert-message {
          color: #111827 !important;
          white-space: pre-line;
          line-height: 1.55;
          font-weight: 760;
          padding: 4px 22px 18px;
        }
        .rapago-passenger-cancel-alert-trips .alert-button-group {
          padding: 8px 18px 18px;
        }
        .rapago-passenger-cancel-alert-trips .alert-button {
          width: 100%;
          min-height: 48px;
          border-radius: 16px;
          background: linear-gradient(135deg,#facc15,#f59e0b);
          color: #111827 !important;
          font-weight: 950;
          justify-content: center;
          margin: 0;
        }
      `}</style>
      <RapagoAppBar
        sectionId="driver-trips"
        title="Mis Viajes"
        actionIcon={refreshOutline}
        actionLabel="Actualizar viajes"
        actionLoading={loading}
        onAction={() => void loadRides()}
      />

      <IonContent className="ion-padding">
        <IonRefresher
          slot="fixed"
          onIonRefresh={(event) => {
            void loadRides().then(() => event.detail.complete());
          }}
        >
          <IonRefresherContent />
        </IonRefresher>

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

        {!loading && activeRide && (
          <IonCard
            className="rapago-driver-card rapago-driver-active-link-card"
            style={{
              margin: "0 0 14px",
              borderRadius: "22px",
              overflow: "hidden",
              background: "var(--rp-surface)",
              border: "2px solid var(--rp-ok-bd)",
              boxShadow: "var(--rp-shadow)",
            }}
          >
            <IonCardContent style={{ padding: "15px 16px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <IonBadge color="success" style={{ marginBottom: 7 }}>
                    {statusLabel(activeRide.status)}
                  </IonBadge>
                  <div style={{ fontWeight: 950, fontSize: "1.02rem" }}>
                    Tienes un viaje activo
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      color: "var(--rp-muted)",
                      fontSize: ".78rem",
                      fontWeight: 800,
                      lineHeight: 1.35,
                    }}
                  >
                    El mapa y los controles están en una pantalla separada.
                  </div>
                </div>
                <IonButton
                  routerLink={ROUTES.DRIVER.ACTIVE_RIDE}
                  color="success"
                  style={{
                    "--border-radius": "15px",
                    minWidth: 126,
                    fontWeight: 950,
                  } as CSSProperties}
                >
                  <IonIcon icon={navigateOutline} slot="start" />
                  Abrir mapa
                </IonButton>
              </div>
            </IonCardContent>
          </IonCard>
        )}

        {!loading && historyRides.length === 0 && (
          <div className="rapago-trip-empty">
            <span className="rapago-trip-empty__icon" aria-hidden="true">
              <IonIcon icon={carOutline} />
            </span>
            <strong>Aún no tienes viajes</strong>
            <span>
              Cuando completes tu primer servicio aparecerá aquí con su detalle
              de pago.
            </span>
          </div>
        )}

        {!loading && historyRides.length > 0 && (
          <>
            {/* Resumen de la lista. Antes había que sumar de cabeza recorriendo
                las tarjetas para saber cuánto se llevaba hecho; son datos que ya
                están cargados, así que mostrarlos no cuesta una petición más. */}
            <div className="rapago-trip-summary">
              <div className="rapago-trip-summary__item">
                <span className="rapago-trip-summary__label">
                  <IonIcon icon={checkmarkCircleOutline} aria-hidden="true" />
                  Completados
                </span>
                <strong>{historyCompletedCount}</strong>
              </div>

              <div className="rapago-trip-summary__item rapago-trip-summary__item--amount">
                <span className="rapago-trip-summary__label">
                  <IonIcon icon={cashOutline} aria-hidden="true" />
                  Total
                </span>
                <strong>{formatClp(historyEarningsClp)}</strong>
              </div>

              {historyCancelledCount > 0 && (
                <div className="rapago-trip-summary__item">
                  <span className="rapago-trip-summary__label">
                    <IonIcon icon={closeCircleOutline} aria-hidden="true" />
                    Cancelados
                  </span>
                  <strong>{historyCancelledCount}</strong>
                </div>
              )}
            </div>

            <div className="rapago-trip-list">
              {historyRides.map((ride) => {
                const rideVehicleCategory = getRideVehicleCategory(ride as RideWithFarePayload);
                const rideVehicleLabel = getRideVehicleLabel(rideVehicleCategory);
                const rideVehicleEmoji = getRideVehicleEmoji(rideVehicleCategory);
                const rideRecord = ride as unknown as Record<string, unknown>;
                const cancelled = ride.status === "cancelled";
                const fareClp = getRideDisplayFareClp(ride);
                const closedAt =
                  (rideRecord.completedAt as string | null | undefined) ??
                  (rideRecord.cancelledAt as string | null | undefined) ??
                  null;
                const cashConfirmed =
                  rideRecord.cashPaymentConfirmedByDriver === true ||
                  Boolean(rideRecord.cashPaymentClosure);

                return (
                  <article
                    key={ride.id}
                    className={`rapago-trip-card${cancelled ? " rapago-trip-card--cancelled" : ""}`}
                  >
                    <header className="rapago-trip-card__head">
                      <span className="rapago-trip-card__icon" aria-hidden="true">
                        <IonIcon icon={cancelled ? closeCircleOutline : checkmarkCircleOutline} />
                      </span>

                      <div className="rapago-trip-card__route">
                        <h3>{getDriverRideRouteDisplayLabel(ride)}</h3>
                        {closedAt && (
                          <time dateTime={closedAt}>
                            {new Date(closedAt).toLocaleString("es-CL", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </time>
                        )}
                      </div>

                      <span className="rapago-trip-card__state">
                        {statusLabel(ride.status)}
                      </span>
                    </header>

                    {fareClp != null && (
                      <dl className="rapago-trip-card__facts">
                        <div className="rapago-trip-card__fact rapago-trip-card__fact--amount">
                          <dt>
                            <IonIcon icon={cashOutline} aria-hidden="true" />
                            Precio
                          </dt>
                          <dd>{formatClp(fareClp)}</dd>
                        </div>

                        <div className="rapago-trip-card__fact">
                          <dt>
                            <IonIcon icon={cardOutline} aria-hidden="true" />
                            Pago
                          </dt>
                          <dd>{getRidePaymentMethodLabel(ride.notes)}</dd>
                        </div>

                        <div className="rapago-trip-card__fact">
                          <dt>
                            <IonIcon icon={carOutline} aria-hidden="true" />
                            Vehículo
                          </dt>
                          <dd>
                            {rideVehicleEmoji} {rideVehicleLabel}
                          </dd>
                        </div>

                        {cashConfirmed && (
                          <div className="rapago-trip-card__fact rapago-trip-card__fact--cash">
                            <dt>
                              <IonIcon icon={walletOutline} aria-hidden="true" />
                              Efectivo recibido
                            </dt>
                            <dd>
                              {formatClp(
                                Number(
                                  rideRecord.cashPaidClp ??
                                    rideRecord.paymentReceivedByDriverClp ??
                                    0,
                                ),
                              )}
                              {Number(rideRecord.cashOverpaidClp ?? 0) > 0 &&
                                ` · Pagó demás: ${formatClp(Number(rideRecord.cashOverpaidClp))}`}
                            </dd>
                          </div>
                        )}
                      </dl>
                    )}
                  </article>
                );
              })}
            </div>
          </>
        )}
      </IonContent>

      {completeConfirmRide && (
        <DriverCashCloseRideOverlay
          ride={completeConfirmRide}
          user={session?.user}
          loading={actionLoading === completeConfirmRide.id}
          onCancel={() => setCompleteConfirmRide(null)}
          onConfirm={(ride, cashClosure) => {
            void completeActiveRideFromMyRides(ride, cashClosure);
          }}
        />
      )}

      {/* Modal propio y no IonAlert: un alert sólo admite texto plano, así que
          no había forma de darle el logo ni jerarquía visual. Al ser una
          interrupción que corta lo que el conductor estaba haciendo, conviene
          que se reconozca como RAPA GO de inmediato y no como un aviso del
          sistema operativo. */}
      <IonModal
        isOpen={Boolean(passengerCancelNotice)}
        backdropDismiss={false}
        className="rapago-cancel-notice"
        onDidDismiss={() => setPassengerCancelNotice(null)}
      >
        <div className="rapago-cancel-notice__card" role="alertdialog" aria-modal="true">
          <img
            className="rapago-cancel-notice__logo"
            src={logoRapago}
            alt="RAPA GO"
          />

          <span className="rapago-cancel-notice__icon" aria-hidden="true">
            <IonIcon icon={closeCircleOutline} />
          </span>

          <h2 className="rapago-cancel-notice__title">Pasajero canceló el viaje</h2>

          {passengerCancelNotice && (
            <>
              <p className="rapago-cancel-notice__route">
                {passengerCancelNotice.route}
              </p>
              <p className="rapago-cancel-notice__message">
                {passengerCancelNotice.message}
              </p>
            </>
          )}

          <IonButton
            expand="block"
            className="rapago-cancel-notice__cta"
            onClick={() => setPassengerCancelNotice(null)}
          >
            Entendido
          </IonButton>
        </div>
      </IonModal>

    </IonPage>
  );
}

function clp(amount: number): string {
  return `$${amount.toLocaleString("es-CL")} CLP`;
}

export function DriverEarningsPage(): JSX.Element {
  const m = meta("/driver/earnings");
  const { session } = useAuth();
  const { theme } = useRapagoSectionTheme("driver-earnings");
  const location = useLocation();
  const isEarningsPageActive = location.pathname === ROUTES.DRIVER.EARNINGS;
  const earningsLoadInFlightRef = useRef(false);
  const earningsNextLoadAtRef = useRef(0);
  const [rides, setRides] = useState<DriverEarningsRide[]>([]);
  const [filter, setFilter] = useState<DriverEarningsFilter>("today");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadEarnings = useCallback(async () => {
    if (
      !isEarningsPageActive ||
      document.visibilityState !== "visible" ||
      earningsLoadInFlightRef.current ||
      Date.now() < earningsNextLoadAtRef.current
    ) {
      return;
    }

    earningsLoadInFlightRef.current = true;
    earningsNextLoadAtRef.current = Date.now() + 2_000;
    setLoading(true);
    setLoadError(null);

    const localRides = readDriverEarningsLocalRides(session?.user);

    try {
      const serverRides = session?.accessToken
        ? await ridesService.listDriverRides(session.accessToken)
        : [];

      setRides(dedupeDriverEarningsRides([
        ...(serverRides as DriverEarningsRide[]),
        ...localRides,
      ]));
    } catch (err) {
      setRides(dedupeDriverEarningsRides(localRides));
      setLoadError(
        err instanceof Error
          ? `No se pudo cargar la API. Mostrando respaldo local: ${err.message}`
          : "No se pudo cargar la API. Mostrando respaldo local.",
      );
    } finally {
      earningsLoadInFlightRef.current = false;
      setLoading(false);
    }
  }, [isEarningsPageActive, session?.accessToken, session?.user]);

  useEffect(() => {
    if (isEarningsPageActive) void loadEarnings();
  }, [isEarningsPageActive, loadEarnings]);

  useEffect(() => {
    const refresh = () => {
      if (isEarningsPageActive && document.visibilityState === "visible") {
        void loadEarnings();
      }
    };
    window.addEventListener("rapago:driver-rides-updated", refresh as EventListener);
    window.addEventListener("rapago:passenger-rides-updated", refresh as EventListener);
    window.addEventListener("storage", refresh as EventListener);
    return () => {
      window.removeEventListener("rapago:driver-rides-updated", refresh as EventListener);
      window.removeEventListener("rapago:passenger-rides-updated", refresh as EventListener);
      window.removeEventListener("storage", refresh as EventListener);
    };
  }, [isEarningsPageActive, loadEarnings]);

  const filterStart = getDriverEarningsFilterStart(filter);
  const visibleRides = rides.filter((ride) => getDriverEarningsRideDateMs(ride) >= filterStart);
  const totalFareClp = visibleRides.reduce(
    (sum, ride) => sum + (getRideDisplayFareClp(ride as RideWithFarePayload) ?? 0),
    0,
  );
  const totalEarningsClp = visibleRides.reduce(
    (sum, ride) => sum + getDriverEarningsAmountClp(ride),
    0,
  );
  const totalCommissionClp = Math.max(0, totalFareClp - totalEarningsClp);

  const filterLabels: Record<DriverEarningsFilter, string> = {
    today: "Hoy",
    week: "7 días",
    month: "Mes",
    all: "Todo",
  };

  return (
    <>
      <IonPage className="rapago-driver-page" data-rapago-theme={theme}>
      <RapagoAppBar sectionId="driver-earnings" title={m.label} />
      <IonContent
        className="ion-padding"
        style={
          {
            "--background": "transparent",
          } as CSSProperties
        }
      >
        <IonRefresher
          slot="fixed"
          onIonRefresh={(event) => {
            void loadEarnings().finally(() => event.detail.complete());
          }}
        >
          <IonRefresherContent />
        </IonRefresher>

        <IonCard
          className="rapago-driver-card"
          style={{
            margin: 0,
            borderRadius: 24,
            background: "var(--rp-surface)",
            color: "var(--rp-text)",
            boxShadow: "var(--rp-shadow)",
          }}
        >
          <IonCardContent style={{ padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: ".78rem", fontWeight: 900, opacity: .78 }}>
                  Ganancia acumulada
                </div>
                <div style={{ marginTop: 4, fontSize: "1.8rem", fontWeight: 950, lineHeight: 1 }}>
                  {formatClp(totalEarningsClp)}
                </div>
                <div style={{ marginTop: 7, fontSize: ".82rem", fontWeight: 850 }}>
                  {visibleRides.length} viaje{visibleRides.length === 1 ? "" : "s"} completado{visibleRides.length === 1 ? "" : "s"}
                </div>
              </div>

              <div
                aria-hidden="true"
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 18,
                  background: "var(--rp-surface-soft)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <IonIcon icon={cashOutline} style={{ fontSize: 30 }} />
              </div>
            </div>
          </IonCardContent>
        </IonCard>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            marginTop: 12,
          }}
        >
          <IonCard className="rapago-driver-card" style={{ margin: 0, borderRadius: 18, background: "var(--rp-surface)" }}>
            <IonCardContent style={{ padding: 14 }}>
              <div style={{ color: "var(--rp-muted)", fontSize: ".72rem", fontWeight: 850 }}>Total cobrado</div>
              <div style={{ color: "var(--rp-text)", fontWeight: 950, marginTop: 3 }}>{formatClp(totalFareClp)}</div>
            </IonCardContent>
          </IonCard>
          <IonCard className="rapago-driver-card" style={{ margin: 0, borderRadius: 18, background: "var(--rp-surface)" }}>
            <IonCardContent style={{ padding: 14 }}>
              <div style={{ color: "var(--rp-muted)", fontSize: ".72rem", fontWeight: 850 }}>Comisión Rapa Go</div>
              <div style={{ color: "var(--rp-text)", fontWeight: 950, marginTop: 3 }}>{formatClp(totalCommissionClp)}</div>
            </IonCardContent>
          </IonCard>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 8,
            marginTop: 14,
          }}
        >
          {(["today", "week", "month", "all"] as DriverEarningsFilter[]).map((item) => (
            <IonButton
              key={item}
              size="small"
              fill={filter === item ? "solid" : "outline"}
              color={filter === item ? "success" : "light"}
              onClick={() => setFilter(item)}
              style={{ "--border-radius": "999px", fontWeight: 900 } as CSSProperties}
            >
              {filterLabels[item]}
            </IonButton>
          ))}
        </div>

        <IonButton
          expand="block"
          color="success"
          disabled={visibleRides.length === 0}
          onClick={() => exportDriverEarningsCsv(visibleRides, filter)}
          style={{ marginTop: 12, "--border-radius": "16px", height: 48, fontWeight: 950 } as CSSProperties}
        >
          Exportar Excel
        </IonButton>

        {loadError && (
          <IonText color="warning">
            <p style={{ fontSize: ".78rem", fontWeight: 800 }}>{loadError}</p>
          </IonText>
        )}

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 28 }}>
            <IonSpinner name="crescent" />
          </div>
        )}

        {!loading && visibleRides.length === 0 && (
          <IonCard className="rapago-driver-card" style={{ margin: "14px 0 0", borderRadius: 20, background: "var(--rp-surface)" }}>
            <IonCardContent style={{ color: "var(--rp-text)", fontWeight: 850 }}>
              Todavía no hay viajes completados para este filtro.
            </IonCardContent>
          </IonCard>
        )}

        {!loading && visibleRides.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
            {visibleRides.map((ride) => {
              const fare = getRideDisplayFareClp(ride as RideWithFarePayload) ?? 0;
              const earning = getDriverEarningsAmountClp(ride);
              const dateMs = getDriverEarningsRideDateMs(ride);

              return (
                <IonCard
                  key={String(ride.id ?? `${getDriverRidePointDisplayLabel(ride, "origin")}-${getDriverRidePointDisplayLabel(ride, "destination")}-${dateMs}`)}
                  className="rapago-driver-card"
                  style={{
                    margin: 0,
                    borderRadius: 20,
                    background: "var(--rp-surface)",
                    color: "var(--rp-text)",
                    border: "var(--rp-border-w) solid var(--rp-border-c)",
                  }}
                >
                  <IonCardContent style={{ padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 950, fontSize: ".94rem", lineHeight: 1.25 }}>
                          {getDriverRideRouteDisplayLabel(ride as unknown as Record<string, unknown>)}
                        </div>
                        <div style={{ marginTop: 5, color: "var(--rp-muted)", fontSize: ".74rem", fontWeight: 800 }}>
                          {dateMs ? new Date(dateMs).toLocaleString("es-CL") : "Fecha no informada"}
                        </div>
                        <div style={{ marginTop: 5, color: "var(--rp-muted)", fontSize: ".74rem", fontWeight: 800 }}>
                          {getRidePaymentMethodLabel(String(ride.notes ?? ""))} · {getRideTripTypeLabel(String(ride.notes ?? ""))}
                        </div>
                      </div>

                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <IonBadge color="success" style={{ fontWeight: 950 }}>
                          {formatClp(earning)}
                        </IonBadge>
                        <div style={{ marginTop: 6, color: "var(--rp-muted)", fontSize: ".72rem", fontWeight: 850 }}>
                          Precio {formatClp(fare)}
                        </div>
                      </div>
                    </div>
                  </IonCardContent>
                </IonCard>
              );
            })}
          </div>
        )}
      </IonContent>
      </IonPage>
    </>
  );
}

const LANGUAGE_OPTIONS: { value: string; label: string; emoji: string }[] = [
  { value: "es", label: "Español", emoji: "🇨🇱" },
  { value: "en", label: "Inglés", emoji: "🇺🇸" },
];

function normalizeDriverLanguages(
  values: string[] | null | undefined,
): string[] {
  const allowed = new Set(LANGUAGE_OPTIONS.map((item) => item.value));
  const cleaned = (values ?? []).filter((value) => allowed.has(value));
  return cleaned.length > 0 ? cleaned : ["es"];
}

function hasDriverProfilePhotoRemovalMarker(user?: unknown): boolean {
  return Boolean(
    readDriverScopedStorageItem(
      RAPAGO_DRIVER_PROFILE_PHOTO_REMOVED_AT_KEY,
      user,
    ),
  );
}

function markDriverProfilePhotoRemoved(user?: unknown): string {
  const removedAt = new Date().toISOString();
  writeDriverScopedStorageItem(
    RAPAGO_DRIVER_PROFILE_PHOTO_REMOVED_AT_KEY,
    removedAt,
    user,
  );
  return removedAt;
}

function clearDriverProfilePhotoRemovalMarker(user?: unknown): void {
  removeDriverScopedStorageItem(
    RAPAGO_DRIVER_PROFILE_PHOTO_REMOVED_AT_KEY,
    user,
  );
}

function isLocalDriverProfilePhoto(value: unknown): boolean {
  return String(value ?? "").trim().startsWith("data:image/");
}

function getPreferredDriverProfilePhoto(
  profile: DriverProfileData | null,
  user?: unknown,
): string {
  if (hasDriverProfilePhotoRemovalMarker(user)) return "";

  const localPhoto = getStoredDriverProfilePhotoUrl(user);
  const serverPhoto = String(profile?.profilePhotoUrl ?? "").trim();

  // Las imágenes elegidas por el usuario se guardan como data:image y deben
  // sobrevivir a cerrar sesión/cambiar de cuenta en este mismo dispositivo.
  if (isLocalDriverProfilePhoto(localPhoto)) return localPhoto;

  return serverPhoto || localPhoto;
}

async function clearDriverProfilePhotoOnServer(
  accessToken: string,
): Promise<boolean> {
  try {
    await driverProfileService.upsertMyProfile(
      accessToken,
      { profilePhotoUrl: null } as unknown as Parameters<
        typeof driverProfileService.upsertMyProfile
      >[1],
    );
    return true;
  } catch {
    try {
      await driverProfileService.upsertMyProfile(accessToken, {
        profilePhotoUrl: "",
      });
      return true;
    } catch (error) {
      console.warn(
        "La foto se eliminó localmente, pero el backend no confirmó el borrado.",
        error,
      );
      return false;
    }
  }
}

function getStoredDriverProfilePhotoUrl(user?: unknown): string {
  try {
    if (hasDriverProfilePhotoRemovalMarker(user)) return "";

    const keys = [
      RAPAGO_DRIVER_CANONICAL_PROFILE_PHOTO_KEY,
      "rapago_driver_profile_image_data_url",
      "rapago_driver_profile_photo_url",
      "rapago_driver_profile_image",
      "rapago_driver_photo",
      "rapago_profile_photo",
      "rapago_user_profile_photo",
      "rapago_driver_avatar_data_url",
      "rapago_public_driver_profile_photo",
      "rapago_public_driver_profile_image_data_url",
    ];

    for (const key of keys) {
      const value = readDriverScopedStorageItem(key, user);
      if (value && value.trim()) return value.trim();
    }

    const profileRaw =
      readDriverScopedStorageItem("rapago_driver_public_profile_v1", user) ??
      readDriverScopedStorageItem("rapago_driver_public_snapshot_v1", user);

    if (profileRaw) {
      const profile = JSON.parse(profileRaw) as Record<string, unknown>;
      const sameOwner =
        !user ||
        getDriverScopedOwnerKey(profile) === getDriverScopedOwnerKey(user);

      if (sameOwner) {
        const photo = String(
          profile.driverProfileImageDataUrl ??
            profile.driverProfilePhotoUrl ??
            profile.profilePhotoUrl ??
            profile.profileImageDataUrl ??
            profile.profilePhotoDataUrl ??
            profile.driverPhotoUrl ??
            profile.driverPhotoDataUrl ??
            profile.avatarDataUrl ??
            "",
        ).trim();
        if (photo) return photo;
      }
    }
  } catch {
    // No bloquea el perfil.
  }

  return "";
}

function persistStoredDriverProfilePhotoUrl(value: string, user?: unknown): void {
  try {
    const clean = value.trim();
    const profileKeys = [
      RAPAGO_DRIVER_CANONICAL_PROFILE_PHOTO_KEY,
      "rapago_driver_profile_image_data_url",
      "rapago_driver_profile_photo_url",
      "rapago_driver_profile_image",
      "rapago_driver_photo",
      "rapago_profile_photo",
      "rapago_user_profile_photo",
      "rapago_driver_avatar_data_url",
      "rapago_public_driver_profile_photo",
      "rapago_public_driver_profile_image_data_url",
    ];

    if (clean) {
      const profilePhotoUpdatedAt = new Date().toISOString();
      clearDriverProfilePhotoRemovalMarker(user);

      for (const key of profileKeys) {
        writeDriverScopedStorageItem(key, clean, user);
      }

      writeDriverScopedStorageItem("rapago_driver_profile_photo_updated_at", profilePhotoUpdatedAt, user);
      writeDriverScopedStorageItem("rapago_driver_profile_updated_at", profilePhotoUpdatedAt, user);
      writeDriverScopedStorageItem("rapago_public_driver_profile_photo_updated_at", profilePhotoUpdatedAt, user);

      window.dispatchEvent(new CustomEvent("rapago:driver-public-profile-updated", {
        detail: {
          ownerKey: getDriverScopedOwnerKey(user),
          driverOwnerKey: getDriverScopedOwnerKey(user),
          driverEmail: getDriverLiveUserField(user, "email"),
          driverName: getDriverLiveUserField(user, "name") ?? getDriverLiveUserField(user, "fullName"),
          driverProfilePhotoUrl: clean,
          driverProfileImageDataUrl: clean,
          profilePhotoUpdatedAt,
          driverProfilePhotoUpdatedAt: profilePhotoUpdatedAt,
          updatedAt: profilePhotoUpdatedAt,
        },
      }));
      window.dispatchEvent(new CustomEvent("rapago:passenger-rides-updated"));
    } else {
      const profilePhotoRemovedAt = markDriverProfilePhotoRemoved(user);

      for (const key of profileKeys) {
        removeDriverScopedStorageItem(key, user);
      }

      // Conservamos una fecha de actualización posterior a la foto antigua.
      // Así las vistas del pasajero no vuelven a escoger una copia obsoleta.
      writeDriverScopedStorageItem(
        "rapago_driver_profile_photo_updated_at",
        profilePhotoRemovedAt,
        user,
      );
      writeDriverScopedStorageItem(
        "rapago_driver_profile_updated_at",
        profilePhotoRemovedAt,
        user,
      );
      writeDriverScopedStorageItem(
        "rapago_public_driver_profile_photo_updated_at",
        profilePhotoRemovedAt,
        user,
      );

      window.dispatchEvent(new CustomEvent("rapago:driver-public-profile-updated", {
        detail: {
          ownerKey: getDriverScopedOwnerKey(user),
          driverOwnerKey: getDriverScopedOwnerKey(user),
          driverEmail: getDriverLiveUserField(user, "email"),
          driverProfilePhotoUrl: null,
          driverProfileImageDataUrl: null,
          profilePhotoUrl: null,
          profileImageDataUrl: null,
          profilePhotoDataUrl: null,
          driverPhotoUrl: null,
          driverPhotoDataUrl: null,
          avatarDataUrl: null,
          profilePhotoRemoved: true,
          profilePhotoRemovedAt,
          profilePhotoUpdatedAt: profilePhotoRemovedAt,
          driverProfilePhotoUpdatedAt: profilePhotoRemovedAt,
          updatedAt: profilePhotoRemovedAt,
        },
      }));
      window.dispatchEvent(new CustomEvent("rapago:passenger-rides-updated"));
    }
  } catch {
    // No bloquea el perfil si localStorage no está disponible.
  }
}

function getStoredDriverVehicleImageDataUrl(user?: unknown): string {
  try {
    const keys = [
      RAPAGO_DRIVER_CANONICAL_VEHICLE_IMAGE_KEY,
      "rapago_driver_vehicle_photo",
      "rapago_vehicle_photo_data_url",
    ];

    for (const key of keys) {
      const value = readDriverScopedStorageItem(key, user);
      if (value && value.trim()) return value.trim();
    }

    return "";
  } catch {
    return "";
  }
}

function getStoredDriverVehicleImageName(user?: unknown): string {
  try {
    return readDriverScopedStorageItem("rapago_driver_vehicle_image_name", user) ?? "";
  } catch {
    return "";
  }
}

function persistStoredDriverVehicleImageDataUrl(
  value: string,
  imageName?: string | null,
  user?: unknown,
): void {
  try {
    const clean = value.trim();

    if (clean) {
      writeDriverScopedStorageItem(RAPAGO_DRIVER_CANONICAL_VEHICLE_IMAGE_KEY, clean, user);
    } else {
      removeDriverScopedStorageItem(RAPAGO_DRIVER_CANONICAL_VEHICLE_IMAGE_KEY, user);
    }

    if (imageName?.trim()) {
      writeDriverScopedStorageItem("rapago_driver_vehicle_image_name", imageName.trim(), user);
    } else if (!clean) {
      removeDriverScopedStorageItem("rapago_driver_vehicle_image_name", user);
    }
  } catch {
    // No bloquea el perfil si localStorage no está disponible.
  }
}

function publishDriverProfileVehicleSnapshot(input: {
  user?: unknown;
  phone?: string | null;
  vehicle?: DriverVehicleRecord | null;
}): void {
  try {
    const vehicle = input.vehicle ?? readSelectedDriverVehicle(input.user);
    const now = new Date().toISOString();
    const snapshot = {
      ...(vehicle ?? {}),
      ...getDriverVehiclePublicPayload(input.user),
      ...buildDriverResidentFarePayload(input.user),
      imageDataUrl: vehicle?.imageDataUrl ?? getStoredDriverVehicleImageDataUrl(input.user) ?? null,
      vehicleImageDataUrl: vehicle?.imageDataUrl ?? getStoredDriverVehicleImageDataUrl(input.user) ?? null,
      vehiclePhotoDataUrl: vehicle?.imageDataUrl ?? getStoredDriverVehicleImageDataUrl(input.user) ?? null,
      driverVehicleImageDataUrl: vehicle?.imageDataUrl ?? getStoredDriverVehicleImageDataUrl(input.user) ?? null,
      driverProfileImageDataUrl: getStoredDriverProfilePhotoUrl(input.user) || null,
      driverProfilePhotoUrl: getStoredDriverProfilePhotoUrl(input.user) || null,
      profilePhotoUrl: getStoredDriverProfilePhotoUrl(input.user) || null,
      profileImageDataUrl: getStoredDriverProfilePhotoUrl(input.user) || null,
      profilePhotoDataUrl: getStoredDriverProfilePhotoUrl(input.user) || null,
      driverPhotoUrl: getStoredDriverProfilePhotoUrl(input.user) || null,
      driverPhotoDataUrl: getStoredDriverProfilePhotoUrl(input.user) || null,
      avatarDataUrl: getStoredDriverProfilePhotoUrl(input.user) || null,
      driverName:
        getDriverLiveUserField(input.user, "name") ??
        getDriverLiveUserField(input.user, "fullName") ??
        getDriverLiveUserField(input.user, "email") ??
        "Conductor Rapa Go",
      driverFullName:
        getDriverLiveUserField(input.user, "fullName") ??
        getDriverLiveUserField(input.user, "name") ??
        "Conductor Rapa Go",
      driverEmail: getDriverLiveUserField(input.user, "email"),
      driverPhone: input.phone?.trim() || getStoredDriverPublicPhone(input.user),
      updatedAt: now,
      driverProfileUpdatedAt: now,
      driverProfilePhotoUpdatedAt: now,
      profilePhotoUpdatedAt: now,
      photoUpdatedAt: now,
    };

    publishDriverVehicleSnapshotToStorage(snapshot as Record<string, unknown>);
    writeDriverScopedStorageItem("rapago_driver_public_phone", String(snapshot.driverPhone ?? ""), input.user);

    window.dispatchEvent(new CustomEvent("rapago:driver-public-profile-updated", { detail: snapshot }));
    window.dispatchEvent(new CustomEvent("rapago:driver-selected-vehicle-updated", { detail: snapshot }));
    window.dispatchEvent(new CustomEvent("rapago:driver-accepted-vehicle-updated", { detail: { ride: snapshot } }));
    window.dispatchEvent(new CustomEvent("rapago:passenger-rides-updated"));
  } catch {
    // No bloquea el guardado del perfil.
  }
}

function isLicenseExpiringSoon(expiry: string | null): boolean {
  if (!expiry) return false;
  const expiryDate = new Date(expiry);
  const diff = expiryDate.getTime() - Date.now();
  return diff >= 0 && diff < 30 * 24 * 60 * 60 * 1000;
}

function isLicenseExpired(expiry: string | null): boolean {
  if (!expiry) return false;
  return new Date(expiry).getTime() < Date.now();
}

type StoredDriverRegistrationProfile = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  rut?: string | null;
  vehicleBrand?: string | null;
  vehicleModel?: string | null;
  vehicleYear?: string | number | null;
  vehiclePlate?: string | null;
  vehicleColor?: string | null;
  vehicleImageDataUrl?: string | null;
  vehicleImageName?: string | null;
  licenseNumber?: string | null;
  passengerFareType?: DriverPassengerFareType | string | null;
  farePassengerType?: DriverPassengerFareType | string | null;
  passengerType?: DriverPassengerFareType | string | null;
  passengerFareLabel?: string | null;
  nationality?: string | null;
  isResident?: boolean | string | null;
  driverPassengerFareType?: DriverPassengerFareType | string | null;
  driverNationality?: string | null;
  driverIsResident?: boolean | string | null;
  residenceVerificationStatus?: string | null;
};

function readStoredDriverRegistrationProfile(user?: unknown): StoredDriverRegistrationProfile {
  try {
    const scopedRaw = readDriverScopedStorageItem("rapago_driver_registration_profile", user);
    const legacyRaw =
      scopedRaw ??
      (canUseDriverLegacyStorage("rapago_driver_registration_profile", user)
        ? localStorage.getItem("rapago_driver_registration_profile")
        : null) ??
      (canUseDriverLegacyStorage("rapago_registration_profile", user)
        ? localStorage.getItem("rapago_registration_profile")
        : null);

    const parsed = legacyRaw
      ? (JSON.parse(legacyRaw) as StoredDriverRegistrationProfile)
      : {};

    const parsedOwner = getDriverScopedOwnerKey(parsed);
    const expectedOwner = getDriverScopedOwnerKey(user);

    // Si el perfil antiguo pertenece explícitamente a otro conductor, se ignora.
    if (
      user &&
      typeof user === "object" &&
      parsedOwner !== "driver-global" &&
      parsedOwner !== expectedOwner
    ) {
      return {};
    }

    return {
      ...parsed,
      phone:
        parsed.phone ??
        readDriverScopedStorageItem("rapago_profile_phone", user) ??
        readDriverScopedStorageItem("rapago_driver_phone", user),
      rut:
        parsed.rut ??
        readDriverScopedStorageItem("rapago_profile_rut", user) ??
        readDriverScopedStorageItem("rapago_driver_rut", user),
      vehicleImageDataUrl:
        parsed.vehicleImageDataUrl ??
        getStoredDriverVehicleImageDataUrl(user),
      vehicleImageName:
        parsed.vehicleImageName ??
        getStoredDriverVehicleImageName(user),
    };
  } catch {
    return {};
  }
}

function persistStoredDriverRegistrationProfile(
  data: Partial<StoredDriverRegistrationProfile>,
  user?: unknown,
): void {
  try {
    const current = readStoredDriverRegistrationProfile(user);
    const ownerKey = getDriverScopedOwnerKey(user ?? data);
    const next = {
      ...current,
      ...data,
      ownerKey,
      driverOwnerKey: ownerKey,
      email: data.email ?? current.email ?? getDriverLiveUserField(user, "email"),
      name: data.name ?? current.name ?? getDriverLiveUserField(user, "name") ?? getDriverLiveUserField(user, "fullName"),
    };

    const payload = JSON.stringify(next);
    writeDriverScopedStorageItem("rapago_driver_registration_profile", payload, next);
    writeDriverScopedStorageItem("rapago_registration_profile", payload, next);

    if (next.phone) {
      writeDriverScopedStorageItem("rapago_profile_phone", String(next.phone), next);
      writeDriverScopedStorageItem("rapago_driver_phone", String(next.phone), next);
      writeDriverScopedStorageItem("rapago_driver_public_phone", String(next.phone), next);
    }

    if (next.rut) {
      writeDriverScopedStorageItem("rapago_profile_rut", String(next.rut), next);
      writeDriverScopedStorageItem("rapago_driver_rut", String(next.rut), next);
    }

    const fareType =
      normalizeDriverPassengerFareType(next.farePassengerType) ??
      normalizeDriverPassengerFareType(next.passengerFareType) ??
      normalizeDriverPassengerFareType(next.driverPassengerFareType) ??
      normalizeDriverPassengerFareType(next.passengerType) ??
      normalizeDriverPassengerFareType(next.nationality) ??
      normalizeDriverPassengerFareType(next.passengerFareLabel) ??
      normalizeDriverPassengerFareType(next.isResident);

    if (fareType) {
      const label = getDriverPassengerFareTypeLabel(fareType);
      writeDriverScopedStorageItem("rapago_driver_passenger_fare_type", fareType, next);
      writeDriverScopedStorageItem("rapago_driver_fare_passenger_type", fareType, next);
      writeDriverScopedStorageItem("rapago_driver_nationality", label, next);
      writeDriverScopedStorageItem("rapago_driver_is_resident", String(fareType === "resident"), next);

      // Solo se escribe en llaves de pasajero si este conductor está usando también modo pasajero.
      if (fareType === "resident") {
        writeDriverScopedStorageItem("rapago_passenger_fare_type", "resident", next);
        writeDriverScopedStorageItem("rapago_profile_passenger_type", "resident", next);
        writeDriverScopedStorageItem("rapago_fare_passenger_type", "resident", next);
        writeDriverScopedStorageItem("rapago_profile_nationality", label, next);
      }
    }

    if (next.vehicleImageDataUrl) {
      persistStoredDriverVehicleImageDataUrl(
        String(next.vehicleImageDataUrl),
        next.vehicleImageName ? String(next.vehicleImageName) : null,
        next,
      );
    }
  } catch {
    // No bloquea el perfil si localStorage no está disponible.
  }
}

function getSessionPhone(user: unknown): string {
  if (!user || typeof user !== "object") return "";
  const value = (user as { phone?: string | null }).phone;
  return typeof value === "string" ? value.trim() : "";
}

function getAutoDriverPhone(
  sessionUser: unknown,
  profilePhone?: string | null,
): string {
  const stored = readStoredDriverRegistrationProfile(sessionUser);

  return (
    profilePhone?.trim() ||
    getSessionPhone(sessionUser) ||
    stored.phone?.trim() ||
    ""
  );
}

function driverFormCardStyle(extra?: CSSProperties): CSSProperties {
  return {
    margin: "0 0 14px",
    borderRadius: "22px",
    background: "var(--rp-surface)",
    color: "var(--rp-text)",
    border: "var(--rp-border-w) solid var(--rp-border-c)",
    boxShadow: "var(--rp-shadow)",
    overflow: "hidden",
    ...extra,
  };
}

function driverInputItemStyle(): CSSProperties {
  return {
    "--background": "var(--rp-field-bg)",
    "--color": "var(--rp-field-fg)",
    "--placeholder-color": "var(--rp-field-ph)",
    "--placeholder-opacity": "1",
    "--highlight-color-focused": "var(--rp-accent)",
    "--border-color": "var(--rp-border-c)",
    "--border-radius": "16px",
    "--padding-start": "14px",
    "--inner-padding-end": "14px",
    marginTop: "10px",
    border: "var(--rp-border-w) solid var(--rp-border-c)",
    borderRadius: "16px",
    overflow: "hidden",
    fontWeight: 900,
  } as CSSProperties;
}

function driverFieldTextStyle(): CSSProperties {
  return {
    color: "var(--rp-field-fg)",
    fontWeight: 950,
    fontSize: ".95rem",
    opacity: 1,
    "--color": "var(--rp-field-fg)",
    "--placeholder-color": "var(--rp-field-ph)",
    "--placeholder-opacity": "1",
  } as CSSProperties;
}

function driverFieldLabelStyle(): CSSProperties {
  return {
    color: "var(--rp-label)",
    fontWeight: 950,
    fontSize: ".78rem",
    opacity: 1,
  };
}

function safeProfileMessage(message: string | null): string | null {
  if (!message) return null;

  if (
    message.toLowerCase().includes("token") ||
    message.toLowerCase().includes("sesión expir") ||
    message.toLowerCase().includes("unauthorized") ||
    message.includes("401")
  ) {
    return "No se pudo cargar el perfil desde el servidor. La sesión sigue abierta.";
  }

  return message;
}

export function DriverProfilePage(): JSX.Element {
  const auth = useAuth() as ReturnType<typeof useAuth> & {
    logout?: () => void | Promise<void>;
    signOut?: () => void | Promise<void>;
  };

  const { session } = auth;
  const { theme } = useRapagoSectionTheme("driver-profile");
  const history = useHistory();

  const storedProfile = readStoredDriverRegistrationProfile(session?.user);

  const [phone, setPhone] = useState("");
  const [vehicleBrand, setVehicleBrand] = useState(
    String(storedProfile.vehicleBrand ?? ""),
  );
  const [vehicleModel, setVehicleModel] = useState(
    String(storedProfile.vehicleModel ?? ""),
  );
  const [vehicleYear, setVehicleYear] = useState(
    storedProfile.vehicleYear != null ? String(storedProfile.vehicleYear) : "",
  );
  const [vehiclePlate, setVehiclePlate] = useState(
    String(storedProfile.vehiclePlate ?? ""),
  );
  const [vehicleColor, setVehicleColor] = useState(
    String(storedProfile.vehicleColor ?? ""),
  );
  const [vehicleImageDataUrl, setVehicleImageDataUrl] = useState(
    String(storedProfile.vehicleImageDataUrl ?? getStoredDriverVehicleImageDataUrl(session?.user)),
  );
  const [vehicleImageName, setVehicleImageName] = useState(
    String(storedProfile.vehicleImageName ?? ""),
  );
  const [vehiclePhotoError, setVehiclePhotoError] = useState<string | null>(null);
  const vehiclePhotoFileRef = useRef<HTMLInputElement | null>(null);
  const [uploadingVehiclePhoto, setUploadingVehiclePhoto] = useState(false);
  const vehicleDraftDirtyRef = useRef(false);
  const vehiclePhotoPickerOpenRef = useRef(false);
  const uploadingVehiclePhotoRef = useRef(false);
  const vehiclePhotoUploadSequenceRef = useRef(0);
  const [licenseNumber, setLicenseNumber] = useState(
    String(storedProfile.licenseNumber ?? ""),
  );
  const [licenseExpiry, setLicenseExpiry] = useState("");
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(
    getStoredDriverProfilePhotoUrl(session?.user),
  );
  const [photoError, setPhotoError] = useState<string | null>(null);
  const profilePhotoFileRef = useRef<HTMLInputElement | null>(null);
  const profilePhotoUserEditedRef = useRef(false);
  const activeDriverProfileOwnerKey = session?.user
    ? getDriverScopedOwnerKey(session.user)
    : "driver-no-session";
  const [bio, setBio] = useState("");
  const [languages, setLanguages] = useState<string[]>(["es"]);
  const [driverVehicles, setDriverVehicles] = useState<DriverVehicleRecord[]>(() =>
    readDriverVehicles(session?.user),
  );
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(() =>
    readSelectedDriverVehicleId(session?.user),
  );
  const [vehicleOwnership, setVehicleOwnership] = useState<DriverVehicleOwnership>("own");
  const [vehicleExpiresAt, setVehicleExpiresAt] = useState("");
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [vehicleSaveMessage, setVehicleSaveMessage] = useState<string | null>(null);
  const [vehicleFormError, setVehicleFormError] = useState<string | null>(null);
  const [vehicleDraftDirty, setVehicleDraftDirty] = useState(false);
  const [savingVehicle, setSavingVehicle] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [driverRatingSummary, setDriverRatingSummary] = useState<DriverRatingSummary>(() =>
    readDriverRatingSummary(session?.user, phone),
  );

  useEffect(() => {
    vehicleDraftDirtyRef.current = vehicleDraftDirty;
  }, [vehicleDraftDirty]);

  useEffect(() => {
    // Ionic puede mantener la página montada al cerrar sesión. Al cambiar de
    // cuenta limpiamos inmediatamente la foto anterior y cargamos solo la que
    // pertenece al nuevo conductor.
    profilePhotoUserEditedRef.current = false;
    vehicleDraftDirtyRef.current = false;
    vehiclePhotoPickerOpenRef.current = false;
    uploadingVehiclePhotoRef.current = false;
    vehiclePhotoUploadSequenceRef.current += 1;
    setVehicleDraftDirty(false);
    setUploadingVehiclePhoto(false);
    setVehiclePhotoError(null);
    setPhotoError(null);
    setProfilePhotoUrl(
      session?.user
        ? getStoredDriverProfilePhotoUrl(session.user)
        : "",
    );
  }, [activeDriverProfileOwnerKey]);

  const loadProfile = useCallback(async () => {
    if (!session?.accessToken) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      persistDriverResidentFareForDriver(session.user);

      const profile = await driverProfileService.getMyProfile(
        session.accessToken,
      );
      hydrateApprovedDriverProfileLocally(profile, session.user);
      const autoPhone = getAutoDriverPhone(session.user, profile?.phone);

      const selectedVehicle = readSelectedDriverVehicle(session.user);
      const currentVehicles = readDriverVehicles(session.user);
      const latestStoredProfile = readStoredDriverRegistrationProfile(session.user);
      setDriverVehicles(currentVehicles);
      setSelectedVehicleId(readSelectedDriverVehicleId(session.user));

      // Volver desde el selector de archivos puede disparar un re-render de la
      // sesión. Nunca se debe hidratar el perfil encima de un formulario que el
      // conductor está editando o de una foto que todavía se está subiendo.
      const preserveVehicleDraft =
        vehicleDraftDirtyRef.current ||
        vehiclePhotoPickerOpenRef.current ||
        uploadingVehiclePhotoRef.current;

      if (!preserveVehicleDraft) {
        if (selectedVehicle) {
          setEditingVehicleId(selectedVehicle.id);
          setVehicleBrand(selectedVehicle.brand);
          setVehicleModel(selectedVehicle.model);
          setVehicleYear(String(selectedVehicle.year ?? ""));
          setVehiclePlate(selectedVehicle.plate);
          setVehicleColor(selectedVehicle.color);
          setVehicleImageDataUrl(
            selectedVehicle.imageDataUrl ??
              String(latestStoredProfile.vehicleImageDataUrl ?? getStoredDriverVehicleImageDataUrl(session.user)),
          );
          setVehicleImageName(
            selectedVehicle.imageName ?? String(latestStoredProfile.vehicleImageName ?? ""),
          );
          setVehicleOwnership(selectedVehicle.ownership);
          setVehicleExpiresAt(
            selectedVehicle.expiresAt ? selectedVehicle.expiresAt.slice(0, 10) : "",
          );
        } else if (profile) {
          setVehicleBrand(
            profile.vehicleBrand ?? String(latestStoredProfile.vehicleBrand ?? ""),
          );
          setVehicleModel(
            profile.vehicleModel ?? String(latestStoredProfile.vehicleModel ?? ""),
          );
          setVehicleYear(
            profile.vehicleYear != null
              ? String(profile.vehicleYear)
              : String(latestStoredProfile.vehicleYear ?? ""),
          );
          setVehiclePlate(
            profile.vehiclePlate ?? String(latestStoredProfile.vehiclePlate ?? ""),
          );
          setVehicleColor(
            profile.vehicleColor ?? String(latestStoredProfile.vehicleColor ?? ""),
          );
          setVehicleImageDataUrl(
            profile.vehiclePhotoUrl ??
              String(latestStoredProfile.vehicleImageDataUrl ?? getStoredDriverVehicleImageDataUrl(session.user)),
          );
          setVehicleImageName(String(latestStoredProfile.vehicleImageName ?? ""));
        } else {
          setVehicleImageDataUrl(
            String(latestStoredProfile.vehicleImageDataUrl ?? getStoredDriverVehicleImageDataUrl(session.user)),
          );
          setVehicleImageName(String(latestStoredProfile.vehicleImageName ?? ""));
        }

        vehicleDraftDirtyRef.current = false;
        setVehicleDraftDirty(false);
        setVehicleSaveMessage(null);
      }
      setPhone(autoPhone);
      setLicenseNumber(
        profile?.licenseNumber ?? String(storedProfile.licenseNumber ?? ""),
      );
      setLicenseExpiry(profile?.licenseExpiry ?? "");
      if (!profilePhotoUserEditedRef.current) {
        setProfilePhotoUrl(
          getPreferredDriverProfilePhoto(profile, session.user),
        );
      }
      setBio(profile?.bio ?? "");
      setLanguages(profile ? normalizeDriverLanguages(profile.languages) : ["es"]);

      if (autoPhone) {
        persistStoredDriverRegistrationProfile({
          phone: autoPhone,
          email: session.user?.email ?? null,
          name: session.user?.name ?? null,
        }, session.user);
      }
    } catch (err) {
      const fallbackPhone = getAutoDriverPhone(session.user, null);
      setPhone(fallbackPhone);

      if (fallbackPhone) {
        persistStoredDriverRegistrationProfile({
          phone: fallbackPhone,
          email: session.user?.email ?? null,
          name: session.user?.name ?? null,
        }, session.user);
      }

      const message =
        err instanceof Error ? err.message : "Error al cargar perfil.";
      setError(safeProfileMessage(message));
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, activeDriverProfileOwnerKey]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    const refreshRatings = () => {
      setDriverRatingSummary(readDriverRatingSummary(session?.user, phone));
    };

    refreshRatings();
    window.addEventListener(RAPAGO_DRIVER_RATINGS_EVENT, refreshRatings as EventListener);
    window.addEventListener("rapago:driver-profile-updated", refreshRatings as EventListener);
    window.addEventListener("storage", refreshRatings as EventListener);

    return () => {
      window.removeEventListener(RAPAGO_DRIVER_RATINGS_EVENT, refreshRatings as EventListener);
      window.removeEventListener("rapago:driver-profile-updated", refreshRatings as EventListener);
      window.removeEventListener("storage", refreshRatings as EventListener);
    };
  }, [session?.user, phone]);

  function getCurrentEditingVehicle(): DriverVehicleRecord | null {
    if (!editingVehicleId) return null;

    return (
      readDriverVehicles(session?.user).find(
        (vehicle) => vehicle.id === editingVehicleId,
      ) ?? null
    );
  }

  function validateVehicleDraft(
    requirePhoto: boolean,
    imageDataUrlOverride?: string,
  ): string | null {
    const brand = vehicleBrand.trim();
    const model = vehicleModel.trim();
    const plate = vehiclePlate.trim();
    const year = vehicleYear.trim();
    const image = (imageDataUrlOverride ?? vehicleImageDataUrl).trim();

    if (!brand) return "Debes escribir la marca del vehículo.";
    if (!model) return "Debes escribir el modelo del vehículo.";
    if (!plate) return "Debes escribir la patente del vehículo.";

    if (year) {
      const parsedYear = Number(year);
      const maxYear = new Date().getFullYear() + 1;

      if (
        !Number.isInteger(parsedYear) ||
        parsedYear < 1950 ||
        parsedYear > maxYear
      ) {
        return `El año debe estar entre 1950 y ${maxYear}.`;
      }
    }

    if (vehicleOwnership === "borrowed") {
      if (!vehicleExpiresAt.trim()) {
        return "El vehículo opcional debe tener una fecha de expiración.";
      }

      const expirationMs = new Date(`${vehicleExpiresAt}T23:59:59`).getTime();
      if (!Number.isFinite(expirationMs) || expirationMs <= Date.now()) {
        return "La fecha de expiración del vehículo opcional debe ser futura.";
      }
    }

    if (requirePhoto && !image) {
      return "Debes adjuntar la foto correspondiente a este vehículo.";
    }

    return null;
  }

  function saveVehicleDraftLocally(input?: {
    requirePhoto?: boolean;
    showSuccess?: boolean;
    imageDataUrlOverride?: string;
  }): DriverVehicleRecord | null {
    const finalVehicleImageDataUrl = (
      input?.imageDataUrlOverride ?? vehicleImageDataUrl
    ).trim();
    const validationError = validateVehicleDraft(
      input?.requirePhoto ?? true,
      finalVehicleImageDataUrl,
    );

    setVehicleFormError(validationError);
    setVehicleSaveMessage(null);
    setSuccess(false);

    if (validationError) return null;

    const existing = getCurrentEditingVehicle();
    const savedVehicle = addDriverVehicle({
      user: session?.user,
      vehicleId: existing?.id ?? editingVehicleId,
      createdAt: existing?.createdAt ?? null,
      primary: existing?.primary ?? null,
      ownership: vehicleOwnership,
      brand: vehicleBrand,
      model: vehicleModel,
      year: vehicleYear,
      plate: vehiclePlate,
      color: vehicleColor,
      expiresAt: vehicleOwnership === "borrowed" ? vehicleExpiresAt : null,
      imageDataUrl: finalVehicleImageDataUrl || null,
      imageName: vehicleImageName.trim() || null,
    });

    if (!savedVehicle) {
      setVehicleFormError(
        "No se pudo guardar el vehículo. Revisa marca, modelo y patente.",
      );
      return null;
    }

    persistStoredDriverVehicleImageDataUrl(
      savedVehicle.imageDataUrl ?? "",
      savedVehicle.imageName ?? null,
      session?.user,
    );

    persistStoredDriverRegistrationProfile(
      {
        phone: phone.trim(),
        email: session?.user?.email ?? null,
        name: session?.user?.name ?? null,
        vehicleBrand: savedVehicle.brand,
        vehicleModel: savedVehicle.model,
        vehicleYear: savedVehicle.year ?? "",
        vehiclePlate: savedVehicle.plate,
        vehicleColor: savedVehicle.color,
        vehicleImageDataUrl: savedVehicle.imageDataUrl ?? "",
        vehicleImageName: savedVehicle.imageName ?? "",
        licenseNumber: licenseNumber.trim(),
      },
      session?.user,
    );

    writeSelectedDriverVehicleId(savedVehicle.id, session?.user);
    setEditingVehicleId(savedVehicle.id);
    setSelectedVehicleId(savedVehicle.id);
    setDriverVehicles(readDriverVehicles(session?.user));
    setVehicleBrand(savedVehicle.brand);
    setVehicleModel(savedVehicle.model);
    setVehicleYear(String(savedVehicle.year ?? ""));
    setVehiclePlate(savedVehicle.plate);
    setVehicleColor(savedVehicle.color);
    setVehicleImageDataUrl(savedVehicle.imageDataUrl ?? "");
    setVehicleImageName(savedVehicle.imageName ?? "");
    setVehicleExpiresAt(
      savedVehicle.expiresAt ? savedVehicle.expiresAt.slice(0, 10) : "",
    );
    vehicleDraftDirtyRef.current = false;
    setVehicleDraftDirty(false);

    publishDriverProfileVehicleSnapshot({
      user: session?.user,
      phone: phone.trim(),
      vehicle: savedVehicle,
    });

    window.dispatchEvent(new CustomEvent("rapago:driver-vehicles-updated"));
    window.dispatchEvent(
      new CustomEvent("rapago:driver-selected-vehicle-updated"),
    );
    window.dispatchEvent(new CustomEvent("rapago:driver-public-profile-updated"));
    window.dispatchEvent(new CustomEvent("rapago:passenger-rides-updated"));

    if (input?.showSuccess ?? true) {
      setVehicleSaveMessage(
        savedVehicle.ownership === "borrowed"
          ? "Vehículo opcional creado y guardado con su foto."
          : existing
            ? "Vehículo actualizado correctamente."
            : "Vehículo propio creado y guardado correctamente.",
      );
      setSuccess(true);
    }

    return savedVehicle;
  }

  async function ensureVehiclePhotoUploaded(
    imageValue: string,
    imageName: string,
  ): Promise<string> {
    const cleanImage = imageValue.trim();
    if (!cleanImage.startsWith("data:image/")) return cleanImage;

    if (!session?.accessToken) {
      throw new Error(
        "Tu sesión no está disponible. Vuelve a iniciar sesión para subir la foto.",
      );
    }

    const sequence = ++vehiclePhotoUploadSequenceRef.current;
    uploadingVehiclePhotoRef.current = true;
    setUploadingVehiclePhoto(true);
    setVehiclePhotoError(null);

    try {
      const result = await driverVehiclePhotoService.uploadMyVehiclePhoto(
        session.accessToken,
        {
          dataUrl: cleanImage,
          fileName: imageName || "vehiculo.jpg",
          vehicleId: editingVehicleId ?? undefined,
          ownership: vehicleOwnership,
        },
      );

      if (sequence !== vehiclePhotoUploadSequenceRef.current) {
        throw new Error("La selección de foto cambió durante la carga.");
      }

      return result.publicUrl;
    } finally {
      if (sequence === vehiclePhotoUploadSequenceRef.current) {
        uploadingVehiclePhotoRef.current = false;
        setUploadingVehiclePhoto(false);
      }
    }
  }

  async function handleSaveVehicleOnly(): Promise<void> {
    setSavingVehicle(true);
    setError(null);
    setVehicleFormError(null);

    try {
      const validationError = validateVehicleDraft(true);
      if (validationError) {
        setVehicleFormError(validationError);
        return;
      }

      const uploadedVehicleImageUrl = await ensureVehiclePhotoUploaded(
        vehicleImageDataUrl,
        vehicleImageName,
      );

      setVehicleImageDataUrl(uploadedVehicleImageUrl);

      const savedVehicle = saveVehicleDraftLocally({
        requirePhoto: true,
        showSuccess: true,
        imageDataUrlOverride: uploadedVehicleImageUrl,
      });

      if (!savedVehicle) return;

      // El backend actual guarda los datos del vehículo propio activo. La foto
      // de cualquier vehículo, incluido el opcional, ya quedó en Supabase y su
      // URL pública queda asociada al registro local del vehículo.
      if (
        session?.accessToken &&
        savedVehicle.ownership === "own"
      ) {
        const payload: Parameters<
          typeof driverProfileService.upsertMyProfile
        >[1] = {
          vehicleBrand: savedVehicle.brand,
          vehicleModel: savedVehicle.model,
          vehiclePlate: savedVehicle.plate,
          vehicleColor: savedVehicle.color,
        };

        if (savedVehicle.year) {
          const parsedYear = Number(savedVehicle.year);
          if (Number.isFinite(parsedYear)) payload.vehicleYear = parsedYear;
        }

        try {
          await driverProfileService.upsertMyProfile(
            session.accessToken,
            payload,
          );
        } catch (backendError) {
          console.warn(
            "La foto quedó en Supabase, pero el perfil no actualizó sus datos:",
            backendError,
          );
        }
      }
    } catch (uploadError) {
      const message =
        uploadError instanceof Error
          ? uploadError.message
          : "No se pudo subir la foto del vehículo a Supabase.";
      setVehiclePhotoError(message);
      setVehicleFormError(
        "La foto no se guardó en Supabase. Reintenta antes de crear el vehículo.",
      );
      setVehicleSaveMessage(null);
    } finally {
      uploadingVehiclePhotoRef.current = false;
      setUploadingVehiclePhoto(false);
      setSavingVehicle(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);

    const lockedPhone = phone.trim();
    const cleanVehicleBrand = vehicleBrand.trim();
    const cleanVehicleModel = vehicleModel.trim();
    const cleanVehiclePlate = vehiclePlate.trim().toUpperCase();
    const cleanVehicleColor = vehicleColor.trim();
    const cleanVehicleYear = vehicleYear.trim();
    const cleanVehicleImageDataUrl = vehicleImageDataUrl.trim();
    const cleanVehicleImageName = vehicleImageName.trim();
    const cleanProfilePhotoUrl = profilePhotoUrl.trim();
    const profilePhotoWasRemoved = hasDriverProfilePhotoRemovalMarker(
      session?.user,
    );
    const lockedLicenseNumber = licenseNumber.trim();
    const cleanBio = bio.trim();
    const cleanLanguages = normalizeDriverLanguages(languages);

    if (vehicleOwnership === "borrowed" && !vehicleExpiresAt.trim()) {
      setError("El vehículo opcional o prestado debe tener fecha de expiración.");
      setSaving(false);
      return;
    }

    try {
      persistDriverResidentFareForDriver(session?.user);

      // Primero guardamos localmente. Así el botón funciona aunque el backend
      // rechace campos nuevos como foto base64 o el perfil aún no exista.
      if (cleanProfilePhotoUrl) {
        persistStoredDriverProfilePhotoUrl(cleanProfilePhotoUrl, session?.user);
      } else {
        persistStoredDriverProfilePhotoUrl("", session?.user);
      }

      persistStoredDriverVehicleImageDataUrl(
        cleanVehicleImageDataUrl,
        cleanVehicleImageName || null,
        session?.user,
      );

      persistStoredDriverRegistrationProfile({
        email: session?.user?.email ?? null,
        name: session?.user?.name ?? null,
        vehicleBrand: cleanVehicleBrand,
        vehicleModel: cleanVehicleModel,
        vehicleYear: cleanVehicleYear,
        vehiclePlate: cleanVehiclePlate,
        vehicleColor: cleanVehicleColor,
        vehicleImageDataUrl: cleanVehicleImageDataUrl,
        vehicleImageName: cleanVehicleImageName,
      }, session?.user);

      let savedVehicle: DriverVehicleRecord | null = null;

      // El vehículo principal del perfil se transforma en vehículo activo público.
      // Es el dato que leerá el pasajero cuando el conductor acepte un viaje.
      if (cleanVehicleBrand && cleanVehicleModel && cleanVehiclePlate) {
        const existingVehicle = getCurrentEditingVehicle();

        savedVehicle = addDriverVehicle({
          user: session?.user,
          vehicleId: existingVehicle?.id ?? editingVehicleId,
          createdAt: existingVehicle?.createdAt ?? null,
          primary: existingVehicle?.primary ?? null,
          ownership: vehicleOwnership,
          brand: cleanVehicleBrand,
          model: cleanVehicleModel,
          year: cleanVehicleYear,
          plate: cleanVehiclePlate,
          color: cleanVehicleColor,
          expiresAt: vehicleOwnership === "borrowed" ? vehicleExpiresAt : null,
          imageDataUrl: cleanVehicleImageDataUrl || null,
          imageName: cleanVehicleImageName || null,
        });

        if (savedVehicle) {
          setEditingVehicleId(savedVehicle.id);
          setVehicleSaveMessage(
            savedVehicle.ownership === "borrowed"
              ? "Vehículo opcional guardado correctamente."
              : "Vehículo guardado correctamente.",
          );
          setVehicleFormError(null);
          setVehicleDraftDirty(false);
        }
      }

      publishDriverProfileVehicleSnapshot({
        user: session?.user,
        phone: lockedPhone,
        vehicle: savedVehicle ?? readSelectedDriverVehicle(session?.user),
      });

      // Intentamos guardar también en backend, pero no dejamos que eso borre
      // el guardado local ni la foto del vehículo.
      if (session?.accessToken) {
        const payload: Parameters<
          typeof driverProfileService.upsertMyProfile
        >[1] = {};

        // El backend conserva los datos de identidad y licencia aprobados.
        // Este formulario solo actualiza información operativa del conductor.
        // El backend actual conserva el vehículo principal aprobado.
        // Los vehículos opcionales se guardan en la lista separada del conductor
        // y no deben reemplazar los datos del vehículo principal.
        if (vehicleOwnership === "own") {
          if (cleanVehicleBrand) payload.vehicleBrand = cleanVehicleBrand;
          if (cleanVehicleModel) payload.vehicleModel = cleanVehicleModel;
          if (cleanVehicleYear) {
            const parsedYear = parseInt(cleanVehicleYear, 10);
            if (Number.isFinite(parsedYear)) payload.vehicleYear = parsedYear;
          }
          if (cleanVehiclePlate) payload.vehiclePlate = cleanVehiclePlate;
          if (cleanVehicleColor) payload.vehicleColor = cleanVehicleColor;
        }

        if (cleanProfilePhotoUrl && !cleanProfilePhotoUrl.startsWith("data:")) {
          payload.profilePhotoUrl = cleanProfilePhotoUrl;
        }
        if (cleanBio) payload.bio = cleanBio;
        payload.languages = cleanLanguages;

        try {
          await driverProfileService.upsertMyProfile(session.accessToken, payload);

          if (profilePhotoWasRemoved) {
            await clearDriverProfilePhotoOnServer(session.accessToken);
          }
        } catch (backendError) {
          // El perfil y la decisión de quitar/cambiar la foto quedan guardados
          // por conductor en este dispositivo aunque el backend falle.
          console.warn("Perfil guardado localmente. Backend no actualizó:", backendError);
        }
      }

      setVehicleBrand(cleanVehicleBrand);
      setVehicleModel(cleanVehicleModel);
      setVehiclePlate(cleanVehiclePlate);
      setVehicleColor(cleanVehicleColor);
      setVehicleYear(cleanVehicleYear);
      setVehicleImageDataUrl(cleanVehicleImageDataUrl);
      setVehicleImageName(cleanVehicleImageName);
      setProfilePhotoUrl(cleanProfilePhotoUrl);
      setLicenseNumber(lockedLicenseNumber);
      setBio(cleanBio);
      setLanguages(cleanLanguages);
      setDriverVehicles(readDriverVehicles(session?.user));
      setSelectedVehicleId(readSelectedDriverVehicleId(session?.user));

      setSuccess(true);

      window.dispatchEvent(new CustomEvent("rapago:driver-profile-saved"));
      window.dispatchEvent(new CustomEvent("rapago:driver-public-profile-updated"));
      window.dispatchEvent(new CustomEvent("rapago:driver-selected-vehicle-updated"));
      window.dispatchEvent(new CustomEvent("rapago:passenger-rides-updated"));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Error al guardar perfil.";
      setError(safeProfileMessage(message));
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    try {
      if (typeof auth.logout === "function") {
        await auth.logout();
      } else if (typeof auth.signOut === "function") {
        await auth.signOut();
      } else {
        localStorage.removeItem("rapago_session");
        localStorage.removeItem("rapago_auth_session");
        localStorage.removeItem("auth_session");
        sessionStorage.clear();
      }
    } finally {
      history.replace(ROUTES.AUTH.LOGIN);
    }
  }

  function handleSwitchToPassengerMode(): void {
    try {
      // Esta es la llave que debe leer AppRouter/RouteGuard.
      // El usuario sigue teniendo rol driver, pero la vista activa cambia a pasajero.
      localStorage.setItem("rapago_active_mode", "passenger");
      localStorage.setItem("rapago_active_role", "passenger");
      localStorage.setItem("rapago_selected_role", "passenger");
      localStorage.setItem("rapago_view_mode", "passenger");

      sessionStorage.setItem("rapago_active_mode", "passenger");
      sessionStorage.setItem("rapago_active_role", "passenger");
      sessionStorage.setItem("rapago_selected_role", "passenger");
      sessionStorage.setItem("rapago_view_mode", "passenger");

      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "rapago_active_mode",
          newValue: "passenger",
        }),
      );
    } catch {
      // Si storage falla, igual forzamos navegación.
    }

    // Ionic/React a veces mantiene el layout anterior por caché.
    // Por eso se fuerza navegación real a passenger/home.
    window.location.href = ROUTES.PASSENGER.HOME;
  }

  function selectLanguage(value: string): void {
    setLanguages(normalizeDriverLanguages([value]));
  }

  function handleProfilePhotoFileChange(
    event: ChangeEvent<HTMLInputElement>,
  ): void {
    const file = event.target.files?.[0];
    if (!file) return;

    setPhotoError(null);

    if (!file.type.startsWith("image/")) {
      setPhotoError("Selecciona una imagen válida.");
      event.target.value = "";
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      setPhotoError("La foto no puede pesar más de 3 MB.");
      event.target.value = "";
      return;
    }

    void resizeDriverProfileImage(file)
      .then((result) => {
        if (!result) {
          setPhotoError("No se pudo cargar la foto.");
          return;
        }

        profilePhotoUserEditedRef.current = true;
        setProfilePhotoUrl(result);
        persistStoredDriverProfilePhotoUrl(result, session?.user);
        publishDriverProfileVehicleSnapshot({
          user: session?.user,
          phone: phone.trim(),
          vehicle: readSelectedDriverVehicle(session?.user),
        });
      })
      .catch((err) => {
        setPhotoError(err instanceof Error ? err.message : "No se pudo leer la foto.");
      })
      .finally(() => {
        event.target.value = "";
      });
  }

  function handleRemoveProfilePhoto(): void {
    profilePhotoUserEditedRef.current = true;
    setProfilePhotoUrl("");
    setPhotoError(null);
    setSuccess(false);

    persistStoredDriverProfilePhotoUrl("", session?.user);

    // Reescribe todos los snapshots públicos sin foto. Esto evita que la
    // miniatura antigua reaparezca en Perfil o en la vista del pasajero.
    publishDriverProfileVehicleSnapshot({
      user: session?.user,
      phone: phone.trim(),
      vehicle: readSelectedDriverVehicle(session?.user),
    });

    if (session?.accessToken) {
      void clearDriverProfilePhotoOnServer(session.accessToken);
    }
  }

  async function handleVehiclePhotoFileChange(
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file = event.target.files?.[0];
    vehiclePhotoPickerOpenRef.current = false;

    if (!file) {
      event.target.value = "";
      return;
    }

    vehicleDraftDirtyRef.current = true;
    setVehicleDraftDirty(true);
    setVehiclePhotoError(null);
    setVehicleFormError(null);

    if (!file.type.startsWith("image/")) {
      setVehiclePhotoError("Selecciona una imagen válida del vehículo.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setVehiclePhotoError("La foto del vehículo no puede pesar más de 5 MB.");
      event.target.value = "";
      return;
    }

    try {
      const resizedDataUrl = await resizeDriverVehicleImage(file);

      // La vista previa se muestra inmediatamente y el formulario queda
      // protegido para que loadProfile no lo reemplace al cerrar el selector.
      setVehicleImageDataUrl(resizedDataUrl);
      setVehicleImageName(file.name);
      setVehicleSaveMessage("Subiendo foto del vehículo a Supabase…");

      const publicUrl = await ensureVehiclePhotoUploaded(
        resizedDataUrl,
        file.name,
      );

      setVehicleImageDataUrl(publicUrl);
      setVehicleImageName(file.name);
      setVehicleSaveMessage(
        "Foto subida correctamente. Pulsa Guardar vehículo para terminar.",
      );
    } catch (err) {
      setVehiclePhotoError(
        err instanceof Error
          ? err.message
          : "No se pudo subir la foto del vehículo a Supabase.",
      );
      setVehicleSaveMessage(
        "La vista previa se conserva. Pulsa Guardar vehículo para reintentar la subida.",
      );
    } finally {
      vehiclePhotoPickerOpenRef.current = false;
      event.target.value = "";
    }
  }

  function handleRemoveVehiclePhoto(): void {
    vehiclePhotoUploadSequenceRef.current += 1;
    vehiclePhotoPickerOpenRef.current = false;
    uploadingVehiclePhotoRef.current = false;
    vehicleDraftDirtyRef.current = true;
    setUploadingVehiclePhoto(false);
    setVehicleImageDataUrl("");
    setVehicleImageName("");
    setVehiclePhotoError(null);
    setVehicleDraftDirty(true);
    setVehicleFormError(null);
    setVehicleSaveMessage(
      "La foto se quitará cuando guardes este vehículo.",
    );
  }

  function refreshDriverVehicleList(): void {
    setDriverVehicles(readDriverVehicles(session?.user));
    setSelectedVehicleId(readSelectedDriverVehicleId(session?.user));
  }

  function handleSelectDriverVehicle(vehicle: DriverVehicleRecord): void {
    writeSelectedDriverVehicleId(vehicle.id, session?.user);
    setSelectedVehicleId(vehicle.id);
    setEditingVehicleId(vehicle.id);
    setVehicleBrand(vehicle.brand);
    setVehicleModel(vehicle.model);
    setVehicleYear(String(vehicle.year ?? ""));
    setVehiclePlate(vehicle.plate);
    setVehicleColor(vehicle.color);
    setVehicleImageDataUrl(vehicle.imageDataUrl ?? "");
    setVehicleImageName(vehicle.imageName ?? "");
    setVehicleOwnership(vehicle.ownership);
    setVehicleExpiresAt(vehicle.expiresAt ? vehicle.expiresAt.slice(0, 10) : "");
    persistStoredDriverVehicleImageDataUrl(
      vehicle.imageDataUrl ?? "",
      vehicle.imageName ?? null,
      session?.user,
    );
    publishDriverProfileVehicleSnapshot({
      user: session?.user,
      phone: phone.trim(),
      vehicle,
    });
    refreshDriverVehicleList();
    setVehicleDraftDirty(false);
    setVehicleFormError(null);
    setVehicleSaveMessage("Vehículo activo seleccionado.");
    setSuccess(true);
  }

  function handleEditDriverVehicle(vehicle: DriverVehicleRecord): void {
    setEditingVehicleId(vehicle.id);
    setVehicleBrand(vehicle.brand);
    setVehicleModel(vehicle.model);
    setVehicleYear(String(vehicle.year ?? ""));
    setVehiclePlate(vehicle.plate);
    setVehicleColor(vehicle.color);
    setVehicleImageDataUrl(vehicle.imageDataUrl ?? "");
    setVehicleImageName(vehicle.imageName ?? "");
    setVehicleOwnership(vehicle.ownership);
    setVehicleExpiresAt(vehicle.expiresAt ? vehicle.expiresAt.slice(0, 10) : "");
    setVehicleDraftDirty(false);
    setVehicleFormError(null);
    setVehicleSaveMessage("Editando este vehículo. Guarda los cambios al terminar.");
  }

  function handleRemoveDriverVehicle(vehicleId: string): void {
    removeDriverVehicle(vehicleId, session?.user);

    if (editingVehicleId === vehicleId) {
      setEditingVehicleId(null);
      setVehicleBrand("");
      setVehicleModel("");
      setVehicleYear("");
      setVehiclePlate("");
      setVehicleColor("");
      setVehicleImageDataUrl("");
      setVehicleImageName("");
      setVehicleExpiresAt(getDefaultBorrowedVehicleExpiry());
      setVehicleDraftDirty(false);
    }

    setVehicleFormError(null);
    setVehicleSaveMessage("Vehículo opcional eliminado.");
    refreshDriverVehicleList();
  }

  function handlePrepareNewVehicle(ownership: DriverVehicleOwnership): void {
    setEditingVehicleId(null);
    setVehicleOwnership(ownership);
    setVehicleBrand("");
    setVehicleModel("");
    setVehicleYear("");
    setVehiclePlate("");
    setVehicleColor("");
    setVehicleImageDataUrl("");
    setVehicleImageName("");
    setVehicleExpiresAt(ownership === "borrowed" ? getDefaultBorrowedVehicleExpiry() : "");
    setVehiclePhotoError(null);
    setVehicleFormError(null);
    setVehicleDraftDirty(true);
    setVehicleSaveMessage(
      ownership === "borrowed"
        ? "Completa los datos, adjunta la foto y pulsa Crear vehículo opcional."
        : "Completa los datos, adjunta la foto y pulsa Guardar vehículo propio.",
    );
    setSuccess(false);
  }

  const displayName = session?.user?.name ?? "Conductor";
  const initials =
    displayName
      .split(" ")
      .slice(0, 2)
      .map((word) => word[0] ?? "")
      .join("")
      .toUpperCase() || "C";

  const licenseWarning = isLicenseExpired(licenseExpiry)
    ? "Licencia vencida. Actualiza la fecha."
    : isLicenseExpiringSoon(licenseExpiry)
      ? "Tu licencia vence pronto."
      : null;

  const canSwitchToPassengerMode =
    session?.user?.role === "driver" ||
    session?.user?.role === "admin" ||
    window.location.pathname.startsWith("/driver");

  const cleanProfilePhotoUrl = profilePhotoUrl.trim();
  const hasProfilePhoto = cleanProfilePhotoUrl.length > 0;
  const cleanVehicleImageDataUrl = vehicleImageDataUrl.trim();
  const hasVehiclePhoto = cleanVehicleImageDataUrl.length > 0;

  return (
    <>
      <IonPage className="rapago-driver-page" data-rapago-theme={theme}>
      {/* "Cerrar sesión" sale de la cabecera: ahora vive en el menú de cuenta
          de la barra, con confirmación y bloqueado si hay viaje en curso. El
          segundo acceso sigue estando al pie de esta misma pantalla, que es
          donde la convención lo pone. */}
      <RapagoAppBar sectionId="driver-profile" title="Mi Perfil" />

      <IonAlert
        isOpen={success}
        header="Cambios guardados"
        message="Tu perfil y la foto del vehículo se guardaron correctamente. El pasajero podrá ver estos datos cuando aceptes un viaje."
        buttons={[{ text: "OK", handler: () => setSuccess(false) }]}
        onDidDismiss={() => setSuccess(false)}
      />

      <IonContent
        className="ion-padding"
        style={
          {
            "--background":
              "linear-gradient(180deg, rgba(15,15,15,.86), rgba(15,15,15,.96)), url('/assets/rapa-go-bg.jpg') center/cover no-repeat",
          } as CSSProperties
        }
      >
        <IonRefresher
          slot="fixed"
          onIonRefresh={(event) => {
            void loadProfile().then(() => event.detail.complete());
          }}
        >
          <IonRefresherContent />
        </IonRefresher>

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

        {!loading && (
          <div style={{ maxWidth: 560, margin: "0 auto", paddingBottom: 96 }}>
            <section
              style={{
                position: "relative",
                overflow: "hidden",
                borderRadius: "26px",
                padding: "20px",
                marginBottom: 14,
                background:
                  "var(--rp-btn-primary)",
                color: "var(--rp-btn-primary-fg)",
                boxShadow: "0 18px 44px rgba(0,0,0,.30)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  right: -45,
                  top: -50,
                  width: 150,
                  height: 150,
                  borderRadius: 999,
                  background: "rgba(255,255,255,.16)",
                }}
              />
              <div
                style={{
                  position: "relative",
                  zIndex: 1,
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                }}
              >
                <div
                  style={{
                    width: 76,
                    height: 76,
                    borderRadius: "24px",
                    background: "rgba(17,17,17,.24)",
                    border: "2px solid rgba(255,255,255,.36)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.55rem",
                    fontWeight: 950,
                    overflow: "hidden",
                    boxShadow: "0 14px 30px rgba(0,0,0,.24)",
                    flexShrink: 0,
                  }}
                >
                  {hasProfilePhoto ? (
                    <img
                      src={cleanProfilePhotoUrl}
                      alt="Foto de perfil"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  ) : (
                    initials
                  )}
                </div>
                <div>
                  <div
                    style={{
                      fontSize: "1.28rem",
                      fontWeight: 950,
                      lineHeight: 1.1,
                    }}
                  >
                    {displayName}
                  </div>
                  <div
                    style={{ marginTop: 4, fontSize: ".83rem", opacity: 0.94 }}
                  >
                    Perfil de conductor Rapa Go
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: ".78rem",
                      fontWeight: 850,
                    }}
                  >
                    {phone.trim() ? phone : "Teléfono pendiente"}
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "7px 10px",
                      borderRadius: 999,
                      background: "rgba(17,17,17,.22)",
                      border: "1px solid rgba(255,255,255,.20)",
                    }}
                  >
                    <DriverRatingStarsDisplay summary={driverRatingSummary} />
                  </div>
                </div>
              </div>
            </section>

            <IonCard
              className="rapago-driver-card"
              style={driverFormCardStyle({
                background: "var(--rp-surface)",
                color: "var(--rp-text)",
                border: "var(--rp-border-w) solid var(--rp-border-c)",
              })}
            >
              <IonCardContent style={{ padding: "14px" }}>
                <div style={{ fontWeight: 950, fontSize: ".98rem", marginBottom: 8 }}>
                  Reputación del conductor
                </div>
                <DriverRatingStarsDisplay summary={driverRatingSummary} />
                <div style={{ marginTop: 7, color: "var(--rp-muted)", fontSize: ".78rem", lineHeight: 1.35 }}>
                  Las estrellas se actualizan cuando el pasajero califica un viaje completado.
                </div>

                {driverRatingSummary.latest.length > 0 && (
                  <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                    {driverRatingSummary.latest.map((rating) => (
                      <div
                        key={rating.id}
                        style={{
                          background: "var(--rp-surface-soft)",
                          border: "var(--rp-border-w) solid var(--rp-border-c)",
                          borderRadius: 14,
                          padding: "9px 10px",
                        }}
                      >
                        <div style={{ fontWeight: 950, color: "var(--rp-accent)" }}>
                          {"★".repeat(Math.max(1, Math.min(5, Math.round(Number(rating.stars) || 1))))}
                          {"☆".repeat(5 - Math.max(1, Math.min(5, Math.round(Number(rating.stars) || 1))))}
                        </div>
                        <div style={{ marginTop: 3, fontSize: ".76rem", color: "var(--rp-muted)", lineHeight: 1.35 }}>
                          {getDriverRideRouteDisplayLabel(rating)}
                        </div>
                        {rating.comment && (
                          <div style={{ marginTop: 4, fontSize: ".78rem", color: "var(--rp-text)", fontWeight: 800 }}>
                            “{rating.comment}”
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </IonCardContent>
            </IonCard>

            {error && (
              <IonCard
                className="rapago-driver-card"
                style={driverFormCardStyle({
                  background: "var(--rp-warn-bg)",
                  border: "1px solid var(--rp-warn-bd)",
                })}
              >
                <IonCardContent style={{ padding: "10px 14px" }}>
                  <IonText>
                    <p
                      style={{
                        margin: 0,
                        color: "var(--rp-warn-fg)",
                        fontWeight: 800,
                        fontSize: ".82rem",
                      }}
                    >
                      {error}
                    </p>
                  </IonText>
                </IonCardContent>
              </IonCard>
            )}

            {success && (
              <IonCard
                className="rapago-driver-card"
                style={driverFormCardStyle({
                  background: "var(--rp-ok-bg)",
                  border: "1px solid var(--rp-ok-bd)",
                })}
              >
                <IonCardContent style={{ padding: "10px 14px" }}>
                  <IonText color="success">
                    <p
                      style={{ margin: 0, fontWeight: 900, fontSize: ".82rem" }}
                    >
                      Perfil guardado correctamente.
                    </p>
                  </IonText>
                </IonCardContent>
              </IonCard>
            )}

            <IonCard className="rapago-driver-card" style={driverFormCardStyle()}>
              <IonCardContent>
                <div
                  style={{ fontWeight: 950, fontSize: "1rem", marginBottom: 4 }}
                >
                  Datos personales
                </div>
                <div
                  style={{
                    color: "var(--rp-muted)",
                    fontSize: ".78rem",
                    fontWeight: 800,
                    marginBottom: 10,
                  }}
                >
                  El teléfono se toma automáticamente desde el registro y está
                  bloqueado. Para corregirlo debes solicitarlo a soporte.
                </div>

                <IonItem lines="none" className="rapago-profile-field" style={driverInputItemStyle()}>
                  <IonLabel position="stacked" style={driverFieldLabelStyle()}>
                    Teléfono
                  </IonLabel>
                  <IonInput
                    style={driverFieldTextStyle()}
                    value={phone}
                    placeholder="Teléfono registrado"
                    type="tel"
                    readonly
                    aria-readonly="true"
                  />
                </IonItem>

                <div
                  style={{
                    marginTop: 14,
                    padding: 14,
                    borderRadius: 20,
                    background:
                      "var(--rp-surface-soft)",
                    border: "1.5px solid var(--rp-border-c)",
                    boxShadow: "0 12px 26px rgba(0,0,0,.08)",
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 14 }}
                  >
                    <div
                      style={{
                        width: 76,
                        height: 76,
                        borderRadius: 24,
                        overflow: "hidden",
                        background: "var(--rp-btn-primary)",
                        color: "var(--rp-btn-primary-fg)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 950,
                        fontSize: "1.35rem",
                        boxShadow: "0 14px 28px rgba(0,0,0,.18)",
                        flexShrink: 0,
                      }}
                    >
                      {hasProfilePhoto ? (
                        <img
                          src={cleanProfilePhotoUrl}
                          alt="Foto de perfil"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                          }}
                        />
                      ) : (
                        initials
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 950,
                          color: "var(--rp-text)",
                          fontSize: ".95rem",
                        }}
                      >
                        Foto de perfil
                      </div>
                      <div
                        style={{
                          color: "var(--rp-muted)",
                          fontSize: ".76rem",
                          fontWeight: 800,
                          lineHeight: 1.35,
                          marginTop: 3,
                        }}
                      >
                        Adjunta una foto clara. Se actualizará inmediatamente en
                        tu perfil.
                      </div>
                    </div>
                  </div>

                  <input
                    ref={profilePhotoFileRef}
                    type="file"
                    accept="image/*"
                    onChange={handleProfilePhotoFileChange}
                    style={{ display: "none" }}
                  />

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: hasProfilePhoto ? "1fr 1fr" : "1fr",
                      gap: 10,
                      marginTop: 14,
                    }}
                  >
                    <IonButton
                      expand="block"
                      onClick={() => {
                        const input = profilePhotoFileRef.current;
                        if (!input) return;
                        input.value = "";
                        input.click();
                      }}
                      style={
                        {
                          "--border-radius": "16px",
                          "--background": "var(--rp-btn-primary)",
                          "--color": "var(--rp-btn-primary-fg)",
                          height: "48px",
                          fontWeight: 950,
                        } as CSSProperties
                      }
                    >
                      <IonIcon icon={cameraOutline} slot="start" aria-hidden="true" />
                      {hasProfilePhoto ? "Cambiar foto" : "Adjuntar foto"}
                    </IonButton>

                    {hasProfilePhoto && (
                      <IonButton
                        expand="block"
                        fill="outline"
                        color="danger"
                        onClick={handleRemoveProfilePhoto}
                        style={
                          {
                            "--border-radius": "16px",
                            height: "48px",
                            fontWeight: 950,
                          } as CSSProperties
                        }
                      >
                        <IonIcon icon={trashOutline} slot="start" aria-hidden="true" />
                        Quitar
                      </IonButton>
                    )}
                  </div>


                  {photoError && (
                    <IonText color="danger">
                      <p
                        style={{
                          margin: "8px 0 0",
                          fontSize: ".78rem",
                          fontWeight: 850,
                        }}
                      >
                        {photoError}
                      </p>
                    </IonText>
                  )}
                </div>
              </IonCardContent>
            </IonCard>

            <IonCard className="rapago-driver-card" style={driverFormCardStyle()}>
              <IonCardContent>
                <div
                  style={{ fontWeight: 950, fontSize: "1rem", marginBottom: 4 }}
                >
                  Vehículos del conductor
                </div>
                <div
                  style={{
                    color: "var(--rp-muted)",
                    fontSize: ".78rem",
                    fontWeight: 800,
                    marginBottom: 10,
                    lineHeight: 1.35,
                  }}
                >
                  Aquí se toman los vehículos enviados en la inscripción. Puedes agregar todos los vehículos que tengas y elegir cuál queda activo para recibir solicitudes y reservas.
                </div>

                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 12,
                    padding: "6px 10px",
                    borderRadius: 999,
                    background: "var(--rp-ok-bg)",
                    color: "var(--rp-ok-fg)",
                    fontSize: ".74rem",
                    fontWeight: 950,
                  }}
                >
                  {driverVehicles.length} vehículo{driverVehicles.length !== 1 ? "s" : ""} registrado{driverVehicles.length !== 1 ? "s" : ""}
                </div>

                {driverVehicles.length > 0 && (
                  <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
                    {driverVehicles.map((vehicle) => {
                      const selected = selectedVehicleId === vehicle.id;
                      const borrowedText = getBorrowedVehicleRemainingText(vehicle);

                      return (
                        <div
                          key={vehicle.id}
                          style={{
                            display: "grid",
                            gridTemplateColumns: vehicle.imageDataUrl ? "82px 1fr" : "1fr",
                            gap: 10,
                            padding: 10,
                            borderRadius: 18,
                            background: selected ? "var(--rp-ok-bg)" : "var(--rp-surface-soft)",
                            border: selected
                              ? "2px solid var(--rp-ok-bd)"
                              : "1.5px solid var(--rp-border-c)",
                          }}
                        >
                          {vehicle.imageDataUrl && (
                            <img
                              src={vehicle.imageDataUrl}
                              alt={vehicle.label}
                              style={{
                                width: 82,
                                height: 82,
                                borderRadius: 14,
                                objectFit: "cover",
                                background: "var(--rp-surface-soft)",
                              }}
                            />
                          )}

                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 950, color: "var(--rp-text)", fontSize: ".92rem" }}>
                              {vehicle.brand} {vehicle.model} {vehicle.year ? `· ${vehicle.year}` : ""}
                            </div>
                            <div style={{ color: "var(--rp-muted)", fontSize: ".78rem", fontWeight: 850, marginTop: 2 }}>
                              Patente {vehicle.plate || "sin patente"} · {vehicle.color || "sin color"}
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                              <IonBadge color={vehicle.ownership === "borrowed" ? "warning" : "success"}>
                                {vehicle.ownership === "borrowed" ? "Opcional / temporal" : "Vehículo propio"}
                              </IonBadge>
                              {selected && <IonBadge color="success">Activo</IonBadge>}
                              {borrowedText && <IonBadge color="medium">{borrowedText}</IonBadge>}
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
                              <IonButton
                                size="small"
                                color={selected ? "success" : "warning"}
                                fill={selected ? "solid" : "outline"}
                                onClick={() => handleSelectDriverVehicle(vehicle)}
                                style={{ "--border-radius": "14px", fontWeight: 950 } as CSSProperties}
                              >
                                {selected ? "Vehículo activo" : "Usar este"}
                              </IonButton>
                              <IonButton
                                size="small"
                                fill="outline"
                                color="medium"
                                onClick={() => handleEditDriverVehicle(vehicle)}
                                style={{ "--border-radius": "14px", fontWeight: 950 } as CSSProperties}
                              >
                                Editar abajo
                              </IonButton>
                            </div>

                            {vehicle.ownership === "borrowed" && (
                              <IonButton
                                size="small"
                                fill="clear"
                                color="danger"
                                onClick={() => handleRemoveDriverVehicle(vehicle.id)}
                                style={{ marginTop: 4, fontWeight: 900 }}
                              >
                                Eliminar opcional
                              </IonButton>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {driverVehicles.length === 0 && (
                  <IonNote style={{ display: "block", marginBottom: 12, color: "var(--rp-muted)", fontWeight: 900 }}>
                    No hay vehículos cargados desde la inscripción. Completa los datos abajo y guarda tu vehículo principal. Después podrás agregar más vehículos si tienes.
                  </IonNote>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                  <IonButton
                    expand="block"
                    color={vehicleOwnership === "own" ? "success" : "medium"}
                    fill={vehicleOwnership === "own" ? "solid" : "outline"}
                    onClick={() => handlePrepareNewVehicle("own")}
                    style={{ "--border-radius": "16px", height: "46px", fontWeight: 950 } as CSSProperties}
                  >
                    Vehículo propio
                  </IonButton>
                  <IonButton
                    expand="block"
                    color={vehicleOwnership === "borrowed" ? "warning" : "medium"}
                    fill={vehicleOwnership === "borrowed" ? "solid" : "outline"}
                    onClick={() => handlePrepareNewVehicle("borrowed")}
                    style={{ "--border-radius": "16px", height: "46px", fontWeight: 950 } as CSSProperties}
                  >
                    Agregar vehículo opcional
                  </IonButton>
                </div>

                <div
                  style={{
                    color: "var(--rp-muted)",
                    fontSize: ".78rem",
                    fontWeight: 800,
                    marginBottom: 10,
                  }}
                >
                  {vehicleOwnership === "borrowed"
                    ? "Vehículo opcional/temporal: puedes agregar más de uno. Cada opcional exige fecha de expiración y luego se borra automáticamente."
                    : "Vehículo propio: puedes guardar tu principal y también agregar más vehículos propios si los usas en Rapa Go."}
                </div>

                <IonItem lines="none" className="rapago-profile-field" style={driverInputItemStyle()}>
                  <IonLabel position="stacked" style={driverFieldLabelStyle()}>
                    Marca
                  </IonLabel>
                  <IonInput
                    style={driverFieldTextStyle()}
                    value={vehicleBrand}
                    onIonInput={(event) => {
                      setVehicleBrand(String(event.detail.value ?? ""));
                      setVehicleDraftDirty(true);
                      setVehicleFormError(null);
                    }}
                    placeholder="Toyota"
                    clearInput
                  />
                </IonItem>

                <IonItem lines="none" className="rapago-profile-field" style={driverInputItemStyle()}>
                  <IonLabel position="stacked" style={driverFieldLabelStyle()}>
                    Modelo
                  </IonLabel>
                  <IonInput
                    style={driverFieldTextStyle()}
                    value={vehicleModel}
                    onIonInput={(event) => {
                      setVehicleModel(String(event.detail.value ?? ""));
                      setVehicleDraftDirty(true);
                      setVehicleFormError(null);
                    }}
                    placeholder="Yaris"
                    clearInput
                  />
                </IonItem>

                <IonItem lines="none" className="rapago-profile-field" style={driverInputItemStyle()}>
                  <IonLabel position="stacked" style={driverFieldLabelStyle()}>
                    Año
                  </IonLabel>
                  <IonInput
                    style={driverFieldTextStyle()}
                    value={vehicleYear}
                    onIonInput={(event) => {
                      setVehicleYear(String(event.detail.value ?? ""));
                      setVehicleDraftDirty(true);
                      setVehicleFormError(null);
                    }}
                    placeholder="2025"
                    inputmode="numeric"
                    clearInput
                  />
                </IonItem>

                <IonItem lines="none" className="rapago-profile-field" style={driverInputItemStyle()}>
                  <IonLabel position="stacked" style={driverFieldLabelStyle()}>
                    Patente
                  </IonLabel>
                  <IonInput
                    style={driverFieldTextStyle()}
                    value={vehiclePlate}
                    onIonInput={(event) => {
                      setVehiclePlate(
                        String(event.detail.value ?? "").toUpperCase(),
                      );
                      setVehicleDraftDirty(true);
                      setVehicleFormError(null);
                    }}
                    placeholder="ABCD12"
                    clearInput
                  />
                </IonItem>

                <IonItem lines="none" className="rapago-profile-field" style={driverInputItemStyle()}>
                  <IonLabel position="stacked" style={driverFieldLabelStyle()}>
                    Color
                  </IonLabel>
                  <IonInput
                    style={driverFieldTextStyle()}
                    value={vehicleColor}
                    onIonInput={(event) => {
                      setVehicleColor(String(event.detail.value ?? ""));
                      setVehicleDraftDirty(true);
                      setVehicleFormError(null);
                    }}
                    placeholder="Rojo"
                    clearInput
                  />
                </IonItem>

                {vehicleOwnership === "borrowed" && (
                  <IonItem lines="none" className="rapago-profile-field" style={driverInputItemStyle()}>
                    <IonLabel position="stacked" style={driverFieldLabelStyle()}>
                      Fecha de expiración del vehículo opcional *
                    </IonLabel>
                    <IonInput
                      style={driverFieldTextStyle()}
                      type="date"
                      value={vehicleExpiresAt}
                      onIonInput={(event) => {
                        setVehicleExpiresAt(String(event.detail.value ?? ""));
                        setVehicleDraftDirty(true);
                        setVehicleFormError(null);
                      }}
                    />
                  </IonItem>
                )}

                <div
                  style={{
                    marginTop: 14,
                    padding: 14,
                    borderRadius: 20,
                    background: "var(--rp-surface-soft)",
                    border: "1.5px dashed var(--rp-border-c)",
                    boxShadow: "0 12px 26px rgba(0,0,0,.08)",
                  }}
                >
                  <div style={{ fontWeight: 950, fontSize: ".95rem", color: "var(--rp-text)" }}>
                    Foto del vehículo
                  </div>
                  <div
                    style={{
                      color: "var(--rp-muted)",
                      fontSize: ".76rem",
                      fontWeight: 800,
                      lineHeight: 1.35,
                      marginTop: 3,
                    }}
                  >
                    Esta foto se mostrará al pasajero cuando aceptes un viaje.
                  </div>

                  {hasVehiclePhoto && (
                    <div
                      style={{
                        marginTop: 12,
                        width: "100%",
                        minHeight: 145,
                        borderRadius: 18,
                        overflow: "hidden",
                        background: "var(--rp-surface-soft)",
                        border: "var(--rp-border-w) solid var(--rp-border-c)",
                        boxShadow: "0 10px 24px rgba(0,0,0,.18)",
                      }}
                    >
                      <img
                        src={cleanVehicleImageDataUrl}
                        alt="Foto del vehículo"
                        style={{
                          width: "100%",
                          height: 180,
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    </div>
                  )}

                  <input
                    ref={vehiclePhotoFileRef}
                    type="file"
                    accept="image/*"
                    onChange={(event) => void handleVehiclePhotoFileChange(event)}
                    style={{ display: "none" }}
                  />

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: hasVehiclePhoto ? "1fr 1fr" : "1fr",
                      gap: 10,
                      marginTop: 14,
                    }}
                  >
                    <IonButton
                      expand="block"
                      disabled={uploadingVehiclePhoto}
                      onClick={() => {
                        const input = vehiclePhotoFileRef.current;
                        if (!input) return;

                        // Se marca antes de abrir el selector. Al volver desde
                        // la galería, ninguna recarga del perfil puede borrar
                        // marca/modelo/patente ni la foto elegida.
                        vehiclePhotoPickerOpenRef.current = true;
                        vehicleDraftDirtyRef.current = true;
                        setVehicleDraftDirty(true);
                        setVehiclePhotoError(null);
                        input.value = "";
                        input.click();
                      }}
                      style={
                        {
                          "--border-radius": "16px",
                          "--background": "var(--rp-btn-primary)",
                          "--color": "var(--rp-btn-primary-fg)",
                          height: "48px",
                          fontWeight: 950,
                        } as CSSProperties
                      }
                    >
                      {uploadingVehiclePhoto ? (
                        <IonSpinner name="dots" />
                      ) : (
                        <>
                          <IonIcon icon={cameraOutline} slot="start" aria-hidden="true" />
                          {hasVehiclePhoto ? "Cambiar foto" : "Adjuntar foto"}
                        </>
                      )}
                    </IonButton>

                    {hasVehiclePhoto && (
                      <IonButton
                        expand="block"
                        fill="outline"
                        color="danger"
                        onClick={handleRemoveVehiclePhoto}
                        style={
                          {
                            "--border-radius": "16px",
                            height: "48px",
                            fontWeight: 950,
                          } as CSSProperties
                        }
                      >
                        <IonIcon icon={trashOutline} slot="start" aria-hidden="true" />
                        Quitar
                      </IonButton>
                    )}
                  </div>

                  {vehiclePhotoError && (
                    <IonText color="danger">
                      <p
                        style={{
                          margin: "8px 0 0",
                          fontSize: ".78rem",
                          fontWeight: 850,
                        }}
                      >
                        {vehiclePhotoError}
                      </p>
                    </IonText>
                  )}
                </div>

                {vehicleFormError && (
                  <div
                    role="alert"
                    style={{
                      marginTop: 12,
                      padding: "11px 12px",
                      borderRadius: 16,
                      border: "1px solid var(--rp-err-bd)",
                      background: "var(--rp-err-bg)",
                      color: "var(--rp-err-fg)",
                      fontSize: ".8rem",
                      lineHeight: 1.4,
                      fontWeight: 900,
                    }}
                  >
                    {vehicleFormError}
                  </div>
                )}

                {vehicleSaveMessage && !vehicleFormError && (
                  <div
                    role="status"
                    style={{
                      marginTop: 12,
                      padding: "11px 12px",
                      borderRadius: 16,
                      border: vehicleDraftDirty
                        ? "1px solid var(--rp-border-c)"
                        : "1px solid var(--rp-ok-bd)",
                      background: vehicleDraftDirty ? "var(--rp-warn-bg)" : "var(--rp-ok-bg)",
                      color: vehicleDraftDirty ? "var(--rp-warn-fg)" : "var(--rp-ok-fg)",
                      fontSize: ".8rem",
                      lineHeight: 1.4,
                      fontWeight: 900,
                    }}
                  >
                    {vehicleSaveMessage}
                  </div>
                )}

                <IonButton
                  expand="block"
                  color={vehicleOwnership === "borrowed" ? "warning" : "success"}
                  onClick={() => void handleSaveVehicleOnly()}
                  disabled={savingVehicle || uploadingVehiclePhoto}
                  style={
                    {
                      "--border-radius": "16px",
                      height: "52px",
                      marginTop: 14,
                      fontWeight: 950,
                      "--color":
                        vehicleOwnership === "borrowed" ? "#111" : "#fff",
                    } as CSSProperties
                  }
                >
                  {savingVehicle || uploadingVehiclePhoto ? (
                    <IonSpinner name="dots" />
                  ) : editingVehicleId ? (
                    "Guardar cambios del vehículo"
                  ) : vehicleOwnership === "borrowed" ? (
                    "Crear vehículo opcional"
                  ) : (
                    "Guardar vehículo propio"
                  )}
                </IonButton>

                <div
                  style={{
                    marginTop: 8,
                    color: "var(--rp-muted)",
                    fontSize: ".72rem",
                    fontWeight: 800,
                    lineHeight: 1.35,
                    textAlign: "center",
                  }}
                >
                  La foto y los datos quedan asociados a este vehículo y a este conductor.
                </div>
              </IonCardContent>
            </IonCard>

            <IonCard className="rapago-driver-card" style={driverFormCardStyle()}>
              <IonCardContent>
                <div
                  style={{ fontWeight: 950, fontSize: "1rem", marginBottom: 4 }}
                >
                  Licencia de conducir
                </div>

                <IonItem lines="none" className="rapago-profile-field" style={driverInputItemStyle()}>
                  <IonLabel position="stacked" style={driverFieldLabelStyle()}>
                    Número de licencia
                  </IonLabel>
                  <IonInput
                    style={driverFieldTextStyle()}
                    value={licenseNumber}
                    placeholder="Número aprobado"
                    readonly
                    aria-readonly="true"
                  />
                </IonItem>

                <IonItem lines="none" className="rapago-profile-field" style={driverInputItemStyle()}>
                  <IonLabel position="stacked" style={driverFieldLabelStyle()}>
                    Fecha de vencimiento
                  </IonLabel>
                  <IonInput
                    style={driverFieldTextStyle()}
                    value={licenseExpiry}
                    type="date"
                    readonly
                    aria-readonly="true"
                  />
                </IonItem>

                <div
                  style={{
                    marginTop: 10,
                    color: "var(--rp-muted)",
                    fontSize: ".76rem",
                    fontWeight: 800,
                    lineHeight: 1.4,
                  }}
                >
                  El número y vencimiento de la licencia corresponden a los
                  documentos aprobados. No pueden modificarse desde el perfil.
                </div>

                <IonButton
                  expand="block"
                  fill="outline"
                  onClick={() => history.push(`${ROUTES.SUPPORT.CENTER}?category=identity_correction`)}
                  style={
                    {
                      "--border-radius": "16px",
                      height: "48px",
                      marginTop: 12,
                      fontWeight: 950,
                    } as CSSProperties
                  }
                >
                  Solicitar corrección a soporte
                </IonButton>

                {licenseWarning && (
                  <IonText
                    color={
                      isLicenseExpired(licenseExpiry) ? "danger" : "warning"
                    }
                  >
                    <p
                      style={{
                        fontSize: ".8rem",
                        fontWeight: 800,
                        margin: "8px 0 0",
                      }}
                    >
                      {licenseWarning}
                    </p>
                  </IonText>
                )}
              </IonCardContent>
            </IonCard>

            <IonCard className="rapago-driver-card" style={driverFormCardStyle()}>
              <IonCardContent>
                <div
                  style={{
                    fontWeight: 950,
                    fontSize: "1rem",
                    marginBottom: 10,
                  }}
                >
                  Biografía
                </div>
                <IonItem lines="none" className="rapago-profile-field" style={driverInputItemStyle()}>
                  <IonLabel position="stacked" style={driverFieldLabelStyle()}>
                    Sobre ti
                  </IonLabel>
                  <IonTextarea
                    style={driverFieldTextStyle()}
                    value={bio}
                    onIonInput={(event) =>
                      setBio(String(event.detail.value ?? ""))
                    }
                    placeholder="Cuéntale al pasajero sobre tu experiencia..."
                    autoGrow
                    rows={4}
                  />
                </IonItem>
              </IonCardContent>
            </IonCard>

            <IonCard className="rapago-driver-card" style={driverFormCardStyle()}>
              <IonCardContent>
                <div
                  style={{ fontWeight: 950, fontSize: "1rem", marginBottom: 4 }}
                >
                  Idiomas
                </div>
                <div
                  style={{
                    color: "var(--rp-muted)",
                    fontSize: ".78rem",
                    fontWeight: 800,
                    marginBottom: 12,
                  }}
                >
                  Selecciona el idioma principal que verán tus pasajeros.
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                  }}
                >
                  {LANGUAGE_OPTIONS.map((option) => {
                    const selected = languages.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => selectLanguage(option.value)}
                        style={{
                          minHeight: 62,
                          borderRadius: 18,
                          border: selected
                            ? "2px solid var(--rp-border-strong)"
                            : "1.5px solid var(--rp-border-c)",
                          background: selected
                            ? "var(--rp-btn-primary)"
                            : "var(--rp-surface-soft)",
                          color: selected ? "var(--rp-btn-primary-fg)" : "var(--rp-text)",
                          boxShadow: selected
                            ? "var(--rp-shadow-accent)"
                            : "var(--rp-shadow)",
                          fontWeight: 950,
                          fontSize: ".95rem",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                        }}
                        aria-pressed={selected}
                      >
                        <span style={{ fontSize: "1.2rem" }}>
                          {option.emoji}
                        </span>
                        {option.label}
                      </button>
                    );
                  })}
                </div>

                <div
                  style={{
                    marginTop: 12,
                    padding: "10px 12px",
                    borderRadius: 16,
                    background: "var(--rp-ok-bg)",
                    border: "1px solid var(--rp-ok-bd)",
                    color: "var(--rp-ok-fg)",
                    fontWeight: 900,
                    fontSize: ".78rem",
                  }}
                >
                  Idioma seleccionado:{" "}
                  {languages.includes("en") ? "Inglés" : "Español"}
                </div>
              </IonCardContent>
            </IonCard>

            {canSwitchToPassengerMode && (
              <IonCard
                className="rapago-driver-card"
                style={driverFormCardStyle({
                  background: "var(--rp-surface)",
                  border: "var(--rp-border-w) solid var(--rp-border-c)",
                })}
              >
                <IonCardContent style={{ padding: "14px" }}>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 12 }}
                  >
                    <div
                      aria-hidden="true"
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 16,
                        background: "var(--rp-btn-primary)",
                        color: "var(--rp-btn-primary-fg)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <IonIcon icon={personOutline} style={{ fontSize: 26 }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 950,
                          fontSize: ".98rem",
                          color: "var(--rp-text)",
                        }}
                      >
                        ¿Quieres pedir un Rapa Go?
                      </div>
                      <div
                        style={{
                          marginTop: 3,
                          color: "var(--rp-muted)",
                          fontSize: ".78rem",
                          fontWeight: 800,
                          lineHeight: 1.35,
                        }}
                      >
                        Cambia temporalmente a la vista de pasajero sin cerrar
                        sesión.
                      </div>
                    </div>
                  </div>

                  <IonButton
                    expand="block"
                    color="warning"
                    onClick={handleSwitchToPassengerMode}
                    disabled={saving}
                    style={
                      {
                        "--border-radius": "16px",
                        height: "52px",
                        marginTop: 12,
                        fontWeight: 950,
                        "--color": "#111",
                      } as CSSProperties
                    }
                  >
                    Cambiar a modo pasajero
                  </IonButton>
                </IonCardContent>
              </IonCard>
            )}

            <AccountDeletionCard
              requesterSnapshot={{
                phone: phone.trim() || null,
                rut: storedProfile.rut?.trim() || null,
                vehicleBrand: vehicleBrand.trim() || null,
                vehicleModel: vehicleModel.trim() || null,
                vehicleYear: Number.isFinite(Number(vehicleYear))
                  ? Number(vehicleYear)
                  : null,
                vehiclePlate: vehiclePlate.trim() || null,
                vehicleColor: vehicleColor.trim() || null,
                licenseNumber: licenseNumber.trim() || null,
                sourceView: "driver",
              }}
            />

            <IonButton
              expand="block"
              onClick={() => void handleSave()}
              disabled={saving}
              style={
                {
                  "--border-radius": "16px",
                  "--background": "var(--rp-btn-primary)",
                  "--color": "var(--rp-btn-primary-fg)",
                  height: "52px",
                  fontWeight: 950,
                } as CSSProperties
              }
            >
              {saving ? <IonSpinner name="dots" /> : "Guardar cambios"}
            </IonButton>

            <IonButton
              expand="block"
              fill="outline"
              color="danger"
              onClick={() => void handleLogout()}
              disabled={saving}
              style={
                {
                  "--border-radius": "16px",
                  height: "52px",
                  marginTop: 12,
                  fontWeight: 950,
                } as CSSProperties
              }
            >
              Cerrar sesión
            </IonButton>
          </div>
        )}
      </IonContent>
      </IonPage>
    </>
  );
}
