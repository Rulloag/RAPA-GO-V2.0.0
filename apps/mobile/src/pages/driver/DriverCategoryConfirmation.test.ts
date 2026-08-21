import { describe, expect, it } from "vitest";

import driverSource from "./index.tsx?raw";

describe("Fase 4 — compuerta basada en categoría aprobada del servidor", () => {
  it("obtiene la categoría desde ensureApprovedVehicleCategoryLoaded", () => {
    expect(driverSource).toContain("ensureApprovedVehicleCategoryLoaded(");
    expect(driverSource).toContain("runDriverCategoryGate(");
  });

  it("no usa rapago_driver_vehicle_category_v1 como fuente decisoria de la compuerta", () => {
    const gateSection = driverSource.slice(
      driverSource.indexOf("async function runDriverCategoryGate("),
      driverSource.indexOf("function getApprovedDriverCategoryForComparison("),
    );

    expect(gateSection).not.toContain("localStorage.getItem");
    expect(gateSection).not.toContain("getDriverRegisteredVehicleCategory");
    expect(gateSection).not.toContain('return "standard"');
  });

  it("comparte la misma compuerta entre AssignedRidesPage y DriverGlobalRideAlert", () => {
    expect(driverSource).toContain("function guardCategoryConfirmation(");
    expect(driverSource).toContain("function guardAlertCategoryConfirmation(");
    expect(driverSource).toContain("driverCategoryGate(");
  });

  it("muestra loading mientras verifica la categoría aprobada", () => {
    expect(driverSource).toContain("APPROVED_VEHICLE_CATEGORY_LOADING_MESSAGE");
    expect(driverSource).toContain("isOpen={categoryGateLoading}");
    expect(driverSource).toContain("isOpen={alertCategoryGateLoading}");
  });

  it("muestra aviso neutral si falla GET /drivers/me/profile", () => {
    expect(driverSource).toContain("APPROVED_VEHICLE_CATEGORY_ERROR_MESSAGE");
    expect(driverSource).toContain("setCategoryVerifyErrorRide");
    expect(driverSource).toContain("setAlertCategoryVerifyErrorRide");
    expect(driverSource).toContain('text: "Aceptar viaje"');
  });

  it("confirmar tras error ejecuta la acción exactamente una vez", () => {
    const verifyErrorAlert = driverSource.slice(
      driverSource.indexOf("isOpen={Boolean(categoryVerifyErrorRide)}"),
    );
    const nullifyIndex = verifyErrorAlert.indexOf(
      "categoryConfirmActionRef.current = null;",
    );
    const actionCallIndex = verifyErrorAlert.indexOf("void action();");
    expect(nullifyIndex).toBeGreaterThan(-1);
    expect(actionCallIndex).toBeGreaterThan(nullifyIndex);
  });

  it("cancelar tras error no ejecuta aceptación", () => {
    expect(driverSource).toContain("setCategoryVerifyErrorRide(null);");
    expect(driverSource).toContain("categoryConfirmActionRef.current = null;");
  });

  it("modal de inelegibilidad usa categoría aprobada del servidor", () => {
    expect(driverSource).toContain("getApprovedDriverCategoryForComparison(");
    expect(driverSource).not.toContain("getDriverRegisteredVehicleCategory(");
  });

  it("DriverProfilePage muestra categoría aprobada en solo lectura", () => {
    const profileSection = driverSource.slice(
      driverSource.indexOf("export function DriverProfilePage("),
    );
    expect(profileSection).toContain("Categoría aprobada:");
    expect(profileSection).toContain(
      "Para cambiar esta categoría debes solicitar una nueva",
    );
    expect(profileSection).toContain("approvedVehicleCategoryState");
  });

  it("DriverProfilePage no incluye selector para modificar categoría", () => {
    const profileSection = driverSource.slice(
      driverSource.indexOf("export function DriverProfilePage("),
    );
    expect(profileSection).not.toMatch(
      /vehicleCategory[\s\S]{0,200}IonSelect/,
    );
    expect(profileSection).not.toContain("setVehicleCategory(");
  });

  it("conserva rapago_driver_vehicle_category_v1 solo como caché de compatibilidad", () => {
    expect(driverSource).toContain("rapago_driver_vehicle_category_v1");
    expect(driverSource).toContain("rememberDriverVehicleCategory(");
    const gateSection = driverSource.slice(
      driverSource.indexOf("async function runDriverCategoryGate("),
      driverSource.indexOf("function getApprovedDriverCategoryForComparison("),
    );
    expect(gateSection).not.toContain("DRIVER_VEHICLE_CATEGORY_STORAGE_KEY");
  });

  it("missing/error no muestran Tu vehículo: Estándar en el modal de inelegibilidad", () => {
    const mismatchModal = driverSource.slice(
      driverSource.indexOf("isOpen={Boolean(categoryConfirmRide)}"),
    );
    expect(mismatchModal).toContain("getApprovedDriverCategoryForComparison(");
    expect(mismatchModal).toContain("getApprovedVehicleCategoryForDisplay(");
    expect(mismatchModal).not.toMatch(
      /Tu vehículo:\s*\$\{vehicleCategoryDisplay\("standard"\)\}/,
    );
  });

  it("missing/error usan el aviso neutral de verificación en modal dedicado", () => {
    expect(driverSource).toContain("APPROVED_VEHICLE_CATEGORY_ERROR_MESSAGE");
    expect(driverSource).toContain("isOpen={Boolean(categoryVerifyErrorRide)}");
    expect(driverSource).toContain("isOpen={Boolean(alertCategoryVerifyErrorRide)}");
  });

  it("runDriverCategoryGate usa capacidades para elegibilidad", () => {
    const gateSection = driverSource.slice(
      driverSource.indexOf("async function runDriverCategoryGate("),
      driverSource.indexOf("function getApprovedDriverCategoryForComparison("),
    );
    expect(gateSection).toContain("isVehicleEligibleForRequestedCategory(");
    expect(gateSection).toContain("approvedState.capabilities");
    expect(gateSection).toContain('status: "blocked"');
    expect(gateSection).not.toContain('?? "standard"');
  });

  it("modal blocked no permite Continuar de todas formas", () => {
    const mismatchModal = driverSource.slice(
      driverSource.indexOf("isOpen={Boolean(categoryConfirmRide)}"),
    );
    expect(mismatchModal).toContain("Entendido");
    expect(mismatchModal).not.toContain("Confirmar y aceptar");
  });

  it("bloquea doble clic antes de esperar GET /drivers/me/profile", () => {
    const gateFn = driverSource.slice(
      driverSource.indexOf("function driverCategoryGate("),
      driverSource.indexOf("type DriverEarningsFilter"),
    );
    expect(gateFn).toContain("if (gateLocksRef.current.has(gateKey)) return;");
    expect(gateFn.indexOf("gateLocksRef.current.add(gateKey);")).toBeLessThan(
      gateFn.indexOf("runDriverCategoryGate("),
    );
  });
});
