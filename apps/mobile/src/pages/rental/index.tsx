import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from "@ionic/react";
import {
  bookOutline,
  carOutline,
  cashOutline,
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

export function RentalHomePage(): JSX.Element {
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
            title="Vehículos"
            subtitle={PENDING}
            route={ROUTES.RENTAL.VEHICLES}
            color="tertiary"
          />
          <ActionCard
            icon={bookOutline}
            title="Reservas"
            subtitle={PENDING}
            route={ROUTES.RENTAL.BOOKINGS}
            color="tertiary"
          />
          <ActionCard
            icon={cashOutline}
            title="Ganancias"
            subtitle={PENDING}
            route={ROUTES.RENTAL.EARNINGS}
            color="tertiary"
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

export function RentalVehiclesPage(): JSX.Element {
  const m = meta("/rental/vehicles");
  return (
    <IonPage>
      <IonHeader><IonToolbar color="tertiary"><IonTitle>{m.label}</IonTitle></IonToolbar></IonHeader>
      <IonContent className="ion-padding"><ModulePlaceholderPage title={m.label} role="rental" plannedFeatures={m.plannedFeatures} /></IonContent>
    </IonPage>
  );
}

export function RentalBookingsPage(): JSX.Element {
  const m = meta("/rental/bookings");
  return (
    <IonPage>
      <IonHeader><IonToolbar color="tertiary"><IonTitle>{m.label}</IonTitle></IonToolbar></IonHeader>
      <IonContent className="ion-padding"><ModulePlaceholderPage title={m.label} role="rental" plannedFeatures={m.plannedFeatures} /></IonContent>
    </IonPage>
  );
}

export function RentalEarningsPage(): JSX.Element {
  const m = meta("/rental/earnings");
  return (
    <IonPage>
      <IonHeader><IonToolbar color="tertiary"><IonTitle>{m.label}</IonTitle></IonToolbar></IonHeader>
      <IonContent className="ion-padding"><ModulePlaceholderPage title={m.label} role="rental" plannedFeatures={m.plannedFeatures} /></IonContent>
    </IonPage>
  );
}

export function RentalProfilePage(): JSX.Element {
  const m = meta("/rental/profile");
  return (
    <IonPage>
      <IonHeader><IonToolbar color="tertiary"><IonTitle>{m.label}</IonTitle></IonToolbar></IonHeader>
      <IonContent className="ion-padding"><ModulePlaceholderPage title={m.label} role="rental" plannedFeatures={m.plannedFeatures} /></IonContent>
    </IonPage>
  );
}
