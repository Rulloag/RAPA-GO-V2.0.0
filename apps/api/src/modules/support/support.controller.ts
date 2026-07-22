import type { FastifyReply, FastifyRequest } from "fastify";
import { sendError, sendOk } from "../../shared/http/apiResponse.js";
import {
  addSupportMessageSchema,
  adminSupportListQuerySchema,
  adminSupportUpdateSchema,
  createSupportCaseSchema,
} from "./support.schemas.js";
import { SupportService } from "./support.service.js";

const supportService = new SupportService();

function extractBearer(request: FastifyRequest): string | null {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) return null;
  return authorization.slice(7);
}

function validationError(reply: FastifyReply, message: string): FastifyReply {
  return sendError(reply, {
    code: "VALIDATION_ERROR",
    message,
    statusCode: 400,
  });
}

export const supportController = {
  async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) {
      sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 });
      return;
    }
    const parsed = createSupportCaseSchema.safeParse(request.body);
    if (!parsed.success) {
      validationError(reply, parsed.error.errors[0]?.message ?? "Datos inválidos.");
      return;
    }
    const result = await supportService.createCase(token, parsed.data);
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, result.supportCase, 201);
  },

  async listMine(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) {
      sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 });
      return;
    }
    const result = await supportService.listMine(token);
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, { items: result.items });
  },

  async getMine(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const token = extractBearer(request);
    if (!token) {
      sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 });
      return;
    }
    const result = await supportService.getMine(token, request.params.id);
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, result.detail);
  },

  async addMessage(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const token = extractBearer(request);
    if (!token) {
      sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 });
      return;
    }
    const parsed = addSupportMessageSchema.safeParse(request.body);
    if (!parsed.success) {
      validationError(reply, parsed.error.errors[0]?.message ?? "Mensaje inválido.");
      return;
    }
    const result = await supportService.addMessage(token, request.params.id, parsed.data);
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, result.detail);
  },

  async listAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) {
      sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 });
      return;
    }
    const parsed = adminSupportListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      validationError(reply, parsed.error.errors[0]?.message ?? "Filtros inválidos.");
      return;
    }
    const result = await supportService.listForAdmin(token, parsed.data);
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, { items: result.items });
  },

  async getAdmin(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const token = extractBearer(request);
    if (!token) {
      sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 });
      return;
    }
    const result = await supportService.getForAdmin(token, request.params.id);
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, result.detail);
  },

  async updateAdmin(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const token = extractBearer(request);
    if (!token) {
      sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 });
      return;
    }
    const parsed = adminSupportUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      validationError(reply, parsed.error.errors[0]?.message ?? "Actualización inválida.");
      return;
    }
    const result = await supportService.updateForAdmin(token, request.params.id, parsed.data);
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, result.detail);
  },
};
