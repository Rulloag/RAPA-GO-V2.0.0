import { homeOutline, carOutline, listOutline, cashOutline, personOutline } from "ionicons/icons";
import { Redirect, Route } from "react-router-dom";
import { RoleLayout } from "./RoleLayout";
import { UnknownRolePathRedirect } from "./UnknownRolePathRedirect.js";
import { ROUTES } from "../navigation/routes";
import * as DriverPages from "../pages/driver";
import { DriverLocationRuntime } from "../features/location/index.js";
/* Notificaciones vive en /notifications, fuera del prefijo /driver, pero la
   campana y el menú de cuenta del conductor llevan ahí. Se monta dentro de
   este layout para que no pierda la barra inferior al entrar (ver el caso
   especial en AppRouter). */
import { NotificationPage } from "../pages/notifications/NotificationPage.js";

const DriverHomePage = DriverPages.DriverHomePage;
const DriverRequestsPage = DriverPages.DriverRequestsPage;
const DriverActiveRidePage = DriverPages.DriverActiveRidePage;
const DriverTripsPage = DriverPages.DriverTripsPage;
const DriverProfilePage = DriverPages.DriverProfilePage;
const DriverGlobalRideAlert = DriverPages.DriverGlobalRideAlert;

const DriverEarningsPage =
  (DriverPages as typeof DriverPages & {
    DriverEarningsPage?: () => JSX.Element;
  }).DriverEarningsPage ?? DriverHomePage;

const TABS = [
  { path: ROUTES.DRIVER.HOME, label: "Inicio", icon: homeOutline },
  { path: ROUTES.DRIVER.REQUESTS, label: "Solicitudes", icon: listOutline },
  { path: ROUTES.DRIVER.TRIPS, label: "Viajes", icon: carOutline },
  { path: ROUTES.DRIVER.EARNINGS, label: "Ganancias", icon: cashOutline },
  { path: ROUTES.DRIVER.PROFILE, label: "Perfil", icon: personOutline },
];

const DRIVER_ALLOWED_PATHS = [
  ROUTES.DRIVER.BASE,
  ROUTES.DRIVER.HOME,
  ROUTES.DRIVER.REQUESTS,
  ROUTES.DRIVER.ACTIVE_RIDE,
  ROUTES.DRIVER.TRIPS,
  ROUTES.DRIVER.TRIP_DETAIL_PATTERN,
  ROUTES.DRIVER.EARNINGS,
  ROUTES.DRIVER.PROFILE,
] as const;
export function DriverLayout(): JSX.Element {
  return (
    <>
      <DriverLocationRuntime />
      <RoleLayout tabs={TABS}>
        <Redirect exact from={ROUTES.DRIVER.BASE} to={ROUTES.DRIVER.HOME} />
        <Route exact path={ROUTES.DRIVER.HOME} component={DriverHomePage} />
        <Route exact path={ROUTES.DRIVER.REQUESTS} component={DriverRequestsPage} />
        <Route exact path={ROUTES.DRIVER.ACTIVE_RIDE} component={DriverActiveRidePage} />
        <Route exact path={ROUTES.DRIVER.TRIPS} component={DriverTripsPage} />
        <Route exact path={ROUTES.DRIVER.TRIP_DETAIL_PATTERN} component={DriverTripsPage} />
        <Route exact path={ROUTES.DRIVER.EARNINGS} component={DriverEarningsPage} />
        <Route exact path={ROUTES.DRIVER.PROFILE} component={DriverProfilePage} />
        <Route exact path={ROUTES.NOTIFICATIONS} component={NotificationPage} />
        <Route
          path={ROUTES.DRIVER.BASE}
          render={() => (
            <UnknownRolePathRedirect
              basePath={ROUTES.DRIVER.BASE}
              allowedPaths={DRIVER_ALLOWED_PATHS}
            />
          )}
        />
      </RoleLayout>
      <DriverGlobalRideAlert />
    </>
  );
}

export default DriverLayout;
