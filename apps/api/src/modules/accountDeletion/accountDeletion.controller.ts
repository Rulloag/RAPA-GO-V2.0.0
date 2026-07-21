import type {
  FastifyReply,
  FastifyRequest,
} from "fastify";

import { sendError, sendOk } from "../../shared/http/apiResponse.js";
import {
  createAccountDeletionRequestSchema,
  deferAccountDeletionRequestSchema,
  listAccountDeletionRequestsQuerySchema,
  publicAccountDeletionCodeRequestSchema,
  publicAccountDeletionStatusQuerySchema,
  publicAccountDeletionSubmitSchema,
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

function firstValidationMessage(
  errors: Array<{ message: string }>,
  fallback: string,
): string {
  return errors[0]?.message ?? fallback;
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

  async requestAppCode(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<FastifyReply> {
    const token = bearer(request);
    if (!token) return missingToken(reply);

    const result = await service.requestAppVerification(token);

    if (result.ok === false) {
      return sendError(reply, {
        code: result.code,
        message: result.message,
        statusCode: result.statusCode,
      });
    }

    return sendOk(reply, {
      message: result.message,
      expiresMinutes: result.expiresMinutes,
    });
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
        message: firstValidationMessage(
          parsed.error.errors,
          "Solicitud inválida.",
        ),
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

  async publicRequestCode(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<FastifyReply> {
    const parsed = publicAccountDeletionCodeRequestSchema.safeParse(
      request.body,
    );

    if (!parsed.success) {
      return sendError(reply, {
        code: "VALIDATION_ERROR",
        message: firstValidationMessage(
          parsed.error.errors,
          "Ingresa un correo válido.",
        ),
        statusCode: 400,
      });
    }

    const result = await service.requestPublicVerification(
      parsed.data,
      {
        requestIp: request.ip,
        requestUserAgent: request.headers["user-agent"] ?? null,
      },
    );

    if (result.ok === false) {
      return sendError(reply, {
        code: result.code,
        message: result.message,
        statusCode: result.statusCode,
      });
    }

    return sendOk(reply, {
      message: result.message,
      expiresMinutes: result.expiresMinutes,
    });
  },

  async publicSubmit(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<FastifyReply> {
    const parsed = publicAccountDeletionSubmitSchema.safeParse(
      request.body,
    );

    if (!parsed.success) {
      return sendError(reply, {
        code: "VALIDATION_ERROR",
        message: firstValidationMessage(
          parsed.error.errors,
          "Solicitud inválida.",
        ),
        statusCode: 400,
      });
    }

    const result = await service.submitPublicRequest(parsed.data);

    if (result.ok === false) {
      return sendError(reply, {
        code: result.code,
        message: result.message,
        statusCode: result.statusCode,
      });
    }

    return sendOk(reply, result.request, 201);
  },

  async publicStatus(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<FastifyReply> {
    const parsed = publicAccountDeletionStatusQuerySchema.safeParse(
      request.query,
    );

    if (!parsed.success) {
      return sendError(reply, {
        code: "VALIDATION_ERROR",
        message: firstValidationMessage(
          parsed.error.errors,
          "Datos de seguimiento inválidos.",
        ),
        statusCode: 400,
      });
    }

    const result = await service.getPublicStatus(parsed.data);

    if (result.ok === false) {
      return sendError(reply, {
        code: result.code,
        message: result.message,
        statusCode: result.statusCode,
      });
    }

    return sendOk(reply, result.request);
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
        message: firstValidationMessage(
          parsed.error.errors,
          "Filtros inválidos.",
        ),
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

  async adminDefer(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ): Promise<FastifyReply> {
    const token = bearer(request);
    if (!token) return missingToken(reply);

    const parsed = deferAccountDeletionRequestSchema.safeParse(
      request.body,
    );

    if (!parsed.success) {
      return sendError(reply, {
        code: "VALIDATION_ERROR",
        message: firstValidationMessage(
          parsed.error.errors,
          "Debes indicar una causa objetiva de aplazamiento.",
        ),
        statusCode: 400,
      });
    }

    const result = await service.defer(
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
        message: firstValidationMessage(
          parsed.error.errors,
          "Debes registrar una observación administrativa.",
        ),
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
