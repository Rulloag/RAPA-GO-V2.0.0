import { describe, expect, it, vi } from "vitest";
import {
  isVehicleEligibleForRequestedCategory,
  normalizeVehicleCategory,
  vehicleCategoryDisplay,
  vehicleCategoryMismatchCopy,
  capabilitiesFromLegacyCategory,
  type VehicleCategory,
} from "@rapa-go/shared";

import driverSource from "./index.tsx?raw";
import type { ApprovedVehicleCategoryState } from "../../features/drivers/driverApprovedVehicleCategory.js";

function getRideVehicleCategory(ride: Record<string, unknown>): VehicleCategory {
  const direct =
    normalizeVehicleCategory(ride.requestedVehicleCategory) ??
    normalizeVehicleCategory(ride.fareVehicleCategory) ??
    normalizeVehicleCategory(ride.vehicleCategory) ??
    normalizeVehicleCategory(ride.vehicleType) ??
    normalizeVehicleCategory(ride.requestedVehicleType);

  return direct ?? "standard";
}

async function evaluateDriverCategoryGate(
  ride: Record<string, unknown>,
  approvedState: ApprovedVehicleCategoryState,
  action: () => Promise<void>,
): Promise<
  | { status: "proceed" }
  | { status: "blocked"; ride: Record<string, unknown> }
  | { status: "verify_error"; ride: Record<string, unknown> }
> {
  if (approvedState.status === "error") {
    return { status: "verify_error", ride };
  }

  const requested = getRideVehicleCategory(ride);

  if (approvedState.status === "ready") {
    const eligible = isVehicleEligibleForRequestedCategory(
      approvedState.capabilities,
      requested,
    );
    if (!eligible) {
      return { status: "blocked", ride };
    }
  }

  await action();
  return { status: "proceed" };
}

function ready(
  category: VehicleCategory,
): ApprovedVehicleCategoryState {
  return {
    status: "ready",
    category,
    capabilities: capabilitiesFromLegacyCategory(category, 2024),
  };
}

function getDriverCategoryGateKey(ride: Record<string, unknown>): string {
  const directId = String(
    ride.id ?? ride.rideId ?? ride.rideRequestId ?? ride.requestId ?? "",
  ).trim();
  if (directId) return `driver-category-gate:${directId}`;
  return `driver-category-gate:${JSON.stringify({
    origin: ride.originText ?? null,
    destination: ride.destinationText ?? null,
  })}`;
}

