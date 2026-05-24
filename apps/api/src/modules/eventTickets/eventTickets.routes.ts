import type { FastifyInstance } from "fastify";
import { eventTicketsController } from "./eventTickets.controller.js";

export async function eventTicketsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post("/event-tickets",                       eventTicketsController.createTicket);
  fastify.get("/event-tickets/me",                     eventTicketsController.getMyTickets);
  fastify.post("/event-tickets/validate-by-code",      eventTicketsController.validateByCode);
  fastify.get("/event-tickets/:id/qr",                 eventTicketsController.getTicketQr);
  fastify.post("/event-tickets/:id/validate",          eventTicketsController.validateTicket);
}

export async function adminEventTicketsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get("/event-tickets/validations", eventTicketsController.getRecentValidations);
}
