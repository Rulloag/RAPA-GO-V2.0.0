import { describe, expect, it } from "vitest";

import { computeAutoSheetShift } from "./RequestRidePage";

describe("computeAutoSheetShift", () => {
  it("mueve la hoja hacia abajo cuando el punto está oculto detrás del panel", () => {
    const nextShift = computeAutoSheetShift({
      currentShift: 120,
      sheetMaxShift: 500,
      markerY: 340,
      sheetTop: 120,
      safetyMargin: 22,
    });

    expect(nextShift).toBeGreaterThan(120);
    expect(nextShift).toBeLessThanOrEqual(500);
  });

  it("mantiene la hoja estable cuando el punto ya es visible", () => {
    const nextShift = computeAutoSheetShift({
      currentShift: 120,
      sheetMaxShift: 500,
      markerY: 100,
      sheetTop: 120,
      safetyMargin: 22,
    });

    expect(nextShift).toBe(120);
  });
});
