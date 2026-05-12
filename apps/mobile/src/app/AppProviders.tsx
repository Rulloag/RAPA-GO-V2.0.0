import type { ReactNode } from "react";

interface AppProvidersProps {
  children: ReactNode;
}

/**
 * AppProviders — wraps the app with global context providers.
 *
 * Current state: pass-through wrapper.
 *
 * Providers to be added here as each module is implemented:
 *  - AuthProvider (phase: auth)
 *  - ThemeProvider (phase: settings)
 *
 * Rule: no business logic or data fetching in this component.
 */
export function AppProviders({ children }: AppProvidersProps): JSX.Element {
  return <>{children}</>;
}
