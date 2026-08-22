import {
  capabilitiesFromLegacyCategory,
  normalizeVehicleCategory,
  primaryCategoryFromCapabilities,
  vehicleCategoryDisplay,
  vehicleCategoryLabel,
  type VehicleCapabilities,
  type VehicleCategory,
} from "@rapa-go/shared";

import { driverProfileService } from "./driverProfile.service.js";

export type ApprovedVehicleCategoryState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "ready";
      category: VehicleCategory;
      capabilities: VehicleCapabilities;
    }
  | { status: "missing" }
  | { status: "error"; message: string };

export const APPROVED_VEHICLE_CATEGORY_LOADING_MESSAGE =
  "Verificando categoría aprobada de tu vehículo...";

export const APPROVED_VEHICLE_CATEGORY_ERROR_MESSAGE =
  "No fue posible verificar la categoría aprobada de tu vehículo.";

const approvedCategoryCache = new Map<string, ApprovedVehicleCategoryState>();
const approvedCategoryLoadPromises = new Map<
  string,
  Promise<ApprovedVehicleCategoryState>
>();
const approvedCategoryGenerations = new Map<string, number>();

function getApprovedCategoryCacheKey(
  accessToken?: string | null,
  user?: unknown,
): string | null {
  if (!accessToken) return null;

  if (user && typeof user === "object") {
    const record = user as Record<string, unknown>;
    const ownerKey =
      String(record.id ?? record.userId ?? record.email ?? "").trim();
    if (ownerKey) return `${ownerKey}::${accessToken}`;
  }

  return accessToken;
}

function capabilitiesFromProfilePayload(
  profile: Record<string, unknown> | null | undefined,
): VehicleCapabilities {
  const yearRaw = profile?.vehicleYear;
  const year =
    yearRaw != null && Number.isFinite(Number(yearRaw))
      ? Number(yearRaw)
      : null;

  const capsObj =
    profile?.capabilities && typeof profile.capabilities === "object"
      ? (profile.capabilities as Record<string, unknown>)
      : null;

  if (
    typeof profile?.capabilityXl === "boolean" ||
    typeof profile?.capabilityExtraLuggage === "boolean" ||
    typeof profile?.capabilityComfort === "boolean" ||
    capsObj
  ) {
    return {
      xl:
        profile?.capabilityXl === true ||
        capsObj?.xl === true,
      extraLuggage:
        profile?.capabilityExtraLuggage === true ||
        capsObj?.extraLuggage === true,
      comfort:
        profile?.capabilityComfort === true ||
        capsObj?.comfort === true,
      vehicleYear: year,
    };
  }

  return capabilitiesFromLegacyCategory(
    profile?.vehicleCategory as string | null | undefined,
    year,
  );
}

export function getApprovedVehicleCategoryState(
  accessToken?: string | null,
  user?: unknown,
): ApprovedVehicleCategoryState {
  const cacheKey = getApprovedCategoryCacheKey(accessToken, user);
  if (!cacheKey) return { status: "idle" };
  return approvedCategoryCache.get(cacheKey) ?? { status: "idle" };
}

export function setApprovedVehicleCategoryState(
  accessToken: string | null | undefined,
  user: unknown,
  state: ApprovedVehicleCategoryState,
): void {
  const cacheKey = getApprovedCategoryCacheKey(accessToken, user);
  if (!cacheKey) return;
  approvedCategoryCache.set(cacheKey, state);
}

export function clearApprovedVehicleCategoryState(
  accessToken?: string | null,
  user?: unknown,
): void {
  const cacheKey = getApprovedCategoryCacheKey(accessToken, user);
  if (!cacheKey) return;
  approvedCategoryCache.delete(cacheKey);
  approvedCategoryLoadPromises.delete(cacheKey);
  approvedCategoryGenerations.set(
    cacheKey,
    (approvedCategoryGenerations.get(cacheKey) ?? 0) + 1,
  );
}

export function clearApprovedVehicleCategoryStateForSession(session?: {
  accessToken?: string | null;
  user?: unknown;
} | null): void {
  clearApprovedVehicleCategoryState(session?.accessToken, session?.user);
}

