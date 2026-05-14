import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonItem,
  IonPage,
  IonSpinner,
  IonText,
  IonTextarea,
  IonTitle,
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
import { ROUTE_METADATA } from "../../navigation/routeConfig";
import { ROUTES } from "../../navigation/routes";
import { useAuth } from "../../features/auth";
import { ridesService } from "../../features/rides/rides.service";
import { MapPlaceholder } from "../../components/MapPlaceholder";

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

const PENDING = "Módulo preparado, implementación funcional pendiente.";

export function DriverHomePage(): JSX.Element {
  return (
    <IonPage>
      <HomeHeader title="Inicio" />
      <IonContent className="ion-padding">
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
            subtitle={PENDING}
            route={ROUTES.DRIVER.REQUESTS}
            color="success"
          />
          <ActionCard
            icon={carOutline}
            title="Mis Viajes"
            subtitle={PENDING}
            route={ROUTES.DRIVER.TRIPS}
            color="success"
          />
          <ActionCard
            icon={cashOutline}
            title="Ganancias"
            subtitle={PENDING}
            route={ROUTES.DRIVER.EARNINGS}
            color="success"
          />
          <ActionCard
            icon={personOutline}
            title="Perfil"
            subtitle={PENDING}
            route={ROUTES.PROFILE.INDEX}
            color="medium"
          />
        </div>
      </IonContent>
    </IonPage>
  );
}

export function DriverRequestsPage(): JSX.Element {
  return <AvailableRidesPage />;
}

function AvailableRidesPage(): JSX.Element {
  const { session } = useAuth();
  type AvailableRideData = import("../../features/rides/rides.service").AvailableRideData;

  const [rides,       setRides]       = useState<AvailableRideData[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [loadError,   setLoadError]   = useState<string | null>(null);
  const [accepting,   setAccepting]   = useState<string | null>(null);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  const loadRides = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await ridesService.listAvailableRides(session.accessToken);
      setRides(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Error al cargar solicitudes.");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => { void loadRides(); }, [loadRides]);

  async function handleAccept(rideId: string) {
    if (!session?.accessToken) return;
    setAccepting(rideId);
    setAcceptError(null);
    try {
      await ridesService.acceptRideRequest(session.accessToken, rideId);
      setRides((prev) => prev.filter((r) => r.id !== rideId));
    } catch (err) {
      setAcceptError(err instanceof Error ? err.message : "Error al aceptar el viaje.");
    } finally {
      setAccepting(null);
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="success">
          <IonTitle>Solicitudes Disponibles</IonTitle>
          <div slot="end" style={{ paddingRight: "8px" }}>
            <IonButton fill="clear" color="light" onClick={() => void loadRides()} disabled={loading}>
              <IonIcon icon={refreshOutline} slot="icon-only" />
            </IonButton>
          </div>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        {/* Notice — mapa y finalización son futuros */}
        <div style={{
          background:   "var(--ion-color-warning-tint)",
          border:       "1px solid var(--ion-color-warning)",
          borderRadius: "8px",
          padding:      "10px 14px",
          marginBottom: "16px",
          fontSize:     "0.82rem",
          color:        "var(--ion-color-warning-shade)",
        }}>
          <strong>Mapa, navegación y finalización de viaje se implementarán en una fase futura.</strong>
        </div>

        {loading && (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }}>
            <IonSpinner name="crescent" />
          </div>
        )}

        {loadError && <IonText color="danger"><p>{loadError}</p></IonText>}
        {acceptError && <IonText color="danger"><p style={{ fontSize: "0.85rem" }}>{acceptError}</p></IonText>}

        {!loading && rides.length === 0 && (
          <IonText color="medium">
            <p style={{ textAlign: "center", marginTop: "40px" }}>
              No hay solicitudes disponibles en este momento.
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
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", marginTop: "10px" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "6px" }}>
                        {ride.originText} → {ride.destinationText}
                      </div>
                      <IonBadge color="warning" style={{ fontSize: "0.7rem" }}>Solicitado</IonBadge>
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
                        {new Date(ride.requestedAt).toLocaleString("es-CL")}
                      </div>
                    </div>
                    <IonButton
                      size="small"
                      color="success"
                      disabled={accepting === ride.id}
                      onClick={() => void handleAccept(ride.id)}
                      style={{ flexShrink: 0 }}
                    >
                      {accepting === ride.id ? <IonSpinner name="dots" /> : "Aceptar"}
                    </IonButton>
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
    accepted:    "Aceptado",
    in_progress: "En curso",
    completed:   "Completado",
    cancelled:   "Cancelado",
  };
  const DRIVER_STATUS_COLOR: Record<string, string> = {
    accepted:    "primary",
    in_progress: "secondary",
    completed:   "success",
    cancelled:   "medium",
  };

  const [rides,       setRides]       = useState<DriverRideData[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [loadError,   setLoadError]   = useState<string | null>(null);
  const [cancelling,  setCancelling]  = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
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

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="success">
          <IonTitle>Mis Viajes</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        {loading && (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }}>
            <IonSpinner name="crescent" />
          </div>
        )}

        {loadError && <IonText color="danger"><p>{loadError}</p></IonText>}
        {cancelError && <IonText color="danger"><p style={{ fontSize: "0.85rem" }}>{cancelError}</p></IonText>}
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
                          {ts("Aceptado",   ride.acceptedAt)}
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
                        {ride.status === "accepted" && (
                          <>
                            <IonButton
                              size="small"
                              color="success"
                              disabled={starting === ride.id}
                              onClick={() => void handleStart(ride.id)}
                            >
                              {starting === ride.id ? <IonSpinner name="dots" /> : "Iniciar"}
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
