import type { LatLng } from "../maps/maps.types.js";

/**
 * Modelo de ruta serializable e independiente del proveedor.
 *
 * A diferencia de un `google.maps.DirectionsResult` (100-200 KB, con instancias
 * de clase `LatLng` que no sobreviven a JSON.stringify/parse), este modelo es
 * texto plano y pesa 2-4 KB: la geometría viaja como polyline codificada.
 *
 * Esto es lo que permite volver a dibujar la ruta sin red, sin SDK y sin
 * volver a llamar a Directions API.
 */

/** Tramo de navegación. Determina qué punto es el destino activo. */
export type RoutePhase = "to_pickup" | "to_destination";

/** Origen del dato mostrado en pantalla. Usado para telemetría y para la UI. */
export type RouteSource = "network" | "memory" | "storage";

export interface NavStep {
  /** Instrucción ya limpia de HTML, lista para mostrar. */
  text: string;
  /** Maniobra de Google (`turn-left`, `roundabout-right`, ...) o null. */
  maneuver: string | null;
  /** Calle extraída de la instrucción, cuando se pudo determinar. */
  street: string | null;
  /** Punto donde termina el paso: permite ubicar el paso activo sin red. */
  endLocation: LatLng;
  distanceMeters: number;
  durationSeconds: number;
}

export interface NavigationRoute {
  /** Clave estable derivada de rideId + fase + destino. Ver `buildRouteKey`. */
  key: string;
  /** Versión del esquema. Permite descartar entradas viejas tras un deploy. */
  version: number;
  rideId: string;
  phase: RoutePhase;
  origin: LatLng;
  destination: LatLng;
  /** Polyline codificada (`geometry.encoding.encodePath`). La geometría real. */
  encodedPath: string;
  steps: NavStep[];
  distanceMeters: number;
  durationSeconds: number;
  /** Epoch ms en que la ruta llegó de la red. Base para decidir si está rancia. */
  computedAt: number;
  source: RouteSource;
}

/**
 * Versión actual del esquema persistido.
 * Súbela si cambia la forma de `NavigationRoute`: las entradas con otra versión
 * se descartan al leer, en vez de romper el render con datos incompatibles.
 */
export const NAVIGATION_ROUTE_SCHEMA_VERSION = 1;

/** Ruta ya rehidratada y lista para dibujar. */
export interface HydratedRoute {
  route: NavigationRoute;
  /** Geometría decodificada. Se calcula una vez y se reutiliza. */
  path: LatLng[];
}

/**
 * Clasificación del fallo al pedir una ruta.
 *
 * La distinción es la corrección central de este módulo: hoy el código trata
 * un corte de red igual que un `ZERO_RESULTS` y borra la ruta en ambos casos.
 *
 * - `semantic`: la ruta es genuinamente imposible (ZERO_RESULTS, NOT_FOUND).
 *   Es correcto limpiar la pantalla.
 * - `transport`: no supimos la respuesta (sin red, timeout, cuota). La última
 *   ruta buena sigue siendo válida y NO debe borrarse.
 */
export type RouteFailureKind = "semantic" | "transport";

export interface RouteFailure {
  kind: RouteFailureKind;
  status: string;
  message: string;
}
