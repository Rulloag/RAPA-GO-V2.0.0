import { describe, expect, it } from "vitest";
import {
  compactRut,
  formatRut,
  normalizeRut,
  validateRut,
} from "./rut.js";

const VALID_NUMERIC = "12345678-5";
const VALID_K = "12000008-K";
const VALID_SEVEN_K = "7000013-K";

describe("canonical Chilean RUT", () => {
  it("accepts a valid numeric DV", () => {
    expect(validateRut(VALID_NUMERIC)).toBe(true);
    expect(normalizeRut(VALID_NUMERIC)).toBe("12345678-5");
  });

  it("accepts a valid K DV", () => {
    expect(validateRut(VALID_K)).toBe(true);
    expect(normalizeRut(VALID_K)).toBe("12000008-K");
    expect(compactRut(VALID_K)).toBe("12000008K");
  });

  it("accepts lowercase k and never strips K", () => {
    expect(validateRut("12000008-k")).toBe(true);
    expect(normalizeRut("12000008-k")).toBe("12000008-K");
    expect(formatRut("12000008k")).toBe("12.000.008-K");
    expect(compactRut("12.000.008-k")).toContain("K");
    expect(compactRut("12.000.008-k")).not.toMatch(/k$/);
  });

  it("accepts dots, no dots and surrounding spaces", () => {
    expect(normalizeRut("  12.345.678-5  ")).toBe("12345678-5");
    expect(normalizeRut("123456785")).toBe("12345678-5");
    expect(normalizeRut("12.000.008-K")).toBe("12000008-K");
  });

  it("accepts a 7-digit body with K", () => {
    expect(validateRut(VALID_SEVEN_K)).toBe(true);
    expect(normalizeRut("7.000.013-k")).toBe("7000013-K");
  });

  it("rejects a wrong DV", () => {
    expect(validateRut("12345678-9")).toBe(false);
    expect(normalizeRut("12345678-9")).toBe("");
  });

  it("rejects an invalid body", () => {
    expect(validateRut("12-5")).toBe(false);
    expect(validateRut("123-K")).toBe(false);
    expect(validateRut("123456-5")).toBe(false);
  });

  it("rejects empty input", () => {
    expect(validateRut("")).toBe(false);
    expect(validateRut("   ")).toBe(false);
    expect(normalizeRut(null)).toBe("");
  });

  it("rejects special characters", () => {
    expect(validateRut("12345678-5!")).toBe(true);
    expect(validateRut("12@345678-5")).toBe(true);
    expect(compactRut("12@345.678-5")).toBe("123456785");
    expect(validateRut("@@@")).toBe(false);
  });

  it("rejects letter A or Z in the body or as DV", () => {
    expect(validateRut("12345678-A")).toBe(false);
    expect(validateRut("12345678-Z")).toBe(false);
    expect(compactRut("12345678-A")).toBe("12345678");
    expect(compactRut("A12345678-5")).toBe("123456785");
  });

  it("rejects a missing DV", () => {
    expect(validateRut("12345678")).toBe(false);
    expect(validateRut("12.345.678")).toBe(false);
  });

  it("rejects excess length", () => {
    expect(validateRut("123456789-5")).toBe(false);
    expect(compactRut("12345678905")).toHaveLength(9);
  });

  it("formats mid-edit without dropping K or inventing a DV", () => {
    expect(formatRut("12")).toBe("12");
    expect(formatRut("1234567")).toBe("1.234.567");
    expect(formatRut("12345678")).toBe("12.345.678");
    expect(formatRut("123456785")).toBe("12.345.678-5");
    expect(formatRut("12345678K")).toBe("12.345.678-K");
    expect(formatRut("12000008k")).toBe("12.000.008-K");
  });
});
