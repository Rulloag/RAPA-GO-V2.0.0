import {
  DEFAULT_COMFORT_FARE_MULTIPLIER,
  DEFAULT_COMFORT_MIN_VEHICLE_YEAR,
  isComfortVehicleYearEligible,
  type VehicleCategory,
} from "@rapa-go/shared";

import { FareSettingsRepository } from "../fareSettings/fareSettings.repository.js";

const fareSettingsRepo = new FareSettingsRepository();

/**
 * Lee el año mínimo Confort desde fare_settings activos.
 * Si no hay fila, usa DEFAULT_COMFORT_MIN_VEHICLE_YEAR.
 */
export async function getComfortMinVehicleYear(): Promise<number> {
  try {
    const row = await fareSettingsRepo.findByType("comfort_min_vehicle_year");
    const value = row?.value;
    if (value != null && Number.isFinite(Number(value)) && Number(value) > 1900) {
      return Math.round(Number(value));
    }
  } catch {
    // Fallback silencioso al default técnico.
  }
  return DEFAULT_COMFORT_MIN_VEHICLE_YEAR;
}

/**
 * Multiplicador Confort desde fare_settings (basis points / 10000).
 * Fallback: DEFAULT_COMFORT_FARE_MULTIPLIER.
 */
export async function getComfortFareMultiplier(): Promise<number> {
  try {
    const row = await fareSettingsRepo.findByType(
      "comfort_fare_multiplier_bps",
    );
    const value = row?.value;
    if (value != null && Number.isFinite(Number(value)) && Number(value) > 0) {
      return Number(value) / 10000;
    }
  } catch {
    // Fallback silencioso.
  }
  return DEFAULT_COMFORT_FARE_MULTIPLIER;
}

export type ComfortEligibilityResult =
  | { ok: true }
  | { ok: false; code: string; message: string };

/**
 * Solo administración puede habilitar Confort.
 * Requiere año de vehículo >= mínimo configurado.
 */
export async function evaluateComfortCategoryApproval(input: {
  targetCategory: VehicleCategory;
  vehicleYear: number | null | undefined;
}): Promise<ComfortEligibilityResult> {
  if (input.targetCategory !== "comfort") {
    return { ok: true };
  }

  const minYear = await getComfortMinVehicleYear();
  if (!isComfortVehicleYearEligible(input.vehicleYear, minYear)) {
    return {
      ok: false,
      code: "COMFORT_VEHICLE_YEAR_INELIGIBLE",
      message:
        `Para aprobar Confort el vehículo debe ser del año ${minYear} o posterior. ` +
        `Año registrado: ${input.vehicleYear ?? "no informado"}.`,
    };
  }

  return { ok: true };
}
