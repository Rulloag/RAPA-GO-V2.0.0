import { describe, expect, it } from "vitest";
import { facebookAccountSetupSchema, googleAuthRequestSchema } from "../auth.schemas.js";

describe("auth schemas Chilean RUT vs passport", () => {
  it("rejects a Chilean RUT with letter A as DV", () => {
    const parsed = facebookAccountSetupSchema.safeParse({
      setupCode: "a".repeat(32),
      passengerFareType: "chilean",
      phone: "56912345678",
      rut: "12345678-A",
      legalAcceptances: [
        { legalDocumentId: "11111111-1111-4111-8111-111111111111", version: "1" },
        { legalDocumentId: "22222222-2222-4222-8222-222222222222", version: "1" },
        { legalDocumentId: "33333333-3333-4333-8333-333333333333", version: "1" },
      ],
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts a valid K RUT", () => {
    const parsed = facebookAccountSetupSchema.safeParse({
      setupCode: "a".repeat(32),
      passengerFareType: "chilean",
      phone: "56912345678",
      rut: "12.000.008-k",
      legalAcceptances: [
        { legalDocumentId: "11111111-1111-4111-8111-111111111111", version: "1" },
        { legalDocumentId: "22222222-2222-4222-8222-222222222222", version: "1" },
        { legalDocumentId: "33333333-3333-4333-8333-333333333333", version: "1" },
      ],
    });

    expect(parsed.success).toBe(true);
  });

  it("does not apply Chilean RUT rules to Google passport payloads", () => {
    const parsed = googleAuthRequestSchema.safeParse({
      idToken: "a".repeat(120),
      passengerFareType: "foreigner",
      passport: "ZZ9999999",
    });

    expect(parsed.success).toBe(true);
  });
});
