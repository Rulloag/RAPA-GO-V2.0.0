import { describe, expect, it } from "vitest";
import { resolveAssignedVehicleCategory } from "../resolveAssignedVehicleCategory.js";

describe("resolveAssignedVehicleCategory — Fase 2B", () => {
  it("standard profile → assigned standard", () => {
    expect(resolveAssignedVehicleCategory("standard")).toBe("standard");
  });

  it("xl profile → assigned xl", () => {
    expect(resolveAssignedVehicleCategory("xl")).toBe("xl");
  });

  it("extra_luggage profile → assigned extra_luggage", () => {
    expect(resolveAssignedVehicleCategory("extra_luggage")).toBe("extra_luggage");
  });

  it("legacy luggage profile → assigned extra_luggage", () => {
    expect(resolveAssignedVehicleCategory("luggage")).toBe("extra_luggage");
  });

  it("null profile → fallback standard", () => {
    expect(resolveAssignedVehicleCategory(null)).toBe("standard");
  });

  it("undefined profile → fallback standard", () => {
    expect(resolveAssignedVehicleCategory(undefined)).toBe("standard");
  });

  it("invalid string → fallback standard", () => {
    expect(resolveAssignedVehicleCategory("invalid_value")).toBe("standard");
  });

  it("empty string → fallback standard", () => {
    expect(resolveAssignedVehicleCategory("")).toBe("standard");
  });

  it("mismatch between requested and assigned does not throw", () => {
    expect(() => resolveAssignedVehicleCategory("xl")).not.toThrow();
  });

  it("comfort profile → assigned comfort", () => {
    expect(resolveAssignedVehicleCategory("comfort")).toBe("comfort");
  });

  it("assigned nunca inventa comfort si el perfil no es comfort", () => {
    expect(resolveAssignedVehicleCategory("standard")).not.toBe("comfort");
    expect(resolveAssignedVehicleCategory("xl")).not.toBe("comfort");
  });

  it("assigned is computed from profile, not from client input", () => {
    // The function takes only profile value — no client input parameter exists
    expect(resolveAssignedVehicleCategory.length).toBe(1);
  });
});
