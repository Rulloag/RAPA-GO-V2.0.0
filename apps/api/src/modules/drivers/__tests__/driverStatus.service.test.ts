import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockFindCompletedByDriverIdOnDate = vi.fn();
const mockFindDriverStatusById          = vi.fn();
const mockIsSessionValid                = vi.fn().mockResolvedValue(true);
const mockFindUserById                  = vi.fn();
const mockClearStaleCurrentRide         = vi.fn();
const mockUpsertDriverStatus            = vi.fn();
const mockResolveQueuedRideOnAbnormalEnd = vi.fn();
const mockMarkCancelledByRideId         = vi.fn();
const mockAttemptQueuedOffer            = vi.fn();
const mockFindActiveRideIdForDriver     = vi.fn();
const mockSetUnavailableForRest         = vi.fn();
const mockCanReceiveNewOffers           = vi.fn();

vi.mock("../driverStatus.repository.js", () => ({
  DriverStatusRepository: vi.fn().mockImplementation(() => ({
    findByDriverId:  mockFindDriverStatusById,
    upsert:          mockUpsertDriverStatus,
    setBusy:         vi.fn(),
    setAvailable:    vi.fn(),
    updateLocation:  vi.fn(),
    clearStaleCurrentRide: mockClearStaleCurrentRide,
    resolveQueuedRideOnAbnormalEnd: mockResolveQueuedRideOnAbnormalEnd,
    setUnavailableForRest: mockSetUnavailableForRest,
  })),
}));

vi.mock("../../rides/rideAssignmentOffers.repository.js", () => ({
  RideAssignmentOffersRepository: vi.fn().mockImplementation(() => ({
    markCancelledByRideId: mockMarkCancelledByRideId,
  })),
}));

vi.mock("../../rides/rideQueueOfferProducer.service.js", () => ({
  attemptQueuedOffer: mockAttemptQueuedOffer,
}));

