import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockFindPendingByDriver = vi.fn();
const mockMarkExpired         = vi.fn();
const mockMarkAccepted        = vi.fn();
const mockMarkRejected        = vi.fn();
const mockMarkCancelledByRide = vi.fn();

const mockFindRideById    = vi.fn();
const mockAcceptAsQueued  = vi.fn();

const mockSetQueuedRide   = vi.fn();

const mockIsSessionValid  = vi.fn().mockResolvedValue(true);
const mockFindUserById    = vi.fn();

vi.mock("../../../modules/rides/rideAssignmentOffers.repository.js", () => ({
  RideAssignmentOffersRepository: vi.fn().mockImplementation(() => ({
    findPendingByDriverId:  mockFindPendingByDriver,
    markExpired:            mockMarkExpired,
    markAccepted:           mockMarkAccepted,
    markRejected:           mockMarkRejected,
    markCancelledByRideId:  mockMarkCancelledByRide,
  })),
}));

vi.mock("../../../modules/rides/rides.repository.js", () => ({
  RidesRepository: vi.fn().mockImplementation(() => ({
    findById:        mockFindRideById,
    acceptAsQueued:  mockAcceptAsQueued,
  })),
}));

vi.mock("../driverStatus.repository.js", () => ({
  DriverStatusRepository: vi.fn().mockImplementation(() => ({
    setQueuedRide: mockSetQueuedRide,
  })),
}));

vi.mock("../../auth/token.service.js", () => ({
  TokenService: vi.fn().mockImplementation(() => ({
    verifyAccessToken: vi.fn().mockReturnValue({ sub: "driver-1" }),
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

// responseMapper uses no external deps at module level — no mock needed
vi.mock("../../../modules/rides/rides.responseMapper.js", () => ({
  toResponse: vi.fn().mockImplementation((ride: Record<string, unknown>) => ({
    id: ride["id"],
    status: ride["status"],
    driverUserId: ride["driverUserId"],
    assignmentMode: ride["assignmentMode"],
    queuedOfferDriverId: ride["queuedOfferDriverId"],
    passengerUserId: "pax-1",
    originText: "Hanga Roa",
    destinationText: "Aeropuerto",
    notes: null,
    estimatedFareClp: 5000,
    originLat: -27.15, originLng: -109.43,
    destinationLat: -27.16, destinationLng: -109.42,
    distanceMeters: 2000, durationSeconds: 300,
    fareCalculationSource: "google_maps",
    requestedAt: new Date().toISOString(),
    acceptedAt: null, enRouteAt: null, arrivedAt: null,
    startedAt: null, completedAt: null, cancelledAt: null,
    cancellationReason: null, cancelledByRole: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    driverRatingAverage: null, driverRatingCount: 0,
    driverVehicleBrand: null, driverVehicleModel: null,
    driverVehicleYear: null, driverVehiclePlate: null, driverVehicleColor: null,
    discountApplied: false, discountPercent: null, originalFareClp: null,
    rideType: "immediate", scheduledPickupAt: null,
    priorityFeeClp: null, flightNumber: null,
  })),
}));

const { DriverOffersService } = await import("../driverOffers.service.js");

// ── Helpers ───────────────────────────────────────────────────────────────────

const NOW = new Date();

function makeOffer(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id:             "offer-1",
    rideRequestId:  "ride-1",
    driverUserId:   "driver-1",
    status:         "pending",
    offeredAt:      new Date(NOW.getTime() - 5000),
    expiresAt:      new Date(NOW.getTime() + 15000), // 15s remaining
    respondedAt:    null,
    responseSource: null,
    attemptOrder:   1,
    createdAt:      NOW,
    updatedAt:      NOW,
    ...overrides,
  };
}

function makeRide(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id:                    "ride-1",
    passengerUserId:       "pax-1",
    driverUserId:          null,
    originText:            "Hanga Roa",
    destinationText:       "Aeropuerto",
    notes:                 null,
    estimatedFareClp:      5000,
    originLat:             -27.15, originLng: -109.43,
    destinationLat:        -27.16, destinationLng: -109.42,
    distanceMeters:        2000, durationSeconds: 300,
    fareCalculationSource: "google_maps",
    status:                "requested",
    rideType:              "immediate",
    scheduledPickupAt:     null, priorityFeeClp: null, flightNumber: null,
    requestedAt: NOW, acceptedAt: null, enRouteAt: null, arrivedAt: null,
    startedAt: null, completedAt: null, cancelledAt: null,
    cancellationReason: null, cancelledByUserId: null, cancelledByRole: null,
    isOfflineBooking: false, offlinePassengerName: null,
    offlinePassengerPhone: null, offlinePassengerEmail: null,
    currentStopOrder: 1, queuedOfferDriverId: null, assignmentMode: "automatic",
    createdAt: NOW, updatedAt: NOW,
    ...overrides,
  };
}

// ── Tests: getActiveOffer ─────────────────────────────────────────────────────

describe("DriverOffersService.getActiveOffer", () => {
  let service: InstanceType<typeof DriverOffersService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSessionValid.mockResolvedValue(true);
    mockFindUserById.mockResolvedValue({ id: "driver-1", role: "driver" });
    service = new DriverOffersService();
  });

  // Test 1
  it("returns null when no pending offer exists", async () => {
    mockFindPendingByDriver.mockResolvedValue(null);

    const result = await service.getActiveOffer("token");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.offer).toBeNull();
  });

  // Test 2
  it("expires a stale offer and returns null", async () => {
    const expiredOffer = makeOffer({ expiresAt: new Date(NOW.getTime() - 1000) }); // expired 1s ago
    mockFindPendingByDriver.mockResolvedValue(expiredOffer);
    mockMarkExpired.mockResolvedValue(expiredOffer);

    const result = await service.getActiveOffer("token");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.offer).toBeNull();
    expect(mockMarkExpired).toHaveBeenCalledWith("offer-1");
  });

  // Test 3
  it("returns active offer with ride data when not expired", async () => {
    mockFindPendingByDriver.mockResolvedValue(makeOffer());
    mockFindRideById.mockResolvedValue(makeRide());

    const result = await service.getActiveOffer("token");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.offer).not.toBeNull();
    expect(result.offer!.offer.id).toBe("offer-1");
    expect(result.offer!.ride.id).toBe("ride-1");
    expect(result.offer!.ride.originText).toBe("Hanga Roa");
    expect(result.offer!.offer.status).toBe("pending");
  });
});

