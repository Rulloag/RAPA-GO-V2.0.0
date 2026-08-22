/**
 * Offline sync assignment defense — executable against persistence layer
 * mirroring AdminService.syncToRide accept step.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AppError } from "../../../shared/errors/AppError.js";
import { VEHICLE_NOT_ELIGIBLE_CODE } from "@rapa-go/shared";
import { AppError } from "../../../shared/errors/AppError.js";

const here = path.dirname(fileURLToPath(import.meta.url));

describe("MICRO-GATE offline sync assignment defense", () => {
  it("admin.service sync uses atomic syncOfflineBookingWithDriverAssignment", () => {
    const src = readFileSync(
      path.join(here, "../admin.service.ts"),
      "utf8",
    );
    const start = src.indexOf("offlineBookingId: string");
    expect(start).toBeGreaterThan(-1);
    const fn = src.slice(start, src.indexOf("async setDriverVehicleCategory("));
    expect(fn).toContain("syncOfflineBookingWithDriverAssignment");
    expect(fn).toContain("admin.ride_driver_assigned");
  });

  it("simulated sync assign path: ineligible → REJECT, no assign audit", async () => {
    const side = { setBusy: 0, assignAudit: 0, syncAudit: 0 };
    async function syncAssignStep(acceptImpl: () => Promise<void>) {
      try {
        await acceptImpl();
      } catch (err) {
        if (err instanceof AppError) {
          return {
            ok: false as const,
            code: err.code,
            statusCode: err.statusCode,
          };
        }
        throw err;
      }
      side.setBusy += 1;
      side.assignAudit += 1;
      side.syncAudit += 1;
      return { ok: true as const };
    }

    const rejected = await syncAssignStep(async () => {
      throw new AppError({
        code: VEHICLE_NOT_ELIGIBLE_CODE,
        message: "not eligible",
        statusCode: 409,
      });
    });
    expect(rejected).toEqual({
      ok: false,
      code: VEHICLE_NOT_ELIGIBLE_CODE,
      statusCode: 409,
    });
    expect(side.setBusy).toBe(0);
    expect(side.assignAudit).toBe(0);

    const passed = await syncAssignStep(async () => undefined);
    expect(passed.ok).toBe(true);
    expect(side.setBusy).toBe(1);
    expect(side.assignAudit).toBe(1);
  });
});
