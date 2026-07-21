import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
} from "@ionic/react";
import type { ReactNode } from "react";

interface PublicLayoutProps {
  title: string;
  children: ReactNode;
}

export function PublicLayout({
  title,
  children,
}: PublicLayoutProps): JSX.Element {
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar className="public-toolbar">
          <IonTitle className="public-toolbar-title">{title}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">{children}</IonContent>
    </IonPage>
  );
}
