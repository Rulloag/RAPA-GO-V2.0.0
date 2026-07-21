import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  verifyAccessToken,
  hashToken,
  isSessionValid,
  findUserById,
  findRideById,
  findByRideAndRater,
  createRating,
  findRatingsByRideId,
  getReceivedSummary,
  listRatingsForAdmin,
  moderateRating,
} = vi.hoisted(() => ({
  verifyAccessToken: vi.fn(),
  hashToken: vi.fn().mockReturnValue("hash"),
  isSessionValid: vi.fn().mockResolvedValue(true),
  findUserById: vi.fn(),
  findRideById: vi.fn(),
  findByRideAndRater: vi.fn(),
  createRating: vi.fn(),
  findRatingsByRideId: vi.fn(),
  getReceivedSummary: vi.fn(),
  listRatingsForAdmin: vi.fn(),
  moderateRating: vi.fn(),
}));

vi.mock("../../auth/token.service.js", () => ({ TokenService: vi.fn().mockImplementation(() => ({ verifyAccessToken, hashToken })) }));
vi.mock("../../auth/session.service.js", () => ({ SessionService: vi.fn().mockImplementation(() => ({ isSessionValid })) }));
vi.mock("../../users/users.repository.js", () => ({ UsersRepository: vi.fn().mockImplementation(() => ({ findById: findUserById })) }));
vi.mock("../../rides/rides.repository.js", () => ({ RidesRepository: vi.fn().mockImplementation(() => ({ findById: findRideById })) }));
vi.mock("../ratings.repository.js", () => ({ RatingsRepository: vi.fn().mockImplementation(() => ({
  findByRideAndRater,
  create: createRating,
  findByRideId: findRatingsByRideId,
  getReceivedSummary,
  listForAdmin: listRatingsForAdmin,
  moderate: moderateRating,
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
    findRatingsByRideId.mockResolvedValue([]);
    listRatingsForAdmin.mockResolvedValue([]);
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
  it("oculta al conductor un comentario marcado solo para RAPA GO", async () => {
    verifyAccessToken.mockReturnValue({ sub: DRIVER_ID });
    findUserById.mockResolvedValue({ id: DRIVER_ID, role: "driver", status: "active" });
    findRideById.mockResolvedValue({ id: RIDE_ID, passengerUserId: PASSENGER_ID, driverUserId: DRIVER_ID, status: "completed" });
    findRatingsByRideId.mockResolvedValue([{
      id: "private-rating",
      rideRequestId: RIDE_ID,
      raterUserId: PASSENGER_ID,
      ratedUserId: DRIVER_ID,
      raterRole: "passenger",
      rating: 3,
      comment: "Comentario privado para soporte",
      commentVisibility: "admin_only",
      moderationStatus: "visible",
      moderationReason: null,
      moderatedByUserId: null,
      moderatedAt: null,
      createdAt: now,
      updatedAt: now,
    }]);

    const result = await service.getRideRatings("token", RIDE_ID);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ratings[0]?.comment).toBeNull();
    expect(result.ratings[0]?.commentVisibility).toBe("admin_only");
  });

  it("permite al administrador moderar y conservar la trazabilidad", async () => {
    const ADMIN_ID = "44444444-4444-4444-8444-444444444444";
    verifyAccessToken.mockReturnValue({ sub: ADMIN_ID });
    findUserById.mockResolvedValue({ id: ADMIN_ID, role: "admin", status: "active" });
    moderateRating.mockResolvedValue({
      id: "private-rating",
      rideRequestId: RIDE_ID,
      raterUserId: PASSENGER_ID,
      ratedUserId: DRIVER_ID,
      raterRole: "passenger",
      rating: 3,
      comment: "Comentario privado para soporte",
      commentVisibility: "admin_only",
      moderationStatus: "hidden",
      moderationReason: "Contiene datos personales",
      moderatedByUserId: ADMIN_ID,
      moderatedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    const result = await service.moderate("token", "private-rating", {
      moderationStatus: "hidden",
      moderationReason: "Contiene datos personales",
    });

    expect(result.ok).toBe(true);
    expect(moderateRating).toHaveBeenCalledWith({
      id: "private-rating",
      moderationStatus: "hidden",
      moderationReason: "Contiene datos personales",
      moderatedByUserId: ADMIN_ID,
    });
    if (result.ok) expect(result.rating.comment).toBe("Comentario privado para soporte");
  });

});
