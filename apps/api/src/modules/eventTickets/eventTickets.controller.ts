import type { FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { EventTicketsService } from "./eventTickets.service.js";
import { createTicketSchema, validateTicketSchema } from "./eventTickets.schemas.js";
import { sendOk, sendError } from "../../shared/http/apiResponse.js";

const service = new EventTicketsService();

function extractBearer(request: FastifyRequest): string | null {
  const auth = request.headers["authorization"];
  if (!auth || !auth.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

export const eventTicketsController = {
  async createTicket(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) { sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 }); return; }
    const parsed = createTicketSchema.safeParse(request.body);
    if (!parsed.success) { sendError(reply, { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid input.", statusCode: 400 }); return; }
    const result = await service.createTicket(token, parsed.data);
    if (!result.ok) { sendError(reply, { code: result.code, message: result.message, statusCode: result.statusCode }); return; }
    sendOk(reply, result.ticket);
  },

  async getMyTickets(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) { sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 }); return; }
    const result = await service.getMyTickets(token);
    if (!result.ok) { sendError(reply, { code: result.code, message: result.message, statusCode: result.statusCode }); return; }
    sendOk(reply, { items: result.items, total: result.total });
  },

  async getTicketQr(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) { sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 }); return; }
    const result = await service.getTicketQr(token, request.params.id);
    if (!result.ok) { sendError(reply, { code: result.code, message: result.message, statusCode: result.statusCode }); return; }
    sendOk(reply, result.ticket);
  },

  async validateTicket(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) { sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 }); return; }
    const parsed = validateTicketSchema.safeParse(request.body);
    if (!parsed.success) { sendError(reply, { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid input.", statusCode: 400 }); return; }
    const result = await service.validateTicket(token, request.params.id, parsed.data);
    if (!result.ok) { sendError(reply, { code: result.code, message: result.message, statusCode: result.statusCode }); return; }
    sendOk(reply, { id: result.id, status: result.status, validatedAt: result.validatedAt, message: result.message });
  },

  async validateByCode(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) { sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 }); return; }
    const parsed = z.object({ code: z.string().min(1) }).safeParse(request.body);
    if (!parsed.success) { sendError(reply, { code: "VALIDATION_ERROR", message: "code is required.", statusCode: 400 }); return; }
    const result = await service.validateByCode(token, parsed.data.code);
    if (!result.ok) { sendError(reply, { code: result.code, message: result.message, statusCode: result.statusCode }); return; }
    sendOk(reply, { id: result.id, status: result.status, validatedAt: result.validatedAt, message: result.message });
  },

  async getRecentValidations(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) { sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 }); return; }
    const result = await service.getRecentValidations(token);
    if (!result.ok) { sendError(reply, { code: result.code, message: result.message, statusCode: result.statusCode }); return; }
    sendOk(reply, { items: result.items, total: result.total });
  },
};
