import { describe, expect, it } from "vitest";
import applySource from "../../../pages/apply/index.tsx?raw";

describe("driver/guide application RUT", () => {
  it("uses the canonical shared RUT helpers and does not strip K with onlyNumbers", () => {
    expect(applySource).toContain("formatRut");
    expect(applySource).toContain("normalizeRut");
    expect(applySource).toContain("validateRut");
    expect(applySource).not.toContain("function cleanRut");
    expect(applySource).toContain("No se corrige automáticamente");
  });
});
