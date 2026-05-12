import type { FastifyRequest, FastifyReply } from "fastify";
import { AuthService } from "./auth.service.js";
import { loginRequestSchema, registerRequestSchema } from "./auth.schemas.js";
import type { LoginRequest, RegisterRequest } from "./auth.types.js";

const authService = new AuthService();

export const authController = {
  async login(
    request: FastifyRequest<{ Body: LoginRequest }>,
    reply: FastifyReply,
  ): Promise<void> {
    const parsed = loginRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      await reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: parsed.error.message, statusCode: 400 },
      });
      return;
    }
    const result = await authService.login(parsed.data);
    const status = result.ok ? 200 : 501;
    await reply.status(status).send(result);
  },

  async register(
    request: FastifyRequest<{ Body: RegisterRequest }>,
    reply: FastifyReply,
  ): Promise<void> {
    const parsed = registerRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      await reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: parsed.error.message, statusCode: 400 },
      });
      return;
    }
    const result = await authService.register(parsed.data);
    const status = result.ok ? 201 : 501;
    await reply.status(status).send(result);
  },

  async logout(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const authHeader = request.headers["authorization"] ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    const result = await authService.logout(token);
    await reply.status(200).send(result);
  },

  async me(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const authHeader = request.headers["authorization"] ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      await reply.status(401).send({
        error: { code: "UNAUTHORIZED", message: "Missing Authorization header.", statusCode: 401 },
      });
      return;
    }
    const result = await authService.getMe(token);
    const status = result.ok ? 200 : 501;
    await reply.status(status).send(result);
  },
};
