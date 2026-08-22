import {
  applyVehicleCategoryFareMultiplier,
  normalizeVehicleCategory,
  resolveVehicleCategoryFareMultiplier,
  type VehicleCategoryInput,
} from "@rapa-go/shared";

import { getComfortFareMultiplier } from "../drivers/comfortEligibility.service.js";
import { roundFareUpTo500 } from "../rides/ridePolicy.js";

export async function getVehicleCategoryFareMultiplier(
  category: VehicleCategoryInput,
): Promise<number> {
  const normalized = normalizeVehicleCategory(category) ?? "standard";
  if (normalized === "comfort") {
    return getComfortFareMultiplier();
  }
  return resolveVehicleCategoryFareMultiplier(category);
}

export async function computeAuthoritativeCategoryFareClp(
  baseFareClp: number,
  category: VehicleCategoryInput,
): Promise<number> {
  const normalized = normalizeVehicleCategory(category) ?? "standard";
  const options =
    normalized === "comfort"
      ? { comfortMultiplier: await getComfortFareMultiplier() }
      : {};
  const raw = applyVehicleCategoryFareMultiplier(baseFareClp, category, options);
  return roundFareUpTo500(raw);
}
