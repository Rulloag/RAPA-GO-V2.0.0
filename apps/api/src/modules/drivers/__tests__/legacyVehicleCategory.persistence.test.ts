import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";

const here = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(here, "../../../..");
const bootstrap = path.join(apiRoot, "scripts/cert-persist-bootstrap.sh");
const DB_NAME = `rapago_legacy_cat_${process.pid}_${Date.now()}`;
const HOST = process.env.PGHOST ?? "127.0.0.1";
const PORT = process.env.PGPORT ?? "5432";
const USER = process.env.PGUSER ?? process.env.USER ?? "postgres";
const DATABASE_URL = `postgresql://${USER}@${HOST}:${PORT}/${DB_NAME}`;

process.env.DATABASE_URL = DATABASE_URL;

const { assertSafeCertificationDatabaseUrl } = await import(
  "../../../db/testDatabaseGuard.js"
);
assertSafeCertificationDatabaseUrl(DATABASE_URL, "legacyVehicleCategory.persistence");

const { db } = await import("../../../db/client.js");
const { users, driverProfiles } = await import("../../../db/schema/index.js");
const { DriverProfileRepository } = await import(
  "../../drivers/driverProfile.repository.js"
);

const profileRepo = new DriverProfileRepository();

async function seedDriver(caps: {
  xl: boolean;
  extra: boolean;
  comfort: boolean;
  category?: string;
}): Promise<string> {
  const id = randomUUID();
  await db.insert(users).values({
    id,
    email: `legacy-${id}@test.local`,
    name: "Driver",
    role: "driver",
    status: "active",
    isVerified: true,
  } as never);
  await db.insert(driverProfiles).values({
    userId: id,
    vehicleYear: 2024,
    vehicleCategory: caps.category ?? "xl",
    capabilityXl: caps.xl,
    capabilityExtraLuggage: caps.extra,
    capabilityComfort: caps.comfort,
  } as never);
  return id;
}

describe("legacy vehicle_category endpoint — non-destructive capabilities", () => {
  beforeAll(() => {
    execFileSync("bash", [bootstrap, DB_NAME], { stdio: "inherit" });
  });

  afterAll(async () => {
    const { sql } = await import("../../../db/client.js");
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

  it("legacy setApprovedVehicleCategory=xl preserves xl+extra+comfort flags", async () => {
    const userId = await seedDriver({
      xl: true,
      extra: true,
      comfort: true,
      category: "comfort",
    });

    await profileRepo.setApprovedVehicleCategory(userId, "xl");

    const row = (
      await db
        .select()
        .from(driverProfiles)
        .where(eq(driverProfiles.userId, userId))
        .limit(1)
    )[0]!;

    expect(row.vehicleCategory).toBe("xl");
    expect(row.capabilityXl).toBe(true);
    expect(row.capabilityExtraLuggage).toBe(true);
    expect(row.capabilityComfort).toBe(true);
  });

  it("legacy setApprovedVehicleCategory=standard preserves extra+comfort flags", async () => {
    const userId = await seedDriver({
      xl: false,
      extra: true,
      comfort: true,
      category: "extra_luggage",
    });

    await profileRepo.setApprovedVehicleCategory(userId, "standard");

    const row = (
      await db
        .select()
        .from(driverProfiles)
        .where(eq(driverProfiles.userId, userId))
        .limit(1)
    )[0]!;

    expect(row.vehicleCategory).toBe("standard");
    expect(row.capabilityExtraLuggage).toBe(true);
    expect(row.capabilityComfort).toBe(true);
  });

  it("explicit setVehicleCapabilities can revoke individually", async () => {
    const userId = await seedDriver({
      xl: true,
      extra: true,
      comfort: true,
    });

    await profileRepo.setVehicleCapabilities(userId, {
      xl: true,
      extraLuggage: true,
      comfort: false,
    });

    const row = (
      await db
        .select()
        .from(driverProfiles)
        .where(eq(driverProfiles.userId, userId))
        .limit(1)
    )[0]!;

    expect(row.capabilityComfort).toBe(false);
    expect(row.capabilityXl).toBe(true);
    expect(row.capabilityExtraLuggage).toBe(true);
  });
});
