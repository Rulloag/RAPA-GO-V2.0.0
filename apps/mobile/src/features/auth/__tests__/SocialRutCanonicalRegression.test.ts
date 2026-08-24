import { describe, expect, it } from "vitest";
import googleSource from "../GoogleAccountSetupModal.tsx?raw";
import appleSource from "../AppleAccountSetupModal.tsx?raw";

describe("Apple/Google social RUT regression", () => {
  it("sends canonical normalizeRut from both setup modals", () => {
    expect(googleSource).toContain("normalizeRut(rut)");
    expect(appleSource).toContain("normalizeRut(rut)");
    expect(googleSource).toContain("isValidRut(cleanRut)");
    expect(appleSource).toContain("isValidRut(cleanRut)");
  });
});
