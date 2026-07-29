import { IonRouterOutlet } from "@ionic/react";
import { Redirect, Route, useLocation } from "react-router-dom";
import { ROUTES } from "./routes";
import { RouteErrorBoundary } from "./RouteErrorBoundary.js";
import { NotFoundPage } from "../pages/NotFoundPage";
import { LoginPage, RegisterPage, useAuth } from "../features/auth";
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
  UserConditionsPublicPage,
} from "../pages/public/PublicLegalPages.js";
import { RELEASE_FEATURES } from "../config/releaseFeatures.js";

/**
 * MODO DE RECUPERACIÓN VISUAL
 *
 * No se aplican bloqueos, validaciones de rol ni redirecciones por sesión en
 * el frontend. La API sigue siendo la responsable de autorizar operaciones y
 * datos privados.
 *
 * Importante: los layouts con pestañas se renderizan fuera del
 * IonRouterOutlet superior. De este modo nunca se anida un IonRouterOutlet
 * dentro de otro, una combinación que puede dejar las IonPage ocultas y
 * producir una pantalla negra sin errores en consola.
 */

function isPathInside(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

function StandaloneRoutes(): JSX.Element {
  return (
    <IonRouterOutlet animated={false} className="rapago-root-outlet">
      <Route exact path={ROUTES.ROOT} component={LoginPage} />
      <Route exact path={ROUTES.WELCOME} component={LoginPage} />
      <Route exact path={ROUTES.AUTH.BASE} component={LoginPage} />
      <Route exact path={ROUTES.AUTH.LOGIN} component={LoginPage} />
      <Route exact path={ROUTES.AUTH.REGISTER} component={RegisterPage} />
      <Route
        exact
        path={ROUTES.AUTH.FACEBOOK_CALLBACK}
        component={FacebookCallbackPage}
      />
      <Route
        exact
        path="/auth/forgot-password"
        component={ForgotPasswordPage}
      />
      <Route
        exact
        path="/auth/reset-password"
        component={ResetPasswordPage}
      />

      <Route exact path={ROUTES.PUBLIC.PRIVACY} component={PrivacyPublicPage} />
      <Route exact path={ROUTES.PUBLIC.TERMS} component={TermsPublicPage} />
      <Route
        exact
        path={ROUTES.PUBLIC.USER_CONDITIONS}
        component={UserConditionsPublicPage}
      />
      <Route exact path={ROUTES.PUBLIC.SUPPORT} component={SupportPublicPage} />
      <Route exact path={ROUTES.PUBLIC.EULA} component={EulaPublicPage} />
      <Route
        exact
        path={ROUTES.PUBLIC.DELETE_ACCOUNT}
        component={PublicAccountDeletionPage}
      />

      <Route exact path={ROUTES.APPLY.DRIVER} component={ApplicationDriverPage} />
      <Route
        exact
        path={ROUTES.APPLY.GUIDE}
        render={() =>
          RELEASE_FEATURES.tourism ? (
            <ApplicationGuidePage />
          ) : (
            <Redirect to={ROUTES.NOT_FOUND} />
          )
        }
      />
      <Route exact path={ROUTES.APPLY.STATUS} component={ApplicationStatusPage} />

      <Route exact path="/legal/:type" component={LegalPage} />

      <Route exact path={ROUTES.PROFILE.INDEX} component={ProfileIndexPage} />
      <Route exact path={ROUTES.PROFILE.DOCUMENTS} component={ProfileDocumentsPage} />
      <Route exact path={ROUTES.PROFILE.BANK_ACCOUNT} component={ProfileBankAccountPage} />
      <Route exact path={ROUTES.PROFILE.SECURITY} component={ProfileSecurityPage} />
      <Route exact path={ROUTES.PROFILE.NOTIFICATIONS} component={ProfileNotificationsPage} />
      <Route exact path="/notifications" component={NotificationPage} />
      <Route exact path={ROUTES.SUPPORT.CENTER} component={SupportCenterPage} />

      <Route exact path={ROUTES.NOT_FOUND} component={NotFoundPage} />
    </IonRouterOutlet>
  );
}

export function AppRouter(): JSX.Element {
  const { pathname } = useLocation();
  const { user } = useAuth();

  /**
   * Centro de ayuda: vive en /support-center, fuera del prefijo /passenger, y
   * la pestaña "Ayuda" del pasajero apunta ahí (PassengerLayout). Sin este
   * caso, entrar a Ayuda desmontaba PassengerLayout entero y con él la barra
   * inferior, dejando al usuario sin navegación.
   *
   * La pantalla es multi-rol (SupportCenterPage ramifica a driver/admin/
   * pasajero), así que solo se monta dentro del layout de pasajero cuando el
   * rol activo es de pasajero. Conductor, admin y visitantes sin sesión
   * conservan la ruta standalone de siempre.
   */
  const isPassengerRole = user != null && user.role !== "driver" && user.role !== "admin";

  if (isPathInside(pathname, ROUTES.PASSENGER.BASE) || (pathname === ROUTES.SUPPORT.CENTER && isPassengerRole)) {
    return (
      <RouteErrorBoundary>
        <PassengerLayout />
      </RouteErrorBoundary>
    );
  }

  if (isPathInside(pathname, ROUTES.DRIVER.BASE)) {
    return (
      <RouteErrorBoundary>
        <DriverLayout />
      </RouteErrorBoundary>
    );
  }

  if (isPathInside(pathname, ROUTES.ADMIN.BASE)) {
    return (
      <RouteErrorBoundary>
        <AdminLayout />
      </RouteErrorBoundary>
    );
  }

  if (isPathInside(pathname, ROUTES.GUIDE.BASE)) {
    return RELEASE_FEATURES.tourism ? (
      <RouteErrorBoundary>
        <GuideLayout />
      </RouteErrorBoundary>
    ) : (
      <Redirect to={ROUTES.NOT_FOUND} />
    );
  }

  if (isPathInside(pathname, ROUTES.RENTAL.BASE)) {
    return RELEASE_FEATURES.rentals ? (
      <RouteErrorBoundary>
        <RentalLayout />
      </RouteErrorBoundary>
    ) : (
      <Redirect to={ROUTES.NOT_FOUND} />
    );
  }

  return (
    <RouteErrorBoundary>
      <StandaloneRoutes />
    </RouteErrorBoundary>
  );
}
