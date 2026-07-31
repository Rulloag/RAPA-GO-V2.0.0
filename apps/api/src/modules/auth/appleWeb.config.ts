import { AppError } from "../../shared/errors/AppError.js";
import { getAppleAuthConfig } from "./appleAuth.config.js";

export const APPLE_AUTHORIZE_URL =
  "https://appleid.apple.com/auth/authorize";

export interface AppleWebAuthConfig {
  clientId: string;
  redirectUri: string;
  frontendUrl: string;
}

function readRequiredUrl(
  name: string,
  options: { httpsOnlyInProduction: boolean; originOnly?: boolean },
): string {
  const raw = process.env[name]?.trim();

  if (!raw) {
    throw new AppError({
      code: "AUTH_CONFIGURATION_ERROR",
      message: `${name} is not configured.`,
      statusCode: 503,
    });
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new AppError({
      code: "AUTH_CONFIGURATION_ERROR",
      message: `${name} is not a valid URL.`,
      statusCode: 503,
    });
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new AppError({
      code: "AUTH_CONFIGURATION_ERROR",
      message: `${name} must use HTTP or HTTPS.`,
      statusCode: 503,
    });
  }

  if (
    options.httpsOnlyInProduction &&
    process.env["NODE_ENV"] === "production" &&
    parsed.protocol !== "https:"
  ) {
    throw new AppError({
      code: "AUTH_CONFIGURATION_ERROR",
      message: `${name} must use HTTPS in production.`,
      statusCode: 503,
    });
  }

  if (options.originOnly) {
    return parsed.origin;
  }

  parsed.hash = "";
  return parsed.toString();
}

export function getAppleWebAuthConfig(): AppleWebAuthConfig {
  const appleConfig = getAppleAuthConfig();
  const clientId = process.env["APPLE_WEB_CLIENT_ID"]?.trim() ?? "";

  if (!clientId) {
    throw new AppError({
      code: "AUTH_CONFIGURATION_ERROR",
      message: "APPLE_WEB_CLIENT_ID is not configured.",
      statusCode: 503,
    });
  }

  if (!appleConfig.allowedClientIds.includes(clientId)) {
    throw new AppError({
      code: "AUTH_CONFIGURATION_ERROR",
      message:
        "APPLE_WEB_CLIENT_ID must also be present in APPLE_ALLOWED_CLIENT_IDS.",
      statusCode: 503,
    });
  }

  return {
    clientId,
    redirectUri: readRequiredUrl("APPLE_WEB_REDIRECT_URI", {
      httpsOnlyInProduction: true,
    }),
    frontendUrl: readRequiredUrl("APPLE_WEB_FRONTEND_URL", {
      httpsOnlyInProduction: true,
      originOnly: true,
    }),
  };
}
