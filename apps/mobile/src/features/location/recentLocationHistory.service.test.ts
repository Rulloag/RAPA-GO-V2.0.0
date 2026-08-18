import { afterEach, describe, expect, it } from "vitest";

import {
  RECENT_LOCATION_TTL_MS,
  recentLocationHistoryService,
} from "./recentLocationHistory.service";

const STORAGE_KEY = "rapago_recent_locations_v1";

afterEach(() => {
  localStorage.removeItem(STORAGE_KEY);
});

describe("recentLocationHistoryService", () => {
  it("recuerda y lista ubicaciones recientes", () => {
    recentLocationHistoryService.remember({
      name: "Hospital de Hanga Roa",
      formattedAddress: "Hanga Roa, Rapa Nui",
      lat: -27.15,
      lng: -109.43,
      placeId: "rapago-local:hospital-hanga-roa",
    });

    expect(recentLocationHistoryService.list()[0]?.name).toBe(
      "Hospital de Hanga Roa",
    );
  });

  it("expira entradas viejas", () => {
    const expired = {
      placeId: null,
      name: "Viejo",
      formattedAddress: "Viejo",
      lat: -27.1,
      lng: -109.4,
      usedAt: new Date(Date.now() - RECENT_LOCATION_TTL_MS - 1000).toISOString(),
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify([expired]));
    expect(recentLocationHistoryService.list()).toEqual([]);
  });

  it("clear elimina todo el historial", () => {
    recentLocationHistoryService.remember({
      name: "Anakena",
      lat: -27.07,
      lng: -109.32,
    });
    recentLocationHistoryService.clear();
    expect(recentLocationHistoryService.list()).toEqual([]);
  });
});
