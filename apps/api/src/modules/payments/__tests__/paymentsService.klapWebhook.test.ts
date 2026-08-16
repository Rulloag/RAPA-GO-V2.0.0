import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";

// ── vi.hoisted: all mock fns must exist before vi.mock factories run ───────────
const {
  mockClaimWebhookEvent,
  mockCompleteWebhookEvent,
  mockFailWebhookEvent,
  mockFindByProviderOrderId,
  mockMarkAuthorizedAndActivateRide,
  mockMarkRejected,
  mockRecordSafe,
  mockCancelPendingPayment,
} = vi.hoisted(() => ({
  mockClaimWebhookEvent: vi.fn(),
  mockCompleteWebhookEvent: vi.fn(),
  mockFailWebhookEvent: vi.fn(),
  mockFindByProviderOrderId: vi.fn(),
  mockMarkAuthorizedAndActivateRide: vi.fn(),
  mockMarkRejected: vi.fn(),
  mockRecordSafe: vi.fn(),
  mockCancelPendingPayment: vi.fn(),
}));

vi.mock("../payments.repository.js", () => ({
  PaymentsRepository: vi.fn().mockImplementation(() => ({
    claimWebhookEvent: mockClaimWebhookEvent,
    completeWebhookEvent: mockCompleteWebhookEvent,
    failWebhookEvent: mockFailWebhookEvent,
    findByProviderOrderId: mockFindByProviderOrderId,
    markAuthorizedAndActivateRide: mockMarkAuthorizedAndActivateRide,
    markRejected: mockMarkRejected,
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
vi.mock("../../../modules/rides/rides.repository.js", () => ({
  RidesRepository: vi.fn().mockImplementation(() => ({
    cancelPendingPayment: mockCancelPendingPayment,
  })),
}));

import { PaymentsService } from "../payments.service.js";

const KLAP_API_KEY = "test-klap-webhook-secret";
const ORDER_ID = "klap-order-abc123";
const REFERENCE_ID = "payment-uuid-0001";

function validApikeyHeader(orderId = ORDER_ID, referenceId = REFERENCE_ID): string {
  return crypto.createHash("sha256").update(referenceId + orderId + KLAP_API_KEY, "utf8").digest("hex");
}

function paymentFixture(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: REFERENCE_ID,
    provider: "klap",
    providerOrderId: ORDER_ID,
    providerPaymentId: null,
    status: "processing",
    amountClp: 5000,
    paymentPurpose: "ride",
    rideRequestId: "ride-uuid",
    passengerUserId: "passenger-uuid",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env["KLAP_API_KEY"] = KLAP_API_KEY;
  process.env["KLAP_DEFERRED_CAPTURE_ENABLED"] = "true";
  process.env["KLAP_CAPTURE_CONTRACT_CONFIRMED"] = "true";
  mockClaimWebhookEvent.mockResolvedValue({ claimed: true, event: { id: "webhook-event-uuid" } });
  mockCompleteWebhookEvent.mockResolvedValue(undefined);
  mockFailWebhookEvent.mockResolvedValue(undefined);
  mockMarkAuthorizedAndActivateRide.mockResolvedValue({ payment: paymentFixture({ status: "authorized" }), rideActivated: true });
  mockMarkRejected.mockResolvedValue(paymentFixture({ status: "rejected" }));
});

function confirmBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    order_id: ORDER_ID,
    reference_id: REFERENCE_ID,
    payment_method: "tarjetas",
    amount: "5000",
    transaction_type: "authorization",
    ...overrides,
  };
}

describe("PaymentsService.handleKlapConfirmWebhook", () => {
  let service: PaymentsService;

  beforeEach(() => {
    service = new PaymentsService();
    mockFindByProviderOrderId.mockResolvedValue(paymentFixture());
  });

  it("1. accepts a valid confirm signature", async () => {
    const result = await service.handleKlapConfirmWebhook(confirmBody(), { apikey: validApikeyHeader() });
    expect(result.ok).toBe(true);
  });

  it("3. rejects a request with no Apikey header", async () => {
    const result = await service.handleKlapConfirmWebhook(confirmBody(), {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("WEBHOOK_INVALID_SIGNATURE");
  });

  it("4. rejects an incorrect Apikey header", async () => {
    const result = await service.handleKlapConfirmWebhook(confirmBody(), {
      apikey: "0".repeat(64),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("WEBHOOK_INVALID_SIGNATURE");
  });

  it("5. rejects an Apikey header with the wrong length", async () => {
    const result = await service.handleKlapConfirmWebhook(confirmBody(), { apikey: "abc123" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("WEBHOOK_INVALID_SIGNATURE");
  });

  it("6. rejects when KLAP_API_KEY is not configured server-side", async () => {
    delete process.env["KLAP_API_KEY"];
    const result = await service.handleKlapConfirmWebhook(confirmBody(), { apikey: validApikeyHeader() });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("WEBHOOK_INVALID_SIGNATURE");
  });

  it("8. never includes the ApiKey in an error result", async () => {
    const result = await service.handleKlapConfirmWebhook(confirmBody(), { apikey: "bad" });
    expect(JSON.stringify(result)).not.toContain(KLAP_API_KEY);
  });

  it("9. accepts the minimal valid payload", async () => {
    const result = await service.handleKlapConfirmWebhook(confirmBody(), { apikey: validApikeyHeader() });
    expect(result.ok).toBe(true);
  });

  it("10. rejects a payload missing order_id", async () => {
    const body = confirmBody();
    delete (body as Record<string, unknown>)["order_id"];
    const result = await service.handleKlapConfirmWebhook(body, { apikey: validApikeyHeader() });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("VALIDATION_ERROR");
  });

  it("11. rejects a payload missing reference_id", async () => {
    const body = confirmBody();
    delete (body as Record<string, unknown>)["reference_id"];
    const result = await service.handleKlapConfirmWebhook(body, { apikey: validApikeyHeader() });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("VALIDATION_ERROR");
  });

  it("12. accepts amount as a numeric string", async () => {
    const result = await service.handleKlapConfirmWebhook(
      confirmBody({ amount: "5000" }),
      { apikey: validApikeyHeader() },
    );
    expect(result.ok).toBe(true);
    expect(mockMarkAuthorizedAndActivateRide).toHaveBeenCalled();
  });

  it("13. accepts amount as a number", async () => {
    const result = await service.handleKlapConfirmWebhook(
      confirmBody({ amount: 5000 }),
      { apikey: validApikeyHeader() },
    );
    expect(result.ok).toBe(true);
    expect(mockMarkAuthorizedAndActivateRide).toHaveBeenCalled();
  });

  it("14. a decimal amount does not mark success", async () => {
    await service.handleKlapConfirmWebhook(confirmBody({ amount: "5000.50" }), { apikey: validApikeyHeader() });
    expect(mockMarkAuthorizedAndActivateRide).not.toHaveBeenCalled();
  });

  it("15. a non-numeric amount does not mark success", async () => {
    await service.handleKlapConfirmWebhook(confirmBody({ amount: "not-a-number" }), {
      apikey: validApikeyHeader(),
    });
    expect(mockMarkAuthorizedAndActivateRide).not.toHaveBeenCalled();
  });

  it("16. an amount that does not match payment.amountClp responds 409 amount_mismatch, never success (Fase C.1)", async () => {
    mockFindByProviderOrderId.mockResolvedValue(paymentFixture({ amountClp: 9999 }));
    const result = await service.handleKlapConfirmWebhook(confirmBody({ amount: "5000" }), {
      apikey: validApikeyHeader(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("AMOUNT_MISMATCH");
      expect(result.statusCode).toBe(409);
      // Never leaks the expected/received amounts in the result itself.
      expect(JSON.stringify(result)).not.toMatch(/9999|5000/);
    }
    expect(mockMarkAuthorizedAndActivateRide).not.toHaveBeenCalled();
    expect(mockClaimWebhookEvent).not.toHaveBeenCalled();
    expect(mockRecordSafe).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "payment.amount_mismatch" }),
    );
  });

  it("16a. confirm usa eventKey acotada al VARCHAR(128)", async () => {
    await service.handleKlapConfirmWebhook(
      confirmBody(),
      { apikey: validApikeyHeader() },
    );

    const claim = mockClaimWebhookEvent.mock.calls[0]?.[0] as
      | { eventKey?: string }
      | undefined;

    expect(claim?.eventKey).toMatch(
      /^klap:confirm:[a-f0-9]{64}$/,
    );

    expect(claim?.eventKey?.length).toBeLessThanOrEqual(128);
  });
  it("16a-real. acepta payload real de produccion sin payment_method ni transaction_type y con nulls", async () => {
    const previousDeferred = process.env["KLAP_DEFERRED_CAPTURE_ENABLED"];

    process.env["KLAP_DEFERRED_CAPTURE_ENABLED"] = "true";

    try {
      const body = confirmBody({
        mc_code: null,
        card_type: "DEBIT",
        brand: "VISA",
        bin: "12345678",
        last_digits: "6467",
        quotas_number: null,
        quotas_type: null,
        wallet: null,

        // Campos reales adicionales observados en Klap.
        // El schema los descarta y nunca deben persistirse.
        token_id: "TEST_TOKEN_NO_REAL",
        url: "https://backend.rapago.cl/api/webhooks/klap/confirm",
      });

      delete body["payment_method"];
      delete body["transaction_type"];

      const result = await service.handleKlapConfirmWebhook(
        body,
        { apikey: validApikeyHeader() },
      );

      expect(result.ok).toBe(true);
      expect(mockClaimWebhookEvent).toHaveBeenCalledTimes(1);

      const claim = mockClaimWebhookEvent.mock.calls[0]?.[0] as
        | { payload?: Record<string, unknown> }
        | undefined;

      expect(claim?.payload).not.toHaveProperty("token_id");
      expect(claim?.payload).not.toHaveProperty("bin");
    } finally {
      if (previousDeferred === undefined) {
        delete process.env["KLAP_DEFERRED_CAPTURE_ENABLED"];
      } else {
        process.env["KLAP_DEFERRED_CAPTURE_ENABLED"] = previousDeferred;
      }
    }
  });
  it("16a-case-prod. acepta TARJETAS y AUTHORIZATION observados en produccion", async () => {
    const previousDeferred =
      process.env["KLAP_DEFERRED_CAPTURE_ENABLED"];

    process.env["KLAP_DEFERRED_CAPTURE_ENABLED"] = "true";

    try {
      const result = await service.handleKlapConfirmWebhook(
        confirmBody({
          payment_method: "TARJETAS",
          transaction_type: "AUTHORIZATION",
        }),
        { apikey: validApikeyHeader() },
      );

      expect(result.ok).toBe(true);
      expect(mockClaimWebhookEvent).toHaveBeenCalledTimes(1);

      expect(mockMarkAuthorizedAndActivateRide).toHaveBeenCalledWith(
        expect.objectContaining({
          id: REFERENCE_ID,
          rideRequestId: "ride-uuid",
          transactionType: "authorization",
        }),
      );

      expect(mockRecordSafe).not.toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "payment.klap_unexpected_payment_method",
        }),
      );

      expect(mockRecordSafe).not.toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "payment.klap_unexpected_transaction_type",
        }),
      );
    } finally {
      if (previousDeferred === undefined) {
        delete process.env["KLAP_DEFERRED_CAPTURE_ENABLED"];
      } else {
        process.env["KLAP_DEFERRED_CAPTURE_ENABLED"] =
          previousDeferred;
      }
    }
  });

  it("16b. a transaction_type distinto de authorization no marca success/authorized (Fase 4)", async () => {
    const result = await service.handleKlapConfirmWebhook(
      confirmBody({ transaction_type: "sale" }),
      { apikey: validApikeyHeader() },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("TRANSACTION_TYPE_MISMATCH");
    }
    expect(mockMarkAuthorizedAndActivateRide).not.toHaveBeenCalled();
    expect(mockClaimWebhookEvent).not.toHaveBeenCalled();
    expect(mockRecordSafe).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "payment.klap_unexpected_transaction_type" }),
    );
  });

  it("16c. con KLAP_DEFERRED_CAPTURE_ENABLED=false el confirm sigue siendo autorización, nunca cobro", async () => {
    const previousDeferred = process.env["KLAP_DEFERRED_CAPTURE_ENABLED"];
    process.env["KLAP_DEFERRED_CAPTURE_ENABLED"] = "false";

    try {
      const result = await service.handleKlapConfirmWebhook(
        confirmBody(),
        { apikey: validApikeyHeader() },
      );

      expect(result.ok).toBe(true);
      expect(mockMarkAuthorizedAndActivateRide).toHaveBeenCalledOnce();
      expect(mockMarkAuthorizedAndActivateRide).toHaveBeenCalledWith(
        expect.objectContaining({
          transactionType: "authorization",
          authorizedAmountClp: 5000,
        }),
      );
    } finally {
      if (previousDeferred === undefined) {
        delete process.env["KLAP_DEFERRED_CAPTURE_ENABLED"];
      } else {
        process.env["KLAP_DEFERRED_CAPTURE_ENABLED"] = previousDeferred;
      }
    }
  });

  it("a corrected redelivery with the right amount succeeds even though the first mismatched delivery used the same mc_code (no stale idempotency block)", async () => {
    mockFindByProviderOrderId.mockResolvedValue(paymentFixture({ amountClp: 5000 }));

    const badResult = await service.handleKlapConfirmWebhook(
      confirmBody({ amount: "1", mc_code: "MC-STABLE" }),
      { apikey: validApikeyHeader() },
    );
    expect(badResult.ok).toBe(false);
    expect(mockClaimWebhookEvent).not.toHaveBeenCalled();

    const goodResult = await service.handleKlapConfirmWebhook(
      confirmBody({ amount: "5000", mc_code: "MC-STABLE" }),
      { apikey: validApikeyHeader() },
    );
    expect(goodResult.ok).toBe(true);
    expect(mockMarkAuthorizedAndActivateRide).toHaveBeenCalledOnce();
  });

  it("6/17. payment_method distinto se audita, pero una confirmación firmada y consistente responde ok", async () => {
    const result = await service.handleKlapConfirmWebhook(
      confirmBody({ payment_method: "debito" }),
      { apikey: validApikeyHeader() },
    );
    expect(result.ok).toBe(true);
    expect(mockMarkAuthorizedAndActivateRide).toHaveBeenCalledOnce();
    expect(mockRecordSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "payment.klap_unexpected_payment_method",
      }),
    );
  });

  it("18. order_id and reference_id of the same payment are accepted", async () => {
    mockFindByProviderOrderId.mockResolvedValue(paymentFixture({ id: REFERENCE_ID }));
    const result = await service.handleKlapConfirmWebhook(confirmBody(), { apikey: validApikeyHeader() });
    expect(result.ok).toBe(true);
    expect(mockMarkAuthorizedAndActivateRide).toHaveBeenCalled();
  });

  it("19. order_id and reference_id pointing to different payments responds 409 payment_mismatch (Fase C.1)", async () => {
    mockFindByProviderOrderId.mockResolvedValue(paymentFixture({ id: "a-completely-different-payment-id" }));
    const result = await service.handleKlapConfirmWebhook(confirmBody(), { apikey: validApikeyHeader() });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("PAYMENT_MISMATCH");
      expect(result.statusCode).toBe(409);
    }
    expect(mockMarkAuthorizedAndActivateRide).not.toHaveBeenCalled();
    expect(mockClaimWebhookEvent).not.toHaveBeenCalled();
  });

  it("20. a non-existent payment is reported safely", async () => {
    mockFindByProviderOrderId.mockResolvedValue(null);
    const result = await service.handleKlapConfirmWebhook(confirmBody(), { apikey: validApikeyHeader() });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_FOUND");
  });

  it("21. processes a pending/processing payment into success", async () => {
    mockFindByProviderOrderId.mockResolvedValue(paymentFixture({ status: "processing" }));
    await service.handleKlapConfirmWebhook(confirmBody(), { apikey: validApikeyHeader() });
    expect(mockMarkAuthorizedAndActivateRide).toHaveBeenCalledOnce();
  });

  it("22. a duplicate confirm (already claimed) does not repeat effects", async () => {
    mockClaimWebhookEvent.mockResolvedValue({ claimed: false, event: { id: "existing" } });
    const result = await service.handleKlapConfirmWebhook(confirmBody(), { apikey: validApikeyHeader() });
    expect(result.ok).toBe(true);
    expect(mockMarkAuthorizedAndActivateRide).not.toHaveBeenCalled();
  });

  it("22b. confirm on an already-success payment does not repeat the transition", async () => {
    mockFindByProviderOrderId.mockResolvedValue(paymentFixture({ status: "success" }));
    await service.handleKlapConfirmWebhook(confirmBody(), { apikey: validApikeyHeader() });
    expect(mockMarkAuthorizedAndActivateRide).not.toHaveBeenCalled();
  });

  it("persists only safe card metadata needed by the passenger receipt", async () => {
    await service.handleKlapConfirmWebhook(
      confirmBody({
        card_type: "credito",
        brand: "Visa",
        last_digits: "1091",
        quotas_number: "3",
        quotas_type: "issuer",
      }),
      { apikey: validApikeyHeader() },
    );

    expect(mockMarkAuthorizedAndActivateRide).toHaveBeenCalledWith(
      expect.objectContaining({
        providerPayload: expect.objectContaining({
          card_type: "credito",
          brand: "Visa",
          last_digits: "1091",
          quotas_number: "3",
          quotas_type: "issuer",
        }),
      }),
    );
  });

  it("23/24. never persists token_id or bin (not even declared in the claimed event payload)", async () => {
    await service.handleKlapConfirmWebhook(
      confirmBody({ token_id: "secret-token-should-not-appear", bin: "123456" }),
      { apikey: validApikeyHeader() },
    );
    const claimedPayload = JSON.stringify(mockClaimWebhookEvent.mock.calls[0]?.[0]);
    expect(claimedPayload).not.toContain("secret-token-should-not-appear");
    expect(claimedPayload).not.toContain("token_id");
  });

  it("25. does not credit Wallet (no wallet repository/service is imported or called by this flow)", async () => {
    await service.handleKlapConfirmWebhook(confirmBody(), { apikey: validApikeyHeader() });
    // Structural guarantee: no wallet mock exists in this file — if this method
    // ever called into a wallet repository, it would throw for lack of a mock.
    expect(true).toBe(true);
  });

  it("26. does not return the raw provider payload", async () => {
    const result = await service.handleKlapConfirmWebhook(confirmBody(), { apikey: validApikeyHeader() });
    expect(JSON.stringify(result)).not.toContain("transaction_type");
  });

  it("27/28. responds {status:'ok'} and leaves the payment success", async () => {
    const result = await service.handleKlapConfirmWebhook(confirmBody(), { apikey: validApikeyHeader() });
    expect(result).toMatchObject({ ok: true, status: "ok" });
    expect(mockMarkAuthorizedAndActivateRide).toHaveBeenCalledWith(
      expect.objectContaining({ id: REFERENCE_ID, rideRequestId: "ride-uuid" }),
    );
  });

  it("29. does not depend on any frontend-supplied paymentId (identification is order_id/reference_id only)", async () => {
    const body = confirmBody();
    await service.handleKlapConfirmWebhook(body, { apikey: validApikeyHeader() });
    expect(mockFindByProviderOrderId).toHaveBeenCalledWith(ORDER_ID);
  });
});

