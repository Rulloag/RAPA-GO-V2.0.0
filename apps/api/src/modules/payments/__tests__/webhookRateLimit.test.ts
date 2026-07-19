import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { helmetPlugin } from "../../../plugins/helmet.js";
import { rateLimitPlugin } from "../../../plugins/rateLimit.js";
import { globalErrorHandler } from "../../../shared/errors/errorHandler.js";
import { paymentsRoutes } from "../payments.routes.js";

/**
 * Builds an app with the exact same registration topology as app.ts —
 * helmetPlugin, rateLimitPlugin, the real setErrorHandler, then the real
 * paymentsRoutes registered as a sibling — so these tests exercise the
 * actual route-level `config: { rateLimit: false }` exemption against the
 * real global rate limiter, not a reimplementation of it.
 *
 * MERCADOPAGO_WEBHOOK_SECRET is set to a non-real value so
 * verifyWebhookSignature actually runs its HMAC check instead of the
 * provider's fail-open "no secret configured" bypass — otherwise every
 * request here would be silently accepted regardless of signature.
 */
async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(helmetPlugin);
  await app.register(rateLimitPlugin);
  app.setErrorHandler(globalErrorHandler);
  await app.register(paymentsRoutes);
  await app.ready();
  return app;
}

describe("payment webhooks are exempt from the global rate limit", () => {
  let app: FastifyInstance;
  const originalMpSecret = process.env["MERCADOPAGO_WEBHOOK_SECRET"];

  beforeAll(async () => {
    process.env["MERCADOPAGO_WEBHOOK_SECRET"] = "test-fake-secret-not-real";
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
    if (originalMpSecret === undefined) {
      delete process.env["MERCADOPAGO_WEBHOOK_SECRET"];
    } else {
      process.env["MERCADOPAGO_WEBHOOK_SECRET"] = originalMpSecret;
    }
  });

  it("never returns 429 for ProntoPaga even after exceeding the global max, and keeps rejecting an invalid signature", async () => {
    const statusCodes: number[] = [];
    for (let i = 0; i < 105; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/payments/webhook/prontopaga",
        payload: { order: "fake-order-id", status: "success", signature: "not-a-real-signature" },
      });
      statusCodes.push(res.statusCode);
    }

    expect(statusCodes).not.toContain(429);
    // Every request carried a bogus signature — every single one must be
    // rejected by verifyWebhookSignature (401), not silently accepted.
    expect(statusCodes.every((code) => code === 401)).toBe(true);
  });

  it("never returns 429 for MercadoPago even after exceeding the global max, and keeps rejecting an invalid signature", async () => {
    const statusCodes: number[] = [];
    for (let i = 0; i < 105; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/payments/webhook/mercadopago",
        headers: { "x-signature": "ts=1700000000,v1=not-a-real-signature", "x-request-id": "req-1" },
        payload: { type: "payment", data: { id: "123" } },
      });
      statusCodes.push(res.statusCode);
    }

    expect(statusCodes).not.toContain(429);
    expect(statusCodes.every((code) => code === 401)).toBe(true);
  });

  it("rejects a MercadoPago webhook with HTTP 401 when MERCADOPAGO_WEBHOOK_SECRET is unset, even with a well-formed x-signature header (fails closed, not just rate-limit exempt)", async () => {
    const savedSecret = process.env["MERCADOPAGO_WEBHOOK_SECRET"];
    delete process.env["MERCADOPAGO_WEBHOOK_SECRET"];

    const res = await app.inject({
      method: "POST",
      url: "/payments/webhook/mercadopago",
      headers: { "x-signature": "ts=1700000000,v1=deadbeef", "x-request-id": "req-1" },
      payload: { type: "payment", data: { id: "123" } },
    });

    if (savedSecret === undefined) {
      delete process.env["MERCADOPAGO_WEBHOOK_SECRET"];
    } else {
      process.env["MERCADOPAGO_WEBHOOK_SECRET"] = savedSecret;
    }

    expect(res.statusCode).toBe(401);
  });

  it("still rate limits a normal payments route (not the webhooks) once its own global max is exceeded", async () => {
    let last;
    for (let i = 0; i < 101; i++) {
      last = await app.inject({ method: "POST", url: "/payments/create", payload: {} });
    }
    // /payments/create has no exemption — it must still hit the shared
    // 100 req/min bucket regardless of what its handler does with the request.
    expect(last?.statusCode).toBe(429);
  });
});
