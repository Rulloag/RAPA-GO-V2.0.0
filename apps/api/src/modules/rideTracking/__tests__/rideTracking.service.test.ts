import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockVerifyAccessToken,
  mockHashToken,
  mockIsSessionValid,
  mockFindUserById,
  mockFindRideById,
  mockFindLatest,
  mockInsert,
  mockListRoute,
} = vi.hoisted(() => ({
  mockVerifyAccessToken: vi.fn(),
  mockHashToken: vi.fn().mockReturnValue("hash"),
  mockIsSessionValid: vi.fn().mockResolvedValue(true),
  mockFindUserById: vi.fn(),
  mockFindRideById: vi.fn(),
  mockFindLatest: vi.fn(),
  mockInsert: vi.fn(),
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
    listRoute: mockListRoute,
  })),
}));

const { RideTrackingService } = await import("../rideTracking.service.js");

const DRIVER_ID = "11111111-1111-4111-8111-111111111111";
const PASSENGER_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_ID = "33333333-3333-4333-8333-333333333333";
const RIDE_ID = "44444444-4444-4444-8444-444444444444";

const ride = {
  id: RIDE_ID,
  passengerUserId: PASSENGER_ID,
  driverUserId: DRIVER_ID,
  status: "in_progress",
};

function point(overrides: Record<string, unknown> = {}) {
  const now = new Date();
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
    capturedAt: now,
    receivedAt: now,
    source: "foreground_native",
    appState: "foreground",
    sequenceNumber: 1,
    isMocked: false,
    expiresAt: new Date(now.getTime() + 100000),
    ...overrides,
  };
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    lat: -27.1501,
    lng: -109.4301,
    accuracyMeters: 5,
    headingDegrees: 180,
    speedMetersPerSecond: 7,
    altitudeMeters: 20,
    capturedAt: new Date().toISOString(),
    source: "foreground_native" as const,
    appState: "foreground" as const,
    sequenceNumber: 1,
    isMocked: false,
    ...overrides,
  };
}

describe("RideTrackingService", () => {
  let service: InstanceType<typeof RideTrackingService>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RideTrackingService();
    mockIsSessionValid.mockResolvedValue(true);
    mockFindLatest.mockResolvedValue(null);
  });

  it("permite al conductor asignado publicar ubicación", async () => {
    mockVerifyAccessToken.mockReturnValue({ sub: DRIVER_ID });
    mockFindUserById.mockResolvedValue({ id: DRIVER_ID, role: "driver", status: "active" });
    mockFindRideById.mockResolvedValue(ride);
    mockInsert.mockResolvedValue(point());

    const result = await service.publish("token", RIDE_ID, payload());

    expect(result.ok).toBe(true);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        rideId: RIDE_ID,
        driverUserId: DRIVER_ID,
        latitude: -27.1501,
        longitude: -109.4301,
      }),
    );
  });

  it("rechaza publicación de un pasajero", async () => {
    mockVerifyAccessToken.mockReturnValue({ sub: PASSENGER_ID });
    mockFindUserById.mockResolvedValue({ id: PASSENGER_ID, role: "passenger", status: "active" });

    const result = await service.publish("token", RIDE_ID, payload());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("AUTH_FORBIDDEN");
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("rechaza a un conductor no asignado", async () => {
    mockVerifyAccessToken.mockReturnValue({ sub: OTHER_ID });
    mockFindUserById.mockResolvedValue({ id: OTHER_ID, role: "driver", status: "active" });
    mockFindRideById.mockResolvedValue(ride);

    const result = await service.publish("token", RIDE_ID, payload());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("RIDE_TRACKING_NOT_ASSIGNED");
  });

  it("no guarda puntos cuando el viaje está cerrado", async () => {
    mockVerifyAccessToken.mockReturnValue({ sub: DRIVER_ID });
    mockFindUserById.mockResolvedValue({ id: DRIVER_ID, role: "driver", status: "active" });
    mockFindRideById.mockResolvedValue({ ...ride, status: "completed" });

    const result = await service.publish("token", RIDE_ID, payload());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("RIDE_TRACKING_INACTIVE");
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("rechaza un punto con fecha demasiado antigua", async () => {
    mockVerifyAccessToken.mockReturnValue({ sub: DRIVER_ID });
    mockFindUserById.mockResolvedValue({ id: DRIVER_ID, role: "driver", status: "active" });
    mockFindRideById.mockResolvedValue(ride);

    const result = await service.publish(
      "token",
      RIDE_ID,
      payload({ capturedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString() }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("RIDE_TRACKING_STALE_POINT");
  });

  it("deduplica puntos demasiado cercanos", async () => {
    const latest = point({
      capturedAt: new Date(Date.now() - 500),
      latitude: -27.1501,
      longitude: -109.4301,
    });
    mockVerifyAccessToken.mockReturnValue({ sub: DRIVER_ID });
    mockFindUserById.mockResolvedValue({ id: DRIVER_ID, role: "driver", status: "active" });
    mockFindRideById.mockResolvedValue(ride);
    mockFindLatest.mockResolvedValue(latest);

    const result = await service.publish("token", RIDE_ID, payload());

    expect(result.ok).toBe(true);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("permite al pasajero del viaje leer la última ubicación", async () => {
    mockVerifyAccessToken.mockReturnValue({ sub: PASSENGER_ID });
    mockFindUserById.mockResolvedValue({ id: PASSENGER_ID, role: "passenger", status: "active" });
    mockFindRideById.mockResolvedValue(ride);
    mockFindLatest.mockResolvedValue(point());

    const result = await service.latest("token", RIDE_ID);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data?.rideId).toBe(RIDE_ID);
  });

  it("impide leer ubicación de un viaje ajeno", async () => {
    mockVerifyAccessToken.mockReturnValue({ sub: OTHER_ID });
    mockFindUserById.mockResolvedValue({ id: OTHER_ID, role: "passenger", status: "active" });
    mockFindRideById.mockResolvedValue(ride);

    const result = await service.latest("token", RIDE_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("AUTH_FORBIDDEN");
  });

  it("entrega la ruta al administrador", async () => {
    mockVerifyAccessToken.mockReturnValue({ sub: OTHER_ID });
    mockFindUserById.mockResolvedValue({ id: OTHER_ID, role: "admin", status: "active" });
    mockFindRideById.mockResolvedValue(ride);
    mockListRoute.mockResolvedValue([point(), point({ id: "66666666-6666-4666-8666-666666666666" })]);

    const result = await service.route("token", RIDE_ID, 500);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toHaveLength(2);
  });
});
