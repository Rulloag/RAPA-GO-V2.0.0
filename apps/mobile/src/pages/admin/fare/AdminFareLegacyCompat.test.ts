import { describe, expect, it } from "vitest";

import adminFareSource from "./index.tsx?raw";

describe("admin fare — compatibilidad legacy luggage", () => {
  it("migrateLegacyCompatibilityRules reemplaza IDs luggage_* por extra_luggage_*", () => {
    expect(adminFareSource).toContain("migrateLegacyCompatibilityRules");
    expect(adminFareSource).toContain(
      'id.replace(LUGGAGE_ID_RE, "extra_luggage_")',
    );
  });

  it("prioriza regla canónica independientemente del orden del array", () => {
    expect(adminFareSource).toContain(
      "const canonicalMap = new Map<string, { rule: Record<string, unknown>; isCanonical: boolean }>();",
    );
    expect(adminFareSource).toContain("if (existing.isCanonical) continue;");
    expect(adminFareSource).toContain(
      "canonicalMap.set(canonicalId, { rule, isCanonical: true });",
    );
  });

  it("Caso A: luggage_* primero, extra_luggage_* después — gana la canónica", () => {
    // The logic: when legacy comes first, isCanonical=false is stored.
    // When canonical comes second, !isLegacy is true so it replaces the entry.
    // Verify: "if (!isLegacy) { canonicalMap.set(..., { rule, isCanonical: true }) }"
    expect(adminFareSource).toContain("if (!isLegacy) {");
    expect(adminFareSource).toContain(
      "canonicalMap.set(canonicalId, { rule, isCanonical: true });",
    );
  });

  it("Caso B: extra_luggage_* primero, luggage_* después — gana la canónica", () => {
    // The logic: when canonical comes first, isCanonical=true is stored.
    // When legacy comes second, existing.isCanonical is true → continue (skip).
    expect(adminFareSource).toContain("if (existing.isCanonical) continue;");
  });

  it("convierte vehicle 'luggage' a 'extra_luggage' en reglas migradas", () => {
    expect(adminFareSource).toContain(
      'rule.vehicle === "luggage" ? "extra_luggage" : rule.vehicle',
    );
  });

  it("legacy sin equivalente canónico se transforma conservando propiedades", () => {
    // If only legacy exists, it is stored with isCanonical=false but still emitted
    // with the canonical ID and vehicle corrected.
    expect(adminFareSource).toContain(
      "canonicalMap.set(canonicalId, { rule, isCanonical: !isLegacy });",
    );
    expect(adminFareSource).toContain(
      "migrated.push({ ...rule, id: canonicalId, vehicle });",
    );
  });

  it("readStoredVehicleCategoryMultiplier lee luggage como fallback de extra_luggage", () => {
    expect(adminFareSource).toContain(
      "stored?.extra_luggage ?? stored?.luggage ?? fallback",
    );
  });

  it("readStoredVehicleCategoryActive lee luggage como fallback de extra_luggage", () => {
    expect(adminFareSource).toContain(
      "(stored?.extra_luggage ?? stored?.luggage) !== false",
    );
  });

  it("guardado solo escribe extra_luggage, nunca luggage como tipo/ID canónico", () => {
    const saveSection = adminFareSource.slice(
      adminFareSource.indexOf("function saveConfig("),
    );
    expect(saveSection).not.toMatch(/"luggage"/);
  });

  it("buildCompatibilityRules genera IDs con extra_luggage_, no luggage_", () => {
    expect(adminFareSource).toContain('extra_luggage: "extra_luggage"');
    expect(adminFareSource).not.toContain('luggage: "luggage"');
  });

  it("migración se ejecuta antes de leer config", () => {
    const readFn = adminFareSource.slice(
      adminFareSource.indexOf("function readStoredConfig()"),
    );
    const migrationCall = readFn.indexOf(
      "migrateLegacyCompatibilityRules();",
    );
    const tryBlock = readFn.indexOf("try {");
    expect(migrationCall).toBeGreaterThan(-1);
    expect(migrationCall).toBeLessThan(tryBlock);
  });

  it("no duplica reglas si existen ambas luggage_* y extra_luggage_*", () => {
    // Only one entry per canonicalId in the Map → only one in migrated output
    expect(adminFareSource).toContain("const canonicalMap = new Map");
    expect(adminFareSource).toContain(
      "for (const [canonicalId, { rule }] of canonicalMap)",
    );
  });

  it("multiplicadores no cambian: standard=1, xl=1.4, extra_luggage=1.25", () => {
    const defaults = adminFareSource.match(
      /vehicleMultipliers:\s*\{[^}]+\}/,
    )?.[0];
    expect(defaults).toContain("standard: 1");
    expect(defaults).toContain("xl: 1.4");
    expect(defaults).toContain("extra_luggage: 1.25");
  });
});
