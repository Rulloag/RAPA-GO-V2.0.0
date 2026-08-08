import type { LatLng } from "../maps/maps.types.js";
import {
  NAVIGATION_ROUTE_SCHEMA_VERSION,
  type NavStep,
  type NavigationRoute,
  type RouteFailure,
  type RoutePhase,
} from "./navigationRoute.types.js";

/**
 * Conversión entre `google.maps.DirectionsResult` y `NavigationRoute`.
 *
 * El códec de polyline está implementado aquí en vez de usar
 * `google.maps.geometry.encoding` a propósito: en un arranque en frío sin
 * señal el script del SDK puede no cargar, y aun así tenemos que poder leer y
 * decodificar la ruta guardada. Es el algoritmo estándar de Google (deltas en
 * 1e5, zigzag, grupos de 5 bits), así que el resultado es intercambiable con
 * `encoding.decodePath`.
 */

const COORD_PRECISION = 1e5;

function encodeSignedNumber(value: number): string {
  let remaining = value < 0 ? ~(value << 1) : value << 1;
  let encoded = "";

  while (remaining >= 0x20) {
    encoded += String.fromCharCode((0x20 | (remaining & 0x1f)) + 63);
    remaining >>= 5;
  }

  return encoded + String.fromCharCode(remaining + 63);
}

/** Codifica una lista de puntos como polyline de Google. */
export function encodePath(path: readonly LatLng[]): string {
  let encoded = "";
  let previousLat = 0;
  let previousLng = 0;

  for (const point of path) {
    const lat = Math.round(point.lat * COORD_PRECISION);
    const lng = Math.round(point.lng * COORD_PRECISION);

    encoded += encodeSignedNumber(lat - previousLat);
    encoded += encodeSignedNumber(lng - previousLng);

    previousLat = lat;
    previousLng = lng;
  }

  return encoded;
}

/** Decodifica una polyline de Google. Devuelve lo leído hasta el corte si el texto está corrupto. */
export function decodePath(encoded: string): LatLng[] {
  const path: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte = 0;

    do {
      byte = encoded.charCodeAt(index) - 63;
      index += 1;
      if (!Number.isFinite(byte) || byte < 0) return path;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);

    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index) - 63;
      index += 1;
      if (!Number.isFinite(byte) || byte < 0) return path;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);

    lng += result & 1 ? ~(result >> 1) : result >> 1;

    path.push({
      lat: lat / COORD_PRECISION,
      lng: lng / COORD_PRECISION,
    });
  }

  return path;
}

