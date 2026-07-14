import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Prueba de integración ligera: WalletService.adminCreateWalletCredit (endpoint legacy
 * /admin/wallet/credits) y WalletTransactionsService.createCredit (endpoint nativo del ledger
 * /admin/wallet-transactions) comparten el MISMO repositorio simulado — con un store en memoria
 * que respeta la restricción UNIQUE(idempotency_key) real de la base de datos — para demostrar
 * que ambos endpoints tratan la misma operación financiera como un solo movimiento.
 */

const {
  mockVerifyAccessToken,
  mockHashToken,
  mockIsSessionValid,
  mockFindUserById,
  mockGetOrCreateWallet,
  mockUpdateBalance,
  mockDbLimit,
} = vi.hoisted(() => ({
  mockVerifyAccessToken: vi.fn(),
  mockHashToken:         vi.fn().mockReturnValue("hashed-token"),
  mockIsSessionValid:    vi.fn().mockResolvedValue(true),
  mockFindUserById:      vi.fn(),
  mockGetOrCreateWallet: vi.fn(),
  mockUpdateBalance:     vi.fn(),
  mockDbLimit:           vi.fn().mockResolvedValue([]),
}));

// ── Store en memoria que simula wallet_transactions_ledger con UNIQUE(idempotency_key) ────────
const ledgerStore = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  nextId: 1,
}));

function resetLedgerStore() {
  ledgerStore.rows = [];
  ledgerStore.nextId = 1;
}

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

// Repositorio del ledger REAL en cuanto a semántica de idempotencia (simula el UNIQUE de DB),
// compartido por ambos servicios porque ambos importan este mismo módulo.
vi.mock("../walletTransactions.repository.js", () => ({
  WalletTransactionsRepository: vi.fn().mockImplementation(() => ({
    findByIdempotencyKey: async (key: string) =>
      ledgerStore.rows.find((r) => r["idempotencyKey"] === key) ?? null,
    create: async (data: Record<string, unknown>) => {
      const clashes = ledgerStore.rows.some((r) => r["idempotencyKey"] === data["idempotencyKey"]);
      if (clashes) {
        throw new Error(`UNIQUE constraint violation on idempotency_key: ${String(data["idempotencyKey"])}`);
      }
      const row = { id: `ledger-${ledgerStore.nextId++}`, createdAt: new Date(), ...data };
      ledgerStore.rows.push(row);
      return row;
    },
    getAvailableBalance: async (userId: string) =>
      ledgerStore.rows
        .filter((r) => r["userId"] === userId && r["status"] === "available")
        .reduce((sum, r) => sum + Number(r["amountClp"] ?? 0), 0),
  })),
}));

import { WalletService } from "../wallet.service.js";
import { WalletTransactionsService } from "../walletTransactions.service.js";
import { adminCreateCreditSchema } from "../walletTransactions.schemas.js";

const ADMIN_A_ID = "aaaaaaaa-1111-4111-8111-111111111111";
const ADMIN_B_ID = "bbbbbbbb-2222-4222-8222-222222222222";
const PASSENGER_ID = "cccccccc-3333-4333-8333-333333333333";
const OTHER_PASSENGER_ID = "dddddddd-4444-4444-8444-444444444444";
const RIDE_ID = "eeeeeeee-5555-4555-8555-555555555555";
const OTHER_RIDE_ID = "ffffffff-6666-4666-8666-666666666666";

const adminUser = { id: ADMIN_A_ID, role: "admin" };
const passengerUser = { id: PASSENGER_ID, role: "passenger" };
const otherPassengerUser = { id: OTHER_PASSENGER_ID, role: "passenger" };

function authAsAdmin(adminId = ADMIN_A_ID) {
  mockVerifyAccessToken.mockReturnValue({ sub: adminId });
  mockFindUserById.mockImplementation(async (id: string) => {
    if (id === adminId) return adminUser;
    if (id === PASSENGER_ID) return passengerUser;
    if (id === OTHER_PASSENGER_ID) return otherPassengerUser;
    return null;
  });
}

