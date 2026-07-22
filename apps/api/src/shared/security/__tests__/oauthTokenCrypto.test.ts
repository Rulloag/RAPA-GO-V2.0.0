import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { randomBytes } from "node:crypto";
import { OAuthTokenCrypto } from "../oauthTokenCrypto.js";

describe("OAuthTokenCrypto", () => {
  const originalEnv = { ...process.env };
  const validKey = randomBytes(32).toString("hex");

  beforeEach(() => {
    process.env["OAUTH_TOKEN_ENCRYPTION_KEY"] = validKey;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("round-trips a plaintext value through encrypt/decrypt", () => {
    const plaintext = "apple-refresh-token-value-super-secret";
    const encrypted = OAuthTokenCrypto.encrypt(plaintext);
    expect(OAuthTokenCrypto.decrypt(encrypted)).toBe(plaintext);
  });

  it("never stores the refresh token in plaintext — ciphertext does not contain the original value", () => {
    const plaintext = "apple-refresh-token-value-super-secret";
    const encrypted = OAuthTokenCrypto.encrypt(plaintext);
    expect(encrypted).not.toContain(plaintext);
  });

  it("produces a different ciphertext each time (random IV, not deterministic)", () => {
    const plaintext = "same-value-twice";
    const a = OAuthTokenCrypto.encrypt(plaintext);
    const b = OAuthTokenCrypto.encrypt(plaintext);
    expect(a).not.toBe(b);
    expect(OAuthTokenCrypto.decrypt(a)).toBe(plaintext);
    expect(OAuthTokenCrypto.decrypt(b)).toBe(plaintext);
  });

  it("fails closed on encrypt when OAUTH_TOKEN_ENCRYPTION_KEY is missing", () => {
    delete process.env["OAUTH_TOKEN_ENCRYPTION_KEY"];
    expect(() => OAuthTokenCrypto.encrypt("value")).toThrowError(
      expect.objectContaining({ code: "AUTH_CONFIGURATION_ERROR" }),
    );
  });

  it("fails closed on encrypt when OAUTH_TOKEN_ENCRYPTION_KEY has the wrong length", () => {
    process.env["OAUTH_TOKEN_ENCRYPTION_KEY"] = "deadbeef";
    expect(() => OAuthTokenCrypto.encrypt("value")).toThrowError(
      expect.objectContaining({ code: "AUTH_CONFIGURATION_ERROR" }),
    );
  });

  it("fails closed on encrypt when OAUTH_TOKEN_ENCRYPTION_KEY is not valid hex", () => {
    process.env["OAUTH_TOKEN_ENCRYPTION_KEY"] = "z".repeat(64);
    expect(() => OAuthTokenCrypto.encrypt("value")).toThrowError(
      expect.objectContaining({ code: "AUTH_CONFIGURATION_ERROR" }),
    );
  });

  it("rejects a tampered ciphertext at decrypt time (GCM auth tag mismatch)", () => {
    const encrypted = OAuthTokenCrypto.encrypt("value");
    const parts = encrypted.split(":");
    const tampered = [parts[0], `${(parts[1] as string).slice(0, -2)}ff`, parts[2]].join(":");
    expect(() => OAuthTokenCrypto.decrypt(tampered)).toThrow();
  });

  it("rejects a malformed payload at decrypt time", () => {
    expect(() => OAuthTokenCrypto.decrypt("not-a-valid-payload")).toThrow();
  });
});
