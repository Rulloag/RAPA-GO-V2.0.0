import { describe, it, expect, vi, beforeEach } from "vitest";

// ── vi.hoisted: all mock fns must exist before vi.mock factories run ───────────
const {
  mockVerifyAccessToken,
  mockHashToken,
  mockIsSessionValid,
  mockFindUserById,
  mockGetOrCreateWallet,
  mockFindByIdempotencyKey,
  mockFindById,
  mockListByUser,
  mockGetAvailableBalance,
  mockGetWalletBalanceSummary,
  mockCreate,
  mockApprovePending,
  mockRejectPending,
  mockApplyAvailableCredit,
  mockMarkDebitPaid,
  mockCancelDebit,
  mockReverseTransaction,
  mockUpdateBalance,
} = vi.hoisted(() => ({
  mockVerifyAccessToken:        vi.fn(),
  mockHashToken:                vi.fn().mockReturnValue("hashed-token"),
  mockIsSessionValid:           vi.fn().mockResolvedValue(true),
  mockFindUserById:             vi.fn(),
  mockGetOrCreateWallet:        vi.fn(),
  mockFindByIdempotencyKey:     vi.fn(),
  mockFindById:                 vi.fn(),
  mockListByUser:               vi.fn(),
  mockGetAvailableBalance:      vi.fn(),
  mockGetWalletBalanceSummary:  vi.fn().mockResolvedValue({
    availableCreditClp: 0, pendingCreditClp: 0, pendingDebitClp: 0,
    paidAmountClp: 0, refundedAmountClp: 0, reversedAmountClp: 0,
  }),
  mockCreate:                   vi.fn(),
  mockApprovePending:           vi.fn(),
  mockRejectPending:            vi.fn(),
  mockApplyAvailableCredit:     vi.fn(),
  mockMarkDebitPaid:            vi.fn(),
  mockCancelDebit:              vi.fn(),
  mockReverseTransaction:       vi.fn(),
  mockUpdateBalance:            vi.fn(),
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
    getOrCreate:   mockGetOrCreateWallet,
    updateBalance: mockUpdateBalance,
  })),
}));
vi.mock("../walletTransactions.repository.js", () => ({
  WalletTransactionsRepository: vi.fn().mockImplementation(() => ({
    findByIdempotencyKey:   mockFindByIdempotencyKey,
    findById:                mockFindById,
    listByUser:              mockListByUser,
    getAvailableBalance:     mockGetAvailableBalance,
    getWalletBalanceSummary: mockGetWalletBalanceSummary,
    create:                  mockCreate,
    approvePending:          mockApprovePending,
    rejectPending:           mockRejectPending,
    applyAvailableCredit:    mockApplyAvailableCredit,
    markDebitPaid:           mockMarkDebitPaid,
    cancelDebit:             mockCancelDebit,
    reverseTransaction:      mockReverseTransaction,
  })),
}));

import { WalletTransactionsService } from "../walletTransactions.service.js";
import { adminCreateCreditSchema, applyCreditSchema } from "../walletTransactions.schemas.js";

// ── Fixtures ───────────────────────────────────────────────────────────────────

const ADMIN_A_ID     = "dda995a1-d19e-4c58-835f-fbc9996defea";
const ADMIN_B_ID     = "c86e1d22-00e1-444b-a25e-6f25a9d0f976";
const PASSENGER_ID   = "e494f55c-2ac7-4756-9663-980b4619387a";
const OTHER_USER_ID  = "2ceb99f3-f28a-4d20-87e8-953e78422eff";
const WALLET_ID      = "f5c615e7-fe88-4fdc-a629-dde416bbc4bf";
const TX_ID          = "505106b3-97a4-4936-966b-71bd4da33748";
const RIDE_ID        = "9c2c6e3a-2f3b-4a5a-9a0e-8f1a7d2b6c11";
const DEBIT_ID       = "1a2b3c4d-5e6f-4789-a0b1-c2d3e4f5a6b7";

function fakeTxRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: TX_ID,
    walletId: WALLET_ID,
    userId: PASSENGER_ID,
    rideId: null,
    paymentId: null,
    appliedToRideId: null,
    type: "credit",
    source: "cancellation",
    amountClp: 3000,
    currency: "CLP",
    status: "pending",
    approvalStatus: "pending_review",
    idempotencyKey: "idem-create-001",
    createdBy: ADMIN_A_ID,
    approvedBy: null,
    createdAt: new Date(),
    approvedAt: null,
    appliedAt: null,
    expiresAt: null,
    reversedAt: null,
    metadata: null,
    ...overrides,
  };
}

function authAs(userId: string, role: string) {
  mockVerifyAccessToken.mockReturnValue({ sub: userId });
  mockFindUserById.mockResolvedValue({ id: userId, role });
}

describe("WalletTransactionsService — createCredit (admin)", () => {
  let service: WalletTransactionsService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSessionValid.mockResolvedValue(true);
    service = new WalletTransactionsService();
  });

  it("rechaza con 403 si quien crea el crédito no es admin", async () => {
    authAs(PASSENGER_ID, "passenger");
    const input = adminCreateCreditSchema.parse({
      userId: PASSENGER_ID,
      amountClp: 3000,
      source: "cancellation",
      reason: "Cancelación con tarjeta dentro de política",
      idempotencyKey: "idem-create-001",
    });

    const result = await service.createCredit("tok", input);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("AUTH_FORBIDDEN");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("un admin puede crear un crédito por encima del umbral, queda en estado pending (requiere segunda aprobación)", async () => {
    authAs(ADMIN_A_ID, "admin");
    mockFindByIdempotencyKey.mockResolvedValue(null);
    mockGetOrCreateWallet.mockResolvedValue({ id: WALLET_ID, userId: PASSENGER_ID });
    mockCreate.mockResolvedValue(fakeTxRow({ amountClp: 5000, status: "pending", approvalStatus: "pending_review" }));

    const input = adminCreateCreditSchema.parse({
      userId: PASSENGER_ID,
      amountClp: 5000,
      source: "cancellation",
      reason: "Cancelación con tarjeta dentro de política",
      idempotencyKey: "idem-create-001",
    });

    const result = await service.createCredit("tok", input);

    expect(result.ok).toBe(true);
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ status: "pending", approvalStatus: "pending_review", createdBy: ADMIN_A_ID }));
    expect(mockGetAvailableBalance).not.toHaveBeenCalled();
  });

  it("un admin puede crear un crédito por debajo/igual al umbral, se auto-aprueba (un solo administrador)", async () => {
    authAs(ADMIN_A_ID, "admin");
    mockFindByIdempotencyKey.mockResolvedValue(null);
    mockGetOrCreateWallet.mockResolvedValue({ id: WALLET_ID, userId: PASSENGER_ID });
    mockCreate.mockResolvedValue(fakeTxRow({ amountClp: 3000, status: "available", approvalStatus: "admin_approved" }));
    mockGetAvailableBalance.mockResolvedValue(3000);

    const input = adminCreateCreditSchema.parse({
      userId: PASSENGER_ID,
      amountClp: 3000,
      source: "cancellation",
      reason: "Cancelación con tarjeta dentro de política",
      idempotencyKey: "idem-create-002",
    });

    const result = await service.createCredit("tok", input);

    expect(result.ok).toBe(true);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ status: "available", approvalStatus: "admin_approved", approvedBy: ADMIN_A_ID }),
    );
    expect(mockGetAvailableBalance).toHaveBeenCalledWith(PASSENGER_ID);
  });

  it("es idempotente: una segunda solicitud con la misma idempotencyKey no crea un segundo crédito", async () => {
    authAs(ADMIN_A_ID, "admin");
    mockFindByIdempotencyKey.mockResolvedValue(fakeTxRow());

    const input = adminCreateCreditSchema.parse({
      userId: PASSENGER_ID,
      amountClp: 3000,
      source: "cancellation",
      reason: "Cancelación con tarjeta dentro de política",
      idempotencyKey: "idem-create-001",
    });

    const result = await service.createCredit("tok", input);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.idempotentReplay).toBe(true);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe("WalletTransactionsService — approveCredit / rejectCredit", () => {
  let service: WalletTransactionsService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSessionValid.mockResolvedValue(true);
    service = new WalletTransactionsService();
  });

  it("rechaza con 403 si quien aprueba no es admin", async () => {
    authAs(PASSENGER_ID, "passenger");
    mockFindById.mockResolvedValue(fakeTxRow({ createdBy: ADMIN_A_ID }));

    const result = await service.approveCredit("tok", TX_ID, {});

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("AUTH_FORBIDDEN");
    expect(mockApprovePending).not.toHaveBeenCalled();
  });

  it("IMPOSIBILIDAD DE AUTOAPROBAR: el admin que creó el crédito no puede aprobarlo", async () => {
    authAs(ADMIN_A_ID, "admin");
    mockFindById.mockResolvedValue(fakeTxRow({ createdBy: ADMIN_A_ID }));

    const result = await service.approveCredit("tok", TX_ID, {});

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("AUTH_SELF_APPROVAL_FORBIDDEN");
    expect(mockApprovePending).not.toHaveBeenCalled();
  });

  it("un admin distinto al creador puede aprobar un crédito pendiente", async () => {
    authAs(ADMIN_B_ID, "admin");
    mockFindById.mockResolvedValue(fakeTxRow({ createdBy: ADMIN_A_ID, status: "pending" }));
    mockApprovePending.mockResolvedValue(fakeTxRow({ createdBy: ADMIN_A_ID, status: "available", approvedBy: ADMIN_B_ID }));

    const result = await service.approveCredit("tok", TX_ID, {});

    expect(result.ok).toBe(true);
    expect(mockApprovePending).toHaveBeenCalledWith(TX_ID, ADMIN_B_ID);
  });

  it("rechaza aprobar un crédito que ya no está pending (transición inválida)", async () => {
    authAs(ADMIN_B_ID, "admin");
    mockFindById.mockResolvedValue(fakeTxRow({ createdBy: ADMIN_A_ID, status: "applied" }));

    const result = await service.approveCredit("tok", TX_ID, {});

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("WALLET_TX_INVALID_TRANSITION");
    expect(mockApprovePending).not.toHaveBeenCalled();
  });

  it("un crédito rechazado no puede reaparecer como disponible (no se puede volver a aprobar)", async () => {
    authAs(ADMIN_B_ID, "admin");
    mockFindById.mockResolvedValue(fakeTxRow({ createdBy: ADMIN_A_ID, status: "rejected" }));

    const result = await service.approveCredit("tok", TX_ID, {});

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("WALLET_TX_INVALID_TRANSITION");
  });
});

