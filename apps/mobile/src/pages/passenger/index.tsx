import {
  IonAlert,
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonChip,
  IonContent,
  IonDatetime,
  IonHeader,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonModal,
  IonNote,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonText,
  IonTextarea,
  IonToast,
  IonTitle,
  IonToggle,
  IonToolbar,
} from "@ionic/react";
import { useEffect, useState, useCallback, useRef, type CSSProperties } from "react";
import { useHistory } from "react-router-dom";
import {
  carOutline,
  carSportOutline,
  chevronForwardOutline,
  compassOutline,
  ellipseOutline,
  mapOutline,
  ticketOutline,
  walletOutline,
} from "ionicons/icons";
import { EmptyState } from "../../components/EmptyState.js";
import { TripTimeline } from "../../components/TripTimeline.js";
import { DriverInfoCard } from "../../components/DriverInfoCard.js";
import { ModulePlaceholderPage } from "../../components/ModulePlaceholderPage";
import { passengerProfileService, type PassengerProfileData } from "../../features/passengers/passengerProfile.service.js";
import { driverProfileService } from "../../features/drivers/driverProfile.service";
import { ROUTE_METADATA } from "../../navigation/routeConfig";
import { ROUTES } from "../../navigation/routes";
import { useAuth } from "../../features/auth";
import { ridesService, type RideRequestData } from "../../features/rides/rides.service";
import { MapFallback, loadRapaGoGoogleMaps } from "../../components/MapFallback";
import { RAPA_NUI_PLACES, RAPAGO_CONTACT, WA_MESSAGES, getDistanceBetween } from "@rapa-go/shared";
import { WhatsAppButton } from "../../components/WhatsAppButton";
import { touristService, type GuidePublicData, type TouristServiceData, type ServiceBookingData } from "../../features/tourist/tourist.service.js";
import { useIonViewWillEnter } from "@ionic/react";
import { rentalService } from "../../features/rental/rental.service.js";
import type { RentalVehicleData as RentalVehicleDataType, RentalBookingData as RentalBookingDataType } from "../../features/rental/rental.service.js";
import { legalService, type LegalDocumentData, type UserAcceptanceData } from "../../features/legal/legal.service.js";
import { RapaGoLanguageRuntime } from "../../i18n/rapagoI18n";

type RapaGoConnectivityMode = "checking" | "online" | "poor" | "offline";
type RapaGoConnectivityRole = "driver" | "passenger" | "admin";

const RAPAGO_CONNECTIVITY_STATUS_KEY = "rapago_connectivity_status_v1";
const RAPAGO_CONNECTIVITY_EVENT = "rapago:connectivity-status-changed";

function getRapaGoConnectivityProbeUrl(): string {
  const env = import.meta.env as Record<string, string | undefined>;
  const raw = String(env.VITE_API_BASE_URL || env.VITE_API_URL || "/api").trim();

  if (!raw || raw === "/") return "/api/health";

  if (/^https?:\/\//i.test(raw)) {
    const base = raw.replace(/\/api\/?$/i, "").replace(/\/+$/, "");
    return `${base}/api/health`;
  }

  const clean = raw.replace(/\/+$/, "");
  return clean.endsWith("/api") ? `${clean}/health` : `${clean}/api/health`;
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
      return "Sin internet: quedaste No disponible. Busca una zona con conexión para volver a recibir viajes reales.";
    }

    return "Conexión baja: quedaste No disponible para evitar viajes fallidos. Busca una zona con mejor internet para volver a estar disponible.";
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
    <IonCard
      style={{
        margin: "0 0 14px",
        borderRadius: "20px",
        background: isChecking
          ? "linear-gradient(135deg,#1f2937,#334155)"
          : isOffline
            ? "linear-gradient(135deg,#2A1A18,#7f1d1d)"
            : "linear-gradient(135deg,#2A1A18,#8F3F25)",
        color: "#ffffff",
        border: "1px solid rgba(255,255,255,.12)",
        boxShadow: "0 16px 34px rgba(0,0,0,.24)",
        ...style,
      }}
    >
      <IonCardContent
        style={{
          padding: "13px 14px",
          display: "grid",
          gridTemplateColumns: "38px 1fr",
          gap: 11,
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 999,
            background: isChecking ? "rgba(255,255,255,.14)" : "rgba(245,158,11,.20)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.25rem",
            fontWeight: 950,
          }}
        >
          {isChecking ? "…" : isOffline ? "⌁" : "!"}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 950, fontSize: ".92rem" }}>
            {isChecking ? "Revisando conexión" : isOffline ? "Modo sin internet" : "Modo conexión baja"}
          </div>
          <div style={{ marginTop: 3, fontSize: ".78rem", fontWeight: 800, lineHeight: 1.35, opacity: .9 }}>
            {getRapaGoConnectivityMessage(role, status)}
          </div>
        </div>
      </IonCardContent>
    </IonCard>
  );
}



function LegalStatusSection({ token }: { token: string }): React.ReactElement {
  const [docs,        setDocs]        = useState<LegalDocumentData[]>([]);
  const [acceptances, setAcceptances] = useState<UserAcceptanceData[]>([]);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    Promise.all([legalService.getActive(), legalService.getMyAcceptances(token)])
      .then(([d, a]) => { setDocs(d); setAcceptances(a); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const getStatus = (doc: LegalDocumentData) => {
    const acc = acceptances.find((a) => a.legalDocumentId === doc.id);
    if (!acc) return "not_accepted";
    if (acc.versionAccepted !== doc.version) return "new_version";
    return "accepted";
  };

  const handleAccept = (doc: LegalDocumentData) => {
    void legalService.accept(token, doc.id, doc.version).then(() => {
      legalService.getMyAcceptances(token).then(setAcceptances).catch(() => {});
    });
  };

  return (
    <IonCard style={{ marginTop: "24px" }}>
      <IonCardHeader>
        <IonCardTitle style={{ fontSize: "1rem" }}>Documentos Legales</IonCardTitle>
      </IonCardHeader>
      <IonCardContent style={{ padding: 0 }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "16px" }}>
            <IonSpinner name="dots" />
          </div>
        ) : (
          <IonList>
            {docs.map((doc) => {
              const status = getStatus(doc);
              return (
                <IonItem key={doc.id}>
                  <IonLabel>
                    <h3>{doc.title}</h3>
                    <p>v{doc.version}</p>
                  </IonLabel>
                  {status === "accepted" && <IonBadge color="success" slot="end">Aceptado</IonBadge>}
                  {status === "new_version" && <IonBadge color="warning" slot="end">Nueva versión</IonBadge>}
                  {status === "not_accepted" && <IonBadge color="danger" slot="end">Pendiente</IonBadge>}
                  {(status === "not_accepted" || status === "new_version") && (
                    <IonButton fill="clear" size="small" slot="end" onClick={() => handleAccept(doc)}>
                      Aceptar
                    </IonButton>
                  )}
                </IonItem>
              );
            })}
          </IonList>
        )}
      </IonCardContent>
    </IonCard>
  );
}

function StarRatingInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: "flex", gap: "4px", margin: "8px 0" }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <span
          key={s}
          onClick={() => onChange(s)}
          style={{ fontSize: "1.6rem", cursor: "pointer", color: s <= value ? "#f4c430" : "#ccc" }}
        >
          ★
        </span>
      ))}
    </div>
  );
}

function meta(path: string) {
  return ROUTE_METADATA.find((r) => r.path === path)!;
}

const RIDE_STATUS_LABEL: Record<string, string> = {
  scheduled:       "Agendado",
  driver_scheduled: "Conductor agendado",
  requested:       "Solicitado",
  accepted:        "Conductor asignado",
  driver_en_route: "Conductor en camino",
  driver_arrived:  "Conductor llegó",
  in_progress:     "En curso",
  completed:       "Completado",
  cancelled:       "Cancelado",
};

const RIDE_STATUS_COLOR: Record<string, string> = {
  scheduled:       "warning",
  driver_scheduled: "success",
  requested:       "warning",
  accepted:        "primary",
  driver_en_route: "tertiary",
  driver_arrived:  "secondary",
  in_progress:     "success",
  completed:       "medium",
  cancelled:       "danger",
};


const PASSENGER_FREQUENT_DESTINATION_NAMES = [
  "Ahu Tahai",
  "Playa Pea",
  "Playa Poko Poko",
  "Mercado Artesanal Rapa Nui",
  "Feria Artesanal Hare Umanga",
  "Caleta Hanga Roa",
  "Comisaría Rapa Nui",
  "Iglesia de la Santa Cruz Rapa Nui",
  "Ahu Huri A Urenga",
  "Hospital de Hanga Roa",
  "Jardín Botánico TauKiani",
];

function normalizeFrequentPlaceName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const PASSENGER_FREQUENT_DESTINATION_KEYS =
  PASSENGER_FREQUENT_DESTINATION_NAMES.map(normalizeFrequentPlaceName);

function isPassengerFrequentDestination(name: string): boolean {
  const normalizedName = normalizeFrequentPlaceName(name);

  // Se elimina "Tahai" solo y también Mirador/Rano Kau de los frecuentes.
  if (
    normalizedName === "tahai" ||
    normalizedName.includes("mirador rano kau") ||
    normalizedName.includes("rano kau")
  ) {
    return false;
  }

  return PASSENGER_FREQUENT_DESTINATION_KEYS.some(
    (allowedName) =>
      normalizedName === allowedName ||
      normalizedName.includes(allowedName) ||
      allowedName.includes(normalizedName),
  );
}


type PassengerFareType = "resident" | "chilean" | "foreigner";

type StoredRegistrationProfile = {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  rut?: string | null;
  birthDate?: string | null;
  passengerFareType?: PassengerFareType | string | null;
  farePassengerType?: PassengerFareType | string | null;
  passengerType?: PassengerFareType | string | null;
  nationality?: string | null;
  passengerFareLabel?: string | null;
  residenceVerificationStatus?: string | null;
  residenceVerificationMessage?: string | null;
  residentDocumentName?: string | null;
  directPassengerFareType?: string | null;
  directNationality?: string | null;
};


const RAPAGO_PASSENGER_AUTH_SESSION_PROFILE_KEY = "rapago_registration_profile_session";
const RAPAGO_PASSENGER_RESIDENT_VERIFICATION_SESSION_KEY = "rapago_resident_verification_requests_session_v1";

const RAPAGO_PASSENGER_PII_LOCAL_STORAGE_KEYS = [
  "rapago_passenger_email",
  "rapago_profile_email",
  "rapago_passenger_phone",
  "rapago_profile_phone",
  "rapago_passenger_rut",
  "rapago_profile_rut",
  "rapago_resident_document_name",
  "rapago_passenger_residence_document_meta",
] as const;

function clearPassengerLegacyPiiLocalStorage(): void {
  try {
    for (const key of RAPAGO_PASSENGER_PII_LOCAL_STORAGE_KEYS) {
      localStorage.removeItem(key);
    }
  } catch {
    // No bloquea Inicio pasajero.
  }
}

