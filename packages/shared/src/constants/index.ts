/**
 * Platform-wide constants.
 * No business logic here — only static values.
 */

export const APP_NAME = "RAPA GO" as const;
export const APP_VERSION = "2.0.0" as const;

export const CURRENCY = "CLP" as const;

/** Roles available in the platform. Must match the database enum. */
export const USER_ROLES = [
  "passenger",
  "driver",
  "guide",
  "rental_operator",
  "admin",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

/**
 * Ride request statuses.
 * Ordered to reflect the happy-path lifecycle.
 * driver_en_route and driver_arrived are reserved for Phase 66.
 */
export const RIDE_STATUSES = [
  "requested",
  "accepted",
  "driver_en_route",
  "driver_arrived",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export type RideStatus = (typeof RIDE_STATUSES)[number];

/** Active statuses — ride has not ended. */
export const RIDE_ACTIVE_STATUSES: readonly RideStatus[] = [
  "requested",
  "accepted",
  "driver_en_route",
  "driver_arrived",
  "in_progress",
] as const;

/** Terminal statuses — ride has ended. */
export const RIDE_TERMINAL_STATUSES: readonly RideStatus[] = [
  "completed",
  "cancelled",
] as const;

/**
 * Allowed status transitions.
 * Key = current status, value = statuses it may transition to.
 * Actor enforcement is done server-side — this is for reference and UI guards only.
 */
export const RIDE_TRANSITIONS: Record<RideStatus, readonly RideStatus[]> = {
  requested:        ["accepted", "cancelled"],
  accepted:         ["driver_en_route", "in_progress", "cancelled"],
  driver_en_route:  ["driver_arrived", "cancelled"],
  driver_arrived:   ["in_progress", "cancelled"],
  in_progress:      ["completed"],
  completed:        [],
  cancelled:        [],
};

/** Human-readable Spanish labels for each ride status. */
export const RIDE_STATUS_LABEL: Record<RideStatus, string> = {
  requested:       "Solicitado",
  accepted:        "Conductor asignado",
  driver_en_route: "Conductor en camino",
  driver_arrived:  "Conductor llegó",
  in_progress:     "En curso",
  completed:       "Completado",
  cancelled:       "Cancelado",
};

/** Ionic color for each status badge. */
export const RIDE_STATUS_COLOR: Record<RideStatus, string> = {
  requested:       "warning",
  accepted:        "primary",
  driver_en_route: "tertiary",
  driver_arrived:  "secondary",
  in_progress:     "success",
  completed:       "medium",
  cancelled:       "danger",
};
