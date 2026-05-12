import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from "@ionic/react";
import { ModulePlaceholderPage } from "../../components/ModulePlaceholderPage";
import { ROUTE_METADATA } from "../../navigation/routeConfig";

function meta(path: string) {
  return ROUTE_METADATA.find((r) => r.path === path)!;
}

export function GuideHomePage(): JSX.Element {
  const m = meta("/guide/home");
  return (
    <IonPage>
      <IonHeader><IonToolbar color="warning"><IonTitle>{m.label}</IonTitle></IonToolbar></IonHeader>
      <IonContent className="ion-padding"><ModulePlaceholderPage title={m.label} role="guide" plannedFeatures={m.plannedFeatures} /></IonContent>
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
