import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "../../db/client.js";
import { rideStops } from "../../db/schema/index.js";
import { AppError } from "../../shared/errors/AppError.js";
import type { RideStop } from "../../db/schema/index.js";
import type { RideStopInput } from "./rideStops.types.js";

export class RideStopsRepository {
  /**
   * Insert an ordered list of stops for a ride.
   * Existing stops for the ride are NOT removed — callers must ensure
   * the ride has no stops yet before calling createMany.
   */
  async createMany(rideRequestId: string, stops: RideStopInput[]): Promise<RideStop[]> {
    if (stops.length === 0) return [];
    try {
      const rows = stops.map((s) => ({
        rideRequestId,
        stopOrder:              s.stopOrder,
        label:                  s.label,
        lat:                    s.lat,
        lng:                    s.lng,
        segmentDistanceMeters:  s.segmentDistanceMeters ?? null,
        segmentDurationSeconds: s.segmentDurationSeconds ?? null,
        segmentFareClp:         s.segmentFareClp ?? null,
      }));
      return await db.insert(rideStops).values(rows).returning();
    } catch (err) {
      throw AppError.internal(`Failed to create ride stops: ${String(err)}`);
    }
  }

  /**
   * Return all stops for a ride ordered by stopOrder ASC.
   */
  async findByRideId(rideRequestId: string): Promise<RideStop[]> {
    try {
      return await db
        .select()
        .from(rideStops)
        .where(eq(rideStops.rideRequestId, rideRequestId))
        .orderBy(asc(rideStops.stopOrder));
    } catch (err) {
      throw AppError.internal(`Failed to query ride stops: ${String(err)}`);
    }
  }

  /**
   * Return stops for multiple rides ordered by rideRequestId then stopOrder ASC.
   * Useful for bulk-fetching stops when listing rides.
   */
  async findManyByRideIds(rideRequestIds: string[]): Promise<RideStop[]> {
    if (rideRequestIds.length === 0) return [];
    try {
      return await db
        .select()
        .from(rideStops)
        .where(inArray(rideStops.rideRequestId, rideRequestIds))
        .orderBy(asc(rideStops.rideRequestId), asc(rideStops.stopOrder));
    } catch (err) {
      throw AppError.internal(`Failed to bulk-query ride stops: ${String(err)}`);
    }
  }

  /**
   * Set arrivedAt = now() for a specific stop.
   * Only sets the timestamp if it is not already set.
   */
  async markArrived(rideRequestId: string, stopOrder: number): Promise<RideStop | null> {
    try {
      const now = new Date();
      const rows = await db
        .update(rideStops)
        .set({ arrivedAt: now, updatedAt: now })
        .where(
          and(
            eq(rideStops.rideRequestId, rideRequestId),
            eq(rideStops.stopOrder, stopOrder),
          ),
        )
        .returning();
      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(`Failed to mark stop arrived: ${String(err)}`);
    }
  }

  /**
   * Set completedAt = now() for a specific stop.
   * Only sets the timestamp if it is not already set.
   */
  async markCompleted(rideRequestId: string, stopOrder: number): Promise<RideStop | null> {
    try {
      const now = new Date();
      const rows = await db
        .update(rideStops)
        .set({ completedAt: now, updatedAt: now })
        .where(
          and(
            eq(rideStops.rideRequestId, rideRequestId),
            eq(rideStops.stopOrder, stopOrder),
          ),
        )
        .returning();
      return rows[0] ?? null;
    } catch (err) {
      throw AppError.internal(`Failed to mark stop completed: ${String(err)}`);
    }
  }
}
