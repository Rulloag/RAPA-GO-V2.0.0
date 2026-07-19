import type {
  FastifyReply,
  FastifyRequest,
} from "fastify";

import { sendError, sendOk } from "../../shared/http/apiResponse.js";
import {
  createAccountDeletionRequestSchema,
  listAccountDeletionRequestsQuerySchema,
  reviewAccountDeletionRequestSchema,
} from "./accountDeletion.schemas.js";
import { AccountDeletionService } from "./accountDeletion.service.js";

const service = new AccountDeletionService();

function bearer(request: FastifyRequest): string | null {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice(7);
}

function missingToken(reply: FastifyReply): FastifyReply {
  return sendError(reply, {
    code: "UNAUTHORIZED",
    message: "Falta el token de acceso.",
    statusCode: 401,
  });
}

export const accountDeletionController = {
  async getMine(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<FastifyReply> {
    const token = bearer(request);
    if (!token) return missingToken(reply);

    const result = await service.getMyLatestRequest(token);

    if (result.ok === false) {
      return sendError(reply, {
        code: result.code,
        message: result.message,
        statusCode: result.statusCode,
      });
    }

    return sendOk(reply, result.request);
  },

  async create(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<FastifyReply> {
    const token = bearer(request);
    if (!token) return missingToken(reply);

    const parsed = createAccountDeletionRequestSchema.safeParse(
      request.body,
    );

    if (!parsed.success) {
      return sendError(reply, {
        code: "VALIDATION_ERROR",
        message:
          parsed.error.errors[0]?.message ??
          "Solicitud inválida.",
        statusCode: 400,
      });
    }

    const result = await service.createRequest(token, parsed.data);

    if (result.ok === false) {
      return sendError(reply, {
        code: result.code,
        message: result.message,
        statusCode: result.statusCode,
      });
    }

    return sendOk(reply, result.request, 201);
  },

  async adminList(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<FastifyReply> {
    const token = bearer(request);
    if (!token) return missingToken(reply);

    const parsed = listAccountDeletionRequestsQuerySchema.safeParse(
      request.query,
    );

    if (!parsed.success) {
      return sendError(reply, {
        code: "VALIDATION_ERROR",
        message:
          parsed.error.errors[0]?.message ??
          "Filtros inválidos.",
        statusCode: 400,
      });
    }

    const result = await service.listForAdmin(
      token,
      parsed.data,
    );

    if (result.ok === false) {
      return sendError(reply, {
        code: result.code,
        message: result.message,
        statusCode: result.statusCode,
      });
    }

    return sendOk(reply, result.requests);
  },

  async adminReject(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ): Promise<FastifyReply> {
    const token = bearer(request);
    if (!token) return missingToken(reply);

    const parsed = reviewAccountDeletionRequestSchema.safeParse(
      request.body,
    );

    if (!parsed.success) {
      return sendError(reply, {
        code: "VALIDATION_ERROR",
        message:
          parsed.error.errors[0]?.message ??
          "Debes escribir el motivo del rechazo.",
        statusCode: 400,
      });
    }

    const result = await service.reject(
      token,
      request.params.id,
      parsed.data,
    );

    if (result.ok === false) {
      return sendError(reply, {
        code: result.code,
        message: result.message,
        statusCode: result.statusCode,
      });
    }

    return sendOk(reply, result.request);
  },

  async adminApprove(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ): Promise<FastifyReply> {
    const token = bearer(request);
    if (!token) return missingToken(reply);

    const parsed = reviewAccountDeletionRequestSchema.safeParse(
      request.body,
    );

    if (!parsed.success) {
      return sendError(reply, {
        code: "VALIDATION_ERROR",
        message:
          parsed.error.errors[0]?.message ??
          "Debes registrar una observación administrativa.",
        statusCode: 400,
      });
    }

    const result = await service.approve(
      token,
      request.params.id,
      parsed.data,
    );

    if (result.ok === false) {
      return sendError(reply, {
        code: result.code,
        message: result.message,
        statusCode: result.statusCode,
      });
    }

    return sendOk(reply, result.request);
  },
};
