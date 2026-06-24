import type { FastifyRequest, FastifyReply } from "fastify";
import { AuthService } from "./auth.service.js";
import { GoogleAuthService } from "./googleAuth.service.js";
import { loginRequestSchema, registerRequestSchema } from "./auth.schemas.js";
import type { LoginRequest, RegisterRequest } from "./auth.types.js";
import { sendError } from "../../shared/http/apiResponse.js";

const authService       = new AuthService();
const googleAuthService = new GoogleAuthService();

export const authController = {
  async login(
    request: FastifyRequest<{ Body: LoginRequest }>,
    reply: FastifyReply,
  ): Promise<void> {
    const parsed = loginRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      sendError(reply, { code: "VALIDATION_ERROR", message: parsed.error.message, statusCode: 400 });
      return;
    }
    const result = await authService.login(parsed.data);
    reply.status(result.ok ? 200 : 401).send(result);
  },

  async register(
    request: FastifyRequest<{ Body: RegisterRequest }>,
    reply: FastifyReply,
  ): Promise<void> {
    const parsed = registerRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      sendError(reply, { code: "VALIDATION_ERROR", message: parsed.error.message, statusCode: 400 });
      return;
    }
    const result = await authService.register(parsed.data);
    if (!result.ok) {
      reply.status(result.statusCode ?? 409).send(result);
      return;
    }
    reply.status(201).send(result);
  },

  async logout(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const authHeader = request.headers["authorization"] ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    const result = await authService.logout(token);
    reply.status(200).send(result);
  },

  async me(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const authHeader = request.headers["authorization"] ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      sendError(reply, { code: "UNAUTHORIZED", message: "Missing Authorization header.", statusCode: 401 });
      return;
    }
    const result = await authService.getMe(token);
    reply.status(result.ok ? 200 : (result.statusCode ?? 401)).send(result);
  },

  async refresh(
    request: FastifyRequest<{ Body: { refreshToken: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const raw = request.body?.refreshToken;
    if (!raw || typeof raw !== "string") {
      sendError(reply, { code: "VALIDATION_ERROR", message: "refreshToken is required.", statusCode: 400 });
      return;
    }
    const result = await authService.refreshSession(raw);
    reply.status(result.ok ? 200 : (result.statusCode ?? 401)).send(result);
  },

  async googleLogin(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const body    = request.body as { idToken?: unknown } | undefined;
    const idToken = body?.idToken;
    if (!idToken || typeof idToken !== "string") {
      sendError(reply, { code: "VALIDATION_ERROR", message: "idToken is required.", statusCode: 400 });
      return;
    }
    const result = await googleAuthService.loginWithGoogle(idToken);
    reply.status(result.ok ? 200 : (result.statusCode ?? 401)).send(result);
  },
};
