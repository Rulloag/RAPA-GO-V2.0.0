import { SignJWT, importPKCS8 } from "jose";
import { AppError } from "../../shared/errors/AppError.js";
import {
  APPLE_ISSUER,
  APPLE_REVOKE_URL,
  APPLE_TOKEN_URL,
  getAppleAuthConfig,
} from "./appleAuth.config.js";

export interface AppleTokenExchangeResult {
  accessToken: string;
  refreshToken?: string;
  idToken: string;
  expiresIn: number;
}

const CLIENT_SECRET_TTL_SECONDS = 5 * 60;
type FetchLike = typeof fetch;

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

  async exchange(
    authorizationCode: string,
    clientId: string,
  ): Promise<AppleTokenExchangeResult> {
    const clientSecret = await this.buildClientSecret(clientId);
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
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
    } catch {
      throw new AppError({
        code: "AUTH_APPLE_TOKEN_EXCHANGE_FAILED",
        message: "No fue posible contactar el servicio de Apple.",
        statusCode: 503,
      });
    }

    if (!response.ok) {
      throw new AppError({
        code: "AUTH_APPLE_TOKEN_EXCHANGE_FAILED",
        message: "Apple rechazó el código de autorización.",
        statusCode: 401,
      });
    }

    const data = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      id_token?: string;
      expires_in?: number;
    };

    if (!data.access_token || !data.id_token) {
      throw new AppError({
        code: "AUTH_APPLE_TOKEN_EXCHANGE_FAILED",
        message: "Apple entregó una respuesta incompleta.",
        statusCode: 503,
      });
    }

    return {
      accessToken: data.access_token,
      ...(data.refresh_token ? { refreshToken: data.refresh_token } : {}),
      idToken: data.id_token,
      expiresIn: data.expires_in ?? 0,
    };
  }

  async revoke(refreshToken: string, clientId: string): Promise<void> {
    const clientSecret = await this.buildClientSecret(clientId);
    const body = new URLSearchParams({
      token: refreshToken,
      token_type_hint: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
    });

    const response = await this.fetchImpl(APPLE_REVOKE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new AppError({
        code: "AUTH_APPLE_REVOCATION_FAILED",
        message: "Apple no confirmó la revocación del acceso.",
        statusCode: 502,
      });
    }
  }
}
