import type { FastifyInstance } from "fastify";
import { offlineController } from "./offline.controller.js";

export async function offlineRoutes(app: FastifyInstance) {
  // Admin — offline bookings management
  app.post("/admin/offline-bookings",              offlineController.createOfflineBooking);
  app.get("/admin/offline-bookings",               offlineController.listOfflineBookings);
  app.patch("/admin/offline-bookings/:id/sync",    offlineController.syncOfflineBooking);
  app.patch("/admin/offline-bookings/:id/cancel",  offlineController.cancelOfflineBooking);

  // Any authenticated user — connectivity + sync queue
  app.post("/connectivity-check",          { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, offlineController.connectivityCheck);
  app.get("/sync-queue",                   offlineController.getSyncQueue);
  app.post("/sync-queue/:id/confirm",      offlineController.confirmSyncItem);
}
