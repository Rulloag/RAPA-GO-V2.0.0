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
