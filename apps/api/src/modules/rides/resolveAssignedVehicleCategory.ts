import {
  capabilitiesFromLegacyCategory,
  resolveAssignedCategoryFromCapabilities,
  type VehicleCapabilities,
  type VehicleCategory,
} from "@rapa-go/shared";

/**
 * Snapshot assigned al accept.
 * Preferir capacidades; fallback legacy a vehicle_category del perfil.
 * Pure: no DB imports (safe for unit tests).
 */
export function resolveAssignedVehicleCategory(
  profileValue: string | null | undefined,
  capabilities?: VehicleCapabilities | null,
  requestedCategory?: string | null,
): VehicleCategory {
  if (capabilities) {
    return resolveAssignedCategoryFromCapabilities(
      capabilities,
      requestedCategory ?? "standard",
    );
  }
  const legacy = capabilitiesFromLegacyCategory(profileValue, null);
  return resolveAssignedCategoryFromCapabilities(
    legacy,
    requestedCategory ?? "standard",
  );
}
