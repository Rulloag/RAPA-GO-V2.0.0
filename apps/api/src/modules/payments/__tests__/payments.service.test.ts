import { describe, it, expect, vi, beforeEach } from "vitest";

// ── vi.hoisted ensures these fns exist before vi.mock factories run ────────────
const {
  mockVerifyAccessToken,
  mockHashToken,
  mockIsSessionValid,
  mockFindUserById,
  mockFindRideById,
  mockFindActiveByRideId,
  mockCreate,
  mockMarkProcessing,
  mockMarkFailed,
  mockMarkSuccess,
  mockMarkRejected,
  mockFindById,
  mockRecordSafe,
  mockCreateProntoPagaPayment,
  mockVerifyWebhookSignature,
} = vi.hoisted(() => ({
  mockVerifyAccessToken:      vi.fn(),
  mockHashToken:              vi.fn().mockReturnValue("hashed-token"),
  mockIsSessionValid:         vi.fn().mockResolvedValue(true),
  mockFindUserById:           vi.fn(),
  mockFindRideById:           vi.fn(),
  mockFindActiveByRideId:     vi.fn(),
  mockCreate:                 vi.fn(),
  mockMarkProcessing:         vi.fn(),
  mockMarkFailed:             vi.fn(),
  mockMarkSuccess:            vi.fn(),
  mockMarkRejected:           vi.fn(),
  mockFindById:               vi.fn(),
  mockRecordSafe:             vi.fn(),
  mockCreateProntoPagaPayment: vi.fn(),
  mockVerifyWebhookSignature:  vi.fn(),
}));

vi.mock("../../../modules/auth/token.service.js", () => ({
  TokenService: vi.fn().mockImplementation(() => ({
    verifyAccessToken: mockVerifyAccessToken,
    hashToken:         mockHashToken,
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
vi.mock("../payments.repository.js", () => ({
  PaymentsRepository: vi.fn().mockImplementation(() => ({
    findActiveByRideId: mockFindActiveByRideId,
    create:             mockCreate,
    markProcessing:     mockMarkProcessing,
    markFailed:         mockMarkFailed,
    markSuccess:        mockMarkSuccess,
    markRejected:       mockMarkRejected,
    findById:           mockFindById,
  })),
}));
vi.mock("../prontopaga.service.js", () => ({
  createProntoPagaPayment:           mockCreateProntoPagaPayment,
  verifyProntoPagaWebhookSignature:  mockVerifyWebhookSignature,
}));
vi.mock("../../../modules/audit/audit.service.js", () => ({
  AuditService: vi.fn().mockImplementation(() => ({ recordSafe: mockRecordSafe })),
}));
vi.mock("../../../modules/rides/rides.repository.js", () => ({
  RidesRepository: vi.fn().mockImplementation(() => ({
    findById: mockFindRideById,
  })),
}));

import { PaymentsService } from "../payments.service.js";

// ── Shared fixtures ────────────────────────────────────────────────────────────

const PASSENGER_ID = "user-passenger-uuid";
const RIDE_ID      = "ride-uuid";
const PAYMENT_ID   = "payment-uuid";

const completedRide = {
  id:               RIDE_ID,
  passengerUserId:  PASSENGER_ID,
  status:           "completed",
  estimatedFareClp: 5000,
  originText:       "Hotel",
  destinationText:  "Aeropuerto",
};

const passengerUser = {
  id:    PASSENGER_ID,
  email: "passenger@test.com",
  name:  "Ana Passenger",
  role:  "passenger",
};

function setupPassengerAuth() {
  mockVerifyAccessToken.mockReturnValue({ sub: PASSENGER_ID });
  mockFindUserById.mockResolvedValue(passengerUser);
}

// ── createPayment ──────────────────────────────────────────────────────────────

describe("PaymentsService.createPayment", () => {
  let service: PaymentsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PaymentsService();
    mockIsSessionValid.mockResolvedValue(true);
    process.env["PAYMENT_WEBHOOK_BASE_URL"] = "https://api.rapago.cl";
    process.env["MOBILE_APP_DEEP_LINK"]     = "rapago://";
  });

  it("blocks payment when ride is not completed", async () => {
    setupPassengerAuth();
    mockFindRideById.mockResolvedValue({ ...completedRide, status: "accepted" });

    const result = await service.createPayment("tok", { rideRequestId: RIDE_ID });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("PAYMENT_RIDE_NOT_COMPLETED");
      expect(result.statusCode).toBe(409);
    }
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("blocks payment when an active payment already exists (pending|processing)", async () => {
    setupPassengerAuth();
    mockFindRideById.mockResolvedValue(completedRide);
    mockFindActiveByRideId.mockResolvedValue({ id: PAYMENT_ID, status: "processing" });

    const result = await service.createPayment("tok", { rideRequestId: RIDE_ID });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("PAYMENT_ALREADY_EXISTS");
      expect(result.statusCode).toBe(409);
    }
  });

  it("marks payment as failed (not pending) when ProntoPaga call throws, so passenger can retry", async () => {
    setupPassengerAuth();
    mockFindRideById.mockResolvedValue(completedRide);
    mockFindActiveByRideId.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: PAYMENT_ID, amountClp: 5000 });
    mockCreateProntoPagaPayment.mockRejectedValue(new Error("Network timeout"));

    const result = await service.createPayment("tok", { rideRequestId: RIDE_ID });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("PAYMENT_PROVIDER_ERROR");
    expect(mockMarkFailed).toHaveBeenCalledWith(PAYMENT_ID);
    expect(mockMarkProcessing).not.toHaveBeenCalled();
  });

  it("allows retry after a failed payment (findActiveByRideId returns null for failed)", async () => {
    setupPassengerAuth();
    mockFindRideById.mockResolvedValue(completedRide);
    // failed payments are excluded from findActiveByRideId (partial index in DB)
    mockFindActiveByRideId.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: "new-payment-uuid", amountClp: 5000 });
    mockCreateProntoPagaPayment.mockResolvedValue({
      providerOrderId: "PP-999",
      urlPay: "https://checkout.prontopaga.cl/pay/PP-999",
    });
    mockMarkProcessing.mockResolvedValue({ id: "new-payment-uuid", status: "processing" });

    const result = await service.createPayment("tok", { rideRequestId: RIDE_ID });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.urlPay).toBe("https://checkout.prontopaga.cl/pay/PP-999");
    }
  });

  it("stores urlPay and providerOrderId atomically in a single markProcessing call", async () => {
    setupPassengerAuth();
    mockFindRideById.mockResolvedValue(completedRide);
    mockFindActiveByRideId.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: PAYMENT_ID, amountClp: 5000 });
    mockCreateProntoPagaPayment.mockResolvedValue({
      providerOrderId: "PP-777",
      urlPay: "https://checkout.prontopaga.cl/pay/PP-777",
    });
    mockMarkProcessing.mockResolvedValue({ id: PAYMENT_ID, status: "processing" });

    await service.createPayment("tok", { rideRequestId: RIDE_ID });

    expect(mockMarkProcessing).toHaveBeenCalledOnce();
    expect(mockMarkProcessing).toHaveBeenCalledWith(
      PAYMENT_ID,
      "https://checkout.prontopaga.cl/pay/PP-777",
      "PP-777",
    );
  });
});

