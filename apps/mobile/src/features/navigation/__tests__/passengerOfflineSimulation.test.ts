import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  RAPA_NUI,
  RUTA_HANGA_ROA_ANAKENA,
  desinstalarGoogleMaps,
  esperar,
  generarTrazaGps,
  hayCobertura,
  instalarGoogleMaps,
  type ControlesGoogle,
} from "./rapaNuiSimulation.js";
import type { RouteSnapshot } from "../routeController.js";

/**
 * Simulación desde el lado del PASAJERO.
 *
 * Escenario real: el pasajero espera en la playa de Anakena, en el extremo
 * norte de Rapa Nui, donde no hay señal móvil. El conductor sale de Hanga Roa
 * a buscarlo, ~18 km por el camino interior. Lo que el pasajero mira todo ese
 * rato es `PassengerDriverLiveMap`, que se apoya en el mismo `RouteController`
 * que la pantalla del conductor.
 *
 * La diferencia con la simulación del conductor es de quién es la conexión que
 * se cae: aquí el `RouteController` corre en el teléfono del PASAJERO, así que
 * `isOnline` refleja la cobertura de Anakena, no la del conductor. El pasajero
 * no puede recalcular nada, solo puede seguir viendo lo que ya tenía.
 */

const almacenNativo = vi.hoisted(() => new Map<string, string>());
const estadoRed = vi.hoisted(() => ({
  connected: true,
  listener: null as ((status: { connected: boolean }) => void) | null,
}));

vi.mock("@capacitor/preferences", () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => ({ value: almacenNativo.get(key) ?? null }),
    set: async ({ key, value }: { key: string; value: string }) => {
      almacenNativo.set(key, value);
    },
    remove: async ({ key }: { key: string }) => {
      almacenNativo.delete(key);
    },
  },
}));

vi.mock("@capacitor/network", () => ({
  Network: {
    getStatus: async () => ({ connected: estadoRed.connected }),
    addListener: async (
      _event: string,
      handler: (status: { connected: boolean }) => void,
    ) => {
      estadoRed.listener = handler;
      return { remove: () => { estadoRed.listener = null; } };
    },
  },
}));

const { createRouteController } = await import("../routeController.js");
const { resetRouteCacheForTests } = await import("../routeCache.js");
const { OFF_ROUTE_METERS } = await import("../reroutePolicy.js");

/** Viaje simulado: recogida en Anakena, conductor saliendo de Hanga Roa. */
const ID_VIAJE = "viaje-anakena-01";

const OBJETIVO_RECOGIDA = {
  rideId: ID_VIAJE,
  phase: "to_pickup" as const,
  destination: RAPA_NUI.anakena,
};

let controles: ControlesGoogle;
let instantaneas: RouteSnapshot[] = [];

/**
 * Crea el controlador tal como lo instancia `PassengerDriverLiveMap`: mismo
 * color y grosor de línea, y un `onChange` que hace las veces del `useState`
 * de la pantalla, para poder revisar después TODO lo que vio el pasajero y no
 * solo el estado final.
 */
function crearMapaDelPasajero() {
  return createRouteController({
    getMap: () => controles.mapa as google.maps.Map,
    strokeColor: "#00b7ff",
    strokeWeight: 7,
    onChange: (instantanea) => {
      instantaneas.push(instantanea);
    },
  });
}

/** Sube o baja la cobertura del teléfono del PASAJERO. */
function cambiarCobertura(conectado: boolean): void {
  estadoRed.connected = conectado;
  estadoRed.listener?.({ connected: conectado });
}

/**
 * La caché escribe a disco con debounce de 400 ms. Para simular un cierre de
 * app hay que dejar que esa escritura ocurra de verdad, no basta `esperar()`.
 */
function esperarEscrituraEnDisco(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 500));
}

beforeEach(() => {
  estadoRed.connected = true;
  estadoRed.listener = null;
  almacenNativo.clear();
  resetRouteCacheForTests();
  instantaneas = [];
  controles = instalarGoogleMaps(RUTA_HANGA_ROA_ANAKENA);
});

afterEach(() => {
  desinstalarGoogleMaps();
});

