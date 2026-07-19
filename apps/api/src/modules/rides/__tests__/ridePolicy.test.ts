import { describe, expect, it } from "vitest";

import {
  calculateRidePolicyAmount,
  isPassengerCancellationChargeable,
  roundFareUpTo500,
} from "../ridePolicy.js";

describe("RAPA GO ride policy", () => {
  it("redondea la tarifa final siempre hacia arriba cada $500", () => {
    expect(roundFareUpTo500(10000)).toBe(10000);
    expect(roundFareUpTo500(10001)).toBe(10500);
    expect(roundFareUpTo500(10500)).toBe(10500);
    expect(roundFareUpTo500(10501)).toBe(11000);
  });

  it("mantiene gratis la cancelación inmediata antes de dos minutos", () => {
    const acceptedAtMs = 1_000_000;

    expect(
      isPassengerCancellationChargeable({
        isScheduled: false,
        scheduledPickupAtMs: null,
        acceptedAtMs,
        nowMs: acceptedAtMs + 119_999,
      }),
    ).toBe(false);

    expect(
      isPassengerCancellationChargeable({
        isScheduled: false,
        scheduledPickupAtMs: null,
        acceptedAtMs,
        nowMs: acceptedAtMs + 120_000,
      }),
    ).toBe(true);
  });

  it("cobra una reserva solo dentro de los últimos 30 minutos", () => {
    const nowMs = 10_000_000;

    expect(
      isPassengerCancellationChargeable({
        isScheduled: true,
        scheduledPickupAtMs: nowMs + 30 * 60 * 1000 + 1,
        acceptedAtMs: nowMs - 10 * 60 * 1000,
        nowMs,
      }),
    ).toBe(false);

    expect(
      isPassengerCancellationChargeable({
        isScheduled: true,
        scheduledPickupAtMs: nowMs + 30 * 60 * 1000,
        acceptedAtMs: null,
        nowMs,
      }),
    ).toBe(true);
  });

  it("aplica 30% con tope $3.000 y No Show 50% con tope $5.000", () => {
    expect(calculateRidePolicyAmount(5000, 30, 3000)).toBe(1500);
    expect(calculateRidePolicyAmount(50000, 30, 3000)).toBe(3000);
    expect(calculateRidePolicyAmount(5000, 50, 5000)).toBe(2500);
    expect(calculateRidePolicyAmount(50000, 50, 5000)).toBe(5000);
  });
});
