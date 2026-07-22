import type { FastifyInstance } from "fastify";
import { ratingsController } from "./ratings.controller.js";

export async function ratingsRoutes(app: FastifyInstance): Promise<void> {
  app.post("/rides/:id/rate", ratingsController.rateRide);
  app.get("/rides/:id/ratings", ratingsController.getRideRatings);
  app.get("/ratings/me/summary", ratingsController.getMySummary);
  app.get("/admin/ratings", ratingsController.listForAdmin);
  app.patch("/admin/ratings/:id/moderation", ratingsController.moderate);
}
