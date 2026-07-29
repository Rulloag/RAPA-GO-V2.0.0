import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { buildAppleClientSecret } from "../appleClientSecret.js";
import { AppError } from "../../../shared/errors/AppError.js";

function generateEcPkcs8Pem(): string {
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  return privateKey.export({ type: "pkcs8", format: "pem" }).toString();
}

function toHostingerFormat(pem: string): string {
  return `"${pem.trim().replace(/\n/g, "\\n")}"`;
}

describe("buildAppleClientSecret", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env["APPLE_ALLOWED_CLIENT_IDS"] = "cl.rapago.app";
    process.env["APPLE_TEAM_ID"] = "TEAMID1234";
    process.env["APPLE_KEY_ID"] = "KEYID1234";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("signs a valid client_secret JWT from a real EC key in Hostinger's single-line quoted \\n format", async () => {
    process.env["APPLE_PRIVATE_KEY"] = toHostingerFormat(generateEcPkcs8Pem());

    const jwt = await buildAppleClientSecret("cl.rapago.app");

    expect(typeof jwt).toBe("string");
    expect(jwt.split(".")).toHaveLength(3);
  });

  it("fails closed with a controlled AUTH_CONFIGURATION_ERROR — never the raw jose/import error — when the PEM shape is right but the key content is not valid PKCS8", async () => {
    process.env["APPLE_PRIVATE_KEY"] =
      "-----BEGIN PRIVATE KEY-----\\nAAAAAAAAAAAAAAAAAAAAAAAAAAAA\\n-----END PRIVATE KEY-----";

    await expect(buildAppleClientSecret("cl.rapago.app")).rejects.toMatchObject(
      expect.objectContaining({
        code: "AUTH_CONFIGURATION_ERROR",
        statusCode: 503,
      }),
    );
  });

  it("never leaks the private key material in the thrown error", async () => {
    const badKey =
      "-----BEGIN PRIVATE KEY-----\\nAAAAAAAAAAAAAAAAAAAAAAAAAAAA\\n-----END PRIVATE KEY-----";
    process.env["APPLE_PRIVATE_KEY"] = badKey;

    try {
      await buildAppleClientSecret("cl.rapago.app");
      throw new Error("expected buildAppleClientSecret to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      const serialized = JSON.stringify(error);
      expect(serialized).not.toContain("AAAAAAAAAAAAAAAAAAAAAAAAAAAA");
    }
  });
});
