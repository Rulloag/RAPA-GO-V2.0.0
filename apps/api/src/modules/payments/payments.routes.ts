import type { FastifyInstance } from "fastify";
import { paymentsController } from "./payments.controller.js";

export async function paymentsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post("/payments/create", paymentsController.createPayment);
  fastify.get("/payments/:paymentId/status", paymentsController.getPaymentStatus);
  fastify.get("/payments/:paymentId/receipt", paymentsController.getPaymentReceipt);
  fastify.post("/payments/webhook/prontopaga", paymentsController.prontoPagaWebhook);
  fastify.post("/payments/webhook/mercadopago", paymentsController.mercadoPagoWebhook);
}