import {
  homeOutline,
  peopleOutline,
  carOutline,
  personAddOutline,
  ellipsisHorizontalOutline,
} from "ionicons/icons";
import { Redirect, Route } from "react-router-dom";
import { RoleLayout } from "./RoleLayout";
import { UnknownRolePathRedirect } from "./UnknownRolePathRedirect.js";
import { ROUTES } from "../navigation/routes";
import {
  AdminHomePage,
  AdminUsersPage,
  AdminDriversPage,
  AdminGuidesPage,
  AdminRentalsPage,
  AdminTripsPage,
  AdminPaymentsPage,
  AdminSettingsPage,
  AdminDocumentsPage,
  AdminOfflineBookingsPage,
  AdminActivityPage,
  AdminAlertsPage,
  AdminEventTicketsPage,
} from "../pages/admin";
import { AdminApplicationsPage } from "../pages/admin/applications/index.js";
import { AdminLegalDocumentsPage } from "../pages/admin/legal/index.js";
import { AdminFareSettingsPage } from "../pages/admin/fare/index.js";
import { AdminReferralsPage } from "../pages/admin/referrals/index.js";
import { AdminSupportPage } from "../pages/admin/support/index.js";
import { AdminMorePage } from "../pages/admin/more/index.js";
/* Notificaciones vive en /notifications, fuera del prefijo /admin, pero la
   campana y el menú de cuenta del panel llevan ahí. Se monta dentro de este
   layout para que no pierda la barra inferior al entrar (ver el caso especial
   en AppRouter). */
import { NotificationPage } from "../pages/notifications/NotificationPage.js";
import {
  DISABLED_ADMIN_PATHS,
  RELEASE_FEATURES,
} from "../config/releaseFeatures.js";

/**
 * CINCO PESTAÑAS, NO ONCE.
 *
 * La píldora flotante mide 460px como máximo (rapago-shell.css). Con las once
 * pestañas que había en producción, cada celda quedaba en ~40px: por debajo del
 * mínimo táctil de 44pt/48dp, con la etiqueta recortada a mitad de palabra
 * ("Postul."). El pasajero tiene cuatro y el conductor cinco, así que el panel
 * era además la única barra de la app con ese aspecto.
 *
 * Se quedan los cinco destinos del trabajo diario. El resto vive en el hub
 * `/admin/more`, agrupado por dominio y con una descripción por sección — más
 * accesible que una etiqueta de siete caracteres, no menos.
 *
 * Las pestañas NO dependen de banderas de release: las cinco existen siempre.
 * El filtrado por bandera ocurre dentro del hub, que es donde viven los módulos
 * futuros.
 */
export const ADMIN_TABS = [
  { path: ROUTES.ADMIN.HOME, label: "Panel", icon: homeOutline },
  { path: ROUTES.ADMIN.USERS, label: "Usuarios", icon: peopleOutline },
  /* "Postulantes" y no "Postulaciones" —el título de la pantalla— porque a
     360px de ancho, que es la anchura de un Galaxy S8 y de buena parte del
     parque Android, la celda mide 65px y "Postulaciones" se corta en
     "Postulacione". Un destino que no se puede leer entero no es navegación.
     La forma corta nombra a las personas que hay que revisar, que es
     literalmente lo que lista la pantalla, así que no es una abreviatura: es
     el mismo concepto dicho en una palabra que cabe. */
  { path: ROUTES.ADMIN.APPLICATIONS, label: "Postulantes", icon: personAddOutline },
  { path: ROUTES.ADMIN.TRIPS, label: "Viajes", icon: carOutline },
  { path: ROUTES.ADMIN.MORE, label: "Más", icon: ellipsisHorizontalOutline },
];

const TABS = ADMIN_TABS;

