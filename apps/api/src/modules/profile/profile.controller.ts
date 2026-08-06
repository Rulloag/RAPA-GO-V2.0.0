import type { FastifyRequest, FastifyReply } from "fastify";
import { ProfileService } from "./profile.service.js";
import { updateProfileSchema } from "./profile.schemas.js";
import { sendOk, sendError } from "../../shared/http/apiResponse.js";
import type { UpdateProfileInput } from "../users/users.types.js";

const profileService = new ProfileService();

function extractBearer(request: FastifyRequest): string | null {
  const auth = request.headers["authorization"];
  if (!auth || !auth.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

export const profileController = {
  async getProfile(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) {
      sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 });
      return;
    }

    const result = await profileService.getProfile(token);
    if (!result.ok) {
      sendError(reply, { code: result.code, message: result.message, statusCode: result.statusCode ?? 401 });
      return;
    }
    sendOk(reply, result.profile);
  },

  async updateProfile(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = extractBearer(request);
    if (!token) {
      sendError(reply, { code: "UNAUTHORIZED", message: "Missing Bearer token.", statusCode: 401 });
      return;
    }

    const parsed = updateProfileSchema.safeParse(request.body);
    if (!parsed.success) {
      sendError(reply, {
        code: "VALIDATION_ERROR",
        message: parsed.error.errors[0]?.message ?? "Invalid request body.",
        statusCode: 400,
      });
      return;
    }

    // La identidad está bloqueada. El único campo de autoservicio admitido
    // por el esquema y el servicio es la foto de perfil.
    const input: UpdateProfileInput = {};
    const avatarUrl = parsed.data.avatarUrl;
    if ("avatarUrl" in parsed.data && avatarUrl !== undefined) {
      input.avatarUrl = avatarUrl;
    }

    const result = await profileService.updateProfile(token, input);
    if (!result.ok) {
      sendError(reply, { code: result.code, message: result.message, statusCode: result.statusCode ?? 401 });
      return;
    }
    sendOk(reply, result.profile);
  },
};
