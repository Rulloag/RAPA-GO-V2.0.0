import type { FastifyInstance } from "fastify";
import { adminController } from "./admin.controller.js";

export async function adminRoutes(app: FastifyInstance) {
  app.get("/users",              adminController.listUsers);
  app.patch("/users/:id/status", adminController.updateUserStatus);
}
