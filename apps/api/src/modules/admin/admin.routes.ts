import type { FastifyInstance } from "fastify";
import { adminController } from "./admin.controller.js";
import { dashboardRoutes } from "./dashboard.routes.js";
import { driverComplianceController } from "../drivers/driverCompliance.controller.js";

export async function adminRoutes(app: FastifyInstance) {
  await app.register(dashboardRoutes);

  app.get("/users",                       adminController.listUsers);
  app.patch("/users/:id/status",          adminController.updateUserStatus);
  app.get("/documents",                   adminController.listDocuments);
  app.patch("/documents/:id/review",      adminController.reviewDocument);
  app.get("/rides",                       adminController.listRides);
  app.get("/drivers/active",              adminController.listActiveDrivers);
  app.post("/rides/:id/assign",                       adminController.assignDriver);
  app.post("/rides/:id/cancel",                       adminController.adminCancelRide);
  app.post("/offline-bookings/:id/sync-to-ride",      adminController.syncToRide);

  app.get("/compliance/ride-assignments", driverComplianceController.adminListAssignmentReport);
  app.get("/compliance/driver-rest-periods", driverComplianceController.adminListRestPeriodReport);
  app.get("/compliance/driver-service-schedules", driverComplianceController.adminListServiceSchedules);
}
