import { describe, expect, it } from "vitest";
import {
  MIN_REROUTE_INTERVAL_MS,
  OFF_ROUTE_CONSECUTIVE_FIXES,
  OFF_ROUTE_METERS,
  TRAFFIC_REFRESH_INTERVAL_MS,
  createRerouteState,
  evaluateReroute,
  shouldRefreshCachedRoute,
  type RerouteState,
} from "../reroutePolicy.js";

const NOW = 1_700_000_000_000;

/** Aplica N fixes seguidos a la misma distancia de la ruta. */
function feed(
  state: RerouteState,
  fixes: number,
  distanceToRouteMeters: number | null,
  options: { isOnline?: boolean; now?: number } = {},
): { state: RerouteState; actions: string[] } {
  const actions: string[] = [];
  let current = state;

  for (let index = 0; index < fixes; index += 1) {
    const evaluation = evaluateReroute(current, {
      distanceToRouteMeters,
      isOnline: options.isOnline ?? true,
      hasRoute: true,
      now: options.now ?? NOW,
    });

    current = evaluation.state;
    actions.push(evaluation.decision.action);
  }

  return { state: current, actions };
}

describe("evaluateReroute", () => {
  it("no recalcula mientras el conductor sigue la ruta", () => {
    const { actions } = feed(createRerouteState(NOW), 20, 5);
    expect(actions.every((action) => action === "none")).toBe(true);
  });

  it("aguanta el ruido del GPS bajo el umbral", () => {
    // Saltos de hasta 45 m son normales entre edificios: recalcular ahí es lo
    // que hace que la ruta "baile" en pantalla.
    const { actions } = feed(createRerouteState(NOW), 10, OFF_ROUTE_METERS - 1);
    expect(actions).not.toContain("reroute");
  });

  it("no recalcula con un único fix fuera de ruta", () => {
    const { actions } = feed(createRerouteState(NOW), 1, 200);
    expect(actions).toEqual(["none"]);
  });

  it("recalcula tras varios fixes seguidos fuera de ruta", () => {
    const { actions } = feed(createRerouteState(NOW), OFF_ROUTE_CONSECUTIVE_FIXES, 200);
    expect(actions[actions.length - 1]).toBe("reroute");
  });

  it("reinicia la cuenta si el conductor vuelve a la ruta", () => {
    // Tres fixes fuera y uno dentro no deben acumularse hacia un recálculo.
    let state = createRerouteState(NOW);
    state = feed(state, OFF_ROUTE_CONSECUTIVE_FIXES - 1, 200).state;
    state = feed(state, 1, 5).state;

    const { actions } = feed(state, OFF_ROUTE_CONSECUTIVE_FIXES - 1, 200);
    expect(actions).not.toContain("reroute");
  });

  it("respeta el intervalo mínimo entre recálculos", () => {
    const first = feed(createRerouteState(NOW), OFF_ROUTE_CONSECUTIVE_FIXES, 200);
    expect(first.actions[first.actions.length - 1]).toBe("reroute");

    // Sigue fuera de ruta, pero es demasiado pronto para volver a la red.
    const second = feed(first.state, OFF_ROUTE_CONSECUTIVE_FIXES, 200, {
      now: NOW + MIN_REROUTE_INTERVAL_MS - 1,
    });
    expect(second.actions).not.toContain("reroute");

    // Vencido el enfriamiento y con el contador ya saturado, recalcula en el
    // primer fix: no vuelve a exigir otros cuatro desvíos seguidos.
    const third = feed(second.state, OFF_ROUTE_CONSECUTIVE_FIXES, 200, {
      now: NOW + MIN_REROUTE_INTERVAL_MS + 1,
    });
    expect(third.actions[0]).toBe("reroute");
    expect(third.actions.filter((action) => action === "reroute")).toHaveLength(1);
  });

  it("nunca recalcula sin conexión", () => {
    // Regla que sostiene todo el diseño: sin red no se toca nada de lo que el
    // usuario está viendo.
    const { state, actions } = feed(createRerouteState(NOW), 20, 500, { isOnline: false });

    expect(actions.every((action) => action === "none")).toBe(true);
    expect(state.queuedWhileOffline).toBe(true);
  });

  it("resuelve el desvío pendiente al reconectar", () => {
    const offline = feed(createRerouteState(NOW), OFF_ROUTE_CONSECUTIVE_FIXES, 500, {
      isOnline: false,
    });
    expect(offline.state.queuedWhileOffline).toBe(true);

    const reconnected = evaluateReroute(offline.state, {
      distanceToRouteMeters: 500,
      isOnline: true,
      hasRoute: true,
      now: NOW + 1000,
    });

    expect(reconnected.decision).toEqual({ action: "reroute", reason: "reconnected" });
    expect(reconnected.state.queuedWhileOffline).toBe(false);
  });

  it("no deja pendiente un desvío que nunca se sostuvo offline", () => {
    const offline = feed(createRerouteState(NOW), 2, 500, { isOnline: false });
    expect(offline.state.queuedWhileOffline).toBe(false);
  });

  it("refresca el tráfico de forma periódica", () => {
    const evaluation = evaluateReroute(createRerouteState(NOW), {
      distanceToRouteMeters: 5,
      isOnline: true,
      hasRoute: true,
      now: NOW + TRAFFIC_REFRESH_INTERVAL_MS + 1,
    });

    expect(evaluation.decision).toEqual({ action: "refresh", reason: "traffic" });
  });

  it("no refresca el tráfico sin ruta dibujada", () => {
    const evaluation = evaluateReroute(createRerouteState(NOW), {
      distanceToRouteMeters: null,
      isOnline: true,
      hasRoute: false,
      now: NOW + TRAFFIC_REFRESH_INTERVAL_MS + 1,
    });

    expect(evaluation.decision.action).toBe("none");
  });
});

describe("shouldRefreshCachedRoute", () => {
  it("usa tal cual una ruta reciente", () => {
    // Esto es lo que evita gastar datos al reabrir la app o al cambiar de
    // Wi-Fi a datos móviles con el mismo destino.
    expect(shouldRefreshCachedRoute(NOW, true, NOW + 1000)).toBe(false);
  });

  it("refresca una ruta envejecida si hay conexión", () => {
    expect(shouldRefreshCachedRoute(NOW, true, NOW + TRAFFIC_REFRESH_INTERVAL_MS + 1)).toBe(true);
  });

  it("nunca refresca sin conexión", () => {
    expect(shouldRefreshCachedRoute(NOW, false, NOW + TRAFFIC_REFRESH_INTERVAL_MS * 10)).toBe(false);
  });
});
