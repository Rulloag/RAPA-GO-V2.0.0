import { describe, expect, it } from "vitest";

import { driverContractAcceptanceSchema } from "../applications.schemas.js";

const baseAcceptance = {
  legalDocumentId: "11111111-1111-4111-8111-111111111111",
  version: "2.1",
  acceptedContract: true,
  acceptedDocumentsTruth: true,
  acceptedIndependentNature: true,
  acceptedPrivacyGeolocation: true,
  acceptedSensitiveData: true,
  acceptedRestWindow: true,
  acceptedPersonalService: true,
  clientAcceptedAt: "2026-08-04T18:11:00.000Z",
} as const;

describe("driver rest-window clock validation", () => {
  it.each([
    ["00:00", "12:00"],
    ["09:01", "21:01"],
    ["21:01", "09:01"],
    ["23:59", "11:59"],
  ])("accepts valid HH:MM values %s to %s", (restWindowStart, restWindowEnd) => {
    const result = driverContractAcceptanceSchema.safeParse({
      ...baseAcceptance,
      restWindowStart,
      restWindowEnd,
    });

    expect(result.success).toBe(true);
  });

  it.each(["24:00", "21:60", "9:01", "21:01:00", "HH:MM", ""])
    ("rejects an invalid clock value: %s", (restWindowStart) => {
      const result = driverContractAcceptanceSchema.safeParse({
        ...baseAcceptance,
        restWindowStart,
        restWindowEnd: "09:01",
      });

      expect(result.success).toBe(false);
    });
});
