import type { FastifyInstance } from "fastify";
import { dashboardController } from "./dashboard.controller.js";

export async function dashboardRoutes(app: FastifyInstance) {
  app.get("/dashboard",          dashboardController.getDashboard);
  app.get("/dashboard/activity", dashboardController.getActivity);
}
