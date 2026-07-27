import { homeOutline, carOutline, listOutline, cashOutline, personOutline } from "ionicons/icons";
import { Redirect, Route } from "react-router-dom";
import { RoleLayout } from "./RoleLayout";
import { ROUTES } from "../navigation/routes";
import * as DriverPages from "../pages/driver";
import { DriverLocationRuntime } from "../features/location/index.js";

const DriverHomePage = DriverPages.DriverHomePage;
const DriverRequestsPage = DriverPages.DriverRequestsPage;
const DriverTripsPage = DriverPages.DriverTripsPage;
const DriverProfilePage = DriverPages.DriverProfilePage;

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

export function DriverLayout(): JSX.Element {
  return (
    <>
      <DriverLocationRuntime />
      <RoleLayout tabs={TABS}>
        <Redirect exact from={ROUTES.DRIVER.BASE} to={ROUTES.DRIVER.HOME} />
        <Route exact path={ROUTES.DRIVER.HOME} component={DriverHomePage} />
        <Route exact path={ROUTES.DRIVER.REQUESTS} component={DriverRequestsPage} />
        <Route exact path={ROUTES.DRIVER.TRIPS} component={DriverTripsPage} />
        <Route exact path={ROUTES.DRIVER.TRIP_DETAIL_PATTERN} component={DriverTripsPage} />
        <Route exact path={ROUTES.DRIVER.EARNINGS} component={DriverEarningsPage} />
        <Route exact path={ROUTES.DRIVER.PROFILE} component={DriverProfilePage} />
      </RoleLayout>
    </>
  );
}

export default DriverLayout;

