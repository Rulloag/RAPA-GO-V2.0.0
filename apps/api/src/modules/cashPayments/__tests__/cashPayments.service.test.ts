import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  verifyAccessToken,
  hashToken,
  isSessionValid,
  findUserById,
  findRideById,
  findClosureByRideId,
  createClosure,
  listByParticipant,
  listForAdmin,
} = vi.hoisted(() => ({
  verifyAccessToken: vi.fn(),
  hashToken: vi.fn().mockReturnValue("hashed-token"),
  isSessionValid: vi.fn().mockResolvedValue(true),
  findUserById: vi.fn(),
  findRideById: vi.fn(),
  findClosureByRideId: vi.fn(),
  createClosure: vi.fn(),
  listByParticipant: vi.fn(),
  listForAdmin: vi.fn(),
}));

vi.mock("../../auth/token.service.js", () => ({
  TokenService: vi.fn().mockImplementation(() => ({
    verifyAccessToken,
    hashToken,
  })),
}));

vi.mock("../../auth/session.service.js", () => ({
  SessionService: vi.fn().mockImplementation(() => ({
    isSessionValid,
  })),
}));

vi.mock("../../users/users.repository.js", () => ({
  UsersRepository: vi.fn().mockImplementation(() => ({
    findById: findUserById,
  })),
}));

vi.mock("../../rides/rides.repository.js", () => ({
  RidesRepository: vi.fn().mockImplementation(() => ({
    findById: findRideById,
  })),
}));

vi.mock("../cashPayments.repository.js", () => ({
  CashPaymentsRepository: vi.fn().mockImplementation(() => ({
    findByRideId: findClosureByRideId,
    create: createClosure,
    listByParticipant,
    listForAdmin,
  })),
}));

import { CashPaymentsService } from "../cashPayments.service.js";

const DRIVER_ID = "11111111-1111-4111-8111-111111111111";
const PASSENGER_ID = "22222222-2222-4222-8222-222222222222";
const RIDE_ID = "33333333-3333-4333-8333-333333333333";
const CLOSURE_ID = "44444444-4444-4444-8444-444444444444";
const CLOSED_AT = new Date("2026-07-21T12:00:00.000Z");

const driver = {
  id: DRIVER_ID,
  role: "driver",
};

const completedCashRide = {
  id: RIDE_ID,
  passengerUserId: PASSENGER_ID,
  driverUserId: DRIVER_ID,
  status: "completed",
  paymentMethod: "cash",
  notes: "Pago en efectivo",
  estimatedFareClp: 10_000,
};

const closure = {
  id: CLOSURE_ID,
  rideRequestId: RIDE_ID,
  passengerUserId: PASSENGER_ID,
  driverUserId: DRIVER_ID,
  fareClp: 10_000,
  paidClp: 12_000,
  overpaidClp: 2_000,
  decision: "overpaid",
  status: "overpayment_pending_choice",
  resolutionType: null,
  resolutionReferenceId: null,
  driverNote: "El pasajero dejó el excedente.",
  closedAt: CLOSED_AT,
  createdAt: CLOSED_AT,
  updatedAt: CLOSED_AT,
};

describe("CashPaymentsService", () => {
  let service: CashPaymentsService;

  beforeEach(() => {
    vi.clearAllMocks();
    verifyAccessToken.mockReturnValue({ sub: DRIVER_ID });
    hashToken.mockReturnValue("hashed-token");
    isSessionValid.mockResolvedValue(true);
    findUserById.mockResolvedValue(driver);
    findRideById.mockResolvedValue(completedCashRide);
    findClosureByRideId.mockResolvedValue(null);
    createClosure.mockResolvedValue(closure);
    listByParticipant.mockResolvedValue([]);
    listForAdmin.mockResolvedValue([]);
    service = new CashPaymentsService();
  });

  it("closes a completed cash ride and records the overpayment", async () => {
    const result = await service.close("access-token", RIDE_ID, {
      paidClp: 12_000,
      decision: "overpaid",
      note: " El pasajero dejó el excedente. ",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.alreadyExisted).toBe(false);
    expect(result.closure.overpaidClp).toBe(2_000);
    expect(result.closure.status).toBe("overpayment_pending_choice");
    expect(createClosure).toHaveBeenCalledWith(expect.objectContaining({
      rideRequestId: RIDE_ID,
      passengerUserId: PASSENGER_ID,
      driverUserId: DRIVER_ID,
      fareClp: 10_000,
      paidClp: 12_000,
      overpaidClp: 2_000,
      decision: "overpaid",
      status: "overpayment_pending_choice",
      driverNote: "El pasajero dejó el excedente.",
    }));
  });

  it("rejects an amount lower than the final fare", async () => {
    const result = await service.close("access-token", RIDE_ID, {
      paidClp: 9_000,
      decision: "exact",
    });

    expect(result).toMatchObject({
      ok: false,
      code: "CASH_UNDERPAYMENT_NOT_ALLOWED",
      statusCode: 422,
    });
    expect(createClosure).not.toHaveBeenCalled();
  });

  it("rejects closure attempts from a non-driver account", async () => {
    findUserById.mockResolvedValue({ id: PASSENGER_ID, role: "passenger" });

    const result = await service.close("access-token", RIDE_ID, {
      paidClp: 10_000,
      decision: "exact",
    });

    expect(result).toMatchObject({
      ok: false,
      code: "AUTH_FORBIDDEN",
      statusCode: 403,
    });
    expect(findRideById).not.toHaveBeenCalled();
  });

  it("returns the existing closure when the retry is identical", async () => {
    findClosureByRideId.mockResolvedValue(closure);

    const result = await service.close("access-token", RIDE_ID, {
      paidClp: 12_000,
      decision: "overpaid",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.alreadyExisted).toBe(true);
    expect(result.closure.id).toBe(CLOSURE_ID);
    expect(createClosure).not.toHaveBeenCalled();
  });
});
