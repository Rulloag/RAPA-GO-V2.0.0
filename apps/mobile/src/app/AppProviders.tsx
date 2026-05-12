import type { ReactNode } from "react";
import { AuthProvider } from "../features/auth";

interface AppProvidersProps {
  children: ReactNode;
}

/**
 * AppProviders — wraps the app with global context providers.
 *
 * Providers active:
 *  - AuthProvider (Phase 6): session state in memory only.
 *
 * Providers to be added:
 *  - ThemeProvider (phase: settings)
 *
 * Rule: no business logic or data fetching in this component.
 */
export function AppProviders({ children }: AppProvidersProps): JSX.Element {
  return <AuthProvider>{children}</AuthProvider>;
}
