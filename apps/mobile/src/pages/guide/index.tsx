import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from "@ionic/react";
import {
  bookOutline,
  cashOutline,
  compassOutline,
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

export function GuideHomePage(): JSX.Element {
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
            icon={compassOutline}
            title="Mis Tours"
            subtitle={PENDING}
            route={ROUTES.GUIDE.TOURS}
            color="warning"
          />
          <ActionCard
            icon={bookOutline}
            title="Reservas"
            subtitle={PENDING}
            route={ROUTES.GUIDE.BOOKINGS}
            color="warning"
          />
          <ActionCard
            icon={cashOutline}
            title="Ganancias"
            subtitle={PENDING}
            route={ROUTES.GUIDE.EARNINGS}
            color="warning"
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

export function GuideToursPage(): JSX.Element {
  const m = meta("/guide/tours");
  return (
    <IonPage>
      <IonHeader><IonToolbar color="warning"><IonTitle>{m.label}</IonTitle></IonToolbar></IonHeader>
      <IonContent className="ion-padding"><ModulePlaceholderPage title={m.label} role="guide" plannedFeatures={m.plannedFeatures} /></IonContent>
    </IonPage>
  );
}

export function GuideBookingsPage(): JSX.Element {
  const m = meta("/guide/bookings");
  return (
    <IonPage>
      <IonHeader><IonToolbar color="warning"><IonTitle>{m.label}</IonTitle></IonToolbar></IonHeader>
      <IonContent className="ion-padding"><ModulePlaceholderPage title={m.label} role="guide" plannedFeatures={m.plannedFeatures} /></IonContent>
    </IonPage>
  );
}

export function GuideEarningsPage(): JSX.Element {
  const m = meta("/guide/earnings");
  return (
    <IonPage>
      <IonHeader><IonToolbar color="warning"><IonTitle>{m.label}</IonTitle></IonToolbar></IonHeader>
      <IonContent className="ion-padding"><ModulePlaceholderPage title={m.label} role="guide" plannedFeatures={m.plannedFeatures} /></IonContent>
    </IonPage>
  );
}

export function GuideProfilePage(): JSX.Element {
  const m = meta("/guide/profile");
  return (
    <IonPage>
      <IonHeader><IonToolbar color="warning"><IonTitle>{m.label}</IonTitle></IonToolbar></IonHeader>
      <IonContent className="ion-padding"><ModulePlaceholderPage title={m.label} role="guide" plannedFeatures={m.plannedFeatures} /></IonContent>
    </IonPage>
  );
}
