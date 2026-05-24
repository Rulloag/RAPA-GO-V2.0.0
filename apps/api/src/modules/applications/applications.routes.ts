import type { FastifyInstance } from "fastify";
import { applicationsController } from "./applications.controller.js";

export async function applicationsRoutes(fastify: FastifyInstance): Promise<void> {
  // 3 postulaciones por IP por día (86 400 000 ms = 24 h)
  fastify.post("/applications", { config: { rateLimit: { max: 3, timeWindow: 86_400_000 } } }, applicationsController.createApplication);
  fastify.get("/applications/me",      applicationsController.getMyApplications);
  fastify.get("/admin/applications",         applicationsController.listApplications);
  fastify.get("/admin/applications/:id",     applicationsController.getApplication);
  fastify.patch("/admin/applications/:id/review", applicationsController.reviewApplication);
}
