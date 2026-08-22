import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { eq, sql as dsql } from "drizzle-orm";
import { VEHICLE_NOT_ELIGIBLE_CODE } from "@rapa-go/shared";

const here = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(here, "../../../..");
const bootstrap = path.join(apiRoot, "scripts/cert-persist-bootstrap.sh");
const DB_NAME = `rapago_offline_sync_${process.pid}_${Date.now()}`;
const HOST = process.env.PGHOST ?? "127.0.0.1";
const PORT = process.env.PGPORT ?? "5432";
const USER = process.env.PGUSER ?? process.env.USER ?? "postgres";
const DATABASE_URL = `postgresql://${USER}@${HOST}:${PORT}/${DB_NAME}`;

process.env.DATABASE_URL = DATABASE_URL;

const { assertSafeCertificationDatabaseUrl } = await import(
  "../../../db/testDatabaseGuard.js"
);
assertSafeCertificationDatabaseUrl(DATABASE_URL, "offlineSyncAtomic.persistence");

const { db, sql } = await import("../../../db/client.js");
const {
  users,
  driverProfiles,
  rideRequests,
  offlineBookings,
} = await import("../../../db/schema/index.js");
const { RidesRepository } = await import("../../rides/rides.repository.js");

const ridesRepo = new RidesRepository();

async function countRides(): Promise<number> {
  const rows = await db.select({ c: dsql<number>`count(*)::int` }).from(rideRequests);
  return rows[0]?.c ?? 0;
}

describe("offline sync atomic assignment", () => {
  beforeAll(() => {
    execFileSync("bash", [bootstrap, DB_NAME], { stdio: "inherit" });
  });

  afterAll(async () => {
    try {
      await sql.end({ timeout: 5 });
    } catch {
      // ignore
    }
    execFileSync(
      "dropdb",
      ["--if-exists", "-h", HOST, "-p", PORT, "-U", USER, DB_NAME],
      { stdio: "ignore" },
    );
  });

  it("ineligible comfort driver → rollback, zero new ride, booking stays pending", async () => {
    const adminId = randomUUID();
    const driverId = randomUUID();
    const bookingId = randomUUID();

    await db.insert(users).values([
      {
        id: adminId,
        email: `admin-${adminId}@test.local`,
        name: "Admin",
        role: "admin",
        status: "active",
        isVerified: true,
      },
      {
        id: driverId,
        email: `driver-${driverId}@test.local`,
        name: "Driver",
        role: "driver",
        status: "active",
        isVerified: true,
      },
    ] as never);

    await db.insert(driverProfiles).values({
      userId: driverId,
      vehicleYear: 2024,
      vehicleCategory: "standard",
      capabilityComfort: false,
    } as never);

    await db.insert(offlineBookings).values({
      id: bookingId,
      adminId,
      passengerName: "Offline Pax",
      passengerPhone: "+56900000000",
      originText: "A",
      destinationText: "B",
      status: "pending_sync",
    } as never);

    const beforeCount = await countRides();

    await expect(
      ridesRepo.syncOfflineBookingWithDriverAssignment({
        offlineBookingId: bookingId,
        passengerUserId: adminId,
        driverUserId: driverId,
        originText: "A",
        destinationText: "B",
        notes: null,
        offlinePassengerName: "Offline Pax",
        offlinePassengerPhone: "+56900000000",
        requestedVehicleCategory: "comfort",
      }),
    ).rejects.toMatchObject({ code: VEHICLE_NOT_ELIGIBLE_CODE, statusCode: 409 });

    expect(await countRides()).toBe(beforeCount);

    const booking = (
      await db
        .select()
        .from(offlineBookings)
        .where(eq(offlineBookings.id, bookingId))
        .limit(1)
    )[0]!;
    expect(booking.status).toBe("pending_sync");
    expect(booking.syncedToRideId).toBeNull();
  });

  it("eligible driver → one ride, booking synced, driver assigned", async () => {
    const adminId = randomUUID();
    const driverId = randomUUID();
    const bookingId = randomUUID();

    await db.insert(users).values([
      {
        id: adminId,
        email: `admin2-${adminId}@test.local`,
        name: "Admin",
        role: "admin",
        status: "active",
        isVerified: true,
      },
      {
        id: driverId,
        email: `driver2-${driverId}@test.local`,
        name: "Driver",
        role: "driver",
        status: "active",
        isVerified: true,
      },
    ] as never);

    await db.insert(driverProfiles).values({
      userId: driverId,
      vehicleYear: 2024,
      vehiclePlate: "COMF01",
      vehicleCategory: "comfort",
      capabilityComfort: true,
    } as never);

    await db.insert(offlineBookings).values({
      id: bookingId,
      adminId,
      passengerName: "Offline Pax",
      passengerPhone: "+56900000001",
      originText: "A",
      destinationText: "B",
      status: "pending_sync",
    } as never);

    const beforeCount = await countRides();

    const ride = await ridesRepo.syncOfflineBookingWithDriverAssignment({
      offlineBookingId: bookingId,
      passengerUserId: adminId,
      driverUserId: driverId,
      originText: "A",
      destinationText: "B",
      notes: null,
      offlinePassengerName: "Offline Pax",
      offlinePassengerPhone: "+56900000001",
      requestedVehicleCategory: "comfort",
    });

    expect(await countRides()).toBe(beforeCount + 1);
    expect(ride.driverUserId).toBe(driverId);
    expect(ride.assignedVehicleCategory).toBe("comfort");
    expect(ride.status).toBe("accepted");

    const booking = (
      await db
        .select()
        .from(offlineBookings)
        .where(eq(offlineBookings.id, bookingId))
        .limit(1)
    )[0]!;
    expect(booking.status).toBe("synced");
    expect(booking.syncedToRideId).toBe(ride.id);
  });
});
