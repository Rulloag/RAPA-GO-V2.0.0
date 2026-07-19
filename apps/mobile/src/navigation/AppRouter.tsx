import { IonRouterOutlet } from "@ionic/react";
import { Redirect, Route, Switch } from "react-router-dom";
import { ROUTES } from "./routes";
import { RouteGuard, ROLE_HOME } from "./RouteGuard";
import { useAuth } from "../features/auth";
import { WelcomePage } from "../pages/WelcomePage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { LoginPage, RegisterPage } from "../features/auth";
import { FacebookCallbackPage } from "../features/auth/FacebookCallbackPage";
import { ForgotPasswordPage } from "../features/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "../features/auth/ResetPasswordPage";
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
import { NotificationPage } from "../pages/notifications/NotificationPage";
import {
  ApplicationDriverPage,
  ApplicationGuidePage,
  ApplicationStatusPage,
} from "../pages/apply/index";
import { LegalPage } from "../pages/legal/index";
import { PublicAccountDeletionPage } from "../pages/public/PublicAccountDeletionPage.js";
import {
  EulaPublicPage,
  PrivacyPublicPage,
  SupportPublicPage,
  TermsPublicPage,
} from "../pages/public/PublicLegalPages.js";

function getPreferredHome(role: string): string {
  const mode =
    localStorage.getItem("rapago_active_role") ??
    localStorage.getItem("rapago_selected_role") ??
    localStorage.getItem("rapago_view_mode") ??
    localStorage.getItem("rapago_active_mode");

  if (role === "driver" && mode === "passenger") {
    return ROUTES.PASSENGER.HOME;
  }

  if (role === "driver" && mode === "driver") {
    return ROUTES.DRIVER.HOME;
  }

  return ROLE_HOME[role as keyof typeof ROLE_HOME] ?? ROUTES.WELCOME;
}

function PrivateRoute({
  path,
  component: Component,
  exact,
}: {
  path: string;
  component: React.ComponentType;
  exact?: boolean;
}): JSX.Element {
  return (
    <Route
      path={path}
      exact={exact}
      render={() => (
        <RouteGuard path={path}>
          <Component />
        </RouteGuard>
      )}
    />
  );
}

function AuthRoute({
  path,
  component: Component,
}: {
  path: string;
  component: React.ComponentType;
}): JSX.Element {
  const { status, user } = useAuth();

  return (
    <Route
      exact
      path={path}
      render={() => {
        if (status === "authenticated" && user) {
          return <Redirect to={getPreferredHome(user.role)} />;
        }

        return <Component />;
      }}
    />
  );
}

export function AppRouter(): JSX.Element {
  return (
    <IonRouterOutlet>
      <Switch>
        {/* Facebook callback debe ir arriba para que no lo tome otra ruta */}
        <Route
          exact
          path={ROUTES.AUTH.FACEBOOK_CALLBACK}
          component={FacebookCallbackPage}
        />

        <Redirect exact from={ROUTES.ROOT} to={ROUTES.WELCOME} />

        <Route exact path={ROUTES.WELCOME} component={WelcomePage} />
        <Route exact path={ROUTES.PUBLIC.PRIVACY} component={PrivacyPublicPage} />
        <Route exact path={ROUTES.PUBLIC.TERMS} component={TermsPublicPage} />
        <Route exact path={ROUTES.PUBLIC.SUPPORT} component={SupportPublicPage} />
        <Route exact path={ROUTES.PUBLIC.EULA} component={EulaPublicPage} />
        <Route
          exact
          path={ROUTES.PUBLIC.DELETE_ACCOUNT}
          component={PublicAccountDeletionPage}
        />
        <Route exact path={ROUTES.NOT_FOUND} component={NotFoundPage} />

        <Route exact path={ROUTES.APPLY.DRIVER} component={ApplicationDriverPage} />
        <Route exact path={ROUTES.APPLY.GUIDE} component={ApplicationGuidePage} />
        <Route exact path={ROUTES.APPLY.STATUS} component={ApplicationStatusPage} />

        <Route exact path="/legal/:type" component={LegalPage} />

        <AuthRoute path={ROUTES.AUTH.LOGIN} component={LoginPage} />
        <AuthRoute path="/auth/forgot-password" component={ForgotPasswordPage} />
        <AuthRoute path="/auth/reset-password" component={ResetPasswordPage} />
        <AuthRoute path={ROUTES.AUTH.REGISTER} component={RegisterPage} />

        <PrivateRoute path={ROUTES.PASSENGER.BASE} component={PassengerLayout} />
        <PrivateRoute path={ROUTES.DRIVER.BASE} component={DriverLayout} />
        <PrivateRoute path={ROUTES.GUIDE.BASE} component={GuideLayout} />
        <PrivateRoute path={ROUTES.RENTAL.BASE} component={RentalLayout} />
        <PrivateRoute path={ROUTES.ADMIN.BASE} component={AdminLayout} />

        <PrivateRoute exact path={ROUTES.PROFILE.INDEX} component={ProfileIndexPage} />
        <PrivateRoute exact path={ROUTES.PROFILE.DOCUMENTS} component={ProfileDocumentsPage} />
        <PrivateRoute exact path={ROUTES.PROFILE.BANK_ACCOUNT} component={ProfileBankAccountPage} />
        <PrivateRoute exact path={ROUTES.PROFILE.SECURITY} component={ProfileSecurityPage} />
        <PrivateRoute exact path={ROUTES.PROFILE.NOTIFICATIONS} component={ProfileNotificationsPage} />
        <PrivateRoute exact path="/notifications" component={NotificationPage} />

        <Route render={() => <Redirect to={ROUTES.NOT_FOUND} />} />
      </Switch>
    </IonRouterOutlet>
  );
}
