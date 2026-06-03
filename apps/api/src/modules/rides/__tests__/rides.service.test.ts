import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks must be declared before the import under test ──────────────────────

const mockCreate         = vi.fn();
const mockFindById       = vi.fn();
const mockFindByPassenger = vi.fn();
const mockFindByPassengerWithDriver = vi.fn();
const mockMarkEnRoute    = vi.fn();
const mockMarkArrived    = vi.fn();
const mockIsSessionValid = vi.fn().mockResolvedValue(true);
const mockFindUserById   = vi.fn();
const mockFindDriverStatusById = vi.fn();

vi.mock("../rides.repository.js", () => ({
  RidesRepository: vi.fn().mockImplementation(() => ({
    create:                       mockCreate,
    findById:                     mockFindById,
    findByIdAndPassenger:         mockFindByPassenger,
    findByPassengerId:            vi.fn().mockResolvedValue([]),
    findByPassengerIdWithDriver:  mockFindByPassengerWithDriver.mockResolvedValue([]),
    findAvailable:                vi.fn().mockResolvedValue([]),
    findByDriverId:               vi.fn().mockResolvedValue([]),
    accept:                       vi.fn(),
    complete:                     vi.fn(),
    start:                        vi.fn(),
    cancel:                       vi.fn(),
    cancelAccepted:               vi.fn(),
    markEnRoute:                  mockMarkEnRoute,
    markArrived:                  mockMarkArrived,
  })),
}));

