import type { FastifyInstance } from "fastify";
import { touristController } from "./tourist.controller.js";
import { requireLegalAcceptance } from "../../shared/middleware/requireLegalAcceptance.js";

const legalCheck = requireLegalAcceptance(["terms_and_conditions", "privacy_policy"]);

export async function touristRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get("/guides",                              touristController.listGuides);
  fastify.get("/guides/me/services",                  touristController.getMyServices);
  fastify.get("/guides/me/bookings",                  touristController.getGuideBookings);
  fastify.post("/guides/me/services",                 touristController.createService);
  fastify.patch("/guides/me/services/:serviceId",     touristController.updateService);
  fastify.patch("/guides/me/services/:serviceId/status", touristController.setServiceStatus);
  fastify.get("/guides/:id",                          touristController.getGuide);
  fastify.get("/guides/:id/services",                 touristController.listGuideServices);
  fastify.get("/services/:id/pricing",                touristController.getServicePricing);
  fastify.post("/service-bookings", { preHandler: legalCheck }, touristController.createBooking);
  fastify.get("/service-bookings/me",                 touristController.getMyBookings);
  fastify.patch("/service-bookings/:id/cancel",       touristController.cancelBooking);
  fastify.patch("/guides/me/bookings/:id/confirm",    touristController.confirmBooking);
  fastify.patch("/guides/me/bookings/:id/complete",   touristController.completeBooking);
}
