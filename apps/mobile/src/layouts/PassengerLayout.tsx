import { lazy, Suspense, type ReactNode } from "react";
import {
  homeOutline,
  carOutline,
  walletOutline,
  mapOutline,
  calendarOutline,
  ticketOutline,
  helpCircleOutline,
} from "ionicons/icons";
import { Redirect, Route, Switch } from "react-router-dom";
import { IonSpinner } from "@ionic/react";
import { RoleLayout } from "./RoleLayout";
import { ROUTES } from "../navigation/routes";
import { PassengerLocationRuntime } from "../features/location/index.js";
import {
  DISABLED_PASSENGER_PATHS,
  RELEASE_FEATURES,
} from "../config/releaseFeatures.js";

const HomePage = lazy(() => import("../pages/passenger/pages/HomePage.js"));
const RequestRidePage = lazy(
  () => import("../pages/passenger/pages/RequestRidePage.js"),
);
const TripsPage = lazy(() => import("../pages/passenger/pages/TripsPage.js"));
const WalletPage = lazy(() => import("../pages/passenger/pages/WalletPage.js"));
const ProfilePage = lazy(() => import("../pages/passenger/pages/ProfilePage.js"));
const GuidesPage = lazy(() => import("../pages/passenger/pages/GuidesPage.js"));
const RentalsPage = lazy(() => import("../pages/passenger/pages/RentalsPage.js"));
const PassengerEventsPage = lazy(() =>
  import("../pages/passenger/events/index.js").then((module) => ({
    default: module.PassengerEventsPage,
  })),
);
const PassengerEventTicketsPage = lazy(() =>
  import("../pages/passenger/events/index.js").then((module) => ({
    default: module.PassengerEventTicketsPage,
  })),
);

const TABS = [
  { path: ROUTES.PASSENGER.HOME, label: "Inicio", icon: homeOutline },
  { path: ROUTES.PASSENGER.TRIPS, label: "Viajes", icon: carOutline },
  ...(RELEASE_FEATURES.tourism
    ? [{ path: ROUTES.PASSENGER.GUIDES, label: "Guías", icon: mapOutline }]
    : []),
  ...(RELEASE_FEATURES.rentals
    ? [{ path: ROUTES.PASSENGER.RENTALS, label: "Arriendo", icon: calendarOutline }]
    : []),
  ...(RELEASE_FEATURES.events
    ? [{ path: ROUTES.PASSENGER.EVENTS, label: "Eventos", icon: ticketOutline }]
    : []),
  { path: ROUTES.SUPPORT.CENTER, label: "Ayuda", icon: helpCircleOutline },
  { path: ROUTES.PASSENGER.WALLET, label: "Beneficios", icon: walletOutline },
];

function PageSuspense({ children }: { children: ReactNode }): JSX.Element {
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
      <PassengerLocationRuntime />
      <Switch>
        <Route
          exact
          path={ROUTES.PASSENGER.HOME}
          render={() => <PageSuspense><HomePage /></PageSuspense>}
        />
        <Route
          exact
          path={ROUTES.PASSENGER.REQUEST_RIDE}
          render={() => <PageSuspense><RequestRidePage /></PageSuspense>}
        />
        <Route
          exact
          path={ROUTES.PASSENGER.TRIPS}
          render={() => <PageSuspense><TripsPage /></PageSuspense>}
        />
        <Route
          exact
          path={ROUTES.PASSENGER.TRIP_DETAIL_PATTERN}
          render={() => <PageSuspense><TripsPage /></PageSuspense>}
        />
        <Route
          exact
          path={ROUTES.PASSENGER.WALLET}
          render={() => <PageSuspense><WalletPage /></PageSuspense>}
        />
        <Route
          exact
          path={ROUTES.PASSENGER.PROFILE}
          render={() => <PageSuspense><ProfilePage /></PageSuspense>}
        />

        {RELEASE_FEATURES.tourism && (
          <Route
            exact
            path={[ROUTES.PASSENGER.GUIDES, ROUTES.PASSENGER.GUIDE_DETAIL_PATTERN]}
            render={() => <PageSuspense><GuidesPage /></PageSuspense>}
          />
        )}

        {RELEASE_FEATURES.rentals && (
          <Route
            exact
            path={[ROUTES.PASSENGER.RENTALS, ROUTES.PASSENGER.RENTAL_DETAIL_PATTERN]}
            render={() => <PageSuspense><RentalsPage /></PageSuspense>}
          />
        )}

        {RELEASE_FEATURES.events && (
          <Route
            exact
            path={ROUTES.PASSENGER.EVENTS}
            render={() => <PageSuspense><PassengerEventsPage /></PageSuspense>}
          />
        )}

        {RELEASE_FEATURES.events && (
          <Route
            exact
            path={ROUTES.PASSENGER.EVENT_TICKETS}
            render={() => <PageSuspense><PassengerEventTicketsPage /></PageSuspense>}
          />
        )}

        {DISABLED_PASSENGER_PATHS.length > 0 && (
          <Route
            path={[...DISABLED_PASSENGER_PATHS]}
            render={() => <Redirect to={ROUTES.NOT_FOUND} />}
          />
        )}

        <Route render={() => <Redirect to={ROUTES.NOT_FOUND} />} />
      </Switch>
    </RoleLayout>
  );
}
