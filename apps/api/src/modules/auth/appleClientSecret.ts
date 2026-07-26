import { SignJWT, importPKCS8 } from "jose";

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
