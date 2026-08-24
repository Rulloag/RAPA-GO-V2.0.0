import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../users/users.repository.js", () => ({
  UsersRepository: vi.fn(),
}));
vi.mock("../passwordReset.repository.js", () => ({
  PasswordResetRepository: vi.fn(),
}));
vi.mock("../mail.service.js", () => ({
  MailService: vi.fn(),
}));
vi.mock("../password.service.js", () => ({
  PasswordService: vi.fn(),
}));
vi.mock("../../audit/audit.service.js", () => ({
  AuditService: vi.fn().mockImplementation(() => ({ recordSafe: vi.fn() })),
}));

import { getPasswordResetFrontendUrl } from "../passwordReset.service.js";

describe("password reset frontend URL", () => {
  const previous = {
    NODE_ENV: process.env["NODE_ENV"],
    FRONTEND_URL: process.env["FRONTEND_URL"],
    PASSWORD_RESET_FRONTEND_URL: process.env["PASSWORD_RESET_FRONTEND_URL"],
  };

  afterEach(() => {
    process.env["NODE_ENV"] = previous.NODE_ENV;
    process.env["FRONTEND_URL"] = previous.FRONTEND_URL;
    process.env["PASSWORD_RESET_FRONTEND_URL"] =
      previous.PASSWORD_RESET_FRONTEND_URL;
  });

  it("allows localhost only outside production", () => {
    process.env["NODE_ENV"] = "development";
    delete process.env["FRONTEND_URL"];
    delete process.env["PASSWORD_RESET_FRONTEND_URL"];

    expect(getPasswordResetFrontendUrl("abc")).toContain("localhost:5173");
  });

  it("refuses a silent localhost fallback in production", () => {
    process.env["NODE_ENV"] = "production";
    delete process.env["FRONTEND_URL"];
    delete process.env["PASSWORD_RESET_FRONTEND_URL"];

    expect(() => getPasswordResetFrontendUrl("abc")).toThrow(/FRONTEND_URL/);
  });

  it("uses the configured production origin", () => {
    process.env["NODE_ENV"] = "production";
    process.env["FRONTEND_URL"] = "https://api.rapago.cl";
    delete process.env["PASSWORD_RESET_FRONTEND_URL"];

    expect(getPasswordResetFrontendUrl("tok")).toBe(
      "https://api.rapago.cl/auth/reset-password?token=tok",
    );
  });
});
