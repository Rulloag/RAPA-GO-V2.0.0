import type { FastifyInstance } from "fastify";
import { paymentsController } from "./payments.controller.js";

export async function paymentsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post("/payments/create",                   paymentsController.createPayment);
  fastify.post("/payments/webhook/prontopaga",       paymentsController.prontoPagaWebhook);
  fastify.post("/payments/webhook/mercadopago",      paymentsController.mercadoPagoWebhook);
  fastify.post("/payments/:id/refund",               paymentsController.refundPayment);
}
