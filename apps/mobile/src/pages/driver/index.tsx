import {
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
  IonNote,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  IonText,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import {
  useEffect,
  useState,
  useCallback,
  useRef,
  type CSSProperties,
  type ChangeEvent,
} from "react";
import { useHistory, useLocation } from "react-router-dom";
import {
  carOutline,
  cashOutline,
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
} from "ionicons/icons";
import { driverProfileService } from "../../features/drivers/driverProfile.service";
import { ActionCard } from "../../components/ActionCard";
import { ROUTE_METADATA } from "../../navigation/routeConfig";
import { ROUTES } from "../../navigation/routes";
import { useAuth } from "../../features/auth";
import { ridesService } from "../../features/rides/rides.service";
import {
  MapFallback,
  loadRapaGoGoogleMaps,
} from "../../components/MapFallback";
import { WhatsAppButton } from "../../components/WhatsAppButton";

type AvailableRideData =
  import("../../features/rides/rides.service").AvailableRideData;
type DriverRideData =
  import("../../features/rides/rides.service").DriverRideData;

type RapaGoConnectivityMode = "checking" | "online" | "poor" | "offline";
type RapaGoConnectivityRole = "driver" | "passenger" | "admin";

const RAPAGO_CONNECTIVITY_STATUS_KEY = "rapago_connectivity_status_v1";
const RAPAGO_CONNECTIVITY_EVENT = "rapago:connectivity-status-changed";
const RAPAGO_DRIVER_NO_SHOW_AFTER_ARRIVAL_MS = 5 * 60 * 1000;
const RAPAGO_DRIVER_NO_SHOW_TOTAL_SERVICE_CHARGE = true;
const RAPAGO_PASSENGER_PENDING_CHARGES_KEY_DRIVER = "rapago_passenger_pending_charges_v1";
const RAPAGO_PASSENGER_PENDING_CHARGE_EVENT_DRIVER = "rapago:passenger-pending-charge-updated";

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
  return String(value ?? "")
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

function getCleanRideNote(notes: string | null | undefined): string | null {
  if (!notes) return null;

  return (
    notes
      .replace(
        /Dirección origen confirmada:.*?(?=Dirección destino confirmada:|$)/i,
        "",
      )
      .replace(
        /Dirección destino confirmada:.*?(?=Ubicación real del pasajero:|Coordenadas recogida accesible:|$)/i,
        "",
      )
      .replace(
        /Ubicación real del pasajero:.*?(?=Punto accesible de recogida|Coordenadas recogida accesible:|$)/i,
        "",
      )
      .replace(
        /Punto accesible de recogida ajustado a calle\..*?(?=Coordenadas recogida accesible:|$)/i,
        "",
      )
      .replace(
        /Coordenadas recogida accesible:.*?(?=Coordenadas destino accesible:|$)/i,
        "",
      )
      .replace(
        /Coordenadas destino accesible:.*?(?=Tarifa RAPA GO calculada:|Tarifa estimada pasajero:|Distancia estimada:|Duración estimada:|Ganancia estimada conductor:|Forma de pago|$)/i,
        "",
      )
      .replace(
        /Tarifa RAPA GO calculada:.*?(?=Kilómetros calculados:|Distancia estimada:|Duración estimada:|Ganancia|Forma de pago|$)/i,
        "",
      )
      .replace(
        /Tarifa estimada pasajero:.*?(?=Distancia estimada:|Duración estimada:|Ganancia|Forma de pago|$)/i,
        "",
      )
      .replace(
        /Distancia estimada:.*?(?=Duración estimada:|Ganancia|Forma de pago|$)/i,
        "",
      )
      .replace(
        /Duración estimada:.*?(?=Tipo de viaje|Ganancia|Forma de pago|$)/i,
        "",
      )
      .replace(
        /Tipo de viaje:.*?(?=Ganancia|Categor[ií]a de veh[ií]culo|Forma de pago|$)/i,
        "",
      )
      .replace(
        /Ganancia estimada conductor:.*?(?=Categor[ií]a de veh[ií]culo|Forma de pago|$)/i,
        "",
      )
      .replace(
        /Categor[ií]a de veh[ií]culo seleccionada:.*?(?=Forma de pago|$)/i,
        "",
      )
      .replace(/Forma de pago seleccionada:.*$/i, "")
      .trim() || null
  );
}

function openGoogleNavigation(
  origin: { lat: number; lng: number } | null,
  destination: { lat: number; lng: number },
): void {
  const destinationParam = `${destination.lat},${destination.lng}`;
  const params = new URLSearchParams({
    api: "1",
    destination: destinationParam,
    travelmode: "driving",
    dir_action: "navigate",
  });

  if (origin) {
    params.set("origin", `${origin.lat},${origin.lng}`);
  }

  const url = `https://www.google.com/maps/dir/?${params.toString()}`;

  try {
    window.location.assign(url);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
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
  return String(value ?? "")
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
  const raw = String(value ?? "").trim();
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
  const text = String(notes ?? "");
  if (!text.trim()) return null;

  const pattern = kind === "origin"
    ? /Direcci[oó]n origen confirmada:\s*(.*?)(?=Direcci[oó]n destino confirmada:|Ubicaci[oó]n real del pasajero:|Coordenadas recogida accesible:|$)/i
    : /Direcci[oó]n destino confirmada:\s*(.*?)(?=Ubicaci[oó]n real del pasajero:|Coordenadas recogida accesible:|Coordenadas destino accesible:|$)/i;

  const value = text.match(pattern)?.[1]?.trim();
  return value ? value.replace(/\s+/g, " ") : null;
}

function normalizeDriverPlaceStreetText(value: unknown): string {
  return String(value ?? "")
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

function UberDriverNavigationMap({
  ride,
  height = 360,
  driverUser,
}: {
  ride: {
    id?: string | null;
    originText: string;
    destinationText: string;
    notes?: string | null;
    status: string;
  };
  height?: number;
  driverUser?: unknown;
}): JSX.Element {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(
    null,
  );
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(
    null,
  );
  const driverMarkerRef = useRef<google.maps.Marker | null>(null);
  const pickupMarkerRef = useRef<google.maps.Marker | null>(null);
  const destinationMarkerRef = useRef<google.maps.Marker | null>(null);
  const fallbackLineRef = useRef<google.maps.Polyline | null>(null);

  const driverPointRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastGpsPointRef = useRef<{ lat: number; lng: number } | null>(null);
  const headingRef = useRef(0);
  const lastCameraAtRef = useRef(0);
  const routeRequestIdRef = useRef(0);
  const routeKeyRef = useRef("");
  const didInitialCameraRef = useRef(false);
  const mapReadyRef = useRef(false);
  const lastRouteOriginRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastRouteRecalculateAtRef = useRef(0);
  const lastSpokenInstructionRef = useRef("");
  const navigationCameraLockedRef = useRef(true);
  const manualCameraUnlockUntilRef = useRef(0);
  const routePathRef = useRef<Array<{ lat: number; lng: number }>>([]);
  const routeHeadingRef = useRef<number | null>(null);
  const lastOffRouteRecalculationAtRef = useRef(0);

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
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
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

  function cleanDirectionInstruction(value: string | null | undefined): string {
    const raw = String(value ?? "").trim();
    if (!raw) return "Sigue la ruta marcada.";

    return raw
      .replace(/<div[^>]*>/gi, ". ")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\s+/g, " ")
      .replace(/\s+\./g, ".")
      .trim();
  }

  function extractStreetFromDirectionInstruction(value: string | null | undefined): string | null {
    const text = cleanDirectionInstruction(value);
    if (!text || text === "Sigue la ruta marcada.") return null;

    const patterns = [
      /(?:hacia|en dirección a|por|en|toma|contin[uú]a por|mantente en)\s+([^.,;]+)/i,
      /(?:gira|dobla|incorp[oó]rate)\s+(?:a la derecha|a la izquierda|ligeramente a la derecha|ligeramente a la izquierda)?\s*(?:hacia|en)?\s*([^.,;]+)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      const street = match?.[1]?.trim();
      if (street && street.length >= 3) return street.replace(/^la\s+/i, "").trim();
    }

    const afterArrow = text.split(" hacia ").pop()?.trim();
    if (afterArrow && afterArrow !== text && afterArrow.length >= 3) {
      return afterArrow.split(/[.,;]/)[0]?.trim() ?? null;
    }

    return null;
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

  function latLngToPlainPoint(
    value: google.maps.LatLng | google.maps.LatLngLiteral | null | undefined,
  ): { lat: number; lng: number } | null {
    if (!value) return null;

    const raw = value as {
      lat?: number | (() => number);
      lng?: number | (() => number);
    };

    const rawLat = raw.lat;
    const rawLng = raw.lng;
    const lat = typeof rawLat === "function" ? rawLat() : Number(rawLat);
    const lng = typeof rawLng === "function" ? rawLng() : Number(rawLng);

    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }

  function buildRoutePathFromLeg(
    leg: google.maps.DirectionsLeg | undefined,
  ): Array<{ lat: number; lng: number }> {
    const path: Array<{ lat: number; lng: number }> = [];

    for (const step of leg?.steps ?? []) {
      const points = step.path?.length
        ? step.path
        : [step.start_location, step.end_location];

      for (const point of points) {
        const plain = latLngToPlainPoint(point);
        if (!plain) continue;

        const last = path[path.length - 1];
        if (!last || distanceMeters(last, plain) >= 1) path.push(plain);
      }
    }

    return path;
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

  function getLiveDirectionInstruction(
    leg: google.maps.DirectionsLeg | undefined,
    driverPoint: { lat: number; lng: number },
  ): { text: string; distance: string; maneuver: string | null; street?: string | null } | null {
    const steps = leg?.steps ?? [];
    if (steps.length === 0) return null;

    let selectedStep = steps[0];

    // No nos quedamos pegados en la primera instrucción si el conductor ya la pasó.
    for (const step of steps) {
      const end = latLngToPlainPoint(step.end_location);
      if (!end || distanceMeters(driverPoint, end) > 18) {
        selectedStep = step;
        break;
      }
    }

    const stepEnd = latLngToPlainPoint(selectedStep.end_location);
    const liveDistance = stepEnd ? formatNavigationMeters(distanceMeters(driverPoint, stepEnd)) : selectedStep.distance?.text ?? "";

    return {
      text: cleanDirectionInstruction(selectedStep.instructions),
      distance: liveDistance,
      maneuver: selectedStep.maneuver ?? null,
      street: extractStreetFromDirectionInstruction(selectedStep.instructions),
    };
  }

  function shouldRecalculateRouteFrom(point: {
    lat: number;
    lng: number;
  }): boolean {
    const targetPoint = goingToDestination
      ? destination
      : goingToPickup
        ? pickup
        : waitingPassenger
          ? destination ?? pickup
          : null;
    if (!targetPoint) return false;

    const lastRouteOrigin = lastRouteOriginRef.current;
    const now = Date.now();

    if (!lastRouteOrigin) return true;

    const movedSinceRoute = distanceMeters(lastRouteOrigin, point);
    const secondsSinceRoute = (now - lastRouteRecalculateAtRef.current) / 1000;

    // Recalcula si el conductor se movió o tomó otro camino.
    // En celular no esperamos tanto: así el mapa no queda "pegado" y la distancia baja en vivo.
    return movedSinceRoute >= 3 && secondsSinceRoute >= 1.2;
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
          map.panBy(0, Math.round(height * 0.16));
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

    calculateRouteOnce(true);
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
          map.panBy(0, Math.round(height * 0.14));
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

  function calculateRouteOnce(force = false): void {
    const map = mapRef.current;
    const renderer = directionsRendererRef.current;
    const service = directionsServiceRef.current;
    const currentTarget = goingToDestination
      ? destination
      : goingToPickup
        ? pickup
        : waitingPassenger
          ? destination ?? pickup
          : null;
    const driverPoint = driverPointRef.current;

    if (!map || !renderer || !service || !window.google?.maps) return;
    const currentKey = `${rideStatus}:${goingToDestination ? "destination" : "pickup"}:${driverPoint?.lat?.toFixed(6) ?? "none"},${driverPoint?.lng?.toFixed(6) ?? "none"}:${currentTarget?.lat ?? "none"},${currentTarget?.lng ?? "none"}`;

    if (!force && routeKeyRef.current === currentKey) return;
    routeKeyRef.current = currentKey;

    fallbackLineRef.current?.setMap(null);
    fallbackLineRef.current = null;

    if (!driverPoint || !currentTarget) {
      renderer.set("directions", null);
      routePathRef.current = [];
      routeHeadingRef.current = null;
      setRouteInfo(null);
      setNextInstruction(null);
      setTargetDistanceMeters(null);
      return;
    }

    const requestId = routeRequestIdRef.current + 1;
    routeRequestIdRef.current = requestId;

    service.route(
      {
        origin: driverPoint,
        destination: currentTarget,
        travelMode: google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: false,
        optimizeWaypoints: false,
        region: "CL",
        drivingOptions: {
          departureTime: new Date(),
          trafficModel: google.maps.TrafficModel.BEST_GUESS,
        },
      },
      (result, status) => {
        if (requestId !== routeRequestIdRef.current) return;

        if (status === google.maps.DirectionsStatus.OK && result) {
          fallbackLineRef.current?.setMap(null);
          fallbackLineRef.current = null;

          renderer.setOptions({
            suppressMarkers: true,
            preserveViewport: true,
            polylineOptions: {
              strokeColor: goingToPickup ? "#06B6D4" : "#4F46E5",
              strokeOpacity: 1,
              strokeWeight: 9,
            },
          });
          renderer.setDirections(result);

          // Al recalcular, Google entrega los bounds reales de la ruta.
          // Si todavía no estamos siguiendo el GPS, mostramos toda la ruta automáticamente.
          const routeBounds = result.routes[0]?.bounds;
          if (routeBounds && (!driverPointRef.current || !didInitialCameraRef.current)) {
            try {
              map.fitBounds(routeBounds, 64);
            } catch {
              // No bloquea la navegación.
            }
          }

          const leg = result.routes[0]?.legs[0];
          routePathRef.current = buildRoutePathFromLeg(leg);
          routeHeadingRef.current = getRouteHeadingForPoint(driverPoint) ?? routeHeadingRef.current;
          if (routeHeadingRef.current != null) headingRef.current = routeHeadingRef.current;
          const instruction = getLiveDirectionInstruction(leg, driverPoint);

          lastRouteOriginRef.current = driverPoint;
          lastRouteRecalculateAtRef.current = Date.now();

          const remainingMeters = Number(leg?.distance?.value ?? NaN);
          const safeRemainingMeters = Number.isFinite(remainingMeters)
            ? remainingMeters
            : distanceMeters(driverPoint, currentTarget);
          const arrivalText = arrivalInstructionText(safeRemainingMeters);

          setRouteInfo({
            duration: leg?.duration?.text ?? "",
            distance: leg?.distance?.text ?? "",
          });
          setTargetDistanceMeters(safeRemainingMeters);
          setNextInstruction(
            arrivalText
              ? {
                  text: arrivalText,
                  distance: formatNavigationMeters(safeRemainingMeters),
                  maneuver: "arrive",
                  street: null,
                }
              : instruction,
          );

          // Sin voz automática: el conductor pidió indicación visual tipo Waze/Google Maps.
          // Si después quieres voz, se puede reactivar llamando a speakDriverNavigationInstruction().

          return;
        }

        // Si Google Maps no entrega ruta por calles, no dibujamos línea ficticia.
        // Así evitamos navegación falsa: el conductor debe abrir Google Maps oficial.
        renderer.set("directions", null);
        fallbackLineRef.current?.setMap(null);
        fallbackLineRef.current = null;
        routePathRef.current = [];
        routeHeadingRef.current = null;

        lastRouteOriginRef.current = driverPoint;
        lastRouteRecalculateAtRef.current = Date.now();
        setRouteInfo(null);
        setTargetDistanceMeters(distanceMeters(driverPoint, currentTarget));
        setNextInstruction(null);
      },
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
        directionsServiceRef.current = new google.maps.DirectionsService();
        directionsRendererRef.current = new google.maps.DirectionsRenderer({
          map,
          suppressMarkers: true,
          preserveViewport: true,
          polylineOptions: {
            strokeColor: "#00b7ff",
            strokeOpacity: 1,
            strokeWeight: 8,
          },
        });

        drawStaticMarkers();
        setMapReady(true);

        if (driverPointRef.current) {
          moveDriverOnly(driverPointRef.current, headingRef.current);
          calculateRouteOnce(true);
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
    };
    // El mapa se crea una sola vez. No depende del GPS para evitar remounts/parpadeos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    drawStaticMarkers();
    calculateRouteOnce(true);
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
          const distanceToRoute = getDistanceToCurrentRouteMeters(next);
          const now = Date.now();
          const isOffRoute = distanceToRoute != null && distanceToRoute > 28;
          const canRecalculateOffRoute = now - lastOffRouteRecalculationAtRef.current > 1600;

          if (isOffRoute && canRecalculateOffRoute) {
            lastOffRouteRecalculationAtRef.current = now;
            routeKeyRef.current = "";
            calculateRouteOnce(true);
          }

          const roadHeading = routeHeadingRef.current ?? getRouteHeadingForPoint(next) ?? headingRef.current;
          moveDriverOnly(next, roadHeading);

          if (!routeKeyRef.current || shouldRecalculateRouteFrom(next)) {
            calculateRouteOnce(true);
          }
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
          boxShadow: "0 14px 34px rgba(0,0,0,.26)",
          overflow: "hidden",
          zIndex: 12,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            minHeight: 74,
            padding: "12px 16px",
            display: "grid",
            gridTemplateColumns: "48px 1fr",
            gap: 12,
            alignItems: "center",
          }}
        >
          <div
            style={{
              fontSize: "2.25rem",
              fontWeight: 950,
              lineHeight: 1,
              textAlign: "center",
            }}
          >
            {nextInstruction?.maneuver === "arrive" ? "🏁" : maneuverArrow(nextInstruction?.maneuver)}
          </div>

          <div style={{ minWidth: 0 }}>
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
            <div
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
            </div>
          </div>
        </div>

        {nextInstruction && nextInstruction.maneuver !== "arrive" && (
          <div
            style={{
              background: "rgba(0, 72, 68, .92)",
              padding: "10px 16px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              minHeight: 48,
            }}
          >
            <span style={{ fontSize: "1.42rem", fontWeight: 950, lineHeight: 1 }}>
              Luego {maneuverArrow(nextInstruction.maneuver)}
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
          </div>
        )}
      </div>

      {driverOutsideRapaNui && (
        <div
          style={{
            position: "absolute",
            left: "14px",
            top: nextInstruction ? "146px" : "96px",
            background: "rgba(239,68,68,.92)",
            color: "#ffffff",
            borderRadius: "999px",
            padding: "5px 9px",
            fontSize: ".64rem",
            fontWeight: 950,
            boxShadow: "0 6px 14px rgba(0,0,0,.20)",
            zIndex: 12,
            pointerEvents: "none",
          }}
        >
          GPS fuera de Rapa Nui
        </div>
      )}

      {!driverGpsReady && (
        <div
          style={{
            position: "absolute",
            left: "14px",
            right: "78px",
            top: nextInstruction ? (driverOutsideRapaNui ? "178px" : "146px") : (driverOutsideRapaNui ? "128px" : "96px"),
            ...uberPanelStyle({
              background: "rgba(17,17,17,.82)",
              padding: "7px 10px",
              borderRadius: "999px",
              border: "1px solid rgba(239,68,68,.35)",
            }),
            color: "#F6F2EC",
            fontSize: ".70rem",
            fontWeight: 900,
            zIndex: 12,
            pointerEvents: "none",
          }}
        >
          📍 Activando GPS real...
        </div>
      )}

      {/* Botones laterales internos: ninguno abre Google Maps externo */}
      <button
        type="button"
        onClick={() => {
          calculateRouteOnce(true);
          focusNavigationCameraInsideApp(true);
        }}
        style={{
          position: "absolute",
          right: "14px",
          top: "130px",
          width: 52,
          height: 52,
          borderRadius: 999,
          border: "0",
          background: "rgba(255,255,255,.96)",
          color: "#111111",
          boxShadow: "0 12px 28px rgba(0,0,0,.30)",
          fontSize: 22,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 14,
        }}
        aria-label="Recalcular ruta"
      >
        <IonIcon icon={refreshOutline} />
      </button>

      <button
        type="button"
        onClick={openExternalNavigationToTarget}
        style={{
          position: "absolute",
          right: "14px",
          top: "194px",
          width: 58,
          height: 58,
          borderRadius: 999,
          border: "0",
          background: "#00a884",
          color: "#ffffff",
          boxShadow: "0 12px 28px rgba(0,0,0,.42)",
          fontSize: 25,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 14,
        }}
        aria-label="Acercar mapa y seguir ruta dentro de Rapa Go"
      >
        <IonIcon icon={navigateOutline} />
      </button>

      <button
        type="button"
        onClick={() => setMapVoiceMuted((current) => !current)}
        style={{
          position: "absolute",
          right: "14px",
          top: "264px",
          width: 52,
          height: 52,
          borderRadius: 999,
          border: "0",
          background: "rgba(255,255,255,.96)",
          color: "#111111",
          boxShadow: "0 12px 28px rgba(0,0,0,.26)",
          fontSize: 21,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 14,
        }}
        aria-label={mapVoiceMuted ? "Indicaciones visuales sin voz" : "Voz activada"}
      >
        {mapVoiceMuted ? "🔇" : "🔊"}
      </button>

      {!isNavigationCameraLocked && (
        <button
          type="button"
          onClick={() => focusNavigationCameraInsideApp(true)}
          style={{
            position: "absolute",
            left: "18px",
            bottom: "114px",
            border: "0",
            borderRadius: 999,
            background: "rgba(255,255,255,.96)",
            color: "#00796B",
            padding: "10px 14px",
            fontSize: ".78rem",
            fontWeight: 950,
            boxShadow: "0 10px 26px rgba(0,0,0,.20)",
            zIndex: 14,
          }}
        >
          △ Centrar
        </button>
      )}

      <div
        style={{
          position: "absolute",
          left: "14px",
          bottom: "104px",
          width: 66,
          height: 66,
          borderRadius: 999,
          background: "rgba(255,255,255,.96)",
          color: "#111",
          boxShadow: "0 12px 28px rgba(0,0,0,.24)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 12,
          fontWeight: 950,
          pointerEvents: "none",
        }}
      >
        <div style={{ fontSize: "1rem", lineHeight: 1 }}>
          {speedKmh == null ? "--" : speedKmh}
        </div>
        <div style={{ fontSize: ".68rem", lineHeight: 1.1 }}>km/h</div>
      </div>

      <div
        style={{
          position: "absolute",
          right: "14px",
          bottom: "104px",
          border: "0",
          borderRadius: 999,
          background: "rgba(255,255,255,.96)",
          color: "#6B4A13",
          padding: "12px 15px",
          boxShadow: "0 12px 28px rgba(0,0,0,.22)",
          zIndex: 12,
          fontSize: ".86rem",
          fontWeight: 900,
          pointerEvents: "none",
        }}
      >
        ⚠ Informar
      </div>

      {/* Hoja inferior estilo navegación */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(255,255,255,.98)",
          color: "#111111",
          borderRadius: "26px 26px 0 0",
          minHeight: 94,
          boxShadow: "0 -12px 34px rgba(0,0,0,.24)",
          zIndex: 13,
          display: "grid",
          gridTemplateColumns: "76px 1fr 76px",
          alignItems: "center",
          padding: "14px 12px 12px",
        }}
      >
        <button
          type="button"
          onClick={() => updateNavigationCameraLock(false)}
          style={{
            width: 58,
            height: 58,
            borderRadius: 999,
            border: "2px solid rgba(0,0,0,.16)",
            background: "#ffffff",
            color: "#444",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 26,
            justifySelf: "start",
          }}
          aria-label="Soltar seguimiento de cámara"
        >
          <IonIcon icon={closeOutline} />
        </button>

        <div style={{ textAlign: "center", minWidth: 0 }}>
          <div
            style={{
              fontSize: "1.95rem",
              lineHeight: 1,
              fontWeight: 900,
              letterSpacing: "-.02em",
            }}
          >
            {routeInfo?.duration || "--"}
          </div>
          <div
            style={{
              marginTop: 6,
              color: "#70757A",
              fontSize: ".92rem",
              fontWeight: 820,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {routeInfo?.distance || "Calculando distancia"}
            {targetLabel ? ` · ${targetLabel}` : ""}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            calculateRouteOnce(true);
            focusNavigationCameraInsideApp(true);
          }}
          style={{
            width: 58,
            height: 58,
            borderRadius: 999,
            border: "2px solid rgba(0,0,0,.16)",
            background: "#ffffff",
            color: "#555",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 24,
            justifySelf: "end",
          }}
          aria-label="Recentrar ruta"
        >
          <IonIcon icon={navigateOutline} />
        </button>
      </div>

      {mapError && (
        <div
          style={{
            position: "absolute",
            left: 14,
            right: 84,
            top: nextInstruction ? (driverOutsideRapaNui ? 178 : 146) : (driverOutsideRapaNui ? 128 : 96),
            background: "rgba(17,17,17,.82)",
            color: "#fff",
            borderRadius: 999,
            padding: "7px 10px",
            fontSize: ".68rem",
            fontWeight: 900,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            zIndex: 14,
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
  if (type === "resident") return "Residente Rapa Nui";
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

function DriverHeaderWithoutNotifications(): JSX.Element {
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
    <IonHeader>
      <IonToolbar
        style={
          {
            "--background": "linear-gradient(135deg,#14953f,#22c55e)",
            "--color": "#ffffff",
            "--border-width": "0",
            "--min-height": "72px",
          } as CSSProperties
        }
      >
        <IonTitle style={{ fontWeight: 950, fontSize: "1.35rem" }}>
          Inicio
        </IonTitle>

        <IonButtons slot="end" style={{ paddingRight: 8 }}>
          <IonButton
            fill="clear"
            color="light"
            routerLink={ROUTES.DRIVER.PROFILE}
            aria-label="Perfil del conductor"
            style={{ "--border-radius": "999px" } as CSSProperties}
          >
            <IonIcon icon={personOutline} slot="icon-only" />
          </IonButton>

          <IonButton
            fill="clear"
            color="light"
            onClick={() => void handleLogout()}
            aria-label="Cerrar sesión"
            style={{ "--border-radius": "999px" } as CSSProperties}
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
}: {
  value: DriverAvailability;
  onChange: (value: DriverAvailability) => void;
}): JSX.Element {
  const isAvailable = value === "available";

  return (
    <IonCard
      style={{
        margin: "0 0 14px",
        borderRadius: "22px",
        background: isAvailable
          ? "linear-gradient(135deg, rgba(34,197,94,.96), rgba(12,122,62,.94))"
          : "linear-gradient(135deg, rgba(239,68,68,.96), rgba(143,63,37,.94))",
        color: "#ffffff",
        border: "1px solid rgba(255,255,255,.16)",
        boxShadow: "0 16px 34px rgba(0,0,0,.26)",
      }}
    >
      <IonCardContent style={{ padding: "12px 14px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: 10,
          }}
        >
          <div style={{ fontWeight: 950, fontSize: "1rem" }}>
            Estado del conductor
          </div>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: 999,
              background: isAvailable ? "#bbf7d0" : "#fecaca",
              boxShadow: isAvailable
                ? "0 0 18px rgba(187,247,208,.95)"
                : "0 0 18px rgba(254,202,202,.95)",
              flexShrink: 0,
            }}
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
          }}
        >
          <IonButton
            expand="block"
            fill={isAvailable ? "solid" : "outline"}
            color="light"
            onClick={() => onChange("available")}
            style={
              {
                "--border-radius": "16px",
                "--color": isAvailable ? "#0F8A3A" : "#ffffff",
                "--border-color": "rgba(255,255,255,.72)",
                height: "46px",
                fontWeight: 950,
              } as CSSProperties
            }
          >
            Disponible
          </IonButton>

          <IonButton
            expand="block"
            fill={!isAvailable ? "solid" : "outline"}
            color="light"
            onClick={() => onChange("unavailable")}
            style={
              {
                "--border-radius": "16px",
                "--color": !isAvailable ? "#B42318" : "#ffffff",
                "--border-color": "rgba(255,255,255,.72)",
                height: "46px",
                fontWeight: 950,
              } as CSSProperties
            }
          >
            No disponible
          </IonButton>
        </div>
      </IonCardContent>
    </IonCard>
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
  return String(value ?? "")
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

    const raw = String(value ?? "").trim();
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
  const adminStatus = driverBridgeClean(ride.adminScheduleStatus ?? ride.adminReservationStatus);

  return (
    response === "accepted" ||
    response === "aceptada" ||
    adminStatus === "driver_confirmed" ||
    adminStatus === "driver_accepted" ||
    adminStatus === "accepted_by_driver" ||
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
  user?: unknown,
): DriverAcceptedRideBridgeRecord {
  const now = new Date().toISOString();
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
    lastDriverScheduleResponse: "rejected",
    lastRejectedByDriverId: driverId,
    lastRejectedByDriverEmail: driverEmail,
    lastRejectedByDriverName: driverName,
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
    rejectedReason: "Conductor rechazó reserva agendada.",
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
    window.dispatchEvent(
      new CustomEvent(DRIVER_RESERVATION_AUTO_REASSIGN_EVENT, {
        detail: { ride: rejectedRide, reason, mode: "need_admin_or_next_available_driver" },
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
  user?: unknown,
): void {
  const rejected = buildDriverScheduledReservationRejectedPayload(ride, user);
  const nextAssignment = resolveScheduledReservationNextDriverAssignment(rejected, user, "driver_rejected");
  updateDriverScheduledReservationEverywhere(ride, () => nextAssignment);
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
  const expiresAt =
    input.ownership === "borrowed"
      ? input.expiresAt
        ? new Date(input.expiresAt).toISOString()
        : new Date(now.getTime() + BORROWED_VEHICLE_DAYS * 24 * 60 * 60_000).toISOString()
      : null;

  const vehicle: DriverVehicleRecord = {
    id: `vehicle-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    ownerKey,
    ownership: input.ownership,
    brand,
    model,
    plate,
    color,
    year: year || null,
    label: [brand, model, year, color].filter(Boolean).join(" ").trim(),
    imageDataUrl: input.imageDataUrl ?? null,
    imageName: input.imageName ?? null,
    createdAt: now.toISOString(),
    expiresAt,
    primary: input.ownership === "own",
  };

  const all = purgeExpiredDriverVehicles(input.user).filter(
    (item) => !(item.ownerKey === ownerKey && item.plate.toUpperCase() === plate.toUpperCase()),
  );

  saveAllDriverVehicles([vehicle, ...all]);
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
  const driverAvailabilityUser = session?.user as
    DriverAvailabilityUser | undefined;
  const driverConnection = useRapaGoConnectivityMonitor("driver");
  const [driverAvailability, setDriverAvailability] =
    useState<DriverAvailability>(() =>
      readDriverAvailability(driverAvailabilityUser),
    );
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
  }, [
    driverAvailability,
    driverAvailabilityUser?.id,
    driverAvailabilityUser?.userId,
    driverAvailabilityUser?.email,
    driverAvailabilityUser?.name,
    driverConnection.blocked,
  ]);

  const isDriverAvailable = driverAvailability === "available" && !driverConnection.blocked;
  const [pendingReservationCount, setPendingReservationCount] = useState(() =>
    readDriverScheduledReservationOffers(driverAvailabilityUser, isDriverAvailable).length,
  );

  useEffect(() => {
    const refreshReservations = () => {
      setPendingReservationCount(
        readDriverScheduledReservationOffers(driverAvailabilityUser, isDriverAvailable).length,
      );
    };

    refreshReservations();
    window.addEventListener(DRIVER_SCHEDULED_RESERVATION_EVENT, refreshReservations as EventListener);
    window.addEventListener("rapago:admin-scheduled-rides-updated", refreshReservations as EventListener);
    window.addEventListener("storage", refreshReservations as EventListener);

    return () => {
      window.removeEventListener(DRIVER_SCHEDULED_RESERVATION_EVENT, refreshReservations as EventListener);
      window.removeEventListener("rapago:admin-scheduled-rides-updated", refreshReservations as EventListener);
      window.removeEventListener("storage", refreshReservations as EventListener);
    };
  }, [
    driverAvailabilityUser?.id,
    driverAvailabilityUser?.userId,
    driverAvailabilityUser?.email,
    driverAvailabilityUser?.name,
    isDriverAvailable,
  ]);

  function handleAvailabilityChange(value: DriverAvailability): void {
    if (value === "available" && driverConnection.blocked) {
      setDriverAvailability("unavailable");
      saveDriverAvailability("unavailable", driverAvailabilityUser);
      return;
    }

    setDriverAvailability(value);
    saveDriverAvailability(value, driverAvailabilityUser);

    if (value === "available") {
      enableDriverRideAlerts();
    }
  }

  const driverName =
    session?.user?.name?.split(" ")[0] ??
    session?.user?.email?.split("@")[0] ??
    "conductor";

  const quickCardStyle: CSSProperties = {
    margin: 0,
    borderRadius: "20px",
    background: "#F6F2EC",
    border: "1px solid rgba(0,0,0,.06)",
    boxShadow: "0 14px 32px rgba(0,0,0,.16)",
    minHeight: "132px",
  };

  const iconBoxStyle: CSSProperties = {
    width: "54px",
    height: "54px",
    borderRadius: "18px",
    background: "#2dd36f",
    color: "#111",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "12px",
    boxShadow: "0 12px 24px rgba(45,211,111,.28)",
  };

  return (
    <IonPage>
      <DriverHeaderWithoutNotifications />

      <IonContent
        className="ion-padding"
        style={
          {
            "--background":
              "linear-gradient(180deg, rgba(15,15,15,.86), rgba(15,15,15,.97)), url('/assets/rapa-go-bg.jpg') center/cover no-repeat",
          } as CSSProperties
        }
      >
        <RapaGoConnectivityBanner
          role="driver"
          status={driverConnection.status}
        />

        <DriverAvailabilityControl
          value={isDriverAvailable ? "available" : "unavailable"}
          onChange={handleAvailabilityChange}
        />

        <section
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: "22px",
            minHeight: "155px",
            padding: "18px",
            background: isDriverAvailable
              ? "linear-gradient(135deg, rgba(45,211,111,.96), rgba(210,164,58,.90))"
              : "linear-gradient(135deg, rgba(239,68,68,.94), rgba(143,63,37,.92))",
            boxShadow: "0 18px 42px rgba(0,0,0,.30)",
            color: "#fff",
          }}
        >
          <div
            style={{
              position: "absolute",
              right: "-35px",
              top: "-45px",
              width: "155px",
              height: "155px",
              borderRadius: "999px",
              background: "rgba(255,255,255,.16)",
            }}
          />

          <div
            style={{
              position: "absolute",
              right: "26px",
              bottom: "-38px",
              width: "120px",
              height: "120px",
              borderRadius: "999px",
              background: "rgba(0,0,0,.12)",
            }}
          />

          <div style={{ position: "relative", zIndex: 1 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "1.45rem",
                    fontWeight: 950,
                    lineHeight: 1.1,
                  }}
                >
                  Hola, {driverName} 👋
                </div>
                <div
                  style={{
                    marginTop: 5,
                    fontSize: ".88rem",
                    fontWeight: 700,
                    opacity: 0.94,
                  }}
                >
                  Panel de conductor Rapa Go
                </div>
              </div>

              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "18px",
                  background: "rgba(255,255,255,.20)",
                  border: "1px solid rgba(255,255,255,.30)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backdropFilter: "blur(8px)",
                }}
              >
                <IonIcon icon={carOutline} style={{ fontSize: "30px" }} />
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "10px",
                marginTop: "18px",
              }}
            >
              <div
                style={{
                  background: "rgba(255,255,255,.18)",
                  border: "1px solid rgba(255,255,255,.25)",
                  borderRadius: "16px",
                  padding: "12px",
                  backdropFilter: "blur(8px)",
                }}
              >
                <div style={{ fontSize: ".74rem", opacity: 0.86 }}>Estado</div>
                <div style={{ fontWeight: 950, marginTop: 2 }}>
                  {isDriverAvailable ? "Disponible" : "No disponible"}
                </div>
              </div>

              <div
                style={{
                  background: "rgba(255,255,255,.18)",
                  border: "1px solid rgba(255,255,255,.25)",
                  borderRadius: "16px",
                  padding: "12px",
                  backdropFilter: "blur(8px)",
                }}
              >
                <div style={{ fontSize: ".74rem", opacity: 0.86 }}>Zona</div>
                <div style={{ fontWeight: 950, marginTop: 2, lineHeight: 1.2 }}>
                  Rapa Nui
                </div>
              </div>
            </div>
          </div>
        </section>

        <div style={{ marginTop: "18px" }}>
          <div
            style={{
              color: "#F6F2EC",
              fontSize: "1rem",
              fontWeight: 950,
              marginBottom: "10px",
            }}
          >
            Accesos rápidos
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
            }}
          >
            <IonCard
              button
              routerLink={DRIVER_REQUESTS_VIEW_ROUTE}
              style={quickCardStyle}
            >
              <IonCardContent style={{ padding: "18px" }}>
                <div style={iconBoxStyle}>
                  <IonIcon icon={listOutline} style={{ fontSize: "28px" }} />
                </div>
                <div
                  style={{ fontWeight: 950, color: "#111", fontSize: "1rem" }}
                >
                  Solicitudes
                </div>
                <div
                  style={{
                    marginTop: 5,
                    color: "#333",
                    fontSize: ".78rem",
                    fontWeight: 800,
                    lineHeight: 1.35,
                  }}
                >
                  {isDriverAvailable
                    ? "Viajes disponibles y activos"
                    : "Activa disponible para recibir viajes"}
                </div>
              </IonCardContent>
            </IonCard>

            <IonCard
              button
              routerLink={DRIVER_RESERVATIONS_VIEW_ROUTE}
              style={{
                ...quickCardStyle,
                border: pendingReservationCount > 0
                  ? "2px solid rgba(210,164,58,.78)"
                  : quickCardStyle.border,
                background: pendingReservationCount > 0
                  ? "linear-gradient(135deg,#fff7dd,#F6F2EC)"
                  : quickCardStyle.background,
              }}
            >
              <IonCardContent style={{ padding: "18px" }}>
                <div
                  style={{
                    ...iconBoxStyle,
                    background: pendingReservationCount > 0 ? "#d2a43a" : "#22c55e",
                    color: "#111",
                    boxShadow: "0 12px 24px rgba(210,164,58,.28)",
                  }}
                >
                  <IonIcon icon={timeOutline} style={{ fontSize: "28px" }} />
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <div style={{ fontWeight: 950, color: "#111", fontSize: "1rem" }}>
                    Reservas
                  </div>
                  {pendingReservationCount > 0 && (
                    <IonBadge color="warning" style={{ fontWeight: 950 }}>
                      {pendingReservationCount}
                    </IonBadge>
                  )}
                </div>
                <div
                  style={{
                    marginTop: 5,
                    color: "#333",
                    fontSize: ".78rem",
                    fontWeight: 800,
                    lineHeight: 1.35,
                  }}
                >
                  {pendingReservationCount > 0
                    ? `${pendingReservationCount} agendada${pendingReservationCount === 1 ? "" : "s"} por confirmar`
                    : "Agendamientos asignados"}
                </div>
              </IonCardContent>
            </IonCard>

            <IonCard
              button
              routerLink={ROUTES.DRIVER.TRIPS}
              style={quickCardStyle}
            >
              <IonCardContent style={{ padding: "18px" }}>
                <div style={iconBoxStyle}>
                  <IonIcon icon={carOutline} style={{ fontSize: "28px" }} />
                </div>
                <div
                  style={{ fontWeight: 950, color: "#111", fontSize: "1rem" }}
                >
                  Mis viajes
                </div>
                <div
                  style={{
                    marginTop: 5,
                    color: "#333",
                    fontSize: ".78rem",
                    fontWeight: 800,
                    lineHeight: 1.35,
                  }}
                >
                  Historial y navegación
                </div>
              </IonCardContent>
            </IonCard>

            <IonCard
              button
              routerLink={ROUTES.DRIVER.EARNINGS}
              style={quickCardStyle}
            >
              <IonCardContent style={{ padding: "18px" }}>
                <div style={iconBoxStyle}>
                  <IonIcon icon={cashOutline} style={{ fontSize: "28px" }} />
                </div>
                <div
                  style={{ fontWeight: 950, color: "#111", fontSize: "1rem" }}
                >
                  Ganancias
                </div>
                <div
                  style={{
                    marginTop: 5,
                    color: "#333",
                    fontSize: ".78rem",
                    fontWeight: 800,
                    lineHeight: 1.35,
                  }}
                >
                  Resumen de ingresos
                </div>
              </IonCardContent>
            </IonCard>

            <IonCard
              button
              routerLink={ROUTES.DRIVER.PROFILE}
              style={quickCardStyle}
            >
              <IonCardContent style={{ padding: "18px" }}>
                <div
                  style={{
                    ...iconBoxStyle,
                    background: "#6b7280",
                    color: "#fff",
                    boxShadow: "0 12px 24px rgba(107,114,128,.28)",
                  }}
                >
                  <IonIcon icon={personOutline} style={{ fontSize: "28px" }} />
                </div>
                <div
                  style={{ fontWeight: 950, color: "#111", fontSize: "1rem" }}
                >
                  Perfil
                </div>
                <div
                  style={{
                    marginTop: 5,
                    color: "#333",
                    fontSize: ".78rem",
                    fontWeight: 800,
                    lineHeight: 1.35,
                  }}
                >
                  Datos personales y vehículo
                </div>
              </IonCardContent>
            </IonCard>
          </div>
        </div>

        <IonCard
          style={{
            margin: "18px 0 0",
            borderRadius: "22px",
            background: "linear-gradient(135deg, #d2a43a, #c5532f)",
            color: "#fff",
            boxShadow: "0 16px 32px rgba(0,0,0,.22)",
          }}
        >
          <IonCardContent
            style={{
              padding: "18px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "14px",
            }}
          >
            <div>
              <div style={{ fontWeight: 950, fontSize: "1rem" }}>
                {isDriverAvailable
                  ? "Revisa tus solicitudes"
                  : "Estás no disponible"}
              </div>
              <div style={{ opacity: 0.92, fontSize: ".8rem", marginTop: 4 }}>
                {isDriverAvailable
                  ? "Cuando un pasajero pida un viaje, aparecerá aquí."
                  : "No recibirás solicitudes de viaje hasta cambiar tu estado a disponible."}
              </div>
            </div>

            <IonButton
              routerLink={ROUTES.DRIVER.REQUESTS}
              fill="solid"
              color="light"
              style={
                {
                  "--border-radius": "999px",
                  "--color": "#111",
                } as CSSProperties
              }
            >
              {isDriverAvailable ? "Ver" : "Cambiar"}
            </IonButton>
          </IonCardContent>
        </IonCard>
      </IonContent>

      <DriverGlobalRideAlert />
    </IonPage>
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
  return String(value ?? "")
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
const RAPAGO_PASSENGER_CANCELLED_RIDE_EVENT = "rapago:passenger-cancelled-ride-for-driver";

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
  cancelledAt: string;
  cancelledByRole: "passenger";
};

function isRidePassengerCancelledForDriver(ride: Record<string, unknown>): boolean {
  const status = normalizeDriverRideIdentityValue(ride.status);
  const cancelledByRole = normalizeDriverRideIdentityValue(ride.cancelledByRole ?? ride.cancelledBy);
  const cancellationReason = normalizeDriverRideIdentityValue(ride.cancellationReason ?? ride.cancelReason ?? ride.reason);

  return (
    status === "cancelled" ||
    status === "canceled" ||
    status === "passenger_cancelled" ||
    status === "cancelled_by_passenger" ||
    cancelledByRole.includes("passenger") ||
    cancelledByRole.includes("pasajero") ||
    cancellationReason.includes("cancelado por pasajero") ||
    cancellationReason.includes("pasajero cancelo") ||
    cancellationReason.includes("pasajero cancel")
  );
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
    cancelledAt: now,
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
  if (driverRideIdentityMatches(activeRide, cancelledRide)) return true;

  const activeOrigin = normalizeDriverRideIdentityValue(activeRide.originText);
  const activeDestination = normalizeDriverRideIdentityValue(activeRide.destinationText);
  const activePassengerEmail = normalizeDriverRideIdentityValue(activeRide.passengerEmail ?? activeRide.userEmail ?? activeRide.email);

  const cancelledOrigin = normalizeDriverRideIdentityValue(cancelledRide.originText);
  const cancelledDestination = normalizeDriverRideIdentityValue(cancelledRide.destinationText);
  const cancelledPassengerEmail = normalizeDriverRideIdentityValue(cancelledRide.passengerEmail ?? cancelledRide.userEmail ?? cancelledRide.email);

  return Boolean(
    activeOrigin &&
      activeDestination &&
      cancelledOrigin &&
      cancelledDestination &&
      activeOrigin === cancelledOrigin &&
      activeDestination === cancelledDestination &&
      (!activePassengerEmail || !cancelledPassengerEmail || activePassengerEmail === cancelledPassengerEmail),
  );
}

function findPassengerCancelledRideForDriver(ride: Record<string, unknown>): Record<string, unknown> | null {
  if (isRidePassengerCancelledForDriver(ride) || wasDriverRidePassengerCancelledLocally(ride)) return ride;

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

  window.dispatchEvent(new CustomEvent(RAPAGO_PASSENGER_CANCELLED_RIDE_EVENT, { detail: { cancelled: cancelledRide } }));
  window.dispatchEvent(new CustomEvent("rapago:driver-rides-updated", { detail: { cancelled: cancelledRide } }));
  window.dispatchEvent(new CustomEvent("rapago:driver-available-rides-updated", { detail: { cancelled: cancelledRide } }));
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

function saveDriverActiveRideLocalMirror(
  ride: DriverRideData | Record<string, unknown>,
  user?: unknown,
): DriverRideData {
  const activeRide = normalizeActiveDriverRideForLocalMirror(ride, user);
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
  return <AssignedRidesPage />;
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

function getRideDisplayFareClp(ride: RideWithFarePayload): number | null {
  /*
   * El precio que debe ver el conductor es el mismo que ve el pasajero.
   * En algunas respuestas antiguas del backend estimatedFareClp puede venir con
   * un cálculo viejo. Por eso primero leemos la tarifa escrita al crear la
   * solicitud en notes: "Tarifa RAPA GO calculada" / "Tarifa estimada pasajero".
   * Si no existe en notes, recién usamos los campos directos como respaldo.
   */
  const noteFare = extractFareFromNotes(ride.notes);
  if (noteFare != null) return noteFare;

  const directCandidates = [
    ride.estimatedFareClp,
    ride.fareClp,
    ride.priceClp,
    ride.totalFareClp,
    ride.totalPriceClp,
  ];

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
  // No show RAPA GO: cobro íntegro del servicio tras 5 minutos de espera,
  // con aviso por app y WhatsApp al pasajero.
  return Math.max(0, Math.round(getDriverRideMinimumFareForNoShow(ride)));
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


function driverNoShowRideLooksCardPaid(ride: Partial<DriverRideData> & Record<string, unknown>): boolean {
  const text = [
    ride.paymentMethod,
    ride.paymentProvider,
    ride.paymentStatus,
    ride.paymentId,
    ride.mercadoPagoPaymentId,
    ride.notes,
  ].map((value) => String(value ?? "").toLowerCase()).join(" ");

  return (
    text.includes("tarjeta") ||
    text.includes("card") ||
    text.includes("mercadopago") ||
    text.includes("mercado pago") ||
    text.includes("webpay") ||
    Boolean(ride.paymentId || ride.mercadoPagoPaymentId)
  );
}

function getDriverRidePassengerPhoneForNoShow(ride: Partial<DriverRideData> & Record<string, unknown>): string {
  return String(
    ride.passengerPhone ??
      ride.userPhone ??
      ride.phone ??
      ride.passengerMobile ??
      ride.mobile ??
      "",
  ).replace(/\D/g, "");
}

function buildDriverNoShowWhatsappUrl(ride: DriverRideData, feeClp: number): string | null {
  const phone = getDriverRidePassengerPhoneForNoShow(ride as DriverRideData & Record<string, unknown>);
  if (!phone) return null;

  const message = [
    "Hola, soy tu conductor de RAPA GO.",
    "Ya llegué al punto de recogida indicado en la app.",
    "La app registra 5 minutos de espera.",
    `Si no te presentas, se marcará NO SHOW y se cobrará el total del servicio: ${formatClp(feeClp)}.`,
    `Viaje: ${String(ride.originText ?? "Origen")} → ${String(ride.destinationText ?? "Destino")}.`,
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
    `La app inicia una espera de 5 minutos. Si no te presentas, se puede marcar NO SHOW y cobrar el total del servicio: ${formatClp(feeClp)}.`,
    `Viaje: ${String(ride.originText ?? "Origen")} → ${String(ride.destinationText ?? "Destino")}.`,
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
        window.open(url, "_blank", "noopener,noreferrer");
      } catch {
        // Si el navegador bloquea popups, queda al menos el aviso por app.
      }
    }
  }
}

function notifyPassengerNoShowByAppAndWhatsapp(ride: DriverRideData, feeClp: number): void {
  const record = ride as DriverRideData & Record<string, unknown>;
  const now = new Date().toISOString();
  const notification = {
    id: `no-show-warning-${String(record.id ?? record.rideId ?? Date.now())}`,
    rideId: String(record.id ?? record.rideId ?? ""),
    type: "no_show_warning",
    title: "Tu conductor llegó al punto",
    body: `El conductor notificó llegada y esperó 5 minutos. Si no estás en el punto, se marcará NO SHOW y se cobrará el total del servicio: ${formatClp(feeClp)}.`,
    createdAt: now,
    read: false,
  };

  try {
    const raw = localStorage.getItem("rapago_passenger_notifications_v1");
    const parsed = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
    const current = Array.isArray(parsed) ? parsed : [];
    localStorage.setItem(
      "rapago_passenger_notifications_v1",
      JSON.stringify([
        notification,
        ...current.filter((item) => String(item.id ?? "") !== notification.id),
      ].slice(0, 100)),
    );
    window.dispatchEvent(new CustomEvent("rapago:passenger-notifications-updated", { detail: { notification } }));
    window.dispatchEvent(new CustomEvent("rapago:passenger-rides-updated", { detail: { ride, notification } }));
  } catch {
    // No bloquea el no show.
  }

  const url = buildDriverNoShowWhatsappUrl(ride, feeClp);
  if (url) {
    try {
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      // Si el navegador bloquea popups, queda al menos la notificación por app.
    }
  }
}

function saveDriverNoShowChargeForPassenger(
  ride: DriverRideData,
  user?: unknown,
): Record<string, unknown> {
  const record = ride as DriverRideData & Record<string, unknown>;
  const rideKey = getDriverNoShowRideKey(record);
  const feeClp = getDriverRideNoShowFeeClp(record);
  const isCardPaid = driverNoShowRideLooksCardPaid(record);
  const now = new Date().toISOString();
  const rideId = String(record.id ?? record.rideId ?? record.originalRideId ?? "").trim();

  const charge = {
    id: `driver-no-show-${rideId || rideKey}`,
    rideId: rideId || rideKey,
    rideKey,
    passengerEmail: String(record.passengerEmail ?? record.email ?? "").trim() || null,
    passengerName: String(record.passengerName ?? record.userName ?? record.name ?? "").trim() || null,
    originText: String(record.originText ?? ""),
    destinationText: String(record.destinationText ?? ""),
    amountClp: feeClp,
    minimumFareClp: getDriverRideMinimumFareForNoShow(record),
    type: "no_show",
    paymentMethod: getRidePaymentMethodLabel(String(record.notes ?? "")),
    status: isCardPaid ? "charged_from_card_or_paid_amount" : "pending_next_ride",
    adminReviewStatus: isCardPaid ? "no_show_total_service_charged" : "charge_pending_next_ride",
    createdAt: now,
    appliedRideId: null,
    appliedAt: null,
    title: "Cargo por no show",
    description: isCardPaid
      ? `No show confirmado por conductor: notificó por app/WhatsApp y esperó 5 minutos en el punto. Se cobra el total del servicio desde el pago/tarjeta: ${formatClp(feeClp)}.`
      : `No show confirmado por conductor: notificó por app/WhatsApp y esperó 5 minutos en el punto. Cargo total del servicio pendiente para el próximo viaje: ${formatClp(feeClp)}.`,
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
    passengerCancellationPolicyText: "No show: cobro íntegro del servicio tras 5 minutos de espera y notificación por app/WhatsApp.",
    paymentPendingClp: Number(charge.amountClp ?? 0),
    passengerPendingChargeNextRide: true,
    passengerPendingChargeNotice: String(charge.status ?? "") === "charged_from_card_or_paid_amount"
      ? `No show confirmado. Se cobró el total del servicio desde el pago realizado: ${formatClp(Number(charge.amountClp ?? 0))}.`
      : `Cargo pendiente de ${formatClp(Number(charge.amountClp ?? 0))} por no show. Se sumará automáticamente a tu próximo viaje.`,
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
    text.includes("prontopaga") ||
    text.includes("webpay")
  )
    return "ProntoPaga";
  if (text.includes("efectivo")) return "Efectivo";
  return "Pendiente";
}

function getRidePaymentIcon(notes: string | null | undefined): string {
  const label = getRidePaymentMethodLabel(notes);
  if (label === "ProntoPaga") return "💳";
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
  return String(value ?? "")
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
        zIndex: 2147483000,
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
          --background: #fff8e7 !important;
          --color: #111827 !important;
          --highlight-color-focused: #d6a640 !important;
          background: linear-gradient(180deg,#fffaf0,#fff3d7) !important;
          border-radius: 18px !important;
          overflow: hidden;
        }
        .rapago-cash-close-input::part(native) {
          background: linear-gradient(180deg,#fffaf0,#fff3d7) !important;
          color: #111827 !important;
          border-radius: 18px !important;
          min-height: 76px;
        }
        .rapago-cash-close-input ion-label {
          color: #7c4a03 !important;
          font-size: .76rem !important;
          letter-spacing: .01em;
        }
        .rapago-cash-close-input ion-input {
          --background: transparent !important;
          --color: #111827 !important;
          --placeholder-color: #b08a32 !important;
          --placeholder-opacity: 1 !important;
          color: #111827 !important;
          font-weight: 950;
        }
        .rapago-cash-close-input input {
          background: transparent !important;
          color: #111827 !important;
          font-weight: 950 !important;
        }
      `}</style>
      <div
        style={{
          width: "min(560px, calc(100vw - 16px))",
          maxHeight: "calc(100dvh - 108px)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          borderRadius: 24,
          background: "#F6F2EC",
          color: "#111",
          boxShadow: "0 22px 60px rgba(0,0,0,.45)",
          border: "1px solid rgba(210,164,58,.40)",
        }}
      >
        <div
          style={{
            padding: "16px 18px",
            background: "linear-gradient(135deg,#14532d,#22c55e)",
            color: "#fff",
            borderRadius: "24px 24px 0 0",
          }}
        >
          <div style={{ fontSize: "1.05rem", fontWeight: 950 }}>
            Cierre de carrera
          </div>
          <div style={{ marginTop: 3, fontSize: ".78rem", fontWeight: 800, opacity: .92 }}>
            Antes de tomar otro servicio, confirma destino y pago.
          </div>
        </div>

        <div
          style={{
            padding: 12,
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            paddingBottom: "calc(86px + env(safe-area-inset-bottom))",
          }}
        >
          <div
            style={{
              borderRadius: 18,
              background: "#ffffff",
              border: "1px solid rgba(0,0,0,.08)",
              padding: 13,
              marginBottom: 12,
            }}
          >
            <div style={{ fontSize: ".72rem", fontWeight: 950, color: "#166534", textTransform: "uppercase" }}>
              Viaje
            </div>
            <div style={{ marginTop: 5, fontWeight: 950, lineHeight: 1.3 }}>
              {getDriverRideRouteDisplayLabel(ride)}
            </div>
            <div style={{ marginTop: 7, fontSize: ".82rem", fontWeight: 900, color: "#333" }}>
              Tarifa: {formatClp(fareClp)} · Pago: {isCash ? "Efectivo" : getRidePaymentMethodLabel(ride.notes)}
            </div>
          </div>

          <div
            style={{
              borderRadius: 18,
              background: destinationOk ? "#ecfdf3" : "#ffffff",
              border: destinationOk ? "1px solid rgba(34,197,94,.45)" : "1px solid rgba(0,0,0,.08)",
              padding: 13,
              marginBottom: 12,
            }}
          >
            <div style={{ fontWeight: 950, marginBottom: 8 }}>
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
                background: "linear-gradient(180deg,#fffdf7,#fff7e6)",
                border: "1px solid rgba(210,164,58,.32)",
                boxShadow: "0 14px 34px rgba(120,82,0,.09)",
                padding: 13,
                marginBottom: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
                <IonIcon icon={cashOutline} style={{ color: "#166534", fontSize: 24 }} />
                <div>
                  <div style={{ fontWeight: 950 }}>Pago en efectivo</div>
                  <div style={{ fontSize: ".74rem", color: "#555", fontWeight: 800 }}>
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
                      "--background": "#fff8e7",
                      "--color": "#111827",
                      "--highlight-color-focused": "#C89B3C",
                      "--padding-start": "12px",
                      "--inner-padding-end": "12px",
                      border: "1px solid rgba(210,164,58,.45)",
                      borderRadius: 18,
                      background: "linear-gradient(180deg,#fffaf0,#fff3d7)",
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
                        "--color": "#111111",
                        "--placeholder-color": "#8a6a2a",
                        "--placeholder-opacity": "1",
                        color: "#111111",
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
                      background: paidAmountClp != null && paidAmountClp > fareClp ? "#ecfdf3" : "#fff7ed",
                      color: paidAmountClp != null && paidAmountClp > fareClp ? "#14532d" : "#9a3412",
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
                background: "#eef2ff",
                color: "#1e1b4b",
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

          <div
            style={{
              position: "sticky",
              bottom: 0,
              zIndex: 3,
              display: "grid",
              gridTemplateColumns: "1fr 1.35fr",
              gap: 8,
              margin: "12px -12px -12px",
              padding: "10px 12px calc(12px + env(safe-area-inset-bottom))",
              background: "linear-gradient(180deg,rgba(246,242,236,.88),#F6F2EC 34%)",
              borderTop: "1px solid rgba(210,164,58,.24)",
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
    </div>
  );
}

function normalizeTripTypeText(value: unknown): string {
  return String(value ?? "")
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
  const text = String(notes ?? "");
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
      background: "linear-gradient(145deg, #F6F2EC 0%, #EFE6D8 100%)",
      color: "#111111",
      border: "1px solid rgba(210,164,58,.42)",
      boxShadow: "0 24px 64px rgba(0,0,0,.34)",
      "--background": "#F6F2EC",
      "--color": "#111111",
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
      background: "rgba(17,17,17,.06)",
      border: "1px solid rgba(17,17,17,.10)",
      color: "#111111",
      fontSize: ".72rem",
      fontWeight: 950,
    },
    routeBox: {
      marginTop: "16px",
      padding: "14px",
      borderRadius: "20px",
      background: "#FFFFFF",
      border: "1px solid rgba(210,164,58,.30)",
      boxShadow: "0 10px 26px rgba(0,0,0,.08)",
      color: "#111111",
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

function DriverGlobalRideAlert(): JSX.Element | null {
  const { session } = useAuth();
  const history = useHistory();
  const location = useLocation();
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

  const isDriverAvailable = driverAvailability === "available" && !driverConnection.blocked;
  const isRequestsPage =
    location.pathname === ROUTES.DRIVER.REQUESTS ||
    location.pathname.includes("/driver/requests");
  const shouldRunGlobalAlert = !isRequestsPage;

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
      !readSelectedDriverVehicleId(session?.user)
    ) {
      return;
    }

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

      // Si estamos en Solicitudes/Reservas, solo evitamos la alerta normal.
      // La reserva especial de arriba sí debe sonar aunque estemos en esa pantalla.
      if (!shouldRunGlobalAlert) return;

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
    } catch {
      // No mostramos error en Inicio. La pantalla Solicitudes conserva sus propios errores.
    }
  }, [
    accepting,
    isDriverAvailable,
    rideAlert,
    scheduledReservationAlert,
    session?.accessToken,
    session?.user,
    shouldRunGlobalAlert,
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
    if (!isDriverAvailable || !shouldRunGlobalAlert) {
      stopRideAlert(true);
      return;
    }

    const tick = () => {
      void loadAvailableRideForAlert();
    };

    tick();
    const interval = window.setInterval(tick, 1000);

    window.addEventListener(DRIVER_SCHEDULED_RESERVATION_EVENT, tick as EventListener);
    window.addEventListener(DRIVER_ASSIGNED_SCHEDULED_RIDE_EVENT, tick as EventListener);
    window.addEventListener("rapago:driver-reservation-inbox-updated", tick as EventListener);
    window.addEventListener("rapago:admin-scheduled-rides-updated", tick as EventListener);
    window.addEventListener("storage", tick);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener(DRIVER_SCHEDULED_RESERVATION_EVENT, tick as EventListener);
      window.removeEventListener(DRIVER_ASSIGNED_SCHEDULED_RIDE_EVENT, tick as EventListener);
      window.removeEventListener("rapago:driver-reservation-inbox-updated", tick as EventListener);
      window.removeEventListener("rapago:admin-scheduled-rides-updated", tick as EventListener);
      window.removeEventListener("storage", tick);
    };
  }, [
    isDriverAvailable,
    shouldRunGlobalAlert,
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
    stopRideAlert(true);
    window.history.pushState(null, "", DRIVER_REQUESTS_VIEW_ROUTE);
      window.dispatchEvent(new PopStateEvent("popstate"));
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
      history.push(activeAccepted ? DRIVER_REQUESTS_VIEW_ROUTE : DRIVER_RESERVATIONS_VIEW_ROUTE);
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
      history.push(ROUTES.DRIVER.REQUESTS);
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
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 99999,
          background: "rgba(0,0,0,.58)",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          padding: "18px",
          pointerEvents: "auto",
        }}
      >
        <div
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
                📅
              </div>

              <div>
                <div style={{ fontSize: "1.1rem", fontWeight: 950, lineHeight: 1.1 }}>
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
              style={{ "--border-radius": "999px" } as CSSProperties}
            >
              <IonIcon icon={closeOutline} slot="icon-only" />
            </IonButton>
          </div>

          <div style={{ padding: "18px" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              <IonChip color="warning" style={{ fontWeight: 950 }}>
                📅 Reserva asignada
              </IonChip>
              <IonChip color="success" style={{ fontWeight: 950 }}>
                {vehicleEmoji} {vehicleLabel}
              </IonChip>
              <IonChip color="medium" style={{ fontWeight: 950 }}>
                {paymentIcon} {paymentLabel}
              </IonChip>
            </div>

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
                {String(ride.destinationText ?? "Destino reservado")}
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

  if (!rideAlert || !shouldRunGlobalAlert) return null;

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
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "rgba(0,0,0,.58)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: "18px",
        pointerEvents: "auto",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
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
                style={{ fontSize: "1.1rem", fontWeight: 950, lineHeight: 1.1 }}
              >
                {isNextServiceAlert ? "Nuevo servicio para continuar" : "Nueva solicitud de viaje"}
              </div>
              <div style={{ fontSize: ".78rem", opacity: 0.84, marginTop: 3 }}>
                {isNextServiceAlert
                  ? `Sonando por ${formatRideAlertSeconds(secondsLeft)} · queda como próximo servicio`
                  : `Sonando por ${formatRideAlertSeconds(secondsLeft)} · disponible ahora`}
              </div>
            </div>
          </div>

          <IonButton
            fill="clear"
            color="light"
            onClick={() => dismissRideAlert(rideAlert.id)}
            style={{ "--border-radius": "999px" } as CSSProperties}
          >
            <IonIcon icon={closeOutline} slot="icon-only" />
          </IonButton>
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
              <IonIcon icon={volumeHighOutline} />
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
              {rideAlert.originText}
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
              {rideAlert.destinationText}
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

          <IonButton
            expand="block"
            fill="clear"
            color="dark"
            onClick={goToRequests}
            style={
              {
                marginTop: 8,
                "--border-radius": "16px",
                fontWeight: 900,
              } as CSSProperties
            }
          >
            Ver en solicitudes
          </IonButton>
        </div>
      </div>
    </div>
  );
}

function AssignedRidesPage(): JSX.Element {
  const { session } = useAuth();
  const location = useLocation();
  const driverAvailabilityUser = session?.user as
    DriverAvailabilityUser | undefined;
  const driverConnection = useRapaGoConnectivityMonitor("driver");

  const requestView = new URLSearchParams(location.search).get("view");
  const showOnlyReservations = requestView === "reservations";

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
  const [error, setError] = useState<string | null>(null);
  const [driverLocation, setDriverLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const driverLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastPublishedDriverLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const liveDriverHeadingRef = useRef<number | null>(null);
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
  const reservationsTotal = reservationOffers.length + confirmedReservationOffers.length;

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
    const notifyPassengerCancelled = (cancelledRide: Record<string, unknown>) => {
      markDriverRidePassengerCancelledLocally(cancelledRide);
      removeDriverRideAfterPassengerCancel(cancelledRide);

      const cancelledTitle = getDriverRideRouteDisplayLabel(cancelledRide as {
        originText?: string | null;
        destinationText?: string | null;
        notes?: string | null;
      });

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

      setError("El pasajero canceló el viaje. La solicitud fue retirada de tu pantalla.");

      try {
        if ("vibrate" in navigator) navigator.vibrate?.([220, 90, 220]);
      } catch {
        // No bloquea el aviso.
      }

      setPassengerCancelNotice({
        route: cancelledTitle,
        message: "La solicitud fue retirada de tu pantalla. No debes continuar hacia la recogida.",
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

    const timerId = window.setInterval(tick, 1000);
    window.addEventListener(DRIVER_SCHEDULED_RESERVATION_EVENT, tick as EventListener);
    window.addEventListener(DRIVER_ASSIGNED_SCHEDULED_RIDE_EVENT, tick as EventListener);
    window.addEventListener("rapago:driver-reservation-inbox-updated", tick as EventListener);
    window.addEventListener("rapago:admin-scheduled-rides-updated", tick as EventListener);
    window.addEventListener("storage", tick as EventListener);

    return () => {
      window.clearInterval(timerId);
      window.removeEventListener(DRIVER_SCHEDULED_RESERVATION_EVENT, tick as EventListener);
      window.removeEventListener(DRIVER_ASSIGNED_SCHEDULED_RIDE_EVENT, tick as EventListener);
      window.removeEventListener("rapago:driver-reservation-inbox-updated", tick as EventListener);
      window.removeEventListener("rapago:admin-scheduled-rides-updated", tick as EventListener);
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
    if (!navigator.geolocation) {
      setLocationError(
        "Este dispositivo no permite GPS. No puedes tomar viajes reales sin ubicación.",
      );
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const nextLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        const previousLocation = lastPublishedDriverLocationRef.current;
        const movedMeters = previousLocation
          ? distanceMetersForLiveDriverGps(previousLocation, nextLocation)
          : Number.POSITIVE_INFINITY;
        const browserHeading = Number(position.coords.heading);

        if (previousLocation && movedMeters >= 4) {
          liveDriverHeadingRef.current = bearingDegreesForLiveDriverGps(previousLocation, nextLocation);
        } else if (Number.isFinite(browserHeading)) {
          liveDriverHeadingRef.current = browserHeading;
        }

        lastPublishedDriverLocationRef.current = nextLocation;
        driverLocationRef.current = nextLocation;
        setLocationError(null);

        if (activeRide) {
          publishDriverLiveLocationForPassenger(
            activeRide as unknown as DriverRideData,
            {
              lat: nextLocation.lat,
              lng: nextLocation.lng,
              heading: liveDriverHeadingRef.current,
              speed: Number.isFinite(Number(position.coords.speed))
                ? Number(position.coords.speed)
                : null,
              accuracy: Number.isFinite(Number(position.coords.accuracy))
                ? Number(position.coords.accuracy)
                : null,
            },
            liveDriverHeadingRef.current,
            session?.user,
          );
        }

        // Cuando hay viaje activo NO actualizamos estado en cada GPS,
        // porque eso remonta la pantalla y provoca el bucle visual del mapa.
        // Igual publicamos arriba la ubicación real para que el pasajero vea la flecha viva.
        if (activeRide) {
          return;
        }

        setDriverLocation(nextLocation);
      },
      () => {
        setDriverLocation(null);
        setLocationError(
          "Activa el permiso de ubicación para tomar viajes reales.",
        );
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 12000,
      },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [activeRide?.id, activeRide?.status, session?.user]);

  const loadRides = useCallback(async () => {
    if (!session?.accessToken) return;

    setLoading(true);
    setError(null);

    try {
      const mine = await ridesService.listDriverRides(session.accessToken);

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
      setAssignedRides([]);
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
      setError(
        err instanceof Error ? err.message : "Error al cargar solicitudes.",
      );
    } finally {
      setLoading(false);
    }
  }, [isDriverAvailable, session?.accessToken]);

  useEffect(() => {
    void loadRides();
  }, [loadRides]);

  useEffect(() => {
    const refreshAvailableAfterRequeue = () => {
      void loadRides();
    };

    window.addEventListener(RAPAGO_REQUEUED_RIDES_EVENT, refreshAvailableAfterRequeue as EventListener);
    window.addEventListener(DRIVER_SCHEDULED_RESERVATION_EVENT, refreshAvailableAfterRequeue as EventListener);
    window.addEventListener(DRIVER_ASSIGNED_SCHEDULED_RIDE_EVENT, refreshAvailableAfterRequeue as EventListener);
    window.addEventListener("rapago:driver-reservation-inbox-updated", refreshAvailableAfterRequeue as EventListener);
    window.addEventListener("rapago:admin-scheduled-rides-updated", refreshAvailableAfterRequeue as EventListener);
    window.addEventListener("rapago:driver-available-rides-updated", refreshAvailableAfterRequeue as EventListener);
    window.addEventListener("storage", refreshAvailableAfterRequeue);

    return () => {
      window.removeEventListener(RAPAGO_REQUEUED_RIDES_EVENT, refreshAvailableAfterRequeue as EventListener);
      window.removeEventListener(DRIVER_SCHEDULED_RESERVATION_EVENT, refreshAvailableAfterRequeue as EventListener);
      window.removeEventListener(DRIVER_ASSIGNED_SCHEDULED_RIDE_EVENT, refreshAvailableAfterRequeue as EventListener);
      window.removeEventListener("rapago:driver-reservation-inbox-updated", refreshAvailableAfterRequeue as EventListener);
      window.removeEventListener("rapago:admin-scheduled-rides-updated", refreshAvailableAfterRequeue as EventListener);
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

    if (!driverLocation) {
      setError("Activa tu ubicación real para tomar este viaje.");
      return;
    }

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

      publishDriverLiveLocationForPassenger(
        activeAccepted as DriverRideData,
        {
          lat: driverLocation.lat,
          lng: driverLocation.lng,
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
            lat: driverLocation.lat,
            lng: driverLocation.lng,
            updatedAt: new Date().toISOString(),
            ...getDriverVehiclePublicPayload(session?.user),
          }),
        );
      } catch {
        // No bloquea la aceptación del viaje.
      }

      removeRequeuedRide(rideId);
      setAvailableRides((prev) => removeHandledRideFromAvailableList(prev, activeAccepted as unknown as Record<string, unknown>));
      setAssignedRides([activeAccepted as DriverRideData]);

      // Forzamos recarga para traer notes/coordenadas completas y renderizar ruta.
      window.setTimeout(() => {
        void loadRides();
      }, 300);
    } catch (err) {
      const fallbackAvailable = getAvailableRideById(rideId, availableRides);

      if (
        fallbackAvailable &&
        driverLocation &&
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

        publishDriverLiveLocationForPassenger(
          activeAcceptedLocal,
          {
            lat: driverLocation.lat,
            lng: driverLocation.lng,
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
              lat: driverLocation.lat,
              lng: driverLocation.lng,
              updatedAt: new Date().toISOString(),
              ...getDriverVehiclePublicPayload(session?.user),
            }),
          );
        } catch {
          // No bloquea la aceptación local.
        }

        removeRequeuedRide(rideId);
        setAvailableRides((prev) => removeHandledRideFromAvailableList(prev, activeAcceptedLocal as unknown as Record<string, unknown>));
        setAssignedRides([activeAcceptedLocal]);
        setError(null);
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

      if (cashClosure) {
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
        setError("Viaje cerrado correctamente. Se activó tu próximo servicio aceptado.");
      } else {
        setAssignedRides((prev) => prev.filter((item) => item.id !== rideId));
        setError(null);
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
      prev.filter((item) => !wasDriverRideCancelledLocally(item as unknown as Record<string, unknown>, session?.user)),
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
            !wasDriverRideCancelledLocally(item as unknown as Record<string, unknown>, session?.user),
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

      clearDriverLiveLocationForPassenger(rideId);
      removeDriverActiveRideLocalMirror({ ...(ride as unknown as Record<string, unknown>), status: "cancelled", cancelledByRole: "driver_no_show" }, session?.user);
      setAssignedRides((prev) => prev.filter((item) => item.id !== rideId));

      if (session?.accessToken) {
        try {
          await ridesService.cancelAcceptedRide(session.accessToken, rideId);
        } catch {
          // El cargo local y el aviso al pasajero quedan guardados aunque el backend responda distinto.
        }
      }

      window.dispatchEvent(new CustomEvent("rapago:driver-rides-updated", { detail: { rideId, status: "cancelled", noShow: true, charge } }));
      setError(`No show registrado. Se notificó por app/WhatsApp y se aplicó cobro total del servicio: ${formatClp(Number(charge.amountClp ?? 0))}.`);
      window.setTimeout(() => void loadRides(), 450);
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

  async function handleRejectScheduledReservation(ride: DriverScheduledReservationOffer): Promise<void> {
    setAcceptingId(String(ride.id));
    setError(null);

    try {
      rejectDriverScheduledReservationLocally(ride, session?.user);
      setReservationOffers((prev) => prev.filter((item) => !isSameDriverAcceptedRide(item, ride)));
      setConfirmedReservationOffers((prev) => prev.filter((item) => !isSameDriverAcceptedRide(item, ride)));
      window.setTimeout(() => void loadRides(), 300);
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
          zIndex: 9999,
          background: "rgba(0,0,0,.58)",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          padding: "18px",
          pointerEvents: "auto",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 440,
            borderRadius: "28px",
            overflow: "hidden",
            background: "linear-gradient(145deg, #fff7dd 0%, #f6d98e 100%)",
            color: "#111",
            border: "2px solid rgba(255,255,255,.55)",
            boxShadow: "0 28px 80px rgba(0,0,0,.55)",
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

            <IonButton
              fill="clear"
              color="light"
              onClick={() => stopRideRequestAlert(true)}
              style={{ "--border-radius": "999px" } as CSSProperties}
            >
              <IonIcon icon={closeOutline} slot="icon-only" />
            </IonButton>
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
                <IonIcon icon={volumeHighOutline} />
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

            <div
              style={{
                borderRadius: "20px",
                background: "#fff",
                border: "1px solid rgba(210,164,58,.35)",
                padding: "14px",
              }}
            >
              <div style={{ display: "grid", gap: 10 }}>
                <div>
                  <div
                    style={{
                      color: "#22c55e",
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
                    background: "linear-gradient(180deg,#22c55e,#ef4444)",
                    borderRadius: 999,
                    marginLeft: 7,
                  }}
                />

                <div>
                  <div
                    style={{
                      color: "#ef4444",
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
                background: "rgba(17,17,17,.92)",
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
                    "--color": "#111",
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
        style={{
          margin: "0",
          borderRadius: "24px",
          overflow: "hidden",
          background: "linear-gradient(145deg,#111827 0%,#2A1A18 48%,#8F3F25 100%)",
          color: "#F6F2EC",
          border: "1px solid rgba(210,164,58,.46)",
          boxShadow: "0 18px 42px rgba(0,0,0,.34)",
        }}
      >
        <IonCardContent style={{ padding: 0 }}>
          <div
            style={{
              padding: "15px 16px",
              background: "linear-gradient(135deg,rgba(210,164,58,.25),rgba(255,255,255,.04))",
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
                  background: "rgba(210,164,58,.18)",
                  border: "1px solid rgba(210,164,58,.46)",
                  color: "#f8d879",
                  fontSize: ".68rem",
                  fontWeight: 950,
                  textTransform: "uppercase",
                  letterSpacing: ".05em",
                  marginBottom: 10,
                }}
              >
                📅 Viaje agendado asignado
              </div>

              <div style={{ fontWeight: 950, fontSize: "1.12rem", lineHeight: 1.15 }}>
                {getDriverRideRouteDisplayLabel(ride)}
              </div>
              <div
                style={{
                  marginTop: 6,
                  color: "rgba(246,242,236,.76)",
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
                background: "rgba(246,242,236,.96)",
                color: "#111",
                textAlign: "right",
                fontWeight: 950,
                boxShadow: "0 10px 26px rgba(0,0,0,.25)",
              }}
            >
              <div style={{ fontSize: ".64rem", color: "#8a6418", textTransform: "uppercase" }}>
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
                  background: "rgba(255,255,255,.08)",
                  border: "1px solid rgba(255,255,255,.10)",
                  padding: "11px 12px",
                }}
              >
                <div style={{ color: "#f8d879", fontSize: ".68rem", fontWeight: 950 }}>
                  RECOGIDA
                </div>
                <div style={{ marginTop: 4, fontWeight: 950, lineHeight: 1.25 }}>{scheduledText}</div>
              </div>

              <div
                style={{
                  borderRadius: 18,
                  background: "rgba(255,255,255,.08)",
                  border: "1px solid rgba(255,255,255,.10)",
                  padding: "11px 12px",
                }}
              >
                <div style={{ color: "#f8d879", fontSize: ".68rem", fontWeight: 950 }}>
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
                    "--border-color": "rgba(255,255,255,.72)",
                    height: "50px",
                    fontWeight: 950,
                  } as CSSProperties
                }
                onClick={() => void handleRejectScheduledReservation(ride)}
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
        style={{
          margin: "0",
          borderRadius: "22px",
          background: "linear-gradient(145deg,#F6F2EC 0%,#FFE8A3 100%)",
          color: "#111",
          border: "1px solid rgba(210,164,58,.62)",
          boxShadow: "0 14px 34px rgba(0,0,0,.22)",
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
              <div style={{ marginTop: 7, fontSize: ".82rem", fontWeight: 850, color: "rgba(17,17,17,.74)", lineHeight: 1.35 }}>
                Ya aceptaste esta reserva. Espera la hora indicada: te llegará una notificación para iniciar el viaje y se abrirá la ruta.
              </div>
            </div>
            <div style={{ minWidth: 82, textAlign: "right", fontWeight: 950 }}>
              <div style={{ color: "#8a6418", fontSize: ".66rem", textTransform: "uppercase" }}>Tarifa</div>
              <div style={{ fontSize: "1rem" }}>{formatClp(fareClp)}</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 13 }}>
            <div style={{ borderRadius: 16, background: "rgba(255,255,255,.70)", padding: "10px 11px" }}>
              <div style={{ fontSize: ".66rem", color: "#8a6418", fontWeight: 950 }}>RECOGIDA</div>
              <div style={{ marginTop: 3, fontWeight: 950 }}>{scheduledText}</div>
            </div>
            <div style={{ borderRadius: 16, background: "rgba(255,255,255,.70)", padding: "10px 11px" }}>
              <div style={{ fontSize: ".66rem", color: "#8a6418", fontWeight: 950 }}>AVISO PARA SALIR</div>
              <div style={{ marginTop: 3, fontWeight: 950 }}>{activationText}</div>
            </div>
          </div>

          {readyToStart ? (
            <div style={{ marginTop: 12 }}>
              <div style={{ marginBottom: 10, borderRadius: 16, background: "rgba(34,197,94,.16)", border: "1px solid rgba(34,197,94,.36)", padding: "10px 12px", fontWeight: 950, fontSize: ".82rem", lineHeight: 1.35, color: "#0F8A3A" }}>
                ✅ Reserva lista. Ya puedes iniciar la ruta hacia el pasajero.
              </div>
              <IonButton
                expand="block"
                color="warning"
                disabled={acceptingId === String(ride.id) || !isDriverAvailable}
                onClick={() => void handleStartReadyScheduledReservation(ride)}
                style={{ "--border-radius": "16px", height: "50px", fontWeight: 950, color: "#111" } as CSSProperties}
              >
                {acceptingId === String(ride.id) ? <IonSpinner name="dots" /> : "Iniciar viaje ahora"}
              </IonButton>
            </div>
          ) : (
            <div style={{ marginTop: 12, borderRadius: 16, background: "rgba(34,197,94,.14)", border: "1px solid rgba(34,197,94,.30)", padding: "10px 12px", fontWeight: 900, fontSize: ".80rem", lineHeight: 1.35 }}>
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
      <IonCard style={styles.card}>
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
                  background: "rgba(45,211,111,.18)",
                  border: "1px solid rgba(15,138,58,.22)",
                  color: "#0F8A3A",
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
                    background: "#22c55e",
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
                  color: "#111111",
                }}
              >
                Solicitud cercana
              </div>
              <div
                style={{
                  marginTop: 5,
                  color: "rgba(17,17,17,.66)",
                  fontSize: ".78rem",
                  lineHeight: 1.35,
                }}
              >
                Revisa origen, destino y pago antes de aceptar.
              </div>
            </div>

            <button
              type="button"
              onClick={() => dismissAvailableRide(ride)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,.16)",
                background: "rgba(255,255,255,.08)",
                color: "#111111",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
              aria-label="Cerrar solicitud"
            >
              <IonIcon icon={closeOutline} style={{ fontSize: 20 }} />
            </button>
          </div>

          {/* Chips */}
          <div
            style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}
          >
            <div style={styles.pill}>
              <IonIcon
                icon={timeOutline}
                style={{ fontSize: 15, color: "#ffd33d" }}
              />
              Ahora
            </div>
            <div style={styles.pill}>
              <IonIcon
                icon={carOutline}
                style={{ fontSize: 15, color: "#0F8A3A" }}
              />
              {rideVehicleEmoji} {rideVehicleShortLabel}
            </div>
            <div style={styles.pill}>
              {tripTypeEmoji} {tripTypeLabel}
            </div>
            <div style={styles.pill}>
              <IonIcon
                icon={paymentLabel === "ProntoPaga" ? cardOutline : cashOutline}
                style={{
                  fontSize: 15,
                  color: paymentLabel === "ProntoPaga" ? "#2563eb" : "#22c55e",
                }}
              />
              {paymentIcon} {paymentLabel}
            </div>
            <div style={styles.pill}>
              <IonIcon
                icon={starOutline}
                style={{ fontSize: 15, color: "#ffd33d" }}
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
              <div style={{ ...styles.routeDot, background: "#22c55e" }} />
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    color: "#22c55e",
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
                    color: "#111111",
                  }}
                >
                  {getDriverRidePointDisplayLabel(ride, "origin")}
                </div>
                <div
                  style={{
                    color: "rgba(17,17,17,.66)",
                    fontSize: ".78rem",
                    marginTop: 5,
                    lineHeight: 1.35,
                  }}
                >
                  <IonIcon
                    icon={walkOutline}
                    style={{
                      fontSize: 14,
                      marginRight: 4,
                      verticalAlign: "-2px",
                      color: "#d2a43a",
                    }}
                  />
                  {pickupWalkText}
                </div>
              </div>

              <div
                style={{
                  width: 2,
                  height: 34,
                  background: "linear-gradient(180deg, #22c55e, #ef4444)",
                  marginLeft: 6,
                  borderRadius: 999,
                }}
              />
              <div />

              <div style={{ ...styles.routeDot, background: "#ef4444" }} />
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    color: "#ef4444",
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
                    color: "#111111",
                  }}
                >
                  {getDriverRidePointDisplayLabel(ride, "destination")}
                </div>
              </div>
            </div>
          </div>

          {/* Resumen precio */}
          <div
            style={{
              marginTop: 14,
              padding: "14px 15px",
              borderRadius: "20px",
              background:
                "linear-gradient(135deg, rgba(34,197,94,.16), rgba(210,164,58,.20))",
              border: "1px solid rgba(15,138,58,.22)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div>
              <div
                style={{
                  color: "rgba(17,17,17,.62)",
                  fontSize: ".72rem",
                  fontWeight: 900,
                }}
              >
                PRECIO DEL VIAJE
              </div>
              <div
                style={{
                  color: "#0F8A3A",
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
                  color: "rgba(17,17,17,.66)",
                  fontSize: ".74rem",
                  marginTop: 4,
                  fontWeight: 800,
                }}
              >
                {paymentIcon} Método de pago: {paymentLabel}
              </div>
              <div
                style={{
                  color: "rgba(17,17,17,.72)",
                  fontSize: ".74rem",
                  marginTop: 3,
                  fontWeight: 900,
                }}
              >
                {rideVehicleEmoji} Vehículo: {rideVehicleLabel}
              </div>
              <div
                style={{
                  color: "rgba(17,17,17,.72)",
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
                    color: "rgba(17,17,17,.62)",
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
                background: "rgba(15,138,58,.10)",
                border: "1px solid rgba(15,138,58,.20)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#0F8A3A",
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

    // El mapa debe quedar visible: los botones de acción van debajo,
    // no encima del mapa. En celular se reduce la altura para que
    // "Llegué al punto / Cancelar" quede siempre a la vista.
    const activeMapHeight =
      typeof window !== "undefined"
        ? Math.max(310, Math.min(430, window.innerHeight - 280))
        : 390;

    const activeRideWaitingPassenger = ride.status === "driver_arrived";
    const [activeRideNoShowNowMs, setActiveRideNoShowNowMs] = useState(() => Date.now());

    useEffect(() => {
      if (!activeRideWaitingPassenger) return;

      const interval = window.setInterval(() => setActiveRideNoShowNowMs(Date.now()), 1000);
      return () => window.clearInterval(interval);
    }, [activeRideWaitingPassenger, ride.id]);

    const driverNoShowState = getDriverNoShowState(
      ride as DriverRideData & Record<string, unknown>,
      activeRideNoShowNowMs,
    );

    return (
      <div
        style={{
          minHeight: "100%",
          background: "#0f1115",
          margin: "-16px",
          color: "#F6F2EC",
          display: "flex",
          flexDirection: "column",
          paddingBottom: 92,
        }}
      >
        <div style={{ flex: "0 0 auto", position: "relative", minHeight: activeMapHeight }}>
          <UberDriverNavigationMap
            ride={ride}
            height={activeMapHeight}
            driverUser={session?.user}
          />
        </div>

        {/* Panel de acciones separado del mapa: visible pero sin tapar la navegación */}
        <div style={{ padding: "12px 14px 18px", flex: "0 0 auto" }}>
          <div
            style={{
              position: "relative",
              zIndex: 3,
              pointerEvents: "auto",
              ...uberPanelStyle({
                padding: 16,
                borderRadius: "22px",
              }),
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 999,
                  background: "#22c55e",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <IonIcon
                  icon={checkmarkCircleOutline}
                  style={{ fontSize: 28, color: "#fff" }}
                />
              </div>
              <div>
                <div style={{ fontWeight: 950, fontSize: "1.1rem" }}>
                  {statusText}
                </div>
                <div
                  style={{
                    color: "rgba(246,242,236,.68)",
                    fontSize: ".82rem",
                    marginTop: 2,
                  }}
                >
                  {ride.status === "in_progress"
                    ? getDriverRidePointDisplayLabel(ride, "destination")
                    : getDriverRidePointDisplayLabel(ride, "origin")}
                </div>
              </div>
            </div>

            {nextQueuedRide && (
              <div
                style={{
                  marginBottom: 12,
                  borderRadius: 16,
                  background: "rgba(250,204,21,.16)",
                  border: "1px solid rgba(250,204,21,.45)",
                  padding: "10px 12px",
                  color: "#fff7cc",
                  fontWeight: 900,
                  lineHeight: 1.35,
                }}
              >
                <div style={{ fontSize: ".80rem", opacity: .86 }}>Próximo servicio aceptado</div>
                <div style={{ fontSize: ".92rem", marginTop: 2 }}>
                  {nextQueuedRide.originText} → {nextQueuedRide.destinationText}
                </div>
                <div style={{ fontSize: ".74rem", opacity: .78, marginTop: 3 }}>
                  Se activará automáticamente cuando confirmes que llegaste al destino actual.
                </div>
              </div>
            )}

            {!nextQueuedRide && nextOfferWhileActive && (
              <div
                style={{
                  marginBottom: 12,
                  borderRadius: 16,
                  background: "rgba(59,130,246,.16)",
                  border: "1px solid rgba(59,130,246,.42)",
                  padding: "10px 12px",
                  color: "#dbeafe",
                  fontWeight: 900,
                  lineHeight: 1.35,
                }}
              >
                <div style={{ fontSize: ".78rem", opacity: .86 }}>Nuevo servicio para continuar</div>
                <div style={{ fontSize: ".92rem", marginTop: 2 }}>
                  {nextOfferWhileActive.originText} → {nextOfferWhileActive.destinationText}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "0.85fr 1.15fr", gap: 8, marginTop: 9 }}>
                  <IonButton
                    size="small"
                    fill="outline"
                    color="light"
                    disabled={acceptingId === nextOfferWhileActive.id}
                    onClick={() => dismissAvailableRide(nextOfferWhileActive)}
                    style={{ "--border-radius": "999px", fontWeight: 950 } as CSSProperties}
                  >
                    Rechazar
                  </IonButton>
                  <IonButton
                    size="small"
                    color="warning"
                    disabled={acceptingId === nextOfferWhileActive.id || !driverLocation}
                    onClick={() => void handleAcceptRide(nextOfferWhileActive.id)}
                    style={{ "--border-radius": "999px", "--color": "#111", fontWeight: 950 } as CSSProperties}
                  >
                    {acceptingId === nextOfferWhileActive.id ? <IonSpinner name="dots" /> : "Aceptar próximo"}
                  </IonButton>
                </div>
              </div>
            )}

            {ride.status === "driver_arrived" && (
              <>
                <style>{`@keyframes rapago-driver-waiting-pulse { 0% { opacity: .62; transform: scale(.985); } 50% { opacity: 1; transform: scale(1); } 100% { opacity: .62; transform: scale(.985); } }
.rapago-driver-light-form,
.rapago-driver-light-panel,
.rapago-driver-light-card,
.rapago-driver-light-form ion-card,
.rapago-driver-light-form ion-item,
.rapago-driver-light-form ion-input,
.rapago-driver-light-form ion-textarea,
.rapago-driver-light-form ion-select {
  --background: #fffaf0 !important;
  --color: #111827 !important;
  color: #111827 !important;
}
.rapago-driver-light-form ion-item,
.rapago-driver-light-form .item-native {
  --background: #fffaf0 !important;
  --border-color: rgba(214,166,64,.35) !important;
}
.rapago-driver-light-form ion-label,
.rapago-driver-light-form ion-note,
.rapago-driver-light-form p,
.rapago-driver-light-form div,
.rapago-driver-light-form span {
  color: #111827;
}
.rapago-driver-light-form input,
.rapago-driver-light-form textarea {
  color: #111827 !important;
}
`}</style>
                <div
                  style={{
                    marginBottom: 10,
                    padding: "10px 12px",
                    borderRadius: 14,
                    background: "rgba(34,197,94,.18)",
                    border: "1px solid rgba(34,197,94,.58)",
                    color: "#bbf7d0",
                    fontWeight: 950,
                    textAlign: "center",
                    animation: "rapago-driver-waiting-pulse 1.15s ease-in-out infinite",
                  }}
                >
                  Estado: esperando pasajero en el punto
                </div>
                <div
                  style={{
                    margin: "0 0 12px",
                    padding: "12px 13px",
                    borderRadius: 18,
                    background: driverNoShowState.allowed
                      ? "linear-gradient(135deg, rgba(250,204,21,.22), rgba(245,158,11,.16))"
                      : "linear-gradient(135deg, rgba(15,23,42,.72), rgba(30,41,59,.72))",
                    border: driverNoShowState.allowed
                      ? "1px solid rgba(250,204,21,.45)"
                      : "1px solid rgba(148,163,184,.22)",
                    color: "#ffffff",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 10,
                      fontWeight: 950,
                      fontSize: ".86rem",
                    }}
                  >
                    <span>Espera para No show</span>
                    <span>
                      {driverNoShowState.allowed
                        ? "Listo"
                        : formatDriverNoShowRemaining(driverNoShowState.remainingMs)}
                    </span>
                  </div>

                  <div
                    style={{
                      marginTop: 9,
                      height: 8,
                      borderRadius: 999,
                      overflow: "hidden",
                      background: "rgba(255,255,255,.16)",
                    }}
                  >
                    <div
                      style={{
                        width: `${getDriverNoShowProgressPercent(driverNoShowState)}%`,
                        height: "100%",
                        borderRadius: 999,
                        background: driverNoShowState.allowed
                          ? "linear-gradient(90deg,#facc15,#22c55e)"
                          : "linear-gradient(90deg,#38bdf8,#facc15)",
                        transition: "width .35s ease",
                      }}
                    />
                  </div>

                  <div
                    style={{
                      marginTop: 7,
                      fontSize: ".72rem",
                      fontWeight: 850,
                      opacity: .86,
                    }}
                  >
                    {driverNoShowState.allowed
                      ? "Ya puedes marcar No show si el pasajero no aparece."
                      : "El botón se habilita automáticamente al cumplir 5 minutos."}
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                  }}
                >
                  <IonButton
                    expand="block"
                    color="success"
                    style={
                      { "--border-radius": "14px", height: "52px" } as CSSProperties
                    }
                    onClick={() => void handleStartRide(ride.id)}
                  >
                    Iniciar viaje
                  </IonButton>

                  <IonButton
                    expand="block"
                    color="warning"
                    disabled={!driverNoShowState.allowed}
                    style={
                      {
                        "--border-radius": "14px",
                        height: "52px",
                        "--color": driverNoShowState.allowed ? "#111111" : "#ffffff",
                        "--background": driverNoShowState.allowed ? undefined : "rgba(71,85,105,.75)",
                        opacity: driverNoShowState.allowed ? 1 : .68,
                        position: "relative",
                        zIndex: 31,
                      } as CSSProperties
                    }
                    onClick={() => void handleDriverNoShowRide(ride)}
                  >
                    {driverNoShowState.allowed ? `No show · Total ${formatClp(driverNoShowState.feeClp)}` : `Espera ${formatDriverNoShowRemaining(driverNoShowState.remainingMs)}`}
                  </IonButton>

                  <IonButton
                    expand="block"
                    fill="outline"
                    color="light"
                    style={
                      {
                        "--border-radius": "14px",
                        height: "52px",
                        position: "relative",
                        zIndex: 31,
                        gridColumn: "1 / -1",
                      } as CSSProperties
                    }
                    onClick={() => requestCancelActiveRide(ride)}
                  >
                    Cancelar
                  </IonButton>
                </div>
              </>
            )}

            {ride.status === "in_progress" && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                <IonButton
                  expand="block"
                  color="success"
                  style={
                    { "--border-radius": "14px", height: "52px" } as CSSProperties
                  }
                  onClick={() => requestCompleteRide(ride)}
                >
                  Finalizar viaje
                </IonButton>

                <IonButton
                  expand="block"
                  fill="outline"
                  color="light"
                  style={
                    {
                      "--border-radius": "14px",
                      height: "52px",
                      position: "relative",
                      zIndex: 31,
                    } as CSSProperties
                  }
                  onClick={() => requestCancelActiveRide(ride)}
                >
                  Cancelar
                </IonButton>
              </div>
            )}

            {["accepted", "driver_en_route"].includes(ride.status) && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                <IonButton
                  expand="block"
                  color="success"
                  style={
                    {
                      "--border-radius": "14px",
                      height: "52px",
                    } as CSSProperties
                  }
                  onClick={() => void handleArrivedSmart(ride)}
                >
                  Llegué al punto
                </IonButton>

                <IonButton
                  expand="block"
                  fill="outline"
                  color="light"
                  style={
                    {
                      "--border-radius": "14px",
                      height: "52px",
                      position: "relative",
                      zIndex: 31,
                    } as CSSProperties
                  }
                  onClick={() => requestCancelActiveRide(ride)}
                >
                  Cancelar
                </IonButton>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="success">
          <IonTitle>{activeRide ? "Viaje activo" : showOnlyReservations ? "Reservas" : "Solicitudes"}</IonTitle>
          <div slot="end" style={{ paddingRight: 8 }}>
            {!activeRide && (
              <IonButton
                fill="clear"
                color="light"
                onClick={() => void loadRides()}
                disabled={loading}
              >
                <IonIcon icon={refreshOutline} slot="icon-only" />
              </IonButton>
            )}
          </div>
        </IonToolbar>
        {!activeRide && (
          <IonToolbar
            style={
              {
                "--background": "linear-gradient(135deg, #1f1f1f, #8f3f25)",
                "--border-width": "0",
              } as CSSProperties
            }
          >
            <div style={{ padding: "9px 16px 12px", color: "#F6F2EC" }}>
              <div style={{ fontWeight: 950, fontSize: ".92rem" }}>
                {showOnlyReservations ? "Reservas asignadas" : "Viajes disponibles"}
              </div>
              <div
                style={{
                  color: "rgba(246,242,236,.62)",
                  fontSize: ".74rem",
                  marginTop: 2,
                }}
              >
                {showOnlyReservations
                  ? "Acepta o rechaza solo las reservas que te asignó el administrador."
                  : isDriverAvailable
                    ? "Acepta solo cuando puedas iniciar la ruta."
                    : "Estás no disponible. No se cargarán solicitudes nuevas."}
              </div>
            </div>
          </IonToolbar>
        )}
      </IonHeader>

      <IonContent
        className={activeRide ? "" : "ion-padding"}
        style={
          {
            "--background":
              "linear-gradient(180deg, rgba(246,242,236,.86), rgba(217,195,160,.72)), url('/assets/rapa-go-bg.jpg') center/cover no-repeat",
          } as CSSProperties
        }
      >
        {activeRide ? (
          <ActiveRideScreen ride={activeRide} />
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
                style={{
                  margin: "0 0 14px",
                  borderRadius: "18px",
                  background: "#fff3cd",
                  color: "#111",
                  border: "1px solid rgba(210,164,58,.45)",
                }}
              >
                <IonCardContent
                  style={{
                    padding: "12px 14px",
                    fontWeight: 900,
                    fontSize: ".82rem",
                  }}
                >
                  📍 {locationError}
                </IonCardContent>
              </IonCard>
            )}

            {!loading && !showOnlyReservations && !isDriverAvailable && displayedAvailableRides.length === 0 && (
              <IonCard
                style={{
                  margin: "10px 0 14px",
                  borderRadius: "22px",
                  background: "linear-gradient(135deg,#2A1A18,#8F3F25)",
                  color: "#F6F2EC",
                  border: "1px solid rgba(255,255,255,.10)",
                  boxShadow: "0 16px 34px rgba(0,0,0,.24)",
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
                    color: "#2A1A18",
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
                    color: "#2A1A18",
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
                  paddingBottom: 90,
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
                  zIndex: 10000,
                  background: "rgba(0,0,0,.58)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 16,
                }}
              >
                <div
                  style={{
                    width: "min(430px, 100%)",
                    borderRadius: 22,
                    overflow: "hidden",
                    background: "linear-gradient(180deg,#fff3c4,#f6d56e)",
                    color: "#111",
                    boxShadow: "0 24px 60px rgba(0,0,0,.45)",
                    border: "1px solid rgba(255,255,255,.75)",
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
                      📅
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 950, fontSize: "1.08rem" }}>
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
                      ×
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
                      <span style={{ border: "1px solid rgba(210,164,58,.45)", borderRadius: 999, padding: "7px 10px", fontWeight: 950 }}>📅 Reserva lista</span>
                      <span style={{ border: "1px solid rgba(34,197,94,.35)", borderRadius: 999, padding: "7px 10px", fontWeight: 950 }}>🚕 Estándar</span>
                      <span style={{ border: "1px solid rgba(210,164,58,.45)", borderRadius: 999, padding: "7px 10px", fontWeight: 950 }}>💵 Efectivo</span>
                    </div>

                    <div
                      style={{
                        background: "#fff",
                        borderRadius: 18,
                        padding: 16,
                        marginBottom: 14,
                        boxShadow: "inset 0 0 0 1px rgba(0,0,0,.04)",
                      }}
                    >
                      <div style={{ color: "#22c55e", fontSize: ".70rem", fontWeight: 950, textTransform: "uppercase" }}>
                        Ve a buscar al usuario
                      </div>
                      <div style={{ marginTop: 5, fontSize: "1rem", fontWeight: 950 }}>
                        {String(scheduledReservationReadyAlert.originText ?? "Punto de recogida")}
                      </div>
                      <div style={{ width: 2, height: 28, background: "linear-gradient(#22c55e,#ef4444)", margin: "10px 0 10px 10px" }} />
                      <div style={{ color: "#ef4444", fontSize: ".70rem", fontWeight: 950, textTransform: "uppercase" }}>
                        Destino del pasajero
                      </div>
                      <div style={{ marginTop: 5, fontSize: "1rem", fontWeight: 950 }}>
                        {String(scheduledReservationReadyAlert.destinationText ?? "Destino")}
                      </div>
                    </div>

                    <div
                      style={{
                        background: "#17120f",
                        color: "#fff",
                        borderRadius: 16,
                        padding: "13px 14px",
                        marginBottom: 14,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <div style={{ fontSize: ".72rem", fontWeight: 950, color: "#f6d56e" }}>
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
                        style={{ "--border-radius": "14px", fontWeight: 950, color: "#111" } as CSSProperties}
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

      <style>{`.rapago-danger-alert { --background: #2A1A18; --color: #ffffff; --button-color: #ff6467; } .rapago-danger-alert .alert-title { color: #fecaca; font-weight: 950; } .rapago-danger-alert .alert-message { color: rgba(255,255,255,.82); } .rapago-complete-alert { --background: #F6F2EC; --color: #111111; } .rapago-complete-alert .alert-title { color: #14532d; font-weight: 950; } .rapago-passenger-cancel-alert {
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
  content: "⚠️";
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
    </IonPage>
  );
}

export function DriverTripsPage(): JSX.Element {
  return (
    <>
      <DriverMyRidesPage />
      <DriverGlobalRideAlert />
    </>
  );
}

function DriverHistoryRideCard({
  ride,
  onRate,
  alreadyRated,
}: {
  ride: {
    id: string;
    originText: string;
    destinationText: string;
    status: string;
    estimatedFareClp?: number | null;
    acceptedAt?: string | null;
    completedAt?: string | null;
    cancelledAt?: string | null;
  };
  onRate: () => void;
  alreadyRated: boolean;
}): JSX.Element {
  const label =
    ride.status === "completed"
      ? "Completado"
      : ride.status === "cancelled"
        ? "Cancelado"
        : ride.status;

  const displayFareClp = getRideDisplayFareClp(ride as RideWithFarePayload);
  const paymentLabel = getRidePaymentMethodLabel(
    (ride as { notes?: string | null }).notes,
  );
  const rideVehicleCategory = getRideVehicleCategory(
    ride as RideWithFarePayload,
  );
  const rideVehicleLabel = getRideVehicleLabel(rideVehicleCategory);
  const rideVehicleEmoji = getRideVehicleEmoji(rideVehicleCategory);

  return (
    <IonCard
      style={{
        margin: 0,
        borderRadius: "18px",
        background: "#F6F2EC",
        color: "#111111",
        border: "1px solid rgba(0,0,0,.08)",
      }}
    >
      <IonCardContent style={{ padding: "14px" }}>
        <div
          style={{ display: "flex", justifyContent: "space-between", gap: 10 }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 900, fontSize: ".92rem" }}>
              {getDriverRideRouteDisplayLabel(ride)}
            </div>

            <IonBadge
              color={ride.status === "completed" ? "medium" : "danger"}
              style={{ marginTop: 6 }}
            >
              {label}
            </IonBadge>

            {displayFareClp != null && (
              <div
                style={{ marginTop: 8, fontWeight: 800, fontSize: ".82rem" }}
              >
                Precio: {formatClp(displayFareClp)} · Pago: {paymentLabel}
                {((ride as unknown as Record<string, unknown>).cashPaymentConfirmedByDriver === true || (ride as unknown as Record<string, unknown>).cashPaymentClosure) && (
                  <>
                    <br />
                    Efectivo recibido: {formatClp(Number((ride as unknown as Record<string, unknown>).cashPaidClp ?? (ride as unknown as Record<string, unknown>).paymentReceivedByDriverClp ?? 0))}
                    {Number((ride as unknown as Record<string, unknown>).cashOverpaidClp ?? 0) > 0 && ` · Pagó demás: ${formatClp(Number((ride as unknown as Record<string, unknown>).cashOverpaidClp))}`}
                  </>
                )}
              </div>
            )}

            {ride.completedAt && (
              <div style={{ marginTop: 4, color: "#666", fontSize: ".74rem" }}>
                Completado: {new Date(ride.completedAt).toLocaleString("es-CL")}
              </div>
            )}

            {ride.cancelledAt && (
              <div style={{ marginTop: 4, color: "#666", fontSize: ".74rem" }}>
                Cancelado: {new Date(ride.cancelledAt).toLocaleString("es-CL")}
              </div>
            )}
          </div>

          {ride.status === "completed" && !alreadyRated && (
            <IonButton
              size="small"
              fill="outline"
              color="warning"
              onClick={onRate}
            >
              Calificar
            </IonButton>
          )}
        </div>
      </IonCardContent>
    </IonCard>
  );
}

function DriverMyRidesPage(): JSX.Element {
  const { session } = useAuth();
  type DriverRideData =
    import("../../features/rides/rides.service").DriverRideData;

  const [rides, setRides] = useState<DriverRideData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [completeConfirmRide, setCompleteConfirmRide] = useState<DriverRideData | null>(null);

  const loadRides = useCallback(async () => {
    if (!session?.accessToken) return;

    setLoading(true);
    setLoadError(null);

    try {
      const data = await ridesService.listDriverRides(session.accessToken);
      setRides(data);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Error al cargar tus viajes.",
      );
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    void loadRides();
  }, [loadRides]);

  const activeRide = rides.find((ride) =>
    ["accepted", "driver_en_route", "driver_arrived", "in_progress"].includes(
      ride.status,
    ) && !wasDriverRideCancelledLocally(ride as unknown as Record<string, unknown>, session?.user),
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

      if (cashClosure) {
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
      if (!nextActive) await loadRides();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "No se pudo finalizar el viaje.");
    } finally {
      setActionLoading(null);
      setCompleteConfirmRide(null);
    }
  }

  function statusLabel(status: string): string {
    if (status === "accepted") return "Aceptado";
    if (status === "driver_en_route") return "En camino";
    if (status === "driver_arrived") return "Llegué";
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

      clearDriverLiveLocationForPassenger(rideId);
      removeDriverActiveRideLocalMirror(
        {
          ...(ride as unknown as Record<string, unknown>),
          status: "cancelled",
          cancelledByRole: "driver_no_show",
          cancelledBy: "driver",
          cancellationReason: "No show registrado por conductor.",
        },
        session?.user,
      );

      setRides((prev) => prev.filter((item) => item.id !== rideId));

      if (session?.accessToken) {
        try {
          await ridesService.cancelAcceptedRide(session.accessToken, rideId);
        } catch {
          // El cargo local y el aviso al pasajero quedan guardados aunque el backend responda distinto.
        }
      }

      window.dispatchEvent(
        new CustomEvent("rapago:driver-rides-updated", {
          detail: { rideId, status: "cancelled", noShow: true, charge },
        }),
      );

      setLoadError(`No show registrado. Se notificó por app/WhatsApp y se aplicó cobro total del servicio: ${formatClp(Number(charge.amountClp ?? 0))}.`);
      window.setTimeout(() => void loadRides(), 450);
    } finally {
      setActionLoading(null);
    }
  }


  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="success">
          <IonTitle>Mis Viajes</IonTitle>
        </IonToolbar>
      </IonHeader>

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
            style={{
              margin: "0 0 14px",
              borderRadius: "22px",
              overflow: "hidden",
              background: "#F6F2EC",
              border: "2px solid rgba(45,211,111,.55)",
            }}
          >
            <IonCardContent style={{ padding: "12px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "10px",
                  marginBottom: "10px",
                }}
              >
                <div>
                  <div
                    style={{
                      fontWeight: 950,
                      fontSize: "1.08rem",
                      color: "#111",
                    }}
                  >
                    Viaje activo
                  </div>
                  <div
                    style={{
                      color: "#333",
                      fontSize: ".78rem",
                      fontWeight: 800,
                      marginTop: 2,
                    }}
                  >
                    {activeRide.status === "in_progress"
                      ? "Guía al pasajero al destino"
                      : "Primero ve al punto de recogida"}
                  </div>
                </div>

                <IonBadge color="success">
                  {statusLabel(activeRide.status)}
                </IonBadge>
              </div>

              <div
                style={{
                  borderRadius: "18px",
                  overflow: "hidden",
                  border: "1px solid rgba(0,0,0,.1)",
                  background: "#111827",
                }}
              >
                <UberDriverNavigationMap
                  ride={activeRide}
                  height={320}
                  driverUser={session?.user}
                />
              </div>

              <div style={{ marginTop: "12px", color: "#111" }}>
                <div style={{ fontWeight: 900, fontSize: ".92rem" }}>
                  {activeRide.originText} → {activeRide.destinationText}
                </div>

                {getRideDisplayFareClp(activeRide) != null && (
                  <div
                    style={{ marginTop: 6, color: "#C89B3C", fontWeight: 950 }}
                  >
                    Precio: {formatClp(getRideDisplayFareClp(activeRide))} ·
                    Pago: {getRidePaymentMethodLabel(activeRide.notes)}
                  </div>
                )}

                <div
                  style={{
                    marginTop: 4,
                    color: "#333",
                    fontSize: ".82rem",
                    fontWeight: 900,
                  }}
                >
                  Vehículo:{" "}
                  {getRideVehicleEmoji(
                    getRideVehicleCategory(activeRide as RideWithFarePayload),
                  )}{" "}
                  {getRideVehicleLabel(
                    getRideVehicleCategory(activeRide as RideWithFarePayload),
                  )}
                </div>

                {getCleanRideNote(activeRide.notes) && (
                  <div
                    style={{
                      marginTop: 6,
                      color: "#333",
                      fontSize: ".78rem",
                      fontWeight: 800,
                      lineHeight: 1.35,
                    }}
                  >
                    {getCleanRideNote(activeRide.notes)}
                  </div>
                )}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "10px",
                  marginTop: "14px",
                }}
              >
                {activeRide.status === "accepted" && (
                  <IonButton
                    expand="block"
                    color="success"
                    disabled={actionLoading === activeRide.id}
                    onClick={() =>
                      void runRideAction(activeRide.id, async () => {
                        const nav = extractRideNavigationPoints(
                          activeRide.notes,
                        );
                        if (nav.pickupLat != null && nav.pickupLng != null) {
                          getCurrentLocationForNavigation({
                            lat: nav.pickupLat,
                            lng: nav.pickupLng,
                          });
                        }

                        return ridesService.markEnRoute(
                          session!.accessToken,
                          activeRide.id,
                        );
                      })
                    }
                  >
                    {actionLoading === activeRide.id ? (
                      <IonSpinner name="dots" />
                    ) : (
                      "Comenzar ruta"
                    )}
                  </IonButton>
                )}

                {activeRide.status === "driver_en_route" && (
                  <IonButton
                    expand="block"
                    color="success"
                    disabled={actionLoading === activeRide.id}
                    onClick={() =>
                      void runRideAction(activeRide.id, () =>
                        ridesService.markArrived(
                          session!.accessToken,
                          activeRide.id,
                        ),
                      )
                    }
                  >
                    {actionLoading === activeRide.id ? (
                      <IonSpinner name="dots" />
                    ) : (
                      "Llegué"
                    )}
                  </IonButton>
                )}

                {activeRide.status === "driver_arrived" && (
                  <>
                    <IonButton
                      expand="block"
                      color="success"
                      disabled={actionLoading === activeRide.id}
                      onClick={() =>
                        void runRideAction(activeRide.id, () =>
                          ridesService.startRide(
                            session!.accessToken,
                            activeRide.id,
                          ),
                        )
                      }
                    >
                      {actionLoading === activeRide.id ? (
                        <IonSpinner name="dots" />
                      ) : (
                        "Iniciar viaje"
                      )}
                    </IonButton>

                    <IonButton
                      expand="block"
                      color="warning"
                      disabled={actionLoading === activeRide.id || !getDriverNoShowState(activeRide as DriverRideData & Record<string, unknown>).allowed}
                      onClick={() => void handleDriverNoShowRide(activeRide)}
                    >
                      {actionLoading === activeRide.id ? <IonSpinner name="dots" /> : getDriverNoShowState(activeRide as DriverRideData & Record<string, unknown>).allowed ? `No show · Total ${formatClp(getDriverNoShowState(activeRide as DriverRideData & Record<string, unknown>).feeClp)}` : `Espera ${formatDriverNoShowRemaining(getDriverNoShowState(activeRide as DriverRideData & Record<string, unknown>).remainingMs)}`}
                    </IonButton>
                  </>
                )}

                {activeRide.status === "in_progress" && (
                  <IonButton
                    expand="block"
                    color="success"
                    disabled={actionLoading === activeRide.id}
                    onClick={() => setCompleteConfirmRide(activeRide)}
                  >
                    {actionLoading === activeRide.id ? (
                      <IonSpinner name="dots" />
                    ) : (
                      "Finalizar"
                    )}
                  </IonButton>
                )}

                {["accepted", "driver_en_route", "driver_arrived", "in_progress"].includes(
                  activeRide.status,
                ) && (
                  <IonButton
                    expand="block"
                    fill="outline"
                    color="danger"
                    disabled={actionLoading === activeRide.id}
                    onClick={() => {
                      void cancelActiveRideFromMyRides(activeRide);
                    }}
                  >
                    {actionLoading === activeRide.id ? <IonSpinner name="dots" /> : "Cancelar"}
                  </IonButton>
                )}
              </div>
            </IonCardContent>
          </IonCard>
        )}

        {!loading && !activeRide && historyRides.length === 0 && (
          <IonText color="medium">
            <p>No tienes viajes todavía.</p>
          </IonText>
        )}

        {!loading && !activeRide && historyRides.length > 0 && (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            {historyRides.map((ride) => {
              const rideVehicleCategory = getRideVehicleCategory(ride as RideWithFarePayload);
              const rideVehicleLabel = getRideVehicleLabel(rideVehicleCategory);
              const rideVehicleEmoji = getRideVehicleEmoji(rideVehicleCategory);

              return (
                <IonCard
                  key={ride.id}
                  style={{
                    margin: 0,
                    borderRadius: "16px",
                    background: "#F6F2EC",
                  }}
                >
                  <IonCardContent style={{ padding: "14px" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "8px",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 900, color: "#111" }}>
                          {getDriverRideRouteDisplayLabel(ride)}
                        </div>
                        <IonBadge
                          color={
                            ride.status === "completed" ? "medium" : "danger"
                          }
                          style={{ marginTop: 6 }}
                        >
                          {statusLabel(ride.status)}
                        </IonBadge>
                        {getRideDisplayFareClp(ride) != null && (
                          <div
                            style={{
                              marginTop: 8,
                              color: "#333",
                              fontSize: ".82rem",
                            }}
                          >
                            Precio: {formatClp(getRideDisplayFareClp(ride))} ·
                            Pago: {getRidePaymentMethodLabel(ride.notes)}
                            {((ride as unknown as Record<string, unknown>).cashPaymentConfirmedByDriver === true || (ride as unknown as Record<string, unknown>).cashPaymentClosure) && (
                              <>
                                <br />
                                Efectivo recibido: {formatClp(Number((ride as unknown as Record<string, unknown>).cashPaidClp ?? (ride as unknown as Record<string, unknown>).paymentReceivedByDriverClp ?? 0))}
                                {Number((ride as unknown as Record<string, unknown>).cashOverpaidClp ?? 0) > 0 && ` · Pagó demás: ${formatClp(Number((ride as unknown as Record<string, unknown>).cashOverpaidClp))}`}
                              </>
                            )}
                            <br />
                            Vehículo: {rideVehicleEmoji} {rideVehicleLabel}
                          </div>
                        )}
                      </div>
                    </div>
                  </IonCardContent>
                </IonCard>
              );
            })}
          </div>

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
    </IonPage>
  );
}

export function DriverEarningsPage(): JSX.Element {
  const m = meta("/driver/earnings");
  const { session } = useAuth();
  const [rides, setRides] = useState<DriverEarningsRide[]>([]);
  const [filter, setFilter] = useState<DriverEarningsFilter>("today");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadEarnings = useCallback(async () => {
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
      setLoading(false);
    }
  }, [session?.accessToken, session?.user]);

  useEffect(() => {
    void loadEarnings();
  }, [loadEarnings]);

  useEffect(() => {
    const refresh = () => void loadEarnings();
    window.addEventListener("rapago:driver-rides-updated", refresh as EventListener);
    window.addEventListener("rapago:passenger-rides-updated", refresh as EventListener);
    window.addEventListener("storage", refresh as EventListener);
    return () => {
      window.removeEventListener("rapago:driver-rides-updated", refresh as EventListener);
      window.removeEventListener("rapago:passenger-rides-updated", refresh as EventListener);
      window.removeEventListener("storage", refresh as EventListener);
    };
  }, [loadEarnings]);

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
      <IonPage>
      <IonHeader>
        <IonToolbar color="success">
          <IonTitle>{m.label}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent
        className="ion-padding"
        style={
          {
            "--background":
              "linear-gradient(180deg, rgba(15,15,15,.82), rgba(15,15,15,.96)), url('/assets/rapa-go-bg.jpg') center/cover no-repeat",
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
          style={{
            margin: 0,
            borderRadius: 24,
            background: "linear-gradient(135deg,#22c55e,#d2a43a)",
            color: "#111111",
            boxShadow: "0 18px 42px rgba(0,0,0,.28)",
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
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 18,
                  background: "rgba(17,17,17,.14)",
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
          <IonCard style={{ margin: 0, borderRadius: 18, background: "#F6F2EC" }}>
            <IonCardContent style={{ padding: 14 }}>
              <div style={{ color: "#555", fontSize: ".72rem", fontWeight: 850 }}>Total cobrado</div>
              <div style={{ color: "#111", fontWeight: 950, marginTop: 3 }}>{formatClp(totalFareClp)}</div>
            </IonCardContent>
          </IonCard>
          <IonCard style={{ margin: 0, borderRadius: 18, background: "#F6F2EC" }}>
            <IonCardContent style={{ padding: 14 }}>
              <div style={{ color: "#555", fontSize: ".72rem", fontWeight: 850 }}>Comisión Rapa Go</div>
              <div style={{ color: "#111", fontWeight: 950, marginTop: 3 }}>{formatClp(totalCommissionClp)}</div>
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
          <IonCard style={{ margin: "14px 0 0", borderRadius: 20, background: "#F6F2EC" }}>
            <IonCardContent style={{ color: "#111", fontWeight: 850 }}>
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
                  style={{
                    margin: 0,
                    borderRadius: 20,
                    background: "#F6F2EC",
                    color: "#111111",
                    border: "1px solid rgba(210,164,58,.34)",
                  }}
                >
                  <IonCardContent style={{ padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 950, fontSize: ".94rem", lineHeight: 1.25 }}>
                          {getDriverRideRouteDisplayLabel(ride as unknown as Record<string, unknown>)}
                        </div>
                        <div style={{ marginTop: 5, color: "#555", fontSize: ".74rem", fontWeight: 800 }}>
                          {dateMs ? new Date(dateMs).toLocaleString("es-CL") : "Fecha no informada"}
                        </div>
                        <div style={{ marginTop: 5, color: "#555", fontSize: ".74rem", fontWeight: 800 }}>
                          {getRidePaymentMethodLabel(String(ride.notes ?? ""))} · {getRideTripTypeLabel(String(ride.notes ?? ""))}
                        </div>
                      </div>

                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <IonBadge color="success" style={{ fontWeight: 950 }}>
                          {formatClp(earning)}
                        </IonBadge>
                        <div style={{ marginTop: 6, color: "#555", fontSize: ".72rem", fontWeight: 850 }}>
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
      <DriverGlobalRideAlert />
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

function getStoredDriverProfilePhotoUrl(user?: unknown): string {
  try {
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
      for (const key of profileKeys) {
        removeDriverScopedStorageItem(key, user);
      }
      removeDriverScopedStorageItem("rapago_driver_profile_photo_updated_at", user);
      removeDriverScopedStorageItem("rapago_driver_profile_updated_at", user);
      removeDriverScopedStorageItem("rapago_public_driver_profile_photo_updated_at", user);

      window.dispatchEvent(new CustomEvent("rapago:driver-public-profile-updated", {
        detail: {
          ownerKey: getDriverScopedOwnerKey(user),
          driverOwnerKey: getDriverScopedOwnerKey(user),
          driverEmail: getDriverLiveUserField(user, "email"),
          driverProfilePhotoUrl: null,
          driverProfileImageDataUrl: null,
          profilePhotoUpdatedAt: new Date().toISOString(),
        },
      }));
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
    background: "#F6F2EC",
    color: "#111",
    border: "1px solid rgba(210,164,58,.28)",
    boxShadow: "0 14px 34px rgba(0,0,0,.18)",
    overflow: "hidden",
    ...extra,
  };
}

function driverInputItemStyle(): CSSProperties {
  return {
    "--background": "#ffffff",
    "--color": "#050505",
    "--placeholder-color": "#5f5f5f",
    "--placeholder-opacity": "1",
    "--highlight-color-focused": "#d2a43a",
    "--border-color": "rgba(210,164,58,.55)",
    "--border-radius": "16px",
    "--padding-start": "14px",
    "--inner-padding-end": "14px",
    marginTop: "10px",
    border: "1.5px solid rgba(210,164,58,.55)",
    borderRadius: "16px",
    overflow: "hidden",
    fontWeight: 900,
  } as CSSProperties;
}

function driverFieldTextStyle(): CSSProperties {
  return {
    color: "#050505",
    fontWeight: 950,
    fontSize: ".95rem",
    opacity: 1,
    "--color": "#050505",
    "--placeholder-color": "#5f5f5f",
    "--placeholder-opacity": "1",
  } as CSSProperties;
}

function driverFieldLabelStyle(): CSSProperties {
  return {
    color: "#050505",
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
  const [licenseNumber, setLicenseNumber] = useState(
    String(storedProfile.licenseNumber ?? ""),
  );
  const [licenseExpiry, setLicenseExpiry] = useState("");
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(
    getStoredDriverProfilePhotoUrl(session?.user),
  );
  const [photoError, setPhotoError] = useState<string | null>(null);
  const profilePhotoFileRef = useRef<HTMLInputElement | null>(null);
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

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [driverRatingSummary, setDriverRatingSummary] = useState<DriverRatingSummary>(() =>
    readDriverRatingSummary(session?.user, phone),
  );

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
      const autoPhone = getAutoDriverPhone(session.user, profile?.phone);

      const selectedVehicle = readSelectedDriverVehicle(session.user);
      const currentVehicles = readDriverVehicles(session.user);
      setDriverVehicles(currentVehicles);
      setSelectedVehicleId(readSelectedDriverVehicleId(session.user));

      if (selectedVehicle) {
        setVehicleBrand(selectedVehicle.brand);
        setVehicleModel(selectedVehicle.model);
        setVehicleYear(String(selectedVehicle.year ?? ""));
        setVehiclePlate(selectedVehicle.plate);
        setVehicleColor(selectedVehicle.color);
        setVehicleImageDataUrl(
          selectedVehicle.imageDataUrl ??
            String(storedProfile.vehicleImageDataUrl ?? getStoredDriverVehicleImageDataUrl(session?.user)),
        );
        setVehicleImageName(
          selectedVehicle.imageName ?? String(storedProfile.vehicleImageName ?? ""),
        );
        setVehicleOwnership(selectedVehicle.ownership);
        setVehicleExpiresAt(
          selectedVehicle.expiresAt ? selectedVehicle.expiresAt.slice(0, 10) : "",
        );
      } else if (profile) {
        setVehicleBrand(
          profile.vehicleBrand ?? String(storedProfile.vehicleBrand ?? ""),
        );
        setVehicleModel(
          profile.vehicleModel ?? String(storedProfile.vehicleModel ?? ""),
        );
        setVehicleYear(
          profile.vehicleYear != null
            ? String(profile.vehicleYear)
            : String(storedProfile.vehicleYear ?? ""),
        );
        setVehiclePlate(
          profile.vehiclePlate ?? String(storedProfile.vehiclePlate ?? ""),
        );
        setVehicleColor(
          profile.vehicleColor ?? String(storedProfile.vehicleColor ?? ""),
        );
        setVehicleImageDataUrl(
          String(storedProfile.vehicleImageDataUrl ?? getStoredDriverVehicleImageDataUrl(session?.user)),
        );
        setVehicleImageName(String(storedProfile.vehicleImageName ?? ""));
      } else {
        setVehicleImageDataUrl(
          String(storedProfile.vehicleImageDataUrl ?? getStoredDriverVehicleImageDataUrl(session?.user)),
        );
        setVehicleImageName(String(storedProfile.vehicleImageName ?? ""));
      }

      setPhone(autoPhone);
      setLicenseNumber(
        profile?.licenseNumber ?? String(storedProfile.licenseNumber ?? ""),
      );
      setLicenseExpiry(profile?.licenseExpiry ?? "");
      setProfilePhotoUrl(
        profile?.profilePhotoUrl ?? getStoredDriverProfilePhotoUrl(session?.user),
      );
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
  }, [session?.accessToken, session?.user]);

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

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);

    const trimPhone = phone.trim();
    const cleanVehicleBrand = vehicleBrand.trim();
    const cleanVehicleModel = vehicleModel.trim();
    const cleanVehiclePlate = vehiclePlate.trim().toUpperCase();
    const cleanVehicleColor = vehicleColor.trim();
    const cleanVehicleYear = vehicleYear.trim();
    const cleanVehicleImageDataUrl = vehicleImageDataUrl.trim();
    const cleanVehicleImageName = vehicleImageName.trim();
    const cleanProfilePhotoUrl = profilePhotoUrl.trim();
    const cleanLicenseNumber = licenseNumber.trim();
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
      if (trimPhone) {
        writeDriverScopedStorageItem("rapago_driver_public_phone", trimPhone, session?.user);
      }

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
        phone: trimPhone,
        email: session?.user?.email ?? null,
        name: session?.user?.name ?? null,
        vehicleBrand: cleanVehicleBrand,
        vehicleModel: cleanVehicleModel,
        vehicleYear: cleanVehicleYear,
        vehiclePlate: cleanVehiclePlate,
        vehicleColor: cleanVehicleColor,
        vehicleImageDataUrl: cleanVehicleImageDataUrl,
        vehicleImageName: cleanVehicleImageName,
        licenseNumber: cleanLicenseNumber,
      }, session?.user);

      let savedVehicle: DriverVehicleRecord | null = null;

      // El vehículo principal del perfil se transforma en vehículo activo público.
      // Es el dato que leerá el pasajero cuando el conductor acepte un viaje.
      if (cleanVehicleBrand && cleanVehicleModel && cleanVehiclePlate) {
        savedVehicle = addDriverVehicle({
          user: session?.user,
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
      }

      publishDriverProfileVehicleSnapshot({
        user: session?.user,
        phone: trimPhone,
        vehicle: savedVehicle ?? readSelectedDriverVehicle(session?.user),
      });

      // Intentamos guardar también en backend, pero no dejamos que eso borre
      // el guardado local ni la foto del vehículo.
      if (session?.accessToken) {
        const payload: Parameters<
          typeof driverProfileService.upsertMyProfile
        >[1] = {};

        if (trimPhone) payload.phone = trimPhone;
        if (cleanVehicleBrand) payload.vehicleBrand = cleanVehicleBrand;
        if (cleanVehicleModel) payload.vehicleModel = cleanVehicleModel;
        if (cleanVehicleYear) {
          const parsedYear = parseInt(cleanVehicleYear, 10);
          if (Number.isFinite(parsedYear)) payload.vehicleYear = parsedYear;
        }
        if (cleanVehiclePlate) payload.vehiclePlate = cleanVehiclePlate;
        if (cleanVehicleColor) payload.vehicleColor = cleanVehicleColor;
        if (cleanLicenseNumber) payload.licenseNumber = cleanLicenseNumber;
        if (licenseExpiry) payload.licenseExpiry = licenseExpiry;
        if (cleanProfilePhotoUrl && !cleanProfilePhotoUrl.startsWith("data:")) {
          payload.profilePhotoUrl = cleanProfilePhotoUrl;
        }
        if (cleanBio) payload.bio = cleanBio;
        payload.languages = cleanLanguages;

        try {
          await driverProfileService.upsertMyProfile(session.accessToken, payload);
        } catch (backendError) {
          // El perfil queda guardado en este dispositivo igual.
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
      setLicenseNumber(cleanLicenseNumber);
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
    setProfilePhotoUrl("");
    setPhotoError(null);
    persistStoredDriverProfilePhotoUrl("", session?.user);
  }

  async function handleVehiclePhotoFileChange(
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;

    setVehiclePhotoError(null);

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
      const result = await resizeDriverVehicleImage(file);
      setVehicleImageDataUrl(result);
      setVehicleImageName(file.name);
      persistStoredDriverVehicleImageDataUrl(result, file.name, session?.user);
      publishDriverProfileVehicleSnapshot({
        user: session?.user,
        phone: phone.trim(),
        vehicle: readSelectedDriverVehicle(session?.user),
      });
    } catch (err) {
      setVehiclePhotoError(
        err instanceof Error ? err.message : "No se pudo cargar la foto del vehículo.",
      );
    } finally {
      event.target.value = "";
    }
  }

  function handleRemoveVehiclePhoto(): void {
    setVehicleImageDataUrl("");
    setVehicleImageName("");
    setVehiclePhotoError(null);
    persistStoredDriverVehicleImageDataUrl("", null, session?.user);
  }

  function refreshDriverVehicleList(): void {
    setDriverVehicles(readDriverVehicles(session?.user));
    setSelectedVehicleId(readSelectedDriverVehicleId(session?.user));
  }

  function handleSelectDriverVehicle(vehicle: DriverVehicleRecord): void {
    writeSelectedDriverVehicleId(vehicle.id, session?.user);
    setSelectedVehicleId(vehicle.id);
    setVehicleBrand(vehicle.brand);
    setVehicleModel(vehicle.model);
    setVehicleYear(String(vehicle.year ?? ""));
    setVehiclePlate(vehicle.plate);
    setVehicleColor(vehicle.color);
    setVehicleImageDataUrl(vehicle.imageDataUrl ?? "");
    setVehicleImageName(vehicle.imageName ?? "");
    setVehicleOwnership(vehicle.ownership);
    setVehicleExpiresAt(vehicle.expiresAt ? vehicle.expiresAt.slice(0, 10) : "");
    publishDriverProfileVehicleSnapshot({
      user: session?.user,
      phone: phone.trim(),
      vehicle,
    });
    refreshDriverVehicleList();
    setSuccess(true);
  }

  function handleEditDriverVehicle(vehicle: DriverVehicleRecord): void {
    setVehicleBrand(vehicle.brand);
    setVehicleModel(vehicle.model);
    setVehicleYear(String(vehicle.year ?? ""));
    setVehiclePlate(vehicle.plate);
    setVehicleColor(vehicle.color);
    setVehicleImageDataUrl(vehicle.imageDataUrl ?? "");
    setVehicleImageName(vehicle.imageName ?? "");
    setVehicleOwnership(vehicle.ownership);
    setVehicleExpiresAt(vehicle.expiresAt ? vehicle.expiresAt.slice(0, 10) : "");
  }

  function handleRemoveDriverVehicle(vehicleId: string): void {
    removeDriverVehicle(vehicleId, session?.user);
    refreshDriverVehicleList();
  }

  function handlePrepareNewVehicle(ownership: DriverVehicleOwnership): void {
    setVehicleOwnership(ownership);
    setVehicleBrand("");
    setVehicleModel("");
    setVehicleYear("");
    setVehiclePlate("");
    setVehicleColor("");
    setVehicleImageDataUrl("");
    setVehicleImageName("");
    setVehicleExpiresAt(ownership === "borrowed" ? getDefaultBorrowedVehicleExpiry() : "");
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
      <IonPage>
      <IonHeader>
        <IonToolbar color="success">
          <IonTitle>Mi Perfil</IonTitle>
          <IonButtons slot="end">
            <IonButton color="light" onClick={() => void handleLogout()}>
              Cerrar sesión
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

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
                  "linear-gradient(135deg, rgba(45,211,111,.95), rgba(210,164,58,.92))",
                color: "#fff",
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
              style={driverFormCardStyle({
                background: "linear-gradient(135deg,#111827,#1f2937)",
                color: "#ffffff",
                border: "1px solid rgba(244,196,48,.35)",
              })}
            >
              <IonCardContent style={{ padding: "14px" }}>
                <div style={{ fontWeight: 950, fontSize: ".98rem", marginBottom: 8 }}>
                  Reputación del conductor
                </div>
                <DriverRatingStarsDisplay summary={driverRatingSummary} />
                <div style={{ marginTop: 7, color: "rgba(255,255,255,.72)", fontSize: ".78rem", lineHeight: 1.35 }}>
                  Las estrellas se actualizan cuando el pasajero califica un viaje completado.
                </div>

                {driverRatingSummary.latest.length > 0 && (
                  <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                    {driverRatingSummary.latest.map((rating) => (
                      <div
                        key={rating.id}
                        style={{
                          background: "rgba(255,255,255,.08)",
                          border: "1px solid rgba(255,255,255,.10)",
                          borderRadius: 14,
                          padding: "9px 10px",
                        }}
                      >
                        <div style={{ fontWeight: 950, color: "#f4c430" }}>
                          {"★".repeat(Math.max(1, Math.min(5, Math.round(Number(rating.stars) || 1))))}
                          {"☆".repeat(5 - Math.max(1, Math.min(5, Math.round(Number(rating.stars) || 1))))}
                        </div>
                        <div style={{ marginTop: 3, fontSize: ".76rem", color: "rgba(255,255,255,.78)", lineHeight: 1.35 }}>
                          {rating.originText ?? "Origen"} → {rating.destinationText ?? "Destino"}
                        </div>
                        {rating.comment && (
                          <div style={{ marginTop: 4, fontSize: ".78rem", color: "#ffffff", fontWeight: 800 }}>
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
                style={driverFormCardStyle({
                  background: "#fff3cd",
                  border: "1px solid #ffc107",
                })}
              >
                <IonCardContent style={{ padding: "10px 14px" }}>
                  <IonText>
                    <p
                      style={{
                        margin: 0,
                        color: "#6b4700",
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
                style={driverFormCardStyle({
                  background: "#e8fff1",
                  border: "1px solid rgba(34,197,94,.40)",
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

            <IonCard style={driverFormCardStyle()}>
              <IonCardContent>
                <div
                  style={{ fontWeight: 950, fontSize: "1rem", marginBottom: 4 }}
                >
                  Datos personales
                </div>
                <div
                  style={{
                    color: "#333",
                    fontSize: ".78rem",
                    fontWeight: 800,
                    marginBottom: 10,
                  }}
                >
                  El teléfono se toma automáticamente desde el registro si está
                  disponible.
                </div>

                <IonItem lines="none" style={driverInputItemStyle()}>
                  <IonLabel position="stacked" style={driverFieldLabelStyle()}>
                    Teléfono
                  </IonLabel>
                  <IonInput
                    style={driverFieldTextStyle()}
                    value={phone}
                    onIonInput={(event) =>
                      setPhone(String(event.detail.value ?? ""))
                    }
                    placeholder="+56 9 1234 5678"
                    type="tel"
                    maxlength={20}
                    clearInput
                  />
                </IonItem>

                <div
                  style={{
                    marginTop: 14,
                    padding: 14,
                    borderRadius: 20,
                    background:
                      "linear-gradient(135deg,#ffffff 0%,#fff8e6 100%)",
                    border: "1.5px solid rgba(210,164,58,.50)",
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
                        background: "linear-gradient(135deg,#2dd36f,#d2a43a)",
                        color: "#fff",
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
                          color: "#111",
                          fontSize: ".95rem",
                        }}
                      >
                        Foto de perfil
                      </div>
                      <div
                        style={{
                          color: "#555",
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
                      color="success"
                      onClick={() => profilePhotoFileRef.current?.click()}
                      style={
                        {
                          "--border-radius": "16px",
                          height: "48px",
                          fontWeight: 950,
                        } as CSSProperties
                      }
                    >
                      <IonIcon icon={cameraOutline} slot="start" />
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
                        <IonIcon icon={trashOutline} slot="start" />
                        Quitar
                      </IonButton>
                    )}
                  </div>

                  <IonItem
                    lines="none"
                    style={{ ...driverInputItemStyle(), marginTop: 12 }}
                  >
                    <IonLabel
                      position="stacked"
                      style={driverFieldLabelStyle()}
                    >
                      URL opcional
                    </IonLabel>
                    <IonInput
                      style={driverFieldTextStyle()}
                      value={
                        profilePhotoUrl.startsWith("data:")
                          ? ""
                          : profilePhotoUrl
                      }
                      onIonInput={(event) => {
                        const value = String(event.detail.value ?? "");
                        setProfilePhotoUrl(value);
                        persistStoredDriverProfilePhotoUrl(value, session?.user);
                      }}
                      placeholder="https://..."
                      type="url"
                      clearInput
                    />
                  </IonItem>

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

            <IonCard style={driverFormCardStyle()}>
              <IonCardContent>
                <div
                  style={{ fontWeight: 950, fontSize: "1rem", marginBottom: 4 }}
                >
                  Vehículos del conductor
                </div>
                <div
                  style={{
                    color: "#333",
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
                    background: "rgba(34,197,94,.12)",
                    color: "#166534",
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
                            background: selected ? "#ECFDF3" : "#FFFDF7",
                            border: selected
                              ? "2px solid rgba(34,197,94,.70)"
                              : "1.5px solid rgba(210,164,58,.42)",
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
                                background: "#111",
                              }}
                            />
                          )}

                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 950, color: "#111", fontSize: ".92rem" }}>
                              {vehicle.brand} {vehicle.model} {vehicle.year ? `· ${vehicle.year}` : ""}
                            </div>
                            <div style={{ color: "#333", fontSize: ".78rem", fontWeight: 850, marginTop: 2 }}>
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
                  <IonNote style={{ display: "block", marginBottom: 12, color: "#8f3c24", fontWeight: 900 }}>
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
                    color: "#333",
                    fontSize: ".78rem",
                    fontWeight: 800,
                    marginBottom: 10,
                  }}
                >
                  {vehicleOwnership === "borrowed"
                    ? "Vehículo opcional/temporal: puedes agregar más de uno. Cada opcional exige fecha de expiración y luego se borra automáticamente."
                    : "Vehículo propio: puedes guardar tu principal y también agregar más vehículos propios si los usas en Rapa Go."}
                </div>

                <IonItem lines="none" style={driverInputItemStyle()}>
                  <IonLabel position="stacked" style={driverFieldLabelStyle()}>
                    Marca
                  </IonLabel>
                  <IonInput
                    style={driverFieldTextStyle()}
                    value={vehicleBrand}
                    onIonInput={(event) =>
                      setVehicleBrand(String(event.detail.value ?? ""))
                    }
                    placeholder="Toyota"
                    clearInput
                  />
                </IonItem>

                <IonItem lines="none" style={driverInputItemStyle()}>
                  <IonLabel position="stacked" style={driverFieldLabelStyle()}>
                    Modelo
                  </IonLabel>
                  <IonInput
                    style={driverFieldTextStyle()}
                    value={vehicleModel}
                    onIonInput={(event) =>
                      setVehicleModel(String(event.detail.value ?? ""))
                    }
                    placeholder="Yaris"
                    clearInput
                  />
                </IonItem>

                <IonItem lines="none" style={driverInputItemStyle()}>
                  <IonLabel position="stacked" style={driverFieldLabelStyle()}>
                    Año
                  </IonLabel>
                  <IonInput
                    style={driverFieldTextStyle()}
                    value={vehicleYear}
                    onIonInput={(event) =>
                      setVehicleYear(String(event.detail.value ?? ""))
                    }
                    placeholder="2025"
                    inputmode="numeric"
                    clearInput
                  />
                </IonItem>

                <IonItem lines="none" style={driverInputItemStyle()}>
                  <IonLabel position="stacked" style={driverFieldLabelStyle()}>
                    Patente
                  </IonLabel>
                  <IonInput
                    style={driverFieldTextStyle()}
                    value={vehiclePlate}
                    onIonInput={(event) =>
                      setVehiclePlate(
                        String(event.detail.value ?? "").toUpperCase(),
                      )
                    }
                    placeholder="ABCD12"
                    clearInput
                  />
                </IonItem>

                <IonItem lines="none" style={driverInputItemStyle()}>
                  <IonLabel position="stacked" style={driverFieldLabelStyle()}>
                    Color
                  </IonLabel>
                  <IonInput
                    style={driverFieldTextStyle()}
                    value={vehicleColor}
                    onIonInput={(event) =>
                      setVehicleColor(String(event.detail.value ?? ""))
                    }
                    placeholder="Rojo"
                    clearInput
                  />
                </IonItem>

                {vehicleOwnership === "borrowed" && (
                  <IonItem lines="none" style={driverInputItemStyle()}>
                    <IonLabel position="stacked" style={driverFieldLabelStyle()}>
                      Fecha de expiración del vehículo opcional *
                    </IonLabel>
                    <IonInput
                      style={driverFieldTextStyle()}
                      type="date"
                      value={vehicleExpiresAt}
                      onIonInput={(event) => setVehicleExpiresAt(String(event.detail.value ?? ""))}
                    />
                  </IonItem>
                )}

                <div
                  style={{
                    marginTop: 14,
                    padding: 14,
                    borderRadius: 20,
                    background: "linear-gradient(135deg,#ffffff 0%,#fff8e6 100%)",
                    border: "1.5px dashed rgba(210,164,58,.62)",
                    boxShadow: "0 12px 26px rgba(0,0,0,.08)",
                  }}
                >
                  <div style={{ fontWeight: 950, fontSize: ".95rem", color: "#111" }}>
                    Foto del vehículo
                  </div>
                  <div
                    style={{
                      color: "#555",
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
                        background: "#111",
                        border: "1px solid rgba(0,0,0,.12)",
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
                      color="success"
                      onClick={() => vehiclePhotoFileRef.current?.click()}
                      style={
                        {
                          "--border-radius": "16px",
                          height: "48px",
                          fontWeight: 950,
                        } as CSSProperties
                      }
                    >
                      <IonIcon icon={cameraOutline} slot="start" />
                      {hasVehiclePhoto ? "Cambiar foto" : "Adjuntar foto"}
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
                        <IonIcon icon={trashOutline} slot="start" />
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
              </IonCardContent>
            </IonCard>

            <IonCard style={driverFormCardStyle()}>
              <IonCardContent>
                <div
                  style={{ fontWeight: 950, fontSize: "1rem", marginBottom: 4 }}
                >
                  Licencia de conducir
                </div>

                <IonItem lines="none" style={driverInputItemStyle()}>
                  <IonLabel position="stacked" style={driverFieldLabelStyle()}>
                    Número de licencia
                  </IonLabel>
                  <IonInput
                    style={driverFieldTextStyle()}
                    value={licenseNumber}
                    onIonInput={(event) =>
                      setLicenseNumber(String(event.detail.value ?? ""))
                    }
                    placeholder="12345678-9"
                    clearInput
                  />
                </IonItem>

                <IonItem lines="none" style={driverInputItemStyle()}>
                  <IonLabel position="stacked" style={driverFieldLabelStyle()}>
                    Fecha de vencimiento
                  </IonLabel>
                  <IonInput
                    style={driverFieldTextStyle()}
                    value={licenseExpiry}
                    onIonInput={(event) =>
                      setLicenseExpiry(String(event.detail.value ?? ""))
                    }
                    type="date"
                  />
                </IonItem>

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

            <IonCard style={driverFormCardStyle()}>
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
                <IonItem lines="none" style={driverInputItemStyle()}>
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

            <IonCard style={driverFormCardStyle()}>
              <IonCardContent>
                <div
                  style={{ fontWeight: 950, fontSize: "1rem", marginBottom: 4 }}
                >
                  Idiomas
                </div>
                <div
                  style={{
                    color: "#333",
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
                            ? "2px solid #2dd36f"
                            : "1.5px solid rgba(210,164,58,.45)",
                          background: selected
                            ? "linear-gradient(135deg,#2dd36f 0%,#d2a43a 100%)"
                            : "linear-gradient(135deg,#ffffff 0%,#fff8e6 100%)",
                          color: selected ? "#ffffff" : "#111111",
                          boxShadow: selected
                            ? "0 14px 28px rgba(45,211,111,.28)"
                            : "0 8px 18px rgba(0,0,0,.08)",
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
                    background: "rgba(45,211,111,.10)",
                    border: "1px solid rgba(45,211,111,.25)",
                    color: "#0f6f36",
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
                style={driverFormCardStyle({
                  background: "linear-gradient(135deg, #fff7dc, #f6f2ec)",
                  border: "1px solid rgba(210,164,58,.55)",
                })}
              >
                <IonCardContent style={{ padding: "14px" }}>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 12 }}
                  >
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 16,
                        background: "#d2a43a",
                        color: "#111",
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
                          color: "#111",
                        }}
                      >
                        ¿Quieres pedir un Rapa Go?
                      </div>
                      <div
                        style={{
                          marginTop: 3,
                          color: "#555",
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

            <IonButton
              expand="block"
              color="success"
              onClick={() => void handleSave()}
              disabled={saving}
              style={
                {
                  "--border-radius": "16px",
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
      <DriverGlobalRideAlert />
    </>
  );
}
