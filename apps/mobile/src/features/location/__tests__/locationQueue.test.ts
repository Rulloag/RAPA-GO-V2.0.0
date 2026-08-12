import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Cola offline de puntos GPS.
 *
 * Lo que protege este archivo: sin señal, los puntos NO se pierden. Se guardan
 * en disco y se reenvían por lotes cuando vuelve la red. En Rapa Nui la señal
 * se cae constantemente, así que este es el camino normal, no el excepcional.
 */

const nativeStore = vi.hoisted(() => new Map<string, string>());
const { mockPublishBatch } = vi.hoisted(() => ({ mockPublishBatch: vi.fn() }));

vi.mock("@capacitor/preferences", () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => ({
      value: nativeStore.get(key) ?? null,
    }),
    set: async ({ key, value }: { key: string; value: string }) => {
      nativeStore.set(key, value);
    },
    remove: async ({ key }: { key: string }) => {
      nativeStore.delete(key);
    },
  },
}));

vi.mock("../rideLocation.service.js", () => ({
  rideLocationService: { publishBatch: mockPublishBatch },
}));

const { locationQueue } = await import("../locationQueue.js");

const RIDE_A = "44444444-4444-4444-8444-444444444444";
const RIDE_B = "55555555-5555-4555-8555-555555555555";
const STORAGE_KEY = "rapago_ride_location_queue_v1";

function point(offsetMs = 0) {
  return {
    lat: -27.1501,
    lng: -109.4301,
    accuracyMeters: 5,
    headingDegrees: 180,
    speedMetersPerSecond: 7,
    altitudeMeters: 20,
    capturedAt: new Date(1_800_000_000_000 + offsetMs).toISOString(),
    source: "background_native" as const,
    appState: "background" as const,
    sequenceNumber: null,
    isMocked: false,
  };
}

function accepted(count: number) {
  return {
    drain: true,
    statusCode: 200,
    accepted: count,
    duplicates: 0,
    rejected: 0,
  };
}

function retryLater(statusCode: number) {
  return {
    drain: false,
    statusCode,
    accepted: 0,
    duplicates: 0,
    rejected: 0,
  };
}

