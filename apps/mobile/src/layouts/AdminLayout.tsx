import { homeOutline, peopleOutline, carOutline, settingsOutline, documentTextOutline, personAddOutline, ticketOutline, shieldCheckmarkOutline, cashOutline, giftOutline, helpBuoyOutline } from "ionicons/icons";
import { Route, Switch } from "react-router-dom";
import { RoleLayout } from "./RoleLayout";
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

const TABS = [
  { path: ROUTES.ADMIN.HOME,             label: "Panel",    icon: homeOutline },
  { path: ROUTES.ADMIN.USERS,            label: "Usuarios", icon: peopleOutline },
  { path: ROUTES.ADMIN.DOCUMENTS,        label: "Docs",     icon: documentTextOutline },
  { path: ROUTES.ADMIN.APPLICATIONS,     label: "Postul.",  icon: personAddOutline },
  { path: ROUTES.ADMIN.TRIPS,            label: "Viajes",   icon: carOutline },
  { path: ROUTES.ADMIN.EVENT_TICKETS,    label: "Entradas", icon: ticketOutline },
  { path: ROUTES.ADMIN.LEGAL_DOCUMENTS,  label: "Legales",  icon: shieldCheckmarkOutline },
  { path: ROUTES.ADMIN.FARE_SETTINGS,    label: "Tarifas",  icon: cashOutline },
  { path: ROUTES.ADMIN.REFERRALS,        label: "Referidos", icon: giftOutline },
  { path: ROUTES.ADMIN.SUPPORT,          label: "Soporte",   icon: helpBuoyOutline },
  { path: ROUTES.ADMIN.SETTINGS,         label: "Config",   icon: settingsOutline },
];

export function AdminLayout(): JSX.Element {
  return (
    <RoleLayout tabs={TABS}>
      <Switch>
        <Route exact path={ROUTES.ADMIN.HOME} component={AdminHomePage} />
        <Route exact path={ROUTES.ADMIN.USERS} component={AdminUsersPage} />
        <Route exact path={ROUTES.ADMIN.DRIVERS} component={AdminDriversPage} />
        <Route exact path={ROUTES.ADMIN.GUIDES} component={AdminGuidesPage} />
        <Route exact path={ROUTES.ADMIN.RENTALS} component={AdminRentalsPage} />
        <Route exact path={ROUTES.ADMIN.TRIPS} component={AdminTripsPage} />
        <Route exact path={ROUTES.ADMIN.PAYMENTS} component={AdminPaymentsPage} />
        <Route exact path={ROUTES.ADMIN.SETTINGS}          component={AdminSettingsPage} />
        <Route exact path={ROUTES.ADMIN.DOCUMENTS}         component={AdminDocumentsPage} />
        <Route exact path={ROUTES.ADMIN.OFFLINE_BOOKINGS}  component={AdminOfflineBookingsPage} />
        <Route exact path={ROUTES.ADMIN.APPLICATIONS}      component={AdminApplicationsPage} />
        <Route exact path={ROUTES.ADMIN.EVENT_TICKETS}     component={AdminEventTicketsPage} />
        <Route exact path="/admin/activity"        component={AdminActivityPage} />
        <Route exact path="/admin/alerts"           component={AdminAlertsPage} />
        <Route exact path="/admin/legal-documents"  component={AdminLegalDocumentsPage} />
        <Route exact path={ROUTES.ADMIN.FARE_SETTINGS} component={AdminFareSettingsPage} />
        <Route exact path={ROUTES.ADMIN.REFERRALS}    component={AdminReferralsPage} />
        <Route exact path={ROUTES.ADMIN.SUPPORT}      component={AdminSupportPage} />
      </Switch>
    </RoleLayout>
  );
}
