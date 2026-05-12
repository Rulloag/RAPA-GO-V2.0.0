/**
 * RAPA GO API — Entry point
 *
 * This file starts the Fastify server.
 * Business modules (auth, trips, wallet, payments, etc.) are NOT registered here yet.
 * They will be added in subsequent phases once their architecture is reviewed.
 *
 * Current state: health check only.
 */

import Fastify from "fastify";
import { authRoutes } from "./modules/auth/auth.routes.js";

const server = Fastify({
  logger: {
    level: process.env["NODE_ENV"] === "production" ? "warn" : "info",
  },
});

// Health check — no auth, no business logic
server.get("/health", async () => {
  return {
    status: "ok",
    service: "rapa-go-api",
    version: "2.0.0",
    timestamp: new Date().toISOString(),
  };
});

// Auth module — placeholder, returns AUTH_NOT_IMPLEMENTED until provider is wired
await server.register(authRoutes, { prefix: "/api/auth" });

const start = async (): Promise<void> => {
  const port = Number(process.env["PORT"] ?? 3000);
  const host = process.env["HOST"] ?? "0.0.0.0";

  try {
    await server.listen({ port, host });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

await start();
