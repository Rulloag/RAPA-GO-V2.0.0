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
/* Va después de sections.css: misma capa de coherencia, pero con el ámbito de
   las pantallas del conductor. */
import "../theme/driver.css";
/* Misma capa de coherencia, con el ámbito del panel de administración. */
import "../theme/admin.css";
import "../theme/request-ride.css";
import "../theme/request.css";
/* Va después de sections.css: la pantalla de notificaciones reutiliza .rp-card
   del kit y necesita anularle el padding para que el área táctil la ocupe el
   botón interior. Misma especificidad, así que decide el orden de cascada. */
import "../theme/notifications.css";
/* Va al final: la barra superior debe poder pisar los restos de cabecera de
   cualquier ámbito (sections, driver, request-ride) sin recurrir a !important. */
import "../theme/appbar.css";
/* Va después de todas las pantallas: fija el mínimo de 16px en los campos de
   texto para que iOS no haga zoom al enfocarlos, y debe ganarle a los tamaños
   que cada pantalla define para sus inputs. */
import "../theme/inputs.css";

import { initRapagoTheme } from "../theme/rapagoTheme";

/* Se aplica el atributo data-rapago-theme antes del primer render para que no
   haya un parpadeo de tema al arrancar. */
initRapagoTheme();

import { AppRouter } from "../navigation/AppRouter";
import { AppProviders } from "./AppProviders";
import { RapaGoLanguageRuntime } from "../i18n/rapagoI18n";
import { AuthFeedbackToast } from "../components/AuthFeedbackToast";

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
          {/* Protocolo de sesión: feedback global de login, registro y cierre de sesión */}
          <AuthFeedbackToast />
        </AppProviders>
      </IonReactRouter>
    </IonApp>
  );
}