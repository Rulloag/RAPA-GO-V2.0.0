import { describe, expect, it } from "vitest";
import { upsertPassengerProfileSchema } from "../../passengers/passengerProfile.schemas.js";
import { upsertDriverProfileSchema } from "../../drivers/driverProfile.schemas.js";
import { createDriverApplicationSchema } from "../../applications/applications.schemas.js";

const contractAcceptance = {
  legalDocumentId: "11111111-1111-4111-8111-111111111111",
  version: "1.0",
  acceptedContract: true,
  acceptedDocumentsTruth: true,
  acceptedIndependentNature: true,
  acceptedPrivacyGeolocation: true,
  acceptedRestWindow: true,
  acceptedPersonalService: true,
  restWindowStart: "22:00",
  restWindowEnd: "10:00",
};

describe("immutable identity schemas", () => {
  it("rejects a passenger self-service phone change", () => {
    expect(
      upsertPassengerProfileSchema.safeParse({
        phone: "+56912345678",
      }).success,
    ).toBe(false);
  });

  it("rejects driver phone and license changes from the driver profile", () => {
    expect(
      upsertDriverProfileSchema.safeParse({
        phone: "+56912345678",
      }).success,
    ).toBe(false);

    expect(
      upsertDriverProfileSchema.safeParse({
        licenseNumber: "12345678-9",
        licenseExpiry: "2030-12-31",
      }).success,
    ).toBe(false);
  });

  it("still allows operational driver profile fields", () => {
    const parsed = upsertDriverProfileSchema.parse({
      bio: "Conductor local",
      languages: ["es"],
      vehicleColor: "rojo",
    });

    expect(parsed.bio).toBe("Conductor local");
  });

  it("requires birth date in a driver application", () => {
    const base = {
      type: "driver" as const,
      firstName: "Leandro",
      lastName: "Valenzuela",
      email: "leandro@example.com",
      phone: "56912345678",
      rut: "12345678-5",
      driverContractAcceptance: contractAcceptance,
    };

    expect(createDriverApplicationSchema.safeParse(base).success).toBe(false);
    expect(
      createDriverApplicationSchema.safeParse({
        ...base,
        birthDate: "1999-01-31",
      }).success,
    ).toBe(true);
  });
});
