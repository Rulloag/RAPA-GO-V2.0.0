import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { residenceAccreditationSchema } from "@rapa-go/shared";

import { AppError } from "../../shared/errors/AppError.js";
import { AppleAuthService } from "./appleAuth.service.js";
import { buildAppleClientSecret } from "./appleClientSecret.js";
import {
  APPLE_AUTHORIZE_URL,
  getAppleWebAuthConfig,
} from "./appleWeb.config.js";
import type { AppleWebCompleteInput } from "./appleWeb.types.js";
import {
  createAppleWebFlowToken,
  createAppleWebStateToken,
  readAppleWebFlowToken,
  readAppleWebStateToken,
} from "./appleWebFlowToken.js";

const appleAuthService = new AppleAuthService();

const APPLE_WEB_STATE_COOKIE = "rapago_apple_web_state";
const APPLE_WEB_STATE_TTL_SECONDS = 10 * 60;

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

    const rawValue = pair.slice(separator + 1).trim();

    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }

  return null;
}

function constantTimeEqualText(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function appleWebStateCookie(
  value: string,
  maxAge: number,
): string {
  const usesHttps =
    process.env["NODE_ENV"] === "production" ||
    String(process.env["APPLE_WEB_REDIRECT_URI"] ?? "")
      .trim()
      .toLowerCase()
      .startsWith("https://");
  const sameSite = usesHttps ? "None" : "Lax";
  const secure = usesHttps ? "Secure" : "";

  return [
    `${APPLE_WEB_STATE_COOKIE}=${encodeURIComponent(value)}`,
    "Path=/auth/apple/web/callback",
    "HttpOnly",
    `SameSite=${sameSite}`,
    `Max-Age=${Math.max(0, Math.floor(maxAge))}`,
    secure,
  ]
    .filter(Boolean)
    .join("; ");
}

const APPLE_WEB_RATE_LIMIT = {
  config: { rateLimit: { max: 15, timeWindow: "15 minutes" } },
} as const;

const appleWebCompleteSchema = z.object({
  flowToken: z.string().trim().min(100).max(30000),
  displayName: z.string().trim().min(2).max(100).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{8,15}$/, "El teléfono no es válido.")
    .optional(),
  contactEmail: z.string().trim().max(254).optional(),
  rut: z.string().trim().max(20).optional(),
  passport: z.string().trim().max(30).optional(),
  passengerFareType: z
    .enum(["resident", "chilean", "foreigner"])
    .optional(),
  legalAcceptances: z
    .array(
      z.object({
        legalDocumentId: z.string().uuid(),
        version: z.string().trim().min(1).max(30),
      }),
    )
    .max(12)
    .optional(),
  residenceAccreditation: residenceAccreditationSchema.optional(),
});

type AppleCallbackBody = {
  error?: string;
  state?: string;
  code?: string;
  id_token?: string;
  user?: string;
  [key: string]: string | undefined;
};

function createFrontendCallbackUrl(
  params: Record<string, string>,
): string {
  const config = getAppleWebAuthConfig();
  const url = new URL("/auth/login", config.frontendUrl);
  url.hash = new URLSearchParams(params).toString();
  return url.toString();
}

function redirectAppleError(
  reply: FastifyReply,
  code: string,
): void {
  reply
    .header("Cache-Control", "no-store")
    .header("Pragma", "no-cache")
    .redirect(
      createFrontendCallbackUrl({
        appleWebError: code,
      }),
    );
}

function parseAppleName(
  rawUser: string | undefined,
): { givenName?: string; familyName?: string } | undefined {
  if (!rawUser) return undefined;

  try {
    const parsed = JSON.parse(rawUser) as {
      name?: {
        firstName?: unknown;
        lastName?: unknown;
      };
    };

    const givenName =
      typeof parsed.name?.firstName === "string"
        ? parsed.name.firstName.trim().slice(0, 50)
        : "";
    const familyName =
      typeof parsed.name?.lastName === "string"
        ? parsed.name.lastName.trim().slice(0, 50)
        : "";

    if (!givenName && !familyName) return undefined;

    return {
      ...(givenName ? { givenName } : {}),
      ...(familyName ? { familyName } : {}),
    };
  } catch {
    return undefined;
  }
}

