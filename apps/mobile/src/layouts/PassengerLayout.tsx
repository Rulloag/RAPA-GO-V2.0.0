import { homeOutline, carOutline, personOutline, walletOutline, mapOutline, calendarOutline } from "ionicons/icons";
import { Route, Switch } from "react-router-dom";
import { RoleLayout } from "./RoleLayout";
import { ROUTES } from "../navigation/routes";
import {
  PassengerHomePage,
  PassengerRequestRidePage,
  PassengerTripsPage,
  PassengerGuidesPage,
  PassengerRentalsPage,
  PassengerWalletPage,
  PassengerProfilePage,
  PassengerServiceBookingsPage,
} from "../pages/passenger";

const TABS = [
  { path: ROUTES.PASSENGER.HOME,             label: "Inicio",    icon: homeOutline },
  { path: ROUTES.PASSENGER.TRIPS,            label: "Viajes",    icon: carOutline },
  { path: ROUTES.PASSENGER.GUIDES,           label: "Servicios", icon: mapOutline },
  { path: ROUTES.PASSENGER.SERVICE_BOOKINGS, label: "Reservas",  icon: calendarOutline },
  { path: ROUTES.PASSENGER.WALLET,           label: "Billetera", icon: walletOutline },
  { path: ROUTES.PASSENGER.PROFILE,          label: "Perfil",    icon: personOutline },
];

export function PassengerLayout(): JSX.Element {
  return (
    <RoleLayout tabs={TABS}>
      <Switch>
        <Route exact path={ROUTES.PASSENGER.HOME}                component={PassengerHomePage} />
        <Route exact path={ROUTES.PASSENGER.REQUEST_RIDE}        component={PassengerRequestRidePage} />
        <Route exact path={ROUTES.PASSENGER.TRIPS}               component={PassengerTripsPage} />
        <Route exact path={ROUTES.PASSENGER.TRIP_DETAIL_PATTERN} component={PassengerTripsPage} />
        <Route exact path={ROUTES.PASSENGER.GUIDES}              component={PassengerGuidesPage} />
        <Route exact path={ROUTES.PASSENGER.GUIDE_DETAIL_PATTERN} component={PassengerGuidesPage} />
        <Route exact path={ROUTES.PASSENGER.RENTALS}             component={PassengerRentalsPage} />
        <Route exact path={ROUTES.PASSENGER.RENTAL_DETAIL_PATTERN} component={PassengerRentalsPage} />
        <Route exact path={ROUTES.PASSENGER.WALLET}              component={PassengerWalletPage} />
        <Route exact path={ROUTES.PASSENGER.PROFILE}             component={PassengerProfilePage} />
        <Route exact path={ROUTES.PASSENGER.SERVICE_BOOKINGS}    component={PassengerServiceBookingsPage} />
      </Switch>
    </RoleLayout>
  );
}
