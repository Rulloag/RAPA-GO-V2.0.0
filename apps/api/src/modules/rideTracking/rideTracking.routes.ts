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

  /**
   * Un lote lleva hasta 200 puntos, así que 30/min bastan para drenar 6000
   * puntos por minuto — muy por encima de cualquier cola real— sin abrir la
   * puerta a que un cliente roto martillee el endpoint más caro.
   */
  fastify.post(
    "/:id/location/batch",
    {
      config: {
        rateLimit: {
          max: 30,
          timeWindow: "1 minute",
        },
      },
    },
    rideTrackingController.publishBatch,
  );

  fastify.get("/:id/location/latest", rideTrackingController.latest);
  fastify.get("/:id/location/route", rideTrackingController.route);
}