describe("WalletTransactionsService — applyCredit (pasajero)", () => {
  let service: WalletTransactionsService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSessionValid.mockResolvedValue(true);
    service = new WalletTransactionsService();
  });

  it("aplica un crédito disponible propio a un viaje", async () => {
    authAs(PASSENGER_ID, "passenger");
    mockFindByIdempotencyKey.mockResolvedValue(null);
    mockFindById.mockResolvedValue(fakeTxRow({ status: "available", userId: PASSENGER_ID }));
    mockApplyAvailableCredit.mockResolvedValue({
      credit: fakeTxRow({ status: "applied" }),
      consumptionRecord: fakeTxRow({ id: DEBIT_ID, type: "credit", status: "applied" }),
    });

    const input = applyCreditSchema.parse({ walletTransactionId: TX_ID, rideId: RIDE_ID, idempotencyKey: "apply-idem-001" });
    const result = await service.applyCredit("tok", input);

    expect(result.ok).toBe(true);
    expect(mockApplyAvailableCredit).toHaveBeenCalledWith(
      expect.objectContaining({ walletTransactionId: TX_ID, userId: PASSENGER_ID, rideId: RIDE_ID }),
    );
  });

  it("rechaza con 403 si el crédito pertenece a otro usuario", async () => {
    authAs(PASSENGER_ID, "passenger");
    mockFindByIdempotencyKey.mockResolvedValue(null);
    mockFindById.mockResolvedValue(fakeTxRow({ status: "available", userId: OTHER_USER_ID }));

    const input = applyCreditSchema.parse({ walletTransactionId: TX_ID, rideId: RIDE_ID, idempotencyKey: "apply-idem-001" });
    const result = await service.applyCredit("tok", input);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("AUTH_FORBIDDEN");
    expect(mockApplyAvailableCredit).not.toHaveBeenCalled();
  });

  it("rechaza un crédito vencido", async () => {
    authAs(PASSENGER_ID, "passenger");
    mockFindByIdempotencyKey.mockResolvedValue(null);
    mockFindById.mockResolvedValue(
      fakeTxRow({ status: "available", userId: PASSENGER_ID, expiresAt: new Date(Date.now() - 60_000) }),
    );

    const input = applyCreditSchema.parse({ walletTransactionId: TX_ID, rideId: RIDE_ID, idempotencyKey: "apply-idem-001" });
    const result = await service.applyCredit("tok", input);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("WALLET_TX_EXPIRED");
    expect(mockApplyAvailableCredit).not.toHaveBeenCalled();
  });

  it("DOBLE APLICACIÓN: si el crédito ya no está disponible (aplicado por otra solicitud concurrente), rechaza con 409", async () => {
    authAs(PASSENGER_ID, "passenger");
    mockFindByIdempotencyKey.mockResolvedValue(null);
    mockFindById.mockResolvedValue(fakeTxRow({ status: "available", userId: PASSENGER_ID }));
    // El repositorio simula que, para cuando llegó el UPDATE condicional, otra solicitud
    // ya cambió el estado a 'applied' — la fila ya no matchea WHERE status='available'.
    mockApplyAvailableCredit.mockResolvedValue(null);

    const input = applyCreditSchema.parse({ walletTransactionId: TX_ID, rideId: RIDE_ID, idempotencyKey: "apply-idem-001" });
    const result = await service.applyCredit("tok", input);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("WALLET_TX_NOT_AVAILABLE");
  });

  it("es idempotente: reenviar la misma idempotencyKey no vuelve a debitar", async () => {
    authAs(PASSENGER_ID, "passenger");
    mockFindByIdempotencyKey.mockResolvedValue(fakeTxRow({ id: DEBIT_ID, type: "debit", status: "applied" }));

    const input = applyCreditSchema.parse({ walletTransactionId: TX_ID, rideId: RIDE_ID, idempotencyKey: "apply-idem-001" });
    const result = await service.applyCredit("tok", input);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.idempotentReplay).toBe(true);
    expect(mockApplyAvailableCredit).not.toHaveBeenCalled();
  });
});

