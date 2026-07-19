import type { FastifyInstance } from "fastify";

import { accountDeletionController } from "./accountDeletion.controller.js";

export async function accountDeletionRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  fastify.get("/me", accountDeletionController.getMine);
  fastify.post("/requests", accountDeletionController.create);

  fastify.post(
    "/public/code",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "15 minutes",
        },
      },
    },
    accountDeletionController.publicRequestCode,
  );

  fastify.post(
    "/public/requests",
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "15 minutes",
        },
      },
    },
    accountDeletionController.publicSubmit,
  );

  fastify.get(
    "/public/status",
    {
      config: {
        rateLimit: {
          max: 30,
          timeWindow: "15 minutes",
        },
      },
    },
    accountDeletionController.publicStatus,
  );
}

export async function adminAccountDeletionRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  fastify.get(
    "/requests",
    accountDeletionController.adminList,
  );

  fastify.post(
    "/requests/:id/reject",
    accountDeletionController.adminReject,
  );

  fastify.post(
    "/requests/:id/approve",
    accountDeletionController.adminApprove,
  );
}
