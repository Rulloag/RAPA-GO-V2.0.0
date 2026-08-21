import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  DEFAULT_COMFORT_FARE_MULTIPLIER,
  DEFAULT_COMFORT_MIN_VEHICLE_YEAR,
  DRIVER_EARNINGS_PERCENT,
  PLATFORM_COMMISSION_PERCENT,
  isComfortVehicleYearEligible,
  needsVehicleCategoryConfirmation,
  normalizeVehicleCategory,
  resolveRequestedVehicleCategory,
  splitPlatformCommission,
  vehicleCategoryLabel,
  vehicleCategoryMismatchCopy,
  VEHICLE_CATEGORIES,
} from "@rapa-go/shared";

import { resolveAssignedVehicleCategory } from "../resolveAssignedVehicleCategory.js";
import { createRideRequestSchema } from "../rides.schemas.js";
import {
  evaluateComfortCategoryApproval,
  getComfortFareMultiplier,
  getComfortMinVehicleYear,
} from "../../drivers/comfortEligibility.service.js";

vi.mock("../../fareSettings/fareSettings.repository.js", () => ({
  FareSettingsRepository: class {
    async findByType(type: string) {
      if (type === "comfort_min_vehicle_year") {
        return { value: DEFAULT_COMFORT_MIN_VEHICLE_YEAR };
      }
      if (type === "comfort_fare_multiplier_bps") {
        return { value: Math.round(DEFAULT_COMFORT_FARE_MULTIPLIER * 10000) };
      }
      return null;
    }
  },
}));

describe("Confort — categoría canónica y normalización", () => {
  it("incluye comfort en VEHICLE_CATEGORIES", () => {
    expect(VEHICLE_CATEGORIES).toContain("comfort");
  });

  it("normaliza comfort y alias español confort", () => {
    expect(normalizeVehicleCategory("comfort")).toBe("comfort");
    expect(normalizeVehicleCategory("Confort")).toBe("comfort");
    expect(normalizeVehicleCategory("confort")).toBe("comfort");
  });

  it("etiqueta visible es Confort", () => {
    expect(vehicleCategoryLabel("comfort")).toBe("Confort");
  });

  it("pasajero puede solicitar comfort vía schema createRide", () => {
    const parsed = createRideRequestSchema.parse({
      originText: "Hanga Roa centro",
      destinationText: "Anakena playa",
      requestedVehicleCategory: "comfort",
      estimatedFareClp: 8000,
    });
    expect(parsed.requestedVehicleCategory).toBe("comfort");
  });

  it("alias confort en createRide se normaliza a comfort", () => {
    const parsed = createRideRequestSchema.parse({
      originText: "Hanga Roa centro",
      destinationText: "Anakena playa",
      requestedVehicleCategory: "confort",
    });
    expect(parsed.requestedVehicleCategory).toBe("comfort");
  });

  it("resolveRequestedVehicleCategory preserva comfort", () => {
    expect(
      resolveRequestedVehicleCategory({
        requestedVehicleCategory: "comfort",
      }),
    ).toBe("comfort");
  });
});

describe("Confort — assigned truthful (no falsificación)", () => {
  it("perfil comfort → assigned comfort", () => {
    expect(resolveAssignedVehicleCategory("comfort")).toBe("comfort");
  });

  it("perfil standard con viaje comfort solicitado → assigned standard (no se inventa comfort)", () => {
    expect(resolveAssignedVehicleCategory("standard")).toBe("standard");
    expect(resolveAssignedVehicleCategory("standard")).not.toBe("comfort");
  });

  it("perfil null → assigned standard, nunca comfort", () => {
    expect(resolveAssignedVehicleCategory(null)).toBe("standard");
  });
});

