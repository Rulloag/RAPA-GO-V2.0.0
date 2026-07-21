import { createHash, timingSafeEqual } from "node:crypto";
import { decodeProtectedHeader, importJWK, jwtVerify } from "jose";
import { AppError } from "../../shared/errors/AppError.js";
import {
  APPLE_ISSUER,
  APPLE_JWKS_URL,
  getAppleAuthConfig,
} from "./appleAuth.config.js";

export interface AppleIdentityTokenClaims {
  sub: string;
  aud: string;
  email?: string;
  emailVerified: boolean;
  isPrivateEmail: boolean;
}

type FetchLike = typeof fetch;
interface AppleJwksResponse {
  keys: Array<Record<string, unknown> & { kid?: string; alg?: string }>;
}

const JWKS_CACHE_MS = 6 * 60 * 60 * 1000;
let cachedJwks: { expiresAt: number; value: AppleJwksResponse } | null = null;

function toBoolean(value: unknown): boolean {
  return value === true || value === "true";
}

export class AppleIdentityTokenVerifier {
  constructor(private readonly fetchImpl: FetchLike = fetch) {}

  private async getJwks(forceRefresh = false): Promise<AppleJwksResponse> {
    if (!forceRefresh && cachedJwks && cachedJwks.expiresAt > Date.now()) {
      return cachedJwks.value;
    }

    let response: Response;
    try {
      response = await this.fetchImpl(APPLE_JWKS_URL, {
        headers: { Accept: "application/json" },
      });
    } catch {
      throw new AppError({
        code: "AUTH_APPLE_JWKS_UNAVAILABLE",
        message: "No fue posible consultar las claves públicas de Apple.",
        statusCode: 503,
      });
    }

    if (!response.ok) {
      throw new AppError({
        code: "AUTH_APPLE_JWKS_UNAVAILABLE",
        message: "Apple no entregó sus claves públicas de autenticación.",
        statusCode: 503,
      });
    }

    let parsed: AppleJwksResponse;
    try {
      parsed = (await response.json()) as AppleJwksResponse;
    } catch {
      throw new AppError({
        code: "AUTH_APPLE_JWKS_UNAVAILABLE",
        message: "Apple entregó una respuesta de claves no válida.",
        statusCode: 503,
      });
    }

    if (!Array.isArray(parsed.keys) || parsed.keys.length === 0) {
      throw new AppError({
        code: "AUTH_APPLE_JWKS_UNAVAILABLE",
        message: "Apple no entregó claves públicas utilizables.",
        statusCode: 503,
      });
    }

    cachedJwks = { expiresAt: Date.now() + JWKS_CACHE_MS, value: parsed };
    return parsed;
  }

  async verify(
    identityToken: string,
    options: { expectedNonce?: string } = {},
  ): Promise<AppleIdentityTokenClaims> {
    const config = getAppleAuthConfig();

    let header: ReturnType<typeof decodeProtectedHeader>;
    try {
      header = decodeProtectedHeader(identityToken);
    } catch {
      throw new AppError({
        code: "AUTH_APPLE_TOKEN_INVALID",
        message: "El token de Apple no tiene un formato válido.",
        statusCode: 401,
      });
    }

    // Apple publica RS256 para la firma de identity_token. ES256 se usa
    // únicamente para firmar el client_secret del servidor.
    if (header.alg !== "RS256" || !header.kid) {
      throw new AppError({
        code: "AUTH_APPLE_TOKEN_INVALID",
        message: "El token de Apple usa una firma no permitida.",
        statusCode: 401,
      });
    }

    let jwks = await this.getJwks();
    let jwk = jwks.keys.find((item) => item.kid === header.kid);
    if (!jwk) {
      jwks = await this.getJwks(true);
      jwk = jwks.keys.find((item) => item.kid === header.kid);
    }

    if (!jwk) {
      throw new AppError({
        code: "AUTH_APPLE_TOKEN_INVALID",
        message: "El token de Apple referencia una clave desconocida.",
        statusCode: 401,
      });
    }

    let payload;
    try {
      const key = await importJWK(jwk, "RS256");
      const result = await jwtVerify(identityToken, key, {
        issuer: APPLE_ISSUER,
        audience: config.allowedClientIds,
        algorithms: ["RS256"],
      });
      payload = result.payload;
    } catch {
      throw new AppError({
        code: "AUTH_APPLE_TOKEN_INVALID",
        message: "No fue posible verificar el token de Apple.",
        statusCode: 401,
      });
    }

    const subject = typeof payload["sub"] === "string" ? payload["sub"].trim() : "";
    if (!subject) {
      throw new AppError({
        code: "AUTH_APPLE_TOKEN_INVALID",
        message: "El token de Apple no contiene un identificador estable.",
        statusCode: 401,
      });
    }

    const audienceValue = Array.isArray(payload["aud"])
      ? payload["aud"][0]
      : payload["aud"];
    const audience = typeof audienceValue === "string" ? audienceValue : "";
    if (!audience || !config.allowedClientIds.includes(audience)) {
      throw new AppError({
        code: "AUTH_APPLE_TOKEN_INVALID",
        message: "El token de Apple no corresponde a RAPA GO.",
        statusCode: 401,
      });
    }

    if (options.expectedNonce !== undefined) {
      const expectedHash = createHash("sha256")
        .update(options.expectedNonce, "utf8")
        .digest("hex");
      const tokenNonce = payload["nonce"];
      const validNonce =
        typeof tokenNonce === "string" &&
        /^[a-f0-9]{64}$/i.test(tokenNonce) &&
        timingSafeEqual(
          Buffer.from(tokenNonce.toLowerCase(), "hex"),
          Buffer.from(expectedHash, "hex"),
        );

      if (!validNonce) {
        throw new AppError({
          code: "AUTH_APPLE_NONCE_MISMATCH",
          message: "La validación de seguridad de Apple no coincide.",
          statusCode: 401,
        });
      }
    }

    return {
      sub: subject,
      aud: audience,
      ...(typeof payload["email"] === "string"
        ? { email: payload["email"].trim().toLowerCase() }
        : {}),
      emailVerified: toBoolean(payload["email_verified"]),
      isPrivateEmail: toBoolean(payload["is_private_email"]),
    };
  }
}
