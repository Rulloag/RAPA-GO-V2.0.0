import type { FastifyInstance } from "fastify";
import { fareSettingsController } from "./fareSettings.controller.js";

export async function fareSettingsPublicRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get("/fare-settings",       fareSettingsController.getActive);
  fastify.get("/fare-settings/:type", fareSettingsController.getByType);
  fastify.get("/zone-fares",          fareSettingsController.getZoneFares);
}

export async function fareSettingsAdminRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get("/fare-settings",        fareSettingsController.listAll);
  fastify.post("/fare-settings",       fareSettingsController.createFareSetting);
  fastify.patch("/fare-settings/:id",  fareSettingsController.updateFareSetting);
  fastify.post("/zone-fares",          fareSettingsController.createZoneFare);
  fastify.patch("/zone-fares/:id",     fareSettingsController.updateZoneFare);
}