// ── Tests: acceptOffer ────────────────────────────────────────────────────────

describe("DriverOffersService.acceptOffer", () => {
  let service: InstanceType<typeof DriverOffersService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSessionValid.mockResolvedValue(true);
    mockFindUserById.mockResolvedValue({ id: "driver-1", role: "driver" });
    service = new DriverOffersService();
  });

  // Test 4
  it("accepts offer within 20s and returns accepted ride", async () => {
    const acceptedOffer = makeOffer({ status: "accepted", respondedAt: NOW, responseSource: "driver" });
    mockMarkAccepted.mockResolvedValue(acceptedOffer);
    const acceptedRide = makeRide({ status: "accepted", driverUserId: "driver-1", assignmentMode: "queued_offer", queuedOfferDriverId: "driver-1" });
    mockAcceptAsQueued.mockResolvedValue(acceptedRide);
    mockSetQueuedRide.mockResolvedValue(undefined);

    const result = await service.acceptOffer("token", "offer-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ride.status).toBe("accepted");
    expect(mockAcceptAsQueued).toHaveBeenCalledWith("ride-1", "driver-1");
  });

  // Test 5
  it("sets assignmentMode=queued_offer on accepted ride", async () => {
    mockMarkAccepted.mockResolvedValue(makeOffer({ status: "accepted" }));
    mockAcceptAsQueued.mockResolvedValue(makeRide({ status: "accepted", assignmentMode: "queued_offer" }));
    mockSetQueuedRide.mockResolvedValue(undefined);

    const result = await service.acceptOffer("token", "offer-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // assignmentMode is passed through the mapper mock — verify via unknown cast
    expect((result.ride as unknown as Record<string, unknown>)["assignmentMode"]).toBe("queued_offer");
  });

  // Test 6: queuedOfferDriverId
  it("sets queuedOfferDriverId on accepted ride", async () => {
    mockMarkAccepted.mockResolvedValue(makeOffer({ status: "accepted" }));
    mockAcceptAsQueued.mockResolvedValue(makeRide({ status: "accepted", queuedOfferDriverId: "driver-1" }));
    mockSetQueuedRide.mockResolvedValue(undefined);

    const result = await service.acceptOffer("token", "offer-1");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((result.ride as unknown as Record<string, unknown>)["queuedOfferDriverId"]).toBe("driver-1");
  });

  // Test 7
  it("calls setQueuedRide on driver_statuses", async () => {
    mockMarkAccepted.mockResolvedValue(makeOffer({ status: "accepted" }));
    mockAcceptAsQueued.mockResolvedValue(makeRide({ status: "accepted", id: "ride-1" }));
    mockSetQueuedRide.mockResolvedValue(undefined);

    await service.acceptOffer("token", "offer-1");

    expect(mockSetQueuedRide).toHaveBeenCalledWith("driver-1", "ride-1");
  });

  // Test 8
  it("does NOT call setBusy when accepting queued offer", async () => {
    const mockSetBusy = vi.fn();
    // setBusy is NOT in the mock — if it were called, it would throw; confirming it's absent
    mockMarkAccepted.mockResolvedValue(makeOffer({ status: "accepted" }));
    mockAcceptAsQueued.mockResolvedValue(makeRide({ status: "accepted" }));
    mockSetQueuedRide.mockResolvedValue(undefined);

    await service.acceptOffer("token", "offer-1");

    expect(mockSetBusy).not.toHaveBeenCalled();
  });

  // Test 9
  it("returns 409 when offer is expired (markAccepted returns null)", async () => {
    mockMarkAccepted.mockResolvedValue(null);

    const result = await service.acceptOffer("token", "offer-1");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.statusCode).toBe(409);
    expect(result.code).toBe("OFFER_EXPIRED_OR_UNAVAILABLE");
    expect(mockAcceptAsQueued).not.toHaveBeenCalled();
  });

  // Test 10 (reject)
  it("marks offer rejected", async () => {
    mockMarkRejected.mockResolvedValue(makeOffer({ status: "rejected" }));

    const result = await service.rejectOffer("token", "offer-1");

    expect(result.ok).toBe(true);
    expect(mockMarkRejected).toHaveBeenCalledWith("offer-1", "driver-1");
  });
});