function passengerSessionValue(key: string): string {
  try {
    return sessionStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function readPassengerSessionRegistrationProfile(): StoredRegistrationProfile {
  try {
    const raw = sessionStorage.getItem(RAPAGO_PASSENGER_AUTH_SESSION_PROFILE_KEY);
    const parsed = raw ? (JSON.parse(raw) as StoredRegistrationProfile) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function sanitizePassengerLocalRegistrationProfile(profile: StoredRegistrationProfile): StoredRegistrationProfile {
  return {
    passengerFareType: profile.passengerFareType ?? profile.farePassengerType ?? profile.passengerType ?? null,
    farePassengerType: profile.farePassengerType ?? profile.passengerFareType ?? profile.passengerType ?? null,
    passengerType: profile.passengerType ?? profile.farePassengerType ?? profile.passengerFareType ?? null,
    nationality: profile.nationality ?? profile.passengerFareLabel ?? null,
    passengerFareLabel: profile.passengerFareLabel ?? profile.nationality ?? null,
    residenceVerificationStatus: profile.residenceVerificationStatus ?? null,
    residenceVerificationMessage: profile.residenceVerificationMessage ?? null,
    directPassengerFareType: profile.directPassengerFareType ?? null,
    directNationality: profile.directNationality ?? null,
  };
}


function readStoredRegistrationProfile(): StoredRegistrationProfile {
  try {
    clearPassengerLegacyPiiLocalStorage();

    const raw = localStorage.getItem("rapago_registration_profile");
    const parsedRaw = raw ? (JSON.parse(raw) as StoredRegistrationProfile) : {};
    const parsed = sanitizePassengerLocalRegistrationProfile(
      parsedRaw && typeof parsedRaw === "object" ? parsedRaw : {},
    );
    const sessionProfile = readPassengerSessionRegistrationProfile();

    const directFareType =
      localStorage.getItem("rapago_passenger_fare_type") ??
      localStorage.getItem("rapago_profile_passenger_type") ??
      localStorage.getItem("rapago_fare_passenger_type") ??
      localStorage.getItem("rapago_passenger_type") ??
      localStorage.getItem("farePassengerType") ??
      localStorage.getItem("passengerType");

    const directNationality =
      localStorage.getItem("rapago_profile_nationality") ??
      localStorage.getItem("rapago_nationality") ??
      localStorage.getItem("nationality");

    const directResidenceVerificationStatus =
      localStorage.getItem("rapago_residence_verification_status") ??
      localStorage.getItem("rapago_resident_verification_status") ??
      localStorage.getItem("residenceVerificationStatus");

    const directResidenceVerificationMessage =
      localStorage.getItem("rapago_residence_verification_user_message") ??
      localStorage.getItem("rapago_resident_verification_user_message") ??
      localStorage.getItem("residenceVerificationMessage");

    return {
      ...parsed,
      ...sessionProfile,
      email: sessionProfile.email || passengerSessionValue("rapago_passenger_email") || passengerSessionValue("rapago_profile_email"),
      rut: sessionProfile.rut || passengerSessionValue("rapago_profile_rut") || passengerSessionValue("rapago_passenger_rut"),
      phone: sessionProfile.phone || passengerSessionValue("rapago_profile_phone") || passengerSessionValue("rapago_passenger_phone"),
      passengerFareType:
        sessionProfile.passengerFareType ??
        parsed.passengerFareType ??
        parsed.farePassengerType ??
        parsed.passengerType ??
        null,
      farePassengerType:
        sessionProfile.farePassengerType ??
        parsed.farePassengerType ??
        parsed.passengerFareType ??
        parsed.passengerType ??
        null,
      passengerType:
        sessionProfile.passengerType ??
        parsed.passengerType ??
        parsed.farePassengerType ??
        parsed.passengerFareType ??
        null,
      nationality:
        sessionProfile.nationality ??
        parsed.nationality ??
        parsed.passengerFareLabel ??
        null,
      passengerFareLabel:
        sessionProfile.passengerFareLabel ??
        parsed.passengerFareLabel ??
        parsed.nationality ??
        null,
      residenceVerificationStatus:
        sessionProfile.residenceVerificationStatus ??
        parsed.residenceVerificationStatus ??
        directResidenceVerificationStatus ??
        null,
      residenceVerificationMessage:
        sessionProfile.residenceVerificationMessage ??
        parsed.residenceVerificationMessage ??
        directResidenceVerificationMessage ??
        null,
      residentDocumentName: sessionProfile.residentDocumentName ?? null,
      directPassengerFareType: directFareType,
      directNationality,
    };
  } catch {
    return readPassengerSessionRegistrationProfile();
  }
}

function getAutoPhone(sessionPhone?: string | null, profilePhone?: string | null): string {
  const stored = readStoredRegistrationProfile();
  return (profilePhone ?? sessionPhone ?? stored.phone ?? "").trim();
}


function persistPassengerAutofill(data: Partial<StoredRegistrationProfile>): void {
  try {
    clearPassengerLegacyPiiLocalStorage();

    const currentSession = readPassengerSessionRegistrationProfile();
    const nextSession = { ...currentSession, ...data };
    sessionStorage.setItem(RAPAGO_PASSENGER_AUTH_SESSION_PROFILE_KEY, JSON.stringify(nextSession));

    const currentLocal = sanitizePassengerLocalRegistrationProfile(readStoredRegistrationProfile());
    const nextLocal = sanitizePassengerLocalRegistrationProfile({ ...currentLocal, ...data });
    localStorage.setItem("rapago_registration_profile", JSON.stringify(nextLocal));
  } catch {
    // No bloquea la app.
  }
}

function getSessionPhone(user: unknown): string {
  if (!user || typeof user !== "object") return "";
  const value = (user as { phone?: string | null }).phone;
  return typeof value === "string" ? value : "";
}


function safePassengerErrorMessage(message: string | null): string | null {
  if (!message) return null;

  const lower = message.toLowerCase();

  if (
    lower.includes("token") ||
    lower.includes("unauthorized") ||
    lower.includes("forbidden") ||
    lower.includes("only passengers") ||
    lower.includes("solo pasajeros") ||
    lower.includes("no autorizado") ||
    lower.includes("sesión expir") ||
    lower.includes("session expired") ||
    message.includes("401") ||
    message.includes("403")
  ) {
    return "Tu vista cambió a pasajero, pero el backend aún debe permitir este rol en rutas de pasajero.";
  }

  return message;
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function sanitizeText(value: string, max = 150): string {
  return value.replace(/[<>]/g, "").slice(0, max);
}

function formatClp(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return "$0 CLP";
  return `$${Math.round(Number(value)).toLocaleString("es-CL")} CLP`;
}

function readAdminFareUsdRate(): number {
  try {
    const rawEngine = localStorage.getItem(ADMIN_FARE_ENGINE_STORAGE_KEY);
    if (rawEngine) {
      const parsed = JSON.parse(rawEngine) as { usdRate?: number | string | null };
      const fromEngine = Number(parsed.usdRate);
      if (Number.isFinite(fromEngine) && fromEngine > 0) return fromEngine;
    }

    const fromCards = Number(localStorage.getItem(ADMIN_FARE_USD_RATE_STORAGE_KEY));
    if (Number.isFinite(fromCards) && fromCards > 0) return fromCards;
  } catch {
    // Usa el valor seguro por defecto.
  }

  return DEFAULT_FARE_ENGINE.usdRate;
}

function formatUsdFromClp(value: number | null | undefined, usdRate = readAdminFareUsdRate()): string {
  const safeValue = Number(value);
  const safeRate = Number(usdRate);

  if (!Number.isFinite(safeValue) || safeValue <= 0 || !Number.isFinite(safeRate) || safeRate <= 0) {
    return "USD 0";
  }

  const usd = safeValue / safeRate;
  return `USD ${usd.toLocaleString("es-CL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  })}`;
}

function roundFare(value: number): number {
  return Math.max(0, Math.round(value / 100) * 100);
}

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

function distanceKmByCoords(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

type VehicleFareCategory = "standard" | "xl" | "luggage";
type RideMode = "now" | "scheduled";
type TripFareMode = "one_way" | "round_trip";

type FareRoundingMode = "ceil" | "nearest" | "none";

type FareEngineFixedDestination = {
  id: string;
  title: string;
  tripType: string;
  baseResidentClp: number;
  active: boolean;
};

type FareEngineConfig = {
  urban: {
    includedKm: number;
    baseMinimumClp: number;
    baseKmClp: number;
  };
  passengerMultipliers: Record<PassengerFareType, number>;
  vehicleMultipliers: Record<VehicleFareCategory, number>;
  fixedDestinations: FareEngineFixedDestination[];
  rounding: {
    mode: FareRoundingMode;
    unitClp: number;
  };
  usdRate: number;
  updatedAt?: string;
};

type AdminFareCardRule = {
  id: string;
  kind: "variable" | "fixed";
  title: string;
  minimumClp: number | null;
  kmClp: number | null;
  fixedClp: number | null;
  description: string;
  active: boolean;
};

const ADMIN_FARE_ENGINE_STORAGE_KEY = "rapago_admin_fare_engine_v1";
const ADMIN_FARE_RULES_STORAGE_KEY = "rapago_admin_fare_cards_rules_v1";
const ADMIN_FARE_USD_RATE_STORAGE_KEY = "rapago_admin_fare_cards_usd_rate_v1";

const DEFAULT_FARE_ENGINE: FareEngineConfig = {
  urban: {
    includedKm: 2,
    baseMinimumClp: 5000,
    baseKmClp: 1000,
  },
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
  rounding: {
    mode: "ceil",
    unitClp: 100,
  },
  usdRate: 1000,
};

const DEFAULT_PASSENGER_FARE_RULES: AdminFareCardRule[] = [
  {
    id: "general_minimum",
    kind: "variable",
    title: "Tarifa general mínima (0 a 2 kms)",
    minimumClp: 5000,
    kmClp: null,
    fixedClp: null,
    description: "Tarifa mínima urbana. Incluye los primeros 2 km.",
    active: true,
  },
  {
    id: "general_km",
    kind: "variable",
    title: "Tarifa general por km (con mínimo)",
    minimumClp: null,
    kmClp: 1000,
    fixedClp: null,
    description: "Valor por km adicional después del mínimo.",
    active: true,
  },
  {
    id: "resident_standard",
    kind: "variable",
    title: "Tarifa residentes",
    minimumClp: 5000,
    kmClp: 1000,
    fixedClp: null,
    description: "Residente · vehículo estándar.",
    active: true,
  },
  {
    id: "chilean_standard",
    kind: "variable",
    title: "Tarifa chilenos",
    minimumClp: 5650,
    kmClp: 1130,
    fixedClp: null,
    description: "Chileno no residente · vehículo estándar.",
    active: true,
  },
  {
    id: "foreigner_standard",
    kind: "variable",
    title: "Tarifa extranjeros",
    minimumClp: 6000,
    kmClp: 1200,
    fixedClp: null,
    description: "Extranjero · vehículo estándar.",
    active: true,
  },
  {
    id: "xl_resident",
    kind: "variable",
    title: "Tarifa vehículo XL residentes",
    minimumClp: 7000,
    kmClp: 1400,
    fixedClp: null,
    description: "Residente · vehículo XL.",
    active: true,
  },
  {
    id: "xl_chilean",
    kind: "variable",
    title: "Tarifa vehículo XL chilenos",
    minimumClp: 7910,
    kmClp: 1582,
    fixedClp: null,
    description: "Chileno no residente · vehículo XL.",
    active: true,
  },
  {
    id: "xl_foreigner",
    kind: "variable",
    title: "Tarifa vehículo XL extranjeros",
    minimumClp: 8400,
    kmClp: 1680,
    fixedClp: null,
    description: "Extranjero · vehículo XL.",
    active: true,
  },
  {
    id: "luggage_resident",
    kind: "variable",
    title: "Tarifa vehículo extra maletas residentes",
    minimumClp: 6250,
    kmClp: 1250,
    fixedClp: null,
    description: "Residente · vehículo con espacio extra para maletas.",
    active: true,
  },
  {
    id: "luggage_chilean",
    kind: "variable",
    title: "Tarifa vehículo extra maletas chilenos",
    minimumClp: 7062.5,
    kmClp: 1412.5,
    fixedClp: null,
    description: "Chileno no residente · vehículo con espacio extra para maletas.",
    active: true,
  },
  {
    id: "luggage_foreigner",
    kind: "variable",
    title: "Tarifa vehículo extra maletas extranjeros",
    minimumClp: 7500,
    kmClp: 1500,
    fixedClp: null,
    description: "Extranjero · vehículo con espacio extra para maletas.",
    active: true,
  },
  {
    id: "anakena_resident_roundtrip",
    kind: "fixed",
    title: "Tarifa destino Anakena residentes ida y vuelta",
    minimumClp: null,
    kmClp: null,
    fixedClp: 38000,
    description: "Destino fijo Anakena · residente.",
    active: true,
  },
  {
    id: "anakena_chilean_roundtrip",
    kind: "fixed",
    title: "Tarifa destino Anakena chilenos ida y vuelta",
    minimumClp: null,
    kmClp: null,
    fixedClp: 42940,
    description: "Destino fijo Anakena · chileno no residente.",
    active: true,
  },
  {
    id: "anakena_foreigner_roundtrip",
    kind: "fixed",
    title: "Tarifa destino Anakena extranjeros ida y vuelta",
    minimumClp: null,
    kmClp: null,
    fixedClp: 45600,
    description: "Destino fijo Anakena · extranjero.",
    active: true,
  },
  {
    id: "terevaka_resident_roundtrip",
    kind: "fixed",
    title: "Tarifa destino Terevaka residentes ida y vuelta",
    minimumClp: null,
    kmClp: null,
    fixedClp: 20000,
    description: "Destino fijo Terevaka · residente.",
    active: true,
  },
  {
    id: "terevaka_chilean_roundtrip",
    kind: "fixed",
    title: "Tarifa destino Terevaka chilenos ida y vuelta",
    minimumClp: null,
    kmClp: null,
    fixedClp: 22600,
    description: "Destino fijo Terevaka · chileno no residente.",
    active: true,
  },
  {
    id: "terevaka_foreigner_roundtrip",
    kind: "fixed",
    title: "Tarifa destino Terevaka extranjeros ida y vuelta",
    minimumClp: null,
    kmClp: null,
    fixedClp: 24000,
    description: "Destino fijo Terevaka · extranjero.",
    active: true,
  },
];

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
        normalizePassengerFareType(storedProfile.nationality) ??
        normalizePassengerFareType(storedProfile.passengerFareLabel) ??
        normalizePassengerFareType(storedProfile.farePassengerType) ??
        normalizePassengerFareType(storedProfile.passengerFareType) ??
        normalizePassengerFareType(storedProfile.passengerType) ??
        normalizePassengerFareType(storedProfile.directNationality) ??
        normalizePassengerFareType(storedProfile.directPassengerFareType);

      if (stored) return stored;
    }

    const globalStored =
      normalizePassengerFareType(localStorage.getItem("rapago_passenger_fare_type")) ??
      normalizePassengerFareType(localStorage.getItem("rapago_profile_passenger_type")) ??
      normalizePassengerFareType(localStorage.getItem("rapago_fare_passenger_type")) ??
      normalizePassengerFareType(localStorage.getItem("rapago_profile_nationality")) ??
      normalizePassengerFareType(localStorage.getItem("rapago_nationality"));

    if (globalStored && storedBelongsToThisUser) return globalStored;
  } catch {
    // Si no existe dato guardado, usa Turista chileno como valor seguro por defecto.
  }

  return "chilean";
}

function readAdminFareEngineConfig(): FareEngineConfig | null {
  try {
    const raw = localStorage.getItem(ADMIN_FARE_ENGINE_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<FareEngineConfig>;
    const base = DEFAULT_FARE_ENGINE;

    return {
      urban: {
        includedKm: Number(parsed.urban?.includedKm ?? base.urban.includedKm),
        baseMinimumClp: Number(parsed.urban?.baseMinimumClp ?? base.urban.baseMinimumClp),
        baseKmClp: Number(parsed.urban?.baseKmClp ?? base.urban.baseKmClp),
      },
      passengerMultipliers: {
        resident: Number(parsed.passengerMultipliers?.resident ?? base.passengerMultipliers.resident),
        chilean: Number(parsed.passengerMultipliers?.chilean ?? base.passengerMultipliers.chilean),
        foreigner: Number(parsed.passengerMultipliers?.foreigner ?? base.passengerMultipliers.foreigner),
      },
      vehicleMultipliers: {
        standard: Number(parsed.vehicleMultipliers?.standard ?? base.vehicleMultipliers.standard),
        xl: Number(parsed.vehicleMultipliers?.xl ?? base.vehicleMultipliers.xl),
        luggage: Number(parsed.vehicleMultipliers?.luggage ?? base.vehicleMultipliers.luggage),
      },
      fixedDestinations:
        Array.isArray(parsed.fixedDestinations) && parsed.fixedDestinations.length > 0
          ? parsed.fixedDestinations.map((item, index) => ({
              id: normalizeFareSearchText(String(item.id ?? item.title ?? `destino_${index + 1}`)).replace(/[^a-z0-9]+/g, "_"),
              title: String(item.title ?? `Destino ${index + 1}`),
              tripType: String(item.tripType ?? "Ida y vuelta"),
              baseResidentClp: Number(item.baseResidentClp ?? 0),
              active: item.active !== false,
            }))
          : base.fixedDestinations,
      rounding: {
        mode:
          parsed.rounding?.mode === "nearest" || parsed.rounding?.mode === "none"
            ? parsed.rounding.mode
            : "ceil",
        unitClp: Math.max(1, Number(parsed.rounding?.unitClp ?? base.rounding.unitClp)),
      },
      usdRate: Number(parsed.usdRate ?? base.usdRate),
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
}

function readAdminFareCardRules(): AdminFareCardRule[] {
  try {
    const raw = localStorage.getItem(ADMIN_FARE_RULES_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as AdminFareCardRule[]) : [];

    if (Array.isArray(parsed) && parsed.length > 0) {
      const merged = [...parsed];

      for (const fallback of DEFAULT_PASSENGER_FARE_RULES) {
        if (!merged.some((rule) => rule.id === fallback.id)) merged.push(fallback);
      }

      return merged;
    }
  } catch {
    // No bloquea la solicitud de viaje.
  }

  return DEFAULT_PASSENGER_FARE_RULES;
}

function passengerFareSuffix(type: PassengerFareType): string {
  if (type === "chilean") return "chilean";
  if (type === "foreigner") return "foreigner";
  return "resident";
}

function passengerFareTypeLabel(type: PassengerFareType): string {
  if (type === "resident") return "RAPA NUI / RESIDENTE RAPA NUI";
  if (type === "chilean") return "Turista chileno";
  return "Turista extranjero";
}



type ResidenceVerificationStatus =
  | "not_required"
  | "missing_document"
  | "pending"
  | "approved"
  | "rejected";

type ResidentVerificationState = {
  status: ResidenceVerificationStatus;
  message: string;
  passengerFareType: PassengerFareType;
  documentName: string;
  rejectionReason: string;
};

const RESIDENT_VERIFICATION_REQUESTS_KEY = "rapago_resident_verification_requests_v1";

const DEFAULT_RESIDENT_REJECTION_MESSAGE =
  "Tu documento de RAPA NUI / RESIDENTE RAPA NUI fue rechazado. Por favor elige otro tipo de usuario: Turista chileno o Turista extranjero, o vuelve a adjuntar un documento de residencia válido.";

function normalizeResidenceVerificationStatus(value: unknown): ResidenceVerificationStatus | null {
  const raw = String(value ?? "")
    .toLowerCase()
    .trim();

  if (!raw) return null;

  if (
    raw === "approved" ||
    raw === "aprobado" ||
    raw === "active" ||
    raw === "activo" ||
    raw === "validated" ||
    raw === "validado"
  ) {
    return "approved";
  }

  if (
    raw === "rejected" ||
    raw === "rechazado" ||
    raw === "denied" ||
    raw === "denegado"
  ) {
    return "rejected";
  }

  if (
    raw === "pending" ||
    raw === "pendiente" ||
    raw === "in_review" ||
    raw === "review" ||
    raw === "en_revision"
  ) {
    return "pending";
  }

  if (
    raw === "missing_document" ||
    raw === "document_missing" ||
    raw === "sin_documento"
  ) {
    return "missing_document";
  }

  if (
    raw === "not_required" ||
    raw === "no_requiere" ||
    raw === "user_changed_type" ||
    raw === "changed_to_chilean" ||
    raw === "changed_to_foreigner"
  ) {
    return "not_required";
  }

  return null;
}


function readResidentVerificationRequests(): Array<Record<string, unknown>> {
  const rows: Array<Record<string, unknown>> = [];

  try {
    const sessionRaw = sessionStorage.getItem(RAPAGO_PASSENGER_RESIDENT_VERIFICATION_SESSION_KEY);
    const sessionParsed = sessionRaw ? (JSON.parse(sessionRaw) as Array<Record<string, unknown>>) : [];
    if (Array.isArray(sessionParsed)) rows.push(...sessionParsed);
  } catch {
    // No bloquea la vista del pasajero.
  }

  try {
    const raw = localStorage.getItem(RESIDENT_VERIFICATION_REQUESTS_KEY);
    const parsed = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
    if (Array.isArray(parsed)) rows.push(...parsed);
  } catch {
    // No bloquea la vista del pasajero.
  }

  return rows;
}


function getCurrentUserIdentity(user?: unknown): {
  userId: string;
  email: string;
  rut: string;
} {
  const stored = readStoredRegistrationProfile();

  return {
    userId: getUserStringField(user, "id") ?? "",
    email: (
      getUserStringField(user, "email") ||
      stored.email ||
      passengerSessionValue("rapago_passenger_email") ||
      passengerSessionValue("rapago_profile_email") ||
      ""
    )
      .trim()
      .toLowerCase(),
    rut: (
      getUserStringField(user, "rut") ||
      stored.rut ||
      passengerSessionValue("rapago_profile_rut") ||
      passengerSessionValue("rapago_passenger_rut") ||
      ""
    )
      .trim()
      .toUpperCase(),
  };
}

function findCurrentResidentVerificationRequest(
  user?: unknown,
): Record<string, unknown> | null {
  const identity = getCurrentUserIdentity(user);
  const requests = readResidentVerificationRequests();

  return (
    requests.find((item) => {
      const userId = String(item.userId ?? "");
      const email = String(item.email ?? "").trim().toLowerCase();
      const rut = String(item.rut ?? "").trim().toUpperCase();

      return (
        Boolean(identity.userId && userId && identity.userId === userId) ||
        Boolean(identity.email && email && identity.email === email) ||
        Boolean(identity.rut && rut && identity.rut === rut)
      );
    }) ?? null
  );
}

function getResidentRequestMessage(
  request: Record<string, unknown> | null,
  stored: StoredRegistrationProfile,
  status: ResidenceVerificationStatus,
): string {
  const requestMessage =
    String(
      request?.userMessage ??
        request?.reviewMessage ??
        request?.adminMessage ??
        request?.message ??
        request?.rejectionReason ??
        request?.reason ??
        "",
    ).trim();

  if (requestMessage) return requestMessage;

  if (stored.residenceVerificationMessage) {
    return stored.residenceVerificationMessage;
  }

  if (status === "approved") {
    return "Tu documento fue aprobado. Tu tarifa de RAPA NUI / RESIDENTE RAPA NUI ya está habilitada.";
  }

  if (status === "rejected") {
    return DEFAULT_RESIDENT_REJECTION_MESSAGE;
  }

  if (status === "missing_document") {
    return "Para usar tarifa de RAPA NUI / RESIDENTE RAPA NUI debes adjuntar un documento de residencia.";
  }

  if (status === "pending") {
    return "Tu documento de RAPA NUI / RESIDENTE RAPA NUI está pendiente de revisión por el administrador.";
  }

  return "";
}

function syncResidentVerificationStorage(
  state: ResidentVerificationState,
): void {
  try {
    localStorage.setItem("rapago_residence_verification_status", state.status);

    if (state.message) {
      localStorage.setItem("rapago_residence_verification_user_message", state.message);
    } else {
      localStorage.removeItem("rapago_residence_verification_user_message");
    }

    if (state.status === "approved") {
      localStorage.setItem("rapago_passenger_fare_type", "resident");
      localStorage.setItem("rapago_profile_passenger_type", "resident");
      localStorage.setItem("rapago_fare_passenger_type", "resident");
      localStorage.setItem("rapago_passenger_type", "resident");
      localStorage.setItem("rapago_profile_nationality", "RAPA NUI / RESIDENTE RAPA NUI");
      localStorage.setItem("rapago_nationality", "RAPA NUI / RESIDENTE RAPA NUI");
    }
  } catch {
    // No bloquea la vista del pasajero.
  }
}

function readResidentVerificationState(user?: unknown): ResidentVerificationState {
  const stored = readStoredRegistrationProfile();
  const request = findCurrentResidentVerificationRequest(user);
  const passengerFareType = readPassengerFareType(user);

  const statusFromRequest = normalizeResidenceVerificationStatus(request?.status);
  const statusFromUser =
    normalizeResidenceVerificationStatus(getUserStringField(user, "residenceVerificationStatus")) ??
    normalizeResidenceVerificationStatus(getUserStringField(user, "residentVerificationStatus")) ??
    normalizeResidenceVerificationStatus(getUserStringField(user, "rapaNuiVerificationStatus"));
  const statusFromStored = normalizeResidenceVerificationStatus(
    stored.residenceVerificationStatus ??
      localStorage.getItem("rapago_residence_verification_status"),
  );

  const isResident =
    passengerFareType === "resident" ||
    normalizePassengerFareType(stored.passengerFareLabel) === "resident" ||
    normalizePassengerFareType(stored.nationality) === "resident";

  const status =
    statusFromRequest ??
    statusFromUser ??
    statusFromStored ??
    (isResident ? "pending" : "not_required");

  const documentName = String(
    request?.documentName ??
      stored.residentDocumentName ??
      "",
  );

  const rejectionReason = String(
    request?.rejectionReason ??
      request?.reason ??
      request?.reviewMessage ??
      "",
  ).trim();

  const state: ResidentVerificationState = {
    status,
    message: getResidentRequestMessage(request, stored, status),
    passengerFareType,
    documentName,
    rejectionReason,
  };

  syncResidentVerificationStorage(state);

  return state;
}

function setPassengerTypeAfterResidentRejection(
  user: unknown,
  nextType: Exclude<PassengerFareType, "resident">,
): void {
  const label = passengerFareTypeLabel(nextType);
  const identity = getCurrentUserIdentity(user);

  try {
    const current = readStoredRegistrationProfile();
    const nextProfile: StoredRegistrationProfile = {
      ...current,
      passengerFareType: nextType,
      farePassengerType: nextType,
      passengerType: nextType,
      nationality: label,
      passengerFareLabel: label,
      residenceVerificationStatus: "not_required",
      residenceVerificationMessage: "",
    };

    localStorage.setItem("rapago_registration_profile", JSON.stringify(nextProfile));
    localStorage.setItem("rapago_passenger_fare_type", nextType);
    localStorage.setItem("rapago_profile_passenger_type", nextType);
    localStorage.setItem("rapago_fare_passenger_type", nextType);
    localStorage.setItem("rapago_passenger_type", nextType);
    localStorage.setItem("rapago_profile_nationality", label);
    localStorage.setItem("rapago_nationality", label);
    localStorage.setItem("rapago_residence_verification_status", "not_required");
    localStorage.removeItem("rapago_residence_verification_user_message");

    const requests = readResidentVerificationRequests();
    const updated = requests.map((item) => {
      const userId = String(item.userId ?? "");
      const email = String(item.email ?? "").trim().toLowerCase();
      const rut = String(item.rut ?? "").trim().toUpperCase();

      const same =
        Boolean(identity.userId && userId && identity.userId === userId) ||
        Boolean(identity.email && email && identity.email === email) ||
        Boolean(identity.rut && rut && identity.rut === rut);

      if (!same) return item;

      return {
        ...item,
        status: nextType === "chilean" ? "changed_to_chilean" : "changed_to_foreigner",
        selectedPassengerFareType: nextType,
        selectedPassengerFareLabel: label,
        passengerFareType: nextType,
        passengerFareLabel: label,
        nationality: label,
        updatedAt: new Date().toISOString(),
        userMessage: `Elegiste ${label}. Ya no necesitas validación de residencia Rapa Nui.`,
      };
    });

    localStorage.setItem(RESIDENT_VERIFICATION_REQUESTS_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("rapago:resident-verification-updated"));
  } catch {
    // No bloquea la app.
  }
}

function ResidentVerificationStatusCard({
  user,
  onChanged,
}: {
  user?: unknown;
  onChanged?: () => void;
}): JSX.Element | null {
  const [state, setState] = useState<ResidentVerificationState>(() =>
    readResidentVerificationState(user),
  );

  useEffect(() => {
    const refresh = () => {
      setState(readResidentVerificationState(user));
    };

    refresh();

    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener(
      "rapago:resident-verification-updated",
      refresh as EventListener,
    );

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(
        "rapago:resident-verification-updated",
        refresh as EventListener,
      );
    };
  }, [user]);

  if (state.status === "not_required") return null;

  const tone =
    state.status === "approved"
      ? {
          border: "#2dd36f",
          bg: "#e9fbef",
          title: "Residencia Rapa Nui aprobada",
          badge: "Aprobado",
          color: "success",
        }
      : state.status === "rejected"
        ? {
            border: "#eb445a",
            bg: "#fff0f2",
            title: "Documento rechazado",
            badge: "Rechazado",
            color: "danger",
          }
        : {
            border: "#ffc409",
            bg: "#fff7df",
            title: "Validación pendiente",
            badge: state.status === "missing_document" ? "Falta documento" : "Pendiente",
            color: "warning",
          };

  return (
    <IonCard
      style={{
        margin: "12px 0 0",
        borderRadius: 18,
        border: `1.5px solid ${tone.border}`,
        background: tone.bg,
        color: "#111",
      }}
    >
      <IonCardContent style={{ padding: "14px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 950, fontSize: ".96rem" }}>
              {tone.title}
            </div>
            <p
              style={{
                margin: "6px 0 0",
                fontSize: ".84rem",
                lineHeight: 1.35,
                color: "#3a2a1b",
                fontWeight: 750,
              }}
            >
              {state.message}
            </p>
            {state.documentName && (
              <IonNote style={{ display: "block", marginTop: 6 }}>
                Documento: {state.documentName}
              </IonNote>
            )}
          </div>

          <IonBadge color={tone.color}>{tone.badge}</IonBadge>
        </div>

        {state.status === "rejected" && (
          <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
            <IonText color="danger">
              <p style={{ margin: 0, fontSize: ".82rem", fontWeight: 900 }}>
                Elige otro tipo de usuario para seguir usando Rapa Go:
              </p>
            </IonText>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <IonButton
                size="small"
                color="warning"
                onClick={() => {
                  setPassengerTypeAfterResidentRejection(user, "chilean");
                  setState(readResidentVerificationState(user));
                  onChanged?.();
                }}
              >
                Turista chileno
              </IonButton>

              <IonButton
                size="small"
                color="medium"
                onClick={() => {
                  setPassengerTypeAfterResidentRejection(user, "foreigner");
                  setState(readResidentVerificationState(user));
                  onChanged?.();
                }}
              >
                Turista extranjero
              </IonButton>
            </div>

            <IonButton
              size="small"
              fill="outline"
              color="primary"
              onClick={() => {
                try {
                  localStorage.setItem("rapago_residence_verification_status", "missing_document");
                  localStorage.setItem(
                    "rapago_residence_verification_user_message",
                    "Vuelve a adjuntar un documento de residencia válido desde tu perfil o registro.",
                  );
                  window.dispatchEvent(new CustomEvent("rapago:resident-verification-updated"));
                } catch {
                  // No bloquea.
                }
                setState(readResidentVerificationState(user));
                onChanged?.();
              }}
            >
              Volver a adjuntar documento
            </IonButton>
          </div>
        )}
      </IonCardContent>
    </IonCard>
  );
}

function vehicleFarePrefix(vehicle: VehicleFareCategory): string {
  if (vehicle === "xl") return "xl";
  if (vehicle === "luggage") return "luggage";
  return "standard";
}

function vehicleFareLabel(vehicle: VehicleFareCategory): string {
  if (vehicle === "xl") return "XL";
  if (vehicle === "luggage") return "Extra maletas";
  return "Estándar";
}

function normalizeFareSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function detectFixedDestinationId(originOrDestinationText: string): "anakena" | "terevaka" | null {
  const normalized = normalizeFareSearchText(originOrDestinationText);
  if (normalized.includes("anakena")) return "anakena";
  if (normalized.includes("terevaka") || normalized.includes("tere vaka")) return "terevaka";
  return null;
}

function detectEngineFixedDestination(
  config: FareEngineConfig,
  originOrDestinationText: string,
): FareEngineFixedDestination | null {
  const normalized = normalizeFareSearchText(originOrDestinationText);

  return (
    config.fixedDestinations.find((destination) => {
      if (destination.active === false) return false;

      const id = normalizeFareSearchText(destination.id);
      const title = normalizeFareSearchText(destination.title);

      return (
        normalized.includes(id) ||
        normalized.includes(title) ||
        title.includes(normalized)
      );
    }) ?? null
  );
}

function findActiveFareRule(rules: AdminFareCardRule[], id: string): AdminFareCardRule | null {
  return rules.find((rule) => rule.id === id && rule.active !== false) ?? null;
}

function roundFareByEngine(value: number, config: FareEngineConfig): number {
  if (!Number.isFinite(value) || value <= 0) return 0;

  const unit = Math.max(1, Math.round(config.rounding.unitClp || 100));

  if (config.rounding.mode === "none") return Math.round(value);
  if (config.rounding.mode === "nearest") return Math.round(value / unit) * unit;

  // Recomendación inicial: múltiplo superior de $100.
  return Math.ceil(value / unit) * unit;
}

function passengerFareMultiplier(type: PassengerFareType): number {
  if (type === "chilean") return 1.13;
  if (type === "foreigner") return 1.2;
  return 1;
}

function calculateRapaGoFareFromEngine(
  km: number,
  minutes: number | undefined,
  passengerType: PassengerFareType,
  vehicleCategory: VehicleFareCategory,
  originOrDestinationText: string,
  config: FareEngineConfig,
): {
  km: number;
  minutes: number;
  fare: number;
  driverEarnings: number;
  isZoneFare: boolean;
} {
  const safeKm = Math.max(0.1, Number.isFinite(km) ? km : 0.1);
  const safeMinutes = Math.max(4, Math.round(minutes ?? (safeKm / 28) * 60));
  const fixedDestination = detectEngineFixedDestination(config, originOrDestinationText);
  const passengerMultiplier = config.passengerMultipliers[passengerType] ?? 1;

  if (fixedDestination) {
    const exactFixedFare = fixedDestination.baseResidentClp * passengerMultiplier;
    const fare = roundFareByEngine(exactFixedFare, config);

    return {
      km: Number(safeKm.toFixed(1)),
      minutes: safeMinutes,
      fare,
      driverEarnings: roundFare(fare * 0.85),
      isZoneFare: true,
    };
  }

  const vehicleMultiplier = config.vehicleMultipliers[vehicleCategory] ?? 1;
  const minimumFare =
    config.urban.baseMinimumClp * passengerMultiplier * vehicleMultiplier;
  const perKm =
    config.urban.baseKmClp * passengerMultiplier * vehicleMultiplier;
  const additionalKm = Math.max(0, safeKm - config.urban.includedKm);
  const exactFare = minimumFare + additionalKm * perKm;
  const fare = roundFareByEngine(exactFare, config);

  return {
    km: Number(safeKm.toFixed(1)),
    minutes: safeMinutes,
    fare,
    driverEarnings: roundFare(fare * 0.85),
    isZoneFare: false,
  };
}

function calculateRapaGoFareFromCompatibilityRules(
  km: number,
  minutes: number | undefined,
  passengerType: PassengerFareType,
  vehicleCategory: VehicleFareCategory,
  originOrDestinationText: string,
): {
  km: number;
  minutes: number;
  fare: number;
  driverEarnings: number;
  isZoneFare: boolean;
} {
  const safeKm = Math.max(0.1, Number.isFinite(km) ? km : 0.1);
  const safeMinutes = Math.max(4, Math.round(minutes ?? (safeKm / 28) * 60));
  const rules = readAdminFareCardRules();
  const suffix = passengerFareSuffix(passengerType);
  const fixedDestination = detectFixedDestinationId(originOrDestinationText);

  if (fixedDestination) {
    const specificFixedRule = findActiveFareRule(
      rules,
      `${fixedDestination}_${suffix}_roundtrip`,
    );

    if (specificFixedRule?.fixedClp != null && specificFixedRule.fixedClp > 0) {
      const fare = Math.ceil(specificFixedRule.fixedClp / 100) * 100;
      return {
        km: Number(safeKm.toFixed(1)),
        minutes: safeMinutes,
        fare,
        driverEarnings: roundFare(fare * 0.85),
        isZoneFare: true,
      };
    }

    const residentFixedRule = findActiveFareRule(
      rules,
      `${fixedDestination}_resident_roundtrip`,
    );

    if (residentFixedRule?.fixedClp != null && residentFixedRule.fixedClp > 0) {
      const fare = Math.ceil((residentFixedRule.fixedClp * passengerFareMultiplier(passengerType)) / 100) * 100;
      return {
        km: Number(safeKm.toFixed(1)),
        minutes: safeMinutes,
        fare,
        driverEarnings: roundFare(fare * 0.85),
        isZoneFare: true,
      };
    }
  }

  const vehiclePrefix = vehicleFarePrefix(vehicleCategory);
  const ruleId =
    vehiclePrefix === "standard"
      ? `${suffix}_standard`
      : `${vehiclePrefix}_${suffix}`;

  const specificVariableRule = findActiveFareRule(rules, ruleId);

  if (specificVariableRule?.minimumClp != null || specificVariableRule?.kmClp != null) {
    const minimumFare = Math.max(0, Number(specificVariableRule.minimumClp ?? 5000));
    const perKm = Math.max(0, Number(specificVariableRule.kmClp ?? 1000));
    const additionalKm = Math.max(0, safeKm - 2);
    const fare = Math.ceil((minimumFare + additionalKm * perKm) / 100) * 100;

    return {
      km: Number(safeKm.toFixed(1)),
      minutes: safeMinutes,
      fare,
      driverEarnings: roundFare(fare * 0.85),
      isZoneFare: false,
    };
  }

  const generalMinimumRule = findActiveFareRule(rules, "general_minimum");
  const generalKmRule = findActiveFareRule(rules, "general_km");
  const minimumFare =
    Math.max(0, Number(generalMinimumRule?.minimumClp ?? 5000)) *
    passengerFareMultiplier(passengerType);
  const perKm =
    Math.max(0, Number(generalKmRule?.kmClp ?? 1000)) *
    passengerFareMultiplier(passengerType);
  const additionalKm = Math.max(0, safeKm - 2);
  const fare = Math.ceil((minimumFare + additionalKm * perKm) / 100) * 100;

  return {
    km: Number(safeKm.toFixed(1)),
    minutes: safeMinutes,
    fare,
    driverEarnings: roundFare(fare * 0.85),
    isZoneFare: false,
  };
}

function calculateRapaGoFare(
  km: number,
  minutes?: number,
  passengerType: PassengerFareType = "chilean",
  originOrDestinationText = "",
  vehicleCategory: VehicleFareCategory = "standard",
): {
  km: number;
  minutes: number;
  fare: number;
  driverEarnings: number;
  isZoneFare: boolean;
} {
  const engineConfig = readAdminFareEngineConfig();

  if (engineConfig) {
    return calculateRapaGoFareFromEngine(
      km,
      minutes,
      passengerType,
      vehicleCategory,
      originOrDestinationText,
      engineConfig,
    );
  }

  return calculateRapaGoFareFromCompatibilityRules(
    km,
    minutes,
    passengerType,
    vehicleCategory,
    originOrDestinationText,
  );
}

function getCoordsFromPlaceId(placeId: string): { lat: number; lng: number } | null {
  const place = RAPA_NUI_PLACES.find((p) => p.id === placeId) as
    | ({ lat?: number | null; lng?: number | null; latitude?: number | null; longitude?: number | null })
    | undefined;

  if (!place) return null;

  const lat = place.lat ?? place.latitude ?? null;
  const lng = place.lng ?? place.longitude ?? null;

  if (lat == null || lng == null) return null;

  return { lat: Number(lat), lng: Number(lng) };
}


function passengerCardStyle(extra?: React.CSSProperties): React.CSSProperties {
  return {
    margin: 0,
    borderRadius: "22px",
    overflow: "hidden",
    background: "rgba(246,242,236,.97)",
    border: "1px solid rgba(200,155,60,.26)",
    boxShadow: "0 14px 32px rgba(0,0,0,.24)",
    color: "#111",
    ...extra,
  };
}

function passengerInputItemStyle(extra?: React.CSSProperties): React.CSSProperties {
  return {
    "--background": "#ffffff",
    "--color": "#111111",
    "--placeholder-color": "#6b6b6b",
    "--placeholder-opacity": "1",
    "--highlight-color-focused": "#C89B3C",
    border: "1.5px solid rgba(200,155,60,.48)",
    borderRadius: "16px",
    overflow: "hidden",
    marginTop: "8px",
    fontWeight: 900,
    ...extra,
  } as React.CSSProperties;
}



type RapaGoPassengerTileProps = {
  icon: string;
  title: string;
  subtitle: string;
  statusLabel?: string;
  accent: string;
  muted?: boolean;
  onClick?: () => void;
};

function RapaGoPassengerHomeTile({
  icon,
  title,
  subtitle,
  statusLabel,
  accent,
  muted = false,
  onClick,
}: RapaGoPassengerTileProps): JSX.Element {
  return (
    <IonCard
      button={Boolean(onClick)}
      onClick={onClick}
      style={{
        margin: 0,
        borderRadius: "24px",
        background: muted
          ? "linear-gradient(145deg, rgba(246,242,236,.78), rgba(236,222,194,.86))"
          : "linear-gradient(145deg, #ffffff 0%, #F6F2EC 100%)",
        color: "#111827",
        border: muted
          ? "1.5px dashed rgba(210,164,58,.58)"
          : "1.5px solid rgba(210,164,58,.32)",
        boxShadow: muted
          ? "0 10px 24px rgba(0,0,0,.14)"
          : "0 18px 38px rgba(0,0,0,.22)",
        overflow: "hidden",
        minHeight: 154,
        opacity: muted ? .88 : 1,
      }}
    >
      <IonCardContent
        style={{
          padding: "16px 13px",
          minHeight: 154,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          gap: 8,
        }}
      >
        <div
          style={{
            width: 58,
            height: 58,
            borderRadius: 20,
            background: muted
              ? "linear-gradient(135deg,#e5dac5,#cdb68a)"
              : accent,
            color: "#111827",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: muted
              ? "0 10px 22px rgba(0,0,0,.12)"
              : "0 12px 28px rgba(210,164,58,.24)",
          }}
        >
          <IonIcon icon={icon} style={{ fontSize: 30 }} />
        </div>

        {statusLabel && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "4px 8px",
              borderRadius: 999,
              background: muted ? "rgba(143,63,37,.12)" : "rgba(34,197,94,.12)",
              color: muted ? "#8F3F25" : "#166534",
              fontSize: ".60rem",
              fontWeight: 950,
              letterSpacing: ".04em",
              textTransform: "uppercase",
            }}
          >
            {statusLabel}
          </span>
        )}

        <div style={{ fontWeight: 950, fontSize: "1.02rem", lineHeight: 1.1 }}>
          {title}
        </div>
        <div
          style={{
            color: "#4b5563",
            fontSize: ".78rem",
            fontWeight: 850,
            lineHeight: 1.25,
          }}
        >
          {subtitle}
        </div>
      </IonCardContent>
    </IonCard>
  );
}

function RapaGoPassengerInfoCard({
  icon,
  eyebrow,
  title,
  body,
  onClick,
  dark = false,
}: {
  icon: string;
  eyebrow: string;
  title: string;
  body: string;
  onClick?: () => void;
  dark?: boolean;
}): JSX.Element {
  return (
    <IonCard
      button={Boolean(onClick)}
      onClick={onClick}
      style={{
        minWidth: 270,
        margin: 0,
        borderRadius: 22,
        background: dark
          ? "linear-gradient(135deg,#111827,#8F3F25)"
          : "linear-gradient(135deg,#F6F2EC,#ECD49A)",
        color: dark ? "#F6F2EC" : "#111827",
        border: "1px solid rgba(210,164,58,.32)",
        boxShadow: "0 14px 32px rgba(0,0,0,.20)",
      }}
    >
      <IonCardContent style={{ padding: "15px" }}>
        <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 18,
              background: dark ? "rgba(248,216,121,.18)" : "rgba(210,164,58,.22)",
              color: dark ? "#F8D879" : "#8F3F25",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <IonIcon icon={icon} style={{ fontSize: 26 }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: ".68rem",
                fontWeight: 950,
                textTransform: "uppercase",
                letterSpacing: ".05em",
                opacity: .82,
              }}
            >
              {eyebrow}
            </div>
            <div style={{ marginTop: 4, fontWeight: 950, fontSize: "1rem", lineHeight: 1.15 }}>
              {title}
            </div>
            <div
              style={{
                marginTop: 6,
                color: dark ? "rgba(246,242,236,.78)" : "rgba(17,24,39,.72)",
                fontSize: ".78rem",
                fontWeight: 800,
                lineHeight: 1.35,
              }}
            >
              {body}
            </div>
          </div>
        </div>
      </IonCardContent>
    </IonCard>
  );
}

export function PassengerHomePage(): JSX.Element {
  const history = useHistory();
  const passengerConnection = useRapaGoConnectivityMonitor("passenger");
  const { session } = useAuth();
  const [profile, setProfile] = useState<PassengerProfileData | null>(null);
  const [residentVerificationRevision, setResidentVerificationRevision] = useState(0);

  useEffect(() => {
    if (!session?.accessToken) return;
    void passengerProfileService.getMyProfile(session.accessToken)
      .then((data) => {
        const storedPhone = getAutoPhone(getSessionPhone(session?.user), data?.phone);
        if (storedPhone) {
          persistPassengerAutofill({
            phone: storedPhone,
            email: session?.user?.email ?? null,
            name: session?.user?.name ?? null,
          });
        }
        setProfile(data);
      })
      .catch(() => {
        const storedPhone = getAutoPhone(getSessionPhone(session?.user), null);
        if (storedPhone) {
          persistPassengerAutofill({
            phone: storedPhone,
            email: session?.user?.email ?? null,
            name: session?.user?.name ?? null,
          });
        }
      });
  }, [session?.accessToken]);

  useEffect(() => {
    const refresh = () => setResidentVerificationRevision((current) => current + 1);

    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener(
      "rapago:resident-verification-updated",
      refresh as EventListener,
    );

    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(
        "rapago:resident-verification-updated",
        refresh as EventListener,
      );
    };
  }, []);

  const name     = session?.user?.name ?? "";
  const firstName = name.split(" ")[0] || "pasajero";
  const initials  = name.trim().split(/\s+/).map((p: string) => p[0] ?? "").slice(0, 2).join("").toUpperCase() || "P";
  const phoneFromRegister = getAutoPhone(getSessionPhone(session?.user), profile?.phone);
  const hasPhone  = phoneFromRegister.length > 0;

  return (
    <IonPage>
      <RapaGoLanguageRuntime />
      {/* Branded header — no IonHeader to allow full custom gradient */}
      <div style={{
        background: "linear-gradient(145deg, var(--ion-color-primary) 0%, var(--ion-color-primary-shade) 100%)",
        padding: "calc(env(safe-area-inset-top) + 12px) 16px 20px",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* Avatar */}
            <div style={{
              width: "48px", height: "48px", borderRadius: "50%",
              background: "rgba(255,255,255,0.2)",
              border: "2px solid rgba(255,255,255,0.5)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: 800, fontSize: "1.1rem", flexShrink: 0,
              overflow: "hidden",
            }}>
              {initials}
            </div>
            <div>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: "1.05rem", lineHeight: 1.2 }}>
                Hola, {firstName} 👋
              </div>
              <div style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.8rem", marginTop: "2px" }}>
                ¿A dónde vamos hoy?
              </div>
            </div>
          </div>
          {/* Notification bell */}
          <div style={{ color: "#fff" }}>
            <IonIcon
              icon={ellipseOutline}
              style={{ fontSize: "1.6rem", opacity: 0.7 }}
            />
          </div>
        </div>
      </div>

      <IonContent>
        <div style={{ padding: "0 16px 80px" }}>

          <ResidentVerificationStatusCard
            key={residentVerificationRevision}
            user={session?.user}
            onChanged={() =>
              setResidentVerificationRevision((current) => current + 1)
            }
          />

          {/* Offline / phone warnings */}
          {profile !== null && !hasPhone && (
            <div style={{ margin: "12px 0 0", background: "#fff3cd", border: "1px solid #ffc107", borderRadius: "12px", padding: "10px 14px" }}>
              <IonText>
                <p style={{ margin: 0, fontSize: "0.82rem", color: "#6b4700" }}>

                </p>
              </IonText>
            </div>
          )}
          <RapaGoConnectivityBanner
            role="passenger"
            status={passengerConnection.status}
            style={{ marginTop: 12 }}
          />

          {/* ── Servicios principales de lanzamiento ── */}
          <div style={{ marginTop: "20px" }}>
            <div style={{ fontWeight: 950, fontSize: "1.05rem", marginBottom: "12px", color: "var(--ion-text-color)" }}>
              Servicios Rapa Go
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "12px",
            }}>
              <RapaGoPassengerHomeTile
                icon={carOutline}
                title="Viaje"
                subtitle="Solicitar o agendar"
                statusLabel="Disponible"
                accent="linear-gradient(135deg,#D2A43A,#F8D879)"
                onClick={() => history.push(ROUTES.PASSENGER.REQUEST_RIDE)}
              />
              <RapaGoPassengerHomeTile
                icon={carSportOutline}
                title="Reserva vehículo"
                subtitle="Arriendo en Rapa Nui"
                statusLabel="Disponible"
                accent="linear-gradient(135deg,#22c55e,#D2A43A)"
                onClick={() => history.push(ROUTES.PASSENGER.RENTALS)}
              />
              <RapaGoPassengerHomeTile
                icon={mapOutline}
                title="Turismo local"
                subtitle="Guías y tours pronto"
                statusLabel="Próximamente"
                accent="linear-gradient(135deg,#C5532F,#F8D879)"
                muted
                onClick={() => history.push(ROUTES.PASSENGER.GUIDES)}
              />
              <RapaGoPassengerHomeTile
                icon={ticketOutline}
                title="Eventos"
                subtitle="Cultura y panoramas"
                statusLabel="Próximamente"
                accent="linear-gradient(135deg,#111827,#D2A43A)"
                muted
                onClick={() => history.push(ROUTES.PASSENGER.EVENTS)}
              />
            </div>
          </div>

          {/* ── Próximamente y billetera ── */}
          <div style={{ marginTop: "24px" }}>
            <div style={{ fontWeight: 950, fontSize: "1.05rem", marginBottom: "10px", color: "var(--ion-text-color)" }}>
              Próximamente en Rapa Go
            </div>

            <div style={{ display: "flex", gap: "12px", overflowX: "auto", paddingBottom: "4px" }}>
              <RapaGoPassengerInfoCard
                icon={compassOutline}
                eyebrow="Turismo"
                title="Guías locales"
                body="Estamos preparando perfiles de guías, rutas y experiencias turísticas aprobadas para Rapa Nui."
                onClick={() => history.push(ROUTES.PASSENGER.GUIDES)}
              />

              <RapaGoPassengerInfoCard
                icon={ticketOutline}
                eyebrow="Eventos"
                title="Actividades culturales"
                body="Los eventos quedarán disponibles cuando el administrador publique experiencias y entradas oficiales."
                onClick={() => history.push(ROUTES.PASSENGER.EVENTS)}
                dark
              />

              <RapaGoPassengerInfoCard
                icon={walletOutline}
                eyebrow="Billetera"
                title="Saldo a favor"
                body="Si pagas de más o queda una diferencia, el administrador podrá revisarlo y dejarlo como saldo para próximos viajes si corresponde."
                onClick={() => history.push(ROUTES.PASSENGER.WALLET)}
              />
            </div>
          </div>

          {/* ── Accesos secundarios ── */}
          <div style={{ marginTop: "24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <IonCard
              className="ion-activatable"
              style={{ margin: 0, borderRadius: "14px", cursor: "pointer" }}
              routerLink={ROUTES.PASSENGER.TRIPS}
            >
              <IonCardContent style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: "10px" }}>
                <IonIcon icon={carOutline} style={{ fontSize: "1.4rem", color: "var(--ion-color-primary)", flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>Mis Viajes</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--ion-color-medium)" }}>Historial</div>
                </div>
              </IonCardContent>
            </IonCard>
            <IonCard
              className="ion-activatable"
              style={{ margin: 0, borderRadius: "14px", cursor: "pointer" }}
              routerLink={ROUTES.PASSENGER.WALLET}
            >
              <IonCardContent style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: "10px" }}>
                <IonIcon icon={walletOutline} style={{ fontSize: "1.4rem", color: "var(--ion-color-success)", flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>Wallet</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--ion-color-medium)" }}>Saldo y pagos</div>
                </div>
              </IonCardContent>
            </IonCard>
          </div>
          {/* Producción: banner de referidos eliminado. */}
          {/* Producción: postulaciones desde módulo dedicado. */}

        </div>
      </IonContent>
    </IonPage>
  );
}

