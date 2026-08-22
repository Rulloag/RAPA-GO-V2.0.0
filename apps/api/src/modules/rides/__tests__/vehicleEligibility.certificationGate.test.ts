/**
 * Gate final de certificación — evidencia ejecutable (sin producción).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  isVehicleEligibleForRequestedCategory,
  splitPlatformCommission,
  PLATFORM_COMMISSION_PERCENT,
  DRIVER_EARNINGS_PERCENT,
  VEHICLE_NOT_ELIGIBLE_CODE,
  type VehicleCapabilities,
} from "@rapa-go/shared";
import { AppError } from "../../../shared/errors/AppError.js";

vi.mock("../../drivers/comfortEligibility.service.js", () => ({
  getComfortMinVehicleYear: vi.fn(async () => mockComfortMinYear),
}));

let mockComfortMinYear = 2020;

const { assertVehicleEligibleForRide, capabilitiesFromDriverProfile } =
  await import("../vehicleEligibility.js");

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

function profile(partial: Record<string, unknown> = {}) {
  return {
    vehicleCategory: "standard",
    vehicleYear: 2024,
    vehiclePlate: "RAV424",
    vehicleBrand: "Toyota",
    vehicleModel: "RAV4",
    capabilityXl: false,
    capabilityExtraLuggage: false,
    capabilityComfort: false,
    ...partial,
  } as any;
}

describe("CERT — multicapability matrix", () => {
  const A = caps({
    xl: true,
    extraLuggage: true,
    comfort: true,
    vehicleYear: 2024,
  });
  const B = caps({
    xl: true,
    extraLuggage: false,
    comfort: true,
    vehicleYear: 2024,
  });
  const C = caps({
    xl: false,
    extraLuggage: true,
    comfort: true,
    vehicleYear: 2024,
  });
  const D = caps({
    xl: true,
    extraLuggage: true,
    comfort: false,
    vehicleYear: 2024,
  });

  it("Vehicle A: all four categories PASS", () => {
    expect(isVehicleEligibleForRequestedCategory(A, "standard")).toBe(true);
    expect(isVehicleEligibleForRequestedCategory(A, "xl")).toBe(true);
    expect(isVehicleEligibleForRequestedCategory(A, "extra_luggage")).toBe(true);
    expect(
      isVehicleEligibleForRequestedCategory(A, "comfort", {
        comfortMinVehicleYear: 2020,
      }),
    ).toBe(true);
  });

  it("Vehicle B: Extra REJECT; others PASS", () => {
    expect(isVehicleEligibleForRequestedCategory(B, "standard")).toBe(true);
    expect(isVehicleEligibleForRequestedCategory(B, "xl")).toBe(true);
    expect(isVehicleEligibleForRequestedCategory(B, "extra_luggage")).toBe(
      false,
    );
    expect(
      isVehicleEligibleForRequestedCategory(B, "comfort", {
        comfortMinVehicleYear: 2020,
      }),
    ).toBe(true);
  });

  it("Vehicle C: XL REJECT; others PASS", () => {
    expect(isVehicleEligibleForRequestedCategory(C, "standard")).toBe(true);
    expect(isVehicleEligibleForRequestedCategory(C, "xl")).toBe(false);
    expect(isVehicleEligibleForRequestedCategory(C, "extra_luggage")).toBe(
      true,
    );
    expect(
      isVehicleEligibleForRequestedCategory(C, "comfort", {
        comfortMinVehicleYear: 2020,
      }),
    ).toBe(true);
  });

  it("Vehicle D: Comfort REJECT; others PASS", () => {
    expect(isVehicleEligibleForRequestedCategory(D, "standard")).toBe(true);
    expect(isVehicleEligibleForRequestedCategory(D, "xl")).toBe(true);
    expect(isVehicleEligibleForRequestedCategory(D, "extra_luggage")).toBe(
      true,
    );
    expect(
      isVehicleEligibleForRequestedCategory(D, "comfort", {
        comfortMinVehicleYear: 2020,
      }),
    ).toBe(false);
  });
});

describe("CERT — config hot change comfort_min_vehicle_year", () => {
  beforeEach(() => {
    mockComfortMinYear = 2020;
  });

  it("year=2021 comfort=true PASS at min 2020 then REJECT at min 2022", async () => {
    mockComfortMinYear = 2020;
    const pass = await assertVehicleEligibleForRide({
      profile: profile({
        capabilityComfort: true,
        vehicleYear: 2021,
        vehicleCategory: "comfort",
      }),
      requestedVehicleCategory: "comfort",
    });
    expect(pass.assignedVehicleCategory).toBe("comfort");

    mockComfortMinYear = 2022;
    await expect(
      assertVehicleEligibleForRide({
        profile: profile({
          capabilityComfort: true,
          vehicleYear: 2021,
          vehicleCategory: "comfort",
        }),
        requestedVehicleCategory: "comfort",
      }),
    ).rejects.toMatchObject({
      code: VEHICLE_NOT_ELIGIBLE_CODE,
      statusCode: 409,
    });
  });
});

describe("CERT — finance exact productive splitPlatformCommission", () => {
  it("fare 10000 → 2300/7700 sum 10000", () => {
    const s = splitPlatformCommission(10_000);
    expect(PLATFORM_COMMISSION_PERCENT).toBe(23);
    expect(DRIVER_EARNINGS_PERCENT).toBe(77);
    expect(s.platformFeeClp).toBe(2300);
    expect(s.driverAmountClp).toBe(7700);
    expect(s.platformFeeClp + s.driverAmountClp).toBe(10_000);
  });

  it("fare 20000 → 4600/15400 sum 20000", () => {
    const s = splitPlatformCommission(20_000);
    expect(s.platformFeeClp).toBe(4600);
    expect(s.driverAmountClp).toBe(15400);
    expect(s.platformFeeClp + s.driverAmountClp).toBe(20_000);
  });

  it("fare 9999 productive rounding: platform+driver = 9999", () => {
    const s = splitPlatformCommission(9999);
    expect(s.platformFeeClp).toBe(Math.round(9999 * 0.23));
    expect(s.driverAmountClp).toBe(9999 - s.platformFeeClp);
    expect(s.platformFeeClp + s.driverAmountClp).toBe(9999);
  });
});

describe("CERT — negative eligibility (no successful assignment semantics)", () => {
  it("xl=false → 409 VEHICLE_NOT_ELIGIBLE", async () => {
    await expect(
      assertVehicleEligibleForRide({
        profile: profile({ capabilityXl: false }),
        requestedVehicleCategory: "xl",
      }),
    ).rejects.toMatchObject({
      code: VEHICLE_NOT_ELIGIBLE_CODE,
      statusCode: 409,
    });
  });

  it("extra_luggage=false → 409", async () => {
    await expect(
      assertVehicleEligibleForRide({
        profile: profile({ capabilityExtraLuggage: false, capabilityXl: true }),
        requestedVehicleCategory: "extra_luggage",
      }),
    ).rejects.toMatchObject({ code: VEHICLE_NOT_ELIGIBLE_CODE });
  });

  it("comfort=false → 409", async () => {
    await expect(
      assertVehicleEligibleForRide({
        profile: profile({ capabilityComfort: false, vehicleYear: 2024 }),
        requestedVehicleCategory: "comfort",
      }),
    ).rejects.toMatchObject({ code: VEHICLE_NOT_ELIGIBLE_CODE });
  });

  it("comfort year invalid → 409", async () => {
    mockComfortMinYear = 2020;
    await expect(
      assertVehicleEligibleForRide({
        profile: profile({
          capabilityComfort: true,
          vehicleYear: 2018,
        }),
        requestedVehicleCategory: "comfort",
      }),
    ).rejects.toMatchObject({ code: VEHICLE_NOT_ELIGIBLE_CODE });
  });

  it("stale offer after comfort revoke → 409", async () => {
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

  it("client cannot fake assigned comfort via request payload semantics", async () => {
    const result = await assertVehicleEligibleForRide({
      profile: profile({ capabilityXl: true, vehicleCategory: "xl" }),
      requestedVehicleCategory: "standard",
    });
    expect(result.assignedVehicleCategory).toBe("xl");
    expect(result.assignedVehicleCategory).not.toBe("comfort");
  });
});

describe("CERT — vehicle change attack (identity vs capabilities)", () => {
  it("RAV4 2024 multi-cap → Accent 2017 year fails comfort eligibility", () => {
    const before = caps({
      xl: true,
      extraLuggage: true,
      comfort: true,
      vehicleYear: 2024,
    });
    expect(
      isVehicleEligibleForRequestedCategory(before, "comfort", {
        comfortMinVehicleYear: 2020,
      }),
    ).toBe(true);

    // After identity change, upsert revokes flags; even if flag wrongly kept,
    // year rule alone must reject.
    const afterYearOnly = caps({
      xl: true,
      extraLuggage: true,
      comfort: true,
      vehicleYear: 2017,
    });
    expect(
      isVehicleEligibleForRequestedCategory(afterYearOnly, "comfort", {
        comfortMinVehicleYear: 2020,
      }),
    ).toBe(false);
  });

  it("capabilitiesFromDriverProfile after revoke flags → standard-only", () => {
    const revoked = capabilitiesFromDriverProfile(
      profile({
        vehicleBrand: "Hyundai",
        vehicleModel: "Accent",
        vehicleYear: 2017,
        vehiclePlate: "ACC2017",
        capabilityXl: false,
        capabilityExtraLuggage: false,
        capabilityComfort: false,
        vehicleCategory: "standard",
      }),
    );
    expect(revoked.xl).toBe(false);
    expect(revoked.extraLuggage).toBe(false);
    expect(revoked.comfort).toBe(false);
    expect(isVehicleEligibleForRequestedCategory(revoked, "xl")).toBe(false);
    expect(isVehicleEligibleForRequestedCategory(revoked, "comfort")).toBe(
      false,
    );
    expect(isVehicleEligibleForRequestedCategory(revoked, "standard")).toBe(
      true,
    );
  });
});

describe("CERT — multihop comfort A→B→C (service-level simulation)", () => {
  it("same ride ID: A comfort PASS, B standard REJECT, C comfort PASS", async () => {
    const rideId = "ride-comfort-multihop";
    const requested = "comfort";
    let driverUserId: string | null = null;
    let status = "requested";
    let assignedVehicleCategory: string | null = null;
    let assignedVehiclePlate: string | null = null;
    let acceptedAt: Date | null = null;
    const assignmentHistory: string[] = [];

    async function tryAccept(driverId: string, p: ReturnType<typeof profile>) {
      const snapshot = {
        driverUserId,
        status,
        assignedVehicleCategory,
        assignedVehiclePlate,
        acceptedAt,
        assignmentHistory: [...assignmentHistory],
      };
      try {
        const elig = await assertVehicleEligibleForRide({
          profile: p,
          requestedVehicleCategory: requested,
        });
        driverUserId = driverId;
        status = "accepted";
        assignedVehicleCategory = elig.assignedVehicleCategory;
        assignedVehiclePlate = p.vehiclePlate ?? null;
        acceptedAt = new Date();
        assignmentHistory.push(driverId);
        return { ok: true as const };
      } catch (err) {
        // NO mutation on failure
        expect(driverUserId).toBe(snapshot.driverUserId);
        expect(status).toBe(snapshot.status);
        expect(assignedVehicleCategory).toBe(snapshot.assignedVehicleCategory);
        expect(assignedVehiclePlate).toBe(snapshot.assignedVehiclePlate);
        expect(acceptedAt).toBe(snapshot.acceptedAt);
        expect(assignmentHistory).toEqual(snapshot.assignmentHistory);
        if (err instanceof AppError) {
          return { ok: false as const, code: err.code, statusCode: err.statusCode };
        }
        throw err;
      }
    }

    function cancelByDriver() {
      driverUserId = null;
      status = "requested";
      assignedVehicleCategory = null;
      assignedVehiclePlate = null;
      // acceptedAt cleared on re-request per cancelAccepted semantics for driver cancel
      acceptedAt = null;
    }

    const a = await tryAccept(
      "driver-A",
      profile({
        capabilityComfort: true,
        vehicleYear: 2024,
        vehiclePlate: "AAAA11",
        vehicleCategory: "comfort",
      }),
    );
    expect(a.ok).toBe(true);
    expect(driverUserId).toBe("driver-A");
    expect(status).toBe("accepted");
    expect(assignedVehicleCategory).toBe("comfort");
    const afterAAcceptedAt = acceptedAt;

    cancelByDriver();
    expect(status).toBe("requested");
    expect(driverUserId).toBeNull();

    const b = await tryAccept(
      "driver-B",
      profile({
        capabilityComfort: false,
        vehicleYear: 2024,
        vehiclePlate: "BBBB22",
        vehicleCategory: "standard",
      }),
    );
    expect(b.ok).toBe(false);
    expect(b).toMatchObject({ code: VEHICLE_NOT_ELIGIBLE_CODE, statusCode: 409 });
    expect(driverUserId).toBeNull();
    expect(status).toBe("requested");
    expect(assignedVehicleCategory).toBeNull();
    expect(assignmentHistory).toEqual(["driver-A"]);

    const c = await tryAccept(
      "driver-C",
      profile({
        capabilityComfort: true,
        vehicleYear: 2025,
        vehiclePlate: "CCCC33",
        vehicleCategory: "comfort",
      }),
    );
    expect(c.ok).toBe(true);
    expect(driverUserId).toBe("driver-C");
    expect(status).toBe("accepted");
    expect(assignedVehicleCategory).toBe("comfort");
    expect(assignedVehiclePlate).toBe("CCCC33");
    expect(acceptedAt).not.toBeNull();
    expect(acceptedAt?.getTime()).toBeGreaterThanOrEqual(
      afterAAcceptedAt?.getTime() ?? 0,
    );
    expect(assignmentHistory).toEqual(["driver-A", "driver-C"]);
    expect(rideId).toBe("ride-comfort-multihop");
    expect(requested).toBe("comfort");
  });

  it("XL multihop: A XL PASS, B standard REJECT, C XL PASS", async () => {
    const requested = "xl";
    let driverUserId: string | null = null;
    let status = "requested";
    let assigned: string | null = null;

    async function tryAccept(driverId: string, p: ReturnType<typeof profile>) {
      const snap = { driverUserId, status, assigned };
      try {
        const elig = await assertVehicleEligibleForRide({
          profile: p,
          requestedVehicleCategory: requested,
        });
        driverUserId = driverId;
        status = "accepted";
        assigned = elig.assignedVehicleCategory;
        return { ok: true as const };
      } catch (err) {
        expect(driverUserId).toBe(snap.driverUserId);
        expect(status).toBe(snap.status);
        expect(assigned).toBe(snap.assigned);
        return { ok: false as const, err };
      }
    }

    expect(
      (
        await tryAccept("A", profile({ capabilityXl: true, vehicleCategory: "xl" }))
      ).ok,
    ).toBe(true);
    driverUserId = null;
    status = "requested";
    assigned = null;

    expect(
      (
        await tryAccept(
          "B",
          profile({ capabilityXl: false, vehicleCategory: "standard" }),
        )
      ).ok,
    ).toBe(false);
    expect(driverUserId).toBeNull();

    expect(
      (
        await tryAccept("C", profile({ capabilityXl: true, vehicleCategory: "xl" }))
      ).ok,
    ).toBe(true);
    expect(driverUserId).toBe("C");
    expect(assigned).toBe("xl");
  });
});

describe("CERT — accept repository no-mutation on eligibility failure", () => {
  it("when eligibility throws, update/insert assignment must not run", async () => {
    const updateCalls: unknown[] = [];
    const insertCalls: unknown[] = [];

    const ride = {
      id: "ride-nomut",
      status: "requested",
      requestedVehicleCategory: "xl",
      driverUserId: null,
      assignedVehicleCategory: null,
      assignedVehiclePlate: null,
    };
    const standardProfile = profile({
      capabilityXl: false,
      vehiclePlate: "STD001",
    });

    // Simulate accept transaction body without touching real DB.
    async function simulatedAccept() {
      if (ride.status !== "requested") return null;
      const eligibility = await assertVehicleEligibleForRide({
        profile: standardProfile,
        requestedVehicleCategory: ride.requestedVehicleCategory,
      });
      updateCalls.push({
        status: "accepted",
        assignedVehicleCategory: eligibility.assignedVehicleCategory,
      });
      insertCalls.push({ rideRequestId: ride.id });
      ride.status = "accepted";
      ride.driverUserId = "driver-1" as any;
      return ride;
    }

    const before = structuredClone(ride);
    await expect(simulatedAccept()).rejects.toMatchObject({
      code: VEHICLE_NOT_ELIGIBLE_CODE,
    });
    expect(updateCalls).toHaveLength(0);
    expect(insertCalls).toHaveLength(0);
    expect(ride.status).toBe(before.status);
    expect(ride.driverUserId).toBe(before.driverUserId);
    expect(ride.assignedVehicleCategory).toBe(before.assignedVehicleCategory);
    expect(ride.assignedVehiclePlate).toBe(before.assignedVehiclePlate);
  });
});

describe("CERT — direct attack matrix", () => {
  const cases = [
    ["ATTACK1", "xl", {}],
    ["ATTACK2", "extra_luggage", { capabilityXl: true }],
    ["ATTACK3", "comfort", { vehicleYear: 2024 }],
  ] as const;

  for (const [name, requested, partial] of cases) {
    it(`${name}: standard-like profile cannot accept ${requested}`, async () => {
      await expect(
        assertVehicleEligibleForRide({
          profile: profile(partial),
          requestedVehicleCategory: requested,
        }),
      ).rejects.toMatchObject({
        code: VEHICLE_NOT_ELIGIBLE_CODE,
        statusCode: 409,
      });
    });
  }

  it("ATTACK4: fake comfort assigned category ignored — derived from capabilities", async () => {
    const result = await assertVehicleEligibleForRide({
      profile: profile({
        capabilityXl: true,
        capabilityComfort: false,
        vehicleCategory: "xl",
      }),
      requestedVehicleCategory: "standard",
    });
    expect(result.assignedVehicleCategory).not.toBe("comfort");
  });

  it("ATTACK5: stale after revoke comfort", async () => {
    await expect(
      assertVehicleEligibleForRide({
        profile: profile({ capabilityComfort: false, vehicleYear: 2024 }),
        requestedVehicleCategory: "comfort",
      }),
    ).rejects.toMatchObject({ code: VEHICLE_NOT_ELIGIBLE_CODE });
  });

  it("ATTACK6: vehicle year changed after offer", async () => {
    await expect(
      assertVehicleEligibleForRide({
        profile: profile({
          capabilityComfort: true,
          vehicleYear: 2017,
          vehicleBrand: "Hyundai",
          vehicleModel: "Accent",
        }),
        requestedVehicleCategory: "comfort",
      }),
    ).rejects.toMatchObject({ code: VEHICLE_NOT_ELIGIBLE_CODE });
  });

  it("ATTACK7: queued incompatible — same assert as acceptAsQueued", async () => {
    await expect(
      assertVehicleEligibleForRide({
        profile: profile({ capabilityComfort: false }),
        requestedVehicleCategory: "comfort",
      }),
    ).rejects.toMatchObject({ code: VEHICLE_NOT_ELIGIBLE_CODE });
  });
});
