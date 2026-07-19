import type { UserRole } from "@rapa-go/shared";

/** Roles that can be self-selected during signup. Admin is never publicly creatable. */
export type PublicRole = Exclude<UserRole, "admin">;

export const ROLE_LABELS: Record<PublicRole, string> = {
  passenger:       "Pasajero",
  driver:          "Conductor",
  guide:           "Guía turístico",
  rental_operator: "Arriendo de vehículos",
};
