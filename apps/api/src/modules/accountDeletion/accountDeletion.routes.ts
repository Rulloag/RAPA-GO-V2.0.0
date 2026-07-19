import type { FastifyInstance } from "fastify";

import { accountDeletionController } from "./accountDeletion.controller.js";

export async function accountDeletionRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get("/me", accountDeletionController.getMine);

  app.post(
    "/requests",
    {
      config: {
        rateLimit: {
          max: 3,
          timeWindow: "1 hour",
        },
      },
    },
    accountDeletionController.create,
  );
}

export async function adminAccountDeletionRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get(
    "/requests",
    accountDeletionController.adminList,
  );

  app.post(
    "/requests/:id/reject",
    accountDeletionController.adminReject,
  );

  app.post(
    "/requests/:id/approve",
    accountDeletionController.adminApprove,
  );
}