describe("WalletTransactionsService — localStorage forjado no afecta al backend", () => {
  it("adminCreateCreditSchema no acepta ni status ni adminReviewStatus enviados por el cliente", () => {
    const forgedPayload = {
      userId: PASSENGER_ID,
      amountClp: 999999999,
      source: "cancellation",
      reason: "Cancelación con tarjeta",
      idempotencyKey: "idem-forged",
      // Campos que el localStorage forjado usa en el cliente — no existen en el DTO real.
      status: "available",
      adminReviewStatus: "admin_approved",
    };

    const parsed = adminCreateCreditSchema.parse(forgedPayload);

    expect(parsed).not.toHaveProperty("status");
    expect(parsed).not.toHaveProperty("adminReviewStatus");
  });

  it("applyCreditSchema no acepta un amountClp ni status enviados por el cliente", () => {
    const forgedPayload = {
      walletTransactionId: TX_ID,
      rideId: RIDE_ID,
      idempotencyKey: "apply-forged",
      amountClp: 999999999,
      status: "available",
    };

    const parsed = applyCreditSchema.parse(forgedPayload);

    expect(parsed).not.toHaveProperty("amountClp");
    expect(parsed).not.toHaveProperty("status");
  });
});

describe("WalletTransactionsService — débitos (mark-paid / cancel)", () => {
  let service: WalletTransactionsService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSessionValid.mockResolvedValue(true);
    service = new WalletTransactionsService();
  });

  it("rechaza marcar como pagado si no es admin", async () => {
    authAs(PASSENGER_ID, "passenger");

    const result = await service.markDebitPaid("tok", TX_ID, { collectionMethod: "admin_review" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("AUTH_FORBIDDEN");
    expect(mockMarkDebitPaid).not.toHaveBeenCalled();
  });

  it("rechaza marcar como pagado un movimiento que no es type=debit", async () => {
    authAs(ADMIN_A_ID, "admin");
    mockFindById.mockResolvedValue(fakeTxRow({ type: "credit", status: "pending" }));

    const result = await service.markDebitPaid("tok", TX_ID, { collectionMethod: "admin_review" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("WALLET_TX_WRONG_TYPE");
    expect(mockMarkDebitPaid).not.toHaveBeenCalled();
  });

  it("un admin puede marcar un débito pending como paid", async () => {
    authAs(ADMIN_B_ID, "admin");
    mockFindById.mockResolvedValue(fakeTxRow({ type: "debit", status: "pending" }));
    mockMarkDebitPaid.mockResolvedValue(fakeTxRow({ type: "debit", status: "paid" }));

    const result = await service.markDebitPaid("tok", TX_ID, { collectionMethod: "admin_review" });

    expect(result.ok).toBe(true);
    expect(mockMarkDebitPaid).toHaveBeenCalledWith(TX_ID, ADMIN_B_ID, "admin_review");
  });

  it("DOBLE CARGO BLOQUEADO: no se puede marcar como pagado un débito que ya no está pending", async () => {
    authAs(ADMIN_B_ID, "admin");
    mockFindById.mockResolvedValue(fakeTxRow({ type: "debit", status: "paid" }));

    const result = await service.markDebitPaid("tok", TX_ID, { collectionMethod: "admin_review" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("WALLET_TX_INVALID_TRANSITION");
    expect(mockMarkDebitPaid).not.toHaveBeenCalled();
  });

  it("un admin puede condonar (cancelar) un débito pendiente con motivo", async () => {
    authAs(ADMIN_A_ID, "admin");
    mockFindById.mockResolvedValue(fakeTxRow({ type: "debit", status: "pending" }));
    mockCancelDebit.mockResolvedValue(fakeTxRow({ type: "debit", status: "cancelled" }));

    const result = await service.cancelDebit("tok", TX_ID, { reason: "Disputa ganada por el pasajero" });

    expect(result.ok).toBe(true);
    expect(mockCancelDebit).toHaveBeenCalledWith(TX_ID, ADMIN_A_ID, "Disputa ganada por el pasajero");
  });

  it("no reutiliza 'available' para un débito: el estado 'available' no existe en las transiciones de debit", async () => {
    authAs(ADMIN_A_ID, "admin");
    // fakeTxRow con status='available' y type='debit' es un estado que el sistema nunca
    // produce (markDebitPaid/create de no-show jamás asignan 'available' a un debit) — se
    // documenta como test negativo: mark-paid solo transiciona desde 'pending'.
    mockFindById.mockResolvedValue(fakeTxRow({ type: "debit", status: "available" }));

    const result = await service.markDebitPaid("tok", TX_ID, { collectionMethod: "admin_review" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("WALLET_TX_INVALID_TRANSITION");
  });
});

describe("WalletTransactionsService — reverseTransaction", () => {
  let service: WalletTransactionsService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSessionValid.mockResolvedValue(true);
    service = new WalletTransactionsService();
  });

  it("rechaza si no es admin", async () => {
    authAs(PASSENGER_ID, "passenger");

    const result = await service.reverseTransaction("tok", TX_ID, { reason: "Error de cálculo" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("AUTH_FORBIDDEN");
  });

  it("IMPOSIBILIDAD DE AUTOAPROBAR: el admin que creó el movimiento no puede revertirlo", async () => {
    authAs(ADMIN_A_ID, "admin");
    mockFindById.mockResolvedValue(fakeTxRow({ createdBy: ADMIN_A_ID, approvedBy: null, status: "paid" }));

    const result = await service.reverseTransaction("tok", TX_ID, { reason: "Error de cálculo" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("AUTH_SELF_APPROVAL_FORBIDDEN");
    expect(mockReverseTransaction).not.toHaveBeenCalled();
  });

  it("IMPOSIBILIDAD DE AUTOAPROBAR: el admin que aprobó/resolvió el movimiento tampoco puede revertirlo", async () => {
    authAs(ADMIN_B_ID, "admin");
    mockFindById.mockResolvedValue(fakeTxRow({ createdBy: ADMIN_A_ID, approvedBy: ADMIN_B_ID, status: "paid" }));

    const result = await service.reverseTransaction("tok", TX_ID, { reason: "Error de cálculo" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("AUTH_SELF_APPROVAL_FORBIDDEN");
  });

  it("un admin distinto puede revertir, se crea un nuevo movimiento sin editar el original", async () => {
    const adminC = "f3a3a3a3-3333-4333-8333-333333333333";
    authAs(adminC, "admin");
    mockFindById.mockResolvedValue(fakeTxRow({ createdBy: ADMIN_A_ID, approvedBy: ADMIN_B_ID, status: "paid" }));
    mockReverseTransaction.mockResolvedValue({
      original: fakeTxRow({ status: "reversed" }),
      reversal: fakeTxRow({ id: "reversal-uuid", type: "reversal", status: "reversed" }),
    });

    const result = await service.reverseTransaction("tok", TX_ID, { reason: "Error de cálculo" });

    expect(result.ok).toBe(true);
    expect(mockReverseTransaction).toHaveBeenCalledWith({
      originalTransactionId: TX_ID,
      resolvedBy: adminC,
      reason: "Error de cálculo",
    });
  });

  it("rechaza revertir un movimiento ya revertido", async () => {
    const adminC = "f3a3a3a3-3333-4333-8333-333333333333";
    authAs(adminC, "admin");
    mockFindById.mockResolvedValue(fakeTxRow({ createdBy: ADMIN_A_ID, approvedBy: ADMIN_B_ID, status: "reversed" }));

    const result = await service.reverseTransaction("tok", TX_ID, { reason: "Error de cálculo" });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("WALLET_TX_INVALID_TRANSITION");
    expect(mockReverseTransaction).not.toHaveBeenCalled();
  });
});

describe("WalletTransactionsService — separación de saldo (créditos vs débitos)", () => {
  let service: WalletTransactionsService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSessionValid.mockResolvedValue(true);
    service = new WalletTransactionsService();
  });

  it("listMyCredits expone los 6 totales separados sin cruzarse entre sí", async () => {
    authAs(PASSENGER_ID, "passenger");
    mockListByUser.mockResolvedValue([]);
    mockGetWalletBalanceSummary.mockResolvedValue({
      availableCreditClp: 3000,
      pendingCreditClp: 1000,
      pendingDebitClp: 5000,
      paidAmountClp: 12000,
      refundedAmountClp: 4000,
      reversedAmountClp: 500,
    });

    const result = await service.listMyCredits("tok");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.availableCreditClp).toBe(3000);
      expect(result.pendingCreditClp).toBe(1000);
      expect(result.pendingDebitClp).toBe(5000);
      expect(result.paidAmountClp).toBe(12000);
      expect(result.refundedAmountClp).toBe(4000);
      expect(result.reversedAmountClp).toBe(500);
    }
  });
});
