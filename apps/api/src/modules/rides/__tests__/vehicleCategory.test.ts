import { describe, expect, it } from "vitest";
import {
  needsVehicleCategoryConfirmation,
  normalizeVehicleCategory,
  resolveRequestedVehicleCategory,
  vehicleCategoriesMatch,
} from "@rapa-go/shared";

describe("vehicle categories — informan y advierten, no restringen", () => {
  it.each([
    ["standard", "standard", false],
    ["xl", "xl", false],
    ["extra_luggage", "luggage", false],
    ["standard", "xl", true],
    ["xl", "standard", true],
    ["extra_luggage", "standard", true],
    ["extra_luggage", "xl", true],
  ] as const)(
    "driver %s + request %s → confirm=%s",
    (driver, requested, confirm) => {
      expect(needsVehicleCategoryConfirmation(requested, driver)).toBe(confirm);
    },
  );

  it("normaliza aliases legacy", () => {
    expect(normalizeVehicleCategory("luggage")).toBe("extra_luggage");
    expect(normalizeVehicleCategory("EXTRA MALETA")).toBe("extra_luggage");
  });

  it("resuelve categoría desde notes", () => {
    expect(
      resolveRequestedVehicleCategory({
        notes: "Categoría de vehículo seleccionada: XL.",
      }),
    ).toBe("xl");
  });

  it("null no fuerza mismatch (sin restringir)", () => {
    expect(vehicleCategoriesMatch("xl", null)).toBe(true);
    expect(needsVehicleCategoryConfirmation("xl", null)).toBe(false);
  });
});
