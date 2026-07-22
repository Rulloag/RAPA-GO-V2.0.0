import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AppleTokenExchangeClient } from "../appleTokenExchange.client.js";
import { fakeFetch, throwingFetch, generateAppleKeyPair, TEST_CLIENT_ID } from "./appleTestFixtures.js";

describe("AppleTokenExchangeClient", () => {
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    process.env["APPLE_ALLOWED_CLIENT_IDS"] = TEST_CLIENT_ID;
    process.env["APPLE_TEAM_ID"] = "TEAMID1234";
    process.env["APPLE_KEY_ID"] = "KEYID1234";
    // A real, freshly generated EC PKCS8 PEM (test-only key pair, never a
    // real Apple credential) — the client needs a key jose can actually
    // import and sign a client_secret JWT with.
    const key = await generateAppleKeyPair();
    process.env["APPLE_PRIVATE_KEY"] = key.pkcs8.replace(/\n/g, "\\n");
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns access/refresh/id tokens on a successful exchange", async () => {
    const client = new AppleTokenExchangeClient(fakeFetch(200, {
      access_token: "apple-access-token",
      refresh_token: "apple-refresh-token",
      id_token: "apple-id-token",
      expires_in: 3600,
    }));

    const result = await client.exchange("valid-authorization-code", TEST_CLIENT_ID);

    expect(result.accessToken).toBe("apple-access-token");
    expect(result.refreshToken).toBe("apple-refresh-token");
    expect(result.idToken).toBe("apple-id-token");
    expect(result.expiresIn).toBe(3600);
  });

  it("rejects an invalid authorizationCode (Apple returns non-OK)", async () => {
    const client = new AppleTokenExchangeClient(fakeFetch(400, { error: "invalid_grant" }));

    await expect(client.exchange("bad-code", TEST_CLIENT_ID))
      .rejects.toMatchObject({ code: "AUTH_APPLE_TOKEN_EXCHANGE_FAILED" });
  });

  it("fails closed when Apple's token endpoint is unreachable", async () => {
    const client = new AppleTokenExchangeClient(throwingFetch());

    await expect(client.exchange("any-code", TEST_CLIENT_ID))
      .rejects.toMatchObject({ code: "AUTH_APPLE_TOKEN_EXCHANGE_FAILED" });
  });

  it("fails closed when Apple's response is missing required fields", async () => {
    const client = new AppleTokenExchangeClient(fakeFetch(200, { expires_in: 3600 }));

    await expect(client.exchange("valid-code", TEST_CLIENT_ID))
      .rejects.toMatchObject({ code: "AUTH_APPLE_TOKEN_EXCHANGE_FAILED" });
  });

  it("fails closed when Apple configuration is incomplete", async () => {
    delete process.env["APPLE_TEAM_ID"];
    const client = new AppleTokenExchangeClient(fakeFetch(200, {
      access_token: "x", id_token: "y",
    }));

    await expect(client.exchange("valid-code", TEST_CLIENT_ID))
      .rejects.toMatchObject({ code: "AUTH_CONFIGURATION_ERROR" });
  });

  it("never logs the authorizationCode, client_secret, or returned tokens", async () => {
    const logSpy  = vi.spyOn(console, "log").mockImplementation(() => {});
    const errSpy  = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const client = new AppleTokenExchangeClient(fakeFetch(200, {
      access_token: "super-secret-access-token",
      refresh_token: "super-secret-refresh-token",
      id_token: "super-secret-id-token",
      expires_in: 3600,
    }));

    await client.exchange("super-secret-authorization-code", TEST_CLIENT_ID);

    const allLoggedText = [...logSpy.mock.calls, ...errSpy.mock.calls, ...warnSpy.mock.calls]
      .flat()
      .map((v) => (typeof v === "string" ? v : JSON.stringify(v)))
      .join(" ");

    expect(allLoggedText).not.toContain("super-secret-access-token");
    expect(allLoggedText).not.toContain("super-secret-refresh-token");
    expect(allLoggedText).not.toContain("super-secret-id-token");
    expect(allLoggedText).not.toContain("super-secret-authorization-code");

    logSpy.mockRestore();
    errSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
