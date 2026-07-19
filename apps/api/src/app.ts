import Fastify, { type FastifyInstance } from "fastify";
import { corsPlugin } from "./plugins/cors.js";
import { helmetPlugin } from "./plugins/helmet.js";
import { rateLimitPlugin } from "./plugins/rateLimit.js";
import { globalErrorHandler } from "./shared/errors/errorHandler.js";

import { authRoutes } from "./modules/auth/auth.routes.js";
import {
  accountDeletionRoutes,
  adminAccountDeletionRoutes,
} from "./modules/accountDeletion/accountDeletion.routes.js";
import { profileRoutes } from "./modules/profile/profile.routes.js";
import { documentsRoutes } from "./modules/documents/documents.routes.js";
import { bankAccountsRoutes } from "./modules/bankAccounts/bankAccounts.routes.js";
import { ridesRoutes } from "./modules/rides/rides.routes.js";
import { paymentsRoutes } from "./modules/payments/payments.routes.js";
import { ratingsRoutes } from "./modules/ratings/ratings.routes.js";
import { adminRoutes } from "./modules/admin/admin.routes.js";
import { driverStatusRoutes } from "./modules/drivers/driverStatus.routes.js";
import { driverProfileRoutes } from "./modules/drivers/driverProfile.routes.js";
import { passengerProfileRoutes } from "./modules/passengers/passengerProfile.routes.js";
import { offlineRoutes } from "./modules/offline/offline.routes.js";
import { walletRoutes } from "./modules/wallet/wallet.routes.js";
import { touristRoutes } from "./modules/tourist/tourist.routes.js";
import { rentalRoutes } from "./modules/rental/rental.routes.js";
import { notificationsRoutes } from "./modules/notifications/notifications.routes.js";
import { applicationsRoutes } from "./modules/applications/applications.routes.js";
import {
  eventTicketsRoutes,
  adminEventTicketsRoutes,
} from "./modules/eventTickets/eventTickets.routes.js";
import {
  legalDocumentsRoutes,
  adminLegalRoutes,
} from "./modules/legal/legal.routes.js";
import {
  fareSettingsPublicRoutes,
  fareSettingsAdminRoutes,
} from "./modules/fareSettings/fareSettings.routes.js";
import {
  referralsRoutes,
  adminReferralsRoutes,
} from "./modules/referrals/referrals.routes.js";

import { sql } from "drizzle-orm";
import { db } from "./db/client.js";

async function checkDbConnection(): Promise<"connected" | "disconnected"> {
  try {
    await db.execute(sql`SELECT 1`);
    return "connected";
  } catch {
    return "disconnected";
  }
}

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

  // ── Health checks ─────────────────────────────────────────────────────────
  const RL_HEALTH = {
    config: {
      rateLimit: {
        max: 300,
        timeWindow: "1 minute",
      },
    },
  } as const;

  fastify.get("/health", RL_HEALTH, async (_req, reply) => {
    const dbStatus = await checkDbConnection();
    const mem = process.memoryUsage();
    const memMb = Math.round(mem.rss / 1024 / 1024);

    reply.status(dbStatus === "connected" ? 200 : 503);

    return {
      ok: dbStatus === "connected",
      service: "rapa-go-api",
      version: "2.0.0",
      status: dbStatus === "connected" ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      checks: {
        database: dbStatus,
        memory: memMb < 512 ? "ok" : "critical",
        memoryMb: memMb,
      },
    };
  });

  fastify.get("/health/ready", RL_HEALTH, async (_req, reply) => {
    const dbStatus = await checkDbConnection();
    const ready = dbStatus === "connected";

    reply.status(ready ? 200 : 503);

    return {
      ready,
      timestamp: new Date().toISOString(),
    };
  });

  fastify.get("/health/live", RL_HEALTH, async () => ({
    alive: true,
    timestamp: new Date().toISOString(),
  }));

  // ── Modules ───────────────────────────────────────────────────────────────
  await fastify.register(authRoutes, { prefix: "/api/auth" });
  await fastify.register(accountDeletionRoutes, {
    prefix: "/api/account-deletion",
  });
  await fastify.register(adminAccountDeletionRoutes, {
    prefix: "/api/admin/account-deletion",
  });
  await fastify.register(profileRoutes, { prefix: "/api/profile" });
  await fastify.register(documentsRoutes, { prefix: "/api/documents" });
  await fastify.register(bankAccountsRoutes, { prefix: "/api/bank-account" });
  await fastify.register(ridesRoutes, { prefix: "/api/rides" });

  // Pagos:
  // payments.routes.ts define /payments/create y /payments/webhook/...
  // Con este prefix, la ruta final queda:
  // POST /api/payments/create
  await fastify.register(paymentsRoutes, { prefix: "/api" });

  await fastify.register(ratingsRoutes, { prefix: "/api" });
  await fastify.register(adminRoutes, { prefix: "/api/admin" });
  await fastify.register(driverStatusRoutes, { prefix: "/api/drivers" });
  await fastify.register(offlineRoutes, { prefix: "/api" });
  await fastify.register(driverProfileRoutes, { prefix: "/api" });
  await fastify.register(passengerProfileRoutes, { prefix: "/api" });
  await fastify.register(walletRoutes, { prefix: "/api" });
  await fastify.register(touristRoutes, { prefix: "/api" });
  await fastify.register(rentalRoutes, { prefix: "/api" });
  await fastify.register(notificationsRoutes, { prefix: "/api" });
  await fastify.register(applicationsRoutes, { prefix: "/api" });
  await fastify.register(eventTicketsRoutes, { prefix: "/api" });
  await fastify.register(adminEventTicketsRoutes, { prefix: "/api/admin" });
  await fastify.register(legalDocumentsRoutes, { prefix: "/api" });
  await fastify.register(adminLegalRoutes, { prefix: "/api/admin" });
  await fastify.register(fareSettingsPublicRoutes, { prefix: "/api" });
  await fastify.register(fareSettingsAdminRoutes, { prefix: "/api/admin" });
  await fastify.register(referralsRoutes, { prefix: "/api" });
  await fastify.register(adminReferralsRoutes, { prefix: "/api/admin" });

  return fastify;
}
