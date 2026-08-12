import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const serviceSource = readFileSync(
  new URL("../payments.service.ts", import.meta.url),
  "utf8",
);

function getKlapNormalizerSource(): string {
  const start = serviceSource.indexOf(
    "function normalizeKlapOrderStatus",
  );

  const end = serviceSource.indexOf(
    "function getKlapOrderExpirationMs",
    start,
  );

  if (start < 0 || end < 0 || end <= start) {
    throw new Error(
      "No se pudo localizar normalizeKlapOrderStatus en payments.service.ts",
    );
  }

  return serviceSource.slice(start, end);
}

function executeKlapNormalizer(value: unknown): string {
  const source = getKlapNormalizerSource();

  const bodyStart = source.indexOf("{");
  const bodyEnd = source.lastIndexOf("}");

  if (bodyStart < 0 || bodyEnd <= bodyStart) {
    throw new Error(
      "No se pudo extraer el cuerpo de normalizeKlapOrderStatus.",
    );
  }

  const body = source.slice(bodyStart + 1, bodyEnd);

  const fn = new Function(
    "value",
    body,
  ) as (input: unknown) => string;

  return fn(value);
}

describe("Klap production refund reconciliation regression", () => {
  it('normaliza el status real de Klap "refund" como rejected', () => {
    expect(executeKlapNormalizer("refund")).toBe("rejected");
  });

  it('mantiene "refunded" como rejected', () => {
    expect(executeKlapNormalizer("refunded")).toBe("rejected");
  });

  it("no altera los estados Klap aprobados o pendientes", () => {
    expect(executeKlapNormalizer("approved")).toBe("success");
    expect(executeKlapNormalizer("success")).toBe("success");
    expect(executeKlapNormalizer("processing")).toBe("pending");
    expect(executeKlapNormalizer("pending")).toBe("pending");
  });

  it("mantiene desconocidos los estados Klap no reconocidos", () => {
    expect(executeKlapNormalizer("estado-inventado")).toBe("unknown");
  });

  it('el normalizador Klap contiene explícitamente "refund"', () => {
    const source = getKlapNormalizerSource();

    expect(source).toContain('"refund",');
    expect(source).toContain('"refunded",');
    expect(source).toContain('return "rejected";');
  });
});