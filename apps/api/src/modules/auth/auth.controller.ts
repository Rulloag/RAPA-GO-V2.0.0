import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import type { FastifyRequest, FastifyReply } from "fastify";
import { AuthService } from "./auth.service.js";
import {
  appleAuthRequestSchema,
  createPasswordRequestSchema,
  facebookAccountSetupSchema,
  facebookExistingAccountLinkSchema,
  facebookLoginExchangeSchema,
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
  AppleAuthRequestInput,
  CreatePasswordRequestInput,
  FacebookAccountSetupInput,
  FacebookExistingAccountLinkInput,
  FacebookLoginExchangeInput,
  FacebookResidentPrecheckInput,
  FacebookResidentStatusInput,
} from "./auth.schemas.js";
import { sendError } from "../../shared/http/apiResponse.js";
import { PasswordResetService } from "./passwordReset.service.js";
import { AppleAuthService } from "./appleAuth.service.js";

const authService = new AuthService();
const passwordResetService = new PasswordResetService();
const appleAuthService = new AppleAuthService();

const FACEBOOK_STATE_COOKIE = "rapago_fb_oauth_state";
const FACEBOOK_STATE_TTL_SECONDS = 15 * 60;
const FACEBOOK_EXISTING_LINK_TTL_SECONDS = 5 * 60;
const FACEBOOK_HTTP_TIMEOUT_MS = 10_000;

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function getFrontendUrl(): string {
  const configured = process.env["FRONTEND_URL"]?.trim();
  const fallback =
    process.env["NODE_ENV"] === "production"
      ? ""
      : "http://localhost:5173";
  const raw = configured || fallback;

  if (!raw) {
    throw new Error(
      "Missing environment variable: FRONTEND_URL",
    );
  }

  const parsed = new URL(raw);

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("FRONTEND_URL must use http or https.");
  }

  if (
    process.env["NODE_ENV"] === "production" &&
    parsed.protocol !== "https:"
  ) {
    throw new Error("FRONTEND_URL must use HTTPS in production.");
  }

  return parsed.origin;
}

type FacebookPassengerFareType = "resident" | "chilean" | "foreigner";
type FacebookOAuthMode = "login" | "link";

type FacebookOAuthState = {
  version: 4;
  mode: FacebookOAuthMode;
  passengerFareType: FacebookPassengerFareType;
  phone?: string;
  nonce: string;
  expiresAt: number;
  linkCode?: string;
};

