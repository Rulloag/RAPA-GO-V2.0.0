import { describe, expect, it } from "vitest";
import { buildFlowerLeiOpsWhatsAppBody } from "../flowerLeiNotify.service.js";

describe("WhatsApp ops — reserva con collares", () => {
  it("incluye cantidad, recargo y categoría de vehículo", () => {
    const body = buildFlowerLeiOpsWhatsAppBody({
      reservationId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      passengerName: "Ana",
      passengerPhone: "+56911111111",
      passengerEmail: "ana@test.local",
      flowerLeiQuantity: 3,
      unitPriceClp: 4000,
      surchargeClp: 12000,
      requestedVehicleCategory: "comfort",
      scheduledAt: "2026-08-23T16:00:00.000Z",
      leadMs: 5 * 60 * 60 * 1000,
      originText: "Aeropuerto Mataveri",
      destinationText: "Hotel Taha Tai",
    });

    expect(body).toContain("NUEVA RESERVA CON COLLARES");
    expect(body).toContain("Cantidad de collares:* 3");
    expect(body).toMatch(/Recargo collares:.*12[.\s]?000/);
    expect(body).toContain("Categoría de vehículo:* comfort");
    expect(body).toContain("conductores disponibles");
  });
});
