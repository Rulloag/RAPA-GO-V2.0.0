import { describe, expect, it } from "vitest";
import apiClientSource from "../../../services/api/apiClient.ts?raw";
import providerSource from "../AuthProvider.tsx?raw";
import storageSource from "../sessionStorage.service.ts?raw";

describe("sesión renovable del frontend", () => {
  it("no cierra toda la sesión por cualquier 401 aislado", () => {
    expect(apiClientSource).not.toContain(
      "response.status === 401 ||",
    );
    expect(apiClientSource).toContain('"auth:token-expired"');
    expect(apiClientSource).toContain('"AUTH_TOKEN_EXPIRED"');
  });

  it("renueva el token antes de que expire y al recibir el evento", () => {
    expect(providerSource).toContain(
      "ACCESS_TOKEN_REFRESH_SKEW_MS",
    );
    expect(providerSource).toContain("authService.refresh(");
    expect(providerSource).toContain('"auth:token-expired"');
    expect(providerSource).toContain("refreshInFlightRef");
    expect(providerSource).toContain("getAuthFailureCode");
  });

  it("conserva el refresh token cuando vence solo el access token", () => {
    expect(storageSource).not.toContain(
      "Date.parse(parsed.expiresAt) <= Date.now()",
    );
    expect(storageSource).toContain(
      "AuthProvider decide si renueva la sesión",
    );
  });
});
