import type { FastifyInstance } from "fastify";
import { adminController } from "./admin.controller.js";

export async function adminRoutes(app: FastifyInstance) {
  app.get("/users",                       adminController.listUsers);
  app.patch("/users/:id/status",          adminController.updateUserStatus);
  app.get("/documents",                   adminController.listDocuments);
  app.patch("/documents/:id/review",      adminController.reviewDocument);
  app.get("/rides",                       adminController.listRides);
  app.get("/drivers/active",              adminController.listActiveDrivers);
  app.post("/rides/:id/assign",           adminController.assignDriver);
  app.post("/rides/:id/cancel",           adminController.adminCancelRide);
}
