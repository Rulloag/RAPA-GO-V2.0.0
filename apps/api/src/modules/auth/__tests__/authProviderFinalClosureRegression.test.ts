import { describe, expect, it } from "vitest";

import authRoutesSource from "../auth.routes.ts?raw";
import authServiceSource from "../auth.service.ts?raw";
import oauthRepositorySource from "../oauthIdentities.repository.ts?raw";

describe("final auth provider closure", () => {
  it("loads Google providers from oauth_identities into the auth session", () => {
    expect(authServiceSource).toContain("oauthIdentitiesRepo.listProviders");
    expect(oauthRepositorySource).toContain("listProviders(");
    expect(oauthRepositorySource).toContain('"google"');
  });

  it("does not expose Facebook auth endpoints", () => {
    expect(authRoutesSource).not.toContain('"/facebook');
    expect(authRoutesSource).toContain("Facebook Login fue retirado");
  });
});
