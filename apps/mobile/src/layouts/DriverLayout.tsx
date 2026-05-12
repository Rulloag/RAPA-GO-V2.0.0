import { homeOutline, carOutline, listOutline, cashOutline } from "ionicons/icons";
import { Route, Switch } from "react-router-dom";
import { RoleLayout } from "./RoleLayout";
import { ROUTES } from "../navigation/routes";
import {
  DriverHomePage,
  DriverRequestsPage,
  DriverTripsPage,
  DriverEarningsPage,
  DriverProfilePage,
} from "../pages/driver";

const TABS = [
  { path: ROUTES.DRIVER.HOME, label: "Inicio", icon: homeOutline },
  { path: ROUTES.DRIVER.REQUESTS, label: "Solicitudes", icon: listOutline },
  { path: ROUTES.DRIVER.TRIPS, label: "Viajes", icon: carOutline },
  { path: ROUTES.DRIVER.EARNINGS, label: "Ganancias", icon: cashOutline },
];

export function DriverLayout(): JSX.Element {
  return (
    <RoleLayout tabs={TABS}>
      <Switch>
        <Route exact path={ROUTES.DRIVER.HOME} component={DriverHomePage} />
        <Route exact path={ROUTES.DRIVER.REQUESTS} component={DriverRequestsPage} />
        <Route exact path={ROUTES.DRIVER.TRIPS} component={DriverTripsPage} />
        <Route exact path={ROUTES.DRIVER.TRIP_DETAIL_PATTERN} component={DriverTripsPage} />
        <Route exact path={ROUTES.DRIVER.EARNINGS} component={DriverEarningsPage} />
        <Route exact path={ROUTES.DRIVER.PROFILE} component={DriverProfilePage} />
      </Switch>
    </RoleLayout>
  );
}
