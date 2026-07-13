import { describe, it, expect, vi, beforeEach } from "vitest";

// ── vi.hoisted: all mock fns must exist before vi.mock factories run ───────────
const {
  mockVerifyAccessToken,
  mockHashToken,
  mockIsSessionValid,
  mockFindUserById,
  mockCreatePaymentOrder,
  mockRecordSafe,
  mockDbLimit,
} = vi.hoisted(() => ({
  mockVerifyAccessToken: vi.fn(),
  mockHashToken:         vi.fn().mockReturnValue("hashed-token"),
  mockIsSessionValid:    vi.fn().mockResolvedValue(true),
  mockFindUserById:      vi.fn(),
  mockCreatePaymentOrder: vi.fn(),
  mockRecordSafe:        vi.fn(),
  mockDbLimit:           vi.fn(),
}));

vi.mock("../../auth/token.service.js", () => ({
  TokenService: vi.fn().mockImplementation(() => ({
    verifyAccessToken: mockVerifyAccessToken,
    hashToken:         mockHashToken,
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
vi.mock("../wallet.repository.js", () => ({
  WalletRepository: vi.fn().mockImplementation(() => ({
    createPaymentOrder: mockCreatePaymentOrder,
  })),
}));
vi.mock("../../audit/audit.service.js", () => ({
  AuditService: vi.fn().mockImplementation(() => ({ recordSafe: mockRecordSafe })),
}));
vi.mock("../../../db/client.js", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: mockDbLimit,
        }),
      }),
    }),
  },
}));

import { WalletService } from "../wallet.service.js";

// ── Fixtures ───────────────────────────────────────────────────────────────────

const PASSENGER_ID = "user-passenger-uuid";
const OTHER_PASSENGER_ID = "user-other-passenger-uuid";
const RIDE_ID = "ride-uuid";

const passengerUser = {
  id:   PASSENGER_ID,
  role: "passenger",
};

function fakeRideRow(estimatedFareClp: number, status = "requested", passengerUserId = PASSENGER_ID) {
  return {
    id:               RIDE_ID,
    passengerUserId,
    estimatedFareClp,
    status,
  };
}

function setupPassengerAuth() {
  mockVerifyAccessToken.mockReturnValue({ sub: PASSENGER_ID });
  mockFindUserById.mockResolvedValue(passengerUser);
}

describe("WalletService.createPaymentOrder — integridad de monto", () => {
  let service: WalletService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSessionValid.mockResolvedValue(true);
    service = new WalletService();
  });

  it("ignora un amount manipulado a la baja (1) y usa la tarifa real del viaje", async () => {
    setupPassengerAuth();
    mockDbLimit.mockResolvedValue([fakeRideRow(7000)]);
    mockCreatePaymentOrder.mockImplementation((data) => Promise.resolve({ id: "order-uuid", ...data, createdAt: new Date() }));

    const result = await service.createPaymentOrder("tok", { rideId: RIDE_ID, amount: 1 });

    expect(result.ok).toBe(true);
    expect(mockCreatePaymentOrder).toHaveBeenCalledTimes(1);
    const persistedAmount = mockCreatePaymentOrder.mock.calls[0]![0].amount;
    expect(persistedAmount).toBe(7000);
    expect(mockRecordSafe).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "wallet.payment_order_amount_mismatch" }),
    );
  });

  it("ignora un amount exagerado (999999999) y no lo persiste", async () => {
    setupPassengerAuth();
    mockDbLimit.mockResolvedValue([fakeRideRow(5000)]);
    mockCreatePaymentOrder.mockImplementation((data) => Promise.resolve({ id: "order-uuid", ...data, createdAt: new Date() }));

    const result = await service.createPaymentOrder("tok", { rideId: RIDE_ID, amount: 999999999 });

    expect(result.ok).toBe(true);
    const persistedAmount = mockCreatePaymentOrder.mock.calls[0]![0].amount;
    expect(persistedAmount).toBe(5000);
  });

  it("no registra discrepancia cuando el amount enviado coincide con la tarifa real", async () => {
    setupPassengerAuth();
    mockDbLimit.mockResolvedValue([fakeRideRow(5000)]);
    mockCreatePaymentOrder.mockImplementation((data) => Promise.resolve({ id: "order-uuid", ...data, createdAt: new Date() }));

    const result = await service.createPaymentOrder("tok", { rideId: RIDE_ID, amount: 5000 });

    expect(result.ok).toBe(true);
    const persistedAmount = mockCreatePaymentOrder.mock.calls[0]![0].amount;
    expect(persistedAmount).toBe(5000);
    expect(mockRecordSafe).not.toHaveBeenCalled();
  });

  it("rechaza con 404 si el viaje no existe, sin crear orden", async () => {
    setupPassengerAuth();
    mockDbLimit.mockResolvedValue([]);

    const result = await service.createPaymentOrder("tok", { rideId: RIDE_ID, amount: 1000 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_FOUND");
    expect(mockCreatePaymentOrder).not.toHaveBeenCalled();
  });

  it("rechaza con 403 si el viaje pertenece a otro pasajero", async () => {
    setupPassengerAuth();
    mockDbLimit.mockResolvedValue([fakeRideRow(5000, "requested", OTHER_PASSENGER_ID)]);

    const result = await service.createPaymentOrder("tok", { rideId: RIDE_ID, amount: 5000 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("AUTH_FORBIDDEN");
    expect(mockCreatePaymentOrder).not.toHaveBeenCalled();
  });

  it("rechaza con 409 si el viaje está en un estado no permitido (cancelled)", async () => {
    setupPassengerAuth();
    mockDbLimit.mockResolvedValue([fakeRideRow(5000, "cancelled")]);

    const result = await service.createPaymentOrder("tok", { rideId: RIDE_ID, amount: 5000 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("PAYMENT_RIDE_STATUS_NOT_ALLOWED");
    expect(mockCreatePaymentOrder).not.toHaveBeenCalled();
  });
});
