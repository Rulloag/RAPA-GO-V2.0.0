import type { FastifyReply, FastifyRequest } from "fastify";

import { sendError, sendOk } from "../../shared/http/apiResponse.js";
import {
  adminCreateWalletCreditSchema,
  adminReviewCashOverpaymentBenefitSchema,
  createPaymentOrderSchema,
  listCashOverpaymentBenefitsQuerySchema,
  listTransactionsQuerySchema,
  requestCashOverpaymentBenefitSchema,
  webhookPayloadSchema,
} from "./wallet.schemas.js";
import { WalletService } from "./wallet.service.js";

const service = new WalletService();

function extractBearer(request: FastifyRequest): string | null {
  const auth = request.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  return token || null;
}

function requireToken(
  request: FastifyRequest,
  reply: FastifyReply,
): string | null {
  const token = extractBearer(request);

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

function sendValidationError(
  reply: FastifyReply,
  messages: string[],
): void {
  sendError(reply, {
    code: "VALIDATION_ERROR",
    message: messages.join("; ") || "Invalid request.",
    statusCode: 400,
  });
}

export const walletController = {
  async getMyWallet(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const token = requireToken(request, reply);
    if (!token) return;

    const result = await service.getMyWallet(token);
    if (!result.ok) {
      sendServiceError(reply, result);
      return;
    }

    sendOk(reply, result.wallet);
  },

  async getMyTransactions(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const token = requireToken(request, reply);
    if (!token) return;

    const parsed = listTransactionsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      sendValidationError(
        reply,
        parsed.error.errors.map((error) => error.message),
      );
      return;
    }

    const result = await service.getMyTransactions(
      token,
      parsed.data.page,
      parsed.data.limit,
    );

    if (!result.ok) {
      sendServiceError(reply, result);
      return;
    }

    sendOk(reply, {
      items: result.items,
      total: result.total,
      page: result.page,
      limit: result.limit,
    });
  },

  async listMyCashOverpaymentBenefits(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const token = requireToken(request, reply);
    if (!token) return;

    const result = await service.listMyCashOverpaymentBenefits(token);
    if (!result.ok) {
      sendServiceError(reply, result);
      return;
    }

    sendOk(reply, result.benefits);
  },

  async requestCashOverpaymentBenefit(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const token = requireToken(request, reply);
    if (!token) return;

    const parsed = requestCashOverpaymentBenefitSchema.safeParse(
      request.body,
    );

    if (!parsed.success) {
      sendValidationError(
        reply,
        parsed.error.errors.map((error) => error.message),
      );
      return;
    }

    const result = await service.requestCashOverpaymentBenefit(
      token,
      parsed.data,
    );

    if (!result.ok) {
      sendServiceError(reply, result);
      return;
    }

    sendOk(reply, result.benefit, result.alreadyExisted ? 200 : 201);
  },

  async adminListCashOverpaymentBenefits(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const token = requireToken(request, reply);
    if (!token) return;

    const parsed = listCashOverpaymentBenefitsQuerySchema.safeParse(
      request.query,
    );

    if (!parsed.success) {
      sendValidationError(
        reply,
        parsed.error.errors.map((error) => error.message),
      );
      return;
    }

    const result = await service.adminListCashOverpaymentBenefits(
      token,
      parsed.data.status === "all" ? undefined : parsed.data.status,
    );

    if (!result.ok) {
      sendServiceError(reply, result);
      return;
    }

    sendOk(reply, result.benefits);
  },

  async adminApproveCashOverpaymentBenefit(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const token = requireToken(request, reply);
    if (!token) return;

    const parsed = adminReviewCashOverpaymentBenefitSchema.safeParse(
      request.body ?? {},
    );

    if (!parsed.success) {
      sendValidationError(
        reply,
        parsed.error.errors.map((error) => error.message),
      );
      return;
    }

    const result = await service.adminApproveCashOverpaymentBenefit(
      token,
      request.params.id,
      parsed.data,
    );

    if (!result.ok) {
      sendServiceError(reply, result);
      return;
    }

    sendOk(reply, {
      benefit: result.benefit,
      wallet: result.wallet,
      transaction: result.transaction,
      alreadyApproved: result.alreadyApproved,
    });
  },

  async adminApproveCashOverpaymentBenefitByRide(
    request: FastifyRequest<{ Params: { rideId: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const token = requireToken(request, reply);
    if (!token) return;

    const parsed = adminReviewCashOverpaymentBenefitSchema.safeParse(
      request.body ?? {},
    );

    if (!parsed.success) {
      sendValidationError(
        reply,
        parsed.error.errors.map((error) => error.message),
      );
      return;
    }

    const result =
      await service.adminApproveCashOverpaymentBenefitByRide(
        token,
        request.params.rideId,
        parsed.data,
      );

    if (!result.ok) {
      sendServiceError(reply, result);
      return;
    }

    sendOk(reply, {
      benefit: result.benefit,
      wallet: result.wallet,
      transaction: result.transaction,
      alreadyApproved: result.alreadyApproved,
    });
  },

  async adminRejectCashOverpaymentBenefit(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const token = requireToken(request, reply);
    if (!token) return;

    const parsed = adminReviewCashOverpaymentBenefitSchema.safeParse(
      request.body ?? {},
    );

    if (!parsed.success) {
      sendValidationError(
        reply,
        parsed.error.errors.map((error) => error.message),
      );
      return;
    }

    const result = await service.adminRejectCashOverpaymentBenefit(
      token,
      request.params.id,
      parsed.data,
    );

    if (!result.ok) {
      sendServiceError(reply, result);
      return;
    }

    sendOk(reply, result.benefit);
  },

  async adminRejectCashOverpaymentBenefitByRide(
    request: FastifyRequest<{ Params: { rideId: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const token = requireToken(request, reply);
    if (!token) return;

    const parsed = adminReviewCashOverpaymentBenefitSchema.safeParse(
      request.body ?? {},
    );

    if (!parsed.success) {
      sendValidationError(
        reply,
        parsed.error.errors.map((error) => error.message),
      );
      return;
    }

    const result = await service.adminRejectCashOverpaymentBenefitByRide(
      token,
      request.params.rideId,
      parsed.data,
    );

    if (!result.ok) {
      sendServiceError(reply, result);
      return;
    }

    sendOk(reply, result.benefit);
  },

  /** Compatibilidad con el botón antiguo de Admin. */
  async adminCreateWalletCredit(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const token = requireToken(request, reply);
    if (!token) return;

    const parsed = adminCreateWalletCreditSchema.safeParse(request.body);
    if (!parsed.success) {
      sendValidationError(
        reply,
        parsed.error.errors.map((error) => error.message),
      );
      return;
    }

    const result = await service.adminCreateWalletCredit(
      token,
      parsed.data,
    );

    if (!result.ok) {
      sendServiceError(reply, result);
      return;
    }

    sendOk(reply, {
      benefit: result.benefit,
      wallet: result.wallet,
      transaction: result.transaction,
      alreadyApproved: result.alreadyApproved,
    });
  },

  async createPaymentOrder(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const token = requireToken(request, reply);
    if (!token) return;

    const parsed = createPaymentOrderSchema.safeParse(request.body);
    if (!parsed.success) {
      sendValidationError(
        reply,
        parsed.error.errors.map((error) => error.message),
      );
      return;
    }

    const result = await service.createPaymentOrder(token, parsed.data);
    if (!result.ok) {
      sendServiceError(reply, result);
      return;
    }

    sendOk(reply, result.order, 201);
  },

  async handleWebhook(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const parsed = webhookPayloadSchema.safeParse(request.body);
    if (!parsed.success) {
      sendValidationError(
        reply,
        parsed.error.errors.map((error) => error.message),
      );
      return;
    }

    const result = await service.handleWebhook(parsed.data);
    if (!result.ok) {
      sendServiceError(reply, result);
      return;
    }

    sendOk(reply, result.order);
  },
};
