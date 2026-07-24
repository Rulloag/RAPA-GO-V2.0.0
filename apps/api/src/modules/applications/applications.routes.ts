import { createHash } from "node:crypto";
import type {
  FastifyInstance,
  FastifyRequest,
} from "fastify";
import { applicationsController } from "./applications.controller.js";

/**
 * Obtiene una clave segura para limitar postulaciones.
 *
 * Los usuarios autenticados se limitan por sesión y no por la IP
 * compartida del hotel, oficina o red móvil.
 *
 * Las postulaciones sin sesión continúan limitándose por IP.
 */
function getApplicationRateLimitKey(
  request: FastifyRequest,
): string {
  const authorization = request.headers.authorization;

  if (
    typeof authorization === "string" &&
    authorization.startsWith("Bearer ")
  ) {
    const token = authorization.slice(7).trim();

    if (token) {
      const tokenHash = createHash("sha256")
        .update(token)
        .digest("hex");

      return `application-user:${tokenHash}`;
    }
  }

  return `application-ip:${request.ip}`;
}

const APPLICATION_RATE_LIMIT = {
  // Permite corregir datos y repetir pruebas sin bloquear todo el día.
  max: 10,
  timeWindow: "1 hour",
  keyGenerator: getApplicationRateLimitKey,
} as const;

export async function applicationsRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  fastify.post(
    "/applications",
    {
      config: {
        rateLimit: APPLICATION_RATE_LIMIT,
      },
    },
    applicationsController.createApplication,
  );

  fastify.get(
    "/applications/me",
    applicationsController.getMyApplications,
  );

  fastify.get(
    "/admin/applications",
    applicationsController.listApplications,
  );

  fastify.get(
    "/admin/applications/:id",
    applicationsController.getApplication,
  );

  fastify.patch(
    "/admin/applications/:id/review",
    applicationsController.reviewApplication,
  );
}