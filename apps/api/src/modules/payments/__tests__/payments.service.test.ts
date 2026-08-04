import { describe, it, expect, vi, beforeEach } from "vitest";

// ── vi.hoisted: all mock fns must exist before vi.mock factories run ───────────
const {
  mockVerifyAccessToken,
  mockHashToken,
  mockIsSessionValid,
  mockFindUserById,
  mockFindRideById,
  mockFindActiveByRideId,
  mockFindSuccessfulByRideIdAndPurpose,
  mockCreate,
  mockMarkProcessing,
  mockMarkFailed,
  mockMarkSuccess,
  mockMarkSuccessAndActivateRide,
  mockMarkRejected,
  mockFindById,
  mockFindRefundableByRideId,
  mockClaimRefund,
  mockMarkRefunded,
  mockMarkRefundFailed,
  mockRecordSafe,
  mockCreatePayment,
  mockVerifyWebhookSignature,
  mockNormalizeWebhook,
  mockClaimWebhookEvent,
  mockCompleteWebhookEvent,
  mockFailWebhookEvent,
} = vi.hoisted(() => ({
  mockVerifyAccessToken:      vi.fn(),
  mockHashToken:              vi.fn().mockReturnValue("hashed-token"),
  mockIsSessionValid:         vi.fn().mockResolvedValue(true),
  mockFindUserById:           vi.fn(),
  mockFindRideById:           vi.fn(),
  mockFindActiveByRideId:     vi.fn(),
  mockFindSuccessfulByRideIdAndPurpose: vi.fn().mockResolvedValue(null),
  mockCreate:                 vi.fn(),
  mockMarkProcessing:         vi.fn(),
  mockMarkFailed:             vi.fn(),
  mockMarkSuccess:            vi.fn(),
  mockMarkSuccessAndActivateRide: vi.fn(),
  mockMarkRejected:           vi.fn(),
  mockFindById:               vi.fn(),
  mockFindRefundableByRideId:   vi.fn(),
  mockClaimRefund:              vi.fn(),
  mockMarkRefunded:             vi.fn(),
  mockMarkRefundFailed:         vi.fn(),
  mockRecordSafe:             vi.fn(),
  mockCreatePayment:          vi.fn(),
  mockVerifyWebhookSignature: vi.fn(),
  mockNormalizeWebhook:       vi.fn(),
  mockClaimWebhookEvent:      vi.fn(),
  mockCompleteWebhookEvent:   vi.fn(),
  mockFailWebhookEvent:       vi.fn(),
}));

const mockProvider = {
  name:                    "prontopaga",
  createPayment:           mockCreatePayment,
  verifyWebhookSignature:  mockVerifyWebhookSignature,
  normalizeWebhook:        mockNormalizeWebhook,
};

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
    findActiveByRideIdAndPurpose: mockFindActiveByRideId,
    findSuccessfulByRideIdAndPurpose: mockFindSuccessfulByRideIdAndPurpose,
    create:             mockCreate,
    markProcessing:     mockMarkProcessing,
    markFailed:         mockMarkFailed,
    markSuccess:        mockMarkSuccess,
    markSuccessAndActivateRide: mockMarkSuccessAndActivateRide,
    markRejected:       mockMarkRejected,
    findById:           mockFindById,
    findRefundableByRideId: mockFindRefundableByRideId,
    claimRefund:           mockClaimRefund,
    markRefunded:          mockMarkRefunded,
    markRefundFailed:      mockMarkRefundFailed,
    claimWebhookEvent:     mockClaimWebhookEvent,
    completeWebhookEvent:  mockCompleteWebhookEvent,
    failWebhookEvent:      mockFailWebhookEvent,
  })),
}));
vi.mock("../provider.registry.js", () => ({
  getActiveProvider: () => mockProvider,
  getProvider:       (_name: string) => mockProvider,
}));
vi.mock("../../../modules/audit/audit.service.js", () => ({
  AuditService: vi.fn().mockImplementation(() => ({ recordSafe: mockRecordSafe })),
}));
vi.mock("../../../modules/rides/rides.repository.js", () => ({
  RidesRepository: vi.fn().mockImplementation(() => ({
    findById: mockFindRideById,
    activateAfterApprovedPayment: vi.fn().mockResolvedValue({
      status: "requested",
    }),
  })),
}));

import { PaymentsService } from "../payments.service.js";

