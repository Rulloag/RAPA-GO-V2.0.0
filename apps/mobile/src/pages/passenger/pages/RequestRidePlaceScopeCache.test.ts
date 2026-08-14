import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../../components/MapFallback.js", () => ({
  MapFallback: () => null,
  loadRapaGoGoogleMaps: vi.fn().mockResolvedValue(undefined),
}));

import { isGooglePlaceInsideRapaNui } from "./RequestRidePage.js";

let getDetailsSpy: ReturnType<typeof vi.fn>;

// insideRapaNui decide qué coordenadas simular; isGooglePlaceInsideRapaNui
// evalúa el resultado real con isPointInsideRapaNuiServiceArea, así que
// usamos coordenadas obviamente dentro/fuera de la isla.
function mockPlace(insideRapaNui: boolean) {
  const lat = insideRapaNui ? -27.15 : 40.0;
  const lng = insideRapaNui ? -109.43 : -3.7;

  getDetailsSpy.mockImplementationOnce((_req, callback) => {
    callback(
      { geometry: { location: { lat: () => lat, lng: () => lng } } },
      "OK",
    );
  });
}

beforeEach(() => {
  getDetailsSpy = vi.fn();

  (globalThis as any).google = {
    maps: {
      places: {
        PlacesService: class {
          getDetails = getDetailsSpy;
        },
        PlacesServiceStatus: { OK: "OK" },
      },
    },
  };
});

describe("cache de isGooglePlaceInsideRapaNui (autocomplete origen/destino)", () => {
  it("A) placeId nuevo -> 1 getDetails real", async () => {
    mockPlace(true);
    const result = await isGooglePlaceInsideRapaNui("place-A");
    expect(getDetailsSpy).toHaveBeenCalledTimes(1);
    expect(result).toBe(true);
  });

  it("B) mismo placeId repetido -> cache, sin llamadas adicionales", async () => {
    mockPlace(true);
    await isGooglePlaceInsideRapaNui("place-B");
    await isGooglePlaceInsideRapaNui("place-B");
    await isGooglePlaceInsideRapaNui("place-B");
    expect(getDetailsSpy).toHaveBeenCalledTimes(1);
  });

  it("C) resultado 'dentro de Rapa Nui' se cachea", async () => {
    mockPlace(true);
    const first = await isGooglePlaceInsideRapaNui("place-C");
    const second = await isGooglePlaceInsideRapaNui("place-C");
    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(getDetailsSpy).toHaveBeenCalledTimes(1);
  });

  it("D) resultado 'fuera de Rapa Nui' también se cachea", async () => {
    mockPlace(false);
    const first = await isGooglePlaceInsideRapaNui("place-D");
    const second = await isGooglePlaceInsideRapaNui("place-D");
    expect(first).toBe(false);
    expect(second).toBe(false);
    expect(getDetailsSpy).toHaveBeenCalledTimes(1);
  });

  it("E) dos requests concurrentes al mismo placeId -> 1 getDetails real", async () => {
    mockPlace(true);
    const [a, b] = await Promise.all([
      isGooglePlaceInsideRapaNui("place-E"),
      isGooglePlaceInsideRapaNui("place-E"),
    ]);
    expect(getDetailsSpy).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it("F) sin TTL por diseño: el cache sigue vigente pase el tiempo que pase", async () => {
    vi.useFakeTimers();
    mockPlace(true);
    await isGooglePlaceInsideRapaNui("place-F");
    vi.advanceTimersByTime(60 * 60 * 1000); // 1 hora
    const result = await isGooglePlaceInsideRapaNui("place-F");
    expect(getDetailsSpy).toHaveBeenCalledTimes(1);
    expect(result).toBe(true);
    vi.useRealTimers();
  });

  it("G) límite de 240 entradas -> eviction FIFO funciona", async () => {
    for (let i = 0; i < 240; i += 1) {
      mockPlace(true);
      await isGooglePlaceInsideRapaNui(`fill-${i}`);
    }
    mockPlace(true);
    await isGooglePlaceInsideRapaNui("fill-240");

    // fill-0 debió ser desalojado: pedirlo de nuevo dispara un getDetails real.
    const callsBefore = getDetailsSpy.mock.calls.length;
    mockPlace(true);
    await isGooglePlaceInsideRapaNui("fill-0");
    expect(getDetailsSpy.mock.calls.length).toBe(callsBefore + 1);
  });

  it("H) origen y destino reutilizan el mismo cache para el mismo placeId", async () => {
    mockPlace(true);
    const fromOriginFlow = await isGooglePlaceInsideRapaNui("place-H-shared");
    const fromDestinationFlow =
      await isGooglePlaceInsideRapaNui("place-H-shared");
    expect(fromOriginFlow).toBe(fromDestinationFlow);
    expect(getDetailsSpy).toHaveBeenCalledTimes(1);
  });
});
