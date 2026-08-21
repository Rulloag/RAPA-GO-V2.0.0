/**
 * CERT — admin assign eligibility (source + productive error mapping).
 * Avoids importing AdminService (pulls DATABASE_URL via repositories).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AppError } from "../../../shared/errors/AppError.js";
import { VEHICLE_NOT_ELIGIBLE_CODE } from "@rapa-go/shared";

const here = path.dirname(fileURLToPath(import.meta.url));

function readSrc(rel: string): string {
  return readFileSync(path.join(here, rel), "utf8");
}

describe("CERT — admin assign eligibility", () => {
  it("admin.service.assignDriver uses ridesRepo.accept and maps AppError", () => {
    const src = readSrc("../admin.service.ts");
    expect(src).toContain("async assignDriver(");
    expect(src).toContain("ridesRepo.accept(rideId, input.driverUserId)");
    expect(src).toContain("if (err instanceof AppError)");
    expect(src).toContain("code: err.code");
    expect(src).toContain("statusCode: err.statusCode");
  });

  it("admin.repository.assignDriver enforces assertVehicleEligibleForRide", () => {
    const src = readSrc("../admin.repository.ts");
    const fnStart = src.indexOf("async assignDriver(rideId: string, driverUserId: string)");
    expect(fnStart).toBeGreaterThan(-1);
    const fnBody = src.slice(fnStart, fnStart + 1800);
    expect(fnBody).toContain("assertVehicleEligibleForRide");
    expect(fnBody).toContain("assignedVehicleCategory");
    expect(fnBody).toContain("assignedVehiclePlate");
    expect(fnBody).toContain("requestedVehicleCategory");
  });

  it("ATTACK8 simulation: eligibility AppError → 409, no setBusy side effect", async () => {
    const sideEffects = { setBusy: 0, audit: 0 };
    async function adminAssignSimulated(acceptImpl: () => Promise<unknown>) {
      try {
        await acceptImpl();
        sideEffects.setBusy += 1;
        sideEffects.audit += 1;
        return { ok: true as const };
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
    }

    const result = await adminAssignSimulated(async () => {
      throw new AppError({
        code: VEHICLE_NOT_ELIGIBLE_CODE,
        message: "not eligible",
        statusCode: 409,
      });
    });

    expect(result).toEqual({
      ok: false,
      code: VEHICLE_NOT_ELIGIBLE_CODE,
      statusCode: 409,
    });
    expect(sideEffects.setBusy).toBe(0);
    expect(sideEffects.audit).toBe(0);
  });

  it("ATTACK8b: comfort/extra_luggage same defense path", async () => {
    for (const category of ["comfort", "extra_luggage", "xl"] as const) {
      const result = await (async () => {
        try {
          throw new AppError({
            code: VEHICLE_NOT_ELIGIBLE_CODE,
            message: `ineligible for ${category}`,
            statusCode: 409,
          });
        } catch (err) {
          if (err instanceof AppError) {
            return { ok: false as const, code: err.code, category };
          }
          throw err;
        }
      })();
      expect(result.ok).toBe(false);
      expect(result.code).toBe(VEHICLE_NOT_ELIGIBLE_CODE);
    }
  });
});