// ── Fixtures ───────────────────────────────────────────────────────────────────

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

  it("blocks payment when ride status is not payable", async () => {
    setupPassengerAuth();
    mockFindRideById.mockResolvedValue({ ...completedRide, status: "cancelled" });

    const result = await service.createPayment("tok", { rideRequestId: RIDE_ID });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("PAYMENT_RIDE_STATUS_NOT_ALLOWED");
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

  it("marks payment as failed when provider throws, so passenger can retry", async () => {
    setupPassengerAuth();
    mockFindRideById.mockResolvedValue(completedRide);
    mockFindActiveByRideId.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: PAYMENT_ID, amountClp: 5000 });
    mockCreatePayment.mockRejectedValue(new Error("Network timeout"));

    const result = await service.createPayment("tok", { rideRequestId: RIDE_ID });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("PAYMENT_PROVIDER_ERROR");
    expect(mockMarkFailed).toHaveBeenCalledWith(PAYMENT_ID);
    expect(mockMarkProcessing).not.toHaveBeenCalled();
  });

  it("allows retry after a failed payment (findActiveByRideId returns null for failed)", async () => {
    setupPassengerAuth();
    mockFindRideById.mockResolvedValue(completedRide);
    mockFindActiveByRideId.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: "new-payment-uuid", amountClp: 5000 });
    mockCreatePayment.mockResolvedValue({
      providerOrderId: "MP-PREF-999",
      urlPay: "https://sandbox.mercadopago.com/checkout?pref=MP-PREF-999",
    });
    mockMarkProcessing.mockResolvedValue({ id: "new-payment-uuid", status: "processing" });

    const result = await service.createPayment("tok", { rideRequestId: RIDE_ID });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.urlPay).toBe("https://sandbox.mercadopago.com/checkout?pref=MP-PREF-999");
    }
  });

  it("stores urlPay and providerOrderId atomically in a single markProcessing call", async () => {
    setupPassengerAuth();
    mockFindRideById.mockResolvedValue(completedRide);
    mockFindActiveByRideId.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: PAYMENT_ID, amountClp: 5000 });
    mockCreatePayment.mockResolvedValue({
      providerOrderId: "MP-PREF-777",
      urlPay: "https://sandbox.mercadopago.com/checkout?pref=MP-PREF-777",
    });
    mockMarkProcessing.mockResolvedValue({ id: PAYMENT_ID, status: "processing" });

    await service.createPayment("tok", { rideRequestId: RIDE_ID });

    expect(mockMarkProcessing).toHaveBeenCalledOnce();
    expect(mockMarkProcessing).toHaveBeenCalledWith(
      PAYMENT_ID,
      "https://sandbox.mercadopago.com/checkout?pref=MP-PREF-777",
      "MP-PREF-777",
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
    mockClaimWebhookEvent.mockResolvedValue({
      claimed: true,
      event: { id: "webhook-event-id", status: "processing" },
    });
    mockCompleteWebhookEvent.mockResolvedValue(undefined);
    mockFailWebhookEvent.mockResolvedValue(undefined);
    mockVerifyWebhookSignature.mockReturnValue(true);
    mockNormalizeWebhook.mockResolvedValue({
      orderId:    PAYMENT_ID,
      status:     "success",
      externalId: "ext-123",
      rawPayload: {},
    });
    mockFindById.mockResolvedValue(storedPayment);
    mockMarkSuccess.mockResolvedValue({ ...storedPayment, status: "success" });
    mockMarkRejected.mockResolvedValue({ ...storedPayment, status: "rejected" });
  });

  it("returns 401 when signature is invalid", async () => {
    mockVerifyWebhookSignature.mockReturnValue(false);

    const result = await service.handleWebhook("prontopaga", { order: PAYMENT_ID, status: "success" }, {});

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("WEBHOOK_INVALID_SIGNATURE");
      expect(result.statusCode).toBe(401);
    }
    expect(mockMarkSuccess).not.toHaveBeenCalled();
  });

  it("processes success status from normalizeWebhook", async () => {
    mockNormalizeWebhook.mockResolvedValue({
      orderId: PAYMENT_ID, status: "success", externalId: "ext-1", rawPayload: {},
    });

    const result = await service.handleWebhook("prontopaga", { order: PAYMENT_ID, status: "success" }, {});

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.processed).toBe(true);
    expect(mockMarkSuccessAndActivateRide).toHaveBeenCalledWith({
      id: PAYMENT_ID,
      rideRequestId: RIDE_ID,
      externalId: "ext-1",
      providerPayload: expect.any(Object),
    });
    expect(mockMarkSuccess).not.toHaveBeenCalled();
  });

  it("processes success using 'order' field (prontopaga payload)", async () => {
    mockNormalizeWebhook.mockResolvedValue({
      orderId: PAYMENT_ID, status: "success", externalId: "", rawPayload: {},
    });

    const result = await service.handleWebhook(
      "prontopaga",
      { order: PAYMENT_ID, status: "success", amount: 5000 },
      {},
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.processed).toBe(true);
    expect(mockMarkSuccessAndActivateRide).toHaveBeenCalledWith({
      id: PAYMENT_ID,
      rideRequestId: RIDE_ID,
      externalId: "",
      providerPayload: expect.any(Object),
    });
    expect(mockMarkSuccess).not.toHaveBeenCalled();
  });

  it("processes success using 'order_id' field (prontopaga fallback)", async () => {
    mockNormalizeWebhook.mockResolvedValue({
      orderId: PAYMENT_ID, status: "success", externalId: "", rawPayload: {},
    });

    const result = await service.handleWebhook(
      "prontopaga",
      { order_id: PAYMENT_ID, status: "success", amount: 5000 },
      {},
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.processed).toBe(true);
    expect(mockMarkSuccessAndActivateRide).toHaveBeenCalledWith({
      id: PAYMENT_ID,
      rideRequestId: RIDE_ID,
      externalId: "",
      providerPayload: expect.any(Object),
    });
    expect(mockMarkSuccess).not.toHaveBeenCalled();
  });

  it("processes rejected status correctly", async () => {
    mockNormalizeWebhook.mockResolvedValue({
      orderId: PAYMENT_ID, status: "rejected", externalId: "", rawPayload: {},
    });

    const result = await service.handleWebhook("prontopaga", { order: PAYMENT_ID, status: "rejected" }, {});

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.processed).toBe(true);
    expect(mockMarkRejected).toHaveBeenCalledWith(PAYMENT_ID, expect.any(Object));
    expect(mockMarkSuccess).not.toHaveBeenCalled();
  });

  it("is idempotent: does not re-process a duplicate success webhook", async () => {
    mockFindById.mockResolvedValue({ ...storedPayment, status: "success" });

    const result = await service.handleWebhook("prontopaga", { order: PAYMENT_ID, status: "success" }, {});

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.processed).toBe(false);
    expect(mockMarkSuccess).not.toHaveBeenCalled();
  });

  it("is idempotent: does not re-process a duplicate rejected webhook", async () => {
    mockFindById.mockResolvedValue({ ...storedPayment, status: "rejected" });
    mockNormalizeWebhook.mockResolvedValue({
      orderId: PAYMENT_ID, status: "rejected", externalId: "", rawPayload: {},
    });

    const result = await service.handleWebhook("prontopaga", { order: PAYMENT_ID, status: "rejected" }, {});

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.processed).toBe(false);
    expect(mockMarkRejected).not.toHaveBeenCalled();
  });

  it("acknowledges unknown status without erroring (avoids provider retry storm)", async () => {
    mockNormalizeWebhook.mockResolvedValue({
      orderId: PAYMENT_ID, status: "unknown", externalId: "", rawPayload: {},
    });

    const result = await service.handleWebhook("prontopaga", { order: PAYMENT_ID, status: "chargeback" }, {});

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.processed).toBe(false);
    expect(mockMarkSuccess).not.toHaveBeenCalled();
    expect(mockMarkRejected).not.toHaveBeenCalled();
  });

  it("acknowledges pending status without state change", async () => {
    mockNormalizeWebhook.mockResolvedValue({
      orderId: PAYMENT_ID, status: "pending", externalId: "", rawPayload: {},
    });

    const result = await service.handleWebhook("mercadopago", { type: "payment", data: { id: "123" } }, {});

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.processed).toBe(false);
    expect(mockMarkSuccess).not.toHaveBeenCalled();
  });

  it("silently acknowledges non-payment MP notifications (empty orderId)", async () => {
    mockNormalizeWebhook.mockResolvedValue({
      orderId: "", status: "unknown", externalId: "", rawPayload: {},
    });

    const result = await service.handleWebhook("mercadopago", { type: "subscription_preapproval" }, {});

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.processed).toBe(false);
    expect(mockFindById).not.toHaveBeenCalled();
  });

  it("returns 502 when normalizeWebhook throws (provider API error)", async () => {
    mockNormalizeWebhook.mockRejectedValue(new Error("MP API down"));

    const result = await service.handleWebhook("mercadopago", { type: "payment", data: { id: "999" } }, {});

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("WEBHOOK_PROVIDER_ERROR");
      expect(result.statusCode).toBe(502);
    }
  });
});


