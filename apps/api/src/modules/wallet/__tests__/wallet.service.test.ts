import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockVerifyAccessToken,
  mockHashToken,
  mockIsSessionValid,
  mockFindUserById,
  mockCreditUserWallet,
} = vi.hoisted(() => ({
  mockVerifyAccessToken: vi.fn(),
  mockHashToken: vi.fn().mockReturnValue("hashed-token"),
  mockIsSessionValid: vi.fn().mockResolvedValue(true),
  mockFindUserById: vi.fn(),
  mockCreditUserWallet: vi.fn(),
}));

vi.mock("../../../db/client.js", () => ({
  db: {},
}));

vi.mock("../../../modules/auth/token.service.js", () => ({
  TokenService: vi.fn().mockImplementation(() => ({
    verifyAccessToken: mockVerifyAccessToken,
    hashToken: mockHashToken,
  })),
}));

vi.mock("../../../modules/auth/session.service.js", () => ({
  SessionService: vi.fn().mockImplementation(() => ({
    isSessionValid: mockIsSessionValid,
  })),
}));

vi.mock("../../../modules/users/users.repository.js", () => ({
  UsersRepository: vi.fn().mockImplementation(() => ({
    findById: mockFindUserById,
  })),
}));

vi.mock("../wallet.repository.js", () => ({
  WalletRepository: vi.fn().mockImplementation(() => ({
    creditUserWallet: mockCreditUserWallet,
  })),
}));

import { WalletService } from "../wallet.service.js";

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const PASSENGER_ID = "22222222-2222-4222-8222-222222222222";

const adminUser = {
  id: ADMIN_ID,
  email: "admin@test.com",
  name: "Admin",
  role: "admin",
};

const passengerUser = {
  id: PASSENGER_ID,
  email: "passenger@test.com",
  name: "Passenger",
  role: "passenger",
};

describe("WalletService.adminCreateWalletCredit", () => {
  let service: WalletService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WalletService();
    mockIsSessionValid.mockResolvedValue(true);
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
