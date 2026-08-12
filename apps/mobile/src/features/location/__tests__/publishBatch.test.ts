import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Contrato de drenado de la cola offline.
 *
 * La decisión que protege este archivo: con cualquier 2xx —y también con los
 * errores permanentes— el cliente BORRA de su cola los puntos enviados. Si
 * conservara un punto que el servidor nunca va a aceptar, ese punto quedaría
 * en la cabeza de la cola bloqueando todo lo que viene detrás para siempre.
 *
 * Lo contrario también importa: ante 401, 429, 5xx o caída de red los puntos
 * se CONSERVAN, porque ahí reintentar sí sirve. Es justo el escenario de Rapa
 * Nui, donde la señal va y viene.
 */

const { mockPost } = vi.hoisted(() => ({ mockPost: vi.fn() }));

vi.mock("../../../services/api/index.js", () => ({
  apiClient: { post: mockPost, get: vi.fn() },
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => false },
}));

vi.mock("@capacitor/app", () => ({ App: { addListener: vi.fn() } }));
vi.mock("@capacitor/geolocation", () => ({ Geolocation: {} }));
vi.mock("../nativeBackgroundLocation.plugin.js", () => ({
  NativeBackgroundLocation: {},
}));

const { rideLocationService } = await import("../rideLocation.service.js");

const RIDE_ID = "44444444-4444-4444-8444-444444444444";

function point(overrides: Record<string, unknown> = {}) {
  return {
    lat: -27.1501,
    lng: -109.4301,
    accuracyMeters: 5,
    headingDegrees: 180,
    speedMetersPerSecond: 7,
    altitudeMeters: 20,
    capturedAt: new Date().toISOString(),
    source: "background_native" as const,
    appState: "background" as const,
    sequenceNumber: null,
    isMocked: false,
    ...overrides,
  };
}

function okResponse(data: Record<string, unknown>) {
  return {
    ok: true,
    statusCode: 200,
    data: { ok: true, statusCode: 200, data },
  };
}

describe("rideLocationService.publishBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("drena la cola cuando el servidor acepta todo", async () => {
    mockPost.mockResolvedValue(
      okResponse({
        received: 3,
        accepted: 3,
        duplicates: 0,
        rejected: [],
        latest: null,
      }),
    );

    const outcome = await rideLocationService.publishBatch("token", RIDE_ID, [
      point(),
    ]);

    expect(outcome.drain).toBe(true);
    expect(outcome.accepted).toBe(3);
  });

  it("drena igual aunque el servidor rechace puntos concretos", async () => {
    // Éxito parcial: conservar los rechazados los dejaría atascados para
    // siempre, porque el motivo del rechazo no cambia con el tiempo.
    mockPost.mockResolvedValue(
      okResponse({
        received: 4,
        accepted: 1,
        duplicates: 0,
        rejected: [
          { index: 1, code: "TOO_CLOSE" },
          { index: 2, code: "FUTURE_TIMESTAMP" },
          { index: 3, code: "OUT_OF_RIDE_WINDOW" },
        ],
        latest: null,
      }),
    );

    const outcome = await rideLocationService.publishBatch("token", RIDE_ID, [
      point(),
    ]);

    expect(outcome.drain).toBe(true);
    expect(outcome.rejected).toBe(3);
  });

  it("cuenta los duplicados sin tratarlos como fallo", async () => {
    mockPost.mockResolvedValue(
      okResponse({
        received: 5,
        accepted: 2,
        duplicates: 3,
        rejected: [],
        latest: null,
      }),
    );

    const outcome = await rideLocationService.publishBatch("token", RIDE_ID, [
      point(),
    ]);

    expect(outcome.drain).toBe(true);
    expect(outcome.duplicates).toBe(3);
  });

  for (const statusCode of [400, 403, 404, 409]) {
    it(`drena ante ${statusCode}, que no mejora reintentando`, async () => {
      mockPost.mockResolvedValue({
        ok: false,
        statusCode,
        code: "SOME_ERROR",
        message: "no",
      });

      const outcome = await rideLocationService.publishBatch("token", RIDE_ID, [
        point(),
      ]);

      expect(outcome.drain).toBe(true);
      expect(outcome.accepted).toBe(0);
    });
  }

  for (const statusCode of [401, 429, 500, 503, 0]) {
    it(`conserva la cola ante ${statusCode}, donde reintentar sí sirve`, async () => {
      mockPost.mockResolvedValue({
        ok: false,
        statusCode,
        code: "SOME_ERROR",
        message: "no",
      });

      const outcome = await rideLocationService.publishBatch("token", RIDE_ID, [
        point(),
      ]);

      expect(outcome.drain).toBe(false);
    });
  }

  it("no lanza nunca: el drenador necesita decidir, no capturar", async () => {
    mockPost.mockResolvedValue({
      ok: false,
      statusCode: 500,
      code: "INTERNAL",
      message: "boom",
    });

    await expect(
      rideLocationService.publishBatch("token", RIDE_ID, [point()]),
    ).resolves.toBeDefined();
  });

  it("sanea cada punto antes de enviarlo", async () => {
    mockPost.mockResolvedValue(
      okResponse({
        received: 1,
        accepted: 1,
        duplicates: 0,
        rejected: [],
        latest: null,
      }),
    );

    await rideLocationService.publishBatch("token", RIDE_ID, [
      point({ accuracyMeters: 50000, headingDegrees: -1 }),
    ]);

    const body = mockPost.mock.calls[0]?.[1] as {
      points: { accuracyMeters: number | null; headingDegrees: number | null }[];
    };

    expect(body.points[0]?.accuracyMeters).toBeNull();
    expect(body.points[0]?.headingDegrees).toBeNull();
  });

  it("no reintenta por dentro: el backoff es del drenador", async () => {
    mockPost.mockResolvedValue(
      okResponse({
        received: 1,
        accepted: 1,
        duplicates: 0,
        rejected: [],
        latest: null,
      }),
    );

    await rideLocationService.publishBatch("token", RIDE_ID, [point()]);

    expect(mockPost).toHaveBeenCalledTimes(1);
    // El último argumento de apiClient.post son los reintentos.
    expect(mockPost.mock.calls[0]?.[3]).toBe(0);
  });
});
