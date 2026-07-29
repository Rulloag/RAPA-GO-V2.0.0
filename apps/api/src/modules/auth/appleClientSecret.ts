import { SignJWT, importPKCS8 } from "jose";

import { AppError } from "../../shared/errors/AppError.js";
import {
  APPLE_ISSUER,
  getAppleAuthConfig,
} from "./appleAuth.config.js";

const CLIENT_SECRET_TTL_SECONDS = 5 * 60;

/**
 * Generates the short-lived JWT Apple expects as client_secret.
 * The private key and generated secret are never logged or persisted.
 */
export async function buildAppleClientSecret(
  clientId: string,
): Promise<string> {
  const config = getAppleAuthConfig();

  let privateKey: Awaited<ReturnType<typeof importPKCS8>>;
  try {
    privateKey = await importPKCS8(config.privateKey, "ES256");
  } catch {
    // Nunca se expone la clave ni el error crudo de `jose` (que puede citar
    // fragmentos del PEM); solo un AUTH_CONFIGURATION_ERROR controlado.
    throw new AppError({
      code: "AUTH_CONFIGURATION_ERROR",
      message: "APPLE_PRIVATE_KEY could not be imported as a PKCS8 EC key.",
      statusCode: 503,
    });
  }

  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: config.keyId })
    .setIssuer(config.teamId)
    .setAudience(APPLE_ISSUER)
    .setSubject(clientId)
    .setIssuedAt()
    .setExpirationTime(`${CLIENT_SECRET_TTL_SECONDS}s`)
    .sign(privateKey);
}
