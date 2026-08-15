import { inflateSync } from "node:zlib";
import { afterEach, describe, expect, it, vi } from "vitest";

import { decodePngToRgb, encodePngRgb } from "../rideReceiptMapPng.js";
import {
  buildGoogleStaticMapUrl,
  decodeGooglePolyline,
  encodeGooglePolyline,
  fitReceiptMapBounds,
  normalizeReceiptRoute,
  RideReceiptMapService,
  type ReceiptMapImage,
} from "../rideReceiptMap.service.js";
import { generateRideReceiptPdf } from "../rideReceiptPdf.service.js";

function samplePdf(map: ReceiptMapImage) {
  return generateRideReceiptPdf({
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
}

function osmTilePng(): Buffer {
  const rgb = Buffer.alloc(256 * 256 * 3);
  for (let index = 0; index < rgb.length; index += 3) {
    rgb[index] = 210;
    rgb[index + 1] = 220;
    rgb[index + 2] = 180;
  }
  return encodePngRgb(256, 256, rgb);
}

describe("RAPA GO ride receipt map", () => {
  const originalProvider = process.env["RIDE_RECEIPTS_MAP_PROVIDER"];
  const originalGoogleKey = process.env["GOOGLE_MAPS_API_KEY"];

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();

    if (originalProvider === undefined) {
      delete process.env["RIDE_RECEIPTS_MAP_PROVIDER"];
    } else {
      process.env["RIDE_RECEIPTS_MAP_PROVIDER"] = originalProvider;
    }

    if (originalGoogleKey === undefined) {
      delete process.env["GOOGLE_MAPS_API_KEY"];
    } else {
      process.env["GOOGLE_MAPS_API_KEY"] = originalGoogleKey;
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

  it("round-trips a PNG tile used by the OSM receipt map", () => {
    const rgb = Buffer.alloc(16 * 16 * 3);
    for (let index = 0; index < rgb.length; index += 3) {
      rgb[index] = 12;
      rgb[index + 1] = 34;
      rgb[index + 2] = 56;
    }

    const decoded = decodePngToRgb(encodePngRgb(16, 16, rgb));

    expect(decoded?.width).toBe(16);
    expect(decoded?.height).toBe(16);
    expect(decoded?.rgb.subarray(0, 3).equals(Buffer.from([12, 34, 56]))).toBe(
      true,
    );
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

  it("round-trips a Google polyline around Rapa Nui", () => {
    const points = [
      { lat: -27.1486, lng: -109.4324 },
      { lat: -27.1474, lng: -109.4302 },
      { lat: -27.1422, lng: -109.4217 },
    ];
    const decoded = decodeGooglePolyline(encodeGooglePolyline(points));

    expect(decoded).toHaveLength(points.length);
    expect(decoded[0]!.lat).toBeCloseTo(points[0]!.lat, 4);
    expect(decoded[0]!.lng).toBeCloseTo(points[0]!.lng, 4);
    expect(decoded.at(-1)!.lat).toBeCloseTo(points[2]!.lat, 4);
  });

  it("widens a tiny trip so the static map shows island roads, not a 7 m zoom", () => {
    const bounds = fitReceiptMapBounds([
      { lat: -27.1549, lng: -109.4323 },
      { lat: -27.15496, lng: -109.43225 },
    ]);

    expect(bounds.maxLat - bounds.minLat).toBeGreaterThanOrEqual(0.024);
    expect(bounds.maxLng - bounds.minLng).toBeGreaterThanOrEqual(0.024);
    expect(bounds.minLat).toBeLessThan(-27.14);
    expect(bounds.maxLat).toBeGreaterThan(-27.17);
    expect(bounds.minLng).toBeLessThan(-109.42);
    expect(bounds.maxLng).toBeGreaterThan(-109.44);
  });

  it("builds a Google Static Maps URL with the fitted Rapa Nui viewport", () => {
    const origin = { lat: -27.1486, lng: -109.4324 };
    const destination = { lat: -27.1422, lng: -109.4217 };
    const url = buildGoogleStaticMapUrl(
      [origin, { lat: -27.1454, lng: -109.4271 }, destination],
      origin,
      destination,
      "test-key",
    );

    const decoded = decodeURIComponent(url);

    expect(url).toContain("maps.googleapis.com/maps/api/staticmap");
    expect(url).toContain("visible=");
    expect(decoded).toContain("enc:");
    expect(decoded).toContain("-27.");
    expect(decoded).toContain("-109.");
    expect(decoded).toContain("label:R");
    expect(decoded).toContain("label:D");
    expect(url).toContain("key=test-key");
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

    const pdf = samplePdf(map);
    const pdfText = pdf.toString("latin1");

    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(pdfText).toContain("COMPROBANTE DE VIAJE");
    expect(pdfText).toContain("/Subtype /Image");
    expect(pdfText.match(/\/Type \/Page\b/g)).toHaveLength(1);
    expect(map.provider).toBe("route_sketch");
    expect(map.routePointCount).toBeGreaterThanOrEqual(5);
    expect(pdf.length).toBeGreaterThan(8_000);
  });

  it("uses OpenStreetMap tiles when Google Static Maps is missing or rejected", async () => {
    process.env["GOOGLE_MAPS_API_KEY"] = "invalid-server-key";
    process.env["RIDE_RECEIPTS_MAP_PROVIDER"] = "google";

    const tile = osmTilePng();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("tile.openstreetmap.org")) {
        return new Response(tile, {
          status: 200,
          headers: { "content-type": "image/png" },
        });
      }

      return new Response("denied", { status: 403 });
    });
    vi.stubGlobal("fetch", fetchMock);

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

    const pixels = inflateSync(map.data);
    const hasOsmLand = pixels.includes(210) && pixels.includes(180);
    const pdf = samplePdf(map);
    const pdfText = pdf.toString("latin1");

    expect(map.provider).toBe("osm_tiles");
    expect(hasOsmLand).toBe(true);
    expect(fetchMock).toHaveBeenCalled();
    expect(
      fetchMock.mock.calls.some((call) =>
        String(call[0]).includes("maps.googleapis.com/maps/api/staticmap"),
      ),
    ).toBe(true);
    expect(
      fetchMock.mock.calls.some((call) =>
        String(call[0]).includes("tile.openstreetmap.org"),
      ),
    ).toBe(true);
    expect(pdfText).toContain("OpenStreetMap");
    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("falls back to the local sketch if OSM tiles also fail", async () => {
    process.env["RIDE_RECEIPTS_MAP_PROVIDER"] = "osm";
    delete process.env["GOOGLE_MAPS_API_KEY"];

    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 503 })));

    const map = await new RideReceiptMapService().render({
      origin: { lat: -27.1486, lng: -109.4324 },
      destination: { lat: -27.1422, lng: -109.4217 },
      points: [
        { lat: -27.1486, lng: -109.4324 },
        { lat: -27.1422, lng: -109.4217 },
      ],
    });

    expect(map.provider).toBe("route_sketch");
  });
});
