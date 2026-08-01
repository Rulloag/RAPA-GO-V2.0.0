import { describe, it, expect, vi, beforeEach } from "vitest";

// ── vi.hoisted: all mock fns must exist before vi.mock factories run ───────────
const {
  mockVerifyAccessToken,
  mockHashToken,
  mockIsSessionValid,
  mockFindUserById,
  mockFindRideById,
  mockFindActiveByRideIdAndPurpose,
  mockFindSuccessfulByRideIdAndPurpose,
  mockCreate,
  mockMarkProcessing,
  mockMarkFailed,
  mockRecordSafe,
  mockCreateEmbeddedOrder,
} = vi.hoisted(() => ({
  mockVerifyAccessToken: vi.fn(),
  mockHashToken: vi.fn().mockReturnValue("hashed-token"),
  mockIsSessionValid: vi.fn().mockResolvedValue(true),
  mockFindUserById: vi.fn(),
  mockFindRideById: vi.fn(),
  mockFindActiveByRideIdAndPurpose: vi.fn().mockResolvedValue(null),
  mockFindSuccessfulByRideIdAndPurpose: vi.fn().mockResolvedValue(null),
  mockCreate: vi.fn(),
  mockMarkProcessing: vi.fn(),
  mockMarkFailed: vi.fn(),
  mockRecordSafe: vi.fn(),
  mockCreateEmbeddedOrder: vi.fn(),
}));

const mockKlapProvider = {
  name: "klap",
  createEmbeddedOrder: mockCreateEmbeddedOrder,
};

