import { distanceMeters } from "../routeProgress.js";
import type { LatLng } from "../../maps/maps.types.js";

/**
 * Arnés de simulación de un viaje real en Rapa Nui.
 *
 * Reproduce el caso que motiva todo el módulo de navegación offline: un viaje
 * que arranca en Hanga Roa (único punto de la isla con cobertura móvil
 * estable) y se interna en el interior, donde la señal desaparece.
 *
 * Las coordenadas son reales para que el escenario sea representativo: las
 * distancias, la duración del tramo sin señal y la cantidad de fixes de GPS
 * son las de un trayecto de verdad, no las de una maqueta.
 */

export const RAPA_NUI = {
  /** Centro de Hanga Roa. Único núcleo urbano de la isla. */
  hangaRoa: { lat: -27.15, lng: -109.4333 },
  aeropuertoMataveri: { lat: -27.1648, lng: -109.4218 },
  punaPau: { lat: -27.1339, lng: -109.4028 },
  ahuAkivi: { lat: -27.1156, lng: -109.3992 },
  /** Playa de Anakena, extremo norte. Sin cobertura. */
  anakena: { lat: -27.0733, lng: -109.3236 },
  /** Cantera de moais, sureste. Sin cobertura. */
  ranoRaraku: { lat: -27.1222, lng: -109.2886 },
  ahuTongariki: { lat: -27.1258, lng: -109.2769 },
} as const satisfies Record<string, LatLng>;

/**
 * Trazado por carretera de Hanga Roa a Anakena.
 *
 * Sigue el camino real que sale al norte del pueblo, pasa cerca de Puna Pau y
 * Ahu Akivi y baja a la playa. Son ~18 km, el trayecto turístico más común de
 * la isla y justo el que atraviesa la zona sin señal.
 */
export const RUTA_HANGA_ROA_ANAKENA: LatLng[] = [
  { lat: -27.15, lng: -109.4333 },
  { lat: -27.1477, lng: -109.4309 },
  { lat: -27.144, lng: -109.428 },
  { lat: -27.1398, lng: -109.4176 },
  { lat: -27.1339, lng: -109.4028 },
  { lat: -27.1256, lng: -109.4011 },
  { lat: -27.1156, lng: -109.3992 },
  { lat: -27.1078, lng: -109.3874 },
  { lat: -27.1, lng: -109.37 },
  { lat: -27.0932, lng: -109.3562 },
  { lat: -27.09, lng: -109.35 },
  { lat: -27.0821, lng: -109.3378 },
  { lat: -27.0733, lng: -109.3236 },
];

/**
 * Radio de cobertura alrededor de Hanga Roa, en metros.
 *
 * En Rapa Nui la señal móvil se concentra en el pueblo y se pierde a los pocos
 * kilómetros: el interior y la costa norte quedan sin datos. 3 km es una
 * aproximación conservadora del borde real.
 */
export const RADIO_COBERTURA_METROS = 3000;

/** ¿Hay señal móvil en este punto de la isla? */
export function hayCobertura(punto: LatLng): boolean {
  return distanceMeters(punto, RAPA_NUI.hangaRoa) <= RADIO_COBERTURA_METROS;
}

/**
 * Genera la traza de GPS que emitiría el teléfono del conductor.
 *
 * Interpola puntos intermedios sobre el trazado para simular fixes a ~1 Hz a
 * velocidad de ciudad/carretera, que es lo que dispara la lógica de progreso.
 */
export function generarTrazaGps(ruta: LatLng[], metrosPorFix = 40): LatLng[] {
  const traza: LatLng[] = [];

  for (let index = 0; index < ruta.length - 1; index += 1) {
    const desde = ruta[index];
    const hasta = ruta[index + 1];
    const tramo = distanceMeters(desde, hasta);
    const pasos = Math.max(1, Math.round(tramo / metrosPorFix));

    for (let paso = 0; paso < pasos; paso += 1) {
      const t = paso / pasos;
      traza.push({
        lat: desde.lat + (hasta.lat - desde.lat) * t,
        lng: desde.lng + (hasta.lng - desde.lng) * t,
      });
    }
  }

  traza.push(ruta[ruta.length - 1]);
  return traza;
}

