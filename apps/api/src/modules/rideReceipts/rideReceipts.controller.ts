import type { FastifyReply, FastifyRequest } from "fastify";

import { sendError, sendOk } from "../../shared/http/apiResponse.js";
import { rideReceiptIdParamsSchema } from "./rideReceipts.schemas.js";
import { rideReceiptsService } from "./rideReceipts.service.js";

function extractBearer(request: FastifyRequest): string | null {
  const authorization = request.headers.authorization;

  if (
    typeof authorization !== "string" ||
    !authorization.startsWith("Bearer ")
  ) {
    return null;
  }

  const token = authorization.slice(7).trim();
  return token || null;
}

function requireBearer(
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
  }

  return token;
}

function sendServiceError(
  reply: FastifyReply,
  result: { code: string; message: string; statusCode: number },
): void {
  sendError(reply, result);
}

function parseReceiptId(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): string | null {
  const parsed = rideReceiptIdParamsSchema.safeParse(request.params);

  if (!parsed.success) {
    sendError(reply, {
      code: "VALIDATION_ERROR",
      message: parsed.error.errors[0]?.message ?? "Invalid receipt id.",
      statusCode: 400,
    });
    return null;
  }

  return parsed.data.id;
}

export const rideReceiptsController = {
  async listMine(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const token = requireBearer(request, reply);
    if (!token) return;

    const result = await rideReceiptsService.listMine(token);

    if (!result.ok) {
      sendServiceError(reply, result);
      return;
    }

    sendOk(reply, result.receipts);
  },

  async listAdmin(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const token = requireBearer(request, reply);
    if (!token) return;

    const result = await rideReceiptsService.listAdmin(token);

    if (!result.ok) {
      sendServiceError(reply, result);
      return;
    }

    sendOk(reply, result.receipts);
  },

  async download(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const token = requireBearer(request, reply);
    if (!token) return;

    const receiptId = parseReceiptId(request, reply);
    if (!receiptId) return;

    const result = await rideReceiptsService.download(token, receiptId);

    if (!result.ok) {
      sendServiceError(reply, result);
      return;
    }

    reply
      .header("Content-Type", result.contentType)
      .header(
        "Content-Disposition",
        `attachment; filename="${result.fileName.replace(/"/g, "")}"`,
      )
      .header("Cache-Control", "private, no-store")
      .send(result.buffer);
  },

  async resendAdmin(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const token = requireBearer(request, reply);
    if (!token) return;

    const receiptId = parseReceiptId(request, reply);
    if (!receiptId) return;

    const result = await rideReceiptsService.resendAdmin(token, receiptId);

    if (!result.ok) {
      sendServiceError(reply, result);
      return;
    }

    sendOk(reply, result.receipt);
  },
};