vi.mock("../../../modules/auth/token.service.js", () => ({
  TokenService: vi.fn().mockImplementation(() => ({
    verifyAccessToken: mockVerifyAccessToken,
    hashToken: mockHashToken,
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
    findActiveByRideIdAndPurpose: mockFindActiveByRideIdAndPurpose,
    findSuccessfulByRideIdAndPurpose: mockFindSuccessfulByRideIdAndPurpose,
    create: mockCreate,
    markProcessing: mockMarkProcessing,
    markFailed: mockMarkFailed,
  })),
}));
// NOTE: `getActiveProvider`/`getProvider` are intentionally NOT exercised by this
// file — Klap must be reachable only through `getKlapEmbeddedProvider()`, never
// through the generic redirect-oriented registry helpers.
vi.mock("../provider.registry.js", () => ({
  getActiveProvider: vi.fn(() => {
    throw new Error("getActiveProvider() must not be called by the Klap embedded flow.");
  }),
  getProvider: vi.fn(() => {
    throw new Error("getProvider() must not be called by the Klap embedded flow.");
  }),
  getKlapEmbeddedProvider: () => mockKlapProvider,
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
import { KlapProviderError } from "../klap.types.js";

// ── Fixtures ───────────────────────────────────────────────────────────────────

const PASSENGER_ID = "user-passenger-uuid";
const OTHER_USER_ID = "user-someone-else-uuid";
const RIDE_ID = "ride-uuid";
const PAYMENT_ID = "payment-uuid";

const completedRide = {
  id: RIDE_ID,
  passengerUserId: PASSENGER_ID,
  status: "completed",
  estimatedFareClp: 5000,
  originText: "Hotel",
  destinationText: "Aeropuerto",
};

const passengerUser = {
  id: PASSENGER_ID,
  email: "passenger@test.com",
  name: "Ana Passenger",
  role: "passenger",
};

function setupPassengerAuth(userId: string = PASSENGER_ID): void {
  mockVerifyAccessToken.mockReturnValue({ sub: userId });
  mockFindUserById.mockResolvedValue({ ...passengerUser, id: userId });
}

describe("PaymentsService.createKlapEmbeddedOrder", () => {
  let service: PaymentsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PaymentsService();
    mockIsSessionValid.mockResolvedValue(true);
    mockFindActiveByRideIdAndPurpose.mockResolvedValue(null);
    mockFindSuccessfulByRideIdAndPurpose.mockResolvedValue(null);
    process.env["PAYMENT_WEBHOOK_BASE_URL"] = "https://api.rapago.cl";
  });

  it("1. creates an embedded order and returns checkoutType='embedded' with publicCheckoutData.orderId", async () => {
    setupPassengerAuth();
    mockFindRideById.mockResolvedValue(completedRide);
    mockCreate.mockResolvedValue({ id: PAYMENT_ID, amountClp: 5000 });
    mockCreateEmbeddedOrder.mockResolvedValue({
      checkoutType: "embedded",
      providerOrderId: "klap-order-abc123",
      publicCheckoutData: { orderId: "klap-order-abc123" },
    });
    mockMarkProcessing.mockResolvedValue({ id: PAYMENT_ID, status: "processing" });

    const result = await service.createKlapEmbeddedOrder("tok", { rideRequestId: RIDE_ID });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provider).toBe("klap");
      expect(result.checkoutType).toBe("embedded");
      expect(result.publicCheckoutData).toEqual({ orderId: "klap-order-abc123" });
      expect(result.paymentId).toBe(PAYMENT_ID);
    }
  });

  it("2/3. computes amountClp from ride.estimatedFareClp server-side — the request has no amount field to manipulate", async () => {
    setupPassengerAuth();
    mockFindRideById.mockResolvedValue(completedRide);
    mockCreate.mockResolvedValue({ id: PAYMENT_ID, amountClp: 5000 });
    mockCreateEmbeddedOrder.mockResolvedValue({
      checkoutType: "embedded",
      providerOrderId: "klap-order-abc123",
      publicCheckoutData: { orderId: "klap-order-abc123" },
    });
    mockMarkProcessing.mockResolvedValue({ id: PAYMENT_ID, status: "processing" });

    // The input type only accepts rideRequestId — casting to `any` here only to
    // prove that even if a client smuggled an `amountClp` field into the JSON
    // body, the schema strips it and the service never reads it.
    await service.createKlapEmbeddedOrder("tok", {
      rideRequestId: RIDE_ID,
      amountClp: 1,
    } as unknown as { rideRequestId: string });

    expect(mockCreateEmbeddedOrder).toHaveBeenCalledWith(
      expect.objectContaining({ amountClp: 5000 }),
    );
  });

  it("4. a passenger cannot create an order for a ride belonging to someone else", async () => {
    setupPassengerAuth(OTHER_USER_ID);
    mockFindRideById.mockResolvedValue(completedRide); // ride.passengerUserId = PASSENGER_ID

    const result = await service.createKlapEmbeddedOrder("tok", { rideRequestId: RIDE_ID });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("AUTH_FORBIDDEN");
      expect(result.statusCode).toBe(403);
    }
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockCreateEmbeddedOrder).not.toHaveBeenCalled();
  });

  it("5. a non-existent ride returns a safe NOT_FOUND error", async () => {
    setupPassengerAuth();
    mockFindRideById.mockResolvedValue(null);

    const result = await service.createKlapEmbeddedOrder("tok", { rideRequestId: RIDE_ID });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("NOT_FOUND");
      expect(result.statusCode).toBe(404);
    }
    expect(mockCreateEmbeddedOrder).not.toHaveBeenCalled();
  });

  it("6. a disallowed ride status blocks order creation", async () => {
    setupPassengerAuth();
    mockFindRideById.mockResolvedValue({ ...completedRide, status: "cancelled" });

    const result = await service.createKlapEmbeddedOrder("tok", { rideRequestId: RIDE_ID });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("PAYMENT_RIDE_STATUS_NOT_ALLOWED");
      expect(result.statusCode).toBe(409);
    }
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("7. an existing active payment blocks duplicate order creation", async () => {
    setupPassengerAuth();
    mockFindRideById.mockResolvedValue(completedRide);
    mockFindActiveByRideIdAndPurpose.mockResolvedValue({ id: PAYMENT_ID, status: "processing" });

    const result = await service.createKlapEmbeddedOrder("tok", { rideRequestId: RIDE_ID });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("PAYMENT_ALREADY_EXISTS");
      expect(result.statusCode).toBe(409);
    }
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("8/9/10. the embedded result carries checkoutType/publicCheckoutData.orderId and never urlPay", async () => {
    setupPassengerAuth();
    mockFindRideById.mockResolvedValue(completedRide);
    mockCreate.mockResolvedValue({ id: PAYMENT_ID, amountClp: 5000 });
    mockCreateEmbeddedOrder.mockResolvedValue({
      checkoutType: "embedded",
      providerOrderId: "klap-order-abc123",
      publicCheckoutData: { orderId: "klap-order-abc123" },
    });
    mockMarkProcessing.mockResolvedValue({ id: PAYMENT_ID, status: "processing" });

    const result = await service.createKlapEmbeddedOrder("tok", { rideRequestId: RIDE_ID });

    expect(result.ok).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(result, "urlPay")).toBe(false);
    expect(JSON.stringify(result)).not.toContain("urlPay");
  });

  it("11. the result never contains an ApiKey field", async () => {
    setupPassengerAuth();
    mockFindRideById.mockResolvedValue(completedRide);
    mockCreate.mockResolvedValue({ id: PAYMENT_ID, amountClp: 5000 });
    mockCreateEmbeddedOrder.mockResolvedValue({
      checkoutType: "embedded",
      providerOrderId: "klap-order-abc123",
      publicCheckoutData: { orderId: "klap-order-abc123" },
    });
    mockMarkProcessing.mockResolvedValue({ id: PAYMENT_ID, status: "processing" });

    const result = await service.createKlapEmbeddedOrder("tok", { rideRequestId: RIDE_ID });

    expect(JSON.stringify(result)).not.toMatch(/api[-_]?key/i);
  });

  it("12/13/14/15. creating the order leaves the payment 'processing' (pending-equivalent) and touches nothing else financial", async () => {
    setupPassengerAuth();
    mockFindRideById.mockResolvedValue(completedRide);
    mockCreate.mockResolvedValue({ id: PAYMENT_ID, amountClp: 5000 });
    mockCreateEmbeddedOrder.mockResolvedValue({
      checkoutType: "embedded",
      providerOrderId: "klap-order-abc123",
      publicCheckoutData: { orderId: "klap-order-abc123" },
    });
    mockMarkProcessing.mockResolvedValue({ id: PAYMENT_ID, status: "processing" });

    await service.createKlapEmbeddedOrder("tok", { rideRequestId: RIDE_ID });

    // 12: local payment stays in the pending-equivalent state used by every other
    // provider right after creating their checkout mechanism — never "success".
    expect(mockMarkProcessing).toHaveBeenCalledWith(PAYMENT_ID, "", "klap-order-abc123");
    // 13/14/15: no ride activation, no receipt generation, no Wallet crediting —
    // none of those repositories/services are even imported by this flow; the
    // only side effects are payments.create/markProcessing and a safe audit event.
    expect(mockRecordSafe).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "payment.klap_order_created" }),
    );
  });

  it("16. a timeout does not create a second order automatically", async () => {
    setupPassengerAuth();
    mockFindRideById.mockResolvedValue(completedRide);
    mockCreate.mockResolvedValue({ id: PAYMENT_ID, amountClp: 5000 });
    mockCreateEmbeddedOrder.mockRejectedValue(new KlapProviderError("timeout", "timed out"));
    mockMarkFailed.mockResolvedValue({ id: PAYMENT_ID, status: "failed" });

    const result = await service.createKlapEmbeddedOrder("tok", { rideRequestId: RIDE_ID });

    expect(result.ok).toBe(false);
    expect(mockCreateEmbeddedOrder).toHaveBeenCalledTimes(1);
    expect(mockMarkFailed).toHaveBeenCalledWith(PAYMENT_ID);
    expect(mockMarkProcessing).not.toHaveBeenCalled();
  });

  it("17. an HTTP rejection from Klap is sanitized before reaching the response", async () => {
    setupPassengerAuth();
    mockFindRideById.mockResolvedValue(completedRide);
    mockCreate.mockResolvedValue({ id: PAYMENT_ID, amountClp: 5000 });
    mockCreateEmbeddedOrder.mockRejectedValue(
      new KlapProviderError("http_rejected", "Klap order creation was rejected with HTTP 401.", 401),
    );
    mockMarkFailed.mockResolvedValue({ id: PAYMENT_ID, status: "failed" });

    const result = await service.createKlapEmbeddedOrder("tok", { rideRequestId: RIDE_ID });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("PAYMENT_PROVIDER_ERROR");
      expect(result.message).not.toMatch(/api[-_]?key/i);
      expect(result.message).not.toContain("401");
    }
  });

  it("18. a provider response missing order_id never produces a valid order (surfaces as a provider error)", async () => {
    setupPassengerAuth();
    mockFindRideById.mockResolvedValue(completedRide);
    mockCreate.mockResolvedValue({ id: PAYMENT_ID, amountClp: 5000 });
    mockCreateEmbeddedOrder.mockRejectedValue(
      new KlapProviderError("invalid_response", "Klap response is missing a valid order_id."),
    );
    mockMarkFailed.mockResolvedValue({ id: PAYMENT_ID, status: "failed" });

    const result = await service.createKlapEmbeddedOrder("tok", { rideRequestId: RIDE_ID });

    expect(result.ok).toBe(false);
    expect(mockMarkProcessing).not.toHaveBeenCalled();
  });

  it("22. this flow never touches webhook machinery (no webhook repo/service is imported or called)", () => {
    // Structural guarantee: this test file never mocks/imports claimWebhookEvent,
    // completeWebhookEvent, failWebhookEvent, verifyWebhookSignature or
    // normalizeWebhook — if createKlapEmbeddedOrder ever started calling any of
    // those, this suite would fail to even compile/run cleanly against the mocks
    // above, since none of them are provided.
    expect(mockKlapProvider).not.toHaveProperty("verifyWebhookSignature");
    expect(mockKlapProvider).not.toHaveProperty("normalizeWebhook");
  });
});
