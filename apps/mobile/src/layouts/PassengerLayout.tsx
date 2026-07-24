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
import { Redirect, Route } from "react-router-dom";
import { IonContent, IonPage, IonSpinner } from "@ionic/react";
import { RoleLayout } from "./RoleLayout";
import { UnknownRolePathRedirect } from "./UnknownRolePathRedirect.js";
import { ROUTES } from "../navigation/routes";
import { PassengerLocationRuntime } from "../features/location/index.js";
import {
  DISABLED_PASSENGER_PATHS,
  RELEASE_FEATURES,
} from "../config/releaseFeatures.js";

import HomePage from "../pages/passenger/pages/HomePage.js";
import RequestRidePage from "../pages/passenger/pages/RequestRidePage.js";
import TripsPage from "../pages/passenger/pages/TripsPage.js";
import WalletPage from "../pages/passenger/pages/WalletPage.js";
import ProfilePage from "../pages/passenger/pages/ProfilePage.js";
import GuidesPage from "../pages/passenger/pages/GuidesPage.js";
import RentalsPage from "../pages/passenger/pages/RentalsPage.js";
import {
  PassengerEventsPage,
  PassengerEventTicketsPage,
} from "../pages/passenger/events/index.js";

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
        <IonPage>
          <IonContent fullscreen>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                minHeight: "100%",
              }}
            >
              <IonSpinner name="crescent" color="warning" />
            </div>
          </IonContent>
        </IonPage>
      }
    >
      {children}
    </Suspense>
  );
}

const PASSENGER_ALLOWED_PATHS = [
  ROUTES.PASSENGER.BASE,
  ROUTES.PASSENGER.HOME,
  ROUTES.PASSENGER.REQUEST_RIDE,
  ROUTES.PASSENGER.TRIPS,
  ROUTES.PASSENGER.TRIP_DETAIL_PATTERN,
  ROUTES.PASSENGER.WALLET,
  ROUTES.PASSENGER.PROFILE,
  ...(RELEASE_FEATURES.tourism
    ? [ROUTES.PASSENGER.GUIDES, ROUTES.PASSENGER.GUIDE_DETAIL_PATTERN]
    : []),
  ...(RELEASE_FEATURES.rentals
    ? [ROUTES.PASSENGER.RENTALS, ROUTES.PASSENGER.RENTAL_DETAIL_PATTERN]
    : []),
  ...(RELEASE_FEATURES.events
    ? [ROUTES.PASSENGER.EVENTS, ROUTES.PASSENGER.EVENT_TICKETS]
    : []),
] as const;

export function PassengerLayout(): JSX.Element {
  return (
    <>
      <PassengerLocationRuntime />
      <RoleLayout tabs={TABS}>
        <Redirect exact from={ROUTES.PASSENGER.BASE} to={ROUTES.PASSENGER.HOME} />

        <Route
          exact
          path={ROUTES.PASSENGER.HOME}
          component={HomePage}
        />
        <Route
          exact
          path={ROUTES.PASSENGER.REQUEST_RIDE}
          component={RequestRidePage}
        />
        <Route
          exact
          path={ROUTES.PASSENGER.TRIPS}
          component={TripsPage}
        />
        <Route
          exact
          path={ROUTES.PASSENGER.TRIP_DETAIL_PATTERN}
          component={TripsPage}
        />
        <Route
          exact
          path={ROUTES.PASSENGER.WALLET}
          component={WalletPage}
        />
        <Route
          exact
          path={ROUTES.PASSENGER.PROFILE}
          component={ProfilePage}
        />

        {RELEASE_FEATURES.tourism && (
          <Route
            exact
            path={[ROUTES.PASSENGER.GUIDES, ROUTES.PASSENGER.GUIDE_DETAIL_PATTERN]}
            component={GuidesPage}
          />
        )}

        {RELEASE_FEATURES.rentals && (
          <Route
            exact
            path={[ROUTES.PASSENGER.RENTALS, ROUTES.PASSENGER.RENTAL_DETAIL_PATTERN]}
            component={RentalsPage}
          />
        )}

        {RELEASE_FEATURES.events && (
          <Route
            exact
            path={ROUTES.PASSENGER.EVENTS}
            component={PassengerEventsPage}
          />
        )}

        {RELEASE_FEATURES.events && (
          <Route
            exact
            path={ROUTES.PASSENGER.EVENT_TICKETS}
            component={PassengerEventTicketsPage}
          />
        )}

        {DISABLED_PASSENGER_PATHS.length > 0 && (
          <Route
            path={[...DISABLED_PASSENGER_PATHS]}
            render={() => <Redirect to={ROUTES.NOT_FOUND} />}
          />
        )}

        <Route
          path={ROUTES.PASSENGER.BASE}
          render={() => (
            <UnknownRolePathRedirect
              basePath={ROUTES.PASSENGER.BASE}
              allowedPaths={PASSENGER_ALLOWED_PATHS}
            />
          )}
        />

      </RoleLayout>
    </>
  );
}

