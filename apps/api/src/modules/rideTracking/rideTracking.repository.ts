import { and, asc, desc, eq, gt, lt } from "drizzle-orm";
import { db } from "../../db/client.js";
import {
  rideLocationUpdates,
  rideRequests,
  type NewRideLocationUpdate,
  type RideLocationUpdate,
  type RideRequest,
} from "../../db/schema/index.js";
import { AppError } from "../../shared/errors/AppError.js";

export class RideTrackingRepository {
  async findRideById(rideId: string): Promise<RideRequest | null> {
    try {
      const rows = await db
        .select()
        .from(rideRequests)
        .where(eq(rideRequests.id, rideId))
        .limit(1);

      return rows[0] ?? null;
    } catch (error) {
      throw AppError.internal(`Failed to query ride tracking owner: ${String(error)}`);
    }
  }

  async findLatest(rideId: string): Promise<RideLocationUpdate | null> {
    try {
      const rows = await db
        .select()
        .from(rideLocationUpdates)
        .where(
          and(
            eq(rideLocationUpdates.rideId, rideId),
            gt(rideLocationUpdates.expiresAt, new Date()),
          ),
        )
        .orderBy(desc(rideLocationUpdates.capturedAt))
        .limit(1);

      return rows[0] ?? null;
    } catch (error) {
      throw AppError.internal(`Failed to query latest ride location: ${String(error)}`);
    }
  }

  async insert(input: NewRideLocationUpdate): Promise<RideLocationUpdate> {
    try {
      const rows = await db
        .insert(rideLocationUpdates)
        .values(input)
        .onConflictDoNothing({
          target: [
            rideLocationUpdates.rideId,
            rideLocationUpdates.driverUserId,
            rideLocationUpdates.capturedAt,
          ],
        })
        .returning();

      if (rows[0]) return rows[0];

      const existing = await db
        .select()
        .from(rideLocationUpdates)
        .where(
          and(
            eq(rideLocationUpdates.rideId, input.rideId),
            eq(rideLocationUpdates.driverUserId, input.driverUserId),
            eq(rideLocationUpdates.capturedAt, input.capturedAt),
          ),
        )
        .limit(1);

      if (!existing[0]) {
        throw AppError.internal("Location update was not persisted.");
      }

      return existing[0];
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.internal(`Failed to save ride location: ${String(error)}`);
    }
  }

  /**
   * Inserta un lote en una sola sentencia.
   *
   * Devuelve SOLO las filas realmente insertadas: `onConflictDoNothing` sobre
   * el índice único (ride, driver, capturedAt) omite las que ya existían, así
   * que `rows.length - devueltas` son los duplicados. Reenviar un lote entero
   * es por tanto inofensivo, y eso es lo que permite que el cliente reintente
   * sin miedo cuando no sabe si su envío anterior llegó.
   */
  async insertMany(
    inputs: NewRideLocationUpdate[],
  ): Promise<RideLocationUpdate[]> {
    if (inputs.length === 0) return [];

    try {
      return await db
        .insert(rideLocationUpdates)
        .values(inputs)
        .onConflictDoNothing({
          target: [
            rideLocationUpdates.rideId,
            rideLocationUpdates.driverUserId,
            rideLocationUpdates.capturedAt,
          ],
        })
        .returning();
    } catch (error) {
      throw AppError.internal(
        `Failed to save ride location batch: ${String(error)}`,
      );
    }
  }

  async listRoute(rideId: string, limit: number): Promise<RideLocationUpdate[]> {
    try {
      const rows = await db
        .select()
        .from(rideLocationUpdates)
        .where(
          and(
            eq(rideLocationUpdates.rideId, rideId),
            gt(rideLocationUpdates.expiresAt, new Date()),
          ),
        )
        .orderBy(desc(rideLocationUpdates.capturedAt))
        .limit(limit);

      return rows.reverse();
    } catch (error) {
      throw AppError.internal(`Failed to query ride route: ${String(error)}`);
    }
  }

  async purgeExpired(now = new Date()): Promise<number> {
    try {
      const rows = await db
        .delete(rideLocationUpdates)
        .where(lt(rideLocationUpdates.expiresAt, now))
        .returning({ id: rideLocationUpdates.id });

      return rows.length;
    } catch (error) {
      throw AppError.internal(`Failed to purge expired ride locations: ${String(error)}`);
    }
  }
}
