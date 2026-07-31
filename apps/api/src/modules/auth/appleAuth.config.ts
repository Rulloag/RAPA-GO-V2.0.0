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

  const rawClientIds =
    process.env["APPLE_ALLOWED_CLIENT_IDS"] ?? "";

  const allowedClientIds = rawClientIds
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (allowedClientIds.length === 0) {
    missing.push("APPLE_ALLOWED_CLIENT_IDS");
  }

  const teamId = process.env["APPLE_TEAM_ID"] ?? "";
  if (!teamId) {
    missing.push("APPLE_TEAM_ID");
  }

  const keyId = process.env["APPLE_KEY_ID"] ?? "";
  if (!keyId) {
    missing.push("APPLE_KEY_ID");
  }

  const rawPrivateKey =
    process.env["APPLE_PRIVATE_KEY"] ?? "";

  /*
   * Hostinger puede entregar el PEM con uno o varios niveles de escape:
   *
   *   \n
   *   \\n
   *   \\\n
   *
   * Normalizamos todos esos separadores, quitamos caracteres invisibles
   * y reconstruimos un PEM PKCS8 canónico antes de llamar importPKCS8.
   */
  const unquotedPrivateKey = rawPrivateKey
    .trim()
    .replace(/^["']|["']$/g, "");

  const newlineNormalizedPrivateKey =
    unquotedPrivateKey
      .replace(/\\+r\\+n/g, "\n")
      .replace(/\\+n/g, "\n")
      .replace(/\r\n?/g, "\n")
      .trim();

  const pemMatch = newlineNormalizedPrivateKey.match(
    /-----BEGIN PRIVATE KEY-----([\s\S]*?)-----END PRIVATE KEY-----/,
  );

  let privateKey = newlineNormalizedPrivateKey;
  let canonicalBodyLength = 0;

  if (pemMatch) {
    const canonicalBody = (pemMatch[1] ?? "")
      .replace(
        /[\s\uFEFF\u200B\u200C\u200D\u2060]/g,
        "",
      );

    canonicalBodyLength = canonicalBody.length;

    if (
      !canonicalBody ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(canonicalBody)
    ) {
      throw new AppError({
        code: "AUTH_CONFIGURATION_ERROR",
        message:
          "APPLE_PRIVATE_KEY contains invalid characters after normalization.",
        statusCode: 503,
      });
    }

    const canonicalLines =
      canonicalBody.match(/.{1,64}/g) ?? [];

    privateKey = [
      "-----BEGIN PRIVATE KEY-----",
      ...canonicalLines,
      "-----END PRIVATE KEY-----",
    ].join("\n");
  }

  console.log(
    "[Apple][config] APPLE_PRIVATE_KEY diagnóstico V49 (sin exponer la clave)",
    {
      rawLength: rawPrivateKey.length,
      rawHasLiteralBackslashN:
        rawPrivateKey.includes("\\n"),
      rawEscapedNewlineCount:
        rawPrivateKey.match(/\\+n/g)?.length ?? 0,
      rawHasRepeatedEscaping:
        /\\\\n/.test(rawPrivateKey),
      rawHasRealNewline:
        rawPrivateKey.includes("\n"),
      rawHasCarriageReturn:
        rawPrivateKey.includes("\r"),
      rawStartsWithQuote:
        /^["']/.test(rawPrivateKey.trim()),
      rawEndsWithQuote:
        /["']$/.test(rawPrivateKey.trim()),
      rawHasBegin:
        rawPrivateKey.includes("BEGIN PRIVATE KEY"),
      rawHasEnd:
        rawPrivateKey.includes("END PRIVATE KEY"),
      normalizedLength: privateKey.length,
      canonicalBodyLength,
      normalizedHasLiteralBackslashN:
        privateKey.includes("\\n"),
      normalizedHasRealNewline:
        privateKey.includes("\n"),
      normalizedLineCount:
        privateKey.split("\n").length,
      normalizedHasBegin:
        privateKey.includes(
          "-----BEGIN PRIVATE KEY-----",
        ),
      normalizedHasEnd:
        privateKey.includes(
          "-----END PRIVATE KEY-----",
        ),
    },
  );

  if (!privateKey) {
    missing.push("APPLE_PRIVATE_KEY");
  } else if (
    !privateKey.includes(
      "-----BEGIN PRIVATE KEY-----",
    ) ||
    !privateKey.includes(
      "-----END PRIVATE KEY-----",
    )
  ) {
    throw new AppError({
      code: "AUTH_CONFIGURATION_ERROR",
      message:
        "APPLE_PRIVATE_KEY is not a valid PEM-encoded private key.",
      statusCode: 503,
    });
  }

  if (missing.length > 0) {
    throw new AppError({
      code: "AUTH_CONFIGURATION_ERROR",
      message:
        `Apple Sign In is not configured. Missing: ${missing.join(", ")}.`,
      statusCode: 503,
    });
  }

  return {
    allowedClientIds,
    teamId,
    keyId,
    privateKey,
  };
}
