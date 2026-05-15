import type { FastifyInstance } from "fastify";
import fastifyCors from "@fastify/cors";

/**
 * CORS plugin.
 * Origin is controlled by CORS_ORIGIN env var.
 * Defaults to localhost dev origins so the server is never open to all origins in production.
 */
export async function corsPlugin(fastify: FastifyInstance): Promise<void> {
  const rawOrigin = process.env["CORS_ORIGIN"];

  let origin: string | string[] | boolean;

  if (rawOrigin) {
    // Support comma-separated list: "https://app.rapago.cl,https://admin.rapago.cl"
    const parts = rawOrigin.split(",").map((s) => s.trim()).filter(Boolean);
    origin = parts.length === 1 ? (parts[0] as string) : parts;
  } else {
    // Safe development defaults — never wildcard in production
    origin =
      process.env["NODE_ENV"] === "production"
        ? false
        : ["http://localhost:5173", "http://localhost:5174", "http://localhost:8100", "http://localhost:3000"];
  }

  await fastify.register(fastifyCors, {
    origin,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  });
}
