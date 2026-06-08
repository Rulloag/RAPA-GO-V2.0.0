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
const mockFindDriverStatusById      = vi.fn();
const mockFindAvailableWithLocation = vi.fn().mockResolvedValue([]);
const mockAccept                    = vi.fn();
const mockSetBusy                   = vi.fn();
const mockFareSettingsFindByType    = vi.fn().mockResolvedValue(null);
const mockStopsCreateMany           = vi.fn().mockResolvedValue([]);

vi.mock("../rides.repository.js", () => ({
  RidesRepository: vi.fn().mockImplementation(() => ({
    create:                       mockCreate,
    findById:                     mockFindById,
    findByIdAndPassenger:         mockFindByPassenger,
    findByPassengerId:            vi.fn().mockResolvedValue([]),
    findByPassengerIdWithDriver:  mockFindByPassengerWithDriver.mockResolvedValue([]),
    findAvailable:                vi.fn().mockResolvedValue([]),
    findByDriverId:               vi.fn().mockResolvedValue([]),
    accept:                       mockAccept,
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
    findByDriverId:            mockFindDriverStatusById,
    findAvailableWithLocation: mockFindAvailableWithLocation,
    setBusy:                   mockSetBusy,
    setAvailable:              vi.fn(),
    updateLocation:            vi.fn(),
  })),
}));

vi.mock("../../fareSettings/fareSettings.repository.js", () => ({
  FareSettingsRepository: vi.fn().mockImplementation(() => ({
    findByType: mockFareSettingsFindByType,
  })),
}));

vi.mock("../rideStops.repository.js", () => ({
  RideStopsRepository: vi.fn().mockImplementation(() => ({
    createMany: mockStopsCreateMany,
  })),
}));

// ── Import after mocks ────────────────────────────────────────────────────────
const { RidesService } = await import("../rides.service.js");
const { createRideRequestSchema } = await import("../rides.schemas.js");

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
    rideType:              "immediate",
    scheduledPickupAt:     null,
    priorityFeeClp:        null,
    flightNumber:          null,
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
  rideType:        "immediate" as const,
};

// 60 minutes from now in ISO 8601 format — valid for scheduled rides
function scheduledAt(minutesFromNow = 60): string {
  return new Date(Date.now() + minutesFromNow * 60 * 1000).toISOString();
}

