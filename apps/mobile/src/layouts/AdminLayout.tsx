import {
  homeOutline,
  peopleOutline,
  carOutline,
  settingsOutline,
  documentTextOutline,
  personAddOutline,
  ticketOutline,
  shieldCheckmarkOutline,
  cashOutline,
  giftOutline,
  helpBuoyOutline,
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
import {
  DISABLED_ADMIN_PATHS,
  RELEASE_FEATURES,
} from "../config/releaseFeatures.js";

const TABS = [
  { path: ROUTES.ADMIN.HOME, label: "Panel", icon: homeOutline },
  { path: ROUTES.ADMIN.USERS, label: "Usuarios", icon: peopleOutline },
  { path: ROUTES.ADMIN.DOCUMENTS, label: "Docs", icon: documentTextOutline },
  { path: ROUTES.ADMIN.APPLICATIONS, label: "Postul.", icon: personAddOutline },
  { path: ROUTES.ADMIN.TRIPS, label: "Viajes", icon: carOutline },
  { path: ROUTES.ADMIN.PAYMENTS, label: "Pagos", icon: cashOutline },
  ...(RELEASE_FEATURES.events
    ? [{ path: ROUTES.ADMIN.EVENT_TICKETS, label: "Entradas", icon: ticketOutline }]
    : []),
  { path: ROUTES.ADMIN.LEGAL_DOCUMENTS, label: "Legales", icon: shieldCheckmarkOutline },
  { path: ROUTES.ADMIN.FARE_SETTINGS, label: "Tarifas", icon: cashOutline },
  { path: ROUTES.ADMIN.REFERRALS, label: "Referidos", icon: giftOutline },
  { path: ROUTES.ADMIN.SUPPORT, label: "Soporte", icon: helpBuoyOutline },
  { path: ROUTES.ADMIN.SETTINGS, label: "Config", icon: settingsOutline },
];

const ADMIN_ALLOWED_PATHS = [
  ROUTES.ADMIN.BASE,
  ROUTES.ADMIN.HOME,
  ROUTES.ADMIN.USERS,
  ROUTES.ADMIN.DRIVERS,
  ...(RELEASE_FEATURES.tourism ? [ROUTES.ADMIN.GUIDES] : []),
  ...(RELEASE_FEATURES.rentals ? [ROUTES.ADMIN.RENTALS] : []),
  ROUTES.ADMIN.TRIPS,
  ROUTES.ADMIN.PAYMENTS,
  ROUTES.ADMIN.SETTINGS,
  ROUTES.ADMIN.DOCUMENTS,
  ROUTES.ADMIN.OFFLINE_BOOKINGS,
  ROUTES.ADMIN.APPLICATIONS,
  ...(RELEASE_FEATURES.events ? [ROUTES.ADMIN.EVENT_TICKETS] : []),
  "/admin/activity",
  "/admin/alerts",
  ROUTES.ADMIN.LEGAL_DOCUMENTS,
  ROUTES.ADMIN.FARE_SETTINGS,
  ROUTES.ADMIN.REFERRALS,
  ROUTES.ADMIN.SUPPORT,
] as const;

export function AdminLayout(): JSX.Element {
  return (
    <RoleLayout tabs={TABS}>
      <Redirect exact from={ROUTES.ADMIN.BASE} to={ROUTES.ADMIN.HOME} />
      <Route exact path={ROUTES.ADMIN.HOME} component={AdminHomePage} />
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
