import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Prueba del comportamiento que motiva todo el módulo: al caerse la red, la
 * ruta dibujada tiene que quedarse en pantalla.
 */

const nativeStore = vi.hoisted(() => new Map<string, string>());
const networkState = vi.hoisted(() => ({
  connected: true,
  listener: null as ((status: { connected: boolean }) => void) | null,
}));

vi.mock("@capacitor/preferences", () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => ({ value: nativeStore.get(key) ?? null }),
    set: async ({ key, value }: { key: string; value: string }) => {
      nativeStore.set(key, value);
    },
    remove: async ({ key }: { key: string }) => {
      nativeStore.delete(key);
    },
  },
}));

vi.mock("@capacitor/network", () => ({
  Network: {
    getStatus: async () => ({ connected: networkState.connected }),
    addListener: async (
      _event: string,
      handler: (status: { connected: boolean }) => void,
    ) => {
      networkState.listener = handler;
      return { remove: () => { networkState.listener = null; } };
    },
  },
}));

const { createRouteController } = await import("../routeController.js");
const { encodePath } = await import("../routeSerialization.js");
const { resetRouteCacheForTests, saveRoute } = await import("../routeCache.js");
const { NAVIGATION_ROUTE_SCHEMA_VERSION } = await import("../navigationRoute.types.js");

const PICKUP = { lat: -27.15, lng: -109.43 };
const DESTINATION = { lat: -27.15, lng: -109.428 };
const PATH = [PICKUP, { lat: -27.15, lng: -109.429 }, DESTINATION];

/** Polyline de Google simulada, para observar si algo la borra del mapa. */
class FakePolyline {
  path: unknown = null;
  map: unknown = null;
  options: Record<string, unknown> = {};

  constructor(options: Record<string, unknown>) {
    this.options = options;
    instances.push(this);
  }

  setPath(path: unknown): void {
    this.path = path;
  }

  setMap(map: unknown): void {
    this.map = map;
  }

  setOptions(options: Record<string, unknown>): void {
    this.options = { ...this.options, ...options };
  }
}

let instances: FakePolyline[] = [];
let routeCalls = 0;
let nextResponse: { status: string; ok: boolean } = { status: "OK", ok: true };

function directionsResult(): unknown {
  return {
    routes: [
      {
        legs: [
          {
            distance: { value: 200, text: "0,2 km" },
            duration: { value: 40, text: "1 min" },
            steps: [
              {
                path: PATH,
                start_location: PICKUP,
                end_location: DESTINATION,
                instructions: "Continúa por Av. Pont",
                maneuver: "straight",
                distance: { value: 200 },
                duration: { value: 40 },
              },
            ],
          },
        ],
      },
    ],
  };
}

function installGoogleMaps(): void {
  (globalThis as Record<string, unknown>).google = {
    maps: {
      Polyline: FakePolyline,
      DirectionsService: class {
        route(
          _request: unknown,
          callback: (result: unknown, status: string) => void,
        ): void {
          routeCalls += 1;
          const response = nextResponse;
          callback(response.ok ? directionsResult() : null, response.status);
        }
      },
      DirectionsStatus: { OK: "OK" },
      TravelMode: { DRIVING: "DRIVING" },
      TrafficModel: { BEST_GUESS: "BEST_GUESS" },
    },
  };

  (globalThis as Record<string, unknown>).window = globalThis;
}

const fakeMap = { id: "map" };

/** Deja correr las promesas pendientes del controlador. */
async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  instances = [];
  routeCalls = 0;
  nextResponse = { status: "OK", ok: true };
  networkState.connected = true;
  networkState.listener = null;
  nativeStore.clear();
  resetRouteCacheForTests();
  installGoogleMaps();
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).google;
});

function makeController() {
  return createRouteController({
    getMap: () => fakeMap as unknown as google.maps.Map,
    strokeColor: "#4F46E5",
  });
}

describe("dibujo inicial", () => {
  it("pide la ruta y la dibuja", async () => {
    const controller = makeController();
    await flush();

    controller.setTarget(
      { rideId: "ride-1", phase: "to_destination", destination: DESTINATION },
      PICKUP,
    );
    await flush();

    expect(routeCalls).toBe(1);
    expect(instances).toHaveLength(1);
    expect(instances[0].map).toBe(fakeMap);
    expect(controller.getPath().length).toBeGreaterThan(1);
    expect(controller.getSnapshot().status).toBe("ready");

    controller.destroy();
  });

  it("no vuelve a la red si el destino no cambió", async () => {
    // Es lo que evita gastar datos al remontar la pantalla o al cambiar de
    // Wi-Fi a datos móviles con el mismo viaje.
    const controller = makeController();
    await flush();

    const target = {
      rideId: "ride-1",
      phase: "to_destination" as const,
      destination: DESTINATION,
    };

    controller.setTarget(target, PICKUP);
    await flush();
    controller.setTarget(target, PICKUP);
    controller.setTarget(target, PICKUP);
    await flush();

    expect(routeCalls).toBe(1);

    controller.destroy();
  });
});