const LOCAL_ADMIN_SCHEDULED_RIDES_KEY = "rapago_admin_scheduled_rides";
const SCHEDULE_MIN_MINUTES = 30;
const SCHEDULE_MAX_DAYS = 30;
const SCHEDULE_ACTIVATION_MINUTES = 10;

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
}): string | null {
  if (input.rideMode !== "scheduled") return null;

  const pickup = parseScheduleInput(input.scheduledAt);
  if (!pickup) return "Debes seleccionar fecha y hora de recogida.";

  const now = new Date();
  const min = new Date(now.getTime() + SCHEDULE_MIN_MINUTES * 60_000);
  const max = new Date(now.getTime() + SCHEDULE_MAX_DAYS * 24 * 60 * 60_000);

  if (pickup.getTime() < min.getTime()) return `La reserva debe ser mínimo ${SCHEDULE_MIN_MINUTES} minutos desde ahora.`;
  if (pickup.getTime() > max.getTime()) return `La reserva no puede superar ${SCHEDULE_MAX_DAYS} días.`;

  if (input.tripFareMode === "round_trip") {
    const back = parseScheduleInput(input.returnScheduledAt);
    if (!back) return "Para ida y vuelta debes seleccionar la hora de regreso.";
    if (back.getTime() <= pickup.getTime()) return "La hora de regreso debe ser posterior a la hora de recogida.";
    if (back.getTime() > max.getTime()) return `La hora de regreso no puede superar ${SCHEDULE_MAX_DAYS} días.`;
  }

  return null;
}

function buildRideScheduleFields(input: {
  rideMode: RideMode;
  tripFareMode: TripFareMode;
  scheduledAt: string;
  returnScheduledAt: string;
}): Record<string, unknown> {
  const pickup = input.rideMode === "scheduled" ? parseScheduleInput(input.scheduledAt) : null;
  const back = input.rideMode === "scheduled" && input.tripFareMode === "round_trip" ? parseScheduleInput(input.returnScheduledAt) : null;
  const activation = pickup ? new Date(pickup.getTime() - SCHEDULE_ACTIVATION_MINUTES * 60_000) : null;

  return {
    rideMode: input.rideMode,
    requestMode: input.rideMode,
    isScheduled: input.rideMode === "scheduled" && !!pickup,
    scheduleStatus: input.rideMode === "scheduled" && !!pickup ? "pending_activation" : "immediate",
    scheduledAt: pickup?.toISOString() ?? null,
    scheduledPickupAt: pickup?.toISOString() ?? null,
    pickupScheduledAt: pickup?.toISOString() ?? null,
    returnScheduledAt: back?.toISOString() ?? null,
    scheduledReturnAt: back?.toISOString() ?? null,
    scheduleActivationAt: activation?.toISOString() ?? null,
    dispatchAt: activation?.toISOString() ?? null,
    autoAssignAt: activation?.toISOString() ?? null,
    autoDispatchMinutesBefore: SCHEDULE_ACTIVATION_MINUTES,
    tripFareMode: input.tripFareMode,
    tripType: input.tripFareMode,
    isRoundTrip: input.tripFareMode === "round_trip",
  };
}

function tripFareModeLabel(mode: TripFareMode): string {
  return mode === "round_trip" ? "Ida y vuelta" : "Solo ida";
}

function tripFareModeDescription(mode: TripFareMode): string {
  return mode === "round_trip" ? "Agenda hora de regreso" : "Un solo tramo";
}

