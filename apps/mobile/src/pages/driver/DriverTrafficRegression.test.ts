import { describe, expect, it } from "vitest";

import pageSource from "./index.tsx?raw";
import layoutSource from "../../layouts/DriverLayout.tsx?raw";
import apiClientSource from "../../services/api/apiClient.ts?raw";

describe("driver network traffic regressions", () => {
  it("mounts exactly one global ride alert in DriverLayout", () => {
    expect(pageSource).toContain("export function DriverGlobalRideAlert");
    expect(pageSource.match(/<DriverGlobalRideAlert \/>/g) ?? []).toHaveLength(0);
    expect(layoutSource.match(/<DriverGlobalRideAlert \/>/g) ?? []).toHaveLength(1);
  });

  it("does not poll available rides every second or page rides every five seconds", () => {
    expect(pageSource).not.toContain("window.setInterval(tick, 1000)");
    expect(pageSource).not.toContain("window.setInterval(tick, 1_000)");
    expect(pageSource).not.toMatch(/loadRides\(true\);\s*\}, 5000\)/);
    expect(pageSource).toContain("window.setInterval(tick, 15_000)");
  });

  it("coalesces duplicate GET requests and cools down after HTTP 429", () => {
    expect(apiClientSource).toContain("inFlightGetRequests");
    expect(apiClientSource).toContain("getRateLimitCooldowns");
    expect(apiClientSource).toContain("result.statusCode === 429");
  });

  it("shows each passenger cancellation notice only once", () => {
    expect(pageSource).toContain("claimDriverPassengerCancelNoticeOnce");
    expect(pageSource).toContain(
      "RAPAGO_DRIVER_PASSENGER_CANCEL_NOTICE_SEEN_KEY",
    );
  });
});
