import type { ReactNode } from "react";

interface RouteGuardProps {
  children: ReactNode;
}

/**
 * RouteGuard — placeholder for future auth/role protection.
 *
 * Currently transparent: renders children unconditionally.
 *
 * When auth is implemented, this component will:
 *  1. Read the session token from Supabase Auth (never from localStorage).
 *  2. Verify the token is valid via the backend.
 *  3. Redirect to /auth/login if unauthenticated.
 *  4. Redirect to /403 if the user lacks the required role.
 *
 * No auth logic is implemented here yet — that belongs to a future phase
 * once the backend auth module is ready.
 */
export function RouteGuard({ children }: RouteGuardProps): JSX.Element {
  // TODO(phase-auth): replace with real session verification
  return <>{children}</>;
}
