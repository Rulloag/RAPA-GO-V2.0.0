import type { FastifyInstance } from "fastify";
import fastifyHelmet from "@fastify/helmet";

/**
 * Helmet plugin — sets secure HTTP response headers.
 * Content-Security-Policy is relaxed for the API (no HTML served).
 */
export async function helmetPlugin(fastify: FastifyInstance): Promise<void> {
  await fastify.register(fastifyHelmet, {
    contentSecurityPolicy: false,
  });
}
