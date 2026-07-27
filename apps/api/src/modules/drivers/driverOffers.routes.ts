import type { FastifyInstance } from "fastify";
import { driverOffersController } from "./driverOffers.controller.js";

export async function driverOffersRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get("/me/offers/active",               driverOffersController.getActiveOffer);
  fastify.post("/me/offers/:offerId/accept",      driverOffersController.acceptOffer);
  fastify.post("/me/offers/:offerId/reject",      driverOffersController.rejectOffer);
}