vi.mock("../../auth/token.service.js", () => ({
  TokenService: vi.fn().mockImplementation(() => ({
    verifyAccessToken: vi.fn().mockReturnValue({ sub: "user-123" }),
    hashToken:         vi.fn().mockReturnValue("hash"),
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

vi.mock("../../drivers/driverStatus.repository.js", () => ({
  DriverStatusRepository: vi.fn().mockImplementation(() => ({
    findByDriverId: mockFindDriverStatusById,
    setBusy:        vi.fn(),
    setAvailable:   vi.fn(),
    updateLocation: vi.fn(),
  })),
}));

// ── Import after mocks ────────────────────────────────────────────────────────
const { RidesService } = await import("../rides.service.js");

// ── Helpers ───────────────────────────────────────────────────────────────────

const NOW = new Date();

function makeRide(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id:                    "ride-1",
    passengerUserId:       "user-123",
    driverUserId:          null,
    originText:            "Hanga Roa",
    destinationText:       "Aeropuerto Mataveri",
    notes:                 null,
    estimatedFareClp:      5000,
    originLat:             -27.15,
    originLng:             -109.43,
    destinationLat:        -27.16,
    destinationLng:        -109.42,
    distanceMeters:        2000,
    durationSeconds:       300,
    fareCalculationSource: "google_maps",
    status:                "requested",
    requestedAt:           NOW,
    acceptedAt:            null,
    enRouteAt:             null,
    arrivedAt:             null,
    startedAt:             null,
    completedAt:           null,
    cancelledAt:           null,
    cancellationReason:    null,
    cancelledByUserId:     null,
    cancelledByRole:       null,
    isOfflineBooking:      null,
    offlinePassengerName:  null,
    offlinePassengerPhone: null,
    offlinePassengerEmail: null,
    createdAt:             NOW,
    updatedAt:             NOW,
    ...overrides,
  };
}

const VALID_INPUT = {
  originText:      "Hanga Roa",
  destinationText: "Aeropuerto Mataveri",
  originLat:       -27.15,
  originLng:       -109.43,
  destinationLat:  -27.16,
  destinationLng:  -109.42,
  distanceMeters:  2000,
  durationSeconds: 300,
  notes:           undefined,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("RidesService.createRideRequest", () => {
  let service: InstanceType<typeof RidesService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSessionValid.mockResolvedValue(true);
    service = new RidesService();
  });

  it("passenger can create ride with valid coordinates", async () => {
    mockFindUserById.mockResolvedValue({ id: "user-123", role: "passenger" });
    const ride = makeRide();
    mockCreate.mockResolvedValue(ride);

    const result = await service.createRideRequest("token", VALID_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ride.originLat).toBe(-27.15);
    expect(result.ride.distanceMeters).toBe(2000);
    expect(result.ride.fareCalculationSource).toBe("google_maps");
    expect(mockCreate).toHaveBeenCalledOnce();
    const createArg = mockCreate.mock.calls[0]![0] as Record<string, unknown>;
    expect(createArg["originLat"]).toBe(-27.15);
    expect(createArg["distanceMeters"]).toBe(2000);
  });

  it("driver role returns 403", async () => {
    mockFindUserById.mockResolvedValue({ id: "user-123", role: "driver" });

    const result = await service.createRideRequest("token", VALID_INPUT);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.statusCode).toBe(403);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("calculates fare from distanceMeters — 2 km should yield at least 3000 CLP", async () => {
    mockFindUserById.mockResolvedValue({ id: "user-123", role: "passenger" });
    mockCreate.mockImplementation((data: Record<string, unknown>) =>
      Promise.resolve(makeRide({ estimatedFareClp: data["estimatedFareClp"] as number })),
    );

    const result = await service.createRideRequest("token", { ...VALID_INPUT, distanceMeters: 2000 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 2 km × 2300 CLP/km = 4600 CLP, min 3000 → should be 4600
    expect(result.ride.estimatedFareClp).toBe(4600);
  });

  it("respects minimum fare — very short ride (1 m) returns minimum", async () => {
    mockFindUserById.mockResolvedValue({ id: "user-123", role: "passenger" });
    mockCreate.mockImplementation((data: Record<string, unknown>) =>
      Promise.resolve(makeRide({ estimatedFareClp: data["estimatedFareClp"] as number })),
    );

    const shortInput = { ...VALID_INPUT, distanceMeters: 1 };
    const result = await service.createRideRequest("token", shortInput);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 0.001 km × 2300 = 2.3 CLP → below min → should be 3000
    expect(result.ride.estimatedFareClp).toBeGreaterThanOrEqual(3000);
  });

  it("never returns a negative fare", async () => {
    mockFindUserById.mockResolvedValue({ id: "user-123", role: "passenger" });
    mockCreate.mockImplementation((data: Record<string, unknown>) =>
      Promise.resolve(makeRide({ estimatedFareClp: data["estimatedFareClp"] as number })),
    );

    const result = await service.createRideRequest("token", VALID_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ride.estimatedFareClp).toBeGreaterThanOrEqual(0);
  });

  it("stores coordinates in the created ride", async () => {
    mockFindUserById.mockResolvedValue({ id: "user-123", role: "passenger" });
    mockCreate.mockResolvedValue(makeRide());

    await service.createRideRequest("token", VALID_INPUT);

    const callArg = mockCreate.mock.calls[0]![0] as Record<string, unknown>;
    expect(callArg["originLat"]).toBe(VALID_INPUT.originLat);
    expect(callArg["originLng"]).toBe(VALID_INPUT.originLng);
    expect(callArg["destinationLat"]).toBe(VALID_INPUT.destinationLat);
    expect(callArg["destinationLng"]).toBe(VALID_INPUT.destinationLng);
    expect(callArg["durationSeconds"]).toBe(VALID_INPUT.durationSeconds);
  });
});

// ── markEnRoute ───────────────────────────────────────────────────────────────

describe("RidesService.markEnRoute", () => {
  let service: InstanceType<typeof RidesService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSessionValid.mockResolvedValue(true);
    service = new RidesService();
  });

  it("driver can mark en-route an accepted ride assigned to them", async () => {
    mockFindUserById.mockResolvedValue({ id: "driver-1", role: "driver" });
    const ride = makeRide({ status: "driver_en_route", driverUserId: "driver-1", enRouteAt: new Date() });
    mockMarkEnRoute.mockResolvedValue(ride);

    const result = await service.markEnRoute("token", "ride-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ride.status).toBe("driver_en_route");
    expect(mockMarkEnRoute).toHaveBeenCalledWith("ride-1", "driver-1");
  });

  it("passenger role returns 403", async () => {
    mockFindUserById.mockResolvedValue({ id: "user-123", role: "passenger" });

    const result = await service.markEnRoute("token", "ride-1");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.statusCode).toBe(403);
    expect(mockMarkEnRoute).not.toHaveBeenCalled();
  });

  it("returns 409 when ride is not in accepted status", async () => {
    mockFindUserById.mockResolvedValue({ id: "driver-1", role: "driver" });
    mockMarkEnRoute.mockResolvedValue(null);
    mockFindById.mockResolvedValue(makeRide({ status: "in_progress", driverUserId: "driver-1" }));

    const result = await service.markEnRoute("token", "ride-1");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.statusCode).toBe(409);
    expect(result.code).toBe("RIDE_CANNOT_MARK_EN_ROUTE");
  });

  it("returns 403 when ride belongs to a different driver", async () => {
    mockFindUserById.mockResolvedValue({ id: "driver-1", role: "driver" });
    mockMarkEnRoute.mockResolvedValue(null);
    mockFindById.mockResolvedValue(makeRide({ status: "accepted", driverUserId: "driver-99" }));

    const result = await service.markEnRoute("token", "ride-1");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.statusCode).toBe(403);
  });
});

// ── markArrived ───────────────────────────────────────────────────────────────

describe("RidesService.markArrived", () => {
  let service: InstanceType<typeof RidesService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSessionValid.mockResolvedValue(true);
    service = new RidesService();
  });

  it("driver can mark arrived after driver_en_route", async () => {
    mockFindUserById.mockResolvedValue({ id: "driver-1", role: "driver" });
    const ride = makeRide({ status: "driver_arrived", driverUserId: "driver-1", arrivedAt: new Date() });
    mockMarkArrived.mockResolvedValue(ride);

    const result = await service.markArrived("token", "ride-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ride.status).toBe("driver_arrived");
    expect(mockMarkArrived).toHaveBeenCalledWith("ride-1", "driver-1");
  });

  it("passenger role returns 403", async () => {
    mockFindUserById.mockResolvedValue({ id: "user-123", role: "passenger" });

    const result = await service.markArrived("token", "ride-1");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.statusCode).toBe(403);
    expect(mockMarkArrived).not.toHaveBeenCalled();
  });

  it("returns 409 when ride is not in driver_en_route status", async () => {
    mockFindUserById.mockResolvedValue({ id: "driver-1", role: "driver" });
    mockMarkArrived.mockResolvedValue(null);
    mockFindById.mockResolvedValue(makeRide({ status: "accepted", driverUserId: "driver-1" }));

    const result = await service.markArrived("token", "ride-1");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.statusCode).toBe(409);
    expect(result.code).toBe("RIDE_CANNOT_MARK_ARRIVED");
  });

  it("returns 403 when ride belongs to a different driver", async () => {
    mockFindUserById.mockResolvedValue({ id: "driver-1", role: "driver" });
    mockMarkArrived.mockResolvedValue(null);
    mockFindById.mockResolvedValue(makeRide({ status: "driver_en_route", driverUserId: "driver-99" }));

    const result = await service.markArrived("token", "ride-1");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.statusCode).toBe(403);
  });
});

