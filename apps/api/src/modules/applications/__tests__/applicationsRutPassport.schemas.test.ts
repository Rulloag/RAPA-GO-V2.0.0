import { describe, expect, it } from "vitest";
import { createApplicationSchema } from "../applications.schemas.js";

const legal = {
  legalDocumentId: "11111111-1111-4111-8111-111111111111",
  version: "2.1",
  acceptedContract: true,
  acceptedDocumentsTruth: true,
  acceptedIndependentNature: true,
  acceptedPrivacyGeolocation: true,
  acceptedSensitiveData: true,
  acceptedRestWindow: true,
  acceptedPersonalService: true,
  restWindowStart: "09:01",
  restWindowEnd: "21:01",
} as const;

describe("application RUT vs passport", () => {
  it("normalizes a valid driver RUT and rejects a wrong DV", () => {
    const valid = createApplicationSchema.safeParse({
      type: "driver",
      firstName: "Ana",
      lastName: "Perez",
      email: "ana@example.com",
      phone: "56912345678",
      rut: "12.345.678-5",
      birthDate: "1990-01-01",
      driverContractAcceptance: legal,
    });

    expect(valid.success).toBe(true);
    if (valid.success && valid.data.type === "driver") {
      expect(valid.data.rut).toBe("12345678-5");
    }

    const invalid = createApplicationSchema.safeParse({
      type: "driver",
      firstName: "Ana",
      lastName: "Perez",
      email: "ana@example.com",
      phone: "56912345678",
      rut: "12345678-9",
      birthDate: "1990-01-01",
      driverContractAcceptance: legal,
    });

    expect(invalid.success).toBe(false);
  });

  it("does not treat a passport-like value as a valid Chilean RUT", () => {
    const parsed = createApplicationSchema.safeParse({
      type: "guide",
      firstName: "Ana",
      lastName: "Perez",
      email: "ana@example.com",
      phone: "56912345678",
      rut: "AB1234567",
    });

    expect(parsed.success).toBe(false);
  });
});
