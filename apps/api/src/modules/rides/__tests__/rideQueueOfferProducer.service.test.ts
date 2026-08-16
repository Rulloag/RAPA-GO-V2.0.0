import { beforeEach, describe, expect, it, vi } from "vitest";

const mockExpireStale = vi.fn();
const mockFindById = vi.fn();
const mockFindPendingByRideId = vi.fn();
const mockFindDriverIdsByRideId = vi.fn();
const mockCreateOffer = vi.fn();

const mockRideFindById = vi.fn();

const mockFindQueueCandidates = vi.fn();
const mockFindByDriverId = vi.fn();

vi.mock("../rideAssignmentOffers.repository.js", () => ({
  RideAssignmentOffersRepository: vi.fn().mockImplementation(() => ({
    expireStale: mockExpireStale,
    findById: mockFindById,
    findPendingByRideId: mockFindPendingByRideId,
    findDriverIdsByRideId: mockFindDriverIdsByRideId,
    createOffer: mockCreateOffer,
  })),
}));

vi.mock("../rides.repository.js", () => ({
  RidesRepository: vi.fn().mockImplementation(() => ({
    findById: mockRideFindById,
  })),
}));

vi.mock("../../drivers/driverStatus.repository.js", () => ({
  DriverStatusRepository: vi.fn().mockImplementation(() => ({
    findQueueCandidates: mockFindQueueCandidates,
    findByDriverId: mockFindByDriverId,
  })),
}));

const { attemptQueuedOffer } = await import("../rideQueueOfferProducer.service.js");

const NOW = new Date("2026-01-01T12:00:00.000Z");

const RIDE_B = {
  id: "ride-b",
  status: "requested",
  originLat: -33.4489,
  originLng: -70.6693,
};

// ~1km from DESTINATION_A below, passes the cheap distance filter.
const DESTINATION_A = { lat: -33.4489, lng: -70.6693 };

function candidate(overrides: Partial<{
  driverUserId: string;
  currentRideId: string;
  currentRideStatus: string;
  currentRideDestinationLat: number;
  currentRideDestinationLng: number;
  currentLat: number;
  currentLng: number;
  locationUpdatedAt: Date | null;
  vehicleCategory: null;
}> = {}) {
  return {
    driverUserId: "driver-1",
    currentRideId: "ride-a-1",
    currentRideStatus: "in_progress",
    currentRideDestinationLat: DESTINATION_A.lat,
    currentRideDestinationLng: DESTINATION_A.lng,
    currentLat: DESTINATION_A.lat,
    currentLng: DESTINATION_A.lng,
    locationUpdatedAt: NOW,
    vehicleCategory: null,
    ...overrides,
  };
}

function driverStatusRow(overrides: Partial<{
  currentRideId: string | null;
  queuedRideId: string | null;
  availability: string;
}> = {}) {
  return {
    driverUserId: "driver-1",
    currentRideId: "ride-a-1",
    queuedRideId: null,
    availability: "busy",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockExpireStale.mockResolvedValue(0);
  mockRideFindById.mockResolvedValue(RIDE_B);
  mockFindPendingByRideId.mockResolvedValue(null);
  mockFindDriverIdsByRideId.mockResolvedValue([]);
  mockFindQueueCandidates.mockResolvedValue([]);
  mockFindByDriverId.mockImplementation((driverUserId: string) =>
    Promise.resolve(driverStatusRow({ driverUserId } as never)),
  );
  mockCreateOffer.mockImplementation((input: { rideRequestId: string; driverUserId: string; attemptOrder?: number }) =>
    Promise.resolve({
      id: `offer-${input.driverUserId}`,
      rideRequestId: input.rideRequestId,
      driverUserId: input.driverUserId,
      status: "pending",
      offeredAt: NOW,
      expiresAt: new Date(NOW.getTime() + 20_000),
      respondedAt: null,
      responseSource: null,
      attemptOrder: input.attemptOrder ?? 1,
      createdAt: NOW,
      updatedAt: NOW,
    }),
  );
});

