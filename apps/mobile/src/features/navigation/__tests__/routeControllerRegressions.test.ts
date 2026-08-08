import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regresiones de dos fallos que dejaban el mapa en blanco sin cobertura,
 * detectados simulando un viaje real en Rapa Nui.
 *
 * Ambos tests fallan contra la versión anterior del controlador.
 */

const nativeStore = vi.hoisted(() => new Map<string, string>());
const networkState = vi.hoisted(() => ({
  connected: true,
  listener: null as ((status: { connected: boolean }) => void) | null,
  /** Retardo del "disco" para reproducir la carrera con la hidratación. */
  readDelayMs: 0,
}));

vi.mock("@capacitor/preferences", () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => {
      if (networkState.readDelayMs > 0) {
        await new Promise((r) => setTimeout(r, networkState.readDelayMs));
      }
      return { value: nativeStore.get(key) ?? null };
    },
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
      _e: string,
      handler: (status: { connected: boolean }) => void,
    ) => {
      networkState.listener = handler;
      return { remove: () => { networkState.listener = null; } };
    },
  },
}));

const { createRouteController } = await import("../routeController.js");
const { encodePath, buildRouteKey } = await import("../routeSerialization.js");
const { resetRouteCacheForTests } = await import("../routeCache.js");
const { NAVIGATION_ROUTE_SCHEMA_VERSION } = await import("../navigationRoute.types.js");
const { RAPA_NUI, RUTA_HANGA_ROA_ANAKENA, PolylineFalsa, esperar } =
  await import("./rapaNuiSimulation.js");

const STORAGE_KEY = "rapago_navigation_routes_v1";
const mapa = { id: "mapa" };

let polylines: InstanceType<typeof PolylineFalsa>[] = [];
let llamadas = 0;

function instalarGoogle(): void {
  polylines = [];
  llamadas = 0;

  class PolylineRegistrada extends PolylineFalsa {
    constructor(o: Record<string, unknown>) { super(o); polylines.push(this); }
  }

  (globalThis as Record<string, unknown>).google = {
    maps: {
      Polyline: PolylineRegistrada,
      DirectionsService: class {
        route(_p: unknown, cb: (r: unknown, s: string) => void): void {
          llamadas += 1;
          cb(
            {
              routes: [{
                legs: [{
                  distance: { value: 14500 },
                  duration: { value: 1300 },
                  steps: [{
                    path: RUTA_HANGA_ROA_ANAKENA,
                    start_location: RAPA_NUI.hangaRoa,
                    end_location: RAPA_NUI.anakena,
                    instructions: "Camino a Anakena",
                    maneuver: "straight",
                    distance: { value: 14500 },
                    duration: { value: 1300 },
                  }],
                }],
              }],
            },
            "OK",
          );
        }
      },
      DirectionsStatus: { OK: "OK" },
      TravelMode: { DRIVING: "DRIVING" },
      TrafficModel: { BEST_GUESS: "BEST_GUESS" },
    },
  };
  (globalThis as Record<string, unknown>).window = globalThis;
}

function controlador() {
  return createRouteController({
    getMap: () => mapa as unknown as google.maps.Map,
    strokeColor: "#4F46E5",
  });
}

beforeEach(() => {
  nativeStore.clear();
  networkState.connected = true;
  networkState.listener = null;
  networkState.readDelayMs = 0;
  resetRouteCacheForTests();
  instalarGoogle();
});

