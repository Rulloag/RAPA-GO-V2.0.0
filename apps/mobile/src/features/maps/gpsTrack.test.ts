import { describe, expect, it } from "vitest";

import {
  areMapBoundsSane,
  filterGpsTrack,
  isValidRideMapPoint,
  parseLatLng,
  trackDistanceMeters,
} from "../../../../../packages/shared/src/utils/geo";

describe("parseLatLng / isValidRideMapPoint", () => {
  it("rechaza undefined, NaN y (0,0)", () => {
    expect(parseLatLng(undefined, undefined)).toBeNull();
    expect(parseLatLng(Number.NaN, Number.NaN)).toBeNull();
    expect(parseLatLng(null, null)).toBeNull();
    expect(parseLatLng(0, 0)).toBeNull();
    expect(isValidRideMapPoint(0, 0)).toBe(false);
    expect(isValidRideMapPoint(null, null)).toBe(false);
  });

  it("acepta un punto de Rapa Nui", () => {
    expect(isValidRideMapPoint(-27.15, -109.43)).toBe(true);
  });

  it("rechaza África / Null Island aunque Number(null) sea 0", () => {
    expect(isValidRideMapPoint(Number(null), Number(null))).toBe(false);
  });
});

describe("filterGpsTrack", () => {
  it("descarta un salto a África y conserva Rapa Nui", () => {
    const filtered = filterGpsTrack([
      { lat: -27.15, lng: -109.43, capturedAt: "2026-08-16T18:00:00.000Z" },
      { lat: -27.151, lng: -109.431, capturedAt: "2026-08-16T18:00:04.000Z" },
      { lat: 0.12, lng: 0.08, capturedAt: "2026-08-16T18:00:08.000Z" },
      { lat: -27.152, lng: -109.432, capturedAt: "2026-08-16T18:00:12.000Z" },
    ]);

    expect(filtered).toHaveLength(3);
    expect(filtered.every((point) => point.lat < -26)).toBe(true);
  });

  it("no guarda cientos de puntos idénticos", () => {
    const filtered = filterGpsTrack(
      Array.from({ length: 40 }, () => ({
        lat: -27.15,
        lng: -109.43,
        capturedAt: "2026-08-16T18:00:00.000Z",
      })),
    );

    expect(filtered).toHaveLength(1);
  });
});

describe("areMapBoundsSane", () => {
  it("rechaza Rapa Nui + (0,0) para no abrir el mapa mundial", () => {
    expect(
      areMapBoundsSane([
        { lat: -27.15, lng: -109.43 },
        { lat: 0, lng: 0 },
      ]),
    ).toBe(false);
  });

  it("acepta un tramo corto en la isla", () => {
    expect(
      areMapBoundsSane([
        { lat: -27.15, lng: -109.43 },
        { lat: -27.16, lng: -109.42 },
      ]),
    ).toBe(true);
    expect(
      trackDistanceMeters([
        { lat: -27.15, lng: -109.43 },
        { lat: -27.151, lng: -109.431 },
      ]),
    ).toBeGreaterThan(0);
  });
});
