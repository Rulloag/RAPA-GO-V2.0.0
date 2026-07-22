import type { FastifyInstance } from "fastify";
import { cashPaymentsController } from "./cashPayments.controller.js";

export async function cashPaymentsRoutes(app: FastifyInstance): Promise<void> {
  app.post("/cash-payments/rides/:rideId/close", cashPaymentsController.close);
  app.get("/cash-payments/rides/:rideId", cashPaymentsController.getByRide);
  app.get("/cash-payments/me", cashPaymentsController.listMine);
  app.get("/admin/cash-payments", cashPaymentsController.listAdmin);
}
