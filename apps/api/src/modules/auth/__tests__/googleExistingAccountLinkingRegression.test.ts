import { describe, expect, it } from "vitest";

import googleServiceSource from "../googleAuth.service.ts?raw";
import googleTypesSource from "../googleAuth.types.ts?raw";
import oauthRepositorySource from "../oauthIdentities.repository.ts?raw";
import authSchemasSource from "../auth.schemas.ts?raw";

describe("Google existing-account linking regressions", () => {
  it("links a verified Google identity to the same existing user only after password confirmation", () => {
    expect(googleTypesSource).toContain("linkPassword?: string");
    expect(authSchemasSource).toContain(
      "linkPassword: z.string().min(8).max(128).optional()",
    );
    expect(googleServiceSource).toContain(
      "AUTH_GOOGLE_ACCOUNT_LINKING_REQUIRED",
    );
    expect(googleServiceSource).toContain(
      "this.passwordService.verifyPassword",
    );
    expect(googleServiceSource).toContain(
      "this.identitiesRepository.attachToExistingUser",
    );
    expect(googleServiceSource).toContain(
      "return this.signInExisting(",
    );
  });

  it("links a verified existing account without local password and lets the app create the backup password afterwards", () => {
    const credentialsCheck = googleServiceSource.indexOf(
      "findByUserId(emailOwner.id)",
    );
    const passwordlessLink = googleServiceSource.indexOf(
      "linkPasswordlessVerifiedEmailAccount",
    );

    expect(credentialsCheck).toBeGreaterThan(-1);
    expect(passwordlessLink).toBeGreaterThan(credentialsCheck);
    expect(googleServiceSource).toContain("if (!user.isVerified)");
    expect(googleServiceSource).toContain(
      "this.identitiesRepository.attachToExistingUser",
    );
    expect(googleServiceSource).toContain(
      'method: "verified_email_without_local_password"',
    );
    expect(googleServiceSource).toContain(
      "hasPassword: Boolean(credentials)",
    );
    expect(googleServiceSource).not.toContain("contraseÃ");
  });

  it("keeps Google sub as the stable identity and prevents attaching another Google account to the same user", () => {
    expect(oauthRepositorySource).toContain(
      "async findByUserAndProvider(",
    );
    expect(googleServiceSource).toContain(
      "alreadyLinked.providerUserId !== identity.sub",
    );
    expect(googleServiceSource).toContain(
      'code: "AUTH_GOOGLE_ALREADY_LINKED"',
    );
    expect(googleServiceSource).toContain(
      "providerUserId: identity.sub",
    );
  });

  it("uses the same failed-password lockout protection as email login", () => {
    expect(googleServiceSource).toContain(
      "GOOGLE_LINK_MAX_FAILED_ATTEMPTS = 5",
    );
    expect(googleServiceSource).toContain(
      "this.credentialsRepository.incrementFailedAttempts",
    );
    expect(googleServiceSource).toContain(
      "this.credentialsRepository.lockUntil",
    );
    expect(googleServiceSource).toContain(
      'eventType: "auth.google.link.failure"',
    );
  });
});
