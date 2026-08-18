import { describe, expect, it } from "vitest";

import applicationsSource from "./index.tsx?raw";

describe("Fase 4 — categoría declarada en revisión admin", () => {
  it("muestra la categoría declarada en el detalle de postulación", () => {
    expect(applicationsSource).toContain("Categoría declarada:");
    expect(applicationsSource).toContain(
      "getApplicationDeclaredVehicleCategoryDisplay(",
    );
  });

  it("resuelve categoría desde application y vehicles", () => {
    expect(applicationsSource).toContain(
      "driverApprovedVehicleCategory",
    );
  });
});
