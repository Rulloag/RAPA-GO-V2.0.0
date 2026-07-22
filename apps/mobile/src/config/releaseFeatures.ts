import type { UserRole } from "@rapa-go/shared";
import { ROUTES } from "../navigation/routes.js";

function parseBoolean(value: unknown): boolean {
  return ["1", "true", "yes", "on"].includes(
    String(value ?? "").trim().toLowerCase(),
  );
}

/**
 * Las funciones futuras quedan cerradas por defecto.
 * En producción solo pueden activarse con el interruptor general y el flag
 * específico durante un build controlado.
 */
const isProductionBuild =
  import.meta.env.PROD || import.meta.env["VITE_ENV"] === "production";

const allowFutureFeaturesInProduction = parseBoolean(
  import.meta.env["VITE_ALLOW_FUTURE_FEATURES_IN_PRODUCTION"],
);

function isEnabled(value: unknown): boolean {
  if (!parseBoolean(value)) return false;
  if (!isProductionBuild) return true;
  return allowFutureFeaturesInProduction;
}

export const RELEASE_FEATURES = {
  tourism: isEnabled(import.meta.env["VITE_FEATURE_TOURISM"]),
  rentals: isEnabled(import.meta.env["VITE_FEATURE_RENTALS"]),
  events: isEnabled(import.meta.env["VITE_FEATURE_EVENTS"]),
} as const;

export function isReleaseRoleEnabled(role: UserRole): boolean {
  if (role === "guide") return RELEASE_FEATURES.tourism;
  if (role === "rental_operator") return RELEASE_FEATURES.rentals;
  return true;
}

export function getReleaseHome(role: UserRole): string {
  if (role === "passenger") return ROUTES.PASSENGER.HOME;
  if (role === "driver") return ROUTES.DRIVER.HOME;
  if (role === "admin") return ROUTES.ADMIN.HOME;
  if (role === "guide" && RELEASE_FEATURES.tourism) {
    return ROUTES.GUIDE.HOME;
  }
  if (role === "rental_operator" && RELEASE_FEATURES.rentals) {
    return ROUTES.RENTAL.HOME;
  }
  return ROUTES.SUPPORT.CENTER;
}

export const DISABLED_PASSENGER_PATHS = [
  ...(!RELEASE_FEATURES.tourism
    ? [ROUTES.PASSENGER.GUIDES, ROUTES.PASSENGER.GUIDE_DETAIL_PATTERN]
    : []),
  ...(!RELEASE_FEATURES.rentals
    ? [ROUTES.PASSENGER.RENTALS, ROUTES.PASSENGER.RENTAL_DETAIL_PATTERN]
    : []),
  ...(!RELEASE_FEATURES.events
    ? [ROUTES.PASSENGER.EVENTS, ROUTES.PASSENGER.EVENT_TICKETS]
    : []),
  ROUTES.PASSENGER.SERVICE_BOOKINGS,
  "/passenger/rental-bookings",
] as const;

export const DISABLED_ADMIN_PATHS = [
  ...(!RELEASE_FEATURES.tourism ? [ROUTES.ADMIN.GUIDES] : []),
  ...(!RELEASE_FEATURES.rentals ? [ROUTES.ADMIN.RENTALS] : []),
  ...(!RELEASE_FEATURES.events ? [ROUTES.ADMIN.EVENT_TICKETS] : []),
] as const;
