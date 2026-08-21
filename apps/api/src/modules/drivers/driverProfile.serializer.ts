import type { DriverProfile } from "../../db/schema/index.js";
import {
  capabilitiesFromLegacyCategory,
  primaryCategoryFromCapabilities,
} from "@rapa-go/shared";

export function serializeDriverProfile(profile: DriverProfile | null) {
  if (!profile) return null;

  const year =
    profile.vehicleYear != null && Number.isFinite(Number(profile.vehicleYear))
      ? Number(profile.vehicleYear)
      : null;

  const hasCapabilityColumns =
    typeof profile.capabilityXl === "boolean" ||
    typeof profile.capabilityExtraLuggage === "boolean" ||
    typeof profile.capabilityComfort === "boolean";

  const resolved = hasCapabilityColumns
    ? {
        xl: profile.capabilityXl === true,
        extraLuggage: profile.capabilityExtraLuggage === true,
        comfort: profile.capabilityComfort === true,
        vehicleYear: year,
      }
    : capabilitiesFromLegacyCategory(profile.vehicleCategory, year);

  return {
    id:              profile.id,
    userId:          profile.userId,
    phone:           profile.phone           ?? null,
    vehicleBrand:    profile.vehicleBrand    ?? null,
    vehicleModel:    profile.vehicleModel    ?? null,
    vehicleYear:     profile.vehicleYear     ?? null,
    vehiclePlate:    profile.vehiclePlate    ?? null,
    vehicleColor:    profile.vehicleColor    ?? null,
    vehicleCategory:
      profile.vehicleCategory ??
      primaryCategoryFromCapabilities(resolved),
    capabilities: {
      xl: resolved.xl,
      extraLuggage: resolved.extraLuggage,
      comfort: resolved.comfort,
    },
    capabilityXl: resolved.xl,
    capabilityExtraLuggage: resolved.extraLuggage,
    capabilityComfort: resolved.comfort,
    licenseNumber:   profile.licenseNumber   ?? null,
    licenseExpiry:   profile.licenseExpiry   ?? null,
    profilePhotoUrl: profile.profilePhotoUrl ?? null,
    vehiclePhotoUrl: profile.vehiclePhotoUrl ?? null,
    bio:             profile.bio             ?? null,
    languages:       profile.languages       ?? [],
    createdAt:       profile.createdAt.toISOString(),
    updatedAt:       profile.updatedAt.toISOString(),
  };
}
