import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../../components/MapFallback.js", () => ({
  MapFallback: () => null,
  loadRapaGoGoogleMaps: vi.fn().mockResolvedValue(undefined),
}));

import {
  getGooglePredictions,
  getPlaceDetailsExact,
  resetRapaNuiAutocompleteCaches,
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
  /* El autocompletado recuerda lo ya preguntado. Sin vaciarlo, una consulta
     repetida se resolvería con lo guardado y el SDK simulado no llegaría a
     recibir la llamada que la prueba está contando. */
  resetRapaNuiAutocompleteCaches();

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
        PlacesServiceStatus: { OK: "OK", ZERO_RESULTS: "ZERO_RESULTS" },
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
    mockPredictions([{ place_id: "p2", description: "Hotel Taha Tai" }]);
    const results = await getGooglePredictions("taha t");

    expect(getPlacePredictionsSpy).toHaveBeenCalledTimes(1);
    expect(getDetailsSpy).not.toHaveBeenCalled();
    expect(
      results.some(
        (r) =>
          r.placeId === "p2" || /taha tai/i.test(`${r.mainText} ${r.description}`),
      ),
    ).toBe(true);
  });

  it("un lugar que está en el catálogo y en Google sale UNA vez, la nuestra", async () => {
    /* Anakena está en los dos sitios. Antes salía repetida —"Anakena ·
       Sugerencia RAPA GO" seguida de "Anakena · Rapa Nui, Chile"— porque la
       clave de deduplicación incluía el subtítulo, y esos dos nunca coinciden.

       Gana la del catálogo: trae coordenadas curadas, así que al tocarla el
       viaje queda listo sin pedirle a Google los detalles. */
    mockPredictions([{ place_id: "p-anakena", description: "Anakena" }]);
    const results = await getGooglePredictions("anak");

    const anakenas = results.filter((r) => r.mainText === "Anakena");
    expect(anakenas).toHaveLength(1);
    expect(anakenas[0].placeId).not.toBe("p-anakena");
    expect(anakenas[0].secondaryText).toContain("Sugerencia RAPA GO");
  });

  it("no vuelve a preguntar por algo que ya preguntó", async () => {
    /* Escribir "anakena" son siete pulsaciones y borrar una letra es otra
       más. Repetir la consulta no puede costar otra llamada. */
    mockPredictions([{ place_id: "p4", description: "Ahu Tongariki" }]);

    const first = await getGooglePredictions("tongarik");
    const again = await getGooglePredictions("tongarik");
    // Mismo texto con otras mayúsculas y un espacio de más: misma consulta.
    const variant = await getGooglePredictions("  TONGARIK ");

    expect(getPlacePredictionsSpy).toHaveBeenCalledTimes(1);
    expect(again).toEqual(first);
    expect(variant).toEqual(first);
  });

  it("una consulta pedida dos veces a la vez viaja una sola vez", async () => {
    /* Origen y destino comparten la caché. Si los dos campos piden lo mismo
       antes de que llegue la respuesta, se espera a la que ya iba. */
    let settle: ((value: unknown) => void) | undefined;
    getPlacePredictionsSpy.mockImplementationOnce((_request, callback) => {
      settle = () =>
        callback(
          [
            {
              place_id: "p5",
              description: "Rano Raraku",
              structured_formatting: {
                main_text: "Rano Raraku",
                secondary_text: "Rapa Nui, Chile",
              },
            },
          ],
          "OK",
        );
    });

    const a = getGooglePredictions("rano rar");
    const b = getGooglePredictions("rano rar");

    /* La carga del SDK está detrás de un await, así que el mock todavía no ha
       corrido cuando estas dos llamadas vuelven. Se cede el turno antes de
       soltar la respuesta. */
    await new Promise((resolve) => setTimeout(resolve, 0));
    settle?.(undefined);

    const [resultA, resultB] = await Promise.all([a, b]);

    expect(getPlacePredictionsSpy).toHaveBeenCalledTimes(1);
    expect(resultA).toEqual(resultB);
  });

  it("un fallo de Google no se queda guardado", async () => {
    /* Guardar el error congelaría el bache de red hasta que el pasajero
       cambiara de búsqueda. Se devuelve el catálogo local y se vuelve a
       intentar en cuanto haya otra ocasión. */
    getPlacePredictionsSpy.mockImplementationOnce((_request, callback) => {
      callback(null, "OVER_QUERY_LIMIT");
    });
    mockPredictions([{ place_id: "p6", description: "Playa Ovahe" }]);

    await getGooglePredictions("ovahe");
    const retry = await getGooglePredictions("ovahe");

    expect(getPlacePredictionsSpy).toHaveBeenCalledTimes(2);
    expect(retry.some((r) => r.placeId === "p6")).toBe(true);
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
