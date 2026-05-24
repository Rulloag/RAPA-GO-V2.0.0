import type { FastifyInstance } from "fastify";
import { applicationsController } from "./applications.controller.js";

export async function applicationsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post("/applications",        applicationsController.createApplication);
  fastify.get("/applications/me",      applicationsController.getMyApplications);
  fastify.get("/admin/applications",         applicationsController.listApplications);
  fastify.get("/admin/applications/:id",     applicationsController.getApplication);
  fastify.patch("/admin/applications/:id/review", applicationsController.reviewApplication);
}
