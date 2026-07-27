import { homeOutline, compassOutline, calendarOutline, cashOutline } from "ionicons/icons";
import { Redirect, Route } from "react-router-dom";
import { RoleLayout } from "./RoleLayout";
import { UnknownRolePathRedirect } from "./UnknownRolePathRedirect.js";
import { ROUTES } from "../navigation/routes";
import {
  GuideHomePage,
  GuideToursPage,
  GuideBookingsPage,
  GuideEarningsPage,
  GuideProfilePage,
} from "../pages/guide";

const TABS = [
  { path: ROUTES.GUIDE.HOME, label: "Inicio", icon: homeOutline },
  { path: ROUTES.GUIDE.TOURS, label: "Mis Tours", icon: compassOutline },
  { path: ROUTES.GUIDE.BOOKINGS, label: "Reservas", icon: calendarOutline },
  { path: ROUTES.GUIDE.EARNINGS, label: "Ganancias", icon: cashOutline },
];

const GUIDE_ALLOWED_PATHS = [
  ROUTES.GUIDE.BASE,
  ROUTES.GUIDE.HOME,
  ROUTES.GUIDE.TOURS,
  ROUTES.GUIDE.TOUR_DETAIL_PATTERN,
  ROUTES.GUIDE.BOOKINGS,
  ROUTES.GUIDE.EARNINGS,
  ROUTES.GUIDE.PROFILE,
] as const;

export function GuideLayout(): JSX.Element {
  return (
    <RoleLayout tabs={TABS}>
      <Redirect exact from={ROUTES.GUIDE.BASE} to={ROUTES.GUIDE.HOME} />
      <Route exact path={ROUTES.GUIDE.HOME} component={GuideHomePage} />
      <Route exact path={ROUTES.GUIDE.TOURS} component={GuideToursPage} />
      <Route exact path={ROUTES.GUIDE.TOUR_DETAIL_PATTERN} component={GuideToursPage} />
      <Route exact path={ROUTES.GUIDE.BOOKINGS} component={GuideBookingsPage} />
      <Route exact path={ROUTES.GUIDE.EARNINGS} component={GuideEarningsPage} />
      <Route exact path={ROUTES.GUIDE.PROFILE} component={GuideProfilePage} />
      <Route
        path={ROUTES.GUIDE.BASE}
        render={() => (
          <UnknownRolePathRedirect
            basePath={ROUTES.GUIDE.BASE}
            allowedPaths={GUIDE_ALLOWED_PATHS}
          />
        )}
      />
    </RoleLayout>
  );
}
