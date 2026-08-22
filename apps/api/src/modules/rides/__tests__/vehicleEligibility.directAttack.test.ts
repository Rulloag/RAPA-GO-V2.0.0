/**
 * Direct API attack / stale-offer / reassignment invariants for vehicle eligibility.
 * These tests exercise the shared eligibility core and repository contract shapes
 * without requiring a live DB (unit-level authoritative policy).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  isVehicleEligibleForRequestedCategory,
  VEHICLE_NOT_ELIGIBLE_CODE,
  type VehicleCapabilities,
} from "@rapa-go/shared";
import { AppError } from "../../../shared/errors/AppError.js";

vi.mock("../../drivers/comfortEligibility.service.js", () => ({
  getComfortMinVehicleYear: vi.fn(async () => 2020),
}));

const { assertVehicleEligibleForRide, capabilitiesFromDriverProfile } =
  await import("../vehicleEligibility.js");

function profile(partial: Record<string, unknown>) {
  return {
    vehicleCategory: "standard",
    vehicleYear: 2020,
    capabilityXl: false,
    capabilityExtraLuggage: false,
    capabilityComfort: false,
    vehiclePlate: "ABCD12",
    ...partial,
  } as any;
}

describe("assertVehicleEligibleForRide — direct API attack surface", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("A) standard driver cannot accept XL", async () => {
    await expect(
      assertVehicleEligibleForRide({
        profile: profile({}),
        requestedVehicleCategory: "xl",
      }),
    ).rejects.toMatchObject({
      code: VEHICLE_NOT_ELIGIBLE_CODE,
      statusCode: 409,
    });
  });

  it("B) standard driver cannot accept comfort", async () => {
    await expect(
      assertVehicleEligibleForRide({
        profile: profile({}),
        requestedVehicleCategory: "comfort",
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("C) XL without extra_luggage cannot accept Extra Maletas", async () => {
    await expect(
      assertVehicleEligibleForRide({
        profile: profile({ capabilityXl: true, vehicleCategory: "xl" }),
        requestedVehicleCategory: "extra_luggage",
      }),
    ).rejects.toMatchObject({ code: VEHICLE_NOT_ELIGIBLE_CODE });
  });

  it("D) assigned category derived from capabilities — client cannot fake comfort", async () => {
    const result = await assertVehicleEligibleForRide({
      profile: profile({
        capabilityXl: true,
        vehicleCategory: "xl",
      }),
      requestedVehicleCategory: "standard",
    });
    expect(result.assignedVehicleCategory).toBe("xl");
    expect(result.assignedVehicleCategory).not.toBe("comfort");
  });

  it("E) after capability revoked (stale offer), comfort accept fails", async () => {
    await expect(
      assertVehicleEligibleForRide({
        profile: profile({
          capabilityComfort: false,
          vehicleYear: 2024,
          vehicleCategory: "standard",
        }),
        requestedVehicleCategory: "comfort",
      }),
    ).rejects.toMatchObject({ code: VEHICLE_NOT_ELIGIBLE_CODE });
  });

  it("reassignment: comfort ride rejected for standard, accepted for comfort", async () => {
    await expect(
      assertVehicleEligibleForRide({
        profile: profile({}),
        requestedVehicleCategory: "comfort",
      }),
    ).rejects.toMatchObject({ code: VEHICLE_NOT_ELIGIBLE_CODE });

    const ok = await assertVehicleEligibleForRide({
      profile: profile({
        capabilityComfort: true,
        vehicleYear: 2024,
        vehicleCategory: "comfort",
      }),
      requestedVehicleCategory: "comfort",
    });
    expect(ok.assignedVehicleCategory).toBe("comfort");
  });

  it("capabilitiesFromDriverProfile prefers capability flags over exclusive category", () => {
    const multi = capabilitiesFromDriverProfile(
      profile({
        vehicleCategory: "standard",
        capabilityXl: true,
        capabilityExtraLuggage: true,
        capabilityComfort: true,
        vehicleYear: 2024,
      }),
    ) as VehicleCapabilities;
    expect(multi.xl).toBe(true);
    expect(multi.extraLuggage).toBe(true);
    expect(multi.comfort).toBe(true);
    expect(
      isVehicleEligibleForRequestedCategory(multi, "xl"),
    ).toBe(true);
    expect(
      isVehicleEligibleForRequestedCategory(multi, "extra_luggage"),
    ).toBe(true);
  });
});