export const ADMIN_ALLOWED_PATHS = [
  ROUTES.ADMIN.BASE,
  ROUTES.ADMIN.HOME,
  ROUTES.ADMIN.MORE,
  ROUTES.ADMIN.USERS,
  ROUTES.ADMIN.DRIVERS,
  ROUTES.ADMIN.GUIDES,
  ROUTES.ADMIN.RENTALS,
  ROUTES.ADMIN.TRIPS,
  ROUTES.ADMIN.PAYMENTS,
  ROUTES.ADMIN.SETTINGS,
  ROUTES.ADMIN.DOCUMENTS,
  ROUTES.ADMIN.OFFLINE_BOOKINGS,
  ROUTES.ADMIN.APPLICATIONS,
  ROUTES.ADMIN.EVENT_TICKETS,
  ROUTES.ADMIN.LEGAL_DOCUMENTS,
  ROUTES.ADMIN.FARE_SETTINGS,
  ROUTES.ADMIN.REFERRALS,
  ROUTES.ADMIN.SUPPORT,
  "/admin/activity",
  "/admin/alerts",
] as const;
export function AdminLayout(): JSX.Element {
  return (
    <RoleLayout tabs={TABS}>
      <Redirect exact from={ROUTES.ADMIN.BASE} to={ROUTES.ADMIN.HOME} />
      <Route exact path={ROUTES.ADMIN.HOME} component={AdminHomePage} />
      <Route exact path={ROUTES.ADMIN.MORE} component={AdminMorePage} />
      <Route exact path={ROUTES.ADMIN.USERS} component={AdminUsersPage} />
      <Route exact path={ROUTES.ADMIN.DRIVERS} component={AdminDriversPage} />
      {RELEASE_FEATURES.tourism && (
        <Route exact path={ROUTES.ADMIN.GUIDES} component={AdminGuidesPage} />
      )}
      {RELEASE_FEATURES.rentals && (
        <Route exact path={ROUTES.ADMIN.RENTALS} component={AdminRentalsPage} />
      )}
      <Route exact path={ROUTES.ADMIN.TRIPS} component={AdminTripsPage} />
      <Route exact path={ROUTES.ADMIN.PAYMENTS} component={AdminPaymentsPage} />
      <Route exact path={ROUTES.ADMIN.SETTINGS} component={AdminSettingsPage} />
      <Route exact path={ROUTES.ADMIN.DOCUMENTS} component={AdminDocumentsPage} />
      <Route exact path={ROUTES.ADMIN.OFFLINE_BOOKINGS} component={AdminOfflineBookingsPage} />
      <Route exact path={ROUTES.ADMIN.APPLICATIONS} component={AdminApplicationsPage} />
      {RELEASE_FEATURES.events && (
        <Route exact path={ROUTES.ADMIN.EVENT_TICKETS} component={AdminEventTicketsPage} />
      )}
      <Route exact path="/admin/activity" component={AdminActivityPage} />
      <Route exact path="/admin/alerts" component={AdminAlertsPage} />
      <Route exact path={ROUTES.ADMIN.LEGAL_DOCUMENTS} component={AdminLegalDocumentsPage} />
      <Route exact path={ROUTES.ADMIN.FARE_SETTINGS} component={AdminFareSettingsPage} />
      <Route exact path={ROUTES.ADMIN.REFERRALS} component={AdminReferralsPage} />
      <Route exact path={ROUTES.ADMIN.SUPPORT} component={AdminSupportPage} />
      <Route exact path={ROUTES.NOTIFICATIONS} component={NotificationPage} />

      {DISABLED_ADMIN_PATHS.length > 0 && (
        <Route
          path={[...DISABLED_ADMIN_PATHS]}
          render={() => <Redirect to={ROUTES.NOT_FOUND} />}
        />
      )}

      <Route
        path={ROUTES.ADMIN.BASE}
        render={() => (
          <UnknownRolePathRedirect
            basePath={ROUTES.ADMIN.BASE}
            allowedPaths={ADMIN_ALLOWED_PATHS}
          />
        )}
      />
    </RoleLayout>
  );
}
