import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getAppleAuthConfig } from "../appleAuth.config.js";

describe("getAppleAuthConfig", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env["APPLE_ALLOWED_CLIENT_IDS"] = "cl.rapago.app,cl.rapago.web";
    process.env["APPLE_TEAM_ID"] = "TEAMID1234";
    process.env["APPLE_KEY_ID"] = "KEYID1234";
    process.env["APPLE_PRIVATE_KEY"] = "-----BEGIN PRIVATE KEY-----\\nabc123\\n-----END PRIVATE KEY-----";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("parses a valid configuration, splitting the comma-separated client id list", () => {
    const config = getAppleAuthConfig();
    expect(config.allowedClientIds).toEqual(["cl.rapago.app", "cl.rapago.web"]);
    expect(config.teamId).toBe("TEAMID1234");
    expect(config.keyId).toBe("KEYID1234");
    expect(config.privateKey).toContain("BEGIN PRIVATE KEY");
  });

  it("normalizes escaped \\n sequences in APPLE_PRIVATE_KEY into real newlines", () => {
    const config = getAppleAuthConfig();
    expect(config.privateKey).toContain("\n");
    expect(config.privateKey).not.toContain("\\n");
  });

  it("fails closed when APPLE_ALLOWED_CLIENT_IDS is missing", () => {
    delete process.env["APPLE_ALLOWED_CLIENT_IDS"];
    expect(() => getAppleAuthConfig()).toThrowError(expect.objectContaining({ code: "AUTH_CONFIGURATION_ERROR" }));
  });

  it("fails closed when APPLE_ALLOWED_CLIENT_IDS is only whitespace/commas", () => {
    process.env["APPLE_ALLOWED_CLIENT_IDS"] = " , , ";
    expect(() => getAppleAuthConfig()).toThrowError(expect.objectContaining({ code: "AUTH_CONFIGURATION_ERROR" }));
  });

  it("fails closed when APPLE_TEAM_ID is missing", () => {
    delete process.env["APPLE_TEAM_ID"];
    expect(() => getAppleAuthConfig()).toThrowError(expect.objectContaining({ code: "AUTH_CONFIGURATION_ERROR" }));
  });

  it("fails closed when APPLE_KEY_ID is missing", () => {
    delete process.env["APPLE_KEY_ID"];
    expect(() => getAppleAuthConfig()).toThrowError(expect.objectContaining({ code: "AUTH_CONFIGURATION_ERROR" }));
  });

  it("fails closed when APPLE_PRIVATE_KEY is missing", () => {
    delete process.env["APPLE_PRIVATE_KEY"];
    expect(() => getAppleAuthConfig()).toThrowError(expect.objectContaining({ code: "AUTH_CONFIGURATION_ERROR" }));
  });

  it("fails closed when APPLE_PRIVATE_KEY is not a PEM-looking value", () => {
    process.env["APPLE_PRIVATE_KEY"] = "not-a-pem-key-at-all";
    expect(() => getAppleAuthConfig()).toThrowError(expect.objectContaining({ code: "AUTH_CONFIGURATION_ERROR" }));
  });

  it("parses the exact Hostinger format: single line, wrapped in double quotes, literal \\n sequences", () => {
    process.env["APPLE_PRIVATE_KEY"] =
      '"-----BEGIN PRIVATE KEY-----\\nMIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgV\\nV-----END PRIVATE KEY-----"';

    const config = getAppleAuthConfig();

    expect(config.privateKey.startsWith("-----BEGIN PRIVATE KEY-----")).toBe(true);
    expect(config.privateKey.endsWith("-----END PRIVATE KEY-----")).toBe(true);
    expect(config.privateKey).not.toContain('"');
    expect(config.privateKey).not.toContain("\\n");
    expect(config.privateKey).toContain("\n");
  });

  it("parses the exact Hostinger format with single quotes instead of double quotes", () => {
    process.env["APPLE_PRIVATE_KEY"] =
      "'-----BEGIN PRIVATE KEY-----\\nabc123\\n-----END PRIVATE KEY-----'";

    const config = getAppleAuthConfig();

    expect(config.privateKey.startsWith("-----BEGIN PRIVATE KEY-----")).toBe(true);
    expect(config.privateKey.endsWith("-----END PRIVATE KEY-----")).toBe(true);
    expect(config.privateKey).not.toContain("'");
  });
});
