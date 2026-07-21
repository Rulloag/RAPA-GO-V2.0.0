import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  verifyAccessToken,
  hashToken,
  isSessionValid,
  findUserById,
  findRideById,
  findBankAccountByUserId,
  findRefundById,
  findRefundByRideId,
  findBenefitByRideId,
  createRefund,
  listByOwner,
  listForAdmin,
  approveRefund,
  rejectRefund,
  completeRefund,
  decryptSensitiveValue,
} = vi.hoisted(() => ({
  verifyAccessToken: vi.fn(),
  hashToken: vi.fn().mockReturnValue("hash"),
  isSessionValid: vi.fn().mockResolvedValue(true),
  findUserById: vi.fn(),
  findRideById: vi.fn(),
  findBankAccountByUserId: vi.fn(),
  findRefundById: vi.fn(),
  findRefundByRideId: vi.fn(),
  findBenefitByRideId: vi.fn(),
  createRefund: vi.fn(),
  listByOwner: vi.fn(),
  listForAdmin: vi.fn(),
  approveRefund: vi.fn(),
  rejectRefund: vi.fn(),
  completeRefund: vi.fn(),
  decryptSensitiveValue: vi.fn(),
}));

vi.mock("../../auth/token.service.js", () => ({
  TokenService: vi.fn().mockImplementation(() => ({
    verifyAccessToken,
    hashToken,
  })),
}));
vi.mock("../../auth/session.service.js", () => ({
  SessionService: vi.fn().mockImplementation(() => ({ isSessionValid })),
}));
vi.mock("../../users/users.repository.js", () => ({
  UsersRepository: vi.fn().mockImplementation(() => ({ findById: findUserById })),
}));
vi.mock("../../rides/rides.repository.js", () => ({
  RidesRepository: vi.fn().mockImplementation(() => ({ findById: findRideById })),
}));
vi.mock("../../bankAccounts/bankAccounts.repository.js", () => ({
  BankAccountsRepository: vi.fn().mockImplementation(() => ({
    findByUserId: findBankAccountByUserId,
  })),
}));
vi.mock("../cashRefunds.repository.js", () => ({
  CashRefundsRepository: vi.fn().mockImplementation(() => ({
    findById: findRefundById,
    findByRideId: findRefundByRideId,
    findBenefitByRideId,
    create: createRefund,
    listByOwner,
    listForAdmin,
    approve: approveRefund,
    reject: rejectRefund,
    complete: completeRefund,
  })),
}));
vi.mock("../../../shared/security/fieldEncryption.js", () => ({
  decryptSensitiveValue,
}));

const { CashRefundsService } = await import("../cashRefunds.service.js");

const PASSENGER_ID = "11111111-1111-4111-8111-111111111111";
const ADMIN_ID = "22222222-2222-4222-8222-222222222222";
const RIDE_ID = "33333333-3333-4333-8333-333333333333";
const BANK_ID = "44444444-4444-4444-8444-444444444444";
const REFUND_ID = "55555555-5555-4555-8555-555555555555";
const now = new Date("2026-07-20T12:00:00.000Z");

const passenger = {
  id: PASSENGER_ID,
  role: "passenger",
  status: "active",
  name: "Pasajero",
  email: "passenger@test.cl",
};
const admin = {
  id: ADMIN_ID,
  role: "admin",
  status: "active",
  name: "Admin",
  email: "admin@test.cl",
};
const ride = {
  id: RIDE_ID,
  passengerUserId: PASSENGER_ID,
  status: "completed",
  paymentMethod: "cash",
  notes: "PaymentMethod: cash",
  estimatedFareClp: 10_000,
};
const bankAccount = {
  id: BANK_ID,
  userId: PASSENGER_ID,
  accountHolderName: "Pasajero Prueba",
  bankName: "Banco Estado",
  accountType: "vista",
  accountNumberLast4: "4321",
  accountNumberEncrypted: "v1.encrypted",
  status: "active",
  createdAt: now,
  updatedAt: now,
};
const refund = {
  id: REFUND_ID,
  sourceRideId: RIDE_ID,
  ownerUserId: PASSENGER_ID,
  requestedByUserId: PASSENGER_ID,
  bankAccountId: BANK_ID,
  status: "pending_admin_review",
  fareClp: 10_000,
  paidClp: 12_000,
  requestedAmountClp: 2_000,
  approvedAmountClp: null,
  requestReason: "Solicito devolución",
  adminDecisionReason: null,
  bankAccountHolderName: "Pasajero Prueba",
  bankName: "Banco Estado",
  bankAccountType: "vista",
  bankAccountNumberLast4: "4321",
  bankAccountNumberEncrypted: "v1.encrypted",
  transferReference: null,
  transferProofUrl: null,
  reviewedByUserId: null,
  reviewedAt: null,
  completedAt: null,
  requestedAt: now,
  createdAt: now,
  updatedAt: now,
};

