import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonPage,
  IonSpinner,
  IonText,
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
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "6px" }}>
                        {ride.originText} → {ride.destinationText}
                      </div>
                      <IonBadge color="warning" style={{ fontSize: "0.7rem" }}>Solicitado</IonBadge>
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
        {cancelError && <IonText color="danger"><p style={{ fontSize: "0.85rem" }}>{cancelError}</p></IonText>}
        {startError && <IonText color="danger"><p style={{ fontSize: "0.85rem" }}>{startError}</p></IonText>}
        {completeError && <IonText color="danger"><p style={{ fontSize: "0.85rem" }}>{completeError}</p></IonText>}

        {!loading && rides.length === 0 && (
          <IonText color="medium"><p>No tienes viajes aceptados todavía.</p></IonText>
        )}

        {!loading && rides.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {rides.map((ride) => {
              const color = DRIVER_STATUS_COLOR[ride.status] ?? "medium";
              const label = DRIVER_STATUS_LABEL[ride.status] ?? ride.status;
              return (
                <IonCard key={ride.id} style={{ margin: 0 }}>
                  <IonCardContent style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "6px" }}>
                          {ride.originText} → {ride.destinationText}
                        </div>
                        <IonBadge color={color} style={{ fontSize: "0.7rem" }}>{label}</IonBadge>
                        {ride.notes && (
                          <div style={{ marginTop: "6px", fontSize: "0.8rem", color: "var(--ion-color-medium)" }}>
                            {ride.notes}
                          </div>
                        )}
                        {ride.acceptedAt && (
                          <div style={{ marginTop: "6px", fontSize: "0.75rem", color: "var(--ion-color-medium)" }}>
                            Aceptado: {new Date(ride.acceptedAt).toLocaleString("es-CL")}
                          </div>
                        )}
                      </div>
                      {ride.status === "in_progress" && (
                        <IonButton
                          size="small"
                          color="primary"
                          disabled={completing === ride.id}
                          onClick={() => void handleComplete(ride.id)}
                          style={{ flexShrink: 0 }}
                        >
                          {completing === ride.id ? <IonSpinner name="dots" /> : "Finalizar"}
                        </IonButton>
                      )}
                      {ride.status === "accepted" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px", flexShrink: 0 }}>
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
                        </div>
                      )}
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
