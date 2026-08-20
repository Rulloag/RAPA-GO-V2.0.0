import { describe, expect, it } from "vitest";
import loginSource from "../LoginPage.tsx?raw";
import googleButtonSource from "../GoogleSignInButton.tsx?raw";

describe("Login welcome — Google button, legal links, language", () => {
  it("muestra botón EN/ES y enlaces legales públicos en LoginPage", () => {
    expect(loginSource).toContain("useRapaGoLanguage");
    expect(loginSource).toContain("rapago-auth-lang-btn");
    expect(loginSource).toContain("ROUTES.PUBLIC.TERMS");
    expect(loginSource).toContain("ROUTES.PUBLIC.PRIVACY");
    expect(loginSource).toContain("ROUTES.PUBLIC.USER_CONDITIONS");
    expect(loginSource).toContain("ROUTES.PUBLIC.EULA");
    expect(loginSource).toContain("ROUTES.PUBLIC.SUPPORT");
  });

  it("inicializa Google Identity Services una sola vez y mantiene el botón oficial visible", () => {
    expect(googleButtonSource).toContain("gisInitializedClientId");
    expect(googleButtonSource).toContain("ensureGisInitialized");
    expect(googleButtonSource).toContain("renderButton");
    expect(googleButtonSource).not.toContain(
      "rapago-google-button__official--overlay",
    );
    expect(googleButtonSource).not.toContain("rapago-google-button__face");
  });
});
