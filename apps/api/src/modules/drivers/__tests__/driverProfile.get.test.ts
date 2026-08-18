import { describe, expect, it, vi, beforeEach } from "vitest";

import { serializeDriverProfile } from "../driverProfile.serializer.js";

const { getProfileMock } = vi.hoisted(() => ({
  getProfileMock: vi.fn(),
}));

vi.mock("../driverProfile.service.js", () => ({
  DriverProfileService: vi.fn().mockImplementation(() => ({
    getProfile: getProfileMock,
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

const baseProfileRow = {
  id: "profile-1",
  userId: "user-1",
  phone: null,
  vehicleBrand: "Toyota",
  vehicleModel: "Yaris",
  vehicleYear: 2020,
  vehiclePlate: "AA-BB-11",
  vehicleColor: "rojo",
  vehicleCategory: "standard" as string,
  licenseNumber: null,
  licenseExpiry: null,
  profilePhotoUrl: null,
  vehiclePhotoUrl: null,
  bio: null,
  languages: [] as string[],
  gender: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("Fase 4 — trazado GET /drivers/me/profile sin perfil", () => {
  beforeEach(() => {
    getProfileMock.mockReset();
  });

  it("serializeDriverProfile(null) devuelve null, no vehicleCategory standard", () => {
    expect(serializeDriverProfile(null)).toBeNull();
  });

  it("perfil inexistente en repo → HTTP 200 con data null", async () => {
    getProfileMock.mockResolvedValue({ ok: true, profile: null });
    const reply = createReply();

    await driverProfileController.getMyProfile(
      { headers: { authorization: "Bearer token" } } as never,
      reply as never,
    );

    expect(reply.statusCode).toBe(200);
    expect(reply.body).toEqual({
      ok: true,
      data: null,
      statusCode: 200,
    });
  });

  it("perfil real standard → HTTP incluye vehicleCategory standard", async () => {
    const serialized = serializeDriverProfile({
      ...baseProfileRow,
      vehicleCategory: "standard",
    });

    getProfileMock.mockResolvedValue({ ok: true, profile: serialized });
    const reply = createReply();

    await driverProfileController.getMyProfile(
      { headers: { authorization: "Bearer token" } } as never,
      reply as never,
    );

    expect(reply.body).toMatchObject({
      ok: true,
      data: { vehicleCategory: "standard" },
    });
  });

  it("perfil real xl → HTTP incluye vehicleCategory xl", async () => {
    const serialized = serializeDriverProfile({
      ...baseProfileRow,
      vehicleCategory: "xl",
    });

    getProfileMock.mockResolvedValue({ ok: true, profile: serialized });
    const reply = createReply();

    await driverProfileController.getMyProfile(
      { headers: { authorization: "Bearer token" } } as never,
      reply as never,
    );

    expect(reply.body).toMatchObject({
      ok: true,
      data: { vehicleCategory: "xl" },
    });
  });

  it("perfil real extra_luggage → HTTP incluye vehicleCategory extra_luggage", async () => {
    const serialized = serializeDriverProfile({
      ...baseProfileRow,
      vehicleCategory: "extra_luggage",
    });

    getProfileMock.mockResolvedValue({ ok: true, profile: serialized });
    const reply = createReply();

    await driverProfileController.getMyProfile(
      { headers: { authorization: "Bearer token" } } as never,
      reply as never,
    );

    expect(reply.body).toMatchObject({
      ok: true,
      data: { vehicleCategory: "extra_luggage" },
    });
  });

  it("serializeDriverProfile conserva categoría inválida tal cual (normalización es del cliente)", () => {
    const serialized = serializeDriverProfile({
      ...baseProfileRow,
      vehicleCategory: "invalid_value",
    });

    expect(serialized?.vehicleCategory).toBe("invalid_value");
  });

  it("solo una fila real con categoría válida produce vehicleCategory en la respuesta", () => {
    expect(serializeDriverProfile(null)).toBeNull();

    const real = serializeDriverProfile({
      ...baseProfileRow,
      vehicleCategory: "standard",
    });

    expect(real?.vehicleCategory).toBe("standard");
  });
});
