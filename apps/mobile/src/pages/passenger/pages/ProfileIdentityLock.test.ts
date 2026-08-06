import { describe, expect, it } from "vitest";
import applySource from "../../apply/index.tsx?raw";
import driverSource from "../../driver/index.tsx?raw";
import profileSource from "./ProfilePage.tsx?raw";

describe("profile identity lock regression", () => {
  it("locks the driver application identity fields and leaves birth date editable", () => {
    const accountSection = applySource.slice(
      applySource.indexOf("Datos de tu cuenta"),
      applySource.indexOf("Validación Rapa Nui"),
    );

    expect(accountSection).toContain("readonly");
    expect(accountSection).toContain("Fecha de nacimiento *");
    expect(accountSection).toContain("setBirthDate");
    expect(accountSection).not.toContain("setFirstName(String");
    expect(accountSection).not.toContain("setLastName(String");
    expect(accountSection).not.toContain("setEmail(String");
    expect(accountSection).not.toContain("setRut(formatRut");
  });

  it("locks passenger name, phone, email and RUT in the profile", () => {
    expect(profileSource).toContain("Solicitar corrección de identidad");
    expect(profileSource).toContain('value={profile.rut ?? "No informado"}');
    expect(profileSource).not.toContain(
      "onIonInput={(e) => setNameInput(sanitizeProfileText",
    );
    expect(profileSource).not.toContain(
      "onIonInput={(e) => setPhoneInput(sanitizeProfilePhone",
    );
  });

  it("locks driver phone and license fields", () => {
    const licenseSection = driverSource.slice(
      driverSource.lastIndexOf("Licencia de conducir"),
      driverSource.lastIndexOf("Biografía"),
    );

    expect(licenseSection).toContain("readonly");
    expect(licenseSection).toContain("Solicitar corrección a soporte");
    expect(licenseSection).not.toContain("setLicenseNumber(String");
    expect(licenseSection).not.toContain("setLicenseExpiry(String");
  });
});
