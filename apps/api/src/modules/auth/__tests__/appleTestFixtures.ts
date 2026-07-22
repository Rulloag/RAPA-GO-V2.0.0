import {
  exportJWK,
  exportPKCS8,
  generateKeyPair,
  SignJWT,
  type CryptoKey,
} from "jose";

export const TEST_CLIENT_ID = "cl.rapago.app";
export const TEST_ISSUER = "https://appleid.apple.com";

export async function createRsaSigningKey() {
  const { publicKey, privateKey } = await generateKeyPair("RS256", {
    extractable: true,
  });
  const kid = "apple-rsa-test-key";
  const jwk = await exportJWK(publicKey);
  return {
    privateKey,
    jwk: { ...jwk, kid, alg: "RS256", use: "sig" },
    kid,
  };
}

export async function createEcPrivateKeyPem(): Promise<string> {
  const { privateKey } = await generateKeyPair("ES256", {
    extractable: true,
  });
  return exportPKCS8(privateKey);
}

export async function signIdentityToken(
  privateKey: CryptoKey,
  kid: string,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    email: "apple.user@example.com",
    email_verified: true,
    is_private_email: false,
    ...overrides,
  })
    .setProtectedHeader({ alg: "RS256", kid })
    .setIssuer(TEST_ISSUER)
    .setAudience(TEST_CLIENT_ID)
    .setSubject("001234.rapago.apple.subject")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);
}

export function jsonFetch(status: number, body: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;
}