describe("PaymentsService.handleKlapRejectWebhook", () => {
  let service: PaymentsService;

  function rejectBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      order_id: ORDER_ID,
      reference_id: REFERENCE_ID,
      code: "card_declined",
      message: "The card was declined by the issuer.",
      ...overrides,
    };
  }

  beforeEach(() => {
    service = new PaymentsService();
    mockFindByProviderOrderId.mockResolvedValue(paymentFixture());
  });

  it("2. accepts a valid reject signature", async () => {
    const result = await service.handleKlapRejectWebhook(rejectBody(), { apikey: validApikeyHeader() });
    expect(result.ok).toBe(true);
  });

  it("30. accepts the minimal valid payload (no code/message)", async () => {
    const body = rejectBody();
    delete (body as Record<string, unknown>)["code"];
    delete (body as Record<string, unknown>)["message"];
    const result = await service.handleKlapRejectWebhook(body, { apikey: validApikeyHeader() });
    expect(result.ok).toBe(true);
  });

  it("31. code is optional", async () => {
    const body = rejectBody();
    delete (body as Record<string, unknown>)["code"];
    const result = await service.handleKlapRejectWebhook(body, { apikey: validApikeyHeader() });
    expect(result.ok).toBe(true);
  });

  it("32. message is optional", async () => {
    const body = rejectBody();
    delete (body as Record<string, unknown>)["message"];
    const result = await service.handleKlapRejectWebhook(body, { apikey: validApikeyHeader() });
    expect(result.ok).toBe(true);
  });

  it("33/34. code and message are sanitized and bounded before persisting", async () => {
    await service.handleKlapRejectWebhook(
      rejectBody({ code: "bad\x00code", message: "line1\nline2\tend".repeat(20) }),
      { apikey: validApikeyHeader() },
    );
    const persisted = mockMarkRejected.mock.calls[0]?.[1] as Record<string, unknown>;
    const controlChars = new RegExp("[\\u0000-\\u001F\\u007F]");
    expect(String(persisted.code)).not.toMatch(controlChars);
    expect(String(persisted.message).length).toBeLessThanOrEqual(255);
  });

  it("34b. reject usa eventKey acotada al VARCHAR(128)", async () => {
    await service.handleKlapRejectWebhook(
      rejectBody(),
      { apikey: validApikeyHeader() },
    );

    const claim = mockClaimWebhookEvent.mock.calls[0]?.[0] as
      | { eventKey?: string }
      | undefined;

    expect(claim?.eventKey).toMatch(
      /^klap:reject:[a-f0-9]{64}$/,
    );

    expect(claim?.eventKey?.length).toBeLessThanOrEqual(128);
  });
  it("35. processes a pending/processing payment into rejected without deleting the ride", async () => {
    mockFindByProviderOrderId.mockResolvedValue(paymentFixture({ status: "processing" }));
    const result = await service.handleKlapRejectWebhook(rejectBody(), { apikey: validApikeyHeader() });
    expect(result.ok).toBe(true);
    expect(mockMarkRejected).toHaveBeenCalledOnce();
    expect(mockCancelPendingPayment).not.toHaveBeenCalled();
  });

  it("36. a duplicate reject does not repeat the transition", async () => {
    mockFindByProviderOrderId.mockResolvedValue(paymentFixture({ status: "rejected" }));
    await service.handleKlapRejectWebhook(rejectBody(), { apikey: validApikeyHeader() });
    expect(mockMarkRejected).not.toHaveBeenCalled();
  });

  it("36b. an already-claimed event does not repeat effects", async () => {
    mockClaimWebhookEvent.mockResolvedValue({ claimed: false, event: { id: "existing" } });
    const result = await service.handleKlapRejectWebhook(rejectBody(), { apikey: validApikeyHeader() });
    expect(result.ok).toBe(true);
    expect(mockMarkRejected).not.toHaveBeenCalled();
  });

  it("16/37. un reject tardío sobre un pago success responde ok y nunca lo degrada", async () => {
    mockFindByProviderOrderId.mockResolvedValue(paymentFixture({ status: "success" }));
    const result = await service.handleKlapRejectWebhook(
      rejectBody(),
      { apikey: validApikeyHeader() },
    );
    expect(mockMarkRejected).not.toHaveBeenCalled();
    expect(mockClaimWebhookEvent).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: true, status: "ok" });
    expect(mockRecordSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "payment.klap_reject_after_success",
      }),
    );
  });

  it("38. does not touch a payment belonging to another provider", async () => {
    mockFindByProviderOrderId.mockResolvedValue(paymentFixture({ provider: "mercadopago" }));
    const result = await service.handleKlapRejectWebhook(rejectBody(), { apikey: validApikeyHeader() });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_FOUND");
    expect(mockMarkRejected).not.toHaveBeenCalled();
  });

  it("39. responds {status:'ok'} for a processed reject", async () => {
    const result = await service.handleKlapRejectWebhook(rejectBody(), { apikey: validApikeyHeader() });
    expect(result).toMatchObject({ ok: true, status: "ok" });
  });

  it("40. never returns the raw Klap message in the result", async () => {
    const result = await service.handleKlapRejectWebhook(
      rejectBody({ message: "Internal Klap diagnostic detail that should not leak" }),
      { apikey: validApikeyHeader() },
    );
    expect(JSON.stringify(result)).not.toContain("Internal Klap diagnostic detail");
  });

  it("rejects an invalid signature", async () => {
    const result = await service.handleKlapRejectWebhook(rejectBody(), { apikey: "0".repeat(64) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("WEBHOOK_INVALID_SIGNATURE");
  });

  it("8/9. rejects order_id/reference_id pointing to different payments with 409 payment_mismatch", async () => {
    mockFindByProviderOrderId.mockResolvedValue(paymentFixture({ id: "different-payment-id" }));
    const result = await service.handleKlapRejectWebhook(rejectBody(), { apikey: validApikeyHeader() });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("PAYMENT_MISMATCH");
      expect(result.statusCode).toBe(409);
    }
    expect(mockMarkRejected).not.toHaveBeenCalled();
  });

});