describe("Confort — mismatch gate (política informativa conservada)", () => {
  it("comfort vs standard requiere confirmación", () => {
    expect(needsVehicleCategoryConfirmation("comfort", "standard")).toBe(true);
  });

  it("comfort vs comfort no requiere confirmación", () => {
    expect(needsVehicleCategoryConfirmation("comfort", "comfort")).toBe(false);
  });

  it("copy de mismatch Confort existe", () => {
    const copy = vehicleCategoryMismatchCopy("comfort");
    expect(copy.title).toContain("Confort");
    expect(copy.body).toMatch(/Confort|comodidad/i);
  });
});

describe("Confort — elegibilidad por año (admin)", () => {
  it("año >= mínimo → elegible", () => {
    expect(
      isComfortVehicleYearEligible(2020, DEFAULT_COMFORT_MIN_VEHICLE_YEAR),
    ).toBe(true);
    expect(
      isComfortVehicleYearEligible(2024, DEFAULT_COMFORT_MIN_VEHICLE_YEAR),
    ).toBe(true);
  });

  it("año < mínimo → no elegible", () => {
    expect(
      isComfortVehicleYearEligible(2018, DEFAULT_COMFORT_MIN_VEHICLE_YEAR),
    ).toBe(false);
  });

  it("año null → no elegible", () => {
    expect(isComfortVehicleYearEligible(null)).toBe(false);
  });

  it("evaluateComfortCategoryApproval rechaza año viejo para comfort", async () => {
    const result = await evaluateComfortCategoryApproval({
      targetCategory: "comfort",
      vehicleYear: 2015,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("COMFORT_VEHICLE_YEAR_INELIGIBLE");
    }
  });

  it("evaluateComfortCategoryApproval acepta año válido para comfort", async () => {
    const result = await evaluateComfortCategoryApproval({
      targetCategory: "comfort",
      vehicleYear: 2022,
    });
    expect(result).toEqual({ ok: true });
  });

  it("evaluateComfortCategoryApproval no restringe standard/xl", async () => {
    expect(
      await evaluateComfortCategoryApproval({
        targetCategory: "standard",
        vehicleYear: 2010,
      }),
    ).toEqual({ ok: true });
  });

  it("getComfortMinVehicleYear y multiplicador son configurables vía fare_settings", async () => {
    expect(await getComfortMinVehicleYear()).toBe(
      DEFAULT_COMFORT_MIN_VEHICLE_YEAR,
    );
    expect(await getComfortFareMultiplier()).toBe(
      DEFAULT_COMFORT_FARE_MULTIPLIER,
    );
  });
});

describe("Confort — comisión fija 23%/77%", () => {
  it("constantes canónicas", () => {
    expect(PLATFORM_COMMISSION_PERCENT).toBe(23);
    expect(DRIVER_EARNINGS_PERCENT).toBe(77);
  });

  it("fare 20000 → platform 4600, driver 15400", () => {
    const split = splitPlatformCommission(20_000);
    expect(split.platformFeeClp).toBe(4_600);
    expect(split.driverAmountClp).toBe(15_400);
    expect(split.platformFeeClp + split.driverAmountClp).toBe(20_000);
  });

  it("misma comisión independientemente de categoría", () => {
    const a = splitPlatformCommission(10_000);
    const b = splitPlatformCommission(10_000);
    expect(a.platformPercent).toBe(23);
    expect(b.driverPercent).toBe(77);
    expect(a).toEqual(b);
  });
});

describe("Confort — cotización multiplicador (fixture)", () => {
  it("aplica multiplicador configurado sobre base", () => {
    const base = 10_000;
    const multiplier = DEFAULT_COMFORT_FARE_MULTIPLIER;
    const comfortFare = Math.round(base * multiplier);
    expect(comfortFare).toBe(13_500);
    expect(comfortFare).toBeGreaterThan(base);
  });
});

describe("Categorías existentes siguen normalizando", () => {
  it("standard / xl / extra_luggage / luggage legado", () => {
    expect(normalizeVehicleCategory("standard")).toBe("standard");
    expect(normalizeVehicleCategory("xl")).toBe("xl");
    expect(normalizeVehicleCategory("extra_luggage")).toBe("extra_luggage");
    expect(normalizeVehicleCategory("luggage")).toBe("extra_luggage");
  });
});