function createFacebookOAuthState(
  passengerFareType: FacebookPassengerFareType,
  nonce: string,
  secret: string,
  mode: FacebookOAuthMode = "login",
  linkCode?: string,
  phone?: string,
): string {
  const payload: FacebookOAuthState = {
    version: 4,
    mode,
    passengerFareType,
    nonce,
    expiresAt: Date.now() + FACEBOOK_STATE_TTL_SECONDS * 1000,
    ...(mode === "link" && linkCode ? { linkCode } : {}),
    ...(phone ? { phone } : {}),
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

  const [encodedPayload, receivedSignature] = value.split(".");

  if (!encodedPayload || !receivedSignature) return null;

  const expectedSignature = createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");
  const receivedBuffer = Buffer.from(receivedSignature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");

  if (
    receivedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(receivedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as Partial<FacebookOAuthState>;

    if (
      parsed.version !== 4 ||
      (parsed.mode !== "login" && parsed.mode !== "link") ||
      (parsed.passengerFareType !== "resident" &&
        parsed.passengerFareType !== "chilean" &&
        parsed.passengerFareType !== "foreigner") ||
      typeof parsed.nonce !== "string" ||
      parsed.nonce.length < 32 ||
      typeof parsed.expiresAt !== "number" ||
      parsed.expiresAt < Date.now() ||
      (parsed.mode === "link" &&
        (typeof parsed.linkCode !== "string" ||
          parsed.linkCode.length < 32))
    ) {
      return null;
    }

    return {
      version: 4,
      mode: parsed.mode,
      passengerFareType: parsed.passengerFareType,
      nonce: parsed.nonce,
      expiresAt: parsed.expiresAt,
      ...(parsed.linkCode ? { linkCode: parsed.linkCode } : {}),
      ...(typeof parsed.phone === "string" &&
      /^\+?[0-9]{8,15}$/.test(parsed.phone)
        ? { phone: parsed.phone }
        : {}),
    };
  } catch {
    return null;
  }
}

type FacebookExistingAccountLinkToken = {
  version: 1;
  linkCode: string;
  facebookId: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  expiresAt: number;
};

function createFacebookExistingAccountLinkToken(
  input: Omit<FacebookExistingAccountLinkToken, "version" | "expiresAt">,
  secret: string,
): string {
  const payload: FacebookExistingAccountLinkToken = {
    version: 1,
    ...input,
    expiresAt:
      Date.now() + FACEBOOK_EXISTING_LINK_TTL_SECONDS * 1000,
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

function readFacebookExistingAccountLinkToken(
  value: string | undefined,
  secret: string,
): FacebookExistingAccountLinkToken | null {
  if (!value) return null;

  const [encodedPayload, receivedSignature] = value.split(".");

  if (!encodedPayload || !receivedSignature) return null;

  const expectedSignature = createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");
  const receivedBuffer = Buffer.from(receivedSignature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");

  if (
    receivedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(receivedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as Partial<FacebookExistingAccountLinkToken>;

    const avatarUrl =
      typeof parsed.avatarUrl === "string" && parsed.avatarUrl.length <= 2048
        ? parsed.avatarUrl
        : null;

    if (
      parsed.version !== 1 ||
      typeof parsed.linkCode !== "string" ||
      !/^[A-Za-z0-9_-]{32,128}$/.test(parsed.linkCode) ||
      typeof parsed.facebookId !== "string" ||
      parsed.facebookId.length < 1 ||
      parsed.facebookId.length > 128 ||
      typeof parsed.email !== "string" ||
      parsed.email.length < 3 ||
      parsed.email.length > 255 ||
      !parsed.email.includes("@") ||
      typeof parsed.name !== "string" ||
      parsed.name.trim().length < 1 ||
      parsed.name.length > 200 ||
      typeof parsed.expiresAt !== "number" ||
      parsed.expiresAt < Date.now()
    ) {
      return null;
    }

    return {
      version: 1,
      linkCode: parsed.linkCode,
      facebookId: parsed.facebookId,
      email: parsed.email.trim().toLowerCase(),
      name: parsed.name.trim(),
      avatarUrl,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}

function normalizeFacebookPhone(value: unknown): string {
  const normalized = String(value ?? "")
    .replace(/[^+\d]/g, "")
    .trim();

  return /^\+?[0-9]{8,15}$/.test(normalized)
    ? normalized
    : "";
}

function constantTimeEqualText(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function readCookie(
  cookieHeader: string | undefined,
  name: string,
): string | null {
  if (!cookieHeader) return null;

  for (const pair of cookieHeader.split(";")) {
    const separator = pair.indexOf("=");
    if (separator < 0) continue;

    const key = pair.slice(0, separator).trim();
    if (key !== name) continue;

    const value = pair.slice(separator + 1).trim();

    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  return null;
}

function facebookStateCookie(value: string, maxAge: number): string {
  const secure =
    process.env["NODE_ENV"] === "production" ? "; Secure" : "";

  return [
    `${FACEBOOK_STATE_COOKIE}=${encodeURIComponent(value)}`,
    "Path=/api/auth/facebook",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
    secure,
  ]
    .filter(Boolean)
    .join("; ");
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    FACEBOOK_HTTP_TIMEOUT_MS,
  );

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function getFacebookPassengerFareType(
  query: Record<string, string | undefined>,
): FacebookPassengerFareType {
  const value = String(
    query["requestedPassengerFareType"] ??
      query["passengerFareType"] ??
      query["passengerCondition"] ??
      query["condition"] ??
      "",
  )
    .trim()
    .toLowerCase();

  if (
    value === "resident" ||
    value === "residente" ||
    value === "residente_rapa_nui" ||
    value === "residente rapa nui"
  ) {
    return "resident";
  }

  if (
    value === "foreigner" ||
    value === "extranjero" ||
    value === "turista_extranjero" ||
    value === "turista extranjero"
  ) {
    return "foreigner";
  }

  // Valores antiguos rapanui/rapanui_normal ya no son una categoría activa.
  return "chilean";
}

function buildFacebookAuthorizationUrl(input: {
  appId: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: input.appId,
    redirect_uri: input.redirectUri,
    scope: "public_profile,email",
    response_type: "code",
    state: input.state,
  });

  return `https://www.facebook.com/v20.0/dialog/oauth?${params.toString()}`;
}

function extractBearer(request: FastifyRequest): string {
  const auth = request.headers.authorization;
  return auth?.startsWith("Bearer ") ? auth.slice(7).trim() : "";
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
        message: parsed.error.issues[0]?.message ?? "Datos inválidos.",
        statusCode: 400,
      });
      return;
    }

    const result = await authService.login(parsed.data);
    reply
      .header("Cache-Control", "no-store")
      .header("Pragma", "no-cache")
      .status(result.ok ? 200 : (result.statusCode ?? 401))
      .send(result);
  },

  async register(
    request: FastifyRequest<{ Body: RegisterRequest }>,
    reply: FastifyReply,
  ): Promise<void> {
    const parsed = registerRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      sendError(reply, {
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Datos inválidos.",
        statusCode: 400,
      });
      return;
    }

    const result = await authService.register(parsed.data);

    reply
      .header("Cache-Control", "no-store")
      .header("Pragma", "no-cache")
      .status(result.ok ? 201 : (result.statusCode ?? 409))
      .send(result);
  },

  async appleLogin(
    request: FastifyRequest<{ Body: AppleAuthRequestInput }>,
    reply: FastifyReply,
  ): Promise<void> {
    const parsed = appleAuthRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      sendError(reply, {
        code: "VALIDATION_ERROR",
        message:
          parsed.error.issues[0]?.message ??
          "Los datos de Apple no son válidos.",
        statusCode: 400,
      });
      return;
    }

    const userAgentHeader = request.headers["user-agent"];
    const userAgent = Array.isArray(userAgentHeader)
      ? userAgentHeader.join(" ")
      : userAgentHeader;

    const result = await appleAuthService.signIn(parsed.data, {
      ipAddress: request.ip,
      ...(userAgent ? { userAgent } : {}),
    });

    reply
      .header("Cache-Control", "no-store")
      .header("Pragma", "no-cache")
      .status(result.ok ? 200 : (result.statusCode ?? 401))
      .send(result);
  },

  async appleLink(
    request: FastifyRequest<{ Body: AppleAuthRequestInput }>,
    reply: FastifyReply,
  ): Promise<void> {
    const parsed = appleAuthRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      sendError(reply, {
        code: "VALIDATION_ERROR",
        message:
          parsed.error.issues[0]?.message ??
          "Los datos de Apple no son válidos.",
        statusCode: 400,
      });
      return;
    }

    const result = await appleAuthService.link(
      extractBearer(request),
      parsed.data,
    );

    reply
      .header("Cache-Control", "no-store")
      .header("Pragma", "no-cache")
      .status(result.ok ? 200 : result.statusCode)
      .send(result);
  },

  async forgotPassword(
    request: FastifyRequest<{ Body: ForgotPasswordRequest }>,
    reply: FastifyReply,
  ): Promise<void> {
    const parsed = forgotPasswordRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      sendError(reply, {
        code: "VALIDATION_ERROR",
        message:
          parsed.error.issues[0]?.message ?? "Solicitud inválida.",
        statusCode: 400,
      });
      return;
    }

    const userAgentHeader = request.headers["user-agent"];
    const userAgent = Array.isArray(userAgentHeader)
      ? userAgentHeader.join(" ")
      : userAgentHeader;

    const result = await passwordResetService.requestPasswordReset(
      parsed.data,
      {
        requestIp: request.ip,
        requestUserAgent: userAgent ?? null,
      },
    );

    reply.header("Cache-Control", "no-store").status(202).send(result);
  },

  async resetPassword(
    request: FastifyRequest<{ Body: ResetPasswordRequest }>,
    reply: FastifyReply,
  ): Promise<void> {
    const parsed = resetPasswordRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      sendError(reply, {
        code: "VALIDATION_ERROR",
        message:
          parsed.error.issues[0]?.message ?? "Solicitud inválida.",
        statusCode: 400,
      });
      return;
    }

    const result = await passwordResetService.resetPassword(parsed.data);

    reply.header("Cache-Control", "no-store");

    if ("statusCode" in result) {
      reply.status(result.statusCode).send(result);
      return;
    }

    reply.status(200).send(result);
  },

  async createPassword(
    request: FastifyRequest<{ Body: CreatePasswordRequestInput }>,
    reply: FastifyReply,
  ): Promise<void> {
    const token = extractBearer(request);

    if (!token) {
      sendError(reply, {
        code: "UNAUTHORIZED",
        message: "Falta el token de acceso.",
        statusCode: 401,
      });
      return;
    }

    const parsed = createPasswordRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      sendError(reply, {
        code: "VALIDATION_ERROR",
        message:
          parsed.error.issues[0]?.message ?? "Solicitud inválida.",
        statusCode: 400,
      });
      return;
    }

    const result = await authService.createPassword(
      token,
      parsed.data.newPassword,
    );

    reply
      .header("Cache-Control", "no-store")
      .status(result.ok ? 200 : result.statusCode)
      .send(result);
  },

  async logout(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const result = await authService.logout(extractBearer(request));
    reply.header("Cache-Control", "no-store").status(200).send(result);
  },

  async me(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const token = extractBearer(request);

    if (!token) {
      sendError(reply, {
        code: "UNAUTHORIZED",
        message: "Missing Authorization header.",
        statusCode: 401,
      });
      return;
    }

    const result = await authService.getMe(token);
    reply
      .header("Cache-Control", "no-store")
      .status(result.ok ? 200 : (result.statusCode ?? 401))
      .send(result);
  },

  async facebookResidentPrecheck(
    request: FastifyRequest<{ Body: FacebookResidentPrecheckInput }>,
    reply: FastifyReply,
  ): Promise<void> {
    const parsed = facebookResidentPrecheckSchema.safeParse(request.body);

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

    const result = await authService.submitFacebookResidentPrecheck(
      parsed.data,
    );

    reply
      .header("Cache-Control", "no-store")
      .status(result.ok ? 200 : result.statusCode)
      .send(result);
  },

  async facebookResidentStatus(
    request: FastifyRequest<{ Body: FacebookResidentStatusInput }>,
    reply: FastifyReply,
  ): Promise<void> {
    const parsed = facebookResidentStatusSchema.safeParse(request.body);

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

    const result = await authService.getFacebookResidentPrecheckStatus(
      parsed.data,
    );

    reply.header("Cache-Control", "no-store").status(200).send(result);
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
    const passengerFareType = getFacebookPassengerFareType(
      request.query,
    );
    const phone = normalizeFacebookPhone(request.query["phone"]);
    const nonce = randomBytes(32).toString("base64url");
    const state = createFacebookOAuthState(
      passengerFareType,
      nonce,
      appSecret,
      "login",
      undefined,
      phone || undefined,
    );

    reply
      .header(
        "Set-Cookie",
        facebookStateCookie(nonce, FACEBOOK_STATE_TTL_SECONDS),
      )
      .header("Cache-Control", "no-store")
      .redirect(
        buildFacebookAuthorizationUrl({
          appId,
          redirectUri,
          state,
        }),
      );
  },

  async facebookLinkStart(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const token = extractBearer(request);
    const prepared = await authService.prepareFacebookIdentityLink(token);

    if (!prepared.ok) {
      sendError(reply, {
        code: prepared.code,
        message: prepared.message,
        statusCode: prepared.statusCode,
      });
      return;
    }

    const appId = getRequiredEnv("FACEBOOK_APP_ID");
    const appSecret = getRequiredEnv("FACEBOOK_APP_SECRET");
    const redirectUri = getRequiredEnv("FACEBOOK_REDIRECT_URI");
    const nonce = randomBytes(32).toString("base64url");
    const state = createFacebookOAuthState(
      "chilean",
      nonce,
      appSecret,
      "link",
      prepared.linkCode,
    );

    reply
      .header(
        "Set-Cookie",
        facebookStateCookie(nonce, FACEBOOK_STATE_TTL_SECONDS),
      )
      .header("Cache-Control", "no-store")
      .status(200)
      .send({
        ok: true,
        authorizationUrl: buildFacebookAuthorizationUrl({
          appId,
          redirectUri,
          state,
        }),
      });
  },

  async facebookCallback(
    request: FastifyRequest<{
      Querystring: { code?: string; state?: string };
    }>,
    reply: FastifyReply,
  ): Promise<void> {
    const frontendUrl = getFrontendUrl();
    const code = request.query.code;
    const appId = getRequiredEnv("FACEBOOK_APP_ID");
    const appSecret = getRequiredEnv("FACEBOOK_APP_SECRET");
    const redirectUri = getRequiredEnv("FACEBOOK_REDIRECT_URI");
    const oauthState = readFacebookOAuthState(
      request.query.state,
      appSecret,
    );
    const cookieNonce = readCookie(
      request.headers.cookie,
      FACEBOOK_STATE_COOKIE,
    );

    reply
      .header("Set-Cookie", facebookStateCookie("", 0))
      .header("Cache-Control", "no-store");

    if (!code) {
      reply.redirect(`${frontendUrl}/auth/login?facebook=error`);
      return;
    }

    if (
      !oauthState ||
      !cookieNonce ||
      !constantTimeEqualText(oauthState.nonce, cookieNonce)
    ) {
      reply.redirect(
        `${frontendUrl}/auth/login?facebook=state_error`,
      );
      return;
    }

    const tokenParams = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: redirectUri,
      code,
    });

    const tokenResponse = await fetchWithTimeout(
      "https://graph.facebook.com/v20.0/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: tokenParams.toString(),
      },
    );

    const tokenData = (await tokenResponse.json().catch(() => ({}))) as {
      access_token?: string;
    };

    if (!tokenResponse.ok || !tokenData.access_token) {
      reply.redirect(`${frontendUrl}/auth/login?facebook=error`);
      return;
    }

    const appSecretProof = createHmac("sha256", appSecret)
      .update(tokenData.access_token)
      .digest("hex");
    const profileParams = new URLSearchParams({
      fields: "id,name,email,picture",
      appsecret_proof: appSecretProof,
    });

    const profileResponse = await fetchWithTimeout(
      `https://graph.facebook.com/me?${profileParams.toString()}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          Accept: "application/json",
        },
      },
    );

    const profile = (await profileResponse.json().catch(() => ({}))) as {
      id?: string;
      name?: string;
      email?: string;
      picture?: { data?: { url?: string } };
    };

    if (
      !profileResponse.ok ||
      !profile.id ||
      !profile.name ||
      !profile.email
    ) {
      reply.redirect(
        `${frontendUrl}/auth/login?facebook=email_required`,
      );
      return;
    }

    if (oauthState.mode === "link") {
      const linkResult = await authService.completeFacebookIdentityLink(
        oauthState.linkCode ?? "",
        {
          facebookId: profile.id,
          email: profile.email,
          name: profile.name,
        },
      );

      const linkStatus = linkResult.ok
        ? "success"
        : linkResult.code === "AUTH_IDENTITY_ALREADY_LINKED"
          ? "already-linked"
          : "error";

      reply.redirect(
        `${frontendUrl}/profile/security?facebookLink=${encodeURIComponent(linkStatus)}`,
      );
      return;
    }

    const result = await authService.loginWithFacebook({
      facebookId: profile.id,
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.picture?.data?.url ?? null,
    });

    if (!result.ok) {
      const errorCode =
        result.code === "AUTH_RESIDENCE_PENDING"
          ? "resident_pending"
          : result.code === "AUTH_RESIDENCE_REJECTED"
            ? "resident_rejected"
            : result.code === "AUTH_FACEBOOK_LINK_REQUIRED"
              ? "link_required"
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

    if (result.kind === "link_existing") {
      const linkToken = createFacebookExistingAccountLinkToken(
        {
          linkCode: result.linkCode,
          facebookId: result.facebookId,
          email: result.email,
          name: result.name,
          avatarUrl: result.avatarUrl ?? null,
        },
        appSecret,
      );
      const query = new URLSearchParams({
        facebook: "link_required",
        linkToken,
        email: result.email,
      });

      reply.redirect(
        `${frontendUrl}/auth/login?${query.toString()}`,
      );
      return;
    }

    if (result.kind === "setup") {
      const query = new URLSearchParams({
        facebook: "setup",
        setupCode: result.setupCode,
        email: profile.email,
      });

      reply.redirect(
        `${frontendUrl}/auth/login?${query.toString()}`,
      );
      return;
    }

    const callbackQuery = new URLSearchParams({
      exchangeCode: result.exchangeCode,
    });

    // The exchange code is short-lived, single-use and is removed from
    // browser history immediately by the frontend callback page.
    reply.redirect(
      `${frontendUrl}/auth/facebook/callback?${callbackQuery.toString()}`,
    );
  },

  async facebookLinkExisting(
    request: FastifyRequest<{ Body: FacebookExistingAccountLinkInput }>,
    reply: FastifyReply,
  ): Promise<void> {
    const parsed = facebookExistingAccountLinkSchema.safeParse(
      request.body,
    );

    if (!parsed.success) {
      sendError(reply, {
        code: "VALIDATION_ERROR",
        message:
          parsed.error.issues[0]?.message ??
          "Los datos para vincular Facebook no son válidos.",
        statusCode: 400,
      });
      return;
    }

    const appSecret = getRequiredEnv("FACEBOOK_APP_SECRET");
    const linkPayload = readFacebookExistingAccountLinkToken(
      parsed.data.linkToken,
      appSecret,
    );

    if (!linkPayload) {
      sendError(reply, {
        code: "AUTH_FACEBOOK_LINK_EXPIRED",
        message:
          "La vinculación con Facebook expiró. Vuelve a presionar Continuar con Facebook.",
        statusCode: 401,
      });
      return;
    }

    const result =
      await authService.completeFacebookExistingAccountLink({
        linkCode: linkPayload.linkCode,
        email: linkPayload.email,
        facebookId: linkPayload.facebookId,
        name: linkPayload.name,
        avatarUrl: linkPayload.avatarUrl ?? null,
        password: parsed.data.password,
      });

    reply
      .header("Cache-Control", "no-store")
      .header("Pragma", "no-cache")
      .status(result.ok ? 200 : result.statusCode)
      .send(result);
  },

  async facebookSetup(
    request: FastifyRequest<{ Body: FacebookAccountSetupInput }>,
    reply: FastifyReply,
  ): Promise<void> {
    const parsed = facebookAccountSetupSchema.safeParse(request.body);

    if (!parsed.success) {
      sendError(reply, {
        code: "VALIDATION_ERROR",
        message:
          parsed.error.issues[0]?.message ??
          "Los datos del pasajero no son válidos.",
        statusCode: 400,
      });
      return;
    }

    const result = await authService.completeFacebookAccountSetup(
      parsed.data,
    );

    reply
      .header("Cache-Control", "no-store")
      .header("Pragma", "no-cache")
      .status(result.ok ? 200 : result.statusCode)
      .send(result);
  },

  async facebookExchange(
    request: FastifyRequest<{ Body: FacebookLoginExchangeInput }>,
    reply: FastifyReply,
  ): Promise<void> {
    const parsed = facebookLoginExchangeSchema.safeParse(request.body);

    if (!parsed.success) {
      sendError(reply, {
        code: "VALIDATION_ERROR",
        message:
          parsed.error.issues[0]?.message ??
          "El código de Facebook no es válido.",
        statusCode: 400,
      });
      return;
    }

    const result = await authService.exchangeFacebookLogin(
      parsed.data.exchangeCode,
    );

    reply
      .header("Cache-Control", "no-store")
      .header("Pragma", "no-cache")
      .status(result.ok ? 200 : (result.statusCode ?? 401))
      .send(result);
  },
};