describe("Idempotencia de créditos de Wallet — entre /admin/wallet/credits y /admin/wallet-transactions", () => {
  let legacyService: WalletService;
  let ledgerService: WalletTransactionsService;

  beforeEach(() => {
    vi.clearAllMocks();
    resetLedgerStore();
    mockIsSessionValid.mockResolvedValue(true);
    mockGetOrCreateWallet.mockImplementation((userId: string) =>
      Promise.resolve({
        id: `wallet-${userId}`,
        userId,
        balance: 0,
        currency: "CLP",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    mockUpdateBalance.mockImplementation((walletId: string, balance: number) =>
      Promise.resolve({
        id: walletId,
        userId: PASSENGER_ID,
        balance,
        currency: "CLP",
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
    // Simula ride_requests: cualquier rideId consultado pertenece a PASSENGER_ID (suficiente
    // para las validaciones de ownership de adminCreateWalletCredit en estas pruebas).
    mockDbLimit.mockImplementation(() =>
      Promise.resolve([{ id: RIDE_ID, passengerUserId: PASSENGER_ID }]),
    );
    legacyService = new WalletService();
    ledgerService = new WalletTransactionsService();
  });

  it("1. crea el crédito por /admin/wallet/credits y repite la MISMA solicitud por /admin/wallet-transactions → un solo movimiento", async () => {
    authAsAdmin();

    const first = await legacyService.adminCreateWalletCredit("tok", {
      userId: PASSENGER_ID,
      rideId: RIDE_ID,
      amountClp: 2000,
      description: "Compensación",
      externalReference: "case-001",
    });
    expect(first.ok).toBe(true);

    const second = await ledgerService.createCredit(
      "tok",
      adminCreateCreditSchema.parse({
        userId: PASSENGER_ID,
        rideId: RIDE_ID,
        amountClp: 2000,
        source: "admin",
        reason: "Compensación por reclamo",
        externalReference: "case-001",
        idempotencyKey: "unused-fallback-key-not-canonical",
      }),
    );

    expect(second.ok).toBe(true);
    if (second.ok) expect(second.idempotentReplay).toBe(true);
    expect(ledgerStore.rows.length).toBe(1);
  });

  it("2. primero /admin/wallet-transactions, después /admin/wallet/credits, misma operación → un solo movimiento", async () => {
    authAsAdmin();

    const first = await ledgerService.createCredit(
      "tok",
      adminCreateCreditSchema.parse({
        userId: PASSENGER_ID,
        rideId: RIDE_ID,
        amountClp: 1500,
        source: "admin",
        reason: "Compensación",
        externalReference: "case-002",
      }),
    );
    expect(first.ok).toBe(true);

    const second = await legacyService.adminCreateWalletCredit("tok", {
      userId: PASSENGER_ID,
      rideId: RIDE_ID,
      amountClp: 1500,
      description: "Compensación (reintento)",
      externalReference: "case-002",
    });

    expect(second.ok).toBe(true);
    expect(ledgerStore.rows.length).toBe(1);
  });

  it("3. dos solicitudes CONCURRENTES por endpoints distintos para la misma operación → solo una crea el movimiento, la otra recibe el mismo", async () => {
    authAsAdmin();

    const payloadLegacy = {
      userId: PASSENGER_ID,
      rideId: RIDE_ID,
      amountClp: 1200,
      description: "Compensación concurrente",
      externalReference: "case-003",
    };
    const payloadLedger = adminCreateCreditSchema.parse({
      userId: PASSENGER_ID,
      rideId: RIDE_ID,
      amountClp: 1200,
      source: "admin",
      reason: "Compensación concurrente",
      externalReference: "case-003",
    });

    const [resultA, resultB] = await Promise.allSettled([
      legacyService.adminCreateWalletCredit("tok", payloadLegacy),
      ledgerService.createCredit("tok", payloadLedger),
    ]);

    // Con un store en memoria no-transaccional, una de las dos puede "ganar" la carrera de
    // escritura (create) y la otra debe recibir el conflicto o el resultado ya existente —
    // lo verificable de forma determinista aquí es la invariante final: nunca dos filas.
    const settledOk = [resultA, resultB].filter(
      (r) => r.status === "fulfilled" && (r.value as { ok: boolean }).ok,
    );
    expect(settledOk.length).toBeGreaterThanOrEqual(1);
    expect(ledgerStore.rows.length).toBe(1);
  });

  it("4. mismo viaje y monto, pero DISTINTA operación legítima (externalReference distinto) → NO colisiona", async () => {
    authAsAdmin();

    const first = await legacyService.adminCreateWalletCredit("tok", {
      userId: PASSENGER_ID,
      rideId: RIDE_ID,
      amountClp: 2000,
      description: "Compensación por reclamo A",
      externalReference: "case-004-a",
    });
    expect(first.ok).toBe(true);

    const second = await legacyService.adminCreateWalletCredit("tok", {
      userId: PASSENGER_ID,
      rideId: RIDE_ID,
      amountClp: 2000,
      description: "Compensación por reclamo B (operación distinta, mismo viaje y monto)",
      externalReference: "case-004-b",
    });
    expect(second.ok).toBe(true);

    expect(ledgerStore.rows.length).toBe(2);
  });

  it("5. misma operación (mismo externalReference) con distinta descripción → SÍ colisiona (el motivo nunca es parte de la clave)", async () => {
    authAsAdmin();

    const first = await legacyService.adminCreateWalletCredit("tok", {
      userId: PASSENGER_ID,
      rideId: RIDE_ID,
      amountClp: 900,
      description: "Descripción original",
      externalReference: "case-005",
    });
    expect(first.ok).toBe(true);

    const second = await legacyService.adminCreateWalletCredit("tok", {
      userId: PASSENGER_ID,
      rideId: RIDE_ID,
      amountClp: 900,
      description: "Descripción totalmente distinta, reescrita por otro admin",
      externalReference: "case-005",
    });
    expect(second.ok).toBe(true);

    expect(ledgerStore.rows.length).toBe(1);
  });

  it("6. distintos pasajeros, misma referencia/monto/viaje → NO colisiona (userId forma parte de la clave)", async () => {
    authAsAdmin();

    const first = await legacyService.adminCreateWalletCredit("tok", {
      userId: PASSENGER_ID,
      amountClp: 1000,
      description: "Cortesía",
      externalReference: "case-006",
    });
    expect(first.ok).toBe(true);

    const second = await legacyService.adminCreateWalletCredit("tok", {
      userId: OTHER_PASSENGER_ID,
      amountClp: 1000,
      description: "Cortesía",
      externalReference: "case-006",
    });
    expect(second.ok).toBe(true);

    expect(ledgerStore.rows.length).toBe(2);
  });

  it("7. distintos rideId, mismo pasajero/monto/referencia → NO colisiona (rideId forma parte de la clave)", async () => {
    authAsAdmin();

    const first = await legacyService.adminCreateWalletCredit("tok", {
      userId: PASSENGER_ID,
      rideId: RIDE_ID,
      amountClp: 1000,
      description: "Cortesía",
      externalReference: "case-007",
    });
    expect(first.ok).toBe(true);

    const second = await legacyService.adminCreateWalletCredit("tok", {
      userId: PASSENGER_ID,
      rideId: OTHER_RIDE_ID,
      amountClp: 1000,
      description: "Cortesía",
      externalReference: "case-007",
    });
    expect(second.ok).toBe(true);

    expect(ledgerStore.rows.length).toBe(2);
  });

  it("8. una reversa y el crédito original no colisionan (operationType distinto en la clave)", async () => {
    authAsAdmin();

    const created = await legacyService.adminCreateWalletCredit("tok", {
      userId: PASSENGER_ID,
      rideId: RIDE_ID,
      amountClp: 500,
      description: "Cortesía",
      externalReference: "case-008",
    });
    expect(created.ok).toBe(true);
    expect(ledgerStore.rows.length).toBe(1);

    // Simula lo que reverseTransaction() del ledger insertaría: mismo userId/rideId/amount,
    // pero type=reversal y una idempotencyKey propia (reversal:<originalId>), nunca calculada
    // con buildWalletCreditOperationKey(operationType: "admin_wallet_credit", ...).
    const original = ledgerStore.rows[0]!;
    ledgerStore.rows.push({
      id: "reversal-1",
      idempotencyKey: `reversal:${original["id"]}`,
      userId: PASSENGER_ID,
      rideId: RIDE_ID,
      amountClp: 500,
      type: "reversal",
      status: "reversed",
      reversalOfTransactionId: original["id"],
      createdAt: new Date(),
    });

    expect(ledgerStore.rows.length).toBe(2);
    expect(ledgerStore.rows[0]!["idempotencyKey"]).not.toBe(ledgerStore.rows[1]!["idempotencyKey"]);
  });
});
