import { describe, it, expect, vi, beforeEach } from "vitest";

// ── vi.hoisted: all mock fns must exist before vi.mock factories run ───────────
const { mockFindById, mockClaimCapture, mockMarkCapturedSuccess, mockMarkCaptureUnknown, mockMarkCaptureFailed, mockRecordSafe, mockCaptureOrder } =
  vi.hoisted(() => ({
    mockFindById: vi.fn(),
    mockClaimCapture: vi.fn(),
    mockMarkCapturedSuccess: vi.fn(),
    mockMarkCaptureUnknown: vi.fn(),
    mockMarkCaptureFailed: vi.fn(),
    mockRecordSafe: vi.fn(),
    mockCaptureOrder: vi.fn(),
  }));

vi.mock("../payments.repository.js", () => ({
  PaymentsRepository: vi.fn().mockImplementation(() => ({
    findById: mockFindById,
    claimCapture: mockClaimCapture,
    markCapturedSuccess: mockMarkCapturedSuccess,
    markCaptureUnknown: mockMarkCaptureUnknown,
    markCaptureFailed: mockMarkCaptureFailed,
  })),
}));
vi.mock("../../../modules/audit/audit.service.js", () => ({
  AuditService: vi.fn().mockImplementation(() => ({ recordSafe: mockRecordSafe })),
}));
vi.mock("../provider.registry.js", () => ({
  getKlapProvider: () => ({ captureOrder: mockCaptureOrder }),
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

});
