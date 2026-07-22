import type { FastifyInstance } from "fastify";
import fastifyRateLimit from "@fastify/rate-limit";

/**
 * Rate limit plugin — global defaults.
 * Individual routes can override via { config: { rateLimit: { max, timeWindow } } }.
 *
 * Defaults:
 *  - 100 requests per minute per IP for general routes.
 *  - Auth and payment routes tighten limits at the route level in their own modules.
 */
export async function rateLimitPlugin(fastify: FastifyInstance): Promise<void> {
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
}
