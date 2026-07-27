import { AppError } from "../../shared/errors/AppError.js";

export const APPLE_ISSUER = "https://appleid.apple.com";
export const APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys";
export const APPLE_TOKEN_URL = "https://appleid.apple.com/auth/token";
export const APPLE_REVOKE_URL = "https://appleid.apple.com/auth/revoke";

export interface AppleAuthConfig {
  allowedClientIds: string[];
  teamId: string;
  keyId: string;
  /** PEM-encoded EC private key, newlines normalized. */
  privateKey: string;
}

/**
 * Reads and validates Apple Sign In configuration.
 *
 * Fails closed: throws AUTH_CONFIGURATION_ERROR (503) — never returns a
 * partial/empty config — if any required variable is missing or malformed.
 * Called lazily, at the point Apple sign-in is actually attempted, so the
 * rest of the API can boot and serve unrelated traffic without these vars.
 */
export function getAppleAuthConfig(): AppleAuthConfig {
  const missing: string[] = [];

  const rawClientIds = process.env["APPLE_ALLOWED_CLIENT_IDS"] ?? "";
  const allowedClientIds = rawClientIds
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (allowedClientIds.length === 0) missing.push("APPLE_ALLOWED_CLIENT_IDS");

  const teamId = process.env["APPLE_TEAM_ID"] ?? "";
  if (!teamId) missing.push("APPLE_TEAM_ID");

  const keyId = process.env["APPLE_KEY_ID"] ?? "";
  if (!keyId) missing.push("APPLE_KEY_ID");

  const rawPrivateKey = process.env["APPLE_PRIVATE_KEY"] ?? "";
  // .env files store the PEM's newlines as the literal two-character
  // sequence \n; normalize back to real newlines before use.
  const privateKey = rawPrivateKey.replace(/\\n/g, "\n").trim();
  if (!privateKey) {
    missing.push("APPLE_PRIVATE_KEY");
  } else if (!privateKey.includes("BEGIN") || !privateKey.includes("PRIVATE KEY")) {
    throw new AppError({
      code: "AUTH_CONFIGURATION_ERROR",
      message: "APPLE_PRIVATE_KEY is not a valid PEM-encoded private key.",
      statusCode: 503,
    });
  }

  if (missing.length > 0) {
    throw new AppError({
      code: "AUTH_CONFIGURATION_ERROR",
      message: `Apple Sign In is not configured. Missing: ${missing.join(", ")}.`,
      statusCode: 503,
    });
  }

  return { allowedClientIds, teamId, keyId, privateKey };
}
