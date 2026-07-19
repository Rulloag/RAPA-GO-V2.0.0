import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SignJWT } from "jose";
import { AppleIdentityTokenVerifier } from "../appleIdentityToken.verifier.js";
import {
  generateAppleKeyPair,
  jwksResponse,
  fakeFetch,
  throwingFetch,
  signAppleToken,
  defaultClaims,
  TEST_CLIENT_ID,
} from "./appleTestFixtures.js";
import type { AppleTestKeyPair } from "./appleTestFixtures.js";

describe("AppleIdentityTokenVerifier", () => {
  let key: AppleTestKeyPair;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    key = await generateAppleKeyPair();
    process.env["APPLE_ALLOWED_CLIENT_IDS"] = TEST_CLIENT_ID;
    process.env["APPLE_TEAM_ID"] = "TEAMID1234";
    process.env["APPLE_KEY_ID"] = "KEYID1234";
    process.env["APPLE_PRIVATE_KEY"] = "-----BEGIN PRIVATE KEY-----\\nfake\\n-----END PRIVATE KEY-----";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("accepts a well-formed, correctly signed token (token válido)", async () => {
    const token = await signAppleToken(key.privateKey, { alg: "ES256", kid: key.kid }, defaultClaims());
    const verifier = new AppleIdentityTokenVerifier(fakeFetch(200, jwksResponse(key)));

    const claims = await verifier.verify(token);

    expect(claims.sub).toBe("001234.abcdef1234567890.1234");
    expect(claims.aud).toBe(TEST_CLIENT_ID);
    expect(claims.email).toBe("user@example.com");
    expect(claims.emailVerified).toBe(true);
    expect(claims.isPrivateEmail).toBe(false);
  });

  it("rejects a token signed with the wrong key (firma inválida)", async () => {
    const otherKey = await generateAppleKeyPair();
    // Sign with otherKey's private key, but publish otherKey's JWK under key's kid
    // so header.kid matches but the signature verification must fail.
    const forged = await signAppleToken(otherKey.privateKey, { alg: "ES256", kid: key.kid }, defaultClaims());
    const verifier = new AppleIdentityTokenVerifier(fakeFetch(200, jwksResponse(key)));

    await expect(verifier.verify(forged)).rejects.toMatchObject({ code: "AUTH_APPLE_TOKEN_INVALID" });
  });

  it("rejects a token whose algorithm is not ES256 (algoritmo distinto)", async () => {
    const secret = new TextEncoder().encode("not-a-real-hmac-secret-not-real-not-real");
    const hsToken = await new SignJWT(defaultClaims())
      .setProtectedHeader({ alg: "HS256" })
      .sign(secret);
    const verifier = new AppleIdentityTokenVerifier(fakeFetch(200, jwksResponse(key)));

    await expect(verifier.verify(hsToken)).rejects.toMatchObject({ code: "AUTH_APPLE_TOKEN_INVALID" });
  });

  it("rejects a token with the wrong issuer (issuer incorrecto)", async () => {
    const token = await signAppleToken(
      key.privateKey,
      { alg: "ES256", kid: key.kid },
      defaultClaims({ iss: "https://evil.example.com" }),
    );
    const verifier = new AppleIdentityTokenVerifier(fakeFetch(200, jwksResponse(key)));

    await expect(verifier.verify(token)).rejects.toMatchObject({ code: "AUTH_APPLE_TOKEN_INVALID" });
  });

  it("rejects a token whose audience is not in APPLE_ALLOWED_CLIENT_IDS (audience no permitido)", async () => {
    const token = await signAppleToken(
      key.privateKey,
      { alg: "ES256", kid: key.kid },
      defaultClaims({ aud: "com.attacker.app" }),
    );
    const verifier = new AppleIdentityTokenVerifier(fakeFetch(200, jwksResponse(key)));

    await expect(verifier.verify(token)).rejects.toMatchObject({ code: "AUTH_APPLE_TOKEN_INVALID" });
  });

  it("rejects an expired token (exp)", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await signAppleToken(
      key.privateKey,
      { alg: "ES256", kid: key.kid },
      defaultClaims({ iat: now - 7200, exp: now - 3600 }),
    );
    const verifier = new AppleIdentityTokenVerifier(fakeFetch(200, jwksResponse(key)));

    await expect(verifier.verify(token)).rejects.toMatchObject({ code: "AUTH_APPLE_TOKEN_INVALID" });
  });

  it("rejects a token with an empty sub (sub ausente)", async () => {
    const token = await signAppleToken(
      key.privateKey,
      { alg: "ES256", kid: key.kid },
      defaultClaims({ sub: "" }),
    );
    const verifier = new AppleIdentityTokenVerifier(fakeFetch(200, jwksResponse(key)));

    await expect(verifier.verify(token)).rejects.toMatchObject({ code: "AUTH_APPLE_TOKEN_INVALID" });
  });

  it("accepts when the nonce matches the expected raw nonce's SHA-256 hash (nonce correcto)", async () => {
    const { createHash } = await import("node:crypto");
    const rawNonce = "client-generated-nonce-abc123";
    const hashedNonce = createHash("sha256").update(rawNonce).digest("hex");
    const token = await signAppleToken(
      key.privateKey,
      { alg: "ES256", kid: key.kid },
      defaultClaims({ nonce: hashedNonce }),
    );
    const verifier = new AppleIdentityTokenVerifier(fakeFetch(200, jwksResponse(key)));

    const claims = await verifier.verify(token, { expectedNonce: rawNonce });
    expect(claims.sub).toBeTruthy();
  });

  it("rejects when the nonce does not match a malformed (non-hex) claim (nonce incorrecto)", async () => {
    const token = await signAppleToken(
      key.privateKey,
      { alg: "ES256", kid: key.kid },
      defaultClaims({ nonce: "some-hash-that-wont-match" }),
    );
    const verifier = new AppleIdentityTokenVerifier(fakeFetch(200, jwksResponse(key)));

    await expect(verifier.verify(token, { expectedNonce: "client-generated-nonce-abc123" }))
      .rejects.toMatchObject({ code: "AUTH_APPLE_NONCE_MISMATCH" });
  });

  it("rejects when the nonce claim is a well-formed but wrong 64-char hex digest (constant-time comparison path)", async () => {
    const wrongButWellFormedHash = "a".repeat(64);
    const token = await signAppleToken(
      key.privateKey,
      { alg: "ES256", kid: key.kid },
      defaultClaims({ nonce: wrongButWellFormedHash }),
    );
    const verifier = new AppleIdentityTokenVerifier(fakeFetch(200, jwksResponse(key)));

    await expect(verifier.verify(token, { expectedNonce: "client-generated-nonce-abc123" }))
      .rejects.toMatchObject({ code: "AUTH_APPLE_NONCE_MISMATCH" });
  });

  it("rejects a token with no nonce claim at all when the request expects one", async () => {
    const token = await signAppleToken(key.privateKey, { alg: "ES256", kid: key.kid }, defaultClaims());
    const verifier = new AppleIdentityTokenVerifier(fakeFetch(200, jwksResponse(key)));

    await expect(verifier.verify(token, { expectedNonce: "client-generated-nonce-abc123" }))
      .rejects.toMatchObject({ code: "AUTH_APPLE_NONCE_MISMATCH" });
  });

  it("selects the correct key by kid from a JWKS containing multiple keys (múltiples claves)", async () => {
    const decoyKey = await generateAppleKeyPair();
    const token = await signAppleToken(key.privateKey, { alg: "ES256", kid: key.kid }, defaultClaims());
    const verifier = new AppleIdentityTokenVerifier(fakeFetch(200, jwksResponse(decoyKey, key)));

    const claims = await verifier.verify(token);
    expect(claims.sub).toBeTruthy();
  });

  it("rejects a token referencing an unknown kid (kid desconocido)", async () => {
    const token = await signAppleToken(key.privateKey, { alg: "ES256", kid: "kid-not-in-jwks" }, defaultClaims());
    const verifier = new AppleIdentityTokenVerifier(fakeFetch(200, jwksResponse(key)));

    await expect(verifier.verify(token)).rejects.toMatchObject({ code: "AUTH_APPLE_TOKEN_INVALID" });
  });

  it("fails closed when the JWKS endpoint cannot be reached (fallo al obtener JWKS)", async () => {
    const token = await signAppleToken(key.privateKey, { alg: "ES256", kid: key.kid }, defaultClaims());
    const verifier = new AppleIdentityTokenVerifier(throwingFetch());

    await expect(verifier.verify(token)).rejects.toMatchObject({ code: "AUTH_APPLE_JWKS_UNAVAILABLE" });
  });

  it("fails closed when the JWKS endpoint returns a non-OK status", async () => {
    const token = await signAppleToken(key.privateKey, { alg: "ES256", kid: key.kid }, defaultClaims());
    const verifier = new AppleIdentityTokenVerifier(fakeFetch(500, { error: "internal" }));

    await expect(verifier.verify(token)).rejects.toMatchObject({ code: "AUTH_APPLE_JWKS_UNAVAILABLE" });
  });

  it("treats email_verified/is_private_email string booleans as real booleans (private relay email)", async () => {
    const token = await signAppleToken(
      key.privateKey,
      { alg: "ES256", kid: key.kid },
      defaultClaims({
        email: "abc123@privaterelay.appleid.com",
        email_verified: "true",
        is_private_email: "true",
      }),
    );
    const verifier = new AppleIdentityTokenVerifier(fakeFetch(200, jwksResponse(key)));

    const claims = await verifier.verify(token);
    expect(claims.email).toBe("abc123@privaterelay.appleid.com");
    expect(claims.emailVerified).toBe(true);
    expect(claims.isPrivateEmail).toBe(true);
  });

  it("throws AUTH_CONFIGURATION_ERROR when Apple config is incomplete (configuración incompleta)", async () => {
    delete process.env["APPLE_ALLOWED_CLIENT_IDS"];
    const token = await signAppleToken(key.privateKey, { alg: "ES256", kid: key.kid }, defaultClaims());
    const verifier = new AppleIdentityTokenVerifier(fakeFetch(200, jwksResponse(key)));

    await expect(verifier.verify(token)).rejects.toMatchObject({ code: "AUTH_CONFIGURATION_ERROR" });
  });
});
