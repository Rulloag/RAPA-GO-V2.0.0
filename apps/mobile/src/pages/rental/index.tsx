import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from "@ionic/react";
import { ModulePlaceholderPage } from "../../components/ModulePlaceholderPage";
import { ROUTE_METADATA } from "../../navigation/routeConfig";

function meta(path: string) {
  return ROUTE_METADATA.find((r) => r.path === path)!;
}

export function RentalHomePage(): JSX.Element {
  const m = meta("/rental/home");
  return (
    <IonPage>
      <IonHeader><IonToolbar color="tertiary"><IonTitle>{m.label}</IonTitle></IonToolbar></IonHeader>
      <IonContent className="ion-padding"><ModulePlaceholderPage title={m.label} role="rental" plannedFeatures={m.plannedFeatures} /></IonContent>
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
