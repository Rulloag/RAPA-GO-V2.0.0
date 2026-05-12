/**
 * Centralized route definitions for RAPA GO mobile app.
 *
 * All route paths are defined here. No path string should be hardcoded
 * anywhere else — always import from this file.
 *
 * Authenticated and role-based routes will be added here as modules
 * are implemented in subsequent phases.
 */

export const ROUTES = {
  /** Root — redirects to WELCOME */
  ROOT: "/",

  /** Welcome / landing screen */
  WELCOME: "/welcome",

  /** Catch-all — 404 not found */
  NOT_FOUND: "/404",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
