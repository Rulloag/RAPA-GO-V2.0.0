import type { FastifyRequest, FastifyReply } from "fastify";
import { LegalService } from "./legal.service.js";
import { sendOk, sendError } from "../../shared/http/apiResponse.js";
import { createLegalAcceptanceSchema, createLegalDocumentSchema, updateLegalDocumentSchema } from "./legal.schemas.js";

const service = new LegalService();

function extractBearer(request: FastifyRequest): string | null {
  const auth = request.headers["authorization"];
  if (!auth || !auth.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

export const legalController = {
  async listDocuments(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = request.query as { type?: string; isActive?: string };
    const filters: { type?: string; isActive?: boolean } = {};
    if (query.type) filters.type = query.type;
    if (query.isActive !== undefined) filters.isActive = query.isActive === "true";
    const result = await service.listDocuments(filters);
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, { items: result.items });
  },

  async getActive(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const result = await service.getActive();
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, { items: result.items });
  },

  async getDocument(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<void> {
    const result = await service.getDocument(request.params.id);
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, { document: result.document });
  },

  async createDocument(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) { sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 }); return; }
    const parsed = createLegalDocumentSchema.safeParse(request.body);
    if (!parsed.success) {
      sendError(reply, { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Documento legal inválido.", statusCode: 400 });
      return;
    }
    const result = await service.createDocument(token, parsed.data);
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, { document: result.document }, 201);
  },

  async updateDocument(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) { sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 }); return; }
    const parsed = updateLegalDocumentSchema.safeParse(request.body);
    if (!parsed.success) {
      sendError(reply, { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Documento legal inválido.", statusCode: 400 });
      return;
    }
    const updateInput: {
      title?: string;
      content?: string;
      effectiveDate?: string;
      isActive?: boolean;
    } = {};
    if (parsed.data.title !== undefined) updateInput.title = parsed.data.title;
    if (parsed.data.content !== undefined) updateInput.content = parsed.data.content;
    if (parsed.data.effectiveDate !== undefined) updateInput.effectiveDate = parsed.data.effectiveDate;
    if (parsed.data.isActive !== undefined) updateInput.isActive = parsed.data.isActive;
    const result = await service.updateDocument(token, request.params.id, updateInput);
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, { document: result.document });
  },

  async createAcceptance(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) { sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 }); return; }
    const ip = request.ip ?? (request.socket as { remoteAddress?: string } | undefined)?.remoteAddress ?? undefined;
    const ua = request.headers["user-agent"] ?? undefined;
    const parsed = createLegalAcceptanceSchema.safeParse(request.body);
    if (!parsed.success) {
      sendError(reply, { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Aceptación inválida.", statusCode: 400 });
      return;
    }
    const result = await service.createAcceptance(token, parsed.data, ip, ua);
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, { acceptance: result.acceptance }, 201);
  },

  async getMyAcceptances(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) { sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 }); return; }
    const result = await service.getMyAcceptances(token);
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, { items: result.items });
  },

  async listAcceptances(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) { sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 }); return; }
    const query = request.query as { userId?: string; page?: string; limit?: string };
    const filters = {
      ...(query.userId ? { userId: query.userId } : {}),
      page: parseInt(query.page ?? "1", 10),
      limit: parseInt(query.limit ?? "50", 10),
    };
    const result = await service.listAcceptances(token, filters);
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, { items: result.items });
  },
};
