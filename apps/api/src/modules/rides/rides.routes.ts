import type { FastifyInstance } from "fastify";
import { ridesController } from "./rides.controller.js";

export async function ridesRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get("/me",               ridesController.listMyRides);
  fastify.get("/available",        ridesController.listAvailableRides);
  fastify.post("/request",         ridesController.createRideRequest);
  fastify.post("/:id/cancel",      ridesController.cancelRideRequest);
}
