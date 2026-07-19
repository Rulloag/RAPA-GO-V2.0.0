import type { FastifyInstance } from "fastify";
import { rideTrackingController } from "./rideTracking.controller.js";

export async function rideTrackingRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post(
    "/:id/location",
    {
      config: {
        rateLimit: {
          max: 180,
          timeWindow: "1 minute",
        },
      },
    },
    rideTrackingController.publish,
  );

  fastify.get("/:id/location/latest", rideTrackingController.latest);
  fastify.get("/:id/location/route", rideTrackingController.route);
}