// ── refundCardPaymentForCancelledRide ────────────────────────────────────────

describe("PaymentsService.refundCardPaymentForCancelledRide", () => {
  let service: PaymentsService;

  const refundablePayment = {
    id: PAYMENT_ID,
    rideRequestId: RIDE_ID,
    passengerUserId: PASSENGER_ID,
    amountClp: 5000,
    paymentPurpose: "ride",
    status: "success",
    provider: "mercadopago",
    providerPaymentId: "mp-payment-123",
    refundStatus: null,
    rawProviderPayload: {},
    paidAt: new Date("2026-07-19T12:00:00.000Z"),
    createdAt: new Date("2026-07-19T11:59:00.000Z"),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PaymentsService();
    process.env["MERCADOPAGO_ACCESS_TOKEN"] = "test-access-token";
  });

  it("uses a stable idempotency key and persists an approved refund", async () => {
    mockFindRefundableByRideId.mockResolvedValue(refundablePayment);
    mockClaimRefund.mockResolvedValue({
      ...refundablePayment,
      refundStatus: "processing",
      refundIdempotencyKey: `rapago-refund-${PAYMENT_ID}`,
    });
    mockMarkRefunded.mockResolvedValue({
      ...refundablePayment,
      status: "refunded",
      refundStatus: "approved",
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: vi.fn().mockResolvedValue({ id: "mp-refund-1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await service.refundCardPaymentForCancelledRide({
      rideRequestId: RIDE_ID,
      cancelledByUserId: PASSENGER_ID,
      cancelledByRole: "passenger",
      reason: "Cambio de planes",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.refunded).toBe(true);
    }

    expect(mockClaimRefund).toHaveBeenCalledWith(
      PAYMENT_ID,
      `rapago-refund-${PAYMENT_ID}`,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.mercadopago.com/v1/payments/mp-payment-123/refunds",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-Idempotency-Key": `rapago-refund-${PAYMENT_ID}`,
        }),
      }),
    );
    expect(mockMarkRefunded).toHaveBeenCalledWith(
      expect.objectContaining({
        id: PAYMENT_ID,
        providerRefundId: "mp-refund-1",
      }),
    );

    vi.unstubAllGlobals();
  });

  it("does not request a second refund when it was already approved", async () => {
    mockFindRefundableByRideId.mockResolvedValue({
      ...refundablePayment,
      status: "refunded",
      refundStatus: "approved",
    });

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await service.refundCardPaymentForCancelledRide({
      rideRequestId: RIDE_ID,
      cancelledByUserId: PASSENGER_ID,
      cancelledByRole: "passenger",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.refunded).toBe(true);
      expect(result.processed).toBe(true);
    }
    expect(mockClaimRefund).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});


