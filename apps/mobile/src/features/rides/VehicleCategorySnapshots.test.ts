import { describe, expect, it } from "vitest";
import {
  resolveRequestedDisplay,
  resolveAssignedDisplay,
} from "./VehicleCategorySnapshots";

import tripsSource from "../../pages/passenger/pages/TripsPage.tsx?raw";
import adminSource from "../../pages/admin/index.tsx?raw";

describe("Fase 3 — VehicleCategorySnapshots", () => {
  describe("resolveRequestedDisplay", () => {
    it("1. requested standard + assigned standard", () => {
      const r = resolveRequestedDisplay({ requestedVehicleCategory: "standard" });
      expect(r?.label).toBe("Estándar");
    });

    it("2. requested xl", () => {
      const r = resolveRequestedDisplay({ requestedVehicleCategory: "xl" });
      expect(r?.label).toBe("XL");
    });

    it("3. requested extra_luggage", () => {
      const r = resolveRequestedDisplay({ requestedVehicleCategory: "extra_luggage" });
      expect(r?.label).toBe("Extra Maleta");
    });

    it("4. requested extra_luggage + assigned standard muestra diferencia", () => {
      const r = resolveRequestedDisplay({ requestedVehicleCategory: "extra_luggage" });
      const a = resolveAssignedDisplay({ assignedVehicleCategory: "standard", status: "accepted" });
      expect(r?.label).toBe("Extra Maleta");
      expect(a.label).toBe("Estándar");
      expect(r?.label).not.toBe(a.label);
    });

    it("5. requested standard + assigned xl muestra diferencia", () => {
      const r = resolveRequestedDisplay({ requestedVehicleCategory: "standard" });
      const a = resolveAssignedDisplay({ assignedVehicleCategory: "xl", status: "completed" });
      expect(r?.label).toBe("Estándar");
      expect(a.label).toBe("XL");
      expect(r?.label).not.toBe(a.label);
    });

    it("6. luggage histórico se muestra como Extra Maleta", () => {
      const r = resolveRequestedDisplay({ requestedVehicleCategory: "luggage" });
      expect(r?.label).toBe("Extra Maleta");
    });

    it("9. requested ausente y sin legacy muestra null (No registrada)", () => {
      const r = resolveRequestedDisplay({});
      expect(r).toBeNull();
    });

    it("10. requested canónico gana sobre campos legacy contradictorios", () => {
      const r = resolveRequestedDisplay({
        requestedVehicleCategory: "extra_luggage",
        fareVehicleCategory: "standard",
        vehicleCategory: "xl",
      });
      expect(r?.label).toBe("Extra Maleta");
    });

    it("si requestedVehicleCategory no existe, se usa legacy válido", () => {
      const r = resolveRequestedDisplay({
        requestedVehicleCategory: null,
        fareVehicleCategory: "xl",
      });
      expect(r?.label).toBe("XL");
    });

    it("si requestedVehicleCategory es inválido, se usa legacy válido", () => {
      const r = resolveRequestedDisplay({
        requestedVehicleCategory: "bogus",
        vehicleCategory: "extra_luggage",
      });
      expect(r?.label).toBe("Extra Maleta");
    });

    it("notes se usa solo después de campos estructurados", () => {
      const r = resolveRequestedDisplay({
        notes: "Vehículo seleccionado: XL",
      });
      expect(r?.label).toBe("XL");
    });

    it("13. no inventa standard cuando dato desconocido", () => {
      const r = resolveRequestedDisplay({});
      expect(r).toBeNull();
    });
  });

  describe("resolveAssignedDisplay — estados del viaje", () => {
    it("assigned válido siempre tiene prioridad independiente del status", () => {
      const a = resolveAssignedDisplay({ assignedVehicleCategory: "xl", status: "requested" });
      expect(a.label).toBe("XL");
      expect(a.pending).toBe(false);
    });

    it("scheduled sin conductor → Pendiente de asignación", () => {
      const a = resolveAssignedDisplay({ status: "scheduled" });
      expect(a.label).toBe("Pendiente de asignación");
      expect(a.pending).toBe(true);
    });

    it("requested sin conductor → Pendiente de asignación", () => {
      const a = resolveAssignedDisplay({ status: "requested" });
      expect(a.label).toBe("Pendiente de asignación");
      expect(a.pending).toBe(true);
    });

    it("accepted sin snapshot → Sin información histórica", () => {
      const a = resolveAssignedDisplay({ status: "accepted", driverUserId: "d1" });
      expect(a.label).toBe("Sin información histórica");
      expect(a.pending).toBe(false);
    });

    it("driver_en_route sin snapshot → Sin información histórica", () => {
      const a = resolveAssignedDisplay({ status: "driver_en_route" });
      expect(a.label).toBe("Sin información histórica");
    });

    it("driver_arrived sin snapshot → Sin información histórica", () => {
      const a = resolveAssignedDisplay({ status: "driver_arrived" });
      expect(a.label).toBe("Sin información histórica");
    });

    it("in_progress sin snapshot → Sin información histórica", () => {
      const a = resolveAssignedDisplay({ status: "in_progress" });
      expect(a.label).toBe("Sin información histórica");
    });

    it("completed sin snapshot → Sin información histórica", () => {
      const a = resolveAssignedDisplay({ status: "completed" });
      expect(a.label).toBe("Sin información histórica");
    });

    it("cancelled con conductor (post-asignación) sin snapshot → Sin información histórica", () => {
      const a = resolveAssignedDisplay({ status: "cancelled", driverUserId: "driver-123" });
      expect(a.label).toBe("Sin información histórica");
    });

    it("cancelled sin conductor (pre-asignación) → No asignado", () => {
      const a = resolveAssignedDisplay({ status: "cancelled" });
      expect(a.label).toBe("No asignado");
      expect(a.pending).toBe(false);
    });

    it("estado desconocido sin conductor → salida neutral, no pendiente", () => {
      const a = resolveAssignedDisplay({ status: "some_future_state" });
      expect(a.label).toBe("Sin información");
      expect(a.pending).toBe(false);
    });

    it("luggage histórico asignado se muestra como Extra Maleta", () => {
      const a = resolveAssignedDisplay({ assignedVehicleCategory: "luggage", status: "completed" });
      expect(a.label).toBe("Extra Maleta");
    });

    it("no inventa standard cuando snapshot ausente en viaje finalizado", () => {
      const a = resolveAssignedDisplay({ status: "completed" });
      expect(a.label).not.toBe("Estándar");
    });
  });

  describe("integración en componentes vivos", () => {
    it("11. pasajero TripsPage usa VehicleCategorySnapshots", () => {
      expect(tripsSource).toContain("VehicleCategorySnapshots");
      expect(tripsSource).toContain("from \"../../../features/rides/VehicleCategorySnapshots");
    });

    it("12. administración usa VehicleCategorySnapshots", () => {
      expect(adminSource).toContain("VehicleCategorySnapshots");
      expect(adminSource).toContain("from \"../../features/rides/VehicleCategorySnapshots");
    });

    it("pasajero pasa driverUserId al componente", () => {
      expect(tripsSource).toContain("driverUserId={ride.driverUserId}");
    });

    it("admin pasa driverUserId al componente", () => {
      expect(adminSource).toContain("driverUserId={ride.driverUserId}");
    });
  });
});
