import { IonButton, IonText } from "@ionic/react";
import { useHistory } from "react-router-dom";
import { PublicLayout } from "../layouts/PublicLayout";
import { ROUTES } from "../navigation/routes";

export function WelcomePage(): JSX.Element {
  const history = useHistory();

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

        {/* ── DEV NAVIGATION — remove before production ── */}
        <div style={{ marginTop: "2rem", borderTop: "2px dashed var(--ion-color-medium)", paddingTop: "1rem" }}>
          <IonText color="medium">
            <p style={{ margin: "0 0 0.75rem", fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Dev Navigation
            </p>
          </IonText>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1rem" }}>
            <IonText color="medium">
              <p style={{ margin: 0, fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Auth</p>
            </IonText>
            <IonButton expand="block" color="primary" fill="solid" onClick={() => { history.push(ROUTES.AUTH.LOGIN); }}>
              Login
            </IonButton>
            <IonButton expand="block" color="primary" fill="solid" onClick={() => { history.push(ROUTES.AUTH.REGISTER); }}>
              Registro
            </IonButton>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <IonButton expand="block" color="primary" fill="outline" onClick={() => { history.push(ROUTES.PASSENGER.HOME); }}>
              Pasajero
            </IonButton>
            <IonButton expand="block" color="success" fill="outline" onClick={() => { history.push(ROUTES.DRIVER.HOME); }}>
              Conductor
            </IonButton>
            <IonButton expand="block" color="warning" fill="outline" onClick={() => { history.push(ROUTES.GUIDE.HOME); }}>
              Guía Turístico
            </IonButton>
            <IonButton expand="block" color="tertiary" fill="outline" onClick={() => { history.push(ROUTES.RENTAL.HOME); }}>
              Empresa Arriendo
            </IonButton>
            <IonButton expand="block" color="danger" fill="outline" onClick={() => { history.push(ROUTES.ADMIN.HOME); }}>
              Administrador
            </IonButton>
            <IonButton expand="block" color="medium" fill="outline" onClick={() => { history.push(ROUTES.PROFILE.INDEX); }}>
              Perfil
            </IonButton>
          </div>
        </div>
        {/* ── END DEV NAVIGATION ── */}
      </div>
    </PublicLayout>
  );
}