export function rememberApprovedVehicleCategoryCache(
  accessToken: string | null | undefined,
  user: unknown,
  categoryOrProfile: unknown,
): ApprovedVehicleCategoryState {
  let state: ApprovedVehicleCategoryState;

  if (
    categoryOrProfile &&
    typeof categoryOrProfile === "object" &&
    ("vehicleCategory" in (categoryOrProfile as object) ||
      "capabilityXl" in (categoryOrProfile as object) ||
      "capabilities" in (categoryOrProfile as object))
  ) {
    const profile = categoryOrProfile as Record<string, unknown>;
    const capabilities = capabilitiesFromProfilePayload(profile);
    const normalized = normalizeVehicleCategory(profile.vehicleCategory);
    const hasCapabilityFlags =
      capabilities.xl ||
      capabilities.extraLuggage ||
      capabilities.comfort ||
      typeof profile.capabilityXl === "boolean" ||
      typeof profile.capabilityExtraLuggage === "boolean" ||
      typeof profile.capabilityComfort === "boolean";
    const category =
      normalized ??
      (hasCapabilityFlags
        ? primaryCategoryFromCapabilities(capabilities)
        : null);
    if (!category) {
      state = { status: "missing" };
    } else {
      state = { status: "ready", category, capabilities };
    }
  } else {
    const normalized = normalizeVehicleCategory(categoryOrProfile);
    if (!normalized) {
      state = { status: "missing" };
    } else {
      state = {
        status: "ready",
        category: normalized,
        capabilities: capabilitiesFromLegacyCategory(normalized, null),
      };
    }
  }

  setApprovedVehicleCategoryState(accessToken, user, state);
  return state;
}

export async function ensureApprovedVehicleCategoryLoaded(
  accessToken: string,
  user?: unknown,
): Promise<ApprovedVehicleCategoryState> {
  const cacheKey = getApprovedCategoryCacheKey(accessToken, user);
  if (!cacheKey) return { status: "idle" };
  const generation = approvedCategoryGenerations.get(cacheKey) ?? 0;

  const current = getApprovedVehicleCategoryState(accessToken, user);
  if (current.status === "ready" || current.status === "missing") {
    return current;
  }

  const inFlight = approvedCategoryLoadPromises.get(cacheKey);
  if (inFlight) return inFlight;

  setApprovedVehicleCategoryState(accessToken, user, { status: "loading" });

  const loadPromise = (async (): Promise<ApprovedVehicleCategoryState> => {
    try {
      const profile = await driverProfileService.getMyProfile(accessToken);
      if ((approvedCategoryGenerations.get(cacheKey) ?? 0) !== generation) {
        return { status: "idle" };
      }
      return rememberApprovedVehicleCategoryCache(
        accessToken,
        user,
        profile ?? null,
      );
    } catch (error) {
      if ((approvedCategoryGenerations.get(cacheKey) ?? 0) !== generation) {
        return { status: "idle" };
      }
      const state: ApprovedVehicleCategoryState = {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : APPROVED_VEHICLE_CATEGORY_ERROR_MESSAGE,
      };
      setApprovedVehicleCategoryState(accessToken, user, state);
      return state;
    } finally {
      if (approvedCategoryLoadPromises.get(cacheKey) === loadPromise) {
        approvedCategoryLoadPromises.delete(cacheKey);
      }
    }
  })();

  approvedCategoryLoadPromises.set(cacheKey, loadPromise);
  return loadPromise;
}

export function getApprovedVehicleCategoryLabel(
  state: ApprovedVehicleCategoryState,
): string {
  if (state.status === "ready") {
    return vehicleCategoryLabel(state.category);
  }
  if (state.status === "missing") {
    return "Categoría pendiente de verificación";
  }
  return "Categoría pendiente de verificación";
}

export function getApprovedVehicleCategoryDisplay(
  state: ApprovedVehicleCategoryState,
): string {
  if (state.status === "ready") {
    return vehicleCategoryDisplay(state.category);
  }
  if (state.status === "missing") {
    return "Categoría pendiente de verificación";
  }
  return "Categoría pendiente de verificación";
}

export function resolveApplicationDeclaredVehicleCategory(
  application: Record<string, unknown>,
): VehicleCategory | null {
  const direct = normalizeVehicleCategory(application.vehicleCategory);
  if (direct) return direct;

  const vehicles = Array.isArray(application.vehicles) ? application.vehicles : [];
  const primaryVehicle =
    vehicles.find((entry) => {
      if (!entry || typeof entry !== "object") return false;
      return Boolean((entry as Record<string, unknown>).primary);
    }) ?? vehicles[0];

  if (primaryVehicle && typeof primaryVehicle === "object") {
    const fromVehicle = normalizeVehicleCategory(
      (primaryVehicle as Record<string, unknown>).category,
    );
    if (fromVehicle) return fromVehicle;
  }

  return null;
}

export function getApplicationDeclaredVehicleCategoryLabel(
  application: Record<string, unknown>,
): string {
  const category = resolveApplicationDeclaredVehicleCategory(application);
  return category ? vehicleCategoryLabel(category) : "No declarada";
}

export function getApplicationDeclaredVehicleCategoryDisplay(
  application: Record<string, unknown>,
): string {
  const category = resolveApplicationDeclaredVehicleCategory(application);
  return category ? vehicleCategoryDisplay(category) : "No declarada";
}
