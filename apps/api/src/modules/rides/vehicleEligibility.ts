import {
  capabilitiesFromLegacyCategory,
  isVehicleEligibleForRequestedCategory,
  normalizeVehicleCategory,
  primaryCategoryFromCapabilities,
  resolveAssignedCategoryFromCapabilities,
  vehicleEligibilityFailureMessage,
  VEHICLE_NOT_ELIGIBLE_CODE,
  DEFAULT_COMFORT_MIN_VEHICLE_YEAR,
  type VehicleCapabilities,
  type VehicleCategory,
} from "@rapa-go/shared";

import { AppError } from "../../shared/errors/AppError.js";
import type { DriverProfile } from "../../db/schema/index.js";

export function capabilitiesFromDriverProfile(
  profile: Pick<
    DriverProfile,
    | "vehicleCategory"
    | "vehicleYear"
    | "capabilityXl"
    | "capabilityExtraLuggage"
    | "capabilityComfort"
  > | null | undefined,
): VehicleCapabilities {
  if (!profile) {
    return capabilitiesFromLegacyCategory("standard", null);
  }

  const hasCapabilityColumns =
    typeof profile.capabilityXl === "boolean" ||
    typeof profile.capabilityExtraLuggage === "boolean" ||
    typeof profile.capabilityComfort === "boolean";

  if (hasCapabilityColumns) {
    return {
      xl: profile.capabilityXl === true,
      extraLuggage: profile.capabilityExtraLuggage === true,
      comfort: profile.capabilityComfort === true,
      vehicleYear:
        profile.vehicleYear != null && Number.isFinite(Number(profile.vehicleYear))
          ? Number(profile.vehicleYear)
          : null,
    };
  }

  return capabilitiesFromLegacyCategory(
    profile.vehicleCategory,
    profile.vehicleYear != null && Number.isFinite(Number(profile.vehicleYear))
      ? Number(profile.vehicleYear)
      : null,
  );
}

export async function assertVehicleEligibleForRide(input: {
  profile: DriverProfile | null | undefined;
  requestedVehicleCategory: string | null | undefined;
}): Promise<{
  capabilities: VehicleCapabilities;
  assignedVehicleCategory: VehicleCategory;
  comfortMinVehicleYear: number;
}> {
  const capabilities = capabilitiesFromDriverProfile(input.profile);

  let comfortMinVehicleYear = DEFAULT_COMFORT_MIN_VEHICLE_YEAR;
  try {
    const { getComfortMinVehicleYear } = await import(
      "../drivers/comfortEligibility.service.js"
    );
    comfortMinVehicleYear = await getComfortMinVehicleYear();
  } catch {
    comfortMinVehicleYear = DEFAULT_COMFORT_MIN_VEHICLE_YEAR;
  }

  const requested = input.requestedVehicleCategory ?? "standard";
  const normalized =
    normalizeVehicleCategory(requested) ?? ("standard" as VehicleCategory);

  if (
    !isVehicleEligibleForRequestedCategory(capabilities, requested, {
      comfortMinVehicleYear,
    })
  ) {
    throw new AppError({
      code: VEHICLE_NOT_ELIGIBLE_CODE,
      message: vehicleEligibilityFailureMessage(normalized),
      statusCode: 409,
    });
  }

  return {
    capabilities,
    assignedVehicleCategory: resolveAssignedCategoryFromCapabilities(
      capabilities,
      requested,
    ),
    comfortMinVehicleYear,
  };
}

export function syncLegacyVehicleCategory(
  capabilities: VehicleCapabilities,
): VehicleCategory {
  return primaryCategoryFromCapabilities(capabilities);
}