describe("PaymentsService.reconcileMercadoPagoPayment", () => {
  let service: PaymentsService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    service = new PaymentsService();
    mockIsSessionValid.mockResolvedValue(true);
    setupPassengerAuth();
    process.env["MERCADOPAGO_ACCESS_TOKEN"] = "APP_USR-test-token";
    mockMarkSuccessAndActivateRide.mockResolvedValue({
      payment: {
        id: PAYMENT_ID,
        status: "success",
      },
      rideActivated: true,
    });
  });

  it("confirms an approved payment by querying Mercado Pago directly", async () => {
    mockFindById.mockResolvedValue({
      id: PAYMENT_ID,
      rideRequestId: RIDE_ID,
      passengerUserId: PASSENGER_ID,
      amountClp: 5000,
      paymentPurpose: "ride",
      provider: "mercadopago",
      status: "processing",
      providerPaymentId: null,
    });
    mockMarkSuccess.mockResolvedValue({
      id: PAYMENT_ID,
      status: "success",
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(JSON.stringify({
        id: 987654321,
        status: "approved",
        external_reference: PAYMENT_ID,
        transaction_amount: 5000,
        currency_id: "CLP",
      })),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await service.reconcileMercadoPagoPayment(
      "tok",
      PAYMENT_ID,
      "987654321",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payment.status).toBe("success");
      expect(result.payment.providerPaymentId).toBe("987654321");
      expect(result.payment.activated).toBe(true);
    }
    expect(mockMarkSuccessAndActivateRide).toHaveBeenCalledWith({
      id: PAYMENT_ID,
      rideRequestId: RIDE_ID,
      externalId: "987654321",
      providerPayload: expect.objectContaining({
        external_reference: PAYMENT_ID,
        transaction_amount: 5000,
        currency_id: "CLP",
      }),
    });

    vi.unstubAllGlobals();
  });

  it("rejects a return payment that belongs to another external_reference", async () => {
    mockFindById.mockResolvedValue({
      id: PAYMENT_ID,
      rideRequestId: RIDE_ID,
      passengerUserId: PASSENGER_ID,
      amountClp: 5000,
      paymentPurpose: "ride",
      provider: "mercadopago",
      status: "processing",
      providerPaymentId: null,
    });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(JSON.stringify({
        id: 987654321,
        status: "approved",
        external_reference: "another-payment-id",
        transaction_amount: 5000,
        currency_id: "CLP",
      })),
    }));

    const result = await service.reconcileMercadoPagoPayment(
      "tok",
      PAYMENT_ID,
      "987654321",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("PAYMENT_EXTERNAL_REFERENCE_MISMATCH");
      expect(result.statusCode).toBe(409);
    }
    expect(mockMarkSuccess).not.toHaveBeenCalled();
    expect(mockMarkSuccessAndActivateRide).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("searches by external_reference when the return URL no longer has payment_id", async () => {
    mockFindById.mockResolvedValue({
      id: PAYMENT_ID,
      rideRequestId: RIDE_ID,
      passengerUserId: PASSENGER_ID,
      amountClp: 5000,
      paymentPurpose: "ride",
      provider: "mercadopago",
      status: "processing",
      providerPaymentId: null,
    });
    mockMarkSuccess.mockResolvedValue({
      id: PAYMENT_ID,
      status: "success",
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(JSON.stringify({
        results: [{
          id: 123456789,
          status: "approved",
          external_reference: PAYMENT_ID,
          transaction_amount: 5000,
          currency_id: "CLP",
        }],
      })),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await service.reconcileMercadoPagoPayment(
      "tok",
      PAYMENT_ID,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payment.status).toBe("success");
      expect(result.payment.providerPaymentId).toBe("123456789");
    }
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/v1/payments/search?"),
      expect.objectContaining({ method: "GET" }),
    );

    vi.unstubAllGlobals();
  });
});

