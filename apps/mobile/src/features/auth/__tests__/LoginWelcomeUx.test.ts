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

  it("oculta el botón GIS de Google detrás de una cara negra a todo el ancho", () => {
    expect(googleButtonSource).toContain("rapago-google-button__face");
    expect(googleButtonSource).toContain(
      "rapago-google-button__official--overlay",
    );
  });
});
