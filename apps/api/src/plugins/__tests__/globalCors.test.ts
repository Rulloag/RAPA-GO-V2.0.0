import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { helmetPlugin } from "../helmet.js";
import { createCorsOptions } from "../cors.js";
import { rateLimitPlugin } from "../rateLimit.js";
import { globalErrorHandler } from "../../shared/errors/errorHandler.js";

const ALLOWED_ORIGIN = "http://localhost:5173";

/**
 * Registers helmetPlugin/@fastify-cors/rateLimitPlugin/setErrorHandler exactly as
 * app.ts does, then sibling routes registered independently afterwards — the
 * same topology real route modules use in app.ts. This reproduces the actual
 * encapsulation bug (global hooks registered inside a plugin's own child
 * context never reaching sibling routes) rather than testing the wrapper
 * function in isolation.
 */
async function buildTestApp(): Promise<FastifyInstance> {
  const originalCorsOrigin = process.env["CORS_ORIGIN"];
  process.env["CORS_ORIGIN"] = ALLOWED_ORIGIN;

  const app = Fastify({ logger: false });
  await app.register(helmetPlugin);
  await app.register(cors, createCorsOptions());
  await app.register(rateLimitPlugin);
  app.setErrorHandler(globalErrorHandler);
  app.get("/sibling", async () => ({ ok: true }));
  app.post("/sibling", async () => ({ ok: true }));
  await app.ready();

  if (originalCorsOrigin === undefined) {
    delete process.env["CORS_ORIGIN"];
  } else {
    process.env["CORS_ORIGIN"] = originalCorsOrigin;
  }

  return app;
}

describe("global CORS headers reach sibling routes", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("includes Access-Control-Allow-Origin on a real GET response for an allowed origin", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/sibling",
      headers: { origin: ALLOWED_ORIGIN },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe(ALLOWED_ORIGIN);
  });

  it("includes Access-Control-Allow-Origin on a real POST response for an allowed origin", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/sibling",
      headers: { origin: ALLOWED_ORIGIN },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe(ALLOWED_ORIGIN);
  });

  it("keeps Access-Control-Allow-Credentials correct on a real response", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/sibling",
      headers: { origin: ALLOWED_ORIGIN },
    });
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("does not reflect a disallowed origin back on a real response", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/sibling",
      headers: { origin: "http://evil.example.com" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["access-control-allow-origin"]).not.toBe("http://evil.example.com");
  });

  it("still serves a real request with no Origin header at all", async () => {
    const res = await app.inject({ method: "GET", url: "/sibling" });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ok: true });
  });

  it("still answers the OPTIONS preflight correctly", async () => {
    const res = await app.inject({
      method: "OPTIONS",
      url: "/sibling",
      headers: {
        origin: ALLOWED_ORIGIN,
        "access-control-request-method": "GET",
      },
    });
    expect(res.statusCode).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe(ALLOWED_ORIGIN);
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });
});

describe("staging APP_ENV CORS defaults", () => {
  const STAGING_ORIGIN = "https://staging.rapago.cl";
  let previousAppEnv: string | undefined;
  let previousCors: string | undefined;
  let app: FastifyInstance;

  beforeEach(async () => {
    previousAppEnv = process.env["APP_ENV"];
    previousCors = process.env["CORS_ORIGIN"];
    process.env["APP_ENV"] = "staging";
    delete process.env["CORS_ORIGIN"];

    app = Fastify({ logger: false });
    await app.register(helmetPlugin);
    await app.register(cors, createCorsOptions());
    await app.register(rateLimitPlugin);
    app.setErrorHandler(globalErrorHandler);
    app.get("/sibling", async () => ({ ok: true }));
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    if (previousAppEnv === undefined) delete process.env["APP_ENV"];
    else process.env["APP_ENV"] = previousAppEnv;
    if (previousCors === undefined) delete process.env["CORS_ORIGIN"];
    else process.env["CORS_ORIGIN"] = previousCors;
  });

  it("allows https://staging.rapago.cl when APP_ENV=staging", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/sibling",
      headers: { origin: STAGING_ORIGIN },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe(STAGING_ORIGIN);
  });
});
