import type { ReactNode } from "react";
import { IonSpinner } from "@ionic/react";
import { Redirect } from "react-router-dom";
import { useAuth } from "../features/auth";
import { ROUTES } from "./routes";
import type { UserRole } from "@rapa-go/shared";

/** Maps each role to its home route after login. */
export const ROLE_HOME: Record<UserRole, string> = {
  passenger:       ROUTES.PASSENGER.HOME,
  driver:          ROUTES.DRIVER.HOME,
  guide:           ROUTES.GUIDE.HOME,
  rental_operator: ROUTES.RENTAL.HOME,
  admin:           ROUTES.ADMIN.HOME,
};

/** Route prefixes each role is allowed to access (beyond /profile). */
const ROLE_ALLOWED_BASE: Record<UserRole, string> = {
  passenger:       ROUTES.PASSENGER.BASE,
  driver:          ROUTES.DRIVER.BASE,
  guide:           ROUTES.GUIDE.BASE,
  rental_operator: ROUTES.RENTAL.BASE,
  admin:           ROUTES.ADMIN.BASE,
};

/** All private base prefixes — used to detect role mismatch. */
const PRIVATE_BASES = [
  ROUTES.PASSENGER.BASE,
  ROUTES.DRIVER.BASE,
  ROUTES.GUIDE.BASE,
  ROUTES.RENTAL.BASE,
  ROUTES.ADMIN.BASE,
];

interface RouteGuardProps {
  children: ReactNode;
  /** Current path being rendered — used to detect role mismatch. */
  path: string;
}

/**
 * RouteGuard — enforces authentication and role-based access.
 *
 * Rules:
 *  - unauthenticated → /auth/login
 *  - loading → spinner (avoids flash-of-redirect during initial mount)
 *  - wrong role for a private section → redirect to own role's home
 *  - /profile/* → allowed for all authenticated roles
 *
 * Security note: this guard only hides UI. All data access authorization
 * is enforced server-side. Never trust client-side role for data security.
 */
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

  // /profile/* is accessible to any authenticated user
  if (path.startsWith(ROUTES.PROFILE.BASE)) {
    return <>{children}</>;
  }

  // For role sections: check if user's role matches the requested base
  const allowedBase = ROLE_ALLOWED_BASE[user.role];
  const isPrivateBase = PRIVATE_BASES.some((base) => path.startsWith(base));

  if (isPrivateBase && !path.startsWith(allowedBase)) {
    return <Redirect to={ROLE_HOME[user.role]} />;
  }

  return <>{children}</>;
}
