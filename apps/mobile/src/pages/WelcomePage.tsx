import { IonButton, IonText } from "@ionic/react";
import { useHistory } from "react-router-dom";
import { PublicLayout } from "../layouts/PublicLayout";
import { ROUTES } from "../navigation/routes";
import logoRapago from "../theme/img/logo-rapago.jpeg";

export function WelcomePage(): JSX.Element {
  const history = useHistory();

  return (
    <PublicLayout title="RAPA GO">
      <div className="welcome-container">

        {/* Logo + title */}
        <div className="welcome-header-block">
          <img src={logoRapago} alt="Rapa Go" className="welcome-inline-logo" />
          <IonText color="primary">
            <h1 className="welcome-title">RAPA GO V2.0.0</h1>
          </IonText>
        </div>

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

        <div className="welcome-buttons">
          <IonButton
            expand="block"
            className="btn-auth-primary"
            onClick={() => history.push(ROUTES.AUTH.LOGIN)}
          >
            Login
          </IonButton>

          <IonButton
            expand="block"
            className="btn-register"
            onClick={() => history.push(ROUTES.AUTH.REGISTER)}
          >
            Registro
          </IonButton>

          <IonButton
            expand="block"
            fill="outline"
            className="btn-perfil"
            onClick={() => history.push(ROUTES.PROFILE.INDEX)}
          >
            Perfil
          </IonButton>

          <div className="welcome-footer-links">
            <IonButton fill="clear" size="small" className="welcome-link" onClick={() => history.push(ROUTES.PUBLIC.PRIVACY)}>
              Privacidad
            </IonButton>
            <span className="welcome-link-sep">·</span>
            <IonButton fill="clear" size="small" className="welcome-link" onClick={() => history.push(ROUTES.PUBLIC.SUPPORT)}>
              Soporte
            </IonButton>
            <span className="welcome-link-sep">·</span>
            <IonButton fill="clear" size="small" className="welcome-link" onClick={() => history.push(ROUTES.PUBLIC.DELETE_ACCOUNT)}>
              Eliminar cuenta
            </IonButton>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}