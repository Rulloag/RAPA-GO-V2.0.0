import { useEffect } from "react";
import { IonApp, setupIonicReact } from "@ionic/react";
import { IonReactRouter } from "@ionic/react-router";
import { SplashScreen } from "@capacitor/splash-screen";

/* Ionic core CSS */
import "@ionic/react/css/core.css";
import "@ionic/react/css/normalize.css";
import "@ionic/react/css/structure.css";
import "@ionic/react/css/typography.css";

/* Theme */
import "../theme/variables.css";
import "../theme/global.css";
/* Van después de global.css: están scoped a las pantallas rediseñadas y
   necesitan ganarle a las reglas globales de ion-card / ion-item / ion-input.
   rapago-shell.css define los tokens que consumen los otros dos. */
import "../theme/rapago-shell.css";
import "../theme/auth.css";
import "../theme/profile.css";
import "../theme/home.css";
import "../theme/sections.css";
import "../theme/request-ride.css";
import "../theme/request.css";

import { initRapagoTheme } from "../theme/rapagoTheme";

/* Se aplica el atributo data-rapago-theme antes del primer render para que no
   haya un parpadeo de tema al arrancar. */
initRapagoTheme();

import { AppRouter } from "../navigation/AppRouter";
import { AppProviders } from "./AppProviders";
import { RapaGoLanguageRuntime } from "../i18n/rapagoI18n";
import { SessionLogoutToast } from "../components/SessionLogoutToast";

setupIonicReact({
  mode: "md",
});

export function App(): JSX.Element {
  useEffect(() => {
    void SplashScreen.hide();
  }, []);

  return (
    <IonApp>
      <RapaGoLanguageRuntime />

      <IonReactRouter>
        <AppProviders>
          <AppRouter />
          {/* Protocolo de sesión: feedback global de cierre de sesión */}
          <SessionLogoutToast />
        </AppProviders>
      </IonReactRouter>
    </IonApp>
  );
}