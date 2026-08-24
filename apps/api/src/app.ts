import cors from "@fastify/cors";
import { createCorsOptions } from "./plugins/cors.js";
import { randomUUID } from "node:crypto";
import Fastify, { type FastifyInstance } from "fastify";
import { helmetPlugin } from "./plugins/helmet.js";
import { rateLimitPlugin } from "./plugins/rateLimit.js";
import { globalErrorHandler } from "./shared/errors/errorHandler.js";

import { authRoutes } from "./modules/auth/auth.routes.js";
import { appleWebRoutes } from "./modules/auth/appleWeb.routes.js";
import {
  accountDeletionRoutes,
  adminAccountDeletionRoutes,
} from "./modules/accountDeletion/accountDeletion.routes.js";
import { profileRoutes } from "./modules/profile/profile.routes.js";
import { documentsRoutes } from "./modules/documents/documents.routes.js";
import { bankAccountsRoutes } from "./modules/bankAccounts/bankAccounts.routes.js";
import { ridesRoutes } from "./modules/rides/rides.routes.js";
import { rideTrackingRoutes } from "./modules/rideTracking/rideTracking.routes.js";
import { rideReceiptsRoutes } from "./modules/rideReceipts/rideReceipts.routes.js";
import { paymentsRoutes } from "./modules/payments/payments.routes.js";
import { ratingsRoutes } from "./modules/ratings/ratings.routes.js";
import { supportRoutes, adminSupportRoutes } from "./modules/support/support.routes.js";
import { adminRoutes } from "./modules/admin/admin.routes.js";
import { driverStatusRoutes } from "./modules/drivers/driverStatus.routes.js";
import { driverProfileRoutes } from "./modules/drivers/driverProfile.routes.js";
import { driverOffersRoutes } from "./modules/drivers/driverOffers.routes.js";
import { passengerProfileRoutes } from "./modules/passengers/passengerProfile.routes.js";
import { offlineRoutes } from "./modules/offline/offline.routes.js";
import { walletRoutes } from "./modules/wallet/wallet.routes.js";
import { cashRefundsRoutes } from "./modules/cashRefunds/cashRefunds.routes.js";
import { cashPaymentsRoutes } from "./modules/cashPayments/cashPayments.routes.js";
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
import { releaseFeatures } from "./config/features.js";
import { RetentionJob } from "./jobs/retention.job.js";
import { RideReceiptsJob } from "./jobs/rideReceipts.job.js";
import { QueueOfferExpiryJob } from "./jobs/queueOfferExpiry.job.js";

async function checkDbConnection(): Promise<"connected" | "disconnected"> {
  try {
    await db.execute(sql`SELECT 1`);
    return "connected";
  } catch {
    return "disconnected";
  }
}


function getTrustProxySetting(): boolean | number {
  const configured = String(process.env["TRUST_PROXY"] ?? "")
    .trim()
    .toLowerCase();

  if (configured === "true") return true;
  if (configured === "false") return false;

  const hops = Number(configured);
  if (Number.isInteger(hops) && hops >= 0 && hops <= 5) {
    return hops;
  }

  // Production deployments normally sit behind one trusted reverse proxy.
  return process.env["NODE_ENV"] === "production" ? 1 : false;
}

/**
 * buildApp — constructs and configures the Fastify instance.
 * Separated from server.ts so the app can be imported in tests without binding a port.
 */
export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    trustProxy: getTrustProxySetting(),
    bodyLimit: 1 * 1024 * 1024,
    logger: {
      level: process.env["NODE_ENV"] === "production" ? "warn" : "info",
    },
    // Attach request id to every log line
    genReqId: () => randomUUID(),
  });

  fastify.addHook("onRequest", async (request, reply) => {
    void reply.header("x-request-id", String(request.id));
  });

  // ── Security & transport plugins ──────────────────────────────────────────
  await fastify.register(helmetPlugin);
  await fastify.register(cors, createCorsOptions());
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
      releaseFeatures,
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
  // Apple web uses the exact public callback registered in Apple Developer:
  // POST /auth/apple/web/callback (without the /api prefix).
  await fastify.register(appleWebRoutes);
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
  await fastify.register(rideTrackingRoutes, { prefix: "/api/rides" });
  await fastify.register(rideReceiptsRoutes, { prefix: "/api" });

  // Pagos:
  // payments.routes.ts define /payments/create y /payments/webhook/...
  // Con este prefix, la ruta final queda:
  // POST /api/payments/create
  await fastify.register(paymentsRoutes, { prefix: "/api" });

  await fastify.register(ratingsRoutes, { prefix: "/api" });
  await fastify.register(supportRoutes, { prefix: "/api/support" });
  await fastify.register(adminSupportRoutes, { prefix: "/api/admin/support" });
  await fastify.register(adminRoutes, { prefix: "/api/admin" });
  await fastify.register(driverStatusRoutes, { prefix: "/api/drivers" });
  await fastify.register(driverOffersRoutes, { prefix: "/api/drivers" });
  await fastify.register(offlineRoutes, { prefix: "/api" });
  await fastify.register(driverProfileRoutes, { prefix: "/api" });
  await fastify.register(passengerProfileRoutes, { prefix: "/api" });
  await fastify.register(walletRoutes, { prefix: "/api" });
  await fastify.register(cashRefundsRoutes, { prefix: "/api" });
  await fastify.register(cashPaymentsRoutes, { prefix: "/api" });
  if (releaseFeatures.tourism) {
    await fastify.register(touristRoutes, { prefix: "/api" });
  }
  if (releaseFeatures.rentals) {
    await fastify.register(rentalRoutes, { prefix: "/api" });
  }
  await fastify.register(notificationsRoutes, { prefix: "/api" });
  await fastify.register(applicationsRoutes, { prefix: "/api" });
  if (releaseFeatures.events) {
    await fastify.register(eventTicketsRoutes, { prefix: "/api" });
    await fastify.register(adminEventTicketsRoutes, { prefix: "/api/admin" });
  }
  await fastify.register(legalDocumentsRoutes, { prefix: "/api" });
  await fastify.register(adminLegalRoutes, { prefix: "/api/admin" });
  await fastify.register(fareSettingsPublicRoutes, { prefix: "/api" });
  await fastify.register(fareSettingsAdminRoutes, { prefix: "/api/admin" });
  await fastify.register(referralsRoutes, { prefix: "/api" });
  await fastify.register(adminReferralsRoutes, { prefix: "/api/admin" });

  const retentionJob = new RetentionJob(fastify.log);
  const rideReceiptsJob = new RideReceiptsJob(fastify.log);
  const queueOfferExpiryJob = new QueueOfferExpiryJob(fastify.log);

  fastify.addHook("onReady", async () => {
    retentionJob.start();
    rideReceiptsJob.start();
    queueOfferExpiryJob.start();
  });

  fastify.addHook("onClose", async () => {
    retentionJob.stop();
    rideReceiptsJob.stop();
    queueOfferExpiryJob.stop();
  });

  return fastify;
}
