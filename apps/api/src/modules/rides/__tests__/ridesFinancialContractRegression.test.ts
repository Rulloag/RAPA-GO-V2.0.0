import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const policy = readFileSync(
  new URL("../ridePolicy.ts", import.meta.url),
  "utf8",
);

const repository = readFileSync(
  new URL("../rides.repository.ts", import.meta.url),
  "utf8",
);

const service = readFileSync(
  new URL("../rides.service.ts", import.meta.url),
  "utf8",
);

describe("RAPA GO financial ride contract regression", () => {
  it("uses one minute from effective driver assignment and no scheduled-only charge window", () => {
    expect(policy).toContain(
      "PASSENGER_FREE_CANCELLATION_MS = 1 * 60 * 1000",
    );
    expect(policy).not.toContain(
      "SCHEDULED_CANCELLATION_CHARGE_WINDOW_MS",
    );
    expect(policy).toContain("input.acceptedAtMs == null");
  });

  it("driver cancellation requeues the ride and resets the assignment clock", () => {
    const start = repository.indexOf("async cancelAccepted(");
    const end = repository.indexOf(
      "\n  async ",
      start + "async cancelAccepted(".length,
    );
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);

    const method = repository.slice(start, end);
    expect(method).toContain('status: "requested"');
    expect(method).toContain("driverUserId: null");
    expect(method).toContain("acceptedAt: null");
    expect(method).toContain('outcome: "cancelled"');
  });

  it("a new driver acceptance creates a fresh acceptedAt", () => {
    const acceptStart = repository.indexOf("async accept(");
    const acceptEnd = repository.indexOf("async complete(", acceptStart);
    expect(acceptStart).toBeGreaterThanOrEqual(0);
    expect(acceptEnd).toBeGreaterThan(acceptStart);

    const method = repository.slice(acceptStart, acceptEnd);
    expect(method).toContain("const acceptedAt = new Date()");
    expect(method).toContain("acceptedAt,");
    expect(method).toContain('outcome: "active"');
  });

  it("driver cancellation never invokes passenger payment refund", () => {
    const start = service.indexOf("async cancelAcceptedRide(");
    const end = service.indexOf("async listMyApprovedPolicyCharges(", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);

    const method = service.slice(start, end);
    expect(method).toContain('cancellationActorRole === "passenger"');
    expect(method).toContain(
      'responseRide["requeuedAfterDriverCancellation"] = true',
    );
  });

  it("no show requires driver_arrived plus five minutes", () => {
    const start = service.indexOf("async declareNoShow(");
    expect(start).toBeGreaterThanOrEqual(0);
    const method = service.slice(start);

    expect(method).toContain('existing.status !== "driver_arrived"');
    expect(method).toContain("waitedMs < DRIVER_NO_SHOW_WAIT_MS");
    expect(policy).toContain("DRIVER_NO_SHOW_WAIT_MS = 5 * 60 * 1000");
  });

  it("completed rides resolve Klap from the server-side completion path", () => {
    const start = service.indexOf("async completeRide(");
    const end = service.indexOf("async markEnRoute(", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);

    const method = service.slice(start, end);
    expect(method).toContain("captureAuthorizedKlapPayment");
    expect(method).toContain('outcome: "completed"');
  });
});
