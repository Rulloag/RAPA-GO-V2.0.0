import type { FastifyInstance } from "fastify";
import { ridesController } from "./rides.controller.js";

export async function ridesRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get("/me",               ridesController.listMyRides);
  fastify.get("/available",        ridesController.listAvailableRides);
  fastify.get("/driver/me",        ridesController.listDriverRides);
  fastify.post("/request",         ridesController.createRideRequest);
  fastify.post("/:id/accept",          ridesController.acceptRideRequest);
  fastify.post("/:id/en-route",        ridesController.markEnRoute);
  fastify.post("/:id/arrived",         ridesController.markArrived);
  fastify.post("/:id/start",           ridesController.startRide);
  fastify.post("/:id/complete",        ridesController.completeRide);
  fastify.post("/:id/cancel",          ridesController.cancelRideRequest);
  fastify.post("/:id/cancel-accepted", ridesController.cancelAcceptedRide);
}
