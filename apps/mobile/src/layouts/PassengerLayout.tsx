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
/* Centro de ayuda: la pestaña "Ayuda" apunta a /support-center, que está fuera
   del prefijo /passenger. Se monta aquí dentro para que la barra inferior no
   desaparezca al entrar (ver el caso especial en AppRouter). */
const SupportCenterPage = lazy(() =>
  import("../pages/support/SupportCenterPage.js").then((module) => ({
    default: module.SupportCenterPage,
  })),
);
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
        <Route
          exact
          path={ROUTES.SUPPORT.CENTER}
          render={() => <PageSuspense><SupportCenterPage /></PageSuspense>}
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

      </RoleLayout>
    </>
  );
}


