import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyRequest, FastifyReply } from "fastify";
import { AuthService } from "./auth.service.js";
import {
  facebookResidentPrecheckSchema,
  facebookResidentStatusSchema,
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
import type {
  FacebookResidentPrecheckInput,
  FacebookResidentStatusInput,
} from "./auth.schemas.js";
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

type FacebookOAuthState = {
  version: 1;
  residentIntent: boolean;
  expiresAt: number;
};

function createFacebookOAuthState(
  residentIntent: boolean,
  secret: string,
): string {
  const payload: FacebookOAuthState = {
    version: 1,
    residentIntent,
    expiresAt: Date.now() + 15 * 60 * 1000,
  };
  const encodedPayload = Buffer.from(
    JSON.stringify(payload),
    "utf8",
  ).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");

  return `${encodedPayload}.${signature}`;
}

function readFacebookOAuthState(
  value: string | undefined,
  secret: string,
): FacebookOAuthState | null {
  if (!value) return null;

  const [encodedPayload, receivedSignature] =
    value.split(".");

  if (!encodedPayload || !receivedSignature) {
    return null;
  }

  const expectedSignature = createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");
  const receivedBuffer = Buffer.from(
    receivedSignature,
    "utf8",
  );
  const expectedBuffer = Buffer.from(
    expectedSignature,
    "utf8",
  );

  if (
    receivedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(receivedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString(
        "utf8",
      ),
    ) as Partial<FacebookOAuthState>;

    if (
      parsed.version !== 1 ||
      typeof parsed.residentIntent !== "boolean" ||
      typeof parsed.expiresAt !== "number" ||
      parsed.expiresAt < Date.now()
    ) {
      return null;
    }

    return {
      version: 1,
      residentIntent: parsed.residentIntent,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}

function isFacebookResidentIntent(
  query: Record<string, string | undefined>,
): boolean {
  const condition = String(
    query["passengerCondition"] ??
      query["condition"] ??
      "",
  )
    .trim()
    .toLowerCase();

  return [
    "residente_rapa_nui",
    "residente rapa nui",
    "residente",
    "resident",
  ].includes(condition);
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

  async facebookResidentPrecheck(
    request: FastifyRequest<{
      Body: FacebookResidentPrecheckInput;
    }>,
    reply: FastifyReply,
  ): Promise<void> {
    const parsed = facebookResidentPrecheckSchema.safeParse(
      request.body,
    );

    if (!parsed.success) {
      sendError(reply, {
        code: "VALIDATION_ERROR",
        message:
          parsed.error.issues[0]?.message ??
          "Los datos de residencia no son válidos.",
        statusCode: 400,
      });
      return;
    }

    const result =
      await authService.submitFacebookResidentPrecheck(
        parsed.data,
      );

    reply
      .header("Cache-Control", "no-store")
      .status(result.ok ? 200 : result.statusCode)
      .send(result);
  },

  async facebookResidentStatus(
    request: FastifyRequest<{
      Body: FacebookResidentStatusInput;
    }>,
    reply: FastifyReply,
  ): Promise<void> {
    const parsed = facebookResidentStatusSchema.safeParse(
      request.body,
    );

    if (!parsed.success) {
      sendError(reply, {
        code: "VALIDATION_ERROR",
        message:
          parsed.error.issues[0]?.message ??
          "Los datos de consulta no son válidos.",
        statusCode: 400,
      });
      return;
    }

    const result =
      await authService.getFacebookResidentPrecheckStatus(
        parsed.data,
      );

    reply
      .header("Cache-Control", "no-store")
      .status(200)
      .send(result);
  },

  async facebookLogin(
    request: FastifyRequest<{
      Querystring: Record<string, string | undefined>;
    }>,
    reply: FastifyReply,
  ): Promise<void> {
    const appId = getRequiredEnv("FACEBOOK_APP_ID");
    const appSecret = getRequiredEnv("FACEBOOK_APP_SECRET");
    const redirectUri = getRequiredEnv("FACEBOOK_REDIRECT_URI");
    const residentIntent = isFacebookResidentIntent(
      request.query,
    );
    const state = createFacebookOAuthState(
      residentIntent,
      appSecret,
    );

    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      scope: "public_profile,email",
      response_type: "code",
      state,
    });

    reply.redirect(
      `https://www.facebook.com/v20.0/dialog/oauth?${params.toString()}`,
    );
  },

  async facebookCallback(
    request: FastifyRequest<{
      Querystring: {
        code?: string;
        state?: string;
      };
    }>,
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
    const oauthState = readFacebookOAuthState(
      request.query.state,
      appSecret,
    );

    if (!oauthState) {
      reply.redirect(
        `${frontendUrl}/auth/login?facebook=state_error`,
      );
      return;
    }
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

    const result = await authService.loginWithFacebook(
      {
        facebookId: profile.id,
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.picture?.data?.url ?? null,
      },
      {
        residentIntent: oauthState.residentIntent,
      },
    );

    if (!result.ok) {
      const errorCode =
        result.code === "AUTH_RESIDENCE_PENDING"
          ? "resident_pending"
          : result.code === "AUTH_RESIDENCE_REJECTED"
            ? "resident_rejected"
            : result.code === "AUTH_ACCOUNT_PENDING"
              ? "account_pending"
              : result.code === "AUTH_ACCOUNT_SUSPENDED"
                ? "account_blocked"
                : "error";

      reply.redirect(
        `${frontendUrl}/auth/login?facebook=${encodeURIComponent(errorCode)}`,
      );
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