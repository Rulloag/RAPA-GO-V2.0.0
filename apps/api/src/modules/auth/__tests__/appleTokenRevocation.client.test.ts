import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import { AppleTokenRevocationClient } from "../appleTokenRevocation.client.js";
import {
  createEcPrivateKeyPem,
  fakeFetch,
  TEST_CLIENT_ID,
  throwingFetch,
} from "./appleTestFixtures.js";

describe("AppleTokenRevocationClient", () => {
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    process.env["APPLE_ALLOWED_CLIENT_IDS"] = TEST_CLIENT_ID;
    process.env["APPLE_TEAM_ID"] = "TEAMID1234";
    process.env["APPLE_KEY_ID"] = "KEYID1234";
    const privateKeyPem = await createEcPrivateKeyPem();
    process.env["APPLE_PRIVATE_KEY"] =
      privateKeyPem.replace(/\n/g, "\\n");
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("revoca un refresh token válido", async () => {
    const client = new AppleTokenRevocationClient(
      fakeFetch(200, {}),
    );

    await expect(
      client.revokeRefreshToken(
        "apple-refresh-token",
        TEST_CLIENT_ID,
      ),
    ).resolves.toEqual({
      revoked: true,
      alreadyInvalid: false,
    });
  });

  it.each(["invalid_grant", "invalid_token"])(
    "trata %s como autorización ya inválida",
    async (error) => {
      const client = new AppleTokenRevocationClient(
        fakeFetch(400, { error }),
      );

      await expect(
        client.revokeRefreshToken(
          "apple-refresh-token",
          TEST_CLIENT_ID,
        ),
      ).resolves.toEqual({
        revoked: true,
        alreadyInvalid: true,
      });
    },
  );

  it("falla de forma reintentable cuando Apple no responde", async () => {
    const client = new AppleTokenRevocationClient(
      throwingFetch(),
    );

    await expect(
      client.revokeRefreshToken(
        "apple-refresh-token",
        TEST_CLIENT_ID,
      ),
    ).rejects.toMatchObject({
      code: "AUTH_APPLE_TOKEN_REVOCATION_UNAVAILABLE",
      statusCode: 503,
    });
  });

  it("no acepta una revocación rechazada por configuración o credenciales", async () => {
    const client = new AppleTokenRevocationClient(
      fakeFetch(400, { error: "invalid_client" }),
    );

    await expect(
      client.revokeRefreshToken(
        "apple-refresh-token",
        TEST_CLIENT_ID,
      ),
    ).rejects.toMatchObject({
      code: "AUTH_APPLE_TOKEN_REVOCATION_FAILED",
    });
  });
});
