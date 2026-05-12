import { IonText } from "@ionic/react";
import { PublicLayout } from "../layouts/PublicLayout";

/**
 * WelcomePage — initial landing screen.
 *
 * Shown when the app loads at route /welcome.
 * No auth, no business logic, no navigation to unbuilt modules.
 *
 * This page will be replaced by the authenticated home screen
 * once the auth module is implemented.
 */
export function WelcomePage(): JSX.Element {
  return (
    <PublicLayout title="RAPA GO">
      <div className="welcome-container">
        <IonText color="primary">
          <h1 className="welcome-title">RAPA GO V2.0.0</h1>
        </IonText>

        <IonText color="medium">
          <p className="welcome-subtitle">
            Plataforma de movilidad y turismo para Rapa Nui
          </p>
        </IonText>

        <IonText>
          <p className="welcome-status">
            La aplicación está en fase de construcción. Los módulos de
            transporte, guías, rent a car, wallet y pagos se activarán
            progresivamente en las próximas versiones.
          </p>
        </IonText>
      </div>
    </PublicLayout>
  );
}
