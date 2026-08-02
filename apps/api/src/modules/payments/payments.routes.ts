import type { FastifyInstance } from "fastify";
import { paymentsController } from "./payments.controller.js";

export async function paymentsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post("/payments/create", paymentsController.createPayment);
  // Klap Checkout Transparente — Sandbox-only embedded order creation (Fase D).
  // Not reachable through PAYMENT_PROVIDER/getActiveProvider(); this route is the
  // only controlled path to Klap in this phase. No webhook route for Klap yet.
  fastify.post("/payments/klap/orders", paymentsController.createKlapEmbeddedOrder);
  fastify.get("/payments/:paymentId/status", paymentsController.getPaymentStatus);
  fastify.get("/payments/:paymentId/receipt", paymentsController.getPaymentReceipt);
  fastify.get(
    "/payments/return/mercadopago",
    paymentsController.mercadoPagoBrowserReturn,
  );
  fastify.post(
    "/payments/:paymentId/reconcile/mercadopago",
    paymentsController.reconcileMercadoPagoPayment,
  );
  const webhookOptions = {
    config: {
      // Los proveedores reintentan automáticamente sus notificaciones.
      // La firma criptográfica es la protección de estas rutas; aplicar el
      // límite global puede perder confirmaciones de pago legítimas.
      rateLimit: false,
    },
  } as const;

  fastify.post(
    "/payments/webhook/prontopaga",
    webhookOptions,
    paymentsController.prontoPagaWebhook,
  );
  fastify.post(
    "/payments/webhook/mercadopago",
    webhookOptions,
    paymentsController.mercadoPagoWebhook,
  );

  // Klap Checkout Transparente — confirm/reject webhooks (Fase C). Separate
  // endpoints per Klap's own documented payloads (not a single unified event
  // like Mercado Pago/ProntoPaga above). Same rate-limit exemption rationale:
  // the "apikey" signature is the real protection here.
  fastify.post(
    "/webhooks/klap/confirm",
    webhookOptions,
    paymentsController.klapConfirmWebhook,
  );
  fastify.post(
    "/webhooks/klap/reject",
    webhookOptions,
    paymentsController.klapRejectWebhook,
  );
}