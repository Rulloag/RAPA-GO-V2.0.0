import type { FastifyRequest, FastifyReply } from "fastify";
import { FareSettingsService } from "./fareSettings.service.js";
import { sendOk, sendError } from "../../shared/http/apiResponse.js";
import { createFareSettingSchema, updateFareSettingSchema, createZoneFareSchema, updateZoneFareSchema } from "./fareSettings.schemas.js";

const service = new FareSettingsService();

function extractBearer(request: FastifyRequest): string | null {
  const auth = request.headers["authorization"];
  if (!auth || !auth.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

export const fareSettingsController = {
  async getActive(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const result = await service.getActive();
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, { items: result.items });
  },

  async getByType(request: FastifyRequest<{ Params: { type: string } }>, reply: FastifyReply): Promise<void> {
    const result = await service.getByType(request.params.type);
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, { setting: result.setting });
  },

  async getZoneFares(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const query = request.query as { zoneFrom?: string; zoneTo?: string };
    const filters: { zoneFrom?: string; zoneTo?: string } = {};
    if (query.zoneFrom) filters.zoneFrom = query.zoneFrom;
    if (query.zoneTo)   filters.zoneTo   = query.zoneTo;
    const result = await service.getZoneFares(filters);
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, { items: result.items, total: result.total });
  },

  async listAll(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) { sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 }); return; }
    const result = await service.listAll(token);
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, { items: result.items });
  },

  async createFareSetting(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) { sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 }); return; }
    const parsed = createFareSettingSchema.safeParse(request.body);
    if (!parsed.success) {
      sendError(reply, { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid input.", statusCode: 400 });
      return;
    }
    const result = await service.createFareSetting(token, parsed.data);
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, { setting: result.setting }, 201);
  },

  async updateFareSetting(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) { sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 }); return; }
    const parsed = updateFareSettingSchema.safeParse(request.body);
    if (!parsed.success) {
      sendError(reply, { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid input.", statusCode: 400 });
      return;
    }
    const result = await service.updateFareSetting(token, request.params.id, parsed.data);
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, { setting: result.setting });
  },

  async createZoneFare(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) { sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 }); return; }
    const parsed = createZoneFareSchema.safeParse(request.body);
    if (!parsed.success) {
      sendError(reply, { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid input.", statusCode: 400 });
      return;
    }
    const result = await service.createZoneFare(token, parsed.data);
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, { zoneFare: result.zoneFare }, 201);
  },

  async updateZoneFare(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) { sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 }); return; }
    const parsed = updateZoneFareSchema.safeParse(request.body);
    if (!parsed.success) {
      sendError(reply, { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid input.", statusCode: 400 });
      return;
    }
    const result = await service.updateZoneFare(token, request.params.id, parsed.data);
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, { zoneFare: result.zoneFare });
  },
};
