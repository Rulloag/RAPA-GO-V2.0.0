import { describe, it, expect, vi, beforeEach } from "vitest";

// ── vi.hoisted: all mock fns must exist before vi.mock factories run ───────────
const {
  mockVerifyAccessToken,
  mockHashToken,
  mockIsSessionValid,
  mockFindUserById,
  mockFindByIdForUpdate,
  mockCancelNoShow,
  mockGetOrCreateWallet,
  mockFindByIdempotencyKey,
  mockCreateLedgerRow,
  mockNotifyAsync,
  mockDbTransaction,
} = vi.hoisted(() => ({
  mockVerifyAccessToken:    vi.fn(),
  mockHashToken:            vi.fn().mockReturnValue("hashed-token"),
  mockIsSessionValid:       vi.fn().mockResolvedValue(true),
  mockFindUserById:         vi.fn(),
  mockFindByIdForUpdate:    vi.fn(),
  mockCancelNoShow:         vi.fn(),
  mockGetOrCreateWallet:    vi.fn(),
  mockFindByIdempotencyKey: vi.fn(),
  mockCreateLedgerRow:      vi.fn(),
  mockNotifyAsync:          vi.fn(),
  mockDbTransaction:        vi.fn(),
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
vi.mock("../rides.repository.js", () => ({
  RidesRepository: vi.fn().mockImplementation(() => ({
    findByIdForUpdate: mockFindByIdForUpdate,
    cancelNoShow: mockCancelNoShow,
  })),
}));
vi.mock("../../wallet/wallet.repository.js", () => ({
  WalletRepository: vi.fn().mockImplementation(() => ({
    getOrCreate: mockGetOrCreateWallet,
  })),
}));
vi.mock("../../wallet/walletTransactions.repository.js", () => ({
  WalletTransactionsRepository: vi.fn().mockImplementation(() => ({
    findByIdempotencyKey: mockFindByIdempotencyKey,
    create:                mockCreateLedgerRow,
  })),
}));
vi.mock("../../notifications/notifications.helpers.js", () => ({
  notifyAsync: mockNotifyAsync,
}));
// db.transaction simplemente ejecuta el callback con un "tx" ficticio — como los repos ya
// están mockeados arriba (ignoran el executor real), basta con invocar el callback.
vi.mock("../../../db/client.js", () => ({
  db: { transaction: mockDbTransaction },
}));

import { NoShowService } from "../noShow.service.js";
import { confirmNoShowSchema } from "../noShow.schemas.js";

const DRIVER_ID     = "b1a1a1a1-1111-4111-8111-111111111111";
const OTHER_DRIVER_ID = "b2a2a2a2-2222-4222-8222-222222222222";
const PASSENGER_ID  = "c1a1a1a1-1111-4111-8111-111111111111";
const RIDE_ID       = "d1a1a1a1-1111-4111-8111-111111111111";
const WALLET_ID     = "e1a1a1a1-1111-4111-8111-111111111111";

function authAsDriver(driverId = DRIVER_ID) {
  mockVerifyAccessToken.mockReturnValue({ sub: driverId });
  mockFindUserById.mockResolvedValue({ id: driverId, role: "driver" });
}

function fakeArrivedRide(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: RIDE_ID,
    driverUserId: DRIVER_ID,
    passengerUserId: PASSENGER_ID,
    status: "driver_arrived",
    arrivedAt: new Date(Date.now() - 6 * 60_000), // llegó hace 6 minutos
    estimatedFareClp: 5000,
    ...overrides,
  };
}

describe("NoShowService.confirmNoShow", () => {
  let service: NoShowService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSessionValid.mockResolvedValue(true);
    mockDbTransaction.mockImplementation((cb: (tx: unknown) => Promise<unknown>) => cb({}));
    service = new NoShowService();
  });

  it("rechaza si el rol no es driver", async () => {
    mockVerifyAccessToken.mockReturnValue({ sub: PASSENGER_ID });
    mockFindUserById.mockResolvedValue({ id: PASSENGER_ID, role: "passenger" });

    const result = await service.confirmNoShow("tok", RIDE_ID, confirmNoShowSchema.parse({}));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("AUTH_FORBIDDEN");
    expect(mockCreateLedgerRow).not.toHaveBeenCalled();
  });

  it("rechaza si el conductor no está asignado a este viaje", async () => {
    authAsDriver(OTHER_DRIVER_ID);
    mockFindByIdForUpdate.mockResolvedValue(fakeArrivedRide());

    const result = await service.confirmNoShow("tok", RIDE_ID, confirmNoShowSchema.parse({}));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("AUTH_FORBIDDEN");
    expect(mockCreateLedgerRow).not.toHaveBeenCalled();
  });

  it("rechaza si el viaje no está en driver_arrived", async () => {
    authAsDriver();
    mockFindByIdForUpdate.mockResolvedValue(fakeArrivedRide({ status: "in_progress" }));

    const result = await service.confirmNoShow("tok", RIDE_ID, confirmNoShowSchema.parse({}));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("RIDE_STATUS_NOT_ARRIVED");
    expect(mockCreateLedgerRow).not.toHaveBeenCalled();
  });

  it("rechaza si no ha pasado el tiempo mínimo de espera (5 minutos)", async () => {
    authAsDriver();
    mockFindByIdForUpdate.mockResolvedValue(fakeArrivedRide({ arrivedAt: new Date(Date.now() - 60_000) }));

    const result = await service.confirmNoShow("tok", RIDE_ID, confirmNoShowSchema.parse({}));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NO_SHOW_WAIT_NOT_ELAPSED");
    expect(mockCreateLedgerRow).not.toHaveBeenCalled();
  });

  it("MONTO NO CONTROLADO POR CLIENTE: el DTO ignora campos financieros enviados por el cliente", () => {
    const forgedInput = {
      notes: "El pasajero no llegó",
      noShowFee: 1,
      amount: 1,
      percentage: 0,
      minimumFare: 0,
      waitingMinutes: 0,
      walletDebit: false,
    };

    const parsed = confirmNoShowSchema.parse(forgedInput);

    expect(parsed).toEqual({ notes: "El pasajero no llegó" });
    expect(parsed).not.toHaveProperty("noShowFee");
    expect(parsed).not.toHaveProperty("amount");
    expect(parsed).not.toHaveProperty("percentage");
    expect(parsed).not.toHaveProperty("minimumFare");
    expect(parsed).not.toHaveProperty("waitingMinutes");
    expect(parsed).not.toHaveProperty("walletDebit");
  });

  it("crea un débito pending por el monto autoritativo (ride.estimatedFareClp) y cancela el viaje", async () => {
    authAsDriver();
    const ride = fakeArrivedRide();
    mockFindByIdForUpdate.mockResolvedValue(ride);
    mockFindByIdempotencyKey.mockResolvedValue(null);
    mockGetOrCreateWallet.mockResolvedValue({ id: WALLET_ID, userId: PASSENGER_ID });
    mockCreateLedgerRow.mockImplementation((data) => Promise.resolve({ id: "debit-uuid", ...data }));
    mockCancelNoShow.mockResolvedValue({ ...ride, status: "cancelled" });

    const result = await service.confirmNoShow("tok", RIDE_ID, confirmNoShowSchema.parse({ notes: "Esperé 6 minutos" }));

    expect(result.ok).toBe(true);
    expect(mockCreateLedgerRow).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "debit",
        source: "no_show",
        amountClp: 5000,
        status: "pending",
        idempotencyKey: `no_show:${RIDE_ID}`,
      }),
      expect.anything(),
    );
    expect(mockCancelNoShow).toHaveBeenCalledWith(RIDE_ID, DRIVER_ID, expect.anything());
  });

  it("es idempotente: una segunda confirmación del mismo viaje no crea un segundo débito", async () => {
    authAsDriver();
    mockFindByIdForUpdate.mockResolvedValue(fakeArrivedRide());
    mockFindByIdempotencyKey.mockResolvedValue({ id: "existing-debit-uuid", idempotencyKey: `no_show:${RIDE_ID}` });

    const result = await service.confirmNoShow("tok", RIDE_ID, confirmNoShowSchema.parse({}));

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.idempotentReplay).toBe(true);
    expect(mockCreateLedgerRow).not.toHaveBeenCalled();
    expect(mockCancelNoShow).not.toHaveBeenCalled();
  });

  it("rechaza si el viaje no tiene tarifa válida", async () => {
    authAsDriver();
    mockFindByIdForUpdate.mockResolvedValue(fakeArrivedRide({ estimatedFareClp: 0 }));
    mockFindByIdempotencyKey.mockResolvedValue(null);

    const result = await service.confirmNoShow("tok", RIDE_ID, confirmNoShowSchema.parse({}));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("INVALID_RIDE_FARE");
    expect(mockCreateLedgerRow).not.toHaveBeenCalled();
  });

  it("ROLLBACK: si la transición del viaje falla tras crear el débito, la transacción completa se rechaza (no queda débito huérfano)", async () => {
    authAsDriver();
    mockFindByIdForUpdate.mockResolvedValue(fakeArrivedRide());
    mockFindByIdempotencyKey.mockResolvedValue(null);
    mockGetOrCreateWallet.mockResolvedValue({ id: WALLET_ID, userId: PASSENGER_ID });
    mockCreateLedgerRow.mockImplementation((data) => Promise.resolve({ id: "debit-uuid", ...data }));
    // Bajo el lock FOR UPDATE esto es casi imposible en producción, pero se simula la
    // defensa: cancelNoShow no encuentra la fila esperada.
    mockCancelNoShow.mockResolvedValue(null);

    const result = await service.confirmNoShow("tok", RIDE_ID, confirmNoShowSchema.parse({}));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("RIDE_CANNOT_CANCEL");
      expect(result.message).toMatch(/rollback/i);
    }
    // El débito SÍ se intentó crear dentro de la transacción (demuestra que el flujo llegó
    // hasta ese punto), pero como cancelNoShow devolvió null, el callback de db.transaction
    // lanzó y — en una base de datos real — Postgres revierte automáticamente ese INSERT
    // junto con todo lo demás. Este mock no puede demostrar la reversión física del INSERT
    // (eso requiere una prueba de integración contra Postgres real, ver informe), pero sí
    // demuestra que el resultado expuesto a la API nunca reporta éxito ni expone el id del
    // débito como válido.
    expect(mockCreateLedgerRow).toHaveBeenCalled();
  });

  it("CONCURRENCIA (simulada): una segunda confirmación tras la primera ya completada encuentra el viaje fuera de driver_arrived", async () => {
    authAsDriver();

    // Primera solicitud: éxito.
    const ride = fakeArrivedRide();
    mockFindByIdForUpdate.mockResolvedValueOnce(ride);
    mockFindByIdempotencyKey.mockResolvedValueOnce(null);
    mockGetOrCreateWallet.mockResolvedValue({ id: WALLET_ID, userId: PASSENGER_ID });
    mockCreateLedgerRow.mockImplementation((data) => Promise.resolve({ id: "debit-uuid", ...data }));
    mockCancelNoShow.mockResolvedValueOnce({ ...ride, status: "cancelled" });

    const first = await service.confirmNoShow("tok", RIDE_ID, confirmNoShowSchema.parse({}));
    expect(first.ok).toBe(true);

    // Segunda solicitud "concurrente": en Postgres real, el lock FOR UPDATE serializa el
    // acceso — cuando esta segunda transacción por fin puede leer la fila, ya la ve
    // actualizada por la primera (status='cancelled', ya no 'driver_arrived').
    mockFindByIdForUpdate.mockResolvedValueOnce({ ...ride, status: "cancelled" });

    const second = await service.confirmNoShow("tok", RIDE_ID, confirmNoShowSchema.parse({}));

    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.code).toBe("RIDE_STATUS_NOT_ARRIVED");
    // Un solo débito, una sola transición de viaje — la segunda solicitud no crea nada.
    expect(mockCreateLedgerRow).toHaveBeenCalledTimes(1);
    expect(mockCancelNoShow).toHaveBeenCalledTimes(1);
  });

  it("la idempotencyKey es determinista por rideId — no depende de nada que el cliente controle", async () => {
    authAsDriver();
    mockFindByIdForUpdate.mockResolvedValue(fakeArrivedRide());
    mockFindByIdempotencyKey.mockResolvedValue(null);
    mockGetOrCreateWallet.mockResolvedValue({ id: WALLET_ID, userId: PASSENGER_ID });
    mockCreateLedgerRow.mockImplementation((data) => Promise.resolve({ id: "debit-uuid", ...data }));
    mockCancelNoShow.mockResolvedValue({ ...fakeArrivedRide(), status: "cancelled" });

    await service.confirmNoShow("tok", RIDE_ID, confirmNoShowSchema.parse({ notes: "intento A" }));
    await service.confirmNoShow("tok", RIDE_ID, confirmNoShowSchema.parse({ notes: "intento B, texto distinto" }));

    const keysUsed = mockFindByIdempotencyKey.mock.calls.map((call) => call[0]);
    expect(new Set(keysUsed).size).toBe(1);
    expect(keysUsed[0]).toBe(`no_show:${RIDE_ID}`);
  });

  it("un fallo en la notificación al pasajero no afecta el resultado ya confirmado (fire-and-forget)", async () => {
    authAsDriver();
    const ride = fakeArrivedRide();
    mockFindByIdForUpdate.mockResolvedValue(ride);
    mockFindByIdempotencyKey.mockResolvedValue(null);
    mockGetOrCreateWallet.mockResolvedValue({ id: WALLET_ID, userId: PASSENGER_ID });
    mockCreateLedgerRow.mockImplementation((data) => Promise.resolve({ id: "debit-uuid", ...data }));
    mockCancelNoShow.mockResolvedValue({ ...ride, status: "cancelled" });
    mockNotifyAsync.mockImplementation(() => {
      throw new Error("push notification service down");
    });

    const result = await service.confirmNoShow("tok", RIDE_ID, confirmNoShowSchema.parse({}));

    expect(result.ok).toBe(true);
  });
});
