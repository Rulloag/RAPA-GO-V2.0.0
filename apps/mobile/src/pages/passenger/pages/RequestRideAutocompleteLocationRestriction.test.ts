import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../../components/MapFallback.js", () => ({
  MapFallback: () => null,
  loadRapaGoGoogleMaps: vi.fn().mockResolvedValue(undefined),
}));

import {
  getGooglePredictions,
  getPlaceDetailsExact,
} from "./RequestRidePage.js";

let getPlacePredictionsSpy: ReturnType<typeof vi.fn>;
let getDetailsSpy: ReturnType<typeof vi.fn>;
let lastPredictionsRequest: Record<string, unknown> | undefined;

function mockPredictions(
  predictions: Array<{ place_id: string; description: string }>,
) {
  getPlacePredictionsSpy.mockImplementationOnce((request, callback) => {
    lastPredictionsRequest = request;
    callback(
      predictions.map((p) => ({
        place_id: p.place_id,
        description: p.description,
        structured_formatting: {
          main_text: p.description,
          secondary_text: "Rapa Nui, Chile",
        },
      })),
      "OK",
    );
  });
}

// Dentro/fuera de la zona de servicio real de Rapa Nui (RAPA_NUI_SERVICE_BOUNDS).
const INSIDE_RAPA_NUI = { lat: -27.15, lng: -109.43 };
const OUTSIDE_RAPA_NUI = { lat: 40.0, lng: -3.7 };

function mockDetails(point: { lat: number; lng: number }, name = "Lugar") {
  getDetailsSpy.mockImplementationOnce((_req, callback) => {
    callback(
      {
        name,
        formatted_address: "Dirección de prueba",
        place_id: "detail-place",
        types: ["establishment"],
        geometry: {
          location: { lat: () => point.lat, lng: () => point.lng },
        },
      },
      "OK",
    );
  });
}

beforeEach(() => {
  getPlacePredictionsSpy = vi.fn();
  getDetailsSpy = vi.fn();
  lastPredictionsRequest = undefined;

  (globalThis as any).google = {
    maps: {
      LatLng: class {
        constructor(public lat: number, public lng: number) {}
      },
      LatLngBounds: class {
        constructor(
          public sw: { lat: number; lng: number },
          public ne: { lat: number; lng: number },
        ) {}
      },
      places: {
        AutocompleteService: class {
          getPlacePredictions = getPlacePredictionsSpy;
        },
        PlacesService: class {
          getDetails = getDetailsSpy;
        },
        PlacesServiceStatus: { OK: "OK" },
      },
    },
  };
});

describe("autocomplete origen/destino con locationRestriction", () => {
  it("1) escribir origen: 1 autocomplete, 0 getDetails antes de mostrar sugerencias", async () => {
    mockPredictions([{ place_id: "p1", description: "Restaurant Te Moana" }]);
    const results = await getGooglePredictions("te mo");

    expect(getPlacePredictionsSpy).toHaveBeenCalledTimes(1);
    expect(getDetailsSpy).not.toHaveBeenCalled();
    expect(results.some((r) => r.placeId === "p1")).toBe(true);
  });

  it("2) escribir destino: mismo comportamiento, 1 autocomplete, 0 getDetails", async () => {
    mockPredictions([{ place_id: "p2", description: "Anakena" }]);
    const results = await getGooglePredictions("anak");

    expect(getPlacePredictionsSpy).toHaveBeenCalledTimes(1);
    expect(getDetailsSpy).not.toHaveBeenCalled();
    expect(results.some((r) => r.placeId === "p2")).toBe(true);
  });

  it("usa locationRestriction (no bounds/location/radius deprecados)", async () => {
    mockPredictions([{ place_id: "p3", description: "Cualquiera" }]);
    await getGooglePredictions("cualq");

    expect(lastPredictionsRequest).toBeDefined();
    expect(lastPredictionsRequest).toHaveProperty("locationRestriction");
    expect(lastPredictionsRequest).not.toHaveProperty("bounds");
    expect(lastPredictionsRequest).not.toHaveProperty("location");
    expect(lastPredictionsRequest).not.toHaveProperty("radius");
  });

  it("3) seleccionar sugerencia válida: 1 getDetails, selección exitosa", async () => {
    mockDetails(INSIDE_RAPA_NUI, "Playa Anakena");
    const result = await getPlaceDetailsExact("valid-place-id");

    expect(getDetailsSpy).toHaveBeenCalledTimes(1);
    expect(result).not.toBeNull();
    expect(result?.text).toBe("Playa Anakena");
    expect(result?.lat).toBe(INSIDE_RAPA_NUI.lat);
  });

  it("4) seleccionar resultado fuera de Rapa Nui: sigue bloqueado en getPlaceDetailsExact", async () => {
    mockDetails(OUTSIDE_RAPA_NUI, "Lugar en Madrid");
    const result = await getPlaceDetailsExact("outside-place-id");

    expect(getDetailsSpy).toHaveBeenCalledTimes(1);
    expect(result).toBeNull();
  });
});
