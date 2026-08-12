import jwt from "jsonwebtoken";
import { randomBytes, createHash } from "node:crypto";
import { AppError } from "../../shared/errors/AppError.js";
import type { AuthUser } from "./auth.types.js";

const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 24 * 60 * 60; // 24 horas
const MIN_ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const MAX_ACCESS_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

function getAccessTokenTtlSeconds(): number {
  /**
   * El valor crudo se comprueba ANTES de convertirlo a número.
   *
   * Antes esto era `Number(process.env[...] ?? "")`, y ahí estaba el fallo:
   * cuando la variable no está definida (que es el caso en producción), el
   * `?? ""` deja una cadena vacía y `Number("")` devuelve 0 — que ES finito.
   * Así que el `if (!Number.isFinite(...))` nunca se cumplía, el default de
   * 24 h era código muerto, y el clamp de abajo dejaba el TTL en el mínimo:
   * `max(900, 0)` = 900 s = 15 minutos.
   *
   * Consecuencia real: el token moría a los 15 minutos, así que bastaba con
   * cambiar de aplicación un rato normal para volver con la sesión caducada.
   */
  const raw = process.env["ACCESS_TOKEN_TTL_SECONDS"]?.trim();

  if (!raw) {
    return DEFAULT_ACCESS_TOKEN_TTL_SECONDS;
  }

  const configured = Number(raw);

  if (!Number.isFinite(configured) || configured <= 0) {
    return DEFAULT_ACCESS_TOKEN_TTL_SECONDS;
  }

  return Math.min(
    MAX_ACCESS_TOKEN_TTL_SECONDS,
    Math.max(MIN_ACCESS_TOKEN_TTL_SECONDS, Math.floor(configured)),
  );
}
const REFRESH_TOKEN_BYTES = 48;

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface IssuedAccessToken {
  token: string;
  hash: string;
  expiresAt: Date;
}

export interface IssuedRefreshToken {
  token: string;
  hash: string;
  expiresAt: Date;
}

export class TokenService {
  private getSecret(): string {
    const secret = process.env["JWT_SECRET"];

    if (!secret) {
      throw new AppError({
        code: "AUTH_CONFIGURATION_ERROR",
        message: "JWT_SECRET is not configured. Authentication is unavailable.",
        statusCode: 503,
      });
    }

    return secret;
  }

  issueAccessToken(user: AuthUser): IssuedAccessToken {
    const secret = this.getSecret();
    const ttlSeconds = getAccessTokenTtlSeconds();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const token = jwt.sign(payload, secret, {
      expiresIn: ttlSeconds,
      algorithm: "HS256",
    });

    const hash = createHash("sha256").update(token).digest("hex");

    return { token, hash, expiresAt };
  }

  issueRefreshToken(): IssuedRefreshToken {
    const raw = randomBytes(REFRESH_TOKEN_BYTES).toString("hex");
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    const hash = createHash("sha256").update(raw).digest("hex");

    return { token: raw, hash, expiresAt };
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    const secret = this.getSecret();

    try {
      return jwt.verify(token, secret, {
        algorithms: ["HS256"],
      }) as AccessTokenPayload;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new AppError({
          code: "AUTH_TOKEN_EXPIRED",
          message: "Access token has expired.",
          statusCode: 401,
        });
      }

      throw new AppError({
        code: "UNAUTHORIZED",
        message: "Invalid access token.",
        statusCode: 401,
      });
    }
  }

  hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}