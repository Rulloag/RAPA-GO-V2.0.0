import { afterEach, describe, expect, it } from "vitest";

import {
  encodeGooglePolyline,
  normalizeReceiptRoute,
  RideReceiptMapService,
} from "../rideReceiptMap.service.js";
import { generateRideReceiptPdf } from "../rideReceiptPdf.service.js";

describe("RAPA GO ride receipt map", () => {
  const originalProvider = process.env["RIDE_RECEIPTS_MAP_PROVIDER"];

  afterEach(() => {
    if (originalProvider === undefined) {
      delete process.env["RIDE_RECEIPTS_MAP_PROVIDER"];
    } else {
      process.env["RIDE_RECEIPTS_MAP_PROVIDER"] = originalProvider;
    }
  });

  it("keeps the real recorded route and adds pickup/destination when needed", () => {
    const origin = { lat: -27.1486, lng: -109.4324 };
    const destination = { lat: -27.1422, lng: -109.4217 };
    const points = [
      { lat: -27.1482, lng: -109.4318 },
      { lat: -27.1474, lng: -109.4302 },
      { lat: -27.1461, lng: -109.4277 },
      { lat: -27.1444, lng: -109.4248 },
    ];

    const route = normalizeReceiptRoute(points, origin, destination);

    expect(route[0]).toEqual(origin);
    expect(route.at(-1)).toEqual(destination);
    expect(route.length).toBeGreaterThanOrEqual(points.length);
  });

  it("encodes a Google polyline without exposing the API key", () => {
    const encoded = encodeGooglePolyline([
      { lat: -27.1486, lng: -109.4324 },
      { lat: -27.1474, lng: -109.4302 },
      { lat: -27.1422, lng: -109.4217 },
    ]);

    expect(encoded.length).toBeGreaterThan(8);
    expect(encoded).not.toContain("GOOGLE");
  });

  it("generates a valid one-page PDF with the real route sketch fallback", async () => {
    process.env["RIDE_RECEIPTS_MAP_PROVIDER"] = "sketch";

    const map = await new RideReceiptMapService().render({
      origin: { lat: -27.1486, lng: -109.4324 },
      destination: { lat: -27.1422, lng: -109.4217 },
      points: [
        { lat: -27.1486, lng: -109.4324 },
        { lat: -27.1475, lng: -109.4306 },
        { lat: -27.1462, lng: -109.4284 },
        { lat: -27.1446, lng: -109.4254 },
        { lat: -27.1422, lng: -109.4217 },
      ],
    });

    const pdf = generateRideReceiptPdf({
      type: "completed_ride",
      documentNumber: "RG-VIAJE-20260731-DEMO1234",
      generatedAt: new Date("2026-07-31T20:00:00-04:00"),
      rideId: "00000000-0000-4000-8000-000000000001",
      passengerName: "Pasajero de prueba",
      passengerEmail: "pasajero@example.com",
      driverName: "Conductor de prueba",
      vehicleBrand: "Toyota",
      vehicleModel: "Yaris",
      vehicleColor: "Blanco",
      vehiclePlate: "ABCD12",
      originText: "Cabañas Rakei · Ara Piki",
      destinationText: "Playa Poko Poko · Te Pito o Te Henua",
      requestedAt: new Date("2026-07-31T19:30:00-04:00"),
      completedAt: new Date("2026-07-31T20:00:00-04:00"),
      cancelledAt: null,
      arrivedAt: new Date("2026-07-31T19:38:00-04:00"),
      distanceMeters: 5_200,
      durationSeconds: 1_320,
      amountClp: 9_500,
      paymentMethod: "cash",
      paymentStatus: "Pago en efectivo registrado al completar el viaje.",
      walletBenefitAppliedClp: 0,
      priorityFeeClp: 0,
      cancellationReason: null,
      noShowWaitMinutes: null,
      policyPercent: null,
      policyCapClp: null,
      legalDocumentTitle: null,
      legalDocumentVersion: null,
      legalAcceptedAt: null,
      map,
      supportEmail: "soporte@rapago.cl",
      supportPhone: "+56 9 4796 4171",
    });

    const pdfText = pdf.toString("latin1");

    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(pdfText).toContain("COMPROBANTE DE VIAJE");
    expect(pdfText).toContain("/Subtype /Image");
    expect(pdfText.match(/\/Type \/Page\b/g)).toHaveLength(1);
    expect(map.provider).toBe("route_sketch");
    expect(map.routePointCount).toBeGreaterThanOrEqual(5);
    expect(pdf.length).toBeGreaterThan(8_000);
  });
});
