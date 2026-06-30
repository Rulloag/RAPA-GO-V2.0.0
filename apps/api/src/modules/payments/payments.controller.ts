import type { FastifyRequest, FastifyReply } from "fastify";
import { PaymentsService } from "./payments.service.js";
import { createPaymentSchema, prontoPagaWebhookSchema } from "./payments.schemas.js";
import { sendOk, sendError } from "../../shared/http/apiResponse.js";

const paymentsService = new PaymentsService();

function extractBearer(request: FastifyRequest): string | null {
  const auth = request.headers["authorization"];
  if (!auth || !auth.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

export const paymentsController = {
  async createPayment(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) {
      sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 });
      return;
    }

    const parsed = createPaymentSchema.safeParse(request.body);
    if (!parsed.success) {
      sendError(reply, {
        code:       "VALIDATION_ERROR",
        message:    parsed.error.errors[0]?.message ?? "Invalid request body.",
        statusCode: 400,
      });
      return;
    }

    const result = await paymentsService.createPayment(token, parsed.data);
    if (!result.ok) {
      sendError(reply, { code: result.code, message: result.message, statusCode: result.statusCode });
      return;
    }

    sendOk(reply, { urlPay: result.urlPay, paymentId: result.paymentId }, 201);
  },

  async prontoPagaWebhook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const parsed = prontoPagaWebhookSchema.safeParse(request.body);
    if (!parsed.success) {
      sendError(reply, {
        code:       "VALIDATION_ERROR",
        message:    parsed.error.errors[0]?.message ?? "Invalid webhook payload.",
        statusCode: 400,
      });
      return;
    }

    const { signature, ...rest } = parsed.data;
    const result = await paymentsService.handleWebhook(
      rest as Record<string, unknown>,
      signature,
    );

    if (!result.ok) {
      sendError(reply, { code: result.code, message: result.message, statusCode: result.statusCode });
      return;
    }

    sendOk(reply, { processed: result.processed });
  },
};
