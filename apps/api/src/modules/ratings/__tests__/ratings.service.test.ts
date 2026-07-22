import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  verifyAccessToken,
  hashToken,
  isSessionValid,
  findUserById,
  findRideById,
  findByRideAndRater,
  createRating,
  getReceivedSummary,
} = vi.hoisted(() => ({
  verifyAccessToken: vi.fn(),
  hashToken: vi.fn().mockReturnValue("hash"),
  isSessionValid: vi.fn().mockResolvedValue(true),
  findUserById: vi.fn(),
  findRideById: vi.fn(),
  findByRideAndRater: vi.fn(),
  createRating: vi.fn(),
  getReceivedSummary: vi.fn(),
}));

vi.mock("../../auth/token.service.js", () => ({ TokenService: vi.fn().mockImplementation(() => ({ verifyAccessToken, hashToken })) }));
vi.mock("../../auth/session.service.js", () => ({ SessionService: vi.fn().mockImplementation(() => ({ isSessionValid })) }));
vi.mock("../../users/users.repository.js", () => ({ UsersRepository: vi.fn().mockImplementation(() => ({ findById: findUserById })) }));
vi.mock("../../rides/rides.repository.js", () => ({ RidesRepository: vi.fn().mockImplementation(() => ({ findById: findRideById })) }));
vi.mock("../ratings.repository.js", () => ({ RatingsRepository: vi.fn().mockImplementation(() => ({
  findByRideAndRater,
  create: createRating,
  findByRideId: vi.fn().mockResolvedValue([]),
  getReceivedSummary,
})) }));

const { RatingsService } = await import("../ratings.service.js");
const PASSENGER_ID = "11111111-1111-4111-8111-111111111111";
const DRIVER_ID = "22222222-2222-4222-8222-222222222222";
const RIDE_ID = "33333333-3333-4333-8333-333333333333";
const now = new Date("2026-07-19T16:00:00.000Z");

describe("RatingsService", () => {
  let service: InstanceType<typeof RatingsService>;
  beforeEach(() => {
    vi.clearAllMocks();
    service = new RatingsService();
    isSessionValid.mockResolvedValue(true);
    findByRideAndRater.mockResolvedValue(null);
  });

  it("guarda la calificación del pasajero al conductor", async () => {
    verifyAccessToken.mockReturnValue({ sub: PASSENGER_ID });
    findUserById.mockResolvedValue({ id: PASSENGER_ID, role: "passenger", status: "active" });
    findRideById.mockResolvedValue({ id: RIDE_ID, passengerUserId: PASSENGER_ID, driverUserId: DRIVER_ID, status: "completed" });
    createRating.mockResolvedValue({ id: "rating", rideRequestId: RIDE_ID, raterUserId: PASSENGER_ID, ratedUserId: DRIVER_ID, raterRole: "passenger", rating: 5, comment: "Excelente", createdAt: now, updatedAt: now });

    const result = await service.rateRide("token", RIDE_ID, { rating: 5, comment: "Excelente" });
    expect(result.ok).toBe(true);
    expect(createRating).toHaveBeenCalledWith(expect.objectContaining({ ratedUserId: DRIVER_ID, rating: 5 }));
  });

  it("bloquea calificar un viaje no completado", async () => {
    verifyAccessToken.mockReturnValue({ sub: PASSENGER_ID });
    findUserById.mockResolvedValue({ id: PASSENGER_ID, role: "passenger", status: "active" });
    findRideById.mockResolvedValue({ id: RIDE_ID, passengerUserId: PASSENGER_ID, driverUserId: DRIVER_ID, status: "in_progress" });
    const result = await service.rateRide("token", RIDE_ID, { rating: 5 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("RIDE_NOT_COMPLETED");
  });

  it("bloquea una segunda calificación del mismo usuario", async () => {
    verifyAccessToken.mockReturnValue({ sub: PASSENGER_ID });
    findUserById.mockResolvedValue({ id: PASSENGER_ID, role: "passenger", status: "active" });
    findRideById.mockResolvedValue({ id: RIDE_ID, passengerUserId: PASSENGER_ID, driverUserId: DRIVER_ID, status: "completed" });
    findByRideAndRater.mockResolvedValue({ id: "existing" });
    const result = await service.rateRide("token", RIDE_ID, { rating: 4 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("RATING_ALREADY_EXISTS");
  });

  it("devuelve promedio real al conductor", async () => {
    verifyAccessToken.mockReturnValue({ sub: DRIVER_ID });
    findUserById.mockResolvedValue({ id: DRIVER_ID, role: "driver", status: "active" });
    getReceivedSummary.mockResolvedValue({ average: 4.75, count: 8, latest: [] });
    const result = await service.getMyReceivedSummary("token");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.summary.average).toBe(4.75);
      expect(result.summary.count).toBe(8);
    }
  });

  it("impide al pasajero consultar el resumen de conductor", async () => {
    verifyAccessToken.mockReturnValue({ sub: PASSENGER_ID });
    findUserById.mockResolvedValue({ id: PASSENGER_ID, role: "passenger", status: "active" });
    const result = await service.getMyReceivedSummary("token");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("AUTH_FORBIDDEN");
  });
});
