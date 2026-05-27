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

setupIonicReact({
  mode: "md", // Material Design on all platforms for consistency
});

/**
 * App — root component.
 *
 * Renders: IonApp > IonReactRouter > AppProviders > AppRouter
 *
 * Do NOT add business logic here. Route-level concerns belong in AppRouter.
 * Provider-level concerns belong in AppProviders.
 */
export function App(): JSX.Element {
  useEffect(() => {
    void SplashScreen.hide();
  }, []);

  return (
    <IonApp>
      <IonReactRouter>
        <AppProviders>
          <AppRouter />
        </AppProviders>
      </IonReactRouter>
    </IonApp>
  );
}
