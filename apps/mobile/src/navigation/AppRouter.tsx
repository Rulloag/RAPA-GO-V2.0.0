import { IonRouterOutlet } from "@ionic/react";
import { Redirect, Route, Switch } from "react-router-dom";
import { NotFoundPage } from "../pages/NotFoundPage";
import { WelcomePage } from "../pages/WelcomePage";
import { ROUTES } from "./routes";

/**
 * AppRouter — defines all application routes.
 *
 * Route organization:
 *  - Public routes: accessible without authentication.
 *  - Protected routes: will be added here once auth module is ready.
 *  - Catch-all: renders NotFoundPage for any unmatched path.
 *
 * All path strings come from ROUTES constants — never hardcoded here.
 */
export function AppRouter(): JSX.Element {
  return (
    <IonRouterOutlet>
      <Switch>
        {/* Root redirect */}
        <Redirect exact from={ROUTES.ROOT} to={ROUTES.WELCOME} />

        {/* Public routes */}
        <Route exact path={ROUTES.WELCOME} component={WelcomePage} />

        {/* 404 explicit route */}
        <Route exact path={ROUTES.NOT_FOUND} component={NotFoundPage} />

        {/* Catch-all: redirect any unknown path to NotFoundPage */}
        <Route render={() => <Redirect to={ROUTES.NOT_FOUND} />} />
      </Switch>
    </IonRouterOutlet>
  );
}
