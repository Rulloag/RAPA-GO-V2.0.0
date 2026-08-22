import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  capabilitiesFromLegacyCategory,
  type VehicleCategory,
} from "@rapa-go/shared";

import {
  APPROVED_VEHICLE_CATEGORY_ERROR_MESSAGE,
  clearApprovedVehicleCategoryState,
  clearApprovedVehicleCategoryStateForSession,
  ensureApprovedVehicleCategoryLoaded,
  getApplicationDeclaredVehicleCategoryDisplay,
  getApprovedVehicleCategoryState,
  getApprovedVehicleCategoryDisplay,
  rememberApprovedVehicleCategoryCache,
  resolveApplicationDeclaredVehicleCategory,
} from "./driverApprovedVehicleCategory.js";

const getMyProfileMock = vi.fn();

vi.mock("./driverProfile.service.js", () => ({
  driverProfileService: {
    getMyProfile: (...args: unknown[]) => getMyProfileMock(...args),
  },
}));

function readyState(
  category: VehicleCategory,
  profile?: Record<string, unknown> | null,
) {
  const capabilities = profile
    ? {
        xl:
          profile.capabilityXl === true ||
          (profile.capabilities as { xl?: boolean } | undefined)?.xl === true,
        extraLuggage:
          profile.capabilityExtraLuggage === true ||
          (profile.capabilities as { extraLuggage?: boolean } | undefined)
            ?.extraLuggage === true,
        comfort:
          profile.capabilityComfort === true ||
          (profile.capabilities as { comfort?: boolean } | undefined)
            ?.comfort === true,
        vehicleYear:
          profile.vehicleYear != null &&
          Number.isFinite(Number(profile.vehicleYear))
            ? Number(profile.vehicleYear)
            : null,
      }
    : capabilitiesFromLegacyCategory(category, null);

  return {
    status: "ready" as const,
    category,
    capabilities,
  };
}

