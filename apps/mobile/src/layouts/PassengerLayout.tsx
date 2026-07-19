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
import { Route, Switch } from "react-router-dom";
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonIcon,
  IonPage,
  IonSpinner,
  IonText,
} from "@ionic/react";
import { RoleLayout } from "./RoleLayout";
import { ROUTES } from "../navigation/routes";
import { PassengerLocationRuntime } from "../features/location/index.js";

const HomePage = lazy(() => import("../pages/passenger/pages/HomePage.js"));
const RequestRidePage = lazy(
  () => import("../pages/passenger/pages/RequestRidePage.js"),
);
const TripsPage = lazy(() => import("../pages/passenger/pages/TripsPage.js"));
const WalletPage = lazy(() => import("../pages/passenger/pages/WalletPage.js"));
const ProfilePage = lazy(() => import("../pages/passenger/pages/ProfilePage.js"));

/**
 * IMPORTANTE:
 * Servicios, Reservas y Eventos quedan bloqueados para lanzamiento.
 * No deben llevar al pasajero a páginas antiguas como Guías locales,
 * Eventos o Reservas de servicios.
 *
 * Usamos rutas con query hacia HOME para que el botón no abra módulos viejos.
 */
const TABS = [
  { path: ROUTES.PASSENGER.HOME, label: "Inicio", icon: homeOutline },
  { path: ROUTES.PASSENGER.TRIPS, label: "Viajes", icon: carOutline },

  {
    path: ROUTES.SUPPORT.CENTER,
    label: "Ayuda",
    icon: helpCircleOutline,
  },
  {
    path: `${ROUTES.PASSENGER.HOME}?soon=bookings`,
    label: "Próximamente",
    icon: calendarOutline,
  },
  {
    path: `${ROUTES.PASSENGER.HOME}?soon=events`,
    label: "Próximamente",
    icon: ticketOutline,
  },

  { path: ROUTES.PASSENGER.WALLET, label: "Billetera", icon: walletOutline },
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

function PassengerComingSoonPage({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: string;
}): JSX.Element {
  return (
    <IonPage>
      <IonContent
        className="ion-padding"
        style={
          {
            "--background":
              "linear-gradient(180deg, rgba(15,15,15,.82), rgba(15,15,15,.94)), url('/assets/rapa-go-bg.jpg') center/cover no-repeat",
          } as React.CSSProperties
        }
      >
        <div
          style={{
            minHeight: "78vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            paddingBottom: 80,
          }}
        >
          <IonCard
            style={{
              width: "100%",
              maxWidth: 460,
              margin: 0,
              borderRadius: 28,
              overflow: "hidden",
              background: "linear-gradient(145deg,#F6F2EC 0%,#fff3c4 100%)",
              color: "#111",
              border: "1px solid rgba(210,164,58,.46)",
              boxShadow: "0 24px 70px rgba(0,0,0,.38)",
            }}
          >
            <IonCardContent style={{ padding: 24, textAlign: "center" }}>
              <div
                style={{
                  width: 82,
                  height: 82,
                  borderRadius: 26,
                  margin: "0 auto 16px",
                  background: "linear-gradient(135deg,#D2A43A,#FFC107)",
                  color: "#111",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 18px 36px rgba(210,164,58,.34)",
                }}
              >
                <IonIcon icon={icon} style={{ fontSize: 42 }} />
              </div>

              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "7px 12px",
                  borderRadius: 999,
                  background: "rgba(210,164,58,.18)",
                  border: "1px solid rgba(210,164,58,.42)",
                  color: "#8a6418",
                  fontWeight: 950,
                  fontSize: ".72rem",
                  textTransform: "uppercase",
                  letterSpacing: ".04em",
                  marginBottom: 12,
                }}
              >
                Próximamente
              </div>

              <h1
                style={{
                  margin: "0 0 8px",
                  fontSize: "1.45rem",
                  fontWeight: 950,
                  lineHeight: 1.1,
                }}
              >
                {title}
              </h1>

              <IonText>
                <p
                  style={{
                    margin: "0 auto",
                    maxWidth: 340,
                    color: "#444",
                    fontSize: ".92rem",
                    lineHeight: 1.45,
                    fontWeight: 750,
                  }}
                >
                  {description}
                </p>
              </IonText>

              <IonButton
                expand="block"
                routerLink={ROUTES.PASSENGER.HOME}
                color="warning"
                style={
                  {
                    marginTop: 22,
                    "--border-radius": "18px",
                    "--color": "#111",
                    height: "52px",
                    fontWeight: 950,
                  } as React.CSSProperties
                }
              >
                Volver al inicio
              </IonButton>
            </IonCardContent>
          </IonCard>
        </div>
      </IonContent>
    </IonPage>
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

        {/* MÓDULOS BLOQUEADOS PARA LANZAMIENTO */}

        <Route
          exact
          path={ROUTES.PASSENGER.GUIDES}
          render={() => (
            <PassengerComingSoonPage
              title="Turismo local"
              description="Estamos preparando experiencias locales, guías y actividades turísticas verificadas para Rapa Nui."
              icon={mapOutline}
            />
          )}
        />

        <Route
          exact
          path={ROUTES.PASSENGER.GUIDE_DETAIL_PATTERN}
          render={() => (
            <PassengerComingSoonPage
              title="Turismo local"
              description="Esta sección estará disponible próximamente con guías y experiencias locales verificadas."
              icon={mapOutline}
            />
          )}
        />

        <Route
          exact
          path={ROUTES.PASSENGER.RENTALS}
          render={() => (
            <PassengerComingSoonPage
              title="Reserva de vehículos"
              description="La reserva de vehículos estará disponible próximamente dentro de Rapa Go."
              icon={calendarOutline}
            />
          )}
        />

        <Route
          exact
          path={ROUTES.PASSENGER.RENTAL_DETAIL_PATTERN}
          render={() => (
            <PassengerComingSoonPage
              title="Reserva de vehículos"
              description="Estamos preparando este módulo para que puedas reservar vehículos de forma segura."
              icon={calendarOutline}
            />
          )}
        />

        <Route
          exact
          path={ROUTES.PASSENGER.SERVICE_BOOKINGS}
          render={() => (
            <PassengerComingSoonPage
              title="Reservas"
              description="Las reservas de servicios estarán disponibles próximamente. Por ahora puedes solicitar viajes y revisar tu billetera."
              icon={calendarOutline}
            />
          )}
        />

        <Route
          exact
          path="/passenger/rental-bookings"
          render={() => (
            <PassengerComingSoonPage
              title="Reservas"
              description="La gestión de reservas de vehículos estará disponible próximamente."
              icon={calendarOutline}
            />
          )}
        />

        <Route
          exact
          path={ROUTES.PASSENGER.EVENTS}
          render={() => (
            <PassengerComingSoonPage
              title="Eventos"
              description="Pronto podrás ver eventos, cultura y actividades disponibles en Rapa Nui."
              icon={ticketOutline}
            />
          )}
        />

        <Route
          exact
          path={ROUTES.PASSENGER.EVENT_TICKETS}
          render={() => (
            <PassengerComingSoonPage
              title="Eventos"
              description="La compra y visualización de tickets estará disponible próximamente."
              icon={ticketOutline}
            />
          )}
        />
      </Switch>
    </RoleLayout>
  );
}