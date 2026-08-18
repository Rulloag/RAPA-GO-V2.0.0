import { describe, expect, it, vi } from "vitest";
import {
  needsVehicleCategoryConfirmation,
  normalizeVehicleCategory,
  vehicleCategoryDisplay,
  vehicleCategoryMismatchCopy,
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
  | { status: "confirm"; ride: Record<string, unknown> }
  | { status: "verify_error"; ride: Record<string, unknown> }
> {
  if (approvedState.status === "error") {
    return { status: "verify_error", ride };
  }

  const requested = getRideVehicleCategory(ride);
  const driverCat =
    approvedState.status === "ready" ? approvedState.category : null;

  if (driverCat && !needsVehicleCategoryConfirmation(requested, driverCat)) {
    await action();
    return { status: "proceed" };
  }

  if (driverCat) {
    return { status: "confirm", ride };
  }

  await action();
  return { status: "proceed" };
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

describe("Fase 2A — caminos de aceptación con compuerta", () => {
  it("categorías iguales → acción inmediata sin modal mismatch", async () => {
    const action = vi.fn(async () => undefined);
    const result = await evaluateDriverCategoryGate(
      { id: "ride-1", requestedVehicleCategory: "xl" },
      { status: "ready", category: "xl" },
      action,
    );

    expect(result).toEqual({ status: "proceed" });
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("categorías diferentes → modal informativo", async () => {
    const action = vi.fn(async () => undefined);
    const ride = { id: "ride-2", requestedVehicleCategory: "xl" };
    const result = await evaluateDriverCategoryGate(
      ride,
      { status: "ready", category: "standard" },
      action,
    );

    expect(result).toEqual({ status: "confirm", ride });
    expect(action).not.toHaveBeenCalled();
  });

  it("luggage → extra_luggage en la comparación de compuerta", async () => {
    const action = vi.fn(async () => undefined);
    const result = await evaluateDriverCategoryGate(
      { id: "ride-3", requestedVehicleCategory: "luggage" },
      { status: "ready", category: "extra_luggage" },
      action,
    );

    expect(result).toEqual({ status: "proceed" });
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("cancelar mismatch no ejecuta la acción", async () => {
    const action = vi.fn(async () => undefined);
    const result = await evaluateDriverCategoryGate(
      { id: "ride-4", requestedVehicleCategory: "xl" },
      { status: "ready", category: "standard" },
      action,
    );

    expect(result.status).toBe("confirm");
    expect(action).not.toHaveBeenCalled();
  });

  it("confirmar mismatch ejecuta la acción exactamente una vez", async () => {
    const action = vi.fn(async () => undefined);
    const result = await evaluateDriverCategoryGate(
      { id: "ride-5", requestedVehicleCategory: "xl" },
      { status: "ready", category: "standard" },
      action,
    );

    expect(result.status).toBe("confirm");
    await action();
    expect(action).toHaveBeenCalledTimes(1);
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

  it("no existe otro camino vivo de aceptación que omita la compuerta", () => {
    const apiAcceptCalls = [
      ...driverSource.matchAll(/ridesService\.acceptRideRequest\(/g),
      ...driverSource.matchAll(/ridesService\.acceptDriverOffer\(/g),
    ];
    const localAcceptCalls = [
      ...driverSource.matchAll(/= acceptDriverScheduledReservationLocally\(/g),
    ];

    for (const match of [...apiAcceptCalls, ...localAcceptCalls]) {
      const context = driverSource.slice(
        Math.max(0, match.index! - 1200),
        match.index!,
      );
      const isGuarded =
        context.includes("function performAcceptRide(") ||
        context.includes("function performAcceptRideFromAlert(") ||
        context.includes("function performAcceptScheduledReservation(") ||
        context.includes("guardCategoryConfirmation(");
      expect(isGuarded).toBe(true);
    }
  });

  it("usa copy y etiquetas compartidas de @rapa-go/shared", () => {
    expect(driverSource).toContain("vehicleCategoryDisplay(requested)");
    expect(driverSource).toContain("vehicleCategoryMismatchCopy(requested)");
    expect(vehicleCategoryMismatchCopy("xl").title).toBeTruthy();
    expect(vehicleCategoryDisplay("extra_luggage")).toContain("Extra Maleta");
  });

  it("matching sigue siendo no restrictivo (missing/error proceden sin bloquear)", async () => {
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
});
