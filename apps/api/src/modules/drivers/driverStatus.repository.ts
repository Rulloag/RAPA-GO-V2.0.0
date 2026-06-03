import { eq } from "drizzle-orm";
import { db } from "../../db/client.js";
import { driverStatuses } from "../../db/schema/index.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { DriverStatus } from "../../db/schema/index.js";

export class DriverStatusRepository {
  async findByDriverId(driverUserId: string): Promise<DriverStatus | null> {
    try {
      const rows = await db.select().from(driverStatuses)
        .where(eq(driverStatuses.driverUserId, driverUserId)).limit(1);
      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(`Failed to query driver status: ${String(err)}`);
    }
  }

  async upsert(driverUserId: string, availability: string, currentZone?: string | null): Promise<DriverStatus> {
    try {
      const setValues: Partial<typeof driverStatuses.$inferInsert> = {
        availability,
        lastSeenAt: new Date(),
        updatedAt: new Date(),
      };
      if (currentZone !== undefined) setValues.currentZone = currentZone;

      const rows = await db
        .insert(driverStatuses)
        .values({ driverUserId, availability, currentZone: currentZone ?? null, lastSeenAt: new Date() })
        .onConflictDoUpdate({
          target: driverStatuses.driverUserId,
          set: setValues,
        })
        .returning();
      const row = rows[0];
      if (!row) throw AppError.internal("Upsert returned no rows.");
      return row;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw AppError.internal(`Failed to upsert driver status: ${String(err)}`);
    }
  }

  async setBusy(driverUserId: string, rideId: string): Promise<void> {
    try {
      await db
        .insert(driverStatuses)
        .values({ driverUserId, availability: "busy", currentRideId: rideId, lastSeenAt: new Date() })
        .onConflictDoUpdate({
          target: driverStatuses.driverUserId,
          set: { availability: "busy", currentRideId: rideId, updatedAt: new Date() },
        });
    } catch (err) {
      throw AppError.internal(`Failed to set driver busy: ${String(err)}`);
    }
  }

  async updateLocation(driverUserId: string, lat: number, lng: number): Promise<void> {
    try {
      await db
        .insert(driverStatuses)
        .values({ driverUserId, availability: "unavailable", currentLat: lat, currentLng: lng, locationUpdatedAt: new Date() })
        .onConflictDoUpdate({
          target: driverStatuses.driverUserId,
          set: { currentLat: lat, currentLng: lng, locationUpdatedAt: new Date(), updatedAt: new Date() },
        });
    } catch (err) {
      throw AppError.internal(`Failed to update driver location: ${String(err)}`);
    }
  }

  async setAvailable(driverUserId: string): Promise<void> {
    try {
      await db
        .insert(driverStatuses)
        .values({ driverUserId, availability: "available", currentRideId: null, lastSeenAt: new Date() })
        .onConflictDoUpdate({
          target: driverStatuses.driverUserId,
          set: { availability: "available", currentRideId: null, updatedAt: new Date() },
        });
    } catch (err) {
      throw AppError.internal(`Failed to set driver available: ${String(err)}`);
    }
  }
}
