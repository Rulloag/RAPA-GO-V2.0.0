import type { FastifyInstance } from "fastify";

import { ridesController } from "./rides.controller.js";
import { requireLegalAcceptance } from "../../shared/middleware/requireLegalAcceptance.js";

const legalCheck = requireLegalAcceptance([
  "terms_and_conditions",
  "privacy_policy",
]);

export async function ridesRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  fastify.get("/me", ridesController.listMyRides);
  fastify.get("/available", ridesController.listAvailableRides);
  fastify.get("/driver/me", ridesController.listDriverRides);

  // Cargos aprobados de la cuenta autenticada.
  fastify.get(
    "/policy-charges/me",
    ridesController.listMyApprovedPolicyCharges,
  );

  // Revisión administrativa de cancelaciones y No Show.
  fastify.get(
    "/admin/policy-charges",
    ridesController.adminListPolicyCharges,
  );

  fastify.post(
    "/admin/policy-charges/upsert-approve",
    ridesController.adminUpsertAndApprovePolicyCharge,
  );

  fastify.post(
    "/admin/policy-charges/:id/approve",
    ridesController.adminApprovePolicyCharge,
  );

  fastify.post(
    "/admin/policy-charges/:id/waive",
    ridesController.adminWaivePolicyCharge,
  );

  fastify.post(
    "/request",
    { preHandler: legalCheck },
    ridesController.createRideRequest,
  );

  fastify.post("/:id/accept", ridesController.acceptRideRequest);
  fastify.post("/:id/en-route", ridesController.markEnRoute);
  fastify.post("/:id/arrived", ridesController.markArrived);
  fastify.post("/:id/start", ridesController.startRide);
  fastify.post("/:id/complete", ridesController.completeRide);
  fastify.post("/:id/no-show", ridesController.declareNoShow);
  fastify.post("/:id/cancel", ridesController.cancelRideRequest);
  fastify.post(
    "/:id/cancel-accepted",
    ridesController.cancelAcceptedRide,
  );
}