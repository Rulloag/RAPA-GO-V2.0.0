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
import { ratingsRoutes }       from "./modules/ratings/ratings.routes.js";
import { adminRoutes }         from "./modules/admin/admin.routes.js";
import { driverStatusRoutes }  from "./modules/drivers/driverStatus.routes.js";
import { driverProfileRoutes } from "./modules/drivers/driverProfile.routes.js";
import { passengerProfileRoutes } from "./modules/passengers/passengerProfile.routes.js";
import { offlineRoutes }       from "./modules/offline/offline.routes.js";
import { walletRoutes }        from "./modules/wallet/wallet.routes.js";
import { touristRoutes }       from "./modules/tourist/tourist.routes.js";
import { rentalRoutes }        from "./modules/rental/rental.routes.js";
import { notificationsRoutes }   from "./modules/notifications/notifications.routes.js";
import { applicationsRoutes }    from "./modules/applications/applications.routes.js";
import { eventTicketsRoutes, adminEventTicketsRoutes } from "./modules/eventTickets/eventTickets.routes.js";

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
  await fastify.register(ratingsRoutes,      { prefix: "/api" });
  await fastify.register(adminRoutes,        { prefix: "/api/admin" });
  await fastify.register(driverStatusRoutes, { prefix: "/api/drivers" });
  await fastify.register(offlineRoutes,      { prefix: "/api" });
  await fastify.register(driverProfileRoutes,    { prefix: "/api" });
  await fastify.register(passengerProfileRoutes, { prefix: "/api" });
  await fastify.register(walletRoutes,           { prefix: "/api" });
  await fastify.register(touristRoutes,          { prefix: "/api" });
  await fastify.register(rentalRoutes,           { prefix: "/api" });
  await fastify.register(notificationsRoutes,    { prefix: "/api" });
  await fastify.register(applicationsRoutes,     { prefix: "/api" });
  await fastify.register(eventTicketsRoutes,     { prefix: "/api" });
  await fastify.register(adminEventTicketsRoutes, { prefix: "/api/admin" });

  return fastify;
}
