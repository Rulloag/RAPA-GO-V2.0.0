/**
 * MICRO-GATE — persistent zero-side-effects / admin legacy / offline / payload.
 * Uses ephemeral local Postgres (never production).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { eq, sql as dsql } from "drizzle-orm";
import { VEHICLE_NOT_ELIGIBLE_CODE } from "@rapa-go/shared";
import { AppError } from "../../../shared/errors/AppError.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(here, "../../../..");
const bootstrap = path.join(apiRoot, "scripts/cert-persist-bootstrap.sh");
const DB_NAME = `rapago_microgate_${process.pid}_${Date.now()}`;
const HOST = process.env.PGHOST ?? "127.0.0.1";
const PORT = process.env.PGPORT ?? "5432";
const USER = process.env.PGUSER ?? process.env.USER ?? "postgres";
const DATABASE_URL = `postgresql://${USER}@${HOST}:${PORT}/${DB_NAME}`;

process.env.DATABASE_URL = DATABASE_URL;

const { db, sql } = await import("../../../db/client.js");
const {
  users,
  driverProfiles,
  rideRequests,
  rideDriverAssignments,
} = await import("../../../db/schema/index.js");
const { RidesRepository } = await import("../rides.repository.js");
const { AdminRepository } = await import("../../admin/admin.repository.js");

const ridesRepo = new RidesRepository();
const adminRepo = new AdminRepository();

type Snapshot = {
  driverUserId: string | null;
  status: string;
  assignedVehicleCategory: string | null;
  assignedVehiclePlate: string | null;
  queuedOfferDriverId: string | null;
  assignmentMode: string;
  paymentStatus: string | null;
  assignmentCount: number;
};

async function snapshotRide(rideId: string): Promise<Snapshot> {
  const ride = (
    await db.select().from(rideRequests).where(eq(rideRequests.id, rideId)).limit(1)
  )[0];
  if (!ride) throw new Error(`ride missing ${rideId}`);
  const assignments = await db
    .select()
    .from(rideDriverAssignments)
    .where(eq(rideDriverAssignments.rideRequestId, rideId));
  const pay = await sql`
    SELECT status FROM payment_orders WHERE ride_request_id = ${rideId} LIMIT 1
  `;
  return {
    driverUserId: ride.driverUserId ?? null,
    status: ride.status,
    assignedVehicleCategory: ride.assignedVehicleCategory ?? null,
    assignedVehiclePlate: ride.assignedVehiclePlate ?? null,
    queuedOfferDriverId: ride.queuedOfferDriverId ?? null,
    assignmentMode: ride.assignmentMode,
    paymentStatus: (pay[0] as { status?: string } | undefined)?.status ?? null,
    assignmentCount: assignments.length,
  };
}

async function seedPassenger(): Promise<string> {
  const id = randomUUID();
  await db.insert(users).values({
    id,
    email: `p-${id}@test.local`,
    name: "Passenger",
    role: "passenger",
    status: "active",
    isVerified: true,
  } as any);
  return id;
}

async function seedDriver(caps: {
  xl?: boolean;
  extra?: boolean;
  comfort?: boolean;
  year?: number;
  plate?: string;
}): Promise<string> {
  const id = randomUUID();
  await db.insert(users).values({
    id,
    email: `d-${id}@test.local`,
    name: "Driver",
    role: "driver",
    status: "active",
    isVerified: true,
  } as any);
  await db.insert(driverProfiles).values({
    userId: id,
    vehicleBrand: "Toyota",
    vehicleModel: "RAV4",
    vehicleYear: caps.year ?? 2024,
    vehiclePlate: caps.plate ?? "TEST01",
    vehicleCategory: "standard",
    capabilityXl: caps.xl === true,
    capabilityExtraLuggage: caps.extra === true,
    capabilityComfort: caps.comfort === true,
  } as any);
  return id;
}

async function seedRide(
  passengerId: string,
  requested: string,
  extras: Partial<{ paymentStatus: string; offline: boolean }> = {},
): Promise<string> {
  const id = randomUUID();
  await db.insert(rideRequests).values({
    id,
    passengerUserId: passengerId,
    originText: "Origen",
    destinationText: "Destino",
    status: "requested",
    requestedVehicleCategory: requested,
    isOfflineBooking: extras.offline === true,
    assignmentMode: "automatic",
  } as any);
  await sql`
    INSERT INTO payment_orders (ride_request_id, status, amount_clp)
    VALUES (${id}, ${extras.paymentStatus ?? "authorized"}, 10000)
  `;
  return id;
}

function expectUnchanged(before: Snapshot, after: Snapshot) {
  expect(after.driverUserId).toBe(before.driverUserId);
  expect(after.status).toBe(before.status);
  expect(after.assignedVehicleCategory).toBe(before.assignedVehicleCategory);
  expect(after.assignedVehiclePlate).toBe(before.assignedVehiclePlate);
  expect(after.queuedOfferDriverId).toBe(before.queuedOfferDriverId);
  expect(after.assignmentMode).toBe(before.assignmentMode);
  expect(after.assignmentCount).toBe(before.assignmentCount);
  expect(after.paymentStatus).toBe(before.paymentStatus);
}

describe("MICRO-GATE persistent acceptance side effects", () => {
  beforeAll(() => {
    execFileSync("bash", [bootstrap, DB_NAME], { stdio: "inherit" });
  });

  afterAll(async () => {
    try {
      await sql.end({ timeout: 5 });
    } catch {
      // ignore
    }
    try {
      execFileSync(
        "dropdb",
        ["-h", HOST, "-p", PORT, "-U", USER, DB_NAME],
        { stdio: "ignore" },
      );
    } catch {
      // ignore
    }
  });

  it("A) xl=false accept → 409 and DB unchanged", async () => {
    const passengerId = await seedPassenger();
    const driverId = await seedDriver({ xl: false });
    const rideId = await seedRide(passengerId, "xl");
    const before = await snapshotRide(rideId);
    expect(before.driverUserId).toBeNull();
    expect(before.status).toBe("requested");
    expect(before.assignedVehicleCategory).toBeNull();
    expect(before.assignedVehiclePlate).toBeNull();
    expect(before.assignmentCount).toBe(0);

    await expect(ridesRepo.accept(rideId, driverId)).rejects.toMatchObject({
      code: VEHICLE_NOT_ELIGIBLE_CODE,
      statusCode: 409,
    });

    const after = await snapshotRide(rideId);
    expectUnchanged(before, after);
  });

  it("B) extra_luggage=false accept → 409 and DB unchanged", async () => {
    const passengerId = await seedPassenger();
    const driverId = await seedDriver({ xl: true, extra: false });
    const rideId = await seedRide(passengerId, "extra_luggage");
    const before = await snapshotRide(rideId);

    await expect(ridesRepo.accept(rideId, driverId)).rejects.toMatchObject({
      code: VEHICLE_NOT_ELIGIBLE_CODE,
      statusCode: 409,
    });
    expectUnchanged(before, await snapshotRide(rideId));
  });

  it("C) comfort=false accept → 409 and DB unchanged", async () => {
    const passengerId = await seedPassenger();
    const driverId = await seedDriver({ comfort: false, year: 2024 });
    const rideId = await seedRide(passengerId, "comfort");
    const before = await snapshotRide(rideId);

    await expect(ridesRepo.accept(rideId, driverId)).rejects.toMatchObject({
      code: VEHICLE_NOT_ELIGIBLE_CODE,
      statusCode: 409,
    });
    expectUnchanged(before, await snapshotRide(rideId));
  });

  it("D) comfort year invalid → 409 and DB unchanged", async () => {
    const passengerId = await seedPassenger();
    const driverId = await seedDriver({ comfort: true, year: 2018 });
    const rideId = await seedRide(passengerId, "comfort");
    const before = await snapshotRide(rideId);

    await expect(ridesRepo.accept(rideId, driverId)).rejects.toMatchObject({
      code: VEHICLE_NOT_ELIGIBLE_CODE,
      statusCode: 409,
    });
    expectUnchanged(before, await snapshotRide(rideId));
  });

  it("AdminRepository.assignDriver comfort ineligible → REJECT + DB unchanged", async () => {
    const passengerId = await seedPassenger();
    const driverId = await seedDriver({ comfort: false, year: 2024 });
    const rideId = await seedRide(passengerId, "comfort");
    const before = await snapshotRide(rideId);

    await expect(adminRepo.assignDriver(rideId, driverId)).rejects.toBeInstanceOf(
      AppError,
    );
    await expect(adminRepo.assignDriver(rideId, driverId)).rejects.toMatchObject({
      code: VEHICLE_NOT_ELIGIBLE_CODE,
      statusCode: 409,
    });
    expectUnchanged(before, await snapshotRide(rideId));
  });

  it("AdminRepository.assignDriver xl ineligible → REJECT + DB unchanged", async () => {
    const passengerId = await seedPassenger();
    const driverId = await seedDriver({ xl: false });
    const rideId = await seedRide(passengerId, "xl");
    const before = await snapshotRide(rideId);

    await expect(adminRepo.assignDriver(rideId, driverId)).rejects.toMatchObject({
      code: VEHICLE_NOT_ELIGIBLE_CODE,
    });
    expectUnchanged(before, await snapshotRide(rideId));
  });

  it("offline-style accept comfort ineligible → no assignment (sync path core)", async () => {
    const passengerId = await seedPassenger();
    const driverId = await seedDriver({ comfort: false, year: 2024 });
    const rideId = await seedRide(passengerId, "comfort", { offline: true });
    const before = await snapshotRide(rideId);

    let rejected = false;
    try {
      await ridesRepo.accept(rideId, driverId);
    } catch (err) {
      rejected = true;
      expect(err).toMatchObject({
        code: VEHICLE_NOT_ELIGIBLE_CODE,
        statusCode: 409,
      });
    }
    expect(rejected).toBe(true);
    expectUnchanged(before, await snapshotRide(rideId));
  });

  it("offline-style accept comfort eligible → PASS assigned comfort", async () => {
    const passengerId = await seedPassenger();
    const driverId = await seedDriver({
      comfort: true,
      year: 2024,
      plate: "CMF999",
    });
    const rideId = await seedRide(passengerId, "comfort", { offline: true });

    const accepted = await ridesRepo.accept(rideId, driverId);
    expect(accepted).not.toBeNull();
    expect(accepted!.driverUserId).toBe(driverId);
    expect(accepted!.status).toBe("accepted");
    expect(accepted!.assignedVehicleCategory).toBe("comfort");
    expect(accepted!.assignedVehiclePlate).toBe("CMF999");

    const after = await snapshotRide(rideId);
    expect(after.assignmentCount).toBe(1);
    expect(after.paymentStatus).toBe("authorized");
  });

  it("ATTACK4 malicious client fields cannot become assigned snapshot", async () => {
    const passengerId = await seedPassenger();
    const driverId = await seedDriver({
      xl: true,
      comfort: false,
      plate: "XLONLY",
    });
    const rideId = await seedRide(passengerId, "standard");

    // Client-controlled fields are not parameters of accept(id, driverUserId).
    // Even if someone tampers DB-facing payload conceptually, repository ignores them.
    const accepted = await ridesRepo.accept(rideId, driverId);
    expect(accepted!.assignedVehicleCategory).toBe("xl");
    expect(accepted!.assignedVehicleCategory).not.toBe("comfort");
    expect(accepted!.assignedVehiclePlate).toBe("XLONLY");
    expect(accepted!.assignedVehiclePlate).not.toBe("falsa");

    const after = await snapshotRide(rideId);
    expect(after.assignedVehicleCategory).toBe("xl");
    expect(after.assignedVehiclePlate).toBe("XLONLY");
  });

  it("accept path uses FOR UPDATE (source + successful lock path)", async () => {
    const repoSrc = await import("node:fs").then((fs) =>
      fs.readFileSync(
        path.join(apiRoot, "src/modules/rides/rides.repository.ts"),
        "utf8",
      ),
    );
    const acceptSlice = repoSrc.slice(
      repoSrc.indexOf("async accept(id: string, driverUserId: string)"),
      repoSrc.indexOf("async complete(id: string, driverUserId: string)"),
    );
    expect(acceptSlice).toContain('.for("update")');
    expect(acceptSlice.indexOf('.for("update")')).toBeLessThan(
      acceptSlice.indexOf("assertVehicleEligibleForRide"),
    );
  });
});
