import { normalizeVehicleCategory, type VehicleCategory } from "@rapa-go/shared";

export function resolveAssignedVehicleCategory(
  profileValue: string | null | undefined,
): VehicleCategory {
  const normalized = normalizeVehicleCategory(profileValue);
  return normalized ?? "standard";
}
