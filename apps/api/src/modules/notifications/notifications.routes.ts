import type { FastifyInstance } from "fastify";
import { notificationsController } from "./notifications.controller.js";

export async function notificationsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get("/notifications/me",              notificationsController.getMyNotifications);
  fastify.post("/notifications/mark-all-read",  notificationsController.markAllRead);
  fastify.patch("/notifications/:id/read",      notificationsController.markRead);
  fastify.patch("/notifications/:id/dismiss",   notificationsController.dismiss);
}
