import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  driverVehicleCategorySchema,
  resolveProvisionDriverVehicleCategory,
  upsertDriverProfileSchema,
} from "../driverProfile.schemas.js";

const { upsertProfileMock } = vi.hoisted(() => ({
  upsertProfileMock: vi.fn(),
}));

vi.mock("../driverProfile.service.js", () => ({
  DriverProfileService: vi.fn().mockImplementation(() => ({
    upsertProfile: upsertProfileMock,
  })),
}));

import { driverProfileController } from "../driverProfile.controller.js";

function createReply() {
  const reply = {
    statusCode: 200,
    body: null as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    send(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return reply;
}

describe("Fase 4 — PATCH /drivers/me/profile vehicleCategory restriction", () => {
  beforeEach(() => {
    upsertProfileMock.mockReset();
    upsertProfileMock.mockResolvedValue({
      ok: true,
      profile: {
        id: "profile-1",
        userId: "user-1",
        vehicleCategory: "xl",
        phone: null,
        vehicleBrand: "Toyota",
        vehicleModel: "Yaris",
        vehicleYear: 2020,
        vehiclePlate: "AA-BB-11",
        vehicleColor: "rojo",
        licenseNumber: null,
        licenseExpiry: null,
        profilePhotoUrl: null,
        vehiclePhotoUrl: null,
        bio: "Conductor",
        languages: ["es"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
  });

  it("allows PATCH of permitted profile fields", async () => {
    const reply = createReply();

    await driverProfileController.upsertMyProfile(
      {
        body: {
          bio: "Conductor local",
          vehicleColor: "azul",
        },
        headers: { authorization: "Bearer token" },
      } as never,
      reply as never,
    );

    expect(upsertProfileMock).toHaveBeenCalledOnce();
    expect(upsertProfileMock.mock.calls[0]?.[1]).toEqual({
      bio: "Conductor local",
      vehicleColor: "azul",
    });
    expect(reply.statusCode).toBe(200);
    expect(reply.body).toMatchObject({ ok: true });
  });

  it.each([
    ["standard"],
    ["xl"],
    ["extra_luggage"],
    ["luggage"],
  ])("rejects PATCH with vehicleCategory=%s", async (vehicleCategory) => {
    const reply = createReply();

    await driverProfileController.upsertMyProfile(
      {
        body: { vehicleCategory },
        headers: { authorization: "Bearer token" },
      } as never,
      reply as never,
    );

    expect(upsertProfileMock).not.toHaveBeenCalled();
    expect(reply.statusCode).toBe(400);
    expect(reply.body).toMatchObject({
      ok: false,
      code: "VALIDATION_ERROR",
      message: expect.stringContaining("categoría aprobada"),
    });
  });

  it("does not mutate stored profile when vehicleCategory is rejected", async () => {
    const reply = createReply();

    await driverProfileController.upsertMyProfile(
      {
        body: { vehicleCategory: "standard", bio: "Intento de cambio" },
        headers: { authorization: "Bearer token" },
      } as never,
      reply as never,
    );

    expect(upsertProfileMock).not.toHaveBeenCalled();
    expect(reply.statusCode).toBe(400);
  });

  it("keeps vehicleCategory out of the public upsert schema", () => {
    expect(
      upsertDriverProfileSchema.safeParse({
        vehicleCategory: "xl",
      }).success,
    ).toBe(false);
  });
});

describe("Fase 4 — internal provisioning category normalization", () => {
  it("copies xl from approved application provisioning helper", () => {
    expect(resolveProvisionDriverVehicleCategory("xl")).toBe("xl");
  });

  it("normalizes legacy luggage to extra_luggage for internal provisioning", () => {
    expect(resolveProvisionDriverVehicleCategory("luggage")).toBe("extra_luggage");
    expect(driverVehicleCategorySchema.parse("luggage")).toBe("extra_luggage");
  });

  it("falls back to standard when application category is invalid", () => {
    expect(resolveProvisionDriverVehicleCategory("invalid")).toBe("standard");
    expect(resolveProvisionDriverVehicleCategory(null)).toBe("standard");
  });
});
