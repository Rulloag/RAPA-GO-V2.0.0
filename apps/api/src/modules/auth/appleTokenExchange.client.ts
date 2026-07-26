import { AppError } from "../../shared/errors/AppError.js";
import { APPLE_TOKEN_URL } from "./appleAuth.config.js";
import { buildAppleClientSecret } from "./appleClientSecret.js";
import type { FetchLike } from "./appleIdentityToken.verifier.js";

export interface AppleTokenExchangeResult {
  accessToken: string;
  refreshToken: string | undefined;
  idToken: string;
  expiresIn: number;
}

/**
 * Exchanges an authorization code for Apple's access/refresh/id tokens.
 * The generated client secret and all returned provider tokens are never
 * logged by this client.
 */
export class AppleTokenExchangeClient {
  constructor(private readonly fetchImpl: FetchLike = fetch) {}

  async exchange(
    authorizationCode: string,
    clientId: string,
  ): Promise<AppleTokenExchangeResult> {
    const clientSecret = await buildAppleClientSecret(clientId);

    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code: authorizationCode,
      client_id: clientId,
      client_secret: clientSecret,
    });

    let response: Response;
    try {
      response = await this.fetchImpl(APPLE_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });
    } catch {
      throw new AppError({
        code: "AUTH_APPLE_TOKEN_EXCHANGE_FAILED",
        message: "Could not reach Apple's token endpoint.",
        statusCode: 503,
      });
    }

    if (!response.ok) {
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
      access_token?: string;
      refresh_token?: string;
      id_token?: string;
      expires_in?: number;
    };

    if (!parsed.access_token || !parsed.id_token) {
      throw new AppError({
        code: "AUTH_APPLE_TOKEN_EXCHANGE_FAILED",
        message: "Apple's token endpoint response is missing required fields.",
        statusCode: 503,
      });
    }

    return {
      accessToken: parsed.access_token,
      refreshToken: parsed.refresh_token,
      idToken: parsed.id_token,
      expiresIn: parsed.expires_in ?? 0,
    };
  }
}
