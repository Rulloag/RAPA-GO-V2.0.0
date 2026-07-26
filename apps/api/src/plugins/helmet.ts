import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import fastifyHelmet from "@fastify/helmet";

/**
 * Helmet plugin — sets secure HTTP response headers.
 * Content-Security-Policy is relaxed for the API (no HTML served).
 *
 * Wrapped with fastify-plugin so this function skips its own encapsulation
 * boundary when registered — without it, @fastify/helmet's onRequest hook
 * only reaches routes registered inside this same plugin's child context,
 * never the sibling route modules registered directly on the root instance
 * in app.ts, and the security headers silently never apply anywhere.
 */
export const helmetPlugin = fp(
  async function helmetPlugin(fastify: FastifyInstance): Promise<void> {
    await fastify.register(fastifyHelmet, {
      contentSecurityPolicy: false,
    });
  },
  { name: "rapa-go-helmet" },
);
