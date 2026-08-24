import { describe, expect, it } from "vitest";
import { registerRequestSchema } from "./index.js";

const legalAcceptances = [
  { legalDocumentId: "11111111-1111-4111-8111-111111111111", version: "1" },
  { legalDocumentId: "22222222-2222-4222-8222-222222222222", version: "1" },
  { legalDocumentId: "33333333-3333-4333-8333-333333333333", version: "1" },
];

const base = {
  email: "passenger@example.com",
  password: "password12",
  name: "Ana Perez",
  role: "passenger" as const,
  phone: "56912345678",
  legalAcceptances,
};

describe("registerRequestSchema Chilean RUT vs passport", () => {
  it("normalizes a valid Chilean RUT for chilean passengers", () => {
    const parsed = registerRequestSchema.safeParse({
      ...base,
      passengerFareType: "chilean",
      rut: "12.345.678-5",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.rut).toBe("12345678-5");
    }
  });

  it("rejects a Chilean RUT with a wrong DV", () => {
    const parsed = registerRequestSchema.safeParse({
      ...base,
      passengerFareType: "chilean",
      rut: "12345678-9",
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects A-Z as a Chilean check digit", () => {
    const parsed = registerRequestSchema.safeParse({
      ...base,
      passengerFareType: "chilean",
      rut: "12345678-A",
    });

    expect(parsed.success).toBe(false);
  });

  it("does not apply Chilean RUT rules to a foreigner passport", () => {
    const parsed = registerRequestSchema.safeParse({
      ...base,
      passengerFareType: "foreigner",
      passport: "AB1234567",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.passport).toBe("AB1234567");
      expect(parsed.data.rut).toBeUndefined();
    }
  });

  it("accepts a passport that would be an invalid Chilean RUT", () => {
    const parsed = registerRequestSchema.safeParse({
      ...base,
      passengerFareType: "foreigner",
      passport: "ZZ9999999",
    });

    expect(parsed.success).toBe(true);
  });
});
