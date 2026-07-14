import { describe, it, expect, vi, beforeEach } from "vitest";

// ── vi.hoisted: all mock fns must exist before vi.mock factories run ───────────
const {
  mockVerifyAccessToken,
  mockHashToken,
  mockIsSessionValid,
  mockFindUserById,
  mockCreate,
  mockFindByType,
  mockFindZoneFareByRoute,
  mockRecordSafe,
} = vi.hoisted(() => ({
  mockVerifyAccessToken:   vi.fn(),
  mockHashToken:           vi.fn().mockReturnValue("hashed-token"),
  mockIsSessionValid:      vi.fn().mockResolvedValue(true),
  mockFindUserById:        vi.fn(),
  mockCreate:              vi.fn(),
  mockFindByType:          vi.fn().mockResolvedValue(null),
  mockFindZoneFareByRoute: vi.fn().mockResolvedValue(null),
  mockRecordSafe:          vi.fn(),
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
    create: mockCreate,
  })),
}));
vi.mock("../../fareSettings/fareSettings.repository.js", () => ({
  FareSettingsRepository: vi.fn().mockImplementation(() => ({
    findByType:          mockFindByType,
    findZoneFareByRoute:  mockFindZoneFareByRoute,
  })),
}));
vi.mock("../../audit/audit.service.js", () => ({
  AuditService: vi.fn().mockImplementation(() => ({ recordSafe: mockRecordSafe })),
}));

import { RidesService } from "../rides.service.js";

// ── Fixtures ───────────────────────────────────────────────────────────────────

const PASSENGER_ID = "user-passenger-uuid";

const passengerUser = {
  id:   PASSENGER_ID,
  role: "passenger",
};

function setupPassengerAuth() {
  mockVerifyAccessToken.mockReturnValue({ sub: PASSENGER_ID });
  mockFindUserById.mockResolvedValue(passengerUser);
}

function fakeRideRow(estimatedFareClp: number) {
  return {
    id:               "ride-uuid",
    passengerUserId:  PASSENGER_ID,
    driverUserId:     null,
    originText:       "Hanga Roa",
    destinationText:  "Aeropuerto Mataveri",
    notes:            null,
    estimatedFareClp,
    status:           "requested",
    requestedAt:      new Date(),
    acceptedAt:       null,
    enRouteAt:        null,
    arrivedAt:        null,
    startedAt:        null,
    completedAt:      null,
    cancelledAt:      null,
    cancellationReason: null,
    cancelledByRole:  null,
    createdAt:        new Date(),
    updatedAt:        new Date(),
  };
}

describe("RidesService.createRideRequest — integridad de tarifa", () => {
  let service: RidesService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSessionValid.mockResolvedValue(true);
    mockFindByType.mockResolvedValue(null);
    mockFindZoneFareByRoute.mockResolvedValue(null);
    service = new RidesService();
  });

  it("ignora un fare manipulado a la baja (estimatedFare=1) y usa el cálculo del servidor", async () => {
    setupPassengerAuth();
    mockCreate.mockImplementation((_p, _o, _d, _n, fare: number) =>
      Promise.resolve(fakeRideRow(fare)),
    );

    const result = await service.createRideRequest("tok", {
      originText: "Hanga Roa",
      destinationText: "Aeropuerto Mataveri",
      estimatedFareClp: 1,
    } as never);

    expect(result.ok).toBe(true);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const persistedFare = mockCreate.mock.calls[0]![4] as number;
    expect(persistedFare).not.toBe(1);
    expect(persistedFare).toBeGreaterThan(1);
    // Debe registrarse la discrepancia para auditoría, sin bloquear el viaje.
    expect(mockRecordSafe).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "ride.fare_client_mismatch" }),
    );
  });

  it("ignora una tarifa exagerada (999999999) y no la persiste", async () => {
    setupPassengerAuth();
    mockCreate.mockImplementation((_p, _o, _d, _n, fare: number) =>
      Promise.resolve(fakeRideRow(fare)),
    );

    const result = await service.createRideRequest("tok", {
      originText: "Hanga Roa",
      destinationText: "Aeropuerto Mataveri",
      estimatedFareClp: 999999999,
    } as never);

    expect(result.ok).toBe(true);
    const persistedFare = mockCreate.mock.calls[0]![4] as number;
    expect(persistedFare).toBeLessThan(999999999);
  });

  it("calcula la tarifa en el servidor incluso si el cliente no envía estimatedFareClp", async () => {
    setupPassengerAuth();
    mockCreate.mockImplementation((_p, _o, _d, _n, fare: number) =>
      Promise.resolve(fakeRideRow(fare)),
    );

    const result = await service.createRideRequest("tok", {
      originText: "Hanga Roa",
      destinationText: "Aeropuerto Mataveri",
    } as never);

    expect(result.ok).toBe(true);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const persistedFare = mockCreate.mock.calls[0]![4] as number;
    expect(persistedFare).toBeGreaterThan(0);
    // Sin fare del cliente no hay nada que comparar/auditar.
    expect(mockRecordSafe).not.toHaveBeenCalled();
  });

  it("usa la tarifa de zona configurada en backend cuando existe, ignorando al cliente", async () => {
    setupPassengerAuth();
    mockFindZoneFareByRoute.mockResolvedValue({ fare: 7000 });
    mockCreate.mockImplementation((_p, _o, _d, _n, fare: number) =>
      Promise.resolve(fakeRideRow(fare)),
    );

    const result = await service.createRideRequest("tok", {
      originText: "Hanga Roa",
      destinationText: "Aeropuerto Mataveri",
      estimatedFareClp: 500,
    } as never);

    expect(result.ok).toBe(true);
    const persistedFare = mockCreate.mock.calls[0]![4] as number;
    expect(persistedFare).toBe(7000);
  });
});
