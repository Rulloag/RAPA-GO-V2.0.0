import { IonRouterOutlet } from "@ionic/react";
import { Redirect, Route, Switch } from "react-router-dom";
import { ROUTES } from "./routes";
import { WelcomePage } from "../pages/WelcomePage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { LoginPage, RegisterPage } from "../features/auth";
import { PassengerLayout } from "../layouts/PassengerLayout";
import { DriverLayout } from "../layouts/DriverLayout";
import { GuideLayout } from "../layouts/GuideLayout";
import { RentalLayout } from "../layouts/RentalLayout";
import { AdminLayout } from "../layouts/AdminLayout";
import {
  ProfileIndexPage,
  ProfileDocumentsPage,
  ProfileBankAccountPage,
  ProfileSecurityPage,
  ProfileNotificationsPage,
} from "../pages/profile";

export function AppRouter(): JSX.Element {
  return (
    <IonRouterOutlet>
      <Switch>
        <Redirect exact from={ROUTES.ROOT} to={ROUTES.WELCOME} />

        {/* Public */}
        <Route exact path={ROUTES.WELCOME} component={WelcomePage} />
        <Route exact path={ROUTES.NOT_FOUND} component={NotFoundPage} />

        {/* Auth — placeholder pages, no real auth yet */}
        <Route exact path={ROUTES.AUTH.LOGIN} component={LoginPage} />
        <Route exact path={ROUTES.AUTH.REGISTER} component={RegisterPage} />

        {/* Role sections */}
        <Route path={ROUTES.PASSENGER.BASE} component={PassengerLayout} />
        <Route path={ROUTES.DRIVER.BASE} component={DriverLayout} />
        <Route path={ROUTES.GUIDE.BASE} component={GuideLayout} />
        <Route path={ROUTES.RENTAL.BASE} component={RentalLayout} />
        <Route path={ROUTES.ADMIN.BASE} component={AdminLayout} />

        {/* Shared profile */}
        <Route exact path={ROUTES.PROFILE.INDEX} component={ProfileIndexPage} />
        <Route exact path={ROUTES.PROFILE.DOCUMENTS} component={ProfileDocumentsPage} />
        <Route exact path={ROUTES.PROFILE.BANK_ACCOUNT} component={ProfileBankAccountPage} />
        <Route exact path={ROUTES.PROFILE.SECURITY} component={ProfileSecurityPage} />
        <Route exact path={ROUTES.PROFILE.NOTIFICATIONS} component={ProfileNotificationsPage} />

        {/* Catch-all */}
        <Route render={() => <Redirect to={ROUTES.NOT_FOUND} />} />
      </Switch>
    </IonRouterOutlet>
  );
}
