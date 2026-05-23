import type { FastifyRequest, FastifyReply } from "fastify";
import { NotificationsService } from "./notifications.service.js";
import { sendOk, sendError } from "../../shared/http/apiResponse.js";

const notificationsService = new NotificationsService();

function extractBearer(request: FastifyRequest): string | null {
  const auth = request.headers["authorization"];
  if (!auth || !auth.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

export const notificationsController = {
  async getMyNotifications(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) { sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 }); return; }
    const result = await notificationsService.getMyNotifications(token);
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, result);
  },

  async markRead(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) { sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 }); return; }
    const result = await notificationsService.markRead(token, request.params.id);
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, {});
  },

  async dismiss(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) { sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 }); return; }
    const result = await notificationsService.dismiss(token, request.params.id);
    if (!result.ok) { sendError(reply, result); return; }
    sendOk(reply, {});
  },
};
