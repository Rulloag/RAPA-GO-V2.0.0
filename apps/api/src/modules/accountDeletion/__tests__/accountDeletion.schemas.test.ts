import { describe, expect, it } from "vitest";

import {
  createAccountDeletionRequestSchema,
  publicAccountDeletionSubmitSchema,
} from "../accountDeletion.schemas.js";

describe("account deletion schemas", () => {
  it("exige motivo en una solicitud autenticada", () => {
    const result = createAccountDeletionRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rechaza un motivo vacío", () => {
    const result = createAccountDeletionRequestSchema.safeParse({
      reason: "   ",
    });
    expect(result.success).toBe(false);
  });

  it("exige motivo en una solicitud pública verificada", () => {
    const result = publicAccountDeletionSubmitSchema.safeParse({
      email: "usuario@rapago.cl",
      code: "123456",
      accepted: true,
    });
    expect(result.success).toBe(false);
  });

  it("rechaza la antigua opción de no indicar motivo", () => {
    const result = createAccountDeletionRequestSchema.safeParse({
      reason: "Prefiero no indicar",
    });
    expect(result.success).toBe(false);
  });

  it("acepta un motivo válido", () => {
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
