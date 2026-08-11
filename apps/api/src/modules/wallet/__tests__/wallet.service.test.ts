import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockVerifyAccessToken,
  mockHashToken,
  mockIsSessionValid,
  mockFindUserById,
  mockFindRideById,
  mockFindBenefitByRide,
  mockFindRefundByRide,
  mockFindBenefitById,
  mockCreateBenefitRequest,
  mockApproveBenefit,
  mockFindCashClosure,
  mockMarkCashResolution,
  mockCreditUserWallet,
} = vi.hoisted(() => ({
  mockVerifyAccessToken: vi.fn(),
  mockHashToken: vi.fn().mockReturnValue("hashed-token"),
  mockIsSessionValid: vi.fn().mockResolvedValue(true),
  mockFindUserById: vi.fn(),
  mockFindRideById: vi.fn(),
  mockFindBenefitByRide: vi.fn(),
  mockFindRefundByRide: vi.fn(),
  mockFindBenefitById: vi.fn(),
  mockCreateBenefitRequest: vi.fn(),
  mockApproveBenefit: vi.fn(),
  mockFindCashClosure: vi.fn(),
  mockMarkCashResolution: vi.fn(),
  mockCreditUserWallet: vi.fn(),
}));

vi.mock("../../auth/token.service.js", () => ({
  TokenService: vi.fn().mockImplementation(() => ({
    verifyAccessToken: mockVerifyAccessToken,
    hashToken: mockHashToken,
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

vi.mock("../../rides/rides.repository.js", () => ({
  RidesRepository: vi.fn().mockImplementation(() => ({
    findById: mockFindRideById,
  })),
}));

vi.mock("../wallet.repository.js", () => ({
  WalletRepository: vi.fn().mockImplementation(() => ({
    findCashOverpaymentBenefitByRideId: mockFindBenefitByRide,
    findCashOverpaymentRefundByRideId: mockFindRefundByRide,
    findCashOverpaymentBenefitById: mockFindBenefitById,
    createCashOverpaymentBenefitRequest: mockCreateBenefitRequest,
    approveCashOverpaymentBenefit: mockApproveBenefit,
    findCashPaymentClosureByRideId: mockFindCashClosure,
    creditUserWallet: mockCreditUserWallet,
  })),
}));

vi.mock("../../cashPayments/cashPayments.repository.js", () => ({
  CashPaymentsRepository: vi.fn().mockImplementation(() => ({
    markResolution: mockMarkCashResolution,
    markResolved: mockMarkCashResolution,
  })),
}));

import { WalletService } from "../wallet.service.js";

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const OWNER_ID = "22222222-2222-4222-8222-222222222222";
const RIDE_ID = "33333333-3333-4333-8333-333333333333";
const BENEFIT_ID = "44444444-4444-4444-8444-444444444444";

const adminUser = {
  id: ADMIN_ID,
  email: "admin@test.com",
  name: "Admin",
  role: "admin",
};

const passengerUser = {
  id: OWNER_ID,
  email: "passenger@test.com",
  name: "Passenger",
  role: "passenger",
};

const completedCashRide = {
  id: RIDE_ID,
  passengerUserId: OWNER_ID,
  status: "completed",
  paymentMethod: "cash",
  notes: "PaymentMethod: cash\nPago en efectivo",
  estimatedFareClp: 10_000,
};

const cashClosure = {
  id: "77777777-7777-4777-8777-777777777777",
  rideRequestId: RIDE_ID,
  passengerUserId: OWNER_ID,
  driverUserId: "88888888-8888-4888-8888-888888888888",
  fareClp: 10_000,
  paidClp: 12_000,
  overpaidClp: 2_000,
  decision: "overpaid",
  status: "overpayment_pending_choice",
  resolutionType: null,
  resolutionReferenceId: null,
  driverNote: null,
  closedAt: new Date("2026-07-19T12:00:00.000Z"),
  createdAt: new Date("2026-07-19T12:00:00.000Z"),
  updatedAt: new Date("2026-07-19T12:00:00.000Z"),
};

const benefit = {
  id: BENEFIT_ID,
  sourceRideId: RIDE_ID,
  ownerUserId: OWNER_ID,
  requestedByUserId: OWNER_ID,
  status: "pending_admin_review",
  fareClp: 10_000,
  paidClp: 12_000,
  requestedAmountClp: 2_000,
  approvedAmountClp: null,
  requestReason: null,
  adminDecisionReason: null,
  reviewedByUserId: null,
  reviewedAt: null,
  walletTransactionId: null,
  requestedAt: new Date("2026-07-19T12:00:00.000Z"),
  createdAt: new Date("2026-07-19T12:00:00.000Z"),
  updatedAt: new Date("2026-07-19T12:00:00.000Z"),
};

describe("WalletService cash overpayment benefits", () => {
  let service: WalletService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSessionValid.mockResolvedValue(true);
    mockFindRefundByRide.mockResolvedValue(null);
    mockFindCashClosure.mockResolvedValue(cashClosure);
    mockMarkCashResolution.mockResolvedValue(cashClosure);
    service = new WalletService();
  });

  it("creates a pending request only for the owner of a completed cash ride", async () => {
    mockVerifyAccessToken.mockReturnValue({ sub: OWNER_ID });
    mockFindUserById.mockResolvedValue(passengerUser);
    mockFindRideById.mockResolvedValue(completedCashRide);
    mockFindBenefitByRide.mockResolvedValue(null);
    mockCreateBenefitRequest.mockResolvedValue(benefit);

    const result = await service.requestCashOverpaymentBenefit("tok", {
      rideId: RIDE_ID,
      paidClp: 12_000,
    });

    expect(result.ok).toBe(true);
    expect(mockCreateBenefitRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceRideId: RIDE_ID,
        ownerUserId: OWNER_ID,
        fareClp: 10_000,
        paidClp: 12_000,
        requestedAmountClp: 2_000,
        status: "pending_admin_review",
      }),
    );
  });

  it("rejects a card ride because refunds never become Benefits", async () => {
    mockVerifyAccessToken.mockReturnValue({ sub: OWNER_ID });
    mockFindUserById.mockResolvedValue(passengerUser);
    mockFindRideById.mockResolvedValue({
      ...completedCashRide,
      paymentMethod: "card",
      notes: "PaymentMethod: card\nMercadoPago",
    });

    const result = await service.requestCashOverpaymentBenefit("tok", {
      rideId: RIDE_ID,
      paidClp: 12_000,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("WALLET_BENEFIT_CASH_ONLY");
      expect(result.statusCode).toBe(422);
    }
    expect(mockCreateBenefitRequest).not.toHaveBeenCalled();
  });

  it("allows a driver account to own a Benefit when it travelled as the passenger account", async () => {
    mockVerifyAccessToken.mockReturnValue({ sub: OWNER_ID });
    mockFindUserById.mockResolvedValue({
      ...passengerUser,
      role: "driver",
    });
    mockFindRideById.mockResolvedValue(completedCashRide);
    mockFindBenefitByRide.mockResolvedValue(null);
    mockCreateBenefitRequest.mockResolvedValue(benefit);

    const result = await service.requestCashOverpaymentBenefit("tok", {
      rideId: RIDE_ID,
      paidClp: 12_000,
    });

    expect(result.ok).toBe(true);
  });

  it("blocks a passenger from approving a Benefit", async () => {
    mockVerifyAccessToken.mockReturnValue({ sub: OWNER_ID });
    mockFindUserById.mockResolvedValue(passengerUser);

    const result = await service.adminApproveCashOverpaymentBenefit(
      "tok",
      BENEFIT_ID,
      {},
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("AUTH_FORBIDDEN");
      expect(result.statusCode).toBe(403);
    }
    expect(mockApproveBenefit).not.toHaveBeenCalled();
  });

  it("approves at most the requested amount and credits exactly once", async () => {
    mockVerifyAccessToken.mockReturnValue({ sub: ADMIN_ID });
    mockFindUserById.mockResolvedValue(adminUser);
    mockFindBenefitByRide.mockResolvedValue(benefit);
    mockFindBenefitById.mockResolvedValue(benefit);
    mockApproveBenefit.mockResolvedValue({
      outcome: "approved",
      benefit: {
        ...benefit,
        status: "approved",
        approvedAmountClp: 2_000,
        reviewedByUserId: ADMIN_ID,
        reviewedAt: new Date("2026-07-19T13:00:00.000Z"),
        walletTransactionId: "55555555-5555-4555-8555-555555555555",
      },
      wallet: {
        id: "66666666-6666-4666-8666-666666666666",
        userId: OWNER_ID,
        balance: 2_000,
        currency: "CLP",
        status: "active",
        createdAt: new Date("2026-07-19T13:00:00.000Z"),
        updatedAt: new Date("2026-07-19T13:00:00.000Z"),
      },
      transaction: {
        id: "55555555-5555-4555-8555-555555555555",
        walletId: "66666666-6666-4666-8666-666666666666",
        userId: OWNER_ID,
        rideId: RIDE_ID,
        type: "benefit_credit",
        amount: 2_000,
        currency: "CLP",
        status: "completed",
        provider: "admin",
        providerTransactionId: `cash-overpayment-benefit:${RIDE_ID}`,
        description: "Beneficio aprobado",
        metadata: {},
        createdAt: new Date("2026-07-19T13:00:00.000Z"),
        updatedAt: new Date("2026-07-19T13:00:00.000Z"),
      },
    });

    const result =
      await service.adminApproveCashOverpaymentBenefitByRide(
        "tok",
        RIDE_ID,
        { approvedAmountClp: 99_999 },
      );

    expect(result.ok).toBe(true);
    expect(mockApproveBenefit).toHaveBeenCalledWith(
      expect.objectContaining({
        id: BENEFIT_ID,
        reviewedByUserId: ADMIN_ID,
        approvedAmountClp: 2_000,
      }),
    );
  });
});


describe("WalletService manual admin benefits", () => {
  it("credits only the selected owner and stores a null rideId", async () => {
    const service = new WalletService();
    mockVerifyAccessToken.mockReturnValue({ sub: ADMIN_ID });
    mockIsSessionValid.mockResolvedValue(true);
    mockFindUserById.mockImplementation(async (id: string) =>
      id === ADMIN_ID ? adminUser : passengerUser,
    );
    mockCreditUserWallet.mockResolvedValue({
      wallet: { id: "wallet-1", userId: OWNER_ID, balance: 3500 },
      transaction: { id: "tx-1", userId: OWNER_ID, amount: 3500 },
    });

    const result = await service.adminCreateManualWalletBenefit("tok", {
      userId: OWNER_ID,
      amountClp: 3500,
      reason: "Compensación de atención al usuario",
      externalReference: "manual-test-0001",
    });

    expect(result.ok).toBe(true);
    expect(mockCreditUserWallet).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: OWNER_ID,
        rideId: null,
        amountClp: 3500,
        providerTransactionId: "admin-manual-benefit:manual-test-0001",
        metadata: expect.objectContaining({
          source: "admin_manual_benefit",
          exclusiveToOwner: true,
          transferable: false,
        }),
      }),
    );
  });

  it("rejects manual benefit for a role that cannot use Benefits", async () => {
    const service = new WalletService();
    mockVerifyAccessToken.mockReturnValue({ sub: ADMIN_ID });
    mockIsSessionValid.mockResolvedValue(true);
    mockFindUserById.mockImplementation(async (id: string) =>
      id === ADMIN_ID ? adminUser : { ...passengerUser, role: "admin" },
    );

    const result = await service.adminCreateManualWalletBenefit("tok", {
      userId: OWNER_ID,
      amountClp: 1000,
      reason: "No corresponde",
      externalReference: "manual-test-0002",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("WALLET_BENEFIT_ROLE_NOT_ALLOWED");
  });
});
