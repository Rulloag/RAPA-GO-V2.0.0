import type { FastifyRequest, FastifyReply } from "fastify";
import { DriverStatusService } from "./driverStatus.service.js";
import { sendOk, sendError } from "../../shared/http/apiResponse.js";

const svc = new DriverStatusService();

function getToken(req: FastifyRequest): string {
  const auth = req.headers.authorization ?? "";
  return auth.replace(/^Bearer\s+/i, "");
}

export const driverStatusController = {
  async getMyStatus(req: FastifyRequest, reply: FastifyReply) {
    const result = await svc.getMyStatus(getToken(req));
    if (!result.ok) {
      return sendError(reply, {
        code:       result.code       ?? "INTERNAL_ERROR",
        message:    result.message    ?? "Internal error.",
        statusCode: result.statusCode ?? 500,
      });
    }
    return sendOk(reply, result.status);
  },

  async updateMyStatus(req: FastifyRequest<{ Body: { availability: string } }>, reply: FastifyReply) {
    const result = await svc.updateMyStatus(getToken(req), req.body.availability);
    if (!result.ok) {
      return sendError(reply, {
        code:       result.code       ?? "INTERNAL_ERROR",
        message:    result.message    ?? "Internal error.",
        statusCode: result.statusCode ?? 500,
      });
    }
    return sendOk(reply, result.status);
  },
};
