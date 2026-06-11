import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonChip,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonModal,
  IonNote,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonText,
  IonTextarea,
  IonTitle,
  IonToggle,
  IonToolbar,
  useIonViewWillEnter,
} from "@ionic/react";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  carOutline,
  cashOutline,
  listOutline,
  personOutline,
  refreshOutline,
  warningOutline,
} from "ionicons/icons";
import { IonIcon } from "@ionic/react";
import { ModulePlaceholderPage } from "../../components/ModulePlaceholderPage";
import { driverProfileService } from "../../features/drivers/driverProfile.service";
import { HomeHeader } from "../../components/HomeHeader";
import { ActionCard } from "../../components/ActionCard";
import { useConnectivity } from "../../hooks/useConnectivity";
import { ROUTE_METADATA } from "../../navigation/routeConfig";
import { ROUTES } from "../../navigation/routes";
import { useAuth } from "../../features/auth";
import { ridesService, type ActiveRideOfferData, type RideStopData } from "../../features/rides/rides.service";
import { MapFallback } from "../../components/MapFallback";
import { driverStatusService } from "../../features/drivers/driverStatus.service";
import { RAPA_NUI_ZONES, getZoneLabel, RAPAGO_CONTACT, WA_MESSAGES } from "@rapa-go/shared";
import { WhatsAppButton } from "../../components/WhatsAppButton";
import { legalService, type LegalDocumentData, type UserAcceptanceData } from "../../features/legal/legal.service.js";
import { earningsService, type TodayEarnings } from "../../features/drivers/earnings.service.js";
import { Geolocation } from "@capacitor/geolocation";
import { useDirectionsRoute } from "../../features/maps/useDirectionsRoute.js";
import { MapView } from "../../features/maps/MapView.js";
import type { GoogleMapInstance, LatLng } from "../../features/maps/maps.types.js";

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
    <IonCard style={{ margin: "0 0 16px" }}>
      <IonCardContent>
        <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: "8px" }}>Documentos Legales</div>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "8px" }}>
            <IonSpinner name="dots" />
          </div>
        ) : (
          docs.map((doc) => {
            const status = getStatus(doc);
            return (
              <div key={doc.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0" }}>
                <div>
                  <div style={{ fontSize: "0.9rem" }}>{doc.title}</div>
                  <div style={{ fontSize: "0.75rem", color: "gray" }}>v{doc.version}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  {status === "accepted" && <IonBadge color="success">Aceptado</IonBadge>}
                  {status === "new_version" && <IonBadge color="warning">Nueva versión</IonBadge>}
                  {status === "not_accepted" && <IonBadge color="danger">Pendiente</IonBadge>}
                  {(status === "not_accepted" || status === "new_version") && (
                    <IonButton fill="clear" size="small" onClick={() => handleAccept(doc)}>
                      Aceptar
                    </IonButton>
                  )}
                </div>
              </div>
            );
          })
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

export function DriverHomePage(): JSX.Element {
  const { session } = useAuth();
  const isOnline = useConnectivity();
  const [driverAvailability, setDriverAvailability] = useState<"available" | "unavailable" | "busy">("unavailable");
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [currentZone, setCurrentZone] = useState<string | null>(null);
  const [todayEarnings, setTodayEarnings] = useState<TodayEarnings | null>(null);

  const loadEarnings = useCallback(() => {
    if (!session?.accessToken) return;
    void earningsService.getTodayEarnings(session.accessToken)
      .then(setTodayEarnings)
      .catch(() => {});
  }, [session?.accessToken]);

  useEffect(() => { loadEarnings(); }, [loadEarnings]);

  // Re-fetch earnings each time the home tab comes into view (e.g. after completing a ride).
  useIonViewWillEnter(() => { loadEarnings(); });

  useEffect(() => {
    if (!session?.accessToken) return;
    void driverStatusService.getMyStatus(session.accessToken)
      .then((s) => {
        setDriverAvailability(s.availability);
        setCurrentZone(s.currentZone ?? null);
      })
      .catch(() => {/* silently ignore on mount */});
  }, [session?.accessToken]);

  const handleToggleAvailability = async () => {
    if (!session?.accessToken || driverAvailability === "busy") return;
    const newStatus = driverAvailability === "available" ? "unavailable" : "available";
    setAvailabilityLoading(true);
    setAvailabilityError(null);
    try {
      const updated = await driverStatusService.updateMyStatus(session.accessToken, newStatus, currentZone);
      setDriverAvailability(updated.availability);
      setCurrentZone(updated.currentZone ?? null);
    } catch (err) {
      setAvailabilityError(err instanceof Error ? err.message : "Error al actualizar estado.");
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const availabilityColor = driverAvailability === "available" ? "success" : driverAvailability === "busy" ? "warning" : "medium";
  const availabilityLabel = driverAvailability === "available"
    ? `Disponible en ${getZoneLabel(currentZone as any)}`
    : driverAvailability === "busy"
    ? "Ocupado en viaje"
    : "No disponible";

  return (
    <IonPage>
      <HomeHeader title="Inicio" />
      <IonContent className="ion-padding">
        {/* Connectivity indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
          <div style={{
            width: "10px", height: "10px", borderRadius: "50%",
            background: isOnline ? "var(--ion-color-success)" : "var(--ion-color-danger)",
            flexShrink: 0,
          }} />
          <IonText color={isOnline ? "success" : "danger"}>
            <small style={{ fontSize: "0.78rem" }}>
              {isOnline ? "Conectado" : "Sin conexión — los estados se sincronizarán cuando haya señal"}
            </small>
          </IonText>
        </div>
        {/* Availability toggle */}
        <IonCard color={availabilityColor} style={{ margin: "0 0 12px" }}>
          <IonCardContent>
            <IonItem lines="none" color="inherit">
              <IonLabel>
                <strong>Estado operacional</strong>
                <p>{availabilityLabel}</p>
              </IonLabel>
              {availabilityLoading ? (
                <IonSpinner name="dots" slot="end" />
              ) : (
                <IonToggle
                  slot="end"
                  checked={driverAvailability === "available"}
                  disabled={driverAvailability === "busy" || availabilityLoading}
                  onIonChange={() => void handleToggleAvailability()}
                />
              )}
            </IonItem>
            <IonItem lines="none" color="inherit">
              <IonLabel>Zona actual</IonLabel>
              <IonSelect
                interface="action-sheet"
                placeholder="Seleccionar zona"
                value={currentZone ?? ""}
                disabled={driverAvailability === "busy" || availabilityLoading}
                onIonChange={async (e) => {
                  const zone = e.detail.value as string;
                  setCurrentZone(zone || null);
                  if (driverAvailability !== "busy" && session?.accessToken) {
                    try {
                      await driverStatusService.updateMyStatus(
                        session.accessToken,
                        driverAvailability === "available" ? "available" : "unavailable",
                        zone || null,
                      );
                    } catch (_) { /* ignore zone-only update errors */ }
                  }
                }}
              >
                {RAPA_NUI_ZONES.filter(z => z.id !== "desconocida").map(zone => (
                  <IonSelectOption key={zone.id} value={zone.id}>
                    {zone.label}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
            {availabilityError && (
              <IonText color="danger">
                <p style={{ fontSize: "0.78rem", margin: "4px 0 0" }}>{availabilityError}</p>
              </IonText>
            )}
          </IonCardContent>
        </IonCard>

        {todayEarnings && (
          <IonCard style={{ margin: "0 0 12px", borderRadius: "14px" }} routerLink={ROUTES.DRIVER.EARNINGS}>
            <IonCardContent style={{ padding: "12px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--ion-color-dark)" }}>Ganancias de hoy</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--ion-color-medium)", marginTop: "2px" }}>{todayEarnings.completedRides} viaje{todayEarnings.completedRides !== 1 ? "s" : ""} completado{todayEarnings.completedRides !== 1 ? "s" : ""}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--ion-color-success-shade)" }}>{clp(todayEarnings.netEarningsClp)}</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--ion-color-medium)" }}>neto · ver detalle →</div>
                </div>
              </div>
            </IonCardContent>
          </IonCard>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px",
            marginTop: "8px",
          }}
        >
          <ActionCard
            icon={listOutline}
            title="Solicitudes"
            subtitle="Viajes asignados activos"
            route={ROUTES.DRIVER.REQUESTS}
            color="success"
          />
          <ActionCard
            icon={carOutline}
            title="Mis Viajes"
            subtitle="Historial de viajes completados"
            route={ROUTES.DRIVER.TRIPS}
            color="success"
          />
          <ActionCard
            icon={cashOutline}
            title="Ganancias"
            subtitle="Resumen de ingresos"
            route={ROUTES.DRIVER.EARNINGS}
            color="success"
          />
          <ActionCard
            icon={personOutline}
            title="Perfil"
            subtitle="Datos personales y documentos"
            route={ROUTES.PROFILE.INDEX}
            color="medium"
          />
        </div>
      </IonContent>
    </IonPage>
  );
}

// ── RideStopsList ─────────────────────────────────────────────────────────────

function fmtStopDist(m: number | null): string {
  if (m == null) return "";
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
}

function fmtStopDur(s: number | null): string {
  if (s == null) return "";
  const mins = Math.round(s / 60);
  return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}min`;
}

const STOP_COLORS = ["#3880ff", "#2dd36f", "#ffc409"] as const;

function RideStopsList({ stops, status }: { stops: RideStopData[]; status: string }): JSX.Element {
  const sorted = [...stops].sort((a, b) => a.stopOrder - b.stopOrder);
  return (
    <div style={{ marginTop: "10px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
        <span style={{ fontWeight: 600, fontSize: "0.82rem" }}>Paradas del viaje</span>
        {sorted.length > 1 && (
          <IonBadge color="secondary" style={{ fontSize: "0.65rem" }}>Multi-destino</IonBadge>
        )}
      </div>
      {status === "accepted" && (
        <div style={{ fontSize: "0.78rem", color: "var(--ion-color-primary)", marginBottom: "6px", fontStyle: "italic" }}>
          Primero debes ir al punto de partida.
        </div>
      )}
      {status === "in_progress" && (
        <div style={{ fontSize: "0.78rem", color: "var(--ion-color-success)", marginBottom: "6px", fontStyle: "italic" }}>
          Sigue las paradas en orden hasta el destino final.
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {sorted.map((stop, i) => {
          const isLast = i === sorted.length - 1;
          const color  = STOP_COLORS[i % STOP_COLORS.length] ?? "#3880ff";
          const meta   = [fmtStopDist(stop.segmentDistanceMeters), fmtStopDur(stop.segmentDurationSeconds)].filter(Boolean).join(" · ");
          return (
            <div key={stop.id} style={{ borderLeft: `3px solid ${color}`, paddingLeft: "8px", fontSize: "0.78rem" }}>
              <div style={{ fontWeight: 600 }}>
                {i + 1}. {stop.label}
                {isLast && <span style={{ marginLeft: "6px", color: "var(--ion-color-medium)", fontWeight: 400 }}>Destino final</span>}
              </div>
              {meta && <div style={{ color: "var(--ion-color-medium)" }}>{meta}</div>}
              {stop.segmentFareClp != null && (
                <div style={{ color: "var(--ion-color-dark)" }}>
                  Tramo: ${stop.segmentFareClp.toLocaleString("es-CL")} CLP
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DriverRequestsPage(): JSX.Element {
  return <AssignedRidesPage />;
}

function AssignedRidesPage(): JSX.Element {
  const { session } = useAuth();
  type DriverRideData = import("../../features/rides/rides.service").DriverRideData;

  const [rides,     setRides]     = useState<DriverRideData[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadRides = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await ridesService.listDriverRides(session.accessToken);
      // Show only assigned (non-terminal) rides
      setRides(data.filter((r) => ["accepted", "driver_en_route", "driver_arrived", "in_progress"].includes(r.status)));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Error al cargar viajes asignados.");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => { void loadRides(); }, [loadRides]);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="success">
          <IonTitle>Mis Asignaciones</IonTitle>
          <div slot="end" style={{ paddingRight: "8px" }}>
            <IonButton fill="clear" color="light" onClick={() => void loadRides()} disabled={loading}>
              <IonIcon icon={refreshOutline} slot="icon-only" />
            </IonButton>
          </div>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        {/* Informational notice */}
        <div style={{
          background:   "var(--ion-color-light)",
          border:       "1px solid var(--ion-color-medium-tint)",
          borderRadius: "8px",
          padding:      "10px 14px",
          marginBottom: "16px",
          fontSize:     "0.82rem",
          color:        "var(--ion-color-medium-shade)",
        }}>
          Los viajes son asignados por el centro de operaciones Rapa Go. Gestiona tus viajes activos desde "Mis Viajes".
        </div>

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }}>
            <IonSpinner name="crescent" />
          </div>
        )}

        {loadError && <IonText color="danger"><p>{loadError}</p></IonText>}

        {!loading && rides.length === 0 && (
          <IonText color="medium">
            <p style={{ textAlign: "center", marginTop: "40px" }}>
              No tienes viajes asignados en este momento.
            </p>
          </IonText>
        )}

        {!loading && rides.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {rides.map((ride) => (
              <IonCard key={ride.id} style={{ margin: 0 }}>
                <IonCardContent style={{ padding: "14px 16px" }}>
                  <MapFallback
                    origin={{ text: ride.originText }}
                    destination={{ text: ride.destinationText }}
                    height={130}
                  />
                  <div style={{ marginTop: "10px" }}>
                    <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "6px" }}>
                      {ride.originText} → {ride.destinationText}
                    </div>
                    {ride.stops && ride.stops.length > 0 && (
                      <RideStopsList stops={ride.stops} status={ride.status} />
                    )}
                    <IonBadge color="primary" style={{ fontSize: "0.7rem" }}>Asignado</IonBadge>
                    {ride.estimatedFareClp != null && (
                      <div style={{ marginTop: "4px", fontSize: "0.78rem", fontWeight: 500 }}>
                        Tarifa est.: ${ride.estimatedFareClp.toLocaleString("es-CL")} CLP
                      </div>
                    )}
                    {ride.notes && (
                      <div style={{ marginTop: "6px", fontSize: "0.8rem", color: "var(--ion-color-medium)" }}>
                        {ride.notes}
                      </div>
                    )}
                    <div style={{ marginTop: "6px", fontSize: "0.75rem", color: "var(--ion-color-medium)" }}>
                      Asignado: {ride.acceptedAt ? new Date(ride.acceptedAt).toLocaleString("es-CL") : "—"}
                    </div>
                    <div style={{ marginTop: "6px", fontSize: "0.78rem", color: "var(--ion-color-medium)" }}>
                      Gestiona este viaje desde "Mis Viajes".
                    </div>
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
          {ride.originText} → {ride.destinationText}
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
  return <DriverMyRidesPage />;
}

function DriverMyRidesPage(): JSX.Element {
  const { session } = useAuth();
  type DriverRideData = import("../../features/rides/rides.service").DriverRideData;

  const DRIVER_STATUS_LABEL: Record<string, string> = {
    accepted:        "Aceptado",
    driver_en_route: "Voy en camino",
    driver_arrived:  "Llegué al origen",
    in_progress:     "En curso",
    completed:       "Completado",
    cancelled:       "Cancelado",
  };
  const DRIVER_STATUS_COLOR: Record<string, string> = {
    accepted:        "primary",
    driver_en_route: "tertiary",
    driver_arrived:  "secondary",
    in_progress:     "success",
    completed:       "medium",
    cancelled:       "medium",
  };

  const [rides,       setRides]       = useState<DriverRideData[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [loadError,   setLoadError]   = useState<string | null>(null);
  const [cancelling,   setCancelling]   = useState<string | null>(null);
  const [cancelError,  setCancelError]  = useState<string | null>(null);
  const [enRouting,    setEnRouting]    = useState<string | null>(null);
  const [enRouteError, setEnRouteError] = useState<string | null>(null);
  const [arriving,     setArriving]     = useState<string | null>(null);
  const [arriveError,  setArriveError]  = useState<string | null>(null);
  const [starting,     setStarting]     = useState<string | null>(null);
  const [startError,   setStartError]   = useState<string | null>(null);
  const [completing,   setCompleting]   = useState<string | null>(null);
  const [completeError,setCompleteError]= useState<string | null>(null);

  const [ratingRideId,     setRatingRideId]     = useState<string | null>(null);
  const [ratingStars,      setRatingStars]      = useState(5);
  const [ratingComment,    setRatingComment]    = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);
  const [ratingError,      setRatingError]      = useState<string | null>(null);
  const [ratedIds,         setRatedIds]         = useState<Set<string>>(new Set());

  const [sharingLocation,    setSharingLocation]    = useState(false);
  const [locationSharedAt,   setLocationSharedAt]   = useState<string | null>(null);
  const [locationShareError, setLocationShareError] = useState<string | null>(null);
  const [driverPos,          setDriverPos]          = useState<LatLng | null>(null);

  // Queued offer state
  const [activeOffer,        setActiveOffer]        = useState<ActiveRideOfferData | null>(null);
  const [offerActionLoading, setOfferActionLoading] = useState(false);
  const [offerMsg,           setOfferMsg]           = useState<string | null>(null);

  async function handleShareLocation() {
    if (!session?.accessToken) return;
    setSharingLocation(true);
    setLocationShareError(null);
    setLocationSharedAt(null);
    try {
      let perm = await Geolocation.checkPermissions();
      if (perm.location === "prompt" || perm.location === "prompt-with-rationale") {
        perm = await Geolocation.requestPermissions({ permissions: ["location"] });
      }
      if (perm.location === "denied") {
        setLocationShareError("Permiso de ubicación denegado. Habilítalo en Ajustes del dispositivo.");
        return;
      }
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10_000 });
      const newPos: LatLng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      const res = await ridesService.updateDriverLocation(session.accessToken, newPos.lat, newPos.lng);
      setDriverPos(newPos);
      setLocationSharedAt(res.updatedAt);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al obtener ubicación.";
      const isDenied = /denied|permission|not allowed/i.test(msg);
      setLocationShareError(isDenied ? "Permiso de ubicación denegado." : `Error: ${msg}`);
    } finally {
      setSharingLocation(false);
    }
  }

  const loadRides = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await ridesService.listDriverRides(session.accessToken);
      setRides(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Error al cargar tus viajes.");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => { void loadRides(); }, [loadRides]);

  // Polling: check for active queued offer every 3s while driver is in_progress and no modal open
  const hasInProgressRide = rides.some(r => r.status === "in_progress");
  useEffect(() => {
    if (!session?.accessToken || !hasInProgressRide || activeOffer !== null) return;
    const poll = async () => {
      try {
        const offer = await ridesService.getActiveDriverOffer(session.accessToken!);
        if (offer) setActiveOffer(offer);
      } catch { /* non-fatal */ }
    };
    const id = setInterval(() => { void poll(); }, 3000);
    return () => clearInterval(id);
  }, [session?.accessToken, hasInProgressRide, activeOffer]);

  // Offer handlers
  async function handleAcceptOffer() {
    if (!session?.accessToken || !activeOffer) return;
    setOfferActionLoading(true);
    try {
      await ridesService.acceptDriverOffer(session.accessToken, activeOffer.offer.id);
      setActiveOffer(null);
      setOfferMsg("Próximo viaje asignado. Finaliza primero tu viaje actual.");
      void loadRides();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al aceptar oferta.";
      const isExpired = /expired|no longer|409/i.test(msg);
      setOfferMsg(isExpired ? "La oferta ya expiró o no está disponible." : msg);
      setActiveOffer(null);
    } finally {
      setOfferActionLoading(false);
    }
  }

  function handleRejectOffer() {
    if (!session?.accessToken || !activeOffer) { setActiveOffer(null); return; }
    void ridesService.rejectDriverOffer(session.accessToken, activeOffer.offer.id).catch(() => {});
    setActiveOffer(null);
    setOfferMsg("Oferta rechazada.");
  }

  function handleExpireOffer() {
    setActiveOffer(null);
    setOfferMsg("La oferta expiró.");
    // Trigger a lazy expiry check on next poll cycle — no endpoint called here
    if (session?.accessToken) {
      void ridesService.getActiveDriverOffer(session.accessToken).catch(() => {});
    }
  }

  async function handleComplete(rideId: string) {
    if (!session?.accessToken) return;
    setCompleting(rideId);
    setCompleteError(null);
    try {
      const updated = await ridesService.completeRide(session.accessToken, rideId);
      setRides((prev) => prev.map((r) => (r.id === rideId ? { ...r, status: updated.status } : r)));
    } catch (err) {
      setCompleteError(err instanceof Error ? err.message : "Error al finalizar el viaje.");
    } finally {
      setCompleting(null);
    }
  }

  async function handleStart(rideId: string) {
    if (!session?.accessToken) return;
    setStarting(rideId);
    setStartError(null);
    try {
      const updated = await ridesService.startRide(session.accessToken, rideId);
      setRides((prev) => prev.map((r) => (r.id === rideId ? { ...r, status: updated.status } : r)));
    } catch (err) {
      setStartError(err instanceof Error ? err.message : "Error al iniciar el viaje.");
    } finally {
      setStarting(null);
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
      setRatingError(err instanceof Error ? err.message : "Error al calificar el viaje.");
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
      setRides((prev) => prev.map((r) => (r.id === rideId ? { ...r, status: updated.status } : r)));
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "Error al cancelar el viaje.");
    } finally {
      setCancelling(null);
    }
  }

  async function handleEnRoute(rideId: string) {
    if (!session?.accessToken) return;
    setEnRouting(rideId);
    setEnRouteError(null);
    try {
      const updated = await ridesService.markEnRoute(session.accessToken, rideId);
      setRides((prev) => prev.map((r) => (r.id === rideId ? { ...r, status: updated.status, enRouteAt: updated.enRouteAt } : r)));
    } catch (err) {
      setEnRouteError(err instanceof Error ? err.message : "Error al marcar en camino.");
    } finally {
      setEnRouting(null);
    }
  }

  async function handleArrived(rideId: string) {
    if (!session?.accessToken) return;
    setArriving(rideId);
    setArriveError(null);
    try {
      const updated = await ridesService.markArrived(session.accessToken, rideId);
      setRides((prev) => prev.map((r) => (r.id === rideId ? { ...r, status: updated.status, arrivedAt: updated.arrivedAt } : r)));
    } catch (err) {
      setArriveError(err instanceof Error ? err.message : "Error al marcar llegada.");
    } finally {
      setArriving(null);
    }
  }

  const hasAcceptedQueuedRide = hasInProgressRide && rides.some(r => r.status === "accepted");

  return (
    <IonPage>
      {/* Queued offer modal — appears over current ride while in_progress */}
      <IonModal
        isOpen={activeOffer !== null}
        onDidDismiss={() => setActiveOffer(null)}
        breakpoints={[0, 1]}
        initialBreakpoint={1}
        style={{ "--height": "auto" }}
      >
        {activeOffer && (
          <QueuedOfferModal
            offer={activeOffer}
            onAccept={() => void handleAcceptOffer()}
            onReject={handleRejectOffer}
            onExpire={handleExpireOffer}
            loading={offerActionLoading}
          />
        )}
      </IonModal>

      <IonHeader>
        <IonToolbar color="success">
          <IonTitle>Mis Viajes</IonTitle>
          <div slot="end" style={{ paddingRight: "8px" }}>
            <IonButton fill="clear" color="light" disabled={loading} onClick={() => void loadRides()}>
              <IonIcon icon={refreshOutline} slot="icon-only" />
            </IonButton>
          </div>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonRefresher slot="fixed" onIonRefresh={(e) => { void loadRides().then(() => e.detail.complete()); }}>
          <IonRefresherContent />
        </IonRefresher>

        {/* Offer result message */}
        {offerMsg && (
          <div style={{
            display:      "flex",
            alignItems:   "center",
            justifyContent: "space-between",
            gap:          "8px",
            padding:      "10px 14px",
            marginBottom: "12px",
            borderRadius: "8px",
            background:   offerMsg.includes("asignado") ? "var(--ion-color-success-tint)" : offerMsg.includes("rechazada") ? "var(--ion-color-light)" : "var(--ion-color-danger-tint)",
            border:       `1px solid ${offerMsg.includes("asignado") ? "var(--ion-color-success)" : offerMsg.includes("rechazada") ? "var(--ion-color-medium-tint)" : "var(--ion-color-danger)"}`,
            fontSize:     "0.83rem",
            color:        offerMsg.includes("asignado") ? "var(--ion-color-success-shade)" : offerMsg.includes("rechazada") ? "var(--ion-color-medium-shade)" : "var(--ion-color-danger-shade)",
          }}>
            <span>{offerMsg}</span>
            <IonButton fill="clear" size="small" color="medium" onClick={() => setOfferMsg(null)} style={{ margin: 0, height: "auto", "--padding-start": "4px", "--padding-end": "4px" }}>✕</IonButton>
          </div>
        )}

        {/* Banner: queued next ride accepted */}
        {hasAcceptedQueuedRide && (
          <div style={{
            display:      "flex",
            alignItems:   "center",
            gap:          "8px",
            padding:      "10px 14px",
            marginBottom: "12px",
            borderRadius: "8px",
            background:   "var(--ion-color-primary-tint)",
            border:       "1px solid var(--ion-color-primary)",
            fontSize:     "0.83rem",
            color:        "var(--ion-color-primary-shade)",
            fontWeight:   600,
          }}>
            <span style={{ fontSize: "1rem" }}>🔵</span>
            Próximo viaje asignado. Termina primero tu viaje actual.
          </div>
        )}

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }}>
            <IonSpinner name="crescent" />
          </div>
        )}

        {loadError && <IonText color="danger"><p>{loadError}</p></IonText>}
        {cancelError && <IonText color="danger"><p style={{ fontSize: "0.85rem" }}>{cancelError}</p></IonText>}
        {enRouteError && <IonText color="danger"><p style={{ fontSize: "0.85rem" }}>{enRouteError}</p></IonText>}
        {arriveError && <IonText color="danger"><p style={{ fontSize: "0.85rem" }}>{arriveError}</p></IonText>}
        {startError && <IonText color="danger"><p style={{ fontSize: "0.85rem" }}>{startError}</p></IonText>}
        {completeError && <IonText color="danger"><p style={{ fontSize: "0.85rem" }}>{completeError}</p></IonText>}
        {ratingError && <IonText color="danger"><p style={{ fontSize: "0.85rem" }}>{ratingError}</p></IonText>}
        {locationShareError && <IonText color="danger"><p style={{ fontSize: "0.85rem" }}>{locationShareError}</p></IonText>}
        {locationSharedAt && <IonText color="success"><p style={{ fontSize: "0.82rem" }}>✓ Ubicación compartida a las {new Date(locationSharedAt).toLocaleTimeString("es-CL")}</p></IonText>}

        {!loading && rides.length === 0 && (
          <IonText color="medium"><p>No tienes viajes todavía.</p></IonText>
        )}

        {/* ── Próximos viajes programados ───────────────────────────────── */}
        {!loading && rides.some(r => r.rideType === "scheduled" && r.status === "accepted") && (
          <div style={{ marginBottom: "20px" }}>
            <div style={{
              fontWeight:  700, fontSize: "0.9rem", marginBottom: "10px",
              color:       "var(--ion-color-warning-shade)",
              display:     "flex", alignItems: "center", gap: "6px",
            }}>
              <IonIcon icon={warningOutline} /> Próximos viajes programados
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[...rides]
                .filter(r => r.rideType === "scheduled" && r.status === "accepted")
                .sort((a, b) => {
                  if (!a.scheduledPickupAt) return 1;
                  if (!b.scheduledPickupAt) return -1;
                  return new Date(a.scheduledPickupAt).getTime() - new Date(b.scheduledPickupAt).getTime();
                })
                .map((ride) => {
                  const soon = ride.scheduledPickupAt ? isPickupSoon(ride.scheduledPickupAt) : false;
                  return (
                    <IonCard key={ride.id} style={{ margin: 0, border: "2px solid var(--ion-color-warning)" }}>
                      <IonCardContent style={{ padding: "14px 16px" }}>

                        {/* Alerta / aviso horario */}
                        {soon ? (
                          <div style={{
                            display: "flex", alignItems: "center", gap: "6px",
                            padding: "8px 10px",
                            background: "var(--ion-color-danger-tint, #fde8e8)",
                            borderRadius: "8px", marginBottom: "10px",
                            fontSize: "0.8rem", color: "var(--ion-color-danger)", fontWeight: 600,
                          }}>
                            <IonIcon icon={warningOutline} style={{ fontSize: "1rem", flexShrink: 0 }} />
                            Reserva próxima: prepárate para ir al punto de recogida.
                          </div>
                        ) : (
                          <div style={{
                            padding: "6px 10px", background: "var(--ion-color-light)",
                            borderRadius: "8px", marginBottom: "10px",
                            fontSize: "0.78rem", color: "var(--ion-color-medium)",
                          }}>
                            Viaje programado para más tarde.
                          </div>
                        )}

                        {/* Badges */}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "8px" }}>
                          <IonBadge color="primary" style={{ fontSize: "0.7rem" }}>Programado asignado</IonBadge>
                          <IonBadge color="warning" style={{ fontSize: "0.7rem", fontWeight: 700 }}>PRIORITARIO</IonBadge>
                        </div>

                        {/* Origen → Destino */}
                        <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "8px" }}>
                          {ride.originText} → {ride.destinationText}
                        </div>
                        {ride.stops && ride.stops.length > 0 && (
                          <RideStopsList stops={ride.stops} status={ride.status} />
                        )}

                        {/* Bloque scheduled */}
                        <div style={{
                          padding: "8px 10px",
                          background: "var(--ion-color-warning-tint, #fff8e1)",
                          borderRadius: "8px", marginBottom: "8px", fontSize: "0.8rem",
                        }}>
                          {ride.scheduledPickupAt && (
                            <div style={{ fontWeight: 600, marginBottom: "2px" }}>
                              Recogida: {fmtScheduledPickup(ride.scheduledPickupAt)}
                            </div>
                          )}
                          {ride.flightNumber && (
                            <div>Vuelo: <strong>{ride.flightNumber}</strong></div>
                          )}
                          {ride.priorityFeeClp != null && ride.priorityFeeClp > 0 && (
                            <div style={{ color: "var(--ion-color-warning-shade)", marginTop: "2px" }}>
                              Recargo prioritario incluido: <strong>${ride.priorityFeeClp.toLocaleString("es-CL")} CLP</strong>
                            </div>
                          )}
                        </div>

                        {/* Tarifa */}
                        {ride.estimatedFareClp != null && (
                          <div style={{ fontSize: "0.78rem", fontWeight: 500, marginBottom: "6px" }}>
                            Tarifa est.: ${ride.estimatedFareClp.toLocaleString("es-CL")} CLP
                          </div>
                        )}

                        {/* Advertencia de horario */}
                        {ride.scheduledPickupAt && (
                          <div style={{ fontSize: "0.75rem", color: "var(--ion-color-medium)", marginBottom: "8px", fontStyle: "italic" }}>
                            Programado para {fmtScheduledPickup(ride.scheduledPickupAt)}. Inicia el traslado cuando corresponda.
                          </div>
                        )}

                        {ride.notes && (
                          <div style={{ fontSize: "0.8rem", color: "var(--ion-color-medium)", marginBottom: "8px" }}>{ride.notes}</div>
                        )}

                        {/* Acciones */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          <IonButton size="small" color="tertiary" expand="block"
                            disabled={enRouting === ride.id}
                            onClick={() => void handleEnRoute(ride.id)}
                          >
                            {enRouting === ride.id ? <IonSpinner name="dots" /> : "Voy en camino"}
                          </IonButton>
                          <IonButton size="small" fill="outline" color="danger" expand="block"
                            disabled={cancelling === ride.id}
                            onClick={() => void handleCancelAccepted(ride.id)}
                          >
                            {cancelling === ride.id ? <IonSpinner name="dots" /> : "Cancelar reserva"}
                          </IonButton>
                          <IonButton size="small" fill="outline" color="medium" expand="block"
                            disabled={sharingLocation}
                            onClick={() => void handleShareLocation()}
                          >
                            {sharingLocation ? <IonSpinner name="dots" /> : "📍 Mi ubicación"}
                          </IonButton>
                          <WhatsAppButton
                            phone={RAPAGO_CONTACT.adminPhone}
                            message={WA_MESSAGES.driverToPassenger({ passengerName: "pasajero", driverName: "conductor", origin: ride.originText })}
                            label="Contactar operador"
                          />
                        </div>

                      </IonCardContent>
                    </IonCard>
                  );
                })}
            </div>
          </div>
        )}

        {/* Separador "Otros viajes" si hay ambos tipos */}
        {!loading &&
         rides.some(r => r.rideType === "scheduled" && r.status === "accepted") &&
         rides.some(r => !(r.rideType === "scheduled" && r.status === "accepted")) && (
          <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: "10px", color: "var(--ion-color-dark)" }}>
            Otros viajes
          </div>
        )}

        {/* ── Lista principal (excluye scheduled accepted) ──────────────── */}
        {!loading && rides.filter(r => !(r.rideType === "scheduled" && r.status === "accepted")).length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {rides.filter(r => !(r.rideType === "scheduled" && r.status === "accepted")).map((ride) => {
              const color = DRIVER_STATUS_COLOR[ride.status] ?? "medium";
              const label = DRIVER_STATUS_LABEL[ride.status] ?? ride.status;
              const ts = (lbl: string, iso: string | null) =>
                iso ? <div style={{ fontSize: "0.72rem", color: "var(--ion-color-medium)", marginTop: "3px" }}>{lbl}: {new Date(iso).toLocaleString("es-CL")}</div> : null;
              return (
                <IonCard key={ride.id} style={{ margin: 0 }}>
                  <IonCardContent style={{ padding: "14px 16px" }}>
                    <DriverRideRouteMap
                      status={ride.status}
                      driverPos={driverPos}
                      originLat={ride.originLat}
                      originLng={ride.originLng}
                      destinationLat={ride.destinationLat}
                      destinationLng={ride.destinationLng}
                    />
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginTop: "10px" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "4px" }}>
                          {ride.originText} → {ride.destinationText}
                        </div>
                        {ride.stops && ride.stops.length > 0 && (
                          <RideStopsList stops={ride.stops} status={ride.status} />
                        )}
                        <IonBadge color={color} style={{ fontSize: "0.7rem" }}>{label}</IonBadge>
                        {ride.estimatedFareClp != null && (
                          <div style={{ marginTop: "4px", fontSize: "0.78rem", fontWeight: 500 }}>
                            Tarifa est.: ${ride.estimatedFareClp.toLocaleString("es-CL")} CLP
                          </div>
                        )}
                        {ride.notes && (
                          <div style={{ marginTop: "5px", fontSize: "0.8rem", color: "var(--ion-color-medium)" }}>
                            {ride.notes}
                          </div>
                        )}
                        <div style={{ marginTop: "5px" }}>
                          {ts("Asignado",   ride.acceptedAt)}
                          {ts("En camino",  (ride as DriverRideData & { enRouteAt?: string | null }).enRouteAt ?? null)}
                          {ts("Llegué",     (ride as DriverRideData & { arrivedAt?: string | null }).arrivedAt ?? null)}
                          {(ride.status === "in_progress" || ride.status === "completed") && ts("Iniciado", ride.startedAt)}
                          {ride.status === "completed"  && ts("Completado", ride.completedAt)}
                          {ride.status === "cancelled"  && ts("Cancelado",  ride.cancelledAt)}
                        </div>
                        {ride.status === "cancelled" && ride.cancellationReason && (
                          <div style={{ marginTop: "4px", fontSize: "0.75rem", color: "var(--ion-color-danger)" }}>
                            Motivo: {ride.cancellationReason}
                          </div>
                        )}
                        {ride.status === "cancelled" && ride.cancelledByRole && (
                          <div style={{ fontSize: "0.72rem", color: "var(--ion-color-medium)" }}>
                            Cancelado por: {ride.cancelledByRole === "passenger" ? "pasajero" : "conductor"}
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", flexShrink: 0 }}>
                        {ride.status === "in_progress" && (
                          <IonButton
                            size="small"
                            color="primary"
                            disabled={completing === ride.id}
                            onClick={() => void handleComplete(ride.id)}
                          >
                            {completing === ride.id ? <IonSpinner name="dots" /> : "Finalizar"}
                          </IonButton>
                        )}
                        {ride.status === "driver_arrived" && (
                          <IonButton
                            size="small"
                            color="success"
                            disabled={starting === ride.id}
                            onClick={() => void handleStart(ride.id)}
                          >
                            {starting === ride.id ? <IonSpinner name="dots" /> : "Iniciar viaje"}
                          </IonButton>
                        )}
                        {ride.status === "driver_en_route" && (
                          <IonButton
                            size="small"
                            color="secondary"
                            disabled={arriving === ride.id}
                            onClick={() => void handleArrived(ride.id)}
                          >
                            {arriving === ride.id ? <IonSpinner name="dots" /> : "Llegué"}
                          </IonButton>
                        )}
                        {ride.status === "accepted" && (
                          <>
                            {hasInProgressRide ? (
                              <IonButton size="small" color="tertiary" disabled style={{ opacity: 0.6 }}>
                                Disponible al finalizar<br />tu viaje actual
                              </IonButton>
                            ) : (
                              <IonButton
                                size="small"
                                color="tertiary"
                                disabled={enRouting === ride.id}
                                onClick={() => void handleEnRoute(ride.id)}
                              >
                                {enRouting === ride.id ? <IonSpinner name="dots" /> : "Voy en camino"}
                              </IonButton>
                            )}
                            <IonButton
                              size="small"
                              fill="outline"
                              color="danger"
                              disabled={cancelling === ride.id}
                              onClick={() => void handleCancelAccepted(ride.id)}
                            >
                              {cancelling === ride.id ? <IonSpinner name="dots" /> : "Cancelar"}
                            </IonButton>
                          </>
                        )}
                        {ride.status === "completed" && !ratedIds.has(ride.id) && ratingRideId !== ride.id && (
                          <IonButton
                            size="small"
                            fill="outline"
                            color="warning"
                            onClick={() => { setRatingRideId(ride.id); setRatingStars(5); setRatingComment(""); setRatingError(null); }}
                          >
                            Calificar
                          </IonButton>
                        )}
                        {ride.status === "completed" && ratedIds.has(ride.id) && (
                          <IonText color="success" style={{ fontSize: "0.75rem" }}>✓ Calificado</IonText>
                        )}
                        {["accepted", "driver_en_route", "driver_arrived", "in_progress"].includes(ride.status) && (
                          <>
                            <IonButton
                              size="small"
                              fill="outline"
                              color="medium"
                              disabled={sharingLocation}
                              onClick={() => void handleShareLocation()}
                            >
                              {sharingLocation ? <IonSpinner name="dots" /> : "📍 Mi ubicación"}
                            </IonButton>
                            <WhatsAppButton
                              phone={RAPAGO_CONTACT.adminPhone}
                              message={WA_MESSAGES.driverToPassenger({ passengerName: "pasajero", driverName: "conductor", origin: ride.originText })}
                              label="Contactar operador"
                            />
                          </>
                        )}
                      </div>
                    </div>
                  </IonCardContent>
                </IonCard>
              );
            })}
          </div>
        )}

        {ratingRideId && (
          <IonCard style={{ margin: "12px 0 0" }}>
            <IonCardContent style={{ padding: "14px 16px" }}>
              <div style={{ fontWeight: 600, marginBottom: "4px" }}>Calificar pasajero</div>
              <StarRatingInput value={ratingStars} onChange={setRatingStars} />
              <IonItem lines="none" style={{ "--padding-start": "0" }}>
                <IonTextarea
                  value={ratingComment}
                  onIonInput={(e) => setRatingComment(String(e.detail.value ?? ""))}
                  placeholder="Comentario opcional"
                  maxlength={500}
                  rows={2}
                />
              </IonItem>
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

function clp(amount: number): string {
  return `$${amount.toLocaleString("es-CL")} CLP`;
}

export function DriverEarningsPage(): JSX.Element {
  const { session } = useAuth();
  const [earnings, setEarnings] = useState<TodayEarnings | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const loadEarnings = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const data = await earningsService.getTodayEarnings(session.accessToken);
      setEarnings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar ganancias.");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => { void loadEarnings(); }, [loadEarnings]);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="success">
          <IonTitle>Ganancias</IonTitle>
          <IonButton slot="end" fill="clear" color="light" disabled={loading} onClick={() => void loadEarnings()}>
            {loading ? <IonSpinner name="dots" style={{ width: "18px", height: "18px" }} /> : <IonIcon icon={refreshOutline} />}
          </IonButton>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        {loading && !earnings && (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }}>
            <IonSpinner name="crescent" />
          </div>
        )}

        {error && <IonText color="danger"><p>{error}</p></IonText>}

        {earnings && (
          <>
            <IonCard style={{ margin: "0 0 16px", borderRadius: "16px" }}>
              <div style={{ height: "5px", background: "var(--ion-color-success)" }} />
              <IonCardContent style={{ padding: "16px 18px" }}>
                <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "14px", color: "var(--ion-color-dark)" }}>
                  Ganancias de hoy — {earnings.date}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <IonText color="medium"><span style={{ fontSize: "0.85rem" }}>Viajes completados</span></IonText>
                    <IonBadge color="success" style={{ fontSize: "0.85rem", padding: "4px 10px" }}>{earnings.completedRides}</IonBadge>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--ion-color-light-shade)", paddingTop: "10px" }}>
                    <IonText color="medium"><span style={{ fontSize: "0.85rem" }}>Total bruto</span></IonText>
                    <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>{clp(earnings.grossFareClp)}</span>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <IonText color="danger"><span style={{ fontSize: "0.85rem" }}>Comisión app ({earnings.appCommissionPercent}%)</span></IonText>
                    <IonText color="danger"><span style={{ fontWeight: 600, fontSize: "0.95rem" }}>−{clp(earnings.appCommissionClp)}</span></IonText>
                  </div>

                  <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    borderTop: "2px solid var(--ion-color-success)", paddingTop: "10px",
                  }}>
                    <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--ion-color-success-shade)" }}>Ganancia neta</span>
                    <span style={{ fontWeight: 800, fontSize: "1.15rem", color: "var(--ion-color-success-shade)" }}>{clp(earnings.netEarningsClp)}</span>
                  </div>
                </div>

                <div style={{ marginTop: "14px", padding: "8px 10px", background: "var(--ion-color-warning-tint)", borderRadius: "8px" }}>
                  <IonText color="warning">
                    <p style={{ margin: 0, fontSize: "0.72rem" }}>
                      ⚠️ Monto referencial. No corresponde a liquidación ni pago real.
                    </p>
                  </IonText>
                </div>
              </IonCardContent>
            </IonCard>

            {earnings.completedRides === 0 && (
              <IonText color="medium">
                <p style={{ textAlign: "center", fontStyle: "italic", marginTop: "8px" }}>
                  Aún no tienes viajes completados hoy.
                </p>
              </IonText>
            )}
          </>
        )}
      </IonContent>
    </IonPage>
  );
}

const LANGUAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "es",       label: "Español" },
  { value: "en",       label: "Inglés" },
  { value: "rapa_nui", label: "Rapa Nui" },
  { value: "fr",       label: "Francés" },
];

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

export function DriverProfilePage(): JSX.Element {
  const { session } = useAuth();

  // Form fields
  const [phone,           setPhone]           = useState("");
  const [vehicleBrand,    setVehicleBrand]    = useState("");
  const [vehicleModel,    setVehicleModel]    = useState("");
  const [vehicleYear,     setVehicleYear]     = useState("");
  const [vehiclePlate,    setVehiclePlate]    = useState("");
  const [vehicleColor,    setVehicleColor]    = useState("");
  const [licenseNumber,   setLicenseNumber]   = useState("");
  const [licenseExpiry,   setLicenseExpiry]   = useState("");
  const [profilePhotoUrl, setProfilePhotoUrl] = useState("");
  const [bio,             setBio]             = useState("");
  const [languages,       setLanguages]       = useState<string[]>([]);

  const [loading, setLoading]   = useState(true);
  const [saving,  setSaving]    = useState(false);
  const [error,   setError]     = useState<string | null>(null);
  const [success, setSuccess]   = useState(false);

  const loadProfile = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const profile = await driverProfileService.getMyProfile(session.accessToken);
      if (profile) {
        setPhone(profile.phone ?? "");
        setVehicleBrand(profile.vehicleBrand ?? "");
        setVehicleModel(profile.vehicleModel ?? "");
        setVehicleYear(profile.vehicleYear != null ? String(profile.vehicleYear) : "");
        setVehiclePlate(profile.vehiclePlate ?? "");
        setVehicleColor(profile.vehicleColor ?? "");
        setLicenseNumber(profile.licenseNumber ?? "");
        setLicenseExpiry(profile.licenseExpiry ?? "");
        setProfilePhotoUrl(profile.profilePhotoUrl ?? "");
        setBio(profile.bio ?? "");
        setLanguages(profile.languages ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar perfil.");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  async function handleSave() {
    if (!session?.accessToken) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const payload: Parameters<typeof driverProfileService.upsertMyProfile>[1] = {};
      if (phone)           payload.phone           = phone;
      if (vehicleBrand)    payload.vehicleBrand    = vehicleBrand;
      if (vehicleModel)    payload.vehicleModel    = vehicleModel;
      if (vehicleYear)     payload.vehicleYear     = parseInt(vehicleYear, 10);
      if (vehiclePlate)    payload.vehiclePlate    = vehiclePlate;
      if (vehicleColor)    payload.vehicleColor    = vehicleColor;
      if (licenseNumber)   payload.licenseNumber   = licenseNumber;
      if (licenseExpiry)   payload.licenseExpiry   = licenseExpiry;
      if (profilePhotoUrl) payload.profilePhotoUrl = profilePhotoUrl;
      if (bio)             payload.bio             = bio;
      if (languages.length > 0) payload.languages  = languages;

      await driverProfileService.upsertMyProfile(session.accessToken, payload);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar perfil.");
    } finally {
      setSaving(false);
    }
  }

  function toggleLanguage(lang: string) {
    setLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
    );
  }

  const licenseExpiringSoon = isLicenseExpiringSoon(licenseExpiry || null);
  const licenseExpiredNow   = isLicenseExpired(licenseExpiry || null);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="success">
          <IonTitle>Mi Perfil</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        {loading && (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }}>
            <IonSpinner name="crescent" />
          </div>
        )}

        {!loading && (
          <>
            {/* Missing phone warning */}
            {!phone && (
              <div style={{
                background:   "var(--ion-color-warning-tint)",
                border:       "1px solid var(--ion-color-warning)",
                borderRadius: "8px",
                padding:      "10px 14px",
                marginBottom: "16px",
                fontSize:     "0.85rem",
                color:        "var(--ion-color-warning-shade)",
              }}>
                Agrega tu número de teléfono para que los pasajeros puedan contactarte.
              </div>
            )}

            {/* License warnings */}
            {licenseExpiredNow && (
              <div style={{
                background:   "var(--ion-color-danger-tint)",
                border:       "1px solid var(--ion-color-danger)",
                borderRadius: "8px",
                padding:      "10px 14px",
                marginBottom: "16px",
                fontSize:     "0.85rem",
                color:        "var(--ion-color-danger-shade)",
              }}>
                Tu licencia de conducir ha vencido. Actualiza la fecha de vencimiento.
              </div>
            )}
            {!licenseExpiredNow && licenseExpiringSoon && (
              <div style={{
                background:   "var(--ion-color-warning-tint)",
                border:       "1px solid var(--ion-color-warning)",
                borderRadius: "8px",
                padding:      "10px 14px",
                marginBottom: "16px",
                fontSize:     "0.85rem",
                color:        "var(--ion-color-warning-shade)",
              }}>
                Tu licencia vence en menos de 30 días. Renuévala pronto.
              </div>
            )}

            {/* Personal data */}
            <IonCard style={{ margin: "0 0 16px" }}>
              <IonCardContent>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: "8px" }}>Datos personales</div>
                <IonItem lines="full">
                  <IonLabel position="stacked">Nombre</IonLabel>
                  <IonInput value={session?.user?.name ?? ""} readonly disabled />
                </IonItem>
                <IonItem lines="full">
                  <IonLabel position="stacked">Correo electrónico</IonLabel>
                  <IonInput value={session?.user?.email ?? ""} readonly disabled />
                </IonItem>
                <IonItem lines="none">
                  <IonLabel position="stacked">Teléfono</IonLabel>
                  <IonInput
                    type="tel"
                    placeholder="+56 9 1234 5678"
                    value={phone}
                    onIonInput={(e) => setPhone(String(e.detail.value ?? ""))}
                    maxlength={20}
                  />
                </IonItem>
              </IonCardContent>
            </IonCard>

            {/* Profile photo */}
            <IonCard style={{ margin: "0 0 16px" }}>
              <IonCardContent>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: "8px" }}>Foto de perfil</div>
                <IonItem lines="none">
                  <IonLabel position="stacked">URL de foto</IonLabel>
                  <IonInput
                    type="url"
                    placeholder="https://ejemplo.com/foto.jpg"
                    value={profilePhotoUrl}
                    onIonInput={(e) => setProfilePhotoUrl(String(e.detail.value ?? ""))}
                  />
                </IonItem>
                {profilePhotoUrl && (
                  <div style={{ textAlign: "center", marginTop: "8px" }}>
                    <img
                      src={profilePhotoUrl}
                      alt="Foto de perfil"
                      style={{ width: "80px", height: "80px", borderRadius: "50%", objectFit: "cover" }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  </div>
                )}
              </IonCardContent>
            </IonCard>

            {/* Vehicle */}
            <IonCard style={{ margin: "0 0 16px" }}>
              <IonCardContent>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: "8px" }}>Vehículo</div>
                <IonItem lines="full">
                  <IonLabel position="stacked">Marca</IonLabel>
                  <IonInput
                    placeholder="Toyota"
                    value={vehicleBrand}
                    onIonInput={(e) => setVehicleBrand(String(e.detail.value ?? ""))}
                    maxlength={50}
                  />
                </IonItem>
                <IonItem lines="full">
                  <IonLabel position="stacked">Modelo</IonLabel>
                  <IonInput
                    placeholder="Yaris"
                    value={vehicleModel}
                    onIonInput={(e) => setVehicleModel(String(e.detail.value ?? ""))}
                    maxlength={50}
                  />
                </IonItem>
                <IonItem lines="full">
                  <IonLabel position="stacked">Año</IonLabel>
                  <IonInput
                    type="number"
                    placeholder="2020"
                    value={vehicleYear}
                    onIonInput={(e) => setVehicleYear(String(e.detail.value ?? ""))}
                    min="1990"
                    max="2030"
                  />
                </IonItem>
                <IonItem lines="full">
                  <IonLabel position="stacked">Patente</IonLabel>
                  <IonInput
                    placeholder="ABCD12"
                    value={vehiclePlate}
                    onIonInput={(e) => setVehiclePlate(String(e.detail.value ?? "").toUpperCase())}
                    maxlength={10}
                  />
                </IonItem>
                <IonItem lines="none">
                  <IonLabel position="stacked">Color</IonLabel>
                  <IonInput
                    placeholder="Blanco"
                    value={vehicleColor}
                    onIonInput={(e) => setVehicleColor(String(e.detail.value ?? ""))}
                    maxlength={30}
                  />
                </IonItem>
              </IonCardContent>
            </IonCard>

            {/* License */}
            <IonCard style={{ margin: "0 0 16px" }}>
              <IonCardContent>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: "8px" }}>Licencia de conducir</div>
                <IonItem lines="full">
                  <IonLabel position="stacked">Número de licencia</IonLabel>
                  <IonInput
                    placeholder="12345678-9"
                    value={licenseNumber}
                    onIonInput={(e) => setLicenseNumber(String(e.detail.value ?? ""))}
                    maxlength={30}
                  />
                </IonItem>
                <IonItem lines="none">
                  <IonLabel position="stacked">
                    Vencimiento
                    {licenseExpiredNow && <span style={{ color: "var(--ion-color-danger)", marginLeft: "6px" }}>VENCIDA</span>}
                    {!licenseExpiredNow && licenseExpiringSoon && <span style={{ color: "var(--ion-color-warning)", marginLeft: "6px" }}>Próxima a vencer</span>}
                  </IonLabel>
                  <IonInput
                    type="date"
                    value={licenseExpiry}
                    onIonInput={(e) => setLicenseExpiry(String(e.detail.value ?? ""))}
                  />
                </IonItem>
              </IonCardContent>
            </IonCard>

            {/* Bio */}
            <IonCard style={{ margin: "0 0 16px" }}>
              <IonCardContent>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: "8px" }}>Biografía</div>
                <IonItem lines="none">
                  <IonTextarea
                    placeholder="Cuéntanos sobre ti..."
                    value={bio}
                    onIonInput={(e) => setBio(String(e.detail.value ?? ""))}
                    maxlength={500}
                    rows={3}
                  />
                </IonItem>
              </IonCardContent>
            </IonCard>

            {/* Languages */}
            <IonCard style={{ margin: "0 0 16px" }}>
              <IonCardContent>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: "8px" }}>Idiomas</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", padding: "4px 0" }}>
                  {LANGUAGE_OPTIONS.map((lang) => (
                    <IonChip
                      key={lang.value}
                      color={languages.includes(lang.value) ? "success" : "medium"}
                      onClick={() => toggleLanguage(lang.value)}
                    >
                      <IonLabel>{lang.label}</IonLabel>
                    </IonChip>
                  ))}
                </div>
              </IonCardContent>
            </IonCard>

            {error && <IonText color="danger"><p style={{ fontSize: "0.88rem" }}>{error}</p></IonText>}
            {success && <IonText color="success"><p style={{ fontSize: "0.88rem" }}>Perfil guardado correctamente.</p></IonText>}

            <IonButton
              expand="block"
              color="success"
              disabled={saving}
              onClick={() => void handleSave()}
              style={{ marginTop: "8px" }}
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
