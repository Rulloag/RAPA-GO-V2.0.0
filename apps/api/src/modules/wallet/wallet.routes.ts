import type { FastifyInstance } from "fastify";
import { walletController } from "./wallet.controller.js";

export async function walletRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get("/wallets/me",              walletController.getMyWallet);
  fastify.get("/wallets/me/transactions", walletController.getMyTransactions);
  fastify.post("/payments/create-order",  walletController.createPaymentOrder);
  fastify.post("/payments/webhook",       walletController.handleWebhook);
}
