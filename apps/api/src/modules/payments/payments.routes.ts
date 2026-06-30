import type { FastifyInstance } from "fastify";
import { paymentsController } from "./payments.controller.js";

export async function paymentsRoutes(app: FastifyInstance): Promise<void> {
  app.post("/prontopaga/create", paymentsController.createProntoPaga);
  app.post("/prontopaga/webhook", paymentsController.webhookProntoPaga);
  app.get("/prontopaga/demo-checkout", paymentsController.demoCheckout);
}