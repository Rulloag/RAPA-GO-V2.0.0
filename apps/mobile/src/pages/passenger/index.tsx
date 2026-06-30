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
import { useEffect, useState, useCallback, useRef } from "react";
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
import { ServiceCard } from "../../components/ServiceCard.js";
import { EmptyState } from "../../components/EmptyState.js";
import { TripTimeline } from "../../components/TripTimeline.js";
import { DriverInfoCard } from "../../components/DriverInfoCard.js";
import { ModulePlaceholderPage } from "../../components/ModulePlaceholderPage";
import { passengerProfileService, type PassengerProfileData } from "../../features/passengers/passengerProfile.service.js";
import { driverProfileService } from "../../features/drivers/driverProfile.service";
import { useConnectivity } from "../../hooks/useConnectivity";
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
  requested:       "Solicitado",
  accepted:        "Conductor asignado",
  driver_en_route: "Conductor en camino",
  driver_arrived:  "Conductor llegó",
  in_progress:     "En curso",
  completed:       "Completado",
  cancelled:       "Cancelado",
};

const RIDE_STATUS_COLOR: Record<string, string> = {
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
  directPassengerFareType?: string | null;
  directNationality?: string | null;
};

function readStoredRegistrationProfile(): StoredRegistrationProfile {
  try {
    const raw = localStorage.getItem("rapago_registration_profile");
    const parsed = raw ? (JSON.parse(raw) as StoredRegistrationProfile) : {};

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

    return {
      ...parsed,
      rut: parsed.rut ?? localStorage.getItem("rapago_profile_rut"),
      phone: parsed.phone ?? localStorage.getItem("rapago_profile_phone"),
      passengerFareType:
        parsed.passengerFareType ??
        parsed.farePassengerType ??
        parsed.passengerType ??
        null,
      farePassengerType:
        parsed.farePassengerType ??
        parsed.passengerFareType ??
        parsed.passengerType ??
        null,
      passengerType:
        parsed.passengerType ??
        parsed.farePassengerType ??
        parsed.passengerFareType ??
        null,
      nationality:
        parsed.nationality ??
        parsed.passengerFareLabel ??
        null,
      passengerFareLabel:
        parsed.passengerFareLabel ??
        parsed.nationality ??
        null,
      directPassengerFareType: directFareType,
      directNationality,
    };
  } catch {
    return {};
  }
}

function getAutoPhone(sessionPhone?: string | null, profilePhone?: string | null): string {
  const stored = readStoredRegistrationProfile();
  return (profilePhone ?? sessionPhone ?? stored.phone ?? "").trim();
}

function persistPassengerAutofill(data: Partial<StoredRegistrationProfile>): void {
  try {
    const current = readStoredRegistrationProfile();
    const next = { ...current, ...data };

    localStorage.setItem("rapago_registration_profile", JSON.stringify(next));

    if (next.phone) localStorage.setItem("rapago_profile_phone", next.phone);
    if (next.rut) localStorage.setItem("rapago_profile_rut", next.rut);
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

type ProntoPagaPaymentData = {
  urlPay: string;
  uid: string;
  reference: string;
  order: string;
  amountClp: number;
  currency: string;
  country: string;
};

type CreateProntoPagaPaymentPayload = {
  rideId: string;
  amountClp: number;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientDocument: string;
};

function getProntoPagaApiBaseUrl(): string {
  const env = import.meta.env as Record<string, string | undefined>;

  return (
    env["VITE_API_BASE_URL"] ||
    env["VITE_API_URL"] ||
    "http://localhost:3000/api"
  ).replace(/\/$/, "");
}

async function parsePassengerApiResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let json: unknown = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { message: text };
  }

  const data = json as { ok?: boolean; data?: unknown; message?: string; error?: string };

  if (!response.ok || data?.ok === false) {
    throw new Error(
      data?.message ||
        data?.error ||
        `Error HTTP ${response.status}`,
    );
  }

  return (data?.data ?? data) as T;
}

