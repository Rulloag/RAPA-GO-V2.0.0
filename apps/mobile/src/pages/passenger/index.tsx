import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from "@ionic/react";
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

function meta(path: string) {
  return ROUTE_METADATA.find((r) => r.path === path)!;
}

const PENDING = "Módulo preparado, implementación funcional pendiente.";

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
  const m = meta("/passenger/request-ride");
  return (
    <IonPage>
      <IonHeader><IonToolbar color="primary"><IonTitle>{m.label}</IonTitle></IonToolbar></IonHeader>
      <IonContent className="ion-padding"><ModulePlaceholderPage title={m.label} role="passenger" plannedFeatures={m.plannedFeatures} /></IonContent>
    </IonPage>
  );
}

export function PassengerTripsPage(): JSX.Element {
  const m = meta("/passenger/trips");
  return (
    <IonPage>
      <IonHeader><IonToolbar color="primary"><IonTitle>{m.label}</IonTitle></IonToolbar></IonHeader>
      <IonContent className="ion-padding"><ModulePlaceholderPage title={m.label} role="passenger" plannedFeatures={m.plannedFeatures} /></IonContent>
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
