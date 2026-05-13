import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonNote,
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
  compassOutline,
  keyOutline,
  personOutline,
  walletOutline,
} from "ionicons/icons";
import { ModulePlaceholderPage } from "../../components/ModulePlaceholderPage";
import { HomeHeader } from "../../components/HomeHeader";
import { ActionCard } from "../../components/ActionCard";
import { ROUTE_METADATA } from "../../navigation/routeConfig";
import { ROUTES } from "../../navigation/routes";
import { useAuth } from "../../features/auth";
import { ridesService, type RideRequestData } from "../../features/rides/rides.service";

function meta(path: string) {
  return ROUTE_METADATA.find((r) => r.path === path)!;
}

const PENDING = "Módulo preparado, implementación funcional pendiente.";

const RIDE_STATUS_LABEL: Record<string, string> = {
  requested:  "Solicitado",
  accepted:   "Aceptado",
  in_progress:"En curso",
  completed:  "Completado",
  cancelled:  "Cancelado",
};

const RIDE_STATUS_COLOR: Record<string, string> = {
  requested:   "warning",
  accepted:    "primary",
  in_progress: "secondary",
  completed:   "success",
  cancelled:   "medium",
};

export function PassengerHomePage(): JSX.Element {
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
            icon={carOutline}
            title="Solicitar Viaje"
            subtitle={PENDING}
            route={ROUTES.PASSENGER.REQUEST_RIDE}
            color="primary"
          />
          <ActionCard
            icon={carOutline}
            title="Mis Viajes"
            subtitle={PENDING}
            route={ROUTES.PASSENGER.TRIPS}
            color="primary"
          />
          <ActionCard
            icon={compassOutline}
            title="Guías Turísticos"
            subtitle={PENDING}
            route={ROUTES.PASSENGER.GUIDES}
            color="primary"
          />
          <ActionCard
            icon={keyOutline}
            title="Arriendo"
            subtitle={PENDING}
            route={ROUTES.PASSENGER.RENTALS}
            color="primary"
          />
          <ActionCard
            icon={walletOutline}
            title="Wallet"
            subtitle={PENDING}
            route={ROUTES.PASSENGER.WALLET}
            color="primary"
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

export function PassengerRequestRidePage(): JSX.Element {
  return <RequestRidePage />;
}

function RequestRidePage(): JSX.Element {
  const { session } = useAuth();

  const [originInput, setOriginInput]  = useState("");
  const [destInput,   setDestInput]    = useState("");
  const [notesInput,  setNotesInput]   = useState("");
  const [submitting,  setSubmitting]   = useState(false);
  const [submitError, setSubmitError]  = useState<string | null>(null);
  const [submitted,   setSubmitted]    = useState<RideRequestData | null>(null);

  async function handleRequest() {
    if (!session?.accessToken) return;
    const origin = originInput.trim();
    const dest   = destInput.trim();
    if (!origin || !dest) {
      setSubmitError("Origen y destino son requeridos.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const input: import("../../features/rides/rides.service").CreateRideInput = {
        originText:      origin,
        destinationText: dest,
      };
      const trimNotes = notesInput.trim();
      if (trimNotes) input.notes = trimNotes;
      const ride = await ridesService.createRideRequest(session.accessToken, input);
      setSubmitted(ride);
      setOriginInput("");
      setDestInput("");
      setNotesInput("");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Error al solicitar el viaje.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Solicitar Viaje</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        {/* Notice — mapa futuro */}
        <div style={{
          background:   "var(--ion-color-warning-tint)",
          border:       "1px solid var(--ion-color-warning)",
          borderRadius: "8px",
          padding:      "10px 14px",
          marginBottom: "16px",
          fontSize:     "0.82rem",
          color:        "var(--ion-color-warning-shade)",
        }}>
          <strong>Ubicación en mapa y asignación de conductor se implementarán en una fase futura.</strong><br />
          Por ahora ingresa origen y destino como texto.
        </div>

        <IonCard>
          <IonCardContent style={{ paddingTop: "12px" }}>
            <IonItem lines="full">
              <IonLabel position="stacked">Origen</IonLabel>
              <IonInput
                value={originInput}
                onIonInput={(e) => setOriginInput(String(e.detail.value ?? ""))}
                placeholder="Ej: Hotel Hanga Roa Eco Village"
                maxlength={150}
                clearInput
              />
            </IonItem>

            <IonItem lines="full" style={{ marginTop: "8px" }}>
              <IonLabel position="stacked">Destino</IonLabel>
              <IonInput
                value={destInput}
                onIonInput={(e) => setDestInput(String(e.detail.value ?? ""))}
                placeholder="Ej: Aeropuerto Mataveri"
                maxlength={150}
                clearInput
              />
            </IonItem>

            <IonItem lines="none" style={{ marginTop: "8px" }}>
              <IonLabel position="stacked">Notas (opcional)</IonLabel>
              <IonTextarea
                value={notesInput}
                onIonInput={(e) => setNotesInput(String(e.detail.value ?? ""))}
                placeholder="Ej: Llevar maletas grandes"
                maxlength={500}
                rows={3}
              />
              <IonNote slot="helper" style={{ fontSize: "0.7rem" }}>Máximo 500 caracteres.</IonNote>
            </IonItem>

            {submitted && (
              <IonText color="success">
                <p style={{ margin: "8px 0 0", fontSize: "0.85rem" }}>
                  ✓ Solicitud enviada. ID: {submitted.id.slice(0, 8)}… — Estado: {RIDE_STATUS_LABEL[submitted.status] ?? submitted.status}
                </p>
              </IonText>
            )}
            {submitError && (
              <IonText color="danger">
                <p style={{ margin: "8px 0 0", fontSize: "0.85rem" }}>{submitError}</p>
              </IonText>
            )}

            <IonButton
              expand="block"
              style={{ marginTop: "16px" }}
              onClick={() => void handleRequest()}
              disabled={submitting}
            >
              {submitting ? <IonSpinner name="dots" /> : "Solicitar viaje"}
            </IonButton>
          </IonCardContent>
        </IonCard>
      </IonContent>
    </IonPage>
  );
}

export function PassengerTripsPage(): JSX.Element {
  return <TripsPage />;
}

function TripsPage(): JSX.Element {
  const { session } = useAuth();

  const [rides,       setRides]       = useState<RideRequestData[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [loadError,   setLoadError]   = useState<string | null>(null);
  const [cancelling,  setCancelling]  = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const loadRides = useCallback(async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await ridesService.listMyRides(session.accessToken);
      setRides(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Error al cargar tus viajes.");
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => { void loadRides(); }, [loadRides]);

  async function handleCancel(rideId: string) {
    if (!session?.accessToken) return;
    setCancelling(rideId);
    setCancelError(null);
    try {
      const updated = await ridesService.cancelRideRequest(session.accessToken, rideId);
      setRides((prev) => prev.map((r) => (r.id === rideId ? updated : r)));
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "Error al cancelar el viaje.");
    } finally {
      setCancelling(null);
    }
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
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

        {!loading && rides.length === 0 && (
          <IonText color="medium"><p>No tienes solicitudes de viaje todavía.</p></IonText>
        )}

        {!loading && rides.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {rides.map((ride) => {
              const color = RIDE_STATUS_COLOR[ride.status] ?? "medium";
              const label = RIDE_STATUS_LABEL[ride.status] ?? ride.status;
              return (
                <IonCard key={ride.id} style={{ margin: 0 }}>
                  <IonCardContent style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: "0.9rem", marginBottom: "4px" }}>
                          {ride.originText} → {ride.destinationText}
                        </div>
                        <IonBadge color={color} style={{ fontSize: "0.7rem" }}>{label}</IonBadge>
                        {ride.notes && (
                          <div style={{ marginTop: "6px", fontSize: "0.8rem", color: "var(--ion-color-medium)" }}>
                            {ride.notes}
                          </div>
                        )}
                        <div style={{ marginTop: "6px", fontSize: "0.75rem", color: "var(--ion-color-medium)" }}>
                          {new Date(ride.requestedAt).toLocaleString("es-CL")}
                        </div>
                      </div>
                      {ride.status === "requested" && (
                        <IonButton
                          size="small"
                          fill="outline"
                          color="danger"
                          disabled={cancelling === ride.id}
                          onClick={() => void handleCancel(ride.id)}
                          style={{ flexShrink: 0 }}
                        >
                          {cancelling === ride.id ? <IonSpinner name="dots" /> : "Cancelar"}
                        </IonButton>
                      )}
                    </div>
                  </IonCardContent>
                </IonCard>
              );
            })}
          </div>
        )}

        {cancelError && (
          <IonText color="danger">
            <p style={{ marginTop: "12px", fontSize: "0.85rem" }}>{cancelError}</p>
          </IonText>
        )}
      </IonContent>
    </IonPage>
  );
}

