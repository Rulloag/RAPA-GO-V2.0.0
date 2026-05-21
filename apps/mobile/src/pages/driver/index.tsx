import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
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
} from "@ionic/react";
import { useEffect, useState, useCallback } from "react";
import {
  carOutline,
  cashOutline,
  listOutline,
  personOutline,
  refreshOutline,
} from "ionicons/icons";
import { IonIcon } from "@ionic/react";
import { ModulePlaceholderPage } from "../../components/ModulePlaceholderPage";
import { HomeHeader } from "../../components/HomeHeader";
import { ActionCard } from "../../components/ActionCard";
import { useConnectivity } from "../../hooks/useConnectivity";
import { ROUTE_METADATA } from "../../navigation/routeConfig";
import { ROUTES } from "../../navigation/routes";
import { useAuth } from "../../features/auth";
import { ridesService } from "../../features/rides/rides.service";
import { MapPlaceholder } from "../../components/MapPlaceholder";
import { driverStatusService } from "../../features/drivers/driverStatus.service";
import { RAPA_NUI_ZONES, getZoneLabel, RAPAGO_CONTACT, WA_MESSAGES } from "@rapa-go/shared";
import { WhatsAppButton } from "../../components/WhatsAppButton";

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
                  <MapPlaceholder
                    originText={ride.originText}
                    destinationText={ride.destinationText}
                    height={130}
                  />
                  <div style={{ marginTop: "10px" }}>
                    <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "6px" }}>
                      {ride.originText} → {ride.destinationText}
                    </div>
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

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="success">
          <IonTitle>Mis Viajes</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonRefresher slot="fixed" onIonRefresh={(e) => { void loadRides().then(() => e.detail.complete()); }}>
          <IonRefresherContent />
        </IonRefresher>
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

        {!loading && rides.length === 0 && (
          <IonText color="medium"><p>No tienes viajes todavía.</p></IonText>
        )}

        {!loading && rides.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {rides.map((ride) => {
              const color = DRIVER_STATUS_COLOR[ride.status] ?? "medium";
              const label = DRIVER_STATUS_LABEL[ride.status] ?? ride.status;
              const ts = (lbl: string, iso: string | null) =>
                iso ? <div style={{ fontSize: "0.72rem", color: "var(--ion-color-medium)", marginTop: "3px" }}>{lbl}: {new Date(iso).toLocaleString("es-CL")}</div> : null;
              return (
                <IonCard key={ride.id} style={{ margin: 0 }}>
                  <IonCardContent style={{ padding: "14px 16px" }}>
                    <MapPlaceholder
                      originText={ride.originText}
                      destinationText={ride.destinationText}
                      height={130}
                    />
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginTop: "10px" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "4px" }}>
                          {ride.originText} → {ride.destinationText}
                        </div>
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
                            <IonButton
                              size="small"
                              color="tertiary"
                              disabled={enRouting === ride.id}
                              onClick={() => void handleEnRoute(ride.id)}
                            >
                              {enRouting === ride.id ? <IonSpinner name="dots" /> : "Voy en camino"}
                            </IonButton>
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
                          <WhatsAppButton
                            phone={RAPAGO_CONTACT.adminPhone}
                            message={WA_MESSAGES.driverToPassenger({ passengerName: "pasajero", driverName: "conductor", origin: ride.originText })}
                            label="Contactar operador"
                          />
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

export function DriverEarningsPage(): JSX.Element {
  const m = meta("/driver/earnings");
  return (
    <IonPage>
      <IonHeader><IonToolbar color="success"><IonTitle>{m.label}</IonTitle></IonToolbar></IonHeader>
      <IonContent className="ion-padding"><ModulePlaceholderPage title={m.label} role="driver" plannedFeatures={m.plannedFeatures} /></IonContent>
    </IonPage>
  );
}

export function DriverProfilePage(): JSX.Element {
  const m = meta("/driver/profile");
  return (
    <IonPage>
      <IonHeader><IonToolbar color="success"><IonTitle>{m.label}</IonTitle></IonToolbar></IonHeader>
      <IonContent className="ion-padding"><ModulePlaceholderPage title={m.label} role="driver" plannedFeatures={m.plannedFeatures} /></IonContent>
    </IonPage>
  );
}
