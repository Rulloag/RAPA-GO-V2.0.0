import Fastify, { type FastifyInstance } from "fastify";
import { corsPlugin } from "./plugins/cors.js";
import { helmetPlugin } from "./plugins/helmet.js";
import { rateLimitPlugin } from "./plugins/rateLimit.js";
import { globalErrorHandler } from "./shared/errors/errorHandler.js";
import { authRoutes }       from "./modules/auth/auth.routes.js";
import { profileRoutes }    from "./modules/profile/profile.routes.js";
import { documentsRoutes }     from "./modules/documents/documents.routes.js";
import { bankAccountsRoutes }  from "./modules/bankAccounts/bankAccounts.routes.js";
import { ridesRoutes }         from "./modules/rides/rides.routes.js";

/**
 * buildApp — constructs and configures the Fastify instance.
 * Separated from server.ts so the app can be imported in tests without binding a port.
 */
export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: {
      level: process.env["NODE_ENV"] === "production" ? "warn" : "info",
    },
    // Attach request id to every log line
    genReqId: () => crypto.randomUUID(),
  });

  // ── Security & transport plugins ──────────────────────────────────────────
  await fastify.register(helmetPlugin);
  await fastify.register(corsPlugin);
  await fastify.register(rateLimitPlugin);

  // ── Global error handler ──────────────────────────────────────────────────
  fastify.setErrorHandler(globalErrorHandler);

  // ── Health check ──────────────────────────────────────────────────────────
  fastify.get("/health", {
    config: { rateLimit: { max: 200, timeWindow: "1 minute" } },
  }, async () => ({
    ok: true,
    service: "rapa-go-api",
    version: "2.0.0",
    status: "healthy",
    timestamp: new Date().toISOString(),
  }));

  // ── Modules ───────────────────────────────────────────────────────────────
  await fastify.register(authRoutes,      { prefix: "/api/auth" });
  await fastify.register(profileRoutes,   { prefix: "/api/profile" });
  await fastify.register(documentsRoutes,    { prefix: "/api/documents" });
  await fastify.register(bankAccountsRoutes, { prefix: "/api/bank-account" });
  await fastify.register(ridesRoutes,        { prefix: "/api/rides" });

  return fastify;
}
