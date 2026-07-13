import type { FastifyInstance } from "fastify";
import { walletTransactionsController } from "./walletTransactions.controller.js";

export async function walletTransactionsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get("/wallets/me/credits", walletTransactionsController.listMyCredits);
  fastify.post("/wallets/apply-credit", walletTransactionsController.applyCredit);

  fastify.post("/admin/wallet-transactions", walletTransactionsController.createCredit);
  fastify.post("/admin/wallet-transactions/:id/approve", walletTransactionsController.approveCredit);
  fastify.post("/admin/wallet-transactions/:id/reject", walletTransactionsController.rejectCredit);
}
