import { homeOutline, carOutline, calendarOutline, cashOutline } from "ionicons/icons";
import { Redirect, Route } from "react-router-dom";
import { RoleLayout } from "./RoleLayout";
import { ROUTES } from "../navigation/routes";
import {
  RentalHomePage,
  RentalVehiclesPage,
  RentalBookingsPage,
  RentalEarningsPage,
  RentalProfilePage,
} from "../pages/rental";

const TABS = [
  { path: ROUTES.RENTAL.HOME, label: "Inicio", icon: homeOutline },
  { path: ROUTES.RENTAL.VEHICLES, label: "Vehículos", icon: carOutline },
  { path: ROUTES.RENTAL.BOOKINGS, label: "Reservas", icon: calendarOutline },
  { path: ROUTES.RENTAL.EARNINGS, label: "Ganancias", icon: cashOutline },
];

export function RentalLayout(): JSX.Element {
  return (
    <RoleLayout tabs={TABS}>
      <Redirect exact from={ROUTES.RENTAL.BASE} to={ROUTES.RENTAL.HOME} />
      <Route exact path={ROUTES.RENTAL.HOME} component={RentalHomePage} />
      <Route exact path={ROUTES.RENTAL.VEHICLES} component={RentalVehiclesPage} />
      <Route exact path={ROUTES.RENTAL.VEHICLE_DETAIL_PATTERN} component={RentalVehiclesPage} />
      <Route exact path={ROUTES.RENTAL.BOOKINGS} component={RentalBookingsPage} />
      <Route exact path={ROUTES.RENTAL.EARNINGS} component={RentalEarningsPage} />
      <Route exact path={ROUTES.RENTAL.PROFILE} component={RentalProfilePage} />
      <Route render={() => <Redirect to={ROUTES.NOT_FOUND} />} />
    </RoleLayout>
  );
}
