import { describe, it, expect, vi, beforeEach } from "vitest";

// ── vi.hoisted: all mock fns must exist before vi.mock factories run ───────────
const {
  mockVerifyAccessToken,
  mockHashToken,
  mockIsSessionValid,
  mockFindUserById,
  mockFindRideById,
  mockCancelNoShow,
  mockGetOrCreateWallet,
  mockFindByIdempotencyKey,
  mockCreateLedgerRow,
  mockNotifyAsync,
} = vi.hoisted(() => ({
  mockVerifyAccessToken:    vi.fn(),
  mockHashToken:            vi.fn().mockReturnValue("hashed-token"),
  mockIsSessionValid:       vi.fn().mockResolvedValue(true),
  mockFindUserById:         vi.fn(),
  mockFindRideById:         vi.fn(),
  mockCancelNoShow:         vi.fn(),
  mockGetOrCreateWallet:    vi.fn(),
  mockFindByIdempotencyKey: vi.fn(),
  mockCreateLedgerRow:      vi.fn(),
  mockNotifyAsync:          vi.fn(),
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
    findById: mockFindRideById,
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
    mockFindRideById.mockResolvedValue(fakeArrivedRide());

    const result = await service.confirmNoShow("tok", RIDE_ID, confirmNoShowSchema.parse({}));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("AUTH_FORBIDDEN");
    expect(mockCreateLedgerRow).not.toHaveBeenCalled();
  });

  it("rechaza si el viaje no está en driver_arrived", async () => {
    authAsDriver();
    mockFindRideById.mockResolvedValue(fakeArrivedRide({ status: "in_progress" }));

    const result = await service.confirmNoShow("tok", RIDE_ID, confirmNoShowSchema.parse({}));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("RIDE_STATUS_NOT_ARRIVED");
    expect(mockCreateLedgerRow).not.toHaveBeenCalled();
  });

  it("rechaza si no ha pasado el tiempo mínimo de espera (5 minutos)", async () => {
    authAsDriver();
    mockFindRideById.mockResolvedValue(fakeArrivedRide({ arrivedAt: new Date(Date.now() - 60_000) }));

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
    mockFindRideById.mockResolvedValue(ride);
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
    );
    expect(mockCancelNoShow).toHaveBeenCalledWith(RIDE_ID, DRIVER_ID);
  });

  it("es idempotente: una segunda confirmación del mismo viaje no crea un segundo débito", async () => {
    authAsDriver();
    mockFindRideById.mockResolvedValue(fakeArrivedRide());
    mockFindByIdempotencyKey.mockResolvedValue({ id: "existing-debit-uuid", idempotencyKey: `no_show:${RIDE_ID}` });

    const result = await service.confirmNoShow("tok", RIDE_ID, confirmNoShowSchema.parse({}));

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.idempotentReplay).toBe(true);
    expect(mockCreateLedgerRow).not.toHaveBeenCalled();
    expect(mockCancelNoShow).not.toHaveBeenCalled();
  });

  it("rechaza si el viaje no tiene tarifa válida", async () => {
    authAsDriver();
    mockFindRideById.mockResolvedValue(fakeArrivedRide({ estimatedFareClp: 0 }));
    mockFindByIdempotencyKey.mockResolvedValue(null);

    const result = await service.confirmNoShow("tok", RIDE_ID, confirmNoShowSchema.parse({}));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("INVALID_RIDE_FARE");
    expect(mockCreateLedgerRow).not.toHaveBeenCalled();
  });
});
