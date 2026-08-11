import { afterEach, beforeEach, describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import { TokenService } from "../token.service.js";
import type { AuthUser } from "../auth.types.js";

/**
 * Regresión del fallo que provocaba "me fui a WhatsApp y volví sin sesión".
 *
 * `getAccessTokenTtlSeconds()` hacía `Number(process.env[...] ?? "")`. Con la
 * variable sin definir eso da `Number("")`, que es 0 — y 0 ES finito, así que
 * la comprobación `!Number.isFinite(...)` nunca se cumplía: el default de 24 h
 * era inalcanzable y el clamp dejaba el TTL en el mínimo de 900 s (15 min).
 *
 * En producción la variable no está definida, así que el token real duraba 15
 * minutos en vez de 24 horas.
 */

const ONE_DAY_SECONDS = 24 * 60 * 60;
const FIFTEEN_MINUTES_SECONDS = 15 * 60;

const USER: AuthUser = {
  id: "8f1c6d54-0b6a-4f2e-9f3a-1d2c3b4a5e6f",
  email: "tere@rapanui.cl",
  name: "Tere Haoa",
  role: "passenger",
  avatarUrl: null,
  isVerified: true,
};

function ttlOfIssuedToken(service: TokenService): number {
  const issued = service.issueAccessToken(USER);
  const decoded = jwt.decode(issued.token) as { iat: number; exp: number };

  return decoded.exp - decoded.iat;
}

describe("TTL del access token", () => {
  const originalTtl = process.env["ACCESS_TOKEN_TTL_SECONDS"];
  const originalSecret = process.env["JWT_SECRET"];
  let service: TokenService;

  beforeEach(() => {
    process.env["JWT_SECRET"] = "test-secret-for-ttl-assertions-only";
    service = new TokenService();
  });

  afterEach(() => {
    if (originalTtl === undefined) delete process.env["ACCESS_TOKEN_TTL_SECONDS"];
    else process.env["ACCESS_TOKEN_TTL_SECONDS"] = originalTtl;

    if (originalSecret === undefined) delete process.env["JWT_SECRET"];
    else process.env["JWT_SECRET"] = originalSecret;
  });

  it("usa 24 h cuando la variable no está definida (era el bug: daba 15 min)", () => {
    delete process.env["ACCESS_TOKEN_TTL_SECONDS"];

    expect(ttlOfIssuedToken(service)).toBe(ONE_DAY_SECONDS);
  });

  it("usa 24 h cuando la variable está vacía o en blanco", () => {
    process.env["ACCESS_TOKEN_TTL_SECONDS"] = "";
    expect(ttlOfIssuedToken(service)).toBe(ONE_DAY_SECONDS);

    process.env["ACCESS_TOKEN_TTL_SECONDS"] = "   ";
    expect(ttlOfIssuedToken(service)).toBe(ONE_DAY_SECONDS);
  });

  it("usa 24 h cuando el valor no es un número", () => {
    process.env["ACCESS_TOKEN_TTL_SECONDS"] = "no-soy-un-numero";

    expect(ttlOfIssuedToken(service)).toBe(ONE_DAY_SECONDS);
  });

  it("respeta un valor válido configurado a propósito", () => {
    process.env["ACCESS_TOKEN_TTL_SECONDS"] = String(2 * 60 * 60);

    expect(ttlOfIssuedToken(service)).toBe(2 * 60 * 60);
  });

  it("sigue aplicando el mínimo y el máximo a valores fuera de rango", () => {
    process.env["ACCESS_TOKEN_TTL_SECONDS"] = "60";
    expect(ttlOfIssuedToken(service)).toBe(FIFTEEN_MINUTES_SECONDS);

    process.env["ACCESS_TOKEN_TTL_SECONDS"] = String(365 * 24 * 60 * 60);
    expect(ttlOfIssuedToken(service)).toBe(7 * 24 * 60 * 60);
  });

  it("trata 0 y los negativos como 'sin configurar', no como el mínimo", () => {
    process.env["ACCESS_TOKEN_TTL_SECONDS"] = "0";
    expect(ttlOfIssuedToken(service)).toBe(ONE_DAY_SECONDS);

    process.env["ACCESS_TOKEN_TTL_SECONDS"] = "-1";
    expect(ttlOfIssuedToken(service)).toBe(ONE_DAY_SECONDS);
  });
});
