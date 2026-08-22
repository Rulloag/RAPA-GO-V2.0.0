import {
  DEFAULT_COMFORT_FARE_MULTIPLIER,
  normalizeVehicleCategory,
  type VehicleCategoryInput,
} from "./vehicleCategory.js";

export const DEFAULT_XL_FARE_MULTIPLIER = 1.4;
export const DEFAULT_EXTRA_LUGGAGE_FARE_MULTIPLIER = 1.25;

/**
 * Pure multiplier lookup for vehicle category fares.
 * Comfort multiplier should be supplied from fare_settings when available.
 */
export function resolveVehicleCategoryFareMultiplier(
  category: VehicleCategoryInput,
  options: { comfortMultiplier?: number } = {},
): number {
  const normalized = normalizeVehicleCategory(category) ?? "standard";
  switch (normalized) {
    case "xl":
      return DEFAULT_XL_FARE_MULTIPLIER;
    case "extra_luggage":
      return DEFAULT_EXTRA_LUGGAGE_FARE_MULTIPLIER;
    case "comfort":
      return options.comfortMultiplier ?? DEFAULT_COMFORT_FARE_MULTIPLIER;
    default:
      return 1;
  }
}

export function applyVehicleCategoryFareMultiplier(
  baseFareClp: number,
  category: VehicleCategoryInput,
  options: { comfortMultiplier?: number } = {},
): number {
  const multiplier = resolveVehicleCategoryFareMultiplier(category, options);
  return Math.round(baseFareClp * multiplier);
}
