import { eq, and, isNull, isNotNull, gte } from "drizzle-orm";
import { db } from "../../db/client.js";
import { driverStatuses, driverProfiles, rideRequests, users } from "../../db/schema/index.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { DriverStatus } from "../../db/schema/index.js";

export interface AvailableDriverCandidate {
  driverUserId:       string;
  currentLat:         number;
  currentLng:         number;
  locationUpdatedAt:  Date;
  lastSeenAt:         Date;
  currentZone:        string | null;
}

export interface BusyDriverCandidate {
  driverUserId:       string;
  currentLat:         number;
  currentLng:         number;
  locationUpdatedAt:  Date;
  lastSeenAt:         Date;
  currentRideId:      string;
}

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
      const now = new Date();
      await db
        .insert(driverStatuses)
        .values({ driverUserId, availability: "available", currentRideId: null, lastSeenAt: now })
        .onConflictDoUpdate({
          target: driverStatuses.driverUserId,
          set: { availability: "available", currentRideId: null, lastSeenAt: now, updatedAt: now },
        });
    } catch (err) {
      throw AppError.internal(`Failed to set driver available: ${String(err)}`);
    }
  }

  async setQueuedRide(driverUserId: string, rideId: string): Promise<void> {
    try {
      await db
        .insert(driverStatuses)
        .values({ driverUserId, availability: "busy", queuedRideId: rideId, lastSeenAt: new Date() })
        .onConflictDoUpdate({
          target: driverStatuses.driverUserId,
          set: { queuedRideId: rideId, updatedAt: new Date() },
        });
    } catch (err) {
      throw AppError.internal(`Failed to set queued ride: ${String(err)}`);
    }
  }

  async clearQueuedRide(driverUserId: string): Promise<void> {
    try {
      await db
        .insert(driverStatuses)
        .values({ driverUserId, availability: "busy", queuedRideId: null, lastSeenAt: new Date() })
        .onConflictDoUpdate({
          target: driverStatuses.driverUserId,
          set: { queuedRideId: null, updatedAt: new Date() },
        });
    } catch (err) {
      throw AppError.internal(`Failed to clear queued ride: ${String(err)}`);
    }
  }

  /**
   * Returns busy drivers eligible to receive a queued ride offer.
   *
   * Criteria:
   * - availability = 'busy'
   * - currentRideId IS NOT NULL (actively on a ride)
   * - queuedRideId IS NULL (no next ride already committed)
   * - currentLat/Lng present and fresh (locationCutoff)
   * - lastSeenAt fresh (lastSeenCutoff)
   * - their currentRide has status = 'in_progress' (already picked up passenger)
   * - user role = 'driver' AND status = 'active'
   *
   * Results are returned unsorted — the service layer applies haversine distance
   * ranking so it can reuse the same haversineKm utility already in rides.service.ts.
   */
  async findBusyEligibleForQueuedOffer(opts: {
    locationCutoff: Date;
    lastSeenCutoff: Date;
    genderFilter?:  "female" | "male";
  }): Promise<BusyDriverCandidate[]> {
    try {
      const conditions = [
        eq(driverStatuses.availability, "busy"),
        isNotNull(driverStatuses.currentRideId),
        isNull(driverStatuses.queuedRideId),
        isNotNull(driverStatuses.currentLat),
        isNotNull(driverStatuses.currentLng),
        isNotNull(driverStatuses.locationUpdatedAt),
        gte(driverStatuses.locationUpdatedAt, opts.locationCutoff),
        gte(driverStatuses.lastSeenAt, opts.lastSeenCutoff),
        eq(users.role, "driver"),
        eq(users.status, "active"),
        eq(rideRequests.status, "in_progress"),
        ...(opts.genderFilter ? [eq(driverProfiles.gender, opts.genderFilter)] : []),
      ];

      const rows = await db
        .select({
          driverUserId:      driverStatuses.driverUserId,
          currentLat:        driverStatuses.currentLat,
          currentLng:        driverStatuses.currentLng,
          locationUpdatedAt: driverStatuses.locationUpdatedAt,
          lastSeenAt:        driverStatuses.lastSeenAt,
          currentRideId:     driverStatuses.currentRideId,
        })
        .from(driverStatuses)
        .innerJoin(users, eq(driverStatuses.driverUserId, users.id))
        .innerJoin(rideRequests, eq(driverStatuses.currentRideId, rideRequests.id))
        .leftJoin(driverProfiles, eq(driverStatuses.driverUserId, driverProfiles.userId))
        .where(and(...conditions));

      return rows.filter(
        (r): r is BusyDriverCandidate =>
          r.currentLat        !== null &&
          r.currentLng        !== null &&
          r.locationUpdatedAt !== null &&
          r.lastSeenAt        !== null &&
          r.currentRideId     !== null,
      );
    } catch (err) {
      throw AppError.internal(`Failed to query busy eligible drivers: ${String(err)}`);
    }
  }

  async findAvailableWithLocation(opts: {
    locationCutoff: Date;
    lastSeenCutoff: Date;
    genderFilter?:  "female" | "male";
  }): Promise<AvailableDriverCandidate[]> {
    try {
      const conditions = [
        eq(driverStatuses.availability, "available"),
        isNull(driverStatuses.currentRideId),
        isNotNull(driverStatuses.currentLat),
        isNotNull(driverStatuses.currentLng),
        isNotNull(driverStatuses.locationUpdatedAt),
        gte(driverStatuses.locationUpdatedAt, opts.locationCutoff),
        gte(driverStatuses.lastSeenAt, opts.lastSeenCutoff),
        eq(users.role, "driver"),
        eq(users.status, "active"),
        ...(opts.genderFilter ? [eq(driverProfiles.gender, opts.genderFilter)] : []),
      ];

      const rows = await db
        .select({
          driverUserId:      driverStatuses.driverUserId,
          currentLat:        driverStatuses.currentLat,
          currentLng:        driverStatuses.currentLng,
          locationUpdatedAt: driverStatuses.locationUpdatedAt,
          lastSeenAt:        driverStatuses.lastSeenAt,
          currentZone:       driverStatuses.currentZone,
        })
        .from(driverStatuses)
        .innerJoin(users, eq(driverStatuses.driverUserId, users.id))
        .leftJoin(driverProfiles, eq(driverStatuses.driverUserId, driverProfiles.userId))
        .where(and(...conditions));

      return rows.filter(
        (r): r is AvailableDriverCandidate =>
          r.currentLat !== null &&
          r.currentLng !== null &&
          r.locationUpdatedAt !== null &&
          r.lastSeenAt !== null,
      );
    } catch (err) {
      throw AppError.internal(`Failed to query available drivers: ${String(err)}`);
    }
  }
}
