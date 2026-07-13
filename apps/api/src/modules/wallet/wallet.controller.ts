import type { FastifyRequest, FastifyReply } from "fastify";
import { WalletService } from "./wallet.service.js";
import {
  createPaymentOrderSchema,
  webhookPayloadSchema,
  listTransactionsQuerySchema,
  adminCreateWalletCreditSchema,
} from "./wallet.schemas.js";
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

  async createPaymentOrder(req: FastifyRequest, reply: FastifyReply) {
    const parsed = createPaymentOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(reply, {
        code:       "VALIDATION_ERROR",
        message:    parsed.error.errors.map((e) => e.message).join("; "),
        statusCode: 400,
      });
    }
    const result = await svc.createPaymentOrder(getToken(req), parsed.data);
    if (!result.ok) {
      return sendError(reply, {
        code:       result.code       ?? "INTERNAL_ERROR",
        message:    result.message    ?? "Internal error.",
        statusCode: result.statusCode ?? 500,
      });
    }
    return sendOk(reply, result.order, 201);
  },

  async adminCreateWalletCredit(req: FastifyRequest, reply: FastifyReply) {
    const token = getToken(req);
    if (!token) {
      return sendError(reply, {
        code: "UNAUTHORIZED",
        message: "Missing access token.",
        statusCode: 401,
      });
    }

    const parsed = adminCreateWalletCreditSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(reply, {
        code: "VALIDATION_ERROR",
        message: parsed.error.errors.map((e) => e.message).join("; "),
        statusCode: 400,
      });
    }

    const result = await svc.adminCreateWalletCredit(token, parsed.data);
    if (!result.ok) {
      return sendError(reply, {
        code: result.code ?? "INTERNAL_ERROR",
        message: result.message ?? "Internal error.",
        statusCode: result.statusCode ?? 500,
      });
    }

    return sendOk(reply, { wallet: result.wallet, transaction: result.transaction }, 201);
  },

  async handleWebhook(req: FastifyRequest, reply: FastifyReply) {
    const parsed = webhookPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(reply, {
        code:       "VALIDATION_ERROR",
        message:    parsed.error.errors.map((e) => e.message).join("; "),
        statusCode: 400,
      });
    }
    const result = await svc.handleWebhook(parsed.data);
    if (!result.ok) {
      return sendError(reply, {
        code:       result.code       ?? "INTERNAL_ERROR",
        message:    result.message    ?? "Internal error.",
        statusCode: result.statusCode ?? 500,
      });
    }
    return sendOk(reply, result.order);
  },
};
