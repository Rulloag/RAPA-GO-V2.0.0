import {
  createRemoteJWKSet,
  errors as joseErrors,
  jwtVerify,
  type JWTPayload,
} from "jose";

import { AppError } from "../../shared/errors/AppError.js";
import {
  GOOGLE_ISSUERS,
  GOOGLE_JWKS_URL,
  getGoogleAuthConfig,
} from "./googleAuth.config.js";

const googleJwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL), {
  cooldownDuration: 30_000,
  timeoutDuration: 8_000,
});

export interface VerifiedGoogleIdentity {
  sub: string;
  aud: string;
  email: string;
  emailVerified: true;
  name: string;
  givenName?: string;
  familyName?: string;
  picture?: string;
}

function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeName(value: unknown, email: string): string {
  const clean = String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 100);

  if (clean.length >= 2) return clean;

  const localPart = email.split("@")[0]?.trim().slice(0, 100) ?? "";
  return localPart.length >= 2 ? localPart : "Usuario Google";
}

function readAudience(payload: JWTPayload, allowed: string[]): string {
  const audiences = Array.isArray(payload.aud)
    ? payload.aud
    : payload.aud
      ? [payload.aud]
      : [];
  const matched = audiences.find((audience) => allowed.includes(audience));

  if (!matched) {
    throw new AppError({
      code: "AUTH_GOOGLE_TOKEN_INVALID",
      message: "El token de Google no corresponde a RAPA GO.",
      statusCode: 401,
    });
  }

  return matched;
}

export class GoogleIdentityTokenVerifier {
  async verify(idToken: string): Promise<VerifiedGoogleIdentity> {
    const { allowedClientIds } = getGoogleAuthConfig();

    try {
      const verified = await jwtVerify(idToken, googleJwks, {
        algorithms: ["RS256"],
        issuer: [...GOOGLE_ISSUERS],
        audience: allowedClientIds,
        clockTolerance: 10,
      });
      const payload = verified.payload;
      const sub = String(payload.sub ?? "").trim();
      const email = normalizeEmail(payload["email"]);
      const emailVerified =
        payload["email_verified"] === true || payload["email_verified"] === "true";

      if (!sub || sub.length > 255 || !email || !email.includes("@")) {
        throw new AppError({
          code: "AUTH_GOOGLE_TOKEN_INVALID",
          message: "Google no entregó una identidad válida.",
          statusCode: 401,
        });
      }

      if (!emailVerified) {
        throw new AppError({
          code: "AUTH_GOOGLE_EMAIL_NOT_VERIFIED",
          message: "Tu correo de Google debe estar verificado.",
          statusCode: 403,
        });
      }

      const aud = readAudience(payload, allowedClientIds);
      const givenName = String(payload["given_name"] ?? "").trim().slice(0, 50);
      const familyName = String(payload["family_name"] ?? "").trim().slice(0, 50);
      const picture = String(payload["picture"] ?? "").trim();

      return {
        sub,
        aud,
        email,
        emailVerified: true,
        name: normalizeName(payload["name"], email),
        ...(givenName ? { givenName } : {}),
        ...(familyName ? { familyName } : {}),
        ...(picture.startsWith("https://") && picture.length <= 2048
          ? { picture }
          : {}),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;

      const isExpectedJwtError =
        error instanceof joseErrors.JOSEError || error instanceof TypeError;

      throw new AppError({
        code: "AUTH_GOOGLE_TOKEN_INVALID",
        message: isExpectedJwtError
          ? "No pudimos validar el ingreso con Google. Inténtalo nuevamente."
          : "No se pudo verificar la identidad de Google.",
        statusCode: 401,
      });
    }
  }
}
