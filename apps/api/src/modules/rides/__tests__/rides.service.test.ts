import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks must be declared before the import under test ──────────────────────

const mockCreate         = vi.fn();
const mockFindById       = vi.fn();
const mockFindByPassenger = vi.fn();
const mockFindByPassengerWithDriver = vi.fn();
const mockIsSessionValid = vi.fn().mockResolvedValue(true);
const mockFindUserById   = vi.fn();

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
