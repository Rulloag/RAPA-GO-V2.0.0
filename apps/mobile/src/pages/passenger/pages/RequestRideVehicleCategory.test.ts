import { describe, expect, it } from "vitest";
import {
  normalizeVehicleCategory,
  vehicleCategoryLabel,
  VEHICLE_CATEGORIES,
} from "@rapa-go/shared";

import requestRideSource from "./RequestRidePage.tsx?raw";
import adminFareSource from "../../admin/fare/index.tsx?raw";

describe("categorías de vehículo — contrato canónico Fase 1", () => {
  it("normaliza luggage legado a extra_luggage", () => {
    expect(normalizeVehicleCategory("luggage")).toBe("extra_luggage");
    expect(normalizeVehicleCategory("extra_luggage")).toBe("extra_luggage");
  });

  it("expone la etiqueta canónica Extra Maleta", () => {
    expect(vehicleCategoryLabel("extra_luggage")).toBe("Extra Maleta");
  });

  it("RequestRidePage usa categorías canónicas y no luggage interno", () => {
    expect(requestRideSource).toContain("VEHICLE_CATEGORIES");
    expect(requestRideSource).toContain("extra_luggage: 1.25");
    expect(requestRideSource).toContain(
      'useState<VehicleCategory>("standard")',
    );
    expect(requestRideSource).toContain(
      ").requestedVehicleCategory = vehicleCategory;",
    );
    expect(requestRideSource).not.toContain('"luggage"');
    expect(requestRideSource).not.toContain("Extra maletas");
  });

  it("RequestRidePage conserva compatibilidad al leer multiplicadores legacy", () => {
    expect(requestRideSource).toContain("stored?.extra_luggage ?? stored?.luggage");
  });

  it("admin tarifas usa extra_luggage como clave canónica", () => {
    expect(adminFareSource).toContain("extra_luggage: 1.25");
    expect(adminFareSource).toContain("VEHICLE_CATEGORIES");
    expect(adminFareSource).toContain('vehicleCategoryLabel("extra_luggage")');
    expect(adminFareSource).not.toMatch(/type VehicleKey = .*"luggage"/);
  });

  it("multiplicadores tarifarios incluyen categorías canónicas + Confort", () => {
    expect(VEHICLE_CATEGORIES).toEqual([
      "standard",
      "xl",
      "extra_luggage",
      "comfort",
    ]);

    const multiplierBlock = requestRideSource.match(
      /vehicleMultipliers:\s*\{[^}]+\}/,
    )?.[0];
    expect(multiplierBlock).toContain("standard: 1");
    expect(multiplierBlock).toContain("xl: 1.4");
    expect(multiplierBlock).toContain("extra_luggage: 1.25");
    expect(multiplierBlock).toContain("comfort:");
  });
});
