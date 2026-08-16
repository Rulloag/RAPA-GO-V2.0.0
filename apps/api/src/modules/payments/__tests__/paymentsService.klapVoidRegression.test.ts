import { readFileSync } from "node:fs";
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { KlapProvider } from "../klap.provider.js";

const service = readFileSync(
  new URL("../payments.service.ts", import.meta.url),
  "utf8",
);

const repository = readFileSync(
  new URL("../payments.repository.ts", import.meta.url),
  "utf8",
);

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env["KLAP_API_KEY"];
  delete process.env["KLAP_ENVIRONMENT"];
  delete process.env["KLAP_SANDBOX_ORDERS_URL"];
  delete process.env["KLAP_RETURN_URL"];
  delete process.env["KLAP_CANCEL_URL"];
  delete process.env["KLAP_WEBHOOK_CONFIRM_URL"];
  delete process.env["KLAP_WEBHOOK_REJECT_URL"];
  delete process.env["KLAP_WEBHOOK_VALIDATION_URL"];
  delete process.env["KLAP_ORDER_EXPIRATION_MINUTES"];
  delete process.env["KLAP_REQUEST_TIMEOUT_MS"];
});

describe("Klap authorization release regression", () => {
  it("POST refund de Order API no envia body ni amount", async () => {
    process.env["KLAP_API_KEY"] = "test-secret";
    process.env["KLAP_ENVIRONMENT"] = "sandbox";
    process.env["KLAP_SANDBOX_ORDERS_URL"] =
      "https://api-pasarela-sandbox.mcdesaqa.cl/payment-gateway/v1/orders";

    process.env["KLAP_RETURN_URL"] =
      "https://backend.rapago.test/payments/klap/return";

    process.env["KLAP_CANCEL_URL"] =
      "https://backend.rapago.test/payments/klap/cancel";

    process.env["KLAP_WEBHOOK_CONFIRM_URL"] =
      "https://backend.rapago.test/webhooks/klap/confirm";

    process.env["KLAP_WEBHOOK_REJECT_URL"] =
      "https://backend.rapago.test/webhooks/klap/reject";

    process.env["KLAP_WEBHOOK_VALIDATION_URL"] =
      "https://backend.rapago.test/webhooks/klap/validate";

    process.env["KLAP_ORDER_EXPIRATION_MINUTES"] =
      "30";

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            order_id: "3747MTEST123",
            reference_id: "payment-test-1",
            status: "refunded",
            amount: 500,
            refundable_amount: 0,
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        ),
      );

    const result =
      await new KlapProvider().refundOrder(
        "3747MTEST123",
      );

    expect(result).toMatchObject({
      orderId: "3747MTEST123",
      referenceId: "payment-test-1",
      status: "refunded",
      amountClp: 500,
      refundableAmountClp: 0,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] =
      fetchMock.mock.calls[0] ?? [];

    expect(String(url)).toBe(
      "https://api-pasarela-sandbox.mcdesaqa.cl/payment-gateway/v1/orders/3747MTEST123/refund",
    );

    expect(init?.method).toBe("POST");
    expect(init?.body).toBeUndefined();

    const headers =
      (init?.headers ?? {}) as Record<string, string>;

    expect(headers.apikey).toBe("test-secret");
    expect(headers["Content-Type"]).toBeUndefined();
  });

  it("claimRefund permite reservar atomicamente authorized", () => {
    const start =
      repository.indexOf("async claimRefund(");
    const end =
      repository.indexOf(
        "async markRefunded(",
        start,
      );

    const method =
      repository.slice(start, end);

    expect(method).toContain(
      'inArray(payments.status, ["success", "authorized"])',
    );
  });

  it("cancelacion void usa releaseAuthorizedKlapPayment", () => {
    expect(service).toContain(
      "await this.releaseAuthorizedKlapPayment(",
    );

    expect(service).toContain(
      "await provider.refundOrder(orderId)",
    );

    expect(service).toContain(
      '"payment.klap_authorization_released"',
    );
  });

  it("reconcile consulta authorized y sincroniza refund como refunded", () => {
    const start =
      service.indexOf(
        "async reconcileKlapPayment(",
      );

    const end =
      service.indexOf(
        "async captureAuthorizedKlapPayment(",
        start,
      );

    const reconcile =
      service.slice(start, end);

    const early =
      reconcile.slice(
        0,
        reconcile.indexOf(
          'const orderId = String(payment.providerOrderId',
        ),
      );

    expect(early).not.toContain(
      '"authorized",',
    );

    expect(reconcile).toContain(
      'payment.status === "authorized"',
    );

    expect(reconcile).toContain(
      'remoteStatus === "refund"',
    );

    expect(reconcile).toContain(
      "await paymentsRepo.markRefunded({",
    );
  });
});