describe("el pasajero espera en Anakena con cobertura todavía disponible", () => {
  it("ve la ruta del conductor dibujada y su posición proyectada sobre ella", async () => {
    const controlador = crearMapaDelPasajero();
    await esperar();

    controlador.setTarget(OBJETIVO_RECOGIDA, RAPA_NUI.hangaRoa);
    await esperar();

    expect(controles.llamadas()).toBe(1);
    expect(controles.polylines).toHaveLength(1);
    expect(controles.polylines[0].map).toBe(controles.mapa);
    expect(controlador.getPath().length).toBeGreaterThan(1);

    const alDibujar = controlador.getSnapshot();
    expect(alDibujar.status).toBe("ready");
    // isStale false significa "esto acaba de llegar de la red": es el único
    // caso en que la pantalla NO debe mostrar el aviso de ruta guardada.
    expect(alDibujar.isStale).toBe(false);

    // El conductor arranca. Cada fix suyo llega al pasajero por el canal de
    // tiempo real y entra al controlador como nueva posición de origen.
    const traza = generarTrazaGps(RUTA_HANGA_ROA_ANAKENA);
    controlador.updatePosition(traza[0]);
    const alSalir = controlador.getSnapshot();

    controlador.updatePosition(traza[Math.floor(traza.length / 2)]);
    const aMitadDeCamino = controlador.getSnapshot();

    expect(alSalir.snappedPoint).not.toBeNull();
    expect(aMitadDeCamino.snappedPoint).not.toBeNull();

    // El fix va sobre el camino, así que la proyección cae prácticamente
    // encima: si esto pasara de OFF_ROUTE_METERS el controlador creería que el
    // conductor se desvió y pediría ruta nueva sin necesidad.
    expect(aMitadDeCamino.distanceToRouteMeters!).toBeLessThan(OFF_ROUTE_METERS);

    // La cuenta regresiva que ve el pasajero baja sola, con cálculo local.
    expect(aMitadDeCamino.remainingMeters!).toBeLessThan(alSalir.remainingMeters!);
    expect(aMitadDeCamino.etaSeconds!).toBeGreaterThan(0);

    // Seguir al conductor no cuesta ni una petición extra.
    expect(controles.llamadas()).toBe(1);

    controlador.destroy();
  });
});

describe("el pasajero pierde la cobertura en Anakena", () => {
  it("no desmonta la polyline del mapa mientras el conductor se acerca", async () => {
    // Punto de partida del escenario: Anakena queda fuera del radio de señal
    // y Hanga Roa dentro. Si esto cambiara, la simulación dejaría de
    // representar el problema que el módulo resuelve.
    expect(hayCobertura(RAPA_NUI.anakena)).toBe(false);
    expect(hayCobertura(RAPA_NUI.hangaRoa)).toBe(true);

    const controlador = crearMapaDelPasajero();
    await esperar();

    controlador.setTarget(OBJETIVO_RECOGIDA, RAPA_NUI.hangaRoa);
    await esperar();

    const linea = controles.polylines[0];
    const llamadasConSenal = controles.llamadas();

    // A partir de aquí se audita todo lo que la pantalla llegó a recibir.
    instantaneas = [];

    cambiarCobertura(false);
    await esperar();

    // El conductor recorre los 18 km completos. El pasajero no tiene datos:
    // las posiciones que le llegaron antes del corte y su ruta local son todo
    // lo que hay, y con eso tiene que seguir funcionando el mapa.
    const traza = generarTrazaGps(RUTA_HANGA_ROA_ANAKENA);
    for (const punto of traza) controlador.updatePosition(punto);

    // El pasajero, nervioso, hace pull-to-refresh sobre el mapa.
    controlador.refresh();
    await esperar();

    // La aserción central: nadie llamó a setMap(null). Antes de este módulo,
    // el manejador de error del Directions borraba el trazado y el pasajero
    // se quedaba mirando un mapa vacío justo cuando más lo necesitaba.
    expect(linea.vecesDesmontada).toBe(0);
    expect(linea.map).toBe(controles.mapa);
    expect(controles.polylines).toHaveLength(1);

    // Sin señal no se intenta ni una petición, ni siquiera con el refresh
    // manual: no hay a quién preguntarle.
    expect(controles.llamadas()).toBe(llamadasConSenal);

    const sinSenal = controlador.getSnapshot();
    expect(sinSenal.status).toBe("ready");
    expect(sinSenal.isOnline).toBe(false);
    expect(sinSenal.route).not.toBeNull();
    expect(controlador.getPath().length).toBeGreaterThan(1);

    // El conductor llegó a Anakena: el pasajero lo vio llegar sin internet.
    expect(sinSenal.remainingMeters!).toBeLessThan(50);

    // Y no hubo parpadeo: ninguna de las instantáneas emitidas durante todo el
    // tramo sin señal dejó la ruta en null ni sacó el estado de "ready". Eso
    // es lo que garantiza que la línea no desaparezca ni por un frame.
    expect(instantaneas.length).toBeGreaterThan(0);
    expect(instantaneas.every((estado) => estado.route !== null)).toBe(true);
    expect(instantaneas.every((estado) => estado.status === "ready")).toBe(true);

    // A la pantalla sí se le avisa que está offline, para el cartel de aviso.
    expect(instantaneas.some((estado) => !estado.isOnline)).toBe(true);

    controlador.destroy();
  });
});

