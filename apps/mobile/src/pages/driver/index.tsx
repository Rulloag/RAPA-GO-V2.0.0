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
import { driverProfileService } from "../../features/drivers/driverProfile.service";
import { HomeHeader } from "../../components/HomeHeader";
import { ActionCard } from "../../components/ActionCard";
import { useConnectivity } from "../../hooks/useConnectivity";
import { ROUTE_METADATA } from "../../navigation/routeConfig";
import { ROUTES } from "../../navigation/routes";
import { useAuth } from "../../features/auth";
import { ridesService } from "../../features/rides/rides.service";
import { MapFallback } from "../../components/MapFallback";
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
                  <MapFallback
                    origin={{ text: ride.originText }}
                    destination={{ text: ride.destinationText }}
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
                    <MapFallback
                      origin={{ text: ride.originText }}
                      destination={{ text: ride.destinationText }}
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
          </>
        )}
      </IonContent>
    </IonPage>
  );
}