function requestUserAgent(request: FastifyRequest): string | undefined {
  const raw = request.headers["user-agent"];
  return Array.isArray(raw) ? raw.join(" ") : raw;
}

export async function appleWebRoutes(
  fastify: FastifyInstance,
): Promise<void> {
  if (
    !fastify.hasContentTypeParser(
      "application/x-www-form-urlencoded",
    )
  ) {
    fastify.addContentTypeParser(
      "application/x-www-form-urlencoded",
      { parseAs: "string" },
      (_request, body, done) => {
        try {
          const params = new URLSearchParams(String(body));
          done(null, Object.fromEntries(params.entries()));
        } catch (error) {
          done(error as Error, undefined);
        }
      },
    );
  }

  fastify.get(
    "/auth/apple/web/status",
    APPLE_WEB_RATE_LIMIT,
    async (_request, reply) => {
      const config = getAppleWebAuthConfig();

      // Generates and discards a short-lived client secret so this endpoint
      // also verifies that APPLE_PRIVATE_KEY can be imported correctly.
      await buildAppleClientSecret(config.clientId);

      reply
        .header("Cache-Control", "no-store")
        .header("Pragma", "no-cache")
        .status(200)
        .send({
          ok: true,
          configured: true,
          clientId: config.clientId,
          redirectUri: config.redirectUri,
          frontendUrl: config.frontendUrl,
        });
    },
  );

  fastify.get(
    "/auth/apple/web/start",
    APPLE_WEB_RATE_LIMIT,
    async (_request, reply) => {
      const config = getAppleWebAuthConfig();
      const rawNonce = randomBytes(32).toString("hex");
      const hashedNonce = createHash("sha256")
        .update(rawNonce, "utf8")
        .digest("hex");
      const csrf = randomBytes(32).toString("base64url");
      const state = await createAppleWebStateToken({
        nonce: rawNonce,
        clientId: config.clientId,
        csrf,
      });

      const query = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: "code id_token",
        response_mode: "form_post",
        scope: "name email",
        state,
        nonce: hashedNonce,
      });

      reply
        .header(
          "Set-Cookie",
          appleWebStateCookie(
            csrf,
            APPLE_WEB_STATE_TTL_SECONDS,
          ),
        )
        .header("Cache-Control", "no-store")
        .header("Pragma", "no-cache")
        .redirect(`${APPLE_AUTHORIZE_URL}?${query.toString()}`);
    },
  );

  fastify.post(
    "/auth/apple/web/callback",
    {
      bodyLimit: 64 * 1024,
      config: {
        rateLimit: { max: 20, timeWindow: "15 minutes" },
      },
    },
    async (
      request: FastifyRequest<{ Body: AppleCallbackBody }>,
      reply,
    ) => {
      const body = request.body ?? {};
      const cookieCsrf = readCookie(
        request.headers.cookie,
        APPLE_WEB_STATE_COOKIE,
      );

      reply.header(
        "Set-Cookie",
        appleWebStateCookie("", 0),
      );

      if (body.error) {
        redirectAppleError(
          reply,
          body.error === "user_cancelled_authorize"
            ? "cancelled"
            : "provider_error",
        );
        return;
      }

      if (!body.state || !body.code || !body.id_token) {
        redirectAppleError(reply, "invalid_response");
        return;
      }

      try {
        const config = getAppleWebAuthConfig();
        const state = await readAppleWebStateToken(body.state);

        if (
          state.clientId !== config.clientId ||
          !cookieCsrf ||
          !constantTimeEqualText(state.csrf, cookieCsrf)
        ) {
          throw new AppError({
            code: "AUTH_APPLE_WEB_STATE_INVALID",
            message: "Apple web state validation failed.",
            statusCode: 401,
          });
        }

        const name = parseAppleName(body.user);
        const userAgent = requestUserAgent(request);
        const prepared = await appleAuthService.prepareWebFlow(
          {
            identityToken: body.id_token,
            authorizationCode: body.code,
            nonce: state.nonce,
            expectedClientId: config.clientId,
            redirectUri: config.redirectUri,
            ...(name ? { name } : {}),
          },
          {
            ipAddress: request.ip,
            requestId: String(request.id),
            ...(userAgent ? { userAgent } : {}),
          },
        );

        const flowToken = await createAppleWebFlowToken(prepared);

        reply
          .header("Cache-Control", "no-store")
          .header("Pragma", "no-cache")
          .redirect(
            createFrontendCallbackUrl({
              appleWebFlow: flowToken,
            }),
          );
      } catch (error) {
        request.log.warn(
          {
            code:
              error instanceof AppError
                ? error.code
                : "AUTH_APPLE_WEB_CALLBACK_FAILED",
          },
          "Apple web callback failed.",
        );

        redirectAppleError(
          reply,
          error instanceof AppError
            ? error.code
            : "callback_failed",
        );
      }
    },
  );

  fastify.post(
    "/api/auth/apple/web/complete",
    {
      bodyLimit: 3 * 1024 * 1024,
      config: {
        rateLimit: { max: 12, timeWindow: "15 minutes" },
      },
    },
    async (
      request: FastifyRequest<{ Body: unknown }>,
      reply,
    ) => {
      const parsed = appleWebCompleteSchema.safeParse(request.body);

      if (!parsed.success) {
        reply
          .header("Cache-Control", "no-store")
          .header("Pragma", "no-cache")
          .status(400)
          .send({
            ok: false,
            code: "VALIDATION_ERROR",
            message:
              parsed.error.issues[0]?.message ??
              "Los datos del ingreso con Apple no son válidos.",
          });
        return;
      }

      try {
        const prepared = await readAppleWebFlowToken(
          parsed.data.flowToken,
        );
        const webConfig = getAppleWebAuthConfig();

        if (prepared.aud !== webConfig.clientId) {
          throw new AppError({
            code: "AUTH_APPLE_WEB_FLOW_INVALID",
            message: "El ingreso web con Apple no corresponde a esta aplicación.",
            statusCode: 401,
          });
        }

        const setupInput: Omit<
          AppleWebCompleteInput,
          "flowToken"
        > = {
          ...(parsed.data.displayName !== undefined
            ? { displayName: parsed.data.displayName }
            : {}),
          ...(parsed.data.phone !== undefined
            ? { phone: parsed.data.phone }
            : {}),
          ...(parsed.data.contactEmail !== undefined
            ? { contactEmail: parsed.data.contactEmail }
            : {}),
          ...(parsed.data.rut !== undefined
            ? { rut: parsed.data.rut }
            : {}),
          ...(parsed.data.passport !== undefined
            ? { passport: parsed.data.passport }
            : {}),
          ...(parsed.data.passengerFareType !== undefined
            ? {
                passengerFareType:
                  parsed.data.passengerFareType,
              }
            : {}),
          ...(parsed.data.legalAcceptances !== undefined
            ? {
                legalAcceptances:
                  parsed.data.legalAcceptances,
              }
            : {}),
          ...(parsed.data.residenceAccreditation !== undefined
            ? {
                residenceAccreditation:
                  parsed.data.residenceAccreditation,
              }
            : {}),
        };

        const userAgent = requestUserAgent(request);
        const result = await appleAuthService.completeWebFlow(
          prepared,
          setupInput,
          {
            ipAddress: request.ip,
            requestId: String(request.id),
            ...(userAgent ? { userAgent } : {}),
          },
        );

        reply
          .header("Cache-Control", "no-store")
          .header("Pragma", "no-cache")
          .status(200)
          .send(
            result.ok
              ? result
              : {
                  ok: false,
                  code: result.code,
                  message: result.message,
                  ...(prepared.email
                    ? { displayEmail: prepared.email }
                    : {}),
                },
          );
      } catch (error) {
        if (error instanceof AppError) {
          reply
            .header("Cache-Control", "no-store")
            .header("Pragma", "no-cache")
            .status(error.statusCode)
            .send({
              ok: false,
              code: error.code,
              message: error.message,
            });
          return;
        }

        throw error;
      }
    },
  );
}
