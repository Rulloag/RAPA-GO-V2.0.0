/**
 * Política de recálculo, modelo Waze.
 *
 * El código anterior pedía una ruta nueva cuando el conductor se había movido
 * 3 m y habían pasado 1,2 s. A 30 km/h se recorren 3 m en 0,36 s, así que
 * mandaba el piso de 1,2 s: ~50 llamadas por minuto a Directions API por
 * conductor activo, y una app que dependía de la red en todo momento.
 *
 * Waze calcula la ruta una vez y luego solo proyecta el GPS sobre la polyline
 * local. Vuelve a la red únicamente cuando te saliste de verdad, cuando cambia
 * el destino, o para refrescar el tráfico de forma oportunista.
 */

/** Distancia perpendicular a la ruta a partir de la cual se considera desvío. */
export const OFF_ROUTE_METERS = 45;

/**
 * Fixes seguidos fuera de ruta antes de recalcular.
 * Un solo fix no basta: el GPS urbano salta con facilidad 30-50 m entre
 * edificios, y recalcular ante cada salto es la causa de las rutas que
 * "bailan" en pantalla.
 */
export const OFF_ROUTE_CONSECUTIVE_FIXES = 4;

/** Tiempo mínimo entre dos recálculos, aunque el desvío persista. */
export const MIN_REROUTE_INTERVAL_MS = 15_000;

/** Cada cuánto se refresca la ruta para incorporar tráfico. */
export const TRAFFIC_REFRESH_INTERVAL_MS = 120_000;

export interface RerouteState {
  consecutiveOffRouteFixes: number;
  lastRerouteAt: number;
  lastRefreshAt: number;
  /** Hay un desvío pendiente de resolver en cuanto vuelva la conexión. */
  queuedWhileOffline: boolean;
}

export function createRerouteState(now = Date.now()): RerouteState {
  return {
    consecutiveOffRouteFixes: 0,
    lastRerouteAt: 0,
    lastRefreshAt: now,
    queuedWhileOffline: false,
  };
}

export interface RerouteInput {
  /** Distancia del GPS a la ruta dibujada. null si todavía no hay ruta. */
  distanceToRouteMeters: number | null;
  isOnline: boolean;
  hasRoute: boolean;
  now: number;
}

export type RerouteAction =
  /** Nada que hacer: se sigue navegando con la ruta local. */
  | { action: "none" }
  /** Pedir ruta nueva ya: el usuario se salió de verdad. */
  | { action: "reroute"; reason: "off_route" | "reconnected" }
  /** Refresco de tráfico en segundo plano; no bloquea ni borra nada. */
  | { action: "refresh"; reason: "traffic" };

export interface RerouteEvaluation {
  decision: RerouteAction;
  state: RerouteState;
}

/**
 * Decide si toca ir a la red. Función pura: no dibuja ni borra nada.
 *
 * Regla que sostiene todo el diseño: sin conexión nunca se recalcula ni se
 * limpia la ruta. El desvío se anota y se resuelve al reconectar, de modo que
 * quedarse sin señal no cambia nada de lo que el usuario ve.
 */
export function evaluateReroute(
  state: RerouteState,
  input: RerouteInput,
): RerouteEvaluation {
  const { distanceToRouteMeters, isOnline, hasRoute, now } = input;

  const isOffRoute =
    distanceToRouteMeters != null && distanceToRouteMeters > OFF_ROUTE_METERS;

  const consecutiveOffRouteFixes = isOffRoute ? state.consecutiveOffRouteFixes + 1 : 0;

  const next: RerouteState = { ...state, consecutiveOffRouteFixes };

  // Sin conexión: se conserva todo tal cual y se anota el desvío.
  if (!isOnline) {
    return {
      decision: { action: "none" },
      state: {
        ...next,
        queuedWhileOffline:
          next.queuedWhileOffline ||
          consecutiveOffRouteFixes >= OFF_ROUTE_CONSECUTIVE_FIXES,
      },
    };
  }

  // Volvió la conexión con un desvío pendiente: se resuelve ahora.
  if (state.queuedWhileOffline && hasRoute) {
    return {
      decision: { action: "reroute", reason: "reconnected" },
      state: {
        ...next,
        consecutiveOffRouteFixes: 0,
        queuedWhileOffline: false,
        lastRerouteAt: now,
        lastRefreshAt: now,
      },
    };
  }

  const sinceReroute = now - state.lastRerouteAt;

  if (
    consecutiveOffRouteFixes >= OFF_ROUTE_CONSECUTIVE_FIXES &&
    sinceReroute >= MIN_REROUTE_INTERVAL_MS
  ) {
    return {
      decision: { action: "reroute", reason: "off_route" },
      state: {
        ...next,
        consecutiveOffRouteFixes: 0,
        lastRerouteAt: now,
        lastRefreshAt: now,
      },
    };
  }

  if (hasRoute && now - state.lastRefreshAt >= TRAFFIC_REFRESH_INTERVAL_MS) {
    return {
      decision: { action: "refresh", reason: "traffic" },
      state: { ...next, lastRefreshAt: now },
    };
  }

  return { decision: { action: "none" }, state: next };
}

/**
 * ¿Conviene volver a pedir una ruta que ya tenemos en caché?
 *
 * Solo si hay conexión y el cálculo ya envejeció. Una ruta fresca en caché se
 * usa tal cual: es lo que evita gastar datos al reabrir la app o al cambiar de
 * Wi-Fi a datos móviles.
 */
export function shouldRefreshCachedRoute(
  computedAt: number,
  isOnline: boolean,
  now = Date.now(),
): boolean {
  return isOnline && now - computedAt >= TRAFFIC_REFRESH_INTERVAL_MS;
}
