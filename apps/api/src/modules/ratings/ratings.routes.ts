import type { FastifyInstance } from "fastify";
import { ratingsController } from "./ratings.controller.js";

export async function ratingsRoutes(app: FastifyInstance) {
  app.post("/rides/:id/rate",    ratingsController.rateRide);
  app.get("/rides/:id/ratings",  ratingsController.getRideRatings);
}