function readLocalAdminScheduledRides(): RideRequestData[] {
  try {
    const raw = localStorage.getItem(LOCAL_ADMIN_SCHEDULED_RIDES_KEY);
    const parsed = raw ? (JSON.parse(raw) as RideRequestData[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalAdminScheduledRides(rides: RideRequestData[]): void {
  try {
    localStorage.setItem(LOCAL_ADMIN_SCHEDULED_RIDES_KEY, JSON.stringify(rides));
    window.dispatchEvent(new CustomEvent("rapago:admin-scheduled-rides-updated"));
  } catch {
    // No bloquea la app.
  }
}

function getScheduledRideKey(ride: Partial<RideRequestData> & Record<string, unknown>): string {
  return [
    ride.scheduledAt ?? ride.scheduledPickupAt ?? "",
    ride.originText ?? "",
    ride.destinationText ?? "",
    ride.passengerEmail ?? "",
  ]
    .map((value) => String(value).trim().toLowerCase())
    .join("|");
}

function upsertLocalAdminScheduledRide(ride: RideRequestData): void {
  if ((ride as unknown as Record<string, unknown>).isScheduled !== true) return;
  const key = getScheduledRideKey(ride as unknown as Record<string, unknown>);
  const withoutDuplicate = readLocalAdminScheduledRides().filter(
    (item) => getScheduledRideKey(item as unknown as Record<string, unknown>) !== key,
  );
  saveLocalAdminScheduledRides([ride, ...withoutDuplicate]);
}

function getUserDisplayName(user: unknown): string | null {
  if (!user || typeof user !== "object") return null;
  const data = user as Record<string, unknown>;
  const value = data.name ?? data.fullName ?? data.firstName;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getUserEmail(user: unknown): string | null {
  if (!user || typeof user !== "object") return null;
  const value = (user as Record<string, unknown>).email;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function PassengerRequestRidePage(): JSX.Element {
  return <RequestRidePage />;
}

function RequestRidePage(): JSX.Element {
  const { session } = useAuth();
  const history = useHistory();
  const passengerConnection = useRapaGoConnectivityMonitor("passenger");

  const [originInput,       setOriginInput]       = useState("");
  const [destInput,         setDestInput]         = useState("");
  const [notesInput,        setNotesInput]        = useState("");
  const [selectedOriginId,  setSelectedOriginId]  = useState<string>("");
  const [selectedDestId,    setSelectedDestId]    = useState<string>("");
  const [submitting,        setSubmitting]        = useState(false);
  const [submitError,       setSubmitError]       = useState<string | null>(null);
  const [farePreview,       setFarePreview]       = useState<{ km: number; minutes: number; fare: number; driverEarnings: number; isZoneFare: boolean } | null>(null);
  const [paymentMethod,     setPaymentMethod]     = useState<"cash" | "card" | null>(null);
  const [vehicleCategory,   setVehicleCategory]   = useState<VehicleFareCategory>("standard");
  const [rideMode,          setRideMode]          = useState<RideMode>("now");
  const [tripFareMode,      setTripFareMode]      = useState<TripFareMode>("one_way");
  const [scheduledAt,       setScheduledAt]       = useState("");
  const [returnScheduledAt, setReturnScheduledAt] = useState("");

  const [currentLat,        setCurrentLat]        = useState<number | null>(null);
  const [currentLng,        setCurrentLng]        = useState<number | null>(null);
  const [locating,          setLocating]          = useState(false);
  const [locationError,     setLocationError]     = useState<string | null>(null);
  const [pickupConfirmed,   setPickupConfirmed]   = useState(false);

  const passengerFareType = readPassengerFareType(session?.user);
  const [blockingRide, setBlockingRide] = useState<RideRequestData | null>(() => findBlockingPassengerRide());

  useEffect(() => {
    const refreshBlockingRide = () => setBlockingRide(findBlockingPassengerRide());
    refreshBlockingRide();
    window.addEventListener("storage", refreshBlockingRide);
    window.addEventListener("rapago:passenger-rides-updated", refreshBlockingRide as EventListener);

    return () => {
      window.removeEventListener("storage", refreshBlockingRide);
      window.removeEventListener("rapago:passenger-rides-updated", refreshBlockingRide as EventListener);
    };
  }, []);

  useEffect(() => {
    const originPoint =
      currentLat != null && currentLng != null
        ? { lat: currentLat, lng: currentLng }
        : selectedOriginId
          ? getCoordsFromPlaceId(selectedOriginId)
          : null;

    const destinationPoint = selectedDestId ? getCoordsFromPlaceId(selectedDestId) : null;

    if (!originPoint || !destinationPoint) {
      setFarePreview(null);
      setPaymentMethod(null);
      return;
    }

    const directKm = distanceKmByCoords(originPoint, destinationPoint);
    const routeKm = Math.max(0.1, directKm * 1.25);
    const minutes = Math.max(4, Math.round((routeKm / 28) * 60));

    const originName = selectedOriginId
      ? RAPA_NUI_PLACES.find((p) => p.id === selectedOriginId)?.name ?? originInput
      : originInput;
    const destName = selectedDestId
      ? RAPA_NUI_PLACES.find((p) => p.id === selectedDestId)?.name ?? destInput
      : destInput;

    const fareContextText = `${originName} ${destName}`;
    const calculated = calculateRapaGoFare(
      routeKm,
      minutes,
      passengerFareType,
      fareContextText,
      vehicleCategory,
    );

    if (!selectedOriginId || !selectedDestId) {
      setFarePreview(calculated);
      return;
    }

    const dist = getDistanceBetween(selectedOriginId, selectedDestId);

    if (dist) {
      setFarePreview(
        calculateRapaGoFare(
          dist.km,
          dist.minutes,
          passengerFareType,
          fareContextText,
          vehicleCategory,
        ),
      );
      return;
    }

    setFarePreview(calculated);
  }, [selectedOriginId, selectedDestId, originInput, destInput, currentLat, currentLng, passengerFareType, vehicleCategory]);

  const sortedPlaces = [...RAPA_NUI_PLACES]
    .filter((place) => isPassengerFrequentDestination(place.name))
    .sort((a, b) => {
      if (a.isPopular && !b.isPopular) return -1;
      if (!a.isPopular && b.isPopular) return 1;
      return a.sortOrder - b.sortOrder;
    });

  function getPlaceCoordinates(placeId: string): { lat?: number | null; lng?: number | null } {
    const place = RAPA_NUI_PLACES.find((p) => p.id === placeId) as
      | ({ lat?: number | null; lng?: number | null; latitude?: number | null; longitude?: number | null })
      | undefined;

    if (!place) return {};

    return {
      lat: place.lat ?? place.latitude ?? null,
      lng: place.lng ?? place.longitude ?? null,
    };
  }

  function handleOriginPlaceSelect(placeId: string) {
    const place = RAPA_NUI_PLACES.find((p) => p.id === placeId);
    if (place) {
      setOriginInput(place.name);
      setSelectedOriginId(placeId);
      setPickupConfirmed(false);
    }
  }

  function handleDestPlaceSelect(placeId: string) {
    const place = RAPA_NUI_PLACES.find((p) => p.id === placeId);
    if (place) {
      setDestInput(place.name);
      setSelectedDestId(placeId);
    }
  }

  function handleUseCurrentLocation() {
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError("Tu navegador no permite obtener ubicación.");
      return;
    }

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLat(position.coords.latitude);
        setCurrentLng(position.coords.longitude);
        setOriginInput("Mi ubicación actual");
        setSelectedOriginId("");
        setPickupConfirmed(false);
        setLocating(false);
      },
      () => {
        setLocationError("No se pudo obtener tu ubicación. Activa el GPS y vuelve a intentar.");
        setLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 30000,
      },
    );
  }

  async function handleRequest() {
    const origin = originInput.trim();
    const dest = destInput.trim();

    if (passengerConnection.blocked) {
      setSubmitError(passengerConnection.message);
      return;
    }

    if (!origin || !dest) {
      setSubmitError("Origen y destino son requeridos.");
      return;
    }

    const currentBlockingRide = findBlockingPassengerRide();
    if (currentBlockingRide) {
      setBlockingRide(currentBlockingRide);
      setSubmitError("Ya tienes un viaje o una reserva activa. Revísala en Mis Viajes antes de solicitar otra.");
      return;
    }

    if (!pickupConfirmed) {
      setSubmitError("Confirma primero el punto de partida recomendado.");
      return;
    }

    if (!farePreview) {
      setSubmitError("No se pudo calcular la tarifa. Selecciona origen, destino y confirma el punto.");
      return;
    }

    const scheduleError = getScheduleValidationError({
      rideMode,
      tripFareMode,
      scheduledAt,
      returnScheduledAt,
    });

    if (scheduleError) {
      setSubmitError(scheduleError);
      return;
    }

    if (paymentMethod === "card") {
      setSubmitError("El pago con tarjeta estará disponible próximamente. Por ahora selecciona efectivo.");
      return;
    }

    if (paymentMethod !== "cash") {
      setSubmitError("Selecciona una forma de pago para solicitar el viaje.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const input: import("../../features/rides/rides.service").CreateRideInput = {
      originText: origin,
      destinationText: dest,
    };

    // Guardamos el precio real calculado para que lo vea pasajero, conductor y admin.
    (input as unknown as { estimatedFareClp?: number; paymentMethod?: string }).estimatedFareClp = tripFareMode === "round_trip" ? farePreview.fare * 2 : farePreview.fare;
    (input as unknown as { estimatedFareClp?: number; paymentMethod?: string }).paymentMethod = "cash";
    (input as unknown as { passengerFareType?: PassengerFareType; farePassengerType?: PassengerFareType }).passengerFareType = passengerFareType;
    (input as unknown as { passengerFareType?: PassengerFareType; farePassengerType?: PassengerFareType }).farePassengerType = passengerFareType;
    (input as unknown as { passengerFareLabel?: string; nationality?: string; isResident?: boolean; requestedByRole?: string; requesterRole?: string }).passengerFareLabel = passengerFareTypeLabel(passengerFareType);
    (input as unknown as { passengerFareLabel?: string; nationality?: string; isResident?: boolean; requestedByRole?: string; requesterRole?: string }).nationality = passengerFareTypeLabel(passengerFareType);
    (input as unknown as { passengerFareLabel?: string; nationality?: string; isResident?: boolean; requestedByRole?: string; requesterRole?: string }).isResident = passengerFareType === "resident";
    (input as unknown as { requestedByRole?: string; requesterRole?: string }).requestedByRole = "passenger";
    (input as unknown as { requestedByRole?: string; requesterRole?: string }).requesterRole = "passenger";
    (input as unknown as { fareVehicleCategory?: VehicleFareCategory; vehicleCategory?: VehicleFareCategory }).fareVehicleCategory = vehicleCategory;
    (input as unknown as { fareVehicleCategory?: VehicleFareCategory; vehicleCategory?: VehicleFareCategory }).vehicleCategory = vehicleCategory;
    (input as unknown as { tripFareMode?: TripFareMode; tripType?: string; isRoundTrip?: boolean }).tripFareMode = tripFareMode;
    (input as unknown as { tripFareMode?: TripFareMode; tripType?: string; isRoundTrip?: boolean }).tripType = tripFareMode;
    (input as unknown as { tripFareMode?: TripFareMode; tripType?: string; isRoundTrip?: boolean }).isRoundTrip = tripFareMode === "round_trip";
    Object.assign(input as unknown as Record<string, unknown>, buildRideScheduleFields({ rideMode, tripFareMode, scheduledAt, returnScheduledAt }));

    const selectedFare = tripFareMode === "round_trip" ? farePreview.fare * 2 : farePreview.fare;
    const selectedDriverEarnings = tripFareMode === "round_trip" ? farePreview.driverEarnings * 2 : farePreview.driverEarnings;

    const notes: string[] = [];

    if (currentLat !== null && currentLng !== null) {
      notes.push(`Ubicación real del pasajero: ${currentLat.toFixed(6)}, ${currentLng.toFixed(6)}.`);
      notes.push(`Coordenadas recogida accesible: ${currentLat.toFixed(6)}, ${currentLng.toFixed(6)}.`);
    } else if (originCoords.lat != null && originCoords.lng != null) {
      notes.push(`Coordenadas recogida accesible: ${Number(originCoords.lat).toFixed(6)}, ${Number(originCoords.lng).toFixed(6)}.`);
    }

    if (destCoords.lat != null && destCoords.lng != null) {
      notes.push(`Coordenadas destino accesible: ${Number(destCoords.lat).toFixed(6)}, ${Number(destCoords.lng).toFixed(6)}.`);
    }

    notes.push("Punto de partida confirmado por pasajero.");
    notes.push(`Tarifa RAPA GO calculada: ${selectedFare} CLP.`);
    notes.push(`Kilómetros calculados: ${farePreview.km.toFixed(1)} km.`);
    notes.push(`Categoría de vehículo: ${vehicleFareLabel(vehicleCategory)}.`);
    notes.push(`Tipo de pasajero tarifario: ${passengerFareTypeLabel(passengerFareType)}.`);
    notes.push(`Tipo de viaje seleccionado: ${tripFareModeLabel(tripFareMode)}.`);
    notes.push(`Ganancia aprox. conductor: ${selectedDriverEarnings} CLP.`);
    notes.push("Forma de pago: efectivo.");

    const scheduleFields = buildRideScheduleFields({ rideMode, tripFareMode, scheduledAt, returnScheduledAt });
    if (rideMode === "scheduled") {
      notes.push(`Viaje agendado para: ${formatScheduleDateTime(String(scheduleFields.scheduledAt ?? scheduledAt))}.`);
      notes.push(`La solicitud se activa automáticamente ${SCHEDULE_ACTIVATION_MINUTES} minutos antes: ${formatScheduleDateTime(String(scheduleFields.scheduleActivationAt ?? ""))}.`);
      if (tripFareMode === "round_trip") {
        notes.push(`Regreso agendado para: ${formatScheduleDateTime(String(scheduleFields.returnScheduledAt ?? returnScheduledAt))}.`);
      }
    }

    const trimNotes = notesInput.trim();
    if (trimNotes) notes.push(trimNotes);

    input.notes = notes.join(" ");

    const localPassengerMirror = createLocalPassengerRide({
      originText: input.originText,
      destinationText: input.destinationText,
      notes: input.notes,
      estimatedFareClp: selectedFare,
      rideMode,
      tripFareMode,
      scheduledAt,
      returnScheduledAt,
    });

    try {
      if (!session?.accessToken) {
        throw new Error("No se pudo conectar con el servidor.");
      }

      await ridesService.createRideRequest(session.accessToken, input);

      // Guardamos espejo local para que Mis Viajes muestre inmediatamente el viaje/reserva.
      // Así el pasajero no queda con pantalla vacía ni solicita otro por error.
      upsertLocalPassengerRideMirror(localPassengerMirror);

      if (rideMode === "scheduled") {
        upsertLocalAdminScheduledRide({
          ...(localPassengerMirror as RideRequestData),
          id: `admin-local-${Date.now()}`,
          createdAt: new Date().toISOString(),
          passengerName: getUserDisplayName(session?.user) ?? "Pasajero agendado",
          passengerEmail: getUserEmail(session?.user) ?? "sin-correo-local",
        } as unknown as RideRequestData);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al solicitar el viaje.";

      if (isUnauthorizedMessage(message)) {
        upsertLocalPassengerRideMirror(localPassengerMirror);

        if (rideMode === "scheduled") {
          upsertLocalAdminScheduledRide({
            ...(localPassengerMirror as RideRequestData),
            id: `admin-local-${Date.now()}`,
            createdAt: new Date().toISOString(),
            passengerName: getUserDisplayName(session?.user) ?? "Pasajero agendado",
            passengerEmail: getUserEmail(session?.user) ?? "sin-correo-local",
          } as unknown as RideRequestData);
        }
      } else {
        setSubmitError(safePassengerErrorMessage(message));
        setSubmitting(false);
        return;
      }
    } finally {
      setSubmitting(false);
    }

    setOriginInput("");
    setDestInput("");
    setNotesInput("");
    setSelectedOriginId("");
    setSelectedDestId("");
    setCurrentLat(null);
    setCurrentLng(null);
    setPickupConfirmed(false);
    setPaymentMethod(null);
    setVehicleCategory("standard");
    setRideMode("now");
    setTripFareMode("one_way");
    setScheduledAt("");
    setReturnScheduledAt("");

    history.push(ROUTES.PASSENGER.TRIPS);
  }

  const originCoords = selectedOriginId ? getPlaceCoordinates(selectedOriginId) : {};
  const destCoords   = selectedDestId ? getPlaceCoordinates(selectedDestId) : {};

  const mapOrigin = {
    ...(selectedOriginId ? { id: selectedOriginId } : {}),
    text: originInput.trim() || "Mi ubicación",
    lat: currentLat ?? originCoords.lat ?? null,
    lng: currentLng ?? originCoords.lng ?? null,
  };

  const mapDestination = {
    ...(selectedDestId ? { id: selectedDestId } : {}),
    text: destInput.trim() || "Destino",
    lat: destCoords.lat ?? null,
    lng: destCoords.lng ?? null,
  };

  const fareDisplayAmount = farePreview ? (tripFareMode === "round_trip" ? farePreview.fare * 2 : farePreview.fare) : null;

  return (
    <IonPage>
      <RapaGoLanguageRuntime />
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Solicitar Viaje</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <div style={{ display: "flex", flexDirection: "column", gap: "14px", paddingBottom: "90px" }}>
          <RapaGoConnectivityBanner
            role="passenger"
            status={passengerConnection.status}
          />

          {blockingRide && (
            <IonCard
              style={passengerCardStyle({
                borderRadius: "22px",
                background: "linear-gradient(135deg,#fff8dc,#ffffff)",
                border: "1.5px solid rgba(255,201,40,.58)",
              })}
            >
              <IonCardContent style={{ padding: "14px 16px" }}>
                <div style={{ fontWeight: 950, color: "#111", marginBottom: 4 }}>
                  ⚠️ Ya tienes un viaje o reserva activa
                </div>
                <div style={{ fontSize: ".82rem", color: "#333", lineHeight: 1.35 }}>
                  {blockingRide.originText} → {blockingRide.destinationText}
                </div>
                {getPassengerRideScheduleInfo(blockingRide).isScheduled && (
                  <div style={{ fontSize: ".78rem", color: "#555", marginTop: 4 }}>
                    Recogida: {formatScheduleDateTime(getPassengerRideScheduleInfo(blockingRide).scheduledAt)}
                  </div>
                )}
                <IonButton
                  expand="block"
                  color="warning"
                  style={{ marginTop: 10, fontWeight: 900 }}
                  onClick={() => history.push(ROUTES.PASSENGER.TRIPS)}
                >
                  Ver en Mis Viajes
                </IonButton>
              </IonCardContent>
            </IonCard>
          )}

          <IonCard style={passengerCardStyle({ borderRadius: "24px" })}>
            <IonCardContent style={{ padding: 0 }}>
              <MapFallback
                origin={mapOrigin}
                destination={mapDestination}
                height={320}
                showRoute
              />

              <div style={{ padding: "14px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "12px",
                    borderRadius: "16px",
                    background: pickupConfirmed
                      ? "rgba(42, 168, 74, 0.12)"
                      : "rgba(200, 155, 60, 0.14)",
                    border: pickupConfirmed
                      ? "1px solid rgba(42, 168, 74, 0.28)"
                      : "1px solid rgba(200, 155, 60, 0.28)",
                  }}
                >
                  <div style={{ fontSize: "1.3rem" }}>{pickupConfirmed ? "✅" : "🚶"}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 900, fontSize: "0.88rem", color: "#1A1A1A" }}>
                      {pickupConfirmed ? "Punto de partida confirmado" : "Confirma el punto de partida"}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "rgba(26,26,26,.68)", marginTop: "2px", lineHeight: 1.35 }}>
                      En sectores con pasajes, condominios o calles interiores, Rapa Go recomendará una calle principal accesible para el conductor.
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "12px" }}>
                  <IonButton
                    expand="block"
                    fill="outline"
                    onClick={handleUseCurrentLocation}
                    disabled={locating}
                    style={{ margin: 0 }}
                  >
                    {locating ? <IonSpinner name="dots" /> : "Usar GPS"}
                  </IonButton>

                  <IonButton
                    expand="block"
                    color={pickupConfirmed ? "success" : "primary"}
                    onClick={() => setPickupConfirmed(true)}
                    disabled={!originInput.trim()}
                    style={{ margin: 0 }}
                  >
                    Confirmar punto
                  </IonButton>
                </div>

                {locationError && (
                  <IonText color="danger">
                    <p style={{ margin: "8px 0 0", fontSize: "0.78rem" }}>{locationError}</p>
                  </IonText>
                )}
              </div>
            </IonCardContent>
          </IonCard>

          <IonCard style={passengerCardStyle({ borderRadius: "24px" })}>
            <IonCardContent style={{ padding: "16px" }}>
              <IonItem lines="full" style={passengerInputItemStyle()}>
                <IonLabel>Lugar frecuente (origen)</IonLabel>
                <IonSelect
                  interface="action-sheet"
                  placeholder="Seleccionar origen frecuente"
                  value={selectedOriginId}
                  onIonChange={(e) => handleOriginPlaceSelect(e.detail.value as string)}
                >
                  {sortedPlaces.map((place) => (
                    <IonSelectOption key={place.id} value={place.id}>
                      {place.name}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>

              <IonItem lines="full" style={passengerInputItemStyle()}>
                <IonLabel position="stacked">Origen</IonLabel>
                <IonInput
                  value={originInput}
                  onIonInput={(e) => {
                    setOriginInput(sanitizeText(String(e.detail.value ?? ""), 150));
                    setSelectedOriginId("");
                    setPickupConfirmed(false);
                  }}
                  placeholder="Ej: Hotel Hanga Roa Eco Village"
                  maxlength={150}
                  clearInput
                />
              </IonItem>

              <IonItem lines="full" style={passengerInputItemStyle()}>
                <IonLabel>Lugar frecuente (destino)</IonLabel>
                <IonSelect
                  interface="action-sheet"
                  placeholder="Seleccionar destino frecuente"
                  value={selectedDestId}
                  onIonChange={(e) => handleDestPlaceSelect(e.detail.value as string)}
                >
                  {sortedPlaces.map((place) => (
                    <IonSelectOption key={place.id} value={place.id}>
                      {place.name}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>

              <IonItem lines="full" style={passengerInputItemStyle()}>
                <IonLabel position="stacked">Destino</IonLabel>
                <IonInput
                  value={destInput}
                  onIonInput={(e) => {
                    setDestInput(sanitizeText(String(e.detail.value ?? ""), 150));
                    setSelectedDestId("");
                  }}
                  placeholder="Ej: Aeropuerto Mataveri"
                  maxlength={150}
                  clearInput
                />
              </IonItem>

              <IonItem lines="full" style={passengerInputItemStyle()}>
                <IonLabel>Tipo de vehículo</IonLabel>
                <IonSelect
                  interface="action-sheet"
                  value={vehicleCategory}
                  onIonChange={(e) =>
                    setVehicleCategory(String(e.detail.value ?? "standard") as VehicleFareCategory)
                  }
                >
                  <IonSelectOption value="standard">Estándar</IonSelectOption>
                  <IonSelectOption value="xl">XL</IonSelectOption>
                  <IonSelectOption value="luggage">Extra maletas</IonSelectOption>
                </IonSelect>
              </IonItem>

              <div style={{ margin: "12px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <IonButton
                  expand="block"
                  fill={rideMode === "now" ? "solid" : "outline"}
                  onClick={() => {
                    setRideMode("now");
                    setScheduledAt("");
                    setReturnScheduledAt("");
                    setSubmitError(null);
                  }}
                >
                  Ahora
                </IonButton>
                <IonButton
                  expand="block"
                  fill={rideMode === "scheduled" ? "solid" : "outline"}
                  onClick={() => {
                    setRideMode("scheduled");
                    setSubmitError(null);
                  }}
                >
                  Agendar
                </IonButton>
              </div>

              <div style={{ margin: "6px 0 12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                {(["one_way", "round_trip"] as TripFareMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setTripFareMode(mode);
                      if (mode === "one_way") setReturnScheduledAt("");
                      setSubmitError(null);
                    }}
                    style={{
                      border: tripFareMode === mode ? "2px solid #D2A43A" : "1px solid rgba(0,0,0,.14)",
                      borderRadius: "16px",
                      padding: "12px 8px",
                      background: tripFareMode === mode ? "#F8D879" : "#fff",
                      color: "#111",
                      fontWeight: 950,
                      textAlign: "center",
                    }}
                  >
                    <div>{mode === "round_trip" ? "🔁" : "➡️"} {tripFareModeLabel(mode)}</div>
                    <div style={{ fontSize: ".68rem", opacity: .72, marginTop: 3 }}>{tripFareModeDescription(mode)}</div>
                  </button>
                ))}
              </div>

              {rideMode === "scheduled" && (
                <div style={{ background: "#f4f6fb", borderRadius: "18px", padding: "12px", marginBottom: "12px" }}>
                  <IonItem lines="full" style={passengerInputItemStyle()}>
                    <IonLabel position="stacked">Fecha y hora de recogida</IonLabel>
                    <IonInput
                      type="datetime-local"
                      value={scheduledAt}
                      min={toDateTimeLocalValue(new Date(Date.now() + SCHEDULE_MIN_MINUTES * 60_000))}
                      max={toDateTimeLocalValue(new Date(Date.now() + SCHEDULE_MAX_DAYS * 24 * 60 * 60_000))}
                      onIonInput={(e) => setScheduledAt(String(e.detail.value ?? ""))}
                    />
                  </IonItem>

                  {tripFareMode === "round_trip" && (
                    <IonItem lines="full" style={passengerInputItemStyle()}>
                      <IonLabel position="stacked">Hora de regreso</IonLabel>
                      <IonInput
                        type="datetime-local"
                        value={returnScheduledAt}
                        min={scheduledAt || toDateTimeLocalValue(new Date(Date.now() + SCHEDULE_MIN_MINUTES * 60_000))}
                        max={toDateTimeLocalValue(new Date(Date.now() + SCHEDULE_MAX_DAYS * 24 * 60 * 60_000))}
                        onIonInput={(e) => setReturnScheduledAt(String(e.detail.value ?? ""))}
                      />
                    </IonItem>
                  )}

                  <IonNote style={{ display: "block", fontSize: ".72rem", marginTop: "4px" }}>
                    Se guarda en Mis Viajes y se activa para buscar conductores {SCHEDULE_ACTIVATION_MINUTES} minutos antes de la reserva.
                  </IonNote>
                </div>
              )}

              <IonItem lines="none" style={passengerInputItemStyle()}>
                <IonLabel position="stacked">Notas (opcional)</IonLabel>
                <IonTextarea
                  value={notesInput}
                  onIonInput={(e) => setNotesInput(sanitizeText(String(e.detail.value ?? ""), 500))}
                  placeholder="Ej: Llevar maletas grandes"
                  maxlength={500}
                  rows={3}
                />
                <IonNote slot="helper" style={{ fontSize: "0.7rem" }}>
                  Máximo 500 caracteres.
                </IonNote>
              </IonItem>

              {farePreview && (
                <div
                  style={{
                    margin: "12px 0 0",
                    padding: "14px",
                    background: "linear-gradient(135deg,#fffdf8 0%,#f8f1df 48%,#ecd29a 100%)",
                    border: "2px solid rgba(216,179,90,.75)",
                    borderRadius: "22px",
                    boxShadow: "0 14px 30px rgba(0,0,0,.14)",
                    color: "#111111",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                    <div>
                      <div style={{ fontSize: "0.72rem", fontWeight: 950, color: "#8a6418", letterSpacing: ".04em" }}>
                        FORMA DE PAGO
                      </div>
                      <div style={{ fontSize: "1.55rem", fontWeight: 950, lineHeight: 1.05, marginTop: "4px" }}>
                        {formatClp(fareDisplayAmount ?? farePreview.fare)}
                      </div>
                      <div style={{ fontSize: "0.82rem", color: "#7A5417", marginTop: "3px", fontWeight: 950 }}>
                        {formatUsdFromClp(fareDisplayAmount ?? farePreview.fare)}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "rgba(17,17,17,.66)", marginTop: "5px" }}>
                        {farePreview.km.toFixed(1)} km · {farePreview.minutes} min · {farePreview.isZoneFare ? "tarifa fija" : "precio calculado"}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "rgba(17,17,17,.66)", marginTop: "3px", fontWeight: 850 }}>
                        Tarifa pasajero: {passengerFareTypeLabel(passengerFareType)}
                      </div>
                    </div>

                    <div
                      style={{
                        padding: "9px 12px",
                        borderRadius: "999px",
                        background: "rgba(212,166,42,.20)",
                        color: "#111",
                        fontWeight: 950,
                        fontSize: ".78rem",
                        flexShrink: 0,
                      }}
                    >
                      {vehicleFareLabel(vehicleCategory)}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px", marginTop: "14px" }}>
                    <button
                      type="button"
                      onClick={() => { setPaymentMethod("cash"); setSubmitError(null); }}
                      style={{
                        border: paymentMethod === "cash" ? "3px solid #ffffff" : "2px solid rgba(200,155,60,.45)",
                        borderRadius: "18px",
                        padding: "13px 10px",
                        background: "linear-gradient(180deg,#F7D774,#D4A62A)",
                        color: "#111111",
                        boxShadow: paymentMethod === "cash" ? "0 0 22px rgba(212,166,42,.55)" : "0 8px 18px rgba(0,0,0,.10)",
                        transform: paymentMethod === "cash" ? "scale(1.02)" : "scale(1)",
                        fontWeight: 950,
                      }}
                    >
                      <div style={{ fontSize: "1.2rem" }}>💵</div>
                      <div>Efectivo</div>
                      <div style={{ fontSize: ".8rem", marginTop: "3px" }}>{formatClp(fareDisplayAmount ?? farePreview.fare)}</div>
                      <div style={{ fontSize: ".72rem", marginTop: "2px", opacity: .82 }}>{formatUsdFromClp(fareDisplayAmount ?? farePreview.fare)}</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPaymentMethod("card");
                        setSubmitError("El pago con tarjeta estará disponible próximamente. Por ahora puedes solicitar el viaje en efectivo.");
                      }}
                      style={{
                        border: paymentMethod === "card" ? "3px solid #ffffff" : "2px solid rgba(120,120,120,.28)",
                        borderRadius: "18px",
                        padding: "13px 10px",
                        background: "linear-gradient(180deg,#F2F2F2,#D7D7D7)",
                        color: "#444444",
                        boxShadow: paymentMethod === "card" ? "0 0 18px rgba(120,120,120,.35)" : "0 8px 18px rgba(0,0,0,.08)",
                        transform: paymentMethod === "card" ? "scale(1.02)" : "scale(1)",
                        fontWeight: 950,
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      <div style={{ fontSize: "1.2rem" }}>💳</div>
                      <div>Tarjeta</div>
                      <div style={{ fontSize: ".78rem", marginTop: "3px" }}>Próximamente</div>
                      <div style={{ fontSize: ".68rem", marginTop: "2px", opacity: .72 }}>No disponible aún</div>
                    </button>
                  </div>
                </div>
              )}



              {session?.accessToken && (
                <LegalStatusSection token={session.accessToken} />
              )}

              {submitError && (
                <IonText color="danger">
                  <p style={{ margin: "10px 0 0", fontSize: "0.85rem" }}>{submitError}</p>
                </IonText>
              )}

              <IonButton
                expand="block"
                style={{ marginTop: "16px" }}
                onClick={() => void handleRequest()}
                disabled={passengerConnection.blocked || !!blockingRide || submitting || !farePreview || paymentMethod !== "cash" || (rideMode === "scheduled" && (!scheduledAt || (tripFareMode === "round_trip" && !returnScheduledAt)))}
              >
                {submitting ? (
                  <IonSpinner name="dots" />
                ) : passengerConnection.blocked ? (
                  "Sin conexión estable"
                ) : blockingRide ? (
                  "Ya tienes un viaje activo"
                ) : paymentMethod === "cash" ? (
                  "Solicitar viaje"
                ) : paymentMethod === "card" ? (
                  "Tarjeta próximamente"
                ) : (
                  "Selecciona forma de pago"
                )}
              </IonButton>

              {!pickupConfirmed && (
                <IonNote style={{ display: "block", marginTop: "8px", fontSize: "0.72rem", textAlign: "center" }}>
                  Debes confirmar el punto de partida antes de solicitar el viaje.
                </IonNote>
              )}
            </IonCardContent>
          </IonCard>
        </div>
      </IonContent>
    </IonPage>
  );
}
export function PassengerTripsPage(): JSX.Element {
  return <TripsPage />;
}

const PAGE_SIZE = 20;

const RAPAGO_REQUEUED_RIDES_KEY = "rapago_requeued_available_rides_v1";
const RAPAGO_REQUEUED_PASSENGER_FORCE_KEY = "rapago_requeued_passenger_visible_rides_v1";
const RAPAGO_REQUEUED_RIDES_EVENT = "rapago:ride-requeued-after-driver-cancel";


type LocalPassengerRide = RideRequestData & {
  localOnly?: boolean;
};

function readLocalPassengerRides(): RideRequestData[] {
  try {
    const raw = localStorage.getItem("rapago_local_passenger_rides");
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RideRequestData[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalPassengerRides(rides: RideRequestData[]): void {
  try {
    localStorage.setItem("rapago_local_passenger_rides", JSON.stringify(rides));
    window.dispatchEvent(new CustomEvent("rapago:passenger-rides-updated"));
  } catch {
    // No bloquea la app.
  }
}

function readPassengerRequeuedRides(): RideRequestData[] {
  try {
    const all: Array<RideRequestData & Record<string, unknown>> = [];

    for (const key of [RAPAGO_REQUEUED_RIDES_KEY, RAPAGO_REQUEUED_PASSENGER_FORCE_KEY]) {
      const raw = localStorage.getItem(key);
      const parsed = raw ? (JSON.parse(raw) as Array<RideRequestData & Record<string, unknown>>) : [];
      if (Array.isArray(parsed)) all.push(...parsed);
    }

    const byRide = new Map<string, RideRequestData & Record<string, unknown>>();
    for (const ride of all) {
      const id = String(ride.originalRideId ?? ride.rideId ?? ride.id ?? "").trim();
      const routeKey = [
        String(ride.originText ?? "").trim().toLowerCase(),
        String(ride.destinationText ?? "").trim().toLowerCase(),
        String(ride.passengerEmail ?? "").trim().toLowerCase(),
        String(ride.requestedAt ?? ride.createdAt ?? "").trim(),
      ].join("|");
      const key = id || routeKey;
      if (!key) continue;
      byRide.set(key, ride);
    }

    return Array.from(byRide.values()).map((ride) => ({
      ...(ride as RideRequestData & Record<string, unknown>),
      id: String((ride as Record<string, unknown>).id ?? (ride as Record<string, unknown>).originalRideId ?? `requeued-${Date.now()}`),
      originalRideId: (ride as Record<string, unknown>).originalRideId ?? (ride as Record<string, unknown>).id ?? null,
      status: "requested",
      cancelledAt: null,
      cancelledByRole: null,
      cancellationReason: null,
      driverName: null,
      driverPhone: null,
      driverVehicleBrand: null,
      driverVehicleModel: null,
      driverVehicleColor: null,
      driverVehiclePlate: null,
      driverVehicleYear: null,
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
      forceActiveAfterDriverCancel: true,
    })) as RideRequestData[];
  } catch {
    return [];
  }
}

function isPassengerDriverCancelledRequeue(ride: RideRequestData): boolean {
  const record = ride as RideRequestData & Record<string, unknown>;
  const status = String(record.status ?? "").toLowerCase();
  const cancelledBy = String(record.cancelledByRole ?? record.cancelledBy ?? "").toLowerCase();
  const reason = String(record.requeuedReason ?? record.requeueReason ?? record.cancellationReason ?? "").toLowerCase();
  const notice = String(record.passengerNotice ?? record.passengerNotification ?? record.notes ?? "").toLowerCase();

  if (cancelledBy.includes("passenger") || cancelledBy.includes("pasajero")) return false;
  if (hasPassengerCancelledRideMarker(record)) return false;

  return (
    record.forceActiveAfterDriverCancel === true ||
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

function syncRequeuedRidesIntoLocalPassengerRides(): RideRequestData[] {
  const requeued = readPassengerRequeuedRides();
  if (requeued.length === 0) return [];

  const current = readLocalPassengerRides();
  const next = mergePassengerRidesForDisplay([...current, ...requeued]).slice(0, 200);
  saveLocalPassengerRides(next);
  return requeued;
}

function getPassengerRideStorageKey(ride: Partial<RideRequestData> & Record<string, unknown>): string {
  const scheduledAt =
    ride.scheduledAt ??
    ride.scheduledPickupAt ??
    ride.pickupScheduledAt ??
    ride.requestedAt ??
    ride.createdAt ??
    "";

  return [
    ride.id?.startsWith?.("local-") || ride.id?.startsWith?.("admin-local-") ? "local-mirror" : ride.id,
    scheduledAt,
    ride.originText ?? "",
    ride.destinationText ?? "",
    ride.passengerEmail ?? "",
  ]
    .map((value) => String(value ?? "").trim().toLowerCase())
    .join("|");
}


const PASSENGER_CANCEL_STORAGE_KEYS = [
  "rapago_local_passenger_rides",
  RAPAGO_REQUEUED_RIDES_KEY,
  RAPAGO_REQUEUED_PASSENGER_FORCE_KEY,
  "rapago_admin_scheduled_rides",
  "rapago_admin_scheduled_rides_v1",
  "rapago_admin_scheduled_rides_v2",
  "rapago_admin_scheduled_rides_force_v1",
  "rapago_bridge_scheduled_rides_v1",
] as const;

function getPassengerCancelIds(ride: Partial<RideRequestData> & Record<string, unknown>): Set<string> {
  return new Set(
    [ride.id, ride.originalRideId, ride.rideId, ride.serverRideId]
      .map((value) => String(value ?? "").trim())
      .filter(Boolean),
  );
}

function normalizePassengerCancelText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
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
  if (candidateEmail && targetEmail && candidateEmail === targetEmail) return true;

  const candidateSchedule = getPassengerCancelScheduleKey(candidate);
  const targetSchedule = getPassengerCancelScheduleKey(target);
  if (candidateSchedule && targetSchedule && candidateSchedule === targetSchedule) return true;

  // En desarrollo local a veces no viene email ni fecha estable, pero sí se duplica la
  // misma solicitud con mismo origen, destino y tarifa. En ese caso también la limpiamos.
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

function removePassengerRideFromArrayStorage(
  key: string,
  target: Partial<RideRequestData> & Record<string, unknown>,
): void {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as Array<RideRequestData & Record<string, unknown>>) : [];
    if (!Array.isArray(parsed)) return;

    const next = parsed.filter((ride) => !isSamePassengerRideCancelTarget(ride, target));
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // No bloquea la cancelación local.
  }
}

function cancelPassengerRideEverywhere(target: RideRequestData): RideRequestData {
  const cancelled = buildPassengerCancelledRide(target);

  for (const key of PASSENGER_CANCEL_STORAGE_KEYS) {
    if (key !== "rapago_local_passenger_rides") {
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
      originalRideId: (ride as RideRequestData & Record<string, unknown>).originalRideId ?? (cancelled as RideRequestData & Record<string, unknown>).originalRideId ?? cancelled.id,
    } as RideRequestData;
  });

  if (!found) {
    nextLocal.unshift(cancelled);
  }

  saveLocalPassengerRides(nextLocal.slice(0, 200));

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
      originalRideId: (ride as RideRequestData & Record<string, unknown>).originalRideId ?? (cancelled as RideRequestData & Record<string, unknown>).originalRideId ?? cancelled.id,
    } as RideRequestData;
  });

  if (!found) next.unshift(cancelled);

  return sortPassengerRidesForDisplay(mergePassengerRidesForDisplay(next));
}

function upsertLocalPassengerRideMirror(ride: RideRequestData): void {
  const key = getPassengerRideStorageKey(ride as Partial<RideRequestData> & Record<string, unknown>);
  const current = readLocalPassengerRides();
  const withoutDuplicate = current.filter((item) => {
    const itemKey = getPassengerRideStorageKey(item as Partial<RideRequestData> & Record<string, unknown>);
    return itemKey !== key && item.id !== ride.id;
  });

  saveLocalPassengerRides([ride, ...withoutDuplicate].slice(0, 150));
}

function createLocalPassengerRide(input: {
  originText: string;
  destinationText: string;
  notes?: string;
  estimatedFareClp?: number | null;
  rideMode?: RideMode | null;
  tripFareMode?: TripFareMode | null;
  scheduledAt?: string | null;
  returnScheduledAt?: string | null;
  passengerFareType?: PassengerFareType | null;
  passengerFareLabel?: string | null;
}): RideRequestData {
  const now = new Date().toISOString();
  const scheduleFields = buildRideScheduleFields({
    rideMode: input.rideMode ?? "now",
    tripFareMode: input.tripFareMode ?? "one_way",
    scheduledAt: input.scheduledAt ?? "",
    returnScheduledAt: input.returnScheduledAt ?? "",
  });
  const isScheduled = scheduleFields.isScheduled === true;

  return {
    id: `local-${Date.now()}`,
    originText: input.originText,
    destinationText: input.destinationText,
    notes: input.notes ?? null,
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
    ...scheduleFields,
  } as unknown as RideRequestData;
}

function isUnauthorizedMessage(message: unknown): boolean {
  const text = String(message ?? "").toLowerCase();
  return (
    text.includes("401") ||
    text.includes("403") ||
    text.includes("forbidden") ||
    text.includes("only passengers can access ride requests") ||
    text.includes("only passengers") ||
    text.includes("solo pasajeros") ||
    text.includes("unauthorized") ||
    text.includes("no autorizado") ||
    text.includes("token") ||
    text.includes("sesión") ||
    text.includes("session")
  );
}

function cleanPassengerNotes(notes: string | null | undefined): string | null {
  if (!notes) return null;
  return notes
    .replace(/\bRAPAGO_[A-Z_]+:\s*[^.]+\.?/gi, "")
    .replace(/Ubicación GPS pasajero:.*?(?=Punto de partida confirmado|$)/i, "")
    .replace(/Ubicación real del pasajero:.*?(?=Punto accesible|Coordenadas|$)/i, "")
    .replace(/Coordenadas recogida accesible:.*?(?=Coordenadas destino accesible|$)/i, "")
    .replace(/Coordenadas destino accesible:.*$/i, "")
    .replace(/Tipo de pasajero tarifario:\s*[^.]+\.?/gi, "")
    .replace(/Tipo de viaje seleccionado:\s*[^.]+\.?/gi, "")
    .replace(/La solicitud se activa automáticamente.*?\./gi, "")
    .replace(/Estado de agenda admin:\s*[^.]+\.?/gi, "")
    .replace(/Solicitado por rol:\s*[^.]+\.?/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim() || null;
}


function getRidePassengerFareType(ride: RideRequestData): PassengerFareType | null {
  const record = ride as RideRequestData & Record<string, unknown>;
  const notes = String(record.notes ?? "");
  const fromNotes =
    notes.match(/Tipo de pasajero tarifario:\s*([^.]*)\./i)?.[1] ??
    notes.match(/Tarifa pasajero:\s*([^.]*)\./i)?.[1] ??
    notes.match(/Nacionalidad:\s*([^.]*)\./i)?.[1];

  return (
    normalizePassengerFareType(record.passengerFareType) ??
    normalizePassengerFareType(record.farePassengerType) ??
    normalizePassengerFareType(record.passengerType) ??
    normalizePassengerFareType(record.passengerFareLabel) ??
    normalizePassengerFareType(record.nationality) ??
    normalizePassengerFareType(record.isResident) ??
    normalizePassengerFareType(fromNotes)
  );
}

type PassengerRideScheduleInfo = {
  isScheduled: boolean;
  scheduledAt: string | null;
  returnScheduledAt: string | null;
  activationAt: string | null;
  isActiveWindow: boolean;
};

function getRideAnyField(ride: RideRequestData, key: string): unknown {
  return (ride as unknown as Record<string, unknown>)[key];
}



type PassengerIndexVehicleDisplayData = {
  brand: string;
  model: string;
  color: string;
  plate: string;
  imageDataUrl: string | null;
  score: number;
};

function passengerIndexLooksLikeFareText(value: unknown): boolean {
  const raw = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  if (!raw) return false;

  return (
    raw.includes("tarifa ") ||
    raw.includes("tarifa general") ||
    raw.includes("tarifa destino") ||
    raw.includes("tarifa vehiculo") ||
    raw.includes("tarifa vehículo") ||
    raw.includes("valor por km") ||
    raw.includes("km adicional") ||
    raw.includes("clp") ||
    raw.includes("usd") ||
    raw.includes("residentes") ||
    raw.includes("chilenos") ||
    raw.includes("extranjeros")
  );
}

function passengerIndexStringValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") {
    const text = String(value).trim();
    const lower = text.toLowerCase();
    if (
      !text ||
      lower === "null" ||
      lower === "undefined" ||
      lower === "modelo no informado" ||
      lower === "patente no informada" ||
      lower === "color no informado" ||
      lower === "imagen no informada" ||
      passengerIndexLooksLikeFareText(text)
    ) {
      return "";
    }
    return text;
  }
  return "";
}

function passengerIndexFirstValue(...values: unknown[]): string {
  for (const value of values) {
    const text = passengerIndexStringValue(value);
    if (text) return text;
  }
  return "";
}

