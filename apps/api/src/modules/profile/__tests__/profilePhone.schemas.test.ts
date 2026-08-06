import { describe, expect, it } from "vitest";
import { appleAuthRequestSchema } from "../../auth/auth.schemas.js";
import { updateProfileSchema } from "../profile.schemas.js";

const validAppleRequest = {
  identityToken: "a".repeat(120),
  authorizationCode: "authorization-code",
  nonce: "b".repeat(64),
};

describe("profile identity lock schemas", () => {
  it("rejects direct phone changes from the self-service profile", () => {
    expect(() =>
      updateProfileSchema.parse({
        phone: "+56 9 1234 5678",
      }),
    ).toThrow();
  });

  it("rejects direct name changes from the self-service profile", () => {
    expect(() =>
      updateProfileSchema.parse({
        name: "Nombre alterado",
      }),
    ).toThrow();
  });

  it("allows removing an avatar without changing identity", () => {
    const parsed = updateProfileSchema.parse({
      avatarUrl: null,
    });

    expect(parsed.avatarUrl).toBeNull();
  });

  it("accepts a valid phone during Apple account setup", () => {
    const parsed = appleAuthRequestSchema.parse({
      ...validAppleRequest,
      phone: "+56912345678",
    });

    expect(parsed.phone).toBe("+56912345678");
  });

  it("rejects an invalid Apple account phone", () => {
    expect(() =>
      appleAuthRequestSchema.parse({
        ...validAppleRequest,
        phone: "abc",
      }),
    ).toThrow();
  });
});
