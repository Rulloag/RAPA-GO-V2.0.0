import type { ReactNode } from "react";
import { Redirect } from "react-router-dom";
import { useAuth } from "../features/auth";
import { ROUTES } from "./routes";
import type { UserRole } from "@rapa-go/shared";
import {
  getReleaseHome,
  isReleaseRoleEnabled,
} from "../config/releaseFeatures.js";
import { RouteLoadingPage } from "./RouteLoadingPage.js";

/**
 * TEMPORAL: las rutas del frontend quedan abiertas para validar que todas las
 * pantallas rendericen correctamente en Hostinger. La API y las operaciones
 * privadas siguen protegidas por autenticación y autorización en el backend.
 *
 * Para volver a activar la protección visual del frontend, cambia este valor
 * a true y genera un nuevo build.
 */
export const FRONTEND_ROUTE_GUARDS_ENABLED = false;

export const ROLE_HOME: Record<UserRole, string> = {
  passenger: ROUTES.PASSENGER.HOME,
  driver: ROUTES.DRIVER.HOME,
  guide: getReleaseHome("guide"),
  rental_operator: getReleaseHome("rental_operator"),
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

  return getReleaseHome(role);
}

export function RouteGuard({ children, path }: RouteGuardProps): JSX.Element {
  const { status, user } = useAuth();

  if (!FRONTEND_ROUTE_GUARDS_ENABLED) {
    return <>{children}</>;
  }

  if (status === "loading") {
    return <RouteLoadingPage />;
  }

  if (status === "unauthenticated" || !user) {
    return <Redirect to={ROUTES.ROOT} />;
  }

  if (!isReleaseRoleEnabled(user.role)) {
    if (path === ROUTES.SUPPORT.CENTER) return <>{children}</>;
    return <Redirect to={ROUTES.SUPPORT.CENTER} />;
  }

  if (path.startsWith(ROUTES.PROFILE.BASE)) {
    return <>{children}</>;
  }

  if (path === ROUTES.SUPPORT.CENTER || path === "/notifications") {
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
