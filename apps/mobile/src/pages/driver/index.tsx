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

  const [rides,     setRides]     = useState<import("../../features/rides/rides.service").AvailableRideData[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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
        {/* Notice — aceptar viaje es futuro */}
        <div style={{
          background:   "var(--ion-color-warning-tint)",
          border:       "1px solid var(--ion-color-warning)",
          borderRadius: "8px",
          padding:      "10px 14px",
          marginBottom: "16px",
          fontSize:     "0.82rem",
          color:        "var(--ion-color-warning-shade)",
        }}>
          <strong>Aceptar viaje y asignación de conductor se implementarán en una fase futura.</strong><br />
          Por ahora puedes ver las solicitudes disponibles.
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
              No hay solicitudes disponibles en este momento.
            </p>
          </IonText>
        )}

        {!loading && rides.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {rides.map((ride) => (
              <IonCard key={ride.id} style={{ margin: 0 }}>
                <IonCardContent style={{ padding: "14px 16px" }}>
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
  const m = meta("/driver/trips");
  return (
    <IonPage>
      <IonHeader><IonToolbar color="success"><IonTitle>{m.label}</IonTitle></IonToolbar></IonHeader>
      <IonContent className="ion-padding"><ModulePlaceholderPage title={m.label} role="driver" plannedFeatures={m.plannedFeatures} /></IonContent>
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