function passengerIndexImageValue(...values: unknown[]): string | null {
  for (const value of values) {
    const text = passengerIndexStringValue(value);
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

function passengerIndexReadJsonStorageValue(key: string): unknown {
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

function passengerIndexFlattenObjects(value: unknown, depth = 0): Array<Record<string, unknown>> {
  if (!value || depth > 7) return [];
  if (Array.isArray(value)) return value.flatMap((item) => passengerIndexFlattenObjects(item, depth + 1));
  if (typeof value !== "object") return [];

  const obj = value as Record<string, unknown>;
  const result: Array<Record<string, unknown>> = [obj];

  for (const nested of Object.values(obj)) {
    if (nested && typeof nested === "object") {
      result.push(...passengerIndexFlattenObjects(nested, depth + 1));
    }
  }

  return result;
}

function passengerIndexParseVehicleLabel(label: unknown): Partial<PassengerIndexVehicleDisplayData> {
  const clean = passengerIndexStringValue(label)
    .replace(/\b(propio|prestado|borrowed|own|activo|veh[ií]culo activo)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!clean) return {};

  const parts = clean
    .split(/\s*[·•|,;-]\s*/g)
    .map((part) => part.trim())
    .filter(Boolean);

  const main = parts[0] ?? clean;
  const tokens = main.split(/\s+/).filter(Boolean);
  const parsed: Partial<PassengerIndexVehicleDisplayData> = {};

  if (tokens.length >= 2) {
    parsed.brand = tokens[0];
    parsed.model = tokens.slice(1).join(" ");
  } else if (tokens.length === 1) {
    parsed.brand = tokens[0];
  }

  parsed.plate =
    parts.slice(1).find((part) => /(?=.*\d)[A-Z0-9-]{3,}/i.test(part) && !/color|propio|prestado/i.test(part)) ??
    clean.split(/\s+/).find((part) => /(?=.*\d)[A-Z0-9-]{3,}/i.test(part) && !/color|propio|prestado/i.test(part));

  const colorPart = parts.find((part) => /^color\s*:/i.test(part));
  if (colorPart) parsed.color = colorPart.replace(/^color\s*:/i, "").trim();

  return parsed;
}

function passengerIndexFindImageInObject(obj: Record<string, unknown>): string | null {
  const direct = passengerIndexImageValue(
    obj.driverVehicleImageDataUrl,
    obj.driverVehiclePhotoDataUrl,
    obj.vehicleImageDataUrl,
    obj.vehiclePhotoDataUrl,
    obj.vehicleImageUrl,
    obj.vehiclePhotoUrl,
    obj.imageDataUrl,
    obj.photoDataUrl,
    obj.imageUrl,
    obj.photoUrl,
    obj.imagePreviewUrl,
    obj.photoPreviewUrl,
    obj.previewDataUrl,
    obj.previewUrl,
    obj.driverVehicleImage,
    obj.driverVehiclePhoto,
    obj.vehicleImage,
    obj.vehiclePhoto,
    obj.fotoVehiculo,
    obj.foto,
    obj.image,
    obj.photo,
    obj.url,
    obj.src,
    obj.dataUrl,
    obj.base64,
  );

  if (direct) return direct;

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (
      (lowerKey.includes("image") || lowerKey.includes("photo") || lowerKey.includes("foto") || lowerKey.includes("vehicle") || lowerKey.includes("vehiculo")) &&
      passengerIndexImageValue(value)
    ) {
      return passengerIndexImageValue(value);
    }
  }

  return null;
}

function passengerIndexNormalizeForCompare(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function passengerIndexIsFareRuleObject(obj: Record<string, unknown>, sourceKey = ""): boolean {
  const lowerKey = sourceKey.toLowerCase();
  if (lowerKey.includes("fare") || lowerKey.includes("tarifa") || lowerKey.includes("price") || lowerKey.includes("rate")) return true;

  const kind = passengerIndexNormalizeForCompare(obj.kind);
  const title = passengerIndexNormalizeForCompare(obj.title);
  const description = passengerIndexNormalizeForCompare(obj.description);
  const id = passengerIndexNormalizeForCompare(obj.id);

  if (kind === "variable" || kind === "fixed") return true;
  if ("minimumClp" in obj || "kmClp" in obj || "fixedClp" in obj || "baseResidentClp" in obj) return true;
  if (title.includes("tarifa") || description.includes("tarifa") || id.includes("fare") || id.includes("tarifa")) return true;

  return false;
}

function passengerIndexBuildVehicleCandidate(obj: Record<string, unknown>, sourceKey = ""): PassengerIndexVehicleDisplayData | null {
  if (passengerIndexIsFareRuleObject(obj, sourceKey)) return null;

  const label = passengerIndexFirstValue(
    obj.label,
    obj.vehicleLabel,
    obj.driverVehicleLabel,
    obj.activeVehicleLabel,
    obj.selectedVehicleLabel,
    obj.name,
    obj.title,
    obj.displayName,
    obj.text,
    obj.description,
  );
  const parsed = passengerIndexParseVehicleLabel(label);

  const brand = passengerIndexFirstValue(
    obj.driverVehicleBrand,
    obj.vehicleBrand,
    obj.brand,
    obj.make,
    obj.marca,
    obj.vehicleMake,
    obj.carBrand,
    obj.driverVehicleMarca,
    parsed.brand,
  );
  const model = passengerIndexFirstValue(
    obj.driverVehicleModel,
    obj.vehicleModel,
    obj.model,
    obj.modelo,
    obj.vehicleModelo,
    obj.carModel,
    obj.driverVehicleModelo,
    parsed.model,
  );
  const plate = passengerIndexFirstValue(
    obj.driverVehiclePlate,
    obj.vehiclePlate,
    obj.plate,
    obj.patente,
    obj.patenteVehiculo,
    obj.vehiclePatente,
    obj.vehiclePatent,
    obj.patent,
    obj.placa,
    obj.matricula,
    obj["matrícula"],
    obj.licensePlate,
    obj.registrationPlate,
    obj.plateNumber,
    parsed.plate,
  );
  const color = passengerIndexFirstValue(
    obj.driverVehicleColor,
    obj.vehicleColor,
    obj.color,
    obj.colour,
    obj.vehicleColour,
    obj.driverVehicleColour,
    obj.carColor,
    parsed.color,
  );
  const imageDataUrl = passengerIndexFindImageInObject(obj);

  if (!brand && !model && !plate && !color && !imageDataUrl) return null;

  const lowerKey = sourceKey.toLowerCase();
  let score = 0;
  if (brand) score += 10;
  if (model) score += 10;
  if (plate) score += 14;
  if (color) score += 8;
  if (imageDataUrl) score += 30;
  if (lowerKey.includes("active") || lowerKey.includes("activo") || lowerKey.includes("selected")) score += 35;
  if (lowerKey.includes("driver_active_vehicle")) score += 45;
  if (lowerKey.includes("current_driver") || lowerKey.includes("live")) score += 12;

  const updatedTime = new Date(String(obj.updatedAt ?? obj.createdAt ?? obj.selectedAt ?? "")).getTime();
  if (Number.isFinite(updatedTime)) {
    const ageDays = Math.max(0, (Date.now() - updatedTime) / (1000 * 60 * 60 * 24));
    score += ageDays < 7 ? 10 : 2;
  }

  return { brand, model, color, plate, imageDataUrl, score };
}

function passengerIndexCandidateFromString(value: unknown, sourceKey = ""): PassengerIndexVehicleDisplayData | null {
  const parsed = passengerIndexParseVehicleLabel(value);
  const imageDataUrl = passengerIndexImageValue(value);
  const brand = passengerIndexFirstValue(parsed.brand);
  const model = passengerIndexFirstValue(parsed.model);
  const plate = passengerIndexFirstValue(parsed.plate);
  const color = passengerIndexFirstValue(parsed.color);
  if (!brand && !model && !plate && !color && !imageDataUrl) return null;

  let score = 1;
  const lowerKey = sourceKey.toLowerCase();
  if (brand) score += 6;
  if (model) score += 6;
  if (plate) score += 8;
  if (color) score += 4;
  if (imageDataUrl) score += 20;
  if (lowerKey.includes("active") || lowerKey.includes("selected")) score += 25;

  return { brand, model, color, plate, imageDataUrl, score };
}

function passengerIndexReadVehicleFromFlatKeys(): PassengerIndexVehicleDisplayData | null {
  try {
    const data: Partial<PassengerIndexVehicleDisplayData> = {};
    let score = 0;

    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key) continue;
      const lower = key.toLowerCase();
      if (!lower.includes("rapago")) continue;
      if (lower.includes("fare") || lower.includes("tarifa") || lower.includes("price") || lower.includes("rate")) continue;
      if (!/(vehicle|vehiculo|driver|conductor|auto|(^|[_-])car([_-]|$))/i.test(lower)) continue;

      const text = passengerIndexStringValue(localStorage.getItem(key));
      if (!text) continue;

      if ((lower.includes("brand") || lower.includes("marca")) && !data.brand) {
        data.brand = text;
        score += 10;
      } else if ((lower.includes("model") || lower.includes("modelo")) && !data.model) {
        data.model = text;
        score += 10;
      } else if ((lower.includes("plate") || lower.includes("patente") || lower.includes("placa") || lower.includes("matricula")) && !data.plate) {
        data.plate = text;
        score += 14;
      } else if ((lower.includes("color") || lower.includes("colour")) && !data.color) {
        data.color = text;
        score += 8;
      } else if ((lower.includes("image") || lower.includes("photo") || lower.includes("foto")) && !data.imageDataUrl) {
        const image = passengerIndexImageValue(text);
        if (image) {
          data.imageDataUrl = image;
          score += 30;
        }
      }
    }

    if (!data.brand && !data.model && !data.plate && !data.color && !data.imageDataUrl) return null;
    return {
      brand: passengerIndexFirstValue(data.brand),
      model: passengerIndexFirstValue(data.model),
      color: passengerIndexFirstValue(data.color),
      plate: passengerIndexFirstValue(data.plate),
      imageDataUrl: passengerIndexImageValue(data.imageDataUrl),
      score,
    };
  } catch {
    return null;
  }
}

function passengerIndexReadBestVehicleFromEverywhere(): PassengerIndexVehicleDisplayData | null {
  const candidates: PassengerIndexVehicleDisplayData[] = [];
  const priorityKeys = [
    "rapago_driver_active_vehicle_v1",
    "rapago_driver_active_vehicle",
    "rapago_active_driver_vehicle_v1",
    "rapago_active_vehicle_v1",
    "rapago_driver_public_profile_v1",
    "rapago_driver_profile_v1",
    "rapago_current_driver_location",
    "rapago_driver_vehicles_v1",
    "rapago_driver_vehicles",
    "rapago_driver_selected_vehicle_v1",
    "rapago_driver_selected_vehicle",
    "rapago_last_accepted_ride",
    "rapago_driver_live_locations_v1",
  ];

  try {
    const flat = passengerIndexReadVehicleFromFlatKeys();
    if (flat) candidates.push(flat);

    const keys = new Set<string>(priorityKeys);
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key) continue;
      const lower = key.toLowerCase();
      if (lower.includes("fare") || lower.includes("tarifa") || lower.includes("price") || lower.includes("rate")) continue;
      if (
        lower.includes("vehicle") ||
        lower.includes("vehiculo") ||
        lower.includes("driver") ||
        lower.includes("conductor") ||
        /(^|[_-])(car|auto)([_-]|$)/i.test(lower) ||
        lower.includes("ride")
      ) {
        keys.add(key);
      }
    }

    for (const key of keys) {
      const value = passengerIndexReadJsonStorageValue(key);
      const fromString = typeof value === "string" ? passengerIndexCandidateFromString(value, key) : null;
      if (fromString) candidates.push(fromString);

      for (const obj of passengerIndexFlattenObjects(value)) {
        const candidate = passengerIndexBuildVehicleCandidate(obj, key);
        if (!candidate) continue;

        const ownership = passengerIndexFirstValue(obj.ownership, obj.driverVehicleOwnership).toLowerCase();
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

function passengerIndexGetDriverVehiclePublicData(ride: RideRequestData & Record<string, unknown>): PassengerIndexVehicleDisplayData {
  const fallback = passengerIndexReadBestVehicleFromEverywhere();

  return {
    brand: passengerIndexFirstValue(ride.driverVehicleBrand, ride.vehicleBrand, fallback?.brand),
    model: passengerIndexFirstValue(ride.driverVehicleModel, ride.vehicleModel, fallback?.model),
    color: passengerIndexFirstValue(ride.driverVehicleColor, ride.vehicleColor, fallback?.color),
    plate: passengerIndexFirstValue(ride.driverVehiclePlate, ride.vehiclePlate, ride.plate, fallback?.plate),
    imageDataUrl: passengerIndexImageValue(
      ride.driverVehicleImageDataUrl,
      ride.driverVehiclePhotoDataUrl,
      ride.vehicleImageDataUrl,
      ride.vehiclePhotoDataUrl,
      fallback?.imageDataUrl,
    ),
    score: fallback?.score ?? 0,
  };
}

function passengerIndexGetDriverName(ride: RideRequestData & Record<string, unknown>): string {
  const direct = passengerIndexFirstValue(ride.driverName, ride.driverFullName);
  if (direct) return direct;

  try {
    for (const key of [
      "rapago_driver_availability_name",
      "rapago_driver_profile_name",
      "rapago_driver_name",
      "rapago_user_name",
      "rapago_driver_public_profile_v1",
      "rapago_driver_profile_v1",
      "rapago_current_driver_location",
    ]) {
      const value = passengerIndexReadJsonStorageValue(key);
      const asString = passengerIndexStringValue(value);
      if (typeof value === "string" && asString && !asString.startsWith("{") && !asString.startsWith("[")) return asString;

      for (const obj of passengerIndexFlattenObjects(value)) {
        const name = passengerIndexFirstValue(obj.driverFullName, obj.driverName, obj.fullName, obj.name, obj.firstName);
        if (name) return name;
      }
    }
  } catch {
    // No bloquea Mis Viajes.
  }

  return "";
}

function enrichPassengerRideWithDriverVehicleData(ride: RideRequestData): RideRequestData {
  const record = ride as RideRequestData & Record<string, unknown>;
  const vehicle = passengerIndexGetDriverVehiclePublicData(record);
  const driverName = passengerIndexGetDriverName(record);

  return {
    ...record,
    driverName: passengerIndexFirstValue(record.driverName, driverName) || record.driverName || null,
    driverFullName: passengerIndexFirstValue(record.driverFullName, driverName) || record.driverFullName || null,
    driverVehicleBrand: passengerIndexFirstValue(record.driverVehicleBrand, vehicle.brand) || null,
    driverVehicleModel: passengerIndexFirstValue(record.driverVehicleModel, vehicle.model) || null,
    driverVehicleColor: passengerIndexFirstValue(record.driverVehicleColor, vehicle.color) || null,
    driverVehiclePlate: passengerIndexFirstValue(record.driverVehiclePlate, vehicle.plate) || null,
    driverVehicleImageDataUrl: passengerIndexImageValue(record.driverVehicleImageDataUrl, vehicle.imageDataUrl),
  } as RideRequestData;
}

function getRideScheduleString(ride: RideRequestData, keys: string[]): string | null {
  for (const key of keys) {
    const value = getRideAnyField(ride, key);
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function toPassengerIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function extractPassengerIsoByKeywords(notes: string | null | undefined, keywords: string[]): string | null {
  if (!notes) return null;
  const isoPattern =
    "([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(?::[0-9]{2}(?:\\.[0-9]{1,3})?)?(?:Z|[+-][0-9]{2}:?[0-9]{2})?)";

  for (const keyword of keywords) {
    const safeKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = notes.match(new RegExp(`${safeKeyword}\\s*[:=]\\s*${isoPattern}`, "i"));
    const parsed = toPassengerIso(match?.[1] ?? null);
    if (parsed) return parsed;
  }

  return null;
}

function extractPassengerScheduleIsoFromNotes(notes: string | null | undefined): string | null {
  return extractPassengerIsoByKeywords(notes, [
    "RAPAGO_SCHEDULED_AT",
    "Fecha y hora de recogida agendada",
    "scheduledAt",
    "scheduledPickupAt",
    "pickupScheduledAt",
  ]);
}

function extractPassengerReturnIsoFromNotes(notes: string | null | undefined): string | null {
  return extractPassengerIsoByKeywords(notes, [
    "RAPAGO_RETURN_SCHEDULED_AT",
    "RAPAGO_RETURN_AT",
    "Fecha y hora de regreso agendada",
    "returnScheduledAt",
    "scheduledReturnAt",
  ]);
}

function getPassengerRideScheduleInfo(ride: RideRequestData): PassengerRideScheduleInfo {
  const scheduledAt =
    toPassengerIso(getRideScheduleString(ride, ["scheduledAt", "scheduledPickupAt", "pickupScheduledAt", "pickupAt", "reservedAt"])) ??
    extractPassengerScheduleIsoFromNotes(ride.notes);

  const returnScheduledAt =
    toPassengerIso(getRideScheduleString(ride, ["returnScheduledAt", "scheduledReturnAt", "returnAt"])) ??
    extractPassengerReturnIsoFromNotes(ride.notes);

  const activationAt =
    toPassengerIso(getRideScheduleString(ride, ["scheduleActivationAt", "dispatchAt", "autoAssignAt", "autoDispatchAt"])) ??
    (scheduledAt ? new Date(new Date(scheduledAt).getTime() - SCHEDULE_ACTIVATION_MINUTES * 60_000).toISOString() : null);

  const isScheduled =
    getRideAnyField(ride, "isScheduled") === true ||
    ride.status === "scheduled" ||
    !!scheduledAt ||
    /Viaje (?:agendado|programado) para:/i.test(ride.notes ?? "");

  const isActiveWindow = !!activationAt && Date.now() >= new Date(activationAt).getTime();

  return { isScheduled, scheduledAt, returnScheduledAt, activationAt, isActiveWindow };
}

function isPassengerRideDriverScheduled(ride: RideRequestData): boolean {
  const status = String(
    getRideAnyField(ride, "scheduleStatus") ??
      getRideAnyField(ride, "adminScheduleStatus") ??
      getRideAnyField(ride, "reservationStatus") ??
      "",
  )
    .toLowerCase()
    .trim();

  return ["driver_scheduled", "assigned_driver", "driver_assigned", "scheduled_driver"].includes(status);
}

function getPassengerRideNotification(ride: RideRequestData): string | null {
  const value = getRideAnyField(ride, "passengerNotification");
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getEffectivePassengerRideStatus(ride: RideRequestData): string {
  if (isPassengerRideCancelledByPassenger(ride as RideRequestData & Record<string, unknown>)) return "cancelled";
  if (isPassengerDriverCancelledRequeue(ride)) return "requested";
  const schedule = getPassengerRideScheduleInfo(ride);
  if (schedule.isScheduled && isPassengerRideDriverScheduled(ride) && ride.driverName) {
    return "driver_scheduled";
  }
  if (schedule.isScheduled && !schedule.isActiveWindow && ["requested", "scheduled"].includes(ride.status)) {
    return "scheduled";
  }
  if (ride.status === "scheduled" && schedule.isActiveWindow) return "requested";
  return ride.status;
}

const PASSENGER_ACTIVE_STATUSES = [
  "scheduled",
  "driver_scheduled",
  "requested",
  "accepted",
  "driver_en_route",
  "driver_arrived",
  "in_progress",
];

function getPassengerRideTimeValue(ride: RideRequestData): number {
  const schedule = getPassengerRideScheduleInfo(ride);
  const candidates = [
    schedule.scheduledAt,
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

function getPassengerRidePriority(ride: RideRequestData): number {
  const status = getEffectivePassengerRideStatus(ride);
  if (status === "driver_en_route") return 0;
  if (status === "driver_arrived") return 1;
  if (status === "in_progress") return 2;
  if (status === "accepted") return 3;
  if (status === "requested") return 4;
  if (status === "driver_scheduled") return 5;
  if (status === "scheduled") return 6;
  if (status === "completed") return 7;
  if (status === "cancelled") return 8;
  return 9;
}

function mergePassengerRidesForDisplay(rides: RideRequestData[]): RideRequestData[] {
  const byKey = new Map<string, RideRequestData>();

  for (const ride of rides) {
    const key = getPassengerRideStorageKey(ride as Partial<RideRequestData> & Record<string, unknown>);
    const current = byKey.get(key);
    const incomingHasDriver = Boolean(ride.driverName);
    const currentHasDriver = Boolean(current?.driverName);
    const incomingIsLocal = ride.id.startsWith("local-") || ride.id.startsWith("admin-local-");
    const currentIsLocal = Boolean(current?.id.startsWith("local-") || current?.id.startsWith("admin-local-"));

    if (!current) {
      byKey.set(key, ride);
      continue;
    }

    const incomingIsDriverRequeued = isPassengerDriverCancelledRequeue(ride);
    const currentIsDriverRequeued = isPassengerDriverCancelledRequeue(current);
    const incomingEffectiveStatus = getEffectivePassengerRideStatus(ride);
    const currentEffectiveStatus = getEffectivePassengerRideStatus(current);

    const incomingIsPassengerCancelled = isPassengerRideCancelledByPassenger(ride as RideRequestData & Record<string, unknown>);
    const currentIsPassengerCancelled = isPassengerRideCancelledByPassenger(current as RideRequestData & Record<string, unknown>);

    // Si el pasajero tocó Cancelar, esa decisión gana sobre cualquier reencolado
    // o sobre el cancelled del backend por conductor. Así desaparece de Activos.
    if (incomingIsPassengerCancelled && currentIsDriverRequeued) {
      byKey.set(key, ride);
      continue;
    }

    if (currentIsPassengerCancelled && incomingIsDriverRequeued) {
      continue;
    }

    // Cuando el conductor cancela, el backend puede devolver el mismo viaje como cancelled.
    // Para el pasajero debe seguir siendo activo/requested, así que esa copia gana
    // sobre el cancelled hasta que otro conductor lo tome o el pasajero lo cancele.
    if (incomingIsDriverRequeued && currentEffectiveStatus === "cancelled" && !currentIsPassengerCancelled) {
      byKey.set(key, { ...current, ...ride, status: "requested" } as RideRequestData);
      continue;
    }

    if (currentIsDriverRequeued && incomingEffectiveStatus === "cancelled" && !incomingIsPassengerCancelled) {
      continue;
    }

    if (incomingHasDriver && !currentHasDriver && incomingEffectiveStatus !== "cancelled") {
      byKey.set(key, ride);
      continue;
    }

    if (incomingIsLocal && !currentIsLocal && getPassengerRideScheduleInfo(ride).isScheduled) {
      byKey.set(key, { ...current, ...ride } as RideRequestData);
      continue;
    }

    if (getPassengerRideTimeValue(ride) > getPassengerRideTimeValue(current)) {
      byKey.set(key, { ...current, ...ride } as RideRequestData);
    }
  }

  return Array.from(byKey.values()).map(enrichPassengerRideWithDriverVehicleData);
}

function sortPassengerRidesForDisplay(rides: RideRequestData[]): RideRequestData[] {
  return [...rides].sort((a, b) => {
    const priorityDiff = getPassengerRidePriority(a) - getPassengerRidePriority(b);
    if (priorityDiff !== 0) return priorityDiff;
    return getPassengerRideTimeValue(b) - getPassengerRideTimeValue(a);
  });
}

function findBlockingPassengerRide(): RideRequestData | null {
  const requeued = syncRequeuedRidesIntoLocalPassengerRides();
  const rides = sortPassengerRidesForDisplay(mergePassengerRidesForDisplay([...readLocalPassengerRides(), ...requeued]));
  return rides.find((ride) => PASSENGER_ACTIVE_STATUSES.includes(getEffectivePassengerRideStatus(ride))) ?? null;
}


type PassengerLiveNavPoints = {
  pickupLat: number | null;
  pickupLng: number | null;
  destinationLat: number | null;
  destinationLng: number | null;
  passengerOriginalLat: number | null;
  passengerOriginalLng: number | null;
};

type PassengerLiveDriverPoint = {
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  accuracy: number | null;
  updatedAt: string | null;
};

type PassengerRideLiveResponse = {
  rideId: string;
  status: string;
  driver: PassengerLiveDriverPoint | null;
};

function extractLiveNumber(notes: string | null | undefined, regex: RegExp): number | null {
  if (!notes) return null;
  const match = notes.match(regex);
  if (!match?.[1]) return null;
  const parsed = Number(match[1].replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function extractPassengerLiveNavPoints(notes: string | null | undefined): PassengerLiveNavPoints {
  return {
    pickupLat: extractLiveNumber(notes, /Coordenadas recogida accesible:\s*(-?\d+(?:[.,]\d+)?)/i),
    pickupLng: extractLiveNumber(notes, /Coordenadas recogida accesible:\s*-?\d+(?:[.,]\d+)?,\s*(-?\d+(?:[.,]\d+)?)/i),
    destinationLat: extractLiveNumber(notes, /Coordenadas destino accesible:\s*(-?\d+(?:[.,]\d+)?)/i),
    destinationLng: extractLiveNumber(notes, /Coordenadas destino accesible:\s*-?\d+(?:[.,]\d+)?,\s*(-?\d+(?:[.,]\d+)?)/i),
    passengerOriginalLat: extractLiveNumber(notes, /Ubicación real del pasajero:\s*(-?\d+(?:[.,]\d+)?)/i),
    passengerOriginalLng: extractLiveNumber(notes, /Ubicación real del pasajero:\s*-?\d+(?:[.,]\d+)?,\s*(-?\d+(?:[.,]\d+)?)/i),
  };
}

function getPassengerApiBaseUrl(): string {
  return (import.meta.env["VITE_API_BASE_URL"] as string | undefined) ?? "/api";
}

function buildPassengerApiUrl(path: string): string {
  const baseUrl = getPassengerApiBaseUrl().replace(/\/$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  if (baseUrl.endsWith("/api") && cleanPath.startsWith("/api/")) {
    return `${baseUrl}${cleanPath.slice(4)}`;
  }

  return `${baseUrl}${cleanPath}`;
}

async function fetchPassengerLiveDriverPoint(
  token: string,
  rideId: string,
): Promise<PassengerLiveDriverPoint | null> {
  const response = await fetch(
    buildPassengerApiUrl(`/api/rides/${encodeURIComponent(rideId)}/live`),
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (response.status === 404 || response.status === 204) return null;

  if (!response.ok) {
    throw new Error("No se pudo obtener la ubicación del conductor.");
  }

  const data = (await response.json()) as PassengerRideLiveResponse;
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

function PassengerDriverLiveMap({
  ride,
  token,
}: {
  ride: RideRequestData;
  token: string;
}): JSX.Element {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const driverMarkerRef = useRef<google.maps.Marker | null>(null);
  const pickupMarkerRef = useRef<google.maps.Marker | null>(null);
  const destinationMarkerRef = useRef<google.maps.Marker | null>(null);
  const passengerMarkerRef = useRef<google.maps.Marker | null>(null);
  const fallbackLineRef = useRef<google.maps.Polyline | null>(null);
  const routeKeyRef = useRef("");
  const didInitialFitRef = useRef(false);
  const lastDriverPointRef = useRef<{ lat: number; lng: number } | null>(null);

  const [livePoint, setLivePoint] = useState<PassengerLiveDriverPoint | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [liveMessage, setLiveMessage] = useState("Esperando GPS real del conductor...");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const nav = extractPassengerLiveNavPoints(ride.notes);

  const pickup =
    nav.pickupLat != null && nav.pickupLng != null
      ? { lat: nav.pickupLat, lng: nav.pickupLng }
      : null;

  const destination =
    nav.destinationLat != null && nav.destinationLng != null
      ? { lat: nav.destinationLat, lng: nav.destinationLng }
      : null;

  const passenger =
    nav.passengerOriginalLat != null && nav.passengerOriginalLng != null
      ? { lat: nav.passengerOriginalLat, lng: nav.passengerOriginalLng }
      : null;

  const driverPoint =
    livePoint && Number.isFinite(livePoint.lat) && Number.isFinite(livePoint.lng)
      ? { lat: livePoint.lat, lng: livePoint.lng }
      : null;

  const routeTarget = ride.status === "in_progress" ? destination : pickup;
  const routeTitle =
    ride.status === "in_progress"
      ? "Tu viaje va en curso"
      : ride.status === "driver_arrived"
        ? "Tu conductor llegó"
        : "Tu conductor viene en camino";

  function markerIcon(color: string, scale: number): google.maps.Symbol {
    return {
      path: google.maps.SymbolPath.CIRCLE,
      scale,
      fillColor: color,
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 4,
    };
  }

  function driverIcon(): google.maps.Symbol {
    return {
      path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
      scale: 7,
      fillColor: "#2382ff",
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 4,
      rotation: livePoint?.heading ?? 0,
    };
  }

  function setMarker(
    ref: React.MutableRefObject<google.maps.Marker | null>,
    point: { lat: number; lng: number } | null,
    options: google.maps.MarkerOptions,
  ): void {
    const map = mapRef.current;
    if (!map || !window.google?.maps || !point) {
      ref.current?.setMap(null);
      ref.current = null;
      return;
    }

    if (!ref.current) {
      ref.current = new google.maps.Marker({ ...options, map, position: point });
      return;
    }

    ref.current.setMap(map);
    ref.current.setPosition(point);
    ref.current.setOptions(options);
  }

  function drawMarkers(): void {
    if (!mapRef.current || !window.google?.maps) return;

    setMarker(driverMarkerRef, driverPoint, {
      title: "Conductor en tiempo real",
      icon: driverIcon(),
      zIndex: 50,
    });

    setMarker(pickupMarkerRef, pickup, {
      title: "Punto de recogida",
      icon: markerIcon("#22c55e", 13),
      zIndex: 40,
    });

    setMarker(destinationMarkerRef, destination, {
      title: "Destino",
      icon: markerIcon("#ef4444", 12),
      zIndex: 35,
    });

    setMarker(passengerMarkerRef, passenger, {
      title: "Tu ubicación real",
      icon: markerIcon("#2563eb", 10),
      zIndex: 30,
    });
  }

  function fitOnce(): void {
    const map = mapRef.current;
    if (!map || !window.google?.maps || didInitialFitRef.current) return;

    const bounds = new google.maps.LatLngBounds();
    if (driverPoint) bounds.extend(driverPoint);
    if (pickup) bounds.extend(pickup);
    if (destination) bounds.extend(destination);
    if (passenger) bounds.extend(passenger);

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, 70);
      didInitialFitRef.current = true;
    }
  }

  function drawRoute(force = false): void {
    const map = mapRef.current;
    const service = directionsServiceRef.current;
    const renderer = directionsRendererRef.current;

    if (!map || !service || !renderer || !window.google?.maps) return;

    const key = `${ride.status}:${driverPoint?.lat ?? "none"},${driverPoint?.lng ?? "none"}:${routeTarget?.lat ?? "none"},${routeTarget?.lng ?? "none"}`;

    if (!force && routeKeyRef.current === key) return;

    // Solo recalcula si aparece el conductor o cambia el estado. No recalcula en cada render.
    routeKeyRef.current = key;

    fallbackLineRef.current?.setMap(null);
    fallbackLineRef.current = null;

    if (!driverPoint || !routeTarget) {
      renderer.set("directions", null);
      return;
    }

    service.route(
      {
        origin: driverPoint,
        destination: routeTarget,
        travelMode: google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: false,
        optimizeWaypoints: false,
        region: "CL",
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          renderer.setDirections(result);
          return;
        }

        renderer.set("directions", null);
        fallbackLineRef.current = new google.maps.Polyline({
          map,
          path: [driverPoint, routeTarget],
          strokeColor: "#00b7ff",
          strokeOpacity: 1,
          strokeWeight: 6,
          zIndex: 20,
        });
      },
    );
  }

  useEffect(() => {
    let cancelled = false;

    void loadRapaGoGoogleMaps()
      .then(() => {
        if (cancelled || !mapElementRef.current || !window.google?.maps) return;

        const center = driverPoint ?? pickup ?? destination ?? { lat: -27.1505, lng: -109.4325 };

        const map = new google.maps.Map(mapElementRef.current, {
          center,
          zoom: 15,
          mapTypeId: google.maps.MapTypeId.ROADMAP,
          disableDefaultUI: true,
          zoomControl: false,
          fullscreenControl: false,
          streetViewControl: false,
          mapTypeControl: false,
          clickableIcons: false,
          gestureHandling: "greedy",
          styles: [
            { featureType: "poi", elementType: "labels", stylers: [{ visibility: "on" }] },
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#d4dbe7" }] },
            { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#334155" }] },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#a8d7e8" }] },
            { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#f3f4ef" }] },
          ],
        });

        mapRef.current = map;
        directionsServiceRef.current = new google.maps.DirectionsService();
        directionsRendererRef.current = new google.maps.DirectionsRenderer({
          map,
          suppressMarkers: true,
          preserveViewport: true,
          polylineOptions: {
            strokeColor: "#00b7ff",
            strokeOpacity: 1,
            strokeWeight: 7,
          },
        });

        drawMarkers();
        fitOnce();
        setMapReady(true);
      })
      .catch(() => {
        setLiveMessage("No se pudo cargar el mapa.");
      });

    return () => {
      cancelled = true;
    };
    // El mapa se crea una sola vez para evitar pantalla blanca/parpadeos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let stopped = false;

    async function loadLivePoint(): Promise<void> {
      try {
        const point = await fetchPassengerLiveDriverPoint(token, ride.id);
        if (stopped) return;

        setLivePoint(point);
        setLastUpdatedAt(point ? new Date() : null);
        setLiveMessage(point ? "GPS del conductor actualizado" : "Esperando GPS real del conductor...");
      } catch {
        if (stopped) return;
        setLivePoint(null);
        setLastUpdatedAt(null);
        setLiveMessage("Esperando GPS real del conductor...");
      }
    }

    void loadLivePoint();

    const timer = window.setInterval(() => {
      void loadLivePoint();
    }, 6000);

    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [token, ride.id]);

  useEffect(() => {
    if (!mapReady) return;

    drawMarkers();

    if (driverPoint && lastDriverPointRef.current) {
      const previous = lastDriverPointRef.current;
      const marker = driverMarkerRef.current;

      if (marker) {
        const startedAt = performance.now();
        const duration = 850;

        function frame(now: number): void {
          const progress = Math.min(1, (now - startedAt) / duration);
          const eased = 1 - Math.pow(1 - progress, 3);

          marker.setPosition({
            lat: previous.lat + (driverPoint.lat - previous.lat) * eased,
            lng: previous.lng + (driverPoint.lng - previous.lng) * eased,
          });

          if (progress < 1) window.requestAnimationFrame(frame);
        }

        window.requestAnimationFrame(frame);
      }
    }

    if (driverPoint) {
      mapRef.current?.panTo(driverPoint);
    }

    lastDriverPointRef.current = driverPoint;
    fitOnce();

    // Recalcula la ruta solo cuando aparece el primer punto o cuando cambia el estado.
    if (!routeKeyRef.current || ride.status === "in_progress") {
      drawRoute(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, livePoint?.lat, livePoint?.lng, ride.status]);

  return (
    <div
      style={{
        marginBottom: "12px",
        borderRadius: "20px",
        overflow: "hidden",
        border: "1px solid rgba(200,155,60,.32)",
        background: "#111111",
        boxShadow: "0 10px 24px rgba(0,0,0,.18)",
      }}
    >
      <div
        style={{
          padding: "10px 12px",
          color: "#F6F2EC",
          background: "linear-gradient(135deg,#111111,#3a2118)",
          display: "flex",
          justifyContent: "space-between",
          gap: "10px",
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ fontWeight: 950, fontSize: ".9rem" }}>{routeTitle}</div>
          <div style={{ color: "rgba(246,242,236,.68)", fontSize: ".72rem", marginTop: 2 }}>
            {lastUpdatedAt
              ? `Actualizado ${lastUpdatedAt.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}`
              : liveMessage}
          </div>
        </div>
        <IonBadge color={driverPoint ? "success" : "warning"}>
          {driverPoint ? "En vivo" : "GPS"}
        </IonBadge>
      </div>

      <div
        ref={(el) => {
          mapElementRef.current = el;
        }}
        style={{ width: "100%", height: 260, background: "#f3f4ef" }}
      />

      {!driverPoint && (
        <div
          style={{
            padding: "9px 12px",
            color: "#F6F2EC",
            fontSize: ".76rem",
            fontWeight: 800,
            background: "#1f1f1f",
          }}
        >
          El conductor debe tener la ubicación activa para que veas el punto azul moverse en tiempo real.
        </div>
      )}
    </div>
  );
}


function TripsPage(): JSX.Element {
  const history = useHistory();
  const { session } = useAuth();
  const passengerConnection = useRapaGoConnectivityMonitor("passenger");

  const [allRides,    setAllRides]    = useState<RideRequestData[]>([]);
  const [page,        setPage]        = useState(1);
  const [loading,     setLoading]     = useState(true);
  const [loadError,   setLoadError]   = useState<string | null>(null);
  const [cancelling,  setCancelling]  = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [ratingRideId,  setRatingRideId]  = useState<string | null>(null);
  const [ratingStars,   setRatingStars]   = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingPrivateComment, setRatingPrivateComment] = useState(false);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [ratingError,   setRatingError]   = useState<string | null>(null);
  const [ratedIds,      setRatedIds]      = useState<Set<string>>(new Set());
  const [statusFilter,  setStatusFilter]  = useState<"all" | "active" | "completed" | "cancelled">("active");

  const loadRides = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const localRides = readLocalPassengerRides();
      const requeuedRides = syncRequeuedRidesIntoLocalPassengerRides();

      if (passengerConnection.blocked || !session?.accessToken) {
        setAllRides(sortPassengerRidesForDisplay(mergePassengerRidesForDisplay([...localRides, ...requeuedRides])));
        setPage(1);
        return;
      }

      const data = await ridesService.listMyRides(session.accessToken);
      setAllRides(sortPassengerRidesForDisplay(mergePassengerRidesForDisplay([...localRides, ...data, ...requeuedRides])));
      setPage(1);
    } catch (err) {
      const localRides = readLocalPassengerRides();
      const requeuedRides = syncRequeuedRidesIntoLocalPassengerRides();
      setAllRides(sortPassengerRidesForDisplay(mergePassengerRidesForDisplay([...localRides, ...requeuedRides])));
      setPage(1);

      const message = err instanceof Error ? err.message : "Error al cargar tus viajes.";
      if (!isUnauthorizedMessage(message)) {
        setLoadError(safePassengerErrorMessage(message));
      } else {
        setLoadError(null);
      }
    } finally {
      setLoading(false);
    }
  }, [passengerConnection.blocked, session?.accessToken]);

  useEffect(() => { void loadRides(); }, [loadRides]);

  useEffect(() => {
    const refreshPassengerRides = () => { void loadRides(); };
    window.addEventListener("storage", refreshPassengerRides);
    window.addEventListener(RAPAGO_REQUEUED_RIDES_EVENT, refreshPassengerRides as EventListener);
    window.addEventListener("rapago:passenger-rides-updated", refreshPassengerRides as EventListener);

    return () => {
      window.removeEventListener("storage", refreshPassengerRides);
      window.removeEventListener(RAPAGO_REQUEUED_RIDES_EVENT, refreshPassengerRides as EventListener);
      window.removeEventListener("rapago:passenger-rides-updated", refreshPassengerRides as EventListener);
    };
  }, [loadRides]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  async function handleCancel(rideId: string) {
    if (passengerConnection.blocked) {
      setCancelError(passengerConnection.message);
      return;
    }

    const target =
      allRides.find((ride) => ride.id === rideId) ??
      readLocalPassengerRides().find((ride) => ride.id === rideId) ??
      readPassengerRequeuedRides().find((ride) => ride.id === rideId);

    if (!target) return;

    setCancelling(rideId);
    setCancelError(null);

    const cancelledLocal = cancelPassengerRideEverywhere(target);
    setAllRides((prev) => applyPassengerCancelledRideToList(prev, target, cancelledLocal));

    try {
      const shouldTryBackend =
        Boolean(session?.accessToken) &&
        !rideId.startsWith("local-") &&
        !rideId.startsWith("admin-local-") &&
        !isPassengerDriverCancelledRequeue(target);

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

  async function handleSubmitRating() {
    if (!session?.accessToken || !ratingRideId) return;
    setSubmittingRating(true);
    setRatingError(null);
    try {
      await ridesService.rateRide(
        session.accessToken,
        ratingRideId,
        ratingStars,
        ratingComment.trim() || undefined,
      );
      setRatedIds((prev) => new Set([...prev, ratingRideId]));
      setRatingRideId(null);
      setRatingStars(5);
      setRatingComment("");
      setRatingPrivateComment(false);
    } catch (err) {
      setRatingError(safePassengerErrorMessage(err instanceof Error ? err.message : "Error al calificar el viaje."));
    } finally {
      setSubmittingRating(false);
    }
  }

  async function handleCancelAccepted(rideId: string) {
    if (passengerConnection.blocked) {
      setCancelError(passengerConnection.message);
      return;
    }

    const target =
      allRides.find((ride) => ride.id === rideId) ??
      readLocalPassengerRides().find((ride) => ride.id === rideId) ??
      readPassengerRequeuedRides().find((ride) => ride.id === rideId);

    if (!target) return;

    setCancelling(rideId);
    setCancelError(null);

    const cancelledLocal = cancelPassengerRideEverywhere(target);
    setAllRides((prev) => applyPassengerCancelledRideToList(prev, target, cancelledLocal));

    try {
      const shouldTryBackend =
        Boolean(session?.accessToken) &&
        !rideId.startsWith("local-") &&
        !rideId.startsWith("admin-local-");

      if (shouldTryBackend) {
        await ridesService.cancelAcceptedRide(session!.accessToken, rideId);
      }

      setCancelError(null);
    } catch {
      // El viaje ya quedó cancelado localmente. No mostramos error técnico al pasajero.
      setCancelError(null);
    } finally {
      setCancelling(null);
      void loadRides();
    }
  }

  const ACTIVE_STATUSES = PASSENGER_ACTIVE_STATUSES;
  const filteredAllRides = allRides.filter((r) => {
    const effectiveStatus = getEffectivePassengerRideStatus(r);
    if (statusFilter === "all")       return true;
    if (statusFilter === "active")    return ACTIVE_STATUSES.includes(effectiveStatus);
    if (statusFilter === "completed") return effectiveStatus === "completed";
    if (statusFilter === "cancelled") return effectiveStatus === "cancelled";
    return true;
  });

  // Primero filtramos y recién después paginamos.
  // Este era el problema de la captura: había Activos, pero quedaban fuera de la primera página.
  const filtered = filteredAllRides.slice(0, page * PAGE_SIZE);

  // Counts use the full dataset so chips always show accurate numbers
  const counts = {
    all:       allRides.length,
    active:    allRides.filter((r) => ACTIVE_STATUSES.includes(getEffectivePassengerRideStatus(r))).length,
    completed: allRides.filter((r) => getEffectivePassengerRideStatus(r) === "completed").length,
    cancelled: allRides.filter((r) => getEffectivePassengerRideStatus(r) === "cancelled").length,
  };

  const hasMore = page * PAGE_SIZE < filteredAllRides.length;

  return (
    <IonPage>
      <RapaGoLanguageRuntime />
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Mis Viajes</IonTitle>
        </IonToolbar>
        {/* Filter chips */}
        <IonToolbar style={{ "--background": "var(--ion-color-primary)", "--border-width": "0" }}>
          <div style={{ display: "flex", gap: "8px", padding: "0 12px 10px", overflowX: "auto" }}>
            {(["all", "active", "completed", "cancelled"] as const).map((f) => {
              const labels = { all: "Todos", active: "Activos", completed: "Completados", cancelled: "Cancelados" };
              const active = statusFilter === f;
              return (
                <IonChip
                  key={f}
                  style={{
                    flexShrink: 0,
                    "--background": active ? "#fff" : "rgba(255,255,255,0.2)",
                    "--color": active ? "var(--ion-color-primary)" : "#fff",
                    fontSize: "0.78rem",
                    height: "28px",
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
      </IonHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={(e) => { void loadRides().then(() => e.detail.complete()); }}>
          <IonRefresherContent />
        </IonRefresher>

        <div style={{ padding: "12px 16px 0" }}>
          <RapaGoConnectivityBanner
            role="passenger"
            status={passengerConnection.status}
          />
        </div>

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }}>
            <IonSpinner name="crescent" />
          </div>
        )}

        {loadError && (
          <div style={{ padding: "16px" }}>
            <IonText color="danger"><p>{loadError}</p></IonText>
          </div>
        )}

        {!loading && allRides.length === 0 && (
          <EmptyState
            icon={carOutline}
            title="Sin viajes todavía"
            subtitle="Solicita tu primer traslado en Rapa Nui"
            actionLabel="Solicitar viaje"
            onAction={() => history.push(ROUTES.PASSENGER.REQUEST_RIDE)}
          />
        )}

        {!loading && allRides.length > 0 && filtered.length === 0 && (
          <EmptyState
            icon={carOutline}
            title="Sin resultados"
            subtitle="No hay viajes en esta categoría"
          />
        )}

        {!loading && filtered.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "12px 16px 16px" }}>
            {filtered.map((ride) => {
              const scheduleInfo = getPassengerRideScheduleInfo(ride);
              const effectiveStatus = getEffectivePassengerRideStatus(ride);
              const color = RIDE_STATUS_COLOR[effectiveStatus] ?? "medium";
              const label = RIDE_STATUS_LABEL[effectiveStatus] ?? effectiveStatus;
              const isActive = ACTIVE_STATUSES.includes(effectiveStatus);
              const driverDisplayRide = enrichPassengerRideWithDriverVehicleData(ride);
              const driverDisplayRecord = driverDisplayRide as RideRequestData & Record<string, unknown>;
              const driverDisplayName = passengerIndexFirstValue(driverDisplayRecord.driverName, driverDisplayRecord.driverFullName);
              const driverDisplayVehicle = passengerIndexGetDriverVehiclePublicData(driverDisplayRecord);

              const timelineSteps = [
                { status: "requested",       label: "Solicitado",            time: ride.requestedAt,  completed: !!ride.requestedAt,  active: effectiveStatus === "requested" },
                { status: "accepted",        label: "Conductor asignado",    time: ride.acceptedAt,   completed: !!ride.acceptedAt,   active: effectiveStatus === "accepted" },
                { status: "driver_en_route", label: "Conductor en camino",   time: ride.enRouteAt,    completed: !!ride.enRouteAt,    active: effectiveStatus === "driver_en_route" },
                { status: "driver_arrived",  label: "Conductor llegó",       time: ride.arrivedAt,    completed: !!ride.arrivedAt,    active: effectiveStatus === "driver_arrived" },
                { status: "in_progress",     label: "Viaje en curso",        time: ride.startedAt,    completed: !!ride.startedAt,    active: effectiveStatus === "in_progress" },
                { status: "completed",       label: "Completado",            time: ride.completedAt,  completed: !!ride.completedAt,  active: false },
              ];

              return (
                <IonCard key={ride.id} style={passengerCardStyle({ borderRadius: "20px" })}>
                  {/* Status bar */}
                  <div style={{
                    height: "4px",
                    background: `var(--ion-color-${color})`,
                  }} />
                  <IonCardContent style={{ padding: "14px 16px" }}>

                    {/* Route header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--ion-color-success)", flexShrink: 0 }} />
                          <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--ion-text-color)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {ride.originText}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <div style={{ width: "8px", height: "8px", borderRadius: "2px", background: "var(--ion-color-danger)", flexShrink: 0 }} />
                          <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--ion-text-color)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {ride.destinationText}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px", flexShrink: 0, marginLeft: "8px" }}>
                        <IonBadge color={color} style={{ fontSize: "0.7rem" }}>{label}</IonBadge>
                        {ride.isOfflineBooking && (
                          <IonBadge color="warning" style={{ fontSize: "0.68rem" }}>Telefónica</IonBadge>
                        )}
                      </div>
                    </div>

                    {scheduleInfo.isScheduled && (
                      <div
                        style={{
                          marginBottom: "10px",
                          padding: "12px",
                          borderRadius: "16px",
                          background: scheduleInfo.isActiveWindow ? "rgba(42,168,74,.12)" : "rgba(255,201,40,.16)",
                          border: scheduleInfo.isActiveWindow ? "1px solid rgba(42,168,74,.30)" : "1px solid rgba(255,201,40,.40)",
                          color: "#111",
                          fontSize: "0.78rem",
                          lineHeight: 1.35,
                        }}
                      >
                        <strong>📅 Viaje agendado</strong>
                        <div>Recogida: {formatScheduleDateTime(scheduleInfo.scheduledAt)}</div>
                        {scheduleInfo.returnScheduledAt && <div>Regreso: {formatScheduleDateTime(scheduleInfo.returnScheduledAt)}</div>}
                        <div>{scheduleInfo.isActiveWindow ? "Ya se activó para buscar conductor." : `Se activará ${SCHEDULE_ACTIVATION_MINUTES} min antes de la hora reservada.`}</div>
                      </div>
                    )}

                    {scheduleInfo.isScheduled && isPassengerRideDriverScheduled(ride) && ride.driverName && (
                      <div
                        style={{
                          marginBottom: "10px",
                          padding: "12px",
                          borderRadius: "16px",
                          background: "rgba(42,168,74,.14)",
                          border: "1px solid rgba(42,168,74,.35)",
                          color: "#111",
                          fontSize: "0.8rem",
                          lineHeight: 1.35,
                        }}
                      >
                        <strong>✅ Conductor agendado correctamente</strong>
                        <div>{getPassengerRideNotification(ride) ?? `Tu conductor ${ride.driverName} fue agendado para este viaje.`}</div>
                        <div style={{ marginTop: 4 }}>El viaje se mantiene reservado y se activa automáticamente 10 minutos antes.</div>
                      </div>
                    )}

                    {/* Fare */}
                    {ride.estimatedFareClp != null && (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                        <span style={{ fontSize: "1rem", fontWeight: 700, color: "var(--ion-color-primary)" }}>
                          ${ride.estimatedFareClp.toLocaleString("es-CL")} CLP
                        </span>
                        {getRidePassengerFareType(ride) && (
                          <IonBadge color="warning" style={{ fontSize: "0.65rem" }}>
                            {passengerFareTypeLabel(getRidePassengerFareType(ride) as PassengerFareType)}
                          </IonBadge>
                        )}
                        {ride.discountApplied && ride.originalFareClp != null && (
                          <>
                            <IonBadge color="success" style={{ fontSize: "0.65rem" }}>-{ride.discountPercent}%</IonBadge>
                            <span style={{ fontSize: "0.72rem", color: "var(--ion-color-medium)", textDecoration: "line-through" }}>
                              ${ride.originalFareClp.toLocaleString("es-CL")}
                            </span>
                          </>
                        )}
                      </div>
                    )}

                    {/* Driver card */}
                    {driverDisplayName && (["accepted", "driver_en_route", "driver_arrived", "in_progress", "completed"].includes(effectiveStatus) || effectiveStatus === "driver_scheduled") && (
                      <div style={{ marginBottom: "10px" }}>
                        <DriverInfoCard
                          name={driverDisplayName}
                          rating={driverDisplayRide.driverRatingAverage}
                          ratingCount={driverDisplayRide.driverRatingCount}
                          vehicleBrand={driverDisplayVehicle.brand || driverDisplayRide.driverVehicleBrand}
                          vehicleModel={driverDisplayVehicle.model || driverDisplayRide.driverVehicleModel}
                          vehicleColor={driverDisplayVehicle.color || driverDisplayRide.driverVehicleColor}
                          vehiclePlate={driverDisplayVehicle.plate || driverDisplayRide.driverVehiclePlate}
                          vehicleYear={driverDisplayRide.driverVehicleYear}
                          phone={driverDisplayRide.driverPhone ?? null}
                          waMessage={driverDisplayRide.driverPhone && driverDisplayName
                            ? WA_MESSAGES.passengerToDriver({ driverName: driverDisplayName, passengerName: "pasajero", origin: ride.originText })
                            : null
                          }
                        />

                        {driverDisplayVehicle.imageDataUrl && (
                          <img
                            src={driverDisplayVehicle.imageDataUrl}
                            alt={`Imagen del vehículo de ${driverDisplayName}`}
                            style={{
                              width: "100%",
                              height: "190px",
                              objectFit: "cover",
                              borderRadius: "16px",
                              marginTop: "10px",
                              border: "1px solid rgba(0,0,0,.08)",
                            }}
                          />
                        )}
                      </div>
                    )}

                    {!ride.driverName && effectiveStatus === "requested" && (
                      <div
                        style={{
                          marginBottom: "10px",
                          padding: "12px",
                          borderRadius: "16px",
                          background: "#ffffff",
                          border: "1px solid rgba(0,0,0,.06)",
                          boxShadow: "0 6px 18px rgba(0,0,0,.06)",
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                        }}
                      >
                        <IonSpinner name="crescent" style={{ width: "18px", height: "18px" }} />
                        <div>
                          <div style={{ fontWeight: 900, fontSize: "0.86rem", color: "#111" }}>
                            Buscando conductor
                          </div>
                          <div style={{ color: "var(--ion-color-medium)", fontSize: "0.74rem", marginTop: "2px" }}>
                            Tu solicitud ya fue enviada a conductores cercanos.
                          </div>
                        </div>
                      </div>
                    )}

                    {session?.accessToken &&
                      ride.driverName &&
                      ["accepted", "driver_en_route", "driver_arrived", "in_progress"].includes(ride.status) &&
                      (!scheduleInfo.isScheduled || scheduleInfo.isActiveWindow) && (
                        <PassengerDriverLiveMap
                          ride={ride}
                          token={session.accessToken}
                        />
                      )}

                    {/* Timeline — solo si activo o completado */}
                    {((isActive && effectiveStatus !== "scheduled") || ride.status === "completed") && (
                      <div style={{ marginBottom: "10px", borderTop: "1px solid var(--ion-color-light-shade)", paddingTop: "10px" }}>
                        <TripTimeline steps={timelineSteps} />
                      </div>
                    )}

                    {/* Cancellation info */}
                    {ride.status === "cancelled" && (
                      <div style={{ background: "var(--ion-color-danger-tint)", borderRadius: "8px", padding: "8px 12px", marginBottom: "10px" }}>
                        {ride.cancellationReason && (
                          <div style={{ fontSize: "0.78rem", color: "var(--ion-color-danger-shade)", fontWeight: 500 }}>
                            Motivo: {ride.cancellationReason}
                          </div>
                        )}
                        {ride.cancelledByRole && (
                          <div style={{ fontSize: "0.72rem", color: "var(--ion-color-danger-shade)", marginTop: "2px" }}>
                            Cancelado por: {ride.cancelledByRole === "passenger" ? "pasajero" : "conductor"}
                          </div>
                        )}
                        {ride.cancelledAt && (
                          <div style={{ fontSize: "0.7rem", color: "var(--ion-color-medium)", marginTop: "2px" }}>
                            {new Date(ride.cancelledAt).toLocaleString("es-CL")}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Notes */}
                    {cleanPassengerNotes(ride.notes) && (
                      <div style={{ fontSize: "0.8rem", color: "var(--ion-color-medium)", marginBottom: "8px" }}>
                        {cleanPassengerNotes(ride.notes)}
                      </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "4px" }}>
                      {(effectiveStatus === "scheduled" || effectiveStatus === "requested" || effectiveStatus === "accepted") && (
                        <IonButton
                          size="small"
                          fill="outline"
                          color="danger"
                          disabled={cancelling === ride.id}
                          onClick={() => void (effectiveStatus === "scheduled" || effectiveStatus === "requested" ? handleCancel(ride.id) : handleCancelAccepted(ride.id))}
                        >
                          {cancelling === ride.id ? <IonSpinner name="dots" /> : "Cancelar"}
                        </IonButton>
                      )}
                      {ride.status === "completed" && !ratedIds.has(ride.id) && ratingRideId !== ride.id && (
                        <IonButton
                          size="small"
                          fill="outline"
                          color="warning"
                          onClick={() => { setRatingRideId(ride.id); setRatingStars(5); setRatingComment(""); setRatingError(null); }}
                        >
                          ⭐ Calificar
                        </IonButton>
                      )}
                      {ride.status === "completed" && ratedIds.has(ride.id) && (
                        <IonBadge color="success" style={{ fontSize: "0.72rem", padding: "4px 8px" }}>✓ Calificado</IonBadge>
                      )}
                      {ride.status === "completed" && (
                        <WhatsAppButton
                          phone={RAPAGO_CONTACT.adminPhone}
                          message={WA_MESSAGES.passengerToAdmin({ origin: ride.originText, destination: ride.destinationText, name: "pasajero" })}
                          label="Soporte"
                          size="small"
                        />
                      )}
                      {ride.driverName && isActive && !ride.driverPhone && (
                        <WhatsAppButton
                          phone={RAPAGO_CONTACT.adminPhone}
                          message={WA_MESSAGES.passengerToAdmin({ origin: ride.originText, destination: ride.destinationText, name: "pasajero" })}
                          label="Operador"
                          size="small"
                        />
                      )}
                    </div>
                  </IonCardContent>
                </IonCard>
              );
            })}
          </div>
        )}

        <IonInfiniteScroll
          threshold="100px"
          disabled={!hasMore || loading}
          onIonInfinite={(ev) => {
            setPage((p) => p + 1);
            void (ev.target as HTMLIonInfiniteScrollElement).complete();
          }}
        >
          <IonInfiniteScrollContent loadingText="Cargando más viajes..." />
        </IonInfiniteScroll>

        {cancelError && (
          <div style={{ padding: "0 16px" }}>
            <IonText color="danger">
              <p style={{ fontSize: "0.85rem" }}>{cancelError}</p>
            </IonText>
          </div>
        )}

        {ratingRideId && (
          <IonCard style={{ margin: "12px 16px" }}>
            <IonCardContent style={{ padding: "14px 16px" }}>
              <div style={{ fontWeight: 600, marginBottom: "8px" }}>⭐ Calificar conductor</div>
              <StarRatingInput value={ratingStars} onChange={setRatingStars} />
              <IonItem lines="none" style={{ "--padding-start": "0", marginTop: "8px" }}>
                <IonTextarea
                  value={ratingComment}
                  onIonInput={(e) => setRatingComment(String(e.detail.value ?? ""))}
                  placeholder="Comentario opcional"
                  maxlength={500}
                  rows={2}
                />
              </IonItem>
              <IonItem lines="none">
                <IonLabel>
                  <div>Comentario solo para RAPA GO</div>
                  <IonNote>El conductor no verá el texto privado.</IonNote>
                </IonLabel>
                <IonToggle checked={ratingPrivateComment} onIonChange={(event) => setRatingPrivateComment(event.detail.checked)} />
              </IonItem>
              {ratingError && <IonText color="danger"><p style={{ fontSize: "0.82rem", margin: "4px 0" }}>{ratingError}</p></IonText>}
              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                <IonButton size="small" onClick={() => void handleSubmitRating()} disabled={submittingRating}>
                  {submittingRating ? <IonSpinner name="dots" /> : "Enviar"}
                </IonButton>
                <IonButton size="small" fill="outline" color="medium" onClick={() => { setRatingRideId(null); setRatingPrivateComment(false); }}>
                  Cancelar
                </IonButton>
              </div>
            </IonCardContent>
          </IonCard>
        )}
      </IonContent>
    </IonPage>
  );
}

const BOOKING_STATUS_LABEL: Record<string, string> = {
  pending:   "Pendiente",
  confirmed: "Confirmada",
  completed: "Completada",
  cancelled: "Cancelada",
};

const BOOKING_STATUS_COLOR: Record<string, string> = {
  pending:   "warning",
  confirmed: "success",
  completed: "medium",
  cancelled: "danger",
};

const SERVICE_TYPE_LABEL: Record<string, string> = {
  tour:     "Tour",
  transfer: "Traslado",
  workshop: "Taller",
  custom:   "Personalizado",
};

export function PassengerGuidesPage(): JSX.Element {
  const { session } = useAuth();
  const [guides,       setGuides]       = useState<GuidePublicData[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [loadError,    setLoadError]    = useState<string | null>(null);
  const [searchName,   setSearchName]   = useState("");
  const [filterLang,   setFilterLang]   = useState("");
  const [selectedGuide, setSelectedGuide] = useState<GuidePublicData | null>(null);

  const load = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setLoadError(null);
    try {
      const filters: { name?: string; language?: string } = {};
      if (searchName.trim()) filters.name = searchName.trim();
      if (filterLang) filters.language = filterLang;
      const data = await touristService.listGuides(session.accessToken, filters);
      setGuides(data);
    } catch (err) {
      setLoadError(safePassengerErrorMessage(err instanceof Error ? err.message : "Error al cargar guías."));
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, searchName, filterLang]);

  useIonViewWillEnter(() => { void load(); });
  useEffect(() => { void load(); }, [load]);

  if (selectedGuide) {
    return (
      <PassengerGuideDetailPage
        guide={selectedGuide}
        onBack={() => setSelectedGuide(null)}
      />
    );
  }

  const LANG_LABEL: Record<string, string> = { es: "🇨🇱 ES", en: "🇺🇸 EN", rapa_nui: "🗿 RP" };

  return (
    <IonPage>
      <RapaGoLanguageRuntime />
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Guías locales</IonTitle>
        </IonToolbar>
        <IonToolbar style={{ "--background": "var(--ion-color-primary)", "--border-width": "0" }}>
          <div style={{ padding: "0 12px 10px" }}>
            <IonSearchbar
              value={searchName}
              onIonInput={(e) => setSearchName(String(e.detail.value ?? ""))}
              onIonChange={() => void load()}
              placeholder="Buscar guía..."
              debounce={400}
              style={{ "--background": "rgba(255,255,255,0.15)", "--color": "#fff", "--placeholder-color": "rgba(255,255,255,0.7)", "--icon-color": "rgba(255,255,255,0.8)", padding: 0 }}
            />
            <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "2px" }}>
              {(["", "es", "en", "rapa_nui"] as const).map((lang) => (
                <IonChip
                  key={lang}
                  style={{
                    flexShrink: 0,
                    "--background": filterLang === lang ? "#fff" : "rgba(255,255,255,0.2)",
                    "--color": filterLang === lang ? "var(--ion-color-primary)" : "#fff",
                    fontSize: "0.76rem", height: "26px",
                    fontWeight: filterLang === lang ? 700 : 400,
                  }}
                  onClick={() => setFilterLang(lang)}
                >
                  {lang === "" ? "Todos" : LANG_LABEL[lang] ?? lang}
                </IonChip>
              ))}
            </div>
          </div>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={(e) => { void load().then(() => e.detail.complete()); }}>
          <IonRefresherContent />
        </IonRefresher>

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }}>
            <IonSpinner name="crescent" />
          </div>
        )}
        {loadError && <div style={{ padding: "16px" }}><IonText color="danger"><p>{loadError}</p></IonText></div>}

        {!loading && guides.length === 0 && (
          <EmptyState icon={compassOutline} title="Guías locales próximamente" subtitle="Estamos preparando perfiles, rutas turísticas y experiencias aprobadas para Rapa Nui." />
        )}

        {!loading && guides.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "12px 16px 80px" }}>
            {guides.map((guide) => {
              const initials = guide.name.trim().split(/\s+/).map((p) => p[0] ?? "").slice(0, 2).join("").toUpperCase();
              const rating = guide.ratingAverage ?? 0;
              return (
                <IonCard
                  key={guide.id}
                  className="ion-activatable"
                  style={{ margin: 0, borderRadius: "16px", boxShadow: "0 2px 12px rgba(0,0,0,0.08)", cursor: "pointer", overflow: "hidden" }}
                  onClick={() => setSelectedGuide(guide)}
                >
                  <IonCardContent style={{ padding: "16px" }}>
                    <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                      {/* Avatar */}
                      <div style={{
                        width: "60px", height: "60px", borderRadius: "50%", flexShrink: 0,
                        background: "var(--ion-color-warning-tint)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        border: "2px solid var(--ion-color-warning)",
                      }}>
                        <span style={{ fontWeight: 800, fontSize: "1.2rem", color: "var(--ion-color-warning-shade)" }}>
                          {initials || "G"}
                        </span>
                      </div>
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 700, fontSize: "1rem" }}>{guide.name}</span>
                        </div>
                        {/* Rating */}
                        <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "4px" }}>
                          {[1,2,3,4,5].map((n) => (
                            <span key={n} style={{ fontSize: "0.85rem", color: n <= Math.round(rating) ? "#f4c430" : "var(--ion-color-light-shade)" }}>★</span>
                          ))}
                          <span style={{ fontSize: "0.72rem", color: "var(--ion-color-medium)", marginLeft: "4px" }}>
                            {rating > 0 ? rating.toFixed(1) : "Sin calificaciones"}{guide.ratingCount ? ` (${guide.ratingCount})` : ""}
                          </span>
                        </div>
                        {/* Bio */}
                        {guide.bio && (
                          <div style={{ fontSize: "0.78rem", color: "var(--ion-color-medium)", marginTop: "4px", lineHeight: 1.4 }}>
                            {guide.bio.slice(0, 90)}{guide.bio.length > 90 ? "…" : ""}
                          </div>
                        )}
                        {/* Languages */}
                        {(guide.languages ?? []).length > 0 && (
                          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "6px" }}>
                            {(guide.languages ?? []).map((lang) => (
                              <IonChip key={lang} color="warning" style={{ fontSize: "0.68rem", height: "20px", margin: 0 }}>
                                <IonLabel>{LANG_LABEL[lang] ?? lang.toUpperCase()}</IonLabel>
                              </IonChip>
                            ))}
                          </div>
                        )}
                      </div>
                      <IonIcon icon={chevronForwardOutline} style={{ color: "var(--ion-color-medium)", fontSize: "1.1rem", flexShrink: 0, marginTop: "4px" }} />
                    </div>
                  </IonCardContent>
                </IonCard>
              );
            })}
          </div>
        )}
      </IonContent>
    </IonPage>
  );
}

function PassengerGuideDetailPage({ guide, onBack }: { guide: GuidePublicData; onBack: () => void }): JSX.Element {
  const { session } = useAuth();
  const [services,     setServices]     = useState<TouristServiceData[]>(guide.services ?? []);
  const [loading,      setLoading]      = useState(!guide.services);
  const [bookingService, setBookingService] = useState<TouristServiceData | null>(null);
  const [bookingDate,  setBookingDate]  = useState(new Date().toISOString().slice(0, 10));
  const [bookingTime,  setBookingTime]  = useState("");
  const [numPeople,    setNumPeople]    = useState(1);
  const [notes,        setNotes]        = useState("");
  const [submitting,   setSubmitting]   = useState(false);
  const [toastMsg,     setToastMsg]     = useState<string | null>(null);
  const [pricingData,  setPricingData]  = useState<import("../../features/tourist/tourist.service.js").ServicePricingData | null>(null);

  useEffect(() => {
    if (guide.services) return;
    if (!session?.accessToken) return;
    setLoading(true);
    touristService.listGuideServices(session.accessToken, guide.id)
      .then((data) => setServices(data))
      .catch(() => setServices([]))
      .finally(() => setLoading(false));
  }, [guide.id, guide.services, session?.accessToken]);

  useEffect(() => {
    if (!bookingService || !session?.accessToken) return;
    touristService.getServicePricing(session.accessToken, bookingService.id)
      .then((data) => setPricingData(data))
      .catch(() => setPricingData(null));
  }, [bookingService?.id, session?.accessToken]);

  const initials = guide.name.trim().split(/\s+/).map((p) => p[0] ?? "").slice(0, 2).join("").toUpperCase();
  const stars = guide.ratingAverage ? Math.round(guide.ratingAverage) : 0;

  function computePrice(): { display: string; valid: boolean } {
    if (!bookingService) return { display: "", valid: false };
    if (pricingData && pricingData.tiers.length > 0) {
      const tier = pricingData.tiers.find((t) => t.minPeople <= numPeople && t.maxPeople >= numPeople);
      if (tier) return { display: `$${(tier.price / 100).toLocaleString("es-CL")} CLP`, valid: true };
      return { display: `Contactar operador para grupos de ${numPeople} personas`, valid: false };
    }
    if (bookingService.price !== null) {
      return { display: `$${((bookingService.price * numPeople) / 100).toLocaleString("es-CL")} CLP`, valid: true };
    }
    return { display: "", valid: true };
  }

  async function handleBook() {
    if (!session?.accessToken || !bookingService) return;
    setSubmitting(true);
    try {
      const input: import("../../features/tourist/tourist.service.js").CreateBookingInput = {
        serviceId:      bookingService.id,
        bookingDate,
        numberOfPeople: numPeople,
      };
      if (bookingTime) input.bookingTime = bookingTime;
      if (notes.trim()) input.notes = notes.trim();
      await touristService.createBooking(session.accessToken, input);
      setToastMsg("Reserva creada correctamente.");
      setBookingService(null);
      setNotes("");
      setNumPeople(1);
      setPricingData(null);
    } catch (err) {
      setToastMsg(safePassengerErrorMessage(err instanceof Error ? err.message : "Error al reservar.") ?? "Error al reservar.");
    } finally {
      setSubmitting(false);
    }
  }

  const LANG_LABEL_DETAIL: Record<string, string> = { es: "🇨🇱 Español", en: "🇺🇸 English", rapa_nui: "🗿 Rapa Nui" };

  return (
    <IonPage>
      <RapaGoLanguageRuntime />
      <IonHeader>
        <IonToolbar color="primary">
          <IonButton slot="start" fill="clear" color="light" onClick={onBack}>
            <IonIcon slot="icon-only" icon={chevronForwardOutline} style={{ transform: "rotate(180deg)" }} />
          </IonButton>
          <IonTitle>Perfil del guía</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {/* Cover / hero */}
        <div style={{
          background: "linear-gradient(145deg, var(--ion-color-warning-shade) 0%, var(--ion-color-warning) 100%)",
          padding: "28px 20px 24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "10px",
        }}>
          <div style={{
            width: "84px", height: "84px", borderRadius: "50%",
            background: "rgba(255,255,255,0.25)",
            border: "3px solid rgba(255,255,255,0.7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 800, fontSize: "1.8rem",
          }}>
            {initials || "G"}
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: "1.15rem" }}>{guide.name}</div>
          </div>
          {/* Rating row */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            {[1,2,3,4,5].map((n) => (
              <span key={n} style={{ fontSize: "1rem", color: n <= stars ? "#fff" : "rgba(255,255,255,0.4)" }}>★</span>
            ))}
            <span style={{ color: "rgba(255,255,255,0.85)", fontSize: "0.8rem", marginLeft: "4px" }}>
              {guide.ratingAverage ? guide.ratingAverage.toFixed(1) : "Sin calificaciones"}
              {guide.ratingCount ? ` · ${guide.ratingCount} valoraciones` : ""}
            </span>
          </div>
          {/* Languages */}
          {(guide.languages ?? []).length > 0 && (
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "center" }}>
              {(guide.languages ?? []).map((lang) => (
                <span key={lang} style={{
                  background: "rgba(255,255,255,0.2)",
                  color: "#fff",
                  borderRadius: "12px",
                  padding: "2px 10px",
                  fontSize: "0.72rem",
                  fontWeight: 600,
                }}>
                  {LANG_LABEL_DETAIL[lang] ?? lang.toUpperCase()}
                </span>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: "16px 16px 80px" }}>
          {/* Bio */}
          {guide.bio && (
            <IonCard style={{ margin: "0 0 16px", borderRadius: "14px" }}>
              <IonCardContent style={{ padding: "14px 16px" }}>
                <div style={{ fontWeight: 600, fontSize: "0.82rem", color: "var(--ion-color-medium)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Sobre mí</div>
                <div style={{ fontSize: "0.88rem", lineHeight: 1.6, color: "var(--ion-text-color)" }}>{guide.bio}</div>
              </IonCardContent>
            </IonCard>
          )}

          <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "12px" }}>Servicios disponibles</div>

          {loading && <div style={{ display: "flex", justifyContent: "center", padding: "20px" }}><IonSpinner name="crescent" /></div>}

          {!loading && services.length === 0 && (
            <EmptyState icon={compassOutline} title="Sin servicios activos" subtitle="Este guía no tiene servicios publicados aún" />
          )}

          {!loading && services.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {services.map((svc) => {
                const priceDisplay = svc.price !== null
                  ? `$${(svc.price / 100).toLocaleString("es-CL")} CLP/persona`
                  : "Consultar precio";
                return (
                  <IonCard key={svc.id} style={{ margin: 0, borderRadius: "16px", boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
                    <IonCardContent style={{ padding: "16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                        <div style={{ fontWeight: 700, fontSize: "0.95rem", flex: 1 }}>{svc.title}</div>
                        <IonBadge color="tertiary" style={{ fontSize: "0.65rem", marginLeft: "8px", flexShrink: 0 }}>
                          {SERVICE_TYPE_LABEL[svc.type] ?? svc.type}
                        </IonBadge>
                      </div>
                      {svc.description && (
                        <div style={{ fontSize: "0.8rem", color: "var(--ion-color-medium)", marginBottom: "10px", lineHeight: 1.4 }}>
                          {svc.description}
                        </div>
                      )}
                      {/* Meta row */}
                      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", fontSize: "0.78rem", color: "var(--ion-color-medium)", marginBottom: "8px" }}>
                        {svc.durationMinutes && <span>⏱ {svc.durationMinutes} min</span>}
                        {svc.maxPeople && <span>👥 Máx {svc.maxPeople}</span>}
                        {svc.meetingPoint && <span>📍 {svc.meetingPoint}</span>}
                        <span style={{ color: svc.includesVehicle ? "var(--ion-color-primary)" : "var(--ion-color-medium)" }}>
                          🚗 {svc.includesVehicle ? "Incluye vehículo" : "Sin vehículo"}
                        </span>
                      </div>
                      {/* Includes */}
                      {(svc.includes ?? []).length > 0 && (
                        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "10px" }}>
                          {(svc.includes ?? []).map((inc) => (
                            <span key={inc} style={{ background: "var(--ion-color-success-tint)", color: "var(--ion-color-success-shade)", borderRadius: "10px", padding: "2px 8px", fontSize: "0.7rem" }}>
                              ✓ {inc}
                            </span>
                          ))}
                        </div>
                      )}
                      {/* Price + CTA */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
                        <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "var(--ion-color-success)" }}>
                          {priceDisplay}
                        </div>
                        <IonButton
                          size="small"
                          style={{ "--border-radius": "10px" }}
                          onClick={() => { setBookingService(svc); setBookingDate(new Date().toISOString().slice(0, 10)); }}
                        >
                          Reservar
                        </IonButton>
                      </div>
                    </IonCardContent>
                  </IonCard>
                );
              })}
            </div>
          )}
        </div>

        <IonModal isOpen={bookingService !== null} onDidDismiss={() => setBookingService(null)}>
          <IonHeader>
            <IonToolbar color="primary">
              <IonTitle>Reservar servicio</IonTitle>
              <IonButton slot="end" fill="clear" color="light" onClick={() => setBookingService(null)}>Cerrar</IonButton>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            {bookingService && (
              <>
                <div style={{ fontWeight: 600, marginBottom: "12px" }}>{bookingService.title}</div>
                <IonItem lines="full">
                  <IonLabel position="stacked">Fecha</IonLabel>
                  <IonInput
                    type="date"
                    value={bookingDate}
                    min={new Date().toISOString().slice(0, 10)}
                    onIonInput={(e) => setBookingDate(String(e.detail.value ?? ""))}
                  />
                </IonItem>
                <IonItem lines="full">
                  <IonLabel>Hora (opcional)</IonLabel>
                  <IonSelect
                    interface="action-sheet"
                    value={bookingTime}
                    onIonChange={(e) => setBookingTime(String(e.detail.value ?? ""))}
                    placeholder="Sin hora específica"
                  >
                    <IonSelectOption value="">Sin hora</IonSelectOption>
                    {["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00"].map((t) => (
                      <IonSelectOption key={t} value={t}>{t}</IonSelectOption>
                    ))}
                  </IonSelect>
                </IonItem>
                <IonItem lines="full">
                  <IonLabel position="stacked">Número de personas</IonLabel>
                  <IonInput
                    type="number"
                    value={numPeople}
                    min={1}
                    max={bookingService.maxPeople ?? 20}
                    onIonInput={(e) => setNumPeople(Math.max(1, parseInt(String(e.detail.value ?? "1"), 10)))}
                  />
                </IonItem>
                <IonItem lines="none">
                  <IonLabel position="stacked">Notas (opcional)</IonLabel>
                  <IonTextarea
                    value={notes}
                    onIonInput={(e) => setNotes(String(e.detail.value ?? ""))}
                    placeholder="Indicaciones especiales..."
                    rows={3}
                    maxlength={500}
                  />
                </IonItem>
                {(() => {
                  const pr = computePrice();
                  return pr.display ? (
                    <div style={{ padding: "12px 0", fontWeight: 600, color: pr.valid ? "inherit" : "var(--ion-color-warning)" }}>
                      {pr.valid ? `Total estimado: ${pr.display}` : pr.display}
                    </div>
                  ) : null;
                })()}
                {pricingData?.conditions && (
                  <div style={{ fontSize: "0.78rem", color: "var(--ion-color-medium)", marginBottom: "6px" }}>
                    <strong>Condiciones:</strong> {pricingData.conditions}
                  </div>
                )}
                {pricingData?.cancellationPolicy && (
                  <div style={{ fontSize: "0.78rem", color: "var(--ion-color-medium)", marginBottom: "8px" }}>
                    <strong>Cancelación:</strong> {pricingData.cancellationPolicy}
                  </div>
                )}
                <IonButton
                  expand="block"
                  onClick={() => void handleBook()}
                  disabled={submitting || (pricingData !== null && pricingData.tiers.length > 0 && !pricingData.tiers.find((t) => t.minPeople <= numPeople && t.maxPeople >= numPeople))}
                  style={{ marginTop: "8px" }}
                >
                  {submitting ? <IonSpinner name="dots" /> : "Confirmar reserva"}
                </IonButton>
              </>
            )}
          </IonContent>
        </IonModal>

        <IonToast
          isOpen={toastMsg !== null}
          message={toastMsg ?? ""}
          duration={3000}
          onDidDismiss={() => setToastMsg(null)}
          color={toastMsg?.includes("Error") || toastMsg?.includes("Error") ? "danger" : "success"}
        />
      </IonContent>
    </IonPage>
  );
}

function getBookingCountdown(createdAt: string): string {
  const expires  = new Date(createdAt).getTime() + 4 * 60 * 60 * 1000;
  const remaining = expires - Date.now();
  if (remaining <= 0) return "expired";
  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  return `${h}h ${m}m`;
}

export function PassengerServiceBookingsPage(): JSX.Element {
  const { session } = useAuth();
  const [bookings,   setBookings]   = useState<ServiceBookingData[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [loadError,  setLoadError]  = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [confirmId,  setConfirmId]  = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setLoadError(null);
    try {
      const { items } = await touristService.getMyBookings(session.accessToken);
      setBookings(items);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Error al cargar reservas.");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useIonViewWillEnter(() => { void load(); });
  useEffect(() => { void load(); }, [load]);

  async function handleCancel(bookingId: string) {
    if (!session?.accessToken) return;
    setCancelling(bookingId);
    try {
      const updated = await touristService.cancelBooking(session.accessToken, bookingId);
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? updated : b)));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Error al cancelar.");
    } finally {
      setCancelling(null);
      setConfirmId(null);
    }
  }

  return (
    <IonPage>
      <RapaGoLanguageRuntime />
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Mis Reservas de Servicios</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonRefresher slot="fixed" onIonRefresh={(e) => { void load().then(() => e.detail.complete()); }}>
          <IonRefresherContent />
        </IonRefresher>

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }}>
            <IonSpinner name="crescent" />
          </div>
        )}

        {loadError && <IonText color="danger"><p>{loadError}</p></IonText>}

        {!loading && bookings.length === 0 && (
          <IonText color="medium"><p>No tienes reservas de servicios turísticos.</p></IonText>
        )}

        {!loading && bookings.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {bookings.map((b) => (
              <IonCard key={b.id} style={{ margin: 0 }}>
                <IonCardContent style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>Reserva #{b.id.slice(0, 8)}</div>
                      <div style={{ fontSize: "0.78rem", color: "var(--ion-color-medium)", marginTop: "2px" }}>
                        Fecha: {b.bookingDate}{b.bookingTime ? ` ${b.bookingTime}` : ""}
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "var(--ion-color-medium)" }}>
                        {b.numberOfPeople} persona{b.numberOfPeople !== 1 ? "s" : ""}
                        {b.totalPrice !== null && ` · $${(b.totalPrice / 100).toLocaleString("es-CL")} CLP`}
                      </div>
                      {b.notes && (
                        <div style={{ fontSize: "0.75rem", color: "var(--ion-color-medium)", marginTop: "2px" }}>{b.notes}</div>
                      )}
                      <div style={{ marginTop: "6px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        <IonBadge color={BOOKING_STATUS_COLOR[b.status] ?? "medium"} style={{ fontSize: "0.7rem" }}>
                          {BOOKING_STATUS_LABEL[b.status] ?? b.status}
                        </IonBadge>
                        {b.status === "pending" && (() => {
                          const cd = getBookingCountdown(b.createdAt);
                          return cd === "expired"
                            ? <IonBadge color="danger" style={{ fontSize: "0.7rem" }}>Expirada</IonBadge>
                            : <IonBadge color="warning" style={{ fontSize: "0.7rem" }}>Confirmar antes: {cd}</IonBadge>;
                        })()}
                      </div>
                      {b.cancellationReason && (
                        <div style={{ fontSize: "0.72rem", color: "var(--ion-color-danger)", marginTop: "4px" }}>
                          Motivo: {b.cancellationReason}
                        </div>
                      )}
                    </div>
                    {b.status === "pending" && (
                      <IonButton
                        size="small"
                        fill="outline"
                        color="danger"
                        disabled={cancelling === b.id}
                        onClick={() => setConfirmId(b.id)}
                      >
                        {cancelling === b.id ? <IonSpinner name="dots" /> : "Cancelar"}
                      </IonButton>
                    )}
                  </div>
                </IonCardContent>
              </IonCard>
            ))}
          </div>
        )}

        <IonAlert
          isOpen={confirmId !== null}
          header="¿Cancelar reserva?"
          message="Esta acción no se puede deshacer."
          buttons={[
            { text: "No", role: "cancel", handler: () => setConfirmId(null) },
            { text: "Sí, cancelar", role: "confirm", handler: () => { if (confirmId) void handleCancel(confirmId); } },
          ]}
          onDidDismiss={() => setConfirmId(null)}
        />
      </IonContent>
    </IonPage>
  );
}

