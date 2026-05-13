import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from "@ionic/react";
import {
  carOutline,
  cashOutline,
  listOutline,
  personOutline,
} from "ionicons/icons";
import { ModulePlaceholderPage } from "../../components/ModulePlaceholderPage";
import { HomeHeader } from "../../components/HomeHeader";
import { ActionCard } from "../../components/ActionCard";
import { ROUTE_METADATA } from "../../navigation/routeConfig";
import { ROUTES } from "../../navigation/routes";

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
  const m = meta("/driver/requests");
  return (
    <IonPage>
      <IonHeader><IonToolbar color="success"><IonTitle>{m.label}</IonTitle></IonToolbar></IonHeader>
      <IonContent className="ion-padding"><ModulePlaceholderPage title={m.label} role="driver" plannedFeatures={m.plannedFeatures} /></IonContent>
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
