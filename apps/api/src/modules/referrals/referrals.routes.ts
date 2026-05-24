import type { FastifyInstance } from "fastify";
import { referralsController } from "./referrals.controller.js";

export async function referralsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get("/referrals/me",       referralsController.getMyReferral);
  fastify.post("/referrals/generate", referralsController.generateCode);
  fastify.post("/referrals/apply",   referralsController.applyCode);
  fastify.post("/referrals/convert", referralsController.convertReferral);
}

export async function adminReferralsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get("/referrals",              referralsController.adminListCodes);
  fastify.get("/referrals/:id/uses",     referralsController.adminListUses);
  fastify.post("/referrals/campaigns",   referralsController.adminCreateCampaignCode);
}
