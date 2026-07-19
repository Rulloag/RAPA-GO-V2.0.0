import type { FastifyInstance } from "fastify";
import { paymentsController } from "./payments.controller.js";

// Provider webhooks are exempt from the global per-IP rate limit: both providers
// authenticate every call via a verified HMAC signature (see
// PaymentsService.handleWebhook -> provider.verifyWebhookSignature, checked with
// crypto.timingSafeEqual) before any processing, and handleWebhook is idempotent
// — duplicate deliveries for a payment already in a terminal state are skipped
// silently. A shared 100 req/min IP bucket risks dropping legitimate retry
// bursts from the provider's own servers (e.g. after a transient outage) with
// no security benefit, since unsigned/forged requests are already rejected
// with 401 regardless of rate.
const WEBHOOK_ROUTE_CONFIG = { config: { rateLimit: false } } as const;

export async function paymentsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post("/payments/create",                   paymentsController.createPayment);
  fastify.post("/payments/webhook/prontopaga",       WEBHOOK_ROUTE_CONFIG, paymentsController.prontoPagaWebhook);
  fastify.post("/payments/webhook/mercadopago",      WEBHOOK_ROUTE_CONFIG, paymentsController.mercadoPagoWebhook);
  fastify.post("/payments/:id/refund",               paymentsController.refundPayment);
}
