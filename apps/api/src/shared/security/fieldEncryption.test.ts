import { afterEach, describe, expect, it } from "vitest";

import {
  decryptSensitiveValue,
  encryptSensitiveValue,
} from "./fieldEncryption.js";

const originalKey = process.env["BANK_ACCOUNT_ENCRYPTION_KEY"];

afterEach(() => {
  if (originalKey === undefined) {
    delete process.env["BANK_ACCOUNT_ENCRYPTION_KEY"];
  } else {
    process.env["BANK_ACCOUNT_ENCRYPTION_KEY"] = originalKey;
  }
});

describe("fieldEncryption", () => {
  it("cifra y descifra un número de cuenta con AES-256-GCM", () => {
    process.env["BANK_ACCOUNT_ENCRYPTION_KEY"] = "a".repeat(64);
    const encrypted = encryptSensitiveValue("1234567890");

    expect(encrypted).not.toContain("1234567890");
    expect(decryptSensitiveValue(encrypted)).toBe("1234567890");
  });

  it("rechaza una clave demasiado corta", () => {
    process.env["BANK_ACCOUNT_ENCRYPTION_KEY"] = "short";
    expect(() => encryptSensitiveValue("1234")).toThrow(
      "at least 32 characters",
    );
  });
});
