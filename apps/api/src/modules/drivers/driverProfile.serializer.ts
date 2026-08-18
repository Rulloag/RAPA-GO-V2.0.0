import type { DriverProfile } from "../../db/schema/index.js";

export function serializeDriverProfile(profile: DriverProfile | null) {
  if (!profile) return null;
  return {
    id:              profile.id,
    userId:          profile.userId,
    phone:           profile.phone           ?? null,
    vehicleBrand:    profile.vehicleBrand    ?? null,
    vehicleModel:    profile.vehicleModel    ?? null,
    vehicleYear:     profile.vehicleYear     ?? null,
    vehiclePlate:    profile.vehiclePlate    ?? null,
    vehicleColor:    profile.vehicleColor    ?? null,
    vehicleCategory: profile.vehicleCategory ?? "standard",
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