describe("PaymentsService.getPaymentStatus Klap details", () => {
  let service: PaymentsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PaymentsService();
    mockIsSessionValid.mockResolvedValue(true);
    setupPassengerAuth();
  });

  it("returns a safe passenger-facing reason for authentication failure", async () => {
    const now = new Date("2026-08-04T20:00:00.000Z");
    mockFindById.mockResolvedValue({
      id: PAYMENT_ID,
      rideRequestId: RIDE_ID,
      passengerUserId: PASSENGER_ID,
      amountClp: 5000,
      paymentPurpose: "ride",
      provider: "klap",
      status: "rejected",
      providerOrderId: "klap-order",
      providerPaymentId: null,
      rawProviderPayload: {
        code: "authentication_failed",
        message: "3DS authentication failed",
      },
      paidAt: null,
      rejectedAt: now,
      failedAt: null,
      refundStatus: null,
      refundProviderId: null,
      refundedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    const result = await service.getPaymentStatus("tok", PAYMENT_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payment.declineCode).toBe("AUTHENTICATION_FAILED");
      expect(result.payment.declineReason).toContain("validar la tarjeta con tu banco");
      expect(result.payment.retryAllowed).toBe(true);
      expect(JSON.stringify(result.payment)).not.toContain("3DS authentication failed");
    }
  });

  it("returns safe card metadata after a successful Klap confirmation", async () => {
    const now = new Date("2026-08-04T20:00:00.000Z");
    mockFindById.mockResolvedValue({
      id: PAYMENT_ID,
      rideRequestId: RIDE_ID,
      passengerUserId: PASSENGER_ID,
      amountClp: 5000,
      paymentPurpose: "ride",
      provider: "klap",
      status: "success",
      providerOrderId: "klap-order",
      providerPaymentId: "klap-order",
      rawProviderPayload: {
        card_type: "credito",
        brand: "Visa",
        last_digits: "1091",
        quotas_number: "3",
      },
      paidAt: now,
      rejectedAt: null,
      failedAt: null,
      refundStatus: null,
      refundProviderId: null,
      refundedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    const result = await service.getPaymentStatus("tok", PAYMENT_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payment.cardType).toBe("credit");
      expect(result.payment.cardBrand).toBe("Visa");
      expect(result.payment.cardLast4).toBe("1091");
      expect(result.payment.installments).toBe(3);
      expect(result.payment.declineReason).toBeNull();
    }
  });
});