describe("el pasajero reabre la app sin cobertura", () => {
  it("rehidrata la ruta desde la caché sin llamar a Directions API", async () => {
    // Sesión 1: el pasajero pidió el viaje cuando aún tenía señal, así que la
    // ruta se calculó una vez y bajó a almacenamiento nativo.
    const primeraSesion = crearMapaDelPasajero();
    await esperar();

    primeraSesion.setTarget(OBJETIVO_RECOGIDA, RAPA_NUI.hangaRoa);
    await esperar();
    expect(controles.llamadas()).toBe(1);

    await esperarEscrituraEnDisco();
    expect(almacenNativo.size).toBe(1);

    primeraSesion.destroy();

    // Cierre de la app (Android mata el proceso en segundo plano): la caché en
    // memoria se pierde, el almacenamiento nativo no. `resetRouteCacheForTests`
    // vacía L1 sin tocar el disco, que es justo ese estado.
    resetRouteCacheForTests();
    controles = instalarGoogleMaps(RUTA_HANGA_ROA_ANAKENA);
    instantaneas = [];
    cambiarCobertura(false);

    // Sesión 2: el pasajero reabre la app ya en Anakena, sin datos.
    const segundaSesion = crearMapaDelPasajero();

    // La hidratación desde disco es asíncrona. En la app real el mapa tarda
    // mucho más en cargar el SDK de Google que lo que tarda esta lectura, por
    // eso el orden natural es hidratar primero y fijar el destino después.
    await esperar();

    segundaSesion.setTarget(OBJETIVO_RECOGIDA, RAPA_NUI.hangaRoa);
    await esperar();

    // Cero peticiones: la ruta que se ve nunca pasó por la red en esta sesión.
    expect(controles.llamadas()).toBe(0);

    expect(controles.polylines).toHaveLength(1);
    expect(controles.polylines[0].map).toBe(controles.mapa);
    expect(controles.polylines[0].vecesDesmontada).toBe(0);

    // La geometría rehidratada es la misma que se guardó: el ida y vuelta por
    // polyline codificada no pierde vértices.
    expect(segundaSesion.getPath()).toHaveLength(RUTA_HANGA_ROA_ANAKENA.length);

    const alReabrir = segundaSesion.getSnapshot();
    expect(alReabrir.status).toBe("ready");
    expect(alReabrir.route?.source).toBe("storage");
    // isStale true porque viene del disco y no se pudo revalidar: la pantalla
    // muestra el aviso de "última ruta calculada" sin ocultar la línea.
    expect(alReabrir.isStale).toBe(true);
    expect(alReabrir.isOnline).toBe(false);
    expect(alReabrir.remainingMeters).not.toBeNull();

    segundaSesion.destroy();
  });
});

