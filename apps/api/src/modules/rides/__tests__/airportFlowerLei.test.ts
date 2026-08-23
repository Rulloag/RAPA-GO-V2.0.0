import { describe, expect, it } from "vitest";
import {
  evaluateAirportFlowerLei,
  FLOWER_LEI_MIN_LEAD_MS,
  isFlowerLeiLeadTimeMet,
  isMataveriAirportOriginText,
} from "../airportFlowerLei.js";

describe("airportFlowerLei", () => {
  const nowMs = Date.parse("2026-08-25T12:00:00.000Z");

  it("reconoce origen Mataveri", () => {
    expect(
      isMataveriAirportOriginText("Aeropuerto Internacional Mataveri"),
    ).toBe(true);
    expect(isMataveriAirportOriginText("Ahu Tahai")).toBe(false);
  });

  it("permite collares con exactamente 4 horas", () => {
    const scheduledAt = new Date(nowMs + FLOWER_LEI_MIN_LEAD_MS).toISOString();
    expect(isFlowerLeiLeadTimeMet(scheduledAt, nowMs)).toBe(true);

    const result = evaluateAirportFlowerLei({
      airportWelcomeOption: "flower_lei",
      flowerLeiQuantity: 2,
      originText: "Aeropuerto Internacional Mataveri",
      isScheduled: true,
      tripFareMode: "one_way",
      scheduledAt,
      nowMs,
    });

    expect(result.requested).toBe(true);
    if (!result.requested || !result.ok) return;
    expect(result.quantity).toBe(2);
    expect(result.surchargeClp).toBe(8000);
  });

  it("permite collares con 5 horas", () => {
    const scheduledAt = new Date(
      nowMs + 5 * 60 * 60 * 1000,
    ).toISOString();
    const result = evaluateAirportFlowerLei({
      airportWelcomeOption: "flower_lei",
      flowerLeiQuantity: 1,
      originText: "Aeropuerto Internacional Mataveri",
      isScheduled: true,
      tripFareMode: "one_way",
      scheduledAt,
      nowMs,
    });
    expect(result).toMatchObject({ requested: true, ok: true, quantity: 1 });
  });

  it("rechaza con 3h59m", () => {
    const scheduledAt = new Date(
      nowMs + FLOWER_LEI_MIN_LEAD_MS - 60_000,
    ).toISOString();
    const result = evaluateAirportFlowerLei({
      airportWelcomeOption: "flower_lei",
      flowerLeiQuantity: 1,
      originText: "Aeropuerto Internacional Mataveri",
      isScheduled: true,
      tripFareMode: "one_way",
      scheduledAt,
      nowMs,
    });
    expect(result).toMatchObject({
      requested: true,
      ok: false,
      code: "FLOWER_LEI_LESS_THAN_4_HOURS",
    });
  });

  it("rechaza fuera de aeropuerto", () => {
    const scheduledAt = new Date(
      nowMs + 5 * 60 * 60 * 1000,
    ).toISOString();
    const result = evaluateAirportFlowerLei({
      airportWelcomeOption: "flower_lei",
      flowerLeiQuantity: 1,
      originText: "Hotel Taha Tai",
      isScheduled: true,
      tripFareMode: "one_way",
      scheduledAt,
      nowMs,
    });
    expect(result).toMatchObject({
      requested: true,
      ok: false,
      code: "FLOWER_LEI_NOT_AIRPORT",
    });
  });

  it("rechaza cantidad inválida", () => {
    const scheduledAt = new Date(
      nowMs + 5 * 60 * 60 * 1000,
    ).toISOString();
    const result = evaluateAirportFlowerLei({
      airportWelcomeOption: "flower_lei",
      flowerLeiQuantity: -1,
      originText: "Aeropuerto Internacional Mataveri",
      isScheduled: true,
      tripFareMode: "one_way",
      scheduledAt,
      nowMs,
    });
    expect(result).toMatchObject({
      requested: true,
      ok: false,
      code: "FLOWER_LEI_INVALID_QUANTITY",
    });
  });

  it("no solicita nada si la opción es none", () => {
    expect(
      evaluateAirportFlowerLei({
        airportWelcomeOption: "none",
        flowerLeiQuantity: 3,
        originText: "Aeropuerto Internacional Mataveri",
        isScheduled: true,
        scheduledAt: new Date(nowMs + 5 * 60 * 60 * 1000).toISOString(),
        nowMs,
      }),
    ).toEqual({ requested: false, quantity: 0, surchargeClp: 0 });
  });
});
