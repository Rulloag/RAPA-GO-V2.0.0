import type { ReactNode } from "react";
import { IonSpinner } from "@ionic/react";
import { Redirect } from "react-router-dom";
import { useAuth } from "../features/auth";
import { ROUTES } from "./routes";
import type { UserRole } from "@rapa-go/shared";

export const ROLE_HOME: Record<UserRole, string> = {
  passenger: ROUTES.PASSENGER.HOME,
  driver: ROUTES.DRIVER.HOME,
  guide: ROUTES.GUIDE.HOME,
  rental_operator: ROUTES.RENTAL.HOME,
  admin: ROUTES.ADMIN.HOME,
};

const ROLE_ALLOWED_BASE: Record<UserRole, string> = {
  passenger: ROUTES.PASSENGER.BASE,
  driver: ROUTES.DRIVER.BASE,
  guide: ROUTES.GUIDE.BASE,
  rental_operator: ROUTES.RENTAL.BASE,
  admin: ROUTES.ADMIN.BASE,
};

const PRIVATE_BASES = [
  ROUTES.PASSENGER.BASE,
  ROUTES.DRIVER.BASE,
  ROUTES.GUIDE.BASE,
  ROUTES.RENTAL.BASE,
  ROUTES.ADMIN.BASE,
];

interface RouteGuardProps {
  children: ReactNode;
  path: string;
}

function getActiveMode(): "passenger" | "driver" | null {
  const mode = localStorage.getItem("rapago_active_mode");
  return mode === "passenger" || mode === "driver" ? mode : null;
}

function getRedirectHome(role: UserRole): string {
  const mode = getActiveMode();

  if (role === "driver" && mode === "passenger") {
    return ROUTES.PASSENGER.HOME;
  }

  if (role === "driver" && mode === "driver") {
    return ROUTES.DRIVER.HOME;
  }

  return ROLE_HOME[role];
}

export function RouteGuard({ children, path }: RouteGuardProps): JSX.Element {
  const { status, user } = useAuth();

  if (status === "loading") {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <IonSpinner name="crescent" />
      </div>
    );
  }

  if (status === "unauthenticated" || !user) {
    return <Redirect to={ROUTES.AUTH.LOGIN} />;
  }

  if (path.startsWith(ROUTES.PROFILE.BASE)) {
    return <>{children}</>;
  }

  const activeMode = getActiveMode();

  if (
    user.role === "driver" &&
    activeMode === "passenger" &&
    path.startsWith(ROUTES.PASSENGER.BASE)
  ) {
    return <>{children}</>;
  }

  if (
    user.role === "driver" &&
    activeMode === "driver" &&
    path.startsWith(ROUTES.DRIVER.BASE)
  ) {
    return <>{children}</>;
  }

  if (
    user.role === "driver" &&
    activeMode === "passenger" &&
    path.startsWith(ROUTES.DRIVER.BASE)
  ) {
    return <Redirect to={ROUTES.PASSENGER.HOME} />;
  }

  if (
    user.role === "driver" &&
    activeMode === "driver" &&
    path.startsWith(ROUTES.PASSENGER.BASE)
  ) {
    return <Redirect to={ROUTES.DRIVER.HOME} />;
  }

  const allowedBase = ROLE_ALLOWED_BASE[user.role];
  const isPrivateBase = PRIVATE_BASES.some((base) => path.startsWith(base));

  if (isPrivateBase && !path.startsWith(allowedBase)) {
    return <Redirect to={getRedirectHome(user.role)} />;
  }

  return <>{children}</>;
}