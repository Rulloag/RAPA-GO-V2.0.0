import { createHash } from "node:crypto";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AppleIdentityTokenVerifier } from "../appleIdentityToken.verifier.js";
import { AppleTokenExchangeClient } from "../appleTokenExchange.client.js";
import { getAppleAuthConfig } from "../appleAuth.config.js";
import {
  TEST_CLIENT_ID,
  createEcPrivateKeyPem,
  createRsaSigningKey,
  jsonFetch,
  signIdentityToken,
} from "./appleTestFixtures.js";

const originalEnv = { ...process.env };
let rsa: Awaited<ReturnType<typeof createRsaSigningKey>>;
let ecPem = "";

beforeAll(async () => {
  rsa = await createRsaSigningKey();
  ecPem = await createEcPrivateKeyPem();
});

beforeEach(() => {
  process.env["APPLE_ALLOWED_CLIENT_IDS"] = TEST_CLIENT_ID;
  process.env["APPLE_TEAM_ID"] = "TEAMID1234";
  process.env["APPLE_KEY_ID"] = "KEYID1234";
  process.env["APPLE_PRIVATE_KEY"] = ecPem.replace(/\n/g, "\\n");
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("Sign in with Apple security", () => {
  it("loads a complete backend configuration", () => {
    expect(getAppleAuthConfig().allowedClientIds).toEqual([TEST_CLIENT_ID]);
  });

  it("fails closed when the private key is absent", () => {
    delete process.env["APPLE_PRIVATE_KEY"];
    expect(() => getAppleAuthConfig()).toThrowError(
      expect.objectContaining({ code: "AUTH_CONFIGURATION_ERROR" }),
    );
  });

  it("verifies a real Apple-style RS256 identity token", async () => {
    const token = await signIdentityToken(rsa.privateKey, rsa.kid);
    const verifier = new AppleIdentityTokenVerifier(
      jsonFetch(200, { keys: [rsa.jwk] }),
    );

    await expect(verifier.verify(token)).resolves.toMatchObject({
      sub: "001234.rapago.apple.subject",
      aud: TEST_CLIENT_ID,
      emailVerified: true,
    });
  });

  it("validates the SHA-256 nonce", async () => {
    const rawNonce = "a".repeat(64);
    const nonce = createHash("sha256").update(rawNonce).digest("hex");
    const token = await signIdentityToken(rsa.privateKey, rsa.kid, { nonce });
    const verifier = new AppleIdentityTokenVerifier(
      jsonFetch(200, { keys: [rsa.jwk] }),
    );

    await expect(
      verifier.verify(token, { expectedNonce: rawNonce }),
    ).resolves.toBeTruthy();
  });

  it("rejects a mismatched nonce", async () => {
    const token = await signIdentityToken(rsa.privateKey, rsa.kid, {
      nonce: "b".repeat(64),
    });
    const verifier = new AppleIdentityTokenVerifier(
      jsonFetch(200, { keys: [rsa.jwk] }),
    );

    await expect(
      verifier.verify(token, { expectedNonce: "a".repeat(64) }),
    ).rejects.toMatchObject({ code: "AUTH_APPLE_NONCE_MISMATCH" });
  });

  it("exchanges the authorization code without exposing secrets", async () => {
    const client = new AppleTokenExchangeClient(
      jsonFetch(200, {
        access_token: "test-access",
        refresh_token: "test-refresh",
        id_token: "test-id-token",
        expires_in: 3600,
      }),
    );

    await expect(
      client.exchange("one-time-code", TEST_CLIENT_ID),
    ).resolves.toMatchObject({
      accessToken: "test-access",
      refreshToken: "test-refresh",
    });
  });
});
