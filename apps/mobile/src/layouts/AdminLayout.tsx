import { homeOutline, peopleOutline, carOutline, cloudOfflineOutline, settingsOutline, documentTextOutline } from "ionicons/icons";
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
} from "../pages/admin";

const TABS = [
  { path: ROUTES.ADMIN.HOME,             label: "Panel",    icon: homeOutline },
  { path: ROUTES.ADMIN.USERS,            label: "Usuarios", icon: peopleOutline },
  { path: ROUTES.ADMIN.DOCUMENTS,        label: "Docs",     icon: documentTextOutline },
  { path: ROUTES.ADMIN.TRIPS,            label: "Viajes",   icon: carOutline },
  { path: ROUTES.ADMIN.OFFLINE_BOOKINGS, label: "Offline",  icon: cloudOfflineOutline },
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
        <Route exact path={ROUTES.ADMIN.SETTINGS}   component={AdminSettingsPage} />
        <Route exact path={ROUTES.ADMIN.DOCUMENTS}        component={AdminDocumentsPage} />
        <Route exact path={ROUTES.ADMIN.OFFLINE_BOOKINGS} component={AdminOfflineBookingsPage} />
      </Switch>
    </RoleLayout>
  );
}