async function createProntoPagaPayment(
  token: string,
  payload: CreateProntoPagaPaymentPayload,
): Promise<ProntoPagaPaymentData> {
  const response = await fetch(`${getProntoPagaApiBaseUrl()}/payments/prontopaga/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  return parsePassengerApiResponse<ProntoPagaPaymentData>(response);
}

function readRideIdFromResponse(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;

  const direct = (value as { id?: unknown }).id;
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  const data = (value as { data?: unknown }).data;
  if (data && typeof data === "object") {
    const dataId = (data as { id?: unknown }).id;
    if (typeof dataId === "string" && dataId.trim()) return dataId.trim();

    const ride = (data as { ride?: unknown }).ride;
    if (ride && typeof ride === "object") {
      const rideId = (ride as { id?: unknown }).id;
      if (typeof rideId === "string" && rideId.trim()) return rideId.trim();
    }
  }

  const ride = (value as { ride?: unknown }).ride;
  if (ride && typeof ride === "object") {
    const rideId = (ride as { id?: unknown }).id;
    if (typeof rideId === "string" && rideId.trim()) return rideId.trim();
  }

  return null;
}

function buildProntoPagaClientData(user: unknown): {
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientDocument: string;
} {
  const stored = readStoredRegistrationProfile();

  const userName = getUserStringField(user, "name");
  const firstName = getUserStringField(user, "firstName") ?? stored.firstName ?? "";
  const lastName = getUserStringField(user, "lastName") ?? stored.lastName ?? "";
  const composedName = `${firstName} ${lastName}`.trim();

  const clientName =
    userName ??
    (composedName || stored.name || "Cliente Rapa Go");

  const clientEmail =
    getUserStringField(user, "email") ??
    stored.email ??
    "cliente@rapago.cl";

  const clientPhone =
    getUserStringField(user, "phone") ??
    stored.phone ??
    localStorage.getItem("rapago_profile_phone") ??
    "56900000000";

  const clientDocument =
    getUserStringField(user, "rut") ??
    stored.rut ??
    localStorage.getItem("rapago_profile_rut") ??
    "11111111-1";

  return {
    clientName,
    clientEmail,
    clientPhone,
    clientDocument,
  };
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
    .trim();

  if (!raw) return null;

  // IMPORTANTE:
  // "Chileno no residente" contiene la palabra "residente".
  // Por eso primero detectamos "no residente" y recién después "residente".
  if (
    raw.includes("foreigner") ||
    raw.includes("extranj") ||
    raw.includes("turista") ||
    raw.includes("ingles") ||
    raw.includes("english")
  ) {
    return "foreigner";
  }

  if (
    raw.includes("no residente") ||
    raw.includes("no resident") ||
    raw.includes("chilean") ||
    raw.includes("chileno") ||
    raw === "cl" ||
    raw === "chile"
  ) {
    return "chilean";
  }

  if (
    raw.includes("resident") ||
    raw.includes("residente") ||
    raw.includes("rapa nui")
  ) {
    return "resident";
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
    // Si no existe dato guardado, usa residente como valor seguro por defecto.
  }

  return "resident";
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
  passengerType: PassengerFareType = "resident",
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


export function PassengerHomePage(): JSX.Element {
  const history = useHistory();
  const isOnline  = useConnectivity();
  const { session } = useAuth();
  const [profile, setProfile] = useState<PassengerProfileData | null>(null);

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

  const name     = session?.user?.name ?? "";
  const firstName = name.split(" ")[0] || "pasajero";
  const initials  = name.trim().split(/\s+/).map((p: string) => p[0] ?? "").slice(0, 2).join("").toUpperCase() || "P";
  const phoneFromRegister = getAutoPhone(getSessionPhone(session?.user), profile?.phone);
  const hasPhone  = phoneFromRegister.length > 0;

  return (
    <IonPage>
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

          {/* Offline / phone warnings */}
          {profile !== null && !hasPhone && (
            <div style={{ margin: "12px 0 0", background: "#fff3cd", border: "1px solid #ffc107", borderRadius: "12px", padding: "10px 14px" }}>
              <IonText>
                <p style={{ margin: 0, fontSize: "0.82rem", color: "#6b4700" }}>
               
                </p>
              </IonText>
            </div>
          )}
          {!isOnline && (
            <div style={{ margin: "12px 0 0", background: "#fff3cd", border: "1px solid #ffc107", borderRadius: "12px", padding: "10px 14px" }}>
              <IonText>
                <p style={{ margin: 0, fontSize: "0.82rem", color: "#6b4700" }}>
                  Modo offline — tus viajes se sincronizarán cuando recuperes conexión.
                </p>
              </IonText>
              <WhatsAppButton
                phone={RAPAGO_CONTACT.adminPhone}
                message={WA_MESSAGES.passengerToAdmin({ origin: "mi ubicación", destination: "mi destino", name: "pasajero" })}
                label="Contactar operador"
                size="small"
                fill="solid"
                style={{ marginTop: "8px" }}
              />
            </div>
          )}

          {/* ── Servicios Rapa Go rápidos ── */}
          <div style={{ marginTop: "20px" }}>
            <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "12px", color: "var(--ion-text-color)" }}>
              Servicios
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "10px",
            }}>
              <ServiceCard
                icon={carOutline}
                title="Viaje"
                subtitle="Solicitar ahora"
                color="primary"
                onClick={() => history.push(ROUTES.PASSENGER.REQUEST_RIDE)}
              />
              <ServiceCard
                icon={mapOutline}
                title="Tours"
                subtitle="Con guías locales"
                color="secondary"
                onClick={() => history.push(ROUTES.PASSENGER.GUIDES)}
              />
              <ServiceCard
                icon={carSportOutline}
                title="Arriendo"
                subtitle="Vehículos"
                color="tertiary"
                onClick={() => history.push(ROUTES.PASSENGER.RENTALS)}
              />
              <ServiceCard
                icon={ticketOutline}
                title="Eventos"
                subtitle="Cultura"
                color="warning"
                onClick={() => history.push(ROUTES.PASSENGER.EVENTS)}
              />
            </div>
          </div>

          {/* ── Noticias y recomendaciones ── */}
          <div style={{ marginTop: "24px" }}>
            <div style={{ fontWeight: 800, fontSize: "1rem", marginBottom: "10px", color: "var(--ion-text-color)" }}>
              Noticias Rapa Go
            </div>

            <div style={{ display: "flex", gap: "10px", overflowX: "auto", paddingBottom: "4px" }}>
              <IonCard
                button
                style={{
                  minWidth: "260px",
                  margin: 0,
                  borderRadius: "18px",
                  background: "linear-gradient(135deg,#F6F2EC,#ECD49A)",
                  color: "#111",
                  boxShadow: "0 12px 28px rgba(0,0,0,.18)",
                }}
                onClick={() => history.push(ROUTES.PASSENGER.GUIDES)}
              >
                <IonCardContent style={{ padding: "14px" }}>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <IonIcon icon={compassOutline} style={{ fontSize: "1.7rem", color: "#C5532F", flexShrink: 0 }} />
                    <div>
                      <div style={{ fontWeight: 950, fontSize: ".92rem" }}>Recomendados para turismo</div>
                      <div style={{ marginTop: 4, color: "rgba(17,17,17,.66)", fontSize: ".76rem", lineHeight: 1.35 }}>
                        Anakena, Tongariki, Orongo y Rano Raraku ahora van en Tours, no en solicitud de viaje.
                      </div>
                    </div>
                  </div>
                </IonCardContent>
              </IonCard>

              <IonCard
                button
                style={{
                  minWidth: "240px",
                  margin: 0,
                  borderRadius: "18px",
                  background: "linear-gradient(135deg,#111111,#8F3F25)",
                  color: "#F6F2EC",
                  boxShadow: "0 12px 28px rgba(0,0,0,.20)",
                }}
                onClick={() => history.push(ROUTES.PASSENGER.EVENTS)}
              >
                <IonCardContent style={{ padding: "14px" }}>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <IonIcon icon={ticketOutline} style={{ fontSize: "1.7rem", color: "#F8D879", flexShrink: 0 }} />
                    <div>
                      <div style={{ fontWeight: 950, fontSize: ".92rem" }}>Eventos y experiencias</div>
                      <div style={{ marginTop: 4, color: "rgba(246,242,236,.76)", fontSize: ".76rem", lineHeight: 1.35 }}>
                        Revisa actividades culturales dentro de la app.
                      </div>
                    </div>
                  </div>
                </IonCardContent>
              </IonCard>
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

export function PassengerRequestRidePage(): JSX.Element {
  return <RequestRidePage />;
}

function RequestRidePage(): JSX.Element {
  const { session } = useAuth();
  const history = useHistory();

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

  const [currentLat,        setCurrentLat]        = useState<number | null>(null);
  const [currentLng,        setCurrentLng]        = useState<number | null>(null);
  const [locating,          setLocating]          = useState(false);
  const [locationError,     setLocationError]     = useState<string | null>(null);
  const [pickupConfirmed,   setPickupConfirmed]   = useState(false);

  const passengerFareType = readPassengerFareType(session?.user);

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

  async function handleRequest(forcedPaymentMethod?: "cash" | "card") {
    const origin = originInput.trim();
    const dest = destInput.trim();

    if (!origin || !dest) {
      setSubmitError("Origen y destino son requeridos.");
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

    const selectedPaymentMethod = forcedPaymentMethod ?? paymentMethod;

    if (selectedPaymentMethod === null) {
      setSubmitError("Selecciona una forma de pago.");
      return;
    }

    setPaymentMethod(selectedPaymentMethod);
    setSubmitting(true);
    setSubmitError(null);

    const input: import("../../features/rides/rides.service").CreateRideInput = {
      originText: origin,
      destinationText: dest,
    };

    const isCardPayment = selectedPaymentMethod === "card";
    const normalizedPaymentMethod = isCardPayment ? "prontopaga_card" : "cash";

    (input as unknown as { estimatedFareClp?: number; paymentMethod?: string }).estimatedFareClp = farePreview.fare;
    (input as unknown as { estimatedFareClp?: number; paymentMethod?: string }).paymentMethod = normalizedPaymentMethod;
    (input as unknown as { passengerFareType?: PassengerFareType; farePassengerType?: PassengerFareType }).passengerFareType = passengerFareType;
    (input as unknown as { passengerFareType?: PassengerFareType; farePassengerType?: PassengerFareType }).farePassengerType = passengerFareType;
    (input as unknown as { fareVehicleCategory?: VehicleFareCategory; vehicleCategory?: VehicleFareCategory }).fareVehicleCategory = vehicleCategory;
    (input as unknown as { fareVehicleCategory?: VehicleFareCategory; vehicleCategory?: VehicleFareCategory }).vehicleCategory = vehicleCategory;

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
    notes.push(`Tarifa RAPA GO calculada: ${farePreview.fare} CLP.`);
    notes.push(`Kilómetros calculados: ${farePreview.km.toFixed(1)} km.`);
    notes.push(`Categoría de vehículo: ${vehicleFareLabel(vehicleCategory)}.`);
    notes.push(`Ganancia aprox. conductor: ${farePreview.driverEarnings} CLP.`);
    notes.push(`Forma de pago: ${isCardPayment ? "Tarjeta / ProntoPaga" : "efectivo"}.`);

    if (isCardPayment) {
      notes.push("Pago pendiente de confirmación ProntoPaga.");
    }

    const trimNotes = notesInput.trim();
    if (trimNotes) notes.push(trimNotes);

    input.notes = notes.join(" ");

    const localRidePayload = {
      originText: input.originText,
      destinationText: input.destinationText,
      notes: input.notes,
      estimatedFareClp: farePreview.fare,
    };

    /*
     * IMPORTANTE:
     * Para ProntoPaga NO llamamos primero a /api/rides/request.
     * Tu backend está devolviendo 500 en esa ruta, por eso se cortaba antes de abrir tarjeta.
     * Guardamos el viaje local y abrimos ProntoPaga directo.
     */
    if (isCardPayment) {
      try {
        const localRide = createLocalPassengerRide(localRidePayload);
        saveLocalPassengerRides([localRide, ...readLocalPassengerRides()]);

        const localRideId =
          typeof localRide.id === "string" && localRide.id.trim()
            ? localRide.id.trim()
            : `local-${Date.now()}`;

        const client = buildProntoPagaClientData(session?.user);
        const payment = await createProntoPagaPayment(session?.accessToken ?? "local-demo", {
          rideId: localRideId,
          amountClp: farePreview.fare,
          ...client,
        });

        if (!payment.urlPay) {
          throw new Error("ProntoPaga no entregó el enlace de pago.");
        }

        window.location.href = payment.urlPay;
        return;
      } catch (paymentErr) {
        const paymentMessage =
          paymentErr instanceof Error
            ? paymentErr.message
            : "No se pudo abrir ProntoPaga.";

        setSubmitError(
          `No se pudo abrir ProntoPaga: ${paymentMessage}. Revisa que las rutas del backend estén en apps/api/src/modules/payments y no dentro de mobile/src/app.`,
        );
        setSubmitting(false);
        return;
      }
    }

    try {
      if (!session?.accessToken) {
        throw new Error("No se pudo conectar con el servidor.");
      }

      await ridesService.createRideRequest(session.accessToken, input);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al solicitar el viaje.";

      const localRide = createLocalPassengerRide(localRidePayload);
      saveLocalPassengerRides([localRide, ...readLocalPassengerRides()]);

      console.warn("RAPA GO: backend rechazó crear viaje. Se guardó localmente.", message);
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

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Solicitar Viaje</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <div style={{ display: "flex", flexDirection: "column", gap: "14px", paddingBottom: "90px" }}>
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
                        {formatClp(farePreview.fare)}
                      </div>
                      <div style={{ fontSize: "0.82rem", color: "#7A5417", marginTop: "3px", fontWeight: 950 }}>
                        {formatUsdFromClp(farePreview.fare)}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "rgba(17,17,17,.66)", marginTop: "5px" }}>
                        {farePreview.km.toFixed(1)} km · {farePreview.minutes} min · {farePreview.isZoneFare ? "tarifa fija" : "precio calculado"}
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

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "14px" }}>
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
                      <div style={{ fontSize: ".8rem", marginTop: "3px" }}>{formatClp(farePreview.fare)}</div>
                      <div style={{ fontSize: ".72rem", marginTop: "2px", opacity: .82 }}>{formatUsdFromClp(farePreview.fare)}</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (submitting) return;
                        setPaymentMethod("card");
                        setSubmitError(null);
                        void handleRequest("card");
                      }}
                      style={{
                        border: paymentMethod === "card" ? "3px solid #ffffff" : "2px solid rgba(36,105,201,.45)",
                        borderRadius: "18px",
                        padding: "13px 10px",
                        background: "linear-gradient(180deg,#4A90E2,#2469C9)",
                        color: "#ffffff",
                        boxShadow: paymentMethod === "card" ? "0 0 22px rgba(36,105,201,.55)" : "0 8px 18px rgba(36,105,201,.22)",
                        transform: paymentMethod === "card" ? "scale(1.02)" : "scale(1)",
                        fontWeight: 950,
                        opacity: 1,
                      }}
                    >
                      <div style={{ fontSize: "1.2rem" }}>💳</div>
                      <div>Tarjeta</div>
                      <div style={{ fontSize: ".7rem", marginTop: "2px", opacity: .95 }}>Abrir banco ahora</div>
                      <div style={{ fontSize: ".8rem", marginTop: "3px" }}>{formatClp(farePreview.fare)}</div>
                      <div style={{ fontSize: ".72rem", marginTop: "2px", opacity: .9 }}>{formatUsdFromClp(farePreview.fare)}</div>
                      <div style={{ fontSize: ".68rem", marginTop: "2px", opacity: .92 }}>ProntoPaga</div>
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
                disabled={submitting || !farePreview || paymentMethod === null}
              >
                {submitting ? (
                  <IonSpinner name="dots" />
                ) : paymentMethod === "card" ? (
                  "Pagar con tarjeta"
                ) : paymentMethod === "cash" ? (
                  "Solicitar viaje"
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
  } catch {
    // No bloquea la app.
  }
}

function createLocalPassengerRide(input: {
  originText: string;
  destinationText: string;
  notes?: string;
  estimatedFareClp?: number | null;
}): RideRequestData {
  const now = new Date().toISOString();

  return {
    id: `local-${Date.now()}`,
    originText: input.originText,
    destinationText: input.destinationText,
    notes: input.notes ?? null,
    status: "requested",
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
    isOfflineBooking: false,
  } as RideRequestData;
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
    .replace(/Ubicación GPS pasajero:.*?(?=Punto de partida confirmado|$)/i, "")
    .replace(/Ubicación real del pasajero:.*?(?=Punto accesible|Coordenadas|$)/i, "")
    .replace(/Coordenadas recogida accesible:.*?(?=Coordenadas destino accesible|$)/i, "")
    .replace(/Coordenadas destino accesible:.*$/i, "")
    .trim() || null;
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

  const [allRides,    setAllRides]    = useState<RideRequestData[]>([]);
  const [page,        setPage]        = useState(1);
  const [loading,     setLoading]     = useState(true);
  const [loadError,   setLoadError]   = useState<string | null>(null);
  const [cancelling,  setCancelling]  = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [ratingRideId,  setRatingRideId]  = useState<string | null>(null);
  const [ratingStars,   setRatingStars]   = useState(5);
  const [ratingComment, setRatingComment] = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);
  const [ratingError,   setRatingError]   = useState<string | null>(null);
  const [ratedIds,      setRatedIds]      = useState<Set<string>>(new Set());
  const [statusFilter,  setStatusFilter]  = useState<"all" | "active" | "completed" | "cancelled">("all");

  const loadRides = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const localRides = readLocalPassengerRides();

      if (!session?.accessToken) {
        setAllRides(localRides);
        setPage(1);
        return;
      }

      const data = await ridesService.listMyRides(session.accessToken);
      setAllRides([...localRides, ...data]);
      setPage(1);
    } catch (err) {
      const localRides = readLocalPassengerRides();
      setAllRides(localRides);
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
  }, [session?.accessToken]);

  useEffect(() => { void loadRides(); }, [loadRides]);

  // Client-side pagination slice
  const rides = allRides.slice(0, page * PAGE_SIZE);

  async function handleCancel(rideId: string) {
    setCancelling(rideId);
    setCancelError(null);

    try {
      if (rideId.startsWith("local-") || !session?.accessToken) {
        const cancelledLocal = {
          status: "cancelled",
          cancelledAt: new Date().toISOString(),
          cancelledByRole: "passenger",
          cancellationReason: "Cancelado por pasajero.",
        } as Partial<RideRequestData>;

        const updatedLocal = readLocalPassengerRides().map((ride) =>
          ride.id === rideId ? ({ ...ride, ...cancelledLocal } as RideRequestData) : ride,
        );

        saveLocalPassengerRides(updatedLocal);
        setAllRides((prev) =>
          prev.map((ride) => (ride.id === rideId ? ({ ...ride, ...cancelledLocal } as RideRequestData) : ride)),
        );
        return;
      }

      const updated = await ridesService.cancelRideRequest(session.accessToken, rideId);
      setAllRides((prev) => prev.map((r) => (r.id === rideId ? updated : r)));
    } catch (err) {
      setCancelError(safePassengerErrorMessage(err instanceof Error ? err.message : "Error al cancelar el viaje."));
    } finally {
      setCancelling(null);
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
      setRatingError(safePassengerErrorMessage(err instanceof Error ? err.message : "Error al calificar el viaje."));
    } finally {
      setSubmittingRating(false);
    }
  }

  async function handleCancelAccepted(rideId: string) {
    if (!session?.accessToken) return;
    setCancelling(rideId);
    setCancelError(null);
    try {
      const updated = await ridesService.cancelAcceptedRide(session.accessToken, rideId);
      setAllRides((prev) => prev.map((r) => (r.id === rideId ? updated : r)));
    } catch (err) {
      setCancelError(safePassengerErrorMessage(err instanceof Error ? err.message : "Error al cancelar el viaje."));
    } finally {
      setCancelling(null);
    }
  }

  const ACTIVE_STATUSES   = ["requested", "accepted", "driver_en_route", "driver_arrived", "in_progress"];
  const filtered = rides.filter((r) => {
    if (statusFilter === "all")       return true;
    if (statusFilter === "active")    return ACTIVE_STATUSES.includes(r.status);
    if (statusFilter === "completed") return r.status === "completed";
    if (statusFilter === "cancelled") return r.status === "cancelled";
    return true;
  });

  // Counts use the full dataset so chips always show accurate numbers
  const counts = {
    all:       allRides.length,
    active:    allRides.filter((r) => ACTIVE_STATUSES.includes(r.status)).length,
    completed: allRides.filter((r) => r.status === "completed").length,
    cancelled: allRides.filter((r) => r.status === "cancelled").length,
  };

  const hasMore = page * PAGE_SIZE < allRides.length;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Mis Viajes</IonTitle>
        </IonToolbar>
        {/* Filter chips */}
        <IonToolbar style={{ "--background": "var(--ion-color-primary)", "--border-width": "0" }}>
          <div style={{ display: "flex", gap: "8px", padding: "0 12px 10px", overflowX: "auto" }}>
            {(["all", "active", "completed", "cancelled"] as const).map((f) => {
              const labels = { all: "Todos", active: "En curso", completed: "Completados", cancelled: "Cancelados" };
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
              const color = RIDE_STATUS_COLOR[ride.status] ?? "medium";
              const label = RIDE_STATUS_LABEL[ride.status] ?? ride.status;
              const isActive = ACTIVE_STATUSES.includes(ride.status);

              const timelineSteps = [
                { status: "requested",       label: "Solicitado",            time: ride.requestedAt,  completed: !!ride.requestedAt,  active: ride.status === "requested" },
                { status: "accepted",        label: "Conductor asignado",    time: ride.acceptedAt,   completed: !!ride.acceptedAt,   active: ride.status === "accepted" },
                { status: "driver_en_route", label: "Conductor en camino",   time: ride.enRouteAt,    completed: !!ride.enRouteAt,    active: ride.status === "driver_en_route" },
                { status: "driver_arrived",  label: "Conductor llegó",       time: ride.arrivedAt,    completed: !!ride.arrivedAt,    active: ride.status === "driver_arrived" },
                { status: "in_progress",     label: "Viaje en curso",        time: ride.startedAt,    completed: !!ride.startedAt,    active: ride.status === "in_progress" },
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

                    {/* Fare */}
                    {ride.estimatedFareClp != null && (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                        <span style={{ fontSize: "1rem", fontWeight: 700, color: "var(--ion-color-primary)" }}>
                          ${ride.estimatedFareClp.toLocaleString("es-CL")} CLP
                        </span>
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
                    {ride.driverName && ["accepted", "driver_en_route", "driver_arrived", "in_progress", "completed"].includes(ride.status) && (
                      <div style={{ marginBottom: "10px" }}>
                        <DriverInfoCard
                          name={ride.driverName}
                          rating={ride.driverRatingAverage}
                          ratingCount={ride.driverRatingCount}
                          vehicleBrand={ride.driverVehicleBrand}
                          vehicleModel={ride.driverVehicleModel}
                          vehicleColor={ride.driverVehicleColor}
                          vehiclePlate={ride.driverVehiclePlate}
                          vehicleYear={ride.driverVehicleYear}
                          phone={isActive ? ride.driverPhone : null}
                          waMessage={isActive && ride.driverPhone && ride.driverName
                            ? WA_MESSAGES.passengerToDriver({ driverName: ride.driverName, passengerName: "pasajero", origin: ride.originText })
                            : null
                          }
                        />
                      </div>
                    )}

                    {!ride.driverName && ride.status === "requested" && (
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
                      ["accepted", "driver_en_route", "driver_arrived", "in_progress"].includes(ride.status) && (
                        <PassengerDriverLiveMap
                          ride={ride}
                          token={session.accessToken}
                        />
                      )}

                    {/* Timeline — solo si activo o completado */}
                    {(isActive || ride.status === "completed") && (
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
                      {(ride.status === "requested" || ride.status === "accepted") && (
                        <IonButton
                          size="small"
                          fill="outline"
                          color="danger"
                          disabled={cancelling === ride.id}
                          onClick={() => void (ride.status === "requested" ? handleCancel(ride.id) : handleCancelAccepted(ride.id))}
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
              {ratingError && <IonText color="danger"><p style={{ fontSize: "0.82rem", margin: "4px 0" }}>{ratingError}</p></IonText>}
              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                <IonButton size="small" onClick={() => void handleSubmitRating()} disabled={submittingRating}>
                  {submittingRating ? <IonSpinner name="dots" /> : "Enviar"}
                </IonButton>
                <IonButton size="small" fill="outline" color="medium" onClick={() => setRatingRideId(null)}>
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
          <EmptyState icon={compassOutline} title="Sin guías disponibles" subtitle="Vuelve a intentarlo más tarde" />
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
        <IonHeader><IonToolbar color="primary"><IonButton slot="start" fill="clear" color="light" onClick={onBack}>← Volver</IonButton><IonTitle>Vehículo</IonTitle></IonToolbar></IonHeader>
        <IonContent><div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }}><IonSpinner name="crescent" /></div></IonContent>
      </IonPage>
    );
  }

  if (!vehicle) {
    return (
      <IonPage>
        <IonHeader><IonToolbar color="primary"><IonButton slot="start" fill="clear" color="light" onClick={onBack}>← Volver</IonButton><IonTitle>Vehículo</IonTitle></IonToolbar></IonHeader>
        <IonContent className="ion-padding"><IonText color="danger"><p>No se pudo cargar el vehículo.</p></IonText></IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
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
              <IonNote style={{ fontSize: "0.72rem", color: "var(--ion-color-medium)", display: "block", marginBottom: "20px", textAlign: "center" }}>
                Recarga y retiro disponibles próximamente
              </IonNote>

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
