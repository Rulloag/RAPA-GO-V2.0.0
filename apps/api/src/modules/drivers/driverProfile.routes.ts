import type { FastifyInstance } from "fastify";
import { driverProfileController } from "./driverProfile.controller.js";

export async function driverProfileRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get("/drivers/me/profile",          driverProfileController.getMyProfile);
  fastify.patch("/drivers/me/profile",        driverProfileController.upsertMyProfile);
  fastify.get("/admin/drivers/:id/profile",   driverProfileController.getDriverProfile);
}
