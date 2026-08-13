import { describe, expect, it } from "vitest";

import {
  createAccountDeletionRequestSchema,
  publicAccountDeletionSubmitSchema,
} from "../accountDeletion.schemas.js";

describe("account deletion schemas", () => {
  it("permite una solicitud autenticada sin motivo", () => {
    const result = createAccountDeletionRequestSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("permite motivo vacío y el repositorio lo normaliza a null", () => {
    const result = createAccountDeletionRequestSchema.safeParse({
      reason: "   ",
    });
    expect(result.success).toBe(true);
  });

  it("permite una solicitud pública verificada sin motivo", () => {
    const result = publicAccountDeletionSubmitSchema.safeParse({
      email: "usuario@rapago.cl",
      code: "123456",
      accepted: true,
    });
    expect(result.success).toBe(true);
  });

  it("permite elegir Prefiero no indicar", () => {
    const result = createAccountDeletionRequestSchema.safeParse({
      reason: "Prefiero no indicar",
    });
    expect(result.success).toBe(true);
  });

  it("acepta un motivo voluntario válido", () => {
    const result = createAccountDeletionRequestSchema.safeParse({
      reason: "Ya no utilizaré la aplicación.",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reason).toBe("Ya no utilizaré la aplicación.");
    }
  });

  it("mantiene el límite de 500 caracteres", () => {
    const result = createAccountDeletionRequestSchema.safeParse({
      reason: "x".repeat(501),
    });
    expect(result.success).toBe(false);
  });
});
