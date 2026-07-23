import { IonButton, IonIcon, IonText } from "@ionic/react";
import { homeOutline } from "ionicons/icons";
import { useHistory } from "react-router-dom";
import { PublicLayout } from "../layouts/PublicLayout";
import { ROUTES } from "../navigation/routes";

/**
 * NotFoundPage — rendered for any unmatched route.
 *
 * Provides a clear message and a single action: return to Welcome.
 * No links to modules that don't exist yet.
 */
export function NotFoundPage(): JSX.Element {
  const history = useHistory();

  return (
    <PublicLayout title="Página no encontrada">
      <div className="not-found-container">
        <IonText color="medium">
          <h2 className="not-found-code">404</h2>
        </IonText>

        <IonText>
          <p className="not-found-message">
            La página que buscas no existe o fue movida.
          </p>
        </IonText>

        <IonButton
          expand="block"
          fill="outline"
          onClick={() => { history.replace(ROUTES.ROOT); }}
        >
          <IonIcon slot="start" icon={homeOutline} />
          Volver al inicio
        </IonButton>
      </div>
    </PublicLayout>
  );
}
