import { AppError } from "../../shared/errors/AppError.js";
import { fetchWithTimeout, resolveTimeoutMs, ProviderTimeoutError } from "../../shared/http/providerTimeout.js";
import { APPLE_REVOKE_URL } from "./appleAuth.config.js";
import { buildAppleClientSecret } from "./appleClientSecret.js";
import type { FetchLike } from "./appleIdentityToken.verifier.js";

export interface AppleTokenRevocationResult {
  revoked: true;
  alreadyInvalid: boolean;
}

// Fallback seguro si APPLE_TOKEN_TIMEOUT_MS no está definido o es inválido.
const APPLE_TOKEN_DEFAULT_TIMEOUT_MS = 8000;

/**
 * Revokes a Sign in with Apple refresh token through Apple's official
 * /auth/revoke endpoint. Tokens and response bodies are never logged.
 */
export class AppleTokenRevocationClient {
  constructor(private readonly fetchImpl: FetchLike = fetch) {}

  async revokeRefreshToken(
    refreshToken: string,
    clientId: string,
  ): Promise<AppleTokenRevocationResult> {
    const clientSecret = await buildAppleClientSecret(clientId);
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      token: refreshToken,
      token_type_hint: "refresh_token",
    });

    const timeoutMs = resolveTimeoutMs("APPLE_TOKEN_TIMEOUT_MS", APPLE_TOKEN_DEFAULT_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetchWithTimeout(
        "apple-token-revocation",
        APPLE_REVOKE_URL,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
        },
        timeoutMs,
        this.fetchImpl,
      );
    } catch (error) {
      if (error instanceof ProviderTimeoutError) {
        console.error("[Apple] Timeout en revocación de token:", { timeoutMs: error.timeoutMs });
      } else {
        console.error("[Apple] Error de red en revocación de token.");
      }
      throw new AppError({
        code: "AUTH_APPLE_TOKEN_REVOCATION_UNAVAILABLE",
        message:
          "No se pudo contactar a Apple para revocar la autorización. Intenta nuevamente.",
        statusCode: 503,
      });
    }

    if (response.ok) {
      return { revoked: true, alreadyInvalid: false };
    }

    let appleError = "";
    try {
      const payload = (await response.json()) as { error?: unknown };
      appleError =
        typeof payload.error === "string" ? payload.error : "";
    } catch {
      // Never include Apple's raw body because it may contain sensitive data.
    }

    if (appleError === "invalid_grant" || appleError === "invalid_token") {
      return { revoked: true, alreadyInvalid: true };
    }

    throw new AppError({
      code: "AUTH_APPLE_TOKEN_REVOCATION_FAILED",
      message:
        "Apple no pudo revocar la autorización de esta cuenta. Revisa la configuración y vuelve a intentar.",
      statusCode: response.status >= 500 ? 503 : 409,
    });
  }
}