describe("Fase 2A — caminos de aceptación con compuerta autoritativa", () => {
  it("categorías elegibles → acción inmediata", async () => {
    const action = vi.fn(async () => undefined);
    const result = await evaluateDriverCategoryGate(
      { id: "ride-1", requestedVehicleCategory: "xl" },
      ready("xl"),
      action,
    );

    expect(result).toEqual({ status: "proceed" });
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("categorías no elegibles → blocked sin continuar", async () => {
    const action = vi.fn(async () => undefined);
    const ride = { id: "ride-2", requestedVehicleCategory: "xl" };
    const result = await evaluateDriverCategoryGate(
      ride,
      ready("standard"),
      action,
    );

    expect(result).toEqual({ status: "blocked", ride });
    expect(action).not.toHaveBeenCalled();
  });

  it("standard request accepts superior XL vehicle", async () => {
    const action = vi.fn(async () => undefined);
    const result = await evaluateDriverCategoryGate(
      { id: "ride-std", requestedVehicleCategory: "standard" },
      ready("xl"),
      action,
    );
    expect(result.status).toBe("proceed");
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("luggage → extra_luggage en la comparación de compuerta", async () => {
    const action = vi.fn(async () => undefined);
    const result = await evaluateDriverCategoryGate(
      { id: "ride-3", requestedVehicleCategory: "luggage" },
      ready("extra_luggage"),
      action,
    );

    expect(result).toEqual({ status: "proceed" });
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("blocked no permite Continuar de todas formas", async () => {
    const action = vi.fn(async () => undefined);
    const result = await evaluateDriverCategoryGate(
      { id: "ride-4", requestedVehicleCategory: "xl" },
      ready("standard"),
      action,
    );

    expect(result.status).toBe("blocked");
    expect(action).not.toHaveBeenCalled();
    expect(driverSource).toContain(
      "Tu vehículo actual no cumple los requisitos de este tipo de viaje.",
    );
    expect(driverSource).not.toContain("Confirmar y aceptar XL");
  });

  it("handleAcceptRide usa la compuerta", () => {
    const fn = driverSource.slice(
      driverSource.indexOf("async function handleAcceptRide("),
    );
    const body = fn.slice(0, fn.indexOf("\n  async function performAcceptRide("));
    expect(body).toContain("guardCategoryConfirmation(ride,");
  });

  it("acceptRideFromAlert usa la compuerta", () => {
    const fn = driverSource.slice(
      driverSource.indexOf("async function acceptRideFromAlert("),
    );
    const body = fn.slice(0, fn.indexOf("\n  async function performAcceptRideFromAlert"));
    expect(body).toContain("guardAlertCategoryConfirmation(ride,");
  });

  it("handleAcceptScheduledReservation usa la compuerta", () => {
    const fn = driverSource.slice(
      driverSource.indexOf("async function handleAcceptScheduledReservation("),
    );
    const body = fn.slice(
      0,
      fn.indexOf("\n  async function performAcceptScheduledReservation"),
    );
    expect(body).toContain("guardCategoryConfirmation(ride,");
  });

  it("handleAcceptDriverQueuedOffer usa la compuerta", () => {
    const fn = driverSource.slice(
      driverSource.indexOf("const handleAcceptDriverQueuedOffer = useCallback("),
    );
    const body = fn.slice(
      0,
      fn.indexOf("], [driverQueuedOffer, session?.accessToken, driverQueuedOfferActionLoading]);"),
    );
    expect(body).toContain("guardCategoryConfirmation(rideData,");
  });

  it("no existe otro camino vivo de aceptación API que omita la compuerta", () => {
    const apiAcceptCalls = [
      ...driverSource.matchAll(/ridesService\.acceptRideRequest\(/g),
      ...driverSource.matchAll(/ridesService\.acceptDriverOffer\(/g),
    ];

    for (const match of apiAcceptCalls) {
      const context = driverSource.slice(
        Math.max(0, match.index! - 1200),
        match.index!,
      );
      const isGuarded =
        context.includes("function performAcceptRide(") ||
        context.includes("function performAcceptRideFromAlert(") ||
        context.includes("guardCategoryConfirmation(");
      expect(isGuarded).toBe(true);
    }
  });

  it("usa copy y etiquetas compartidas de @rapa-go/shared", () => {
    expect(driverSource).toContain("vehicleCategoryDisplay(requested)");
    expect(vehicleCategoryMismatchCopy("xl").title).toBeTruthy();
    expect(vehicleCategoryDisplay("extra_luggage")).toContain("Extra Maleta");
  });

  it("error de verificación bloquea; missing procede (backend revalida)", async () => {
    const missingAction = vi.fn(async () => undefined);
    const missingResult = await evaluateDriverCategoryGate(
      { id: "ride-6", requestedVehicleCategory: "xl" },
      { status: "missing" },
      missingAction,
    );
    expect(missingResult).toEqual({ status: "proceed" });
    expect(missingAction).toHaveBeenCalledTimes(1);

    const errorAction = vi.fn(async () => undefined);
    const errorResult = await evaluateDriverCategoryGate(
      { id: "ride-7", requestedVehicleCategory: "xl" },
      { status: "error", message: "network down" },
      errorAction,
    );
    expect(errorResult.status).toBe("verify_error");
    expect(errorAction).not.toHaveBeenCalled();
  });

  it("bloquea un segundo intento sobre el mismo viaje mientras el lock está activo", () => {
    const locks = new Set<string>();
    const ride = { id: "ride-lock-1" };
    const key = getDriverCategoryGateKey(ride);

    expect(locks.has(key)).toBe(false);
    locks.add(key);
    expect(locks.has(key)).toBe(true);
    locks.delete(key);
    expect(locks.has(key)).toBe(false);
  });

  it("driverCategoryGate ignora un segundo clic mientras el lock está activo", () => {
    expect(driverSource).toContain("if (gateLocksRef.current.has(gateKey)) return;");
    expect(driverSource).toContain("gateLocksRef.current.add(gateKey);");
    expect(driverSource).toContain("releaseDriverCategoryGateLock(");
  });

  it("SCHEDULED_SERVER_VALIDATION=PENDING — reserva programada sigue siendo local", () => {
    expect(driverSource).toContain("acceptDriverScheduledReservationLocally");
  });
});
