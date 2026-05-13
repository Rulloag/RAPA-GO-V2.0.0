import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from "@ionic/react";
import {
  cardOutline,
  carOutline,
  compassOutline,
  keyOutline,
  peopleOutline,
  personOutline,
  settingsOutline,
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

export function AdminHomePage(): JSX.Element {
  return (
    <IonPage>
      <HomeHeader title="Panel Admin" />
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
            icon={peopleOutline}
            title="Usuarios"
            subtitle={PENDING}
            route={ROUTES.ADMIN.USERS}
            color="danger"
          />
          <ActionCard
            icon={carOutline}
            title="Conductores"
            subtitle={PENDING}
            route={ROUTES.ADMIN.DRIVERS}
            color="danger"
          />
          <ActionCard
            icon={compassOutline}
            title="Guías"
            subtitle={PENDING}
            route={ROUTES.ADMIN.GUIDES}
            color="danger"
          />
          <ActionCard
            icon={keyOutline}
            title="Rent a Car"
            subtitle={PENDING}
            route={ROUTES.ADMIN.RENTALS}
            color="danger"
          />
          <ActionCard
            icon={personOutline}
            title="Viajes"
            subtitle={PENDING}
            route={ROUTES.ADMIN.TRIPS}
            color="danger"
          />
          <ActionCard
            icon={cardOutline}
            title="Pagos"
            subtitle={PENDING}
            route={ROUTES.ADMIN.PAYMENTS}
            color="danger"
          />
          <ActionCard
            icon={settingsOutline}
            title="Configuración"
            subtitle={PENDING}
            route={ROUTES.ADMIN.SETTINGS}
            color="medium"
          />
        </div>
      </IonContent>
    </IonPage>
  );
}

export function AdminUsersPage(): JSX.Element {
  const m = meta("/admin/users");
  return (
    <IonPage>
      <IonHeader><IonToolbar color="danger"><IonTitle>{m.label}</IonTitle></IonToolbar></IonHeader>
      <IonContent className="ion-padding"><ModulePlaceholderPage title={m.label} role="admin" plannedFeatures={m.plannedFeatures} /></IonContent>
    </IonPage>
  );
}

export function AdminDriversPage(): JSX.Element {
  const m = meta("/admin/drivers");
  return (
    <IonPage>
      <IonHeader><IonToolbar color="danger"><IonTitle>{m.label}</IonTitle></IonToolbar></IonHeader>
      <IonContent className="ion-padding"><ModulePlaceholderPage title={m.label} role="admin" plannedFeatures={m.plannedFeatures} /></IonContent>
    </IonPage>
  );
}

export function AdminGuidesPage(): JSX.Element {
  const m = meta("/admin/guides");
  return (
    <IonPage>
      <IonHeader><IonToolbar color="danger"><IonTitle>{m.label}</IonTitle></IonToolbar></IonHeader>
      <IonContent className="ion-padding"><ModulePlaceholderPage title={m.label} role="admin" plannedFeatures={m.plannedFeatures} /></IonContent>
    </IonPage>
  );
}

export function AdminRentalsPage(): JSX.Element {
  const m = meta("/admin/rentals");
  return (
    <IonPage>
      <IonHeader><IonToolbar color="danger"><IonTitle>{m.label}</IonTitle></IonToolbar></IonHeader>
      <IonContent className="ion-padding"><ModulePlaceholderPage title={m.label} role="admin" plannedFeatures={m.plannedFeatures} /></IonContent>
    </IonPage>
  );
}

export function AdminTripsPage(): JSX.Element {
  const m = meta("/admin/trips");
  return (
    <IonPage>
      <IonHeader><IonToolbar color="danger"><IonTitle>{m.label}</IonTitle></IonToolbar></IonHeader>
      <IonContent className="ion-padding"><ModulePlaceholderPage title={m.label} role="admin" plannedFeatures={m.plannedFeatures} /></IonContent>
    </IonPage>
  );
}

export function AdminPaymentsPage(): JSX.Element {
  const m = meta("/admin/payments");
  return (
    <IonPage>
      <IonHeader><IonToolbar color="danger"><IonTitle>{m.label}</IonTitle></IonToolbar></IonHeader>
      <IonContent className="ion-padding"><ModulePlaceholderPage title={m.label} role="admin" plannedFeatures={m.plannedFeatures} /></IonContent>
    </IonPage>
  );
}

export function AdminSettingsPage(): JSX.Element {
  const m = meta("/admin/settings");
  return (
    <IonPage>
      <IonHeader><IonToolbar color="danger"><IonTitle>{m.label}</IonTitle></IonToolbar></IonHeader>
      <IonContent className="ion-padding"><ModulePlaceholderPage title={m.label} role="admin" plannedFeatures={m.plannedFeatures} /></IonContent>
    </IonPage>
  );
}
