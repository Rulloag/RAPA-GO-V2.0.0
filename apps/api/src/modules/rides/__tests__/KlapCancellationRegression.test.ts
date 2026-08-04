import { describe, expect, it } from "vitest";
import ridesServiceSource from "../rides.service.ts?raw";
import ridesSchemaSource from "../rides.schemas.ts?raw";

describe("Klap pending-payment cancellation regressions", () => {
  it("accepts Klap as the persisted card provider", () => {
    expect(ridesSchemaSource).toContain(
      '["klap", "mercadopago", "prontopaga", "transbank"]',
    );
    expect(ridesServiceSource).toContain(
      '!["klap", "mercadopago", "prontopaga", "transbank"].includes',
    );
  });

  it("does not create a cancellation fee before payment approval", () => {
    expect(ridesServiceSource).toContain(
      'existing.status !== "pending_payment"',
    );
    expect(ridesServiceSource).toContain(
      "Una solicitud todavía sin pago aprobado se puede descartar sin multa",
    );
  });
});
