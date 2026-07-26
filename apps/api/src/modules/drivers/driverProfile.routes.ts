import type { FastifyInstance } from "fastify";
import { driverProfileController } from "./driverProfile.controller.js";
import { driverComplianceController } from "./driverCompliance.controller.js";
import { driverVehiclePhotoRoutes } from "./driverVehiclePhoto.routes.js";

export async function driverProfileRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get("/drivers/me/profile",          driverProfileController.getMyProfile);
  fastify.patch("/drivers/me/profile",        driverProfileController.upsertMyProfile);
  fastify.get("/admin/drivers/:id/profile",   driverProfileController.getDriverProfile);

  fastify.get("/drivers/me/rest-schedule", driverComplianceController.getMyRestSchedule);
  fastify.patch("/drivers/me/rest-schedule", driverComplianceController.upsertMyRestSchedule);

  await driverVehiclePhotoRoutes(fastify);
}
