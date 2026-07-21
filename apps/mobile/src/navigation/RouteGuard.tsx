import type { ReactNode } from "react";
import { ROUTES } from "./routes";
import type { UserRole } from "@rapa-go/shared";

/**
 * Los bloqueos visuales del frontend están desactivados temporalmente.
 *
 * Esto permite abrir y comprobar todas las pantallas sin que una sesión, un
 * rol o una restauración de Secure Storage deje la aplicación en negro.
 * La seguridad real debe permanecer en los endpoints del backend.
 */
export const FRONTEND_ROUTE_GUARDS_ENABLED = false;

export const ROLE_HOME: Record<UserRole, string> = {
  passenger: ROUTES.PASSENGER.HOME,
  driver: ROUTES.DRIVER.HOME,
  guide: ROUTES.GUIDE.HOME,
  rental_operator: ROUTES.RENTAL.HOME,
  admin: ROUTES.ADMIN.HOME,
};

interface RouteGuardProps {
  children: ReactNode;
  path?: string;
}

export function RouteGuard({ children }: RouteGuardProps): JSX.Element {
  return <>{children}</>;
}
