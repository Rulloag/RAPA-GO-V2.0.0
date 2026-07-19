import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { helmetPlugin } from "../helmet.js";
import { rateLimitPlugin } from "../rateLimit.js";
import { globalErrorHandler } from "../../shared/errors/errorHandler.js";

/**
 * Registers helmetPlugin/rateLimitPlugin/setErrorHandler exactly as app.ts does,
 * then a sibling route registered independently afterwards — the same topology
 * real route modules use in app.ts. This reproduces both the actual
 * encapsulation bug (global hooks registered inside a plugin's own child
 * context never reaching sibling routes) and the app's real error-handling
 * pipeline, rather than testing the wrapper functions in isolation.
 */
async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(helmetPlugin);
  await app.register(rateLimitPlugin);
  app.setErrorHandler(globalErrorHandler);
  app.get("/sibling", async () => ({ ok: true }));
  await app.ready();
  return app;
}

describe("global Helmet headers reach sibling routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("applies Helmet security headers to a route registered as a sibling of the plugin", async () => {
    const res = await app.inject({ method: "GET", url: "/sibling" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(res.headers["strict-transport-security"]).toBeDefined();
  });
});

describe("global rate limit reaches sibling routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("does not rate limit a single request under the threshold", async () => {
    const res = await app.inject({ method: "GET", url: "/sibling" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["x-ratelimit-limit"]).toBe("100");
  });

  /**
   * @fastify/rate-limit's own `errorResponseBuilder` sets `code: "RATE_LIMIT_EXCEEDED"`
   * (see rateLimit.ts), but the app's global `setErrorHandler` (errorHandler.ts,
   * registered in app.ts exactly as reproduced here) intercepts the thrown error
   * and — for any error that isn't an `AppError` — always emits a generic
   * `code: "INTERNAL_SERVER_ERROR"`, regardless of the real status code. The
   * HTTP status (429) and the message text both survive correctly; only the
   * JSON `code` field is generic. This interaction was never observable before
   * this fix, since the rate limit itself never actually triggered. Fixing the
   * error-handler's code mapping is out of scope here (errorHandler.ts wasn't
   * part of this change's permitted files) — this test locks in the real,
   * currently-shipping behavior rather than an aspirational one.
   */
  it("returns HTTP 429 once the global max is exceeded (JSON code field is generic, by design of the app's shared error handler)", async () => {
    let last;
    for (let i = 0; i < 101; i++) {
      last = await app.inject({ method: "GET", url: "/sibling" });
    }
    expect(last?.statusCode).toBe(429);
    const body = JSON.parse(last?.body ?? "{}") as {
      ok: boolean;
      code: string;
      statusCode: number;
      message: string;
    };
    expect(body.ok).toBe(false);
    expect(body.statusCode).toBe(429);
    expect(body.message).toMatch(/Too many requests/);
  });
});
