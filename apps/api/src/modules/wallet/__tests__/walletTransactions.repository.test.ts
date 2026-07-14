import { describe, it, expect, vi, beforeEach } from "vitest";

// ── vi.hoisted: chainable tx mock builders must exist before vi.mock runs ──────
const { mockTxUpdateReturning, mockTxInsertReturning, mockDbTransaction } = vi.hoisted(() => ({
  mockTxUpdateReturning: vi.fn(),
  mockTxInsertReturning: vi.fn(),
  mockDbTransaction:     vi.fn(),
}));

vi.mock("../../../db/client.js", () => ({
  db: {
    transaction: mockDbTransaction,
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

import { WalletTransactionsRepository } from "../walletTransactions.repository.js";

const TX_ID     = "505106b3-97a4-4936-966b-71bd4da33748";
const USER_ID   = "e494f55c-2ac7-4756-9663-980b4619387a";
const RIDE_ID   = "9c2c6e3a-2f3b-4a5a-9a0e-8f1a7d2b6c11";
const WALLET_ID = "f5c615e7-fe88-4fdc-a629-dde416bbc4bf";

function fakeAvailableCredit() {
  return {
    id: TX_ID,
    walletId: WALLET_ID,
    userId: USER_ID,
    rideId: null,
    source: "cancellation",
    amountClp: 3000,
    currency: "CLP",
    status: "applied",
    appliedAt: new Date(),
    appliedToRideId: RIDE_ID,
  };
}

function buildTxMock(opts: { updateReturns: unknown[]; insertReturns: unknown[]; insertThrows?: boolean }) {
  return {
    update: () => ({
      set: () => ({
        where: () => ({
          returning: () => Promise.resolve(opts.updateReturns),
        }),
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: () => {
          if (opts.insertThrows) return Promise.reject(new Error("insert failed"));
          return Promise.resolve(opts.insertReturns);
        },
      }),
    }),
  };
}

describe("WalletTransactionsRepository.applyAvailableCredit — atomicidad", () => {
  let repo: WalletTransactionsRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new WalletTransactionsRepository();
  });

  it("aplica el crédito e inserta el movimiento de débito dentro de la misma transacción", async () => {
    const credit = fakeAvailableCredit();
    const consumptionRecord = { ...credit, id: "1a2b3c4d-5e6f-4789-a0b1-c2d3e4f5a6b7", type: "credit" };

    mockDbTransaction.mockImplementation((cb: (tx: unknown) => Promise<unknown>) =>
      cb(buildTxMock({ updateReturns: [credit], insertReturns: [consumptionRecord] })),
    );

    const result = await repo.applyAvailableCredit({
      walletTransactionId: TX_ID,
      userId: USER_ID,
      rideId: RIDE_ID,
      debitIdempotencyKey: "apply-idem-002",
    });

    expect(result).not.toBeNull();
    expect(result?.credit.id).toBe(TX_ID);
    expect(result?.consumptionRecord.type).toBe("credit");
  });

  it("DOBLE APLICACIÓN: si el UPDATE no afecta ninguna fila (ya no está 'available'), retorna null sin insertar débito", async () => {
    mockDbTransaction.mockImplementation((cb: (tx: unknown) => Promise<unknown>) =>
      cb(buildTxMock({ updateReturns: [], insertReturns: [] })),
    );

    const result = await repo.applyAvailableCredit({
      walletTransactionId: TX_ID,
      userId: USER_ID,
      rideId: RIDE_ID,
      debitIdempotencyKey: "apply-idem-003",
    });

    expect(result).toBeNull();
  });

  it("ROLLBACK: si la inserción del débito falla, la promesa de la transacción se rechaza (Postgres revierte el UPDATE previo)", async () => {
    const credit = fakeAvailableCredit();

    mockDbTransaction.mockImplementation((cb: (tx: unknown) => Promise<unknown>) =>
      cb(buildTxMock({ updateReturns: [credit], insertReturns: [], insertThrows: true })),
    );

    await expect(
      repo.applyAvailableCredit({
        walletTransactionId: TX_ID,
        userId: USER_ID,
        rideId: RIDE_ID,
        debitIdempotencyKey: "apply-idem-004",
      }),
    ).rejects.toThrow();
  });
});

function buildReversalTxMock(opts: { selectReturns: unknown[]; updateReturns: unknown[]; insertReturns: unknown[] }) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(opts.selectReturns),
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => ({
          returning: () => Promise.resolve(opts.updateReturns),
        }),
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: () => Promise.resolve(opts.insertReturns),
      }),
    }),
  };
}

describe("WalletTransactionsRepository.reverseTransaction — nunca edita el original", () => {
  let repo: WalletTransactionsRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new WalletTransactionsRepository();
  });

  it("marca el original como reversed y crea una fila type=reversal nueva", async () => {
    const original = { id: TX_ID, walletId: WALLET_ID, userId: USER_ID, rideId: null, appliedToRideId: null, source: "no_show", amountClp: 5000, currency: "CLP", status: "paid" };
    const updatedOriginal = { ...original, status: "reversed" };
    const reversal = { id: "reversal-uuid", type: "reversal", status: "reversed", reversalOfTransactionId: TX_ID };

    mockDbTransaction.mockImplementation((cb: (tx: unknown) => Promise<unknown>) =>
      cb(buildReversalTxMock({ selectReturns: [original], updateReturns: [updatedOriginal], insertReturns: [reversal] })),
    );

    const result = await repo.reverseTransaction({ originalTransactionId: TX_ID, resolvedBy: USER_ID, reason: "Disputa ganada" });

    expect(result).not.toBeNull();
    expect(result?.original.status).toBe("reversed");
    expect(result?.reversal.type).toBe("reversal");
    expect(result?.reversal.reversalOfTransactionId).toBe(TX_ID);
  });

  it("retorna null si el movimiento original no existe", async () => {
    mockDbTransaction.mockImplementation((cb: (tx: unknown) => Promise<unknown>) =>
      cb(buildReversalTxMock({ selectReturns: [], updateReturns: [], insertReturns: [] })),
    );

    const result = await repo.reverseTransaction({ originalTransactionId: TX_ID, resolvedBy: USER_ID, reason: "x" });

    expect(result).toBeNull();
  });

  it("retorna null si el movimiento ya estaba reversed (no se revierte dos veces)", async () => {
    const alreadyReversed = { id: TX_ID, status: "reversed" };

    mockDbTransaction.mockImplementation((cb: (tx: unknown) => Promise<unknown>) =>
      cb(buildReversalTxMock({ selectReturns: [alreadyReversed], updateReturns: [], insertReturns: [] })),
    );

    const result = await repo.reverseTransaction({ originalTransactionId: TX_ID, resolvedBy: USER_ID, reason: "x" });

    expect(result).toBeNull();
  });
});
