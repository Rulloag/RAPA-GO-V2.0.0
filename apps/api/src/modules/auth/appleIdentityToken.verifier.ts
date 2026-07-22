import { createHash, timingSafeEqual } from "node:crypto";
import { decodeProtectedHeader, importJWK, jwtVerify } from "jose";
import { AppError } from "../../shared/errors/AppError.js";
import { getAppleAuthConfig, APPLE_ISSUER, APPLE_JWKS_URL } from "./appleAuth.config.js";

export interface AppleIdentityTokenClaims {
  sub: string;
  /** The verified audience — the exact client_id that requested this token. */
  aud: string;
  email: string | undefined;
  emailVerified: boolean;
  isPrivateEmail: boolean;
}

interface JsonWebKeySet {
  keys: Array<Record<string, unknown> & { kid?: string }>;
}

/** Injectable so tests never hit the real network — defaults to global fetch. */
export type FetchLike = typeof fetch;

function toBool(value: unknown): boolean {
  return value === true || value === "true";
}

/**
 * AppleIdentityTokenVerifier — verifies an Apple `identityToken` per Apple's
 * published requirements:
 *  - signature verified against Apple's live JWKS (https://appleid.apple.com/auth/keys),
 *    selecting the key by the token's `kid`;
 *  - algorithm restricted to ES256 only (checked both before and during
 *    verification — a token asserting any other alg is rejected without
 *    ever fetching a key for it);
 *  - `iss` must be exactly "https://appleid.apple.com";
 *  - `aud` must be one of the operator-configured APPLE_ALLOWED_CLIENT_IDS
 *    (never an arbitrary/attacker-supplied audience);
 *  - `exp` enforced by jose's clock check;
 *  - `sub` must be present and non-empty;
 *  - `nonce`, when the caller supplies an expected raw nonce, is checked
 *    against the SHA-256 hex digest embedded in the token — this matches
 *    how native "Sign in with Apple" embeds the nonce (Apple hashes the
 *    raw nonce before putting it in the identityToken).
 */
export class AppleIdentityTokenVerifier {
  constructor(private readonly fetchImpl: FetchLike = fetch) {}

  private async fetchJwks(): Promise<JsonWebKeySet> {
    let response: Response;
    try {
      response = await this.fetchImpl(APPLE_JWKS_URL);
    } catch {
      throw new AppError({
        code: "AUTH_APPLE_JWKS_UNAVAILABLE",
        message: "Could not reach Apple's signing key endpoint.",
        statusCode: 503,
      });
    }
    if (!response.ok) {
      throw new AppError({
        code: "AUTH_APPLE_JWKS_UNAVAILABLE",
        message: `Apple's signing key endpoint returned HTTP ${response.status}.`,
        statusCode: 503,
      });
    }
    try {
      return (await response.json()) as JsonWebKeySet;
    } catch {
      throw new AppError({
        code: "AUTH_APPLE_JWKS_UNAVAILABLE",
        message: "Apple's signing key endpoint returned an invalid response.",
        statusCode: 503,
      });
    }
  }

  async verify(
    identityToken: string,
    opts: { expectedNonce?: string } = {},
  ): Promise<AppleIdentityTokenClaims> {
    const config = getAppleAuthConfig();

    let header;
    try {
      header = decodeProtectedHeader(identityToken);
    } catch {
      throw new AppError({ code: "AUTH_APPLE_TOKEN_INVALID", message: "Malformed Apple identity token.", statusCode: 401 });
    }

    if (header.alg !== "ES256") {
      throw new AppError({
        code: "AUTH_APPLE_TOKEN_INVALID",
        message: "Apple identity token must be signed with ES256.",
        statusCode: 401,
      });
    }
    if (!header.kid) {
      throw new AppError({ code: "AUTH_APPLE_TOKEN_INVALID", message: "Apple identity token is missing a key id.", statusCode: 401 });
    }

    const jwks = await this.fetchJwks();
    const jwk = jwks.keys.find((k) => k.kid === header.kid);
    if (!jwk) {
      throw new AppError({
        code: "AUTH_APPLE_TOKEN_INVALID",
        message: "Apple identity token references an unknown signing key.",
        statusCode: 401,
      });
    }

    let payload;
    try {
      const key = await importJWK(jwk, "ES256");
      const result = await jwtVerify(identityToken, key, {
        issuer:     APPLE_ISSUER,
        audience:   config.allowedClientIds,
        algorithms: ["ES256"],
      });
      payload = result.payload;
    } catch {
      throw new AppError({ code: "AUTH_APPLE_TOKEN_INVALID", message: "Apple identity token failed verification.", statusCode: 401 });
    }

    const sub = typeof payload["sub"] === "string" ? payload["sub"] : "";
    if (!sub) {
      throw new AppError({ code: "AUTH_APPLE_TOKEN_INVALID", message: "Apple identity token is missing sub.", statusCode: 401 });
    }

    if (opts.expectedNonce !== undefined) {
      const expectedHashedNonce = createHash("sha256").update(opts.expectedNonce).digest("hex");
      const tokenNonce = payload["nonce"];
      let matches = false;
      if (typeof tokenNonce === "string" && /^[0-9a-f]{64}$/i.test(tokenNonce)) {
        matches = timingSafeEqual(Buffer.from(tokenNonce, "hex"), Buffer.from(expectedHashedNonce, "hex"));
      }
      if (!matches) {
        throw new AppError({ code: "AUTH_APPLE_NONCE_MISMATCH", message: "Apple identity token nonce does not match.", statusCode: 401 });
      }
    }

    const aud = Array.isArray(payload["aud"]) ? payload["aud"][0] : payload["aud"];

    return {
      sub,
      aud:            typeof aud === "string" ? aud : "",
      email:          typeof payload["email"] === "string" ? payload["email"] : undefined,
      emailVerified:  toBool(payload["email_verified"]),
      isPrivateEmail: toBool(payload["is_private_email"]),
    };
  }
}
