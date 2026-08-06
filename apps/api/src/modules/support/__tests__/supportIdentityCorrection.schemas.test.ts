import { describe, expect, it } from "vitest";
import {
  adminSupportUpdateSchema,
  createSupportCaseSchema,
} from "../support.schemas.js";

describe("support identity correction schemas", () => {
  it("allows a user to create an identity correction case", () => {
    const parsed = createSupportCaseSchema.parse({
      category: "identity_correction",
      subject: "Corregir mis datos personales",
      description:
        "Necesito corregir mi nombre y teléfono mediante revisión administrativa.",
    });

    expect(parsed.category).toBe("identity_correction");
  });

  it("allows an admin to submit verified identity changes", () => {
    const parsed = adminSupportUpdateSchema.parse({
      identityCorrection: {
        name: "Leandro Valenzuela",
        email: "leandro@example.com",
        phone: "56912345678",
        rut: "12345678-5",
        licenseNumber: "LIC-123",
        licenseExpiry: "2030-12-31",
      },
    });

    expect(parsed.identityCorrection?.licenseExpiry).toBe("2030-12-31");
  });

  it("rejects an empty identity correction", () => {
    expect(
      adminSupportUpdateSchema.safeParse({
        identityCorrection: {},
      }).success,
    ).toBe(false);
  });
});
