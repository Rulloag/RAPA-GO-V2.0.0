import { describe, expect, it } from "vitest";
import {
  buildRouteKey,
  classifyRouteFailure,
  cleanInstruction,
  decodePath,
  encodePath,
  isValidStoredRoute,
} from "../routeSerialization.js";
import { NAVIGATION_ROUTE_SCHEMA_VERSION } from "../navigationRoute.types.js";

describe("códec de polyline", () => {
  it("decodifica el vector de ejemplo de Google", () => {
    // Vector publicado por Google para su algoritmo de polylines codificadas.
    // Que este caso pase es lo que garantiza que lo guardado en disco sea
    // intercambiable con `geometry.encoding.decodePath`.
    const path = decodePath("_p~iF~ps|U_ulLnnqC_mqNvxq`@");

    expect(path).toHaveLength(3);
    expect(path[0].lat).toBeCloseTo(38.5, 5);
    expect(path[0].lng).toBeCloseTo(-120.2, 5);
    expect(path[1].lat).toBeCloseTo(40.7, 5);
    expect(path[1].lng).toBeCloseTo(-120.95, 5);
    expect(path[2].lat).toBeCloseTo(43.252, 5);
    expect(path[2].lng).toBeCloseTo(-126.453, 5);
  });

  it("produce el mismo texto que Google al codificar", () => {
    const encoded = encodePath([
      { lat: 38.5, lng: -120.2 },
      { lat: 40.7, lng: -120.95 },
      { lat: 43.252, lng: -126.453 },
    ]);

    expect(encoded).toBe("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
  });

  it("conserva la geometría en un ida y vuelta", () => {
    const original = [
      { lat: -27.1505, lng: -109.4325 },
      { lat: -27.1498, lng: -109.4311 },
      { lat: -27.1477, lng: -109.4302 },
      { lat: -27.1455, lng: -109.4288 },
    ];

    const restored = decodePath(encodePath(original));

    expect(restored).toHaveLength(original.length);

    restored.forEach((point, index) => {
      expect(point.lat).toBeCloseTo(original[index].lat, 5);
      expect(point.lng).toBeCloseTo(original[index].lng, 5);
    });
  });

  it("no lanza con texto corrupto", () => {
    expect(() => decodePath("###no-es-una-polyline###")).not.toThrow();
    expect(decodePath("")).toEqual([]);
  });
});

describe("buildRouteKey", () => {
  it("ignora el movimiento del origen", () => {
    // El origen no entra en la clave: si entrara, cada fix de GPS invalidaría
    // la caché, que es exactamente el bug que este módulo elimina.
    const destination = { lat: -27.1455, lng: -109.4288 };

    expect(buildRouteKey("ride-1", "to_destination", destination)).toBe(
      buildRouteKey("ride-1", "to_destination", destination),
    );
  });

  it("distingue fase y destino", () => {
    const a = buildRouteKey("ride-1", "to_pickup", { lat: -27.1, lng: -109.4 });
    const b = buildRouteKey("ride-1", "to_destination", { lat: -27.1, lng: -109.4 });
    const c = buildRouteKey("ride-1", "to_destination", { lat: -27.2, lng: -109.4 });

    expect(a).not.toBe(b);
    expect(b).not.toBe(c);
  });

  it("absorbe el ruido de geocodificación bajo el metro", () => {
    const a = buildRouteKey("ride-1", "to_destination", { lat: -27.14550001, lng: -109.4288 });
    const b = buildRouteKey("ride-1", "to_destination", { lat: -27.1455, lng: -109.4288 });

    expect(a).toBe(b);
  });
});

describe("classifyRouteFailure", () => {
  it("trata ZERO_RESULTS y NOT_FOUND como fallo semántico", () => {
    expect(classifyRouteFailure("ZERO_RESULTS").kind).toBe("semantic");
    expect(classifyRouteFailure("NOT_FOUND").kind).toBe("semantic");
  });

  it("trata los cortes de red como fallo de transporte", () => {
    // Esta es la distinción que impide borrar la ruta al perder señal.
    expect(classifyRouteFailure("UNKNOWN_ERROR").kind).toBe("transport");
    expect(classifyRouteFailure("OVER_QUERY_LIMIT").kind).toBe("transport");
    expect(classifyRouteFailure(null, new Error("Failed to fetch")).kind).toBe("transport");
    expect(classifyRouteFailure(undefined).kind).toBe("transport");
  });
});

describe("cleanInstruction", () => {
  it("quita el HTML que devuelve Google", () => {
    expect(cleanInstruction("Gira a la <b>derecha</b> hacia <span>Av. Pont</span>")).toBe(
      "Gira a la derecha hacia Av. Pont",
    );
  });

  it("devuelve un texto usable cuando viene vacío", () => {
    expect(cleanInstruction(null)).toBe("Sigue la ruta marcada.");
  });
});

describe("isValidStoredRoute", () => {
  const valid = {
    key: "ride-1:to_destination:-27.14550,-109.42880",
    version: NAVIGATION_ROUTE_SCHEMA_VERSION,
    rideId: "ride-1",
    phase: "to_destination",
    origin: { lat: -27.15, lng: -109.43 },
    destination: { lat: -27.1455, lng: -109.4288 },
    encodedPath: "_p~iF~ps|U",
    steps: [],
    distanceMeters: 1200,
    durationSeconds: 240,
    computedAt: Date.now(),
    source: "network",
  };

  it("acepta una entrada bien formada", () => {
    expect(isValidStoredRoute(valid)).toBe(true);
  });

  it("descarta entradas de otro esquema", () => {
    // Tras un deploy que cambie el modelo, lo viejo se ignora en vez de
    // romper el render con datos incompatibles.
    expect(isValidStoredRoute({ ...valid, version: 999 })).toBe(false);
  });

  it("descarta basura", () => {
    expect(isValidStoredRoute(null)).toBe(false);
    expect(isValidStoredRoute({ ...valid, encodedPath: "" })).toBe(false);
  });
});
