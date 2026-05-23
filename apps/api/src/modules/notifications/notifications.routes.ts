import type { FastifyInstance } from "fastify";
import { notificationsController } from "./notifications.controller.js";

export async function notificationsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get("/notifications/me",              notificationsController.getMyNotifications);
  fastify.patch("/notifications/:id/read",      notificationsController.markRead);
  fastify.patch("/notifications/:id/dismiss",   notificationsController.dismiss);
}