const SCHEDULED_INPUT = {
  originText:        "Hanga Roa",
  destinationText:   "Aeropuerto Mataveri",
  originLat:         -27.15,
  originLng:         -109.43,
  destinationLat:    -27.16,
  destinationLng:    -109.42,
  distanceMeters:    2000,
  durationSeconds:   300,
  rideType:          "scheduled" as const,
  scheduledPickupAt: scheduledAt(60),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("RidesService.createRideRequest", () => {
  let service: InstanceType<typeof RidesService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSessionValid.mockResolvedValue(true);
    mockFindAvailableWithLocation.mockResolvedValue([]);  // no auto-assignment by default
    mockAccept.mockResolvedValue(null);
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

// ── Auto-assignment ───────────────────────────────────────────────────────────

const NOW_AUTO = new Date();

function makeCandidate(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    driverUserId:      "driver-1",
    currentLat:        -27.150,   // ~0 km from VALID_INPUT origin
    currentLng:        -109.430,
    locationUpdatedAt: NOW_AUTO,
    lastSeenAt:        NOW_AUTO,
    currentZone:       null,
    ...overrides,
  };
}

function makeAcceptedRide(driverUserId: string) {
  return makeRide({ status: "accepted", driverUserId, acceptedAt: NOW_AUTO });
}

describe("RidesService.createRideRequest — auto-assignment", () => {
  let service: InstanceType<typeof RidesService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSessionValid.mockResolvedValue(true);
    mockFindUserById.mockResolvedValue({ id: "user-123", role: "passenger" });
    mockCreate.mockResolvedValue(makeRide());
    mockAccept.mockResolvedValue(null);
    mockFindAvailableWithLocation.mockResolvedValue([]);
    service = new RidesService();
  });

  it("assigns nearest driver when one is available and close", async () => {
    const candidate = makeCandidate();
    mockFindAvailableWithLocation.mockResolvedValue([candidate]);
    mockAccept.mockResolvedValue(makeAcceptedRide("driver-1"));

    const result = await service.createRideRequest("token", VALID_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ride.status).toBe("accepted");
    expect(result.ride.autoAssigned).toBe(true);
    expect(mockAccept).toHaveBeenCalledWith("ride-1", "driver-1");
    expect(mockSetBusy).toHaveBeenCalledWith("driver-1", "ride-1");
  });

  it("picks closer driver over farther when two are available", async () => {
    // driver-2 is 1 km away, driver-1 is 5 km away
    const close = makeCandidate({ driverUserId: "driver-2", currentLat: -27.159, currentLng: -109.430 });
    const far   = makeCandidate({ driverUserId: "driver-1", currentLat: -27.195, currentLng: -109.430 });
    mockFindAvailableWithLocation.mockResolvedValue([far, close]); // intentionally wrong order
    mockAccept.mockResolvedValue(makeAcceptedRide("driver-2"));

    const result = await service.createRideRequest("token", VALID_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // First accept call should be with the closer driver
    expect(mockAccept.mock.calls[0]![1]).toBe("driver-2");
  });

  it("falls back to requested when no driver available", async () => {
    mockFindAvailableWithLocation.mockResolvedValue([]);

    const result = await service.createRideRequest("token", VALID_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ride.status).toBe("requested");
    expect(result.ride.autoAssigned).toBeUndefined();
    expect(mockAccept).not.toHaveBeenCalled();
  });

  it("ignores driver beyond 15 km radius", async () => {
    // ~20 km north of origin
    const farDriver = makeCandidate({ currentLat: -26.970, currentLng: -109.430 });
    mockFindAvailableWithLocation.mockResolvedValue([farDriver]);

    const result = await service.createRideRequest("token", VALID_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ride.status).toBe("requested");
    expect(mockAccept).not.toHaveBeenCalled();
  });

  it("ignores driver with stale location (filtered by repository cutoff)", async () => {
    // Repository filters by locationUpdatedAt — simulate empty result (already filtered)
    mockFindAvailableWithLocation.mockResolvedValue([]);

    const result = await service.createRideRequest("token", VALID_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ride.status).toBe("requested");
  });

  it("ignores driver with stale lastSeenAt (filtered by repository cutoff)", async () => {
    // Repository filters by lastSeenAt — simulate empty result (already filtered)
    mockFindAvailableWithLocation.mockResolvedValue([]);

    const result = await service.createRideRequest("token", VALID_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ride.status).toBe("requested");
  });

  it("ignores driver without location (no candidates returned)", async () => {
    mockFindAvailableWithLocation.mockResolvedValue([]);

    const result = await service.createRideRequest("token", VALID_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ride.status).toBe("requested");
  });

  it("tries next driver if first accept fails (race condition)", async () => {
    const first  = makeCandidate({ driverUserId: "driver-1", currentLat: -27.150, currentLng: -109.430 });
    const second = makeCandidate({ driverUserId: "driver-2", currentLat: -27.151, currentLng: -109.430 });
    mockFindAvailableWithLocation.mockResolvedValue([first, second]);
    // First accept fails (driver taken), second succeeds
    mockAccept
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(makeAcceptedRide("driver-2"));

    const result = await service.createRideRequest("token", VALID_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ride.status).toBe("accepted");
    expect(result.ride.autoAssigned).toBe(true);
    expect(mockAccept).toHaveBeenCalledTimes(2);
    expect(mockSetBusy).toHaveBeenCalledWith("driver-2", "ride-1");
  });

  it("ride stays requested when all candidates fail (all races lost)", async () => {
    const first  = makeCandidate({ driverUserId: "driver-1" });
    const second = makeCandidate({ driverUserId: "driver-2" });
    mockFindAvailableWithLocation.mockResolvedValue([first, second]);
    mockAccept.mockResolvedValue(null); // both fail

    const result = await service.createRideRequest("token", VALID_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ride.status).toBe("requested");
    expect(mockSetBusy).not.toHaveBeenCalled();
  });

  it("marks assigned driver as busy with correct rideId", async () => {
    const candidate = makeCandidate({ driverUserId: "driver-99" });
    mockFindAvailableWithLocation.mockResolvedValue([candidate]);
    mockAccept.mockResolvedValue(makeAcceptedRide("driver-99"));

    await service.createRideRequest("token", VALID_INPUT);

    expect(mockSetBusy).toHaveBeenCalledWith("driver-99", "ride-1");
  });

  it("auto-assignment failure is non-fatal — ride still returns as requested", async () => {
    mockFindAvailableWithLocation.mockRejectedValue(new Error("DB error"));

    const result = await service.createRideRequest("token", VALID_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ride.status).toBe("requested");
  });

  it("admin assign (ridesRepo.accept) still works for requested rides", async () => {
    // Simulate admin calling acceptRideRequest (separate flow — uses same ridesRepo.accept)
    mockFindUserById.mockResolvedValue({ id: "driver-1", role: "driver" });
    mockAccept.mockResolvedValue(makeAcceptedRide("driver-1"));

    const adminService = new RidesService();
    const result = await adminService.acceptRideRequest("token", "ride-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ride.status).toBe("accepted");
    expect(mockAccept).toHaveBeenCalledWith("ride-1", "driver-1");
  });
});

// ── Scheduled rides ───────────────────────────────────────────────────────────

describe("RidesService.createRideRequest — scheduled rides", () => {
  let service: InstanceType<typeof RidesService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSessionValid.mockResolvedValue(true);
    mockFindUserById.mockResolvedValue({ id: "user-123", role: "passenger" });
    mockFindAvailableWithLocation.mockResolvedValue([]);
    mockAccept.mockResolvedValue(null);
    mockFareSettingsFindByType.mockResolvedValue(null);
    service = new RidesService();
  });

  it("scheduled ride is created with rideType='scheduled'", async () => {
    mockCreate.mockImplementation((data: Record<string, unknown>) =>
      Promise.resolve(makeRide({ ...data, status: "requested", rideType: "scheduled" })),
    );

    const result = await service.createRideRequest("token", SCHEDULED_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ride.rideType).toBe("scheduled");
    const createArg = mockCreate.mock.calls[0]![0] as Record<string, unknown>;
    expect(createArg["rideType"]).toBe("scheduled");
  });

  it("scheduled ride stays 'requested' — auto-assignment is skipped", async () => {
    const candidate = makeCandidate();
    mockFindAvailableWithLocation.mockResolvedValue([candidate]);
    mockAccept.mockResolvedValue(makeAcceptedRide("driver-1"));
    mockCreate.mockResolvedValue(makeRide({ rideType: "scheduled", status: "requested" }));

    const result = await service.createRideRequest("token", SCHEDULED_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ride.status).toBe("requested");
    expect(mockAccept).not.toHaveBeenCalled();
  });

  it("autoAssigned is not set on a scheduled ride", async () => {
    mockCreate.mockResolvedValue(makeRide({ rideType: "scheduled", status: "requested" }));

    const result = await service.createRideRequest("token", SCHEDULED_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ride.autoAssigned).toBeUndefined();
  });

  it("scheduledPickupAt is stored and returned", async () => {
    const pickupAt = scheduledAt(90);
    const pickupDate = new Date(pickupAt);
    mockCreate.mockResolvedValue(makeRide({ rideType: "scheduled", scheduledPickupAt: pickupDate }));

    const result = await service.createRideRequest("token", { ...SCHEDULED_INPUT, scheduledPickupAt: pickupAt });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ride.scheduledPickupAt).toBe(pickupDate.toISOString());
    const createArg = mockCreate.mock.calls[0]![0] as Record<string, unknown>;
    expect(createArg["scheduledPickupAt"]).toBeInstanceOf(Date);
  });

  it("priority surcharge from fare_settings is applied to scheduled fare", async () => {
    mockFareSettingsFindByType.mockResolvedValue({ isActive: true, value: 3000 });
    mockCreate.mockImplementation((data: Record<string, unknown>) =>
      Promise.resolve(makeRide({
        rideType: "scheduled",
        estimatedFareClp: data["estimatedFareClp"] as number,
        priorityFeeClp: data["priorityFeeClp"] as number,
      })),
    );

    const result = await service.createRideRequest("token", SCHEDULED_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 2 km × 2300 = 4600 base + 3000 surcharge = 7600
    expect(result.ride.estimatedFareClp).toBe(7600);
    expect(result.ride.priorityFeeClp).toBe(3000);
  });

  it("falls back to DEFAULT_PRIORITY_SURCHARGE_CLP (2000) when fare_settings returns null", async () => {
    mockFareSettingsFindByType.mockResolvedValue(null);
    mockCreate.mockImplementation((data: Record<string, unknown>) =>
      Promise.resolve(makeRide({
        rideType: "scheduled",
        estimatedFareClp: data["estimatedFareClp"] as number,
        priorityFeeClp: data["priorityFeeClp"] as number,
      })),
    );

    const result = await service.createRideRequest("token", SCHEDULED_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 4600 base + 2000 default surcharge = 6600
    expect(result.ride.estimatedFareClp).toBe(6600);
    expect(result.ride.priorityFeeClp).toBe(2000);
  });

  it("falls back to DEFAULT_PRIORITY_SURCHARGE_CLP when fare_settings throws", async () => {
    mockFareSettingsFindByType.mockRejectedValue(new Error("DB error"));
    mockCreate.mockImplementation((data: Record<string, unknown>) =>
      Promise.resolve(makeRide({
        rideType: "scheduled",
        estimatedFareClp: data["estimatedFareClp"] as number,
        priorityFeeClp: data["priorityFeeClp"] as number,
      })),
    );

    const result = await service.createRideRequest("token", SCHEDULED_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ride.estimatedFareClp).toBe(6600);
  });

  it("falls back to default when fare_settings setting is inactive", async () => {
    mockFareSettingsFindByType.mockResolvedValue({ isActive: false, value: 5000 });
    mockCreate.mockImplementation((data: Record<string, unknown>) =>
      Promise.resolve(makeRide({
        rideType: "scheduled",
        estimatedFareClp: data["estimatedFareClp"] as number,
        priorityFeeClp: data["priorityFeeClp"] as number,
      })),
    );

    const result = await service.createRideRequest("token", SCHEDULED_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // inactive setting → fallback 2000
    expect(result.ride.estimatedFareClp).toBe(6600);
  });

  it("fareCalculationSource includes '_scheduled' suffix for scheduled rides", async () => {
    mockCreate.mockImplementation((data: Record<string, unknown>) =>
      Promise.resolve(makeRide({
        rideType: "scheduled",
        fareCalculationSource: data["fareCalculationSource"] as string,
      })),
    );

    const result = await service.createRideRequest("token", SCHEDULED_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ride.fareCalculationSource).toContain("_scheduled");
  });

  it("flightNumber is stored on scheduled ride when provided", async () => {
    mockCreate.mockImplementation((data: Record<string, unknown>) =>
      Promise.resolve(makeRide({ rideType: "scheduled", flightNumber: data["flightNumber"] as string })),
    );

    const result = await service.createRideRequest("token", {
      ...SCHEDULED_INPUT,
      flightNumber: "LA800",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ride.flightNumber).toBe("LA800");
    const createArg = mockCreate.mock.calls[0]![0] as Record<string, unknown>;
    expect(createArg["flightNumber"]).toBe("LA800");
  });

  it("priorityFeeClp is null for immediate rides", async () => {
    mockCreate.mockImplementation((data: Record<string, unknown>) =>
      Promise.resolve(makeRide({ estimatedFareClp: data["estimatedFareClp"] as number, priorityFeeClp: data["priorityFeeClp"] as null })),
    );

    const result = await service.createRideRequest("token", VALID_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ride.priorityFeeClp).toBeNull();
    expect(mockFareSettingsFindByType).not.toHaveBeenCalled();
  });

  it("scheduledPickupAt is null for immediate rides", async () => {
    mockCreate.mockResolvedValue(makeRide());

    const result = await service.createRideRequest("token", VALID_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ride.scheduledPickupAt).toBeNull();
    const createArg = mockCreate.mock.calls[0]![0] as Record<string, unknown>;
    expect(createArg["scheduledPickupAt"]).toBeNull();
  });

  it("driver role cannot create a scheduled ride — 403", async () => {
    mockFindUserById.mockResolvedValue({ id: "driver-1", role: "driver" });

    const result = await service.createRideRequest("token", SCHEDULED_INPUT);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.statusCode).toBe(403);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("fareSettingsFindByType is called with 'priority_surcharge' for scheduled rides", async () => {
    mockCreate.mockResolvedValue(makeRide({ rideType: "scheduled" }));

    await service.createRideRequest("token", SCHEDULED_INPUT);

    expect(mockFareSettingsFindByType).toHaveBeenCalledWith("priority_surcharge");
  });

  it("priority surcharge is added on top of base fare — not replacing it", async () => {
    mockFareSettingsFindByType.mockResolvedValue({ isActive: true, value: 1000 });
    mockCreate.mockImplementation((data: Record<string, unknown>) =>
      Promise.resolve(makeRide({
        rideType: "scheduled",
        estimatedFareClp: data["estimatedFareClp"] as number,
      })),
    );

    const result = await service.createRideRequest("token", SCHEDULED_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // base 4600 + surcharge 1000 = 5600 (not just 1000)
    expect(result.ride.estimatedFareClp).toBe(5600);
    expect(result.ride.estimatedFareClp).toBeGreaterThan(1000);
  });
});

// ── Multi-destination ─────────────────────────────────────────────────────────

// Origin: -27.15, -109.43
// Stop 1: -27.16, -109.42 (3000 m, 400 s)
// Stop 2: -27.17, -109.41 (2000 m, 300 s)
// Total:  5000 m, 700 s
const MULTI_DEST_INPUT = {
  originText:      "Hanga Roa",
  originLat:       -27.15,
  originLng:       -109.43,
  rideType:        "immediate" as const,
  destinations: [
    { text: "Punto A", lat: -27.16, lng: -109.42, order: 1 },
    { text: "Punto B", lat: -27.17, lng: -109.41, order: 2 },
  ],
  segments: [
    { fromOrder: 0, toOrder: 1, distanceMeters: 3000, durationSeconds: 400 },
    { fromOrder: 1, toOrder: 2, distanceMeters: 2000, durationSeconds: 300 },
  ],
};

const MULTI_DEST_SCHEDULED_INPUT = {
  ...MULTI_DEST_INPUT,
  rideType:          "scheduled" as const,
  scheduledPickupAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
};

function makeStop(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id:                     "stop-1",
    rideRequestId:          "ride-1",
    stopOrder:              1,
    label:                  "Punto A",
    lat:                    -27.16,
    lng:                    -109.42,
    segmentDistanceMeters:  3000,
    segmentDurationSeconds: 400,
    segmentFareClp:         6900,
    arrivedAt:              null,
    completedAt:            null,
    createdAt:              NOW,
    updatedAt:              NOW,
    ...overrides,
  };
}

describe("RidesService.createRideRequest — multi-destination", () => {
  let service: InstanceType<typeof RidesService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSessionValid.mockResolvedValue(true);
    mockFindUserById.mockResolvedValue({ id: "user-123", role: "passenger" });
    mockFindAvailableWithLocation.mockResolvedValue([]);
    mockAccept.mockResolvedValue(null);
    mockFareSettingsFindByType.mockResolvedValue(null);
    mockStopsCreateMany.mockResolvedValue([]);
    service = new RidesService();
  });

  // Test 3: multi-destino immediate crea ride con destination final = último destino
  it("sets destinationText/Lat/Lng from last destination", async () => {
    mockCreate.mockImplementation((data: Record<string, unknown>) => Promise.resolve(makeRide(data)));

    await service.createRideRequest("token", MULTI_DEST_INPUT);

    const arg = mockCreate.mock.calls[0]![0] as Record<string, unknown>;
    expect(arg["destinationText"]).toBe("Punto B");
    expect(arg["destinationLat"]).toBe(-27.17);
    expect(arg["destinationLng"]).toBe(-109.41);
  });

  // Test 4: multi-destino immediate suma distanceMeters/durationSeconds desde segments
  it("sums distanceMeters and durationSeconds from segments", async () => {
    mockCreate.mockImplementation((data: Record<string, unknown>) => Promise.resolve(makeRide(data)));

    await service.createRideRequest("token", MULTI_DEST_INPUT);

    const arg = mockCreate.mock.calls[0]![0] as Record<string, unknown>;
    expect(arg["distanceMeters"]).toBe(5000);
    expect(arg["durationSeconds"]).toBe(700);
  });

  // Test 5: multi-destino calccula estimatedFareClp sobre distancia total
  it("calculates estimatedFareClp from total distance", async () => {
    mockCreate.mockImplementation((data: Record<string, unknown>) =>
      Promise.resolve(makeRide({ estimatedFareClp: data["estimatedFareClp"] as number })),
    );

    const result = await service.createRideRequest("token", MULTI_DEST_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 5 km × 2300 = 11500 CLP
    expect(result.ride.estimatedFareClp).toBe(11500);
  });

  // Test 6: multi-destino crea ride_stops en orden
  it("creates ride_stops ordered by stopOrder", async () => {
    mockCreate.mockResolvedValue(makeRide({ id: "ride-1" }));
    mockStopsCreateMany.mockResolvedValue([makeStop(), makeStop({ id: "stop-2", stopOrder: 2, label: "Punto B" })]);

    const result = await service.createRideRequest("token", MULTI_DEST_INPUT);

    expect(mockStopsCreateMany).toHaveBeenCalledOnce();
    const [rideId, stops] = mockStopsCreateMany.mock.calls[0] as [string, unknown[]];
    expect(rideId).toBe("ride-1");
    expect(stops).toHaveLength(2);
    expect((stops[0] as Record<string, unknown>)["stopOrder"]).toBe(1);
    expect((stops[1] as Record<string, unknown>)["stopOrder"]).toBe(2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ride.stops).toHaveLength(2);
  });

  // Test 7: segmentFareClp se distribuye proporcionalmente y suma baseFare
  it("distributes segmentFareClp proportionally summing to baseFare", async () => {
    mockCreate.mockResolvedValue(makeRide({ id: "ride-1" }));
    mockStopsCreateMany.mockImplementation((_id: string, stops: unknown[]) =>
      Promise.resolve(stops.map((s, i) => ({ ...(s as object), id: `stop-${i}`, rideRequestId: "ride-1", arrivedAt: null, completedAt: null, createdAt: NOW, updatedAt: NOW }))),
    );

    await service.createRideRequest("token", MULTI_DEST_INPUT);

    const [, stopsArg] = mockStopsCreateMany.mock.calls[0] as [string, Array<Record<string, unknown>>];
    // baseFare for 5 km = 11500
    // seg1: 3000/5000 * 11500 = 6900, seg2: 2000/5000 * 11500 = 4600
    expect(stopsArg[0]!["segmentFareClp"]).toBe(6900);
    expect(stopsArg[1]!["segmentFareClp"]).toBe(4600);
    // sum must equal baseFare
    const sum = (stopsArg[0]!["segmentFareClp"] as number) + (stopsArg[1]!["segmentFareClp"] as number);
    expect(sum).toBe(11500);
  });

  // Test 8: multi-destino scheduled suma priorityFeeClp
  it("adds priorityFeeClp to total for scheduled multi-destination", async () => {
    mockFareSettingsFindByType.mockImplementation((type: string) => {
      if (type === "priority_surcharge") return Promise.resolve({ isActive: true, value: 2000 });
      return Promise.resolve(null);
    });
    mockCreate.mockImplementation((data: Record<string, unknown>) =>
      Promise.resolve(makeRide({ estimatedFareClp: data["estimatedFareClp"] as number, priorityFeeClp: data["priorityFeeClp"] as number })),
    );

    const result = await service.createRideRequest("token", MULTI_DEST_SCHEDULED_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 5 km × 2300 = 11500 + 2000 priority = 13500
    expect(result.ride.estimatedFareClp).toBe(13500);
    expect(result.ride.priorityFeeClp).toBe(2000);
  });

  // Test 9: extra_stop_fee inactivo no suma
  it("does not add extra_stop_fee when setting is inactive", async () => {
    mockFareSettingsFindByType.mockImplementation((type: string) => {
      if (type === "extra_stop_fee") return Promise.resolve({ isActive: false, value: 500 });
      return Promise.resolve(null);
    });
    mockCreate.mockImplementation((data: Record<string, unknown>) =>
      Promise.resolve(makeRide({ estimatedFareClp: data["estimatedFareClp"] as number })),
    );

    const result = await service.createRideRequest("token", MULTI_DEST_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ride.estimatedFareClp).toBe(11500);
  });

  // Test 10: extra_stop_fee activo suma por destino adicional
  it("adds extra_stop_fee per additional stop when active", async () => {
    mockFareSettingsFindByType.mockImplementation((type: string) => {
      if (type === "extra_stop_fee") return Promise.resolve({ isActive: true, value: 500 });
      return Promise.resolve(null);
    });
    mockCreate.mockImplementation((data: Record<string, unknown>) =>
      Promise.resolve(makeRide({ estimatedFareClp: data["estimatedFareClp"] as number })),
    );

    const result = await service.createRideRequest("token", MULTI_DEST_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 11500 base + 1 additional stop × 500 = 12000
    expect(result.ride.estimatedFareClp).toBe(12000);
  });

  // Test 11: rechaza más de 3 destinos (Zod level)
  it("Zod schema rejects more than 3 destinations", () => {
    const input = {
      ...MULTI_DEST_INPUT,
      destinations: [
        { text: "A", lat: -27.16, lng: -109.42, order: 1 },
        { text: "B", lat: -27.17, lng: -109.41, order: 2 },
        { text: "C", lat: -27.18, lng: -109.40, order: 3 },
        { text: "D", lat: -27.19, lng: -109.39, order: 4 },
      ],
      segments: [
        { fromOrder: 0, toOrder: 1, distanceMeters: 1000, durationSeconds: 100 },
        { fromOrder: 1, toOrder: 2, distanceMeters: 1000, durationSeconds: 100 },
        { fromOrder: 2, toOrder: 3, distanceMeters: 1000, durationSeconds: 100 },
        { fromOrder: 3, toOrder: 4, distanceMeters: 1000, durationSeconds: 100 },
      ],
    };
    const result = createRideRequestSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  // Test 12: rechaza 0 destinos si destinations viene vacío (Zod level)
  it("Zod schema rejects empty destinations array", () => {
    const input = { ...MULTI_DEST_INPUT, destinations: [], segments: [] };
    const result = createRideRequestSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  // Test 13: rechaza orders no secuenciales (Zod level)
  it("Zod schema rejects non-sequential destination orders", () => {
    const input = {
      ...MULTI_DEST_INPUT,
      destinations: [
        { text: "A", lat: -27.16, lng: -109.42, order: 1 },
        { text: "B", lat: -27.17, lng: -109.41, order: 3 }, // gap: 2 is missing
      ],
    };
    const result = createRideRequestSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  // Test 14: rechaza segments inconsistentes (Zod level)
  it("Zod schema rejects segments with wrong fromOrder/toOrder sequence", () => {
    const input = {
      ...MULTI_DEST_INPUT,
      segments: [
        { fromOrder: 0, toOrder: 2, distanceMeters: 3000, durationSeconds: 400 }, // wrong: skips 1
        { fromOrder: 1, toOrder: 2, distanceMeters: 2000, durationSeconds: 300 },
      ],
    };
    const result = createRideRequestSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  // Test 15: rechaza coordenadas duplicadas (Zod level)
  it("Zod schema rejects duplicate destination coordinates", () => {
    const input = {
      ...MULTI_DEST_INPUT,
      destinations: [
        { text: "A", lat: -27.16, lng: -109.42, order: 1 },
        { text: "B", lat: -27.16, lng: -109.42, order: 2 }, // same coords
      ],
    };
    const result = createRideRequestSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  // Test 16: immediate multi-destino sigue auto-asignando por origen
  it("immediate multi-destination auto-assigns by origin", async () => {
    const candidate = {
      driverUserId: "driver-1",
      currentLat:   -27.150,
      currentLng:   -109.430,
      locationUpdatedAt: NOW,
      lastSeenAt:        NOW,
      currentZone:       null,
    };
    mockFindAvailableWithLocation.mockResolvedValue([candidate]);
    mockCreate.mockResolvedValue(makeRide({ id: "ride-1" }));
    mockAccept.mockResolvedValue(makeRide({ id: "ride-1", status: "accepted", driverUserId: "driver-1", acceptedAt: NOW }));

    const result = await service.createRideRequest("token", MULTI_DEST_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ride.autoAssigned).toBe(true);
    expect(mockAccept).toHaveBeenCalledWith("ride-1", "driver-1");
  });

  // Test 17: scheduled multi-destino NO auto-asigna
  it("scheduled multi-destination does not auto-assign", async () => {
    const candidate = {
      driverUserId: "driver-1",
      currentLat:   -27.150,
      currentLng:   -109.430,
      locationUpdatedAt: NOW,
      lastSeenAt:        NOW,
      currentZone:       null,
    };
    mockFindAvailableWithLocation.mockResolvedValue([candidate]);
    mockAccept.mockResolvedValue(makeRide({ status: "accepted", driverUserId: "driver-1" }));
    mockCreate.mockResolvedValue(makeRide({ rideType: "scheduled", status: "requested" }));
    mockFareSettingsFindByType.mockResolvedValue(null);

    const result = await service.createRideRequest("token", MULTI_DEST_SCHEDULED_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(mockAccept).not.toHaveBeenCalled();
    expect(result.ride.autoAssigned).toBeUndefined();
  });

  // Test 18: priorityFeeClp no puede venir del cliente
  it("client cannot supply priorityFeeClp — it is always calculated server-side", async () => {
    mockFareSettingsFindByType.mockResolvedValue(null);
    mockCreate.mockImplementation((data: Record<string, unknown>) =>
      Promise.resolve(makeRide({ priorityFeeClp: data["priorityFeeClp"] as number | null })),
    );

    // Client-injected priorityFeeClp should be absent from input type entirely
    const result = await service.createRideRequest("token", MULTI_DEST_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // immediate ride — priorityFeeClp must be null
    expect(result.ride.priorityFeeClp).toBeNull();
    const createArg = mockCreate.mock.calls[0]![0] as Record<string, unknown>;
    expect(createArg["priorityFeeClp"]).toBeNull();
  });

  // Test 1 (regression): viaje simple immediate sigue igual
  it("simple immediate ride still works unchanged", async () => {
    mockCreate.mockImplementation((data: Record<string, unknown>) =>
      Promise.resolve(makeRide({ estimatedFareClp: data["estimatedFareClp"] as number })),
    );

    const result = await service.createRideRequest("token", VALID_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ride.estimatedFareClp).toBe(4600);
    expect(mockStopsCreateMany).not.toHaveBeenCalled();
  });

  // Test 2 (regression): viaje simple scheduled sigue igual
  it("simple scheduled ride still works unchanged", async () => {
    mockFareSettingsFindByType.mockResolvedValue({ isActive: true, value: 2000 });
    mockCreate.mockImplementation((data: Record<string, unknown>) =>
      Promise.resolve(makeRide({ estimatedFareClp: data["estimatedFareClp"] as number, rideType: "scheduled" })),
    );

    const result = await service.createRideRequest("token", SCHEDULED_INPUT);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 4600 + 2000 = 6600
    expect(result.ride.estimatedFareClp).toBe(6600);
    expect(mockStopsCreateMany).not.toHaveBeenCalled();
  });
});
