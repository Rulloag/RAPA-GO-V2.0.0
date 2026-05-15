import type { FastifyRequest, FastifyReply } from "fastify";
import { AdminService } from "./admin.service.js";
import { listUsersQuerySchema, updateUserStatusSchema } from "./admin.schemas.js";
import { sendOk, sendError } from "../../shared/http/apiResponse.js";

const adminService = new AdminService();

export const adminController = {
  async listUsers(req: FastifyRequest, reply: FastifyReply) {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return sendError(reply, { statusCode: 401, code: "UNAUTHORIZED", message: "Missing access token." });

    const parsed = listUsersQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return sendError(reply, { statusCode: 400, code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid query params." });
    }

    const result = await adminService.listUsers(token, parsed.data);
    if (!result.ok) return sendError(reply, { statusCode: result.statusCode, code: result.code, message: result.message });
    return sendOk(reply, result.users);
  },

  async updateUserStatus(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return sendError(reply, { statusCode: 401, code: "UNAUTHORIZED", message: "Missing access token." });

    const parsed = updateUserStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(reply, { statusCode: 400, code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid body." });
    }

    const result = await adminService.updateUserStatus(token, req.params.id, parsed.data);
    if (!result.ok) return sendError(reply, { statusCode: result.statusCode, code: result.code, message: result.message });
    return sendOk(reply, result.user);
  },
};
