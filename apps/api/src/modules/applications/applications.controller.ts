import type { FastifyRequest, FastifyReply } from "fastify";
import { ApplicationsService } from "./applications.service.js";
import {
  createApplicationSchema,
  reviewApplicationSchema,
  uploadApplicationFileSchema,
} from "./applications.schemas.js";
import { sendOk, sendError } from "../../shared/http/apiResponse.js";

const service = new ApplicationsService();

function extractBearer(request: FastifyRequest): string | null {
  const auth = request.headers["authorization"];
  if (!auth || !auth.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

function normalizeMimeType(value: string | undefined): string {
  return (value ?? "")
    .split(";", 1)[0]
    ?.trim()
    .toLowerCase() ?? "";
}

function hasExpectedFileSignature(
  fileBuffer: Buffer,
  mimeType: string,
): boolean {
  if (mimeType === "image/jpeg") {
    return (
      fileBuffer.length >= 3 &&
      fileBuffer[0] === 0xff &&
      fileBuffer[1] === 0xd8 &&
      fileBuffer[2] === 0xff
    );
  }

  if (mimeType === "image/png") {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return (
      fileBuffer.length >= signature.length &&
      signature.every((value, index) => fileBuffer[index] === value)
    );
  }

  if (mimeType === "image/webp") {
    return (
      fileBuffer.length >= 12 &&
      fileBuffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      fileBuffer.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }

  if (mimeType === "application/pdf") {
    return (
      fileBuffer.length >= 5 &&
      fileBuffer.subarray(0, 5).toString("ascii") === "%PDF-"
    );
  }

  return false;
}

export const applicationsController = {
  async createApplication(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const token = extractBearer(request);
    const parsed = createApplicationSchema.safeParse(request.body);

    if (!parsed.success) {
      sendError(reply, {
        code: "VALIDATION_ERROR",
        message: parsed.error.errors[0]?.message ?? "Invalid request body.",
        statusCode: 400,
      });
      return;
    }

    const result = await service.createApplication(token, parsed.data);

    if (!result.ok) {
      sendError(reply, {
        code: result.code,
        message: result.message,
        statusCode: result.statusCode,
      });
      return;
    }

    sendOk(reply, result, 201);
  },

  async uploadApplicationFile(
    request: FastifyRequest<{
      Params: { id: string; kind: string };
      Querystring: { fileName?: string };
      Body: Buffer;
    }>,
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

    const parsed = uploadApplicationFileSchema.safeParse({
      kind: request.params.kind,
      fileName: request.query.fileName,
      mimeType: normalizeMimeType(request.headers["content-type"]),
    });

    if (!parsed.success) {
      sendError(reply, {
        code: "VALIDATION_ERROR",
        message: parsed.error.errors[0]?.message ?? "Invalid file metadata.",
        statusCode: 400,
      });
      return;
    }

    if (!Buffer.isBuffer(request.body) || request.body.length === 0) {
      sendError(reply, {
        code: "VALIDATION_ERROR",
        message: "El archivo enviado está vacío o no es binario.",
        statusCode: 400,
      });
      return;
    }

    if (
      (parsed.data.kind === "profile_photo" ||
        parsed.data.kind === "vehicle_photo") &&
      parsed.data.mimeType === "application/pdf"
    ) {
      sendError(reply, {
        code: "VALIDATION_ERROR",
        message: "La foto de perfil y la foto del vehículo deben ser imágenes.",
        statusCode: 400,
      });
      return;
    }

    if (!hasExpectedFileSignature(request.body, parsed.data.mimeType)) {
      sendError(reply, {
        code: "VALIDATION_ERROR",
        message: "El contenido del archivo no coincide con su tipo declarado.",
        statusCode: 400,
      });
      return;
    }

    const result = await service.uploadApplicationFile(
      token,
      request.params.id,
      parsed.data,
      request.body,
    );

    if (!result.ok) {
      sendError(reply, {
        code: result.code,
        message: result.message,
        statusCode: result.statusCode,
      });
      return;
    }

    sendOk(reply, result.application);
  },

  async getMyApplications(
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

    const result = await service.getMyApplications(token);

    if (!result.ok) {
      sendError(reply, {
        code: result.code,
        message: result.message,
        statusCode: result.statusCode,
      });
      return;
    }

    sendOk(reply, result);
  },

  async listApplications(
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

    const query = request.query as Record<string, string | undefined>;
    const filters: {
      type?: string;
      status?: string;
      page?: number;
      limit?: number;
    } = {};

    if (query["type"]) filters.type = query["type"];
    if (query["status"]) filters.status = query["status"];
    if (query["page"]) filters.page = Number(query["page"]);
    if (query["limit"]) filters.limit = Number(query["limit"]);

    const result = await service.listApplications(token, filters);

    if (!result.ok) {
      sendError(reply, {
        code: result.code,
        message: result.message,
        statusCode: result.statusCode,
      });
      return;
    }

    sendOk(reply, result);
  },

  async getApplication(
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

    const { id } = request.params as { id: string };
    const result = await service.getApplication(token, id);

    if (!result.ok) {
      sendError(reply, {
        code: result.code,
        message: result.message,
        statusCode: result.statusCode,
      });
      return;
    }

    sendOk(reply, result.application);
  },

  async reviewApplication(
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

    const { id } = request.params as { id: string };
    const parsed = reviewApplicationSchema.safeParse(request.body);

    if (!parsed.success) {
      sendError(reply, {
        code: "VALIDATION_ERROR",
        message: parsed.error.errors[0]?.message ?? "Invalid request body.",
        statusCode: 400,
      });
      return;
    }

    const result = await service.reviewApplication(token, id, parsed.data);

    if (!result.ok) {
      sendError(reply, {
        code: result.code,
        message: result.message,
        statusCode: result.statusCode,
      });
      return;
    }

    sendOk(reply, result.application);
  },

  async getApplicationContract(
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

    const { id } = request.params as { id: string };
    const result = await service.getApplicationContract(token, id);

    if (!result.ok) {
      sendError(reply, {
        code: result.code,
        message: result.message,
        statusCode: result.statusCode,
      });
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

  async resendApplicationContract(
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

    const { id } = request.params as { id: string };
    const result = await service.resendApplicationContract(token, id);

    if (!result.ok) {
      sendError(reply, {
        code: result.code,
        message: result.message,
        statusCode: result.statusCode,
      });
      return;
    }

    sendOk(reply, result);
  },

  async resendApplicationApproval(
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

    const { id } = request.params as { id: string };
    const result = await service.resendApplicationApproval(token, id);

    if (!result.ok) {
      sendError(reply, {
        code: result.code,
        message: result.message,
        statusCode: result.statusCode,
      });
      return;
    }

    sendOk(reply, result);
  },
};
