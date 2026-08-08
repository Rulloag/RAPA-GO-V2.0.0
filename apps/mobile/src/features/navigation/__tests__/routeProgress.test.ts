import { describe, expect, it } from "vitest";
import {
  activeStep,
  buildRouteGeometry,
  distanceMeters,
  formatNavigationDuration,
  formatNavigationMeters,
  localEtaSeconds,
  snapToRoute,
} from "../routeProgress.js";
import {
  NAVIGATION_ROUTE_SCHEMA_VERSION,
  type NavStep,
  type NavigationRoute,
} from "../navigationRoute.types.js";

// Tramo recto hacia el este en Hanga Roa. A esta latitud 0,001° de longitud
// son ~99 m, así que la ruta completa mide ~198 m.
const A = { lat: -27.15, lng: -109.43 };
const B = { lat: -27.15, lng: -109.429 };
const C = { lat: -27.15, lng: -109.428 };

const geometry = buildRouteGeometry([A, B, C]);

describe("buildRouteGeometry", () => {
  it("acumula la distancia a lo largo de la ruta", () => {
    expect(geometry.cumulative[0]).toBe(0);
    expect(geometry.cumulative[1]).toBeCloseTo(distanceMeters(A, B), 3);
    expect(geometry.totalMeters).toBeCloseTo(
      distanceMeters(A, B) + distanceMeters(B, C),
      3,
    );
  });
});

describe("snapToRoute", () => {
  it("proyecta el GPS sobre la ruta y mide la separación", () => {
    // Punto a mitad del primer tramo, desplazado ~11 m al norte.
    const point = { lat: -27.1499, lng: -109.4295 };
    const snap = snapToRoute(point, geometry);

    expect(snap).not.toBeNull();
    expect(snap!.index).toBe(0);
    expect(snap!.distanceToRouteMeters).toBeGreaterThan(9);
    expect(snap!.distanceToRouteMeters).toBeLessThan(13);
    expect(snap!.snapped.lat).toBeCloseTo(-27.15, 4);
  });

  it("hace que la distancia restante baje al avanzar", () => {
    // La propiedad que sostiene la navegación offline: el progreso se calcula
    // recorriendo la polyline local, sin preguntarle nada al servidor.
    const start = snapToRoute(A, geometry)!;
    const middle = snapToRoute(B, geometry)!;
    const end = snapToRoute(C, geometry)!;

    expect(start.remainingMeters).toBeGreaterThan(middle.remainingMeters);
    expect(middle.remainingMeters).toBeGreaterThan(end.remainingMeters);
    expect(end.remainingMeters).toBeLessThan(1);
    expect(start.remainingMeters).toBeCloseTo(geometry.totalMeters, 1);
  });

  it("calcula el rumbo del tramo actual", () => {
    // Ruta hacia el este: rumbo ~90°.
    const snap = snapToRoute({ lat: -27.15, lng: -109.4295 }, geometry)!;
    expect(snap.headingDegrees).toBeCloseTo(90, 0);
  });

  it("devuelve null si la ruta no tiene tramos", () => {
    expect(snapToRoute(A, buildRouteGeometry([A]))).toBeNull();
  });

  it("reengancha con búsqueda global si la ventana no alcanza", () => {
    // Con una ventana de 1 tramo empezando en el índice 0, un punto que ya
    // está sobre el último tramo debe encontrarse igual.
    const snap = snapToRoute(C, geometry, 0, 1);

    expect(snap).not.toBeNull();
    expect(snap!.remainingMeters).toBeLessThan(1);
  });
});

describe("activeStep", () => {
  const steps: NavStep[] = [
    {
      text: "Gira a la derecha",
      maneuver: "turn-right",
      street: "Av. Pont",
      endLocation: B,
      distanceMeters: 99,
      durationSeconds: 20,
    },
    {
      text: "Llegaste a tu destino",
      maneuver: null,
      street: null,
      endLocation: C,
      distanceMeters: 99,
      durationSeconds: 20,
    },
  ];

  it("entrega el paso todavía no cumplido", () => {
    expect(activeStep(steps, A)?.text).toBe("Gira a la derecha");
  });

  it("avanza al siguiente cuando ya se pasó el punto del primero", () => {
    // Sin esto la app se queda pegada mostrando una instrucción ya ejecutada.
    expect(activeStep(steps, B)?.text).toBe("Llegaste a tu destino");
  });

  it("devuelve null si no hay pasos", () => {
    expect(activeStep([], A)).toBeNull();
  });
});

describe("localEtaSeconds", () => {
  const route: NavigationRoute = {
    key: "ride-1:to_destination:-27.15000,-109.42800",
    version: NAVIGATION_ROUTE_SCHEMA_VERSION,
    rideId: "ride-1",
    phase: "to_destination",
    origin: A,
    destination: C,
    encodedPath: "",
    steps: [],
    distanceMeters: 2000,
    durationSeconds: 400,
    computedAt: Date.now(),
    source: "network",
  };

  it("usa la velocidad media que informó la ruta", () => {
    // 2000 m en 400 s = 5 m/s. 1000 m restantes ⇒ 200 s.
    expect(localEtaSeconds(1000, route)).toBe(200);
  });

  it("cae a una velocidad urbana si la ruta no trae duración", () => {
    const sinDuracion = { ...route, durationSeconds: 0 };
    expect(localEtaSeconds(830, sinDuracion)).toBe(100);
  });

  it("devuelve 0 al llegar", () => {
    expect(localEtaSeconds(0, route)).toBe(0);
  });
});

describe("formato para la UI", () => {
  it("redondea metros y cambia a kilómetros", () => {
    expect(formatNavigationMeters(123)).toBe("120 m");
    expect(formatNavigationMeters(5)).toBe("10 m");
    expect(formatNavigationMeters(null)).toBe("");
    expect(formatNavigationMeters(2500)).toContain("km");
  });

  it("formatea duraciones", () => {
    expect(formatNavigationDuration(240)).toBe("4 min");
    expect(formatNavigationDuration(3600)).toBe("1 h");
    expect(formatNavigationDuration(3900)).toBe("1 h 5 min");
    expect(formatNavigationDuration(null)).toBe("");
  });
});
