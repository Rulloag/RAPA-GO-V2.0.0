import type { FastifyRequest, FastifyReply } from "fastify";
import { AuthService } from "./auth.service.js";
import {
  forgotPasswordRequestSchema,
  loginRequestSchema,
  registerRequestSchema,
  resetPasswordRequestSchema,
} from "./auth.schemas.js";
import type {
  ForgotPasswordRequest,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
} from "./auth.types.js";
import { sendError } from "../../shared/http/apiResponse.js";
import { PasswordResetService } from "./passwordReset.service.js";

const authService = new AuthService();
const passwordResetService = new PasswordResetService();

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function getFrontendUrl(): string {
  return (
    process.env["FRONTEND_URL"] ||
    "http://192.168.100.91:5173"
  ).replace(/\/$/, "");
}

export const authController = {
  async login(
    request: FastifyRequest<{ Body: LoginRequest }>,
    reply: FastifyReply,
  ): Promise<void> {
    const parsed = loginRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      sendError(reply, {
        code: "VALIDATION_ERROR",
        message: parsed.error.message,
        statusCode: 400,
      });
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
      sendError(reply, {
        code: "VALIDATION_ERROR",
        message: parsed.error.message,
        statusCode: 400,
      });
      return;
    }

    const result = await authService.register(parsed.data);

    if (!result.ok) {
      reply.status(result.statusCode ?? 409).send(result);
      return;
    }

    reply.status(201).send(result);
  },

  async forgotPassword(
    request: FastifyRequest<{ Body: ForgotPasswordRequest }>,
    reply: FastifyReply,
  ): Promise<void> {
    const parsed = forgotPasswordRequestSchema.safeParse(
      request.body,
    );

    if (!parsed.success) {
      sendError(reply, {
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ??
          "Solicitud inválida.",
        statusCode: 400,
      });
      return;
    }

    const userAgentHeader = request.headers["user-agent"];
    const userAgent = Array.isArray(userAgentHeader)
      ? userAgentHeader.join(" ")
      : userAgentHeader;

    const result =
      await passwordResetService.requestPasswordReset(
        parsed.data,
        {
          requestIp: request.ip,
          requestUserAgent: userAgent ?? null,
        },
      );

    reply
      .header("Cache-Control", "no-store")
      .status(202)
      .send(result);
  },

  async resetPassword(
    request: FastifyRequest<{ Body: ResetPasswordRequest }>,
    reply: FastifyReply,
  ): Promise<void> {
    const parsed = resetPasswordRequestSchema.safeParse(
      request.body,
    );

    if (!parsed.success) {
      sendError(reply, {
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ??
          "Solicitud inválida.",
        statusCode: 400,
      });
      return;
    }

    const result =
      await passwordResetService.resetPassword(parsed.data);

    reply.header("Cache-Control", "no-store");

    if ("statusCode" in result) {
      reply.status(result.statusCode).send(result);
      return;
    }

    reply.status(200).send(result);
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
      sendError(reply, {
        code: "UNAUTHORIZED",
        message: "Missing Authorization header.",
        statusCode: 401,
      });
      return;
    }

    const result = await authService.getMe(token);
    reply.status(result.ok ? 200 : (result.statusCode ?? 401)).send(result);
  },

  async facebookLogin(
    _request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const appId = getRequiredEnv("FACEBOOK_APP_ID");
    const redirectUri = getRequiredEnv("FACEBOOK_REDIRECT_URI");

    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      scope: "public_profile,email",
      response_type: "code",
    });

    reply.redirect(
      `https://www.facebook.com/v20.0/dialog/oauth?${params.toString()}`,
    );
  },

  async facebookCallback(
    request: FastifyRequest<{ Querystring: { code?: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const frontendUrl = getFrontendUrl();
    const code = request.query.code;

    if (!code) {
      reply.redirect(`${frontendUrl}/auth/login?facebook=error`);
      return;
    }

    const appId = getRequiredEnv("FACEBOOK_APP_ID");
    const appSecret = getRequiredEnv("FACEBOOK_APP_SECRET");
    const redirectUri = getRequiredEnv("FACEBOOK_REDIRECT_URI");

    const tokenParams = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: redirectUri,
      code,
    });

    const tokenResponse = await fetch(
      `https://graph.facebook.com/v20.0/oauth/access_token?${tokenParams.toString()}`,
    );

    const tokenData = (await tokenResponse.json()) as {
      access_token?: string;
      error?: unknown;
    };

    if (!tokenData.access_token) {
      reply.redirect(`${frontendUrl}/auth/login?facebook=error`);
      return;
    }

    const profileParams = new URLSearchParams({
      fields: "id,name,email,picture",
      access_token: tokenData.access_token,
    });

    const profileResponse = await fetch(
      `https://graph.facebook.com/me?${profileParams.toString()}`,
    );

    const profile = (await profileResponse.json()) as {
      id?: string;
      name?: string;
      email?: string;
      picture?: {
        data?: {
          url?: string;
        };
      };
    };

    if (!profile.id || !profile.name || !profile.email) {
      reply.redirect(`${frontendUrl}/auth/login?facebook=email_required`);
      return;
    }

    const result = await authService.loginWithFacebook({
      facebookId: profile.id,
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.picture?.data?.url ?? null,
    });

    if (!result.ok) {
      reply.redirect(`${frontendUrl}/auth/login?facebook=error`);
      return;
    }

    const redirectParams = new URLSearchParams({
      accessToken: result.session.accessToken,
      expiresAt: result.session.expiresAt,
      userId: result.session.user.id,
      email: result.session.user.email,
      name: result.session.user.name,
      role: result.session.user.role,
      avatarUrl: result.session.user.avatarUrl ?? "",
      isVerified: String(result.session.user.isVerified),
    });

    reply.redirect(
      `${frontendUrl}/auth/facebook/callback?${redirectParams.toString()}`,
    );
  },
};  