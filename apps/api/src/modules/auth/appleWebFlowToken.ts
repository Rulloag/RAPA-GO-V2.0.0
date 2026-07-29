import { createHash, randomUUID } from "node:crypto";
import { EncryptJWT, jwtDecrypt, type JWTPayload } from "jose";

import { AppError } from "../../shared/errors/AppError.js";
import type { ApplePreparedWebIdentity } from "./appleWeb.types.js";

const TOKEN_ISSUER = "rapa-go-api";
const STATE_AUDIENCE = "rapa-go-apple-web-state";
const FLOW_AUDIENCE = "rapa-go-apple-web-flow";
const STATE_TTL_SECONDS = 10 * 60;
const FLOW_TTL_SECONDS = 30 * 60;

type AppleWebStatePayload = JWTPayload & {
  kind: "apple-web-state";
  nonce: string;
  clientId: string;
  csrf: string;
};

type AppleWebFlowPayload = JWTPayload & {
  kind: "apple-web-flow";
  prepared: ApplePreparedWebIdentity;
};

function getEncryptionKey(): Uint8Array {
  const secret = process.env["JWT_SECRET"]?.trim();

  if (!secret) {
    throw new AppError({
      code: "AUTH_CONFIGURATION_ERROR",
      message: "JWT_SECRET is required for Apple web authentication.",
      statusCode: 503,
    });
  }

  return createHash("sha256")
    .update(`rapa-go:apple-web:v1:${secret}`, "utf8")
    .digest();
}

async function encrypt(
  payload: JWTPayload,
  audience: string,
  ttlSeconds: number,
): Promise<string> {
  return new EncryptJWT(payload)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM", typ: "JWT" })
    .setIssuer(TOKEN_ISSUER)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .setJti(randomUUID())
    .encrypt(getEncryptionKey());
}

async function decrypt(
  token: string,
  audience: string,
): Promise<JWTPayload> {
  try {
    const result = await jwtDecrypt(token, getEncryptionKey(), {
      issuer: TOKEN_ISSUER,
      audience,
      keyManagementAlgorithms: ["dir"],
      contentEncryptionAlgorithms: ["A256GCM"],
    });

    return result.payload;
  } catch {
    throw new AppError({
      code: "AUTH_APPLE_WEB_FLOW_INVALID",
      message:
        "El ingreso web con Apple venció o no es válido. Inténtalo nuevamente.",
      statusCode: 401,
    });
  }
}

export async function createAppleWebStateToken(input: {
  nonce: string;
  clientId: string;
  csrf: string;
}): Promise<string> {
  return encrypt(
    {
      kind: "apple-web-state",
      nonce: input.nonce,
      clientId: input.clientId,
      csrf: input.csrf,
    } satisfies AppleWebStatePayload,
    STATE_AUDIENCE,
    STATE_TTL_SECONDS,
  );
}

export async function readAppleWebStateToken(
  token: string,
): Promise<{ nonce: string; clientId: string; csrf: string }> {
  const payload = await decrypt(token, STATE_AUDIENCE);

  if (
    payload["kind"] !== "apple-web-state" ||
    typeof payload["nonce"] !== "string" ||
    !/^[a-f0-9]{64}$/i.test(payload["nonce"]) ||
    typeof payload["clientId"] !== "string" ||
    payload["clientId"].length < 3 ||
    typeof payload["csrf"] !== "string" ||
    !/^[A-Za-z0-9_-]{32,128}$/.test(payload["csrf"])
  ) {
    throw new AppError({
      code: "AUTH_APPLE_WEB_STATE_INVALID",
      message: "El estado del ingreso con Apple no es válido.",
      statusCode: 401,
    });
  }

  return {
    nonce: payload["nonce"],
    clientId: payload["clientId"],
    csrf: payload["csrf"],
  };
}

export async function createAppleWebFlowToken(
  prepared: ApplePreparedWebIdentity,
): Promise<string> {
  return encrypt(
    {
      kind: "apple-web-flow",
      prepared,
    } satisfies AppleWebFlowPayload,
    FLOW_AUDIENCE,
    FLOW_TTL_SECONDS,
  );
}

export async function readAppleWebFlowToken(
  token: string,
): Promise<ApplePreparedWebIdentity> {
  const payload = await decrypt(token, FLOW_AUDIENCE);
  const prepared = payload["prepared"] as
    | Partial<ApplePreparedWebIdentity>
    | undefined;

  if (
    payload["kind"] !== "apple-web-flow" ||
    !prepared ||
    typeof prepared.sub !== "string" ||
    prepared.sub.length < 1 ||
    typeof prepared.aud !== "string" ||
    prepared.aud.length < 3 ||
    typeof prepared.emailVerified !== "boolean" ||
    typeof prepared.isPrivateEmail !== "boolean"
  ) {
    throw new AppError({
      code: "AUTH_APPLE_WEB_FLOW_INVALID",
      message: "El ingreso web con Apple no es válido.",
      statusCode: 401,
    });
  }

  return {
    sub: prepared.sub,
    aud: prepared.aud,
    ...(typeof prepared.email === "string"
      ? { email: prepared.email }
      : {}),
    emailVerified: prepared.emailVerified,
    isPrivateEmail: prepared.isPrivateEmail,
    ...(prepared.name ? { name: prepared.name } : {}),
    ...(typeof prepared.encryptedRefreshToken === "string"
      ? { encryptedRefreshToken: prepared.encryptedRefreshToken }
      : {}),
  };
}
