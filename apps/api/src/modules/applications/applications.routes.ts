import { createHash } from "node:crypto";
import type {
  FastifyInstance,
  FastifyRequest,
} from "fastify";
import { applicationsController } from "./applications.controller.js";

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
  max: 10,
  timeWindow: "1 hour",
  keyGenerator: getApplicationRateLimitKey,
} as const;

const APPLICATION_FILE_RATE_LIMIT = {
  max: 40,
  timeWindow: "1 hour",
  keyGenerator: getApplicationRateLimitKey,
} as const;

const APPLICATION_FILE_BODY_LIMIT = 700_000;
const APPLICATION_FILE_CONTENT_TYPE =
  /^(?:image\/jpeg|image\/png|image\/webp|application\/pdf)(?:\s*;.*)?$/i;

export async function applicationsRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  fastify.addContentTypeParser(
    APPLICATION_FILE_CONTENT_TYPE,
    {
      parseAs: "buffer",
      bodyLimit: APPLICATION_FILE_BODY_LIMIT,
    },
    (_request, body, done) => {
      done(null, body);
    },
  );

  fastify.post(
    "/applications",
    {
      config: {
        rateLimit: APPLICATION_RATE_LIMIT,
      },
    },
    applicationsController.createApplication,
  );

  fastify.post(
    "/applications/:id/files/:kind",
    {
      bodyLimit: APPLICATION_FILE_BODY_LIMIT,
      config: {
        rateLimit: APPLICATION_FILE_RATE_LIMIT,
      },
    },
    applicationsController.uploadApplicationFile,
  );

  fastify.get(
    "/applications/me",
    applicationsController.getMyApplications,
  );

  fastify.get(
    "/applications/:id/contract",
    applicationsController.getApplicationContract,
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

  fastify.post(
    "/admin/applications/:id/contract/resend",
    applicationsController.resendApplicationContract,
  );

  fastify.post(
    "/admin/applications/:id/approval/resend",
    applicationsController.resendApplicationApproval,
  );
}