describe("caída de red", () => {
  it("mantiene la ruta dibujada cuando falla la petición", async () => {
    // El comportamiento central: antes esta rama ejecutaba
    // renderer.set("directions", null) y la ruta desaparecía de la pantalla.
    const controller = makeController();
    await flush();

    controller.setTarget(
      { rideId: "ride-1", phase: "to_destination", destination: DESTINATION },
      PICKUP,
    );
    await flush();

    const polyline = instances[0];
    expect(polyline.map).toBe(fakeMap);

    // Se cae la red y se fuerza un intento.
    nextResponse = { status: "UNKNOWN_ERROR", ok: false };
    controller.refresh();
    await flush();

    expect(polyline.map).toBe(fakeMap);
    expect(controller.getPath().length).toBeGreaterThan(1);
    expect(controller.getSnapshot().status).toBe("ready");
    expect(controller.getSnapshot().isStale).toBe(true);

    controller.destroy();
  });

  it("no intenta siquiera ir a la red estando sin conexión", async () => {
    networkState.connected = false;

    const controller = makeController();
    await flush();

    controller.setTarget(
      { rideId: "ride-1", phase: "to_destination", destination: DESTINATION },
      PICKUP,
    );
    await flush();

    expect(routeCalls).toBe(0);

    controller.destroy();
  });

  it("dibuja desde la caché en un arranque sin conexión", async () => {
    // Caso "app reabierta en zona sin cobertura": la ruta aparece sin que la
    // red haya podido decir nada.
    saveRoute({
      key: "ride-1:to_destination:-27.15000,-109.42800",
      version: NAVIGATION_ROUTE_SCHEMA_VERSION,
      rideId: "ride-1",
      phase: "to_destination",
      origin: PICKUP,
      destination: DESTINATION,
      encodedPath: encodePath(PATH),
      steps: [],
      distanceMeters: 200,
      durationSeconds: 40,
      computedAt: Date.now(),
      source: "network",
    });

    networkState.connected = false;

    const controller = makeController();
    await flush();

    controller.setTarget(
      { rideId: "ride-1", phase: "to_destination", destination: DESTINATION },
      PICKUP,
    );
    await flush();

    expect(routeCalls).toBe(0);
    expect(instances).toHaveLength(1);
    expect(instances[0].map).toBe(fakeMap);
    expect(controller.getPath()).toHaveLength(3);
    expect(controller.getSnapshot().status).toBe("ready");

    controller.destroy();
  });

  it("revalida al recuperar la conexión", async () => {
    networkState.connected = false;

    const controller = makeController();
    await flush();

    controller.setTarget(
      { rideId: "ride-1", phase: "to_destination", destination: DESTINATION },
      PICKUP,
    );
    await flush();
    expect(routeCalls).toBe(0);

    networkState.connected = true;
    networkState.listener?.({ connected: true });
    await flush();

    expect(routeCalls).toBe(1);

    controller.destroy();
  });
});

describe("progreso local sin red", () => {
  it("actualiza la distancia restante sin volver a la red", async () => {
    const controller = makeController();
    await flush();

    controller.setTarget(
      { rideId: "ride-1", phase: "to_destination", destination: DESTINATION },
      PICKUP,
    );
    await flush();

    const callsAfterDraw = routeCalls;
    const inicial = controller.getSnapshot().remainingMeters;

    networkState.connected = false;
    networkState.listener?.({ connected: false });

    // Avanza por la ruta: la distancia debe bajar solo con cálculo local.
    controller.updatePosition({ lat: -27.15, lng: -109.429 });
    const medio = controller.getSnapshot().remainingMeters;

    controller.updatePosition({ lat: -27.15, lng: -109.4285 });
    const final = controller.getSnapshot().remainingMeters;

    expect(inicial).not.toBeNull();
    expect(medio!).toBeLessThan(inicial!);
    expect(final!).toBeLessThan(medio!);
    expect(routeCalls).toBe(callsAfterDraw);

    controller.destroy();
  });

  it("no recalcula por moverse dentro de la ruta", async () => {
    // Antes, cada fix de GPS a más de 3 m disparaba una petición: ~50 por
    // minuto. Aquí 40 fixes sobre la ruta no deben generar ninguna.
    const controller = makeController();
    await flush();

    controller.setTarget(
      { rideId: "ride-1", phase: "to_destination", destination: DESTINATION },
      PICKUP,
    );
    await flush();

    const callsAfterDraw = routeCalls;

    for (let index = 0; index < 40; index += 1) {
      controller.updatePosition({ lat: -27.15, lng: -109.43 + index * 0.00005 });
    }

    expect(routeCalls).toBe(callsAfterDraw);

    controller.destroy();
  });
});
