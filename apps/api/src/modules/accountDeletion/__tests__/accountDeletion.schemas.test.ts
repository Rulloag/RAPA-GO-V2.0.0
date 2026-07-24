import { describe, expect, it } from "vitest";

import {
  createAccountDeletionRequestSchema,
  publicAccountDeletionSubmitSchema,
} from "../accountDeletion.schemas.js";

describe("account deletion schemas", () => {
  it("permite una solicitud autenticada sin motivo", () => {
    const result = createAccountDeletionRequestSchema.safeParse({});

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reason).toBeUndefined();
    }
  });

  it("normaliza un motivo vacío como ausente", () => {
    const result = createAccountDeletionRequestSchema.safeParse({
      reason: "   ",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reason).toBeUndefined();
    }
  });

  it("permite una solicitud pública verificada sin motivo", () => {
    const result = publicAccountDeletionSubmitSchema.safeParse({
      email: "usuario@rapago.cl",
      code: "123456",
      accepted: true,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reason).toBeUndefined();
    }
  });

  it("mantiene el límite de 500 caracteres", () => {
    const result = createAccountDeletionRequestSchema.safeParse({
      reason: "x".repeat(501),
    });

    expect(result.success).toBe(false);
  });
});
