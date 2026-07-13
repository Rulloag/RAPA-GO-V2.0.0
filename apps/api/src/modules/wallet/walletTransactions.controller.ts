import type { FastifyRequest, FastifyReply } from "fastify";
import { WalletTransactionsService } from "./walletTransactions.service.js";
import {
  adminCreateCreditSchema,
  adminModerateCreditSchema,
  applyCreditSchema,
  listMyCreditsQuerySchema,
} from "./walletTransactions.schemas.js";
import { sendOk, sendError } from "../../shared/http/apiResponse.js";

const svc = new WalletTransactionsService();

function getToken(req: FastifyRequest): string {
  const auth = req.headers.authorization ?? "";
  return auth.replace(/^Bearer\s+/i, "");
}

function fail(reply: FastifyReply, result: { code?: string; message?: string; statusCode?: number }) {
  return sendError(reply, {
    code:       result.code       ?? "INTERNAL_ERROR",
    message:    result.message    ?? "Internal error.",
    statusCode: result.statusCode ?? 500,
  });
}

export const walletTransactionsController = {
  async listMyCredits(req: FastifyRequest, reply: FastifyReply) {
    const parsed = listMyCreditsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return sendError(reply, { code: "VALIDATION_ERROR", message: parsed.error.errors.map((e) => e.message).join("; "), statusCode: 400 });
    }
    const result = await svc.listMyCredits(getToken(req), parsed.data.status);
    if (!result.ok) return fail(reply, result);
    return sendOk(reply, { items: result.items, availableBalanceClp: result.availableBalanceClp });
  },

  async createCredit(req: FastifyRequest, reply: FastifyReply) {
    const parsed = adminCreateCreditSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(reply, { code: "VALIDATION_ERROR", message: parsed.error.errors.map((e) => e.message).join("; "), statusCode: 400 });
    }
    const result = await svc.createCredit(getToken(req), parsed.data);
    if (!result.ok) return fail(reply, result);
    return sendOk(reply, result.transaction, result.idempotentReplay ? 200 : 201);
  },

  async approveCredit(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const parsed = adminModerateCreditSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(reply, { code: "VALIDATION_ERROR", message: parsed.error.errors.map((e) => e.message).join("; "), statusCode: 400 });
    }
    const result = await svc.approveCredit(getToken(req), req.params.id, parsed.data);
    if (!result.ok) return fail(reply, result);
    return sendOk(reply, result.transaction);
  },

  async rejectCredit(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const parsed = adminModerateCreditSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return sendError(reply, { code: "VALIDATION_ERROR", message: parsed.error.errors.map((e) => e.message).join("; "), statusCode: 400 });
    }
    const result = await svc.rejectCredit(getToken(req), req.params.id, parsed.data);
    if (!result.ok) return fail(reply, result);
    return sendOk(reply, result.transaction);
  },

  async applyCredit(req: FastifyRequest, reply: FastifyReply) {
    const parsed = applyCreditSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(reply, { code: "VALIDATION_ERROR", message: parsed.error.errors.map((e) => e.message).join("; "), statusCode: 400 });
    }
    const result = await svc.applyCredit(getToken(req), parsed.data);
    if (!result.ok) return fail(reply, result);
    return sendOk(reply, result.transaction, result.idempotentReplay ? 200 : 201);
  },
};