function authenticateAs(user: typeof passenger | typeof admin) {
  verifyAccessToken.mockReturnValue({ sub: user.id });
  findUserById.mockResolvedValue(user);
}

describe("CashRefundsService", () => {
  let service: InstanceType<typeof CashRefundsService>;

  beforeEach(() => {
    vi.clearAllMocks();
    isSessionValid.mockResolvedValue(true);
    findRefundByRideId.mockResolvedValue(null);
    findBenefitByRideId.mockResolvedValue(null);
    listByOwner.mockResolvedValue([]);
    listForAdmin.mockResolvedValue([]);
    service = new CashRefundsService();
  });

  it("crea una devolución bancaria pendiente con snapshot cifrado", async () => {
    authenticateAs(passenger);
    findRideById.mockResolvedValue(ride);
    findBankAccountByUserId.mockResolvedValue(bankAccount);
    createRefund.mockResolvedValue(refund);

    const result = await service.request("token", {
      rideId: RIDE_ID,
      paidClp: 12_000,
      reason: "Solicito devolución",
    });

    expect(result.ok).toBe(true);
    expect(createRefund).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceRideId: RIDE_ID,
        ownerUserId: PASSENGER_ID,
        requestedAmountClp: 2_000,
        bankAccountNumberEncrypted: "v1.encrypted",
      }),
    );
    if (result.ok) {
      expect(result.refund.bankAccount.accountNumberLast4).toBe("4321");
      expect(result.refund).not.toHaveProperty("bankAccountNumberEncrypted");
    }
  });

  it("exige que la cuenta bancaria haya sido guardada cifrada", async () => {
    authenticateAs(passenger);
    findRideById.mockResolvedValue(ride);
    findBankAccountByUserId.mockResolvedValue({
      ...bankAccount,
      accountNumberEncrypted: null,
    });

    const result = await service.request("token", {
      rideId: RIDE_ID,
      paidClp: 12_000,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("CASH_REFUND_BANK_ACCOUNT_REQUIRED");
    expect(createRefund).not.toHaveBeenCalled();
  });

  it("impide pedir devolución si el viaje ya eligió Beneficio", async () => {
    authenticateAs(passenger);
    findRideById.mockResolvedValue(ride);
    findBenefitByRideId.mockResolvedValue({ id: "benefit" });

    const result = await service.request("token", {
      rideId: RIDE_ID,
      paidClp: 12_000,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("CASH_OVERPAYMENT_RESOLUTION_ALREADY_SELECTED");
    }
  });

  it("impide a un pasajero ver el número completo para transferencia", async () => {
    authenticateAs(passenger);
    const result = await service.getTransferDetails("token", REFUND_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("AUTH_FORBIDDEN");
    expect(decryptSensitiveValue).not.toHaveBeenCalled();
  });

  it("permite al admin descifrar los datos solo al abrir el detalle", async () => {
    authenticateAs(admin);
    findRefundById.mockResolvedValue(refund);
    decryptSensitiveValue.mockReturnValue("1234567894321");

    const result = await service.getTransferDetails("token", REFUND_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.transfer.accountNumber).toBe("1234567894321");
      expect(result.transfer.amountClp).toBe(2_000);
    }
  });

  it("limita la aprobación al monto solicitado", async () => {
    authenticateAs(admin);
    findRefundById.mockResolvedValue(refund);
    approveRefund.mockResolvedValue({
      ...refund,
      status: "approved_for_transfer",
      approvedAmountClp: 2_000,
      reviewedByUserId: ADMIN_ID,
      reviewedAt: now,
    });

    const result = await service.approve("token", REFUND_ID, {
      approvedAmountClp: 99_999,
    });

    expect(result.ok).toBe(true);
    expect(approveRefund).toHaveBeenCalledWith(
      expect.objectContaining({ approvedAmountClp: 2_000 }),
    );
  });

  it("solo completa una devolución previamente aprobada", async () => {
    authenticateAs(admin);
    completeRefund.mockResolvedValue(null);
    findRefundById.mockResolvedValue(refund);

    const result = await service.complete("token", REFUND_ID, {
      transferReference: "TRX-2026-001",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("CASH_REFUND_NOT_APPROVED");
  });
});
