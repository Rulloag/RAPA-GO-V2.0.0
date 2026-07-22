import type { FastifyInstance } from "fastify";
import { driverStatusController } from "./driverStatus.controller.js";

export async function driverStatusRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get("/me/status",          driverStatusController.getMyStatus);
  fastify.patch("/me/status",        driverStatusController.updateMyStatus);
  fastify.patch("/me/location",      driverStatusController.updateMyLocation);
  fastify.get("/me/earnings/today",  driverStatusController.getTodayEarnings);
}