// ── handleWebhook ──────────────────────────────────────────────────────────────

describe("PaymentsService.handleWebhook", () => {
  let service: PaymentsService;

  const storedPayment = {
    id:              PAYMENT_ID,
    rideRequestId:   RIDE_ID,
    passengerUserId: PASSENGER_ID,
    amountClp:       5000,
    status:          "processing",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PaymentsService();
    mockVerifyWebhookSignature.mockReturnValue(true);
    mockFindById.mockResolvedValue(storedPayment);
    mockMarkSuccess.mockResolvedValue({ ...storedPayment, status: "success" });
    mockMarkRejected.mockResolvedValue({ ...storedPayment, status: "rejected" });
  });

  it("returns 401 when signature is invalid", async () => {
    mockVerifyWebhookSignature.mockReturnValue(false);

    const result = await service.handleWebhook({ order: PAYMENT_ID, status: "success" }, "bad-sig");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("WEBHOOK_INVALID_SIGNATURE");
      expect(result.statusCode).toBe(401);
    }
    expect(mockMarkSuccess).not.toHaveBeenCalled();
  });

  it("processes success status using field 'order'", async () => {
    const result = await service.handleWebhook(
      { order: PAYMENT_ID, status: "success", amount: 5000 },
      "valid-sig",
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.processed).toBe(true);
    expect(mockMarkSuccess).toHaveBeenCalledWith(PAYMENT_ID, expect.any(String), expect.any(Object));
  });

  it("processes success status using field 'order_id'", async () => {
    const result = await service.handleWebhook(
      { order_id: PAYMENT_ID, status: "success", amount: 5000 },
      "valid-sig",
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.processed).toBe(true);
    expect(mockMarkSuccess).toHaveBeenCalled();
  });

  it("processes rejected status correctly", async () => {
    const result = await service.handleWebhook(
      { order: PAYMENT_ID, status: "rejected" },
      "valid-sig",
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.processed).toBe(true);
    expect(mockMarkRejected).toHaveBeenCalledWith(PAYMENT_ID, expect.any(Object));
    expect(mockMarkSuccess).not.toHaveBeenCalled();
  });

  it("is idempotent: does not re-process a duplicate success webhook", async () => {
    mockFindById.mockResolvedValue({ ...storedPayment, status: "success" });

    const result = await service.handleWebhook(
      { order: PAYMENT_ID, status: "success" },
      "valid-sig",
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.processed).toBe(false);
    expect(mockMarkSuccess).not.toHaveBeenCalled();
  });

  it("is idempotent: does not re-process a duplicate rejected webhook", async () => {
    mockFindById.mockResolvedValue({ ...storedPayment, status: "rejected" });

    const result = await service.handleWebhook(
      { order: PAYMENT_ID, status: "rejected" },
      "valid-sig",
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.processed).toBe(false);
    expect(mockMarkRejected).not.toHaveBeenCalled();
  });

  it("acknowledges unknown status without erroring (avoids provider retry storm)", async () => {
    const result = await service.handleWebhook(
      { order: PAYMENT_ID, status: "chargeback" },
      "valid-sig",
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.processed).toBe(false);
    expect(mockMarkSuccess).not.toHaveBeenCalled();
    expect(mockMarkRejected).not.toHaveBeenCalled();
  });

  it("returns 400 when neither 'order' nor 'order_id' is present in payload", async () => {
    const result = await service.handleWebhook({ status: "success" }, "valid-sig");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("WEBHOOK_MISSING_ORDER");
      expect(result.statusCode).toBe(400);
    }
  });
});
