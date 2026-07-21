import { describe, expect, it } from "vitest";
import {
  createLegalDocumentSchema,
  updateLegalDocumentSchema,
} from "../legal.schemas.js";

const definitiveContent = [
  "Estas condiciones regulan el uso de RAPA GO y describen las obligaciones",
  "del usuario, los medios de pago, la seguridad y los canales de soporte.",
].join(" ");

describe("legal document schemas", () => {
  it("accepts a definitive and versioned user conditions document", () => {
    const result = createLegalDocumentSchema.safeParse({
      type: "user_conditions",
      version: "2.0",
      title: "Condiciones para Usuarios",
      content: definitiveContent,
      effectiveDate: "2026-07-21",
    });

    expect(result.success).toBe(true);
  });

  it("rejects a document that is still in preparation", () => {
    const result = createLegalDocumentSchema.safeParse({
      type: "user_conditions",
      version: "2.0",
      title: "Condiciones para Usuarios",
      content: `${definitiveContent} Este documento está en preparación.`,
      effectiveDate: "2026-07-21",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an empty update", () => {
    expect(updateLegalDocumentSchema.safeParse({}).success).toBe(false);
  });
});
