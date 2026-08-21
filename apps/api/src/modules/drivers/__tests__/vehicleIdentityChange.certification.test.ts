/**
 * CERT — vehicle identity change invalidates approved capabilities.
 * Pure unit of repository policy (mocked DB).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSelectLimit = vi.fn();
const mockReturning = vi.fn();
const mockSet = vi.fn(() => ({ where: () => ({ returning: mockReturning }) }));
const mockValues = vi.fn(() => ({
  onConflictDoUpdate: () => ({ returning: mockReturning }),
}));

vi.mock("../../../db/client.js", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: mockSelectLimit,
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: mockValues,
    })),
    update: vi.fn(() => ({
      set: mockSet,
    })),
  },
}));

vi.mock("../../../db/schema/index.js", () => ({
  driverProfiles: {
    userId: "user_id",
    vehicleCategory: "vehicle_category",
    capabilityXl: "capability_xl",
    capabilityExtraLuggage: "capability_extra_luggage",
    capabilityComfort: "capability_comfort",
  },
}));

const { DriverProfileRepository } = await import("../driverProfile.repository.js");

describe("CERT — upsert vehicle identity change revokes capabilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("RAV4 2024 → Accent 2017 clears xl/extra/comfort and sets standard", async () => {
    mockSelectLimit.mockResolvedValue([
      {
        userId: "driver-1",
        vehicleBrand: "Toyota",
        vehicleModel: "RAV4",
        vehicleYear: 2024,
        vehiclePlate: "RAV424",
        capabilityXl: true,
        capabilityExtraLuggage: true,
        capabilityComfort: true,
        vehicleCategory: "comfort",
      },
    ]);

    const updated = {
      userId: "driver-1",
      vehicleBrand: "Hyundai",
      vehicleModel: "Accent",
      vehicleYear: 2017,
      vehiclePlate: "ACC2017",
      capabilityXl: false,
      capabilityExtraLuggage: false,
      capabilityComfort: false,
      vehicleCategory: "standard",
    };
    mockReturning.mockResolvedValue([updated]);

    const repo = new DriverProfileRepository();
    const result = await repo.upsert("driver-1", {
      vehicleBrand: "Hyundai",
      vehicleModel: "Accent",
      vehicleYear: 2017,
      vehiclePlate: "ACC2017",
    });

    expect(mockValues).toHaveBeenCalled();
    const insertArg = mockValues.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertArg.capabilityXl).toBe(false);
    expect(insertArg.capabilityExtraLuggage).toBe(false);
    expect(insertArg.capabilityComfort).toBe(false);
    expect(insertArg.vehicleCategory).toBe("standard");
    expect(result.capabilityComfort).toBe(false);
  });

  it("plate-only change also revokes capabilities", async () => {
    mockSelectLimit.mockResolvedValue([
      {
        userId: "driver-1",
        vehicleBrand: "Toyota",
        vehicleModel: "RAV4",
        vehicleYear: 2024,
        vehiclePlate: "OLD111",
        capabilityXl: true,
        capabilityExtraLuggage: true,
        capabilityComfort: true,
        vehicleCategory: "comfort",
      },
    ]);
    mockReturning.mockResolvedValue([
      {
        userId: "driver-1",
        vehiclePlate: "NEW222",
        capabilityXl: false,
        capabilityExtraLuggage: false,
        capabilityComfort: false,
        vehicleCategory: "standard",
      },
    ]);

    const repo = new DriverProfileRepository();
    await repo.upsert("driver-1", { vehiclePlate: "NEW222" });
    const insertArg = mockValues.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertArg.capabilityComfort).toBe(false);
    expect(insertArg.capabilityXl).toBe(false);
  });
});