describe("cambio de tramo sin cobertura", () => {
  it("no deja el mapa en blanco al pasar de recogida a destino", async () => {
    // El pasajero sube al auto en Anakena, donde no hay señal. La app cambia
    // de fase y la clave de caché cambia con ella: antes eso ejecutaba
    // clearRoute() y el conductor se quedaba sin ruta todo el regreso.
    const controller = controlador();
    await esperar();

    controller.setTarget(
      { rideId: "viaje-1", phase: "to_pickup", destination: RAPA_NUI.anakena },
      RAPA_NUI.hangaRoa,
    );
    await esperar();

    const polyline = polylines[0];
    expect(polyline.map).toBe(mapa);

    networkState.connected = false;
    networkState.listener?.({ connected: false });
    await esperar();

    controller.setTarget(
      { rideId: "viaje-1", phase: "to_destination", destination: RAPA_NUI.hangaRoa },
      RAPA_NUI.anakena,
    );
    await esperar();

    expect(polyline.vecesDesmontada).toBe(0);
    expect(polyline.map).toBe(mapa);
    expect(controller.getPath().length).toBeGreaterThan(1);
    expect(controller.getSnapshot().status).toBe("ready");
    expect(controller.getSnapshot().isStale).toBe(true);

    controller.destroy();
  });

  it("sí limpia al cambiar de tramo con cobertura", async () => {
    // Con señal la ruta de reemplazo llega enseguida, así que conservar la
    // anterior sería mostrar un trazado que ya no corresponde.
    const controller = controlador();
    await esperar();

    controller.setTarget(
      { rideId: "viaje-1", phase: "to_pickup", destination: RAPA_NUI.anakena },
      RAPA_NUI.hangaRoa,
    );
    await esperar();

    controller.setTarget(
      { rideId: "viaje-1", phase: "to_destination", destination: RAPA_NUI.hangaRoa },
      RAPA_NUI.anakena,
    );
    await esperar();

    expect(llamadas).toBe(2);
    expect(controller.getSnapshot().status).toBe("ready");

    controller.destroy();
  });
});

describe("carrera con la hidratación de la caché", () => {
  it("espera al disco antes de decidir que no hay ruta", async () => {
    // setTarget llega antes de que la caché esté en memoria. Antes, el fallo
    // de caché era definitivo: borraba la ruta y salía a la red creyéndose
    // online por el valor inicial, con el teléfono sin cobertura.
    const clave = buildRouteKey("viaje-1", "to_pickup", RAPA_NUI.anakena);

    nativeStore.set(STORAGE_KEY, JSON.stringify([{
      key: clave,
      version: NAVIGATION_ROUTE_SCHEMA_VERSION,
      rideId: "viaje-1",
      phase: "to_pickup",
      origin: RAPA_NUI.hangaRoa,
      destination: RAPA_NUI.anakena,
      encodedPath: encodePath(RUTA_HANGA_ROA_ANAKENA),
      steps: [],
      distanceMeters: 14500,
      durationSeconds: 1300,
      computedAt: Date.now(),
      source: "network",
    }]));

    networkState.connected = false;
    networkState.readDelayMs = 25;

    const controller = controlador();

    // Sin esperar nada: es el arranque en frío real de la pantalla.
    controller.setTarget(
      { rideId: "viaje-1", phase: "to_pickup", destination: RAPA_NUI.anakena },
      RAPA_NUI.hangaRoa,
    );

    await new Promise((r) => setTimeout(r, 120));

    expect(llamadas).toBe(0);
    expect(controller.getPath()).toHaveLength(RUTA_HANGA_ROA_ANAKENA.length);
    expect(controller.getSnapshot().status).toBe("ready");
    expect(polylines[0]?.map).toBe(mapa);

    controller.destroy();
  });
});

describe("prefetch del tramo siguiente", () => {
  it("deja lista la ruta al destino mientras todavía hay señal", async () => {
    // Así el cambio de fase en zona muerta encuentra la ruta en caché en vez
    // de depender de una red que ya no está.
    const controller = controlador();
    await esperar();

    const listo = await controller.prefetch(
      { rideId: "viaje-1", phase: "to_destination", destination: RAPA_NUI.hangaRoa },
      RAPA_NUI.anakena,
    );

    expect(listo).toBe(true);
    // Se guardó pero no se dibujó: el tramo activo sigue siendo el otro.
    expect(polylines).toHaveLength(0);

    networkState.connected = false;
    networkState.listener?.({ connected: false });
    await esperar();

    controller.setTarget(
      { rideId: "viaje-1", phase: "to_destination", destination: RAPA_NUI.hangaRoa },
      RAPA_NUI.anakena,
    );
    await esperar();

    expect(controller.getSnapshot().status).toBe("ready");
    expect(controller.getPath().length).toBeGreaterThan(1);

    controller.destroy();
  });
});
