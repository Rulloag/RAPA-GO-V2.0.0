import type { FastifyRequest, FastifyReply } from "fastify";
import { DashboardService } from "./dashboard.service.js";
import { sendOk, sendError } from "../../shared/http/apiResponse.js";

const dashboardService = new DashboardService();

export const dashboardController = {
  async getDashboard(req: FastifyRequest, reply: FastifyReply) {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return sendError(reply, { statusCode: 401, code: "UNAUTHORIZED", message: "Missing access token." });

    const result = await dashboardService.getDashboard(token);
    if (!result.ok) return sendError(reply, { statusCode: result.statusCode, code: result.code, message: result.message });
    return sendOk(reply, result.data);
  },

  async getActivity(req: FastifyRequest<{ Querystring: { limit?: string } }>, reply: FastifyReply) {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return sendError(reply, { statusCode: 401, code: "UNAUTHORIZED", message: "Missing access token." });

    const limit = Math.min(parseInt(req.query.limit ?? "20", 10) || 20, 100);

    const result = await dashboardService.getActivity(token, limit);
    if (!result.ok) return sendError(reply, { statusCode: result.statusCode, code: result.code, message: result.message });
    return sendOk(reply, result.items);
  },
};
