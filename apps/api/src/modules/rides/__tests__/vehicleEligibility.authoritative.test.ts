import { describe, expect, it } from "vitest";
import {
  isVehicleEligibleForRequestedCategory,
  resolveAssignedCategoryFromCapabilities,
  splitPlatformCommission,
  type VehicleCapabilities,
} from "@rapa-go/shared";

function caps(
  partial: Partial<VehicleCapabilities>,
): VehicleCapabilities {
  return {
    xl: false,
    extraLuggage: false,
    comfort: false,
    vehicleYear: null,
    ...partial,
  };
}

describe("isVehicleEligibleForRequestedCategory — authoritative matching", () => {
  it("STANDARD accepts any vehicle including superior", () => {
    expect(
      isVehicleEligibleForRequestedCategory(caps({}), "standard"),
    ).toBe(true);
    expect(
      isVehicleEligibleForRequestedCategory(caps({ xl: true }), "standard"),
    ).toBe(true);
    expect(
      isVehicleEligibleForRequestedCategory(
        caps({ comfort: true, vehicleYear: 2024 }),
        "standard",
      ),
    ).toBe(true);
    expect(
      isVehicleEligibleForRequestedCategory(
        caps({ extraLuggage: true }),
        "standard",
      ),
    ).toBe(true);
  });

  it("XL requires xl capability", () => {
    expect(
      isVehicleEligibleForRequestedCategory(caps({}), "xl"),
    ).toBe(false);
    expect(
      isVehicleEligibleForRequestedCategory(caps({ xl: true }), "xl"),
    ).toBe(true);
    expect(
      isVehicleEligibleForRequestedCategory(
        caps({ xl: true, comfort: true, vehicleYear: 2024 }),
        "xl",
      ),
    ).toBe(true);
    expect(
      isVehicleEligibleForRequestedCategory(
        caps({ comfort: true, vehicleYear: 2024 }),
        "xl",
      ),
    ).toBe(false);
  });

  it("EXTRA_LUGGAGE is independent of XL and comfort", () => {
    expect(
      isVehicleEligibleForRequestedCategory(caps({ xl: true }), "extra_luggage"),
    ).toBe(false);
    expect(
      isVehicleEligibleForRequestedCategory(
        caps({ comfort: true, vehicleYear: 2024 }),
        "extra_luggage",
      ),
    ).toBe(false);
    expect(
      isVehicleEligibleForRequestedCategory(
        caps({ extraLuggage: true }),
        "extra_luggage",
      ),
    ).toBe(true);
    expect(
      isVehicleEligibleForRequestedCategory(
        caps({ xl: true, extraLuggage: true, comfort: true, vehicleYear: 2024 }),
        "extra_luggage",
      ),
    ).toBe(true);
  });

  it("legacy luggage alias maps to extra_luggage eligibility", () => {
    expect(
      isVehicleEligibleForRequestedCategory(
        caps({ extraLuggage: true }),
        "luggage",
      ),
    ).toBe(true);
  });

  it("COMFORT requires approval flag AND year >= min", () => {
    expect(
      isVehicleEligibleForRequestedCategory(
        caps({ comfort: true, vehicleYear: 2024 }),
        "comfort",
        { comfortMinVehicleYear: 2020 },
      ),
    ).toBe(true);
    expect(
      isVehicleEligibleForRequestedCategory(
        caps({ comfort: true, vehicleYear: 2018 }),
        "comfort",
        { comfortMinVehicleYear: 2020 },
      ),
    ).toBe(false);
    expect(
      isVehicleEligibleForRequestedCategory(
        caps({ comfort: false, vehicleYear: 2024 }),
        "comfort",
        { comfortMinVehicleYear: 2020 },
      ),
    ).toBe(false);
    expect(
      isVehicleEligibleForRequestedCategory(
        caps({ comfort: true, vehicleYear: 2021 }),
        "comfort",
        { comfortMinVehicleYear: 2022 },
      ),
    ).toBe(false);
  });

  it("multi-capability vehicle can satisfy multiple categories", () => {
    const suv = caps({
      xl: true,
      extraLuggage: true,
      comfort: true,
      vehicleYear: 2024,
    });
    expect(isVehicleEligibleForRequestedCategory(suv, "standard")).toBe(true);
    expect(isVehicleEligibleForRequestedCategory(suv, "xl")).toBe(true);
    expect(isVehicleEligibleForRequestedCategory(suv, "extra_luggage")).toBe(
      true,
    );
    expect(
      isVehicleEligibleForRequestedCategory(suv, "comfort", {
        comfortMinVehicleYear: 2020,
      }),
    ).toBe(true);
  });
});

describe("resolveAssignedCategoryFromCapabilities", () => {
  it("for standard request snapshots primary capability", () => {
    expect(
      resolveAssignedCategoryFromCapabilities(
        caps({ xl: true, comfort: true, vehicleYear: 2024 }),
        "standard",
      ),
    ).toBe("comfort");
  });

  it("for strict request snapshots the requested category when eligible", () => {
    expect(
      resolveAssignedCategoryFromCapabilities(
        caps({ xl: true, comfort: true, vehicleYear: 2024 }),
        "xl",
      ),
    ).toBe("xl");
  });
});

describe("commission 23/77 unchanged with comfort fares", () => {
  it("standard 10000", () => {
    const s = splitPlatformCommission(10_000);
    expect(s.platformFeeClp).toBe(2_300);
    expect(s.driverAmountClp).toBe(7_700);
  });

  it("comfort fixture 13500", () => {
    const s = splitPlatformCommission(13_500);
    expect(s.platformFeeClp).toBe(3_105);
    expect(s.driverAmountClp).toBe(10_395);
  });

  it("comfort fixture 20000", () => {
    const s = splitPlatformCommission(20_000);
    expect(s.platformFeeClp).toBe(4_600);
    expect(s.driverAmountClp).toBe(15_400);
  });
});
