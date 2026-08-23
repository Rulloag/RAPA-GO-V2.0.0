import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "index.tsx"),
  "utf8",
);

describe("RapaGo más veloz — conductor", () => {
  it("muestra el aviso prioritario para Klap y para efectivo", () => {
    expect(source).toContain("RapaGo más veloz");
    expect(source).toContain("El pasajero agregó {formatClp(info.feeClp)} para priorizar esta");
    expect(source).toContain("Recargo retenido con Klap. No cobrar ese extra en efectivo.");
    expect(source).toContain("Cobrar el total actualizado en efectivo.");
  });

  it("ordena primero las solicitudes con RapaGo más veloz activo", () => {
    const start = source.indexOf("const displayedAvailableRides");
    const block = source.slice(start, start + 1800);
    expect(block).toContain("getDriverFastSearchInfo");
    expect(block).toContain("aPriority !== bPriority");
    expect(block).toContain("priorityFeeClp");
  });
});
