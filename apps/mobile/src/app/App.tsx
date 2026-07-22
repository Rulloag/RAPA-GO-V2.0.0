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