const VEHICLE_TYPE_LABEL: Record<string, string> = {
  car:        "Auto",
  suv:        "SUV",
  van:        "Van",
  motorcycle: "Moto",
  bicycle:    "Bicicleta",
  quad:       "Quad",
};

const RENTAL_STATUS_COLOR: Record<string, string> = {
  pending:   "warning",
  confirmed: "success",
  active:    "primary",
  completed: "medium",
  cancelled: "danger",
};

const RENTAL_STATUS_LABEL: Record<string, string> = {
  pending:   "Pendiente",
  confirmed: "Confirmada",
  active:    "Activa",
  completed: "Completada",
  cancelled: "Cancelada",
};

export function PassengerRentalsPage(): JSX.Element {
  const { session } = useAuth();
  const [vehicles,       setVehicles]       = useState<RentalVehicleDataType[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [loadError,      setLoadError]      = useState<string | null>(null);
  const [searchText,     setSearchText]     = useState("");
  const [filterType,     setFilterType]     = useState("");
  const [selectedId,     setSelectedId]     = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setLoadError(null);
    try {
      const filters: { type?: string } = {};
      if (filterType) filters.type = filterType;
      const data = await rentalService.listAvailableVehicles(session.accessToken, filters);
      setVehicles(data.items);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Error al cargar vehículos.");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, filterType]);

  useIonViewWillEnter(() => { void load(); });
  useEffect(() => { void load(); }, [load]);

  const filtered = vehicles.filter((v) => {
    if (!searchText.trim()) return true;
    const q = searchText.trim().toLowerCase();
    return v.brand.toLowerCase().includes(q) || v.model.toLowerCase().includes(q);
  });

  if (selectedId) {
    return <PassengerRentalDetailPage vehicleId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  return (
    <IonPage>
      <RapaGoLanguageRuntime />
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Arriendo de Vehículos</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonRefresher slot="fixed" onIonRefresh={(e) => { void load().then(() => e.detail.complete()); }}>
          <IonRefresherContent />
        </IonRefresher>

        <IonSearchbar
          value={searchText}
          onIonInput={(e) => setSearchText(String(e.detail.value ?? ""))}
          placeholder="Buscar por marca o modelo..."
          debounce={300}
        />

        <IonItem lines="none" style={{ marginBottom: "8px" }}>
          <IonLabel>Tipo</IonLabel>
          <IonSelect
            interface="action-sheet"
            value={filterType}
            onIonChange={(e) => setFilterType(String(e.detail.value ?? ""))}
            placeholder="Todos"
          >
            <IonSelectOption value="">Todos</IonSelectOption>
            <IonSelectOption value="car">Auto</IonSelectOption>
            <IonSelectOption value="suv">SUV</IonSelectOption>
            <IonSelectOption value="van">Van</IonSelectOption>
            <IonSelectOption value="motorcycle">Moto</IonSelectOption>
            <IonSelectOption value="bicycle">Bicicleta</IonSelectOption>
            <IonSelectOption value="quad">Quad</IonSelectOption>
          </IonSelect>
        </IonItem>

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }}>
            <IonSpinner name="crescent" />
          </div>
        )}
        {loadError && <div style={{ padding: "16px" }}><IonText color="danger"><p>{loadError}</p></IonText></div>}
        {!loading && filtered.length === 0 && (
          <EmptyState icon={carSportOutline} title="Sin vehículos disponibles" subtitle="Vuelve a intentarlo más tarde" />
        )}
        {!loading && filtered.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px", padding: "12px 16px 80px" }}>
            {filtered.map((v) => (
              <IonCard
                key={v.id}
                className="ion-activatable"
                style={{ margin: 0, borderRadius: "16px", boxShadow: "0 2px 12px rgba(0,0,0,0.08)", overflow: "hidden", cursor: "pointer" }}
                onClick={() => setSelectedId(v.id)}
              >
                {/* Photo */}
                {v.photos && v.photos.length > 0 ? (
                  <img
                    src={v.photos[0]}
                    alt={`${v.brand} ${v.model}`}
                    style={{ width: "100%", height: "160px", objectFit: "cover", display: "block" }}
                  />
                ) : (
                  <div style={{
                    width: "100%", height: "120px",
                    background: "linear-gradient(135deg, var(--ion-color-tertiary-tint) 0%, var(--ion-color-tertiary-shade) 100%)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <IonIcon icon={carSportOutline} style={{ fontSize: "3rem", color: "rgba(255,255,255,0.6)" }} />
                  </div>
                )}
                <IonCardContent style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                    <div style={{ fontWeight: 700, fontSize: "1rem" }}>
                      {v.brand} {v.model}{v.year ? ` (${v.year})` : ""}
                    </div>
                    <IonBadge color="tertiary" style={{ fontSize: "0.65rem", flexShrink: 0, marginLeft: "6px" }}>
                      {VEHICLE_TYPE_LABEL[v.type] ?? v.type}
                    </IonBadge>
                  </div>
                  {/* Specs row */}
                  <div style={{ display: "flex", gap: "10px", fontSize: "0.76rem", color: "var(--ion-color-medium)", marginBottom: "8px", flexWrap: "wrap" }}>
                    {v.seats    && <span>💺 {v.seats} asientos</span>}
                    {v.transmission && <span>⚙️ {v.transmission === "manual" ? "Manual" : "Auto"}</span>}
                    {v.fuelType && <span>⛽ {v.fuelType === "gasoline" ? "Bencina" : v.fuelType === "diesel" ? "Diésel" : v.fuelType === "electric" ? "Eléctrico" : "Híbrido"}</span>}
                    {v.color && <span>🎨 {v.color}</span>}
                  </div>
                  {/* Features */}
                  {(v.features ?? []).length > 0 && (
                    <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "10px" }}>
                      {(v.features ?? []).slice(0, 4).map((f) => (
                        <span key={f} style={{ background: "var(--ion-color-light)", borderRadius: "8px", padding: "2px 8px", fontSize: "0.68rem", color: "var(--ion-color-dark)" }}>
                          {f}
                        </span>
                      ))}
                      {(v.features ?? []).length > 4 && (
                        <span style={{ background: "var(--ion-color-light)", borderRadius: "8px", padding: "2px 8px", fontSize: "0.68rem", color: "var(--ion-color-medium)" }}>
                          +{(v.features ?? []).length - 4}
                        </span>
                      )}
                    </div>
                  )}
                  {/* Price + CTA */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--ion-color-success)" }}>
                        ${(v.dailyPrice / 100).toLocaleString("es-CL")}
                      </span>
                      <span style={{ fontSize: "0.78rem", color: "var(--ion-color-medium)" }}> /día</span>
                    </div>
                    <IonButton size="small" style={{ "--border-radius": "10px" }}>Ver detalles</IonButton>
                  </div>
                </IonCardContent>
              </IonCard>
            ))}
          </div>
        )}
      </IonContent>
    </IonPage>
  );
}

