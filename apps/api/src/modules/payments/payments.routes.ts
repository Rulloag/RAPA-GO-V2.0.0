import type { FastifyInstance } from "fastify";
import { paymentsController } from "./payments.controller.js";

export async function paymentsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post("/payments/create", paymentsController.createPayment);
  // Klap Checkout Transparente — Sandbox-only embedded order creation (Fase D).
  // Not reachable through PAYMENT_PROVIDER/getActiveProvider(); this route is the
  // controlled path used by the mobile client for embedded Klap orders.
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

  // Klap Checkout Transparente usa dos webhooks. Se conservan las rutas
  // canónicas y se agregan aliases de compatibilidad para órdenes creadas con
  // configuraciones anteriores. Todos terminan en los mismos handlers firmados.
  const klapConfirmPaths = [
    "/webhooks/klap/confirm",
    "/payments/webhooks/klap/confirm",
    "/payments/webhook/klap/confirm",
  ] as const;

  const klapRejectPaths = [
    "/webhooks/klap/reject",
    "/payments/webhooks/klap/reject",
    "/payments/webhook/klap/reject",
  ] as const;

  for (const path of klapConfirmPaths) {
    fastify.post(
      path,
      webhookOptions,
      paymentsController.klapConfirmWebhook,
    );
  }

  for (const path of klapRejectPaths) {
    fastify.post(
      path,
      webhookOptions,
      paymentsController.klapRejectWebhook,
    );
  }

  // Compatibilidad con PAYMENT_WEBHOOK_BASE_URL + /api/payments/webhook/klap.
  // El controlador discrimina confirm/reject por el contrato del payload.
  fastify.post(
    "/payments/webhook/klap",
    webhookOptions,
    paymentsController.klapUnifiedWebhook,
  );
}