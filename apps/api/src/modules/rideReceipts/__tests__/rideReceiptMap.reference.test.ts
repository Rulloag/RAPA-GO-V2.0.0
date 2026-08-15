import { describe, expect, it } from "vitest";

import {
  fitReceiptMapBounds,
  normalizeReceiptRoute,
} from "../rideReceiptMap.service.js";

describe("RideReceiptMapService route fallback", () => {
  it("uses pickup and destination when recorded GPS trace is practically stationary", () => {
    const origin = { lat: -27.1549, lng: -109.4323 };
    const destination = { lat: -27.1472, lng: -109.4251 };
    const route = normalizeReceiptRoute(
      [
        { lat: -27.15490, lng: -109.43230 },
        { lat: -27.15489, lng: -109.43229 },
      ],
      origin,
      destination,
    );

    expect(route).toEqual([origin, destination]);
  });

  it("keeps a real recorded route when GPS has meaningful movement", () => {
    const origin = { lat: -27.1549, lng: -109.4323 };
    const destination = { lat: -27.1472, lng: -109.4251 };
    const middle = { lat: -27.1510, lng: -109.4290 };
    const route = normalizeReceiptRoute(
      [origin, middle, destination],
      origin,
      destination,
    );

    expect(route.length).toBeGreaterThanOrEqual(3);
    expect(route[1]).toEqual(middle);
  });

  it("fits a short Rapa Nui trip with enough span to show roads", () => {
    const bounds = fitReceiptMapBounds([
      { lat: -27.1549, lng: -109.4323 },
      { lat: -27.1472, lng: -109.4251 },
    ]);

    expect(bounds.maxLat - bounds.minLat).toBeGreaterThan(0.007);
    expect(bounds.minLng).toBeLessThan(-109.42);
    expect(bounds.maxLng).toBeGreaterThan(-109.43);
  });
});