function PassengerRentalDetailPage({ vehicleId, onBack }: { vehicleId: string; onBack: () => void }): JSX.Element {
  const { session } = useAuth();
  const [vehicle,   setVehicle]   = useState<RentalVehicleDataType | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [startDate, setStartDate] = useState("");
  const [endDate,   setEndDate]   = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [returnTime, setReturnTime] = useState("");
  const [pickupLocation, setPickupLocation] = useState("");
  const [returnLocation, setReturnLocation] = useState("");
  const [notes,     setNotes]     = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toastMsg,  setToastMsg]  = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!session?.accessToken) return;
    void rentalService.getVehicle(session.accessToken, vehicleId)
      .then(setVehicle)
      .catch(() => setVehicle(null))
      .finally(() => setLoading(false));
  }, [session?.accessToken, vehicleId]);

  const days = (startDate && endDate && endDate > startDate)
    ? Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  async function handleBook() {
    if (!session?.accessToken || !vehicle) return;
    if (!startDate || !endDate) { setToastMsg("Selecciona fechas de inicio y fin."); return; }
    setSubmitting(true);
    try {
      const input: import("../../features/rental/rental.service.js").CreateBookingInput = {
        vehicleId: vehicle.id,
        startDate,
        endDate,
      };
      if (pickupTime)     input.pickupTime     = pickupTime;
      if (returnTime)     input.returnTime     = returnTime;
      if (pickupLocation.trim()) input.pickupLocation = pickupLocation.trim();
      if (returnLocation.trim()) input.returnLocation = returnLocation.trim();
      if (notes.trim())   input.notes          = notes.trim();
      await rentalService.createRentalBooking(session.accessToken, input);
      setToastMsg("Reserva creada correctamente.");
      setStartDate(""); setEndDate(""); setNotes(""); setPickupTime(""); setReturnTime("");
      setPickupLocation(""); setReturnLocation("");
    } catch (err) {
      setToastMsg(err instanceof Error ? err.message : "Error al reservar.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <IonPage>
      <RapaGoLanguageRuntime />
        <IonHeader><IonToolbar color="primary"><IonButton slot="start" fill="clear" color="light" onClick={onBack}>← Volver</IonButton><IonTitle>Vehículo</IonTitle></IonToolbar></IonHeader>
        <IonContent><div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }}><IonSpinner name="crescent" /></div></IonContent>
      </IonPage>
    );
  }

  if (!vehicle) {
    return (
      <IonPage>
      <RapaGoLanguageRuntime />
        <IonHeader><IonToolbar color="primary"><IonButton slot="start" fill="clear" color="light" onClick={onBack}>← Volver</IonButton><IonTitle>Vehículo</IonTitle></IonToolbar></IonHeader>
        <IonContent className="ion-padding"><IonText color="danger"><p>No se pudo cargar el vehículo.</p></IonText></IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <RapaGoLanguageRuntime />
      <IonHeader>
        <IonToolbar color="primary">
          <IonButton slot="start" fill="clear" color="light" onClick={onBack}>← Volver</IonButton>
          <IonTitle>{vehicle.brand} {vehicle.model}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        {vehicle.photos && vehicle.photos.length > 0 ? (
          <img
            src={vehicle.photos[0]}
            alt={`${vehicle.brand} ${vehicle.model}`}
            style={{ width: "100%", height: "180px", objectFit: "cover", borderRadius: "8px", marginBottom: "12px" }}
          />
        ) : (
          <div style={{
            width: "100%", height: "120px", borderRadius: "8px",
            background: "var(--ion-color-light)",
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: "12px", color: "var(--ion-color-medium)",
          }}>
            Sin foto
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{vehicle.brand} {vehicle.model}</div>
            <IonBadge color="tertiary" style={{ fontSize: "0.68rem" }}>{VEHICLE_TYPE_LABEL[vehicle.type] ?? vehicle.type}</IonBadge>
          </div>
          <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--ion-color-success)" }}>
            ${(vehicle.dailyPrice / 100).toLocaleString("es-CL")}/día
          </div>
        </div>

        <IonCard style={{ margin: "0 0 12px" }}>
          <IonCardContent style={{ padding: "12px 14px" }}>
            <div style={{ fontWeight: 600, marginBottom: "8px", fontSize: "0.9rem" }}>Especificaciones</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: "0.82rem" }}>
              {vehicle.year         && <span><strong>Año:</strong> {vehicle.year}</span>}
              {vehicle.plate        && <span><strong>Patente:</strong> {vehicle.plate}</span>}
              {vehicle.color        && <span><strong>Color:</strong> {vehicle.color}</span>}
              {vehicle.seats        && <span><strong>Asientos:</strong> {vehicle.seats}</span>}
              {vehicle.transmission && <span><strong>Trans.:</strong> {vehicle.transmission === "manual" ? "Manual" : "Automático"}</span>}
              {vehicle.fuelType     && <span><strong>Combustible:</strong> {vehicle.fuelType === "gasoline" ? "Bencina" : vehicle.fuelType === "diesel" ? "Diésel" : vehicle.fuelType === "electric" ? "Eléctrico" : "Híbrido"}</span>}
            </div>
          </IonCardContent>
        </IonCard>

        {vehicle.description && (
          <IonCard style={{ margin: "0 0 12px" }}>
            <IonCardContent style={{ padding: "12px 14px", fontSize: "0.85rem" }}>
              {vehicle.description}
            </IonCardContent>
          </IonCard>
        )}

        {(vehicle.features ?? []).length > 0 && (
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "12px" }}>
            {(vehicle.features ?? []).map((f) => (
              <IonChip key={f} color="primary" style={{ fontSize: "0.72rem", height: "24px" }}>
                <IonLabel>{f}</IonLabel>
              </IonChip>
            ))}
          </div>
        )}

        {(vehicle.operatorName || vehicle.operatorPhone) && (
          <IonCard style={{ margin: "0 0 12px" }}>
            <IonCardContent style={{ padding: "12px 14px" }}>
              <div style={{ fontWeight: 600, marginBottom: "4px", fontSize: "0.9rem" }}>Operador</div>
              {vehicle.operatorName  && <div style={{ fontSize: "0.85rem" }}>{vehicle.operatorName}</div>}
              {vehicle.operatorPhone && <div style={{ fontSize: "0.82rem", color: "var(--ion-color-medium)" }}>{vehicle.operatorPhone}</div>}
            </IonCardContent>
          </IonCard>
        )}

        <IonCard style={{ margin: "0 0 12px" }}>
          <IonCardContent style={{ padding: "12px 14px" }}>
            <div style={{ fontWeight: 600, marginBottom: "10px", fontSize: "0.9rem" }}>Reservar</div>

            <IonItem lines="full">
              <IonLabel position="stacked">Fecha inicio</IonLabel>
              <IonInput
                type="date"
                value={startDate}
                min={today}
                onIonInput={(e) => { setStartDate(String(e.detail.value ?? "")); }}
              />
            </IonItem>

            <IonItem lines="full">
              <IonLabel position="stacked">Fecha fin</IonLabel>
              <IonInput
                type="date"
                value={endDate}
                min={startDate || today}
                onIonInput={(e) => setEndDate(String(e.detail.value ?? ""))}
              />
            </IonItem>

            <IonItem lines="full">
              <IonLabel position="stacked">Hora recogida (opcional)</IonLabel>
              <IonInput type="time" value={pickupTime} onIonInput={(e) => setPickupTime(String(e.detail.value ?? ""))} />
            </IonItem>

            <IonItem lines="full">
              <IonLabel position="stacked">Hora devolución (opcional)</IonLabel>
              <IonInput type="time" value={returnTime} onIonInput={(e) => setReturnTime(String(e.detail.value ?? ""))} />
            </IonItem>

            <IonItem lines="full">
              <IonLabel position="stacked">Lugar recogida (opcional)</IonLabel>
              <IonInput value={pickupLocation} onIonInput={(e) => setPickupLocation(String(e.detail.value ?? ""))} placeholder="Ej: Aeropuerto" maxlength={200} clearInput />
            </IonItem>

            <IonItem lines="full">
              <IonLabel position="stacked">Lugar devolución (opcional)</IonLabel>
              <IonInput value={returnLocation} onIonInput={(e) => setReturnLocation(String(e.detail.value ?? ""))} placeholder="Ej: Hotel" maxlength={200} clearInput />
            </IonItem>

            <IonItem lines="none">
              <IonLabel position="stacked">Notas (opcional)</IonLabel>
              <IonTextarea value={notes} onIonInput={(e) => setNotes(String(e.detail.value ?? ""))} placeholder="Indicaciones especiales..." rows={2} maxlength={500} />
            </IonItem>

            {days !== null && (
              <div style={{ padding: "10px 0", fontWeight: 600, fontSize: "0.9rem" }}>
                {days} día{days !== 1 ? "s" : ""} × ${(vehicle.dailyPrice / 100).toLocaleString("es-CL")} = ${((vehicle.dailyPrice * days) / 100).toLocaleString("es-CL")} total
              </div>
            )}

            <IonButton expand="block" style={{ marginTop: "8px" }} onClick={() => void handleBook()} disabled={submitting}>
              {submitting ? <IonSpinner name="dots" /> : "Confirmar reserva"}
            </IonButton>
          </IonCardContent>
        </IonCard>

        <IonToast
          isOpen={toastMsg !== null}
          message={toastMsg ?? ""}
          duration={3000}
          onDidDismiss={() => setToastMsg(null)}
          color={toastMsg?.includes("Error") || toastMsg?.includes("error") ? "danger" : "success"}
        />
      </IonContent>
    </IonPage>
  );
}

