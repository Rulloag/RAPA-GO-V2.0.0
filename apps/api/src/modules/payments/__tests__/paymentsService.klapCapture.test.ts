import { describe, it, expect, vi, beforeEach } from "vitest";

// ── vi.hoisted: all mock fns must exist before vi.mock factories run ───────────
const {
  mockFindById,
  mockFindRefundableByRideId,
  mockFindActiveByRideIdAndPurpose,
  mockClaimCapture,
  mockMarkCapturedSuccess,
  mockMarkCaptureUnknown,
  mockMarkCaptureFailed,
  mockRecordSafe,
  mockCaptureOrder,
  mockClaimRefund,
  mockMarkRefunded,
  mockMarkRefundFailed,
  mockGetOrder,
  mockRefundOrder,
} = vi.hoisted(() => ({
  mockFindById: vi.fn(),
  mockFindRefundableByRideId: vi.fn(),
  mockFindActiveByRideIdAndPurpose: vi.fn(),
  mockClaimCapture: vi.fn(),
  mockMarkCapturedSuccess: vi.fn(),
  mockMarkCaptureUnknown: vi.fn(),
  mockMarkCaptureFailed: vi.fn(),
  mockRecordSafe: vi.fn(),
  mockCaptureOrder: vi.fn(),
  mockClaimRefund: vi.fn(),
  mockMarkRefunded: vi.fn(),
  mockMarkRefundFailed: vi.fn(),
  mockGetOrder: vi.fn(),
  mockRefundOrder: vi.fn(),
}));

vi.mock("../payments.repository.js", () => ({
  PaymentsRepository: vi.fn().mockImplementation(() => ({
    findById: mockFindById,
    findRefundableByRideId: mockFindRefundableByRideId,
    findActiveByRideIdAndPurpose: mockFindActiveByRideIdAndPurpose,
    claimCapture: mockClaimCapture,
    markCapturedSuccess: mockMarkCapturedSuccess,
    markCaptureUnknown: mockMarkCaptureUnknown,
    markCaptureFailed: mockMarkCaptureFailed,
    claimRefund: mockClaimRefund,
    markRefunded: mockMarkRefunded,
    markRefundFailed: mockMarkRefundFailed,
  })),
}));
vi.mock("../../../modules/audit/audit.service.js", () => ({
  AuditService: vi.fn().mockImplementation(() => ({ recordSafe: mockRecordSafe })),
}));

// These tests exercise payment/Klap behavior only. Keep auth repositories fully
// isolated so importing PaymentsService never requires DATABASE_URL.
vi.mock("../../../modules/auth/token.service.js", () => ({
  TokenService: vi.fn().mockImplementation(() => ({
    verifyAccessToken: vi.fn(),
    hashToken: vi.fn().mockReturnValue("test-hash"),
  })),
}));
vi.mock("../../../modules/auth/session.service.js", () => ({
  SessionService: vi.fn().mockImplementation(() => ({
    isSessionValid: vi.fn().mockResolvedValue(true),
  })),
}));
vi.mock("../../../modules/users/users.repository.js", () => ({
  UsersRepository: vi.fn().mockImplementation(() => ({
    findById: vi.fn(),
  })),
}));
vi.mock("../provider.registry.js", () => ({
  getKlapProvider: () => ({
    captureOrder: mockCaptureOrder,
    getOrder: mockGetOrder,
    refundOrder: mockRefundOrder,
  }),
}));

import { PaymentsService } from "../payments.service.js";
import { KlapProviderError } from "../klap.types.js";

const PAYMENT_ID = "payment-uuid";
const ORDER_ID = "klap-order-abc123";
const RIDE_ID = "ride-uuid";

function paymentFixture(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: PAYMENT_ID,
    provider: "klap",
    providerOrderId: ORDER_ID,
    status: "authorized",
    amountClp: 5000,
    authorizedAmountClp: 5000,
    passengerUserId: "passenger-uuid",
    rideRequestId: RIDE_ID,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env["KLAP_DEFERRED_CAPTURE_ENABLED"] = "true";
  process.env["KLAP_CAPTURE_CONTRACT_CONFIRMED"] = "true";
  process.env["KLAP_CAPTURE_DISCOVERY_MODE"] = "false";
  mockFindRefundableByRideId.mockResolvedValue(null);
  mockFindActiveByRideIdAndPurpose.mockResolvedValue(null);
});

