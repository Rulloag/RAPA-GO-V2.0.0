import jwt from "jsonwebtoken";
import { randomBytes, createHash } from "node:crypto";
import { AppError } from "../../shared/errors/AppError.js";
import type { AuthUser } from "./auth.types.js";

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes
const REFRESH_TOKEN_BYTES = 48;

export interface AccessTokenPayload {
  sub: string;      // user id
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

/**
 * TokenService — JWT issuance and refresh token generation.
 *
 * SECURITY rules:
 *  - Raw tokens are returned once and never stored.
 *  - Only SHA-256 hashes go into the database.
 *  - JWT_SECRET must come from environment — never hardcoded.
 *  - If JWT_SECRET is missing, all token operations throw a controlled error.
 */
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
    const expiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000);

    const payload: AccessTokenPayload = {
      sub:   user.id,
      email: user.email,
      role:  user.role,
    };

    const token = jwt.sign(payload, secret, {
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      algorithm: "HS256",
    });

    const hash = createHash("sha256").update(token).digest("hex");

    return { token, hash, expiresAt };
  }

  issueRefreshToken(): IssuedRefreshToken {
    const raw = randomBytes(REFRESH_TOKEN_BYTES).toString("hex");
    // Refresh tokens expire in 7 days
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const hash = createHash("sha256").update(raw).digest("hex");
    return { token: raw, hash, expiresAt };
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    const secret = this.getSecret();
    try {
      return jwt.verify(token, secret, { algorithms: ["HS256"] }) as AccessTokenPayload;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new AppError({ code: "AUTH_TOKEN_EXPIRED", message: "Access token has expired.", statusCode: 401 });
      }
      throw new AppError({ code: "UNAUTHORIZED", message: "Invalid access token.", statusCode: 401 });
    }
  }

  hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}
