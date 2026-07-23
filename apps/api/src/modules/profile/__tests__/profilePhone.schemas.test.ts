import { describe, expect, it } from "vitest";
import { appleAuthRequestSchema } from "../../auth/auth.schemas.js";
import { updateProfileSchema } from "../profile.schemas.js";

const validAppleRequest = {
  identityToken: "a".repeat(120),
  authorizationCode: "authorization-code",
  nonce: "b".repeat(64),
};

describe("profile phone schemas", () => {
  it("accepts and normalizes a phone-only profile update", () => {
    const parsed = updateProfileSchema.parse({
      phone: "+56 9 1234 5678",
    });

    expect(parsed.phone).toBe("+56912345678");
  });

  it("rejects an invalid profile phone", () => {
    expect(() =>
      updateProfileSchema.parse({ phone: "123" }),
    ).toThrow();
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
