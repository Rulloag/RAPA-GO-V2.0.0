import { lazy, Suspense } from "react";
import {
  homeOutline,
  carOutline,
  walletOutline,
  mapOutline,
  calendarOutline,
  ticketOutline,
} from "ionicons/icons";
import { Route, Switch } from "react-router-dom";
import { IonSpinner } from "@ionic/react";
import { RoleLayout } from "./RoleLayout";
import { ROUTES } from "../navigation/routes";
import {
  PassengerEventsPage,
  PassengerEventTicketsPage,
} from "../pages/passenger/events/index.js";
import {
  PassengerServiceBookingsPage,
  PassengerRentalBookingsPage,
} from "../pages/passenger/index.js";

const HomePage = lazy(() => import("../pages/passenger/pages/HomePage.js"));
const RequestRidePage = lazy(
  () => import("../pages/passenger/pages/RequestRidePage.js")
);
const TripsPage = lazy(() => import("../pages/passenger/pages/TripsPage.js"));
const GuidesPage = lazy(() => import("../pages/passenger/pages/GuidesPage.js"));
const RentalsPage = lazy(() => import("../pages/passenger/pages/RentalsPage.js"));
const WalletPage = lazy(() => import("../pages/passenger/pages/WalletPage.js"));
const ProfilePage = lazy(() => import("../pages/passenger/pages/ProfilePage.js"));

const TABS = [
  { path: ROUTES.PASSENGER.HOME, label: "Inicio", icon: homeOutline },
  { path: ROUTES.PASSENGER.TRIPS, label: "Viajes", icon: carOutline },
  { path: ROUTES.PASSENGER.GUIDES, label: "Servicios", icon: mapOutline },
  {
    path: ROUTES.PASSENGER.SERVICE_BOOKINGS,
    label: "Reservas",
    icon: calendarOutline,
  },
  { path: ROUTES.PASSENGER.EVENTS, label: "Eventos", icon: ticketOutline },
  { path: ROUTES.PASSENGER.WALLET, label: "Billetera", icon: walletOutline },
];

function PageSuspense({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <Suspense
      fallback={
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "60vh",
          }}
        >
          <IonSpinner name="crescent" />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

export function PassengerLayout(): JSX.Element {
  return (
    <RoleLayout tabs={TABS}>
      <Switch>
        <Route
          exact
          path={ROUTES.PASSENGER.HOME}
          render={() => (
            <PageSuspense>
              <HomePage />
            </PageSuspense>
          )}
        />

        <Route
          exact
          path={ROUTES.PASSENGER.REQUEST_RIDE}
          render={() => (
            <PageSuspense>
              <RequestRidePage />
            </PageSuspense>
          )}
        />

        <Route
          exact
          path={ROUTES.PASSENGER.TRIPS}
          render={() => (
            <PageSuspense>
              <TripsPage />
            </PageSuspense>
          )}
        />

        <Route
          exact
          path={ROUTES.PASSENGER.TRIP_DETAIL_PATTERN}
          render={() => (
            <PageSuspense>
              <TripsPage />
            </PageSuspense>
          )}
        />

        <Route
          exact
          path={ROUTES.PASSENGER.GUIDES}
          render={() => (
            <PageSuspense>
              <GuidesPage />
            </PageSuspense>
          )}
        />

        <Route
          exact
          path={ROUTES.PASSENGER.GUIDE_DETAIL_PATTERN}
          render={() => (
            <PageSuspense>
              <GuidesPage />
            </PageSuspense>
          )}
        />

        <Route
          exact
          path={ROUTES.PASSENGER.RENTALS}
          render={() => (
            <PageSuspense>
              <RentalsPage />
            </PageSuspense>
          )}
        />

        <Route
          exact
          path={ROUTES.PASSENGER.RENTAL_DETAIL_PATTERN}
          render={() => (
            <PageSuspense>
              <RentalsPage />
            </PageSuspense>
          )}
        />

        <Route
          exact
          path={ROUTES.PASSENGER.WALLET}
          render={() => (
            <PageSuspense>
              <WalletPage />
            </PageSuspense>
          )}
        />

        <Route
          exact
          path={ROUTES.PASSENGER.PROFILE}
          render={() => (
            <PageSuspense>
              <ProfilePage />
            </PageSuspense>
          )}
        />

        <Route
          exact
          path={ROUTES.PASSENGER.SERVICE_BOOKINGS}
          component={PassengerServiceBookingsPage}
        />

        <Route
          exact
          path="/passenger/rental-bookings"
          component={PassengerRentalBookingsPage}
        />

        <Route
          exact
          path={ROUTES.PASSENGER.EVENTS}
          component={PassengerEventsPage}
        />

        <Route
          exact
          path={ROUTES.PASSENGER.EVENT_TICKETS}
          component={PassengerEventTicketsPage}
        />
      </Switch>
    </RoleLayout>
  );
}