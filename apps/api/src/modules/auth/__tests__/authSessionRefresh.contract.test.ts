import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(relativeUrl: string): string {
  return readFileSync(new URL(relativeUrl, import.meta.url), "utf8");
}

describe("contrato de renovación de sesión", () => {
  const routesSource = read("../auth.routes.ts");
  const controllerSource = read("../auth.controller.ts");
  const serviceSource = read("../auth.service.ts");
  const sessionSource = read("../session.service.ts");

  it("publica POST /auth/refresh con validación", () => {
    expect(routesSource).toContain('"/refresh"');
    expect(routesSource).toContain("authController.refresh");
    expect(controllerSource).toContain("refreshSessionSchema");
    expect(controllerSource).toContain(
      "authService.refreshSession(",
    );
  });

  it("rota el refresh token y emite una nueva sesión", () => {
    expect(serviceSource).toContain(
      "async refreshSession(",
    );
    expect(serviceSource).toContain(
      "nextRefreshToken.token",
    );
    expect(serviceSource).toContain(
      "rotatedFromTokenId: consumed.id",
    );
    expect(sessionSource).toContain(
      "async consumeRefreshToken(",
    );
    expect(sessionSource).toContain(
      "gt(refreshTokens.expiresAt, now)",
    );
  });

  it("entrega refresh token en correo, Facebook y registro", () => {
    const occurrences = serviceSource.match(
      /refreshToken: refreshToken\.token/g,
    );

    expect(occurrences?.length).toBeGreaterThanOrEqual(3);
  });
});
