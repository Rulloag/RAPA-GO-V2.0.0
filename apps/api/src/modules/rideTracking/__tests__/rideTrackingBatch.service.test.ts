import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Endpoint de lote: drenar la cola offline del conductor.
 *
 * La regla que gobierna todo el diseño: el antispam del punto en vivo compara
 * contra el ÚLTIMO punto guardado. Aplicado a un histórico, descartaría el lote
 * entero, porque todos sus puntos son más antiguos que ese último. Por eso el
 * lote usa un cursor que avanza dentro del propio lote.
 */

const {
  mockVerifyAccessToken,
  mockHashToken,
  mockIsSessionValid,
  mockFindUserById,
  mockFindRideById,
  mockFindLatest,
  mockInsert,
  mockInsertMany,
  mockListRoute,
} = vi.hoisted(() => ({
  mockVerifyAccessToken: vi.fn(),
  mockHashToken: vi.fn().mockReturnValue("hash"),
  mockIsSessionValid: vi.fn().mockResolvedValue(true),
  mockFindUserById: vi.fn(),
  mockFindRideById: vi.fn(),
  mockFindLatest: vi.fn(),
  mockInsert: vi.fn(),
  mockInsertMany: vi.fn(),
  mockListRoute: vi.fn(),
}));

vi.mock("../../auth/token.service.js", () => ({
  TokenService: vi.fn().mockImplementation(() => ({
    verifyAccessToken: mockVerifyAccessToken,
    hashToken: mockHashToken,
  })),
}));

vi.mock("../../auth/session.service.js", () => ({
  SessionService: vi.fn().mockImplementation(() => ({
    isSessionValid: mockIsSessionValid,
  })),
}));

vi.mock("../../users/users.repository.js", () => ({
  UsersRepository: vi.fn().mockImplementation(() => ({
    findById: mockFindUserById,
  })),
}));

vi.mock("../rideTracking.repository.js", () => ({
  RideTrackingRepository: vi.fn().mockImplementation(() => ({
    findRideById: mockFindRideById,
    findLatest: mockFindLatest,
    insert: mockInsert,
    insertMany: mockInsertMany,
    listRoute: mockListRoute,
  })),
}));

const { RideTrackingService } = await import("../rideTracking.service.js");

const DRIVER_ID = "11111111-1111-4111-8111-111111111111";
const PASSENGER_ID = "22222222-2222-4222-8222-222222222222";
const RIDE_ID = "44444444-4444-4444-8444-444444444444";

const NOW = new Date("2026-08-11T18:00:00.000Z");
/** El viaje se aceptó dos horas antes: ventana amplia y realista. */
const ACCEPTED_AT = new Date(NOW.getTime() - 2 * 60 * 60 * 1000);

function ride(overrides: Record<string, unknown> = {}) {
  return {
    id: RIDE_ID,
    passengerUserId: PASSENGER_ID,
    driverUserId: DRIVER_ID,
    status: "in_progress",
    requestedAt: ACCEPTED_AT,
    acceptedAt: ACCEPTED_AT,
    completedAt: null,
    cancelledAt: null,
    createdAt: ACCEPTED_AT,
    ...overrides,
  };
}

/** Un punto de entrada tal como lo manda el cliente. */
function input(overrides: Record<string, unknown> = {}) {
  return {
    lat: -27.1501,
    lng: -109.4301,
    accuracyMeters: 5,
    headingDegrees: 180,
    speedMetersPerSecond: 7,
    altitudeMeters: 20,
    capturedAt: new Date(NOW.getTime() - 60_000).toISOString(),
    source: "background_native" as const,
    appState: "background" as const,
    sequenceNumber: 1,
    isMocked: false,
    ...overrides,
  };
}

/** Una fila tal como la devuelve la base. */
function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "55555555-5555-4555-8555-555555555555",
    rideId: RIDE_ID,
    driverUserId: DRIVER_ID,
    latitude: -27.1501,
    longitude: -109.4301,
    accuracyMeters: 5,
    headingDegrees: 180,
    speedMetersPerSecond: 7,
    altitudeMeters: 20,
    capturedAt: NOW,
    receivedAt: NOW,
    source: "background_native",
    appState: "background",
    sequenceNumber: 1,
    isMocked: false,
    expiresAt: new Date(NOW.getTime() + 100000),
    ...overrides,
  };
}

/**
 * Genera puntos separados en tiempo y espacio suficientes para no disparar el
 * antispam (>1,5 s y >2 m entre consecutivos).
 */
function track(count: number, startOffsetMs: number) {
  return Array.from({ length: count }, (_, i) => {
    return input({
      capturedAt: new Date(NOW.getTime() - startOffsetMs + i * 5000).toISOString(),
      // ~11 m por paso: bien por encima del mínimo de 2 m.
      lat: -27.1501 + i * 0.0001,
    });
  });
}

