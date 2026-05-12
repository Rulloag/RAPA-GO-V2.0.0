import type { ReactNode } from "react";
import { useAuth } from "../features/auth";

interface RouteGuardProps {
  children: ReactNode;
}

/**
 * RouteGuard — reads auth state from AuthProvider but does NOT block routes yet.
 *
 * Current state: transparent — renders children unconditionally.
 *
 * TODO(phase-auth-guard): when real auth is live, uncomment the block below
 * to enforce protected routes:
 *
 *   if (status === "loading") return <IonSpinner />;
 *   if (status === "unauthenticated") return <Redirect to={ROUTES.AUTH.LOGIN} />;
 *   if (requiredRole && user?.role !== requiredRole) return <Redirect to={ROUTES.NOT_FOUND} />;
 *
 * Constraints:
 *  - Token verification must always be confirmed by the backend.
 *  - Never trust role from client-side state alone for data access.
 *  - The frontend only hides UI; authorization is enforced server-side.
 */
export function RouteGuard({ children }: RouteGuardProps): JSX.Element {
  // Auth state is available but not used for blocking yet
  const { status } = useAuth();
  void status;

  return <>{children}</>;
}