vi.mock("../../rides/rides.repository.js", () => ({
  RidesRepository: vi.fn().mockImplementation(() => ({
    findCompletedByDriverIdOnDate: mockFindCompletedByDriverIdOnDate,
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

// ── Import after mocks ────────────────────────────────────────────────────────

// DriverStatusService construye dependencias de compliance al cargar el modulo.
// Este test de ganancias debe permanecer aislado de la base de datos real.
vi.mock("../driverCompliance.service.js", () => ({
  DriverComplianceService: vi.fn().mockImplementation(() => ({
    canReceiveNewOffers: mockCanReceiveNewOffers,
  })),
}));

vi.mock("../driverCompliance.repository.js", () => ({
  DriverComplianceRepository: vi.fn().mockImplementation(() => ({
    findActiveRideIdForDriver: mockFindActiveRideIdForDriver,
  })),
}));
const { DriverStatusService } = await import("../driverStatus.service.js");

// ── Helpers ───────────────────────────────────────────────────────────────────

const NOW = new Date();

function makeRide(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id:                "ride-1",
    driverUserId:      "driver-1",
    passengerUserId:   "passenger-1",
    status:            "completed",
    estimatedFareClp:  10000,
    completedAt:       NOW,
    createdAt:         NOW,
    updatedAt:         NOW,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("DriverStatusService.getTodayEarnings", () => {
  let service: InstanceType<typeof DriverStatusService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSessionValid.mockResolvedValue(true);
    service = new DriverStatusService();
  });

  it("driver with no completed rides returns 0 earnings", async () => {
    mockFindUserById.mockResolvedValue({ id: "driver-1", role: "driver" });
    mockFindCompletedByDriverIdOnDate.mockResolvedValue([]);

    const result = await service.getTodayEarnings("token");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.earnings.completedRides).toBe(0);
    expect(result.earnings.grossFareClp).toBe(0);
    expect(result.earnings.appCommissionClp).toBe(0);
    expect(result.earnings.netEarningsClp).toBe(0);
    expect(result.earnings.appCommissionPercent).toBe(23);
  });

  it("one completed ride is counted correctly", async () => {
    mockFindUserById.mockResolvedValue({ id: "driver-1", role: "driver" });
    mockFindCompletedByDriverIdOnDate.mockResolvedValue([makeRide({ estimatedFareClp: 10000 })]);

    const result = await service.getTodayEarnings("token");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.earnings.completedRides).toBe(1);
    expect(result.earnings.grossFareClp).toBe(10000);
    expect(result.earnings.appCommissionClp).toBe(2300);
    expect(result.earnings.netEarningsClp).toBe(7700);
  });

  it("multiple completed rides sum correctly", async () => {
    mockFindUserById.mockResolvedValue({ id: "driver-1", role: "driver" });
    mockFindCompletedByDriverIdOnDate.mockResolvedValue([
      makeRide({ id: "r1", estimatedFareClp: 5000 }),
      makeRide({ id: "r2", estimatedFareClp: 8000 }),
      makeRide({ id: "r3", estimatedFareClp: 12000 }),
    ]);

    const result = await service.getTodayEarnings("token");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.earnings.completedRides).toBe(3);
    expect(result.earnings.grossFareClp).toBe(25000);
    expect(result.earnings.appCommissionClp).toBe(5750);
    expect(result.earnings.netEarningsClp).toBe(19250);
  });

  it("ride with null estimatedFareClp is treated as 0", async () => {
    mockFindUserById.mockResolvedValue({ id: "driver-1", role: "driver" });
    mockFindCompletedByDriverIdOnDate.mockResolvedValue([
      makeRide({ estimatedFareClp: null }),
      makeRide({ id: "r2", estimatedFareClp: 6000 }),
    ]);

    const result = await service.getTodayEarnings("token");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.earnings.completedRides).toBe(2);
    expect(result.earnings.grossFareClp).toBe(6000);
  });

  it("commission is exactly 23% rounded", async () => {
    mockFindUserById.mockResolvedValue({ id: "driver-1", role: "driver" });
    // 13333 * 0.23 = 3066.59 → rounds to 3067
    mockFindCompletedByDriverIdOnDate.mockResolvedValue([makeRide({ estimatedFareClp: 13333 })]);

    const result = await service.getTodayEarnings("token");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.earnings.appCommissionClp).toBe(Math.round(13333 * 0.23));
    expect(result.earnings.netEarningsClp).toBe(13333 - Math.round(13333 * 0.23));
  });

  it("passenger cannot query driver earnings", async () => {
    mockFindUserById.mockResolvedValue({ id: "passenger-1", role: "passenger" });

    const result = await service.getTodayEarnings("token");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.statusCode).toBe(403);
  });

  it("response includes date in YYYY-MM-DD format", async () => {
    mockFindUserById.mockResolvedValue({ id: "driver-1", role: "driver" });
    mockFindCompletedByDriverIdOnDate.mockResolvedValue([]);

    const result = await service.getTodayEarnings("token");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.earnings.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("DriverStatusService.getMyStatus — reconciliación de estado stale (Fase 5.2, TEST_5_2_3)", () => {
  let service: InstanceType<typeof DriverStatusService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSessionValid.mockResolvedValue(true);
    mockFindUserById.mockResolvedValue({ id: "driver-1", role: "driver" });
    mockClearStaleCurrentRide.mockResolvedValue(undefined);
    mockUpsertDriverStatus.mockResolvedValue({ driverUserId: "driver-1", availability: "unavailable", currentRideId: null, queuedRideId: null, currentZone: null, lastSeenAt: null });
    mockResolveQueuedRideOnAbnormalEnd.mockResolvedValue({ decision: "NO_QUEUED_RIDE" });
    mockMarkCancelledByRideId.mockResolvedValue(1);
    mockAttemptQueuedOffer.mockResolvedValue({ decision: "NO_ELIGIBLE_CANDIDATE", offerId: null, candidateDriverId: null, attemptOrder: null });
    service = new DriverStatusService();
  });

  it("current_ride_id apunta a una ride A ya no activa, sin B en cola → sólo se limpia current_ride_id (comportamiento previo intacto)", async () => {
    mockFindDriverStatusById
      .mockResolvedValueOnce({ driverUserId: "driver-1", availability: "busy", currentRideId: "ride-a", queuedRideId: null, currentZone: null, lastSeenAt: null })
      .mockResolvedValueOnce({ driverUserId: "driver-1", availability: "unavailable", currentRideId: null, queuedRideId: null, currentZone: null, lastSeenAt: null });
    mockFindActiveRideIdForDriver.mockResolvedValue(null);

    const result = await service.getMyStatus("token");

    expect(result.ok).toBe(true);
    expect(mockResolveQueuedRideOnAbnormalEnd).toHaveBeenCalledWith("driver-1", "ride-a");
    expect(mockClearStaleCurrentRide).toHaveBeenCalledWith("driver-1");
    expect(mockMarkCancelledByRideId).not.toHaveBeenCalled();
  });

  it("TEST_5_2_3: current_ride_id stale CON B en cola → resuelve B antes de limpiar, nunca deja al conductor available con queued_ride_id colgando", async () => {
    mockFindDriverStatusById
      .mockResolvedValueOnce({ driverUserId: "driver-1", availability: "busy", currentRideId: "ride-a", queuedRideId: "ride-b", currentZone: null, lastSeenAt: null })
      .mockResolvedValueOnce({ driverUserId: "driver-1", availability: "unavailable", currentRideId: null, queuedRideId: null, currentZone: null, lastSeenAt: null });
    mockFindActiveRideIdForDriver.mockResolvedValue(null);
    mockResolveQueuedRideOnAbnormalEnd.mockResolvedValue({ decision: "RESOLVED", releasedRideId: "ride-b" });

    const result = await service.getMyStatus("token");

    expect(result.ok).toBe(true);
    expect(mockResolveQueuedRideOnAbnormalEnd).toHaveBeenCalledWith("driver-1", "ride-a");
    // La resolución de B ocurre ANTES de clearStaleCurrentRide.
    const resolveOrder = mockResolveQueuedRideOnAbnormalEnd.mock.invocationCallOrder[0];
    const clearOrder = mockClearStaleCurrentRide.mock.invocationCallOrder[0];
    expect(resolveOrder).toBeLessThan(clearOrder as number);
    expect(mockMarkCancelledByRideId).toHaveBeenCalledWith("ride-b");
    expect(mockAttemptQueuedOffer).toHaveBeenCalledWith("ride-b");
    if (!result.ok) return;
    expect(result.status.queuedRideId).toBeNull();
  });
});
