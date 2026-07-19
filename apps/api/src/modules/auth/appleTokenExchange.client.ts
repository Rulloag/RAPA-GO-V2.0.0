import { SignJWT, importPKCS8 } from "jose";
import { AppError } from "../../shared/errors/AppError.js";
import { getAppleAuthConfig, APPLE_ISSUER, APPLE_TOKEN_URL } from "./appleAuth.config.js";
import type { FetchLike } from "./appleIdentityToken.verifier.js";

export interface AppleTokenExchangeResult {
  accessToken:  string;
  refreshToken: string | undefined;
  idToken:      string;
  expiresIn:    number;
}

const CLIENT_SECRET_TTL_SECONDS = 5 * 60; // short-lived — generated fresh per exchange, well under Apple's 6-month max

/**
 * AppleTokenExchangeClient — exchanges an authorizationCode for Apple's own
 * access/refresh/id tokens via POST https://appleid.apple.com/auth/token.
 *
 * Apple requires a JWT "client_secret" (not a static string) signed with the
 * account's private key (APPLE_PRIVATE_KEY), header kid=APPLE_KEY_ID,
 * payload iss=APPLE_TEAM_ID / aud=https://appleid.apple.com / sub=client_id.
 * This secret is generated fresh for every exchange and never persisted or
 * logged — only the resulting id_token/access_token/refresh_token leave this
 * function, and callers must not log those either.
 */
export class AppleTokenExchangeClient {
  constructor(private readonly fetchImpl: FetchLike = fetch) {}

  private async buildClientSecret(clientId: string): Promise<string> {
    const config = getAppleAuthConfig();
    const privateKey = await importPKCS8(config.privateKey, "ES256");

    return new SignJWT({})
      .setProtectedHeader({ alg: "ES256", kid: config.keyId })
      .setIssuer(config.teamId)
      .setAudience(APPLE_ISSUER)
      .setSubject(clientId)
      .setIssuedAt()
      .setExpirationTime(`${CLIENT_SECRET_TTL_SECONDS}s`)
      .sign(privateKey);
  }

  async exchange(authorizationCode: string, clientId: string): Promise<AppleTokenExchangeResult> {
    const clientSecret = await this.buildClientSecret(clientId);

    const body = new URLSearchParams({
      grant_type:    "authorization_code",
      code:          authorizationCode,
      client_id:     clientId,
      client_secret: clientSecret,
    });

    let response: Response;
    try {
      response = await this.fetchImpl(APPLE_TOKEN_URL, {
        method:  "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body:    body.toString(),
      });
    } catch {
      throw new AppError({
        code: "AUTH_APPLE_TOKEN_EXCHANGE_FAILED",
        message: "Could not reach Apple's token endpoint.",
        statusCode: 503,
      });
    }

    if (!response.ok) {
      // Apple's error body may contain the submitted authorizationCode in some
      // error variants — never log the raw response body here.
      throw new AppError({
        code: "AUTH_APPLE_TOKEN_EXCHANGE_FAILED",
        message: "Apple rejected the authorization code.",
        statusCode: 401,
      });
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new AppError({
        code: "AUTH_APPLE_TOKEN_EXCHANGE_FAILED",
        message: "Apple's token endpoint returned an invalid response.",
        statusCode: 503,
      });
    }

    const parsed = data as {
      access_token?:  string;
      refresh_token?: string;
      id_token?:      string;
      expires_in?:    number;
    };

    if (!parsed.access_token || !parsed.id_token) {
      throw new AppError({
        code: "AUTH_APPLE_TOKEN_EXCHANGE_FAILED",
        message: "Apple's token endpoint response is missing required fields.",
        statusCode: 503,
      });
    }

    return {
      accessToken:  parsed.access_token,
      refreshToken: parsed.refresh_token,
      idToken:      parsed.id_token,
      expiresIn:    parsed.expires_in ?? 0,
    };
  }
}
