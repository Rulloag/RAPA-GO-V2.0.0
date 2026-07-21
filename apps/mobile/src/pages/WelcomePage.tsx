import type React from "react";
import { IonButton, IonContent, IonPage } from "@ionic/react";
import { useHistory } from "react-router-dom";
import { ROUTES } from "../navigation/routes";
import logoRapago from "../theme/img/logo-rapago.jpeg";

export function WelcomePage(): JSX.Element {
  const history = useHistory();

  return (
    <IonPage>
      <IonContent
        className="welcome-page-content"
        scrollY={true}
        style={{
          "--background": "linear-gradient(180deg, rgba(14,12,10,.88) 0%, rgba(14,12,10,.96) 100%), url('/assets/rapa-go-bg.jpg') center / cover no-repeat fixed",
        } as React.CSSProperties}
      >
        <div className="welcome-shell">
          {/* Hero zone */}
          <div className="welcome-hero">
            <div className="welcome-logo-wrap">
              <img src={logoRapago} alt="Rapa Go" className="welcome-logo" />
            </div>
            <h1 className="welcome-brand">RAPA GO</h1>
            <p className="welcome-tagline">
              Movilidad, Tours, Rent a Car y Eventos en Rapa Nui
            </p>
          </div>

          {/* Divider */}
          <div className="welcome-divider" />

          {/* CTA zone */}
          <div className="welcome-cta">
            <IonButton
              expand="block"
              className="welcome-btn-primary"
              onClick={() => history.push(ROUTES.AUTH.LOGIN)}
            >
              Iniciar sesión
            </IonButton>

            <IonButton
              expand="block"
              fill="outline"
              className="welcome-btn-outline"
              onClick={() => history.push(ROUTES.AUTH.REGISTER)}
            >
              Crear cuenta
            </IonButton>
          </div>

          {/* Footer links */}
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
      </IonContent>
    </IonPage>
  );
}