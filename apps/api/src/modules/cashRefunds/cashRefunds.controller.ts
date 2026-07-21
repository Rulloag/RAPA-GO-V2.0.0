import type { FastifyReply, FastifyRequest } from "fastify";

import { sendError, sendOk } from "../../shared/http/apiResponse.js";
import {
  approveCashOverpaymentRefundSchema,
  completeCashOverpaymentRefundSchema,
  listCashOverpaymentRefundsQuerySchema,
  rejectCashOverpaymentRefundSchema,
  requestCashOverpaymentRefundSchema,
} from "./cashRefunds.schemas.js";
import { CashRefundsService } from "./cashRefunds.service.js";

const service = new CashRefundsService();

function requireToken(
  request: FastifyRequest,
  reply: FastifyReply,
): string | null {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    sendError(reply, {
      code: "UNAUTHORIZED",
      message: "Missing Bearer token.",
      statusCode: 401,
    });
    return null;
  }
  const token = authorization.slice(7).trim();
  if (!token) {
    sendError(reply, {
      code: "UNAUTHORIZED",
      message: "Missing Bearer token.",
      statusCode: 401,
    });
    return null;
  }
  return token;
}

function sendServiceError(
  reply: FastifyReply,
  result: { code?: string; message?: string; statusCode?: number },
): void {
  sendError(reply, {
    code: result.code ?? "INTERNAL_ERROR",
    message: result.message ?? "Internal error.",
    statusCode: result.statusCode ?? 500,
  });
}

function sendValidationError(reply: FastifyReply, messages: string[]): void {
  sendError(reply, {
    code: "VALIDATION_ERROR",
    message: messages.join("; ") || "Invalid request.",
    statusCode: 400,
  });
}

export const cashRefundsController = {
  async listMine(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = requireToken(request, reply);
    if (!token) return;
    const result = await service.listMine(token);
    if (!result.ok) {
      sendServiceError(reply, result);
      return;
    }
    sendOk(reply, result.refunds);
  },

  async request(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = requireToken(request, reply);
    if (!token) return;
    const parsed = requestCashOverpaymentRefundSchema.safeParse(request.body);
    if (!parsed.success) {
      sendValidationError(
        reply,
        parsed.error.errors.map((error) => error.message),
      );
      return;
    }
    const result = await service.request(token, parsed.data);
    if (!result.ok) {
      sendServiceError(reply, result);
      return;
    }
    sendOk(reply, result.refund, result.alreadyExisted ? 200 : 201);
  },

  async listForAdmin(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const token = requireToken(request, reply);
    if (!token) return;
    const parsed = listCashOverpaymentRefundsQuerySchema.safeParse(
      request.query,
    );
    if (!parsed.success) {
      sendValidationError(
        reply,
        parsed.error.errors.map((error) => error.message),
      );
      return;
    }
    const result = await service.listForAdmin(
      token,
      parsed.data.status === "all" ? undefined : parsed.data.status,
    );
    if (!result.ok) {
      sendServiceError(reply, result);
      return;
    }
    sendOk(reply, result.refunds);
  },

  async transferDetails(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const token = requireToken(request, reply);
    if (!token) return;
    const result = await service.getTransferDetails(token, request.params.id);
    if (!result.ok) {
      sendServiceError(reply, result);
      return;
    }
    sendOk(reply, result.transfer);
  },

  async approve(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const token = requireToken(request, reply);
    if (!token) return;
    const parsed = approveCashOverpaymentRefundSchema.safeParse(
      request.body ?? {},
    );
    if (!parsed.success) {
      sendValidationError(
        reply,
        parsed.error.errors.map((error) => error.message),
      );
      return;
    }
    const result = await service.approve(token, request.params.id, parsed.data);
    if (!result.ok) {
      sendServiceError(reply, result);
      return;
    }
    sendOk(reply, result.refund);
  },

  async reject(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const token = requireToken(request, reply);
    if (!token) return;
    const parsed = rejectCashOverpaymentRefundSchema.safeParse(request.body);
    if (!parsed.success) {
      sendValidationError(
        reply,
        parsed.error.errors.map((error) => error.message),
      );
      return;
    }
    const result = await service.reject(token, request.params.id, parsed.data);
    if (!result.ok) {
      sendServiceError(reply, result);
      return;
    }
    sendOk(reply, result.refund);
  },

  async complete(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const token = requireToken(request, reply);
    if (!token) return;
    const parsed = completeCashOverpaymentRefundSchema.safeParse(request.body);
    if (!parsed.success) {
      sendValidationError(
        reply,
        parsed.error.errors.map((error) => error.message),
      );
      return;
    }
    const result = await service.complete(token, request.params.id, parsed.data);
    if (!result.ok) {
      sendServiceError(reply, result);
      return;
    }
    sendOk(reply, result.refund);
  },
};
