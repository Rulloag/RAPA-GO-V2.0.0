import { describe, expect, it } from "vitest";

import {
  getPassengerCancellationPolicyClockStartMs,
  isPassengerQueuedOfferAssignment,
  isPassengerQueuedOfferFreeCancel,
  PASSENGER_FREE_CANCELLATION_MS,
} from "./passengerCancellationPolicy";

const NOW = 1_700_000_000_000;
const ACCEPTED_20_MIN_AGO = NOW - 20 * 60 * 1000;
const EN_ROUTE_5_S_AGO = NOW - 5 * 1000;
const EN_ROUTE_2_MIN_AGO = NOW - 2 * 60 * 1000;

describe("política de cancelación del pasajero — preasignación encadenada", () => {
  it("reconoce assignmentMode queued_offer", () => {
    expect(isPassengerQueuedOfferAssignment("queued_offer")).toBe(true);
    expect(isPassengerQueuedOfferAssignment("automatic")).toBe(false);
    expect(isPassengerQueuedOfferAssignment(undefined)).toBe(false);
  });

  it("TEST_1/2/3: accepted + queued_offer es gratis aunque acceptedAt tenga 20 minutos", () => {
    expect(
      isPassengerQueuedOfferFreeCancel({
        assignmentMode: "queued_offer",
        status: "accepted",
        enRouteAt: null,
      }),
    ).toBe(true);

    expect(
      getPassengerCancellationPolicyClockStartMs({
        assignmentMode: "queued_offer",
        status: "accepted",
        acceptedAtMs: ACCEPTED_20_MIN_AGO,
        enRouteAt: null,
      }),
    ).toBeNull();
  });

  it("queued_offer sin enRouteAt es gratis aunque el status ya no sea accepted", () => {
    expect(
      isPassengerQueuedOfferFreeCancel({
        assignmentMode: "queued_offer",
        status: "driver_en_route",
        enRouteAt: null,
      }),
    ).toBe(true);

    expect(
      getPassengerCancellationPolicyClockStartMs({
        assignmentMode: "queued_offer",
        status: "driver_en_route",
        acceptedAtMs: ACCEPTED_20_MIN_AGO,
        enRouteAt: null,
      }),
    ).toBeNull();
  });

  it("TEST_4: driver_en_route usa enRouteAt, no acceptedAt antiguo — aún en ventana gratis", () => {
    expect(
      isPassengerQueuedOfferFreeCancel({
        assignmentMode: "queued_offer",
        status: "driver_en_route",
        enRouteAt: new Date(EN_ROUTE_5_S_AGO).toISOString(),
      }),
    ).toBe(false);

    const clockStartMs = getPassengerCancellationPolicyClockStartMs({
      assignmentMode: "queued_offer",
      status: "driver_en_route",
      acceptedAtMs: ACCEPTED_20_MIN_AGO,
      enRouteAt: new Date(EN_ROUTE_5_S_AGO).toISOString(),
    });

    expect(clockStartMs).toBe(EN_ROUTE_5_S_AGO);
    expect(NOW - (clockStartMs ?? 0)).toBeLessThan(PASSENGER_FREE_CANCELLATION_MS);
  });

  it("TEST_4b: driver_en_route con enRouteAt de hace 2 minutos ya sale de la ventana gratis", () => {
    const clockStartMs = getPassengerCancellationPolicyClockStartMs({
      assignmentMode: "queued_offer",
      status: "driver_en_route",
      acceptedAtMs: ACCEPTED_20_MIN_AGO,
      enRouteAt: new Date(EN_ROUTE_2_MIN_AGO).toISOString(),
    });

    expect(clockStartMs).toBe(EN_ROUTE_2_MIN_AGO);
    expect(NOW - (clockStartMs ?? 0)).toBeGreaterThanOrEqual(PASSENGER_FREE_CANCELLATION_MS);
  });

  it("viajes normales siguen usando acceptedAt y no enRouteAt", () => {
    expect(
      isPassengerQueuedOfferFreeCancel({
        assignmentMode: "automatic",
        status: "accepted",
        enRouteAt: null,
      }),
    ).toBe(false);

    expect(
      getPassengerCancellationPolicyClockStartMs({
        assignmentMode: "automatic",
        status: "accepted",
        acceptedAtMs: ACCEPTED_20_MIN_AGO,
        enRouteAt: new Date(EN_ROUTE_5_S_AGO).toISOString(),
      }),
    ).toBe(ACCEPTED_20_MIN_AGO);

    expect(
      getPassengerCancellationPolicyClockStartMs({
        assignmentMode: undefined,
        status: "accepted",
        acceptedAtMs: ACCEPTED_20_MIN_AGO,
        enRouteAt: null,
      }),
    ).toBe(ACCEPTED_20_MIN_AGO);
  });
});
