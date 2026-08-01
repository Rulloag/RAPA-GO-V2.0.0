import type { FastifyRequest, FastifyReply } from "fastify";
import { PaymentsService } from "./payments.service.js";
import {
  createPaymentSchema,
  createKlapEmbeddedOrderSchema,
  reconcileMercadoPagoPaymentSchema,
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

  /**
   * Klap Checkout Transparente — Sandbox-only embedded order creation (Fase D).
   * Deliberately a separate endpoint from `createPayment` above: that one's
   * response shape (`urlPay`, redirect-oriented) is already relied upon by the
   * mobile client for Mercado Pago/ProntoPaga and is left untouched here.
   */
  async createKlapEmbeddedOrder(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) {
      sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 });
      return;
    }

    const parsed = createKlapEmbeddedOrderSchema.safeParse(request.body);
    if (!parsed.success) {
      sendError(reply, {
        code:       "VALIDATION_ERROR",
        message:    parsed.error.errors[0]?.message ?? "Invalid request body.",
        statusCode: 400,
      });
      return;
    }

    const result = await paymentsService.createKlapEmbeddedOrder(token, parsed.data);
    if (!result.ok) {
      sendError(reply, { code: result.code, message: result.message, statusCode: result.statusCode });
      return;
    }

    // Only the public, non-secret fields — never the raw Klap response, ApiKey,
    // headers, or anything resembling a redirect URL.
    sendOk(reply, {
      paymentId: result.paymentId,
      provider: result.provider,
      checkoutType: result.checkoutType,
      publicCheckoutData: result.publicCheckoutData,
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


  async reconcileMercadoPagoPayment(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const token = extractBearer(request);
    if (!token) {
      sendError(reply, {
        code: "UNAUTHORIZED",
        message: "Missing Bearer token.",
        statusCode: 401,
      });
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

    const parsed = reconcileMercadoPagoPaymentSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      sendError(reply, {
        code: "VALIDATION_ERROR",
        message: parsed.error.errors[0]?.message ?? "Invalid request body.",
        statusCode: 400,
      });
      return;
    }

    const result = await paymentsService.reconcileMercadoPagoPayment(
      token,
      paymentId,
      parsed.data.providerPaymentId,
    );

    if (!result.ok) {
      sendError(reply, {
        code: result.code,
        message: result.message,
        statusCode: result.statusCode,
      });
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

  async mercadoPagoBrowserReturn(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const query = (
      request.query && typeof request.query === "object"
        ? request.query
        : {}
    ) as Record<string, unknown>;

    const externalReference = String(
      query["external_reference"] ?? "",
    ).trim();
    const providerPaymentId = String(
      query["payment_id"] ??
        query["collection_id"] ??
        "",
    ).trim();

    const result = await paymentsService.resolveMercadoPagoBrowserReturn({
      externalReference,
      providerPaymentId,
    });

    reply.header("Cache-Control", "no-store, max-age=0");
    reply.header("Pragma", "no-cache");
    reply.redirect(303, result.redirectUrl);
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
    const query = (
      request.query && typeof request.query === "object"
        ? request.query
        : {}
    ) as Record<string, unknown>;
    const body = (
      request.body && typeof request.body === "object"
        ? request.body
        : {}
    ) as Record<string, unknown>;

    // Mercado Pago documenta data.id como parámetro de query para validar
    // la firma. Algunas notificaciones también lo repiten dentro del body.
    const queryDataId = String(
      query["data.id"] ?? query["data_id"] ?? "",
    ).trim();
    const queryType = String(
      query["type"] ?? query["topic"] ?? "",
    ).trim();

    const candidate: Record<string, unknown> = {
      ...body,
      ...(body["type"] ? {} : { type: queryType || "payment" }),
    };

    if (
      queryDataId &&
      !String(
        (
          candidate["data"] &&
          typeof candidate["data"] === "object"
            ? (candidate["data"] as Record<string, unknown>)["id"]
            : ""
        ) ?? "",
      ).trim()
    ) {
      candidate["data"] = { id: queryDataId };
    }

    const parsed = mercadoPagoWebhookSchema.safeParse(candidate);
    if (!parsed.success) {
      console.warn("[MercadoPago] Webhook inválido antes de procesar:", {
        hasSignature: Boolean(request.headers["x-signature"]),
        hasRequestId: Boolean(request.headers["x-request-id"]),
        queryDataId: queryDataId || null,
        queryType: queryType || null,
        validationMessage:
          parsed.error.errors[0]?.message ?? "Invalid webhook payload.",
      });
      sendError(reply, {
        code: "VALIDATION_ERROR",
        message: parsed.error.errors[0]?.message ?? "Invalid webhook payload.",
        statusCode: 400,
      });
      return;
    }

    const headers: Record<string, string> = {
      "x-signature": String(request.headers["x-signature"] ?? ""),
      "x-request-id": String(request.headers["x-request-id"] ?? ""),
      "x-data-id":
        queryDataId ||
        String(
          (
            parsed.data.data &&
            typeof parsed.data.data === "object"
              ? parsed.data.data.id
              : ""
          ) ?? "",
        ).trim(),
    };

    console.log("[MercadoPago] Webhook recibido:", {
      type: parsed.data.type,
      action: parsed.data.action ?? null,
      dataId: headers["x-data-id"] || null,
      hasSignature: Boolean(headers["x-signature"]),
      hasRequestId: Boolean(headers["x-request-id"]),
      hasWebhookSecret: Boolean(
        String(process.env["MERCADOPAGO_WEBHOOK_SECRET"] ?? "").trim(),
      ),
    });

    const result = await paymentsService.handleWebhook(
      "mercadopago",
      parsed.data as Record<string, unknown>,
      headers,
    );

    if (!result.ok) {
      console.warn("[MercadoPago] Webhook rechazado:", {
        code: result.code,
        statusCode: result.statusCode,
        dataId: headers["x-data-id"] || null,
      });
      sendError(reply, {
        code: result.code,
        message: result.message,
        statusCode: result.statusCode,
      });
      return;
    }

    sendOk(reply, { processed: result.processed });
  },

  /**
   * POST /webhooks/klap/confirm
   * POST /webhooks/klap/reject
   *
   * Klap's own documented response contract is NOT the app-wide
   * `{ok,data,statusCode}` envelope (`sendOk`/`sendError` above) — it requires
   * exactly `{"status": "..."}` with a 2xx for accepted/duplicate events,
   * since an unrecognized shape or slow/non-2xx response can trigger an
   * automatic reversal on Klap's side. These two handlers reply directly.
   */
  async klapConfirmWebhook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const headers: Record<string, string> = {
      apikey: String(request.headers["apikey"] ?? ""),
    };

    const result = await paymentsService.handleKlapConfirmWebhook(request.body, headers);

    if (!result.ok) {
      reply.status(result.statusCode).send({
        status: result.code === "VALIDATION_ERROR" ? "invalid_request"
          : result.code === "WEBHOOK_INVALID_SIGNATURE" ? "unauthorized"
          : result.code === "NOT_FOUND" ? "not_found"
          : "error",
      });
      return;
    }

    reply.status(200).send({ status: "ok" });
  },

  async klapRejectWebhook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const headers: Record<string, string> = {
      apikey: String(request.headers["apikey"] ?? ""),
    };

    const result = await paymentsService.handleKlapRejectWebhook(request.body, headers);

    if (!result.ok) {
      reply.status(result.statusCode).send({
        status: result.code === "VALIDATION_ERROR" ? "invalid_request"
          : result.code === "WEBHOOK_INVALID_SIGNATURE" ? "unauthorized"
          : result.code === "NOT_FOUND" ? "not_found"
          : "error",
      });
      return;
    }

    reply.status(200).send({ status: "ok" });
  },
};