export function PassengerRentalBookingsPage(): JSX.Element {
  const { session } = useAuth();
  const [bookings,   setBookings]   = useState<RentalBookingDataType[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [loadError,  setLoadError]  = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [confirmId,  setConfirmId]  = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await rentalService.getMyRentalBookings(session.accessToken);
      setBookings(data.items);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Error al cargar reservas.");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useIonViewWillEnter(() => { void load(); });
  useEffect(() => { void load(); }, [load]);

  async function handleCancel(bookingId: string) {
    if (!session?.accessToken) return;
    setCancelling(bookingId);
    try {
      const updated = await rentalService.cancelRentalBooking(session.accessToken, bookingId);
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? updated : b)));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Error al cancelar.");
    } finally {
      setCancelling(null);
      setConfirmId(null);
    }
  }

  return (
    <IonPage>
      <RapaGoLanguageRuntime />
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Mis Arriendos</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonRefresher slot="fixed" onIonRefresh={(e) => { void load().then(() => e.detail.complete()); }}>
          <IonRefresherContent />
        </IonRefresher>

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }}>
            <IonSpinner name="crescent" />
          </div>
        )}

        {loadError && <IonText color="danger"><p>{loadError}</p></IonText>}

        {!loading && bookings.length === 0 && (
          <IonText color="medium"><p>No tienes reservas de arriendo.</p></IonText>
        )}

        {!loading && bookings.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {bookings.map((b) => {
              const days = Math.max(1, Math.round((new Date(b.endDate).getTime() - new Date(b.startDate).getTime()) / (1000 * 60 * 60 * 24)));
              return (
                <IonCard key={b.id} style={{ margin: 0 }}>
                  <IonCardContent style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                          {b.vehicleBrand ?? ""} {b.vehicleModel ?? ""} {b.vehiclePlate ? `(${b.vehiclePlate})` : ""}
                        </div>
                        <div style={{ fontSize: "0.78rem", color: "var(--ion-color-medium)", marginTop: "2px" }}>
                          {b.startDate} → {b.endDate} · {days} día{days !== 1 ? "s" : ""}
                        </div>
                        {b.totalPrice !== null && (
                          <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--ion-color-success)", marginTop: "2px" }}>
                            ${(b.totalPrice / 100).toLocaleString("es-CL")} total
                          </div>
                        )}
                        <div style={{ marginTop: "6px" }}>
                          <IonBadge color={RENTAL_STATUS_COLOR[b.status] ?? "medium"} style={{ fontSize: "0.7rem" }}>
                            {RENTAL_STATUS_LABEL[b.status] ?? b.status}
                          </IonBadge>
                        </div>
                        {b.cancellationReason && (
                          <div style={{ fontSize: "0.72rem", color: "var(--ion-color-danger)", marginTop: "4px" }}>
                            Motivo: {b.cancellationReason}
                          </div>
                        )}
                      </div>
                      {b.status === "pending" && (
                        <IonButton
                          size="small"
                          fill="outline"
                          color="danger"
                          disabled={cancelling === b.id}
                          onClick={() => setConfirmId(b.id)}
                        >
                          {cancelling === b.id ? <IonSpinner name="dots" /> : "Cancelar"}
                        </IonButton>
                      )}
                    </div>
                  </IonCardContent>
                </IonCard>
              );
            })}
          </div>
        )}

        <IonAlert
          isOpen={confirmId !== null}
          header="¿Cancelar reserva?"
          message="Esta acción no se puede deshacer."
          buttons={[
            { text: "No", role: "cancel", handler: () => setConfirmId(null) },
            { text: "Sí, cancelar", role: "confirm", handler: () => { if (confirmId) void handleCancel(confirmId); } },
          ]}
          onDidDismiss={() => setConfirmId(null)}
        />
      </IonContent>
    </IonPage>
  );
}

export function PassengerWalletPage(): JSX.Element {
  return <WalletPage />;
}

function WalletPage(): JSX.Element {
  const { session } = useAuth();
  const [wallet,       setWallet]       = useState<import("../../features/wallet/wallet.service").WalletData | null>(null);
  const [transactions, setTransactions] = useState<import("../../features/wallet/wallet.service").TransactionData[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [loadError,    setLoadError]    = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setLoadError(null);
    try {
      const { walletService } = await import("../../features/wallet/wallet.service.js");
      const [w, tx] = await Promise.all([
        walletService.getMyWallet(session.accessToken),
        walletService.getMyTransactions(session.accessToken, 1, 20),
      ]);
      setWallet(w);
      setTransactions(tx.items);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Error al cargar la billetera.");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => { void load(); }, [load]);

  const TX_TYPE_LABEL: Record<string, string> = {
    payment:  "Débito",
    credit:   "Crédito",
    refund:   "Reembolso",
    topup:    "Crédito",
  };
  const TX_TYPE_COLOR: Record<string, string> = {
    payment:  "danger",
    credit:   "success",
    refund:   "tertiary",
    topup:    "success",
  };
  const TX_STATUS_COLOR: Record<string, string> = {
    completed: "success",
    pending:   "warning",
    failed:    "danger",
    cancelled: "medium",
  };

  return (
    <IonPage>
      <RapaGoLanguageRuntime />
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Mi Billetera</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonRefresher slot="fixed" onIonRefresh={(e) => { void load().then(() => e.detail.complete()); }}>
          <IonRefresherContent />
        </IonRefresher>

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }}>
            <IonSpinner name="crescent" />
          </div>
        )}

        {loadError && <IonText color="danger"><p>{loadError}</p></IonText>}

        {!loading && wallet && (
          <div style={{ paddingBottom: "80px" }}>
            {/* Balance hero */}
            <div style={{
              background: "linear-gradient(145deg, var(--ion-color-primary) 0%, var(--ion-color-primary-shade) 100%)",
              padding: "32px 24px 28px",
              textAlign: "center",
            }}>
              <div style={{ color: "rgba(255,255,255,0.8)", fontSize: "0.82rem", marginBottom: "6px" }}>Saldo disponible</div>
              <div style={{ color: "#fff", fontSize: "2.4rem", fontWeight: 800, letterSpacing: "-1px" }}>
                ${(wallet.balance / 100).toLocaleString("es-CL")}
                <span style={{ fontSize: "1rem", fontWeight: 400, marginLeft: "6px", opacity: 0.8 }}>{wallet.currency}</span>
              </div>
              <div style={{ marginTop: "10px" }}>
                <IonBadge
                  color={wallet.status === "active" ? "success" : "medium"}
                  style={{ fontSize: "0.72rem" }}
                >
                  {wallet.status === "active" ? "✓ Billetera activa" : wallet.status}
                </IonBadge>
              </div>
            </div>

            {/* Quick actions */}
            <div style={{ padding: "16px 16px 0" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "6px" }}>
                <IonButton expand="block" fill="outline" disabled style={{ "--border-radius": "12px" }}>
                  ↑ Recargar
                </IonButton>
                <IonButton expand="block" fill="outline" disabled style={{ "--border-radius": "12px" }}>
                  ↓ Retirar
                </IonButton>
              </div>
              <IonNote style={{ fontSize: "0.72rem", color: "var(--ion-color-medium)", display: "block", marginBottom: "14px", textAlign: "center" }}>
                Recarga y retiro disponibles próximamente
              </IonNote>

              <IonCard
                style={{
                  margin: "0 0 18px",
                  borderRadius: "18px",
                  background: "linear-gradient(135deg,#fff7dd,#F6F2EC)",
                  color: "#111827",
                  border: "1px solid rgba(210,164,58,.38)",
                  boxShadow: "0 10px 24px rgba(0,0,0,.12)",
                }}
              >
                <IonCardContent style={{ padding: "14px" }}>
                  <div style={{ fontWeight: 950, fontSize: ".95rem" }}>
                    Saldo para próximos viajes
                  </div>
                  <div style={{ marginTop: 6, color: "rgba(17,24,39,.72)", fontSize: ".80rem", fontWeight: 800, lineHeight: 1.35 }}>
                    Si un pasajero paga de más o existe una diferencia, el administrador podrá revisar el caso y confirmar si ese monto queda como saldo para usar en viajes futuros.
                  </div>
                </IonCardContent>
              </IonCard>

              <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "12px" }}>Movimientos</div>

              {transactions.length === 0 && (
                <EmptyState icon={walletOutline} title="Sin movimientos" subtitle="Tus transacciones aparecerán aquí" />
              )}

              {transactions.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "1px", background: "var(--ion-color-light-shade)", borderRadius: "14px", overflow: "hidden" }}>
                  {transactions.map((tx, idx) => {
                    const isDebit = tx.type === "payment";
                    const txIcon = tx.type === "payment" ? "🚗" : tx.type === "refund" ? "↩️" : "💰";
                    return (
                      <div
                        key={tx.id}
                        style={{
                          background: "var(--ion-card-background, #fff)",
                          padding: "12px 16px",
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          borderBottom: idx < transactions.length - 1 ? "1px solid var(--ion-color-light-shade)" : "none",
                        }}
                      >
                        <div style={{
                          width: "40px", height: "40px", borderRadius: "50%", flexShrink: 0,
                          background: isDebit ? "var(--ion-color-danger-tint)" : "var(--ion-color-success-tint)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "1.1rem",
                        }}>
                          {txIcon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--ion-text-color)" }}>
                            {TX_TYPE_LABEL[tx.type] ?? tx.type}
                          </div>
                          {tx.description && (
                            <div style={{ fontSize: "0.72rem", color: "var(--ion-color-medium)", marginTop: "1px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {tx.description}
                            </div>
                          )}
                          <div style={{ fontSize: "0.68rem", color: "var(--ion-color-medium)", marginTop: "2px", display: "flex", alignItems: "center", gap: "4px" }}>
                            {new Date(tx.createdAt).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}
                            <IonBadge color={TX_STATUS_COLOR[tx.status] ?? "medium"} style={{ fontSize: "0.6rem" }}>
                              {tx.status}
                            </IonBadge>
                          </div>
                        </div>
                        <div style={{
                          fontWeight: 800, fontSize: "0.95rem",
                          color: isDebit ? "var(--ion-color-danger)" : "var(--ion-color-success)",
                          flexShrink: 0,
                        }}>
                          {isDebit ? "−" : "+"}${(tx.amount / 100).toLocaleString("es-CL")}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </IonContent>
    </IonPage>
  );
}

export function PassengerProfilePage(): JSX.Element {
  const { session } = useAuth();
  const history = useHistory();

  const [profile,   setProfile]   = useState<PassengerProfileData | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk,    setSaveOk]    = useState(false);

  // editable fields
  const [phone,                 setPhone]                 = useState("");
  const [preferredLanguage,     setPreferredLanguage]     = useState("es");
  const [notificationEnabled,   setNotificationEnabled]   = useState(true);
  const [emailNotifications,    setEmailNotifications]    = useState(true);
  const [smsNotifications,      setSmsNotifications]      = useState(false);
  const [emergencyContactName,  setEmergencyContactName]  = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [canSwitchToDriver, setCanSwitchToDriver] = useState(false);
  const [checkingDriverAccess, setCheckingDriverAccess] = useState(false);

  function switchToDriverMode(): void {
    localStorage.setItem("rapago_active_role", "driver");
    localStorage.setItem("rapago_role_mode", "driver");
    window.dispatchEvent(new CustomEvent("rapago:role-mode-changed", { detail: { role: "driver" } }));
    history.replace("/driver");
  }

  const loadProfile = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await passengerProfileService.getMyProfile(session.accessToken);
      setProfile(data);
      setPhone(getAutoPhone(getSessionPhone(session?.user), data.phone));
      setPreferredLanguage(data.preferredLanguage);
      setNotificationEnabled(data.notificationEnabled);
      setEmailNotifications(data.emailNotifications);
      setSmsNotifications(data.smsNotifications);
      setEmergencyContactName(data.emergencyContactName ?? "");
      setEmergencyContactPhone(data.emergencyContactPhone ?? "");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al cargar el perfil.";

      if (isUnauthorizedMessage(message)) {
        const stored = readStoredRegistrationProfile();
        setProfile({
          phone: getAutoPhone(getSessionPhone(session?.user), stored.phone),
          preferredLanguage: "es",
          notificationEnabled: true,
          emailNotifications: true,
          smsNotifications: false,
          emergencyContactName: "",
          emergencyContactPhone: "",
        } as PassengerProfileData);
        setPhone(getAutoPhone(getSessionPhone(session?.user), stored.phone));
        setLoadError(null);
      } else {
        setLoadError(safePassengerErrorMessage(message));
      }
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, session?.user]);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  useEffect(() => {
    if (!session?.accessToken) {
      setCanSwitchToDriver(false);
      return;
    }

    if (session.user?.role === "driver" || session.user?.role === "admin") {
      setCanSwitchToDriver(true);
      return;
    }

    setCheckingDriverAccess(true);
    void driverProfileService.getMyProfile(session.accessToken)
      .then(() => setCanSwitchToDriver(true))
      .catch(() => setCanSwitchToDriver(false))
      .finally(() => setCheckingDriverAccess(false));
  }, [session?.accessToken, session?.user?.role]);

  async function handleSave() {
    if (!session?.accessToken) return;
    setSaving(true);
    setSaveError(null);
    setSaveOk(false);
    try {
      const payload: import("../../features/passengers/passengerProfile.service.js").UpsertPassengerProfilePayload = {
        preferredLanguage,
        notificationEnabled,
        emailNotifications,
        smsNotifications,
      };
      const trimPhone = phone.trim();
      if (trimPhone) payload.phone = trimPhone;
      const trimEmName = emergencyContactName.trim();
      if (trimEmName) payload.emergencyContactName = trimEmName;
      const trimEmPhone = emergencyContactPhone.trim();
      if (trimEmPhone) payload.emergencyContactPhone = trimEmPhone;

      const updated = await passengerProfileService.upsertMyProfile(session.accessToken, payload);
      if (payload.phone) persistPassengerAutofill({ phone: payload.phone });
      setProfile(updated);
      setSaveOk(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Error al guardar el perfil.");
    } finally {
      setSaving(false);
    }
  }

  const userName = session?.user?.name ?? "";
  const initials = userName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();

  return (
    <IonPage>
      <RapaGoLanguageRuntime />
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Mi Perfil</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonRefresher slot="fixed" onIonRefresh={(e) => { void loadProfile().then(() => e.detail.complete()); }}>
          <IonRefresherContent />
        </IonRefresher>

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }}>
            <IonSpinner name="crescent" />
          </div>
        )}

        {loadError && (
          <IonText color="danger"><p>{loadError}</p></IonText>
        )}

        {!loading && profile && (
          <>
            {!profile.phone && (
              <IonCard style={{ margin: "0 0 12px", background: "#fff3cd", border: "1px solid #ffc107" }}>
                <IonCardContent style={{ padding: "8px 14px" }}>
                  <IonText>
                    <p style={{ margin: 0, fontSize: "0.82rem", color: "#6b4700" }}>
                      Complete su teléfono para solicitar viajes
                    </p>
                  </IonText>
                </IonCardContent>
              </IonCard>
            )}

            {/* Avatar */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
              <div style={{
                width: "72px", height: "72px", borderRadius: "50%",
                background: "var(--ion-color-primary)", display: "flex",
                alignItems: "center", justifyContent: "center",
                fontSize: "1.6rem", fontWeight: 700, color: "#fff",
              }}>
                {initials || "?"}
              </div>
            </div>

            {/* Personal data */}
            <IonList>
              <IonListHeader>
                <IonLabel><strong>Datos personales</strong></IonLabel>
              </IonListHeader>
              <IonItem lines="full">
                <IonLabel position="stacked">Nombre</IonLabel>
                <IonInput value={userName} readonly />
              </IonItem>
              <IonItem lines="full">
                <IonLabel position="stacked">Email</IonLabel>
                <IonInput value={session?.user?.email ?? ""} readonly />
              </IonItem>
              <IonItem lines="full">
                <IonLabel position="stacked">Teléfono</IonLabel>
                <IonInput
                  value={phone}
                  onIonInput={(e) => setPhone(String(e.detail.value ?? ""))}
                  placeholder="+56 9 1234 5678"
                  type="tel"
                  maxlength={20}
                  clearInput
                />
              </IonItem>
            </IonList>

            {/* Preferred language */}
            <IonList style={{ marginTop: "16px" }}>
              <IonListHeader>
                <IonLabel><strong>Idioma preferido</strong></IonLabel>
              </IonListHeader>
              <IonItem lines="none">
                <IonLabel>Idioma</IonLabel>
                <IonSelect
                  interface="action-sheet"
                  value={preferredLanguage}
                  onIonChange={(e) => setPreferredLanguage(e.detail.value as string)}
                >
                  <IonSelectOption value="es">Español</IonSelectOption>
                  <IonSelectOption value="en">English</IonSelectOption>
                  <IonSelectOption value="rapa_nui">Rapa Nui</IonSelectOption>
                </IonSelect>
              </IonItem>
            </IonList>

            {/* Notifications */}
            <IonList style={{ marginTop: "16px" }}>
              <IonListHeader>
                <IonLabel><strong>Notificaciones</strong></IonLabel>
              </IonListHeader>
              <IonItem lines="full">
                <IonLabel>Notificaciones activas</IonLabel>
                <IonToggle
                  slot="end"
                  checked={notificationEnabled}
                  onIonChange={(e) => setNotificationEnabled(e.detail.checked)}
                />
              </IonItem>
              <IonItem lines="full">
                <IonLabel>Notificaciones por email</IonLabel>
                <IonToggle
                  slot="end"
                  checked={emailNotifications}
                  onIonChange={(e) => setEmailNotifications(e.detail.checked)}
                />
              </IonItem>
              <IonItem lines="none">
                <IonLabel>Notificaciones por SMS</IonLabel>
                <IonToggle
                  slot="end"
                  checked={smsNotifications}
                  onIonChange={(e) => setSmsNotifications(e.detail.checked)}
                />
              </IonItem>
            </IonList>

            {/* Emergency contact */}
            <IonList style={{ marginTop: "16px" }}>
              <IonListHeader>
                <IonLabel><strong>Contacto de emergencia</strong></IonLabel>
              </IonListHeader>
              <IonItem lines="full">
                <IonLabel position="stacked">Nombre</IonLabel>
                <IonInput
                  value={emergencyContactName}
                  onIonInput={(e) => setEmergencyContactName(String(e.detail.value ?? ""))}
                  placeholder="Nombre del contacto"
                  maxlength={100}
                  clearInput
                />
              </IonItem>
              <IonItem lines="none">
                <IonLabel position="stacked">Teléfono</IonLabel>
                <IonInput
                  value={emergencyContactPhone}
                  onIonInput={(e) => setEmergencyContactPhone(String(e.detail.value ?? ""))}
                  placeholder="+56 9 1234 5678"
                  type="tel"
                  maxlength={20}
                  clearInput
                />
              </IonItem>
            </IonList>

            {saveOk && (
              <IonText color="success">
                <p style={{ margin: "12px 0 0", fontSize: "0.85rem" }}>Perfil guardado correctamente.</p>
              </IonText>
            )}
            {saveError && (
              <IonText color="danger">
                <p style={{ margin: "12px 0 0", fontSize: "0.85rem" }}>{saveError}</p>
              </IonText>
            )}

            {canSwitchToDriver && (
              <IonCard
                style={{
                  margin: "16px 0 0",
                  borderRadius: "18px",
                  background: "linear-gradient(135deg,#111 0%,#263238 52%,#2dd36f 100%)",
                  color: "#fff",
                  border: "1px solid rgba(45,211,111,.38)",
                  boxShadow: "0 14px 30px rgba(0,0,0,.18)",
                }}
              >
                <IonCardContent style={{ padding: "14px 16px" }}>
                  <div style={{ fontWeight: 950, fontSize: "1rem" }}>Modo conductor disponible</div>
                  <div style={{ marginTop: 4, fontSize: ".78rem", opacity: .88, lineHeight: 1.35 }}>
                    Tu cuenta fue aprobada como conductor. Puedes cambiar entre pasajero y conductor sin cerrar sesión.
                  </div>
                  <IonButton
                    expand="block"
                    color="success"
                    onClick={switchToDriverMode}
                    style={{ marginTop: 12, "--border-radius": "14px", fontWeight: 950 } as React.CSSProperties}
                  >
                    Cambiar a conductor
                  </IonButton>
                </IonCardContent>
              </IonCard>
            )}

            {!canSwitchToDriver && checkingDriverAccess && (
              <IonNote style={{ display: "block", marginTop: "12px", textAlign: "center" }}>
                Revisando acceso de conductor...
              </IonNote>
            )}

            <IonButton
              expand="block"
              style={{ marginTop: "20px" }}
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? <IonSpinner name="dots" /> : "Guardar cambios"}
            </IonButton>

            {session?.accessToken && <LegalStatusSection token={session.accessToken} />}
          </>
        )}
      </IonContent>
    </IonPage>
  );
}
