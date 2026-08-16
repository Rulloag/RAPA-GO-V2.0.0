import { beforeEach, describe, expect, it, vi } from "vitest";

const mockExpireStaleReturningRideIds = vi.fn();
const mockAttemptQueuedOffer = vi.fn();

vi.mock("../../modules/rides/rideAssignmentOffers.repository.js", () => ({
  RideAssignmentOffersRepository: vi.fn().mockImplementation(() => ({
    expireStaleReturningRideIds: mockExpireStaleReturningRideIds,
  })),
}));

vi.mock("../../modules/rides/rideQueueOfferProducer.service.js", () => ({
  attemptQueuedOffer: mockAttemptQueuedOffer,
}));

const { QueueOfferExpiryJob } = await import("../queueOfferExpiry.job.js");

function fakeLogger() {
  return { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } as never;
}

const NOW = new Date("2026-01-01T12:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  mockExpireStaleReturningRideIds.mockResolvedValue([]);
  mockAttemptQueuedOffer.mockResolvedValue({
    decision: "OFFER_CREATED",
    offerId: "offer-x",
    candidateDriverId: "driver-x",
    attemptOrder: 1,
  });
});

describe("QueueOfferExpiryJob.run", () => {
  it("TEST_1: sin ofertas vencidas → no dispara attemptQueuedOffer", async () => {
    mockExpireStaleReturningRideIds.mockResolvedValue([]);
    const logger = fakeLogger();
    const job = new QueueOfferExpiryJob(logger);
    await job.run(NOW);
    expect(mockAttemptQueuedOffer).not.toHaveBeenCalled();
  });

  it("TEST_2/TEST_3: oferta vencida con siguiente candidato → attemptQueuedOffer se dispara para ese ride", async () => {
    mockExpireStaleReturningRideIds.mockResolvedValue(["ride-1"]);
    const logger = fakeLogger();
    const job = new QueueOfferExpiryJob(logger);
    await job.run(NOW);
    expect(mockAttemptQueuedOffer).toHaveBeenCalledTimes(1);
    expect(mockAttemptQueuedOffer).toHaveBeenCalledWith("ride-1", expect.objectContaining({ now: NOW }));
  });

  it("TEST_4: oferta vencida sin candidato elegible → el job no falla, ride queda como decidió el productor", async () => {
    mockExpireStaleReturningRideIds.mockResolvedValue(["ride-1"]);
    mockAttemptQueuedOffer.mockResolvedValue({
      decision: "NO_ELIGIBLE_CANDIDATE",
      offerId: null,
      candidateDriverId: null,
      attemptOrder: null,
    });
    const logger = fakeLogger();
    const job = new QueueOfferExpiryJob(logger);
    await expect(job.run(NOW)).resolves.toBeUndefined();
    expect(mockAttemptQueuedOffer).toHaveBeenCalledTimes(1);
  });

  it("TEST_5: una oferta ya aceptada nunca aparece en expireStaleReturningRideIds (filtrado en BD por status='pending') → el job no la toca", async () => {
    // El filtro WHERE status='pending' vive en el repositorio (SQL), no en
    // el job: si la oferta ya fue aceptada, expireStaleReturningRideIds()
    // simplemente no la incluye en el resultado.
    mockExpireStaleReturningRideIds.mockResolvedValue([]);
    const logger = fakeLogger();
    const job = new QueueOfferExpiryJob(logger);
    await job.run(NOW);
    expect(mockAttemptQueuedOffer).not.toHaveBeenCalled();
  });

  it("TEST_6: carrera con rejectOffer concurrente → el productor ya trata la pérdida de carrera, el job no genera trabajo extra", async () => {
    mockExpireStaleReturningRideIds.mockResolvedValue(["ride-1"]);
    mockAttemptQueuedOffer.mockResolvedValue({
      decision: "LOST_RACE_RETRY_EXHAUSTED",
      offerId: null,
      candidateDriverId: null,
      attemptOrder: null,
    });
    const logger = fakeLogger();
    const job = new QueueOfferExpiryJob(logger);
    await job.run(NOW);
    expect(mockAttemptQueuedOffer).toHaveBeenCalledTimes(1);
  });

  it("TEST_7: dos ejecuciones simultáneas → la segunda se omite mientras la primera está en curso (idempotente)", async () => {
    let resolveExpire!: (rideIds: string[]) => void;
    mockExpireStaleReturningRideIds.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveExpire = resolve;
      }),
    );

    const logger = fakeLogger();
    const job = new QueueOfferExpiryJob(logger);

    const first = job.run(NOW);
    const second = job.run(NOW); // debe retornar de inmediato sin hacer nada

    await second;
    expect(mockExpireStaleReturningRideIds).toHaveBeenCalledTimes(1);

    resolveExpire(["ride-1"]);
    await first;
    expect(mockAttemptQueuedOffer).toHaveBeenCalledTimes(1);
  });

  it("TEST_8: un error en un ride no impide procesar los siguientes", async () => {
    mockExpireStaleReturningRideIds.mockResolvedValue(["ride-1", "ride-2"]);
    mockAttemptQueuedOffer.mockImplementation((rideId: string) => {
      if (rideId === "ride-1") return Promise.reject(new Error("boom"));
      return Promise.resolve({ decision: "OFFER_CREATED", offerId: "offer-2", candidateDriverId: "driver-2", attemptOrder: 1 });
    });

    const logger = fakeLogger();
    const job = new QueueOfferExpiryJob(logger);
    await expect(job.run(NOW)).resolves.toBeUndefined();

    expect(mockAttemptQueuedOffer).toHaveBeenCalledTimes(2);
    expect(mockAttemptQueuedOffer).toHaveBeenCalledWith("ride-1", expect.anything());
    expect(mockAttemptQueuedOffer).toHaveBeenCalledWith("ride-2", expect.anything());
    expect((logger as { error: ReturnType<typeof vi.fn> }).error).toHaveBeenCalled();
  });

  it("deduplica rideIds repetidos antes de llamar attemptQueuedOffer", async () => {
    mockExpireStaleReturningRideIds.mockResolvedValue(["ride-1", "ride-1"]);
    const logger = fakeLogger();
    const job = new QueueOfferExpiryJob(logger);
    await job.run(NOW);
    expect(mockAttemptQueuedOffer).toHaveBeenCalledTimes(1);
  });
});