describe("PaymentsService.captureAuthorizedKlapPayment", () => {
  let service: PaymentsService;

  beforeEach(() => {
    service = new PaymentsService();
  });

  it("returns NOT_FOUND for a missing payment", async () => {
    mockFindById.mockResolvedValue(null);
    const result = await service.captureAuthorizedKlapPayment(PAYMENT_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_FOUND");
    expect(mockClaimCapture).not.toHaveBeenCalled();
  });

  it("rejects a non-Klap payment (never captures a Mercado Pago / ProntoPaga payment)", async () => {
    mockFindById.mockResolvedValue(paymentFixture({ provider: "mercadopago" }));
    const result = await service.captureAuthorizedKlapPayment(PAYMENT_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("PAYMENT_PROVIDER_MISMATCH");
    expect(mockClaimCapture).not.toHaveBeenCalled();
  });

  it("is idempotent for an already-success payment: no new call to Klap", async () => {
    mockFindById.mockResolvedValue(paymentFixture({ status: "success" }));
    const result = await service.captureAuthorizedKlapPayment(PAYMENT_ID);
    expect(result).toEqual({ ok: true, status: "success" });
    expect(mockClaimCapture).not.toHaveBeenCalled();
    expect(mockCaptureOrder).not.toHaveBeenCalled();
  });

  it.each(["capture_pending", "capture_unknown", "capture_failed"])(
    "does not send a second capture while status is %s",
    async (status) => {
      mockFindById.mockResolvedValue(paymentFixture({ status }));
      const result = await service.captureAuthorizedKlapPayment(PAYMENT_ID);
      expect(result).toEqual({ ok: true, status });
      expect(mockClaimCapture).not.toHaveBeenCalled();
      expect(mockCaptureOrder).not.toHaveBeenCalled();
    },
  );

  it("rejects a payment that was never authorized (pending/processing)", async () => {
    mockFindById.mockResolvedValue(paymentFixture({ status: "pending" }));
    const result = await service.captureAuthorizedKlapPayment(PAYMENT_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("PAYMENT_NOT_AUTHORIZED");
    expect(mockClaimCapture).not.toHaveBeenCalled();
  });

  it("rejects when the Klap order id is missing", async () => {
    mockFindById.mockResolvedValue(paymentFixture({ providerOrderId: null }));
    const result = await service.captureAuthorizedKlapPayment(PAYMENT_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("KLAP_ORDER_ID_MISSING");
    expect(mockClaimCapture).not.toHaveBeenCalled();
  });

  it("never sends a capture amount larger than what was authorized", async () => {
    mockFindById.mockResolvedValue(
      paymentFixture({ authorizedAmountClp: 0, amountClp: 5000 }),
    );
    const result = await service.captureAuthorizedKlapPayment(PAYMENT_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("PAYMENT_INVALID_AMOUNT");
    expect(mockCaptureOrder).not.toHaveBeenCalled();
  });

  it("two concurrent captures: only the caller that wins claimCapture calls Klap", async () => {
    mockFindById.mockResolvedValue(paymentFixture());
    // Simulates losing the atomic claim race — repository already flipped by
    // a concurrent call.
    mockClaimCapture.mockResolvedValue(null);
    const current = await paymentFixture({ status: "capture_pending" });
    mockFindById.mockResolvedValueOnce(paymentFixture()).mockResolvedValueOnce(current);

    const result = await service.captureAuthorizedKlapPayment(PAYMENT_ID);

    expect(mockCaptureOrder).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, status: "capture_pending" });
  });

  it("on a 2xx capture response: marks success, capturedAmountClp, capturedAt/paidAt via the repository", async () => {
    mockFindById.mockResolvedValue(paymentFixture());
    mockClaimCapture.mockResolvedValue(paymentFixture({ status: "capture_pending" }));
    mockCaptureOrder.mockResolvedValue({
      httpStatus: 200,
      sanitizedResponse: { status: "captured" },
      providerStatus: "captured",
      confirmedFinalState: true,
      discoveryMode: false,
    });

    const result = await service.captureAuthorizedKlapPayment(PAYMENT_ID);

    expect(mockCaptureOrder).toHaveBeenCalledWith({
      orderId: ORDER_ID,
      amountClp: 5000,
    });
    expect(mockMarkCapturedSuccess).toHaveBeenCalledWith({
      id: PAYMENT_ID,
      capturedAmountClp: 5000,
      providerPayload: { status: "captured" },
    });
    expect(result).toEqual({ ok: true, status: "success" });
    expect(mockRecordSafe).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "payment.klap_captured" }),
    );
  });


  it("CASO 1 V2: viaje completado puede capturar un monto final backend menor al autorizado", async () => {
    mockFindById.mockResolvedValue(
      paymentFixture({ amountClp: 5000, authorizedAmountClp: 5000 }),
    );
    mockClaimCapture.mockResolvedValue(
      paymentFixture({ status: "capture_pending" }),
    );
    mockCaptureOrder.mockResolvedValue({
      httpStatus: 200,
      sanitizedResponse: { status: "captured" },
      providerStatus: "captured",
      confirmedFinalState: true,
      discoveryMode: false,
    });

    const result = await service.captureAuthorizedKlapPayment(PAYMENT_ID, {
      outcome: "completed",
      finalRideAmountClp: 3500,
    });

    expect(mockCaptureOrder).toHaveBeenCalledWith({
      orderId: ORDER_ID,
      amountClp: 3500,
    });
    expect(mockMarkCapturedSuccess).toHaveBeenCalledWith({
      id: PAYMENT_ID,
      capturedAmountClp: 3500,
      providerPayload: { status: "captured" },
    });
    expect(result).toEqual({ ok: true, status: "success" });
  });

  it("CASO 2 V2: cancelacion sin cobro nunca envia CAPTURE por cero", async () => {
    mockFindById.mockResolvedValue(paymentFixture());

    const result = await service.captureAuthorizedKlapPayment(PAYMENT_ID, {
      outcome: "cancelled",
      cancellationFeeClp: 0,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("KLAP_VOID_REQUIRED");
    expect(mockClaimCapture).not.toHaveBeenCalled();
    expect(mockCaptureOrder).not.toHaveBeenCalled();
    expect(mockRecordSafe).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "payment.klap_void_required" }),
    );
  });

  it("CASO 3 V2: cancelacion con multa captura solo la multa backend", async () => {
    mockFindById.mockResolvedValue(paymentFixture());
    mockClaimCapture.mockResolvedValue(
      paymentFixture({ status: "capture_pending" }),
    );
    mockCaptureOrder.mockResolvedValue({
      httpStatus: 200,
      sanitizedResponse: { status: "captured" },
      providerStatus: "captured",
      confirmedFinalState: true,
      discoveryMode: false,
    });

    const result = await service.captureAuthorizedKlapPayment(PAYMENT_ID, {
      outcome: "cancelled",
      cancellationFeeClp: 3000,
    });

    expect(mockCaptureOrder).toHaveBeenCalledWith({
      orderId: ORDER_ID,
      amountClp: 3000,
    });
    expect(mockMarkCapturedSuccess).toHaveBeenCalledWith({
      id: PAYMENT_ID,
      capturedAmountClp: 3000,
      providerPayload: { status: "captured" },
    });
    expect(result).toEqual({ ok: true, status: "success" });
  });

  it("CASO 4 V2.2: NO SHOW captura solo el cargo backend", async () => {
    mockFindById.mockResolvedValue(
      paymentFixture({ amountClp: 12000, authorizedAmountClp: 12000 }),
    );
    mockClaimCapture.mockResolvedValue(
      paymentFixture({ status: "capture_pending", amountClp: 12000, authorizedAmountClp: 12000 }),
    );
    mockCaptureOrder.mockResolvedValue({
      httpStatus: 200,
      sanitizedResponse: { status: "captured" },
      providerStatus: "captured",
      confirmedFinalState: true,
      discoveryMode: false,
    });

    const result = await service.captureAuthorizedKlapPayment(PAYMENT_ID, {
      outcome: "no_show",
      noShowFeeClp: 5000,
    });

    expect(mockCaptureOrder).toHaveBeenCalledWith({
      orderId: ORDER_ID,
      amountClp: 5000,
    });
    expect(mockMarkCapturedSuccess).toHaveBeenCalledWith({
      id: PAYMENT_ID,
      capturedAmountClp: 5000,
      providerPayload: { status: "captured" },
    });
    expect(result).toEqual({ ok: true, status: "success" });
  });

  it("CASO 5 V2.2: autorizacion marcada expirada nunca intenta CAPTURE", async () => {
    mockFindById.mockResolvedValue(paymentFixture());

    const result = await service.captureAuthorizedKlapPayment(PAYMENT_ID, {
      outcome: "completed",
      finalRideAmountClp: 5000,
      authorizationExpired: true,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("KLAP_AUTHORIZATION_EXPIRED");
    expect(mockClaimCapture).not.toHaveBeenCalled();
    expect(mockCaptureOrder).not.toHaveBeenCalled();
  });

  it("V2 fail-closed: monto final backend superior a la autorizacion nunca captura", async () => {
    mockFindById.mockResolvedValue(paymentFixture());

    const result = await service.captureAuthorizedKlapPayment(PAYMENT_ID, {
      outcome: "completed",
      finalRideAmountClp: 5500,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("KLAP_FINANCIAL_MANUAL_REVIEW");
    expect(mockClaimCapture).not.toHaveBeenCalled();
    expect(mockCaptureOrder).not.toHaveBeenCalled();
  });

  it("V3 production discovery observa respuesta real pero nunca marca success", async () => {
    process.env["KLAP_CAPTURE_CONTRACT_CONFIRMED"] = "false";
    process.env["KLAP_CAPTURE_DISCOVERY_MODE"] = "true";

    mockFindById.mockResolvedValue(paymentFixture());
    mockClaimCapture.mockResolvedValue(
      paymentFixture({ status: "capture_pending" }),
    );
    mockCaptureOrder.mockResolvedValue({
      httpStatus: 200,
      sanitizedResponse: {
        status: "captured-live",
        transaction_id: "tx-redacted",
      },
      providerStatus: "captured-live",
      confirmedFinalState: false,
      discoveryMode: true,
    });

    const result = await service.captureAuthorizedKlapPayment(PAYMENT_ID, {
      outcome: "completed",
      finalRideAmountClp: 5000,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("CAPTURE_CONTRACT_OBSERVED");
    expect(mockMarkCapturedSuccess).not.toHaveBeenCalled();
    expect(mockMarkCaptureUnknown).toHaveBeenCalledOnce();
    expect(mockCaptureOrder).toHaveBeenCalledOnce();
    expect(mockRecordSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "payment.klap_capture_contract_observed",
      }),
    );
  });

  it("V3 discovery bloquea una captura parcial incluso si el viaje termino", async () => {
    process.env["KLAP_CAPTURE_CONTRACT_CONFIRMED"] = "false";
    process.env["KLAP_CAPTURE_DISCOVERY_MODE"] = "true";
    mockFindById.mockResolvedValue(paymentFixture());

    const result = await service.captureAuthorizedKlapPayment(PAYMENT_ID, {
      outcome: "completed",
      finalRideAmountClp: 3500,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("KLAP_CAPTURE_DISCOVERY_FULL_AMOUNT_ONLY");
    }
    expect(mockClaimCapture).not.toHaveBeenCalled();
    expect(mockCaptureOrder).not.toHaveBeenCalled();
  });

  it("V3 discovery nunca prueba captura parcial de cancelacion o NO SHOW", async () => {
    process.env["KLAP_CAPTURE_CONTRACT_CONFIRMED"] = "false";
    process.env["KLAP_CAPTURE_DISCOVERY_MODE"] = "true";
    mockFindById.mockResolvedValue(paymentFixture());

    const cancelResult = await service.captureAuthorizedKlapPayment(PAYMENT_ID, {
      outcome: "cancelled",
      cancellationFeeClp: 3000,
    });
    expect(cancelResult.ok).toBe(false);
    if (!cancelResult.ok) {
      expect(cancelResult.code).toBe("KLAP_CAPTURE_DISCOVERY_COMPLETED_ONLY");
    }

    const noShowResult = await service.captureAuthorizedKlapPayment(PAYMENT_ID, {
      outcome: "no_show",
      noShowFeeClp: 3000,
    });
    expect(noShowResult.ok).toBe(false);
    if (!noShowResult.ok) {
      expect(noShowResult.code).toBe("KLAP_CAPTURE_DISCOVERY_COMPLETED_ONLY");
    }

    expect(mockClaimCapture).not.toHaveBeenCalled();
    expect(mockCaptureOrder).not.toHaveBeenCalled();
  });

  it("timeout classifies as capture_unknown, never auto-retried, never marked as definitively failed", async () => {
    mockFindById.mockResolvedValue(paymentFixture());
    mockClaimCapture.mockResolvedValue(paymentFixture({ status: "capture_pending" }));
    mockCaptureOrder.mockRejectedValue(new KlapProviderError("timeout", "timed out"));

    const result = await service.captureAuthorizedKlapPayment(PAYMENT_ID);

    expect(mockMarkCaptureUnknown).toHaveBeenCalledOnce();
    expect(mockMarkCaptureFailed).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("CAPTURE_UNKNOWN");
    expect(mockCaptureOrder).toHaveBeenCalledOnce();
  });

  it("network error classifies as capture_unknown", async () => {
    mockFindById.mockResolvedValue(paymentFixture());
    mockClaimCapture.mockResolvedValue(paymentFixture({ status: "capture_pending" }));
    mockCaptureOrder.mockRejectedValue(new KlapProviderError("network", "network down"));

    const result = await service.captureAuthorizedKlapPayment(PAYMENT_ID);

    expect(mockMarkCaptureUnknown).toHaveBeenCalledOnce();
    expect(mockMarkCaptureFailed).not.toHaveBeenCalled();
    if (!result.ok) expect(result.code).toBe("CAPTURE_UNKNOWN");
  });

  it("HTTP 5xx classifies as capture_unknown, not capture_failed", async () => {
    mockFindById.mockResolvedValue(paymentFixture());
    mockClaimCapture.mockResolvedValue(paymentFixture({ status: "capture_pending" }));
    mockCaptureOrder.mockRejectedValue(
      new KlapProviderError("http_rejected", "server error", 500),
    );

    const result = await service.captureAuthorizedKlapPayment(PAYMENT_ID);

    expect(mockMarkCaptureUnknown).toHaveBeenCalledOnce();
    expect(mockMarkCaptureFailed).not.toHaveBeenCalled();
    if (!result.ok) expect(result.code).toBe("CAPTURE_UNKNOWN");
  });

  it("HTTP 400-499 classifies as capture_failed with a sanitized reason", async () => {
    mockFindById.mockResolvedValue(paymentFixture());
    mockClaimCapture.mockResolvedValue(paymentFixture({ status: "capture_pending" }));
    mockCaptureOrder.mockRejectedValue(
      new KlapProviderError("http_rejected", "declined", 400),
    );

    const result = await service.captureAuthorizedKlapPayment(PAYMENT_ID);

    expect(mockMarkCaptureFailed).toHaveBeenCalledOnce();
    expect(mockMarkCaptureUnknown).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("CAPTURE_FAILED");
    expect(mockRecordSafe).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "payment.klap_capture_failed" }),
    );
  });
  it.each([408, 409, 425, 429])(
    "HTTP %s remains capture_unknown and is never treated as a definitive rejection",
    async (statusCode) => {
      mockFindById.mockResolvedValue(paymentFixture());
      mockClaimCapture.mockResolvedValue(
        paymentFixture({ status: "capture_pending" }),
      );
      mockCaptureOrder.mockRejectedValue(
        new KlapProviderError("http_rejected", "uncertain response", statusCode),
      );

      const result = await service.captureAuthorizedKlapPayment(PAYMENT_ID);

      expect(mockMarkCaptureUnknown).toHaveBeenCalledOnce();
      expect(mockMarkCaptureFailed).not.toHaveBeenCalled();
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("CAPTURE_UNKNOWN");
    },
  );

  it("cancelacion gratis con autorizacion Klap libera la autorizacion sin CAPTURE 0", async () => {
    mockFindActiveByRideIdAndPurpose.mockResolvedValue(paymentFixture());
    mockFindById.mockResolvedValue(paymentFixture());

    mockClaimRefund.mockResolvedValue(
      paymentFixture({ refundStatus: "processing" }),
    );

    mockGetOrder.mockResolvedValue({
      order_id: ORDER_ID,
      reference_id: PAYMENT_ID,
      status: "authorized",
      amount: 5000,
      transaction_id: null,
      mc_code: null,
    });

    mockRefundOrder.mockResolvedValue({
      orderId: ORDER_ID,
      referenceId: PAYMENT_ID,
      status: "refund",
      amountClp: 5000,
      refundableAmountClp: 0,
    });

    const result = await service.refundCardPaymentForCancelledRide({
      rideRequestId: RIDE_ID,
      cancelledByUserId: "passenger-uuid",
      cancelledByRole: "passenger",
      cancellationFeeClp: 0,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.processed).toBe(true);
    expect(result.refunded).toBe(true);
    expect(result.remainderReleaseRequired).toBe(false);

    expect(mockCaptureOrder).not.toHaveBeenCalled();
    expect(mockClaimRefund).toHaveBeenCalledOnce();
    expect(mockGetOrder).toHaveBeenCalledWith(ORDER_ID);
    expect(mockRefundOrder).toHaveBeenCalledWith(ORDER_ID);
    expect(mockMarkRefunded).toHaveBeenCalledOnce();

    expect(mockRecordSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "payment.klap_authorization_released",
      }),
    );
  });

  it("cancelacion con multa usa solo la multa calculada por backend", async () => {
    mockFindActiveByRideIdAndPurpose.mockResolvedValue(paymentFixture());
    mockFindById.mockResolvedValue(paymentFixture());
    mockClaimCapture.mockResolvedValue(
      paymentFixture({ status: "capture_pending" }),
    );
    mockCaptureOrder.mockResolvedValue({
      httpStatus: 200,
      sanitizedResponse: { status: "captured" },
      providerStatus: "captured",
      confirmedFinalState: true,
      discoveryMode: false,
    });

    const result = await service.refundCardPaymentForCancelledRide({
      rideRequestId: RIDE_ID,
      cancelledByUserId: "passenger-uuid",
      cancelledByRole: "passenger",
      cancellationFeeClp: 3000,
    });

    expect(mockCaptureOrder).toHaveBeenCalledWith({
      orderId: ORDER_ID,
      amountClp: 3000,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.processed).toBe(true);
    expect(result.capturedCancellationFeeClp).toBe(3000);
    expect(result.remainderReleaseRequired).toBe(true);
  });

  it("cancelacion nunca reintenta si la captura Klap ya esta incierta", async () => {
    mockFindActiveByRideIdAndPurpose.mockResolvedValue(
      paymentFixture({ status: "capture_unknown" }),
    );

    const result = await service.refundCardPaymentForCancelledRide({
      rideRequestId: RIDE_ID,
      cancelledByUserId: "passenger-uuid",
      cancelledByRole: "passenger",
      cancellationFeeClp: 3000,
    });

    expect(result.ok).toBe(true);
    expect(mockCaptureOrder).not.toHaveBeenCalled();
  });

});