function authenticateAsDriver() {
  mockVerifyAccessToken.mockReturnValue({ sub: DRIVER_ID });
  mockFindUserById.mockResolvedValue({
    id: DRIVER_ID,
    role: "driver",
    status: "active",
  });
}

describe("RideTrackingService.publishBatch", () => {
  let service: InstanceType<typeof RideTrackingService>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    service = new RideTrackingService();
    mockIsSessionValid.mockResolvedValue(true);
    mockFindLatest.mockResolvedValue(null);
    // Por defecto, todo lo enviado se inserta.
    mockInsertMany.mockImplementation(async (rows: unknown[]) =>
      rows.map(() => row()),
    );
    authenticateAsDriver();
    mockFindRideById.mockResolvedValue(ride());
  });

  it("acepta un backlog de 40 minutos", async () => {
    // La regresión que justifica reemplazar el MAX_CLOCK_SKEW_MS simétrico:
    // con la regla del punto en vivo, este lote entero se habría perdido.
    const points = track(8, 40 * 60 * 1000);

    const result = await service.publishBatch("token", RIDE_ID, points);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.received).toBe(8);
    expect(result.data.accepted).toBe(8);
    expect(result.data.rejected).toEqual([]);
  });

  it("ordena por captura un lote que llega desordenado", async () => {
    const points = track(4, 10 * 60 * 1000);
    const shuffled = [points[2], points[0], points[3], points[1]];

    const result = await service.publishBatch("token", RIDE_ID, shuffled as never);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.accepted).toBe(4);

    const saved = mockInsertMany.mock.calls[0]?.[0] as { capturedAt: Date }[];
    const times = saved.map((r) => r.capturedAt.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it("rechaza como TOO_CLOSE los puntos pegados entre sí dentro del lote", async () => {
    // Cuatro puntos a 200 ms y en la misma coordenada: ruido de GPS parado.
    const base = NOW.getTime() - 5 * 60 * 1000;
    const points = Array.from({ length: 4 }, (_, i) =>
      input({ capturedAt: new Date(base + i * 200).toISOString() }),
    );

    const result = await service.publishBatch("token", RIDE_ID, points);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // El primero entra y fija el cursor; los otros tres caen contra él.
    expect(result.data.accepted).toBe(1);
    expect(result.data.rejected).toHaveLength(3);
    expect(result.data.rejected.every((r) => r.code === "TOO_CLOSE")).toBe(true);
  });

  it("informa el índice ORIGINAL del punto rechazado, no el ordenado", async () => {
    const good = input({
      capturedAt: new Date(NOW.getTime() - 10 * 60 * 1000).toISOString(),
    });
    const future = input({
      capturedAt: new Date(NOW.getTime() + 60 * 60 * 1000).toISOString(),
    });
    const alsoGood = input({
      capturedAt: new Date(NOW.getTime() - 9 * 60 * 1000).toISOString(),
      lat: -27.152,
    });

    // El futuro va en la posición 1; tras ordenar quedaría el último.
    const result = await service.publishBatch("token", RIDE_ID, [
      good,
      future,
      alsoGood,
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.rejected).toEqual([
      { index: 1, code: "FUTURE_TIMESTAMP" },
    ]);
  });

  it("rechaza por punto lo que cae fuera de la ventana del viaje", async () => {
    const inside = input({
      capturedAt: new Date(NOW.getTime() - 10 * 60 * 1000).toISOString(),
    });
    // Muy anterior a la aceptación del viaje.
    const outside = input({
      capturedAt: new Date(ACCEPTED_AT.getTime() - 60 * 60 * 1000).toISOString(),
      lat: -27.16,
    });

    const result = await service.publishBatch("token", RIDE_ID, [
      inside,
      outside,
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.accepted).toBe(1);
    expect(result.data.rejected).toEqual([
      { index: 1, code: "OUT_OF_RIDE_WINDOW" },
    ]);
  });

  it("acepta puntos históricos de un viaje ya completado", async () => {
    // Es el caso real: la señal vuelve cuando el conductor ya cerró el viaje.
    const completedAt = new Date(NOW.getTime() - 3 * 60 * 1000);
    mockFindRideById.mockResolvedValue(
      ride({ status: "completed", completedAt }),
    );

    const points = track(5, 30 * 60 * 1000);
    const result = await service.publishBatch("token", RIDE_ID, points);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.accepted).toBe(5);
  });

  it("rechaza el lote entero en un viaje que nunca tuvo rastreo", async () => {
    mockFindRideById.mockResolvedValue(ride({ status: "requested" }));

    const result = await service.publishBatch("token", RIDE_ID, track(3, 60_000));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("RIDE_TRACKING_INACTIVE");
    expect(result.statusCode).toBe(409);
    expect(mockInsertMany).not.toHaveBeenCalled();
  });

  it("no arranca el cursor en lo guardado si el lote es más antiguo", async () => {
    // Ya hay un punto reciente en la base. Sin el reinicio del cursor, el
    // primer punto del backlog se compararía contra él y podría descartarse.
    mockFindLatest.mockResolvedValue(
      row({ capturedAt: new Date(NOW.getTime() - 30_000) }),
    );

    const points = track(6, 35 * 60 * 1000);
    const result = await service.publishBatch("token", RIDE_ID, points);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.accepted).toBe(6);
    expect(result.data.rejected).toEqual([]);
  });

  it("sí compara contra lo guardado cuando el lote lo continúa", async () => {
    const lastStored = new Date(NOW.getTime() - 5 * 60 * 1000);
    mockFindLatest.mockResolvedValue(
      row({ capturedAt: lastStored, latitude: -27.1501, longitude: -109.4301 }),
    );

    // Punto 300 ms después del guardado y en el mismo sitio: duplicado real.
    const result = await service.publishBatch("token", RIDE_ID, [
      input({
        capturedAt: new Date(lastStored.getTime() + 300).toISOString(),
      }),
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.accepted).toBe(0);
    expect(result.data.rejected).toEqual([{ index: 0, code: "TOO_CLOSE" }]);
  });

  it("cuenta como duplicados los puntos que la base ya tenía", async () => {
    // insertMany devuelve solo lo realmente insertado: el índice único filtró
    // dos filas que ya existían de un envío anterior cuya respuesta se perdió.
    mockInsertMany.mockResolvedValue([row(), row()]);

    const result = await service.publishBatch("token", RIDE_ID, track(5, 600_000));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.accepted).toBe(2);
    expect(result.data.duplicates).toBe(3);
    expect(result.data.rejected).toEqual([]);
  });

  it("devuelve cuentas exactas en un lote mixto", async () => {
    const base = NOW.getTime() - 20 * 60 * 1000;
    const points = [
      input({ capturedAt: new Date(base).toISOString() }),
      // Pegado al anterior: TOO_CLOSE.
      input({ capturedAt: new Date(base + 200).toISOString() }),
      // Separado: entra.
      input({ capturedAt: new Date(base + 9000).toISOString(), lat: -27.155 }),
      // Futuro: FUTURE_TIMESTAMP.
      input({ capturedAt: new Date(NOW.getTime() + 3600_000).toISOString() }),
    ];
    mockInsertMany.mockImplementation(async (rows: unknown[]) =>
      rows.map(() => row()),
    );

    const result = await service.publishBatch("token", RIDE_ID, points);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.received).toBe(4);
    expect(result.data.accepted).toBe(2);
    expect(result.data.duplicates).toBe(0);
    expect(result.data.rejected).toEqual([
      { index: 1, code: "TOO_CLOSE" },
      { index: 3, code: "FUTURE_TIMESTAMP" },
    ]);
  });

  it("no consulta la última ubicación de nuevo si no insertó nada", async () => {
    const stored = row({ capturedAt: new Date(NOW.getTime() - 30_000) });
    mockFindLatest.mockResolvedValue(stored);
    mockInsertMany.mockResolvedValue([]);

    const result = await service.publishBatch("token", RIDE_ID, [
      input({ capturedAt: new Date(NOW.getTime() - 29_800).toISOString() }),
    ]);

    expect(result.ok).toBe(true);
    // Una sola lectura: la del cursor. La respuesta reutiliza ese valor.
    expect(mockFindLatest).toHaveBeenCalledTimes(1);
  });

  it("rechaza a un conductor que no es el asignado", async () => {
    mockVerifyAccessToken.mockReturnValue({ sub: PASSENGER_ID });
    mockFindUserById.mockResolvedValue({
      id: PASSENGER_ID,
      role: "driver",
      status: "active",
    });

    const result = await service.publishBatch("token", RIDE_ID, track(2, 60_000));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("RIDE_TRACKING_NOT_ASSIGNED");
    expect(mockInsertMany).not.toHaveBeenCalled();
  });

  it("rechaza a un pasajero", async () => {
    mockVerifyAccessToken.mockReturnValue({ sub: PASSENGER_ID });
    mockFindUserById.mockResolvedValue({
      id: PASSENGER_ID,
      role: "passenger",
      status: "active",
    });

    const result = await service.publishBatch("token", RIDE_ID, track(2, 60_000));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("AUTH_FORBIDDEN");
    expect(mockInsertMany).not.toHaveBeenCalled();
  });

  it("marca los puntos con el origen que declaró el cliente", async () => {
    await service.publishBatch("token", RIDE_ID, [
      input({
        source: "background_native",
        appState: "background",
        capturedAt: new Date(NOW.getTime() - 120_000).toISOString(),
      }),
    ]);

    expect(mockInsertMany).toHaveBeenCalledWith([
      expect.objectContaining({
        rideId: RIDE_ID,
        driverUserId: DRIVER_ID,
        source: "background_native",
        appState: "background",
      }),
    ]);
  });
});
