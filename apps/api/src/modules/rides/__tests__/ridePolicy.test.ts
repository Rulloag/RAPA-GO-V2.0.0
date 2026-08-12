import { describe, expect, it } from "vitest";

import {
  calculateRidePolicyAmount,
  isPassengerCancellationChargeable,
  roundFareUpTo500,
  splitNoShowAmount,
} from "../ridePolicy.js";

describe("RAPA GO ride policy", () => {
  it("redondea la tarifa final siempre hacia arriba cada $500", () => {
    expect(roundFareUpTo500(10000)).toBe(10000);
    expect(roundFareUpTo500(10001)).toBe(10500);
    expect(roundFareUpTo500(10500)).toBe(10500);
    expect(roundFareUpTo500(10501)).toBe(11000);
  });

  it("mantiene gratis la cancelación antes de 1 minuto desde la asignación", () => {
    const acceptedAtMs = 1_000_000;

    expect(
      isPassengerCancellationChargeable({
        isScheduled: false,
        scheduledPickupAtMs: null,
        acceptedAtMs,
        nowMs: acceptedAtMs + 59_999,
      }),
    ).toBe(false);

    expect(
      isPassengerCancellationChargeable({
        isScheduled: false,
        scheduledPickupAtMs: null,
        acceptedAtMs,
        nowMs: acceptedAtMs + 60_000,
      }),
    ).toBe(true);
  });

  it("mantiene gratuita cualquier cancelación mientras no exista conductor asignado", () => {
    const nowMs = 10_000_000;

    expect(
      isPassengerCancellationChargeable({
        isScheduled: false,
        scheduledPickupAtMs: null,
        acceptedAtMs: null,
        nowMs,
      }),
    ).toBe(false);

    expect(
      isPassengerCancellationChargeable({
        isScheduled: true,
        scheduledPickupAtMs: nowMs + 5 * 60 * 1000,
        acceptedAtMs: null,
        nowMs,
      }),
    ).toBe(false);
  });

  it("aplica la misma ventana de 1 minuto a una reserva cuando ya tiene conductor", () => {
    const nowMs = 10_000_000;
    const acceptedAtMs = nowMs - 60_000;

    expect(
      isPassengerCancellationChargeable({
        isScheduled: true,
        scheduledPickupAtMs: nowMs + 20 * 60 * 1000,
        acceptedAtMs,
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

  it("distribuye el No Show 50% conductor y 50% Rapa Go", () => {
    expect(splitNoShowAmount(5000)).toEqual({
      totalAmountClp: 5000,
      driverShareClp: 2500,
      platformShareClp: 2500,
      driverSharePercent: 50,
      platformSharePercent: 50,
    });

    expect(splitNoShowAmount(2501)).toEqual({
      totalAmountClp: 2501,
      driverShareClp: 1250,
      platformShareClp: 1251,
      driverSharePercent: 50,
      platformSharePercent: 50,
    });
  });
});
