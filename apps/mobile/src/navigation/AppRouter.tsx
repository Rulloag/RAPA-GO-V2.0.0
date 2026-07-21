import { Redirect, Route, Switch, type RouteComponentProps } from "react-router-dom";
import { ROUTES } from "./routes";
import { FRONTEND_ROUTE_GUARDS_ENABLED, RouteGuard } from "./RouteGuard";
import { RouteErrorBoundary } from "./RouteErrorBoundary.js";
import { RouteLoadingPage } from "./RouteLoadingPage.js";
import { useAuth } from "../features/auth";
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
import { SupportCenterPage } from "../pages/support/SupportCenterPage.js";
import { RatingSyncRuntime } from "../features/ratings/RatingSyncRuntime.js";
import { SupportQuickAccess } from "../features/support/SupportQuickAccess.js";
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
import {
  RELEASE_FEATURES,
  getReleaseHome,
} from "../config/releaseFeatures.js";

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
      render={({ location }) =>
        FRONTEND_ROUTE_GUARDS_ENABLED ? (
          <RouteGuard path={location.pathname}>
            <Component />
          </RouteGuard>
        ) : (
          <Component />
        )
      }
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
        if (status === "loading") {
          return <RouteLoadingPage />;
        }

        if (status === "authenticated" && user) {
          return <Redirect to={getReleaseHome(user.role)} />;
        }

        return <Component />;
      }}
    />
  );
}

function LegacyLoginRedirect({ location }: RouteComponentProps): JSX.Element {
  return (
    <Redirect
      to={{
        pathname: ROUTES.ROOT,
        search: location.search,
        hash: location.hash,
      }}
    />
  );
}

/**
 * The top-level router intentionally uses React Router's Switch.
 * IonRouterOutlet is reserved for the direct Route children inside each
 * tabbed role layout. Nesting a Switch as the only child of IonRouterOutlet
 * prevents Ionic from identifying individual routes and can leave pages hidden.
 */
export function AppRouter(): JSX.Element {
  return (
    <RouteErrorBoundary>
      <RatingSyncRuntime />
      <SupportQuickAccess />

      <Switch>
        <Route
          exact
          path={ROUTES.AUTH.FACEBOOK_CALLBACK}
          component={FacebookCallbackPage}
        />

        <AuthRoute path={ROUTES.ROOT} component={LoginPage} />
        <Route
          exact
          path={ROUTES.AUTH.LOGIN}
          component={LegacyLoginRedirect}
        />
        <Redirect exact from={ROUTES.AUTH.BASE} to={ROUTES.ROOT} />
        <Redirect exact from={ROUTES.WELCOME} to={ROUTES.ROOT} />

        <Route exact path={ROUTES.PUBLIC.PRIVACY} component={PrivacyPublicPage} />
        <Route exact path={ROUTES.PUBLIC.TERMS} component={TermsPublicPage} />
        <Route exact path={ROUTES.PUBLIC.SUPPORT} component={SupportPublicPage} />
        <Route exact path={ROUTES.PUBLIC.EULA} component={EulaPublicPage} />
        <Route
          exact
          path={ROUTES.PUBLIC.DELETE_ACCOUNT}
          component={PublicAccountDeletionPage}
        />

        <Route exact path={ROUTES.APPLY.DRIVER} component={ApplicationDriverPage} />
        {RELEASE_FEATURES.tourism ? (
          <Route exact path={ROUTES.APPLY.GUIDE} component={ApplicationGuidePage} />
        ) : (
          <Route
            exact
            path={ROUTES.APPLY.GUIDE}
            render={() => <Redirect to={ROUTES.NOT_FOUND} />}
          />
        )}
        <Route exact path={ROUTES.APPLY.STATUS} component={ApplicationStatusPage} />

        <Route exact path="/legal/:type" component={LegalPage} />

        <AuthRoute path="/auth/forgot-password" component={ForgotPasswordPage} />
        <AuthRoute path="/auth/reset-password" component={ResetPasswordPage} />
        <AuthRoute path={ROUTES.AUTH.REGISTER} component={RegisterPage} />

        <PrivateRoute path={ROUTES.PASSENGER.BASE} component={PassengerLayout} />
        <PrivateRoute path={ROUTES.DRIVER.BASE} component={DriverLayout} />

        {RELEASE_FEATURES.tourism ? (
          <PrivateRoute path={ROUTES.GUIDE.BASE} component={GuideLayout} />
        ) : (
          <Route
            path={ROUTES.GUIDE.BASE}
            render={() => <Redirect to={ROUTES.NOT_FOUND} />}
          />
        )}

        {RELEASE_FEATURES.rentals ? (
          <PrivateRoute path={ROUTES.RENTAL.BASE} component={RentalLayout} />
        ) : (
          <Route
            path={ROUTES.RENTAL.BASE}
            render={() => <Redirect to={ROUTES.NOT_FOUND} />}
          />
        )}

        <PrivateRoute path={ROUTES.ADMIN.BASE} component={AdminLayout} />

        <PrivateRoute exact path={ROUTES.PROFILE.INDEX} component={ProfileIndexPage} />
        <PrivateRoute exact path={ROUTES.PROFILE.DOCUMENTS} component={ProfileDocumentsPage} />
        <PrivateRoute exact path={ROUTES.PROFILE.BANK_ACCOUNT} component={ProfileBankAccountPage} />
        <PrivateRoute exact path={ROUTES.PROFILE.SECURITY} component={ProfileSecurityPage} />
        <PrivateRoute exact path={ROUTES.PROFILE.NOTIFICATIONS} component={ProfileNotificationsPage} />
        <PrivateRoute exact path="/notifications" component={NotificationPage} />
        <PrivateRoute exact path={ROUTES.SUPPORT.CENTER} component={SupportCenterPage} />

        <Route exact path={ROUTES.NOT_FOUND} component={NotFoundPage} />
        <Route render={() => <Redirect to={ROUTES.NOT_FOUND} />} />
      </Switch>
    </RouteErrorBoundary>
  );
}
