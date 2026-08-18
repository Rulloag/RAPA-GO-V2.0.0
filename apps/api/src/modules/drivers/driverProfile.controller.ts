import type { FastifyRequest, FastifyReply } from "fastify";
import { DriverProfileService } from "./driverProfile.service.js";
import { upsertDriverProfileSchema } from "./driverProfile.schemas.js";
import { sendOk, sendError } from "../../shared/http/apiResponse.js";

const svc = new DriverProfileService();

function getToken(req: FastifyRequest): string {
  const auth = req.headers.authorization ?? "";
  return auth.replace(/^Bearer\s+/i, "");
}

export const driverProfileController = {
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
    const rawBody =
      req.body && typeof req.body === "object"
        ? (req.body as Record<string, unknown>)
        : null;
    if (rawBody && Object.prototype.hasOwnProperty.call(rawBody, "vehicleCategory")) {
      return sendError(reply, {
        code:       "VALIDATION_ERROR",
        message:    "La categoría aprobada del vehículo no se puede cambiar desde el perfil del conductor. Solicita una nueva revisión.",
        statusCode: 400,
      });
    }

    const parsed = upsertDriverProfileSchema.safeParse(req.body);
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

  async getDriverProfile(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const result = await svc.getPublicProfile(req.params.id);
    if (!result.ok) {
      return sendError(reply, {
        code:       result.code       ?? "INTERNAL_ERROR",
        message:    result.message    ?? "Internal error.",
        statusCode: result.statusCode ?? 500,
      });
    }
    return sendOk(reply, result.profile);
  },
};
