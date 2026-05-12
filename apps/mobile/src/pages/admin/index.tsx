import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from "@ionic/react";
import { ModulePlaceholderPage } from "../../components/ModulePlaceholderPage";
import { ROUTE_METADATA } from "../../navigation/routeConfig";

function meta(path: string) {
  return ROUTE_METADATA.find((r) => r.path === path)!;
}

export function AdminHomePage(): JSX.Element {
  const m = meta("/admin/home");
  return (
    <IonPage>
      <IonHeader><IonToolbar color="danger"><IonTitle>{m.label}</IonTitle></IonToolbar></IonHeader>
      <IonContent className="ion-padding"><ModulePlaceholderPage title={m.label} role="admin" plannedFeatures={m.plannedFeatures} /></IonContent>
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
