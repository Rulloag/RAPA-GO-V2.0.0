import type { FastifyRequest, FastifyReply } from "fastify";
import { ApplicationsService } from "./applications.service.js";
import { createApplicationSchema, reviewApplicationSchema } from "./applications.schemas.js";
import { sendOk, sendError } from "../../shared/http/apiResponse.js";

const service = new ApplicationsService();

function extractBearer(request: FastifyRequest): string | null {
  const auth = request.headers["authorization"];
  if (!auth || !auth.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

export const applicationsController = {
  async createApplication(request: FastifyRequest, reply: FastifyReply): Promise<void> {
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
      sendError(reply, { code: result.code, message: result.message, statusCode: result.statusCode });
      return;
    }
    sendOk(reply, result, 201);
  },

  async getMyApplications(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) {
      sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 });
      return;
    }
    const result = await service.getMyApplications(token);
    if (!result.ok) {
      sendError(reply, { code: result.code, message: result.message, statusCode: result.statusCode });
      return;
    }
    sendOk(reply, result);
  },

  async listApplications(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) {
      sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 });
      return;
    }
    const query = request.query as Record<string, string | undefined>;
    const filters: { type?: string; status?: string; page?: number; limit?: number } = {};
    if (query["type"])   filters.type   = query["type"];
    if (query["status"]) filters.status = query["status"];
    if (query["page"])   filters.page   = Number(query["page"]);
    if (query["limit"])  filters.limit  = Number(query["limit"]);
    const result = await service.listApplications(token, filters);
    if (!result.ok) {
      sendError(reply, { code: result.code, message: result.message, statusCode: result.statusCode });
      return;
    }
    sendOk(reply, result);
  },

  async getApplication(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) {
      sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 });
      return;
    }
    const { id } = request.params as { id: string };
    const result = await service.getApplication(token, id);
    if (!result.ok) {
      sendError(reply, { code: result.code, message: result.message, statusCode: result.statusCode });
      return;
    }
    sendOk(reply, result.application);
  },

  async reviewApplication(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) {
      sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 });
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
      sendError(reply, { code: result.code, message: result.message, statusCode: result.statusCode });
      return;
    }
    sendOk(reply, result.application);
  },
};
