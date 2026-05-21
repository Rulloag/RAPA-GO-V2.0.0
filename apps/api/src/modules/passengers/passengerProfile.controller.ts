import type { FastifyRequest, FastifyReply } from "fastify";
import { PassengerProfileService } from "./passengerProfile.service.js";
import { upsertPassengerProfileSchema } from "./passengerProfile.schemas.js";
import { sendOk, sendError } from "../../shared/http/apiResponse.js";

const svc = new PassengerProfileService();

function getToken(req: FastifyRequest): string {
  const auth = req.headers.authorization ?? "";
  return auth.replace(/^Bearer\s+/i, "");
}

export const passengerProfileController = {
  async getMyProfile(req: FastifyRequest, reply: FastifyReply) {
    const result = await svc.getProfile(getToken(req));
    if (!result.ok) {
      return sendError(reply, {
        code:       result.code       ?? "INTERNAL_ERROR",
        message:    result.message    ?? "Internal error.",
        statusCode: result.statusCode ?? 500,
      });
    }
    return sendOk(reply, result.profile);
  },

  async upsertMyProfile(req: FastifyRequest, reply: FastifyReply) {
    const parsed = upsertPassengerProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(reply, {
        code:       "VALIDATION_ERROR",
        message:    parsed.error.errors.map((e) => e.message).join("; "),
        statusCode: 400,
      });
    }
    const result = await svc.upsertProfile(getToken(req), parsed.data);
    if (!result.ok) {
      return sendError(reply, {
        code:       result.code       ?? "INTERNAL_ERROR",
        message:    result.message    ?? "Internal error.",
        statusCode: result.statusCode ?? 500,
      });
    }
    return sendOk(reply, result.profile);
  },

  async getMyPreferences(req: FastifyRequest, reply: FastifyReply) {
    const result = await svc.getPreferences(getToken(req));
    if (!result.ok) {
      return sendError(reply, {
        code:       result.code       ?? "INTERNAL_ERROR",
        message:    result.message    ?? "Internal error.",
        statusCode: result.statusCode ?? 500,
      });
    }
    return sendOk(reply, result.preferences);
  },
};
