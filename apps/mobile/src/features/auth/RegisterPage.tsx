import { IonButton, IonContent, IonHeader, IonPage, IonText, IonTitle, IonToolbar } from "@ionic/react";
import { useHistory } from "react-router-dom";
import { ROUTES } from "../../navigation/routes.js";

/**
 * RegisterPage — placeholder.
 *
 * TODO(phase-auth-form): replace with real registration form (email, password,
 * name, role selector), form validation via Zod, and call to useAuth().register().
 * No data is submitted here yet.
 */
export function RegisterPage(): JSX.Element {
  const history = useHistory();

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Crear Cuenta</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div style={{ maxWidth: 480, margin: "2rem auto", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <IonText color="primary">
            <h2 style={{ margin: 0 }}>Crear Cuenta</h2>
          </IonText>

          <IonText color="medium">
            <p style={{ margin: 0 }}>
              El formulario de registro se implementará cuando el proveedor
              de auth esté configurado en el backend.
            </p>
          </IonText>

          <IonText color="warning">
            <p style={{ margin: 0, fontSize: "0.8rem" }}>
              PRÓXIMA FASE — Sin funcionalidad real aún.
            </p>
          </IonText>

          <IonButton
            expand="block"
            fill="outline"
            onClick={() => { history.replace(ROUTES.WELCOME); }}
          >
            Volver al inicio
          </IonButton>
        </div>
      </IonContent>
    </IonPage>
  );
}
