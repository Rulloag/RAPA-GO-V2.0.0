import type { FastifyInstance } from "fastify";

import { rideReceiptsController } from "./rideReceipts.controller.js";

export async function rideReceiptsRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  fastify.get(
    "/ride-receipts",
    rideReceiptsController.listMine,
  );

  fastify.get(
    "/ride-receipts/:id/pdf",
    rideReceiptsController.download,
  );

  fastify.get(
    "/admin/ride-receipts",
    rideReceiptsController.listAdmin,
  );

  fastify.post(
    "/admin/ride-receipts/:id/resend",
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 hour",
        },
      },
    },
    rideReceiptsController.resendAdmin,
  );
}
