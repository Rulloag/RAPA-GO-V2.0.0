import type { FastifyRequest, FastifyReply } from "fastify";
import { PaymentsService } from "./payments.service.js";
import {
  createPaymentSchema,
  prontoPagaWebhookSchema,
  mercadoPagoWebhookSchema,
} from "./payments.schema.js";
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

    sendOk(reply, {
      urlPay: result.urlPay,
      paymentId: result.paymentId,
      paymentPurpose: result.paymentPurpose,
      activated: result.activated,
    }, 201);
  },

  async getPaymentStatus(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) {
      sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 });
      return;
    }

    const paymentId = String(
      (request.params as Record<string, unknown> | undefined)?.["paymentId"] ?? "",
    ).trim();

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(paymentId)) {
      sendError(reply, {
        code: "VALIDATION_ERROR",
        message: "paymentId must be a valid UUID.",
        statusCode: 400,
      });
      return;
    }

    const result = await paymentsService.getPaymentStatus(token, paymentId);
    if (!result.ok) {
      sendError(reply, { code: result.code, message: result.message, statusCode: result.statusCode });
      return;
    }

    sendOk(reply, result.payment);
  },


  async getPaymentReceipt(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) {
      sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 });
      return;
    }
    const paymentId = String(
      (request.params as Record<string, unknown> | undefined)?.["paymentId"] ?? "",
    ).trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(paymentId)) {
      sendError(reply, { code: "VALIDATION_ERROR", message: "paymentId must be a valid UUID.", statusCode: 400 });
      return;
    }
    const result = await paymentsService.getPaymentReceipt(token, paymentId);
    if (!result.ok) {
      sendError(reply, result);
      return;
    }
    sendOk(reply, result.receipt);
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

    const result = await paymentsService.handleWebhook(
      "prontopaga",
      parsed.data as Record<string, unknown>,
      {},
    );

    if (!result.ok) {
      sendError(reply, { code: result.code, message: result.message, statusCode: result.statusCode });
      return;
    }

    sendOk(reply, { processed: result.processed });
  },

  async mercadoPagoWebhook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const parsed = mercadoPagoWebhookSchema.safeParse(request.body);
    if (!parsed.success) {
      sendError(reply, {
        code:       "VALIDATION_ERROR",
        message:    parsed.error.errors[0]?.message ?? "Invalid webhook payload.",
        statusCode: 400,
      });
      return;
    }

    const headers: Record<string, string> = {
      "x-signature":   String(request.headers["x-signature"]   ?? ""),
      "x-request-id":  String(request.headers["x-request-id"]  ?? ""),
    };

    const result = await paymentsService.handleWebhook(
      "mercadopago",
      parsed.data as Record<string, unknown>,
      headers,
    );

    if (!result.ok) {
      sendError(reply, { code: result.code, message: result.message, statusCode: result.statusCode });
      return;
    }

    sendOk(reply, { processed: result.processed });
  },
};