describe("al pasajero le vuelve la cobertura", () => {
  it("no redibuja desde cero si el destino no cambió", async () => {
    const controlador = crearMapaDelPasajero();
    await esperar();

    controlador.setTarget(OBJETIVO_RECOGIDA, RAPA_NUI.hangaRoa);
    await esperar();
    expect(controles.llamadas()).toBe(1);

    const linea = controles.polylines[0];
    const rutaDibujada = controlador.getPath();

    cambiarCobertura(false);
    await esperar();

    const traza = generarTrazaGps(RUTA_HANGA_ROA_ANAKENA);
    for (const punto of traza.slice(0, 100)) controlador.updatePosition(punto);

    // Un jirón de señal: el teléfono reengancha a la red.
    cambiarCobertura(true);
    await esperar();

    // Reconectar solo revalida. La ruta local sigue fresca y el destino es el
    // mismo, así que no hay nada que preguntar: gastar una petición aquí sería
    // el patrón viejo de recalcular ante cualquier evento de red.
    expect(controles.llamadas()).toBe(1);

    // La pantalla del pasajero se remonta al recuperar datos y vuelve a fijar
    // el mismo objetivo. Tampoco eso puede provocar una petición.
    controlador.setTarget(OBJETIVO_RECOGIDA, RAPA_NUI.hangaRoa);
    await esperar();

    expect(controles.llamadas()).toBe(1);
    expect(controles.polylines).toHaveLength(1);
    expect(linea.vecesDesmontada).toBe(0);
    // Misma geometría exacta: no hubo redibujado, ni siquiera uno idéntico.
    expect(controlador.getPath()).toEqual(rutaDibujada);
    expect(controlador.getSnapshot().status).toBe("ready");

    controlador.destroy();
  });

  it("sí recalcula cuando el viaje arranca y el destino pasa a ser otro", async () => {
    // Contraste del caso anterior: lo que evita la petición es que el destino
    // sea el mismo, no que se haya perdido y recuperado la conexión.
    const controlador = crearMapaDelPasajero();
    await esperar();

    controlador.setTarget(OBJETIVO_RECOGIDA, RAPA_NUI.hangaRoa);
    await esperar();
    expect(controles.llamadas()).toBe(1);

    // El pasajero sube al auto y el viaje pasa a in_progress: ahora la ruta
    // que le interesa es Anakena -> Hanga Roa.
    controles.definirRuta([...RUTA_HANGA_ROA_ANAKENA].reverse());
    controlador.setTarget(
      {
        rideId: ID_VIAJE,
        phase: "to_destination",
        destination: RAPA_NUI.hangaRoa,
      },
      RAPA_NUI.anakena,
    );
    await esperar();

    expect(controles.llamadas()).toBe(2);
    // Se reutiliza la misma instancia de polyline: se le cambia el trazado en
    // vez de crear otra, así el mapa no acumula líneas por cada fase.
    expect(controles.polylines).toHaveLength(1);
    expect(controlador.getPath()[0].lat).toBeCloseTo(RAPA_NUI.anakena.lat, 4);
    expect(controlador.getSnapshot().status).toBe("ready");
    expect(controlador.getSnapshot().isStale).toBe(false);

    controlador.destroy();
  });
});

describe("fallos del servicio de rutas mientras el pasajero mira el mapa", () => {
  it("conserva la ruta y la marca como rancia ante un fallo de transporte", async () => {
    const controlador = crearMapaDelPasajero();
    await esperar();

    controlador.setTarget(OBJETIVO_RECOGIDA, RAPA_NUI.hangaRoa);
    await esperar();

    const linea = controles.polylines[0];
    const rutaAntesDelFallo = controlador.getPath();
    instantaneas = [];

    // UNKNOWN_ERROR es lo que devuelve el SDK cuando la petición no llegó a
    // destino: timeout, DNS caído, la antena de Hanga Roa saturada. No dice
    // nada sobre si la ruta existe, así que la ruta buena sigue siendo válida.
    controles.responder("UNKNOWN_ERROR");
    controlador.refresh();
    await esperar();

    const trasElFallo = controlador.getSnapshot();
    expect(trasElFallo.status).toBe("ready");
    expect(trasElFallo.isStale).toBe(true);
    // Sin mensaje de error: teniendo ruta dibujada no hay nada que disculpar,
    // el aviso de "ruta guardada" lo cubre el flag isStale.
    expect(trasElFallo.error).toBeNull();
    expect(trasElFallo.route).not.toBeNull();

    expect(linea.vecesDesmontada).toBe(0);
    expect(linea.map).toBe(controles.mapa);
    expect(controlador.getPath()).toEqual(rutaAntesDelFallo);
    expect(instantaneas.every((estado) => estado.route !== null)).toBe(true);

    controlador.destroy();
  });

  it("deja el estado en unavailable si ZERO_RESULTS llega sin ruta previa", async () => {
    // ZERO_RESULTS es un fallo semántico: Google respondió y dijo que entre
    // esos dos puntos no hay ruta manejable. Sin nada dibujado que preservar,
    // fingir que se está calculando dejaría al pasajero esperando para siempre.
    controles.responder("ZERO_RESULTS");

    const controlador = crearMapaDelPasajero();
    await esperar();

    controlador.setTarget(OBJETIVO_RECOGIDA, RAPA_NUI.hangaRoa);
    await esperar();

    const sinRuta = controlador.getSnapshot();
    expect(sinRuta.status).toBe("unavailable");
    // isStale false: no hay copia local que mostrar, no es una ruta "vieja".
    expect(sinRuta.isStale).toBe(false);
    expect(sinRuta.route).toBeNull();
    expect(sinRuta.error).toContain("No se encontró una ruta");

    expect(controlador.getPath()).toHaveLength(0);
    // Ni siquiera se creó la polyline: nunca hubo geometría que dibujar.
    expect(controles.polylines).toHaveLength(0);

    controlador.destroy();
  });
});
