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

/**
 * PublicLayout — wraps public pages with a consistent Ionic shell.
 *
 * Provides: IonPage > IonHeader > IonContent structure.
 * Responsive by default via Ionic's layout system.
 *
 * Authenticated layouts (with side menus, tab bars, etc.)
 * will be added in separate layout components once auth is implemented.
 */
export function PublicLayout({
  title,
  children,
}: PublicLayoutProps): JSX.Element {
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>{title}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">{children}</IonContent>
    </IonPage>
  );
}