describe("Fase 4 — categoría aprobada desde GET /drivers/me/profile", () => {
  const token = "driver-token";
  const user = { id: "driver-1", email: "driver@example.com" };

  beforeEach(() => {
    getMyProfileMock.mockReset();
    clearApprovedVehicleCategoryState(token, user);
  });

  it("normaliza xl desde el perfil del servidor", async () => {
    getMyProfileMock.mockResolvedValue({ vehicleCategory: "xl" });

    const state = await ensureApprovedVehicleCategoryLoaded(token, user);

    expect(state).toEqual(readyState("xl"));
    expect(getApprovedVehicleCategoryDisplay(state)).toContain("XL");
  });

  it("normaliza extra_luggage desde el perfil del servidor", async () => {
    getMyProfileMock.mockResolvedValue({ vehicleCategory: "extra_luggage" });

    const state = await ensureApprovedVehicleCategoryLoaded(token, user);

    expect(state).toEqual(readyState("extra_luggage"));
    expect(getApprovedVehicleCategoryDisplay(state)).toContain("Extra Maleta");
  });

  it("normaliza standard desde el perfil del servidor", async () => {
    getMyProfileMock.mockResolvedValue({ vehicleCategory: "standard" });

    const state = await ensureApprovedVehicleCategoryLoaded(token, user);

    expect(state).toEqual(readyState("standard"));
    expect(getApprovedVehicleCategoryDisplay(state)).toContain("Estándar");
  });

  it("perfil inexistente (null) → missing, nunca ready standard", async () => {
    getMyProfileMock.mockResolvedValue(null);

    const state = await ensureApprovedVehicleCategoryLoaded(token, user);

    expect(state).toEqual({ status: "missing" });
    expect(state).not.toEqual({ status: "ready", category: "standard" });
    expect(getApprovedVehicleCategoryDisplay(state)).toBe(
      "Categoría pendiente de verificación",
    );
    expect(getApprovedVehicleCategoryDisplay(state)).not.toContain("Estándar");
  });

  it("respuesta sin vehicleCategory → missing", async () => {
    getMyProfileMock.mockResolvedValue({
      id: "profile-1",
      userId: "user-1",
    });

    const state = await ensureApprovedVehicleCategoryLoaded(token, user);

    expect(state).toEqual({ status: "missing" });
  });

  it("marca missing cuando el perfil no trae categoría válida", async () => {
    getMyProfileMock.mockResolvedValue({ vehicleCategory: "invalid" });

    const state = await ensureApprovedVehicleCategoryLoaded(token, user);

    expect(state).toEqual({ status: "missing" });
    expect(getApprovedVehicleCategoryDisplay(state)).toBe(
      "Categoría pendiente de verificación",
    );
  });

  it("expone error neutral cuando falla GET /drivers/me/profile", async () => {
    getMyProfileMock.mockRejectedValue(new Error("network down"));

    const state = await ensureApprovedVehicleCategoryLoaded(token, user);

    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(state.message).toContain("network down");
    }
  });

  it("reutiliza la caché de sesión y evita GET duplicados", async () => {
    getMyProfileMock.mockResolvedValue({ vehicleCategory: "xl" });

    await ensureApprovedVehicleCategoryLoaded(token, user);
    await ensureApprovedVehicleCategoryLoaded(token, user);

    expect(getMyProfileMock).toHaveBeenCalledTimes(1);
  });

  it("prioriza perfil servidor sobre localStorage en la caché de sesión", () => {
    rememberApprovedVehicleCategoryCache(token, user, "extra_luggage");

    expect(getApprovedVehicleCategoryDisplay(
      rememberApprovedVehicleCategoryCache(token, user, "xl"),
    )).toContain("XL");
  });

  it("solo un perfil con vehicleCategory válido produce ready", async () => {
    getMyProfileMock.mockResolvedValue(null);
    expect(await ensureApprovedVehicleCategoryLoaded(token, user)).toEqual({
      status: "missing",
    });

    clearApprovedVehicleCategoryState(token, user);
    getMyProfileMock.mockResolvedValue({ vehicleCategory: "standard" });
    expect(await ensureApprovedVehicleCategoryLoaded(token, user)).toEqual(
      readyState("standard"),
    );
  });

  it("logout limpia caché y una cuenta nueva no reutiliza XL", () => {
    rememberApprovedVehicleCategoryCache(token, user, "xl");
    expect(getApprovedVehicleCategoryState(token, user)).toEqual(
      readyState("xl"),
    );

    clearApprovedVehicleCategoryStateForSession({
      accessToken: token,
      user,
    });

    expect(getApprovedVehicleCategoryState(token, user)).toEqual({
      status: "idle",
    });
    expect(
      getApprovedVehicleCategoryState("driver-token-b", {
        id: "driver-2",
        email: "driver-2@example.com",
      }),
    ).toEqual({ status: "idle" });
  });

  it("cambio de usuario/token no reutiliza estado ready anterior", () => {
    rememberApprovedVehicleCategoryCache(token, user, "xl");

    expect(
      getApprovedVehicleCategoryState("driver-token-b", {
        id: "driver-2",
        email: "driver-2@example.com",
      }),
    ).toEqual({ status: "idle" });
  });

  it("logout durante carga descarta la respuesta en vuelo", async () => {
    let resolveProfile: ((value: { vehicleCategory: string }) => void) | null =
      null;
    getMyProfileMock.mockImplementation(
      () =>
        new Promise<{ vehicleCategory: string }>((resolve) => {
          resolveProfile = resolve;
        }),
    );

    const pending = ensureApprovedVehicleCategoryLoaded(token, user);
    clearApprovedVehicleCategoryStateForSession({
      accessToken: token,
      user,
    });

    resolveProfile?.({ vehicleCategory: "xl" });

    await expect(pending).resolves.toEqual({ status: "idle" });
    expect(getApprovedVehicleCategoryState(token, user)).toEqual({
      status: "idle",
    });
  });
});

describe("Fase 4 — categoría declarada en revisión admin", () => {
  it("usa application.vehicleCategory cuando es válida", () => {
    expect(
      resolveApplicationDeclaredVehicleCategory({
        vehicleCategory: "xl",
        vehicles: [{ category: "standard", primary: true }],
      }),
    ).toBe("xl");
  });

  it("usa vehicles[0].category como fallback", () => {
    expect(
      getApplicationDeclaredVehicleCategoryDisplay({
        vehicles: [{ category: "extra_luggage", primary: true }],
      }),
    ).toContain("Extra Maleta");
  });

  it('muestra "No declarada" si no hay categoría válida', () => {
    expect(
      getApplicationDeclaredVehicleCategoryDisplay({
        vehicleCategory: "invalid",
        vehicles: [{ category: "unknown" }],
      }),
    ).toBe("No declarada");
  });

  it("muestra luggage histórico como Extra Maleta", () => {
    expect(
      getApplicationDeclaredVehicleCategoryDisplay({
        vehicleCategory: "luggage",
      }),
    ).toContain("Extra Maleta");
  });
});

describe("Fase 4 — mensajes de compuerta", () => {
  it("expone el mensaje neutral de error de verificación", () => {
    expect(APPROVED_VEHICLE_CATEGORY_ERROR_MESSAGE).toBe(
      "No fue posible verificar la categoría aprobada de tu vehículo.",
    );
  });
});
