import { describe, expect, it } from "vitest";

import serviceSource from "../googleIdentityServices.ts?raw";
import buttonSource from "../GoogleSignInButton.tsx?raw";

describe("Google Identity Services regressions", () => {
  it("does not assume that window.google from Maps contains accounts.id", () => {
    expect(serviceSource).toContain("accounts?:");
    expect(serviceSource).toContain("?.accounts?.id");
    expect(buttonSource).toContain("?.accounts?.id");
    expect(serviceSource).not.toContain("?.accounts.id");
    expect(buttonSource).not.toContain("?.accounts.id");
  });

  it("disables auto-select only when the GIS API really exists", () => {
    expect(serviceSource).toContain(
      "getGoogleIdentityServices()?.accounts?.id?.disableAutoSelect()",
    );
  });
});
