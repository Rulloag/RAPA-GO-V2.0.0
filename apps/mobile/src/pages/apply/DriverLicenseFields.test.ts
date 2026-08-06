import { describe, expect, it } from "vitest";
import applySource from "./index.tsx?raw";

describe("driver application license fields", () => {
  it("requires license number and expiry in the first driver step", () => {
    const driverStart = applySource.indexOf("export function ApplicationDriverPage");
    const guideStart = applySource.indexOf("export function ApplicationGuidePage");
    const driverSource = applySource.slice(driverStart, guideStart);
    const accountSection = driverSource.slice(
      driverSource.indexOf("Datos de tu cuenta"),
      driverSource.indexOf("Validación Rapa Nui"),
    );

    expect(accountSection).toContain("Número de licencia de conducir *");
    expect(accountSection).toContain("Fecha de vencimiento de la licencia *");
    expect(accountSection).toContain("setLicenseNumber");
    expect(accountSection).toContain("setLicenseExpiry");
    expect(driverSource).toContain("isLicenseNumberValid(licenseNumber)");
    expect(driverSource).toContain("isLicenseExpiryValid(licenseExpiry)");
    expect(driverSource).toContain("licenseNumber: cleanLicenseNumber");
    expect(driverSource).toContain("licenseExpiry,");
  });
});
