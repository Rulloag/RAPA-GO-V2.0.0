import type { FastifyInstance } from "fastify";
import { passengerProfileController } from "./passengerProfile.controller.js";

export async function passengerProfileRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get("/passengers/me/profile",     passengerProfileController.getMyProfile);
  fastify.patch("/passengers/me/profile",   passengerProfileController.upsertMyProfile);
  fastify.get("/passengers/me/preferences", passengerProfileController.getMyPreferences);
}
