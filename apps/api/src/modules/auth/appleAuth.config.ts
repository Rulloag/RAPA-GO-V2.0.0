import { AppError } from "../../shared/errors/AppError.js";

export const APPLE_ISSUER = "https://appleid.apple.com";
export const APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys";
export const APPLE_TOKEN_URL = "https://appleid.apple.com/auth/token";
export const APPLE_REVOKE_URL = "https://appleid.apple.com/auth/revoke";

export interface AppleAuthConfig {
  allowedClientIds: string[];
  teamId: string;
  keyId: string;
  privateKey: string;
}

export function getAppleAuthConfig(): AppleAuthConfig {
  const missing: string[] = [];
  const allowedClientIds = (process.env["APPLE_ALLOWED_CLIENT_IDS"] ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (allowedClientIds.length === 0) missing.push("APPLE_ALLOWED_CLIENT_IDS");

  const teamId = process.env["APPLE_TEAM_ID"]?.trim() ?? "";
  if (!teamId) missing.push("APPLE_TEAM_ID");

  const keyId = process.env["APPLE_KEY_ID"]?.trim() ?? "";
  if (!keyId) missing.push("APPLE_KEY_ID");

  const privateKey = (process.env["APPLE_PRIVATE_KEY"] ?? "")
    .replace(/\\n/g, "\n")
    .trim();
  if (!privateKey) {
    missing.push("APPLE_PRIVATE_KEY");
  } else if (
    !privateKey.includes("BEGIN PRIVATE KEY") ||
    !privateKey.includes("END PRIVATE KEY")
  ) {
    throw new AppError({
      code: "AUTH_CONFIGURATION_ERROR",
      message: "APPLE_PRIVATE_KEY no contiene una clave privada PKCS#8 válida.",
      statusCode: 503,
    });
  }

  if (missing.length > 0) {
    throw new AppError({
      code: "AUTH_CONFIGURATION_ERROR",
      message: `Sign in with Apple no está configurado. Faltan: ${missing.join(", ")}.`,
      statusCode: 503,
    });
  }

  return { allowedClientIds, teamId, keyId, privateKey };
}
