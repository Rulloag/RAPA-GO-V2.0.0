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
import { RouteErrorBoundary } from "../navigation/RouteErrorBoundary";
import { AppProviders } from "./AppProviders";
import { RapaGoLanguageRuntime } from "../i18n/rapagoI18n";

setupIonicReact({
  mode: "md",
});

export function App(): JSX.Element {
  useEffect(() => {
    void SplashScreen.hide();
  }, []);

  return (
    <IonApp>
      <RouteErrorBoundary>
        <RapaGoLanguageRuntime />

        <IonReactRouter>
          <AppProviders>
            <AppRouter />
          </AppProviders>
        </IonReactRouter>
      </RouteErrorBoundary>
    </IonApp>
  );
}