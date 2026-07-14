import { describe, it, expect, vi, beforeEach } from "vitest";

// ── vi.hoisted: all mock fns must exist before vi.mock factories run ───────────
const {
  mockVerifyAccessToken,
  mockHashToken,
  mockIsSessionValid,
  mockFindUserById,
  mockCreditUserWallet,
  mockCreatePaymentOrder,
  mockRecordSafe,
  mockDbLimit,
} = vi.hoisted(() => ({
  mockVerifyAccessToken: vi.fn(),
  mockHashToken:         vi.fn().mockReturnValue("hashed-token"),
  mockIsSessionValid:    vi.fn().mockResolvedValue(true),
  mockFindUserById:      vi.fn(),
  mockCreditUserWallet:  vi.fn(),
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
    creditUserWallet:   mockCreditUserWallet,
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

const ADMIN_ID            = "11111111-1111-4111-8111-111111111111";
const PASSENGER_ID        = "22222222-2222-4222-8222-222222222222";
const OTHER_PASSENGER_ID  = "user-other-passenger-uuid";
const RIDE_ID              = "ride-uuid";

const adminUser = {
  id:    ADMIN_ID,
  email: "admin@test.com",
  name:  "Admin",
  role:  "admin",
};

const passengerUser = {
  id:    PASSENGER_ID,
  email: "passenger@test.com",
  name:  "Passenger",
  role:  "passenger",
};

function fakeRideRow(estimatedFareClp: number, status = "requested", passengerUserId = PASSENGER_ID) {
  return {
    id: RIDE_ID,
    passengerUserId,
    estimatedFareClp,
    status,
  };
}

function setupPassengerAuth() {
  mockVerifyAccessToken.mockReturnValue({ sub: PASSENGER_ID });
  mockFindUserById.mockResolvedValue(passengerUser);
}

describe("WalletService.adminCreateWalletCredit", () => {
  let service: WalletService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSessionValid.mockResolvedValue(true);
    service = new WalletService();
  });

  it("blocks passenger from approving wallet credit", async () => {
    mockVerifyAccessToken.mockReturnValue({ sub: PASSENGER_ID });
    mockFindUserById.mockResolvedValue(passengerUser);

    const result = await service.adminCreateWalletCredit("tok", {
      userId: PASSENGER_ID,
      amountClp: 5000,
      description: "Pago de mas aprobado",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("AUTH_FORBIDDEN");
      expect(result.statusCode).toBe(403);
    }
    expect(mockCreditUserWallet).not.toHaveBeenCalled();
  });

  it("credits passenger wallet when actor is admin", async () => {
    mockVerifyAccessToken.mockReturnValue({ sub: ADMIN_ID });
    mockFindUserById.mockImplementation(async (id: string) => {
      if (id === ADMIN_ID) return adminUser;
      if (id === PASSENGER_ID) return passengerUser;
      return null;
    });

    mockCreditUserWallet.mockResolvedValue({
      wallet: {
        id: "wallet-1",
        userId: PASSENGER_ID,
        balance: 7000,
        currency: "CLP",
        status: "active",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      transaction: {
        id: "transaction-1",
        walletId: "wallet-1",
        userId: PASSENGER_ID,
        rideId: null,
        type: "credit",
        amount: 7000,
        currency: "CLP",
        status: "completed",
        provider: "admin",
        providerTransactionId: "admin-credit:test-1",
        description: "Pago de mas aprobado",
        metadata: {},
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    });

    const result = await service.adminCreateWalletCredit("tok", {
      userId: PASSENGER_ID,
      amountClp: 7000,
      description: "Pago de mas aprobado",
      externalReference: "test-1",
    });

    expect(result.ok).toBe(true);
    expect(mockCreditUserWallet).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: PASSENGER_ID,
        amountClp: 7000,
        description: "Pago de mas aprobado",
        providerTransactionId: "admin-credit:test-1",
      }),
    );
  });

  it("returns 404 when target passenger does not exist", async () => {
    mockVerifyAccessToken.mockReturnValue({ sub: ADMIN_ID });
    mockFindUserById.mockImplementation(async (id: string) => {
      if (id === ADMIN_ID) return adminUser;
      return null;
    });

    const result = await service.adminCreateWalletCredit("tok", {
      userId: PASSENGER_ID,
      amountClp: 1000,
      description: "Credito inexistente",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("NOT_FOUND");
      expect(result.statusCode).toBe(404);
    }
    expect(mockCreditUserWallet).not.toHaveBeenCalled();
  });
});

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
