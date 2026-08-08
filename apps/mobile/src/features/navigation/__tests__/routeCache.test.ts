import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  NAVIGATION_ROUTE_SCHEMA_VERSION,
  type NavigationRoute,
} from "../navigationRoute.types.js";

// Almacén nativo simulado. Capacitor no está registrado en jsdom, así que sin
// esto el módulo caería siempre al respaldo de localStorage y nunca probaría
// la ruta real de persistencia.
const store = vi.hoisted(() => new Map<string, string>());

vi.mock("@capacitor/preferences", () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => ({ value: store.get(key) ?? null }),
    set: async ({ key, value }: { key: string; value: string }) => {
      store.set(key, value);
    },
    remove: async ({ key }: { key: string }) => {
      store.delete(key);
    },
  },
}));

const {
  clearRouteCache,
  getCachedRoute,
  hydrateRouteCache,
  resetRouteCacheForTests,
  saveRoute,
} = await import("../routeCache.js");

const STORAGE_KEY = "rapago_navigation_routes_v1";

function makeRoute(overrides: Partial<NavigationRoute> = {}): NavigationRoute {
  return {
    key: "ride-1:to_destination:-27.14550,-109.42880",
    version: NAVIGATION_ROUTE_SCHEMA_VERSION,
    rideId: "ride-1",
    phase: "to_destination",
    origin: { lat: -27.15, lng: -109.43 },
    destination: { lat: -27.1455, lng: -109.4288 },
    encodedPath: "_p~iF~ps|U_ulLnnqC",
    steps: [],
    distanceMeters: 1200,
    durationSeconds: 240,
    computedAt: 1_700_000_000_000,
    source: "network",
    ...overrides,
  };
}

beforeEach(() => {
  store.clear();
  resetRouteCacheForTests();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("lectura síncrona desde memoria", () => {
  it("devuelve la ruta recién guardada sin esperar al disco", () => {
    // El render es síncrono: si esta lectura necesitara un await, la ruta
    // parpadearía en cada montaje. Por eso L1 no es una optimización.
    const route = makeRoute();
    saveRoute(route);

    expect(getCachedRoute(route.key)).toEqual(route);
  });

  it("devuelve null para una clave desconocida", () => {
    expect(getCachedRoute("no-existe")).toBeNull();
  });
});

describe("persistencia en el almacén nativo", () => {
  it("escribe a disco de forma diferida", async () => {
    saveRoute(makeRoute());

    // Aún no: la escritura está agrupada para no golpear el disco en cada fix.
    expect(store.get(STORAGE_KEY)).toBeUndefined();

    await vi.advanceTimersByTimeAsync(500);

    expect(store.get(STORAGE_KEY)).toBeDefined();
  });

  it("agrupa varias escrituras seguidas en una sola", async () => {
    saveRoute(makeRoute({ key: "a" }));
    saveRoute(makeRoute({ key: "b" }));
    saveRoute(makeRoute({ key: "c" }));

    await vi.advanceTimersByTimeAsync(500);

    expect(JSON.parse(store.get(STORAGE_KEY) ?? "[]")).toHaveLength(3);
  });

  it("rehidrata en un arranque en frío", async () => {
    // El caso que motiva todo: la app se reabre sin señal y la ruta tiene que
    // estar ahí antes de que la red pueda decir nada.
    const route = makeRoute();
    store.set(STORAGE_KEY, JSON.stringify([route]));

    await hydrateRouteCache();

    const restored = getCachedRoute(route.key);
    expect(restored).not.toBeNull();
    expect(restored?.encodedPath).toBe(route.encodedPath);
    expect(restored?.source).toBe("storage");
  });

  it("descarta entradas de un esquema anterior", async () => {
    store.set(
      STORAGE_KEY,
      JSON.stringify([makeRoute({ version: 999 }), makeRoute({ key: "valida" })]),
    );

    await hydrateRouteCache();

    expect(getCachedRoute("ride-1:to_destination:-27.14550,-109.42880")).toBeNull();
    expect(getCachedRoute("valida")).not.toBeNull();
  });

  it("no lanza con contenido corrupto", async () => {
    store.set(STORAGE_KEY, "{esto no es json");

    await expect(hydrateRouteCache()).resolves.toBeUndefined();
  });

  it("hidrata una sola vez aunque se llame de más", async () => {
    store.set(STORAGE_KEY, JSON.stringify([makeRoute()]));

    await Promise.all([hydrateRouteCache(), hydrateRouteCache(), hydrateRouteCache()]);

    expect(getCachedRoute("ride-1:to_destination:-27.14550,-109.42880")).not.toBeNull();
  });
});

describe("límite de entradas", () => {
  it("conserva solo las rutas más recientes", async () => {
    for (let index = 0; index < 8; index += 1) {
      saveRoute(makeRoute({ key: `ruta-${index}`, computedAt: 1_700_000_000_000 + index }));
    }

    await vi.advanceTimersByTimeAsync(500);

    expect(JSON.parse(store.get(STORAGE_KEY) ?? "[]")).toHaveLength(5);
    expect(getCachedRoute("ruta-7")).not.toBeNull();
    expect(getCachedRoute("ruta-0")).toBeNull();
  });
});

describe("clearRouteCache", () => {
  it("borra memoria y disco al cerrar sesión", async () => {
    // Las rutas revelan origen y destino de los viajes: no pueden sobrevivir a
    // un cambio de cuenta en el mismo teléfono.
    const route = makeRoute();
    saveRoute(route);
    await vi.advanceTimersByTimeAsync(500);

    await clearRouteCache();

    expect(getCachedRoute(route.key)).toBeNull();
    expect(store.get(STORAGE_KEY)).toBeUndefined();
  });

  it("cancela una escritura diferida en vuelo", async () => {
    saveRoute(makeRoute());
    await clearRouteCache();
    await vi.advanceTimersByTimeAsync(500);

    expect(store.get(STORAGE_KEY)).toBeUndefined();
  });
});