describe("rideQueueOfferProducer — attemptQueuedOffer", () => {
  it("TEST_1: no hay conductor elegible → no createOffer", async () => {
    mockFindQueueCandidates.mockResolvedValue([]);
    const result = await attemptQueuedOffer(RIDE_B.id, { now: NOW });
    expect(result.decision).toBe("NO_ELIGIBLE_CANDIDATE");
    expect(mockCreateOffer).not.toHaveBeenCalled();
  });

  it("TEST_2: un conductor elegible → una oferta pending", async () => {
    mockFindQueueCandidates.mockResolvedValue([candidate()]);
    const result = await attemptQueuedOffer(RIDE_B.id, { now: NOW });
    expect(result.decision).toBe("OFFER_CREATED");
    expect(result.candidateDriverId).toBe("driver-1");
    expect(mockCreateOffer).toHaveBeenCalledTimes(1);
    expect(mockCreateOffer).toHaveBeenCalledWith(
      expect.objectContaining({ rideRequestId: RIDE_B.id, driverUserId: "driver-1", attemptOrder: 1 }),
    );
  });

  it("TEST_3: varios elegibles → solo el de mejor score recibe la primera oferta", async () => {
    // near: destino de A coincide con el origen de B (pickup ~0km).
    // far: destino de A está a ~2km del origen de B — dentro del límite,
    // pero peor score (mayor ETA de recogida) que near.
    const near = candidate({ driverUserId: "driver-near" });
    const far = candidate({
      driverUserId: "driver-far",
      currentLat: -33.4670,
      currentLng: -70.6693,
      currentRideDestinationLat: -33.4670,
      currentRideDestinationLng: -70.6693,
    });
    mockFindQueueCandidates.mockResolvedValue([far, near]);
    mockFindByDriverId.mockImplementation((driverUserId: string) =>
      Promise.resolve(driverStatusRow({ driverUserId } as never)),
    );

    const result = await attemptQueuedOffer(RIDE_B.id, { now: NOW });
    expect(result.decision).toBe("OFFER_CREATED");
    expect(result.candidateDriverId).toBe("driver-near");
    expect(mockCreateOffer).toHaveBeenCalledTimes(1);
  });

  it("TEST_4: mejor conductor ya tiene queued ride al revalidar → pasa al siguiente candidato", async () => {
    const best = candidate({ driverUserId: "driver-best" });
    const second = candidate({ driverUserId: "driver-second" });
    mockFindQueueCandidates.mockResolvedValue([best, second]);

    mockFindByDriverId.mockImplementation((driverUserId: string) => {
      if (driverUserId === "driver-best") {
        return Promise.resolve(driverStatusRow({ queuedRideId: "some-other-ride" } as never));
      }
      return Promise.resolve(driverStatusRow({ driverUserId } as never));
    });

    const result = await attemptQueuedOffer(RIDE_B.id, { now: NOW });
    expect(result.decision).toBe("OFFER_CREATED");
    expect(result.candidateDriverId).toBe("driver-second");
  });

  it("TEST_5: ride B deja de ser 'requested' → no oferta", async () => {
    mockRideFindById.mockResolvedValue({ ...RIDE_B, status: "accepted" });
    mockFindQueueCandidates.mockResolvedValue([candidate()]);
    const result = await attemptQueuedOffer(RIDE_B.id, { now: NOW });
    expect(result.decision).toBe("RIDE_NOT_REQUESTED");
    expect(mockCreateOffer).not.toHaveBeenCalled();
  });

  it("TEST_6: ya existe oferta pending para el ride → no duplicar", async () => {
    mockFindPendingByRideId.mockResolvedValue({
      id: "offer-existing",
      rideRequestId: RIDE_B.id,
      driverUserId: "driver-existing",
      status: "pending",
      attemptOrder: 1,
    });
    const result = await attemptQueuedOffer(RIDE_B.id, { now: NOW });
    expect(result.decision).toBe("OFFER_ALREADY_PENDING");
    expect(mockCreateOffer).not.toHaveBeenCalled();
  });

  it("TEST_7: oferta anterior expiró → llama expireStale y avanza a un candidato nuevo", async () => {
    // La oferta previa ya no aparece como pending (expireStale la limpió) y
    // el conductor que ya la tuvo se excluye vía findDriverIdsByRideId.
    mockFindDriverIdsByRideId.mockResolvedValue(["driver-expired"]);
    mockFindQueueCandidates.mockResolvedValue([candidate({ driverUserId: "driver-next" })]);

    const result = await attemptQueuedOffer(RIDE_B.id, { now: NOW });

    expect(mockExpireStale).toHaveBeenCalledTimes(1);
    expect(mockFindQueueCandidates).toHaveBeenCalledWith(["driver-expired"]);
    expect(result.decision).toBe("OFFER_CREATED");
    expect(result.candidateDriverId).toBe("driver-next");
    expect(result.attemptOrder).toBe(2);
  });

  it("TEST_8: conductor rechaza (ya no aparece como candidato) → siguiente candidato", async () => {
    mockFindDriverIdsByRideId.mockResolvedValue(["driver-rejected"]);
    mockFindQueueCandidates.mockResolvedValue([candidate({ driverUserId: "driver-next" })]);

    const result = await attemptQueuedOffer(RIDE_B.id, { now: NOW });

    expect(mockFindQueueCandidates).toHaveBeenCalledWith(["driver-rejected"]);
    expect(result.decision).toBe("OFFER_CREATED");
    expect(result.candidateDriverId).toBe("driver-next");
  });

  it("TEST_9: dos productores concurrentes → sólo una oferta efectiva (23505 se trata como carrera perdida)", async () => {
    const first = candidate({ driverUserId: "driver-1" });
    const second = candidate({ driverUserId: "driver-2" });
    mockFindQueueCandidates.mockResolvedValue([first, second]);

    const uniqueViolation = Object.assign(new Error("duplicate key value"), { code: "23505" });
    mockCreateOffer.mockImplementationOnce(() => Promise.reject(uniqueViolation));
    mockCreateOffer.mockImplementationOnce((input: { driverUserId: string; rideRequestId: string; attemptOrder?: number }) =>
      Promise.resolve({
        id: "offer-2",
        rideRequestId: input.rideRequestId,
        driverUserId: input.driverUserId,
        status: "pending",
        offeredAt: NOW,
        expiresAt: new Date(NOW.getTime() + 20_000),
        respondedAt: null,
        responseSource: null,
        attemptOrder: input.attemptOrder ?? 1,
        createdAt: NOW,
        updatedAt: NOW,
      }),
    );

    const result = await attemptQueuedOffer(RIDE_B.id, { now: NOW });
    expect(mockCreateOffer).toHaveBeenCalledTimes(2);
    expect(result.decision).toBe("OFFER_CREATED");
    expect(result.offerId).toBe("offer-2");
  });

  it("un error que NO es violación de unicidad se propaga (no se trata como carrera)", async () => {
    mockFindQueueCandidates.mockResolvedValue([candidate()]);
    mockCreateOffer.mockRejectedValue(new Error("db connection lost"));
    await expect(attemptQueuedOffer(RIDE_B.id, { now: NOW })).rejects.toThrow("db connection lost");
  });

  it("TEST_10: mismas entradas producen la misma decisión y candidato (determinismo)", async () => {
    mockFindQueueCandidates.mockResolvedValue([candidate({ driverUserId: "driver-a" }), candidate({ driverUserId: "driver-b" })]);
    const r1 = await attemptQueuedOffer(RIDE_B.id, { now: NOW });
    vi.clearAllMocks();
    mockExpireStale.mockResolvedValue(0);
    mockRideFindById.mockResolvedValue(RIDE_B);
    mockFindPendingByRideId.mockResolvedValue(null);
    mockFindDriverIdsByRideId.mockResolvedValue([]);
    mockFindQueueCandidates.mockResolvedValue([candidate({ driverUserId: "driver-a" }), candidate({ driverUserId: "driver-b" })]);
    mockFindByDriverId.mockImplementation((driverUserId: string) => Promise.resolve(driverStatusRow({ driverUserId } as never)));
    mockCreateOffer.mockImplementation((input: { rideRequestId: string; driverUserId: string; attemptOrder?: number }) =>
      Promise.resolve({
        id: `offer-${input.driverUserId}`,
        rideRequestId: input.rideRequestId,
        driverUserId: input.driverUserId,
        status: "pending",
        offeredAt: NOW,
        expiresAt: new Date(NOW.getTime() + 20_000),
        respondedAt: null,
        responseSource: null,
        attemptOrder: input.attemptOrder ?? 1,
        createdAt: NOW,
        updatedAt: NOW,
      }),
    );
    const r2 = await attemptQueuedOffer(RIDE_B.id, { now: NOW });

    expect(r1.decision).toBe(r2.decision);
    expect(r1.candidateDriverId).toBe(r2.candidateDriverId);
  });

  it("no vuelve a ofrecer a un conductor que ya tuvo una oferta para este ride", async () => {
    mockFindDriverIdsByRideId.mockResolvedValue(["driver-already-tried"]);
    mockFindQueueCandidates.mockResolvedValue([]);
    const result = await attemptQueuedOffer(RIDE_B.id, { now: NOW });
    expect(mockFindQueueCandidates).toHaveBeenCalledWith(["driver-already-tried"]);
    expect(result.decision).toBe("NO_ELIGIBLE_CANDIDATE");
  });
});
