import type { FastifyRequest, FastifyReply } from "fastify";
import { WalletService } from "./wallet.service.js";
import { listTransactionsQuerySchema } from "./wallet.schemas.js";
import { sendOk, sendError } from "../../shared/http/apiResponse.js";

const svc = new WalletService();

function getToken(req: FastifyRequest): string {
  const auth = req.headers.authorization ?? "";
  return auth.replace(/^Bearer\s+/i, "");
}

export const walletController = {
  async getMyWallet(req: FastifyRequest, reply: FastifyReply) {
    const result = await svc.getMyWallet(getToken(req));
    if (!result.ok) {
      return sendError(reply, {
        code:       result.code       ?? "INTERNAL_ERROR",
        message:    result.message    ?? "Internal error.",
        statusCode: result.statusCode ?? 500,
      });
    }
    return sendOk(reply, result.wallet);
  },

  async getMyTransactions(req: FastifyRequest, reply: FastifyReply) {
    const parsed = listTransactionsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return sendError(reply, {
        code:       "VALIDATION_ERROR",
        message:    parsed.error.errors.map((e) => e.message).join("; "),
        statusCode: 400,
      });
    }
    const result = await svc.getMyTransactions(getToken(req), parsed.data.page, parsed.data.limit);
    if (!result.ok) {
      return sendError(reply, {
        code:       result.code       ?? "INTERNAL_ERROR",
        message:    result.message    ?? "Internal error.",
        statusCode: result.statusCode ?? 500,
      });
    }
    return sendOk(reply, { items: result.items, total: result.total, page: result.page, limit: result.limit });
  },
};
