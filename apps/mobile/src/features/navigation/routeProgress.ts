import type { LatLng } from "../maps/maps.types.js";
import type { NavStep, NavigationRoute } from "./navigationRoute.types.js";

/**
 * Motor de progreso local: todo lo que Waze y Google Maps calculan en el
 * dispositivo mientras avanzas, sin volver a preguntarle al servidor.
 *
 * Ninguna función de este archivo toca la red ni el SDK de Google. Son puras y
 * testeables, y son las que permiten que la distancia restante, el ETA y la
 * indicación siguientes sigan actualizándose en modo avión.
 */

const EARTH_RADIUS_METERS = 6_371_000;
const METERS_PER_DEGREE_LAT = 111_320;

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

/** Distancia haversine en metros. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

/** Rumbo en grados (0 = norte) desde un punto hacia otro. */
export function bearingDegrees(from: LatLng, to: LatLng): number {
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const dLng = toRad(to.lng - from.lng);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

interface Projection {
  point: LatLng;
  distanceMeters: number;
}

/**
 * Proyecta un punto sobre un segmento usando una aproximación plana local.
 * A escala de un segmento de ruta (decenas de metros) el error es despreciable
 * y evita el coste de trigonometría esférica en cada tick de GPS.
 */
function projectOnSegment(point: LatLng, a: LatLng, b: LatLng): Projection {
  const lngScale = METERS_PER_DEGREE_LAT * Math.cos(toRad(point.lat));

  const px = point.lng * lngScale;
  const py = point.lat * METERS_PER_DEGREE_LAT;
  const ax = a.lng * lngScale;
  const ay = a.lat * METERS_PER_DEGREE_LAT;
  const bx = b.lng * lngScale;
  const by = b.lat * METERS_PER_DEGREE_LAT;

  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared <= 0) {
    return { point: a, distanceMeters: distanceMeters(point, a) };
  }

  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));

  const closest: LatLng = {
    lat: (ay + t * dy) / METERS_PER_DEGREE_LAT,
    lng: (ax + t * dx) / lngScale,
  };

  return { point: closest, distanceMeters: distanceMeters(point, closest) };
}

/**
 * Geometría preprocesada de una ruta.
 *
 * Las distancias acumuladas se calculan una sola vez al rehidratar la ruta, de
 * modo que la distancia restante en cada fix de GPS sea O(1) en vez de recorrer
 * la polyline completa.
 */
export interface RouteGeometry {
  path: LatLng[];
  /** cumulative[i] = metros desde el inicio hasta path[i]. */
  cumulative: number[];
  totalMeters: number;
}

export function buildRouteGeometry(path: LatLng[]): RouteGeometry {
  const cumulative = new Array<number>(path.length).fill(0);

  for (let index = 1; index < path.length; index += 1) {
    cumulative[index] = cumulative[index - 1] + distanceMeters(path[index - 1], path[index]);
  }

  return {
    path,
    cumulative,
    totalMeters: cumulative[cumulative.length - 1] ?? 0,
  };
}

export interface RouteSnap {
  /** Índice del segmento más cercano (segmento index → index + 1). */
  index: number;
  /** Punto proyectado sobre la ruta: el "map matching". */
  snapped: LatLng;
  /** Distancia perpendicular del GPS a la ruta. Base para detectar off-route. */
  distanceToRouteMeters: number;
  /** Metros que faltan hasta el final de la ruta. */
  remainingMeters: number;
  /** Rumbo del tramo de calle donde está el usuario, para orientar la cámara. */
  headingDegrees: number | null;
}

/**
 * Proyecta la posición del GPS sobre la ruta guardada.
 *
 * `searchFromIndex` restringe la búsqueda a una ventana hacia adelante. No es
 * solo una optimización: en rutas que pasan dos veces por la misma calle
 * (ida y vuelta), una búsqueda global puede engancharse al tramo equivocado y
 * hacer que la distancia restante salte hacia atrás.
 */
export function snapToRoute(
  point: LatLng,
  geometry: RouteGeometry,
  searchFromIndex = 0,
  windowSize = 80,
): RouteSnap | null {
  const { path, cumulative, totalMeters } = geometry;
  if (path.length < 2) return null;

  const start = Math.max(0, Math.min(searchFromIndex, path.length - 2));
  const end = Math.min(path.length - 2, start + windowSize);

  let bestIndex = start;
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestPoint = path[start];

  for (let index = start; index <= end; index += 1) {
    const projection = projectOnSegment(point, path[index], path[index + 1]);

    if (projection.distanceMeters < bestDistance) {
      bestDistance = projection.distanceMeters;
      bestIndex = index;
      bestPoint = projection.point;
    }
  }

  // Si dentro de la ventana no hay nada razonablemente cerca, el usuario se
  // salió o saltó de tramo: recién ahí se paga una búsqueda global.
  if (bestDistance > 120 && (start > 0 || end < path.length - 2)) {
    return snapToRoute(point, geometry, 0, path.length);
  }

  const metersIntoSegment = distanceMeters(path[bestIndex], bestPoint);
  const travelled = cumulative[bestIndex] + metersIntoSegment;

  const from = path[bestIndex];
  const to = path[bestIndex + 1];
  const headingDegrees = distanceMeters(from, to) >= 1 ? bearingDegrees(from, to) : null;

  return {
    index: bestIndex,
    snapped: bestPoint,
    distanceToRouteMeters: bestDistance,
    remainingMeters: Math.max(0, totalMeters - travelled),
    headingDegrees,
  };
}

/**
 * Paso de navegación activo, resuelto localmente.
 *
 * Se elige el primer paso cuyo final todavía no se alcanzó, para no quedarse
 * pegado en una instrucción ya cumplida.
 */
export function activeStep(steps: NavStep[], point: LatLng, reachedMeters = 18): NavStep | null {
  if (steps.length === 0) return null;

  for (const step of steps) {
    if (distanceMeters(point, step.endLocation) > reachedMeters) return step;
  }

  return steps[steps.length - 1] ?? null;
}

/**
 * ETA estimado sin red.
 *
 * Usa la velocidad media que Google informó al calcular la ruta, que ya
 * incorpora el tráfico del momento del cálculo. Sin conexión no hay forma de
 * saber el tráfico actual, así que esta es la mejor estimación disponible y
 * degrada con elegancia en vez de desaparecer.
 */
export function localEtaSeconds(remainingMeters: number, route: NavigationRoute): number | null {
  if (!Number.isFinite(remainingMeters) || remainingMeters <= 0) return 0;

  const averageSpeed =
    route.distanceMeters > 0 && route.durationSeconds > 0
      ? route.distanceMeters / route.durationSeconds
      : 0;

  // 8,3 m/s ≈ 30 km/h: velocidad urbana razonable si la ruta no trae duración.
  const speed = averageSpeed > 0.5 ? averageSpeed : 8.3;

  return Math.round(remainingMeters / speed);
}

/** Formatea metros para la UI de navegación. */
export function formatNavigationMeters(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "";
  if (value < 1000) return `${Math.max(10, Math.round(value / 10) * 10)} m`;

  const fractionDigits = value < 10_000 ? 1 : 0;

  return `${(value / 1000).toLocaleString("es-CL", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })} km`;
}

/** Formatea segundos como duración corta ("8 min", "1 h 5 min"). */
export function formatNavigationDuration(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "";

  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;

  return restMinutes === 0 ? `${hours} h` : `${hours} h ${restMinutes} min`;
}
