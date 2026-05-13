import type { FastifyInstance } from "fastify";
import { bankAccountsController } from "./bankAccounts.controller.js";

export async function bankAccountsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get("/me",  bankAccountsController.getBankAccount);
  fastify.put("/me",  bankAccountsController.upsertBankAccount);
}
