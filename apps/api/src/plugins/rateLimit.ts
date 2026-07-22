import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import fastifyRateLimit from "@fastify/rate-limit";

/**
 * Rate limit plugin — global defaults.
 * Individual routes can override via { config: { rateLimit: { max, timeWindow } } }.
 *
 * Defaults:
 *  - 100 requests per minute per IP for general routes.
 *  - Auth and payment routes tighten limits at the route level in their own modules.
 *
 * Wrapped with fastify-plugin so this function skips its own encapsulation
 * boundary when registered — without it, @fastify/rate-limit's global hook
 * only reaches routes registered inside this same plugin's child context,
 * never the sibling route modules registered directly on the root instance
 * in app.ts, and the global limit silently never applies anywhere.
 */
export const rateLimitPlugin = fp(
  async function rateLimitPlugin(fastify: FastifyInstance): Promise<void> {
    await fastify.register(fastifyRateLimit, {
      global: true,
      max: 100,
      timeWindow: "1 minute",
      errorResponseBuilder: (_request, context) => ({
        ok: false,
        code: "RATE_LIMIT_EXCEEDED",
        message: `Too many requests. Retry after ${String(context.after)}.`,
        statusCode: 429,
      }),
    });
  },
  { name: "rapa-go-rate-limit" },
);