describe("locationQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nativeStore.clear();
    localStorage.clear();
    locationQueue.__resetForTests();
    mockPublishBatch.mockResolvedValue(accepted(1));
  });

  it("guarda un punto que no se pudo entregar", async () => {
    await locationQueue.enqueue(RIDE_A, point());

    expect(await locationQueue.size()).toBe(1);
  });

  it("persiste en almacenamiento nativo para sobrevivir al cierre de la app", async () => {
    await locationQueue.enqueue(RIDE_A, point());

    // Es el punto de toda la fase: si el sistema mata la app, los puntos siguen.
    expect(nativeStore.has(STORAGE_KEY)).toBe(true);

    locationQueue.__resetForTests();
    expect(await locationQueue.size()).toBe(1);
  });

  it("descarta los MÁS ANTIGUOS al llegar al tope", async () => {
    // Para el pasajero vale más el tramo reciente que el del principio.
    for (let i = 0; i < 505; i += 1) {
      await locationQueue.enqueue(RIDE_A, point(i * 1000));
    }

    expect(await locationQueue.size()).toBe(500);

    await locationQueue.flush("token");

    const sent = mockPublishBatch.mock.calls[0]?.[2] as { capturedAt: string }[];
    // El primero superviviente es el punto 5, no el 0.
    expect(sent[0]?.capturedAt).toBe(point(5000).capturedAt);
  });

  it("envía en orden cronológico", async () => {
    await locationQueue.enqueue(RIDE_A, point(3000));
    await locationQueue.enqueue(RIDE_A, point(1000));
    await locationQueue.enqueue(RIDE_A, point(2000));

    await locationQueue.flush("token");

    const sent = mockPublishBatch.mock.calls[0]?.[2] as { capturedAt: string }[];
    const times = sent.map((p) => Date.parse(p.capturedAt));
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it("vacía la cola cuando el servidor acepta", async () => {
    await locationQueue.enqueue(RIDE_A, point(0));
    await locationQueue.enqueue(RIDE_A, point(5000));

    const emptied = await locationQueue.flush("token");

    expect(emptied).toBe(true);
    expect(await locationQueue.size()).toBe(0);
    expect(nativeStore.has(STORAGE_KEY)).toBe(false);
  });

  for (const statusCode of [401, 429, 500, 0]) {
    it(`conserva la cola ante ${statusCode}, donde reintentar sí sirve`, async () => {
      mockPublishBatch.mockResolvedValue(retryLater(statusCode));
      await locationQueue.enqueue(RIDE_A, point());

      const emptied = await locationQueue.flush("token");

      expect(emptied).toBe(false);
      expect(await locationQueue.size()).toBe(1);
    });
  }

  it("vacía la cola ante un error permanente", async () => {
    // Un punto que el servidor nunca va a aceptar bloquearía la cabeza de la
    // cola para siempre si se conservara.
    mockPublishBatch.mockResolvedValue({
      drain: true,
      statusCode: 409,
      accepted: 0,
      duplicates: 0,
      rejected: 0,
    });
    await locationQueue.enqueue(RIDE_A, point());

    expect(await locationQueue.flush("token")).toBe(true);
    expect(await locationQueue.size()).toBe(0);
  });

  it("corta el lote al cambiar de viaje", async () => {
    // El endpoint es por viaje: mezclar dos en una llamada perdería puntos.
    await locationQueue.enqueue(RIDE_A, point(0));
    await locationQueue.enqueue(RIDE_A, point(5000));
    await locationQueue.enqueue(RIDE_B, point(10000));

    await locationQueue.flush("token");

    expect(mockPublishBatch).toHaveBeenCalledTimes(2);
    expect(mockPublishBatch.mock.calls[0]?.[1]).toBe(RIDE_A);
    expect(mockPublishBatch.mock.calls[1]?.[1]).toBe(RIDE_B);
  });

  it("trocea en lotes de 200 como máximo", async () => {
    for (let i = 0; i < 450; i += 1) {
      await locationQueue.enqueue(RIDE_A, point(i * 1000));
    }

    await locationQueue.flush("token");

    expect(mockPublishBatch).toHaveBeenCalledTimes(3);
    const sizes = mockPublishBatch.mock.calls.map(
      (call) => (call[2] as unknown[]).length,
    );
    expect(sizes).toEqual([200, 200, 50]);
  });

  it("se detiene en el primer lote que pide conservarse", async () => {
    for (let i = 0; i < 450; i += 1) {
      await locationQueue.enqueue(RIDE_A, point(i * 1000));
    }
    mockPublishBatch
      .mockResolvedValueOnce(accepted(200))
      .mockResolvedValueOnce(retryLater(500));

    const emptied = await locationQueue.flush("token");

    expect(emptied).toBe(false);
    // Solo se descartó el lote que sí entró.
    expect(await locationQueue.size()).toBe(250);
    expect(mockPublishBatch).toHaveBeenCalledTimes(2);
  });

  it("no lanza dos drenados a la vez", async () => {
    await locationQueue.enqueue(RIDE_A, point());
    let release: (() => void) | null = null;
    mockPublishBatch.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve(accepted(1));
        }),
    );

    const first = locationQueue.flush("token");
    await Promise.resolve();
    const second = await locationQueue.flush("token");

    expect(second).toBe(false);
    expect(mockPublishBatch).toHaveBeenCalledTimes(1);

    release?.();
    await first;
  });

  it("borra el historial al limpiar", async () => {
    // Privacidad: son posiciones precisas del conductor en disco.
    await locationQueue.enqueue(RIDE_A, point());

    await locationQueue.clear();

    expect(await locationQueue.size()).toBe(0);
    expect(nativeStore.has(STORAGE_KEY)).toBe(false);
  });

  it("descarta registros corruptos sin tirar la cola entera", async () => {
    nativeStore.set(
      STORAGE_KEY,
      JSON.stringify([
        { rideId: RIDE_A, point: point(0) },
        { rideId: RIDE_A, point: { lat: "roto" } },
        null,
        { rideId: RIDE_A, point: point(5000) },
      ]),
    );

    expect(await locationQueue.size()).toBe(2);
  });

  it("sobrevive a un almacenamiento con contenido ilegible", async () => {
    nativeStore.set(STORAGE_KEY, "{no es json");

    expect(await locationQueue.size()).toBe(0);
  });

  it("no llama al backend con la cola vacía", async () => {
    expect(await locationQueue.flush("token")).toBe(true);
    expect(mockPublishBatch).not.toHaveBeenCalled();
  });
});