/** Polyline de Google simulada: permite observar si algo la borra del mapa. */
export class PolylineFalsa {
  path: LatLng[] | null = null;
  map: unknown = null;
  options: Record<string, unknown>;
  /** Cuántas veces se la desmontó del mapa. Debe quedar en 0 al perder señal. */
  vecesDesmontada = 0;

  constructor(options: Record<string, unknown>) {
    this.options = options;
  }

  setPath(path: LatLng[]): void {
    this.path = path;
  }

  setMap(map: unknown): void {
    if (map === null && this.map !== null) this.vecesDesmontada += 1;
    this.map = map;
  }

  setOptions(options: Record<string, unknown>): void {
    this.options = { ...this.options, ...options };
  }
}

export interface ControlesGoogle {
  /** Polylines creadas por el controlador. */
  polylines: PolylineFalsa[];
  /** Cuántas peticiones se hicieron a Directions API. */
  llamadas: () => number;
  /** Fuerza el estado que devolverá la próxima petición. */
  responder: (status: string) => void;
  /** Ruta que devolverá el servicio simulado. */
  definirRuta: (ruta: LatLng[]) => void;
  mapa: unknown;
}

/**
 * Instala un `window.google.maps` simulado.
 *
 * Cuenta las llamadas a Directions API, que es la métrica que demuestra que se
 * dejó atrás el recálculo cada 1,2 s.
 */
export function instalarGoogleMaps(rutaInicial: LatLng[]): ControlesGoogle {
  const polylines: PolylineFalsa[] = [];
  const mapa = { id: "mapa-rapa-nui" };

  let llamadas = 0;
  let status = "OK";
  let ruta = rutaInicial;

  class PolylineRegistrada extends PolylineFalsa {
    constructor(options: Record<string, unknown>) {
      super(options);
      polylines.push(this);
    }
  }

  function resultadoDirections(): unknown {
    const total = ruta.reduce(
      (suma, punto, index) =>
        index === 0 ? 0 : suma + distanceMeters(ruta[index - 1], punto),
      0,
    );

    return {
      routes: [
        {
          legs: [
            {
              distance: { value: Math.round(total), text: `${(total / 1000).toFixed(1)} km` },
              duration: { value: Math.round(total / 11), text: "20 min" },
              steps: [
                {
                  path: ruta,
                  start_location: ruta[0],
                  end_location: ruta[ruta.length - 1],
                  instructions: "Continúa por el camino a Anakena",
                  maneuver: "straight",
                  distance: { value: Math.round(total) },
                  duration: { value: Math.round(total / 11) },
                },
              ],
            },
          ],
        },
      ],
    };
  }

  (globalThis as Record<string, unknown>).google = {
    maps: {
      Polyline: PolylineRegistrada,
      DirectionsService: class {
        route(
          _peticion: unknown,
          callback: (resultado: unknown, status: string) => void,
        ): void {
          llamadas += 1;
          const actual = status;
          callback(actual === "OK" ? resultadoDirections() : null, actual);
        }
      },
      DirectionsStatus: { OK: "OK" },
      TravelMode: { DRIVING: "DRIVING" },
      TrafficModel: { BEST_GUESS: "BEST_GUESS" },
    },
  };

  (globalThis as Record<string, unknown>).window = globalThis;

  return {
    polylines,
    llamadas: () => llamadas,
    responder: (siguiente: string) => {
      status = siguiente;
    },
    definirRuta: (siguiente: LatLng[]) => {
      ruta = siguiente;
    },
    mapa,
  };
}

export function desinstalarGoogleMaps(): void {
  delete (globalThis as Record<string, unknown>).google;
}

/** Deja correr las promesas pendientes del controlador. */
export function esperar(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
