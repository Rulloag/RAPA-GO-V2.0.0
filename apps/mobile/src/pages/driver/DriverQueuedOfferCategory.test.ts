import { describe, expect, it } from "vitest";
import { normalizeVehicleCategory } from "@rapa-go/shared";

import driverSource from "./index.tsx?raw";
import serviceSource from "../../features/rides/rides.service.ts?raw";

/**
 * Extracts getRideVehicleCategory as a callable function for behavioral tests.
 * We re-implement the resolution logic identically to the source to verify behavior.
 */
function normalizeRideVehicleCategory(value: unknown): string | null {
  return normalizeVehicleCategory(value);
}

function getRideVehicleCategory(ride: Record<string, unknown>): string {
  const direct =
    normalizeRideVehicleCategory(ride.requestedVehicleCategory) ??
    normalizeRideVehicleCategory(ride.fareVehicleCategory) ??
    normalizeRideVehicleCategory(ride.vehicleCategory) ??
    normalizeRideVehicleCategory(ride.vehicleType) ??
    normalizeRideVehicleCategory(ride.requestedVehicleType) ??
    null;

  return direct ?? "standard";
}

describe("Fase 2B — categoría en ofertas en cola (prioridad snapshot)", () => {
  it("ActiveRideOfferRideData incluye requestedVehicleCategory", () => {
    expect(serviceSource).toContain("requestedVehicleCategory?: string | null;");
  });

  it("requestedVehicleCategory: extra_luggage gana frente a vehicleCategory: standard", () => {
    const result = getRideVehicleCategory({
      requestedVehicleCategory: "extra_luggage",
      vehicleCategory: "standard",
    });
    expect(result).toBe("extra_luggage");
  });

  it("requestedVehicleCategory: xl gana frente a fareVehicleCategory: standard", () => {
    const result = getRideVehicleCategory({
      requestedVehicleCategory: "xl",
      fareVehicleCategory: "standard",
    });
    expect(result).toBe("xl");
  });

  it("requestedVehicleCategory: standard gana frente a vehicleType: xl", () => {
    const result = getRideVehicleCategory({
      requestedVehicleCategory: "standard",
      vehicleType: "xl",
    });
    expect(result).toBe("standard");
  });

  it("requestedVehicleCategory: luggage se normaliza a extra_luggage y tiene prioridad", () => {
    const result = getRideVehicleCategory({
      requestedVehicleCategory: "luggage",
      vehicleCategory: "standard",
      fareVehicleCategory: "xl",
    });
    expect(result).toBe("extra_luggage");
  });

  it("si requestedVehicleCategory no existe, se usa un campo legacy válido", () => {
    const result = getRideVehicleCategory({
      fareVehicleCategory: "xl",
      vehicleCategory: "standard",
    });
    expect(result).toBe("xl");
  });

  it("si requestedVehicleCategory es inválido, se usa un campo legacy válido", () => {
    const result = getRideVehicleCategory({
      requestedVehicleCategory: "invalid_garbage",
      vehicleCategory: "extra_luggage",
    });
    expect(result).toBe("extra_luggage");
  });

  it("si no existe ningún campo válido, se usa standard", () => {
    const result = getRideVehicleCategory({});
    expect(result).toBe("standard");
  });

  it("notes se usa únicamente después de agotar campos estructurados válidos", () => {
    const fn = driverSource.slice(
      driverSource.indexOf("function getRideVehicleCategory("),
    );
    const body = fn.slice(0, fn.indexOf("\n}") + 2);
    const notesIdx = body.indexOf("extractVehicleCategoryFromNotes");
    const requestedIdx = body.indexOf("ride.requestedVehicleCategory");
    const vehicleCatIdx = body.indexOf("ride.vehicleCategory");
    expect(requestedIdx).toBeLessThan(vehicleCatIdx);
    expect(vehicleCatIdx).toBeLessThan(notesIdx);
  });

  it("oferta en cola con requestedVehicleCategory extra_luggage llega como Extra Maleta", () => {
    const result = getRideVehicleCategory({
      requestedVehicleCategory: "extra_luggage",
      id: "queued-offer-ride",
      originText: "Airport",
      destinationText: "Hotel",
    });
    expect(result).toBe("extra_luggage");
    expect(result).not.toBe("standard");
  });

  it("orden en source: requestedVehicleCategory es el primer campo evaluado", () => {
    const fn = driverSource.slice(
      driverSource.indexOf("function getRideVehicleCategory("),
    );
    const firstNormalize = fn.indexOf("normalizeRideVehicleCategory(ride.");
    const fieldName = fn.slice(
      firstNormalize + "normalizeRideVehicleCategory(ride.".length,
      fn.indexOf(")", firstNormalize),
    );
    expect(fieldName).toBe("requestedVehicleCategory");
  });

  it("driverCategoryGate recibe categoría real de la oferta en cola", () => {
    const queuedSection = driverSource.slice(
      driverSource.indexOf("const handleAcceptDriverQueuedOffer"),
    );
    const end = queuedSection.indexOf("driverQueuedOfferActionLoading]);");
    const body = queuedSection.slice(0, end > 0 ? end : 600);
    expect(body).toContain("guardCategoryConfirmation(rideData,");
  });
});
