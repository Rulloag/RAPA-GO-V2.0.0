import { describe, expect, it } from "vitest";
import {
  DEFAULT_COMFORT_FARE_MULTIPLIER,
  PLATFORM_COMMISSION_PERCENT,
  DRIVER_EARNINGS_PERCENT,
  splitPlatformCommission,
  vehicleCategoryLabel,
  VEHICLE_CATEGORIES,
  needsVehicleCategoryConfirmation,
  normalizeVehicleCategory,
} from "@rapa-go/shared";

import requestRideSource from "./RequestRidePage.tsx?raw";
import adminFareSource from "../../admin/fare/index.tsx?raw";
import driverSource from "../../driver/index.tsx?raw";

describe("Confort — mobile integración", () => {
  it("VEHICLE_CATEGORIES incluye comfort con label Confort", () => {
    expect(VEHICLE_CATEGORIES).toContain("comfort");
    expect(vehicleCategoryLabel("comfort")).toBe("Confort");
  });

  it("RequestRidePage expone comfort en el picker y multiplicador", () => {
    expect(requestRideSource).toContain("comfort:");
    expect(requestRideSource).toContain(
      "Vehículos más nuevos y mayor comodidad",
    );
    expect(requestRideSource).toContain("VEHICLE_CATEGORIES.map");
  });

  it("Admin fare incluye comfort en defaults y labels", () => {
    expect(adminFareSource).toContain("comfort:");
    expect(adminFareSource).toContain('vehicleCategoryLabel("comfort")');
  });

  it("cotización comfort > standard con multiplicador fixture", () => {
    const base = 8000;
    const standard = Math.round(base * 1);
    const comfort = Math.round(base * DEFAULT_COMFORT_FARE_MULTIPLIER);
    expect(comfort).toBeGreaterThan(standard);
  });

  it("comisión 23/77 no cambia con Confort", () => {
    const split = splitPlatformCommission(20_000);
    expect(PLATFORM_COMMISSION_PERCENT).toBe(23);
    expect(DRIVER_EARNINGS_PERCENT).toBe(77);
    expect(split.platformFeeClp).toBe(4600);
    expect(split.driverAmountClp).toBe(15400);
  });

  it("gate de mismatch sigue activa para comfort vs standard", () => {
    expect(needsVehicleCategoryConfirmation("comfort", "standard")).toBe(true);
    expect(driverSource).toContain("needsVehicleCategoryConfirmation");
    expect(driverSource).toContain("guardCategoryConfirmation");
  });

  it("alias confort → comfort", () => {
    expect(normalizeVehicleCategory("confort")).toBe("comfort");
  });

  it("categorías legacy siguen presentes", () => {
    expect(normalizeVehicleCategory("luggage")).toBe("extra_luggage");
    expect(VEHICLE_CATEGORIES).toContain("standard");
    expect(VEHICLE_CATEGORIES).toContain("xl");
    expect(VEHICLE_CATEGORIES).toContain("extra_luggage");
  });
});