export function PassengerGuidesPage(): JSX.Element {
  const m = meta("/passenger/guides");
  return (
    <IonPage>
      <IonHeader><IonToolbar color="primary"><IonTitle>{m.label}</IonTitle></IonToolbar></IonHeader>
      <IonContent className="ion-padding"><ModulePlaceholderPage title={m.label} role="passenger" plannedFeatures={m.plannedFeatures} /></IonContent>
    </IonPage>
  );
}

export function PassengerRentalsPage(): JSX.Element {
  const m = meta("/passenger/rentals");
  return (
    <IonPage>
      <IonHeader><IonToolbar color="primary"><IonTitle>{m.label}</IonTitle></IonToolbar></IonHeader>
      <IonContent className="ion-padding"><ModulePlaceholderPage title={m.label} role="passenger" plannedFeatures={m.plannedFeatures} /></IonContent>
    </IonPage>
  );
}

export function PassengerWalletPage(): JSX.Element {
  const m = meta("/passenger/wallet");
  return (
    <IonPage>
      <IonHeader><IonToolbar color="primary"><IonTitle>{m.label}</IonTitle></IonToolbar></IonHeader>
      <IonContent className="ion-padding"><ModulePlaceholderPage title={m.label} role="passenger" plannedFeatures={m.plannedFeatures} /></IonContent>
    </IonPage>
  );
}

export function PassengerProfilePage(): JSX.Element {
  const m = meta("/passenger/profile");
  return (
    <IonPage>
      <IonHeader><IonToolbar color="primary"><IonTitle>{m.label}</IonTitle></IonToolbar></IonHeader>
      <IonContent className="ion-padding"><ModulePlaceholderPage title={m.label} role="passenger" plannedFeatures={m.plannedFeatures} /></IonContent>
    </IonPage>
  );
}
