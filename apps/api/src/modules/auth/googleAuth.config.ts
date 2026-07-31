import { AppError } from "../../shared/errors/AppError.js";

export const GOOGLE_ISSUERS = [
  "https://accounts.google.com",
  "accounts.google.com",
] as const;
export const GOOGLE_JWKS_URL =
  "https://www.googleapis.com/oauth2/v3/certs";

export interface GoogleAuthConfig {
  allowedClientIds: string[];
}

export function getGoogleAuthConfig(): GoogleAuthConfig {
  const rawAllowed = String(
    process.env["GOOGLE_ALLOWED_CLIENT_IDS"] ??
      process.env["GOOGLE_WEB_CLIENT_ID"] ??
      "",
  );
  const allowedClientIds = [...new Set(
    rawAllowed
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  )];

  if (allowedClientIds.length === 0) {
    throw new AppError({
      code: "AUTH_CONFIGURATION_ERROR",
      message:
        "Google Sign-In is not configured. Missing GOOGLE_ALLOWED_CLIENT_IDS.",
      statusCode: 503,
    });
  }

  for (const clientId of allowedClientIds) {
    if (!clientId.endsWith(".apps.googleusercontent.com")) {
      throw new AppError({
        code: "AUTH_CONFIGURATION_ERROR",
        message: "GOOGLE_ALLOWED_CLIENT_IDS contains an invalid client ID.",
        statusCode: 503,
      });
    }
  }

  return { allowedClientIds };
}
