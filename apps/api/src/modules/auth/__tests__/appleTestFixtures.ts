import { generateKeyPair, exportJWK, exportPKCS8, SignJWT } from "jose";
import type { CryptoKey } from "jose";


export const TEST_APPLE_ISSUER = "https://appleid.apple.com";
export const TEST_CLIENT_ID = "cl.rapago.app";

export interface AppleTestKeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  kid: string;
  jwk: Record<string, unknown>;
  pkcs8: string;
}

let counter = 0;

export async function generateAppleKeyPair(): Promise<AppleTestKeyPair> {
  counter += 1;
  const kid = `test-key-${counter}`;
  const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
  const jwk = await exportJWK(publicKey);
  jwk["kid"] = kid;
  jwk["alg"] = "RS256";
  jwk["use"] = "sig";
  const pkcs8 = await exportPKCS8(privateKey);
  return { publicKey, privateKey, kid, jwk: jwk as Record<string, unknown>, pkcs8 };
}

export function jwksResponse(...keys: AppleTestKeyPair[]): { keys: Array<Record<string, unknown>> } {
  return { keys: keys.map((k) => k.jwk) };
}

export function fakeFetch(status: number, body: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;
}

export function throwingFetch(): typeof fetch {
  return (async () => {
    throw new Error("network unreachable");
  }) as unknown as typeof fetch;
}

/** Simulates AbortSignal.timeout firing — same `.name === "TimeoutError"`
 * shape Node/undici produces, distinct from a generic network failure
 * (throwingFetch). Built from a plain Error (not the DOM-lib-only
 * DOMException type) since this project's tsconfig has no "dom" lib. */
export function timingOutFetch(): typeof fetch {
  return (async () => {
    const error = new Error("The operation was aborted due to timeout");
    error.name = "TimeoutError";
    throw error;
  }) as unknown as typeof fetch;
}

/** Full control over header/payload — used to build both valid and deliberately malformed Apple-style identity tokens. */
export async function signAppleToken(
  privateKey: CryptoKey,
  header: { alg: string; kid?: string },
  payload: Record<string, unknown>,
): Promise<string> {
  return new SignJWT(payload).setProtectedHeader(header).sign(privateKey);
}

export function defaultClaims(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const now = Math.floor(Date.now() / 1000);
  return {
    iss: TEST_APPLE_ISSUER,
    aud: TEST_CLIENT_ID,
    sub: "001234.abcdef1234567890.1234",
    iat: now,
    exp: now + 3600,
    email: "user@example.com",
    email_verified: true,
    is_private_email: false,
    ...overrides,
  };
}

/**
 * Helpers used by the end-to-end Apple security test.
 * Apple signs identity tokens with RS256, while the RAPA GO client secret
 * is signed with an ES256 private key.
 */
export async function createRsaSigningKey(): Promise<{
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  kid: string;
  jwk: Record<string, unknown>;
}> {
  const { publicKey, privateKey } = await generateKeyPair("RS256", {
    extractable: true,
  });
  const kid = `apple-rsa-test-${Date.now()}`;
  const jwk = await exportJWK(publicKey);
  jwk["kid"] = kid;
  jwk["alg"] = "RS256";
  jwk["use"] = "sig";

  return {
    publicKey,
    privateKey,
    kid,
    jwk: jwk as Record<string, unknown>,
  };
}

export async function createEcPrivateKeyPem(): Promise<string> {
  const { privateKey } = await generateKeyPair("ES256", {
    extractable: true,
  });
  return exportPKCS8(privateKey);
}

export function jsonFetch(status: number, body: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;
}

export async function signIdentityToken(
  privateKey: CryptoKey,
  kid: string,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  return new SignJWT({
    ...defaultClaims({
      sub: "001234.rapago.apple.subject",
      ...overrides,
    }),
  })
    .setProtectedHeader({ alg: "RS256", kid })
    .sign(privateKey);
}
