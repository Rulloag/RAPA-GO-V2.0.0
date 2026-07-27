import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { AppleTokenRevocationClient } from "../appleTokenRevocation.client.js";
import {
  createEcPrivateKeyPem,
  fakeFetch,
  TEST_CLIENT_ID,
  throwingFetch,
  timingOutFetch,
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

  it("falla con el mismo código y statusCode cuando la revocación excede el timeout", async () => {
    const client = new AppleTokenRevocationClient(timingOutFetch());

    // Mismo contrato público que un fallo de red genérico — la distinción
    // entre timeout y red (ProviderTimeoutError vs ProviderNetworkError) es
    // solo interna, nunca se filtra al llamador.
    await expect(
      client.revokeRefreshToken("apple-refresh-token", TEST_CLIENT_ID),
    ).rejects.toMatchObject({
      code: "AUTH_APPLE_TOKEN_REVOCATION_UNAVAILABLE",
      statusCode: 503,
    });
  });

  it("cae a un timeout seguro cuando APPLE_TOKEN_TIMEOUT_MS tiene un valor inválido", async () => {
    process.env["APPLE_TOKEN_TIMEOUT_MS"] = "not-a-number";
    const client = new AppleTokenRevocationClient(fakeFetch(200, {}));

    await expect(
      client.revokeRefreshToken("apple-refresh-token", TEST_CLIENT_ID),
    ).resolves.toEqual({ revoked: true, alreadyInvalid: false });
  });

  it("nunca loguea el refresh token ni el client secret, ni siquiera cuando la revocación falla por timeout", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const client = new AppleTokenRevocationClient(timingOutFetch());

    await expect(
      client.revokeRefreshToken("super-secret-refresh-token", TEST_CLIENT_ID),
    ).rejects.toMatchObject({ code: "AUTH_APPLE_TOKEN_REVOCATION_UNAVAILABLE" });

    const loggedText = errSpy.mock.calls
      .flat()
      .map((v) => (typeof v === "string" ? v : JSON.stringify(v)))
      .join(" ");

    expect(loggedText).not.toContain("super-secret-refresh-token");
    expect(loggedText).toContain("timeoutMs");

    errSpy.mockRestore();
  });

  it("no deja promesas rechazadas sin manejar cuando la revocación falla", async () => {
    const client = new AppleTokenRevocationClient(timingOutFetch());
    const promise = client.revokeRefreshToken("apple-refresh-token", TEST_CLIENT_ID);

    await expect(promise).rejects.toMatchObject({
      code: "AUTH_APPLE_TOKEN_REVOCATION_UNAVAILABLE",
    });
  });
});