/** Lee un LatLng de Google, que expone lat/lng como valor o como función. */
export function toPlainPoint(
  value: google.maps.LatLng | google.maps.LatLngLiteral | null | undefined,
): LatLng | null {
  if (!value) return null;

  const raw = value as {
    lat?: number | (() => number);
    lng?: number | (() => number);
  };

  const lat = typeof raw.lat === "function" ? raw.lat() : Number(raw.lat);
  const lng = typeof raw.lng === "function" ? raw.lng() : Number(raw.lng);

  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

const FALLBACK_INSTRUCTION = "Sigue la ruta marcada.";

/** Limpia el HTML que Google devuelve en las instrucciones. */
export function cleanInstruction(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw) return FALLBACK_INSTRUCTION;

  const text = raw
    .replace(/<div[^>]*>/gi, ". ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .replace(/\s+\./g, ".")
    .trim();

  return text || FALLBACK_INSTRUCTION;
}

/** Extrae el nombre de la calle desde la instrucción, cuando se puede. */
export function extractStreet(value: string | null | undefined): string | null {
  const text = cleanInstruction(value);
  if (!text || text === FALLBACK_INSTRUCTION) return null;

  const patterns = [
    /(?:hacia|en dirección a|por|en|toma|contin[uú]a por|mantente en)\s+([^.,;]+)/i,
    /(?:gira|dobla|incorp[oó]rate)\s+(?:a la derecha|a la izquierda|ligeramente a la derecha|ligeramente a la izquierda)?\s*(?:hacia|en)?\s*([^.,;]+)/i,
  ];

  for (const pattern of patterns) {
    const street = text.match(pattern)?.[1]?.trim();
    if (street && street.length >= 3) return street.replace(/^la\s+/i, "").trim();
  }

  const afterArrow = text.split(" hacia ").pop()?.trim();
  if (afterArrow && afterArrow !== text && afterArrow.length >= 3) {
    return afterArrow.split(/[.,;]/)[0]?.trim() ?? null;
  }

  return null;
}

/**
 * Clave de caché estable.
 *
 * Deliberadamente NO incluye el origen: el conductor se mueve continuamente y
 * meter su GPS en la clave invalidaría la caché en cada fix, que es justo el
 * error que hace desaparecer la ruta hoy. El destino se redondea a ~1 m
 * (5 decimales) para que el ruido de geocodificación no genere claves nuevas.
 */
export function buildRouteKey(
  rideId: string,
  phase: RoutePhase,
  destination: LatLng,
): string {
  return `${rideId}:${phase}:${destination.lat.toFixed(5)},${destination.lng.toFixed(5)}`;
}

function metersFrom(value: google.maps.Distance | undefined): number {
  const meters = Number(value?.value ?? NaN);
  return Number.isFinite(meters) ? meters : 0;
}

function secondsFrom(value: google.maps.Duration | undefined): number {
  const seconds = Number(value?.value ?? NaN);
  return Number.isFinite(seconds) ? seconds : 0;
}

/** Convierte los pasos de una pierna en maniobras planas y serializables. */
function buildSteps(leg: google.maps.DirectionsLeg | undefined): NavStep[] {
  const steps: NavStep[] = [];

  for (const step of leg?.steps ?? []) {
    const endLocation = toPlainPoint(step.end_location);
    if (!endLocation) continue;

    steps.push({
      text: cleanInstruction(step.instructions),
      maneuver: step.maneuver ?? null,
      street: extractStreet(step.instructions),
      endLocation,
      distanceMeters: metersFrom(step.distance),
      durationSeconds: secondsFrom(step.duration),
    });
  }

  return steps;
}

/** Aplana la geometría de una pierna, descartando puntos a menos de ~1 m. */
function buildPathFromLeg(leg: google.maps.DirectionsLeg | undefined): LatLng[] {
  const path: LatLng[] = [];

  for (const step of leg?.steps ?? []) {
    const points = step.path?.length ? step.path : [step.start_location, step.end_location];

    for (const point of points) {
      const plain = toPlainPoint(point);
      if (!plain) continue;

      const last = path[path.length - 1];
      if (
        !last ||
        Math.abs(last.lat - plain.lat) > 1e-5 ||
        Math.abs(last.lng - plain.lng) > 1e-5
      ) {
        path.push(plain);
      }
    }
  }

  return path;
}

export interface RouteContext {
  rideId: string;
  phase: RoutePhase;
  origin: LatLng;
  destination: LatLng;
}

/**
 * Convierte la respuesta viva de Google en el modelo persistible.
 * Devuelve null si la respuesta no trae geometría utilizable.
 */
export function toNavigationRoute(
  result: google.maps.DirectionsResult,
  context: RouteContext,
): NavigationRoute | null {
  const leg = result.routes[0]?.legs[0];
  const path = buildPathFromLeg(leg);

  if (path.length < 2) return null;

  return {
    key: buildRouteKey(context.rideId, context.phase, context.destination),
    version: NAVIGATION_ROUTE_SCHEMA_VERSION,
    rideId: context.rideId,
    phase: context.phase,
    origin: context.origin,
    destination: context.destination,
    encodedPath: encodePath(path),
    steps: buildSteps(leg),
    distanceMeters: metersFrom(leg?.distance),
    durationSeconds: secondsFrom(leg?.duration),
    computedAt: Date.now(),
    source: "network",
  };
}

/** Valida una entrada leída de disco antes de confiar en ella. */
export function isValidStoredRoute(value: unknown): value is NavigationRoute {
  if (!value || typeof value !== "object") return false;

  const route = value as Partial<NavigationRoute>;

  return (
    route.version === NAVIGATION_ROUTE_SCHEMA_VERSION &&
    typeof route.key === "string" &&
    typeof route.encodedPath === "string" &&
    route.encodedPath.length > 0 &&
    typeof route.computedAt === "number" &&
    Array.isArray(route.steps) &&
    !!route.origin &&
    !!route.destination
  );
}

const SEMANTIC_STATUSES = [
  "ZERO_RESULTS",
  "NOT_FOUND",
  "MAX_WAYPOINTS_EXCEEDED",
  "INVALID_REQUEST",
];

/**
 * Decide si un fallo justifica borrar la ruta de pantalla.
 *
 * Solo los fallos semánticos lo justifican: significan que la ruta pedida no
 * existe. Todo lo demás (sin red, timeout, cuota, error del servidor de Google)
 * es un fallo de transporte y debe conservar la última ruta buena.
 */
export function classifyRouteFailure(status: unknown, error?: unknown): RouteFailure {
  const raw = String(
    status ?? (error instanceof Error ? error.message : error ?? "UNKNOWN"),
  ).toUpperCase();

  const matched = SEMANTIC_STATUSES.find((candidate) => raw.includes(candidate));

  if (matched) {
    return {
      kind: "semantic",
      status: matched,
      message:
        matched === "ZERO_RESULTS"
          ? "No se encontró una ruta entre los puntos seleccionados."
          : "No se pudo ubicar uno de los puntos de la ruta.",
    };
  }

  return {
    kind: "transport",
    status: raw.slice(0, 60),
    message: "Sin conexión para actualizar la ruta. Se mantiene la última ruta calculada.",
  };
}
