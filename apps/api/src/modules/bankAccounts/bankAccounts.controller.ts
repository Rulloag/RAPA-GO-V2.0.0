import type { FastifyRequest, FastifyReply } from "fastify";
import { BankAccountsService } from "./bankAccounts.service.js";
import { upsertBankAccountSchema } from "./bankAccounts.schemas.js";
import { sendOk, sendError } from "../../shared/http/apiResponse.js";

const bankAccountsService = new BankAccountsService();

function extractBearer(request: FastifyRequest): string | null {
  const auth = request.headers["authorization"];
  if (!auth || !auth.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

export const bankAccountsController = {
  async getBankAccount(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) {
      sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 });
      return;
    }
    const result = await bankAccountsService.getBankAccount(token);
    if (!result.ok) {
      sendError(reply, { code: result.code, message: result.message, statusCode: result.statusCode });
      return;
    }
    sendOk(reply, result.account);
  },

  async upsertBankAccount(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) {
      sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 });
      return;
    }
    const parsed = upsertBankAccountSchema.safeParse(request.body);
    if (!parsed.success) {
      sendError(reply, {
        code:       "VALIDATION_ERROR",
        message:    parsed.error.errors[0]?.message ?? "Invalid request body.",
        statusCode: 400,
      });
      return;
    }
    const result = await bankAccountsService.upsertBankAccount(token, parsed.data);
    if (!result.ok) {
      sendError(reply, { code: result.code, message: result.message, statusCode: result.statusCode });
      return;
    }
    sendOk(reply, result.account);
  },
};