describe("RidesService.getDriverLocation", () => {
  let service: InstanceType<typeof RidesService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSessionValid.mockResolvedValue(true);
    service = new RidesService();
  });

  it("returns location when passenger owns the ride and driver shared location", async () => {
    mockFindUserById.mockResolvedValue({ id: "user-123", role: "passenger" });
    mockFindById.mockResolvedValue(makeRide({ driverUserId: "driver-1", passengerUserId: "user-123" }));
    mockFindDriverStatusById.mockResolvedValue({ currentLat: -27.15, currentLng: -109.43, locationUpdatedAt: new Date() });

    const result = await service.getDriverLocation("token", "ride-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.location).not.toBeNull();
    expect(result.location!.lat).toBe(-27.15);
    expect(result.location!.lng).toBe(-109.43);
  });

  it("returns null location when driver has not shared location", async () => {
    mockFindUserById.mockResolvedValue({ id: "user-123", role: "passenger" });
    mockFindById.mockResolvedValue(makeRide({ driverUserId: "driver-1", passengerUserId: "user-123" }));
    mockFindDriverStatusById.mockResolvedValue({ currentLat: null, currentLng: null, locationUpdatedAt: null });

    const result = await service.getDriverLocation("token", "ride-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.location).toBeNull();
  });

  it("returns null location when no driver assigned to ride", async () => {
    mockFindUserById.mockResolvedValue({ id: "user-123", role: "passenger" });
    mockFindById.mockResolvedValue(makeRide({ driverUserId: null, passengerUserId: "user-123" }));

    const result = await service.getDriverLocation("token", "ride-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.location).toBeNull();
  });

  it("returns 403 when passenger does not own the ride", async () => {
    mockFindUserById.mockResolvedValue({ id: "user-123", role: "passenger" });
    mockFindById.mockResolvedValue(makeRide({ driverUserId: "driver-1", passengerUserId: "other-user" }));

    const result = await service.getDriverLocation("token", "ride-1");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.statusCode).toBe(403);
  });

  it("returns 404 when ride not found", async () => {
    mockFindUserById.mockResolvedValue({ id: "user-123", role: "passenger" });
    mockFindById.mockResolvedValue(null);

    const result = await service.getDriverLocation("token", "nonexistent");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.statusCode).toBe(404);
  });

  it("returns 403 when driver tries to call this endpoint", async () => {
    mockFindUserById.mockResolvedValue({ id: "driver-1", role: "driver" });

    const result = await service.getDriverLocation("token", "ride-1");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.statusCode).toBe(403);
  });

  it("admin can view location of any ride", async () => {
    mockFindUserById.mockResolvedValue({ id: "admin-1", role: "admin" });
    mockFindById.mockResolvedValue(makeRide({ driverUserId: "driver-1", passengerUserId: "other-user" }));
    mockFindDriverStatusById.mockResolvedValue({ currentLat: -27.15, currentLng: -109.43, locationUpdatedAt: new Date() });

    const result = await service.getDriverLocation("token", "ride-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.location).not.toBeNull();
  });
});
