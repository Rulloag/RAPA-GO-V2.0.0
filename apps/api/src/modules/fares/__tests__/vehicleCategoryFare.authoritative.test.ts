import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_COMFORT_FARE_MULTIPLIER,
  splitPlatformCommission,
} from "@rapa-go/shared";

vi.mock("../../drivers/comfortEligibility.service.js", () => ({
  getComfortFareMultiplier: vi.fn(async () => DEFAULT_COMFORT_FARE_MULTIPLIER),
  getComfortMinVehicleYear: vi.fn(async () => 2020),
}));

const { computeAuthoritativeCategoryFareClp } = await import(
  "../vehicleCategoryFare.service.js"
);

describe("vehicle category fare — backend authoritative", () => {
  it("comfort base 10000 @ 1.35 → 13500", async () => {
    const fare = await computeAuthoritativeCategoryFareClp(10_000, "comfort");
    expect(fare).toBe(13_500);
  });

  it("ignores malicious low client amount semantics (authoritative always wins)", async () => {
    const authoritative = await computeAuthoritativeCategoryFareClp(
      10_000,
      "comfort",
    );
    const maliciousClient = 1;
    expect(authoritative).toBe(13_500);
    expect(authoritative).toBeGreaterThan(maliciousClient);
  });

  it("ignores malicious high client amount semantics", async () => {
    const authoritative = await computeAuthoritativeCategoryFareClp(
      10_000,
      "comfort",
    );
    expect(authoritative).toBe(13_500);
    expect(authoritative).toBeLessThan(999_999);
  });

  it("xl multiplier applies server-side (10000 → 14000)", async () => {
    const fare = await computeAuthoritativeCategoryFareClp(10_000, "xl");
    expect(fare).toBe(14_000);
  });

  it("extra_luggage multiplier applies server-side (10000 → 12500)", async () => {
    const fare = await computeAuthoritativeCategoryFareClp(10_000, "extra_luggage");
    expect(fare).toBe(12_500);
  });

  it("commission 23/77 on authoritative comfort fare 13500", async () => {
    const split = splitPlatformCommission(13_500);
    expect(split.platformFeeClp).toBe(3105);
    expect(split.driverAmountClp).toBe(10_395);
    expect(split.platformFeeClp + split.driverAmountClp).toBe(13_500);
  });

  it("hot change comfort multiplier uses current setting", async () => {
    const { getComfortFareMultiplier } = await import(
      "../../drivers/comfortEligibility.service.js"
    );
    vi.mocked(getComfortFareMultiplier).mockResolvedValueOnce(1.2);
    const fare = await computeAuthoritativeCategoryFareClp(10_000, "comfort");
    expect(fare).toBe(12_000);
  });
});
